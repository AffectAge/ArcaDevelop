import type { DiplomacyProposal, Division, WorldBase } from "@arcanorum/shared";
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

export type AiMilitaryMoveCandidate = {
  kind: "army-move";
  countryId: string;
  divisionId: string;
  fromProvinceId: string;
  targetProvinceId: string;
  requiresValidatedPipeline: true;
  orderDraft: {
    type: "ARMY_MOVE";
    countryId: string;
    provinceId: string;
    payload: {
      divisionId: string;
      path: string[];
    };
  };
};

export type AiDiplomacyMilitaryCandidate = AiDiplomacyContactCandidate | AiMilitaryMoveCandidate;

export type AiDiplomacyMilitaryCandidateParams = {
  context: AiCountryContext;
  world: Pick<WorldBase, "diplomacyProposals" | "divisionsById" | "provinceOwner">;
  knownCountryIds: string[];
  provinceAdjacencyById?: Record<string, string[]>;
  maxDiplomacyTargets?: number;
  maxMilitaryMoves?: number;
  expiresInTurns?: number;
};

const defaultMaxDiplomacyTargets = 3;
const defaultMaxMilitaryMoves = 3;
const defaultExpiresInTurns = 12;
const activeDiplomacyProposalStatuses = new Set<DiplomacyProposal["status"]>(["pending", "renewal_pending"]);

export function selectAiDiplomacyMilitaryCandidates(
  params: AiDiplomacyMilitaryCandidateParams,
): AiDiplomacyMilitaryCandidate[] {
  return [
    ...selectAiDiplomacyContactCandidates(params),
    ...selectAiMilitaryMoveCandidates(params),
  ].sort(compareAiDiplomacyMilitaryCandidates);
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

function selectAiMilitaryMoveCandidates(
  params: AiDiplomacyMilitaryCandidateParams,
): AiMilitaryMoveCandidate[] {
  const maxMoves = normalizeLimit(params.maxMilitaryMoves, defaultMaxMilitaryMoves);
  if (maxMoves <= 0) return [];

  const candidates: AiMilitaryMoveCandidate[] = [];
  const divisions = Object.values(params.world.divisionsById)
    .filter((division) => isMovableDivisionForCountry(division, params.context.countryId))
    .sort(compareDivisions);

  for (const division of divisions) {
    const targetProvinceId = selectRepositionTargetProvince({
      countryId: params.context.countryId,
      division,
      provinceOwner: params.world.provinceOwner,
      provinceAdjacencyById: params.provinceAdjacencyById ?? {},
    });
    if (!targetProvinceId) continue;
    candidates.push({
      kind: "army-move",
      countryId: params.context.countryId,
      divisionId: division.id,
      fromProvinceId: division.provinceId,
      targetProvinceId,
      requiresValidatedPipeline: true,
      orderDraft: {
        type: "ARMY_MOVE",
        countryId: params.context.countryId,
        provinceId: targetProvinceId,
        payload: {
          divisionId: division.id,
          path: [targetProvinceId],
        },
      },
    });
    if (candidates.length >= maxMoves) break;
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

function isMovableDivisionForCountry(division: Division, countryId: string): boolean {
  return (
    division.countryId === countryId &&
    (division.kind ?? "land") === "land" &&
    division.status === "idle" &&
    division.strength > 0 &&
    division.organization > 0 &&
    division.provinceId.length > 0
  );
}

function selectRepositionTargetProvince(params: {
  countryId: string;
  division: Division;
  provinceOwner: Record<string, string>;
  provinceAdjacencyById: Record<string, string[]>;
}): string | null {
  const adjacentProvinceIds = [...(params.provinceAdjacencyById[params.division.provinceId] ?? [])]
    .filter((provinceId) => provinceId !== params.division.provinceId)
    .filter((provinceId) => params.provinceOwner[provinceId] === params.countryId)
    .sort();
  return adjacentProvinceIds[0] ?? null;
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function compareDivisions(left: Division, right: Division): number {
  return left.id.localeCompare(right.id);
}

function compareAiDiplomacyMilitaryCandidates(
  left: AiDiplomacyMilitaryCandidate,
  right: AiDiplomacyMilitaryCandidate,
): number {
  return getCandidateSortKey(left).localeCompare(getCandidateSortKey(right));
}

function getCandidateSortKey(candidate: AiDiplomacyMilitaryCandidate): string {
  if (candidate.kind === "diplomacy-contact") {
    return `${candidate.kind}:${candidate.countryId}:${candidate.targetCountryId}`;
  }
  return `${candidate.kind}:${candidate.countryId}:${candidate.divisionId}:${candidate.targetProvinceId}`;
}
