import type { BuildingInstance, Order, ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import type { HexMapIndexEntry } from "../map/hexIndex";
import {
  countBuildingOccurrences,
  createBuildingConstructionProject,
  enqueueBuildingAutoUpgradesTurn,
  finalizeRegionBuildingTurn,
  getBuildingConstructionTotalCostByLevel,
  getBuildingMaxDurability,
  getBuildingMaxLevel,
  getBuildingPollutionProductivityFactor,
  getBuildingUpgradeCosts,
  getCountryBuildLimit,
  getGlobalBuildLimit,
  getHexBuildRestriction,
  isCountryAllowedForBuildingSync,
  normalizeBuildingCountryLimits,
  parseRequestedBuildingIdFromPayload,
  prepareBuildingInstanceForTurn,
  prepareBuildingOperationEconomics,
  resolveBuildOrder,
  resolveBuildingConstructionQueuesTurn,
  resolveBuildingOperationSettlement,
  resolveBuildingProductionTurn,
  resolveBuildingOwnerFromPayload,
  transferStateOwnedBuildingsToController,
  type BuildingConstructionWorldState,
  type BuildingMechanicsContentEntry,
} from "./buildingMechanics";

describe("buildingMechanics", () => {
  it("normalizes limits and calculates building costs, levels, and durability", () => {
    const building: BuildingMechanicsContentEntry = {
      id: "building:mill",
      costConstruction: 120,
      costDucats: 12.3456,
      maxLevel: 4.9,
      maxDurability: 87.4567,
      upgradeCostConstruction: 55.9,
      upgradeCostDucats: 6.789,
      countryBuildLimits: [
        { countryId: "country:a", limit: 2 },
        { countryId: "country:b", limit: null },
      ],
      globalBuildLimit: 7.9,
    };

    expect(normalizeBuildingCountryLimits(building.countryBuildLimits)).toEqual([
      { countryId: "country:a", limit: 2 },
      { countryId: "country:b", limit: null },
    ]);
    expect(getCountryBuildLimit(building, "country:a")).toBe(2);
    expect(getCountryBuildLimit(building, "country:b")).toBeNull();
    expect(getCountryBuildLimit(building, "country:c")).toBeUndefined();
    expect(getGlobalBuildLimit(building)).toBe(7);
    expect(getBuildingMaxLevel(building)).toBe(4);
    expect(getBuildingMaxDurability(building)).toBe(87.457);
    expect(getBuildingUpgradeCosts(building)).toEqual({ costConstruction: 55, costDucats: 6.789 });
    expect(getBuildingConstructionTotalCostByLevel(building, 3)).toBe(230);
    expect(
      createBuildingConstructionProject({
        queueId: "queue:a",
        requestedByCountryId: "country:a",
        building,
        targetHexId: "hex:0:0",
        owner: { type: "state", countryId: "country:a" },
        turnId: 9,
        costConstruction: 155.7,
      }),
    ).toMatchObject({
      queueId: "queue:a",
      requestedByCountryId: "country:a",
      buildingId: "building:mill",
      projectType: "build",
      costConstruction: 155,
      costDucats: 12.3456,
      createdTurnId: 9,
      targetHexId: "hex:0:0",
    });
  });

  it("applies country allow/deny rules and province restrictions", () => {
    const province = makeHex({
      hexType: "coast",
      climate: "temperate",
      landscape: "plain",
      continent: "europe",
      strategicRegion: "bohemia",
      radiation: 12,
    });

    expect(
      isCountryAllowedForBuildingSync(
        { id: "building:port", allowedCountryIds: ["country:a"], deniedCountryIds: ["country:b"] },
        "country:a",
      ),
    ).toBe(true);
    expect(
      isCountryAllowedForBuildingSync(
        { id: "building:port", allowedCountryIds: ["country:a"], deniedCountryIds: ["country:b"] },
        "country:b",
      ),
    ).toBe(false);
    expect(
      getHexBuildRestriction(
        {
          id: "building:port",
          allowedHexTypes: ["coast"],
          deniedClimates: ["arctic"],
          minRadiation: 10,
          maxRadiation: 20,
        },
        province,
      ),
    ).toBeNull();
    expect(getHexBuildRestriction({ id: "building:mine", allowedLandscapes: ["mountain"] }, province)).toBe(
      "Ландшафт гекса не подходит для этого здания",
    );
  });

  it("calculates pollution productivity factors by mode", () => {
    const province = makeHex({ pollution: 500 });

    expect(
      getBuildingPollutionProductivityFactor({
        building: { id: "building:farm", pollutionProductivityMode: "penalty" },
        province,
        pollutionProductivityEffectPer1000: 0.2,
      }),
    ).toBe(0.9);
    expect(
      getBuildingPollutionProductivityFactor({
        building: { id: "building:smog", pollutionProductivityMode: "bonus" },
        province,
        pollutionProductivityEffectPer1000: 0.2,
      }),
    ).toBe(1.1);
  });

  it("counts existing buildings, construction queue, and pending build orders for limits", () => {
    const worldBase = makeWorld({
      regionOwner: { "region:a": "country:a", "region:b": "country:b" },
      regionBuildingsByRegion: {
        "region:a": [makeInstance({ buildingId: "building:mill", level: 2 })],
        "region:b": [makeInstance({ buildingId: "building:mill", level: 1 })],
      },
      regionConstructionQueueByRegion: {
        "region:a": [makeProject({ buildingId: "building:mill", projectType: "build" })],
        "region:b": [makeProject({ buildingId: "building:mill", projectType: "upgrade" })],
      },
    });
    const pendingOrder = makeOrder({
      countryId: "country:a",
      regionId: "region:a",
      payload: { buildingId: "building:mill" },
    });

    expect(
      countBuildingOccurrences({
        buildingId: "building:mill",
        countryId: "country:a",
        worldBase,
        pendingOrders: [pendingOrder],
        parseRequestedBuildingId: (payload) => parseRequestedBuildingIdFromPayload(payload, "building:fallback"),
      }),
    ).toEqual({ byCountry: 4, global: 5 });
  });

  it("resolves building owner payload against known companies and countries", () => {
    const companyIds = new Set(["company:a"]);
    const countryIds = new Set(["country:a", "country:b"]);

    expect(resolveBuildingOwnerFromPayload({ payload: {}, requestedByCountryId: "country:a", companyIds, countryIds })).toEqual({
      type: "state",
      countryId: "country:a",
    });
    expect(
      resolveBuildingOwnerFromPayload({
        payload: { owner: { type: "company", companyId: "company:a" } },
        requestedByCountryId: "country:a",
        companyIds,
        countryIds,
      }),
    ).toEqual({ type: "company", companyId: "company:a" });
    expect(
      resolveBuildingOwnerFromPayload({
        payload: { owner: { type: "company", companyId: "missing" } },
        requestedByCountryId: "country:a",
        companyIds,
        countryIds,
      }),
    ).toBeNull();
  });

  it("resolves build orders into construction queue projects", () => {
    const worldBase = makeWorld({ regionOwner: { "region:a": "country:a" } });
    const building: BuildingMechanicsContentEntry = {
      id: "building:mill",
      costConstruction: 100,
      costDucats: 15,
    };

    const result = resolveBuildOrder({
      order: makeOrder({ payload: { buildingId: "building:mill" } }),
      playerId: "player:a",
      worldBase,
      buildingById: new Map([["building:mill", building]]),
      turnId: 9,
      parseRequestedBuildingId: (payload) => parseRequestedBuildingIdFromPayload(payload, ""),
      resolveBuildingOwner: (payload, requestedByCountryId) =>
        resolveBuildingOwnerFromPayload({
          payload,
          requestedByCountryId,
          companyIds: new Set(),
          countryIds: new Set(["country:a"]),
        }),
      isCountryAllowedForBuilding: () => true,
      getHexBuildRestriction: () => null,
      isBuildingUnlockedForCountry: () => true,
      countBuildingOccurrences: () => ({ byCountry: 0, global: 0 }),
      resolveConstructionCost: () => 42,
      createId: () => "queue:a",
    });

    expect(result).toEqual({
      rejectedOrder: null,
      queuedProject: expect.objectContaining({
        queueId: "queue:a",
        buildingId: "building:mill",
        requestedByCountryId: "country:a",
        targetHexId: "hex:0:0",
        costConstruction: 42,
        costDucats: 15,
      }),
    });
    expect(worldBase.regionConstructionQueueByRegion["region:a"]).toEqual([result.queuedProject]);
  });

  it("rejects build orders without a target hex", () => {
    const order = makeOrder({ payload: { buildingId: "building:mill" } }) as Partial<Extract<Order, { type: "BUILD" }>>;
    delete order.targetHexId;

    const result = resolveBuildOrder({
      order: order as Extract<Order, { type: "BUILD" }>,
      playerId: "player:a",
      worldBase: makeWorld({ regionOwner: { "region:a": "country:a" } }),
      buildingById: new Map([["building:mill", { id: "building:mill" }]]),
      turnId: 9,
      parseRequestedBuildingId: (payload) => parseRequestedBuildingIdFromPayload(payload, ""),
      resolveBuildingOwner: () => ({ type: "state", countryId: "country:a" }),
      isCountryAllowedForBuilding: () => true,
      getHexBuildRestriction: () => null,
      isBuildingUnlockedForCountry: () => true,
      countBuildingOccurrences: () => ({ byCountry: 0, global: 0 }),
      resolveConstructionCost: () => 42,
      createId: () => "queue:a",
    });

    expect(result.rejectedOrder).toEqual({
      playerId: "player:a",
      reason: "BUILD_TARGET_HEX_REQUIRED",
      tempOrderId: "order:a",
    });
    expect(result.queuedProject).toBeNull();
  });

  it("rejects build orders for ownership conflicts, locked tech, and build limits", () => {
    const building: BuildingMechanicsContentEntry = {
      id: "building:mill",
      countryBuildLimits: [{ countryId: "country:a", limit: 1 }],
    };
    const baseParams = {
      order: makeOrder({ payload: { buildingId: "building:mill" } }),
      playerId: "player:a",
      buildingById: new Map([["building:mill", building]]),
      turnId: 9,
      parseRequestedBuildingId: (payload: Record<string, unknown>) => parseRequestedBuildingIdFromPayload(payload, ""),
      resolveBuildingOwner: () => ({ type: "state" as const, countryId: "country:a" }),
      isCountryAllowedForBuilding: () => true,
      getHexBuildRestriction: () => null,
      resolveConstructionCost: () => 100,
      createId: () => "queue:a",
    };

    expect(
      resolveBuildOrder({
        ...baseParams,
        worldBase: makeWorld({ regionOwner: { "region:a": "country:b" } }),
        isBuildingUnlockedForCountry: () => true,
        countBuildingOccurrences: () => ({ byCountry: 0, global: 0 }),
      }).rejectedOrder,
    ).toEqual({ playerId: "player:a", reason: "BUILD_CONFLICT", tempOrderId: "order:a" });

    expect(
      resolveBuildOrder({
        ...baseParams,
        worldBase: makeWorld({ regionOwner: { "region:a": "country:a" } }),
        isBuildingUnlockedForCountry: () => false,
        countBuildingOccurrences: () => ({ byCountry: 0, global: 0 }),
      }).rejectedOrder,
    ).toEqual({ playerId: "player:a", reason: "BUILD_LOCKED_BY_TECH", tempOrderId: "order:a" });

    expect(
      resolveBuildOrder({
        ...baseParams,
        worldBase: makeWorld({ regionOwner: { "region:a": "country:a" } }),
        isBuildingUnlockedForCountry: () => true,
        countBuildingOccurrences: () => ({ byCountry: 1, global: 1 }),
      }).rejectedOrder,
    ).toEqual({ playerId: "player:a", reason: "BUILD_INVALID", tempOrderId: "order:a" });
  });

  it("finalizes province building turn accounting and removes depleted deposits", () => {
    const kept = makeInstance({
      instanceId: "instance:kept",
      buildingId: "building:mill",
      ducats: 12,
      lastRevenueDucats: 20,
      lastInputCostDucats: 3,
      lastWagesDucats: 4,
    });
    const removed = makeInstance({ instanceId: "instance:removed", buildingId: "building:mine", ducats: 99 });

    const result = finalizeRegionBuildingTurn({
      buildingInstances: [removed, kept],
      removedInstanceIds: new Set(["instance:removed"]),
      previousPopulationTreasury: 5,
      regionWages: 7.1234,
      regionResourceDeposits: [
        { goodId: "good:zinc", amount: 0, discoveredTurnId: 1, veinSize: "small" },
        { goodId: "good:coal", amount: 2, discoveredTurnId: 1, veinSize: "medium" },
        { goodId: "good:iron", amount: 1, discoveredTurnId: 1, veinSize: "large" },
      ],
    });

    expect(result.activeBuildingInstances).toEqual([kept]);
    expect(kept.lastNetDucats).toBe(13);
    expect(result.populationTreasury).toBe(12.123);
    expect(result.buildingDucatsByBuildingId).toEqual({ "building:mill": 12 });
    expect(result.resourceDeposits).toEqual([
      { goodId: "good:coal", amount: 2, discoveredTurnId: 1, veinSize: "medium" },
      { goodId: "good:iron", amount: 1, discoveredTurnId: 1, veinSize: "large" },
    ]);
  });

  it("prepares building instances for a new turn and preserves manual disable state", () => {
    const instance = makeInstance({
      level: 2.9,
      ducats: -5,
      currentDurability: 120,
      warehouseByGoodId: { "good:grain": 3 },
      lastRevenueDucats: 9,
      lastPurchaseByGoodId: { "good:grain": 1 },
      isInactive: true,
      inactiveReason: "old",
      manualWorkEnabled: false,
    });

    const result = prepareBuildingInstanceForTurn({ instance, maxDurability: 80 });

    expect(result).toEqual({ manualWorkEnabled: false, instanceLevel: 2 });
    expect(instance).toMatchObject({
      level: 2,
      ducats: 0,
      currentDurability: 80,
      warehouseByGoodId: { "good:grain": 3 },
      lastPurchaseByGoodId: {},
      lastRevenueDucats: 0,
      lastNetDucats: 0,
      isInactive: false,
      inactiveReason: null,
      manualWorkEnabled: false,
    });
  });

  it("prepares building operation economics with wages, input demand, subsidy, and finance coverage", () => {
    const instance = makeInstance({
      ducats: 5,
      warehouseByGoodId: { "good:grain": 2 },
      stateSubsidiesEnabled: true,
      owner: { type: "state", countryId: "country:a" },
    });
    const countryDucats: Record<string, number> = { "country:a": 100 };
    const demanded: Record<string, number> = {};

    const result = prepareBuildingOperationEconomics({
      instance,
      building: {
        id: "building:farm",
        workforceRequirements: [{ professionId: "profession:farmers", workers: 10 }],
        inputs: [{ goodId: "good:grain", amount: 6 }],
      },
      ownerCountryId: "country:a",
      instanceLevel: 2,
      laborCoverageHex: 0.5,
      buildingThroughput: 1,
      professionsById: new Map([["profession:farmers", { professionId: "profession:farmers", baseWage: 2 }]]),
      wageMultiplierByProfession: { "profession:farmers": 1.5 },
      getBaseWageFallback: () => 1,
      resolveWage: (_professionId, baseWage) => baseWage,
      resolveInputAmount: (input) => input.amount,
      getInputPrice: () => 3,
      addInputDemand: (goodId, amount) => {
        demanded[goodId] = amount;
      },
      ensureCountry: (countryId) => {
        countryDucats[countryId] ??= 0;
      },
      getCountryDucats: (countryId) => countryDucats[countryId] ?? 0,
      setCountryDucats: (countryId, amount) => {
        countryDucats[countryId] = amount;
      },
    });

    expect(result).toMatchObject({
      wagesEstimate: 60,
      wagesEstimateByProfession: { "profession:farmers": 60 },
      requiredInputValueEstimate: 12,
      inputNeeds: [{ goodId: "good:grain", required: 6, available: 2 }],
      workersDemand: 20,
      laborCoverage: 0.5,
      infraCoverage: 1,
      financeCoverage: 1,
      subsidyCountryId: "country:a",
      subsidiesEnabled: true,
      grantedStateSubsidy: 67,
    });
    expect(instance.ducats).toBe(72);
    expect(instance.lastStateSubsidyDucats).toBe(67);
    expect(countryDucats["country:a"]).toBe(33);
    expect(demanded).toEqual({ "good:grain": 4 });
  });

  it("enqueues auto-upgrades only for productive eligible buildings and spends instance ducats", () => {
    const worldBase = makeWorld({
      regionOwner: { "region:a": "country:a" },
      regionBuildingsByRegion: {
        "region:a": [
          makeInstance({
            instanceId: "instance:a",
            buildingId: "building:mill",
            targetHexId: "hex:0:0",
            level: 1,
            lastProductivity: 1,
            currentDurability: 100,
            ducats: 20,
          }),
        ],
      },
    });

    enqueueBuildingAutoUpgradesTurn({
      worldBase,
      buildings: [{ id: "building:mill", maxLevel: 3, upgradeCostConstruction: 50, upgradeCostDucats: 7 }],
      turnId: 5,
      ensureCountryInWorldBase: () => undefined,
      createId: () => "queue:upgrade",
    });

    expect(worldBase.regionBuildingsByRegion["region:a"]?.[0]?.ducats).toBe(13);
    expect(worldBase.regionConstructionQueueByRegion["region:a"]).toEqual([
      expect.objectContaining({
        queueId: "queue:upgrade",
        projectType: "upgrade",
        targetInstanceId: "instance:a",
        targetHexId: "hex:0:0",
        costConstruction: 50,
        costDucats: 0,
      }),
    ]);
  });

  it("progresses construction queues and creates or upgrades building instances", () => {
    const worldBase = makeWorld({
      regionOwner: { "region:a": "country:a" },
      resourcesByCountry: { "country:a": makeResources({ construction: 200, ducats: 100 }) },
      regionBuildingsByRegion: {
        "region:a": [makeInstance({ instanceId: "instance:a", buildingId: "building:mill", targetHexId: "hex:0:0", level: 1 })],
      },
      regionConstructionQueueByRegion: {
        "region:a": [
          makeProject({
            queueId: "queue:build",
            buildingId: "building:mine",
            targetHexId: "hex:1:0",
            costConstruction: 50,
            costDucats: 20,
          }),
          makeProject({
            queueId: "queue:upgrade",
            buildingId: "building:mill",
            projectType: "upgrade",
            targetInstanceId: "instance:a",
            targetHexId: "hex:0:0",
            costConstruction: 40,
            costDucats: 0,
          }),
        ],
      },
    });

    resolveBuildingConstructionQueuesTurn({
      worldBase,
      buildings: [
        { id: "building:mine", startingDucats: 4, maxDurability: 80 },
        { id: "building:mill", maxLevel: 3 },
      ],
      turnId: 8,
      createId: () => "instance:new",
    });

    expect(worldBase.resourcesByCountry["country:a"]).toMatchObject({ construction: 110, ducats: 80 });
    expect(worldBase.regionConstructionQueueByRegion["region:a"]).toEqual([]);
    expect(worldBase.regionBuildingsByRegion["region:a"]).toEqual([
      expect.objectContaining({ instanceId: "instance:a", buildingId: "building:mill", targetHexId: "hex:0:0", level: 2 }),
      expect.objectContaining({
        instanceId: "instance:new",
        buildingId: "building:mine",
        targetHexId: "hex:1:0",
        currentDurability: 80,
        ducats: 4,
      }),
    ]);
  });

  it("transfers only state-owned buildings when region control changes", () => {
    const worldBase = makeWorld({
      regionBuildingsByRegion: {
        "region:a": [
          makeInstance({
            instanceId: "instance:state",
            owner: { type: "state", countryId: "country:a" },
            targetHexId: "hex:0:0",
          }),
          makeInstance({
            instanceId: "instance:company",
            owner: { type: "company", companyId: "company:a" },
            targetHexId: "hex:1:0",
          }),
        ],
      },
    });

    transferStateOwnedBuildingsToController({
      worldBase,
      regionId: "region:a",
      controllerCountryId: "country:b",
    });

    expect(worldBase.regionBuildingsByRegion["region:a"]).toEqual([
      expect.objectContaining({ instanceId: "instance:state", owner: { type: "state", countryId: "country:b" } }),
      expect.objectContaining({ instanceId: "instance:company", owner: { type: "company", companyId: "company:a" } }),
    ]);
  });

  it("resolves input coverage, consumption, and fertility-affected production", () => {
    const warehouse = { "good:grain": 5 };
    const productionMax: Record<string, number> = {};
    const production: Record<string, number> = {};

    const result = resolveBuildingProductionTurn({
      building: {
        id: "building:farm",
        inputs: [{ goodId: "good:grain", amount: 10 }],
        outputs: [{ goodId: "good:food", amount: 4, affectedByFertility: true }],
      },
      instanceLevel: 2,
      warehouse,
      regionResourceDeposits: [],
      laborCoverage: 0.5,
      infraCoverage: 1,
      financeCoverage: 1,
      currentDurability: 80,
      maxDurability: 100,
      buildingThroughput: 1,
      fertilityMultiplier: 1.25,
      pollutionProductivityFactor: 1,
      resolveInputAmount: (input) => input.amount,
      resolveOutputAmount: (_goodId, baseAmount) => baseAmount,
      addProductionMax: (goodId, amount) => {
        productionMax[goodId] = amount;
      },
      addProduction: (goodId, amount) => {
        production[goodId] = amount;
      },
    });

    expect(result).toMatchObject({
      inputCoverage: 0.5,
      extractionCoverage: 1,
      durabilityCoverage: 0.8,
      productivity: 0.5,
      missingInputGoodIds: ["good:grain"],
      consumedByGood: { "good:grain": 5 },
      producedByGood: { "good:food": 5 },
      extractedByGood: {},
    });
    expect(warehouse).toEqual({ "good:grain": 0, "good:food": 5 });
    expect(productionMax).toEqual({ "good:food": 5 });
    expect(production).toEqual({ "good:food": 5 });
  });

  it("activates and retires level-gated inputs and outputs", () => {
    const warehouse = { "good:grain": 100 };
    const productionMax: Record<string, number> = {};
    const production: Record<string, number> = {};

    const result = resolveBuildingProductionTurn({
      building: {
        id: "building:mill",
        inputs: [
          { goodId: "good:grain", amount: 10, minLevel: 2, maxLevel: 3 },
          { goodId: "good:coal", amount: 10, minLevel: 4 },
        ],
        outputs: [
          { goodId: "good:flour", amount: 4, minLevel: 2, maxLevel: 3 },
          { goodId: "good:steel", amount: 4, minLevel: 4 },
        ],
      },
      instanceLevel: 3,
      warehouse,
      regionResourceDeposits: [],
      laborCoverage: 1,
      infraCoverage: 1,
      financeCoverage: 1,
      currentDurability: 100,
      maxDurability: 100,
      buildingThroughput: 1,
      fertilityMultiplier: 1,
      pollutionProductivityFactor: 1,
      resolveInputAmount: (input) => input.amount,
      resolveOutputAmount: (_goodId, baseAmount) => baseAmount,
      addProductionMax: (goodId, amount) => {
        productionMax[goodId] = amount;
      },
      addProduction: (goodId, amount) => {
        production[goodId] = amount;
      },
    });

    expect(result.consumedByGood).toEqual({ "good:grain": 30 });
    expect(result.producedByGood).toEqual({ "good:flour": 12 });
    expect(warehouse).toEqual({ "good:grain": 70, "good:flour": 12 });
    expect(productionMax).toEqual({ "good:flour": 12 });
    expect(production).toEqual({ "good:flour": 12 });
  });

  it("keeps legacy buildings without flow levels active", () => {
    const demanded: Record<string, number> = {};
    const instance = makeInstance({ warehouseByGoodId: {} });

    const result = prepareBuildingOperationEconomics({
      instance,
      building: { id: "building:legacy", inputs: [{ goodId: "good:grain", amount: 2 }] },
      ownerCountryId: "country:a",
      instanceLevel: 5,
      laborCoverageHex: 1,
      buildingThroughput: 1,
      professionsById: new Map(),
      wageMultiplierByProfession: {},
      getBaseWageFallback: () => 1,
      resolveWage: (_professionId, baseWage) => baseWage,
      resolveInputAmount: (input) => input.amount,
      getInputPrice: () => 1,
      addInputDemand: (goodId, amount) => {
        demanded[goodId] = amount;
      },
      ensureCountry: () => undefined,
      getCountryDucats: () => 0,
      setCountryDucats: () => undefined,
    });

    expect(result.inputNeeds).toEqual([{ goodId: "good:grain", required: 10, available: 0 }]);
    expect(demanded).toEqual({ "good:grain": 10 });
  });

  it("resolves deposit extraction and depletes available deposits", () => {
    const warehouse: Record<string, number> = {};
    const deposits = [{ goodId: "good:ore", amount: 3 }];
    const productionMax: Record<string, number> = {};
    const production: Record<string, number> = {};

    const result = resolveBuildingProductionTurn({
      building: {
        id: "building:mine",
        extractionGoodId: "good:ore",
        extractionAmountPerTurn: 5,
        extractionRequiresDeposit: true,
      },
      instanceLevel: 1,
      warehouse,
      regionResourceDeposits: deposits,
      laborCoverage: 1,
      infraCoverage: 1,
      financeCoverage: 1,
      currentDurability: 100,
      maxDurability: 100,
      buildingThroughput: 1,
      fertilityMultiplier: 1,
      pollutionProductivityFactor: 1,
      resolveInputAmount: (input) => input.amount,
      resolveOutputAmount: (_goodId, baseAmount) => baseAmount,
      addProductionMax: (goodId, amount) => {
        productionMax[goodId] = amount;
      },
      addProduction: (goodId, amount) => {
        production[goodId] = amount;
      },
    });

    expect(result).toMatchObject({
      extractionCoverage: 0.6,
      productivity: 0.6,
      extractedByGood: { "good:ore": 3 },
      producedByGood: { "good:ore": 3 },
    });
    expect(warehouse).toEqual({ "good:ore": 3 });
    expect(deposits).toEqual([{ goodId: "good:ore", amount: 0 }]);
    expect(productionMax).toEqual({ "good:ore": 3 });
    expect(production).toEqual({ "good:ore": 3 });
  });

  it("settles active building finances, wages, employment, durability recovery, and warehouse cleanup", () => {
    const instance = makeInstance({
      ducats: 25,
      currentDurability: 70,
      lastRevenueDucats: 12,
      warehouseByGoodId: { "good:grain": 0, "good:food": 5.5555 },
    });
    const subsidySource = makeResources({ ducats: 100 });

    const result = resolveBuildingOperationSettlement({
      instance,
      building: {
        id: "building:farm",
        name: "Farm",
        workforceRequirements: [{ professionId: "profession:farmers", workers: 10 }],
      },
      warehouse: { "good:grain": 0, "good:food": 5.5555 },
      purchaseCost: 4,
      wagesEstimate: 10,
      wagesEstimateByProfession: { "profession:farmers": 10 },
      grantedStateSubsidy: 0,
      subsidiesEnabled: true,
      subsidySource,
      productivity: 0.5,
      laborCoverage: 0.8,
      inputCoverage: 1,
      infraCoverage: 1,
      financeCoverage: 1,
      extractionCoverage: 1,
      durabilityCoverage: 0.7,
      pollutionProductivityFactor: 1,
      missingInputGoodNames: [],
      instanceLevel: 2,
      durabilityDecayPerTurn: 10,
      durabilityRecoveryPerTurn: 5,
      maxDurability: 100,
    });

    expect(result).toEqual({
      wagesActual: 5,
      wagesByProfession: { "profession:farmers": 5 },
      employedByProfession: { "profession:farmers": 16 },
      removeInstance: false,
      inactiveAlert: null,
    });
    expect(instance).toMatchObject({
      ducats: 16,
      currentDurability: 75,
      lastWagesDucats: 5,
      lastNetDucats: 3,
      isInactive: false,
      inactiveReason: null,
      warehouseByGoodId: { "good:food": 5.556 },
    });
    expect(subsidySource.ducats).toBe(100);
  });

  it("settles inactive building alerts, durability decay, and removal at zero level", () => {
    const instance = makeInstance({
      buildingId: "building:mine",
      level: 1,
      ducats: 0,
      currentDurability: 2,
      lastRevenueDucats: 0,
    });

    const result = resolveBuildingOperationSettlement({
      instance,
      building: { id: "building:mine", name: "Mine" },
      warehouse: { "good:ore": 0 },
      purchaseCost: 0,
      wagesEstimate: 4,
      wagesEstimateByProfession: { "profession:miners": 4 },
      grantedStateSubsidy: 0,
      subsidiesEnabled: false,
      subsidySource: null,
      productivity: 0,
      laborCoverage: 1,
      inputCoverage: 0,
      infraCoverage: 1,
      financeCoverage: 1,
      extractionCoverage: 1,
      durabilityCoverage: 0.02,
      pollutionProductivityFactor: 1,
      missingInputGoodNames: ["Iron"],
      instanceLevel: 1,
      durabilityDecayPerTurn: 5,
      durabilityRecoveryPerTurn: 1,
      maxDurability: 100,
    });

    expect(result.removeInstance).toBe(true);
    expect(result.employedByProfession).toEqual({});
    expect(result.inactiveAlert?.message).toBe(
      "Здание Mine неактивно: Нулевая продуктивность (лимит: входных товаров, 0.0%; не хватает: Iron)",
    );
    expect(instance).toMatchObject({
      currentDurability: 0,
      isInactive: true,
      inactiveReason: "Нулевая продуктивность (лимит: входных товаров, 0.0%; не хватает: Iron)",
      warehouseByGoodId: {},
    });
  });
});

function makeHex(overrides?: Partial<HexMapIndexEntry>): HexMapIndexEntry {
  return {
    id: "region:a",
    name: "Hex A",
    regionId: null,
    hexColor: "#8fb9a8",
    regionColor: "#22d3ee",
    areaKm2: 1000,
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

function makeWorld(overrides?: Partial<BuildingConstructionWorldState>): BuildingConstructionWorldState {
  return {
    regionOwner: {},
    regionController: {},
    regionBuildingsByRegion: {},
    regionConstructionQueueByRegion: {},
    resourcesByCountry: {},
    ...overrides,
  };
}

function makeResources(overrides?: Partial<ResourceTotals>): ResourceTotals {
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

function makeInstance(overrides?: Partial<BuildingInstance>): BuildingInstance {
  return {
    instanceId: "instance:default",
    buildingId: "building:default",
    targetHexId: "hex:0:0",
    owner: { type: "state", countryId: "country:a" },
    createdTurnId: 1,
    level: 1,
    currentDurability: 100,
    lastProductivity: 1,
    ...overrides,
  };
}

function makeProject(overrides?: Partial<BuildingConstructionWorldState["regionConstructionQueueByRegion"][string][number]>) {
  return {
    queueId: "queue:default",
      requestedByCountryId: "country:a",
      buildingId: "building:default",
      targetHexId: "hex:0:0",
      owner: { type: "state" as const, countryId: "country:a" },
    projectType: "build" as const,
    progressConstruction: 0,
    costConstruction: 100,
    costDucats: 0,
    createdTurnId: 1,
    ...overrides,
  };
}

function makeOrder(overrides?: Omit<Partial<Extract<Order, { type: "BUILD" }>>, "type">): Extract<Order, { type: "BUILD" }> {
  return {
    id: "order:a",
    turnId: 3,
    playerId: "player:a",
    countryId: "country:a",
    regionId: "region:a",
    targetHexId: "hex:0:0",
    type: "BUILD",
    payload: {},
    createdAt: "now",
    ...overrides,
  };
}
