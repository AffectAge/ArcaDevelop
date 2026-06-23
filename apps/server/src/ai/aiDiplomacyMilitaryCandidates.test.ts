import { describe, expect, it } from "vitest";
import type { DiplomacyProposal, Division } from "@arcanorum/shared";
import { buildAiCountryContext, buildAiWorldIndexes } from "./aiContext";
import { createAiFixtureWorld } from "./aiFixtureHarness";
import { selectAiDiplomacyMilitaryCandidates } from "./aiDiplomacyMilitaryCandidates";

const divisionStats = {
  manpower: 100,
  attack: 1,
  defense: 1,
  breakthrough: 1,
  organization: 1,
  hp: 1,
  speed: 1,
  supplyUse: 0,
};

function createDivision(overrides: Partial<Division> = {}): Division {
  return {
    id: "division:alpha:1",
    countryId: "country:alpha",
    templateId: "template:alpha:infantry",
    name: "Alpha Test Division",
    hexId: "hex:0:0",
    strength: 100,
    organization: 50,
    stats: divisionStats,
    status: "idle",
    path: [],
    createdTurnId: 1,
    ...overrides,
  };
}

describe("selectAiDiplomacyMilitaryCandidates", () => {
  it("returns deterministic diplomacy contact and own-hex army move candidates", () => {
    const world = createAiFixtureWorld({
      hexOwner: {
        "hex:0:0": "country:alpha",
        "hex:1:0": "country:alpha",
        "hex:2:0": "country:beta",
      },
      divisionsById: {
        "division:alpha:1": createDivision(),
      },
    });
    const context = buildAiCountryContext({
      countryId: "country:alpha",
      world,
      indexes: buildAiWorldIndexes(world),
    });

    const candidates = selectAiDiplomacyMilitaryCandidates({
      context,
      world,
      knownCountryIds: ["country:gamma", "country:alpha", "country:beta"],
      hexAdjacencyById: {
        "hex:0:0": ["hex:2:0", "hex:1:0"],
      },
      maxDiplomacyTargets: 2,
      maxMilitaryMoves: 1,
      expiresInTurns: 8,
    });

    expect(candidates).toEqual([
      {
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
          payload: {
            divisionId: "division:alpha:1",
            path: ["hex:1:0"],
          },
        },
      },
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

    expect(
      candidates.map((candidate) => (candidate.kind === "diplomacy-contact" ? candidate.targetCountryId : "")),
    ).toEqual(["country:gamma"]);
  });

  it("does not create military moves for non-idle divisions or foreign-only adjacency", () => {
    const world = createAiFixtureWorld({
      hexOwner: {
        "hex:0:0": "country:alpha",
        "hex:2:0": "country:beta",
      },
      divisionsById: {
        "division:alpha:1": createDivision({ status: "moving", path: ["hex:2:0"] }),
        "division:alpha:2": createDivision({ id: "division:alpha:2", hexId: "hex:0:0" }),
      },
    });
    const context = buildAiCountryContext({
      countryId: "country:alpha",
      world,
      indexes: buildAiWorldIndexes(world),
    });

    const candidates = selectAiDiplomacyMilitaryCandidates({
      context,
      world,
      knownCountryIds: [],
      hexAdjacencyById: {
        "hex:0:0": ["hex:2:0"],
      },
    });

    expect(candidates).toEqual([]);
  });

  it("does not mutate the world snapshot", () => {
    const world = createAiFixtureWorld({
      hexOwner: {
        "hex:0:0": "country:alpha",
        "hex:1:0": "country:alpha",
      },
      divisionsById: {
        "division:alpha:1": createDivision(),
      },
    });
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
      hexAdjacencyById: {
        "hex:0:0": ["hex:1:0"],
      },
    });

    expect(candidates.every((candidate) => candidate.requiresValidatedPipeline)).toBe(true);
    expect(JSON.stringify(world)).toBe(before);
  });
});
