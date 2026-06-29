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
      startingColonizerMovementPoints: 3,
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
    expect(Object.values(worldBase.civilianUnitsById)).toEqual([
      expect.objectContaining({
        countryId: "country:bohemia",
        type: "colonizer",
        hexId: "hex:0:0",
        status: "idle",
        movementPoints: 3,
        maxMovementPoints: 3,
      }),
    ]);
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
  await writeJson(join(scenarioDir, ".generated/hex-map-artifact.json"), {
    version: 1,
    settings: {
      seed: "fixture",
      width: 2,
      height: 1,
      hexSize: 24,
      seaLevel: 0.42,
      temperature: 0.5,
      moisture: 0.5,
      mountains: 0.78,
      rivers: 0.45,
      forests: 0.55,
      targetLandRegionSize: 8,
      targetWaterRegionSize: 12,
      chunkSize: 8,
      wrapX: false,
    },
    tiles: [
      makeHexTile({ id: "hex:0:0", regionId: "region:bohemia" }),
      makeHexTile({ id: "hex:1:0", regionId: "region:water", waterKind: "sea", terrain: "sea", passable: true }),
    ],
    riverEdges: [],
    coastOverlays: [],
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

function makeHexTile(overrides: Partial<{
  id: string;
  regionId: string;
  waterKind: "ocean" | "sea" | "lake" | null;
  terrain: string;
  passable: boolean;
}> = {}): Record<string, unknown> {
  return {
    id: overrides.id ?? "hex:0:0",
    q: 0,
    r: 0,
    chunkId: "hex-chunk:0:0",
    regionId: overrides.regionId ?? "region:bohemia",
    terrain: overrides.terrain ?? "plains",
    biome: "temperate_grassland",
    feature: "none",
    waterKind: overrides.waterKind ?? null,
    elevation: 0.5,
    moisture: 0.5,
    temperature: 0.5,
    temperatureBand: "temperate",
    moistureBand: "normal",
    distanceToWater: overrides.waterKind ? 0 : 3,
    isCoastal: false,
    riverMask: 0,
    riverWidth: 0,
    movementCost: 1,
    passable: overrides.passable ?? true,
  };
}
