import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

type FileHash = { path: string; sha256: string };

type PhaserMapArtManifest = {
  id: string;
  generatedBy: string;
  provenance: string;
  sources: FileHash[];
  outputs: FileHash[];
  frame: { width: number; height: number; margin: number; spacing: number };
  terrain: {
    columns: number;
    variants: number;
    field: { columns: number; rows: number };
    groups: Record<string, number>;
  };
  naturalFeatures: {
    frameWidth: number;
    frameHeight: number;
    columns: number;
    rows: number;
    framesPerTextureSet: number;
    textureSets: string[];
    transparentOverlays: boolean;
  };
};

type MapArtProvenance = {
  id: string;
  origin: string;
  license: string;
  style: string;
  sources: string[];
  outputs: string[];
};

describe("Phaser map art manifest", () => {
  it("tracks every source and generated output with project-owned provenance", async () => {
    const manifest = await readJson<PhaserMapArtManifest>(
      "apps/client/public/game-assets/phaser/map-art-manifest.json",
    );
    const provenance = await readJson<MapArtProvenance>(manifest.provenance);

    expect(manifest).toMatchObject({
      id: "arcanorum-phaser-map-v8",
      generatedBy: "scripts/build-phaser-map-atlases.mjs",
      provenance: "project_assets/map-art/provenance.json",
    });
    expect(provenance).toMatchObject({
      id: manifest.id,
      license: "Project-owned; no third-party or Firaxis/Civilization assets",
    });
    expect(manifest.sources.map(({ path }) => path)).toEqual(
      provenance.sources.filter((path) => path.endsWith(".png")),
    );
    expect(manifest.outputs.map(({ path }) => path)).toEqual(
      provenance.outputs,
    );

    for (const file of [...manifest.sources, ...manifest.outputs]) {
      const bytes = await readFile(resolve(file.path));
      expect(createHash("sha256").update(bytes).digest("hex"), file.path).toBe(
        file.sha256,
      );
    }
  });

  it("keeps generated files outside the source-art folder", async () => {
    const manifest = await readJson<PhaserMapArtManifest>(
      "apps/client/public/game-assets/phaser/map-art-manifest.json",
    );
    for (const output of manifest.outputs) {
      expect(
        relative(
          resolve("project_assets/map-art/sources"),
          resolve(output.path),
        ).startsWith(".."),
      ).toBe(true);
    }
  });

  it("keeps the maximum-quality WebP terrain atlas inside mobile transfer and GPU budgets", async () => {
    const atlasPath = resolve(
      "apps/client/public/game-assets/phaser/terrain-atlas.webp",
    );
    const [bytes, metadata] = await Promise.all([
      readFile(atlasPath),
      sharp(atlasPath).metadata(),
    ]);
    expect(bytes.byteLength).toBeLessThanOrEqual(1 * 1024 * 1024);
    expect(metadata.width).toBeLessThanOrEqual(4_096);
    expect(metadata.height).toBeLessThanOrEqual(4_096);
    expect(
      (metadata.width ?? 0) * (metadata.height ?? 0) * 4,
    ).toBeLessThanOrEqual(2 * 1024 * 1024);
  });

  it("keeps one visibly distinct frame per biome", async () => {
    const manifest = await readJson<PhaserMapArtManifest>(
      "apps/client/public/game-assets/phaser/map-art-manifest.json",
    );
    const atlasPath =
      "apps/client/public/game-assets/phaser/terrain-atlas.webp";
    expect(manifest.terrain.variants).toBe(1);
    expect(manifest.terrain.field).toEqual({ columns: 1, rows: 1 });
    const groups = Object.entries(manifest.terrain.groups);
    const frames = await Promise.all(
      groups.map(([, frame]) =>
        readAtlasFrameRgb(
          atlasPath,
          frame,
          manifest.frame,
          manifest.terrain.columns,
        ),
      ),
    );
    for (let left = 0; left < frames.length; left += 1) {
      for (let right = left + 1; right < frames.length; right += 1) {
        expect(
          meanAbsoluteDifference(frames[left], frames[right]),
          `${groups[left][0]}:${groups[right][0]}`,
        ).toBeGreaterThan(8);
      }
    }
  }, 30_000);

  it("ships sixteen transparent individual natural objects for every terrain atlas", async () => {
    const manifest = await readJson<PhaserMapArtManifest>(
      "apps/client/public/game-assets/phaser/map-art-manifest.json",
    );
    expect(manifest.naturalFeatures).toMatchObject({
      frameWidth: 128,
      frameHeight: 128,
      columns: 4,
      rows: 4,
      framesPerTextureSet: 16,
      transparentOverlays: true,
    });
    expect(manifest.naturalFeatures.textureSets).toHaveLength(10);
    expect(manifest.naturalFeatures.textureSets).toEqual(
      expect.arrayContaining(["mountain", "glacial_mountain", "highland"]),
    );

    for (const textureSet of manifest.naturalFeatures.textureSets) {
      const atlasPath = `apps/client/public/game-assets/phaser/natural_features/${textureSet}_features.webp`;
      const metadata = await sharp(resolve(atlasPath)).metadata();
      expect(metadata.hasAlpha, textureSet).toBe(true);
      expect(metadata.width, textureSet).toBe(512);
      expect(metadata.height, textureSet).toBe(512);
      for (
        let frame = 0;
        frame < manifest.naturalFeatures.framesPerTextureSet;
        frame += 1
      ) {
        const { data, info } = await sharp(resolve(atlasPath))
          .extract({
            left:
              (frame % manifest.naturalFeatures.columns) *
              manifest.naturalFeatures.frameWidth,
            top:
              Math.floor(frame / manifest.naturalFeatures.columns) *
              manifest.naturalFeatures.frameHeight,
            width: manifest.naturalFeatures.frameWidth,
            height: manifest.naturalFeatures.frameHeight,
          })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        expect(data[3], `${textureSet}:${frame}:top-left`).toBeLessThan(24);
        let maximumLowerRowCoverage = 0;
        for (let y = info.height - 16; y < info.height; y += 1) {
          let opaquePixels = 0;
          for (let x = 0; x < info.width; x += 1) {
            if (data[(y * info.width + x) * 4 + 3] > 200) opaquePixels += 1;
          }
          maximumLowerRowCoverage = Math.max(
            maximumLowerRowCoverage,
            opaquePixels / info.width,
          );
        }
        expect(
          maximumLowerRowCoverage,
          `${textureSet}:${frame}:ground-plane`,
        ).toBeLessThan(0.94);
      }
    }
  }, 30_000);

  it("covers adjacent pointy-top hexes without transparent seams", async () => {
    const manifest = await readJson<PhaserMapArtManifest>(
      "apps/client/public/game-assets/phaser/map-art-manifest.json",
    );
    const frame = await readAtlasFramePng(
      "apps/client/public/game-assets/phaser/terrain-atlas.webp",
      0,
      manifest.frame,
      manifest.terrain.columns,
    );
    const composites = [];
    for (let r = 0; r <= 5; r += 1) {
      for (let q = 0; q <= 5; q += 1) {
        const centerX = 112 + manifest.frame.width * (q + (r % 2) * 0.5);
        const centerY = 128 + manifest.frame.height * 0.75 * r;
        composites.push({
          input: frame,
          left: Math.round(centerX - manifest.frame.width / 2),
          top: Math.round(centerY - manifest.frame.height / 2),
        });
      }
    }
    const { data, info } = await sharp({
      create: {
        width: 800,
        height: 720,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      .raw()
      .toBuffer({ resolveWithObject: true });
    let minimumAlpha = 255;
    for (let y = 128; y < 512; y += 1) {
      for (let x = 112; x < 560; x += 1) {
        minimumAlpha = Math.min(
          minimumAlpha,
          data[(y * info.width + x) * 4 + 3],
        );
      }
    }
    expect(minimumAlpha).toBeGreaterThan(160);
  });

  it("keeps textured river endpoints opaque at all six neighboring edges", async () => {
    const manifest = await readJson<PhaserMapArtManifest>(
      "apps/client/public/game-assets/phaser/map-art-manifest.json",
    );
    const edgeMidpoints = [
      [manifest.frame.width - 1, manifest.frame.height / 2],
      [(manifest.frame.width * 3) / 4, manifest.frame.height / 8],
      [manifest.frame.width / 4, manifest.frame.height / 8],
      [0, manifest.frame.height / 2],
      [manifest.frame.width / 4, (manifest.frame.height * 7) / 8 - 1],
      [(manifest.frame.width * 3) / 4, (manifest.frame.height * 7) / 8 - 1],
    ];
    for (let direction = 0; direction < 6; direction += 1) {
      const frame = await readAtlasFrameRaw(
        "apps/client/public/game-assets/phaser/river-atlas.png",
        1 << direction,
        manifest.frame,
        8,
      );
      const [x, y] = edgeMidpoints[direction];
      expect(
        frame[(y * manifest.frame.width + x) * 4 + 3],
        `river-direction:${direction}`,
      ).toBe(255);
    }
  });
});

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T;
}

async function readAtlasFramePng(
  atlasPath: string,
  frameIndex: number,
  frame: PhaserMapArtManifest["frame"],
  columns: number,
): Promise<Buffer> {
  const column = frameIndex % columns;
  const row = Math.floor(frameIndex / columns);
  return sharp(resolve(atlasPath))
    .extract({
      left: frame.margin + column * (frame.width + frame.spacing),
      top: frame.margin + row * (frame.height + frame.spacing),
      width: frame.width,
      height: frame.height,
    })
    .png()
    .toBuffer();
}

async function readAtlasFrameRaw(
  atlasPath: string,
  frameIndex: number,
  frame: PhaserMapArtManifest["frame"],
  columns: number,
): Promise<Buffer> {
  return sharp(await readAtlasFramePng(atlasPath, frameIndex, frame, columns))
    .ensureAlpha()
    .raw()
    .toBuffer();
}

async function readAtlasFrameRgb(
  atlasPath: string,
  frameIndex: number,
  frame: PhaserMapArtManifest["frame"],
  columns: number,
): Promise<Buffer> {
  return sharp(await readAtlasFramePng(atlasPath, frameIndex, frame, columns))
    .extract({
      left: 16,
      top: 20,
      width: frame.width - 32,
      height: frame.height - 40,
    })
    .removeAlpha()
    .raw()
    .toBuffer();
}

function meanAbsoluteDifference(left: Buffer, right: Buffer): number {
  expect(left.length).toBe(right.length);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference += Math.abs(left[index] - right[index]);
  }
  return difference / left.length;
}
