import type { Express } from "express";
import { registerMilitaryRuntimeRoutes } from "./militaryRouteRuntime";
import type { RouteAuth } from "../security/routeAuth";
import type { upload } from "../uploads/uploadMiddleware";
import type { createCountryWorldRuntime } from "./countryWorldRuntime";
import type { createMarketRuntimeFacade } from "./marketRuntimeFacade";
import type { createMilitaryRuntimeFacade } from "./militaryRuntimeFacade";
import type { createMapRuntimeState } from "./mapRuntimeState";
import type { createWorldDeltaBroadcastRuntime } from "./worldDeltaBroadcastRuntime";
import type { GameSettings } from "./gameSettingsTypes";
import type { WorldBase } from "@arcanorum/shared";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";
import type { ResourceLedgerRuntime } from "./resourceLedgerRuntime";

type MilitaryRuntimeDeps = Parameters<typeof registerMilitaryRuntimeRoutes>[0];

type MilitaryRouteCompositionParams = {
  app: Express;
  routeAuth: RouteAuth;
  upload: typeof upload;
  masks: MilitaryRuntimeDeps["masks"];
  createId: () => string;
  getTurnId: () => number;
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  mapRuntime: ReturnType<typeof createMapRuntimeState>;
  countryWorldRuntime: ReturnType<typeof createCountryWorldRuntime>;
  marketRuntimeFacade: ReturnType<typeof createMarketRuntimeFacade>;
  militaryRuntimeFacade: ReturnType<typeof createMilitaryRuntimeFacade>;
  worldDeltaBroadcastRuntime: ReturnType<typeof createWorldDeltaBroadcastRuntime>;
  resourceLedgerRuntime: ResourceLedgerRuntime;
  savePersistentState: () => void;
  removeUploadedFile: MilitaryRuntimeDeps["removeUploadedFile"];
  removeUploadedByUrl: MilitaryRuntimeDeps["removeUploadedByUrl"];
  makeVersionedUploadUrl: MilitaryRuntimeDeps["makeVersionedUploadUrl"];
};

export function registerMilitaryRouteComposition(params: MilitaryRouteCompositionParams): void {
  registerMilitaryRuntimeRoutes({
    app: params.app,
    routeAuth: params.routeAuth,
    upload: params.upload,
    masks: params.masks,
    createId: params.createId,
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getGameSettings: params.getGameSettings,
    getProvinceIndex: params.mapRuntime.getProvinceIndex,
    ensureCountryInWorldBase: params.countryWorldRuntime.ensureCountryInWorldBase,
    getCountryMarketRecord: params.marketRuntimeFacade.getCountryMarketRecord,
    normalizeMilitaryTemplateComponents: params.militaryRuntimeFacade.normalizeMilitaryTemplateComponents,
    componentsToDivisionBattalions: params.militaryRuntimeFacade.componentsToDivisionBattalions,
    getMilitaryContentById: params.militaryRuntimeFacade.getMilitaryContentById,
    getBattalionContentById: params.militaryRuntimeFacade.getBattalionContentById,
    calculateMilitaryStats: params.militaryRuntimeFacade.calculateMilitaryStats,
    calculateDivisionStats: params.militaryRuntimeFacade.calculateDivisionStats,
    calculateMilitaryFormationCost: params.militaryRuntimeFacade.calculateMilitaryFormationCost,
    calculateDivisionTrainingCost: params.militaryRuntimeFacade.calculateDivisionTrainingCost,
    cloneWorldBaseSectionSnapshot: params.worldDeltaBroadcastRuntime.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.worldDeltaBroadcastRuntime.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    addResourceLedgerExpense: params.resourceLedgerRuntime.addExpense,
    flushResourceLedger: params.resourceLedgerRuntime.flushTurn,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
  });
}
