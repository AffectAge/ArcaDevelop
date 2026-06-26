import type { HexDirection, HexId, HexMapArtifact } from "@arcanorum/shared";
import { getNeighborAxial, makeHexId } from "./hexGeometry";
import { generatedHexMaterialPack, type HexMaterialPackManifest } from "./hexTerrainMaterials";

export type HexRiverMaskDraft = {
  rawMask: number;
  width: number;
};

export type HexRiverMaskParams = [number, number, number, number];

const RIVER_WIDTH_STRENGTH_MAX = 3.4;

export function collectHexRiverMaskDrafts(map: HexMapArtifact): Map<HexId, HexRiverMaskDraft> {
  const drafts = new Map<HexId, HexRiverMaskDraft>();
  const tileById = new Map(map.tiles.map((tile) => [tile.id, tile]));
  const tileIds = new Set(tileById.keys());

  for (const river of map.riverEdges) {
    const source = drafts.get(river.hexId) ?? { rawMask: 0, width: 0 };
    source.rawMask |= directionBit(river.direction);
    source.width = Math.max(source.width, river.width);
    drafts.set(river.hexId, source);

    const sourceTile = tileById.get(river.hexId);
    const neighborAxial = sourceTile ? getNeighborAxial(sourceTile, river.direction, map.settings) : null;
    const neighborId = neighborAxial ? makeHexId(neighborAxial.q, neighborAxial.r) : null;
    if (!neighborId || !tileIds.has(neighborId)) continue;

    const target = drafts.get(neighborId) ?? { rawMask: 0, width: 0 };
    target.rawMask |= directionBit(oppositeDirection(river.direction));
    target.width = Math.max(target.width, river.width);
    drafts.set(neighborId, target);
  }

  return drafts;
}

export function collectHexRiverMaskParams(
  map: HexMapArtifact,
  materialPack: HexMaterialPackManifest = generatedHexMaterialPack,
): Map<HexId, HexRiverMaskParams> {
  const params = new Map<HexId, HexRiverMaskParams>();
  for (const [hexId, draft] of collectHexRiverMaskDrafts(map)) {
    if (draft.rawMask <= 0) continue;
    params.set(hexId, [
      resolveHexRiverMaskAtlasIndex(hexId, draft.rawMask, materialPack),
      1,
      resolveHexRiverStrength(draft.width),
      0,
    ]);
  }
  return params;
}

export function resolveHexRiverMaskAtlasIndex(
  hexId: HexId,
  rawMask: number,
  materialPack: HexMaterialPackManifest = generatedHexMaterialPack,
): number {
  const variants = Math.max(1, materialPack.riverMasks.variants);
  const normalizedMask = rawMask & 0b111111;
  return normalizedMask * variants + stableVariantIndex(`${hexId}:${normalizedMask}`, variants);
}

export function resolveHexRiverStrength(width: number): number {
  return Math.max(0.28, Math.min(1, width / RIVER_WIDTH_STRENGTH_MAX));
}

function directionBit(direction: HexDirection): number {
  return 1 << direction;
}

function oppositeDirection(direction: HexDirection): HexDirection {
  return ((direction + 3) % 6) as HexDirection;
}

function stableVariantIndex(seed: string, variants: number): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % variants;
}
