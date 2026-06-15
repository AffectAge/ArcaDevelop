import type express from "express";
import type { RouteAuth } from "../security/routeAuth";

export type WsDeltaSizeMetricsSnapshot = {
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

export type WorldDeltaLogDbStatus = {
  dbDepth: number;
  dbOldestWorldStateVersion: number | null;
  dbNewestWorldStateVersion: number | null;
};

export type WorldDeltaMemoryStatus = {
  memoryDepth: number;
  memoryOldestWorldStateVersion: number | null;
  memoryNewestWorldStateVersion: number | null;
};

export type AdminDiagnosticsRoutesDependencies = {
  routeAuth: RouteAuth;
  getWsDeltaSizeMetrics: () => WsDeltaSizeMetricsSnapshot;
  resetWsDeltaSizeMetrics: () => void;
  getWorldDeltaLogDbStatus: () => Promise<WorldDeltaLogDbStatus>;
  getWorldDeltaMemoryStatus: () => WorldDeltaMemoryStatus;
  getWorldStateVersion: () => number;
  maxPersistedWorldDeltaLog: number;
  maxReplayInMemory: number;
};

export function registerAdminDiagnosticsRoutes(
  app: express.Express,
  deps: AdminDiagnosticsRoutesDependencies,
): void {
  app.get("/admin/ws-delta-metrics", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    return res.json(buildWsDeltaMetricsResponse(deps.getWsDeltaSizeMetrics()));
  });

  app.get("/admin/world-delta-log/status", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const db = await deps.getWorldDeltaLogDbStatus();
    const memory = deps.getWorldDeltaMemoryStatus();
    return res.json({
      dbDepth: db.dbDepth,
      dbOldestWorldStateVersion: db.dbOldestWorldStateVersion,
      dbNewestWorldStateVersion: db.dbNewestWorldStateVersion,
      memoryDepth: memory.memoryDepth,
      memoryOldestWorldStateVersion: memory.memoryOldestWorldStateVersion,
      memoryNewestWorldStateVersion: memory.memoryNewestWorldStateVersion,
      currentWorldStateVersion: deps.getWorldStateVersion(),
      maxPersisted: deps.maxPersistedWorldDeltaLog,
      maxReplayInMemory: deps.maxReplayInMemory,
    });
  });

  app.post("/admin/ws-delta-metrics/reset", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    deps.resetWsDeltaSizeMetrics();
    return res.json({ ok: true });
  });
}

export function buildWsDeltaMetricsResponse(metrics: WsDeltaSizeMetricsSnapshot): WsDeltaSizeMetricsSnapshot & {
  avgCompactBytes: number;
  avgBaselineBytes: number;
  savedBytes: number;
  savedPercent: number;
} {
  const avgCompactBytes = metrics.totalMessages > 0 ? metrics.totalCompactBytes / metrics.totalMessages : 0;
  const avgBaselineBytes = metrics.totalMessages > 0 ? metrics.totalBaselineBytes / metrics.totalMessages : 0;
  const savedBytes = Math.max(0, metrics.totalBaselineBytes - metrics.totalCompactBytes);
  const savedPercent =
    metrics.totalBaselineBytes > 0 ? Number(((savedBytes / metrics.totalBaselineBytes) * 100).toFixed(2)) : 0;
  return {
    ...metrics,
    avgCompactBytes: Number(avgCompactBytes.toFixed(2)),
    avgBaselineBytes: Number(avgBaselineBytes.toFixed(2)),
    savedBytes,
    savedPercent,
  };
}
