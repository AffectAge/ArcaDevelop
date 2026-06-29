import type express from "express";
import type { EventLogEntry, Order, WsOutMessage } from "@arcanorum/shared";
import type { PrismaClient } from "@prisma/client";
import type { PopulationDomainKeys } from "../mechanics/populationMechanics";
import type { RouteAuth } from "../security/routeAuth";
import type { BuildingContentEntry, GameSettings } from "./gameSettingsTypes";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";
import type { ResourceLedgerRuntime } from "./resourceLedgerRuntime";
import { registerCountryActionRouteRuntime } from "./countryActionRouteRuntime";
import { registerHexRouteRuntime } from "./hexRouteRuntime";

type CountryActionDeps = Parameters<typeof registerCountryActionRouteRuntime>[0];
type HexDeps = Parameters<typeof registerHexRouteRuntime>[0];

type GameplayRouteCompositionParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  prisma: PrismaClient;
  masks: CountryActionDeps["masks"] & HexDeps["masks"];
  getTurnId: () => number;
  getWorldBase: CountryActionDeps["getWorldBase"];
  getGameSettings: () => GameSettings;
  getOrdersByTurn: (turnId: number) => Map<string, Order[]> | undefined;
  deleteOrdersForTurn: (turnId: number) => void;
  mapRuntime: {
    getHexIndex: HexDeps["getHexIndex"];
    getHexMapArtifact: HexDeps["getHexMapArtifact"];
    getMapFeatures: HexDeps["getMapFeatures"];
    getMapFeatureVisuals: HexDeps["getMapFeatureVisuals"];
  };
  turnOrderRuntime: {
    removeOrderFromTurnIndexes: (order: Order) => void;
    dropTurnOrderIndexes: (turnId: number) => void;
  };
  colonizationRuntime: {
    getRegionColonizationConfig: CountryActionDeps["getRegionColonizationConfig"];
    getRegionDerivedColonizationCosts: HexDeps["getRegionDerivedColonizationCosts"];
    addActiveColonizationTarget: CountryActionDeps["addActiveColonizationTarget"];
    removeActiveColonizationTarget: CountryActionDeps["removeActiveColonizationTarget"];
    removeRegionFromActiveColonizationIndex: CountryActionDeps["removeRegionFromActiveColonizationIndex"];
    cleanupRegionColonizationProgress: HexDeps["cleanupRegionColonizationProgress"];
    recalculateAllRegionColonizationCosts: HexDeps["recalculateAllRegionColonizationCosts"];
  };
  buildingRuntime: {
    getBuildingMaxLevel: (building: BuildingContentEntry | undefined) => number;
    getBuildingUpgradeCosts: (building: BuildingContentEntry | undefined) => { costConstruction: number; costDucats: number };
    getBuildingConstructionTotalCostByLevel: (building: BuildingContentEntry | undefined, levelRaw: number) => number;
  };
  worldPopulationRuntime: {
    getPopulationDomainKeys: () => PopulationDomainKeys;
    buildRandomRegionPopulation: (
      hexId: string,
      domains: PopulationDomainKeys,
      populationTotal?: number,
    ) => ReturnType<HexDeps["buildRandomRegionPopulation"]>;
    normalizePopulationPops: (
      rawPops: unknown,
      hexId: string,
      domains: PopulationDomainKeys,
    ) => ReturnType<HexDeps["normalizePopulationPops"]>;
    isEqualRegionPopulation: HexDeps["isEqualRegionPopulation"];
  };
  countryWorldRuntime: {
    ensureCountryInWorldBase: CountryActionDeps["ensureCountryInWorldBase"];
  };
  worldDeltaBroadcastRuntime: {
    cloneWorldBaseSectionSnapshot: (mask: number) => WorldBaseSectionSnapshot;
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: WorldBaseSectionSnapshot) => void;
  };
  resourceLedgerRuntime: ResourceLedgerRuntime;
  getActiveColonizeRegionIds: CountryActionDeps["getActiveColonizeRegionIds"];
  getQueuedColonizeRegionIds: CountryActionDeps["getQueuedColonizeRegionIds"];
  getHexRenameDucatsCost: HexDeps["getHexRenameDucatsCost"];
  savePersistentState: () => void;
  makeOfficialNews: (input: {
    turn: number;
    category: EventLogEntry["category"];
    title: string;
    message: string;
    countryId: string;
    priority: "low";
    visibility: "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export function registerGameplayRouteComposition(params: GameplayRouteCompositionParams): void {
  registerCountryActionRouteRuntime({
    app: params.app,
    routeAuth: params.routeAuth,
    masks: params.masks,
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getGameSettings: params.getGameSettings,
    getOrdersByTurn: params.getOrdersByTurn,
    deleteOrdersForTurn: params.deleteOrdersForTurn,
    removeOrderFromTurnIndexes: params.turnOrderRuntime.removeOrderFromTurnIndexes,
    dropTurnOrderIndexes: params.turnOrderRuntime.dropTurnOrderIndexes,
    getActiveColonizeRegionIds: params.getActiveColonizeRegionIds,
    getQueuedColonizeRegionIds: params.getQueuedColonizeRegionIds,
    getHexRegionId: (hexId) => {
      const hex = params.mapRuntime.getHexIndex().find((entry) => entry.id === hexId);
      return hex?.regionId ?? null;
    },
    getRegionColonizationConfig: params.colonizationRuntime.getRegionColonizationConfig,
    ensureCountryInWorldBase: params.countryWorldRuntime.ensureCountryInWorldBase,
    addActiveColonizationTarget: params.colonizationRuntime.addActiveColonizationTarget,
    removeActiveColonizationTarget: params.colonizationRuntime.removeActiveColonizationTarget,
    removeRegionFromActiveColonizationIndex: params.colonizationRuntime.removeRegionFromActiveColonizationIndex,
    getBuildingMaxLevel: (building) => params.buildingRuntime.getBuildingMaxLevel(building as BuildingContentEntry | undefined),
    getBuildingUpgradeCosts: (building) =>
      params.buildingRuntime.getBuildingUpgradeCosts(building as BuildingContentEntry | undefined),
    getBuildingConstructionTotalCostByLevel: (building, levelRaw) =>
      params.buildingRuntime.getBuildingConstructionTotalCostByLevel(
        building as BuildingContentEntry | undefined,
        levelRaw,
      ),
    cloneWorldBaseSectionSnapshot: params.worldDeltaBroadcastRuntime.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: params.worldDeltaBroadcastRuntime.broadcastWorldDeltaFromSectionSnapshot,
    addResourceLedgerExpense: params.resourceLedgerRuntime.addExpense,
    flushResourceLedger: params.resourceLedgerRuntime.flushTurn,
    makeOfficialNews: (input) => params.makeOfficialNews(input),
    broadcast: params.broadcast,
  });

  registerHexRouteRuntime({
    app: params.app,
    routeAuth: params.routeAuth,
    prisma: params.prisma,
    masks: params.masks,
    getTurnId: params.getTurnId,
    getHexIndex: params.mapRuntime.getHexIndex,
    getHexMapArtifact: params.mapRuntime.getHexMapArtifact,
    getMapFeatures: params.mapRuntime.getMapFeatures,
    getMapFeatureVisuals: params.mapRuntime.getMapFeatureVisuals,
    getWorldBase: params.getWorldBase,
    getHexRenameDucatsCost: params.getHexRenameDucatsCost,
    getRegionColonizationConfig: params.colonizationRuntime.getRegionColonizationConfig,
    getRegionDerivedColonizationCosts: params.colonizationRuntime.getRegionDerivedColonizationCosts,
    getPopulationDomainKeys: () => params.worldPopulationRuntime.getPopulationDomainKeys(),
    buildRandomRegionPopulation: (hexId, domains, populationTotal) =>
      params.worldPopulationRuntime.buildRandomRegionPopulation(
        hexId,
        domains as PopulationDomainKeys,
        populationTotal,
      ),
    normalizePopulationPops: (rawPops, hexId, domains) =>
      params.worldPopulationRuntime.normalizePopulationPops(rawPops, hexId, domains as PopulationDomainKeys),
    isEqualRegionPopulation: params.worldPopulationRuntime.isEqualRegionPopulation,
    cleanupRegionColonizationProgress: params.colonizationRuntime.cleanupRegionColonizationProgress,
    recalculateAllRegionColonizationCosts: params.colonizationRuntime.recalculateAllRegionColonizationCosts,
    ensureCountryInWorldBase: params.countryWorldRuntime.ensureCountryInWorldBase,
    cloneWorldBaseSectionSnapshot: params.worldDeltaBroadcastRuntime.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: params.worldDeltaBroadcastRuntime.broadcastWorldDeltaFromSectionSnapshot,
    addResourceLedgerExpense: params.resourceLedgerRuntime.addExpense,
    flushResourceLedger: params.resourceLedgerRuntime.flushTurn,
    makeOfficialNews: (input) => params.makeOfficialNews(input),
    broadcast: params.broadcast,
  });
}
