import type { CountryDecisionRecord, CountryEventRecord, ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  applyDecisionCosts,
  applyDecisionEffects,
  autoResolveExpiredCountryEvents,
  canPayDecisionCosts,
  chooseAutoEventOption,
  eventCategoryToUiCategory,
  getCountryDecisionView,
  getGameEventDefinition,
  getPendingCountryEvents,
  getVisibleCountryDecisions,
  maybeGenerateCountryEvents,
  type DecisionEventContentEntry,
} from "./decisionEventMechanics";

describe("decisionEventMechanics", () => {
  it("builds decision views with visibility, cooldown, completed, and cost checks", () => {
    const entry = makeEntry({
      id: "decision:mint",
      name: "Mint",
      decision: {
        category: "economy",
        costs: { ducats: 10 },
        effects: [{ type: "resource_delta", resource: "gold", amount: 1 }],
        cooldownTurns: 3,
        repeatable: false,
      },
    });
    const record = makeDecisionRecord();

    expect(
      getCountryDecisionView({
        countryId: "country:a",
        entry,
        record,
        turnId: 5,
        resources: makeResources({ ducats: 5 }),
        conditionsMatchCountry: () => true,
      }),
    ).toMatchObject({ visible: true, available: false, reason: "Недостаточно ducats: нужно 10" });

    record.completedDecisionIds.push("decision:mint");
    expect(
      getCountryDecisionView({
        countryId: "country:a",
        entry,
        record,
        turnId: 5,
        resources: makeResources({ ducats: 20 }),
        conditionsMatchCountry: () => true,
      }),
    ).toMatchObject({ visible: true, available: false, reason: "Уже принято" });
  });

  it("filters visible decisions and applies costs/effects", () => {
    const resources = makeResources({ ducats: 20, gold: 1 });
    const visible = makeEntry({ id: "decision:visible", name: "Visible", decision: { category: "economy", costs: { ducats: 5 } } });
    const hidden = makeEntry({
      id: "decision:hidden",
      name: "Hidden",
      decision: { category: "economy", visibilityConditions: [{ type: "country_is", targetId: "country:hidden" }] },
    });

    expect(
      getVisibleCountryDecisions({
        countryId: "country:a",
        entries: [hidden, visible],
        record: makeDecisionRecord(),
        turnId: 1,
        resources,
        conditionsMatchCountry: (conditions) => !conditions?.some((condition) => condition.targetId === "country:hidden"),
      }).map((row) => row.id),
    ).toEqual(["decision:visible"]);

    expect(canPayDecisionCosts(resources, { ducats: 5 })).toEqual({ ok: true });
    applyDecisionCosts(resources, { ducats: 5 });
    applyDecisionEffects(resources, [{ type: "resource_delta", resource: "gold", amount: 2 }]);
    expect(resources).toMatchObject({ ducats: 15, gold: 3 });
  });

  it("builds pending event views and defaults event definitions", () => {
    const record: CountryEventRecord = {
      pending: [{ id: "pending:a", eventId: "event:a", countryId: "country:a", createdTurnId: 4 }],
      completedEventIds: [],
      cooldownUntilTurnByEventId: {},
      history: [],
    };
    const entry = makeEntry({ id: "event:a", name: "Storm", event: { category: "economy", options: [{ id: "ok", label: "Ok" }] } });

    expect(getGameEventDefinition(makeEntry({ event: null })).category).toBe("politics");
    expect(getPendingCountryEvents({ countryId: "country:a", record, entries: [entry] }).events).toEqual([
      expect.objectContaining({ pendingId: "pending:a", id: "event:a", name: "Storm", event: entry.event }),
    ]);
  });

  it("chooses automatic event options and maps categories to UI buckets", () => {
    expect(
      chooseAutoEventOption(
        [
          { id: "a", label: "A", autoChancePct: 1 },
          { id: "b", label: "B", autoChancePct: 9 },
        ],
        () => 0.5,
      )?.id,
    ).toBe("b");
    expect(eventCategoryToUiCategory("colonization")).toBe("economy");
    expect(eventCategoryToUiCategory("diplomacy")).toBe("politics");
    expect(eventCategoryToUiCategory("system")).toBe("system");
  });

  it("generates eligible country events and returns UI/news-ready results", () => {
    const records: Record<string, CountryEventRecord> = {
      "country:a": makeEventRecord(),
    };
    const entry = makeEntry({
      id: "event:a",
      name: "Storm",
      description: "Clouds gather",
      event: { category: "economy", checkIntervalTurns: 2, chancePct: 100, options: [{ id: "ok", label: "Ok" }] },
    });

    const generated = maybeGenerateCountryEvents({
      countryIds: ["country:a"],
      entries: [entry],
      turnId: 4,
      ensureCountryEventRecord: (countryId) => records[countryId] ?? makeEventRecord(),
      conditionsMatchCountry: () => true,
      createId: () => "pending:a",
      random: () => 0,
    });

    expect(generated).toEqual([
      expect.objectContaining({
        countryId: "country:a",
        pendingId: "pending:a",
        eventId: "event:a",
        name: "Storm",
      }),
    ]);
    expect(records["country:a"]?.pending).toEqual([
      { id: "pending:a", eventId: "event:a", countryId: "country:a", createdTurnId: 4 },
    ]);
  });

  it("auto-resolves expired country events, applies effects, and reports notifications to remove", () => {
    const records: Record<string, CountryEventRecord> = {
      "country:a": makeEventRecord({
        pending: [{ id: "pending:a", eventId: "event:a", countryId: "country:a", createdTurnId: 1 }],
      }),
    };
    const resourcesByCountry = { "country:a": makeResources({ gold: 1 }) };
    const entry = makeEntry({
      id: "event:a",
      name: "Storm",
      event: {
        category: "economy",
        cooldownTurns: 3,
        options: [{ id: "ok", label: "Ok", autoChancePct: 100, effects: [{ type: "resource_delta", resource: "gold", amount: 2 }] }],
      },
    });

    const result = autoResolveExpiredCountryEvents({
      recordsByCountryId: records,
      entries: [entry],
      resourcesByCountry,
      turnId: 2,
      normalizeCountryEventRecord: (record) => record,
      random: () => 0,
    });

    expect(result.notificationIdsToRemove).toEqual(["country-event:country:a:pending:a"]);
    expect(result.resolved).toEqual([
      expect.objectContaining({
        countryId: "country:a",
        pendingId: "pending:a",
        eventId: "event:a",
        optionId: "ok",
        optionLabel: "Ok",
      }),
    ]);
    expect(resourcesByCountry["country:a"]?.gold).toBe(3);
    expect(records["country:a"]).toMatchObject({
      pending: [],
      completedEventIds: ["event:a"],
      cooldownUntilTurnByEventId: { "event:a": 5 },
      history: [{ eventId: "event:a", optionId: "ok", resolvedTurnId: 2, label: "Storm", optionLabel: "Ok" }],
    });
  });
});

function makeEntry(overrides?: Partial<DecisionEventContentEntry>): DecisionEventContentEntry {
  return {
    id: "entry:test",
    name: "Entry",
    description: "",
    color: "#ffffff",
    logoUrl: null,
    decision: null,
    event: null,
    ...overrides,
  };
}

function makeDecisionRecord(overrides?: Partial<CountryDecisionRecord>): CountryDecisionRecord {
  return {
    completedDecisionIds: [],
    cooldownUntilTurnByDecisionId: {},
    history: [],
    ...overrides,
  };
}

function makeEventRecord(overrides?: Partial<CountryEventRecord>): CountryEventRecord {
  return {
    pending: [],
    completedEventIds: [],
    cooldownUntilTurnByEventId: {},
    history: [],
    ...overrides,
  };
}

function makeResources(overrides?: Partial<ResourceTotals>): ResourceTotals {
  return {
    culture: 0,
    science: 0,
    religion: 0,
    colonization: 0,
    construction: 0,
    ducats: 0,
    gold: 0,
    ...overrides,
  };
}
