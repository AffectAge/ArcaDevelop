import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { imageSize } from "image-size";
import {
  assertScenarioDefinesShape,
  normalizeScenarioAiDefines,
  normalizeScenarioAuditLogDefines,
  normalizeScenarioColonizationDefines,
  normalizeScenarioCustomizationDefines,
  normalizeScenarioEconomyDefines,
  normalizeScenarioEventLogDefines,
  normalizeScenarioMilitaryDefines,
  normalizeScenarioRegistrationDefines,
  normalizeScenarioResourceLedgerDefines,
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
  | "INVALID_HEX_MAP_SETTINGS"
  | "INVALID_DECISION_DEFINITION"
  | "INVALID_EVENT_DEFINITION"
  | "INVALID_JOURNAL_DEFINITION"
  | "INVALID_BUILDING_ATLAS"
  | "INVALID_CITY_ATLAS"
  | "INVALID_ASSET_REGISTRY"
  | "FORBIDDEN_AUTHORED_ASSET_URL"
  | "FORBIDDEN_LEGACY_CONTENT_FIELD"
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
    hexes: number;
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

const REQUIRED_DIRECTORIES = ["map", "history/regions", "history/countries"] as const;
const LOCALIZATION_FILES = ["localisation/en.json", "localisation/ru.json"] as const;
const GENERATED_DIR = ".generated";
const GENERATED_MANIFEST = "index-manifest.json";

export const SCENARIO_ENTITY_DIRECTORIES = [
  { kind: "region", path: "history/regions" },
  { kind: "country", path: "history/countries" },
  { kind: "diplomacyRelation", path: "history/diplomacy/relations" },
  { kind: "diplomacyTreaty", path: "history/diplomacy/treaties" },
  { kind: "asset", path: "common/assets" },
  { kind: "good", path: "common/goods" },
  { kind: "building", path: "common/buildings" },
  { kind: "technology", path: "common/technologies" },
  { kind: "law", path: "common/laws" },
  { kind: "lawGroup", path: "common/lawGroups" },
  { kind: "culture", path: "common/cultures" },
  { kind: "resourceCategory", path: "common/resourceCategories" },
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
  { kind: "journalEntry", path: "common/journal_entries" },
  { kind: "battalion", path: "common/battalions" },
  { kind: "shipType", path: "common/shipTypes" },
  { kind: "aircraftType", path: "common/aircraftTypes" },
  { kind: "aiArchetype", path: "common/ai/archetypes" },
  { kind: "aiPersonality", path: "common/ai/personalities" },
  { kind: "aiStrategy", path: "common/ai/strategies" },
  { kind: "arcawikiEntry", path: "arcawiki/entries" },
] as const;

const ENTITY_DIRECTORIES: Array<{ kind: string; path: string }> = [...SCENARIO_ENTITY_DIRECTORIES];

const FORBIDDEN_AGGREGATE_FILES = ["map/provinces.json", "content-library.json", ".generated/provinces.json"];
const FORBIDDEN_LEGACY_PROVINCE_PATHS = [
  "history/provinces",
  "common/provinceTypes",
  "common/provinceClimates",
  "common/provinceLandscapes",
  "common/provinceContinents",
  "common/provinceStrategicRegions",
] as const;
const FORBIDDEN_SETUP_SOURCE_FILES = [
  "setup/province_colonization.json",
  "setup/province_owners.json",
  "setup/province_names.json",
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
const FORBIDDEN_AUTHORED_ASSET_URL_FIELDS = new Set(["logoUrl", "flagUrl", "crestUrl", "imageUrl", "malePortraitUrl", "femalePortraitUrl"]);
const FORBIDDEN_LEGACY_CONTENT_FIELDS = new Set(["extractionGoodId", "extractionAmountPerTurn", "extractionRequiresDeposit"]);
const ALLOWED_AUTHORED_ASSET_ID_FIELDS = new Set([
  "assetId",
  "iconAssetId",
  "flagAssetId",
  "crestAssetId",
  "atlasAssetId",
  "imageAssetId",
  "malePortraitAssetId",
  "femalePortraitAssetId",
]);
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
  settlementEnabled: true,
  settlementPopulationOnCapture: 1_000,
  colonizerTurns: 2,
  colonizerCostColonization: 20,
  colonizerCostDucats: 10,
  colonizerMovementPoints: 2,
};
const VALIDATION_CUSTOMIZATION_DEFAULTS = {
  renameDucats: 20,
  recolorDucats: 10,
  flagDucats: 15,
  crestDucats: 15,
  hexRenameDucats: 25,
};
const VALIDATION_MILITARY_DEFAULTS = {
  militaryFormationSpeed: 10,
  landDivisionStackLimitPerHex: 4,
};
const VALIDATION_REGISTRATION_DEFAULTS = {
  requireAdminApproval: false,
};
const VALIDATION_EVENT_LOG_DEFAULTS = {
  retentionTurns: 3,
};
const VALIDATION_RESOURCE_LEDGER_DEFAULTS = {
  retentionTurns: 20,
  maxEntriesPerTurn: 10_000,
};
const VALIDATION_TURN_TIMER_DEFAULTS = {
  enabled: true,
  secondsPerTurn: 86_400,
  pauseWhenNoPlayersOnline: false,
};
const VALIDATION_AI_DEFAULTS = {
  enabled: true,
  maxCountriesPerTick: 50,
  maxDecisionCandidatesPerCountry: 20,
  contextCacheTtlTurns: 1,
  maxBuildCompletionTurns: 8,
};
const EVENT_TRIGGER_TYPES = new Set([
  "always",
  "law_active",
  "technology_researched",
  "country_is",
  "has_building",
  "country_resource_above",
  "country_resource_below",
  "treasury_below",
  "resource_flow_negative",
  "country_has_law",
  "country_lacks_law",
  "country_has_technology",
  "country_lacks_technology",
  "country_has_modifier",
  "country_controls_region_count_above",
  "country_controls_region_count_below",
  "controls_foreign_region",
  "region_owner_is",
  "region_controller_is",
  "region_is_colonizable",
  "region_population_above",
  "region_population_below",
  "region_has_population_above",
  "region_has_population_below",
  "region_has_building",
  "region_has_resource_deposit",
  "region_radicals_above",
  "region_loyalists_above",
  "region_standard_of_living_below",
  "region_colonization_progress_above",
  "region_colonization_progress_below",
  "building_profit_below",
  "building_employment_below",
  "building_output_above",
]);
const EVENT_RESOURCE_IDS = new Set(["culture", "science", "religion", "colonization", "construction", "ducats", "gold"]);
const EVENT_CATEGORY_IDS = new Set(["system", "colonization", "politics", "economy", "military", "diplomacy"]);
const EVENT_PRIORITY_IDS = new Set(["low", "medium", "high"]);
const EVENT_VISIBILITY_IDS = new Set(["public", "private"]);

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
  "provincePopulationByHex",
  "provinceBuildingsByHex",
  "provincePopulationTreasuryByHex",
  "provinceConstructionQueueByHex",
  "provinceBuildingDucatsByHex",
  "provinceColonizationByHex",
  "colonyProgressByHex",
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
  await validateForbiddenLegacyHexPaths(root, issues);
  await validateForbiddenRemovedFormatDirectories(root, issues);
  await validateForbiddenGeneratedIndexLocations(root, issues);

  const localizationKeys = await loadLocalizationKeys(root, issues);
  const loadedEntities = await loadScenarioEntities(root, issues);
  const summary = summarizeEntities(loadedEntities);

  validateDuplicateIds(loadedEntities, issues);
  validateCountryAuthoringFields(root, loadedEntities, issues);
  await validateAssetRegistry(root, loadedEntities, issues);
  validateAuthoredAssetFields(root, loadedEntities, issues);
  validateForbiddenLegacyContentFields(root, loadedEntities, issues);
  validateMapEntityColors(root, loadedEntities, issues);
  await validateDefines(root, issues);
  await validateHexMapSettings(root, issues);
  validateHexHeavyFields(root, loadedEntities, issues);
  validateRegionMembership(root, loadedEntities, issues);
  validateEntityReferences(root, loadedEntities, issues);
  validateDecisionDefinitions(root, loadedEntities, issues);
  validateEventDefinitions(root, loadedEntities, localizationKeys, issues);
  validateJournalDefinitions(root, loadedEntities, localizationKeys, issues);
  validateEntityLocalization(root, loadedEntities, localizationKeys, issues);
  await validateBuildingAtlases(root, loadedEntities, issues);
  await validateCityAtlases(root, loadedEntities, issues);
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
  await writeJson(join(generatedDir, "hex-map-settings.json"), await loadHexMapSettings(root));

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

async function validateForbiddenLegacyHexPaths(root: string, issues: ScenarioValidationIssue[]): Promise<void> {
  for (const legacyPath of FORBIDDEN_LEGACY_PROVINCE_PATHS) {
    if (!existsSync(join(root, legacyPath))) continue;
    issues.push({
      code: "FORBIDDEN_REMOVED_FORMAT_DIRECTORY",
      path: legacyPath,
      message: "Legacy province authored paths are forbidden after the hex map hard cutover.",
    });
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
    hexes: entities.filter((entity) => entity.kind === "province").length,
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

async function validateBuildingAtlases(root: string, entities: LoadedEntity[], issues: ScenarioValidationIssue[]): Promise<void> {
  for (const building of entities.filter((entity) => entity.kind === "building")) {
    const relativePath = `assets/buildings/${sanitizeBuildingAtlasId(building.id)}.png`;
    const atlasPath = join(root, relativePath);
    if (!existsSync(atlasPath)) {
      continue;
    }
    try {
      const dimensions = imageSize(await readFile(atlasPath));
      const width = dimensions.width ?? 0;
      const height = dimensions.height ?? 0;
      if (dimensions.type !== "png" || width !== 256 || height !== 64) {
        issues.push({
          code: "INVALID_BUILDING_ATLAS",
          path: relativePath,
          message: `Building atlas must be a PNG sized 256x64; received ${dimensions.type ?? "unknown"} ${width}x${height}.`,
        });
      }
    } catch {
      issues.push({
        code: "INVALID_BUILDING_ATLAS",
        path: relativePath,
        message: "Building atlas must be a readable PNG sized 256x64.",
      });
    }
  }
}

function sanitizeBuildingAtlasId(buildingId: string): string {
  return buildingId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function validateCityAtlases(root: string, entities: LoadedEntity[], issues: ScenarioValidationIssue[]): Promise<void> {
  for (const culture of entities.filter((entity) => entity.kind === "culture")) {
    const relativePath = `assets/cities/${sanitizeCityAtlasId(culture.id)}.png`;
    const atlasPath = join(root, relativePath);
    if (!existsSync(atlasPath)) {
      continue;
    }
    try {
      const dimensions = imageSize(await readFile(atlasPath));
      const width = dimensions.width ?? 0;
      const height = dimensions.height ?? 0;
      if (dimensions.type !== "png" || width !== 256 || height !== 64) {
        issues.push({
          code: "INVALID_CITY_ATLAS",
          path: relativePath,
          message: `City atlas must be a PNG sized 256x64; received ${dimensions.type ?? "unknown"} ${width}x${height}.`,
        });
      }
    } catch {
      issues.push({
        code: "INVALID_CITY_ATLAS",
        path: relativePath,
        message: "City atlas must be a readable PNG sized 256x64.",
      });
    }
  }
}

function sanitizeCityAtlasId(cultureId: string): string {
  return cultureId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function validateAssetRegistry(root: string, entities: LoadedEntity[], issues: ScenarioValidationIssue[]): Promise<void> {
  for (const asset of entities.filter((entity) => entity.kind === "asset")) {
    const path = normalizePath(relative(root, asset.path));
    if (!asset.id.startsWith("asset:")) {
      issues.push({
        code: "INVALID_ASSET_REGISTRY",
        path,
        message: `Asset id ${asset.id} must start with asset:.`,
      });
    }

    const type = asset.data.type;
    if (type !== "icon" && type !== "atlas" && type !== "image") {
      issues.push({
        code: "INVALID_ASSET_REGISTRY",
        path,
        message: `${asset.id}.type must be icon, atlas, or image.`,
      });
    }

    const relativeAssetPath = typeof asset.data.path === "string" ? asset.data.path.replaceAll("\\", "/").trim() : "";
    if (!isScenarioAssetPath(relativeAssetPath)) {
      issues.push({
        code: "INVALID_ASSET_REGISTRY",
        path,
        message: `${asset.id}.path must point to a local file under assets/.`,
      });
      continue;
    }

    const width = asset.data.width;
    const height = asset.data.height;
    if (typeof width !== "number" || !Number.isInteger(width) || width <= 0 || typeof height !== "number" || !Number.isInteger(height) || height <= 0) {
      issues.push({
        code: "INVALID_ASSET_REGISTRY",
        path,
        message: `${asset.id} must define positive integer width and height.`,
      });
    }

    const absoluteAssetPath = join(root, relativeAssetPath);
    if (!existsSync(absoluteAssetPath)) {
      issues.push({
        code: "MISSING_REQUIRED_FILE",
        path: relativeAssetPath,
        message: `Asset ${asset.id} references missing file ${relativeAssetPath}.`,
      });
      continue;
    }

    try {
      const dimensions = imageSize(await readFile(absoluteAssetPath));
      const actualWidth = dimensions.width ?? 0;
      const actualHeight = dimensions.height ?? 0;
      if (typeof width === "number" && typeof height === "number" && (actualWidth !== width || actualHeight !== height)) {
        issues.push({
          code: "INVALID_ASSET_REGISTRY",
          path: relativeAssetPath,
          message: `Asset ${asset.id} declares ${width}x${height} but file is ${actualWidth}x${actualHeight}.`,
        });
      }
    } catch {
      issues.push({
        code: "INVALID_ASSET_REGISTRY",
        path: relativeAssetPath,
        message: `Asset ${asset.id} must reference a readable image file.`,
      });
    }
  }
}

function validateAuthoredAssetFields(root: string, entities: LoadedEntity[], issues: ScenarioValidationIssue[]): void {
  const assetIds = new Set(entities.filter((entity) => entity.kind === "asset").map((entity) => entity.id));
  for (const entity of entities) {
    validateAuthoredAssetFieldsRecursive(root, entity, entity.data, "", assetIds, issues);
  }
}

function validateAuthoredAssetFieldsRecursive(
  root: string,
  entity: LoadedEntity,
  value: unknown,
  fieldPath: string,
  assetIds: Set<string>,
  issues: ScenarioValidationIssue[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateAuthoredAssetFieldsRecursive(root, entity, item, `${fieldPath}[${index}]`, assetIds, issues));
    return;
  }
  if (!isObject(value)) return;

  for (const [field, child] of Object.entries(value)) {
    const nextPath = fieldPath ? `${fieldPath}.${field}` : field;
    if (FORBIDDEN_AUTHORED_ASSET_URL_FIELDS.has(field)) {
      issues.push({
        code: "FORBIDDEN_AUTHORED_ASSET_URL",
        path: normalizePath(relative(root, entity.path)),
        message: `${entity.id}.${nextPath} is forbidden in authored scenario data; use assetId/iconAssetId/flagAssetId/crestAssetId/atlasAssetId instead.`,
      });
      continue;
    }

    if (typeof child === "string" && looksLikeExternalOrScenarioAssetUrl(child)) {
      issues.push({
        code: "FORBIDDEN_AUTHORED_ASSET_URL",
        path: normalizePath(relative(root, entity.path)),
        message: `${entity.id}.${nextPath} must not contain a URL or direct scenario asset path; reference a stable asset:* id instead.`,
      });
      continue;
    }

    if (ALLOWED_AUTHORED_ASSET_ID_FIELDS.has(field) && child != null) {
      if (typeof child !== "string" || !child.startsWith("asset:")) {
        issues.push({
          code: "INVALID_ASSET_REGISTRY",
          path: normalizePath(relative(root, entity.path)),
          message: `${entity.id}.${nextPath} must reference an asset:* id.`,
        });
      } else if (assetIds.size > 0 && !assetIds.has(child)) {
        issues.push({
          code: "BROKEN_REFERENCE",
          path: normalizePath(relative(root, entity.path)),
          message: `${entity.id}.${nextPath} references missing id ${child}.`,
        });
      }
      continue;
    }

    validateAuthoredAssetFieldsRecursive(root, entity, child, nextPath, assetIds, issues);
  }
}

function isScenarioAssetPath(path: string): boolean {
  if (!path.startsWith("assets/")) return false;
  if (path.includes("://") || path.startsWith("/") || path.includes("../") || path.includes("/../")) return false;
  return path.length > "assets/".length;
}

function looksLikeExternalOrScenarioAssetUrl(value: string): boolean {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/scenario-assets/") || trimmed.startsWith("assets/uploads/");
}

function validateForbiddenLegacyContentFields(root: string, entities: LoadedEntity[], issues: ScenarioValidationIssue[]): void {
  for (const entity of entities) {
    validateForbiddenLegacyContentFieldsRecursive(root, entity, entity.data, "", issues);
  }
}

function validateForbiddenLegacyContentFieldsRecursive(
  root: string,
  entity: LoadedEntity,
  value: unknown,
  fieldPath: string,
  issues: ScenarioValidationIssue[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateForbiddenLegacyContentFieldsRecursive(root, entity, item, `${fieldPath}[${index}]`, issues));
    return;
  }
  if (!isObject(value)) return;
  for (const [field, child] of Object.entries(value)) {
    const nextPath = fieldPath ? `${fieldPath}.${field}` : field;
    if (FORBIDDEN_LEGACY_CONTENT_FIELDS.has(field)) {
      issues.push({
        code: "FORBIDDEN_LEGACY_CONTENT_FIELD",
        path: normalizePath(relative(root, entity.path)),
        message: `${entity.id}.${nextPath} is a legacy authored field; use the current scenario format instead.`,
      });
      continue;
    }
    validateForbiddenLegacyContentFieldsRecursive(root, entity, child, nextPath, issues);
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
      message: `${entity.kind === "province" ? "Hex" : "Region"} file must define color as #RRGGBB.`,
    });
  }
}

async function loadHexMapSettings(root: string): Promise<JsonObject> {
  const issues: ScenarioValidationIssue[] = [];
  const loaded = await readJsonIfExists(join(root, "map/hex-settings.json"), root, issues);
  if (!loaded || !isObject(loaded.data) || issues.length > 0) {
    throw new Error(formatScenarioValidationIssues(issues));
  }
  return loaded.data;
}

async function validateHexMapSettings(root: string, issues: ScenarioValidationIssue[]): Promise<void> {
  const loaded = await readJsonIfExists(join(root, "map/hex-settings.json"), root, issues);
  if (!loaded) {
    issues.push({
      code: "MISSING_REQUIRED_FILE",
      path: "map/hex-settings.json",
      message: "Hex map settings are required for the hex map hard cutover.",
    });
    return;
  }
  if (!isObject(loaded.data)) {
    issues.push({
      code: "INVALID_HEX_MAP_SETTINGS",
      path: "map/hex-settings.json",
      message: "Hex map settings must be a JSON object.",
    });
    return;
  }

  const requiredStringFields = ["seed"] as const;
  for (const field of requiredStringFields) {
    if (typeof loaded.data[field] === "string" && loaded.data[field].trim() !== "") continue;
    issues.push({
      code: "INVALID_HEX_MAP_SETTINGS",
      path: "map/hex-settings.json",
      message: `Hex map setting ${field} must be a non-empty string.`,
    });
  }

  const requiredPositiveIntegerFields = ["width", "height", "hexSize", "targetLandRegionSize", "targetWaterRegionSize", "chunkSize"] as const;
  for (const field of requiredPositiveIntegerFields) {
    const value = loaded.data[field];
    if (Number.isInteger(value) && Number(value) > 0) continue;
    issues.push({
      code: "INVALID_HEX_MAP_SETTINGS",
      path: "map/hex-settings.json",
      message: `Hex map setting ${field} must be a positive integer.`,
    });
  }

  const requiredUnitNumberFields = ["seaLevel", "temperature", "moisture", "mountains", "rivers", "forests"] as const;
  for (const field of requiredUnitNumberFields) {
    const value = loaded.data[field];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) continue;
    issues.push({
      code: "INVALID_HEX_MAP_SETTINGS",
      path: "map/hex-settings.json",
      message: `Hex map setting ${field} must be a finite number between 0 and 1.`,
    });
  }

  if (typeof loaded.data.wrapX !== "boolean") {
    issues.push({
      code: "INVALID_HEX_MAP_SETTINGS",
      path: "map/hex-settings.json",
      message: "Hex map setting wrapX must be a boolean.",
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
    normalizeScenarioAiDefines(defines.ai, VALIDATION_AI_DEFAULTS);
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
    normalizeScenarioResourceLedgerDefines(
      defines.resourceLedger,
      VALIDATION_RESOURCE_LEDGER_DEFAULTS,
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

function validateHexHeavyFields(root: string, entities: LoadedEntity[], issues: ScenarioValidationIssue[]): void {
  for (const province of entities.filter((entity) => entity.kind === "province")) {
    for (const key of Object.keys(province.data)) {
      if (!PROVINCE_HEAVY_FIELDS.has(key)) continue;
      issues.push({
        code: "FORBIDDEN_PROVINCE_HEAVY_FIELD",
        path: normalizePath(relative(root, province.path)),
        message: `Hex file must not contain region-heavy field "${key}".`,
      });
    }
  }
}

function validateRegionMembership(root: string, entities: LoadedEntity[], issues: ScenarioValidationIssue[]): void {
  const assigned = new Map<string, LoadedEntity>();

  for (const region of entities.filter((entity) => entity.kind === "region")) {
    const hexIds = region.data.hexIds;
    if (!Array.isArray(hexIds) || hexIds.length === 0) {
      issues.push({
        code: "MISSING_REGION_MEMBERSHIP",
        path: normalizePath(relative(root, region.path)),
        message: "Region must define at least one hexId.",
      });
      continue;
    }

    for (const hexId of hexIds) {
      if (typeof hexId !== "string" || !/^hex:-?\d+:-?\d+$/.test(hexId)) {
        issues.push({
          code: "BROKEN_REFERENCE",
          path: normalizePath(relative(root, region.path)),
          message: `Region references invalid hex ${String(hexId)}.`,
        });
        continue;
      }

      const previousRegion = assigned.get(hexId);
      if (previousRegion) {
        issues.push({
          code: "DUPLICATE_REGION_MEMBERSHIP",
          path: normalizePath(relative(root, region.path)),
          message: `Hex ${hexId} is already assigned to ${previousRegion.id}.`,
        });
        continue;
      }
      assigned.set(hexId, region);
    }
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

function validateDecisionDefinitions(
  root: string,
  entities: LoadedEntity[],
  issues: ScenarioValidationIssue[],
): void {
  const eventIds = new Set(entities.filter((item) => item.kind === "event").map((item) => item.id));
  const journalEntryIds = new Set(entities.filter((item) => item.kind === "journalEntry").map((item) => item.id));
  const triggerRefs = getEventTriggerValidationRefs(entities);
  const modifierIds = triggerRefs.modifierIds ?? new Set<string>();
  for (const entity of entities.filter((item) => item.kind === "decision")) {
    const decision = entity.data.decision;
    if (!isObject(decision)) continue;
    const path = normalizePath(relative(root, entity.path));
    validateEventScope(entity, decision.scope, path, issues, triggerRefs);
    validateEventTrigger(entity, decision.potential, path, issues, "decision.potential", triggerRefs);
    validateEventTrigger(entity, decision.allow, path, issues, "decision.allow", triggerRefs);
    validateEventEffects(
      entity,
      decision.effects,
      eventIds,
      journalEntryIds,
      modifierIds,
      path,
      issues,
      0,
      "decision",
      "INVALID_DECISION_DEFINITION",
      false,
    );
  }
}

function validateEventDefinitions(
  root: string,
  entities: LoadedEntity[],
  localizationKeys: Set<string>,
  issues: ScenarioValidationIssue[],
): void {
  const eventIds = new Set(entities.filter((item) => item.kind === "event").map((item) => item.id));
  const journalEntryIds = new Set(entities.filter((item) => item.kind === "journalEntry").map((item) => item.id));
  const triggerRefs = getEventTriggerValidationRefs(entities);
  const modifierIds = triggerRefs.modifierIds ?? new Set<string>();
  for (const entity of entities.filter((item) => item.kind === "event")) {
    const event = entity.data.event;
    const path = normalizePath(relative(root, entity.path));
    if (!isObject(event)) {
      issues.push({
        code: "INVALID_EVENT_DEFINITION",
        path,
        message: `${entity.id}.event must be an object using the key-based event format.`,
      });
      continue;
    }

    for (const legacyField of ["title", "description", "buttonColor", "autoChancePct"]) {
      if (!(legacyField in event)) continue;
      issues.push({
        code: "INVALID_EVENT_DEFINITION",
        path,
        message: `${entity.id}.event uses legacy field ${legacyField}.`,
      });
    }
    validateRequiredStringSetField(entity, event, "category", EVENT_CATEGORY_IDS, path, issues, "event");
    validateRequiredStringSetField(entity, event, "priority", EVENT_PRIORITY_IDS, path, issues, "event");
    validateRequiredStringSetField(entity, event, "visibility", EVENT_VISIBILITY_IDS, path, issues, "event");
    validateLocalizedField(entity, event, "titleKey", localizationKeys, path, issues);
    validateLocalizedField(entity, event, "descriptionKey", localizationKeys, path, issues);
    validateEventScope(entity, event.scope, path, issues, triggerRefs);
    validateEventTrigger(entity, event.trigger, path, issues, "event.trigger", triggerRefs);
    validateEventChain(entity, event.chain, eventIds, path, issues, triggerRefs);

    const options = event.options;
    if (!Array.isArray(options) || options.length === 0) {
      issues.push({
        code: "INVALID_EVENT_DEFINITION",
        path,
        message: `${entity.id}.event.options must contain at least one option.`,
      });
      continue;
    }

    for (const [index, option] of options.entries()) {
      if (!isObject(option)) {
        issues.push({
          code: "INVALID_EVENT_DEFINITION",
          path,
          message: `${entity.id}.event.options[${index}] must be an object.`,
        });
        continue;
      }
      for (const legacyField of ["label", "description", "buttonColor", "autoChancePct"]) {
        if (!(legacyField in option)) continue;
        issues.push({
          code: "INVALID_EVENT_DEFINITION",
          path,
          message: `${entity.id}.event.options[${index}] uses legacy field ${legacyField}.`,
        });
      }
      validateLocalizedField(entity, option, "labelKey", localizationKeys, path, issues, `event.options[${index}]`);
      validateOptionalLocalizedField(entity, option, "descriptionKey", localizationKeys, path, issues, `event.options[${index}]`);
      validateOptionalLocalizedField(entity, option, "tooltipKey", localizationKeys, path, issues, `event.options[${index}]`);
      validateEventEffects(entity, option.effects, eventIds, journalEntryIds, modifierIds, path, issues, index);
      validateEventAiWeight(entity, option.aiWeight, path, issues, index, triggerRefs);
    }
    if (event.defaultOptionId != null) {
      const defaultOptionId = typeof event.defaultOptionId === "string" ? event.defaultOptionId : "";
      const hasDefaultOption = options.some((option) => isObject(option) && option.id === defaultOptionId);
      if (!hasDefaultOption) {
        issues.push({
          code: "INVALID_EVENT_DEFINITION",
          path,
          message: `${entity.id}.event.defaultOptionId must reference an event option id.`,
        });
      }
    }
    if (
      event.timeoutTurns != null &&
      (typeof event.timeoutTurns !== "number" || !Number.isInteger(event.timeoutTurns) || event.timeoutTurns < 0)
    ) {
      issues.push({
        code: "INVALID_EVENT_DEFINITION",
        path,
        message: `${entity.id}.event.timeoutTurns must be a non-negative integer when provided.`,
      });
    }
  }
}

function validateEventAiWeight(
  entity: LoadedEntity,
  aiWeight: unknown,
  path: string,
  issues: ScenarioValidationIssue[],
  optionIndex: number,
  triggerRefs: EventTriggerValidationRefs,
): void {
  if (aiWeight == null) return;
  if (!Array.isArray(aiWeight)) {
    issues.push({
      code: "INVALID_EVENT_DEFINITION",
      path,
      message: `${entity.id}.event.options[${optionIndex}].aiWeight must be an array.`,
    });
    return;
  }
  for (const [ruleIndex, rule] of aiWeight.entries()) {
    if (!isObject(rule)) {
      issues.push({
        code: "INVALID_EVENT_DEFINITION",
        path,
        message: `${entity.id}.event.options[${optionIndex}].aiWeight[${ruleIndex}] must be an object.`,
      });
      continue;
    }
    if ("base" in rule) {
      if (typeof rule.base === "number" && Number.isFinite(rule.base)) continue;
      issues.push({
        code: "INVALID_EVENT_DEFINITION",
        path,
        message: `${entity.id}.event.options[${optionIndex}].aiWeight[${ruleIndex}].base must be a finite number.`,
      });
      continue;
    }
    if ("if" in rule) {
      validateEventTrigger(entity, rule.if, path, issues, `event.options[${optionIndex}].aiWeight[${ruleIndex}].if`, triggerRefs);
      continue;
    }
    issues.push({
      code: "INVALID_EVENT_DEFINITION",
      path,
      message: `${entity.id}.event.options[${optionIndex}].aiWeight[${ruleIndex}] must define base or if.`,
    });
  }
}

function validateJournalDefinitions(
  root: string,
  entities: LoadedEntity[],
  localizationKeys: Set<string>,
  issues: ScenarioValidationIssue[],
): void {
  const eventIds = new Set(entities.filter((item) => item.kind === "event").map((item) => item.id));
  const decisionIds = new Set(entities.filter((item) => item.kind === "decision").map((item) => item.id));
  const triggerRefs = getEventTriggerValidationRefs(entities);
  const modifierIds = triggerRefs.modifierIds ?? new Set<string>();
  const journalEntryIds = new Set(entities.filter((item) => item.kind === "journalEntry").map((item) => item.id));
  for (const entity of entities.filter((item) => item.kind === "journalEntry")) {
    const journalEntry = entity.data.journalEntry;
    const path = normalizePath(relative(root, entity.path));
    if (!isObject(journalEntry)) {
      issues.push({
        code: "INVALID_JOURNAL_DEFINITION",
        path,
        message: `${entity.id}.journalEntry must be an object using the key-based journal format.`,
      });
      continue;
    }

    validateLocalizedField(entity, journalEntry, "titleKey", localizationKeys, path, issues, "journalEntry");
    validateLocalizedField(entity, journalEntry, "descriptionKey", localizationKeys, path, issues, "journalEntry");
    validateOptionalLocalizedField(entity, journalEntry, "shortDescriptionKey", localizationKeys, path, issues, "journalEntry");
    validateEventScope(entity, journalEntry.scope, path, issues, triggerRefs);
    validateEventTrigger(entity, journalEntry.startTrigger, path, issues, "journalEntry.startTrigger", triggerRefs);
    validateEventTrigger(entity, journalEntry.completeTrigger, path, issues, "journalEntry.completeTrigger", triggerRefs);
    validateEventTrigger(entity, journalEntry.failTrigger, path, issues, "journalEntry.failTrigger", triggerRefs);
    validateEventTrigger(entity, journalEntry.cancelTrigger, path, issues, "journalEntry.cancelTrigger", triggerRefs);
    validateJournalProgress(entity, journalEntry.progress, localizationKeys, path, issues);
    validateJournalEffects(entity, "onStartEffects", journalEntry.onStartEffects, eventIds, journalEntryIds, modifierIds, path, issues);
    validateJournalEffects(entity, "onCompleteEffects", journalEntry.onCompleteEffects, eventIds, journalEntryIds, modifierIds, path, issues);
    validateJournalEffects(entity, "onFailEffects", journalEntry.onFailEffects, eventIds, journalEntryIds, modifierIds, path, issues);
    validateJournalEffects(entity, "onCancelEffects", journalEntry.onCancelEffects, eventIds, journalEntryIds, modifierIds, path, issues);
    validateJournalEventHooks(entity, journalEntry.events, eventIds, path, issues);
    validateJournalDecisionHooks(entity, journalEntry.decisions, decisionIds, path, issues);
    validateJournalModifierHooks(entity, journalEntry.modifiers, modifierIds, path, issues);
    if (
      journalEntry.timeoutTurns != null &&
      (typeof journalEntry.timeoutTurns !== "number" || !Number.isInteger(journalEntry.timeoutTurns) || journalEntry.timeoutTurns < 0)
    ) {
      issues.push({
        code: "INVALID_JOURNAL_DEFINITION",
        path,
        message: `${entity.id}.journalEntry.timeoutTurns must be a non-negative integer when provided.`,
      });
    }
  }
}

function validateJournalProgress(
  entity: LoadedEntity,
  progress: unknown,
  localizationKeys: Set<string>,
  path: string,
  issues: ScenarioValidationIssue[],
): void {
  if (progress == null) return;
  if (!isObject(progress)) {
    issues.push({ code: "INVALID_JOURNAL_DEFINITION", path, message: `${entity.id}.journalEntry.progress must be an object.` });
    return;
  }
  if (progress.type !== "manual" && progress.type !== "trigger") {
    issues.push({ code: "INVALID_JOURNAL_DEFINITION", path, message: `${entity.id}.journalEntry.progress.type is unsupported.` });
  }
  if (typeof progress.target !== "number" || !Number.isFinite(progress.target) || progress.target <= 0) {
    issues.push({ code: "INVALID_JOURNAL_DEFINITION", path, message: `${entity.id}.journalEntry.progress.target must be a positive number.` });
  }
  validateLocalizedField(entity, progress, "labelKey", localizationKeys, path, issues, "journalEntry.progress");
}

function validateJournalEffects(
  entity: LoadedEntity,
  field: string,
  effects: unknown,
  eventIds: Set<string>,
  journalEntryIds: Set<string>,
  modifierIds: Set<string>,
  path: string,
  issues: ScenarioValidationIssue[],
): void {
  if (effects == null) return;
  if (!Array.isArray(effects)) {
    issues.push({ code: "INVALID_JOURNAL_DEFINITION", path, message: `${entity.id}.journalEntry.${field} must be an array.` });
    return;
  }
  for (const [index, effect] of effects.entries()) {
    if (!isObject(effect)) {
      issues.push({ code: "INVALID_JOURNAL_DEFINITION", path, message: `${entity.id}.journalEntry.${field}[${index}] must be an object.` });
      continue;
    }
    if (effect.type === "add_resource" || effect.type === "spend_resource") continue;
    if (effect.type === "add_resource_flow" && typeof effect.labelKey === "string" && effect.labelKey.trim()) continue;
    if (effect.type === "trigger_event" || effect.type === "schedule_event" || effect.type === "cancel_event") {
      if (typeof effect.eventId === "string" && eventIds.has(effect.eventId)) continue;
      issues.push({
        code: "BROKEN_REFERENCE",
        path,
        message: `${entity.id}.journalEntry.${field}[${index}].eventId references missing event ${String(effect.eventId)}.`,
      });
      continue;
    }
    if ((effect.type === "set_event_flag" || effect.type === "clear_event_flag") && typeof effect.flagId === "string" && effect.flagId.trim()) {
      continue;
    }
    if (effect.type === "add_modifier" || effect.type === "remove_modifier" || effect.type === "extend_modifier") {
      validateModifierEffectReference(entity, effect, modifierIds, path, issues, `journalEntry.${field}`, index, "INVALID_JOURNAL_DEFINITION");
      continue;
    }
    if (
      effect.type === "start_journal_entry" ||
      effect.type === "advance_journal_entry" ||
      effect.type === "complete_journal_entry" ||
      effect.type === "fail_journal_entry" ||
      effect.type === "cancel_journal_entry" ||
      effect.type === "set_journal_variable" ||
      effect.type === "clear_journal_variable"
    ) {
      if (typeof effect.journalEntryId === "string" && journalEntryIds.has(effect.journalEntryId)) continue;
      issues.push({
        code: "BROKEN_REFERENCE",
        path,
        message: `${entity.id}.journalEntry.${field}[${index}].journalEntryId references missing journal entry ${String(effect.journalEntryId)}.`,
      });
      continue;
    }
    if (effect.type === "change_colonization_progress") {
      const amount = Number(effect.amount);
      if (!Number.isFinite(amount) || amount === 0) {
        issues.push({
          code: "INVALID_JOURNAL_DEFINITION",
          path,
          message: `${entity.id}.journalEntry.${field}[${index}].amount must be a non-zero finite number.`,
        });
      }
      continue;
    }
    issues.push({
      code: "INVALID_JOURNAL_DEFINITION",
      path,
      message: `${entity.id}.journalEntry.${field}[${index}] has unsupported event effect type.`,
    });
  }
}

function validateJournalEventHooks(
  entity: LoadedEntity,
  hooks: unknown,
  eventIds: Set<string>,
  path: string,
  issues: ScenarioValidationIssue[],
): void {
  if (hooks == null) return;
  if (!isObject(hooks)) {
    issues.push({ code: "INVALID_JOURNAL_DEFINITION", path, message: `${entity.id}.journalEntry.events must be an object.` });
    return;
  }
  for (const field of ["onStart", "onComplete", "onFail", "onCancel"]) {
    const ids = hooks[field];
    if (ids == null) continue;
    if (!Array.isArray(ids)) {
      issues.push({ code: "INVALID_JOURNAL_DEFINITION", path, message: `${entity.id}.journalEntry.events.${field} must be an array.` });
      continue;
    }
    for (const [index, eventId] of ids.entries()) {
      if (typeof eventId === "string" && eventIds.has(eventId)) continue;
      issues.push({
        code: "BROKEN_REFERENCE",
        path,
        message: `${entity.id}.journalEntry.events.${field}[${index}] references missing event ${String(eventId)}.`,
      });
    }
  }
}

function validateJournalDecisionHooks(
  entity: LoadedEntity,
  hooks: unknown,
  decisionIds: Set<string>,
  path: string,
  issues: ScenarioValidationIssue[],
): void {
  if (hooks == null) return;
  if (!isObject(hooks)) {
    issues.push({ code: "INVALID_JOURNAL_DEFINITION", path, message: `${entity.id}.journalEntry.decisions must be an object.` });
    return;
  }
  const ids = hooks.availableDecisionIds;
  if (ids == null) return;
  if (!Array.isArray(ids)) {
    issues.push({ code: "INVALID_JOURNAL_DEFINITION", path, message: `${entity.id}.journalEntry.decisions.availableDecisionIds must be an array.` });
    return;
  }
  for (const [index, decisionId] of ids.entries()) {
    if (typeof decisionId === "string" && decisionIds.has(decisionId)) continue;
    issues.push({
      code: "BROKEN_REFERENCE",
      path,
      message: `${entity.id}.journalEntry.decisions.availableDecisionIds[${index}] references missing decision ${String(decisionId)}.`,
    });
  }
}

function validateJournalModifierHooks(
  entity: LoadedEntity,
  hooks: unknown,
  modifierIds: Set<string>,
  path: string,
  issues: ScenarioValidationIssue[],
): void {
  if (hooks == null) return;
  if (!isObject(hooks)) {
    issues.push({ code: "INVALID_JOURNAL_DEFINITION", path, message: `${entity.id}.journalEntry.modifiers must be an object.` });
    return;
  }
  const ids = hooks.activeModifierIds;
  if (ids == null) return;
  if (!Array.isArray(ids)) {
    issues.push({ code: "INVALID_JOURNAL_DEFINITION", path, message: `${entity.id}.journalEntry.modifiers.activeModifierIds must be an array.` });
    return;
  }
  for (const [index, modifierId] of ids.entries()) {
    if (typeof modifierId === "string" && modifierIds.has(modifierId)) continue;
    issues.push({
      code: "BROKEN_REFERENCE",
      path,
      message: `${entity.id}.journalEntry.modifiers.activeModifierIds[${index}] references missing modifier ${String(modifierId)}.`,
    });
  }
}

function validateEventChain(
  entity: LoadedEntity,
  chain: unknown,
  eventIds: Set<string>,
  path: string,
  issues: ScenarioValidationIssue[],
  triggerRefs: EventTriggerValidationRefs,
): void {
  if (chain == null) return;
  if (!isObject(chain)) {
    issues.push({ code: "INVALID_EVENT_DEFINITION", path, message: `${entity.id}.event.chain must be an object.` });
    return;
  }
  for (const field of ["chainId", "stepId"]) {
    if (typeof chain[field] !== "string" || !chain[field].trim()) {
      issues.push({ code: "INVALID_EVENT_DEFINITION", path, message: `${entity.id}.event.chain.${field} must be a non-empty string.` });
    }
  }
  if (chain.followups == null) return;
  if (!Array.isArray(chain.followups)) {
    issues.push({ code: "INVALID_EVENT_DEFINITION", path, message: `${entity.id}.event.chain.followups must be an array.` });
    return;
  }
  for (const [index, followup] of chain.followups.entries()) {
    if (!isObject(followup)) {
      issues.push({ code: "INVALID_EVENT_DEFINITION", path, message: `${entity.id}.event.chain.followups[${index}] must be an object.` });
      continue;
    }
    if (typeof followup.eventId !== "string" || !eventIds.has(followup.eventId)) {
      issues.push({
        code: "BROKEN_REFERENCE",
        path,
        message: `${entity.id}.event.chain.followups[${index}].eventId references missing event ${String(followup.eventId)}.`,
      });
    }
    if (
      followup.delayTurns != null &&
      (typeof followup.delayTurns !== "number" || !Number.isInteger(followup.delayTurns) || followup.delayTurns < 0)
    ) {
      issues.push({
        code: "INVALID_EVENT_DEFINITION",
        path,
        message: `${entity.id}.event.chain.followups[${index}].delayTurns must be a non-negative integer.`,
      });
    }
    if (
      followup.chancePct != null &&
      (typeof followup.chancePct !== "number" || !Number.isFinite(followup.chancePct) || followup.chancePct < 0 || followup.chancePct > 100)
    ) {
      issues.push({
        code: "INVALID_EVENT_DEFINITION",
        path,
        message: `${entity.id}.event.chain.followups[${index}].chancePct must be between 0 and 100.`,
      });
    }
    validateEventTrigger(entity, followup.conditions, path, issues, `event.chain.followups[${index}].conditions`, triggerRefs);
  }
}

function validateEventScope(
  entity: LoadedEntity,
  scope: unknown,
  path: string,
  issues: ScenarioValidationIssue[],
  triggerRefs: EventTriggerValidationRefs,
): void {
  if (scope == null) return;
  if (!isObject(scope)) {
    issues.push({
      code: "INVALID_EVENT_DEFINITION",
      path,
      message: `${entity.id}.event.scope must be an object.`,
    });
    return;
  }
  const region = scope.region;
  if (region == null) return;
  if (!isObject(region)) {
    issues.push({
      code: "INVALID_EVENT_DEFINITION",
      path,
      message: `${entity.id}.event.scope.region must be an object.`,
    });
    return;
  }
  if (region.kind !== "region") {
    issues.push({
      code: "INVALID_EVENT_DEFINITION",
      path,
      message: `${entity.id}.event.scope.region.kind must be region.`,
    });
  }
  if (region.from != null && region.from !== "root.controlled_regions" && region.from !== "root.owned_regions") {
    issues.push({
      code: "INVALID_EVENT_DEFINITION",
      path,
      message: `${entity.id}.event.scope.region.from has unsupported source.`,
    });
  }
  validateEventTrigger(entity, region.where, path, issues, "event.scope.region.where", triggerRefs);
}

type EventTriggerValidationRefs = {
  modifierIds?: Set<string>;
  lawIds?: Set<string>;
  technologyIds?: Set<string>;
  buildingIds?: Set<string>;
  goodIds?: Set<string>;
};

function getEventTriggerValidationRefs(entities: LoadedEntity[]): EventTriggerValidationRefs {
  return {
    modifierIds: new Set(entities.filter((item) => item.kind === "modifier").map((item) => item.id)),
    lawIds: new Set(entities.filter((item) => item.kind === "law").map((item) => item.id)),
    technologyIds: new Set(entities.filter((item) => item.kind === "technology").map((item) => item.id)),
    buildingIds: new Set(entities.filter((item) => item.kind === "building").map((item) => item.id)),
    goodIds: new Set(entities.filter((item) => item.kind === "good").map((item) => item.id)),
  };
}

function validateTriggerTargetReference(
  entity: LoadedEntity,
  trigger: JsonObject,
  validIds: Set<string> | undefined,
  targetKind: string,
  path: string,
  issues: ScenarioValidationIssue[],
  fieldPath: string,
): void {
  if (typeof trigger.targetId !== "string" || !trigger.targetId.trim()) {
    issues.push({
      code: "INVALID_EVENT_DEFINITION",
      path,
      message: `${entity.id}.${fieldPath}.targetId must reference a ${targetKind} id.`,
    });
    return;
  }
  if (validIds && !validIds.has(trigger.targetId)) {
    issues.push({
      code: "BROKEN_REFERENCE",
      path,
      message: `${entity.id}.${fieldPath}.targetId references missing ${targetKind} ${trigger.targetId}.`,
    });
  }
}

function validateEventTrigger(
  entity: LoadedEntity,
  trigger: unknown,
  path: string,
  issues: ScenarioValidationIssue[],
  fieldPath: string,
  refs: EventTriggerValidationRefs = {},
  depth = 0,
): void {
  if (trigger == null) return;
  if (!isObject(trigger) || depth > 5) {
    issues.push({
      code: "INVALID_EVENT_DEFINITION",
      path,
      message: `${entity.id}.${fieldPath} must be a supported trigger object.`,
    });
    return;
  }
  if (Array.isArray(trigger.all)) {
    if (trigger.all.length === 0 || trigger.all.length > 20) {
      issues.push({ code: "INVALID_EVENT_DEFINITION", path, message: `${entity.id}.${fieldPath}.all must contain 1-20 triggers.` });
    }
    trigger.all.forEach((child, index) => validateEventTrigger(entity, child, path, issues, `${fieldPath}.all[${index}]`, refs, depth + 1));
    return;
  }
  if (Array.isArray(trigger.any)) {
    if (trigger.any.length === 0 || trigger.any.length > 20) {
      issues.push({ code: "INVALID_EVENT_DEFINITION", path, message: `${entity.id}.${fieldPath}.any must contain 1-20 triggers.` });
    }
    trigger.any.forEach((child, index) => validateEventTrigger(entity, child, path, issues, `${fieldPath}.any[${index}]`, refs, depth + 1));
    return;
  }
  if (trigger.not != null) {
    validateEventTrigger(entity, trigger.not, path, issues, `${fieldPath}.not`, refs, depth + 1);
    return;
  }
  const type = trigger.type;
  if (typeof type !== "string" || !EVENT_TRIGGER_TYPES.has(type)) {
    issues.push({ code: "INVALID_EVENT_DEFINITION", path, message: `${entity.id}.${fieldPath}.type is unsupported.` });
    return;
  }
  if ((type === "country_resource_above" || type === "country_resource_below") && !EVENT_RESOURCE_IDS.has(String(trigger.resource))) {
    issues.push({ code: "INVALID_EVENT_DEFINITION", path, message: `${entity.id}.${fieldPath}.resource is unsupported.` });
  }
  if (type === "resource_flow_negative" && !EVENT_RESOURCE_IDS.has(String(trigger.resource))) {
    issues.push({ code: "INVALID_EVENT_DEFINITION", path, message: `${entity.id}.${fieldPath}.resource is unsupported.` });
  }
  if (type === "country_has_modifier") {
    if (typeof trigger.targetId !== "string" || !trigger.targetId.trim()) {
      issues.push({ code: "INVALID_EVENT_DEFINITION", path, message: `${entity.id}.${fieldPath}.targetId must reference a modifier id.` });
    } else if (refs.modifierIds && !refs.modifierIds.has(trigger.targetId)) {
      issues.push({
        code: "BROKEN_REFERENCE",
        path,
        message: `${entity.id}.${fieldPath}.targetId references missing modifier ${trigger.targetId}.`,
      });
    }
  }
  if (type === "country_has_law" || type === "country_lacks_law" || type === "law_active") {
    validateTriggerTargetReference(entity, trigger, refs.lawIds, "law", path, issues, fieldPath);
  }
  if (type === "country_has_technology" || type === "country_lacks_technology" || type === "technology_researched") {
    validateTriggerTargetReference(entity, trigger, refs.technologyIds, "technology", path, issues, fieldPath);
  }
  if (type === "has_building" || type === "region_has_building") {
    validateTriggerTargetReference(entity, trigger, refs.buildingIds, "building", path, issues, fieldPath);
  }
  if (type === "region_has_resource_deposit") {
    validateTriggerTargetReference(entity, trigger, refs.goodIds, "good", path, issues, fieldPath);
  }
  if (type === "building_output_above") {
    validateTriggerTargetReference(entity, trigger, refs.goodIds, "good", path, issues, fieldPath);
  }
  if (
    (type === "country_resource_above" ||
      type === "country_resource_below" ||
      type === "treasury_below" ||
      type === "country_controls_region_count_above" ||
      type === "country_controls_region_count_below" ||
      type === "region_population_above" ||
      type === "region_population_below" ||
      type === "region_has_population_above" ||
      type === "region_has_population_below" ||
      type === "region_radicals_above" ||
      type === "region_loyalists_above" ||
      type === "region_standard_of_living_below" ||
      type === "region_colonization_progress_above" ||
      type === "region_colonization_progress_below" ||
      type === "building_profit_below" ||
      type === "building_employment_below" ||
      type === "building_output_above") &&
    (typeof trigger.value !== "number" || !Number.isFinite(trigger.value))
  ) {
    issues.push({ code: "INVALID_EVENT_DEFINITION", path, message: `${entity.id}.${fieldPath}.value must be a finite number.` });
  }
}

function validateLocalizedField(
  entity: LoadedEntity,
  data: JsonObject,
  field: string,
  localizationKeys: Set<string>,
  path: string,
  issues: ScenarioValidationIssue[],
  prefix = "event",
): void {
  const value = data[field];
  if (typeof value === "string" && localizationKeys.has(value)) return;
  issues.push({
    code: "MISSING_LOCALIZATION_KEY",
    path,
    message: `${entity.id}.${prefix}.${field} is missing from en/ru localization files.`,
  });
}

function validateRequiredStringSetField(
  entity: LoadedEntity,
  data: JsonObject,
  field: string,
  allowedValues: Set<string>,
  path: string,
  issues: ScenarioValidationIssue[],
  prefix: string,
): void {
  const value = data[field];
  if (typeof value === "string" && allowedValues.has(value)) return;
  issues.push({
    code: "INVALID_EVENT_DEFINITION",
    path,
    message: `${entity.id}.${prefix}.${field} must be one of ${Array.from(allowedValues).join(", ")}.`,
  });
}

function validateOptionalLocalizedField(
  entity: LoadedEntity,
  data: JsonObject,
  field: string,
  localizationKeys: Set<string>,
  path: string,
  issues: ScenarioValidationIssue[],
  prefix: string,
): void {
  const value = data[field];
  if (value == null) return;
  if (typeof value === "string" && localizationKeys.has(value)) return;
  issues.push({
    code: "MISSING_LOCALIZATION_KEY",
    path,
    message: `${entity.id}.${prefix}.${field} is missing from en/ru localization files.`,
  });
}

function validateEventEffects(
  entity: LoadedEntity,
  effects: unknown,
  eventIds: Set<string>,
  journalEntryIds: Set<string>,
  modifierIds: Set<string>,
  path: string,
  issues: ScenarioValidationIssue[],
  optionIndex: number,
  context = `event.options[${optionIndex}]`,
  invalidCode: ScenarioValidationIssueCode = "INVALID_EVENT_DEFINITION",
  allowResourceDelta = true,
): void {
  if (effects == null) return;
  if (!Array.isArray(effects)) {
    issues.push({
      code: invalidCode,
      path,
      message: `${entity.id}.${context}.effects must be an array.`,
    });
    return;
  }
  for (const [effectIndex, effect] of effects.entries()) {
    if (!isObject(effect)) {
      issues.push({
        code: invalidCode,
        path,
        message: `${entity.id}.${context}.effects[${effectIndex}] must be an object.`,
      });
      continue;
    }
    if (effect.type === "resource_delta") {
      if (allowResourceDelta) {
        validateResourceEffectFields(entity, effect, path, issues, context, effectIndex, invalidCode, true);
        continue;
      }
      issues.push({
        code: invalidCode,
        path,
        message: `${entity.id}.${context}.effects[${effectIndex}] uses legacy resource_delta; use add_resource, spend_resource, or add_resource_flow.`,
      });
      continue;
    }
    if (effect.type === "add_resource" || effect.type === "spend_resource") {
      validateResourceEffectFields(entity, effect, path, issues, context, effectIndex, invalidCode, false);
      continue;
    }
    if (effect.type === "add_resource_flow") {
      validateResourceEffectFields(entity, effect, path, issues, context, effectIndex, invalidCode, false);
      if (effect.direction !== "income" && effect.direction !== "expense") {
        issues.push({
          code: invalidCode,
          path,
          message: `${entity.id}.${context}.effects[${effectIndex}].direction must be income or expense.`,
        });
      }
      if (typeof effect.labelKey !== "string" || !effect.labelKey.trim()) {
        issues.push({
          code: invalidCode,
          path,
          message: `${entity.id}.${context}.effects[${effectIndex}].labelKey is required for add_resource_flow.`,
        });
      }
      continue;
    }
    if (effect.type === "trigger_event" || effect.type === "schedule_event" || effect.type === "cancel_event") {
      if (typeof effect.eventId === "string" && eventIds.has(effect.eventId)) continue;
      issues.push({
        code: "BROKEN_REFERENCE",
        path,
        message: `${entity.id}.${context}.effects[${effectIndex}].eventId references missing event ${String(effect.eventId)}.`,
      });
      continue;
    }
    if (effect.type === "set_event_flag" || effect.type === "clear_event_flag") {
      if (typeof effect.flagId === "string" && effect.flagId.trim()) continue;
    }
    if (effect.type === "add_modifier" || effect.type === "remove_modifier" || effect.type === "extend_modifier") {
      validateModifierEffectReference(entity, effect, modifierIds, path, issues, context, effectIndex, invalidCode);
      continue;
    }
    if (
      effect.type === "start_journal_entry" ||
      effect.type === "advance_journal_entry" ||
      effect.type === "complete_journal_entry" ||
      effect.type === "fail_journal_entry" ||
      effect.type === "cancel_journal_entry" ||
      effect.type === "set_journal_variable" ||
      effect.type === "clear_journal_variable"
    ) {
      if (typeof effect.journalEntryId === "string" && journalEntryIds.has(effect.journalEntryId)) continue;
      issues.push({
        code: "BROKEN_REFERENCE",
        path,
        message: `${entity.id}.${context}.effects[${effectIndex}].journalEntryId references missing journal entry ${String(effect.journalEntryId)}.`,
      });
      continue;
    }
    if (effect.type === "change_colonization_progress") {
      const amount = Number(effect.amount);
      if (!Number.isFinite(amount) || amount === 0) {
        issues.push({
          code: invalidCode,
          path,
          message: `${entity.id}.${context}.effects[${effectIndex}].amount must be a non-zero finite number.`,
        });
      }
      continue;
    }
    issues.push({
      code: invalidCode,
      path,
      message: `${entity.id}.${context}.effects[${effectIndex}] has unsupported event effect type.`,
    });
  }
}

function validateResourceEffectFields(
  entity: LoadedEntity,
  effect: JsonObject,
  path: string,
  issues: ScenarioValidationIssue[],
  context: string,
  effectIndex: number,
  invalidCode: ScenarioValidationIssueCode,
  allowSignedAmount: boolean,
): void {
  if (typeof effect.resource !== "string" || !EVENT_RESOURCE_IDS.has(effect.resource)) {
    issues.push({
      code: invalidCode,
      path,
      message: `${entity.id}.${context}.effects[${effectIndex}].resource is unsupported.`,
    });
  }
  const amount = Number(effect.amount);
  if (!Number.isFinite(amount) || amount === 0 || (!allowSignedAmount && amount <= 0)) {
    issues.push({
      code: invalidCode,
      path,
      message: `${entity.id}.${context}.effects[${effectIndex}].amount must be ${allowSignedAmount ? "a non-zero" : "a positive"} finite number.`,
    });
  }
}

function validateModifierEffectReference(
  entity: LoadedEntity,
  effect: JsonObject,
  modifierIds: Set<string>,
  path: string,
  issues: ScenarioValidationIssue[],
  context: string,
  effectIndex: number,
  invalidCode: ScenarioValidationIssueCode,
): void {
  if (typeof effect.modifierId !== "string" || !modifierIds.has(effect.modifierId)) {
    issues.push({
      code: "BROKEN_REFERENCE",
      path,
      message: `${entity.id}.${context}.effects[${effectIndex}].modifierId references missing modifier ${String(effect.modifierId)}.`,
    });
  }
  if (effect.type === "extend_modifier") {
    if (typeof effect.durationTurns !== "number" || !Number.isInteger(effect.durationTurns) || effect.durationTurns <= 0) {
      issues.push({
        code: invalidCode,
        path,
        message: `${entity.id}.${context}.effects[${effectIndex}].durationTurns must be a positive integer for extend_modifier.`,
      });
    }
  }
  if (
    effect.type === "add_modifier" &&
    effect.durationTurns != null &&
    (typeof effect.durationTurns !== "number" || !Number.isInteger(effect.durationTurns) || effect.durationTurns <= 0)
  ) {
    issues.push({
      code: invalidCode,
      path,
      message: `${entity.id}.${context}.effects[${effectIndex}].durationTurns must be a positive integer when provided.`,
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
  if (!isObject(manifestCounts) || manifestCounts.hexes !== counts.hexes || manifestCounts.regions !== counts.regions) {
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

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}
