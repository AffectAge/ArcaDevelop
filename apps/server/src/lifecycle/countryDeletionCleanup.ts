import type { Order, WorldBase } from "@arcanorum/shared";

export type CountryOrdersCleanupParams = {
  countryId: string;
  ordersByTurn: Map<number, Map<string, Order[]>>;
  resolveReadyByTurn: Map<number, Set<string>>;
  removeOrderFromTurnIndexes?: (order: Order) => void;
  dropTurnOrderIndexes?: (turnId: number) => void;
};

export function removeCountryOrdersAndReadinessFromState(params: CountryOrdersCleanupParams): void {
  const { countryId, ordersByTurn, resolveReadyByTurn } = params;
  for (const [savedTurnId, ordersByCountry] of ordersByTurn.entries()) {
    const removedOrders = ordersByCountry.get(countryId) ?? [];
    for (const order of removedOrders) {
      params.removeOrderFromTurnIndexes?.(order);
    }
    ordersByCountry.delete(countryId);
    if (ordersByCountry.size === 0) {
      ordersByTurn.delete(savedTurnId);
      params.dropTurnOrderIndexes?.(savedTurnId);
    }
  }
  for (const [savedTurnId, readyCountryIds] of resolveReadyByTurn.entries()) {
    readyCountryIds.delete(countryId);
    if (readyCountryIds.size === 0) {
      resolveReadyByTurn.delete(savedTurnId);
    }
  }
}

export type CountryWorldBaseCleanupParams = {
  countryId: string;
  worldBase: WorldBase;
  removeCountryFromEconomyTick?: (countryId: string) => void;
  removeCountryFromActiveColonizationIndex?: (countryId: string) => void;
  removeRegionFromActiveColonizationIndex?: (hexId: string) => void;
};

export function cleanupWorldBaseAfterCountryRemovalFromState(params: CountryWorldBaseCleanupParams): void {
  const { countryId, worldBase } = params;
  delete worldBase.resourcesByCountry[countryId];
  params.removeCountryFromEconomyTick?.(countryId);
  delete worldBase.technologyByCountry[countryId];
  delete worldBase.parliamentByCountry[countryId];
  delete worldBase.countryDecisionsByCountryId[countryId];
  delete worldBase.countryEventsByCountryId[countryId];
  delete worldBase.countryScheduledEventsByCountryId[countryId];
  delete worldBase.countryEventFlagsByCountryId[countryId];
  delete worldBase.journalEntriesByCountryId[countryId];
  delete worldBase.countryModifiersByCountryId[countryId];
  delete worldBase.divisionTemplatesByCountry[countryId];
  delete worldBase.militaryFormationQueueByCountry[countryId];

  for (const [divisionId, division] of Object.entries(worldBase.divisionsById)) {
    if (division.countryId === countryId) {
      delete worldBase.divisionsById[divisionId];
    }
  }
  for (const [fleetId, fleet] of Object.entries(worldBase.fleetsById)) {
    if (fleet.countryId === countryId) {
      delete worldBase.fleetsById[fleetId];
    }
  }
  for (const [airWingId, airWing] of Object.entries(worldBase.airWingsById)) {
    if (airWing.countryId === countryId) {
      delete worldBase.airWingsById[airWingId];
    }
  }
  worldBase.diplomacyProposals = worldBase.diplomacyProposals.filter(
    (proposal) => proposal.fromCountryId !== countryId && proposal.toCountryId !== countryId,
  );
  for (const [hexId, ownerId] of Object.entries(worldBase.hexOwner)) {
    if (ownerId === countryId) {
      delete worldBase.hexOwner[hexId];
    }
  }
  for (const progress of Object.values(worldBase.colonyProgressByRegion)) {
    delete progress[countryId];
  }
  params.removeCountryFromActiveColonizationIndex?.(countryId);
  for (const [hexId, progress] of Object.entries(worldBase.colonyProgressByRegion)) {
    if (Object.keys(progress).length === 0) {
      delete worldBase.colonyProgressByRegion[hexId];
      params.removeRegionFromActiveColonizationIndex?.(hexId);
    }
  }
  for (const [hexId, queue] of Object.entries(worldBase.regionConstructionQueueByRegion)) {
    if (!Array.isArray(queue) || queue.length === 0) continue;
    worldBase.regionConstructionQueueByRegion[hexId] = queue.filter((project) => {
      if (project.requestedByCountryId === countryId) return false;
      if (project.owner.type === "state" && project.owner.countryId === countryId) return false;
      return true;
    });
  }
}
