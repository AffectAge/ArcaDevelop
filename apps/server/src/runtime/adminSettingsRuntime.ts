import type express from "express";
import type { EventLogEntry, WsOutMessage } from "@arcanorum/shared";
import { registerAdminGameSettingsRoutes } from "../routes/adminGameSettingsRoutes";
import type { GameSettingsPatchInput } from "../routes/adminGameSettingsRoutes";
import { registerAdminMetadataRoutes } from "../routes/adminMetadataRoutes";
import type { AdminAuditLogReader } from "../routes/adminMetadataRoutes";
import type { RouteAuth } from "../security/routeAuth";
import type { GameSettings } from "./gameSettingsTypes";
import { applyGameSettingsPatch } from "./gameSettingsPatch";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";

type ColonizationRateSnapshot = {
  pointsCostPer1000Km2: number;
  ducatsCostPer1000Km2: number;
};

type AdminSettingsRuntimeParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  maxSettingNumber: number;
  masks: {
    regionColonizationByRegion: number;
  };
  auditLogStore: AdminAuditLogReader;
  getTurnId: () => number;
  getActiveScenarioId: () => string;
  listScenarios: () => unknown[];
  getGameSettings: () => GameSettings;
  normalizeMarketId: (input: unknown) => string | null;
  normalizeMarketSanctionsMap: (input: unknown) => GameSettings["markets"]["sanctionsById"];
  normalizeInfrastructureTransitAgreementsMap: (
    input: unknown,
  ) => GameSettings["markets"]["infrastructureTransitAgreementsById"];
  normalizeInfrastructureConstructionRightsMap: (
    input: unknown,
  ) => GameSettings["markets"]["infrastructureConstructionRightsById"];
  cloneWorldBaseSectionSnapshot: (mask: number) => WorldBaseSectionSnapshot;
  recalculateAllRegionColonizationCosts: (previousRates: ColonizationRateSnapshot) => number;
  resetTurnTimerAnchor: () => void;
  removeUploadedByUrl: (url: string) => void;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: WorldBaseSectionSnapshot) => void;
  makeOfficialNews: (input: {
    turn: number;
    category: "system";
    title: string;
    message: string;
    countryId: string;
    priority: "medium";
    visibility: "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export function registerAdminSettingsRuntime(params: AdminSettingsRuntimeParams): void {
  registerAdminMetadataRoutes(params.app, {
    routeAuth: params.routeAuth,
    getActiveScenarioId: params.getActiveScenarioId,
    listScenarios: params.listScenarios,
    auditLogStore: params.auditLogStore,
  });

  registerAdminGameSettingsRoutes(params.app, {
    routeAuth: params.routeAuth,
    getGameSettings: params.getGameSettings,
    applyGameSettingsUpdate: (input, actorCountryId) => applyGameSettingsUpdate(params, input, actorCountryId),
    maxSettingNumber: params.maxSettingNumber,
  });
}

function applyGameSettingsUpdate(
  params: AdminSettingsRuntimeParams,
  parsedData: GameSettingsPatchInput,
  actorCountryId: string,
): GameSettings {
  const previousWorldBase = parsedData.colonization
    ? params.cloneWorldBaseSectionSnapshot(params.masks.regionColonizationByRegion)
    : null;
  const patchResult = applyGameSettingsPatch({
    settings: params.getGameSettings(),
    patch: parsedData,
    normalizeMarketId: params.normalizeMarketId,
    normalizeMarketSanctionsMap: params.normalizeMarketSanctionsMap,
    normalizeInfrastructureTransitAgreementsMap: params.normalizeInfrastructureTransitAgreementsMap,
    normalizeInfrastructureConstructionRightsMap: params.normalizeInfrastructureConstructionRightsMap,
  });
  let regionColonizationCostsRecalculated = 0;
  if (patchResult.colonizationPriceFormulaChanged && patchResult.previousColonizationCostPer1000Km2) {
    regionColonizationCostsRecalculated = params.recalculateAllRegionColonizationCosts(
      patchResult.previousColonizationCostPer1000Km2,
    );
  }
  if (patchResult.turnTimerConfigChanged) {
    params.resetTurnTimerAnchor();
  }
  if (patchResult.backgroundImageUrlToRemove) {
    params.removeUploadedByUrl(patchResult.backgroundImageUrlToRemove);
  }

  params.savePersistentState();
  if (regionColonizationCostsRecalculated > 0 && previousWorldBase) {
    params.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
  }
  if (patchResult.changedSections.length > 0) {
    params.broadcast({
      type: "NEWS_EVENT",
      event: params.makeOfficialNews({
        turn: params.getTurnId(),
        category: "system",
        title: "Настройки игры изменены",
        message:
          `Администратор обновил разделы: ${patchResult.changedSections.join(", ")}` +
          (regionColonizationCostsRecalculated > 0 ? `; пересчитаны цены провинций: ${regionColonizationCostsRecalculated}` : ""),
        countryId: actorCountryId,
        priority: "medium",
        visibility: "public",
      }),
    });
  }
  return params.getGameSettings();
}
