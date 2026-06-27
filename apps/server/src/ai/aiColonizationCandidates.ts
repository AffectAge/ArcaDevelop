import type { HexId, WorldBase } from "@arcanorum/shared";
import type { RegionColonizationConfig } from "../mechanics/colonizationMechanics";
import type { CivilianUnitQueueConfig } from "../mechanics/civilianUnitMechanics";
import type { HexMapIndexEntry } from "../map/hexIndex";
import type { AiCountryContext } from "./aiContext";

export type AiFoundCityCandidate = {
  kind: "found-city";
  countryId: string;
  regionId: string;
  targetHexId: HexId;
  civilianUnitId: string;
  pointCost: number;
  isAdjacentToControlledRegion: boolean;
  requiresValidatedPipeline: true;
  orderDraft: {
    type: "FOUND_CITY";
    countryId: string;
    civilianUnitId: string;
    regionId: string;
    targetHexId: HexId;
    payload: Record<string, string>;
  };
};

export type AiQueueColonizerCandidate = {
  kind: "queue-colonizer";
  countryId: string;
  regionId: string;
  targetHexId: HexId;
  costColonization: number;
  costDucats: number;
  requiresValidatedPipeline: true;
  actionDraft: {
    type: "QUEUE_COLONIZER";
    countryId: string;
    hexId: HexId;
  };
};

export type AiColonizationCandidate = AiFoundCityCandidate | AiQueueColonizerCandidate;

export type AiColonizationCandidateParams = {
  context: AiCountryContext;
  world: Pick<
    WorldBase,
    | "regionOwner"
    | "regionController"
    | "regionColonizationByRegion"
    | "civilianUnitsById"
    | "civilianUnitQueueByCountry"
    | "settlementProjectsById"
    | "resourcesByCountry"
  >;
  hexes: Pick<HexMapIndexEntry, "id" | "regionId" | "neighbors">[];
  regionIds: string[];
  regionAdjacencyById: Record<string, string[]>;
  colonizerQueueConfig: CivilianUnitQueueConfig;
  getRegionColonizationConfig: (regionId: string) => RegionColonizationConfig;
  getRegionDerivedColonizationCosts: (regionId: string) => { pointsCost: number; ducatsCost: number };
};

export function selectAiColonizationCandidates(params: AiColonizationCandidateParams): AiColonizationCandidate[] {
  const foundCityCandidates = selectFoundCityCandidates(params);
  if (foundCityCandidates.length > 0) return foundCityCandidates;
  return selectQueueColonizerCandidates(params);
}

export function buildRegionAdjacencyByIdFromHexes(
  hexes: Pick<HexMapIndexEntry, "id" | "regionId" | "neighbors">[],
): Record<string, string[]> {
  const regionByHexId = new Map<string, string>();
  for (const province of hexes) {
    if (province.regionId) regionByHexId.set(province.id, province.regionId);
  }

  const adjacency = new Map<string, Set<string>>();
  for (const province of hexes) {
    if (!province.regionId) continue;
    const sourceRegionId = province.regionId;
    for (const neighborHexId of province.neighbors) {
      const targetRegionId = regionByHexId.get(neighborHexId);
      if (!targetRegionId || targetRegionId === sourceRegionId) continue;
      addRegionNeighbor(adjacency, sourceRegionId, targetRegionId);
      addRegionNeighbor(adjacency, targetRegionId, sourceRegionId);
    }
  }

  return Object.fromEntries(
    [...adjacency.entries()]
      .map(([regionId, neighbors]) => [regionId, [...neighbors].sort()] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function selectFoundCityCandidates(params: AiColonizationCandidateParams): AiFoundCityCandidate[] {
  const countryId = params.context.countryId;
  const ownedOrControlledRegionIds = new Set([...params.context.ownedRegionIds, ...params.context.controlledRegionIds]);
  const isLandless = ownedOrControlledRegionIds.size === 0;
  const adjacentRegionIds = buildAdjacentRegionIdSet(ownedOrControlledRegionIds, params.regionAdjacencyById);
  const hexById = new Map(params.hexes.map((hex) => [hex.id, hex] as const));
  const activeSettlementRegionIds = new Set(
    Object.values(params.world.settlementProjectsById ?? {})
      .filter((project) => project.countryId === countryId && project.state !== "completed" && project.state !== "canceled")
      .map((project) => project.regionId),
  );

  return Object.values(params.world.civilianUnitsById ?? {})
    .filter((unit) => unit.countryId === countryId && unit.type === "colonizer" && unit.status !== "captured")
    .flatMap((unit): AiFoundCityCandidate[] => {
      const hex = hexById.get(unit.hexId);
      const regionId = hex?.regionId ?? null;
      if (!regionId) return [];
      if (!isNeutralSettlementTarget(params, regionId, countryId, isLandless, adjacentRegionIds)) return [];
      if (activeSettlementRegionIds.has(regionId)) return [];
      const costs = params.getRegionDerivedColonizationCosts(regionId);
      return [{
        kind: "found-city",
        countryId,
        regionId,
        targetHexId: unit.hexId,
        civilianUnitId: unit.id,
        pointCost: Math.max(1, Math.floor(costs.pointsCost)),
        isAdjacentToControlledRegion: adjacentRegionIds.has(regionId),
        requiresValidatedPipeline: true,
        orderDraft: {
          type: "FOUND_CITY",
          countryId,
          civilianUnitId: unit.id,
          regionId,
          targetHexId: unit.hexId,
          payload: { cultureId: countryId },
        },
      }];
    })
    .sort(compareFoundCityCandidates);
}

function selectQueueColonizerCandidates(params: AiColonizationCandidateParams): AiQueueColonizerCandidate[] {
  const countryId = params.context.countryId;
  if (hasActiveColonizerOrQueue(params.world, countryId)) return [];
  const costColonization = Math.max(0, Math.floor(params.colonizerQueueConfig.colonizerCostColonization || 0));
  const costDucats = Math.max(0, Math.floor(params.colonizerQueueConfig.colonizerCostDucats || 0));
  const resources = params.context.resources;
  if (Math.max(0, resources.colonization ?? 0) < costColonization) return [];
  if (Math.max(0, resources.ducats ?? 0) < costDucats) return [];
  const occupiedHexIds = new Set(Object.values(params.world.civilianUnitsById ?? {}).map((unit) => unit.hexId));
  for (const item of Object.values(params.world.civilianUnitQueueByCountry ?? {}).flat()) {
    occupiedHexIds.add(item.hexId);
  }
  return params.hexes
    .filter((hex): hex is Pick<HexMapIndexEntry, "id" | "regionId" | "neighbors"> & { id: HexId; regionId: string } =>
      isHexId(hex.id) && Boolean(hex.regionId) && isControlledBy(params.world, hex.regionId ?? "", countryId) && !occupiedHexIds.has(hex.id),
    )
    .map((hex): AiQueueColonizerCandidate => ({
      kind: "queue-colonizer",
      countryId,
      regionId: hex.regionId,
      targetHexId: hex.id,
      costColonization,
      costDucats,
      requiresValidatedPipeline: true,
      actionDraft: {
        type: "QUEUE_COLONIZER",
        countryId,
        hexId: hex.id,
      },
    }))
    .sort(compareQueueColonizerCandidates);
}

function isNeutralSettlementTarget(
  params: AiColonizationCandidateParams,
  regionId: string,
  countryId: string,
  isLandless: boolean,
  adjacentRegionIds: Set<string>,
): boolean {
  if (!normalizeRegionIds(params.regionIds).includes(regionId)) return false;
  if (params.world.regionOwner[regionId]) return false;
  if (params.world.regionController[regionId]) return false;
  if (params.getRegionColonizationConfig(regionId).disabled) return false;
  return isLandless || adjacentRegionIds.has(regionId);
}

function hasActiveColonizerOrQueue(
  world: Pick<WorldBase, "civilianUnitsById" | "civilianUnitQueueByCountry">,
  countryId: string,
): boolean {
  if (Object.values(world.civilianUnitsById ?? {}).some((unit) => unit.countryId === countryId && unit.type === "colonizer" && unit.status !== "captured")) {
    return true;
  }
  return (world.civilianUnitQueueByCountry[countryId] ?? []).some((item) => item.type === "colonizer");
}

function isControlledBy(world: Pick<WorldBase, "regionOwner" | "regionController">, regionId: string, countryId: string): boolean {
  return (world.regionController[regionId] ?? world.regionOwner[regionId] ?? null) === countryId;
}

function buildAdjacentRegionIdSet(
  sourceRegionIds: Set<string>,
  regionAdjacencyById: Record<string, string[]>,
): Set<string> {
  const adjacent = new Set<string>();
  for (const regionId of sourceRegionIds) {
    for (const neighborRegionId of regionAdjacencyById[regionId] ?? []) {
      if (!sourceRegionIds.has(neighborRegionId)) adjacent.add(neighborRegionId);
    }
  }
  return adjacent;
}

function normalizeRegionIds(regionIds: string[]): string[] {
  return Array.from(new Set(regionIds.map((regionId) => regionId.trim()).filter(Boolean))).sort();
}

function isHexId(value: string): value is HexId {
  return /^hex:-?\d+:-?\d+$/.test(value);
}

function compareFoundCityCandidates(left: AiFoundCityCandidate, right: AiFoundCityCandidate): number {
  return left.pointCost - right.pointCost || left.regionId.localeCompare(right.regionId) || left.targetHexId.localeCompare(right.targetHexId);
}

function compareQueueColonizerCandidates(left: AiQueueColonizerCandidate, right: AiQueueColonizerCandidate): number {
  return left.costColonization - right.costColonization || left.costDucats - right.costDucats || left.targetHexId.localeCompare(right.targetHexId);
}

function addRegionNeighbor(adjacency: Map<string, Set<string>>, regionId: string, neighborRegionId: string): void {
  const neighbors = adjacency.get(regionId) ?? new Set<string>();
  neighbors.add(neighborRegionId);
  adjacency.set(regionId, neighbors);
}
