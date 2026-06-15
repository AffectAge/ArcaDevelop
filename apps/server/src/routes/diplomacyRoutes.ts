import type express from "express";
import type { DiplomacyProposal, EventLogEntry, TreatyClause, WsOutMessage } from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export const treatyClausePayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().trim().min(1).max(120).optional(),
    kind: z.literal("transfer_money"),
    fromCountryId: z.string().trim().min(1).max(120),
    toCountryId: z.string().trim().min(1).max(120),
    resource: z.enum(["ducats", "gold"]),
    amount: z.number().finite().positive(),
    paymentCadence: z.enum(["once", "per_turn"]).optional(),
  }),
  z.object({
    id: z.string().trim().min(1).max(120).optional(),
    kind: z.literal("transfer_region"),
    fromCountryId: z.string().trim().min(1).max(120),
    toCountryId: z.string().trim().min(1).max(120),
    regionId: z.string().trim().min(1).max(120),
  }),
  z.object({
    id: z.string().trim().min(1).max(120).optional(),
    kind: z.literal("infrastructure_transit"),
    fromCountryId: z.string().trim().min(1).max(120),
    toCountryId: z.string().trim().min(1).max(120),
    transportModes: z.array(z.enum(["land", "sea", "air", "pipeline", "powerGrid"])).min(1).max(16),
  }),
  z.object({
    id: z.string().trim().min(1).max(120).optional(),
    kind: z.literal("infrastructure_construction_rights"),
    fromCountryId: z.string().trim().min(1).max(120),
    toCountryId: z.string().trim().min(1).max(120),
    transportModes: z.array(z.enum(["land", "sea", "air", "pipeline", "powerGrid"])).min(1).max(16),
    expirationPolicy: z.enum(["disable_without_transit", "nationalize_to_territory_owner"]).optional(),
  }),
  z.object({
    id: z.string().trim().min(1).max(120).optional(),
    kind: z.literal("text_note"),
    text: z.string().trim().min(1).max(1000),
  }),
]);

export const diplomacyProposalCreateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  toCountryId: z.string().trim().min(1).max(120),
  expiresInTurns: z.number().int().min(1).max(20).optional(),
  clauses: z.array(treatyClausePayloadSchema).min(1).max(20),
});

export const diplomacyProposalReviseSchema = z.object({
  name: z.string().trim().max(120).optional(),
  expiresInTurns: z.number().int().min(1).max(20).optional(),
  clauses: z.array(treatyClausePayloadSchema).min(1).max(20),
});

export type DiplomacyTreatyClausePayload = z.infer<typeof treatyClausePayloadSchema>;

export type DiplomacyRouteMasks = {
  resourcesByCountry: number;
  regionOwner: number;
  regionController: number;
  colonyProgressByRegion: number;
  diplomacyProposals: number;
};

export type DiplomacyRoutesDependencies = {
  routeAuth: RouteAuth;
  masks: DiplomacyRouteMasks;
  createId: () => string;
  getTurnId: () => number;
  getDiplomacyProposals: () => DiplomacyProposal[];
  normalizeTreatyClausePayload: (clause: DiplomacyTreatyClausePayload) => TreatyClause;
  normalizeDiplomacyProposalName: (
    name: string | undefined,
    fromCountryId: string,
    toCountryId: string,
    proposalNumber: number,
  ) => string;
  validateTreatyClausesForProposal: (
    fromCountryId: string,
    toCountryId: string,
    clauses: TreatyClause[],
    checkBalances: boolean,
  ) => Promise<string | null>;
  refreshExpiredDiplomacyProposals: () => void;
  getTreatyDurationTurns: (proposal: DiplomacyProposal) => number;
  serializeDiplomacyProposal: (proposal: DiplomacyProposal) => DiplomacyProposal;
  getDiplomacyCounterpartyId: (proposal: DiplomacyProposal, countryId: string) => string;
  getVisibleDiplomacyProposals: (countryId: string) => DiplomacyProposal[];
  applyTreatyClauses: (proposal: DiplomacyProposal) => void;
  cloneWorldBaseSectionSnapshot: (mask: number) => unknown;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: unknown) => void;
  removeQueuedUiNotification: (notificationId: string) => void;
  sendDiplomacyProposalNotification: (
    proposal: DiplomacyProposal,
    recipientCountryId: string,
    title: string,
    message: string,
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

export function registerDiplomacyRoutes(app: express.Express, deps: DiplomacyRoutesDependencies): void {
  app.get("/diplomacy/proposals", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    return res.json({ proposals: deps.getVisibleDiplomacyProposals(auth.countryId), turnId: deps.getTurnId() });
  });

  app.post("/diplomacy/proposals", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = diplomacyProposalCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    const toCountryId = parsed.data.toCountryId.trim();
    if (toCountryId === auth.countryId) return res.status(400).json({ error: "SELF_PROPOSAL" });
    const clauses = parsed.data.clauses.map(deps.normalizeTreatyClausePayload);
    const validationError = await deps.validateTreatyClausesForProposal(auth.countryId, toCountryId, clauses, false);
    if (validationError) return res.status(400).json({ error: validationError });

    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.diplomacyProposals);
    deps.refreshExpiredDiplomacyProposals();
    const proposals = deps.getDiplomacyProposals();
    const turnId = deps.getTurnId();
    const proposalNumber = proposals.length + 1;
    const proposalName = deps.normalizeDiplomacyProposalName(parsed.data.name, auth.countryId, toCountryId, proposalNumber);
    const expiresTurnId = turnId + (parsed.data.expiresInTurns ?? 3);
    const proposal: DiplomacyProposal = {
      id: deps.createId(),
      name: proposalName,
      fromCountryId: auth.countryId,
      toCountryId,
      createdTurnId: turnId,
      expiresTurnId,
      status: "pending",
      clauses,
      pendingResponderCountryId: toCountryId,
      lastEditedByCountryId: auth.countryId,
      revision: 1,
      revisionHistory: [{
        revision: 1,
        editedByCountryId: auth.countryId,
        sentToCountryId: toCountryId,
        turnId,
        createdAt: new Date().toISOString(),
        expiresTurnId,
        name: proposalName,
        clauses,
      }],
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedByCountryId: null,
      failureReason: null,
      renewalAcceptedByCountryIds: [],
    };
    proposals.unshift(proposal);
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    deps.broadcast({
      type: "NEWS_EVENT",
      event: deps.makeOfficialNews({
        turn: turnId,
        category: "diplomacy",
        title: "Новый договор",
        message: `${auth.countryId} отправила договор стране ${toCountryId}`,
        countryId: toCountryId,
        priority: "medium",
        visibility: "private",
      }),
    });
    deps.sendDiplomacyProposalNotification(
      proposal,
      toCountryId,
      "Новый дипломатический договор",
      `Получено предложение договора от ${auth.countryId}. Версия ${proposal.revision ?? 1}.`,
    );
    return res.json({
      proposal: deps.serializeDiplomacyProposal(proposal),
      proposals: deps.getVisibleDiplomacyProposals(auth.countryId),
      turnId,
    });
  });

  app.post("/diplomacy/proposals/:proposalId/reject", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.diplomacyProposals);
    deps.refreshExpiredDiplomacyProposals();
    const proposal = findProposalForCountry(deps.getDiplomacyProposals(), String(req.params.proposalId), auth.countryId);
    if (!proposal) return res.status(404).json({ error: "NOT_FOUND" });
    if (proposal.status !== "pending") return res.status(400).json({ error: "NOT_PENDING" });
    if (proposal.pendingResponderCountryId && proposal.pendingResponderCountryId !== auth.countryId) {
      return res.status(403).json({ error: "NOT_YOUR_TURN" });
    }
    proposal.status = "rejected";
    proposal.resolvedAt = new Date().toISOString();
    proposal.resolvedByCountryId = auth.countryId;
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    deps.removeQueuedUiNotification(`diplomacy-proposal:${proposal.id}:${auth.countryId}:r${proposal.revision ?? 1}`);
    deps.sendDiplomacyProposalNotification(
      proposal,
      deps.getDiplomacyCounterpartyId(proposal, auth.countryId),
      "Договор отклонён",
      `${auth.countryId} отклонила договор. Переговоры завершены.`,
    );
    return res.json({
      proposal: deps.serializeDiplomacyProposal(proposal),
      proposals: deps.getVisibleDiplomacyProposals(auth.countryId),
      turnId: deps.getTurnId(),
    });
  });

  app.patch("/diplomacy/proposals/:proposalId", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.diplomacyProposals);
    deps.refreshExpiredDiplomacyProposals();
    const proposal = findProposalForCountry(deps.getDiplomacyProposals(), String(req.params.proposalId), auth.countryId);
    if (!proposal) return res.status(404).json({ error: "NOT_FOUND" });
    if (proposal.status !== "pending") return res.status(400).json({ error: "NOT_PENDING" });
    if (proposal.pendingResponderCountryId && proposal.pendingResponderCountryId !== auth.countryId) {
      return res.status(403).json({ error: "NOT_YOUR_TURN" });
    }
    const parsed = diplomacyProposalReviseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    const clauses = parsed.data.clauses.map(deps.normalizeTreatyClausePayload);
    const validationError = await deps.validateTreatyClausesForProposal(proposal.fromCountryId, proposal.toCountryId, clauses, false);
    if (validationError) return res.status(400).json({ error: validationError });
    const turnId = deps.getTurnId();
    const nextResponderCountryId = deps.getDiplomacyCounterpartyId(proposal, auth.countryId);
    const nextRevision = Math.max(1, Math.floor(Number(proposal.revision ?? 1) || 1)) + 1;
    proposal.clauses = clauses;
    proposal.name = parsed.data.name?.trim()
      ? deps.normalizeDiplomacyProposalName(parsed.data.name, proposal.fromCountryId, proposal.toCountryId, nextRevision)
      : proposal.name;
    proposal.expiresTurnId = turnId + (parsed.data.expiresInTurns ?? deps.getTreatyDurationTurns(proposal));
    proposal.pendingResponderCountryId = nextResponderCountryId;
    proposal.lastEditedByCountryId = auth.countryId;
    proposal.revision = nextRevision;
    proposal.revisionHistory = [
      ...(proposal.revisionHistory ?? []),
      {
        revision: nextRevision,
        editedByCountryId: auth.countryId,
        sentToCountryId: nextResponderCountryId,
        turnId,
        createdAt: new Date().toISOString(),
        expiresTurnId: proposal.expiresTurnId,
        name: proposal.name,
        clauses,
      },
    ].slice(-20);
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    deps.removeQueuedUiNotification(`diplomacy-proposal:${proposal.id}:${auth.countryId}:r${nextRevision - 1}`);
    deps.sendDiplomacyProposalNotification(
      proposal,
      nextResponderCountryId,
      "Договор изменён",
      `${auth.countryId} вернула договор с новыми условиями. Версия ${nextRevision}.`,
    );
    return res.json({
      proposal: deps.serializeDiplomacyProposal(proposal),
      proposals: deps.getVisibleDiplomacyProposals(auth.countryId),
      turnId,
    });
  });

  app.post("/diplomacy/proposals/:proposalId/accept", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.resourcesByCountry |
        deps.masks.regionOwner |
        deps.masks.regionController |
        deps.masks.colonyProgressByRegion |
        deps.masks.diplomacyProposals,
    );
    deps.refreshExpiredDiplomacyProposals();
    const proposal = findProposalForCountry(deps.getDiplomacyProposals(), String(req.params.proposalId), auth.countryId);
    if (!proposal) return res.status(404).json({ error: "NOT_FOUND" });
    if (proposal.status !== "pending") return res.status(400).json({ error: "NOT_PENDING" });
    if ((proposal.pendingResponderCountryId ?? proposal.toCountryId) !== auth.countryId) {
      return res.status(403).json({ error: "NOT_YOUR_TURN" });
    }
    const turnId = deps.getTurnId();
    if (proposal.expiresTurnId < turnId) return res.status(400).json({ error: "EXPIRED" });
    const validationError = await deps.validateTreatyClausesForProposal(proposal.fromCountryId, proposal.toCountryId, proposal.clauses, true);
    if (validationError) {
      proposal.status = "failed";
      proposal.resolvedAt = new Date().toISOString();
      proposal.resolvedByCountryId = auth.countryId;
      proposal.failureReason = validationError;
      deps.savePersistentState();
      deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
      return res.status(400).json({ error: validationError, proposal: deps.serializeDiplomacyProposal(proposal) });
    }
    deps.applyTreatyClauses(proposal);
    proposal.status = "accepted";
    proposal.resolvedAt = new Date().toISOString();
    proposal.resolvedByCountryId = auth.countryId;
    proposal.pendingResponderCountryId = null;
    deps.savePersistentState();
    deps.removeQueuedUiNotification(`diplomacy-proposal:${proposal.id}:${auth.countryId}:r${proposal.revision ?? 1}`);
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    deps.broadcast({
      type: "NEWS_EVENT",
      event: deps.makeOfficialNews({
        turn: turnId,
        category: "diplomacy",
        title: "Договор подписан",
        message: `${proposal.fromCountryId} и ${proposal.toCountryId} подписали договор`,
        countryId: proposal.fromCountryId,
        priority: "medium",
        visibility: "public",
      }),
    });
    deps.sendDiplomacyProposalNotification(
      proposal,
      deps.getDiplomacyCounterpartyId(proposal, auth.countryId),
      "Договор подписан",
      `${auth.countryId} подписала договор. Версия ${proposal.revision ?? 1} вступила в силу.`,
    );
    return res.json({
      proposal: deps.serializeDiplomacyProposal(proposal),
      proposals: deps.getVisibleDiplomacyProposals(auth.countryId),
      turnId,
    });
  });

  app.post("/diplomacy/proposals/:proposalId/renew", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.resourcesByCountry |
        deps.masks.regionOwner |
        deps.masks.regionController |
        deps.masks.colonyProgressByRegion |
        deps.masks.diplomacyProposals,
    );
    deps.refreshExpiredDiplomacyProposals();
    const proposal = findProposalForCountry(deps.getDiplomacyProposals(), String(req.params.proposalId), auth.countryId);
    if (!proposal) return res.status(404).json({ error: "NOT_FOUND" });
    if (proposal.status !== "renewal_pending") return res.status(400).json({ error: "NOT_RENEWAL_PENDING" });
    const accepted = new Set(proposal.renewalAcceptedByCountryIds ?? []);
    accepted.add(auth.countryId);
    proposal.renewalAcceptedByCountryIds = [...accepted];
    if (accepted.has(proposal.fromCountryId) && accepted.has(proposal.toCountryId)) {
      const turnId = deps.getTurnId();
      const duration = deps.getTreatyDurationTurns(proposal);
      proposal.status = "accepted";
      proposal.createdTurnId = turnId;
      proposal.expiresTurnId = turnId + duration;
      proposal.resolvedAt = new Date().toISOString();
      proposal.resolvedByCountryId = auth.countryId;
      proposal.failureReason = null;
      proposal.renewalAcceptedByCountryIds = [];
      deps.applyTreatyClauses(proposal);
    }
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json({
      proposal: deps.serializeDiplomacyProposal(proposal),
      proposals: deps.getVisibleDiplomacyProposals(auth.countryId),
      turnId: deps.getTurnId(),
    });
  });

  app.post("/diplomacy/proposals/:proposalId/decline-renewal", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.diplomacyProposals);
    deps.refreshExpiredDiplomacyProposals();
    const proposal = findProposalForCountry(deps.getDiplomacyProposals(), String(req.params.proposalId), auth.countryId);
    if (!proposal) return res.status(404).json({ error: "NOT_FOUND" });
    if (proposal.status !== "renewal_pending") return res.status(400).json({ error: "NOT_RENEWAL_PENDING" });
    proposal.status = "expired";
    proposal.resolvedAt = new Date().toISOString();
    proposal.resolvedByCountryId = auth.countryId;
    proposal.failureReason = "RENEWAL_DECLINED";
    proposal.renewalAcceptedByCountryIds = [];
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json({
      proposal: deps.serializeDiplomacyProposal(proposal),
      proposals: deps.getVisibleDiplomacyProposals(auth.countryId),
      turnId: deps.getTurnId(),
    });
  });
}

function findProposalForCountry(
  proposals: DiplomacyProposal[],
  proposalId: string,
  countryId: string,
): DiplomacyProposal | null {
  const proposal = proposals.find((entry) => entry.id === proposalId);
  if (!proposal || (proposal.fromCountryId !== countryId && proposal.toCountryId !== countryId)) return null;
  return proposal;
}
