import { describe, expect, it } from "vitest";
import type { HexDirection } from "@arcanorum/shared";
import { getNeighborAxial, makeHexId } from "./hexGeometry";
import { DEFAULT_HEX_MAP_SETTINGS, generateHexMap } from "./hexMapGenerator";

const TEST_SETTINGS = {
  ...DEFAULT_HEX_MAP_SETTINGS,
  width: 48,
  height: 30,
  targetLandRegionSize: 18,
  targetWaterRegionSize: 30,
};

describe("generateHexMap", () => {
  it("is deterministic for the same seed and settings", () => {
    const first = generateHexMap(TEST_SETTINGS);
    const second = generateHexMap(TEST_SETTINGS);

    expect(second).toEqual(first);
  });

  it("wraps X neighbors across the world edge", () => {
    const map = generateHexMap(TEST_SETTINGS);
    const neighbor = getNeighborAxial({ q: 0, r: 10 }, 3, map.settings);

    expect(neighbor).toEqual({ q: map.settings.width - 1, r: 10 });
  });

  it("does not mix land and water tiles inside generated regions", () => {
    const map = generateHexMap(TEST_SETTINGS);
    const regionKinds = new Map<string, "land" | "water">();

    for (const tile of map.tiles) {
      const kind = tile.waterKind ? "water" : "land";
      const existing = regionKinds.get(tile.regionId);
      expect(existing ?? kind).toBe(kind);
      regionKinds.set(tile.regionId, kind);
    }
  });

  it("uses valid river edges", () => {
    const map = generateHexMap(TEST_SETTINGS);
    const tileIds = new Set(map.tiles.map((tile) => tile.id));

    for (const edge of map.riverEdges) {
      expect(tileIds.has(edge.hexId)).toBe(true);
      expect(edge.direction).toBeGreaterThanOrEqual(0);
      expect(edge.direction).toBeLessThanOrEqual(5);
      const tile = map.tiles.find((entry) => entry.id === edge.hexId);
      expect(tile).toBeTruthy();
      const neighbor = tile ? getNeighborAxial(tile, edge.direction as HexDirection, map.settings) : null;
      expect(neighbor ? tileIds.has(makeHexId(neighbor.q, neighbor.r)) : false).toBe(true);
    }
  });

  it("adds visual map metadata for biome, bands, coasts, water distance, and rivers", () => {
    const map = generateHexMap(TEST_SETTINGS);
    const tileById = new Map(map.tiles.map((tile) => [tile.id, tile]));

    for (const tile of map.tiles) {
      expect(tile.biome).toMatch(/^(deep_ocean|coastal_water|freshwater|temperate_grassland|temperate_forest|boreal_forest|tropical_rainforest|dry_scrubland|arid_desert|alpine|tundra|swamp|coastal_wetland)$/);
      expect(tile.temperatureBand).toMatch(/^(frozen|cold|cool|temperate|warm|hot)$/);
      expect(tile.moistureBand).toMatch(/^(arid|dry|normal|wet|saturated)$/);
      expect(tile.distanceToWater).toBeGreaterThanOrEqual(0);
      expect(tile.distanceToWater).toBeLessThanOrEqual(3);
      expect(typeof tile.isCoastal).toBe("boolean");
      expect(tile.riverMask).toBeGreaterThanOrEqual(0);
      expect(tile.riverMask).toBeLessThanOrEqual(63);
      expect(tile.riverWidth).toBeGreaterThanOrEqual(0);
      if (tile.waterKind) expect(tile.distanceToWater).toBe(0);
      if (tile.isCoastal) expect(tile.distanceToWater).toBe(1);
    }

    const river = map.riverEdges[0];
    if (river) {
      const source = tileById.get(river.hexId);
      expect(source ? source.riverMask & (1 << river.direction) : 0).not.toBe(0);
    }
  });

  it("adds coast overlays around lake neighbors", () => {
    const map = generateHexMap(TEST_SETTINGS);
    const tileById = new Map(map.tiles.map((tile) => [tile.id, tile]));
    const lakeCoast = map.coastOverlays.find((overlay) => {
      const tile = tileById.get(overlay.hexId);
      const neighborAxial = tile ? getNeighborAxial(tile, overlay.direction as HexDirection, map.settings) : null;
      const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
      return tile && !tile.waterKind && neighbor?.waterKind === "lake";
    });

    expect(lakeCoast).toBeTruthy();
  });
});
