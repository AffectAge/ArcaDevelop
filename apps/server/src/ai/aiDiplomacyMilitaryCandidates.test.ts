import { describe, expect, it } from "vitest";
import type { DiplomacyProposal } from "@arcanorum/shared";
import { buildAiCountryContext, buildAiWorldIndexes } from "./aiContext";
import { createAiFixtureWorld } from "./aiFixtureHarness";
import { selectAiDiplomacyMilitaryCandidates } from "./aiDiplomacyMilitaryCandidates";

describe("selectAiDiplomacyMilitaryCandidates", () => {
  it("returns deterministic diplomacy contact candidates", () => {
    const world = createAiFixtureWorld();
    const context = buildAiCountryContext({
      countryId: "country:alpha",
      world,
      indexes: buildAiWorldIndexes(world),
    });

    const candidates = selectAiDiplomacyMilitaryCandidates({
      context,
      world,
      knownCountryIds: ["country:gamma", "country:alpha", "country:beta"],
      maxDiplomacyTargets: 2,
      expiresInTurns: 8,
    });

    expect(candidates).toEqual([
      {
        kind: "diplomacy-contact",
        countryId: "country:alpha",
        targetCountryId: "country:beta",
        requiresValidatedPipeline: true,
        request: {
          route: "/diplomacy/proposals",
          body: {
            toCountryId: "country:beta",
            expiresInTurns: 8,
            clauses: [{ kind: "text_note", text: "ai.diplomacy.contact" }],
          },
        },
      },
      {
        kind: "diplomacy-contact",
        countryId: "country:alpha",
        targetCountryId: "country:gamma",
        requiresValidatedPipeline: true,
        request: {
          route: "/diplomacy/proposals",
          body: {
            toCountryId: "country:gamma",
            expiresInTurns: 8,
            clauses: [{ kind: "text_note", text: "ai.diplomacy.contact" }],
          },
        },
      },
    ]);
  });

  it("skips active diplomacy proposals between the same pair", () => {
    const pendingProposal: DiplomacyProposal = {
      id: "proposal:alpha-beta",
      name: "Existing proposal",
      fromCountryId: "country:beta",
      toCountryId: "country:alpha",
      createdTurnId: 1,
      expiresTurnId: 4,
      status: "pending",
      clauses: [{ id: "clause:note", kind: "text_note", text: "Existing" }],
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const world = createAiFixtureWorld({ diplomacyProposals: [pendingProposal] });
    const context = buildAiCountryContext({
      countryId: "country:alpha",
      world,
      indexes: buildAiWorldIndexes(world),
    });

    const candidates = selectAiDiplomacyMilitaryCandidates({
      context,
      world,
      knownCountryIds: ["country:beta", "country:gamma"],
    });

    expect(candidates.map((candidate) => candidate.targetCountryId)).toEqual(["country:gamma"]);
  });

  it("does not mutate the world snapshot", () => {
    const world = createAiFixtureWorld();
    const before = JSON.stringify(world);
    const context = buildAiCountryContext({
      countryId: "country:alpha",
      world,
      indexes: buildAiWorldIndexes(world),
    });

    const candidates = selectAiDiplomacyMilitaryCandidates({
      context,
      world,
      knownCountryIds: ["country:beta"],
    });

    expect(candidates.every((candidate) => candidate.requiresValidatedPipeline)).toBe(true);
    expect(JSON.stringify(world)).toBe(before);
  });
});
