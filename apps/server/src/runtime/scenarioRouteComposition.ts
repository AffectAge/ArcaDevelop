import type express from "express";
import type { EventLogEntry, WorldBase, WsOutMessage } from "@arcanorum/shared";
import type { RouteAuth } from "../security/routeAuth";
import type { FoundScenario } from "../scenarios/scenarioCatalog";
import type { ScenarioDefines } from "../scenarios/scenarioDefinesLoader";
import type { ScenarioHistory } from "../scenarios/scenarioHistoryLoader";
import type { GameSettings } from "./gameSettingsTypes";
import { registerScenarioApplyRoute } from "./scenarioApplyRoute";

type ScenarioApplyDeps = Parameters<typeof registerScenarioApplyRoute>[0];

type ScenarioRouteCompositionParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  findScenario: (scenarioId: string) => FoundScenario | null;
  mapRuntime: {
    applyMapRuntime: ScenarioApplyDeps["applyMapRuntime"];
  };
  loadScenarioHistory: (scenarioDir: string) => ScenarioHistory | null;
  applyScenarioCountryMetadata: ScenarioApplyDeps["applyScenarioCountryMetadata"];
  loadScenarioContent: (scenarioDir: string) => GameSettings["content"] | null;
  loadScenarioDefines: (scenarioDir: string) => ScenarioDefines | null;
  applyScenarioDefines: ScenarioApplyDeps["applyScenarioDefines"];
  getGameSettings: () => GameSettings;
  setGameSettings: (settings: GameSettings) => void;
  setTurnId: (turnId: number) => void;
  setActiveScenario: (scenario: { id: string; name: string }) => void;
  clearTurnState: () => void;
  clearColonizationQueues: () => void;
  clearWorldDeltaHistory: () => void;
  resetTurnTimerAnchor: () => void;
  buildWorldBaseFromScenario: ScenarioApplyDeps["buildWorldBaseFromScenario"];
  setWorldBase: (worldBase: WorldBase) => void;
  colonizationRuntime: {
    rebuildActiveColonizationIndexFromWorldBase: () => void;
  };
  turnOrderRuntime: {
    rebuildTurnOrderIndexes: () => void;
  };
  countryWorldRuntime: {
    rebuildEconomyTickCountryIndexFromWorldBase: () => void;
  };
  marketRuntimeFacade: {
    ensureMarketModelReady: () => void;
  };
  worldDeltaBroadcastRuntime: {
    resetWsDeltaSizeMetrics: () => void;
  };
  pushAdminAuditLog: ScenarioApplyDeps["pushAdminAuditLog"];
  incrementWorldStateVersion: () => number;
  savePersistentState: () => void;
  flushPersistentStateNow: () => Promise<void>;
  makeOfficialNews: (params: {
    turn: number;
    category: EventLogEntry["category"];
    title: string;
    message: string;
    countryId?: string | null;
    priority?: EventLogEntry["priority"];
    visibility?: EventLogEntry["visibility"];
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
  logError: ScenarioApplyDeps["logError"];
};

export function registerScenarioRouteComposition(params: ScenarioRouteCompositionParams): void {
  registerScenarioApplyRoute({
    app: params.app,
    routeAuth: params.routeAuth,
    findScenario: params.findScenario,
    applyMapRuntime: params.mapRuntime.applyMapRuntime,
    loadScenarioHistory: params.loadScenarioHistory,
    applyScenarioCountryMetadata: params.applyScenarioCountryMetadata,
    loadScenarioContent: params.loadScenarioContent,
    loadScenarioDefines: params.loadScenarioDefines,
    applyScenarioDefines: params.applyScenarioDefines,
    getGameSettings: params.getGameSettings,
    setGameSettings: params.setGameSettings,
    setTurnId: params.setTurnId,
    setActiveScenario: params.setActiveScenario,
    clearTurnState: params.clearTurnState,
    clearColonizationQueues: params.clearColonizationQueues,
    clearWorldDeltaHistory: params.clearWorldDeltaHistory,
    resetWsDeltaSizeMetrics: params.worldDeltaBroadcastRuntime.resetWsDeltaSizeMetrics,
    resetTurnTimerAnchor: params.resetTurnTimerAnchor,
    buildWorldBaseFromScenario: params.buildWorldBaseFromScenario,
    setWorldBase: params.setWorldBase,
    rebuildActiveColonizationIndexFromWorldBase: params.colonizationRuntime.rebuildActiveColonizationIndexFromWorldBase,
    rebuildTurnOrderIndexes: params.turnOrderRuntime.rebuildTurnOrderIndexes,
    rebuildEconomyTickCountryIndexFromWorldBase: params.countryWorldRuntime.rebuildEconomyTickCountryIndexFromWorldBase,
    ensureMarketModelReady: params.marketRuntimeFacade.ensureMarketModelReady,
    pushAdminAuditLog: params.pushAdminAuditLog,
    incrementWorldStateVersion: params.incrementWorldStateVersion,
    savePersistentState: params.savePersistentState,
    flushPersistentStateNow: params.flushPersistentStateNow,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
    logError: params.logError,
  });
}
