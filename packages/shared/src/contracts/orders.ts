import type { HexId } from "./hex-map";

export type OrderType = "BUILD" | "BUDGET" | "ARMY_MOVE" | "COLONIZE";

export type OrderBase = {
  id: string;
  turnId: number;
  playerId: string;
  countryId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type BuildOrder = OrderBase & {
  type: "BUILD";
  regionId: string;
  targetHexId: HexId;
};

export type BudgetOrder = OrderBase & {
  type: "BUDGET";
  regionId?: string;
};

export type ArmyMoveOrder = OrderBase & {
  type: "ARMY_MOVE";
  targetHexId: HexId;
};

export type ColonizeOrder = OrderBase & {
  type: "COLONIZE";
  regionId: string;
};

export type Order = BuildOrder | BudgetOrder | ArmyMoveOrder | ColonizeOrder;
export type OrderInput = Order extends infer T ? T extends Order ? Omit<T, "id" | "createdAt"> : never : never;

export type OrderDelta = {
  type: "ORDER_DELTA";
  order: OrderInput;
};
