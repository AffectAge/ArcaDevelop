import type { Order, RegionPopulation, ResourceFlowSourceType, ResourceId, WorldBase } from "@arcanorum/shared";
import {
  dropTurnOrderIndexes,
  removeOrderFromTurnIndexes,
  type TurnOrderIndexes,
} from "./turnOrderIndexMechanics";

export const COLONIZATION_GOAL = 100;
export const DEFAULT_REGION_COLONIZATION_COST = 100;

export type ColonizationRates = {
  pointsCostPer1000Km2: number;
  ducatsCostPer1000Km2: number;
};

export type RegionColonizationConfig = {
  cost: number;
  disabled: boolean;
  manualCost: boolean;
};

export type RegionColonizationConfigInput = {
  cost: number;
  disabled: boolean;
  manualCost?: boolean;
};

export type RegionColonizationWorldState = Pick<
  WorldBase,
  "regionColonizationByRegion" | "colonyProgressByRegion" | "regionOwner" | "regionController" | "provinceOwner"
>;

export type ColonizationTurnWorldState = Pick<
  WorldBase,
  | "colonyProgressByRegion"
  | "regionOwner"
  | "regionController"
  | "provinceOwner"
  | "resourcesByCountry"
  | "regionPopulationByRegion"
>;

export type ColonizationLedgerFlowInput = {
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

export type ColonizationCaptureResult = {
  regionId: string;
  winnerCountryId: string;
  previousOwnerId: string | null;
  settlementCreated?: boolean;
};

export type ColonizationRejectedOrder = {
  playerId: string;
  reason: string;
  tempOrderId?: string;
};

export type ColonizeOrderResolution = {
  rejectedOrder: ColonizationRejectedOrder | null;
  accepted: boolean;
};

export type RegionAreaReader = (regionId: string) => number;

export function getProvinceAreaKm2(provinceId: string, areaByProvinceId: Map<string, number>): number {
  return Math.max(1, areaByProvinceId.get(provinceId) ?? 1_000);
}

export function getRegionDerivedColonizationCosts(params: {
  regionId: string;
  getRegionAreaKm2: RegionAreaReader;
  rates: ColonizationRates;
}): { pointsCost: number; ducatsCost: number } {
  const areaKm2 = params.getRegionAreaKm2(params.regionId);
  const areaFactor = Math.max(0.001, areaKm2 / 1000);
  return {
    pointsCost: Math.max(1, Math.round(params.rates.pointsCostPer1000Km2 * areaFactor)),
    ducatsCost: Math.max(0, Math.round(params.rates.ducatsCostPer1000Km2 * areaFactor)),
  };
}

export function getRegionColonizationConfig(params: {
  regionId: string;
  worldBase: Pick<WorldBase, "regionColonizationByRegion">;
  getRegionDerivedColonizationCosts: (regionId: string) => { pointsCost: number; ducatsCost: number };
}): RegionColonizationConfig {
  const existing = params.worldBase.regionColonizationByRegion[params.regionId];
  if (existing && typeof existing.cost === "number" && Number.isFinite(existing.cost)) {
    const looksLikeAutomaticDefault =
      !existing.disabled && Math.floor(existing.cost) === DEFAULT_REGION_COLONIZATION_COST;
    if (looksLikeAutomaticDefault) {
      const derived = params.getRegionDerivedColonizationCosts(params.regionId);
      return { cost: derived.pointsCost, disabled: false, manualCost: false };
    }
    return {
      cost: Math.max(1, Math.floor(existing.cost)),
      disabled: Boolean(existing.disabled),
      manualCost: Boolean((existing as { manualCost?: unknown }).manualCost),
    };
  }
  const derived = params.getRegionDerivedColonizationCosts(params.regionId);
  return { cost: derived.pointsCost, disabled: false, manualCost: false };
}

export function normalizeRegionColonizationCosts(params: {
  worldBase: Pick<WorldBase, "regionColonizationByRegion">;
  getRegionDerivedColonizationCosts: (regionId: string) => { pointsCost: number; ducatsCost: number };
}): number {
  let migrated = 0;
  for (const [regionId, cfg] of Object.entries(params.worldBase.regionColonizationByRegion ?? {})) {
    if (!cfg || typeof cfg !== "object") continue;
    const normalizedCost = Number(cfg.cost);
    const isAutomaticDefault =
      Number.isFinite(normalizedCost) &&
      Math.floor(normalizedCost) === DEFAULT_REGION_COLONIZATION_COST &&
      !cfg.disabled;
    if (!isAutomaticDefault) continue;
    const derived = params.getRegionDerivedColonizationCosts(regionId);
    params.worldBase.regionColonizationByRegion[regionId] = {
      cost: derived.pointsCost,
      disabled: false,
      manualCost: false,
    };
    migrated += 1;
  }
  return migrated;
}

export function recalculateAllRegionColonizationCosts(params: {
  regionIds: string[];
  worldBase: Pick<WorldBase, "regionColonizationByRegion">;
  getRegionDerivedColonizationCosts: (
    regionId: string,
    rates?: ColonizationRates,
  ) => { pointsCost: number; ducatsCost: number };
  previousRates?: ColonizationRates;
}): number {
  let updated = 0;
  for (const regionId of params.regionIds) {
    const current = params.worldBase.regionColonizationByRegion[regionId];
    const derived = params.getRegionDerivedColonizationCosts(regionId);
    const nextCost = derived.pointsCost;
    const nextDisabled = Boolean(current?.disabled);
    const nextManualCost = Boolean((current as { manualCost?: unknown } | undefined)?.manualCost);
    const prevCost =
      current && typeof current.cost === "number" && Number.isFinite(current.cost)
        ? Math.max(1, Math.floor(current.cost))
        : null;
    const previousDerivedCost = params.previousRates
      ? params.getRegionDerivedColonizationCosts(regionId, params.previousRates).pointsCost
      : null;
    const isAutomaticDefault =
      current != null &&
      prevCost != null &&
      prevCost === DEFAULT_REGION_COLONIZATION_COST &&
      !current.disabled;
    const shouldPreserveManualCost =
      current != null &&
      prevCost != null &&
      previousDerivedCost != null &&
      prevCost !== previousDerivedCost &&
      !isAutomaticDefault;
    if (shouldPreserveManualCost) {
      if (!current || Boolean(current.disabled) === nextDisabled) {
        continue;
      }
      params.worldBase.regionColonizationByRegion[regionId] = {
        cost: prevCost,
        disabled: nextDisabled,
        manualCost: nextManualCost,
      };
      continue;
    }
    if (prevCost === nextCost && Boolean(current?.disabled) === nextDisabled && nextManualCost === false) {
      continue;
    }
    params.worldBase.regionColonizationByRegion[regionId] = {
      cost: nextCost,
      disabled: nextDisabled,
      manualCost: false,
    };
    updated += 1;
  }
  return updated;
}

export function normalizeRegionColonizationMap(
  input: unknown,
): Record<string, RegionColonizationConfigInput> {
  const normalized: Record<string, RegionColonizationConfigInput> = {};
  if (!input || typeof input !== "object") {
    return normalized;
  }

  for (const [regionId, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const costRaw = (raw as { cost?: unknown }).cost;
    const disabledRaw = (raw as { disabled?: unknown }).disabled;
    const manualCostRaw = (raw as { manualCost?: unknown }).manualCost;
    normalized[regionId] = {
      cost:
        typeof costRaw === "number" && Number.isFinite(costRaw)
          ? Math.max(1, Math.floor(costRaw))
          : DEFAULT_REGION_COLONIZATION_COST,
      disabled: Boolean(disabledRaw),
      manualCost: typeof manualCostRaw === "boolean" ? manualCostRaw : undefined,
    };
  }

  return normalized;
}

export function rebuildActiveColonizationIndexFromWorldBase(params: {
  activeColonizeRegionsByCountry: Map<string, Set<string>>;
  worldBase: RegionColonizationWorldState;
  getRegionColonizationConfig: (regionId: string) => RegionColonizationConfig;
}): void {
  params.activeColonizeRegionsByCountry.clear();
  for (const [regionId, progressByCountry] of Object.entries(params.worldBase.colonyProgressByRegion)) {
    if (params.worldBase.regionOwner[regionId] || params.getRegionColonizationConfig(regionId).disabled) {
      continue;
    }
    for (const [countryId, value] of Object.entries(progressByCountry)) {
      if (typeof value !== "number") continue;
      const byCountry = params.activeColonizeRegionsByCountry.get(countryId) ?? new Set<string>();
      byCountry.add(regionId);
      params.activeColonizeRegionsByCountry.set(countryId, byCountry);
    }
  }
}

export function addActiveColonizationTarget(
  activeColonizeRegionsByCountry: Map<string, Set<string>>,
  countryId: string,
  regionId: string,
): void {
  const byCountry = activeColonizeRegionsByCountry.get(countryId) ?? new Set<string>();
  byCountry.add(regionId);
  activeColonizeRegionsByCountry.set(countryId, byCountry);
}

export function removeActiveColonizationTarget(
  activeColonizeRegionsByCountry: Map<string, Set<string>>,
  countryId: string,
  regionId: string,
): void {
  const byCountry = activeColonizeRegionsByCountry.get(countryId);
  if (!byCountry) return;
  byCountry.delete(regionId);
  if (byCountry.size === 0) {
    activeColonizeRegionsByCountry.delete(countryId);
  }
}

export function removeRegionFromActiveColonizationIndex(
  activeColonizeRegionsByCountry: Map<string, Set<string>>,
  regionId: string,
): void {
  for (const [countryId, regions] of activeColonizeRegionsByCountry.entries()) {
    regions.delete(regionId);
    if (regions.size === 0) {
      activeColonizeRegionsByCountry.delete(countryId);
    }
  }
}

export function removeCountryFromActiveColonizationIndex(
  activeColonizeRegionsByCountry: Map<string, Set<string>>,
  countryId: string,
): void {
  activeColonizeRegionsByCountry.delete(countryId);
}

export function normalizeRegionManualCostFlags(params: {
  worldBase: Pick<WorldBase, "regionColonizationByRegion">;
  getRegionDerivedColonizationCosts: (regionId: string) => { pointsCost: number; ducatsCost: number };
}): number {
  let normalized = 0;
  for (const [regionId, cfg] of Object.entries(params.worldBase.regionColonizationByRegion ?? {})) {
    if (!cfg || typeof cfg !== "object") continue;
    if (typeof (cfg as { manualCost?: unknown }).manualCost === "boolean") continue;
    const normalizedCost = Math.max(1, Math.floor(Number(cfg.cost ?? DEFAULT_REGION_COLONIZATION_COST)));
    const derived = params.getRegionDerivedColonizationCosts(regionId).pointsCost;
    const isAutomaticDefault = !cfg.disabled && normalizedCost === DEFAULT_REGION_COLONIZATION_COST;
    params.worldBase.regionColonizationByRegion[regionId] = {
      cost: normalizedCost,
      disabled: Boolean(cfg.disabled),
      manualCost: isAutomaticDefault ? false : normalizedCost !== derived,
    };
    normalized += 1;
  }
  return normalized;
}

export function cleanupRegionColonizationProgress(params: {
  regionId: string;
  turnId: number;
  worldBase: Pick<WorldBase, "colonyProgressByRegion">;
  activeColonizeRegionsByCountry: Map<string, Set<string>>;
  ordersByTurn: Map<number, Map<string, Order[]>>;
  turnOrderIndexes: TurnOrderIndexes;
}): void {
  delete params.worldBase.colonyProgressByRegion[params.regionId];
  removeRegionFromActiveColonizationIndex(params.activeColonizeRegionsByCountry, params.regionId);
  const turnOrders = params.ordersByTurn.get(params.turnId);
  if (!turnOrders) {
    return;
  }
  for (const [playerId, orders] of turnOrders.entries()) {
    const removed: Order[] = [];
    const nextOrders = orders.filter((order) => {
      const shouldRemove = order.type === "COLONIZE" && order.regionId === params.regionId;
      if (shouldRemove) removed.push(order);
      return !shouldRemove;
    });
    if (nextOrders.length !== orders.length) {
      for (const order of removed) {
        removeOrderFromTurnIndexes(params.turnOrderIndexes, order);
      }
      if (nextOrders.length > 0) {
        turnOrders.set(playerId, nextOrders);
      } else {
        turnOrders.delete(playerId);
      }
    }
  }
  if (turnOrders.size === 0) {
    params.ordersByTurn.delete(params.turnId);
    dropTurnOrderIndexes(params.turnOrderIndexes, params.turnId);
  }
}

export function resolveColonizationSupportTurn(params: {
  colonizeTargetsByCountry: Map<string, Set<string>>;
  worldBase: ColonizationTurnWorldState;
  defaultColonizationPointsPerTurn: number;
  touchedRegionIds: Set<string>;
  activeColonizeRegionsByCountry: Map<string, Set<string>>;
  getRegionColonizationConfig: (regionId: string) => RegionColonizationConfig;
  getRegionDerivedColonizationCosts: (regionId: string) => { pointsCost: number; ducatsCost: number };
  addExpense?: (input: ColonizationLedgerFlowInput) => void;
}): void {
  for (const [countryId, targets] of params.colonizeTargetsByCountry.entries()) {
    const regionIds = [...targets];
    if (regionIds.length === 0) {
      continue;
    }

    const countryResource = params.worldBase.resourcesByCountry[countryId];
    const countryColonizationPoints = countryResource?.colonization ?? params.defaultColonizationPointsPerTurn;
    let remainingCountrySupportDucats = Math.max(0, countryResource?.ducats ?? 0);
    if (countryColonizationPoints <= 0) {
      continue;
    }
    const gain = countryColonizationPoints / regionIds.length;
    let spentColonizationPoints = 0;
    let spentSupportDucats = 0;
    for (const regionId of regionIds) {
      if (params.worldBase.regionOwner[regionId]) {
        continue;
      }
      const regionConfig = params.getRegionColonizationConfig(regionId);
      if (regionConfig.disabled) {
        continue;
      }
      const byCountry = params.worldBase.colonyProgressByRegion[regionId] ?? {};
      const currentProgress = byCountry[countryId] ?? 0;
      const regionCost = regionConfig.cost || COLONIZATION_GOAL;
      const derivedCosts = params.getRegionDerivedColonizationCosts(regionId);
      const ducatRatio = regionCost > 0 ? derivedCosts.ducatsCost / regionCost : 0;
      const remainingToCapture = Math.max(0, regionCost - currentProgress);
      if (remainingToCapture <= 0) {
        continue;
      }
      const spentDucatsForCurrentProgress = currentProgress * ducatRatio;
      const remainingRegionDucats = Math.max(0, derivedCosts.ducatsCost - spentDucatsForCurrentProgress);
      const maxGainByCountryDucats = ducatRatio > 0 ? remainingCountrySupportDucats / ducatRatio : Number.POSITIVE_INFINITY;
      const maxGainByRegionDucats = ducatRatio > 0 ? remainingRegionDucats / ducatRatio : Number.POSITIVE_INFINITY;
      const appliedGain = Math.min(gain, remainingToCapture, maxGainByCountryDucats, maxGainByRegionDucats);
      if (appliedGain <= 0) {
        continue;
      }
      const appliedDucats =
        ducatRatio > 0 ? Math.min(remainingRegionDucats, appliedGain * ducatRatio, remainingCountrySupportDucats) : 0;
      byCountry[countryId] = currentProgress + appliedGain;
      spentColonizationPoints += appliedGain;
      spentSupportDucats += appliedDucats;
      remainingCountrySupportDucats = Math.max(0, remainingCountrySupportDucats - appliedDucats);
      params.worldBase.colonyProgressByRegion[regionId] = byCountry;
      addActiveColonizationTarget(params.activeColonizeRegionsByCountry, countryId, regionId);
      params.touchedRegionIds.add(regionId);
    }
    if (countryResource) {
      params.addExpense?.({
        countryId,
        resourceId: "colonization",
        amount: spentColonizationPoints,
        sourceType: "colonization",
        sourceId: `colonization:${countryId}`,
        categoryId: "colonization",
        labelKey: "resourceLedger.source.colonization.progress",
      });
      params.addExpense?.({
        countryId,
        resourceId: "ducats",
        amount: spentSupportDucats,
        sourceType: "colonization",
        sourceId: `colonization:${countryId}`,
        categoryId: "colonization",
        labelKey: "resourceLedger.source.colonization.support",
      });
      if (!params.addExpense) {
        countryResource.colonization = Math.max(0, countryResource.colonization - spentColonizationPoints);
        countryResource.ducats = Math.max(0, countryResource.ducats - spentSupportDucats);
      }
    }
  }
}

export function resolveColonizationCapturesTurn(params: {
  touchedRegionIds: Set<string>;
  worldBase: ColonizationTurnWorldState;
  activeColonizeRegionsByCountry: Map<string, Set<string>>;
  getRegionColonizationConfig: (regionId: string) => RegionColonizationConfig;
  settlementEnabled: boolean;
  settlementPopulationOnCapture: number;
  buildSettlementPopulation: (regionId: string, countryId: string, total: number) => RegionPopulation;
}): ColonizationCaptureResult[] {
  const captures: ColonizationCaptureResult[] = [];
  for (const regionId of params.touchedRegionIds) {
    const progressByCountry = params.worldBase.colonyProgressByRegion[regionId];
    if (!progressByCountry) {
      removeRegionFromActiveColonizationIndex(params.activeColonizeRegionsByCountry, regionId);
      continue;
    }
    if (params.worldBase.regionOwner[regionId]) {
      delete params.worldBase.colonyProgressByRegion[regionId];
      removeRegionFromActiveColonizationIndex(params.activeColonizeRegionsByCountry, regionId);
      continue;
    }
    if (params.getRegionColonizationConfig(regionId).disabled) {
      delete params.worldBase.colonyProgressByRegion[regionId];
      removeRegionFromActiveColonizationIndex(params.activeColonizeRegionsByCountry, regionId);
      continue;
    }

    const regionCost = params.getRegionColonizationConfig(regionId).cost || COLONIZATION_GOAL;
    const candidates = Object.entries(progressByCountry).filter(([, value]) => value >= regionCost);
    if (candidates.length === 0) {
      continue;
    }

    candidates.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const winnerCountryId = candidates[0]?.[0];
    if (!winnerCountryId) continue;
    const previousOwnerId = params.worldBase.regionOwner[regionId] ?? null;
    params.worldBase.regionOwner[regionId] = winnerCountryId;
    params.worldBase.regionController[regionId] = winnerCountryId;
    const settlementCreated = maybeCreateColonizationSettlement({
      regionId,
      winnerCountryId,
      worldBase: params.worldBase,
      settlementEnabled: params.settlementEnabled,
      settlementPopulationOnCapture: params.settlementPopulationOnCapture,
      buildSettlementPopulation: params.buildSettlementPopulation,
    });
    delete params.worldBase.colonyProgressByRegion[regionId];
    removeRegionFromActiveColonizationIndex(params.activeColonizeRegionsByCountry, regionId);
    captures.push({ regionId, winnerCountryId, previousOwnerId, settlementCreated });
  }
  return captures;
}

function maybeCreateColonizationSettlement(params: {
  regionId: string;
  winnerCountryId: string;
  worldBase: ColonizationTurnWorldState;
  settlementEnabled: boolean;
  settlementPopulationOnCapture: number;
  buildSettlementPopulation: (regionId: string, countryId: string, total: number) => RegionPopulation;
}): boolean {
  const total = Math.max(0, Math.floor(params.settlementPopulationOnCapture));
  if (!params.settlementEnabled || total <= 0) return false;
  const existingPopulation = params.worldBase.regionPopulationByRegion[params.regionId];
  const existingTotal = (existingPopulation?.pops ?? []).reduce((sum, pop) => sum + Math.max(0, Number(pop.size ?? 0)), 0);
  if (existingTotal > 0) return false;
  params.worldBase.regionPopulationByRegion[params.regionId] = params.buildSettlementPopulation(
    params.regionId,
    params.winnerCountryId,
    total,
  );
  return true;
}

export function resolveColonizeOrder(params: {
  order: Order;
  playerId: string;
  worldBase: ColonizationTurnWorldState;
  colonizeTargetsByCountry: Map<string, Set<string>>;
  touchedRegionIds: Set<string>;
  getRegionColonizationConfig: (regionId: string) => RegionColonizationConfig;
}): ColonizeOrderResolution {
  if (params.order.type !== "COLONIZE") {
    return {
      rejectedOrder: { playerId: params.playerId, reason: "INVALID_ORDER_TYPE", tempOrderId: params.order.id },
      accepted: false,
    };
  }
  if (params.worldBase.regionOwner[params.order.regionId] || params.getRegionColonizationConfig(params.order.regionId).disabled) {
    return {
      rejectedOrder: { playerId: params.playerId, reason: "REGION_NOT_NEUTRAL", tempOrderId: params.order.id },
      accepted: false,
    };
  }

  const byCountry = params.colonizeTargetsByCountry.get(params.order.countryId) ?? new Set<string>();
  byCountry.add(params.order.regionId);
  params.colonizeTargetsByCountry.set(params.order.countryId, byCountry);
  params.touchedRegionIds.add(params.order.regionId);
  return { rejectedOrder: null, accepted: true };
}
