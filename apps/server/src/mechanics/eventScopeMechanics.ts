import type { EventResolvedScope, EventScopeDefinition, EventTriggerDefinition, WorldBase } from "@arcanorum/shared";
import { evaluateEventTrigger, getRegionPopulationTotal } from "./eventTriggerMechanics";

export type EventScopeResolveParams = {
  countryId: string;
  scope: EventScopeDefinition | null | undefined;
  worldBase: Pick<
    WorldBase,
    | "resourcesByCountry"
    | "resourceLedgerByTurn"
    | "regionOwner"
    | "regionController"
    | "regionPopulationByRegion"
    | "regionBuildingsByRegion"
    | "colonyProgressByRegion"
    | "regionResourceDepositsByRegion"
    | "regionColonizationByRegion"
  >;
  conditionsMatchCountry?: Parameters<typeof evaluateEventTrigger>[0]["conditionsMatchCountry"];
  countryHasModifier?: Parameters<typeof evaluateEventTrigger>[0]["countryHasModifier"];
};

export type EventScopeResolveResult = {
  scopes: Record<string, EventResolvedScope>;
  explanations: ReturnType<typeof evaluateEventTrigger>["explanations"];
};

export function resolveEventScopes(params: EventScopeResolveParams): EventScopeResolveResult | null {
  const scopes: Record<string, EventResolvedScope> = {
    root: { kind: "country", id: params.countryId },
  };
  const explanations: ReturnType<typeof evaluateEventTrigger>["explanations"] = [];
  const regionScope = params.scope?.region;
  if (!regionScope) return { scopes, explanations };

  const candidateRegionIds = collectRegionCandidates(params.worldBase, params.countryId, regionScope.from ?? "root.controlled_regions");
  const matchingRegionIds = candidateRegionIds.filter((regionId) => {
    if (!regionScope.where) return true;
    const evaluation = evaluateEventTrigger({
      trigger: regionScope.where,
      countryId: params.countryId,
      worldBase: params.worldBase,
      scopes: { ...scopes, region: { kind: "region", id: regionId } },
      conditionsMatchCountry: params.conditionsMatchCountry,
      countryHasModifier: params.countryHasModifier,
    });
    if (evaluation.passed) explanations.push(...evaluation.explanations);
    return evaluation.passed;
  });

  const selectedRegionId = sortRegionCandidates(params.worldBase, matchingRegionIds, regionScope.pick ?? null)[0] ?? null;
  if (!selectedRegionId) return null;
  scopes.region = { kind: "region", id: selectedRegionId };
  return { scopes, explanations };
}

function collectRegionCandidates(
  worldBase: Pick<WorldBase, "regionOwner" | "regionController">,
  countryId: string,
  source: "root.controlled_regions" | "root.owned_regions",
): string[] {
  const regionIds = new Set([...Object.keys(worldBase.regionOwner), ...Object.keys(worldBase.regionController)]);
  return [...regionIds]
    .filter((regionId) => {
      if (source === "root.owned_regions") return worldBase.regionOwner[regionId] === countryId;
      return (worldBase.regionController[regionId] ?? worldBase.regionOwner[regionId] ?? null) === countryId;
    })
    .sort((a, b) => a.localeCompare(b));
}

function sortRegionCandidates(
  worldBase: Pick<WorldBase, "regionPopulationByRegion" | "regionBuildingsByRegion">,
  regionIds: string[],
  pick: NonNullable<NonNullable<EventScopeDefinition["region"]>["pick"]> | null,
): string[] {
  const orderBy = pick?.orderBy ?? "regionId";
  const direction = pick?.direction === "desc" ? -1 : 1;
  return [...regionIds].sort((a, b) => {
    const result = compareRegionCandidate(worldBase, a, b, orderBy);
    return result === 0 ? a.localeCompare(b) : result * direction;
  });
}

function compareRegionCandidate(
  worldBase: Pick<WorldBase, "regionPopulationByRegion" | "regionBuildingsByRegion">,
  a: string,
  b: string,
  orderBy: "regionId" | "population" | "buildings",
): number {
  if (orderBy === "population") return getRegionPopulationTotal(worldBase, a) - getRegionPopulationTotal(worldBase, b);
  if (orderBy === "buildings") {
    return (worldBase.regionBuildingsByRegion[a] ?? []).length - (worldBase.regionBuildingsByRegion[b] ?? []).length;
  }
  return a.localeCompare(b);
}

export function hasEventScopeTrigger(scope: EventScopeDefinition | null | undefined): scope is EventScopeDefinition {
  return Boolean(scope?.region);
}

export type { EventTriggerDefinition };
