import { describe, expect, it } from "vitest";
import type { Order, WorldBase } from "@arcanorum/shared";
import type { HexMapIndexEntry } from "../map/hexIndex";
import { createBuildingRuntime } from "./buildingRuntimeState";
import type { BuildingContentEntry, GameSettings } from "./gameSettingsTypes";

describe("buildingRuntimeState", () => {
  it("checks build restrictions against provinces inside a region id", () => {
    const runtime = createBuildingRuntime({
      getWorldBase: () => makeWorld(),
      getGameSettings: () => makeGameSettings(),
      getTurnId: () => 1,
      getOrdersByTurn: () => new Map<number, Map<string, Order[]>>(),
      getHexById: () =>
        new Map([
          ["province:plain", makeHex({ id: "province:plain", regionId: "region:a", landscape: "plain" })],
          ["province:mountain", makeHex({ id: "province:mountain", regionId: "region:a", landscape: "mountain" })],
        ]),
      ensureCountryInWorldBase: () => undefined,
    });

    expect(runtime.getHexBuildRestriction(makeBuilding({ id: "building:mine", allowedLandscapes: ["mountain"] }), "region:a")).toBeNull();
    expect(runtime.getHexBuildRestriction(makeBuilding({ id: "building:port", allowedLandscapes: ["coast"] }), "region:a")).toBe(
      "Ландшафт гекса не подходит для этого здания",
    );
  });
});

function makeHex(overrides: Partial<HexMapIndexEntry>): HexMapIndexEntry {
  return {
    id: "province:a",
    name: "Hex A",
    regionId: "region:a",
    hexColor: "#ffffff",
    regionColor: "#000000",
    areaKm2: 1,
    hexType: null,
    centerX: null,
    centerY: null,
    sourceCenterX: null,
    sourceCenterY: null,
    neighbors: [],
    climate: null,
    pollution: null,
    radiation: null,
    landscape: null,
    continent: null,
    strategicRegion: null,
    fertileLandKm2: null,
    fertility: null,
    ...overrides,
  };
}

function makeBuilding(overrides: Partial<BuildingContentEntry>): BuildingContentEntry {
  return {
    id: "building:a",
    name: "Building",
    description: "",
    color: "#ffffff",
    logoUrl: null,
    malePortraitUrl: null,
    femalePortraitUrl: null,
    ...overrides,
  };
}

function makeWorld(): WorldBase {
  return {
    turnId: 1,
    resourcesByCountry: {},
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
    fleetsById: {},
    airWingsById: {},
    militaryFormationQueueByCountry: {},
    civilianUnitsById: {},
    civilianUnitQueueByCountry: {},
    settlementProjectsById: {},
    cityMarkersById: {},
    equipmentVariantsById: {},
    equipmentProductionLinesByCountry: {},
    equipmentStockpileByCountry: {},
    diplomacyProposals: [],
  };
}

function makeGameSettings(): GameSettings {
  return {
    content: {
      buildings: [],
      companies: [],
    },
    economy: {
      pollutionProductivityEffectPer1000: 0,
    },
  } as unknown as GameSettings;
}
