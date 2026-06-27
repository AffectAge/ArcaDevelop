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
import { getGlobalBuildLimit } from "./mechanics/buildingMechanics";
import { createModifierRuntime } from "./runtime/modifierRuntime";
import { createUiNotificationRuntime } from "./runtime/uiNotificationRuntime";
import { createTurnRuntime, TURN_RESOLVE_WORLD_DELTA_MASK } from "./runtime/turnRuntime";
import { createPersistedStateRestoreRuntime } from "./runtime/persistedStateRestoreRuntime";
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
import { createResourceLedgerRuntime } from "./runtime/resourceLedgerRuntime";
import { round3 } from "./runtime/numberRuntime";
import { makeOfficialNews } from "./runtime/officialNewsRuntime";
import { buildAiControlledCountryIdsFromHistory, loadScenarioHistory } from "./scenarios/scenarioHistoryLoader";
import { DEFAULT_SCENARIO_ID, ensureDefaultScenario } from "./scenarios/defaultScenarioBootstrap";
import {
  buildRegionAdjacencyByIdFromHexes,
  selectAiColonizationCandidates,
} from "./ai/aiColonizationCandidates";
import { selectAiEconomyOrderCandidates } from "./ai/aiEconomyCandidates";
import { runAiOrderRuntimeCycleWithRuntimeSubmitter } from "./runtime/aiRuntimeCoordinator";
import type { AiRuntimeCandidateProvider } from "./ai/aiRuntimePlanner";
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
import { normalizeHexIdList } from "./runtime/marketSettingsNormalizers";
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
  type ResourceId,
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
const defaultScenarioBootstrap = ensureDefaultScenario({ dataRoot });
let activeScenarioId = DEFAULT_SCENARIO_ID;
let activeScenarioName = "Default";
setActiveUploadScenario({ dataRoot, scenarioId: activeScenarioId });
ensureUploadDirectories();
const mapRuntime = createMapRuntimeState(
  defaultScenarioBootstrap.mapRoot,
  defaultScenarioBootstrap.hexIndexPath,
);

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
  getHexIndex: mapRuntime.getHexIndex,
  getHexAreaById: mapRuntime.getHexAreaById,
  getActiveColonizeRegionsByCountry: () => turnStateRuntime.activeColonizeRegionsByCountry,
  getOrdersByTurn: () => turnStateRuntime.ordersByTurn,
  getTurnOrderIndexes: () => turnStateRuntime.turnOrderIndexes,
});

const { marketAccessRuntime, marketRuntimeFacade } = createMarketSystemsRuntime({
  prisma,
  getGameSettings: () => gameSettings,
  getWorldBase: () => worldBase,
  getTurnId: () => turnId,
  getHexIndex: mapRuntime.getHexIndex,
  getHexOwner: (hexId) => worldBase.hexOwner[hexId] ?? null,
  corridorLoadHistoryLength: CORRIDOR_LOAD_HISTORY_LENGTH,
  removeUploadedByUrl,
  round3,
});
let resourceLedgerRuntime!: ReturnType<typeof createResourceLedgerRuntime>;
const { worldPopulationRuntime } = createPopulationSystemsRuntime({
  getGameSettings: () => gameSettings,
  getWorldBase: () => worldBase,
  getTurnId: () => turnId,
  getHexIndex: mapRuntime.getHexIndex,
  getHexAreaKm2: colonizationRuntime.getHexAreaKm2,
  getHexOwner: (hexId) => worldBase.hexOwner[hexId] ?? null,
  marketPriceRuntimeState,
  getActiveCountryModifierRows: modifierFacade.getActiveCountryModifierRows,
  ensureCountryParliament: (countryId) => progressionRuntime.ensureCountryParliament(countryId),
  ensureCountryInWorldBase: (countryId) => countryWorldRuntime.ensureCountryInWorldBase(countryId),
  createDefaultMarketRecord: marketRuntimeFacade.createDefaultMarketRecord,
  getBuildingMaxDurability: (building) => buildingRuntime.getBuildingMaxDurability(building),
  getBuildingPollutionProductivityFactor: (building, hexId) =>
    buildingRuntime.getBuildingPollutionProductivityFactor(building, hexId),
  getCountryMarketId: marketRuntimeFacade.getCountryMarketId,
  getInfrastructureTransitAgreementAllowedCountries: marketAccessRuntime.getInfrastructureTransitAgreementAllowedCountries,
  getMarketById: marketRuntimeFacade.getMarketById,
  getHexFertilityMultiplier: (hexId) => buildingRuntime.getHexFertilityMultiplier(hexId),
  getTransportCorridorCapacity: marketAccessRuntime.getTransportCorridorCapacity,
  normalizeHexIdList,
  resolveModifiedValue: modifierFacade.resolveModifiedValue,
  round3,
  addResourceLedgerExpense: (input) => resourceLedgerRuntime.addExpense(input),
  flushResourceLedger: () => resourceLedgerRuntime.flushTurn(),
  buildingBaseThroughput: BUILDING_BASE_THROUGHPUT,
  buildingBaseWagePerWorkerGold: BUILDING_BASE_WAGE_PER_WORKER_GOLD,
  buildingDurabilityDecayPerTurnFallback: DEFAULT_BUILDING_DURABILITY_DECAY_PER_TURN,
  buildingDurabilityRecoveryPerTurnFallback: DEFAULT_BUILDING_DURABILITY_RECOVERY_PER_TURN,
  corridorLoadHistoryLength: CORRIDOR_LOAD_HISTORY_LENGTH,
  defaultMarketPriceSmoothing: DEFAULT_MARKET_PRICE_SMOOTHING,
});

let aiControlledCountryIds = new Set<string>();

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
  getActiveScenarioId: () => activeScenarioId,
  getGameSettings: () => gameSettings,
  getAiControlledCountryIds: () => new Set(aiControlledCountryIds),
  getCountryResources: (countryId) => worldBase.resourcesByCountry[countryId] ?? null,
  getCountryResourceNetByTurn: (countryId) => {
    const latestTurnId = Math.max(0, ...Object.keys(worldBase.resourceLedgerByTurn ?? {}).map((turn) => Number(turn)).filter(Number.isFinite));
    const netByResource: Partial<Record<ResourceId, number>> = {};
    for (const flow of worldBase.resourceLedgerByTurn?.[latestTurnId] ?? []) {
      if (flow.countryId !== countryId) continue;
      const signedAmount = flow.direction === "expense" ? -flow.amount : flow.amount;
      netByResource[flow.resourceId] = (netByResource[flow.resourceId] ?? 0) + signedAmount;
    }
    return netByResource;
  },
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
  worldPopulationRuntime,
});

let gameSettings: GameSettings = defaultGameSettings();
let worldBase: WorldBase = defaultWorldBase(turnId);
resourceLedgerRuntime = createResourceLedgerRuntime({
  getWorldBase: () => worldBase,
  getTurnId: () => turnId,
  getRetentionTurns: () => gameSettings.resourceLedger.retentionTurns,
  getMaxEntriesPerTurn: () => gameSettings.resourceLedger.maxEntriesPerTurn,
});
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
  defaultWorldBase,
  addEconomyTickCountry: (countryId) => economyTickCountryIds.add(countryId),
  setAiControlledCountryIds: (countryIds) => {
    aiControlledCountryIds = new Set(countryIds);
  },
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

const defaultScenarioHistory = loadScenarioHistory(defaultScenarioBootstrap.scenarioDir);
worldBase = scenarioServerRuntime.buildWorldBaseFromScenario(
  turnId,
  defaultScenarioBootstrap.scenarioDir,
  defaultScenarioHistory,
);

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
  resetMapRuntimeToDefault: () => {
    mapRuntime.applyMapRuntime(defaultScenarioBootstrap.mapRoot, defaultScenarioBootstrap.hexIndexPath);
  },
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
  normalizeResourceLedgerByTurn: worldStateNormalizerRuntime.normalizeResourceLedgerByTurn,
  normalizeExplanationRecordsByTurn: worldStateNormalizerRuntime.normalizeExplanationRecordsByTurn,
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
  normalizeScheduledCountryEventsMap: worldStateNormalizerRuntime.normalizeScheduledCountryEventsMap,
  normalizeCountryEventFlagsMap: worldStateNormalizerRuntime.normalizeCountryEventFlagsMap,
  normalizeJournalEntriesMap: worldStateNormalizerRuntime.normalizeJournalEntriesMap,
  normalizeCountryModifiersMap: worldStateNormalizerRuntime.normalizeCountryModifiersMap,
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
  countryHasModifier: (countryId, modifierId) =>
    modifierFacade
      .getActiveCountryModifierRows(countryId)
      .some((row) => row.sourceId === modifierId || row.id === modifierId || row.id.endsWith(`:${modifierId}`)),
  resolveModifiedValue: modifierFacade.resolveModifiedValue,
  addResourceLedgerIncome: resourceLedgerRuntime.addIncome,
  addResourceLedgerExpense: resourceLedgerRuntime.addExpense,
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
  getHexById: mapRuntime.getHexById,
  ensureCountryInWorldBase: countryWorldRuntime.ensureCountryInWorldBase,
  addResourceLedgerExpense: resourceLedgerRuntime.addExpense,
});

const turnMechanicsAdapterRuntime = createTurnMechanicsAdapterRuntime({
  getWorldBase: () => worldBase,
  getGameSettings: () => gameSettings,
  getTurnId: () => turnId,
  getHexIndex: mapRuntime.getHexIndex,
  getHexAreaKm2: colonizationRuntime.getHexAreaKm2,
  ensureMarketModelReady: marketRuntimeFacade.ensureMarketModelReady,
  areHexIdsAdjacentOrSame: marketAccessRuntime.areHexIdsAdjacentOrSame,
  addResourceLedgerExpense: resourceLedgerRuntime.addExpense,
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
  getHexIndex: mapRuntime.getHexIndex,
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
  runAiTurnBeforeResolve: async ({ aiSettings }) => {
    const countryIds = [...aiControlledCountryIds].filter((countryId) => worldBase.resourcesByCountry[countryId]);
    if (countryIds.length === 0) return;
    await runAiOrderRuntimeCycleWithRuntimeSubmitter({
      world: worldBase,
      aiSettings,
      countryIds,
      candidateProviders: createAiRuntimeCandidateProviders(),
      runtimeParams: {
        wsServer: wss,
        onlinePlayers: sessionStateRuntime.onlinePlayers,
        getWorldBase: () => worldBase,
        getGameSettings: () => gameSettings,
        getTurnId: () => turnId,
        getWorldStateVersion: () => worldStateVersion,
        getOrdersByTurn: () => turnStateRuntime.ordersByTurn,
        getQueuedColonizeRegionsByCountryByTurn: () => turnStateRuntime.queuedColonizeRegionsByCountryByTurn,
        getActiveColonizeRegionsByCountry: () => turnStateRuntime.activeColonizeRegionsByCountry,
        parseAuthToken,
        findCountryForAuth: (countryId) =>
          prisma.country.findUnique({
            where: { id: countryId },
            select: { id: true, isAdmin: true, eventLogRetentionTurns: true },
          }),
        listResolveStatusCountries: () =>
          countryRuntimeHelpers.getCachedCountryQuery({
            key: "country:resolve-status",
            loader: () =>
              prisma.country.findMany({
                select: {
                  id: true,
                  isLocked: true,
                  blockedUntilTurn: true,
                  blockedUntilAt: true,
                  ignoreUntilTurn: true,
                },
              }),
          }),
        getAiControlledCountryIds: () => new Set(aiControlledCountryIds),
        ensureCountryInWorldBase: countryWorldRuntime.ensureCountryInWorldBase,
        getLastLoginAt: (countryId) => sessionStateRuntime.lastLoginAtByCountryId.get(countryId) ?? null,
        setLastLoginAt: (countryId, timestamp) => sessionStateRuntime.lastLoginAtByCountryId.set(countryId, timestamp),
        getReplayDeltasFromVersion: worldDeltaBroadcastRuntime.getReplayDeltasFromVersion,
        sendPendingRegistrationNotificationsToAdminSocket:
          countryRuntimeHelpers.sendPendingRegistrationNotificationsToAdminSocket,
        broadcast: (message) => broadcast(wss, message),
        broadcastTurnResolveStarted: (reason) => broadcastTurnResolveStartedMessage(wss, turnId, reason),
        resolveAndBroadcastCurrentTurn: async () => false,
        cleanupExpiredPunishments: countryRuntimeHelpers.cleanupExpiredPunishments,
        getCountryBlockInfo: countryRuntimeHelpers.getCountryBlockInfo,
        getCountrySkipInfo: countryRuntimeHelpers.getCountrySkipInfo,
        getReadySetForTurn: turnSessionRuntime.getReadySetForTurn,
        savePersistentState: persistenceFacade.savePersistentState,
        addOrderToTurnIndexes: turnOrderRuntime.addOrderToTurnIndexes,
        getRegionColonizationConfig: colonizationRuntime.getRegionColonizationConfig,
        parseRequestedBuildingIdFromPayload: buildingRuntime.parseRequestedBuildingIdFromPayload,
        resolveBuildingOwnerFromPayload: buildingRuntime.resolveBuildingOwnerFromPayload,
        isCountryAllowedForBuildingWithEngine: buildingRuntime.isCountryAllowedForBuildingWithEngine,
        getHexBuildRestriction: buildingRuntime.getHexBuildRestriction,
        isBuildingUnlockedForCountry: progressionRuntime.isBuildingUnlockedForCountry,
        countBuildingOccurrences: buildingRuntime.countBuildingOccurrences,
        getCountryBuildLimit: buildingRuntime.getCountryBuildLimit,
        getGlobalBuildLimit,
        normalizeArmyMoveRoute: turnMechanicsAdapterRuntime.normalizeArmyMoveRoute,
        isContiguousArmyRoute: turnMechanicsAdapterRuntime.isContiguousArmyRoute,
      },
      onSubmissionError: (message) => console.warn("[ai] order rejected", message.code),
    });
  },
  parseRequestedBuildingIdFromPayload: buildingRuntime.parseRequestedBuildingIdFromPayload,
  resolveBuildingOwnerFromPayload: buildingRuntime.resolveBuildingOwnerFromPayload,
  isCountryAllowedForBuildingSync: buildingRuntime.isCountryAllowedForBuildingSync,
  getHexBuildRestriction: buildingRuntime.getHexBuildRestriction,
  isBuildingUnlockedForCountry: progressionRuntime.isBuildingUnlockedForCountry,
  countBuildingOccurrences: buildingRuntime.countBuildingOccurrences,
  resolveModifiedValue: modifierFacade.resolveModifiedValue,
  getRegionColonizationConfig: colonizationRuntime.getRegionColonizationConfig,
  getRegionDerivedColonizationCosts: colonizationRuntime.getRegionDerivedColonizationCosts,
  buildColonizationSettlementPopulation: worldPopulationRuntime.buildColonizationSettlementPopulation,
  areHexIdsAdjacentOrSame: marketAccessRuntime.areHexIdsAdjacentOrSame,
  enqueueBuildingAutoUpgradesTurn: buildingRuntime.enqueueBuildingAutoUpgradesTurn,
  resolveBuildingConstructionQueuesTurn: buildingRuntime.resolveBuildingConstructionQueuesTurn,
  addResourceLedgerIncome: resourceLedgerRuntime.addIncome,
  addResourceLedgerExpense: resourceLedgerRuntime.addExpense,
  flushResourceLedger: resourceLedgerRuntime.flushTurn,
  resolveResourceExplorationTurn: turnMechanicsAdapterRuntime.resolveResourceExplorationTurn,
  resolveTransportCorridorConstructionTurn: turnMechanicsAdapterRuntime.resolveTransportCorridorConstructionTurn,
  applyPerTurnTreatyMoneyTransfers: diplomacyFacade.applyPerTurnTreatyMoneyTransfers,
  rechargeDecisionCharges: progressionRuntime.rechargeDecisionCharges,
  resolveTechnologyTurn: progressionRuntime.resolveTechnologyTurn,
  autoResolveExpiredCountryEvents: progressionRuntime.autoResolveExpiredCountryEvents,
  resolveJournalEntriesTurn: progressionRuntime.resolveJournalEntriesTurn,
  maybeGenerateCountryEvents: progressionRuntime.maybeGenerateCountryEvents,
  resolvePopulationTurn: worldPopulationRuntime.resolvePopulationTurn,
  resolveParliamentTurn: progressionRuntime.resolveParliamentTurn,
  makeElectionResultsUiNotification: progressionRuntime.makeElectionResultsUiNotification,
  makeOfficialNews,
});

function createAiRuntimeCandidateProviders(): AiRuntimeCandidateProvider[] {
  const hexIndex = mapRuntime.getHexIndex();
  const regionIds = Array.from(
    new Set(hexIndex.map((hex) => hex.regionId).filter((regionId): regionId is string => Boolean(regionId))),
  ).sort();
  const regionAdjacencyById = buildRegionAdjacencyByIdFromHexes(hexIndex);

  return [
    {
      id: "colonization",
      selectCandidates: ({ context, world }) =>
        selectAiColonizationCandidates({
          context,
          world,
          regionIds,
          regionAdjacencyById,
          maxActiveColonizations: gameSettings.colonization.maxActiveColonizations,
          activeColonizeRegionIds: turnStateRuntime.activeColonizeRegionsByCountry.get(context.countryId) ?? [],
          queuedColonizeRegionIds:
            turnStateRuntime.queuedColonizeRegionsByCountryByTurn.get(turnId)?.get(context.countryId) ?? [],
          getRegionColonizationConfig: colonizationRuntime.getRegionColonizationConfig,
          getRegionDerivedColonizationCosts: colonizationRuntime.getRegionDerivedColonizationCosts,
        }),
    },
    {
      id: "economy",
      selectCandidates: ({ context, world, indexes, aiSettings }) =>
        selectAiEconomyOrderCandidates({
          context,
          world,
          indexes,
          buildings: gameSettings.content.buildings,
          maxBuildCompletionTurns: aiSettings.maxBuildCompletionTurns,
          isBuildingUnlockedForCountry: progressionRuntime.isBuildingUnlockedForCountry,
          selectBuildTargetHexId: (building, regionId, countryId) =>
            mapRuntime.getHexIndex()
              .filter((hex) => hex.regionId === regionId)
              .map((hex) => hex.id)
              .sort((left, right) => left.localeCompare(right, "en"))
              .find((hexId) => !buildingRuntime.getHexBuildRestriction(building, hexId, regionId, countryId)) ?? null,
        }),
    },
  ];
}

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
  resourceLedgerRuntime,
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
  getHexRenameDucatsCost: () => Math.max(0, Math.floor(gameSettings.customization.hexRenameDucats ?? 25)),
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
  resourceLedgerRuntime,
  parseAuthToken,
  getTurnId: () => turnId,
  getWorldStateVersion: () => worldStateVersion,
  getWorldBase: () => worldBase,
  getGameSettings: () => gameSettings,
  getAiControlledCountryIds: () => new Set(aiControlledCountryIds),
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

await scenarioServerRuntime.applyScenarioCountryMetadata(
  defaultScenarioBootstrap.scenarioDir,
  defaultScenarioHistory,
);

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
  refreshAiControlledCountryIds: () => {
    const scenario = scenarioServerRuntime.findScenario(activeScenarioId);
    const history = scenario?.scenarioDir ? loadScenarioHistory(scenario.scenarioDir) : null;
    aiControlledCountryIds = new Set(buildAiControlledCountryIdsFromHistory(history));
  },
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
