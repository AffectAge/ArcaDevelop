import { PersistentStateScheduler } from "../persistence/persistentStateScheduler";
import { SerialTaskQueue } from "../persistence/serialTaskQueue";

export type PersistedFileReadResult =
  | { status: "missing" }
  | { status: "invalid"; error: unknown }
  | { status: "loaded"; data: unknown };

export type PersistentStateRuntimeParams<TDelta> = {
  debounceMs: number;
  persistContentLibrary: () => void;
  persistStateToDb: () => Promise<void>;
  persistWorldDeltaToDb: (delta: TDelta) => Promise<void>;
  pruneWorldDeltaLog: () => Promise<void>;
  syncWorldDeltaLogWithCurrentState: () => Promise<void>;
  loadWorldDeltaHistory: () => Promise<void>;
  readPersistedStateFile: () => PersistedFileReadResult;
  loadGameStatePayload: () => Promise<unknown | null>;
  parseAndApplyPersistentState: (input: unknown) => boolean;
  normalizeRegionManualCostFlags: () => number;
  normalizeRegionColonizationCosts: () => number;
  logInfo: (message: string) => void;
  logError: (message: string, error: unknown) => void;
};

export type PersistentStateRuntime<TDelta> = {
  savePersistentState: () => void;
  flushPersistentStateNow: () => Promise<void>;
  saveWorldDeltaPersistent: (delta: TDelta) => void;
  schedulePersistedWorldDeltaLogPrune: () => void;
  syncPersistedWorldDeltaLogWithCurrentState: () => Promise<void>;
  loadPersistedWorldDeltaHistory: () => Promise<void>;
  tryImportPersistentStateFromFile: () => Promise<boolean>;
  loadPersistentState: () => Promise<void>;
};

export function createPersistentStateRuntime<TDelta>(
  params: PersistentStateRuntimeParams<TDelta>,
): PersistentStateRuntime<TDelta> {
  const worldDeltaPersistenceQueue = new SerialTaskQueue();
  const persistentStateScheduler = new PersistentStateScheduler({
    debounceMs: params.debounceMs,
    persist: async () => {
      params.persistContentLibrary();
      await params.persistStateToDb();
    },
    onError: (error) => {
      params.logError("[state] Failed to save game state to DB:", error);
    },
  });

  function savePersistentState(): void {
    persistentStateScheduler.schedule();
  }

  function flushPersistentStateNow(): Promise<void> {
    return persistentStateScheduler.flushNow();
  }

  function saveWorldDeltaPersistent(delta: TDelta): void {
    worldDeltaPersistenceQueue.enqueue(
      async () => {
        await params.persistWorldDeltaToDb(delta);
      },
      (error) => {
        params.logError("[state] Failed to save world delta log:", error);
      },
    );
  }

  function schedulePersistedWorldDeltaLogPrune(): void {
    worldDeltaPersistenceQueue.enqueue(
      async () => {
        await params.pruneWorldDeltaLog();
      },
      (error) => {
        params.logError("[state] Failed to prune world delta log:", error);
      },
    );
  }

  async function tryImportPersistentStateFromFile(): Promise<boolean> {
    const fileState = params.readPersistedStateFile();
    if (fileState.status === "missing") {
      return false;
    }
    if (fileState.status === "invalid") {
      params.logError("[state] Failed to import persisted game state from file:", fileState.error);
      return false;
    }

    try {
      const ok = params.parseAndApplyPersistentState(fileState.data);
      if (!ok) {
        return false;
      }
      const normalizedManualFlags = params.normalizeRegionManualCostFlags();
      const normalizedColonizationCosts = params.normalizeRegionColonizationCosts();
      if (normalizedManualFlags > 0 || normalizedColonizationCosts > 0) {
        params.logInfo(
          `[state] Normalized region colonization metadata from JSON import: manualFlags=${normalizedManualFlags}, normalizedCosts=${normalizedColonizationCosts}`,
        );
      }
      await params.persistStateToDb();
      params.logInfo("[state] Imported persistent game state from JSON file into database");
      return true;
    } catch (error) {
      params.logError("[state] Failed to import persisted game state from file:", error);
      return false;
    }
  }

  async function loadPersistentState(): Promise<void> {
    try {
      const row = await params.loadGameStatePayload();
      if (row) {
        params.parseAndApplyPersistentState(row);
        const normalizedManualFlags = params.normalizeRegionManualCostFlags();
        const normalizedColonizationCosts = params.normalizeRegionColonizationCosts();
        if (normalizedManualFlags > 0 || normalizedColonizationCosts > 0) {
          params.logInfo(
            `[state] Normalized region colonization metadata from DB state: manualFlags=${normalizedManualFlags}, normalizedCosts=${normalizedColonizationCosts}`,
          );
          await params.persistStateToDb();
        }
        return;
      }

      await tryImportPersistentStateFromFile();
    } catch (error) {
      params.logError("[state] Failed to load persisted game state from DB, using defaults:", error);
    }
  }

  return {
    savePersistentState,
    flushPersistentStateNow,
    saveWorldDeltaPersistent,
    schedulePersistedWorldDeltaLogPrune,
    syncPersistedWorldDeltaLogWithCurrentState: params.syncWorldDeltaLogWithCurrentState,
    loadPersistedWorldDeltaHistory: params.loadWorldDeltaHistory,
    tryImportPersistentStateFromFile,
    loadPersistentState,
  };
}
