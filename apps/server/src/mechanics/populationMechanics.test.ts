import type { PopulationProfessionState } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  buildDefaultRegionPopulation,
  buildRegionPopulationFromBreakdowns,
  buildRandomRegionPopulation,
  buildRedistributedProfessionStateMap,
  buildSinglePopRegionPopulation,
  applyIdeologyAttractionToPopulation,
  applyNeedsStructureToTargetSoL,
  buildNextProfessionsByPopId,
  calculateAvailableProfessionPopulation,
  calculateLaborCoverage,
  calculateProfessionTotalsByPopId,
  calculateWageMultipliers,
  calculateWorkforceDemand,
  evaluateIdeologyAttractionRule,
  getBirthDeathRatesBySoL,
  getActiveCultureNeeds,
  getPopProfessionMetrics,
  getPopulationTotal,
  getTargetStandardOfLiving,
  isEqualRegionPopulation,
  makePopulationProfessionState,
  normalizeCultureNeedsProfile,
  normalizePercentageMap,
  normalizePopulationCountMap,
  normalizePopulationPops,
  normalizeProfessionStateMap,
  normalizeRegionPopulation,
  normalizeRegionPopulationMap,
  resolvePopulationTurnForRegion,
  resolvePopulationFallbackKeys,
  resolvePopulationProfessionNeedsTurn,
  resolvePopulationTurnForRegions,
  resolveRegionPopulationNeedsTurn,
  sortCultureNeedsByPriority,
  type PopulationDimensionKey,
  type PopulationDomainKeys,
} from "./populationMechanics";

const domains: PopulationDomainKeys = {
  culturePct: ["culture:elves", "culture:default"],
  ideologyPct: ["ideology:liberal", "ideology:default"],
  religionPct: ["religion:sun", "religion:default"],
  racePct: ["race:human", "race:default"],
  professionPct: ["profession:workers", "profession:default"],
};

const fallbackByDimension: Record<PopulationDimensionKey, string> = {
  culturePct: "culture:default",
  ideologyPct: "ideology:default",
  religionPct: "religion:default",
  racePct: "race:human",
  professionPct: "profession:default",
};

describe("populationMechanics", () => {
  it("normalizes, filters, and sorts culture needs by standard of living priority", () => {
    const profile = normalizeCultureNeedsProfile({
      tiers: [
        {
          id: "comfort",
          minStandardOfLiving: 10,
          needs: [
            { id: "luxury", label: "Luxury", category: "luxury", amountPerPerson: 1, weight: 2, goods: [{ goodId: "good:wine", weight: 1 }] },
          ],
        },
        {
          id: "basic",
          minStandardOfLiving: 0,
          needs: [
            { id: "food", label: "Food", category: "survival", amountPerPerson: 2.1234567, weight: 1, goods: [{ goodId: "good:grain", weight: 1.2345 }] },
            { id: "clothes", label: "Clothes", category: "basic", amountPerPerson: 1, weight: 3, goods: [{ goodId: "good:cloth", weight: 1 }] },
          ],
        },
      ],
    });

    expect(profile?.tiers.map((tier) => tier.id)).toEqual(["basic", "comfort"]);
    expect(profile?.tiers[0]?.needs[0]?.amountPerPerson).toBe(2.123457);
    expect(profile?.tiers[0]?.needs[0]?.goods[0]?.weight).toBe(1.234);

    const activeNeeds = getActiveCultureNeeds(profile, 5);
    expect(activeNeeds.map((need) => need.id)).toEqual(["food", "clothes"]);
    expect(sortCultureNeedsByPriority([...activeNeeds].reverse()).map((need) => need.id)).toEqual(["food", "clothes"]);
  });

  it("resolves fallback keys from localized names and fallback IDs", () => {
    expect(
      resolvePopulationFallbackKeys({
        domains,
        content: {
          culturePct: [{ id: "culture:elves", name: "Без культуры" }, { id: "culture:default" }],
          ideologyPct: [{ id: "ideology:default" }],
          religionPct: [{ id: "religion:sun", name: "Атеизм" }, { id: "religion:default" }],
          racePct: [{ id: "race:human", name: "Люди" }],
          professionPct: [{ id: "profession:workers" }, { id: "profession:default" }],
        },
      }),
    ).toEqual({
      culturePct: "culture:elves",
      ideologyPct: "ideology:default",
      religionPct: "religion:sun",
      racePct: "race:human",
      professionPct: "profession:default",
    });
  });

  it("normalizes percentage and population count maps while preserving totals", () => {
    expect(normalizePercentageMap({ a: 2, b: 1, ignored: 99 }, ["a", "b"], "a")).toEqual({ a: 66.67, b: 33.33 });
    expect(normalizePopulationCountMap({ a: 2, b: 1 }, ["a", "b"], "a", 10)).toEqual({ a: 7, b: 3 });
    expect(normalizePopulationCountMap({}, ["a", "b"], "b", 10)).toEqual({ b: 10 });
  });

  it("normalizes profession states and preserves bounded historical fields", () => {
    expect(
      normalizeProfessionStateMap(
        {
          "profession:workers": {
            size: 7.9,
            ducats: 1.23456,
            standardOfLiving: 12.3456,
            radicals: 2.9,
            lastNeedsDeficitByGood: { grain: 1.23456, empty: 0 },
          },
        },
        domains.professionPct,
        fallbackByDimension.professionPct,
        10,
      ),
    ).toMatchObject({
      "profession:workers": {
        size: 10,
        ducats: 1.235,
        standardOfLiving: 12.346,
        radicals: 2,
        lastNeedsDeficitByGood: { grain: 1.235 },
      },
    });
  });

  it("redistributes profession state while carrying treasury and social metrics", () => {
    const previous: Record<string, PopulationProfessionState> = {
      old: makePopulationProfessionState(100, {
        ducats: 50,
        standardOfLiving: 10,
        lastNeedsSatisfaction: 0.75,
        radicals: 10,
        loyalists: 20,
      }),
    };

    expect(buildRedistributedProfessionStateMap({ a: 30, b: 70 }, previous)).toMatchObject({
      a: { size: 30, ducats: 15, standardOfLiving: 10, lastNeedsSatisfaction: 0.75, radicals: 3, loyalists: 6 },
      b: { size: 70, ducats: 35, standardOfLiving: 10, lastNeedsSatisfaction: 0.75, radicals: 7, loyalists: 14 },
    });
  });

  it("normalizes pops with duplicate IDs and fallback dimensions", () => {
    const pops = normalizePopulationPops({
      rawPops: [
        { id: "pop:a", size: 6, cultureId: "bad", religionId: "religion:sun", raceId: "race:human", ideologies: { "ideology:liberal": 6 }, professions: { "profession:workers": 6 } },
        { id: "pop:a", size: 4, cultureId: "culture:elves", religionId: "bad", raceId: "bad", ideologies: {}, professions: {} },
      ],
      provinceId: "province:a",
      domains,
      fallbackByDimension,
    });

    expect(pops.map((pop) => pop.id)).toEqual(["pop:a", "pop:a:2"]);
    expect(getPopulationTotal({ pops })).toBe(10);
    expect(pops[0]).toMatchObject({ cultureId: "culture:default", religionId: "religion:sun" });
    expect(pops[1]).toMatchObject({ cultureId: "culture:elves", religionId: "religion:default", raceId: "race:human" });
  });

  it("builds province populations from authored breakdowns", () => {
    const population = buildRegionPopulationFromBreakdowns({
      provinceId: "province:a",
      total: 100,
      fallbackByDimension,
      maps: {
        culturePct: { "culture:elves": 50, "culture:default": 50 },
        ideologyPct: { "ideology:liberal": 100 },
        religionPct: { "religion:sun": 100 },
        racePct: { "race:human": 100 },
        professionPct: { "profession:workers": 100 },
      },
    });

    expect(population.pops).toHaveLength(2);
    expect(getPopulationTotal(population)).toBe(100);
    expect(population.pops[0]?.ideologies).toEqual({ "ideology:liberal": 50 });
  });

  it("normalizes province population from pops, populationTotal, or area-based default", () => {
    const getProvinceAreaKm2 = (provinceId: string) => (provinceId === "province:a" ? 2 : 1);
    expect(
      normalizeRegionPopulation({
        input: { populationTotal: 12 },
        provinceId: "province:a",
        domains,
        fallbackByDimension,
        getProvinceAreaKm2,
      }).pops[0]?.size,
    ).toBe(100);

    const fallback = buildDefaultRegionPopulation({ provinceId: "province:a", domains, fallbackByDimension, getProvinceAreaKm2 });
    expect(getPopulationTotal(fallback)).toBeGreaterThan(10000);
    expect(
      normalizeRegionPopulationMap({
        input: { "province:a": { populationTotal: 0 } },
        regionIds: ["province:a", "province:b"],
        domains,
        fallbackByDimension,
        getProvinceAreaKm2,
      }),
    ).toMatchObject({ "province:a": { pops: [] }, "province:b": expect.objectContaining({ pops: expect.any(Array) }) });
  });

  it("builds random province population with injectable random source and equality checks", () => {
    const population = buildRandomRegionPopulation({
      provinceId: "province:a",
      domains,
      fallbackByDimension,
      getProvinceAreaKm2: () => 1,
      populationTotalOverride: 20,
      random: () => 0.5,
    });
    const single = buildSinglePopRegionPopulation({ provinceId: "province:a", total: 20, fallbackByDimension });

    expect(getPopulationTotal(population)).toBe(20);
    expect(isEqualRegionPopulation(population, structuredClone(population))).toBe(true);
    expect(isEqualRegionPopulation(single, population)).toBe(false);
  });

  it("resolves population turn growth and provided profession redistribution", () => {
    const current = {
      pops: [
        {
          id: "pop:a",
          size: 100,
          cultureId: "culture:default",
          religionId: "religion:default",
          raceId: "race:human",
          ideologies: { "ideology:default": 100 },
          professions: { "profession:default": makePopulationProfessionState(100) },
        },
      ],
    };

    expect(resolvePopulationTurnForRegion({ currentPopulation: current }).pops[0]).toMatchObject({
      size: 100,
      ideologies: { "ideology:default": 100 },
    });
    expect(
      resolvePopulationTurnForRegion({
        currentPopulation: current,
        nextProfessionsByPopId: {
          "pop:a": {
            "profession:workers": makePopulationProfessionState(60),
            "profession:default": makePopulationProfessionState(40),
          },
        },
      }).pops[0],
    ).toMatchObject({ size: 100, ideologies: { "ideology:default": 100 } });
  });

  it("calculates profession metrics and ideology attraction rules", () => {
    const pop = {
      id: "pop:a",
      size: 100,
      cultureId: "culture:default",
      religionId: "religion:sun",
      raceId: "race:human",
      ideologies: { "ideology:default": 100 },
      professions: {
        "profession:workers": makePopulationProfessionState(75, { standardOfLiving: 6, radicals: 30 }),
        "profession:default": makePopulationProfessionState(25, { standardOfLiving: 10, loyalists: 10 }),
      },
    };
    const metrics = getPopProfessionMetrics(pop);

    expect(metrics).toMatchObject({
      averageSoL: 7,
      radicalPct: 30,
      loyalistPct: 10,
      professionShareById: { "profession:workers": 0.75, "profession:default": 0.25 },
    });
    expect(
      evaluateIdeologyAttractionRule({
        rule: { id: "rule:profession", type: "profession_is", targetId: "profession:workers", weight: 20 },
        pop,
        countryId: "country:a",
        activeLawIds: new Set(),
        activeModifierIds: new Set(),
        provinceBuildingIds: new Set(),
        metrics,
      }),
    ).toBe(15);
    expect(
      evaluateIdeologyAttractionRule({
        rule: { id: "rule:law", type: "law_active", targetId: "law:a", weight: 20 },
        pop,
        countryId: null,
        activeLawIds: new Set(["law:a"]),
        activeModifierIds: new Set(),
        provinceBuildingIds: new Set(),
        metrics,
      }),
    ).toBe(0);
  });

  it("applies ideology attraction using explicit active law, modifier, and building sets", () => {
    const population = {
      pops: [
        {
          id: "pop:a",
          size: 100,
          cultureId: "culture:default",
          religionId: "religion:sun",
          raceId: "race:human",
          ideologies: { "ideology:default": 100 },
          professions: { "profession:workers": makePopulationProfessionState(100, { standardOfLiving: 12 }) },
        },
      ],
    };

    const next = applyIdeologyAttractionToPopulation({
      population,
      countryId: "country:a",
      activeLawIds: new Set(["law:reform"]),
      activeModifierIds: new Set(["modifier:boom"]),
      provinceBuildingIds: new Set(["building:factory"]),
      attractionRate: 0.5,
      ideologies: [
        { id: "ideology:default", ideologyAttractionRules: [] },
        {
          id: "ideology:liberal",
          ideologyAttractionRules: [
            { id: "rule:law", type: "law_active", targetId: "law:reform", weight: 10 },
            { id: "rule:building", type: "has_building", targetId: "building:factory", weight: 10 },
          ],
        },
      ],
    });

    expect(next.pops[0]?.ideologies).toEqual({ "ideology:default": 50, "ideology:liberal": 50 });
  });

  it("calculates target SoL and birth/death rates from needs satisfaction", () => {
    expect(getTargetStandardOfLiving(0.4, 2)).toBe(8);
    expect(
      applyNeedsStructureToTargetSoL(12, {
        survival: { satisfaction: 0.5 },
        basic: { satisfaction: 0.7 },
        comfort: { satisfaction: 1 },
        luxury: { satisfaction: 1.5 },
      }),
    ).toBe(7.688);

    const bad = getBirthDeathRatesBySoL(4, 0.4, { survival: { satisfaction: 0.5 }, basic: { satisfaction: 0.6 } });
    const good = getBirthDeathRatesBySoL(20, 1.1, { survival: { satisfaction: 1 }, basic: { satisfaction: 1 } });
    expect(bad.deathRate).toBeGreaterThan(good.deathRate);
    expect(bad.birthRate).toBeGreaterThan(good.birthRate);
  });

  it("calculates workforce demand, labor coverage, and wage multipliers", () => {
    const demand = calculateWorkforceDemand([
      { level: 2, workforceRequirements: [{ professionId: "profession:workers", workers: 30 }] },
      { level: 1, workforceRequirements: [{ professionId: "profession:clerks", workers: 10 }, { professionId: "", workers: 99 }] },
    ]);

    expect(demand).toEqual({
      demandByProfession: { "profession:workers": 60, "profession:clerks": 10 },
      totalWorkforceDemand: 70,
    });
    expect(calculateLaborCoverage(35, demand.totalWorkforceDemand)).toBe(0.5);
    expect(
      calculateWageMultipliers({
        demandByProfession: demand.demandByProfession,
        availableByProfession: { "profession:workers": 30, "profession:clerks": 100 },
      }),
    ).toEqual({ "profession:workers": 1.5, "profession:clerks": 1 });
  });

  it("builds next profession maps and profession totals from employment", () => {
    const population = {
      pops: [
        {
          id: "pop:a",
          size: 60,
          cultureId: "culture:default",
          religionId: "religion:sun",
          raceId: "race:human",
          ideologies: { "ideology:default": 60 },
          professions: { "profession:default": makePopulationProfessionState(60, { ducats: 12 }) },
        },
        {
          id: "pop:b",
          size: 40,
          cultureId: "culture:default",
          religionId: "religion:sun",
          raceId: "race:human",
          ideologies: { "ideology:default": 40 },
          professions: { "profession:default": makePopulationProfessionState(40, { ducats: 8 }) },
        },
      ],
    };

    expect(calculateAvailableProfessionPopulation(population)).toEqual({ "profession:default": 100 });
    const byPopId = buildNextProfessionsByPopId({
      population,
      employedByProfession: { "profession:workers": 80 },
      professionIds: ["profession:workers", "profession:default"],
      fallbackProfessionId: "profession:default",
    });

    expect(byPopId["pop:a"]).toMatchObject({ "profession:workers": { size: 48 }, "profession:default": { size: 12 } });
    expect(byPopId["pop:b"]).toMatchObject({ "profession:workers": { size: 32 }, "profession:default": { size: 8 } });
    expect(calculateProfessionTotalsByPopId(byPopId)).toEqual({ "profession:workers": 80, "profession:default": 20 });
  });

  it("resolves profession needs consumption with demand, purchases, deficits, and SoL changes", () => {
    const state = makePopulationProfessionState(100, { ducats: 30, standardOfLiving: 8, radicals: 5, loyalists: 2 });
    const purchases: Array<{ goodId: string; requested: number; wallet: number }> = [];

    const result = resolvePopulationProfessionNeedsTurn({
      state,
      previous: state,
      needs: [
        {
          category: "survival",
          amountPerPerson: 0.1,
          weight: 1,
          goods: [{ goodId: "good:grain", weight: 1 }],
        },
        {
          category: "comfort",
          amountPerPerson: 0.05,
          weight: 1,
          goods: [{ goodId: "good:cloth", weight: 1 }],
        },
      ],
      income: 10,
      getGoodPrice: (goodId) => (goodId === "good:grain" ? 2 : 4),
      getAvailableGoodAmount: (goodId) => (goodId === "good:grain" ? 10 : 0),
      purchaseGood: (goodId, requestedPhysicalAmount, wallet) => {
        purchases.push({ goodId, requested: requestedPhysicalAmount, wallet });
        if (goodId !== "good:grain") return { purchasedPhysicalAmount: 0, spent: 0, wallet };
        const purchasedPhysicalAmount = Math.min(6, requestedPhysicalAmount);
        const spent = purchasedPhysicalAmount * 2;
        return { purchasedPhysicalAmount, spent, wallet: wallet - spent };
      },
    });

    expect(result.demandRequestedByGood).toEqual({ "good:grain": 14 });
    expect(purchases).toEqual([
      { goodId: "good:grain", requested: 10, wallet: 40 },
      { goodId: "good:grain", requested: 4, wallet: 28 },
    ]);
    expect(result.nextState).toMatchObject({
      size: 101,
      ducats: 20,
      standardOfLiving: 7.993,
      lastIncomeDucats: 10,
      lastNeedsSpendDucats: 20,
      lastNeedsSatisfaction: 0.706,
      lastNeedsDeficitByGood: { "good:grain": 4, "good:cloth": 5 },
      lastNeedsBudgetShortageByGood: {},
      lastBirths: 1,
      lastDeaths: 0,
    });
    expect(result.nextState.lastNeedsByCategory).toMatchObject({
      survival: { required: 10, fulfilled: 10, spend: 20, satisfaction: 1 },
      comfort: { required: 5, fulfilled: 0, spend: 0, satisfaction: 0 },
    });
  });

  it("resolves province population needs with profession income shares and aggregated demand", () => {
    const population = {
      pops: [
        {
          id: "pop:a",
          size: 100,
          cultureId: "culture:default",
          religionId: "religion:default",
          raceId: "race:human",
          ideologies: { "ideology:default": 100 },
          professions: {
            "profession:workers": makePopulationProfessionState(100, { ducats: 0, standardOfLiving: 8 }),
          },
        },
      ],
    };

    const result = resolveRegionPopulationNeedsTurn({
      population,
      employedByProfession: { "profession:workers": 50 },
      wagesByProfession: { "profession:workers": 20 },
      professionIds: ["profession:workers", "profession:default"],
      fallbackProfessionId: "profession:default",
      getNeedsForPop: () => [
        {
          category: "survival",
          amountPerPerson: 0.1,
          weight: 1,
          goods: [{ goodId: "good:grain", weight: 1 }],
        },
      ],
      getGoodPrice: () => 1,
      getAvailableGoodAmount: () => 100,
      purchaseGood: (_goodId, requestedPhysicalAmount, wallet) => ({
        purchasedPhysicalAmount: requestedPhysicalAmount,
        spent: requestedPhysicalAmount,
        wallet: wallet - requestedPhysicalAmount,
      }),
    });

    expect(Object.keys(result.nextProfessionsByPopId["pop:a"] ?? {})).toEqual(["profession:workers", "profession:default"]);
    expect(result.demandRequestedByGood).toEqual({ "good:grain": 5 });
    expect(result.nextProfessionsByPopId["pop:a"]?.["profession:workers"]).toMatchObject({
      size: 50,
      lastIncomeDucats: 20,
      lastNeedsSpendDucats: 5,
      ducats: 15,
    });
    expect(result.nextProfessionsByPopId["pop:a"]?.["profession:default"]).toMatchObject({
      size: 47,
      lastIncomeDucats: 0,
      lastNeedsSpendDucats: 0,
      lastNeedsBudgetShortageByGood: { "good:grain": 5 },
    });
  });

  it("resolves population turns for provinces with profession updates and ideology attraction", () => {
    const currentPopulation = buildSinglePopRegionPopulation({
      provinceId: "province:a",
      total: 100,
      fallbackByDimension,
    });
    currentPopulation.pops[0] = {
      ...currentPopulation.pops[0]!,
      cultureId: "culture:elves",
      ideologies: { "ideology:default": 100 },
      professions: {
        "profession:default": makePopulationProfessionState(100, { standardOfLiving: 4, radicals: 20 }),
      },
    };

    const result = resolvePopulationTurnForRegions({
      regionIds: ["province:a"],
      currentPopulationByRegion: { "province:a": currentPopulation },
      nextProfessionsByRegion: {
        "province:a": {
          [currentPopulation.pops[0]!.id]: {
            "profession:workers": makePopulationProfessionState(80, { standardOfLiving: 4, radicals: 20 }),
            "profession:default": makePopulationProfessionState(20, { standardOfLiving: 4, radicals: 5 }),
          },
        },
      },
      domains,
      fallbackByDimension,
      ideologies: [
        {
          id: "ideology:liberal",
          ideologyAttractionRules: [{ id: "rule:low-sol", type: "sol_below", threshold: 8, weight: 10 }],
        },
        { id: "ideology:default", ideologyAttractionRules: [] },
      ],
      getProvinceAreaKm2: () => 1,
      getIdeologyContext: () => ({
        countryId: "country:a",
        activeLawIds: new Set(),
        activeModifierIds: new Set(),
        provinceBuildingIds: new Set(),
      }),
    });

    expect(result.changedRegionIds).toEqual(["province:a"]);
    expect(result.nextPopulationByRegion["province:a"]?.pops[0]).toMatchObject({
      size: 100,
      ideologies: { "ideology:liberal": 2, "ideology:default": 98 },
    });
    expect(result.nextPopulationByRegion["province:a"]?.pops[0]?.professions).toMatchObject({
      "profession:workers": { size: 80 },
      "profession:default": { size: 20 },
    });
  });
});
