import type { HexDirection, HexId, HexMapSettings, HexTile } from "@arcanorum/shared";
import { getNeighborAxial, makeHexId } from "../hexGeometry";

export type HexBoundaryGroupResolver = (tile: HexTile) => string | null;

export function resolveHexBoundaryMask(params: {
  tile: HexTile;
  tileById: ReadonlyMap<HexId, HexTile>;
  settings: Pick<HexMapSettings, "width" | "height" | "wrapX">;
  resolveGroup: HexBoundaryGroupResolver;
  includeMapEdge?: boolean;
}): number {
  const group = params.resolveGroup(params.tile);
  if (group == null) return 0;
  let mask = 0;
  for (let direction = 0; direction < 6; direction += 1) {
    const neighborAxial = getNeighborAxial(params.tile, direction as HexDirection, params.settings);
    const neighbor = neighborAxial ? params.tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
    if ((!neighbor && params.includeMapEdge !== false) || (neighbor && params.resolveGroup(neighbor) !== group)) {
      mask |= 1 << direction;
    }
  }
  return mask;
}

export function collectBoundaryInvalidationHexIds(
  changedHexIds: Iterable<HexId>,
  tileById: ReadonlyMap<HexId, HexTile>,
  settings: Pick<HexMapSettings, "width" | "height" | "wrapX">,
): Set<HexId> {
  const invalidated = new Set<HexId>();
  for (const hexId of changedHexIds) {
    invalidated.add(hexId);
    const tile = tileById.get(hexId);
    if (!tile) continue;
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = getNeighborAxial(tile, direction as HexDirection, settings);
      if (neighbor) invalidated.add(makeHexId(neighbor.q, neighbor.r));
    }
  }
  return invalidated;
}

export function collectChangedRecordKeys(
  previous: Readonly<Record<string, string>>,
  next: Readonly<Record<string, string>>,
): Set<string> {
  const changed = new Set<string>();
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    if ((previous[key] ?? null) !== (next[key] ?? null)) changed.add(key);
  }
  return changed;
}

