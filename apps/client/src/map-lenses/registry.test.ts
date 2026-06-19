import { describe, expect, it } from "vitest";
import { MAP_MODE_IDS, getMapLensDefinition, getMapLensZoomBucket } from "./registry";

describe("map lens registry", () => {
  it("registers every map mode with an entity level", () => {
    expect(MAP_MODE_IDS.map((id) => getMapLensDefinition(id).defaultEntityLevel)).toEqual([
      "region",
      "region",
      "province",
      "region",
      "region",
      "region",
      "region",
      "region",
      "region",
      "province",
    ]);
  });

  it("buckets zoom without recomputing for every zoom tick", () => {
    expect(getMapLensZoomBucket(0.5)).toBe("far");
    expect(getMapLensZoomBucket(2)).toBe("medium");
    expect(getMapLensZoomBucket(4)).toBe("near");
  });
});
