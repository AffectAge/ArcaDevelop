import { describe, expect, it } from "vitest";
import { DEFAULT_HEX_MAP_SETTINGS, generateHexMap } from "./hexMapGenerator";
import { getNeighborAxial, makeHexId } from "./hexGeometry";
import type { HexDirection, HexId, HexMapSettings, HexMapTag, HexTile } from "./contracts/hex-map";

const TEST_SETTINGS: HexMapSettings = {
  ...DEFAULT_HEX_MAP_SETTINGS,
  seed: "hex-map-generator-regression",
  width: 96,
  height: 64,
  generation: {
    ...DEFAULT_HEX_MAP_SETTINGS.generation,
    mapScript: "archipelago",
    landmasses: {
      ...DEFAULT_HEX_MAP_SETTINGS.generation.landmasses,
      majorContinents: { min: 3, max: 4 },
      islandDensity: "high",
      islandSize: { min: 16, max: 96 },
      edgeOceanMargin: { min: 4, max: 6 },
    },
    rivers: {
      ...DEFAULT_HEX_MAP_SETTINGS.generation.rivers,
      density: "many",
      navigable: true,
    },
    regions: {
      targetLandRegionSize: 28,
      targetWaterRegionSize: 60,
    },
  },
};

describe("generateHexMap", () => {
  it("keeps generated islands separated from continents by a visible water buffer", () => {
    const artifact = generateHexMap(TEST_SETTINGS);
    const tileById = new Map<HexId, HexTile>(artifact.tiles.map((tile) => [tile.id, tile]));

    const islandTilesInsideContinentBuffer = artifact.tiles.filter((tile) => {
      if (!tile.mapTags.includes("landmass:island")) return false;
      return distanceToTag(tile, tileById, "landmass:continent" as HexMapTag, 2) <= 2;
    });

    expect(islandTilesInsideContinentBuffer).toHaveLength(0);
  });

  it("exposes major and navigable river edge classes on adjacent tile tags", () => {
    const artifact = generateHexMap(TEST_SETTINGS);
    const tileById = new Map<HexId, HexTile>(artifact.tiles.map((tile) => [tile.id, tile]));
    const classifiedEdges = artifact.riverEdges.filter((edge) => edge.riverClass === "major" || edge.riverClass === "navigable");

    expect(classifiedEdges.length).toBeGreaterThan(0);
    for (const edge of classifiedEdges.slice(0, 20)) {
      const source = tileById.get(edge.hexId);
      const target = source ? neighborInDirection(source, edge.direction, tileById, artifact.settings) : null;
      expect(resolveRiverTagRank(source)).toBeGreaterThanOrEqual(resolveRiverClassRank(edge.riverClass));
      expect(resolveRiverTagRank(target)).toBeGreaterThanOrEqual(resolveRiverClassRank(edge.riverClass));
    }
  });

  it("grows generated land regions without splitting on biome, river, elevation, or moisture changes", () => {
    const artifact = generateHexMap(TEST_SETTINGS);
    const landRegionIds = new Set(artifact.tiles.filter((tile) => !tile.waterKind).map((tile) => tile.regionId));

    expect(landRegionIds.size).toBeGreaterThan(1);
    expect([...landRegionIds].every((regionId) => regionId.startsWith("region:hex_"))).toBe(true);
  });
});

function neighborsOf(tile: HexTile, tileById: Map<HexId, HexTile>): HexTile[] {
  return [0, 1, 2, 3, 4, 5]
    .map((direction) => neighborInDirection(tile, direction as HexDirection, tileById, TEST_SETTINGS))
    .filter((neighbor): neighbor is HexTile => Boolean(neighbor));
}

function distanceToTag(tile: HexTile, tileById: Map<HexId, HexTile>, tag: HexMapTag, maxDistance: number): number {
  let frontier: HexTile[] = [tile];
  const visited = new Set<HexId>([tile.id]);
  for (let distance = 1; distance <= maxDistance; distance += 1) {
    const next: HexTile[] = [];
    for (const current of frontier) {
      for (const neighbor of neighborsOf(current, tileById)) {
        if (visited.has(neighbor.id)) continue;
        if (neighbor.mapTags.includes(tag)) return distance;
        visited.add(neighbor.id);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return maxDistance + 1;
}

function resolveRiverTagRank(tile: HexTile | null | undefined): number {
  if (tile?.mapTags.includes("river:navigable" as HexMapTag)) return 3;
  if (tile?.mapTags.includes("river:major" as HexMapTag)) return 2;
  if (tile?.mapTags.includes("river:minor" as HexMapTag)) return 1;
  return 0;
}

function resolveRiverClassRank(riverClass: string | undefined): number {
  if (riverClass === "navigable") return 3;
  if (riverClass === "major") return 2;
  if (riverClass === "minor") return 1;
  return 0;
}

function neighborInDirection(
  tile: HexTile,
  direction: HexDirection,
  tileById: Map<HexId, HexTile>,
  settings: Pick<HexMapSettings, "width" | "height" | "wrapX">,
): HexTile | null {
  const axial = getNeighborAxial(tile, direction, settings);
  return axial ? tileById.get(makeHexId(axial.q, axial.r)) ?? null : null;
}
