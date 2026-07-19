import { describe, expect, it, vi } from "vitest";
import type {
  HexMapClientChunk,
  HexMapClientManifest,
} from "@arcanorum/shared";
import {
  fetchHexMapClientManifest,
  HexMapChunkStream,
  normalizeHexMapLoadFailureCode,
  selectHexMapChunksForViewport,
} from "./hexMapChunkStream";
import type {
  HexMapStreamingWorkerRequest,
  HexMapStreamingWorkerResponse,
} from "./hexMapStreamingProtocol";
import { DEFAULT_HEX_MAP_SETTINGS } from "./hexMapGenerator";
import { worldPixelWidth } from "./hexGeometry";

const navigationTiming = {
  scope: "navigation" as const,
  fetchMs: 1,
  downloadMs: 2,
  decodeMs: 3,
  parseIndexMs: 4,
  decodedBytes: 5,
  transferBytes: 6,
  encodedBodyBytes: 7,
};

const manifest: HexMapClientManifest = {
  formatVersion: 1,
  artifactVersion: "v1",
  settings: {
    ...DEFAULT_HEX_MAP_SETTINGS,
    width: 32,
    height: 16,
    chunkSize: 8,
    hexSize: 10,
    seed: "test",
    wrapX: false,
  },
  regions: [],
  navigation: {
    fileName: "navigation.json",
    contentHash: "nav",
    byteLength: 1,
    gzipByteLength: 1,
    brotliByteLength: 1,
  },
  chunks: [
    descriptor("hex-chunk:0:0", 0, 0, 0, 0, 7, 7),
    descriptor("hex-chunk:1:0", 1, 0, 8, 0, 15, 7),
    descriptor("hex-chunk:2:0", 2, 0, 16, 0, 23, 7),
  ],
};

describe("selectHexMapChunksForViewport", () => {
  it("prioritizes viewport chunks before one-chunk overscan", () => {
    const selection = selectHexMapChunksForViewport(
      manifest,
      { x: 60, y: 50, scale: 1 },
      { width: 80, height: 80 },
    );
    expect(selection.visibleChunkIds.length).toBeGreaterThan(0);
    expect(
      selection.desiredChunkIds.slice(0, selection.visibleChunkIds.length),
    ).toEqual(selection.visibleChunkIds);
    expect(selection.desiredChunkIds.length).toBeGreaterThanOrEqual(
      selection.visibleChunkIds.length,
    );
  });

  it("includes opposite-edge chunks through horizontal wrap copies", () => {
    const wrappedManifest = {
      ...manifest,
      settings: { ...manifest.settings, wrapX: true },
    };
    const selection = selectHexMapChunksForViewport(
      wrappedManifest,
      { x: worldPixelWidth(wrappedManifest.settings), y: 50, scale: 2 },
      { width: 80, height: 80 },
    );
    expect(selection.visibleChunkIds).toContain("hex-chunk:0:0");
  });
});

describe("map chunk stream errors", () => {
  it("keeps public map failure codes typed and normalizes unknown worker failures", () => {
    expect(normalizeHexMapLoadFailureCode("MAP_VERSION_MISMATCH")).toBe(
      "MAP_VERSION_MISMATCH",
    );
    expect(normalizeHexMapLoadFailureCode("MAP_CHUNK_NOT_FOUND")).toBe(
      "MAP_CHUNK_NOT_FOUND",
    );
    expect(normalizeHexMapLoadFailureCode("MAP_WORKER_FAILED")).toBe(
      "MAP_WORKER_FAILED",
    );
    expect(normalizeHexMapLoadFailureCode("RAW_NETWORK_ERROR")).toBe(
      "MAP_ARTIFACT_UNAVAILABLE",
    );
  });
});

describe("HexMapChunkStream", () => {
  it("prepares worker chunks without callbacks and adopts an identical manifest without reconfiguration", () => {
    const uploadFrames: FrameRequestCallback[] = [];
    const posted: HexMapStreamingWorkerRequest[] = [];
    const worker = {
      onmessage: null as
        | ((event: MessageEvent<HexMapStreamingWorkerResponse>) => void)
        | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
      postMessage: vi.fn((message: HexMapStreamingWorkerRequest) =>
        posted.push(message),
      ),
      terminate: vi.fn(),
    };
    const stream = new HexMapChunkStream({
      workerFactory: () => worker,
      requestFrame: (callback) => {
        uploadFrames.push(callback);
        return uploadFrames.length;
      },
      cancelFrame: vi.fn(),
    });
    const camera = { x: 100, y: 50, scale: 1 };
    const viewport = { width: 80, height: 20 };
    stream.prepare("/api", manifest, camera, viewport, {
      maxBufferedChunks: 48,
    });
    worker.onmessage?.({
      data: { type: "configured", timing: navigationTiming, generation: 1 },
    } as MessageEvent<HexMapStreamingWorkerResponse>);
    worker.onmessage?.(
      new MessageEvent("message", {
        data: makeChunkReadyResponse("hex-chunk:0:0", {
          scope: "chunk",
          chunkId: "hex-chunk:0:0",
          fetchMs: 1,
          downloadMs: 2,
          decodeMs: 3,
          parseIndexMs: 4,
          decodedBytes: 5,
          transferBytes: 6,
          encodedBodyBytes: 7,
          prepareMs: 8,
        }),
      }),
    );

    expect(uploadFrames).toHaveLength(0);
    const onChunkReady = vi.fn();
    const onPhaseTiming = vi.fn();
    const onViewportSelection = vi.fn();
    stream.configure("/api/", manifest, {
      onChunkReady,
      onChunksEvicted: vi.fn(),
      onPhaseTiming,
      onViewportSelection,
    });

    expect(
      posted.filter((message) => message.type === "configure"),
    ).toHaveLength(1);
    expect(onViewportSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        visibleChunkIds: ["hex-chunk:0:0", "hex-chunk:1:0"],
        generation: 1,
      }),
    );
    expect(onPhaseTiming).toHaveBeenCalledWith(navigationTiming);
    expect(uploadFrames).toHaveLength(1);
    expect(onChunkReady).not.toHaveBeenCalled();
    stream.prepare(
      "/late-prepare",
      { ...manifest, artifactVersion: "late" },
      camera,
      viewport,
      { maxBufferedChunks: 48 },
    );
    expect(
      posted.filter((message) => message.type === "configure"),
    ).toHaveLength(1);
    uploadFrames[0]?.(performance.now());
    expect(onChunkReady).toHaveBeenCalledTimes(1);
    stream.destroy();
  });

  it("discards a prepared generation on manifest hash mismatch or bounded-queue overflow", () => {
    const posted: HexMapStreamingWorkerRequest[] = [];
    const worker = {
      onmessage: null as
        | ((event: MessageEvent<HexMapStreamingWorkerResponse>) => void)
        | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
      postMessage: vi.fn((message: HexMapStreamingWorkerRequest) =>
        posted.push(message),
      ),
      terminate: vi.fn(),
    };
    const stream = new HexMapChunkStream({
      workerFactory: () => worker,
      requestFrame: vi.fn(() => 1),
      cancelFrame: vi.fn(),
    });
    stream.prepare(
      "/api",
      manifest,
      { x: 100, y: 50, scale: 1 },
      { width: 80, height: 20 },
      { maxBufferedChunks: 1 },
    );
    const timing = {
      scope: "chunk" as const,
      chunkId: "hex-chunk:0:0" as const,
      fetchMs: 1,
      downloadMs: 1,
      decodeMs: 1,
      parseIndexMs: 1,
      decodedBytes: 1,
      transferBytes: 1,
      encodedBodyBytes: 1,
      prepareMs: 1,
    };
    worker.onmessage?.(
      new MessageEvent("message", {
        data: makeChunkReadyResponse("hex-chunk:0:0", timing),
      }),
    );
    worker.onmessage?.(
      new MessageEvent("message", {
        data: makeChunkReadyResponse("hex-chunk:1:0", {
          ...timing,
          chunkId: "hex-chunk:1:0",
        }),
      }),
    );
    const onChunkReady = vi.fn();
    stream.configure("/api", manifest, {
      onChunkReady,
      onChunksEvicted: vi.fn(),
    });
    const changedHashManifest = {
      ...manifest,
      navigation: { ...manifest.navigation, contentHash: "nav-v2" },
    };
    stream.configure("/api", changedHashManifest, {
      onChunkReady,
      onChunksEvicted: vi.fn(),
    });

    expect(
      posted
        .filter((message) => message.type === "configure")
        .map((message) => message.generation),
    ).toEqual([1, 2, 3]);
    expect(onChunkReady).not.toHaveBeenCalled();
    stream.destroy();
  });

  it("cancels pending generation work and reconfigures the worker on scenario version change", async () => {
    const posted: HexMapStreamingWorkerRequest[] = [];
    const worker = {
      onmessage: null as
        | ((event: MessageEvent<HexMapStreamingWorkerResponse>) => void)
        | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
      postMessage: vi.fn((message: HexMapStreamingWorkerRequest) =>
        posted.push(message),
      ),
      terminate: vi.fn(),
    };
    const stream = new HexMapChunkStream({ workerFactory: () => worker });
    stream.configure("/api", manifest, {
      onChunkReady: vi.fn(),
      onChunksEvicted: vi.fn(),
    });
    const stalePath = stream.requestPath("unit", "hex:0:0", "hex:1:0");
    const nextManifest = { ...manifest, artifactVersion: "v2" };

    stream.configure("/api", nextManifest, {
      onChunkReady: vi.fn(),
      onChunksEvicted: vi.fn(),
    });

    await expect(stalePath).resolves.toEqual([]);
    expect(posted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "configure", generation: 1 }),
        expect.objectContaining({
          type: "configure",
          generation: 2,
          manifest: expect.objectContaining({ artifactVersion: "v2" }),
        }),
      ]),
    );
    stream.destroy();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("reports manifest fetch, download/decode, and parse/index phases", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const timing = vi.fn();

    await expect(
      fetchHexMapClientManifest("/api", undefined, timing),
    ).resolves.toEqual(manifest);
    expect(timing).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "manifest",
        fetchMs: expect.any(Number),
        downloadMs: expect.any(Number),
        decodeMs: expect.any(Number),
        parseIndexMs: expect.any(Number),
        decodedBytes: expect.any(Number),
        transferBytes: expect.any(Number),
        encodedBodyBytes: expect.any(Number),
      }),
    );
    fetchMock.mockRestore();
  });

  it("cancels the previous path request when hover target changes", async () => {
    const posted: unknown[] = [];
    const worker = {
      onmessage: null as
        | ((event: MessageEvent<HexMapStreamingWorkerResponse>) => void)
        | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
      postMessage: vi.fn((message: unknown) => posted.push(message)),
      terminate: vi.fn(),
    };
    const stream = new HexMapChunkStream({
      workerFactory: () => worker,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
    });
    stream.configure("/api", manifest, {
      onChunkReady: vi.fn(),
      onChunksEvicted: vi.fn(),
    });
    worker.onmessage?.({
      data: { type: "configured", timing: navigationTiming, generation: 1 },
    } as MessageEvent<HexMapStreamingWorkerResponse>);
    const first = stream.requestPath("unit", "hex:0:0", "hex:1:0");
    void stream.requestPath("unit", "hex:0:0", "hex:2:0");

    await expect(first).resolves.toEqual([]);
    expect(posted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "cancelPath", requestId: 1 }),
      ]),
    );
    stream.destroy();
  });

  it("keeps pathfinding deferred until navigation configuration completes", async () => {
    const posted: HexMapStreamingWorkerRequest[] = [];
    const worker = {
      onmessage: null as
        | ((event: MessageEvent<HexMapStreamingWorkerResponse>) => void)
        | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
      postMessage: vi.fn((message: HexMapStreamingWorkerRequest) =>
        posted.push(message),
      ),
      terminate: vi.fn(),
    };
    const stream = new HexMapChunkStream({
      workerFactory: () => worker,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
    });
    stream.configure("/api", manifest, {
      onChunkReady: vi.fn(),
      onChunksEvicted: vi.fn(),
    });

    const path = stream.requestPath("unit", "hex:0:0", "hex:1:0");
    expect(posted.some((message) => message.type === "findPath")).toBe(false);
    worker.onmessage?.({
      data: { type: "configured", timing: navigationTiming, generation: 1 },
    } as MessageEvent<HexMapStreamingWorkerResponse>);
    expect(posted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "findPath", requestId: 1 }),
      ]),
    );
    worker.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "pathReady",
          requestId: 1,
          hexIds: ["hex:0:0", "hex:1:0"],
          generation: 1,
        },
      }),
    );

    await expect(path).resolves.toEqual(["hex:0:0", "hex:1:0"]);
    stream.destroy();
  });

  it("reports bounded worker phases and measures the main-thread chunk upload callback", () => {
    performance.clearMarks("arc-map-stream-visible-worker-ready");
    const uploadFrame: { callback: FrameRequestCallback | null } = {
      callback: null,
    };
    const phaseTiming = vi.fn();
    const onChunkReady = vi.fn();
    const onVisibleChunksReady = vi.fn();
    const onViewportSelection = vi.fn();
    const worker = {
      onmessage: null as
        | ((event: MessageEvent<HexMapStreamingWorkerResponse>) => void)
        | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
      postMessage: vi.fn(),
      terminate: vi.fn(),
    };
    const stream = new HexMapChunkStream({
      workerFactory: () => worker,
      requestFrame: (callback) => {
        uploadFrame.callback = callback;
        return 1;
      },
      cancelFrame: vi.fn(),
    });
    stream.configure("/api", manifest, {
      onChunkReady,
      onChunksEvicted: vi.fn(),
      onPhaseTiming: phaseTiming,
      onVisibleChunksReady,
      onViewportSelection,
    });
    expect(
      stream.setViewport({ x: 100, y: 50, scale: 1 }, { width: 80, height: 20 })
        .visibleChunkIds,
    ).toEqual(["hex-chunk:0:0", "hex-chunk:1:0"]);
    expect(onViewportSelection).toHaveBeenCalledWith({
      visibleChunkIds: ["hex-chunk:0:0", "hex-chunk:1:0"],
      desiredChunkIds: ["hex-chunk:0:0", "hex-chunk:1:0", "hex-chunk:2:0"],
      generation: 1,
      visibleSetRevision: 1,
    });
    worker.onmessage?.({
      data: { type: "configured", timing: navigationTiming, generation: 1 },
    } as MessageEvent<HexMapStreamingWorkerResponse>);
    expect(phaseTiming).toHaveBeenCalledWith(navigationTiming);

    const chunkTiming = {
      scope: "chunk" as const,
      chunkId: "hex-chunk:0:0" as const,
      fetchMs: 1,
      downloadMs: 2,
      decodeMs: 3,
      parseIndexMs: 4,
      decodedBytes: 5,
      transferBytes: 6,
      encodedBodyBytes: 7,
      prepareMs: 6,
    };
    const response = makeChunkReadyResponse("hex-chunk:0:0", chunkTiming);
    worker.onmessage?.(new MessageEvent("message", { data: response }));
    uploadFrame.callback?.(performance.now());

    expect(onVisibleChunksReady).not.toHaveBeenCalled();
    worker.onmessage?.(
      new MessageEvent("message", {
        data: makeChunkReadyResponse("hex-chunk:1:0", {
          ...chunkTiming,
          chunkId: "hex-chunk:1:0",
        }),
      }),
    );
    expect(
      performance.getEntriesByName("arc-map-stream-visible-worker-ready"),
    ).toHaveLength(1);
    uploadFrame.callback?.(performance.now());

    expect(onChunkReady).toHaveBeenCalledTimes(2);
    expect(phaseTiming).toHaveBeenCalledWith(
      expect.objectContaining({
        ...chunkTiming,
        commitMs: expect.any(Number),
      }),
    );
    expect(onVisibleChunksReady).toHaveBeenCalledTimes(1);
    expect(onVisibleChunksReady).toHaveBeenCalledWith({
      visibleChunkIds: ["hex-chunk:0:0", "hex-chunk:1:0"],
      generation: 1,
      visibleSetRevision: 1,
    });
    stream.destroy();
    performance.clearMarks("arc-map-stream-visible-worker-ready");
  });
});

function makeChunkReadyResponse(
  chunkId: HexMapClientChunk["id"],
  timing: Extract<
    HexMapStreamingWorkerResponse,
    { type: "chunkReady" }
  >["data"]["timing"],
): Extract<HexMapStreamingWorkerResponse, { type: "chunkReady" }> {
  return {
    type: "chunkReady",
    chunkId,
    generation: 1,
    data: {
      timing,
      chunk: {
        formatVersion: 1,
        artifactVersion: "v1",
        id: chunkId,
        bounds: { minQ: 0, minR: 0, maxQ: 0, maxR: 0 },
        tiles: [],
        visualHalo: [],
        riverEdges: [],
        coastOverlays: [],
        features: [],
      },
      byteLength: 10,
    },
  };
}

function descriptor(
  id: HexMapClientManifest["chunks"][number]["id"],
  chunkQ: number,
  chunkR: number,
  minQ: number,
  minR: number,
  maxQ: number,
  maxR: number,
): HexMapClientManifest["chunks"][number] {
  return {
    id,
    fileName: `chunk-${chunkQ}-${chunkR}.json`,
    chunkQ,
    chunkR,
    bounds: { minQ, minR, maxQ, maxR },
    tileCount: 64,
    haloTileCount: 16,
    contentHash: id,
    byteLength: 1,
    gzipByteLength: 1,
    brotliByteLength: 1,
  };
}
