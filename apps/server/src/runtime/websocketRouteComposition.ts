import type { PrismaClient } from "@prisma/client";
import type { WebSocketServer } from "ws";
import type { Order, WsOutMessage } from "@arcanorum/shared";
import type { GameSettings } from "./gameSettingsTypes";
import { registerWebSocketRuntime } from "./websocketRuntime";

type WebSocketDeps = Parameters<typeof registerWebSocketRuntime>[0];

type WebSocketRouteCompositionParams = {
  wsServer: WebSocketServer;
  prisma: PrismaClient;
  onlinePlayers: WebSocketDeps["onlinePlayers"];
  getWorldBase: WebSocketDeps["getWorldBase"];
  getGameSettings: () => GameSettings;
  getAiControlledCountryIds: WebSocketDeps["getAiControlledCountryIds"];
  getTurnId: () => number;
  getWorldStateVersion: () => number;
  getOrdersByTurn: WebSocketDeps["getOrdersByTurn"];
  getQueuedColonizeRegionsByCountryByTurn: WebSocketDeps["getQueuedColonizeRegionsByCountryByTurn"];
  getActiveColonizeRegionsByCountry: WebSocketDeps["getActiveColonizeRegionsByCountry"];
  parseAuthToken: WebSocketDeps["parseAuthToken"];
  countryRuntimeHelpers: Pick<
    WebSocketDeps,
    | "ensureCountryInWorldBase"
    | "sendPendingRegistrationNotificationsToAdminSocket"
    | "cleanupExpiredPunishments"
    | "getCountryBlockInfo"
    | "getCountrySkipInfo"
  > & {
    getCachedCountryQuery: <T>(params: { key: string; loader: () => Promise<T> }) => Promise<T>;
  };
  lastLoginAtByCountryId: Map<string, string>;
  worldDeltaBroadcastRuntime: {
    getReplayDeltasFromVersion: WebSocketDeps["getReplayDeltasFromVersion"];
  };
  turnOrderRuntime: {
    addOrderToTurnIndexes: (order: Order) => void;
  };
  colonizationRuntime: {
    getRegionColonizationConfig: WebSocketDeps["getRegionColonizationConfig"];
  };
  buildingRuntime: Pick<
    WebSocketDeps,
    | "parseRequestedBuildingIdFromPayload"
    | "resolveBuildingOwnerFromPayload"
    | "isCountryAllowedForBuildingWithEngine"
    | "getProvinceBuildRestriction"
    | "countBuildingOccurrences"
    | "getCountryBuildLimit"
  >;
  progressionRuntime: {
    isBuildingUnlockedForCountry: WebSocketDeps["isBuildingUnlockedForCountry"];
  };
  getGlobalBuildLimit: WebSocketDeps["getGlobalBuildLimit"];
  normalizeArmyMoveRoute: WebSocketDeps["normalizeArmyMoveRoute"];
  isContiguousArmyRoute: WebSocketDeps["isContiguousArmyRoute"];
  broadcast: (message: WsOutMessage) => void;
  broadcastTurnResolveStarted: WebSocketDeps["broadcastTurnResolveStarted"];
  resolveAndBroadcastCurrentTurn: WebSocketDeps["resolveAndBroadcastCurrentTurn"];
  getReadySetForTurn: WebSocketDeps["getReadySetForTurn"];
  savePersistentState: () => void;
};

export function registerWebSocketRouteComposition(params: WebSocketRouteCompositionParams): void {
  registerWebSocketRuntime({
    wsServer: params.wsServer,
    onlinePlayers: params.onlinePlayers,
    getWorldBase: params.getWorldBase,
    getGameSettings: params.getGameSettings,
    getTurnId: params.getTurnId,
    getWorldStateVersion: params.getWorldStateVersion,
    getOrdersByTurn: params.getOrdersByTurn,
    getQueuedColonizeRegionsByCountryByTurn: params.getQueuedColonizeRegionsByCountryByTurn,
    getActiveColonizeRegionsByCountry: params.getActiveColonizeRegionsByCountry,
    parseAuthToken: params.parseAuthToken,
    findCountryForAuth: (countryId) =>
      params.prisma.country.findUnique({
        where: { id: countryId },
        select: { id: true, isAdmin: true, eventLogRetentionTurns: true },
      }),
    listResolveStatusCountries: () =>
      params.countryRuntimeHelpers.getCachedCountryQuery({
        key: "country:resolve-status",
        loader: () =>
          params.prisma.country.findMany({
            select: {
              id: true,
              isLocked: true,
              blockedUntilTurn: true,
              blockedUntilAt: true,
              ignoreUntilTurn: true,
            },
          }),
      }),
    getAiControlledCountryIds: params.getAiControlledCountryIds,
    ensureCountryInWorldBase: params.countryRuntimeHelpers.ensureCountryInWorldBase,
    getLastLoginAt: (countryId) => params.lastLoginAtByCountryId.get(countryId) ?? null,
    setLastLoginAt: (countryId, timestamp) => params.lastLoginAtByCountryId.set(countryId, timestamp),
    getReplayDeltasFromVersion: params.worldDeltaBroadcastRuntime.getReplayDeltasFromVersion,
    sendPendingRegistrationNotificationsToAdminSocket:
      params.countryRuntimeHelpers.sendPendingRegistrationNotificationsToAdminSocket,
    broadcast: params.broadcast,
    broadcastTurnResolveStarted: params.broadcastTurnResolveStarted,
    resolveAndBroadcastCurrentTurn: params.resolveAndBroadcastCurrentTurn,
    cleanupExpiredPunishments: params.countryRuntimeHelpers.cleanupExpiredPunishments,
    getCountryBlockInfo: params.countryRuntimeHelpers.getCountryBlockInfo,
    getCountrySkipInfo: params.countryRuntimeHelpers.getCountrySkipInfo,
    getReadySetForTurn: params.getReadySetForTurn,
    savePersistentState: params.savePersistentState,
    addOrderToTurnIndexes: params.turnOrderRuntime.addOrderToTurnIndexes,
    getRegionColonizationConfig: params.colonizationRuntime.getRegionColonizationConfig,
    parseRequestedBuildingIdFromPayload: params.buildingRuntime.parseRequestedBuildingIdFromPayload,
    resolveBuildingOwnerFromPayload: params.buildingRuntime.resolveBuildingOwnerFromPayload,
    isCountryAllowedForBuildingWithEngine: params.buildingRuntime.isCountryAllowedForBuildingWithEngine,
    getProvinceBuildRestriction: params.buildingRuntime.getProvinceBuildRestriction,
    isBuildingUnlockedForCountry: params.progressionRuntime.isBuildingUnlockedForCountry,
    countBuildingOccurrences: params.buildingRuntime.countBuildingOccurrences,
    getCountryBuildLimit: params.buildingRuntime.getCountryBuildLimit,
    getGlobalBuildLimit: params.getGlobalBuildLimit,
    normalizeArmyMoveRoute: params.normalizeArmyMoveRoute,
    isContiguousArmyRoute: params.isContiguousArmyRoute,
  });
}
