import type { BuildingInstance, ResourceTotals, WorldBase } from "@arcanorum/shared";
import {
  countBuildingOccurrences,
  getBuildingMaxLevel,
  getBuildingUpgradeCosts,
  getCountryBuildLimit,
  getGlobalBuildLimit,
  isCountryAllowedForBuildingSync,
  parseRequestedBuildingIdFromPayload,
  type BuildingMechanicsContentEntry,
} from "../mechanics/buildingMechanics";
import type { AiCountryContext, AiWorldIndexes } from "./aiContext";

export type AiEconomyCandidateKind = "build" | "upgrade";

export type AiEconomyBuildCandidate = {
  kind: "build";
  countryId: string;
  regionId: string;
  buildingId: string;
  orderDraft: {
    type: "BUILD";
    countryId: string;
    regionId: string;
    targetHexId: string;
    payload: {
      buildingId: string;
      owner: { type: "state"; countryId: string };
    };
  };
};

export type AiEconomyUpgradeCandidate = {
  kind: "upgrade";
  countryId: string;
  regionId: string;
  buildingId: string;
  instanceId: string;
  currentLevel: number;
  targetLevel: number;
  costConstruction: number;
  costDucats: number;
  request: {
    route: "/country/build/upgrade-state";
    body: {
      regionId: string;
      buildingId: string;
      instanceId: string;
    };
  };
};

export type AiEconomyOrderCandidate = AiEconomyBuildCandidate | AiEconomyUpgradeCandidate;

export type AiEconomyCandidateParams<
  TBuilding extends BuildingMechanicsContentEntry = BuildingMechanicsContentEntry,
> = {
  context: AiCountryContext;
  world: Pick<
    WorldBase,
    | "regionOwner"
    | "regionController"
    | "regionBuildingsByRegion"
    | "regionConstructionQueueByRegion"
  >;
  indexes: AiWorldIndexes;
  buildings: TBuilding[];
  maxBuildCompletionTurns?: number;
  isBuildingUnlockedForCountry?: (buildingId: string, countryId: string) => boolean;
  getRegionBuildRestriction?: (building: TBuilding, regionId: string) => string | null;
  selectBuildTargetHexId?: (building: TBuilding, regionId: string, countryId: string) => string | null;
};

export function selectAiEconomyOrderCandidates<TBuilding extends BuildingMechanicsContentEntry>(
  params: AiEconomyCandidateParams<TBuilding>,
): AiEconomyOrderCandidate[] {
  const buildCandidates = selectAiBuildCandidates(params);
  const upgradeCandidates = selectAiUpgradeCandidates(params);
  return [...upgradeCandidates, ...buildCandidates].sort(compareAiEconomyCandidates);
}

function selectAiBuildCandidates<TBuilding extends BuildingMechanicsContentEntry>(
  params: AiEconomyCandidateParams<TBuilding>,
): AiEconomyBuildCandidate[] {
  const candidates: AiEconomyBuildCandidate[] = [];
  const controlledRegionIds = [...params.context.controlledRegionIds].sort();
  const buildings = [...params.buildings].sort((left, right) => left.id.localeCompare(right.id));

  for (const regionId of controlledRegionIds) {
    if (!isRegionControlledByCountry(params.world, params.context.countryId, regionId)) continue;
    for (const building of buildings) {
      if (!canAiBuildInRegion(params, building, regionId)) continue;
      const targetHexId = params.selectBuildTargetHexId?.(building, regionId, params.context.countryId) ?? null;
      if (!targetHexId) continue;
      candidates.push({
        kind: "build",
        countryId: params.context.countryId,
        regionId,
        buildingId: building.id,
        orderDraft: {
          type: "BUILD",
          countryId: params.context.countryId,
          regionId,
          targetHexId,
          payload: {
            buildingId: building.id,
            owner: { type: "state", countryId: params.context.countryId },
          },
        },
      });
    }
  }

  return candidates;
}

function selectAiUpgradeCandidates<TBuilding extends BuildingMechanicsContentEntry>(
  params: AiEconomyCandidateParams<TBuilding>,
): AiEconomyUpgradeCandidate[] {
  const candidates: AiEconomyUpgradeCandidate[] = [];
  const buildingById = new Map(params.buildings.map((building) => [building.id, building] as const));
  const controlledRegionIds = [...params.context.controlledRegionIds].sort();

  for (const regionId of controlledRegionIds) {
    if (!isRegionControlledByCountry(params.world, params.context.countryId, regionId)) continue;
    const instances = [...(params.world.regionBuildingsByRegion[regionId] ?? [])].sort(compareBuildingInstances);
    const queuedUpgradeInstanceIds = getQueuedUpgradeInstanceIds(
      params.world.regionConstructionQueueByRegion[regionId] ?? [],
    );

    for (const instance of instances) {
      if (queuedUpgradeInstanceIds.has(instance.instanceId)) continue;
      const building = buildingById.get(instance.buildingId);
      if (!building) continue;
      const currentLevel = Math.max(1, Math.floor(Number(instance.level ?? 1)));
      const maxLevel = getBuildingMaxLevel(building);
      if (currentLevel >= maxLevel) continue;
      const costs = getBuildingUpgradeCosts(building);
      if (!hasEnoughDucats(params.context.resources, costs.costDucats)) continue;

      candidates.push({
        kind: "upgrade",
        countryId: params.context.countryId,
        regionId,
        buildingId: instance.buildingId,
        instanceId: instance.instanceId,
        currentLevel,
        targetLevel: Math.min(maxLevel, currentLevel + 1),
        costConstruction: costs.costConstruction,
        costDucats: costs.costDucats,
        request: {
          route: "/country/build/upgrade-state",
          body: {
            regionId,
            buildingId: instance.buildingId,
            instanceId: instance.instanceId,
          },
        },
      });
    }
  }

  return candidates;
}

function canAiBuildInRegion<TBuilding extends BuildingMechanicsContentEntry>(
  params: AiEconomyCandidateParams<TBuilding>,
  building: TBuilding,
  regionId: string,
): boolean {
  if (!isCountryAllowedForBuildingSync(building, params.context.countryId)) return false;
  if (!isBuildingUnlocked(params, building.id)) return false;
  if (params.getRegionBuildRestriction?.(building, regionId)) return false;
  if (hasQueuedBuildProject(params.world.regionConstructionQueueByRegion[regionId] ?? [], building.id)) return false;
  if (!canAiAffordBuildProject(params.context.resources, building, params.maxBuildCompletionTurns)) return false;

  const counts = countBuildingOccurrences({
    buildingId: building.id,
    countryId: params.context.countryId,
    worldBase: params.world,
    pendingOrders: [],
    parseRequestedBuildingId: (payload) => parseRequestedBuildingIdFromPayload(payload, ""),
  });
  const countryLimit = getCountryBuildLimit(building, params.context.countryId);
  const globalLimit = getGlobalBuildLimit(building);
  const hasCountryLimitOverride = countryLimit !== undefined;

  if (typeof countryLimit === "number" && counts.byCountry >= countryLimit) return false;
  if (!hasCountryLimitOverride && globalLimit != null && counts.global >= globalLimit) return false;
  return true;
}

function canAiAffordBuildProject(
  resources: ResourceTotals,
  building: BuildingMechanicsContentEntry,
  maxBuildCompletionTurns = 8,
): boolean {
  const availableConstruction = Math.max(0, Number(resources.construction ?? 0));
  const availableDucats = Math.max(0, Number(resources.ducats ?? 0));
  const maxCompletionTurns = Math.max(1, Math.floor(Number(maxBuildCompletionTurns) || 8));
  const costConstruction = Math.max(1, Math.floor(Number(building.costConstruction ?? 100)));
  const costDucats = Math.max(0, Number(building.costDucats ?? 10));

  if (availableConstruction <= 0) return false;
  if (costDucats > availableDucats + 1e-9) return false;
  return costConstruction / availableConstruction <= maxCompletionTurns;
}

function hasQueuedBuildProject(
  queue: Array<{ projectType?: "build" | "upgrade"; buildingId?: string }>,
  buildingId: string,
): boolean {
  return queue.some((project) => (project.projectType ?? "build") === "build" && project.buildingId === buildingId);
}

function isBuildingUnlocked<TBuilding extends BuildingMechanicsContentEntry>(
  params: AiEconomyCandidateParams<TBuilding>,
  buildingId: string,
): boolean {
  return params.isBuildingUnlockedForCountry?.(buildingId, params.context.countryId) ?? true;
}

function isRegionControlledByCountry(
  world: Pick<WorldBase, "regionOwner" | "regionController">,
  countryId: string,
  regionId: string,
): boolean {
  return (world.regionController[regionId] ?? world.regionOwner[regionId] ?? null) === countryId;
}

function hasEnoughDucats(resources: ResourceTotals, costDucats: number): boolean {
  return Math.max(0, Number(resources.ducats ?? 0)) + 1e-9 >= Math.max(0, costDucats);
}

function getQueuedUpgradeInstanceIds(
  queue: Array<{ projectType?: "build" | "upgrade"; targetInstanceId?: string }>,
): Set<string> {
  return new Set(
    queue
      .filter((project) => (project.projectType ?? "build") === "upgrade")
      .map((project) => project.targetInstanceId ?? "")
      .filter((targetInstanceId) => targetInstanceId.length > 0),
  );
}

function compareBuildingInstances(left: BuildingInstance, right: BuildingInstance): number {
  return (
    left.buildingId.localeCompare(right.buildingId) ||
    left.instanceId.localeCompare(right.instanceId)
  );
}

function compareAiEconomyCandidates(left: AiEconomyOrderCandidate, right: AiEconomyOrderCandidate): number {
  return (
    compareCandidateKind(left.kind, right.kind) ||
    left.regionId.localeCompare(right.regionId) ||
    left.buildingId.localeCompare(right.buildingId) ||
    getCandidateInstanceId(left).localeCompare(getCandidateInstanceId(right))
  );
}

function compareCandidateKind(left: AiEconomyCandidateKind, right: AiEconomyCandidateKind): number {
  const weight: Record<AiEconomyCandidateKind, number> = { upgrade: 0, build: 1 };
  return weight[left] - weight[right];
}

function getCandidateInstanceId(candidate: AiEconomyOrderCandidate): string {
  return candidate.kind === "upgrade" ? candidate.instanceId : "";
}
