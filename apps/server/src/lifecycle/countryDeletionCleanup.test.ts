import type { Order, WorldBase } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import { cleanupWorldBaseAfterCountryRemovalFromState, removeCountryOrdersAndReadinessFromState } from "./countryDeletionCleanup";

describe("country deletion cleanup", () => {
  it("removes country orders and readiness and updates order indexes", () => {
    const removedOrders: Order[] = [];
    const droppedTurns: number[] = [];
    const order: Order = {
      id: "order:a",
      turnId: 1,
      playerId: "player:a",
      countryId: "country:a",
      regionId: "1",
      targetHexId: "hex:0:0",
      type: "BUILD",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const ordersByTurn = new Map<number, Map<string, Order[]>>([
      [1, new Map([["country:a", [order]], ["country:b", []]])],
      [2, new Map([["country:a", []]])],
    ]);
    const resolveReadyByTurn = new Map<number, Set<string>>([
      [1, new Set(["country:a", "country:b"])],
      [2, new Set(["country:a"])],
    ]);

    removeCountryOrdersAndReadinessFromState({
      countryId: "country:a",
      ordersByTurn,
      resolveReadyByTurn,
      removeOrderFromTurnIndexes: (entry) => removedOrders.push(entry),
      dropTurnOrderIndexes: (turnId) => droppedTurns.push(turnId),
    });

    expect(ordersByTurn.get(1)?.has("country:a")).toBe(false);
    expect(ordersByTurn.has(2)).toBe(false);
    expect(resolveReadyByTurn.get(1)?.has("country:a")).toBe(false);
    expect(resolveReadyByTurn.has(2)).toBe(false);
    expect(removedOrders).toEqual([order]);
    expect(droppedTurns).toEqual([2]);
  });

  it("removes country references from world base and updates derived indexes", () => {
    const worldBase = createWorldBase();
    const removedEconomyCountries: string[] = [];
    const removedColonizationCountries: string[] = [];
    const removedColonizationHexes: string[] = [];

    cleanupWorldBaseAfterCountryRemovalFromState({
      countryId: "country:a",
      worldBase,
      removeCountryFromEconomyTick: (countryId) => removedEconomyCountries.push(countryId),
      removeCountryFromActiveColonizationIndex: (countryId) => removedColonizationCountries.push(countryId),
      removeRegionFromActiveColonizationIndex: (hexId) => removedColonizationHexes.push(hexId),
    });

    expect(worldBase.resourcesByCountry["country:a"]).toBeUndefined();
    expect(worldBase.hexOwner).toEqual({ "2": "country:b" });
    expect(worldBase.colonyProgressByRegion).toEqual({ "4": { "country:b": 5 } });
    expect(worldBase.regionConstructionQueueByRegion["6"]).toHaveLength(1);
    expect(worldBase.diplomacyProposals).toEqual([]);
    expect(worldBase.countryScheduledEventsByCountryId["country:a"]).toBeUndefined();
    expect(worldBase.countryEventFlagsByCountryId["country:a"]).toBeUndefined();
    expect(worldBase.journalEntriesByCountryId["country:a"]).toBeUndefined();
    expect(worldBase.countryModifiersByCountryId["country:a"]).toBeUndefined();
    expect(removedEconomyCountries).toEqual(["country:a"]);
    expect(removedColonizationCountries).toEqual(["country:a"]);
    expect(removedColonizationHexes).toEqual(["5"]);
  });
});

function createWorldBase(): WorldBase {
  return {
    turnId: 5,
    resourcesByCountry: {
      "country:a": { culture: 1, science: 1, religion: 1, colonization: 1, construction: 1, ducats: 1, gold: 1 },
      "country:b": { culture: 1, science: 1, religion: 1, colonization: 1, construction: 1, ducats: 1, gold: 1 },
    },
    resourceLedgerByTurn: {},
    explanationRecordsByTurn: {},
    regionOwner: { "6": "country:a" },
    regionController: { "6": "country:a" },
    hexOwner: { "1": "country:a", "2": "country:b" },
    hexNameById: {},
    colonyProgressByRegion: { "4": { "country:a": 3, "country:b": 5 }, "5": { "country:a": 2 } },
    regionColonizationByRegion: {},
    regionPopulationByRegion: {},
    regionBuildingsByRegion: {},
    regionBuildingDucatsByRegion: {},
    regionPopulationTreasuryByRegion: {},
    regionConstructionQueueByRegion: {
      "6": [
        {
          queueId: "project:removed",
          requestedByCountryId: "country:a",
          buildingId: "building:farm",
          targetHexId: "hex:0:0",
          owner: { type: "state", countryId: "country:a" },
          progressConstruction: 0,
          costConstruction: 10,
          costDucats: 5,
          createdTurnId: 1,
        },
        {
          queueId: "project:kept",
          requestedByCountryId: "country:b",
          buildingId: "building:mine",
          targetHexId: "hex:1:0",
          owner: { type: "state", countryId: "country:b" },
          progressConstruction: 0,
          costConstruction: 10,
          costDucats: 5,
          createdTurnId: 1,
        },
      ],
    },
    regionResourceDepositsByRegion: {},
    regionResourceExplorationQueueByRegion: {},
    regionResourceExplorationCountByRegion: {},
    parliamentByCountry: { "country:a": { seatsTotal: 0, lastElectionTurn: 1, nextElectionTurn: 1, partySeats: [], governmentPartyIds: [], activeLawByGroupId: {} } },
    technologyByCountry: { "country:a": { researchedTechnologyIds: [], activeTechnologyId: null, activeTechnologyIds: [], progressByTechnologyId: {}, lastScienceSpent: 0, lastCompletedTechnologyIds: [] } },
    countryDecisionsByCountryId: { "country:a": { completedDecisionIds: [], cooldownUntilTurnByDecisionId: {}, usesByDecisionId: {}, usesByDecisionTargetKey: {}, chargesByDecisionId: {}, lastChargeTurnByDecisionId: {}, history: [] } },
    countryEventsByCountryId: { "country:a": { pending: [], completedEventIds: [], cooldownUntilTurnByEventId: {}, history: [] } },
    countryScheduledEventsByCountryId: { "country:a": [] },
    countryEventFlagsByCountryId: { "country:a": { "event:test": true } },
    journalEntriesByCountryId: { "country:a": { active: [], completedJournalEntryIds: [], failedJournalEntryIds: [], cooldownUntilTurnByJournalEntryId: {}, history: [] } },
    countryModifiersByCountryId: {
      "country:a": [
        {
          id: "applied-modifier:a",
          modifierId: "modifier:test",
          countryId: "country:a",
          sourceSystem: "event",
          sourceId: "event:test",
          createdTurnId: 1,
          expiresTurnId: null,
        },
      ],
    },
    civilianUnitsById: {},
    civilianUnitQueueByCountry: {},
    settlementProjectsById: {},
    cityMarkersById: {},
    diplomacyProposals: [
      {
        id: "proposal:a",
        name: "Proposal A",
        fromCountryId: "country:a",
        toCountryId: "country:b",
        createdTurnId: 1,
        expiresTurnId: 2,
        status: "pending",
        clauses: [],
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}
