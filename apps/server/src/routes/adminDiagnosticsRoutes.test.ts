import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import { buildWsDeltaMetricsResponse, registerAdminDiagnosticsRoutes } from "./adminDiagnosticsRoutes";

describe("adminDiagnosticsRoutes", () => {
  it("calculates ws delta metric derived values", () => {
    expect(
      buildWsDeltaMetricsResponse({
        totalMessages: 4,
        totalCompactBytes: 100,
        totalBaselineBytes: 400,
        maxCompactBytes: 40,
        maxBaselineBytes: 120,
        lastCompactBytes: 20,
        lastBaselineBytes: 80,
        lastTurnId: 2,
        lastStateVersion: 5,
        updatedAtIso: "now",
      }),
    ).toMatchObject({
      avgCompactBytes: 25,
      avgBaselineBytes: 100,
      savedBytes: 300,
      savedPercent: 75,
    });
  });

  it("serves admin diagnostics through route auth", async () => {
    const reset = vi.fn();
    const routeAuth = createAllowedRouteAuth();
    const app = express();
    registerAdminDiagnosticsRoutes(app, {
      routeAuth,
      getWsDeltaSizeMetrics: () => ({
        totalMessages: 1,
        totalCompactBytes: 20,
        totalBaselineBytes: 50,
        maxCompactBytes: 20,
        maxBaselineBytes: 50,
        lastCompactBytes: 20,
        lastBaselineBytes: 50,
        lastTurnId: 3,
        lastStateVersion: 10,
        updatedAtIso: "now",
      }),
      resetWsDeltaSizeMetrics: reset,
      getWorldDeltaLogDbStatus: async () => ({
        dbDepth: 7,
        dbOldestWorldStateVersion: 4,
        dbNewestWorldStateVersion: 10,
      }),
      getWorldDeltaMemoryStatus: () => ({
        memoryDepth: 3,
        memoryOldestWorldStateVersion: 8,
        memoryNewestWorldStateVersion: 10,
      }),
      getWorldStateVersion: () => 10,
      maxPersistedWorldDeltaLog: 100,
      maxReplayInMemory: 20,
    });

    const metrics = await request(app, "/admin/ws-delta-metrics");
    const status = await request(app, "/admin/world-delta-log/status");
    const resetResponse = await request(app, "/admin/ws-delta-metrics/reset", { method: "POST" });

    expect(metrics.status).toBe(200);
    expect(await metrics.json()).toMatchObject({ savedBytes: 30, savedPercent: 60 });
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({
      dbDepth: 7,
      dbOldestWorldStateVersion: 4,
      dbNewestWorldStateVersion: 10,
      memoryDepth: 3,
      memoryOldestWorldStateVersion: 8,
      memoryNewestWorldStateVersion: 10,
      currentWorldStateVersion: 10,
      maxPersisted: 100,
      maxReplayInMemory: 20,
    });
    expect(resetResponse.status).toBe(200);
    expect(await resetResponse.json()).toEqual({ ok: true });
    expect(reset).toHaveBeenCalledOnce();
  });
});

function createAllowedRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn(),
    requireAuthOrCleanup: vi.fn(),
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin", countryId: "admin", isAdmin: true }),
    requireAdminOrCleanup: vi.fn(),
    requireSelfOrAdmin: vi.fn(),
  } as unknown as RouteAuth;
}

async function request(app: express.Express, path: string, init?: RequestInit): Promise<Response> {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a port");
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
