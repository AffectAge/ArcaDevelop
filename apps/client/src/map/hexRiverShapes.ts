import type { HexDirection, HexId, HexMapArtifact } from "@arcanorum/shared";
import { getNeighborAxial, makeHexId } from "./hexGeometry";

export type HexRiverShapeKind = "end" | "straight" | "bend" | "fork_3" | "junction_4" | "junction_5" | "junction_6";

export type HexRiverShape = {
  hexId: HexId;
  mask: number;
  kind: HexRiverShapeKind;
  rotation: number;
  variant: number;
  width: number;
};

export const RIVER_SHAPE_ATLAS_COLUMNS = 64;
export const RIVER_SHAPE_ATLAS_ROWS = 1;
export const RIVER_SHAPE_TILE_SIZE = 128;
export const RIVER_SHAPE_ATLAS_URL = "/game-assets/hex-materials/hex-river-shapes.png";

export const RIVER_SHAPE_ATLAS_COLUMN_BY_KIND: Record<HexRiverShapeKind, number> = {
  end: 0,
  straight: 1,
  bend: 2,
  fork_3: 3,
  junction_4: 4,
  junction_5: 5,
  junction_6: 6,
};

export function collectHexRiverShapes(map: HexMapArtifact): HexRiverShape[] {
  const drafts = new Map<HexId, { mask: number; width: number }>();
  const tileById = new Map(map.tiles.map((tile) => [tile.id, tile]));
  const tileIds = new Set(tileById.keys());

  for (const river of map.riverEdges) {
    const source = drafts.get(river.hexId) ?? { mask: 0, width: 0 };
    source.mask |= directionBit(river.direction);
    source.width = Math.max(source.width, river.width);
    drafts.set(river.hexId, source);

    const sourceTile = tileById.get(river.hexId);
    const neighborAxial = sourceTile ? getNeighborAxial(sourceTile, river.direction, map.settings) : null;
    const neighborId = neighborAxial ? makeHexId(neighborAxial.q, neighborAxial.r) : null;
    if (!neighborId || !tileIds.has(neighborId)) continue;

    const target = drafts.get(neighborId) ?? { mask: 0, width: 0 };
    target.mask |= directionBit(oppositeDirection(river.direction));
    target.width = Math.max(target.width, river.width);
    drafts.set(neighborId, target);
  }

  return Array.from(drafts.entries())
    .map(([hexId, draft]) => {
      const classification = classifyRiverMask(draft.mask);
      return {
        hexId,
        mask: draft.mask,
        kind: classification.kind,
        rotation: classification.rotation,
        variant: selectRiverShapeVariant(hexId, draft.mask, classification.kind),
        width: draft.width,
      };
    })
    .sort((a, b) => a.hexId.localeCompare(b.hexId));
}

export function classifyRiverMask(mask: number): Pick<HexRiverShape, "kind" | "rotation"> {
  const directions = directionsFromMask(mask);
  if (directions.length <= 1) {
    return { kind: "end", rotation: directions[0] ?? 0 };
  }
  if (directions.length === 2) {
    const [first, second] = directions;
    if (oppositeDirection(first) === second) {
      return { kind: "straight", rotation: first % 3 };
    }
    return { kind: "bend", rotation: selectAdjacentRotation(first, second) };
  }
  if (directions.length === 3) {
    return { kind: "fork_3", rotation: selectForkRotation(directions) };
  }
  if (directions.length === 4) {
    return { kind: "junction_4", rotation: selectGapRotation(directions) };
  }
  if (directions.length === 5) {
    return { kind: "junction_5", rotation: selectGapRotation(directions) };
  }
  return { kind: "junction_6", rotation: 0 };
}

export function selectRiverShapeVariant(hexId: HexId, mask: number, kind: HexRiverShapeKind): number {
  void hexId;
  void mask;
  void kind;
  return 0;
}

export function resolveRiverShapeAtlasColumn(mask: number): number {
  return mask & 0b111111;
}

export function resolveRiverShapeSpriteRotation(rotation: number): number {
  void rotation;
  return 0;
}

function directionsFromMask(mask: number): HexDirection[] {
  const directions: HexDirection[] = [];
  for (let direction = 0; direction < 6; direction += 1) {
    if ((mask & directionBit(direction as HexDirection)) !== 0) directions.push(direction as HexDirection);
  }
  return directions;
}

function directionBit(direction: HexDirection): number {
  return 1 << direction;
}

function oppositeDirection(direction: HexDirection): HexDirection {
  return ((direction + 3) % 6) as HexDirection;
}

function selectAdjacentRotation(first: HexDirection, second: HexDirection): number {
  const previous = ((first + 5) % 6) as HexDirection;
  const next = ((first + 1) % 6) as HexDirection;
  return second === next ? first : previous;
}

function selectForkRotation(directions: HexDirection[]): number {
  for (const direction of directions) {
    const previous = ((direction + 5) % 6) as HexDirection;
    const next = ((direction + 1) % 6) as HexDirection;
    if (directions.includes(previous) && directions.includes(next)) return direction;
  }
  return directions[0] ?? 0;
}

function selectGapRotation(directions: HexDirection[]): number {
  for (let direction = 0; direction < 6; direction += 1) {
    if (!directions.includes(direction as HexDirection)) return direction;
  }
  return 0;
}
