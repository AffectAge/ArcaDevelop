import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { matchesMapTagQuery } from "@arcanorum/shared";
import type {
  HexFeature,
  HexMapArtifact,
  HexTerrain,
  HexWaterKind,
  MapFeatureGeneratorDefinition,
  MapFeatureInstance,
  RegionId,
} from "@arcanorum/shared";

export const GENERATED_MAP_FEATURES_FILE = "map-features.json";

type JsonObject = Record<string, unknown>;

type FeatureCandidate = {
  hexId: MapFeatureInstance["hexId"];
  regionId: RegionId;
  sortKey: number;
};

type MapFeatureGenerationResult = {
  features: MapFeatureInstance[];
  issues: MapFeatureGenerationIssue[];
};

export type MapFeatureGenerationIssue = {
  code:
    | "INVALID_MAP_FEATURE_GENERATOR"
    | "MAP_FEATURE_GENERATOR_IMPOSSIBLE"
    | "MAP_FEATURE_GENERATOR_DUPLICATE_HEX";
  path: string;
  message: string;
};

export function ensureGeneratedMapFeatures(params: {
  scenarioDir: string;
  mapArtifact: HexMapArtifact;
  forceGenerated?: boolean;
}): MapFeatureGenerationResult {
  const generatedRoot = resolve(params.scenarioDir, ".generated");
  const outputPath = resolve(generatedRoot, GENERATED_MAP_FEATURES_FILE);
  if (!params.forceGenerated && existsSync(outputPath)) {
    return { features: loadGeneratedMapFeatures(outputPath), issues: [] };
  }

  const generators = loadMapFeatureGenerators(params.scenarioDir);
  const result = generateMapFeatures({
    generators: generators.flatMap((entry) => (entry.definition ? [entry.definition] : [])),
    mapArtifact: params.mapArtifact,
    scenarioSeed: params.mapArtifact.settings.seed,
  });
  const issues = [
    ...generators.flatMap((entry) => entry.issues),
    ...result.issues,
  ];
  mkdirSync(generatedRoot, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result.features, null, 2)}\n`, "utf8");
  return { features: result.features, issues };
}

export function loadGeneratedMapFeatures(path: string): MapFeatureInstance[] {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isMapFeatureInstance);
}

export function loadScenarioGeneratedMapFeatures(scenarioDir: string): MapFeatureInstance[] {
  return loadGeneratedMapFeatures(resolve(scenarioDir, ".generated", GENERATED_MAP_FEATURES_FILE));
}

export function generateMapFeatures(params: {
  generators: MapFeatureGeneratorDefinition[];
  mapArtifact: HexMapArtifact;
  scenarioSeed: string;
}): MapFeatureGenerationResult {
  const features: MapFeatureInstance[] = [];
  const issues: MapFeatureGenerationIssue[] = [];
  const occupiedHexIds = new Set<string>();
  const regionIds = new Set(params.mapArtifact.tiles.map((tile) => tile.regionId));

  for (const generator of params.generators) {
    const candidates = selectGeneratorCandidates(generator, params.mapArtifact)
      .filter((candidate) => !occupiedHexIds.has(candidate.hexId))
      .sort((left, right) => left.sortKey - right.sortKey || left.hexId.localeCompare(right.hexId));

    const selected = new Map<string, FeatureCandidate>();
    const perRegion = normalizeCountRule(generator.perRegion);
    if (perRegion) {
      for (const regionId of Array.from(regionIds).sort()) {
        if (generator.perRegion?.regionIds && !generator.perRegion.regionIds.includes(regionId)) continue;
        if (generator.perRegion?.excludedRegionIds?.includes(regionId)) continue;
        const regionCandidates = candidates.filter((candidate) => candidate.regionId === regionId && !selected.has(candidate.hexId));
        const target = clampCount(resolveCountForKey(perRegion, `${params.scenarioSeed}:${generator.id}:${regionId}`), regionCandidates.length);
        if (target < resolveMinimumCount(perRegion) && regionCandidates.length < resolveMinimumCount(perRegion)) {
          issues.push({
            code: "MAP_FEATURE_GENERATOR_IMPOSSIBLE",
            path: generator.id,
            message: `${generator.id} cannot place ${resolveMinimumCount(perRegion)} feature(s) in ${regionId}; only ${regionCandidates.length} candidate hexes are valid.`,
          });
        }
        for (const candidate of regionCandidates.slice(0, target)) {
          selected.set(candidate.hexId, candidate);
        }
      }
    }

    const global = normalizeCountRule(generator.global);
    if (global) {
      const globalCandidates = candidates.filter((candidate) => !selected.has(candidate.hexId));
      const target = clampCount(resolveCountForKey(global, `${params.scenarioSeed}:${generator.id}:global`), globalCandidates.length);
      if (target < resolveMinimumCount(global) && globalCandidates.length < resolveMinimumCount(global)) {
        issues.push({
          code: "MAP_FEATURE_GENERATOR_IMPOSSIBLE",
          path: generator.id,
          message: `${generator.id} cannot place ${resolveMinimumCount(global)} global feature(s); only ${globalCandidates.length} candidate hexes are valid.`,
        });
      }
      for (const candidate of globalCandidates.slice(0, target)) {
        selected.set(candidate.hexId, candidate);
      }
    }

    for (const candidate of Array.from(selected.values()).sort((left, right) => left.hexId.localeCompare(right.hexId))) {
      if (occupiedHexIds.has(candidate.hexId)) {
        issues.push({
          code: "MAP_FEATURE_GENERATOR_DUPLICATE_HEX",
          path: generator.id,
          message: `${generator.id} attempted to place a duplicate feature on ${candidate.hexId}.`,
        });
        continue;
      }
      occupiedHexIds.add(candidate.hexId);
      features.push({
        id: buildMapFeatureInstanceId(generator.id, candidate.hexId),
        typeId: generator.typeId,
        category: generator.category,
        hexId: candidate.hexId,
        regionId: candidate.regionId,
        visualId: generator.visualId ?? generator.typeId,
        visibility: generator.visibility ?? "known",
        nameKey: generator.nameKey,
        tooltipKey: generator.tooltipKey,
        assetId: generator.assetId,
        sourceGeneratorId: generator.id,
      });
    }
  }

  return { features, issues };
}

function loadMapFeatureGenerators(scenarioDir: string): Array<{ definition: MapFeatureGeneratorDefinition | null; issues: MapFeatureGenerationIssue[] }> {
  const root = resolve(scenarioDir, "common", "map_feature_generators");
  if (!existsSync(root)) return [];
  return listJsonFiles(root).map((path) => {
    const relativePath = normalizePath(relative(scenarioDir, path));
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
      return normalizeMapFeatureGenerator(parsed, relativePath);
    } catch {
      return {
        definition: null,
        issues: [{
          code: "INVALID_MAP_FEATURE_GENERATOR",
          path: relativePath,
          message: "Map feature generator must be valid strict JSON.",
        }],
      };
    }
  });
}

export function normalizeMapFeatureGenerator(input: unknown, path = "map_feature_generator"): {
  definition: MapFeatureGeneratorDefinition | null;
  issues: MapFeatureGenerationIssue[];
} {
  const issues: MapFeatureGenerationIssue[] = [];
  if (!isObject(input)) {
    return {
      definition: null,
      issues: [{ code: "INVALID_MAP_FEATURE_GENERATOR", path, message: "Map feature generator must be a JSON object." }],
    };
  }

  const id = typeof input.id === "string" && /^map_feature_generator:[a-zA-Z0-9_.:-]+$/.test(input.id) ? input.id as MapFeatureGeneratorDefinition["id"] : null;
  const typeId = typeof input.typeId === "string" && /^feature:[a-zA-Z0-9_.:-]+$/.test(input.typeId) ? input.typeId as MapFeatureGeneratorDefinition["typeId"] : null;
  const category = input.category === "deposit" || input.category === "site" || input.category === "strategic" ? input.category : null;
  if (!id) issues.push({ code: "INVALID_MAP_FEATURE_GENERATOR", path, message: "id must be map_feature_generator:<stable_id>." });
  if (!typeId) issues.push({ code: "INVALID_MAP_FEATURE_GENERATOR", path, message: "typeId must be feature:<stable_id>." });
  if (!category) issues.push({ code: "INVALID_MAP_FEATURE_GENERATOR", path, message: "category must be deposit, site, or strategic." });

  const definition: MapFeatureGeneratorDefinition = {
    id: id ?? "map_feature_generator:invalid",
    typeId: typeId ?? "feature:invalid",
    category: category ?? "site",
    visualId: normalizeFeatureId(input.visualId),
    nameKey: normalizeOptionalString(input.nameKey),
    tooltipKey: normalizeOptionalString(input.tooltipKey),
    assetId: normalizeAssetId(input.assetId),
    visibility: normalizeVisibility(input.visibility),
    allowedTerrains: normalizeEnumArray(input.allowedTerrains, VALID_TERRAINS),
    deniedTerrains: normalizeEnumArray(input.deniedTerrains, VALID_TERRAINS),
    allowedFeatures: normalizeEnumArray(input.allowedFeatures, VALID_FEATURES),
    deniedFeatures: normalizeEnumArray(input.deniedFeatures, VALID_FEATURES),
    allowedWaterKinds: normalizeEnumArray(input.allowedWaterKinds, VALID_WATER_KINDS),
    deniedWaterKinds: normalizeEnumArray(input.deniedWaterKinds, VALID_WATER_KINDS),
    tagQuery: normalizeMapTagQuery(input.tagQuery),
    regions: normalizeRegions(input.regions),
    global: normalizeCountRuleInput(input.global),
    perRegion: normalizeRegionCountRuleInput(input.perRegion),
  };

  if (!definition.global && !definition.perRegion) {
    issues.push({ code: "INVALID_MAP_FEATURE_GENERATOR", path, message: "At least one of global or perRegion count rules is required." });
  }
  return { definition: issues.length > 0 ? null : definition, issues };
}

function selectGeneratorCandidates(generator: MapFeatureGeneratorDefinition, mapArtifact: HexMapArtifact): FeatureCandidate[] {
  return mapArtifact.tiles
    .filter((tile) => tile.passable)
    .filter((tile) => !generator.regions?.include || generator.regions.include.includes(tile.regionId))
    .filter((tile) => !generator.regions?.exclude?.includes(tile.regionId))
    .filter((tile) => !generator.allowedTerrains || generator.allowedTerrains.includes(tile.terrain))
    .filter((tile) => !generator.deniedTerrains?.includes(tile.terrain))
    .filter((tile) => !generator.allowedFeatures || generator.allowedFeatures.includes(tile.feature))
    .filter((tile) => !generator.deniedFeatures?.includes(tile.feature))
    .filter((tile) => !generator.allowedWaterKinds || (tile.waterKind != null && generator.allowedWaterKinds.includes(tile.waterKind)))
    .filter((tile) => !(tile.waterKind != null && generator.deniedWaterKinds?.includes(tile.waterKind)))
    .filter((tile) => matchesMapTagQuery(tile.mapTags, generator.tagQuery))
    .map((tile) => ({
      hexId: tile.id,
      regionId: tile.regionId,
      sortKey: stableUnitHash(`${mapArtifact.settings.seed}:${generator.id}:${tile.id}`),
    }));
}

function normalizeCountRuleInput(input: unknown): MapFeatureGeneratorDefinition["global"] {
  if (!isObject(input)) return undefined;
  const count = normalizeNonNegativeInteger(input.count);
  const min = normalizeNonNegativeInteger(input.min);
  const max = normalizeNonNegativeInteger(input.max);
  return { ...(count == null ? {} : { count }), ...(min == null ? {} : { min }), ...(max == null ? {} : { max }) };
}

function normalizeRegionCountRuleInput(input: unknown): MapFeatureGeneratorDefinition["perRegion"] {
  if (!isObject(input)) return undefined;
  const base = normalizeCountRuleInput(input);
  return {
    ...base,
    regionIds: normalizeRegionIds(input.regionIds),
    excludedRegionIds: normalizeRegionIds(input.excludedRegionIds),
  };
}

function normalizeMapTagQuery(input: unknown): MapFeatureGeneratorDefinition["tagQuery"] {
  if (typeof input === "string" && input.trim()) return input.trim() as MapFeatureGeneratorDefinition["tagQuery"];
  if (!isObject(input)) return undefined;
  const all = Array.isArray(input.all) ? input.all.map(normalizeMapTagQuery).filter((item): item is NonNullable<MapFeatureGeneratorDefinition["tagQuery"]> => item != null) : undefined;
  const any = Array.isArray(input.any) ? input.any.map(normalizeMapTagQuery).filter((item): item is NonNullable<MapFeatureGeneratorDefinition["tagQuery"]> => item != null) : undefined;
  const not = Array.isArray(input.not)
    ? input.not.map(normalizeMapTagQuery).filter((item): item is NonNullable<MapFeatureGeneratorDefinition["tagQuery"]> => item != null)
    : normalizeMapTagQuery(input.not);
  return {
    ...(all && all.length > 0 ? { all } : {}),
    ...(any && any.length > 0 ? { any } : {}),
    ...(not && (!Array.isArray(not) || not.length > 0) ? { not } : {}),
  };
}

function normalizeCountRule<T extends { count?: number; min?: number; max?: number }>(rule: T | undefined): Required<Pick<T, "min" | "max">> & { count?: number } | null {
  if (!rule) return null;
  if (typeof rule.count === "number") return { min: rule.count, max: rule.count, count: rule.count };
  const min = rule.min ?? 0;
  const max = rule.max ?? min;
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

function resolveCountForKey(rule: { count?: number; min: number; max: number }, key: string): number {
  if (typeof rule.count === "number") return rule.count;
  if (rule.max <= rule.min) return rule.min;
  const span = rule.max - rule.min + 1;
  return rule.min + Math.floor(stableUnitHash(key) * span);
}

function resolveMinimumCount(rule: { min: number }): number {
  return Math.max(0, Math.floor(rule.min));
}

function clampCount(count: number, available: number): number {
  return Math.max(0, Math.min(Math.floor(count), available));
}

function buildMapFeatureInstanceId(generatorId: string, hexId: string): MapFeatureInstance["id"] {
  const generatorPart = generatorId.replace(/^map_feature_generator:/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const hexPart = hexId.replace(/^hex:/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `map_feature:${generatorPart}_${hexPart}` as MapFeatureInstance["id"];
}

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const childPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listJsonFiles(childPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      result.push(childPath);
    }
  }
  return result.sort();
}

function stableUnitHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function isMapFeatureInstance(input: unknown): input is MapFeatureInstance {
  return isObject(input)
    && typeof input.id === "string"
    && typeof input.typeId === "string"
    && (input.category === "deposit" || input.category === "site" || input.category === "strategic")
    && typeof input.hexId === "string"
    && typeof input.regionId === "string"
    && typeof input.visualId === "string"
    && (input.visibility === "known" || input.visibility === "discoverable" || input.visibility === "hidden");
}

function normalizeFeatureId(value: unknown): MapFeatureGeneratorDefinition["visualId"] {
  return typeof value === "string" && /^feature:[a-zA-Z0-9_.:-]+$/.test(value) ? value as MapFeatureGeneratorDefinition["visualId"] : undefined;
}

function normalizeAssetId(value: unknown): MapFeatureGeneratorDefinition["assetId"] {
  return typeof value === "string" && /^asset:[a-zA-Z0-9_.:-]+$/.test(value) ? value as MapFeatureGeneratorDefinition["assetId"] : undefined;
}

function normalizeVisibility(value: unknown): MapFeatureGeneratorDefinition["visibility"] {
  return value === "known" || value === "discoverable" || value === "hidden" ? value : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeEnumArray<T extends string>(input: unknown, allowed: readonly T[]): T[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const allowedSet = new Set<T>(allowed);
  const result = input.filter((value): value is T => typeof value === "string" && allowedSet.has(value as T));
  return result.length > 0 ? Array.from(new Set(result)) : undefined;
}

function normalizeRegions(input: unknown): MapFeatureGeneratorDefinition["regions"] {
  if (!isObject(input)) return undefined;
  return {
    include: normalizeRegionIds(input.include),
    exclude: normalizeRegionIds(input.exclude),
  };
}

function normalizeRegionIds(input: unknown): RegionId[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const ids = input.filter((value): value is RegionId => typeof value === "string" && value.startsWith("region:"));
  return ids.length > 0 ? Array.from(new Set(ids)) : undefined;
}

function normalizeNonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

const VALID_TERRAINS: readonly HexTerrain[] = [
  "ocean",
  "sea",
  "lake",
  "coast",
  "plains",
  "grassland",
  "forest",
  "hills",
  "mountains",
  "desert",
  "tundra",
  "snow",
  "wetland",
];
const VALID_FEATURES: readonly HexFeature[] = ["none", "forest", "dense_forest", "jungle", "marsh", "scrub", "snowcap"];
const VALID_WATER_KINDS: readonly Exclude<HexWaterKind, null>[] = ["ocean", "sea", "lake"];
