import type { HexTile, WorldBase } from "@arcanorum/shared";

export type MapPoliticalOwnership = Pick<WorldBase, "hexOwner" | "regionOwner">;

export function resolveMapDisplayRegionId(tile: HexTile): HexTile["regionId"] | null {
  return tile.waterKind === "ocean" ? null : tile.regionId;
}

/**
 * Region ownership is not projected across deep-ocean generator regions. An
 * explicit per-hex owner still wins, so authored maritime territory remains
 * visible without fragmented borders through unclaimed ocean.
 */
export function resolveMapDisplayOwner(
  tile: HexTile,
  ownership: MapPoliticalOwnership,
): string | null {
  const explicitHexOwner = ownership.hexOwner[tile.id];
  if (explicitHexOwner) return explicitHexOwner;
  if (!resolveMapDisplayRegionId(tile)) return null;
  return ownership.regionOwner[tile.regionId] ?? null;
}
