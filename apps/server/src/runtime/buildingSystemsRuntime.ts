import type { Order, WorldBase } from "@arcanorum/shared";
import type { HexMapIndexEntry } from "../map/hexIndex";
import type { GameSettings } from "./gameSettingsTypes";
import { createBuildingRuntime } from "./buildingRuntimeState";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";

type BuildingSystemsRuntimeParams = {
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getHexById: () => Map<string, HexMapIndexEntry>;
  ensureCountryInWorldBase: (countryId: string) => void;
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
};

export function createBuildingSystemsRuntime(params: BuildingSystemsRuntimeParams): {
  buildingRuntime: ReturnType<typeof createBuildingRuntime>;
} {
  return {
    buildingRuntime: createBuildingRuntime({
      getWorldBase: params.getWorldBase,
      getGameSettings: params.getGameSettings,
      getTurnId: params.getTurnId,
      getOrdersByTurn: params.getOrdersByTurn,
      getHexById: params.getHexById,
      ensureCountryInWorldBase: params.ensureCountryInWorldBase,
      addResourceLedgerExpense: params.addResourceLedgerExpense,
    }),
  };
}
