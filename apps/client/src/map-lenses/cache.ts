import type { ComputedMapLens, MapLensComputationContext } from "./types";

export function createMapLensCache(maxEntries = 24) {
  const cache = new Map<string, ComputedMapLens>();
  return {
    get(context: MapLensComputationContext): ComputedMapLens | null {
      const key = getMapLensCacheKey(context);
      const value = cache.get(key) ?? null;
      if (value) {
        cache.delete(key);
        cache.set(key, value);
      }
      return value;
    },
    set(value: ComputedMapLens): void {
      const key = getMapLensCacheKey(value.context);
      cache.set(key, value);
      while (cache.size > maxEntries) {
        const oldest = cache.keys().next().value as string | undefined;
        if (!oldest) break;
        cache.delete(oldest);
      }
    },
    invalidateAffected(affectedEntityIds: ReadonlySet<string>): void {
      if (affectedEntityIds.size === 0) return;
      for (const [key, value] of cache.entries()) {
        if (value.affectedEntityIds == null || intersects(value.affectedEntityIds, affectedEntityIds)) {
          cache.delete(key);
        }
      }
    },
    clear(): void {
      cache.clear();
    },
    size(): number {
      return cache.size;
    },
  };
}

export function getMapLensCacheKey(context: MapLensComputationContext): string {
  return [
    context.lensId,
    context.worldVersion,
    context.geometryVersion,
    context.filterHash,
    context.perspectiveCountryId ?? "none",
    context.zoomBucket,
    context.selectedOverlayIds.join(","),
  ].join("|");
}

function intersects(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  for (const value of right) {
    if (left.has(value)) return true;
  }
  return false;
}
