import type { WorldDelta } from "@arcanorum/shared";

export type WsDeltaSizeMetrics = {
  totalMessages: number;
  totalCompactBytes: number;
  totalBaselineBytes: number;
  maxCompactBytes: number;
  maxBaselineBytes: number;
  lastCompactBytes: number;
  lastBaselineBytes: number;
  lastTurnId: number | null;
  lastStateVersion: number | null;
  updatedAtIso: string | null;
};

export type WorldDeltaMemoryStatus = {
  memoryDepth: number;
  memoryOldestWorldStateVersion: number | null;
  memoryNewestWorldStateVersion: number | null;
};

export function createEmptyWsDeltaSizeMetrics(): WsDeltaSizeMetrics {
  return {
    totalMessages: 0,
    totalCompactBytes: 0,
    totalBaselineBytes: 0,
    maxCompactBytes: 0,
    maxBaselineBytes: 0,
    lastCompactBytes: 0,
    lastBaselineBytes: 0,
    lastTurnId: null,
    lastStateVersion: null,
    updatedAtIso: null,
  };
}

export function resetWsDeltaSizeMetrics(metrics: WsDeltaSizeMetrics): void {
  Object.assign(metrics, createEmptyWsDeltaSizeMetrics());
}

export function captureWsDeltaSizeMetrics(params: {
  metrics: WsDeltaSizeMetrics;
  compactPayload: WorldDelta;
  baselinePayload?: unknown;
  baselinePayloadFactory?: () => unknown;
  captureBaselineBytes?: boolean;
  nowIso?: string;
}): void {
  const compactBytes = Buffer.byteLength(
    JSON.stringify(params.compactPayload),
    "utf8",
  );
  const shouldCaptureBaselineBytes = params.captureBaselineBytes ?? true;
  const baselineBytes = shouldCaptureBaselineBytes
    ? Buffer.byteLength(
      JSON.stringify(params.baselinePayload ?? params.baselinePayloadFactory?.()),
      "utf8",
    )
    : 0;
  params.metrics.totalMessages += 1;
  params.metrics.totalCompactBytes += compactBytes;
  params.metrics.totalBaselineBytes += baselineBytes;
  params.metrics.maxCompactBytes = Math.max(
    params.metrics.maxCompactBytes,
    compactBytes,
  );
  params.metrics.maxBaselineBytes = Math.max(
    params.metrics.maxBaselineBytes,
    baselineBytes,
  );
  params.metrics.lastCompactBytes = compactBytes;
  params.metrics.lastBaselineBytes = baselineBytes;
  params.metrics.lastTurnId = params.compactPayload.turnId;
  params.metrics.lastStateVersion = params.compactPayload.worldStateVersion;
  params.metrics.updatedAtIso = params.nowIso ?? new Date().toISOString();
}

export function pushWorldDeltaToHistory(params: {
  history: WorldDelta[];
  delta: WorldDelta;
  maxHistory: number;
}): void {
  params.history.push(params.delta);
  const maxHistory = Math.max(0, Math.floor(params.maxHistory));
  if (params.history.length > maxHistory) {
    params.history.splice(0, params.history.length - maxHistory);
  }
}

export function replaceWorldDeltaHistory(
  history: WorldDelta[],
  deltas: WorldDelta[],
): void {
  history.splice(
    0,
    history.length,
    ...[...deltas].sort(
      (left, right) => left.worldStateVersion - right.worldStateVersion,
    ),
  );
}

export function clearWorldDeltaHistory(history: WorldDelta[]): void {
  history.splice(0, history.length);
}

export function getWorldDeltaMemoryStatus(
  history: WorldDelta[],
): WorldDeltaMemoryStatus {
  return {
    memoryDepth: history.length,
    memoryOldestWorldStateVersion: history[0]?.worldStateVersion ?? null,
    memoryNewestWorldStateVersion:
      history[history.length - 1]?.worldStateVersion ?? null,
  };
}

export function getReplayDeltasFromVersion(params: {
  history: WorldDelta[];
  fromWorldStateVersion: number;
  currentWorldStateVersion: number;
}): { ok: true; deltas: WorldDelta[] } | { ok: false } {
  if (params.fromWorldStateVersion >= params.currentWorldStateVersion) {
    return { ok: true, deltas: [] };
  }

  const firstReplayVersion = params.fromWorldStateVersion + 1;
  const firstReplayIndex = findFirstDeltaIndexAtOrAfterVersion(
    params.history,
    firstReplayVersion,
  );
  if (firstReplayIndex == null) {
    return { ok: false };
  }
  const firstDelta = params.history[firstReplayIndex];
  if (!firstDelta || firstDelta.worldStateVersion !== firstReplayVersion) {
    return { ok: false };
  }

  const deltas: WorldDelta[] = [];
  for (
    let index = firstReplayIndex;
    index < params.history.length;
    index += 1
  ) {
    const delta = params.history[index];
    if (!delta) return { ok: false };
    const expectedVersion = firstReplayVersion + deltas.length;
    if (delta.worldStateVersion !== expectedVersion) {
      return { ok: false };
    }
    deltas.push(delta);
    if (delta.worldStateVersion === params.currentWorldStateVersion) {
      return { ok: true, deltas };
    }
  }

  return { ok: false };
}

function findFirstDeltaIndexAtOrAfterVersion(
  history: WorldDelta[],
  targetVersion: number,
): number | null {
  let low = 0;
  let high = history.length - 1;
  let result: number | null = null;

  while (low <= high) {
    const midpoint = Math.floor((low + high) / 2);
    const version =
      history[midpoint]?.worldStateVersion ?? Number.POSITIVE_INFINITY;
    if (version >= targetVersion) {
      result = midpoint;
      high = midpoint - 1;
    } else {
      low = midpoint + 1;
    }
  }

  return result;
}
