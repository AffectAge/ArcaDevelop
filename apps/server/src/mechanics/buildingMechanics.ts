import { randomUUID } from "node:crypto";
import { Engine } from "json-rules-engine";
import type {
  BuildingInstance,
  BuildingOwner,
  Order,
  RegionConstructionProject,
  RegionResourceDeposit,
  ResourceFlowSourceType,
  ResourceId,
  ResourceTotals,
  WorldBase,
} from "@arcanorum/shared";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";

export const DEFAULT_BUILDING_DURABILITY_MAX = 100;

export type PollutionProductivityMode = "penalty" | "bonus" | "ignore";

export type BuildingCountryLimit = {
  countryId: string;
  limit: number | null;
};

export type BuildingMechanicsContentEntry = {
  id: string;
  costConstruction?: number | null;
  costDucats?: number | null;
  startingDucats?: number | null;
  maxLevel?: number | null;
  maxDurability?: number | null;
  upgradeCostDucats?: number | null;
  upgradeCostConstruction?: number | null;
  allowedCountryIds?: string[];
  deniedCountryIds?: string[];
  allowedProvinceTypes?: string[];
  deniedProvinceTypes?: string[];
  allowedClimates?: string[];
  deniedClimates?: string[];
  allowedLandscapes?: string[];
  deniedLandscapes?: string[];
  allowedContinents?: string[];
  deniedContinents?: string[];
  allowedStrategicRegions?: string[];
  deniedStrategicRegions?: string[];
  minRadiation?: number | null;
  maxRadiation?: number | null;
  pollutionProductivityMode?: PollutionProductivityMode;
  countryBuildLimits?: BuildingCountryLimit[];
  globalBuildLimit?: number | null;
};

export type BuildingLevelRange = {
  minLevel?: number | null;
  maxLevel?: number | null;
};

export type BuildingProductionInput = BuildingLevelRange & {
  goodId: string;
  amount: number;
};

export type BuildingProductionOutput = BuildingLevelRange & {
  goodId: string;
  amount: number;
  affectedByFertility?: boolean | null;
};

export type BuildingProductionExtraction = BuildingLevelRange & {
  goodId: string;
  amount: number;
  requiresDeposit?: boolean | null;
};

export type BuildingProductionContentEntry = {
  id: string;
  extractionGoodId?: string | null;
  extractionAmountPerTurn?: number | null;
  extractionRequiresDeposit?: boolean | null;
  extractions?: BuildingProductionExtraction[];
  pollutionProductivityMode?: PollutionProductivityMode;
  inputs?: BuildingProductionInput[];
  outputs?: BuildingProductionOutput[];
};

export type BuildingProductionDeposit = {
  goodId: string;
  amount: number;
};

export type BuildingProductionResult = {
  inputCoverage: number;
  extractionCoverage: number;
  durabilityCoverage: number;
  productivity: number;
  missingInputGoodIds: string[];
  consumedByGood: Record<string, number>;
  producedByGood: Record<string, number>;
  extractedByGood: Record<string, number>;
};

export type BuildingSettlementWorkforceRequirement = {
  professionId: string;
  workers: number;
};

export type BuildingSettlementContentEntry = {
  id: string;
  name?: string | null;
  workforceRequirements?: BuildingSettlementWorkforceRequirement[];
};

export type BuildingSettlementInstance = {
  instanceId: string;
  buildingId: string;
  level?: number | null;
  ducats?: number | null;
  currentDurability?: number | null;
  warehouseByGoodId?: Record<string, number> | null;
  lastRevenueDucats?: number | null;
  lastWagesDucats?: number | null;
  lastStateSubsidyDucats?: number | null;
  lastNetDucats?: number | null;
  isInactive?: boolean | null;
  inactiveReason?: string | null;
};

export type BuildingSettlementSubsidyResource = {
  ducats?: number | null;
};

export type BuildingSettlementCoverageKey =
  | "labor"
  | "input"
  | "infra"
  | "finance"
  | "extraction"
  | "durability"
  | "pollution";

export type BuildingOperationSettlementResult = {
  wagesActual: number;
  wagesByProfession: Record<string, number>;
  employedByProfession: Record<string, number>;
  removeInstance: boolean;
  inactiveAlert:
    | {
        reason: string;
        message: string;
      }
    | null;
};

export type BuildingTurnPreparationInstance = {
  level?: number | null;
  ducats?: number | null;
  currentDurability?: number | null;
  warehouseByGoodId?: Record<string, number> | null;
  lastPurchaseByGoodId?: Record<string, number> | null;
  lastPurchaseCostByGoodId?: Record<string, number> | null;
  lastSalesByGoodId?: Record<string, number> | null;
  lastSalesRevenueByGoodId?: Record<string, number> | null;
  lastConsumptionByGoodId?: Record<string, number> | null;
  lastProductionByGoodId?: Record<string, number> | null;
  lastExtractionByGoodId?: Record<string, number> | null;
  lastLaborCoverage?: number | null;
  lastInfraCoverage?: number | null;
  lastInputCoverage?: number | null;
  lastFinanceCoverage?: number | null;
  lastExtractionCoverage?: number | null;
  lastDurabilityCoverage?: number | null;
  lastProductivity?: number | null;
  lastRevenueDucats?: number | null;
  lastInputCostDucats?: number | null;
  lastWagesDucats?: number | null;
  lastStateSubsidyDucats?: number | null;
  lastNetDucats?: number | null;
  isInactive?: boolean | null;
  inactiveReason?: string | null;
  manualWorkEnabled?: boolean | null;
};

export type BuildingTurnPreparationResult = {
  manualWorkEnabled: boolean;
  instanceLevel: number;
};

export type BuildingOperationEconomicsInstance = {
  ducats?: number | null;
  stateSubsidiesEnabled?: boolean | null;
  owner?: BuildingOwner;
  warehouseByGoodId?: Record<string, number> | null;
  lastStateSubsidyDucats?: number | null;
};

export type BuildingOperationEconomicsProfession = {
  baseWage?: number | null;
};

export type BuildingOperationEconomicsWorkforceRequirement = {
  professionId: string;
  workers: number;
};

export type BuildingOperationEconomicsResult = {
  wagesEstimate: number;
  wagesEstimateByProfession: Record<string, number>;
  requiredInputValueEstimate: number;
  inputNeeds: Array<{ goodId: string; required: number; available: number }>;
  workersDemand: number;
  laborCoverage: number;
  infraCoverage: number;
  financeCoverage: number;
  subsidyCountryId: string;
  subsidiesEnabled: boolean;
  grantedStateSubsidy: number;
};

export type RegionBuildingTurnFinalizationResult = {
  activeBuildingInstances: BuildingInstance[];
  populationTreasury: number;
  buildingDucatsByBuildingId: Record<string, number>;
  resourceDeposits: RegionResourceDeposit[];
};

export type BuildLimitCounts = {
  byCountry: number;
  global: number;
};

export type BuildingRejectedOrder = {
  playerId: string;
  reason: string;
  tempOrderId?: string;
};

export type BuildOrderResolution = {
  rejectedOrder: BuildingRejectedOrder | null;
  queuedProject: RegionConstructionProject | null;
};

export type BuildingConstructionWorldState = Pick<
  WorldBase,
  "regionOwner" | "regionController" | "regionBuildingsByRegion" | "regionConstructionQueueByRegion" | "resourcesByCountry"
>;

export type BuildingConstructionResources = Record<string, ResourceTotals>;

export type BuildingLedgerFlowInput = {
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

export function roundBuildingNumber(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<string>();
  const items: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    const key = value.toLocaleLowerCase("ru");
    if (!value || unique.has(key)) continue;
    unique.add(key);
    items.push(value);
  }
  return items.slice(0, 256);
}

function normalizeCountryIdList(input: unknown): string[] {
  return normalizeStringList(input);
}

export function normalizePollutionProductivityMode(input: unknown): PollutionProductivityMode {
  return input === "bonus" || input === "ignore" || input === "penalty" ? input : "penalty";
}

export function normalizeBuildingCountryLimits(input: unknown): BuildingCountryLimit[] {
  if (!Array.isArray(input)) return [];
  const byCountry = new Map<string, number | null>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<{ countryId: unknown; limit: unknown }>;
    const countryId = typeof row.countryId === "string" ? row.countryId.trim() : "";
    if (!countryId) continue;
    if (row.limit === null) {
      byCountry.set(countryId, null);
      continue;
    }
    const limit = typeof row.limit === "number" && Number.isFinite(row.limit) ? Math.max(1, Math.floor(row.limit)) : 0;
    if (limit <= 0) continue;
    byCountry.set(countryId, limit);
  }
  return [...byCountry.entries()].slice(0, 256).map(([countryId, limit]) => ({ countryId, limit }));
}

const buildingCountryAccessEngine = (() => {
  const engine = new Engine();
  engine.addRule({
    conditions: {
      all: [
        { fact: "isDenied", operator: "equal", value: false },
        { fact: "allowListSatisfied", operator: "equal", value: true },
      ],
    },
    event: { type: "allowed" },
  });
  return engine;
})();

export function parseRequestedBuildingIdFromPayload(
  payload: Record<string, unknown>,
  fallbackBuildingId: string,
): string {
  const requestedBuildingId =
    typeof payload.buildingId === "string"
      ? payload.buildingId.trim()
      : typeof payload.building === "string"
        ? payload.building.trim()
        : "";
  return requestedBuildingId || fallbackBuildingId;
}

export function getBuildingRuleLists(building: BuildingMechanicsContentEntry): { allowed: string[]; denied: string[] } {
  return {
    allowed: normalizeCountryIdList(building.allowedCountryIds),
    denied: normalizeCountryIdList(building.deniedCountryIds),
  };
}

export function isCountryAllowedForBuildingSync(building: BuildingMechanicsContentEntry, countryId: string): boolean {
  const lists = getBuildingRuleLists(building);
  if (lists.denied.includes(countryId)) {
    return false;
  }
  if (lists.allowed.length > 0 && !lists.allowed.includes(countryId)) {
    return false;
  }
  return true;
}

function hasTextRuleMatch(value: string | null | undefined, rules: string[] | undefined): boolean {
  if (!rules || rules.length === 0 || value == null) return false;
  const normalizedValue = String(value).trim().toLocaleLowerCase("ru");
  return rules.some((rule) => rule.trim().toLocaleLowerCase("ru") === normalizedValue);
}

export function isTextRuleAllowed(
  value: string | null | undefined,
  allowed: string[] | undefined,
  denied: string[] | undefined,
): boolean {
  if (hasTextRuleMatch(value, denied)) return false;
  const allowList = normalizeStringList(allowed);
  if (allowList.length === 0) return true;
  return hasTextRuleMatch(value, allowList);
}

export function getProvinceBuildRestriction(
  building: BuildingMechanicsContentEntry,
  province: Adm1ProvinceIndexEntry | undefined,
): string | null {
  if (!province) return "Провинция не найдена в индексе карты";
  if (!isTextRuleAllowed(province.provinceType, building.allowedProvinceTypes, building.deniedProvinceTypes)) {
    return "Тип провинции не подходит для этого здания";
  }
  if (!isTextRuleAllowed(province.climate, building.allowedClimates, building.deniedClimates)) {
    return "Климат провинции не подходит для этого здания";
  }
  if (!isTextRuleAllowed(province.landscape, building.allowedLandscapes, building.deniedLandscapes)) {
    return "Ландшафт провинции не подходит для этого здания";
  }
  if (!isTextRuleAllowed(province.continent, building.allowedContinents, building.deniedContinents)) {
    return "Континент провинции не подходит для этого здания";
  }
  if (!isTextRuleAllowed(province.strategicRegion, building.allowedStrategicRegions, building.deniedStrategicRegions)) {
    return "Стратегический регион провинции не подходит для этого здания";
  }
  const radiation = Math.max(0, Number(province.radiation ?? 0));
  if (typeof building.minRadiation === "number" && Number.isFinite(building.minRadiation) && radiation < building.minRadiation) {
    return "Радиация провинции ниже минимального требования";
  }
  if (typeof building.maxRadiation === "number" && Number.isFinite(building.maxRadiation) && radiation > building.maxRadiation) {
    return "Радиация провинции выше максимального требования";
  }
  return null;
}

export function getBuildingPollutionProductivityFactor(params: {
  building: BuildingMechanicsContentEntry;
  province: Pick<Adm1ProvinceIndexEntry, "pollution"> | undefined;
  pollutionProductivityEffectPer1000: number;
}): number {
  const mode = normalizePollutionProductivityMode(params.building.pollutionProductivityMode);
  if (mode === "ignore") return 1;
  const pollution = Math.max(0, Number(params.province?.pollution ?? 0));
  const effectPer1000 = Math.max(0, Number(params.pollutionProductivityEffectPer1000 ?? 0));
  if (!Number.isFinite(pollution) || !Number.isFinite(effectPer1000) || pollution <= 0 || effectPer1000 <= 0) return 1;
  const effect = (pollution / 1000) * effectPer1000;
  return mode === "bonus" ? 1 + effect : Math.max(0, 1 - effect);
}

export function prepareBuildingInstanceForTurn<TInstance extends BuildingTurnPreparationInstance>(params: {
  instance: TInstance;
  maxDurability: number;
}): BuildingTurnPreparationResult {
  const instanceLevel = Math.max(1, Math.floor(Number(params.instance.level ?? 1)));
  const maxDurability = Math.max(0, Number(params.maxDurability));
  params.instance.level = instanceLevel;
  params.instance.ducats = roundBuildingNumber(Math.max(0, Number(params.instance.ducats ?? 0)));
  params.instance.currentDurability = roundBuildingNumber(
    Math.max(0, Math.min(maxDurability, Number(params.instance.currentDurability ?? maxDurability))),
  );
  params.instance.warehouseByGoodId = { ...(params.instance.warehouseByGoodId ?? {}) };
  params.instance.lastPurchaseByGoodId = {};
  params.instance.lastPurchaseCostByGoodId = {};
  params.instance.lastSalesByGoodId = {};
  params.instance.lastSalesRevenueByGoodId = {};
  params.instance.lastConsumptionByGoodId = {};
  params.instance.lastProductionByGoodId = {};
  params.instance.lastExtractionByGoodId = {};
  params.instance.lastLaborCoverage = 0;
  params.instance.lastInfraCoverage = 0;
  params.instance.lastInputCoverage = 0;
  params.instance.lastFinanceCoverage = 0;
  params.instance.lastExtractionCoverage = 0;
  params.instance.lastDurabilityCoverage = 0;
  params.instance.lastProductivity = 0;
  params.instance.lastRevenueDucats = 0;
  params.instance.lastInputCostDucats = 0;
  params.instance.lastWagesDucats = 0;
  params.instance.lastStateSubsidyDucats = 0;
  params.instance.lastNetDucats = 0;
  params.instance.isInactive = false;
  params.instance.inactiveReason = null;
  const manualWorkEnabled = params.instance.manualWorkEnabled !== false;
  params.instance.manualWorkEnabled = manualWorkEnabled;
  return { manualWorkEnabled, instanceLevel };
}

export function isBuildingFlowActiveAtLevel(flow: BuildingLevelRange, instanceLevel: number): boolean {
  const level = Math.max(1, Math.floor(Number(instanceLevel)));
  const minLevel = flow.minLevel == null ? null : Math.max(1, Math.floor(Number(flow.minLevel)));
  const maxLevel = flow.maxLevel == null ? null : Math.max(1, Math.floor(Number(flow.maxLevel)));
  if (minLevel !== null && level < minLevel) return false;
  if (maxLevel !== null && level > maxLevel) return false;
  return true;
}

function getActiveBuildingExtractions(building: BuildingProductionContentEntry, instanceLevel: number): BuildingProductionExtraction[] {
  const authoredExtractions = building.extractions ?? [];
  const compatibleExtraction: BuildingProductionExtraction[] =
    typeof building.extractionGoodId === "string" && building.extractionGoodId.trim().length > 0
      ? [{
          goodId: building.extractionGoodId.trim(),
          amount: Number(building.extractionAmountPerTurn ?? 0),
          requiresDeposit: building.extractionRequiresDeposit !== false,
        }]
      : [];
  return [...authoredExtractions, ...compatibleExtraction].filter((extraction) =>
    extraction.amount > 0 && isBuildingFlowActiveAtLevel(extraction, instanceLevel),
  );
}

export function prepareBuildingOperationEconomics(params: {
  instance: BuildingOperationEconomicsInstance;
  building: {
    id: string;
    inputs?: BuildingProductionInput[];
    workforceRequirements?: BuildingOperationEconomicsWorkforceRequirement[];
  };
  ownerCountryId: string;
  instanceLevel: number;
  laborCoverageProvince: number;
  buildingThroughput: number;
  professionsById: Map<string, BuildingOperationEconomicsProfession>;
  wageMultiplierByProfession: Record<string, number>;
  getBaseWageFallback: () => number;
  resolveWage: (professionId: string, baseWage: number) => number;
  resolveInputAmount: (input: BuildingProductionInput) => number;
  getInputPrice: (goodId: string) => number;
  addInputDemand: (goodId: string, amount: number) => void;
  ensureCountry: (countryId: string) => void;
  getCountryDucats: (countryId: string) => number;
  setCountryDucats: (countryId: string, amount: number) => void;
}): BuildingOperationEconomicsResult {
  const warehouse = params.instance.warehouseByGoodId ?? {};
  let wagesEstimate = 0;
  const wagesEstimateByProfession: Record<string, number> = {};
  let workersDemand = 0;
  for (const requirement of params.building.workforceRequirements ?? []) {
    const profession = params.professionsById.get(requirement.professionId);
    const baseWage = Math.max(0, params.resolveWage(requirement.professionId, Number(profession?.baseWage ?? params.getBaseWageFallback())));
    const multiplier = params.wageMultiplierByProfession[requirement.professionId] ?? 1;
    const workers = Math.max(0, requirement.workers) * params.instanceLevel;
    const professionWages = workers * baseWage * multiplier;
    wagesEstimate += professionWages;
    wagesEstimateByProfession[requirement.professionId] =
      (wagesEstimateByProfession[requirement.professionId] ?? 0) + professionWages;
    workersDemand += workers;
  }
  const laborCoverage = workersDemand > 0 ? params.laborCoverageProvince : 1;
  const infraCoverage = 1;

  let requiredInputValueEstimate = 0;
  const activeInputs = (params.building.inputs ?? []).filter((input) => isBuildingFlowActiveAtLevel(input, params.instanceLevel));
  const inputNeeds = activeInputs.map((input) => {
    const required = Math.max(0, params.resolveInputAmount(input)) *
      params.instanceLevel *
      laborCoverage *
      params.buildingThroughput;
    const available = Math.max(0, Number(warehouse[input.goodId] ?? 0));
    const deficit = Math.max(0, required - available);
    const price = params.getInputPrice(input.goodId);
    requiredInputValueEstimate += deficit * price;
    params.addInputDemand(input.goodId, deficit);
    return { goodId: input.goodId, required, available };
  });

  const subsidyCountryId =
    params.instance.owner?.type === "state" ? params.instance.owner.countryId : params.ownerCountryId;
  const subsidiesEnabled = params.instance.stateSubsidiesEnabled !== false;
  let grantedStateSubsidy = 0;
  const estimatedTotalCost = roundBuildingNumber(wagesEstimate + requiredInputValueEstimate);
  if (subsidiesEnabled && estimatedTotalCost > 0) {
    const buildingDucatsBeforeSubsidy = roundBuildingNumber(Math.max(0, Number(params.instance.ducats ?? 0)));
    const subsidyNeeded = roundBuildingNumber(Math.max(0, estimatedTotalCost - buildingDucatsBeforeSubsidy));
    if (subsidyNeeded > 0) {
      params.ensureCountry(subsidyCountryId);
      const subsidyAvailable = roundBuildingNumber(Math.max(0, params.getCountryDucats(subsidyCountryId)));
      if (subsidyAvailable + 1e-9 >= subsidyNeeded) {
        params.setCountryDucats(subsidyCountryId, roundBuildingNumber(Math.max(0, subsidyAvailable - subsidyNeeded)));
        params.instance.ducats = roundBuildingNumber(buildingDucatsBeforeSubsidy + subsidyNeeded);
        grantedStateSubsidy = roundBuildingNumber(grantedStateSubsidy + subsidyNeeded);
        params.instance.lastStateSubsidyDucats = grantedStateSubsidy;
      }
    }
  }
  const totalEstimate = wagesEstimate + requiredInputValueEstimate;
  const financeCoverage =
    totalEstimate > 0
      ? roundBuildingNumber(Math.max(0, Math.min(1, Number(params.instance.ducats ?? 0) / totalEstimate)))
      : 1;

  return {
    wagesEstimate,
    wagesEstimateByProfession,
    requiredInputValueEstimate,
    inputNeeds,
    workersDemand,
    laborCoverage,
    infraCoverage,
    financeCoverage,
    subsidyCountryId,
    subsidiesEnabled,
    grantedStateSubsidy,
  };
}

export function resolveBuildingProductionTurn(params: {
  building: BuildingProductionContentEntry;
  instanceLevel: number;
  warehouse: Record<string, number>;
  regionResourceDeposits: BuildingProductionDeposit[];
  laborCoverage: number;
  infraCoverage: number;
  financeCoverage: number;
  currentDurability: number;
  maxDurability: number;
  buildingThroughput: number;
  fertilityMultiplier: number;
  pollutionProductivityFactor: number;
  resolveInputAmount: (input: BuildingProductionInput) => number;
  resolveOutputAmount: (goodId: string, baseAmount: number) => number;
  addProductionMax: (goodId: string, amount: number) => void;
  addProduction: (goodId: string, amount: number) => void;
}): BuildingProductionResult {
  let inputCoverage = 1;
  const missingInputGoodIds: string[] = [];
  for (const input of (params.building.inputs ?? []).filter((flow) => isBuildingFlowActiveAtLevel(flow, params.instanceLevel))) {
    const required = Math.max(0, params.resolveInputAmount(input)) *
      params.instanceLevel *
      params.laborCoverage *
      params.buildingThroughput;
    if (required <= 0) continue;
    const available = Math.max(0, Number(params.warehouse[input.goodId] ?? 0));
    inputCoverage = Math.min(inputCoverage, available / required);
    if (available + 1e-9 < required && !missingInputGoodIds.includes(input.goodId)) {
      missingInputGoodIds.push(input.goodId);
    }
  }
  if (!Number.isFinite(inputCoverage)) inputCoverage = 1;
  inputCoverage = roundBuildingNumber(Math.max(0, Math.min(1, inputCoverage)));

  const activeExtractions = getActiveBuildingExtractions(params.building, params.instanceLevel);
  let extractionCoverage = 1;
  for (const extraction of activeExtractions) {
    const extractionAmountPerTurn = Math.max(0, params.resolveOutputAmount(extraction.goodId, extraction.amount));
    if (extractionAmountPerTurn <= 0 || extraction.requiresDeposit === false) continue;
    const deposit = params.regionResourceDeposits.find((row) => row.goodId === extraction.goodId);
    const availableDeposit = Math.max(0, Number(deposit?.amount ?? 0));
    const extractionRequired = roundBuildingNumber(extractionAmountPerTurn * params.instanceLevel * params.laborCoverage * params.buildingThroughput);
    if (extractionRequired > 0) {
      extractionCoverage = Math.min(extractionCoverage, availableDeposit / extractionRequired);
    }
  }
  if (!Number.isFinite(extractionCoverage)) extractionCoverage = 1;
  extractionCoverage = roundBuildingNumber(Math.max(0, Math.min(1, extractionCoverage)));

  const durabilityCoverage =
    params.maxDurability > 0
      ? roundBuildingNumber(Math.max(0, Math.min(1, params.currentDurability / params.maxDurability)))
      : 1;
  const baseProductivity = Math.max(
    0,
    Math.min(params.laborCoverage, params.infraCoverage, inputCoverage, params.financeCoverage, extractionCoverage, durabilityCoverage),
  );
  const productivity = roundBuildingNumber(Math.max(0, baseProductivity * params.pollutionProductivityFactor));

  const consumedByGood: Record<string, number> = {};
  for (const input of (params.building.inputs ?? []).filter((flow) => isBuildingFlowActiveAtLevel(flow, params.instanceLevel))) {
    const required = Math.max(0, params.resolveInputAmount(input)) *
      params.instanceLevel *
      params.laborCoverage *
      params.buildingThroughput;
    const consumed = roundBuildingNumber(required * productivity);
    if (consumed <= 0) continue;
    const before = Math.max(0, Number(params.warehouse[input.goodId] ?? 0));
    params.warehouse[input.goodId] = roundBuildingNumber(Math.max(0, before - consumed));
    consumedByGood[input.goodId] = consumed;
  }

  const producedByGood: Record<string, number> = {};
  for (const output of (params.building.outputs ?? []).filter((flow) => isBuildingFlowActiveAtLevel(flow, params.instanceLevel))) {
    const outputAmount = Math.max(0, params.resolveOutputAmount(output.goodId, output.amount));
    const outputMultiplier = output.affectedByFertility === true ? params.fertilityMultiplier : 1;
    const producedMax = roundBuildingNumber(outputAmount * params.instanceLevel * params.laborCoverage * params.buildingThroughput * outputMultiplier);
    if (producedMax > 0) params.addProductionMax(output.goodId, producedMax);
    const produced = roundBuildingNumber(outputAmount * params.instanceLevel * productivity * params.buildingThroughput * outputMultiplier);
    if (produced <= 0) continue;
    params.warehouse[output.goodId] = roundBuildingNumber(Math.max(0, Number(params.warehouse[output.goodId] ?? 0)) + produced);
    producedByGood[output.goodId] = produced;
    params.addProduction(output.goodId, produced);
  }

  const extractedByGood: Record<string, number> = {};
  for (const extraction of activeExtractions) {
    const extractionAmountPerTurn = Math.max(0, params.resolveOutputAmount(extraction.goodId, extraction.amount));
    const extractionRequiresDeposit = extraction.requiresDeposit !== false;
    if (extractionAmountPerTurn <= 0) continue;
    const deposit = params.regionResourceDeposits.find((row) => row.goodId === extraction.goodId);
    const availableDeposit = Math.max(0, Number(deposit?.amount ?? 0));
    const extractionMax = roundBuildingNumber(extractionAmountPerTurn * params.instanceLevel * params.laborCoverage * params.buildingThroughput);
    if (extractionMax > 0) params.addProductionMax(extraction.goodId, extractionRequiresDeposit ? Math.min(extractionMax, availableDeposit) : extractionMax);
    if (!extractionRequiresDeposit || availableDeposit > 0) {
      const extractionRaw = roundBuildingNumber(extractionAmountPerTurn * params.instanceLevel * productivity * params.buildingThroughput);
      const extracted = extractionRequiresDeposit ? Math.min(extractionRaw, availableDeposit) : extractionRaw;
      if (extracted > 0) {
        params.warehouse[extraction.goodId] = roundBuildingNumber(Math.max(0, Number(params.warehouse[extraction.goodId] ?? 0)) + extracted);
        extractedByGood[extraction.goodId] = roundBuildingNumber((extractedByGood[extraction.goodId] ?? 0) + extracted);
        producedByGood[extraction.goodId] = roundBuildingNumber((producedByGood[extraction.goodId] ?? 0) + extracted);
        params.addProduction(extraction.goodId, extracted);
        if (extractionRequiresDeposit && deposit) {
          deposit.amount = roundBuildingNumber(Math.max(0, availableDeposit - extracted));
        }
      }
    }
  }

  return {
    inputCoverage,
    extractionCoverage,
    durabilityCoverage,
    productivity,
    missingInputGoodIds,
    consumedByGood,
    producedByGood,
    extractedByGood,
  };
}

export function resolveBuildingOperationSettlement(params: {
  instance: BuildingSettlementInstance;
  building: BuildingSettlementContentEntry;
  warehouse: Record<string, number>;
  purchaseCost: number;
  wagesEstimate: number;
  wagesEstimateByProfession: Record<string, number>;
  grantedStateSubsidy: number;
  subsidiesEnabled: boolean;
  subsidySource?: BuildingSettlementSubsidyResource | null;
  productivity: number;
  laborCoverage: number;
  inputCoverage: number;
  infraCoverage: number;
  financeCoverage: number;
  extractionCoverage: number;
  durabilityCoverage: number;
  pollutionProductivityFactor: number;
  missingInputGoodNames: string[];
  instanceLevel: number;
  durabilityDecayPerTurn: number;
  durabilityRecoveryPerTurn: number;
  maxDurability: number;
}): BuildingOperationSettlementResult {
  const realizedRevenue = roundBuildingNumber(Math.max(0, Number(params.instance.lastRevenueDucats ?? 0)));
  params.instance.lastRevenueDucats = realizedRevenue;
  params.instance.ducats = roundBuildingNumber(Math.max(0, Number(params.instance.ducats ?? 0) - params.purchaseCost));

  const wagesActual = roundBuildingNumber(params.wagesEstimate * params.productivity);
  const wagesByProfession: Record<string, number> = {};
  for (const [professionId, estimate] of Object.entries(params.wagesEstimateByProfession)) {
    wagesByProfession[professionId] = roundBuildingNumber(estimate * params.productivity);
  }
  params.instance.lastWagesDucats = wagesActual;
  const paidWages = Math.min(Number(params.instance.ducats ?? 0), wagesActual);
  params.instance.ducats = roundBuildingNumber(Math.max(0, Number(params.instance.ducats ?? 0) - paidWages));
  let unpaidWages = roundBuildingNumber(Math.max(0, wagesActual - paidWages));
  let grantedStateSubsidy = roundBuildingNumber(Math.max(0, params.grantedStateSubsidy));

  const buildingDucatsBeforeSubsidy = roundBuildingNumber(
    Math.max(0, Number(params.instance.ducats ?? 0) + paidWages + params.purchaseCost - grantedStateSubsidy),
  );
  const factualDeficit = roundBuildingNumber(Math.max(0, params.purchaseCost + wagesActual - buildingDucatsBeforeSubsidy));
  if (params.subsidiesEnabled && params.subsidySource) {
    if (grantedStateSubsidy > factualDeficit) {
      const refund = roundBuildingNumber(Math.max(0, grantedStateSubsidy - factualDeficit));
      if (refund > 0) {
        params.subsidySource.ducats = roundBuildingNumber(Math.max(0, Number(params.subsidySource.ducats ?? 0)) + refund);
        params.instance.ducats = roundBuildingNumber(Math.max(0, Number(params.instance.ducats ?? 0) - refund));
        grantedStateSubsidy = roundBuildingNumber(Math.max(0, grantedStateSubsidy - refund));
      }
    } else if (grantedStateSubsidy + 1e-9 < factualDeficit) {
      const extraNeeded = roundBuildingNumber(Math.max(0, factualDeficit - grantedStateSubsidy));
      const extraAvailable = roundBuildingNumber(Math.max(0, Number(params.subsidySource.ducats ?? 0)));
      const extraGranted = roundBuildingNumber(Math.min(extraNeeded, extraAvailable));
      if (extraGranted > 0) {
        params.subsidySource.ducats = roundBuildingNumber(Math.max(0, extraAvailable - extraGranted));
        params.instance.ducats = roundBuildingNumber(Math.max(0, Number(params.instance.ducats ?? 0) + extraGranted));
        grantedStateSubsidy = roundBuildingNumber(grantedStateSubsidy + extraGranted);
      }
    }
  }
  params.instance.lastStateSubsidyDucats = roundBuildingNumber(Math.max(0, grantedStateSubsidy));

  if (unpaidWages > 0 && params.subsidiesEnabled) {
    const catchUpWages = roundBuildingNumber(Math.min(unpaidWages, Math.max(0, Number(params.instance.ducats ?? 0))));
    if (catchUpWages > 0) {
      params.instance.ducats = roundBuildingNumber(Math.max(0, Number(params.instance.ducats ?? 0) - catchUpWages));
      unpaidWages = roundBuildingNumber(Math.max(0, unpaidWages - catchUpWages));
    }
  }

  const net = roundBuildingNumber(realizedRevenue - params.purchaseCost - wagesActual);
  params.instance.lastNetDucats = net;
  let inactiveAlert: BuildingOperationSettlementResult["inactiveAlert"] = null;
  if (params.productivity <= 0) {
    params.instance.isInactive = true;
    const buildingLabel = params.building.name?.trim() || params.instance.buildingId;
    const coverages: Array<{ key: BuildingSettlementCoverageKey; value: number }> = [
      { key: "labor", value: params.laborCoverage },
      { key: "input", value: params.inputCoverage },
      { key: "infra", value: params.infraCoverage },
      { key: "finance", value: params.financeCoverage },
      { key: "extraction", value: params.extractionCoverage },
      { key: "durability", value: params.durabilityCoverage },
      { key: "pollution", value: params.pollutionProductivityFactor },
    ];
    coverages.sort((a, b) => a.value - b.value);
    const limiting = coverages[0] ?? { key: "labor" as const, value: 0 };
    const label = getCoverageLabel(limiting.key);
    const missingInputsText =
      limiting.key === "input" && params.missingInputGoodNames.length > 0
        ? `; не хватает: ${params.missingInputGoodNames.slice(0, 4).join(", ")}${params.missingInputGoodNames.length > 4 ? "..." : ""}`
        : "";
    const reason = `Нулевая продуктивность (лимит: ${label}, ${(limiting.value * 100).toFixed(1)}%${missingInputsText})`;
    params.instance.inactiveReason = reason;
    inactiveAlert = { reason, message: `Здание ${buildingLabel} неактивно: ${reason}` };
  } else if (unpaidWages > 0) {
    params.instance.isInactive = true;
    const buildingLabel = params.building.name?.trim() || params.instance.buildingId;
    const reason = "Недостаточно дукатов для покрытия расходов";
    params.instance.inactiveReason = reason;
    inactiveAlert = { reason, message: `Здание ${buildingLabel} неактивно: ${reason}` };
  } else {
    params.instance.isInactive = false;
    params.instance.inactiveReason = null;
  }

  const employedByProfession: Record<string, number> = {};
  if (!params.instance.isInactive) {
    for (const requirement of params.building.workforceRequirements ?? []) {
      const workers = roundBuildingNumber(Math.max(0, requirement.workers) * params.instanceLevel * params.laborCoverage);
      if (workers <= 0) continue;
      employedByProfession[requirement.professionId] = roundBuildingNumber((employedByProfession[requirement.professionId] ?? 0) + workers);
    }
  }

  let removeInstance = false;
  const durabilityNow = roundBuildingNumber(Math.max(0, Math.min(params.maxDurability, Number(params.instance.currentDurability ?? params.maxDurability))));
  if (params.instance.isInactive) {
    const degraded = roundBuildingNumber(Math.max(0, durabilityNow - params.durabilityDecayPerTurn));
    params.instance.currentDurability = degraded;
    if (degraded <= 0) {
      const currentLevel = Math.max(1, Math.floor(Number(params.instance.level ?? 1)));
      const nextLevel = currentLevel - 1;
      if (nextLevel <= 0) {
        removeInstance = true;
      } else {
        params.instance.level = nextLevel;
      }
    }
  } else {
    params.instance.currentDurability = roundBuildingNumber(Math.min(params.maxDurability, durabilityNow + params.durabilityRecoveryPerTurn));
  }

  params.instance.warehouseByGoodId = Object.fromEntries(
    Object.entries(params.warehouse)
      .map(([goodId, amount]) => [goodId, roundBuildingNumber(Math.max(0, Number(amount)))])
      .filter(([, amount]) => Number(amount) > 0),
  );

  return {
    wagesActual,
    wagesByProfession,
    employedByProfession,
    removeInstance,
    inactiveAlert,
  };
}

function getCoverageLabel(key: BuildingSettlementCoverageKey): string {
  if (key === "labor") return "труда";
  if (key === "input") return "входных товаров";
  if (key === "infra") return "инфраструктуры";
  if (key === "finance") return "финансов";
  if (key === "extraction") return "добычи";
  if (key === "durability") return "прочности";
  return "загрязнения";
}

export async function isCountryAllowedForBuildingWithEngine(
  building: BuildingMechanicsContentEntry,
  countryId: string,
): Promise<boolean> {
  const lists = getBuildingRuleLists(building);
  const result = await buildingCountryAccessEngine.run({
    isDenied: lists.denied.includes(countryId),
    allowListSatisfied: lists.allowed.length === 0 || lists.allowed.includes(countryId),
  });
  return result.events.some((event) => event.type === "allowed");
}

export function countBuildingOccurrences(params: {
  buildingId: string;
  countryId: string;
  worldBase: Pick<WorldBase, "regionBuildingsByRegion" | "regionConstructionQueueByRegion" | "regionOwner" | "regionController">;
  pendingOrders?: Iterable<Order>;
  parseRequestedBuildingId: (payload: Record<string, unknown>) => string;
}): BuildLimitCounts {
  let byCountry = 0;
  let global = 0;

  for (const [regionId, instances] of Object.entries(params.worldBase.regionBuildingsByRegion)) {
    const amount = (instances ?? [])
      .filter((instance) => instance.buildingId === params.buildingId)
      .reduce((sum, instance) => sum + Math.max(1, Math.floor(Number(instance.level ?? 1))), 0);
    if (amount <= 0) continue;
    global += amount;
    if ((params.worldBase.regionController[regionId] ?? params.worldBase.regionOwner[regionId] ?? null) === params.countryId) {
      byCountry += amount;
    }
  }

  for (const [regionId, queue] of Object.entries(params.worldBase.regionConstructionQueueByRegion)) {
    for (const project of queue ?? []) {
      if (project.buildingId !== params.buildingId) continue;
      if (project.projectType === "upgrade") continue;
      global += 1;
      if ((params.worldBase.regionController[regionId] ?? params.worldBase.regionOwner[regionId] ?? null) === params.countryId) {
        byCountry += 1;
      }
    }
  }

  for (const order of params.pendingOrders ?? []) {
    if (order.type !== "BUILD") continue;
    const payload = (order.payload ?? {}) as Record<string, unknown>;
    if (params.parseRequestedBuildingId(payload) !== params.buildingId) continue;
    global += 1;
    if (order.countryId === params.countryId) {
      byCountry += 1;
    }
  }

  return { byCountry, global };
}

export function getCountryBuildLimit(
  building: BuildingMechanicsContentEntry,
  countryId: string,
): number | null | undefined {
  const limits = normalizeBuildingCountryLimits(building.countryBuildLimits);
  const row = limits.find((item) => item.countryId === countryId);
  return row ? row.limit : undefined;
}

export function getGlobalBuildLimit(building: BuildingMechanicsContentEntry): number | null {
  return typeof building.globalBuildLimit === "number" && Number.isFinite(building.globalBuildLimit)
    ? Math.max(1, Math.floor(building.globalBuildLimit))
    : null;
}

export function resolveBuildingOwnerFromPayload(params: {
  payload: Record<string, unknown>;
  requestedByCountryId: string;
  companyIds: Set<string>;
  countryIds: Set<string>;
}): BuildingOwner | null {
  const rawOwner = params.payload.owner;
  if (!rawOwner || typeof rawOwner !== "object") {
    return { type: "state", countryId: params.requestedByCountryId };
  }
  const source = rawOwner as Record<string, unknown>;
  const ownerType = source.type === "company" ? "company" : "state";
  if (ownerType === "company") {
    const companyId = typeof source.companyId === "string" ? source.companyId.trim() : "";
    if (!companyId || !params.companyIds.has(companyId)) return null;
    return { type: "company", companyId };
  }
  const countryId = typeof source.countryId === "string" ? source.countryId.trim() : params.requestedByCountryId;
  if (!countryId || !params.countryIds.has(countryId)) return null;
  return { type: "state", countryId };
}

export function createBuildingConstructionProject(params: {
  queueId: string;
  requestedByCountryId: string;
  building: BuildingMechanicsContentEntry;
  owner: BuildingOwner;
  turnId: number;
  costConstruction?: number;
}): RegionConstructionProject {
  const costConstruction =
    typeof params.costConstruction === "number" && Number.isFinite(params.costConstruction)
      ? params.costConstruction
      : Number(params.building.costConstruction ?? 100);
  return {
    queueId: params.queueId,
    requestedByCountryId: params.requestedByCountryId,
    buildingId: params.building.id,
    owner: params.owner,
    projectType: "build",
    progressConstruction: 0,
    costConstruction: Math.max(1, Math.floor(costConstruction)),
    costDucats: Math.max(0, Number(params.building.costDucats ?? 10)),
    createdTurnId: params.turnId,
  };
}

export function resolveBuildOrder<TBuilding extends BuildingMechanicsContentEntry>(params: {
  order: Order;
  playerId: string;
  worldBase: BuildingConstructionWorldState;
  buildingById: Map<string, TBuilding>;
  turnId: number;
  parseRequestedBuildingId: (payload: Record<string, unknown>) => string;
  resolveBuildingOwner: (payload: Record<string, unknown>, requestedByCountryId: string) => BuildingOwner | null;
  isCountryAllowedForBuilding: (building: TBuilding, countryId: string) => boolean;
  getProvinceBuildRestriction: (building: TBuilding, provinceId: string) => string | null;
  isBuildingUnlockedForCountry: (buildingId: string, countryId: string) => boolean;
  countBuildingOccurrences: (buildingId: string, countryId: string) => BuildLimitCounts;
  resolveConstructionCost: (building: TBuilding, context: {
    countryId: string;
    provinceId: string;
    buildingId: string;
  }) => number;
  createId: () => string;
}): BuildOrderResolution {
  const reject = (reason: string): BuildOrderResolution => ({
    rejectedOrder: { playerId: params.playerId, reason, tempOrderId: params.order.id },
    queuedProject: null,
  });
  if (params.order.type !== "BUILD") {
    return reject("BUILD_INVALID");
  }
  const owner = params.worldBase.regionController[params.order.regionId] ?? params.worldBase.regionOwner[params.order.regionId];
  if (!owner || owner !== params.order.countryId) {
    return reject("BUILD_CONFLICT");
  }

  const payload = (params.order.payload ?? {}) as Record<string, unknown>;
  const buildingId = params.parseRequestedBuildingId(payload);
  const building = params.buildingById.get(buildingId);
  const ownerForProject = params.resolveBuildingOwner(payload, params.order.countryId);
  if (!buildingId || !building || !ownerForProject) {
    return reject("BUILD_INVALID");
  }
  if (!params.isCountryAllowedForBuilding(building, params.order.countryId)) {
    return reject("BUILD_INVALID");
  }
  if (params.getProvinceBuildRestriction(building, params.order.regionId)) {
    return reject("BUILD_INVALID");
  }
  if (!params.isBuildingUnlockedForCountry(building.id, params.order.countryId)) {
    return reject("BUILD_LOCKED_BY_TECH");
  }

  const counts = params.countBuildingOccurrences(buildingId, params.order.countryId);
  const countryLimit = getCountryBuildLimit(building, params.order.countryId);
  const hasCountryLimitOverride = countryLimit !== undefined;
  const globalLimit = getGlobalBuildLimit(building);
  if (typeof countryLimit === "number" && counts.byCountry >= countryLimit) {
    return reject("BUILD_INVALID");
  }
  if (!hasCountryLimitOverride && globalLimit != null && counts.global >= globalLimit) {
    return reject("BUILD_INVALID");
  }

  const project = createBuildingConstructionProject({
    queueId: params.createId(),
    requestedByCountryId: params.order.countryId,
    building,
    owner: ownerForProject,
    turnId: params.turnId,
    costConstruction: params.resolveConstructionCost(building, {
      countryId: params.order.countryId,
      provinceId: params.order.regionId,
      buildingId: building.id,
    }),
  });
  const queue = [...(params.worldBase.regionConstructionQueueByRegion[params.order.regionId] ?? [])];
  queue.push(project);
  params.worldBase.regionConstructionQueueByRegion[params.order.regionId] = queue;
  return { rejectedOrder: null, queuedProject: project };
}

export function finalizeRegionBuildingTurn(params: {
  buildingInstances: BuildingInstance[];
  removedInstanceIds: Set<string>;
  previousPopulationTreasury: number;
  regionWages: number;
  regionResourceDeposits: RegionResourceDeposit[];
}): RegionBuildingTurnFinalizationResult {
  const activeBuildingInstances = params.buildingInstances.filter((instance) => !params.removedInstanceIds.has(instance.instanceId));
  for (const instance of activeBuildingInstances) {
    instance.lastNetDucats = roundBuildingNumber(
      Number(instance.lastRevenueDucats ?? 0) -
        Number(instance.lastInputCostDucats ?? 0) -
        Number(instance.lastWagesDucats ?? 0),
    );
  }

  const buildingDucatsByBuildingId: Record<string, number> = {};
  for (const instance of activeBuildingInstances) {
    buildingDucatsByBuildingId[instance.buildingId] = roundBuildingNumber(
      (buildingDucatsByBuildingId[instance.buildingId] ?? 0) + Number(instance.ducats ?? 0),
    );
  }

  return {
    activeBuildingInstances,
    populationTreasury: roundBuildingNumber(params.previousPopulationTreasury + params.regionWages),
    buildingDucatsByBuildingId,
    resourceDeposits: params.regionResourceDeposits
      .filter((row) => Number(row.amount) > 0)
      .sort((a, b) => a.goodId.localeCompare(b.goodId)),
  };
}

export function getBuildingMaxLevel(building: BuildingMechanicsContentEntry | undefined): number {
  const raw = Number(building?.maxLevel ?? 1);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
}

export function getBuildingMaxDurability(building: BuildingMechanicsContentEntry | undefined): number {
  const raw = Number(building?.maxDurability ?? DEFAULT_BUILDING_DURABILITY_MAX);
  if (!Number.isFinite(raw)) return DEFAULT_BUILDING_DURABILITY_MAX;
  return Math.max(1, Number(raw.toFixed(3)));
}

export function getBuildingUpgradeCosts(
  building: BuildingMechanicsContentEntry | undefined,
): { costConstruction: number; costDucats: number } {
  const baseConstruction = Math.max(1, Math.floor(Number(building?.costConstruction ?? 100)));
  const baseDucats = Math.max(0, Number(building?.costDucats ?? 10));
  const upgradeCostConstructionRaw = Number(building?.upgradeCostConstruction ?? baseConstruction);
  const upgradeCostDucatsRaw = Number(building?.upgradeCostDucats ?? baseDucats);
  return {
    costConstruction:
      Number.isFinite(upgradeCostConstructionRaw) && upgradeCostConstructionRaw > 0
        ? Math.max(1, Math.floor(upgradeCostConstructionRaw))
        : baseConstruction,
    costDucats: Number(
      (Number.isFinite(upgradeCostDucatsRaw) ? Math.max(0, upgradeCostDucatsRaw) : baseDucats).toFixed(3),
    ),
  };
}

export function getBuildingConstructionTotalCostByLevel(
  building: BuildingMechanicsContentEntry | undefined,
  levelRaw: number,
): number {
  const level = Math.max(1, Math.floor(Number(levelRaw)));
  const baseConstruction = Math.max(1, Math.floor(Number(building?.costConstruction ?? 100)));
  const upgradeCostConstruction = getBuildingUpgradeCosts(building).costConstruction;
  return baseConstruction + Math.max(0, level - 1) * upgradeCostConstruction;
}

export function enqueueBuildingAutoUpgradesTurn(params: {
  worldBase: BuildingConstructionWorldState;
  buildings: BuildingMechanicsContentEntry[];
  turnId: number;
  ensureCountryInWorldBase: (countryId: string) => void;
  createId?: () => string;
}): void {
  const createId = params.createId ?? randomUUID;
  const buildingById = new Map(params.buildings.map((entry) => [entry.id, entry] as const));
  for (const [regionId, instances] of Object.entries(params.worldBase.regionBuildingsByRegion ?? {})) {
    if (!Array.isArray(instances) || instances.length === 0) continue;
    const ownerCountryId = params.worldBase.regionController[regionId] ?? params.worldBase.regionOwner[regionId] ?? null;
    if (!ownerCountryId) continue;
    params.ensureCountryInWorldBase(ownerCountryId);

    const nextInstances = [...instances];
    const queue = [...(params.worldBase.regionConstructionQueueByRegion[regionId] ?? [])];
    let queueChanged = false;
    let instancesChanged = false;

    for (const instance of nextInstances) {
      const building = buildingById.get(instance.buildingId);
      if (!building) continue;
      if (instance.autoUpgradeEnabled === false) continue;
      if (instance.isInactive) continue;
      if (Math.max(0, Number(instance.currentDurability ?? 0)) <= 0) continue;
      if (Math.max(0, Number(instance.lastProductivity ?? 0)) <= 0) continue;
      const currentLevel = Math.max(1, Math.floor(Number(instance.level ?? 1)));
      instance.level = currentLevel;
      const maxLevel = getBuildingMaxLevel(building);
      if (currentLevel >= maxLevel) continue;

      const alreadyQueued = queue.some(
        (project) =>
          (project.projectType ?? "build") === "upgrade" &&
          (project.targetInstanceId ?? "") === instance.instanceId,
      );
      if (alreadyQueued) continue;

      const upgradeCosts = getBuildingUpgradeCosts(building);
      const instanceDucats = roundBuildingNumber(Math.max(0, Number(instance.ducats ?? 0)));
      if (instanceDucats + 1e-9 < upgradeCosts.costDucats) continue;

      instance.ducats = roundBuildingNumber(Math.max(0, instanceDucats - upgradeCosts.costDucats));
      instancesChanged = true;
      queue.push({
        queueId: createId(),
        requestedByCountryId: ownerCountryId,
        buildingId: instance.buildingId,
        owner: instance.owner,
        projectType: "upgrade",
        targetInstanceId: instance.instanceId,
        progressConstruction: 0,
        costConstruction: upgradeCosts.costConstruction,
        costDucats: 0,
        createdTurnId: params.turnId,
      });
      queueChanged = true;
    }

    if (instancesChanged) {
      params.worldBase.regionBuildingsByRegion[regionId] = nextInstances;
    }
    if (queueChanged) {
      params.worldBase.regionConstructionQueueByRegion[regionId] = queue;
    }
  }
}

export function resolveBuildingConstructionQueuesTurn(params: {
  worldBase: BuildingConstructionWorldState;
  buildings: BuildingMechanicsContentEntry[];
  turnId: number;
  createId?: () => string;
  addExpense?: (input: BuildingLedgerFlowInput) => void;
}): void {
  type ProjectRef = { regionId: string; index: number };
  const projectsByCountry = new Map<string, ProjectRef[]>();
  const EPS = 1e-6;
  const createId = params.createId ?? randomUUID;
  const buildingById = new Map(params.buildings.map((entry) => [entry.id, entry] as const));

  for (const [regionId, queue] of Object.entries(params.worldBase.regionConstructionQueueByRegion ?? {})) {
    if (!Array.isArray(queue) || queue.length === 0) continue;
    for (let index = 0; index < queue.length; index += 1) {
      const project = queue[index];
      if (!project) continue;
      if (project.progressConstruction >= project.costConstruction) continue;
      if ((params.worldBase.regionController[regionId] ?? params.worldBase.regionOwner[regionId] ?? null) !== project.requestedByCountryId) continue;
      const list = projectsByCountry.get(project.requestedByCountryId) ?? [];
      list.push({ regionId, index });
      projectsByCountry.set(project.requestedByCountryId, list);
    }
  }

  for (const [countryId, refs] of projectsByCountry.entries()) {
    const countryResource = params.worldBase.resourcesByCountry[countryId];
    if (!countryResource) continue;
    const availableConstruction = Math.max(0, Number(countryResource.construction ?? 0));
    if (availableConstruction <= 0 || refs.length === 0) continue;
    let remainingCountryDucats = Math.max(0, Number(countryResource.ducats ?? 0));
    let remainingConstruction = availableConstruction;
    let spentConstruction = 0;
    let spentDucats = 0;

    const sortedRefs = [...refs].sort(
      (a, b) =>
        a.regionId.localeCompare(b.regionId) ||
        (params.worldBase.regionConstructionQueueByRegion[a.regionId]?.[a.index]?.queueId ?? "").localeCompare(
          params.worldBase.regionConstructionQueueByRegion[b.regionId]?.[b.index]?.queueId ?? "",
        ),
    );

    let activeRefs = [...sortedRefs];
    while (remainingConstruction > EPS && activeRefs.length > 0) {
      const equalShare = remainingConstruction / activeRefs.length;
      let progressedInRound = 0;
      const nextActiveRefs: ProjectRef[] = [];
      for (const ref of activeRefs) {
        const queue = params.worldBase.regionConstructionQueueByRegion[ref.regionId];
        const project = queue?.[ref.index];
        if (!queue || !project) continue;
        const remainingProjectConstruction = Math.max(0, project.costConstruction - project.progressConstruction);
        if (remainingProjectConstruction <= EPS) continue;
        const ducatRatio = project.costConstruction > 0 ? project.costDucats / project.costConstruction : 0;
        const spentProjectDucats = project.progressConstruction * ducatRatio;
        const remainingProjectDucats = Math.max(0, project.costDucats - spentProjectDucats);
        const maxByCountryDucats = ducatRatio > 0 ? remainingCountryDucats / ducatRatio : Number.POSITIVE_INFINITY;
        const maxByProjectDucats = ducatRatio > 0 ? remainingProjectDucats / ducatRatio : Number.POSITIVE_INFINITY;
        const appliedConstruction = Math.min(
          equalShare,
          remainingProjectConstruction,
          maxByCountryDucats,
          maxByProjectDucats,
        );
        if (appliedConstruction <= EPS) continue;
        const appliedDucats =
          ducatRatio > 0
            ? Math.min(remainingProjectDucats, appliedConstruction * ducatRatio, remainingCountryDucats)
            : 0;
        project.progressConstruction = Number(
          Math.min(project.costConstruction, project.progressConstruction + appliedConstruction).toFixed(3),
        );
        spentConstruction += appliedConstruction;
        spentDucats += appliedDucats;
        remainingConstruction = Math.max(0, remainingConstruction - appliedConstruction);
        remainingCountryDucats = Math.max(0, remainingCountryDucats - appliedDucats);
        progressedInRound += appliedConstruction;

        const stillHasConstruction = project.costConstruction - project.progressConstruction > EPS;
        const canPayMore =
          ducatRatio <= 0 ||
          (remainingCountryDucats > EPS && project.costDucats - project.progressConstruction * ducatRatio > EPS);
        if (stillHasConstruction && canPayMore) {
          nextActiveRefs.push(ref);
        }
      }
      if (progressedInRound <= EPS) {
        break;
      }
      activeRefs = nextActiveRefs;
    }

    params.addExpense?.({
      countryId,
      resourceId: "construction",
      amount: spentConstruction,
      sourceType: "construction",
      sourceId: `construction:${countryId}`,
      categoryId: "construction",
      labelKey: "resourceLedger.source.construction.points",
    });
    params.addExpense?.({
      countryId,
      resourceId: "ducats",
      amount: spentDucats,
      sourceType: "construction",
      sourceId: `construction:${countryId}`,
      categoryId: "construction",
      labelKey: "resourceLedger.source.construction.ducats",
    });
    if (!params.addExpense) {
      countryResource.construction = Math.max(0, Number((countryResource.construction - spentConstruction).toFixed(3)));
      countryResource.ducats = Math.max(0, Number((countryResource.ducats - spentDucats).toFixed(3)));
    }
  }

  for (const [regionId, queue] of Object.entries(params.worldBase.regionConstructionQueueByRegion ?? {})) {
    if (!Array.isArray(queue) || queue.length === 0) continue;
    const nextQueue: RegionConstructionProject[] = [];
    const buildingInstances = [...(params.worldBase.regionBuildingsByRegion[regionId] ?? [])];
    for (const project of queue) {
      if (project.progressConstruction + 1e-9 >= project.costConstruction) {
        const building = buildingById.get(project.buildingId);
        if ((project.projectType ?? "build") === "upgrade") {
          const targetInstanceId = typeof project.targetInstanceId === "string" ? project.targetInstanceId.trim() : "";
          if (!targetInstanceId) {
            continue;
          }
          const targetInstance = buildingInstances.find(
            (instance) => instance.instanceId === targetInstanceId && instance.buildingId === project.buildingId,
          );
          if (!targetInstance) {
            continue;
          }
          const currentLevel = Math.max(1, Math.floor(Number(targetInstance.level ?? 1)));
          const maxLevel = getBuildingMaxLevel(building);
          if (currentLevel >= maxLevel) {
            continue;
          }
          targetInstance.level = Math.min(maxLevel, currentLevel + 1);
          continue;
        }
        const startingDucats = Math.max(0, Number(building?.startingDucats ?? 0));
        const maxDurability = getBuildingMaxDurability(building);
        const instance: BuildingInstance = {
          instanceId: createId(),
          buildingId: project.buildingId,
          owner: project.owner,
          createdTurnId: params.turnId,
          level: 1,
          currentDurability: maxDurability,
          autoUpgradeEnabled: true,
          stateSubsidiesEnabled: true,
          manualWorkEnabled: true,
          lastDurabilityCoverage: 1,
          lastStateSubsidyDucats: 0,
          ducats: Number(startingDucats.toFixed(3)),
        };
        buildingInstances.push(instance);
        continue;
      }
      nextQueue.push(project);
    }
    params.worldBase.regionBuildingsByRegion[regionId] = buildingInstances;
    params.worldBase.regionConstructionQueueByRegion[regionId] = nextQueue;
  }
}
