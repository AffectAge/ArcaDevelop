import { randomUUID } from "node:crypto";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import type { WsOutMessage, WorldBase } from "@arcanorum/shared";
import { WORLD_DELTA_MASK } from "@arcanorum/shared";
import type { RouteAuth } from "../security/routeAuth";
import type { upload } from "../uploads/uploadMiddleware";
import type { countrySelect } from "./countryRuntimeHelpers";
import type { createBuildingSystemsRuntime } from "./buildingSystemsRuntime";
import type { createColonizationRuntimeFacade } from "./colonizationRuntimeFacade";
import type { createCountryRuntimeHelpers } from "./countryRuntimeHelpers";
import type { createCountrySystemsRuntime } from "./countrySystemsRuntime";
import type { createCountryWorldRuntime } from "./countryWorldRuntime";
import { createDiplomacyRouteComposition } from "./diplomacyRouteComposition";
import type { createMapRuntimeState } from "./mapRuntimeState";
import type { createMarketAccessRuntime } from "./marketAccessRuntime";
import type { createMarketRuntimeFacade } from "./marketRuntimeFacade";
import type { makeOfficialNews } from "./officialNewsRuntime";
import type { createScenarioServerRuntime } from "./scenarioServerRuntime";
import type { createTurnOrderRuntimeFacade } from "./turnOrderRuntimeFacade";
import type { createUiNotificationRuntime } from "./uiNotificationRuntime";
import type { createWorldDeltaBroadcastRuntime } from "./worldDeltaBroadcastRuntime";
import type { ResourceLedgerRuntime } from "./resourceLedgerRuntime";
import type { GameSettings } from "./gameSettingsTypes";
import type { MarketPriceRuntimeState } from "./marketPriceRuntimeState";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";
import { getTransportCorridorBuildCost } from "./marketSettingsNormalizers";
import {
  normalizeMarketVisibility,
  normalizeHexIdList,
  normalizeTransportCorridorRoutePoints,
} from "./marketSettingsNormalizers";
import { round3 } from "./numberRuntime";
import {
  HARD_MAX_ADMIN_AUDIT_LOG,
} from "../security/adminAuditLog";
import { SETTINGS_MAX_NUMBER } from "./serverRuntimeConfig";
import { applyScenarioDefinesToGameSettings, loadScenarioDefines } from "../scenarios/scenarioDefinesLoader";
import { loadScenarioHistoryOrNull } from "../scenarios/scenarioRuntimeLoader";
import { registerCountryRouteComposition } from "./countryRouteComposition";
import { registerGameplayRouteComposition } from "./gameplayRouteComposition";
import { registerMarketRouteComposition } from "./marketRouteComposition";
import { registerScenarioRouteComposition } from "./scenarioRouteComposition";
import { registerWorldRouteComposition } from "./worldRouteComposition";
import { registerUnitRoutes } from "../routes/unitRoutes";

type CountrySystemsRuntime = ReturnType<typeof createCountrySystemsRuntime>;
type UiNotificationRuntime = ReturnType<typeof createUiNotificationRuntime>;
type DiplomacyRuntime = ReturnType<typeof createDiplomacyRouteComposition>;
type DiplomacyRuntimeRef = {
  current?: DiplomacyRuntime;
};

type ServerMainRouteRegistrationRuntimeParams = {
  app: Express;
  prisma: PrismaClient;
  routeAuth: RouteAuth;
  upload: typeof upload;
  countrySelect: typeof countrySelect;
  mapRuntime: ReturnType<typeof createMapRuntimeState>;
  countryRuntimeHelpers: ReturnType<typeof createCountryRuntimeHelpers>;
  countryWorldRuntime: ReturnType<typeof createCountryWorldRuntime>;
  progressionRuntime: CountrySystemsRuntime["progressionRuntime"];
  modifierRuntime: Parameters<typeof registerCountryRouteComposition>[0]["modifierRuntime"];
  scenarioServerRuntime: ReturnType<typeof createScenarioServerRuntime>;
  marketRuntimeFacade: ReturnType<typeof createMarketRuntimeFacade>;
  marketAccessRuntime: ReturnType<typeof createMarketAccessRuntime>;
  marketPriceRuntimeState: MarketPriceRuntimeState;
  colonizationRuntime: ReturnType<typeof createColonizationRuntimeFacade>;
  buildingRuntime: ReturnType<typeof createBuildingSystemsRuntime>["buildingRuntime"];
  turnOrderRuntime: ReturnType<typeof createTurnOrderRuntimeFacade>;
  uiNotificationRuntime: UiNotificationRuntime;
  worldDeltaBroadcastRuntime: ReturnType<typeof createWorldDeltaBroadcastRuntime>;
  resourceLedgerRuntime: ResourceLedgerRuntime;
  diplomacyRuntimeRef: DiplomacyRuntimeRef;
  refreshExpiredDiplomacyProposals: () => void;
  getTurnId: () => number;
  setTurnId: (turnId: number) => void;
  getWorldStateVersion: () => number;
  incrementWorldStateVersion: () => number;
  getWorldBase: () => WorldBase;
  setWorldBase: (worldBase: WorldBase) => void;
  getHexMovementCost: (hexId: string, countryId?: string) => number;
  getGameSettings: () => GameSettings;
  setGameSettings: (settings: GameSettings) => void;
  setActiveScenario: (scenario: { id: string; name: string }) => void;
  clearTurnState: () => void;
  clearColonizationQueues: () => void;
  clearWorldDeltaHistory: () => void;
  resetTurnTimerAnchor: () => void;
  getOrdersByTurnForTurn: Parameters<typeof registerGameplayRouteComposition>[0]["getOrdersByTurn"];
  deleteOrdersForTurn: (turnId: number) => boolean;
  getActiveColonizeRegionIds: (countryId: string) => Iterable<string>;
  getQueuedColonizeRegionIds: (turnId: number, countryId: string) => Iterable<string>;
  getHexRenameDucatsCost: () => number;
  pushAdminAuditLog: Parameters<typeof registerScenarioRouteComposition>[0]["pushAdminAuditLog"];
  savePersistentState: () => void;
  flushPersistentStateNow: () => Promise<void>;
  validateImageDimensions: Parameters<typeof registerMarketRouteComposition>[0]["validateImageDimensions"];
  removeUploadedFile: (file: Express.Multer.File | undefined) => void;
  removeUploadedByUrl: (url: string) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
  makeOfficialNews: typeof makeOfficialNews;
  normalizeDiplomacyProposals: Parameters<typeof createDiplomacyRouteComposition>[0]["normalizeDiplomacyProposals"];
  sendUiNotificationToCountry: (
    countryId: string,
    notification: Parameters<UiNotificationRuntime["sendUiNotificationToCountry"]>[2],
  ) => void;
  broadcast: (message: WsOutMessage) => void;
  logError: (message: string, error: unknown) => void;
};

export function registerServerMainRouteRuntime(params: ServerMainRouteRegistrationRuntimeParams): void {
  registerWorldRouteComposition({
    app: params.app,
    routeAuth: params.routeAuth,
    getWorldBase: params.getWorldBase,
    getTurnId: params.getTurnId,
    getWorldStateVersion: params.getWorldStateVersion,
    countryWorldRuntime: params.countryWorldRuntime,
  });

  registerUnitRoutes(params.app, {
    routeAuth: params.routeAuth,
    masks: {
      unitState: WORLD_DELTA_MASK.unitState,
      resourcesByCountry: WORLD_DELTA_MASK.resourcesByCountry,
      resourceLedgerByTurn: WORLD_DELTA_MASK.resourceLedgerByTurn,
    },
    createId: randomUUID,
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getUnitTypes: () => params.getGameSettings().content.unitTypes,
    getHexRegionId: (hexId) => params.mapRuntime.getHexById().get(hexId)?.regionId ?? null,
    getHex: (hexId) => params.mapRuntime.getHexById().get(hexId) ?? null,
    cloneWorldBaseSectionSnapshot: params.worldDeltaBroadcastRuntime.cloneWorldBaseSectionSnapshot,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.worldDeltaBroadcastRuntime.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    savePersistentState: params.savePersistentState,
    addResourceLedgerExpense: params.resourceLedgerRuntime.addExpense,
    flushResourceLedger: params.resourceLedgerRuntime.flushTurn,
  });

  registerMarketRouteComposition({
    app: params.app,
    prisma: params.prisma,
    routeAuth: params.routeAuth,
    upload: params.upload,
    maxSettingNumber: SETTINGS_MAX_NUMBER,
    createId: randomUUID,
    getTurnId: params.getTurnId,
    getGameSettings: params.getGameSettings,
    getWorldBase: params.getWorldBase,
    getHexMapArtifact: params.mapRuntime.getHexMapArtifact,
    getHexMovementCost: params.getHexMovementCost,
    countryWorldRuntime: params.countryWorldRuntime,
    marketRuntimeFacade: params.marketRuntimeFacade,
    marketAccessRuntime: params.marketAccessRuntime,
    getCountryGoodPrices: () => params.marketPriceRuntimeState.countryGoodPrices,
    getGlobalGoodPrices: () => params.marketPriceRuntimeState.globalGoodPrices,
    getGlobalGoodPriceHistoryByResourceId: () => params.marketPriceRuntimeState.globalGoodPriceHistoryByResourceId,
    getGlobalGoodDemandHistoryByResourceId: () => params.marketPriceRuntimeState.globalGoodDemandHistoryByResourceId,
    getGlobalGoodOfferHistoryByResourceId: () => params.marketPriceRuntimeState.globalGoodOfferHistoryByResourceId,
    getGlobalGoodProductionFactHistoryByResourceId: () =>
      params.marketPriceRuntimeState.globalGoodProductionFactHistoryByResourceId,
    getGlobalGoodProductionMaxHistoryByResourceId: () =>
      params.marketPriceRuntimeState.globalGoodProductionMaxHistoryByResourceId,
    getLatestMarketOverview: params.marketPriceRuntimeState.getLatestMarketOverview,
    normalizeMarketVisibility,
    normalizeTransportCorridorRoutePoints,
    normalizeHexIdList,
    getTransportCorridorBuildCost,
    refreshExpiredDiplomacyProposals: params.refreshExpiredDiplomacyProposals,
    validateImageDimensions: params.validateImageDimensions,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    round3,
    savePersistentState: params.savePersistentState,
  });

  registerCountryRouteComposition({
    app: params.app,
    prisma: params.prisma,
    routeAuth: params.routeAuth,
    countrySelect: params.countrySelect,
    masks: {
      parliamentByCountry: WORLD_DELTA_MASK.parliamentByCountry,
      technologyByCountry: WORLD_DELTA_MASK.technologyByCountry,
      resourcesByCountry: WORLD_DELTA_MASK.resourcesByCountry,
      colonyProgressByRegion: WORLD_DELTA_MASK.colonyProgressByRegion,
      countryDecisionsByCountryId: WORLD_DELTA_MASK.countryDecisionsByCountryId,
      countryEventsByCountryId: WORLD_DELTA_MASK.countryEventsByCountryId,
      countryScheduledEventsByCountryId: WORLD_DELTA_MASK.countryScheduledEventsByCountryId,
      countryEventFlagsByCountryId: WORLD_DELTA_MASK.countryEventFlagsByCountryId,
      journalEntriesByCountryId: WORLD_DELTA_MASK.journalEntriesByCountryId,
      countryModifiersByCountryId: WORLD_DELTA_MASK.countryModifiersByCountryId,
      explanationRecordsByTurn: WORLD_DELTA_MASK.explanationRecordsByTurn,
    },
    countryRuntimeHelpers: params.countryRuntimeHelpers,
    countryWorldRuntime: params.countryWorldRuntime,
    progressionRuntime: params.progressionRuntime,
    modifierRuntime: params.modifierRuntime,
    uiNotificationRuntime: params.uiNotificationRuntime,
    worldDeltaBroadcastRuntime: params.worldDeltaBroadcastRuntime,
    resourceLedgerRuntime: params.resourceLedgerRuntime,
    getTurnId: params.getTurnId,
    getGameSettings: params.getGameSettings,
    getWorldBase: params.getWorldBase,
    setCountryParliament: (countryId, parliament) => {
      params.getWorldBase().parliamentByCountry[countryId] = parliament;
    },
    setCountryTechnologyState: (countryId, state) => {
      params.getWorldBase().technologyByCountry[countryId] = state;
    },
    savePersistentState: params.savePersistentState,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });

  params.diplomacyRuntimeRef.current = createDiplomacyRouteComposition({
    app: params.app,
    prisma: params.prisma,
    routeAuth: params.routeAuth,
    masks: {
      resourcesByCountry: WORLD_DELTA_MASK.resourcesByCountry,
      regionOwner: WORLD_DELTA_MASK.regionOwner,
      regionController: WORLD_DELTA_MASK.regionController,
      colonyProgressByRegion: WORLD_DELTA_MASK.colonyProgressByRegion,
      diplomacyProposals: WORLD_DELTA_MASK.diplomacyProposals,
    },
    createId: randomUUID,
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    setDiplomacyProposals: (proposals) => {
      params.getWorldBase().diplomacyProposals = proposals;
    },
    getGameSettings: params.getGameSettings,
    countryWorldRuntime: params.countryWorldRuntime,
    normalizeDiplomacyProposals: params.normalizeDiplomacyProposals,
    worldDeltaBroadcastRuntime: params.worldDeltaBroadcastRuntime,
    resourceLedgerRuntime: params.resourceLedgerRuntime,
    uiNotificationRuntime: {
      removeQueuedUiNotification: params.uiNotificationRuntime.removeQueuedUiNotification,
      sendUiNotificationToCountry: params.sendUiNotificationToCountry,
    },
    savePersistentState: params.savePersistentState,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });

  registerScenarioRouteComposition({
    app: params.app,
    routeAuth: params.routeAuth,
    findScenario: params.scenarioServerRuntime.findScenario,
    mapRuntime: params.mapRuntime,
    loadScenarioHistory: loadScenarioHistoryOrNull,
    applyScenarioCountryMetadata: params.scenarioServerRuntime.applyScenarioCountryMetadata,
    loadScenarioContent: params.scenarioServerRuntime.loadScenarioContent,
    loadScenarioDefines,
    applyScenarioDefines: (settings, defines) =>
      applyScenarioDefinesToGameSettings(settings, defines, {
        hardMaxAuditLogEntries: HARD_MAX_ADMIN_AUDIT_LOG,
        maxSettingNumber: SETTINGS_MAX_NUMBER,
      }),
    getGameSettings: params.getGameSettings,
    setGameSettings: params.setGameSettings,
    setTurnId: params.setTurnId,
    setActiveScenario: params.setActiveScenario,
    clearTurnState: params.clearTurnState,
    clearColonizationQueues: params.clearColonizationQueues,
    clearWorldDeltaHistory: params.clearWorldDeltaHistory,
    resetTurnTimerAnchor: params.resetTurnTimerAnchor,
    buildWorldBaseFromScenario: params.scenarioServerRuntime.buildWorldBaseFromScenario,
    setWorldBase: params.setWorldBase,
    colonizationRuntime: params.colonizationRuntime,
    turnOrderRuntime: params.turnOrderRuntime,
    countryWorldRuntime: params.countryWorldRuntime,
    marketRuntimeFacade: params.marketRuntimeFacade,
    worldDeltaBroadcastRuntime: params.worldDeltaBroadcastRuntime,
    pushAdminAuditLog: params.pushAdminAuditLog,
    incrementWorldStateVersion: params.incrementWorldStateVersion,
    savePersistentState: params.savePersistentState,
    flushPersistentStateNow: params.flushPersistentStateNow,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
    logError: params.logError,
  });

  registerGameplayRouteComposition({
    app: params.app,
    routeAuth: params.routeAuth,
    prisma: params.prisma,
    masks: {
      colonyProgressByRegion: WORLD_DELTA_MASK.colonyProgressByRegion,
      regionResourceExplorationQueueByRegion: WORLD_DELTA_MASK.regionResourceExplorationQueueByRegion,
      regionConstructionQueueByRegion: WORLD_DELTA_MASK.regionConstructionQueueByRegion,
      resourcesByCountry: WORLD_DELTA_MASK.resourcesByCountry,
      regionBuildingsByRegion: WORLD_DELTA_MASK.regionBuildingsByRegion,
      regionBuildingDucatsByRegion: WORLD_DELTA_MASK.regionBuildingDucatsByRegion,
      resourceLedgerByTurn: WORLD_DELTA_MASK.resourceLedgerByTurn,
      hexOwner: WORLD_DELTA_MASK.hexOwner,
      regionOwner: WORLD_DELTA_MASK.regionOwner,
      regionController: WORLD_DELTA_MASK.regionController,
      regionColonizationByRegion: WORLD_DELTA_MASK.regionColonizationByRegion,
      regionPopulationByRegion: WORLD_DELTA_MASK.regionPopulationByRegion,
      hexNameById: WORLD_DELTA_MASK.hexNameById,
    },
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getGameSettings: params.getGameSettings,
    getOrdersByTurn: params.getOrdersByTurnForTurn,
    deleteOrdersForTurn: params.deleteOrdersForTurn,
    mapRuntime: params.mapRuntime,
    turnOrderRuntime: params.turnOrderRuntime,
    colonizationRuntime: params.colonizationRuntime,
    buildingRuntime: params.buildingRuntime,
    countryWorldRuntime: params.countryWorldRuntime,
    worldDeltaBroadcastRuntime: params.worldDeltaBroadcastRuntime,
    resourceLedgerRuntime: params.resourceLedgerRuntime,
    getActiveColonizeRegionIds: params.getActiveColonizeRegionIds,
    getQueuedColonizeRegionIds: params.getQueuedColonizeRegionIds,
    getHexRenameDucatsCost: params.getHexRenameDucatsCost,
    savePersistentState: params.savePersistentState,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });
}
