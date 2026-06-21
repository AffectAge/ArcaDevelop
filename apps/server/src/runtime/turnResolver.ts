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
  resolveArmyMoveOrder: (params: {
    order: Order;
    playerId: string;
    movedDivisionIds: Set<string>;
    rejectedOrders: WorldDelta["rejectedOrders"];
    news: EventLogEntry[];
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
  advanceStoredArmyRoutesTurn: (params: { movedDivisionIds: Set<string>; news: EventLogEntry[] }) => void;
  advanceMilitaryFormationQueue: (news: EventLogEntry[]) => void;
  resolveColonizationSupportTurn: (params: {
    colonizeTargetsByCountry: Map<string, Set<string>>;
    touchedRegionIds: Set<string>;
  }) => void;
  flushResourceLedger: () => void;
  enqueueBuildingAutoUpgradesTurn: () => void;
  resolveBuildingConstructionQueuesTurn: () => void;
  resolveResourceExplorationTurn: () => void;
  resolveTransportCorridorConstructionTurn: () => void;
  resolveColonizationCapturesTurn: (touchedRegionIds: Set<string>) => ColonizationCaptureResult[];
  makeColonizationCaptureNews: (capture: ColonizationCaptureResult) => EventLogEntry;
  applyCountryResourceIncomeTurn: () => void;
  applyPerTurnTreatyMoneyTransfers: () => void;
  resolveTechnologyTurn: (news: EventLogEntry[]) => void;
  autoResolveExpiredCountryEvents: (news: EventLogEntry[]) => void;
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
  const currentOrders = deps.getCurrentOrders(turnId) ?? new Map<string, Order[]>();
  const rejectedOrders: WorldDelta["rejectedOrders"] = [];
  const news: EventLogEntry[] = [];
  const uiNotifications: TUiNotification[] = [];
  const movedDivisionIds = new Set<string>();

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
      if (order.type === "ARMY_MOVE") {
        deps.resolveArmyMoveOrder({ order, playerId, movedDivisionIds, rejectedOrders, news });
      }
      if (order.type === "BUILD") {
        deps.resolveBuildOrder({ order, playerId, rejectedOrders });
      }
      if (order.type === "COLONIZE") {
        deps.resolveColonizeOrder({ order, playerId, colonizeTargetsByCountry, touchedRegionIds, rejectedOrders });
      }
    }
  });

  deps.advanceStoredArmyRoutesTurn({ movedDivisionIds, news });
  deps.advanceMilitaryFormationQueue(news);
  deps.resolveColonizationSupportTurn({ colonizeTargetsByCountry, touchedRegionIds });
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
  deps.resolveTechnologyTurn(news);
  deps.flushResourceLedger();
  deps.autoResolveExpiredCountryEvents(news);
  deps.flushResourceLedger();
  deps.maybeGenerateCountryEvents(news, uiNotifications);
  deps.resolvePopulationTurn();
  deps.resolveParliamentTurn(uiNotifications);

  const nextTurnId = turnId + 1;
  deps.setTurnId(nextTurnId);
  deps.setWorldBaseTurnId(nextTurnId);
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
