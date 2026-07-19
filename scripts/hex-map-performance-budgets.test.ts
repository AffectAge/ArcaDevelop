import { describe, expect, it } from "vitest";
import {
  assertHexMapPerformanceBudgets,
  resolveEffectiveFirstInteractiveMs,
  resolveHexMapPerformanceExitCode,
  resolveVersionedCacheEvidence,
  type HexMapPerformanceResult,
} from "./hex-map-performance-budgets";

const phaseNames = [
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

describe("hex map performance budgets", () => {
  it("accepts a complete default desktop measurement", () => {
    expect(assertHexMapPerformanceBudgets(makeResult())).toEqual([]);
  });

  it("fails missing metrics, strict render cadence, and frame regressions", () => {
    const result = makeResult({ frameP95Ms: 17, maxRendersPerDisplayFrame: 2 });
    delete result.phases?.firstChunkWorkerPrepareMs;
    const failures = assertHexMapPerformanceBudgets(result);

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: "frameP95Ms" }),
        expect.objectContaining({ metric: "maxRendersPerDisplayFrame" }),
        expect.objectContaining({ metric: "phases.firstChunkWorkerPrepareMs" }),
      ]),
    );
    expect(resolveHexMapPerformanceExitCode(failures)).toBe(1);
  });

  it("returns a zero exit code only when every assertion passes", () => {
    expect(resolveHexMapPerformanceExitCode([])).toBe(0);
  });

  it("rejects a long task that starts after the first interactive viewport", () => {
    expect(
      assertHexMapPerformanceBudgets(
        makeResult({ postReadyLongTaskCount: 1, longestPostReadyTaskMs: 72 }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: "postReadyLongTasks" }),
      ]),
    );
  });

  it("counts a later stylesheet gate in first-interactive timing and readiness evidence", () => {
    const readiness = {
      fullStylesReady: true,
      fullStylesReadyAtMs: 1_800,
      mapReady: true,
      mapReadyAtMs: 1_801,
      stylesAppliedBeforeMapReady: true,
    };
    expect(resolveEffectiveFirstInteractiveMs([1_200, 1_150], readiness)).toBe(
      1_801,
    );
    expect(
      assertHexMapPerformanceBudgets(
        makeResult({ firstInteractiveMs: 1_801, coldPageLoad: { readiness } }),
      ),
    ).toEqual([]);

    const failures = assertHexMapPerformanceBudgets(
      makeResult({
        coldPageLoad: {
          readiness: {
            ...readiness,
            mapReadyAtMs: 1_700,
            stylesAppliedBeforeMapReady: false,
          },
        },
      }),
    );
    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: "coldPageLoad.readiness" }),
      ]),
    );
  });

  it("uses worker Resource Timing to prove immutable navigation and chunk cache reuse", () => {
    const emptyCdpEvidence = {
      versionedResourceCount: 0,
      cacheHitCount: 0,
      networkTransferBytes: 0,
      encodedBodyBytes: 0,
    };
    expect(
      resolveVersionedCacheEvidence(emptyCdpEvidence, {
        navigationTransferBytes: 0,
        navigationEncodedBodyBytes: 1_000,
        firstChunkTransferBytes: 0,
        firstChunkEncodedBodyBytes: 500,
      }),
    ).toEqual({
      versionedResourceCount: 2,
      cacheHitCount: 2,
      networkTransferBytes: 0,
      encodedBodyBytes: 1_500,
    });
    expect(
      resolveVersionedCacheEvidence(emptyCdpEvidence, {
        navigationTransferBytes: -1,
        navigationEncodedBodyBytes: -1,
      }).versionedResourceCount,
    ).toBe(0);
  });
});

function makeResult(
  overrides: Partial<HexMapPerformanceResult> = {},
): HexMapPerformanceResult {
  return {
    name: "default-desktop",
    fixtureId: "default",
    viewport: { mobile: false },
    fixtureTiles: 57_600,
    fixtureBrotliBytes: 1_000_000,
    firstInteractiveMs: 1_000,
    frameP50Ms: 16,
    frameP95Ms: 16.7,
    frameP99Ms: 30,
    hoverLatencyP50Ms: 10,
    hoverLatencyP95Ms: 20,
    hoverLatencyP99Ms: 25,
    layerLatencyP50Ms: 20,
    layerLatencyP95Ms: 30,
    layerLatencyP99Ms: 40,
    longTaskCount: 0,
    longestTaskMs: 0,
    postReadyLongTaskCount: 0,
    longestPostReadyTaskMs: 0,
    renderCount: 100,
    residentChunks: 12,
    cacheBytes: 10_000,
    interactionFrameCount: 120,
    interactionRenderCount: 60,
    maxRendersPerDisplayFrame: 1,
    retainedHeapGrowthPct: 1,
    retainedCacheGrowthPct: 0,
    retainedResidentChunkGrowthPct: 0,
    visibleSprites: 10,
    visibleTerrainMeshes: 4,
    phases: Object.fromEntries(phaseNames.map((name) => [name, 1])),
    coldPageLoad: {
      readiness: {
        fullStylesReady: true,
        fullStylesReadyAtMs: 900,
        mapReady: true,
        mapReadyAtMs: 901,
        stylesAppliedBeforeMapReady: true,
      },
    },
    cacheReopen: {
      reopened: {
        versionedResourceCount: 5,
        cacheHitCount: 5,
        networkTransferBytes: 0,
      },
    },
    ...overrides,
  };
}
