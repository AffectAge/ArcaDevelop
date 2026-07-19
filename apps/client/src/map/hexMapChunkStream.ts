import type {
  HexChunkId,
  HexId,
  HexMapClientBounds,
  HexMapClientChunk,
  HexMapClientManifest,
  HexMapPathRequestMode,
} from "@arcanorum/shared";
import type { HexCamera } from "./hexCamera";
import { axialToPixel, worldPixelWidth } from "./hexGeometry";
import type {
  HexMapChunkPayload,
  HexMapChunkStreamTiming,
  HexMapManifestTiming,
  HexMapStreamingWorkerRequest,
  HexMapStreamingWorkerResponse,
} from "./hexMapStreamingProtocol";

export type HexMapChunkSelection = {
  visibleChunkIds: HexChunkId[];
  desiredChunkIds: HexChunkId[];
};

export type HexMapViewportSelectionEvent = HexMapChunkSelection & {
  generation: number;
  visibleSetRevision: number;
};

export type HexMapVisibleChunksReadyEvent = {
  visibleChunkIds: HexChunkId[];
  generation: number;
  visibleSetRevision: number;
};

export type HexMapLoadFailureCode =
  | "MAP_ARTIFACT_UNAVAILABLE"
  | "MAP_VERSION_MISMATCH"
  | "MAP_CHUNK_NOT_FOUND"
  | "MAP_WORKER_FAILED";

export type HexMapChunkStreamCallbacks = {
  onChunkReady: (payload: HexMapChunkPayload) => void;
  onChunksEvicted: (chunkIds: HexChunkId[]) => void;
  onCacheStats?: (stats: {
    residentChunks: number;
    cacheBytes: number;
  }) => void;
  onPhaseTiming?: (timing: HexMapChunkStreamTiming) => void;
  onViewportSelection?: (event: HexMapViewportSelectionEvent) => void;
  onVisibleChunksReady?: (event: HexMapVisibleChunksReadyEvent) => void;
  onError?: (code: HexMapLoadFailureCode) => void;
  onVersionMismatch?: () => void;
};

type WorkerLike = Pick<Worker, "postMessage" | "terminate"> & {
  onmessage:
    | ((event: MessageEvent<HexMapStreamingWorkerResponse>) => void)
    | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

type PendingPath = {
  resolve: (hexIds: HexId[]) => void;
  reject: (error: Error) => void;
};

type DeferredPathRequest = Extract<
  HexMapStreamingWorkerRequest,
  { type: "findPath" }
>;

export type HexMapChunkStreamOptions = {
  workerFactory?: () => WorkerLike;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
};

export type HexMapChunkStreamPrepareOptions = {
  maxBufferedChunks: number;
};

export async function fetchHexMapClientManifest(
  apiBase: string,
  signal?: AbortSignal,
  onTiming?: (timing: HexMapManifestTiming) => void,
): Promise<HexMapClientManifest> {
  const fetchStartedAt = performance.now();
  const response = await fetch(
    `${apiBase.replace(/\/$/, "")}/hex-map/manifest`,
    { signal },
  );
  const headersReceivedAt = performance.now();
  if (!response.ok) throw new Error(await resolveMapResponseCode(response));
  const body = await response.arrayBuffer();
  const bodyReadAt = performance.now();
  const text = new TextDecoder().decode(body);
  const decodedAt = performance.now();
  const manifest = JSON.parse(text) as HexMapClientManifest;
  const parsedAt = performance.now();
  const networkSizes = readResourceNetworkSizes(response.url);
  if (
    manifest.formatVersion !== 1 ||
    !manifest.artifactVersion ||
    !Array.isArray(manifest.chunks)
  ) {
    throw new Error("MAP_ARTIFACT_UNAVAILABLE");
  }
  onTiming?.({
    scope: "manifest",
    fetchMs: headersReceivedAt - fetchStartedAt,
    downloadMs: bodyReadAt - headersReceivedAt,
    decodeMs: decodedAt - bodyReadAt,
    parseIndexMs: parsedAt - decodedAt,
    decodedBytes: body.byteLength,
    ...networkSizes,
  });
  return manifest;
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

export class HexMapChunkStream {
  private readonly worker: WorkerLike;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private generation = 0;
  private manifest: HexMapClientManifest | null = null;
  private callbacks: HexMapChunkStreamCallbacks | null = null;
  private chunkQueue: HexMapChunkPayload[] = [];
  private uploadFrame: number | null = null;
  private nextPathRequestId = 1;
  private activePathRequestId: number | null = null;
  private lastDesiredKey = "";
  private visibleChunkKey = "";
  private visibleReadyKey = "";
  private visibleSetRevision = 0;
  private visibleChunkIds = new Set<HexChunkId>();
  private readonly workerReadyChunkIds = new Set<HexChunkId>();
  private readonly uploadedChunkIds = new Set<HexChunkId>();
  private lastCityKey = "";
  private readonly pendingPaths = new Map<number, PendingPath>();
  private workerConfigured = false;
  private deferredPathRequest: DeferredPathRequest | null = null;
  private preparedConfigurationKey: string | null = null;
  private preparedChunkLimit = 0;
  private preparedQueueOverflow = false;
  private pendingPhaseTimings: HexMapChunkStreamTiming[] = [];
  private pendingCacheStats: {
    residentChunks: number;
    cacheBytes: number;
  } | null = null;
  private pendingEvictedChunkIds = new Set<HexChunkId>();
  private pendingFailure:
    | { type: "error"; code: HexMapLoadFailureCode }
    | { type: "version-mismatch" }
    | null = null;
  private lastViewportSelection: HexMapViewportSelectionEvent | null = null;
  private visibleWorkerArrivalCount = 0;
  private visibleUploadCount = 0;

  constructor(options: HexMapChunkStreamOptions = {}) {
    markHexMapStreamPhase("arc-map-stream-constructed");
    this.worker =
      options.workerFactory?.() ??
      new Worker(new URL("./hexMapStreaming.worker.ts", import.meta.url), {
        type: "module",
      });
    this.requestFrame =
      options.requestFrame ??
      ((callback) => globalThis.requestAnimationFrame(callback));
    this.cancelFrame =
      options.cancelFrame ??
      ((handle) => globalThis.cancelAnimationFrame(handle));
    this.worker.onmessage = (event) => this.handleWorkerMessage(event.data);
    this.worker.onerror = () => this.publishFailure("MAP_WORKER_FAILED");
  }

  prepare(
    apiBase: string,
    manifest: HexMapClientManifest,
    camera: HexCamera,
    viewport: { width: number; height: number },
    options: HexMapChunkStreamPrepareOptions,
  ): void {
    if (this.callbacks != null) return;
    const maxBufferedChunks = Math.max(
      1,
      Math.floor(options.maxBufferedChunks),
    );
    const configurationKey = buildConfigurationKey(apiBase, manifest);
    if (
      this.preparedConfigurationKey !== configurationKey ||
      this.preparedQueueOverflow
    ) {
      this.startConfiguration(
        apiBase,
        manifest,
        null,
        new Set(),
        configurationKey,
        maxBufferedChunks,
      );
    }
    this.setViewport(camera, viewport);
  }

  configure(
    apiBase: string,
    manifest: HexMapClientManifest,
    callbacks: HexMapChunkStreamCallbacks,
    initialCityHexIds: ReadonlySet<HexId> = new Set(),
  ): void {
    const configurationKey = buildConfigurationKey(apiBase, manifest);
    if (
      this.preparedConfigurationKey === configurationKey &&
      !this.preparedQueueOverflow &&
      this.callbacks == null
    ) {
      this.preparedConfigurationKey = null;
      this.callbacks = callbacks;
      this.setCityHexIds(initialCityHexIds);
      this.flushPreparedEvents();
      this.scheduleNextUpload();
      return;
    }
    this.startConfiguration(
      apiBase,
      manifest,
      callbacks,
      initialCityHexIds,
      null,
      0,
    );
  }

  private startConfiguration(
    apiBase: string,
    manifest: HexMapClientManifest,
    callbacks: HexMapChunkStreamCallbacks | null,
    initialCityHexIds: ReadonlySet<HexId>,
    preparedConfigurationKey: string | null,
    preparedChunkLimit: number,
  ): void {
    markHexMapStreamPhase("arc-map-stream-configured");
    this.cancelActivePath();
    this.rejectPendingPaths("MAP_VERSION_MISMATCH");
    this.clearUploadQueue();
    this.generation += 1;
    this.manifest = manifest;
    this.callbacks = callbacks;
    this.preparedConfigurationKey = preparedConfigurationKey;
    this.preparedChunkLimit = preparedChunkLimit;
    this.preparedQueueOverflow = false;
    this.pendingPhaseTimings = [];
    this.pendingCacheStats = null;
    this.pendingEvictedChunkIds.clear();
    this.pendingFailure = null;
    this.lastViewportSelection = null;
    this.visibleWorkerArrivalCount = 0;
    this.visibleUploadCount = 0;
    this.lastDesiredKey = "";
    this.visibleChunkKey = "";
    this.visibleReadyKey = "";
    this.visibleSetRevision = 0;
    this.visibleChunkIds.clear();
    this.workerReadyChunkIds.clear();
    this.uploadedChunkIds.clear();
    this.workerConfigured = false;
    this.deferredPathRequest = null;
    const cityHexIds = [...initialCityHexIds].sort((left, right) =>
      left.localeCompare(right),
    );
    this.lastCityKey = cityHexIds.join("|");
    this.post({
      type: "configure",
      apiBase,
      manifest,
      cityHexIds,
      generation: this.generation,
    });
  }

  setCityHexIds(cityIds: ReadonlySet<HexId>): void {
    const cityHexIds = [...cityIds].sort((left, right) =>
      left.localeCompare(right),
    );
    const nextKey = cityHexIds.join("|");
    if (nextKey === this.lastCityKey) return;
    this.lastCityKey = nextKey;
    this.post({
      type: "setCityHexIds",
      cityHexIds,
      generation: this.generation,
    });
  }

  setViewport(
    camera: HexCamera,
    viewport: { width: number; height: number },
  ): HexMapChunkSelection {
    if (!this.manifest) return { visibleChunkIds: [], desiredChunkIds: [] };
    const selection = selectHexMapChunksForViewport(
      this.manifest,
      camera,
      viewport,
    );
    const nextVisibleKey = selection.visibleChunkIds.join(",");
    if (nextVisibleKey !== this.visibleChunkKey) {
      this.visibleChunkKey = nextVisibleKey;
      this.visibleReadyKey = "";
      this.visibleChunkIds = new Set(selection.visibleChunkIds);
      this.visibleSetRevision += 1;
      this.lastViewportSelection = {
        visibleChunkIds: [...selection.visibleChunkIds],
        desiredChunkIds: [...selection.desiredChunkIds],
        generation: this.generation,
        visibleSetRevision: this.visibleSetRevision,
      };
      this.callbacks?.onViewportSelection?.(this.lastViewportSelection);
      this.markVisibleWorkerChunksReady();
    }
    this.notifyVisibleChunksReady();
    const nextKey = `${selection.visibleChunkIds.join(",")}|${selection.desiredChunkIds.join(",")}`;
    if (nextKey === this.lastDesiredKey) return selection;
    this.lastDesiredKey = nextKey;
    markHexMapStreamPhase("arc-map-stream-viewport-posted");
    this.post({
      type: "setDesiredChunkIds",
      chunkIds: selection.desiredChunkIds,
      pinnedChunkIds: selection.visibleChunkIds,
      generation: this.generation,
    });
    return selection;
  }

  requestPath(
    mode: HexMapPathRequestMode,
    fromHexId: HexId,
    toHexId: HexId,
  ): Promise<HexId[]> {
    this.cancelActivePath();
    const requestId = this.nextPathRequestId++;
    this.activePathRequestId = requestId;
    const request: DeferredPathRequest = {
      type: "findPath",
      requestId,
      fromHexId,
      toHexId,
      mode,
      generation: this.generation,
    };
    if (this.workerConfigured) this.post(request);
    else this.deferredPathRequest = request;
    return new Promise<HexId[]>((resolve, reject) => {
      this.pendingPaths.set(requestId, { resolve, reject });
    });
  }

  cancelActivePath(): void {
    const requestId = this.activePathRequestId;
    if (requestId == null) return;
    this.activePathRequestId = null;
    if (this.deferredPathRequest?.requestId === requestId)
      this.deferredPathRequest = null;
    else
      this.post({ type: "cancelPath", requestId, generation: this.generation });
    const pending = this.pendingPaths.get(requestId);
    this.pendingPaths.delete(requestId);
    pending?.resolve([]);
  }

  destroy(): void {
    this.cancelActivePath();
    this.rejectPendingPaths("MAP_WORKER_DISPOSED");
    this.clearUploadQueue();
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
    this.callbacks = null;
    this.manifest = null;
    this.preparedConfigurationKey = null;
    this.pendingPhaseTimings = [];
    this.pendingCacheStats = null;
    this.pendingEvictedChunkIds.clear();
    this.pendingFailure = null;
    this.lastViewportSelection = null;
  }

  private handleWorkerMessage(message: HexMapStreamingWorkerResponse): void {
    if (message.generation !== this.generation) return;
    if (message.type === "chunkReady") {
      markHexMapStreamPhase("arc-map-stream-first-worker-chunk");
      this.workerReadyChunkIds.add(message.chunkId);
      if (this.visibleChunkIds.has(message.chunkId)) {
        this.visibleWorkerArrivalCount += 1;
        markHexMapStreamPhase(
          `arc-map-stream-visible-worker-${this.visibleWorkerArrivalCount}`,
        );
      }
      this.markVisibleWorkerChunksReady();
      if (
        this.callbacks == null &&
        this.preparedConfigurationKey != null &&
        this.chunkQueue.length >= this.preparedChunkLimit
      ) {
        this.preparedQueueOverflow = true;
        return;
      }
      this.chunkQueue.push(message.data);
      this.scheduleNextUpload();
      return;
    }
    if (message.type === "configured") {
      this.workerConfigured = true;
      if (this.callbacks) this.callbacks.onPhaseTiming?.(message.timing);
      else this.pendingPhaseTimings.push(message.timing);
      if (this.deferredPathRequest) {
        this.post(this.deferredPathRequest);
        this.deferredPathRequest = null;
      }
      return;
    }
    if (message.type === "chunksEvicted") {
      const evicted = new Set(message.chunkIds);
      this.chunkQueue = this.chunkQueue.filter(
        (payload) => !evicted.has(payload.chunk.id),
      );
      for (const chunkId of evicted) this.uploadedChunkIds.delete(chunkId);
      for (const chunkId of evicted) this.workerReadyChunkIds.delete(chunkId);
      if (this.callbacks) this.callbacks.onChunksEvicted(message.chunkIds);
      else
        for (const chunkId of message.chunkIds)
          this.pendingEvictedChunkIds.add(chunkId);
      return;
    }
    if (message.type === "cacheStats") {
      const stats = {
        residentChunks: message.residentChunks,
        cacheBytes: message.cacheBytes,
      };
      if (this.callbacks) this.callbacks.onCacheStats?.(stats);
      else this.pendingCacheStats = stats;
      return;
    }
    if (message.type === "pathReady" || message.type === "pathFailed") {
      if (message.requestId === -1 && message.type === "pathFailed") {
        if (message.code === "MAP_VERSION_MISMATCH")
          this.publishVersionMismatch();
        else this.publishFailure(normalizeHexMapLoadFailureCode(message.code));
        return;
      }
      const pending = this.pendingPaths.get(message.requestId);
      if (!pending) return;
      this.pendingPaths.delete(message.requestId);
      if (this.activePathRequestId === message.requestId)
        this.activePathRequestId = null;
      if (message.type === "pathReady") pending.resolve(message.hexIds);
      else pending.resolve([]);
      return;
    }
    if (message.type === "chunkFailed") {
      if (message.code === "MAP_VERSION_MISMATCH")
        this.publishVersionMismatch();
      else this.publishFailure(normalizeHexMapLoadFailureCode(message.code));
    }
  }

  private scheduleNextUpload(): void {
    if (
      this.callbacks == null ||
      this.uploadFrame != null ||
      this.chunkQueue.length === 0
    )
      return;
    this.uploadFrame = this.requestFrame(() => {
      this.uploadFrame = null;
      const payload = this.chunkQueue.shift();
      if (payload) {
        markHexMapStreamPhase("arc-map-stream-first-gpu-upload");
        if (this.visibleChunkIds.has(payload.chunk.id)) {
          this.visibleUploadCount += 1;
          markHexMapStreamPhase(
            `arc-map-stream-visible-upload-${this.visibleUploadCount}`,
          );
        }
        const uploadStartedAt = performance.now();
        this.callbacks?.onChunkReady(payload);
        this.callbacks?.onPhaseTiming?.({
          ...payload.timing,
          commitMs: performance.now() - uploadStartedAt,
        });
        this.uploadedChunkIds.add(payload.chunk.id);
        this.notifyVisibleChunksReady();
      }
      this.scheduleNextUpload();
    });
  }

  private clearUploadQueue(): void {
    if (this.uploadFrame != null) this.cancelFrame(this.uploadFrame);
    this.uploadFrame = null;
    this.chunkQueue = [];
  }

  private notifyVisibleChunksReady(): void {
    if (
      this.visibleChunkKey.length === 0 ||
      this.visibleReadyKey === this.visibleChunkKey ||
      [...this.visibleChunkIds].some(
        (chunkId) => !this.uploadedChunkIds.has(chunkId),
      )
    ) {
      return;
    }
    this.visibleReadyKey = this.visibleChunkKey;
    this.callbacks?.onVisibleChunksReady?.({
      visibleChunkIds: [...this.visibleChunkIds],
      generation: this.generation,
      visibleSetRevision: this.visibleSetRevision,
    });
  }

  private markVisibleWorkerChunksReady(): void {
    if (
      this.visibleChunkIds.size > 0 &&
      [...this.visibleChunkIds].every((chunkId) =>
        this.workerReadyChunkIds.has(chunkId),
      )
    ) {
      markHexMapStreamPhase("arc-map-stream-visible-worker-ready");
    }
  }

  private flushPreparedEvents(): void {
    const callbacks = this.callbacks;
    if (!callbacks) return;
    if (this.lastViewportSelection)
      callbacks.onViewportSelection?.(this.lastViewportSelection);
    for (const timing of this.pendingPhaseTimings)
      callbacks.onPhaseTiming?.(timing);
    this.pendingPhaseTimings = [];
    if (this.pendingEvictedChunkIds.size > 0) {
      callbacks.onChunksEvicted([...this.pendingEvictedChunkIds]);
      this.pendingEvictedChunkIds.clear();
    }
    if (this.pendingCacheStats)
      callbacks.onCacheStats?.(this.pendingCacheStats);
    this.pendingCacheStats = null;
    const pendingFailure = this.pendingFailure;
    this.pendingFailure = null;
    if (pendingFailure?.type === "version-mismatch")
      callbacks.onVersionMismatch?.();
    else if (pendingFailure) callbacks.onError?.(pendingFailure.code);
  }

  private publishFailure(code: HexMapLoadFailureCode): void {
    if (this.callbacks) this.callbacks.onError?.(code);
    else this.pendingFailure = { type: "error", code };
  }

  private publishVersionMismatch(): void {
    if (this.callbacks) this.callbacks.onVersionMismatch?.();
    else this.pendingFailure = { type: "version-mismatch" };
  }

  private rejectPendingPaths(code: string): void {
    for (const pending of this.pendingPaths.values())
      pending.reject(new Error(code));
    this.pendingPaths.clear();
  }

  private post(request: HexMapStreamingWorkerRequest): void {
    this.worker.postMessage(request);
  }
}

function buildConfigurationKey(
  apiBase: string,
  manifest: HexMapClientManifest,
): string {
  return JSON.stringify([
    apiBase.replace(/\/$/, ""),
    manifest.formatVersion,
    manifest.artifactVersion,
    manifest.navigation.contentHash,
    manifest.settings,
    manifest.chunks.map(({ id, contentHash }) => [id, contentHash]),
  ]);
}

function markHexMapStreamPhase(name: string): void {
  if (performance.getEntriesByName(name).length > 0) return;
  performance.mark(name);
}

export function selectHexMapChunksForViewport(
  manifest: HexMapClientManifest,
  camera: HexCamera,
  viewport: { width: number; height: number },
): HexMapChunkSelection {
  const visibleRect = {
    left: camera.x - viewport.width / (2 * camera.scale),
    right: camera.x + viewport.width / (2 * camera.scale),
    top: camera.y - viewport.height / (2 * camera.scale),
    bottom: camera.y + viewport.height / (2 * camera.scale),
  };
  const chunkWorldWidth =
    manifest.settings.chunkSize * manifest.settings.hexSize * Math.sqrt(3);
  const chunkWorldHeight =
    manifest.settings.chunkSize * manifest.settings.hexSize * 1.5;
  const overscanRect = {
    left: visibleRect.left - chunkWorldWidth,
    right: visibleRect.right + chunkWorldWidth,
    top: visibleRect.top - chunkWorldHeight,
    bottom: visibleRect.bottom + chunkWorldHeight,
  };
  const wrapWidth = manifest.settings.wrapX
    ? worldPixelWidth(manifest.settings)
    : 0;
  const xOffsets = wrapWidth > 0 ? [-wrapWidth, 0, wrapWidth] : [0];
  const ranked = manifest.chunks
    .map((descriptor) => {
      const bounds = clientBoundsToWorldBounds(
        descriptor.bounds,
        manifest.settings.hexSize,
      );
      const centerY = (bounds.top + bounds.bottom) / 2;
      const copies = xOffsets.map((xOffset) => {
        const shifted = {
          left: bounds.left + xOffset,
          right: bounds.right + xOffset,
          top: bounds.top,
          bottom: bounds.bottom,
        };
        const centerX = (shifted.left + shifted.right) / 2;
        return {
          visible: intersects(shifted, visibleRect),
          overscan: intersects(shifted, overscanRect),
          distance: (centerX - camera.x) ** 2 + (centerY - camera.y) ** 2,
        };
      });
      return {
        id: descriptor.id,
        visible: copies.some((copy) => copy.visible),
        overscan: copies.some((copy) => copy.overscan),
        distance: Math.min(...copies.map((copy) => copy.distance)),
      };
    })
    .filter((entry) => entry.overscan)
    .sort(
      (left, right) =>
        Number(right.visible) - Number(left.visible) ||
        left.distance - right.distance ||
        left.id.localeCompare(right.id),
    );
  return {
    visibleChunkIds: ranked
      .filter((entry) => entry.visible)
      .map((entry) => entry.id),
    desiredChunkIds: ranked.map((entry) => entry.id),
  };
}

function clientBoundsToWorldBounds(
  bounds: HexMapClientBounds,
  hexSize: number,
): { left: number; right: number; top: number; bottom: number } {
  const rows = new Set([
    bounds.minR,
    Math.min(bounds.maxR, bounds.minR + 1),
    Math.max(bounds.minR, bounds.maxR - 1),
    bounds.maxR,
  ]);
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    for (const q of [bounds.minQ, bounds.maxQ]) {
      const point = axialToPixel({ q, r }, hexSize);
      left = Math.min(left, point.x - hexSize);
      right = Math.max(right, point.x + hexSize);
      top = Math.min(top, point.y - hexSize);
      bottom = Math.max(bottom, point.y + hexSize);
    }
  }
  return { left, right, top, bottom };
}

function intersects(
  left: { left: number; right: number; top: number; bottom: number },
  right: { left: number; right: number; top: number; bottom: number },
): boolean {
  return (
    left.right >= right.left &&
    left.left <= right.right &&
    left.bottom >= right.top &&
    left.top <= right.bottom
  );
}

async function resolveMapResponseCode(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { code?: unknown };
    if (typeof payload.code === "string") return payload.code;
  } catch {
    // Status-derived fallback is stable when a proxy returns non-JSON.
  }
  return response.status === 409
    ? "MAP_VERSION_MISMATCH"
    : "MAP_ARTIFACT_UNAVAILABLE";
}

export function normalizeHexMapLoadFailureCode(
  code: unknown,
): HexMapLoadFailureCode {
  if (code === "MAP_VERSION_MISMATCH") return code;
  if (code === "MAP_CHUNK_NOT_FOUND") return code;
  if (code === "MAP_WORKER_FAILED") return code;
  return "MAP_ARTIFACT_UNAVAILABLE";
}

export type { HexMapClientChunk };
