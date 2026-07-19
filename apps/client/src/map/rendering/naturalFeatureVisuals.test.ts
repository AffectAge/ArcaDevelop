import { describe, expect, it } from "vitest";
import type {
  HexTile,
  NaturalFeatureVisualRuleDefinition,
} from "@arcanorum/shared";
import { resolveNaturalFeaturePlacements } from "./naturalFeatureVisuals";

const rules: NaturalFeatureVisualRuleDefinition[] = [
  {
    id: "natural_feature_visual:taiga",
    tagQuery: { all: ["ecoregion:taiga", "natural:coniferous_forest"] },
    textureSetId: "tundra",
    placements: [
      {
        id: "taiga_sparse",
        frameIds: [0, 1, 2],
        count: { min: 1, max: 2 },
        layoutId: "taiga_stand",
        tagQuery: "vegetation:sparse",
        lod: "simplified",
        layer: "vegetation",
        scale: { min: 0.56, max: 0.76 },
      },
      {
        id: "taiga_forest",
        frameIds: [0, 1, 2, 3],
        count: { min: 8, max: 12 },
        layoutId: "taiga_stand",
        tagQuery: { any: ["vegetation:normal", "vegetation:dense"] },
        lod: "detailed",
        layer: "vegetation",
        scale: { min: 0.46, max: 0.68 },
      },
    ],
    priority: 20,
  },
  {
    id: "natural_feature_visual:mountain",
    tagQuery: {
      all: [
        "morphology:mountainous",
        { not: "ecoregion:glacial_mountains" },
      ],
    },
    textureSetId: "mountain",
    placements: [
      {
        id: "mountain_massif",
        frameIds: [0, 1, 2, 3],
        count: { min: 1, max: 1 },
        layoutId: "mountain_massif_base",
        lod: "simplified",
        layer: "landform",
        drawOrder: 0,
        scale: { min: 1.65, max: 1.9 },
      },
    ],
    priority: 30,
  },
  {
    id: "natural_feature_visual:glacial_mountain",
    tagQuery: {
      all: [
        "morphology:mountainous",
        "ecoregion:glacial_mountains",
        "elevation:peak",
      ],
    },
    textureSetId: "glacial_mountain",
    placements: [
      {
        id: "glacial_massif",
        frameIds: [0, 1, 2, 3],
        count: { min: 1, max: 1 },
        layoutId: "mountain_massif_base",
        lod: "simplified",
        layer: "snow",
        drawOrder: 2,
        scale: { min: 1.34, max: 1.62 },
      },
    ],
    priority: 40,
  },
];

describe("resolveNaturalFeaturePlacements", () => {
  it("uses stable terrain-aware object positions and frames", () => {
    const catalog = { visuals: rules, textureUrls: {} };
    const tile = makeTile();
    expect(
      resolveNaturalFeaturePlacements(tile, catalog, "map-seed", "detailed"),
    ).toEqual(
      resolveNaturalFeaturePlacements(tile, catalog, "map-seed", "detailed"),
    );
    expect(
      resolveNaturalFeaturePlacements(
        tile,
        catalog,
        "map-seed",
        "detailed",
      ).every((placement) =>
        placement.textureUrl.endsWith("tundra_features.webp"),
      ),
    ).toBe(true);
  });

  it("uses density to control the number of individual objects", () => {
    const catalog = { visuals: rules, textureUrls: {} };
    const sparse = resolveNaturalFeaturePlacements(
      makeTile("vegetation:sparse"),
      catalog,
      "map-seed",
      "detailed",
    );
    const dense = resolveNaturalFeaturePlacements(
      makeTile("vegetation:dense"),
      catalog,
      "map-seed",
      "detailed",
    );
    expect(sparse.length).toBeLessThanOrEqual(2);
    expect(dense.length).toBeGreaterThanOrEqual(8);
  });

  it("keeps every dense forest layout capable of a full twelve-tree stand", () => {
    for (const layoutId of [
      "temperate_grove",
      "plains_grove",
      "wetland_copse",
    ] as const) {
      const forestRule: NaturalFeatureVisualRuleDefinition = {
        id: `natural_feature_visual:${layoutId}`,
        tagQuery: "natural:coniferous_forest",
        textureSetId: "tundra",
        placements: [
          {
            id: "dense_forest",
            frameIds: [0, 1, 2, 3],
            count: { min: 12, max: 12 },
            layoutId,
            lod: "detailed",
            layer: "vegetation",
            scale: { min: 0.48, max: 0.72 },
          },
        ],
      };
      for (let sample = 0; sample < 24; sample += 1) {
        expect(
          resolveNaturalFeaturePlacements(
            makeTile("vegetation:dense"),
            { visuals: [forestRule], textureUrls: {} },
            `layout-${layoutId}-${sample}`,
            "detailed",
          ),
        ).toHaveLength(12);
      }
    }
  });

  it("keeps objects in distinct composition anchors without visual intersections", () => {
    const placements = resolveNaturalFeaturePlacements(
      makeTile("vegetation:dense"),
      { visuals: rules, textureUrls: {} },
      "map-seed",
      "detailed",
    );
    expect(
      new Set(
        placements.map(
          (placement) => `${placement.offsetX}:${placement.offsetY}`,
        ),
      ).size,
    ).toBe(placements.length);
    for (let left = 0; left < placements.length; left += 1) {
      for (let right = left + 1; right < placements.length; right += 1) {
        const first = placements[left];
        const second = placements[right];
        expect(
          Math.hypot(
            first.offsetX - second.offsetX,
            first.offsetY - second.offsetY,
          ),
        ).toBeGreaterThan(0.2);
      }
    }
  });

  it("keeps dense taiga as a coherent stand instead of a uniform scatter", () => {
    const placements = resolveNaturalFeaturePlacements(
      makeTile("vegetation:dense"),
      { visuals: rules, textureUrls: {} },
      "map-seed",
      "detailed",
    );
    expect(
      placements.every((placement) => placement.layoutId === "taiga_stand"),
    ).toBe(true);
    expect(placements.map((placement) => placement.role)).toEqual(
      expect.arrayContaining(["back", "center"]),
    );
  });

  it("does not place taiga trees on flat tundra", () => {
    const tile = makeTile("vegetation:normal");
    tile.mapTags = [
      "biome:tundra",
      "ecoregion:tundra",
      "natural:shrubland",
      "vegetation:normal",
    ];
    expect(
      resolveNaturalFeaturePlacements(
        tile,
        { visuals: rules, textureUrls: {} },
        "map-seed",
        "detailed",
      ),
    ).toEqual([]);
  });

  it("uses only the glacial atlas for a glacial mountain peak", () => {
    const tile = makeTile("vegetation:sparse");
    tile.mapTags = [
      "morphology:mountainous",
      "ecoregion:glacial_mountains",
      "elevation:peak",
    ];
    const placements = resolveNaturalFeaturePlacements(
      tile,
      { visuals: rules, textureUrls: {} },
      "map-seed",
      "simplified",
    );
    expect(placements).not.toHaveLength(0);
    expect(placements.every((placement) =>
      placement.textureUrl.endsWith("glacial_mountain_features.webp"),
    )).toBe(true);
    expect(placements.map((placement) => placement.layer)).toEqual(
      expect.arrayContaining(["snow"]),
    );
  });

  it("anchors one dominant mountain massif below the hex center", () => {
    const tile = makeTile("vegetation:sparse");
    tile.mapTags = [
      "morphology:mountainous",
      "natural:rock_outcrop",
    ];
    const placements = resolveNaturalFeaturePlacements(
      tile,
      { visuals: rules, textureUrls: {} },
      "mountain-massif",
      "detailed",
    );
    const massif = placements.filter((placement) =>
      placement.id.includes(":mountain_massif:"),
    );
    expect(massif).toHaveLength(1);
    expect(massif[0]?.offsetY).toBeGreaterThan(0.3);
    expect(massif[0]?.scale).toBeGreaterThanOrEqual(1.65);
    expect(placements).toHaveLength(1);
    expect(placements.every((placement) =>
      placement.textureUrl.endsWith("mountain_features.webp"),
    )).toBe(true);
  });
});

function makeTile(
  density:
    | "vegetation:sparse"
    | "vegetation:normal"
    | "vegetation:dense" = "vegetation:normal",
): HexTile {
  return {
    id: "hex:8:8",
    chunkId: "hex-chunk:0:0",
    regionId: "region:test",
    q: 8,
    r: 8,
    waterKind: null,
    elevation: 0.4,
    moisture: 0.6,
    temperature: 0.3,
    temperatureBand: "cool",
    moistureBand: "normal",
    distanceToWater: 2,
    isCoastal: false,
    riverMask: 0,
    riverWidth: 0,
    mapTags: [
      "biome:tundra",
      "ecoregion:taiga",
      "natural:coniferous_forest",
      density,
    ],
    movementCost: 2,
    passable: true,
  };
}
