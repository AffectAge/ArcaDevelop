import type { JournalEntryDefinition, WorldBase } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import type { GameContentEntry } from "../runtime/gameSettingsTypes";
import { applyJournalGameEffects, resolveJournalEntriesTurn } from "./journalMechanics";

describe("resolveJournalEntriesTurn", () => {
  it("starts and completes country journal entries from triggers", () => {
    const worldBase = makeWorldBase({ gold: 10 });
    const changesTurn1 = resolveJournalEntriesTurn({
      countryIds: ["country:a"],
      entries: [makeJournalEntry({ completeTrigger: { type: "country_resource_above", resource: "gold", value: 5 } })],
      worldBase,
      turnId: 1,
      createId: createIdFactory(),
    });

    expect(changesTurn1.map((change) => change.state)).toEqual(["started"]);
    expect(worldBase.journalEntriesByCountryId["country:a"].active).toHaveLength(1);

    const changesTurn2 = resolveJournalEntriesTurn({
      countryIds: ["country:a"],
      entries: [makeJournalEntry({ completeTrigger: { type: "country_resource_above", resource: "gold", value: 5 } })],
      worldBase,
      turnId: 2,
      createId: createIdFactory("next"),
    });

    expect(changesTurn2.map((change) => change.state)).toEqual(["completed"]);
    expect(worldBase.journalEntriesByCountryId["country:a"].active).toEqual([]);
    expect(worldBase.journalEntriesByCountryId["country:a"].completedJournalEntryIds).toEqual(["journal:test"]);
    expect(worldBase.journalEntriesByCountryId["country:a"].history[0]?.outcomeLabelKey).toBe("journal.outcome.completed");
  });

  it("fails active journal entries when their timeout expires", () => {
    const worldBase = makeWorldBase();
    const entry = makeJournalEntry({ timeoutTurns: 1 });

    resolveJournalEntriesTurn({
      countryIds: ["country:a"],
      entries: [entry],
      worldBase,
      turnId: 1,
      createId: createIdFactory(),
    });
    const changes = resolveJournalEntriesTurn({
      countryIds: ["country:a"],
      entries: [entry],
      worldBase,
      turnId: 2,
      createId: createIdFactory("next"),
    });

    expect(changes.map((change) => change.state)).toEqual(["failed"]);
    expect(worldBase.journalEntriesByCountryId["country:a"].failedJournalEntryIds).toEqual(["journal:test"]);
    expect(worldBase.journalEntriesByCountryId["country:a"].history[0]?.outcomeLabelKey).toBe("journal.outcome.timeout");
  });

  it("keeps repeatable completed entries on cooldown instead of immediately restarting them", () => {
    const worldBase = makeWorldBase();
    const entry = makeJournalEntry({
      repeatable: true,
      cooldownTurns: 3,
      completeTrigger: { type: "always" },
    });

    resolveJournalEntriesTurn({ countryIds: ["country:a"], entries: [entry], worldBase, turnId: 1, createId: createIdFactory() });
    const changes = resolveJournalEntriesTurn({ countryIds: ["country:a"], entries: [entry], worldBase, turnId: 2, createId: createIdFactory("next") });

    const state = worldBase.journalEntriesByCountryId["country:a"];
    expect(changes.map((change) => change.state)).toEqual(["completed"]);
    expect(state.active).toEqual([]);
    expect(state.cooldownUntilTurnByJournalEntryId["journal:test"]).toBe(5);
  });

  it("applies journal game effects to start, advance, set variables, and complete entries", () => {
    const worldBase = makeWorldBase();
    const entry = makeJournalEntry({ progress: { type: "manual", target: 10, labelKey: "journal.test.progress" } });
    const createId = createIdFactory();

    const started = applyJournalGameEffects({
      countryId: "country:a",
      effects: [{ type: "start_journal_entry", journalEntryId: "journal:test" }],
      entries: [entry],
      worldBase,
      turnId: 1,
      createId,
    });
    applyJournalGameEffects({
      countryId: "country:a",
      effects: [
        { type: "advance_journal_entry", journalEntryId: "journal:test", amount: 4 },
        { type: "set_journal_variable", journalEntryId: "journal:test", variableId: "choice", value: "yes" },
      ],
      entries: [entry],
      worldBase,
      turnId: 2,
      createId,
    });
    expect(worldBase.journalEntriesByCountryId["country:a"].active[0]?.progress.current).toBe(4);
    expect(worldBase.journalEntriesByCountryId["country:a"].active[0]?.variables.choice).toBe("yes");
    const completed = applyJournalGameEffects({
      countryId: "country:a",
      effects: [{ type: "complete_journal_entry", journalEntryId: "journal:test" }],
      entries: [entry],
      worldBase,
      turnId: 3,
      createId,
    });

    const state = worldBase.journalEntriesByCountryId["country:a"];
    expect(started.map((change) => change.state)).toEqual(["started"]);
    expect(completed.map((change) => change.state)).toEqual(["completed"]);
    expect(state.active).toEqual([]);
    expect(state.completedJournalEntryIds).toEqual(["journal:test"]);
    expect(state.history[0]?.resolvedTurnId).toBe(3);
  });
});

function makeJournalEntry(journalEntry: Partial<JournalEntryDefinition> = {}): GameContentEntry {
  return {
    id: "journal:test",
    name: "Journal Test",
    description: "",
    color: "#ffffff",
    logoUrl: null,
    malePortraitUrl: null,
    femalePortraitUrl: null,
    journalEntry: {
      category: "politics",
      titleKey: "journal.test.title",
      descriptionKey: "journal.test.description",
      visibility: "private",
      priority: "medium",
      scope: null,
      startTrigger: { type: "always" },
      completeTrigger: null,
      failTrigger: null,
      cancelTrigger: null,
      progress: null,
      timeoutTurns: null,
      onStartEffects: [],
      onCompleteEffects: [],
      onFailEffects: [],
      onCancelEffects: [],
      events: null,
      decisions: null,
      modifiers: null,
      repeatable: false,
      cooldownTurns: 0,
      ...journalEntry,
    },
  };
}

function makeWorldBase(resources: Partial<WorldBase["resourcesByCountry"][string]> = {}): ResolveWorldBase {
  return {
    resourcesByCountry: {
      "country:a": {
        culture: 0,
        science: 0,
        religion: 0,
        colonization: 0,
        construction: 0,
        ducats: 0,
        gold: 0,
        ...resources,
      },
    },
    resourceLedgerByTurn: {},
    regionOwner: {},
    regionController: {},
    regionColonizationByRegion: {},
    colonyProgressByRegion: {},
    regionResourceDepositsByRegion: {},
    regionPopulationByRegion: {},
    regionBuildingsByRegion: {},
    journalEntriesByCountryId: {},
  };
}

type ResolveWorldBase = Parameters<typeof resolveJournalEntriesTurn>[0]["worldBase"];

function createIdFactory(prefix = "id"): () => string {
  let index = 0;
  return () => `${prefix}:${++index}`;
}
