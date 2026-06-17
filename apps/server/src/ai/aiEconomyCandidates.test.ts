import { describe, expect, it } from "vitest";
import { buildAiCountryContext, buildAiWorldIndexes } from "./aiContext";
import { selectAiEconomyOrderCandidates } from "./aiEconomyCandidates";
import { createAiFixtureWorld } from "./aiFixtureHarness";

const farm = {
  id: "building:farm",
  costConstruction: 10,
  costDucats: 5,
  upgradeCostConstruction: 8,
  upgradeCostDucats: 4,
  maxLevel: 3,
};

const mine = {
  id: "building:mine",
  costConstruction: 12,
  costDucats: 6,
  upgradeCostConstruction: 9,
  upgradeCostDucats: 5,
  maxLevel: 2,
};

describe("AI economy candidates", () => {
  it("selects deterministic build and upgrade candidates without mutating world state", () => {
    const world = createAiFixtureWorld({ regionConstructionQueueByRegion: {} });
    const before = JSON.stringify(world);
    const indexes = buildAiWorldIndexes(world);
    const context = buildAiCountryContext({ countryId: "country:alpha", world, indexes });

    const candidates = selectAiEconomyOrderCandidates({
      context,
      world,
      indexes,
      buildings: [mine, farm],
      isBuildingUnlockedForCountry: () => true,
      getRegionBuildRestriction: () => null,
    });

    expect(candidates).toEqual([
      {
        kind: "upgrade",
        countryId: "country:alpha",
        regionId: "region:alpha-core",
        buildingId: "building:farm",
        instanceId: "building:alpha-farm:1",
        currentLevel: 1,
        targetLevel: 2,
        costConstruction: 8,
        costDucats: 4,
        request: {
          route: "/country/build/upgrade-state",
          body: {
            regionId: "region:alpha-core",
            buildingId: "building:farm",
            instanceId: "building:alpha-farm:1",
          },
        },
      },
      {
        kind: "build",
        countryId: "country:alpha",
        regionId: "region:alpha-core",
        buildingId: "building:farm",
        orderDraft: {
          type: "BUILD",
          countryId: "country:alpha",
          regionId: "region:alpha-core",
          payload: {
            buildingId: "building:farm",
            owner: { type: "state", countryId: "country:alpha" },
          },
        },
      },
      {
        kind: "build",
        countryId: "country:alpha",
        regionId: "region:alpha-core",
        buildingId: "building:mine",
        orderDraft: {
          type: "BUILD",
          countryId: "country:alpha",
          regionId: "region:alpha-core",
          payload: {
            buildingId: "building:mine",
            owner: { type: "state", countryId: "country:alpha" },
          },
        },
      },
    ]);
    expect(JSON.stringify(world)).toBe(before);
  });

  it("filters locked, restricted, and limit-blocked build candidates", () => {
    const world = createAiFixtureWorld();
    const indexes = buildAiWorldIndexes(world);
    const context = buildAiCountryContext({ countryId: "country:alpha", world, indexes });

    const candidates = selectAiEconomyOrderCandidates({
      context,
      world,
      indexes,
      buildings: [
        { ...farm, countryBuildLimits: [{ countryId: "country:alpha", limit: 1 }] },
        mine,
      ],
      isBuildingUnlockedForCountry: () => true,
      getRegionBuildRestriction: (building) => (building.id === "building:mine" ? "blocked" : null),
    });

    expect(candidates.filter((candidate) => candidate.kind === "build")).toEqual([]);
  });

  it("filters upgrade candidates when already queued", () => {
    const world = createAiFixtureWorld();
    const indexes = buildAiWorldIndexes(world);
    const context = buildAiCountryContext({ countryId: "country:alpha", world, indexes });

    const candidates = selectAiEconomyOrderCandidates({
      context,
      world,
      indexes,
      buildings: [farm],
    });

    expect(candidates.some((candidate) => candidate.kind === "upgrade")).toBe(false);
  });

  it("filters upgrade candidates when unaffordable", () => {
    const world = createAiFixtureWorld({
      regionConstructionQueueByRegion: {},
      resourcesByCountry: {
        "country:alpha": {
          culture: 0,
          science: 0,
          religion: 0,
          colonization: 0,
          construction: 0,
          ducats: 3,
          gold: 0,
        },
      },
    });
    const indexes = buildAiWorldIndexes(world);
    const context = buildAiCountryContext({ countryId: "country:alpha", world, indexes });

    const candidates = selectAiEconomyOrderCandidates({
      context,
      world,
      indexes,
      buildings: [farm],
    });

    expect(candidates.some((candidate) => candidate.kind === "upgrade")).toBe(false);
  });

  it("returns no candidates for landless countries", () => {
    const world = createAiFixtureWorld({
      resourcesByCountry: {
        "country:landless": {
          culture: 0,
          science: 0,
          religion: 0,
          colonization: 0,
          construction: 5,
          ducats: 10,
          gold: 0,
        },
      },
    });
    const indexes = buildAiWorldIndexes(world);
    const context = buildAiCountryContext({ countryId: "country:landless", world, indexes });

    expect(
      selectAiEconomyOrderCandidates({
        context,
        world,
        indexes,
        buildings: [farm],
      }),
    ).toEqual([]);
  });
});
