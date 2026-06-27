import type {
  DiplomacyProposal,
  ResourceFlowSourceType,
  ResourceId,
  ResourceTotals,
  TreatyConstructionExpirationPolicy,
  WorldBase,
} from "@arcanorum/shared";
import { transferStateOwnedBuildingsToController } from "./buildingMechanics";

export type DiplomacyResourceTransferWorldState = Pick<WorldBase, "resourcesByCountry" | "diplomacyProposals">;

export type DiplomacyLedgerFlowInput = {
  countryId: string;
  resourceId: ResourceId;
  amount: number;
  sourceType: ResourceFlowSourceType;
  sourceId: string;
  categoryId: string;
  labelKey: string;
  labelParams?: Record<string, string | number | boolean | null>;
  metadata?: Record<string, string | number | boolean | null>;
};

export type DiplomacyInfrastructureSettings<TMode extends string = string> = {
  markets: {
    infrastructureTransitAgreementsById: Record<
      string,
      {
        id: string;
        fromCountryId: string;
        toCountryId: string;
        transportModes: TMode[];
        active: boolean;
        bilateral: boolean;
        sourceProposalId?: string | null;
        sourceClauseId?: string | null;
        expiresTurnId?: number | null;
        createdAt: string;
        updatedAt: string;
      }
    >;
    infrastructureConstructionRightsById: Record<
      string,
      {
        id: string;
        fromCountryId: string;
        toCountryId: string;
        transportModes: TMode[];
        active: boolean;
        bilateral: boolean;
        expirationPolicy: TreatyConstructionExpirationPolicy;
        sourceProposalId?: string | null;
        sourceClauseId?: string | null;
        expiresTurnId?: number | null;
        createdAt: string;
        updatedAt: string;
      }
    >;
    transportCorridorsById: Record<
      string,
      {
        ownerCountryId: string;
        transportMode: TMode;
        foreignConstructionRights?: Array<{
          grantorCountryId: string;
          expirationPolicy: TreatyConstructionExpirationPolicy;
          sourceProposalId?: string | null;
          sourceClauseId?: string | null;
        }>;
        nationalizedAt?: string | null;
        nationalizedFromCountryId?: string | null;
      }
    >;
  };
};

export type TreatyMoneyTransferResult = {
  proposalId: string;
  clauseId: string;
  fromCountryId: string;
  toCountryId: string;
  resource: keyof ResourceTotals;
  requested: number;
  paid: number;
};

function roundDiplomacyNumber(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}

export function getTreatyDurationTurns(proposal: DiplomacyProposal): number {
  return Math.max(1, proposal.expiresTurnId - proposal.createdTurnId);
}

export function serializeDiplomacyProposal(proposal: DiplomacyProposal): DiplomacyProposal {
  return structuredClone(proposal);
}

export function getDiplomacyCounterpartyId(proposal: DiplomacyProposal, countryId: string): string {
  return proposal.fromCountryId === countryId ? proposal.toCountryId : proposal.fromCountryId;
}

export function refreshExpiredDiplomacyProposals(params: {
  proposals: DiplomacyProposal[];
  turnId: number;
  normalizeDiplomacyProposals: (input: unknown) => DiplomacyProposal[];
  upsertInfrastructureRightsFromTreaty: (proposal: DiplomacyProposal) => void;
  expireInfrastructureConstructionRightsForProposal: (proposal: DiplomacyProposal) => void;
  nowIso?: string;
}): { proposals: DiplomacyProposal[]; changed: boolean } {
  const now = params.nowIso ?? new Date().toISOString();
  let changed = false;
  const proposals = params.normalizeDiplomacyProposals(params.proposals);
  for (const proposal of proposals) {
    if (proposal.status === "accepted" && proposal.expiresTurnId >= params.turnId) {
      params.upsertInfrastructureRightsFromTreaty(proposal);
    }
    if (proposal.status === "pending" && proposal.expiresTurnId < params.turnId) {
      proposal.status = "expired";
      proposal.resolvedAt = now;
      proposal.failureReason = "EXPIRED";
      changed = true;
    }
    if (proposal.status === "accepted" && proposal.expiresTurnId < params.turnId) {
      params.expireInfrastructureConstructionRightsForProposal(proposal);
      proposal.status = "renewal_pending";
      proposal.resolvedAt = null;
      proposal.resolvedByCountryId = null;
      proposal.failureReason = null;
      proposal.renewalAcceptedByCountryIds = [];
      changed = true;
    }
  }
  return { proposals, changed };
}

export function upsertInfrastructureRightsFromTreaty<TMode extends string>(params: {
  proposal: DiplomacyProposal;
  turnId: number;
  gameSettings: DiplomacyInfrastructureSettings<TMode>;
  normalizeTransportModes: (input: unknown) => TMode[];
  nowIso?: string;
}): void {
  const { proposal, gameSettings } = params;
  if (proposal.status !== "accepted" || proposal.expiresTurnId < params.turnId) return;
  const now = params.nowIso ?? new Date().toISOString();
  for (const clause of proposal.clauses) {
    if (clause.kind === "infrastructure_transit") {
      const agreementId = `treaty-${proposal.id}-${clause.id}`;
      const existing = gameSettings.markets.infrastructureTransitAgreementsById[agreementId];
      gameSettings.markets.infrastructureTransitAgreementsById[agreementId] = {
        id: agreementId,
        fromCountryId: clause.fromCountryId,
        toCountryId: clause.toCountryId,
        transportModes: params.normalizeTransportModes(clause.transportModes),
        active: true,
        bilateral: false,
        sourceProposalId: proposal.id,
        sourceClauseId: clause.id,
        expiresTurnId: proposal.expiresTurnId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: existing?.updatedAt ?? now,
      };
    }
    if (clause.kind === "infrastructure_construction_rights") {
      const agreementId = `treaty-${proposal.id}-${clause.id}`;
      const existing = gameSettings.markets.infrastructureConstructionRightsById[agreementId];
      gameSettings.markets.infrastructureConstructionRightsById[agreementId] = {
        id: agreementId,
        fromCountryId: clause.fromCountryId,
        toCountryId: clause.toCountryId,
        transportModes: params.normalizeTransportModes(clause.transportModes),
        active: true,
        bilateral: false,
        expirationPolicy: clause.expirationPolicy,
        sourceProposalId: proposal.id,
        sourceClauseId: clause.id,
        expiresTurnId: proposal.expiresTurnId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: existing?.updatedAt ?? now,
      };
    }
  }
}

export function expireInfrastructureConstructionRightsForProposal<TMode extends string>(params: {
  proposal: DiplomacyProposal;
  gameSettings: DiplomacyInfrastructureSettings<TMode>;
  nowIso?: string;
}): void {
  const now = params.nowIso ?? new Date().toISOString();
  const constructionClauses = params.proposal.clauses.filter(
    (clause) => clause.kind === "infrastructure_construction_rights",
  );
  if (constructionClauses.length === 0) return;
  for (const clause of constructionClauses) {
    const agreementId = `treaty-${params.proposal.id}-${clause.id}`;
    const agreement = params.gameSettings.markets.infrastructureConstructionRightsById[agreementId];
    if (agreement) {
      agreement.active = false;
      agreement.updatedAt = now;
    }
    if (clause.expirationPolicy !== "nationalize_to_territory_owner") continue;
    for (const corridor of Object.values(params.gameSettings.markets.transportCorridorsById ?? {})) {
      const matchingRights = (corridor.foreignConstructionRights ?? []).filter(
        (entry) =>
          entry.sourceProposalId === params.proposal.id &&
          entry.sourceClauseId === clause.id &&
          entry.expirationPolicy === "nationalize_to_territory_owner",
      );
      if (matchingRights.length === 0) continue;
      const previousOwnerCountryId = corridor.ownerCountryId;
      const nextOwnerCountryId = matchingRights[0]?.grantorCountryId;
      if (!nextOwnerCountryId || nextOwnerCountryId === previousOwnerCountryId) continue;
      corridor.ownerCountryId = nextOwnerCountryId;
      corridor.nationalizedAt = now;
      corridor.nationalizedFromCountryId = previousOwnerCountryId;
      corridor.foreignConstructionRights = (corridor.foreignConstructionRights ?? []).filter(
        (entry) => !(entry.sourceProposalId === params.proposal.id && entry.sourceClauseId === clause.id),
      );
    }
  }
}

export function applyTreatyMoneyTransferOnce(params: {
  resourcesByCountry: Record<string, ResourceTotals>;
  fromCountryId: string;
  toCountryId: string;
  resource: keyof ResourceTotals;
  amount: number;
  ensureCountryInWorldBase: (countryId: string) => void;
  addExpense?: (input: DiplomacyLedgerFlowInput) => void;
  addIncome?: (input: DiplomacyLedgerFlowInput) => void;
  sourceId?: string;
}): number {
  params.ensureCountryInWorldBase(params.fromCountryId);
  params.ensureCountryInWorldBase(params.toCountryId);
  const from = params.resourcesByCountry[params.fromCountryId];
  const to = params.resourcesByCountry[params.toCountryId];
  if (!from || !to) return 0;
  const available = Math.max(0, Number(from[params.resource] ?? 0));
  const paid = roundDiplomacyNumber(Math.min(available, Math.max(0, Number(params.amount))));
  if (paid <= 0) return 0;
  const sourceId = params.sourceId ?? `diplomacy:${params.fromCountryId}:${params.toCountryId}:${params.resource}`;
  params.addExpense?.({
    countryId: params.fromCountryId,
    resourceId: params.resource,
    amount: paid,
    sourceType: "diplomacy",
    sourceId,
    categoryId: "diplomacy",
    labelKey: "resourceLedger.source.diplomacy.transferExpense",
    metadata: { toCountryId: params.toCountryId },
  });
  params.addIncome?.({
    countryId: params.toCountryId,
    resourceId: params.resource,
    amount: paid,
    sourceType: "diplomacy",
    sourceId,
    categoryId: "diplomacy",
    labelKey: "resourceLedger.source.diplomacy.transferIncome",
    metadata: { fromCountryId: params.fromCountryId },
  });
  if (!params.addExpense || !params.addIncome) {
    from[params.resource] = roundDiplomacyNumber(available - paid);
    to[params.resource] = roundDiplomacyNumber(Math.max(0, Number(to[params.resource] ?? 0)) + paid);
  }
  return paid;
}

export function applyTreatyClauses<TMode extends string>(params: {
  proposal: DiplomacyProposal;
  worldBase: Pick<
    WorldBase,
    "resourcesByCountry" | "regionOwner" | "regionController" | "colonyProgressByRegion" | "regionBuildingsByRegion"
  >;
  gameSettings: DiplomacyInfrastructureSettings<TMode>;
  ensureCountryInWorldBase: (countryId: string) => void;
  normalizeTransportModes: (input: unknown) => TMode[];
  nowIso?: string;
  addExpense?: (input: DiplomacyLedgerFlowInput) => void;
  addIncome?: (input: DiplomacyLedgerFlowInput) => void;
}): void {
  const now = params.nowIso ?? new Date().toISOString();
  for (const clause of params.proposal.clauses) {
    if (clause.kind === "transfer_money" && clause.paymentCadence === "once") {
      applyTreatyMoneyTransferOnce({
        resourcesByCountry: params.worldBase.resourcesByCountry,
        fromCountryId: clause.fromCountryId,
        toCountryId: clause.toCountryId,
        resource: clause.resource,
        amount: clause.amount,
        ensureCountryInWorldBase: params.ensureCountryInWorldBase,
        addExpense: params.addExpense,
        addIncome: params.addIncome,
        sourceId: `diplomacy:${params.proposal.id}:${clause.id}`,
      });
    } else if (clause.kind === "transfer_region") {
      params.worldBase.regionOwner[clause.regionId] = clause.toCountryId;
      params.worldBase.regionController[clause.regionId] = clause.toCountryId;
      transferStateOwnedBuildingsToController({
        worldBase: params.worldBase,
        regionId: clause.regionId,
        controllerCountryId: clause.toCountryId,
      });
      if (params.worldBase.colonyProgressByRegion[clause.regionId]) {
        delete params.worldBase.colonyProgressByRegion[clause.regionId];
      }
    } else if (clause.kind === "infrastructure_transit") {
      const agreementId = `treaty-${params.proposal.id}-${clause.id}`;
      const existing = params.gameSettings.markets.infrastructureTransitAgreementsById[agreementId];
      params.gameSettings.markets.infrastructureTransitAgreementsById[agreementId] = {
        id: agreementId,
        fromCountryId: clause.fromCountryId,
        toCountryId: clause.toCountryId,
        transportModes: params.normalizeTransportModes(clause.transportModes),
        active: true,
        bilateral: false,
        sourceProposalId: params.proposal.id,
        sourceClauseId: clause.id,
        expiresTurnId: params.proposal.expiresTurnId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
    } else if (clause.kind === "infrastructure_construction_rights") {
      const agreementId = `treaty-${params.proposal.id}-${clause.id}`;
      const existing = params.gameSettings.markets.infrastructureConstructionRightsById[agreementId];
      params.gameSettings.markets.infrastructureConstructionRightsById[agreementId] = {
        id: agreementId,
        fromCountryId: clause.fromCountryId,
        toCountryId: clause.toCountryId,
        transportModes: params.normalizeTransportModes(clause.transportModes),
        active: true,
        bilateral: false,
        expirationPolicy: clause.expirationPolicy,
        sourceProposalId: params.proposal.id,
        sourceClauseId: clause.id,
        expiresTurnId: params.proposal.expiresTurnId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
    }
  }
}

export function applyPerTurnTreatyMoneyTransfers(params: {
  worldBase: DiplomacyResourceTransferWorldState;
  turnId: number;
  ensureCountryInWorldBase: (countryId: string) => void;
  addExpense?: (input: DiplomacyLedgerFlowInput) => void;
  addIncome?: (input: DiplomacyLedgerFlowInput) => void;
}): TreatyMoneyTransferResult[] {
  const transfers: TreatyMoneyTransferResult[] = [];
  for (const proposal of params.worldBase.diplomacyProposals ?? []) {
    if (proposal.status !== "accepted" || proposal.expiresTurnId < params.turnId) continue;
    for (const clause of proposal.clauses) {
      if (clause.kind !== "transfer_money" || clause.paymentCadence !== "per_turn") continue;
      const paid = applyTreatyMoneyTransferOnce({
        resourcesByCountry: params.worldBase.resourcesByCountry,
        fromCountryId: clause.fromCountryId,
        toCountryId: clause.toCountryId,
        resource: clause.resource,
        amount: clause.amount,
        ensureCountryInWorldBase: params.ensureCountryInWorldBase,
        addExpense: params.addExpense,
        addIncome: params.addIncome,
        sourceId: `diplomacy:${proposal.id}:${clause.id}`,
      });
      if (paid <= 0) continue;
      transfers.push({
        proposalId: proposal.id,
        clauseId: clause.id,
        fromCountryId: clause.fromCountryId,
        toCountryId: clause.toCountryId,
        resource: clause.resource,
        requested: clause.amount,
        paid,
      });
    }
  }
  return transfers;
}

export function getAcceptedActiveTreatyProposals(proposals: DiplomacyProposal[], turnId: number): DiplomacyProposal[] {
  return proposals.filter((proposal) => proposal.status === "accepted" && proposal.expiresTurnId >= turnId);
}
