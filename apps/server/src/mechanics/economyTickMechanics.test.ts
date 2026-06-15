import type { ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import { applyCountryResourceIncomeTurn, type EconomyTickResourceStat } from "./economyTickMechanics";

describe("economyTickMechanics", () => {
  it("applies modified per-turn resource income and skips missing country resources", () => {
    const resourcesByCountry: Record<string, ResourceTotals | undefined> = {
      "country:a": makeResources({ culture: 1, ducats: 10 }),
    };
    const calls: Array<{ stat: EconomyTickResourceStat; base: number; countryId: string }> = [];

    applyCountryResourceIncomeTurn({
      countryIds: ["country:a", "country:missing"],
      resourcesByCountry,
      baseValues: {
        baseCulturePerTurn: 2,
        baseSciencePerTurn: 3,
        baseReligionPerTurn: 4,
        colonizationPointsPerTurn: 5,
        baseConstructionPerTurn: 6,
        baseDucatsPerTurn: 7,
        baseGoldPerTurn: 8,
      },
      resolveModifiedValue: (stat, base, context) => {
        calls.push({ stat, base, countryId: context.countryId });
        return stat === "ducats_gain" ? base * 2 : base;
      },
    });

    expect(resourcesByCountry["country:a"]).toEqual({
      culture: 3,
      science: 3,
      religion: 4,
      colonization: 5,
      construction: 6,
      ducats: 24,
      gold: 8,
    });
    expect(calls).toEqual([
      { stat: "culture_gain", base: 2, countryId: "country:a" },
      { stat: "science_gain", base: 3, countryId: "country:a" },
      { stat: "religion_gain", base: 4, countryId: "country:a" },
      { stat: "colonization_gain", base: 5, countryId: "country:a" },
      { stat: "construction_gain", base: 6, countryId: "country:a" },
      { stat: "ducats_gain", base: 7, countryId: "country:a" },
      { stat: "gold_gain", base: 8, countryId: "country:a" },
    ]);
  });
});

function makeResources(overrides?: Partial<ResourceTotals>): ResourceTotals {
  return {
    culture: 0,
    science: 0,
    religion: 0,
    colonization: 0,
    construction: 0,
    ducats: 0,
    gold: 0,
    ...overrides,
  };
}
