import type { Order } from "@arcanorum/shared";
import type { TurnOrderIndexes } from "../mechanics/turnOrderIndexMechanics";

export function createServerTurnStateRuntime(): {
  ordersByTurn: Map<number, Map<string, Order[]>>;
  resolveReadyByTurn: Map<number, Set<string>>;
  activeColonizeRegionsByCountry: Map<string, Set<string>>;
  queuedColonizeRegionsByCountryByTurn: Map<number, Map<string, Set<string>>>;
  queuedBuildRegionsByCountryByTurn: Map<number, Map<string, Set<string>>>;
  turnOrderIndexes: TurnOrderIndexes;
  clearTurnState: () => void;
  clearColonizationQueues: () => void;
} {
  const ordersByTurn = new Map<number, Map<string, Order[]>>();
  const resolveReadyByTurn = new Map<number, Set<string>>();
  const activeColonizeRegionsByCountry = new Map<string, Set<string>>();
  const queuedColonizeRegionsByCountryByTurn = new Map<number, Map<string, Set<string>>>();
  const queuedBuildRegionsByCountryByTurn = new Map<number, Map<string, Set<string>>>();
  const turnOrderIndexes: TurnOrderIndexes = {
    queuedColonizeRegionsByCountryByTurn,
    queuedBuildRegionsByCountryByTurn,
  };

  return {
    ordersByTurn,
    resolveReadyByTurn,
    activeColonizeRegionsByCountry,
    queuedColonizeRegionsByCountryByTurn,
    queuedBuildRegionsByCountryByTurn,
    turnOrderIndexes,
    clearTurnState: () => {
      ordersByTurn.clear();
      resolveReadyByTurn.clear();
    },
    clearColonizationQueues: () => {
      activeColonizeRegionsByCountry.clear();
      queuedColonizeRegionsByCountryByTurn.clear();
      queuedBuildRegionsByCountryByTurn.clear();
    },
  };
}
