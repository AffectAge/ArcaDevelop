import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  HexMapClientManifest,
  HexMapNavigationArtifact,
} from "@arcanorum/shared";
import type {
  HexMapStreamingWorkerRequest,
  HexMapStreamingWorkerResponse,
} from "./hexMapStreamingProtocol";
import { DEFAULT_HEX_MAP_SETTINGS } from "./hexMapGenerator";

type PendingFetch = {
  url: string;
  signal?: AbortSignal;
  resolve: (response: Response) => void;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("hex map streaming worker request scheduling", () => {
  it("loads visible chunks beside navigation within four requests and aborts stale navigation", async () => {
    const pendingFetches: PendingFetch[] = [];
    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          pendingFetches.push({
            url: String(input),
            signal: init?.signal ?? undefined,
            resolve,
          });
        }),
    );
    const posted: HexMapStreamingWorkerResponse[] = [];
    const workerScope = {
      onmessage: null as
        | ((event: MessageEvent<HexMapStreamingWorkerRequest>) => void)
        | null,
      postMessage: vi.fn((message: HexMapStreamingWorkerResponse) => {
        posted.push(message);
      }),
    };
    vi.stubGlobal("self", workerScope);
    vi.stubGlobal("navigator", { userAgent: "desktop-test" });
    vi.stubGlobal("fetch", fetchMock);
    await import("./hexMapStreaming.worker");

    const firstManifest = makeManifest("version-one");
    dispatch(workerScope, {
      type: "configure",
      apiBase: "http://map.test",
      manifest: firstManifest,
      generation: 1,
    });
    dispatch(workerScope, {
      type: "setDesiredChunkIds",
      chunkIds: firstManifest.chunks.map((chunk) => chunk.id),
      pinnedChunkIds: firstManifest.chunks.map((chunk) => chunk.id),
      generation: 1,
    });

    expect(pendingFetches).toHaveLength(4);
    expect(
      pendingFetches.filter((request) => request.url.includes("/navigation?")),
    ).toHaveLength(1);
    expect(
      pendingFetches.filter((request) => request.url.includes("/chunks/")),
    ).toHaveLength(3);
    expect(posted.some((message) => message.type === "configured")).toBe(false);

    const firstNavigationRequest = pendingFetches[0];
    if (!firstNavigationRequest)
      throw new Error("Expected the first navigation request.");
    const secondManifest = makeManifest("version-two");
    dispatch(workerScope, {
      type: "configure",
      apiBase: "http://map.test",
      manifest: secondManifest,
      generation: 2,
    });

    expect(firstNavigationRequest.signal?.aborted).toBe(true);
    const secondNavigationRequest = pendingFetches.at(-1);
    if (!secondNavigationRequest)
      throw new Error("Expected the replacement navigation request.");
    expect(secondNavigationRequest.url).toContain("version=version-two");

    firstNavigationRequest.resolve(
      jsonResponse(firstNavigationRequest.url, makeNavigation("version-one")),
    );
    await flushAsyncWork();
    expect(
      posted.some(
        (message) => message.type === "configured" && message.generation === 1,
      ),
    ).toBe(false);

    secondNavigationRequest.resolve(
      jsonResponse(secondNavigationRequest.url, makeNavigation("version-two")),
    );
    await flushAsyncWork();
    expect(posted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "configured", generation: 2 }),
      ]),
    );
  });
});

function dispatch(
  workerScope: {
    onmessage:
      | ((event: MessageEvent<HexMapStreamingWorkerRequest>) => void)
      | null;
  },
  data: HexMapStreamingWorkerRequest,
): void {
  workerScope.onmessage?.({
    data,
  } as MessageEvent<HexMapStreamingWorkerRequest>);
}

function makeManifest(artifactVersion: string): HexMapClientManifest {
  return {
    formatVersion: 1,
    artifactVersion,
    settings: {
      ...DEFAULT_HEX_MAP_SETTINGS,
      width: 8,
      height: 4,
      chunkSize: 2,
      wrapX: false,
    },
    regions: [],
    navigation: {
      fileName: "navigation.json",
      contentHash: `navigation-${artifactVersion}`,
      byteLength: 1,
      gzipByteLength: 1,
      brotliByteLength: 1,
    },
    chunks: Array.from({ length: 4 }, (_, index) => ({
      id: `hex-chunk:${index}:0` as const,
      chunkQ: index,
      chunkR: 0,
      fileName: `chunk-${index}-0.json`,
      contentHash: `chunk-${artifactVersion}-${index}`,
      byteLength: 1,
      gzipByteLength: 1,
      brotliByteLength: 1,
      tileCount: 1,
      haloTileCount: 0,
      bounds: { minQ: index * 2, minR: 0, maxQ: index * 2 + 1, maxR: 1 },
    })),
  };
}

function makeNavigation(artifactVersion: string): HexMapNavigationArtifact {
  return {
    formatVersion: 1,
    artifactVersion,
    width: 8,
    height: 4,
    wrapX: false,
    regionIds: [],
    passability: [],
    waterKinds: [],
    movementCosts: [],
    stopsMovementOnEnter: [],
    regionIndexes: [],
    riverEdges: [],
  };
}

function jsonResponse(url: string, value: unknown): Response {
  const response = new Response(JSON.stringify(value), { status: 200 });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
}
