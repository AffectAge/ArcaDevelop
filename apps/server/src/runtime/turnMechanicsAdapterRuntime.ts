import type { WorldBase } from "@arcanorum/shared";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import {
  resolveResourceExplorationTurn as resolveResourceExplorationTurnInState,
  type ResourceExplorationConfig,
} from "../mechanics/resourceExplorationMechanics";
import {
  isContiguousArmyRoute as isContiguousArmyRouteInState,
  normalizeArmyMoveRoute as normalizeArmyMoveRouteFromPayload,
} from "../mechanics/militaryMechanics";
import { resolveTransportCorridorConstructionTurn as resolveTransportCorridorConstructionTurnInState } from "../mechanics/transportCorridorMechanics";
import type { GameSettings } from "./gameSettingsTypes";

type TurnMechanicsAdapterRuntimeParams = {
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  getProvinceIndex: () => Adm1ProvinceIndexEntry[];
  getProvinceAreaKm2: (provinceId: string) => number;
  ensureMarketModelReady: () => void;
  areProvinceIdsAdjacentOrSame: (leftProvinceId: string, rightProvinceId: string) => boolean;
};

export function createTurnMechanicsAdapterRuntime(params: TurnMechanicsAdapterRuntimeParams): {
  resolveResourceExplorationTurn: () => void;
  resolveTransportCorridorConstructionTurn: () => void;
  normalizeArmyMoveRoute: (
    payload: Record<string, unknown> | undefined,
    fallbackProvinceId: string,
    currentProvinceId: string,
  ) => string[];
  isContiguousArmyRoute: (fromProvinceId: string, route: string[]) => boolean;
} {
  function getResourceExplorationConfig(): ResourceExplorationConfig {
    const economy = params.getGameSettings().economy;
    return {
      rollsPerExpedition: economy.explorationRollsPerExpedition,
      baseEmptyChancePct: economy.explorationBaseEmptyChancePct,
      depletionPerAttemptPct: economy.explorationDepletionPerAttemptPct,
    };
  }

  function resolveResourceExplorationTurn(): void {
    const gameSettings = params.getGameSettings();
    const areaByRegion = new Map<string, number>();
    for (const province of params.getProvinceIndex()) {
      if (!province.regionId) continue;
      areaByRegion.set(province.regionId, (areaByRegion.get(province.regionId) ?? 0) + params.getProvinceAreaKm2(province.id));
    }
    resolveResourceExplorationTurnInState({
      worldBase: params.getWorldBase(),
      regions: [...areaByRegion.entries()].map(([id, areaKm2]) => ({ id, areaKm2 })),
      goods: gameSettings.content.goods,
      turnId: params.getTurnId(),
      config: getResourceExplorationConfig(),
    });
  }

  function resolveTransportCorridorConstructionTurn(): void {
    const gameSettings = params.getGameSettings();
    params.ensureMarketModelReady();
    resolveTransportCorridorConstructionTurnInState({
      corridorsById: gameSettings.markets.transportCorridorsById,
      worldBase: params.getWorldBase(),
      baseConstructionPerTurn: gameSettings.economy.baseConstructionPerTurn,
      nowIso: new Date().toISOString(),
    });
  }

  function normalizeArmyMoveRoute(
    payload: Record<string, unknown> | undefined,
    fallbackProvinceId: string,
    currentProvinceId: string,
  ): string[] {
    return normalizeArmyMoveRouteFromPayload(payload, fallbackProvinceId, currentProvinceId);
  }

  function isContiguousArmyRoute(fromProvinceId: string, route: string[]): boolean {
    return isContiguousArmyRouteInState({
      fromProvinceId,
      route,
      areProvinceIdsAdjacentOrSame: params.areProvinceIdsAdjacentOrSame,
    });
  }

  return {
    resolveResourceExplorationTurn,
    resolveTransportCorridorConstructionTurn,
    normalizeArmyMoveRoute,
    isContiguousArmyRoute,
  };
}
