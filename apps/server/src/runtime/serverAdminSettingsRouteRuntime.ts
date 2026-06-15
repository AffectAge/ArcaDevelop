import type { Express } from "express";
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
