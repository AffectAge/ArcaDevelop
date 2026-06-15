import express from "express";
import type { DiplomacyProposal, EventLogEntry, TreatyClause } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  diplomacyProposalCreateSchema,
  registerDiplomacyRoutes,
  treatyClausePayloadSchema,
  type DiplomacyRoutesDependencies,
  type DiplomacyTreatyClausePayload,
} from "./diplomacyRoutes";

describe("diplomacyRoutes", () => {
  it("validates diplomacy proposal payload schemas", () => {
    expect(treatyClausePayloadSchema.safeParse({ kind: "text_note", text: "Terms" }).success).toBe(true);
    expect(diplomacyProposalCreateSchema.safeParse({
      toCountryId: "country:b",
      clauses: [{ kind: "text_note", text: "Terms" }],
    }).success).toBe(true);
    expect(diplomacyProposalCreateSchema.safeParse({ toCountryId: "country:b", clauses: [] }).success).toBe(false);
  });

  it("creates a proposal and emits persistence, delta, news, and notification side effects", async () => {
    const proposals: DiplomacyProposal[] = [];
    const deps = makeDeps({ proposals });
    const app = makeApp(deps);

    const response = await request(app, "/diplomacy/proposals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Trade",
        toCountryId: "country:b",
        expiresInTurns: 4,
        clauses: [{ kind: "text_note", text: "Open borders" }],
      }),
    });

    expect(response.status).toBe(200);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      id: "proposal-1",
      name: "Trade",
      fromCountryId: "country:a",
      toCountryId: "country:b",
      createdTurnId: 10,
      expiresTurnId: 14,
      status: "pending",
      pendingResponderCountryId: "country:b",
      revision: 1,
    });
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledWith({ mask: 8 });
    expect(deps.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "NEWS_EVENT" }));
    expect(deps.sendDiplomacyProposalNotification).toHaveBeenCalledWith(
      proposals[0],
      "country:b",
      "Новый дипломатический договор",
      "Получено предложение договора от country:a. Версия 1.",
    );
  });

  it("rejects self proposals before validation side effects", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/diplomacy/proposals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toCountryId: "country:a",
        clauses: [{ kind: "text_note", text: "Nope" }],
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "SELF_PROPOSAL" });
    expect(deps.validateTreatyClausesForProposal).not.toHaveBeenCalled();
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });

  it("rejects a pending proposal only when it is the actor turn", async () => {
    const proposal = makeProposal({ pendingResponderCountryId: "country:a" });
    const deps = makeDeps({ proposals: [proposal] });
    const app = makeApp(deps);

    const response = await request(app, "/diplomacy/proposals/proposal-existing/reject", { method: "POST" });

    expect(response.status).toBe(200);
    expect(proposal.status).toBe("rejected");
    expect(proposal.resolvedByCountryId).toBe("country:a");
    expect(deps.removeQueuedUiNotification).toHaveBeenCalledWith("diplomacy-proposal:proposal-existing:country:a:r1");
    expect(deps.sendDiplomacyProposalNotification).toHaveBeenCalledWith(
      proposal,
      "country:b",
      "Договор отклонён",
      "country:a отклонила договор. Переговоры завершены.",
    );
  });

  it("marks a proposal failed when accept-time treaty validation fails", async () => {
    const proposal = makeProposal({ pendingResponderCountryId: "country:a" });
    const deps = makeDeps({ proposals: [proposal], validationError: "INSUFFICIENT_FUNDS" });
    const app = makeApp(deps);

    const response = await request(app, "/diplomacy/proposals/proposal-existing/accept", { method: "POST" });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "INSUFFICIENT_FUNDS" });
    expect(proposal.status).toBe("failed");
    expect(proposal.failureReason).toBe("INSUFFICIENT_FUNDS");
    expect(deps.applyTreatyClauses).not.toHaveBeenCalled();
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });
});

function makeApp(deps: DiplomacyRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerDiplomacyRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  proposals?: DiplomacyProposal[];
  validationError?: string | null;
}): DiplomacyRoutesDependencies {
  const proposals = options?.proposals ?? [];
  return {
    routeAuth: createAllowedRouteAuth(),
    masks: {
      resourcesByCountry: 1,
      regionOwner: 2,
      regionController: 16,
      colonyProgressByRegion: 4,
      diplomacyProposals: 8,
    },
    createId: () => "proposal-1",
    getTurnId: () => 10,
    getDiplomacyProposals: () => proposals,
    normalizeTreatyClausePayload: (clause) => normalizeTreatyClausePayloadForTest(clause),
    normalizeDiplomacyProposalName: (name, fromCountryId, toCountryId, proposalNumber) =>
      name?.trim() || `${fromCountryId}-${toCountryId}-${proposalNumber}`,
    validateTreatyClausesForProposal: vi.fn().mockResolvedValue(options?.validationError ?? null),
    refreshExpiredDiplomacyProposals: vi.fn(),
    getTreatyDurationTurns: (proposal) => Math.max(1, proposal.expiresTurnId - proposal.createdTurnId),
    serializeDiplomacyProposal: (proposal) => structuredClone(proposal),
    getDiplomacyCounterpartyId: (proposal, countryId) =>
      proposal.fromCountryId === countryId ? proposal.toCountryId : proposal.fromCountryId,
    getVisibleDiplomacyProposals: (countryId) =>
      proposals.filter((proposal) => proposal.fromCountryId === countryId || proposal.toCountryId === countryId),
    applyTreatyClauses: vi.fn(),
    cloneWorldBaseSectionSnapshot: (mask) => ({ mask }),
    savePersistentState: vi.fn(),
    broadcastWorldDeltaFromSectionSnapshot: vi.fn(),
    removeQueuedUiNotification: vi.fn(),
    sendDiplomacyProposalNotification: vi.fn(),
    makeOfficialNews: (input) => makeNews(input.title),
    broadcast: vi.fn(),
  };
}

function normalizeTreatyClausePayloadForTest(clause: DiplomacyTreatyClausePayload): TreatyClause {
  if (clause.kind === "transfer_money") {
    return {
      id: clause.id?.trim() || "clause:money",
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
      id: clause.id?.trim() || "clause:province",
      kind: "transfer_region",
      fromCountryId: clause.fromCountryId.trim(),
      toCountryId: clause.toCountryId.trim(),
      regionId: clause.regionId.trim(),
    };
  }
  if (clause.kind === "infrastructure_transit") {
    return {
      id: clause.id?.trim() || "clause:transit",
      kind: "infrastructure_transit",
      fromCountryId: clause.fromCountryId.trim(),
      toCountryId: clause.toCountryId.trim(),
      transportModes: clause.transportModes,
    };
  }
  if (clause.kind === "infrastructure_construction_rights") {
    return {
      id: clause.id?.trim() || "clause:construction-rights",
      kind: "infrastructure_construction_rights",
      fromCountryId: clause.fromCountryId.trim(),
      toCountryId: clause.toCountryId.trim(),
      transportModes: clause.transportModes,
      expirationPolicy: clause.expirationPolicy ?? "disable_without_transit",
    };
  }
  return {
    id: clause.id?.trim() || "clause:note",
    kind: "text_note",
    text: clause.text.trim(),
  };
}

function makeProposal(overrides?: Partial<DiplomacyProposal>): DiplomacyProposal {
  return {
    id: "proposal-existing",
    name: "Existing",
    fromCountryId: "country:b",
    toCountryId: "country:a",
    createdTurnId: 8,
    expiresTurnId: 12,
    status: "pending",
    clauses: [{ id: "clause:note", kind: "text_note", text: "Terms" }],
    pendingResponderCountryId: "country:a",
    lastEditedByCountryId: "country:b",
    revision: 1,
    revisionHistory: [],
    createdAt: "now",
    resolvedAt: null,
    resolvedByCountryId: null,
    failureReason: null,
    renewalAcceptedByCountryIds: [],
    ...overrides,
  };
}

function makeNews(title: string): EventLogEntry {
  return {
    id: "news:test",
    turn: 10,
    timestamp: "now",
    category: "diplomacy",
    title,
    message: title,
    countryId: "country:a",
    priority: "medium",
    visibility: "public",
  };
}

function createAllowedRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn().mockReturnValue({ countryId: "country:a" }),
    requireAuthOrCleanup: vi.fn(),
    requireAdmin: vi.fn(),
    requireAdminOrCleanup: vi.fn(),
    requireSelfOrAdmin: vi.fn(),
  } as unknown as RouteAuth;
}

async function request(app: express.Express, path: string, init?: RequestInit): Promise<Response> {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a port");
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
