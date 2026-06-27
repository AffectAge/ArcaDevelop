import type { HexId, HexTile } from "./contracts/hex-map";
import type { WorldBase } from "./contracts/world";

export type BuildingPlacementRules = {
  allowedTerrains?: string[];
  deniedTerrains?: string[];
  allowedFeatures?: string[];
  deniedFeatures?: string[];
  allowedWaterKinds?: string[];
  deniedWaterKinds?: string[];
};

export type BuildingAdjacencyEffect = {
  id: string;
  when: {
    neighborTerrains?: string[];
    neighborFeatures?: string[];
    neighborBuildingIds?: string[];
    adjacentToRiver?: boolean;
  };
  perNeighbor?: boolean;
  maxStacks?: number | null;
  modifier: {
    target: "building.throughput";
    operation: "add" | "multiply";
    value: number;
  };
};

export type BuildingPlacementContent = {
  id: string;
  placement?: BuildingPlacementRules | null;
  adjacencyEffects?: BuildingAdjacencyEffect[] | null;
};

export type BuildingPlacementReasonCode =
  | "BUILD_PLACEMENT_OK"
  | "BUILD_PLACEMENT_HEX_NOT_FOUND"
  | "BUILD_PLACEMENT_REGION_NOT_CONTROLLED"
  | "BUILD_PLACEMENT_OCCUPIED"
  | "BUILD_PLACEMENT_TERRAIN_DENIED"
  | "BUILD_PLACEMENT_TERRAIN_NOT_ALLOWED"
  | "BUILD_PLACEMENT_FEATURE_DENIED"
  | "BUILD_PLACEMENT_FEATURE_NOT_ALLOWED"
  | "BUILD_PLACEMENT_WATER_DENIED"
  | "BUILD_PLACEMENT_WATER_NOT_ALLOWED";

export type BuildingPlacementReason = {
  code: BuildingPlacementReasonCode;
  params?: Record<string, string | number | boolean | null>;
};

export type BuildingPlacementAdjacencySource = {
  effectId: string;
  stacks: number;
  operation: "add" | "multiply";
  value: number;
};

export type BuildingPlacementEvaluation = {
  valid: boolean;
  reason: BuildingPlacementReason;
  throughputFactor: number;
  adjacencySources: BuildingPlacementAdjacencySource[];
  debugScore: number;
};

export type BuildingPlacementWorld = Pick<
  WorldBase,
  "regionOwner" | "regionController" | "regionBuildingsByRegion" | "regionConstructionQueueByRegion"
>;

export function evaluateBuildingPlacement(params: {
  building: BuildingPlacementContent;
  countryId: string;
  hex: HexTile | null | undefined;
  neighborHexes?: HexTile[];
  world: BuildingPlacementWorld;
  riverNeighborHexIds?: Set<HexId>;
}): BuildingPlacementEvaluation {
  const blocked = (reason: BuildingPlacementReason): BuildingPlacementEvaluation => ({
    valid: false,
    reason,
    throughputFactor: 1,
    adjacencySources: [],
    debugScore: 0,
  });
  const hex = params.hex;
  if (!hex) return blocked({ code: "BUILD_PLACEMENT_HEX_NOT_FOUND" });
  const controller = params.world.regionController[hex.regionId] ?? params.world.regionOwner[hex.regionId] ?? null;
  if (controller !== params.countryId) {
    return blocked({ code: "BUILD_PLACEMENT_REGION_NOT_CONTROLLED", params: { regionId: hex.regionId } });
  }
  if (isBuildingSlotOccupied(params.world, hex.id, hex.regionId)) {
    return blocked({ code: "BUILD_PLACEMENT_OCCUPIED", params: { hexId: hex.id } });
  }
  const placement = params.building.placement ?? {};
  if (matchesList(hex.terrain, placement.deniedTerrains)) {
    return blocked({ code: "BUILD_PLACEMENT_TERRAIN_DENIED", params: { terrain: hex.terrain } });
  }
  if (!allowsList(hex.terrain, placement.allowedTerrains)) {
    return blocked({ code: "BUILD_PLACEMENT_TERRAIN_NOT_ALLOWED", params: { terrain: hex.terrain } });
  }
  if (matchesList(hex.feature, placement.deniedFeatures)) {
    return blocked({ code: "BUILD_PLACEMENT_FEATURE_DENIED", params: { feature: hex.feature } });
  }
  if (!allowsList(hex.feature, placement.allowedFeatures)) {
    return blocked({ code: "BUILD_PLACEMENT_FEATURE_NOT_ALLOWED", params: { feature: hex.feature } });
  }
  const waterKind = hex.waterKind ?? "none";
  if (matchesList(waterKind, placement.deniedWaterKinds)) {
    return blocked({ code: "BUILD_PLACEMENT_WATER_DENIED", params: { waterKind } });
  }
  if (!allowsList(waterKind, placement.allowedWaterKinds)) {
    return blocked({ code: "BUILD_PLACEMENT_WATER_NOT_ALLOWED", params: { waterKind } });
  }

  const adjacencySources = evaluateAdjacencyEffects({ ...params, hex });
  const throughputFactor = adjacencySources.reduce((value, source) => {
    const total = source.value * source.stacks;
    return source.operation === "multiply" ? value * Math.pow(source.value, source.stacks) : value + total;
  }, 1);

  return {
    valid: true,
    reason: { code: "BUILD_PLACEMENT_OK" },
    throughputFactor: round3(throughputFactor),
    adjacencySources,
    debugScore: Math.max(0, Math.round(round3(throughputFactor) * 1000)),
  };
}

export function isBuildingSlotOccupied(world: BuildingPlacementWorld, hexId: string, regionId: string): boolean {
  return (world.regionBuildingsByRegion[regionId] ?? []).some((instance) => instance.targetHexId === hexId) ||
    (world.regionConstructionQueueByRegion[regionId] ?? []).some((project) =>
      (project.projectType ?? "build") === "build" && project.targetHexId === hexId,
    );
}

function evaluateAdjacencyEffects(params: {
  building: BuildingPlacementContent;
  hex: HexTile;
  neighborHexes?: HexTile[];
  world: BuildingPlacementWorld;
  riverNeighborHexIds?: Set<HexId>;
}): BuildingPlacementAdjacencySource[] {
  const effects = params.building.adjacencyEffects ?? [];
  const result: BuildingPlacementAdjacencySource[] = [];
  for (const effect of effects) {
    if (effect.modifier.target !== "building.throughput" || !Number.isFinite(effect.modifier.value)) continue;
    const matchingNeighborCount = countMatchingNeighbors(params, effect);
    const riverMatches = effect.when.adjacentToRiver === true ? (params.riverNeighborHexIds?.has(params.hex.id) ? 1 : 0) : 0;
    const rawStacks = effect.perNeighbor ? matchingNeighborCount + riverMatches : matchingNeighborCount > 0 || riverMatches > 0 ? 1 : 0;
    const stacks = Math.max(0, Math.min(Math.floor(effect.maxStacks ?? rawStacks), rawStacks));
    if (stacks <= 0) continue;
    result.push({
      effectId: effect.id,
      stacks,
      operation: effect.modifier.operation,
      value: effect.modifier.value,
    });
  }
  return result;
}

function countMatchingNeighbors(
  params: { neighborHexes?: HexTile[]; world: BuildingPlacementWorld; hex: HexTile },
  effect: BuildingAdjacencyEffect,
): number {
  let count = 0;
  for (const neighbor of params.neighborHexes ?? []) {
    if (effect.when.neighborTerrains?.length && !matchesList(neighbor.terrain, effect.when.neighborTerrains)) continue;
    if (effect.when.neighborFeatures?.length && !matchesList(neighbor.feature, effect.when.neighborFeatures)) continue;
    if (effect.when.neighborBuildingIds?.length) {
      const instances = params.world.regionBuildingsByRegion[neighbor.regionId] ?? [];
      if (!instances.some((instance) => instance.targetHexId === neighbor.id && matchesList(instance.buildingId, effect.when.neighborBuildingIds))) {
        continue;
      }
    }
    count += 1;
  }
  return count;
}

function allowsList<T extends string>(value: T, allowed: T[] | undefined): boolean {
  return !allowed || allowed.length === 0 || matchesList(value, allowed);
}

function matchesList<T extends string>(value: T, list: T[] | undefined): boolean {
  return Boolean(list?.some((item) => item === value));
}

function round3(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}
