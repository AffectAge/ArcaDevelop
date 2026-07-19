import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import {
  DEFAULT_HEX_MAP_SETTINGS,
  type HexMapArtifact,
  type HexTile,
  type MapFeatureInstance,
} from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  buildHexMapClientArtifacts,
  ensureHexMapClientArtifacts,
  loadHexMapClientArtifactRuntime,
} from "./hexMapClientArtifacts";

describe("hexMapClientArtifacts", () => {
  it("builds deterministic content-addressed chunks from normalized source order", () => {
    const mapArtifact = makeArtifact();
    const features = makeFeatures();
    const first = buildHexMapClientArtifacts({ mapArtifact, features });
    const second = buildHexMapClientArtifacts({
      mapArtifact: {
        ...mapArtifact,
        tiles: [...mapArtifact.tiles].reverse(),
        riverEdges: [...mapArtifact.riverEdges].reverse(),
        coastOverlays: [...mapArtifact.coastOverlays].reverse(),
      },
      features: [...features].reverse(),
    });

    expect(second.manifest).toEqual(first.manifest);
    expect(second.manifestJson.equals(first.manifestJson)).toBe(true);
    expect(second.navigation.json.equals(first.navigation.json)).toBe(true);
    expect(second.navigation.gzip.equals(first.navigation.gzip)).toBe(true);
    expect(second.navigation.brotli.equals(first.navigation.brotli)).toBe(true);
    expect(second.chunks.map((chunk) => chunk.json.toString("utf8"))).toEqual(
      first.chunks.map((chunk) => chunk.json.toString("utf8")),
    );
    expect(second.chunks.map((chunk) => chunk.gzip.toString("base64"))).toEqual(
      first.chunks.map((chunk) => chunk.gzip.toString("base64")),
    );
    expect(
      second.chunks.map((chunk) => chunk.brotli.toString("base64")),
    ).toEqual(first.chunks.map((chunk) => chunk.brotli.toString("base64")));
    expect(first.manifest.artifactVersion).toMatch(/^[a-f0-9]{64}$/);
    expect(first.manifest.chunks.map((chunk) => chunk.fileName)).toEqual([
      "chunk-0-0.json",
      "chunk-1-0.json",
    ]);
  });

  it("includes an exact one-neighbor visual halo across chunk and wrap seams", () => {
    const built = buildHexMapClientArtifacts({
      mapArtifact: makeArtifact(),
      features: makeFeatures(),
    });
    const firstChunk = built.chunks[0]?.value;

    expect(firstChunk).toBeDefined();
    const primaryIds = new Set(firstChunk?.tiles.map((tile) => tile.id));
    expect(firstChunk?.visualHalo.map((tile) => tile.id)).toEqual([
      "hex:2:0",
      "hex:3:0",
      "hex:2:1",
      "hex:3:1",
    ]);
    expect(
      firstChunk?.visualHalo.every((tile) => !primaryIds.has(tile.id)),
    ).toBe(true);
    expect(firstChunk?.riverEdges).toEqual([
      {
        hexId: "hex:3:0",
        direction: 0,
        width: 2,
        riverClass: "navigable",
        navigable: true,
        crossingCost: 3,
      },
    ]);
    expect(firstChunk?.coastOverlays).toEqual([
      { hexId: "hex:1:0", direction: 0, strength: 0.8 },
    ]);
    expect(firstChunk?.features.map((feature) => feature.id)).toEqual([
      "map_feature:first",
    ]);
  });

  it("emits row-major navigation arrays and compression/hash descriptors", () => {
    const built = buildHexMapClientArtifacts({
      mapArtifact: makeArtifact(),
      features: makeFeatures(),
    });

    expect(built.navigation.value.movementCosts).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(built.navigation.value.regionIds).toEqual([
      "region:east",
      "region:west",
    ]);
    expect(built.navigation.value.regionIndexes).toEqual([
      1, 1, 0, 0, 1, 1, 0, 0,
    ]);
    expect(built.navigation.value.riverEdges[0]).toEqual([3, 0, 2, 2, 1, 3]);

    for (const artifact of [built.navigation, ...built.chunks]) {
      expect(createHash("sha256").update(artifact.json).digest("hex")).toBe(
        artifact.descriptor.contentHash,
      );
      expect(gunzipSync(artifact.gzip).equals(artifact.json)).toBe(true);
      expect(brotliDecompressSync(artifact.brotli).equals(artifact.json)).toBe(
        true,
      );
      expect(artifact.descriptor.byteLength).toBe(artifact.json.length);
      expect(artifact.descriptor.gzipByteLength).toBe(artifact.gzip.length);
      expect(artifact.descriptor.brotliByteLength).toBe(artifact.brotli.length);
    }
  });

  it("rejects static feature references that are not part of the rectangular artifact", () => {
    const features = makeFeatures();
    features[0] = { ...features[0], hexId: "hex:9:9" };

    expect(() =>
      buildHexMapClientArtifacts({ mapArtifact: makeArtifact(), features }),
    ).toThrow("hex-map-client-feature-hex-not-found:map_feature:first");
  });

  it("persists a version directory and rebuilds an incomplete compressed variant", async () => {
    const scenarioDir = await mkdtemp(
      join(tmpdir(), "arc-hex-client-artifacts-"),
    );
    try {
      const input = {
        scenarioDir,
        mapArtifact: makeArtifact(),
        features: makeFeatures(),
      };
      const first = ensureHexMapClientArtifacts(input);
      const firstChunk = first.manifest.chunks[0];
      expect(firstChunk).toBeDefined();
      expect(first.rootPath).toContain(
        join("hex-map-client", first.artifactVersion),
      );
      expect(existsSync(first.manifestPath)).toBe(true);
      expect(
        existsSync(join(first.rootPath, `${firstChunk?.fileName}.gz`)),
      ).toBe(true);
      expect(
        existsSync(join(first.rootPath, `${firstChunk?.fileName}.br`)),
      ).toBe(true);

      await unlink(join(first.rootPath, `${firstChunk?.fileName}.br`));
      const repaired = ensureHexMapClientArtifacts(input);
      expect(repaired.artifactVersion).toBe(first.artifactVersion);
      expect(
        existsSync(join(repaired.rootPath, `${firstChunk?.fileName}.br`)),
      ).toBe(true);
      expect(loadHexMapClientArtifactRuntime(scenarioDir)?.manifest).toEqual(
        repaired.manifest,
      );
    } finally {
      await rm(scenarioDir, { recursive: true, force: true });
    }
  });

  it("rejects and repairs content-addressed files whose bytes no longer match the manifest", async () => {
    const scenarioDir = await mkdtemp(
      join(tmpdir(), "arc-hex-client-integrity-"),
    );
    try {
      const input = {
        scenarioDir,
        mapArtifact: makeArtifact(),
        features: makeFeatures(),
      };
      const first = ensureHexMapClientArtifacts(input);
      const firstChunk = first.manifest.chunks[0];
      expect(firstChunk).toBeDefined();
      if (!firstChunk) throw new Error("expected a generated chunk");
      const brotliPath = join(first.rootPath, `${firstChunk.fileName}.br`);
      const originalBrotli = await readFile(brotliPath);
      const corruptBrotli = Buffer.from(originalBrotli);
      corruptBrotli[Math.floor(corruptBrotli.length / 2)] ^= 0xff;
      await writeFile(brotliPath, corruptBrotli);

      expect(loadHexMapClientArtifactRuntime(scenarioDir)).toBeNull();

      const repaired = ensureHexMapClientArtifacts(input);
      expect(repaired.artifactVersion).toBe(first.artifactVersion);
      expect(loadHexMapClientArtifactRuntime(scenarioDir)?.manifest).toEqual(
        repaired.manifest,
      );
      expect(await readFile(brotliPath)).toEqual(originalBrotli);
    } finally {
      await rm(scenarioDir, { recursive: true, force: true });
    }
  });

  it("keeps the immediately previous version for atomic runtime cutover and prunes older versions", async () => {
    const scenarioDir = await mkdtemp(
      join(tmpdir(), "arc-hex-client-cutover-"),
    );
    try {
      const first = ensureHexMapClientArtifacts({
        scenarioDir,
        mapArtifact: makeArtifact(),
        features: makeFeatures(),
      });
      const secondMap = makeArtifact();
      secondMap.tiles[0].movementCost = 20;
      const second = ensureHexMapClientArtifacts({
        scenarioDir,
        mapArtifact: secondMap,
        features: makeFeatures(),
      });

      expect(second.artifactVersion).not.toBe(first.artifactVersion);
      expect(existsSync(first.rootPath)).toBe(true);

      const thirdMap = makeArtifact();
      thirdMap.tiles[0].movementCost = 30;
      const third = ensureHexMapClientArtifacts({
        scenarioDir,
        mapArtifact: thirdMap,
        features: makeFeatures(),
      });

      expect(third.artifactVersion).not.toBe(second.artifactVersion);
      expect(existsSync(second.rootPath)).toBe(true);
      expect(existsSync(first.rootPath)).toBe(false);
    } finally {
      await rm(scenarioDir, { recursive: true, force: true });
    }
  });
});

function makeArtifact(): HexMapArtifact {
  const settings = {
    ...DEFAULT_HEX_MAP_SETTINGS,
    width: 4,
    height: 2,
    chunkSize: 2,
    wrapX: true,
  };
  const tiles: HexTile[] = [];
  for (let r = 0; r < settings.height; r += 1) {
    for (let q = 0; q < settings.width; q += 1) {
      tiles.push(makeTile(q, r, q + r * settings.width + 1));
    }
  }
  return {
    version: 1,
    settings,
    tiles,
    riverEdges: [
      {
        hexId: "hex:3:0",
        direction: 0,
        width: 2,
        riverClass: "navigable",
        navigable: true,
        crossingCost: 3,
      },
    ],
    coastOverlays: [{ hexId: "hex:1:0", direction: 0, strength: 0.8 }],
  };
}

function makeTile(q: number, r: number, movementCost: number): HexTile {
  return {
    id: `hex:${q}:${r}`,
    q,
    r,
    chunkId: `hex-chunk:${Math.floor(q / 2)}:0`,
    regionId: q < 2 ? "region:west" : "region:east",
    waterKind: q === 3 ? "sea" : null,
    elevation: 0.4,
    moisture: 0.5,
    temperature: 0.6,
    temperatureBand: "temperate",
    moistureBand: "normal",
    distanceToWater: q === 3 ? 0 : 1,
    isCoastal: q === 2,
    riverMask: 0,
    riverWidth: 0,
    mapTags: q === 3 ? ["water:coastal"] : ["biome:grassland"],
    movementCost,
    stopsMovementOnEnter: q === 2,
    passable: true,
  };
}

function makeFeatures(): MapFeatureInstance[] {
  return [
    {
      id: "map_feature:first",
      typeId: "feature:ancient_ruins",
      category: "site",
      hexId: "hex:0:0",
      regionId: "region:west",
      visualId: "feature:ancient_ruins",
      visibility: "known",
    },
    {
      id: "map_feature:second",
      typeId: "feature:ancient_ruins",
      category: "site",
      hexId: "hex:2:0",
      regionId: "region:east",
      visualId: "feature:ancient_ruins",
      visibility: "known",
    },
  ];
}
