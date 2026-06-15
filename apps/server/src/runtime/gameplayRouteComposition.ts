import type express from "express";
import type { EventLogEntry, Order, WsOutMessage } from "@arcanorum/shared";
import type { PrismaClient } from "@prisma/client";
import type { PopulationDomainKeys } from "../mechanics/populationMechanics";
import type { RouteAuth } from "../security/routeAuth";
import type { BuildingContentEntry, GameSettings } from "./gameSettingsTypes";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";
import { registerCountryActionRouteRuntime } from "./countryActionRouteRuntime";
import { registerProvinceRouteRuntime } from "./provinceRouteRuntime";

type CountryActionDeps = Parameters<typeof registerCountryActionRouteRuntime>[0];
type ProvinceDeps = Parameters<typeof registerProvinceRouteRuntime>[0];

type GameplayRouteCompositionParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  prisma: PrismaClient;
  masks: CountryActionDeps["masks"] & ProvinceDeps["masks"];
  getTurnId: () => number;
  getWorldBase: CountryActionDeps["getWorldBase"];
  getGameSettings: () => GameSettings;
  getOrdersByTurn: (turnId: number) => Map<string, Order[]> | undefined;
  deleteOrdersForTurn: (turnId: number) => void;
  mapRuntime: {
    getProvinceIndex: ProvinceDeps["getProvinceIndex"];
  };
  turnOrderRuntime: {
    removeOrderFromTurnIndexes: (order: Order) => void;
    dropTurnOrderIndexes: (turnId: number) => void;
  };
  colonizationRuntime: {
    getRegionColonizationConfig: CountryActionDeps["getRegionColonizationConfig"];
    getRegionDerivedColonizationCosts: ProvinceDeps["getRegionDerivedColonizationCosts"];
    addActiveColonizationTarget: CountryActionDeps["addActiveColonizationTarget"];
    removeActiveColonizationTarget: CountryActionDeps["removeActiveColonizationTarget"];
    removeRegionFromActiveColonizationIndex: CountryActionDeps["removeRegionFromActiveColonizationIndex"];
    cleanupRegionColonizationProgress: ProvinceDeps["cleanupRegionColonizationProgress"];
    recalculateAllRegionColonizationCosts: ProvinceDeps["recalculateAllRegionColonizationCosts"];
  };
  buildingRuntime: {
    getBuildingMaxLevel: (building: BuildingContentEntry | undefined) => number;
    getBuildingUpgradeCosts: (building: BuildingContentEntry | undefined) => { costConstruction: number; costDucats: number };
    getBuildingConstructionTotalCostByLevel: (building: BuildingContentEntry | undefined, levelRaw: number) => number;
  };
  worldPopulationRuntime: {
    getPopulationDomainKeys: () => PopulationDomainKeys;
    buildRandomRegionPopulation: (
      provinceId: string,
      domains: PopulationDomainKeys,
      populationTotal?: number,
    ) => ReturnType<ProvinceDeps["buildRandomRegionPopulation"]>;
    normalizePopulationPops: (
      rawPops: unknown,
      provinceId: string,
      domains: PopulationDomainKeys,
    ) => ReturnType<ProvinceDeps["normalizePopulationPops"]>;
    isEqualRegionPopulation: ProvinceDeps["isEqualRegionPopulation"];
  };
  countryWorldRuntime: {
    ensureCountryInWorldBase: CountryActionDeps["ensureCountryInWorldBase"];
  };
  worldDeltaBroadcastRuntime: {
    cloneWorldBaseSectionSnapshot: (mask: number) => WorldBaseSectionSnapshot;
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: WorldBaseSectionSnapshot) => void;
  };
  getActiveColonizeRegionIds: CountryActionDeps["getActiveColonizeRegionIds"];
  getQueuedColonizeRegionIds: CountryActionDeps["getQueuedColonizeRegionIds"];
  getProvinceRenameDucatsCost: ProvinceDeps["getProvinceRenameDucatsCost"];
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
    makeOfficialNews: (input) => params.makeOfficialNews(input),
    broadcast: params.broadcast,
  });

  registerProvinceRouteRuntime({
    app: params.app,
    routeAuth: params.routeAuth,
    prisma: params.prisma,
    masks: params.masks,
    getTurnId: params.getTurnId,
    getProvinceIndex: params.mapRuntime.getProvinceIndex,
    getWorldBase: params.getWorldBase,
    getProvinceRenameDucatsCost: params.getProvinceRenameDucatsCost,
    getRegionColonizationConfig: params.colonizationRuntime.getRegionColonizationConfig,
    getRegionDerivedColonizationCosts: params.colonizationRuntime.getRegionDerivedColonizationCosts,
    getPopulationDomainKeys: () => params.worldPopulationRuntime.getPopulationDomainKeys(),
    buildRandomRegionPopulation: (provinceId, domains, populationTotal) =>
      params.worldPopulationRuntime.buildRandomRegionPopulation(
        provinceId,
        domains as PopulationDomainKeys,
        populationTotal,
      ),
    normalizePopulationPops: (rawPops, provinceId, domains) =>
      params.worldPopulationRuntime.normalizePopulationPops(rawPops, provinceId, domains as PopulationDomainKeys),
    isEqualRegionPopulation: params.worldPopulationRuntime.isEqualRegionPopulation,
    cleanupRegionColonizationProgress: params.colonizationRuntime.cleanupRegionColonizationProgress,
    recalculateAllRegionColonizationCosts: params.colonizationRuntime.recalculateAllRegionColonizationCosts,
    ensureCountryInWorldBase: params.countryWorldRuntime.ensureCountryInWorldBase,
    cloneWorldBaseSectionSnapshot: params.worldDeltaBroadcastRuntime.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: params.worldDeltaBroadcastRuntime.broadcastWorldDeltaFromSectionSnapshot,
    makeOfficialNews: (input) => params.makeOfficialNews(input),
    broadcast: params.broadcast,
  });
}
