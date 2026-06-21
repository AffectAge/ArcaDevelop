import type { ResourceTotals } from "@arcanorum/shared";
import type { ResourceFlowSourceType, ResourceId } from "@arcanorum/shared";

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

export type ResourceLedgerFlowInput = {
  countryId: string;
  resourceId: ResourceId;
  amount: number;
  sourceType: ResourceFlowSourceType;
  sourceId: string;
  categoryId: string;
  labelKey: string;
  labelParams?: Record<string, string | number | boolean | null>;
  metadata?: Record<string, string | number | boolean | null>;
};

export function applyCountryResourceIncomeTurn(params: {
  countryIds: Iterable<string>;
  resourcesByCountry: Record<string, ResourceTotals | undefined>;
  baseValues: EconomyTickBaseValues;
  resolveModifiedValue: (stat: EconomyTickResourceStat, base: number, context: { countryId: string }) => number;
  addIncome?: (input: ResourceLedgerFlowInput) => void;
}): void {
  for (const countryId of params.countryIds) {
    const resource = params.resourcesByCountry[countryId];
    if (!resource) {
      continue;
    }
    const context = { countryId };
    const incomes = [
      { resourceId: "culture" as const, stat: "culture_gain" as const, base: params.baseValues.baseCulturePerTurn },
      { resourceId: "science" as const, stat: "science_gain" as const, base: params.baseValues.baseSciencePerTurn },
      { resourceId: "religion" as const, stat: "religion_gain" as const, base: params.baseValues.baseReligionPerTurn },
      { resourceId: "colonization" as const, stat: "colonization_gain" as const, base: params.baseValues.colonizationPointsPerTurn },
      { resourceId: "construction" as const, stat: "construction_gain" as const, base: params.baseValues.baseConstructionPerTurn },
      { resourceId: "ducats" as const, stat: "ducats_gain" as const, base: params.baseValues.baseDucatsPerTurn },
      { resourceId: "gold" as const, stat: "gold_gain" as const, base: params.baseValues.baseGoldPerTurn },
    ];
    for (const income of incomes) {
      const amount = params.resolveModifiedValue(income.stat, income.base, context);
      if (params.addIncome) {
        params.addIncome({
          countryId,
          resourceId: income.resourceId,
          amount,
          sourceType: "base",
          sourceId: `base:${income.resourceId}`,
          categoryId: "base",
          labelKey: `resourceLedger.source.base.${income.resourceId}`,
        });
      } else {
        resource[income.resourceId] += amount;
      }
    }
  }
}
