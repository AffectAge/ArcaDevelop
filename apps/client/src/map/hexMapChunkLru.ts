export type SizedChunkCacheEntry<T> = {
  value: T;
  byteLength: number;
};

export type ChunkCacheLimits = {
  maxEntries: number;
  maxBytes: number;
};

export class BoundedChunkLru<TKey, TValue> {
  readonly limits: ChunkCacheLimits;
  private readonly entries = new Map<TKey, SizedChunkCacheEntry<TValue>>();
  private pinnedKeys = new Set<TKey>();
  private residentBytes = 0;

  constructor(limits: ChunkCacheLimits) {
    this.limits = {
      maxEntries: Math.max(1, Math.trunc(limits.maxEntries)),
      maxBytes: Math.max(1, Math.trunc(limits.maxBytes)),
    };
  }

  get size(): number {
    return this.entries.size;
  }

  get bytes(): number {
    return this.residentBytes;
  }

  has(key: TKey): boolean {
    return this.entries.has(key);
  }

  get(key: TKey): TValue | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: TKey, value: TValue, byteLength: number): TKey[] {
    this.delete(key);
    const normalizedBytes = Math.max(0, Math.trunc(byteLength));
    this.entries.set(key, { value, byteLength: normalizedBytes });
    this.residentBytes += normalizedBytes;
    return this.evictToLimits();
  }

  delete(key: TKey): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.entries.delete(key);
    this.residentBytes -= entry.byteLength;
    return true;
  }

  clear(): TKey[] {
    const keys = [...this.entries.keys()];
    this.entries.clear();
    this.residentBytes = 0;
    this.pinnedKeys.clear();
    return keys;
  }

  setPinned(keys: ReadonlySet<TKey>): TKey[] {
    this.pinnedKeys = new Set(keys);
    return this.evictToLimits();
  }

  keys(): TKey[] {
    return [...this.entries.keys()];
  }

  values(): TValue[] {
    return [...this.entries.values()].map((entry) => entry.value);
  }

  private evictToLimits(): TKey[] {
    const evicted: TKey[] = [];
    while (this.entries.size > this.limits.maxEntries || this.residentBytes > this.limits.maxBytes) {
      const candidate = [...this.entries.keys()].find((key) => !this.pinnedKeys.has(key));
      if (candidate === undefined) break;
      this.delete(candidate);
      evicted.push(candidate);
    }
    return evicted;
  }
}

export const DESKTOP_CHUNK_CACHE_LIMITS: ChunkCacheLimits = {
  maxEntries: 48,
  maxBytes: 96 * 1024 * 1024,
};

export const MOBILE_CHUNK_CACHE_LIMITS: ChunkCacheLimits = {
  maxEntries: 24,
  maxBytes: 48 * 1024 * 1024,
};
