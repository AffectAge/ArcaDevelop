import type { CountryAppliedModifier, CountryDecisionRecord, CountryEventRecord, ResourceTotals, WorldBase } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  applyDecisionCosts,
  applyDecisionEffects,
  applyEventOptionEventEffects,
  autoResolveExpiredCountryEvents,
  canPayDecisionCosts,
  chooseAutoEventOption,
  eventCategoryToUiCategory,
  getCountryDecisionView,
  getGameEventDefinition,
  getPendingCountryEvents,
  getVisibleCountryDecisions,
  maybeGenerateCountryEvents,
  promoteScheduledCountryEvents,
  rechargeCountryDecisionCharges,
  scheduleEventFollowups,
  spendDecisionCharge,
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
        worldBase: makeWorldBase({ resourcesByCountry: { "country:a": makeResources({ ducats: 5 }) } }),
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
        worldBase: makeWorldBase({ resourcesByCountry: { "country:a": makeResources({ ducats: 20 }) } }),
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
        worldBase: makeWorldBase({ resourcesByCountry: { "country:a": resources } }),
        conditionsMatchCountry: (conditions) => !conditions?.some((condition) => condition.targetId === "country:hidden"),
      }).map((row) => row.id),
    ).toEqual(["decision:visible"]);

    expect(canPayDecisionCosts(resources, { ducats: 5 })).toEqual({ ok: true });
    applyDecisionCosts(resources, { ducats: 5 });
    applyDecisionEffects(resources, [{ type: "resource_delta", resource: "gold", amount: 2 }]);
    expect(resources).toMatchObject({ ducats: 15, gold: 3 });
  });

  it("keeps failed-potential decisions visible when authored and returns structured reasons", () => {
    const entry = makeEntry({
      id: "decision:reserve",
      name: "Reserve",
      decision: {
        category: "economy",
        potential: { type: "country_resource_above", resource: "ducats", value: 100 },
        visibleWhenUnavailable: true,
      },
    });

    const view = getCountryDecisionView({
      countryId: "country:a",
      entry,
      record: makeDecisionRecord(),
      turnId: 1,
      resources: makeResources({ ducats: 10 }),
      worldBase: makeWorldBase({ resourcesByCountry: { "country:a": makeResources({ ducats: 10 }) } }),
      conditionsMatchCountry: () => true,
    });

    expect(view).toMatchObject({
      visible: true,
      available: false,
      reasons: [
        {
          code: "potential_failed",
          labelKey: "decisions.reason.potentialFailed",
          currentValue: 10,
          requiredValue: 100,
        },
      ],
    });
  });

  it("blocks decisions when country use limit is exhausted", () => {
    const entry = makeEntry({
      id: "decision:limited",
      name: "Limited",
      decision: { category: "economy", maxUsesPerCountry: 1, repeatable: true },
    });

    const view = getCountryDecisionView({
      countryId: "country:a",
      entry,
      record: makeDecisionRecord({ usesByDecisionId: { "decision:limited": 1 } }),
      turnId: 1,
      resources: makeResources(),
      worldBase: makeWorldBase(),
      conditionsMatchCountry: () => true,
    });

    expect(view.available).toBe(false);
    expect(view.reasons[0]).toMatchObject({
      code: "country_use_limit",
      labelKey: "decisions.reason.countryUseLimit",
      currentValue: 1,
      requiredValue: 1,
    });
  });

  it("blocks charged decisions at zero charges and recharges them over turns", () => {
    const entry = makeEntry({
      id: "decision:charged",
      name: "Charged",
      decision: { category: "economy", charges: 2, rechargeTurns: 3, repeatable: true },
    });
    const record = makeDecisionRecord({ chargesByDecisionId: { "decision:charged": 0 }, lastChargeTurnByDecisionId: { "decision:charged": 5 } });

    const blocked = getCountryDecisionView({
      countryId: "country:a",
      entry,
      record,
      turnId: 5,
      resources: makeResources(),
      worldBase: makeWorldBase(),
      conditionsMatchCountry: () => true,
    });

    expect(blocked.available).toBe(false);
    expect(blocked.reasons[0]).toMatchObject({
      code: "charges_empty",
      labelKey: "decisions.reason.chargesEmpty",
      currentValue: 0,
      requiredValue: 2,
    });

    rechargeCountryDecisionCharges({ record, decisions: [entry], turnId: 8 });
    expect(record.chargesByDecisionId["decision:charged"]).toBe(1);
    expect(record.lastChargeTurnByDecisionId["decision:charged"]).toBe(8);

    spendDecisionCharge(record, "decision:charged", entry.decision!, 9);
    expect(record.chargesByDecisionId["decision:charged"]).toBe(0);
    expect(record.lastChargeTurnByDecisionId["decision:charged"]).toBe(9);
  });

  it("resolves scoped decision targets into decision views", () => {
    const entry = makeEntry({
      id: "decision:region",
      name: "Region decision",
      decision: {
        category: "economy",
        scope: {
          region: {
            kind: "region",
            from: "root.controlled_regions",
            where: { type: "region_has_population_above", value: 1000 },
          },
        },
      },
    });

    const view = getCountryDecisionView({
      countryId: "country:a",
      entry,
      record: makeDecisionRecord(),
      turnId: 1,
      resources: makeResources(),
      worldBase: makeWorldBase({
        regionController: { "region:one": "country:a" },
        regionPopulationByRegion: {
          "region:one": {
            pops: [{ id: "pop:one", size: 1200, cultureId: "culture:a", religionId: "religion:a", raceId: "race:a", ideologies: {}, professions: {} }],
          },
        },
      }),
      conditionsMatchCountry: () => true,
    });

    expect(view.available).toBe(true);
    expect(view.scopes.region).toEqual({ kind: "region", id: "region:one" });
    expect(view.triggerExplanation).toEqual(expect.arrayContaining([expect.objectContaining({ triggerId: "region_has_population_above" })]));
  });

  it("builds pending event views and defaults event definitions", () => {
    const record: CountryEventRecord = {
      pending: [{ id: "pending:a", eventId: "event:a", countryId: "country:a", createdTurnId: 4 }],
      completedEventIds: [],
      cooldownUntilTurnByEventId: {},
      history: [],
    };
    const entry = makeEntry({ id: "event:a", name: "Storm", nameKey: "events.storm.name", event: { category: "economy", options: [{ id: "ok", labelKey: "events.storm.option.ok" }] } });

    expect(getGameEventDefinition(makeEntry({ event: null })).category).toBe("politics");
    expect(getPendingCountryEvents({ countryId: "country:a", record, entries: [entry] }).events).toEqual([
      expect.objectContaining({ pendingId: "pending:a", id: "event:a", name: "Storm", event: entry.event }),
    ]);
  });

  it("chooses automatic event options and maps categories to UI buckets", () => {
    expect(
      chooseAutoEventOption(
        [
          { id: "a", labelKey: "events.test.option.a" },
          { id: "b", labelKey: "events.test.option.b", playerDefault: true },
        ],
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
      event: { category: "economy", checkIntervalTurns: 2, chancePct: 100, options: [{ id: "ok", labelKey: "events.storm.option.ok" }] },
    });

    const generated = maybeGenerateCountryEvents({
      countryIds: ["country:a"],
      entries: [entry],
      turnId: 4,
      ensureCountryEventRecord: (countryId) => records[countryId] ?? makeEventRecord(),
      conditionsMatchCountry: () => true,
      worldBase: makeWorldBase(),
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
      {
        id: "pending:a",
        eventId: "event:a",
        countryId: "country:a",
        createdTurnId: 4,
        expiresTurnId: null,
        scopes: { root: { kind: "country", id: "country:a" } },
        triggerExplanation: [{ triggerId: "always", passed: true, labelKey: "event.trigger.always" }],
      },
    ]);
  });

  it("auto-resolves expired country events, applies effects, and reports notifications to remove", () => {
    const records: Record<string, CountryEventRecord> = {
      "country:a": makeEventRecord({
        pending: [{ id: "pending:a", eventId: "event:a", countryId: "country:a", createdTurnId: 1, expiresTurnId: 2 }],
      }),
    };
    const resourcesByCountry = { "country:a": makeResources({ gold: 1 }) };
    const entry = makeEntry({
      id: "event:a",
      name: "Storm",
      event: {
        category: "economy",
        cooldownTurns: 3,
        options: [{ id: "ok", labelKey: "events.storm.option.ok", playerDefault: true, effects: [{ type: "add_resource", resource: "gold", amount: 2 }] }],
      },
    });

    const result = autoResolveExpiredCountryEvents({
      recordsByCountryId: records,
      countryScheduledEventsByCountryId: {},
      countryEventFlagsByCountryId: {},
      countryModifiersByCountryId: {},
      colonyProgressByRegion: {},
      entries: [entry],
      resourcesByCountry,
      worldBase: makeWorldBase(),
      turnId: 2,
      normalizeCountryEventRecord: (record) => record,
      conditionsMatchCountry: () => true,
      createId: () => "scheduled:a",
      random: () => 0,
    });

    expect(result.notificationIdsToRemove).toEqual(["country-event:country:a:pending:a"]);
    expect(result.resolved).toEqual([
      expect.objectContaining({
        countryId: "country:a",
        pendingId: "pending:a",
        eventId: "event:a",
        optionId: "ok",
        optionLabelKey: "events.storm.option.ok",
      }),
    ]);
    expect(resourcesByCountry["country:a"]?.gold).toBe(3);
    expect(records["country:a"]).toMatchObject({
      pending: [],
      completedEventIds: ["event:a"],
      cooldownUntilTurnByEventId: { "event:a": 5 },
      history: [
        {
          eventId: "event:a",
          optionId: "ok",
          resolvedTurnId: 2,
          titleKey: null,
          optionLabelKey: "events.storm.option.ok",
          scopes: {},
          appliedEffects: [{ type: "add_resource", resource: "gold", amount: 2, direction: "income" }],
          explanationIds: [],
        },
      ],
    });
  });

  it("chooses auto event options by AI utility weights when authored", () => {
    const option = chooseAutoEventOption(
      [
        { id: "save", labelKey: "events.test.option.save", aiWeight: [{ base: 5 }] },
        {
          id: "spend",
          labelKey: "events.test.option.spend",
          playerDefault: true,
          aiWeight: [
            { base: 1 },
            { if: { type: "country_resource_below", resource: "ducats", value: 10 }, add: 20 },
          ],
        },
      ],
      null,
      {
        countryId: "country:a",
        worldBase: makeWorldBase({ resourcesByCountry: { "country:a": makeResources({ ducats: 3 }) } }),
        conditionsMatchCountry: () => true,
      },
    );

    expect(option?.id).toBe("spend");
  });

  it("uses default options for explicit timeouts and schedules chain followups", () => {
    const records: Record<string, CountryEventRecord> = {
      "country:a": makeEventRecord({
        pending: [
          {
            id: "pending:a",
            eventId: "event:a",
            countryId: "country:a",
            createdTurnId: 1,
            expiresTurnId: 3,
            scopes: { root: { kind: "country", id: "country:a" } },
            triggerExplanation: [],
          },
        ],
      }),
    };
    const scheduledByCountryId = {};
    const entry = makeEntry({
      id: "event:a",
      event: {
        category: "politics",
        timeoutTurns: 2,
        defaultOptionId: "default",
        chain: {
          chainId: "chain:test",
          stepId: "start",
          followups: [{ eventId: "event:b", delayTurns: 1 }],
        },
        options: [
          { id: "manual", labelKey: "events.test.option.manual" },
          { id: "default", labelKey: "events.test.option.default" },
        ],
      },
    });

    const result = autoResolveExpiredCountryEvents({
      recordsByCountryId: records,
      countryScheduledEventsByCountryId: scheduledByCountryId,
      countryEventFlagsByCountryId: {},
      countryModifiersByCountryId: {},
      colonyProgressByRegion: {},
      entries: [entry],
      resourcesByCountry: { "country:a": makeResources() },
      worldBase: makeWorldBase(),
      turnId: 3,
      normalizeCountryEventRecord: (record) => record,
      conditionsMatchCountry: () => true,
      createId: () => "scheduled:b",
      random: () => 0,
    });

    expect(result.resolved[0]).toMatchObject({ optionId: "default", optionLabelKey: "events.test.option.default" });
    expect(scheduledByCountryId).toEqual({
      "country:a": [
        expect.objectContaining({
          id: "scheduled:b",
          eventId: "event:b",
          scheduledTurnId: 4,
          chainId: "chain:test",
        }),
      ],
    });
  });

  it("promotes scheduled country events into pending events", () => {
    const records: Record<string, CountryEventRecord> = { "country:a": makeEventRecord() };
    const scheduledByCountryId = {
      "country:a": [
        {
          id: "scheduled:a",
          eventId: "event:b",
          countryId: "country:a",
          scheduledTurnId: 4,
          scopes: { root: { kind: "country" as const, id: "country:a" } },
          chainId: "chain:test",
          createdTurnId: 3,
          triggerExplanation: [],
        },
      ],
    };
    const entry = makeEntry({
      id: "event:b",
      name: "Followup",
      event: { category: "politics", timeoutTurns: 1, options: [{ id: "ok", labelKey: "events.followup.option.ok" }] },
    });

    const promoted = promoteScheduledCountryEvents({
      scheduledByCountryId,
      entries: [entry],
      turnId: 4,
      ensureCountryEventRecord: (countryId) => records[countryId] ?? makeEventRecord(),
      createId: () => "pending:b",
    });

    expect(promoted).toEqual([expect.objectContaining({ pendingId: "pending:b", eventId: "event:b", name: "Followup" })]);
    expect(records["country:a"]?.pending).toEqual([
      expect.objectContaining({ id: "pending:b", eventId: "event:b", expiresTurnId: 5 }),
    ]);
    expect(scheduledByCountryId).toEqual({});
  });

  it("schedules followups when conditions pass", () => {
    const scheduledByCountryId = {};
    const scheduled = scheduleEventFollowups({
      event: {
        category: "politics",
        chain: {
          chainId: "chain:test",
          stepId: "start",
          followups: [{ eventId: "event:next", delayTurns: 2, conditions: { type: "country_resource_above", resource: "ducats", value: 10 } }],
        },
        options: [{ id: "ok", labelKey: "events.test.option.ok" }],
      },
      pending: { countryId: "country:a", scopes: { root: { kind: "country", id: "country:a" } }, triggerExplanation: [] },
      countryScheduledEventsByCountryId: scheduledByCountryId,
      turnId: 4,
      createId: () => "scheduled:next",
      random: () => 0,
      worldBase: makeWorldBase({ resourcesByCountry: { "country:a": makeResources({ ducats: 20 }) } }),
      conditionsMatchCountry: () => true,
    });

    expect(scheduled).toEqual([expect.objectContaining({ id: "scheduled:next", eventId: "event:next", scheduledTurnId: 6 })]);
    expect(scheduledByCountryId).toHaveProperty("country:a");
  });

  it("applies event option event effects to pending, scheduled, and flag state", () => {
    const records: Record<string, CountryEventRecord> = {
      "country:a": makeEventRecord({
        pending: [{ id: "pending:cancel", eventId: "event:cancel", countryId: "country:a", createdTurnId: 1 }],
      }),
    };
    const scheduledByCountryId = {
      "country:a": [
        { id: "scheduled:cancel", eventId: "event:cancel", countryId: "country:a", scheduledTurnId: 4, scopes: {} },
      ],
    };
    const flagsByCountryId = { "country:a": { oldFlag: true } };
    const modifiersByCountryId = {};
    const eventById = new Map([
      ["event:triggered", makeEntry({ id: "event:triggered", event: { category: "politics", timeoutTurns: 1, options: [{ id: "ok", labelKey: "events.triggered.option.ok" }] } })],
      ["event:scheduled", makeEntry({ id: "event:scheduled", event: { category: "politics", options: [{ id: "ok", labelKey: "events.scheduled.option.ok" }] } })],
      ["event:cancel", makeEntry({ id: "event:cancel", event: { category: "politics", options: [{ id: "ok", labelKey: "events.cancel.option.ok" }] } })],
    ]);

    const result = applyEventOptionEventEffects({
      effects: [
        { type: "trigger_event", eventId: "event:triggered" },
        { type: "schedule_event", eventId: "event:scheduled", delayTurns: 2 },
        { type: "cancel_event", eventId: "event:cancel" },
        { type: "set_event_flag", flagId: "newFlag", value: "yes" },
        { type: "clear_event_flag", flagId: "oldFlag" },
      ],
      countryId: "country:a",
      pending: { scopes: { root: { kind: "country", id: "country:a" } }, triggerExplanation: [] },
      eventById,
      recordsByCountryId: records,
      countryScheduledEventsByCountryId: scheduledByCountryId,
      countryEventFlagsByCountryId: flagsByCountryId,
      countryModifiersByCountryId: modifiersByCountryId,
      colonyProgressByRegion: {},
      turnId: 5,
      createId: (() => {
        const ids = ["pending:triggered", "scheduled:new"];
        return () => ids.shift() ?? "generated";
      })(),
      random: () => 0,
    });

    expect(result.triggeredPendingIds).toEqual(["pending:triggered"]);
    expect(records["country:a"]?.pending).toEqual([
      expect.objectContaining({ id: "pending:triggered", eventId: "event:triggered", expiresTurnId: 6 }),
    ]);
    expect(scheduledByCountryId["country:a"]).toEqual([
      expect.objectContaining({ id: "scheduled:new", eventId: "event:scheduled", scheduledTurnId: 7 }),
    ]);
    expect(flagsByCountryId).toEqual({ "country:a": { newFlag: "yes" } });
  });

  it("applies add, extend, and remove modifier effects", () => {
    const modifiersByCountryId: Record<string, CountryAppliedModifier[]> = {};

    const added = applyEventOptionEventEffects({
      effects: [{ type: "add_modifier", modifierId: "modifier:test", durationTurns: 3 }],
      countryId: "country:a",
      pending: { scopes: { root: { kind: "country", id: "country:a" } }, triggerExplanation: [] },
      eventById: new Map(),
      recordsByCountryId: {},
      countryScheduledEventsByCountryId: {},
      countryEventFlagsByCountryId: {},
      countryModifiersByCountryId: modifiersByCountryId,
      colonyProgressByRegion: {},
      turnId: 5,
      createId: () => "applied:1",
      sourceSystem: "decision",
      sourceId: "decision:test",
    });

    expect(added.changedModifierIds).toEqual(["modifier:test"]);
    expect(modifiersByCountryId["country:a"]).toEqual([
      {
        id: "applied:1",
        modifierId: "modifier:test",
        countryId: "country:a",
        sourceSystem: "decision",
        sourceId: "decision:test",
        createdTurnId: 5,
        expiresTurnId: 8,
      },
    ]);

    applyEventOptionEventEffects({
      effects: [{ type: "extend_modifier", modifierId: "modifier:test", durationTurns: 2 }],
      countryId: "country:a",
      pending: { scopes: { root: { kind: "country", id: "country:a" } }, triggerExplanation: [] },
      eventById: new Map(),
      recordsByCountryId: {},
      countryScheduledEventsByCountryId: {},
      countryEventFlagsByCountryId: {},
      countryModifiersByCountryId: modifiersByCountryId,
      colonyProgressByRegion: {},
      turnId: 6,
      createId: () => "unused",
    });
    expect(modifiersByCountryId["country:a"]?.[0]?.expiresTurnId).toBe(10);

    applyEventOptionEventEffects({
      effects: [{ type: "remove_modifier", modifierId: "modifier:test" }],
      countryId: "country:a",
      pending: { scopes: { root: { kind: "country", id: "country:a" } }, triggerExplanation: [] },
      eventById: new Map(),
      recordsByCountryId: {},
      countryScheduledEventsByCountryId: {},
      countryEventFlagsByCountryId: {},
      countryModifiersByCountryId: modifiersByCountryId,
      colonyProgressByRegion: {},
      turnId: 6,
      createId: () => "unused",
    });
    expect(modifiersByCountryId["country:a"]).toBeUndefined();
  });

  it("applies scoped colonization progress effects", () => {
    const colonyProgressByRegion = { "region:frontier": { "country:a": 20 } };

    const result = applyEventOptionEventEffects({
      effects: [{ type: "change_colonization_progress", amount: 7.5 }],
      countryId: "country:a",
      pending: {
        scopes: { root: { kind: "country", id: "country:a" }, region: { kind: "region", id: "region:frontier" } },
        triggerExplanation: [],
      },
      eventById: new Map(),
      recordsByCountryId: {},
      countryScheduledEventsByCountryId: {},
      countryEventFlagsByCountryId: {},
      countryModifiersByCountryId: {},
      colonyProgressByRegion,
      turnId: 7,
      createId: () => "unused",
    });

    expect(colonyProgressByRegion["region:frontier"]?.["country:a"]).toBe(27.5);
    expect(result.changedRegionIds).toEqual(["region:frontier"]);
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
    usesByDecisionId: {},
    usesByDecisionTargetKey: {},
    chargesByDecisionId: {},
    lastChargeTurnByDecisionId: {},
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

function makeWorldBase(
  overrides?: Partial<
    Pick<
      WorldBase,
      | "resourcesByCountry"
      | "resourceLedgerByTurn"
      | "regionOwner"
      | "regionController"
      | "regionPopulationByRegion"
      | "regionBuildingsByRegion"
      | "colonyProgressByRegion"
      | "regionResourceDepositsByRegion"
      | "regionColonizationByRegion"
      | "countryModifiersByCountryId"
    >
  >,
) {
  return {
    resourcesByCountry: { "country:a": makeResources() },
    resourceLedgerByTurn: {},
    regionOwner: {},
    regionController: {},
    regionPopulationByRegion: {},
    regionBuildingsByRegion: {},
    colonyProgressByRegion: {},
    regionResourceDepositsByRegion: {},
    regionColonizationByRegion: {},
    countryModifiersByCountryId: {},
    ...overrides,
  };
}
