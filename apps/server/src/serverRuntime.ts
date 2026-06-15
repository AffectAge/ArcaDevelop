import { PrismaClient } from "@prisma/client";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { AdminAuditLogStore } from "./security/adminAuditLog";
import { createAuthHeaderParser, createAuthTokenParser } from "./security/authHeader";
import { createAdminCountryChecker } from "./security/adminPermissions";
import { createRouteAuth } from "./security/routeAuth";
import { createServerApp } from "./app/createServerApp";
import { uploadErrorMiddleware } from "./app/uploadErrorMiddleware";
import { normalizeRegionColonizationMap } from "./mechanics/colonizationMechanics";
import { createModifierRuntime } from "./runtime/modifierRuntime";
import { createUiNotificationRuntime } from "./runtime/uiNotificationRuntime";
import { createTurnRuntime, TURN_RESOLVE_WORLD_DELTA_MASK } from "./runtime/turnRuntime";
import { createPersistedStateRestoreRuntime } from "./runtime/persistedStateRestoreRuntime";
import { createContentLibraryRuntime } from "./runtime/contentLibraryRuntime";
import { createColonizationRuntimeFacade } from "./runtime/colonizationRuntimeFacade";
import {
  cloneWorldBaseSectionSnapshot as cloneWorldBaseSectionSnapshotInRuntime,
  type WorldBaseSectionSnapshot,
} from "./runtime/worldDeltaDiff";
import {
  clearWorldDeltaHistory,
  createEmptyWsDeltaSizeMetrics,
  replaceWorldDeltaHistory,
  type WsDeltaSizeMetrics,
} from "./runtime/worldDeltaRuntime";
import { createWorldDeltaBroadcastRuntime } from "./runtime/worldDeltaBroadcastRuntime";
import { createCountrySystemsRuntime } from "./runtime/countrySystemsRuntime";
import { createMapRuntimeState } from "./runtime/mapRuntimeState";
import { createCountryRuntimeHelpers, countrySelect } from "./runtime/countryRuntimeHelpers";
import { createGameStatePersistenceRuntime } from "./runtime/gameStatePersistenceRuntime";
import { createTurnOrderRuntimeFacade } from "./runtime/turnOrderRuntimeFacade";
import { createTurnMechanicsAdapterRuntime } from "./runtime/turnMechanicsAdapterRuntime";
import { createTurnSessionRuntime } from "./runtime/turnSessionRuntime";
import { createContentCatalogRuntime } from "./runtime/contentCatalogRuntime";
import { createBuildingSystemsRuntime } from "./runtime/buildingSystemsRuntime";
import { createServerEnvironmentRuntime } from "./runtime/serverEnvironmentRuntime";
import { registerServerAdminSettingsRouteRuntime } from "./runtime/serverAdminSettingsRouteRuntime";
import { createServerDefaultStateRuntime } from "./runtime/serverDefaultStateRuntime";
import { createServerModifierFacadeRuntime } from "./runtime/serverModifierFacadeRuntime";
import { createServerPersistenceFacadeRuntime } from "./runtime/serverPersistenceFacadeRuntime";
import { connectOptionalRedis } from "./runtime/serverRedisRuntime";
import { createServerSessionStateRuntime } from "./runtime/serverSessionStateRuntime";
import { createServerTurnStateRuntime } from "./runtime/serverTurnStateRuntime";
import { round3 } from "./runtime/numberRuntime";
import { makeOfficialNews } from "./runtime/officialNewsRuntime";
import { createScenarioServerRuntime } from "./runtime/scenarioServerRuntime";
import { registerServerCoreRouteRuntime } from "./runtime/serverCoreRouteRegistrationRuntime";
import { registerServerInteractiveRouteRuntime } from "./runtime/serverInteractiveRouteRegistrationRuntime";
import { registerServerMainRouteRuntime } from "./runtime/serverMainRouteRegistrationRuntime";
import { startServerRuntime } from "./runtime/serverStartupRuntime";
import { createUploadStartupCleanupRuntime } from "./runtime/uploadStartupCleanupRuntime";
import { createServerDiplomacyFacadeRuntime } from "./runtime/serverDiplomacyFacadeRuntime";
import {
  broadcast,
  broadcastTurnResolveStarted as broadcastTurnResolveStartedMessage,
} from "./runtime/websocketBroadcastRuntime";
import {
  BUILDING_BASE_THROUGHPUT,
  BUILDING_BASE_WAGE_PER_WORKER_GOLD,
  CORRIDOR_LOAD_HISTORY_LENGTH,
  DEFAULT_BUILDING_DURABILITY_DECAY_PER_TURN,
  DEFAULT_BUILDING_DURABILITY_RECOVERY_PER_TURN,
  DEFAULT_MARKET_PRICE_SMOOTHING,
  MAX_PERSISTED_WORLD_DELTA_LOG,
  MAX_WORLD_DELTA_HISTORY,
  PERSIST_STATE_DEBOUNCE_MS,
  WORLD_DELTA_LOG_PRUNE_INTERVAL_MS,
} from "./runtime/serverRuntimeConfig";
import {
  DEFAULT_BATTALIONS,
} from "./content/contentNormalizers";
import type { GameSettings } from "./runtime/gameSettingsTypes";
import { normalizeProvinceIdList } from "./runtime/marketSettingsNormalizers";
import { createMarketSystemsRuntime } from "./runtime/marketSystemsRuntime";
import { createMilitaryRuntimeFacade } from "./runtime/militaryRuntimeFacade";
import { createMarketPriceRuntimeState } from "./runtime/marketPriceRuntimeState";
import { createPopulationSystemsRuntime } from "./runtime/populationSystemsRuntime";
import { createWorldStateNormalizerRuntime } from "./runtime/worldStateNormalizerRuntime";
import {
  ensureUploadDirectories,
  getActiveScenarioUploadsRoot,
  setActiveUploadScenario,
} from "./uploads/uploadPaths";
import { upload } from "./uploads/uploadMiddleware";
import {
  makeVersionedUploadUrl,
  removeUploadedByUrl,
  removeUploadedFile,
  removeUploadedFiles,
  validateImageDimensions,
  validateImageRule,
} from "./uploads/uploadValidation";
import {
  type WorldBase,
  type WorldDelta,
} from "@arcanorum/shared";

const env = createServerEnvironmentRuntime(import.meta.url);

const prisma = new PrismaClient();

const parseAuthHeader = createAuthHeaderParser(env.jwtSecret);
const parseAuthToken = createAuthTokenParser(env.jwtSecret);
const isAdminCountry = createAdminCountryChecker({
  findCountryAdminState: async (countryId) =>
    prisma.country.findUnique({
      where: { id: countryId },
      select: { isAdmin: true },
    }),
});
const routeAuth = createRouteAuth({ parseAuthHeader, isAdminCountry });

const dataRoot = env.dataRoot;
let activeScenarioId = "active";
let activeScenarioName = "Текущая игра";
setActiveUploadScenario({ dataRoot, scenarioId: activeScenarioId });
ensureUploadDirectories();
const mapRuntime = createMapRuntimeState(dataRoot);

const app = createServerApp({ dataRoot });

let turnId = 1;
let worldStateVersion = 1;
const wsDeltaSizeMetrics: WsDeltaSizeMetrics = createEmptyWsDeltaSizeMetrics();
const worldDeltaHistory: WorldDelta[] = [];
const { persistentStateRuntimeRef, persistenceFacade } = createServerPersistenceFacadeRuntime();
const { modifierRuntimeRef, getModifierRuntime, modifierFacade } = createServerModifierFacadeRuntime();
const contentCatalogRuntime = createContentCatalogRuntime({
  getGameSettings: () => gameSettings,
});
const worldDeltaBroadcastRuntime = createWorldDeltaBroadcastRuntime({
  getWorldBase: () => worldBase,
  getTurnId: () => turnId,
  getWorldStateVersion: () => worldStateVersion,
  setWorldStateVersion: (version) => {
    worldStateVersion = version;
  },
  getHistory: () => worldDeltaHistory,
  getMetrics: () => wsDeltaSizeMetrics,
  maxHistory: MAX_WORLD_DELTA_HISTORY,
  cloneWorldBaseSectionSnapshot: cloneWorldBaseSectionSnapshotInRuntime,
  saveWorldDeltaPersistent: persistenceFacade.saveWorldDeltaPersistent,
  broadcast: (message) => broadcast(wss, message),
  isEqualRegionPopulation: (prevValue, nextValue) =>
    worldPopulationRuntime.isEqualRegionPopulation(prevValue, nextValue),
});
const countryRuntimeHelpers = createCountryRuntimeHelpers({
  prisma,
  getCountryMarketId: (countryId) => marketRuntimeFacade.getCountryMarketId(countryId),
  sendPendingNotificationsToSocket: (socket, notifications, audience, viewerCountryId) =>
    uiNotificationRuntime.sendPendingNotificationsToSocket(socket, notifications, audience, viewerCountryId),
});
const worldStateNormalizerRuntime = createWorldStateNormalizerRuntime({
  getTurnId: () => turnId,
  getGameSettings: () => gameSettings,
});

const sessionStateRuntime = createServerSessionStateRuntime();
const uiNotificationRuntime = createUiNotificationRuntime({
  getWorldBase: () => worldBase,
  enqueue: (notification, audience) => sessionStateRuntime.uiNotificationQueue.enqueue(notification, audience),
  remove: (notificationId) => sessionStateRuntime.uiNotificationQueue.remove(notificationId),
  isVisibleForCountry: (item, params) => sessionStateRuntime.uiNotificationQueue.isVisibleForCountry(item, params),
  findQueued: (notificationId) => sessionStateRuntime.uiNotificationQueue.find(notificationId),
  normalizeCountryEventRecord: worldStateNormalizerRuntime.normalizeCountryEventRecord,
  broadcast,
});
const turnStateRuntime = createServerTurnStateRuntime();
const turnOrderRuntime = createTurnOrderRuntimeFacade({
  getTurnOrderIndexes: () => turnStateRuntime.turnOrderIndexes,
  getOrdersByTurn: () => turnStateRuntime.ordersByTurn,
});
const turnSessionRuntime = createTurnSessionRuntime({ resolveReadyByTurn: turnStateRuntime.resolveReadyByTurn });
const economyTickCountryIds = new Set<string>();
const marketPriceRuntimeState = createMarketPriceRuntimeState();

const colonizationRuntime = createColonizationRuntimeFacade({
  getWorldBase: () => worldBase,
  getTurnId: () => turnId,
  getColonizationRates: () => gameSettings.colonization,
  getProvinceIndex: mapRuntime.getProvinceIndex,
  getProvinceAreaById: mapRuntime.getProvinceAreaById,
  getActiveColonizeRegionsByCountry: () => turnStateRuntime.activeColonizeRegionsByCountry,
  getOrdersByTurn: () => turnStateRuntime.ordersByTurn,
  getTurnOrderIndexes: () => turnStateRuntime.turnOrderIndexes,
});

const { marketAccessRuntime, marketRuntimeFacade } = createMarketSystemsRuntime({
  prisma,
  getGameSettings: () => gameSettings,
  getWorldBase: () => worldBase,
  getTurnId: () => turnId,
  getProvinceIndex: mapRuntime.getProvinceIndex,
  getProvinceOwner: (provinceId) => worldBase.provinceOwner[provinceId] ?? null,
  corridorLoadHistoryLength: CORRIDOR_LOAD_HISTORY_LENGTH,
  removeUploadedByUrl,
  round3,
});
const { worldPopulationRuntime } = createPopulationSystemsRuntime({
  getGameSettings: () => gameSettings,
  getWorldBase: () => worldBase,
  getTurnId: () => turnId,
  getProvinceIndex: mapRuntime.getProvinceIndex,
  getProvinceAreaKm2: colonizationRuntime.getProvinceAreaKm2,
  getProvinceOwner: (provinceId) => worldBase.provinceOwner[provinceId] ?? null,
  marketPriceRuntimeState,
  getActiveCountryModifierRows: modifierFacade.getActiveCountryModifierRows,
  ensureCountryParliament: (countryId) => progressionRuntime.ensureCountryParliament(countryId),
  ensureCountryInWorldBase: (countryId) => countryWorldRuntime.ensureCountryInWorldBase(countryId),
  createDefaultMarketRecord: marketRuntimeFacade.createDefaultMarketRecord,
  getBuildingMaxDurability: (building) => buildingRuntime.getBuildingMaxDurability(building),
  getBuildingPollutionProductivityFactor: (building, provinceId) =>
    buildingRuntime.getBuildingPollutionProductivityFactor(building, provinceId),
  getCountryMarketId: marketRuntimeFacade.getCountryMarketId,
  getInfrastructureTransitAgreementAllowedCountries: marketAccessRuntime.getInfrastructureTransitAgreementAllowedCountries,
  getMarketById: marketRuntimeFacade.getMarketById,
  getProvinceFertilityMultiplier: (provinceId) => buildingRuntime.getProvinceFertilityMultiplier(provinceId),
  getTransportCorridorCapacity: marketAccessRuntime.getTransportCorridorCapacity,
  normalizeProvinceIdList,
  resolveModifiedValue: modifierFacade.resolveModifiedValue,
  round3,
  buildingBaseThroughput: BUILDING_BASE_THROUGHPUT,
  buildingBaseWagePerWorkerGold: BUILDING_BASE_WAGE_PER_WORKER_GOLD,
  buildingDurabilityDecayPerTurnFallback: DEFAULT_BUILDING_DURABILITY_DECAY_PER_TURN,
  buildingDurabilityRecoveryPerTurnFallback: DEFAULT_BUILDING_DURABILITY_RECOVERY_PER_TURN,
  corridorLoadHistoryLength: CORRIDOR_LOAD_HISTORY_LENGTH,
  defaultMarketPriceSmoothing: DEFAULT_MARKET_PRICE_SMOOTHING,
});

const persistedContentLibraryPath = env.contentLibraryPath;
const contentLibraryRuntime = createContentLibraryRuntime({
  path: persistedContentLibraryPath,
  getGameSettings: () => gameSettings,
  logError: (message, error) => console.error(message, error),
});

const militaryRuntimeFacade = createMilitaryRuntimeFacade({
  getGameSettings: () => gameSettings,
  getWorldBase: () => worldBase,
  getTurnId: () => turnId,
  defaultBattalions: DEFAULT_BATTALIONS,
});

registerServerCoreRouteRuntime({
  app,
  wsServerProvider: () => wss,
  prisma,
  routeAuth,
  isAdminCountry,
  upload,
  mapRuntime,
  worldDeltaBroadcastRuntime,
  countryRuntimeHelpers,
  sessionStateRuntime,
  uiNotificationRuntime,
  militaryRuntimeFacade,
  getServerStatus: () => env.serverStatus,
  getTurnId: () => turnId,
  getWsDeltaSizeMetrics: () => wsDeltaSizeMetrics,
  getWorldDeltaHistory: () => worldDeltaHistory,
  getWorldStateVersion: () => worldStateVersion,
  turnSessionRuntime,
  contentCatalogRuntime,
  getGameSettings: () => gameSettings,
  savePersistentState: persistenceFacade.savePersistentState,
  validateImageDimensions,
  removeUploadedFile,
  removeUploadedFiles,
  removeUploadedByUrl,
  makeVersionedUploadUrl,
  makeOfficialNews,
  broadcast: (message) => broadcast(wss, message),
});

const { defaultGameSettings, defaultWorldBase } = createServerDefaultStateRuntime({
  contentLibraryRuntime,
  worldPopulationRuntime,
});

let gameSettings: GameSettings = defaultGameSettings();
let worldBase: WorldBase = defaultWorldBase(turnId);
const adminAuditLogStore = new AdminAuditLogStore(
  () => ({ turnId, activeScenarioId }),
  () => gameSettings,
);

const scenariosRoot = env.scenariosRoot;

const scenarioServerRuntime = createScenarioServerRuntime({
  prisma,
  dataRoot,
  scenariosRoot,
  getActiveScenarioId: () => activeScenarioId,
  getPersistedContentLibrary: contentLibraryRuntime.getPersistedContentLibraryFromDisk,
  defaultWorldBase,
  addEconomyTickCountry: (countryId) => economyTickCountryIds.add(countryId),
  invalidateCountryQueryCache: countryRuntimeHelpers.invalidateCountryQueryCache,
  normalizeResourcesByCountryMap: worldStateNormalizerRuntime.normalizeResourcesByCountryMap,
  normalizeRegionColonizationMap,
  normalizeRegionPopulationMap: worldPopulationRuntime.normalizeRegionPopulationMap,
  normalizeRegionBuildingsMap: worldPopulationRuntime.normalizeRegionBuildingsMap,
  normalizeRegionBuildingDucatsMap: worldPopulationRuntime.normalizeRegionBuildingDucatsMap,
  normalizeRegionPopulationTreasuryMap: worldPopulationRuntime.normalizeRegionPopulationTreasuryMap,
  normalizeRegionConstructionQueueMap: worldPopulationRuntime.normalizeRegionConstructionQueueMap,
  normalizeRegionResourceDepositsMap: worldPopulationRuntime.normalizeRegionResourceDepositsMap,
  normalizeRegionResourceExplorationQueueMap: worldPopulationRuntime.normalizeRegionResourceExplorationQueueMap,
  normalizeRegionResourceExplorationCountMap: worldPopulationRuntime.normalizeRegionResourceExplorationCountMap,
  normalizeTechnologyByCountryMap: worldStateNormalizerRuntime.normalizeTechnologyByCountryMap,
  normalizeDiplomacyProposals: worldStateNormalizerRuntime.normalizeDiplomacyProposals,
});

const persistedStateRestoreRuntime = createPersistedStateRestoreRuntime({
  dataRoot,
  corridorLoadHistoryLength: CORRIDOR_LOAD_HISTORY_LENGTH,
  adminAuditLogStore,
  ordersByTurn: turnStateRuntime.ordersByTurn,
  resolveReadyByTurn: turnStateRuntime.resolveReadyByTurn,
  getTurnId: () => turnId,
  setTurnId: (nextTurnId) => {
    turnId = nextTurnId;
  },
  setWorldStateVersion: (nextWorldStateVersion) => {
    worldStateVersion = nextWorldStateVersion;
  },
  setActiveScenario: (scenario) => {
    activeScenarioId = scenario.id;
    activeScenarioName = scenario.name;
    setActiveUploadScenario({ dataRoot, scenarioId: scenario.id });
    ensureUploadDirectories();
  },
  applyMapRuntime: mapRuntime.applyMapRuntime,
  findScenario: scenarioServerRuntime.findScenario,
  defaultGameSettings,
  getDefaultWorldBase: defaultWorldBase,
  setGameSettings: (settings) => {
    gameSettings = settings;
  },
  setWorldBase: (nextWorldBase) => {
    worldBase = nextWorldBase;
  },
  setLatestMarketOverview: marketPriceRuntimeState.setLatestMarketOverview,
  round3,
  normalizeResourcesByCountryMap: worldStateNormalizerRuntime.normalizeResourcesByCountryMap,
  normalizeRegionColonizationMap,
  normalizeRegionPopulationMap: worldPopulationRuntime.normalizeRegionPopulationMap,
  normalizeRegionBuildingsMap: worldPopulationRuntime.normalizeRegionBuildingsMap,
  normalizeRegionBuildingDucatsMap: worldPopulationRuntime.normalizeRegionBuildingDucatsMap,
  normalizeRegionPopulationTreasuryMap: worldPopulationRuntime.normalizeRegionPopulationTreasuryMap,
  normalizeRegionConstructionQueueMap: worldPopulationRuntime.normalizeRegionConstructionQueueMap,
  normalizeRegionResourceDepositsMap: worldPopulationRuntime.normalizeRegionResourceDepositsMap,
  normalizeRegionResourceExplorationQueueMap: worldPopulationRuntime.normalizeRegionResourceExplorationQueueMap,
  normalizeRegionResourceExplorationCountMap: worldPopulationRuntime.normalizeRegionResourceExplorationCountMap,
  normalizeTechnologyByCountryMap: worldStateNormalizerRuntime.normalizeTechnologyByCountryMap,
  normalizeCountryDecisionsMap: worldStateNormalizerRuntime.normalizeCountryDecisionsMap,
  normalizeCountryEventsMap: worldStateNormalizerRuntime.normalizeCountryEventsMap,
  normalizeDivisionTemplatesByCountry: militaryRuntimeFacade.normalizeDivisionTemplatesByCountry,
  normalizeDivisionsById: militaryRuntimeFacade.normalizeDivisionsById,
  normalizeMilitaryFormationQueueByCountry: militaryRuntimeFacade.normalizeMilitaryFormationQueueByCountry,
  normalizeDiplomacyProposals: worldStateNormalizerRuntime.normalizeDiplomacyProposals,
  rebuildTurnOrderIndexes: turnOrderRuntime.rebuildTurnOrderIndexes,
  rebuildEconomyTickCountryIndexFromWorldBase: () => countryWorldRuntime.rebuildEconomyTickCountryIndexFromWorldBase(),
  ensureMarketModelReady: marketRuntimeFacade.ensureMarketModelReady,
  logError: (message, error) => console.error(message, error),
});

registerServerAdminSettingsRouteRuntime({
  app,
  routeAuth,
  auditLogStore: adminAuditLogStore,
  scenarioServerRuntime,
  worldDeltaBroadcastRuntime,
  colonizationRuntime,
  turnSessionRuntime,
  getTurnId: () => turnId,
  getActiveScenarioId: () => activeScenarioId,
  getGameSettings: () => gameSettings,
  removeUploadedByUrl,
  savePersistentState: persistenceFacade.savePersistentState,
  makeOfficialNews,
  broadcast: (message) => broadcast(wss, message),
});

persistentStateRuntimeRef.current = createGameStatePersistenceRuntime({
  prisma,
  dataRoot,
  debounceMs: PERSIST_STATE_DEBOUNCE_MS,
  maxPersistedWorldDeltaLog: MAX_PERSISTED_WORLD_DELTA_LOG,
  maxWorldDeltaHistory: MAX_WORLD_DELTA_HISTORY,
  getTurnId: () => turnId,
  getActiveScenarioId: () => activeScenarioId,
  getActiveScenarioName: () => activeScenarioName,
  getGameSettings: () => gameSettings,
  getWorldBase: () => worldBase,
  getLatestMarketOverview: marketPriceRuntimeState.getLatestMarketOverview,
  getOrdersByTurn: () => turnStateRuntime.ordersByTurn,
  getResolveReadyByTurn: () => turnStateRuntime.resolveReadyByTurn,
  getWorldStateVersion: () => worldStateVersion,
  getAdminAuditSnapshot: () => adminAuditLogStore.snapshot(),
  replaceWorldDeltaHistory: (history) => replaceWorldDeltaHistory(worldDeltaHistory, history),
  persistContentLibrary: contentLibraryRuntime.persistContentLibraryFromSettings,
  parseAndApplyPersistentState: (input) => persistedStateRestoreRuntime.parseAndApplyPersistentState(input),
  normalizeRegionManualCostFlags: colonizationRuntime.normalizeRegionManualCostFlags,
  normalizeRegionColonizationCosts: colonizationRuntime.normalizeRegionColonizationCosts,
  logInfo: (message) => console.log(message),
  logError: (message, error) => console.error(message, error),
});

connectOptionalRedis(env.redisUrl);

const { progressionRuntime, countryWorldRuntime } = createCountrySystemsRuntime({
  getWorldBase: () => worldBase,
  getGameSettings: () => gameSettings,
  getTurnId: () => turnId,
  getEconomyTickCountryIds: () => economyTickCountryIds,
  normalizeTechnologyByCountryMap: worldStateNormalizerRuntime.normalizeTechnologyByCountryMap,
  normalizeCountryDecisionRecord: worldStateNormalizerRuntime.normalizeCountryDecisionRecord,
  normalizeCountryEventRecord: worldStateNormalizerRuntime.normalizeCountryEventRecord,
  normalizeResourceTotals: worldStateNormalizerRuntime.normalizeResourceTotals,
  modifierConditionsMatchCountry: modifierFacade.modifierConditionsMatchCountry,
  resolveModifiedValue: modifierFacade.resolveModifiedValue,
  removeQueuedUiNotification: uiNotificationRuntime.removeQueuedUiNotification,
  makeOfficialNews,
  savePersistentState: persistenceFacade.savePersistentState,
});

const uploadStartupCleanupRuntime = createUploadStartupCleanupRuntime({
  prisma,
  enabled: env.autoCleanupUploadsOnStart,
  getUploadsRoot: getActiveScenarioUploadsRoot,
  getReferencedData: () => [worldBase, gameSettings],
  logger: { warn: console.warn, info: console.log, error: console.error },
});

const { buildingRuntime } = createBuildingSystemsRuntime({
  getWorldBase: () => worldBase,
  getGameSettings: () => gameSettings,
  getTurnId: () => turnId,
  getOrdersByTurn: () => turnStateRuntime.ordersByTurn,
  getProvinceById: mapRuntime.getProvinceById,
  ensureCountryInWorldBase: countryWorldRuntime.ensureCountryInWorldBase,
});

const turnMechanicsAdapterRuntime = createTurnMechanicsAdapterRuntime({
  getWorldBase: () => worldBase,
  getGameSettings: () => gameSettings,
  getTurnId: () => turnId,
  getProvinceIndex: mapRuntime.getProvinceIndex,
  getProvinceAreaKm2: colonizationRuntime.getProvinceAreaKm2,
  ensureMarketModelReady: marketRuntimeFacade.ensureMarketModelReady,
  areProvinceIdsAdjacentOrSame: marketAccessRuntime.areProvinceIdsAdjacentOrSame,
});
const { diplomacyRuntimeRef, diplomacyFacade } = createServerDiplomacyFacadeRuntime();

modifierRuntimeRef.current = createModifierRuntime({
  getWorldBase: () => worldBase,
  getGameSettings: () => gameSettings,
  ensureCountryParliament: (countryId) => progressionRuntime.ensureCountryParliament(countryId),
  isTechnologyResearched: (countryId, technologyId) => progressionRuntime.isTechnologyResearched(countryId, technologyId),
  round3,
});

const turnRuntime = createTurnRuntime({
  getWorldBase: () => worldBase,
  setWorldBase: (nextWorldBase) => {
    worldBase = nextWorldBase;
  },
  getGameSettings: () => gameSettings,
  getTurnId: () => turnId,
  setTurnId: (nextTurnId) => {
    turnId = nextTurnId;
  },
  getOrdersByTurn: () => turnStateRuntime.ordersByTurn,
  getResolveReadyByTurn: () => turnStateRuntime.resolveReadyByTurn,
  getActiveColonizeRegionsByCountry: () => turnStateRuntime.activeColonizeRegionsByCountry,
  getProvinceIndex: mapRuntime.getProvinceIndex,
  getEconomyTickCountryIds: () => economyTickCountryIds,
  fullSnapshotMask: TURN_RESOLVE_WORLD_DELTA_MASK,
  cloneWorldBaseSectionSnapshot: worldDeltaBroadcastRuntime.cloneWorldBaseSectionSnapshot,
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
    worldDeltaBroadcastRuntime.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
  broadcast: (message) => broadcast(wss, message),
  sendUiNotificationToCountry: (countryId, notification) =>
    uiNotificationRuntime.sendUiNotificationToCountry(wss, countryId, notification),
  dropTurnOrderIndexes: turnOrderRuntime.dropTurnOrderIndexes,
  flushPersistentStateNow: persistenceFacade.flushPersistentStateNow,
  resetTurnTimerAnchor: turnSessionRuntime.resetTurnTimerAnchor,
  parseRequestedBuildingIdFromPayload: buildingRuntime.parseRequestedBuildingIdFromPayload,
  resolveBuildingOwnerFromPayload: buildingRuntime.resolveBuildingOwnerFromPayload,
  isCountryAllowedForBuildingSync: buildingRuntime.isCountryAllowedForBuildingSync,
  getProvinceBuildRestriction: buildingRuntime.getProvinceBuildRestriction,
  isBuildingUnlockedForCountry: progressionRuntime.isBuildingUnlockedForCountry,
  countBuildingOccurrences: buildingRuntime.countBuildingOccurrences,
  resolveModifiedValue: modifierFacade.resolveModifiedValue,
  getRegionColonizationConfig: colonizationRuntime.getRegionColonizationConfig,
  getRegionDerivedColonizationCosts: colonizationRuntime.getRegionDerivedColonizationCosts,
  areProvinceIdsAdjacentOrSame: marketAccessRuntime.areProvinceIdsAdjacentOrSame,
  enqueueBuildingAutoUpgradesTurn: buildingRuntime.enqueueBuildingAutoUpgradesTurn,
  resolveBuildingConstructionQueuesTurn: buildingRuntime.resolveBuildingConstructionQueuesTurn,
  resolveResourceExplorationTurn: turnMechanicsAdapterRuntime.resolveResourceExplorationTurn,
  resolveTransportCorridorConstructionTurn: turnMechanicsAdapterRuntime.resolveTransportCorridorConstructionTurn,
  applyPerTurnTreatyMoneyTransfers: diplomacyFacade.applyPerTurnTreatyMoneyTransfers,
  resolveTechnologyTurn: progressionRuntime.resolveTechnologyTurn,
  autoResolveExpiredCountryEvents: progressionRuntime.autoResolveExpiredCountryEvents,
  maybeGenerateCountryEvents: progressionRuntime.maybeGenerateCountryEvents,
  resolvePopulationTurn: worldPopulationRuntime.resolvePopulationTurn,
  resolveParliamentTurn: progressionRuntime.resolveParliamentTurn,
  makeElectionResultsUiNotification: progressionRuntime.makeElectionResultsUiNotification,
  makeOfficialNews,
});

registerServerMainRouteRuntime({
  app,
  prisma,
  routeAuth,
  upload,
  countrySelect,
  mapRuntime,
  countryRuntimeHelpers,
  countryWorldRuntime,
  progressionRuntime,
  modifierRuntime: getModifierRuntime(),
  contentLibraryRuntime,
  scenarioServerRuntime,
  marketRuntimeFacade,
  marketAccessRuntime,
  marketPriceRuntimeState,
  militaryRuntimeFacade,
  colonizationRuntime,
  buildingRuntime,
  worldPopulationRuntime,
  turnOrderRuntime,
  uiNotificationRuntime,
  worldDeltaBroadcastRuntime,
  diplomacyRuntimeRef,
  refreshExpiredDiplomacyProposals: diplomacyFacade.refreshExpiredDiplomacyProposals,
  getTurnId: () => turnId,
  setTurnId: (nextTurnId) => {
    turnId = nextTurnId;
  },
  getWorldStateVersion: () => worldStateVersion,
  incrementWorldStateVersion: () => {
    worldStateVersion += 1;
    return worldStateVersion;
  },
  getWorldBase: () => worldBase,
  setWorldBase: (nextWorldBase) => {
    worldBase = nextWorldBase;
  },
  getGameSettings: () => gameSettings,
  setGameSettings: (settings) => {
    gameSettings = settings;
  },
  setActiveScenario: (scenario) => {
    activeScenarioId = scenario.id;
    activeScenarioName = scenario.name;
    setActiveUploadScenario({ dataRoot, scenarioId: scenario.id });
    ensureUploadDirectories();
  },
  clearTurnState: turnStateRuntime.clearTurnState,
  clearColonizationQueues: turnStateRuntime.clearColonizationQueues,
  clearWorldDeltaHistory: () => clearWorldDeltaHistory(worldDeltaHistory),
  resetTurnTimerAnchor: turnSessionRuntime.resetTurnTimerAnchor,
  getOrdersByTurnForTurn: (currentTurnId) => turnStateRuntime.ordersByTurn.get(currentTurnId),
  deleteOrdersForTurn: (currentTurnId) => turnStateRuntime.ordersByTurn.delete(currentTurnId),
  getActiveColonizeRegionIds: (countryId) => turnStateRuntime.activeColonizeRegionsByCountry.get(countryId) ?? [],
  getQueuedColonizeRegionIds: (currentTurnId, countryId) =>
    turnStateRuntime.queuedColonizeRegionsByCountryByTurn.get(currentTurnId)?.get(countryId) ?? [],
  getProvinceRenameDucatsCost: () => Math.max(0, Math.floor(gameSettings.customization.provinceRenameDucats ?? 25)),
  pushAdminAuditLog: (entry) => adminAuditLogStore.push(entry),
  savePersistentState: persistenceFacade.savePersistentState,
  flushPersistentStateNow: persistenceFacade.flushPersistentStateNow,
  validateImageDimensions,
  removeUploadedFile,
  removeUploadedByUrl,
  makeVersionedUploadUrl,
  makeOfficialNews,
  normalizeDiplomacyProposals: worldStateNormalizerRuntime.normalizeDiplomacyProposals,
  sendUiNotificationToCountry: (countryId, notification) =>
    uiNotificationRuntime.sendUiNotificationToCountry(wss, countryId, notification),
  broadcast: (message) => broadcast(wss, message),
  logError: (message, error) => console.error(message, error),
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

registerServerInteractiveRouteRuntime({
  app,
  wsServer: wss,
  prisma,
  routeAuth,
  upload,
  jwtSecret: env.jwtSecret,
  sessionStateRuntime,
  turnStateRuntime,
  countryRuntimeHelpers,
  countryWorldRuntime,
  progressionRuntime,
  marketRuntimeFacade,
  colonizationRuntime,
  buildingRuntime,
  turnOrderRuntime,
  turnMechanicsAdapterRuntime,
  turnSessionRuntime,
  uiNotificationRuntime,
  worldDeltaBroadcastRuntime,
  parseAuthToken,
  getTurnId: () => turnId,
  getWorldStateVersion: () => worldStateVersion,
  getWorldBase: () => worldBase,
  getGameSettings: () => gameSettings,
  pushAdminAuditLog: (entry) => adminAuditLogStore.push(entry),
  validateImageRule,
  removeUploadedFile,
  removeUploadedFiles,
  removeUploadedByUrl,
  makeVersionedUploadUrl,
  makeOfficialNews,
  broadcast: (message) => broadcast(wss, message),
  broadcastTurnResolveStarted: (reason) => broadcastTurnResolveStartedMessage(wss, turnId, reason),
  resolveAndBroadcastCurrentTurn: turnRuntime.resolveAndBroadcastCurrentTurn,
  savePersistentState: persistenceFacade.savePersistentState,
});

app.use(uploadErrorMiddleware);

startServerRuntime({
  server,
  wsServer: wss,
  prisma,
  worldDeltaLogPruneIntervalMs: WORLD_DELTA_LOG_PRUNE_INTERVAL_MS,
  getPort: () => env.port,
  getGameSettings: () => gameSettings,
  getOnlinePlayerCount: () => sessionStateRuntime.onlinePlayers.size,
  getCurrentTurnStartedAtMs: turnSessionRuntime.getCurrentTurnStartedAtMs,
  getTurnId: () => turnId,
  loadPersistentState: persistenceFacade.loadPersistentState,
  persistContentLibraryFromSettings: contentLibraryRuntime.persistContentLibraryFromSettings,
  cleanupOrphanUploadsOnServerStart: uploadStartupCleanupRuntime.cleanupOrphanUploadsOnServerStart,
  migratePersistedMarketNamesToReadable: marketRuntimeFacade.migratePersistedMarketNamesToReadable,
  savePersistentState: persistenceFacade.savePersistentState,
  rebuildTurnOrderIndexes: turnOrderRuntime.rebuildTurnOrderIndexes,
  rebuildActiveColonizationIndexFromWorldBase: colonizationRuntime.rebuildActiveColonizationIndexFromWorldBase,
  rebuildEconomyTickCountryIndexFromWorldBase: countryWorldRuntime.rebuildEconomyTickCountryIndexFromWorldBase,
  syncPersistedWorldDeltaLogWithCurrentState: persistenceFacade.syncPersistedWorldDeltaLogWithCurrentState,
  schedulePersistedWorldDeltaLogPrune: persistenceFacade.schedulePersistedWorldDeltaLogPrune,
  loadPersistedWorldDeltaHistory: persistenceFacade.loadPersistedWorldDeltaHistory,
  resetTurnTimerAnchor: turnSessionRuntime.resetTurnTimerAnchor,
  broadcastTurnResolveStarted: (wsServer, reason) => broadcastTurnResolveStartedMessage(wsServer, turnId, reason),
  resolveAndBroadcastCurrentTurn: turnRuntime.resolveAndBroadcastCurrentTurn,
  makeOfficialNews,
  broadcast,
  logError: (message, error) => console.error(message, error),
  logInfo: (message) => console.log(message),
}).catch((error) => {
  console.error("[startup] Failed to initialize server:", error);
  process.exit(1);
});
