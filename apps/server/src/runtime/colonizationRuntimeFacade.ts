import type { Order, WorldBase } from "@arcanorum/shared";
import {
  addActiveColonizationTarget as addActiveColonizationTargetToIndex,
  cleanupRegionColonizationProgress as cleanupRegionColonizationProgressFromState,
  getHexAreaKm2 as getHexAreaKm2FromIndex,
  getRegionColonizationConfig as getRegionColonizationConfigFromState,
  getRegionDerivedColonizationCosts as getRegionDerivedColonizationCostsFromArea,
  normalizeRegionColonizationCosts as normalizeRegionColonizationCostsInState,
  normalizeRegionManualCostFlags as normalizeRegionManualCostFlagsInState,
  rebuildActiveColonizationIndexFromWorldBase as rebuildActiveColonizationIndexFromState,
  recalculateAllRegionColonizationCosts as recalculateAllRegionColonizationCostsInState,
  removeActiveColonizationTarget as removeActiveColonizationTargetFromIndex,
  removeCountryFromActiveColonizationIndex as removeCountryFromActiveColonizationIndexByCountry,
  removeRegionFromActiveColonizationIndex as removeRegionFromActiveColonizationIndexByHex,
  type ColonizationRates,
  type RegionColonizationConfig,
} from "../mechanics/colonizationMechanics";
import type { HexMapIndexEntry } from "../map/hexIndex";
import type { TurnOrderIndexes } from "../mechanics/turnOrderIndexMechanics";

type ColonizationRuntimeFacadeParams = {
  getWorldBase: () => WorldBase;
  getTurnId: () => number;
  getColonizationRates: () => ColonizationRates;
  getHexIndex: () => HexMapIndexEntry[];
  getRegionIds?: () => string[];
  getHexAreaById: () => Map<string, number>;
  getActiveColonizeRegionsByCountry: () => Map<string, Set<string>>;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getTurnOrderIndexes: () => TurnOrderIndexes;
};

export function createColonizationRuntimeFacade(params: ColonizationRuntimeFacadeParams) {
  function getHexAreaKm2(hexId: string): number {
    return getHexAreaKm2FromIndex(hexId, params.getHexAreaById());
  }

  function getRegionAreaKm2(regionId: string): number {
    return getHexAreaKm2FromIndex(regionId, params.getHexAreaById());
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
    removeRegionFromActiveColonizationIndexByHex(params.getActiveColonizeRegionsByCountry(), regionId);
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
    getHexAreaKm2,
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
