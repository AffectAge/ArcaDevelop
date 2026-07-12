import { useCallback, useEffect, useRef } from "react";
import type { HexId, HexMapArtifact, HexMapSettings, HexTile } from "@arcanorum/shared";
import { findRiverEdgeBetween } from "@arcanorum/shared";
import { getNeighborAxial, makeHexId } from "./hexGeometry";
import { findHexPath } from "./hexPathfinding";

export type PathPreviewKind = "land" | "water";

type PathPreviewResolver = (
  mapArtifact: HexMapArtifact,
  fromHexId: HexId,
  targetHexId: HexId,
  limit: number,
  tileById: ReadonlyMap<HexId, HexTile>,
) => HexId[];

export type PathPreviewCache = {
  getPreviewPath: (kind: PathPreviewKind, fromHexId: HexId, targetHexId: HexId) => HexId[];
  clear: () => void;
  size: () => number;
};

const PATH_PREVIEW_CACHE_LIMIT = 256;
const PATH_PREVIEW_SEARCH_LIMIT = 1600;

export function usePathPreviewCache(
  mapArtifact: HexMapArtifact,
  tileById: Map<HexId, HexTile>,
): (kind: PathPreviewKind, fromHexId: HexId, targetHexId: HexId) => HexId[] {
  const pathPreviewCacheRef = useRef<PathPreviewCache | null>(null);

  useEffect(() => {
    pathPreviewCacheRef.current = createPathPreviewCache({ mapArtifact, tileById });
  }, [mapArtifact, tileById]);

  return useCallback(
    (kind: PathPreviewKind, fromHexId: HexId, targetHexId: HexId): HexId[] => {
      if (!pathPreviewCacheRef.current) {
        pathPreviewCacheRef.current = createPathPreviewCache({ mapArtifact, tileById });
      }
      return pathPreviewCacheRef.current.getPreviewPath(kind, fromHexId, targetHexId);
    },
    [mapArtifact, tileById],
  );
}

export function createPathPreviewCache(params: {
  mapArtifact: HexMapArtifact;
  tileById: ReadonlyMap<HexId, HexTile>;
  limit?: number;
  findLandPath?: PathPreviewResolver;
  findWaterPath?: PathPreviewResolver;
}): PathPreviewCache {
  const cache = new Map<string, HexId[]>();
  const limit = Math.max(1, Math.trunc(params.limit ?? PATH_PREVIEW_CACHE_LIMIT));
  const findLandPath = params.findLandPath ?? findHexPath;
  const findWaterPath = params.findWaterPath ?? findWaterHexPath;

  return {
    getPreviewPath(kind: PathPreviewKind, fromHexId: HexId, targetHexId: HexId): HexId[] {
      if (fromHexId === targetHexId) return [];
      const key = buildPathPreviewCacheKey(kind, fromHexId, targetHexId);
      const cached = cache.get(key);
      if (cached) return cached;
      const resolver = kind === "water" ? findWaterPath : findLandPath;
      const path = resolver(params.mapArtifact, fromHexId, targetHexId, PATH_PREVIEW_SEARCH_LIMIT, params.tileById);
      cache.set(key, path);
      if (cache.size > limit) {
        const firstKey = cache.keys().next().value;
        if (typeof firstKey === "string") cache.delete(firstKey);
      }
      return path;
    },
    clear(): void {
      cache.clear();
    },
    size(): number {
      return cache.size;
    },
  };
}

function buildPathPreviewCacheKey(kind: PathPreviewKind, fromHexId: HexId, targetHexId: HexId): string {
  return `${kind}:${fromHexId}:${targetHexId}`;
}

function findWaterHexPath(
  map: HexMapArtifact,
  fromHexId: HexId,
  targetHexId: HexId,
  limit = PATH_PREVIEW_SEARCH_LIMIT,
  tileById: ReadonlyMap<HexId, HexTile> = new Map(map.tiles.map((tile) => [tile.id, tile] as const)),
): HexId[] {
  if (fromHexId === targetHexId) return [fromHexId];
  const start = tileById.get(fromHexId);
  const target = tileById.get(targetHexId);
  if (!start || !target || !isNavalPassableTile(target)) return [];
  const frontier: HexId[] = [fromHexId];
  const cameFrom = new Map<HexId, HexId | null>([[fromHexId, null]]);
  let visited = 0;
  while (frontier.length > 0 && visited < limit) {
    visited += 1;
    const currentId = frontier.shift();
    if (!currentId) break;
    if (currentId === targetHexId) break;
    const current = tileById.get(currentId);
    if (!current) continue;
    for (const neighbor of getNeighborTiles(current, tileById, map.settings)) {
      if (!isNavalPassableTile(neighbor) && findRiverEdgeBetween(map, current.id, neighbor.id, tileById)?.navigable !== true) continue;
      if (cameFrom.has(neighbor.id)) continue;
      cameFrom.set(neighbor.id, currentId);
      frontier.push(neighbor.id);
    }
  }
  if (!cameFrom.has(targetHexId)) return [];
  const route: HexId[] = [];
  let cursor: HexId | null = targetHexId;
  while (cursor) {
    route.push(cursor);
    cursor = cameFrom.get(cursor) ?? null;
  }
  return route.reverse();
}

export function getNeighborTiles(tile: HexTile, tileById: ReadonlyMap<HexId, HexTile>, settings: HexMapSettings): HexTile[] {
  const tiles: HexTile[] = [];
  for (let direction = 0; direction < 6; direction += 1) {
    const axial = getNeighborAxial(tile, direction as 0 | 1 | 2 | 3 | 4 | 5, settings);
    if (!axial) continue;
    const neighbor = tileById.get(makeHexId(axial.q, axial.r));
    if (neighbor) tiles.push(neighbor);
  }
  return tiles;
}

function isNavalPassableTile(tile: HexTile): boolean {
  return Boolean(tile.waterKind);
}
