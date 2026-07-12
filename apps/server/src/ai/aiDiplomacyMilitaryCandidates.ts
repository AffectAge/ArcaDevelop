import type { DiplomacyProposal, WorldBase } from "@arcanorum/shared";
import type { AiCountryContext } from "./aiContext";

export type AiDiplomacyContactCandidate = {
  kind: "diplomacy-contact";
  countryId: string;
  targetCountryId: string;
  requiresValidatedPipeline: true;
  request: {
    route: "/diplomacy/proposals";
    body: {
      toCountryId: string;
      expiresInTurns: number;
      clauses: Array<{
        kind: "text_note";
        text: "ai.diplomacy.contact";
      }>;
    };
  };
};

export type AiDiplomacyMilitaryCandidate = AiDiplomacyContactCandidate;

export type AiDiplomacyMilitaryCandidateParams = {
  context: AiCountryContext;
  world: Pick<WorldBase, "diplomacyProposals">;
  knownCountryIds: string[];
  maxDiplomacyTargets?: number;
  expiresInTurns?: number;
};

const defaultMaxDiplomacyTargets = 3;
const defaultExpiresInTurns = 12;
const activeDiplomacyProposalStatuses = new Set<DiplomacyProposal["status"]>(["pending", "renewal_pending"]);

export function selectAiDiplomacyMilitaryCandidates(
  params: AiDiplomacyMilitaryCandidateParams,
): AiDiplomacyMilitaryCandidate[] {
  return selectAiDiplomacyContactCandidates(params).sort(compareAiDiplomacyMilitaryCandidates);
}

function selectAiDiplomacyContactCandidates(
  params: AiDiplomacyMilitaryCandidateParams,
): AiDiplomacyContactCandidate[] {
  const maxTargets = normalizeLimit(params.maxDiplomacyTargets, defaultMaxDiplomacyTargets);
  if (maxTargets <= 0) return [];

  const expiresInTurns = normalizePositiveInteger(params.expiresInTurns, defaultExpiresInTurns);
  const targetCountryIds = Array.from(new Set(params.knownCountryIds))
    .map((countryId) => countryId.trim())
    .filter((countryId) => countryId.length > 0 && countryId !== params.context.countryId)
    .sort();
  const candidates: AiDiplomacyContactCandidate[] = [];

  for (const targetCountryId of targetCountryIds) {
    if (hasActiveProposalBetween(params.world.diplomacyProposals, params.context.countryId, targetCountryId)) continue;
    candidates.push({
      kind: "diplomacy-contact",
      countryId: params.context.countryId,
      targetCountryId,
      requiresValidatedPipeline: true,
      request: {
        route: "/diplomacy/proposals",
        body: {
          toCountryId: targetCountryId,
          expiresInTurns,
          clauses: [
            {
              kind: "text_note",
              text: "ai.diplomacy.contact",
            },
          ],
        },
      },
    });
    if (candidates.length >= maxTargets) break;
  }

  return candidates;
}

function hasActiveProposalBetween(proposals: DiplomacyProposal[], countryId: string, targetCountryId: string): boolean {
  return proposals.some(
    (proposal) =>
      activeDiplomacyProposalStatuses.has(proposal.status) &&
      ((proposal.fromCountryId === countryId && proposal.toCountryId === targetCountryId) ||
        (proposal.fromCountryId === targetCountryId && proposal.toCountryId === countryId)),
  );
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function compareAiDiplomacyMilitaryCandidates(
  left: AiDiplomacyMilitaryCandidate,
  right: AiDiplomacyMilitaryCandidate,
): number {
  return getCandidateSortKey(left).localeCompare(getCandidateSortKey(right));
}

function getCandidateSortKey(candidate: AiDiplomacyMilitaryCandidate): string {
  return `${candidate.kind}:${candidate.countryId}:${candidate.targetCountryId}`;
}
