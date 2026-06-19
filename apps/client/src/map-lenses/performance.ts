export type MapLensMetricSnapshot = {
  computeCount: number;
  cacheHits: number;
  cacheMisses: number;
  invalidations: number;
  totalComputeMs: number;
  maxComputeMs: number;
  lastComputeMs: number;
};

export function createMapLensPerformanceMetrics() {
  let snapshot: MapLensMetricSnapshot = {
    computeCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    invalidations: 0,
    totalComputeMs: 0,
    maxComputeMs: 0,
    lastComputeMs: 0,
  };
  return {
    recordCacheHit(): void {
      snapshot = { ...snapshot, cacheHits: snapshot.cacheHits + 1 };
    },
    recordCacheMiss(): void {
      snapshot = { ...snapshot, cacheMisses: snapshot.cacheMisses + 1 };
    },
    recordInvalidation(): void {
      snapshot = { ...snapshot, invalidations: snapshot.invalidations + 1 };
    },
    measure<T>(compute: () => T): T {
      const started = performance.now();
      try {
        return compute();
      } finally {
        const duration = performance.now() - started;
        snapshot = {
          ...snapshot,
          computeCount: snapshot.computeCount + 1,
          totalComputeMs: snapshot.totalComputeMs + duration,
          maxComputeMs: Math.max(snapshot.maxComputeMs, duration),
          lastComputeMs: duration,
        };
      }
    },
    snapshot(): MapLensMetricSnapshot {
      return { ...snapshot };
    },
  };
}
