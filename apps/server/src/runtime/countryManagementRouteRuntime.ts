import type express from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Country, EventLogEntry, Order, WorldBase, WsOutMessage } from "@arcanorum/shared";
import { cleanupWorldBaseAfterCountryRemovalFromState, removeCountryOrdersAndReadinessFromState } from "../lifecycle/countryDeletionCleanup";
import { planCountryDeletion } from "../lifecycle/countryDeletionPlan";
import { registerAdminCountryRoutes } from "../routes/adminCountryRoutes";
import type { AdminCountryAuditEntry, AdminCountryDbRecord } from "../routes/adminCountryRoutes";
import { registerAdminCountryPunishmentRoutes } from "../routes/adminCountryPunishmentRoutes";
import { registerCountryClientSettingsRoutes } from "../routes/countryClientSettingsRoutes";
import { registerCountryCustomizationRoutes } from "../routes/countryCustomizationRoutes";
import type { RouteAuth } from "../security/routeAuth";
import type { ImageDimensionRule } from "../uploads/uploadValidation";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";

type CountryManagementUploadMiddleware = {
  fields: (fields: Array<{ name: string; maxCount?: number }>) => express.RequestHandler;
};

type CountryManagementMasks = {
  resourcesByCountry: number;
  hexOwner: number;
  colonyProgressByRegion: number;
  regionConstructionQueueByRegion: number;
  parliamentByCountry: number;
  technologyByCountry: number;
  countryDecisionsByCountryId: number;
  countryEventsByCountryId: number;
  countryScheduledEventsByCountryId: number;
  countryEventFlagsByCountryId: number;
  journalEntriesByCountryId: number;
  countryModifiersByCountryId: number;
  divisionTemplatesByCountry: number;
  divisionsById: number;
  militaryFormationQueueByCountry: number;
  diplomacyProposals: number;
};

type CountryManagementRouteRuntimeParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  upload: CountryManagementUploadMiddleware;
  prisma: PrismaClient;
  countrySelect: Prisma.CountrySelect;
  flagImageRule: ImageDimensionRule;
  crestImageRule: ImageDimensionRule;
  masks: CountryManagementMasks;
  getTurnId: () => number;
  getWorldBase: () => WorldBase;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getResolveReadyByTurn: () => Map<number, Set<string>>;
  getCustomizationSettings: () => {
    renameDucats: number;
    recolorDucats: number;
    flagDucats: number;
    crestDucats: number;
  };
  countryFromDb: (row: AdminCountryDbRecord) => Country;
  setCountryMarketId: (countryId: string, marketId: string | null) => void;
  invalidateCountryQueryCache: () => void;
  validateImageRule: (file: Express.Multer.File, rule: ImageDimensionRule) => boolean;
  removeUploadedFiles: (files: Array<Express.Multer.File | undefined>) => void;
  removeUploadedByUrl: (url?: string | null) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
  ensureCountryInWorldBase: (countryId: string) => void;
  removeCountryFromEconomyTick: (countryId: string) => void;
  removeCountryFromActiveColonizationIndex: (countryId: string) => void;
  removeRegionFromActiveColonizationIndex: (hexId: string) => void;
  removeOrderFromTurnIndexes: (order: Order) => void;
  dropTurnOrderIndexes: (turnId: number) => void;
  cleanupMarketsAfterCountryRemoval: (countryId: string) => void;
  pushAdminAuditLog: (entry: {
    actorCountryId: string;
    action: "country.delete";
    targetType: "country";
    targetId: string;
    metadata: { countryName: string; cleanupPlan: ReturnType<typeof planCountryDeletion> };
  }) => AdminCountryAuditEntry;
  cloneWorldBaseSectionSnapshot: (mask: number) => WorldBaseSectionSnapshot;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: WorldBaseSectionSnapshot) => void;
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
  flushResourceLedger?: () => void;
  makeOfficialNews: (input: {
    turn: number;
    category: "politics";
    title: string;
    message: string;
    countryId: string;
    priority: "medium" | "high";
    visibility: "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export function registerCountryManagementRouteRuntime(params: CountryManagementRouteRuntimeParams): void {
  const findCountry = async (countryId: string): Promise<AdminCountryDbRecord | null> =>
    params.prisma.country.findUnique({ where: { id: countryId }, select: params.countrySelect }) as Promise<AdminCountryDbRecord | null>;

  registerAdminCountryRoutes(params.app, {
    routeAuth: params.routeAuth,
    upload: params.upload,
    flagImageRule: params.flagImageRule,
    crestImageRule: params.crestImageRule,
    masks: params.masks,
    getTurnId: params.getTurnId,
    findCountry,
    updateCountryAdmin: async (countryId, isAdmin) =>
      params.prisma.country.update({ where: { id: countryId }, data: { isAdmin }, select: params.countrySelect }) as Promise<AdminCountryDbRecord>,
    updateCountry: async (countryId, data) =>
      params.prisma.country.update({ where: { id: countryId }, data, select: params.countrySelect }) as Promise<AdminCountryDbRecord>,
    deleteCountry: async (countryId) => {
      await params.prisma.country.delete({ where: { id: countryId } });
    },
    countryFromDb: params.countryFromDb,
    setCountryMarketId: params.setCountryMarketId,
    invalidateCountryQueryCache: params.invalidateCountryQueryCache,
    validateImageRule: params.validateImageRule,
    removeUploadedFiles: params.removeUploadedFiles,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    buildCountryDeletionPlan: (countryId, target) =>
      planCountryDeletion({
        countryId,
        worldBase: params.getWorldBase(),
        ordersByTurn: params.getOrdersByTurn(),
        resolveReadyByTurn: params.getResolveReadyByTurn(),
        flagUrl: target.flagUrl,
        crestUrl: target.crestUrl,
        cultureLogoUrl: target.cultureLogoUrl,
        religionLogoUrl: target.religionLogoUrl,
      }),
    removeCountryOrdersAndReadiness: (countryId) =>
      removeCountryOrdersAndReadinessFromState({
        countryId,
        ordersByTurn: params.getOrdersByTurn(),
        resolveReadyByTurn: params.getResolveReadyByTurn(),
        removeOrderFromTurnIndexes: params.removeOrderFromTurnIndexes,
        dropTurnOrderIndexes: params.dropTurnOrderIndexes,
      }),
    cleanupWorldBaseAfterCountryRemoval: (countryId) =>
      cleanupWorldBaseAfterCountryRemovalFromState({
        countryId,
        worldBase: params.getWorldBase(),
        removeCountryFromEconomyTick: params.removeCountryFromEconomyTick,
        removeCountryFromActiveColonizationIndex: params.removeCountryFromActiveColonizationIndex,
        removeRegionFromActiveColonizationIndex: params.removeRegionFromActiveColonizationIndex,
      }),
    cleanupMarketsAfterCountryRemoval: params.cleanupMarketsAfterCountryRemoval,
    pushAdminAuditLog: params.pushAdminAuditLog,
    cloneWorldBaseSectionSnapshot: params.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    makeOfficialNews: (input) => params.makeOfficialNews(input),
    broadcast: params.broadcast,
  });

  registerAdminCountryPunishmentRoutes(params.app, {
    routeAuth: params.routeAuth,
    getTurnId: params.getTurnId,
    findCountry,
    updateCountryPunishment: async (countryId, data) =>
      params.prisma.country.update({ where: { id: countryId }, data, select: params.countrySelect }) as Promise<AdminCountryDbRecord>,
    countryFromDb: params.countryFromDb,
    invalidateCountryQueryCache: params.invalidateCountryQueryCache,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });

  registerCountryClientSettingsRoutes(params.app, {
    routeAuth: params.routeAuth,
  });

  registerCountryCustomizationRoutes(params.app, {
    routeAuth: params.routeAuth,
    upload: params.upload,
    flagImageRule: params.flagImageRule,
    crestImageRule: params.crestImageRule,
    getWorldBase: params.getWorldBase,
    getCustomizationSettings: params.getCustomizationSettings,
    ensureCountryInWorldBase: params.ensureCountryInWorldBase,
    findCountry,
    updateCountry: async (countryId, data) =>
      params.prisma.country.update({ where: { id: countryId }, data, select: params.countrySelect }) as Promise<AdminCountryDbRecord>,
    countryFromDb: params.countryFromDb,
    validateImageRule: params.validateImageRule,
    removeUploadedFiles: params.removeUploadedFiles,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    savePersistentState: params.savePersistentState,
    invalidateCountryQueryCache: params.invalidateCountryQueryCache,
    addResourceExpense: params.addResourceLedgerExpense,
    flushResourceLedger: params.flushResourceLedger,
  });
}
