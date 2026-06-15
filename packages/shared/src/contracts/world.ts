import type { ResourceTotals } from "./core";
import type { DiplomacyProposal } from "./diplomacy";
import type { CountryDecisionRecord, CountryEventRecord } from "./content";
import type { Division, DivisionTemplate, MilitaryFormationQueueItem } from "./military";
import type { BuildingInstance, RegionConstructionProject, RegionPopulation, RegionResourceDeposit, RegionResourceExplorationProject } from "./region-state";
import type { CountryParliament, CountryTechnologyState } from "./politics";
export type WorldBase = {
  turnId: number;
  resourcesByCountry: Record<string, ResourceTotals>;
  regionOwner: Record<string, string>;
  regionController: Record<string, string>;
  provinceOwner: Record<string, string>;
  provinceNameById: Record<string, string>;
  colonyProgressByRegion: Record<string, Record<string, number>>;
  regionColonizationByRegion: Record<string, { cost: number; disabled: boolean; manualCost?: boolean }>;
  regionPopulationByRegion: Record<string, RegionPopulation>;
  regionBuildingsByRegion: Record<string, BuildingInstance[]>;
  regionBuildingDucatsByRegion: Record<string, Record<string, number>>;
  regionPopulationTreasuryByRegion: Record<string, number>;
  regionConstructionQueueByRegion: Record<string, RegionConstructionProject[]>;
  regionResourceDepositsByRegion: Record<string, RegionResourceDeposit[]>;
  regionResourceExplorationQueueByRegion: Record<string, RegionResourceExplorationProject[]>;
  regionResourceExplorationCountByRegion: Record<string, number>;
  parliamentByCountry: Record<string, CountryParliament>;
  technologyByCountry: Record<string, CountryTechnologyState>;
  countryDecisionsByCountryId: Record<string, CountryDecisionRecord>;
  countryEventsByCountryId: Record<string, CountryEventRecord>;
  divisionTemplatesByCountry: Record<string, DivisionTemplate[]>;
  divisionsById: Record<string, Division>;
  militaryFormationQueueByCountry: Record<string, MilitaryFormationQueueItem[]>;
  diplomacyProposals: DiplomacyProposal[];
};

export const WORLD_DELTA_MASK = {
  resourcesByCountry: 1 << 0,
  provinceOwner: 1 << 1,
  provinceNameById: 1 << 2,
  colonyProgressByRegion: 1 << 3,
  regionColonizationByRegion: 1 << 4,
  regionPopulationByRegion: 1 << 5,
  regionBuildingsByRegion: 1 << 6,
  regionPopulationTreasuryByRegion: 1 << 7,
  regionBuildingDucatsByRegion: 1 << 8,
  regionConstructionQueueByRegion: 1 << 9,
  regionResourceDepositsByRegion: 1 << 11,
  regionResourceExplorationQueueByRegion: 1 << 12,
  regionResourceExplorationCountByRegion: 1 << 13,
  parliamentByCountry: 1 << 14,
  technologyByCountry: 1 << 15,
  countryDecisionsByCountryId: 1 << 16,
  countryEventsByCountryId: 1 << 17,
  divisionTemplatesByCountry: 1 << 18,
  divisionsById: 1 << 19,
  militaryFormationQueueByCountry: 1 << 20,
  diplomacyProposals: 1 << 21,
  regionOwner: 1 << 22,
  regionController: 1 << 23,
} as const;

export type WorldDelta = {
  type: "WORLD_DELTA";
  turnId: number;
  worldStateVersion: number;
  mask: number;
  c?: Record<string, ResourceTotals | null>;
  a?: Record<string, string | null>;
  f?: Record<string, string | null>;
  o?: Record<string, string | null>;
  n?: Record<string, string | null>;
  p?: Record<string, Record<string, number> | null>;
  z?: Record<string, { cost: number; disabled: boolean; manualCost?: boolean } | null>;
  u?: Record<string, RegionPopulation | null>;
  b?: Record<string, BuildingInstance[] | null>;
  y?: Record<string, number | null>;
  q?: Record<string, Record<string, number> | null>;
  r?: Record<string, RegionConstructionProject[] | null>;
  t?: Record<string, RegionResourceDeposit[] | null>;
  e?: Record<string, RegionResourceExplorationProject[] | null>;
  k?: Record<string, number | null>;
  m?: Record<string, CountryParliament | null>;
  h?: Record<string, CountryTechnologyState | null>;
  d?: Record<string, CountryDecisionRecord | null>;
  v?: Record<string, CountryEventRecord | null>;
  g?: Record<string, DivisionTemplate[] | null>;
  x?: Record<string, Division | null>;
  w?: Record<string, MilitaryFormationQueueItem[] | null>;
  j?: DiplomacyProposal[];
  rejectedOrders: Array<{ playerId: string; reason: string; tempOrderId?: string }>;
};
