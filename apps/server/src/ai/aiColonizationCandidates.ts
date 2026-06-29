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
    name: string;
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

export type AiMoveColonizerCandidate = {
  kind: "move-colonizer";
  countryId: string;
  regionId: string;
  targetHexId: HexId;
  civilianUnitId: string;
  path: HexId[];
  pathLength: number;
  isAdjacentToControlledRegion: boolean;
  requiresValidatedPipeline: true;
  orderDraft: {
    type: "UNIT_MOVE";
    countryId: string;
    unitKind: "civilian";
    unitId: string;
    targetHexId: HexId;
    path: HexId[];
    payload: Record<string, unknown>;
  };
};

export type AiColonizationCandidate = AiFoundCityCandidate | AiMoveColonizerCandidate | AiQueueColonizerCandidate;

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
  hexes: Pick<HexMapIndexEntry, "id" | "regionId" | "neighbors" | "hexType" | "climate" | "landscape">[];
  regionIds: string[];
  regionAdjacencyById: Record<string, string[]>;
  colonizerQueueConfig: CivilianUnitQueueConfig;
  getRegionColonizationConfig: (regionId: string) => RegionColonizationConfig;
  getRegionDerivedColonizationCosts: (regionId: string) => { pointsCost: number; ducatsCost: number };
};

export function selectAiColonizationCandidates(params: AiColonizationCandidateParams): AiColonizationCandidate[] {
  const foundCityCandidates = selectFoundCityCandidates(params);
  if (foundCityCandidates.length > 0) return foundCityCandidates;
  const moveColonizerCandidates = selectMoveColonizerCandidates(params);
  if (moveColonizerCandidates.length > 0) return moveColonizerCandidates;
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
          name: `City ${regionId}`.slice(0, 32),
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
    .filter((hex): hex is Pick<HexMapIndexEntry, "id" | "regionId" | "neighbors" | "hexType" | "climate" | "landscape"> & { id: HexId; regionId: string } =>
      isHexId(hex.id) && typeof hex.regionId === "string" && isControlledBy(params.world, hex.regionId, countryId) && !occupiedHexIds.has(hex.id),
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

function selectMoveColonizerCandidates(params: AiColonizationCandidateParams): AiMoveColonizerCandidate[] {
  const countryId = params.context.countryId;
  const ownedOrControlledRegionIds = new Set([...params.context.ownedRegionIds, ...params.context.controlledRegionIds]);
  const isLandless = ownedOrControlledRegionIds.size === 0;
  const adjacentRegionIds = buildAdjacentRegionIdSet(ownedOrControlledRegionIds, params.regionAdjacencyById);
  const hexById = new Map(params.hexes.map((hex) => [hex.id, hex] as const));
  const occupiedHexIds = new Set(
    Object.values(params.world.civilianUnitsById ?? {})
      .filter((unit) => unit.status !== "captured")
      .map((unit) => unit.hexId),
  );
  const activeSettlementRegionIds = new Set(
    Object.values(params.world.settlementProjectsById ?? {})
      .filter((project) => project.countryId === countryId && project.state !== "completed" && project.state !== "canceled")
      .map((project) => project.regionId),
  );
  const targetRegionIds = normalizeRegionIds(params.regionIds)
    .filter((regionId) => !activeSettlementRegionIds.has(regionId))
    .filter((regionId) => isNeutralSettlementTarget(params, regionId, countryId, isLandless, adjacentRegionIds));
  if (targetRegionIds.length === 0) return [];
  const targetHexIds = new Set(
    params.hexes
      .filter((hex): hex is Pick<HexMapIndexEntry, "id" | "regionId" | "neighbors" | "hexType" | "climate" | "landscape"> & { id: HexId; regionId: string } =>
        isHexId(hex.id) && typeof hex.regionId === "string" && targetRegionIds.includes(hex.regionId) && isLandColonizerHex(hex),
      )
      .map((hex) => hex.id),
  );
  if (targetHexIds.size === 0) return [];

  return Object.values(params.world.civilianUnitsById ?? {})
    .filter((unit) => unit.countryId === countryId && unit.type === "colonizer" && unit.status !== "captured")
    .filter((unit) => !unit.targetHexId && unit.path.length === 0)
    .flatMap((unit): AiMoveColonizerCandidate[] => {
      if (!isHexId(unit.hexId)) return [];
      const route = findNearestColonizerRoute({
        startHexId: unit.hexId,
        targetHexIds,
        hexById,
        occupiedHexIds,
        selfUnitHexId: unit.hexId,
      });
      if (!route || route.path.length === 0) return [];
      const targetHex = hexById.get(route.targetHexId);
      const regionId = targetHex?.regionId ?? null;
      if (!regionId) return [];
      return [{
        kind: "move-colonizer",
        countryId,
        regionId,
        targetHexId: route.targetHexId,
        civilianUnitId: unit.id,
        path: route.path,
        pathLength: route.path.length,
        isAdjacentToControlledRegion: adjacentRegionIds.has(regionId),
        requiresValidatedPipeline: true,
        orderDraft: {
          type: "UNIT_MOVE",
          countryId,
          unitKind: "civilian",
          unitId: unit.id,
          targetHexId: route.targetHexId,
          path: route.path,
          payload: { path: route.path },
        },
      }];
    })
    .sort(compareMoveColonizerCandidates);
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

function isLandColonizerHex(hex: Pick<HexMapIndexEntry, "hexType" | "climate" | "landscape">): boolean {
  const values = [hex.hexType, hex.climate, hex.landscape].map((value) => String(value ?? "").toLowerCase());
  return !values.some((value) => value === "ocean" || value === "sea" || value === "lake" || value === "deep_ocean" || value === "coastal_water" || value === "freshwater");
}

function findNearestColonizerRoute(params: {
  startHexId: HexId;
  targetHexIds: Set<HexId>;
  hexById: Map<string, Pick<HexMapIndexEntry, "id" | "neighbors" | "hexType" | "climate" | "landscape">>;
  occupiedHexIds: Set<string>;
  selfUnitHexId: HexId;
}): { targetHexId: HexId; path: HexId[] } | null {
  const start = params.hexById.get(params.startHexId);
  if (!start) return null;
  const queue: HexId[] = [params.startHexId];
  const previousByHexId = new Map<HexId, HexId | null>([[params.startHexId, null]]);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const currentHexId = queue[cursor];
    if (!currentHexId) continue;
    if (currentHexId !== params.startHexId && params.targetHexIds.has(currentHexId)) {
      return { targetHexId: currentHexId, path: reconstructPath(previousByHexId, currentHexId) };
    }
    const current = params.hexById.get(currentHexId);
    if (!current) continue;
    const neighbors = current.neighbors
      .filter(isHexId)
      .sort((left, right) => left.localeCompare(right, "en"));
    for (const neighborId of neighbors) {
      if (previousByHexId.has(neighborId)) continue;
      const neighbor = params.hexById.get(neighborId);
      if (!neighbor || !isLandColonizerHex(neighbor)) continue;
      if (neighborId !== params.selfUnitHexId && params.occupiedHexIds.has(neighborId)) continue;
      previousByHexId.set(neighborId, currentHexId);
      queue.push(neighborId);
    }
  }

  return null;
}

function reconstructPath(previousByHexId: Map<HexId, HexId | null>, targetHexId: HexId): HexId[] {
  const reversed: HexId[] = [];
  let current: HexId | null | undefined = targetHexId;
  while (current) {
    reversed.push(current);
    current = previousByHexId.get(current) ?? null;
  }
  return reversed.reverse().slice(1);
}

function compareFoundCityCandidates(left: AiFoundCityCandidate, right: AiFoundCityCandidate): number {
  return left.pointCost - right.pointCost || left.regionId.localeCompare(right.regionId) || left.targetHexId.localeCompare(right.targetHexId);
}

function compareQueueColonizerCandidates(left: AiQueueColonizerCandidate, right: AiQueueColonizerCandidate): number {
  return left.costColonization - right.costColonization || left.costDucats - right.costDucats || left.targetHexId.localeCompare(right.targetHexId);
}

function compareMoveColonizerCandidates(left: AiMoveColonizerCandidate, right: AiMoveColonizerCandidate): number {
  return left.pathLength - right.pathLength || left.regionId.localeCompare(right.regionId) || left.targetHexId.localeCompare(right.targetHexId);
}

function addRegionNeighbor(adjacency: Map<string, Set<string>>, regionId: string, neighborRegionId: string): void {
  const neighbors = adjacency.get(regionId) ?? new Set<string>();
  neighbors.add(neighborRegionId);
  adjacency.set(regionId, neighbors);
}
