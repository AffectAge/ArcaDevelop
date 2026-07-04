import type { HexId } from "./hex-map";

export type OrderType =
  | "BUILD"
  | "BUDGET"
  | "ARMY_MOVE"
  | "COLONIZE"
  | "UNIT_MOVE"
  | "UNIT_ATTACK"
  | "UNIT_SKIP_TURN"
  | "UNIT_SLEEP"
  | "UNIT_WAKE"
  | "FOUND_CITY"
  | "EQUIPMENT_VARIANT"
  | "EQUIPMENT_PRODUCTION_LINE";

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

export type UnitMoveOrder = OrderBase & {
  type: "UNIT_MOVE";
  unitId: string;
  unitKind: "map" | "civilian" | "division" | "fleet";
  targetHexId: HexId;
  path: HexId[];
};

export type UnitAttackOrder = OrderBase & {
  type: "UNIT_ATTACK";
  attackerUnitId: string;
  targetHexId: HexId;
  targetUnitId?: string;
};

export type UnitSkipTurnOrder = OrderBase & {
  type: "UNIT_SKIP_TURN";
  unitId: string;
  unitKind: "map";
};

export type UnitSleepOrder = OrderBase & {
  type: "UNIT_SLEEP";
  unitId: string;
  unitKind: "map";
};

export type UnitWakeOrder = OrderBase & {
  type: "UNIT_WAKE";
  unitId: string;
  unitKind: "map";
};

export type FoundCityOrder = OrderBase & {
  type: "FOUND_CITY";
  civilianUnitId: string;
  name: string;
  regionId: string;
  targetHexId: HexId;
};

export type EquipmentVariantOrder = OrderBase & {
  type: "EQUIPMENT_VARIANT";
};

export type EquipmentProductionLineOrder = OrderBase & {
  type: "EQUIPMENT_PRODUCTION_LINE";
};

export type Order =
  | BuildOrder
  | BudgetOrder
  | ArmyMoveOrder
  | ColonizeOrder
  | UnitMoveOrder
  | UnitAttackOrder
  | UnitSkipTurnOrder
  | UnitSleepOrder
  | UnitWakeOrder
  | FoundCityOrder
  | EquipmentVariantOrder
  | EquipmentProductionLineOrder;
export type OrderInput = Order extends infer T ? T extends Order ? Omit<T, "id" | "createdAt"> : never : never;

export type OrderDelta = {
  type: "ORDER_DELTA";
  order: OrderInput;
};
