import type { BuildingInstance, RegionResourceDeposit, RegionPopulation, WorldBase } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import type { HexMapIndexEntry } from "../map/hexIndex";
import type { GameSettings } from "./gameSettingsTypes";
import { resolveBuildingsTurnForRuntime } from "./buildingTurnRuntime";

describe("buildingTurnRuntime", () => {
  it("processes region-keyed buildings instead of province-keyed building maps", () => {
    const worldBase = makeWorldBase({
      regionOwner: { "region:a": "country:a" },
      regionController: { "region:a": "country:a" },
      regionBuildingsByRegion: {
        "region:a": [makeBuildingInstance({ manualWorkEnabled: false })],
      },
      resourcesByCountry: { "country:a": makeResources({ ducats: 100 }) },
    });

    resolveBuildingsTurnForRuntime(makeDeps(worldBase));

    expect(worldBase.regionBuildingsByRegion["region:a"]?.[0]).toMatchObject({
      isInactive: true,
      inactiveReason: "Отключено вручную",
    });
    expect(worldBase.regionBuildingsByRegion["province:a"]).toBeUndefined();
  });

  it("respects level-gated extraction with deposits", () => {
    const worldBase = makeWorldBase({
      regionOwner: { "region:a": "country:a" },
      regionController: { "region:a": "country:a" },
      regionBuildingsByRegion: {
        "region:a": [makeBuildingInstance({ level: 1 })],
      },
      regionResourceDepositsByRegion: {
        "region:a": [makeDeposit({ amount: 12 })],
      },
      resourcesByCountry: { "country:a": makeResources({ ducats: 100 }) },
    });
    const deps = makeDeps(worldBase);
    deps.gameSettings.content.buildings = [
      {
        id: "building:mine",
        name: "Mine",
        description: "",
        color: "#ffffff",
        logoUrl: null,
        malePortraitUrl: null,
        femalePortraitUrl: null,
        inputs: [],
        outputs: [],
        workforceRequirements: [],
        extractions: [{ goodId: "good:ore", amount: 10, requiresDeposit: true, minLevel: 2 }],
      },
    ];

    resolveBuildingsTurnForRuntime(deps);

    expect(worldBase.regionBuildingsByRegion["region:a"]?.[0]?.lastExtractionByGoodId).toEqual({});
    expect(worldBase.regionResourceDepositsByRegion["region:a"]).toEqual([makeDeposit({ amount: 12 })]);

    worldBase.regionBuildingsByRegion["region:a"]![0]!.level = 2;
    resolveBuildingsTurnForRuntime(deps);

    expect(worldBase.regionBuildingsByRegion["region:a"]?.[0]?.lastExtractionByGoodId).toEqual({ "good:ore": 12 });
    expect(worldBase.regionResourceDepositsByRegion["region:a"]).toEqual([]);
  });

  it("extracts from region-owned deposits and writes remaining deposits by region", () => {
    const worldBase = makeWorldBase({
      regionOwner: { "region:a": "country:a" },
      regionController: { "region:a": "country:a" },
      regionBuildingsByRegion: {
        "region:a": [makeBuildingInstance()],
      },
      regionResourceDepositsByRegion: {
        "region:a": [makeDeposit({ amount: 12 })],
      },
      resourcesByCountry: { "country:a": makeResources({ ducats: 100 }) },
    });

    resolveBuildingsTurnForRuntime(makeDeps(worldBase));

    const building = worldBase.regionBuildingsByRegion["region:a"]?.[0];
    const remainingOre = Object.values(worldBase.regionResourceDepositsByRegion)
      .flat()
      .filter((deposit) => deposit.goodId === "good:ore")
      .reduce((sum, deposit) => sum + deposit.amount, 0);
    expect(building?.lastExtractionByGoodId).toEqual({ "good:ore": 10 });
    expect(remainingOre).toBe(2);
    expect(worldBase.regionResourceDepositsByRegion["region:a"]).toEqual([makeDeposit({ amount: 2 })]);
  });
});

function makeDeps(worldBase: WorldBase): Parameters<typeof resolveBuildingsTurnForRuntime>[0] {
  const gameSettings = makeGameSettings();
  return {
    hexHexIndex: [
      makeHex({ id: "province:a", regionId: "region:a", fertility: 100 }),
      makeHex({ id: "province:b", regionId: "region:a", fertility: 100 }),
    ],
    countryGoodPrices: {},
    createDefaultMarketRecord: (marketId, ownerCountryId) => ({
      id: marketId,
      name: marketId,
      ownerCountryId,
      memberCountryIds: [ownerCountryId],
      logoUrl: null,
      visibility: "public",
      createdAt: "2026-01-01T00:00:00.000Z",
      priceByResourceId: {},
      warehouseByResourceId: {},
      priceHistoryByResourceId: {},
      demandHistoryByResourceId: {},
      offerHistoryByResourceId: {},
      productionFactHistoryByResourceId: {},
      productionMaxHistoryByResourceId: {},
    }),
    buildingBaseThroughput: 1,
    buildingBaseWagePerWorkerGold: 1,
    buildingDurabilityDecayPerTurnFallback: 1,
    buildingDurabilityRecoveryPerTurnFallback: 1,
    corridorLoadHistoryLength: 3,
    defaultMarketPriceSmoothing: 0.2,
    ensureCountryInWorldBase: (countryId) => {
      worldBase.resourcesByCountry[countryId] ??= makeResources();
    },
    gameSettings,
    getActiveCultureNeeds: () => [],
    getBuildingMaxDurability: () => 100,
    getBuildingPollutionProductivityFactor: () => 1,
    getCountryMarketId: () => "market:a",
    getInfrastructureTransitAgreementAllowedCountries: (countries) => countries,
    getMarketById: (marketId) => gameSettings.markets.marketById[marketId] ?? null,
    getPopulationDomainKeys: () => ({
      culturePct: ["culture:a"],
      ideologyPct: ["ideology:a"],
      religionPct: ["religion:a"],
      racePct: ["race:a"],
      professionPct: ["profession:workers"],
    }),
    getHexFertilityMultiplier: () => 1,
    getTransportCorridorCapacity: () => 0,
    globalGoodDemandHistoryByResourceId: {},
    globalGoodOfferHistoryByResourceId: {},
    globalGoodPriceHistoryByResourceId: {},
    globalGoodPrices: {},
    globalGoodProductionFactHistoryByResourceId: {},
    globalGoodProductionMaxHistoryByResourceId: {},
    normalizeHexIdList: (input) => (Array.isArray(input) ? input.map(String) : []),
    normalizeRegionPopulation: (input): RegionPopulation =>
      input && typeof input === "object" && "pops" in input ? (input as RegionPopulation) : { pops: [] },
    resolveModifiedValue: (_stat, base) => base,
    resolvePopulationFallbackKeys: () => ({
      culturePct: "culture:a",
      ideologyPct: "ideology:a",
      religionPct: "religion:a",
      racePct: "race:a",
      professionPct: "profession:workers",
    }),
    round3: (value) => Number(value.toFixed(3)),
    sortCultureNeedsByPriority: (needs) => needs,
    turnId: 1,
    worldBase,
  };
}

function makeWorldBase(overrides?: Partial<WorldBase>): WorldBase {
  return {
    turnId: 1,
    resourcesByCountry: {},
    regionOwner: {},
    regionController: {},
    hexOwner: { "province:a": "country:a", "province:b": "country:a" },
    hexNameById: {},
    colonyProgressByRegion: {},
    regionColonizationByRegion: {},
    regionPopulationByRegion: { "region:a": { pops: [] } },
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
    divisionTemplatesByCountry: {},
    divisionsById: {},
    militaryFormationQueueByCountry: {},
    diplomacyProposals: [],
    ...overrides,
    countryModifiersByCountryId: overrides?.countryModifiersByCountryId ?? {},
    resourceLedgerByTurn: overrides?.resourceLedgerByTurn ?? {},
    explanationRecordsByTurn: overrides?.explanationRecordsByTurn ?? {},
  };
}

function makeGameSettings(): GameSettings {
  return {
    content: {
      buildings: [
        {
          id: "building:mine",
          name: "Mine",
          extractionGoodId: "good:ore",
          extractionAmountPerTurn: 10,
          extractionRequiresDeposit: true,
          inputs: [],
          outputs: [],
          workforceRequirements: [],
        },
      ],
      goods: [{ id: "good:ore", name: "Ore", basePrice: 1 }],
      professions: [{ id: "profession:workers", name: "Workers" }],
      cultures: [],
      ideologies: [],
      religions: [],
      races: [],
      resourceCategories: [],
      hexTypes: [],
      hexClimates: [],
      hexLandscapes: [],
      hexContinents: [],
      hexStrategicRegions: [],
      interestGroups: [],
      parties: [],
      lawGroups: [],
      laws: [],
      technologies: [],
      companies: [],
      industries: [],
      sectors: [],
      modifiers: [],
      decisions: [],
      events: [],
      battalions: [],
      shipTypes: [],
      aircraftTypes: [],
    },
    economy: {
      marketPriceSmoothing: 0.2,
      buildingDurabilityDecayPerTurn: 1,
      buildingDurabilityRecoveryPerTurn: 1,
      pollutionProductivityEffectPer1000: 0,
    },
    markets: {
      marketById: {
        "market:a": {
          id: "market:a",
          name: "Market A",
          ownerCountryId: "country:a",
          memberCountryIds: ["country:a"],
          logoUrl: null,
          visibility: "public",
          createdAt: "2026-01-01T00:00:00.000Z",
          priceByResourceId: {},
          warehouseByResourceId: {},
          priceHistoryByResourceId: {},
          demandHistoryByResourceId: {},
          offerHistoryByResourceId: {},
          productionFactHistoryByResourceId: {},
          productionMaxHistoryByResourceId: {},
        },
      },
      countryMarketByCountryId: { "country:a": "market:a" },
      marketInvitesById: {},
      sanctionsById: {},
      transportCorridorsById: {},
      infrastructureTransitAgreementsById: {},
      infrastructureConstructionRightsById: {},
    },
  } as unknown as GameSettings;
}

function makeBuildingInstance(overrides?: Partial<BuildingInstance>): BuildingInstance {
  return {
    instanceId: "building-instance:mine",
    buildingId: "building:mine",
    targetHexId: "hex:0:0",
    owner: { type: "state", countryId: "country:a" },
    createdTurnId: 1,
    level: 1,
    currentDurability: 100,
    manualWorkEnabled: true,
    stateSubsidiesEnabled: true,
    autoUpgradeEnabled: true,
    ducats: 100,
    warehouseByGoodId: {},
    ...overrides,
  };
}

function makeDeposit(overrides?: Partial<RegionResourceDeposit>): RegionResourceDeposit {
  return {
    goodId: "good:ore",
    amount: 10,
    discoveredTurnId: 1,
    veinSize: "small",
    ...overrides,
  };
}

function makeHex(overrides?: Partial<HexMapIndexEntry>): HexMapIndexEntry {
  return {
    id: "province:a",
    name: "Hex A",
    regionId: "region:a",
    hexColor: "#8fb9a8",
    regionColor: "#22d3ee",
    areaKm2: 100,
    hexType: "land",
    centerX: 0,
    centerY: 0,
    sourceCenterX: 0,
    sourceCenterY: 0,
    neighbors: [],
    climate: "temperate",
    pollution: 0,
    radiation: 0,
    landscape: "plains",
    continent: "continent:a",
    strategicRegion: "strategic:a",
    fertileLandKm2: 100,
    fertility: 100,
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
