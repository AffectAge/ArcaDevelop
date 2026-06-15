import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { imageSize } from "image-size";
import type express from "express";
import type { EventLogEntry, WsOutMessage } from "@arcanorum/shared";
import { registerAdminAssetRoutes } from "../routes/adminAssetRoutes";
import type { ResourceIconKey } from "../routes/adminAssetRoutes";
import { registerContentEntryRoutes } from "../routes/contentEntryRoutes";
import type {
  ContentEntryPayload,
  ContentEntryPayloadParseResult,
  ContentEntryRouteItem,
  ContentKindParseResult,
} from "../routes/contentEntryRoutes";
import { registerCultureRoutes } from "../routes/cultureRoutes";
import type { RouteAuth } from "../security/routeAuth";
import type { GameSettings } from "./gameSettingsTypes";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";

type ContentRouteRuntimeParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  upload: {
    single: (fieldName: string) => express.RequestHandler;
    fields: (fields: Array<{ name: string; maxCount?: number }>) => express.RequestHandler;
  };
  getTurnId: () => number;
  getGameSettings: () => GameSettings;
  parseContentKind: (raw: string) => ContentKindParseResult;
  parseContentPayload: (body: unknown) => ContentEntryPayloadParseResult;
  getEntriesByKind: (kind: string) => ContentEntryRouteItem[];
  contentNameExists: (kind: string, name: string, excludeId?: string) => boolean;
  sanitizeContentEntryByKind: (kind: string, payload: ContentEntryPayload) => Record<string, unknown>;
  isMilitaryContentKind: (kind: string) => boolean;
  cloneMilitaryContentSnapshot: () => WorldBaseSectionSnapshot;
  refreshDivisionStatsFromTemplates: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: WorldBaseSectionSnapshot) => void;
  savePersistentState: () => void;
  validateImageDimensions: (file: Express.Multer.File, maxDimension: number) => boolean;
  removeUploadedFile: (file: Express.Multer.File | undefined) => void;
  removeUploadedFiles: (files: Express.Multer.File[]) => void;
  removeUploadedByUrl: (url: string) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
  resolveContentUploadUrlSegment: (kind: string) => string;
  makeOfficialNews: (input: {
    turn: number;
    category: "system";
    title: string;
    message: string;
    countryId: string;
    priority: "low";
    visibility: "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export function registerContentRouteRuntime(params: ContentRouteRuntimeParams): void {
  registerAdminAssetRoutes(params.app, {
    routeAuth: params.routeAuth,
    upload: params.upload,
    validateImageDimensions: params.validateImageDimensions,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedFiles: params.removeUploadedFiles,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    getResourceIcons: () => params.getGameSettings().resourceIcons,
    setResourceIcon: (key: ResourceIconKey, url) => {
      params.getGameSettings().resourceIcons[key] = url;
    },
    getUiBackgroundUrl: () => params.getGameSettings().map.backgroundImageUrl,
    setUiBackgroundUrl: (url) => {
      params.getGameSettings().map.backgroundImageUrl = url;
    },
    getMapSettings: () => params.getGameSettings().map,
    savePersistentState: params.savePersistentState,
    afterResourceIconsUpdated: (actorCountryId) => {
      params.broadcast({
        type: "NEWS_EVENT",
        event: params.makeOfficialNews({
          turn: params.getTurnId(),
          category: "system",
          title: "Иконки ресурсов обновлены",
          message: "Администратор обновил иконки очков/ресурсов в интерфейсе",
          countryId: actorCountryId,
          priority: "low",
          visibility: "public",
        }),
      });
    },
    afterUiBackgroundUpdated: (actorCountryId) => {
      params.broadcast({
        type: "NEWS_EVENT",
        event: params.makeOfficialNews({
          turn: params.getTurnId(),
          category: "system",
          title: "Фон интерфейса обновлён",
          message: "Администратор изменил фоновое изображение интерфейса",
          countryId: actorCountryId,
          priority: "low",
          visibility: "public",
        }),
      });
    },
  });

  registerContentEntryRoutes(params.app, {
    routeAuth: params.routeAuth,
    upload: params.upload,
    createId: randomUUID,
    parseContentKind: params.parseContentKind,
    parseContentPayload: params.parseContentPayload,
    parseRacePortraitSlot: (raw) => (raw === "male" || raw === "female" ? { success: true, data: raw } : { success: false }),
    getEntriesByKind: params.getEntriesByKind,
    getRaceEntries: () => params.getGameSettings().content.races as ContentEntryRouteItem[],
    contentNameExists: params.contentNameExists,
    sanitizeContentEntryByKind: params.sanitizeContentEntryByKind,
    isMilitaryContentKind: params.isMilitaryContentKind,
    cloneMilitaryContentSnapshot: params.cloneMilitaryContentSnapshot,
    refreshDivisionStatsFromTemplates: params.refreshDivisionStatsFromTemplates,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    savePersistentState: params.savePersistentState,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    resolveContentUploadUrlSegment: params.resolveContentUploadUrlSegment,
    validateContentLogo,
    validateRacePortrait: (file) => params.validateImageDimensions(file, 64),
  });

  registerCultureRoutes(params.app, {
    routeAuth: params.routeAuth,
    upload: params.upload,
    createId: randomUUID,
    parseCulturePayload: params.parseContentPayload,
    getCultures: () => params.getGameSettings().content.cultures as ContentEntryRouteItem[],
    cultureNameExists: (name, excludeId) =>
      params
        .getGameSettings()
        .content.cultures.some(
          (culture) => culture.id !== excludeId && culture.name.trim().toLowerCase() === name.trim().toLowerCase(),
        ),
    savePersistentState: params.savePersistentState,
    validateImageDimensions: params.validateImageDimensions,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
  });
}

function validateContentLogo(file: Express.Multer.File, kind: string) {
  try {
    const image = imageSize(readFileSync(file.path));
    const width = Number(image.width ?? 0);
    const height = Number(image.height ?? 0);
    const maxWidth = kind === "events" || kind === "decisions" ? 1080 : 89;
    const maxHeight = kind === "events" || kind === "decisions" ? 970 : 100;
    if (width <= 0 || height <= 0 || width > maxWidth || height > maxHeight) {
      return { ok: false as const, error: "IMAGE_DIMENSIONS_TOO_LARGE" as const, max: `${maxWidth}x${maxHeight}` };
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "IMAGE_INVALID" as const };
  }
}
