import { describe, expect, it } from "vitest";
import type { HexTile } from "@arcanorum/shared";
import {
  resolveTerrainTextureFrame,
  resolveTerrainFieldVariant,
  resolveTerrainTextureGroup,
  resolveTileObjectTextureGroups,
  stableTextureVariant,
} from "./hexTextureFrames";

describe("hexTextureFrames", () => {
  it("maps authored tags to bitmap terrain groups", () => {
    expect(resolveTerrainTextureGroup(makeTile({ mapTags: ["biome:desert"] }))).toBe("desert");
    expect(resolveTerrainTextureGroup(makeTile({ mapTags: ["biome:tropical", "feature:wet"] }))).toBe("marsh");
    expect(resolveTerrainTextureGroup(makeTile({ waterKind: "ocean" }))).toBe("deep_water");
  });

  it("selects coordinate-continuous field variants inside the group range", () => {
    const tile = makeTile({ id: "hex:44:12", q: 44, r: 12, mapTags: ["biome:desert"] });
    expect(resolveTerrainTextureFrame(tile)).toBe(5);
    expect(resolveTerrainFieldVariant(tile)).toBe(0);
    expect(resolveTerrainFieldVariant({ q: -1, r: -1 })).toBe(0);
    expect(stableTextureVariant(tile.id, 4)).toBe(stableTextureVariant(tile.id, 4));
  });

  it("does not route natural geography through the special-site atlas", () => {
    expect(resolveTileObjectTextureGroups(makeTile({ mapTags: ["biome:grassland", "morphology:rough", "feature:vegetated"] })))
      .toEqual([]);
  });

});

function makeTile(overrides: Partial<HexTile>): HexTile {
  return {
    id: "hex:0:0",
    chunkId: "hex-chunk:0:0",
    regionId: "region:test",
    q: 0,
    r: 0,
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
    ...overrides,
  };
}
