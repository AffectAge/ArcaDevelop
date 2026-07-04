import type { HexId, HexTile, MapTagQuery } from "./contracts/hex-map";
import type { WorldBase } from "./contracts/world";
import { hexHasTag } from "./effectiveHex";
import { matchesMapTagQuery } from "./mapTags";

export type BuildingPlacementRules = {
  allowedTerrains?: string[];
  deniedTerrains?: string[];
  allowedFeatures?: string[];
  deniedFeatures?: string[];
  allowedWaterKinds?: string[];
  deniedWaterKinds?: string[];
  allowedTags?: string[];
  deniedTags?: string[];
  tagQuery?: MapTagQuery | null;
};

export type BuildingAdjacencyEffect = {
  id: string;
  when: {
    neighborTerrains?: string[];
    neighborFeatures?: string[];
    neighborTags?: string[];
    neighborTagQuery?: MapTagQuery | null;
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
  extractions?: Array<{ goodId: string; requiresDeposit?: boolean | null }> | null;
  requiresDepositGoodIds?: string[] | null;
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
  | "BUILD_PLACEMENT_WATER_NOT_ALLOWED"
  | "BUILD_PLACEMENT_TAG_DENIED"
  | "BUILD_PLACEMENT_TAG_NOT_ALLOWED"
  | "BUILD_PLACEMENT_DEPOSIT_REQUIRED"
  | "BUILD_PLACEMENT_DEPOSIT_HIDDEN"
  | "BUILD_PLACEMENT_DEPOSIT_WRONG_GOOD";

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
> & {
  regionResourceDepositsByRegion?: WorldBase["regionResourceDepositsByRegion"];
};

export function evaluateBuildingPlacement(params: {
  building: BuildingPlacementContent;
  countryId: string;
  hex: (HexTile & { tags?: readonly string[] }) | null | undefined;
  neighborHexes?: Array<HexTile & { tags?: readonly string[] }>;
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
  const deniedTag = placement.deniedTags?.find((tag) => hexHasTag(hex, tag));
  if (deniedTag) {
    return blocked({ code: "BUILD_PLACEMENT_TAG_DENIED", params: { tag: deniedTag } });
  }
  if (placement.allowedTags?.length && !placement.allowedTags.some((tag) => hexHasTag(hex, tag))) {
    return blocked({ code: "BUILD_PLACEMENT_TAG_NOT_ALLOWED", params: { tags: placement.allowedTags.join(",") } });
  }
  if (!matchesMapTagQuery(hex.mapTags ?? hex.tags, placement.tagQuery)) {
    return blocked({ code: "BUILD_PLACEMENT_TAG_NOT_ALLOWED", params: { tags: "tagQuery" } });
  }
  const requiredDepositGoodIds = getRequiredDepositGoodIds(params.building);
  if (requiredDepositGoodIds.length > 0) {
    const deposit = (params.world.regionResourceDepositsByRegion?.[hex.regionId] ?? []).find((entry) => entry.hexId === hex.id);
    if (!deposit || deposit.amount <= 0) {
      return blocked({ code: "BUILD_PLACEMENT_DEPOSIT_REQUIRED", params: { goodIds: requiredDepositGoodIds.join(",") } });
    }
    if (deposit.visibility !== "known") {
      return blocked({ code: "BUILD_PLACEMENT_DEPOSIT_HIDDEN", params: { goodId: deposit.goodId } });
    }
    if (!requiredDepositGoodIds.includes(deposit.goodId)) {
      return blocked({ code: "BUILD_PLACEMENT_DEPOSIT_WRONG_GOOD", params: { goodId: deposit.goodId, requiredGoodIds: requiredDepositGoodIds.join(",") } });
    }
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

export function getRequiredDepositGoodIds(building: BuildingPlacementContent): string[] {
  const ids = new Set<string>();
  for (const goodId of building.requiresDepositGoodIds ?? []) {
    if (typeof goodId === "string" && goodId.trim()) ids.add(goodId.trim());
  }
  for (const extraction of building.extractions ?? []) {
    if (extraction.requiresDeposit === false) continue;
    if (typeof extraction.goodId === "string" && extraction.goodId.trim()) ids.add(extraction.goodId.trim());
  }
  return [...ids].sort((left, right) => left.localeCompare(right));
}

export function isBuildingSlotOccupied(world: BuildingPlacementWorld, hexId: string, regionId: string): boolean {
  return (world.regionBuildingsByRegion[regionId] ?? []).some((instance) => instance.targetHexId === hexId) ||
    (world.regionConstructionQueueByRegion[regionId] ?? []).some((project) =>
      (project.projectType ?? "build") === "build" && project.targetHexId === hexId,
    );
}

function evaluateAdjacencyEffects(params: {
  building: BuildingPlacementContent;
  hex: HexTile & { tags?: readonly string[] };
  neighborHexes?: Array<HexTile & { tags?: readonly string[] }>;
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
  params: { neighborHexes?: Array<HexTile & { tags?: readonly string[] }>; world: BuildingPlacementWorld; hex: HexTile },
  effect: BuildingAdjacencyEffect,
): number {
  let count = 0;
  for (const neighbor of params.neighborHexes ?? []) {
    if (effect.when.neighborTerrains?.length && !matchesList(neighbor.terrain, effect.when.neighborTerrains)) continue;
    if (effect.when.neighborFeatures?.length && !matchesList(neighbor.feature, effect.when.neighborFeatures)) continue;
    if (effect.when.neighborTags?.length && !effect.when.neighborTags.some((tag) => hexHasTag(neighbor, tag))) continue;
    if (!matchesMapTagQuery(neighbor.mapTags ?? neighbor.tags, effect.when.neighborTagQuery)) continue;
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
