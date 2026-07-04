import {
  axialDistance,
  type EventLogEntry,
  type HexId,
  type MapUnit,
  type Order,
  type UnitDomain,
  type UnitSkillTreeDefinition,
  type UnitTrainingQueueItem,
  type UnitTypeDefinition,
  type WorldBase,
} from "@arcanorum/shared";

export type MapUnitWorldState = Pick<WorldBase, "unitsById" | "unitTrainingQueueByCountry">;

export type MapUnitHexNode = {
  id: string;
  neighbors?: string[];
};

export type MapUnitRejectedOrder = {
  playerId: string;
  reason: string;
  tempOrderId?: string;
};

export type MapUnitMoveOrderResolution = {
  moved: boolean;
  rejectedOrder: MapUnitRejectedOrder | null;
};

export type MapUnitAttackOrderResolution = {
  attacked: boolean;
  rejectedOrder: MapUnitRejectedOrder | null;
};

export type MapUnitWaitOrderResolution = {
  accepted: boolean;
  rejectedOrder: MapUnitRejectedOrder | null;
};

export type MapUnitPromoteOrderResolution = {
  accepted: boolean;
  rejectedOrder: MapUnitRejectedOrder | null;
};

type HexLookup = {
  byId: Map<string, MapUnitHexNode & { passable?: boolean; waterKind?: string | null }>;
};

export function resolveMapUnitMoveOrder(params: {
  order: Order;
  playerId: string;
  worldBase: MapUnitWorldState;
  unitTypes: readonly UnitTypeDefinition[];
  turnId: number;
  movedUnitIds: Set<string>;
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  getNeighborHexIds?: (hexId: HexId) => HexId[];
  getHexMovementCost?: (hexId: HexId, countryId?: string, fromHexId?: HexId, unitDomain?: UnitDomain) => number;
  getHex?: (hexId: HexId) => { id: string; passable?: boolean; waterKind?: string | null } | null | undefined;
  news?: EventLogEntry[];
}): MapUnitMoveOrderResolution {
  const reject = (reason: string): MapUnitMoveOrderResolution => ({
    moved: false,
    rejectedOrder: { playerId: params.playerId, reason, tempOrderId: params.order.id },
  });
  if (params.order.type !== "UNIT_MOVE") return reject("INVALID_ORDER_TYPE");
  if (params.order.unitKind !== "map") return reject("UNIT_MOVE_KIND_UNSUPPORTED");
  params.worldBase.unitsById ??= {};
  const unit = params.worldBase.unitsById[params.order.unitId];
  if (!unit || unit.countryId !== params.order.countryId) return reject("MAP_UNIT_NOT_FOUND");
  if (unit.status === "captured" || unit.status === "destroyed") return reject("MAP_UNIT_UNAVAILABLE");
  if (params.movedUnitIds.has(unit.id) || unit.lastActionTurnId === params.turnId) return reject("MAP_UNIT_ALREADY_ACTED");
  const unitType = getUnitType(params.unitTypes, unit.unitTypeId);
  if (!unitType) return reject("MAP_UNIT_TYPE_NOT_FOUND");
  const route = normalizeMapUnitMoveRoute(params.order.payload, params.order.targetHexId, unit.hexId);
  if (route.length === 0) return reject("UNIT_MOVE_TARGET_INVALID");
  if (!isContiguousMapUnitRoute({ fromHexId: unit.hexId, route, areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame })) {
    return reject("UNIT_MOVE_PATH_NOT_CONTIGUOUS");
  }
  let previousHexId = unit.hexId;
  const blockedHexId = route.find((hexId) => {
    const hex = params.getHex?.(hexId) ?? null;
    const canEnterByRiver = unitType.domain === "naval" && Number(params.getHexMovementCost?.(hexId, unit.countryId, previousHexId as HexId, unitType.domain) ?? 999) < 1;
    const blocked = (!canEnterByRiver && !canUnitEnterHex(unitType.domain, hex)) || isStackBlocked(params.worldBase, params.unitTypes, unit, hexId);
    previousHexId = hexId;
    return blocked;
  });
  if (blockedHexId) {
    params.news?.push(makeMapUnitMovementBlockedNews(unit, params.turnId, blockedHexId));
    return reject("MAP_UNIT_STACKING_OR_TERRAIN_BLOCKED");
  }
  unit.path = route;
  unit.targetHexId = params.order.targetHexId;
  unit.status = "idle";
  const moved = advanceMapUnitAlongRoute({
    unit,
    unitType,
    worldBase: params.worldBase,
    unitTypes: params.unitTypes,
    turnId: params.turnId,
    news: params.news,
    getHexMovementCost: params.getHexMovementCost,
  });
  if (moved) params.movedUnitIds.add(unit.id);
  return { moved, rejectedOrder: null };
}

export function resolveMapUnitAttackOrder(params: {
  order: Order;
  playerId: string;
  worldBase: MapUnitWorldState;
  unitTypes: readonly UnitTypeDefinition[];
  turnId: number;
  movedUnitIds: Set<string>;
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  news?: EventLogEntry[];
}): MapUnitAttackOrderResolution {
  const reject = (reason: string): MapUnitAttackOrderResolution => ({
    attacked: false,
    rejectedOrder: { playerId: params.playerId, reason, tempOrderId: params.order.id },
  });
  if (params.order.type !== "UNIT_ATTACK") return reject("INVALID_ORDER_TYPE");
  params.worldBase.unitsById ??= {};
  const attacker = params.worldBase.unitsById[params.order.attackerUnitId];
  if (!attacker || attacker.countryId !== params.order.countryId) return reject("UNIT_ATTACK_ATTACKER_NOT_FOUND");
  if (attacker.status === "captured" || attacker.status === "destroyed") return reject("MAP_UNIT_UNAVAILABLE");
  if (params.movedUnitIds.has(attacker.id) || attacker.lastActionTurnId === params.turnId) return reject("UNIT_ATTACK_ALREADY_ACTED");
  const attackerType = getUnitType(params.unitTypes, attacker.unitTypeId);
  if (!attackerType || !isCombatDomain(attackerType.domain)) return reject("UNIT_ATTACK_ATTACKER_INVALID");
  const defender = params.order.targetUnitId ? params.worldBase.unitsById[params.order.targetUnitId] : findDefenderOnHex({
    worldBase: params.worldBase,
    unitTypes: params.unitTypes,
    attacker,
    targetHexId: params.order.targetHexId,
  });
  if (!defender || defender.countryId === attacker.countryId) return reject("UNIT_ATTACK_TARGET_INVALID");
  const defenderType = getUnitType(params.unitTypes, defender.unitTypeId);
  if (!defenderType) return reject("UNIT_ATTACK_TARGET_INVALID");
  const range = Math.max(1, attackerType.stats.range ?? 1);
  if (range <= 1 && !params.areHexIdsAdjacentOrSame(attacker.hexId, defender.hexId)) return reject("UNIT_ATTACK_TARGET_INVALID");
  if (range > 1 && hexDistance(attacker.hexId, defender.hexId) > range) return reject("UNIT_ATTACK_TARGET_INVALID");

  const attackerDamage = Math.max(5, Math.round((defenderType.stats.attack * 6) / Math.max(1, attackerType.stats.defense)));
  const defenderDamage = Math.max(
    5,
    Math.round(((attackerType.stats.rangedAttack ?? attackerType.stats.attack) * 8) / Math.max(1, defenderType.stats.defense)),
  );
  defender.hp = Math.max(0, defender.hp - defenderDamage);
  if ((attackerType.stats.range ?? 1) <= 1) {
    attacker.hp = Math.max(0, attacker.hp - attackerDamage);
  }
  attacker.lastActionTurnId = params.turnId;
  attacker.movementPoints = 0;
  attacker.status = "idle";
  attacker.path = [];
  attacker.targetHexId = null;
  if (defender.hp <= 0) {
    defender.status = "destroyed";
    delete params.worldBase.unitsById[defender.id];
    if ((attackerType.stats.range ?? 1) <= 1 && attacker.hp > 0 && !isStackBlocked(params.worldBase, params.unitTypes, attacker, defender.hexId)) {
      attacker.hexId = defender.hexId;
    }
  }
  if (attacker.hp <= 0) {
    attacker.status = "destroyed";
    delete params.worldBase.unitsById[attacker.id];
  } else {
    params.worldBase.unitsById[attacker.id] = attacker;
  }
  params.news?.push(makeMapUnitCombatNews(attacker, defender, params.turnId, defenderDamage, attackerDamage));
  params.movedUnitIds.add(attacker.id);
  return { attacked: true, rejectedOrder: null };
}

export function resolveMapUnitWaitOrder(params: {
  order: Order;
  playerId: string;
  worldBase: MapUnitWorldState;
  turnId: number;
  movedUnitIds: Set<string>;
}): MapUnitWaitOrderResolution {
  const reject = (reason: string): MapUnitWaitOrderResolution => ({
    accepted: false,
    rejectedOrder: { playerId: params.playerId, reason, tempOrderId: params.order.id },
  });
  if (params.order.type !== "UNIT_SKIP_TURN" && params.order.type !== "UNIT_SLEEP" && params.order.type !== "UNIT_WAKE") return reject("INVALID_ORDER_TYPE");
  if (params.order.unitKind !== "map") return reject("UNIT_WAIT_KIND_UNSUPPORTED");
  params.worldBase.unitsById ??= {};
  const unit = params.worldBase.unitsById[params.order.unitId];
  if (!unit || unit.countryId !== params.order.countryId) return reject("MAP_UNIT_NOT_FOUND");
  if (unit.status === "captured" || unit.status === "destroyed") return reject("MAP_UNIT_UNAVAILABLE");
  if (params.order.type === "UNIT_WAKE" && unit.status !== "sleeping") return reject("MAP_UNIT_NOT_SLEEPING");
  unit.path = [];
  unit.targetHexId = null;
  if (params.order.type !== "UNIT_WAKE") {
    unit.movementPoints = 0;
  }
  unit.lastActionTurnId = params.turnId;
  unit.status = params.order.type === "UNIT_SLEEP" ? "sleeping" : "idle";
  params.worldBase.unitsById[unit.id] = unit;
  params.movedUnitIds.add(unit.id);
  return { accepted: true, rejectedOrder: null };
}

export function resolveMapUnitPromoteOrder(params: {
  order: Order;
  playerId: string;
  worldBase: MapUnitWorldState;
  unitTypes: readonly UnitTypeDefinition[];
  unitSkillTrees: readonly UnitSkillTreeDefinition[];
}): MapUnitPromoteOrderResolution {
  const reject = (reason: string): MapUnitPromoteOrderResolution => ({
    accepted: false,
    rejectedOrder: { playerId: params.playerId, reason, tempOrderId: params.order.id },
  });
  if (params.order.type !== "UNIT_PROMOTE") return reject("INVALID_ORDER_TYPE");
  const order = params.order;
  params.worldBase.unitsById ??= {};
  const unit = params.worldBase.unitsById[order.unitId];
  if (!unit || unit.countryId !== order.countryId) return reject("MAP_UNIT_NOT_FOUND");
  if (unit.status === "captured" || unit.status === "destroyed") return reject("MAP_UNIT_UNAVAILABLE");
  const unitType = getUnitType(params.unitTypes, unit.unitTypeId);
  if (!unitType?.unitSkillTreeId) return reject("UNIT_PROMOTE_TREE_NOT_FOUND");
  const tree = params.unitSkillTrees.find((candidate) => candidate.id === unitType.unitSkillTreeId);
  if (!tree) return reject("UNIT_PROMOTE_TREE_NOT_FOUND");
  const group = tree.choiceGroups.find((candidate) => candidate.id === order.choiceGroupId);
  if (!group) return reject("UNIT_PROMOTE_GROUP_NOT_FOUND");
  const currentSkills = new Set(unit.skillIds ?? []);
  const completedGroups = new Set(unit.completedChoiceGroupIds ?? []);
  if (completedGroups.has(group.id)) return reject("UNIT_PROMOTE_GROUP_COMPLETED");
  if (resolveUnitLevel(unit.experience, tree.levelThresholds) < group.unlockLevel) return reject("UNIT_PROMOTE_LEVEL_LOCKED");
  if (order.skillIds.length !== group.choicesRequired) return reject("UNIT_PROMOTE_CHOICE_COUNT_INVALID");
  const uniqueSkillIds = new Set(order.skillIds);
  if (uniqueSkillIds.size !== order.skillIds.length) return reject("UNIT_PROMOTE_DUPLICATE_SKILL");
  for (const skillId of order.skillIds) {
    if (!group.options.includes(skillId)) return reject("UNIT_PROMOTE_SKILL_NOT_IN_GROUP");
    if (currentSkills.has(skillId)) return reject("UNIT_PROMOTE_DUPLICATE_SKILL");
  }
  for (const prerequisiteSkillId of group.prerequisiteSkillIds ?? []) {
    if (!currentSkills.has(prerequisiteSkillId)) return reject("UNIT_PROMOTE_PREREQUISITE_MISSING");
  }
  unit.skillIds = [...currentSkills, ...order.skillIds];
  unit.completedChoiceGroupIds = [...completedGroups, group.id];
  params.worldBase.unitsById[unit.id] = unit;
  return { accepted: true, rejectedOrder: null };
}

export function advanceStoredMapUnitRoutesTurn(params: {
  worldBase: MapUnitWorldState;
  unitTypes: readonly UnitTypeDefinition[];
  turnId: number;
  movedUnitIds: Set<string>;
  news?: EventLogEntry[];
  getHexMovementCost?: (hexId: HexId, countryId?: string, fromHexId?: HexId, unitDomain?: UnitDomain) => number;
}): void {
  for (const unit of Object.values(params.worldBase.unitsById ?? {})) {
    if (params.movedUnitIds.has(unit.id) || unit.status === "sleeping" || unit.status === "captured" || unit.status === "destroyed" || unit.path.length === 0) continue;
    const unitType = getUnitType(params.unitTypes, unit.unitTypeId);
    if (!unitType) continue;
    advanceMapUnitAlongRoute({
      unit,
      unitType,
      worldBase: params.worldBase,
      unitTypes: params.unitTypes,
      turnId: params.turnId,
      news: params.news,
      getHexMovementCost: params.getHexMovementCost,
    });
  }
}

export function advanceUnitTrainingQueueTurn(params: {
  worldBase: MapUnitWorldState;
  unitTypes: readonly UnitTypeDefinition[];
  turnId: number;
  news?: EventLogEntry[];
}): void {
  params.worldBase.unitsById ??= {};
  params.worldBase.unitTrainingQueueByCountry ??= {};
  for (const [countryId, queue] of Object.entries(params.worldBase.unitTrainingQueueByCountry)) {
    const remaining: UnitTrainingQueueItem[] = [];
    for (const item of queue) {
      const nextItem = { ...item, progress: item.progress + 1, turnsRemaining: Math.max(0, item.turnsRemaining - 1) };
      const unitType = getUnitType(params.unitTypes, item.unitTypeId);
      const canSpawn =
        unitType != null &&
        nextItem.turnsRemaining <= 0 &&
        !isStackBlockedForType(params.worldBase, params.unitTypes, countryId, item.hexId, unitType);
      if (!canSpawn) {
        remaining.push(nextItem);
        continue;
      }
      const unit: MapUnit = {
        id: `unit:${sanitizeUnitId(countryId)}:${sanitizeUnitId(item.unitTypeId)}:${params.turnId}:${sanitizeUnitId(item.id)}`,
        countryId,
        unitTypeId: item.unitTypeId,
        hexId: item.hexId,
        hp: unitType.stats.maxHp,
        movementPoints: unitType.stats.movement,
        experience: 0,
        skillIds: [...(unitType.startingSkillIds ?? [])],
        completedChoiceGroupIds: [],
        status: unitType.domain === "air" ? "based" : "idle",
        path: [],
        targetHexId: null,
        createdTurnId: params.turnId,
        lastActionTurnId: null,
      };
      params.worldBase.unitsById[unit.id] = unit;
      params.news?.push(makeMapUnitTrainedNews(unit, params.turnId));
    }
    params.worldBase.unitTrainingQueueByCountry[countryId] = remaining;
  }
}

export function findSpawnableTrainingHex(params: {
  hexIds: readonly HexId[];
  countryId: string;
  worldBase: MapUnitWorldState;
  unitTypes: readonly UnitTypeDefinition[];
  unitType: UnitTypeDefinition;
  getHex?: (hexId: HexId) => { id: string; passable?: boolean; waterKind?: string | null } | null | undefined;
}): HexId | null {
  for (const hexId of params.hexIds) {
    if (!canUnitEnterHex(params.unitType.domain, params.getHex?.(hexId) ?? null)) continue;
    if (isStackBlockedForType(params.worldBase, params.unitTypes, params.countryId, hexId, params.unitType)) continue;
    return hexId;
  }
  return null;
}

export function getUnitType(unitTypes: readonly UnitTypeDefinition[], unitTypeId: string): UnitTypeDefinition | null {
  return unitTypes.find((unitType) => unitType.id === unitTypeId) ?? null;
}

export function normalizeMapUnitMoveRoute(
  payload: Record<string, unknown> | undefined,
  fallbackHexId: string,
  currentHexId: string,
): HexId[] {
  const requestedPath = Array.isArray(payload?.path)
    ? payload.path
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim())
        .filter((value): value is HexId => /^hex:-?\d+:-?\d+$/.test(value))
    : [];
  const fallbackRoute = /^hex:-?\d+:-?\d+$/.test(fallbackHexId) ? [fallbackHexId as HexId] : [];
  const route = (requestedPath.length > 0 ? requestedPath : fallbackRoute).filter((hexId) => hexId !== currentHexId);
  return route.slice(0, 64);
}

export function isContiguousMapUnitRoute(params: {
  fromHexId: HexId;
  route: HexId[];
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
}): boolean {
  if (params.route.length === 0) return false;
  let cursorHexId = params.fromHexId;
  for (const hexId of params.route) {
    if (!params.areHexIdsAdjacentOrSame(cursorHexId, hexId)) {
      return false;
    }
    cursorHexId = hexId;
  }
  return true;
}

export function isCombatDomain(domain: UnitDomain): boolean {
  return domain === "land" || domain === "naval";
}

function advanceMapUnitAlongRoute(params: {
  unit: MapUnit;
  unitType: UnitTypeDefinition;
  worldBase: MapUnitWorldState;
  unitTypes: readonly UnitTypeDefinition[];
  turnId: number;
  news?: EventLogEntry[];
  getHexMovementCost?: (hexId: HexId, countryId?: string, fromHexId?: HexId, unitDomain?: UnitDomain) => number;
}): boolean {
  const movementBudget = Math.max(1, Math.floor(params.unitType.stats.movement || params.unit.movementPoints || 1));
  let budget = movementBudget;
  const remainingRoute = [...params.unit.path];
  let moved = false;
  while (remainingRoute.length > 0) {
    const nextHexId = remainingRoute[0]!;
    if (isStackBlocked(params.worldBase, params.unitTypes, params.unit, nextHexId)) break;
    const cost = Math.max(1, Math.ceil(params.getHexMovementCost?.(nextHexId, params.unit.countryId, params.unit.hexId, params.unitType.domain) ?? 1));
    if (cost > budget) break;
    budget -= cost;
    params.unit.hexId = nextHexId;
    remainingRoute.shift();
    moved = true;
  }
  params.unit.path = remainingRoute;
  params.unit.targetHexId = remainingRoute.length > 0 ? remainingRoute[remainingRoute.length - 1]! : null;
  params.unit.movementPoints = budget;
  params.unit.lastActionTurnId = params.turnId;
  params.unit.status = remainingRoute.length > 0 ? "moving" : "idle";
  params.worldBase.unitsById ??= {};
  params.worldBase.unitsById[params.unit.id] = params.unit;
  if (moved) params.news?.push(makeMapUnitMovementNews(params.unit, params.turnId, remainingRoute.length));
  return moved;
}

function canUnitEnterHex(domain: UnitDomain, hex: { passable?: boolean; waterKind?: string | null } | null): boolean {
  if (!hex) return true;
  if (domain === "naval") return hex.waterKind != null;
  if (domain === "air") return true;
  return hex.passable !== false && hex.waterKind == null;
}

function isStackBlocked(
  worldBase: MapUnitWorldState,
  unitTypes: readonly UnitTypeDefinition[],
  unit: MapUnit,
  targetHexId: HexId,
): boolean {
  const unitType = getUnitType(unitTypes, unit.unitTypeId);
  if (!unitType) return true;
  return isStackBlockedForType(worldBase, unitTypes, unit.countryId, targetHexId, unitType, unit.id);
}

function isStackBlockedForType(
  worldBase: MapUnitWorldState,
  unitTypes: readonly UnitTypeDefinition[],
  countryId: string,
  targetHexId: HexId,
  unitType: UnitTypeDefinition,
  ignoredUnitId?: string,
): boolean {
  for (const other of Object.values(worldBase.unitsById ?? {})) {
    if (other.id === ignoredUnitId || other.hexId !== targetHexId || other.status === "destroyed" || other.status === "captured") continue;
    const otherType = getUnitType(unitTypes, other.unitTypeId);
    if (!otherType) continue;
    if (unitType.domain === "civilian" && otherType.domain === "civilian") return true;
    if (isCombatDomain(unitType.domain) && isCombatDomain(otherType.domain) && other.countryId === countryId) return true;
  }
  return false;
}

function findDefenderOnHex(params: {
  worldBase: MapUnitWorldState;
  unitTypes: readonly UnitTypeDefinition[];
  attacker: MapUnit;
  targetHexId: HexId;
}): MapUnit | null {
  return (
    Object.values(params.worldBase.unitsById ?? {}).find((unit) => {
      if (unit.hexId !== params.targetHexId || unit.countryId === params.attacker.countryId || unit.status === "destroyed") return false;
      const unitType = getUnitType(params.unitTypes, unit.unitTypeId);
      return unitType != null && isCombatDomain(unitType.domain);
    }) ?? null
  );
}

function hexDistance(left: HexId, right: HexId): number {
  const leftCoords = parseHexId(left);
  const rightCoords = parseHexId(right);
  if (!leftCoords || !rightCoords) return Number.POSITIVE_INFINITY;
  return axialDistance(leftCoords, rightCoords);
}

function resolveUnitLevel(experience: number, levelThresholds: Record<string, number>): number {
  let level = 1;
  for (const [rawLevel, rawThreshold] of Object.entries(levelThresholds)) {
    const nextLevel = Number(rawLevel);
    if (!Number.isInteger(nextLevel) || nextLevel < 1 || !Number.isFinite(rawThreshold)) continue;
    if (experience >= rawThreshold) level = Math.max(level, nextLevel);
  }
  return level;
}

function parseHexId(hexId: HexId): { q: number; r: number } | null {
  const match = /^hex:(-?\d+):(-?\d+)$/.exec(hexId);
  if (!match) return null;
  return { q: Number(match[1]), r: Number(match[2]) };
}

function sanitizeUnitId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function makeMapUnitMovementNews(unit: MapUnit, turnId: number, remainingSteps: number): EventLogEntry {
  return {
    id: `event:map-unit-move:${unit.id}:${turnId}`,
    turn: turnId,
    category: "military",
    title: remainingSteps > 0 ? "unit.news.move_continues.title" : "unit.news.move_complete.title",
    message: remainingSteps > 0 ? "unit.news.move_continues.message" : "unit.news.move_complete.message",
    countryId: unit.countryId,
    priority: "low",
    visibility: "private",
    timestamp: new Date().toISOString(),
  };
}

function makeMapUnitMovementBlockedNews(unit: MapUnit, turnId: number, targetHexId: HexId): EventLogEntry {
  return {
    id: `event:map-unit-route-blocked:${unit.id}:${turnId}:${targetHexId}`,
    turn: turnId,
    category: "military",
    title: "unit.news.move_blocked.title",
    message: "unit.news.move_blocked.message",
    countryId: unit.countryId,
    priority: "medium",
    visibility: "private",
    timestamp: new Date().toISOString(),
  };
}

function makeMapUnitCombatNews(
  attacker: MapUnit,
  defender: MapUnit,
  turnId: number,
  defenderDamage: number,
  attackerDamage: number,
): EventLogEntry {
  return {
    id: `event:map-unit-combat:${attacker.id}:${defender.id}:${turnId}`,
    turn: turnId,
    category: "military",
    title: "unit.news.combat.title",
    message: `unit.news.combat.message:${defenderDamage}:${attackerDamage}`,
    countryId: attacker.countryId,
    priority: "medium",
    visibility: "private",
    timestamp: new Date().toISOString(),
  };
}

function makeMapUnitTrainedNews(unit: MapUnit, turnId: number): EventLogEntry {
  return {
    id: `event:map-unit-trained:${unit.id}:${turnId}`,
    turn: turnId,
    category: "military",
    title: "unit.news.trained.title",
    message: "unit.news.trained.message",
    countryId: unit.countryId,
    priority: "medium",
    visibility: "private",
    timestamp: new Date().toISOString(),
  };
}
