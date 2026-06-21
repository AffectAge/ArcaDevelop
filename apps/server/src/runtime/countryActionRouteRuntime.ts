import { randomUUID } from "node:crypto";
import type express from "express";
import type { EventLogEntry, Order, WorldBase, WsOutMessage } from "@arcanorum/shared";
import { DEFAULT_EXPLORATION_DURATION_TURNS } from "../mechanics/resourceExplorationMechanics";
import { registerCountryBuildRoutes } from "../routes/countryBuildRoutes";
import type { CountryBuildContentEntry } from "../routes/countryBuildRoutes";
import { registerCountryExpansionRoutes } from "../routes/countryExpansionRoutes";
import { registerCountryOrderRoutes } from "../routes/countryOrderRoutes";
import type { RouteAuth } from "../security/routeAuth";
import type { GameSettings } from "./gameSettingsTypes";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";
import type { RegionColonizationConfig } from "../mechanics/colonizationMechanics";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";

type CountryActionRouteRuntimeParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  masks: {
    colonyProgressByRegion: number;
    regionResourceExplorationQueueByRegion: number;
    regionConstructionQueueByRegion: number;
    resourcesByCountry: number;
    regionBuildingsByRegion: number;
    regionBuildingDucatsByRegion: number;
  };
  getTurnId: () => number;
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getOrdersByTurn: (turnId: number) => Map<string, Order[]> | undefined;
  deleteOrdersForTurn: (turnId: number) => void;
  removeOrderFromTurnIndexes: (order: Order) => void;
  dropTurnOrderIndexes: (turnId: number) => void;
  getActiveColonizeRegionIds: (countryId: string) => Iterable<string>;
  getQueuedColonizeRegionIds: (turnId: number, countryId: string) => Iterable<string>;
  getRegionColonizationConfig: (provinceId: string) => RegionColonizationConfig;
  ensureCountryInWorldBase: (countryId: string) => void;
  addActiveColonizationTarget: (countryId: string, provinceId: string) => void;
  removeActiveColonizationTarget: (countryId: string, provinceId: string) => void;
  removeRegionFromActiveColonizationIndex: (provinceId: string) => void;
  getBuildingMaxLevel: (building: CountryBuildContentEntry | undefined) => number;
  getBuildingUpgradeCosts: (
    building: CountryBuildContentEntry | undefined,
  ) => { costConstruction: number; costDucats: number };
  getBuildingConstructionTotalCostByLevel: (
    building: CountryBuildContentEntry | undefined,
    levelRaw: number,
  ) => number;
  cloneWorldBaseSectionSnapshot: (mask: number) => WorldBaseSectionSnapshot;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: WorldBaseSectionSnapshot) => void;
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
  flushResourceLedger?: () => void;
  makeOfficialNews: (input: {
    turn: number;
    category: "colonization";
    title: string;
    message: string;
    countryId: string;
    priority: "low";
    visibility: "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export function registerCountryActionRouteRuntime(params: CountryActionRouteRuntimeParams): void {
  registerCountryExpansionRoutes(params.app, {
    routeAuth: params.routeAuth,
    masks: {
      colonyProgressByRegion: params.masks.colonyProgressByRegion,
      regionResourceExplorationQueueByRegion: params.masks.regionResourceExplorationQueueByRegion,
    },
    createId: randomUUID,
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getWorldState: params.getWorldBase,
    getMaxActiveColonizations: () => params.getGameSettings().colonization.maxActiveColonizations,
    getExplorationDurationTurns: () =>
      Math.max(
        1,
        Math.floor(Number(params.getGameSettings().economy.explorationDurationTurns ?? DEFAULT_EXPLORATION_DURATION_TURNS)),
      ),
    getRegionColonizationConfig: params.getRegionColonizationConfig,
    ensureCountryInWorldBase: params.ensureCountryInWorldBase,
    addActiveColonizationTarget: params.addActiveColonizationTarget,
    removeActiveColonizationTarget: params.removeActiveColonizationTarget,
    removeRegionFromActiveColonizationIndex: params.removeRegionFromActiveColonizationIndex,
    getActiveColonizeRegionIds: params.getActiveColonizeRegionIds,
    getQueuedColonizeRegionIds: params.getQueuedColonizeRegionIds,
    getOrdersByTurn: params.getOrdersByTurn,
    deleteOrdersForTurn: params.deleteOrdersForTurn,
    removeOrderFromTurnIndexes: params.removeOrderFromTurnIndexes,
    dropTurnOrderIndexes: params.dropTurnOrderIndexes,
    cloneWorldBaseSectionSnapshot: params.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    makeOfficialNews: params.makeOfficialNews,
    broadcast: params.broadcast,
  });

  registerCountryBuildRoutes(params.app, {
    routeAuth: params.routeAuth,
    masks: {
      regionConstructionQueueByRegion: params.masks.regionConstructionQueueByRegion,
      resourcesByCountry: params.masks.resourcesByCountry,
      regionBuildingsByRegion: params.masks.regionBuildingsByRegion,
      regionBuildingDucatsByRegion: params.masks.regionBuildingDucatsByRegion,
    },
    createId: randomUUID,
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getGameSettings: params.getGameSettings,
    getOrdersByTurn: params.getOrdersByTurn,
    deleteOrdersForTurn: params.deleteOrdersForTurn,
    removeOrderFromTurnIndexes: params.removeOrderFromTurnIndexes,
    dropTurnOrderIndexes: params.dropTurnOrderIndexes,
    ensureCountryInWorldBase: params.ensureCountryInWorldBase,
    getBuildingMaxLevel: params.getBuildingMaxLevel,
    getBuildingUpgradeCosts: params.getBuildingUpgradeCosts,
    getBuildingConstructionTotalCostByLevel: params.getBuildingConstructionTotalCostByLevel,
    cloneWorldBaseSectionSnapshot: params.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    addResourceExpense: params.addResourceLedgerExpense,
    flushResourceLedger: params.flushResourceLedger,
  });

  registerCountryOrderRoutes(params.app, {
    routeAuth: params.routeAuth,
    getTurnId: params.getTurnId,
    getOrdersByTurn: params.getOrdersByTurn,
  });
}
