import type { WorldBase } from "@arcanorum/shared";
import type {
  DiplomacyProposal,
  ResourceTotals,
} from "@arcanorum/shared";

type RestorePersistedWorldBaseParams = {
  input: unknown;
  turnId: number;
  defaultWorldBase: (turnId: number) => WorldBase;
  normalizeResourcesByCountryMap: (input: unknown) => Record<string, ResourceTotals>;
  normalizeResourceLedgerByTurn: (input: unknown) => WorldBase["resourceLedgerByTurn"];
  normalizeExplanationRecordsByTurn: (input: unknown) => WorldBase["explanationRecordsByTurn"];
  normalizeRegionColonizationMap: (input: unknown) => WorldBase["regionColonizationByRegion"];
  normalizeRegionPopulationMap: (input: unknown) => WorldBase["regionPopulationByRegion"];
  normalizeRegionBuildingsMap: (input: unknown) => WorldBase["regionBuildingsByRegion"];
  normalizeRegionBuildingDucatsMap: (input: unknown) => WorldBase["regionBuildingDucatsByRegion"];
  normalizeRegionPopulationTreasuryMap: (input: unknown) => WorldBase["regionPopulationTreasuryByRegion"];
  normalizeRegionConstructionQueueMap: (input: unknown) => WorldBase["regionConstructionQueueByRegion"];
  normalizeRegionResourceDepositsMap: (input: unknown) => WorldBase["regionResourceDepositsByRegion"];
  normalizeRegionResourceExplorationQueueMap: (input: unknown) => WorldBase["regionResourceExplorationQueueByRegion"];
  normalizeRegionResourceExplorationCountMap: (input: unknown) => WorldBase["regionResourceExplorationCountByRegion"];
  normalizeTechnologyByCountryMap: (input: unknown) => WorldBase["technologyByCountry"];
  normalizeCountryDecisionsMap: (input: unknown) => WorldBase["countryDecisionsByCountryId"];
  normalizeCountryEventsMap: (input: unknown) => WorldBase["countryEventsByCountryId"];
  normalizeScheduledCountryEventsMap: (input: unknown) => WorldBase["countryScheduledEventsByCountryId"];
  normalizeCountryEventFlagsMap: (input: unknown) => WorldBase["countryEventFlagsByCountryId"];
  normalizeJournalEntriesMap: (input: unknown) => WorldBase["journalEntriesByCountryId"];
  normalizeCountryModifiersMap: (input: unknown) => WorldBase["countryModifiersByCountryId"];
  normalizeDivisionTemplatesByCountry: (input: unknown) => WorldBase["divisionTemplatesByCountry"];
  normalizeDivisionsById: (input: unknown, base: WorldBase) => WorldBase["divisionsById"];
  normalizeMilitaryFormationQueueByCountry: (input: unknown) => WorldBase["militaryFormationQueueByCountry"];
  normalizeDiplomacyProposals: (input: unknown) => DiplomacyProposal[];
};

export function restorePersistedWorldBase(params: RestorePersistedWorldBaseParams): WorldBase {
  if (!params.input || typeof params.input !== "object") {
    return params.defaultWorldBase(params.turnId);
  }

  const candidate = params.input as Partial<WorldBase>;
  assertNoRemovedHexHeavyState(candidate as Record<string, unknown>);
  if (
    !candidate.resourcesByCountry ||
    typeof candidate.resourcesByCountry !== "object" ||
    !candidate.regionOwner ||
    typeof candidate.regionOwner !== "object" ||
    !candidate.regionController ||
    typeof candidate.regionController !== "object" ||
    !candidate.hexOwner ||
    typeof candidate.hexOwner !== "object" ||
    !candidate.colonyProgressByRegion ||
    typeof candidate.colonyProgressByRegion !== "object"
  ) {
    return params.defaultWorldBase(params.turnId);
  }

  const restored: WorldBase = {
    turnId: params.turnId,
    resourcesByCountry: params.normalizeResourcesByCountryMap(candidate.resourcesByCountry),
    resourceLedgerByTurn: params.normalizeResourceLedgerByTurn(
      (candidate as Partial<WorldBase> & { resourceLedgerByTurn?: unknown }).resourceLedgerByTurn,
    ),
    explanationRecordsByTurn: params.normalizeExplanationRecordsByTurn(
      (candidate as Partial<WorldBase> & { explanationRecordsByTurn?: unknown }).explanationRecordsByTurn,
    ),
    regionOwner: candidate.regionOwner as Record<string, string>,
    regionController: candidate.regionController as Record<string, string>,
    hexOwner: candidate.hexOwner,
    hexNameById:
      candidate.hexNameById && typeof candidate.hexNameById === "object"
        ? (candidate.hexNameById as Record<string, string>)
        : {},
    colonyProgressByRegion: candidate.colonyProgressByRegion,
    regionColonizationByRegion: params.normalizeRegionColonizationMap(
      (candidate as Partial<WorldBase> & { regionColonizationByRegion?: unknown }).regionColonizationByRegion,
    ),
    regionPopulationByRegion: params.normalizeRegionPopulationMap(
      (candidate as Partial<WorldBase> & { regionPopulationByRegion?: unknown }).regionPopulationByRegion,
    ),
    regionBuildingsByRegion: params.normalizeRegionBuildingsMap(
      (candidate as Partial<WorldBase> & { regionBuildingsByRegion?: unknown }).regionBuildingsByRegion,
    ),
    regionBuildingDucatsByRegion: params.normalizeRegionBuildingDucatsMap(
      (candidate as Partial<WorldBase> & { regionBuildingDucatsByRegion?: unknown }).regionBuildingDucatsByRegion,
    ),
    regionPopulationTreasuryByRegion: params.normalizeRegionPopulationTreasuryMap(
      (candidate as Partial<WorldBase> & { regionPopulationTreasuryByRegion?: unknown }).regionPopulationTreasuryByRegion,
    ),
    regionConstructionQueueByRegion: params.normalizeRegionConstructionQueueMap(
      (candidate as Partial<WorldBase> & { regionConstructionQueueByRegion?: unknown }).regionConstructionQueueByRegion,
    ),
    regionResourceDepositsByRegion: params.normalizeRegionResourceDepositsMap(
      (candidate as Partial<WorldBase> & { regionResourceDepositsByRegion?: unknown }).regionResourceDepositsByRegion,
    ),
    regionResourceExplorationQueueByRegion: params.normalizeRegionResourceExplorationQueueMap(
      (candidate as Partial<WorldBase> & { regionResourceExplorationQueueByRegion?: unknown }).regionResourceExplorationQueueByRegion,
    ),
    regionResourceExplorationCountByRegion: params.normalizeRegionResourceExplorationCountMap(
      (candidate as Partial<WorldBase> & { regionResourceExplorationCountByRegion?: unknown }).regionResourceExplorationCountByRegion,
    ),
    parliamentByCountry:
      candidate.parliamentByCountry && typeof candidate.parliamentByCountry === "object"
        ? (candidate.parliamentByCountry as WorldBase["parliamentByCountry"])
        : {},
    technologyByCountry: params.normalizeTechnologyByCountryMap(
      (candidate as Partial<WorldBase> & { technologyByCountry?: unknown }).technologyByCountry,
    ),
    countryDecisionsByCountryId: params.normalizeCountryDecisionsMap(
      (candidate as Partial<WorldBase> & { countryDecisionsByCountryId?: unknown }).countryDecisionsByCountryId,
    ),
    countryEventsByCountryId: params.normalizeCountryEventsMap(
      (candidate as Partial<WorldBase> & { countryEventsByCountryId?: unknown }).countryEventsByCountryId,
    ),
    countryScheduledEventsByCountryId: params.normalizeScheduledCountryEventsMap(
      (candidate as Partial<WorldBase> & { countryScheduledEventsByCountryId?: unknown }).countryScheduledEventsByCountryId,
    ),
    countryEventFlagsByCountryId: params.normalizeCountryEventFlagsMap(
      (candidate as Partial<WorldBase> & { countryEventFlagsByCountryId?: unknown }).countryEventFlagsByCountryId,
    ),
    journalEntriesByCountryId: params.normalizeJournalEntriesMap(
      (candidate as Partial<WorldBase> & { journalEntriesByCountryId?: unknown }).journalEntriesByCountryId,
    ),
    countryModifiersByCountryId: params.normalizeCountryModifiersMap(
      (candidate as Partial<WorldBase> & { countryModifiersByCountryId?: unknown }).countryModifiersByCountryId,
    ),
    divisionTemplatesByCountry: params.normalizeDivisionTemplatesByCountry(
      (candidate as Partial<WorldBase> & { divisionTemplatesByCountry?: unknown }).divisionTemplatesByCountry,
    ),
    divisionsById: {},
    fleetsById: normalizeRecord(
      (candidate as Partial<WorldBase> & { fleetsById?: unknown }).fleetsById,
    ) as WorldBase["fleetsById"],
    airWingsById: normalizeRecord(
      (candidate as Partial<WorldBase> & { airWingsById?: unknown }).airWingsById,
    ) as WorldBase["airWingsById"],
    militaryFormationQueueByCountry: params.normalizeMilitaryFormationQueueByCountry(
      (candidate as Partial<WorldBase> & { militaryFormationQueueByCountry?: unknown }).militaryFormationQueueByCountry,
    ),
    civilianUnitsById: normalizeRecord(
      (candidate as Partial<WorldBase> & { civilianUnitsById?: unknown }).civilianUnitsById,
    ) as WorldBase["civilianUnitsById"],
    civilianUnitQueueByCountry: normalizeRecord(
      (candidate as Partial<WorldBase> & { civilianUnitQueueByCountry?: unknown }).civilianUnitQueueByCountry,
    ) as WorldBase["civilianUnitQueueByCountry"],
    settlementProjectsById: normalizeRecord(
      (candidate as Partial<WorldBase> & { settlementProjectsById?: unknown }).settlementProjectsById,
    ) as WorldBase["settlementProjectsById"],
    cityMarkersById: normalizeRecord(
      (candidate as Partial<WorldBase> & { cityMarkersById?: unknown }).cityMarkersById,
    ) as WorldBase["cityMarkersById"],
    equipmentVariantsById: normalizeRecord(
      (candidate as Partial<WorldBase> & { equipmentVariantsById?: unknown }).equipmentVariantsById,
    ) as WorldBase["equipmentVariantsById"],
    equipmentProductionLinesByCountry: normalizeRecord(
      (candidate as Partial<WorldBase> & { equipmentProductionLinesByCountry?: unknown }).equipmentProductionLinesByCountry,
    ) as WorldBase["equipmentProductionLinesByCountry"],
    equipmentStockpileByCountry: normalizeRecord(
      (candidate as Partial<WorldBase> & { equipmentStockpileByCountry?: unknown }).equipmentStockpileByCountry,
    ) as WorldBase["equipmentStockpileByCountry"],
    diplomacyProposals: params.normalizeDiplomacyProposals(
      (candidate as Partial<WorldBase> & { diplomacyProposals?: unknown }).diplomacyProposals,
    ),
  };
  restored.divisionsById = params.normalizeDivisionsById(
    (candidate as Partial<WorldBase> & { divisionsById?: unknown }).divisionsById,
    restored,
  );
  return restored;
}

function normalizeRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input) ? { ...(input as Record<string, unknown>) } : {};
}

function assertNoRemovedHexHeavyState(candidate: Record<string, unknown>): void {
  const removedFields = [
    "provincePopulationByHex",
    "provinceBuildingsByHex",
    "provincePopulationTreasuryByHex",
    "provinceConstructionQueueByHex",
    "provinceResourceDepositsByHex",
    "provinceResourceExplorationQueueByHex",
    "provinceResourceExplorationCountByHex",
    "colonyProgressByHex",
    "provinceColonizationByHex",
  ];
  const present = removedFields.filter((field) => Object.prototype.hasOwnProperty.call(candidate, field));
  if (present.length > 0) {
    throw new Error(`PERSISTED_WORLD_REMOVED_PROVINCE_HEAVY_FIELDS:${present.join(",")}`);
  }
}
