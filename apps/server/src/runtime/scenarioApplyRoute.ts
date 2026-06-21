import type express from "express";
import type { EventLogEntry, WorldBase, WsOutMessage } from "@arcanorum/shared";
import type { RouteAuth } from "../security/routeAuth";
import { normalizeScenarioId } from "../scenarios/runtimePaths";
import type { FoundScenario } from "../scenarios/scenarioCatalog";
import type { ScenarioDefines } from "../scenarios/scenarioDefinesLoader";
import type { ScenarioHistory } from "../scenarios/scenarioHistoryLoader";
import type { GameSettings } from "./gameSettingsTypes";

type ScenarioApplyRouteParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  findScenario: (scenarioId: string) => FoundScenario | null;
  applyMapRuntime: (mapRoot: string, provinceIndexPath: string) => void;
  loadScenarioHistory: (scenarioDir: string) => ScenarioHistory | null;
  applyScenarioCountryMetadata: (scenarioDir: string, history: ScenarioHistory | null) => Promise<void>;
  loadScenarioContent: (scenarioDir: string) => GameSettings["content"] | null;
  loadScenarioDefines: (scenarioDir: string) => ScenarioDefines | null;
  applyScenarioDefines: (settings: GameSettings, defines: ScenarioDefines | null) => GameSettings;
  getGameSettings: () => GameSettings;
  setGameSettings: (settings: GameSettings) => void;
  setTurnId: (turnId: number) => void;
  setActiveScenario: (params: { id: string; name: string }) => void;
  clearTurnState: () => void;
  clearColonizationQueues: () => void;
  clearWorldDeltaHistory: () => void;
  resetWsDeltaSizeMetrics: () => void;
  resetTurnTimerAnchor: () => void;
  buildWorldBaseFromScenario: (
    currentTurnId: number,
    scenarioDir: string | null,
    loadedHistory?: ScenarioHistory | null,
  ) => WorldBase;
  setWorldBase: (worldBase: WorldBase) => void;
  rebuildActiveColonizationIndexFromWorldBase: () => void;
  rebuildTurnOrderIndexes: () => void;
  rebuildEconomyTickCountryIndexFromWorldBase: () => void;
  ensureMarketModelReady: () => void;
  pushAdminAuditLog: (entry: {
    actorCountryId: string;
    action: "scenario.apply";
    targetType: "scenario";
    targetId: string;
    metadata: Record<string, unknown>;
  }) => { id: string };
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
  logError: (message: string, error: unknown) => void;
};

export function registerScenarioApplyRoute(params: ScenarioApplyRouteParams): void {
  params.app.post("/admin/scenarios/:scenarioId/apply", async (req, res) => {
    const auth = await params.routeAuth.requireAdmin(req, res);
    if (!auth) return;

    const scenarioId = normalizeScenarioId(req.params.scenarioId);
    if (!scenarioId) {
      return res.status(400).json({ error: "INVALID_SCENARIO_ID" });
    }
    const scenario = params.findScenario(scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: "SCENARIO_NOT_FOUND" });
    }

    try {
      params.applyMapRuntime(scenario.mapRoot, scenario.provinceIndexPath);
      const scenarioHistory = params.loadScenarioHistory(scenario.scenarioDir);
      await params.applyScenarioCountryMetadata(scenario.scenarioDir, scenarioHistory);
      const scenarioContent = params.loadScenarioContent(scenario.scenarioDir);
      if (scenarioContent) {
        const settings = params.getGameSettings();
        settings.content = scenarioContent;
        params.setGameSettings(settings);
      }
      params.setGameSettings(
        params.applyScenarioDefines(params.getGameSettings(), params.loadScenarioDefines(scenario.scenarioDir)),
      );

      const startTurn =
        typeof scenario.manifest.startTurn === "number" && Number.isFinite(scenario.manifest.startTurn)
          ? Math.max(1, Math.floor(scenario.manifest.startTurn))
          : 1;
      params.setTurnId(startTurn);
      params.setActiveScenario({ id: scenario.descriptor.id, name: scenario.descriptor.name });
      params.clearTurnState();
      params.clearColonizationQueues();
      params.clearWorldDeltaHistory();
      params.resetWsDeltaSizeMetrics();
      params.resetTurnTimerAnchor();
      const worldBase = params.buildWorldBaseFromScenario(startTurn, scenario.scenarioDir, scenarioHistory);
      params.setWorldBase(worldBase);
      params.rebuildActiveColonizationIndexFromWorldBase();
      params.rebuildTurnOrderIndexes();
      params.rebuildEconomyTickCountryIndexFromWorldBase();
      params.ensureMarketModelReady();
      const auditEntry = params.pushAdminAuditLog({
        actorCountryId: auth.countryId,
        action: "scenario.apply",
        targetType: "scenario",
        targetId: scenario.descriptor.id,
        metadata: {
          scenarioName: scenario.descriptor.name,
          startTurn,
          countryCount: Object.keys(worldBase.resourcesByCountry).length,
          provinceOwnerCount: Object.keys(worldBase.provinceOwner).length,
        },
      });
      const worldStateVersion = params.incrementWorldStateVersion();
      params.savePersistentState();
      await params.flushPersistentStateNow();

      params.broadcast({
        type: "SCENARIO_APPLIED",
        scenarioId: scenario.descriptor.id,
        scenarioName: scenario.descriptor.name,
        turnId: startTurn,
        worldStateVersion,
      });
      params.broadcast({
        type: "NEWS_EVENT",
        event: params.makeOfficialNews({
          turn: startTurn,
          category: "system",
          title: "Сценарий применён",
          message: `Администратор начал новую игру: ${scenario.descriptor.name}`,
          countryId: auth.countryId,
          priority: "high",
          visibility: "public",
        }),
      });
      return res.json({
        ok: true,
        activeScenarioId: scenario.descriptor.id,
        scenarioName: scenario.descriptor.name,
        turnId: startTurn,
        worldStateVersion,
        auditEntryId: auditEntry.id,
        reloadRequired: true,
      });
    } catch (error) {
      params.logError(`[scenario] Failed to apply scenario ${scenarioId}:`, error);
      return res.status(400).json({ error: "SCENARIO_APPLY_FAILED" });
    }
  });
}
