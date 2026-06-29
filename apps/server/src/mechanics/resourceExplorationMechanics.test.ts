import { describe, expect, it } from "vitest";
import {
  chooseExplorationVeinSize,
  createResourceExplorationProject,
  normalizeResourceExplorationConfig,
  resolveCompletedExplorationProject,
  resolveResourceExplorationTurn,
  rollWeightedExplorationChoice,
  type ResourceExplorationGood,
  type ResourceExplorationWorldState,
} from "./resourceExplorationMechanics";

const ore: ResourceExplorationGood = {
  id: "good:ore",
  isResourceDiscoverable: true,
  explorationBaseWeight: 10,
  explorationSmallVeinChancePct: 0,
  explorationMediumVeinChancePct: 0,
  explorationLargeVeinChancePct: 100,
  explorationLargeVeinMin: 500,
  explorationLargeVeinMax: 700,
};

describe("resourceExplorationMechanics", () => {
  it("creates exploration projects and normalizes config", () => {
    expect(
      createResourceExplorationProject({
        queueId: "queue:a",
        requestedByCountryId: "country:a",
        startedTurnId: 7,
        durationTurns: 0,
      }),
    ).toEqual({
      queueId: "queue:a",
      requestedByCountryId: "country:a",
      startedTurnId: 7,
      turnsRemaining: 1,
    });
    expect(normalizeResourceExplorationConfig({ rollsPerExpedition: 0, baseEmptyChancePct: 150, depletionPerAttemptPct: -5 })).toEqual({
      rollsPerExpedition: 1,
      baseEmptyChancePct: 100,
      depletionPerAttemptPct: 0,
    });
  });

  it("rolls weighted choices and vein sizes deterministically with injected random", () => {
    expect(
      rollWeightedExplorationChoice(
        [
          { weight: 1, value: "a" },
          { weight: 3, value: "b" },
        ],
        () => 0.5,
      ),
    ).toBe("b");
    expect(chooseExplorationVeinSize(ore, () => 0.1)).toBe("large");
  });

  it("resolves completed exploration into deposits", () => {
    const found = resolveCompletedExplorationProject({
      regionId: "region:a",
      regionAreaKm2: 2_000,
      goods: [ore],
      candidateHexIds: ["hex:0:0"],
      explorationCount: 0,
      turnId: 9,
      config: { rollsPerExpedition: 1, baseEmptyChancePct: 0, depletionPerAttemptPct: 0 },
      random: makeRandom([0.5, 0.5, 0.5, 0.5]),
    });

    expect(found).toEqual([
      {
        id: "resource_deposit:good:ore_hex:0:0",
        goodId: "good:ore",
        hexId: "hex:0:0",
        regionId: "region:a",
        amount: 600,
        maxAmount: 600,
        initialAmount: 600,
        visibility: "known",
        source: "exploration",
        depletionMode: "finite",
        discoveredTurnId: 9,
        discoveredByCountryId: null,
      },
    ]);
  });

  it("decrements unfinished queue entries without creating deposits", () => {
    const worldBase = makeWorld({
      regionOwner: { "region:a": "country:a" },
      regionController: { "region:a": "country:a" },
      regionResourceExplorationQueueByRegion: {
        "region:a": [{ queueId: "queue:a", requestedByCountryId: "country:a", startedTurnId: 1, turnsRemaining: 2 }],
      },
    });

    resolveResourceExplorationTurn({
      worldBase,
      regions: [{ id: "region:a", areaKm2: 1000 }],
      goods: [ore],
      turnId: 2,
      config: { rollsPerExpedition: 1, baseEmptyChancePct: 0, depletionPerAttemptPct: 0 },
      random: () => 0.5,
    });

    expect(worldBase.regionResourceExplorationQueueByRegion["region:a"]).toEqual([
      { queueId: "queue:a", requestedByCountryId: "country:a", startedTurnId: 1, turnsRemaining: 1 },
    ]);
    expect(worldBase.regionResourceDepositsByRegion["region:a"]).toEqual([]);
  });

  it("completes owned exploration, merges deposits, increments depletion count, and clears queue shape", () => {
    const worldBase = makeWorld({
      regionOwner: { "region:a": "country:a" },
      regionController: { "region:a": "country:a" },
      regionResourceExplorationCountByRegion: { "region:a": 1 },
      regionResourceDepositsByRegion: {
        "region:a": [makeDeposit({ amount: 25 })],
      },
      regionResourceExplorationQueueByRegion: {
        "region:a": [{ queueId: "queue:a", requestedByCountryId: "country:a", startedTurnId: 1, turnsRemaining: 1 }],
      },
    });

    resolveResourceExplorationTurn({
      worldBase,
      regions: [{ id: "region:a", areaKm2: 2_000 }],
      goods: [ore],
      turnId: 3,
      config: { rollsPerExpedition: 1, baseEmptyChancePct: 0, depletionPerAttemptPct: 0 },
      random: makeRandom([0.5, 0.5, 0.5, 0.5]),
    });

    expect(worldBase.regionResourceExplorationQueueByRegion["region:a"]).toEqual([]);
    expect(worldBase.regionResourceExplorationCountByRegion["region:a"]).toBe(2);
    expect(worldBase.regionResourceDepositsByRegion["region:a"]).toEqual([makeDeposit({ amount: 25 })]);
  });

  it("counts depleted empty attempts without adding deposits", () => {
    const worldBase = makeWorld({
      regionOwner: { "region:a": "country:a" },
      regionController: { "region:a": "country:a" },
      regionResourceExplorationCountByRegion: { "region:a": 10 },
      regionResourceExplorationQueueByRegion: {
        "region:a": [{ queueId: "queue:a", requestedByCountryId: "country:a", startedTurnId: 1, turnsRemaining: 1 }],
      },
    });

    resolveResourceExplorationTurn({
      worldBase,
      regions: [{ id: "region:a", areaKm2: 2_000 }],
      goods: [ore],
      turnId: 3,
      config: { rollsPerExpedition: 1, baseEmptyChancePct: 0, depletionPerAttemptPct: 100 },
      random: () => 0.5,
    });

    expect(worldBase.regionResourceExplorationCountByRegion["region:a"]).toBe(11);
    expect(worldBase.regionResourceDepositsByRegion["region:a"]).toEqual([]);
  });
});

function makeWorld(overrides?: Partial<ResourceExplorationWorldState>): ResourceExplorationWorldState {
  return {
    regionOwner: {},
    regionController: {},
    regionResourceExplorationQueueByRegion: {},
    regionResourceExplorationCountByRegion: {},
    regionResourceDepositsByRegion: {},
    ...overrides,
  };
}

function makeDeposit(overrides?: Partial<ResourceExplorationWorldState["regionResourceDepositsByRegion"][string][number]>): ResourceExplorationWorldState["regionResourceDepositsByRegion"][string][number] {
  return {
    id: "resource_deposit:good_ore_hex_0_0",
    goodId: "good:ore",
    hexId: "hex:0:0",
    regionId: "region:a",
    amount: 10,
    maxAmount: 10,
    initialAmount: 10,
    visibility: "known",
    source: "authored",
    depletionMode: "finite",
    discoveredTurnId: 1,
    discoveredByCountryId: null,
    ...overrides,
  };
}

function makeRandom(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0.5;
}
