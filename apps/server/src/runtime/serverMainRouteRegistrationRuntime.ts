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
import type { createContentLibraryRuntime } from "./contentLibraryRuntime";
import type { createCountryRuntimeHelpers } from "./countryRuntimeHelpers";
import type { createCountrySystemsRuntime } from "./countrySystemsRuntime";
import type { createCountryWorldRuntime } from "./countryWorldRuntime";
import { createDiplomacyRouteComposition } from "./diplomacyRouteComposition";
import type { createMapRuntimeState } from "./mapRuntimeState";
import type { createMarketAccessRuntime } from "./marketAccessRuntime";
import type { createMarketRuntimeFacade } from "./marketRuntimeFacade";
import type { createMilitaryRuntimeFacade } from "./militaryRuntimeFacade";
import type { makeOfficialNews } from "./officialNewsRuntime";
import type { createScenarioServerRuntime } from "./scenarioServerRuntime";
import type { createTurnOrderRuntimeFacade } from "./turnOrderRuntimeFacade";
import type { createUiNotificationRuntime } from "./uiNotificationRuntime";
import type { createWorldDeltaBroadcastRuntime } from "./worldDeltaBroadcastRuntime";
import type { createWorldPopulationRuntime } from "./worldPopulationRuntime";
import type { GameSettings } from "./gameSettingsTypes";
import type { MarketPriceRuntimeState } from "./marketPriceRuntimeState";
import { getTransportCorridorBuildCost } from "./marketSettingsNormalizers";
import {
  normalizeMarketVisibility,
  normalizeProvinceIdList,
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
import { registerMilitaryRouteComposition } from "./militaryRouteComposition";
import { registerScenarioRouteComposition } from "./scenarioRouteComposition";
import { registerWorldRouteComposition } from "./worldRouteComposition";

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
  contentLibraryRuntime: ReturnType<typeof createContentLibraryRuntime>;
  scenarioServerRuntime: ReturnType<typeof createScenarioServerRuntime>;
  marketRuntimeFacade: ReturnType<typeof createMarketRuntimeFacade>;
  marketAccessRuntime: ReturnType<typeof createMarketAccessRuntime>;
  marketPriceRuntimeState: MarketPriceRuntimeState;
  militaryRuntimeFacade: ReturnType<typeof createMilitaryRuntimeFacade>;
  colonizationRuntime: ReturnType<typeof createColonizationRuntimeFacade>;
  buildingRuntime: ReturnType<typeof createBuildingSystemsRuntime>["buildingRuntime"];
  worldPopulationRuntime: ReturnType<typeof createWorldPopulationRuntime>;
  turnOrderRuntime: ReturnType<typeof createTurnOrderRuntimeFacade>;
  uiNotificationRuntime: UiNotificationRuntime;
  worldDeltaBroadcastRuntime: ReturnType<typeof createWorldDeltaBroadcastRuntime>;
  diplomacyRuntimeRef: DiplomacyRuntimeRef;
  refreshExpiredDiplomacyProposals: () => void;
  getTurnId: () => number;
  setTurnId: (turnId: number) => void;
  getWorldStateVersion: () => number;
  incrementWorldStateVersion: () => number;
  getWorldBase: () => WorldBase;
  setWorldBase: (worldBase: WorldBase) => void;
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
  getProvinceRenameDucatsCost: () => number;
  pushAdminAuditLog: Parameters<typeof registerScenarioRouteComposition>[0]["pushAdminAuditLog"];
  savePersistentState: () => void;
  flushPersistentStateNow: () => Promise<void>;
  validateImageDimensions: Parameters<typeof registerMarketRouteComposition>[0]["validateImageDimensions"];
  removeUploadedFile: Parameters<typeof registerMilitaryRouteComposition>[0]["removeUploadedFile"];
  removeUploadedByUrl: Parameters<typeof registerMilitaryRouteComposition>[0]["removeUploadedByUrl"];
  makeVersionedUploadUrl: Parameters<typeof registerMilitaryRouteComposition>[0]["makeVersionedUploadUrl"];
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

  registerMilitaryRouteComposition({
    app: params.app,
    routeAuth: params.routeAuth,
    upload: params.upload,
    masks: {
      divisionTemplatesByCountry: WORLD_DELTA_MASK.divisionTemplatesByCountry,
      divisionsById: WORLD_DELTA_MASK.divisionsById,
      resourcesByCountry: WORLD_DELTA_MASK.resourcesByCountry,
      militaryFormationQueueByCountry: WORLD_DELTA_MASK.militaryFormationQueueByCountry,
    },
    createId: randomUUID,
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getGameSettings: params.getGameSettings,
    mapRuntime: params.mapRuntime,
    countryWorldRuntime: params.countryWorldRuntime,
    marketRuntimeFacade: params.marketRuntimeFacade,
    militaryRuntimeFacade: params.militaryRuntimeFacade,
    worldDeltaBroadcastRuntime: params.worldDeltaBroadcastRuntime,
    savePersistentState: params.savePersistentState,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
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
    normalizeProvinceIdList,
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
      countryDecisionsByCountryId: WORLD_DELTA_MASK.countryDecisionsByCountryId,
      countryEventsByCountryId: WORLD_DELTA_MASK.countryEventsByCountryId,
    },
    countryRuntimeHelpers: params.countryRuntimeHelpers,
    countryWorldRuntime: params.countryWorldRuntime,
    progressionRuntime: params.progressionRuntime,
    modifierRuntime: params.modifierRuntime,
    uiNotificationRuntime: params.uiNotificationRuntime,
    worldDeltaBroadcastRuntime: params.worldDeltaBroadcastRuntime,
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
    contentLibraryRuntime: params.contentLibraryRuntime,
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
      provinceOwner: WORLD_DELTA_MASK.provinceOwner,
      regionOwner: WORLD_DELTA_MASK.regionOwner,
      regionController: WORLD_DELTA_MASK.regionController,
      regionColonizationByRegion: WORLD_DELTA_MASK.regionColonizationByRegion,
      regionPopulationByRegion: WORLD_DELTA_MASK.regionPopulationByRegion,
      provinceNameById: WORLD_DELTA_MASK.provinceNameById,
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
    worldPopulationRuntime: params.worldPopulationRuntime,
    countryWorldRuntime: params.countryWorldRuntime,
    worldDeltaBroadcastRuntime: params.worldDeltaBroadcastRuntime,
    getActiveColonizeRegionIds: params.getActiveColonizeRegionIds,
    getQueuedColonizeRegionIds: params.getQueuedColonizeRegionIds,
    getProvinceRenameDucatsCost: params.getProvinceRenameDucatsCost,
    savePersistentState: params.savePersistentState,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });
}
