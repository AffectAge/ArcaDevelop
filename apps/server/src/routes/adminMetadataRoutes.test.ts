import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import { normalizeAuditLogLimit, registerAdminMetadataRoutes } from "./adminMetadataRoutes";

describe("adminMetadataRoutes", () => {
  it("normalizes audit log limits with retention and hard response caps", () => {
    expect(normalizeAuditLogLimit(undefined, 500)).toBe(100);
    expect(normalizeAuditLogLimit("999", 500)).toBe(200);
    expect(normalizeAuditLogLimit("999", 150)).toBe(150);
    expect(normalizeAuditLogLimit("-5", 500)).toBe(1);
  });

  it("serves active scenario metadata through admin auth", async () => {
    const app = express();
    registerAdminMetadataRoutes(app, {
      routeAuth: createAllowedRouteAuth(),
      getActiveScenarioId: () => "scenario-a",
      listScenarios: () => [{ id: "scenario-a" }],
      auditLogStore: makeAuditLogStore(),
    });

    const response = await request(app, "/admin/scenarios");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ activeScenarioId: "scenario-a", scenarios: [{ id: "scenario-a" }] });
  });

  it("serves pruned audit log through admin auth", async () => {
    const prune = vi.fn();
    const listRecent = vi.fn().mockReturnValue([{ id: "entry-a" }]);
    const app = express();
    registerAdminMetadataRoutes(app, {
      routeAuth: createAllowedRouteAuth(),
      getActiveScenarioId: () => "scenario-a",
      listScenarios: () => [],
      auditLogStore: {
        prune,
        getRetentionSettings: () => ({ maxEntries: 150, retentionTurns: 20 }),
        listRecent,
      },
    });

    const response = await request(app, "/admin/audit-log?limit=999");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      entries: [{ id: "entry-a" }],
      retention: { maxEntries: 150, retentionTurns: 20 },
    });
    expect(prune).toHaveBeenCalledOnce();
    expect(listRecent).toHaveBeenCalledWith(150);
  });
});

function makeAuditLogStore() {
  return {
    prune: vi.fn(),
    getRetentionSettings: () => ({ maxEntries: 100, retentionTurns: null }),
    listRecent: vi.fn().mockReturnValue([]),
  };
}

function createAllowedRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn(),
    requireAuthOrCleanup: vi.fn(),
    requireAdmin: vi.fn().mockResolvedValue({ countryId: "admin-country" }),
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
