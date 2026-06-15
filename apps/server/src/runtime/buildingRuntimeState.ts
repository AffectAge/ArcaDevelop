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
  getProvinceBuildRestriction,
  isCountryAllowedForBuildingSync,
  isCountryAllowedForBuildingWithEngine,
  parseRequestedBuildingIdFromPayload,
  resolveBuildingConstructionQueuesTurn as resolveBuildingConstructionQueuesTurnInState,
  resolveBuildingOwnerFromPayload,
} from "../mechanics/buildingMechanics";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import type { BuildingContentEntry, GameSettings } from "./gameSettingsTypes";

type BuildingRuntimeParams = {
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getProvinceById: () => Map<string, Adm1ProvinceIndexEntry>;
  ensureCountryInWorldBase: (countryId: string) => void;
};

export type BuildingRuntime = ReturnType<typeof createBuildingRuntime>;

export function createBuildingRuntime(params: BuildingRuntimeParams) {
  const parseRequestedBuildingIdFromPayloadForRuntime = (payload: Record<string, unknown>): string =>
    parseRequestedBuildingIdFromPayload(payload, params.getGameSettings().content.buildings[0]?.id || "");

  const getProvinceBuildRestrictionForRuntime = (building: BuildingContentEntry, provinceId: string): string | null =>
    getProvinceBuildRestriction(building, params.getProvinceById().get(provinceId));

  const getProvinceFertilityMultiplier = (provinceId: string): number => {
    const fertility = Number(params.getProvinceById().get(provinceId)?.fertility ?? 100);
    if (!Number.isFinite(fertility)) return 1;
    return Math.max(0, fertility / 100);
  };

  const getBuildingPollutionProductivityFactorForRuntime = (building: BuildingContentEntry, provinceId: string): number =>
    getBuildingPollutionProductivityFactor({
      building,
      province: params.getProvinceById().get(provinceId),
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
    });
  };

  return {
    parseRequestedBuildingIdFromPayload: parseRequestedBuildingIdFromPayloadForRuntime,
    isCountryAllowedForBuildingSync,
    getProvinceBuildRestriction: getProvinceBuildRestrictionForRuntime,
    getProvinceFertilityMultiplier,
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
