import type { HexId } from "./hex-map";
import type { UnitSkillId } from "./units";

export type OrderType =
  | "BUILD"
  | "BUDGET"
  | "COLONIZE"
  | "UNIT_MOVE"
  | "UNIT_ATTACK"
  | "UNIT_PROMOTE"
  | "UNIT_SKIP_TURN"
  | "UNIT_SLEEP"
  | "UNIT_WAKE"
  | "UNIT_FORTIFY"
  | "FOUND_CITY";

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

export type ColonizeOrder = OrderBase & {
  type: "COLONIZE";
  regionId: string;
};

export type UnitMoveOrder = OrderBase & {
  type: "UNIT_MOVE";
  unitId: string;
  targetHexId: HexId;
  path: HexId[];
};

export type UnitAttackOrder = OrderBase & {
  type: "UNIT_ATTACK";
  attackerUnitId: string;
  targetHexId: HexId;
  targetUnitId?: string;
};

export type UnitPromoteOrder = OrderBase & {
  type: "UNIT_PROMOTE";
  unitId: string;
  choiceGroupId: string;
  skillIds: UnitSkillId[];
};

export type UnitSkipTurnOrder = OrderBase & {
  type: "UNIT_SKIP_TURN";
  unitId: string;
};

export type UnitSleepOrder = OrderBase & {
  type: "UNIT_SLEEP";
  unitId: string;
};

export type UnitWakeOrder = OrderBase & {
  type: "UNIT_WAKE";
  unitId: string;
};

export type UnitFortifyOrder = OrderBase & {
  type: "UNIT_FORTIFY";
  unitId: string;
};

export type FoundCityOrder = OrderBase & {
  type: "FOUND_CITY";
  civilianUnitId: string;
  name: string;
  regionId: string;
  targetHexId: HexId;
};

export type Order =
  | BuildOrder
  | BudgetOrder
  | ColonizeOrder
  | UnitMoveOrder
  | UnitAttackOrder
  | UnitPromoteOrder
  | UnitSkipTurnOrder
  | UnitSleepOrder
  | UnitWakeOrder
  | UnitFortifyOrder
  | FoundCityOrder;
export type OrderInput = Order extends infer T ? T extends Order ? Omit<T, "id" | "createdAt"> : never : never;

export type OrderDelta = {
  type: "ORDER_DELTA";
  order: OrderInput;
};
