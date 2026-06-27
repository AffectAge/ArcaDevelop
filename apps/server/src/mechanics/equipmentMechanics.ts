import type {
  EquipmentClass,
  EquipmentClassRole,
  EquipmentModule,
  EquipmentProductionLine,
  EquipmentStats,
  EquipmentVariant,
  MilitaryEquipmentRequirement,
  WorldBase,
} from "@arcanorum/shared";

export type EquipmentMarketState = {
  countryMarketByCountryId: Record<string, string>;
  marketById: Record<string, { warehouseByResourceId?: Record<string, number> } | undefined>;
};

export type EquipmentProductionResult = {
  producedByCountry: Record<string, Record<string, number>>;
  stalledLineIds: string[];
};

export type EquipmentAssignmentChoice = {
  requirementId: string;
  equipmentVariantId: string | null;
  score: number;
  requiredCount: number;
  availableCount: number;
  assignedCount: number;
  coverage: number;
};

export function deriveEquipmentVariant(params: {
  id: string;
  countryId?: string | null;
  equipmentClass: EquipmentClass;
  modulesById: Record<string, EquipmentModule>;
  moduleIdsBySlotId: Record<string, string>;
  name: string;
  createdTurnId: number;
  scenarioAuthored?: boolean;
}): EquipmentVariant {
  const stats: EquipmentStats = { ...(params.equipmentClass.baseStats ?? {}) };
  const goodsCostById = new Map<string, number>();
  for (const slotId of params.equipmentClass.slotIds) {
    const moduleId = params.moduleIdsBySlotId[slotId];
    const module = moduleId ? params.modulesById[moduleId] : null;
    if (!module || module.slotId !== slotId) continue;
    if (module.classId && module.classId !== params.equipmentClass.id) continue;
    for (const [key, value] of Object.entries(module.stats) as Array<[keyof EquipmentStats, number | undefined]>) {
      stats[key] = round3(Number(stats[key] ?? 0) + Number(value ?? 0));
    }
    for (const cost of module.goodsCost) {
      if (!cost.goodId || cost.amount <= 0) continue;
      goodsCostById.set(cost.goodId, round3(Number(goodsCostById.get(cost.goodId) ?? 0) + cost.amount));
    }
  }
  return {
    id: params.id,
    countryId: params.countryId ?? null,
    classId: params.equipmentClass.id,
    name: params.name.trim().slice(0, 120) || params.id,
    moduleIdsBySlotId: { ...params.moduleIdsBySlotId },
    stats,
    goodsCost: [...goodsCostById.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([goodId, amount]) => ({ goodId, amount })),
    createdTurnId: Math.max(1, Math.floor(params.createdTurnId)),
    scenarioAuthored: params.scenarioAuthored,
  };
}

export function resolveEquipmentProductionLinesTurn(params: {
  worldBase: Pick<
    WorldBase,
    "equipmentVariantsById" | "equipmentProductionLinesByCountry" | "equipmentStockpileByCountry"
  >;
  markets: EquipmentMarketState;
  productionPerCapacity?: number;
}): EquipmentProductionResult {
  const producedByCountry: Record<string, Record<string, number>> = {};
  const stalledLineIds: string[] = [];
  const productionPerCapacity = Math.max(0, Number(params.productionPerCapacity ?? 1) || 0);

  for (const [countryId, lines] of Object.entries(params.worldBase.equipmentProductionLinesByCountry)) {
    const marketId = params.markets.countryMarketByCountryId[countryId];
    const market = marketId ? params.markets.marketById[marketId] : null;
    const warehouse = market?.warehouseByResourceId;
    const nextLines: EquipmentProductionLine[] = [];
    for (const line of lines) {
      if (!line.active) {
        nextLines.push(line);
        continue;
      }
      const variant = params.worldBase.equipmentVariantsById[line.equipmentVariantId];
      if (!variant || !warehouse) {
        stalledLineIds.push(line.id);
        nextLines.push(line);
        continue;
      }
      const unitWork = getEquipmentUnitWork(variant);
      let progress = round3(Math.max(0, Number(line.progress) || 0) + Math.max(0, Number(line.assignedCapacity) || 0) * productionPerCapacity);
      let produced = 0;
      while (progress >= unitWork && hasGoodsForVariant(warehouse, variant)) {
        consumeVariantGoods(warehouse, variant);
        progress = round3(progress - unitWork);
        produced += 1;
      }
      if (produced > 0) {
        params.worldBase.equipmentStockpileByCountry[countryId] ??= {};
        params.worldBase.equipmentStockpileByCountry[countryId][variant.id] = round3(
          Number(params.worldBase.equipmentStockpileByCountry[countryId][variant.id] ?? 0) + produced,
        );
        producedByCountry[countryId] ??= {};
        producedByCountry[countryId][variant.id] = round3(Number(producedByCountry[countryId][variant.id] ?? 0) + produced);
      } else if (progress >= unitWork) {
        stalledLineIds.push(line.id);
      }
      nextLines.push({ ...line, progress });
    }
    params.worldBase.equipmentProductionLinesByCountry[countryId] = nextLines;
  }
  return { producedByCountry, stalledLineIds };
}

export function getEquipmentUnitWork(variant: EquipmentVariant): number {
  const goodsWork = variant.goodsCost.reduce((sum, cost) => sum + Math.max(0, Number(cost.amount) || 0), 0);
  return Math.max(1, round3(goodsWork));
}

export function scoreEquipmentVariantForRequirement(params: {
  requirement: Pick<MilitaryEquipmentRequirement, "equipmentClassId" | "role">;
  variant: EquipmentVariant;
}): number {
  if (params.variant.classId !== params.requirement.equipmentClassId) return Number.NEGATIVE_INFINITY;
  return round3(getRoleWeightedScore(params.requirement.role, params.variant.stats));
}

export function selectBestEquipmentVariantForRequirement(params: {
  requirement: MilitaryEquipmentRequirement;
  variants: Iterable<EquipmentVariant>;
  stockpileByVariantId: Record<string, number>;
}): EquipmentAssignmentChoice {
  let bestVariant: EquipmentVariant | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const variant of params.variants) {
    const available = Math.max(0, Number(params.stockpileByVariantId[variant.id] ?? 0) || 0);
    if (available <= 0) continue;
    const score = scoreEquipmentVariantForRequirement({ requirement: params.requirement, variant });
    if (score > bestScore || (score === bestScore && variant.createdTurnId > (bestVariant?.createdTurnId ?? 0))) {
      bestVariant = variant;
      bestScore = score;
    }
  }
  const requiredCount = Math.max(0, Number(params.requirement.count) || 0);
  const availableCount = bestVariant ? Math.max(0, Number(params.stockpileByVariantId[bestVariant.id] ?? 0) || 0) : 0;
  const assignedCount = Math.min(requiredCount, availableCount);
  return {
    requirementId: params.requirement.id,
    equipmentVariantId: bestVariant?.id ?? null,
    score: Number.isFinite(bestScore) ? round3(bestScore) : 0,
    requiredCount,
    availableCount,
    assignedCount,
    coverage: requiredCount > 0 ? round3(assignedCount / requiredCount) : 1,
  };
}

export function calculateEquipmentCoverage(choices: EquipmentAssignmentChoice[]): number {
  const requiredTotal = choices.reduce((sum, choice) => sum + Math.max(0, choice.requiredCount), 0);
  if (requiredTotal <= 0) return 1;
  const assignedTotal = choices.reduce((sum, choice) => sum + Math.max(0, choice.assignedCount), 0);
  return round3(Math.min(1, assignedTotal / requiredTotal));
}

function hasGoodsForVariant(warehouse: Record<string, number>, variant: EquipmentVariant): boolean {
  return variant.goodsCost.every((cost) => Number(warehouse[cost.goodId] ?? 0) >= cost.amount);
}

function consumeVariantGoods(warehouse: Record<string, number>, variant: EquipmentVariant): void {
  for (const cost of variant.goodsCost) {
    warehouse[cost.goodId] = round3(Math.max(0, Number(warehouse[cost.goodId] ?? 0) - cost.amount));
  }
}

function getRoleWeightedScore(role: EquipmentClassRole, stats: EquipmentStats): number {
  const attack = Number(stats.attack ?? 0);
  const defense = Number(stats.defense ?? 0);
  const breakthrough = Number(stats.breakthrough ?? 0);
  const armor = Number(stats.armor ?? 0);
  const piercing = Number(stats.piercing ?? 0);
  const speed = Number(stats.speed ?? 0);
  const range = Number(stats.range ?? 0);
  const reliability = Number(stats.reliability ?? 0);
  const supplyUse = Number(stats.supplyUse ?? 0);
  const fuelUse = Number(stats.fuelUse ?? 0);
  const logisticsPenalty = supplyUse * 0.18 + fuelUse * 0.12;
  const reliabilityBonus = reliability * 0.25;
  if (role === "attack") return attack * 1.25 + breakthrough * 0.45 + piercing * 0.35 + speed * 0.15 + reliabilityBonus - logisticsPenalty;
  if (role === "defense") return defense * 1.25 + armor * 0.45 + piercing * 0.2 + reliabilityBonus - logisticsPenalty;
  if (role === "breakthrough") return breakthrough * 1.25 + armor * 0.4 + attack * 0.25 + speed * 0.2 + reliabilityBonus - logisticsPenalty;
  if (role === "speed") return speed * 1.4 + breakthrough * 0.2 + reliabilityBonus - logisticsPenalty;
  if (role === "range") return range * 1.35 + attack * 0.25 + reliabilityBonus - logisticsPenalty;
  return attack * 0.45 + defense * 0.45 + reliabilityBonus - logisticsPenalty;
}

function round3(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 1000) / 1000;
}
