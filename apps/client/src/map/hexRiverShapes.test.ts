import { describe, expect, it } from "vitest";
import type { HexMapArtifact, HexTile } from "@arcanorum/shared";
import { classifyRiverMask, collectHexRiverShapes, resolveRiverShapeAtlasColumn, resolveRiverShapeSpriteRotation, selectRiverShapeVariant } from "./hexRiverShapes";

describe("hex river shapes", () => {
  it("collects outgoing and incoming river connections", () => {
    const map = makeMap([
      makeTile(0, 0),
      makeTile(1, 0),
    ]);
    map.riverEdges = [{ hexId: "hex:0:0", direction: 0, width: 1.5 }];

    const shapes = collectHexRiverShapes(map);

    expect(shapes).toEqual([
      expect.objectContaining({ hexId: "hex:0:0", mask: 1 << 0, kind: "end", rotation: 0, width: 1.5 }),
      expect.objectContaining({ hexId: "hex:1:0", mask: 1 << 3, kind: "end", rotation: 3, width: 1.5 }),
    ]);
  });

  it("classifies straight, bend, fork, and junction masks", () => {
    expect(classifyRiverMask((1 << 0) | (1 << 3))).toEqual({ kind: "straight", rotation: 0 });
    expect(classifyRiverMask((1 << 0) | (1 << 1))).toEqual({ kind: "bend", rotation: 0 });
    expect(classifyRiverMask((1 << 5) | (1 << 0) | (1 << 1))).toEqual({ kind: "fork_3", rotation: 0 });
    expect(classifyRiverMask((1 << 0) | (1 << 1) | (1 << 3) | (1 << 4))).toEqual({ kind: "junction_4", rotation: 2 });
    expect(classifyRiverMask((1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4))).toEqual({ kind: "junction_5", rotation: 5 });
    expect(classifyRiverMask((1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5))).toEqual({ kind: "junction_6", rotation: 0 });
  });

  it("selects deterministic visual variants", () => {
    const first = selectRiverShapeVariant("hex:12:8", (1 << 0) | (1 << 1), "bend");
    const second = selectRiverShapeVariant("hex:12:8", (1 << 0) | (1 << 1), "bend");
    const differentMask = selectRiverShapeVariant("hex:12:8", (1 << 0) | (1 << 3), "straight");

    expect(second).toBe(first);
    expect(first).toBe(0);
    expect(differentMask).toBe(0);
  });

  it("uses exact mask atlas columns without sprite rotation", () => {
    expect(resolveRiverShapeAtlasColumn((1 << 0) | (1 << 5))).toBe(33);
    expect(resolveRiverShapeAtlasColumn((1 << 1) | (1 << 4))).toBe(18);
    expect(resolveRiverShapeSpriteRotation(0)).toBe(0);
    expect(resolveRiverShapeSpriteRotation(1)).toBe(0);
    expect(resolveRiverShapeSpriteRotation(5)).toBe(0);
  });
});

function makeMap(tiles: HexTile[]): HexMapArtifact {
  return {
    version: 1,
    settings: {
      seed: "river-shapes-test",
      width: 4,
      height: 4,
      hexSize: 18,
      seaLevel: 0.5,
      temperature: 0.5,
      moisture: 0.5,
      mountains: 0.6,
      rivers: 0.5,
      forests: 0.5,
      targetLandRegionSize: 4,
      targetWaterRegionSize: 4,
      chunkSize: 4,
      wrapX: false,
    },
    tiles,
    riverEdges: [],
    coastOverlays: [],
  };
}

function makeTile(q: number, r: number): HexTile {
  return {
    id: `hex:${q}:${r}`,
    q,
    r,
    chunkId: "hex-chunk:0:0",
    regionId: "region:land:test",
    terrain: "plains",
    biome: "temperate",
    feature: "none",
    waterKind: null,
    elevation: 0.7,
    moisture: 0.5,
    temperature: 0.5,
    movementCost: 1,
    passable: true,
  };
}
