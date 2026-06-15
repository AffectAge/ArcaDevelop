import type { Order } from "@arcanorum/shared";

export type TurnRegionIndex = Map<number, Map<string, Set<string>>>;

export type TurnOrderIndexes = {
  queuedColonizeRegionsByCountryByTurn: TurnRegionIndex;
  queuedBuildRegionsByCountryByTurn: TurnRegionIndex;
};

export function addQueuedRegionIndexEntry(
  indexByTurn: TurnRegionIndex,
  turn: number,
  countryId: string,
  regionId: string,
): void {
  const byCountry = indexByTurn.get(turn) ?? new Map<string, Set<string>>();
  const regions = byCountry.get(countryId) ?? new Set<string>();
  regions.add(regionId);
  byCountry.set(countryId, regions);
  indexByTurn.set(turn, byCountry);
}

export function removeQueuedRegionIndexEntry(
  indexByTurn: TurnRegionIndex,
  turn: number,
  countryId: string,
  regionId: string,
): void {
  const byCountry = indexByTurn.get(turn);
  if (!byCountry) return;
  const regions = byCountry.get(countryId);
  if (!regions) return;
  regions.delete(regionId);
  if (regions.size === 0) {
    byCountry.delete(countryId);
  }
  if (byCountry.size === 0) {
    indexByTurn.delete(turn);
  }
}

export function addOrderToTurnIndexes(indexes: TurnOrderIndexes, order: Order): void {
  if (order.type === "COLONIZE") {
    addQueuedRegionIndexEntry(
      indexes.queuedColonizeRegionsByCountryByTurn,
      order.turnId,
      order.countryId,
      order.regionId,
    );
    return;
  }
  if (order.type === "BUILD") {
    addQueuedRegionIndexEntry(
      indexes.queuedBuildRegionsByCountryByTurn,
      order.turnId,
      order.countryId,
      order.regionId,
    );
  }
}

export function removeOrderFromTurnIndexes(indexes: TurnOrderIndexes, order: Order): void {
  if (order.type === "COLONIZE") {
    removeQueuedRegionIndexEntry(
      indexes.queuedColonizeRegionsByCountryByTurn,
      order.turnId,
      order.countryId,
      order.regionId,
    );
    return;
  }
  if (order.type === "BUILD") {
    removeQueuedRegionIndexEntry(
      indexes.queuedBuildRegionsByCountryByTurn,
      order.turnId,
      order.countryId,
      order.regionId,
    );
  }
}

export function rebuildTurnOrderIndexes(
  indexes: TurnOrderIndexes,
  ordersByTurn: Map<number, Map<string, Order[]>>,
): void {
  indexes.queuedColonizeRegionsByCountryByTurn.clear();
  indexes.queuedBuildRegionsByCountryByTurn.clear();
  for (const players of ordersByTurn.values()) {
    for (const playerOrders of players.values()) {
      for (const order of playerOrders) {
        addOrderToTurnIndexes(indexes, order);
      }
    }
  }
}

export function dropTurnOrderIndexes(indexes: TurnOrderIndexes, turn: number): void {
  indexes.queuedColonizeRegionsByCountryByTurn.delete(turn);
  indexes.queuedBuildRegionsByCountryByTurn.delete(turn);
}
