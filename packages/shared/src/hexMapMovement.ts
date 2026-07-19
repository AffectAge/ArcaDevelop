import type { HexDirection, HexId, HexMapArtifact, HexTile } from "./contracts/hex-map";
import type { UnitDomain } from "./contracts/units";
import { getNeighborAxial, makeHexId } from "./hexGeometry";

export const MOVEMENT_POINT_SCALE = 1_000;

function toMovementPointUnits(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * MOVEMENT_POINT_SCALE);
}

export function normalizeMovementPoints(value: number): number {
  return toMovementPointUnits(value) / MOVEMENT_POINT_SCALE;
}

export type HexMovementStepResolution = {
  canEnter: boolean;
  movementCost: number;
  remainingMovement: number;
  stoppedByEnemyZoneOfControl: boolean;
};

/**
 * Resolves one destination-tile movement cost using fixed-point arithmetic.
 * Entering an enemy zone of control consumes every remaining movement point,
 * unless the unit class explicitly ignores zones of control.
 */
export function resolveHexMovementStep(params: {
  remainingMovement: number;
  movementCost: number;
  entersEnemyZoneOfControl?: boolean;
  ignoresEnemyZoneOfControl?: boolean;
}): HexMovementStepResolution {
  const remainingUnits = toMovementPointUnits(params.remainingMovement);
  const costUnits = Math.max(1, toMovementPointUnits(params.movementCost));
  if (costUnits > remainingUnits) {
    return {
      canEnter: false,
      movementCost: costUnits / MOVEMENT_POINT_SCALE,
      remainingMovement: remainingUnits / MOVEMENT_POINT_SCALE,
      stoppedByEnemyZoneOfControl: false,
    };
  }
  const stoppedByEnemyZoneOfControl = params.entersEnemyZoneOfControl === true && params.ignoresEnemyZoneOfControl !== true;
  return {
    canEnter: true,
    movementCost: costUnits / MOVEMENT_POINT_SCALE,
    remainingMovement: stoppedByEnemyZoneOfControl ? 0 : (remainingUnits - costUnits) / MOVEMENT_POINT_SCALE,
    stoppedByEnemyZoneOfControl,
  };
}

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
  if (canDomainUseRiverEdge(params.domain, edge)) return normalizeMovementPoints(Math.min(params.baseCost, 0.5));
  if ((params.domain === "land" || params.domain === "civilian") && edge?.crossingCost && edge.crossingCost > 0) {
    return normalizeMovementPoints(params.baseCost + edge.crossingCost);
  }
  return normalizeMovementPoints(params.baseCost);
}
