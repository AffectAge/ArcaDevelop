import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

const MATERIALS = [
  ["deep_water", [23, 69, 92]],
  ["coastal_water", [46, 122, 133]],
  ["fresh_water", [64, 138, 145]],
  ["grass", [107, 158, 82]],
  ["plains", [168, 166, 97]],
  ["forest", [64, 110, 61]],
  ["hills", [138, 128, 87]],
  ["rock", [115, 110, 102]],
  ["sand", [194, 161, 87]],
  ["tundra", [143, 158, 135]],
  ["snow", [209, 222, 214]],
  ["wetland", [87, 125, 99]],
];

const TILE_SIZE = 128;
const COLUMNS = 4;
const ROWS = 3;
const WIDTH = TILE_SIZE * COLUMNS;
const HEIGHT = TILE_SIZE * ROWS;
const OUT_DIR = "apps/client/public/game-assets/hex-materials";

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "hex-terrain-albedo.png"), encodePng(renderAtlas("albedo")));
writeFileSync(join(OUT_DIR, "hex-terrain-detail.png"), encodePng(renderAtlas("detail")));

function renderAtlas(kind) {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let index = 0; index < MATERIALS.length; index += 1) {
    const [id, color] = MATERIALS[index];
    const tileX = (index % COLUMNS) * TILE_SIZE;
    const tileY = Math.floor(index / COLUMNS) * TILE_SIZE;
    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const worldX = tileX + x;
        const worldY = tileY + y;
        const n1 = periodicNoise(id, x, y, 3);
        const n2 = periodicNoise(`${id}:fine`, x, y, 9);
        const n3 = periodicRidgeNoise(`${id}:ridge`, x, y);
        const grain = (n1 - 0.5) * 0.22 + (n2 - 0.5) * 0.08 + n3 * terrainRidgeStrength(id);
        const channel = (worldY * WIDTH + worldX) * 4;
        if (kind === "detail") {
          const detail = clampByte(128 + grain * 190);
          pixels[channel] = detail;
          pixels[channel + 1] = clampByte(128 + (n2 - 0.5) * 95);
          pixels[channel + 2] = clampByte(128 + n3 * 140);
          pixels[channel + 3] = 255;
        } else {
          const [r, g, b] = shadeColor(color, grain, id, x, y);
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

function terrainRidgeStrength(id) {
  if (id === "deep_water" || id === "coastal_water" || id === "fresh_water") return 0.035;
  if (id === "rock" || id === "hills") return 0.16;
  if (id === "sand" || id === "snow") return 0.08;
  return 0.1;
}

function shadeColor(color, grain, id, x, y) {
  const water = id.includes("water");
  const wave = water
    ? Math.sin(tileAngle(x, 5) + tileAngle(y, 2)) * 0.045 + Math.sin(tileAngle(x, 9) - tileAngle(y, 4)) * 0.035
    : 0;
  const warmth = id === "sand" ? 0.04 : id === "snow" ? -0.025 : 0;
  const shade = grain + wave;
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
