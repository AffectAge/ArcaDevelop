import type { PopulationPop, ResourceTotals, WorldBase } from "@arcanorum/shared";
import { buildAiCountryContext, buildAiWorldIndexes, type AiCountryContext } from "./aiContext";

export type AiFixtureWorldOverrides = Partial<WorldBase>;

export function createAiFixtureWorld(overrides: AiFixtureWorldOverrides = {}): WorldBase {
  return {
    turnId: 1,
    resourcesByCountry: {
      "country:alpha": createAiFixtureResources({ ducats: 100, construction: 25 }),
      "country:beta": createAiFixtureResources({ ducats: 80, construction: 10 }),
    },
    regionOwner: {
      "region:alpha-core": "country:alpha",
      "region:beta-core": "country:beta",
    },
    regionController: {
      "region:alpha-core": "country:alpha",
      "region:beta-core": "country:beta",
    },
    hexOwner: {},
    hexNameById: {},
    colonyProgressByRegion: {},
    regionColonizationByRegion: {},
    regionPopulationByRegion: {
      "region:alpha-core": {
        pops: [createAiFixturePop({ id: "pop:alpha", size: 1000 })],
      },
      "region:beta-core": {
        pops: [createAiFixturePop({ id: "pop:beta", size: 750 })],
      },
    },
    regionBuildingsByRegion: {
      "region:alpha-core": [
        {
          instanceId: "building:alpha-farm:1",
          buildingId: "building:farm",
          targetHexId: "hex:0:0",
          owner: { type: "state", countryId: "country:alpha" },
          createdTurnId: 1,
          level: 1,
        },
      ],
      "region:beta-core": [],
    },
    regionBuildingDucatsByRegion: {},
    regionPopulationTreasuryByRegion: {},
    regionConstructionQueueByRegion: {
      "region:alpha-core": [
        {
          queueId: "queue:alpha-farm:upgrade",
          requestedByCountryId: "country:alpha",
          buildingId: "building:farm",
          targetHexId: "hex:0:0",
          owner: { type: "state", countryId: "country:alpha" },
          projectType: "upgrade",
          targetInstanceId: "building:alpha-farm:1",
          progressConstruction: 2,
          costConstruction: 10,
          costDucats: 5,
          createdTurnId: 1,
        },
      ],
    },
    regionResourceDepositsByRegion: {
      "region:alpha-core": [
        {
          goodId: "good:grain",
          amount: 100,
          discoveredTurnId: 1,
          veinSize: "medium",
        },
      ],
    },
    regionResourceExplorationQueueByRegion: {},
    regionResourceExplorationCountByRegion: {},
    parliamentByCountry: {},
    technologyByCountry: {},
    countryDecisionsByCountryId: {},
    countryEventsByCountryId: {},
    countryScheduledEventsByCountryId: {},
    countryEventFlagsByCountryId: {},
    journalEntriesByCountryId: {},
    divisionTemplatesByCountry: {},
    divisionsById: {},
    militaryFormationQueueByCountry: {},
    civilianUnitsById: {},
    civilianUnitQueueByCountry: {},
    settlementProjectsById: {},
    cityMarkersById: {},
    equipmentVariantsById: {},
    equipmentProductionLinesByCountry: {},
    equipmentStockpileByCountry: {},
    diplomacyProposals: [],
    ...overrides,
    countryModifiersByCountryId: overrides.countryModifiersByCountryId ?? {},
    resourceLedgerByTurn: overrides.resourceLedgerByTurn ?? {},
    explanationRecordsByTurn: overrides.explanationRecordsByTurn ?? {},
  };
}

export function buildAiFixtureCountryContext(
  countryId: string,
  overrides: AiFixtureWorldOverrides = {},
): AiCountryContext {
  const world = createAiFixtureWorld(overrides);
  return buildAiCountryContext({ countryId, world, indexes: buildAiWorldIndexes(world) });
}

function createAiFixtureResources(overrides: Partial<ResourceTotals> = {}): ResourceTotals {
  return {
    culture: 0,
    science: 0,
    religion: 0,
    colonization: 0,
    construction: 0,
    ducats: 0,
    gold: 0,
    ...overrides,
  };
}

function createAiFixturePop(params: { id: string; size: number }): PopulationPop {
  return {
    id: params.id,
    size: params.size,
    cultureId: "culture:test",
    religionId: "religion:test",
    raceId: "race:test",
    ideologies: {},
    professions: {},
  };
}
