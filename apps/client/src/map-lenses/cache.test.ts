import { describe, expect, it } from "vitest";
import { createMapLensCache } from "./cache";
import type { ComputedMapLens, MapLensComputationContext } from "./types";

const baseContext: MapLensComputationContext = {
  lensId: "political",
  worldVersion: 1,
  geometryVersion: 1,
  filterHash: "{}",
  perspectiveCountryId: "country_a",
  zoomBucket: "medium",
  selectedOverlayIds: [],
};

function computed(context: MapLensComputationContext, affectedEntityIds: string[]): ComputedMapLens {
  return {
    context,
    entityLevel: "region",
    paintPlan: null,
    entityColors: new Map(),
    tooltipDataByEntity: new Map(),
    affectedEntityIds: new Set(affectedEntityIds),
  };
}

describe("map lens cache", () => {
  it("keys entries by versioned computation context", () => {
    const cache = createMapLensCache();
    const first = computed(baseContext, ["region_a"]);
    cache.set(first);

    expect(cache.get(baseContext)).toBe(first);
    expect(cache.get({ ...baseContext, worldVersion: 2 })).toBeNull();
  });

  it("invalidates entries affected by changed entities", () => {
    const cache = createMapLensCache();
    cache.set(computed(baseContext, ["region_a"]));

    cache.invalidateAffected(new Set(["region_a"]));

    expect(cache.get(baseContext)).toBeNull();
  });
});
