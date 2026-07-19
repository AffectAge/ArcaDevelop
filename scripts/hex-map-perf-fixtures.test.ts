import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { DEFAULT_HEX_MAP_SETTINGS } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  HEX_MAP_PERF_FIXTURE_BUILDER_VERSION,
  HEX_MAP_PERF_FIXTURE_REGISTRY_VERSION,
  getHexMapPerfFixtureDefinition,
  matchHexMapPerfFixtureRequest,
  resolveReadOnlyFixtureArtifactPath,
  selectHexMapPerfFixtureIds,
  startHexMapPerfFixtureServer,
} from "./hex-map-perf-fixtures";

describe("hex map performance fixture selection", () => {
  it("selects both deterministic acceptance fixtures by default", () => {
    expect(selectHexMapPerfFixtureIds([])).toEqual(["default", "200k"]);
    expect(getHexMapPerfFixtureDefinition("default")).toMatchObject({
      expectedTileCount: 57_600,
    });
    expect(getHexMapPerfFixtureDefinition("default").settings).toEqual(
      DEFAULT_HEX_MAP_SETTINGS,
    );
    expect(getHexMapPerfFixtureDefinition("200k")).toMatchObject({
      expectedTileCount: 200_000,
      settings: { width: 500, height: 400 },
    });
  });

  it("keeps canonical order, removes duplicates, and rejects unknown fixture ids", () => {
    expect(selectHexMapPerfFixtureIds(["200k", "default", "200k"])).toEqual([
      "default",
      "200k",
    ]);
    expect(() => selectHexMapPerfFixtureIds(["large"])).toThrow(
      "Unknown hex map performance fixture",
    );
  });
});

describe("hex map performance fixture server allowlist", () => {
  it("matches only public manifest, navigation, and Windows-safe chunk ids", () => {
    expect(
      matchHexMapPerfFixtureRequest("/fixtures/default/hex-map/manifest"),
    ).toEqual({ fixtureId: "default", kind: "manifest" });
    expect(
      matchHexMapPerfFixtureRequest(
        "/fixtures/200k/hex-map/navigation?version=abc",
      ),
    ).toEqual({ fixtureId: "200k", kind: "navigation" });
    expect(
      matchHexMapPerfFixtureRequest(
        "/fixtures/default/hex-map/chunks/hex-chunk%3A4%3A7?version=abc",
      ),
    ).toEqual({
      fixtureId: "default",
      kind: "chunk",
      chunkId: "hex-chunk:4:7",
    });
  });

  it.each([
    "/fixtures/default/hex-map/chunks/../manifest.json",
    "/fixtures/default/hex-map/chunks/%2e%2e%2fmanifest.json",
    "/fixtures/default/hex-map/chunks/..%5cmanifest.json",
    "/fixtures/default/hex-map/chunks/chunk-1-2.json",
    "/fixtures/default/hex-map/features",
    "/fixtures/unknown/hex-map/manifest",
  ])(
    "rejects paths outside the explicit route and chunk-id allowlist: %s",
    (requestPath) => {
      expect(matchHexMapPerfFixtureRequest(requestPath)).toBeNull();
    },
  );

  it("resolves descriptor files inside the selected immutable artifact root only", () => {
    const rootPath = resolve("fixture-cache", "artifact");
    expect(
      resolveReadOnlyFixtureArtifactPath(rootPath, "chunk-1-2.json", ".br"),
    ).toBe(resolve(rootPath, "chunk-1-2.json.br"));
    expect(() =>
      resolveReadOnlyFixtureArtifactPath(rootPath, "../manifest.json"),
    ).toThrow("HEX_MAP_PERF_FIXTURE_PATH_REJECTED");
    expect(() =>
      resolveReadOnlyFixtureArtifactPath(rootPath, "chunk-1-2.json", ".zip"),
    ).toThrow("HEX_MAP_PERF_FIXTURE_PATH_REJECTED");
  });

  it("serves only manifest and versioned immutable artifacts with production-equivalent headers", async () => {
    const cacheRoot = await mkdtemp(resolve(tmpdir(), "arc-map-perf-server-"));
    const artifactRoot = resolve(cacheRoot, "artifact");
    await mkdir(artifactRoot, { recursive: true });
    const artifactVersion = "a".repeat(64);
    const navigationBody = Buffer.from(
      `${JSON.stringify({ artifactVersion, kind: "navigation" })}\n`,
      "utf8",
    );
    const chunkBody = Buffer.from(
      `${JSON.stringify({ artifactVersion, id: "hex-chunk:0:0" })}\n`,
      "utf8",
    );
    const navigation = descriptor("navigation.json", navigationBody);
    const chunk = {
      ...descriptor("chunk-0-0.json", chunkBody),
      id: "hex-chunk:0:0",
      chunkQ: 0,
      chunkR: 0,
      bounds: { minQ: 0, minR: 0, maxQ: 0, maxR: 0 },
      tileCount: 1,
      haloTileCount: 0,
    };
    const manifestBody = Buffer.from(
      `${JSON.stringify({
        formatVersion: 1,
        artifactVersion,
        settings: { width: 1, height: 1 },
        regions: [],
        navigation,
        chunks: [chunk],
      })}\n`,
      "utf8",
    );
    await writeCompressedVariants(
      artifactRoot,
      navigation.fileName,
      navigationBody,
    );
    await writeCompressedVariants(artifactRoot, chunk.fileName, chunkBody);
    await writeFile(resolve(artifactRoot, "manifest.json"), manifestBody);
    await writeFile(
      resolve(cacheRoot, "fixtures.json"),
      `${JSON.stringify({
        registryVersion: HEX_MAP_PERF_FIXTURE_REGISTRY_VERSION,
        builderVersion: HEX_MAP_PERF_FIXTURE_BUILDER_VERSION,
        fixtures: {
          default: {
            id: "default",
            expectedTileCount: 1,
            settingsHash: "b".repeat(64),
            artifactVersion,
            artifactRoot: "artifact",
            chunkCount: 1,
            brotliByteLength:
              navigation.brotliByteLength + chunk.brotliByteLength,
          },
        },
      })}\n`,
    );

    const server = await startHexMapPerfFixtureServer({
      cacheRoot,
      fixtureIds: ["default"],
    });
    try {
      const apiBase = server.apiBaseForFixture("default");
      const manifestResponse = await fetch(`${apiBase}/hex-map/manifest`, {
        headers: { "Accept-Encoding": "identity" },
      });
      expect(manifestResponse.status).toBe(200);
      expect(manifestResponse.headers.get("access-control-allow-origin")).toBe(
        "*",
      );
      expect(manifestResponse.headers.get("timing-allow-origin")).toBe("*");
      expect(manifestResponse.headers.get("cache-control")).toBe("no-cache");
      const etag = manifestResponse.headers.get("etag");
      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);

      const notModified = await fetch(`${apiBase}/hex-map/manifest`, {
        headers: { "If-None-Match": etag ?? "" },
      });
      expect(notModified.status).toBe(304);
      const navigationResponse = await fetch(
        `${apiBase}/hex-map/navigation?version=${artifactVersion}`,
        { headers: { "Accept-Encoding": "identity" } },
      );
      expect(navigationResponse.status).toBe(200);
      expect(navigationResponse.headers.get("cache-control")).toBe(
        "public, max-age=31536000, immutable",
      );
      expect(navigationResponse.headers.get("vary")).toBe("Accept-Encoding");
      expect(await navigationResponse.json()).toMatchObject({
        artifactVersion,
        kind: "navigation",
      });

      const brotliNavigationResponse = await fetch(
        `${apiBase}/hex-map/navigation?version=${artifactVersion}`,
        { headers: { "Accept-Encoding": "br" } },
      );
      expect(brotliNavigationResponse.status).toBe(200);
      expect(brotliNavigationResponse.headers.get("content-encoding")).toBe(
        "br",
      );
      expect(brotliNavigationResponse.headers.get("content-length")).toBe(
        String(navigation.brotliByteLength),
      );
      expect(brotliNavigationResponse.headers.get("cache-control")).toBe(
        "public, max-age=31536000, immutable",
      );
      expect(brotliNavigationResponse.headers.get("vary")).toBe(
        "Accept-Encoding",
      );
      const decodedNavigation = Buffer.from(
        await brotliNavigationResponse.arrayBuffer(),
      );
      expect(decodedNavigation).toEqual(navigationBody);
      expect(createHash("sha256").update(decodedNavigation).digest("hex")).toBe(
        navigation.contentHash,
      );

      const mismatch = await fetch(
        `${apiBase}/hex-map/navigation?version=stale`,
      );
      expect(mismatch.status).toBe(409);
      await expect(mismatch.json()).resolves.toEqual({
        code: "MAP_VERSION_MISMATCH",
      });
      const traversal = await fetch(
        `${apiBase}/hex-map/chunks/..%5Cmanifest.json?version=${artifactVersion}`,
      );
      expect(traversal.status).toBe(404);
    } finally {
      await server.close();
      await rm(cacheRoot, { recursive: true, force: true });
    }
  });
});

function descriptor(fileName: string, body: Buffer) {
  return {
    fileName,
    contentHash: createHash("sha256").update(body).digest("hex"),
    byteLength: body.byteLength,
    gzipByteLength: gzipSync(body).byteLength,
    brotliByteLength: brotliCompressSync(body).byteLength,
  };
}

async function writeCompressedVariants(
  rootPath: string,
  fileName: string,
  body: Buffer,
): Promise<void> {
  await writeFile(resolve(rootPath, fileName), body);
  await writeFile(resolve(rootPath, `${fileName}.gz`), gzipSync(body));
  await writeFile(
    resolve(rootPath, `${fileName}.br`),
    brotliCompressSync(body),
  );
}
