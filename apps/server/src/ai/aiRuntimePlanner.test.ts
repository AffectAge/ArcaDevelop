import { describe, expect, it } from "vitest";
import type { AiColonizationCandidate } from "./aiColonizationCandidates";
import type { AiDiplomacyMilitaryCandidate } from "./aiDiplomacyMilitaryCandidates";
import type { AiEconomyOrderCandidate } from "./aiEconomyCandidates";
import { createAiFixtureWorld } from "./aiFixtureHarness";
import {
  planAiRuntimeTick,
  type AiRuntimeCandidateProvider,
  type AiRuntimeSettings,
} from "./aiRuntimePlanner";

const enabledAiSettings: AiRuntimeSettings = {
  enabled: true,
  maxCountriesPerTick: 2,
  maxDecisionCandidatesPerCountry: 4,
  contextCacheTtlTurns: 1,
  maxBuildCompletionTurns: 8,
};

function createBuildCandidate(countryId: string, regionId = "region:alpha-core"): AiEconomyOrderCandidate {
  return {
    kind: "build",
    countryId,
    regionId,
    buildingId: "building:farm",
    orderDraft: {
      type: "BUILD",
      countryId,
      regionId,
      payload: { buildingId: "building:farm", owner: { type: "state", countryId } },
    },
  };
}

function createDiplomacyCandidate(countryId: string, targetCountryId: string): AiDiplomacyMilitaryCandidate {
  return {
    kind: "diplomacy-contact",
    countryId,
    targetCountryId,
    requiresValidatedPipeline: true,
    request: {
      route: "/diplomacy/proposals",
      body: {
        toCountryId: targetCountryId,
        expiresInTurns: 12,
        clauses: [{ kind: "text_note", text: "ai.diplomacy.contact" }],
      },
    },
  };
}

function createColonizationCandidate(countryId: string, regionId = "region:frontier"): AiColonizationCandidate {
  return {
    kind: "colonize-region",
    countryId,
    regionId,
    pointCost: 5,
    ducatCost: 2,
    isAdjacentToControlledRegion: true,
    requiresValidatedPipeline: true,
    orderDraft: {
      type: "COLONIZE",
      countryId,
      regionId,
      payload: {},
    },
  };
}

describe("planAiRuntimeTick", () => {
  it("returns an empty disabled plan without invoking providers", () => {
    const world = createAiFixtureWorld();
    let providerCalls = 0;
    const provider: AiRuntimeCandidateProvider = {
      id: "test",
      selectCandidates: () => {
        providerCalls += 1;
        return [createBuildCandidate("country:alpha")];
      },
    };

    const plan = planAiRuntimeTick({
      world,
      aiSettings: { ...enabledAiSettings, enabled: false },
      countryIds: ["country:beta", "country:alpha"],
      candidateProviders: [provider],
    });

    expect(plan).toMatchObject({
      enabled: false,
      processedCountryIds: [],
      skippedCountryIds: ["country:alpha", "country:beta"],
      actions: [],
    });
    expect(providerCalls).toBe(0);
  });

  it("respects country and candidate budgets with deterministic country ordering", () => {
    const world = createAiFixtureWorld();
    const seenCountryIds: string[] = [];
    const provider: AiRuntimeCandidateProvider = {
      id: "economy",
      selectCandidates: ({ countryId }) => {
        seenCountryIds.push(countryId);
        return [
          createBuildCandidate(countryId, "region:z"),
          createBuildCandidate(countryId, "region:a"),
        ];
      },
    };

    const plan = planAiRuntimeTick({
      world,
      aiSettings: { ...enabledAiSettings, maxCountriesPerTick: 1, maxDecisionCandidatesPerCountry: 1 },
      countryIds: ["country:beta", "country:alpha", "country:alpha"],
      candidateProviders: [provider],
    });

    expect(plan.processedCountryIds).toEqual(["country:alpha"]);
    expect(plan.skippedCountryIds).toEqual(["country:beta"]);
    expect(seenCountryIds).toEqual(["country:alpha"]);
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]?.candidateCount).toBe(1);
    expect(plan.actions[0]?.selected?.candidate).toMatchObject({ kind: "build", regionId: "region:a" });
  });

  it("scores selected candidates with country strategy profiles and does not mutate the world", () => {
    const world = createAiFixtureWorld();
    const before = JSON.stringify(world);
    const provider: AiRuntimeCandidateProvider = {
      id: "mixed",
      selectCandidates: ({ countryId }) => [
        createBuildCandidate(countryId),
        createDiplomacyCandidate(countryId, "country:beta"),
      ],
    };

    const plan = planAiRuntimeTick({
      world,
      aiSettings: enabledAiSettings,
      countryIds: ["country:alpha"],
      candidateProviders: [provider],
      strategyProfilesByCountryId: {
        "country:alpha": [{ id: "strategy:diplomat", weights: { diplomacyContact: 10, economyBuild: 1 } }],
      },
    });

    expect(plan.actions[0]?.selected?.candidate).toMatchObject({
      kind: "diplomacy-contact",
      targetCountryId: "country:beta",
    });
    expect(plan.actions[0]?.selected?.score).toBe(10);
    expect(JSON.stringify(world)).toBe(before);
  });

  it("lets profile weights select colonization over build candidates within candidate budgets", () => {
    const world = createAiFixtureWorld();
    const provider: AiRuntimeCandidateProvider = {
      id: "mixed",
      selectCandidates: ({ countryId }) => [
        createBuildCandidate(countryId),
        createColonizationCandidate(countryId),
      ],
    };

    const plan = planAiRuntimeTick({
      world,
      aiSettings: { ...enabledAiSettings, maxDecisionCandidatesPerCountry: 2 },
      countryIds: ["country:alpha"],
      candidateProviders: [provider],
      strategyProfilesByCountryId: {
        "country:alpha": [{ id: "strategy:colonizer", weights: { colonization: 10, economyBuild: 1 } }],
      },
    });

    expect(plan.actions[0]?.candidateCount).toBe(2);
    expect(plan.actions[0]?.selected?.candidate).toMatchObject({
      kind: "colonize-region",
      regionId: "region:frontier",
    });
  });

  it("passes scenario and profile build completion limits to candidate providers", () => {
    const world = createAiFixtureWorld();
    const seenLimits: number[] = [];
    const provider: AiRuntimeCandidateProvider = {
      id: "economy",
      selectCandidates: ({ countryId, aiSettings }) => {
        seenLimits.push(aiSettings.maxBuildCompletionTurns);
        return [createBuildCandidate(countryId)];
      },
    };

    planAiRuntimeTick({
      world,
      aiSettings: { ...enabledAiSettings, maxBuildCompletionTurns: 8 },
      countryIds: ["country:alpha"],
      candidateProviders: [provider],
      strategyProfilesByCountryId: {
        "country:alpha": [{ id: "personality:long-builder", maxBuildCompletionTurns: 14 }],
      },
    });

    expect(seenLimits).toEqual([14]);
  });
});
