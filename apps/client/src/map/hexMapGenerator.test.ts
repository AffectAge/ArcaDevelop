import { describe, expect, it } from "vitest";
import type { HexDirection } from "@arcanorum/shared";
import { getNeighborAxial, makeHexId } from "./hexGeometry";
import { DEFAULT_HEX_MAP_SETTINGS, generateHexMap } from "./hexMapGenerator";

const TEST_SETTINGS = {
  ...DEFAULT_HEX_MAP_SETTINGS,
  width: 48,
  height: 30,
  generation: {
    ...DEFAULT_HEX_MAP_SETTINGS.generation,
    regions: {
      ...DEFAULT_HEX_MAP_SETTINGS.generation.regions,
      targetLandRegionSize: 18,
      targetWaterRegionSize: 30,
    },
  },
};

describe("generateHexMap", () => {
  it("is deterministic for the same seed and settings", () => {
    const first = generateHexMap(TEST_SETTINGS);
    const second = generateHexMap(TEST_SETTINGS);

    expect(second).toEqual(first);
  });

  it("does not wrap X neighbors across the world edge", () => {
    const map = generateHexMap(TEST_SETTINGS);
    const neighbor = getNeighborAxial({ q: 0, r: 10 }, 3, map.settings);

    expect(neighbor).toBeNull();
  });

  it("keeps generated land away from rectangular map edges", () => {
    const map = generateHexMap(TEST_SETTINGS);
    const edgeTiles = map.tiles.filter((tile) => tile.q === 0 || tile.r === 0 || tile.q === map.settings.width - 1 || tile.r === map.settings.height - 1);

    expect(edgeTiles.length).toBeGreaterThan(0);
    expect(edgeTiles.every((tile) => tile.waterKind != null)).toBe(true);
  });

  it("assigns coastal water to land regions while keeping ocean regions separate", () => {
    const map = generateHexMap(TEST_SETTINGS);
    const landRegionIds = new Set(map.tiles.filter((tile) => tile.waterKind == null).map((tile) => tile.regionId));
    const oceanTiles = map.tiles.filter((tile) => tile.mapTags.includes("water:ocean"));

    expect(oceanTiles.length).toBeGreaterThan(0);
    expect(oceanTiles.every((tile) => !landRegionIds.has(tile.regionId))).toBe(true);
    expect(map.tiles.some((tile) => tile.mapTags.includes("water:coastal") && landRegionIds.has(tile.regionId))).toBe(true);
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

  it("adds visual map metadata for tags, bands, coasts, water distance, and rivers", () => {
    const map = generateHexMap(TEST_SETTINGS);
    const tileById = new Map(map.tiles.map((tile) => [tile.id, tile]));

    for (const tile of map.tiles) {
      expect(tile.mapTags.length).toBeGreaterThan(0);
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

  it("adds closed-vocabulary map tags to generated tiles", () => {
    const map = generateHexMap(TEST_SETTINGS);

    expect(map.tiles.every((tile) => Array.isArray(tile.mapTags) && tile.mapTags.length > 0)).toBe(true);
    expect(map.tiles.some((tile) => tile.mapTags?.includes("landmass:continent"))).toBe(true);
    expect(map.tiles.some((tile) => tile.mapTags?.includes("continent:homeland"))).toBe(true);
  });

  it("keeps island-tagged landmasses smaller than continent landmasses", () => {
    const map = generateHexMap({
      ...TEST_SETTINGS,
      seed: "island-size-regression",
      width: 72,
      height: 44,
      generation: {
        ...TEST_SETTINGS.generation,
        landmasses: {
          ...TEST_SETTINGS.generation.landmasses,
          islandDensity: "high",
          majorContinentSize: { min: 420, max: 760 },
          islandSize: { min: 8, max: 55 },
        },
      },
    });
    const components = collectLandComponents(map);
    const continentComponents = components.filter((component) => component.kind === "continent");
    const islandComponents = components.filter((component) => component.kind === "island");
    const largestContinent = Math.max(...continentComponents.map((component) => component.size));
    const largestIsland = Math.max(0, ...islandComponents.map((component) => component.size));

    expect(continentComponents.length).toBeGreaterThan(0);
    expect(islandComponents.length).toBeGreaterThan(0);
    expect(largestIsland).toBeLessThan(largestContinent * 0.45);
  });

  it("keeps continent seeds separated by ocean barriers on continents maps", () => {
    const map = generateHexMap({
      ...TEST_SETTINGS,
      seed: "three-continents",
      width: 96,
      height: 56,
      generation: {
        ...TEST_SETTINGS.generation,
        landmasses: {
          ...TEST_SETTINGS.generation.landmasses,
          majorContinents: { min: 3, max: 3 },
          majorContinentSize: { min: 420, max: 760 },
          islandSize: { min: 8, max: 55 },
        },
      },
    });
    const components = collectLandComponents(map);
    const largeContinents = components.filter((component) => component.kind === "continent" && component.size >= 350);
    const largestIsland = Math.max(0, ...components.filter((component) => component.kind === "island").map((component) => component.size));
    const smallestLargeContinent = Math.min(...largeContinents.map((component) => component.size));

    expect(largeContinents.length).toBeGreaterThanOrEqual(2);
    expect(largestIsland).toBeLessThan(smallestLargeContinent * 0.2);
  });

  it("honors scenario-authored continent and island size ranges", () => {
    const map = generateHexMap({
      ...TEST_SETTINGS,
      seed: "authored-landmass-size-ranges",
      width: 96,
      height: 56,
      generation: {
        ...TEST_SETTINGS.generation,
        landmasses: {
          ...TEST_SETTINGS.generation.landmasses,
          majorContinents: { min: 3, max: 3 },
          majorContinentSize: { min: 420, max: 760 },
          islandDensity: "high",
          islandSize: { min: 4, max: 35 },
        },
      },
    });
    const components = collectLandComponents(map);
    const continents = components.filter((component) => component.kind === "continent" && component.size >= 120);
    const islands = components.filter((component) => component.kind === "island");

    expect(continents.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...continents.map((component) => component.size))).toBeLessThan(1_200);
    expect(Math.max(0, ...islands.map((component) => component.size))).toBeLessThan(90);
  });

  it("smoke-generates all supported map scripts", () => {
    for (const mapScript of ["continents", "pangaea", "archipelago"] as const) {
      const map = generateHexMap({
        ...TEST_SETTINGS,
        seed: `test-${mapScript}`,
        generation: {
          ...TEST_SETTINGS.generation,
          mapScript,
        },
      });

      expect(map.tiles).toHaveLength(TEST_SETTINGS.width * TEST_SETTINGS.height);
      expect(new Set(map.tiles.map((tile) => tile.regionId)).size).toBeGreaterThan(0);
      expect(map.tiles.some((tile) => !tile.waterKind)).toBe(true);
      expect(map.tiles.some((tile) => tile.waterKind === "ocean")).toBe(true);
    }
  });
});

function collectLandComponents(map: ReturnType<typeof generateHexMap>): Array<{ kind: "continent" | "island"; size: number }> {
  const tileById = new Map(map.tiles.map((tile) => [tile.id, tile]));
  const visited = new Set<string>();
  const components: Array<{ kind: "continent" | "island"; size: number }> = [];

  for (const start of map.tiles) {
    if (start.waterKind || visited.has(start.id)) continue;
    const queue = [start.id];
    visited.add(start.id);
    let size = 0;
    let islandTags = 0;
    let continentTags = 0;
    while (queue.length > 0) {
      const tile = tileById.get(queue.pop()!);
      if (!tile) continue;
      size += 1;
      if (tile.mapTags.includes("landmass:island")) islandTags += 1;
      if (tile.mapTags.includes("landmass:continent")) continentTags += 1;
      for (let direction = 0; direction < 6; direction += 1) {
        const neighborAxial = getNeighborAxial(tile, direction as HexDirection, map.settings);
        const neighborId = neighborAxial ? makeHexId(neighborAxial.q, neighborAxial.r) : null;
        const neighbor = neighborId ? tileById.get(neighborId) : null;
        if (!neighbor || neighbor.waterKind || visited.has(neighbor.id)) continue;
        visited.add(neighbor.id);
        queue.push(neighbor.id);
      }
    }
    components.push({ kind: islandTags > continentTags ? "island" : "continent", size });
  }

  return components;
}
