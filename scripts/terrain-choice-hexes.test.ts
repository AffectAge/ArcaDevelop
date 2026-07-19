import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

type TerrainChoiceManifest = {
  id: string;
  frame: { width: number; height: number; margin: number; spacing: number };
  grid: { columns: number; rows: number; framesPerTextureSet: number };
  textureSets: Array<{
    id: string;
    source: string;
    output: string;
    sha256: string;
    frames: Array<{ id: number; row: number; column: number }>;
  }>;
};

describe("terrain choice hex atlases", () => {
  it("keeps sixteen ready pointy-top frames for every terrain family", async () => {
    const manifest = await readManifest();
    expect(manifest).toMatchObject({
      id: "arcanorum-terrain-choice-hexes-v1",
      frame: { width: 112, height: 128, margin: 2, spacing: 4 },
      grid: { columns: 4, rows: 4, framesPerTextureSet: 16 },
    });
    expect(manifest.textureSets.map(({ id }) => id)).toEqual([
      "deep_water",
      "coastal_water",
      "fresh_water",
      "grassland",
      "plains",
      "tropical",
      "desert",
      "tundra",
      "wetland",
      "snow",
      "highland",
    ]);

    for (const textureSet of manifest.textureSets) {
      expect(textureSet.frames).toHaveLength(16);
      expect(textureSet.frames.map(({ id }) => id)).toEqual(
        Array.from({ length: 16 }, (_, index) => index),
      );
      expect(
        createHash("sha256")
          .update(await readFile(resolve(textureSet.output)))
          .digest("hex"),
      ).toBe(textureSet.sha256);
      const metadata = await sharp(resolve(textureSet.output)).metadata();
      expect(metadata.hasAlpha, textureSet.id).toBe(true);
      expect(metadata.width, textureSet.id).toBe(464);
      expect(metadata.height, textureSet.id).toBe(528);

      for (const frame of textureSet.frames) {
        const left =
          manifest.frame.margin +
          (frame.column - 1) * (manifest.frame.width + manifest.frame.spacing);
        const top =
          manifest.frame.margin +
          (frame.row - 1) * (manifest.frame.height + manifest.frame.spacing);
        const { data, info } = await sharp(resolve(textureSet.output))
          .extract({
            left,
            top,
            width: 1,
            height: 1,
          })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        expect(
          data[info.channels - 1],
          `${textureSet.id}:${frame.id}:atlas-corner`,
        ).toBe(0);
        const center = await sharp(resolve(textureSet.output))
          .extract({
            left: left + Math.floor(manifest.frame.width / 2),
            top: top + Math.floor(manifest.frame.height / 2),
            width: 1,
            height: 1,
          })
          .ensureAlpha()
          .raw()
          .toBuffer();
        expect(center[3], `${textureSet.id}:${frame.id}:hex-center`).toBe(255);
      }
    }
  });
});

async function readManifest(): Promise<TerrainChoiceManifest> {
  return JSON.parse(
    await readFile(
      resolve(
        "project_assets/map-art/sources/terrain-choice-hexes-manifest.json",
      ),
      "utf8",
    ),
  ) as TerrainChoiceManifest;
}
