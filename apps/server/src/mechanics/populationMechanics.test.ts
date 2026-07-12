import type { PopulationPop } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  allocatePopulationJobs,
  applyIdeologyAttractionToPopulation,
  calculateAvailableProfessionPopulation,
  calculateWageMultipliers,
  calculateWorkforceDemand,
  getActiveCultureNeeds,
  getPopulationTotal,
  isEqualRegionPopulation,
  normalizeCultureNeedsProfile,
  normalizePopulationPopsStrict,
  normalizeRegionPopulation,
  normalizeRegionPopulationMap,
  resolvePopulationTurnForRegions,
  resolveRegionPopulationNeedsTurn,
  resolvePopDiscrimination,
  sortCultureNeedsByPriority,
  type PopulationDomainKeys,
} from "./populationMechanics";

const domains: PopulationDomainKeys = {
  culturePct: ["culture:elves", "culture:default"],
  ideologyPct: ["ideology:liberal", "ideology:default"],
  religionPct: ["religion:sun", "religion:default"],
  racePct: ["race:human", "race:default"],
  professionPct: ["profession:workers", "profession:unemployed"],
};

function makePop(overrides: Partial<PopulationPop> = {}): PopulationPop {
  return {
    id: "pop:a",
    size: 100,
    cultureId: "culture:elves",
    religionId: "religion:sun",
    raceId: "race:human",
    professionId: "profession:unemployed",
    literacy: 0.25,
    ducats: 0,
    standardOfLiving: 8,
    radicals: 0,
    loyalists: 0,
    qualificationsByCategory: { labor: 100 },
    ideologies: { "ideology:default": 100 },
    lastIncomeDucats: 0,
    lastNeedsSpendDucats: 0,
    lastNeedsSatisfaction: 1,
    lastNeedsByCategory: {},
    lastNeedsDeficitByGood: {},
    lastNeedsBudgetShortageByGood: {},
    lastBirths: 0,
    lastDeaths: 0,
    lastEmployed: 0,
    lastOpenJobs: 0,
    lastQualificationLimit: 100,
    lastDiscriminationPenalty: 0,
    politicalStrength: 0,
    ...overrides,
  };
}

describe("populationMechanics atomic pops", () => {
  it("normalizes culture needs and filters active tiers by SoL", () => {
    const profile = normalizeCultureNeedsProfile({
      tiers: [
        { id: "comfort", minStandardOfLiving: 10, needs: [{ id: "wine", label: "Wine", category: "luxury", amountPerPerson: 1, weight: 2, goods: [{ goodId: "good:wine", weight: 1 }] }] },
        { id: "basic", minStandardOfLiving: 0, needs: [{ id: "food", label: "Food", category: "survival", amountPerPerson: 2.1234, weight: 1, goods: [{ goodId: "good:grain", weight: 1 }] }] },
      ],
    });

    expect(profile?.tiers.map((tier) => tier.id)).toEqual(["basic", "comfort"]);
    expect(getActiveCultureNeeds(profile, 8).map((need) => need.id)).toEqual(["food"]);
    expect(sortCultureNeedsByPriority(getActiveCultureNeeds(profile, 12)).map((need) => need.id)).toEqual(["food", "wine"]);
  });

  it("accepts atomic pops and rejects old nested professions or populationTotal", () => {
    const pop = makePop();
    expect(normalizePopulationPopsStrict({ rawPops: [pop], regionId: "region:a", domains })[0]).toMatchObject(pop);
    expect(() => normalizePopulationPopsStrict({
      rawPops: [{ ...pop, professions: { "profession:workers": { size: 100 } } }],
      regionId: "region:a",
      domains,
    })).toThrow("population-old-professions-shape");
    expect(() => normalizeRegionPopulation({ input: { populationTotal: 100 }, regionId: "region:a", domains })).toThrow("population-old-populationTotal");
  });

  it("keeps missing region population empty", () => {
    expect(normalizeRegionPopulation({ input: null, regionId: "region:a", domains })).toEqual({ pops: [] });
    expect(normalizeRegionPopulationMap({ input: {}, regionIds: ["region:a"], domains })).toEqual({ "region:a": { pops: [] } });
  });

  it("calculates workforce demand, wages, and atomic hiring", () => {
    const demand = calculateWorkforceDemand([{ level: 2, workforceRequirements: [{ professionId: "profession:workers", workers: 30 }] }]);
    expect(demand.demandByProfession["profession:workers"]).toBe(60);
    const population = { pops: [makePop({ size: 100, qualificationsByCategory: { labor: 80 } })] };
    expect(calculateAvailableProfessionPopulation(population)["profession:unemployed"]).toBe(100);
    expect(calculateWageMultipliers({ demandByProfession: demand.demandByProfession, availableByProfession: { "profession:workers": 30 } })["profession:workers"]).toBeGreaterThan(1);

    const hired = allocatePopulationJobs({ population, demandByProfession: demand.demandByProfession, fallbackProfessionId: "profession:unemployed" }).nextPopulation;
    expect(getPopulationTotal(hired)).toBe(100);
    expect(hired.pops.find((pop) => pop.professionId === "profession:workers")?.size).toBe(60);
    expect(hired.pops.find((pop) => pop.professionId === "profession:unemployed")?.size).toBe(40);
  });

  it("limits advanced hiring by profession qualification requirements", () => {
    const population = { pops: [makePop({ size: 100, qualificationsByCategory: { technical: 25 } })] };
    const hired = allocatePopulationJobs({
      population,
      demandByProfession: { "profession:engineers": 80 },
      fallbackProfessionId: "profession:unemployed",
      professionsById: new Map([["profession:engineers", { id: "profession:engineers", qualificationRequirements: { technical: 1 } }]]),
    }).nextPopulation;

    expect(hired.pops.find((pop) => pop.professionId === "profession:engineers")?.size).toBe(25);
    expect(hired.pops.find((pop) => pop.professionId === "profession:unemployed")?.lastQualificationShortageByCategory).toEqual({});
  });

  it("hires accepted pops before discriminated pops and records discrimination effects", () => {
    const accepted = makePop({ id: "pop:accepted", size: 50, cultureId: "culture:elves", qualificationsByCategory: { labor: 50 } });
    const discriminated = makePop({ id: "pop:disc", size: 50, cultureId: "culture:orcs", qualificationsByCategory: { labor: 50 } });
    const context = {
      countryId: "country:a",
      acceptedCultureIds: new Set(["culture:elves"]),
      acceptedReligionIds: new Set<string>(),
      acceptedRaceIds: new Set<string>(),
      activeLawIds: new Set(["law:citizenship"]),
    };
    const hired = allocatePopulationJobs({
      population: { pops: [discriminated, accepted] },
      demandByProfession: { "profession:workers": 60 },
      fallbackProfessionId: "profession:unemployed",
      acceptanceContext: context,
      activeLaws: [{ id: "law:citizenship", discrimination: { hiringPenaltyPct: 0.5 } }],
    }).nextPopulation;

    expect(hired.pops.find((pop) => pop.id.includes("accepted") && pop.professionId === "profession:workers")?.size).toBe(50);
    expect(hired.pops.find((pop) => pop.id.includes("disc") && pop.professionId === "profession:workers")?.lastDiscriminationStatus).toBe("discriminated");
    expect(resolvePopDiscrimination({ pop: discriminated, context }).reasons).toEqual(["culture"]);
  });

  it("resolves needs on atomic pops", () => {
    const result = resolveRegionPopulationNeedsTurn({
      population: { pops: [makePop({ size: 10, ducats: 0 })] },
      demandByProfession: { "profession:workers": 10 },
      wagesByProfession: { "profession:workers": 20 },
      fallbackProfessionId: "profession:unemployed",
      getNeedsForPop: () => [{ category: "survival", amountPerPerson: 1, weight: 1, goods: [{ goodId: "good:grain", weight: 1 }] }],
      getGoodPrice: () => 1,
      getAvailableGoodAmount: () => 100,
      purchaseGood: (_goodId: string, requestedPhysicalAmount: number, wallet: number) => ({
        purchasedPhysicalAmount: requestedPhysicalAmount,
        spent: requestedPhysicalAmount,
        wallet: wallet - requestedPhysicalAmount,
      }),
    });

    const worker = result.nextPopulation.pops.find((pop) => pop.professionId === "profession:workers");
    expect(worker?.lastNeedsSatisfaction).toBe(1);
    expect(result.demandRequestedByGood["good:grain"]).toBe(10);
  });

  it("applies taboo bans and obsession preference inside substitute goods", () => {
    const purchased: string[] = [];
    const result = resolveRegionPopulationNeedsTurn({
      population: { pops: [makePop({ size: 10, ducats: 0 })] },
      demandByProfession: { "profession:workers": 10 },
      wagesByProfession: { "profession:workers": 100 },
      fallbackProfessionId: "profession:unemployed",
      getNeedsForPop: () => [
        {
          category: "survival",
          amountPerPerson: 1,
          weight: 1,
          goods: [
            { goodId: "good:cheap-taboo", weight: 1, taboo: true },
            { goodId: "good:preferred", weight: 1, obsessionMultiplier: 10 },
            { goodId: "good:plain", weight: 1 },
          ],
        },
      ],
      getGoodPrice: (goodId) => (goodId === "good:plain" ? 1 : 2),
      getAvailableGoodAmount: () => 100,
      purchaseGood: (goodId: string, requestedPhysicalAmount: number, wallet: number) => {
        purchased.push(goodId);
        return {
          purchasedPhysicalAmount: requestedPhysicalAmount,
          spent: requestedPhysicalAmount * (goodId === "good:plain" ? 1 : 2),
          wallet: wallet - requestedPhysicalAmount * (goodId === "good:plain" ? 1 : 2),
        };
      },
    });

    expect(purchased).toEqual(["good:preferred"]);
    expect(result.demandRequestedByGood["good:cheap-taboo"]).toBeUndefined();
    expect(result.demandRequestedByGood["good:preferred"]).toBe(10);
  });

  it("applies discrimination wage, radical, qualification, and political penalties during needs resolution", () => {
    const result = resolveRegionPopulationNeedsTurn({
      population: { pops: [makePop({ size: 100, cultureId: "culture:orcs", qualificationsByCategory: { labor: 10 } })] },
      demandByProfession: { "profession:workers": 100 },
      wagesByProfession: { "profession:workers": 100 },
      fallbackProfessionId: "profession:unemployed",
      acceptanceContext: {
        countryId: "country:a",
        acceptedCultureIds: new Set(["culture:elves"]),
        acceptedReligionIds: new Set<string>(),
        acceptedRaceIds: new Set<string>(),
        activeLawIds: new Set(["law:citizenship"]),
      },
      activeLaws: [{ id: "law:citizenship", discrimination: { wagePenaltyPct: 0.5, qualificationGrowthPenaltyPct: 0.5, politicalStrengthPenaltyPct: 0.5, radicalizationPerTurn: 1 } }],
      getNeedsForPop: () => [],
      getGoodPrice: () => 1,
      getAvailableGoodAmount: () => 100,
      purchaseGood: (_goodId: string, requestedPhysicalAmount: number, wallet: number) => ({
        purchasedPhysicalAmount: requestedPhysicalAmount,
        spent: requestedPhysicalAmount,
        wallet: wallet - requestedPhysicalAmount,
      }),
    });
    const pop = result.nextPopulation.pops.find((candidate) => candidate.professionId === "profession:workers");
    expect(pop?.lastIncomeDucats).toBe(50);
    expect(pop?.lastDiscriminationStatus).toBe("discriminated");
    expect(pop?.radicals).toBeGreaterThan(0);
    expect(pop?.politicalStrength).toBeLessThan(100);
  });

  it("updates ideology and reports changed regions without hidden population creation", () => {
    const current = { pops: [makePop({ standardOfLiving: 4, ideologies: { "ideology:default": 100 } })] };
    const result = resolvePopulationTurnForRegions({
      regionIds: ["region:a", "region:empty"],
      currentPopulationByRegion: { "region:a": current },
      nextPopulationByRegion: {},
      domains,
      ideologies: [
        { id: "ideology:liberal", ideologyAttractionRules: [{ id: "rule:sol_below", type: "sol_below", threshold: 8, weight: 1 }] },
        { id: "ideology:default", ideologyAttractionRules: [] },
      ],
      getIdeologyContext: () => ({ countryId: "country:a", activeLawIds: new Set(), activeModifierIds: new Set(), provinceBuildingIds: new Set() }),
    });

    expect(result.nextPopulationByRegion["region:empty"]).toEqual({ pops: [] });
    expect(result.changedRegionIds).toContain("region:a");
    expect(applyIdeologyAttractionToPopulation({
      population: current,
      ideologies: [{ id: "ideology:liberal", ideologyAttractionRules: [{ id: "rule:sol_below", type: "sol_below", threshold: 8, weight: 1 }] }, { id: "ideology:default" }],
      countryId: "country:a",
      activeLawIds: new Set(),
      activeModifierIds: new Set(),
      provinceBuildingIds: new Set(),
    }).pops[0]?.ideologies["ideology:liberal"]).toBeGreaterThan(0);
    expect(isEqualRegionPopulation(current, structuredClone(current))).toBe(true);
  });
});
