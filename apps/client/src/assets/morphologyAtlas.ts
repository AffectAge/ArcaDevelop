import type { HexTile } from "@arcanorum/shared";

export const MORPHOLOGY_ATLAS_FRAME_SIZE = 96;
export const MORPHOLOGY_ATLAS_VARIANTS = 6;
export const MORPHOLOGY_ATLAS_URL = "/game-assets/features/fallback-morphology-atlas.png";

export type MorphologyVisualId = "hills" | "mountains" | "snow-mountains";

export const MORPHOLOGY_ATLAS_ROWS: readonly MorphologyVisualId[] = ["hills", "mountains", "snow-mountains"];

export function resolveMorphologyVisualId(tile: Pick<HexTile, "mapTags">): MorphologyVisualId | null {
  const tags = tile.mapTags ?? [];
  if (tags.includes("morphology:mountainous")) {
    return tags.includes("feature:snow") || tags.includes("temperature:frozen") ? "snow-mountains" : "mountains";
  }
  return tags.includes("morphology:rough") ? "hills" : null;
}

export function resolveMorphologyAtlasRow(visualId: MorphologyVisualId): number {
  return MORPHOLOGY_ATLAS_ROWS.indexOf(visualId);
}

export function resolveMorphologyAtlasVariant(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % MORPHOLOGY_ATLAS_VARIANTS;
}
