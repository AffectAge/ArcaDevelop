import type { WorldBase } from "@arcanorum/shared";
import { buildServerDefaultGameSettings } from "./serverRuntimeConfig";
import type { GameSettings } from "./gameSettingsTypes";
import type { createWorldPopulationRuntime } from "./worldPopulationRuntime";

type ServerDefaultStateRuntimeParams = {
  worldPopulationRuntime: ReturnType<typeof createWorldPopulationRuntime>;
};

export function createServerDefaultStateRuntime(params: ServerDefaultStateRuntimeParams): {
  defaultGameSettings: () => GameSettings;
  defaultWorldBase: (currentTurnId: number) => WorldBase;
} {
  return {
    defaultGameSettings: () => buildServerDefaultGameSettings(),
    defaultWorldBase: (currentTurnId) => params.worldPopulationRuntime.defaultWorldBase(currentTurnId),
  };
}
