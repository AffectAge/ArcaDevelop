import type { WorldBase } from "@arcanorum/shared";
import type { AdminAuditLogEntry } from "../security/adminAuditLog";
import type { SerializedOrdersByTurn, SerializedResolveReadyByTurn } from "./turnStatePersistence";

export type GameStatePayloadParams<TGameSettings, TMarketOverview> = {
  turnId: number;
  activeScenarioId: string;
  activeScenarioName: string;
  gameSettings: TGameSettings;
  worldBase: WorldBase;
  latestMarketOverview: TMarketOverview;
  ordersByTurn: SerializedOrdersByTurn;
  resolveReadyByTurn: SerializedResolveReadyByTurn;
  adminAuditLog: AdminAuditLogEntry[];
};

export type GameStatePayload<TGameSettings, TMarketOverview> = {
  turnId: number;
  activeScenarioId: string;
  activeScenarioName: string;
  gameSettings: TGameSettings;
  worldBase: WorldBase & {
    turnId: number;
    activeScenarioId: string;
    activeScenarioName: string;
    latestMarketOverview: TMarketOverview;
  };
  ordersByTurn: SerializedOrdersByTurn;
  resolveReadyByTurn: SerializedResolveReadyByTurn;
  adminAuditLog: AdminAuditLogEntry[];
};

export function buildGameStatePayload<TGameSettings, TMarketOverview>(
  params: GameStatePayloadParams<TGameSettings, TMarketOverview>,
): GameStatePayload<TGameSettings, TMarketOverview> {
  return {
    turnId: params.turnId,
    activeScenarioId: params.activeScenarioId,
    activeScenarioName: params.activeScenarioName,
    gameSettings: params.gameSettings,
    worldBase: {
      ...params.worldBase,
      turnId: params.turnId,
      activeScenarioId: params.activeScenarioId,
      activeScenarioName: params.activeScenarioName,
      latestMarketOverview: params.latestMarketOverview,
    },
    ordersByTurn: params.ordersByTurn,
    resolveReadyByTurn: params.resolveReadyByTurn,
    adminAuditLog: params.adminAuditLog,
  };
}
