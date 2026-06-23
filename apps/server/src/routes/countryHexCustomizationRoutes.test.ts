import express from "express";
import type { EventLogEntry, ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  hexRenameSchema,
  registerCountryHexCustomizationRoutes,
  type CountryHexCustomizationRoutesDependencies,
  type CountryHexCustomizationWorldState,
} from "./countryHexCustomizationRoutes";

const resources: ResourceTotals = {
  ducats: 50,
  gold: 0,
  culture: 0,
  science: 0,
  religion: 0,
  construction: 0,
  colonization: 0,
};

describe("countryHexCustomizationRoutes", () => {
  it("validates province rename payloads", () => {
    expect(hexRenameSchema.safeParse({ hexId: "province:a", hexName: "Name" }).success).toBe(true);
    expect(hexRenameSchema.safeParse({ hexId: "province:a", hexName: "" }).success).toBe(false);
  });

  it("renames an owned province, charges ducats, and broadcasts news", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/country/hex-rename", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hexId: "province:a", hexName: "New Name" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      hexId: "province:a",
      hexName: "New Name",
      chargedDucats: 25,
      resources: { ducats: 25 },
    });
    expect(deps.world.hexNameById["province:a"]).toBe("New Name");
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledWith({ mask: 3 });
    expect(deps.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "NEWS_EVENT" }));
  });

  it("rejects insufficient ducats without mutating world state", async () => {
    const deps = makeDeps({
      resourcesByCountry: { "country:a": { ...resources, ducats: 10 } },
    });
    const app = makeApp(deps);

    const response = await request(app, "/country/hex-rename", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hexId: "province:a", hexName: "New Name" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INSUFFICIENT_DUCATS", required: 25, available: 10 });
    expect(deps.world.hexNameById["province:a"]).toBeUndefined();
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });

  it("rejects missing provinces after ownership validation", async () => {
    const deps = makeDeps(undefined, false);
    const app = makeApp(deps);

    const response = await request(app, "/country/hex-rename", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hexId: "province:a", hexName: "New Name" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "HEX_NOT_FOUND" });
  });
});

function makeApp(deps: CountryHexCustomizationRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerCountryHexCustomizationRoutes(app, deps);
  return app;
}

function makeDeps(
  worldOverrides?: Partial<CountryHexCustomizationWorldState>,
  hexExists = true,
): CountryHexCustomizationRoutesDependencies & { world: CountryHexCustomizationWorldState } {
  const world: CountryHexCustomizationWorldState = {
    hexOwner: { "province:a": "country:a" },
    resourcesByCountry: { "country:a": { ...resources } },
    hexNameById: {},
    ...worldOverrides,
  };
  return {
    world,
    routeAuth: createRouteAuth(),
    masks: {
      resourcesByCountry: 1,
      hexNameById: 2,
    },
    getTurnId: () => 6,
    getWorldBase: () => world,
    getHexRenameDucatsCost: () => 25,
    hexExists: () => hexExists,
    ensureCountryInWorldBase: vi.fn(),
    cloneWorldBaseSectionSnapshot: (mask) => ({ mask }),
    savePersistentState: vi.fn(),
    broadcastWorldDeltaFromSectionSnapshot: vi.fn(),
    makeOfficialNews: (input) => makeNews(input.title),
    broadcast: vi.fn(),
  };
}

function makeNews(title: string): EventLogEntry {
  return {
    id: "news:test",
    turn: 6,
    timestamp: "now",
    category: "politics",
    title,
    message: title,
    countryId: "country:a",
    priority: "low",
    visibility: "public",
  };
}

function createRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn().mockReturnValue({ countryId: "country:a", isAdmin: false }),
    requireAuthOrCleanup: vi.fn(),
    requireAdmin: vi.fn(),
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
