import type { HexDirection, HexId, HexMapArtifact, HexTile } from "./contracts/hex-map";
import type { UnitDomain } from "./contracts/units";
import { getNeighborAxial, makeHexId } from "./hexGeometry";

export function findRiverEdgeBetween(
  map: HexMapArtifact,
  fromHexId: HexId,
  toHexId: HexId,
  tileById: ReadonlyMap<HexId, HexTile> = new Map(map.tiles.map((tile) => [tile.id, tile] as const)),
) {
  const from = tileById.get(fromHexId);
  if (!from) return null;
  for (let direction = 0; direction < 6; direction += 1) {
    const axial = getNeighborAxial(from, direction as HexDirection, map.settings);
    if (!axial || makeHexId(axial.q, axial.r) !== toHexId) continue;
    return map.riverEdges.find((edge) =>
      (edge.hexId === fromHexId && edge.direction === direction) ||
      (edge.hexId === toHexId && edge.direction === (((direction + 3) % 6) as HexDirection))
    ) ?? null;
  }
  return null;
}

export function canDomainUseRiverEdge(domain: UnitDomain, edge: ReturnType<typeof findRiverEdgeBetween>): boolean {
  return domain === "naval" && edge?.navigable === true;
}

export function resolveHexStepMovementCost(params: {
  map: HexMapArtifact;
  fromHexId: HexId;
  toTile: HexTile;
  domain: UnitDomain;
  baseCost: number;
  tileById?: ReadonlyMap<HexId, HexTile>;
}): number {
  const tileById = params.tileById ?? new Map(params.map.tiles.map((tile) => [tile.id, tile] as const));
  const edge = findRiverEdgeBetween(params.map, params.fromHexId, params.toTile.id, tileById);
  if (canDomainUseRiverEdge(params.domain, edge)) return Math.min(params.baseCost, 0.5);
  if ((params.domain === "land" || params.domain === "civilian") && edge?.crossingCost && edge.crossingCost > 0) {
    return params.baseCost + edge.crossingCost;
  }
  return params.baseCost;
}
