import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import { registerSettingsGuideRoutes } from "./settingsGuideRoutes";

describe("settingsGuideRoutes", () => {
  it("serves public game settings and civilopedia", async () => {
    const app = express();
    registerSettingsGuideRoutes(app, {
      routeAuth: createAllowedRouteAuth(),
      getPublicGameSettings: () => ({ civilopedia: { entries: [] }, economy: { base: 1 } }),
      getCivilopedia: () => ({ entries: [{ id: "basics" }] }),
      updateCivilopedia: vi.fn(),
    });

    const settings = await request(app, "/game-settings/public");
    const civilopedia = await request(app, "/civilopedia");

    expect(settings.status).toBe(200);
    expect(await settings.json()).toEqual({ civilopedia: { entries: [] }, economy: { base: 1 } });
    expect(civilopedia.status).toBe(200);
    expect(await civilopedia.json()).toEqual({ civilopedia: { entries: [{ id: "basics" }] } });
  });

  it("updates civilopedia through admin auth", async () => {
    const updateCivilopedia = vi.fn();
    const app = express();
    app.use(express.json());
    registerSettingsGuideRoutes(app, {
      routeAuth: createAllowedRouteAuth(),
      getPublicGameSettings: () => ({}),
      getCivilopedia: () => ({ categories: ["basics"], entries: [] }),
      updateCivilopedia,
    });

    const response = await request(app, "/admin/civilopedia", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        categories: ["basics"],
        entries: [
          {
            id: "basics",
            category: "basics",
            title: "Basics",
            sections: [{ title: "Intro", paragraphs: ["Text"] }],
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ civilopedia: { categories: ["basics"], entries: [] } });
    expect(updateCivilopedia).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ["basics"] }),
      "admin-country",
    );
  });

  it("rejects invalid civilopedia payloads", async () => {
    const updateCivilopedia = vi.fn();
    const app = express();
    app.use(express.json());
    registerSettingsGuideRoutes(app, {
      routeAuth: createAllowedRouteAuth(),
      getPublicGameSettings: () => ({}),
      getCivilopedia: () => ({ categories: [], entries: [] }),
      updateCivilopedia,
    });

    const response = await request(app, "/admin/civilopedia", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries: [{ id: "", category: "x", title: "x", sections: [] }] }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "INVALID_PAYLOAD" });
    expect(updateCivilopedia).not.toHaveBeenCalled();
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
