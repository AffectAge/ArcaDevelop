import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import type { ResourceId, ServerStatus, WsOutMessage } from "@arcanorum/shared";
import { WORLD_DELTA_MASK } from "@arcanorum/shared";
import type { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";
import {
  normalizeCivilopediaCategories,
  normalizeCivilopediaEntries,
} from "../content/civilopediaNormalizers";
import {
  contentEntryKindSchema,
  culturePayloadSchema,
  isMilitaryContentKind,
  sanitizeContentEntryByKind,
  type ContentEntryKind,
} from "../content/contentEntryPayload";
import { getWorldDeltaLogStatus } from "../persistence/worldDeltaLogPersistence";
import { resolveContentUploadUrlSegment } from "../uploads/uploadPaths";
import type { upload } from "../uploads/uploadMiddleware";
import type {
  makeVersionedUploadUrl,
  removeUploadedByUrl,
  removeUploadedFile,
  removeUploadedFiles,
  validateImageDimensions,
} from "../uploads/uploadValidation";
import type { createContentCatalogRuntime } from "./contentCatalogRuntime";
import type { createCountryRuntimeHelpers } from "./countryRuntimeHelpers";
import type { createMapRuntimeState } from "./mapRuntimeState";
import type { createMilitaryRuntimeFacade } from "./militaryRuntimeFacade";
import type { makeOfficialNews } from "./officialNewsRuntime";
import type { createServerSessionStateRuntime } from "./serverSessionStateRuntime";
import type { createTurnSessionRuntime } from "./turnSessionRuntime";
import type { createUiNotificationRuntime } from "./uiNotificationRuntime";
import type { createWorldDeltaBroadcastRuntime } from "./worldDeltaBroadcastRuntime";
import { getOnlineCountryIdsFromSockets } from "./websocketBroadcastRuntime";
import { registerCoreRouteComposition } from "./coreRouteComposition";
import { getWorldDeltaMemoryStatus, type WsDeltaSizeMetrics } from "./worldDeltaRuntime";
import {
  MAX_PERSISTED_WORLD_DELTA_LOG,
  MAX_WORLD_DELTA_HISTORY,
} from "./serverRuntimeConfig";
import type { WebSocketServer } from "ws";
import type { GameSettings } from "./gameSettingsTypes";
import type { ResourceTotals } from "@arcanorum/shared";

type ServerCoreRouteRegistrationRuntimeParams = {
  app: Express;
  wsServerProvider: () => WebSocketServer;
  prisma: PrismaClient;
  routeAuth: RouteAuth;
  isAdminCountry: (countryId: string) => Promise<boolean>;
  upload: typeof upload;
  mapRuntime: ReturnType<typeof createMapRuntimeState>;
  worldDeltaBroadcastRuntime: ReturnType<typeof createWorldDeltaBroadcastRuntime>;
  countryRuntimeHelpers: ReturnType<typeof createCountryRuntimeHelpers>;
  sessionStateRuntime: ReturnType<typeof createServerSessionStateRuntime>;
  uiNotificationRuntime: ReturnType<typeof createUiNotificationRuntime>;
  militaryRuntimeFacade: ReturnType<typeof createMilitaryRuntimeFacade>;
  turnSessionRuntime: ReturnType<typeof createTurnSessionRuntime>;
  contentCatalogRuntime: ReturnType<typeof createContentCatalogRuntime>;
  getServerStatus: () => ServerStatus;
  getTurnId: () => number;
  getWorldStateVersion: () => number;
  getWsDeltaSizeMetrics: () => WsDeltaSizeMetrics;
  getWorldDeltaHistory: () => Parameters<typeof getWorldDeltaMemoryStatus>[0];
  getGameSettings: () => GameSettings;
  getAiControlledCountryIds: () => Set<string>;
  getCountryResources: (countryId: string) => ResourceTotals | null;
  getCountryResourceNetByTurn: (countryId: string) => Partial<Record<ResourceId, number>>;
  savePersistentState: () => void;
  validateImageDimensions: typeof validateImageDimensions;
  removeUploadedFile: typeof removeUploadedFile;
  removeUploadedFiles: typeof removeUploadedFiles;
  removeUploadedByUrl: typeof removeUploadedByUrl;
  makeVersionedUploadUrl: typeof makeVersionedUploadUrl;
  makeOfficialNews: typeof makeOfficialNews;
  broadcast: (message: WsOutMessage) => void;
};

export function registerServerCoreRouteRuntime(params: ServerCoreRouteRegistrationRuntimeParams): void {
  registerCoreRouteComposition({
    app: params.app,
    routeAuth: params.routeAuth,
    isAdminCountry: params.isAdminCountry,
    upload: params.upload,
    worldDeltaMask: WORLD_DELTA_MASK,
    worldDeltaBroadcastRuntime: params.worldDeltaBroadcastRuntime,
    countryRuntimeHelpers: params.countryRuntimeHelpers,
    uiNotificationQueue: params.sessionStateRuntime.uiNotificationQueue,
    uiNotificationRuntime: params.uiNotificationRuntime,
    militaryRuntimeFacade: params.militaryRuntimeFacade,
    contentEntryKindSchema,
    culturePayloadSchema,
    getServerStatus: params.getServerStatus,
    getTurnId: params.getTurnId,
    getHexTileRoot: params.mapRuntime.getHexTileRoot,
    getRasterTileRoot: params.mapRuntime.getRasterTileRoot,
    getWsDeltaSizeMetrics: params.getWsDeltaSizeMetrics,
    getWorldDeltaLogDbStatus: () => getWorldDeltaLogStatus(params.prisma),
    getWorldDeltaMemoryStatus: () => getWorldDeltaMemoryStatus(params.getWorldDeltaHistory()),
    getWorldStateVersion: params.getWorldStateVersion,
    maxPersistedWorldDeltaLog: MAX_PERSISTED_WORLD_DELTA_LOG,
    maxReplayInMemory: MAX_WORLD_DELTA_HISTORY,
    getTurnStatusCountries: () =>
      params.countryRuntimeHelpers.getCachedCountryQuery({
        key: "country:turn-status",
        loader: () =>
          params.prisma.country.findMany({
            select: {
              id: true,
              name: true,
              color: true,
              flagUrl: true,
              isLocked: true,
              blockedUntilTurn: true,
              blockedUntilAt: true,
              ignoreUntilTurn: true,
            },
            orderBy: { createdAt: "asc" },
          }),
      }),
    getReadySetForTurn: params.turnSessionRuntime.getReadySetForTurn,
    getOnlineCountryIds: () => getOnlineCountryIdsFromSockets(params.wsServerProvider()),
    getAiControlledCountryIds: params.getAiControlledCountryIds,
    getCountryResources: params.getCountryResources,
    getCountryResourceNetByTurn: params.getCountryResourceNetByTurn,
    getLastLoginAt: (countryId) => params.sessionStateRuntime.lastLoginAtByCountryId.get(countryId) ?? null,
    getCurrentTurnStartedAtMs: params.turnSessionRuntime.getCurrentTurnStartedAtMs,
    getGameSettings: params.getGameSettings,
    normalizeCivilopediaEntries,
    normalizeCivilopediaCategories,
    getEntriesByKind: (kind) => params.contentCatalogRuntime.getContentEntriesByKind(kind as ContentEntryKind),
    contentNameExists: (kind, name, excludeId) =>
      params.contentCatalogRuntime.contentNameExists(kind as ContentEntryKind, name, excludeId),
    sanitizeContentEntryByKind: (kind, payload) =>
      sanitizeContentEntryByKind(kind as ContentEntryKind, payload as z.infer<typeof culturePayloadSchema>),
    isMilitaryContentKind: (kind) => isMilitaryContentKind(kind as ContentEntryKind),
    savePersistentState: params.savePersistentState,
    validateImageDimensions: params.validateImageDimensions,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedFiles: params.removeUploadedFiles,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    resolveContentUploadUrlSegment,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });
}
