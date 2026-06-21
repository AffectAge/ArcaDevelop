import type { Order, WorldBase } from "@arcanorum/shared";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import type { GameSettings } from "./gameSettingsTypes";
import { createBuildingRuntime } from "./buildingRuntimeState";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";

type BuildingSystemsRuntimeParams = {
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getProvinceById: () => Map<string, Adm1ProvinceIndexEntry>;
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
      getProvinceById: params.getProvinceById,
      ensureCountryInWorldBase: params.ensureCountryInWorldBase,
      addResourceLedgerExpense: params.addResourceLedgerExpense,
    }),
  };
}
