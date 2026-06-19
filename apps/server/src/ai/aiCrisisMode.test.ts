import { describe, expect, it } from "vitest";
import { buildAiCountryContext, buildAiWorldIndexes } from "./aiContext";
import { assessAiCrisis } from "./aiCrisisMode";
import { createAiFixtureWorld } from "./aiFixtureHarness";
import type { AiMarketImportCandidate } from "./aiMarketCandidates";

const marketCandidate: AiMarketImportCandidate = {
  kind: "market-import",
  countryId: "country:alpha",
  targetMarketId: "market:alpha",
  sourceMarketId: "market:beta",
  goodId: "good:grain",
  shortageAmount: 12,
  availableAmount: 8,
  suggestedAmount: 8,
  estimatedUnitPrice: 5,
};

describe("AI crisis mode", () => {
  it("returns inactive assessment when disabled", () => {
    const world = createAiFixtureWorld();
    const indexes = buildAiWorldIndexes(world);
    const context = buildAiCountryContext({ countryId: "country:alpha", world, indexes });

    expect(
      assessAiCrisis({
        context,
        marketImportCandidates: [marketCandidate],
        config: { enabled: false, ducatsCriticalBelow: 1_000, marketShortageCriticalAt: 1 },
      }),
    ).toEqual({ active: false, signals: [], priorityProfile: null });
  });

  it("detects treasury and market crises and exposes explicit priority overrides", () => {
    const world = createAiFixtureWorld({
      resourcesByCountry: {
        "country:alpha": {
          culture: 0,
          science: 0,
          religion: 0,
          colonization: 0,
          construction: 5,
          ducats: 20,
          gold: 0,
        },
      },
    });
    const indexes = buildAiWorldIndexes(world);
    const context = buildAiCountryContext({ countryId: "country:alpha", world, indexes });

    const assessment = assessAiCrisis({
      context,
      marketImportCandidates: [marketCandidate],
      config: {
        enabled: true,
        ducatsCriticalBelow: 50,
        marketShortageCriticalAt: 6,
        priorityOverrides: { id: "crisis:imports", weights: { marketImport: 20 } },
      },
    });

    expect(assessment).toEqual({
      active: true,
      signals: [
        { kind: "market-shortage", severity: "critical", value: 12, threshold: 6, goodId: "good:grain" },
        { kind: "treasury-low", severity: "critical", value: 20, threshold: 50 },
      ],
      priorityProfile: { id: "crisis:imports", weights: { marketImport: 20 } },
    });
  });

  it("detects landless crisis only when configured", () => {
    const world = createAiFixtureWorld({
      resourcesByCountry: {
        "country:landless": {
          culture: 0,
          science: 0,
          religion: 0,
          colonization: 0,
          construction: 5,
          ducats: 100,
          gold: 0,
        },
      },
    });
    const indexes = buildAiWorldIndexes(world);
    const context = buildAiCountryContext({ countryId: "country:landless", world, indexes });

    expect(
      assessAiCrisis({
        context,
        marketImportCandidates: [],
        config: { enabled: true, requireControlledRegion: true },
      }).signals,
    ).toEqual([{ kind: "landless", severity: "critical", value: 0, threshold: 1 }]);
  });

  it("keeps warning-only signals inactive", () => {
    const world = createAiFixtureWorld();
    const indexes = buildAiWorldIndexes(world);
    const context = buildAiCountryContext({ countryId: "country:alpha", world, indexes });

    const assessment = assessAiCrisis({
      context,
      marketImportCandidates: [{ ...marketCandidate, shortageAmount: 7 }],
      config: { enabled: true, ducatsCriticalBelow: 199, marketShortageCriticalAt: 6 },
    });

    expect(assessment.active).toBe(false);
    expect(assessment.priorityProfile).toBeNull();
    expect(assessment.signals.map((signal) => signal.severity)).toEqual(["warning", "warning"]);
  });
});
