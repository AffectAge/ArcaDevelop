import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import {
  brotliDecompressSync,
  brotliCompressSync,
  constants as zlibConstants,
  gunzipSync,
  gzipSync,
} from "node:zlib";
import {
  HEX_MAP_CLIENT_FORMAT_VERSION,
  HEX_MAP_NAVIGATION_RIVER_CLASS,
  HEX_MAP_NAVIGATION_WATER_KIND,
  getNeighborAxial,
  makeHexId,
  type HexChunkId,
  type HexCoastOverlayRecord,
  type HexDirection,
  type HexEdgeRecord,
  type HexMapArtifact,
  type HexMapClientArtifactDescriptor,
  type HexMapClientBounds,
  type HexMapClientChunk,
  type HexMapClientChunkDescriptor,
  type HexMapClientManifest,
  type HexMapClientRegionSummary,
  type HexMapNavigationArtifact,
  type HexMapNavigationRiverEdge,
  type HexMapNavigationRiverClass,
  type HexMapNavigationWaterKind,
  type HexTile,
  type MapFeatureInstance,
  type RegionId,
} from "@arcanorum/shared";

export const GENERATED_HEX_MAP_CLIENT_DIRECTORY = "hex-map-client";
export const GENERATED_HEX_MAP_CLIENT_CURRENT_FILE = "current.json";
export const GENERATED_HEX_MAP_CLIENT_MANIFEST_FILE = "manifest.json";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CHUNK_ID_PATTERN = /^hex-chunk:(\d+):(\d+)$/;
const CHUNK_FILE_PATTERN = /^chunk-(\d+)-(\d+)\.json$/;

type SerializedClientArtifact<T> = {
  value: T;
  json: Buffer;
  gzip: Buffer;
  brotli: Buffer;
  descriptor: HexMapClientArtifactDescriptor;
};

export type BuiltHexMapClientChunk =
  SerializedClientArtifact<HexMapClientChunk> & {
    descriptor: HexMapClientChunkDescriptor;
  };

export type BuiltHexMapClientArtifacts = {
  manifest: HexMapClientManifest;
  manifestJson: Buffer;
  navigation: SerializedClientArtifact<HexMapNavigationArtifact>;
  chunks: BuiltHexMapClientChunk[];
};

export type HexMapClientArtifactRuntime = {
  rootPath: string;
  manifestPath: string;
  manifest: HexMapClientManifest;
  manifestJson: Buffer;
  manifestEtag: string;
  chunkDescriptorById: ReadonlyMap<string, HexMapClientChunkDescriptor>;
};

export type EnsureHexMapClientArtifactsResult = HexMapClientArtifactRuntime & {
  artifactVersion: string;
};

export function calculateHexMapClientArtifactVersion(params: {
  mapArtifact: HexMapArtifact;
  features: MapFeatureInstance[];
}): string {
  const normalized = normalizeClientArtifactSource(params);
  return hashBytes(serializeJson(normalized));
}

export function buildHexMapClientArtifacts(params: {
  mapArtifact: HexMapArtifact;
  features: MapFeatureInstance[];
}): BuiltHexMapClientArtifacts {
  const normalized = normalizeClientArtifactSource(params);
  const artifactVersion = hashBytes(serializeJson(normalized));
  const tileById = new Map(
    normalized.tiles.map((tile) => [tile.id, tile] as const),
  );
  validateStaticMapReferences(normalized, tileById);
  const coreTilesByChunkId = groupTilesByChunk(
    normalized.tiles,
    normalized.mapArtifact.settings.chunkSize,
  );
  const riverEdgesByHexId = indexRecordsByHexId(normalized.riverEdges);
  const coastOverlaysByHexId = indexRecordsByHexId(normalized.coastOverlays);
  const featuresByHexId = indexRecordsByHexId(normalized.features);
  const chunks: BuiltHexMapClientChunk[] = [];

  for (const [chunkId, coreTiles] of [...coreTilesByChunkId.entries()].sort(
    compareChunkEntries,
  )) {
    const { chunkQ, chunkR } = parseChunkId(chunkId);
    const coreTileIds = new Set(coreTiles.map((tile) => tile.id));
    const visualHalo = buildVisualHalo(
      coreTiles,
      coreTileIds,
      tileById,
      normalized.mapArtifact.settings,
    );
    const chunk: HexMapClientChunk = {
      formatVersion: HEX_MAP_CLIENT_FORMAT_VERSION,
      artifactVersion,
      id: chunkId,
      bounds: calculateBounds(coreTiles),
      tiles: coreTiles,
      visualHalo,
      riverEdges: selectTouchingEdgeRecords(
        coreTiles,
        visualHalo,
        coreTileIds,
        riverEdgesByHexId,
        normalized.mapArtifact.settings,
      ),
      coastOverlays: selectTouchingEdgeRecords(
        coreTiles,
        visualHalo,
        coreTileIds,
        coastOverlaysByHexId,
        normalized.mapArtifact.settings,
      ),
      features: coreTiles.flatMap((tile) => featuresByHexId.get(tile.id) ?? []),
    };
    const fileName = `chunk-${chunkQ}-${chunkR}.json` as const;
    const serialized = serializeClientArtifact(chunk, fileName);
    chunks.push({
      ...serialized,
      descriptor: {
        ...serialized.descriptor,
        id: chunkId,
        fileName,
        chunkQ,
        chunkR,
        bounds: chunk.bounds,
        tileCount: chunk.tiles.length,
        haloTileCount: chunk.visualHalo.length,
      },
    });
  }

  const navigation = serializeClientArtifact(
    buildNavigationArtifact(
      normalized.mapArtifact,
      normalized.tiles,
      normalized.riverEdges,
      artifactVersion,
    ),
    "navigation.json",
  );
  const manifest: HexMapClientManifest = {
    formatVersion: HEX_MAP_CLIENT_FORMAT_VERSION,
    artifactVersion,
    settings: normalized.mapArtifact.settings,
    regions: buildRegionSummaries(
      normalized.tiles,
      normalized.mapArtifact.settings.width,
      normalized.mapArtifact.settings.wrapX,
    ),
    navigation: { ...navigation.descriptor, fileName: "navigation.json" },
    chunks: chunks.map((chunk) => chunk.descriptor),
  };

  return {
    manifest,
    manifestJson: serializeJson(manifest),
    navigation,
    chunks,
  };
}

function validateStaticMapReferences(
  source: ReturnType<typeof normalizeClientArtifactSource>,
  tileById: ReadonlyMap<string, HexTile>,
): void {
  if (tileById.size !== source.tiles.length)
    throw new Error("hex-map-client-duplicate-tile-id");
  for (const tile of source.tiles) {
    if (tile.id !== makeHexId(tile.q, tile.r))
      throw new Error(`hex-map-client-tile-id-coordinate-mismatch:${tile.id}`);
  }
  for (const record of [...source.riverEdges, ...source.coastOverlays]) {
    if (!tileById.has(record.hexId))
      throw new Error(`hex-map-client-edge-hex-not-found:${record.hexId}`);
  }
  for (const feature of source.features) {
    const tile = tileById.get(feature.hexId);
    if (!tile)
      throw new Error(`hex-map-client-feature-hex-not-found:${feature.id}`);
    if (tile.regionId !== feature.regionId)
      throw new Error(`hex-map-client-feature-region-mismatch:${feature.id}`);
  }
}

export function ensureHexMapClientArtifacts(params: {
  scenarioDir: string;
  mapArtifact: HexMapArtifact;
  features: MapFeatureInstance[];
  forceGenerated?: boolean;
}): EnsureHexMapClientArtifactsResult {
  const artifactVersion = calculateHexMapClientArtifactVersion(params);
  const generatedRoot = resolve(
    params.scenarioDir,
    ".generated",
    GENERATED_HEX_MAP_CLIENT_DIRECTORY,
  );
  const versionRoot = resolve(generatedRoot, artifactVersion);
  const manifestPath = resolve(
    versionRoot,
    GENERATED_HEX_MAP_CLIENT_MANIFEST_FILE,
  );
  const previousRuntime = loadHexMapClientArtifactRuntime(params.scenarioDir);

  if (!params.forceGenerated) {
    if (previousRuntime?.manifest.artifactVersion === artifactVersion) {
      return { ...previousRuntime, artifactVersion };
    }
  }

  const built = buildHexMapClientArtifacts(params);
  mkdirSync(versionRoot, { recursive: true });
  writeFileSync(manifestPath, built.manifestJson);
  writeSerializedArtifact(versionRoot, built.navigation);
  for (const chunk of built.chunks) writeSerializedArtifact(versionRoot, chunk);
  writeFileSync(
    resolve(generatedRoot, GENERATED_HEX_MAP_CLIENT_CURRENT_FILE),
    serializeJson({ artifactVersion }),
  );
  removeInactiveArtifactVersions(
    generatedRoot,
    new Set(
      [artifactVersion, previousRuntime?.manifest.artifactVersion].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );

  const runtime = createRuntimeArtifact(
    versionRoot,
    manifestPath,
    built.manifest,
    built.manifestJson,
  );
  return { ...runtime, artifactVersion };
}

export function loadHexMapClientArtifactRuntime(
  scenarioDir: string,
): HexMapClientArtifactRuntime | null {
  const generatedRoot = resolve(
    scenarioDir,
    ".generated",
    GENERATED_HEX_MAP_CLIENT_DIRECTORY,
  );
  const currentPath = resolve(
    generatedRoot,
    GENERATED_HEX_MAP_CLIENT_CURRENT_FILE,
  );
  if (!existsSync(currentPath)) return null;
  const current = parseJsonObject(readFileSync(currentPath, "utf8"));
  const artifactVersion =
    typeof current.artifactVersion === "string" ? current.artifactVersion : "";
  if (!SHA256_PATTERN.test(artifactVersion)) return null;
  const versionRoot = resolve(generatedRoot, artifactVersion);
  const manifestPath = resolve(
    versionRoot,
    GENERATED_HEX_MAP_CLIENT_MANIFEST_FILE,
  );
  if (!existsSync(manifestPath)) return null;
  const manifestJson = readFileSync(manifestPath);
  const manifest = parseHexMapClientManifest(manifestJson.toString("utf8"));
  if (!manifest || manifest.artifactVersion !== artifactVersion) return null;
  const runtime = createRuntimeArtifact(
    versionRoot,
    manifestPath,
    manifest,
    manifestJson,
  );
  return clientArtifactFilesExist(runtime) ? runtime : null;
}

function normalizeClientArtifactSource(params: {
  mapArtifact: HexMapArtifact;
  features: MapFeatureInstance[];
}): {
  formatVersion: typeof HEX_MAP_CLIENT_FORMAT_VERSION;
  mapArtifact: Pick<HexMapArtifact, "version" | "settings">;
  tiles: HexTile[];
  riverEdges: HexEdgeRecord[];
  coastOverlays: HexCoastOverlayRecord[];
  features: MapFeatureInstance[];
} {
  return {
    formatVersion: HEX_MAP_CLIENT_FORMAT_VERSION,
    mapArtifact: {
      version: params.mapArtifact.version,
      settings: params.mapArtifact.settings,
    },
    tiles: [...params.mapArtifact.tiles].sort(compareTiles),
    riverEdges: [...params.mapArtifact.riverEdges].sort(compareEdgeRecords),
    coastOverlays: [...params.mapArtifact.coastOverlays].sort(
      compareEdgeRecords,
    ),
    features: [...params.features].sort(
      (left, right) =>
        left.hexId.localeCompare(right.hexId, "en") ||
        left.id.localeCompare(right.id, "en"),
    ),
  };
}

function indexRecordsByHexId<T extends { hexId: string }>(
  records: T[],
): Map<string, T[]> {
  const recordsByHexId = new Map<string, T[]>();
  for (const record of records) {
    const existing = recordsByHexId.get(record.hexId) ?? [];
    existing.push(record);
    recordsByHexId.set(record.hexId, existing);
  }
  return recordsByHexId;
}

function selectTouchingEdgeRecords<
  T extends { hexId: string; direction: HexDirection },
>(
  coreTiles: HexTile[],
  visualHalo: HexTile[],
  coreTileIds: ReadonlySet<string>,
  recordsByHexId: ReadonlyMap<string, T[]>,
  settings: HexMapArtifact["settings"],
): T[] {
  const selected: T[] = [];
  for (const tile of coreTiles)
    selected.push(...(recordsByHexId.get(tile.id) ?? []));
  for (const tile of visualHalo) {
    for (const record of recordsByHexId.get(tile.id) ?? []) {
      if (
        edgeTouchesChunk(record.hexId, record.direction, coreTileIds, settings)
      )
        selected.push(record);
    }
  }
  return selected.sort(compareEdgeRecords);
}

function groupTilesByChunk(
  tiles: HexTile[],
  chunkSize: number,
): Map<HexChunkId, HexTile[]> {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error("hex-map-client-invalid-chunk-size");
  }
  const grouped = new Map<HexChunkId, HexTile[]>();
  for (const tile of tiles) {
    const expectedChunkId =
      `hex-chunk:${Math.floor(tile.q / chunkSize)}:${Math.floor(tile.r / chunkSize)}` as HexChunkId;
    if (tile.chunkId !== expectedChunkId) {
      throw new Error(`hex-map-client-invalid-chunk-id:${tile.id}`);
    }
    const chunkTiles = grouped.get(tile.chunkId) ?? [];
    chunkTiles.push(tile);
    grouped.set(tile.chunkId, chunkTiles);
  }
  return grouped;
}

function buildVisualHalo(
  coreTiles: HexTile[],
  coreTileIds: ReadonlySet<string>,
  tileById: ReadonlyMap<string, HexTile>,
  settings: HexMapArtifact["settings"],
): HexTile[] {
  const haloById = new Map<string, HexTile>();
  for (const tile of coreTiles) {
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = getNeighborAxial(
        tile,
        direction as HexDirection,
        settings,
      );
      if (!neighbor) continue;
      const neighborId = makeHexId(neighbor.q, neighbor.r);
      if (coreTileIds.has(neighborId)) continue;
      const neighborTile = tileById.get(neighborId);
      if (neighborTile) haloById.set(neighborId, neighborTile);
    }
  }
  return [...haloById.values()].sort(compareTiles);
}

function edgeTouchesChunk(
  hexId: string,
  direction: HexDirection,
  coreTileIds: ReadonlySet<string>,
  settings: HexMapArtifact["settings"],
): boolean {
  if (coreTileIds.has(hexId)) return true;
  const coordinates = parseHexId(hexId);
  const neighbor = coordinates
    ? getNeighborAxial(coordinates, direction, settings)
    : null;
  return neighbor ? coreTileIds.has(makeHexId(neighbor.q, neighbor.r)) : false;
}

function buildNavigationArtifact(
  mapArtifact: Pick<HexMapArtifact, "settings">,
  tiles: HexTile[],
  riverEdges: HexEdgeRecord[],
  artifactVersion: string,
): HexMapNavigationArtifact {
  const { width, height, wrapX } = mapArtifact.settings;
  const orderedTiles = new Array<HexTile | undefined>(width * height);
  for (const tile of tiles) {
    if (
      !Number.isInteger(tile.q) ||
      !Number.isInteger(tile.r) ||
      tile.q < 0 ||
      tile.q >= width ||
      tile.r < 0 ||
      tile.r >= height
    ) {
      throw new Error(`hex-map-client-tile-out-of-bounds:${tile.id}`);
    }
    const index = tile.r * width + tile.q;
    if (orderedTiles[index])
      throw new Error(`hex-map-client-duplicate-tile:${tile.id}`);
    orderedTiles[index] = tile;
  }
  if (orderedTiles.some((tile) => !tile))
    throw new Error("hex-map-client-incomplete-rectangular-map");
  const rowMajorTiles = orderedTiles.map((tile) => {
    if (!tile) throw new Error("hex-map-client-incomplete-rectangular-map");
    return tile;
  });
  const regionIds = [
    ...new Set(rowMajorTiles.map((tile) => tile.regionId)),
  ].sort((left, right) => left.localeCompare(right, "en"));
  const regionIndexById = new Map(
    regionIds.map((regionId, index) => [regionId, index] as const),
  );
  return {
    formatVersion: HEX_MAP_CLIENT_FORMAT_VERSION,
    artifactVersion,
    width,
    height,
    wrapX,
    regionIds,
    passability: rowMajorTiles.map((tile) => (tile.passable ? 1 : 0)),
    waterKinds: rowMajorTiles.map((tile) => encodeWaterKind(tile.waterKind)),
    movementCosts: rowMajorTiles.map((tile) => tile.movementCost),
    stopsMovementOnEnter: rowMajorTiles.map((tile) =>
      tile.stopsMovementOnEnter ? 1 : 0,
    ),
    regionIndexes: rowMajorTiles.map((tile) => {
      const regionIndex = regionIndexById.get(tile.regionId);
      if (regionIndex == null)
        throw new Error(`hex-map-client-missing-region-index:${tile.regionId}`);
      return regionIndex;
    }),
    riverEdges: riverEdges
      .map((edge) => {
        const coordinates = parseHexId(edge.hexId);
        if (!coordinates)
          throw new Error(`hex-map-client-invalid-river-hex:${edge.hexId}`);
        const compactEdge: HexMapNavigationRiverEdge = [
          coordinates.r * width + coordinates.q,
          edge.direction,
          edge.width,
          encodeRiverClass(edge),
          edge.navigable ? 1 : 0,
          edge.crossingCost ?? 0,
        ];
        return compactEdge;
      })
      .sort((left, right) => left[0] - right[0] || left[1] - right[1]),
  };
}

function buildRegionSummaries(
  tiles: HexTile[],
  width: number,
  wrapX: boolean,
): HexMapClientRegionSummary[] {
  const tilesByRegionId = new Map<RegionId, HexTile[]>();
  for (const tile of tiles) {
    const regionTiles = tilesByRegionId.get(tile.regionId) ?? [];
    regionTiles.push(tile);
    tilesByRegionId.set(tile.regionId, regionTiles);
  }
  return [...tilesByRegionId.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([regionId, regionTiles]) => ({
      id: regionId,
      tileCount: regionTiles.length,
      waterTileCount: regionTiles.filter((tile) => tile.waterKind != null)
        .length,
      bounds: calculateBounds(regionTiles),
      labelAnchor: selectRegionLabelAnchor(regionTiles, width, wrapX),
    }));
}

function selectRegionLabelAnchor(
  tiles: HexTile[],
  width: number,
  wrapX: boolean,
): { q: number; r: number } {
  const first = tiles[0];
  if (!first) throw new Error("hex-map-client-empty-region");
  const unwrappedQ = tiles.map(
    (tile) =>
      first.q +
      (wrapX ? shortestWrappedDelta(first.q, tile.q, width) : tile.q - first.q),
  );
  const averageQ =
    unwrappedQ.reduce((sum, q) => sum + q, 0) / unwrappedQ.length;
  const averageR = tiles.reduce((sum, tile) => sum + tile.r, 0) / tiles.length;
  let best = first;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index];
    const distance =
      (unwrappedQ[index] - averageQ) ** 2 + (tile.r - averageR) ** 2;
    if (
      distance < bestDistance ||
      (distance === bestDistance && compareTiles(tile, best) < 0)
    ) {
      best = tile;
      bestDistance = distance;
    }
  }
  return { q: best.q, r: best.r };
}

function shortestWrappedDelta(
  fromQ: number,
  toQ: number,
  width: number,
): number {
  const direct = toQ - fromQ;
  const left = direct - width;
  const right = direct + width;
  return [direct, left, right].sort(
    (a, b) => Math.abs(a) - Math.abs(b) || a - b,
  )[0];
}

function calculateBounds(tiles: HexTile[]): HexMapClientBounds {
  if (tiles.length === 0) throw new Error("hex-map-client-empty-chunk");
  return tiles.reduce<HexMapClientBounds>(
    (bounds, tile) => ({
      minQ: Math.min(bounds.minQ, tile.q),
      minR: Math.min(bounds.minR, tile.r),
      maxQ: Math.max(bounds.maxQ, tile.q),
      maxR: Math.max(bounds.maxR, tile.r),
    }),
    {
      minQ: Number.POSITIVE_INFINITY,
      minR: Number.POSITIVE_INFINITY,
      maxQ: Number.NEGATIVE_INFINITY,
      maxR: Number.NEGATIVE_INFINITY,
    },
  );
}

function serializeClientArtifact<T>(
  value: T,
  fileName: string,
): SerializedClientArtifact<T> {
  const json = serializeJson(value);
  const gzip = gzipSync(json, { level: 9 });
  const brotli = brotliCompressSync(json, {
    params: {
      [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
      [zlibConstants.BROTLI_PARAM_QUALITY]: 6,
      [zlibConstants.BROTLI_PARAM_SIZE_HINT]: json.length,
    },
  });
  return {
    value,
    json,
    gzip,
    brotli,
    descriptor: {
      fileName,
      contentHash: hashBytes(json),
      byteLength: json.length,
      gzipByteLength: gzip.length,
      brotliByteLength: brotli.length,
    },
  };
}

function writeSerializedArtifact(
  rootPath: string,
  artifact: SerializedClientArtifact<unknown>,
): void {
  const jsonPath = resolve(rootPath, artifact.descriptor.fileName);
  writeFileSync(jsonPath, artifact.json);
  writeFileSync(`${jsonPath}.gz`, artifact.gzip);
  writeFileSync(`${jsonPath}.br`, artifact.brotli);
}

function removeInactiveArtifactVersions(
  generatedRoot: string,
  retainedVersions: ReadonlySet<string>,
): void {
  for (const entry of readdirSync(generatedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || retainedVersions.has(entry.name)) continue;
    if (!SHA256_PATTERN.test(entry.name)) continue;
    rmSync(resolve(generatedRoot, entry.name), {
      recursive: true,
      force: true,
    });
  }
}

function clientArtifactFilesExist(
  runtime: HexMapClientArtifactRuntime,
): boolean {
  const descriptors: HexMapClientArtifactDescriptor[] = [
    runtime.manifest.navigation,
    ...runtime.manifest.chunks,
  ];
  return descriptors.every((descriptor) =>
    clientArtifactFilesMatchDescriptor(runtime.rootPath, descriptor),
  );
}

function clientArtifactFilesMatchDescriptor(
  rootPath: string,
  descriptor: HexMapClientArtifactDescriptor,
): boolean {
  const path = resolve(rootPath, descriptor.fileName);
  try {
    const json = readFileSync(path);
    const gzip = readFileSync(`${path}.gz`);
    const brotli = readFileSync(`${path}.br`);
    return (
      json.length === descriptor.byteLength &&
      gzip.length === descriptor.gzipByteLength &&
      brotli.length === descriptor.brotliByteLength &&
      hashBytes(json) === descriptor.contentHash &&
      gunzipSync(gzip).equals(json) &&
      brotliDecompressSync(brotli).equals(json)
    );
  } catch {
    return false;
  }
}

function createRuntimeArtifact(
  rootPath: string,
  manifestPath: string,
  manifest: HexMapClientManifest,
  manifestJson: Buffer,
): HexMapClientArtifactRuntime {
  return {
    rootPath,
    manifestPath,
    manifest,
    manifestJson,
    manifestEtag: `"${hashBytes(manifestJson)}"`,
    chunkDescriptorById: new Map(
      manifest.chunks.map((descriptor) => [descriptor.id, descriptor] as const),
    ),
  };
}

function parseHexMapClientManifest(json: string): HexMapClientManifest | null {
  const input = parseJsonObject(json);
  if (
    input.formatVersion !== HEX_MAP_CLIENT_FORMAT_VERSION ||
    typeof input.artifactVersion !== "string" ||
    !SHA256_PATTERN.test(input.artifactVersion) ||
    !isObject(input.settings) ||
    !Array.isArray(input.regions) ||
    !isObject(input.navigation) ||
    !Array.isArray(input.chunks)
  ) {
    return null;
  }
  const navigation = input.navigation;
  if (
    navigation.fileName !== "navigation.json" ||
    !isArtifactDescriptor(navigation)
  )
    return null;
  const chunkIds = new Set<string>();
  for (const value of input.chunks) {
    if (!isObject(value) || !isArtifactDescriptor(value)) return null;
    const chunkId = typeof value.id === "string" ? value.id : "";
    const idMatch = CHUNK_ID_PATTERN.exec(chunkId);
    const fileName = typeof value.fileName === "string" ? value.fileName : "";
    const fileMatch = CHUNK_FILE_PATTERN.exec(fileName);
    if (
      !idMatch ||
      !fileMatch ||
      idMatch[1] !== fileMatch[1] ||
      idMatch[2] !== fileMatch[2]
    )
      return null;
    if (chunkIds.has(chunkId)) return null;
    chunkIds.add(chunkId);
    if (
      value.chunkQ !== Number(idMatch[1]) ||
      value.chunkR !== Number(idMatch[2]) ||
      !isBounds(value.bounds) ||
      !isNonNegativeInteger(value.tileCount) ||
      !isNonNegativeInteger(value.haloTileCount)
    ) {
      return null;
    }
  }
  return input as HexMapClientManifest;
}

function isArtifactDescriptor(value: Record<string, unknown>): boolean {
  return (
    typeof value.fileName === "string" &&
    typeof value.contentHash === "string" &&
    SHA256_PATTERN.test(value.contentHash) &&
    isNonNegativeInteger(value.byteLength) &&
    isNonNegativeInteger(value.gzipByteLength) &&
    isNonNegativeInteger(value.brotliByteLength)
  );
}

function isBounds(value: unknown): boolean {
  if (!isObject(value)) return false;
  return [value.minQ, value.minR, value.maxQ, value.maxR].every(
    isNonNegativeInteger,
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseJsonObject(json: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(json);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseChunkId(chunkId: HexChunkId): { chunkQ: number; chunkR: number } {
  const match = CHUNK_ID_PATTERN.exec(chunkId);
  if (!match) throw new Error(`hex-map-client-invalid-chunk-id:${chunkId}`);
  return { chunkQ: Number(match[1]), chunkR: Number(match[2]) };
}

function parseHexId(hexId: string): { q: number; r: number } | null {
  const match = /^hex:(\d+):(\d+)$/.exec(hexId);
  return match ? { q: Number(match[1]), r: Number(match[2]) } : null;
}

function encodeWaterKind(
  waterKind: HexTile["waterKind"],
): HexMapNavigationWaterKind {
  if (waterKind === "ocean") return HEX_MAP_NAVIGATION_WATER_KIND.ocean;
  if (waterKind === "sea") return HEX_MAP_NAVIGATION_WATER_KIND.sea;
  if (waterKind === "lake") return HEX_MAP_NAVIGATION_WATER_KIND.lake;
  return HEX_MAP_NAVIGATION_WATER_KIND.land;
}

function encodeRiverClass(edge: HexEdgeRecord): HexMapNavigationRiverClass {
  if (edge.riverClass === "navigable" || edge.navigable)
    return HEX_MAP_NAVIGATION_RIVER_CLASS.navigable;
  if (edge.riverClass === "major") return HEX_MAP_NAVIGATION_RIVER_CLASS.major;
  return HEX_MAP_NAVIGATION_RIVER_CLASS.minor;
}

function compareTiles(left: HexTile, right: HexTile): number {
  return (
    left.r - right.r ||
    left.q - right.q ||
    left.id.localeCompare(right.id, "en")
  );
}

function compareEdgeRecords(
  left: { hexId: string; direction: HexDirection },
  right: { hexId: string; direction: HexDirection },
): number {
  return (
    left.hexId.localeCompare(right.hexId, "en") ||
    left.direction - right.direction
  );
}

function compareChunkEntries(
  left: [HexChunkId, HexTile[]],
  right: [HexChunkId, HexTile[]],
): number {
  const leftCoordinates = parseChunkId(left[0]);
  const rightCoordinates = parseChunkId(right[0]);
  return (
    leftCoordinates.chunkR - rightCoordinates.chunkR ||
    leftCoordinates.chunkQ - rightCoordinates.chunkQ
  );
}

function serializeJson(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function hashBytes(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
