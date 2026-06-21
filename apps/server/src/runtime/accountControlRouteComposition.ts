import type express from "express";
import type { EventLogEntry, WsOutMessage } from "@arcanorum/shared";
import type { PrismaClient } from "@prisma/client";
import type { RouteAuth } from "../security/routeAuth";
import type { GameSettings } from "./gameSettingsTypes";
import type { ResourceLedgerRuntime } from "./resourceLedgerRuntime";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";
import { countrySelect } from "./countryRuntimeHelpers";
import { registerAccountRouteRuntime } from "./accountRouteRuntime";
import { registerCountryManagementRouteRuntime } from "./countryManagementRouteRuntime";

type AccountDeps = Parameters<typeof registerAccountRouteRuntime>[0];
type CountryManagementDeps = Parameters<typeof registerCountryManagementRouteRuntime>[0];

type AccountControlRouteCompositionParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  upload: AccountDeps["upload"];
  prisma: PrismaClient;
  jwtSecret: string;
  flagImageRule: AccountDeps["flagImageRule"];
  crestImageRule: AccountDeps["crestImageRule"];
  masks: AccountDeps["masks"] & CountryManagementDeps["masks"];
  getTurnId: () => number;
  getWorldBase: AccountDeps["getWorldBase"];
  getOrdersByTurn: CountryManagementDeps["getOrdersByTurn"];
  getResolveReadyByTurn: CountryManagementDeps["getResolveReadyByTurn"];
  getCustomizationSettings: () => GameSettings["customization"];
  getRegistrationRequiresAdminApproval: AccountDeps["getRegistrationRequiresAdminApproval"];
  getInitialColonizationPoints: AccountDeps["getInitialColonizationPoints"];
  getInitialConstructionPoints: AccountDeps["getInitialConstructionPoints"];
  getClientEventLogRetentionTurns: AccountDeps["getClientEventLogRetentionTurns"];
  countryRuntimeHelpers: Pick<
    CountryManagementDeps,
    "countryFromDb" | "invalidateCountryQueryCache"
  > &
    Pick<
      AccountDeps,
      | "getCountryBlockInfo"
      | "cleanupExpiredPunishments"
      | "makeRegistrationApprovalUiNotification"
    >;
  marketRuntimeFacade: {
    setCountryMarketId: CountryManagementDeps["setCountryMarketId"];
    cleanupMarketsAfterCountryRemoval: CountryManagementDeps["cleanupMarketsAfterCountryRemoval"];
  };
  colonizationRuntime: {
    removeCountryFromActiveColonizationIndex: CountryManagementDeps["removeCountryFromActiveColonizationIndex"];
    removeRegionFromActiveColonizationIndex: CountryManagementDeps["removeRegionFromActiveColonizationIndex"];
  };
  countryWorldRuntime: {
    ensureCountryInWorldBase: CountryManagementDeps["ensureCountryInWorldBase"];
    addCountryToEconomyTick: AccountDeps["addCountryToEconomyTick"];
    removeCountryFromEconomyTick: CountryManagementDeps["removeCountryFromEconomyTick"];
  };
  turnOrderRuntime: {
    removeOrderFromTurnIndexes: CountryManagementDeps["removeOrderFromTurnIndexes"];
    dropTurnOrderIndexes: CountryManagementDeps["dropTurnOrderIndexes"];
  };
  uiNotificationRuntime: {
    sendUiNotificationToAdmins: AccountDeps["sendUiNotificationToAdmins"];
    removeQueuedUiNotification: AccountDeps["removeQueuedUiNotification"];
    broadcastUiNotification: AccountDeps["broadcastUiNotification"];
  };
  worldDeltaBroadcastRuntime: {
    cloneWorldBaseSectionSnapshot: (mask: number) => WorldBaseSectionSnapshot;
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: WorldBaseSectionSnapshot) => void;
  };
  resourceLedgerRuntime: ResourceLedgerRuntime;
  validateImageRule: AccountDeps["validateImageRule"];
  removeUploadedFile: AccountDeps["removeUploadedFile"];
  removeUploadedFiles: CountryManagementDeps["removeUploadedFiles"];
  removeUploadedByUrl: AccountDeps["removeUploadedByUrl"];
  makeVersionedUploadUrl: AccountDeps["makeVersionedUploadUrl"];
  pushAdminAuditLog: CountryManagementDeps["pushAdminAuditLog"];
  setLastLoginAt: AccountDeps["setLastLoginAt"];
  savePersistentState: () => void;
  makeOfficialNews: (input: {
    turn: number;
    category: EventLogEntry["category"];
    title: string;
    message: string;
    countryId?: string | null;
    priority?: EventLogEntry["priority"];
    visibility?: EventLogEntry["visibility"];
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export function registerAccountControlRouteComposition(params: AccountControlRouteCompositionParams): void {
  registerCountryManagementRouteRuntime({
    app: params.app,
    routeAuth: params.routeAuth,
    upload: params.upload,
    prisma: params.prisma,
    countrySelect,
    flagImageRule: params.flagImageRule,
    crestImageRule: params.crestImageRule,
    masks: params.masks,
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getOrdersByTurn: params.getOrdersByTurn,
    getResolveReadyByTurn: params.getResolveReadyByTurn,
    getCustomizationSettings: params.getCustomizationSettings,
    countryFromDb: params.countryRuntimeHelpers.countryFromDb,
    setCountryMarketId: params.marketRuntimeFacade.setCountryMarketId,
    invalidateCountryQueryCache: params.countryRuntimeHelpers.invalidateCountryQueryCache,
    validateImageRule: params.validateImageRule,
    removeUploadedFiles: params.removeUploadedFiles,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    ensureCountryInWorldBase: params.countryWorldRuntime.ensureCountryInWorldBase,
    removeCountryFromEconomyTick: params.countryWorldRuntime.removeCountryFromEconomyTick,
    removeCountryFromActiveColonizationIndex: params.colonizationRuntime.removeCountryFromActiveColonizationIndex,
    removeRegionFromActiveColonizationIndex: params.colonizationRuntime.removeRegionFromActiveColonizationIndex,
    removeOrderFromTurnIndexes: params.turnOrderRuntime.removeOrderFromTurnIndexes,
    dropTurnOrderIndexes: params.turnOrderRuntime.dropTurnOrderIndexes,
    cleanupMarketsAfterCountryRemoval: params.marketRuntimeFacade.cleanupMarketsAfterCountryRemoval,
    pushAdminAuditLog: params.pushAdminAuditLog,
    cloneWorldBaseSectionSnapshot: params.worldDeltaBroadcastRuntime.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: params.worldDeltaBroadcastRuntime.broadcastWorldDeltaFromSectionSnapshot,
    addResourceLedgerExpense: params.resourceLedgerRuntime.addExpense,
    flushResourceLedger: params.resourceLedgerRuntime.flushTurn,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });

  registerAccountRouteRuntime({
    app: params.app,
    routeAuth: params.routeAuth,
    upload: params.upload,
    prisma: params.prisma,
    countrySelect,
    jwtSecret: params.jwtSecret,
    flagImageRule: params.flagImageRule,
    crestImageRule: params.crestImageRule,
    masks: params.masks,
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getRegistrationRequiresAdminApproval: params.getRegistrationRequiresAdminApproval,
    getInitialColonizationPoints: params.getInitialColonizationPoints,
    getInitialConstructionPoints: params.getInitialConstructionPoints,
    countryFromDb: params.countryRuntimeHelpers.countryFromDb,
    getCountryBlockInfo: params.countryRuntimeHelpers.getCountryBlockInfo,
    cleanupExpiredPunishments: params.countryRuntimeHelpers.cleanupExpiredPunishments,
    validateImageRule: params.validateImageRule,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    invalidateCountryQueryCache: params.countryRuntimeHelpers.invalidateCountryQueryCache,
    ensureCountryInWorldBase: params.countryWorldRuntime.ensureCountryInWorldBase,
    addCountryToEconomyTick: params.countryWorldRuntime.addCountryToEconomyTick,
    removeCountryFromEconomyTick: params.countryWorldRuntime.removeCountryFromEconomyTick,
    removeCountryFromActiveColonizationIndex: params.colonizationRuntime.removeCountryFromActiveColonizationIndex,
    setLastLoginAt: params.setLastLoginAt,
    savePersistentState: params.savePersistentState,
    cloneWorldBaseSectionSnapshot: params.worldDeltaBroadcastRuntime.cloneWorldBaseSectionSnapshot,
    broadcastWorldDeltaFromSectionSnapshot: params.worldDeltaBroadcastRuntime.broadcastWorldDeltaFromSectionSnapshot,
    makeRegistrationApprovalUiNotification: params.countryRuntimeHelpers.makeRegistrationApprovalUiNotification,
    sendUiNotificationToAdmins: params.uiNotificationRuntime.sendUiNotificationToAdmins,
    removeQueuedUiNotification: params.uiNotificationRuntime.removeQueuedUiNotification,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
    getClientEventLogRetentionTurns: params.getClientEventLogRetentionTurns,
    broadcastUiNotification: params.uiNotificationRuntime.broadcastUiNotification,
  });
}
