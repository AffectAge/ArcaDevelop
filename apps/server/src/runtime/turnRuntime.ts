import { randomUUID } from "node:crypto";
import { WORLD_DELTA_MASK, type BuildingOwner, type CountryParliament, type EventLogEntry, type Order, type WorldBase, type WorldDelta, type WsOutMessage } from "@arcanorum/shared";
import { applyCountryResourceIncomeTurn, type EconomyTickResourceStat } from "../mechanics/economyTickMechanics";
import {
  advanceMilitaryFormationQueue as advanceMilitaryFormationQueueInState,
  advanceStoredArmyRoutesTurn,
  resolveArmyMoveOrder,
  type MilitaryRuntimeEvent,
} from "../mechanics/militaryMechanics";
import { resolveBuildOrder } from "../mechanics/buildingMechanics";
import {
  resolveColonizationCapturesTurn,
  resolveColonizationSupportTurn,
  resolveColonizeOrder,
  type RegionColonizationConfig,
} from "../mechanics/colonizationMechanics";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import { resolveTurnWithPipeline, type TurnResolverResult } from "./turnResolver";
import type { GameContentEntry, GameSettings } from "./gameSettingsTypes";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";

type CountryEventUiNotification = {
  countryId: string;
  notification: Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"];
};

export const TURN_RESOLVE_WORLD_DELTA_MASK =
  WORLD_DELTA_MASK.resourcesByCountry |
  WORLD_DELTA_MASK.provinceOwner |
  WORLD_DELTA_MASK.regionOwner |
  WORLD_DELTA_MASK.regionController |
  WORLD_DELTA_MASK.colonyProgressByRegion |
  WORLD_DELTA_MASK.regionPopulationByRegion |
  WORLD_DELTA_MASK.regionBuildingsByRegion |
  WORLD_DELTA_MASK.regionBuildingDucatsByRegion |
  WORLD_DELTA_MASK.regionPopulationTreasuryByRegion |
  WORLD_DELTA_MASK.regionConstructionQueueByRegion |
  WORLD_DELTA_MASK.regionResourceDepositsByRegion |
  WORLD_DELTA_MASK.regionResourceExplorationQueueByRegion |
  WORLD_DELTA_MASK.regionResourceExplorationCountByRegion |
  WORLD_DELTA_MASK.parliamentByCountry |
  WORLD_DELTA_MASK.technologyByCountry |
  WORLD_DELTA_MASK.countryEventsByCountryId |
  WORLD_DELTA_MASK.divisionsById |
  WORLD_DELTA_MASK.militaryFormationQueueByCountry;

type TurnRuntimeParams = {
  getWorldBase: () => WorldBase;
  setWorldBase: (worldBase: WorldBase) => void;
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  setTurnId: (turnId: number) => void;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getResolveReadyByTurn: () => Map<number, Set<string>>;
  getActiveColonizeRegionsByCountry: () => Map<string, Set<string>>;
  getProvinceIndex: () => Adm1ProvinceIndexEntry[];
  getEconomyTickCountryIds: () => Set<string>;
  fullSnapshotMask: number;
  cloneWorldBaseSectionSnapshot: (mask: number) => WorldBaseSectionSnapshot;
  broadcastWorldDeltaFromSectionSnapshot: (
    previousWorldBase: WorldBaseSectionSnapshot,
    rejectedOrders?: WorldDelta["rejectedOrders"],
  ) => void;
  broadcast: (message: WsOutMessage) => void;
  sendUiNotificationToCountry: (
    countryId: string,
    notification: Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"],
  ) => void;
  dropTurnOrderIndexes: (turnId: number) => void;
  flushPersistentStateNow: () => void | Promise<void>;
  resetTurnTimerAnchor: () => void;
  parseRequestedBuildingIdFromPayload: (payload: Record<string, unknown>) => string;
  resolveBuildingOwnerFromPayload: (payload: Record<string, unknown>, requestedByCountryId: string) => BuildingOwner | null;
  isCountryAllowedForBuildingSync: (building: GameContentEntry, countryId: string) => boolean;
  getProvinceBuildRestriction: (building: GameContentEntry, provinceId: string) => string | null;
  isBuildingUnlockedForCountry: (buildingId: string, countryId: string) => boolean;
  countBuildingOccurrences: (
    buildingId: string,
    countryId: string,
    options?: { includePendingOrders?: boolean },
  ) => { byCountry: number; global: number };
  resolveModifiedValue: (
    stat: EconomyTickResourceStat | "building_construction_cost" | "technology_cost",
    base: number,
    context: { countryId: string; provinceId?: string | null; buildingId?: string | null },
  ) => number;
  getRegionColonizationConfig: (provinceId: string) => RegionColonizationConfig;
  getRegionDerivedColonizationCosts: (provinceId: string) => { pointsCost: number; ducatsCost: number };
  areProvinceIdsAdjacentOrSame: (fromProvinceId: string, toProvinceId: string) => boolean;
  enqueueBuildingAutoUpgradesTurn: () => void;
  resolveBuildingConstructionQueuesTurn: () => void;
  resolveResourceExplorationTurn: () => void;
  resolveTransportCorridorConstructionTurn: () => void;
  applyPerTurnTreatyMoneyTransfers: () => void;
  resolveTechnologyTurn: (news: EventLogEntry[]) => void;
  autoResolveExpiredCountryEvents: (news: EventLogEntry[]) => void;
  maybeGenerateCountryEvents: (news: EventLogEntry[], uiNotifications: CountryEventUiNotification[]) => void;
  resolvePopulationTurn: () => void;
  resolveParliamentTurn: () => Array<{ countryId: string; parliament: CountryParliament }>;
  makeElectionResultsUiNotification: (params: {
    countryId: string;
    parliament: CountryParliament;
  }) => Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"];
  makeOfficialNews: (input: {
    turn: number;
    category: EventLogEntry["category"];
    title: string;
    message: string;
    countryId: string;
    priority: EventLogEntry["priority"];
    visibility: EventLogEntry["visibility"];
  }) => EventLogEntry;
};

type TurnRuntimeResult = TurnResolverResult<WorldBaseSectionSnapshot, CountryEventUiNotification>;

export function createTurnRuntime(params: TurnRuntimeParams) {
  let isResolvingTurnNow = false;

  const pushMilitaryRuntimeEvents = (news: EventLogEntry[], events: MilitaryRuntimeEvent[]): void => {
    for (const event of events) {
      news.push(
        params.makeOfficialNews({
          turn: params.getTurnId(),
          category: event.category,
          title: event.title,
          message: event.message,
          countryId: event.countryId,
          priority: event.priority,
          visibility: event.visibility,
        }),
      );
    }
  };

  const advanceMilitaryFormationQueue = (news: EventLogEntry[]): void => {
    const events: MilitaryRuntimeEvent[] = [];
    advanceMilitaryFormationQueueInState({
      worldBase: params.getWorldBase(),
      turnId: params.getTurnId(),
      createId: randomUUID,
      events,
    });
    pushMilitaryRuntimeEvents(news, events);
  };

  const resolveTurn = (): TurnRuntimeResult =>
    resolveTurnWithPipeline<WorldBaseSectionSnapshot, CountryEventUiNotification>({
      fullSnapshotMask: params.fullSnapshotMask,
      getTurnId: params.getTurnId,
      setTurnId: params.setTurnId,
      setWorldBaseTurnId: (nextTurnId) => {
        params.setWorldBase({ ...params.getWorldBase(), turnId: nextTurnId });
      },
      cloneWorldBaseSectionSnapshot: params.cloneWorldBaseSectionSnapshot,
      getCurrentOrders: (currentTurnId) => params.getOrdersByTurn().get(currentTurnId),
      getActiveColonizeRegionsByCountry: params.getActiveColonizeRegionsByCountry,
      resolveArmyMoveOrder: ({ order, playerId, movedDivisionIds, rejectedOrders, news }) => {
        const events: MilitaryRuntimeEvent[] = [];
        const result = resolveArmyMoveOrder({
          order,
          playerId,
          worldBase: params.getWorldBase(),
          provinces: params.getProvinceIndex(),
          turnId: params.getTurnId(),
          movedDivisionIds,
          events,
          areProvinceIdsAdjacentOrSame: params.areProvinceIdsAdjacentOrSame,
        });
        if (result.rejectedOrder) rejectedOrders.push(result.rejectedOrder);
        pushMilitaryRuntimeEvents(news, events);
      },
      resolveBuildOrder: ({ order, playerId, rejectedOrders }) => {
        const buildingById = new Map(params.getGameSettings().content.buildings.map((entry) => [entry.id, entry] as const));
        const result = resolveBuildOrder({
          order,
          playerId,
          worldBase: params.getWorldBase(),
          buildingById,
          turnId: params.getTurnId(),
          parseRequestedBuildingId: params.parseRequestedBuildingIdFromPayload,
          resolveBuildingOwner: params.resolveBuildingOwnerFromPayload,
          isCountryAllowedForBuilding: params.isCountryAllowedForBuildingSync,
          getProvinceBuildRestriction: params.getProvinceBuildRestriction,
          isBuildingUnlockedForCountry: params.isBuildingUnlockedForCountry,
          countBuildingOccurrences: (buildingId, countryId) =>
            params.countBuildingOccurrences(buildingId, countryId, { includePendingOrders: false }),
          resolveConstructionCost: (building) =>
            params.resolveModifiedValue("building_construction_cost", Number(building.costConstruction ?? 100), {
              countryId: order.countryId,
              provinceId: order.type === "BUILD" ? order.regionId : "",
              buildingId: building.id,
            }),
          createId: randomUUID,
        });
        if (result.rejectedOrder) rejectedOrders.push(result.rejectedOrder);
      },
      resolveColonizeOrder: ({ order, playerId, colonizeTargetsByCountry, touchedRegionIds, rejectedOrders }) => {
        const result = resolveColonizeOrder({
          order,
          playerId,
          worldBase: params.getWorldBase(),
          colonizeTargetsByCountry,
          touchedRegionIds,
          getRegionColonizationConfig: params.getRegionColonizationConfig,
        });
        if (result.rejectedOrder) rejectedOrders.push(result.rejectedOrder);
      },
      advanceStoredArmyRoutesTurn: ({ movedDivisionIds, news }) => {
        const storedRouteEvents: MilitaryRuntimeEvent[] = [];
        advanceStoredArmyRoutesTurn({
          worldBase: params.getWorldBase(),
          provinces: params.getProvinceIndex(),
          turnId: params.getTurnId(),
          movedDivisionIds,
          events: storedRouteEvents,
          areProvinceIdsAdjacentOrSame: params.areProvinceIdsAdjacentOrSame,
        });
        pushMilitaryRuntimeEvents(news, storedRouteEvents);
      },
      advanceMilitaryFormationQueue,
      resolveColonizationSupportTurn: ({ colonizeTargetsByCountry, touchedRegionIds }) => {
        resolveColonizationSupportTurn({
          colonizeTargetsByCountry,
          worldBase: params.getWorldBase(),
          defaultColonizationPointsPerTurn: params.getGameSettings().colonization.pointsPerTurn,
          touchedRegionIds,
          activeColonizeRegionsByCountry: params.getActiveColonizeRegionsByCountry(),
          getRegionColonizationConfig: params.getRegionColonizationConfig,
          getRegionDerivedColonizationCosts: params.getRegionDerivedColonizationCosts,
        });
      },
      enqueueBuildingAutoUpgradesTurn: params.enqueueBuildingAutoUpgradesTurn,
      resolveBuildingConstructionQueuesTurn: params.resolveBuildingConstructionQueuesTurn,
      resolveResourceExplorationTurn: params.resolveResourceExplorationTurn,
      resolveTransportCorridorConstructionTurn: params.resolveTransportCorridorConstructionTurn,
      resolveColonizationCapturesTurn: (touchedRegionIds) =>
        resolveColonizationCapturesTurn({
          touchedRegionIds,
          worldBase: params.getWorldBase(),
          activeColonizeRegionsByCountry: params.getActiveColonizeRegionsByCountry(),
          getRegionColonizationConfig: params.getRegionColonizationConfig,
        }),
      makeColonizationCaptureNews: ({ regionId, winnerCountryId, previousOwnerId }) =>
        params.makeOfficialNews({
          turn: params.getTurnId(),
          category: "colonization",
          title: "Успешная колонизация",
          message:
            previousOwnerId && previousOwnerId !== winnerCountryId
              ? `Регион ${regionId} перешел от ${previousOwnerId} к ${winnerCountryId}`
              : `Регион ${regionId} закреплен за ${winnerCountryId}`,
          countryId: winnerCountryId,
          priority: "medium",
          visibility: "public",
        }),
      applyCountryResourceIncomeTurn: () => {
        const gameSettings = params.getGameSettings();
        applyCountryResourceIncomeTurn({
          countryIds: params.getEconomyTickCountryIds(),
          resourcesByCountry: params.getWorldBase().resourcesByCountry,
          baseValues: {
            baseCulturePerTurn: gameSettings.economy.baseCulturePerTurn,
            baseSciencePerTurn: gameSettings.economy.baseSciencePerTurn,
            baseReligionPerTurn: gameSettings.economy.baseReligionPerTurn,
            colonizationPointsPerTurn: gameSettings.colonization.pointsPerTurn,
            baseConstructionPerTurn: gameSettings.economy.baseConstructionPerTurn,
            baseDucatsPerTurn: gameSettings.economy.baseDucatsPerTurn,
            baseGoldPerTurn: gameSettings.economy.baseGoldPerTurn,
          },
          resolveModifiedValue: params.resolveModifiedValue,
        });
      },
      applyPerTurnTreatyMoneyTransfers: params.applyPerTurnTreatyMoneyTransfers,
      resolveTechnologyTurn: params.resolveTechnologyTurn,
      autoResolveExpiredCountryEvents: params.autoResolveExpiredCountryEvents,
      maybeGenerateCountryEvents: params.maybeGenerateCountryEvents,
      resolvePopulationTurn: params.resolvePopulationTurn,
      resolveParliamentTurn: (uiNotifications) => {
        const electionResults = params.resolveParliamentTurn();
        for (const result of electionResults) {
          uiNotifications.push({
            countryId: result.countryId,
            notification: params.makeElectionResultsUiNotification(result),
          });
        }
      },
      resetTurnTimerAnchor: params.resetTurnTimerAnchor,
      cleanupResolvedTurn: (resolvedTurnId) => {
        params.getOrdersByTurn().delete(resolvedTurnId);
        params.dropTurnOrderIndexes(resolvedTurnId);
        params.getResolveReadyByTurn().delete(resolvedTurnId);
      },
      flushPersistentStateNow: params.flushPersistentStateNow,
    });

  const resolveAndBroadcastCurrentTurn = (): boolean => {
    if (isResolvingTurnNow) return false;
    isResolvingTurnNow = true;
    try {
      const { previousWorldBase, rejectedOrders, news, uiNotifications } = resolveTurn();
      params.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase, rejectedOrders);
      for (const event of news) {
        params.broadcast({ type: "NEWS_EVENT", event });
      }
      for (const item of uiNotifications) {
        params.sendUiNotificationToCountry(item.countryId, item.notification);
      }
      return true;
    } finally {
      isResolvingTurnNow = false;
    }
  };

  return {
    resolveTurn,
    resolveAndBroadcastCurrentTurn,
  };
}
