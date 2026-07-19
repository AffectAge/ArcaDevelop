import { describe, expect, it } from "vitest";
import type { HexMapClientManifest } from "@arcanorum/shared";
import { DEFAULT_HEX_MAP_SETTINGS } from "../map/hexMapGenerator";
import { buildHexMapPerfVisualFixture } from "./hexMapPerfVisualFixture";

describe("hex map performance visual fixture", () => {
  it("seeds coherent country ownership plus city and unit markers from full manifest geography", () => {
    const manifest: HexMapClientManifest = {
      formatVersion: 1,
      artifactVersion: "fixture",
      settings: { ...DEFAULT_HEX_MAP_SETTINGS, width: 90, height: 30 },
      navigation: {
        fileName: "navigation.json",
        contentHash: "nav",
        byteLength: 1,
        gzipByteLength: 1,
        brotliByteLength: 1,
      },
      chunks: [],
      regions: Array.from({ length: 12 }, (_, index) => ({
        id: `region:${index}`,
        tileCount: 10,
        waterTileCount: 0,
        bounds: { minQ: index * 7, minR: 0, maxQ: index * 7 + 5, maxR: 5 },
        labelAnchor: { q: index * 7 + 2, r: 2 },
      })),
    };

    const fixture = buildHexMapPerfVisualFixture(manifest, {
      countryLabel: "Country",
      cityLabel: "City",
    });

    expect(Object.keys(fixture.worldBase.regionOwner)).toHaveLength(12);
    expect(new Set(Object.values(fixture.worldBase.regionOwner)).size).toBe(3);
    expect(Object.keys(fixture.worldBase.cityMarkersById)).toHaveLength(3);
    expect(Object.keys(fixture.worldBase.unitsById ?? {})).toHaveLength(3);
    expect(Object.keys(fixture.worldBase.civilianUnitsById)).toHaveLength(3);
    expect(
      Object.values(fixture.worldBase.cityMarkersById).every(
        (city) =>
          fixture.worldBase.regionOwner[city.regionId] === city.countryId,
      ),
    ).toBe(true);
  });
});
