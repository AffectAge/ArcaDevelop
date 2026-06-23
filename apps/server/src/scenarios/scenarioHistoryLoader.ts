import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readFlatScenarioLocalizationFile, resolveLocalizedValue } from "./scenarioLocalization";

export type ScenarioHistoryEntityKind = "region" | "country";

export type ScenarioHistoryEntity = {
  id: string;
  path: string;
  kind: ScenarioHistoryEntityKind;
  data: Record<string, unknown>;
};

export type ScenarioHistory = {
  regions: ScenarioHistoryEntity[];
  countries: ScenarioHistoryEntity[];
  regionIdByHexId: Map<string, string>;
  hexIdsByRegionId: Map<string, string[]>;
};

export type ScenarioCountryMetadata = {
  id: string;
  name: string;
  color: string;
  flagUrl: string | null;
  crestUrl: string | null;
};

export type ScenarioResourceTotals = {
  culture: number;
  science: number;
  religion: number;
  colonization: number;
  construction: number;
  ducats: number;
  gold: number;
};

const SCENARIO_RESOURCE_KEYS = [
  "culture",
  "science",
  "religion",
  "colonization",
  "construction",
  "ducats",
  "gold",
] as const satisfies readonly (keyof ScenarioResourceTotals)[];

export function buildScenarioCountryMetadata(scenarioDir: string, history: ScenarioHistory): ScenarioCountryMetadata[] {
  const ru = readFlatScenarioLocalizationFile(resolve(scenarioDir, "localisation/ru.json"));
  const en = readFlatScenarioLocalizationFile(resolve(scenarioDir, "localisation/en.json"));
  return history.countries.map((country) => {
    if ("isAdmin" in country.data || "passwordHash" in country.data || "password" in country.data) {
      throw new Error(`SCENARIO_COUNTRY_FORBIDDEN_SECURITY_FIELD:${country.id}`);
    }
    const color = normalizeCountryColor(country.data.color, country.id);
    return {
      id: country.id,
      name: resolveLocalizedValue({
        value: country.data.name,
        nameKey: country.data.nameKey,
        preferred: ru,
        fallback: en,
        fallbackValue: country.id,
      }),
      color,
      flagUrl: normalizeNullableString(country.data.flagUrl),
      crestUrl: normalizeNullableString(country.data.crestUrl),
    };
  });
}

export function buildResourcesByCountryFromHistory(history: ScenarioHistory): Record<string, ScenarioResourceTotals> {
  const resourcesByCountry: Record<string, ScenarioResourceTotals> = {};
  for (const country of history.countries) {
    resourcesByCountry[country.id] = normalizeScenarioResourceTotals(
      country.data.resources ?? country.data.startingResources,
    );
  }
  return resourcesByCountry;
}

export function buildAiControlledCountryIdsFromHistory(history: ScenarioHistory | null): string[] {
  if (!history) return [];
  return history.countries
    .filter((country) => country.data.controlMode === "ai")
    .map((country) => country.id)
    .sort((left, right) => left.localeCompare(right));
}

export function buildHexOwnerFromRegionHistory(history: ScenarioHistory): Record<string, string> {
  const hexOwner: Record<string, string> = {};
  for (const region of history.regions) {
    const ownerCountryId =
      typeof region.data.ownerCountryId === "string" && region.data.ownerCountryId.trim()
        ? region.data.ownerCountryId.trim()
        : null;
    if (!ownerCountryId) continue;
    const hexIds = history.hexIdsByRegionId.get(region.id) ?? [];
    for (const hexId of hexIds) {
      hexOwner[hexId] = ownerCountryId;
    }
  }
  return hexOwner;
}

export function buildRegionOwnerFromRegionHistory(history: ScenarioHistory): Record<string, string> {
  const regionOwner: Record<string, string> = {};
  for (const region of history.regions) {
    const ownerCountryId =
      typeof region.data.ownerCountryId === "string" && region.data.ownerCountryId.trim()
        ? region.data.ownerCountryId.trim()
        : null;
    if (ownerCountryId) {
      regionOwner[region.id] = ownerCountryId;
    }
  }
  return regionOwner;
}

export function buildRegionControllerFromRegionHistory(history: ScenarioHistory): Record<string, string> {
  const regionOwner = buildRegionOwnerFromRegionHistory(history);
  const regionController: Record<string, string> = {};
  for (const region of history.regions) {
    const controllerCountryId =
      typeof region.data.controllerCountryId === "string" && region.data.controllerCountryId.trim()
        ? region.data.controllerCountryId.trim()
        : null;
    const controller = controllerCountryId ?? regionOwner[region.id] ?? null;
    if (controller) {
      regionController[region.id] = controller;
    }
  }
  return regionController;
}

function normalizeScenarioResourceTotals(input: unknown): ScenarioResourceTotals {
  const source = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const result: ScenarioResourceTotals = {
    culture: 0,
    science: 0,
    religion: 0,
    colonization: 0,
    construction: 0,
    ducats: 0,
    gold: 0,
  };
  for (const key of SCENARIO_RESOURCE_KEYS) {
    const value = source[key];
    result[key] = typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
  }
  return result;
}

function normalizeCountryColor(value: unknown, countryId: string): string {
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())) return value.trim();
  throw new Error(`SCENARIO_COUNTRY_INVALID_COLOR:${countryId}`);
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function loadScenarioHistory(scenarioDir: string): ScenarioHistory {
  const regions = loadHistoryEntities(scenarioDir, "region", "history/regions");
  const countries = loadHistoryEntities(scenarioDir, "country", "history/countries");
  assertUniqueEntityIds([...regions, ...countries]);
  const { regionIdByHexId, hexIdsByRegionId } = buildRegionMembershipIndexes(regions);

  return {
    regions,
    countries,
    regionIdByHexId,
    hexIdsByRegionId,
  };
}

function loadHistoryEntities(
  scenarioDir: string,
  kind: ScenarioHistoryEntityKind,
  relativeDir: string,
): ScenarioHistoryEntity[] {
  const root = resolve(scenarioDir, relativeDir);
  if (!existsSync(root)) return [];
  return listJsonFiles(root).map((path) => {
    const data = readJsonObject(path);
    const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : null;
    if (!id) {
      throw new Error(`SCENARIO_HISTORY_ENTITY_ID_MISSING:${path}`);
    }
    return { id, path, kind, data };
  });
}

function buildRegionMembershipIndexes(regions: ScenarioHistoryEntity[]): {
  regionIdByHexId: Map<string, string>;
  hexIdsByRegionId: Map<string, string[]>;
} {
  const regionIdByHexId = new Map<string, string>();
  const hexIdsByRegionId = new Map<string, string[]>();

  for (const region of regions) {
    const hexIds = Array.isArray(region.data.hexIds)
      ? region.data.hexIds.filter((hexId): hexId is string => typeof hexId === "string")
      : [];
    hexIdsByRegionId.set(region.id, hexIds);
    for (const hexId of hexIds) {
      const previousRegionId = regionIdByHexId.get(hexId);
      if (previousRegionId) {
        throw new Error(`SCENARIO_HISTORY_DUPLICATE_REGION_MEMBERSHIP:${hexId}:${previousRegionId}:${region.id}`);
      }
      regionIdByHexId.set(hexId, region.id);
    }
  }

  return { regionIdByHexId, hexIdsByRegionId };
}

function assertUniqueEntityIds(entities: ScenarioHistoryEntity[]): void {
  const seen = new Map<string, string>();
  for (const entity of entities) {
    const previousPath = seen.get(entity.id);
    if (previousPath) {
      throw new Error(`SCENARIO_HISTORY_DUPLICATE_ID:${entity.id}:${previousPath}:${entity.path}`);
    }
    seen.set(entity.id, entity.path);
  }
}

function listJsonFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const childPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(childPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      files.push(childPath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b, "en"));
}

function readJsonObject(path: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`SCENARIO_HISTORY_JSON_OBJECT_REQUIRED:${path}`);
  }
  return parsed as Record<string, unknown>;
}
