import type {
  BuildingInstance,
  ModifierStat,
  PopulationProfessionState,
  RegionPopulation,
  WorldBase,
} from "@arcanorum/shared";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import type {
  BuildingContentEntry,
  GameSettings,
  MarketSanctionEntry,
  TransportCorridorEntry,
} from "./gameSettingsTypes";
import {
  finalizeRegionBuildingTurn,
  prepareBuildingInstanceForTurn,
  prepareBuildingOperationEconomics,
  resolveBuildingOperationSettlement,
  resolveBuildingProductionTurn,
} from "../mechanics/buildingMechanics";
import {
  consumeCorridorRoutesCapacity as consumeCorridorRoutesCapacityInState,
  createCorridorRoutePlanner,
  type CorridorTransferRoute,
} from "../mechanics/transportCorridorMechanics";
import {
  addCountryGood as addCountryGoodInMarketTurn,
  addGlobalGood as addGlobalGoodInMarketTurn,
  addScopeGoodPartnerAmount as addScopeGoodPartnerAmountInMarketTurn,
  buildActiveSanctionsByInitiator,
  collectTradeSanctions as collectTradeSanctionsFromMarketTurn,
  consumePolicyLimit as consumePolicyLimitInMarketTurn,
  createSellerIndexes,
  finalizeMarketTurn,
  getAvailableGoodAmount as getAvailableGoodAmountFromMarketTurn,
  getGoodDistributionType as getGoodDistributionTypeFromMarketTurn,
  getGoodPrice as getGoodPriceFromMarketTurn,
  getGoodTransportModes as getGoodTransportModesFromMarketTurn,
  getInfraPerUnit as getInfraPerUnitFromMarketTurn,
  getPriceMeta as getPriceMetaFromMarketTurn,
  getRemainingByPolicyLimit as getRemainingByPolicyLimitFromMarketTurn,
  getResourceCategoryId as getResourceCategoryIdFromMarketTurn,
  getScopedSellerList as getScopedSellerListFromMarketTurn,
  indexSellerWarehouse,
  normalizeGoodTransportModesList,
  pushLogisticsFailure as pushLogisticsFailureInMarketTurn,
  purchaseBuildingInputs,
  purchasePopulationGood as purchasePopulationGoodInMarketTurn,
  resolveTradePolicyLayer as resolveTradePolicyLayerFromMarketTurn,
  updatePrice as updatePriceInMarketTurn,
  type ActiveTradeSanction,
  type CountryGoodMap,
  type GoodDistributionType,
  type GoodTransportMode,
  type LogisticsFailure,
  type MarketOverviewAlert,
  type MarketOverviewState,
  type SellerScope,
} from "../mechanics/marketTurnMechanics";
import {
  calculateAvailableProfessionPopulation,
  calculateLaborCoverage,
  calculateWageMultipliers,
  calculateWorkforceDemand,
  getPopulationTotal,
  resolveRegionPopulationNeedsTurn,
  type CultureNeed,
  type PopulationDimensionKey,
  type PopulationDomainKeys,
} from "../mechanics/populationMechanics";
import type { WorkforceRequirement } from "../mechanics/contentFieldNormalizers";

export type ResolveBuildingsTurnRuntimeDeps = {
  adm1ProvinceIndex: Adm1ProvinceIndexEntry[];
  countryGoodPrices: Record<string, Record<string, number>>;
  createDefaultMarketRecord: (marketId: string, ownerCountryId: string) => GameSettings["markets"]["marketById"][string];
  buildingBaseThroughput: number;
  buildingBaseWagePerWorkerGold: number;
  buildingDurabilityDecayPerTurnFallback: number;
  buildingDurabilityRecoveryPerTurnFallback: number;
  corridorLoadHistoryLength: number;
  defaultMarketPriceSmoothing: number;
  ensureCountryInWorldBase: (countryId: string) => void;
  gameSettings: GameSettings;
  getActiveCultureNeeds: (cultureId: string, standardOfLiving: number) => CultureNeed[];
  getBuildingMaxDurability: (building: BuildingContentEntry | undefined) => number;
  getBuildingPollutionProductivityFactor: (building: BuildingContentEntry, provinceId: string) => number;
  getCountryMarketId: (countryId: string) => string;
  getInfrastructureTransitAgreementAllowedCountries: (baseCountryIds: Set<string>, transportMode: GoodTransportMode | null) => Set<string>;
  getMarketById: (marketId: string) => GameSettings["markets"]["marketById"][string] | null;
  getPopulationDomainKeys: () => PopulationDomainKeys;
  getProvinceFertilityMultiplier: (provinceId: string) => number;
  getTransportCorridorCapacity: (corridor: TransportCorridorEntry, categoryId: string | null) => number;
  globalGoodDemandHistoryByResourceId: Record<string, number[]>;
  globalGoodOfferHistoryByResourceId: Record<string, number[]>;
  globalGoodPriceHistoryByResourceId: Record<string, number[]>;
  globalGoodPrices: Record<string, number>;
  globalGoodProductionFactHistoryByResourceId: Record<string, number[]>;
  globalGoodProductionMaxHistoryByResourceId: Record<string, number[]>;
  normalizeProvinceIdList: (input: unknown) => string[];
  normalizeRegionPopulation: (input: unknown, provinceId: string, domains: PopulationDomainKeys) => RegionPopulation;
  resolveModifiedValue: (stat: ModifierStat, base: number, context: { countryId: string; provinceId?: string; buildingId?: string; goodId?: string; resourceCategoryId?: string | null; professionId?: string }) => number;
  resolvePopulationFallbackKeys: (domains: PopulationDomainKeys) => Record<PopulationDimensionKey, string>;
  round3: (value: number) => number;
  sortCultureNeedsByPriority: (needs: CultureNeed[]) => CultureNeed[];
  turnId: number;
  worldBase: WorldBase;
};

export type ResolveBuildingsTurnRuntimeResult = {
  latestMarketOverview: MarketOverviewState;
  nextProfessionsByPopIdByProvince: Record<string, Record<string, Record<string, PopulationProfessionState>>>;
};

type RegionTurnContext = {
  regionId: string;
  ownerCountryId: string;
  primaryProvinceId: string;
  provinceIds: string[];
};

export function resolveBuildingsTurnForRuntime(deps: ResolveBuildingsTurnRuntimeDeps): ResolveBuildingsTurnRuntimeResult {
  const {
    adm1ProvinceIndex,
    buildingBaseThroughput,
    buildingBaseWagePerWorkerGold,
    buildingDurabilityDecayPerTurnFallback,
    buildingDurabilityRecoveryPerTurnFallback,
    countryGoodPrices,
    corridorLoadHistoryLength,
    createDefaultMarketRecord,
    defaultMarketPriceSmoothing,
    ensureCountryInWorldBase,
    gameSettings,
    getActiveCultureNeeds,
    getBuildingMaxDurability,
    getBuildingPollutionProductivityFactor,
    getCountryMarketId,
    getInfrastructureTransitAgreementAllowedCountries,
    getMarketById,
    getPopulationDomainKeys,
    getProvinceFertilityMultiplier,
    getTransportCorridorCapacity,
    globalGoodDemandHistoryByResourceId,
    globalGoodOfferHistoryByResourceId,
    globalGoodPriceHistoryByResourceId,
    globalGoodPrices,
    globalGoodProductionFactHistoryByResourceId,
    globalGoodProductionMaxHistoryByResourceId,
    normalizeProvinceIdList,
    normalizeRegionPopulation,
    resolveModifiedValue,
    resolvePopulationFallbackKeys,
    round3,
    sortCultureNeedsByPriority,
    turnId,
    worldBase,
  } = deps;
  const domains = getPopulationDomainKeys();
  const fallbackByDimension = resolvePopulationFallbackKeys(domains);
  const buildingById = new Map(gameSettings.content.buildings.map((entry) => [entry.id, entry] as const));
  const goodById = new Map(gameSettings.content.goods.map((entry) => [entry.id, entry] as const));
  const professionById = new Map(gameSettings.content.professions.map((entry) => [entry.id, entry] as const));
  const nextProfessionsByPopIdByProvince: Record<string, Record<string, Record<string, PopulationProfessionState>>> = {};
  const smoothing = Number(
    Math.max(0, Math.min(1, gameSettings.economy.marketPriceSmoothing ?? defaultMarketPriceSmoothing)).toFixed(3),
  );

  const demandRequestedByCountry: CountryGoodMap = {};
  const productionByCountry: CountryGoodMap = {};
  const productionMaxByCountry: CountryGoodMap = {};
  const marketVolumeByCountry: CountryGoodMap = {};
  const demandRequestedGlobal: Record<string, number> = {};
  const productionGlobal: Record<string, number> = {};
  const productionMaxGlobal: Record<string, number> = {};
  const marketVolumeGlobal: Record<string, number> = {};
  const corridorLoadByModeByCorridorId: Record<string, Record<string, number>> = {};
  const worldTradeUsedAmountByScope: Record<string, number> = {};
  const sanctionUsedAmountById: Record<string, number> = {};
  const alertsByCountry: Record<string, MarketOverviewAlert[]> = {};
  const importsByCountryByCountryAndGood: Record<string, Record<string, Record<string, number>>> = {};
  const exportsByCountryByCountryAndGood: Record<string, Record<string, Record<string, number>>> = {};
  const importsByMarketByMarketAndGood: Record<string, Record<string, Record<string, number>>> = {};
  const exportsByMarketByMarketAndGood: Record<string, Record<string, Record<string, number>>> = {};
  const logisticsFailuresByProvince: Record<string, LogisticsFailure[]> = {};
  const logisticsFailureIndex = new Map<string, LogisticsFailure>();
  let alertSeq = 0;
  const pushCountryAlert = (countryId: string, alert: Omit<MarketOverviewAlert, "id">): void => {
    if (!alertsByCountry[countryId]) alertsByCountry[countryId] = [];
    alertsByCountry[countryId].push({ id: `a-${turnId}-${++alertSeq}`, ...alert });
  };
  const pushLogisticsFailure = (failure: LogisticsFailure): void => {
    pushLogisticsFailureInMarketTurn({
      failuresByProvince: logisticsFailuresByProvince,
      failureIndex: logisticsFailureIndex,
      failure,
    });
  };
  const activeSanctionsByInitiator = buildActiveSanctionsByInitiator(Object.values(gameSettings.markets.sanctionsById ?? {}), turnId);
  const collectTradeSanctions = (params: {
    initiatorCountryId: string;
    direction: "import" | "export";
    targetCountryId: string;
    targetMarketId: string;
    goodId: string;
  }): Array<ActiveTradeSanction<MarketSanctionEntry>> =>
    collectTradeSanctionsFromMarketTurn({
      activeSanctionsByInitiator,
      ...params,
    });

  type SellerSlot = {
    regionId: string;
    provinceId: string;
    countryId: string;
    marketId: string;
    instanceId: string;
    instance: BuildingInstance;
  };
  const sellerIndexes = createSellerIndexes<SellerSlot>();
  const soldBySellerAndGood = new Map<string, number>();
  const addCountryGood = (map: CountryGoodMap, countryId: string, goodId: string, value: number): void => {
    addCountryGoodInMarketTurn(map, countryId, goodId, value);
  };
  const addGlobalGood = (map: Record<string, number>, goodId: string, value: number): void => {
    addGlobalGoodInMarketTurn(map, goodId, value);
  };
  const getMarketIdByCountry = (countryId: string): string => getCountryMarketId(countryId);
  const getPriceMeta = (goodId: string): { base: number; min: number; max: number } => {
    return getPriceMetaFromMarketTurn(goodById.get(goodId));
  };
  const getCountryGoodPrice = (countryId: string, goodId: string): number => {
    const meta = getPriceMeta(goodId);
    const marketId = getCountryMarketId(countryId);
    if (!countryGoodPrices[marketId]) countryGoodPrices[marketId] = {};
    return getGoodPriceFromMarketTurn({ pricesByGoodId: countryGoodPrices[marketId], goodId, meta });
  };
  const getGlobalGoodPrice = (goodId: string): number => {
    const meta = getPriceMeta(goodId);
    return getGoodPriceFromMarketTurn({ pricesByGoodId: globalGoodPrices, goodId, meta });
  };
  const getInfraPerUnit = (goodId: string): number => {
    return getInfraPerUnitFromMarketTurn(goodById.get(goodId));
  };
  const getResourceCategoryId = (goodId: string): string | null => {
    return getResourceCategoryIdFromMarketTurn(goodById.get(goodId));
  };
  const getGoodDistributionType = (goodId: string): GoodDistributionType => {
    return getGoodDistributionTypeFromMarketTurn(goodById.get(goodId));
  };
  const getGoodTransportModes = (goodId: string): GoodTransportMode[] => {
    return getGoodTransportModesFromMarketTurn({
      entry: goodById.get(goodId),
      normalizeTradeableModes: normalizeGoodTransportModesList,
    });
  };
  const getCorridorLoad = (corridorId: string, transportMode: GoodTransportMode): number => {
    return Math.max(0, Number(corridorLoadByModeByCorridorId[corridorId]?.[transportMode] ?? 0));
  };
  type MarketCorridorTransferRoute = CorridorTransferRoute<GoodTransportMode, TransportCorridorEntry>;
  const corridorRoutePlanner = createCorridorRoutePlanner<GoodTransportMode, TransportCorridorEntry>({
    corridorsById: gameSettings.markets.transportCorridorsById,
    provinceOwnerById: worldBase.provinceOwner,
    getCorridorCapacity: (corridor) => getTransportCorridorCapacity(corridor, null),
    getCorridorLoad,
    getMarketMemberCountryIds: (marketId) => getMarketById(marketId)?.memberCountryIds ?? [],
    getTransitAllowedCountries: getInfrastructureTransitAgreementAllowedCountries,
    normalizeProvinceIds: normalizeProvinceIdList,
  });
  const getCorridorRoutesForTransfer = (params: {
    buyerMarketId: string;
    buyerProvinceId: string;
    buyerCountryId: string;
    sellerMarketId: string;
    sellerProvinceId: string;
    sellerCountryId: string;
    transportModes: GoodTransportMode[];
    isExternalTrade: boolean;
    infraPerUnit: number;
    requestedGoods: number;
  }): MarketCorridorTransferRoute[] => corridorRoutePlanner.getCorridorRoutesForTransfer(params);
  const hasReachableCorridorRouteIgnoringCapacity = corridorRoutePlanner.hasReachableCorridorRouteIgnoringCapacity;
  const hasPhysicalCorridorRouteIgnoringTransit = corridorRoutePlanner.hasPhysicalCorridorRouteIgnoringTransit;
  const getRoutesCapacityInGoods = corridorRoutePlanner.getRoutesCapacityInGoods;
  const consumeCorridorRoutesCapacity = (
    routes: MarketCorridorTransferRoute[],
    goodsAmount: number,
    infraPerUnit: number,
  ): void => {
    consumeCorridorRoutesCapacityInState({
      routes,
      goodsAmount,
      infraPerUnit,
      corridorLoadByModeByCorridorId,
      getCorridorLoad,
    });
  };
  for (const corridor of Object.values(gameSettings.markets.transportCorridorsById ?? {})) {
    corridor.lastLoadByMode = {};
    corridor.lastCapacityByMode = { [corridor.transportMode]: getTransportCorridorCapacity(corridor, null) };
  }
  const resolveTradePolicyLayer = resolveTradePolicyLayerFromMarketTurn;
  const getRemainingByPolicyLimit = (
    marketId: string,
    goodId: string,
    direction: "import" | "export",
    scope: string,
    limit: number | null,
  ): number => {
    return getRemainingByPolicyLimitFromMarketTurn({
      worldTradeUsedAmountByScope,
      marketId,
      goodId,
      direction,
      scope,
      limit,
    });
  };
  const consumePolicyLimit = (
    marketId: string,
    goodId: string,
    direction: "import" | "export",
    scope: string,
    amount: number,
  ): void => {
    consumePolicyLimitInMarketTurn({
      worldTradeUsedAmountByScope,
      marketId,
      goodId,
      direction,
      scope,
      amount,
    });
  };
  const updatePrice = (current: number, demand: number, offer: number, meta: { base: number; min: number; max: number }): number => {
    return updatePriceInMarketTurn({ current, demand, offer, meta, smoothing });
  };
  const addScopeGoodPartnerAmount = (
    map: Record<string, Record<string, Record<string, number>>>,
    scopeId: string,
    goodId: string,
    partnerId: string,
    value: number,
  ): void => {
    addScopeGoodPartnerAmountInMarketTurn(map, scopeId, goodId, partnerId, value);
  };
  const regionTurnContexts = buildRegionTurnContexts({ adm1ProvinceIndex, worldBase });
  // Pass 1: normalize instances and index all sellers before any purchases.
  // This lets buildings buy from the full market scope (province/country/market/global)
  // instead of only regions that were processed earlier in the same turn.
  for (const context of regionTurnContexts) {
    const { regionId, ownerCountryId, primaryProvinceId } = context;
    const marketId = getMarketIdByCountry(ownerCountryId);
    const buildingInstances = [...(worldBase.regionBuildingsByRegion[regionId] ?? [])].sort((a, b) =>
      a.instanceId.localeCompare(b.instanceId),
    );
    for (const instance of buildingInstances) {
      const building = buildingById.get(instance.buildingId);
      if (!building) continue;
      const preparation = prepareBuildingInstanceForTurn({
        instance,
        maxDurability: getBuildingMaxDurability(building),
      });
      if (!preparation.manualWorkEnabled) {
        continue;
      }
      indexSellerWarehouse({
        indexes: sellerIndexes,
        slot: {
          regionId,
          provinceId: primaryProvinceId,
          countryId: ownerCountryId,
          marketId,
          instanceId: instance.instanceId,
          instance,
        },
        addMarketVolume: addCountryGood.bind(null, marketVolumeByCountry),
        addGlobalVolume: addGlobalGood.bind(null, marketVolumeGlobal),
      });
    }
  }

  for (const context of regionTurnContexts) {
    const { regionId, ownerCountryId, primaryProvinceId } = context;
    if (!alertsByCountry[ownerCountryId]) alertsByCountry[ownerCountryId] = [];

    const population = normalizeRegionPopulation(worldBase.regionPopulationByRegion[regionId], regionId, domains);
    const marketId = getMarketIdByCountry(ownerCountryId);
    const buildingInstances = [...(worldBase.regionBuildingsByRegion[regionId] ?? [])]
      .sort((a, b) => a.instanceId.localeCompare(b.instanceId));
    const regionResourceDeposits = [...(worldBase.regionResourceDepositsByRegion[regionId] ?? [])].map((deposit) => ({
      ...deposit,
    }));

    const workforceDemandSources: Array<{ level?: number | null; workforceRequirements: WorkforceRequirement[] }> = [];
    for (const instance of buildingInstances) {
      const building = buildingById.get(instance.buildingId);
      if (!building) continue;
      workforceDemandSources.push({ level: instance.level, workforceRequirements: building.workforceRequirements ?? [] });
    }
    const { demandByProfession, totalWorkforceDemand } = calculateWorkforceDemand(workforceDemandSources);

    const populationTotal = getPopulationTotal(population);
    const laborCoverageProvince = calculateLaborCoverage(populationTotal, totalWorkforceDemand);
    const availableByProfession = calculateAvailableProfessionPopulation(population);
    const wageMultiplierByProfession = calculateWageMultipliers({ demandByProfession, availableByProfession });
    let regionWages = 0;
    const wagesByProfession: Record<string, number> = {};
    const employedByProfession: Record<string, number> = {};
    const instanceIdsToRemove = new Set<string>();

    const getScopedSellerList = (scope: SellerScope, goodId: string): SellerSlot[] => {
      return getScopedSellerListFromMarketTurn({
        indexes: sellerIndexes,
        scope,
        goodId,
        regionId,
        countryId: ownerCountryId,
        marketId,
      });
    };

    const getAvailableGoodAmount = (goodId: string): number => {
      return getAvailableGoodAmountFromMarketTurn({
        indexes: sellerIndexes,
        soldBySellerAndGood,
        goodId,
      });
    };

    const getEffectivePopulationGoodPrice = (goodId: string): number =>
      Math.max(0.001, Math.min(getCountryGoodPrice(ownerCountryId, goodId), getGlobalGoodPrice(goodId)));

    const purchasePopulationGood = (
      goodId: string,
      requestedPhysicalAmount: number,
      wallet: number,
    ): { purchasedPhysicalAmount: number; spent: number; wallet: number } => {
      return purchasePopulationGoodInMarketTurn({
        goodId,
        requestedPhysicalAmount,
        wallet,
        distributionType: getGoodDistributionType(goodId),
        countryUnitPrice: getCountryGoodPrice(ownerCountryId, goodId),
        globalUnitPrice: getGlobalGoodPrice(goodId),
        getScopedSellerList,
        soldBySellerAndGood,
      });
    };

    for (const instance of buildingInstances) {
      const building = buildingById.get(instance.buildingId);
      if (!building) continue;
      if (instance.manualWorkEnabled === false) {
        instance.isInactive = true;
        instance.inactiveReason = "Отключено вручную";
        continue;
      }
      const instanceLevel = Math.max(1, Math.floor(Number(instance.level ?? 1)));
      const maxDurability = getBuildingMaxDurability(building);
      const currentDurability = round3(Math.max(0, Math.min(maxDurability, Number(instance.currentDurability ?? maxDurability))));
      instance.currentDurability = currentDurability;
      const buildingThroughput = Math.max(0, resolveModifiedValue("building_throughput", buildingBaseThroughput, {
        countryId: ownerCountryId,
        provinceId: primaryProvinceId,
        buildingId: building.id,
      }));
      const warehouse = instance.warehouseByGoodId ?? {};
      const operationEconomics = prepareBuildingOperationEconomics({
        instance,
        building,
        ownerCountryId,
        instanceLevel,
        laborCoverageProvince,
        buildingThroughput,
        professionsById: professionById,
        wageMultiplierByProfession,
        getBaseWageFallback: () => buildingBaseWagePerWorkerGold,
        resolveWage: (professionId, baseWage) => resolveModifiedValue("building_wage", baseWage, {
          countryId: ownerCountryId,
          provinceId: primaryProvinceId,
          buildingId: building.id,
          professionId,
        }),
        resolveInputAmount: (input) => resolveModifiedValue("building_input", input.amount, {
          countryId: ownerCountryId,
          provinceId: primaryProvinceId,
          buildingId: building.id,
          goodId: input.goodId,
          resourceCategoryId: getResourceCategoryId(input.goodId),
        }),
        getInputPrice: (goodId) => getCountryGoodPrice(ownerCountryId, goodId),
        addInputDemand: (goodId, amount) => {
          addCountryGood(demandRequestedByCountry, marketId, goodId, amount);
          addGlobalGood(demandRequestedGlobal, goodId, amount);
        },
        ensureCountry: ensureCountryInWorldBase,
        getCountryDucats: (countryId) => Number(worldBase.resourcesByCountry[countryId]?.ducats ?? 0),
        setCountryDucats: (countryId, amount) => {
          ensureCountryInWorldBase(countryId);
          worldBase.resourcesByCountry[countryId].ducats = amount;
        },
      });
      const {
        wagesEstimate,
        wagesEstimateByProfession,
        inputNeeds,
        laborCoverage,
        infraCoverage,
        financeCoverage,
        subsidyCountryId,
        subsidiesEnabled,
        grantedStateSubsidy,
      } = operationEconomics;
      const purchase = purchaseBuildingInputs({
        buyerInstance: instance,
        inputNeeds,
        buyerProvinceId: primaryProvinceId,
        buyerCountryId: ownerCountryId,
        buyerMarketId: marketId,
        getDistributionType: getGoodDistributionType,
        getCountryGoodPrice,
        getGlobalGoodPrice,
        getScopedSellerList,
        soldBySellerAndGood,
        collectTradeSanctions,
        sanctionUsedAmountById,
        getTradePolicy: ({ marketId: policyMarketId, goodId, otherMarketId, otherCountryId }) =>
          resolveTradePolicyLayer(getMarketById(policyMarketId)?.worldTradePolicyByResourceId?.[goodId], otherMarketId, otherCountryId),
        getRemainingByPolicyLimit,
        consumePolicyLimit,
        getInfraPerUnit,
        getTransportModes: getGoodTransportModes,
        getCorridorRoutesForTransfer,
        hasReachableCorridorRouteIgnoringCapacity,
        hasPhysicalCorridorRouteIgnoringTransit,
        getRoutesCapacityInGoods,
        consumeCorridorRoutesCapacity,
        pushLogisticsFailure,
        addCountryTrade: (direction, countryId, goodId, partnerCountryId, amount) => {
          addScopeGoodPartnerAmount(
            direction === "import" ? importsByCountryByCountryAndGood : exportsByCountryByCountryAndGood,
            countryId,
            goodId,
            partnerCountryId,
            amount,
          );
        },
        addMarketTrade: (direction, tradeMarketId, goodId, partnerMarketId, amount) => {
          addScopeGoodPartnerAmount(
            direction === "import" ? importsByMarketByMarketAndGood : exportsByMarketByMarketAndGood,
            tradeMarketId,
            goodId,
            partnerMarketId,
            amount,
          );
        },
      });
      const { purchaseCost, purchasedByGood, purchasedCostByGood } = purchase;
      instance.lastPurchaseByGoodId = purchasedByGood;
      instance.lastPurchaseCostByGoodId = purchasedCostByGood;
      instance.lastInputCostDucats = round3(purchaseCost);

      const pollutionProductivityFactor = getBuildingPollutionProductivityFactor(building, primaryProvinceId);
      const production = resolveBuildingProductionTurn({
        building,
        instanceLevel,
        warehouse,
        regionResourceDeposits,
        laborCoverage,
        infraCoverage,
        financeCoverage,
        currentDurability,
        maxDurability,
        buildingThroughput,
        fertilityMultiplier: getProvinceFertilityMultiplier(primaryProvinceId),
        pollutionProductivityFactor,
        resolveInputAmount: (input) => resolveModifiedValue("building_input", input.amount, {
          countryId: ownerCountryId,
          provinceId: primaryProvinceId,
          buildingId: building.id,
          goodId: input.goodId,
          resourceCategoryId: getResourceCategoryId(input.goodId),
        }),
        resolveOutputAmount: (goodId, baseAmount) => resolveModifiedValue("building_output", baseAmount, {
          countryId: ownerCountryId,
          provinceId: primaryProvinceId,
          buildingId: building.id,
          goodId,
          resourceCategoryId: getResourceCategoryId(goodId),
        }),
        addProductionMax: (goodId, amount) => {
          addCountryGood(productionMaxByCountry, marketId, goodId, amount);
          addGlobalGood(productionMaxGlobal, goodId, amount);
        },
        addProduction: (goodId, amount) => {
          addCountryGood(productionByCountry, marketId, goodId, amount);
          addGlobalGood(productionGlobal, goodId, amount);
        },
      });
      const {
        inputCoverage,
        extractionCoverage,
        durabilityCoverage,
        productivity,
        missingInputGoodIds,
        consumedByGood,
        producedByGood,
        extractedByGood,
      } = production;
      instance.lastLaborCoverage = laborCoverage;
      instance.lastInfraCoverage = infraCoverage;
      instance.lastInputCoverage = inputCoverage;
      instance.lastFinanceCoverage = financeCoverage;
      instance.lastExtractionCoverage = extractionCoverage;
      instance.lastDurabilityCoverage = durabilityCoverage;
      instance.lastProductivity = productivity;
      instance.lastConsumptionByGoodId = consumedByGood;
      instance.lastProductionByGoodId = producedByGood;
      instance.lastExtractionByGoodId = extractedByGood;
      let subsidySource = null;
      if (subsidiesEnabled) {
        ensureCountryInWorldBase(subsidyCountryId);
        subsidySource = worldBase.resourcesByCountry[subsidyCountryId] ?? null;
      }
      const settlement = resolveBuildingOperationSettlement({
        instance,
        building,
        warehouse,
        purchaseCost,
        wagesEstimate,
        wagesEstimateByProfession,
        grantedStateSubsidy,
        subsidiesEnabled,
        subsidySource,
        productivity,
        laborCoverage,
        inputCoverage,
        infraCoverage,
        financeCoverage,
        extractionCoverage,
        durabilityCoverage,
        pollutionProductivityFactor,
        missingInputGoodNames: missingInputGoodIds.map((goodId) => goodById.get(goodId)?.name?.trim() || goodId),
        instanceLevel,
        durabilityDecayPerTurn: Math.max(0, Number(gameSettings.economy.buildingDurabilityDecayPerTurn ?? buildingDurabilityDecayPerTurnFallback)),
        durabilityRecoveryPerTurn: Math.max(0, Number(gameSettings.economy.buildingDurabilityRecoveryPerTurn ?? buildingDurabilityRecoveryPerTurnFallback)),
        maxDurability: getBuildingMaxDurability(building),
      });
      for (const [professionId, actual] of Object.entries(settlement.wagesByProfession)) {
        wagesByProfession[professionId] = round3((wagesByProfession[professionId] ?? 0) + actual);
      }
      for (const [professionId, workers] of Object.entries(settlement.employedByProfession)) {
        employedByProfession[professionId] = round3((employedByProfession[professionId] ?? 0) + workers);
      }
      if (settlement.inactiveAlert) {
        pushCountryAlert(ownerCountryId, {
          severity: "critical",
          kind: "building-inactive",
          message: settlement.inactiveAlert.message,
          provinceId: primaryProvinceId,
          buildingId: instance.buildingId,
          instanceId: instance.instanceId,
        });
      }
      regionWages = round3(regionWages + settlement.wagesActual);
      if (settlement.removeInstance) {
        instanceIdsToRemove.add(instance.instanceId);
        continue;
      }
    }

    const finalizedRegionBuildings = finalizeRegionBuildingTurn({
      buildingInstances,
      removedInstanceIds: instanceIdsToRemove,
      previousPopulationTreasury: worldBase.regionPopulationTreasuryByRegion[regionId] ?? 0,
      regionWages,
      regionResourceDeposits,
    });
    const activeBuildingInstances = finalizedRegionBuildings.activeBuildingInstances;

    if (populationTotal > 0) {
      const provinceNeeds = resolveRegionPopulationNeedsTurn({
        population,
        employedByProfession,
        professionIds: domains.professionPct,
        fallbackProfessionId: fallbackByDimension.professionPct,
        wagesByProfession,
        getNeedsForPop: (pop, state) => sortCultureNeedsByPriority(getActiveCultureNeeds(pop.cultureId, state.standardOfLiving)),
        getGoodPrice: getEffectivePopulationGoodPrice,
        getAvailableGoodAmount,
        purchaseGood: purchasePopulationGood,
      });
      nextProfessionsByPopIdByProvince[regionId] = provinceNeeds.nextProfessionsByPopId;
      for (const [goodId, amount] of Object.entries(provinceNeeds.demandRequestedByGood)) {
        addCountryGood(demandRequestedByCountry, marketId, goodId, amount);
        addGlobalGood(demandRequestedGlobal, goodId, amount);
      }
    }

    worldBase.regionPopulationTreasuryByRegion[regionId] = finalizedRegionBuildings.populationTreasury;
    worldBase.regionBuildingDucatsByRegion[regionId] = finalizedRegionBuildings.buildingDucatsByBuildingId;
    worldBase.regionBuildingsByRegion[regionId] = activeBuildingInstances;
    worldBase.regionResourceDepositsByRegion[regionId] = finalizedRegionBuildings.resourceDeposits;
  }

  const marketIds = new Set<string>([
    ...Object.keys(gameSettings.markets.marketById ?? {}),
    ...Object.keys(worldBase.resourcesByCountry).map((countryId) => getCountryMarketId(countryId)),
  ]);
  const latestMarketOverview = finalizeMarketTurn({
    turnId,
    marketIds,
    countryIds: Object.keys(worldBase.resourcesByCountry),
    goodIds: gameSettings.content.goods.map((good) => good.id),
    demandRequestedByCountry,
    productionByCountry,
    productionMaxByCountry,
    marketVolumeByCountry,
    countryGoodPrices,
    demandRequestedGlobal,
    productionGlobal,
    productionMaxGlobal,
    marketVolumeGlobal,
    globalGoodPrices,
    globalGoodPriceHistoryByResourceId,
    globalGoodDemandHistoryByResourceId,
    globalGoodOfferHistoryByResourceId,
    globalGoodProductionFactHistoryByResourceId,
    globalGoodProductionMaxHistoryByResourceId,
    importsByCountryByCountryAndGood,
    exportsByCountryByCountryAndGood,
    importsByMarketByMarketAndGood,
    exportsByMarketByMarketAndGood,
    logisticsFailuresByProvince,
    alertsByCountry,
    corridors: Object.values(gameSettings.markets.transportCorridorsById ?? {}),
    corridorLoadByModeByCorridorId,
    corridorLoadHistoryLength,
    getMarketRecord: (marketId) => {
      const marketRecord = getMarketById(marketId) ?? createDefaultMarketRecord(marketId, marketId);
      if (!gameSettings.markets.marketById[marketId]) {
        gameSettings.markets.marketById[marketId] = marketRecord;
      }
      return marketRecord;
    },
    getCountryMarketId,
    getMarketGoodPrice: getCountryGoodPrice,
    getGlobalGoodPrice,
    getPriceMeta,
    updatePrice,
    getTransportCorridorCapacity: (corridor) => getTransportCorridorCapacity(corridor, null),
    pushCountryAlert,
  });
  return { latestMarketOverview, nextProfessionsByPopIdByProvince };
}

function buildRegionTurnContexts(params: {
  adm1ProvinceIndex: Adm1ProvinceIndexEntry[];
  worldBase: Pick<
    WorldBase,
    "regionOwner" | "regionController" | "regionPopulationByRegion" | "regionBuildingsByRegion" | "regionConstructionQueueByRegion"
  >;
}): RegionTurnContext[] {
  const provinceIdsByRegion = new Map<string, string[]>();
  for (const province of params.adm1ProvinceIndex) {
    if (!province.regionId) continue;
    const current = provinceIdsByRegion.get(province.regionId) ?? [];
    current.push(province.id);
    provinceIdsByRegion.set(province.regionId, current);
  }
  const regionIds = new Set<string>([
    ...provinceIdsByRegion.keys(),
    ...Object.keys(params.worldBase.regionOwner),
    ...Object.keys(params.worldBase.regionController),
    ...Object.keys(params.worldBase.regionPopulationByRegion),
    ...Object.keys(params.worldBase.regionBuildingsByRegion),
    ...Object.keys(params.worldBase.regionConstructionQueueByRegion),
  ]);
  return [...regionIds]
    .sort((left, right) => left.localeCompare(right, "en"))
    .flatMap((regionId): RegionTurnContext[] => {
      const ownerCountryId = params.worldBase.regionController[regionId] ?? params.worldBase.regionOwner[regionId] ?? null;
      if (!ownerCountryId) return [];
      const provinceIds = [...(provinceIdsByRegion.get(regionId) ?? [])].sort((left, right) => left.localeCompare(right, "en"));
      return [{
        regionId,
        ownerCountryId,
        primaryProvinceId: provinceIds[0] ?? regionId,
        provinceIds,
      }];
    });
}
