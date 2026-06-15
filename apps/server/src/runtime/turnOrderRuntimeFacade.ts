import type { Order } from "@arcanorum/shared";
import {
  addOrderToTurnIndexes as addOrderToTurnIndexesInState,
  dropTurnOrderIndexes as dropTurnOrderIndexesInState,
  rebuildTurnOrderIndexes as rebuildTurnOrderIndexesInState,
  removeOrderFromTurnIndexes as removeOrderFromTurnIndexesInState,
  type TurnOrderIndexes,
} from "../mechanics/turnOrderIndexMechanics";

type TurnOrderRuntimeFacadeParams = {
  getTurnOrderIndexes: () => TurnOrderIndexes;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
};

export function createTurnOrderRuntimeFacade(params: TurnOrderRuntimeFacadeParams) {
  function addOrderToTurnIndexes(order: Order): void {
    addOrderToTurnIndexesInState(params.getTurnOrderIndexes(), order);
  }

  function removeOrderFromTurnIndexes(order: Order): void {
    removeOrderFromTurnIndexesInState(params.getTurnOrderIndexes(), order);
  }

  function rebuildTurnOrderIndexes(): void {
    rebuildTurnOrderIndexesInState(params.getTurnOrderIndexes(), params.getOrdersByTurn());
  }

  function dropTurnOrderIndexes(turn: number): void {
    dropTurnOrderIndexesInState(params.getTurnOrderIndexes(), turn);
  }

  return {
    addOrderToTurnIndexes,
    dropTurnOrderIndexes,
    rebuildTurnOrderIndexes,
    removeOrderFromTurnIndexes,
  };
}
