import express from "express";
import type {
  CountryEventRecord,
  CountryParliament,
  DecisionEffect,
  GameEffect,
  GameEventDefinition,
  ResourceTotals,
  WorldBase,
} from "@arcanorum/shared";
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
    expect(resources.ducats).toBe(10);
    expect(deps.applyDecisionCosts).toHaveBeenCalledWith("country:a", "decision:mint", { ducats: 3 });
    expect(deps.applyDecisionEffects).toHaveBeenCalledWith("country:a", [
      { type: "resource_delta", resource: "gold", amount: 1 },
      { type: "trigger_event", eventId: "event:test" },
      { type: "start_journal_entry", journalEntryId: "journal:test" },
    ]);
    expect(deps.applyJournalGameEffects).toHaveBeenCalledWith(expect.objectContaining({
      countryId: "country:a",
      effects: [
        { type: "trigger_event", eventId: "event:test" },
        { type: "start_journal_entry", journalEntryId: "journal:test" },
      ],
    }));
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledWith({ mask: 2044 });
    expect(deps.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "NEWS_EVENT" }));
    expect(deps.ensureCountryDecisionRecord("country:a").usesByDecisionId["decision:mint"]).toBe(1);
    expect(deps.ensureCountryDecisionRecord("country:a").chargesByDecisionId["decision:mint"]).toBe(1);
    expect(deps.ensureCountryDecisionRecord("country:a").lastChargeTurnByDecisionId["decision:mint"]).toBe(5);
    expect(deps.ensureCountryDecisionRecord("country:a").history[0]).toMatchObject({
      decisionId: "decision:mint",
      takenTurnId: 5,
      scopes: { root: { kind: "country", id: "country:a" } },
      appliedEffects: [
        { type: "resource_delta", resource: "gold", amount: 1, direction: "income" },
        { type: "trigger_event", eventId: "event:test" },
        { type: "start_journal_entry", journalEntryId: "journal:test" },
      ],
      explanationIds: [expect.any(String), expect.any(String)],
    });
    expect(deps.getWorldBase().explanationRecordsByTurn[5]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceSystem: "decision",
          sourceId: "decision:mint",
          valueKey: "resource.ducats",
          causes: [expect.objectContaining({ sourceId: "decision:mint", amount: -3 })],
        }),
        expect.objectContaining({
          sourceSystem: "decision",
          sourceId: "decision:mint",
          valueKey: "resource.gold",
          previousValue: 0,
          newValue: 1,
          causes: [expect.objectContaining({ sourceId: "decision:mint", amount: 1 })],
        }),
      ]),
    );
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
    expect(await response.json()).toEqual({ error: "DECISION_UNAVAILABLE", reason: "blocked", reasons: [] });
    expect(deps.applyDecisionEffects).not.toHaveBeenCalled();
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });

  it("stores resolved scopes and applied effect summaries in event history", async () => {
    const eventRecord: CountryEventRecord = {
      pending: [
        {
          id: "pending:test",
          eventId: "event:test",
          countryId: "country:a",
          createdTurnId: 4,
          scopes: { root: { kind: "country", id: "country:a" }, region: { kind: "region", id: "region:capital" } },
          triggerExplanation: [],
        },
      ],
      completedEventIds: [],
      cooldownUntilTurnByEventId: {},
      history: [],
    };
    const resources: ResourceTotals = { ...emptyResources, science: 1 };
    const deps = makeDeps({
      resources,
      eventRecord,
      eventDefinition: {
        category: "economy",
        options: [
          {
            id: "invest",
            labelKey: "events.test.option.invest",
            effects: [
              { type: "add_resource", resource: "science", amount: 2 },
              { type: "schedule_event", eventId: "event:test", delayTurns: 1 },
            ],
          },
        ],
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/events/country:a/pending:test/choose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ optionId: "invest" }),
    });

    expect(response.status).toBe(200);
    expect(eventRecord.history[0]).toMatchObject({
      eventId: "event:test",
      optionId: "invest",
      resolvedTurnId: 5,
      scopes: { region: { kind: "region", id: "region:capital" } },
      appliedEffects: [
        { type: "add_resource", resource: "science", amount: 2, direction: "income" },
        { type: "schedule_event", eventId: "event:test" },
      ],
      explanationIds: [expect.any(String)],
    });
    expect(deps.getWorldBase().explanationRecordsByTurn[5]).toMatchObject([
      {
        id: eventRecord.history[0].explanationIds[0],
        turnId: 5,
        sourceSystem: "event",
        sourceId: "event:test",
        affectedObject: { kind: "country", id: "country:a" },
        valueKey: "resource.science",
        previousValue: 1,
        newValue: 3,
        causes: [{ labelKey: "resourceLedger.source.generic", sourceId: "invest", amount: 2 }],
      },
    ]);
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
  eventRecord?: CountryEventRecord;
  eventDefinition?: GameEventDefinition;
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
    usesByDecisionId: {},
    usesByDecisionTargetKey: {},
    chargesByDecisionId: {},
    lastChargeTurnByDecisionId: {},
    history: [],
  };
  const resources = options?.resources ?? { ...emptyResources };
  const countryEventsByCountryId: Record<string, CountryEventRecord> = options?.eventRecord ? { "country:a": options.eventRecord } : {};
  const worldBase = {
    resourcesByCountry: { "country:a": resources },
    resourceLedgerByTurn: {},
    regionOwner: {},
    regionController: {},
    regionPopulationByRegion: {},
    regionBuildingsByRegion: {},
    regionColonizationByRegion: {},
    colonyProgressByRegion: {},
    regionResourceDepositsByRegion: {},
    countryEventsByCountryId,
    countryScheduledEventsByCountryId: {},
    countryModifiersByCountryId: {},
    explanationRecordsByTurn: {},
  } satisfies Pick<
    WorldBase,
    | "resourcesByCountry"
    | "resourceLedgerByTurn"
    | "regionOwner"
    | "regionController"
    | "regionPopulationByRegion"
    | "regionBuildingsByRegion"
    | "regionColonizationByRegion"
    | "colonyProgressByRegion"
    | "regionResourceDepositsByRegion"
    | "countryEventsByCountryId"
    | "countryScheduledEventsByCountryId"
    | "countryModifiersByCountryId"
    | "explanationRecordsByTurn"
  >;
  return {
    routeAuth: createAllowedRouteAuth(),
    masks: {
      parliamentByCountry: 1,
      technologyByCountry: 2,
      resourcesByCountry: 4,
      colonyProgressByRegion: 8,
      countryDecisionsByCountryId: 16,
      countryEventsByCountryId: 32,
      countryScheduledEventsByCountryId: 64,
      countryEventFlagsByCountryId: 128,
      journalEntriesByCountryId: 256,
      countryModifiersByCountryId: 512,
      explanationRecordsByTurn: 1024,
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
      journalEntries: [],
    }),
    getWorldBase: () => worldBase,
    getCountryResources: () => resources,
    modifierConditionsMatchCountry: () => true,
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
    countryHasModifier: () => false,
    getVisibleCountryDecisions: () => [],
    ensureCountryDecisionRecord: () => decisionRecord,
    getCountryDecisionView: () => ({
      available: options?.decisionAvailable ?? true,
      reason: options?.decisionAvailable === false ? "blocked" : null,
      decision: {
        category: "economy",
        costs: { ducats: 3 },
        effects: [
          { type: "resource_delta", resource: "gold", amount: 1 },
          { type: "trigger_event", eventId: "event:test" },
          { type: "start_journal_entry", journalEntryId: "journal:test" },
        ],
        charges: 2,
        cooldownTurns: 2,
      },
    }),
    applyDecisionEffects: vi.fn((_countryId: string, effects: Array<DecisionEffect | GameEffect> | undefined) => {
      for (const effect of effects ?? []) {
        if (effect.type === "add_resource") {
          resources[effect.resource] = (resources[effect.resource] ?? 0) + effect.amount;
        } else if (effect.type === "spend_resource") {
          resources[effect.resource] = Math.max(0, (resources[effect.resource] ?? 0) - effect.amount);
        } else if (effect.type === "resource_delta") {
          resources[effect.resource] = Math.max(0, (resources[effect.resource] ?? 0) + effect.amount);
        } else if (effect.type === "add_resource_flow") {
          resources[effect.resource] = Math.max(
            0,
            (resources[effect.resource] ?? 0) + (effect.direction === "income" ? effect.amount : -effect.amount),
          );
        }
      }
    }),
    applyJournalGameEffects: vi.fn(),
    applyDecisionCosts: vi.fn(),
    flushResourceLedger: vi.fn(),
    ensureCountryEventRecord: () =>
      options?.eventRecord ?? {
        pending: [],
        completedEventIds: [],
        cooldownUntilTurnByEventId: {},
        history: [],
      },
    getPendingCountryEvents: () => ({ events: [], record: options?.eventRecord ?? {} }),
    getGameEventDefinition: () => options?.eventDefinition ?? { category: "politics", options: [] },
    getCountryScheduledEventsByCountryId: () => ({}),
    getCountryEventFlagsByCountryId: () => ({}),
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
