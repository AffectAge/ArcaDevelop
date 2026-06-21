import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import type { WsOutMessage, WorldBase } from "@arcanorum/shared";
import { registerCountryRoutes } from "../routes/countryRoutes";
import { registerCountryProgressionRoutes } from "../routes/countryProgressionRoutes";
import type { RouteAuth } from "../security/routeAuth";
import type { countrySelect, createCountryRuntimeHelpers } from "./countryRuntimeHelpers";
import type { createCountryProgressionRuntime } from "./countryProgressionRuntime";
import type { createCountryWorldRuntime } from "./countryWorldRuntime";
import type { createUiNotificationRuntime } from "./uiNotificationRuntime";
import type { createWorldDeltaBroadcastRuntime } from "./worldDeltaBroadcastRuntime";
import type { createModifierRuntime } from "./modifierRuntime";
import type { GameSettings } from "./gameSettingsTypes";
import type { ResourceLedgerRuntime } from "./resourceLedgerRuntime";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";

type CountryProgressionDeps = Parameters<typeof registerCountryProgressionRoutes>[1];

type CountryRouteCompositionParams = {
  app: Express;
  prisma: PrismaClient;
  routeAuth: RouteAuth;
  countrySelect: typeof countrySelect;
  masks: CountryProgressionDeps["masks"];
  countryRuntimeHelpers: ReturnType<typeof createCountryRuntimeHelpers>;
  countryWorldRuntime: ReturnType<typeof createCountryWorldRuntime>;
  progressionRuntime: ReturnType<typeof createCountryProgressionRuntime>;
  modifierRuntime: ReturnType<typeof createModifierRuntime>;
  uiNotificationRuntime: ReturnType<typeof createUiNotificationRuntime>;
  worldDeltaBroadcastRuntime: ReturnType<typeof createWorldDeltaBroadcastRuntime>;
  resourceLedgerRuntime: ResourceLedgerRuntime;
  getTurnId: () => number;
  getGameSettings: () => GameSettings;
  getWorldBase: () => WorldBase;
  setCountryParliament: (countryId: string, parliament: WorldBase["parliamentByCountry"][string]) => void;
  setCountryTechnologyState: (countryId: string, state: WorldBase["technologyByCountry"][string]) => void;
  savePersistentState: () => void;
  makeOfficialNews: CountryProgressionDeps["makeOfficialNews"];
  broadcast: (message: WsOutMessage) => void;
};

export function registerCountryRouteComposition(params: CountryRouteCompositionParams): void {
  registerCountryRoutes(params.app, {
    getTurnId: params.getTurnId,
    cleanupExpiredPunishments: params.countryRuntimeHelpers.cleanupExpiredPunishments,
    listCountries: async () => {
      const countries = await params.countryRuntimeHelpers.getCachedCountryQuery({
        key: "country:list",
        loader: () => params.prisma.country.findMany({ select: params.countrySelect, orderBy: { createdAt: "asc" } }),
      });
      return countries.map(params.countryRuntimeHelpers.countryFromDb);
    },
  });

  registerCountryProgressionRoutes(params.app, {
    routeAuth: params.routeAuth,
    masks: params.masks,
    getTurnId: params.getTurnId,
    getContent: () => params.getGameSettings().content,
    getWorldBase: params.getWorldBase,
    getCountryResources: (countryId) => params.getWorldBase().resourcesByCountry[countryId],
    modifierConditionsMatchCountry: params.modifierRuntime.modifierConditionsMatchCountry,
    ensureCountryInWorldBase: params.countryWorldRuntime.ensureCountryInWorldBase,
    ensureCountryParliament: params.progressionRuntime.ensureCountryParliament,
    setCountryParliament: params.setCountryParliament,
    canEnactLawWithoutVote: params.progressionRuntime.canEnactLawWithoutVote,
    calculateBillVote: params.progressionRuntime.calculateBillVote,
    calculatePowerBillVote: params.progressionRuntime.calculatePowerBillVote,
    normalizeParliamentPowers: params.progressionRuntime.normalizeParliamentPowers,
    getParliamentPowersFromActiveLaws: params.progressionRuntime.getParliamentPowersFromActiveLaws,
    isLawUnlockedForCountry: params.progressionRuntime.isLawUnlockedForCountry,
    ensureCountryTechnologyState: params.progressionRuntime.ensureCountryTechnologyState,
    setCountryTechnologyState: params.setCountryTechnologyState,
    getActiveCountryModifierRows: params.modifierRuntime.getActiveCountryModifierRows,
    countryHasModifier: (countryId, modifierId) =>
      params.modifierRuntime
        .getActiveCountryModifierRows(countryId)
        .some((row) => row.sourceId === modifierId || row.id === modifierId || row.id.endsWith(`:${modifierId}`)),
    getVisibleCountryDecisions: params.progressionRuntime.getVisibleCountryDecisions,
    ensureCountryDecisionRecord: params.progressionRuntime.ensureCountryDecisionRecord,
    getCountryDecisionView: params.progressionRuntime.getCountryDecisionView,
    applyDecisionEffects: params.progressionRuntime.applyDecisionEffects,
    applyJournalGameEffects: params.progressionRuntime.applyJournalGameEffects,
    applyDecisionCosts: params.progressionRuntime.applyDecisionCosts,
    flushResourceLedger: params.resourceLedgerRuntime.flushTurn,
    ensureCountryEventRecord: params.progressionRuntime.ensureCountryEventRecord,
    getPendingCountryEvents: params.progressionRuntime.getPendingCountryEvents,
    getGameEventDefinition: params.progressionRuntime.getGameEventDefinition,
    getCountryScheduledEventsByCountryId: () => params.getWorldBase().countryScheduledEventsByCountryId,
    getCountryEventFlagsByCountryId: () => params.getWorldBase().countryEventFlagsByCountryId,
    removeQueuedUiNotification: params.uiNotificationRuntime.removeQueuedUiNotification,
    cloneWorldBaseSectionSnapshot: params.worldDeltaBroadcastRuntime.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.worldDeltaBroadcastRuntime.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });
}
