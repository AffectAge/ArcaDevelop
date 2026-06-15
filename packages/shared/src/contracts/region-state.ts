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
  owner: BuildingOwner;
  projectType?: "build" | "upgrade";
  targetInstanceId?: string;
  progressConstruction: number;
  costConstruction: number;
  costDucats: number;
  createdTurnId: number;
};

export type RegionResourceDeposit = {
  goodId: string;
  amount: number;
  discoveredTurnId: number;
  veinSize: "small" | "medium" | "large";
};

export type RegionResourceExplorationProject = {
  queueId: string;
  requestedByCountryId: string;
  startedTurnId: number;
  turnsRemaining: number;
};
