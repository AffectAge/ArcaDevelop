import type { Server } from "node:http";
import type { WebSocketServer } from "ws";
import type { WsOutMessage } from "@arcanorum/shared";
import type { GameSettings } from "./gameSettingsTypes";

type ServerLoopRuntimeParams = {
  server: Server;
  wsServer: WebSocketServer;
  getPort: () => number;
  getGameSettings: () => GameSettings;
  getOnlinePlayerCount: () => number;
  getCurrentTurnStartedAtMs: () => number;
  getTurnId: () => number;
  worldDeltaLogPruneIntervalMs: number;
  resetTurnTimerAnchor: () => void;
  schedulePersistedWorldDeltaLogPrune: () => void;
  broadcastTurnResolveStarted: (wsServer: WebSocketServer, reason: "manual" | "admin" | "auto") => void;
  resolveAndBroadcastCurrentTurn: () => Promise<boolean>;
  makeOfficialNews: (params: {
    turn: number;
    category: "system";
    title?: string;
    message: string;
    priority?: "low" | "medium" | "high";
    visibility?: "public";
  }) => Extract<WsOutMessage, { type: "NEWS_EVENT" }>["event"];
  broadcast: (wsServer: WebSocketServer, message: WsOutMessage) => void;
  logError: (message: string, error: unknown) => void;
  logInfo: (message: string) => void;
};

export function startServerLoops(params: ServerLoopRuntimeParams): void {
  params.resetTurnTimerAnchor();
  setInterval(() => {
    void (async () => {
    try {
      const gameSettings = params.getGameSettings();
      if (!gameSettings.turnTimer.enabled) return;
      if (gameSettings.turnTimer.pauseWhenNoPlayersOnline && params.getOnlinePlayerCount() === 0) {
        params.resetTurnTimerAnchor();
        return;
      }
      const seconds = Math.max(10, Math.floor(gameSettings.turnTimer.secondsPerTurn || 0));
      if (seconds <= 0) return;
      const elapsedMs = Date.now() - params.getCurrentTurnStartedAtMs();
      if (elapsedMs < seconds * 1000) return;
      params.broadcastTurnResolveStarted(params.wsServer, "auto");
      const resolved = await params.resolveAndBroadcastCurrentTurn();
      if (resolved) {
        params.broadcast(params.wsServer, {
          type: "NEWS_EVENT",
          event: params.makeOfficialNews({
            turn: params.getTurnId(),
            category: "system",
            title: "Авто-переход хода",
            message: `Ход автоматически завершён по таймеру (${seconds} сек.)`,
            priority: "medium",
            visibility: "public",
          }),
        });
      }
    } catch (error) {
      params.logError("[turn-timer] Auto resolve failed:", error);
    }
    })();
  }, 1000);

  setInterval(() => {
    params.schedulePersistedWorldDeltaLogPrune();
  }, params.worldDeltaLogPruneIntervalMs);

  params.server.listen(params.getPort(), () => {
    params.logInfo(`Arcanorum server running on http://localhost:${params.getPort()}`);
  });
}
