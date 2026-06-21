import type express from "express";
import type { DiplomacyProposal, EventLogEntry, TreatyClause, WorldBase, WsOutMessage } from "@arcanorum/shared";
import {
  applyPerTurnTreatyMoneyTransfers as applyPerTurnTreatyMoneyTransfersInState,
  applyTreatyClauses as applyTreatyClausesInState,
  expireInfrastructureConstructionRightsForProposal as expireInfrastructureConstructionRightsForProposalInState,
  getDiplomacyCounterpartyId as getDiplomacyCounterpartyIdFromState,
  getTreatyDurationTurns as getTreatyDurationTurnsFromState,
  refreshExpiredDiplomacyProposals as refreshExpiredDiplomacyProposalsInState,
  serializeDiplomacyProposal as serializeDiplomacyProposalFromState,
  upsertInfrastructureRightsFromTreaty as upsertInfrastructureRightsFromTreatyInState,
} from "../mechanics/diplomacyMechanics";
import { DEFAULT_TRADEABLE_TRANSPORT_MODES, normalizeGoodTransportModesList } from "../mechanics/marketTurnMechanics";
import { registerDiplomacyRoutes, type DiplomacyTreatyClausePayload } from "../routes/diplomacyRoutes";
import type { RouteAuth } from "../security/routeAuth";
import type { GameSettings } from "./gameSettingsTypes";
import { normalizeInfrastructureConstructionExpirationPolicy } from "./marketSettingsNormalizers";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";

type DiplomacyRuntimeParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  masks: {
    resourcesByCountry: number;
    regionOwner: number;
    regionController: number;
    colonyProgressByRegion: number;
    diplomacyProposals: number;
  };
  createId: () => string;
  getTurnId: () => number;
  getWorldBase: () => WorldBase;
  setDiplomacyProposals: (proposals: DiplomacyProposal[]) => void;
  getGameSettings: () => GameSettings;
  ensureCountryInWorldBase: (countryId: string) => void;
  countryExists: (countryId: string) => Promise<boolean>;
  normalizeDiplomacyProposals: (input: unknown) => DiplomacyProposal[];
  cloneWorldBaseSectionSnapshot: (mask: number) => unknown;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: unknown) => void;
  addResourceLedgerIncome?: (input: ResourceLedgerEntryInput) => void;
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
  flushResourceLedger?: () => void;
  removeQueuedUiNotification: (notificationId: string) => void;
  sendUiNotificationToCountry: (
    countryId: string,
    notification: Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"],
  ) => void;
  makeOfficialNews: (input: {
    turn: number;
    category: "diplomacy";
    title: string;
    message: string;
    countryId: string;
    priority: "medium";
    visibility: "private" | "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export type DiplomacyRuntime = {
  refreshExpiredDiplomacyProposals: () => void;
  registerRoutes: () => void;
  applyPerTurnTreatyMoneyTransfers: () => void;
};

export function createDiplomacyRuntime(params: DiplomacyRuntimeParams): DiplomacyRuntime {
  function refreshExpiredDiplomacyProposals(): void {
    const result = refreshExpiredDiplomacyProposalsInState({
      proposals: params.getWorldBase().diplomacyProposals,
      turnId: params.getTurnId(),
      normalizeDiplomacyProposals: params.normalizeDiplomacyProposals,
      upsertInfrastructureRightsFromTreaty,
      expireInfrastructureConstructionRightsForProposal,
    });
    params.setDiplomacyProposals(result.proposals);
    if (result.changed) params.savePersistentState();
  }

  function getTreatyDurationTurns(proposal: DiplomacyProposal): number {
    return getTreatyDurationTurnsFromState(proposal);
  }

  function serializeDiplomacyProposal(proposal: DiplomacyProposal): DiplomacyProposal {
    return serializeDiplomacyProposalFromState(proposal);
  }

  function getDiplomacyCounterpartyId(proposal: DiplomacyProposal, countryId: string): string {
    return getDiplomacyCounterpartyIdFromState(proposal, countryId);
  }

  function normalizeDiplomacyProposalName(
    name: string | undefined,
    fromCountryId: string,
    toCountryId: string,
    proposalNumber = 1,
  ): string {
    if (typeof name === "string" && name.trim()) return name.trim().slice(0, 120);
    return `Договор ${fromCountryId} - ${toCountryId} #${Math.max(1, Math.floor(Number(proposalNumber) || 1))}`;
  }

  function makeDiplomacyProposalUiNotification(input: {
    proposal: DiplomacyProposal;
    recipientCountryId: string;
    title: string;
    message: string;
  }): Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"] {
    const revision = Math.max(1, Math.floor(Number(input.proposal.revision ?? 1) || 1));
    return {
      id: `diplomacy-proposal:${input.proposal.id}:${input.recipientCountryId}:r${revision}`,
      category: "politics",
      createdAt: new Date().toISOString(),
      title: input.title,
      message: input.message,
      quickActions: [
        { id: "accept", label: "Подписать", kind: "primary" },
        { id: "revise", label: "Изменить", kind: "secondary" },
        { id: "reject", label: "Отклонить", kind: "danger" },
      ],
      action: {
        type: "diplomacy-proposal",
        proposalId: input.proposal.id,
        countryId: input.recipientCountryId,
        revision,
      },
    };
  }

  function sendDiplomacyProposalNotification(
    proposal: DiplomacyProposal,
    recipientCountryId: string,
    title: string,
    message: string,
  ): void {
    params.sendUiNotificationToCountry(
      recipientCountryId,
      makeDiplomacyProposalUiNotification({ proposal, recipientCountryId, title, message }),
    );
  }

  function getVisibleDiplomacyProposals(countryId: string): DiplomacyProposal[] {
    refreshExpiredDiplomacyProposals();
    return params.getWorldBase().diplomacyProposals
      .filter((proposal) => proposal.fromCountryId === countryId || proposal.toCountryId === countryId)
      .map(serializeDiplomacyProposal);
  }

  function upsertInfrastructureRightsFromTreaty(proposal: DiplomacyProposal): void {
    upsertInfrastructureRightsFromTreatyInState({
      proposal,
      turnId: params.getTurnId(),
      gameSettings: params.getGameSettings(),
      normalizeTransportModes: (input) => normalizeGoodTransportModesList(input, DEFAULT_TRADEABLE_TRANSPORT_MODES),
    });
  }

  function normalizeTreatyClausePayload(clause: DiplomacyTreatyClausePayload): TreatyClause {
    if (clause.kind === "transfer_money") {
      return {
        id: clause.id?.trim() || params.createId(),
        kind: "transfer_money",
        fromCountryId: clause.fromCountryId.trim(),
        toCountryId: clause.toCountryId.trim(),
        resource: clause.resource,
        amount: Number(clause.amount.toFixed(3)),
        paymentCadence: clause.paymentCadence ?? "once",
      };
    }
    if (clause.kind === "transfer_region") {
      return {
        id: clause.id?.trim() || params.createId(),
        kind: "transfer_region",
        fromCountryId: clause.fromCountryId.trim(),
        toCountryId: clause.toCountryId.trim(),
        regionId: clause.regionId.trim(),
      };
    }
    if (clause.kind === "infrastructure_transit") {
      return {
        id: clause.id?.trim() || params.createId(),
        kind: "infrastructure_transit",
        fromCountryId: clause.fromCountryId.trim(),
        toCountryId: clause.toCountryId.trim(),
        transportModes: normalizeGoodTransportModesList(clause.transportModes, DEFAULT_TRADEABLE_TRANSPORT_MODES),
      };
    }
    if (clause.kind === "infrastructure_construction_rights") {
      return {
        id: clause.id?.trim() || params.createId(),
        kind: "infrastructure_construction_rights",
        fromCountryId: clause.fromCountryId.trim(),
        toCountryId: clause.toCountryId.trim(),
        transportModes: normalizeGoodTransportModesList(clause.transportModes, DEFAULT_TRADEABLE_TRANSPORT_MODES),
        expirationPolicy: normalizeInfrastructureConstructionExpirationPolicy(clause.expirationPolicy),
      };
    }
    return {
      id: clause.id?.trim() || params.createId(),
      kind: "text_note",
      text: clause.text.trim(),
    };
  }

  async function validateTreatyClausesForProposal(
    fromCountryId: string,
    toCountryId: string,
    clauses: TreatyClause[],
    checkBalances: boolean,
  ): Promise<string | null> {
    const worldBase = params.getWorldBase();
    if (!(await params.countryExists(fromCountryId)) || !(await params.countryExists(toCountryId))) return "COUNTRY_NOT_FOUND";
    const partyIds = new Set([fromCountryId, toCountryId]);
    for (const clause of clauses) {
      if (clause.kind === "text_note") continue;
      if (!partyIds.has(clause.fromCountryId) || !partyIds.has(clause.toCountryId)) return "CLAUSE_COUNTRY_OUTSIDE_PARTIES";
      if (clause.fromCountryId === clause.toCountryId) return "CLAUSE_SAME_COUNTRY";
      if (clause.kind === "transfer_money") {
        if (clause.amount <= 0 || !Number.isFinite(clause.amount)) return "INVALID_MONEY_AMOUNT";
        if (checkBalances) {
          if (clause.paymentCadence === "per_turn") continue;
          params.ensureCountryInWorldBase(clause.fromCountryId);
          const available = Number(worldBase.resourcesByCountry[clause.fromCountryId]?.[clause.resource] ?? 0);
          if (available < clause.amount) return "INSUFFICIENT_FUNDS";
        }
      }
      if (clause.kind === "transfer_region") {
        if ((worldBase.regionOwner[clause.regionId] ?? null) !== clause.fromCountryId) return "REGION_NOT_OWNED";
      }
      if (clause.kind === "infrastructure_transit" || clause.kind === "infrastructure_construction_rights") {
        if (!Array.isArray(clause.transportModes) || clause.transportModes.length === 0) return "INVALID_TRANSPORT_MODES";
      }
    }
    return null;
  }

  function expireInfrastructureConstructionRightsForProposal(proposal: DiplomacyProposal): void {
    expireInfrastructureConstructionRightsForProposalInState({
      proposal,
      gameSettings: params.getGameSettings(),
    });
  }

  function applyTreatyClauses(proposal: DiplomacyProposal): void {
    applyTreatyClausesInState({
      proposal,
      worldBase: params.getWorldBase(),
      gameSettings: params.getGameSettings(),
      ensureCountryInWorldBase: params.ensureCountryInWorldBase,
      normalizeTransportModes: (input) => normalizeGoodTransportModesList(input, DEFAULT_TRADEABLE_TRANSPORT_MODES),
      addExpense: params.addResourceLedgerExpense,
      addIncome: params.addResourceLedgerIncome,
    });
    params.flushResourceLedger?.();
  }

  function applyPerTurnTreatyMoneyTransfers(): void {
    applyPerTurnTreatyMoneyTransfersInState({
      worldBase: params.getWorldBase(),
      turnId: params.getTurnId(),
      ensureCountryInWorldBase: params.ensureCountryInWorldBase,
      addExpense: params.addResourceLedgerExpense,
      addIncome: params.addResourceLedgerIncome,
    });
    params.flushResourceLedger?.();
  }

  function registerRoutes(): void {
    registerDiplomacyRoutes(params.app, {
      routeAuth: params.routeAuth,
      masks: params.masks,
      createId: params.createId,
      getTurnId: params.getTurnId,
      getDiplomacyProposals: () => params.getWorldBase().diplomacyProposals,
      normalizeTreatyClausePayload,
      normalizeDiplomacyProposalName,
      validateTreatyClausesForProposal,
      refreshExpiredDiplomacyProposals,
      getTreatyDurationTurns,
      serializeDiplomacyProposal,
      getDiplomacyCounterpartyId,
      getVisibleDiplomacyProposals,
      applyTreatyClauses,
      cloneWorldBaseSectionSnapshot: params.cloneWorldBaseSectionSnapshot,
      savePersistentState: params.savePersistentState,
      broadcastWorldDeltaFromSectionSnapshot: params.broadcastWorldDeltaFromSectionSnapshot,
      removeQueuedUiNotification: params.removeQueuedUiNotification,
      sendDiplomacyProposalNotification,
      makeOfficialNews: params.makeOfficialNews,
      broadcast: params.broadcast,
    });
  }

  return {
    refreshExpiredDiplomacyProposals,
    registerRoutes,
    applyPerTurnTreatyMoneyTransfers,
  };
}
