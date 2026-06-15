import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import { createGameSettingsPatchSchema, registerAdminGameSettingsRoutes } from "./adminGameSettingsRoutes";

describe("adminGameSettingsRoutes", () => {
  it("coerces and validates game settings patches", () => {
    const schema = createGameSettingsPatchSchema(100);

    expect(schema.safeParse({ economy: { baseCulturePerTurn: "5" } }).success).toBe(true);
    expect(schema.safeParse({ economy: { baseCulturePerTurn: 101 } }).success).toBe(false);
  });

  it("serves current settings through admin auth", async () => {
    const app = express();
    registerAdminGameSettingsRoutes(app, {
      routeAuth: createAllowedRouteAuth(),
      getGameSettings: () => ({ economy: { baseCulturePerTurn: 1 } }),
      applyGameSettingsUpdate: vi.fn(),
      maxSettingNumber: 100,
    });

    const response = await request(app, "/admin/game-settings");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ economy: { baseCulturePerTurn: 1 } });
  });

  it("applies valid settings patches through the injected updater", async () => {
    const applyGameSettingsUpdate = vi.fn().mockReturnValue({ ok: true });
    const app = express();
    app.use(express.json());
    registerAdminGameSettingsRoutes(app, {
      routeAuth: createAllowedRouteAuth(),
      getGameSettings: () => ({}),
      applyGameSettingsUpdate,
      maxSettingNumber: 100,
    });

    const response = await request(app, "/admin/game-settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ colonization: { pointsPerTurn: "7" } }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(applyGameSettingsUpdate).toHaveBeenCalledWith(
      { colonization: { pointsPerTurn: 7 } },
      "admin-country",
    );
  });

  it("rejects invalid settings patches before calling the updater", async () => {
    const applyGameSettingsUpdate = vi.fn();
    const app = express();
    app.use(express.json());
    registerAdminGameSettingsRoutes(app, {
      routeAuth: createAllowedRouteAuth(),
      getGameSettings: () => ({}),
      applyGameSettingsUpdate,
      maxSettingNumber: 100,
    });

    const response = await request(app, "/admin/game-settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ colonization: { pointsPerTurn: 101 } }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "INVALID_PAYLOAD" });
    expect(applyGameSettingsUpdate).not.toHaveBeenCalled();
  });
});

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
