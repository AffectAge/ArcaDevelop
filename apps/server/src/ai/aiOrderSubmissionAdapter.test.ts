import { describe, expect, it } from "vitest";
import type { AiColonizationCandidate } from "./aiColonizationCandidates";
import type { AiDiplomacyMilitaryCandidate } from "./aiDiplomacyMilitaryCandidates";
import type { AiEconomyOrderCandidate } from "./aiEconomyCandidates";
import {
  createAiBuildOrderDraftsFromPlan,
  createAiOrderDeltaSubmitter,
  createAiOrderDraftsFromPlan,
  createOrderDeltaFromAiDraft,
  submitAiOrderDrafts,
} from "./aiOrderSubmissionAdapter";
import type { AiRuntimePlan } from "./aiRuntimePlanner";

function createBuildCandidate(countryId: string): AiEconomyOrderCandidate {
  return {
    kind: "build",
    countryId,
    regionId: "region:alpha-core",
    buildingId: "building:farm",
    orderDraft: {
      type: "BUILD",
      countryId,
      regionId: "region:alpha-core",
      targetHexId: "hex:0:0",
      payload: { buildingId: "building:farm", owner: { type: "state", countryId } },
    },
  };
}

function createDiplomacyCandidate(countryId: string): AiDiplomacyMilitaryCandidate {
  return {
    kind: "diplomacy-contact",
    countryId,
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
}

function createColonizationCandidate(countryId: string): AiColonizationCandidate {
  return {
    kind: "found-city",
    countryId,
    regionId: "region:frontier",
    targetHexId: "hex:1:1",
    civilianUnitId: "civilian:colonizer",
    pointCost: 5,
    isAdjacentToControlledRegion: true,
    requiresValidatedPipeline: true,
    orderDraft: {
      type: "FOUND_CITY",
      countryId,
      civilianUnitId: "civilian:colonizer",
      name: "Frontier",
      regionId: "region:frontier",
      targetHexId: "hex:1:1",
      payload: { cultureId: countryId },
    },
  };
}

function createQueueColonizerCandidate(countryId: string): AiColonizationCandidate {
  return {
    kind: "queue-colonizer",
    countryId,
    regionId: "region:alpha-core",
    targetHexId: "hex:0:0",
    costColonization: 20,
    costDucats: 10,
    requiresValidatedPipeline: true,
    actionDraft: {
      type: "QUEUE_COLONIZER",
      countryId,
      hexId: "hex:0:0",
    },
  };
}

function createMoveColonizerCandidate(countryId: string): AiColonizationCandidate {
  return {
    kind: "move-colonizer",
    countryId,
    regionId: "region:frontier",
    targetHexId: "hex:2:0",
    civilianUnitId: "civilian:colonizer",
    path: ["hex:1:0", "hex:2:0"],
    pathLength: 2,
    isAdjacentToControlledRegion: true,
    requiresValidatedPipeline: true,
    orderDraft: {
      type: "UNIT_MOVE",
      countryId,
      unitKind: "civilian",
      unitId: "civilian:colonizer",
      targetHexId: "hex:2:0",
      path: ["hex:1:0", "hex:2:0"],
      payload: { path: ["hex:1:0", "hex:2:0"] },
    },
  };
}

function createPlan(
  candidate: AiEconomyOrderCandidate | AiDiplomacyMilitaryCandidate | AiColonizationCandidate | null,
): AiRuntimePlan {
  return {
    enabled: true,
    turnId: 7,
    processedCountryIds: ["country:alpha"],
    skippedCountryIds: [],
    budget: {
      maxCountriesPerTick: 1,
      maxDecisionCandidatesPerCountry: 1,
      contextCacheTtlTurns: 1,
      maxBuildCompletionTurns: 8,
    },
    actions: [
      {
        countryId: "country:alpha",
        candidateCount: candidate ? 1 : 0,
        selected: candidate
          ? {
              candidate,
              score: 3,
              reason: { baseWeight: 3, buildingWeight: 0, goodWeight: 0, regionWeight: 0 },
            }
          : null,
      },
    ],
  };
}

describe("createAiBuildOrderDraftsFromPlan", () => {
  it("converts selected build candidates into validated order drafts", () => {
    const drafts = createAiBuildOrderDraftsFromPlan({ plan: createPlan(createBuildCandidate("country:alpha")) });

    expect(drafts).toEqual([
      {
        kind: "validated-order-draft",
        candidateKind: "build",
        countryId: "country:alpha",
        requiresValidatedPipeline: true,
        order: {
          type: "BUILD",
          turnId: 7,
          playerId: "ai:country:alpha",
          countryId: "country:alpha",
          regionId: "region:alpha-core",
          targetHexId: "hex:0:0",
          payload: {
            buildingId: "building:farm",
            owner: { type: "state", countryId: "country:alpha" },
          },
        },
      },
    ]);
  });

  it("converts selected found-city candidates into validated order drafts", () => {
    const drafts = createAiOrderDraftsFromPlan({ plan: createPlan(createColonizationCandidate("country:alpha")) });

    expect(drafts).toEqual([
      {
        kind: "validated-order-draft",
        candidateKind: "found-city",
        countryId: "country:alpha",
        requiresValidatedPipeline: true,
        order: {
          type: "FOUND_CITY",
          turnId: 7,
          playerId: "ai:country:alpha",
          countryId: "country:alpha",
          civilianUnitId: "civilian:colonizer",
          name: "Frontier",
          regionId: "region:frontier",
          targetHexId: "hex:1:1",
          payload: { cultureId: "country:alpha" },
        },
      },
    ]);
  });

  it("converts selected queue-colonizer candidates into validated action drafts", () => {
    const drafts = createAiOrderDraftsFromPlan({ plan: createPlan(createQueueColonizerCandidate("country:alpha")) });

    expect(drafts).toEqual([
      {
        kind: "validated-ai-action-draft",
        candidateKind: "queue-colonizer",
        countryId: "country:alpha",
        requiresValidatedPipeline: true,
        action: { type: "QUEUE_COLONIZER", countryId: "country:alpha", hexId: "hex:0:0" },
      },
    ]);
  });

  it("converts selected move-colonizer candidates into validated unit move order drafts", () => {
    const drafts = createAiOrderDraftsFromPlan({ plan: createPlan(createMoveColonizerCandidate("country:alpha")) });

    expect(drafts).toEqual([
      {
        kind: "validated-order-draft",
        candidateKind: "move-colonizer",
        countryId: "country:alpha",
        requiresValidatedPipeline: true,
        order: {
          type: "UNIT_MOVE",
          turnId: 7,
          playerId: "ai:country:alpha",
          countryId: "country:alpha",
          unitId: "civilian:colonizer",
          unitKind: "civilian",
          targetHexId: "hex:2:0",
          path: ["hex:1:0", "hex:2:0"],
          payload: { path: ["hex:1:0", "hex:2:0"] },
        },
      },
    ]);
  });

  it("uses a custom AI player id prefix without changing order payload", () => {
    const drafts = createAiBuildOrderDraftsFromPlan({
      plan: createPlan(createBuildCandidate("country:alpha")),
      aiPlayerIdPrefix: "bot",
    });

    expect(drafts[0]?.order.playerId).toBe("bot:country:alpha");
    expect(drafts[0]?.order.payload).toEqual({
      buildingId: "building:farm",
      owner: { type: "state", countryId: "country:alpha" },
    });
  });

  it("skips unsupported selected candidates and empty selections", () => {
    expect(createAiBuildOrderDraftsFromPlan({ plan: createPlan(createDiplomacyCandidate("country:alpha")) })).toEqual([]);
    expect(createAiBuildOrderDraftsFromPlan({ plan: createPlan(createColonizationCandidate("country:alpha")) })).toEqual([]);
    expect(createAiBuildOrderDraftsFromPlan({ plan: createPlan(createMoveColonizerCandidate("country:alpha")) })).toEqual([]);
    expect(createAiBuildOrderDraftsFromPlan({ plan: createPlan(createQueueColonizerCandidate("country:alpha")) })).toEqual([]);
    expect(createAiBuildOrderDraftsFromPlan({ plan: createPlan(null) })).toEqual([]);
  });

  it("submits drafts sequentially through an injected validated pipeline adapter", async () => {
    const drafts = createAiBuildOrderDraftsFromPlan({ plan: createPlan(createBuildCandidate("country:alpha")) });
    const seenPlayerIds: string[] = [];

    const results = await submitAiOrderDrafts({
      drafts,
      submitDraft: async (draft) => {
        if (draft.kind !== "validated-order-draft") throw new Error("expected order draft");
        seenPlayerIds.push(draft.order.playerId);
        return { ok: true, submittedOrderId: "order:ai:1" };
      },
    });

    expect(seenPlayerIds).toEqual(["ai:country:alpha"]);
    expect(results).toEqual([{ ok: true, draft: drafts[0], submittedOrderId: "order:ai:1" }]);
  });

  it("reports rejected draft submissions without hiding the validation reason", async () => {
    const drafts = createAiBuildOrderDraftsFromPlan({ plan: createPlan(createBuildCandidate("country:alpha")) });

    const results = await submitAiOrderDrafts({
      drafts,
      submitDraft: async () => ({ ok: false, reason: "BUILD_CONFLICT" }),
    });

    expect(results).toEqual([{ ok: false, draft: drafts[0], reason: "BUILD_CONFLICT" }]);
  });


  it("preserves admin-only diagnostics for rejected draft submissions", async () => {
    const drafts = createAiBuildOrderDraftsFromPlan({ plan: createPlan(createBuildCandidate("country:alpha")) });

    const results = await submitAiOrderDrafts({
      drafts,
      submitDraft: async () => ({
        ok: false,
        reason: "NO_RESOURCES",
        diagnostics: {
          runtimeErrors: [
            { code: "NO_RESOURCES", message: "R1" },
            { code: "BUILD_CONFLICT", message: "R2" },
          ],
        },
      }),
    });

    expect(results).toEqual([
      {
        ok: false,
        draft: drafts[0],
        reason: "NO_RESOURCES",
        diagnostics: {
          runtimeErrors: [
            { code: "NO_RESOURCES", message: "R1" },
            { code: "BUILD_CONFLICT", message: "R2" },
          ],
        },
      },
    ]);
  });

  it("converts AI drafts to standard order deltas for the existing submission pipeline", () => {
    const drafts = createAiBuildOrderDraftsFromPlan({ plan: createPlan(createBuildCandidate("country:alpha")) });
    const delta = createOrderDeltaFromAiDraft(drafts[0]!);

    expect(delta).toEqual({ type: "ORDER_DELTA", order: drafts[0]?.order });
  });

  it("adapts draft submission to an injected order-delta pipeline", async () => {
    const drafts = createAiBuildOrderDraftsFromPlan({ plan: createPlan(createBuildCandidate("country:alpha")) });
    const submittedDeltas: unknown[] = [];

    const submitDraft = createAiOrderDeltaSubmitter(async (delta) => {
      submittedDeltas.push(delta);
      return { ok: true, submittedOrderId: "order:ai:delta" };
    });
    const results = await submitAiOrderDrafts({ drafts, submitDraft });

    expect(submittedDeltas).toEqual([{ type: "ORDER_DELTA", order: drafts[0]?.order }]);
    expect(results).toEqual([{ ok: true, draft: drafts[0], submittedOrderId: "order:ai:delta" }]);
  });
});
