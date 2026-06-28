import type {
  AirWing,
  Division,
  DivisionEquipmentAssignment,
  DivisionStats,
  DivisionTemplateBattalion,
  EventPriority,
  EventVisibility,
  Fleet,
  HexId,
  MilitaryFormationQueueItem,
  MilitaryBranch,
  MilitaryTemplateComponent,
  Order,
  ResourceFlowSourceType,
  ResourceId,
  ResourceTotals,
  WorldBase,
} from "@arcanorum/shared";
import {
  applyEquipmentCoverageToDivisionStats,
  applyEquipmentLossesForRequirements,
  assignEquipmentVariantsForRequirements,
  calculateEquipmentCrewManpower,
  calculateEquipmentCoverage,
} from "./equipmentMechanics";

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

export type MilitaryLedgerFlowInput = {
  countryId: string;
  resourceId: ResourceId;
  amount: number;
  sourceType: ResourceFlowSourceType;
  sourceId: string;
  categoryId: string;
  labelKey: string;
  labelParams?: Record<string, string | number | boolean | null>;
  metadata?: Record<string, string | number | boolean | null>;
};

export type MilitaryIdFactory = () => string;

export type MilitaryWorldState = Pick<
  WorldBase,
  | "hexOwner"
  | "divisionsById"
  | "fleetsById"
  | "airWingsById"
  | "divisionTemplatesByCountry"
  | "militaryFormationQueueByCountry"
  | "resourcesByCountry"
  | "civilianUnitsById"
  | "equipmentVariantsById"
  | "equipmentStockpileByCountry"
>;

export type MilitaryHexNode = {
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

export type UnitAttackOrderResolution = {
  rejectedOrder: MilitaryRejectedOrder | null;
  attacked: boolean;
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
  armor: 0,
  piercing: 0,
  range: 0,
  reliability: 0,
  fuelUse: 0,
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

export function isContiguousArmyRoute(params: {
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

export function findRetreatHex(params: {
  division: Division;
  blockedHexId: string;
  hexes: MilitaryHexNode[];
  hexOwner: Record<string, string | null | undefined>;
}): HexId | null {
  const hex = params.hexes.find((entry) => entry.id === params.division.hexId);
  const neighbors = hex?.neighbors ?? [];
  return (
    (neighbors.find(
      (hexId) =>
        hexId !== params.blockedHexId && /^hex:-?\d+:-?\d+$/.test(hexId) && (params.hexOwner[hexId] ?? null) === params.division.countryId,
    ) as HexId | undefined) ?? null
  );
}

export function applyDivisionDamage(division: Division, orgDamage: number, strengthDamage: number): void {
  division.organization = round3(Math.max(0, division.organization - Math.max(0, orgDamage)));
  division.strength = round3(Math.max(0, division.strength - Math.max(0, strengthDamage)));
}

export function applyDivisionEquipmentLosses(params: {
  division: Division;
  worldBase: MilitaryWorldState;
  strengthBeforeDamage: number;
}): Record<string, number> {
  const strengthBeforeDamage = Math.max(0, Number(params.strengthBeforeDamage) || 0);
  if (strengthBeforeDamage <= 0) return {};
  const strengthLoss = Math.max(0, strengthBeforeDamage - Math.max(0, Number(params.division.strength) || 0));
  if (strengthLoss <= 0) return {};
  const stockpileByVariantId = params.worldBase.equipmentStockpileByCountry[params.division.countryId];
  const lossRatio = strengthLoss / strengthBeforeDamage;
  if (params.division.equipmentAssignments && params.division.equipmentAssignments.length > 0) {
    return applyEquipmentLossesForDivisionAssignments({
      assignments: params.division.equipmentAssignments,
      equipmentByVariantId: params.division.equipmentByVariantId ?? {},
      lossRatio,
    });
  }
  if (!stockpileByVariantId) return {};
  const template = params.worldBase.divisionTemplatesByCountry[params.division.countryId]?.find(
    (entry) => entry.id === params.division.templateId,
  );
  const requirements = template?.equipmentRequirements ?? [];
  if (requirements.length === 0) return {};
  return applyEquipmentLossesForRequirements({
    requirements,
    variants: getCountryUsableEquipmentVariants(params.worldBase, params.division.countryId),
    stockpileByVariantId,
    lossRatio,
  });
}

export function calculateDivisionEquipmentCoverageForMilitaryState(params: {
  division: Division;
  worldBase: MilitaryWorldState;
}): number {
  if (params.division.equipmentAssignments && params.division.equipmentAssignments.length > 0) {
    return calculateEquipmentCoverageFromAssignments(params.division.equipmentAssignments);
  }
  const template = params.worldBase.divisionTemplatesByCountry[params.division.countryId]?.find(
    (entry) => entry.id === params.division.templateId,
  );
  const requirements = template?.equipmentRequirements ?? [];
  if (requirements.length === 0) return 1;
  const stockpile = params.worldBase.equipmentStockpileByCountry[params.division.countryId] ?? {};
  return calculateEquipmentCoverage(
    assignEquipmentVariantsForRequirements({
      requirements,
      variants: getCountryUsableEquipmentVariants(params.worldBase, params.division.countryId),
      stockpileByVariantId: stockpile,
    }),
  );
}

export function refreshDivisionEquipmentState(params: { division: Division; worldBase: MilitaryWorldState }): boolean {
  const template = params.worldBase.divisionTemplatesByCountry[params.division.countryId]?.find(
    (entry) => entry.id === params.division.templateId,
  );
  if (!template) return false;
  params.division.kind = template.kind ?? "land";
  params.division.equipmentAssignments = buildDivisionEquipmentAssignments({
    worldBase: params.worldBase,
    countryId: params.division.countryId,
    requirements: template.equipmentRequirements ?? [],
    stockpileByVariantId: params.worldBase.equipmentStockpileByCountry[params.division.countryId] ?? {},
  });
  const equipmentCoverage = calculateDivisionEquipmentCoverageForMilitaryState(params);
  params.division.equipmentCoverage = equipmentCoverage;
  params.division.stats = applyEquipmentCoverageToDivisionStats(template.stats, equipmentCoverage, params.division.equipmentAssignments);
  params.division.stats.manpower += calculateEquipmentCrewManpower(params.division.equipmentAssignments);
  params.division.organization = Math.min(params.division.organization, params.division.stats.organization);
  return true;
}

export function refreshCountryDivisionEquipmentState(params: { countryId: string; worldBase: MilitaryWorldState; turnId?: number | null }): void {
  const templates = params.worldBase.divisionTemplatesByCountry[params.countryId] ?? [];
  params.worldBase.equipmentStockpileByCountry[params.countryId] ??= {};
  const stockpile = params.worldBase.equipmentStockpileByCountry[params.countryId];
  const divisions = Object.values(params.worldBase.divisionsById)
    .filter((division) => division.countryId === params.countryId)
    .sort((left, right) => getSupplyPriorityRank(right.supplyPriority) - getSupplyPriorityRank(left.supplyPriority) || left.id.localeCompare(right.id));
  for (const division of divisions) {
    const template = templates.find((entry) => entry.id === division.templateId);
    if (!template) continue;
    division.kind = template.kind ?? "land";
    const reconciliation = reconcileDivisionEquipmentLoadout({
      division,
      worldBase: params.worldBase,
      countryId: params.countryId,
      requirements: template.equipmentRequirements ?? [],
      stockpileByVariantId: stockpile,
    });
    division.equipmentByVariantId = reconciliation.nextLoadout;
    division.equipmentSupplyReport = {
      turnId: typeof params.turnId === "number" && Number.isFinite(params.turnId) ? Math.max(1, Math.floor(params.turnId)) : null,
      receivedByVariantId: reconciliation.receivedByVariantId,
      returnedByVariantId: reconciliation.returnedByVariantId,
    };
    const assignments = buildDivisionEquipmentAssignments({
      worldBase: params.worldBase,
      countryId: params.countryId,
      requirements: template.equipmentRequirements ?? [],
      stockpileByVariantId: division.equipmentByVariantId,
    });
    division.equipmentAssignments = assignments;
    const equipmentCoverage = calculateEquipmentCoverageFromAssignments(assignments);
    division.equipmentCoverage = equipmentCoverage;
    division.stats = applyEquipmentCoverageToDivisionStats(template.stats, equipmentCoverage, assignments);
    division.stats.manpower += calculateEquipmentCrewManpower(assignments);
    division.organization = Math.min(division.organization, division.stats.organization);
  }
}

function getSupplyPriorityRank(priority: Division["supplyPriority"]): number {
  if (priority === "high") return 2;
  if (priority === "low") return 0;
  return 1;
}

function reconcileDivisionEquipmentLoadout(params: {
  division: Division;
  worldBase: MilitaryWorldState;
  countryId: string;
  requirements: NonNullable<WorldBase["divisionTemplatesByCountry"][string][number]["equipmentRequirements"]>;
  stockpileByVariantId: Record<string, number>;
}): {
  nextLoadout: Record<string, number>;
  receivedByVariantId: Record<string, number>;
  returnedByVariantId: Record<string, number>;
} {
  const currentLoadout = normalizeEquipmentAmountMap(params.division.equipmentByVariantId ?? {});
  const receivedByVariantId: Record<string, number> = {};
  const returnedByVariantId: Record<string, number> = {};
  if (params.requirements.length === 0) {
    returnEquipmentToStockpile(currentLoadout, params.stockpileByVariantId, returnedByVariantId);
    return { nextLoadout: {}, receivedByVariantId, returnedByVariantId };
  }
  const combinedAvailability = { ...params.stockpileByVariantId };
  for (const [variantId, amount] of Object.entries(currentLoadout)) {
    combinedAvailability[variantId] = round3(Number(combinedAvailability[variantId] ?? 0) + amount);
  }
  const desiredByVariantId: Record<string, number> = {};
  for (const choice of assignEquipmentVariantsForRequirements({
    requirements: params.requirements,
    variants: getCountryUsableEquipmentVariants(params.worldBase, params.countryId),
    stockpileByVariantId: combinedAvailability,
  })) {
    if (!choice.equipmentVariantId || choice.assignedCount <= 0) continue;
    desiredByVariantId[choice.equipmentVariantId] = round3(
      Number(desiredByVariantId[choice.equipmentVariantId] ?? 0) + choice.assignedCount,
    );
  }

  const nextLoadout: Record<string, number> = {};
  for (const variantId of new Set([...Object.keys(currentLoadout), ...Object.keys(desiredByVariantId)])) {
    const current = Math.max(0, Number(currentLoadout[variantId] ?? 0) || 0);
    const desired = Math.max(0, Number(desiredByVariantId[variantId] ?? 0) || 0);
    if (current > desired) {
      const returned = round3(current - desired);
      params.stockpileByVariantId[variantId] = round3(Number(params.stockpileByVariantId[variantId] ?? 0) + returned);
      returnedByVariantId[variantId] = round3(Number(returnedByVariantId[variantId] ?? 0) + returned);
      if (desired > 0) nextLoadout[variantId] = round3(desired);
      continue;
    }
    if (current < desired) {
      const need = round3(desired - current);
      const taken = Math.min(need, Math.max(0, Number(params.stockpileByVariantId[variantId] ?? 0) || 0));
      if (taken > 0) {
        params.stockpileByVariantId[variantId] = round3(Math.max(0, Number(params.stockpileByVariantId[variantId] ?? 0) - taken));
        receivedByVariantId[variantId] = round3(Number(receivedByVariantId[variantId] ?? 0) + taken);
      }
      const next = round3(current + taken);
      if (next > 0) nextLoadout[variantId] = next;
      continue;
    }
    if (current > 0) nextLoadout[variantId] = round3(current);
  }
  cleanupZeroEquipment(params.stockpileByVariantId);
  return { nextLoadout, receivedByVariantId, returnedByVariantId };
}

function returnEquipmentToStockpile(
  equipmentByVariantId: Record<string, number>,
  stockpileByVariantId: Record<string, number>,
  returnedByVariantId?: Record<string, number>,
): void {
  for (const [variantId, amount] of Object.entries(equipmentByVariantId)) {
    const normalizedAmount = Math.max(0, Number(amount) || 0);
    if (normalizedAmount <= 0) continue;
    stockpileByVariantId[variantId] = round3(Number(stockpileByVariantId[variantId] ?? 0) + normalizedAmount);
    if (returnedByVariantId) {
      returnedByVariantId[variantId] = round3(Number(returnedByVariantId[variantId] ?? 0) + normalizedAmount);
    }
  }
  cleanupZeroEquipment(stockpileByVariantId);
}

function normalizeEquipmentAmountMap(input: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [variantId, amount] of Object.entries(input)) {
    const normalizedAmount = round3(Math.max(0, Number(amount) || 0));
    if (normalizedAmount > 0) next[variantId] = normalizedAmount;
  }
  return next;
}

function cleanupZeroEquipment(input: Record<string, number>): void {
  for (const [variantId, amount] of Object.entries(input)) {
    if (Math.max(0, Number(amount) || 0) <= 0) delete input[variantId];
  }
}

function getCountryUsableEquipmentVariants(worldBase: MilitaryWorldState, countryId: string) {
  return Object.values(worldBase.equipmentVariantsById).filter((variant) => variant.countryId == null || variant.countryId === countryId);
}

function buildDivisionEquipmentAssignments(params: {
  worldBase: MilitaryWorldState;
  countryId: string;
  requirements: NonNullable<WorldBase["divisionTemplatesByCountry"][string][number]["equipmentRequirements"]>;
  stockpileByVariantId: Record<string, number>;
}): DivisionEquipmentAssignment[] {
  if (params.requirements.length === 0) return [];
  return assignEquipmentVariantsForRequirements({
    requirements: params.requirements,
    variants: getCountryUsableEquipmentVariants(params.worldBase, params.countryId),
    stockpileByVariantId: params.stockpileByVariantId,
  }).map((choice) => ({
    requirementId: choice.requirementId,
    equipmentVariantId: choice.equipmentVariantId,
    score: choice.score,
    requiredCount: choice.requiredCount,
    assignedCount: choice.assignedCount,
    coverage: choice.coverage,
  }));
}

function calculateEquipmentCoverageFromAssignments(assignments: DivisionEquipmentAssignment[]): number {
  const requiredTotal = assignments.reduce((sum, assignment) => sum + Math.max(0, assignment.requiredCount), 0);
  if (requiredTotal <= 0) return 1;
  const assignedTotal = assignments.reduce((sum, assignment) => sum + Math.max(0, assignment.assignedCount), 0);
  return round3(Math.min(1, assignedTotal / requiredTotal));
}

function applyEquipmentLossesForDivisionAssignments(params: {
  assignments: DivisionEquipmentAssignment[];
  equipmentByVariantId: Record<string, number>;
  lossRatio: number;
}): Record<string, number> {
  const normalizedLossRatio = Math.max(0, Math.min(1, Number(params.lossRatio) || 0));
  if (normalizedLossRatio <= 0) return {};
  const lossesByVariantId: Record<string, number> = {};
  for (const assignment of params.assignments) {
    const assignedVariants = assignment.variants?.length
      ? assignment.variants
      : assignment.equipmentVariantId
        ? [{ equipmentVariantId: assignment.equipmentVariantId, amount: assignment.assignedCount }]
        : [];
    for (const assigned of assignedVariants) {
      if (!assigned.equipmentVariantId || assigned.amount <= 0) continue;
      const currentEquipment = Math.max(0, Number(params.equipmentByVariantId[assigned.equipmentVariantId] ?? 0) || 0);
      const loss = Math.min(currentEquipment, round3(assigned.amount * normalizedLossRatio));
      if (loss <= 0) continue;
      params.equipmentByVariantId[assigned.equipmentVariantId] = round3(currentEquipment - loss);
      lossesByVariantId[assigned.equipmentVariantId] = round3(Number(lossesByVariantId[assigned.equipmentVariantId] ?? 0) + loss);
    }
  }
  cleanupZeroEquipment(params.equipmentByVariantId);
  return lossesByVariantId;
}

function normalizeLandDivisionStackLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return Number.POSITIVE_INFINITY;
  return Math.max(1, Math.floor(limit));
}

export function countLandDivisionsOnHex(params: {
  worldBase: MilitaryWorldState;
  hexId: HexId;
  countryId?: string;
  excludeDivisionId?: string;
}): number {
  return Object.values(params.worldBase.divisionsById).filter(
    (division) =>
      (division.kind ?? "land") === "land" &&
      division.id !== params.excludeDivisionId &&
      division.hexId === params.hexId &&
      (!params.countryId || division.countryId === params.countryId) &&
      division.strength > 0,
  ).length;
}

function canLandDivisionEnterHex(params: {
  worldBase: MilitaryWorldState;
  division: Division;
  hexId: HexId;
  landDivisionStackLimitPerHex?: number;
}): boolean {
  const limit = normalizeLandDivisionStackLimit(params.landDivisionStackLimitPerHex);
  if (!Number.isFinite(limit)) return true;
  return (
    countLandDivisionsOnHex({
      worldBase: params.worldBase,
      hexId: params.hexId,
      countryId: params.division.countryId,
      excludeDivisionId: params.division.id,
    }) < limit
  );
}

export function resolveDivisionBattle(params: {
  attacker: Division;
  targetHexId: HexId;
  worldBase: MilitaryWorldState;
  hexes: MilitaryHexNode[];
  events: MilitaryRuntimeEvent[];
  landDivisionStackLimitPerHex?: number;
}): boolean {
  const defenders = Object.values(params.worldBase.divisionsById).filter(
    (division) =>
      (division.kind ?? "land") === "land" &&
      division.hexId === params.targetHexId &&
      division.countryId !== params.attacker.countryId &&
      division.strength > 0,
  );
  const targetOwnerId = params.worldBase.hexOwner[params.targetHexId] ?? null;
  if (defenders.length === 0) {
    if (
      !canLandDivisionEnterHex({
        worldBase: params.worldBase,
        division: params.attacker,
        hexId: params.targetHexId,
        landDivisionStackLimitPerHex: params.landDivisionStackLimitPerHex,
      })
    ) {
      params.attacker.path = [];
      params.attacker.status = "idle";
      params.events.push({
        category: "military",
        title: "Марш остановлен",
        message: `${params.attacker.name} не может войти в hex ${params.targetHexId}: лимит дивизий на гексе достигнут`,
        countryId: params.attacker.countryId,
        priority: "low",
        visibility: "private",
      });
      return false;
    }
    params.attacker.hexId = params.targetHexId;
    params.attacker.status = "idle";
    if (targetOwnerId !== params.attacker.countryId) {
      params.worldBase.hexOwner[params.targetHexId] = params.attacker.countryId;
    }
    captureCivilianUnitsOnHex({
      division: params.attacker,
      worldBase: params.worldBase,
      events: params.events,
    });
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
  const countriesWithEquipmentChanges = new Set<string>();
  for (const defender of defenders) {
    const strengthBeforeDamage = defender.strength;
    applyDivisionDamage(defender, defenderShare * 0.08, (defenderShare / Math.max(1, defender.stats.hp)) * 0.04);
    const losses = applyDivisionEquipmentLosses({ division: defender, worldBase: params.worldBase, strengthBeforeDamage });
    if (Object.keys(losses).length > 0) countriesWithEquipmentChanges.add(defender.countryId);
    defender.status = "fighting";
  }
  const attackerStrengthBeforeDamage = params.attacker.strength;
  applyDivisionDamage(params.attacker, defenderPower * 0.06, (defenderPower / Math.max(1, params.attacker.stats.hp)) * 0.035);
  const attackerLosses = applyDivisionEquipmentLosses({ division: params.attacker, worldBase: params.worldBase, strengthBeforeDamage: attackerStrengthBeforeDamage });
  if (Object.keys(attackerLosses).length > 0) countriesWithEquipmentChanges.add(params.attacker.countryId);
  for (const countryId of countriesWithEquipmentChanges) {
    refreshCountryDivisionEquipmentState({ countryId, worldBase: params.worldBase });
  }
  params.attacker.status = "fighting";

  const brokenDefenders = defenders.filter((defender) => defender.organization <= 0.05 || defender.strength <= 0.05);
  for (const defender of brokenDefenders) {
    if (defender.strength <= 0.05) {
      delete params.worldBase.divisionsById[defender.id];
      continue;
    }
    const retreatHexId = findRetreatHex({
      division: defender,
      blockedHexId: params.targetHexId,
      hexes: params.hexes,
      hexOwner: params.worldBase.hexOwner,
    });
    if (retreatHexId) {
      defender.hexId = retreatHexId;
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
      message: `${params.attacker.name} не смогла взять hex ${params.targetHexId}`,
      countryId: params.attacker.countryId,
      priority: "medium",
      visibility: "private",
    });
    return false;
  }

  const remainingDefenders = Object.values(params.worldBase.divisionsById).filter(
    (division) =>
      (division.kind ?? "land") === "land" &&
      division.hexId === params.targetHexId &&
      division.countryId !== params.attacker.countryId &&
      division.strength > 0.05,
  );
  if (remainingDefenders.length === 0) {
    if (
      !canLandDivisionEnterHex({
        worldBase: params.worldBase,
        division: params.attacker,
        hexId: params.targetHexId,
        landDivisionStackLimitPerHex: params.landDivisionStackLimitPerHex,
      })
    ) {
      params.attacker.status = "idle";
      params.attacker.path = [];
      params.events.push({
        category: "military",
        title: "Продвижение остановлено",
        message: `${params.attacker.name} победила, но не вошла в hex ${params.targetHexId}: лимит дивизий на гексе достигнут`,
        countryId: params.attacker.countryId,
        priority: "medium",
        visibility: "private",
      });
      return true;
    }
    params.attacker.hexId = params.targetHexId;
    params.attacker.status = "idle";
    params.attacker.path = [];
    params.worldBase.hexOwner[params.targetHexId] = params.attacker.countryId;
    captureCivilianUnitsOnHex({
      division: params.attacker,
      worldBase: params.worldBase,
      events: params.events,
    });
    params.events.push({
      category: "military",
      title: "Hex захвачен",
      message: `${params.attacker.name} взяла под контроль hex ${params.targetHexId}`,
      countryId: params.attacker.countryId,
      priority: "medium",
      visibility: "public",
    });
    return true;
  }

  params.events.push({
    category: "military",
    title: "Бой продолжается",
    message: `${params.attacker.name} вступила в бой за hex ${params.targetHexId}`,
    countryId: params.attacker.countryId,
    priority: "medium",
    visibility: "private",
  });
  return false;
}

export function advanceDivisionAlongRoute(params: {
  division: Division;
  route: HexId[];
  worldBase: MilitaryWorldState;
  hexes: MilitaryHexNode[];
  turnId: number;
  events: MilitaryRuntimeEvent[];
  landDivisionStackLimitPerHex?: number;
}): boolean {
  const maxSteps = Math.max(1, Math.floor(Number(params.division.stats.speed) || 1));
  let remainingRoute = params.route.filter((hexId) => hexId !== params.division.hexId).slice(0, 64);
  let moved = false;

  for (let step = 0; step < maxSteps && remainingRoute.length > 0; step += 1) {
    const nextHexId = remainingRoute[0];
    const hasEnemyDivision = Object.values(params.worldBase.divisionsById).some(
      (other) =>
        (other.kind ?? "land") === "land" &&
        other.id !== params.division.id &&
        other.hexId === nextHexId &&
        other.countryId !== params.division.countryId,
    );
    const targetOwnerId = params.worldBase.hexOwner[nextHexId] ?? null;
    if (hasEnemyDivision || (targetOwnerId && targetOwnerId !== params.division.countryId)) {
      resolveDivisionBattle({
        attacker: params.division,
        targetHexId: nextHexId,
        worldBase: params.worldBase,
        hexes: params.hexes,
        events: params.events,
        landDivisionStackLimitPerHex: params.landDivisionStackLimitPerHex,
      });
      remainingRoute = [];
      moved = true;
      break;
    }

    if (
      !canLandDivisionEnterHex({
        worldBase: params.worldBase,
        division: params.division,
        hexId: nextHexId,
        landDivisionStackLimitPerHex: params.landDivisionStackLimitPerHex,
      })
    ) {
      params.division.path = remainingRoute;
      params.division.status = "idle";
      params.worldBase.divisionsById[params.division.id] = params.division;
      params.events.push({
        category: "military",
        title: "Марш остановлен",
        message: `${params.division.name} ожидает свободное место в hex ${nextHexId}`,
        countryId: params.division.countryId,
        priority: "low",
        visibility: "private",
      });
      break;
    }

    params.division.hexId = nextHexId;
    captureCivilianUnitsOnHex({
      division: params.division,
      worldBase: params.worldBase,
      events: params.events,
    });
    remainingRoute = remainingRoute.slice(1);
    moved = true;
  }

  if (!moved) {
    return false;
  }

  params.division.path = remainingRoute;
  if (params.division.targetHexId === params.division.hexId || remainingRoute.length === 0) {
    params.division.targetHexId = null;
  }
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
        ? `${params.division.name} прибыла в hex ${params.division.hexId}; осталось ${remainingRoute.length} шагов`
        : `${params.division.name} завершила приказ движения в hex ${params.division.hexId}`,
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
  hexes: MilitaryHexNode[];
  turnId: number;
  movedDivisionIds: Set<string>;
  events: MilitaryRuntimeEvent[];
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  getNeighborHexIds?: (hexId: HexId) => HexId[];
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
  landDivisionStackLimitPerHex?: number;
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
  const route = resolveDivisionRouteToTarget({
    worldBase: params.worldBase,
    division,
    targetHexId: params.order.targetHexId,
    fallbackPayload: params.order.payload,
    areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame,
    getNeighborHexIds: params.getNeighborHexIds,
    getHexMovementCost: params.getHexMovementCost,
    landDivisionStackLimitPerHex: params.landDivisionStackLimitPerHex,
  });
  if (route.length === 0) {
    return reject("DIVISION_TARGET_INVALID");
  }
  if (
    !isContiguousArmyRoute({
      fromHexId: division.hexId,
      route,
      areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame,
    })
  ) {
    return reject("DIVISION_TARGET_NOT_ADJACENT");
  }
  const firstHexId = route[0];
  const firstHexOwnerId = firstHexId ? params.worldBase.hexOwner[firstHexId] ?? null : null;
  const firstHexHasEnemyDivision = firstHexId
    ? Object.values(params.worldBase.divisionsById).some(
        (other) =>
          (other.kind ?? "land") === "land" &&
          other.id !== division.id &&
          other.hexId === firstHexId &&
          other.countryId !== division.countryId,
      )
    : false;
  if (
    firstHexId &&
    !firstHexHasEnemyDivision &&
    !(firstHexOwnerId && firstHexOwnerId !== division.countryId) &&
    !canLandDivisionEnterHex({
      worldBase: params.worldBase,
      division,
      hexId: firstHexId,
      landDivisionStackLimitPerHex: params.landDivisionStackLimitPerHex,
    })
  ) {
    return reject("DIVISION_STACK_LIMIT_REACHED");
  }

  division.path = route;
  division.targetHexId = route.at(-1) ?? params.order.targetHexId;
  const moved = advanceDivisionAlongRoute({
    division,
    route,
    worldBase: params.worldBase,
    hexes: params.hexes,
    turnId: params.turnId,
    events: params.events,
    landDivisionStackLimitPerHex: params.landDivisionStackLimitPerHex,
  });
  if (moved) {
    params.movedDivisionIds.add(division.id);
  }
  return { rejectedOrder: null, moved };
}

export function resolveUnitAttackOrder(params: {
  order: Order;
  playerId: string;
  worldBase: MilitaryWorldState;
  hexes: MilitaryHexNode[];
  turnId: number;
  movedDivisionIds: Set<string>;
  events: MilitaryRuntimeEvent[];
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  landDivisionStackLimitPerHex?: number;
}): UnitAttackOrderResolution {
  const reject = (reason: string): UnitAttackOrderResolution => ({
    rejectedOrder: { playerId: params.playerId, reason, tempOrderId: params.order.id },
    attacked: false,
  });
  if (params.order.type !== "UNIT_ATTACK") return reject("INVALID_ORDER_TYPE");
  const attacker = params.worldBase.divisionsById[params.order.attackerUnitId];
  if (!attacker || attacker.countryId !== params.order.countryId || (attacker.kind ?? "land") !== "land") {
    return reject("UNIT_ATTACK_ATTACKER_NOT_FOUND");
  }
  if (params.movedDivisionIds.has(attacker.id) || attacker.lastMovedTurnId === params.turnId) {
    return reject("UNIT_ATTACK_ALREADY_ACTED");
  }
  if (params.order.targetHexId === attacker.hexId || !params.areHexIdsAdjacentOrSame(attacker.hexId, params.order.targetHexId)) {
    return reject("UNIT_ATTACK_TARGET_INVALID");
  }
  if (params.order.targetUnitId) {
    const targetUnit = params.worldBase.divisionsById[params.order.targetUnitId];
    if (!targetUnit || targetUnit.countryId === attacker.countryId || targetUnit.hexId !== params.order.targetHexId) {
      return reject("UNIT_ATTACK_TARGET_INVALID");
    }
  }
  if (!hasAttackableDivisionTarget({ worldBase: params.worldBase, attacker, targetHexId: params.order.targetHexId })) {
    return reject("UNIT_ATTACK_TARGET_INVALID");
  }

  attacker.path = [];
  attacker.targetHexId = null;
  const attacked = resolveDivisionBattle({
    attacker,
    targetHexId: params.order.targetHexId,
    worldBase: params.worldBase,
    hexes: params.hexes,
    events: params.events,
    landDivisionStackLimitPerHex: params.landDivisionStackLimitPerHex,
  });
  attacker.lastMovedTurnId = params.turnId;
  params.worldBase.divisionsById[attacker.id] = attacker;
  params.movedDivisionIds.add(attacker.id);
  return { rejectedOrder: null, attacked };
}

export function advanceStoredArmyRoutesTurn(params: {
  worldBase: MilitaryWorldState;
  hexes: MilitaryHexNode[];
  turnId: number;
  movedDivisionIds: Set<string>;
  events: MilitaryRuntimeEvent[];
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  getNeighborHexIds?: (hexId: HexId) => HexId[];
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
  landDivisionStackLimitPerHex?: number;
}): void {
  for (const division of Object.values(params.worldBase.divisionsById)) {
    if ((division.kind ?? "land") !== "land") continue;
    if (params.movedDivisionIds.has(division.id) || division.lastMovedTurnId === params.turnId) continue;
    const targetHexId = division.targetHexId ?? division.path.at(-1) ?? null;
    if (!targetHexId || targetHexId === division.hexId) {
      division.path = [];
      division.targetHexId = null;
      division.status = "idle";
      params.worldBase.divisionsById[division.id] = division;
      continue;
    }
    const route = resolveDivisionRouteToTarget({
      worldBase: params.worldBase,
      division,
      targetHexId,
      fallbackPayload: { path: division.path },
      areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame,
      getNeighborHexIds: params.getNeighborHexIds,
      getHexMovementCost: params.getHexMovementCost,
      landDivisionStackLimitPerHex: params.landDivisionStackLimitPerHex,
    });
    if (route.length === 0) {
      division.path = [];
      division.targetHexId = null;
      division.status = "idle";
      params.worldBase.divisionsById[division.id] = division;
      continue;
    }
    if (
      !isContiguousArmyRoute({
        fromHexId: division.hexId,
        route,
        areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame,
      })
    ) {
      division.path = [];
      division.targetHexId = null;
      division.status = "idle";
      params.worldBase.divisionsById[division.id] = division;
      continue;
    }
    division.path = route;
    if (
      advanceDivisionAlongRoute({
        division,
        route,
        worldBase: params.worldBase,
        hexes: params.hexes,
        turnId: params.turnId,
        events: params.events,
        landDivisionStackLimitPerHex: params.landDivisionStackLimitPerHex,
      })
    ) {
      params.movedDivisionIds.add(division.id);
    }
  }
}

export function captureCivilianUnitsOnHex(params: {
  division: Division;
  worldBase: MilitaryWorldState;
  events: MilitaryRuntimeEvent[];
}): string[] {
  if ((params.division.kind ?? "land") !== "land") return [];
  const capturedUnitIds: string[] = [];
  for (const unit of Object.values(params.worldBase.civilianUnitsById)) {
    if (unit.status === "captured") continue;
    if (unit.hexId !== params.division.hexId) continue;
    if (unit.countryId === params.division.countryId) continue;
    unit.status = "captured";
    unit.capturedByCountryId = params.division.countryId;
    unit.path = [];
    unit.targetHexId = null;
    params.worldBase.civilianUnitsById[unit.id] = unit;
    capturedUnitIds.push(unit.id);
    params.events.push({
      category: "military",
      title: "Гражданский юнит захвачен",
      message: `${params.division.name} захватила ${unit.id} в hex ${unit.hexId}`,
      countryId: params.division.countryId,
      priority: "medium",
      visibility: "private",
    });
  }
  return capturedUnitIds;
}

function hasAttackableDivisionTarget(params: {
  worldBase: MilitaryWorldState;
  attacker: Division;
  targetHexId: HexId;
}): boolean {
  const hasEnemyDivision = Object.values(params.worldBase.divisionsById).some(
    (division) =>
      (division.kind ?? "land") === "land" &&
      division.hexId === params.targetHexId &&
      division.countryId !== params.attacker.countryId &&
      division.strength > 0,
  );
  const targetOwnerId = params.worldBase.hexOwner[params.targetHexId] ?? null;
  return hasEnemyDivision || Boolean(targetOwnerId && targetOwnerId !== params.attacker.countryId);
}

function resolveDivisionRouteToTarget(params: {
  worldBase: MilitaryWorldState;
  division: Division;
  targetHexId: HexId;
  fallbackPayload?: Record<string, unknown>;
  areHexIdsAdjacentOrSame: (fromHexId: HexId, toHexId: HexId) => boolean;
  getNeighborHexIds?: (hexId: HexId) => HexId[];
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
  landDivisionStackLimitPerHex?: number;
}): HexId[] {
  if (params.targetHexId === params.division.hexId) return [];
  if (params.getNeighborHexIds) {
    return findDivisionRouteToTarget({
      worldBase: params.worldBase,
      division: params.division,
      targetHexId: params.targetHexId,
      getNeighborHexIds: params.getNeighborHexIds,
      getHexMovementCost: params.getHexMovementCost,
      landDivisionStackLimitPerHex: params.landDivisionStackLimitPerHex,
    });
  }
  const route = normalizeArmyMoveRoute(params.fallbackPayload, params.targetHexId, params.division.hexId);
  return isContiguousArmyRoute({ fromHexId: params.division.hexId, route, areHexIdsAdjacentOrSame: params.areHexIdsAdjacentOrSame })
    ? route
    : [];
}

export function findDivisionRouteToTarget(params: {
  worldBase: MilitaryWorldState;
  division: Division;
  targetHexId: HexId;
  getNeighborHexIds: (hexId: HexId) => HexId[];
  getHexMovementCost?: (hexId: HexId, countryId?: string) => number;
  landDivisionStackLimitPerHex?: number;
  limit?: number;
}): HexId[] {
  if (params.division.hexId === params.targetHexId) return [];
  const frontier: Array<{ id: HexId; cost: number }> = [{ id: params.division.hexId, cost: 0 }];
  const cameFrom = new Map<HexId, HexId | null>([[params.division.hexId, null]]);
  const costSoFar = new Map<HexId, number>([[params.division.hexId, 0]]);
  const limit = Math.max(1, params.limit ?? 1600);
  let visited = 0;

  while (frontier.length > 0 && visited < limit) {
    visited += 1;
    frontier.sort((left, right) => left.cost - right.cost || left.id.localeCompare(right.id));
    const current = frontier.shift();
    if (!current) break;
    if (current.id === params.targetHexId) break;
    for (const neighborId of params.getNeighborHexIds(current.id)) {
      const targetOwnerId = params.worldBase.hexOwner[neighborId] ?? null;
      const hasEnemyDivision = Object.values(params.worldBase.divisionsById).some(
        (division) =>
          (division.kind ?? "land") === "land" &&
          division.id !== params.division.id &&
          division.hexId === neighborId &&
          division.countryId !== params.division.countryId,
      );
      const isHostileTarget = hasEnemyDivision || Boolean(targetOwnerId && targetOwnerId !== params.division.countryId);
      if (
        !isHostileTarget &&
        !canLandDivisionEnterHex({
          worldBase: params.worldBase,
          division: params.division,
          hexId: neighborId,
          landDivisionStackLimitPerHex: params.landDivisionStackLimitPerHex,
        })
      ) {
        continue;
      }
      const movementCost = Math.max(0.001, Number(params.getHexMovementCost?.(neighborId, params.division.countryId) ?? 1) || 1);
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
  while (cursor && cursor !== params.division.hexId) {
    route.push(cursor);
    cursor = cameFrom.get(cursor) ?? null;
  }
  return route.reverse().slice(0, 64);
}

export function advanceMilitaryFormationQueue(params: {
  worldBase: MilitaryWorldState;
  turnId: number;
  createId: MilitaryIdFactory;
  events: MilitaryRuntimeEvent[];
  landDivisionStackLimitPerHex?: number;
}): void {
  const touchedCountryIds = new Set<string>();
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
          stalledReasonCode: null,
          progress: round3(Math.max(0, Math.min(1, (turnsTotal - turnsRemaining) / turnsTotal))),
        });
        continue;
      }
      const template = (params.worldBase.divisionTemplatesByCountry[countryId] ?? []).find((entry) => entry.id === item.templateId);
      if (!template) {
        continue;
      }
      if (
        (item.kind ?? template.kind ?? "land") === "land" &&
        countLandDivisionsOnHex({
          worldBase: params.worldBase,
          hexId: item.hexId,
          countryId,
        }) >= normalizeLandDivisionStackLimit(params.landDivisionStackLimitPerHex)
      ) {
        remaining.push({
          ...item,
          turnsTotal,
          turnsRemaining: 0,
          progress: 1,
          stalledReasonCode: "DIVISION_STACK_LIMIT_REACHED",
        });
        params.events.push({
          category: "military",
          title: "Формирование ожидает места",
          message: `${item.name || template.name} не может появиться в hex ${item.hexId}: лимит дивизий на гексе достигнут`,
          countryId,
          priority: "low",
          visibility: "private",
        });
        continue;
      }
      const kind = item.kind ?? template.kind ?? "land";
      const unitId = params.createId();
      const unitName = item.name || template.name;
      if (kind === "naval") {
        const fleet: Fleet = {
          id: unitId,
          countryId,
          templateId: template.id,
          name: unitName,
          hexId: item.hexId,
          strength: 1,
          organization: template.stats.organization,
          stats: template.stats,
          status: "idle",
          path: [],
          targetHexId: null,
          createdTurnId: params.turnId,
          lastMovedTurnId: null,
        };
        params.worldBase.fleetsById[fleet.id] = fleet;
      } else if (kind === "air") {
        const airWing: AirWing = {
          id: unitId,
          countryId,
          templateId: template.id,
          name: unitName,
          baseHexId: item.hexId,
          strength: 1,
          organization: template.stats.organization,
          stats: template.stats,
          status: "idle",
          mission: "none",
          targetRegionId: null,
          createdTurnId: params.turnId,
        };
        params.worldBase.airWingsById[airWing.id] = airWing;
      } else {
        const unit: Division = {
          id: unitId,
          countryId,
          templateId: template.id,
          name: unitName,
          kind: "land",
          hexId: item.hexId,
          strength: 1,
          organization: template.stats.organization,
          stats: template.stats,
          status: "idle",
          path: [],
          createdTurnId: params.turnId,
          lastMovedTurnId: null,
        };
        params.worldBase.divisionsById[unit.id] = unit;
        touchedCountryIds.add(countryId);
      }
      params.events.push({
        category: "military",
        title: "Формирование завершено",
        message: `${unitName} готова и базируется в hex ${item.hexId}`,
        countryId,
        priority: "medium",
        visibility: "private",
      });
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const remainingQuantity = Math.max(1, Math.floor(Number(item.remainingQuantity ?? quantity) || quantity));
      if (remainingQuantity > 1 || item.repeat) {
        remaining.push({
          ...item,
          quantity,
          remainingQuantity: remainingQuantity > 1 ? remainingQuantity - 1 : quantity,
          turnsTotal,
          turnsRemaining: turnsTotal,
          progress: 0,
          stalledReasonCode: null,
        });
      }
    }
    if (remaining.length > 0) {
      params.worldBase.militaryFormationQueueByCountry[countryId] = remaining;
    } else {
      delete params.worldBase.militaryFormationQueueByCountry[countryId];
    }
  }
  for (const countryId of touchedCountryIds) {
    refreshCountryDivisionEquipmentState({ countryId, worldBase: params.worldBase });
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
  countryId?: string;
  warehouseByResourceId: Record<string, number>;
  cost: { ducats: number; equipmentNeeds: MilitaryEquipmentNeed[] };
  addExpense?: (input: MilitaryLedgerFlowInput) => void;
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
  if (params.countryResource && params.cost.ducats > 0 && params.addExpense && params.countryId) {
    params.addExpense({
      countryId: params.countryId,
      resourceId: "ducats",
      amount: params.cost.ducats,
      sourceType: "army",
      sourceId: `army:formation:${params.countryId}`,
      categoryId: "military",
      labelKey: "resourceLedger.source.army.formation",
    });
  } else if (params.countryResource && params.cost.ducats > 0) {
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
    stats.armor = Number(stats.armor ?? 0) + Number(base.armor ?? 0) * count;
    stats.piercing = Number(stats.piercing ?? 0) + Number(base.piercing ?? 0) * count;
    stats.organization += base.organization * count;
    stats.hp += base.hp * count;
    stats.speed = Math.min(stats.speed, base.speed);
    stats.range = Number(stats.range ?? 0) + Number(base.range ?? 0) * count;
    stats.reliability = Number(stats.reliability ?? 0) + Number(base.reliability ?? 0) * count;
    stats.supplyUse += base.supplyUse * count;
    stats.fuelUse = Number(stats.fuelUse ?? 0) + Number(base.fuelUse ?? 0) * count;
  }
  const divisor = Math.max(1, totalComponents);
  return {
    manpower: Math.round(stats.manpower),
    attack: round3(stats.attack),
    defense: round3(stats.defense),
    breakthrough: round3(stats.breakthrough),
    armor: round3(Number(stats.armor ?? 0)),
    piercing: round3(Number(stats.piercing ?? 0)),
    organization: round3(Math.max(1, stats.organization / divisor)),
    hp: round3(stats.hp),
    speed: round3(Number.isFinite(stats.speed) ? stats.speed : 1),
    range: round3(Number(stats.range ?? 0)),
    reliability: round3(Number(stats.reliability ?? 0)),
    supplyUse: round3(stats.supplyUse),
    fuelUse: round3(Number(stats.fuelUse ?? 0)),
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
