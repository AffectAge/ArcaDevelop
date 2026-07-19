import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "project_assets", "map-art", "sources");
const outputDir = path.join(
  rootDir,
  "apps",
  "client",
  "public",
  "game-assets",
  "phaser",
);
const unitOutputDir = path.join(
  rootDir,
  "apps",
  "server",
  "data",
  "scenarios",
  "default",
  "assets",
  "units",
);
const terrainSourcePaths = [
  path.join(sourceDir, "terrain-materials-v6-water-grass.png"),
  path.join(sourceDir, "terrain-materials-v6-dry-cold.png"),
  path.join(sourceDir, "terrain-materials-v6-wet-ground.png"),
];
const objectSourcePath = path.join(sourceDir, "map-objects-v3.png");
const naturalFeatureSourceGrids = {
  temperate: path.join(sourceDir, "natural-choice-temperate-trees-4x4.png"),
  shrubs: path.join(sourceDir, "natural-choice-shrubs-undergrowth-4x4.png"),
  tropical: path.join(sourceDir, "natural-choice-tropical-trees-4x4.png"),
  desert: path.join(sourceDir, "natural-choice-desert-oasis-4x4.png"),
  tundra: path.join(sourceDir, "natural-choice-northern-tundra-4x4.png"),
  wetland: path.join(sourceDir, "natural-choice-wetland-mangrove-4x4.png"),
  snow: path.join(sourceDir, "natural-choice-snow-ice-4x4.png"),
  mountainRidges: path.join(
    sourceDir,
    "natural-choice-mountain-ridges-4x4.png",
  ),
  mountainRocks: path.join(sourceDir, "natural-choice-mountains-rocks-4x4.png"),
};
const ALL_NATURAL_SOURCE_FRAMES = Array.from(
  { length: 16 },
  (_, index) => index,
);
const naturalFeatureSourcePaths = {
  grassland: [
    {
      sourcePath: naturalFeatureSourceGrids.temperate,
      frameIds: Array.from({ length: 12 }, (_, index) => index),
    },
    { sourcePath: naturalFeatureSourceGrids.shrubs, frameIds: [0, 2, 8, 9] },
  ],
  plains: [
    {
      sourcePath: naturalFeatureSourceGrids.temperate,
      frameIds: [0, 1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 15],
    },
    { sourcePath: naturalFeatureSourceGrids.shrubs, frameIds: [0, 2, 8, 9] },
  ],
  tropical: [
    {
      sourcePath: naturalFeatureSourceGrids.tropical,
      frameIds: ALL_NATURAL_SOURCE_FRAMES,
    },
  ],
  desert: [
    {
      sourcePath: naturalFeatureSourceGrids.desert,
      frameIds: ALL_NATURAL_SOURCE_FRAMES,
    },
  ],
  tundra: [
    {
      sourcePath: naturalFeatureSourceGrids.tundra,
      frameIds: ALL_NATURAL_SOURCE_FRAMES,
    },
  ],
  wetland: [
    {
      sourcePath: naturalFeatureSourceGrids.wetland,
      frameIds: ALL_NATURAL_SOURCE_FRAMES,
    },
  ],
  snow: [
    {
      sourcePath: naturalFeatureSourceGrids.snow,
      frameIds: ALL_NATURAL_SOURCE_FRAMES,
    },
  ],
  glacial_mountain: [
    {
      sourcePath: naturalFeatureSourceGrids.snow,
      frameIds: [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    {
      sourcePath: naturalFeatureSourceGrids.mountainRidges,
      frameIds: [0, 6, 7, 9],
    },
  ],
  mountain: [
    {
      sourcePath: naturalFeatureSourceGrids.mountainRidges,
      frameIds: [0, 1, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13],
    },
    { sourcePath: naturalFeatureSourceGrids.tundra, frameIds: [0, 1, 2, 4] },
  ],
  highland: [
    {
      sourcePath: naturalFeatureSourceGrids.mountainRocks,
      frameIds: ALL_NATURAL_SOURCE_FRAMES,
    },
  ],
};
const unitSourcePath = path.join(sourceDir, "map-units-v3.png");
const riverSourcePath = path.join(sourceDir, "river-materials-v1.png");

const TILE_WIDTH = 112;
const TILE_HEIGHT = 128;
const FRAME_MARGIN = 2;
const FRAME_SPACING = 4;
const TERRAIN_ATLAS_COLUMNS = 8;
const TERRAIN_VARIANTS = 1;
const OBJECT_VARIANTS = 4;
const NATURAL_FEATURE_FRAME_SIZE = 128;
const naturalFeatureOutputDir = path.join(outputDir, "natural_features");
const NATURAL_FEATURE_COLUMNS = 4;
const NATURAL_FEATURE_ROWS = 4;
const NATURAL_FEATURE_FRAMES_PER_SET =
  NATURAL_FEATURE_COLUMNS * NATURAL_FEATURE_ROWS;

const terrainGroups = [
  "deep_water",
  "coastal_water",
  "fresh_water",
  "grassland",
  "plains",
  "desert",
  "tundra",
  "snow",
  "tropical",
  "marsh",
];

const terrainSourceCells = {
  deep_water: [0, 0],
  coastal_water: [0, 1],
  fresh_water: [0, 2],
  grassland: [0, 3],
  plains: [1, 0],
  desert: [1, 1],
  tundra: [1, 2],
  snow: [1, 3],
  tropical: [2, 0],
  marsh: [2, 1],
};

const objectIds = [
  "feature:ancient_ruins",
  "marker:city",
  "building:farm",
  "building:mine",
];
const objectSourceCellIndexes = [8, 9, 10, 11];

const unitRows = ["archer", "colonizer", "galley", "warrior"];

await mkdir(outputDir, { recursive: true });
await mkdir(naturalFeatureOutputDir, { recursive: true });
await mkdir(unitOutputDir, { recursive: true });

const terrainFrames = [];
for (const group of terrainGroups) {
  const [sourceSheet, sourceCell] = terrainSourceCells[group];
  let material = await extractGridCell(
    terrainSourcePaths[sourceSheet],
    2,
    2,
    sourceCell,
    0.02,
  );
  if (group === "fresh_water") {
    material = await sharp(material)
      .modulate({ saturation: 0.86, brightness: 0.92, hue: 8 })
      .png()
      .toBuffer();
  }
  terrainFrames.push(await createTerrainFrame(material));
}

const terrainAtlas = await composeFixedAtlas(
  terrainFrames,
  TERRAIN_ATLAS_COLUMNS,
  TILE_WIDTH,
  TILE_HEIGHT,
);
const terrainAtlasPath = path.join(outputDir, "terrain-atlas.webp");
await writeFileWithRetry(
  terrainAtlasPath,
  await sharp(terrainAtlas)
    .webp({ quality: 100, alphaQuality: 100, smartSubsample: false })
    .toBuffer(),
);

const objectFrames = [];
for (let objectIndex = 0; objectIndex < objectIds.length; objectIndex += 1) {
  const sourceCell = await extractGridCell(
    objectSourcePath,
    4,
    3,
    objectSourceCellIndexes[objectIndex],
    0.035,
  );
  const keyed = await removeMagentaKey(sourceCell);
  for (let variant = 0; variant < OBJECT_VARIANTS; variant += 1) {
    objectFrames.push(await normalizeObjectFrame(keyed, variant));
  }
}

const objectAtlas = await composeFixedAtlas(objectFrames, 8, 128, 128);
const objectAtlasPath = path.join(outputDir, "object-atlas.png");
await writeFileWithRetry(objectAtlasPath, objectAtlas);

const naturalFeatureOutputPaths = [];
for (const [textureSetId, sourceFrames] of Object.entries(
  naturalFeatureSourcePaths,
)) {
  const frames = [];
  for (const { sourcePath, frameIds } of sourceFrames) {
    for (const frameId of frameIds) {
      const source = await extractGridCell(
        sourcePath,
        NATURAL_FEATURE_COLUMNS,
        NATURAL_FEATURE_ROWS,
        frameId,
        0.025,
      );
      frames.push(
        await containTransparent(
          await removeMagentaKey(source),
          NATURAL_FEATURE_FRAME_SIZE,
          NATURAL_FEATURE_FRAME_SIZE,
          4,
        ),
      );
    }
  }
  if (frames.length !== NATURAL_FEATURE_FRAMES_PER_SET) {
    throw new Error(
      `Natural feature texture set ${textureSetId} must contain exactly ${NATURAL_FEATURE_FRAMES_PER_SET} frames.`,
    );
  }
  const atlas = await composeFixedAtlas(
    frames,
    NATURAL_FEATURE_COLUMNS,
    NATURAL_FEATURE_FRAME_SIZE,
    NATURAL_FEATURE_FRAME_SIZE,
    0,
    0,
  );
  const outputPath = path.join(
    naturalFeatureOutputDir,
    `${textureSetId}_features.webp`,
  );
  await writeFileWithRetry(
    outputPath,
    await sharp(atlas)
      .webp({ quality: 100, alphaQuality: 100, smartSubsample: false })
      .toBuffer(),
  );
  naturalFeatureOutputPaths.push(outputPath);
}

const borderFrames = [];
for (const style of ["country", "region", "controller", "selection"]) {
  for (let mask = 0; mask < 64; mask += 1) {
    borderFrames.push(await renderBorderFrame(mask, style));
  }
}
const borderAtlas = await composeFixedAtlas(
  borderFrames,
  16,
  TILE_WIDTH,
  TILE_HEIGHT,
);
const borderAtlasPath = path.join(outputDir, "border-atlas.png");
await writeFileWithRetry(borderAtlasPath, borderAtlas);

const riverFrames = [];
const riverMaterials = await extractRiverMaterials(riverSourcePath);
for (let mask = 0; mask < 64; mask += 1)
  riverFrames.push(await renderRiverFrame(mask, riverMaterials));
const riverAtlas = await composeFixedAtlas(
  riverFrames,
  8,
  TILE_WIDTH,
  TILE_HEIGHT,
);
const riverAtlasPath = path.join(outputDir, "river-atlas.png");
await writeFileWithRetry(riverAtlasPath, riverAtlas);

const fillAtlasPath = path.join(outputDir, "fill-atlas.png");
await writeFileWithRetry(fillAtlasPath, await renderFillFrame());

const unitOutputPaths = [];
for (let row = 0; row < unitRows.length; row += 1) {
  const frames = [];
  for (let column = 0; column < 4; column += 1) {
    const sourceCell = await extractGridCell(
      unitSourcePath,
      4,
      4,
      row * 4 + column,
      0.035,
    );
    const keyed = await removeMagentaKey(sourceCell);
    frames.push(await containTransparent(keyed, 64, 64, 2));
  }
  const unitStrip = await composeFixedAtlas(frames, 4, 64, 64, 0, 0);
  const unitOutputPath = path.join(unitOutputDir, `${unitRows[row]}.png`);
  await writeFileWithRetry(unitOutputPath, unitStrip);
  unitOutputPaths.push(unitOutputPath);
}

const naturalFeatureSourceFiles = [
  ...new Set(
    Object.values(naturalFeatureSourcePaths).flatMap((sourceFrames) =>
      sourceFrames.map(({ sourcePath }) => sourcePath),
    ),
  ),
];
const sourceFiles = [
  ...terrainSourcePaths,
  objectSourcePath,
  ...naturalFeatureSourceFiles,
  unitSourcePath,
  riverSourcePath,
];
const outputFiles = [
  terrainAtlasPath,
  objectAtlasPath,
  ...naturalFeatureOutputPaths,
  borderAtlasPath,
  riverAtlasPath,
  fillAtlasPath,
  ...unitOutputPaths,
];
const manifest = {
  id: "arcanorum-phaser-map-v8",
  generatedBy: "scripts/build-phaser-map-atlases.mjs",
  provenance: "project_assets/map-art/provenance.json",
  sourceLicense:
    "Project-owned AI-assisted source artwork; no third-party game assets",
  frame: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    margin: FRAME_MARGIN,
    spacing: FRAME_SPACING,
  },
  terrain: {
    url: "/game-assets/phaser/terrain-atlas.webp",
    columns: TERRAIN_ATLAS_COLUMNS,
    variants: TERRAIN_VARIANTS,
    field: { columns: 1, rows: 1 },
    groups: Object.fromEntries(
      terrainGroups.map((id, index) => [id, index * TERRAIN_VARIANTS]),
    ),
  },
  objects: {
    url: "/game-assets/phaser/object-atlas.png",
    frameWidth: 128,
    frameHeight: 128,
    columns: 8,
    variants: OBJECT_VARIANTS,
    groups: Object.fromEntries(
      objectIds.map((id, index) => [id, index * OBJECT_VARIANTS]),
    ),
  },
  naturalFeatures: {
    frameWidth: NATURAL_FEATURE_FRAME_SIZE,
    frameHeight: NATURAL_FEATURE_FRAME_SIZE,
    columns: NATURAL_FEATURE_COLUMNS,
    rows: NATURAL_FEATURE_ROWS,
    framesPerTextureSet: NATURAL_FEATURE_FRAMES_PER_SET,
    textureSets: Object.keys(naturalFeatureSourcePaths),
    transparentOverlays: true,
    sources: Object.fromEntries(
      Object.entries(naturalFeatureSourcePaths).map(
        ([textureSetId, sourceFrames]) => [
          textureSetId,
          [
            ...new Set(
              sourceFrames.map(({ sourcePath }) =>
                path.relative(rootDir, sourcePath).replaceAll("\\", "/"),
              ),
            ),
          ],
        ],
      ),
    ),
  },
  borders: {
    url: "/game-assets/phaser/border-atlas.png",
    styles: { country: 0, region: 64, controller: 128, selection: 192 },
  },
  rivers: { url: "/game-assets/phaser/river-atlas.png" },
  fill: { url: "/game-assets/phaser/fill-atlas.png" },
  sources: await describeFiles(sourceFiles),
  outputs: await describeFiles(outputFiles),
};
await writeFileWithRetry(
  path.join(outputDir, "map-art-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

async function extractGridCell(sourcePath, columns, rows, index, insetRatio) {
  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width || !metadata.height)
    throw new Error(`Missing image dimensions: ${sourcePath}`);
  const column = index % columns;
  const row = Math.floor(index / columns);
  if (row >= rows)
    throw new Error(`Grid index ${index} is outside ${columns}x${rows}`);
  const stepX = metadata.width / columns;
  const stepY = metadata.height / rows;
  const insetX = Math.max(8, Math.round(stepX * insetRatio));
  const insetY = Math.max(8, Math.round(stepY * insetRatio));
  const left = Math.max(0, Math.round(column * stepX) + insetX);
  const top = Math.max(0, Math.round(row * stepY) + insetY);
  const right = Math.min(
    metadata.width,
    Math.round((column + 1) * stepX) - insetX,
  );
  const bottom = Math.min(
    metadata.height,
    Math.round((row + 1) * stepY) - insetY,
  );
  return sharp(sourcePath)
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
}

async function createTerrainFrame(source) {
  const frame = await sharp(source)
    .resize(TILE_WIDTH, TILE_HEIGHT, {
      fit: "cover",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
  return maskPointyHex(frame);
}

async function maskPointyHex(source) {
  const mask = Buffer.from(
    `<svg width="${TILE_WIDTH}" height="${TILE_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><polygon points="${hexPoints(
      0,
    )
      .map(([x, y]) => `${x},${y}`)
      .join(" ")}" fill="white"/></svg>`,
  );
  return sharp(source)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function removeMagentaKey(source) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const dominance = Math.min(red, blue) - green;
    const brightness = (red + blue) / 2;
    const dominanceFactor = clamp01((dominance - 30) / 40);
    const brightnessFactor = clamp01((brightness - 100) / 60);
    const keyStrength = dominanceFactor * brightnessFactor;
    const alpha = Math.round(255 * (1 - keyStrength));
    data[offset + 3] = Math.min(data[offset + 3], alpha);
    if (alpha < 250) {
      data[offset] = Math.min(red, green + 24);
      data[offset + 2] = Math.min(blue, green + 24);
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function normalizeObjectFrame(source, variant) {
  let image = sharp(source);
  if (variant === 1 || variant === 3) image = image.flop();
  const padding = variant >= 2 ? 9 : 5;
  return containTransparent(await image.png().toBuffer(), 128, 128, padding);
}

async function containTransparent(source, width, height, padding) {
  const resized = await sharp(source)
    .resize(width - padding * 2, height - padding * 2, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp(resized)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function composeFixedAtlas(
  frames,
  columns,
  frameWidth,
  frameHeight,
  margin = FRAME_MARGIN,
  spacing = FRAME_SPACING,
) {
  const rows = Math.ceil(frames.length / columns);
  const width =
    margin * 2 + columns * frameWidth + Math.max(0, columns - 1) * spacing;
  const height =
    margin * 2 + rows * frameHeight + Math.max(0, rows - 1) * spacing;
  const composite = frames.map((input, index) => ({
    input,
    left: margin + (index % columns) * (frameWidth + spacing),
    top: margin + Math.floor(index / columns) * (frameHeight + spacing),
  }));
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composite)
    .png()
    .toBuffer();
}

async function renderBorderFrame(mask, style) {
  const points = hexPoints();
  const edges = [
    [1, 2],
    [0, 1],
    [5, 0],
    [4, 5],
    [3, 4],
    [2, 3],
  ];
  const config = {
    country: { color: "#f5e5b7", width: 5, dash: "" },
    region: { color: "#738092", width: 2, dash: "" },
    controller: { color: "#e1705b", width: 3, dash: "8 5" },
    selection: { color: "#ffd56a", width: 5, dash: "" },
  }[style];
  const lines = edges
    .flatMap(([from, to], direction) => {
      if ((mask & (1 << direction)) === 0) return [];
      return [
        `<line x1="${points[from][0]}" y1="${points[from][1]}" x2="${points[to][0]}" y2="${points[to][1]}"/>`,
      ];
    })
    .join("");
  const svg = Buffer.from(
    `<svg width="${TILE_WIDTH}" height="${TILE_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="${config.color}" stroke-width="${config.width}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${config.dash}">${lines}</g></svg>`,
  );
  return sharp(svg).png().toBuffer();
}

async function extractRiverMaterials(sourcePath) {
  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width || !metadata.height)
    throw new Error(`Missing image dimensions: ${sourcePath}`);
  const halfWidth = Math.floor(metadata.width / 2);
  const halfHeight = Math.floor(metadata.height / 2);
  const cells = await Promise.all(
    [
      [0, 0],
      [halfWidth, 0],
      [0, halfHeight],
      [halfWidth, halfHeight],
    ].map(([left, top]) =>
      sharp(sourcePath)
        .extract({ left, top, width: halfWidth, height: halfHeight })
        .resize(TILE_WIDTH, TILE_HEIGHT, { fit: "cover" })
        .png()
        .toBuffer(),
    ),
  );
  return {
    shallowWater: cells[0],
    deepWater: cells[1],
    bank: cells[2],
    shoreline: cells[3],
  };
}

async function renderRiverFrame(mask, materials) {
  if (mask === 0) {
    return sharp({
      create: {
        width: TILE_WIDTH,
        height: TILE_HEIGHT,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
  }
  const edgeMidpoints = [
    [TILE_WIDTH, TILE_HEIGHT / 2],
    [(TILE_WIDTH * 3) / 4, TILE_HEIGHT / 8],
    [TILE_WIDTH / 4, TILE_HEIGHT / 8],
    [0, TILE_HEIGHT / 2],
    [TILE_WIDTH / 4, (TILE_HEIGHT * 7) / 8],
    [(TILE_WIDTH * 3) / 4, (TILE_HEIGHT * 7) / 8],
  ];
  const paths = edgeMidpoints
    .flatMap(([x, y], direction) => {
      if ((mask & (1 << direction)) === 0) return [];
      const bend = direction % 2 === 0 ? -4 : 4;
      return [
        `<path d="M ${TILE_WIDTH / 2} ${TILE_HEIGHT / 2} Q ${(x + TILE_WIDTH / 2) / 2 + bend} ${(y + TILE_HEIGHT / 2) / 2} ${x} ${y}"/>`,
      ];
    })
    .join("");
  const bankMask = riverStrokeMask(paths, 18);
  const shorelineMask = riverStrokeMask(paths, 14);
  const waterMask = riverStrokeMask(paths, 10);
  const currentMask = riverStrokeMask(paths, 4);
  const [bank, shoreline, water, current] = await Promise.all([
    applyAlphaMask(materials.bank, bankMask),
    applyAlphaMask(materials.shoreline, shorelineMask),
    applyAlphaMask(materials.shallowWater, waterMask),
    applyAlphaMask(materials.deepWater, currentMask, 0.52),
  ]);
  return sharp({
    create: {
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: bank },
      { input: shoreline },
      { input: water },
      { input: current },
    ])
    .png()
    .toBuffer();
}

function riverStrokeMask(paths, width) {
  return Buffer.from(
    `<svg width="${TILE_WIDTH}" height="${TILE_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#fff" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${paths}</g><circle cx="${TILE_WIDTH / 2}" cy="${TILE_HEIGHT / 2}" r="${width / 2}" fill="#fff"/></svg>`,
  );
}

async function applyAlphaMask(material, mask, alpha = 1) {
  return sharp(material)
    .ensureAlpha(alpha)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function renderFillFrame() {
  const points = hexPoints()
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
  const svg = Buffer.from(
    `<svg width="${TILE_WIDTH}" height="${TILE_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><polygon points="${points}" fill="#ffffff" fill-opacity="0.34"/></svg>`,
  );
  return sharp(svg).png().toBuffer();
}

function hexPoints(inset = 1) {
  return [
    [TILE_WIDTH / 2, inset],
    [TILE_WIDTH - inset, TILE_HEIGHT / 4],
    [TILE_WIDTH - inset, (TILE_HEIGHT * 3) / 4],
    [TILE_WIDTH / 2, TILE_HEIGHT - inset],
    [inset, (TILE_HEIGHT * 3) / 4],
    [inset, TILE_HEIGHT / 4],
  ];
}

async function writeFileWithRetry(filePath, contents) {
  const retryableCodes = new Set(["EBUSY", "EPERM", "UNKNOWN"]);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await writeFile(filePath, contents);
      return;
    } catch (error) {
      if (attempt === 3 || !retryableCodes.has(error?.code)) throw error;
      await delay(75 * 2 ** attempt);
    }
  }
}

async function describeFiles(files) {
  return Promise.all(
    files.map(async (filePath) => {
      const bytes = await readFile(filePath);
      return {
        path: path.relative(rootDir, filePath).replaceAll("\\", "/"),
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  );
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
