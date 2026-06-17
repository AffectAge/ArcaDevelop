import type { Order, RegionPopulation } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  cleanupRegionColonizationProgress,
  getRegionColonizationConfig,
  getRegionDerivedColonizationCosts,
  normalizeRegionColonizationCosts,
  normalizeRegionManualCostFlags,
  normalizeRegionColonizationMap,
  rebuildActiveColonizationIndexFromWorldBase,
  recalculateAllRegionColonizationCosts,
  resolveColonizationCapturesTurn,
  resolveColonizationSupportTurn,
  resolveColonizeOrder,
  type ColonizationTurnWorldState,
  type RegionColonizationWorldState,
} from "./colonizationMechanics";
import { addOrderToTurnIndexes, type TurnOrderIndexes } from "./turnOrderIndexMechanics";

describe("colonizationMechanics", () => {
  it("calculates province colonization costs from area and rates", () => {
    expect(
      getRegionDerivedColonizationCosts({
        regionId: "region:a",
        getRegionAreaKm2: () => 2_500,
        rates: { pointsCostPer1000Km2: 10, ducatsCostPer1000Km2: 3 },
      }),
    ).toEqual({ pointsCost: 25, ducatsCost: 8 });
  });

  it("normalizes config and migrates default costs to derived auto costs", () => {
    const worldBase = makeWorld({
      regionColonizationByRegion: {
        "region:a": { cost: 100, disabled: false },
        "region:b": { cost: 45, disabled: false, manualCost: true },
      },
    });

    const migrated = normalizeRegionColonizationCosts({
      worldBase,
      getRegionDerivedColonizationCosts: () => ({ pointsCost: 33, ducatsCost: 0 }),
    });

    expect(migrated).toBe(1);
    expect(worldBase.regionColonizationByRegion["region:a"]).toEqual({
      cost: 33,
      disabled: false,
      manualCost: false,
    });
    expect(
      getRegionColonizationConfig({
        regionId: "region:b",
        worldBase,
        getRegionDerivedColonizationCosts: () => ({ pointsCost: 33, ducatsCost: 0 }),
      }),
    ).toEqual({ cost: 45, disabled: false, manualCost: true });
  });

  it("preserves manual costs during formula recalculation and updates auto costs", () => {
    const worldBase = makeWorld({
      regionColonizationByRegion: {
        "region:auto": { cost: 10, disabled: false, manualCost: false },
        "region:manual": { cost: 25, disabled: false, manualCost: true },
      },
    });

    const updated = recalculateAllRegionColonizationCosts({
      regionIds: ["region:auto", "region:manual"],
      worldBase,
      getRegionDerivedColonizationCosts: (provinceId, rates) => ({
        pointsCost: provinceId === "region:auto" ? (rates ? 10 : 20) : 30,
        ducatsCost: 0,
      }),
      previousRates: { pointsCostPer1000Km2: 1, ducatsCostPer1000Km2: 0 },
    });

    expect(updated).toBe(1);
    expect(worldBase.regionColonizationByRegion["region:auto"]).toEqual({
      cost: 20,
      disabled: false,
      manualCost: false,
    });
    expect(worldBase.regionColonizationByRegion["region:manual"]).toEqual({
      cost: 25,
      disabled: false,
      manualCost: true,
    });
  });

  it("normalizes raw colonization map and migrates missing manual flags", () => {
    const normalized = normalizeRegionColonizationMap({
      "region:a": { cost: 12.9, disabled: true, manualCost: false },
      "region:b": { cost: "bad", disabled: false },
    });
    expect(normalized).toEqual({
      "region:a": { cost: 12, disabled: true, manualCost: false },
      "region:b": { cost: 100, disabled: false, manualCost: undefined },
    });

    const worldBase = makeWorld({ regionColonizationByRegion: normalized });
    const migrated = normalizeRegionManualCostFlags({
      worldBase,
      getRegionDerivedColonizationCosts: () => ({ pointsCost: 80, ducatsCost: 0 }),
    });
    expect(migrated).toBe(1);
    expect(worldBase.regionColonizationByRegion["region:b"]?.manualCost).toBe(false);
  });

  it("rebuilds active colonization index and skips owned or disabled provinces", () => {
    const activeIndex = new Map<string, Set<string>>();
    const worldBase = makeWorld({
      regionOwner: { "region:owned": "country:z" },
      colonyProgressByRegion: {
        "region:a": { "country:a": 50 },
        "region:owned": { "country:a": 20 },
        "region:disabled": { "country:b": 10 },
      },
    });

    rebuildActiveColonizationIndexFromWorldBase({
      activeColonizeRegionsByCountry: activeIndex,
      worldBase,
      getRegionColonizationConfig: (provinceId) => ({
        cost: 10,
        disabled: provinceId === "region:disabled",
        manualCost: false,
      }),
    });

    expect(activeIndex).toEqual(new Map([["country:a", new Set(["region:a"])]]));
  });

  it("cleans province colonization progress, active index, and matching current-turn orders", () => {
    const activeIndex = new Map([["country:a", new Set(["region:a", "region:b"])]]);
    const indexes = makeIndexes();
    const colonizeOrder = makeOrder({ id: "colonize", regionId: "region:a" });
    const buildOrder: Extract<Order, { type: "BUILD" }> = {
      id: "build",
      turnId: 3,
      playerId: "player:a",
      countryId: "country:a",
      regionId: "region:a",
      type: "BUILD",
      payload: {},
      createdAt: "now",
    };
    addOrderToTurnIndexes(indexes, colonizeOrder);
    addOrderToTurnIndexes(indexes, buildOrder);
    const ordersByTurn = new Map([[3, new Map([["player:a", [colonizeOrder, buildOrder]]])]]);
    const worldBase = makeWorld({
      colonyProgressByRegion: { "region:a": { "country:a": 25 } },
    });

    cleanupRegionColonizationProgress({
      regionId: "region:a",
      turnId: 3,
      worldBase,
      activeColonizeRegionsByCountry: activeIndex,
      ordersByTurn,
      turnOrderIndexes: indexes,
    });

    expect(worldBase.colonyProgressByRegion["region:a"]).toBeUndefined();
    expect(activeIndex.get("country:a")).toEqual(new Set(["region:b"]));
    expect(ordersByTurn.get(3)?.get("player:a")).toEqual([buildOrder]);
    expect(indexes.queuedColonizeRegionsByCountryByTurn.has(3)).toBe(false);
    expect(indexes.queuedBuildRegionsByCountryByTurn.get(3)?.get("country:a")).toEqual(new Set(["region:a"]));
  });

  it("resolves colonization support with point split, ducat cap, and active index updates", () => {
    const worldBase = makeTurnWorld({
      resourcesByCountry: {
        "country:a": makeResources({ colonization: 30, ducats: 9 }),
      },
    });
    const activeIndex = new Map<string, Set<string>>();
    const touchedRegionIds = new Set<string>(["region:existing"]);

    resolveColonizationSupportTurn({
      colonizeTargetsByCountry: new Map([["country:a", new Set(["region:a", "region:b"])]]),
      worldBase,
      defaultColonizationPointsPerTurn: 10,
      touchedRegionIds,
      activeColonizeRegionsByCountry: activeIndex,
      getRegionColonizationConfig: () => ({ cost: 20, disabled: false, manualCost: false }),
      getRegionDerivedColonizationCosts: () => ({ pointsCost: 20, ducatsCost: 12 }),
    });

    expect(worldBase.colonyProgressByRegion).toEqual({
      "region:a": { "country:a": 15 },
    });
    expect(worldBase.resourcesByCountry["country:a"]).toMatchObject({ colonization: 15, ducats: 0 });
    expect(activeIndex).toEqual(new Map([["country:a", new Set(["region:a"])]]));
    expect(touchedRegionIds).toEqual(new Set(["region:existing", "region:a"]));
  });

  it("resolves colonize orders into target sets and rejects invalid provinces", () => {
    const worldBase = makeTurnWorld({ regionOwner: { "region:owned": "country:z" } });
    const targets = new Map<string, Set<string>>();
    const touched = new Set<string>();

    expect(
      resolveColonizeOrder({
        order: makeOrder({ id: "order:a", regionId: "region:a" }),
        playerId: "player:a",
        worldBase,
        colonizeTargetsByCountry: targets,
        touchedRegionIds: touched,
        getRegionColonizationConfig: () => ({ cost: 20, disabled: false, manualCost: false }),
      }),
    ).toEqual({ rejectedOrder: null, accepted: true });
    expect(targets).toEqual(new Map([["country:a", new Set(["region:a"])]]));
    expect(touched).toEqual(new Set(["region:a"]));

    expect(
      resolveColonizeOrder({
        order: makeOrder({ id: "order:owned", regionId: "region:owned" }),
        playerId: "player:a",
        worldBase,
        colonizeTargetsByCountry: targets,
        touchedRegionIds: touched,
        getRegionColonizationConfig: () => ({ cost: 20, disabled: false, manualCost: false }),
      }).rejectedOrder,
    ).toEqual({ playerId: "player:a", reason: "REGION_NOT_NEUTRAL", tempOrderId: "order:owned" });

    expect(
      resolveColonizeOrder({
        order: makeOrder({ id: "order:disabled", regionId: "region:disabled" }),
        playerId: "player:a",
        worldBase,
        colonizeTargetsByCountry: targets,
        touchedRegionIds: touched,
        getRegionColonizationConfig: () => ({ cost: 20, disabled: true, manualCost: false }),
      }).rejectedOrder,
    ).toEqual({ playerId: "player:a", reason: "REGION_NOT_NEUTRAL", tempOrderId: "order:disabled" });
  });

  it("resolves colonization captures, tie-breaks deterministically, and cleans inactive progress", () => {
    const worldBase = makeTurnWorld({
      regionOwner: { "region:owned": "country:z" },
      colonyProgressByRegion: {
        "region:a": { "country:b": 20, "country:a": 20 },
        "region:owned": { "country:a": 20 },
        "region:disabled": { "country:a": 20 },
      },
    });
    const activeIndex = new Map([
      ["country:a", new Set(["region:a", "region:owned", "region:disabled"])],
      ["country:b", new Set(["region:a"])],
    ]);

    const captures = resolveColonizationCapturesTurn({
      touchedRegionIds: new Set(["region:a", "region:owned", "region:disabled"]),
      worldBase,
      activeColonizeRegionsByCountry: activeIndex,
      getRegionColonizationConfig: (provinceId) => ({
        cost: 20,
        disabled: provinceId === "region:disabled",
        manualCost: false,
      }),
      settlementEnabled: true,
      settlementPopulationOnCapture: 1_000,
      buildSettlementPopulation: makeSettlementPopulation,
    });

    expect(captures).toEqual([
      { regionId: "region:a", winnerCountryId: "country:a", previousOwnerId: null, settlementCreated: true },
    ]);
    expect(worldBase.regionOwner["region:a"]).toBe("country:a");
    expect(worldBase.regionController["region:a"]).toBe("country:a");
    expect(worldBase.regionPopulationByRegion["region:a"]?.pops[0]?.size).toBe(1_000);
    expect(worldBase.colonyProgressByRegion).toEqual({});
    expect(activeIndex.size).toBe(0);
  });

  it("does not add settlement population when captured region already has people", () => {
    const existingPopulation = makeSettlementPopulation("region:a", "country:old", 25);
    const worldBase = makeTurnWorld({
      colonyProgressByRegion: { "region:a": { "country:a": 20 } },
      regionPopulationByRegion: { "region:a": existingPopulation },
    });

    const captures = resolveColonizationCapturesTurn({
      touchedRegionIds: new Set(["region:a"]),
      worldBase,
      activeColonizeRegionsByCountry: new Map([["country:a", new Set(["region:a"])]]),
      getRegionColonizationConfig: () => ({ cost: 20, disabled: false, manualCost: false }),
      settlementEnabled: true,
      settlementPopulationOnCapture: 1_000,
      buildSettlementPopulation: makeSettlementPopulation,
    });

    expect(captures).toEqual([
      { regionId: "region:a", winnerCountryId: "country:a", previousOwnerId: null, settlementCreated: false },
    ]);
    expect(worldBase.regionPopulationByRegion["region:a"]).toBe(existingPopulation);
  });

  it("does not add settlement population when settlement define is disabled or zero", () => {
    const disabledWorld = makeTurnWorld({ colonyProgressByRegion: { "region:a": { "country:a": 20 } } });
    resolveColonizationCapturesTurn({
      touchedRegionIds: new Set(["region:a"]),
      worldBase: disabledWorld,
      activeColonizeRegionsByCountry: new Map(),
      getRegionColonizationConfig: () => ({ cost: 20, disabled: false, manualCost: false }),
      settlementEnabled: false,
      settlementPopulationOnCapture: 1_000,
      buildSettlementPopulation: makeSettlementPopulation,
    });

    const zeroWorld = makeTurnWorld({ colonyProgressByRegion: { "region:b": { "country:a": 20 } } });
    resolveColonizationCapturesTurn({
      touchedRegionIds: new Set(["region:b"]),
      worldBase: zeroWorld,
      activeColonizeRegionsByCountry: new Map(),
      getRegionColonizationConfig: () => ({ cost: 20, disabled: false, manualCost: false }),
      settlementEnabled: true,
      settlementPopulationOnCapture: 0,
      buildSettlementPopulation: makeSettlementPopulation,
    });

    expect(disabledWorld.regionPopulationByRegion["region:a"]).toBeUndefined();
    expect(zeroWorld.regionPopulationByRegion["region:b"]).toBeUndefined();
  });
});

function makeWorld(overrides?: Partial<RegionColonizationWorldState>): RegionColonizationWorldState {
  return {
    regionColonizationByRegion: {},
    colonyProgressByRegion: {},
    regionOwner: {},
    regionController: {},
    ...overrides,
  } as RegionColonizationWorldState;
}

function makeTurnWorld(overrides?: Partial<ColonizationTurnWorldState>): ColonizationTurnWorldState {
  return {
    colonyProgressByRegion: {},
    regionOwner: {},
    regionController: {},
    resourcesByCountry: {},
    regionPopulationByRegion: {},
    ...overrides,
  } as ColonizationTurnWorldState;
}

function makeResources(overrides?: Partial<ColonizationTurnWorldState["resourcesByCountry"][string]>): ColonizationTurnWorldState["resourcesByCountry"][string] {
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

function makeIndexes(): TurnOrderIndexes {
  return {
    queuedColonizeRegionsByCountryByTurn: new Map(),
    queuedBuildRegionsByCountryByTurn: new Map(),
  };
}

function makeOrder(overrides?: Omit<Partial<Extract<Order, { type: "COLONIZE" }>>, "type">): Extract<Order, { type: "COLONIZE" }> {
  return {
    id: "order:a",
    turnId: 3,
    playerId: "player:a",
    countryId: "country:a",
    regionId: "region:a",
    type: "COLONIZE",
    payload: {},
    createdAt: "now",
    ...overrides,
  };
}

function makeSettlementPopulation(regionId: string, countryId: string, total: number): RegionPopulation {
  return {
    pops: [
      {
        id: `pop:${regionId}:settlers:${countryId}`,
        size: total,
        cultureId: "culture:default",
        religionId: "religion:default",
        raceId: "race:default",
        ideologies: { "ideology:default": total },
        professions: {
          "profession:default": {
            size: total,
            ducats: 0,
            standardOfLiving: 10,
            radicals: 0,
            loyalists: 0,
            lastIncomeDucats: 0,
            lastNeedsSpendDucats: 0,
            lastNeedsSatisfaction: 1,
            lastBirths: 0,
            lastDeaths: 0,
          },
        },
      },
    ],
  };
}
