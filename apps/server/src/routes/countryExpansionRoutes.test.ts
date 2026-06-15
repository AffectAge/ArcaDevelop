import express from "express";
import type { EventLogEntry, Order, ResourceTotals, WorldBase } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  colonizationActionSchema,
  registerCountryExpansionRoutes,
  type CountryExpansionRoutesDependencies,
  type CountryExpansionWorldState,
} from "./countryExpansionRoutes";

const resources: ResourceTotals = {
  ducats: 0,
  gold: 0,
  culture: 0,
  science: 0,
  religion: 0,
  construction: 0,
  colonization: 0,
};

describe("countryExpansionRoutes", () => {
  it("validates colonization action payloads", () => {
    expect(colonizationActionSchema.safeParse({ regionId: "region:a" }).success).toBe(true);
    expect(colonizationActionSchema.safeParse({ provinceId: "" }).success).toBe(false);
  });

  it("starts colonization for neutral enabled provinces", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/country/colonization/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ regionId: "region:a" }),
    });

    expect(response.status).toBe(200);
    expect(deps.world.colonyProgressByRegion["region:a"]).toEqual({ "country:a": 0 });
    expect(deps.addActiveColonizationTarget).toHaveBeenCalledWith("country:a", "region:a");
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledWith({ mask: 1 });
    expect(deps.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "NEWS_EVENT" }));
  });

  it("rejects colonization above active target limit", async () => {
    const deps = makeDeps({ activeColonizeProvinceIds: ["province:x"], maxActiveColonizations: 1 });
    const app = makeApp(deps);

    const response = await request(app, "/country/colonization/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ regionId: "region:a" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "COLONIZE_LIMIT", current: 1, limit: 1 });
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });

  it("cancels colonization and removes matching colonization orders", async () => {
    const order = makeOrder({ id: "order:a", regionId: "region:a" });
    const orders = new Map([["player:a", [order]]]);
    const deps = makeDeps({
      colonyProgressByRegion: { "region:a": { "country:a": 25 } },
      orders,
    });
    const app = makeApp(deps);

    const response = await request(app, "/country/colonization/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ regionId: "region:a" }),
    });

    expect(response.status).toBe(200);
    expect(deps.world.colonyProgressByRegion["region:a"]).toBeUndefined();
    expect(deps.removeRegionFromActiveColonizationIndex).toHaveBeenCalledWith("region:a");
    expect(deps.removeOrderFromTurnIndexes).toHaveBeenCalledWith(order);
    expect(deps.dropTurnOrderIndexes).toHaveBeenCalledWith(4);
  });

  it("starts exploration for controlled regions", async () => {
    const deps = makeDeps({ regionOwner: { "region:a": "country:a" }, regionController: { "region:a": "country:a" } });
    const app = makeApp(deps);

    const response = await request(app, "/country/exploration/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ regionId: "region:a" }),
    });

    expect(response.status).toBe(200);
    expect(deps.world.regionResourceExplorationQueueByRegion["region:a"]).toEqual([
      {
        queueId: "id-1",
        requestedByCountryId: "country:a",
        startedTurnId: 4,
        turnsRemaining: 3,
      },
    ]);
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("rejects exploration for uncontrolled regions", async () => {
    const deps = makeDeps({ regionOwner: { "region:a": "country:b" }, regionController: { "region:a": "country:b" } });
    const app = makeApp(deps);

    const response = await request(app, "/country/exploration/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ regionId: "region:a" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "REGION_NOT_CONTROLLED" });
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });
});

function makeApp(deps: CountryExpansionRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerCountryExpansionRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  regionOwner?: Record<string, string>;
  regionController?: Record<string, string>;
  colonyProgressByRegion?: Record<string, Record<string, number>>;
  activeColonizeProvinceIds?: string[];
  queuedColonizeProvinceIds?: string[];
  maxActiveColonizations?: number;
  orders?: Map<string, Order[]>;
}): CountryExpansionRoutesDependencies & { world: CountryExpansionWorldState } {
  const world: CountryExpansionWorldState = {
    regionOwner: options?.regionOwner ?? {},
    regionController: options?.regionController ?? {},
    colonyProgressByRegion: options?.colonyProgressByRegion ?? {},
    resourcesByCountry: { "country:a": { ...resources } },
    regionResourceExplorationQueueByRegion: {},
  };
  return {
    world,
    routeAuth: createRouteAuth(),
    masks: {
      colonyProgressByRegion: 1,
      regionResourceExplorationQueueByRegion: 2,
    },
    createId: () => "id-1",
    getTurnId: () => 4,
    getWorldBase: () => world as WorldBase & CountryExpansionWorldState,
    getWorldState: () => world,
    getMaxActiveColonizations: () => options?.maxActiveColonizations ?? 2,
    getExplorationDurationTurns: () => 3,
    getRegionColonizationConfig: () => ({ disabled: false }),
    ensureCountryInWorldBase: vi.fn(),
    addActiveColonizationTarget: vi.fn(),
    removeActiveColonizationTarget: vi.fn(),
    removeRegionFromActiveColonizationIndex: vi.fn(),
    getActiveColonizeRegionIds: () => options?.activeColonizeProvinceIds ?? [],
    getQueuedColonizeRegionIds: () => options?.queuedColonizeProvinceIds ?? [],
    getOrdersByTurn: () => options?.orders,
    deleteOrdersForTurn: vi.fn((turnId: number) => {
      if (turnId === 4) options?.orders?.clear();
    }),
    removeOrderFromTurnIndexes: vi.fn(),
    dropTurnOrderIndexes: vi.fn(),
    cloneWorldBaseSectionSnapshot: (mask) => ({ mask }),
    savePersistentState: vi.fn(),
    broadcastWorldDeltaFromSectionSnapshot: vi.fn(),
    makeOfficialNews: (input) => makeNews(input.title),
    broadcast: vi.fn(),
  };
}

function makeOrder(overrides?: Omit<Partial<Extract<Order, { type: "COLONIZE" }>>, "type">): Extract<Order, { type: "COLONIZE" }> {
  return {
    id: "order",
    turnId: 4,
    playerId: "player:a",
    countryId: "country:a",
    regionId: "region:a",
    type: "COLONIZE",
    payload: {},
    createdAt: "now",
    ...overrides,
  };
}

function makeNews(title: string): EventLogEntry {
  return {
    id: "news:test",
    turn: 4,
    timestamp: "now",
    category: "colonization",
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
