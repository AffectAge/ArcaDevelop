import type {
  DivisionStats,
  EquipmentClass,
  EquipmentClassRole,
  EquipmentFrame,
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
  availableCount?: number;
  assignedCount: number;
  coverage: number;
  variants?: Array<{
    equipmentVariantId: string;
    amount: number;
    score: number;
    stats: EquipmentStats;
    manpowerCrew: number;
  }>;
};

export function deriveEquipmentVariant(params: {
  id: string;
  countryId?: string | null;
  equipmentClass: EquipmentClass;
  equipmentFrame?: EquipmentFrame | null;
  modulesById: Record<string, EquipmentModule>;
  moduleIdsBySlotId: Record<string, string>;
  name: string;
  createdTurnId: number;
  scenarioAuthored?: boolean;
}): EquipmentVariant {
  const equipmentFrame = params.equipmentFrame ?? {
    id: `${params.equipmentClass.id}:legacy_frame`,
    classId: params.equipmentClass.id,
    branch: params.equipmentClass.branch,
    slotIds: params.equipmentClass.slotIds,
    baseStats: {},
    goodsCost: [],
    manpowerCrew: 0,
    productionCost: 0,
  };
  const stats: EquipmentStats = {};
  const goodsCostById = new Map<string, number>();
  addEquipmentStats(stats, params.equipmentClass.baseStats);
  addEquipmentStats(stats, equipmentFrame.baseStats);
  addGoodsCost(goodsCostById, equipmentFrame.goodsCost ?? []);
  let manpowerCrew = Math.max(0, Number(equipmentFrame.manpowerCrew ?? 0) || 0);
  let productionCost = Math.max(0, Number(equipmentFrame.productionCost ?? 0) || 0);
  for (const slotId of equipmentFrame.slotIds) {
    const moduleId = params.moduleIdsBySlotId[slotId];
    const module = moduleId ? params.modulesById[moduleId] : null;
    if (!module || module.slotId !== slotId) continue;
    if (module.classId && module.classId !== params.equipmentClass.id) continue;
    addEquipmentStats(stats, module.stats);
    addGoodsCost(goodsCostById, module.goodsCost);
    manpowerCrew = round3(manpowerCrew + Math.max(0, Number(module.manpowerCrew ?? 0) || 0));
    productionCost = round3(productionCost + Math.max(0, Number(module.productionCost ?? 0) || 0));
  }
  return {
    id: params.id,
    countryId: params.countryId ?? null,
    classId: params.equipmentClass.id,
    frameId: equipmentFrame.id,
    name: params.name.trim().slice(0, 120) || params.id,
    moduleIdsBySlotId: { ...params.moduleIdsBySlotId },
    stats,
    goodsCost: [...goodsCostById.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([goodId, amount]) => ({ goodId, amount })),
    manpowerCrew: round3(manpowerCrew),
    productionCost: round3(productionCost),
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
        nextLines.push({ ...line, lastStatus: "idle", lastProduced: 0, lastMissingGoods: [] });
        continue;
      }
      const variant = params.worldBase.equipmentVariantsById[line.equipmentVariantId];
      if (!variant || !warehouse) {
        stalledLineIds.push(line.id);
        nextLines.push({
          ...line,
          lastStatus: variant ? "stalled" : "invalid",
          lastProduced: 0,
          lastMissingGoods: variant ? getMissingGoodsForVariant({}, variant) : [],
        });
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
      const missingGoods = progress >= unitWork ? getMissingGoodsForVariant(warehouse, variant) : [];
      nextLines.push({
        ...line,
        progress,
        lastStatus: produced > 0 ? "active" : missingGoods.length > 0 ? "stalled" : "active",
        lastProduced: produced,
        lastMissingGoods: missingGoods,
      });
    }
    params.worldBase.equipmentProductionLinesByCountry[countryId] = nextLines;
  }
  return { producedByCountry, stalledLineIds };
}

export function getEquipmentUnitWork(variant: EquipmentVariant): number {
  const authoredWork = Math.max(0, Number(variant.productionCost ?? 0) || 0);
  if (authoredWork > 0) return round3(authoredWork);
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
  const requiredCount = Math.max(0, Number(params.requirement.count) || 0);
  const ranked = rankEquipmentVariantsForRequirement({
    requirement: params.requirement,
    variants: params.variants,
    stockpileByVariantId: params.stockpileByVariantId,
  });
  const best = ranked[0] ?? null;
  const assignedCount = Math.min(requiredCount, best?.available ?? 0);
  return {
    requirementId: params.requirement.id,
    equipmentVariantId: best?.variant.id ?? null,
    score: best ? round3(best.score) : 0,
    requiredCount,
    availableCount: best?.available ?? 0,
    assignedCount,
    coverage: requiredCount > 0 ? round3(assignedCount / requiredCount) : 1,
    variants: best && assignedCount > 0
      ? [{
          equipmentVariantId: best.variant.id,
          amount: assignedCount,
          score: round3(best.score),
          stats: best.variant.stats,
          manpowerCrew: Math.max(0, Number(best.variant.manpowerCrew ?? 0) || 0),
        }]
      : [],
  };
}

export function assignEquipmentVariantsForRequirements(params: {
  requirements: MilitaryEquipmentRequirement[];
  variants: Iterable<EquipmentVariant>;
  stockpileByVariantId: Record<string, number>;
}): EquipmentAssignmentChoice[] {
  const remainingStockpile: Record<string, number> = {};
  for (const [variantId, amount] of Object.entries(params.stockpileByVariantId)) {
    remainingStockpile[variantId] = Math.max(0, Number(amount) || 0);
  }
  const variants = [...params.variants];
  return params.requirements.map((requirement) => {
    const requiredCount = Math.max(0, Number(requirement.count) || 0);
    let remainingRequired = requiredCount;
    let assignedCount = 0;
    let scoreTotal = 0;
    let availableCount = 0;
    const assignedVariants: NonNullable<EquipmentAssignmentChoice["variants"]> = [];
    const ranked = rankEquipmentVariantsForRequirement({
      requirement,
      variants,
      stockpileByVariantId: remainingStockpile,
    });
    for (const option of ranked) {
      availableCount = round3(availableCount + option.available);
      if (remainingRequired <= 0) continue;
      const amount = Math.min(remainingRequired, option.available);
      if (amount <= 0) continue;
      remainingRequired = round3(remainingRequired - amount);
      assignedCount = round3(assignedCount + amount);
      scoreTotal = round3(scoreTotal + option.score * amount);
      remainingStockpile[option.variant.id] = round3(Math.max(0, Number(remainingStockpile[option.variant.id] ?? 0) - amount));
      assignedVariants.push({
        equipmentVariantId: option.variant.id,
        amount,
        score: round3(option.score),
        stats: option.variant.stats,
        manpowerCrew: Math.max(0, Number(option.variant.manpowerCrew ?? 0) || 0),
      });
    }
    const lead = assignedVariants[0] ?? null;
    return {
      requirementId: requirement.id,
      equipmentVariantId: lead?.equipmentVariantId ?? null,
      score: assignedCount > 0 ? round3(scoreTotal / assignedCount) : 0,
      requiredCount,
      availableCount,
      assignedCount,
      coverage: requiredCount > 0 ? round3(Math.min(1, assignedCount / requiredCount)) : 1,
      variants: assignedVariants,
    };
  });
}

export function calculateEquipmentCoverage(choices: EquipmentAssignmentChoice[]): number {
  const requiredTotal = choices.reduce((sum, choice) => sum + Math.max(0, choice.requiredCount), 0);
  if (requiredTotal <= 0) return 1;
  const assignedTotal = choices.reduce((sum, choice) => sum + Math.max(0, choice.assignedCount), 0);
  return round3(Math.min(1, assignedTotal / requiredTotal));
}

export function applyEquipmentLossesForRequirements(params: {
  requirements: MilitaryEquipmentRequirement[];
  variants: Iterable<EquipmentVariant>;
  stockpileByVariantId: Record<string, number>;
  lossRatio: number;
}): Record<string, number> {
  const normalizedLossRatio = Math.max(0, Math.min(1, Number(params.lossRatio) || 0));
  if (normalizedLossRatio <= 0 || params.requirements.length === 0) return {};
  const lossesByVariantId: Record<string, number> = {};
  const choices = assignEquipmentVariantsForRequirements({
    requirements: params.requirements,
    variants: params.variants,
    stockpileByVariantId: params.stockpileByVariantId,
  });
  for (const choice of choices) {
    const choiceVariants = choice.variants?.length
      ? choice.variants
      : choice.equipmentVariantId
        ? [{ equipmentVariantId: choice.equipmentVariantId, amount: choice.assignedCount }]
        : [];
    for (const assigned of choiceVariants) {
      if (!assigned.equipmentVariantId || assigned.amount <= 0) continue;
      const currentStockpile = Math.max(0, Number(params.stockpileByVariantId[assigned.equipmentVariantId] ?? 0) || 0);
      const loss = Math.min(currentStockpile, round3(assigned.amount * normalizedLossRatio));
      if (loss <= 0) continue;
      params.stockpileByVariantId[assigned.equipmentVariantId] = round3(currentStockpile - loss);
      lossesByVariantId[assigned.equipmentVariantId] = round3(Number(lossesByVariantId[assigned.equipmentVariantId] ?? 0) + loss);
    }
  }
  return lossesByVariantId;
}

export function applyEquipmentCoverageToDivisionStats(
  stats: DivisionStats,
  coverage: number,
  assignments: EquipmentAssignmentChoice[] = [],
): DivisionStats {
  const normalizedCoverage = Math.max(0, Math.min(1, Number(coverage) || 0));
  const combatMultiplier = round3(0.15 + normalizedCoverage * 0.85);
  const mobilityMultiplier = round3(0.35 + normalizedCoverage * 0.65);
  const organizationMultiplier = round3(0.5 + normalizedCoverage * 0.5);
  const equipmentStats = aggregateAssignedEquipmentStats(assignments);
  const speedLimit = equipmentStats.speedLimit;
  const baseSpeed = Number(stats.speed ?? 1) || 1;
  const constrainedSpeed = Number.isFinite(speedLimit) ? Math.min(baseSpeed, speedLimit) : baseSpeed;
  return {
    manpower: stats.manpower,
    attack: round3(stats.attack * combatMultiplier + Number(equipmentStats.attack ?? 0)),
    defense: round3(stats.defense * combatMultiplier + Number(equipmentStats.defense ?? 0)),
    breakthrough: round3(stats.breakthrough * combatMultiplier + Number(equipmentStats.breakthrough ?? 0)),
    armor: round3(Number(stats.armor ?? 0) * combatMultiplier + Number(equipmentStats.armor ?? 0)),
    piercing: round3(Number(stats.piercing ?? 0) * combatMultiplier + Number(equipmentStats.piercing ?? 0)),
    organization: round3(Math.max(1, stats.organization * organizationMultiplier)),
    hp: round3(Math.max(1, stats.hp * combatMultiplier)),
    speed: round3(Math.max(1, constrainedSpeed * mobilityMultiplier)),
    range: round3(Number(stats.range ?? 0) + Number(equipmentStats.range ?? 0)),
    reliability: round3(Number(stats.reliability ?? 0) + Number(equipmentStats.reliability ?? 0)),
    supplyUse: round3(stats.supplyUse + Number(equipmentStats.supplyUse ?? 0)),
    fuelUse: round3(Number(stats.fuelUse ?? 0) + Number(equipmentStats.fuelUse ?? 0)),
  };
}

export function calculateEquipmentCrewManpower(assignments: EquipmentAssignmentChoice[]): number {
  let manpower = 0;
  for (const assignment of assignments) {
    for (const variant of assignment.variants ?? []) {
      manpower += Math.max(0, Number(variant.manpowerCrew ?? 0) || 0) * Math.max(0, Number(variant.amount) || 0);
    }
  }
  return Math.round(manpower);
}

function addEquipmentStats(target: EquipmentStats, source: EquipmentStats | undefined): void {
  for (const [key, value] of Object.entries(source ?? {}) as Array<[keyof EquipmentStats, number | undefined]>) {
    target[key] = round3(Number(target[key] ?? 0) + Number(value ?? 0));
  }
}

function addGoodsCost(target: Map<string, number>, costs: Array<{ goodId: string; amount: number }>): void {
  for (const cost of costs) {
    if (!cost.goodId || cost.amount <= 0) continue;
    target.set(cost.goodId, round3(Number(target.get(cost.goodId) ?? 0) + cost.amount));
  }
}

function rankEquipmentVariantsForRequirement(params: {
  requirement: MilitaryEquipmentRequirement;
  variants: Iterable<EquipmentVariant>;
  stockpileByVariantId: Record<string, number>;
}): Array<{ variant: EquipmentVariant; score: number; available: number }> {
  return [...params.variants]
    .map((variant) => ({
      variant,
      score: scoreEquipmentVariantForRequirement({ requirement: params.requirement, variant }),
      available: Math.max(0, Number(params.stockpileByVariantId[variant.id] ?? 0) || 0),
    }))
    .filter((entry) => entry.available > 0 && Number.isFinite(entry.score))
    .sort((left, right) => right.score - left.score || right.variant.createdTurnId - left.variant.createdTurnId || left.variant.id.localeCompare(right.variant.id));
}

function aggregateAssignedEquipmentStats(assignments: EquipmentAssignmentChoice[]): EquipmentStats & { speedLimit: number } {
  const totals: EquipmentStats & { speedLimit: number } = {
    attack: 0,
    defense: 0,
    breakthrough: 0,
    armor: 0,
    piercing: 0,
    range: 0,
    reliability: 0,
    supplyUse: 0,
    fuelUse: 0,
    speedLimit: Number.POSITIVE_INFINITY,
  };
  for (const assignment of assignments) {
    const requiredCount = Math.max(0, Number(assignment.requiredCount) || 0);
    if (requiredCount <= 0) continue;
    for (const assigned of assignment.variants ?? []) {
      const amount = Math.max(0, Number(assigned.amount) || 0);
      if (amount <= 0) continue;
      const weight = amount / requiredCount;
      totals.attack = round3(Number(totals.attack ?? 0) + Number(assigned.stats.attack ?? 0) * weight);
      totals.defense = round3(Number(totals.defense ?? 0) + Number(assigned.stats.defense ?? 0) * weight);
      totals.breakthrough = round3(Number(totals.breakthrough ?? 0) + Number(assigned.stats.breakthrough ?? 0) * weight);
      totals.armor = round3(Number(totals.armor ?? 0) + Number(assigned.stats.armor ?? 0) * weight);
      totals.piercing = round3(Number(totals.piercing ?? 0) + Number(assigned.stats.piercing ?? 0) * weight);
      totals.range = round3(Number(totals.range ?? 0) + Number(assigned.stats.range ?? 0) * weight);
      totals.reliability = round3(Number(totals.reliability ?? 0) + Number(assigned.stats.reliability ?? 0) * weight);
      totals.supplyUse = round3(Number(totals.supplyUse ?? 0) + Number(assigned.stats.supplyUse ?? 0) * weight);
      totals.fuelUse = round3(Number(totals.fuelUse ?? 0) + Number(assigned.stats.fuelUse ?? 0) * weight);
      const speed = Number(assigned.stats.speed ?? 0);
      if (speed > 0) totals.speedLimit = Math.min(totals.speedLimit, speed);
    }
  }
  return totals;
}

function hasGoodsForVariant(warehouse: Record<string, number>, variant: EquipmentVariant): boolean {
  return variant.goodsCost.every((cost) => Number(warehouse[cost.goodId] ?? 0) >= cost.amount);
}

function getMissingGoodsForVariant(
  warehouse: Record<string, number>,
  variant: EquipmentVariant,
): Array<{ goodId: string; required: number; available: number; missing: number }> {
  return variant.goodsCost
    .map((cost) => {
      const required = Math.max(0, Number(cost.amount) || 0);
      const available = Math.max(0, Number(warehouse[cost.goodId] ?? 0) || 0);
      return {
        goodId: cost.goodId,
        required: round3(required),
        available: round3(available),
        missing: round3(Math.max(0, required - available)),
      };
    })
    .filter((entry) => entry.missing > 0);
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
