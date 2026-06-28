import type { Order, WorldBase } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import { planCountryDeletion } from "./countryDeletionPlan";

function createWorldBase(): WorldBase {
  return {
    turnId: 5,
    resourcesByCountry: {
      "country:a": { culture: 1, science: 1, religion: 1, colonization: 1, construction: 1, ducats: 1, gold: 1 },
    },
    resourceLedgerByTurn: {},
    explanationRecordsByTurn: {},
    regionOwner: {
      "6": "country:a",
    },
    regionController: {
      "6": "country:a",
    },
    hexOwner: {
      "1": "country:a",
      "2": "country:b",
      "3": "country:a",
    },
    hexNameById: {},
    colonyProgressByRegion: {
      "4": { "country:a": 3, "country:b": 5 },
      "5": { "country:a": 2 },
    },
    regionColonizationByRegion: {},
    regionPopulationByRegion: {},
    regionBuildingsByRegion: {},
    regionBuildingDucatsByRegion: {},
    regionPopulationTreasuryByRegion: {},
    regionConstructionQueueByRegion: {
      "6": [
        {
          queueId: "project:requested",
          requestedByCountryId: "country:a",
          buildingId: "building:farm",
          targetHexId: "hex:0:0",
          owner: { type: "company", companyId: "company:x" },
          progressConstruction: 0,
          costConstruction: 10,
          costDucats: 5,
          createdTurnId: 1,
        },
        {
          queueId: "project:owned",
          requestedByCountryId: "country:b",
          buildingId: "building:mine",
          targetHexId: "hex:1:0",
          owner: { type: "state", countryId: "country:a" },
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
    technologyByCountry: {
      "country:a": {
        researchedTechnologyIds: [],
        activeTechnologyId: null,
        activeTechnologyIds: [],
        progressByTechnologyId: {},
        lastScienceSpent: 0,
        lastCompletedTechnologyIds: [],
      },
    },
    countryDecisionsByCountryId: { "country:a": { completedDecisionIds: [], cooldownUntilTurnByDecisionId: {}, usesByDecisionId: {}, usesByDecisionTargetKey: {}, chargesByDecisionId: {}, lastChargeTurnByDecisionId: {}, history: [] } },
    countryEventsByCountryId: {
      "country:a": { pending: [], completedEventIds: [], cooldownUntilTurnByEventId: {}, history: [] },
    },
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
    divisionTemplatesByCountry: { "country:a": [] },
    divisionsById: {
      "division:a": {
        id: "division:a",
        countryId: "country:a",
        templateId: "template:a",
        name: "Division A",
        hexId: "hex:0:0",
        strength: 1,
        organization: 1,
        stats: { manpower: 1, attack: 1, defense: 1, breakthrough: 1, organization: 1, hp: 1, speed: 1, supplyUse: 1 },
        status: "idle",
        path: [],
        createdTurnId: 1,
      },
    },
    fleetsById: {
      "fleet:a": {
        id: "fleet:a",
        countryId: "country:a",
        templateId: "template:navy",
        name: "Fleet A",
        hexId: "hex:0:0",
        strength: 1,
        organization: 1,
        stats: { manpower: 1, attack: 1, defense: 1, breakthrough: 1, organization: 1, hp: 1, speed: 1, supplyUse: 1 },
        status: "idle",
        path: [],
        createdTurnId: 1,
      },
    },
    airWingsById: {
      "air-wing:a": {
        id: "air-wing:a",
        countryId: "country:a",
        templateId: "template:air",
        name: "Air Wing A",
        baseHexId: "hex:0:0",
        strength: 1,
        organization: 1,
        stats: { manpower: 1, attack: 1, defense: 1, breakthrough: 1, organization: 1, hp: 1, speed: 1, supplyUse: 1 },
        status: "idle",
        createdTurnId: 1,
      },
    },
    militaryFormationQueueByCountry: {
      "country:a": [
        {
          id: "formation:a",
          countryId: "country:a",
          kind: "land",
          templateId: "template:a",
          name: "Formation A",
          hexId: "hex:0:0",
          quantity: 1,
          remainingQuantity: 1,
          priority: "normal",
          repeat: false,
          progress: 0,
          turnsTotal: 2,
          turnsRemaining: 2,
          cost: { ducats: 1, manpower: 1, equipmentNeeds: [] },
          createdTurnId: 1,
        },
      ],
    },
    civilianUnitsById: {},
    civilianUnitQueueByCountry: {},
    settlementProjectsById: {},
    cityMarkersById: {},
    equipmentVariantsById: {},
    equipmentProductionLinesByCountry: {},
    equipmentStockpileByCountry: {},
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

describe("country deletion plan", () => {
  it("summarizes all known country references without mutating state", () => {
    const worldBase = createWorldBase();
    const ordersByTurn = new Map<number, Map<string, Order[]>>([[5, new Map([["country:a", []]])]]);
    const resolveReadyByTurn = new Map<number, Set<string>>([[5, new Set(["country:a"])]]);

    const plan = planCountryDeletion({
      countryId: "country:a",
      worldBase,
      ordersByTurn,
      resolveReadyByTurn,
      flagUrl: "/scenario-assets/demo/assets/uploads/flags/a.png",
      crestUrl: "/scenario-assets/demo/assets/uploads/crests/a.png",
    });

    expect(plan).toMatchObject({
      countryId: "country:a",
      resourcesEntry: true,
      ownedHexIds: ["1", "3"],
      colonizationHexIds: ["4", "5"],
      emptyColonizationHexIds: ["5"],
      constructionQueueHexIds: ["6"],
      constructionProjectIds: ["project:owned", "project:requested"],
      diplomacyProposalIds: ["proposal:a"],
      divisionIds: ["division:a"],
      fleetIds: ["fleet:a"],
      airWingIds: ["air-wing:a"],
      divisionTemplateCountryEntry: true,
      militaryFormationQueueEntry: true,
      militaryFormationQueueItemIds: ["formation:a"],
      technologyEntry: true,
      parliamentEntry: true,
      decisionEntry: true,
      eventEntry: true,
      scheduledEventEntry: true,
      eventFlagsEntry: true,
      journalEntry: true,
      countryModifiersEntry: true,
      orderTurns: [5],
      resolveReadyTurns: [5],
      assetRefs: [
        { kind: "flag", url: "/scenario-assets/demo/assets/uploads/flags/a.png" },
        { kind: "crest", url: "/scenario-assets/demo/assets/uploads/crests/a.png" },
      ],
    });
    expect(worldBase.resourcesByCountry["country:a"]).toBeDefined();
    expect(worldBase.hexOwner["1"]).toBe("country:a");
  });

  it("returns an empty plan for an unknown country", () => {
    const plan = planCountryDeletion({ countryId: "country:missing", worldBase: createWorldBase() });

    expect(plan).toMatchObject({
      resourcesEntry: false,
      ownedHexIds: [],
      colonizationHexIds: [],
      constructionProjectIds: [],
      diplomacyProposalIds: [],
      divisionIds: [],
      fleetIds: [],
      airWingIds: [],
      orderTurns: [],
      resolveReadyTurns: [],
      assetRefs: [],
    });
  });
});
