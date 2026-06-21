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
    regionOwner: {
      "6": "country:a",
    },
    regionController: {
      "6": "country:a",
    },
    provinceOwner: {
      "1": "country:a",
      "2": "country:b",
      "3": "country:a",
    },
    provinceNameById: {},
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
    countryDecisionsByCountryId: { "country:a": { completedDecisionIds: [], cooldownUntilTurnByDecisionId: {}, history: [] } },
    countryEventsByCountryId: {
      "country:a": { pending: [], completedEventIds: [], cooldownUntilTurnByEventId: {}, history: [] },
    },
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
    militaryFormationQueueByCountry: {
      "country:a": [
        {
          id: "formation:a",
          countryId: "country:a",
          kind: "land",
          templateId: "template:a",
          name: "Formation A",
          provinceId: "1",
          progress: 0,
          turnsTotal: 2,
          turnsRemaining: 2,
          cost: { ducats: 1, manpower: 1, equipmentNeeds: [] },
          createdTurnId: 1,
        },
      ],
    },
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
      ownedProvinceIds: ["1", "3"],
      colonizationProvinceIds: ["4", "5"],
      emptyColonizationProvinceIds: ["5"],
      constructionQueueProvinceIds: ["6"],
      constructionProjectIds: ["project:owned", "project:requested"],
      diplomacyProposalIds: ["proposal:a"],
      divisionIds: ["division:a"],
      divisionTemplateCountryEntry: true,
      militaryFormationQueueEntry: true,
      militaryFormationQueueItemIds: ["formation:a"],
      technologyEntry: true,
      parliamentEntry: true,
      decisionEntry: true,
      eventEntry: true,
      orderTurns: [5],
      resolveReadyTurns: [5],
      assetRefs: [
        { kind: "flag", url: "/scenario-assets/demo/assets/uploads/flags/a.png" },
        { kind: "crest", url: "/scenario-assets/demo/assets/uploads/crests/a.png" },
      ],
    });
    expect(worldBase.resourcesByCountry["country:a"]).toBeDefined();
    expect(worldBase.provinceOwner["1"]).toBe("country:a");
  });

  it("returns an empty plan for an unknown country", () => {
    const plan = planCountryDeletion({ countryId: "country:missing", worldBase: createWorldBase() });

    expect(plan).toMatchObject({
      resourcesEntry: false,
      ownedProvinceIds: [],
      colonizationProvinceIds: [],
      constructionProjectIds: [],
      diplomacyProposalIds: [],
      divisionIds: [],
      orderTurns: [],
      resolveReadyTurns: [],
      assetRefs: [],
    });
  });
});
