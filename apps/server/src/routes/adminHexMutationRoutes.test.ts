import express from "express";
import type { EventLogEntry, PopulationPop } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  registerAdminHexMutationRoutes,
  type AdminHexMutationRoutesDependencies,
  type AdminHexMutationWorldState,
} from "./adminHexMutationRoutes";

describe("adminHexMutationRoutes", () => {
  it("updates region colonization settings, owner, and cleanup state", async () => {
    const deps = makeDeps({
      colonyProgressByRegion: { "region:a": { "country:b": 50 } },
    });
    const app = makeApp(deps);

    const response = await request(app, "/admin/regions/region:a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        colonizationCost: 33,
        colonizationDisabled: true,
        ownerCountryId: "country:b",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      region: {
        id: "region:a",
        ownerCountryId: "country:b",
        controllerCountryId: "country:b",
        colonizationCost: 33,
        colonizationDisabled: true,
        manualCost: true,
        colonyProgressByCountry: {},
        population: null,
      },
    });
    expect(deps.cleanupRegionColonizationProgress).toHaveBeenCalledWith("region:a");
    expect(deps.ensureCountryInWorldBase).toHaveBeenCalledWith("country:b");
    expect(deps.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "NEWS_EVENT" }));
  });

  it("lists admin region rows with region-owned heavy state", async () => {
    const deps = makeDeps({
      colonyProgressByRegion: { "region:a": { "country:b": 50 } },
      regionPopulationByRegion: { "region:a": { pops: [makePop()] } },
    });
    const app = makeApp(deps);

    const response = await request(app, "/admin/regions");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      regions: [
        {
          id: "region:a",
          ownerCountryId: "country:a",
          controllerCountryId: "country:a",
          colonizationCost: 11,
          colonizationDisabled: false,
          manualCost: false,
          colonyProgressByCountry: { "country:b": 50 },
          population: { pops: [makePop()] },
        },
        {
          id: "region:b",
          ownerCountryId: "country:b",
          controllerCountryId: "country:b",
          colonizationCost: 11,
          colonizationDisabled: false,
          manualCost: false,
          colonyProgressByCountry: {},
          population: null,
        },
      ],
    });
  });

  it("rejects missing owner countries before saving region owner changes", async () => {
    const deps = makeDeps(undefined, { existingCountryIds: new Set(["country:a"]) });
    const app = makeApp(deps);

    const response = await request(app, "/admin/regions/region:a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerCountryId: "country:missing" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "COUNTRY_NOT_FOUND" });
    expect(deps.world.regionOwner["region:a"]).toBe("country:a");
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });

  it("recalculates automatic region costs and broadcasts only changed runs", async () => {
    const deps = makeDeps(undefined, { recalculateCount: 2 });
    const app = makeApp(deps);

    const response = await request(app, "/admin/regions/recalculate-auto-costs", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, updatedCount: 2 });
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledWith({ mask: 8 });
    expect(deps.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "NEWS_EVENT" }));
  });
});

function makeApp(deps: AdminHexMutationRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerAdminHexMutationRoutes(app, deps);
  return app;
}

function makeDeps(
  worldOverrides?: Partial<AdminHexMutationWorldState>,
  options?: { existingCountryIds?: Set<string>; recalculateCount?: number },
): AdminHexMutationRoutesDependencies & { world: AdminHexMutationWorldState } {
  const world: AdminHexMutationWorldState = {
    hexOwner: { "province:a": "country:a" },
    regionOwner: { "region:a": "country:a", "region:b": "country:b" },
    regionController: { "region:a": "country:a", "region:b": "country:b" },
    colonyProgressByRegion: {},
    regionColonizationByRegion: {},
    regionPopulationByRegion: {},
    ...worldOverrides,
  };
  return {
    world,
    routeAuth: createRouteAuth(),
    masks: {
      resourcesByCountry: 1,
      hexOwner: 2,
      regionOwner: 32,
      regionController: 64,
      colonyProgressByRegion: 4,
      regionColonizationByRegion: 8,
      regionPopulationByRegion: 16,
    },
    getTurnId: () => 5,
    getWorldBase: () => world,
    getRegionColonizationConfig: (regionId) => {
      const existing = world.regionColonizationByRegion[regionId];
      return {
        cost: existing?.cost ?? 11,
        disabled: existing?.disabled ?? false,
        manualCost: existing?.manualCost ?? false,
      };
    },
    getRegionDerivedColonizationCosts: () => ({ pointsCost: 21, ducatsCost: 0 }),
    cleanupRegionColonizationProgress: vi.fn((regionId: string) => {
      delete world.colonyProgressByRegion[regionId];
    }),
    recalculateAllRegionColonizationCosts: vi.fn(() => options?.recalculateCount ?? 0),
    countryExists: async (countryId) => options?.existingCountryIds?.has(countryId) ?? true,
    ensureCountryInWorldBase: vi.fn(),
    cloneWorldBaseSectionSnapshot: (mask) => ({ mask }),
    savePersistentState: vi.fn(),
    broadcastWorldDeltaFromSectionSnapshot: vi.fn(),
    makeOfficialNews: (input) => makeNews(input.title),
    broadcast: vi.fn(),
  };
}

function makePop(overrides?: Partial<PopulationPop>): PopulationPop {
  return {
    id: "pop:default",
    size: 100,
    cultureId: "culture:default",
    religionId: "religion:default",
    raceId: "race:default",
    professionId: "profession:unemployed",
    literacy: 0,
    ducats: 0,
    standardOfLiving: 10,
    radicals: 0,
    loyalists: 0,
    qualificationsByCategory: {},
    ideologies: { "ideology:default": 100 },
    lastIncomeDucats: 0,
    lastNeedsSpendDucats: 0,
    lastNeedsSatisfaction: 1,
    lastNeedsByCategory: {},
    lastNeedsDeficitByGood: {},
    lastNeedsBudgetShortageByGood: {},
    lastBirths: 0,
    lastDeaths: 0,
    lastEmployed: 0,
    lastOpenJobs: 0,
    lastQualificationLimit: 0,
    lastDiscriminationPenalty: 0,
    politicalStrength: 0,
    ...overrides,
  };
}

function makeNews(title: string): EventLogEntry {
  return {
    id: "news:test",
    turn: 5,
    timestamp: "now",
    category: "colonization",
    title,
    message: title,
    countryId: "country:admin",
    priority: "low",
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
