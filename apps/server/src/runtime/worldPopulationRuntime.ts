import { randomUUID } from "node:crypto";
import type {
  BuildingInstance,
  ModifierStat,
  PopulationPop,
  RegionConstructionProject,
  RegionPopulation,
  RegionResourceDeposit,
  RegionResourceExplorationProject,
  WorldBase,
} from "@arcanorum/shared";
import { DEFAULT_BUILDING_DURABILITY_MAX } from "../mechanics/buildingMechanics";
import { normalizeIdeologyAttractionRules } from "../mechanics/contentDefinitionNormalizers";
import {
  getActiveCultureNeeds as getActiveCultureNeedsFromState,
  isEqualRegionPopulation as isEqualRegionPopulationInState,
  makeAtomicPopulationPop,
  normalizePopulationPopsStrict,
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
import type { HexMapIndexEntry } from "../map/hexIndex";
import {
  normalizeRegionBuildingDucatsMap as normalizeRegionBuildingDucatsMapForRuntime,
  normalizeRegionBuildingsMap as normalizeRegionBuildingsMapForRuntime,
  normalizeRegionConstructionQueueMap as normalizeRegionConstructionQueueMapForRuntime,
  normalizeRegionPopulationTreasuryMap as normalizeRegionPopulationTreasuryMapForRuntime,
  normalizeRegionResourceDepositsMap as normalizeRegionResourceDepositsMapForRuntime,
  normalizeRegionResourceExplorationCountMap as normalizeRegionResourceExplorationCountMapForRuntime,
  normalizeRegionResourceExplorationQueueMap as normalizeRegionResourceExplorationQueueMapForRuntime,
  type HexStateNormalizerParams,
} from "./provinceStateNormalizers";
import { resolveBuildingsTurnForRuntime } from "./buildingTurnRuntime";
import type { BuildingContentEntry, GameSettings, TransportCorridorEntry } from "./gameSettingsTypes";
import type { CountryIdentityStartingPop } from "./gameSettingsTypes";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";

type WorldPopulationRuntimeParams = {
  getGameSettings: () => GameSettings;
  getWorldBase: () => WorldBase;
  getTurnId: () => number;
  getHexIndex: () => HexMapIndexEntry[];
  getRegionIds?: () => string[];
  getHexOwner: (hexId: string) => string | null;
  setLatestMarketOverview: (overview: MarketOverviewState) => void;
  getActiveCountryModifierRows: (countryId: string) => Array<{ id: string; sourceId: string; label: string }>;
  ensureCountryParliament: (countryId: string) => { activeLawByGroupId?: Record<string, string> };
  ensureCountryInWorldBase: (countryId: string) => void;
  createDefaultMarketRecord: (marketId: string, ownerCountryId: string) => GameSettings["markets"]["marketById"][string];
  getBuildingMaxDurability: (building: BuildingContentEntry | undefined) => number;
  getBuildingPollutionProductivityFactor: (building: BuildingContentEntry, hexId: string) => number;
  getCountryMarketId: (countryId: string) => string;
  getInfrastructureTransitAgreementAllowedCountries: (
    baseCountryIds: Set<string>,
    transportMode: GoodTransportMode | null,
  ) => Set<string>;
  getMarketById: (marketId: string) => GameSettings["markets"]["marketById"][string] | null;
  getHexFertilityMultiplier: (hexId: string) => number;
  getTransportCorridorCapacity: (corridor: TransportCorridorEntry) => number;
  normalizeHexIdList: (input: unknown) => string[];
  resolveModifiedValue: (
    stat: ModifierStat,
    base: number,
    context: {
      countryId: string;
      hexId?: string;
      buildingId?: string;
      goodId?: string;
      resourceCategoryId?: string | null;
      professionId?: string;
    },
  ) => number;
  round3: (value: number) => number;
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
  flushResourceLedger?: () => void;
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

function mergeIdentityStartingPop(...sources: Array<CountryIdentityStartingPop | null | undefined>): CountryIdentityStartingPop {
  const merged: CountryIdentityStartingPop = {};
  for (const source of sources) {
    if (!source) continue;
    if (source.literacy != null) merged.literacy = source.literacy;
    if (source.ducats != null) merged.ducats = source.ducats;
    if (source.standardOfLiving != null) merged.standardOfLiving = source.standardOfLiving;
    if (source.radicals != null) merged.radicals = source.radicals;
    if (source.loyalists != null) merged.loyalists = source.loyalists;
    if (source.qualificationsByCategory) {
      merged.qualificationsByCategory = { ...(merged.qualificationsByCategory ?? {}), ...source.qualificationsByCategory };
    }
    if (source.ideologies) {
      merged.ideologies = { ...(merged.ideologies ?? {}), ...source.ideologies };
    }
  }
  return merged;
}

export function createWorldPopulationRuntime(params: WorldPopulationRuntimeParams) {
  function getPopulationDomainKeys(): PopulationDomainKeys {
    const gameSettings = params.getGameSettings();
    gameSettings.content.cultures = ensureDefaultCulture(gameSettings.content.cultures);
    gameSettings.content.ideologies = ensureDefaultIdeology(gameSettings.content.ideologies);
    gameSettings.content.religions = ensureDefaultReligion(gameSettings.content.religions);
    gameSettings.content.races = ensureDefaultRace(gameSettings.content.races);
    gameSettings.content.professions = ensureDefaultUnemployedProfession(gameSettings.content.professions);
    const runtimeIdentities = Object.values(params.getWorldBase().countryIdentityByCountryId ?? {});
    return {
      culturePct: [...new Set([...gameSettings.content.cultures.map((entry) => entry.id), ...runtimeIdentities.map((entry) => entry.cultureId)])],
      ideologyPct: gameSettings.content.ideologies.map((entry) => entry.id),
      religionPct: [...new Set([...gameSettings.content.religions.map((entry) => entry.id), ...runtimeIdentities.map((entry) => entry.religionId)])],
      racePct: [...new Set([...gameSettings.content.races.map((entry) => entry.id), ...runtimeIdentities.map((entry) => entry.raceId)])],
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

  function normalizePopulationPops(rawPops: unknown, hexId: string, domains: PopulationDomainKeys): PopulationPop[] {
    return normalizePopulationPopsStrict({
      rawPops,
      regionId: hexId,
      domains,
    });
  }

  function isEqualRegionPopulation(prevValue: RegionPopulation | undefined, nextValue: RegionPopulation): boolean {
    return isEqualRegionPopulationInState(prevValue, nextValue);
  }

  function buildColonizationSettlementPopulation(regionId: string, countryId: string, total: number): RegionPopulation {
    const size = Math.max(0, Math.floor(Number(total) || 0));
    if (size <= 0) return { pops: [] };
    const identity = params.getWorldBase().countryIdentityByCountryId?.[countryId];
    if (!identity) {
      throw new Error(`COUNTRY_IDENTITY_REQUIRED:${countryId}`);
    }
    const content = params.getGameSettings().content;
    const startingPop = mergeIdentityStartingPop(
      content.cultureGroups.find((entry) => entry.id === identity.cultureGroupId)?.startingPop,
      content.religionGroups.find((entry) => entry.id === identity.religionGroupId)?.startingPop,
      content.races.find((entry) => entry.id === identity.raceId)?.startingPop,
    );
    return {
      pops: [
        makeAtomicPopulationPop({
          id: `pop:${regionId}:settlers:${countryId}`,
          size,
          cultureId: identity.cultureId,
          religionId: identity.religionId,
          raceId: identity.raceId,
          professionId: "profession:unemployed",
          qualificationsByCategory: startingPop.qualificationsByCategory,
          ideologies: startingPop.ideologies,
          previous: {
            literacy: startingPop.literacy,
            ducats: startingPop.ducats,
            standardOfLiving: startingPop.standardOfLiving,
            radicals: startingPop.radicals,
            loyalists: startingPop.loyalists,
          },
        }),
      ],
    };
  }

  function normalizeRegionPopulation(
    input: unknown,
    hexId: string,
    domains: PopulationDomainKeys,
  ): RegionPopulation {
    return normalizeRegionPopulationInState({
      input,
      regionId: hexId,
      domains,
    });
  }

  function normalizeRegionPopulationMap(input: unknown): Record<string, RegionPopulation> {
    const domains = getPopulationDomainKeys();
    return normalizeRegionPopulationMapInState({
      input,
      regionIds: getRuntimeRegionIds(),
      domains,
    });
  }

  function getHexStateNormalizerParams(input: unknown): HexStateNormalizerParams {
    return {
      input,
      hexIds: getRuntimeRegionIds(),
      fallbackCountryId: Object.keys(params.getWorldBase().resourcesByCountry ?? {})[0] ?? "SYSTEM",
      turnId: params.getTurnId(),
      createId: randomUUID,
      defaultBuildingDurabilityMax: DEFAULT_BUILDING_DURABILITY_MAX,
    };
  }

  function normalizeRegionBuildingsMap(input: unknown): Record<string, BuildingInstance[]> {
    return normalizeRegionBuildingsMapForRuntime(getHexStateNormalizerParams(input));
  }

  function normalizeRegionPopulationTreasuryMap(input: unknown): Record<string, number> {
    return normalizeRegionPopulationTreasuryMapForRuntime(getHexStateNormalizerParams(input));
  }

  function normalizeRegionBuildingDucatsMap(input: unknown): Record<string, Record<string, number>> {
    return normalizeRegionBuildingDucatsMapForRuntime(getHexStateNormalizerParams(input));
  }

  function normalizeRegionConstructionQueueMap(input: unknown): Record<string, RegionConstructionProject[]> {
    return normalizeRegionConstructionQueueMapForRuntime(getHexStateNormalizerParams(input));
  }

  function normalizeRegionResourceDepositsMap(input: unknown): Record<string, RegionResourceDeposit[]> {
    return normalizeRegionResourceDepositsMapForRuntime(getHexStateNormalizerParams(input));
  }

  function normalizeRegionResourceExplorationQueueMap(
    input: unknown,
  ): Record<string, RegionResourceExplorationProject[]> {
    return normalizeRegionResourceExplorationQueueMapForRuntime(getHexStateNormalizerParams(input));
  }

  function normalizeRegionResourceExplorationCountMap(input: unknown): Record<string, number> {
    return normalizeRegionResourceExplorationCountMapForRuntime(getHexStateNormalizerParams(input));
  }

  function getActiveCultureNeeds(cultureId: string, standardOfLiving: number): CultureNeed[] {
    const content = params.getGameSettings().content;
    const profile =
      content.professions.find((entry) => entry.id === cultureId)?.needsProfile ??
      content.cultures.find((entry) => entry.id === cultureId)?.needsProfile ??
      content.races.find((entry) => entry.id === cultureId)?.needsProfile ??
      content.religions.find((entry) => entry.id === cultureId)?.needsProfile ??
      null;
    return getActiveCultureNeedsFromState(profile, standardOfLiving);
  }

  function sortCultureNeedsByPriority(needs: CultureNeed[]): CultureNeed[] {
    return sortCultureNeedsByPriorityFromState(needs);
  }

  function resolveBuildingsTurn(): Record<string, RegionPopulation> {
    const result = resolveBuildingsTurnForRuntime({
      hexHexIndex: params.getHexIndex(),
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
      getHexFertilityMultiplier: params.getHexFertilityMultiplier,
      getTransportCorridorCapacity: params.getTransportCorridorCapacity,
      globalGoodDemandHistoryByResourceId: params.globalGoodDemandHistoryByResourceId,
      globalGoodOfferHistoryByResourceId: params.globalGoodOfferHistoryByResourceId,
      globalGoodPriceHistoryByResourceId: params.globalGoodPriceHistoryByResourceId,
      globalGoodPrices: params.globalGoodPrices,
      globalGoodProductionFactHistoryByResourceId: params.globalGoodProductionFactHistoryByResourceId,
      globalGoodProductionMaxHistoryByResourceId: params.globalGoodProductionMaxHistoryByResourceId,
      normalizeHexIdList: params.normalizeHexIdList,
      normalizeRegionPopulation,
      resolveModifiedValue: params.resolveModifiedValue,
      resolvePopulationFallbackKeys,
      round3: params.round3,
      addResourceLedgerExpense: params.addResourceLedgerExpense,
      flushResourceLedger: params.flushResourceLedger,
      sortCultureNeedsByPriority,
      turnId: params.getTurnId(),
      worldBase: params.getWorldBase(),
    });
    params.setLatestMarketOverview(result.latestMarketOverview);
    return result.nextPopulationByRegion;
  }

  function resolvePopulationTurn(): void {
    const gameSettings = params.getGameSettings();
    const worldBase = params.getWorldBase();
    const domains = getPopulationDomainKeys();
    const nextPopulationByRegion = resolveBuildingsTurn();
    const ideologyContent = gameSettings.content.ideologies.map((ideology) => ({
      id: ideology.id,
      ideologyAttractionRules: normalizeIdeologyAttractionRules(ideology.ideologyAttractionRules),
    }));
    const result = resolvePopulationTurnForRegions({
      regionIds: getRuntimeRegionIds(),
      currentPopulationByRegion: worldBase.regionPopulationByRegion,
      nextPopulationByRegion,
      domains,
      ideologies: ideologyContent,
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
    const regionPopulationByRegion: Record<string, RegionPopulation> = {};
    const regionBuildingsByRegion: Record<string, BuildingInstance[]> = {};
    const regionBuildingDucatsByRegion: Record<string, Record<string, number>> = {};
    const regionPopulationTreasuryByRegion: Record<string, number> = {};
    const regionConstructionQueueByRegion: Record<string, RegionConstructionProject[]> = {};
    const regionResourceDepositsByRegion: Record<string, RegionResourceDeposit[]> = {};
    const regionResourceExplorationQueueByRegion: Record<string, RegionResourceExplorationProject[]> = {};
    const regionResourceExplorationCountByRegion: Record<string, number> = {};
    for (const regionId of getRuntimeRegionIds()) {
      regionPopulationByRegion[regionId] = { pops: [] };
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
      resourceLedgerByTurn: {},
      explanationRecordsByTurn: {},
      regionOwner: {},
      regionController: {},
      hexOwner: {},
      hexNameById: {},
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
      countryScheduledEventsByCountryId: {},
      countryEventFlagsByCountryId: {},
      journalEntriesByCountryId: {},
      countryModifiersByCountryId: {},
      countryPopulationAcceptanceByCountryId: {},
      countryIdentityByCountryId: {},
      unitsById: {},
      unitTrainingQueueByCountry: {},
      civilianUnitsById: {},
      civilianUnitQueueByCountry: {},
      settlementProjectsById: {},
      cityMarkersById: {},
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
