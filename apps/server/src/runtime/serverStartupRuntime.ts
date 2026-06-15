import type { Server } from "node:http";
import type { PrismaClient } from "@prisma/client";
import type { WebSocketServer } from "ws";
import type { EventLogEntry, WsOutMessage } from "@arcanorum/shared";
import { ensureCorePrismaTables, ensureWorldDeltaLogTable } from "../persistence/dbBootstrap";
import type { GameSettings } from "./gameSettingsTypes";
import { startServerLoops } from "./serverLoopRuntime";

type ServerStartupRuntimeParams = {
  server: Server;
  wsServer: WebSocketServer;
  prisma: PrismaClient;
  worldDeltaLogPruneIntervalMs: number;
  getPort: () => number;
  getGameSettings: () => GameSettings;
  getOnlinePlayerCount: () => number;
  getCurrentTurnStartedAtMs: () => number;
  getTurnId: () => number;
  loadPersistentState: () => Promise<void>;
  persistContentLibraryFromSettings: () => void;
  cleanupOrphanUploadsOnServerStart: () => Promise<void>;
  migratePersistedMarketNamesToReadable: () => Promise<boolean>;
  savePersistentState: () => void;
  rebuildTurnOrderIndexes: () => void;
  rebuildActiveColonizationIndexFromWorldBase: () => void;
  rebuildEconomyTickCountryIndexFromWorldBase: () => void;
  syncPersistedWorldDeltaLogWithCurrentState: () => Promise<void>;
  schedulePersistedWorldDeltaLogPrune: () => void;
  loadPersistedWorldDeltaHistory: () => Promise<void>;
  resetTurnTimerAnchor: () => void;
  broadcastTurnResolveStarted: (wsServer: WebSocketServer, reason: "manual" | "admin" | "auto") => void;
  resolveAndBroadcastCurrentTurn: () => boolean;
  makeOfficialNews: (params: {
    turn: number;
    category: "system";
    title?: string;
    message: string;
    priority?: "low" | "medium" | "high";
    visibility?: "public";
  }) => EventLogEntry;
  broadcast: (wsServer: WebSocketServer, message: WsOutMessage) => void;
  logError: (message: string, error: unknown) => void;
  logInfo: (message: string) => void;
};

export async function startServerRuntime(params: ServerStartupRuntimeParams): Promise<void> {
  await ensureCorePrismaTables(params.prisma);
  await ensureWorldDeltaLogTable(params.prisma);
  await params.loadPersistentState();
  params.persistContentLibraryFromSettings();
  await params.cleanupOrphanUploadsOnServerStart();
  if (await params.migratePersistedMarketNamesToReadable()) {
    params.savePersistentState();
  }
  params.rebuildTurnOrderIndexes();
  params.rebuildActiveColonizationIndexFromWorldBase();
  params.rebuildEconomyTickCountryIndexFromWorldBase();
  await params.syncPersistedWorldDeltaLogWithCurrentState();
  params.schedulePersistedWorldDeltaLogPrune();
  await params.loadPersistedWorldDeltaHistory();
  startServerLoops({
    server: params.server,
    wsServer: params.wsServer,
    getPort: params.getPort,
    getGameSettings: params.getGameSettings,
    getOnlinePlayerCount: params.getOnlinePlayerCount,
    getCurrentTurnStartedAtMs: params.getCurrentTurnStartedAtMs,
    getTurnId: params.getTurnId,
    worldDeltaLogPruneIntervalMs: params.worldDeltaLogPruneIntervalMs,
    resetTurnTimerAnchor: params.resetTurnTimerAnchor,
    schedulePersistedWorldDeltaLogPrune: params.schedulePersistedWorldDeltaLogPrune,
    broadcastTurnResolveStarted: params.broadcastTurnResolveStarted,
    resolveAndBroadcastCurrentTurn: params.resolveAndBroadcastCurrentTurn,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
    logError: params.logError,
    logInfo: params.logInfo,
  });
}
