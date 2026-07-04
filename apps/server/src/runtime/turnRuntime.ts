import { randomUUID } from "node:crypto";
import {
  WORLD_DELTA_MASK,
  type BuildingOwner,
  type CountryParliament,
  type EventLogEntry,
  type HexId,
  type Order,
  type RegionPopulation,
  type UnitDomain,
  type WorldBase,
  type WorldDelta,
  type WsOutMessage,
} from "@arcanorum/shared";
import { applyCountryResourceIncomeTurn, type EconomyTickResourceStat } from "../mechanics/economyTickMechanics";
import { resolveBuildOrder } from "../mechanics/buildingMechanics";
import {
  resolveColonizationCapturesTurn,
  resolveColonizationSupportTurn,
  resolveColonizeOrder,
  type RegionColonizationConfig,
} from "../mechanics/colonizationMechanics";
import {
  makeSettlementCompletionNews,
  resolveFoundCityOrder,
  resolveSettlementProjectsTurn,
} from "../mechanics/settlementMechanics";
import {
  advanceStoredMapUnitRoutesTurn,
  advanceUnitTrainingQueueTurn,
  resolveMapUnitAttackOrder,
  resolveMapUnitMoveOrder,
  resolveMapUnitWaitOrder,
} from "../mechanics/mapUnitMechanics";
import type { HexMapIndexEntry } from "../map/hexIndex";
import { resolveTurnWithPipeline, type TurnResolverResult } from "./turnResolver";
import type { GameContentEntry, GameSettings } from "./gameSettingsTypes";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";

type CountryEventUiNotification = {
  countryId: string;
  notification: Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"];
};

export const TURN_RESOLVE_WORLD_DELTA_MASK =
  WORLD_DELTA_MASK.resourcesByCountry |
  WORLD_DELTA_MASK.resourceLedgerByTurn |
  WORLD_DELTA_MASK.hexOwner |
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
  WORLD_DELTA_MASK.countryDecisionsByCountryId |
  WORLD_DELTA_MASK.countryEventsByCountryId |
  WORLD_DELTA_MASK.countryScheduledEventsByCountryId |
  WORLD_DELTA_MASK.countryEventFlagsByCountryId |
  WORLD_DELTA_MASK.journalEntriesByCountryId |
  WORLD_DELTA_MASK.countryModifiersByCountryId |
  WORLD_DELTA_MASK.explanationRecordsByTurn |
  WORLD_DELTA_MASK.unitEquipmentState;

export type AiTurnBeforeResolveHookParams = {
  turnId: number;
  aiSettings: GameSettings["ai"];
};

export type AiTurnBeforeResolveHook = (params: AiTurnBeforeResolveHookParams) => void | Promise<void>;

type TurnRuntimeParams = {
  getWorldBase: () => WorldBase;
  setWorldBase: (worldBase: WorldBase) => void;
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  setTurnId: (turnId: number) => void;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getResolveReadyByTurn: () => Map<number, Set<string>>;
  getActiveColonizeRegionsByCountry: () => Map<string, Set<string>>;
  getHexIndex: () => HexMapIndexEntry[];
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
  runAiTurnBeforeResolve?: AiTurnBeforeResolveHook;
  parseRequestedBuildingIdFromPayload: (payload: Record<string, unknown>) => string;
  resolveBuildingOwnerFromPayload: (payload: Record<string, unknown>, requestedByCountryId: string) => BuildingOwner | null;
  isCountryAllowedForBuildingSync: (building: GameContentEntry, countryId: string) => boolean;
  getHexBuildRestriction: (building: GameContentEntry, hexId: string, regionId: string, countryId: string) => string | null;
  isBuildingUnlockedForCountry: (buildingId: string, countryId: string) => boolean;
  countBuildingOccurrences: (
    buildingId: string,
    countryId: string,
    options?: { includePendingOrders?: boolean },
  ) => { byCountry: number; global: number };
  resolveModifiedValue: (
    stat: EconomyTickResourceStat | "building_construction_cost" | "technology_cost" | "hex_movement_cost",
    base: number,
    context: { countryId: string; hexId?: string | null; buildingId?: string | null },
  ) => number;
  getRegionColonizationConfig: (hexId: string) => RegionColonizationConfig;
  getRegionDerivedColonizationCosts: (hexId: string) => { pointsCost: number; ducatsCost: number };
  buildColonizationSettlementPopulation: (regionId: string, countryId: string, total: number) => RegionPopulation;
  areHexIdsAdjacentOrSame: (fromHexId: string, toHexId: string) => boolean;
  getHexMovementCost: (hexId: string, countryId?: string, fromHexId?: string, unitDomain?: UnitDomain) => number;
  enqueueBuildingAutoUpgradesTurn: () => void;
  resolveBuildingConstructionQueuesTurn: () => void;
  addResourceLedgerIncome: (input: ResourceLedgerEntryInput) => void;
  addResourceLedgerExpense: (input: ResourceLedgerEntryInput) => void;
  flushResourceLedger: () => void;
  resolveResourceExplorationTurn: () => void;
  resolveTransportCorridorConstructionTurn: () => void;
  applyPerTurnTreatyMoneyTransfers: () => void;
  rechargeDecisionCharges: () => void;
  resolveTechnologyTurn: (news: EventLogEntry[]) => void;
  autoResolveExpiredCountryEvents: (news: EventLogEntry[]) => void;
  resolveJournalEntriesTurn: (news: EventLogEntry[]) => void;
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

  let neighborHexIdsByHexId: Map<string, HexId[]> | null = null;
  const getNeighborHexIds = (hexId: HexId): HexId[] => {
    if (!neighborHexIdsByHexId) {
      neighborHexIdsByHexId = new Map(
        params.getHexIndex().map((hex) => [
          hex.id,
          (hex.neighbors ?? []).filter((neighborId): neighborId is HexId => /^hex:-?\d+:-?\d+$/.test(neighborId)),
        ]),
      );
    }
    return neighborHexIdsByHexId.get(hexId) ?? [];
  };
  let hexByIdForFleetMovement: Map<string, HexMapIndexEntry> | null = null;
  const getHexForUnitMovement = (hexId: HexId): HexMapIndexEntry | null => {
    if (!hexByIdForFleetMovement) {
      hexByIdForFleetMovement = new Map(params.getHexIndex().map((hex) => [hex.id, hex] as const));
    }
    return hexByIdForFleetMovement.get(hexId) ?? null;
  };

  const resolveTurn = async (): Promise<TurnRuntimeResult> => {
    const gameSettings = params.getGameSettings();
    await runAiTurnBeforeResolveIfEnabled({
      turnId: params.getTurnId(),
      aiSettings: gameSettings.ai,
      runAiTurnBeforeResolve: params.runAiTurnBeforeResolve,
    });

    return resolveTurnWithPipeline<WorldBaseSectionSnapshot, CountryEventUiNotification>({
      fullSnapshotMask: params.fullSnapshotMask,
      getTurnId: params.getTurnId,
      setTurnId: params.setTurnId,
      setWorldBaseTurnId: (nextTurnId) => {
        params.setWorldBase({ ...params.getWorldBase(), turnId: nextTurnId });
      },
      cloneWorldBaseSectionSnapshot: params.cloneWorldBaseSectionSnapshot,
      getCurrentOrders: (currentTurnId) => params.getOrdersByTurn().get(currentTurnId),
      getActiveColonizeRegionsByCountry: params.getActiveColonizeRegionsByCountry,
      resolveUnitMoveOrder: ({ order, playerId, movedMapUnitIds, rejectedOrders, news }) => {
        if (order.type === "UNIT_MOVE" && order.unitKind === "map") {
          const result = resolveMapUnitMoveOrder({
            order,
            playerId,
            worldBase: params.getWorldBase(),
            unitTypes: params.getGameSettings().content.unitTypes,
            turnId: params.getTurnId(),
            movedUnitIds: movedMapUnitIds,
            news,
            areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame as (fromHexId: HexId, toHexId: HexId) => boolean,
            getNeighborHexIds,
            getHexMovementCost: params.getHexMovementCost as (hexId: HexId, countryId?: string, fromHexId?: HexId, unitDomain?: UnitDomain) => number,
            getHex: getHexForUnitMovement,
          });
          if (result.rejectedOrder) rejectedOrders.push(result.rejectedOrder);
          return;
        }
        rejectedOrders.push({ playerId, reason: "UNIT_MOVE_KIND_UNSUPPORTED", tempOrderId: order.id });
      },
      resolveUnitAttackOrder: ({ order, playerId, movedMapUnitIds, rejectedOrders, news }) => {
        if (order.type === "UNIT_ATTACK" && params.getWorldBase().unitsById?.[order.attackerUnitId]) {
          const result = resolveMapUnitAttackOrder({
            order,
            playerId,
            worldBase: params.getWorldBase(),
            unitTypes: params.getGameSettings().content.unitTypes,
            turnId: params.getTurnId(),
            movedUnitIds: movedMapUnitIds,
            news,
            areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame as (fromHexId: HexId, toHexId: HexId) => boolean,
          });
          if (result.rejectedOrder) rejectedOrders.push(result.rejectedOrder);
          return;
        }
        rejectedOrders.push({ playerId, reason: "UNIT_ATTACK_ATTACKER_NOT_FOUND", tempOrderId: order.id });
      },
      resolveUnitWaitOrder: ({ order, playerId, movedMapUnitIds, rejectedOrders }) => {
        const result = resolveMapUnitWaitOrder({
          order,
          playerId,
          worldBase: params.getWorldBase(),
          turnId: params.getTurnId(),
          movedUnitIds: movedMapUnitIds,
        });
        if (result.rejectedOrder) rejectedOrders.push(result.rejectedOrder);
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
          getHexBuildRestriction: params.getHexBuildRestriction,
          isBuildingUnlockedForCountry: params.isBuildingUnlockedForCountry,
          countBuildingOccurrences: (buildingId, countryId) =>
            params.countBuildingOccurrences(buildingId, countryId, { includePendingOrders: false }),
          resolveConstructionCost: (building) =>
            params.resolveModifiedValue("building_construction_cost", Number(building.costConstruction ?? 100), {
              countryId: order.countryId,
              hexId: order.type === "BUILD" ? order.targetHexId : "",
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
      resolveFoundCityOrder: ({ order, playerId, rejectedOrders }) => {
        const hexRegionById = new Map(params.getHexIndex().map((hex) => [hex.id, hex.regionId ?? null] as const));
        const result = resolveFoundCityOrder({
          order,
          playerId,
          worldBase: params.getWorldBase(),
          unitTypes: params.getGameSettings().content.unitTypes,
          getHexRegionId: (hexId) => hexRegionById.get(hexId) ?? null,
          getRegionColonizationConfig: params.getRegionColonizationConfig,
          createId: randomUUID,
          turnId: params.getTurnId(),
        });
        if (result.rejectedOrder) rejectedOrders.push(result.rejectedOrder);
      },
      advanceStoredUnitRoutesTurn: ({ movedMapUnitIds, news }) => {
        advanceStoredMapUnitRoutesTurn({
          worldBase: params.getWorldBase(),
          unitTypes: params.getGameSettings().content.unitTypes,
          turnId: params.getTurnId(),
          movedUnitIds: movedMapUnitIds,
          news,
          getHexMovementCost: params.getHexMovementCost as (hexId: HexId, countryId?: string, fromHexId?: HexId, unitDomain?: UnitDomain) => number,
        });
      },
      advanceUnitTrainingQueue: (news) => {
        advanceUnitTrainingQueueTurn({
          worldBase: params.getWorldBase(),
          unitTypes: params.getGameSettings().content.unitTypes,
          turnId: params.getTurnId(),
          news,
        });
      },
      resolveColonizationSupportTurn: ({ colonizeTargetsByCountry, touchedRegionIds }) => {
        resolveColonizationSupportTurn({
          colonizeTargetsByCountry,
          worldBase: params.getWorldBase(),
          defaultColonizationPointsPerTurn: params.getGameSettings().colonization.pointsPerTurn,
          touchedRegionIds,
          activeColonizeRegionsByCountry: params.getActiveColonizeRegionsByCountry(),
          getRegionColonizationConfig: params.getRegionColonizationConfig,
          getRegionDerivedColonizationCosts: params.getRegionDerivedColonizationCosts,
          addExpense: params.addResourceLedgerExpense,
        });
      },
      resolveSettlementProjectsTurn: (news) => {
        const result = resolveSettlementProjectsTurn({
          worldBase: params.getWorldBase(),
          turnId: params.getTurnId(),
          defaultColonizationPointsPerTurn: params.getGameSettings().colonization.pointsPerTurn,
          settlementPopulationOnCapture: params.getGameSettings().colonization.settlementPopulationOnCapture,
          buildSettlementPopulation: params.buildColonizationSettlementPopulation,
          createId: randomUUID,
          addExpense: params.addResourceLedgerExpense,
        });
        for (const completion of result.completed) {
          news.push(makeSettlementCompletionNews({ completion, turn: params.getTurnId(), makeId: randomUUID }));
        }
      },
      enqueueBuildingAutoUpgradesTurn: params.enqueueBuildingAutoUpgradesTurn,
      resolveBuildingConstructionQueuesTurn: params.resolveBuildingConstructionQueuesTurn,
      flushResourceLedger: params.flushResourceLedger,
      resolveResourceExplorationTurn: params.resolveResourceExplorationTurn,
      resolveTransportCorridorConstructionTurn: params.resolveTransportCorridorConstructionTurn,
      resolveColonizationCapturesTurn: (touchedRegionIds) =>
        resolveColonizationCapturesTurn({
          touchedRegionIds,
          worldBase: params.getWorldBase(),
          activeColonizeRegionsByCountry: params.getActiveColonizeRegionsByCountry(),
          getRegionColonizationConfig: params.getRegionColonizationConfig,
          settlementEnabled: params.getGameSettings().colonization.settlementEnabled,
          settlementPopulationOnCapture: params.getGameSettings().colonization.settlementPopulationOnCapture,
          buildSettlementPopulation: params.buildColonizationSettlementPopulation,
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
          addIncome: params.addResourceLedgerIncome,
        });
      },
      applyPerTurnTreatyMoneyTransfers: params.applyPerTurnTreatyMoneyTransfers,
      rechargeDecisionCharges: params.rechargeDecisionCharges,
      resolveTechnologyTurn: params.resolveTechnologyTurn,
      autoResolveExpiredCountryEvents: params.autoResolveExpiredCountryEvents,
      resolveJournalEntriesTurn: params.resolveJournalEntriesTurn,
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
  };

  const resolveAndBroadcastCurrentTurn = async (): Promise<boolean> => {
    if (isResolvingTurnNow) return false;
    isResolvingTurnNow = true;
    try {
      const { previousWorldBase, rejectedOrders, news, uiNotifications } = await resolveTurn();
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

export function runAiTurnBeforeResolveIfEnabled(params: {
  turnId: number;
  aiSettings: GameSettings["ai"];
  runAiTurnBeforeResolve?: AiTurnBeforeResolveHook;
}): Promise<boolean> {
  if (!params.aiSettings.enabled || !params.runAiTurnBeforeResolve) return Promise.resolve(false);
  return Promise.resolve(params.runAiTurnBeforeResolve({ turnId: params.turnId, aiSettings: params.aiSettings })).then(
    () => true,
  );
}
