import { describe, expect, it, vi } from "vitest";
import type { HexMapClientManifest } from "@arcanorum/shared";
import { DEFAULT_HEX_MAP_SETTINGS } from "../map/hexMapGenerator";
import { PrewarmedHexMapManifestRequest } from "./hexMapPerfManifestPreload";
import type { HexMapManifestTiming } from "../map/hexMapStreamingProtocol";

const timing: HexMapManifestTiming = {
  scope: "manifest",
  fetchMs: 1,
  downloadMs: 2,
  decodeMs: 3,
  parseIndexMs: 4,
  decodedBytes: 5,
  transferBytes: 6,
  encodedBodyBytes: 7,
};

describe("PrewarmedHexMapManifestRequest", () => {
  it("starts immediately, forwards timing on claim, and aborts an unused request", async () => {
    const manifest = makeManifest("v1");
    const signals: AbortSignal[] = [];
    const fetchManifest = vi.fn(
      async (
        _apiBase: string,
        signal?: AbortSignal,
        onTiming?: (value: HexMapManifestTiming) => void,
      ) => {
        if (signal) signals.push(signal);
        onTiming?.(timing);
        return manifest;
      },
    );
    const request = new PrewarmedHexMapManifestRequest(
      "/fixture",
      fetchManifest,
    );
    const onTiming = vi.fn();

    await expect(request.peek()).resolves.toBe(manifest);
    await expect(request.load("/fixture", undefined, onTiming)).resolves.toBe(
      manifest,
    );
    expect(fetchManifest).toHaveBeenCalledTimes(1);
    expect(onTiming).toHaveBeenCalledWith(timing);

    const unused = new PrewarmedHexMapManifestRequest("/other", fetchManifest);
    unused.destroyUnused();
    expect(signals.at(-1)?.aborted).toBe(true);
  });

  it("uses the caller-owned request for a later scenario base", async () => {
    const first = makeManifest("v1");
    const second = makeManifest("v2");
    const fetchManifest = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const request = new PrewarmedHexMapManifestRequest(
      "/fixture-v1",
      fetchManifest,
    );

    await expect(request.load("/fixture-v2")).resolves.toBe(second);
    expect(fetchManifest).toHaveBeenNthCalledWith(
      2,
      "/fixture-v2",
      undefined,
      undefined,
    );
    request.destroyUnused();
  });
});

function makeManifest(artifactVersion: string): HexMapClientManifest {
  return {
    formatVersion: 1,
    artifactVersion,
    settings: DEFAULT_HEX_MAP_SETTINGS,
    regions: [],
    navigation: {
      fileName: "navigation.json",
      contentHash: `navigation-${artifactVersion}`,
      byteLength: 1,
      gzipByteLength: 1,
      brotliByteLength: 1,
    },
    chunks: [],
  };
}
