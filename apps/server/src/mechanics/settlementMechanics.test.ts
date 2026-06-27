import type { FoundCityOrder, WorldBase } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  resolveFoundCityOrder,
  resolveSettlementProjectsTurn,
  validateFoundCityOrder,
} from "./settlementMechanics";

describe("settlementMechanics", () => {
  it("consumes a colonizer and creates a settlement project for a valid neutral region", () => {
    const worldBase = makeWorldBase();

    const result = resolveFoundCityOrder({
      order: makeFoundCityOrder(),
      playerId: "player:a",
      worldBase,
      getHexRegionId: () => "region:a",
      getRegionColonizationConfig: () => ({ cost: 12, disabled: false, manualCost: false }),
      createId: () => "project:a",
      turnId: 3,
    });

    expect(result).toMatchObject({ accepted: true, rejectedOrder: null });
    expect(worldBase.civilianUnitsById["unit:colonizer"]).toBeUndefined();
    expect(worldBase.settlementProjectsById["settlement:project:a"]).toMatchObject({
      countryId: "country:a",
      regionId: "region:a",
      targetHexId: "hex:0:0",
      progressColonization: 0,
      costColonization: 12,
      state: "active",
      visualState: "underConstruction",
    });
  });

  it("rejects founding on non-neutral regions", () => {
    const worldBase = makeWorldBase({ regionOwner: { "region:a": "country:b" } });

    const result = validateFoundCityOrder({
      order: makeFoundCityOrder(),
      worldBase,
      getHexRegionId: () => "region:a",
      getRegionColonizationConfig: () => ({ cost: 12, disabled: false, manualCost: false }),
    });

    expect(result).toEqual({ ok: false, reason: "REGION_NOT_NEUTRAL" });
  });

  it("advances projects through the resource ledger and stalls when points run out", () => {
    const worldBase = makeWorldBase({
      resourcesByCountry: { "country:a": makeResources({ colonization: 5 }) },
      settlementProjectsById: {
        "settlement:a": {
          id: "settlement:a",
          countryId: "country:a",
          regionId: "region:a",
          targetHexId: "hex:0:0",
          cultureId: "culture:a",
          progressColonization: 0,
          costColonization: 8,
          state: "active",
          visualState: "underConstruction",
          createdTurnId: 1,
        },
        "settlement:b": {
          id: "settlement:b",
          countryId: "country:a",
          regionId: "region:b",
          targetHexId: "hex:1:0",
          cultureId: "culture:a",
          progressColonization: 0,
          costColonization: 8,
          state: "active",
          visualState: "underConstruction",
          createdTurnId: 2,
        },
      },
    });
    const expenses: Array<{ countryId: string; amount: number; labelKey: string }> = [];

    const result = resolveSettlementProjectsTurn({
      worldBase,
      turnId: 4,
      defaultColonizationPointsPerTurn: 1,
      settlementPopulationOnCapture: 100,
      buildSettlementPopulation: makeSettlementPopulation,
      createId: () => "unused",
      addExpense: (input) => expenses.push({ countryId: input.countryId, amount: input.amount, labelKey: input.labelKey }),
    });

    expect(result.completed).toEqual([]);
    expect(worldBase.settlementProjectsById["settlement:a"]?.progressColonization).toBe(5);
    expect(worldBase.settlementProjectsById["settlement:b"]?.state).toBe("stalled");
    expect(worldBase.settlementProjectsById["settlement:b"]?.stallReasonCode).toBe("NO_COLONIZATION_POINTS");
    expect(expenses).toEqual([
      { countryId: "country:a", amount: 5, labelKey: "resourceLedger.source.settlement.progress" },
    ]);
  });

  it("completes a settlement into region ownership, population, and a city marker", () => {
    const worldBase = makeWorldBase({
      resourcesByCountry: { "country:a": makeResources({ colonization: 20 }) },
      settlementProjectsById: {
        "settlement:a": {
          id: "settlement:a",
          countryId: "country:a",
          regionId: "region:a",
          targetHexId: "hex:0:0",
          cultureId: "culture:a",
          progressColonization: 6,
          costColonization: 8,
          state: "active",
          visualState: "underConstruction",
          createdTurnId: 1,
        },
      },
    });

    const result = resolveSettlementProjectsTurn({
      worldBase,
      turnId: 4,
      defaultColonizationPointsPerTurn: 1,
      settlementPopulationOnCapture: 100,
      buildSettlementPopulation: makeSettlementPopulation,
      createId: () => "city:a",
    });

    expect(result.completed).toEqual([
      { projectId: "settlement:a", cityMarkerId: "city:city:a", regionId: "region:a", countryId: "country:a" },
    ]);
    expect(worldBase.settlementProjectsById["settlement:a"]).toBeUndefined();
    expect(worldBase.cityMarkersById["city:city:a"]).toMatchObject({
      countryId: "country:a",
      ownerCountryId: "country:a",
      regionId: "region:a",
      targetHexId: "hex:0:0",
      visualState: "working",
    });
    expect(worldBase.regionOwner["region:a"]).toBe("country:a");
    expect(worldBase.regionController["region:a"]).toBe("country:a");
    expect(worldBase.regionPopulationByRegion["region:a"]?.pops[0]?.size).toBe(100);
  });
});

function makeFoundCityOrder(overrides: Partial<FoundCityOrder> = {}): FoundCityOrder {
  return {
    id: "order:found-city",
    type: "FOUND_CITY",
    turnId: 3,
    playerId: "player:a",
    countryId: "country:a",
    civilianUnitId: "unit:colonizer",
    regionId: "region:a",
    targetHexId: "hex:0:0",
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeWorldBase(overrides: Partial<WorldBase> = {}): WorldBase {
  return {
    turnId: 1,
    resourcesByCountry: { "country:a": makeResources({ colonization: 10 }) },
    resourceLedgerByTurn: {},
    explanationRecordsByTurn: {},
    regionOwner: {},
    regionController: {},
    hexOwner: {},
    hexNameById: {},
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
    countryScheduledEventsByCountryId: {},
    countryEventFlagsByCountryId: {},
    journalEntriesByCountryId: {},
    countryModifiersByCountryId: {},
    divisionTemplatesByCountry: {},
    divisionsById: {},
    militaryFormationQueueByCountry: {},
    civilianUnitsById: {
      "unit:colonizer": {
        id: "unit:colonizer",
        countryId: "country:a",
        type: "colonizer",
        hexId: "hex:0:0",
        status: "idle",
        movementPoints: 2,
        maxMovementPoints: 2,
        path: [],
        createdTurnId: 1,
      },
    },
    civilianUnitQueueByCountry: {},
    settlementProjectsById: {},
    cityMarkersById: {},
    equipmentVariantsById: {},
    equipmentProductionLinesByCountry: {},
    equipmentStockpileByCountry: {},
    diplomacyProposals: [],
    ...overrides,
  };
}

function makeResources(overrides?: Partial<WorldBase["resourcesByCountry"][string]>): WorldBase["resourcesByCountry"][string] {
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

function makeSettlementPopulation(regionId: string, countryId: string, total: number) {
  return {
    pops: [
      {
        id: `pop:${regionId}:${countryId}`,
        size: total,
        cultureId: "culture:a",
        religionId: "religion:a",
        raceId: "race:a",
        ideologies: {},
        professions: {},
      },
    ],
  };
}
