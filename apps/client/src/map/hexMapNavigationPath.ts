import type { HexId, HexMapNavigationArtifact, HexMapPathRequestMode } from "@arcanorum/shared";
import TinyQueue from "tinyqueue";
import { axialDistance, getNeighborAxial, makeHexId } from "./hexGeometry";

type FrontierNode = {
  index: number;
  cost: number;
  priority: number;
};

export type NavigationPathOptions = {
  maxVisited?: number;
  yieldEvery?: number;
  isCancelled?: () => boolean;
  yieldControl?: () => Promise<void>;
};

export async function findPathInNavigationArtifact(
  navigation: HexMapNavigationArtifact,
  fromHexId: HexId,
  toHexId: HexId,
  mode: HexMapPathRequestMode,
  options: NavigationPathOptions = {},
): Promise<HexId[]> {
  const start = parseBoundedHexId(fromHexId, navigation);
  const goal = parseBoundedHexId(toHexId, navigation);
  if (!start || !goal) return [];
  if (start.index === goal.index) return [fromHexId];
  if (mode === "attack") {
    return navigation.passability[start.index] === 1 && navigation.passability[goal.index] === 1 && areNavigationNeighbors(start, goal, navigation)
      ? [fromHexId, toHexId]
      : [];
  }
  if (navigation.passability[start.index] !== 1 || navigation.passability[goal.index] !== 1) return [];

  const totalTiles = navigation.width * navigation.height;
  const cameFrom = new Int32Array(totalTiles);
  cameFrom.fill(-2);
  cameFrom[start.index] = -1;
  const costs = new Float64Array(totalTiles);
  costs.fill(Number.POSITIVE_INFINITY);
  costs[start.index] = 0;
  const frontier = new TinyQueue<FrontierNode>(
    [{ index: start.index, cost: 0, priority: 0 }],
    (left, right) => left.priority - right.priority,
  );
  // The navigation artifact already bounds the search to the scenario map and
  // this work runs inside the cancellable map worker. A fixed 1,600-node cap
  // produced false "no path" results for long corridors on the 200k fixture.
  // Keep the explicit test/debug override, but make the production default
  // complete for the current artifact while yielding regularly.
  const maxVisited = Math.min(totalTiles, Math.max(1, Math.trunc(options.maxVisited ?? totalTiles)));
  const yieldEvery = Math.max(1, Math.trunc(options.yieldEvery ?? 128));
  const yieldControl = options.yieldControl ?? yieldToWorkerQueue;
  let visited = 0;

  while (frontier.length > 0 && visited < maxVisited) {
    if (options.isCancelled?.()) return [];
    const current = frontier.pop();
    if (!current) break;
    if (current.cost !== costs[current.index]) continue;
    if (current.index === goal.index) break;
    if (current.index !== start.index && navigation.stopsMovementOnEnter[current.index] === 1) continue;
    const currentHex = indexToAxial(current.index, navigation.width);
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = getNeighborAxial(currentHex, direction as 0 | 1 | 2 | 3 | 4 | 5, navigation);
      if (!neighbor) continue;
      const neighborIndex = neighbor.r * navigation.width + neighbor.q;
      if (navigation.passability[neighborIndex] !== 1) continue;
      const stepCost = Math.max(0.01, navigation.movementCosts[neighborIndex] ?? 1)
        + resolveNavigationRiverCrossingCost(navigation, current.index, direction);
      const nextCost = current.cost + stepCost;
      if (nextCost >= costs[neighborIndex]) continue;
      costs[neighborIndex] = nextCost;
      cameFrom[neighborIndex] = current.index;
      frontier.push({
        index: neighborIndex,
        cost: nextCost,
        priority: nextCost + axialDistance(neighbor, goal, navigation.wrapX ? navigation.width : undefined),
      });
    }
    visited += 1;
    if (visited % yieldEvery === 0) await yieldControl();
  }

  if (cameFrom[goal.index] === -2 || options.isCancelled?.()) return [];
  const path: HexId[] = [];
  let cursor = goal.index;
  while (cursor >= 0) {
    const hex = indexToAxial(cursor, navigation.width);
    path.push(makeHexId(hex.q, hex.r));
    cursor = cameFrom[cursor];
  }
  return path.reverse();
}

const riverCrossingCostByNavigation = new WeakMap<HexMapNavigationArtifact, Map<string, number>>();

function resolveNavigationRiverCrossingCost(
  navigation: HexMapNavigationArtifact,
  tileIndex: number,
  direction: number,
): number {
  let costs = riverCrossingCostByNavigation.get(navigation);
  if (!costs) {
    costs = new Map();
    for (const [sourceIndex, edgeDirection, , , , crossingCost] of navigation.riverEdges) {
      if (crossingCost <= 0) continue;
      costs.set(`${sourceIndex}:${edgeDirection}`, crossingCost);
      const source = indexToAxial(sourceIndex, navigation.width);
      const neighbor = getNeighborAxial(source, edgeDirection, navigation);
      if (neighbor) {
        const neighborIndex = neighbor.r * navigation.width + neighbor.q;
        costs.set(`${neighborIndex}:${(edgeDirection + 3) % 6}`, crossingCost);
      }
    }
    riverCrossingCostByNavigation.set(navigation, costs);
  }
  return costs.get(`${tileIndex}:${direction}`) ?? 0;
}

function parseBoundedHexId(
  hexId: HexId,
  navigation: Pick<HexMapNavigationArtifact, "width" | "height">,
): { q: number; r: number; index: number } | null {
  const match = /^hex:(-?\d+):(-?\d+)$/.exec(hexId);
  if (!match) return null;
  const q = Number(match[1]);
  const r = Number(match[2]);
  if (!Number.isInteger(q) || !Number.isInteger(r) || q < 0 || q >= navigation.width || r < 0 || r >= navigation.height) return null;
  return { q, r, index: r * navigation.width + q };
}

function indexToAxial(index: number, width: number): { q: number; r: number } {
  return { q: index % width, r: Math.floor(index / width) };
}

function areNavigationNeighbors(
  start: { q: number; r: number },
  goal: { q: number; r: number },
  navigation: Pick<HexMapNavigationArtifact, "width" | "height" | "wrapX">,
): boolean {
  for (let direction = 0; direction < 6; direction += 1) {
    const neighbor = getNeighborAxial(start, direction as 0 | 1 | 2 | 3 | 4 | 5, navigation);
    if (neighbor?.q === goal.q && neighbor.r === goal.r) return true;
  }
  return false;
}

function yieldToWorkerQueue(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
