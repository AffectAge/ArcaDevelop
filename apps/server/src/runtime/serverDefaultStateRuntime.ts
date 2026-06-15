import type { WorldBase } from "@arcanorum/shared";
import { buildServerDefaultGameSettings } from "./serverRuntimeConfig";
import type { GameSettings } from "./gameSettingsTypes";
import type { createContentLibraryRuntime } from "./contentLibraryRuntime";
import type { createWorldPopulationRuntime } from "./worldPopulationRuntime";

type ServerDefaultStateRuntimeParams = {
  contentLibraryRuntime: ReturnType<typeof createContentLibraryRuntime>;
  worldPopulationRuntime: ReturnType<typeof createWorldPopulationRuntime>;
};

export function createServerDefaultStateRuntime(params: ServerDefaultStateRuntimeParams): {
  defaultGameSettings: () => GameSettings;
  defaultWorldBase: (currentTurnId: number) => WorldBase;
} {
  return {
    defaultGameSettings: () =>
      buildServerDefaultGameSettings({
        persistedContentLibrary: params.contentLibraryRuntime.getPersistedContentLibraryFromDisk(),
      }),
    defaultWorldBase: (currentTurnId) => params.worldPopulationRuntime.defaultWorldBase(currentTurnId),
  };
}
