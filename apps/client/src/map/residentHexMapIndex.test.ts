import {
  DEFAULT_HEX_MAP_SETTINGS,
  type HexChunkId,
  type HexId,
  type HexMapClientChunk,
  type HexTile,
  type MapFeatureInstance,
  type RegionId,
} from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import { ResidentHexMapIndex } from "./residentHexMapIndex";

describe("ResidentHexMapIndex", () => {
  it("upserts idempotently and replaces only the changed chunk", () => {
    const index = new ResidentHexMapIndex(DEFAULT_HEX_MAP_SETTINGS);
    const original = createChunk("hex-chunk:0:0", [
      createTile(0, 0, "hex-chunk:0:0", "region:alpha"),
      createTile(1, 0, "hex-chunk:0:0", "region:alpha"),
    ]);

    expect(index.upsertChunk(original)).toBe(true);
    expect(index.upsertChunk(original)).toBe(false);
    expect(index.artifact.tiles).toHaveLength(2);
    expect(
      index.upsertChunk({
        ...original,
        tiles: [...original.tiles],
        riverEdges: [...original.riverEdges],
        coastOverlays: [...original.coastOverlays],
        features: [...original.features],
      }),
    ).toBe(true);
    expect(index.artifact.tiles).toHaveLength(2);

    const replacement = createChunk("hex-chunk:0:0", [
      createTile(0, 0, "hex-chunk:0:0", "region:beta"),
      createTile(2, 0, "hex-chunk:0:0", "region:beta"),
    ]);
    expect(index.upsertChunk(replacement)).toBe(true);

    const snapshot = index.createSnapshot();
    expect(index.chunkCount).toBe(1);
    expect(snapshot.tileById.has("hex:1:0")).toBe(false);
    expect(snapshot.tileById.get("hex:0:0")?.regionId).toBe("region:beta");
    expect(snapshot.tileById.has("hex:2:0")).toBe(true);
    expect(snapshot.tilesByRegionId.has("region:alpha")).toBe(false);
    expect(
      snapshot.tilesByRegionId.get("region:beta")?.map((tile) => tile.id),
    ).toEqual(expect.arrayContaining(["hex:0:0", "hex:2:0"]));
  });

  it("reference-counts duplicate rivers, coasts, and features across chunks", () => {
    const index = new ResidentHexMapIndex(DEFAULT_HEX_MAP_SETTINGS);
    const sharedFeature = createFeature("map_feature:shared", "hex:0:0");
    const first = createChunk(
      "hex-chunk:0:0",
      [createTile(0, 0, "hex-chunk:0:0", "region:alpha")],
      {
        riverEdges: [{ hexId: "hex:0:0", direction: 1, width: 2 }],
        coastOverlays: [{ hexId: "hex:0:0", direction: 2, strength: 0.8 }],
        features: [sharedFeature, sharedFeature],
      },
    );
    const second = createChunk(
      "hex-chunk:1:0",
      [createTile(1, 0, "hex-chunk:1:0", "region:alpha")],
      {
        riverEdges: [{ hexId: "hex:0:0", direction: 1, width: 2 }],
        coastOverlays: [{ hexId: "hex:0:0", direction: 2, strength: 0.8 }],
        features: [sharedFeature],
      },
    );

    index.upsertChunk(first);
    index.upsertChunk(second);
    expect(index.artifact.riverEdges).toHaveLength(1);
    expect(index.artifact.coastOverlays).toHaveLength(1);
    expect(index.createSnapshot().features).toHaveLength(1);

    expect(index.removeChunks([first.id])).toBe(true);
    expect(index.artifact.riverEdges).toHaveLength(1);
    expect(index.artifact.coastOverlays).toHaveLength(1);
    expect(index.createSnapshot().features).toHaveLength(1);

    expect(index.removeChunks([second.id])).toBe(true);
    expect(index.artifact.riverEdges).toHaveLength(0);
    expect(index.artifact.coastOverlays).toHaveLength(0);
    expect(index.createSnapshot().features).toHaveLength(0);
  });

  it("removes tiles from packed and region indexes without disturbing other chunks", () => {
    const index = new ResidentHexMapIndex(DEFAULT_HEX_MAP_SETTINGS);
    const first = createChunk("hex-chunk:0:0", [
      createTile(0, 0, "hex-chunk:0:0", "region:alpha"),
      createTile(1, 0, "hex-chunk:0:0", "region:beta"),
    ]);
    const second = createChunk("hex-chunk:1:0", [
      createTile(2, 0, "hex-chunk:1:0", "region:alpha"),
    ]);
    index.upsertChunk(first);
    index.upsertChunk(second);
    const beforeRemoval = index.createSnapshot();

    expect(index.removeChunks([first.id, first.id, "hex-chunk:9:9"])).toBe(
      true,
    );
    expect(index.artifact.tiles.map((tile) => tile.id)).toEqual(["hex:2:0"]);
    expect(beforeRemoval.tileById.has("hex:0:0")).toBe(false);
    expect(beforeRemoval.tileById.get("hex:2:0")?.chunkId).toBe(second.id);
    expect(beforeRemoval.tilesByRegionId.has("region:beta")).toBe(false);
    expect(
      beforeRemoval.tilesByRegionId.get("region:alpha")?.map((tile) => tile.id),
    ).toEqual(["hex:2:0"]);
    expect(index.removeChunks([first.id])).toBe(false);
  });

  it("clears all resident projections", () => {
    const index = new ResidentHexMapIndex(DEFAULT_HEX_MAP_SETTINGS);
    const chunk = createChunk(
      "hex-chunk:0:0",
      [createTile(0, 0, "hex-chunk:0:0", "region:alpha")],
      { features: [createFeature("map_feature:site", "hex:0:0")] },
    );
    index.upsertChunk(chunk);

    expect(index.clear()).toBe(true);
    expect(index.clear()).toBe(false);
    expect(index.chunkCount).toBe(0);
    expect(index.tileCount).toBe(0);
    expect(index.artifact.tiles).toHaveLength(0);
    expect(index.createSnapshot().features).toHaveLength(0);
  });

  it("rejects duplicate or cross-chunk primary tile ownership", () => {
    const index = new ResidentHexMapIndex(DEFAULT_HEX_MAP_SETTINGS);
    index.upsertChunk(
      createChunk("hex-chunk:0:0", [
        createTile(0, 0, "hex-chunk:0:0", "region:alpha"),
      ]),
    );

    expect(() =>
      index.upsertChunk(
        createChunk("hex-chunk:1:0", [
          createTile(0, 0, "hex-chunk:1:0", "region:alpha"),
        ]),
      ),
    ).toThrow(/already owned/);
    expect(index.tileCount).toBe(1);

    const duplicate = createTile(1, 0, "hex-chunk:1:0", "region:alpha");
    expect(() =>
      index.upsertChunk(createChunk("hex-chunk:1:0", [duplicate, duplicate])),
    ).toThrow(/Duplicate primary tile/);
    expect(index.tileCount).toBe(1);
  });
});

function createChunk(
  id: HexChunkId,
  tiles: HexTile[],
  records: Partial<
    Pick<HexMapClientChunk, "riverEdges" | "coastOverlays" | "features">
  > = {},
): HexMapClientChunk {
  return {
    formatVersion: 1,
    artifactVersion: "test-artifact",
    id,
    bounds: { minQ: 0, minR: 0, maxQ: 10, maxR: 10 },
    tiles,
    visualHalo: [],
    riverEdges: records.riverEdges ?? [],
    coastOverlays: records.coastOverlays ?? [],
    features: records.features ?? [],
  };
}

function createTile(
  q: number,
  r: number,
  chunkId: HexChunkId,
  regionId: RegionId,
): HexTile {
  return {
    id: `hex:${q}:${r}` as HexId,
    q,
    r,
    chunkId,
    regionId,
    waterKind: null,
    elevation: 0.5,
    moisture: 0.5,
    temperature: 0.5,
    temperatureBand: "temperate",
    moistureBand: "normal",
    distanceToWater: 2,
    isCoastal: false,
    riverMask: 0,
    riverWidth: 0,
    mapTags: [],
    movementCost: 1,
    passable: true,
  };
}

function createFeature(
  id: MapFeatureInstance["id"],
  hexId: HexId,
): MapFeatureInstance {
  return {
    id,
    typeId: "feature:ruins",
    category: "site",
    hexId,
    regionId: "region:alpha",
    visualId: "feature:ruins",
    visibility: "known",
  };
}
