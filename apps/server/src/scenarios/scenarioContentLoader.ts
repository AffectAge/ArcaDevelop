import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readFlatScenarioLocalizationFile } from "./scenarioLocalization";

export const scenarioContentFileNames = [
  ["races", ["races.json"]],
  ["resourceCategories", ["resource_categories.json", "resourceCategories.json"]],
  ["hexTypes", ["hex_types.json", "hexTypes.json"]],
  ["hexClimates", ["hex_climates.json", "hexClimates.json"]],
  ["hexLandscapes", ["hex_landscapes.json", "hexLandscapes.json"]],
  ["hexContinents", ["hex_continents.json", "hexContinents.json"]],
  ["hexStrategicRegions", ["hex_strategic_regions.json", "hexStrategicRegions.json"]],
  ["professions", ["professions.json"]],
  ["ideologies", ["ideologies.json"]],
  ["interestGroups", ["interest_groups.json", "interestGroups.json"]],
  ["parties", ["parties.json"]],
  ["lawGroups", ["law_groups.json", "lawGroups.json"]],
  ["laws", ["laws.json"]],
  ["religions", ["religions.json"]],
  ["technologies", ["technologies.json"]],
  ["buildings", ["buildings.json"]],
  ["goods", ["goods.json"]],
  ["companies", ["companies.json"]],
  ["industries", ["industries.json"]],
  ["sectors", ["sectors.json"]],
  ["cultures", ["cultures.json"]],
  ["modifiers", ["modifiers.json"]],
  ["decisions", ["decisions.json"]],
  ["events", ["events.json"]],
  ["journalEntries", ["journal_entries.json", "journalEntries.json"]],
  ["battalions", ["battalions.json"]],
  ["shipTypes", ["ship_types.json", "shipTypes.json"]],
  ["aircraftTypes", ["aircraft_types.json", "aircraftTypes.json"]],
  ["equipmentClasses", ["equipment_classes.json", "equipmentClasses.json"]],
  ["equipmentFrames", ["equipment_frames.json", "equipmentFrames.json"]],
  ["equipmentModules", ["equipment_modules.json", "equipmentModules.json"]],
] as const;

export type ScenarioContentKey = (typeof scenarioContentFileNames)[number][0];

const perEntityDirectoryAliases: Partial<Record<ScenarioContentKey, string[]>> = {
  journalEntries: ["journal_entries", "journalEntries"],
};

export function loadRawScenarioContent(scenarioDir: string): Record<string, unknown> | null {
  const perEntityContent = loadPerEntityScenarioContent(scenarioDir);
  const merged: Record<string, unknown> = {
    ...perEntityContent,
  };

  const contentDir = resolve(scenarioDir, "content");
  for (const [key, fileNames] of scenarioContentFileNames) {
    if (key in merged) continue;
    for (const fileName of fileNames) {
      const raw = readJsonFileIfExists(resolve(contentDir, fileName));
      if (raw == null) continue;
      merged[key] = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object" && key in raw
          ? (raw as Record<string, unknown>)[key]
          : raw;
      break;
    }
  }

  return Object.keys(merged).length === 0 ? null : merged;
}

function loadPerEntityScenarioContent(scenarioDir: string): Record<string, unknown> {
  const commonDir = resolve(scenarioDir, "common");
  if (!existsSync(commonDir)) return {};
  const ru = readFlatScenarioLocalizationFile(resolve(scenarioDir, "localisation/ru.json"));
  const en = readFlatScenarioLocalizationFile(resolve(scenarioDir, "localisation/en.json"));
  const merged: Record<string, unknown> = {};

  for (const [key] of scenarioContentFileNames) {
    const directories = perEntityDirectoryAliases[key] ?? [key];
    const entries = directories.flatMap((directory) => listJsonObjectsRecursively(resolve(commonDir, directory))).map((entry) => {
      const nameKey = typeof entry.nameKey === "string" ? entry.nameKey : null;
      if (!nameKey || typeof entry.name === "string") return entry;
      return {
        ...entry,
        name: ru[nameKey] ?? en[nameKey] ?? nameKey,
      };
    });
    if (entries.length > 0) {
      merged[key] = entries;
    }
  }

  return merged;
}

function listJsonObjectsRecursively(dir: string): Record<string, unknown>[] {
  if (!existsSync(dir)) return [];
  const result: Record<string, unknown>[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const childPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listJsonObjectsRecursively(childPath));
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
    const parsed = readJsonFileIfExists(childPath);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      result.push(parsed as Record<string, unknown>);
    }
  }
  return result;
}

function readJsonFileIfExists(path: string): unknown | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
