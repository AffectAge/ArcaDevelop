import { describe, expect, it } from "vitest";
import {
  addCategoryAmount,
  addCountryGood,
  addGlobalGood,
  addScopeGoodPartnerAmount,
  buildActiveSanctionsByInitiator,
  buildPurchaseScopeOptions,
  collectTradeSanctions,
  compareSellerPriority,
  consumePolicyLimit,
  createSellerIndexes,
  ensureCountryGood,
  finalizeMarketTurn,
  getAvailableGoodAmount,
  getGoodDistributionType,
  getGoodPrice,
  getGoodTransportModes,
  getInfraPerUnit,
  getPriceMeta,
  getRemainingByPolicyLimit,
  getResourceCategoryId,
  getScopedSellerList,
  getScopeGoodTradeTotal,
  getSellerUsageKey,
  getWorldTradeUsageKey,
  indexSellerWarehouse,
  normalizeGoodTransportModesList,
  normalizeTransportMode,
  pushHistory,
  pushLogisticsFailure,
  purchaseBuildingInputs,
  purchasePopulationGood,
  resolveTradePolicyLayer,
  updatePrice,
  type CountryGoodMap,
  type SellerSlotLike,
} from "./marketTurnMechanics";

describe("marketTurnMechanics", () => {
  it("normalizes transport modes with fallback support", () => {
    expect(normalizeGoodTransportModesList(["land", "bad", "sea", "land"])).toEqual(["land", "sea"]);
    expect(normalizeGoodTransportModesList([], ["air"])).toEqual(["air"]);
    expect(normalizeTransportMode("pipeline")).toBe("pipeline");
    expect(normalizeTransportMode("bad", "sea")).toBe("sea");
  });

  it("adds country and global goods with bounded rounding", () => {
    const countryGoods: CountryGoodMap = {};
    ensureCountryGood(countryGoods, "market:a", "good:grain");
    addCountryGood(countryGoods, "market:a", "good:grain", 1.23456);
    addCountryGood(countryGoods, "market:a", "good:grain", -1);
    const globalGoods: Record<string, number> = {};
    addGlobalGood(globalGoods, "good:grain", 2.34567);

    expect(countryGoods).toEqual({ "market:a": { "good:grain": 1.235 } });
    expect(globalGoods).toEqual({ "good:grain": 2.346 });
  });

  it("normalizes price metadata and initializes clamped prices", () => {
    const meta = getPriceMeta({ id: "good:grain", basePrice: 10, minPrice: 5, maxPrice: 20 });
    const prices: Record<string, number> = {};

    expect(meta).toEqual({ base: 10, min: 5, max: 20 });
    expect(getGoodPrice({ pricesByGoodId: prices, goodId: "good:grain", meta })).toBe(10);
    prices["good:grain"] = 99;
    expect(getGoodPrice({ pricesByGoodId: prices, goodId: "good:grain", meta })).toBe(20);
  });

  it("updates prices with smoothing, epsilon, and min/max clamps", () => {
    const meta = { base: 10, min: 2, max: 30 };

    expect(updatePrice({ current: 10, demand: 10, offer: 10.00001, meta, smoothing: 0.5 })).toBe(10);
    expect(updatePrice({ current: 10, demand: 30, offer: 0, meta, smoothing: 0.5 })).toBe(20);
    expect(updatePrice({ current: 10, demand: 0, offer: 100, meta, smoothing: 1 })).toBe(2);
  });

  it("reads good logistics metadata", () => {
    expect(getInfraPerUnit({ id: "good:grain", infraPerUnit: 0 })).toBe(0.01);
    expect(getResourceCategoryId({ id: "good:grain", resourceCategoryId: " food " })).toBe("food");
    expect(getGoodDistributionType({ id: "good:grain", distributionType: "service" })).toBe("service");
    expect(getGoodDistributionType({ id: "good:grain", distributionType: "invalid" as never })).toBe("tradeable");
    expect(
      getGoodTransportModes({
        entry: { id: "good:oil", distributionType: "pipeline", transportModes: ["land"] },
        normalizeTradeableModes: () => ["land"],
      }),
    ).toEqual(["pipeline"]);
  });

  it("tracks policy limits and usage keys", () => {
    const usage: Record<string, number> = {};
    const key = getWorldTradeUsageKey("market:a", "good:grain", "import", "all");
    expect(key).toBe("market:a::good:grain::import::all");
    expect(
      getRemainingByPolicyLimit({
        worldTradeUsedAmountByScope: usage,
        marketId: "market:a",
        goodId: "good:grain",
        direction: "import",
        scope: "all",
        limit: 10,
      }),
    ).toBe(10);
    consumePolicyLimit({
      worldTradeUsedAmountByScope: usage,
      marketId: "market:a",
      goodId: "good:grain",
      direction: "import",
      scope: "all",
      amount: 3.3333,
    });
    expect(usage[key]).toBe(3.333);
  });

  it("resolves purchase scopes from good distribution type", () => {
    const options = [
      { scope: "region", value: 1 },
      { scope: "country", value: 2 },
      { scope: "market", value: 3 },
      { scope: "global", value: 4 },
    ] as const;

    expect(buildPurchaseScopeOptions({ distributionType: "service", options }).map((option) => option.scope)).toEqual(["region"]);
    expect(buildPurchaseScopeOptions({ distributionType: "pipeline", options }).map((option) => option.scope)).toEqual(["region", "market"]);
    expect(buildPurchaseScopeOptions({ distributionType: "tradeable", options }).map((option) => option.scope)).toEqual([
      "region",
      "country",
      "market",
      "global",
    ]);
  });

  it("resolves trade policy layers with country overrides before market overrides", () => {
    const base = {
      allowImportFromWorld: true,
      allowExportToWorld: false,
      maxImportAmountPerTurnFromWorld: 100,
      overridesByMarketId: {
        "market:b": {
          allowImportFromWorld: false,
          maxImportAmountPerTurnFromWorld: 20,
          maxExportAmountPerTurnToWorld: 30,
        },
      },
      overridesByCountryId: {
        "country:b": {
          allowExportToWorld: true,
          maxImportAmountPerTurnFromWorld: -5,
          maxExportAmountPerTurnToWorld: 12.5,
        },
      },
    };

    expect(resolveTradePolicyLayer(base, "market:b", "country:b")).toEqual({
      allowImportFromWorld: true,
      allowExportToWorld: true,
      maxImportAmountPerTurnFromWorld: 0,
      maxExportAmountPerTurnToWorld: 12.5,
      scopeImport: "country:country:b",
      scopeExport: "country:country:b",
    });
    expect(resolveTradePolicyLayer(base, "market:b", "country:c")).toEqual({
      allowImportFromWorld: false,
      allowExportToWorld: true,
      maxImportAmountPerTurnFromWorld: 20,
      maxExportAmountPerTurnToWorld: 30,
      scopeImport: "market:market:b",
      scopeExport: "market:market:b",
    });
    expect(resolveTradePolicyLayer(undefined, "market:x", "country:x")).toEqual({
      allowImportFromWorld: true,
      allowExportToWorld: true,
      maxImportAmountPerTurnFromWorld: null,
      maxExportAmountPerTurnToWorld: null,
      scopeImport: "all",
      scopeExport: "all",
    });
  });

  it("tracks category, partner totals, history, and seller keys", () => {
    const categories: Record<string, Record<string, number>> = {};
    addCategoryAmount(categories, "market:a", "food", 1.2345);
    expect(categories).toEqual({ "market:a": { food: 1.235 } });

    const partners: Record<string, Record<string, Record<string, number>>> = {};
    addScopeGoodPartnerAmount(partners, "market:a", "good:grain", "market:b", 2);
    addScopeGoodPartnerAmount(partners, "market:a", "good:grain", "market:c", 3.4567);
    expect(getScopeGoodTradeTotal(partners, "market:a", "good:grain")).toBe(5.457);

    const history: Record<string, number[]> = { "good:grain": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
    pushHistory(history, "good:grain", 11.1111);
    expect(history["good:grain"]).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11.111]);
    expect(getSellerUsageKey("building:a", "good:grain")).toBe("building:a:good:grain");
  });

  it("builds and filters active trade sanctions", () => {
    const active = buildActiveSanctionsByInitiator(
      [
        {
          id: "sanction:active-country",
          initiatorCountryId: "country:a",
          direction: "import",
          targetType: "country",
          targetId: "country:b",
          goods: ["good:grain"],
          mode: "ban",
          startTurn: 2,
          durationTurns: 3,
        },
        {
          id: "sanction:active-market",
          initiatorCountryId: "country:a",
          direction: "both",
          targetType: "market",
          targetId: "market:b",
          mode: "cap",
          capAmountPerTurn: 5,
          startTurn: 1,
          durationTurns: 10,
        },
        {
          id: "sanction:future",
          initiatorCountryId: "country:a",
          direction: "import",
          targetType: "country",
          targetId: "country:b",
          mode: "ban",
          startTurn: 10,
          durationTurns: 1,
        },
        {
          id: "sanction:disabled",
          initiatorCountryId: "country:a",
          direction: "import",
          targetType: "country",
          targetId: "country:b",
          mode: "ban",
          startTurn: 1,
          durationTurns: 10,
          enabled: false,
        },
      ],
      3,
    );

    expect(active.get("country:a")?.map((sanction) => sanction.id)).toEqual(["sanction:active-country", "sanction:active-market"]);
    expect(
      collectTradeSanctions({
        activeSanctionsByInitiator: active,
        initiatorCountryId: "country:a",
        direction: "import",
        targetCountryId: "country:b",
        targetMarketId: "market:x",
        goodId: "good:grain",
      }).map((sanction) => sanction.id),
    ).toEqual(["sanction:active-country"]);
    expect(
      collectTradeSanctions({
        activeSanctionsByInitiator: active,
        initiatorCountryId: "country:a",
        direction: "export",
        targetCountryId: "country:x",
        targetMarketId: "market:b",
        goodId: "good:iron",
      }).map((sanction) => sanction.id),
    ).toEqual(["sanction:active-market"]);
  });

  it("deduplicates logistics failures by sorted transport modes and source", () => {
    const failuresByProvince: Record<string, Array<{ provinceId: string; sourceProvinceId?: string | null; goodId: string; reason: string; amount: number; transportModes: string[] }>> = {};
    const failureIndex = new Map<string, { provinceId: string; sourceProvinceId?: string | null; goodId: string; reason: string; amount: number; transportModes: string[] }>();

    pushLogisticsFailure({
      failuresByProvince,
      failureIndex,
      failure: {
        provinceId: "province:a",
        sourceProvinceId: "province:b",
        goodId: "good:grain",
        reason: "capacity",
        amount: 1.2345,
        transportModes: ["sea", "land", "sea"],
      },
    });
    pushLogisticsFailure({
      failuresByProvince,
      failureIndex,
      failure: {
        provinceId: "province:a",
        sourceProvinceId: "province:b",
        goodId: "good:grain",
        reason: "capacity",
        amount: 2.3456,
        transportModes: ["land", "sea"],
      },
    });
    pushLogisticsFailure({
      failuresByProvince,
      failureIndex,
      failure: {
        provinceId: "province:a",
        goodId: "good:grain",
        reason: "capacity",
        amount: 0,
        transportModes: ["land"],
      },
    });

    expect(failuresByProvince["province:a"]).toEqual([
      {
        provinceId: "province:a",
        sourceProvinceId: "province:b",
        goodId: "good:grain",
        reason: "capacity",
        amount: 3.581,
        transportModes: ["sea", "land"],
      },
    ]);
    expect(failureIndex.size).toBe(1);
  });

  it("indexes seller warehouses by scope and computes remaining available goods", () => {
    type TestSeller = SellerSlotLike<{
      instanceId: string;
      warehouseByGoodId: Record<string, number>;
    }>;
    const indexes = createSellerIndexes<TestSeller>();
    const marketVolume: CountryGoodMap = {};
    const globalVolume: Record<string, number> = {};
    const localSeller: TestSeller = {
      regionId: "region:a",
      provinceId: "province:a",
      countryId: "country:a",
      marketId: "market:a",
      instanceId: "building:a",
      instance: { instanceId: "building:a", warehouseByGoodId: { "good:grain": 10, "good:iron": 0 } },
    };
    const marketSeller: TestSeller = {
      regionId: "region:b",
      provinceId: "province:b",
      countryId: "country:b",
      marketId: "market:a",
      instanceId: "building:b",
      instance: { instanceId: "building:b", warehouseByGoodId: { "good:grain": 5.5555 } },
    };
    const worldSeller: TestSeller = {
      regionId: "region:c",
      provinceId: "province:c",
      countryId: "country:c",
      marketId: "market:c",
      instanceId: "building:c",
      instance: { instanceId: "building:c", warehouseByGoodId: { "good:grain": 8 } },
    };

    for (const seller of [worldSeller, marketSeller, localSeller]) {
      indexSellerWarehouse({
        indexes,
        slot: seller,
        addMarketVolume: (marketId, goodId, amount) => addCountryGood(marketVolume, marketId, goodId, amount),
        addGlobalVolume: (goodId, amount) => addGlobalGood(globalVolume, goodId, amount),
      });
    }

    expect(
      getScopedSellerList({
        indexes,
        scope: "region",
        goodId: "good:grain",
        regionId: "region:a",
        countryId: "country:a",
        marketId: "market:a",
      }).map((seller) => seller.instanceId),
    ).toEqual(["building:a"]);
    expect(
      getScopedSellerList({
        indexes,
        scope: "market",
        goodId: "good:grain",
        regionId: "region:a",
        countryId: "country:a",
        marketId: "market:a",
      }).map((seller) => seller.instanceId),
    ).toEqual(["building:b", "building:a"]);
    expect(marketVolume).toEqual({ "market:c": { "good:grain": 8 }, "market:a": { "good:grain": 15.556 } });
    expect(globalVolume).toEqual({ "good:grain": 23.556 });

    const sold = new Map<string, number>([[getSellerUsageKey("building:a", "good:grain"), 3.333]]);
    expect(getAvailableGoodAmount({ indexes, soldBySellerAndGood: sold, goodId: "good:grain" })).toBe(20.223);

    const sorted = [worldSeller, marketSeller, localSeller].sort((a, b) =>
      compareSellerPriority({ a, b, buyerCountryId: "country:a", buyerMarketId: "market:a" }),
    );
    expect(sorted.map((seller) => seller.instanceId)).toEqual(["building:a", "building:b", "building:c"]);
  });

  it("purchases population goods through allowed seller scopes and updates seller state", () => {
    type TestSeller = SellerSlotLike<{
      instanceId: string;
      warehouseByGoodId: Record<string, number>;
      ducats: number;
      lastRevenueDucats: number;
    }>;
    const localSeller: TestSeller = {
      regionId: "region:a",
      provinceId: "province:a",
      countryId: "country:a",
      marketId: "market:a",
      instanceId: "building:a",
      instance: { instanceId: "building:a", warehouseByGoodId: { "good:grain": 5 }, ducats: 1, lastRevenueDucats: 0 },
    };
    const globalSeller: TestSeller = {
      regionId: "region:b",
      provinceId: "province:b",
      countryId: "country:b",
      marketId: "market:b",
      instanceId: "building:b",
      instance: { instanceId: "building:b", warehouseByGoodId: { "good:grain": 10 }, ducats: 0, lastRevenueDucats: 0 },
    };
    const soldBySellerAndGood = new Map<string, number>();

    const purchase = purchasePopulationGood({
      goodId: "good:grain",
      requestedPhysicalAmount: 8,
      wallet: 15,
      distributionType: "tradeable",
      countryUnitPrice: 2,
      globalUnitPrice: 4,
      getScopedSellerList: (scope) => (scope === "region" ? [localSeller] : scope === "global" ? [globalSeller] : []),
      soldBySellerAndGood,
    });

    expect(purchase).toEqual({ purchasedPhysicalAmount: 6.25, spent: 15, wallet: 0 });
    expect(localSeller.instance).toMatchObject({
      warehouseByGoodId: { "good:grain": 0 },
      ducats: 11,
      lastRevenueDucats: 10,
    });
    expect(globalSeller.instance).toMatchObject({
      warehouseByGoodId: { "good:grain": 8.75 },
      ducats: 5,
      lastRevenueDucats: 5,
    });
    expect(soldBySellerAndGood.get(getSellerUsageKey("building:a", "good:grain"))).toBe(5);
    expect(soldBySellerAndGood.get(getSellerUsageKey("building:b", "good:grain"))).toBe(1.25);
  });

  it("purchases building inputs with trade caps, corridor capacity, and trade accounting", () => {
    type TestSeller = SellerSlotLike<{
      instanceId: string;
      warehouseByGoodId: Record<string, number>;
      ducats: number;
      lastRevenueDucats: number;
      lastSalesByGoodId: Record<string, number>;
      lastSalesRevenueByGoodId: Record<string, number>;
    }>;
    const seller: TestSeller = {
      regionId: "region:b",
      provinceId: "province:b",
      countryId: "country:b",
      marketId: "market:b",
      instanceId: "building:seller",
      instance: {
        instanceId: "building:seller",
        warehouseByGoodId: { "good:iron": 10 },
        ducats: 0,
        lastRevenueDucats: 0,
        lastSalesByGoodId: {},
        lastSalesRevenueByGoodId: {},
      },
    };
    const buyer = { instanceId: "building:buyer", ducats: 20, warehouseByGoodId: { "good:iron": 1 } };
    const countryTrade: string[] = [];
    const marketTrade: string[] = [];
    const consumedRoutes: Array<{ amount: number; infra: number }> = [];
    const policyUsage: string[] = [];
    const sanctionUsedAmountById: Record<string, number> = {};

    const purchase = purchaseBuildingInputs({
      buyerInstance: buyer,
      inputNeeds: [{ goodId: "good:iron", required: 9, available: 1 }],
      buyerProvinceId: "province:a",
      buyerCountryId: "country:a",
      buyerMarketId: "market:a",
      getDistributionType: () => "tradeable",
      getCountryGoodPrice: () => 2,
      getGlobalGoodPrice: () => 3,
      getScopedSellerList: (scope) => (scope === "global" ? [seller] : []),
      soldBySellerAndGood: new Map(),
      collectTradeSanctions: ({ direction }) => (direction === "import" ? [{ id: "sanction:cap", mode: "cap", capAmountPerTurn: 5 }] : []),
      sanctionUsedAmountById,
      getTradePolicy: ({ marketId }) => ({
        allowImportFromWorld: true,
        allowExportToWorld: true,
        maxImportAmountPerTurnFromWorld: marketId === "market:a" ? 4 : null,
        maxExportAmountPerTurnToWorld: marketId === "market:b" ? 4 : null,
        scopeImport: "all",
        scopeExport: "all",
      }),
      getRemainingByPolicyLimit: (_marketId, _goodId, _direction, _scope, limit) => limit ?? Number.POSITIVE_INFINITY,
      consumePolicyLimit: (marketId, goodId, direction, scope, amount) => {
        policyUsage.push(`${marketId}:${goodId}:${direction}:${scope}:${amount}`);
      },
      getInfraPerUnit: () => 1,
      getTransportModes: () => ["land"],
      getCorridorRoutesForTransfer: () => [{ capacityGoods: 3 }],
      hasReachableCorridorRouteIgnoringCapacity: () => true,
      hasPhysicalCorridorRouteIgnoringTransit: () => true,
      getRoutesCapacityInGoods: (routes) => routes.reduce((sum, route) => sum + route.capacityGoods, 0),
      consumeCorridorRoutesCapacity: (_routes, amount, infra) => {
        consumedRoutes.push({ amount, infra });
      },
      pushLogisticsFailure: () => {
        throw new Error("logistics failure should not be emitted");
      },
      addCountryTrade: (direction, countryId, goodId, partnerId, amount) => {
        countryTrade.push(`${direction}:${countryId}:${goodId}:${partnerId}:${amount}`);
      },
      addMarketTrade: (direction, marketId, goodId, partnerId, amount) => {
        marketTrade.push(`${direction}:${marketId}:${goodId}:${partnerId}:${amount}`);
      },
    });

    expect(purchase).toEqual({
      purchaseCost: 9,
      purchasedByGood: { "good:iron": 3 },
      purchasedCostByGood: { "good:iron": 9 },
    });
    expect(buyer.warehouseByGoodId).toEqual({ "good:iron": 4 });
    expect(seller.instance).toMatchObject({
      warehouseByGoodId: { "good:iron": 7 },
      ducats: 9,
      lastRevenueDucats: 9,
      lastSalesByGoodId: { "good:iron": 3 },
      lastSalesRevenueByGoodId: { "good:iron": 9 },
    });
    expect(countryTrade).toEqual(["import:country:a:good:iron:country:b:3", "export:country:b:good:iron:country:a:3"]);
    expect(marketTrade).toEqual(["import:market:a:good:iron:market:b:3", "export:market:b:good:iron:market:a:3"]);
    expect(policyUsage).toEqual(["market:a:good:iron:import:all:3", "market:b:good:iron:export:all:3"]);
    expect(consumedRoutes).toEqual([{ amount: 3, infra: 1 }]);
    expect(sanctionUsedAmountById).toEqual({ "sanction:cap": 3 });
  });

  it("finalizes market prices, overview offers, alerts, and corridor load history", () => {
    const marketRecords: Record<string, {
      priceByResourceId?: Record<string, number>;
      warehouseByResourceId?: Record<string, number>;
      priceHistoryByResourceId?: Record<string, number[]>;
      demandHistoryByResourceId?: Record<string, number[]>;
      offerHistoryByResourceId?: Record<string, number[]>;
      productionFactHistoryByResourceId?: Record<string, number[]>;
      productionMaxHistoryByResourceId?: Record<string, number[]>;
    }> = {
      "market:a": {
        priceByResourceId: {},
        warehouseByResourceId: {},
        priceHistoryByResourceId: { "good:grain": [1, 2] },
      },
    };
    const alerts: Record<string, Array<{ id: string; severity: "critical"; kind: "critical-deficit"; message: string; goodId: string }>> = {};
    const corridor = {
      id: "corridor:a",
      transportMode: "land",
      lastLoadHistoryByMode: { land: [1, 2] },
    };

    const overview = finalizeMarketTurn({
      turnId: 7,
      marketIds: ["market:a"],
      countryIds: ["country:a"],
      goodIds: ["good:grain"],
      demandRequestedByCountry: { "market:a": { "good:grain": 20 } },
      productionByCountry: { "market:a": { "good:grain": 4 } },
      productionMaxByCountry: { "market:a": { "good:grain": 8 } },
      marketVolumeByCountry: { "market:a": { "good:grain": 2 } },
      countryGoodPrices: { "market:a": { "good:grain": 10 } },
      demandRequestedGlobal: { "good:grain": 20 },
      productionGlobal: { "good:grain": 4 },
      productionMaxGlobal: { "good:grain": 8 },
      marketVolumeGlobal: { "good:grain": 2 },
      globalGoodPrices: { "good:grain": 10 },
      globalGoodPriceHistoryByResourceId: {},
      globalGoodDemandHistoryByResourceId: {},
      globalGoodOfferHistoryByResourceId: {},
      globalGoodProductionFactHistoryByResourceId: {},
      globalGoodProductionMaxHistoryByResourceId: {},
      importsByCountryByCountryAndGood: {},
      exportsByCountryByCountryAndGood: {},
      importsByMarketByMarketAndGood: { "market:a": { "good:grain": { "market:b": 1 } } },
      exportsByMarketByMarketAndGood: { "market:a": { "good:grain": { "market:c": 3 } } },
      logisticsFailuresByProvince: {},
      alertsByCountry: alerts,
      corridors: [corridor],
      corridorLoadByModeByCorridorId: { "corridor:a": { land: 5 } },
      corridorLoadHistoryLength: 3,
      getMarketRecord: (marketId) => marketRecords[marketId] ?? (marketRecords[marketId] = {}),
      getCountryMarketId: () => "market:a",
      getMarketGoodPrice: (_marketId, goodId) => marketRecords["market:a"]?.priceByResourceId?.[goodId] ?? 10,
      getGlobalGoodPrice: (goodId) => (goodId === "good:grain" ? 10 : 1),
      getPriceMeta: () => ({ base: 10, min: 1, max: 100 }),
      updatePrice: (current, demand, offer) => Math.round((current + demand - offer) * 1000) / 1000,
      getTransportCorridorCapacity: () => 12,
      pushCountryAlert: (countryId, alert) => {
        alerts[countryId] = [...(alerts[countryId] ?? []), { id: "alert:a", ...alert }];
      },
    });

    expect(marketRecords["market:a"]).toMatchObject({
      priceByResourceId: { "good:grain": 26 },
      warehouseByResourceId: { "good:grain": 0 },
      priceHistoryByResourceId: { "good:grain": [1, 2, 26] },
      demandHistoryByResourceId: { "good:grain": [20] },
      offerHistoryByResourceId: { "good:grain": [4] },
      productionFactHistoryByResourceId: { "good:grain": [4] },
      productionMaxHistoryByResourceId: { "good:grain": [8] },
    });
    expect(overview).toMatchObject({
      turnId: 7,
      offerByCountry: { "market:a": { "good:grain": 4 } },
      offerGlobal: { "good:grain": 6 },
      alertsByCountry: {
        "country:a": [
          {
            id: "alert:a",
            severity: "critical",
            kind: "critical-deficit",
            goodId: "good:grain",
            message: "Критический дефицит good:grain: покрытие 20.0%",
          },
        ],
      },
    });
    expect(corridor).toMatchObject({
      lastLoadByMode: { land: 5 },
      lastCapacityByMode: { land: 12 },
      lastLoadHistoryByMode: { land: [1, 2, 5] },
    });
  });
});
