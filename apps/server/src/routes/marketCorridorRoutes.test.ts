import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  marketTransportCorridorCreateSchema,
  registerMarketCorridorRoutes,
  type MarketCorridorEntry,
  type MarketCorridorMarket,
  type MarketCorridorRoutesDependencies,
} from "./marketCorridorRoutes";

describe("marketCorridorRoutes", () => {
  it("validates corridor create payloads", () => {
    expect(marketTransportCorridorCreateSchema.safeParse({
      waypoints: [
        { hexId: "hex:0:0", lng: 0, lat: 0 },
        { hexId: "hex:2:0", lng: 2, lat: 0 },
      ],
      transportMode: "land",
    }).success).toBe(true);
    expect(marketTransportCorridorCreateSchema.safeParse({
      waypoints: [{ hexId: "hex:0:0", lng: 0, lat: 0 }],
      transportMode: "land",
    }).success).toBe(false);
  });

  it("lists corridors for market members", async () => {
    const corridor = makeCorridor({ id: "corridor:a" });
    const deps = makeDeps({ corridors: { "corridor:a": corridor } });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/corridors");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      marketId: "market:a",
      capitalHexId: "province:capital",
      corridors: [{ id: "corridor:a" }],
    });
  });

  it("creates building corridors with construction cost and route validation", async () => {
    const corridors: Record<string, MarketCorridorEntry> = {};
    const deps = makeDeps({ corridors });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/corridors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        waypoints: [
          { hexId: "hex:0:0", lng: 0, lat: 0 },
          { hexId: "hex:2:0", lng: 2, lat: 0 },
        ],
        transportMode: "land",
      }),
    });

    expect(response.status).toBe(201);
    expect(corridors["corridor-1"]).toMatchObject({
      id: "corridor-1",
      marketId: "market:a",
      ownerCountryId: "country:a",
      schemaVersion: 2,
      hexIds: ["hex:0:0", "hex:1:0", "hex:2:0"],
      connectedRegionIds: ["region:a", "region:c"],
      transportMode: "land",
      status: "building",
      costConstruction: 20,
    });
    expect(deps.refreshExpiredDiplomacyProposals).toHaveBeenCalledOnce();
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("rejects non-city endpoints before saving", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/corridors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        waypoints: [
          { hexId: "hex:1:0", lng: 1, lat: 0 },
          { hexId: "hex:2:0", lng: 2, lat: 0 },
        ],
        transportMode: "land",
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "CORRIDOR_ENDPOINT_CITY_REQUIRED" });
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });

  it("closes owner corridors", async () => {
    const corridor = makeCorridor({ id: "corridor:a", status: "active" });
    const deps = makeDeps({ corridors: { "corridor:a": corridor } });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/corridors/corridor:a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });

    expect(response.status).toBe(200);
    expect(corridor.status).toBe("closed");
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("cancels building corridors", async () => {
    const corridor = makeCorridor({ id: "corridor:a", status: "building" });
    const corridors = { "corridor:a": corridor };
    const deps = makeDeps({ corridors });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/corridors/corridor:a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });

    expect(response.status).toBe(200);
    expect(corridors["corridor:a"]).toBeUndefined();
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("rejects demolishing corridors that are still building", async () => {
    const corridor = makeCorridor({ id: "corridor:a", status: "building" });
    const deps = makeDeps({ corridors: { "corridor:a": corridor } });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/corridors/corridor:a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "demolish" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "CORRIDOR_STILL_BUILDING" });
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });

  it("demolishes completed corridors", async () => {
    const corridor = makeCorridor({ id: "corridor:a", status: "active", completedAt: "2026-01-02" });
    const corridors = { "corridor:a": corridor };
    const deps = makeDeps({ corridors });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/corridors/corridor:a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "demolish" }),
    });

    expect(response.status).toBe(200);
    expect(corridors["corridor:a"]).toBeUndefined();
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("prevents deleting corridors owned by another country", async () => {
    const deps = makeDeps({
      corridors: { "corridor:a": makeCorridor({ id: "corridor:a", ownerCountryId: "country:b" }) },
    });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/corridors/corridor:a", { method: "DELETE" });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "CORRIDOR_OWNER_ONLY" });
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });
});

function makeApp(deps: MarketCorridorRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerMarketCorridorRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  market?: MarketCorridorMarket;
  corridors?: Record<string, MarketCorridorEntry>;
  contiguous?: boolean;
}): MarketCorridorRoutesDependencies {
  const corridors = options?.corridors ?? {};
  const market = options?.market ?? makeMarket();
  return {
    routeAuth: createRouteAuth(),
    createId: () => "corridor-1",
    refreshExpiredDiplomacyProposals: vi.fn(),
    getMarketById: (marketId) => marketId === market.id ? market : null,
    getCorridorsById: () => corridors,
    getMarketTransportCorridors: (marketId) =>
      Object.values(corridors).filter((corridor) => corridor.marketId === marketId),
    normalizeTransportCorridorRoutePoints: (input) => Array.isArray(input) ? input : [],
    normalizeHexIdList: (input) => Array.isArray(input) ? [...new Set(input.map(String))] : [],
    isHexAllowedForCorridorOwner: () => true,
    isContiguousTransportCorridorRoute: () => options?.contiguous ?? true,
    getHexOwner: () => "country:a",
    getHexMapArtifact: () => ({
      settings: { width: 3, height: 1, wrapX: false },
      tiles: [
        { id: "hex:0:0", q: 0, r: 0, passable: true, movementCost: 1 },
        { id: "hex:1:0", q: 1, r: 0, passable: true, movementCost: 1 },
        { id: "hex:2:0", q: 2, r: 0, passable: true, movementCost: 1 },
      ],
    } as never),
    getWorldBase: () => ({
      cityMarkersById: {
        "city:a": { id: "city:a", name: "A", regionId: "region:a", targetHexId: "hex:0:0" },
        "city:c": { id: "city:c", name: "C", regionId: "region:c", targetHexId: "hex:2:0" },
      },
      settlementProjectsById: {},
    } as never),
    getHexMovementCost: () => 1,
    getInfrastructureConstructionRightForHex: () => null,
    getTransportCorridorBuildCost: (_mode, routeCost) => routeCost * 10,
    savePersistentState: vi.fn(),
  };
}

function makeMarket(overrides?: Partial<MarketCorridorMarket>): MarketCorridorMarket {
  return {
    id: "market:a",
    ownerCountryId: "country:a",
    memberCountryIds: ["country:a", "country:b"],
    capitalHexId: "province:capital",
    ...overrides,
  };
}

function makeCorridor(overrides?: Partial<MarketCorridorEntry>): MarketCorridorEntry {
  return {
    id: "corridor",
    marketId: "market:a",
    ownerCountryId: "country:a",
    schemaVersion: 2,
    hexIds: ["hex:0:0", "hex:1:0"],
    computedHexIds: ["hex:0:0", "hex:1:0"],
    waypoints: [
      { hexId: "hex:0:0", lng: 0, lat: 0 },
      { hexId: "hex:1:0", lng: 1, lat: 0 },
    ],
    connectedRegionIds: ["region:a"],
    connectedCityMarkerIds: ["city:a"],
    transportMode: "land",
    level: 1,
    status: "building",
    progressConstruction: 0,
    costConstruction: 10,
    lastLoadByMode: {},
    lastCapacityByMode: {},
    lastLoadHistoryByMode: {},
    foreignConstructionRights: [],
    nationalizedAt: null,
    nationalizedFromCountryId: null,
    createdAt: "2026-01-01",
    completedAt: null,
    ...overrides,
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
