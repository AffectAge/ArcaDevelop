import type {
  BuildingInstance,
  ExplanationRecord,
  ModifierStat,
  RegionPopulation,
  WorldBase,
} from "@arcanorum/shared";
import { buildCityHexIdSet } from "@arcanorum/shared";
import type { HexMapIndexEntry } from "../map/hexIndex";
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
import { getRegionCorridorEndpointHexId } from "../mechanics/transportCorridorRoutingMechanics";
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
  allocatePopulationJobs,
  resolveRegionPopulationNeedsTurn,
  type CultureNeed,
  type PopulationAcceptanceContentEntry,
  type PopulationAcceptanceContext,
  type PopulationDimensionKey,
  type PopulationDomainKeys,
} from "../mechanics/populationMechanics";
import type { WorkforceRequirement } from "../mechanics/contentFieldNormalizers";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";

export type ResolveBuildingsTurnRuntimeDeps = {
  hexHexIndex: HexMapIndexEntry[];
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
  getBuildingPollutionProductivityFactor: (building: BuildingContentEntry, hexId: string) => number;
  getCountryMarketId: (countryId: string) => string;
  getInfrastructureTransitAgreementAllowedCountries: (baseCountryIds: Set<string>, transportMode: GoodTransportMode | null) => Set<string>;
  getMarketById: (marketId: string) => GameSettings["markets"]["marketById"][string] | null;
  getPopulationDomainKeys: () => PopulationDomainKeys;
  getHexFertilityMultiplier: (hexId: string) => number;
  getTransportCorridorCapacity: (corridor: TransportCorridorEntry) => number;
  globalGoodDemandHistoryByResourceId: Record<string, number[]>;
  globalGoodOfferHistoryByResourceId: Record<string, number[]>;
  globalGoodPriceHistoryByResourceId: Record<string, number[]>;
  globalGoodPrices: Record<string, number>;
  globalGoodProductionFactHistoryByResourceId: Record<string, number[]>;
  globalGoodProductionMaxHistoryByResourceId: Record<string, number[]>;
  normalizeHexIdList: (input: unknown) => string[];
  normalizeRegionPopulation: (input: unknown, hexId: string, domains: PopulationDomainKeys) => RegionPopulation;
  resolveModifiedValue: (stat: ModifierStat, base: number, context: { countryId: string; hexId?: string; buildingId?: string; goodId?: string; resourceCategoryId?: string | null; professionId?: string }) => number;
  resolvePopulationFallbackKeys: (domains: PopulationDomainKeys) => Record<PopulationDimensionKey, string>;
  round3: (value: number) => number;
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
  flushResourceLedger?: () => void;
  sortCultureNeedsByPriority: (needs: CultureNeed[]) => CultureNeed[];
  turnId: number;
  worldBase: WorldBase;
};

export type ResolveBuildingsTurnRuntimeResult = {
  latestMarketOverview: MarketOverviewState;
  nextPopulationByRegion: Record<string, RegionPopulation>;
};

type RegionTurnContext = {
  regionId: string;
  ownerCountryId: string;
  primaryHexId: string;
  hexIds: string[];
  buildingInstances: BuildingInstance[];
};

export function resolveBuildingsTurnForRuntime(deps: ResolveBuildingsTurnRuntimeDeps): ResolveBuildingsTurnRuntimeResult {
  const {
    hexHexIndex,
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
    getHexFertilityMultiplier,
    getTransportCorridorCapacity,
    globalGoodDemandHistoryByResourceId,
    globalGoodOfferHistoryByResourceId,
    globalGoodPriceHistoryByResourceId,
    globalGoodPrices,
    globalGoodProductionFactHistoryByResourceId,
    globalGoodProductionMaxHistoryByResourceId,
    normalizeHexIdList,
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
  const cityHexIds = buildCityHexIdSet(worldBase);
  const hexIndexById = new Map(hexHexIndex.map((hex) => [hex.id, hex] as const));
  const neighborHexesById = new Map<string, HexMapIndexEntry[]>();
  const goodById = new Map(gameSettings.content.goods.map((entry) => [entry.id, entry] as const));
  const professionById = new Map(gameSettings.content.professions.map((entry) => [entry.id, entry] as const));
  const lawById = new Map(gameSettings.content.laws.map((entry) => [entry.id, entry] as const));
  const nextPopulationByRegion: Record<string, RegionPopulation> = {};
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
  const logisticsFailuresByHex: Record<string, LogisticsFailure[]> = {};
  const logisticsFailureIndex = new Map<string, LogisticsFailure>();
  let alertSeq = 0;
  const pushCountryAlert = (countryId: string, alert: Omit<MarketOverviewAlert, "id">): void => {
    if (!alertsByCountry[countryId]) alertsByCountry[countryId] = [];
    alertsByCountry[countryId].push({ id: `a-${turnId}-${++alertSeq}`, ...alert });
  };
  const pushLogisticsFailure = (failure: LogisticsFailure): void => {
    pushLogisticsFailureInMarketTurn({
      failuresByHex: logisticsFailuresByHex,
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
    hexId: string;
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
    hexOwnerById: worldBase.hexOwner,
    getCorridorCapacity: (corridor) => getTransportCorridorCapacity(corridor),
    getCorridorLoad,
    getMarketMemberCountryIds: (marketId) => getMarketById(marketId)?.memberCountryIds ?? [],
    getTransitAllowedCountries: getInfrastructureTransitAgreementAllowedCountries,
    normalizeHexIds: normalizeHexIdList,
  });
  const getCorridorRoutesForTransfer = (params: {
    buyerMarketId: string;
    buyerHexId: string;
    buyerCountryId: string;
    sellerMarketId: string;
    sellerHexId: string;
    sellerCountryId: string;
    transportModes: GoodTransportMode[];
    isExternalTrade: boolean;
    infraPerUnit: number;
    requestedGoods: number;
  }): MarketCorridorTransferRoute[] => corridorRoutePlanner.getCorridorRoutesForTransfer(params);
  const getRegionTradeEndpointHexId = (regionId: string, transportMode: GoodTransportMode): string | null =>
    getRegionCorridorEndpointHexId({
      regionId,
      corridors: Object.values(gameSettings.markets.transportCorridorsById ?? {}),
      worldBase,
      transportMode,
    });
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
    corridor.lastCapacityByMode = { [corridor.transportMode]: getTransportCorridorCapacity(corridor) };
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
  const regionTurnContexts = buildRegionTurnContexts({ hexHexIndex, worldBase });
  // Pass 1: normalize instances and index all sellers before any purchases.
  // This lets buildings buy from the full market scope (province/country/market/global)
  // instead of only regions that were processed earlier in the same turn.
  for (const context of regionTurnContexts) {
    const { regionId, ownerCountryId, primaryHexId, buildingInstances } = context;
    const marketId = getMarketIdByCountry(ownerCountryId);
    for (const instance of buildingInstances) {
      const building = buildingById.get(instance.buildingId);
      if (!building) continue;
      const instanceHexId = instance.targetHexId ?? primaryHexId;
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
          hexId: instanceHexId,
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
    const { regionId, ownerCountryId, primaryHexId, buildingInstances } = context;
    if (!alertsByCountry[ownerCountryId]) alertsByCountry[ownerCountryId] = [];

    const population = normalizeRegionPopulation(worldBase.regionPopulationByRegion[regionId], regionId, domains);
    const marketId = getMarketIdByCountry(ownerCountryId);
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
    const laborCoverageHex = calculateLaborCoverage(populationTotal, totalWorkforceDemand);
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
    const activeLaws = getActivePopulationLaws(worldBase.parliamentByCountry[ownerCountryId]?.activeLawByGroupId, lawById);
    const acceptanceContext = buildPopulationAcceptanceContext({
      countryId: ownerCountryId,
      baseAcceptance: worldBase.countryPopulationAcceptanceByCountryId?.[ownerCountryId],
      activeLaws,
    });
    const getNeedsForPop = (pop: RegionPopulation["pops"][number]): CultureNeed[] => sortCultureNeedsByPriority([
      ...getActiveCultureNeeds(pop.professionId, pop.standardOfLiving),
      ...getActiveCultureNeeds(pop.cultureId, pop.standardOfLiving),
      ...getActiveCultureNeeds(pop.raceId, pop.standardOfLiving),
      ...getActiveCultureNeeds(pop.religionId, pop.standardOfLiving),
    ]);

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
      const instanceHexId = instance.targetHexId ?? primaryHexId;
      if (instance.manualWorkEnabled === false) {
        instance.isInactive = true;
        instance.inactiveReason = "Отключено вручную";
        continue;
      }
      const instanceLevel = Math.max(1, Math.floor(Number(instance.level ?? 1)));
      const maxDurability = getBuildingMaxDurability(building);
      const currentDurability = round3(Math.max(0, Math.min(maxDurability, Number(instance.currentDurability ?? maxDurability))));
      instance.currentDurability = currentDurability;
      const baseThroughput = Math.max(0, resolveModifiedValue("building_throughput", buildingBaseThroughput, {
        countryId: ownerCountryId,
        hexId: instanceHexId,
        buildingId: building.id,
      }));
      const buildingThroughput = round3(baseThroughput * resolveAdjacencyThroughputFactor({
        building,
        instance,
        regionBuildingsByRegion: worldBase.regionBuildingsByRegion,
        hexIndexById,
        neighborHexesById,
        cityHexIds,
      }));
      const warehouse = instance.warehouseByGoodId ?? {};
      const operationEconomics = prepareBuildingOperationEconomics({
        instance,
        building,
        ownerCountryId,
        instanceLevel,
        laborCoverageHex,
        buildingThroughput,
        professionsById: professionById,
        wageMultiplierByProfession,
        getBaseWageFallback: () => buildingBaseWagePerWorkerGold,
        resolveWage: (professionId, baseWage) => resolveModifiedValue("building_wage", baseWage, {
          countryId: ownerCountryId,
          hexId: instanceHexId,
          buildingId: building.id,
          professionId,
        }),
        resolveInputAmount: (input) => resolveModifiedValue("building_input", input.amount, {
          countryId: ownerCountryId,
          hexId: instanceHexId,
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
          const current = Number(worldBase.resourcesByCountry[countryId]?.ducats ?? 0);
          const next = Math.max(0, amount);
          const spent = round3(Math.max(0, current - next));
          if (spent > 0 && deps.addResourceLedgerExpense) {
            deps.addResourceLedgerExpense({
              countryId,
              resourceId: "ducats",
              amount: spent,
              sourceType: "building",
              sourceId: `state-subsidy:${countryId}`,
              categoryId: "state_subsidies",
              labelKey: "resourceLedger.source.building.stateSubsidy",
            });
            deps.flushResourceLedger?.();
          } else {
            worldBase.resourcesByCountry[countryId].ducats = next;
          }
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
        buyerHexId: instanceHexId,
        buyerRegionId: regionId,
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
        getRegionTradeEndpointHexId,
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

      const pollutionProductivityFactor = getBuildingPollutionProductivityFactor(building, instanceHexId);
      const production = resolveBuildingProductionTurn({
        building,
        instanceLevel,
        warehouse,
        regionResourceDeposits,
        targetHexId: instanceHexId,
        laborCoverage,
        infraCoverage,
        financeCoverage,
        currentDurability,
        maxDurability,
        buildingThroughput,
        fertilityMultiplier: getHexFertilityMultiplier(instanceHexId),
        pollutionProductivityFactor,
        resolveInputAmount: (input) => resolveModifiedValue("building_input", input.amount, {
          countryId: ownerCountryId,
          hexId: instanceHexId,
          buildingId: building.id,
          goodId: input.goodId,
          resourceCategoryId: getResourceCategoryId(input.goodId),
        }),
        resolveOutputAmount: (goodId, baseAmount) => resolveModifiedValue("building_output", baseAmount, {
          countryId: ownerCountryId,
          hexId: instanceHexId,
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
          hexId: instanceHexId,
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
      const hiredPopulation = allocatePopulationJobs({
        population,
        demandByProfession: employedByProfession,
        fallbackProfessionId: fallbackByDimension.professionPct,
        professionsById: professionById,
        acceptanceContext,
        activeLaws,
      }).nextPopulation;
      const provinceNeeds = resolveRegionPopulationNeedsTurn({
        population: hiredPopulation,
        demandByProfession: employedByProfession,
        fallbackProfessionId: fallbackByDimension.professionPct,
        professionsById: professionById,
        acceptanceContext,
        activeLaws,
        wagesByProfession,
        getNeedsForPop,
        getGoodPrice: getEffectivePopulationGoodPrice,
        getAvailableGoodAmount,
        purchaseGood: purchasePopulationGood,
      });
      nextPopulationByRegion[regionId] = provinceNeeds.nextPopulation;
      for (const [goodId, amount] of Object.entries(provinceNeeds.demandRequestedByGood)) {
        addCountryGood(demandRequestedByCountry, marketId, goodId, amount);
        addGlobalGood(demandRequestedGlobal, goodId, amount);
      }
    }

    worldBase.regionPopulationTreasuryByRegion[regionId] = finalizedRegionBuildings.populationTreasury;
    worldBase.regionBuildingDucatsByRegion[regionId] = finalizedRegionBuildings.buildingDucatsByBuildingId;
    worldBase.regionBuildingsByRegion[regionId] = activeBuildingInstances;
    worldBase.regionResourceDepositsByRegion[regionId] = finalizedRegionBuildings.resourceDeposits;
    if (finalizedRegionBuildings.depletedResourceDeposits.length > 0) {
      const records = finalizedRegionBuildings.depletedResourceDeposits.map((deposit): ExplanationRecord => ({
        id: `explanation:resource_depleted:${turnId}:${deposit.id}`,
        turnId,
        sourceSystem: "economy",
        sourceId: deposit.id,
        affectedObject: { kind: "region", id: regionId },
        valueKey: `deposit.${deposit.goodId}.amount`,
        previousValue: deposit.initialAmount,
        newValue: 0,
        causes: [
          {
            labelKey: "resourceDeposit.explanation.depleted",
            sourceId: deposit.hexId,
            amount: -Math.max(0, Number(deposit.initialAmount ?? 0)),
          },
        ],
        modifierIds: [],
      }));
      worldBase.explanationRecordsByTurn[turnId] = [...(worldBase.explanationRecordsByTurn[turnId] ?? []), ...records].slice(-2_000);
    }
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
    logisticsFailuresByHex,
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
    getTransportCorridorCapacity: (corridor) => getTransportCorridorCapacity(corridor),
    pushCountryAlert,
  });
  return { latestMarketOverview, nextPopulationByRegion };
}

function buildRegionTurnContexts(params: {
  hexHexIndex: HexMapIndexEntry[];
  worldBase: Pick<
    WorldBase,
    "regionOwner" | "regionController" | "regionPopulationByRegion" | "regionBuildingsByRegion" | "regionConstructionQueueByRegion"
  >;
}): RegionTurnContext[] {
  const hexIdsByRegion = new Map<string, string[]>();
  for (const province of params.hexHexIndex) {
    if (!province.regionId) continue;
    const current = hexIdsByRegion.get(province.regionId) ?? [];
    current.push(province.id);
    hexIdsByRegion.set(province.regionId, current);
  }
  const regionIds = new Set<string>([
    ...hexIdsByRegion.keys(),
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
      const hexIds = [...(hexIdsByRegion.get(regionId) ?? [])].sort((left, right) => left.localeCompare(right, "en"));
      return [{
        regionId,
        ownerCountryId,
        primaryHexId: hexIds[0] ?? regionId,
        hexIds,
        buildingInstances: [...(params.worldBase.regionBuildingsByRegion[regionId] ?? [])]
          .sort((left, right) => left.instanceId.localeCompare(right.instanceId)),
      }];
    });
}

function getActivePopulationLaws(
  activeLawByGroupId: Record<string, string> | undefined,
  lawById: ReadonlyMap<string, PopulationAcceptanceContentEntry>,
): PopulationAcceptanceContentEntry[] {
  return Object.values(activeLawByGroupId ?? {})
    .map((lawId) => lawById.get(lawId))
    .filter((law): law is PopulationAcceptanceContentEntry => Boolean(law));
}

function buildPopulationAcceptanceContext(params: {
  countryId: string;
  baseAcceptance?: {
    acceptedCultureIds?: string[];
    acceptedReligionIds?: string[];
    acceptedRaceIds?: string[];
  };
  activeLaws: PopulationAcceptanceContentEntry[];
}): PopulationAcceptanceContext {
  const acceptedCultureIds = new Set<string>(params.baseAcceptance?.acceptedCultureIds ?? []);
  const acceptedReligionIds = new Set<string>(params.baseAcceptance?.acceptedReligionIds ?? []);
  const acceptedRaceIds = new Set<string>(params.baseAcceptance?.acceptedRaceIds ?? []);
  for (const law of params.activeLaws) {
    if (law.acceptanceMode === "replace") {
      acceptedCultureIds.clear();
      acceptedReligionIds.clear();
      acceptedRaceIds.clear();
    }
    for (const id of law.acceptedCultureIds ?? []) acceptedCultureIds.add(id);
    for (const id of law.acceptedReligionIds ?? []) acceptedReligionIds.add(id);
    for (const id of law.acceptedRaceIds ?? []) acceptedRaceIds.add(id);
  }
  return {
    countryId: params.countryId,
    acceptedCultureIds,
    acceptedReligionIds,
    acceptedRaceIds,
    activeLawIds: new Set(params.activeLaws.map((law) => law.id)),
  };
}

function resolveAdjacencyThroughputFactor(params: {
  building: BuildingContentEntry;
  instance: BuildingInstance;
  regionBuildingsByRegion: WorldBase["regionBuildingsByRegion"];
  hexIndexById: ReadonlyMap<string, HexMapIndexEntry>;
  neighborHexesById: Map<string, HexMapIndexEntry[]>;
  cityHexIds?: ReadonlySet<string>;
}): number {
  const effects = params.building.adjacencyEffects ?? [];
  const targetHexId = params.instance.targetHexId;
  if (!targetHexId || effects.length === 0) return 1;
  const neighborHexes = getCachedNeighborHexes(targetHexId, params.hexIndexById, params.neighborHexesById);
  if (neighborHexes.length === 0) return 1;
  let factor = 1;
  for (const effect of effects) {
    const modifier = effect.modifier;
    if (modifier.target !== "building.throughput" || !Number.isFinite(modifier.value)) continue;
    let matches = 0;
    for (const neighbor of neighborHexes) {
      const terrain = neighbor.landscape ?? neighbor.hexType ?? "";
      const feature = neighbor.landscape ?? "";
      if (effect.when.neighborTerrains?.length && !effect.when.neighborTerrains.some((item) => item === terrain)) continue;
      if (effect.when.neighborFeatures?.length && !effect.when.neighborFeatures.some((item) => item === feature)) continue;
      if (effect.when.neighborTags?.length && !effect.when.neighborTags.some((tag) => tag === "city" && params.cityHexIds?.has(neighbor.id))) continue;
      if (effect.when.neighborBuildingIds?.length) {
        const instances = params.regionBuildingsByRegion[neighbor.regionId ?? ""] ?? [];
        if (!instances.some((instance) => instance.targetHexId === neighbor.id && effect.when.neighborBuildingIds?.includes(instance.buildingId))) continue;
      }
      matches += 1;
    }
    const rawStacks = effect.perNeighbor ? matches : matches > 0 ? 1 : 0;
    const stacks = Math.max(0, Math.min(Math.floor(effect.maxStacks ?? rawStacks), rawStacks));
    if (stacks <= 0) continue;
    if (modifier.operation === "multiply") {
      factor *= Math.pow(modifier.value, stacks);
    } else {
      factor += modifier.value * stacks;
    }
  }
  return Math.max(0, Number(factor.toFixed(3)));
}

function getCachedNeighborHexes(
  targetHexId: string,
  hexIndexById: ReadonlyMap<string, HexMapIndexEntry>,
  neighborHexesById: Map<string, HexMapIndexEntry[]>,
): HexMapIndexEntry[] {
  const cached = neighborHexesById.get(targetHexId);
  if (cached) return cached;
  const target = hexIndexById.get(targetHexId);
  const neighborHexes = target
    ? target.neighbors.map((id) => hexIndexById.get(id)).filter((hex): hex is HexMapIndexEntry => Boolean(hex))
    : [];
  neighborHexesById.set(targetHexId, neighborHexes);
  return neighborHexes;
}
