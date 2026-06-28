import type { Order, WorldBase } from "@arcanorum/shared";

export type CountryDeletionAssetRef = {
  kind: "flag" | "crest";
  url: string;
};

export type CountryDeletionPlan = {
  countryId: string;
  resourcesEntry: boolean;
  ownedHexIds: string[];
  colonizationHexIds: string[];
  emptyColonizationHexIds: string[];
  constructionQueueHexIds: string[];
  constructionProjectIds: string[];
  diplomacyProposalIds: string[];
  divisionIds: string[];
  fleetIds: string[];
  airWingIds: string[];
  divisionTemplateCountryEntry: boolean;
  militaryFormationQueueEntry: boolean;
  militaryFormationQueueItemIds: string[];
  technologyEntry: boolean;
  parliamentEntry: boolean;
  decisionEntry: boolean;
  eventEntry: boolean;
  scheduledEventEntry: boolean;
  eventFlagsEntry: boolean;
  journalEntry: boolean;
  countryModifiersEntry: boolean;
  orderTurns: number[];
  resolveReadyTurns: number[];
  assetRefs: CountryDeletionAssetRef[];
};

export function planCountryDeletion(params: {
  countryId: string;
  worldBase: WorldBase;
  ordersByTurn?: Map<number, Map<string, Order[]>>;
  resolveReadyByTurn?: Map<number, Set<string>>;
  flagUrl?: string | null;
  crestUrl?: string | null;
}): CountryDeletionPlan {
  const { countryId, worldBase } = params;
  const colonizationHexIds: string[] = [];
  const emptyColonizationHexIds: string[] = [];
  for (const [hexId, progress] of Object.entries(worldBase.colonyProgressByRegion)) {
    if (!(countryId in progress)) continue;
    colonizationHexIds.push(hexId);
    if (Object.keys(progress).length === 1) emptyColonizationHexIds.push(hexId);
  }

  const constructionQueueHexIds: string[] = [];
  const constructionProjectIds: string[] = [];
  for (const [hexId, queue] of Object.entries(worldBase.regionConstructionQueueByRegion)) {
    const matchingProjects = queue.filter((project) => {
      if (project.requestedByCountryId === countryId) return true;
      return project.owner.type === "state" && project.owner.countryId === countryId;
    });
    if (matchingProjects.length === 0) continue;
    constructionQueueHexIds.push(hexId);
    constructionProjectIds.push(...matchingProjects.map((project) => project.queueId));
  }

  return {
    countryId,
    resourcesEntry: countryId in worldBase.resourcesByCountry,
    ownedHexIds: Object.entries(worldBase.hexOwner)
      .filter(([, ownerId]) => ownerId === countryId)
      .map(([hexId]) => hexId)
      .sort((a, b) => a.localeCompare(b, "en")),
    colonizationHexIds: colonizationHexIds.sort((a, b) => a.localeCompare(b, "en")),
    emptyColonizationHexIds: emptyColonizationHexIds.sort((a, b) => a.localeCompare(b, "en")),
    constructionQueueHexIds: constructionQueueHexIds.sort((a, b) => a.localeCompare(b, "en")),
    constructionProjectIds: constructionProjectIds.sort((a, b) => a.localeCompare(b, "en")),
    diplomacyProposalIds: worldBase.diplomacyProposals
      .filter((proposal) => proposal.fromCountryId === countryId || proposal.toCountryId === countryId)
      .map((proposal) => proposal.id)
      .sort((a, b) => a.localeCompare(b, "en")),
    divisionIds: Object.values(worldBase.divisionsById)
      .filter((division) => division.countryId === countryId)
      .map((division) => division.id)
      .sort((a, b) => a.localeCompare(b, "en")),
    fleetIds: Object.values(worldBase.fleetsById)
      .filter((fleet) => fleet.countryId === countryId)
      .map((fleet) => fleet.id)
      .sort((a, b) => a.localeCompare(b, "en")),
    airWingIds: Object.values(worldBase.airWingsById)
      .filter((airWing) => airWing.countryId === countryId)
      .map((airWing) => airWing.id)
      .sort((a, b) => a.localeCompare(b, "en")),
    divisionTemplateCountryEntry: countryId in worldBase.divisionTemplatesByCountry,
    militaryFormationQueueEntry: countryId in worldBase.militaryFormationQueueByCountry,
    militaryFormationQueueItemIds: (worldBase.militaryFormationQueueByCountry[countryId] ?? [])
      .map((item) => item.id)
      .sort((a, b) => a.localeCompare(b, "en")),
    technologyEntry: countryId in worldBase.technologyByCountry,
    parliamentEntry: countryId in worldBase.parliamentByCountry,
    decisionEntry: countryId in worldBase.countryDecisionsByCountryId,
    eventEntry: countryId in worldBase.countryEventsByCountryId,
    scheduledEventEntry: countryId in worldBase.countryScheduledEventsByCountryId,
    eventFlagsEntry: countryId in worldBase.countryEventFlagsByCountryId,
    journalEntry: countryId in worldBase.journalEntriesByCountryId,
    countryModifiersEntry: countryId in worldBase.countryModifiersByCountryId,
    orderTurns: collectOrderTurns(countryId, params.ordersByTurn),
    resolveReadyTurns: collectResolveReadyTurns(countryId, params.resolveReadyByTurn),
    assetRefs: collectAssetRefs(params.flagUrl, params.crestUrl),
  };
}

function collectOrderTurns(countryId: string, ordersByTurn: Map<number, Map<string, Order[]>> | undefined): number[] {
  if (!ordersByTurn) return [];
  return [...ordersByTurn.entries()]
    .filter(([, ordersByCountry]) => ordersByCountry.has(countryId))
    .map(([turn]) => turn)
    .sort((a, b) => a - b);
}

function collectResolveReadyTurns(countryId: string, resolveReadyByTurn: Map<number, Set<string>> | undefined): number[] {
  if (!resolveReadyByTurn) return [];
  return [...resolveReadyByTurn.entries()]
    .filter(([, countryIds]) => countryIds.has(countryId))
    .map(([turn]) => turn)
    .sort((a, b) => a - b);
}

function collectAssetRefs(flagUrl: string | null | undefined, crestUrl: string | null | undefined): CountryDeletionAssetRef[] {
  const refs: CountryDeletionAssetRef[] = [];
  if (flagUrl) refs.push({ kind: "flag", url: flagUrl });
  if (crestUrl) refs.push({ kind: "crest", url: crestUrl });
  return refs;
}
