import { randomUUID } from "node:crypto";
import type { MarketOverviewState } from "../mechanics/marketTurnMechanics";
import { normalizeMarketOverviewState as normalizeMarketOverviewStateFromMarketTurn } from "../mechanics/marketTurnMechanics";
import { restoreOrdersByTurnState, restoreResolveReadyByTurnState } from "../persistence/turnStatePersistence";
import { normalizeScenarioId } from "../scenarios/runtimePaths";
import type { FoundScenario } from "../scenarios/scenarioCatalog";
import type { ScenarioDefines } from "../scenarios/scenarioDefinesLoader";
import type { GameSettings } from "./gameSettingsTypes";
import { restorePersistedGameSettings } from "./persistedGameSettingsRestore";
import { restorePersistedWorldBase } from "./persistedWorldBaseRestore";
import type { Order, ResourceTotals, WorldBase } from "@arcanorum/shared";
import type { DiplomacyProposal } from "@arcanorum/shared";

type AdminAuditLogRestorer = {
  replaceFromPersisted: (input: unknown) => void;
};

type PersistedStateRestoreRuntimeParams = {
  dataRoot: string;
  corridorLoadHistoryLength: number;
  adminAuditLogStore: AdminAuditLogRestorer;
  ordersByTurn: Map<number, Map<string, Order[]>>;
  resolveReadyByTurn: Map<number, Set<string>>;
  getTurnId: () => number;
  setTurnId: (turnId: number) => void;
  setWorldStateVersion: (worldStateVersion: number) => void;
  setActiveScenario: (scenario: { id: string; name: string }) => void;
  applyMapRuntime: (mapRoot: string, hexIndexPath?: string) => void;
  resetMapRuntimeToDefault: () => void;
  findScenario: (scenarioId: string) => FoundScenario | null;
  loadScenarioContent: (scenarioDir: string) => GameSettings["content"] | null;
  loadScenarioDefines: (scenarioDir: string) => ScenarioDefines | null;
  applyScenarioDefines: (settings: GameSettings, defines: ScenarioDefines | null) => GameSettings;
  defaultGameSettings: () => GameSettings;
  getDefaultWorldBase: (turnId: number) => WorldBase;
  setGameSettings: (settings: GameSettings) => void;
  setWorldBase: (worldBase: WorldBase) => void;
  setLatestMarketOverview: (overview: MarketOverviewState) => void;
  round3: (value: number) => number;
  normalizeResourcesByCountryMap: (input: unknown) => Record<string, ResourceTotals>;
  normalizeResourceLedgerByTurn: (input: unknown) => WorldBase["resourceLedgerByTurn"];
  normalizeExplanationRecordsByTurn: (input: unknown) => WorldBase["explanationRecordsByTurn"];
  normalizeRegionColonizationMap: (input: unknown) => WorldBase["regionColonizationByRegion"];
  normalizeRegionPopulationMap: (input: unknown) => WorldBase["regionPopulationByRegion"];
  normalizeRegionBuildingsMap: (input: unknown) => WorldBase["regionBuildingsByRegion"];
  normalizeRegionBuildingDucatsMap: (input: unknown) => WorldBase["regionBuildingDucatsByRegion"];
  normalizeRegionPopulationTreasuryMap: (input: unknown) => WorldBase["regionPopulationTreasuryByRegion"];
  normalizeRegionConstructionQueueMap: (input: unknown) => WorldBase["regionConstructionQueueByRegion"];
  normalizeRegionResourceDepositsMap: (input: unknown) => WorldBase["regionResourceDepositsByRegion"];
  normalizeRegionResourceExplorationQueueMap: (input: unknown) => WorldBase["regionResourceExplorationQueueByRegion"];
  normalizeRegionResourceExplorationCountMap: (input: unknown) => WorldBase["regionResourceExplorationCountByRegion"];
  normalizeTechnologyByCountryMap: (input: unknown) => WorldBase["technologyByCountry"];
  normalizeCountryDecisionsMap: (input: unknown) => WorldBase["countryDecisionsByCountryId"];
  normalizeCountryEventsMap: (input: unknown) => WorldBase["countryEventsByCountryId"];
  normalizeScheduledCountryEventsMap: (input: unknown) => WorldBase["countryScheduledEventsByCountryId"];
  normalizeCountryEventFlagsMap: (input: unknown) => WorldBase["countryEventFlagsByCountryId"];
  normalizeJournalEntriesMap: (input: unknown) => WorldBase["journalEntriesByCountryId"];
  normalizeCountryModifiersMap: (input: unknown) => WorldBase["countryModifiersByCountryId"];
  normalizeDiplomacyProposals: (input: unknown) => DiplomacyProposal[];
  rebuildTurnOrderIndexes: () => void;
  rebuildEconomyTickCountryIndexFromWorldBase: () => void;
  ensureMarketModelReady: () => void;
  logError: (message: string, error: unknown) => void;
};

export function createPersistedStateRestoreRuntime(params: PersistedStateRestoreRuntimeParams) {
  function parseAndApplyPersistentState(input: unknown): boolean {
    if (!input || typeof input !== "object") {
      return false;
    }

    const parsed = input as Partial<{
      turnId: unknown;
      worldStateVersion: unknown;
      activeScenarioId: unknown;
      activeScenarioName: unknown;
      gameSettings: unknown;
      worldBase: unknown;
      ordersByTurn: unknown;
      resolveReadyByTurn: unknown;
      adminAuditLog: unknown;
      marketOverview: unknown;
    }>;

    if (typeof parsed.turnId === "number" && Number.isFinite(parsed.turnId) && parsed.turnId >= 1) {
      params.setTurnId(Math.floor(parsed.turnId));
    }
    if (typeof parsed.worldStateVersion === "number" && Number.isFinite(parsed.worldStateVersion) && parsed.worldStateVersion >= 1) {
      params.setWorldStateVersion(Math.floor(parsed.worldStateVersion));
    }

    const savedWorldBaseMeta = parsed.worldBase && typeof parsed.worldBase === "object" ? (parsed.worldBase as Record<string, unknown>) : {};
    const savedScenarioId = normalizeScenarioId(parsed.activeScenarioId ?? savedWorldBaseMeta.activeScenarioId) ?? "active";
    const savedScenario = params.findScenario(savedScenarioId);
    if (savedScenario) {
      try {
        params.applyMapRuntime(savedScenario.mapRoot, savedScenario.hexIndexPath);
        params.setActiveScenario({
          id: savedScenario.descriptor.id,
          name:
            typeof (parsed.activeScenarioName ?? savedWorldBaseMeta.activeScenarioName) === "string" &&
            String(parsed.activeScenarioName ?? savedWorldBaseMeta.activeScenarioName).trim()
              ? String(parsed.activeScenarioName ?? savedWorldBaseMeta.activeScenarioName).trim()
              : savedScenario.descriptor.name,
        });
      } catch (error) {
        params.logError(`[scenario] Failed to restore map runtime for scenario ${savedScenarioId}:`, error);
        params.resetMapRuntimeToDefault();
        params.setActiveScenario({ id: "default", name: "Default" });
      }
    }

    const turnId = params.getTurnId();
    if (parsed.gameSettings && typeof parsed.gameSettings === "object") {
      let restoredSettings = restorePersistedGameSettings({
        input: parsed.gameSettings,
        defaults: params.defaultGameSettings(),
        turnId,
        corridorLoadHistoryLength: params.corridorLoadHistoryLength,
        round3: params.round3,
      });
      if (savedScenario) {
        const scenarioContent = params.loadScenarioContent(savedScenario.scenarioDir);
        if (scenarioContent) {
          restoredSettings = { ...restoredSettings, content: scenarioContent };
        }
        restoredSettings = params.applyScenarioDefines(restoredSettings, params.loadScenarioDefines(savedScenario.scenarioDir));
      }
      params.setGameSettings(restoredSettings);
    }

    params.setWorldBase(
      restorePersistedWorldBase({
        input: parsed.worldBase,
        turnId,
        defaultWorldBase: params.getDefaultWorldBase,
        normalizeResourcesByCountryMap: params.normalizeResourcesByCountryMap,
        normalizeResourceLedgerByTurn: params.normalizeResourceLedgerByTurn,
        normalizeExplanationRecordsByTurn: params.normalizeExplanationRecordsByTurn,
        normalizeRegionColonizationMap: params.normalizeRegionColonizationMap,
        normalizeRegionPopulationMap: params.normalizeRegionPopulationMap,
        normalizeRegionBuildingsMap: params.normalizeRegionBuildingsMap,
        normalizeRegionBuildingDucatsMap: params.normalizeRegionBuildingDucatsMap,
        normalizeRegionPopulationTreasuryMap: params.normalizeRegionPopulationTreasuryMap,
        normalizeRegionConstructionQueueMap: params.normalizeRegionConstructionQueueMap,
        normalizeRegionResourceDepositsMap: params.normalizeRegionResourceDepositsMap,
        normalizeRegionResourceExplorationQueueMap: params.normalizeRegionResourceExplorationQueueMap,
        normalizeRegionResourceExplorationCountMap: params.normalizeRegionResourceExplorationCountMap,
        normalizeTechnologyByCountryMap: params.normalizeTechnologyByCountryMap,
        normalizeCountryDecisionsMap: params.normalizeCountryDecisionsMap,
        normalizeCountryEventsMap: params.normalizeCountryEventsMap,
        normalizeScheduledCountryEventsMap: params.normalizeScheduledCountryEventsMap,
        normalizeCountryEventFlagsMap: params.normalizeCountryEventFlagsMap,
        normalizeJournalEntriesMap: params.normalizeJournalEntriesMap,
        normalizeCountryModifiersMap: params.normalizeCountryModifiersMap,
        normalizeDiplomacyProposals: params.normalizeDiplomacyProposals,
      }),
    );

    params.setLatestMarketOverview(
      normalizeMarketOverviewStateFromMarketTurn({
        input:
          parsed.worldBase && typeof parsed.worldBase === "object"
            ? (parsed.worldBase as { latestMarketOverview?: unknown }).latestMarketOverview
            : parsed.marketOverview,
        fallbackTurnId: turnId,
        createId: randomUUID,
      }),
    );

    params.ordersByTurn.clear();
    for (const [savedTurnId, ordersByCountry] of restoreOrdersByTurnState(parsed.ordersByTurn)) {
      params.ordersByTurn.set(savedTurnId, ordersByCountry);
    }

    params.resolveReadyByTurn.clear();
    for (const [savedTurnId, countryIds] of restoreResolveReadyByTurnState(parsed.resolveReadyByTurn)) {
      params.resolveReadyByTurn.set(savedTurnId, countryIds);
    }
    params.adminAuditLogStore.replaceFromPersisted(parsed.adminAuditLog);

    params.rebuildTurnOrderIndexes();
    params.rebuildEconomyTickCountryIndexFromWorldBase();
    params.ensureMarketModelReady();

    return true;
  }

  return { parseAndApplyPersistentState };
}
