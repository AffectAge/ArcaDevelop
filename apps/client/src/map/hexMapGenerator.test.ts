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
});
