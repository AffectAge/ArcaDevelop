import { Container, Graphics, Text } from "pixi.js";
import type { HexChunkId, HexDirection, HexMapArtifact } from "@arcanorum/shared";
import { axialToPixel, getNeighborAxial, hexCorner, hexEdgeCorners, makeHexId, worldPixelWidth } from "./hexGeometry";
import type { HexCamera } from "./hexCamera";
import type { MapLensRenderCell } from "./mapLensTypes";

const MIN_LABEL_COMPONENT_CELLS = 3;

type LensChunk = {
  chunkId: HexChunkId;
  bounds: { left: number; right: number; top: number; bottom: number };
  cells: MapLensRenderCell[];
  primary: Container;
  wrapped: Container;
  primaryBase: Graphics;
  wrappedBase: Graphics;
};

type DrawnChunk = {
  container: Container;
  base: Graphics;
};

export type LensBoundaryEdge = {
  hexId: string;
  direction: HexDirection;
  color: number;
  alpha: number;
  tone: MapLensRenderCell["borderTone"];
};

export type CountryLabelSpec = {
  groupId: string;
  text: string;
  x: number;
  y: number;
  cells: number;
};

export type HexMapLensOverlayRenderer = {
  container: Container;
  updateLens: (cells: MapLensRenderCell[]) => void;
  updateVisibility: (camera: HexCamera, viewport: { width: number; height: number }) => number;
  destroy: () => void;
};

export function createHexMapLensOverlayRenderer(map: HexMapArtifact): HexMapLensOverlayRenderer {
  const container = new Container();
  const labelLayer = new Container();
  const wrappedLabelLayer = new Container();
  const wrapWidth = worldPixelWidth(map.settings);
  wrappedLabelLayer.position.x = wrapWidth;
  container.addChild(labelLayer, wrappedLabelLayer);
  let chunks: LensChunk[] = [];
  let destroyed = false;

  function updateLens(cells: MapLensRenderCell[]): void {
    for (const chunk of chunks) {
      container.removeChild(chunk.primary);
      container.removeChild(chunk.wrapped);
      safeDestroyContainer(chunk.primary);
      safeDestroyContainer(chunk.wrapped);
    }
    clearLabels(labelLayer);
    clearLabels(wrappedLabelLayer);
    const cellById = new Map(cells.map((cell) => [cell.tile.id, cell]));
    chunks = buildLensChunks(map, cells).map((chunk) => {
      const primary = drawChunk(chunk.cells, cellById, map);
      const wrapped = drawChunk(chunk.cells, cellById, map);
      wrapped.container.position.x = wrapWidth;
      container.addChild(primary.container, wrapped.container);
      return { ...chunk, primary: primary.container, wrapped: wrapped.container, primaryBase: primary.base, wrappedBase: wrapped.base };
    });
    drawCountryLabels(labelLayer, buildCountryLabelSpecs(cells, map), map);
    drawCountryLabels(wrappedLabelLayer, buildCountryLabelSpecs(cells, map), map);
    container.addChild(labelLayer, wrappedLabelLayer);
  }

  function updateVisibility(camera: HexCamera, viewport: { width: number; height: number }): number {
    let visible = 0;
    const halfWidth = viewport.width / Math.max(0.001, camera.scale) / 2;
    const halfHeight = viewport.height / Math.max(0.001, camera.scale) / 2;
    const view = {
      left: camera.x - halfWidth,
      right: camera.x + halfWidth,
      top: camera.y - halfHeight,
      bottom: camera.y + halfHeight,
    };
    const terrainBaseAlpha = resolveLensTerrainBaseAlpha(camera.scale);
    const labelAlpha = resolveLensLabelAlpha(camera.scale);
    labelLayer.alpha = labelAlpha;
    wrappedLabelLayer.alpha = labelAlpha;
    for (const chunk of chunks) {
      const primaryVisible = intersects(chunk.bounds, view);
      const wrappedBounds = {
        left: chunk.bounds.left + wrapWidth,
        right: chunk.bounds.right + wrapWidth,
        top: chunk.bounds.top,
        bottom: chunk.bounds.bottom,
      };
      const wrappedVisible = intersects(wrappedBounds, view);
      chunk.primary.visible = primaryVisible;
      chunk.wrapped.visible = wrappedVisible;
      chunk.primaryBase.alpha = terrainBaseAlpha;
      chunk.wrappedBase.alpha = terrainBaseAlpha;
      visible += primaryVisible ? 1 : 0;
      visible += wrappedVisible ? 1 : 0;
    }
    return visible;
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    for (const chunk of chunks) {
      safeDestroyContainer(chunk.primary);
      safeDestroyContainer(chunk.wrapped);
    }
    chunks = [];
    safeDestroyContainer(labelLayer);
    safeDestroyContainer(wrappedLabelLayer);
    container.destroy({ children: false });
  }

  return { container, updateLens, updateVisibility, destroy };
}

export function resolveLensTerrainBaseAlpha(scale: number): number {
  if (scale <= 0.42) return 1;
  if (scale >= 1.18) return 0.22;
  const t = (scale - 0.42) / (1.18 - 0.42);
  return 1 - t * 0.78;
}

function resolveLensLabelAlpha(scale: number): number {
  if (scale <= 0.24) return 0;
  if (scale >= 0.42) return 0.88;
  return ((scale - 0.24) / (0.42 - 0.24)) * 0.88;
}

function buildLensChunks(map: HexMapArtifact, cells: MapLensRenderCell[]): Array<Omit<LensChunk, "primary" | "wrapped" | "primaryBase" | "wrappedBase">> {
  const drafts = new Map<HexChunkId, { cells: MapLensRenderCell[]; bounds: LensChunk["bounds"] }>();
  for (const cell of cells) {
    const draft = drafts.get(cell.tile.chunkId) ?? {
      cells: [],
      bounds: { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, top: Number.POSITIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY },
    };
    draft.cells.push(cell);
    const center = axialToPixel(cell.tile, map.settings.hexSize);
    expandBounds(draft.bounds, center.x, center.y, map.settings.hexSize * 1.25);
    drafts.set(cell.tile.chunkId, draft);
  }
  return [...drafts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([chunkId, draft]) => ({ chunkId, cells: draft.cells, bounds: draft.bounds }));
}

function drawChunk(cells: MapLensRenderCell[], cellById: Map<string, MapLensRenderCell>, map: HexMapArtifact): DrawnChunk {
  const chunk = new Container();
  const base = new Graphics();
  const detail = new Graphics();
  const size = map.settings.hexSize;
  for (const cell of cells) {
    const center = axialToPixel(cell.tile, size);
    const points = Array.from({ length: 6 }, (_, index) => hexCorner(center, size + 0.45, index)).flatMap((point) => [point.x, point.y]);
    if (cell.terrainMute > 0) {
      base.poly(points, true).fill({ color: cell.tile.waterKind ? 0x10313d : 0x2f2a24, alpha: cell.terrainMute });
    }
    if (cell.surfaceAlpha > 0) {
      base.poly(points, true).fill({ color: cell.tile.waterKind ? 0x315d6c : 0xf1dfb8, alpha: cell.surfaceAlpha });
    }
    detail.poly(points, true).fill({ color: cell.color, alpha: cell.alpha });
    if (cell.pattern === "hatch" || cell.hatch) {
      drawHatch(detail, center.x, center.y, size, 0x2a2430, 0.28);
    } else if (cell.pattern === "stripe") {
      drawHatch(detail, center.x, center.y, size, cell.borderColor ?? 0xf4e2a7, 0.34);
    }
    if (cell.pulse) {
      detail.circle(center.x, center.y, size * 0.28).stroke({ color: 0xf5e38d, alpha: 0.42, width: 1.4 });
    }
  }
  drawBoundaries(detail, cells, cellById, map);
  chunk.addChild(base, detail);
  return { container: chunk, base };
}

function drawCountryLabels(layer: Container, labels: CountryLabelSpec[], map: HexMapArtifact): void {
  for (const spec of labels) {
    const fontSize = clampNumber(Math.sqrt(spec.cells) * map.settings.hexSize * 0.38, 16, 36);
    const label = new Text({
      text: spec.text,
      style: {
        fill: 0xffffff,
        fontFamily: "Georgia, Times New Roman, serif",
        fontSize,
        fontWeight: "700",
        letterSpacing: 1.2,
        stroke: { color: 0x202128, width: Math.max(3, fontSize * 0.14) },
        dropShadow: {
          color: 0x000000,
          alpha: 0.42,
          blur: 3,
          distance: 2,
          angle: Math.PI / 2,
        },
      },
    });
    label.anchor.set(0.5);
    label.position.set(spec.x, spec.y);
    label.alpha = 0.92;
    layer.addChild(label);
  }
}

export function buildCountryLabelSpecs(cells: MapLensRenderCell[], map: HexMapArtifact): CountryLabelSpec[] {
  const labelCells = cells.filter((cell) => cell.labelGroupId && cell.label && !cell.tile.waterKind);
  if (labelCells.length === 0) return [];
  const labelCellById = new Map(labelCells.map((cell) => [cell.tile.id, cell]));
  const byGroup = new Map<string, MapLensRenderCell[]>();
  for (const cell of labelCells) {
    const groupId = cell.labelGroupId;
    if (!groupId) continue;
    const group = byGroup.get(groupId) ?? [];
    group.push(cell);
    byGroup.set(groupId, group);
  }

  const labels: CountryLabelSpec[] = [];
  for (const [groupId, groupCells] of byGroup.entries()) {
    const largest = findLargestLabelComponent(groupCells, labelCellById, groupId, map);
    if (largest.length < MIN_LABEL_COMPONENT_CELLS) continue;
    const bounds = largest.reduce(
      (draft, cell) => {
        const center = axialToPixel(cell.tile, map.settings.hexSize);
        draft.left = Math.min(draft.left, center.x);
        draft.right = Math.max(draft.right, center.x);
        draft.top = Math.min(draft.top, center.y);
        draft.bottom = Math.max(draft.bottom, center.y);
        return draft;
      },
      { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, top: Number.POSITIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY },
    );
    labels.push({
      groupId,
      text: largest[0]?.label ?? groupId,
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2,
      cells: largest.length,
    });
  }
  return labels.sort((left, right) => right.cells - left.cells || left.groupId.localeCompare(right.groupId));
}

function findLargestLabelComponent(
  cells: MapLensRenderCell[],
  labelCellById: Map<string, MapLensRenderCell>,
  groupId: string,
  map: HexMapArtifact,
): MapLensRenderCell[] {
  const unvisited = new Set(cells.map((cell) => cell.tile.id));
  let largest: MapLensRenderCell[] = [];
  for (const start of cells) {
    if (!unvisited.has(start.tile.id)) continue;
    const component: MapLensRenderCell[] = [];
    const queue = [start];
    unvisited.delete(start.tile.id);
    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index];
      component.push(cell);
      for (let direction = 0 as HexDirection; direction < 6; direction = (direction + 1) as HexDirection) {
        const neighborAxial = getNeighborAxial(cell.tile, direction, map.settings);
        const neighbor = neighborAxial ? labelCellById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
        if (!neighbor || neighbor.labelGroupId !== groupId || !unvisited.has(neighbor.tile.id)) continue;
        unvisited.delete(neighbor.tile.id);
        queue.push(neighbor);
      }
    }
    if (component.length > largest.length) {
      largest = component;
    }
  }
  return largest;
}

function drawBoundaries(graphics: Graphics, cells: MapLensRenderCell[], cellById: Map<string, MapLensRenderCell>, map: HexMapArtifact): void {
  for (const edge of collectLensBoundaryEdges(cells, cellById, map)) {
    const cell = cellById.get(edge.hexId);
    if (!cell) continue;
    const center = axialToPixel(cell.tile, map.settings.hexSize);
    const [start, end] = hexEdgeCorners(center, map.settings.hexSize + 0.8, edge.direction);
    if (edge.tone === "dotted") {
      drawDottedEdge(graphics, start, end, edge.color, edge.alpha, 1.35);
    } else {
      graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color: edge.color, alpha: edge.alpha, width: edge.tone === "strong" ? 2.8 : 1.8 });
      if (edge.tone === "strong") {
        graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color: 0x1b1820, alpha: Math.min(0.28, edge.alpha), width: 4.6 });
        graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color: edge.color, alpha: edge.alpha, width: 2.3 });
      }
    }
  }
}

export function collectLensBoundaryEdges(cells: MapLensRenderCell[], cellById: Map<string, MapLensRenderCell>, map: HexMapArtifact): LensBoundaryEdge[] {
  const edges: LensBoundaryEdge[] = [];
  for (const cell of cells) {
    for (let direction = 0 as HexDirection; direction < 6; direction = (direction + 1) as HexDirection) {
      const neighborAxial = getNeighborAxial(cell.tile, direction, map.settings);
      const neighbor = neighborAxial ? cellById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
      if (neighbor && direction > 2) continue;
      if (neighbor && neighbor.borderGroupId === cell.borderGroupId) continue;
      edges.push({
        hexId: cell.tile.id,
        direction,
        color: cell.borderColor ?? 0xe6d7b8,
        alpha: cell.borderAlpha ?? 0.58,
        tone: cell.borderTone ?? "soft",
      });
    }
  }
  return edges;
}

function drawDottedEdge(graphics: Graphics, start: { x: number; y: number }, end: { x: number; y: number }, color: number, alpha: number, width: number): void {
  const segments = 6;
  for (let index = 0; index < segments; index += 2) {
    const a = index / segments;
    const b = (index + 1) / segments;
    graphics
      .moveTo(start.x + (end.x - start.x) * a, start.y + (end.y - start.y) * a)
      .lineTo(start.x + (end.x - start.x) * b, start.y + (end.y - start.y) * b)
      .stroke({ color, alpha, width });
  }
}

function drawHatch(graphics: Graphics, x: number, y: number, size: number, color: number, alpha: number): void {
  const left = x - size * 0.52;
  const right = x + size * 0.52;
  for (let index = -2; index <= 2; index += 1) {
    const offset = index * size * 0.22;
    graphics.moveTo(left, y + offset + size * 0.2).lineTo(right, y + offset - size * 0.2).stroke({ color, alpha, width: 1 });
  }
}

function expandBounds(bounds: LensChunk["bounds"], x: number, y: number, padding: number): void {
  bounds.left = Math.min(bounds.left, x - padding);
  bounds.right = Math.max(bounds.right, x + padding);
  bounds.top = Math.min(bounds.top, y - padding);
  bounds.bottom = Math.max(bounds.bottom, y + padding);
}

function intersects(a: LensChunk["bounds"], b: LensChunk["bounds"]): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clearLabels(layer: Container): void {
  for (const child of layer.removeChildren()) {
    child.destroy();
  }
}

function safeDestroyContainer(chunk: Container): void {
  try {
    chunk.destroy({ children: true });
  } catch {
    // Pixi cleanup is idempotent during React route teardown.
  }
}
