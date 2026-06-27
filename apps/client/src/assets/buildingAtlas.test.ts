import { describe, expect, it } from "vitest";
import { getBuildingAtlasUrl, sanitizeBuildingAtlasId } from "./buildingAtlas";

describe("building atlas paths", () => {
  it("sanitizes building ids into scenario atlas filenames", () => {
    expect(sanitizeBuildingAtlasId("building:farm")).toBe("building_farm");
    expect(sanitizeBuildingAtlasId("building:water-mill_v2")).toBe("building_water-mill_v2");
  });

  it("builds scenario-owned atlas URLs without storing authored image URLs", () => {
    expect(getBuildingAtlasUrl("demo", "building:farm")).toBe("/scenario-assets/demo/assets/buildings/building_farm.png");
    expect(getBuildingAtlasUrl("../demo", "building:farm")).toBe("/scenario-assets/default/assets/buildings/building_farm.png");
  });
});
