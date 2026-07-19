import type {
  HexChunkId,
  HexId,
  HexMapClientChunk,
  HexMapWorkerRequest,
  HexMapWorkerResponse,
} from "@arcanorum/shared";
export type HexMapChunkPayload = {
  chunk: HexMapClientChunk;
  byteLength: number;
  timing: HexMapWorkerChunkTiming;
};

export type HexMapWorkerJsonTiming = {
  fetchMs: number;
  downloadMs: number;
  decodeMs: number;
  parseIndexMs: number;
  decodedBytes: number;
  transferBytes: number;
  encodedBodyBytes: number;
};

export type HexMapManifestTiming = HexMapWorkerJsonTiming & {
  scope: "manifest";
};

export type HexMapWorkerNavigationTiming = HexMapWorkerJsonTiming & {
  scope: "navigation";
};

export type HexMapWorkerChunkTiming = HexMapWorkerJsonTiming & {
  scope: "chunk";
  chunkId: HexChunkId;
  prepareMs: number;
};

export type HexMapChunkStreamTiming =
  | HexMapManifestTiming
  | HexMapWorkerNavigationTiming
  | (HexMapWorkerChunkTiming & { commitMs: number });

export type HexMapUploadedChunkTiming = Extract<
  HexMapChunkStreamTiming,
  { scope: "chunk" }
>;

export type HexMapVisibleChunkTimingSummary = {
  count: number;
  fetchTotalMs: number;
  fetchMaxMs: number;
  decodeTotalMs: number;
  decodeMaxMs: number;
  parseIndexTotalMs: number;
  parseIndexMaxMs: number;
  workerPrepareTotalMs: number;
  workerPrepareMaxMs: number;
  mainThreadCommitTotalMs: number;
  mainThreadCommitMaxMs: number;
};

export function summarizeVisibleChunkTimings(
  visibleChunkIds: readonly HexChunkId[],
  timingByChunkId: ReadonlyMap<HexChunkId, HexMapUploadedChunkTiming>,
): HexMapVisibleChunkTimingSummary {
  const timings = visibleChunkIds.flatMap((chunkId) => {
    const timing = timingByChunkId.get(chunkId);
    return timing ? [timing] : [];
  });
  const sum = (read: (timing: HexMapUploadedChunkTiming) => number) =>
    timings.reduce((total, timing) => total + read(timing), 0);
  const max = (read: (timing: HexMapUploadedChunkTiming) => number) =>
    timings.reduce((maximum, timing) => Math.max(maximum, read(timing)), 0);
  return {
    count: timings.length,
    fetchTotalMs: sum((timing) => timing.fetchMs + timing.downloadMs),
    fetchMaxMs: max((timing) => timing.fetchMs + timing.downloadMs),
    decodeTotalMs: sum((timing) => timing.decodeMs),
    decodeMaxMs: max((timing) => timing.decodeMs),
    parseIndexTotalMs: sum((timing) => timing.parseIndexMs),
    parseIndexMaxMs: max((timing) => timing.parseIndexMs),
    workerPrepareTotalMs: sum((timing) => timing.prepareMs),
    workerPrepareMaxMs: max((timing) => timing.prepareMs),
    mainThreadCommitTotalMs: sum((timing) => timing.commitMs),
    mainThreadCommitMaxMs: max((timing) => timing.commitMs),
  };
}

export function mergeHexMapTimingPhases(
  current: Readonly<Record<string, number>>,
  timing: HexMapChunkStreamTiming,
): Record<string, number> {
  if (timing.scope === "manifest") {
    return {
      ...current,
      manifestFetchMs: timing.fetchMs,
      manifestDownloadMs: timing.downloadMs,
      manifestDecodeMs: timing.decodeMs,
      manifestParseIndexMs: timing.parseIndexMs,
      manifestDecodedBytes: timing.decodedBytes,
      manifestTransferBytes: timing.transferBytes,
      manifestEncodedBodyBytes: timing.encodedBodyBytes,
    };
  }
  if (timing.scope === "navigation") {
    return {
      ...current,
      navigationFetchMs: timing.fetchMs,
      navigationDownloadMs: timing.downloadMs,
      navigationDecodeMs: timing.decodeMs,
      navigationParseIndexMs: timing.parseIndexMs,
      navigationDecodedBytes: timing.decodedBytes,
      navigationTransferBytes: timing.transferBytes,
      navigationEncodedBodyBytes: timing.encodedBodyBytes,
    };
  }
  if (current.firstChunkFetchMs != null) return { ...current };
  return {
    ...current,
    firstChunkFetchMs: timing.fetchMs,
    firstChunkDownloadMs: timing.downloadMs,
    firstChunkDecodeMs: timing.decodeMs,
    firstChunkParseIndexMs: timing.parseIndexMs,
    firstChunkWorkerPrepareMs: timing.prepareMs,
    firstChunkMainThreadCommitMs: timing.commitMs,
    firstChunkDecodedBytes: timing.decodedBytes,
    firstChunkTransferBytes: timing.transferBytes,
    firstChunkEncodedBodyBytes: timing.encodedBodyBytes,
  };
}

export type HexMapStreamingWorkerRequest =
  | Exclude<HexMapWorkerRequest, { type: "configure" | "setDesiredChunkIds" }>
  | (Extract<HexMapWorkerRequest, { type: "configure" }> & {
      cityHexIds?: HexId[];
    })
  | (Extract<HexMapWorkerRequest, { type: "setDesiredChunkIds" }> & {
      pinnedChunkIds?: HexChunkId[];
    })
  | { type: "setCityHexIds"; cityHexIds: HexId[]; generation: number };

export type HexMapStreamingWorkerResponse =
  | Exclude<
      HexMapWorkerResponse<HexMapChunkPayload>,
      { type: "configured" }
    >
  | {
      type: "configured";
      timing: HexMapWorkerNavigationTiming;
      generation: number;
    }
  | { type: "chunksEvicted"; chunkIds: HexChunkId[]; generation: number }
  | {
      type: "cacheStats";
      residentChunks: number;
      cacheBytes: number;
      generation: number;
    };

export function getHexMapChunkResidentByteLength(
  sourceJsonByteLength: number,
): number {
  // The worker cache owns the decoded chunk and the main thread receives a structured clone.
  return Math.max(0, Math.trunc(sourceJsonByteLength)) * 2;
}
