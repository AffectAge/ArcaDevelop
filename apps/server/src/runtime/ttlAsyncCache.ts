export type TtlAsyncCacheOptions = {
  defaultTtlMs: number;
  nowMs?: () => number;
};

export class TtlAsyncCache {
  private readonly entries = new Map<string, { expiresAtMs: number; value: unknown }>();
  private readonly nowMs: () => number;

  constructor(private readonly options: TtlAsyncCacheOptions) {
    this.nowMs = options.nowMs ?? Date.now;
  }

  clear(): void {
    this.entries.clear();
  }

  async get<T>(params: { key: string; ttlMs?: number; loader: () => Promise<T> }): Promise<T> {
    const nowMs = this.nowMs();
    const cached = this.entries.get(params.key);
    if (cached && cached.expiresAtMs > nowMs) {
      return cached.value as T;
    }

    const value = await params.loader();
    const ttlMs = params.ttlMs ?? this.options.defaultTtlMs;
    this.entries.set(params.key, { expiresAtMs: nowMs + ttlMs, value });
    return value;
  }
}
