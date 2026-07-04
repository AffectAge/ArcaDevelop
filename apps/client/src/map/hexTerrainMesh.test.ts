import { describe, expect, it } from "vitest";
import type { HexDirection, HexId, HexMapArtifact, HexTile } from "@arcanorum/shared";
import { DEFAULT_HEX_MAP_SETTINGS, generateHexMap } from "./hexMapGenerator";
import { buildHexTerrainMeshData, resolveEffectiveTerrainMaterialId, resolveHexBiomeTransitionAtlasIndex, resolveHexCoastMaskAtlasIndex, resolveHexCoastMaskParams, resolveHexNeighborMaterialIds } from "./hexTerrainMesh";
import { generatedHexMaterialPack, isWaterMaterial, resolveShaderQualityFeatures, resolveTerrainMaterialAtlasIndex, resolveTerrainMaterialId, TERRAIN_MATERIAL_IDS } from "./hexTerrainMaterials";
import { validateHexMaterialPack } from "./hexTerrainMaterialTextures";
import { resolveHexRiverMaskAtlasIndex } from "./hexRiverMasks";
import { axialToPixel, getNeighborAxial, HEX_DIRECTIONS, makeHexId } from "./hexGeometry";

const smallMap = generateHexMap({ ...DEFAULT_HEX_MAP_SETTINGS, width: 24, height: 16, chunkSize: 8, seed: "mesh-test" });

describe("hex terrain mesh renderer data", () => {
  it("maps biome and relief tags to stable land material ids", () => {
    const matrix = [
      ["biome:tundra", "morphology:flat", "tundra_flat"],
      ["biome:tundra", "morphology:rough", "tundra_rough"],
      ["biome:tundra", "morphology:mountainous", "tundra_mountainous"],
      ["biome:grassland", "morphology:flat", "grassland_flat"],
      ["biome:grassland", "morphology:rough", "grassland_rough"],
      ["biome:grassland", "morphology:mountainous", "grassland_mountainous"],
      ["biome:plains", "morphology:flat", "plains_flat"],
      ["biome:plains", "morphology:rough", "plains_rough"],
      ["biome:plains", "morphology:mountainous", "plains_mountainous"],
      ["biome:desert", "morphology:flat", "desert_flat"],
      ["biome:desert", "morphology:rough", "desert_rough"],
      ["biome:desert", "morphology:mountainous", "desert_mountainous"],
      ["biome:tropical", "morphology:flat", "tropical_flat"],
      ["biome:tropical", "morphology:rough", "tropical_rough"],
      ["biome:tropical", "morphology:mountainous", "tropical_mountainous"],
    ] as const;

    for (const [biomeTag, morphologyTag, materialId] of matrix) {
      expect(resolveTerrainMaterialId({ mapTags: [biomeTag, morphologyTag], waterKind: null })).toBe(materialId);
    }
    expect(resolveTerrainMaterialId({ mapTags: ["biome:desert"], waterKind: null })).toBe("desert_flat");
    expect(resolveTerrainMaterialId({ mapTags: ["feature:snow"], waterKind: null })).toBe("grassland_flat");
    expect(resolveTerrainMaterialId({ mapTags: ["biome:grassland", "morphology:navigable_river"], waterKind: null })).toBe("grassland_flat");
    expect(resolveTerrainMaterialId({ mapTags: ["biome:grassland", "morphology:rough", "morphology:navigable_river"], waterKind: null })).toBe("grassland_rough");
    expect(resolveTerrainMaterialId({ mapTags: ["water:coastal"], waterKind: "sea" })).toBe("coastal_water");
  });

  it("uses city material for city-tagged hexes without changing terrain material mapping", () => {
    const tile = makeTestTile(1, 1, { mapTags: ["biome:plains"], waterKind: null });
    expect(resolveTerrainMaterialId(tile)).toBe("plains_flat");
    expect(resolveEffectiveTerrainMaterialId(tile, new Set([tile.id]))).toBe("city");
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
      const neighborAxial = getNeighborAxial(tile, direction as HexDirection, smallMap.settings);
      expect(neighborAxial).toBeTruthy();
      const neighbor = axialToPixel(neighborAxial!, smallMap.settings.hexSize);
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
    expect(generatedHexMaterialPack.atlas).toMatchObject({ columns: 5, rows: 4, tileSize: 128 });
    expect(generatedHexMaterialPack.atlas.columns * generatedHexMaterialPack.atlas.rows).toBeGreaterThanOrEqual(TERRAIN_MATERIAL_IDS.length);
    expect(new Set(TERRAIN_MATERIAL_IDS.map((id) => generatedHexMaterialPack.materials[id].atlasIndex)).size).toBe(TERRAIN_MATERIAL_IDS.length);
    expect(generatedHexMaterialPack.atlas.albedoUrl).toBe("/game-assets/hex-materials/hex-terrain-albedo.png");
    expect(generatedHexMaterialPack.atlas.detailUrl).toBe("/game-assets/hex-materials/hex-terrain-detail.png");
    expect(generatedHexMaterialPack.coastMasks).toMatchObject({
      url: "/game-assets/hex-materials/hex-coast-masks.png",
      columns: 16,
      rows: 16,
      tileSize: 128,
      variants: 4,
    });
    expect(generatedHexMaterialPack.biomeTransitions).toMatchObject({
      url: "/game-assets/hex-materials/hex-biome-transition-masks.png",
      columns: 16,
      rows: 6,
      tileSize: 128,
      variants: 16,
    });
    expect(generatedHexMaterialPack.riverMasks).toMatchObject({
      url: "/game-assets/hex-materials/hex-river-shape-masks.png",
      columns: 32,
      rows: 16,
      tileSize: 128,
      variants: 8,
    });
  });

  it("keeps all quality levels on the shader mesh path", () => {
    expect(resolveShaderQualityFeatures("low")).toMatchObject({ detail: false, normal: false, coastMasks: false, coastFoam: false, biomeTransitions: false, riverMasks: true });
    expect(resolveShaderQualityFeatures("medium")).toMatchObject({ detail: true, normal: false, coastMasks: true, coastFoam: false, biomeTransitions: true, riverMasks: true });
    expect(resolveShaderQualityFeatures("high")).toMatchObject({ detail: true, normal: true, coastMasks: true, coastFoam: true, biomeTransitions: true, riverMasks: true });
  });

  it("derives deterministic coast mask bits from coast overlays", () => {
    const tile = makeTestTile(1, 1, { mapTags: ["biome:grassland"], waterKind: null });
    const sea = makeTestTile(2, 1, { mapTags: ["water:coastal"], waterKind: "sea" });
    const map = {
      ...smallMap,
      settings: { ...smallMap.settings, width: 4, height: 4, wrapX: false },
      tiles: [tile, sea],
      coastOverlays: [
        { hexId: tile.id, direction: 0 as const, strength: 0.4 },
      ],
      riverEdges: [],
    };

    const coastParams = resolveHexCoastMaskParams(map).get(tile.id);
    const rawMask = 1 << 0;

    expect(coastParams).toEqual([resolveHexCoastMaskAtlasIndex(tile.id, rawMask), 0.4, resolveTerrainMaterialAtlasIndex("coastal_water"), 1]);
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
    const coastTile = makeTestTile(1, 1, { mapTags: ["biome:grassland"], waterKind: null });
    const sea = makeTestTile(2, 1, { mapTags: ["water:coastal"], waterKind: "sea" });
    const nonCoastTile = makeTestTile(0, 0, { mapTags: ["biome:plains"], waterKind: null });
    const map = {
      ...smallMap,
      settings: { ...smallMap.settings, width: 4, height: 4, wrapX: false },
      tiles: [coastTile, sea, nonCoastTile],
      coastOverlays: [{ hexId: coastTile.id, direction: 0 as const, strength: 0.75 }],
      riverEdges: [],
    };
    const meshData = buildHexTerrainMeshData(map);
    const coastChunk = meshData.chunks.find((chunk) => chunk.tileIds.includes(coastTile.id))!;
    const nonCoastChunk = meshData.chunks.find((chunk) => chunk.tileIds.includes(nonCoastTile.id))!;
    const coastTileIndex = coastChunk.tileIds.indexOf(coastTile.id);
    const nonCoastTileIndex = nonCoastChunk.tileIds.indexOf(nonCoastTile.id);
    const coastParamOffset = coastTileIndex * 18 * 4;
    const nonCoastParamOffset = nonCoastTileIndex * 18 * 4;

    expect(Array.from(coastChunk.coastParams.slice(coastParamOffset, coastParamOffset + 4))).toEqual([resolveHexCoastMaskAtlasIndex(coastTile.id, 1 << 0), 0.75, resolveTerrainMaterialAtlasIndex("coastal_water"), 1]);
    expect(Array.from(nonCoastChunk.coastParams.slice(nonCoastParamOffset, nonCoastParamOffset + 4))).toEqual([0, 0, resolveTerrainMaterialAtlasIndex("coastal_water"), 0]);
    expect(coastChunk.coastParams.length).toBe((coastChunk.positions.length / 2) * 4);
  });

  it("emits river params for connected and non-connected hexes", () => {
    const source = makeTestTile(1, 1, { terrain: "grassland", biome: "temperate_grassland", waterKind: null });
    const target = makeTestTile(2, 1, { terrain: "grassland", biome: "temperate_grassland", waterKind: null });
    const dry = makeTestTile(0, 0, { terrain: "grassland", biome: "temperate_grassland", waterKind: null });
    const map: HexMapArtifact = {
      ...smallMap,
      settings: { ...smallMap.settings, width: 4, height: 4, wrapX: false },
      tiles: [source, target, dry],
      coastOverlays: [],
      riverEdges: [{ hexId: source.id, direction: 0, width: 1.7 }],
    };
    const meshData = buildHexTerrainMeshData(map);
    const sourceMask = 1 << 0;
    const targetMask = 1 << 3;
    const variants = generatedHexMaterialPack.riverMasks.variants;
    const sourceParams = readRiverParams(meshData, source.id, 0);
    const targetParams = readRiverParams(meshData, target.id, 3);

    expect(sourceParams[0]).toBe(resolveHexRiverMaskAtlasIndex(source.id, sourceMask));
    expect(sourceParams[0]).toBeGreaterThanOrEqual(sourceMask * variants);
    expect(sourceParams[0]).toBeLessThan((sourceMask + 1) * variants);
    expect(sourceParams[1]).toBe(1);
    expect(sourceParams[2]).toBeCloseTo(0.5);
    expect(targetParams[0]).toBe(resolveHexRiverMaskAtlasIndex(target.id, targetMask));
    expect(targetParams[1]).toBe(1);
    expect(readRiverParams(meshData, dry.id, 0)).toEqual([0, 0, 0, 0]);
  });

  it("uses fresh water material for lake coastline masks on neighboring land hexes", () => {
    const land = makeTestTile(1, 1, { terrain: "grassland", biome: "temperate_grassland", waterKind: null });
    const lake = makeTestTile(2, 1, { terrain: "lake", biome: "freshwater", waterKind: "lake" });
    const map: HexMapArtifact = {
      ...smallMap,
      settings: { ...smallMap.settings, width: 4, height: 4, wrapX: false },
      tiles: [land, lake],
      coastOverlays: [{ hexId: land.id, direction: 0, strength: 0.5 }],
      riverEdges: [],
    };
    const coastParams = resolveHexCoastMaskParams(map).get(land.id);

    expect(coastParams?.[2]).toBe(resolveTerrainMaterialAtlasIndex("fresh_water"));
    expect(coastParams?.[1]).toBe(0.92);
    expect(coastParams?.[3]).toBe(1);
  });

  it("keeps land-land biome transition params on coastal land hexes", () => {
    const coastLand = makeTestTile(1, 1, { terrain: "grassland", biome: "temperate_grassland", waterKind: null });
    const neighborLand = makeTestTile(2, 1, { terrain: "plains", biome: "temperate_grassland", waterKind: null });
    const lake = makeTestTile(1, 2, { terrain: "lake", biome: "freshwater", waterKind: "lake" });
    const map: HexMapArtifact = {
      ...smallMap,
      settings: { ...smallMap.settings, width: 4, height: 4, wrapX: false },
      tiles: [coastLand, neighborLand, lake],
      coastOverlays: [{ hexId: coastLand.id, direction: 5, strength: 0.92 }],
      riverEdges: [],
    };
    const meshData = buildHexTerrainMeshData(map);

    expect(readTransitionParams(meshData, coastLand.id, 0)[1]).toBe(1);
  });

  it("emits biome transition params for different land material edges", () => {
    const land = makeTestTile(1, 1, { mapTags: ["biome:grassland"], waterKind: null });
    const neighbor = makeTestTile(2, 1, { mapTags: ["biome:plains"], waterKind: null });
    const map: HexMapArtifact = {
      ...smallMap,
      settings: { ...smallMap.settings, width: 4, height: 4, wrapX: false },
      tiles: [land, neighbor],
      coastOverlays: [],
      riverEdges: [],
    };
    const edge = { tile: land, neighbor, direction: 0 as HexDirection, baseMaterial: resolveTerrainMaterialId(land), neighborMaterial: resolveTerrainMaterialId(neighbor) };
    const meshData = buildHexTerrainMeshData(map);
    const chunk = meshData.chunks.find((candidate) => candidate.tileIds.includes(edge.tile.id))!;
    const tileIndex = chunk.tileIds.indexOf(edge.tile.id);
    const offset = (tileIndex * 18 + edge.direction * 3) * 4;
    const params = Array.from(chunk.transitionParams.slice(offset, offset + 4));
    const variants = generatedHexMaterialPack.biomeTransitions.variants;

    expect(params).toEqual([resolveHexBiomeTransitionAtlasIndex(edge.tile.id, edge.direction, edge.baseMaterial, edge.neighborMaterial), 1, 1, 0]);
    expect(params[0]).toBeGreaterThanOrEqual(edge.direction * variants);
    expect(params[0]).toBeLessThan((edge.direction + 1) * variants);
  });

  it("disables biome transition params for same material edges", () => {
    const sameEdge = findMaterialEdge((base, neighbor) => base === neighbor && !isWaterMaterial(base));
    const meshData = buildHexTerrainMeshData(smallMap);

    expect(readTransitionParams(meshData, sameEdge.tile.id, sameEdge.direction)).toEqual([0, 0, 0, 0]);
  });

  it("emits land-water biome transition params on the land side only", () => {
    const land = makeTestTile(1, 1, { terrain: "grassland", biome: "temperate_grassland", waterKind: null });
    const lake = makeTestTile(2, 1, { terrain: "lake", biome: "freshwater", waterKind: "lake" });
    const map: HexMapArtifact = {
      ...smallMap,
      settings: { ...smallMap.settings, width: 4, height: 4, wrapX: false },
      tiles: [land, lake],
      coastOverlays: [{ hexId: land.id, direction: 0, strength: 0.92 }],
      riverEdges: [],
    };
    const meshData = buildHexTerrainMeshData(map);

    expect(readTransitionParams(meshData, land.id, 0)[1]).toBe(1);
    expect(readTransitionParams(meshData, lake.id, 3)).toEqual([0, 0, 0, 0]);
  });

  it("emits separate biome transitions from one land hex to lake and sea neighbors", () => {
    const land = makeTestTile(1, 1, { terrain: "grassland", biome: "temperate_grassland", waterKind: null });
    const lake = makeTestTile(2, 1, { terrain: "lake", biome: "freshwater", waterKind: "lake" });
    const sea = makeTestTile(1, 0, { terrain: "sea", biome: "coastal_water", waterKind: "sea" });
    const map: HexMapArtifact = {
      ...smallMap,
      settings: { ...smallMap.settings, width: 4, height: 4, wrapX: false },
      tiles: [land, lake, sea],
      coastOverlays: [
        { hexId: land.id, direction: 0, strength: 0.92 },
        { hexId: land.id, direction: 2, strength: 0.58 },
      ],
      riverEdges: [],
    };
    const meshData = buildHexTerrainMeshData(map);
    const chunk = meshData.chunks.find((candidate) => candidate.tileIds.includes(land.id))!;
    const tileIndex = chunk.tileIds.indexOf(land.id);
    const lakeMaterialOffset = (tileIndex * 18 + 0 * 3) * 2;
    const seaMaterialOffset = (tileIndex * 18 + 2 * 3) * 2;

    expect(readTransitionParams(meshData, land.id, 0)[1]).toBe(1);
    expect(readTransitionParams(meshData, land.id, 2)[1]).toBe(1);
    expect(chunk.materialIndices[lakeMaterialOffset + 1]).toBe(resolveTerrainMaterialAtlasIndex("fresh_water"));
    expect(chunk.materialIndices[seaMaterialOffset + 1]).toBe(resolveTerrainMaterialAtlasIndex("coastal_water"));
  });

  it("emits separate coastline water materials from one land hex to lake and sea neighbors", () => {
    const land = makeTestTile(1, 1, { terrain: "grassland", biome: "temperate_grassland", waterKind: null });
    const lake = makeTestTile(2, 1, { terrain: "lake", biome: "freshwater", waterKind: "lake" });
    const sea = makeTestTile(1, 0, { terrain: "sea", biome: "coastal_water", waterKind: "sea" });
    const map: HexMapArtifact = {
      ...smallMap,
      settings: { ...smallMap.settings, width: 4, height: 4, wrapX: false },
      tiles: [land, lake, sea],
      coastOverlays: [
        { hexId: land.id, direction: 0, strength: 0.92 },
        { hexId: land.id, direction: 2, strength: 0.58 },
      ],
      riverEdges: [],
    };
    const meshData = buildHexTerrainMeshData(map);

    expect(readCoastParams(meshData, land.id, 0)[2]).toBe(resolveTerrainMaterialAtlasIndex("fresh_water"));
    expect(readCoastParams(meshData, land.id, 2)[2]).toBe(resolveTerrainMaterialAtlasIndex("coastal_water"));
  });

  it("emits biome transition params for different water material edges", () => {
    const ocean = makeTestTile(1, 1, { terrain: "ocean", biome: "deep_ocean", waterKind: "ocean" });
    const sea = makeTestTile(2, 1, { terrain: "sea", biome: "coastal_water", waterKind: "sea" });
    const map: HexMapArtifact = {
      ...smallMap,
      settings: { ...smallMap.settings, width: 4, height: 4, wrapX: false },
      tiles: [ocean, sea],
      coastOverlays: [],
      riverEdges: [],
    };
    const meshData = buildHexTerrainMeshData(map);

    expect(readTransitionParams(meshData, ocean.id, 0)[1]).toBe(1);
  });

  it("emits biome transition on only one side of a shared edge", () => {
    const land = makeTestTile(1, 1, { mapTags: ["biome:grassland"], waterKind: null });
    const neighbor = makeTestTile(2, 1, { mapTags: ["biome:plains"], waterKind: null });
    const map: HexMapArtifact = {
      ...smallMap,
      settings: { ...smallMap.settings, width: 4, height: 4, wrapX: false },
      tiles: [land, neighbor],
      coastOverlays: [],
      riverEdges: [],
    };
    const edge = { tile: land, neighbor, direction: 0 as HexDirection };
    const meshData = buildHexTerrainMeshData(map);
    const oppositeDirection = ((edge.direction + 3) % 6) as HexDirection;

    expect(readTransitionParams(meshData, edge.tile.id, edge.direction)[1]).toBe(1);
    expect(readTransitionParams(meshData, edge.neighbor.id, oppositeDirection)).toEqual([0, 0, 0, 0]);
  });

  it("selects stable biome transition variants by hex id, direction, and materials", () => {
    const first = resolveHexBiomeTransitionAtlasIndex(makeHexId(4, 4), 2, "grassland_flat", "grassland_rough");
    const second = resolveHexBiomeTransitionAtlasIndex(makeHexId(4, 4), 2, "grassland_flat", "grassland_rough");
    const other = resolveHexBiomeTransitionAtlasIndex(makeHexId(5, 4), 2, "grassland_flat", "grassland_rough");
    const variants = generatedHexMaterialPack.biomeTransitions.variants;

    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(2 * variants);
    expect(first).toBeLessThan(3 * variants);
    expect(other).toBeGreaterThanOrEqual(2 * variants);
    expect(other).toBeLessThan(3 * variants);
  });
});

function findMaterialEdge(predicate: (base: ReturnType<typeof resolveTerrainMaterialId>, neighbor: ReturnType<typeof resolveTerrainMaterialId>) => boolean, requireTransitionOwner = false) {
  const tileById = new Map(smallMap.tiles.map((tile) => [tile.id, tile]));
  for (const tile of smallMap.tiles) {
    const baseMaterial = resolveTerrainMaterialId(tile);
    for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
      const neighborAxial = getNeighborAxial(tile, direction as HexDirection, smallMap.settings);
      const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
      if (!neighbor) continue;
      if (requireTransitionOwner && tile.id.localeCompare(neighbor.id) > 0) continue;
      const neighborMaterial = resolveTerrainMaterialId(neighbor);
      if (predicate(baseMaterial, neighborMaterial)) {
        return { tile, neighbor, direction: direction as HexDirection, baseMaterial, neighborMaterial };
      }
    }
  }
  throw new Error("missing-material-edge-fixture");
}

function makeTestTile(q: number, r: number, overrides: { waterKind: HexTile["waterKind"]; mapTags?: HexTile["mapTags"]; terrain?: string; biome?: string }): HexTile {
  const mapTags = overrides.mapTags ?? legacyTags(overrides.terrain, overrides.biome, overrides.waterKind);
  return {
    id: makeHexId(q, r),
    q,
    r,
    chunkId: "hex-chunk:0:0",
    regionId: overrides.waterKind ? "region:water:test" : "region:land:test",
    waterKind: overrides.waterKind,
    elevation: overrides.waterKind ? 0.48 : 0.58,
    moisture: 0.52,
    temperature: 0.5,
    temperatureBand: "temperate",
    moistureBand: "normal",
    distanceToWater: overrides.waterKind ? 0 : 3,
    isCoastal: false,
    riverMask: 0,
    riverWidth: 0,
    mapTags,
    movementCost: overrides.waterKind ? 3 : 1,
    passable: true,
  };
}

function legacyTags(terrain: string | undefined, biome: string | undefined, waterKind: HexTile["waterKind"]): HexTile["mapTags"] {
  if (waterKind === "ocean") return ["water:ocean"];
  if (waterKind === "sea") return ["water:coastal"];
  if (waterKind === "lake") return ["water:lake", "water:fresh"];
  if (terrain === "desert" || biome === "arid_desert") return ["biome:desert"];
  if (terrain === "snow") return ["biome:tundra", "feature:snow"];
  if (terrain === "mountains") return ["biome:plains", "morphology:mountainous"];
  if (terrain === "hills") return ["biome:plains", "morphology:rough"];
  if (terrain === "plains") return ["biome:plains", "morphology:flat"];
  return ["biome:grassland", "morphology:flat"];
}

function readTransitionParams(meshData: ReturnType<typeof buildHexTerrainMeshData>, tileId: HexId, direction: HexDirection): number[] {
  const chunk = meshData.chunks.find((candidate) => candidate.tileIds.includes(tileId))!;
  const tileIndex = chunk.tileIds.indexOf(tileId);
  const offset = (tileIndex * 18 + direction * 3) * 4;
  return Array.from(chunk.transitionParams.slice(offset, offset + 4));
}

function readCoastParams(meshData: ReturnType<typeof buildHexTerrainMeshData>, tileId: HexId, direction: HexDirection): number[] {
  const chunk = meshData.chunks.find((candidate) => candidate.tileIds.includes(tileId))!;
  const tileIndex = chunk.tileIds.indexOf(tileId);
  const offset = (tileIndex * 18 + direction * 3) * 4;
  return Array.from(chunk.coastParams.slice(offset, offset + 4));
}

function readRiverParams(meshData: ReturnType<typeof buildHexTerrainMeshData>, tileId: HexId, direction: HexDirection): number[] {
  const chunk = meshData.chunks.find((candidate) => candidate.tileIds.includes(tileId))!;
  const tileIndex = chunk.tileIds.indexOf(tileId);
  const offset = (tileIndex * 18 + direction * 3) * 4;
  return Array.from(chunk.riverParams.slice(offset, offset + 4));
}
