import type { WorldBase } from "@arcanorum/shared";
import type { RegionColonizationConfig } from "../mechanics/colonizationMechanics";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import type { AiCountryContext } from "./aiContext";

export type AiColonizationCandidate = {
  kind: "colonize-region";
  countryId: string;
  regionId: string;
  pointCost: number;
  ducatCost: number;
  isAdjacentToControlledRegion: boolean;
  requiresValidatedPipeline: true;
  orderDraft: {
    type: "COLONIZE";
    countryId: string;
    regionId: string;
    payload: Record<string, never>;
  };
};

export type AiColonizationCandidateParams = {
  context: AiCountryContext;
  world: Pick<
    WorldBase,
    "regionOwner" | "regionController" | "regionColonizationByRegion" | "colonyProgressByRegion"
  >;
  regionIds: string[];
  regionAdjacencyById: Record<string, string[]>;
  maxActiveColonizations: number;
  activeColonizeRegionIds?: Iterable<string>;
  queuedColonizeRegionIds?: Iterable<string>;
  getRegionColonizationConfig: (regionId: string) => RegionColonizationConfig;
  getRegionDerivedColonizationCosts: (regionId: string) => { pointsCost: number; ducatsCost: number };
};

export function selectAiColonizationCandidates(params: AiColonizationCandidateParams): AiColonizationCandidate[] {
  const countryId = params.context.countryId;
  const activeRegionIds = new Set([
    ...Array.from(params.activeColonizeRegionIds ?? []),
    ...Array.from(params.queuedColonizeRegionIds ?? []),
  ]);
  if (activeRegionIds.size >= normalizeMaxActiveColonizations(params.maxActiveColonizations)) return [];
  if (Math.max(0, params.context.resources.colonization ?? 0) <= 0) return [];

  const ownedOrControlledRegionIds = new Set([
    ...params.context.ownedRegionIds,
    ...params.context.controlledRegionIds,
  ]);
  const isLandless = ownedOrControlledRegionIds.size === 0;
  const adjacentRegionIds = buildAdjacentRegionIdSet(ownedOrControlledRegionIds, params.regionAdjacencyById);

  return normalizeRegionIds(params.regionIds)
    .flatMap((regionId): AiColonizationCandidate[] => {
      if (!isCandidateRegionAllowed(params, regionId, countryId, isLandless, adjacentRegionIds, activeRegionIds)) {
        return [];
      }
      const costs = params.getRegionDerivedColonizationCosts(regionId);
      if (!hasResourcesToStartColonization(params.context.resources, params.getRegionColonizationConfig(regionId), costs)) {
        return [];
      }
      return [
        {
          kind: "colonize-region",
          countryId,
          regionId,
          pointCost: Math.max(1, Math.floor(costs.pointsCost)),
          ducatCost: Math.max(0, Math.floor(costs.ducatsCost)),
          isAdjacentToControlledRegion: adjacentRegionIds.has(regionId),
          requiresValidatedPipeline: true,
          orderDraft: {
            type: "COLONIZE",
            countryId,
            regionId,
            payload: {},
          },
        },
      ];
    })
    .sort(compareAiColonizationCandidates);
}

export function buildRegionAdjacencyByIdFromProvinces(
  provinces: Pick<Adm1ProvinceIndexEntry, "id" | "regionId" | "neighbors">[],
): Record<string, string[]> {
  const regionByProvinceId = new Map<string, string>();
  for (const province of provinces) {
    if (province.regionId) regionByProvinceId.set(province.id, province.regionId);
  }

  const adjacency = new Map<string, Set<string>>();
  for (const province of provinces) {
    if (!province.regionId) continue;
    const sourceRegionId = province.regionId;
    for (const neighborProvinceId of province.neighbors) {
      const targetRegionId = regionByProvinceId.get(neighborProvinceId);
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

function isCandidateRegionAllowed(
  params: AiColonizationCandidateParams,
  regionId: string,
  countryId: string,
  isLandless: boolean,
  adjacentRegionIds: Set<string>,
  activeRegionIds: Set<string>,
): boolean {
  if (params.world.regionOwner[regionId]) return false;
  if (params.getRegionColonizationConfig(regionId).disabled) return false;
  if ((params.world.colonyProgressByRegion[regionId] ?? {})[countryId] != null) return false;
  if (activeRegionIds.has(regionId)) return false;
  return isLandless || adjacentRegionIds.has(regionId);
}

function hasResourcesToStartColonization(
  resources: AiCountryContext["resources"],
  config: RegionColonizationConfig,
  costs: { pointsCost: number; ducatsCost: number },
): boolean {
  const colonizationPoints = Math.max(0, resources.colonization ?? 0);
  const ducats = Math.max(0, resources.ducats ?? 0);
  if (colonizationPoints <= 0) return false;
  const pointCost = Math.max(1, Math.floor(config.cost || costs.pointsCost));
  const ducatCost = Math.max(0, costs.ducatsCost);
  if (ducatCost <= 0) return true;
  const ducatsForOneProgressPoint = ducatCost / pointCost;
  return ducats + 1e-9 >= ducatsForOneProgressPoint;
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

function normalizeMaxActiveColonizations(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

function compareAiColonizationCandidates(
  left: AiColonizationCandidate,
  right: AiColonizationCandidate,
): number {
  return (
    left.pointCost - right.pointCost ||
    left.ducatCost - right.ducatCost ||
    left.regionId.localeCompare(right.regionId)
  );
}

function addRegionNeighbor(adjacency: Map<string, Set<string>>, regionId: string, neighborRegionId: string): void {
  const neighbors = adjacency.get(regionId) ?? new Set<string>();
  neighbors.add(neighborRegionId);
  adjacency.set(regionId, neighbors);
}
