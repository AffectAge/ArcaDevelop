import type { HexAxial, HexDirection, HexId, HexMapSettings } from "./contracts/hex-map";

export const HEX_DIRECTIONS: ReadonlyArray<HexAxial> = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
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
  const offset = HEX_DIRECTIONS[direction];
  return normalizeAxial(hex.q + offset.q, hex.r + offset.r, settings);
}

export function axialDistance(a: HexAxial, b: HexAxial, width?: number): number {
  let dq = a.q - b.q;
  if (width && width > 0) {
    if (Math.abs(dq) > width / 2) {
      dq = dq > 0 ? dq - width : dq + width;
    }
  }
  const dr = a.r - b.r;
  const ds = -dq - dr;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

export function axialToPixel(hex: HexAxial, size: number): { x: number; y: number } {
  return {
    x: size * Math.sqrt(3) * (hex.q + hex.r / 2),
    y: size * 1.5 * hex.r,
  };
}

export function pixelToAxial(x: number, y: number, size: number, settings: Pick<HexMapSettings, "width" | "height" | "wrapX">): HexAxial | null {
  const qFloat = ((Math.sqrt(3) / 3) * x - y / 3) / size;
  const rFloat = ((2 / 3) * y) / size;
  return normalizeAxial(Math.round(cubeRound(qFloat, rFloat).q), Math.round(cubeRound(qFloat, rFloat).r), settings);
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
  const left = axialToPixel({ q: 0, r: settings.height - 1 }, settings.hexSize).x - settings.hexSize;
  const right = axialToPixel({ q: settings.width - 1, r: 0 }, settings.hexSize).x + settings.hexSize;
  return right - left;
}

function cubeRound(qFloat: number, rFloat: number): HexAxial {
  let q = Math.round(qFloat);
  let r = Math.round(rFloat);
  let s = Math.round(-qFloat - rFloat);

  const qDiff = Math.abs(q - qFloat);
  const rDiff = Math.abs(r - rFloat);
  const sDiff = Math.abs(s + qFloat + rFloat);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  } else {
    s = -q - r;
  }

  void s;
  return { q, r };
}
