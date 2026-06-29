import type { HexFeature, MapFeatureVisualId } from "@arcanorum/shared";

export const FEATURE_ATLAS_FRAME_SIZE = 64;
export const FEATURE_ATLAS_VARIANTS = 4;
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

export const NATURAL_FEATURE_VISUAL_IDS: Record<Exclude<HexFeature, "none">, MapFeatureVisualId> = {
  forest: "feature:forest",
  dense_forest: "feature:dense_forest",
  jungle: "feature:jungle",
  marsh: "feature:marsh",
  scrub: "feature:scrub",
  snowcap: "feature:snowcap",
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
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % variants;
}
