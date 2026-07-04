import { matchesMapTagQuery, type HexTile, type MapFeatureVisualFrameRule, type MapFeatureVisualId, type MapFeatureVisualRuleDefinition } from "@arcanorum/shared";

export const FEATURE_ATLAS_FRAME_SIZE = 64;
export const FEATURE_ATLAS_VARIANTS = 6;
export const FEATURE_ATLAS_WIDTH = FEATURE_ATLAS_FRAME_SIZE * FEATURE_ATLAS_VARIANTS;
export const FEATURE_ATLAS_ROWS: MapFeatureVisualId[] = [
  "feature:forest",
  "feature:dense_forest",
  "feature:jungle",
  "feature:marsh",
  "feature:scrub",
  "feature:snowcap",
  "feature:ancient_ruins",
];
export const FEATURE_ATLAS_HEIGHT = FEATURE_ATLAS_FRAME_SIZE * FEATURE_ATLAS_ROWS.length;
export const FEATURE_ATLAS_FALLBACK_URL = "/game-assets/features/fallback-feature-atlas.png";

export const NATURAL_FEATURE_VISUAL_IDS: Record<string, MapFeatureVisualId> = {
  "feature:vegetated": "feature:forest",
  "feature:wet": "feature:marsh",
  "feature:snow": "feature:snowcap",
};

export function getFeatureAtlasUrl(scenarioId: string | null | undefined): string {
  const normalizedScenarioId = scenarioId && /^[a-zA-Z0-9_-]+$/.test(scenarioId) ? scenarioId : "default";
  return `/scenario-assets/${normalizedScenarioId}/assets/features/feature-atlas.png`;
}

export function getFeatureAtlasRow(featureId: string): number {
  const index = FEATURE_ATLAS_ROWS.indexOf(featureId as MapFeatureVisualId);
  return index >= 0 ? index : 0;
}

export function resolveFeatureAtlasVariant(seed: string, variants = FEATURE_ATLAS_VARIANTS): number {
  if (variants <= 1) return 0;
  return stableVariantIndex(seed, variants);
}

export function resolveFeatureAtlasFrame(params: {
  visualId: MapFeatureVisualId;
  tile: HexTile;
  seed: string;
  rules?: MapFeatureVisualRuleDefinition[];
  variants?: number;
}): number {
  const variants = params.variants ?? FEATURE_ATLAS_VARIANTS;
  const sourceRules = params.rules && params.rules.length > 0 ? params.rules : DEFAULT_FEATURE_VISUAL_RULES;
  const rules = sourceRules.filter((rule) => rule.visualId === params.visualId);
  const candidates = rules.flatMap((rule) => rule.frames).filter((frame) => isValidFrame(frame, variants) && matchesFrameRule(frame, params.tile));
  if (candidates.length === 0) return resolveFeatureAtlasVariant(params.seed, variants);
  const maxPriority = Math.max(...candidates.map((frame) => frame.priority ?? 0));
  const prioritized = candidates.filter((frame) => (frame.priority ?? 0) === maxPriority);
  return weightedStableFrame(prioritized, `${params.seed}:${params.visualId}`, variants);
}

export const DEFAULT_FEATURE_VISUAL_RULES: MapFeatureVisualRuleDefinition[] = [
  featureRule("feature:forest", [
    { frame: 0, weight: 2, conditions: { tagQuery: "feature:vegetated" } },
    { frame: 1, weight: 2, conditions: { tagQuery: { all: ["feature:vegetated", "biome:grassland"] }, moistureBands: ["normal", "wet"] } },
    { frame: 2, priority: 5, conditions: { tagQuery: { all: ["feature:vegetated", "biome:tundra"] }, temperatureBands: ["cold", "cool"] } },
    { frame: 3, priority: 5, conditions: { moistureBands: ["wet", "saturated"] } },
    { frame: 4, priority: 8, conditions: { distanceToWater: [1], moistureBands: ["wet", "saturated"] } },
    { frame: 5, priority: 8, conditions: { hasRiver: true } },
  ]),
  featureRule("feature:dense_forest", [
    { frame: 0, weight: 2, conditions: { tagQuery: "feature:vegetated" } },
    { frame: 1, weight: 2, conditions: { tagQuery: { all: ["feature:vegetated", "biome:tundra"] } } },
    { frame: 2, priority: 5, conditions: { moistureBands: ["wet"] } },
    { frame: 3, priority: 5, conditions: { moistureBands: ["saturated"] } },
    { frame: 4, priority: 8, conditions: { hasRiver: true } },
    { frame: 5, priority: 8, conditions: { temperatureBands: ["cold"], minElevation: 0.58 } },
  ]),
  featureRule("feature:jungle", [
    { frame: 0, weight: 2, conditions: { tagQuery: { all: ["feature:vegetated", "biome:tropical"] } } },
    { frame: 1, weight: 2, conditions: { temperatureBands: ["warm", "hot"] } },
    { frame: 2, priority: 5, conditions: { moistureBands: ["wet"] } },
    { frame: 3, priority: 5, conditions: { moistureBands: ["saturated"] } },
    { frame: 4, priority: 8, conditions: { distanceToWater: [1], moistureBands: ["wet", "saturated"] } },
    { frame: 5, priority: 8, conditions: { hasRiver: true } },
  ]),
  featureRule("feature:marsh", [
    { frame: 0, weight: 2, conditions: { tagQuery: "feature:wet" } },
    { frame: 1, weight: 2, conditions: { moistureBands: ["wet"] } },
    { frame: 2, priority: 5, conditions: { moistureBands: ["saturated"] } },
    { frame: 3, priority: 5, conditions: { distanceToWater: [1] } },
    { frame: 4, priority: 8, conditions: { tagQuery: "feature:wet", isCoastal: true } },
    { frame: 5, priority: 8, conditions: { hasRiver: true } },
  ]),
  featureRule("feature:scrub", [
    { frame: 0, weight: 2, conditions: { tagQuery: { all: ["feature:vegetated", "rainfall:dry"] } } },
    { frame: 1, weight: 2, conditions: { moistureBands: ["dry"] } },
    { frame: 2, priority: 5, conditions: { moistureBands: ["arid"] } },
    { frame: 3, priority: 5, conditions: { temperatureBands: ["hot"] } },
    { frame: 4, priority: 8, conditions: { tagQuery: "morphology:rough", minElevation: 0.55 } },
    { frame: 5, priority: 8, conditions: { distanceToWater: [1, 2], moistureBands: ["dry", "normal"] } },
  ]),
  featureRule("feature:snowcap", [
    { frame: 0, weight: 2, conditions: { tagQuery: "feature:snow" } },
    { frame: 1, weight: 2, conditions: { temperatureBands: ["cold"] } },
    { frame: 2, priority: 5, conditions: { temperatureBands: ["frozen"] } },
    { frame: 3, priority: 5, conditions: { tagQuery: "biome:tundra" } },
    { frame: 4, priority: 10, conditions: { tagQuery: "morphology:mountainous", minElevation: 0.78, maxTemperature: 0.24 } },
    { frame: 5, priority: 10, conditions: { tagQuery: "morphology:mountainous", minElevation: 0.86 } },
  ]),
  featureRule("feature:ancient_ruins", [
    { frame: 0, weight: 2 },
    { frame: 1, weight: 2 },
    { frame: 2, conditions: { tagQuery: { any: ["morphology:rough", "morphology:mountainous"] } } },
    { frame: 3, conditions: { moistureBands: ["dry", "arid"] } },
    { frame: 4, conditions: { isCoastal: true } },
    { frame: 5, conditions: { hasRiver: true } },
  ]),
];

function featureRule(visualId: MapFeatureVisualId, frames: MapFeatureVisualFrameRule[]): MapFeatureVisualRuleDefinition {
  return { id: `map_feature_visual:${visualId.replace(/^feature:/, "")}`, visualId, frames };
}

function isValidFrame(frame: MapFeatureVisualFrameRule, variants: number): boolean {
  return Number.isInteger(frame.frame) && frame.frame >= 0 && frame.frame < variants && (frame.weight ?? 1) > 0;
}

function matchesFrameRule(frame: MapFeatureVisualFrameRule, tile: HexTile): boolean {
  const condition = frame.conditions;
  if (!condition) return true;
  if (condition.waterKinds && (!tile.waterKind || !condition.waterKinds.includes(tile.waterKind))) return false;
  if (condition.temperatureBands && !condition.temperatureBands.includes(tile.temperatureBand)) return false;
  if (condition.moistureBands && !condition.moistureBands.includes(tile.moistureBand)) return false;
  if (condition.minElevation !== undefined && tile.elevation < condition.minElevation) return false;
  if (condition.maxElevation !== undefined && tile.elevation > condition.maxElevation) return false;
  if (condition.minTemperature !== undefined && tile.temperature < condition.minTemperature) return false;
  if (condition.maxTemperature !== undefined && tile.temperature > condition.maxTemperature) return false;
  if (condition.minMoisture !== undefined && tile.moisture < condition.minMoisture) return false;
  if (condition.maxMoisture !== undefined && tile.moisture > condition.maxMoisture) return false;
  if (condition.distanceToWater && !condition.distanceToWater.includes(tile.distanceToWater)) return false;
  if (condition.isCoastal !== undefined && tile.isCoastal !== condition.isCoastal) return false;
  if (condition.hasRiver !== undefined && (tile.riverMask > 0) !== condition.hasRiver) return false;
  if (condition.riverMasks && !condition.riverMasks.includes(tile.riverMask)) return false;
  if (!matchesMapTagQuery(tile.mapTags, condition.tagQuery)) return false;
  return true;
}

function weightedStableFrame(frames: MapFeatureVisualFrameRule[], seed: string, variants: number): number {
  if (frames.length === 0) return resolveFeatureAtlasVariant(seed, variants);
  const totalWeight = frames.reduce((sum, frame) => sum + Math.max(1, Math.floor(frame.weight ?? 1)), 0);
  let cursor = stableVariantIndex(seed, totalWeight);
  for (const frame of frames) {
    cursor -= Math.max(1, Math.floor(frame.weight ?? 1));
    if (cursor < 0) return frame.frame;
  }
  return frames[0]?.frame ?? 0;
}

function stableVariantIndex(seed: string, variants: number): number {
  if (variants <= 1) return 0;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % variants;
}
