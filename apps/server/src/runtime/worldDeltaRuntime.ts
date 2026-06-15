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
  baselinePayload: unknown;
  nowIso?: string;
}): void {
  const compactBytes = Buffer.byteLength(JSON.stringify(params.compactPayload), "utf8");
  const baselineBytes = Buffer.byteLength(JSON.stringify(params.baselinePayload), "utf8");
  params.metrics.totalMessages += 1;
  params.metrics.totalCompactBytes += compactBytes;
  params.metrics.totalBaselineBytes += baselineBytes;
  params.metrics.maxCompactBytes = Math.max(params.metrics.maxCompactBytes, compactBytes);
  params.metrics.maxBaselineBytes = Math.max(params.metrics.maxBaselineBytes, baselineBytes);
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

export function replaceWorldDeltaHistory(history: WorldDelta[], deltas: WorldDelta[]): void {
  history.splice(0, history.length, ...deltas);
}

export function clearWorldDeltaHistory(history: WorldDelta[]): void {
  history.splice(0, history.length);
}

export function getWorldDeltaMemoryStatus(history: WorldDelta[]): WorldDeltaMemoryStatus {
  return {
    memoryDepth: history.length,
    memoryOldestWorldStateVersion: history[0]?.worldStateVersion ?? null,
    memoryNewestWorldStateVersion: history[history.length - 1]?.worldStateVersion ?? null,
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
  const deltas = params.history
    .filter((delta) => delta.worldStateVersion > params.fromWorldStateVersion)
    .sort((a, b) => a.worldStateVersion - b.worldStateVersion);
  if (deltas.length === 0) {
    return { ok: false };
  }
  if (deltas[0]?.worldStateVersion !== params.fromWorldStateVersion + 1) {
    return { ok: false };
  }
  for (let i = 1; i < deltas.length; i += 1) {
    const previous = deltas[i - 1];
    const current = deltas[i];
    if (!previous || !current || current.worldStateVersion !== previous.worldStateVersion + 1) {
      return { ok: false };
    }
  }
  if (deltas[deltas.length - 1]?.worldStateVersion !== params.currentWorldStateVersion) {
    return { ok: false };
  }
  return { ok: true, deltas };
}
