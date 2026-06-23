import express from "express";
import type { EventLogEntry, PopulationPop } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  adminPopulationGenerateSchema,
  registerAdminHexMutationRoutes,
  type AdminHexMutationRoutesDependencies,
  type AdminHexMutationWorldState,
} from "./adminHexMutationRoutes";

describe("adminHexMutationRoutes", () => {
  it("validates admin population generation payloads", () => {
    expect(adminPopulationGenerateSchema.safeParse({ scope: "world", strategy: "random" }).success).toBe(true);
    expect(adminPopulationGenerateSchema.safeParse({ scope: "region", strategy: "unknown" }).success).toBe(false);
    expect(adminPopulationGenerateSchema.safeParse({ scope: "region", hexId: "province:a", strategy: "random" }).success).toBe(false);
  });

  it("generates custom population for regions controlled by a country", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/population/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope: "country",
        countryId: "country:a",
        strategy: "custom",
        pops: [makeRawPop({ id: "pop:custom", size: 123 })],
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, updatedCount: 1, scope: "country", strategy: "custom" });
    expect(deps.world.regionPopulationByRegion["region:a"]).toEqual({ pops: [makePop({ id: "pop:custom", size: 123 })] });
    expect(deps.world.regionPopulationByRegion["region:b"]).toBeUndefined();
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledWith({ mask: 16 });
  });

  it("clears world population only when values change", async () => {
    const deps = makeDeps({
      regionPopulationByRegion: {
        "region:a": { pops: [makePop()] },
        "region:b": { pops: [] },
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/admin/population/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: "world" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, updatedCount: 1, scope: "world" });
    expect(deps.world.regionPopulationByRegion["region:a"]).toEqual({ pops: [] });
    expect(deps.world.regionPopulationByRegion["region:b"]).toEqual({ pops: [] });
  });

  it("updates one region population through the normalizer dependency", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/population/regions/region:a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pops: [makeRawPop({ id: "pop:patched", size: 77 })] }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      region: {
        id: "region:a",
        population: { pops: [makePop({ id: "pop:patched", size: 77 })] },
      },
    });
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

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
    getPopulationDomainKeys: () => ({ marker: "domains" }),
    buildRandomRegionPopulation: (regionId, _domains, populationTotal) => ({
      pops: [makePop({ id: `pop:${regionId}:random`, size: populationTotal ?? 100 })],
    }),
    normalizePopulationPops: (rawPops) =>
      Array.isArray(rawPops)
        ? rawPops.map((row, index) => makePop({ id: String(row?.id ?? `pop:${index}`), size: Number(row?.size ?? 0) }))
        : [],
    isEqualRegionPopulation: (previousPopulation, nextPopulation) =>
      JSON.stringify(previousPopulation ?? null) === JSON.stringify(nextPopulation),
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

function makeRawPop(overrides?: Partial<PopulationPop>): Partial<PopulationPop> {
  return makePop(overrides);
}

function makePop(overrides?: Partial<PopulationPop>): PopulationPop {
  return {
    id: "pop:default",
    size: 100,
    cultureId: "culture:default",
    religionId: "religion:default",
    raceId: "race:default",
    ideologies: { "ideology:default": 100 },
    professions: {
      "profession:workers": {
        size: 100,
        ducats: 0,
        standardOfLiving: 10,
        radicals: 0,
        loyalists: 0,
        lastIncomeDucats: 0,
        lastNeedsSpendDucats: 0,
        lastNeedsSatisfaction: 1,
        lastNeedsByCategory: {},
        lastNeedsDeficitByGood: {},
        lastNeedsBudgetShortageByGood: {},
        lastBirths: 0,
        lastDeaths: 0,
      },
    },
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
