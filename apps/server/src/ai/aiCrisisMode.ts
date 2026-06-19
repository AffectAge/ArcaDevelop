import type { AiCountryContext } from "./aiContext";
import type { AiMarketImportCandidate } from "./aiMarketCandidates";
import type { AiStrategyProfile } from "./aiStrategyScoring";

export type AiCrisisSignalKind = "treasury-low" | "landless" | "market-shortage";

export type AiCrisisConfig = {
  enabled: boolean;
  ducatsCriticalBelow?: number | null;
  requireControlledRegion?: boolean | null;
  marketShortageCriticalAt?: number | null;
  priorityOverrides?: AiStrategyProfile;
};

export type AiCrisisSignal = {
  kind: AiCrisisSignalKind;
  severity: "warning" | "critical";
  value: number;
  threshold: number;
  goodId?: string;
};

export type AiCrisisAssessment = {
  active: boolean;
  signals: AiCrisisSignal[];
  priorityProfile: AiStrategyProfile | null;
};

export function assessAiCrisis(params: {
  context: AiCountryContext;
  marketImportCandidates: AiMarketImportCandidate[];
  config: AiCrisisConfig;
}): AiCrisisAssessment {
  if (!params.config.enabled) {
    return { active: false, signals: [], priorityProfile: null };
  }

  const signals = [
    detectTreasurySignal(params.context, params.config),
    detectLandlessSignal(params.context, params.config),
    detectMarketShortageSignal(params.marketImportCandidates, params.config),
  ].filter((signal): signal is AiCrisisSignal => signal != null);
  const active = signals.some((signal) => signal.severity === "critical");

  return {
    active,
    signals: signals.sort(compareCrisisSignals),
    priorityProfile: active ? (params.config.priorityOverrides ?? null) : null,
  };
}

function detectTreasurySignal(context: AiCountryContext, config: AiCrisisConfig): AiCrisisSignal | null {
  const threshold = normalizePositiveThreshold(config.ducatsCriticalBelow);
  if (threshold == null) return null;
  const value = Math.max(0, Number(context.resources.ducats ?? 0));
  if (value >= threshold) return null;
  return {
    kind: "treasury-low",
    severity: value <= threshold / 2 ? "critical" : "warning",
    value: round3(value),
    threshold,
  };
}

function detectLandlessSignal(context: AiCountryContext, config: AiCrisisConfig): AiCrisisSignal | null {
  if (config.requireControlledRegion !== true) return null;
  const value = context.controlledRegionIds.length;
  if (value > 0) return null;
  return {
    kind: "landless",
    severity: "critical",
    value,
    threshold: 1,
  };
}

function detectMarketShortageSignal(
  candidates: AiMarketImportCandidate[],
  config: AiCrisisConfig,
): AiCrisisSignal | null {
  const threshold = normalizePositiveThreshold(config.marketShortageCriticalAt);
  if (threshold == null) return null;
  const topCandidate = [...candidates].sort((left, right) => right.shortageAmount - left.shortageAmount)[0] ?? null;
  if (!topCandidate || topCandidate.shortageAmount < threshold) return null;
  return {
    kind: "market-shortage",
    severity: topCandidate.shortageAmount >= threshold * 2 ? "critical" : "warning",
    value: round3(topCandidate.shortageAmount),
    threshold,
    goodId: topCandidate.goodId,
  };
}

function normalizePositiveThreshold(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? round3(value) : null;
}

function compareCrisisSignals(left: AiCrisisSignal, right: AiCrisisSignal): number {
  return compareSeverity(left.severity, right.severity) || left.kind.localeCompare(right.kind) || (left.goodId ?? "").localeCompare(right.goodId ?? "");
}

function compareSeverity(left: AiCrisisSignal["severity"], right: AiCrisisSignal["severity"]): number {
  const weight: Record<AiCrisisSignal["severity"], number> = { critical: 0, warning: 1 };
  return weight[left] - weight[right];
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
