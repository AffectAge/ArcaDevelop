import type { Order, WorldBase } from "@arcanorum/shared";
import {
  addActiveColonizationTarget as addActiveColonizationTargetToIndex,
  cleanupRegionColonizationProgress as cleanupRegionColonizationProgressFromState,
  getProvinceAreaKm2 as getProvinceAreaKm2FromIndex,
  getRegionColonizationConfig as getRegionColonizationConfigFromState,
  getRegionDerivedColonizationCosts as getRegionDerivedColonizationCostsFromArea,
  normalizeRegionColonizationCosts as normalizeRegionColonizationCostsInState,
  normalizeRegionManualCostFlags as normalizeRegionManualCostFlagsInState,
  rebuildActiveColonizationIndexFromWorldBase as rebuildActiveColonizationIndexFromState,
  recalculateAllRegionColonizationCosts as recalculateAllRegionColonizationCostsInState,
  removeActiveColonizationTarget as removeActiveColonizationTargetFromIndex,
  removeCountryFromActiveColonizationIndex as removeCountryFromActiveColonizationIndexByCountry,
  removeRegionFromActiveColonizationIndex as removeRegionFromActiveColonizationIndexByProvince,
  type ColonizationRates,
  type RegionColonizationConfig,
} from "../mechanics/colonizationMechanics";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import type { TurnOrderIndexes } from "../mechanics/turnOrderIndexMechanics";

type ColonizationRuntimeFacadeParams = {
  getWorldBase: () => WorldBase;
  getTurnId: () => number;
  getColonizationRates: () => ColonizationRates;
  getProvinceIndex: () => Adm1ProvinceIndexEntry[];
  getRegionIds?: () => string[];
  getProvinceAreaById: () => Map<string, number>;
  getActiveColonizeRegionsByCountry: () => Map<string, Set<string>>;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getTurnOrderIndexes: () => TurnOrderIndexes;
};

export function createColonizationRuntimeFacade(params: ColonizationRuntimeFacadeParams) {
  function getProvinceAreaKm2(provinceId: string): number {
    return getProvinceAreaKm2FromIndex(provinceId, params.getProvinceAreaById());
  }

  function getRegionAreaKm2(regionId: string): number {
    return getProvinceAreaKm2FromIndex(regionId, params.getProvinceAreaById());
  }

  function getRegionDerivedColonizationCosts(
    regionId: string,
    rates?: ColonizationRates,
  ): { pointsCost: number; ducatsCost: number } {
    return getRegionDerivedColonizationCostsFromArea({
      regionId,
      getRegionAreaKm2,
      rates: rates ?? params.getColonizationRates(),
    });
  }

  function getRegionColonizationConfig(regionId: string): RegionColonizationConfig {
    return getRegionColonizationConfigFromState({
      regionId,
      worldBase: params.getWorldBase(),
      getRegionDerivedColonizationCosts,
    });
  }

  function normalizeRegionColonizationCosts(): number {
    return normalizeRegionColonizationCostsInState({
      worldBase: params.getWorldBase(),
      getRegionDerivedColonizationCosts,
    });
  }

  function recalculateAllRegionColonizationCosts(previousRates?: ColonizationRates): number {
    return recalculateAllRegionColonizationCostsInState({
      regionIds: params.getRegionIds?.() ?? Object.keys(params.getWorldBase().regionOwner),
      worldBase: params.getWorldBase(),
      getRegionDerivedColonizationCosts,
      previousRates,
    });
  }

  function rebuildActiveColonizationIndexFromWorldBase(): void {
    rebuildActiveColonizationIndexFromState({
      activeColonizeRegionsByCountry: params.getActiveColonizeRegionsByCountry(),
      worldBase: params.getWorldBase(),
      getRegionColonizationConfig,
    });
  }

  function addActiveColonizationTarget(countryId: string, regionId: string): void {
    addActiveColonizationTargetToIndex(params.getActiveColonizeRegionsByCountry(), countryId, regionId);
  }

  function removeActiveColonizationTarget(countryId: string, regionId: string): void {
    removeActiveColonizationTargetFromIndex(params.getActiveColonizeRegionsByCountry(), countryId, regionId);
  }

  function removeRegionFromActiveColonizationIndex(regionId: string): void {
    removeRegionFromActiveColonizationIndexByProvince(params.getActiveColonizeRegionsByCountry(), regionId);
  }

  function removeCountryFromActiveColonizationIndex(countryId: string): void {
    removeCountryFromActiveColonizationIndexByCountry(params.getActiveColonizeRegionsByCountry(), countryId);
  }

  function normalizeRegionManualCostFlags(): number {
    return normalizeRegionManualCostFlagsInState({
      worldBase: params.getWorldBase(),
      getRegionDerivedColonizationCosts,
    });
  }

  function cleanupRegionColonizationProgress(regionId: string): void {
    cleanupRegionColonizationProgressFromState({
      regionId,
      turnId: params.getTurnId(),
      worldBase: params.getWorldBase(),
      activeColonizeRegionsByCountry: params.getActiveColonizeRegionsByCountry(),
      ordersByTurn: params.getOrdersByTurn(),
      turnOrderIndexes: params.getTurnOrderIndexes(),
    });
  }

  return {
    getProvinceAreaKm2,
    getRegionAreaKm2,
    getRegionDerivedColonizationCosts,
    getRegionColonizationConfig,
    normalizeRegionColonizationCosts,
    recalculateAllRegionColonizationCosts,
    rebuildActiveColonizationIndexFromWorldBase,
    addActiveColonizationTarget,
    removeActiveColonizationTarget,
    removeRegionFromActiveColonizationIndex,
    removeCountryFromActiveColonizationIndex,
    normalizeRegionManualCostFlags,
    cleanupRegionColonizationProgress,
  };
}
