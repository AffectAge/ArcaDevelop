import type { WorldBase } from "@arcanorum/shared";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildWorldBaseFromScenarioRuntime } from "./scenarioRuntimeLoader";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("scenario runtime loader", () => {
  it("builds region-owned heavy state and resource deposits from region history files", async () => {
    const scenarioDir = await createScenarioFixture();

    const worldBase = buildWorldBaseFromScenarioRuntime({
      currentTurnId: 7,
      scenarioDir,
      defaultWorldBase: makeWorldBase,
      normalizeResourcesByCountryMap: asWorldMap<WorldBase["resourcesByCountry"]>,
      normalizeRegionColonizationMap: asWorldMap<WorldBase["regionColonizationByRegion"]>,
      normalizeRegionPopulationMap: asWorldMap<WorldBase["regionPopulationByRegion"]>,
      normalizeRegionBuildingsMap: asWorldMap<WorldBase["regionBuildingsByRegion"]>,
      normalizeRegionBuildingDucatsMap: asWorldMap<WorldBase["regionBuildingDucatsByRegion"]>,
      normalizeRegionPopulationTreasuryMap: asWorldMap<WorldBase["regionPopulationTreasuryByRegion"]>,
      normalizeRegionConstructionQueueMap: asWorldMap<WorldBase["regionConstructionQueueByRegion"]>,
      normalizeRegionResourceDepositsMap: asWorldMap<WorldBase["regionResourceDepositsByRegion"]>,
      normalizeRegionResourceExplorationQueueMap: asWorldMap<WorldBase["regionResourceExplorationQueueByRegion"]>,
      normalizeRegionResourceExplorationCountMap: asWorldMap<WorldBase["regionResourceExplorationCountByRegion"]>,
      normalizeTechnologyByCountryMap: asWorldMap<WorldBase["technologyByCountry"]>,
      normalizeDiplomacyProposals: asDiplomacyProposals,
    });

    expect(worldBase.regionOwner["region:bohemia"]).toBe("country:bohemia");
    expect(worldBase.regionController["region:bohemia"]).toBe("country:bohemia");
    expect(worldBase.hexOwner["hex:0:0"]).toBe("country:bohemia");
    expect(worldBase.regionPopulationByRegion["region:bohemia"]?.pops[0]?.id).toBe("pop:bohemia:farmers");
    expect(worldBase.regionBuildingsByRegion["region:bohemia"]?.[0]?.buildingId).toBe("building:farm");
    expect(worldBase.regionConstructionQueueByRegion["region:bohemia"]?.[0]?.queueId).toBe("queue:bohemia:farm");
    expect(worldBase.regionBuildingDucatsByRegion["region:bohemia"]).toEqual({ "building:farm": 25 });
    expect(worldBase.regionPopulationTreasuryByRegion["region:bohemia"]).toBe(15);
    expect(worldBase.regionColonizationByRegion["region:bohemia"]).toEqual({ cost: 50, disabled: true });
    expect(worldBase.regionResourceDepositsByRegion["region:bohemia"]?.[0]?.goodId).toBe("good:grain");
  });
});

async function createScenarioFixture(): Promise<string> {
  const scenarioDir = await mkdtemp(join(tmpdir(), "arcanorum-runtime-scenario-"));
  tempDirs.push(scenarioDir);
  await writeJson(join(scenarioDir, "history/regions/bohemia.json"), {
    id: "region:bohemia",
    hexIds: ["hex:0:0"],
    ownerCountryId: "country:bohemia",
    controllerCountryId: "country:bohemia",
    pops: [
      {
        id: "pop:bohemia:farmers",
        size: 1000,
        cultureId: "culture:bohemian",
        religionId: "religion:solar",
        raceId: "race:human",
        ideologies: {},
        professions: {},
      },
    ],
    buildings: [
      {
        instanceId: "building-instance:farm",
        buildingId: "building:farm",
        owner: { type: "state", countryId: "country:bohemia" },
        createdTurnId: 1,
      },
    ],
    buildingDucats: { "building:farm": 25 },
    populationTreasury: 15,
    construction: [
      {
        queueId: "queue:bohemia:farm",
        requestedByCountryId: "country:bohemia",
        buildingId: "building:farm",
        owner: { type: "state", countryId: "country:bohemia" },
        progressConstruction: 5,
        costConstruction: 20,
        costDucats: 10,
        createdTurnId: 1,
      },
    ],
    colonization: { cost: 50, disabled: true },
    resources: [{ goodId: "good:grain", amount: 100, discoveredTurnId: 1, veinSize: "small" }],
  });
  await writeJson(join(scenarioDir, "history/countries/bohemia.json"), {
    id: "country:bohemia",
    resources: { gold: 10 },
  });
  return scenarioDir;
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function makeWorldBase(currentTurnId: number): WorldBase {
  return {
    turnId: currentTurnId,
    resourcesByCountry: {},
    resourceLedgerByTurn: {},
    explanationRecordsByTurn: {},
    regionOwner: {},
    regionController: {},
    hexOwner: {},
    hexNameById: {},
    colonyProgressByRegion: {},
    regionColonizationByRegion: {},
    regionPopulationByRegion: {},
    regionBuildingsByRegion: {},
    regionBuildingDucatsByRegion: {},
    regionPopulationTreasuryByRegion: {},
    regionConstructionQueueByRegion: {},
    regionResourceDepositsByRegion: {},
    regionResourceExplorationQueueByRegion: {},
    regionResourceExplorationCountByRegion: {},
    parliamentByCountry: {},
    technologyByCountry: {},
    countryDecisionsByCountryId: {},
    countryEventsByCountryId: {},
    countryScheduledEventsByCountryId: {},
    countryEventFlagsByCountryId: {},
    journalEntriesByCountryId: {},
    countryModifiersByCountryId: {},
    divisionTemplatesByCountry: {},
    divisionsById: {},
    fleetsById: {},
    airWingsById: {},
    militaryFormationQueueByCountry: {},
    civilianUnitsById: {},
    civilianUnitQueueByCountry: {},
    settlementProjectsById: {},
    cityMarkersById: {},
    equipmentVariantsById: {},
    equipmentProductionLinesByCountry: {},
    equipmentStockpileByCountry: {},
    diplomacyProposals: [],
  };
}

function asWorldMap<T extends Record<string, unknown>>(input: unknown): T {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as T) : ({} as T);
}

function asDiplomacyProposals(input: unknown): WorldBase["diplomacyProposals"] {
  return Array.isArray(input) ? (input as WorldBase["diplomacyProposals"]) : [];
}
