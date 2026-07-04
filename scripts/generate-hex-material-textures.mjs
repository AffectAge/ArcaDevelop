import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

const MATERIALS = [
  { id: "deep_water", color: [23, 69, 92], kind: "water", relief: "water" },
  { id: "coastal_water", color: [46, 122, 133], kind: "water", relief: "water" },
  { id: "fresh_water", color: [64, 138, 145], kind: "water", relief: "water" },
  { id: "tundra_flat", color: [143, 158, 135], kind: "land", relief: "flat" },
  { id: "tundra_rough", color: [125, 140, 128], kind: "land", relief: "rough" },
  { id: "tundra_mountainous", color: [107, 112, 110], kind: "land", relief: "mountainous" },
  { id: "grassland_flat", color: [107, 158, 82], kind: "land", relief: "flat" },
  { id: "grassland_rough", color: [92, 133, 77], kind: "land", relief: "rough" },
  { id: "grassland_mountainous", color: [79, 110, 71], kind: "land", relief: "mountainous" },
  { id: "plains_flat", color: [168, 166, 97], kind: "land", relief: "flat" },
  { id: "plains_rough", color: [148, 138, 87], kind: "land", relief: "rough" },
  { id: "plains_mountainous", color: [128, 117, 82], kind: "land", relief: "mountainous" },
  { id: "desert_flat", color: [194, 161, 87], kind: "land", relief: "flat" },
  { id: "desert_rough", color: [168, 140, 87], kind: "land", relief: "rough" },
  { id: "desert_mountainous", color: [140, 115, 84], kind: "land", relief: "mountainous" },
  { id: "tropical_flat", color: [61, 148, 79], kind: "land", relief: "flat" },
  { id: "tropical_rough", color: [54, 120, 74], kind: "land", relief: "rough" },
  { id: "tropical_mountainous", color: [46, 94, 66], kind: "land", relief: "mountainous" },
  { id: "city", color: [138, 122, 107], kind: "built", relief: "rough" },
];

const TILE_SIZE = 128;
const COLUMNS = 5;
const ROWS = 4;
const WIDTH = TILE_SIZE * COLUMNS;
const HEIGHT = TILE_SIZE * ROWS;
const OUT_DIR = "apps/client/public/game-assets/hex-materials";

if (MATERIALS.length > COLUMNS * ROWS) {
  throw new Error(`Material atlas has ${COLUMNS * ROWS} slots for ${MATERIALS.length} materials.`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "hex-terrain-albedo.png"), encodePng(renderAtlas("albedo")));
writeFileSync(join(OUT_DIR, "hex-terrain-detail.png"), encodePng(renderAtlas("detail")));

function renderAtlas(kind) {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let index = 0; index < MATERIALS.length; index += 1) {
    const material = MATERIALS[index];
    const tileX = (index % COLUMNS) * TILE_SIZE;
    const tileY = Math.floor(index / COLUMNS) * TILE_SIZE;
    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const worldX = tileX + x;
        const worldY = tileY + y;
        const n1 = periodicNoise(material.id, x, y, 3);
        const n2 = periodicNoise(`${material.id}:fine`, x, y, 9);
        const n3 = periodicRidgeNoise(`${material.id}:ridge`, x, y);
        const ridge = ridgePattern(material, x, y) * terrainRidgeStrength(material);
        const grain = (n1 - 0.5) * baseNoiseStrength(material) + (n2 - 0.5) * fineNoiseStrength(material) + n3 * terrainRidgeStrength(material) + ridge;
        const channel = (worldY * WIDTH + worldX) * 4;
        if (kind === "detail") {
          const detailScale = material.relief === "mountainous" ? 230 : material.relief === "rough" ? 205 : 170;
          pixels[channel] = clampByte(128 + grain * detailScale);
          pixels[channel + 1] = clampByte(128 + (n2 - 0.5) * (material.relief === "flat" ? 70 : 105));
          pixels[channel + 2] = clampByte(128 + (n3 + Math.abs(ridge)) * (material.relief === "mountainous" ? 175 : 130));
          pixels[channel + 3] = 255;
        } else {
          const [r, g, b] = shadeColor(material.color, grain, material, x, y);
          pixels[channel] = r;
          pixels[channel + 1] = g;
          pixels[channel + 2] = b;
          pixels[channel + 3] = 255;
        }
      }
    }
  }
  return pixels;
}

function terrainRidgeStrength(material) {
  if (material.kind === "water") return 0.035;
  if (material.id === "city") return 0.13;
  if (material.relief === "mountainous") return 0.27;
  if (material.relief === "rough") return 0.15;
  return 0.055;
}

function baseNoiseStrength(material) {
  if (material.kind === "water") return 0.16;
  if (material.id === "city") return 0.18;
  if (material.relief === "mountainous") return 0.28;
  if (material.relief === "rough") return 0.24;
  return 0.16;
}

function fineNoiseStrength(material) {
  if (material.kind === "water") return 0.07;
  if (material.id === "city") return 0.1;
  if (material.relief === "mountainous") return 0.14;
  if (material.relief === "rough") return 0.11;
  return 0.055;
}

function ridgePattern(material, x, y) {
  if (material.kind === "water" || material.relief === "flat") return 0;
  const diagonalA = Math.sin(tileAngle(x + y * 0.45, material.relief === "mountainous" ? 5 : 3));
  const diagonalB = Math.cos(tileAngle(x * 0.35 - y, material.relief === "mountainous" ? 7 : 4));
  const angular = Math.abs(diagonalA * 0.65 + diagonalB * 0.35);
  const signedCrease = material.relief === "mountainous" ? Math.sign(diagonalA + diagonalB * 0.5) * angular : angular * 0.5;
  return signedCrease;
}

function shadeColor(color, grain, material, x, y) {
  const water = material.kind === "water";
  const wave = water
    ? Math.sin(tileAngle(x, 5) + tileAngle(y, 2)) * 0.045 + Math.sin(tileAngle(x, 9) - tileAngle(y, 4)) * 0.035
    : 0;
  const warmth = material.id.startsWith("desert") ? 0.04 : material.id.startsWith("tundra") ? -0.025 : material.id.startsWith("tropical") ? 0.015 : 0;
  const reliefDarken = material.relief === "mountainous" ? -0.06 : material.relief === "rough" ? -0.025 : 0;
  const shade = grain + wave + reliefDarken;
  return [
    clampByte(color[0] * (1 + shade + warmth)),
    clampByte(color[1] * (1 + shade * 0.9)),
    clampByte(color[2] * (1 + shade * (water ? 1.12 : 0.82) - warmth)),
  ];
}

function periodicNoise(seed, x, y, octaves) {
  let sum = 0;
  let weight = 0;
  for (let octave = 1; octave <= octaves; octave += 1) {
    const frequency = octave * (1 + Math.floor(hash(`${seed}:freq:${octave}`) * 3));
    const phaseX = hash(`${seed}:x:${octave}`) * Math.PI * 2;
    const phaseY = hash(`${seed}:y:${octave}`) * Math.PI * 2;
    const angleX = tileAngle(x, frequency) + phaseX;
    const angleY = tileAngle(y, frequency + 1) + phaseY;
    const value = Math.sin(angleX) * 0.5 + Math.cos(angleY) * 0.35 + Math.sin(angleX + angleY * 0.7) * 0.15;
    const octaveWeight = 1 / octave;
    sum += (value * 0.5 + 0.5) * octaveWeight;
    weight += octaveWeight;
  }
  return sum / weight;
}

function tileAngle(value, frequency) {
  return (value / (TILE_SIZE - 1)) * Math.PI * 2 * frequency;
}

function periodicRidgeNoise(seed, x, y) {
  return (1 - Math.abs(periodicNoise(seed, x, y, 5) * 2 - 1)) * 0.5;
}

function hash(input) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) / 4294967295;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function encodePng(rawRgba) {
  const scanlines = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    const scanline = y * (WIDTH * 4 + 1);
    scanlines[scanline] = 0;
    rawRgba.copy(scanlines, scanline + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", makeIhdr()),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIhdr() {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(WIDTH, 0);
  data.writeUInt32BE(HEIGHT, 4);
  data[8] = 8;
  data[9] = 6;
  return data;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
