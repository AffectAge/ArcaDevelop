import type { Express } from "express";
import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import type { RouteAuth } from "../security/routeAuth";
import {
  registerAdminDiagnosticsRoutes,
  type WorldDeltaLogDbStatus,
  type WorldDeltaMemoryStatus,
  type WsDeltaSizeMetricsSnapshot,
} from "../routes/adminDiagnosticsRoutes";
import { registerSettingsGuideRoutes } from "../routes/settingsGuideRoutes";
import { registerSystemRoutes } from "../routes/systemRoutes";
import {
  registerTurnNotificationRoutes,
  type TurnStatusCountryRecord,
} from "../routes/turnNotificationRoutes";
import { registerContentRouteRuntime } from "./contentRouteRuntime";
import type { createWorldDeltaBroadcastRuntime } from "./worldDeltaBroadcastRuntime";
import type { createCountryRuntimeHelpers } from "./countryRuntimeHelpers";
import type { createUiNotificationQueue } from "./uiNotificationQueue";
import type { createUiNotificationRuntime } from "./uiNotificationRuntime";
import type { createMilitaryRuntimeFacade } from "./militaryRuntimeFacade";
import type { GameSettings } from "./gameSettingsTypes";
import type { ContentEntryKind } from "../content/contentEntryPayload";
import type { ContentEntryPayload, ContentEntryRouteItem } from "../routes/contentEntryRoutes";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";
import type { EventLogEntry, ResourceTotals, ServerStatus, WORLD_DELTA_MASK, WsOutMessage } from "@arcanorum/shared";

type CoreRouteCompositionParams = {
  app: Express;
  routeAuth: RouteAuth;
  isAdminCountry: (countryId: string) => Promise<boolean>;
  upload: {
    single: (fieldName: string) => RequestHandler;
    fields: (fields: Array<{ name: string; maxCount?: number }>) => RequestHandler;
  };
  worldDeltaMask: typeof WORLD_DELTA_MASK;
  worldDeltaBroadcastRuntime: ReturnType<typeof createWorldDeltaBroadcastRuntime>;
  countryRuntimeHelpers: ReturnType<typeof createCountryRuntimeHelpers>;
  uiNotificationQueue: ReturnType<typeof createUiNotificationQueue>;
  uiNotificationRuntime: ReturnType<typeof createUiNotificationRuntime>;
  militaryRuntimeFacade: ReturnType<typeof createMilitaryRuntimeFacade>;
  contentEntryKindSchema: { safeParse: (input: unknown) => { success: true; data: unknown } | { success: false } };
  culturePayloadSchema: ZodTypeAny;
  getServerStatus: () => ServerStatus;
  getTurnId: () => number;
  getAdm1TileRoot: () => string;
  getRasterTileRoot: () => string;
  getWsDeltaSizeMetrics: () => WsDeltaSizeMetricsSnapshot;
  getWorldDeltaLogDbStatus: () => Promise<WorldDeltaLogDbStatus>;
  getWorldDeltaMemoryStatus: () => WorldDeltaMemoryStatus;
  getWorldStateVersion: () => number;
  maxPersistedWorldDeltaLog: number;
  maxReplayInMemory: number;
  getTurnStatusCountries: () => Promise<TurnStatusCountryRecord[]>;
  getReadySetForTurn: (turn: number) => Set<string>;
  getOnlineCountryIds: () => Set<string>;
  getAiControlledCountryIds: () => Set<string>;
  getCountryResources: (countryId: string) => ResourceTotals | null;
  getLastLoginAt: (countryId: string) => string | null;
  getCurrentTurnStartedAtMs: () => number;
  getGameSettings: () => GameSettings;
  normalizeCivilopediaEntries: (input: unknown) => GameSettings["civilopedia"]["entries"];
  normalizeCivilopediaCategories: (
    input: unknown,
    entries: GameSettings["civilopedia"]["entries"],
  ) => GameSettings["civilopedia"]["categories"];
  getEntriesByKind: (kind: string) => ContentEntryRouteItem[];
  contentNameExists: (kind: string, name: string, excludeId?: string) => boolean;
  sanitizeContentEntryByKind: (kind: string, payload: ContentEntryPayload) => Record<string, unknown>;
  isMilitaryContentKind: (kind: string) => boolean;
  savePersistentState: () => void;
  validateImageDimensions: (...args: Parameters<typeof import("../uploads/uploadValidation").validateImageDimensions>) => ReturnType<typeof import("../uploads/uploadValidation").validateImageDimensions>;
  removeUploadedFile: (...args: Parameters<typeof import("../uploads/uploadValidation").removeUploadedFile>) => ReturnType<typeof import("../uploads/uploadValidation").removeUploadedFile>;
  removeUploadedFiles: (...args: Parameters<typeof import("../uploads/uploadValidation").removeUploadedFiles>) => ReturnType<typeof import("../uploads/uploadValidation").removeUploadedFiles>;
  removeUploadedByUrl: (...args: Parameters<typeof import("../uploads/uploadValidation").removeUploadedByUrl>) => ReturnType<typeof import("../uploads/uploadValidation").removeUploadedByUrl>;
  makeVersionedUploadUrl: (...args: Parameters<typeof import("../uploads/uploadValidation").makeVersionedUploadUrl>) => ReturnType<typeof import("../uploads/uploadValidation").makeVersionedUploadUrl>;
  resolveContentUploadUrlSegment: (...args: Parameters<typeof import("../uploads/uploadPaths").resolveContentUploadUrlSegment>) => ReturnType<typeof import("../uploads/uploadPaths").resolveContentUploadUrlSegment>;
  makeOfficialNews: (params: {
    turn: number;
    category: EventLogEntry["category"];
    title?: string;
    message: string;
    countryId?: string | null;
    priority?: EventLogEntry["priority"];
    visibility?: EventLogEntry["visibility"];
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export function registerCoreRouteComposition(params: CoreRouteCompositionParams): void {
  registerSystemRoutes(params.app, {
    getServerStatus: params.getServerStatus,
    getTurnId: params.getTurnId,
    getAdm1TileRoot: params.getAdm1TileRoot,
    getRasterTileRoot: params.getRasterTileRoot,
  });

  registerAdminDiagnosticsRoutes(params.app, {
    routeAuth: params.routeAuth,
    getWsDeltaSizeMetrics: params.getWsDeltaSizeMetrics,
    resetWsDeltaSizeMetrics: params.worldDeltaBroadcastRuntime.resetWsDeltaSizeMetrics,
    getWorldDeltaLogDbStatus: params.getWorldDeltaLogDbStatus,
    getWorldDeltaMemoryStatus: params.getWorldDeltaMemoryStatus,
    getWorldStateVersion: params.getWorldStateVersion,
    maxPersistedWorldDeltaLog: params.maxPersistedWorldDeltaLog,
    maxReplayInMemory: params.maxReplayInMemory,
  });

  registerTurnNotificationRoutes(params.app, {
    routeAuth: params.routeAuth,
    isAdminCountry: params.isAdminCountry,
    getTurnId: params.getTurnId,
    cleanupExpiredPunishments: params.countryRuntimeHelpers.cleanupExpiredPunishments,
    getTurnStatusCountries: params.getTurnStatusCountries,
    getReadySetForTurn: params.getReadySetForTurn,
    getOnlineCountryIds: params.getOnlineCountryIds,
    getAiControlledCountryIds: params.getAiControlledCountryIds,
    getCountryResources: params.getCountryResources,
    getCountryBlockInfo: params.countryRuntimeHelpers.getCountryBlockInfo,
    getCountrySkipInfo: params.countryRuntimeHelpers.getCountrySkipInfo,
    getLastLoginAt: params.getLastLoginAt,
    getPendingUiNotificationsForCountry: (visibilityParams) =>
      params.uiNotificationQueue.getPendingForCountry(
        visibilityParams,
        params.uiNotificationRuntime.isCountryEventNotificationStillPending,
      ),
    findQueuedUiNotification: (notificationId) => params.uiNotificationQueue.find(notificationId),
    isQueuedUiNotificationVisibleForCountry: (item, visibilityParams) =>
      params.uiNotificationRuntime.isQueuedUiNotificationVisibleForCountry(item, visibilityParams),
  });

  registerSettingsGuideRoutes(params.app, {
    routeAuth: params.routeAuth,
    getPublicGameSettings: () => {
      const gameSettings = params.getGameSettings();
      return {
        civilopedia: gameSettings.civilopedia,
        economy: gameSettings.economy,
        colonization: gameSettings.colonization,
        customization: gameSettings.customization,
        registration: gameSettings.registration,
        eventLog: gameSettings.eventLog,
        turnTimer: {
          ...gameSettings.turnTimer,
          currentTurnStartedAtMs: params.getCurrentTurnStartedAtMs(),
        },
        map: gameSettings.map,
        resourceIcons: gameSettings.resourceIcons,
      };
    },
    getCivilopedia: () => params.getGameSettings().civilopedia,
    updateCivilopedia: (input, actorCountryId) => {
      const gameSettings = params.getGameSettings();
      gameSettings.civilopedia.entries = params.normalizeCivilopediaEntries(input.entries);
      gameSettings.civilopedia.categories = params.normalizeCivilopediaCategories(
        input.categories,
        gameSettings.civilopedia.entries,
      );
      params.savePersistentState();
      params.broadcast({
        type: "NEWS_EVENT",
        event: params.makeOfficialNews({
          turn: params.getTurnId(),
          category: "system",
          title: "Цивилопедия обновлена",
          message: "Администратор обновил статьи Цивилопедии",
          countryId: actorCountryId,
          priority: "low",
          visibility: "public",
        }),
      });
    },
  });

  registerContentRouteRuntime({
    app: params.app,
    routeAuth: params.routeAuth,
    upload: params.upload,
    getTurnId: params.getTurnId,
    getGameSettings: params.getGameSettings,
    parseContentKind: (raw) => {
      const parsed = params.contentEntryKindSchema.safeParse(raw);
      return parsed.success ? { success: true, data: parsed.data as ContentEntryKind } : { success: false };
    },
    parseContentPayload: (body) => {
      const parsed = params.culturePayloadSchema.safeParse(body);
      return parsed.success ? { success: true, data: parsed.data } : { success: false, issues: parsed.error.issues };
    },
    getEntriesByKind: params.getEntriesByKind,
    contentNameExists: params.contentNameExists,
    sanitizeContentEntryByKind: params.sanitizeContentEntryByKind,
    isMilitaryContentKind: params.isMilitaryContentKind,
    cloneMilitaryContentSnapshot: () =>
      params.worldDeltaBroadcastRuntime.cloneWorldBaseSectionSnapshot(
        params.worldDeltaMask.divisionTemplatesByCountry | params.worldDeltaMask.divisionsById,
      ),
    refreshDivisionStatsFromTemplates: () => params.militaryRuntimeFacade.refreshDivisionStatsFromTemplates(),
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.worldDeltaBroadcastRuntime.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    savePersistentState: params.savePersistentState,
    validateImageDimensions: params.validateImageDimensions,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedFiles: params.removeUploadedFiles,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    resolveContentUploadUrlSegment: params.resolveContentUploadUrlSegment,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });
}
