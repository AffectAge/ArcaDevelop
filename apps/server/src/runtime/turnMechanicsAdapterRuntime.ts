import type { WorldBase } from "@arcanorum/shared";
import type { HexMapIndexEntry } from "../map/hexIndex";
import {
  resolveResourceExplorationTurn as resolveResourceExplorationTurnInState,
  type ResourceExplorationConfig,
} from "../mechanics/resourceExplorationMechanics";
import { resolveTransportCorridorConstructionTurn as resolveTransportCorridorConstructionTurnInState } from "../mechanics/transportCorridorMechanics";
import type { GameSettings } from "./gameSettingsTypes";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";

type TurnMechanicsAdapterRuntimeParams = {
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  getHexIndex: () => HexMapIndexEntry[];
  getHexAreaKm2: (hexId: string) => number;
  ensureMarketModelReady: () => void;
  areHexIdsAdjacentOrSame: (leftHexId: string, rightHexId: string) => boolean;
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
};

export function createTurnMechanicsAdapterRuntime(params: TurnMechanicsAdapterRuntimeParams): {
  resolveResourceExplorationTurn: () => void;
  resolveTransportCorridorConstructionTurn: () => void;
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
    for (const province of params.getHexIndex()) {
      if (!province.regionId) continue;
      areaByRegion.set(province.regionId, (areaByRegion.get(province.regionId) ?? 0) + params.getHexAreaKm2(province.id));
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
      addExpense: params.addResourceLedgerExpense,
    });
  }

  return {
    resolveResourceExplorationTurn,
    resolveTransportCorridorConstructionTurn,
  };
}
