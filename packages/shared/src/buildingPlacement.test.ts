import { describe, expect, it } from "vitest";
import type { HexTile } from "./contracts/hex-map";
import { evaluateBuildingPlacement } from "./buildingPlacement";
import { buildCityHexIdSet, resolveEffectiveHexTile } from "./effectiveHex";

describe("evaluateBuildingPlacement", () => {
  it("accepts eligible controlled free hexes and aggregates adjacency throughput", () => {
    const result = evaluateBuildingPlacement({
      building: {
        id: "building:watermill",
        placement: { allowedTerrains: ["plains"], deniedWaterKinds: ["ocean"] },
        adjacencyEffects: [
          {
            id: "forest_support",
            when: { neighborFeatures: ["forest"] },
            perNeighbor: true,
            maxStacks: 2,
            modifier: { target: "building.throughput", operation: "add", value: 0.05 },
          },
          {
            id: "river_support",
            when: { adjacentToRiver: true },
            modifier: { target: "building.throughput", operation: "multiply", value: 1.1 },
          },
        ],
      },
      countryId: "country:a",
      hex: makeHex({ id: "hex:0:0", terrain: "plains" }),
      neighborHexes: [
        makeHex({ id: "hex:1:0", feature: "forest" }),
        makeHex({ id: "hex:0:1", feature: "forest" }),
        makeHex({ id: "hex:-1:1", feature: "scrub" }),
      ],
      riverNeighborHexIds: new Set(["hex:1:0"]),
      world: makeWorld(),
    });

    expect(result.valid).toBe(true);
    expect(result.reason.code).toBe("BUILD_PLACEMENT_OK");
    expect(result.throughputFactor).toBeCloseTo(1.21);
    expect(result.adjacencySources).toEqual([
      { effectId: "forest_support", operation: "add", stacks: 2, value: 0.05 },
      { effectId: "river_support", operation: "multiply", stacks: 1, value: 1.1 },
    ]);
    expect(result.debugScore).toBeCloseTo(1210);
  });

  it("rejects uncontrolled, occupied, terrain-blocked, and water-blocked hexes with stable reasons", () => {
    expect(
      evaluateBuildingPlacement({
        building: { id: "building:farm" },
        countryId: "country:b",
        hex: makeHex(),
        world: makeWorld(),
      }).reason.code,
    ).toBe("BUILD_PLACEMENT_REGION_NOT_CONTROLLED");

    expect(
      evaluateBuildingPlacement({
        building: { id: "building:farm" },
        countryId: "country:a",
        hex: makeHex(),
        world: makeWorld({
          regionBuildingsByRegion: {
            "region:a": [
              {
                instanceId: "instance:a",
                buildingId: "building:farm",
                targetHexId: "hex:0:0",
                owner: { type: "state", countryId: "country:a" },
                createdTurnId: 1,
                level: 1,
                currentDurability: 100,
                lastProductivity: 1,
              },
            ],
          },
        }),
      }).reason.code,
    ).toBe("BUILD_PLACEMENT_OCCUPIED");

    expect(
      evaluateBuildingPlacement({
        building: { id: "building:farm", placement: { allowedTerrains: ["hills"] } },
        countryId: "country:a",
        hex: makeHex({ terrain: "plains" }),
        world: makeWorld(),
      }).reason.code,
    ).toBe("BUILD_PLACEMENT_TERRAIN_NOT_ALLOWED");

    expect(
      evaluateBuildingPlacement({
        building: { id: "building:port", placement: { deniedWaterKinds: ["lake"] } },
        countryId: "country:a",
        hex: makeHex({ terrain: "lake", waterKind: "lake" }),
        world: makeWorld(),
      }).reason.code,
    ).toBe("BUILD_PLACEMENT_WATER_DENIED");
  });

  it("uses city tags without replacing base terrain", () => {
    const cityHexIds = buildCityHexIdSet({
      settlementProjectsById: {
        "settlement:a": {
          id: "settlement:a",
          name: "Babylon",
          countryId: "country:a",
          regionId: "region:a",
          targetHexId: "hex:0:0",
          cultureId: "culture:a",
          progressColonization: 1,
          costColonization: 10,
          state: "active",
          visualState: "underConstruction",
          createdTurnId: 1,
        },
      },
      cityMarkersById: {},
    });
    const hex = resolveEffectiveHexTile(makeHex({ id: "hex:0:0", terrain: "plains" }), cityHexIds);

    const result = evaluateBuildingPlacement({
      building: { id: "building:city-market", placement: { allowedTerrains: ["plains"], allowedTags: ["city"] } },
      countryId: "country:a",
      hex,
      world: makeWorld(),
    });

    expect(hex.terrain).toBe("plains");
    expect(hex.baseTerrain).toBe("plains");
    expect(hex.tags).toEqual(["city"]);
    expect(result.reason.code).toBe("BUILD_PLACEMENT_OK");
  });

  it("aggregates adjacency throughput by neighbor city tags", () => {
    const result = evaluateBuildingPlacement({
      building: {
        id: "building:workshop",
        adjacencyEffects: [
          {
            id: "city_support",
            when: { neighborTags: ["city"] },
            perNeighbor: true,
            modifier: { target: "building.throughput", operation: "add", value: 0.1 },
          },
        ],
      },
      countryId: "country:a",
      hex: makeHex({ id: "hex:0:0" }),
      neighborHexes: [
        { ...makeHex({ id: "hex:1:0" }), tags: ["city"] },
        makeHex({ id: "hex:0:1" }),
      ],
      world: makeWorld(),
    });

    expect(result.valid).toBe(true);
    expect(result.adjacencySources).toEqual([{ effectId: "city_support", operation: "add", stacks: 1, value: 0.1 }]);
    expect(result.throughputFactor).toBe(1.1);
  });
});

function makeWorld(overrides?: Partial<Parameters<typeof evaluateBuildingPlacement>[0]["world"]>) {
  return {
    regionOwner: { "region:a": "country:a" },
    regionController: { "region:a": "country:a" },
    regionBuildingsByRegion: {},
    regionConstructionQueueByRegion: {},
    ...overrides,
  };
}

function makeHex(overrides?: Partial<HexTile>): HexTile {
  return {
    id: "hex:0:0",
    q: 0,
    r: 0,
    chunkId: "hex-chunk:0:0",
    regionId: "region:a",
    terrain: "plains",
    biome: "temperate",
    feature: "none",
    waterKind: null,
    elevation: 0,
    moisture: 0,
    temperature: 0,
    movementCost: 1,
    passable: true,
    ...overrides,
  };
}
