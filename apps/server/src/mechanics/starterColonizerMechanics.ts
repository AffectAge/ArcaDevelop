import type { HexTile, MapUnit, WorldBase } from "@arcanorum/shared";

export type StarterColonizerWorldState = Pick<
  WorldBase,
  "unitsById" | "regionController" | "regionOwner" | "hexOwner"
>;

export function ensureStarterColonizerForCountry(params: {
  worldBase: StarterColonizerWorldState;
  countryId: string;
  currentTurnId: number;
  tiles: readonly HexTile[];
  movementPoints: number;
  seed: string;
}): MapUnit | null {
  params.worldBase.unitsById ??= {};
  if (Object.values(params.worldBase.unitsById).some((unit) => unit.countryId === params.countryId)) {
    return null;
  }
  const landTiles = params.tiles.filter(isStarterColonizerHex);
  if (landTiles.length === 0) return null;
  const occupiedHexIds = new Set(
    Object.values(params.worldBase.unitsById)
      .filter((unit) => unit.status !== "captured" && unit.status !== "destroyed")
      .map((unit) => unit.hexId),
  );
  const controlledTiles = landTiles.filter((tile) => {
    const controller =
      params.worldBase.regionController[tile.regionId] ??
      params.worldBase.regionOwner[tile.regionId] ??
      params.worldBase.hexOwner[tile.id] ??
      null;
    return controller === params.countryId;
  });
  const tile = selectStableStarterHex({
    candidates: controlledTiles.length > 0 ? controlledTiles : landTiles,
    occupiedHexIds,
    seed: `${params.seed}:${params.countryId}`,
  });
  if (!tile) return null;
  const movementPoints = Math.max(1, Math.floor(params.movementPoints || 2));
  const unit: MapUnit = {
    id: `unit:starter:${sanitizeStarterUnitId(params.countryId)}`,
    countryId: params.countryId,
    unitTypeId: "unit:colonizer",
    hexId: tile.id,
    hp: 50,
    status: "idle",
    movementPoints,
    experience: 0,
    path: [],
    targetHexId: null,
    createdTurnId: params.currentTurnId,
    lastActionTurnId: null,
  };
  params.worldBase.unitsById[unit.id] = unit;
  return unit;
}

function isStarterColonizerHex(tile: HexTile): boolean {
  return tile.passable === true && tile.waterKind == null;
}

function selectStableStarterHex(params: {
  candidates: readonly HexTile[];
  occupiedHexIds: Set<string>;
  seed: string;
}): HexTile | null {
  const candidates = params.candidates
    .filter((tile) => !params.occupiedHexIds.has(tile.id))
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
  if (candidates.length === 0) return null;
  const index = hashString(params.seed) % candidates.length;
  return candidates[index] ?? null;
}

function sanitizeStarterUnitId(countryId: string): string {
  return countryId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
