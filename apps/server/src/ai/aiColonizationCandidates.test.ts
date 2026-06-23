import { describe, expect, it } from "vitest";
import { buildAiCountryContext, buildAiWorldIndexes } from "./aiContext";
import {
  buildRegionAdjacencyByIdFromHexes,
  selectAiColonizationCandidates,
} from "./aiColonizationCandidates";
import { createAiFixtureWorld } from "./aiFixtureHarness";

describe("AI colonization candidates", () => {
  it("allows landless AI to select neutral enabled regions with deterministic cost ordering", () => {
    const world = createAiFixtureWorld({
      resourcesByCountry: {
        "country:landless": { culture: 0, science: 0, religion: 0, colonization: 10, construction: 0, ducats: 10, gold: 0 },
      },
      regionOwner: {},
      regionController: {},
      colonyProgressByRegion: {},
      regionColonizationByRegion: {},
    });
    const context = buildAiCountryContext({
      countryId: "country:landless",
      world,
      indexes: buildAiWorldIndexes(world),
    });

    const candidates = selectAiColonizationCandidates({
      context,
      world,
      regionIds: ["region:z", "region:a"],
      regionAdjacencyById: {},
      maxActiveColonizations: 2,
      getRegionColonizationConfig: (regionId) => ({ cost: regionId === "region:a" ? 5 : 8, disabled: false, manualCost: false }),
      getRegionDerivedColonizationCosts: (regionId) => ({
        pointsCost: regionId === "region:a" ? 5 : 8,
        ducatsCost: regionId === "region:a" ? 1 : 4,
      }),
    });

    expect(candidates.map((candidate) => candidate.regionId)).toEqual(["region:a", "region:z"]);
    expect(candidates[0]).toMatchObject({
      kind: "colonize-region",
      countryId: "country:landless",
      requiresValidatedPipeline: true,
      orderDraft: { type: "COLONIZE", regionId: "region:a", payload: {} },
    });
  });

  it("limits landed AI to neutral regions adjacent to owned or controlled regions", () => {
    const world = createAiFixtureWorld({
      regionOwner: { "region:home": "country:alpha" },
      regionController: { "region:home": "country:alpha" },
      resourcesByCountry: {
        "country:alpha": { culture: 0, science: 0, religion: 0, colonization: 10, construction: 0, ducats: 10, gold: 0 },
      },
      colonyProgressByRegion: {},
      regionColonizationByRegion: {},
    });
    const context = buildAiCountryContext({
      countryId: "country:alpha",
      world,
      indexes: buildAiWorldIndexes(world),
    });

    const candidates = selectAiColonizationCandidates({
      context,
      world,
      regionIds: ["region:near", "region:far"],
      regionAdjacencyById: { "region:home": ["region:near"] },
      maxActiveColonizations: 2,
      getRegionColonizationConfig: () => ({ cost: 5, disabled: false, manualCost: false }),
      getRegionDerivedColonizationCosts: () => ({ pointsCost: 5, ducatsCost: 0 }),
    });

    expect(candidates.map((candidate) => candidate.regionId)).toEqual(["region:near"]);
    expect(candidates[0]?.isAdjacentToControlledRegion).toBe(true);
  });

  it("filters owned, disabled, already progressing, active, queued, capped, and resource-poor targets", () => {
    const baseWorld = createAiFixtureWorld({
      regionOwner: {
        "region:home": "country:alpha",
        "region:owned": "country:beta",
      },
      regionController: { "region:home": "country:alpha" },
      resourcesByCountry: {
        "country:alpha": { culture: 0, science: 0, religion: 0, colonization: 10, construction: 0, ducats: 10, gold: 0 },
      },
      colonyProgressByRegion: { "region:progress": { "country:alpha": 1 } },
      regionColonizationByRegion: {},
    });
    const context = buildAiCountryContext({
      countryId: "country:alpha",
      world: baseWorld,
      indexes: buildAiWorldIndexes(baseWorld),
    });
    const regionIds = ["region:owned", "region:disabled", "region:progress", "region:active", "region:queued", "region:ok"];
    const params = {
      context,
      world: baseWorld,
      regionIds,
      regionAdjacencyById: { "region:home": regionIds },
      maxActiveColonizations: 3,
      activeColonizeRegionIds: ["region:active"],
      queuedColonizeRegionIds: ["region:queued"],
      getRegionColonizationConfig: (regionId: string) => ({
        cost: 5,
        disabled: regionId === "region:disabled",
        manualCost: false,
      }),
      getRegionDerivedColonizationCosts: () => ({ pointsCost: 5, ducatsCost: 0 }),
    };

    expect(selectAiColonizationCandidates(params).map((candidate) => candidate.regionId)).toEqual(["region:ok"]);
    expect(selectAiColonizationCandidates({ ...params, activeColonizeRegionIds: ["region:a", "region:b", "region:c"] })).toEqual([]);
    expect(
      selectAiColonizationCandidates({
        ...params,
        context: { ...context, resources: { ...context.resources, colonization: 0 } },
      }),
    ).toEqual([]);
    expect(
      selectAiColonizationCandidates({
        ...params,
        context: { ...context, resources: { ...context.resources, ducats: 0 } },
        getRegionDerivedColonizationCosts: () => ({ pointsCost: 5, ducatsCost: 5 }),
      }),
    ).toEqual([]);
  });

  it("builds deterministic region adjacency from province neighbors", () => {
    expect(
      buildRegionAdjacencyByIdFromHexes([
        { id: "a1", regionId: "region:a", neighbors: ["a2", "b1"] },
        { id: "a2", regionId: "region:a", neighbors: ["a1"] },
        { id: "b1", regionId: "region:b", neighbors: ["a1", "c1"] },
        { id: "c1", regionId: "region:c", neighbors: ["b1"] },
        { id: "x", regionId: null, neighbors: ["a1"] },
      ]),
    ).toEqual({
      "region:a": ["region:b"],
      "region:b": ["region:a", "region:c"],
      "region:c": ["region:b"],
    });
  });
});
