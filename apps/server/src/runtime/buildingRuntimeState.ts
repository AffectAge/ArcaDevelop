import { randomUUID } from "node:crypto";
import type { BuildingOwner, Order, WorldBase } from "@arcanorum/shared";
import {
  countBuildingOccurrences as countBuildingOccurrencesInState,
  enqueueBuildingAutoUpgradesTurn as enqueueBuildingAutoUpgradesTurnInState,
  getBuildingConstructionTotalCostByLevel,
  getBuildingMaxDurability,
  getBuildingMaxLevel,
  getBuildingPollutionProductivityFactor,
  getBuildingUpgradeCosts,
  getCountryBuildLimit,
  getHexBuildRestriction,
  isCountryAllowedForBuildingSync,
  isCountryAllowedForBuildingWithEngine,
  parseRequestedBuildingIdFromPayload,
  resolveBuildingConstructionQueuesTurn as resolveBuildingConstructionQueuesTurnInState,
  resolveBuildingOwnerFromPayload,
} from "../mechanics/buildingMechanics";
import type { HexMapIndexEntry } from "../map/hexIndex";
import type { BuildingContentEntry, GameSettings } from "./gameSettingsTypes";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";

type BuildingRuntimeParams = {
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getHexById: () => Map<string, HexMapIndexEntry>;
  ensureCountryInWorldBase: (countryId: string) => void;
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
};

export type BuildingRuntime = ReturnType<typeof createBuildingRuntime>;

export function createBuildingRuntime(params: BuildingRuntimeParams) {
  const parseRequestedBuildingIdFromPayloadForRuntime = (payload: Record<string, unknown>): string =>
    parseRequestedBuildingIdFromPayload(payload, params.getGameSettings().content.buildings[0]?.id || "");

  const getHexBuildRestrictionForRuntime = (building: BuildingContentEntry, provinceOrRegionId: string): string | null => {
    const hexById = params.getHexById();
    const exactHex = hexById.get(provinceOrRegionId);
    if (exactHex) {
      return getHexBuildRestriction(building, exactHex);
    }

    const regionHexes = [...hexById.values()].filter((province) => province.regionId === provinceOrRegionId);
    if (regionHexes.length === 0) {
      return "Регион не найден в индексе карты";
    }

    let firstRestriction: string | null = null;
    for (const province of regionHexes) {
      const restriction = getHexBuildRestriction(building, province);
      if (!restriction) return null;
      firstRestriction ??= restriction;
    }
    return firstRestriction;
  };

  const getHexFertilityMultiplier = (hexId: string): number => {
    const fertility = Number(params.getHexById().get(hexId)?.fertility ?? 100);
    if (!Number.isFinite(fertility)) return 1;
    return Math.max(0, fertility / 100);
  };

  const getBuildingPollutionProductivityFactorForRuntime = (building: BuildingContentEntry, hexId: string): number =>
    getBuildingPollutionProductivityFactor({
      building,
      province: params.getHexById().get(hexId),
      pollutionProductivityEffectPer1000: Number(params.getGameSettings().economy.pollutionProductivityEffectPer1000 ?? 0),
    });

  const countBuildingOccurrencesForRuntime = (
    buildingId: string,
    countryId: string,
    options?: { includePendingOrders?: boolean },
  ): { byCountry: number; global: number } => {
    const pendingOrders = options?.includePendingOrders === false
      ? []
      : [...(params.getOrdersByTurn().get(params.getTurnId())?.values() ?? [])].flat();
    return countBuildingOccurrencesInState({
      buildingId,
      countryId,
      worldBase: params.getWorldBase(),
      pendingOrders,
      parseRequestedBuildingId: parseRequestedBuildingIdFromPayloadForRuntime,
    });
  };

  const resolveBuildingOwnerFromPayloadForRuntime = (
    payload: Record<string, unknown>,
    requestedByCountryId: string,
  ): BuildingOwner | null =>
    resolveBuildingOwnerFromPayload({
      payload,
      requestedByCountryId,
      companyIds: new Set(params.getGameSettings().content.companies.map((company) => company.id)),
      countryIds: new Set(Object.keys(params.getWorldBase().resourcesByCountry)),
    });

  const enqueueBuildingAutoUpgradesTurn = (): void => {
    enqueueBuildingAutoUpgradesTurnInState({
      worldBase: params.getWorldBase(),
      buildings: params.getGameSettings().content.buildings,
      turnId: params.getTurnId(),
      ensureCountryInWorldBase: params.ensureCountryInWorldBase,
      createId: randomUUID,
    });
  };

  const resolveBuildingConstructionQueuesTurn = (): void => {
    resolveBuildingConstructionQueuesTurnInState({
      worldBase: params.getWorldBase(),
      buildings: params.getGameSettings().content.buildings,
      turnId: params.getTurnId(),
      createId: randomUUID,
      addExpense: params.addResourceLedgerExpense,
    });
  };

  return {
    parseRequestedBuildingIdFromPayload: parseRequestedBuildingIdFromPayloadForRuntime,
    isCountryAllowedForBuildingSync,
    getHexBuildRestriction: getHexBuildRestrictionForRuntime,
    getHexFertilityMultiplier,
    getBuildingPollutionProductivityFactor: getBuildingPollutionProductivityFactorForRuntime,
    isCountryAllowedForBuildingWithEngine,
    countBuildingOccurrences: countBuildingOccurrencesForRuntime,
    getCountryBuildLimit,
    resolveBuildingOwnerFromPayload: resolveBuildingOwnerFromPayloadForRuntime,
    getBuildingMaxLevel,
    getBuildingMaxDurability,
    getBuildingUpgradeCosts,
    getBuildingConstructionTotalCostByLevel,
    enqueueBuildingAutoUpgradesTurn,
    resolveBuildingConstructionQueuesTurn,
  };
}
