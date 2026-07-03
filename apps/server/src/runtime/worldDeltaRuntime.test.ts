import type { WorldDelta } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import {
  captureWsDeltaSizeMetrics,
  clearWorldDeltaHistory,
  createEmptyWsDeltaSizeMetrics,
  getReplayDeltasFromVersion,
  getWorldDeltaMemoryStatus,
  pushWorldDeltaToHistory,
  replaceWorldDeltaHistory,
  resetWsDeltaSizeMetrics,
} from "./worldDeltaRuntime";

describe("worldDeltaRuntime", () => {
  it("keeps bounded delta history and reports memory status", () => {
    const history: WorldDelta[] = [];

    pushWorldDeltaToHistory({ history, delta: makeDelta(2), maxHistory: 2 });
    pushWorldDeltaToHistory({ history, delta: makeDelta(3), maxHistory: 2 });
    pushWorldDeltaToHistory({ history, delta: makeDelta(4), maxHistory: 2 });

    expect(history.map((delta) => delta.worldStateVersion)).toEqual([3, 4]);
    expect(getWorldDeltaMemoryStatus(history)).toEqual({
      memoryDepth: 2,
      memoryOldestWorldStateVersion: 3,
      memoryNewestWorldStateVersion: 4,
    });

    replaceWorldDeltaHistory(history, [makeDelta(8), makeDelta(7)]);
    expect(history.map((delta) => delta.worldStateVersion)).toEqual([7, 8]);
    clearWorldDeltaHistory(history);
    expect(getWorldDeltaMemoryStatus(history)).toEqual({
      memoryDepth: 0,
      memoryOldestWorldStateVersion: null,
      memoryNewestWorldStateVersion: null,
    });
  });

  it("returns replay deltas only when history is continuous through current version", () => {
    const history = [makeDelta(2), makeDelta(3), makeDelta(4)];

    expect(
      getReplayDeltasFromVersion({
        history,
        fromWorldStateVersion: 1,
        currentWorldStateVersion: 4,
      }),
    ).toEqual({
      ok: true,
      deltas: history,
    });
    expect(
      getReplayDeltasFromVersion({
        history,
        fromWorldStateVersion: 4,
        currentWorldStateVersion: 4,
      }),
    ).toEqual({
      ok: true,
      deltas: [],
    });
    expect(
      getReplayDeltasFromVersion({
        history: [makeDelta(2), makeDelta(4)],
        fromWorldStateVersion: 1,
        currentWorldStateVersion: 4,
      }),
    ).toEqual({
      ok: false,
    });
    expect(
      getReplayDeltasFromVersion({
        history,
        fromWorldStateVersion: 1,
        currentWorldStateVersion: 5,
      }),
    ).toEqual({
      ok: false,
    });
  });

  it("uses ordered in-memory history and rejects unordered replay gaps", () => {
    const orderedHistory = [
      makeDelta(2),
      makeDelta(3),
      makeDelta(4),
      makeDelta(5),
    ];

    expect(
      getReplayDeltasFromVersion({
        history: orderedHistory,
        fromWorldStateVersion: 3,
        currentWorldStateVersion: 5,
      }),
    ).toEqual({
      ok: true,
      deltas: [orderedHistory[2], orderedHistory[3]],
    });
    expect(
      getReplayDeltasFromVersion({
        history: [makeDelta(3), makeDelta(2), makeDelta(4)],
        fromWorldStateVersion: 1,
        currentWorldStateVersion: 4,
      }),
    ).toEqual({
      ok: false,
    });
  });

  it("skips lazy baseline size work when baseline capture is disabled", () => {
    const metrics = createEmptyWsDeltaSizeMetrics();
    const compactPayload = makeDelta(2);
    const baselinePayloadFactory = vi.fn(() => ({ changes: compactPayload.c, verbose: true }));

    captureWsDeltaSizeMetrics({
      metrics,
      compactPayload,
      baselinePayloadFactory,
      captureBaselineBytes: false,
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(baselinePayloadFactory).not.toHaveBeenCalled();
    expect(metrics.lastCompactBytes).toBeGreaterThan(0);
    expect(metrics.lastBaselineBytes).toBe(0);
    expect(metrics.totalBaselineBytes).toBe(0);
  });

  it("captures and resets websocket delta size metrics", () => {
    const metrics = createEmptyWsDeltaSizeMetrics();
    const compactPayload = makeDelta(2, {
      c: {
        "country:a": {
          culture: 1,
          science: 0,
          religion: 0,
          colonization: 0,
          construction: 0,
          ducats: 0,
          gold: 0,
        },
      },
    });
    const baselinePayload = { changes: compactPayload.c, verbose: true };

    captureWsDeltaSizeMetrics({
      metrics,
      compactPayload,
      baselinePayload,
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(metrics.totalMessages).toBe(1);
    expect(metrics.lastTurnId).toBe(1);
    expect(metrics.lastStateVersion).toBe(2);
    expect(metrics.lastCompactBytes).toBeGreaterThan(0);
    expect(metrics.lastBaselineBytes).toBeGreaterThan(0);
    expect(metrics.updatedAtIso).toBe("2026-01-01T00:00:00.000Z");

    resetWsDeltaSizeMetrics(metrics);
    expect(metrics).toEqual(createEmptyWsDeltaSizeMetrics());
  });
});

function makeDelta(
  worldStateVersion: number,
  overrides?: Partial<WorldDelta>,
): WorldDelta {
  return {
    type: "WORLD_DELTA",
    turnId: 1,
    worldStateVersion,
    mask: 0,
    rejectedOrders: [],
    ...overrides,
  };
}
