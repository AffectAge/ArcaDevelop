import type { CountryTechnologyState, ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  getAvailableActiveTechnologyIds,
  getTechnologyById,
  getUnlockingTechnologyForBuilding,
  getUnlockingTechnologyForLaw,
  isBuildingUnlockedForCountry,
  isLawUnlockedForCountry,
  isTechnologyAvailableForCountry,
  resolveTechnologyTurn,
  setActiveTechnologyState,
  type TechnologyContentEntry,
  type TechnologyWorldState,
} from "./technologyMechanics";

describe("technologyMechanics", () => {
  it("checks prerequisites and unlock technologies", () => {
    const state = makeState({ researchedTechnologyIds: ["technology:tools"] });
    const technologies = [
      makeTechnology({ id: "technology:tools" }),
      makeTechnology({
        id: "technology:steam",
        prerequisiteTechnologyIds: ["technology:tools"],
        unlockBuildingIds: ["building:factory"],
        unlockLawIds: ["law:industrial"],
      }),
    ];

    expect(isTechnologyAvailableForCountry(state, technologies[1])).toBe(true);
    expect(getUnlockingTechnologyForBuilding("building:factory", technologies)?.id).toBe("technology:steam");
    expect(getUnlockingTechnologyForLaw("law:industrial", technologies)?.id).toBe("technology:steam");
    expect(isBuildingUnlockedForCountry({ buildingId: "building:factory", state, technologies })).toBe(false);
    expect(isLawUnlockedForCountry({ lawId: "law:industrial", state, technologies })).toBe(false);
  });

  it("mutates active technology state through the shared mechanic", () => {
    const state = makeState({ researchedTechnologyIds: ["technology:tools"] });
    const technologies = [makeTechnology({ id: "technology:tools" }), makeTechnology({ id: "technology:steam", prerequisiteTechnologyIds: ["technology:tools"] })];

    expect(setActiveTechnologyState({ state, technologyId: "technology:missing", technologies })).toEqual({
      ok: false,
      error: "TECHNOLOGY_NOT_FOUND",
    });
    expect(setActiveTechnologyState({ state, technologyId: "technology:steam", technologies })).toEqual({ ok: true, state });
    expect(state.activeTechnologyIds).toEqual(["technology:steam"]);
    expect(setActiveTechnologyState({ state, technologyId: "technology:steam", active: false, technologies })).toEqual({ ok: true, state });
    expect(state.activeTechnologyIds).toEqual([]);
  });

  it("filters active technologies to available unresearchered entries", () => {
    const state = makeState({
      researchedTechnologyIds: ["technology:done"],
      activeTechnologyIds: ["technology:done", "technology:missing", "technology:blocked", "technology:ready"],
    });
    const technologyById = getTechnologyById([
      makeTechnology({ id: "technology:done" }),
      makeTechnology({ id: "technology:blocked", prerequisiteTechnologyIds: ["technology:prereq"] }),
      makeTechnology({ id: "technology:ready" }),
    ]);

    expect(getAvailableActiveTechnologyIds(state, technologyById)).toEqual(["technology:ready"]);
  });

  it("spends science across active technologies and reports completions", () => {
    const worldBase = makeWorld({
      resourcesByCountry: { "country:a": makeResources({ science: 250 }) },
      technologyByCountry: {
        "country:a": makeState({ activeTechnologyIds: ["technology:a", "technology:b"] }),
      },
    });
    const technologies = [
      makeTechnology({ id: "technology:a", name: "A", costScience: 100 }),
      makeTechnology({ id: "technology:b", name: "B", costScience: 200 }),
    ];

    const completions = resolveTechnologyTurn({
      worldBase,
      technologies,
      ensureCountryTechnologyState: (countryId) => worldBase.technologyByCountry[countryId] ?? makeState(),
      resolveTechnologyCost: (_countryId, technology) => Number(technology.costScience ?? 100),
    });

    expect(completions).toEqual([{ countryId: "country:a", technologyId: "technology:a", technologyName: "A" }]);
    expect(worldBase.resourcesByCountry["country:a"]?.science).toBe(0);
    expect(worldBase.technologyByCountry["country:a"]).toMatchObject({
      researchedTechnologyIds: ["technology:a"],
      activeTechnologyId: "technology:b",
      activeTechnologyIds: ["technology:b"],
      progressByTechnologyId: { "technology:a": 100, "technology:b": 150 },
      lastScienceSpent: 250,
      lastCompletedTechnologyIds: ["technology:a"],
    });
  });
});

function makeTechnology(overrides?: Partial<TechnologyContentEntry>): TechnologyContentEntry {
  return {
    id: "technology:test",
    name: "Technology",
    costScience: 100,
    prerequisiteTechnologyIds: [],
    unlockBuildingIds: [],
    unlockLawIds: [],
    ...overrides,
  };
}

function makeState(overrides?: Partial<CountryTechnologyState>): CountryTechnologyState {
  return {
    researchedTechnologyIds: [],
    activeTechnologyId: null,
    activeTechnologyIds: [],
    progressByTechnologyId: {},
    lastScienceSpent: 0,
    lastCompletedTechnologyIds: [],
    ...overrides,
  };
}

function makeWorld(overrides?: Partial<TechnologyWorldState>): TechnologyWorldState {
  return {
    resourcesByCountry: {},
    technologyByCountry: {},
    ...overrides,
  };
}

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
