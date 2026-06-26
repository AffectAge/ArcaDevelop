import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const OUT_DIR = "apps/client/public/game-assets/hex-materials";
const TILE_SIZE = 128;
const DIRECTIONS = [
  [0.8660254038, 0],
  [0.4330127019, -0.75],
  [-0.4330127019, -0.75],
  [-0.8660254038, 0],
  [-0.4330127019, 0.75],
  [0.4330127019, 0.75],
];

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "hex-coast-masks.png"), encodePng(renderCoastMasks(), TILE_SIZE * 16, TILE_SIZE * 16));
writeFileSync(join(OUT_DIR, "hex-biome-transition-masks.png"), encodePng(renderBiomeTransitionMasks(), TILE_SIZE * 8, TILE_SIZE * 6));
writeFileSync(join(OUT_DIR, "hex-river-shape-masks.png"), encodePng(renderRiverMasks(), TILE_SIZE * 16, TILE_SIZE * 16));
writeFileSync(join(OUT_DIR, "hex-coast-mask-template.png"), encodePng(renderCoastMaskTemplate(), TILE_SIZE * 16, TILE_SIZE * 16));
writeFileSync(join(OUT_DIR, "hex-biome-transition-mask-template.png"), encodePng(renderBiomeTransitionMaskTemplate(), TILE_SIZE * 8, TILE_SIZE * 6));
writeFileSync(join(OUT_DIR, "hex-river-shape-mask-template.png"), encodePng(renderRiverMaskTemplate(), TILE_SIZE * 16, TILE_SIZE * 16));

function renderCoastMasks() {
  return renderAtlas(16, 16, (tileIndex, x, y) => {
    const rawMask = Math.floor(tileIndex / 4);
    const variant = tileIndex % 4;
    if (rawMask <= 0) return 0;
    const p = localPoint(x, y);
    let amount = 0;
    for (let direction = 0; direction < 6; direction += 1) {
      if ((rawMask & (1 << direction)) === 0) continue;
      const edge = dot(p, DIRECTIONS[direction]);
      const n = coastlineNoise(p, rawMask, variant, direction);
      const threshold = 0.52 + n * 0.07 + variant * 0.012;
      amount = Math.max(amount, smoothstep(threshold, threshold + 0.2, edge));
    }
    return amount;
  });
}

function renderBiomeTransitionMasks() {
  return renderAtlas(8, 6, (tileIndex, x, y) => {
    const direction = Math.floor(tileIndex / 8);
    const variant = tileIndex % 8;
    const p = localPoint(x, y);
    const edge = dot(p, DIRECTIONS[direction]);
    const n = coastlineNoise(p, direction + 11, variant, direction);
    const threshold = 0.61 + n * 0.08 + (variant % 3) * 0.012;
    return smoothstep(threshold, threshold + 0.12, edge);
  });
}

function renderRiverMasks() {
  return renderAtlas(16, 16, (tileIndex, x, y) => {
    const rawMask = Math.floor(tileIndex / 4);
    const variant = tileIndex % 4;
    if (rawMask <= 0) return 0;
    const p = localPoint(x, y);
    const directions = [];
    for (let direction = 0; direction < 6; direction += 1) {
      if ((rawMask & (1 << direction)) !== 0) directions.push(direction);
    }
    const baseWidth = 0.076 + variant * 0.007 + Math.min(0.048, directions.length * 0.01);
    const edgeSoftness = 0.022;
    let coverage = 0;
    for (const direction of directions) {
      const distance = riverCurveDistance(p, rawMask, variant, direction);
      const bankNoise =
        (valueNoise(p.x * 9.0 + rawMask * 0.41 + direction, p.y * 8.4 + variant) - 0.5) * 0.018 +
        (valueNoise(p.x * 23.0 + variant, p.y * 19.0 + rawMask + direction) - 0.5) * 0.008;
      const width = baseWidth + bankNoise;
      const core = 1 - smoothstep(width, width + edgeSoftness, distance);
      coverage = Math.max(coverage, core);
    }
    const junctionRadius = baseWidth * (directions.length <= 1 ? 1.05 : 1.95 + directions.length * 0.16);
    const junction = 1 - smoothstep(junctionRadius, junctionRadius + edgeSoftness, length(p));
    const mouths = directions.reduce((amount, direction) => {
      const edgePoint = { x: DIRECTIONS[direction][0] * 0.91, y: DIRECTIONS[direction][1] * 0.91 };
      const radius = baseWidth * (1.25 + variant * 0.06);
      return Math.max(amount, 1 - smoothstep(radius, radius + edgeSoftness, length({ x: p.x - edgePoint.x, y: p.y - edgePoint.y })));
    }, 0);
    const water = Math.max(coverage, junction * (directions.length > 1 ? 1 : 0.82), mouths * 0.96);
    return water < 0.035 ? 0 : water;
  });
}

function renderRiverMaskTemplate() {
  return renderDirectionalTemplateAtlas(16, 16, (tileIndex) => Math.floor(tileIndex / 4), {
    activeLineAlpha: 230,
    inactiveLineAlpha: 34,
    activeLineThickness: 1.65,
    inactiveLineThickness: 0.75,
    edgeMarkers: true,
  });
}

function renderCoastMaskTemplate() {
  return renderDirectionalTemplateAtlas(16, 16, (tileIndex) => Math.floor(tileIndex / 4), {
    activeLineAlpha: 220,
    inactiveLineAlpha: 28,
    activeLineThickness: 1.45,
    inactiveLineThickness: 0.65,
    edgeMarkers: true,
  });
}

function renderBiomeTransitionMaskTemplate() {
  return renderDirectionalTemplateAtlas(8, 6, (tileIndex) => 1 << Math.floor(tileIndex / 8), {
    activeLineAlpha: 230,
    inactiveLineAlpha: 24,
    activeLineThickness: 1.55,
    inactiveLineThickness: 0.6,
    edgeMarkers: false,
  });
}

function renderDirectionalTemplateAtlas(columns, rows, resolveRawMask, style) {
  const width = columns * TILE_SIZE;
  const height = rows * TILE_SIZE;
  const pixels = Buffer.alloc(width * height * 4);
  for (let tileIndex = 0; tileIndex < columns * rows; tileIndex += 1) {
    const rawMask = resolveRawMask(tileIndex);
    const tileX = (tileIndex % columns) * TILE_SIZE;
    const tileY = Math.floor(tileIndex / columns) * TILE_SIZE;
    drawTemplateTile(pixels, width, tileX, tileY, rawMask, style);
  }
  return pixels;
}

function drawTemplateTile(pixels, atlasWidth, tileX, tileY, rawMask, style) {
  const center = { x: tileX + TILE_SIZE / 2, y: tileY + TILE_SIZE / 2 };
  const radius = TILE_SIZE * 0.43;
  const corners = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    corners.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
  }
  for (let index = 0; index < 6; index += 1) {
    drawLine(pixels, atlasWidth, corners[index], corners[(index + 1) % 6], [255, 255, 255, 112], 1.2);
  }
  drawCircle(pixels, atlasWidth, center, 2.2, [255, 255, 255, 180]);
  for (let direction = 0; direction < 6; direction += 1) {
    const endpoint = {
      x: center.x + DIRECTIONS[direction][0] * radius * 0.92,
      y: center.y + DIRECTIONS[direction][1] * radius * 0.92,
    };
    const active = (rawMask & (1 << direction)) !== 0;
    drawLine(
      pixels,
      atlasWidth,
      center,
      endpoint,
      active ? [255, 255, 255, style.activeLineAlpha] : [255, 255, 255, style.inactiveLineAlpha],
      active ? style.activeLineThickness : style.inactiveLineThickness,
    );
    if (active && style.edgeMarkers) drawCircle(pixels, atlasWidth, endpoint, 2, [255, 255, 255, 190]);
  }
}

function drawLine(pixels, width, a, b, color, thickness) {
  const minX = Math.floor(Math.min(a.x, b.x) - thickness - 1);
  const maxX = Math.ceil(Math.max(a.x, b.x) + thickness + 1);
  const minY = Math.floor(Math.min(a.y, b.y) - thickness - 1);
  const maxY = Math.ceil(Math.max(a.y, b.y) + thickness + 1);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = segmentDistance({ x: x + 0.5, y: y + 0.5 }, a, b);
      const alpha = color[3] * (1 - smoothstep(thickness, thickness + 1, distance));
      if (alpha > 0) blendPixel(pixels, width, x, y, [color[0], color[1], color[2], alpha]);
    }
  }
}

function drawCircle(pixels, width, center, radius, color) {
  const minX = Math.floor(center.x - radius - 1);
  const maxX = Math.ceil(center.x + radius + 1);
  const minY = Math.floor(center.y - radius - 1);
  const maxY = Math.ceil(center.y + radius + 1);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = length({ x: x + 0.5 - center.x, y: y + 0.5 - center.y });
      const alpha = color[3] * (1 - smoothstep(radius, radius + 1, distance));
      if (alpha > 0) blendPixel(pixels, width, x, y, [color[0], color[1], color[2], alpha]);
    }
  }
}

function blendPixel(pixels, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= pixels.length / width / 4) return;
  const channel = (y * width + x) * 4;
  const sourceAlpha = Math.max(0, Math.min(255, color[3])) / 255;
  const targetAlpha = pixels[channel + 3] / 255;
  const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) return;
  pixels[channel] = clampByte((color[0] * sourceAlpha + pixels[channel] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  pixels[channel + 1] = clampByte((color[1] * sourceAlpha + pixels[channel + 1] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  pixels[channel + 2] = clampByte((color[2] * sourceAlpha + pixels[channel + 2] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  pixels[channel + 3] = clampByte(outAlpha * 255);
}

function renderAtlas(columns, rows, sample) {
  const width = columns * TILE_SIZE;
  const height = rows * TILE_SIZE;
  const pixels = Buffer.alloc(width * height * 4);
  for (let tileIndex = 0; tileIndex < columns * rows; tileIndex += 1) {
    const tileX = (tileIndex % columns) * TILE_SIZE;
    const tileY = Math.floor(tileIndex / columns) * TILE_SIZE;
    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const value = clampByte(sample(tileIndex, x, y) * 255);
        const channel = ((tileY + y) * width + tileX + x) * 4;
        pixels[channel] = value;
        pixels[channel + 1] = value;
        pixels[channel + 2] = value;
        pixels[channel + 3] = 255;
      }
    }
  }
  return pixels;
}

function localPoint(x, y) {
  return {
    x: (x + 0.5) / TILE_SIZE * 2 - 1,
    y: (y + 0.5) / TILE_SIZE * 2 - 1,
  };
}

function coastlineNoise(p, rawMask, variant, direction) {
  const ridge = valueNoise(p.x * (3.2 + variant), p.y * (4.4 + direction) + rawMask);
  const fine = valueNoise(p.x * 9.1 + direction, p.y * 7.7 + variant);
  return (ridge - 0.5) * 0.85 + (fine - 0.5) * 0.28;
}

function valueNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(`${ix}:${iy}`);
  const b = hash(`${ix + 1}:${iy}`);
  const c = hash(`${ix}:${iy + 1}`);
  const d = hash(`${ix + 1}:${iy + 1}`);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

function riverCurveDistance(p, rawMask, variant, direction) {
  const end = {
    x: DIRECTIONS[direction][0] * 0.98,
    y: DIRECTIONS[direction][1] * 0.98,
  };
  const controlA = riverBendPoint(rawMask, variant, direction, 0.28);
  const controlB = riverBendPoint(rawMask, variant + 7, direction, 0.68);
  let distance = Number.POSITIVE_INFINITY;
  let previous = { x: 0, y: 0 };
  for (let step = 1; step <= 18; step += 1) {
    const t = step / 18;
    const point = cubicBezier({ x: 0, y: 0 }, controlA, controlB, end, t);
    distance = Math.min(distance, segmentDistance(p, previous, point));
    previous = point;
  }
  return distance;
}

function segmentDistance(p, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const t = Math.max(0, Math.min(1, dot(ap, [ab.x, ab.y]) / Math.max(0.0001, dot(ab, [ab.x, ab.y]))));
  return length({ x: p.x - (a.x + ab.x * t), y: p.y - (a.y + ab.y * t) });
}

function riverBendPoint(rawMask, variant, direction, forwardBase) {
  const normal = [-DIRECTIONS[direction][1], DIRECTIONS[direction][0]];
  const side = hash(`${rawMask}:${variant}:${direction}:side`) > 0.5 ? 1 : -1;
  const bendAmount = (0.045 + hash(`${rawMask}:${variant}:${direction}:bend`) * 0.115) * side;
  const forward = forwardBase + (hash(`${rawMask}:${variant}:${direction}:forward`) - 0.5) * 0.13;
  return {
    x: DIRECTIONS[direction][0] * forward + normal[0] * bendAmount,
    y: DIRECTIONS[direction][1] * forward + normal[1] * bendAmount,
  };
}

function cubicBezier(a, b, c, d, t) {
  const mt = 1 - t;
  return {
    x: a.x * mt * mt * mt + b.x * 3 * mt * mt * t + c.x * 3 * mt * t * t + d.x * t * t * t,
    y: a.y * mt * mt * mt + b.y * 3 * mt * mt * t + c.y * 3 * mt * t * t + d.y * t * t * t,
  };
}

function dot(p, direction) {
  return p.x * direction[0] + p.y * direction[1];
}

function length(p) {
  return Math.sqrt(p.x * p.x + p.y * p.y);
}

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
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

function encodePng(rawRgba, width, height) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const scanline = y * (width * 4 + 1);
    scanlines[scanline] = 0;
    rawRgba.copy(scanlines, scanline + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", makeIhdr(width, height)),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIhdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
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
