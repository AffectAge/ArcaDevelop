import type { WorldBase, WorldDelta, WsOutMessage } from "@arcanorum/shared";
import {
  cloneDirtyWorldBaseSectionSnapshot as cloneDirtyWorldBaseSectionSnapshotFromDiff,
  prepareWorldDeltaBroadcast,
  type WorldBaseSectionSnapshot,
} from "./worldDeltaDiff";
import {
  captureWsDeltaSizeMetrics as captureWsDeltaSizeMetricsInRuntime,
  getReplayDeltasFromVersion as getReplayDeltasFromVersionFromRuntime,
  pushWorldDeltaToHistory as pushWorldDeltaToHistoryInRuntime,
  resetWsDeltaSizeMetrics as resetWsDeltaSizeMetricsInRuntime,
  type WsDeltaSizeMetrics,
} from "./worldDeltaRuntime";

type WorldDeltaBroadcastRuntimeParams = {
  getWorldBase: () => WorldBase;
  getTurnId: () => number;
  getWorldStateVersion: () => number;
  setWorldStateVersion: (version: number) => void;
  getHistory: () => WorldDelta[];
  getMetrics: () => WsDeltaSizeMetrics;
  maxHistory: number;
  cloneWorldBaseSectionSnapshot: (params: { worldBase: WorldBase; turnId: number; mask: number }) => WorldBaseSectionSnapshot;
  saveWorldDeltaPersistent: (delta: WorldDelta) => void;
  broadcast: (message: WsOutMessage) => void;
  isEqualRegionPopulation: Parameters<typeof prepareWorldDeltaBroadcast>[0]["isEqualRegionPopulation"];
};

export function createWorldDeltaBroadcastRuntime(params: WorldDeltaBroadcastRuntimeParams) {
  function cloneWorldBaseSectionSnapshot(mask: number): WorldBaseSectionSnapshot {
    return params.cloneWorldBaseSectionSnapshot({
      worldBase: params.getWorldBase(),
      turnId: params.getTurnId(),
      mask,
    });
  }

  function cloneDirtyWorldBaseSectionSnapshot(requestedMask: number, dirtyMask: number): WorldBaseSectionSnapshot {
    return cloneDirtyWorldBaseSectionSnapshotFromDiff({
      worldBase: params.getWorldBase(),
      turnId: params.getTurnId(),
      requestedMask,
      dirtyMask,
    });
  }

  function resetWsDeltaSizeMetrics(): void {
    resetWsDeltaSizeMetricsInRuntime(params.getMetrics());
  }

  function pushWorldDeltaToHistory(delta: WorldDelta): void {
    pushWorldDeltaToHistoryInRuntime({
      history: params.getHistory(),
      delta,
      maxHistory: params.maxHistory,
    });
  }

  function getReplayDeltasFromVersion(fromWorldStateVersion: number): { ok: true; deltas: WorldDelta[] } | { ok: false } {
    return getReplayDeltasFromVersionFromRuntime({
      history: params.getHistory(),
      fromWorldStateVersion,
      currentWorldStateVersion: params.getWorldStateVersion(),
    });
  }

  function captureWsDeltaSizeMetrics(input: {
    compactPayload: WorldDelta;
    baselinePayload?: unknown;
    baselinePayloadFactory?: () => unknown;
    captureBaselineBytes?: boolean;
  }): void {
    captureWsDeltaSizeMetricsInRuntime({
      metrics: params.getMetrics(),
      compactPayload: input.compactPayload,
      baselinePayload: input.baselinePayload,
      baselinePayloadFactory: input.baselinePayloadFactory,
      captureBaselineBytes: input.captureBaselineBytes,
    });
  }

  function broadcastWorldDeltaFromSectionSnapshot(
    previous: WorldBaseSectionSnapshot,
    rejectedOrders: WorldDelta["rejectedOrders"] = [],
  ): void {
    const next = {
      ...params.getWorldBase(),
      turnId: params.getTurnId(),
    };
    const prepared = prepareWorldDeltaBroadcast({
      previous,
      next,
      turnId: params.getTurnId(),
      currentWorldStateVersion: params.getWorldStateVersion(),
      rejectedOrders,
      isEqualRegionPopulation: params.isEqualRegionPopulation,
      buildBaselinePayload: false,
    });
    if (!prepared.ok) {
      return;
    }

    params.setWorldStateVersion(prepared.nextWorldStateVersion);
    const { payload } = prepared;
    captureWsDeltaSizeMetrics({
      compactPayload: payload,
      baselinePayloadFactory: prepared.buildBaselinePayload,
      captureBaselineBytes: false,
    });
    pushWorldDeltaToHistory(payload);
    params.saveWorldDeltaPersistent(payload);
    params.broadcast(payload);
  }

  return {
    cloneWorldBaseSectionSnapshot,
    cloneDirtyWorldBaseSectionSnapshot,
    resetWsDeltaSizeMetrics,
    pushWorldDeltaToHistory,
    getReplayDeltasFromVersion,
    captureWsDeltaSizeMetrics,
    broadcastWorldDeltaFromSectionSnapshot,
  };
}
