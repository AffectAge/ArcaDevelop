import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type express from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Country, EventLogEntry, WorldBase, WsOutMessage } from "@arcanorum/shared";
import { createAuthToken } from "../security/authToken";
import type { RouteAuth } from "../security/routeAuth";
import { registerAdminUiNotificationRoutes } from "../routes/adminUiNotificationRoutes";
import { registerAuthRegistrationRoutes } from "../routes/authRegistrationRoutes";
import type { AdminCountryDbRecord } from "../routes/adminCountryRoutes";
import type { ImageDimensionRule } from "../uploads/uploadValidation";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";
import type { GameSettings } from "./gameSettingsTypes";

type AccountUploadMiddleware = {
  fields: (fields: Array<{ name: string; maxCount?: number }>) => express.RequestHandler;
};

type AccountRouteRuntimeParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  upload: AccountUploadMiddleware;
  prisma: PrismaClient;
  countrySelect: Prisma.CountrySelect;
  jwtSecret: string;
  flagImageRule: ImageDimensionRule;
  crestImageRule: ImageDimensionRule;
  identityLogoImageRule: ImageDimensionRule;
  masks: {
    resourcesByCountry: number;
    hexOwner: number;
    colonyProgressByRegion: number;
    unitState: number;
  };
  getTurnId: () => number;
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getRegistrationRequiresAdminApproval: () => boolean;
  getInitialColonizationPoints: () => number;
  getInitialConstructionPoints: () => number;
  countryFromDb: (row: AdminCountryDbRecord) => Country;
  getCountryBlockInfo: (
    country: { isLocked: boolean; blockedUntilTurn: number | null; blockedUntilAt: Date | null },
    currentTurn: number,
    now: Date,
  ) => {
    blocked: boolean;
    reason: "PERMANENT" | "TURN" | "TIME" | null;
    blockedUntilTurn: number | null;
    blockedUntilAt: Date | null;
  };
  cleanupExpiredPunishments: (currentTurn: number, now: Date) => Promise<void>;
  validateImageRule: (file: Express.Multer.File, rule: ImageDimensionRule) => boolean;
  removeUploadedFile: (file: Express.Multer.File | undefined) => void;
  removeUploadedByUrl: (url?: string | null) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
  invalidateCountryQueryCache: () => void;
  ensureCountryInWorldBase: (countryId: string) => void;
  createStarterColonizerForCountry: (countryId: string) => boolean;
  addCountryToEconomyTick: (countryId: string) => void;
  removeCountryFromEconomyTick: (countryId: string) => void;
  removeCountryFromActiveColonizationIndex: (countryId: string) => void;
  setLastLoginAt: (countryId: string, timestamp: string) => void;
  savePersistentState: () => void;
  cloneWorldBaseSectionSnapshot: (mask: number) => WorldBaseSectionSnapshot;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: WorldBaseSectionSnapshot) => void;
  makeRegistrationApprovalUiNotification: (
    country: Pick<AdminCountryDbRecord, "id" | "name" | "color" | "flagUrl" | "crestUrl"> & { createdAt?: Date | null },
  ) => Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"];
  sendUiNotificationToAdmins: (notification: Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"]) => void;
  removeQueuedUiNotification: (notificationId: string) => void;
  makeOfficialNews: (input: {
    turn: number;
    category: "politics";
    title: string;
    message: string;
    countryId: string;
    priority: "medium";
    visibility: "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
  getClientEventLogRetentionTurns: () => number;
  broadcastUiNotification: (notification: Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"]) => void;
};

export function registerAccountRouteRuntime(params: AccountRouteRuntimeParams): void {
  registerAuthRegistrationRoutes(params.app, {
    routeAuth: params.routeAuth,
    upload: params.upload,
    flagImageRule: params.flagImageRule,
    crestImageRule: params.crestImageRule,
    identityLogoImageRule: params.identityLogoImageRule,
    masks: params.masks,
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getGameSettings: params.getGameSettings,
    getRegistrationRequiresAdminApproval: params.getRegistrationRequiresAdminApproval,
    getInitialColonizationPoints: params.getInitialColonizationPoints,
    getInitialConstructionPoints: params.getInitialConstructionPoints,
    countryIdentityNameExists: async (kind, name) => {
      const where = kind === "culture" ? { cultureName: name } : { religionName: name };
      const existing = await params.prisma.country.findFirst({ where, select: { id: true } });
      return Boolean(existing);
    },
    countAdminCountries: () => params.prisma.country.count({ where: { isAdmin: true } }),
    createCountry: async (data) =>
      params.prisma.country.create({ data, select: params.countrySelect }) as Promise<AdminCountryDbRecord>,
    findCountryForLogin: (countryId) => params.prisma.country.findUnique({ where: { id: countryId } }),
    findCountry: async (countryId) =>
      params.prisma.country.findUnique({ where: { id: countryId }, select: params.countrySelect }) as Promise<AdminCountryDbRecord | null>,
    approveCountryRegistration: async (countryId) =>
      params.prisma.country.update({
        where: { id: countryId },
        data: { isRegistrationApproved: true },
        select: params.countrySelect,
      }) as Promise<AdminCountryDbRecord>,
    findFullCountry: (countryId) => params.prisma.country.findUnique({ where: { id: countryId } }),
    deleteCountry: async (countryId) => {
      await params.prisma.country.delete({ where: { id: countryId } });
    },
    countryFromDb: params.countryFromDb,
    hashPassword: (password) => bcrypt.hash(password, 10),
    comparePassword: (password, passwordHash) => bcrypt.compare(password, passwordHash),
    createAuthToken: (payload, rememberMe) => createAuthToken(payload, rememberMe, params.jwtSecret),
    getCountryBlockInfo: params.getCountryBlockInfo,
    cleanupExpiredPunishments: params.cleanupExpiredPunishments,
    validateImageRule: params.validateImageRule,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    invalidateCountryQueryCache: params.invalidateCountryQueryCache,
    ensureCountryInWorldBase: params.ensureCountryInWorldBase,
    createStarterColonizerForCountry: params.createStarterColonizerForCountry,
    addCountryToEconomyTick: params.addCountryToEconomyTick,
    removeCountryFromEconomyTick: params.removeCountryFromEconomyTick,
    removeCountryFromActiveColonizationIndex: params.removeCountryFromActiveColonizationIndex,
    setLastLoginAt: params.setLastLoginAt,
    savePersistentState: params.savePersistentState,
    cloneWorldBaseSectionSnapshot: params.cloneWorldBaseSectionSnapshot,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    makeRegistrationApprovalUiNotification: params.makeRegistrationApprovalUiNotification,
    sendUiNotificationToAdmins: params.sendUiNotificationToAdmins,
    removeQueuedUiNotification: params.removeQueuedUiNotification,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
    getClientEventLogRetentionTurns: params.getClientEventLogRetentionTurns,
  });

  registerAdminUiNotificationRoutes(params.app, {
    routeAuth: params.routeAuth,
    createId: randomUUID,
    getNowIso: () => new Date().toISOString(),
    broadcastUiNotification: params.broadcastUiNotification,
  });
}
