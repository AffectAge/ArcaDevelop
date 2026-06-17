import { randomUUID } from "node:crypto";
import type {
  BuildingInstance,
  ModifierStat,
  PopulationPop,
  PopulationProfessionState,
  RegionConstructionProject,
  RegionPopulation,
  RegionResourceDeposit,
  RegionResourceExplorationProject,
  WorldBase,
} from "@arcanorum/shared";
import { DEFAULT_BUILDING_DURABILITY_MAX } from "../mechanics/buildingMechanics";
import { normalizeIdeologyAttractionRules } from "../mechanics/contentDefinitionNormalizers";
import {
  buildRandomRegionPopulation as buildRandomRegionPopulationInState,
  buildSinglePopRegionPopulation,
  getActiveCultureNeeds as getActiveCultureNeedsFromState,
  isEqualRegionPopulation as isEqualRegionPopulationInState,
  normalizePopulationPops as normalizePopulationPopsInState,
  normalizeRegionPopulation as normalizeRegionPopulationInState,
  normalizeRegionPopulationMap as normalizeRegionPopulationMapInState,
  resolvePopulationFallbackKeys as resolvePopulationFallbackKeysInState,
  resolvePopulationTurnForRegions,
  sortCultureNeedsByPriority as sortCultureNeedsByPriorityFromState,
  type CultureNeed,
  type PopulationDimensionKey,
  type PopulationDomainKeys,
} from "../mechanics/populationMechanics";
import {
  ensureDefaultCulture,
  ensureDefaultIdeology,
  ensureDefaultRace,
  ensureDefaultReligion,
  ensureDefaultUnemployedProfession,
} from "../content/contentNormalizers";
import type { GoodTransportMode, MarketOverviewState } from "../mechanics/marketTurnMechanics";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import {
  normalizeRegionBuildingDucatsMap as normalizeRegionBuildingDucatsMapForRuntime,
  normalizeRegionBuildingsMap as normalizeRegionBuildingsMapForRuntime,
  normalizeRegionConstructionQueueMap as normalizeRegionConstructionQueueMapForRuntime,
  normalizeRegionPopulationTreasuryMap as normalizeRegionPopulationTreasuryMapForRuntime,
  normalizeRegionResourceDepositsMap as normalizeRegionResourceDepositsMapForRuntime,
  normalizeRegionResourceExplorationCountMap as normalizeRegionResourceExplorationCountMapForRuntime,
  normalizeRegionResourceExplorationQueueMap as normalizeRegionResourceExplorationQueueMapForRuntime,
  type ProvinceStateNormalizerParams,
} from "./provinceStateNormalizers";
import { resolveBuildingsTurnForRuntime } from "./buildingTurnRuntime";
import type { BuildingContentEntry, GameSettings, TransportCorridorEntry } from "./gameSettingsTypes";

type WorldPopulationRuntimeParams = {
  getGameSettings: () => GameSettings;
  getWorldBase: () => WorldBase;
  getTurnId: () => number;
  getProvinceIndex: () => Adm1ProvinceIndexEntry[];
  getRegionIds?: () => string[];
  getProvinceAreaKm2: (provinceId: string) => number;
  getProvinceOwner: (provinceId: string) => string | null;
  setLatestMarketOverview: (overview: MarketOverviewState) => void;
  getActiveCountryModifierRows: (countryId: string) => Array<{ id: string; sourceId: string; label: string }>;
  ensureCountryParliament: (countryId: string) => { activeLawByGroupId?: Record<string, string> };
  ensureCountryInWorldBase: (countryId: string) => void;
  createDefaultMarketRecord: (marketId: string, ownerCountryId: string) => GameSettings["markets"]["marketById"][string];
  getBuildingMaxDurability: (building: BuildingContentEntry | undefined) => number;
  getBuildingPollutionProductivityFactor: (building: BuildingContentEntry, provinceId: string) => number;
  getCountryMarketId: (countryId: string) => string;
  getInfrastructureTransitAgreementAllowedCountries: (
    baseCountryIds: Set<string>,
    transportMode: GoodTransportMode | null,
  ) => Set<string>;
  getMarketById: (marketId: string) => GameSettings["markets"]["marketById"][string] | null;
  getProvinceFertilityMultiplier: (provinceId: string) => number;
  getTransportCorridorCapacity: (corridor: TransportCorridorEntry, categoryId: string | null) => number;
  normalizeProvinceIdList: (input: unknown) => string[];
  resolveModifiedValue: (
    stat: ModifierStat,
    base: number,
    context: {
      countryId: string;
      provinceId?: string;
      buildingId?: string;
      goodId?: string;
      resourceCategoryId?: string | null;
      professionId?: string;
    },
  ) => number;
  round3: (value: number) => number;
  buildingBaseThroughput: number;
  buildingBaseWagePerWorkerGold: number;
  buildingDurabilityDecayPerTurnFallback: number;
  buildingDurabilityRecoveryPerTurnFallback: number;
  corridorLoadHistoryLength: number;
  defaultMarketPriceSmoothing: number;
  countryGoodPrices: Record<string, Record<string, number>>;
  globalGoodPrices: Record<string, number>;
  globalGoodPriceHistoryByResourceId: Record<string, number[]>;
  globalGoodDemandHistoryByResourceId: Record<string, number[]>;
  globalGoodOfferHistoryByResourceId: Record<string, number[]>;
  globalGoodProductionFactHistoryByResourceId: Record<string, number[]>;
  globalGoodProductionMaxHistoryByResourceId: Record<string, number[]>;
};

export type WorldPopulationRuntime = ReturnType<typeof createWorldPopulationRuntime>;

export function createWorldPopulationRuntime(params: WorldPopulationRuntimeParams) {
  function getPopulationDomainKeys(): PopulationDomainKeys {
    const gameSettings = params.getGameSettings();
    gameSettings.content.cultures = ensureDefaultCulture(gameSettings.content.cultures);
    gameSettings.content.ideologies = ensureDefaultIdeology(gameSettings.content.ideologies);
    gameSettings.content.religions = ensureDefaultReligion(gameSettings.content.religions);
    gameSettings.content.races = ensureDefaultRace(gameSettings.content.races);
    gameSettings.content.professions = ensureDefaultUnemployedProfession(gameSettings.content.professions);
    return {
      culturePct: gameSettings.content.cultures.map((entry) => entry.id),
      ideologyPct: gameSettings.content.ideologies.map((entry) => entry.id),
      religionPct: gameSettings.content.religions.map((entry) => entry.id),
      racePct: gameSettings.content.races.map((entry) => entry.id),
      professionPct: gameSettings.content.professions.map((entry) => entry.id),
    };
  }

  function resolvePopulationFallbackKeys(domains: PopulationDomainKeys): Record<PopulationDimensionKey, string> {
    const content = params.getGameSettings().content;
    return resolvePopulationFallbackKeysInState({
      domains,
      content: {
        culturePct: content.cultures,
        ideologyPct: content.ideologies,
        religionPct: content.religions,
        racePct: content.races,
        professionPct: content.professions,
      },
    });
  }

  function normalizePopulationPops(rawPops: unknown, provinceId: string, domains: PopulationDomainKeys): PopulationPop[] {
    return normalizePopulationPopsInState({
      rawPops,
      provinceId,
      domains,
      fallbackByDimension: resolvePopulationFallbackKeys(domains),
    });
  }

  function isEqualRegionPopulation(prevValue: RegionPopulation | undefined, nextValue: RegionPopulation): boolean {
    return isEqualRegionPopulationInState(prevValue, nextValue);
  }

  function buildDefaultRegionPopulation(provinceId: string, domains: PopulationDomainKeys): RegionPopulation {
    return normalizeRegionPopulationInState({
      input: null,
      provinceId,
      domains,
      fallbackByDimension: resolvePopulationFallbackKeys(domains),
      getProvinceAreaKm2: params.getProvinceAreaKm2,
    });
  }

  function buildColonizationSettlementPopulation(regionId: string, countryId: string, total: number): RegionPopulation {
    return buildSinglePopRegionPopulation({
      provinceId: regionId,
      total,
      fallbackByDimension: resolvePopulationFallbackKeys(getPopulationDomainKeys()),
      popId: `pop:${toPopulationIdSegment(regionId)}:settlers:${toPopulationIdSegment(countryId)}`,
    });
  }

  function normalizeRegionPopulation(
    input: unknown,
    provinceId: string,
    domains: PopulationDomainKeys,
  ): RegionPopulation {
    return normalizeRegionPopulationInState({
      input,
      provinceId,
      domains,
      fallbackByDimension: resolvePopulationFallbackKeys(domains),
      getProvinceAreaKm2: params.getProvinceAreaKm2,
    });
  }

  function buildRandomRegionPopulation(
    provinceId: string,
    domains: PopulationDomainKeys,
    populationTotalOverride?: number,
  ): RegionPopulation {
    return buildRandomRegionPopulationInState({
      provinceId,
      domains,
      fallbackByDimension: resolvePopulationFallbackKeys(domains),
      getProvinceAreaKm2: params.getProvinceAreaKm2,
      populationTotalOverride,
    });
  }

  function normalizeRegionPopulationMap(input: unknown): Record<string, RegionPopulation> {
    const domains = getPopulationDomainKeys();
    return normalizeRegionPopulationMapInState({
      input,
      regionIds: getRuntimeRegionIds(),
      domains,
      fallbackByDimension: resolvePopulationFallbackKeys(domains),
      getProvinceAreaKm2: params.getProvinceAreaKm2,
    });
  }

  function getProvinceStateNormalizerParams(input: unknown): ProvinceStateNormalizerParams {
    return {
      input,
      provinceIds: getRuntimeRegionIds(),
      fallbackCountryId: Object.keys(params.getWorldBase().resourcesByCountry ?? {})[0] ?? "SYSTEM",
      turnId: params.getTurnId(),
      createId: randomUUID,
      defaultBuildingDurabilityMax: DEFAULT_BUILDING_DURABILITY_MAX,
    };
  }

  function normalizeRegionBuildingsMap(input: unknown): Record<string, BuildingInstance[]> {
    return normalizeRegionBuildingsMapForRuntime(getProvinceStateNormalizerParams(input));
  }

  function normalizeRegionPopulationTreasuryMap(input: unknown): Record<string, number> {
    return normalizeRegionPopulationTreasuryMapForRuntime(getProvinceStateNormalizerParams(input));
  }

  function normalizeRegionBuildingDucatsMap(input: unknown): Record<string, Record<string, number>> {
    return normalizeRegionBuildingDucatsMapForRuntime(getProvinceStateNormalizerParams(input));
  }

  function normalizeRegionConstructionQueueMap(input: unknown): Record<string, RegionConstructionProject[]> {
    return normalizeRegionConstructionQueueMapForRuntime(getProvinceStateNormalizerParams(input));
  }

  function normalizeRegionResourceDepositsMap(input: unknown): Record<string, RegionResourceDeposit[]> {
    return normalizeRegionResourceDepositsMapForRuntime(getProvinceStateNormalizerParams(input));
  }

  function normalizeRegionResourceExplorationQueueMap(
    input: unknown,
  ): Record<string, RegionResourceExplorationProject[]> {
    return normalizeRegionResourceExplorationQueueMapForRuntime(getProvinceStateNormalizerParams(input));
  }

  function normalizeRegionResourceExplorationCountMap(input: unknown): Record<string, number> {
    return normalizeRegionResourceExplorationCountMapForRuntime(getProvinceStateNormalizerParams(input));
  }

  function getActiveCultureNeeds(cultureId: string, standardOfLiving: number): CultureNeed[] {
    const profile = params.getGameSettings().content.cultures.find((entry) => entry.id === cultureId)?.needsProfile ?? null;
    return getActiveCultureNeedsFromState(profile, standardOfLiving);
  }

  function sortCultureNeedsByPriority(needs: CultureNeed[]): CultureNeed[] {
    return sortCultureNeedsByPriorityFromState(needs);
  }

  function resolveBuildingsTurn(): Record<string, Record<string, Record<string, PopulationProfessionState>>> {
    const result = resolveBuildingsTurnForRuntime({
      adm1ProvinceIndex: params.getProvinceIndex(),
      buildingBaseThroughput: params.buildingBaseThroughput,
      buildingBaseWagePerWorkerGold: params.buildingBaseWagePerWorkerGold,
      buildingDurabilityDecayPerTurnFallback: params.buildingDurabilityDecayPerTurnFallback,
      buildingDurabilityRecoveryPerTurnFallback: params.buildingDurabilityRecoveryPerTurnFallback,
      countryGoodPrices: params.countryGoodPrices,
      corridorLoadHistoryLength: params.corridorLoadHistoryLength,
      createDefaultMarketRecord: params.createDefaultMarketRecord,
      defaultMarketPriceSmoothing: params.defaultMarketPriceSmoothing,
      ensureCountryInWorldBase: params.ensureCountryInWorldBase,
      gameSettings: params.getGameSettings(),
      getActiveCultureNeeds,
      getBuildingMaxDurability: params.getBuildingMaxDurability,
      getBuildingPollutionProductivityFactor: params.getBuildingPollutionProductivityFactor,
      getCountryMarketId: params.getCountryMarketId,
      getInfrastructureTransitAgreementAllowedCountries: params.getInfrastructureTransitAgreementAllowedCountries,
      getMarketById: params.getMarketById,
      getPopulationDomainKeys,
      getProvinceFertilityMultiplier: params.getProvinceFertilityMultiplier,
      getTransportCorridorCapacity: params.getTransportCorridorCapacity,
      globalGoodDemandHistoryByResourceId: params.globalGoodDemandHistoryByResourceId,
      globalGoodOfferHistoryByResourceId: params.globalGoodOfferHistoryByResourceId,
      globalGoodPriceHistoryByResourceId: params.globalGoodPriceHistoryByResourceId,
      globalGoodPrices: params.globalGoodPrices,
      globalGoodProductionFactHistoryByResourceId: params.globalGoodProductionFactHistoryByResourceId,
      globalGoodProductionMaxHistoryByResourceId: params.globalGoodProductionMaxHistoryByResourceId,
      normalizeProvinceIdList: params.normalizeProvinceIdList,
      normalizeRegionPopulation,
      resolveModifiedValue: params.resolveModifiedValue,
      resolvePopulationFallbackKeys,
      round3: params.round3,
      sortCultureNeedsByPriority,
      turnId: params.getTurnId(),
      worldBase: params.getWorldBase(),
    });
    params.setLatestMarketOverview(result.latestMarketOverview);
    return result.nextProfessionsByPopIdByProvince;
  }

  function resolvePopulationTurn(): void {
    const gameSettings = params.getGameSettings();
    const worldBase = params.getWorldBase();
    const domains = getPopulationDomainKeys();
    const professionByProvince = resolveBuildingsTurn();
    const ideologyContent = gameSettings.content.ideologies.map((ideology) => ({
      id: ideology.id,
      ideologyAttractionRules: normalizeIdeologyAttractionRules(ideology.ideologyAttractionRules),
    }));
    const result = resolvePopulationTurnForRegions({
      regionIds: getRuntimeRegionIds(),
      currentPopulationByRegion: worldBase.regionPopulationByRegion,
      nextProfessionsByRegion: professionByProvince,
      domains,
      fallbackByDimension: resolvePopulationFallbackKeys(domains),
      ideologies: ideologyContent,
      getProvinceAreaKm2: params.getProvinceAreaKm2,
      getIdeologyContext: (regionId) => {
        const countryId = worldBase.regionController[regionId] ?? worldBase.regionOwner[regionId] ?? null;
        const activeLawIds = new Set<string>();
        const activeModifierIds = new Set<string>();
        if (countryId) {
          const parliament = params.ensureCountryParliament(countryId);
          for (const lawId of Object.values(parliament.activeLawByGroupId ?? {})) {
            if (lawId) activeLawIds.add(lawId);
          }
          for (const row of params.getActiveCountryModifierRows(countryId)) {
            activeModifierIds.add(row.id);
            activeModifierIds.add(row.sourceId);
            activeModifierIds.add(row.label);
          }
        }
        return {
          countryId,
          activeLawIds,
          activeModifierIds,
          provinceBuildingIds: new Set(
            (worldBase.regionBuildingsByRegion[regionId] ?? []).map((building) => building.buildingId),
          ),
        };
      },
    });
    for (const regionId of result.changedRegionIds) {
      const nextPopulation = result.nextPopulationByRegion[regionId];
      if (nextPopulation) {
        worldBase.regionPopulationByRegion[regionId] = nextPopulation;
      }
    }
  }

  function defaultWorldBase(currentTurnId: number): WorldBase {
    const domains = getPopulationDomainKeys();
    const regionPopulationByRegion: Record<string, RegionPopulation> = {};
    const regionBuildingsByRegion: Record<string, BuildingInstance[]> = {};
    const regionBuildingDucatsByRegion: Record<string, Record<string, number>> = {};
    const regionPopulationTreasuryByRegion: Record<string, number> = {};
    const regionConstructionQueueByRegion: Record<string, RegionConstructionProject[]> = {};
    const regionResourceDepositsByRegion: Record<string, RegionResourceDeposit[]> = {};
    const regionResourceExplorationQueueByRegion: Record<string, RegionResourceExplorationProject[]> = {};
    const regionResourceExplorationCountByRegion: Record<string, number> = {};
    for (const regionId of getRuntimeRegionIds()) {
      regionPopulationByRegion[regionId] = buildDefaultRegionPopulation(regionId, domains);
      regionBuildingsByRegion[regionId] = [];
      regionBuildingDucatsByRegion[regionId] = {};
      regionPopulationTreasuryByRegion[regionId] = 0;
      regionConstructionQueueByRegion[regionId] = [];
      regionResourceDepositsByRegion[regionId] = [];
      regionResourceExplorationQueueByRegion[regionId] = [];
      regionResourceExplorationCountByRegion[regionId] = 0;
    }
    return {
      turnId: currentTurnId,
      resourcesByCountry: {},
      regionOwner: {},
      regionController: {},
      provinceOwner: {},
      provinceNameById: {},
      colonyProgressByRegion: {},
      regionColonizationByRegion: {},
      regionPopulationByRegion,
      regionBuildingsByRegion,
      regionBuildingDucatsByRegion,
      regionPopulationTreasuryByRegion,
      regionConstructionQueueByRegion,
      regionResourceDepositsByRegion,
      regionResourceExplorationQueueByRegion,
      regionResourceExplorationCountByRegion,
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

  function getRuntimeRegionIds(): string[] {
    const ids = params.getRegionIds?.() ?? [];
    const normalized = ids.map((id) => id.trim()).filter((id) => id.length > 0);
    return normalized.length > 0 ? [...new Set(normalized)] : ["region:world"];
  }

  return {
    buildColonizationSettlementPopulation,
    buildDefaultRegionPopulation,
    buildRandomRegionPopulation,
    defaultWorldBase,
    getActiveCultureNeeds,
    getPopulationDomainKeys,
    isEqualRegionPopulation,
    normalizePopulationPops,
    normalizeRegionBuildingDucatsMap,
    normalizeRegionBuildingsMap,
    normalizeRegionConstructionQueueMap,
    normalizeRegionPopulation,
    normalizeRegionPopulationMap,
    normalizeRegionPopulationTreasuryMap,
    normalizeRegionResourceDepositsMap,
    normalizeRegionResourceExplorationCountMap,
    normalizeRegionResourceExplorationQueueMap,
    resolveBuildingsTurn,
    resolvePopulationFallbackKeys,
    resolvePopulationTurn,
    sortCultureNeedsByPriority,
  };
}

function toPopulationIdSegment(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9:_-]+/g, "_").replace(/:/g, "_") || "unknown";
}
