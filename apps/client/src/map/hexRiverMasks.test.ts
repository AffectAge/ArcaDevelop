import { describe, expect, it } from "vitest";
import { DEFAULT_HEX_MAP_SETTINGS, type HexMapArtifact, type HexTile } from "@arcanorum/shared";
import { collectHexRiverMaskDrafts, collectHexRiverMaskParams, resolveHexRiverMaskAtlasIndex, resolveHexRiverStrength } from "./hexRiverMasks";
import { generatedHexMaterialPack } from "./hexTerrainMaterials";

describe("hex river masks", () => {
  it("collects outgoing and incoming river connections", () => {
    const map = makeMap([
      makeTile(0, 0),
      makeTile(1, 0),
    ]);
    map.riverEdges = [{ hexId: "hex:0:0", direction: 0, width: 1.5 }];

    const drafts = collectHexRiverMaskDrafts(map);

    expect(drafts.get("hex:0:0")).toEqual({ rawMask: 1 << 0, width: 1.5 });
    expect(drafts.get("hex:1:0")).toEqual({ rawMask: 1 << 3, width: 1.5 });
  });

  it("selects stable atlas variants inside the raw mask group", () => {
    const rawMask = (1 << 0) | (1 << 1);
    const first = resolveHexRiverMaskAtlasIndex("hex:12:8", rawMask);
    const second = resolveHexRiverMaskAtlasIndex("hex:12:8", rawMask);
    const other = resolveHexRiverMaskAtlasIndex("hex:12:9", rawMask);
    const variants = generatedHexMaterialPack.riverMasks.variants;

    expect(second).toBe(first);
    expect(first).toBeGreaterThanOrEqual(rawMask * variants);
    expect(first).toBeLessThan((rawMask + 1) * variants);
    expect(other).toBeGreaterThanOrEqual(rawMask * variants);
    expect(other).toBeLessThan((rawMask + 1) * variants);
  });

  it("emits disabled params by omission for hexes without river connections", () => {
    const map = makeMap([makeTile(0, 0)]);

    expect(collectHexRiverMaskParams(map).has("hex:0:0")).toBe(false);
  });

  it("normalizes river width into a bounded shader strength", () => {
    expect(resolveHexRiverStrength(0.1)).toBe(0.28);
    expect(resolveHexRiverStrength(1.7)).toBeCloseTo(0.5);
    expect(resolveHexRiverStrength(10)).toBe(1);
  });
});

function makeMap(tiles: HexTile[]): HexMapArtifact {
  return {
    version: 1,
    settings: {
      ...DEFAULT_HEX_MAP_SETTINGS,
      seed: "river-masks-test",
      width: 4,
      height: 4,
      hexSize: 18,
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
    biome: "temperate_grassland",
    feature: "none",
    waterKind: null,
    elevation: 0.7,
    moisture: 0.5,
    temperature: 0.5,
    temperatureBand: "temperate",
    moistureBand: "normal",
    distanceToWater: 3,
    isCoastal: false,
    riverMask: 0,
    riverWidth: 0,
    movementCost: 1,
    passable: true,
  };
}
