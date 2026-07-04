import type { AiColonizationCandidate } from "./aiColonizationCandidates";
import type { AiDiplomacyMilitaryCandidate } from "./aiDiplomacyMilitaryCandidates";
import type { AiEconomyOrderCandidate } from "./aiEconomyCandidates";
import type { AiMarketImportCandidate } from "./aiMarketCandidates";

export type AiCandidate =
  | AiEconomyOrderCandidate
  | AiMarketImportCandidate
  | AiDiplomacyMilitaryCandidate
  | AiColonizationCandidate;

export type AiStrategyWeights = {
  economyBuild: number;
  economyUpgrade: number;
  marketImport: number;
  diplomacyContact: number;
  militaryMove: number;
  colonization: number;
};

export type AiStrategyProfile = {
  id: string;
  weights?: Partial<AiStrategyWeights>;
  maxBuildCompletionTurns?: number;
  buildingWeights?: Record<string, number>;
  goodWeights?: Record<string, number>;
  regionWeights?: Record<string, number>;
};

export type ResolvedAiStrategyProfile = {
  weights: AiStrategyWeights;
  maxBuildCompletionTurns: number | null;
  buildingWeights: Record<string, number>;
  goodWeights: Record<string, number>;
  regionWeights: Record<string, number>;
};

export type ScoredAiCandidate<TCandidate extends AiCandidate = AiCandidate> = {
  candidate: TCandidate;
  score: number;
  reason: {
    baseWeight: number;
    buildingWeight: number;
    goodWeight: number;
    regionWeight: number;
  };
};

const defaultWeights: AiStrategyWeights = {
  economyBuild: 1,
  economyUpgrade: 1,
  marketImport: 1,
  diplomacyContact: 1,
  militaryMove: 1,
  colonization: 1,
};

export function resolveAiStrategyProfile(profiles: AiStrategyProfile[]): ResolvedAiStrategyProfile {
  return profiles.reduce<ResolvedAiStrategyProfile>(
    (resolved, profile) => ({
      weights: {
        economyBuild: normalizeWeight(profile.weights?.economyBuild, resolved.weights.economyBuild),
        economyUpgrade: normalizeWeight(profile.weights?.economyUpgrade, resolved.weights.economyUpgrade),
        marketImport: normalizeWeight(profile.weights?.marketImport, resolved.weights.marketImport),
        diplomacyContact: normalizeWeight(profile.weights?.diplomacyContact, resolved.weights.diplomacyContact),
        militaryMove: normalizeWeight(profile.weights?.militaryMove, resolved.weights.militaryMove),
        colonization: normalizeWeight(profile.weights?.colonization, resolved.weights.colonization),
      },
      maxBuildCompletionTurns: normalizeOptionalPositiveInteger(
        profile.maxBuildCompletionTurns,
        resolved.maxBuildCompletionTurns,
      ),
      buildingWeights: mergeWeightMap(resolved.buildingWeights, profile.buildingWeights),
      goodWeights: mergeWeightMap(resolved.goodWeights, profile.goodWeights),
      regionWeights: mergeWeightMap(resolved.regionWeights, profile.regionWeights),
    }),
    {
      weights: defaultWeights,
      maxBuildCompletionTurns: null,
      buildingWeights: {},
      goodWeights: {},
      regionWeights: {},
    },
  );
}

export function scoreAiCandidates<TCandidate extends AiCandidate>(
  candidates: TCandidate[],
  profile: ResolvedAiStrategyProfile,
): Array<ScoredAiCandidate<TCandidate>> {
  return candidates
    .map((candidate) => scoreAiCandidate(candidate, profile))
    .sort(compareScoredAiCandidates);
}

export function selectTopAiCandidate<TCandidate extends AiCandidate>(
  candidates: TCandidate[],
  profile: ResolvedAiStrategyProfile,
): ScoredAiCandidate<TCandidate> | null {
  return scoreAiCandidates(candidates, profile)[0] ?? null;
}

function scoreAiCandidate<TCandidate extends AiCandidate>(
  candidate: TCandidate,
  profile: ResolvedAiStrategyProfile,
): ScoredAiCandidate<TCandidate> {
  const baseWeight = getBaseWeight(candidate, profile.weights);
  const buildingWeight = getBuildingWeight(candidate, profile.buildingWeights);
  const goodWeight = getGoodWeight(candidate, profile.goodWeights);
  const regionWeight = getRegionWeight(candidate, profile.regionWeights);
  const score = round3(baseWeight + buildingWeight + goodWeight + regionWeight);
  return {
    candidate,
    score,
    reason: { baseWeight, buildingWeight, goodWeight, regionWeight },
  };
}

function getBaseWeight(candidate: AiCandidate, weights: AiStrategyWeights): number {
  if (candidate.kind === "build") return weights.economyBuild;
  if (candidate.kind === "upgrade") return weights.economyUpgrade;
  if (candidate.kind === "market-import") return weights.marketImport;
  if (candidate.kind === "diplomacy-contact") return weights.diplomacyContact;
  return weights.militaryMove;
}

function getBuildingWeight(candidate: AiCandidate, weights: Record<string, number>): number {
  if (candidate.kind === "build" || candidate.kind === "upgrade") return weights[candidate.buildingId] ?? 0;
  return 0;
}

function getGoodWeight(candidate: AiCandidate, weights: Record<string, number>): number {
  return candidate.kind === "market-import" ? (weights[candidate.goodId] ?? 0) : 0;
}

function getRegionWeight(candidate: AiCandidate, weights: Record<string, number>): number {
  return candidate.kind === "build" || candidate.kind === "upgrade"
    ? (weights[candidate.regionId] ?? 0)
    : 0;
}

function mergeWeightMap(base: Record<string, number>, override: Record<string, number> | undefined): Record<string, number> {
  if (!override) return base;
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) continue;
    merged[normalizedKey] = normalizeWeight(value, merged[normalizedKey] ?? 0);
  }
  return merged;
}

function normalizeWeight(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? round3(Math.max(0, Math.min(100, value))) : fallback;
}

function normalizeOptionalPositiveInteger(value: unknown, fallback: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(3_650, Math.floor(value)))
    : fallback;
}

function compareScoredAiCandidates<TCandidate extends AiCandidate>(
  left: ScoredAiCandidate<TCandidate>,
  right: ScoredAiCandidate<TCandidate>,
): number {
  return right.score - left.score || getCandidateSortKey(left.candidate).localeCompare(getCandidateSortKey(right.candidate));
}

function getCandidateSortKey(candidate: AiCandidate): string {
  if (candidate.kind === "market-import") {
    return `${candidate.kind}:${candidate.goodId}:${candidate.targetMarketId}:${candidate.sourceMarketId}`;
  }
  if (candidate.kind === "diplomacy-contact") {
    return `${candidate.kind}:${candidate.countryId}:${candidate.targetCountryId}`;
  }
  if (candidate.kind === "army-move") {
    return `${candidate.kind}:${candidate.countryId}:${candidate.divisionId}:${candidate.targetHexId}`;
  }
  return `${candidate.kind}:${candidate.regionId}:${candidate.buildingId}:${candidate.kind === "upgrade" ? candidate.instanceId : ""}`;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
