import { describe, expect, it } from "vitest";
import type { HexMapArtifact, HexTile, MapFeatureGeneratorDefinition } from "@arcanorum/shared";
import { generateMapFeatures } from "./mapFeatureGeneration";

describe("map feature generation", () => {
  it("places generated features deterministically by seed and generator id", () => {
    const generator: MapFeatureGeneratorDefinition = {
      id: "map_feature_generator:ruins",
      typeId: "feature:ancient_ruins",
      category: "site",
      global: { count: 2 },
      allowedTerrains: ["plains"],
    };

    const first = generateMapFeatures({ generators: [generator], mapArtifact: makeMap(), scenarioSeed: "seed:a" });
    const second = generateMapFeatures({ generators: [generator], mapArtifact: makeMap(), scenarioSeed: "seed:a" });

    expect(first.issues).toEqual([]);
    expect(first.features).toEqual(second.features);
    expect(first.features).toHaveLength(2);
    expect(first.features.every((feature) => feature.typeId === "feature:ancient_ruins")).toBe(true);
  });

  it("supports region-aware per-region and global counts together", () => {
    const generator: MapFeatureGeneratorDefinition = {
      id: "map_feature_generator:iron",
      typeId: "feature:iron_deposit",
      category: "deposit",
      perRegion: { count: 1 },
      global: { count: 1 },
    };

    const result = generateMapFeatures({ generators: [generator], mapArtifact: makeMap(), scenarioSeed: "seed:a" });

    expect(result.issues).toEqual([]);
    expect(result.features).toHaveLength(3);
    expect(new Set(result.features.map((feature) => feature.regionId))).toEqual(new Set(["region:a", "region:b"]));
  });

  it("keeps one generated site feature per hex across generators", () => {
    const generators: MapFeatureGeneratorDefinition[] = [
      {
        id: "map_feature_generator:first",
        typeId: "feature:first",
        category: "site",
        global: { count: 10 },
      },
      {
        id: "map_feature_generator:second",
        typeId: "feature:second",
        category: "site",
        global: { count: 10 },
      },
    ];

    const result = generateMapFeatures({ generators, mapArtifact: makeMap(), scenarioSeed: "seed:a" });

    expect(result.features).toHaveLength(makeMap().tiles.length);
    expect(new Set(result.features.map((feature) => feature.hexId)).size).toBe(result.features.length);
  });
});

function makeMap(): HexMapArtifact {
  const tiles: HexTile[] = [
    makeTile("hex:0:0", "region:a"),
    makeTile("hex:1:0", "region:a"),
    makeTile("hex:2:0", "region:b"),
    makeTile("hex:3:0", "region:b"),
  ];
  return {
    version: 1,
    settings: {
      seed: "test-map",
      width: 4,
      height: 1,
      hexSize: 24,
      seaLevel: 0.4,
      temperature: 0.5,
      moisture: 0.5,
      mountains: 0.5,
      rivers: 0.5,
      forests: 0.5,
      targetLandRegionSize: 2,
      targetWaterRegionSize: 2,
      chunkSize: 4,
      wrapX: false,
    },
    tiles,
    riverEdges: [],
    coastOverlays: [],
  };
}

function makeTile(id: HexTile["id"], regionId: HexTile["regionId"]): HexTile {
  const [, q, r] = id.split(":");
  return {
    id,
    q: Number(q),
    r: Number(r),
    chunkId: "hex-chunk:0:0",
    regionId,
    terrain: "plains",
    biome: "temperate",
    feature: "none",
    waterKind: null,
    elevation: 0.2,
    moisture: 0.4,
    temperature: 0.5,
    movementCost: 1,
    passable: true,
  };
}
