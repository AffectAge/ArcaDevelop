import { describe, expect, it } from "vitest";
import { DEFAULT_HEX_MAP_SETTINGS, generateHexMap } from "./hexMapGenerator";
import { buildHexTerrainMeshData, resolveHexCoastMaskAtlasIndex, resolveHexCoastMaskParams, resolveHexNeighborMaterialIds } from "./hexTerrainMesh";
import { generatedHexMaterialPack, resolveShaderQualityFeatures, resolveTerrainMaterialId, TERRAIN_MATERIAL_IDS } from "./hexTerrainMaterials";
import { validateHexMaterialPack } from "./hexTerrainMaterialTextures";
import { axialToPixel, HEX_DIRECTIONS, makeHexId } from "./hexGeometry";

const smallMap = generateHexMap({ ...DEFAULT_HEX_MAP_SETTINGS, width: 24, height: 16, chunkSize: 8, seed: "mesh-test" });

describe("hex terrain mesh renderer data", () => {
  it("maps terrain and biome to stable material ids", () => {
    expect(resolveTerrainMaterialId({ terrain: "grassland", biome: "temperate", waterKind: null })).toBe("grass");
    expect(resolveTerrainMaterialId({ terrain: "desert", biome: "arid", waterKind: null })).toBe("sand");
    expect(resolveTerrainMaterialId({ terrain: "snow", biome: "cold", waterKind: null })).toBe("snow");
    expect(resolveTerrainMaterialId({ terrain: "sea", biome: "coastal_water", waterKind: "sea" })).toBe("coastal_water");
  });

  it("builds deterministic chunk geometry", () => {
    const first = buildHexTerrainMeshData(smallMap);
    const second = buildHexTerrainMeshData(smallMap);

    expect(first.chunks.map((chunk) => chunk.chunkId)).toEqual(second.chunks.map((chunk) => chunk.chunkId));
    expect(Array.from(first.chunks[0].positions.slice(0, 24))).toEqual(Array.from(second.chunks[0].positions.slice(0, 24)));
    expect(first.chunks[0].indices.length).toBeGreaterThan(0);
  });

  it("resolves six neighbor material weights for blending", () => {
    const tileById = new Map(smallMap.tiles.map((tile) => [tile.id, tile]));
    const tile = tileById.get(makeHexId(4, 4));

    expect(tile).toBeTruthy();
    expect(resolveHexNeighborMaterialIds(tile!, smallMap, tileById)).toHaveLength(6);
  });

  it("provides chunk data for single-world primary mesh instances", () => {
    const meshData = buildHexTerrainMeshData(smallMap);

    expect(meshData.chunks.length).toBeGreaterThan(0);
    expect(meshData.chunks.every((chunk) => chunk.bounds.left < chunk.bounds.right && chunk.bounds.top < chunk.bounds.bottom)).toBe(true);
  });

  it("emits material atlas indices for shader texture sampling", () => {
    const meshData = buildHexTerrainMeshData(smallMap);
    const indices = Array.from(meshData.chunks[0].materialIndices.slice(0, 12));

    expect(indices).toHaveLength(12);
    expect(indices.every((index) => Number.isInteger(index) && index >= 0)).toBe(true);
  });

  it("aligns material transition triangles with axial neighbor directions", () => {
    const tile = smallMap.tiles.find((candidate) => candidate.q > 2 && candidate.r > 2)!;
    const meshData = buildHexTerrainMeshData(smallMap);
    const chunk = meshData.chunks.find((candidate) => candidate.tileIds.includes(tile.id))!;
    const center = axialToPixel(tile, smallMap.settings.hexSize);
    const centerIndex = Array.from(chunk.positions).findIndex((value, index, values) => index % 2 === 0 && Math.abs(value - center.x) < 0.001 && Math.abs(values[index + 1] - center.y) < 0.001);

    expect(centerIndex).toBeGreaterThanOrEqual(0);
    for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
      const offset = HEX_DIRECTIONS[direction];
      const neighbor = axialToPixel({ q: tile.q + offset.q, r: tile.r + offset.r }, smallMap.settings.hexSize);
      const vertexOffset = centerIndex + direction * 6 + 2;
      const cornerA = { x: chunk.positions[vertexOffset], y: chunk.positions[vertexOffset + 1] };
      const cornerB = { x: chunk.positions[vertexOffset + 2], y: chunk.positions[vertexOffset + 3] };
      const midpoint = { x: (cornerA.x + cornerB.x) / 2, y: (cornerA.y + cornerB.y) / 2 };
      const edgeVector = { x: midpoint.x - center.x, y: midpoint.y - center.y };
      const neighborVector = { x: neighbor.x - center.x, y: neighbor.y - center.y };

      expect(edgeVector.x * neighborVector.x + edgeVector.y * neighborVector.y).toBeGreaterThan(0);
    }
  });

  it("covers every terrain material with generated atlas assets", () => {
    expect(() => validateHexMaterialPack(generatedHexMaterialPack)).not.toThrow();
    expect(Object.keys(generatedHexMaterialPack.materials).sort()).toEqual([...TERRAIN_MATERIAL_IDS].sort());
    expect(generatedHexMaterialPack.atlas.albedoUrl).toBe("/game-assets/hex-materials/hex-terrain-albedo.png");
    expect(generatedHexMaterialPack.atlas.detailUrl).toBe("/game-assets/hex-materials/hex-terrain-detail.png");
    expect(generatedHexMaterialPack.coastMasks).toMatchObject({
      url: "/game-assets/hex-materials/hex-coast-masks.png",
      columns: 16,
      rows: 16,
      tileSize: 128,
      variants: 4,
    });
  });

  it("keeps all quality levels on the shader mesh path", () => {
    expect(resolveShaderQualityFeatures("low")).toMatchObject({ detail: false, normal: false, coastMasks: false, coastFoam: false });
    expect(resolveShaderQualityFeatures("medium")).toMatchObject({ detail: true, normal: false, coastMasks: true, coastFoam: false });
    expect(resolveShaderQualityFeatures("high")).toMatchObject({ detail: true, normal: true, coastMasks: true, coastFoam: true });
  });

  it("derives deterministic coast mask bits from coast overlays", () => {
    const tile = smallMap.tiles.find((candidate) => candidate.q > 2 && candidate.r > 2)!;
    const map = {
      ...smallMap,
      coastOverlays: [
        { hexId: tile.id, direction: 0 as const, strength: 0.4 },
        { hexId: tile.id, direction: 2 as const, strength: 0.8 },
      ],
    };

    const coastParams = resolveHexCoastMaskParams(map).get(tile.id);
    const rawMask = (1 << 0) | (1 << 2);

    expect(coastParams).toEqual([resolveHexCoastMaskAtlasIndex(tile.id, rawMask), 0.8, generatedHexMaterialPack.materials.coastal_water.atlasIndex, 1]);
    expect(coastParams![0]).toBeGreaterThanOrEqual(rawMask * generatedHexMaterialPack.coastMasks.variants);
    expect(coastParams![0]).toBeLessThan((rawMask + 1) * generatedHexMaterialPack.coastMasks.variants);
  });

  it("selects stable coast mask variants by hex id and raw mask", () => {
    const rawMask = (1 << 1) | (1 << 4);
    const first = resolveHexCoastMaskAtlasIndex(makeHexId(4, 4), rawMask);
    const second = resolveHexCoastMaskAtlasIndex(makeHexId(4, 4), rawMask);
    const other = resolveHexCoastMaskAtlasIndex(makeHexId(5, 4), rawMask);
    const variants = generatedHexMaterialPack.coastMasks.variants;

    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(rawMask * variants);
    expect(first).toBeLessThan((rawMask + 1) * variants);
    expect(other).toBeGreaterThanOrEqual(rawMask * variants);
    expect(other).toBeLessThan((rawMask + 1) * variants);
  });

  it("emits coast params for coastal and non-coastal hexes", () => {
    const coastTile = smallMap.tiles.find((candidate) => candidate.q > 2 && candidate.r > 2)!;
    const nonCoastTile = smallMap.tiles.find((candidate) => candidate.id !== coastTile.id)!;
    const map = {
      ...smallMap,
      coastOverlays: [{ hexId: coastTile.id, direction: 1 as const, strength: 0.75 }],
    };
    const meshData = buildHexTerrainMeshData(map);
    const coastChunk = meshData.chunks.find((chunk) => chunk.tileIds.includes(coastTile.id))!;
    const nonCoastChunk = meshData.chunks.find((chunk) => chunk.tileIds.includes(nonCoastTile.id))!;
    const coastTileIndex = coastChunk.tileIds.indexOf(coastTile.id);
    const nonCoastTileIndex = nonCoastChunk.tileIds.indexOf(nonCoastTile.id);
    const coastParamOffset = coastTileIndex * 18 * 4;
    const nonCoastParamOffset = nonCoastTileIndex * 18 * 4;

    expect(Array.from(coastChunk.coastParams.slice(coastParamOffset, coastParamOffset + 4))).toEqual([resolveHexCoastMaskAtlasIndex(coastTile.id, 1 << 1), 0.75, generatedHexMaterialPack.materials.coastal_water.atlasIndex, 1]);
    expect(Array.from(nonCoastChunk.coastParams.slice(nonCoastParamOffset, nonCoastParamOffset + 4))).toEqual([0, 0, generatedHexMaterialPack.materials.coastal_water.atlasIndex, 0]);
    expect(coastChunk.coastParams.length).toBe((coastChunk.positions.length / 2) * 4);
  });
});
