import type { ResourceTotals } from "./core";
import type { ResourceFlow } from "./resource-ledger";
import type { DiplomacyProposal } from "./diplomacy";
import type { CountryAppliedModifier, CountryDecisionRecord, CountryEventRecord, CountryJournalState, ExplanationRecord, ScheduledCountryEvent } from "./content";
import type { CivilianUnit, CivilianUnitQueueItem, CityMarker, SettlementProject } from "./unit-equipment";
import type { MapUnit, UnitTrainingQueueItem } from "./units";
import type { BuildingInstance, RegionConstructionProject, RegionPopulation, RegionResourceDeposit, RegionResourceExplorationProject } from "./region-state";
import type { CountryParliament, CountryTechnologyState } from "./politics";

export type CountryPopulationAcceptance = {
  acceptedCultureIds: string[];
  acceptedReligionIds: string[];
  acceptedRaceIds: string[];
};

export type CountryIdentityState = {
  cultureId: string;
  religionId: string;
  raceId: string;
  cultureGroupId: string;
  religionGroupId: string;
};

export type WorldBase = {
  turnId: number;
  resourcesByCountry: Record<string, ResourceTotals>;
  resourceLedgerByTurn: Record<number, ResourceFlow[]>;
  explanationRecordsByTurn: Record<number, ExplanationRecord[]>;
  regionOwner: Record<string, string>;
  regionController: Record<string, string>;
  hexOwner: Record<string, string>;
  hexNameById: Record<string, string>;
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
  countryScheduledEventsByCountryId: Record<string, ScheduledCountryEvent[]>;
  countryEventFlagsByCountryId: Record<string, Record<string, string | number | boolean>>;
  journalEntriesByCountryId: Record<string, CountryJournalState>;
  countryModifiersByCountryId: Record<string, CountryAppliedModifier[]>;
  countryPopulationAcceptanceByCountryId?: Record<string, CountryPopulationAcceptance>;
  countryIdentityByCountryId?: Record<string, CountryIdentityState>;
  unitsById?: Record<string, MapUnit>;
  unitTrainingQueueByCountry?: Record<string, UnitTrainingQueueItem[]>;
  civilianUnitsById: Record<string, CivilianUnit>;
  civilianUnitQueueByCountry: Record<string, CivilianUnitQueueItem[]>;
  settlementProjectsById: Record<string, SettlementProject>;
  cityMarkersById: Record<string, CityMarker>;
  diplomacyProposals: DiplomacyProposal[];
};

export const WORLD_DELTA_MASK = {
  resourcesByCountry: 1 << 0,
  hexOwner: 1 << 1,
  hexNameById: 1 << 2,
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
  diplomacyProposals: 1 << 21,
  regionOwner: 1 << 22,
  regionController: 1 << 23,
  resourceLedgerByTurn: 1 << 24,
  countryScheduledEventsByCountryId: 1 << 25,
  countryEventFlagsByCountryId: 1 << 26,
  journalEntriesByCountryId: 1 << 27,
  explanationRecordsByTurn: 1 << 28,
  countryModifiersByCountryId: 1 << 29,
  unitState: 1 << 30,
} as const;

export type WorldDelta = {
  type: "WORLD_DELTA";
  turnId: number;
  worldStateVersion: number;
  mask: number;
  c?: Record<string, ResourceTotals | null>;
  l?: Record<number, ResourceFlow[] | null>;
  xr?: Record<number, ExplanationRecord[] | null>;
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
  s?: Record<string, ScheduledCountryEvent[] | null>;
  xg?: Record<string, Record<string, string | number | boolean> | null>;
  jo?: Record<string, CountryJournalState | null>;
  cm?: Record<string, CountryAppliedModifier[] | null>;
  mu?: Record<string, MapUnit | null>;
  uq?: Record<string, UnitTrainingQueueItem[] | null>;
  cu?: Record<string, CivilianUnit | null>;
  cq?: Record<string, CivilianUnitQueueItem[] | null>;
  sp?: Record<string, SettlementProject | null>;
  ci?: Record<string, CityMarker | null>;
  j?: DiplomacyProposal[];
  rejectedOrders: Array<{ playerId: string; reason: string; tempOrderId?: string }>;
};
