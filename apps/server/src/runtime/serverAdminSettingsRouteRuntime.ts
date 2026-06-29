import type { Express } from "express";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { WsOutMessage } from "@arcanorum/shared";
import { WORLD_DELTA_MASK } from "@arcanorum/shared";
import type { RouteAuth } from "../security/routeAuth";
import type { AdminAuditLogStore } from "../security/adminAuditLog";
import type { createColonizationRuntimeFacade } from "./colonizationRuntimeFacade";
import type { createScenarioServerRuntime } from "./scenarioServerRuntime";
import type { createTurnSessionRuntime } from "./turnSessionRuntime";
import type { createWorldDeltaBroadcastRuntime } from "./worldDeltaBroadcastRuntime";
import type { GameSettings } from "./gameSettingsTypes";
import type { makeOfficialNews } from "./officialNewsRuntime";
import {
  normalizeInfrastructureConstructionRightsMap,
  normalizeInfrastructureTransitAgreementsMap,
  normalizeMarketId,
  normalizeMarketSanctionsMap,
} from "./marketSettingsNormalizers";
import { SETTINGS_MAX_NUMBER } from "./serverRuntimeConfig";
import { registerAdminSettingsRuntime } from "./adminSettingsRuntime";
import { validateScenarioDirectory } from "../scenarios/scenarioValidation";

type ServerAdminSettingsRouteRuntimeParams = {
  app: Express;
  routeAuth: RouteAuth;
  auditLogStore: AdminAuditLogStore;
  scenarioServerRuntime: ReturnType<typeof createScenarioServerRuntime>;
  worldDeltaBroadcastRuntime: ReturnType<typeof createWorldDeltaBroadcastRuntime>;
  colonizationRuntime: ReturnType<typeof createColonizationRuntimeFacade>;
  turnSessionRuntime: ReturnType<typeof createTurnSessionRuntime>;
  getTurnId: () => number;
  getActiveScenarioId: () => string;
  getGameSettings: () => GameSettings;
  removeUploadedByUrl: (url: string) => void;
  savePersistentState: () => void;
  makeOfficialNews: typeof makeOfficialNews;
  broadcast: (message: WsOutMessage) => void;
};

export function registerServerAdminSettingsRouteRuntime(params: ServerAdminSettingsRouteRuntimeParams): void {
  registerAdminSettingsRuntime({
    app: params.app,
    routeAuth: params.routeAuth,
    maxSettingNumber: SETTINGS_MAX_NUMBER,
    masks: {
      regionColonizationByRegion: WORLD_DELTA_MASK.regionColonizationByRegion,
    },
    auditLogStore: params.auditLogStore,
    getTurnId: params.getTurnId,
    getActiveScenarioId: params.getActiveScenarioId,
    listScenarios: params.scenarioServerRuntime.listScenarios,
    getScenarioStatus: () => getScenarioStatus(params),
    getGameSettings: params.getGameSettings,
    normalizeMarketId,
    normalizeMarketSanctionsMap: (input) => normalizeMarketSanctionsMap(input, params.getTurnId()),
    normalizeInfrastructureTransitAgreementsMap,
    normalizeInfrastructureConstructionRightsMap,
    cloneWorldBaseSectionSnapshot: params.worldDeltaBroadcastRuntime.cloneWorldBaseSectionSnapshot,
    recalculateAllRegionColonizationCosts: params.colonizationRuntime.recalculateAllRegionColonizationCosts,
    resetTurnTimerAnchor: params.turnSessionRuntime.resetTurnTimerAnchor,
    removeUploadedByUrl: params.removeUploadedByUrl,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: params.worldDeltaBroadcastRuntime.broadcastWorldDeltaFromSectionSnapshot,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });
}

async function getScenarioStatus(params: ServerAdminSettingsRouteRuntimeParams): Promise<unknown> {
  const activeScenarioId = params.getActiveScenarioId();
  const scenario = params.scenarioServerRuntime.findScenario(activeScenarioId);
  const validation = scenario ? await validateScenarioDirectory(scenario.scenarioDir) : null;
  const settings = params.getGameSettings();
  return {
    activeScenarioId,
    scenario: scenario?.descriptor ?? null,
    validation: validation
      ? {
          ok: validation.ok,
          summary: validation.summary,
          issues: validation.issues,
        }
      : {
          ok: false,
          summary: null,
          issues: [{ code: "SCENARIO_NOT_FOUND", message: `Active scenario ${activeScenarioId} was not found.` }],
        },
    content: summarizeContent(settings.content),
    assets: {
      count: settings.content.assets.length,
      byType: settings.content.assets.reduce<Record<string, number>>((acc, asset) => {
        acc[asset.type] = (acc[asset.type] ?? 0) + 1;
        return acc;
      }, {}),
    },
    hashes: {
      authoredHash: scenario ? readGeneratedAuthoredHash(scenario.scenarioDir) : null,
    },
  };
}

function summarizeContent(content: GameSettings["content"]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const [key, value] of Object.entries(content)) {
    summary[key] = Array.isArray(value) ? value.length : 0;
  }
  return summary;
}

function readGeneratedAuthoredHash(scenarioDir: string): string | null {
  const path = join(scenarioDir, ".generated", "index-manifest.json");
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { authoredHash?: unknown };
    return typeof parsed.authoredHash === "string" ? parsed.authoredHash : null;
  } catch {
    return null;
  }
}
