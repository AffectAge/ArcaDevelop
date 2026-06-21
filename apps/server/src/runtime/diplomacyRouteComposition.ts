import type express from "express";
import type { EventLogEntry, WsOutMessage } from "@arcanorum/shared";
import type { PrismaClient } from "@prisma/client";
import type { RouteAuth } from "../security/routeAuth";
import type { GameSettings } from "./gameSettingsTypes";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";
import { createDiplomacyRuntime } from "./diplomacyRouteRuntime";

type DiplomacyDeps = Parameters<typeof createDiplomacyRuntime>[0];
type DiplomacyRuntime = ReturnType<typeof createDiplomacyRuntime>;

type DiplomacyRouteCompositionParams = {
  app: express.Express;
  prisma: PrismaClient;
  routeAuth: RouteAuth;
  masks: DiplomacyDeps["masks"];
  createId: DiplomacyDeps["createId"];
  getTurnId: () => number;
  getWorldBase: DiplomacyDeps["getWorldBase"];
  setDiplomacyProposals: DiplomacyDeps["setDiplomacyProposals"];
  getGameSettings: () => GameSettings;
  countryWorldRuntime: {
    ensureCountryInWorldBase: DiplomacyDeps["ensureCountryInWorldBase"];
  };
  normalizeDiplomacyProposals: DiplomacyDeps["normalizeDiplomacyProposals"];
  worldDeltaBroadcastRuntime: {
    cloneWorldBaseSectionSnapshot: (mask: number) => WorldBaseSectionSnapshot;
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: WorldBaseSectionSnapshot) => void;
  };
  resourceLedgerRuntime?: {
    addIncome: DiplomacyDeps["addResourceLedgerIncome"];
    addExpense: DiplomacyDeps["addResourceLedgerExpense"];
    flushTurn: DiplomacyDeps["flushResourceLedger"];
  };
  uiNotificationRuntime: {
    removeQueuedUiNotification: DiplomacyDeps["removeQueuedUiNotification"];
    sendUiNotificationToCountry: DiplomacyDeps["sendUiNotificationToCountry"];
  };
  savePersistentState: () => void;
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
};

export function createDiplomacyRouteComposition(params: DiplomacyRouteCompositionParams): DiplomacyRuntime {
  const diplomacyRuntime = createDiplomacyRuntime({
    app: params.app,
    routeAuth: params.routeAuth,
    masks: params.masks,
    createId: params.createId,
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    setDiplomacyProposals: params.setDiplomacyProposals,
    getGameSettings: params.getGameSettings,
    ensureCountryInWorldBase: params.countryWorldRuntime.ensureCountryInWorldBase,
    countryExists: async (countryId) => {
      if (params.getWorldBase().resourcesByCountry[countryId]) return true;
      const row = await params.prisma.country.findUnique({ where: { id: countryId }, select: { id: true } });
      return Boolean(row);
    },
    normalizeDiplomacyProposals: params.normalizeDiplomacyProposals,
    cloneWorldBaseSectionSnapshot: params.worldDeltaBroadcastRuntime.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.worldDeltaBroadcastRuntime.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    addResourceLedgerIncome: params.resourceLedgerRuntime?.addIncome,
    addResourceLedgerExpense: params.resourceLedgerRuntime?.addExpense,
    flushResourceLedger: params.resourceLedgerRuntime?.flushTurn,
    removeQueuedUiNotification: params.uiNotificationRuntime.removeQueuedUiNotification,
    sendUiNotificationToCountry: params.uiNotificationRuntime.sendUiNotificationToCountry,
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });

  diplomacyRuntime.registerRoutes();
  return diplomacyRuntime;
}
