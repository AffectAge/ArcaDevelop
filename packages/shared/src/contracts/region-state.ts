import type { HexId, MapTagQuery, RegionId } from "./hex-map";

export type PopulationProfessionState = {
  size: number;
  ducats: number;
  standardOfLiving: number;
  radicals: number;
  loyalists: number;
  lastIncomeDucats: number;
  lastNeedsSpendDucats: number;
  lastNeedsSatisfaction: number;
  lastNeedsByCategory?: Record<string, {
    required: number;
    fulfilled: number;
    spend: number;
    satisfaction: number;
  }>;
  lastNeedsDeficitByGood?: Record<string, number>;
  lastNeedsBudgetShortageByGood?: Record<string, number>;
  lastBirths: number;
  lastDeaths: number;
};

export type PopulationPop = {
  id: string;
  size: number;
  cultureId: string;
  religionId: string;
  raceId: string;
  ideologies: Record<string, number>;
  professions: Record<string, PopulationProfessionState>;
};

export type RegionPopulation = {
  pops: PopulationPop[];
};

export type BuildingOwner =
  | { type: "state"; countryId: string }
  | { type: "company"; companyId: string };

export type BuildingInstance = {
  instanceId: string;
  buildingId: string;
  targetHexId: string;
  customName?: string | null;
  owner: BuildingOwner;
  createdTurnId: number;
  level?: number;
  currentDurability?: number;
  autoUpgradeEnabled?: boolean;
  stateSubsidiesEnabled?: boolean;
  manualWorkEnabled?: boolean;
  ducats?: number;
  warehouseByGoodId?: Record<string, number>;
  lastLaborCoverage?: number;
  lastInfraCoverage?: number;
  lastInputCoverage?: number;
  lastFinanceCoverage?: number;
  lastExtractionCoverage?: number;
  lastDurabilityCoverage?: number;
  lastProductivity?: number;
  lastPurchaseByGoodId?: Record<string, number>;
  lastPurchaseCostByGoodId?: Record<string, number>;
  lastSalesByGoodId?: Record<string, number>;
  lastSalesRevenueByGoodId?: Record<string, number>;
  lastConsumptionByGoodId?: Record<string, number>;
  lastProductionByGoodId?: Record<string, number>;
  lastExtractionByGoodId?: Record<string, number>;
  lastRevenueDucats?: number;
  lastInputCostDucats?: number;
  lastWagesDucats?: number;
  lastStateSubsidyDucats?: number;
  lastNetDucats?: number;
  isInactive?: boolean;
  inactiveReason?: string | null;
};

export type RegionConstructionProject = {
  queueId: string;
  requestedByCountryId: string;
  buildingId: string;
  targetHexId: string;
  owner: BuildingOwner;
  projectType?: "build" | "upgrade";
  targetInstanceId?: string;
  progressConstruction: number;
  costConstruction: number;
  costDucats: number;
  createdTurnId: number;
};

export type RegionResourceDeposit = {
  id: MapResourceDepositInstanceId;
  goodId: string;
  hexId: HexId;
  regionId: RegionId;
  amount: number;
  maxAmount: number;
  initialAmount: number;
  visibility: MapResourceDepositVisibility;
  source: MapResourceDepositSource;
  depletionMode: DepositDepletionMode;
  regenPerTurn?: number | null;
  minRenewableAmount?: number | null;
  discoveredTurnId?: number | null;
  discoveredByCountryId?: string | null;
  sourceGeneratorId?: string | null;
};

export type RegionResourceExplorationProject = {
  queueId: string;
  requestedByCountryId: string;
  startedTurnId: number;
  turnsRemaining: number;
};

export type DepositDepletionMode = "finite" | "renewable" | "infinite";

export type MapResourceDepositInstanceId = `resource_deposit:${string}`;

export type MapResourceDepositVisibility = "known" | "discoverable" | "hidden";

export type MapResourceDepositSource = "authored" | "generated" | "exploration";

export type GoodDepositCountRule = {
  min?: number;
  max?: number;
  count?: number;
};

export type GoodDepositGenerationRules = {
  allowedHexTypes?: string[];
  deniedHexTypes?: string[];
  allowedClimates?: string[];
  deniedClimates?: string[];
  allowedLandscapes?: string[];
  deniedLandscapes?: string[];
  allowedFeatures?: string[];
  deniedFeatures?: string[];
  elevationMin?: number | null;
  elevationMax?: number | null;
  tagQuery?: MapTagQuery | null;
  global?: GoodDepositCountRule;
  perRegion?: GoodDepositCountRule;
};

export type GoodDepositDefinition = {
  enabled: boolean;
  depletionMode: DepositDepletionMode;
  minAmount: number;
  maxAmount: number;
  regenPerTurn?: number | null;
  minRenewableAmount?: number | null;
  visibility?: MapResourceDepositVisibility;
  generation?: GoodDepositGenerationRules | null;
};

export type BuildingDepositRequirement = {
  goodIds: string[];
};

export type ResourceExplorationProjectDraft = {
  regionId: string;
  requestedByCountryId: string;
  candidateGoodIds?: string[];
};

export type ResourceExplorationResult = {
  regionId: string;
  hexId: string;
  goodId: string;
  amount: number;
  maxAmount?: number | null;
  visibility?: MapResourceDepositVisibility;
  discoveredTurnId?: number | null;
  discoveredByCountryId?: string | null;
};
