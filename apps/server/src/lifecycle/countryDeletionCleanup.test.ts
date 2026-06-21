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
    const removedColonizationProvinces: string[] = [];

    cleanupWorldBaseAfterCountryRemovalFromState({
      countryId: "country:a",
      worldBase,
      removeCountryFromEconomyTick: (countryId) => removedEconomyCountries.push(countryId),
      removeCountryFromActiveColonizationIndex: (countryId) => removedColonizationCountries.push(countryId),
      removeRegionFromActiveColonizationIndex: (provinceId) => removedColonizationProvinces.push(provinceId),
    });

    expect(worldBase.resourcesByCountry["country:a"]).toBeUndefined();
    expect(worldBase.provinceOwner).toEqual({ "2": "country:b" });
    expect(worldBase.colonyProgressByRegion).toEqual({ "4": { "country:b": 5 } });
    expect(worldBase.regionConstructionQueueByRegion["6"]).toHaveLength(1);
    expect(worldBase.diplomacyProposals).toEqual([]);
    expect(worldBase.divisionsById).toEqual({});
    expect(worldBase.divisionTemplatesByCountry["country:a"]).toBeUndefined();
    expect(worldBase.militaryFormationQueueByCountry["country:a"]).toBeUndefined();
    expect(removedEconomyCountries).toEqual(["country:a"]);
    expect(removedColonizationCountries).toEqual(["country:a"]);
    expect(removedColonizationProvinces).toEqual(["5"]);
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
    regionOwner: { "6": "country:a" },
    regionController: { "6": "country:a" },
    provinceOwner: { "1": "country:a", "2": "country:b" },
    provinceNameById: {},
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
    countryDecisionsByCountryId: { "country:a": { completedDecisionIds: [], cooldownUntilTurnByDecisionId: {}, history: [] } },
    countryEventsByCountryId: { "country:a": { pending: [], completedEventIds: [], cooldownUntilTurnByEventId: {}, history: [] } },
    divisionTemplatesByCountry: { "country:a": [] },
    divisionsById: {
      "division:a": {
        id: "division:a",
        countryId: "country:a",
        templateId: "template:a",
        name: "Division A",
        provinceId: "1",
        strength: 1,
        organization: 1,
        stats: { manpower: 1, attack: 1, defense: 1, breakthrough: 1, organization: 1, hp: 1, speed: 1, supplyUse: 1 },
        status: "idle",
        path: [],
        createdTurnId: 1,
      },
    },
    militaryFormationQueueByCountry: { "country:a": [] },
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
