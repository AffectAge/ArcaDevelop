import TinyQueue from "tinyqueue";
import type { HexDirection, HexId, HexMapArtifact, HexTile } from "@arcanorum/shared";
import { axialDistance, getNeighborAxial, makeHexId } from "./hexGeometry";

type PathNode = {
  id: HexId;
  cost: number;
  priority: number;
};

export function findHexPath(
  map: HexMapArtifact,
  startId: HexId,
  goalId: HexId,
  limit = 1200,
  tileById: ReadonlyMap<HexId, HexTile> = getHexPathTileIndex(map),
): HexId[] {
  if (startId === goalId) return [startId];
  const start = tileById.get(startId);
  const goal = tileById.get(goalId);
  if (!start || !goal || !start.passable || !goal.passable) return [];

  const frontier = new TinyQueue<PathNode>([{ id: startId, cost: 0, priority: 0 }], (a, b) => a.priority - b.priority);
  const cameFrom = new Map<HexId, HexId | null>([[startId, null]]);
  const costSoFar = new Map<HexId, number>([[startId, 0]]);
  let visited = 0;

  while (frontier.length > 0 && visited < limit) {
    visited += 1;
    const current = frontier.pop();
    if (!current) break;
    if (current.id === goalId) break;
    const currentTile = tileById.get(current.id);
    if (!currentTile) continue;
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = getNeighborTile(currentTile, direction as HexDirection, map, tileById);
      if (!neighbor || !neighbor.passable) continue;
      const nextCost = (costSoFar.get(current.id) ?? 0) + neighbor.movementCost;
      if (!costSoFar.has(neighbor.id) || nextCost < (costSoFar.get(neighbor.id) ?? Number.POSITIVE_INFINITY)) {
        costSoFar.set(neighbor.id, nextCost);
        const priority = nextCost + axialDistance(neighbor, goal, map.settings.wrapX ? map.settings.width : undefined);
        frontier.push({ id: neighbor.id, cost: nextCost, priority });
        cameFrom.set(neighbor.id, current.id);
      }
    }
  }

  if (!cameFrom.has(goalId)) return [];
  const path: HexId[] = [];
  let cursor: HexId | null = goalId;
  while (cursor) {
    path.push(cursor);
    cursor = cameFrom.get(cursor) ?? null;
  }
  return path.reverse();
}

const tileIndexByMap = new WeakMap<HexMapArtifact, Map<HexId, HexTile>>();

function getHexPathTileIndex(map: HexMapArtifact): Map<HexId, HexTile> {
  const cached = tileIndexByMap.get(map);
  if (cached) return cached;
  const next = new Map(map.tiles.map((tile) => [tile.id, tile] as const));
  tileIndexByMap.set(map, next);
  return next;
}

function getNeighborTile(tile: HexTile, direction: HexDirection, map: HexMapArtifact, tileById: ReadonlyMap<HexId, HexTile>): HexTile | null {
  const axial = getNeighborAxial(tile, direction, map.settings);
  return axial ? tileById.get(makeHexId(axial.q, axial.r)) ?? null : null;
}
