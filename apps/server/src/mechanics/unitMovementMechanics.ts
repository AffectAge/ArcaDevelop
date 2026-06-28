import type { CivilianUnit, EventLogEntry, Fleet, HexId, Order, WorldBase } from "@arcanorum/shared";
import { isContiguousArmyRoute, normalizeArmyMoveRoute, type MilitaryHexNode } from "./militaryMechanics";

export type UnitMovementWorldState = Pick<WorldBase, "civilianUnitsById" | "fleetsById">;

export type UnitMovementRejectedOrder = {
  playerId: string;
  reason: string;
  tempOrderId?: string;
};

export type UnitMoveOrderResolution = {
  moved: boolean;
  rejectedOrder: UnitMovementRejectedOrder | null;
};

type FindRouteParams = {
  fromHexId: HexId;
  targetHexId: HexId;
  unit: CivilianUnit;
};

export function resolveUnitMoveOrder(params: {
  order: Order;
  playerId: string;
  worldBase: UnitMovementWorldState;
  turnId: number;
  movedCivilianUnitIds: Set<string>;
  movedFleetIds?: Set<string>;
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  getNeighborHexIds?: (hexId: HexId) => HexId[];
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
  isFleetPassableHex?: (hexId: HexId) => boolean;
  news?: EventLogEntry[];
}): UnitMoveOrderResolution {
  const reject = (reason: string): UnitMoveOrderResolution => ({
    moved: false,
    rejectedOrder: { playerId: params.playerId, reason, tempOrderId: params.order.id },
  });
  if (params.order.type !== "UNIT_MOVE") return reject("INVALID_ORDER_TYPE");
  if (params.order.unitKind === "fleet") {
    const fleet = params.worldBase.fleetsById[params.order.unitId];
    if (!fleet || fleet.countryId !== params.order.countryId) return reject("FLEET_NOT_FOUND");
    if (params.movedFleetIds?.has(fleet.id) || fleet.lastMovedTurnId === params.turnId) return reject("FLEET_ALREADY_MOVED");
    const route = resolveFleetRouteToTarget({
      fleet,
      targetHexId: params.order.targetHexId,
      fallbackPayload: params.order.payload,
      areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame,
      getNeighborHexIds: params.getNeighborHexIds,
      getHexMovementCost: params.getHexMovementCost,
      isFleetPassableHex: params.isFleetPassableHex,
    });
    if (route.length === 0) return reject("UNIT_MOVE_TARGET_INVALID");
    if (!isContiguousUnitRoute({ fromHexId: fleet.hexId, route, areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame })) {
      return reject("UNIT_MOVE_PATH_NOT_CONTIGUOUS");
    }
    if (!route.every((hexId) => params.isFleetPassableHex?.(hexId) ?? true)) return reject("FLEET_TARGET_NOT_WATER");
    fleet.path = route;
    fleet.targetHexId = params.order.targetHexId;
    const moved = advanceFleetAlongRoute({
      fleet,
      worldBase: params.worldBase,
      turnId: params.turnId,
      news: params.news,
      getHexMovementCost: params.getHexMovementCost,
    });
    if (moved) params.movedFleetIds?.add(fleet.id);
    return { moved, rejectedOrder: null };
  }
  if (params.order.unitKind !== "civilian") return reject("UNIT_MOVE_KIND_UNSUPPORTED");
  const unit = params.worldBase.civilianUnitsById[params.order.unitId];
  if (!unit || unit.countryId !== params.order.countryId) return reject("CIVILIAN_UNIT_NOT_FOUND");
  if (unit.status === "captured") return reject("CIVILIAN_UNIT_CAPTURED");
  if (params.movedCivilianUnitIds.has(unit.id) || unit.lastMovedTurnId === params.turnId) {
    return reject("CIVILIAN_UNIT_ALREADY_MOVED");
  }
  const route = resolveCivilianRouteToTarget({
    worldBase: params.worldBase,
    unit,
    targetHexId: params.order.targetHexId,
    fallbackPayload: params.order.payload,
    areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame,
    getNeighborHexIds: params.getNeighborHexIds,
    getHexMovementCost: params.getHexMovementCost,
  });
  if (route.length === 0) return reject("UNIT_MOVE_TARGET_INVALID");
  if (!isContiguousUnitRoute({ fromHexId: unit.hexId, route, areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame })) {
    return reject("UNIT_MOVE_PATH_NOT_CONTIGUOUS");
  }
  if (route.some((hexId) => isCivilianHexOccupied(params.worldBase, hexId, unit.id))) {
    return reject("CIVILIAN_UNIT_HEX_OCCUPIED");
  }
  unit.path = route;
  unit.targetHexId = params.order.targetHexId;
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

export function advanceStoredFleetRoutesTurn(params: {
  worldBase: UnitMovementWorldState;
  turnId: number;
  movedFleetIds: Set<string>;
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  getNeighborHexIds?: (hexId: HexId) => HexId[];
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
  isFleetPassableHex?: (hexId: HexId) => boolean;
  news?: EventLogEntry[];
}): void {
  for (const fleet of Object.values(params.worldBase.fleetsById)) {
    if (params.movedFleetIds.has(fleet.id) || fleet.lastMovedTurnId === params.turnId) continue;
    const targetHexId = fleet.targetHexId ?? fleet.path.at(-1) ?? null;
    if (!targetHexId || targetHexId === fleet.hexId) {
      fleet.path = [];
      fleet.targetHexId = null;
      fleet.status = "idle";
      params.worldBase.fleetsById[fleet.id] = fleet;
      continue;
    }
    const route = resolveFleetRouteToTarget({
      fleet,
      targetHexId,
      fallbackPayload: { path: fleet.path },
      areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame,
      getNeighborHexIds: params.getNeighborHexIds,
      getHexMovementCost: params.getHexMovementCost,
      isFleetPassableHex: params.isFleetPassableHex,
    });
    if (route.length === 0 || !route.every((hexId) => params.isFleetPassableHex?.(hexId) ?? true)) {
      fleet.path = [];
      fleet.targetHexId = null;
      fleet.status = "idle";
      params.worldBase.fleetsById[fleet.id] = fleet;
      params.news?.push(makeFleetMovementBlockedNews(fleet, params.turnId, targetHexId));
      continue;
    }
    if (!isContiguousUnitRoute({ fromHexId: fleet.hexId, route, areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame })) {
      fleet.path = [];
      fleet.targetHexId = null;
      fleet.status = "idle";
      params.worldBase.fleetsById[fleet.id] = fleet;
      continue;
    }
    fleet.path = route;
    if (
      advanceFleetAlongRoute({
        fleet,
        worldBase: params.worldBase,
        turnId: params.turnId,
        news: params.news,
        getHexMovementCost: params.getHexMovementCost,
      })
    ) {
      params.movedFleetIds.add(fleet.id);
    }
  }
}

export function advanceStoredCivilianUnitRoutesTurn(params: {
  worldBase: UnitMovementWorldState;
  turnId: number;
  movedCivilianUnitIds: Set<string>;
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  getNeighborHexIds?: (hexId: HexId) => HexId[];
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
  news?: EventLogEntry[];
}): void {
  for (const unit of Object.values(params.worldBase.civilianUnitsById)) {
    if (unit.status === "captured") continue;
    if (params.movedCivilianUnitIds.has(unit.id) || unit.lastMovedTurnId === params.turnId) continue;
    unit.movementPoints = Math.max(0, Number(unit.maxMovementPoints) || 0);
    const targetHexId = unit.targetHexId ?? unit.path.at(-1) ?? null;
    if (!targetHexId || targetHexId === unit.hexId) {
      unit.path = [];
      unit.targetHexId = null;
      unit.status = "idle";
      params.worldBase.civilianUnitsById[unit.id] = unit;
      continue;
    }
    const route = resolveCivilianRouteToTarget({
      worldBase: params.worldBase,
      unit,
      targetHexId,
      fallbackPayload: { path: unit.path },
      areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame,
      getNeighborHexIds: params.getNeighborHexIds,
      getHexMovementCost: params.getHexMovementCost,
    });
    if (route.length === 0) {
      unit.path = [];
      unit.targetHexId = null;
      unit.status = "idle";
      params.worldBase.civilianUnitsById[unit.id] = unit;
      params.news?.push(makeCivilianMovementBlockedNews(unit, params.turnId, targetHexId));
      continue;
    }
    if (!isContiguousUnitRoute({ fromHexId: unit.hexId, route, areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame })) {
      unit.path = [];
      unit.targetHexId = null;
      unit.status = "idle";
      params.worldBase.civilianUnitsById[unit.id] = unit;
      continue;
    }
    unit.path = route;
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
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
  news?: EventLogEntry[];
}): boolean {
  let remainingMovement = Math.max(0, Number(params.unit.movementPoints) || 0);
  if (remainingMovement <= 0) {
    params.unit.status = params.unit.targetHexId || params.unit.path.length > 0 ? "moving" : "idle";
    params.worldBase.civilianUnitsById[params.unit.id] = params.unit;
    return false;
  }
  let remainingRoute = params.unit.path.filter((hexId) => hexId !== params.unit.hexId).slice(0, 64);
  let movedSteps = 0;
  while (remainingRoute.length > 0) {
    const nextHexId = remainingRoute[0];
    if (isCivilianHexOccupied(params.worldBase, nextHexId, params.unit.id)) break;
    const movementCost = Math.max(0.001, Number(params.getHexMovementCost?.(nextHexId, params.unit.countryId) ?? 1) || 1);
    if (movementCost > remainingMovement) break;
    params.unit.hexId = nextHexId;
    remainingRoute = remainingRoute.slice(1);
    remainingMovement = round3(remainingMovement - movementCost);
    movedSteps += 1;
  }
  if (movedSteps <= 0) {
    params.unit.path = remainingRoute;
    params.unit.status = remainingRoute.length > 0 ? "moving" : "idle";
    params.worldBase.civilianUnitsById[params.unit.id] = params.unit;
    return false;
  }
  params.unit.path = remainingRoute;
  if (params.unit.targetHexId === params.unit.hexId || remainingRoute.length === 0) {
    params.unit.targetHexId = null;
  }
  params.unit.movementPoints = remainingMovement;
  params.unit.status = remainingRoute.length > 0 ? "moving" : "idle";
  params.unit.lastMovedTurnId = params.turnId;
  params.worldBase.civilianUnitsById[params.unit.id] = params.unit;
  params.news?.push(makeCivilianMovementNews(params.unit, params.turnId, remainingRoute.length));
  return true;
}

export function advanceFleetAlongRoute(params: {
  fleet: Fleet;
  worldBase: UnitMovementWorldState;
  turnId: number;
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
  news?: EventLogEntry[];
}): boolean {
  let remainingMovement = Math.max(0, Number(params.fleet.stats.speed) || 1);
  let remainingRoute = params.fleet.path.filter((hexId) => hexId !== params.fleet.hexId).slice(0, 64);
  let movedSteps = 0;
  while (remainingRoute.length > 0) {
    const nextHexId = remainingRoute[0];
    const movementCost = Math.max(0.001, Number(params.getHexMovementCost?.(nextHexId, params.fleet.countryId) ?? 1) || 1);
    if (movementCost > remainingMovement) break;
    params.fleet.hexId = nextHexId;
    remainingRoute = remainingRoute.slice(1);
    remainingMovement = round3(remainingMovement - movementCost);
    movedSteps += 1;
  }
  params.fleet.path = remainingRoute;
  if (params.fleet.targetHexId === params.fleet.hexId || remainingRoute.length === 0) {
    params.fleet.targetHexId = null;
  }
  params.fleet.status = remainingRoute.length > 0 ? "moving" : "idle";
  if (movedSteps > 0) {
    params.fleet.lastMovedTurnId = params.turnId;
    params.news?.push(makeFleetMovementNews(params.fleet, params.turnId, remainingRoute.length));
  }
  params.worldBase.fleetsById[params.fleet.id] = params.fleet;
  return movedSteps > 0;
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

function resolveCivilianRouteToTarget(params: {
  worldBase: UnitMovementWorldState;
  unit: CivilianUnit;
  targetHexId: HexId;
  fallbackPayload?: Record<string, unknown>;
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  getNeighborHexIds?: (hexId: HexId) => HexId[];
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
}): HexId[] {
  if (params.targetHexId === params.unit.hexId) return [];
  if (params.getNeighborHexIds) {
    return findCivilianRouteToTarget({
      worldBase: params.worldBase,
      unit: params.unit,
      targetHexId: params.targetHexId,
      getNeighborHexIds: params.getNeighborHexIds,
      getHexMovementCost: params.getHexMovementCost,
    });
  }
  const route = normalizeUnitMoveRoute(params.fallbackPayload, params.targetHexId, params.unit.hexId);
  return isContiguousUnitRoute({ fromHexId: params.unit.hexId, route, areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame })
    ? route
    : [];
}

function resolveFleetRouteToTarget(params: {
  fleet: Fleet;
  targetHexId: HexId;
  fallbackPayload?: Record<string, unknown>;
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  getNeighborHexIds?: (hexId: HexId) => HexId[];
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
  isFleetPassableHex?: (hexId: HexId) => boolean;
}): HexId[] {
  if (params.targetHexId === params.fleet.hexId) return [];
  if (params.isFleetPassableHex && !params.isFleetPassableHex(params.targetHexId)) return [];
  if (params.getNeighborHexIds) {
    return findFleetRouteToTarget({
      fleet: params.fleet,
      targetHexId: params.targetHexId,
      getNeighborHexIds: params.getNeighborHexIds,
      getHexMovementCost: params.getHexMovementCost,
      isFleetPassableHex: params.isFleetPassableHex,
    });
  }
  const route = normalizeUnitMoveRoute(params.fallbackPayload, params.targetHexId, params.fleet.hexId);
  return isContiguousUnitRoute({ fromHexId: params.fleet.hexId, route, areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame }) &&
    route.every((hexId) => params.isFleetPassableHex?.(hexId) ?? true)
    ? route
    : [];
}

export function findFleetRouteToTarget(params: {
  fleet: Fleet;
  targetHexId: HexId;
  getNeighborHexIds: (hexId: HexId) => HexId[];
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
  isFleetPassableHex?: (hexId: HexId) => boolean;
  limit?: number;
}): HexId[] {
  if (params.fleet.hexId === params.targetHexId) return [];
  if (params.isFleetPassableHex && !params.isFleetPassableHex(params.targetHexId)) return [];
  const frontier: Array<{ id: HexId; cost: number }> = [{ id: params.fleet.hexId, cost: 0 }];
  const cameFrom = new Map<HexId, HexId | null>([[params.fleet.hexId, null]]);
  const costSoFar = new Map<HexId, number>([[params.fleet.hexId, 0]]);
  const limit = Math.max(1, params.limit ?? 1600);
  let visited = 0;

  while (frontier.length > 0 && visited < limit) {
    visited += 1;
    frontier.sort((left, right) => left.cost - right.cost || left.id.localeCompare(right.id));
    const current = frontier.shift();
    if (!current) break;
    if (current.id === params.targetHexId) break;
    for (const neighborId of params.getNeighborHexIds(current.id)) {
      if (params.isFleetPassableHex && !params.isFleetPassableHex(neighborId)) continue;
      const movementCost = Math.max(0.001, Number(params.getHexMovementCost?.(neighborId, params.fleet.countryId) ?? 1) || 1);
      const nextCost = (costSoFar.get(current.id) ?? 0) + movementCost;
      if (!costSoFar.has(neighborId) || nextCost < (costSoFar.get(neighborId) ?? Number.POSITIVE_INFINITY)) {
        costSoFar.set(neighborId, nextCost);
        cameFrom.set(neighborId, current.id);
        frontier.push({ id: neighborId, cost: nextCost });
      }
    }
  }

  if (!cameFrom.has(params.targetHexId)) return [];
  const route: HexId[] = [];
  let cursor: HexId | null = params.targetHexId;
  while (cursor && cursor !== params.fleet.hexId) {
    route.push(cursor);
    cursor = cameFrom.get(cursor) ?? null;
  }
  return route.reverse().slice(0, 64);
}

export function findCivilianRouteToTarget(params: {
  worldBase: UnitMovementWorldState;
  unit: CivilianUnit;
  targetHexId: HexId;
  getNeighborHexIds: (hexId: HexId) => HexId[];
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
  limit?: number;
}): HexId[] {
  if (params.unit.hexId === params.targetHexId) return [];
  if (isCivilianHexOccupied(params.worldBase, params.targetHexId, params.unit.id)) return [];
  const frontier: Array<{ id: HexId; cost: number }> = [{ id: params.unit.hexId, cost: 0 }];
  const cameFrom = new Map<HexId, HexId | null>([[params.unit.hexId, null]]);
  const costSoFar = new Map<HexId, number>([[params.unit.hexId, 0]]);
  const limit = Math.max(1, params.limit ?? 1600);
  let visited = 0;

  while (frontier.length > 0 && visited < limit) {
    visited += 1;
    frontier.sort((left, right) => left.cost - right.cost || left.id.localeCompare(right.id));
    const current = frontier.shift();
    if (!current) break;
    if (current.id === params.targetHexId) break;
    for (const neighborId of params.getNeighborHexIds(current.id)) {
      if (isCivilianHexOccupied(params.worldBase, neighborId, params.unit.id)) continue;
      const movementCost = Math.max(0.001, Number(params.getHexMovementCost?.(neighborId, params.unit.countryId) ?? 1) || 1);
      const nextCost = (costSoFar.get(current.id) ?? 0) + movementCost;
      if (!costSoFar.has(neighborId) || nextCost < (costSoFar.get(neighborId) ?? Number.POSITIVE_INFINITY)) {
        costSoFar.set(neighborId, nextCost);
        cameFrom.set(neighborId, current.id);
        frontier.push({ id: neighborId, cost: nextCost });
      }
    }
  }

  if (!cameFrom.has(params.targetHexId)) return [];
  const route: HexId[] = [];
  let cursor: HexId | null = params.targetHexId;
  while (cursor && cursor !== params.unit.hexId) {
    route.push(cursor);
    cursor = cameFrom.get(cursor) ?? null;
  }
  return route.reverse().slice(0, 64);
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

function makeCivilianMovementBlockedNews(unit: CivilianUnit, turnId: number, targetHexId: HexId): EventLogEntry {
  return {
    id: `event:unit-route-blocked:${unit.id}:${turnId}`,
    turn: turnId,
    category: "colonization",
    title: "Маршрут гражданского юнита недоступен",
    message: `${unit.id} не может построить путь к ${targetHexId}`,
    countryId: unit.countryId,
    priority: "medium",
    visibility: "private",
    timestamp: new Date().toISOString(),
  };
}

function makeFleetMovementNews(fleet: Fleet, turnId: number, remainingSteps: number): EventLogEntry {
  return {
    id: `event:fleet-move:${fleet.id}:${turnId}`,
    turn: turnId,
    category: "military",
    title: remainingSteps > 0 ? "Флот продолжает путь" : "Флот прибыл",
    message:
      remainingSteps > 0
        ? `${fleet.id} прибыл в hex ${fleet.hexId}; осталось ${remainingSteps} шагов`
        : `${fleet.id} завершил движение в hex ${fleet.hexId}`,
    countryId: fleet.countryId,
    priority: "low",
    visibility: "private",
    timestamp: new Date().toISOString(),
  };
}

function makeFleetMovementBlockedNews(fleet: Fleet, turnId: number, targetHexId: HexId): EventLogEntry {
  return {
    id: `event:fleet-route-blocked:${fleet.id}:${turnId}`,
    turn: turnId,
    category: "military",
    title: "Маршрут флота недоступен",
    message: `${fleet.id} не может построить путь к ${targetHexId}`,
    countryId: fleet.countryId,
    priority: "medium",
    visibility: "private",
    timestamp: new Date().toISOString(),
  };
}
