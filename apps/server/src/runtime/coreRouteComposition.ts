import type { Express } from "express";
import type { RequestHandler } from "express";
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
import type { createWorldDeltaBroadcastRuntime } from "./worldDeltaBroadcastRuntime";
import type { createCountryRuntimeHelpers } from "./countryRuntimeHelpers";
import type { createUiNotificationQueue } from "./uiNotificationQueue";
import type { createUiNotificationRuntime } from "./uiNotificationRuntime";
import type { GameSettings } from "./gameSettingsTypes";
import type { ContentEntryKind } from "../content/contentEntryPayload";
import type { ContentEntryRouteItem } from "../routes/contentReadRoutes";
import { registerContentReadRoutes } from "../routes/contentReadRoutes";
import type { EventLogEntry, Order, ResourceId, ResourceTotals, ServerStatus, WORLD_DELTA_MASK, WorldBase, WsOutMessage } from "@arcanorum/shared";

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
  contentEntryKindSchema: { safeParse: (input: unknown) => { success: true; data: unknown } | { success: false } };
  getServerStatus: () => ServerStatus;
  getTurnId: () => number;
  getWorldBase: () => WorldBase;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getHexTileRoot: () => string;
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
  getCountryResourceNetByTurn: (countryId: string) => Partial<Record<ResourceId, number>>;
  getLastLoginAt: (countryId: string) => string | null;
  getCurrentTurnStartedAtMs: () => number;
  getActiveScenarioId: () => string;
  getGameSettings: () => GameSettings;
  normalizeCivilopediaEntries: (input: unknown) => GameSettings["civilopedia"]["entries"];
  normalizeCivilopediaCategories: (
    input: unknown,
    entries: GameSettings["civilopedia"]["entries"],
  ) => GameSettings["civilopedia"]["categories"];
  getEntriesByKind: (kind: string) => ContentEntryRouteItem[];
  savePersistentState: () => void;
  validateImageDimensions: (...args: Parameters<typeof import("../uploads/uploadValidation").validateImageDimensions>) => ReturnType<typeof import("../uploads/uploadValidation").validateImageDimensions>;
  removeUploadedFile: (...args: Parameters<typeof import("../uploads/uploadValidation").removeUploadedFile>) => ReturnType<typeof import("../uploads/uploadValidation").removeUploadedFile>;
  removeUploadedFiles: (...args: Parameters<typeof import("../uploads/uploadValidation").removeUploadedFiles>) => ReturnType<typeof import("../uploads/uploadValidation").removeUploadedFiles>;
  removeUploadedByUrl: (...args: Parameters<typeof import("../uploads/uploadValidation").removeUploadedByUrl>) => ReturnType<typeof import("../uploads/uploadValidation").removeUploadedByUrl>;
  makeVersionedUploadUrl: (...args: Parameters<typeof import("../uploads/uploadValidation").makeVersionedUploadUrl>) => ReturnType<typeof import("../uploads/uploadValidation").makeVersionedUploadUrl>;
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
    getHexTileRoot: params.getHexTileRoot,
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
    getWorldBase: params.getWorldBase,
    getUnitTypes: () => params.getGameSettings().content.unitTypes,
    getOrdersByTurn: params.getOrdersByTurn,
    cleanupExpiredPunishments: params.countryRuntimeHelpers.cleanupExpiredPunishments,
    getTurnStatusCountries: params.getTurnStatusCountries,
    getReadySetForTurn: params.getReadySetForTurn,
    getOnlineCountryIds: params.getOnlineCountryIds,
    getAiControlledCountryIds: params.getAiControlledCountryIds,
    getCountryResources: params.getCountryResources,
    getCountryResourceNetByTurn: params.getCountryResourceNetByTurn,
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

  registerContentReadRoutes(params.app, {
    getActiveScenarioId: params.getActiveScenarioId,
    getAssets: () => params.getGameSettings().content.assets,
    parseContentKind: (raw) => {
      const parsed = params.contentEntryKindSchema.safeParse(raw);
      return parsed.success ? { success: true, data: parsed.data as ContentEntryKind } : { success: false };
    },
    getEntriesByKind: params.getEntriesByKind,
  });

  registerSettingsGuideRoutes(params.app, {
    routeAuth: params.routeAuth,
    getPublicGameSettings: () => {
      const gameSettings = params.getGameSettings();
      return {
        civilopedia: gameSettings.civilopedia,
        activeScenarioId: params.getActiveScenarioId(),
        economy: gameSettings.economy,
        colonization: gameSettings.colonization,
        customization: gameSettings.customization,
        military: gameSettings.military,
        registration: gameSettings.registration,
        eventLog: gameSettings.eventLog,
        turnTimer: {
          ...gameSettings.turnTimer,
          currentTurnStartedAtMs: params.getCurrentTurnStartedAtMs(),
        },
        map: gameSettings.map,
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

}
