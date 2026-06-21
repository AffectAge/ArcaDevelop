import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { Order, WorldBase, WorldDelta } from "@arcanorum/shared";
import { buildGameStatePayload } from "../persistence/gameStatePayload";
import { loadGameStatePayload, saveGameStatePayload } from "../persistence/gameStatePersistence";
import {
  serializeOrdersByTurnState,
  serializeResolveReadyByTurnState,
} from "../persistence/turnStatePersistence";
import { readPersistedStateFile } from "../persistence/persistedStateFile";
import {
  loadPersistedWorldDeltaHistory as loadPersistedWorldDeltaHistoryFromDb,
  persistWorldDeltaToDb,
  prunePersistedWorldDeltaLog,
  syncPersistedWorldDeltaLogWithCurrentState as syncPersistedWorldDeltaLogWithCurrentStateInDb,
} from "../persistence/worldDeltaLogPersistence";
import {
  createPersistentStateRuntime,
  type PersistentStateRuntime,
} from "./persistentStateRuntime";
import type { GameSettings } from "./gameSettingsTypes";
import type { MarketOverviewState } from "../mechanics/marketTurnMechanics";
import type { AdminAuditLogEntry } from "../security/adminAuditLog";

const GAME_STATE_ROW_ID = "primary";

type GameStatePersistenceRuntimeParams = {
  prisma: PrismaClient;
  dataRoot: string;
  debounceMs: number;
  maxPersistedWorldDeltaLog: number;
  maxWorldDeltaHistory: number;
  getTurnId: () => number;
  getActiveScenarioId: () => string;
  getActiveScenarioName: () => string;
  getGameSettings: () => GameSettings;
  getWorldBase: () => WorldBase;
  getLatestMarketOverview: () => MarketOverviewState;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getResolveReadyByTurn: () => Map<number, Set<string>>;
  getWorldStateVersion: () => number;
  getAdminAuditSnapshot: () => AdminAuditLogEntry[];
  replaceWorldDeltaHistory: (history: WorldDelta[]) => void;
  parseAndApplyPersistentState: (input: unknown) => boolean;
  normalizeRegionManualCostFlags: () => number;
  normalizeRegionColonizationCosts: () => number;
  logInfo: (message: string) => void;
  logError: (message: string, error: unknown) => void;
};

export type GameStatePersistenceRuntime = PersistentStateRuntime<WorldDelta>;

export function createGameStatePersistenceRuntime(
  params: GameStatePersistenceRuntimeParams,
): GameStatePersistenceRuntime {
  const persistedStatePath = resolve(params.dataRoot, "game-state.json");

  async function persistStateToDb(): Promise<void> {
    const payload = buildGameStatePayload({
      turnId: params.getTurnId(),
      activeScenarioId: params.getActiveScenarioId(),
      activeScenarioName: params.getActiveScenarioName(),
      gameSettings: params.getGameSettings(),
      worldBase: params.getWorldBase(),
      latestMarketOverview: params.getLatestMarketOverview(),
      ordersByTurn: serializeOrdersByTurnState(params.getOrdersByTurn()),
      resolveReadyByTurn: serializeResolveReadyByTurnState(params.getResolveReadyByTurn()),
      adminAuditLog: params.getAdminAuditSnapshot(),
    });

    await saveGameStatePayload(params.prisma, GAME_STATE_ROW_ID, payload);
  }

  return createPersistentStateRuntime<WorldDelta>({
    debounceMs: params.debounceMs,
    persistStateToDb,
    persistWorldDeltaToDb: (delta) => persistWorldDeltaToDb(params.prisma, delta),
    pruneWorldDeltaLog: () => prunePersistedWorldDeltaLog(params.prisma, params.maxPersistedWorldDeltaLog),
    syncWorldDeltaLogWithCurrentState: () =>
      syncPersistedWorldDeltaLogWithCurrentStateInDb(params.prisma, params.getWorldStateVersion()),
    loadWorldDeltaHistory: async () => {
      const parsed = await loadPersistedWorldDeltaHistoryFromDb(params.prisma, {
        currentWorldStateVersion: params.getWorldStateVersion(),
        limit: params.maxWorldDeltaHistory,
      });
      params.replaceWorldDeltaHistory(parsed);
    },
    readPersistedStateFile: () => readPersistedStateFile(persistedStatePath),
    loadGameStatePayload: () => loadGameStatePayload(params.prisma, GAME_STATE_ROW_ID),
    parseAndApplyPersistentState: params.parseAndApplyPersistentState,
    normalizeRegionManualCostFlags: params.normalizeRegionManualCostFlags,
    normalizeRegionColonizationCosts: params.normalizeRegionColonizationCosts,
    logInfo: params.logInfo,
    logError: params.logError,
  });
}
