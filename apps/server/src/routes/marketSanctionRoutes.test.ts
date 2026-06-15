import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  createMarketSanctionCreateSchema,
  registerMarketSanctionRoutes,
  type MarketSanctionEntry,
  type MarketSanctionMarket,
  type MarketSanctionRoutesDependencies,
} from "./marketSanctionRoutes";

describe("marketSanctionRoutes", () => {
  it("validates create schema with configured bounds", () => {
    const schema = createMarketSanctionCreateSchema(100);

    expect(schema.safeParse({
      direction: "both",
      targetType: "country",
      targetId: "country:b",
      mode: "ban",
      durationTurns: 5,
    }).success).toBe(true);
    expect(schema.safeParse({
      direction: "both",
      targetType: "country",
      targetId: "country:b",
      mode: "ban",
      durationTurns: 101,
    }).success).toBe(false);
  });

  it("lists sanctions for market members", async () => {
    const sanctions = {
      sanctionA: makeSanction({ id: "sanctionA", startTurn: 4 }),
      sanctionB: makeSanction({ id: "sanctionB", startTurn: 8 }),
    };
    const deps = makeDeps({ sanctions, actorCountryId: "country:b" });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/sanctions");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ownerCountryId: "country:a",
      turnId: 10,
      sanctions: [{ id: "sanctionB" }, { id: "sanctionA" }],
    });
  });

  it("creates cap sanctions with normalized goods and amount", async () => {
    const sanctions: Record<string, MarketSanctionEntry> = {};
    const deps = makeDeps({ sanctions });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/sanctions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        direction: "import",
        targetType: "country",
        targetId: "country:b",
        goods: ["good:grain", "missing"],
        mode: "cap",
        capAmountPerTurn: 2.3456,
        durationTurns: 3,
      }),
    });

    expect(response.status).toBe(201);
    expect(sanctions["sanction-1"]).toMatchObject({
      id: "sanction-1",
      initiatorCountryId: "country:a",
      goods: ["good:grain"],
      mode: "cap",
      capAmountPerTurn: 2.346,
      startTurn: 10,
    });
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("rejects payloads where all specified goods are invalid", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/sanctions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        direction: "export",
        targetType: "country",
        targetId: "country:b",
        goods: ["missing"],
        mode: "ban",
        durationTurns: 3,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "NO_VALID_GOODS" });
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });

  it("deletes owner sanctions", async () => {
    const sanctions = { sanctionA: makeSanction({ id: "sanctionA" }) };
    const deps = makeDeps({ sanctions });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/sanctions/sanctionA", { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(sanctions.sanctionA).toBeUndefined();
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });
});

function makeApp(deps: MarketSanctionRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerMarketSanctionRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  actorCountryId?: string;
  market?: MarketSanctionMarket;
  sanctions?: Record<string, MarketSanctionEntry>;
}): MarketSanctionRoutesDependencies {
  const market = options?.market ?? makeMarket();
  return {
    routeAuth: createRouteAuth(options?.actorCountryId ?? "country:a"),
    maxSettingNumber: 100,
    createId: () => "sanction-1",
    getTurnId: () => 10,
    getMarketById: (marketId) => marketId === market.id ? market : null,
    getSanctionsById: () => options?.sanctions ?? {},
    countryExists: vi.fn().mockResolvedValue(true),
    getValidGoodIds: () => new Set(["good:grain", "good:iron"]),
    enrichMarketSanctions: vi.fn(async (sanctions) => sanctions),
    round3: (value) => Math.round(value * 1000) / 1000,
    savePersistentState: vi.fn(),
  };
}

function makeMarket(overrides?: Partial<MarketSanctionMarket>): MarketSanctionMarket {
  return {
    id: "market:a",
    ownerCountryId: "country:a",
    memberCountryIds: ["country:a", "country:b"],
    ...overrides,
  };
}

function makeSanction(overrides?: Partial<MarketSanctionEntry>): MarketSanctionEntry {
  return {
    id: "sanction",
    initiatorCountryId: "country:a",
    direction: "both",
    targetType: "country",
    targetId: "country:b",
    goods: [],
    mode: "ban",
    capAmountPerTurn: null,
    startTurn: 1,
    durationTurns: 3,
    enabled: true,
    ...overrides,
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
