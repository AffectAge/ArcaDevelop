import { describe, expect, it } from "vitest";
import type { HexChunkId } from "@arcanorum/shared";
import {
  getHexMapChunkResidentByteLength,
  mergeHexMapTimingPhases,
  summarizeVisibleChunkTimings,
  type HexMapUploadedChunkTiming,
} from "./hexMapStreamingProtocol";

describe("hex map streaming resident bytes", () => {
  it("counts the worker cache and main-thread structured clone", () => {
    expect(getHexMapChunkResidentByteLength(1_024)).toBe(1_024 * 2);
  });
});

describe("hex map streaming phase timings", () => {
  it("records manifest and navigation phases and keeps the first uploaded chunk bounded", () => {
    let phases = mergeHexMapTimingPhases(
      {},
      {
        scope: "manifest",
        fetchMs: 1,
        downloadMs: 2,
        decodeMs: 3,
        parseIndexMs: 4,
        decodedBytes: 5,
        transferBytes: 6,
        encodedBodyBytes: 7,
      },
    );
    phases = mergeHexMapTimingPhases(phases, {
      scope: "navigation",
      fetchMs: 6,
      downloadMs: 7,
      decodeMs: 8,
      parseIndexMs: 9,
      decodedBytes: 10,
      transferBytes: 11,
      encodedBodyBytes: 12,
    });
    phases = mergeHexMapTimingPhases(phases, {
      scope: "chunk",
      chunkId: "hex-chunk:0:0",
      fetchMs: 11,
      downloadMs: 12,
      decodeMs: 13,
      parseIndexMs: 14,
      decodedBytes: 15,
      transferBytes: 16,
      encodedBodyBytes: 17,
      prepareMs: 18,
      commitMs: 19,
    });
    phases = mergeHexMapTimingPhases(phases, {
      scope: "chunk",
      chunkId: "hex-chunk:1:0",
      fetchMs: 111,
      downloadMs: 112,
      decodeMs: 113,
      parseIndexMs: 114,
      decodedBytes: 115,
      transferBytes: 116,
      encodedBodyBytes: 117,
      prepareMs: 118,
      commitMs: 119,
    });

    expect(phases).toMatchObject({
      manifestFetchMs: 1,
      manifestTransferBytes: 6,
      navigationParseIndexMs: 9,
      navigationTransferBytes: 11,
      firstChunkFetchMs: 11,
      firstChunkTransferBytes: 16,
      firstChunkWorkerPrepareMs: 18,
      firstChunkMainThreadCommitMs: 19,
    });
    expect(phases.firstChunkFetchMs).toBe(11);
  });

  it("summarizes only the current visible chunk set with bounded totals and maxima", () => {
    const first = {
      scope: "chunk" as const,
      chunkId: "hex-chunk:0:0" as const,
      fetchMs: 2,
      downloadMs: 3,
      decodeMs: 4,
      parseIndexMs: 5,
      decodedBytes: 100,
      transferBytes: 50,
      encodedBodyBytes: 40,
      prepareMs: 6,
      commitMs: 7,
    };
    const second = {
      ...first,
      chunkId: "hex-chunk:1:0" as const,
      fetchMs: 8,
      downloadMs: 9,
      decodeMs: 10,
      parseIndexMs: 11,
      prepareMs: 12,
      commitMs: 13,
    };
    const summary = summarizeVisibleChunkTimings(
      [first.chunkId, second.chunkId],
      new Map<HexChunkId, HexMapUploadedChunkTiming>([
        [first.chunkId, first],
        [second.chunkId, second],
      ]),
    );

    expect(summary).toEqual({
      count: 2,
      fetchTotalMs: 22,
      fetchMaxMs: 17,
      decodeTotalMs: 14,
      decodeMaxMs: 10,
      parseIndexTotalMs: 16,
      parseIndexMaxMs: 11,
      workerPrepareTotalMs: 18,
      workerPrepareMaxMs: 12,
      mainThreadCommitTotalMs: 20,
      mainThreadCommitMaxMs: 13,
    });
  });
});
