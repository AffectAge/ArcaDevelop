import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  clientSettingsSchema,
  registerCountryClientSettingsRoutes,
  type CountryClientSettingsRoutesDependencies,
} from "./countryClientSettingsRoutes";

describe("countryClientSettingsRoutes", () => {
  it("validates client settings payloads", () => {
    expect(clientSettingsSchema.safeParse({ eventLogRetentionTurns: 10 }).success).toBe(true);
    expect(clientSettingsSchema.safeParse({ eventLogRetentionTurns: 0 }).success).toBe(false);
  });

  it("returns the moved setting error for valid authenticated requests", async () => {
    const app = makeApp();

    const response = await request(app, "/country/client-settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventLogRetentionTurns: 10 }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "CLIENT_SETTING_MOVED_TO_ADMIN_GAME_SETTINGS" });
  });
});

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerCountryClientSettingsRoutes(app, makeDeps());
  return app;
}

function makeDeps(): CountryClientSettingsRoutesDependencies {
  return {
    routeAuth: {
      requireAuth: vi.fn().mockReturnValue({ countryId: "country:a", isAdmin: false }),
      requireAuthOrCleanup: vi.fn(),
      requireAdmin: vi.fn(),
      requireAdminOrCleanup: vi.fn(),
      requireSelfOrAdmin: vi.fn(),
    } as unknown as RouteAuth,
  };
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
