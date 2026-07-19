/// <reference lib="webworker" />

import type {
  HexChunkId,
  HexId,
  HexMapClientChunk,
  HexMapClientManifest,
  HexMapNavigationArtifact,
} from "@arcanorum/shared";
import {
  BoundedChunkLru,
  DESKTOP_CHUNK_CACHE_LIMITS,
  MOBILE_CHUNK_CACHE_LIMITS,
} from "./hexMapChunkLru";
import { findPathInNavigationArtifact } from "./hexMapNavigationPath";
import {
  getHexMapChunkResidentByteLength,
  type HexMapChunkPayload,
  type HexMapStreamingWorkerRequest,
  type HexMapStreamingWorkerResponse,
  type HexMapWorkerJsonTiming,
} from "./hexMapStreamingProtocol";

const MAX_CONCURRENT_HTTP_REQUESTS = 4;

let activeGeneration = 0;
let apiBase = "";
let manifest: HexMapClientManifest | null = null;
let navigation: HexMapNavigationArtifact | null = null;
let navigationRequestGeneration: number | null = null;
let navigationController: AbortController | null = null;
let desiredChunkIds: HexChunkId[] = [];
let desiredChunkIdSet = new Set<HexChunkId>();
let pinnedChunkIdSet = new Set<HexChunkId>();
let suppressedChunkIds = new Set<HexChunkId>();
let cityHexIds = new Set<HexId>();
let cache = createChunkCache();
const inFlight = new Map<HexChunkId, AbortController>();
const cancelledPathRequestIds = new Set<number>();

self.onmessage = (event: MessageEvent<HexMapStreamingWorkerRequest>) => {
  const request = event.data;
  if (request.type === "configure") {
    configureWorker(request);
    return;
  }
  if (request.generation !== activeGeneration) return;
  if (request.type === "setDesiredChunkIds") {
    setDesiredChunks(request.chunkIds, request.pinnedChunkIds);
    return;
  }
  if (request.type === "setCityHexIds") {
    updateCityHexIds(request.cityHexIds);
    return;
  }
  if (request.type === "cancelPath") {
    cancelledPathRequestIds.add(request.requestId);
    return;
  }
  if (request.type === "findPath") {
    void resolvePathRequest(request);
  }
};

function configureWorker(
  request: Extract<HexMapStreamingWorkerRequest, { type: "configure" }>,
): void {
  abortInFlightRequests();
  const evicted = cache.clear();
  activeGeneration = request.generation;
  apiBase = request.apiBase.replace(/\/$/, "");
  manifest = request.manifest;
  navigation = null;
  desiredChunkIds = [];
  desiredChunkIdSet = new Set();
  pinnedChunkIdSet = new Set();
  suppressedChunkIds = new Set();
  cityHexIds = new Set(request.cityHexIds ?? []);
  cancelledPathRequestIds.clear();
  cache = createChunkCache();
  if (evicted.length > 0)
    post({
      type: "chunksEvicted",
      chunkIds: evicted,
      generation: activeGeneration,
    });
  navigationRequestGeneration = request.generation;
  navigationController = new AbortController();
  void loadNavigation(request.generation, navigationController);
}

async function loadNavigation(
  generation: number,
  controller: AbortController,
): Promise<void> {
  const configuredManifest = manifest;
  if (!configuredManifest) return;
  try {
    const loadedNavigation = await fetchJson<HexMapNavigationArtifact>(
      `${apiBase}/hex-map/navigation?version=${encodeURIComponent(configuredManifest.artifactVersion)}`,
      controller.signal,
    );
    const nextNavigation = loadedNavigation.value;
    if (generation !== activeGeneration) return;
    if (nextNavigation.artifactVersion !== configuredManifest.artifactVersion) {
      post({
        type: "pathFailed",
        requestId: -1,
        code: "MAP_VERSION_MISMATCH",
        generation,
      });
      return;
    }
    navigation = nextNavigation;
    post({
      type: "configured",
      timing: { scope: "navigation", ...loadedNavigation.timing },
      generation,
    });
    pumpChunkRequests();
  } catch (error) {
    if (generation !== activeGeneration) return;
    post({
      type: "pathFailed",
      requestId: -1,
      code: resolveFetchErrorCode(error),
      generation,
    });
  } finally {
    if (
      navigationRequestGeneration === generation &&
      navigationController === controller
    ) {
      navigationRequestGeneration = null;
      navigationController = null;
      pumpChunkRequests();
    }
  }
}

function setDesiredChunks(
  chunkIds: HexChunkId[],
  pinnedChunkIds: HexChunkId[] = chunkIds,
): void {
  const previousDesiredChunkIdSet = desiredChunkIdSet;
  desiredChunkIds = [...new Set(chunkIds)];
  desiredChunkIdSet = new Set(desiredChunkIds);
  pinnedChunkIdSet = new Set(pinnedChunkIds);
  for (const chunkId of [...suppressedChunkIds]) {
    if (
      !desiredChunkIdSet.has(chunkId) ||
      !previousDesiredChunkIdSet.has(chunkId) ||
      pinnedChunkIdSet.has(chunkId)
    ) {
      suppressedChunkIds.delete(chunkId);
    }
  }
  for (const [chunkId, controller] of inFlight) {
    if (desiredChunkIdSet.has(chunkId)) continue;
    controller.abort();
    inFlight.delete(chunkId);
  }
  reportEvicted(cache.setPinned(pinnedChunkIdSet));
  pumpChunkRequests();
}

function pumpChunkRequests(): void {
  // Terrain rendering does not depend on the navigation artifact. Starting
  // visible chunks immediately keeps pathfinding initialization off the cold
  // first-viewport critical path; path requests remain deferred until the
  // worker posts its navigation-backed `configured` response.
  if (!manifest) return;
  const chunkRequestLimit = Math.max(
    0,
    MAX_CONCURRENT_HTTP_REQUESTS -
      Number(navigationRequestGeneration === activeGeneration),
  );
  while (inFlight.size < chunkRequestLimit) {
    const hasPendingVisibleChunk = [...pinnedChunkIdSet].some(
      (chunkId) => !cache.has(chunkId),
    );
    const chunkId = desiredChunkIds.find(
      (candidate) =>
        (!hasPendingVisibleChunk || pinnedChunkIdSet.has(candidate)) &&
        !cache.has(candidate) &&
        !inFlight.has(candidate) &&
        !suppressedChunkIds.has(candidate),
    );
    if (!chunkId) break;
    const controller = new AbortController();
    inFlight.set(chunkId, controller);
    void loadChunk(chunkId, controller, activeGeneration).finally(() => {
      if (inFlight.get(chunkId) === controller) inFlight.delete(chunkId);
      pumpChunkRequests();
    });
  }
}

async function loadChunk(
  chunkId: HexChunkId,
  controller: AbortController,
  generation: number,
): Promise<void> {
  const configuredManifest = manifest;
  if (!configuredManifest) return;
  try {
    const loadedChunk = await fetchJson<HexMapClientChunk>(
      `${apiBase}/hex-map/chunks/${encodeURIComponent(chunkId)}?version=${encodeURIComponent(configuredManifest.artifactVersion)}`,
      controller.signal,
    );
    const chunk = loadedChunk.value;
    if (
      controller.signal.aborted ||
      generation !== activeGeneration ||
      !desiredChunkIdSet.has(chunkId)
    )
      return;
    if (
      chunk.artifactVersion !== configuredManifest.artifactVersion ||
      chunk.id !== chunkId
    ) {
      post({
        type: "chunkFailed",
        chunkId,
        code: "MAP_VERSION_MISMATCH",
        generation,
      });
      return;
    }

    const descriptor = configuredManifest.chunks.find(
      (candidate) => candidate.id === chunkId,
    );
    const sourceJsonByteLength =
      descriptor?.byteLength ?? estimateChunkBytes(chunk);
    const payload = buildChunkPayload(
      chunk,
      sourceJsonByteLength,
      loadedChunk.timing,
      generation,
    );
    if (!payload) return;
    const evicted = cache.set(chunkId, chunk, payload.byteLength);
    reportEvicted(evicted);
    if (evicted.includes(chunkId)) return;
    emitChunkPayload(payload, generation);
    postCacheStats();
  } catch (error) {
    if (controller.signal.aborted || generation !== activeGeneration) return;
    post({
      type: "chunkFailed",
      chunkId,
      code: resolveFetchErrorCode(error),
      generation,
    });
  }
}

function buildChunkPayload(
  chunk: HexMapClientChunk,
  sourceJsonByteLength: number,
  jsonTiming: HexMapWorkerJsonTiming,
  generation: number,
): HexMapChunkPayload | null {
  const configuredManifest = manifest;
  if (!configuredManifest || generation !== activeGeneration) return null;
  const prepareStartedAt = performance.now();
  return {
    chunk,
    byteLength: getHexMapChunkResidentByteLength(sourceJsonByteLength),
    timing: {
      scope: "chunk",
      chunkId: chunk.id,
      ...jsonTiming,
      prepareMs: performance.now() - prepareStartedAt,
    },
  };
}

function emitChunkPayload(
  payload: HexMapChunkPayload,
  generation: number,
): void {
  if (generation !== activeGeneration) return;
  post({
    type: "chunkReady",
    chunkId: payload.chunk.id,
    data: payload,
    generation,
  });
}

function updateCityHexIds(nextIds: HexId[]): void {
  const next = new Set(nextIds);
  const changedIds = new Set<HexId>();
  for (const id of cityHexIds) if (!next.has(id)) changedIds.add(id);
  for (const id of next) if (!cityHexIds.has(id)) changedIds.add(id);
  cityHexIds = next;
  if (changedIds.size === 0) return;
  for (const chunk of cache.values()) {
    const touchesChangedCity =
      chunk.tiles.some((tile) => changedIds.has(tile.id)) ||
      chunk.visualHalo.some((tile) => changedIds.has(tile.id));
    if (!touchesChangedCity) continue;
    const descriptor = manifest?.chunks.find(
      (candidate) => candidate.id === chunk.id,
    );
    const payload = buildChunkPayload(
      chunk,
      descriptor?.byteLength ?? estimateChunkBytes(chunk),
      {
        fetchMs: 0,
        downloadMs: 0,
        decodeMs: 0,
        parseIndexMs: 0,
        decodedBytes: 0,
        transferBytes: 0,
        encodedBodyBytes: 0,
      },
      activeGeneration,
    );
    if (payload) emitChunkPayload(payload, activeGeneration);
  }
}

async function resolvePathRequest(
  request: Extract<HexMapStreamingWorkerRequest, { type: "findPath" }>,
): Promise<void> {
  const configuredNavigation = navigation;
  if (!configuredNavigation) {
    post({
      type: "pathFailed",
      requestId: request.requestId,
      code: "MAP_NAVIGATION_UNAVAILABLE",
      generation: request.generation,
    });
    return;
  }
  cancelledPathRequestIds.delete(request.requestId);
  try {
    const hexIds = await findPathInNavigationArtifact(
      configuredNavigation,
      request.fromHexId,
      request.toHexId,
      request.mode,
      {
        isCancelled: () =>
          request.generation !== activeGeneration ||
          cancelledPathRequestIds.has(request.requestId),
      },
    );
    if (
      request.generation !== activeGeneration ||
      cancelledPathRequestIds.delete(request.requestId)
    )
      return;
    post({
      type: "pathReady",
      requestId: request.requestId,
      hexIds,
      generation: request.generation,
    });
  } catch {
    if (
      request.generation !== activeGeneration ||
      cancelledPathRequestIds.delete(request.requestId)
    )
      return;
    post({
      type: "pathFailed",
      requestId: request.requestId,
      code: "MAP_PATH_FAILED",
      generation: request.generation,
    });
  }
}

async function fetchJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<{ value: T; timing: HexMapWorkerJsonTiming }> {
  const fetchStartedAt = performance.now();
  const response = await fetch(url, { signal });
  const headersReceivedAt = performance.now();
  if (!response.ok) {
    let code =
      response.status === 404
        ? "MAP_CHUNK_NOT_FOUND"
        : "MAP_ARTIFACT_UNAVAILABLE";
    try {
      const payload = (await response.json()) as { code?: unknown };
      if (typeof payload.code === "string") code = payload.code;
    } catch {
      // Stable status-derived code remains available when a proxy returns non-JSON.
    }
    throw new MapWorkerFetchError(code);
  }
  const body = await response.arrayBuffer();
  const bodyReadAt = performance.now();
  const jsonText = new TextDecoder().decode(body);
  const decodedAt = performance.now();
  const value = JSON.parse(jsonText) as T;
  const parsedAt = performance.now();
  const networkSizes = readResourceNetworkSizes(response.url);
  return {
    value,
    timing: {
      fetchMs: headersReceivedAt - fetchStartedAt,
      downloadMs: bodyReadAt - headersReceivedAt,
      decodeMs: decodedAt - bodyReadAt,
      parseIndexMs: parsedAt - decodedAt,
      decodedBytes: body.byteLength,
      ...networkSizes,
    },
  };
}

function readResourceNetworkSizes(url: string): {
  transferBytes: number;
  encodedBodyBytes: number;
} {
  const entries = performance.getEntriesByName(url, "resource");
  const entry = entries.at(-1) as PerformanceResourceTiming | undefined;
  return entry
    ? {
        transferBytes: entry.transferSize,
        encodedBodyBytes: entry.encodedBodySize,
      }
    : { transferBytes: -1, encodedBodyBytes: -1 };
}

class MapWorkerFetchError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function resolveFetchErrorCode(error: unknown): string {
  if (error instanceof MapWorkerFetchError) return error.code;
  return "MAP_ARTIFACT_UNAVAILABLE";
}

function reportEvicted(chunkIds: HexChunkId[]): void {
  for (const chunkId of chunkIds) {
    if (desiredChunkIdSet.has(chunkId)) suppressedChunkIds.add(chunkId);
  }
  if (chunkIds.length > 0)
    post({ type: "chunksEvicted", chunkIds, generation: activeGeneration });
}

function postCacheStats(): void {
  post({
    type: "cacheStats",
    residentChunks: cache.size,
    cacheBytes: cache.bytes,
    generation: activeGeneration,
  });
}

function post(
  message: HexMapStreamingWorkerResponse,
  transfer: Transferable[] = [],
): void {
  self.postMessage(message, transfer);
}

function abortInFlightRequests(): void {
  navigationController?.abort();
  navigationController = null;
  navigationRequestGeneration = null;
  for (const controller of inFlight.values()) controller.abort();
  inFlight.clear();
}

function createChunkCache(): BoundedChunkLru<HexChunkId, HexMapClientChunk> {
  const mobile =
    /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ||
    navigator.hardwareConcurrency <= 4;
  return new BoundedChunkLru(
    mobile ? MOBILE_CHUNK_CACHE_LIMITS : DESKTOP_CHUNK_CACHE_LIMITS,
  );
}

function estimateChunkBytes(chunk: HexMapClientChunk): number {
  return new TextEncoder().encode(JSON.stringify(chunk)).byteLength;
}
