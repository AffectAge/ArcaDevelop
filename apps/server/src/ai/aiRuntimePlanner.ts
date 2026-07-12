import type { WorldBase } from "@arcanorum/shared";
import {
  buildAiCountryContext,
  buildAiWorldIndexes,
  type AiCountryContext,
  type AiWorldIndexes,
} from "./aiContext";
import {
  resolveAiStrategyProfile,
  scoreAiCandidates,
  type AiCandidate,
  type AiStrategyProfile,
  type ScoredAiCandidate,
} from "./aiStrategyScoring";

export type AiRuntimeSettings = {
  enabled: boolean;
  maxCountriesPerTick: number;
  maxDecisionCandidatesPerCountry: number;
  contextCacheTtlTurns: number;
  maxBuildCompletionTurns: number;
};

export type AiRuntimeCandidateProvider = {
  id: string;
  selectCandidates: (params: {
    countryId: string;
    context: AiCountryContext;
    world: WorldBase;
    indexes: AiWorldIndexes;
    aiSettings: AiRuntimeSettings;
    profile: ReturnType<typeof resolveAiStrategyProfile>;
  }) => AiCandidate[];
};

export type PlannedAiCountryAction = {
  countryId: string;
  candidateCount: number;
  selected: ScoredAiCandidate | null;
};

export type AiRuntimePlan = {
  enabled: boolean;
  turnId: number;
  processedCountryIds: string[];
  skippedCountryIds: string[];
  actions: PlannedAiCountryAction[];
  budget: {
    maxCountriesPerTick: number;
    maxDecisionCandidatesPerCountry: number;
    contextCacheTtlTurns: number;
    maxBuildCompletionTurns: number;
  };
};

export type PlanAiRuntimeTickParams = {
  world: WorldBase;
  aiSettings: AiRuntimeSettings;
  countryIds: string[];
  candidateProviders: AiRuntimeCandidateProvider[];
  strategyProfilesByCountryId?: Record<string, AiStrategyProfile[]>;
};

export function planAiRuntimeTick(params: PlanAiRuntimeTickParams): AiRuntimePlan {
  const budget = normalizeAiRuntimeBudget(params.aiSettings);
  const countryIds = normalizeCountryIds(params.countryIds);
  if (!params.aiSettings.enabled) {
    return {
      enabled: false,
      turnId: params.world.turnId,
      processedCountryIds: [],
      skippedCountryIds: countryIds,
      actions: [],
      budget,
    };
  }

  const indexes = buildAiWorldIndexes(params.world);
  const processedCountryIds = countryIds.slice(0, budget.maxCountriesPerTick);
  const skippedCountryIds = countryIds.slice(budget.maxCountriesPerTick);
  const providers = normalizeCandidateProviders(params.candidateProviders);
  const actions = processedCountryIds.map((countryId) =>
    planCountryAction({
      countryId,
      world: params.world,
      indexes,
      providers,
      maxDecisionCandidates: budget.maxDecisionCandidatesPerCountry,
      aiSettings: {
        ...params.aiSettings,
        maxCountriesPerTick: budget.maxCountriesPerTick,
        maxDecisionCandidatesPerCountry: budget.maxDecisionCandidatesPerCountry,
        contextCacheTtlTurns: budget.contextCacheTtlTurns,
        maxBuildCompletionTurns: budget.maxBuildCompletionTurns,
      },
      profiles: params.strategyProfilesByCountryId?.[countryId] ?? [],
    }),
  );

  return {
    enabled: true,
    turnId: params.world.turnId,
    processedCountryIds,
    skippedCountryIds,
    actions,
    budget,
  };
}

function planCountryAction(params: {
  countryId: string;
  world: WorldBase;
  indexes: AiWorldIndexes;
  providers: AiRuntimeCandidateProvider[];
  maxDecisionCandidates: number;
  aiSettings: AiRuntimeSettings;
  profiles: AiStrategyProfile[];
}): PlannedAiCountryAction {
  const context = buildAiCountryContext({
    countryId: params.countryId,
    world: params.world,
    indexes: params.indexes,
  });
  const profile = resolveAiStrategyProfile(params.profiles);
  const candidates = params.providers
    .flatMap((provider) =>
      provider.selectCandidates({
        countryId: params.countryId,
        context,
        world: params.world,
        indexes: params.indexes,
        aiSettings: {
          ...params.aiSettings,
          maxBuildCompletionTurns: profile.maxBuildCompletionTurns ?? params.aiSettings.maxBuildCompletionTurns,
        },
        profile,
      }),
    )
    .sort(compareAiCandidatesByIdentity)
    .slice(0, params.maxDecisionCandidates);
  const selected = scoreAiCandidates(candidates, profile)[0] ?? null;

  return {
    countryId: params.countryId,
    candidateCount: candidates.length,
    selected,
  };
}

function normalizeAiRuntimeBudget(settings: AiRuntimeSettings): AiRuntimePlan["budget"] {
  return {
    maxCountriesPerTick: normalizePositiveInteger(settings.maxCountriesPerTick, 1),
    maxDecisionCandidatesPerCountry: normalizePositiveInteger(settings.maxDecisionCandidatesPerCountry, 1),
    contextCacheTtlTurns: normalizePositiveInteger(settings.contextCacheTtlTurns, 1),
    maxBuildCompletionTurns: normalizePositiveInteger(settings.maxBuildCompletionTurns, 8),
  };
}

function normalizeCountryIds(countryIds: string[]): string[] {
  return Array.from(
    new Set(countryIds.map((countryId) => countryId.trim()).filter((countryId) => countryId.length > 0)),
  ).sort();
}

function normalizeCandidateProviders(providers: AiRuntimeCandidateProvider[]): AiRuntimeCandidateProvider[] {
  return [...providers]
    .filter((provider) => provider.id.trim().length > 0)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function normalizePositiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

function compareAiCandidatesByIdentity(left: AiCandidate, right: AiCandidate): number {
  return getAiCandidateIdentity(left).localeCompare(getAiCandidateIdentity(right));
}

function getAiCandidateIdentity(candidate: AiCandidate): string {
  if (candidate.kind === "build") {
    return `${candidate.kind}:${candidate.countryId}:${candidate.regionId}:${candidate.buildingId}`;
  }
  if (candidate.kind === "upgrade") {
    return `${candidate.kind}:${candidate.countryId}:${candidate.regionId}:${candidate.buildingId}:${candidate.instanceId}`;
  }
  if (candidate.kind === "market-import") {
    return `${candidate.kind}:${candidate.countryId}:${candidate.goodId}:${candidate.targetMarketId}:${candidate.sourceMarketId}`;
  }
  if (candidate.kind === "diplomacy-contact") {
    return `${candidate.kind}:${candidate.countryId}:${candidate.targetCountryId}`;
  }
  return "unknown";
}
