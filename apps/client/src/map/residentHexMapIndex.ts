import type {
  HexChunkId,
  HexCoastOverlayRecord,
  HexEdgeRecord,
  HexId,
  HexMapArtifact,
  HexMapClientChunk,
  HexMapSettings,
  HexTile,
  MapFeatureInstance,
} from "@arcanorum/shared";

export type ResidentHexMapSnapshot = {
  tileById: ReadonlyMap<HexId, HexTile>;
  tilesByRegionId: ReadonlyMap<string, readonly HexTile[]>;
  features: readonly MapFeatureInstance[];
};

type ResidentChunkMembership = {
  chunk: HexMapClientChunk;
  tileIds: HexId[];
  riverKeys: string[];
  coastKeys: string[];
  featureIds: string[];
};

type ResidentTileEntry = {
  tile: HexTile;
  chunkId: HexChunkId;
  artifactIndex: number;
  regionIndex: number;
};

type SharedRecordEntry<T> = {
  owners: Map<HexChunkId, T>;
  arrayIndex: number;
};

/**
 * Incremental CPU-side projection of the chunks retained by the streaming LRU.
 * Chunk replacement and eviction only touch records owned by those chunks.
 */
export class ResidentHexMapIndex {
  readonly artifact: HexMapArtifact;

  private readonly chunks = new Map<HexChunkId, ResidentChunkMembership>();
  private readonly tileEntries = new Map<HexId, ResidentTileEntry>();
  private readonly tileById = new Map<HexId, HexTile>();
  private readonly tilesByRegionId = new Map<string, HexTile[]>();
  private readonly riverRecords: SharedRecordIndex<HexEdgeRecord>;
  private readonly coastRecords: SharedRecordIndex<HexCoastOverlayRecord>;
  private readonly featureRecords: SharedRecordIndex<MapFeatureInstance>;
  private readonly features: MapFeatureInstance[] = [];

  constructor(settings: HexMapSettings) {
    this.artifact = {
      version: 1,
      settings,
      tiles: [],
      riverEdges: [],
      coastOverlays: [],
    };
    this.riverRecords = new SharedRecordIndex(
      this.artifact.riverEdges,
      (edge) => `${edge.hexId}:${edge.direction}`,
    );
    this.coastRecords = new SharedRecordIndex(
      this.artifact.coastOverlays,
      (coast) => `${coast.hexId}:${coast.direction}`,
    );
    this.featureRecords = new SharedRecordIndex(
      this.features,
      (feature) => feature.id,
    );
  }

  get chunkCount(): number {
    return this.chunks.size;
  }

  get tileCount(): number {
    return this.tileById.size;
  }

  getChunk(chunkId: HexChunkId): HexMapClientChunk | undefined {
    return this.chunks.get(chunkId)?.chunk;
  }

  createSnapshot(): ResidentHexMapSnapshot {
    return {
      tileById: new ReadonlyMapProjection(this.tileById),
      tilesByRegionId: new ReadonlyMapProjection(this.tilesByRegionId),
      features: this.features,
    };
  }

  upsertChunk(chunk: HexMapClientChunk): boolean {
    const current = this.chunks.get(chunk.id);
    if (current?.chunk === chunk) return false;

    const tileIds = this.validateReplacementTiles(chunk);
    if (current) this.removeChunkMembership(current);

    for (const tile of chunk.tiles) this.addTile(chunk.id, tile);
    const riverKeys = this.riverRecords.add(chunk.id, chunk.riverEdges);
    const coastKeys = this.coastRecords.add(chunk.id, chunk.coastOverlays);
    const featureIds = this.featureRecords.add(chunk.id, chunk.features);
    this.chunks.set(chunk.id, {
      chunk,
      tileIds,
      riverKeys,
      coastKeys,
      featureIds,
    });
    return true;
  }

  removeChunks(chunkIds: Iterable<HexChunkId>): boolean {
    let changed = false;
    for (const chunkId of new Set(chunkIds)) {
      const membership = this.chunks.get(chunkId);
      if (!membership) continue;
      this.removeChunkMembership(membership);
      changed = true;
    }
    return changed;
  }

  clear(): boolean {
    if (this.chunks.size === 0) return false;
    this.chunks.clear();
    this.tileEntries.clear();
    this.tileById.clear();
    this.tilesByRegionId.clear();
    this.artifact.tiles.length = 0;
    this.riverRecords.clear();
    this.coastRecords.clear();
    this.featureRecords.clear();
    return true;
  }

  private validateReplacementTiles(chunk: HexMapClientChunk): HexId[] {
    const tileIds: HexId[] = [];
    const uniqueIds = new Set<HexId>();
    for (const tile of chunk.tiles) {
      if (uniqueIds.has(tile.id)) {
        throw new Error(`Duplicate primary tile ${tile.id} in ${chunk.id}`);
      }
      uniqueIds.add(tile.id);
      tileIds.push(tile.id);
      const currentOwner = this.tileEntries.get(tile.id)?.chunkId;
      if (currentOwner && currentOwner !== chunk.id) {
        throw new Error(
          `Primary tile ${tile.id} is already owned by resident chunk ${currentOwner}`,
        );
      }
    }
    return tileIds;
  }

  private addTile(chunkId: HexChunkId, tile: HexTile): void {
    const regionTiles = this.tilesByRegionId.get(tile.regionId) ?? [];
    if (!this.tilesByRegionId.has(tile.regionId)) {
      this.tilesByRegionId.set(tile.regionId, regionTiles);
    }
    const entry: ResidentTileEntry = {
      tile,
      chunkId,
      artifactIndex: this.artifact.tiles.length,
      regionIndex: regionTiles.length,
    };
    this.artifact.tiles.push(tile);
    regionTiles.push(tile);
    this.tileEntries.set(tile.id, entry);
    this.tileById.set(tile.id, tile);
  }

  private removeChunkMembership(membership: ResidentChunkMembership): void {
    this.chunks.delete(membership.chunk.id);
    for (const tileId of membership.tileIds) this.removeTile(tileId);
    this.riverRecords.remove(membership.chunk.id, membership.riverKeys);
    this.coastRecords.remove(membership.chunk.id, membership.coastKeys);
    this.featureRecords.remove(membership.chunk.id, membership.featureIds);
  }

  private removeTile(tileId: HexId): void {
    const entry = this.tileEntries.get(tileId);
    if (!entry) return;

    const lastArtifactIndex = this.artifact.tiles.length - 1;
    if (entry.artifactIndex !== lastArtifactIndex) {
      const movedTile = this.artifact.tiles[lastArtifactIndex];
      if (movedTile) {
        this.artifact.tiles[entry.artifactIndex] = movedTile;
        const movedEntry = this.tileEntries.get(movedTile.id);
        if (movedEntry) movedEntry.artifactIndex = entry.artifactIndex;
      }
    }
    this.artifact.tiles.pop();

    const regionTiles = this.tilesByRegionId.get(entry.tile.regionId);
    if (regionTiles) {
      const lastRegionIndex = regionTiles.length - 1;
      if (entry.regionIndex !== lastRegionIndex) {
        const movedTile = regionTiles[lastRegionIndex];
        if (movedTile) {
          regionTiles[entry.regionIndex] = movedTile;
          const movedEntry = this.tileEntries.get(movedTile.id);
          if (movedEntry) movedEntry.regionIndex = entry.regionIndex;
        }
      }
      regionTiles.pop();
      if (regionTiles.length === 0) {
        this.tilesByRegionId.delete(entry.tile.regionId);
      }
    }

    this.tileEntries.delete(tileId);
    this.tileById.delete(tileId);
  }
}

class SharedRecordIndex<T> {
  private readonly entries = new Map<string, SharedRecordEntry<T>>();
  private readonly packedKeys: string[] = [];

  constructor(
    private readonly records: T[],
    private readonly keyOf: (record: T) => string,
  ) {}

  add(chunkId: HexChunkId, records: readonly T[]): string[] {
    const uniqueRecords = new Map<string, T>();
    for (const record of records) uniqueRecords.set(this.keyOf(record), record);

    for (const [key, record] of uniqueRecords) {
      const entry = this.entries.get(key);
      if (entry) {
        entry.owners.set(chunkId, record);
        const active = entry.owners.values().next().value;
        if (active !== undefined) this.records[entry.arrayIndex] = active;
        continue;
      }
      this.entries.set(key, {
        owners: new Map([[chunkId, record]]),
        arrayIndex: this.records.length,
      });
      this.records.push(record);
      this.packedKeys.push(key);
    }
    return [...uniqueRecords.keys()];
  }

  remove(chunkId: HexChunkId, keys: readonly string[]): void {
    for (const key of keys) {
      const entry = this.entries.get(key);
      if (!entry || !entry.owners.delete(chunkId)) continue;
      const active = entry.owners.values().next().value;
      if (active !== undefined) {
        this.records[entry.arrayIndex] = active;
        continue;
      }
      this.removeEntry(key, entry);
    }
  }

  clear(): void {
    this.entries.clear();
    this.packedKeys.length = 0;
    this.records.length = 0;
  }

  private removeEntry(key: string, entry: SharedRecordEntry<T>): void {
    const lastIndex = this.records.length - 1;
    if (entry.arrayIndex !== lastIndex) {
      const movedRecord = this.records[lastIndex];
      const movedKey = this.packedKeys[lastIndex];
      if (movedRecord !== undefined && movedKey !== undefined) {
        this.records[entry.arrayIndex] = movedRecord;
        this.packedKeys[entry.arrayIndex] = movedKey;
        const movedEntry = this.entries.get(movedKey);
        if (movedEntry) movedEntry.arrayIndex = entry.arrayIndex;
      }
    }
    this.records.pop();
    this.packedKeys.pop();
    this.entries.delete(key);
  }
}

class ReadonlyMapProjection<K, V> implements ReadonlyMap<K, V> {
  constructor(private readonly source: ReadonlyMap<K, V>) {}

  get size(): number {
    return this.source.size;
  }

  get(key: K): V | undefined {
    return this.source.get(key);
  }

  has(key: K): boolean {
    return this.source.has(key);
  }

  forEach(
    callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    thisArg?: unknown,
  ): void {
    this.source.forEach((value, key) =>
      callbackfn.call(thisArg, value, key, this),
    );
  }

  entries(): MapIterator<[K, V]> {
    return this.source.entries();
  }

  keys(): MapIterator<K> {
    return this.source.keys();
  }

  values(): MapIterator<V> {
    return this.source.values();
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.source[Symbol.iterator]();
  }
}
