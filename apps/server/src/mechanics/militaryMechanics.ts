import type {
  Division,
  DivisionStats,
  DivisionTemplateBattalion,
  EventPriority,
  EventVisibility,
  MilitaryFormationQueueItem,
  MilitaryBranch,
  MilitaryTemplateComponent,
  Order,
  ResourceTotals,
  WorldBase,
} from "@arcanorum/shared";

export type MilitaryEquipmentNeed = {
  goodId: string;
  amount: number;
};

export type MilitaryContentEntry = DivisionStats & {
  id: string;
  trainingCostDucats?: number | null;
  trainingCostManpower?: number | null;
  equipmentNeeds?: MilitaryEquipmentNeed[];
};

export type MilitaryFormationCost = {
  ducats: number;
  manpower: number;
  equipmentNeeds: MilitaryEquipmentNeed[];
};

export type MilitaryIdFactory = () => string;

export type MilitaryWorldState = Pick<
  WorldBase,
  "provinceOwner" | "divisionsById" | "divisionTemplatesByCountry" | "militaryFormationQueueByCountry" | "resourcesByCountry"
>;

export type MilitaryProvinceNode = {
  id: string;
  neighbors?: string[];
};

export type MilitaryRuntimeEvent = {
  category: "military";
  title: string;
  message: string;
  countryId: string;
  priority: EventPriority;
  visibility: EventVisibility;
};

export type MilitaryRejectedOrder = {
  playerId: string;
  reason: string;
  tempOrderId?: string;
};

export type ArmyMoveOrderResolution = {
  rejectedOrder: MilitaryRejectedOrder | null;
  moved: boolean;
};

export type MilitaryFormationSpendResult =
  | { ok: true }
  | { ok: false; error: "NOT_ENOUGH_DUCATS" | "NOT_ENOUGH_EQUIPMENT"; details?: unknown };

export const EMPTY_DIVISION_STATS: DivisionStats = {
  manpower: 0,
  attack: 0,
  defense: 0,
  breakthrough: 0,
  organization: 0,
  hp: 0,
  speed: 1,
  supplyUse: 0,
};

export function isMilitaryBranch(value: unknown): value is MilitaryBranch {
  return value === "land" || value === "naval" || value === "air";
}

export function componentsToDivisionBattalions(
  components: MilitaryTemplateComponent[],
  battalionCatalog: MilitaryContentEntry[],
): DivisionTemplateBattalion[] {
  const validBattalionTypeIds = new Set(battalionCatalog.map((entry) => entry.id));
  return components
    .filter((component) => validBattalionTypeIds.has(component.typeId))
    .map((component) => ({ id: component.id, battalionTypeId: component.typeId, count: component.count }))
    .slice(0, 12);
}

export function normalizeDivisionBattalions(params: {
  input: unknown;
  battalionCatalog: MilitaryContentEntry[];
  fallbackBattalionTypeId: string;
  createId: MilitaryIdFactory;
}): DivisionTemplateBattalion[] {
  const createFallback = () => [{ id: params.createId(), battalionTypeId: params.fallbackBattalionTypeId, count: 6 }];
  if (!Array.isArray(params.input)) return createFallback();
  const validBattalionTypeIds = new Set(params.battalionCatalog.map((entry) => entry.id));
  const rows = params.input
    .map((raw): DivisionTemplateBattalion | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as { id?: unknown; battalionTypeId?: unknown; count?: unknown };
      const battalionTypeId =
        typeof row.battalionTypeId === "string" && row.battalionTypeId.trim()
          ? row.battalionTypeId.trim().slice(0, 120)
          : "";
      if (!battalionTypeId || !validBattalionTypeIds.has(battalionTypeId)) return null;
      const count = Math.max(1, Math.min(24, Math.floor(Number(row.count) || 1)));
      const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 80) : params.createId();
      return { id, battalionTypeId, count };
    })
    .filter((row): row is DivisionTemplateBattalion => Boolean(row));
  return rows.length > 0 ? rows.slice(0, 12) : createFallback();
}

export function normalizeMilitaryTemplateComponents(params: {
  input: unknown;
  kind: MilitaryBranch;
  catalog: MilitaryContentEntry[];
  fallbackBattalions?: DivisionTemplateBattalion[];
  createId: MilitaryIdFactory;
}): MilitaryTemplateComponent[] {
  const fallbackTypeId = params.catalog[0]?.id ?? "";
  if (
    params.kind === "land" &&
    (!Array.isArray(params.input) || params.input.length === 0) &&
    params.fallbackBattalions?.length
  ) {
    return params.fallbackBattalions.map((battalion) => ({
      id: battalion.id || params.createId(),
      typeId: battalion.battalionTypeId,
      count: battalion.count,
      role: "line",
    }));
  }
  if (!Array.isArray(params.input)) {
    return fallbackTypeId
      ? [{ id: params.createId(), typeId: fallbackTypeId, count: params.kind === "air" ? 100 : 1 }]
      : [];
  }
  const validTypeIds = new Set(params.catalog.map((entry) => entry.id));
  const rows = params.input
    .map((raw): MilitaryTemplateComponent | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Partial<MilitaryTemplateComponent>;
      const typeId = typeof row.typeId === "string" && row.typeId.trim() ? row.typeId.trim().slice(0, 120) : "";
      if (!typeId || !validTypeIds.has(typeId)) return null;
      const max = params.kind === "land" ? 24 : 999;
      const count = Math.max(1, Math.min(max, Math.floor(Number(row.count) || 1)));
      const role = params.kind === "land" && row.role === "support" ? "support" : "line";
      return {
        id: typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 80) : params.createId(),
        typeId,
        count,
        role,
      };
    })
    .filter((row): row is MilitaryTemplateComponent => Boolean(row));
  return rows.length > 0
    ? rows.slice(0, params.kind === "land" ? 17 : 24)
    : fallbackTypeId
      ? [{ id: params.createId(), typeId: fallbackTypeId, count: params.kind === "air" ? 100 : 1 }]
      : [];
}

export function calculateDivisionStats(
  battalions: DivisionTemplateBattalion[],
  battalionCatalog: MilitaryContentEntry[],
): DivisionStats {
  const battalionById = new Map(battalionCatalog.map((entry) => [entry.id, entry] as const));
  return calculateContentStats(
    battalions.map((battalion) => ({
      typeId: battalion.battalionTypeId,
      count: battalion.count,
    })),
    battalionById,
  );
}

export function calculateMilitaryStats(params: {
  kind: MilitaryBranch;
  components: MilitaryTemplateComponent[];
  catalog: MilitaryContentEntry[];
  battalionCatalog: MilitaryContentEntry[];
}): DivisionStats {
  if (params.kind === "land") {
    return calculateDivisionStats(
      componentsToDivisionBattalions(params.components, params.battalionCatalog),
      params.battalionCatalog,
    );
  }
  const contentById = new Map(params.catalog.map((entry) => [entry.id, entry] as const));
  return calculateContentStats(params.components, contentById);
}

export function calculateDivisionTrainingCost(
  battalions: DivisionTemplateBattalion[],
  battalionCatalog: MilitaryContentEntry[],
): MilitaryFormationCost {
  const battalionById = new Map(battalionCatalog.map((entry) => [entry.id, entry] as const));
  return calculateContentFormationCost(
    battalions.map((battalion) => ({
      typeId: battalion.battalionTypeId,
      count: battalion.count,
    })),
    battalionById,
  );
}

export function calculateMilitaryFormationCost(params: {
  kind: MilitaryBranch;
  components: MilitaryTemplateComponent[];
  catalog: MilitaryContentEntry[];
  battalionCatalog: MilitaryContentEntry[];
}): MilitaryFormationCost {
  if (params.kind === "land") {
    return calculateDivisionTrainingCost(
      componentsToDivisionBattalions(params.components, params.battalionCatalog),
      params.battalionCatalog,
    );
  }
  const contentById = new Map(params.catalog.map((entry) => [entry.id, entry] as const));
  return calculateContentFormationCost(params.components, contentById);
}

export function normalizeArmyMoveRoute(
  payload: Record<string, unknown> | undefined,
  fallbackProvinceId: string,
  currentProvinceId: string,
): string[] {
  const requestedPath = Array.isArray(payload?.path)
    ? payload.path.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim())
    : [];
  const route = (requestedPath.length > 0 ? requestedPath : [fallbackProvinceId]).filter((provinceId) => provinceId !== currentProvinceId);
  return route.slice(0, 64);
}

export function isContiguousArmyRoute(params: {
  fromProvinceId: string;
  route: string[];
  areProvinceIdsAdjacentOrSame: (fromProvinceId: string, toProvinceId: string) => boolean;
}): boolean {
  if (params.route.length === 0) return false;
  let cursorProvinceId = params.fromProvinceId;
  for (const provinceId of params.route) {
    if (!params.areProvinceIdsAdjacentOrSame(cursorProvinceId, provinceId)) {
      return false;
    }
    cursorProvinceId = provinceId;
  }
  return true;
}

export function findRetreatProvince(params: {
  division: Division;
  blockedProvinceId: string;
  provinces: MilitaryProvinceNode[];
  provinceOwner: Record<string, string | null | undefined>;
}): string | null {
  const province = params.provinces.find((entry) => entry.id === params.division.provinceId);
  const neighbors = province?.neighbors ?? [];
  return (
    neighbors.find(
      (provinceId) =>
        provinceId !== params.blockedProvinceId && (params.provinceOwner[provinceId] ?? null) === params.division.countryId,
    ) ?? null
  );
}

export function applyDivisionDamage(division: Division, orgDamage: number, strengthDamage: number): void {
  division.organization = round3(Math.max(0, division.organization - Math.max(0, orgDamage)));
  division.strength = round3(Math.max(0, division.strength - Math.max(0, strengthDamage)));
}

export function resolveDivisionBattle(params: {
  attacker: Division;
  targetProvinceId: string;
  worldBase: MilitaryWorldState;
  provinces: MilitaryProvinceNode[];
  events: MilitaryRuntimeEvent[];
}): boolean {
  const defenders = Object.values(params.worldBase.divisionsById).filter(
    (division) =>
      (division.kind ?? "land") === "land" &&
      division.provinceId === params.targetProvinceId &&
      division.countryId !== params.attacker.countryId &&
      division.strength > 0,
  );
  const targetOwnerId = params.worldBase.provinceOwner[params.targetProvinceId] ?? null;
  if (defenders.length === 0) {
    params.attacker.provinceId = params.targetProvinceId;
    params.attacker.status = "idle";
    if (targetOwnerId !== params.attacker.countryId) {
      params.worldBase.provinceOwner[params.targetProvinceId] = params.attacker.countryId;
    }
    return true;
  }

  const attackerOrgRatio = params.attacker.stats.organization > 0 ? params.attacker.organization / params.attacker.stats.organization : 0;
  const attackerPower = Math.max(
    1,
    (params.attacker.stats.attack + params.attacker.stats.breakthrough * 0.35) * params.attacker.strength * Math.max(0.2, attackerOrgRatio),
  );
  const defenderPower = defenders.reduce((sum, defender) => {
    const orgRatio = defender.stats.organization > 0 ? defender.organization / defender.stats.organization : 0;
    return sum + Math.max(1, (defender.stats.defense + defender.stats.attack * 0.25) * defender.strength * Math.max(0.2, orgRatio));
  }, 0);
  const defenderShare = attackerPower / Math.max(1, defenders.length);
  for (const defender of defenders) {
    applyDivisionDamage(defender, defenderShare * 0.08, (defenderShare / Math.max(1, defender.stats.hp)) * 0.04);
    defender.status = "fighting";
  }
  applyDivisionDamage(params.attacker, defenderPower * 0.06, (defenderPower / Math.max(1, params.attacker.stats.hp)) * 0.035);
  params.attacker.status = "fighting";

  const brokenDefenders = defenders.filter((defender) => defender.organization <= 0.05 || defender.strength <= 0.05);
  for (const defender of brokenDefenders) {
    if (defender.strength <= 0.05) {
      delete params.worldBase.divisionsById[defender.id];
      continue;
    }
    const retreatProvinceId = findRetreatProvince({
      division: defender,
      blockedProvinceId: params.targetProvinceId,
      provinces: params.provinces,
      provinceOwner: params.worldBase.provinceOwner,
    });
    if (retreatProvinceId) {
      defender.provinceId = retreatProvinceId;
      defender.organization = round3(Math.max(0.1, defender.stats.organization * 0.25));
      defender.status = "retreating";
      defender.path = [];
    } else {
      delete params.worldBase.divisionsById[defender.id];
    }
  }

  if (params.attacker.organization <= 0.05 || params.attacker.strength <= 0.05) {
    params.attacker.status = "retreating";
    params.attacker.path = [];
    params.events.push({
      category: "military",
      title: "Атака отбита",
      message: `${params.attacker.name} не смогла взять провинцию ${params.targetProvinceId}`,
      countryId: params.attacker.countryId,
      priority: "medium",
      visibility: "private",
    });
    return false;
  }

  const remainingDefenders = Object.values(params.worldBase.divisionsById).filter(
    (division) =>
      (division.kind ?? "land") === "land" &&
      division.provinceId === params.targetProvinceId &&
      division.countryId !== params.attacker.countryId &&
      division.strength > 0.05,
  );
  if (remainingDefenders.length === 0) {
    params.attacker.provinceId = params.targetProvinceId;
    params.attacker.status = "idle";
    params.attacker.path = [];
    params.worldBase.provinceOwner[params.targetProvinceId] = params.attacker.countryId;
    params.events.push({
      category: "military",
      title: "Провинция захвачена",
      message: `${params.attacker.name} взяла под контроль провинцию ${params.targetProvinceId}`,
      countryId: params.attacker.countryId,
      priority: "medium",
      visibility: "public",
    });
    return true;
  }

  params.events.push({
    category: "military",
    title: "Бой продолжается",
    message: `${params.attacker.name} вступила в бой за провинцию ${params.targetProvinceId}`,
    countryId: params.attacker.countryId,
    priority: "medium",
    visibility: "private",
  });
  return false;
}

export function advanceDivisionAlongRoute(params: {
  division: Division;
  route: string[];
  worldBase: MilitaryWorldState;
  provinces: MilitaryProvinceNode[];
  turnId: number;
  events: MilitaryRuntimeEvent[];
}): boolean {
  const maxSteps = Math.max(1, Math.floor(Number(params.division.stats.speed) || 1));
  let remainingRoute = params.route.filter((provinceId) => provinceId !== params.division.provinceId).slice(0, 64);
  let moved = false;

  for (let step = 0; step < maxSteps && remainingRoute.length > 0; step += 1) {
    const nextProvinceId = remainingRoute[0];
    const hasEnemyDivision = Object.values(params.worldBase.divisionsById).some(
      (other) =>
        (other.kind ?? "land") === "land" &&
        other.id !== params.division.id &&
        other.provinceId === nextProvinceId &&
        other.countryId !== params.division.countryId,
    );
    const targetOwnerId = params.worldBase.provinceOwner[nextProvinceId] ?? null;
    if (hasEnemyDivision || (targetOwnerId && targetOwnerId !== params.division.countryId)) {
      resolveDivisionBattle({
        attacker: params.division,
        targetProvinceId: nextProvinceId,
        worldBase: params.worldBase,
        provinces: params.provinces,
        events: params.events,
      });
      remainingRoute = [];
      moved = true;
      break;
    }

    params.division.provinceId = nextProvinceId;
    remainingRoute = remainingRoute.slice(1);
    moved = true;
  }

  if (!moved) {
    return false;
  }

  params.division.path = remainingRoute;
  if (params.division.status !== "fighting" && params.division.status !== "retreating") {
    params.division.status = remainingRoute.length > 0 ? "moving" : "idle";
  }
  params.division.lastMovedTurnId = params.turnId;
  params.worldBase.divisionsById[params.division.id] = params.division;
  params.events.push({
    category: "military",
    title: remainingRoute.length > 0 ? "Дивизия продолжает марш" : "Передислокация дивизии",
    message:
      remainingRoute.length > 0
        ? `${params.division.name} прибыла в провинцию ${params.division.provinceId}; осталось ${remainingRoute.length} шагов`
        : `${params.division.name} завершила приказ движения в провинции ${params.division.provinceId}`,
    countryId: params.division.countryId,
    priority: "low",
    visibility: "private",
  });
  return true;
}

export function resolveArmyMoveOrder(params: {
  order: Order;
  playerId: string;
  worldBase: MilitaryWorldState;
  provinces: MilitaryProvinceNode[];
  turnId: number;
  movedDivisionIds: Set<string>;
  events: MilitaryRuntimeEvent[];
  areProvinceIdsAdjacentOrSame: (fromProvinceId: string, toProvinceId: string) => boolean;
}): ArmyMoveOrderResolution {
  const divisionId = typeof params.order.payload?.divisionId === "string" ? params.order.payload.divisionId.trim() : "";
  const division = divisionId ? params.worldBase.divisionsById[divisionId] : null;
  const reject = (reason: string): ArmyMoveOrderResolution => ({
    rejectedOrder: { playerId: params.playerId, reason, tempOrderId: params.order.id },
    moved: false,
  });

  if (params.order.type !== "ARMY_MOVE") {
    return reject("INVALID_ORDER_TYPE");
  }
  if (!division || division.countryId !== params.order.countryId || (division.kind ?? "land") !== "land") {
    return reject("DIVISION_NOT_FOUND");
  }
  if (params.movedDivisionIds.has(division.id) || division.lastMovedTurnId === params.turnId) {
    return reject("DIVISION_ALREADY_MOVED");
  }
  const route = normalizeArmyMoveRoute(params.order.payload, params.order.provinceId, division.provinceId);
  if (route.length === 0) {
    return reject("DIVISION_TARGET_INVALID");
  }
  if (
    !isContiguousArmyRoute({
      fromProvinceId: division.provinceId,
      route,
      areProvinceIdsAdjacentOrSame: params.areProvinceIdsAdjacentOrSame,
    })
  ) {
    return reject("DIVISION_TARGET_NOT_ADJACENT");
  }

  division.path = route;
  const moved = advanceDivisionAlongRoute({
    division,
    route,
    worldBase: params.worldBase,
    provinces: params.provinces,
    turnId: params.turnId,
    events: params.events,
  });
  if (moved) {
    params.movedDivisionIds.add(division.id);
  }
  return { rejectedOrder: null, moved };
}

export function advanceStoredArmyRoutesTurn(params: {
  worldBase: MilitaryWorldState;
  provinces: MilitaryProvinceNode[];
  turnId: number;
  movedDivisionIds: Set<string>;
  events: MilitaryRuntimeEvent[];
  areProvinceIdsAdjacentOrSame: (fromProvinceId: string, toProvinceId: string) => boolean;
}): void {
  for (const division of Object.values(params.worldBase.divisionsById)) {
    if ((division.kind ?? "land") !== "land") continue;
    if (params.movedDivisionIds.has(division.id) || division.lastMovedTurnId === params.turnId || division.path.length === 0) continue;
    const route = division.path.filter((provinceId) => provinceId !== division.provinceId).slice(0, 64);
    if (
      !isContiguousArmyRoute({
        fromProvinceId: division.provinceId,
        route,
        areProvinceIdsAdjacentOrSame: params.areProvinceIdsAdjacentOrSame,
      })
    ) {
      division.path = [];
      division.status = "idle";
      params.worldBase.divisionsById[division.id] = division;
      continue;
    }
    if (
      advanceDivisionAlongRoute({
        division,
        route,
        worldBase: params.worldBase,
        provinces: params.provinces,
        turnId: params.turnId,
        events: params.events,
      })
    ) {
      params.movedDivisionIds.add(division.id);
    }
  }
}

export function advanceMilitaryFormationQueue(params: {
  worldBase: MilitaryWorldState;
  turnId: number;
  createId: MilitaryIdFactory;
  events: MilitaryRuntimeEvent[];
}): void {
  for (const [countryId, queue] of Object.entries(params.worldBase.militaryFormationQueueByCountry)) {
    if (queue.length === 0) continue;
    const remaining: MilitaryFormationQueueItem[] = [];
    for (const item of queue) {
      const turnsTotal = Math.max(1, Math.floor(Number(item.turnsTotal) || 1));
      const turnsRemaining = Math.max(0, Math.floor(Number(item.turnsRemaining) || turnsTotal) - 1);
      if (turnsRemaining > 0) {
        remaining.push({
          ...item,
          turnsTotal,
          turnsRemaining,
          progress: round3(Math.max(0, Math.min(1, (turnsTotal - turnsRemaining) / turnsTotal))),
        });
        continue;
      }
      const template = (params.worldBase.divisionTemplatesByCountry[countryId] ?? []).find((entry) => entry.id === item.templateId);
      if (!template) {
        continue;
      }
      const unit: Division = {
        id: params.createId(),
        countryId,
        templateId: template.id,
        name: item.name || template.name,
        kind: item.kind ?? template.kind ?? "land",
        provinceId: item.provinceId,
        strength: 1,
        organization: template.stats.organization,
        stats: template.stats,
        status: "idle",
        path: [],
        createdTurnId: params.turnId,
        lastMovedTurnId: null,
      };
      params.worldBase.divisionsById[unit.id] = unit;
      params.events.push({
        category: "military",
        title: "Формирование завершено",
        message: `${unit.name} готова и базируется в провинции ${unit.provinceId}`,
        countryId,
        priority: "medium",
        visibility: "private",
      });
    }
    if (remaining.length > 0) {
      params.worldBase.militaryFormationQueueByCountry[countryId] = remaining;
    } else {
      delete params.worldBase.militaryFormationQueueByCountry[countryId];
    }
  }
}

export function calculateFormationTurns(params: {
  cost: { manpower: number; equipmentNeeds: MilitaryEquipmentNeed[] };
  militaryFormationSpeed: number;
}): number {
  const totalEquipmentAmount = params.cost.equipmentNeeds.reduce((sum, need) => sum + Math.max(0, Number(need.amount) || 0), 0);
  const work = Math.max(0, Number(params.cost.manpower) || 0) / 1000 + totalEquipmentAmount;
  return Math.max(1, Math.ceil(work / Math.max(1, Number(params.militaryFormationSpeed || 10))));
}

export function spendMilitaryFormationCost(params: {
  countryResource: ResourceTotals | null | undefined;
  warehouseByResourceId: Record<string, number>;
  cost: { ducats: number; equipmentNeeds: MilitaryEquipmentNeed[] };
}): MilitaryFormationSpendResult {
  if (params.countryResource && params.cost.ducats > 0 && Number(params.countryResource.ducats ?? 0) < params.cost.ducats) {
    return { ok: false, error: "NOT_ENOUGH_DUCATS" };
  }
  for (const need of params.cost.equipmentNeeds) {
    const available = Number(params.warehouseByResourceId?.[need.goodId] ?? 0);
    if (available < need.amount) {
      return {
        ok: false,
        error: "NOT_ENOUGH_EQUIPMENT",
        details: { goodId: need.goodId, required: need.amount, available },
      };
    }
  }
  if (params.countryResource && params.cost.ducats > 0) {
    params.countryResource.ducats = round3(Math.max(0, Number(params.countryResource.ducats ?? 0) - params.cost.ducats));
  }
  for (const need of params.cost.equipmentNeeds) {
    params.warehouseByResourceId[need.goodId] = round3(Math.max(0, Number(params.warehouseByResourceId[need.goodId] ?? 0) - need.amount));
  }
  return { ok: true };
}

function calculateContentStats(
  components: Array<{ typeId: string; count: number }>,
  contentById: Map<string, MilitaryContentEntry>,
): DivisionStats {
  const stats = { ...EMPTY_DIVISION_STATS, speed: Number.POSITIVE_INFINITY };
  let totalComponents = 0;
  for (const component of components) {
    const base = contentById.get(component.typeId);
    if (!base) continue;
    const count = Math.max(1, Math.floor(Number(component.count) || 1));
    totalComponents += count;
    stats.manpower += base.manpower * count;
    stats.attack += base.attack * count;
    stats.defense += base.defense * count;
    stats.breakthrough += base.breakthrough * count;
    stats.organization += base.organization * count;
    stats.hp += base.hp * count;
    stats.speed = Math.min(stats.speed, base.speed);
    stats.supplyUse += base.supplyUse * count;
  }
  const divisor = Math.max(1, totalComponents);
  return {
    manpower: Math.round(stats.manpower),
    attack: round3(stats.attack),
    defense: round3(stats.defense),
    breakthrough: round3(stats.breakthrough),
    organization: round3(Math.max(1, stats.organization / divisor)),
    hp: round3(stats.hp),
    speed: round3(Number.isFinite(stats.speed) ? stats.speed : 1),
    supplyUse: round3(stats.supplyUse),
  };
}

function calculateContentFormationCost(
  components: Array<{ typeId: string; count: number }>,
  contentById: Map<string, MilitaryContentEntry>,
): MilitaryFormationCost {
  const equipmentByGoodId = new Map<string, number>();
  let ducats = 0;
  let manpower = 0;
  for (const component of components) {
    const content = contentById.get(component.typeId);
    if (!content) continue;
    const count = Math.max(1, Math.floor(Number(component.count) || 1));
    ducats += Number(content.trainingCostDucats ?? 0) * count;
    manpower += Number(content.trainingCostManpower ?? content.manpower ?? 0) * count;
    for (const need of content.equipmentNeeds ?? []) {
      equipmentByGoodId.set(need.goodId, Number(equipmentByGoodId.get(need.goodId) ?? 0) + Number(need.amount) * count);
    }
  }
  return {
    ducats: round3(Math.max(0, ducats)),
    manpower: round3(Math.max(0, manpower)),
    equipmentNeeds: [...equipmentByGoodId.entries()].map(([goodId, amount]) => ({
      goodId,
      amount: round3(Math.max(0, amount)),
    })),
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
