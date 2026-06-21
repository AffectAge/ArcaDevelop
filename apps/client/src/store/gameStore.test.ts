import type { PopulationPop, RegionConstructionProject, WorldBase, WorldDelta } from "@arcanorum/shared";
import { WORLD_DELTA_MASK } from "@arcanorum/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "./gameStore";

describe("gameStore region world deltas", () => {
  beforeEach(() => {
    useGameStore.setState({
      auth: null,
      turnId: 1,
      worldStateVersion: 1,
      onlinePlayerIds: [],
      selectedProvinceId: null,
      worldBase: null,
      ordersByTurn: new Map(),
      eventLog: [],
      eventLogRetentionTurns: 3,
    });
  });

  it("applies region-owned heavy deltas by region key idempotently", () => {
    const project = makeProject({ queueId: "queue:a", progressConstruction: 5 });
    useGameStore.getState().setWorldBase(makeWorldBase(), 1, 1);
    const delta: WorldDelta = {
      type: "WORLD_DELTA",
      turnId: 2,
      worldStateVersion: 2,
      mask:
        WORLD_DELTA_MASK.regionPopulationByRegion |
        WORLD_DELTA_MASK.regionBuildingsByRegion |
        WORLD_DELTA_MASK.regionBuildingDucatsByRegion |
        WORLD_DELTA_MASK.regionPopulationTreasuryByRegion |
        WORLD_DELTA_MASK.regionConstructionQueueByRegion,
      u: { "region:a": { pops: [makePop({ id: "pop:a", size: 25 })] } },
      b: { "region:a": [{ instanceId: "instance:a", buildingId: "building:a", owner: { type: "state", countryId: "country:a" }, createdTurnId: 1 }] },
      q: { "region:a": { "building:a": 7 } },
      y: { "region:a": 13 },
      r: { "region:a": [project] },
      rejectedOrders: [],
    };

    useGameStore.getState().applyWorldDelta(delta, 2, 2);
    const once = structuredClone(useGameStore.getState().worldBase);
    useGameStore.getState().applyWorldDelta(delta, 2, 2);

    expect(useGameStore.getState().worldBase).toEqual(once);
    expect(useGameStore.getState().worldBase?.regionPopulationByRegion["region:a"]).toEqual({ pops: [makePop({ id: "pop:a", size: 25 })] });
    expect(useGameStore.getState().worldBase?.regionBuildingsByRegion["region:a"]?.[0]?.buildingId).toBe("building:a");
    expect(useGameStore.getState().worldBase?.regionBuildingDucatsByRegion["region:a"]).toEqual({ "building:a": 7 });
    expect(useGameStore.getState().worldBase?.regionPopulationTreasuryByRegion["region:a"]).toBe(13);
    expect(useGameStore.getState().worldBase?.regionConstructionQueueByRegion["region:a"]).toEqual([project]);
  });

  it("replays region-owned heavy deletion deltas without leaving stale region state", () => {
    useGameStore.getState().setWorldBase(
      makeWorldBase({
        regionPopulationByRegion: { "region:a": { pops: [makePop({ id: "pop:a", size: 25 })] } },
        regionBuildingsByRegion: { "region:a": [{ instanceId: "instance:a", buildingId: "building:a", owner: { type: "state", countryId: "country:a" }, createdTurnId: 1 }] },
        regionBuildingDucatsByRegion: { "region:a": { "building:a": 7 } },
        regionPopulationTreasuryByRegion: { "region:a": 13 },
        regionConstructionQueueByRegion: { "region:a": [makeProject()] },
      }),
      1,
      1,
    );

    useGameStore.getState().applyWorldDelta(
      {
        type: "WORLD_DELTA",
        turnId: 2,
        worldStateVersion: 2,
        mask:
          WORLD_DELTA_MASK.regionPopulationByRegion |
          WORLD_DELTA_MASK.regionBuildingsByRegion |
          WORLD_DELTA_MASK.regionBuildingDucatsByRegion |
          WORLD_DELTA_MASK.regionPopulationTreasuryByRegion |
          WORLD_DELTA_MASK.regionConstructionQueueByRegion,
        u: { "region:a": null },
        b: { "region:a": null },
        q: { "region:a": null },
        y: { "region:a": null },
        r: { "region:a": null },
        rejectedOrders: [],
      },
      2,
      2,
    );

    expect(useGameStore.getState().worldBase?.regionPopulationByRegion).not.toHaveProperty("region:a");
    expect(useGameStore.getState().worldBase?.regionBuildingsByRegion).not.toHaveProperty("region:a");
    expect(useGameStore.getState().worldBase?.regionBuildingDucatsByRegion).not.toHaveProperty("region:a");
    expect(useGameStore.getState().worldBase?.regionPopulationTreasuryByRegion).not.toHaveProperty("region:a");
    expect(useGameStore.getState().worldBase?.regionConstructionQueueByRegion).not.toHaveProperty("region:a");
  });
});

function makeProject(overrides?: Partial<RegionConstructionProject>): RegionConstructionProject {
  return {
    queueId: "queue:a",
    requestedByCountryId: "country:a",
    buildingId: "building:a",
    owner: { type: "state", countryId: "country:a" },
    projectType: "build",
    progressConstruction: 0,
    costConstruction: 10,
    costDucats: 2,
    createdTurnId: 1,
    ...overrides,
  };
}

function makePop(overrides?: Partial<PopulationPop>): PopulationPop {
  return {
    id: "pop:a",
    size: 1,
    cultureId: "culture:a",
    religionId: "religion:a",
    raceId: "race:a",
    ideologies: {},
    professions: {},
    ...overrides,
  };
}

function makeWorldBase(overrides?: Partial<WorldBase>): WorldBase {
  return {
    turnId: 1,
    resourcesByCountry: {},
    regionOwner: {},
    regionController: {},
    provinceOwner: {},
    provinceNameById: {},
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
    divisionTemplatesByCountry: {},
    divisionsById: {},
    militaryFormationQueueByCountry: {},
    diplomacyProposals: [],
    ...overrides,
    resourceLedgerByTurn: overrides?.resourceLedgerByTurn ?? {},
  };
}
