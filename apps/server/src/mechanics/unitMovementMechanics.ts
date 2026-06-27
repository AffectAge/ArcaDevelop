import type { CivilianUnit, EventLogEntry, HexId, Order, WorldBase } from "@arcanorum/shared";
import { isContiguousArmyRoute, normalizeArmyMoveRoute, type MilitaryHexNode } from "./militaryMechanics";

export type UnitMovementWorldState = Pick<WorldBase, "civilianUnitsById">;

export type UnitMovementRejectedOrder = {
  playerId: string;
  reason: string;
  tempOrderId?: string;
};

export type UnitMoveOrderResolution = {
  moved: boolean;
  rejectedOrder: UnitMovementRejectedOrder | null;
};

export function resolveUnitMoveOrder(params: {
  order: Order;
  playerId: string;
  worldBase: UnitMovementWorldState;
  turnId: number;
  movedCivilianUnitIds: Set<string>;
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  getHexMovementCost?: (hexId: HexId) => number;
  news?: EventLogEntry[];
}): UnitMoveOrderResolution {
  const reject = (reason: string): UnitMoveOrderResolution => ({
    moved: false,
    rejectedOrder: { playerId: params.playerId, reason, tempOrderId: params.order.id },
  });
  if (params.order.type !== "UNIT_MOVE") return reject("INVALID_ORDER_TYPE");
  if (params.order.unitKind !== "civilian") return reject("UNIT_MOVE_KIND_UNSUPPORTED");
  const unit = params.worldBase.civilianUnitsById[params.order.unitId];
  if (!unit || unit.countryId !== params.order.countryId) return reject("CIVILIAN_UNIT_NOT_FOUND");
  if (unit.status === "captured") return reject("CIVILIAN_UNIT_CAPTURED");
  if (params.movedCivilianUnitIds.has(unit.id) || unit.lastMovedTurnId === params.turnId) {
    return reject("CIVILIAN_UNIT_ALREADY_MOVED");
  }
  const route = normalizeUnitMoveRoute(params.order.payload, params.order.targetHexId, unit.hexId);
  if (route.length === 0) return reject("UNIT_MOVE_TARGET_INVALID");
  if (!isContiguousUnitRoute({ fromHexId: unit.hexId, route, areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame })) {
    return reject("UNIT_MOVE_PATH_NOT_CONTIGUOUS");
  }
  if (route.some((hexId) => isCivilianHexOccupied(params.worldBase, hexId, unit.id))) {
    return reject("CIVILIAN_UNIT_HEX_OCCUPIED");
  }
  unit.path = route;
  const moved = advanceCivilianUnitAlongRoute({
    unit,
    worldBase: params.worldBase,
    turnId: params.turnId,
    news: params.news,
    getHexMovementCost: params.getHexMovementCost,
  });
  if (moved) params.movedCivilianUnitIds.add(unit.id);
  return { moved, rejectedOrder: null };
}

export function advanceStoredCivilianUnitRoutesTurn(params: {
  worldBase: UnitMovementWorldState;
  turnId: number;
  movedCivilianUnitIds: Set<string>;
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  getHexMovementCost?: (hexId: HexId) => number;
  news?: EventLogEntry[];
}): void {
  for (const unit of Object.values(params.worldBase.civilianUnitsById)) {
    if (unit.status === "captured") continue;
    if (params.movedCivilianUnitIds.has(unit.id) || unit.lastMovedTurnId === params.turnId) continue;
    unit.movementPoints = Math.max(0, Number(unit.maxMovementPoints) || 0);
    if (unit.path.length === 0) {
      unit.status = "idle";
      params.worldBase.civilianUnitsById[unit.id] = unit;
      continue;
    }
    const route = unit.path.filter((hexId) => hexId !== unit.hexId).slice(0, 64);
    if (!isContiguousUnitRoute({ fromHexId: unit.hexId, route, areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame })) {
      unit.path = [];
      unit.status = "idle";
      params.worldBase.civilianUnitsById[unit.id] = unit;
      continue;
    }
    if (route.some((hexId) => isCivilianHexOccupied(params.worldBase, hexId, unit.id))) {
      unit.path = route;
      unit.status = "idle";
      params.worldBase.civilianUnitsById[unit.id] = unit;
      continue;
    }
    if (
      advanceCivilianUnitAlongRoute({
        unit,
        worldBase: params.worldBase,
        turnId: params.turnId,
        news: params.news,
        getHexMovementCost: params.getHexMovementCost,
      })
    ) {
      params.movedCivilianUnitIds.add(unit.id);
    }
  }
}

export function advanceCivilianUnitAlongRoute(params: {
  unit: CivilianUnit;
  worldBase: UnitMovementWorldState;
  turnId: number;
  getHexMovementCost?: (hexId: HexId) => number;
  news?: EventLogEntry[];
}): boolean {
  let remainingMovement = Math.max(0, Number(params.unit.movementPoints) || 0);
  if (remainingMovement <= 0) {
    params.unit.status = "idle";
    params.worldBase.civilianUnitsById[params.unit.id] = params.unit;
    return false;
  }
  let remainingRoute = params.unit.path.filter((hexId) => hexId !== params.unit.hexId).slice(0, 64);
  let movedSteps = 0;
  while (remainingRoute.length > 0) {
    const nextHexId = remainingRoute[0];
    if (isCivilianHexOccupied(params.worldBase, nextHexId, params.unit.id)) break;
    const movementCost = Math.max(0.001, Number(params.getHexMovementCost?.(nextHexId) ?? 1) || 1);
    if (movementCost > remainingMovement) break;
    params.unit.hexId = nextHexId;
    remainingRoute = remainingRoute.slice(1);
    remainingMovement = round3(remainingMovement - movementCost);
    movedSteps += 1;
  }
  if (movedSteps <= 0) {
    params.unit.status = "idle";
    params.worldBase.civilianUnitsById[params.unit.id] = params.unit;
    return false;
  }
  params.unit.path = remainingRoute;
  params.unit.movementPoints = remainingMovement;
  params.unit.status = remainingRoute.length > 0 ? "moving" : "idle";
  params.unit.lastMovedTurnId = params.turnId;
  params.worldBase.civilianUnitsById[params.unit.id] = params.unit;
  params.news?.push(makeCivilianMovementNews(params.unit, params.turnId, remainingRoute.length));
  return true;
}

function round3(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 1000) / 1000;
}

export function normalizeUnitMoveRoute(
  payload: Record<string, unknown> | undefined,
  fallbackHexId: HexId,
  currentHexId: HexId,
): HexId[] {
  return normalizeArmyMoveRoute(payload, fallbackHexId, currentHexId);
}

export function isContiguousUnitRoute(params: {
  fromHexId: HexId;
  route: HexId[];
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
}): boolean {
  return isContiguousArmyRoute(params);
}

export function isCivilianHexOccupied(worldBase: UnitMovementWorldState, hexId: HexId, excludingUnitId?: string): boolean {
  return Object.values(worldBase.civilianUnitsById).some(
    (unit) => unit.id !== excludingUnitId && unit.status !== "captured" && unit.hexId === hexId,
  );
}

export function makeUnitMovementHexes(hexes: MilitaryHexNode[]): MilitaryHexNode[] {
  return hexes;
}

function makeCivilianMovementNews(unit: CivilianUnit, turnId: number, remainingSteps: number): EventLogEntry {
  return {
    id: `event:unit-move:${unit.id}:${turnId}`,
    turn: turnId,
    category: "colonization",
    title: remainingSteps > 0 ? "Гражданский юнит продолжает путь" : "Гражданский юнит прибыл",
    message:
      remainingSteps > 0
        ? `${unit.id} прибыл в hex ${unit.hexId}; осталось ${remainingSteps} шагов`
        : `${unit.id} завершил движение в hex ${unit.hexId}`,
    countryId: unit.countryId,
    priority: "low",
    visibility: "private",
    timestamp: new Date().toISOString(),
  };
}
