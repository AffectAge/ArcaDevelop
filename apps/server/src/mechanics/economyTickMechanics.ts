import type { ResourceTotals } from "@arcanorum/shared";

export type EconomyTickResourceStat =
  | "culture_gain"
  | "science_gain"
  | "religion_gain"
  | "colonization_gain"
  | "construction_gain"
  | "ducats_gain"
  | "gold_gain";

export type EconomyTickBaseValues = {
  baseCulturePerTurn: number;
  baseSciencePerTurn: number;
  baseReligionPerTurn: number;
  colonizationPointsPerTurn: number;
  baseConstructionPerTurn: number;
  baseDucatsPerTurn: number;
  baseGoldPerTurn: number;
};

export function applyCountryResourceIncomeTurn(params: {
  countryIds: Iterable<string>;
  resourcesByCountry: Record<string, ResourceTotals | undefined>;
  baseValues: EconomyTickBaseValues;
  resolveModifiedValue: (stat: EconomyTickResourceStat, base: number, context: { countryId: string }) => number;
}): void {
  for (const countryId of params.countryIds) {
    const resource = params.resourcesByCountry[countryId];
    if (!resource) {
      continue;
    }
    const context = { countryId };
    resource.culture += params.resolveModifiedValue("culture_gain", params.baseValues.baseCulturePerTurn, context);
    resource.science += params.resolveModifiedValue("science_gain", params.baseValues.baseSciencePerTurn, context);
    resource.religion += params.resolveModifiedValue("religion_gain", params.baseValues.baseReligionPerTurn, context);
    resource.colonization += params.resolveModifiedValue(
      "colonization_gain",
      params.baseValues.colonizationPointsPerTurn,
      context,
    );
    resource.construction += params.resolveModifiedValue("construction_gain", params.baseValues.baseConstructionPerTurn, context);
    resource.ducats += params.resolveModifiedValue("ducats_gain", params.baseValues.baseDucatsPerTurn, context);
    resource.gold += params.resolveModifiedValue("gold_gain", params.baseValues.baseGoldPerTurn, context);
  }
}
