import { describe, expect, it } from "vitest";
import { normalizeNaturalFeatureVisual } from "./naturalFeatureVisuals";

describe("natural feature visual recipes", () => {
  it("accepts a density-aware individual-object recipe", () => {
    const result = normalizeNaturalFeatureVisual({
      id: "natural_feature_visual:taiga",
      tagQuery: { all: ["ecoregion:taiga", "natural:coniferous_forest"] },
      textureSetId: "tundra",
      placements: [
        {
          id: "near_trees",
          frameIds: [0, 1, 2, 15],
          count: { min: 4, max: 8 },
          layoutId: "taiga_stand",
          tagQuery: "vegetation:dense",
          lod: "detailed",
          layer: "vegetation",
          drawOrder: 1,
          scale: { min: 0.6, max: 1 },
          rotation: true,
        },
      ],
      priority: 20,
    });
    expect(result.issues).toEqual([]);
    expect(result.definition?.placements[0]?.frameIds).toEqual([0, 1, 2, 15]);
    expect(result.definition?.placements[0]?.drawOrder).toBe(1);
  });

  it("rejects unknown frames and duplicate placement ids", () => {
    const result = normalizeNaturalFeatureVisual({
      id: "natural_feature_visual:invalid",
      tagQuery: "ecoregion:tundra",
      textureSetId: "tundra",
      placements: [
        {
          id: "same",
          frameIds: [16],
          count: { min: 1, max: 1 },
          layoutId: "taiga_stand",
          lod: "simplified",
          layer: "vegetation",
        },
        {
          id: "same",
          frameIds: [0],
          count: { min: 1, max: 1 },
          layoutId: "taiga_stand",
          lod: "simplified",
          layer: "vegetation",
        },
        {
          id: "unknown-layout",
          frameIds: [0],
          count: { min: 1, max: 1 },
          layoutId: "random_scatter",
          lod: "simplified",
          layer: "vegetation",
        },
      ],
    });
    expect(result.definition).toBeNull();
    expect(result.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("range 0..15"),
        expect.stringContaining("duplicates same"),
        expect.stringContaining("known natural composition layout"),
      ]),
    );
  });
});
