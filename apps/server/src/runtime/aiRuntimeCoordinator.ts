import type { OrderDelta, WorldBase, WsOutMessage } from "@arcanorum/shared";
import {
  createAiOrderDeltaSubmitter,
  createAiOrderDraftsFromPlan,
  submitAiOrderDrafts,
  type AiOrderDeltaSubmitter,
  type AiOrderDraftSubmitResult,
  type AiOrderSubmissionDraft,
} from "../ai/aiOrderSubmissionAdapter";
import { planAiRuntimeTick, type AiRuntimeCandidateProvider, type AiRuntimePlan } from "../ai/aiRuntimePlanner";
import type { AiStrategyProfile } from "../ai/aiStrategyScoring";
import type { GameSettings } from "./gameSettingsTypes";
import { submitAiOrderDeltaToRuntime } from "./websocketRuntime";

export type RunAiBuildOrderRuntimeCycleParams = {
  world: WorldBase;
  aiSettings: GameSettings["ai"];
  countryIds: string[];
  candidateProviders: AiRuntimeCandidateProvider[];
  submitOrderDelta: AiOrderDeltaSubmitter;
  aiPlayerIdPrefix?: string;
  strategyProfilesByCountryId?: Record<string, AiStrategyProfile[]>;
};

export type RunAiOrderRuntimeCycleParams = RunAiBuildOrderRuntimeCycleParams;

export type AiOrderRuntimeCycleResult = {
  plan: AiRuntimePlan;
  drafts: AiOrderSubmissionDraft[];
  submissions: AiOrderDraftSubmitResult[];
};

export type AiBuildOrderRuntimeCycleResult = AiOrderRuntimeCycleResult;

export async function runAiOrderRuntimeCycle(
  params: RunAiOrderRuntimeCycleParams,
): Promise<AiOrderRuntimeCycleResult> {
  const plan = planAiRuntimeTick({
    world: params.world,
    aiSettings: params.aiSettings,
    countryIds: params.countryIds,
    candidateProviders: params.candidateProviders,
    strategyProfilesByCountryId: params.strategyProfilesByCountryId,
  });
  if (!plan.enabled) {
    return { plan, drafts: [], submissions: [] };
  }

  const drafts = createAiOrderDraftsFromPlan({
    plan,
    aiPlayerIdPrefix: params.aiPlayerIdPrefix,
  });
  const submissions = await submitAiOrderDrafts({
    drafts,
    submitDraft: createAiOrderDeltaSubmitter(params.submitOrderDelta),
  });

  return { plan, drafts, submissions };
}

export async function runAiBuildOrderRuntimeCycle(
  params: RunAiBuildOrderRuntimeCycleParams,
): Promise<AiBuildOrderRuntimeCycleResult> {
  return runAiOrderRuntimeCycle(params);
}

export type AiOrderDeltaRuntimeParams = Parameters<typeof submitAiOrderDeltaToRuntime>[0]["params"];

export function createRuntimeAiOrderDeltaSubmitter(params: {
  runtimeParams: AiOrderDeltaRuntimeParams;
  onError?: (message: Extract<WsOutMessage, { type: "ERROR" }>) => void;
}): AiOrderDeltaSubmitter {
  return async (delta: OrderDelta) => {
    const errors: Array<Extract<WsOutMessage, { type: "ERROR" }>> = [];
    await submitAiOrderDeltaToRuntime({
      params: params.runtimeParams,
      msg: delta,
      send: (message) => {
        if (message.type === "ERROR") {
          errors.push(message);
          params.onError?.(message);
        }
      },
    });
    const firstError = errors[0];
    return firstError
      ? {
          ok: false,
          reason: firstError.code,
          diagnostics: { runtimeErrors: errors.map(toRuntimeErrorDiagnostic) },
        }
      : { ok: true };
  };
}

function toRuntimeErrorDiagnostic(message: Extract<WsOutMessage, { type: "ERROR" }>): { code: string; message: string } {
  return { code: message.code, message: message.message };
}

export async function runAiOrderRuntimeCycleWithRuntimeSubmitter(
  params: Omit<RunAiOrderRuntimeCycleParams, "submitOrderDelta"> & {
    runtimeParams: AiOrderDeltaRuntimeParams;
    onSubmissionError?: (message: Extract<WsOutMessage, { type: "ERROR" }>) => void;
  },
): Promise<AiOrderRuntimeCycleResult> {
  return runAiOrderRuntimeCycle({
    ...params,
    submitOrderDelta: createRuntimeAiOrderDeltaSubmitter({
      runtimeParams: params.runtimeParams,
      onError: params.onSubmissionError,
    }),
  });
}

export async function runAiBuildOrderRuntimeCycleWithRuntimeSubmitter(
  params: Omit<RunAiBuildOrderRuntimeCycleParams, "submitOrderDelta"> & {
    runtimeParams: AiOrderDeltaRuntimeParams;
    onSubmissionError?: (message: Extract<WsOutMessage, { type: "ERROR" }>) => void;
  },
): Promise<AiBuildOrderRuntimeCycleResult> {
  return runAiOrderRuntimeCycleWithRuntimeSubmitter(params);
}
