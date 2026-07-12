import type { EventLogEntry, Order, WorldDelta } from "@arcanorum/shared";

export type ColonizationCaptureResult = {
  regionId: string;
  winnerCountryId: string;
  previousOwnerId: string | null | undefined;
};

export type TurnResolverDependencies<TSnapshot, TUiNotification> = {
  fullSnapshotMask: number;
  getTurnId: () => number;
  setTurnId: (turnId: number) => void;
  setWorldBaseTurnId: (turnId: number) => void;
  cloneWorldBaseSectionSnapshot: (mask: number) => TSnapshot;
  getCurrentOrders: (turnId: number) => Map<string, Order[]> | undefined;
  getActiveColonizeRegionsByCountry: () => Map<string, Iterable<string>>;
  resolveUnitMoveOrder: (params: {
    order: Order;
    playerId: string;
    movedMapUnitIds: Set<string>;
    rejectedOrders: WorldDelta["rejectedOrders"];
    news: EventLogEntry[];
  }) => void;
  resolveUnitAttackOrder: (params: {
    order: Order;
    playerId: string;
    movedMapUnitIds: Set<string>;
    rejectedOrders: WorldDelta["rejectedOrders"];
    news: EventLogEntry[];
  }) => void;
  resolveUnitPromoteOrder: (params: {
    order: Order;
    playerId: string;
    movedMapUnitIds: Set<string>;
    rejectedOrders: WorldDelta["rejectedOrders"];
  }) => void;
  resolveUnitWaitOrder: (params: {
    order: Order;
    playerId: string;
    movedMapUnitIds: Set<string>;
    rejectedOrders: WorldDelta["rejectedOrders"];
  }) => void;
  resolveBuildOrder: (params: {
    order: Order;
    playerId: string;
    rejectedOrders: WorldDelta["rejectedOrders"];
  }) => void;
  resolveColonizeOrder: (params: {
    order: Order;
    playerId: string;
    colonizeTargetsByCountry: Map<string, Set<string>>;
    touchedRegionIds: Set<string>;
    rejectedOrders: WorldDelta["rejectedOrders"];
  }) => void;
  resolveFoundCityOrder: (params: {
    order: Order;
    playerId: string;
    rejectedOrders: WorldDelta["rejectedOrders"];
  }) => void;
  advanceStoredUnitRoutesTurn: (params: {
    movedMapUnitIds: Set<string>;
    news: EventLogEntry[];
  }) => void;
  refreshMapUnitsForTurn: (turnId: number) => void;
  advanceUnitTrainingQueue: (news: EventLogEntry[]) => void;
  resolveColonizationSupportTurn: (params: {
    colonizeTargetsByCountry: Map<string, Set<string>>;
    touchedRegionIds: Set<string>;
  }) => void;
  resolveSettlementProjectsTurn: (news: EventLogEntry[]) => void;
  flushResourceLedger: () => void;
  enqueueBuildingAutoUpgradesTurn: () => void;
  resolveBuildingConstructionQueuesTurn: () => void;
  resolveResourceExplorationTurn: () => void;
  resolveTransportCorridorConstructionTurn: () => void;
  resolveColonizationCapturesTurn: (touchedRegionIds: Set<string>) => ColonizationCaptureResult[];
  makeColonizationCaptureNews: (capture: ColonizationCaptureResult) => EventLogEntry;
  applyCountryResourceIncomeTurn: () => void;
  applyPerTurnTreatyMoneyTransfers: () => void;
  rechargeDecisionCharges: () => void;
  resolveTechnologyTurn: (news: EventLogEntry[]) => void;
  autoResolveExpiredCountryEvents: (news: EventLogEntry[]) => void;
  resolveJournalEntriesTurn: (news: EventLogEntry[]) => void;
  maybeGenerateCountryEvents: (news: EventLogEntry[], uiNotifications: TUiNotification[]) => void;
  resolvePopulationTurn: () => void;
  resolveParliamentTurn: (uiNotifications: TUiNotification[]) => void;
  resetTurnTimerAnchor: () => void;
  cleanupResolvedTurn: (turnId: number) => void;
  flushPersistentStateNow: () => void | Promise<void>;
};

export type TurnResolverResult<TSnapshot, TUiNotification> = {
  rejectedOrders: WorldDelta["rejectedOrders"];
  news: EventLogEntry[];
  uiNotifications: TUiNotification[];
  previousWorldBase: TSnapshot;
};

export function resolveTurnWithPipeline<TSnapshot, TUiNotification>(
  deps: TurnResolverDependencies<TSnapshot, TUiNotification>,
): TurnResolverResult<TSnapshot, TUiNotification> {
  const turnId = deps.getTurnId();
  const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.fullSnapshotMask);
  const rejectedOrders: WorldDelta["rejectedOrders"] = [];
  const news: EventLogEntry[] = [];
  const uiNotifications: TUiNotification[] = [];
  const movedMapUnitIds = new Set<string>();
  const currentOrders = deps.getCurrentOrders(turnId) ?? new Map<string, Order[]>();

  const colonizeTargetsByCountry = new Map<string, Set<string>>();
  const touchedRegionIds = new Set<string>();
  for (const [countryId, regions] of deps.getActiveColonizeRegionsByCountry().entries()) {
    colonizeTargetsByCountry.set(countryId, new Set(regions));
    for (const regionId of regions) {
      touchedRegionIds.add(regionId);
    }
  }

  currentOrders.forEach((orders, playerId) => {
    for (const order of orders) {
      if (order.type === "UNIT_MOVE") {
        deps.resolveUnitMoveOrder({ order, playerId, movedMapUnitIds, rejectedOrders, news });
      }
      if (order.type === "UNIT_ATTACK") {
        deps.resolveUnitAttackOrder({ order, playerId, movedMapUnitIds, rejectedOrders, news });
      }
      if (order.type === "UNIT_PROMOTE") {
        deps.resolveUnitPromoteOrder({ order, playerId, movedMapUnitIds, rejectedOrders });
      }
      if (order.type === "UNIT_SKIP_TURN" || order.type === "UNIT_SLEEP" || order.type === "UNIT_WAKE" || order.type === "UNIT_FORTIFY") {
        deps.resolveUnitWaitOrder({ order, playerId, movedMapUnitIds, rejectedOrders });
      }
      if (order.type === "BUILD") {
        deps.resolveBuildOrder({ order, playerId, rejectedOrders });
      }
      if (order.type === "COLONIZE") {
        deps.resolveColonizeOrder({ order, playerId, colonizeTargetsByCountry, touchedRegionIds, rejectedOrders });
      }
      if (order.type === "FOUND_CITY") {
        deps.resolveFoundCityOrder({ order, playerId, rejectedOrders });
      }
    }
  });

  deps.advanceUnitTrainingQueue(news);
  deps.resolveColonizationSupportTurn({ colonizeTargetsByCountry, touchedRegionIds });
  deps.resolveSettlementProjectsTurn(news);
  deps.flushResourceLedger();
  deps.enqueueBuildingAutoUpgradesTurn();
  deps.resolveBuildingConstructionQueuesTurn();
  deps.flushResourceLedger();
  deps.resolveResourceExplorationTurn();
  deps.resolveTransportCorridorConstructionTurn();
  deps.flushResourceLedger();

  for (const capture of deps.resolveColonizationCapturesTurn(touchedRegionIds)) {
    news.push(deps.makeColonizationCaptureNews(capture));
  }

  deps.applyCountryResourceIncomeTurn();
  deps.flushResourceLedger();
  deps.applyPerTurnTreatyMoneyTransfers();
  deps.flushResourceLedger();
  deps.rechargeDecisionCharges();
  deps.resolveTechnologyTurn(news);
  deps.flushResourceLedger();
  deps.autoResolveExpiredCountryEvents(news);
  deps.flushResourceLedger();
  deps.resolveJournalEntriesTurn(news);
  deps.flushResourceLedger();
  deps.maybeGenerateCountryEvents(news, uiNotifications);
  deps.resolvePopulationTurn();
  deps.resolveParliamentTurn(uiNotifications);

  const nextTurnId = turnId + 1;
  deps.setTurnId(nextTurnId);
  deps.setWorldBaseTurnId(nextTurnId);
  deps.refreshMapUnitsForTurn(nextTurnId);
  deps.advanceStoredUnitRoutesTurn({ movedMapUnitIds: new Set<string>(), news });
  deps.resetTurnTimerAnchor();
  deps.cleanupResolvedTurn(turnId);
  void deps.flushPersistentStateNow();

  return {
    previousWorldBase,
    rejectedOrders,
    news,
    uiNotifications,
  };
}
