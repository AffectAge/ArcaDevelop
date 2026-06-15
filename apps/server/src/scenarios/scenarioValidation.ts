import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import {
  assertScenarioDefinesShape,
  normalizeScenarioAuditLogDefines,
  normalizeScenarioColonizationDefines,
  normalizeScenarioCustomizationDefines,
  normalizeScenarioEconomyDefines,
  normalizeScenarioEventLogDefines,
  normalizeScenarioMilitaryDefines,
  normalizeScenarioRegistrationDefines,
  normalizeScenarioTurnTimerDefines,
} from "./scenarioDefinesLoader";

export type ScenarioValidationIssueCode =
  | "MISSING_REQUIRED_FILE"
  | "MISSING_REQUIRED_DIRECTORY"
  | "INVALID_JSON"
  | "INVALID_ENTITY_ID"
  | "DUPLICATE_ID"
  | "FORBIDDEN_AGGREGATE_SOURCE"
  | "FORBIDDEN_REMOVED_FORMAT_DIRECTORY"
  | "FORBIDDEN_GENERATED_INDEX_LOCATION"
  | "FORBIDDEN_PROVINCE_HEAVY_FIELD"
  | "FORBIDDEN_COUNTRY_SECURITY_FIELD"
  | "INVALID_COUNTRY_COLOR"
  | "INVALID_ENTITY_COLOR"
  | "INVALID_DEFINES"
  | "BROKEN_REFERENCE"
  | "MISSING_LOCALIZATION_KEY"
  | "MISSING_REGION_MEMBERSHIP"
  | "DUPLICATE_REGION_MEMBERSHIP"
  | "INVALID_GENERATED_INDEX";

export type ScenarioValidationIssue = {
  code: ScenarioValidationIssueCode;
  message: string;
  path?: string;
};

export type ScenarioValidationResult = {
  ok: boolean;
  issues: ScenarioValidationIssue[];
  summary: {
    provinces: number;
    regions: number;
    countries: number;
    contentEntries: number;
    arcawikiEntries: number;
  };
};

type JsonObject = Record<string, unknown>;

type LoadedEntity = {
  id: string;
  path: string;
  data: JsonObject;
  kind: string;
};

type LoadedJsonFile = {
  path: string;
  data: unknown;
};

export type ScenarioGeneratedManifest = {
  schemaVersion: 1;
  scenarioId: string;
  authoredHash: string;
  generatedAt: string;
  files: string[];
  counts: ScenarioValidationResult["summary"];
};

const REQUIRED_DIRECTORIES = ["history/provinces", "history/regions", "history/countries"] as const;
const LOCALIZATION_FILES = ["localisation/en.json", "localisation/ru.json"] as const;
const GENERATED_DIR = ".generated";
const GENERATED_MANIFEST = "index-manifest.json";

export const SCENARIO_ENTITY_DIRECTORIES = [
  { kind: "province", path: "history/provinces" },
  { kind: "region", path: "history/regions" },
  { kind: "country", path: "history/countries" },
  { kind: "diplomacyRelation", path: "history/diplomacy/relations" },
  { kind: "diplomacyTreaty", path: "history/diplomacy/treaties" },
  { kind: "good", path: "common/goods" },
  { kind: "building", path: "common/buildings" },
  { kind: "technology", path: "common/technologies" },
  { kind: "law", path: "common/laws" },
  { kind: "lawGroup", path: "common/lawGroups" },
  { kind: "culture", path: "common/cultures" },
  { kind: "resourceCategory", path: "common/resourceCategories" },
  { kind: "provinceType", path: "common/provinceTypes" },
  { kind: "provinceClimate", path: "common/provinceClimates" },
  { kind: "provinceLandscape", path: "common/provinceLandscapes" },
  { kind: "provinceContinent", path: "common/provinceContinents" },
  { kind: "provinceStrategicRegion", path: "common/provinceStrategicRegions" },
  { kind: "religion", path: "common/religions" },
  { kind: "ideology", path: "common/ideologies" },
  { kind: "profession", path: "common/professions" },
  { kind: "race", path: "common/races" },
  { kind: "market", path: "common/markets" },
  { kind: "modifier", path: "common/modifiers" },
  { kind: "interestGroup", path: "common/interestGroups" },
  { kind: "party", path: "common/parties" },
  { kind: "company", path: "common/companies" },
  { kind: "industry", path: "common/industries" },
  { kind: "sector", path: "common/sectors" },
  { kind: "decision", path: "common/decisions" },
  { kind: "event", path: "common/events" },
  { kind: "battalion", path: "common/battalions" },
  { kind: "shipType", path: "common/shipTypes" },
  { kind: "aircraftType", path: "common/aircraftTypes" },
  { kind: "aiArchetype", path: "common/ai/archetypes" },
  { kind: "aiPersonality", path: "common/ai/personalities" },
  { kind: "aiStrategy", path: "common/ai/strategies" },
  { kind: "arcawikiEntry", path: "arcawiki/entries" },
] as const;

const ENTITY_DIRECTORIES: Array<{ kind: string; path: string }> = [...SCENARIO_ENTITY_DIRECTORIES];

const FORBIDDEN_AGGREGATE_FILES = ["map/provinces.json", "content-library.json"];
const FORBIDDEN_SETUP_SOURCE_FILES = [
  "setup/province_colonization.json",
  "setup/region_population.json",
  "setup/region_buildings.json",
  "setup/region_building_ducats.json",
  "setup/region_population_treasury.json",
  "setup/region_construction_queue.json",
  "setup/province_resources.json",
  "setup/province_resource_exploration_queue.json",
  "setup/province_resource_exploration_count.json",
];
const FORBIDDEN_REMOVED_FORMAT_DIRECTORIES = ["_legacy", "_obsolete"];
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const VALIDATION_AUDIT_LOG_DEFAULTS = { maxEntries: 1_000, retentionTurns: null };
const VALIDATION_HARD_MAX_AUDIT_LOG_ENTRIES = 10_000;
const VALIDATION_MAX_SETTING_NUMBER = 1_000_000_000_000;
const VALIDATION_ECONOMY_DEFAULTS = {
  baseCulturePerTurn: 1,
  baseSciencePerTurn: 1,
  baseReligionPerTurn: 1,
  baseConstructionPerTurn: 5,
  baseDucatsPerTurn: 5,
  baseGoldPerTurn: 10,
  demolitionCostConstructionPercent: 20,
  marketPriceSmoothing: 0.2,
  buildingDurabilityDecayPerTurn: 10,
  buildingDurabilityRecoveryPerTurn: 5,
  pollutionProductivityEffectPer1000: 0.1,
  explorationBaseEmptyChancePct: 5,
  explorationDepletionPerAttemptPct: 7.5,
  explorationDurationTurns: 1,
  explorationRollsPerExpedition: 3,
};
const VALIDATION_COLONIZATION_DEFAULTS = {
  maxActiveColonizations: 3,
  pointsPerTurn: 30,
  pointsCostPer1000Km2: 5,
  ducatsCostPer1000Km2: 5,
};
const VALIDATION_CUSTOMIZATION_DEFAULTS = {
  renameDucats: 20,
  recolorDucats: 10,
  flagDucats: 15,
  crestDucats: 15,
  provinceRenameDucats: 25,
};
const VALIDATION_MILITARY_DEFAULTS = {
  militaryFormationSpeed: 10,
};
const VALIDATION_REGISTRATION_DEFAULTS = {
  requireAdminApproval: false,
};
const VALIDATION_EVENT_LOG_DEFAULTS = {
  retentionTurns: 3,
};
const VALIDATION_TURN_TIMER_DEFAULTS = {
  enabled: true,
  secondsPerTurn: 86_400,
  pauseWhenNoPlayersOnline: false,
};

export const SCENARIO_PROVINCE_FORBIDDEN_HEAVY_FIELDS = [
  "pops",
  "population",
  "buildings",
  "construction",
  "constructionQueue",
  "production",
  "taxes",
  "markets",
  "market",
  "colonizationProgress",
  "diplomacyTransferState",
  "provincePopulationByProvince",
  "provinceBuildingsByProvince",
  "provincePopulationTreasuryByProvince",
  "provinceConstructionQueueByProvince",
  "provinceBuildingDucatsByProvince",
  "provinceColonizationByProvince",
  "colonyProgressByProvince",
  "resources",
  "resourceDeposits",
  "localResources",
  "localDeposits",
  "productionMethods",
  "regionModifiers",
] as const;

const PROVINCE_HEAVY_FIELDS = new Set<string>(SCENARIO_PROVINCE_FORBIDDEN_HEAVY_FIELDS);

export async function validateScenarioDirectory(
  scenarioDir: string,
  options: { requireGeneratedIndexes?: boolean } = {},
): Promise<ScenarioValidationResult> {
  const root = resolve(scenarioDir);
  const issues: ScenarioValidationIssue[] = [];

  await validateRequiredPaths(root, issues);
  await validateForbiddenAggregateFiles(root, issues);
  await validateForbiddenRemovedFormatDirectories(root, issues);
  await validateForbiddenGeneratedIndexLocations(root, issues);

  const localizationKeys = await loadLocalizationKeys(root, issues);
  const loadedEntities = await loadScenarioEntities(root, issues);
  const summary = summarizeEntities(loadedEntities);

  validateDuplicateIds(loadedEntities, issues);
  validateCountryAuthoringFields(root, loadedEntities, issues);
  validateMapEntityColors(root, loadedEntities, issues);
  await validateDefines(root, issues);
  validateProvinceHeavyFields(root, loadedEntities, issues);
  validateRegionMembership(root, loadedEntities, issues);
  validateEntityReferences(root, loadedEntities, issues);
  validateEntityLocalization(root, loadedEntities, localizationKeys, issues);
  await validateGeneratedManifest(root, summary, issues, options.requireGeneratedIndexes === true);

  return {
    ok: issues.length === 0,
    issues,
    summary,
  };
}

export async function buildScenarioGeneratedIndexes(scenarioDir: string): Promise<ScenarioGeneratedManifest> {
  const root = resolve(scenarioDir);
  const generatedDir = join(root, GENERATED_DIR);
  await rm(generatedDir, { recursive: true, force: true });

  const validation = await validateScenarioDirectory(root);

  if (!validation.ok) {
    throw new Error(formatScenarioValidationIssues(validation.issues));
  }

  const authoredFiles = await listAuthoredJsonFiles(root);
  const manifest: ScenarioGeneratedManifest = {
    schemaVersion: 1,
    scenarioId: basename(root),
    authoredHash: await hashFiles(root, authoredFiles),
    generatedAt: new Date().toISOString(),
    files: authoredFiles.map((path) => normalizePath(relative(root, path))).sort(),
    counts: validation.summary,
  };

  await mkdir(generatedDir, { recursive: true });
  await writeJson(join(generatedDir, GENERATED_MANIFEST), manifest);
  await writeJson(join(generatedDir, "entity-counts.json"), validation.summary);
  await writeJson(join(generatedDir, "provinces.json"), await buildGeneratedProvinceIndex(root));

  return manifest;
}

export function formatScenarioValidationIssues(issues: ScenarioValidationIssue[]): string {
  return issues.map((issue) => `${issue.code}: ${issue.path ? `${issue.path}: ` : ""}${issue.message}`).join("\n");
}

async function validateRequiredPaths(root: string, issues: ScenarioValidationIssue[]): Promise<void> {
  if (!existsSync(join(root, "scenario.json"))) {
    issues.push({
      code: "MISSING_REQUIRED_FILE",
      path: "scenario.json",
      message: "Scenario manifest is required.",
    });
  }

  for (const dir of REQUIRED_DIRECTORIES) {
    if (!existsSync(join(root, dir))) {
      issues.push({
        code: "MISSING_REQUIRED_DIRECTORY",
        path: dir,
        message: "Per-entity scenario directory is required.",
      });
    }
  }

  for (const file of LOCALIZATION_FILES) {
    if (!existsSync(join(root, file))) {
      issues.push({
        code: "MISSING_REQUIRED_FILE",
        path: file,
        message: "English and Russian localization files are required.",
      });
    }
  }
}

async function buildGeneratedProvinceIndex(root: string): Promise<JsonObject[]> {
  const issues: ScenarioValidationIssue[] = [];
  const entities = await loadScenarioEntities(root, issues);
  const localizationKeys = await loadLocalizationValues(root, issues);
  if (issues.length > 0) {
    throw new Error(formatScenarioValidationIssues(issues));
  }
  const regionIdByProvinceId = buildRegionIdByProvinceId(entities);
  const regionColorByProvinceId = buildRegionColorByProvinceId(entities);

  return entities
    .filter((entity) => entity.kind === "province")
    .map((entity) => {
      const center = isObject(entity.data.center) ? entity.data.center : {};
      const provinceId = stripStablePrefix(entity.id, "province");
      const nameKey = typeof entity.data.nameKey === "string" ? entity.data.nameKey : null;
      return removeUndefined({
        id: provinceId,
        stableId: entity.id,
        regionId: regionIdByProvinceId.get(entity.id) ?? regionIdByProvinceId.get(provinceId),
        provinceColor: entity.data.color,
        regionColor: regionColorByProvinceId.get(entity.id) ?? regionColorByProvinceId.get(provinceId),
        name: nameKey ? localizationKeys.get(nameKey) ?? provinceId : provinceId,
        nameKey,
        areaKm2: entity.data.areaKm2,
        province_type: entity.data.terrain,
        center_x: center.x,
        center_y: center.y,
        sourceCenterX: center.x,
        sourceCenterY: center.y,
        neighbors: Array.isArray(entity.data.adjacentProvinceIds)
          ? entity.data.adjacentProvinceIds.map((id) => stripStablePrefix(String(id), "province"))
          : [],
        climate: entity.data.climate,
        pollution: entity.data.pollution,
        radiation: entity.data.radiation,
        landscape: entity.data.landscape,
        continent: entity.data.continent,
        strategicRegion: entity.data.strategicArea,
        fertileLandKm2: entity.data.fertileLandKm2,
        fertility: entity.data.fertility,
      });
    })
    .sort((left, right) => String(left.id).localeCompare(String(right.id), "ru"));
}

function buildRegionIdByProvinceId(entities: LoadedEntity[]): Map<string, string> {
  const regionIdByProvinceId = new Map<string, string>();
  for (const region of entities.filter((entity) => entity.kind === "region")) {
    const provinceIds = Array.isArray(region.data.provinceIds)
      ? region.data.provinceIds.filter((provinceId): provinceId is string => typeof provinceId === "string")
      : [];
    for (const provinceId of provinceIds) {
      regionIdByProvinceId.set(provinceId, region.id);
      regionIdByProvinceId.set(stripStablePrefix(provinceId, "province"), region.id);
    }
  }
  return regionIdByProvinceId;
}

function buildRegionColorByProvinceId(entities: LoadedEntity[]): Map<string, string> {
  const regionColorByProvinceId = new Map<string, string>();
  for (const region of entities.filter((entity) => entity.kind === "region")) {
    const color = typeof region.data.color === "string" ? region.data.color : null;
    const provinceIds = Array.isArray(region.data.provinceIds)
      ? region.data.provinceIds.filter((provinceId): provinceId is string => typeof provinceId === "string")
      : [];
    if (!color) continue;
    for (const provinceId of provinceIds) {
      regionColorByProvinceId.set(provinceId, color);
      regionColorByProvinceId.set(stripStablePrefix(provinceId, "province"), color);
    }
  }
  return regionColorByProvinceId;
}

async function loadLocalizationValues(root: string, issues: ScenarioValidationIssue[]): Promise<Map<string, string>> {
  const values = new Map<string, string>();
  for (const file of LOCALIZATION_FILES) {
    const loaded = await readJsonIfExists(join(root, file), root, issues);
    if (!loaded || !isObject(loaded.data)) continue;
    collectLocalizationValues("", loaded.data, values);
  }
  return values;
}

function collectLocalizationValues(prefix: string, value: unknown, values: Map<string, string>): void {
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") {
      values.set(nextKey, child);
      continue;
    }
    collectLocalizationValues(nextKey, child, values);
  }
}

async function validateForbiddenAggregateFiles(root: string, issues: ScenarioValidationIssue[]): Promise<void> {
  for (const file of [...FORBIDDEN_AGGREGATE_FILES, ...FORBIDDEN_SETUP_SOURCE_FILES]) {
    if (existsSync(join(root, file))) {
      issues.push({
        code: "FORBIDDEN_AGGREGATE_SOURCE",
        path: file,
        message: "Aggregate authored scenario files are forbidden in the per-entity format.",
      });
    }
  }
}

async function validateForbiddenRemovedFormatDirectories(root: string, issues: ScenarioValidationIssue[]): Promise<void> {
  const directories = await listDirectories(root);
  for (const directory of directories) {
    const name = basename(directory);
    if (!FORBIDDEN_REMOVED_FORMAT_DIRECTORIES.includes(name)) continue;
    issues.push({
      code: "FORBIDDEN_REMOVED_FORMAT_DIRECTORY",
      path: normalizePath(relative(root, directory)),
      message: `Removed scenario format directory "${name}" is forbidden.`,
    });
  }
}

async function validateForbiddenGeneratedIndexLocations(root: string, issues: ScenarioValidationIssue[]): Promise<void> {
  const directories = await listDirectories(root);
  for (const directory of directories) {
    const name = basename(directory);
    const relativePath = normalizePath(relative(root, directory));
    if (name !== GENERATED_DIR || relativePath === GENERATED_DIR) continue;
    issues.push({
      code: "FORBIDDEN_GENERATED_INDEX_LOCATION",
      path: relativePath,
      message: "Generated scenario indexes are only allowed in the scenario root .generated directory.",
    });
  }
}

async function loadLocalizationKeys(root: string, issues: ScenarioValidationIssue[]): Promise<Set<string>> {
  const keys = new Set<string>();

  for (const file of LOCALIZATION_FILES) {
    const loaded = await readJsonIfExists(join(root, file), root, issues);
    if (!loaded || !isObject(loaded.data)) continue;
    collectLocalizationKeys("", loaded.data, keys);
  }

  return keys;
}

async function loadScenarioEntities(root: string, issues: ScenarioValidationIssue[]): Promise<LoadedEntity[]> {
  const entities: LoadedEntity[] = [];

  for (const directory of ENTITY_DIRECTORIES) {
    const absoluteDir = join(root, directory.path);
    if (!existsSync(absoluteDir)) continue;

    const files = await listJsonFiles(absoluteDir);
    for (const file of files) {
      const loaded = await readJsonIfExists(file, root, issues);
      if (!loaded) continue;
      if (!isObject(loaded.data)) {
        issues.push({
          code: "INVALID_JSON",
          path: normalizePath(relative(root, file)),
          message: "Entity file must contain a JSON object.",
        });
        continue;
      }

      const id = loaded.data.id;
      if (typeof id !== "string" || id.trim() === "") {
        issues.push({
          code: "INVALID_ENTITY_ID",
          path: normalizePath(relative(root, file)),
          message: "Entity JSON must contain a non-empty string id.",
        });
        continue;
      }

      entities.push({
        id,
        path: file,
        data: loaded.data,
        kind: directory.kind,
      });
    }
  }

  return entities;
}

function summarizeEntities(entities: LoadedEntity[]): ScenarioValidationResult["summary"] {
  return {
    provinces: entities.filter((entity) => entity.kind === "province").length,
    regions: entities.filter((entity) => entity.kind === "region").length,
    countries: entities.filter((entity) => entity.kind === "country").length,
    contentEntries: entities.filter((entity) => entity.kind !== "province" && entity.kind !== "region" && entity.kind !== "country" && entity.kind !== "arcawikiEntry").length,
    arcawikiEntries: entities.filter((entity) => entity.kind === "arcawikiEntry").length,
  };
}

function validateDuplicateIds(entities: LoadedEntity[], issues: ScenarioValidationIssue[]): void {
  const seen = new Map<string, LoadedEntity>();
  for (const entity of entities) {
    const previous = seen.get(entity.id);
    if (previous) {
      issues.push({
        code: "DUPLICATE_ID",
        path: normalizePath(entity.path),
        message: `Duplicate id ${entity.id}; first seen at ${normalizePath(previous.path)}.`,
      });
      continue;
    }
    seen.set(entity.id, entity);
  }
}

function validateCountryAuthoringFields(root: string, entities: LoadedEntity[], issues: ScenarioValidationIssue[]): void {
  for (const country of entities.filter((entity) => entity.kind === "country")) {
    for (const key of ["isAdmin", "password", "passwordHash"]) {
      if (!(key in country.data)) continue;
      issues.push({
        code: "FORBIDDEN_COUNTRY_SECURITY_FIELD",
        path: normalizePath(relative(root, country.path)),
        message: `Country file must not contain security/admin field "${key}".`,
      });
    }

    if (typeof country.data.color !== "string" || !HEX_COLOR_PATTERN.test(country.data.color.trim())) {
      issues.push({
        code: "INVALID_COUNTRY_COLOR",
        path: normalizePath(relative(root, country.path)),
        message: "Country file must define color as #RRGGBB.",
      });
    }
  }
}

function validateMapEntityColors(root: string, entities: LoadedEntity[], issues: ScenarioValidationIssue[]): void {
  for (const entity of entities.filter((item) => item.kind === "province" || item.kind === "region")) {
    if (typeof entity.data.color === "string" && HEX_COLOR_PATTERN.test(entity.data.color.trim())) continue;
    issues.push({
      code: "INVALID_ENTITY_COLOR",
      path: normalizePath(relative(root, entity.path)),
      message: `${entity.kind === "province" ? "Province" : "Region"} file must define color as #RRGGBB.`,
    });
  }
}

async function validateDefines(root: string, issues: ScenarioValidationIssue[]): Promise<void> {
  const loaded = await readJsonIfExists(join(root, "common/defines.json"), root, issues);
  if (!loaded) return;
  if (!isObject(loaded.data)) {
    issues.push({
      code: "INVALID_DEFINES",
      path: "common/defines.json",
      message: "Scenario defines must be a JSON object.",
    });
    return;
  }

  try {
    const defines = assertScenarioDefinesShape(loaded.data);
    const options = {
      hardMaxAuditLogEntries: VALIDATION_HARD_MAX_AUDIT_LOG_ENTRIES,
      maxSettingNumber: VALIDATION_MAX_SETTING_NUMBER,
    };
    normalizeScenarioEconomyDefines(
      defines.economy,
      VALIDATION_ECONOMY_DEFAULTS,
      options,
    );
    normalizeScenarioAuditLogDefines(defines.auditLog, VALIDATION_AUDIT_LOG_DEFAULTS, options);
    normalizeScenarioColonizationDefines(
      defines.colonization,
      VALIDATION_COLONIZATION_DEFAULTS,
      options,
    );
    normalizeScenarioCustomizationDefines(
      defines.customization,
      VALIDATION_CUSTOMIZATION_DEFAULTS,
      options,
    );
    normalizeScenarioMilitaryDefines(
      defines.military,
      VALIDATION_MILITARY_DEFAULTS,
      options,
    );
    normalizeScenarioRegistrationDefines(
      defines.registration,
      VALIDATION_REGISTRATION_DEFAULTS,
    );
    normalizeScenarioEventLogDefines(
      defines.eventLog,
      VALIDATION_EVENT_LOG_DEFAULTS,
    );
    normalizeScenarioTurnTimerDefines(
      defines.turnTimer,
      VALIDATION_TURN_TIMER_DEFAULTS,
    );
  } catch (error) {
    issues.push({
      code: "INVALID_DEFINES",
      path: "common/defines.json",
      message: error instanceof Error ? error.message : "Invalid scenario defines.",
    });
  }
}

function validateProvinceHeavyFields(root: string, entities: LoadedEntity[], issues: ScenarioValidationIssue[]): void {
  for (const province of entities.filter((entity) => entity.kind === "province")) {
    for (const key of Object.keys(province.data)) {
      if (!PROVINCE_HEAVY_FIELDS.has(key)) continue;
      issues.push({
        code: "FORBIDDEN_PROVINCE_HEAVY_FIELD",
        path: normalizePath(relative(root, province.path)),
        message: `Province file must not contain region-heavy field "${key}".`,
      });
    }
  }
}

function validateRegionMembership(root: string, entities: LoadedEntity[], issues: ScenarioValidationIssue[]): void {
  const provinces = new Set(entities.filter((entity) => entity.kind === "province").map((entity) => entity.id));
  const assigned = new Map<string, LoadedEntity>();

  for (const region of entities.filter((entity) => entity.kind === "region")) {
    const provinceIds = region.data.provinceIds;
    if (!Array.isArray(provinceIds) || provinceIds.length === 0) {
      issues.push({
        code: "MISSING_REGION_MEMBERSHIP",
        path: normalizePath(relative(root, region.path)),
        message: "Region must define at least one provinceId.",
      });
      continue;
    }

    for (const provinceId of provinceIds) {
      if (typeof provinceId !== "string" || !provinces.has(provinceId)) {
        issues.push({
          code: "BROKEN_REFERENCE",
          path: normalizePath(relative(root, region.path)),
          message: `Region references missing province ${String(provinceId)}.`,
        });
        continue;
      }

      const previousRegion = assigned.get(provinceId);
      if (previousRegion) {
        issues.push({
          code: "DUPLICATE_REGION_MEMBERSHIP",
          path: normalizePath(relative(root, region.path)),
          message: `Province ${provinceId} is already assigned to ${previousRegion.id}.`,
        });
        continue;
      }
      assigned.set(provinceId, region);
    }
  }

  for (const provinceId of provinces) {
    if (assigned.has(provinceId)) continue;
    issues.push({
      code: "MISSING_REGION_MEMBERSHIP",
      message: `Province ${provinceId} is not assigned to any region.`,
    });
  }
}

function validateEntityReferences(root: string, entities: LoadedEntity[], issues: ScenarioValidationIssue[]): void {
  const ids = new Set(entities.map((entity) => entity.id));
  const countries = new Set(entities.filter((entity) => entity.kind === "country").map((entity) => entity.id));
  const goods = new Set(entities.filter((entity) => entity.kind === "good").map((entity) => entity.id));

  for (const region of entities.filter((entity) => entity.kind === "region")) {
    validateOptionalReference(root, region, "ownerCountryId", countries, issues);
    validateOptionalReference(root, region, "controllerCountryId", countries, issues);
    validateReferenceArray(root, region, "coreCountryIds", countries, issues);
    validateClaims(root, region, countries, issues);
    validateRegionResources(root, region, goods, issues);
  }

  for (const entity of entities) {
    validateKnownStableReferences(root, entity, ids, issues);
  }
}

function validateOptionalReference(
  root: string,
  entity: LoadedEntity,
  field: string,
  validIds: Set<string>,
  issues: ScenarioValidationIssue[],
): void {
  const value = entity.data[field];
  if (value == null) return;
  if (typeof value !== "string" || !validIds.has(value)) {
    issues.push({
      code: "BROKEN_REFERENCE",
      path: normalizePath(relative(root, entity.path)),
      message: `${entity.id}.${field} references missing id ${String(value)}.`,
    });
  }
}

function validateReferenceArray(
  root: string,
  entity: LoadedEntity,
  field: string,
  validIds: Set<string>,
  issues: ScenarioValidationIssue[],
): void {
  const values = entity.data[field];
  if (values == null) return;
  if (!Array.isArray(values)) {
    issues.push({
      code: "BROKEN_REFERENCE",
      path: normalizePath(relative(root, entity.path)),
      message: `${entity.id}.${field} must be an array.`,
    });
    return;
  }

  for (const value of values) {
    if (typeof value === "string" && validIds.has(value)) continue;
    issues.push({
      code: "BROKEN_REFERENCE",
      path: normalizePath(relative(root, entity.path)),
      message: `${entity.id}.${field} references missing id ${String(value)}.`,
    });
  }
}

function validateClaims(root: string, region: LoadedEntity, countries: Set<string>, issues: ScenarioValidationIssue[]): void {
  const claims = region.data.claims;
  if (claims == null) return;
  if (!Array.isArray(claims)) {
    issues.push({
      code: "BROKEN_REFERENCE",
      path: normalizePath(relative(root, region.path)),
      message: `${region.id}.claims must be an array.`,
    });
    return;
  }

  for (const claim of claims) {
    if (!isObject(claim)) continue;
    const countryId = claim.countryId ?? claim.claimantCountryId;
    if (typeof countryId === "string" && countries.has(countryId)) continue;
    issues.push({
      code: "BROKEN_REFERENCE",
      path: normalizePath(relative(root, region.path)),
      message: `${region.id}.claims references missing country ${String(countryId)}.`,
    });
  }
}

function validateRegionResources(root: string, region: LoadedEntity, goods: Set<string>, issues: ScenarioValidationIssue[]): void {
  const resources = region.data.resources;
  if (resources == null) return;
  if (!Array.isArray(resources)) {
    issues.push({
      code: "BROKEN_REFERENCE",
      path: normalizePath(relative(root, region.path)),
      message: `${region.id}.resources must be an array.`,
    });
    return;
  }

  for (const resource of resources) {
    if (!isObject(resource)) continue;
    const goodId = resource.goodId;
    if (typeof goodId === "string" && goods.has(goodId)) continue;
    issues.push({
      code: "BROKEN_REFERENCE",
      path: normalizePath(relative(root, region.path)),
      message: `${region.id}.resources references missing good ${String(goodId)}.`,
    });
  }
}

function validateKnownStableReferences(root: string, entity: LoadedEntity, ids: Set<string>, issues: ScenarioValidationIssue[]): void {
  for (const [field, value] of Object.entries(entity.data)) {
    if (!field.endsWith("Id") || field === "id" || value == null) continue;
    if (typeof value !== "string" || !value.includes(":")) continue;
    if (ids.has(value)) continue;
    issues.push({
      code: "BROKEN_REFERENCE",
      path: normalizePath(relative(root, entity.path)),
      message: `${entity.id}.${field} references missing id ${value}.`,
    });
  }
}

function validateEntityLocalization(
  root: string,
  entities: LoadedEntity[],
  localizationKeys: Set<string>,
  issues: ScenarioValidationIssue[],
): void {
  for (const entity of entities) {
    const nameKey = entity.data.nameKey;
    if (nameKey == null) continue;
    if (typeof nameKey === "string" && localizationKeys.has(nameKey)) continue;
    issues.push({
      code: "MISSING_LOCALIZATION_KEY",
      path: normalizePath(relative(root, entity.path)),
      message: `${entity.id}.nameKey is missing from en/ru localization files.`,
    });
  }
}

async function validateGeneratedManifest(
  root: string,
  counts: ScenarioValidationResult["summary"],
  issues: ScenarioValidationIssue[],
  requireGeneratedIndexes: boolean,
): Promise<void> {
  const manifestPath = join(root, GENERATED_DIR, GENERATED_MANIFEST);
  if (!existsSync(manifestPath)) {
    if (requireGeneratedIndexes) {
      issues.push({
        code: "INVALID_GENERATED_INDEX",
        path: normalizePath(relative(root, manifestPath)),
        message: "Generated index manifest is required.",
      });
    }
    return;
  }

  const manifestFile = await readJsonIfExists(manifestPath, root, issues);
  if (!manifestFile || !isObject(manifestFile.data)) {
    issues.push({
      code: "INVALID_GENERATED_INDEX",
      path: normalizePath(relative(root, manifestPath)),
      message: "Generated index manifest must be a JSON object.",
    });
    return;
  }

  const manifest = manifestFile.data;
  if (manifest.schemaVersion !== 1 || typeof manifest.authoredHash !== "string") {
    issues.push({
      code: "INVALID_GENERATED_INDEX",
      path: normalizePath(relative(root, manifestPath)),
      message: "Generated index manifest has an invalid shape.",
    });
    return;
  }

  const authoredFiles = await listAuthoredJsonFiles(root);
  const currentHash = await hashFiles(root, authoredFiles);
  if (manifest.authoredHash !== currentHash) {
    issues.push({
      code: "INVALID_GENERATED_INDEX",
      path: normalizePath(relative(root, manifestPath)),
      message: "Generated indexes are stale.",
    });
  }

  const manifestCounts = manifest.counts;
  if (!isObject(manifestCounts) || manifestCounts.provinces !== counts.provinces || manifestCounts.regions !== counts.regions) {
    issues.push({
      code: "INVALID_GENERATED_INDEX",
      path: normalizePath(relative(root, manifestPath)),
      message: "Generated index counts do not match authored data.",
    });
  }
}

async function readJsonIfExists(path: string, root: string, issues: ScenarioValidationIssue[]): Promise<LoadedJsonFile | null> {
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, "utf8");
    return { path, data: JSON.parse(raw) as unknown };
  } catch (error) {
    issues.push({
      code: "INVALID_JSON",
      path: normalizePath(relative(root, path)),
      message: error instanceof Error ? error.message : "Invalid JSON.",
    });
    return null;
  }
}

async function listJsonFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  if (!existsSync(root)) return result;
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listJsonFiles(path)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      result.push(path);
    }
  }

  return result.sort();
}

async function listDirectories(root: string): Promise<string[]> {
  const result: string[] = [];
  if (!existsSync(root)) return result;
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = join(root, entry.name);
    result.push(path);
    if (entry.name === GENERATED_DIR) continue;
    result.push(...(await listDirectories(path)));
  }

  return result.sort();
}

async function listAuthoredJsonFiles(root: string): Promise<string[]> {
  const files = await listJsonFiles(root);
  return files.filter((path) => !normalizePath(relative(root, path)).startsWith(`${GENERATED_DIR}/`));
}

async function hashFiles(root: string, files: string[]): Promise<string> {
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    const relativePath = normalizePath(relative(root, file));
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function collectLocalizationKeys(prefix: string, value: unknown, keys: Set<string>): void {
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") {
      keys.add(nextKey);
      continue;
    }
    collectLocalizationKeys(nextKey, child, keys);
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function removeUndefined(value: JsonObject): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function stripStablePrefix(id: string, prefix: string): string {
  const stablePrefix = `${prefix}:`;
  return id.startsWith(stablePrefix) ? id.slice(stablePrefix.length) : id;
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}
