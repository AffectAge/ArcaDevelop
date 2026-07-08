import express from "express";
import type { Country, EventLogEntry } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import type { AdminCountryDbRecord } from "./adminCountryRoutes";
import {
  punishSchema,
  registerAdminCountryPunishmentRoutes,
  type AdminCountryPunishmentRoutesDependencies,
} from "./adminCountryPunishmentRoutes";

describe("adminCountryPunishmentRoutes", () => {
  it("validates punishment payloads", () => {
    expect(punishSchema.safeParse({ action: "turns", turns: 2 }).success).toBe(true);
    expect(punishSchema.safeParse({ action: "turns" }).success).toBe(false);
    expect(punishSchema.safeParse({ action: "time" }).success).toBe(false);
  });

  it("locks a country for a number of turns and broadcasts public news", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/countries/country:b/punishments", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "turns", turns: 3, reasonText: "test reason" }),
    });

    expect(response.status).toBe(200);
    expect(deps.updateCountryPunishment).toHaveBeenCalledWith("country:b", {
      isLocked: false,
      blockedUntilTurn: 13,
      blockedUntilAt: null,
      lockReason: "test reason",
    });
    expect(deps.invalidateCountryQueryCache).toHaveBeenCalledOnce();
    expect(deps.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "NEWS_EVENT" }));
  });

  it("unlocks a country and clears all punishment fields", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/countries/country:b/punishments", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "unlock" }),
    });

    expect(response.status).toBe(200);
    expect(deps.updateCountryPunishment).toHaveBeenCalledWith("country:b", {
      isLocked: false,
      blockedUntilTurn: null,
      blockedUntilAt: null,
      lockReason: null,
    });
  });

  it("rejects missing countries before validation-side effects", async () => {
    const deps = makeDeps({ country: null });
    const app = makeApp(deps);

    const response = await request(app, "/admin/countries/country:missing/punishments", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "unlock" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "COUNTRY_NOT_FOUND" });
    expect(deps.updateCountryPunishment).not.toHaveBeenCalled();
  });

  it("rejects past time locks", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/countries/country:b/punishments", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "time", blockedUntilAt: "2000-01-01T00:00:00.000Z" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_TIME" });
    expect(deps.updateCountryPunishment).not.toHaveBeenCalled();
  });
});

function makeApp(deps: AdminCountryPunishmentRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerAdminCountryPunishmentRoutes(app, deps);
  return app;
}

function makeDeps(options?: { country?: AdminCountryDbRecord | null }): AdminCountryPunishmentRoutesDependencies {
  const country = options?.country === undefined ? makeCountryRecord() : options.country;
  return {
    routeAuth: createRouteAuth(),
    getTurnId: () => 10,
    findCountry: vi.fn(async () => country),
    updateCountryPunishment: vi.fn(async (_countryId, data) => ({ ...makeCountryRecord(), ...data })),
    countryFromDb: (row) => makeCountry(row),
    invalidateCountryQueryCache: vi.fn(),
    makeOfficialNews: (input) => makeNews(input.title),
    broadcast: vi.fn(),
  };
}

function makeCountryRecord(overrides?: Partial<AdminCountryDbRecord>): AdminCountryDbRecord {
  return {
    id: "country:b",
    name: "Country B",
    color: "#112233",
    flagUrl: null,
    crestUrl: null,
    cultureId: "culture:country:b",
    cultureName: "Culture B",
    cultureColor: "#4ade80",
    cultureLogoUrl: null,
    religionId: "religion:country:b",
    religionName: "Religion B",
    religionColor: "#a78bfa",
    religionLogoUrl: null,
    cultureGroupId: "culture_group:frontier",
    religionGroupId: "religion_group:shrines",
    raceId: "race:default",
    isAdmin: false,
    isLocked: false,
    blockedUntilTurn: null,
    blockedUntilAt: null,
    lockReason: null,
    ignoreUntilTurn: null,
    eventLogRetentionTurns: null,
    isRegistrationApproved: true,
    ...overrides,
  };
}

function makeCountry(row: AdminCountryDbRecord): Country {
  return {
    ...row,
    blockedUntilAt: row.blockedUntilAt ? row.blockedUntilAt.toISOString() : null,
    lockReason: row.lockReason ?? null,
  };
}

function makeNews(title: string): EventLogEntry {
  return {
    id: "news:test",
    turn: 10,
    timestamp: "now",
    category: "politics",
    title,
    message: title,
    countryId: "country:b",
    priority: "high",
    visibility: "public",
  };
}

function createRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn(),
    requireAuthOrCleanup: vi.fn(),
    requireAdmin: vi.fn().mockResolvedValue({ countryId: "country:admin", isAdmin: true }),
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
