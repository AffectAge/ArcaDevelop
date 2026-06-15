import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  marketInviteCreateSchema,
  registerMarketMembershipRoutes,
  type MarketInviteEntry,
  type MarketMembershipMarket,
  type MarketMembershipRoutesDependencies,
} from "./marketMembershipRoutes";

describe("marketMembershipRoutes", () => {
  it("validates invite create payloads", () => {
    expect(marketInviteCreateSchema.safeParse({ toCountryId: "country:b" }).success).toBe(true);
    expect(marketInviteCreateSchema.safeParse({ toCountryId: "" }).success).toBe(false);
  });

  it("creates owner invites for non-member countries", async () => {
    const invites: Record<string, MarketInviteEntry> = {};
    const deps = makeDeps({ invites });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toCountryId: "country:c", expiresInDays: 2 }),
    });

    expect(response.status).toBe(201);
    expect(invites["invite-1"]).toMatchObject({
      id: "invite-1",
      marketId: "market:a",
      fromCountryId: "country:a",
      toCountryId: "country:c",
      kind: "invite",
      status: "pending",
    });
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("accepts pending invites and updates membership through dependencies", async () => {
    const invites: Record<string, MarketInviteEntry> = {
      invite: makeInvite({ id: "invite", fromCountryId: "country:b", toCountryId: "country:a" }),
    };
    const deps = makeDeps({ invites });
    const app = makeApp(deps);

    const response = await request(app, "/market-invites/invite", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });

    expect(response.status).toBe(200);
    expect(invites.invite.status).toBe("accepted");
    expect(deps.upsertMarketMembership).toHaveBeenCalledWith("country:a", "market:a");
    expect(deps.rebuildCountryMarketIndexFromMembers).toHaveBeenCalledOnce();
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("joins public markets directly", async () => {
    const market = makeMarket({ memberCountryIds: ["country:b"], visibility: "public" });
    const deps = makeDeps({ market });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/join", { method: "POST" });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: "joined", market: { id: "market:a" } });
    expect(deps.upsertMarketMembership).toHaveBeenCalledWith("country:a", "market:a");
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("prevents transferring market ownership to non-members", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a/transfer-owner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nextOwnerCountryId: "country:z" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "NEXT_OWNER_NOT_MARKET_MEMBER" });
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });
});

function makeApp(deps: MarketMembershipRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerMarketMembershipRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  market?: MarketMembershipMarket;
  invites?: Record<string, MarketInviteEntry>;
}): MarketMembershipRoutesDependencies {
  const market = options?.market ?? makeMarket();
  return {
    routeAuth: createRouteAuth(),
    createId: () => "invite-1",
    getMarketById: (marketId) => marketId === market.id ? market : null,
    getMarketInvitesById: () => options?.invites ?? {},
    countryExists: vi.fn().mockResolvedValue(true),
    enrichMarketInvites: vi.fn(async (invites) => invites),
    upsertMarketMembership: vi.fn(),
    rebuildCountryMarketIndexFromMembers: vi.fn(),
    getCountryMarketId: (countryId) => countryId,
    buildMarketDetailsResponse: vi.fn(async (marketId) => ({ market: { id: marketId } })),
    savePersistentState: vi.fn(),
  };
}

function makeMarket(overrides?: Partial<MarketMembershipMarket>): MarketMembershipMarket {
  return {
    id: "market:a",
    ownerCountryId: "country:a",
    memberCountryIds: ["country:a", "country:b"],
    visibility: "private",
    ...overrides,
  };
}

function makeInvite(overrides?: Partial<MarketInviteEntry>): MarketInviteEntry {
  return {
    id: "invite",
    marketId: "market:a",
    fromCountryId: "country:b",
    toCountryId: "country:a",
    kind: "invite",
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
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
