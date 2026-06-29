import { describe, expect, it } from "vitest";
import {
  FEATURE_ATLAS_FRAME_SIZE,
  FEATURE_ATLAS_HEIGHT,
  FEATURE_ATLAS_ROWS,
  FEATURE_ATLAS_VARIANTS,
  FEATURE_ATLAS_WIDTH,
  getFeatureAtlasRow,
  getFeatureAtlasUrl,
  resolveFeatureAtlasVariant,
} from "./featureAtlas";

describe("feature atlas paths", () => {
  it("uses four 64px variants in one horizontal atlas", () => {
    expect(FEATURE_ATLAS_FRAME_SIZE).toBe(64);
    expect(FEATURE_ATLAS_VARIANTS).toBe(4);
    expect(FEATURE_ATLAS_WIDTH).toBe(256);
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
    expect(first).toBeLessThan(4);
  });

  it("keeps different feature types on different atlas rows", () => {
    expect(getFeatureAtlasRow("feature:forest")).not.toBe(getFeatureAtlasRow("feature:scrub"));
    expect(getFeatureAtlasRow("feature:forest")).toBeGreaterThanOrEqual(0);
    expect(getFeatureAtlasRow("feature:scrub")).toBeLessThan(FEATURE_ATLAS_ROWS.length);
  });
});
