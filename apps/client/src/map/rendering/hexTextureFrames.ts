import type { HexTile, MapFeatureVisualId } from "@arcanorum/shared";
import {
  PHASER_MAP_ART,
  type PhaserObjectTextureGroup,
  type PhaserTerrainTextureGroup,
} from "./phaserMapArt";

export function resolveTerrainTextureGroup(
  tile: Pick<HexTile, "mapTags" | "waterKind">,
): PhaserTerrainTextureGroup {
  if (tile.waterKind === "ocean") return "deep_water";
  if (tile.waterKind === "sea") return "coastal_water";
  if (tile.waterKind === "lake") return "fresh_water";
  const tags = tile.mapTags ?? [];
  if (tags.includes("feature:wet")) return "marsh";
  if (tags.includes("feature:snow")) return "snow";
  if (tags.includes("biome:desert")) return "desert";
  if (tags.includes("biome:tundra")) return "tundra";
  if (tags.includes("biome:tropical")) return "tropical";
  if (tags.includes("biome:plains")) return "plains";
  return "grassland";
}

export function resolveTerrainTextureFrame(tile: Pick<HexTile, "mapTags" | "q" | "r" | "waterKind">): number {
  const group = resolveTerrainTextureGroup(tile);
  return PHASER_MAP_ART.terrain.groups[group] + resolveTerrainFieldVariant(tile);
}

export function resolveTerrainFieldVariant(tile: Pick<HexTile, "q" | "r">): number {
  const column = positiveModulo(tile.q, PHASER_MAP_ART.terrain.fieldColumns);
  const row = positiveModulo(tile.r, PHASER_MAP_ART.terrain.fieldRows);
  return row * PHASER_MAP_ART.terrain.fieldColumns + column;
}

export function resolveObjectTextureFrame(group: PhaserObjectTextureGroup, stableId: string): number {
  return PHASER_MAP_ART.objects.groups[group] + stableTextureVariant(stableId, PHASER_MAP_ART.objects.variants);
}

export function normalizeFeatureVisualGroup(visualId: MapFeatureVisualId): PhaserObjectTextureGroup | null {
  return visualId in PHASER_MAP_ART.objects.groups ? visualId as PhaserObjectTextureGroup : null;
}

export function stableTextureVariant(value: string, variantCount: number): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) % Math.max(1, Math.floor(variantCount));
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
