import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "project_assets", "map-art", "sources");
const columns = 4;
const rows = 4;
const frameWidth = 112;
const frameHeight = 128;
const margin = 2;
const spacing = 4;

const terrainChoiceSets = {
  deep_water: "terrain-choice-deep-water-surface-4x4.png",
  coastal_water: "terrain-choice-coastal-water-surface-4x4.png",
  fresh_water: "terrain-choice-fresh-water-surface-4x4.png",
  grassland: "terrain-choice-grassland-surface-4x4.png",
  plains: "terrain-choice-plains-surface-4x4.png",
  tropical: "terrain-choice-tropical-surface-4x4.png",
  desert: "terrain-choice-desert-surface-4x4.png",
  tundra: "terrain-choice-tundra-surface-4x4.png",
  wetland: "terrain-choice-wetland-surface-4x4.png",
  snow: "terrain-choice-snow-surface-4x4.png",
  highland: "terrain-choice-highland-surface-4x4.png",
};

const textureSets = [];
for (const [terrainId, sourceFile] of Object.entries(terrainChoiceSets)) {
  const sourcePath = path.join(sourceDir, sourceFile);
  const frames = await Promise.all(
    Array.from({ length: columns * rows }, (_, frameId) =>
      createHexTerrainFrame(extractGridCell(sourcePath, frameId)),
    ),
  );
  await Promise.all(frames.map(validateHexTerrainFrame));
  const atlas = await composeAtlas(frames);
  const outputFile = `terrain-choice-${terrainId}-hexes-4x4.png`;
  const outputPath = path.join(sourceDir, outputFile);
  await writeFile(outputPath, atlas);
  textureSets.push({
    id: terrainId,
    source: relativePath(sourcePath),
    output: relativePath(outputPath),
    sha256: await sha256(atlas),
    frames: Array.from({ length: columns * rows }, (_, index) => ({
      id: index,
      row: Math.floor(index / columns) + 1,
      column: (index % columns) + 1,
    })),
  });
}

const manifest = {
  id: "arcanorum-terrain-choice-hexes-v1",
  generatedBy: "scripts/build-terrain-choice-hexes.mjs",
  frame: { width: frameWidth, height: frameHeight, margin, spacing },
  grid: { columns, rows, framesPerTextureSet: columns * rows },
  textureSets,
};
await writeFile(
  path.join(sourceDir, "terrain-choice-hexes-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

async function extractGridCell(sourcePath, index) {
  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width || !metadata.height)
    throw new Error(`Missing image dimensions: ${sourcePath}`);
  const column = index % columns;
  const row = Math.floor(index / columns);
  if (row >= rows)
    throw new Error(`Frame ${index} is outside the ${columns}x${rows} grid`);
  const left = Math.round((column * metadata.width) / columns);
  const top = Math.round((row * metadata.height) / rows);
  const right = Math.round(((column + 1) * metadata.width) / columns);
  const bottom = Math.round(((row + 1) * metadata.height) / rows);
  return sharp(sourcePath)
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
}

async function createHexTerrainFrame(source) {
  const material = await sharp(await source)
    .resize(frameWidth, frameHeight, {
      fit: "cover",
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .png()
    .toBuffer();
  return sharp(material)
    .composite([{ input: hexMask(), blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function validateHexTerrainFrame(frame) {
  const { data, info } = await sharp(frame)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const topLeftAlpha = data[3];
  const centerOffset =
    (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) *
      info.channels +
    3;
  if (topLeftAlpha !== 0)
    throw new Error(
      "A terrain choice frame must be transparent outside the hex",
    );
  if (data[centerOffset] !== 255)
    throw new Error("A terrain choice frame must be opaque inside the hex");
}

async function composeAtlas(frames) {
  const width = margin * 2 + columns * frameWidth + (columns - 1) * spacing;
  const height = margin * 2 + rows * frameHeight + (rows - 1) * spacing;
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(
      frames.map((input, index) => ({
        input,
        left: margin + (index % columns) * (frameWidth + spacing),
        top: margin + Math.floor(index / columns) * (frameHeight + spacing),
      })),
    )
    .png()
    .toBuffer();
}

function hexMask() {
  const points = [
    [frameWidth / 2, 1],
    [frameWidth - 1, frameHeight / 4],
    [frameWidth - 1, (frameHeight * 3) / 4],
    [frameWidth / 2, frameHeight - 1],
    [1, (frameHeight * 3) / 4],
    [1, frameHeight / 4],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
  return Buffer.from(
    `<svg width="${frameWidth}" height="${frameHeight}" xmlns="http://www.w3.org/2000/svg"><polygon points="${points}" fill="#fff"/></svg>`,
  );
}

async function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function relativePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll("\\", "/");
}
