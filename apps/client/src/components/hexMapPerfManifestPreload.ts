import type { HexMapClientManifest } from "@arcanorum/shared";
import { fetchHexMapClientManifest } from "../map/hexMapChunkStream";
import type { HexMapManifestTiming } from "../map/hexMapStreamingProtocol";

export type HexMapManifestLoader = (
  apiBase: string,
  signal?: AbortSignal,
  onTiming?: (timing: HexMapManifestTiming) => void,
) => Promise<HexMapClientManifest>;

export class PrewarmedHexMapManifestRequest {
  private readonly controller = new AbortController();
  private readonly request: Promise<HexMapClientManifest>;
  private timing: HexMapManifestTiming | null = null;
  private claimed = false;

  constructor(
    private readonly apiBase: string,
    private readonly fetchManifest: HexMapManifestLoader = fetchHexMapClientManifest,
  ) {
    this.request = this.fetchManifest(
      apiBase,
      this.controller.signal,
      (timing) => {
        this.timing = timing;
      },
    );
    void this.request.catch(() => undefined);
  }

  load: HexMapManifestLoader = async (apiBase, signal, onTiming) => {
    if (this.claimed || apiBase !== this.apiBase) {
      return this.fetchManifest(apiBase, signal, onTiming);
    }
    this.claimed = true;
    const abort = () => this.controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    try {
      const manifest = await this.request;
      if (this.timing) onTiming?.(this.timing);
      return manifest;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  };

  peek(): Promise<HexMapClientManifest> {
    return this.request;
  }

  destroyUnused(): void {
    if (!this.claimed) this.controller.abort();
  }
}
