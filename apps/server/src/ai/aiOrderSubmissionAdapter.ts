import type { OrderDelta, OrderInput } from "@arcanorum/shared";
import type { AiColonizationCandidate } from "./aiColonizationCandidates";
import type { AiEconomyBuildCandidate } from "./aiEconomyCandidates";
import type { AiRuntimePlan, PlannedAiCountryAction } from "./aiRuntimePlanner";

export type AiBuildOrderSubmissionDraft = {
  kind: "validated-order-draft";
  candidateKind: "build";
  countryId: string;
  requiresValidatedPipeline: true;
  order: Extract<OrderInput, { type: "BUILD" }>;
};

export type AiColonizeOrderSubmissionDraft = {
  kind: "validated-order-draft";
  candidateKind: "colonize-region";
  countryId: string;
  requiresValidatedPipeline: true;
  order: Extract<OrderInput, { type: "COLONIZE" }>;
};

export type AiOrderSubmissionDraft = AiBuildOrderSubmissionDraft | AiColonizeOrderSubmissionDraft;

export type CreateAiBuildOrderDraftsParams = {
  plan: AiRuntimePlan;
  aiPlayerIdPrefix?: string;
};

const defaultAiPlayerIdPrefix = "ai";

export function createAiBuildOrderDraftsFromPlan(params: CreateAiBuildOrderDraftsParams): AiBuildOrderSubmissionDraft[] {
  return createAiOrderDraftsFromPlan(params).filter(
    (draft): draft is AiBuildOrderSubmissionDraft => draft.candidateKind === "build",
  );
}

export function createAiOrderDraftsFromPlan(params: CreateAiBuildOrderDraftsParams): AiOrderSubmissionDraft[] {
  const playerIdPrefix = normalizePlayerIdPrefix(params.aiPlayerIdPrefix);
  return params.plan.actions.flatMap((action) => createAiOrderDraft(action, params.plan.turnId, playerIdPrefix));
}

function createAiOrderDraft(
  action: PlannedAiCountryAction,
  turnId: number,
  playerIdPrefix: string,
): AiOrderSubmissionDraft[] {
  const candidate = action.selected?.candidate;
  if (!candidate) return [];
  if (candidate.kind === "build") {
    return [{
      kind: "validated-order-draft",
      candidateKind: "build",
      countryId: action.countryId,
      requiresValidatedPipeline: true,
      order: createBuildOrderInput(candidate, turnId, playerIdPrefix),
    }];
  }
  if (candidate.kind === "colonize-region") {
    return [{
      kind: "validated-order-draft",
      candidateKind: "colonize-region",
      countryId: action.countryId,
      requiresValidatedPipeline: true,
      order: createColonizeOrderInput(candidate, turnId, playerIdPrefix),
    }];
  }
  return [];
}

function createBuildOrderInput(
  candidate: AiEconomyBuildCandidate,
  turnId: number,
  playerIdPrefix: string,
): Extract<OrderInput, { type: "BUILD" }> {
  return {
    type: "BUILD",
    turnId,
    playerId: `${playerIdPrefix}:${candidate.countryId}`,
    countryId: candidate.countryId,
    regionId: candidate.regionId,
    targetHexId: candidate.orderDraft.targetHexId as Extract<OrderInput, { type: "BUILD" }>["targetHexId"],
    payload: candidate.orderDraft.payload,
  };
}

function createColonizeOrderInput(
  candidate: AiColonizationCandidate,
  turnId: number,
  playerIdPrefix: string,
): Extract<OrderInput, { type: "COLONIZE" }> {
  return {
    type: "COLONIZE",
    turnId,
    playerId: `${playerIdPrefix}:${candidate.countryId}`,
    countryId: candidate.countryId,
    regionId: candidate.regionId,
    payload: candidate.orderDraft.payload,
  };
}

function normalizePlayerIdPrefix(prefix: string | undefined): string {
  const normalized = prefix?.trim() ?? "";
  return normalized.length > 0 ? normalized : defaultAiPlayerIdPrefix;
}

export type AiOrderDraftRuntimeErrorDiagnostic = {
  code: string;
  message: string;
};

export type AiOrderDraftSubmitDiagnostics = {
  runtimeErrors?: AiOrderDraftRuntimeErrorDiagnostic[];
};

export type AiOrderDraftSubmitOutcome =
  | { ok: true; submittedOrderId?: string }
  | { ok: false; reason: string; diagnostics?: AiOrderDraftSubmitDiagnostics };

export type AiOrderDraftSubmitResult =
  | { ok: true; draft: AiOrderSubmissionDraft; submittedOrderId?: string }
  | { ok: false; draft: AiOrderSubmissionDraft; reason: string; diagnostics?: AiOrderDraftSubmitDiagnostics };

export type SubmitAiOrderDraftsParams = {
  drafts: AiOrderSubmissionDraft[];
  submitDraft: (draft: AiOrderSubmissionDraft) => Promise<AiOrderDraftSubmitOutcome>;
};

export async function submitAiOrderDrafts(params: SubmitAiOrderDraftsParams): Promise<AiOrderDraftSubmitResult[]> {
  const results: AiOrderDraftSubmitResult[] = [];
  for (const draft of params.drafts) {
    const result = await params.submitDraft(draft);
    results.push(
      result.ok
        ? { ok: true, draft, submittedOrderId: result.submittedOrderId }
        : {
            ok: false,
            draft,
            reason: normalizeRejectedReason(result.reason),
            ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
          },
    );
  }
  return results;
}

function normalizeRejectedReason(reason: string): string {
  const normalized = reason.trim();
  return normalized.length > 0 ? normalized : "AI_ORDER_REJECTED";
}

export type AiOrderDeltaSubmitter = (delta: OrderDelta) => Promise<AiOrderDraftSubmitOutcome>;

export function createAiOrderDeltaSubmitter(submitOrderDelta: AiOrderDeltaSubmitter): SubmitAiOrderDraftsParams["submitDraft"] {
  return async (draft) => submitOrderDelta(createOrderDeltaFromAiDraft(draft));
}

export function createOrderDeltaFromAiDraft(draft: AiOrderSubmissionDraft): OrderDelta {
  return { type: "ORDER_DELTA", order: draft.order };
}
