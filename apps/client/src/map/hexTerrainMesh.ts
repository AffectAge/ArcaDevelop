import type { HexChunkId, HexDirection, HexId, HexMapArtifact, HexTile } from "@arcanorum/shared";
import { axialToPixel, getNeighborAxial, hexEdgeCorners, makeHexId } from "./hexGeometry";
import { generatedHexMaterialPack, resolveTerrainMaterialAtlasIndex, resolveTerrainMaterialColor, resolveTerrainMaterialId, type HexMaterialPackManifest, type TerrainMaterialId } from "./hexTerrainMaterials";

export type HexTerrainVertexAttributes = {
  position: [number, number];
  local: [number, number];
  baseColor: [number, number, number];
  edgeColor: [number, number, number];
  materialIndices: [number, number];
  materialWeights: [number, number, number, number];
  coastParams: [number, number, number, number];
};

export type HexChunkRenderData = {
  chunkId: HexChunkId;
  qMin: number;
  qMax: number;
  rMin: number;
  rMax: number;
  bounds: { left: number; right: number; top: number; bottom: number };
  positions: Float32Array;
  locals: Float32Array;
  baseColors: Float32Array;
  edgeColors: Float32Array;
  materialIndices: Float32Array;
  materialWeights: Float32Array;
  coastParams: Float32Array;
  indices: Uint32Array;
  tileIds: HexId[];
};

export type HexTerrainMeshBuildResult = {
  chunks: HexChunkRenderData[];
  chunksById: Map<HexChunkId, HexChunkRenderData>;
};

export function buildHexTerrainMeshData(map: HexMapArtifact, materialPack: HexMaterialPackManifest = generatedHexMaterialPack): HexTerrainMeshBuildResult {
  const tileById = new Map(map.tiles.map((tile) => [tile.id, tile]));
  const tilesByChunk = new Map<HexChunkId, HexTile[]>();
  for (const tile of map.tiles) {
    const bucket = tilesByChunk.get(tile.chunkId) ?? [];
    bucket.push(tile);
    tilesByChunk.set(tile.chunkId, bucket);
  }

  const chunks = Array.from(tilesByChunk.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chunkId, tiles]) => buildChunkRenderData(chunkId, tiles, map, tileById, materialPack));
  return { chunks, chunksById: new Map(chunks.map((chunk) => [chunk.chunkId, chunk])) };
}

export function resolveHexNeighborMaterialIds(tile: HexTile, map: HexMapArtifact, tileById: Map<HexId, HexTile>): TerrainMaterialId[] {
  return Array.from({ length: 6 }, (_, direction) => {
    const neighbor = getNeighborAxial(tile, direction as HexDirection, map.settings);
    if (!neighbor) return resolveTerrainMaterialId(tile);
    return resolveTerrainMaterialId(tileById.get(makeHexId(neighbor.q, neighbor.r)) ?? tile);
  });
}

export function resolveHexCoastMaskParams(map: HexMapArtifact, materialPack: HexMaterialPackManifest = generatedHexMaterialPack): Map<HexId, [number, number, number, number]> {
  const coastParamsByHexId = new Map<HexId, [number, number, number, number]>();
  const rawCoastParamsByHexId = new Map<HexId, [number, number]>();
  const waterMaterialIndex = resolveTerrainMaterialAtlasIndex("coastal_water", materialPack);
  for (const coast of map.coastOverlays) {
    const current = rawCoastParamsByHexId.get(coast.hexId) ?? [0, 0];
    current[0] = current[0] | (1 << coast.direction);
    current[1] = Math.max(current[1], coast.strength);
    rawCoastParamsByHexId.set(coast.hexId, current);
  }
  for (const [hexId, [rawMask, strength]] of rawCoastParamsByHexId) {
    coastParamsByHexId.set(hexId, [resolveHexCoastMaskAtlasIndex(hexId, rawMask, materialPack), strength, waterMaterialIndex, 1]);
  }
  return coastParamsByHexId;
}

export function resolveHexCoastMaskAtlasIndex(hexId: HexId, rawMask: number, materialPack: HexMaterialPackManifest = generatedHexMaterialPack): number {
  const variants = Math.max(1, materialPack.coastMasks.variants);
  return rawMask * variants + stableVariantIndex(`${hexId}:${rawMask}`, variants);
}

function stableVariantIndex(seed: string, variants: number): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % variants;
}

function buildChunkRenderData(
  chunkId: HexChunkId,
  tiles: HexTile[],
  map: HexMapArtifact,
  tileById: Map<HexId, HexTile>,
  materialPack: HexMaterialPackManifest,
): HexChunkRenderData {
  const positions: number[] = [];
  const locals: number[] = [];
  const baseColors: number[] = [];
  const edgeColors: number[] = [];
  const materialIndices: number[] = [];
  const materialWeights: number[] = [];
  const coastParams: number[] = [];
  const indices: number[] = [];
  const tileIds: HexId[] = [];
  let qMin = Number.POSITIVE_INFINITY;
  let qMax = Number.NEGATIVE_INFINITY;
  let rMin = Number.POSITIVE_INFINITY;
  let rMax = Number.NEGATIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  const sortedTiles = [...tiles].sort((a, b) => (a.r === b.r ? a.q - b.q : a.r - b.r));
  const coastParamsByHexId = resolveHexCoastMaskParams(map, materialPack);
  const defaultCoastParams: [number, number, number, number] = [0, 0, resolveTerrainMaterialAtlasIndex("coastal_water", materialPack), 0];
  for (const tile of sortedTiles) {
    const center = axialToPixel(tile, map.settings.hexSize);
    const baseMaterial = resolveTerrainMaterialId(tile);
    const baseColor = resolveTerrainMaterialColor(baseMaterial, materialPack);
    const baseMaterialIndex = resolveTerrainMaterialAtlasIndex(baseMaterial, materialPack);
    const neighborMaterials = resolveHexNeighborMaterialIds(tile, map, tileById);
    const tileCoastParams = coastParamsByHexId.get(tile.id) ?? defaultCoastParams;
    qMin = Math.min(qMin, tile.q);
    qMax = Math.max(qMax, tile.q);
    rMin = Math.min(rMin, tile.r);
    rMax = Math.max(rMax, tile.r);
    tileIds.push(tile.id);

    for (let direction = 0; direction < 6; direction += 1) {
      const [cornerA, cornerB] = hexEdgeCorners(center, map.settings.hexSize, direction as HexDirection);
      const edgeMaterial = neighborMaterials[direction];
      const edgeColor = resolveTerrainMaterialColor(edgeMaterial, materialPack);
      const edgeMaterialIndex = resolveTerrainMaterialAtlasIndex(edgeMaterial, materialPack);
      const vertexStart = positions.length / 2;
      pushVertex(positions, locals, baseColors, edgeColors, materialIndices, materialWeights, coastParams, center.x, center.y, 0, 0, baseColor, edgeColor, baseMaterialIndex, edgeMaterialIndex, tileCoastParams, tile, 0);
      pushVertex(
        positions,
        locals,
        baseColors,
        edgeColors,
        materialIndices,
        materialWeights,
        coastParams,
        cornerA.x,
        cornerA.y,
        (cornerA.x - center.x) / map.settings.hexSize,
        (cornerA.y - center.y) / map.settings.hexSize,
        baseColor,
        edgeColor,
        baseMaterialIndex,
        edgeMaterialIndex,
        tileCoastParams,
        tile,
        1,
      );
      pushVertex(
        positions,
        locals,
        baseColors,
        edgeColors,
        materialIndices,
        materialWeights,
        coastParams,
        cornerB.x,
        cornerB.y,
        (cornerB.x - center.x) / map.settings.hexSize,
        (cornerB.y - center.y) / map.settings.hexSize,
        baseColor,
        edgeColor,
        baseMaterialIndex,
        edgeMaterialIndex,
        tileCoastParams,
        tile,
        1,
      );
      indices.push(vertexStart, vertexStart + 1, vertexStart + 2);
      left = Math.min(left, center.x - map.settings.hexSize);
      right = Math.max(right, center.x + map.settings.hexSize);
      top = Math.min(top, center.y - map.settings.hexSize);
      bottom = Math.max(bottom, center.y + map.settings.hexSize);
    }
  }

  return {
    chunkId,
    qMin,
    qMax,
    rMin,
    rMax,
    bounds: { left, right, top, bottom },
    positions: new Float32Array(positions),
    locals: new Float32Array(locals),
    baseColors: new Float32Array(baseColors),
    edgeColors: new Float32Array(edgeColors),
    materialIndices: new Float32Array(materialIndices),
    materialWeights: new Float32Array(materialWeights),
    coastParams: new Float32Array(coastParams),
    indices: new Uint32Array(indices),
    tileIds,
  };
}

function pushVertex(
  positions: number[],
  locals: number[],
  baseColors: number[],
  edgeColors: number[],
  materialIndices: number[],
  materialWeights: number[],
  coastParams: number[],
  x: number,
  y: number,
  localX: number,
  localY: number,
  baseColor: [number, number, number],
  edgeColor: [number, number, number],
  baseMaterialIndex: number,
  edgeMaterialIndex: number,
  coastParam: [number, number, number, number],
  tile: HexTile,
  edgeWeight: number,
): void {
  positions.push(x, y);
  locals.push(localX, localY);
  baseColors.push(...baseColor);
  edgeColors.push(...edgeColor);
  materialIndices.push(baseMaterialIndex, edgeMaterialIndex);
  materialWeights.push(edgeWeight, tile.elevation, tile.moisture, tile.temperature);
  coastParams.push(...coastParam);
}
