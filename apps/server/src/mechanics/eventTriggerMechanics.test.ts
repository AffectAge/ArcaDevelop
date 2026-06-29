import { describe, expect, it } from "vitest";
import { evaluateEventTrigger } from "./eventTriggerMechanics";

describe("eventTriggerMechanics", () => {
  it("evaluates country resource triggers with explanations", () => {
    const result = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase({ resourcesByCountry: { "country:a": makeResources({ ducats: 25 }) } }),
      trigger: { type: "country_resource_above", resource: "ducats", value: 10 },
    });

    expect(result.passed).toBe(true);
    expect(result.explanations).toEqual([
      expect.objectContaining({
        triggerId: "country_resource_above",
        passed: true,
        value: 25,
        threshold: 10,
        labelKey: "event.trigger.countryResourceAbove",
      }),
    ]);
  });

  it("evaluates country trigger aliases through existing condition checks", () => {
    const result = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase(),
      trigger: { type: "country_lacks_law", targetId: "law:tax" },
      conditionsMatchCountry: (conditions) => conditions?.[0]?.type === "law_active" && conditions[0].invert === true,
    });

    expect(result.passed).toBe(true);
    expect(result.explanations[0]).toMatchObject({
      triggerId: "country_lacks_law",
      value: "law:tax",
    });
  });

  it("evaluates country modifier triggers through active modifier checks", () => {
    const active = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase(),
      trigger: { type: "country_has_modifier", targetId: "modifier:industrial_program" },
      countryHasModifier: (_countryId, modifierId) => modifierId === "modifier:industrial_program",
    });
    const inverted = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase(),
      trigger: { type: "country_has_modifier", targetId: "modifier:industrial_program", invert: true },
      countryHasModifier: (_countryId, modifierId) => modifierId === "modifier:industrial_program",
    });

    expect(active.passed).toBe(true);
    expect(active.explanations[0]).toMatchObject({
      triggerId: "country_has_modifier",
      labelKey: "event.trigger.countryHasModifier",
      value: "modifier:industrial_program",
    });
    expect(inverted.passed).toBe(false);
  });

  it("evaluates treasury and region population aliases", () => {
    const treasury = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase({ resourcesByCountry: { "country:a": makeResources({ ducats: 3 }) } }),
      trigger: { type: "treasury_below", value: 10 },
    });
    const region = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase({
        regionPopulationByRegion: {
          "region:one": {
            pops: [{ id: "pop:one", size: 1200, cultureId: "culture:a", religionId: "religion:a", raceId: "race:a", ideologies: {}, professions: {} }],
          },
        },
      }),
      scopes: { region: { kind: "region", id: "region:one" } },
      trigger: { type: "region_has_population_above", value: 1000 },
    });

    expect(treasury.passed).toBe(true);
    expect(region.passed).toBe(true);
    expect(region.explanations[0]?.triggerId).toBe("region_has_population_above");
  });

  it("evaluates scoped region predicates", () => {
    const result = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase({
        regionController: { "region:one": "country:a" },
        regionPopulationByRegion: {
          "region:one": {
            pops: [{ id: "pop:one", size: 1200, cultureId: "culture:a", religionId: "religion:a", raceId: "race:a", ideologies: {}, professions: {} }],
          },
        },
      }),
      scopes: { region: { kind: "region", id: "region:one" } },
      trigger: { type: "region_population_above", value: 1000 },
    });

    expect(result.passed).toBe(true);
    expect(result.explanations[0]).toMatchObject({
      triggerId: "region_population_above",
      value: 1200,
      threshold: 1000,
      affectedObject: { kind: "region", id: "region:one" },
    });
  });

  it("evaluates scoped region colonization progress predicates", () => {
    const result = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase({
        colonyProgressByRegion: {
          "region:frontier": {
            "country:a": 35,
            "country:b": 10,
          },
        },
      }),
      scopes: { region: { kind: "region", id: "region:frontier" } },
      trigger: { type: "region_colonization_progress_above", value: 40 },
    });

    expect(result.passed).toBe(true);
    expect(result.explanations[0]).toMatchObject({
      triggerId: "region_colonization_progress_above",
      value: 45,
      threshold: 40,
      labelKey: "event.trigger.regionColonizationProgressAbove",
      affectedObject: { kind: "region", id: "region:frontier" },
    });
  });

  it("evaluates scoped region resource deposit predicates", () => {
    const result = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase({
        regionResourceDepositsByRegion: {
          "region:iron": [
            {
              id: "resource_deposit:good_iron_hex_0_0",
              goodId: "good:iron",
              hexId: "hex:0:0",
              regionId: "region:iron",
              amount: 100,
              maxAmount: 100,
              initialAmount: 100,
              visibility: "known",
              source: "authored",
              depletionMode: "finite",
              discoveredTurnId: 1,
            },
          ],
        },
      }),
      scopes: { region: { kind: "region", id: "region:iron" } },
      trigger: { type: "region_has_resource_deposit", targetId: "good:iron" },
    });

    expect(result.passed).toBe(true);
    expect(result.explanations[0]).toMatchObject({
      triggerId: "region_has_resource_deposit",
      value: true,
      threshold: "good:iron",
      labelKey: "event.trigger.regionHasResourceDeposit",
      affectedObject: { kind: "region", id: "region:iron" },
    });
  });

  it("evaluates scoped region colonizable predicates", () => {
    const open = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase({
        regionColonizationByRegion: {
          "region:frontier": { cost: 20, disabled: false },
        },
      }),
      scopes: { region: { kind: "region", id: "region:frontier" } },
      trigger: { type: "region_is_colonizable" },
    });
    const owned = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase({
        regionOwner: { "region:frontier": "country:a" },
        regionColonizationByRegion: {
          "region:frontier": { cost: 20, disabled: false },
        },
      }),
      scopes: { region: { kind: "region", id: "region:frontier" } },
      trigger: { type: "region_is_colonizable" },
    });
    const disabled = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase({
        regionColonizationByRegion: {
          "region:frontier": { cost: 20, disabled: true },
        },
      }),
      scopes: { region: { kind: "region", id: "region:frontier" } },
      trigger: { type: "region_is_colonizable" },
    });

    expect(open.passed).toBe(true);
    expect(open.explanations[0]).toMatchObject({
      triggerId: "region_is_colonizable",
      value: true,
      threshold: true,
      labelKey: "event.trigger.regionIsColonizable",
      affectedObject: { kind: "region", id: "region:frontier" },
    });
    expect(owned.passed).toBe(false);
    expect(disabled.passed).toBe(false);
  });

  it("evaluates scoped region population stress predicates", () => {
    const worldBase = makeWorldBase({
      regionPopulationByRegion: {
        "region:unrest": {
          pops: [
            {
              id: "pop:one",
              size: 100,
              cultureId: "culture:a",
              religionId: "religion:a",
              raceId: "race:a",
              ideologies: {},
              professions: {
                workers: makeProfession({ size: 80, standardOfLiving: 8, radicals: 30, loyalists: 4 }),
                clerks: makeProfession({ size: 20, standardOfLiving: 14, radicals: 2, loyalists: 8 }),
              },
            },
          ],
        },
      },
    });
    const scopes = { region: { kind: "region" as const, id: "region:unrest" } };
    const radicals = evaluateEventTrigger({
      countryId: "country:a",
      worldBase,
      scopes,
      trigger: { type: "region_radicals_above", value: 25 },
    });
    const loyalists = evaluateEventTrigger({
      countryId: "country:a",
      worldBase,
      scopes,
      trigger: { type: "region_loyalists_above", value: 20 },
    });
    const sol = evaluateEventTrigger({
      countryId: "country:a",
      worldBase,
      scopes,
      trigger: { type: "region_standard_of_living_below", value: 10 },
    });

    expect(radicals.passed).toBe(true);
    expect(radicals.explanations[0]).toMatchObject({
      triggerId: "region_radicals_above",
      value: 32,
      threshold: 25,
      labelKey: "event.trigger.regionRadicalsAbove",
      affectedObject: { kind: "region", id: "region:unrest" },
    });
    expect(loyalists.passed).toBe(false);
    expect(loyalists.explanations[0]).toMatchObject({
      triggerId: "region_loyalists_above",
      value: 12,
      threshold: 20,
      labelKey: "event.trigger.regionLoyalistsAbove",
    });
    expect(sol.passed).toBe(true);
    expect(sol.explanations[0]).toMatchObject({
      triggerId: "region_standard_of_living_below",
      value: 9.2,
      threshold: 10,
      labelKey: "event.trigger.regionStandardOfLivingBelow",
    });
  });

  it("evaluates scoped region building economy predicates", () => {
    const worldBase = makeWorldBase({
      regionBuildingsByRegion: {
        "region:industry": [
          makeBuilding({ instanceId: "building:a", lastNetDucats: 4, lastLaborCoverage: 0.9, lastProductionByGoodId: { "good:tools": 12 } }),
          makeBuilding({ instanceId: "building:b", lastNetDucats: -3, lastLaborCoverage: 0.45, lastProductionByGoodId: { "good:tools": 4 } }),
        ],
      },
    });
    const scopes = { region: { kind: "region" as const, id: "region:industry" } };
    const profit = evaluateEventTrigger({
      countryId: "country:a",
      worldBase,
      scopes,
      trigger: { type: "building_profit_below", value: 0 },
    });
    const employment = evaluateEventTrigger({
      countryId: "country:a",
      worldBase,
      scopes,
      trigger: { type: "building_employment_below", value: 0.5 },
    });
    const output = evaluateEventTrigger({
      countryId: "country:a",
      worldBase,
      scopes,
      trigger: { type: "building_output_above", targetId: "good:tools", value: 10 },
    });

    expect(profit.passed).toBe(true);
    expect(profit.explanations[0]).toMatchObject({
      triggerId: "building_profit_below",
      value: -3,
      threshold: 0,
      labelKey: "event.trigger.buildingProfitBelow",
      affectedObject: { kind: "region", id: "region:industry" },
    });
    expect(employment.passed).toBe(true);
    expect(employment.explanations[0]).toMatchObject({
      triggerId: "building_employment_below",
      value: 0.45,
      threshold: 0.5,
      labelKey: "event.trigger.buildingEmploymentBelow",
    });
    expect(output.passed).toBe(true);
    expect(output.explanations[0]).toMatchObject({
      triggerId: "building_output_above",
      value: 12,
      threshold: 10,
      labelKey: "event.trigger.buildingOutputAbove",
    });
  });

  it("evaluates controlled foreign region predicates", () => {
    const occupied = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase({
        regionOwner: { "region:home": "country:a", "region:foreign": "country:b" },
        regionController: { "region:foreign": "country:a" },
      }),
      trigger: { type: "controls_foreign_region" },
    });
    const localOnly = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase({
        regionOwner: { "region:home": "country:a" },
        regionController: { "region:home": "country:a" },
      }),
      trigger: { type: "controls_foreign_region" },
    });

    expect(occupied.passed).toBe(true);
    expect(occupied.explanations[0]).toMatchObject({
      triggerId: "controls_foreign_region",
      value: "region:foreign",
      threshold: true,
      labelKey: "event.trigger.controlsForeignRegion",
      affectedObject: { kind: "country", id: "country:a" },
    });
    expect(localOnly.passed).toBe(false);
  });

  it("evaluates negative resource flow predicates from the latest ledger turn", () => {
    const result = evaluateEventTrigger({
      countryId: "country:a",
      worldBase: makeWorldBase({
        resourceLedgerByTurn: {
          1: [makeFlow({ direction: "income", amount: 100 })],
          2: [
            makeFlow({ direction: "income", amount: 5 }),
            makeFlow({ direction: "expense", amount: 12 }),
            makeFlow({ countryId: "country:b", direction: "expense", amount: 100 }),
          ],
        },
      }),
      trigger: { type: "resource_flow_negative", resource: "ducats" },
    });

    expect(result.passed).toBe(true);
    expect(result.explanations[0]).toMatchObject({
      triggerId: "resource_flow_negative",
      value: -7,
      threshold: 0,
      labelKey: "event.trigger.resourceFlowNegative",
      affectedObject: { kind: "country", id: "country:a" },
    });
  });
});

function makeResources(overrides = {}) {
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

function makeProfession(overrides = {}) {
  return {
    size: 0,
    ducats: 0,
    standardOfLiving: 0,
    radicals: 0,
    loyalists: 0,
    lastIncomeDucats: 0,
    lastNeedsSpendDucats: 0,
    lastNeedsSatisfaction: 0,
    lastBirths: 0,
    lastDeaths: 0,
    ...overrides,
  };
}

function makeBuilding(overrides = {}) {
  return {
    instanceId: "building:instance",
    buildingId: "building:factory",
    owner: { type: "state" as const, countryId: "country:a" },
    createdTurnId: 1,
    ...overrides,
  };
}

function makeFlow(overrides = {}) {
  return {
    id: "flow:test",
    turnId: 1,
    countryId: "country:a",
    resourceId: "ducats" as const,
    direction: "income" as const,
    amount: 1,
    sourceType: "system" as const,
    sourceId: "system:test",
    categoryId: "test",
    labelKey: "resourceLedger.source.generic",
    ...overrides,
  };
}

function makeWorldBase(overrides = {}) {
  return {
    resourcesByCountry: { "country:a": makeResources() },
    resourceLedgerByTurn: {},
    regionOwner: {},
    regionController: {},
    regionColonizationByRegion: {},
    colonyProgressByRegion: {},
    regionResourceDepositsByRegion: {},
    regionPopulationByRegion: {},
    regionBuildingsByRegion: {},
    ...overrides,
  };
}
