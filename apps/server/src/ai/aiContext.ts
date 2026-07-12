import type { DiplomacyProposal, RegionConstructionProject, ResourceTotals, WorldBase } from "@arcanorum/shared";

export type AiWorldIndexes = {
  ownedRegionIdsByCountry: Record<string, string[]>;
  controlledRegionIdsByCountry: Record<string, string[]>;
  constructionProjectsByCountry: Record<string, RegionConstructionProject[]>;
  diplomacyProposalIdsByCountry: Record<string, string[]>;
};

export type AiRegionContext = {
  regionId: string;
  isOwned: boolean;
  isControlled: boolean;
  populationSize: number;
  buildingCount: number;
  constructionProjectCount: number;
  discoveredDepositCount: number;
};

export type AiCountryContext = {
  countryId: string;
  turnId: number;
  resources: ResourceTotals;
  ownedRegionIds: string[];
  controlledRegionIds: string[];
  regions: AiRegionContext[];
  constructionProjectCount: number;
  diplomacyProposalCount: number;
};

const emptyResources: ResourceTotals = {
  culture: 0,
  science: 0,
  religion: 0,
  colonization: 0,
  construction: 0,
  ducats: 0,
  gold: 0,
};

export function buildAiWorldIndexes(world: WorldBase): AiWorldIndexes {
  const ownedRegionIdsByCountry: Record<string, string[]> = {};
  const controlledRegionIdsByCountry: Record<string, string[]> = {};
  const constructionProjectsByCountry: Record<string, RegionConstructionProject[]> = {};
  const diplomacyProposalIdsByCountry: Record<string, string[]> = {};

  for (const [regionId, countryId] of Object.entries(world.regionOwner)) {
    pushToIndex(ownedRegionIdsByCountry, countryId, regionId);
  }

  for (const [regionId, countryId] of Object.entries(world.regionController)) {
    pushToIndex(controlledRegionIdsByCountry, countryId, regionId);
  }

  for (const projects of Object.values(world.regionConstructionQueueByRegion)) {
    for (const project of projects) {
      pushToIndex(constructionProjectsByCountry, project.requestedByCountryId, project);
    }
  }

  for (const proposal of world.diplomacyProposals) {
    const proposalId = getDiplomacyProposalId(proposal);
    if (!proposalId) continue;
    for (const countryId of getDiplomacyProposalCountryIds(proposal)) {
      pushToIndex(diplomacyProposalIdsByCountry, countryId, proposalId);
    }
  }

  return {
    ownedRegionIdsByCountry: sortIndexValues(ownedRegionIdsByCountry),
    controlledRegionIdsByCountry: sortIndexValues(controlledRegionIdsByCountry),
    constructionProjectsByCountry,
    diplomacyProposalIdsByCountry: sortIndexValues(diplomacyProposalIdsByCountry),
  };
}

export function buildAiCountryContext(params: {
  countryId: string;
  world: WorldBase;
  indexes: AiWorldIndexes;
}): AiCountryContext {
  const { countryId, world, indexes } = params;
  const ownedRegionIds = indexes.ownedRegionIdsByCountry[countryId] ?? [];
  const controlledRegionIds = indexes.controlledRegionIdsByCountry[countryId] ?? [];
  const relevantRegionIds = Array.from(new Set([...ownedRegionIds, ...controlledRegionIds])).sort();

  return {
    countryId,
    turnId: world.turnId,
    resources: world.resourcesByCountry[countryId] ?? emptyResources,
    ownedRegionIds,
    controlledRegionIds,
    regions: relevantRegionIds.map((regionId) => buildAiRegionContext(countryId, regionId, world)),
    constructionProjectCount: indexes.constructionProjectsByCountry[countryId]?.length ?? 0,
    diplomacyProposalCount: indexes.diplomacyProposalIdsByCountry[countryId]?.length ?? 0,
  };
}

function buildAiRegionContext(countryId: string, regionId: string, world: WorldBase): AiRegionContext {
  return {
    regionId,
    isOwned: world.regionOwner[regionId] === countryId,
    isControlled: world.regionController[regionId] === countryId,
    populationSize: calculateRegionPopulationSize(world, regionId),
    buildingCount: world.regionBuildingsByRegion[regionId]?.length ?? 0,
    constructionProjectCount: world.regionConstructionQueueByRegion[regionId]?.length ?? 0,
    discoveredDepositCount: world.regionResourceDepositsByRegion[regionId]?.length ?? 0,
  };
}

function calculateRegionPopulationSize(world: WorldBase, regionId: string): number {
  const population = world.regionPopulationByRegion[regionId];
  if (!population) return 0;

  return population.pops.reduce((total, pop) => total + pop.size, 0);
}

function pushToIndex<TValue>(index: Record<string, TValue[]>, key: string, value: TValue): void {
  if (!key) return;
  const values = index[key] ?? [];
  values.push(value);
  index[key] = values;
}

function sortIndexValues(index: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(index).map(([key, values]) => [key, [...values].sort()]),
  );
}

function getDiplomacyProposalId(proposal: DiplomacyProposal): string | null {
  return typeof proposal.id === "string" && proposal.id.trim().length > 0 ? proposal.id : null;
}

function getDiplomacyProposalCountryIds(proposal: DiplomacyProposal): string[] {
  return [proposal.fromCountryId, proposal.toCountryId].filter(
    (countryId): countryId is string => typeof countryId === "string" && countryId.length > 0,
  );
}
