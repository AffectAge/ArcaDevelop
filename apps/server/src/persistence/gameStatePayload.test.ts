import type { WorldBase } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import { buildGameStatePayload } from "./gameStatePayload";

describe("buildGameStatePayload", () => {
  it("preserves persisted game-state shape", () => {
    const worldBase = createWorldBase();

    const payload = buildGameStatePayload({
      turnId: 7,
      activeScenarioId: "scenario:test",
      activeScenarioName: "Scenario Test",
      gameSettings: { economy: {} },
      worldBase,
      latestMarketOverview: { turnId: 7 },
      ordersByTurn: [{ turnId: 7, players: [] }],
      resolveReadyByTurn: [{ turnId: 7, countryIds: ["country:a"] }],
      adminAuditLog: [],
    });

    expect(payload.turnId).toBe(7);
    expect(payload.activeScenarioId).toBe("scenario:test");
    expect(payload.worldBase.turnId).toBe(7);
    expect(payload.worldBase.activeScenarioId).toBe("scenario:test");
    expect(payload.worldBase.activeScenarioName).toBe("Scenario Test");
    expect(payload.worldBase.latestMarketOverview).toEqual({ turnId: 7 });
    expect(payload.ordersByTurn).toEqual([{ turnId: 7, players: [] }]);
    expect(payload.resolveReadyByTurn).toEqual([{ turnId: 7, countryIds: ["country:a"] }]);
  });
});

function createWorldBase(): WorldBase {
  return {
    turnId: 1,
    resourcesByCountry: {},
    resourceLedgerByTurn: {},
    regionOwner: {},
    regionController: {},
    provinceOwner: {},
    provinceNameById: {},
    colonyProgressByRegion: {},
    regionColonizationByRegion: {},
    regionPopulationByRegion: {},
    regionBuildingsByRegion: {},
    regionBuildingDucatsByRegion: {},
    regionPopulationTreasuryByRegion: {},
    regionConstructionQueueByRegion: {},
    regionResourceDepositsByRegion: {},
    regionResourceExplorationQueueByRegion: {},
    regionResourceExplorationCountByRegion: {},
    parliamentByCountry: {},
    technologyByCountry: {},
    countryDecisionsByCountryId: {},
    countryEventsByCountryId: {},
    divisionTemplatesByCountry: {},
    divisionsById: {},
    militaryFormationQueueByCountry: {},
    diplomacyProposals: [],
  };
}
