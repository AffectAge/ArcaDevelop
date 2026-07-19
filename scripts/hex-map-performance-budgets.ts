export type HexMapPerformanceFailure = {
  case: string;
  metric: string;
  actual: unknown;
  expected: string;
};

export type HexMapVersionedCacheEvidence = {
  versionedResourceCount: number;
  cacheHitCount: number;
  networkTransferBytes: number;
  encodedBodyBytes: number;
};

export type HexMapStartupReadiness = {
  fullStylesReady: boolean;
  fullStylesReadyAtMs: number;
  mapReady: boolean;
  mapReadyAtMs: number;
  stylesAppliedBeforeMapReady: boolean;
};

export function resolveEffectiveFirstInteractiveMs(
  internalTimings: readonly unknown[],
  readiness: Partial<HexMapStartupReadiness> | null | undefined,
): number | null {
  const timings = [
    ...internalTimings,
    readiness?.fullStylesReadyAtMs,
    readiness?.mapReadyAtMs,
  ]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0);
  return timings.length > 0 ? Math.max(...timings) : null;
}

export function resolveVersionedCacheEvidence(
  cdpEvidence: HexMapVersionedCacheEvidence,
  phases: Readonly<Record<string, number>> | null | undefined,
): HexMapVersionedCacheEvidence {
  if (cdpEvidence.versionedResourceCount > 0) return cdpEvidence;
  const resources = [
    {
      transferBytes: Number(phases?.navigationTransferBytes),
      encodedBodyBytes: Number(phases?.navigationEncodedBodyBytes),
    },
    {
      transferBytes: Number(phases?.firstChunkTransferBytes),
      encodedBodyBytes: Number(phases?.firstChunkEncodedBodyBytes),
    },
  ].filter(
    (resource) =>
      Number.isFinite(resource.transferBytes) &&
      resource.transferBytes >= 0 &&
      Number.isFinite(resource.encodedBodyBytes) &&
      resource.encodedBodyBytes > 0,
  );
  return {
    versionedResourceCount: resources.length,
    cacheHitCount: resources.filter((resource) => resource.transferBytes === 0)
      .length,
    networkTransferBytes: resources.reduce(
      (sum, resource) => sum + resource.transferBytes,
      0,
    ),
    encodedBodyBytes: resources.reduce(
      (sum, resource) => sum + resource.encodedBodyBytes,
      0,
    ),
  };
}

export type HexMapPerformanceResult = {
  name: string;
  fixtureId: string;
  viewport: { mobile: boolean };
  fixtureTiles?: number;
  fixtureBrotliBytes?: number;
  firstInteractiveMs?: number | null;
  frameP50Ms?: number | null;
  frameP95Ms?: number | null;
  frameP99Ms?: number | null;
  hoverLatencyP50Ms?: number | null;
  hoverLatencyP95Ms?: number | null;
  hoverLatencyP99Ms?: number | null;
  layerLatencyP50Ms?: number | null;
  layerLatencyP95Ms?: number | null;
  layerLatencyP99Ms?: number | null;
  longTaskCount?: number;
  longestTaskMs?: number;
  postReadyLongTaskCount?: number;
  longestPostReadyTaskMs?: number;
  renderCount?: number;
  residentChunks?: number;
  cacheBytes?: number;
  interactionFrameCount?: number;
  interactionRenderCount?: number;
  maxRendersPerDisplayFrame?: number;
  retainedHeapGrowthPct?: number | null;
  retainedCacheGrowthPct?: number | null;
  retainedResidentChunkGrowthPct?: number | null;
  visibleSprites?: number;
  visibleTerrainMeshes?: number;
  phases?: Record<string, number>;
  coldPageLoad?: {
    readiness?: Partial<HexMapStartupReadiness>;
  };
  cacheReopen?: {
    reopened?: {
      versionedResourceCount?: number;
      cacheHitCount?: number;
      networkTransferBytes?: number;
    };
  };
};

const REQUIRED_PHASE_NAMES = [
  "manifestFetchMs",
  "manifestDownloadMs",
  "manifestDecodeMs",
  "manifestParseIndexMs",
  "navigationFetchMs",
  "navigationDownloadMs",
  "navigationDecodeMs",
  "navigationParseIndexMs",
  "firstChunkFetchMs",
  "firstChunkDownloadMs",
  "firstChunkDecodeMs",
  "firstChunkParseIndexMs",
  "firstChunkWorkerPrepareMs",
  "firstChunkMainThreadCommitMs",
  "firstInteractiveMs",
] as const;

export function assertHexMapPerformanceBudgets(
  result: HexMapPerformanceResult,
): HexMapPerformanceFailure[] {
  const failures: HexMapPerformanceFailure[] = [];
  const mobile = result.viewport.mobile;
  const stress = result.fixtureId === "200k";
  const requiredTiles = stress ? 200_000 : 57_600;
  const p95Budget = mobile ? 33.3 : stress ? 20 : 16.7;
  const p99Budget = mobile ? 50 : 33.3;
  const firstInteractiveBudget = stress ? 3_000 : 2_000;
  const cacheByteBudget = (mobile ? 48 : 96) * 1024 * 1024;
  const residentChunkBudget = mobile ? 24 : 48;
  const pushFailure = (
    metric: string,
    actual: unknown,
    expected: string,
  ): void => {
    failures.push({ case: result.name, metric, actual, expected });
  };

  if (result.fixtureTiles !== requiredTiles) {
    pushFailure(
      "fixtureTiles",
      result.fixtureTiles ?? null,
      `= ${requiredTiles}`,
    );
  }
  assertFiniteBudget(
    failures,
    result,
    "frameP50Ms",
    result.frameP50Ms,
    Number.POSITIVE_INFINITY,
  );
  assertFiniteBudget(
    failures,
    result,
    "frameP95Ms",
    result.frameP95Ms,
    p95Budget,
  );
  assertFiniteBudget(
    failures,
    result,
    "frameP99Ms",
    result.frameP99Ms,
    p99Budget,
  );
  if (!mobile) {
    assertFiniteBudget(
      failures,
      result,
      "firstInteractiveMs",
      result.firstInteractiveMs,
      firstInteractiveBudget,
    );
  }
  const startupReadiness = result.coldPageLoad?.readiness;
  if (
    startupReadiness?.fullStylesReady !== true ||
    startupReadiness.mapReady !== true ||
    startupReadiness.stylesAppliedBeforeMapReady !== true ||
    !isFiniteNumber(startupReadiness.fullStylesReadyAtMs) ||
    startupReadiness.fullStylesReadyAtMs <= 0 ||
    !isFiniteNumber(startupReadiness.mapReadyAtMs) ||
    startupReadiness.mapReadyAtMs < startupReadiness.fullStylesReadyAtMs
  ) {
    pushFailure(
      "coldPageLoad.readiness",
      startupReadiness ?? null,
      "full CSS applied before map readiness",
    );
  }
  if (
    !isFiniteNumber(result.longTaskCount) ||
    !isFiniteNumber(result.longestTaskMs)
  ) {
    pushFailure("interactionLongTasks", null, "required measured values");
  } else if (result.longTaskCount > 0 || result.longestTaskMs > 50) {
    pushFailure(
      "interactionLongTasks",
      result.longestTaskMs,
      "0 tasks over 50 ms",
    );
  }
  if (
    !isFiniteNumber(result.postReadyLongTaskCount) ||
    !isFiniteNumber(result.longestPostReadyTaskMs)
  ) {
    pushFailure("postReadyLongTasks", null, "required measured values");
  } else if (
    result.postReadyLongTaskCount > 0 ||
    result.longestPostReadyTaskMs > 50
  ) {
    pushFailure(
      "postReadyLongTasks",
      result.longestPostReadyTaskMs,
      "0 tasks over 50 ms after first interactive viewport",
    );
  }
  requireFiniteMetric(failures, result, "renderCount", result.renderCount);
  if (!isFiniteNumber(result.residentChunks) || result.residentChunks <= 0) {
    pushFailure(
      "residentChunks",
      result.residentChunks ?? null,
      "required positive value",
    );
  } else if (result.residentChunks > residentChunkBudget) {
    pushFailure(
      "residentChunks",
      result.residentChunks,
      `<= ${residentChunkBudget}`,
    );
  }
  if (!isFiniteNumber(result.cacheBytes) || result.cacheBytes <= 0) {
    pushFailure(
      "cacheBytes",
      result.cacheBytes ?? null,
      "required positive value",
    );
  } else if (result.cacheBytes > cacheByteBudget) {
    pushFailure("cacheBytes", result.cacheBytes, `<= ${cacheByteBudget}`);
  }
  if (
    !isFiniteNumber(result.interactionFrameCount) ||
    result.interactionFrameCount < 120
  ) {
    pushFailure(
      "interactionFrameCount",
      result.interactionFrameCount ?? null,
      ">= 120",
    );
  }
  requireFiniteMetric(
    failures,
    result,
    "interactionRenderCount",
    result.interactionRenderCount,
  );
  if (!isFiniteNumber(result.maxRendersPerDisplayFrame)) {
    pushFailure(
      "maxRendersPerDisplayFrame",
      result.maxRendersPerDisplayFrame ?? null,
      "required",
    );
  } else if (result.maxRendersPerDisplayFrame > 1) {
    pushFailure(
      "maxRendersPerDisplayFrame",
      result.maxRendersPerDisplayFrame,
      "<= 1",
    );
  }
  assertFiniteBudget(
    failures,
    result,
    "hoverLatencyP95Ms",
    result.hoverLatencyP95Ms,
    50,
  );
  requireFiniteMetric(
    failures,
    result,
    "hoverLatencyP50Ms",
    result.hoverLatencyP50Ms,
  );
  requireFiniteMetric(
    failures,
    result,
    "hoverLatencyP99Ms",
    result.hoverLatencyP99Ms,
  );
  assertFiniteBudget(
    failures,
    result,
    "layerLatencyP95Ms",
    result.layerLatencyP95Ms,
    100,
  );
  requireFiniteMetric(
    failures,
    result,
    "layerLatencyP50Ms",
    result.layerLatencyP50Ms,
  );
  requireFiniteMetric(
    failures,
    result,
    "layerLatencyP99Ms",
    result.layerLatencyP99Ms,
  );
  assertFiniteBudget(
    failures,
    result,
    "retainedHeapGrowthPct",
    result.retainedHeapGrowthPct,
    10,
  );
  assertFiniteBudget(
    failures,
    result,
    "retainedCacheGrowthPct",
    result.retainedCacheGrowthPct,
    10,
  );
  requireFiniteMetric(
    failures,
    result,
    "retainedResidentChunkGrowthPct",
    result.retainedResidentChunkGrowthPct,
  );
  requireFiniteMetric(
    failures,
    result,
    "visibleSprites",
    result.visibleSprites,
  );
  requireFiniteMetric(
    failures,
    result,
    "visibleTerrainMeshes",
    result.visibleTerrainMeshes,
  );
  if (
    !stress &&
    (!isFiniteNumber(result.fixtureBrotliBytes) ||
      result.fixtureBrotliBytes > 2 * 1024 * 1024)
  ) {
    pushFailure(
      "fixtureBrotliBytes",
      result.fixtureBrotliBytes ?? null,
      "<= 2097152",
    );
  }
  for (const phaseName of REQUIRED_PHASE_NAMES) {
    const value = result.phases?.[phaseName];
    if (!isFiniteNumber(value) || value < 0) {
      pushFailure(
        `phases.${phaseName}`,
        value ?? null,
        "required finite value >= 0",
      );
    }
  }
  const reopened = result.cacheReopen?.reopened;
  if (
    !reopened ||
    !isFiniteNumber(reopened.versionedResourceCount) ||
    reopened.versionedResourceCount < 2
  ) {
    pushFailure(
      "cacheReopen.versionedResourceCount",
      reopened?.versionedResourceCount ?? null,
      ">= 2 (navigation plus chunk)",
    );
  } else if (reopened.cacheHitCount !== reopened.versionedResourceCount) {
    pushFailure(
      "cacheReopen.cacheHitCount",
      reopened.cacheHitCount ?? null,
      `= ${reopened.versionedResourceCount}`,
    );
  } else if (reopened.networkTransferBytes !== 0) {
    pushFailure(
      "cacheReopen.networkTransferBytes",
      reopened.networkTransferBytes ?? null,
      "= 0",
    );
  }
  return failures;
}

export function resolveHexMapPerformanceExitCode(
  failures: readonly HexMapPerformanceFailure[],
): 0 | 1 {
  return failures.length > 0 ? 1 : 0;
}

function assertFiniteBudget(
  failures: HexMapPerformanceFailure[],
  result: Pick<HexMapPerformanceResult, "name">,
  metric: string,
  actual: number | null | undefined,
  maximum: number,
): void {
  if (!isFiniteNumber(actual)) {
    failures.push({
      case: result.name,
      metric,
      actual: actual ?? null,
      expected: "required",
    });
  } else if (actual > maximum) {
    failures.push({
      case: result.name,
      metric,
      actual,
      expected: `<= ${maximum}`,
    });
  }
}

function requireFiniteMetric(
  failures: HexMapPerformanceFailure[],
  result: Pick<HexMapPerformanceResult, "name">,
  metric: string,
  actual: number | null | undefined,
): void {
  if (!isFiniteNumber(actual))
    failures.push({
      case: result.name,
      metric,
      actual: actual ?? null,
      expected: "required",
    });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
