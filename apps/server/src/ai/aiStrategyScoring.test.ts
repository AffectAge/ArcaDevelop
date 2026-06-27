import { describe, expect, it } from "vitest";
import type { AiColonizationCandidate } from "./aiColonizationCandidates";
import type { AiDiplomacyMilitaryCandidate } from "./aiDiplomacyMilitaryCandidates";
import type { AiEconomyOrderCandidate } from "./aiEconomyCandidates";
import type { AiMarketImportCandidate } from "./aiMarketCandidates";
import { resolveAiStrategyProfile, scoreAiCandidates, selectTopAiCandidate } from "./aiStrategyScoring";

const buildCandidate: AiEconomyOrderCandidate = {
  kind: "build",
  countryId: "country:alpha",
  regionId: "region:alpha",
  buildingId: "building:farm",
  orderDraft: {
    type: "BUILD",
    countryId: "country:alpha",
    regionId: "region:alpha",
    targetHexId: "hex:0:0",
    payload: { buildingId: "building:farm", owner: { type: "state", countryId: "country:alpha" } },
  },
};

const upgradeCandidate: AiEconomyOrderCandidate = {
  kind: "upgrade",
  countryId: "country:alpha",
  regionId: "region:alpha",
  buildingId: "building:farm",
  instanceId: "building:farm:1",
  currentLevel: 1,
  targetLevel: 2,
  costConstruction: 8,
  costDucats: 4,
  request: {
    route: "/country/build/upgrade-state",
    body: { regionId: "region:alpha", buildingId: "building:farm", instanceId: "building:farm:1" },
  },
};

const importCandidate: AiMarketImportCandidate = {
  kind: "market-import",
  countryId: "country:alpha",
  targetMarketId: "market:alpha",
  sourceMarketId: "market:beta",
  goodId: "good:grain",
  shortageAmount: 10,
  availableAmount: 7,
  suggestedAmount: 7,
  estimatedUnitPrice: 8,
};

const diplomacyCandidate: AiDiplomacyMilitaryCandidate = {
  kind: "diplomacy-contact",
  countryId: "country:alpha",
  targetCountryId: "country:beta",
  requiresValidatedPipeline: true,
  request: {
    route: "/diplomacy/proposals",
    body: {
      toCountryId: "country:beta",
      expiresInTurns: 12,
      clauses: [{ kind: "text_note", text: "ai.diplomacy.contact" }],
    },
  },
};

const militaryCandidate: AiDiplomacyMilitaryCandidate = {
  kind: "army-move",
  countryId: "country:alpha",
  divisionId: "division:alpha:1",
  fromHexId: "hex:0:0",
  targetHexId: "hex:1:0",
  requiresValidatedPipeline: true,
  orderDraft: {
    type: "ARMY_MOVE",
    countryId: "country:alpha",
    targetHexId: "hex:1:0",
    payload: { divisionId: "division:alpha:1", path: ["hex:1:0"] },
  },
};

const colonizationCandidate: AiColonizationCandidate = {
  kind: "found-city",
  countryId: "country:alpha",
  regionId: "region:frontier",
  targetHexId: "hex:1:1",
  civilianUnitId: "civilian:colonizer",
  pointCost: 5,
  isAdjacentToControlledRegion: true,
  requiresValidatedPipeline: true,
  orderDraft: {
    type: "FOUND_CITY",
    countryId: "country:alpha",
    civilianUnitId: "civilian:colonizer",
    regionId: "region:frontier",
    targetHexId: "hex:1:1",
    payload: { cultureId: "country:alpha" },
  },
};

describe("AI strategy scoring", () => {
  it("merges archetype, personality, strategy, and country overrides deterministically", () => {
    const profile = resolveAiStrategyProfile([
      { id: "archetype:base", weights: { economyBuild: 1, economyUpgrade: 2 }, buildingWeights: { "building:farm": 3 } },
      { id: "personality:trader", weights: { marketImport: 6, diplomacyContact: 4 }, goodWeights: { "good:grain": 4 }, maxBuildCompletionTurns: 12 },
      { id: "strategy:growth", regionWeights: { "region:alpha": 5 } },
      { id: "country:alpha", weights: { economyUpgrade: 7, militaryMove: 9, colonization: 10 }, buildingWeights: { "building:farm": 8 }, maxBuildCompletionTurns: 6 },
    ]);

    expect(profile).toEqual({
      weights: { economyBuild: 1, economyUpgrade: 7, marketImport: 6, diplomacyContact: 4, militaryMove: 9, colonization: 10 },
      maxBuildCompletionTurns: 6,
      buildingWeights: { "building:farm": 8 },
      goodWeights: { "good:grain": 4 },
      regionWeights: { "region:alpha": 5 },
    });
  });

  it("scores candidates without changing candidate legality or shape", () => {
    const profile = resolveAiStrategyProfile([
      {
        id: "personality:builder",
        weights: { economyBuild: 2, economyUpgrade: 4, marketImport: 1, diplomacyContact: 5, militaryMove: 6, colonization: 3 },
        buildingWeights: { "building:farm": 3 },
        regionWeights: { "region:alpha": 2, "region:frontier": 7 },
      },
    ]);
    const candidates = [buildCandidate, upgradeCandidate, importCandidate, diplomacyCandidate, militaryCandidate, colonizationCandidate];

    const scored = scoreAiCandidates(candidates, profile);

    expect(scored.map((row) => row.score)).toEqual([10, 9, 7, 6, 5, 1]);
    expect(scored[0]?.candidate).toBe(colonizationCandidate);
    expect(scored[1]?.candidate).toBe(upgradeCandidate);
    expect(scored[2]?.candidate).toBe(buildCandidate);
    expect(scored[3]?.candidate).toBe(militaryCandidate);
    expect(scored[4]?.candidate).toBe(diplomacyCandidate);
    expect(scored[5]?.candidate).toBe(importCandidate);
  });

  it("uses good weights for market import candidates and stable tie breaks", () => {
    const profile = resolveAiStrategyProfile([
      { id: "personality:trader", weights: { marketImport: 5 }, goodWeights: { "good:grain": 3 } },
    ]);
    const otherImport: AiMarketImportCandidate = {
      ...importCandidate,
      sourceMarketId: "market:aardvark",
    };

    const scored = scoreAiCandidates([importCandidate, otherImport], profile);

    expect(scored.map((row) => row.candidate)).toEqual([otherImport, importCandidate]);
    expect(scored.map((row) => row.score)).toEqual([8, 8]);
  });

  it("selects a top candidate or null for empty input", () => {
    const profile = resolveAiStrategyProfile([{ id: "personality:balanced" }]);

    expect(selectTopAiCandidate([buildCandidate], profile)?.candidate).toBe(buildCandidate);
    expect(selectTopAiCandidate([], profile)).toBeNull();
  });
});
