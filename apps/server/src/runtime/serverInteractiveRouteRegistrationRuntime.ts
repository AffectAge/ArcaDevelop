import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import type { WebSocketServer } from "ws";
import type { WsOutMessage, WorldBase } from "@arcanorum/shared";
import { WORLD_DELTA_MASK } from "@arcanorum/shared";
import type { RouteAuth } from "../security/routeAuth";
import type { upload } from "../uploads/uploadMiddleware";
import { CREST_IMAGE_RULE, FLAG_IMAGE_RULE } from "../uploads/uploadPaths";
import type { createBuildingSystemsRuntime } from "./buildingSystemsRuntime";
import type { createColonizationRuntimeFacade } from "./colonizationRuntimeFacade";
import type { createCountryRuntimeHelpers } from "./countryRuntimeHelpers";
import type { createCountrySystemsRuntime } from "./countrySystemsRuntime";
import type { createCountryWorldRuntime } from "./countryWorldRuntime";
import type { createMarketRuntimeFacade } from "./marketRuntimeFacade";
import type { createTurnMechanicsAdapterRuntime } from "./turnMechanicsAdapterRuntime";
import type { createTurnOrderRuntimeFacade } from "./turnOrderRuntimeFacade";
import type { createTurnSessionRuntime } from "./turnSessionRuntime";
import type { createUiNotificationRuntime } from "./uiNotificationRuntime";
import type { createWorldDeltaBroadcastRuntime } from "./worldDeltaBroadcastRuntime";
import type { GameSettings } from "./gameSettingsTypes";
import type { createServerTurnStateRuntime } from "./serverTurnStateRuntime";
import { getGlobalBuildLimit } from "../mechanics/buildingMechanics";
import { registerAccountControlRouteComposition } from "./accountControlRouteComposition";
import { registerWebSocketRouteComposition } from "./websocketRouteComposition";

type UiNotificationRuntime = ReturnType<typeof createUiNotificationRuntime>;

type ServerInteractiveRouteRegistrationRuntimeParams = {
  app: Express;
  wsServer: WebSocketServer;
  prisma: PrismaClient;
  routeAuth: RouteAuth;
  upload: typeof upload;
  jwtSecret: string;
  sessionStateRuntime: {
    onlinePlayers: Set<string>;
    lastLoginAtByCountryId: Map<string, string>;
  };
  turnStateRuntime: ReturnType<typeof createServerTurnStateRuntime>;
  countryRuntimeHelpers: ReturnType<typeof createCountryRuntimeHelpers>;
  countryWorldRuntime: ReturnType<typeof createCountryWorldRuntime>;
  progressionRuntime: ReturnType<typeof createCountrySystemsRuntime>["progressionRuntime"];
  marketRuntimeFacade: ReturnType<typeof createMarketRuntimeFacade>;
  colonizationRuntime: ReturnType<typeof createColonizationRuntimeFacade>;
  buildingRuntime: ReturnType<typeof createBuildingSystemsRuntime>["buildingRuntime"];
  turnOrderRuntime: ReturnType<typeof createTurnOrderRuntimeFacade>;
  turnMechanicsAdapterRuntime: ReturnType<typeof createTurnMechanicsAdapterRuntime>;
  turnSessionRuntime: ReturnType<typeof createTurnSessionRuntime>;
  uiNotificationRuntime: UiNotificationRuntime;
  worldDeltaBroadcastRuntime: ReturnType<typeof createWorldDeltaBroadcastRuntime>;
  parseAuthToken: Parameters<typeof registerWebSocketRouteComposition>[0]["parseAuthToken"];
  getTurnId: () => number;
  getWorldStateVersion: () => number;
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  pushAdminAuditLog: Parameters<typeof registerAccountControlRouteComposition>[0]["pushAdminAuditLog"];
  validateImageRule: Parameters<typeof registerAccountControlRouteComposition>[0]["validateImageRule"];
  removeUploadedFile: Parameters<typeof registerAccountControlRouteComposition>[0]["removeUploadedFile"];
  removeUploadedFiles: Parameters<typeof registerAccountControlRouteComposition>[0]["removeUploadedFiles"];
  removeUploadedByUrl: Parameters<typeof registerAccountControlRouteComposition>[0]["removeUploadedByUrl"];
  makeVersionedUploadUrl: Parameters<typeof registerAccountControlRouteComposition>[0]["makeVersionedUploadUrl"];
  makeOfficialNews: Parameters<typeof registerAccountControlRouteComposition>[0]["makeOfficialNews"];
  broadcast: (message: WsOutMessage) => void;
  broadcastTurnResolveStarted: (reason: "manual" | "admin" | "auto") => void;
  resolveAndBroadcastCurrentTurn: Parameters<
    typeof registerWebSocketRouteComposition
  >[0]["resolveAndBroadcastCurrentTurn"];
  savePersistentState: () => void;
};

export function registerServerInteractiveRouteRuntime(params: ServerInteractiveRouteRegistrationRuntimeParams): void {
  registerAccountControlRouteComposition({
    app: params.app,
    routeAuth: params.routeAuth,
    upload: params.upload,
    prisma: params.prisma,
    jwtSecret: params.jwtSecret,
    flagImageRule: FLAG_IMAGE_RULE,
    crestImageRule: CREST_IMAGE_RULE,
    masks: {
      resourcesByCountry: WORLD_DELTA_MASK.resourcesByCountry,
      provinceOwner: WORLD_DELTA_MASK.provinceOwner,
      colonyProgressByRegion: WORLD_DELTA_MASK.colonyProgressByRegion,
      regionConstructionQueueByRegion: WORLD_DELTA_MASK.regionConstructionQueueByRegion,
      parliamentByCountry: WORLD_DELTA_MASK.parliamentByCountry,
      technologyByCountry: WORLD_DELTA_MASK.technologyByCountry,
      countryDecisionsByCountryId: WORLD_DELTA_MASK.countryDecisionsByCountryId,
      countryEventsByCountryId: WORLD_DELTA_MASK.countryEventsByCountryId,
      divisionTemplatesByCountry: WORLD_DELTA_MASK.divisionTemplatesByCountry,
      divisionsById: WORLD_DELTA_MASK.divisionsById,
      militaryFormationQueueByCountry: WORLD_DELTA_MASK.militaryFormationQueueByCountry,
      diplomacyProposals: WORLD_DELTA_MASK.diplomacyProposals,
    },
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getOrdersByTurn: () => params.turnStateRuntime.ordersByTurn,
    getResolveReadyByTurn: () => params.turnStateRuntime.resolveReadyByTurn,
    getCustomizationSettings: () => params.getGameSettings().customization,
    getRegistrationRequiresAdminApproval: () => params.getGameSettings().registration.requireAdminApproval,
    getInitialColonizationPoints: () => params.getGameSettings().colonization.pointsPerTurn,
    getInitialConstructionPoints: () => params.getGameSettings().economy.baseConstructionPerTurn,
    getClientEventLogRetentionTurns: () => params.getGameSettings().eventLog.retentionTurns,
    countryRuntimeHelpers: params.countryRuntimeHelpers,
    marketRuntimeFacade: params.marketRuntimeFacade,
    colonizationRuntime: params.colonizationRuntime,
    countryWorldRuntime: params.countryWorldRuntime,
    turnOrderRuntime: params.turnOrderRuntime,
    uiNotificationRuntime: {
      sendUiNotificationToAdmins: (notification) =>
        params.uiNotificationRuntime.sendUiNotificationToAdmins(params.wsServer, notification),
      removeQueuedUiNotification: params.uiNotificationRuntime.removeQueuedUiNotification,
      broadcastUiNotification: (notification) =>
        params.uiNotificationRuntime.broadcastUiNotification(params.wsServer, notification),
    },
    worldDeltaBroadcastRuntime: params.worldDeltaBroadcastRuntime,
    validateImageRule: params.validateImageRule,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedFiles: params.removeUploadedFiles,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    pushAdminAuditLog: params.pushAdminAuditLog,
    setLastLoginAt: (countryId, timestamp) => params.sessionStateRuntime.lastLoginAtByCountryId.set(countryId, timestamp),
    savePersistentState: params.savePersistentState,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });

  registerWebSocketRouteComposition({
    wsServer: params.wsServer,
    prisma: params.prisma,
    onlinePlayers: params.sessionStateRuntime.onlinePlayers,
    getWorldBase: params.getWorldBase,
    getGameSettings: params.getGameSettings,
    getTurnId: params.getTurnId,
    getWorldStateVersion: params.getWorldStateVersion,
    getOrdersByTurn: () => params.turnStateRuntime.ordersByTurn,
    getQueuedColonizeRegionsByCountryByTurn: () => params.turnStateRuntime.queuedColonizeRegionsByCountryByTurn,
    getActiveColonizeRegionsByCountry: () => params.turnStateRuntime.activeColonizeRegionsByCountry,
    parseAuthToken: params.parseAuthToken,
    countryRuntimeHelpers: {
      ...params.countryRuntimeHelpers,
      ensureCountryInWorldBase: params.countryWorldRuntime.ensureCountryInWorldBase,
    },
    lastLoginAtByCountryId: params.sessionStateRuntime.lastLoginAtByCountryId,
    worldDeltaBroadcastRuntime: params.worldDeltaBroadcastRuntime,
    turnOrderRuntime: params.turnOrderRuntime,
    colonizationRuntime: params.colonizationRuntime,
    buildingRuntime: params.buildingRuntime,
    progressionRuntime: params.progressionRuntime,
    getGlobalBuildLimit,
    normalizeArmyMoveRoute: params.turnMechanicsAdapterRuntime.normalizeArmyMoveRoute,
    isContiguousArmyRoute: params.turnMechanicsAdapterRuntime.isContiguousArmyRoute,
    broadcast: params.broadcast,
    broadcastTurnResolveStarted: params.broadcastTurnResolveStarted,
    resolveAndBroadcastCurrentTurn: params.resolveAndBroadcastCurrentTurn,
    getReadySetForTurn: params.turnSessionRuntime.getReadySetForTurn,
    savePersistentState: params.savePersistentState,
  });
}
