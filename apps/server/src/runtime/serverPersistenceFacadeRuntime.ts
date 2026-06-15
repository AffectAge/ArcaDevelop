import type { WorldDelta } from "@arcanorum/shared";
import type { GameStatePersistenceRuntime } from "./gameStatePersistenceRuntime";
import { createRuntimeRef } from "./runtimeRef";

export function createServerPersistenceFacadeRuntime(): {
  persistentStateRuntimeRef: ReturnType<typeof createRuntimeRef<GameStatePersistenceRuntime>>["ref"];
  persistenceFacade: {
    savePersistentState: () => void;
    flushPersistentStateNow: () => Promise<void>;
    saveWorldDeltaPersistent: (delta: WorldDelta) => void;
    schedulePersistedWorldDeltaLogPrune: () => void;
    syncPersistedWorldDeltaLogWithCurrentState: () => Promise<void>;
    loadPersistedWorldDeltaHistory: () => Promise<void>;
    loadPersistentState: () => Promise<void>;
  };
} {
  const { ref: persistentStateRuntimeRef, get: getPersistentStateRuntime } =
    createRuntimeRef<GameStatePersistenceRuntime>("Persistent state runtime");

  return {
    persistentStateRuntimeRef,
    persistenceFacade: {
      savePersistentState: () => getPersistentStateRuntime().savePersistentState(),
      flushPersistentStateNow: () => getPersistentStateRuntime().flushPersistentStateNow(),
      saveWorldDeltaPersistent: (delta) => getPersistentStateRuntime().saveWorldDeltaPersistent(delta),
      schedulePersistedWorldDeltaLogPrune: () => getPersistentStateRuntime().schedulePersistedWorldDeltaLogPrune(),
      syncPersistedWorldDeltaLogWithCurrentState: () =>
        getPersistentStateRuntime().syncPersistedWorldDeltaLogWithCurrentState(),
      loadPersistedWorldDeltaHistory: () => getPersistentStateRuntime().loadPersistedWorldDeltaHistory(),
      loadPersistentState: () => getPersistentStateRuntime().loadPersistentState(),
    },
  };
}
