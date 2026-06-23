import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  buildMarketOverviewResponse,
  registerMarketReadRoutes,
  type MarketOverviewState,
  type MarketReadMarket,
  type MarketReadRoutesDependencies,
} from "./marketReadRoutes";

describe("marketReadRoutes", () => {
  it("builds market overview from injected read models", async () => {
    const deps = makeDeps();

    const response = buildMarketOverviewResponse("country:a", deps);

    expect(response).toMatchObject({
      turnId: 7,
      countryId: "country:a",
      marketId: "market:a",
      goods: [{
        goodId: "good:grain",
        countryDemand: 10,
        countryOffer: 5,
        countryCoveragePct: 50,
        globalDemand: 20,
        globalOffer: 10,
        globalCoveragePct: 50,
      }],
      logisticsSnapshot: {
        failuresByHex: { "province:a": { reason: "missing" } },
      },
    });
  });

  it("serves public market details to non-members", async () => {
    const deps = makeDeps({
      actorCountryId: "country:z",
      market: makeMarket({ visibility: "public" }),
    });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ market: { id: "market:a" } });
  });

  it("blocks private market details for non-members", async () => {
    const deps = makeDeps({ actorCountryId: "country:z" });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "FORBIDDEN" });
  });

  it("lists markets with membership and pending request flags", async () => {
    const deps = makeDeps({
      actorCountryId: "country:z",
      market: makeMarket({ visibility: "private", memberCountryIds: ["country:a"] }),
      invites: [{ marketId: "market:a", kind: "join-request", fromCountryId: "country:z", status: "pending" }],
    });
    const app = makeApp(deps);

    const response = await request(app, "/markets");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      markets: [{
        id: "market:a",
        isMember: false,
        canJoinDirectly: false,
        canRequestJoin: false,
        hasPendingJoinRequest: true,
      }],
    });
    expect(deps.ensureMarketModelReady).toHaveBeenCalledOnce();
  });
});

function makeApp(deps: MarketReadRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerMarketReadRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  actorCountryId?: string;
  market?: MarketReadMarket;
  invites?: Array<{ marketId: string; kind: "invite" | "join-request"; fromCountryId: string; status: "pending" | "accepted" | "rejected" | "canceled" }>;
}): MarketReadRoutesDependencies {
  const market = options?.market ?? makeMarket();
  return {
    routeAuth: createRouteAuth(options?.actorCountryId ?? "country:a"),
    getTurnId: () => 7,
    ensureCountryInWorldBase: vi.fn(),
    getCountryMarketId: () => "market:a",
    getMarketById: (marketId) => marketId === market.id ? market : null,
    getGoods: () => [{ id: "good:grain", name: "Grain", basePrice: 2 }],
    getLatestMarketOverview: () => makeOverview(),
    getCountryGoodPrices: () => ({ "market:a": { "good:grain": 3 } }),
    getGlobalGoodPrices: () => ({ "good:grain": 4 }),
    getGlobalGoodPriceHistoryByResourceId: () => ({ "good:grain": [4] }),
    getGlobalGoodDemandHistoryByResourceId: () => ({ "good:grain": [20] }),
    getGlobalGoodOfferHistoryByResourceId: () => ({ "good:grain": [10] }),
    getGlobalGoodProductionFactHistoryByResourceId: () => ({ "good:grain": [8] }),
    getGlobalGoodProductionMaxHistoryByResourceId: () => ({ "good:grain": [12] }),
    getHexOwner: (hexId) => hexId === "province:a" ? "country:a" : "country:b",
    getMarketTransportCorridors: () => [{
      id: "corridor:a",
      marketId: "market:a",
      ownerCountryId: "country:a",
      hexIds: ["province:a"],
      transportMode: "land",
      level: 1,
      status: "active",
      progressConstruction: 0,
      costConstruction: 1,
      lastLoadByMode: { land: 5 },
      lastCapacityByMode: { land: 10 },
      createdAt: "2026-01-01",
      completedAt: null,
    }],
    getTransportCorridorCapacity: () => 10,
    getTransportModes: () => ["land", "sea", "air", "pipeline", "powerGrid"],
    round3: (value) => Math.round(value * 1000) / 1000,
    ensureMarketModelReady: vi.fn(),
    getMarkets: () => [market],
    getMarketInvites: () => options?.invites?.map((invite) => ({
      toCountryId: "country:a",
      ...invite,
    })) ?? [],
    listCountriesByIds: vi.fn(async () => [{ id: "country:a", name: "Country A", flagUrl: null }]),
    getMarketDisplayName: ({ marketName }) => marketName,
    buildMarketDetailsResponse: vi.fn(async (marketId) => ({ market: { id: marketId } })),
  };
}

function makeMarket(overrides?: Partial<MarketReadMarket>): MarketReadMarket {
  return {
    id: "market:a",
    name: "Market A",
    logoUrl: null,
    ownerCountryId: "country:a",
    capitalHexId: "province:a",
    memberCountryIds: ["country:a"],
    visibility: "private",
    createdAt: "2026-01-01",
    priceHistoryByResourceId: { "good:grain": [3] },
    demandHistoryByResourceId: { "good:grain": [10] },
    offerHistoryByResourceId: { "good:grain": [5] },
    productionFactHistoryByResourceId: { "good:grain": [4] },
    productionMaxHistoryByResourceId: { "good:grain": [7] },
    ...overrides,
  };
}

function makeOverview(): MarketOverviewState {
  return {
    demandByCountry: { "market:a": { "good:grain": 10 } },
    offerByCountry: { "market:a": { "good:grain": 5 } },
    demandGlobal: { "good:grain": 20 },
    offerGlobal: { "good:grain": 10 },
    importsByCountryByCountryAndGood: {},
    exportsByCountryByCountryAndGood: {},
    importsByMarketByMarketAndGood: {},
    exportsByMarketByMarketAndGood: {},
    logisticsFailuresByHex: {
      "province:a": { reason: "missing" },
      "province:b": { reason: "foreign" },
    },
    alertsByCountry: { "country:a": [{ id: "alert:a" }] },
  };
}

function createRouteAuth(countryId: string): RouteAuth {
  return {
    requireAuth: vi.fn().mockReturnValue({ countryId, isAdmin: false }),
    requireAuthOrCleanup: vi.fn(),
    requireAdmin: vi.fn(),
    requireAdminOrCleanup: vi.fn(),
    requireSelfOrAdmin: vi.fn(),
  } as unknown as RouteAuth;
}

async function request(app: express.Express, path: string): Promise<Response> {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a port");
    return await fetch(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
