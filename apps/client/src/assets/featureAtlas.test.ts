import { describe, expect, it } from "vitest";
import {
  FEATURE_ATLAS_FRAME_SIZE,
  FEATURE_ATLAS_HEIGHT,
  FEATURE_ATLAS_ROWS,
  FEATURE_ATLAS_VARIANTS,
  FEATURE_ATLAS_WIDTH,
  getFeatureAtlasRow,
  getFeatureAtlasUrl,
  resolveFeatureAtlasFrame,
  resolveFeatureAtlasVariant,
} from "./featureAtlas";
import type { HexTile } from "@arcanorum/shared";

describe("feature atlas paths", () => {
  it("uses six 64px variants in one horizontal atlas", () => {
    expect(FEATURE_ATLAS_FRAME_SIZE).toBe(64);
    expect(FEATURE_ATLAS_VARIANTS).toBe(6);
    expect(FEATURE_ATLAS_WIDTH).toBe(384);
    expect(FEATURE_ATLAS_HEIGHT).toBe(FEATURE_ATLAS_ROWS.length * 64);
  });

  it("builds one scenario-owned atlas URL without authored URL fields", () => {
    expect(getFeatureAtlasUrl("demo")).toBe("/scenario-assets/demo/assets/features/feature-atlas.png");
    expect(getFeatureAtlasUrl("../demo")).toBe("/scenario-assets/default/assets/features/feature-atlas.png");
  });

  it("selects stable variants within the atlas range", () => {
    const first = resolveFeatureAtlasVariant("feature:forest:hex:1:2");
    expect(first).toBe(resolveFeatureAtlasVariant("feature:forest:hex:1:2"));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(6);
  });

  it("selects conditional frames from tile metadata before random fallback", () => {
    const alpineTile = makeTile({
      mapTags: ["morphology:mountainous", "feature:snow"],
      elevation: 0.9,
      temperature: 0.26,
      temperatureBand: "cold",
    });

    expect(resolveFeatureAtlasFrame({ visualId: "feature:snowcap", tile: alpineTile, seed: "snow-high" })).toBe(5);
  });

  it("keeps different feature types on different atlas rows", () => {
    expect(getFeatureAtlasRow("feature:forest")).not.toBe(getFeatureAtlasRow("feature:scrub"));
    expect(getFeatureAtlasRow("feature:forest")).toBeGreaterThanOrEqual(0);
    expect(getFeatureAtlasRow("feature:scrub")).toBeLessThan(FEATURE_ATLAS_ROWS.length);
  });
});

function makeTile(overrides: Partial<HexTile>): HexTile {
  return {
    id: "hex:1:2",
    q: 1,
    r: 2,
    chunkId: "hex-chunk:0:0",
    regionId: "region:land:0",
    waterKind: null,
    elevation: 0.5,
    moisture: 0.5,
    temperature: 0.5,
    temperatureBand: "temperate",
    moistureBand: "normal",
    distanceToWater: 3,
    isCoastal: false,
    riverMask: 0,
    riverWidth: 0,
    mapTags: ["biome:plains", "morphology:flat"],
    movementCost: 1,
    passable: true,
    ...overrides,
  };
}
