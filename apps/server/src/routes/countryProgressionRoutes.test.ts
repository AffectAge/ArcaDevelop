import express from "express";
import type { CountryParliament, ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  registerCountryProgressionRoutes,
  setActiveTechnologySchema,
  startLawBillSchema,
  type CountryProgressionContentEntry,
  type CountryProgressionRoutesDependencies,
} from "./countryProgressionRoutes";

const emptyResources: ResourceTotals = {
  ducats: 0,
  gold: 0,
  culture: 0,
  science: 0,
  religion: 0,
  construction: 0,
  colonization: 0,
};

describe("countryProgressionRoutes", () => {
  it("validates route payload schemas", () => {
    expect(startLawBillSchema.safeParse({ lawId: "law:test" }).success).toBe(true);
    expect(startLawBillSchema.safeParse({ lawId: "" }).success).toBe(false);
    expect(setActiveTechnologySchema.safeParse({ technologyId: null }).success).toBe(true);
    expect(setActiveTechnologySchema.safeParse({ technologyId: 7 }).success).toBe(false);
  });

  it("updates active technology through injected state accessors", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/technology/country:a/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ technologyId: "technology:steam" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      technology: {
        researchedTechnologyIds: [],
        activeTechnologyId: "technology:steam",
        activeTechnologyIds: ["technology:steam"],
        progressByTechnologyId: {},
        lastScienceSpent: 0,
        lastCompletedTechnologyIds: [],
      },
    });
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledWith({ mask: 2 });
  });

  it("takes an available decision through normal side effects and bounded history", async () => {
    const resources: ResourceTotals = { ...emptyResources, ducats: 10 };
    const deps = makeDeps({ resources });
    const app = makeApp(deps);

    const response = await request(app, "/decisions/country:a/decision:mint/take", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(resources.ducats).toBe(7);
    expect(deps.applyDecisionEffects).toHaveBeenCalledWith("country:a", [
      { type: "resource_delta", resource: "gold", amount: 1 },
    ]);
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
    expect(deps.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "NEWS_EVENT" }));
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it("rejects unavailable decisions before mutating state", async () => {
    const deps = makeDeps({
      decisionAvailable: false,
    });
    const app = makeApp(deps);

    const response = await request(app, "/decisions/country:a/decision:mint/take", {
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "DECISION_UNAVAILABLE", reason: "blocked" });
    expect(deps.applyDecisionEffects).not.toHaveBeenCalled();
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });
});

function makeApp(deps: CountryProgressionRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerCountryProgressionRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  resources?: ResourceTotals;
  decisionAvailable?: boolean;
}): CountryProgressionRoutesDependencies {
  const technologyState = {
    researchedTechnologyIds: [],
    activeTechnologyId: null,
    activeTechnologyIds: [],
    progressByTechnologyId: {},
    lastScienceSpent: 0,
    lastCompletedTechnologyIds: [],
  };
  const decisionRecord = {
    completedDecisionIds: [],
    cooldownUntilTurnByDecisionId: {},
    history: [],
  };
  return {
    routeAuth: createAllowedRouteAuth(),
    masks: {
      parliamentByCountry: 1,
      technologyByCountry: 2,
      resourcesByCountry: 4,
      countryDecisionsByCountryId: 8,
      countryEventsByCountryId: 16,
    },
    getTurnId: () => 5,
    getContent: () => ({
      parties: [],
      interestGroups: [],
      lawGroups: [],
      laws: [makeEntry({ id: "law:test", lawGroupId: "law-group:test" })],
      ideologies: [],
      technologies: [makeEntry({ id: "technology:steam" })],
      decisions: [makeEntry({ id: "decision:mint", name: "Mint", decision: { category: "economy" } })],
      events: [makeEntry({ id: "event:test", name: "Event" })],
    }),
    getCountryResources: () => options?.resources ?? { ...emptyResources },
    ensureCountryInWorldBase: vi.fn(),
    ensureCountryParliament: () => ({ activeLawByGroupId: {}, currentBills: [], currentBill: null } as unknown as CountryParliament),
    setCountryParliament: vi.fn(),
    canEnactLawWithoutVote: () => true,
    calculateBillVote: vi.fn(),
    calculatePowerBillVote: vi.fn(),
    normalizeParliamentPowers: (powers) => powers as ReturnType<CountryProgressionRoutesDependencies["normalizeParliamentPowers"]>,
    getParliamentPowersFromActiveLaws: () => ({
      laws: "none",
      budget: "none",
      diplomacy: "none",
      war: "none",
      government: "none",
      moneyTransferRatificationThreshold: null,
    }),
    isLawUnlockedForCountry: () => true,
    ensureCountryTechnologyState: () => technologyState,
    setCountryTechnologyState: vi.fn(),
    getActiveCountryModifierRows: () => [],
    getVisibleCountryDecisions: () => [],
    ensureCountryDecisionRecord: () => decisionRecord,
    getCountryDecisionView: () => ({
      available: options?.decisionAvailable ?? true,
      reason: options?.decisionAvailable === false ? "blocked" : null,
      decision: {
        category: "economy",
        costs: { ducats: 3 },
        effects: [{ type: "resource_delta", resource: "gold", amount: 1 }],
        cooldownTurns: 2,
      },
    }),
    applyDecisionEffects: vi.fn(),
    ensureCountryEventRecord: () => ({
      pending: [],
      completedEventIds: [],
      cooldownUntilTurnByEventId: {},
      history: [],
    }),
    getPendingCountryEvents: () => ({ events: [], record: {} }),
    getGameEventDefinition: () => ({ category: "politics", options: [] }),
    removeQueuedUiNotification: vi.fn(),
    cloneWorldBaseSectionSnapshot: (mask) => ({ mask }),
    savePersistentState: vi.fn(),
    broadcastWorldDeltaFromSectionSnapshot: vi.fn(),
    makeOfficialNews: (input) => ({ id: "news:test", ...input, createdAt: "now", timestamp: "now" }),
    broadcast: vi.fn(),
  };
}

function makeEntry(overrides: Partial<CountryProgressionContentEntry>): CountryProgressionContentEntry {
  return {
    id: "entry:test",
    name: "Entry",
    description: "",
    color: "#ffffff",
    logoUrl: null,
    malePortraitUrl: null,
    femalePortraitUrl: null,
    ...overrides,
  };
}

function createAllowedRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn(),
    requireAuthOrCleanup: vi.fn(),
    requireAdmin: vi.fn(),
    requireAdminOrCleanup: vi.fn(),
    requireSelfOrAdmin: vi.fn().mockResolvedValue({ countryId: "country:a" }),
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
