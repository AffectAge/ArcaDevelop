import { describe, expect, it } from "vitest";
import type { HexId, HexTile } from "@arcanorum/shared";
import { collectBoundaryInvalidationHexIds, collectChangedRecordKeys, resolveHexBoundaryMask } from "./hexBorderMasks";

const settings = { width: 3, height: 3, wrapX: false };

describe("hexBorderMasks", () => {
  it("encodes only edges whose neighbor belongs to another group", () => {
    const center = makeTile(1, 1, "region:a");
    const east = makeTile(2, 1, "region:b");
    const tileById = new Map<HexId, HexTile>([[center.id, center], [east.id, east]]);
    const mask = resolveHexBoundaryMask({ tile: center, tileById, settings, resolveGroup: (tile) => tile.regionId, includeMapEdge: false });
    expect(mask & 1).toBe(1);
    expect(mask & (1 << 3)).toBe(0);
  });

  it("invalidates the changed hex and at most its six neighbors", () => {
    const tiles = Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, q) => makeTile(q, r, "region:a"))).flat();
    const tileById = new Map(tiles.map((tile) => [tile.id, tile] as const));
    const invalidated = collectBoundaryInvalidationHexIds(["hex:1:1"], tileById, settings);
    expect(invalidated.has("hex:1:1")).toBe(true);
    expect(invalidated.size).toBe(7);
  });

  it("finds added, removed, and changed region ownership keys", () => {
    expect([...collectChangedRecordKeys({ a: "one", b: "two" }, { a: "three", c: "two" })].sort()).toEqual(["a", "b", "c"]);
  });
});

function makeTile(q: number, r: number, regionId: HexTile["regionId"]): HexTile {
  return {
    id: `hex:${q}:${r}`,
    chunkId: "hex-chunk:0:0",
    regionId,
    q,
    r,
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
    mapTags: ["biome:grassland", "morphology:flat"],
    movementCost: 1,
    passable: true,
  };
}
