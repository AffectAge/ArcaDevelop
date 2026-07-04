import type { HexAxial, HexDirection, HexId, HexMapSettings } from "./contracts/hex-map";

export const HEX_DIRECTIONS: ReadonlyArray<HexAxial> = [
  { q: 1, r: 0 },
  { q: 0, r: -1 },
  { q: -1, r: -1 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: 1, r: 1 },
];

const ODD_ROW_DIRECTION_OFFSETS: ReadonlyArray<ReadonlyArray<HexAxial>> = [
  [
    { q: 1, r: 0 },
    { q: 0, r: -1 },
    { q: -1, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ],
  [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: 1 },
  ],
];

export function makeHexId(q: number, r: number): HexId {
  return `hex:${q}:${r}`;
}

export function wrapQ(q: number, width: number): number {
  return ((q % width) + width) % width;
}

export function normalizeAxial(q: number, r: number, settings: Pick<HexMapSettings, "width" | "height" | "wrapX">): HexAxial | null {
  const nextQ = settings.wrapX ? wrapQ(q, settings.width) : q;
  if (nextQ < 0 || nextQ >= settings.width || r < 0 || r >= settings.height) {
    return null;
  }
  return { q: nextQ, r };
}

export function getNeighborAxial(hex: HexAxial, direction: HexDirection, settings: Pick<HexMapSettings, "width" | "height" | "wrapX">): HexAxial | null {
  const offset = ODD_ROW_DIRECTION_OFFSETS[Math.abs(hex.r) % 2]?.[direction];
  return normalizeAxial(hex.q + offset.q, hex.r + offset.r, settings);
}

export function axialDistance(a: HexAxial, b: HexAxial, width?: number): number {
  const direct = offsetDistance(a, b);
  if (!width || width <= 0) return direct;
  return Math.min(direct, offsetDistance({ q: a.q - width, r: a.r }, b), offsetDistance({ q: a.q + width, r: a.r }, b));
}

export function axialToPixel(hex: HexAxial, size: number): { x: number; y: number } {
  return {
    x: size * Math.sqrt(3) * (hex.q + (Math.abs(hex.r) % 2) * 0.5),
    y: size * 1.5 * hex.r,
  };
}

export function pixelToAxial(x: number, y: number, size: number, settings: Pick<HexMapSettings, "width" | "height" | "wrapX">): HexAxial | null {
  const estimatedR = Math.round(y / (size * 1.5));
  const estimatedQ = Math.round(x / (size * Math.sqrt(3)) - (Math.abs(estimatedR) % 2) * 0.5);
  let best: { hex: HexAxial; distance: number } | null = null;
  for (let r = estimatedR - 2; r <= estimatedR + 2; r += 1) {
    for (let q = estimatedQ - 2; q <= estimatedQ + 2; q += 1) {
      const normalized = normalizeAxial(q, r, settings);
      if (!normalized) continue;
      const center = axialToPixel(normalized, size);
      const distance = (center.x - x) ** 2 + (center.y - y) ** 2;
      if (!best || distance < best.distance) best = { hex: normalized, distance };
    }
  }
  return best?.hex ?? null;
}

export function hexCorner(center: { x: number; y: number }, size: number, index: number): { x: number; y: number } {
  const angle = ((60 * index - 30) * Math.PI) / 180;
  return {
    x: center.x + size * Math.cos(angle),
    y: center.y + size * Math.sin(angle),
  };
}

export function hexEdgeMidpoint(center: { x: number; y: number }, size: number, direction: HexDirection): { x: number; y: number } {
  const [cornerA, cornerB] = hexEdgeCornerIndices(direction);
  const a = hexCorner(center, size, cornerA);
  const b = hexCorner(center, size, cornerB);
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function hexEdgeCorners(center: { x: number; y: number }, size: number, direction: HexDirection): [{ x: number; y: number }, { x: number; y: number }] {
  const [cornerA, cornerB] = hexEdgeCornerIndices(direction);
  return [hexCorner(center, size, cornerA), hexCorner(center, size, cornerB)];
}

function hexEdgeCornerIndices(direction: HexDirection): [number, number] {
  const cornersByDirection: Record<HexDirection, [number, number]> = {
    0: [0, 1],
    1: [5, 0],
    2: [4, 5],
    3: [3, 4],
    4: [2, 3],
    5: [1, 2],
  };
  return cornersByDirection[direction];
}

export function worldPixelWidth(settings: Pick<HexMapSettings, "width" | "height" | "hexSize">): number {
  const horizontalRadius = (Math.sqrt(3) / 2) * settings.hexSize;
  const rows = [...new Set([0, Math.min(1, settings.height - 1), settings.height - 1])];
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    for (const q of [0, settings.width - 1]) {
      const center = axialToPixel({ q, r }, settings.hexSize);
      left = Math.min(left, center.x - horizontalRadius);
      right = Math.max(right, center.x + horizontalRadius);
    }
  }
  return right - left;
}

function offsetDistance(a: HexAxial, b: HexAxial): number {
  const ac = offsetToCube(a);
  const bc = offsetToCube(b);
  return (Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y) + Math.abs(ac.z - bc.z)) / 2;
}

function offsetToCube(hex: HexAxial): { x: number; y: number; z: number } {
  const x = hex.q - (hex.r - (Math.abs(hex.r) % 2)) / 2;
  const z = hex.r;
  return { x, y: -x - z, z };
}
