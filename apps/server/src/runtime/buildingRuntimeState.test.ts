import { describe, expect, it } from "vitest";
import type { Order, WorldBase } from "@arcanorum/shared";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import { createBuildingRuntime } from "./buildingRuntimeState";
import type { BuildingContentEntry, GameSettings } from "./gameSettingsTypes";

describe("buildingRuntimeState", () => {
  it("checks build restrictions against provinces inside a region id", () => {
    const runtime = createBuildingRuntime({
      getWorldBase: () => makeWorld(),
      getGameSettings: () => makeGameSettings(),
      getTurnId: () => 1,
      getOrdersByTurn: () => new Map<number, Map<string, Order[]>>(),
      getProvinceById: () =>
        new Map([
          ["province:plain", makeProvince({ id: "province:plain", regionId: "region:a", landscape: "plain" })],
          ["province:mountain", makeProvince({ id: "province:mountain", regionId: "region:a", landscape: "mountain" })],
        ]),
      ensureCountryInWorldBase: () => undefined,
    });

    expect(runtime.getProvinceBuildRestriction(makeBuilding({ id: "building:mine", allowedLandscapes: ["mountain"] }), "region:a")).toBeNull();
    expect(runtime.getProvinceBuildRestriction(makeBuilding({ id: "building:port", allowedLandscapes: ["coast"] }), "region:a")).toBe(
      "Ландшафт провинции не подходит для этого здания",
    );
  });
});

function makeProvince(overrides: Partial<Adm1ProvinceIndexEntry>): Adm1ProvinceIndexEntry {
  return {
    id: "province:a",
    name: "Province A",
    regionId: "region:a",
    provinceColor: "#ffffff",
    regionColor: "#000000",
    areaKm2: 1,
    provinceType: null,
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
    countryScheduledEventsByCountryId: {},
    countryEventFlagsByCountryId: {},
    journalEntriesByCountryId: {},
    countryModifiersByCountryId: {},
    divisionTemplatesByCountry: {},
    divisionsById: {},
    militaryFormationQueueByCountry: {},
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
