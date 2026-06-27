import type {
  BuildingAdjacencyEffect,
  BuildingPlacementRules,
  DecisionDefinition,
  DivisionStats,
  GameEventDefinition,
  JournalEntryDefinition,
  IdeologyAttractionRule,
  LawParliamentPowerEffect,
  ModifierDefinition,
  TreatyConstructionExpirationPolicy,
} from "@arcanorum/shared";
import type { BuildingCountryLimit, PollutionProductivityMode } from "../mechanics/buildingMechanics";
import type { GoodDistributionType, GoodTransportMode } from "../mechanics/marketTurnMechanics";
import type { CultureNeedsProfile } from "../mechanics/populationMechanics";
import type { BuildingExtractionFlow, GoodFlow, WorkforceRequirement } from "../mechanics/contentFieldNormalizers";

export type GameContentEntry = {
  id: string;
  nameKey?: string | null;
  name: string;
  description: string;
  color: string;
  logoUrl: string | null;
  malePortraitUrl: string | null;
  femalePortraitUrl: string | null;
  baseWage?: number | null;
  needsProfile?: CultureNeedsProfile | null;
  ideologyWeights?: Record<string, number>;
  interestGroupWeights?: Record<string, number>;
  professionWeights?: Record<string, number>;
  religionWeights?: Record<string, number>;
  buildingWeights?: Record<string, number>;
  lawPreferences?: Record<string, number>;
  discipline?: number | null;
  basePoliticalStrength?: number | null;
  solMultiplier?: number | null;
  radicalMultiplier?: number | null;
  loyalistMultiplier?: number | null;
  defaultPartyId?: string | null;
  lawGroupId?: string | null;
  defaultLawId?: string | null;
  order?: number | null;
  enactmentDifficulty?: number | null;
  votingDurationTurns?: number | null;
  parliamentPower?: LawParliamentPowerEffect | null;
  costScience?: number | null;
  prerequisiteTechnologyIds?: string[];
  unlockBuildingIds?: string[];
  unlockLawIds?: string[];
  modifiers?: ModifierDefinition[];
  decision?: DecisionDefinition | null;
  event?: GameEventDefinition | null;
  journalEntry?: JournalEntryDefinition | null;
  ideologyAttractionRules?: IdeologyAttractionRule[];
};

export type GoodContentEntry = GameContentEntry & {
  resourceCategoryId?: string | null;
  isResourceDiscoverable?: boolean | null;
  basePrice?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  infraPerUnit?: number | null;
  infrastructureCostPerUnit?: number | null;
  distributionType?: GoodDistributionType | null;
  transportModes?: GoodTransportMode[];
  explorationBaseWeight?: number | null;
  explorationSmallVeinChancePct?: number | null;
  explorationMediumVeinChancePct?: number | null;
  explorationLargeVeinChancePct?: number | null;
  explorationSmallVeinMin?: number | null;
  explorationSmallVeinMax?: number | null;
  explorationMediumVeinMin?: number | null;
  explorationMediumVeinMax?: number | null;
  explorationLargeVeinMin?: number | null;
  explorationLargeVeinMax?: number | null;
};

export type BuildingContentEntry = GameContentEntry & {
  sectorId?: string | null;
  industryId?: string | null;
  costConstruction?: number | null;
  costDucats?: number | null;
  startingDucats?: number | null;
  maxLevel?: number | null;
  maxDurability?: number | null;
  upgradeCostDucats?: number | null;
  upgradeCostConstruction?: number | null;
  extractionGoodId?: string | null;
  extractionAmountPerTurn?: number | null;
  extractionRequiresDeposit?: boolean | null;
  extractions?: BuildingExtractionFlow[];
  inputs?: GoodFlow[];
  outputs?: GoodFlow[];
  workforceRequirements?: WorkforceRequirement[];
  allowedCountryIds?: string[];
  deniedCountryIds?: string[];
  allowedHexTypes?: string[];
  deniedHexTypes?: string[];
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
  placement?: BuildingPlacementRules | null;
  adjacencyEffects?: BuildingAdjacencyEffect[] | null;
};

export type BattalionContentEntry = GameContentEntry & DivisionStats & {
  trainingCostDucats?: number | null;
  trainingCostManpower?: number | null;
  equipmentNeeds?: GoodFlow[];
};

export type MilitaryContentEntry = BattalionContentEntry;

export type DefaultBattalionKind = "infantry" | "archers" | "cavalry" | "artillery" | "mages" | "constructs" | "support";

export type MarketTradePolicyEntry = {
  allowImportFromWorld?: boolean;
  allowExportToWorld?: boolean;
  maxImportAmountPerTurnFromWorld?: number | null;
  maxExportAmountPerTurnToWorld?: number | null;
  overridesByCountryId?: Record<
    string,
    {
      allowImportFromWorld?: boolean;
      allowExportToWorld?: boolean;
      maxImportAmountPerTurnFromWorld?: number | null;
      maxExportAmountPerTurnToWorld?: number | null;
    }
  >;
  overridesByMarketId?: Record<
    string,
    {
      allowImportFromWorld?: boolean;
      allowExportToWorld?: boolean;
      maxImportAmountPerTurnFromWorld?: number | null;
      maxExportAmountPerTurnToWorld?: number | null;
    }
  >;
};

export type MarketSanctionEntry = {
  id: string;
  initiatorCountryId: string;
  direction: "import" | "export" | "both";
  targetType: "country" | "market";
  targetId: string;
  goods?: string[];
  mode: "ban" | "cap";
  capAmountPerTurn?: number | null;
  startTurn: number;
  durationTurns: number;
  enabled?: boolean;
};

export type InfrastructureTransitAgreementEntry = {
  id: string;
  fromCountryId: string;
  toCountryId: string;
  transportModes: GoodTransportMode[];
  active: boolean;
  bilateral: boolean;
  sourceProposalId?: string | null;
  sourceClauseId?: string | null;
  expiresTurnId?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type InfrastructureConstructionRightsEntry = {
  id: string;
  fromCountryId: string;
  toCountryId: string;
  transportModes: GoodTransportMode[];
  active: boolean;
  bilateral: boolean;
  expirationPolicy: TreatyConstructionExpirationPolicy;
  sourceProposalId?: string | null;
  sourceClauseId?: string | null;
  expiresTurnId?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TransportCorridorStatus = "building" | "active" | "closed";

export type TransportCorridorRoutePoint = {
  hexId: string;
  lng: number;
  lat: number;
};

export type TransportCorridorEntry = {
  id: string;
  marketId: string;
  ownerCountryId: string;
  hexIds: string[];
  routePoints?: TransportCorridorRoutePoint[];
  transportMode: GoodTransportMode;
  level: number;
  status: TransportCorridorStatus;
  progressConstruction: number;
  costConstruction: number;
  lastLoadByMode?: Record<string, number>;
  lastCapacityByMode?: Record<string, number>;
  lastLoadHistoryByMode?: Record<string, number[]>;
  foreignConstructionRights?: Array<{
    hexId: string;
    grantorCountryId: string;
    agreementId: string;
    expirationPolicy: TreatyConstructionExpirationPolicy;
    sourceProposalId?: string | null;
    sourceClauseId?: string | null;
  }>;
  nationalizedAt?: string | null;
  nationalizedFromCountryId?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type GameSettings = {
  content: {
    races: GameContentEntry[];
    resourceCategories: GameContentEntry[];
    hexTypes: GameContentEntry[];
    hexClimates: GameContentEntry[];
    hexLandscapes: GameContentEntry[];
    hexContinents: GameContentEntry[];
    hexStrategicRegions: GameContentEntry[];
    professions: GameContentEntry[];
    ideologies: GameContentEntry[];
    interestGroups: GameContentEntry[];
    parties: GameContentEntry[];
    lawGroups: GameContentEntry[];
    laws: GameContentEntry[];
    religions: GameContentEntry[];
    technologies: GameContentEntry[];
    buildings: BuildingContentEntry[];
    goods: GoodContentEntry[];
    companies: GameContentEntry[];
    industries: GameContentEntry[];
    sectors: GameContentEntry[];
    cultures: GameContentEntry[];
    modifiers: GameContentEntry[];
    decisions: GameContentEntry[];
    events: GameContentEntry[];
    journalEntries: GameContentEntry[];
    battalions: BattalionContentEntry[];
    shipTypes: MilitaryContentEntry[];
    aircraftTypes: MilitaryContentEntry[];
  };
  ai: {
    enabled: boolean;
    maxCountriesPerTick: number;
    maxDecisionCandidatesPerCountry: number;
    contextCacheTtlTurns: number;
    maxBuildCompletionTurns: number;
  };
  civilopedia: {
    categories: string[];
    entries: Array<{
      id: string;
      category: string;
      title: string;
      summary: string;
      keywords: string[];
      imageUrl: string | null;
      relatedEntryIds: string[];
      sections: Array<{ title: string; paragraphs: string[] }>;
    }>;
  };
  economy: {
    baseCulturePerTurn: number;
    baseSciencePerTurn: number;
    baseReligionPerTurn: number;
    baseConstructionPerTurn: number;
    baseDucatsPerTurn: number;
    baseGoldPerTurn: number;
    demolitionCostConstructionPercent: number;
    marketPriceSmoothing: number;
    buildingDurabilityDecayPerTurn: number;
    buildingDurabilityRecoveryPerTurn: number;
    pollutionProductivityEffectPer1000: number;
    explorationBaseEmptyChancePct: number;
    explorationDepletionPerAttemptPct: number;
    explorationDurationTurns: number;
    explorationRollsPerExpedition: number;
  };
    markets: {
      countryMarketByCountryId: Record<string, string>;
      marketById: Record<
      string,
      {
        id: string;
        name: string;
        logoUrl: string | null;
        ownerCountryId: string;
        capitalHexId?: string | null;
        memberCountryIds: string[];
        visibility: "public" | "private";
        createdAt: string;
        warehouseByResourceId?: Record<string, number>;
        priceByResourceId?: Record<string, number>;
        priceHistoryByResourceId?: Record<string, number[]>;
        demandHistoryByResourceId?: Record<string, number[]>;
        offerHistoryByResourceId?: Record<string, number[]>;
        productionFactHistoryByResourceId?: Record<string, number[]>;
        productionMaxHistoryByResourceId?: Record<string, number[]>;
        worldTradePolicyByResourceId?: Record<string, MarketTradePolicyEntry>;
        resourceTradePolicyByCountryId?: Record<string, Record<string, MarketTradePolicyEntry>>;
      }
    >;
    transportCorridorsById: Record<string, TransportCorridorEntry>;
    marketInvitesById: Record<
      string,
      {
        id: string;
        marketId: string;
        fromCountryId: string;
        toCountryId: string;
        kind: "invite" | "join-request";
        status: "pending" | "accepted" | "rejected" | "canceled";
        expiresAt: string;
        createdAt: string;
        updatedAt: string;
      }
    >;
    sanctionsById: Record<string, MarketSanctionEntry>;
    infrastructureTransitAgreementsById: Record<string, InfrastructureTransitAgreementEntry>;
    infrastructureConstructionRightsById: Record<string, InfrastructureConstructionRightsEntry>;
  };
  colonization: {
    maxActiveColonizations: number;
    pointsPerTurn: number;
    pointsCostPer1000Km2: number;
    ducatsCostPer1000Km2: number;
    settlementEnabled: boolean;
    settlementPopulationOnCapture: number;
  };
  customization: {
    renameDucats: number;
    recolorDucats: number;
    flagDucats: number;
    crestDucats: number;
    hexRenameDucats: number;
  };
  military: {
    militaryFormationSpeed: number;
  };
  registration: {
    requireAdminApproval: boolean;
  };
  eventLog: {
    retentionTurns: number;
  };
  resourceLedger: {
    retentionTurns: number;
    maxEntriesPerTurn: number;
  };
  auditLog: {
    maxEntries: number;
    retentionTurns: number | null;
  };
  turnTimer: {
    enabled: boolean;
    secondsPerTurn: number;
    pauseWhenNoPlayersOnline: boolean;
  };
  map: {
    showAntarctica: boolean;
    backgroundImageUrl: string | null;
  };
};
