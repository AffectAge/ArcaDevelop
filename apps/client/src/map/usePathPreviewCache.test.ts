import type { HexId, HexMapArtifact, HexTile } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import { createPathPreviewCache, getNeighborTiles } from "./usePathPreviewCache";

describe("path preview cache", () => {
  it("caches land and water paths separately", () => {
    const mapArtifact = makeMapArtifact([makeTile(0, 0), makeTile(1, 0, { waterKind: "sea", terrain: "sea", biome: "coastal_water" })]);
    const tileById = new Map(mapArtifact.tiles.map((tile) => [tile.id, tile] as const));
    const findLandPath = vi.fn(() => ["hex:0:0", "hex:1:0"] as HexId[]);
    const findWaterPath = vi.fn(() => ["hex:1:0"] as HexId[]);
    const cache = createPathPreviewCache({ mapArtifact, tileById, findLandPath, findWaterPath });

    expect(cache.getPreviewPath("land", "hex:0:0", "hex:1:0")).toEqual(["hex:0:0", "hex:1:0"]);
    expect(cache.getPreviewPath("land", "hex:0:0", "hex:1:0")).toEqual(["hex:0:0", "hex:1:0"]);
    expect(cache.getPreviewPath("water", "hex:0:0", "hex:1:0")).toEqual(["hex:1:0"]);
    expect(cache.getPreviewPath("water", "hex:0:0", "hex:1:0")).toEqual(["hex:1:0"]);

    expect(findLandPath).toHaveBeenCalledOnce();
    expect(findWaterPath).toHaveBeenCalledOnce();
    expect(cache.size()).toBe(2);
  });

  it("evicts the oldest preview when cache limit is exceeded", () => {
    const mapArtifact = makeMapArtifact([makeTile(0, 0), makeTile(1, 0), makeTile(2, 0)]);
    const tileById = new Map(mapArtifact.tiles.map((tile) => [tile.id, tile] as const));
    const findLandPath = vi.fn((_, fromHexId: HexId, targetHexId: HexId) => [fromHexId, targetHexId]);
    const cache = createPathPreviewCache({ mapArtifact, tileById, limit: 1, findLandPath });

    cache.getPreviewPath("land", "hex:0:0", "hex:1:0");
    cache.getPreviewPath("land", "hex:0:0", "hex:2:0");
    cache.getPreviewPath("land", "hex:0:0", "hex:1:0");

    expect(findLandPath).toHaveBeenCalledTimes(3);
    expect(cache.size()).toBe(1);
  });

  it("returns neighboring tiles without scanning the full map", () => {
    const mapArtifact = makeMapArtifact([makeTile(0, 0), makeTile(1, 0), makeTile(0, 1), makeTile(3, 3)]);
    const tileById = new Map(mapArtifact.tiles.map((tile) => [tile.id, tile] as const));

    expect(getNeighborTiles(mapArtifact.tiles[0]!, tileById, mapArtifact.settings).map((tile) => tile.id).sort()).toEqual([
      "hex:0:1",
      "hex:1:0",
    ]);
  });
});

function makeMapArtifact(tiles: HexTile[]): HexMapArtifact {
  return {
    version: 1,
    settings: { seed: "test", width: 4, height: 4, hexSize: 10, seaLevel: 0.34, temperature: 0.5, moisture: 0.5, mountains: 0.4, rivers: 0.2, forests: 0.5, targetLandRegionSize: 8, targetWaterRegionSize: 16, chunkSize: 16, wrapX: false },
    tiles,
    riverEdges: [],
    coastOverlays: [],
  };
}

function makeTile(q: number, r: number, overrides?: Partial<HexTile>): HexTile {
  return {
    id: `hex:${q}:${r}` as HexId,
    q,
    r,
    chunkId: "hex-chunk:0:0",
    regionId: "region:a",
    terrain: "plains",
    biome: "temperate_grassland",
    feature: "none",
    waterKind: null,
    elevation: 0.5,
    moisture: 0.5,
    temperature: 0.5,
    temperatureBand: "temperate",
    moistureBand: "normal",
    distanceToWater: 1,
    isCoastal: false,
    riverMask: 0,
    riverWidth: 0,
    movementCost: 1,
    passable: true,
    ...overrides,
  } as HexTile;
}
