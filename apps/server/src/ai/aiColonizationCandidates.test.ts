import { describe, expect, it } from "vitest";
import { buildAiCountryContext, buildAiWorldIndexes } from "./aiContext";
import {
  buildRegionAdjacencyByIdFromHexes,
  selectAiColonizationCandidates,
} from "./aiColonizationCandidates";
import { createAiFixtureWorld } from "./aiFixtureHarness";

describe("AI colonization candidates", () => {
  it("queues colonizers on controlled free hexes when no colonizer exists", () => {
    const world = createAiFixtureWorld({
      resourcesByCountry: {
        "country:alpha": { culture: 0, science: 0, religion: 0, colonization: 25, construction: 0, ducats: 20, gold: 0 },
      },
      regionOwner: { "region:home": "country:alpha" },
      regionController: { "region:home": "country:alpha" },
      civilianUnitsById: {},
      civilianUnitQueueByCountry: {},
    });
    const context = buildAiCountryContext({
      countryId: "country:alpha",
      world,
      indexes: buildAiWorldIndexes(world),
    });

    const candidates = selectAiColonizationCandidates({
      context,
      world,
      hexes: [makeHex("hex:1:1", "region:home", [])],
      regionIds: ["region:home"],
      regionAdjacencyById: {},
      colonizerQueueConfig: {
        colonizerTurns: 2,
        colonizerCostColonization: 20,
        colonizerCostDucats: 10,
        colonizerMovementPoints: 2,
      },
      getRegionColonizationConfig: () => ({ cost: 5, disabled: false, manualCost: false }),
      getRegionDerivedColonizationCosts: () => ({ pointsCost: 5, ducatsCost: 0 }),
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        kind: "queue-colonizer",
        countryId: "country:alpha",
        regionId: "region:home",
        targetHexId: "hex:1:1",
        actionDraft: { type: "QUEUE_COLONIZER", countryId: "country:alpha", hexId: "hex:1:1" },
      }),
    ]);
  });

  it("uses ready colonizers to found cities on valid neutral regions", () => {
    const world = createAiFixtureWorld({
      resourcesByCountry: {
        "country:alpha": { culture: 0, science: 0, religion: 0, colonization: 25, construction: 0, ducats: 20, gold: 0 },
      },
      regionOwner: { "region:home": "country:alpha" },
      regionController: { "region:home": "country:alpha" },
      civilianUnitsById: {
        "civilian:colonizer": {
          id: "civilian:colonizer",
          countryId: "country:alpha",
          type: "colonizer",
          hexId: "hex:2:1",
          status: "idle",
          movementPoints: 2,
          maxMovementPoints: 2,
          path: [],
          createdTurnId: 1,
          lastMovedTurnId: null,
        },
      },
      civilianUnitQueueByCountry: {},
      settlementProjectsById: {},
    });
    const context = buildAiCountryContext({
      countryId: "country:alpha",
      world,
      indexes: buildAiWorldIndexes(world),
    });

    const candidates = selectAiColonizationCandidates({
      context,
      world,
      hexes: [
        makeHex("hex:1:1", "region:home", ["hex:2:1"]),
        makeHex("hex:2:1", "region:frontier", ["hex:1:1"]),
      ],
      regionIds: ["region:home", "region:frontier"],
      regionAdjacencyById: { "region:home": ["region:frontier"] },
      colonizerQueueConfig: {
        colonizerTurns: 2,
        colonizerCostColonization: 20,
        colonizerCostDucats: 10,
        colonizerMovementPoints: 2,
      },
      getRegionColonizationConfig: () => ({ cost: 5, disabled: false, manualCost: false }),
      getRegionDerivedColonizationCosts: () => ({ pointsCost: 5, ducatsCost: 0 }),
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        kind: "found-city",
        countryId: "country:alpha",
        regionId: "region:frontier",
        targetHexId: "hex:2:1",
        civilianUnitId: "civilian:colonizer",
        orderDraft: {
          type: "FOUND_CITY",
          countryId: "country:alpha",
          civilianUnitId: "civilian:colonizer",
          name: "City region:frontier",
          regionId: "region:frontier",
          targetHexId: "hex:2:1",
          payload: { cultureId: "country:alpha" },
        },
      }),
    ]);
  });

  it("moves idle colonizers toward the nearest valid neutral settlement region", () => {
    const world = createAiFixtureWorld({
      resourcesByCountry: {
        "country:alpha": { culture: 0, science: 0, religion: 0, colonization: 25, construction: 0, ducats: 20, gold: 0 },
      },
      regionOwner: { "region:home": "country:alpha" },
      regionController: { "region:home": "country:alpha" },
      civilianUnitsById: {
        "civilian:colonizer": {
          id: "civilian:colonizer",
          countryId: "country:alpha",
          type: "colonizer",
          hexId: "hex:0:0",
          status: "idle",
          movementPoints: 2,
          maxMovementPoints: 2,
          path: [],
          targetHexId: null,
          createdTurnId: 1,
          lastMovedTurnId: null,
        },
      },
      civilianUnitQueueByCountry: {},
      settlementProjectsById: {},
    });
    const context = buildAiCountryContext({
      countryId: "country:alpha",
      world,
      indexes: buildAiWorldIndexes(world),
    });

    const candidates = selectAiColonizationCandidates({
      context,
      world,
      hexes: [
        makeHex("hex:0:0", "region:home", ["hex:1:0"]),
        makeHex("hex:1:0", "region:home", ["hex:0:0", "hex:2:0"]),
        makeHex("hex:2:0", "region:frontier", ["hex:1:0"]),
      ],
      regionIds: ["region:home", "region:frontier"],
      regionAdjacencyById: { "region:home": ["region:frontier"] },
      colonizerQueueConfig: {
        colonizerTurns: 2,
        colonizerCostColonization: 20,
        colonizerCostDucats: 10,
        colonizerMovementPoints: 2,
      },
      getRegionColonizationConfig: () => ({ cost: 5, disabled: false, manualCost: false }),
      getRegionDerivedColonizationCosts: () => ({ pointsCost: 5, ducatsCost: 0 }),
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        kind: "move-colonizer",
        countryId: "country:alpha",
        regionId: "region:frontier",
        targetHexId: "hex:2:0",
        civilianUnitId: "civilian:colonizer",
        path: ["hex:1:0", "hex:2:0"],
        orderDraft: {
          type: "UNIT_MOVE",
          countryId: "country:alpha",
          unitKind: "civilian",
          unitId: "civilian:colonizer",
          targetHexId: "hex:2:0",
          path: ["hex:1:0", "hex:2:0"],
          payload: { path: ["hex:1:0", "hex:2:0"] },
        },
      }),
    ]);
  });

  it("filters queue candidates when resources or free controlled hexes are missing", () => {
    const world = createAiFixtureWorld({
      resourcesByCountry: {
        "country:alpha": { culture: 0, science: 0, religion: 0, colonization: 5, construction: 0, ducats: 0, gold: 0 },
      },
      regionOwner: { "region:home": "country:alpha" },
      regionController: { "region:home": "country:alpha" },
    });
    const context = buildAiCountryContext({
      countryId: "country:alpha",
      world,
      indexes: buildAiWorldIndexes(world),
    });
    expect(
      selectAiColonizationCandidates({
        context,
        world,
        hexes: [makeHex("hex:1:1", "region:home", [])],
        regionIds: ["region:home"],
        regionAdjacencyById: {},
        colonizerQueueConfig: {
          colonizerTurns: 2,
          colonizerCostColonization: 20,
          colonizerCostDucats: 10,
          colonizerMovementPoints: 2,
        },
        getRegionColonizationConfig: () => ({ cost: 5, disabled: false, manualCost: false }),
        getRegionDerivedColonizationCosts: () => ({ pointsCost: 5, ducatsCost: 0 }),
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

function makeHex(id: string, regionId: string | null, neighbors: string[]) {
  return {
    id,
    regionId,
    neighbors,
    hexType: "plains",
    climate: "temperate_grassland",
    landscape: "plains",
  };
}
