import type express from "express";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export type MarketMembershipMarket = {
  id: string;
  ownerCountryId: string;
  memberCountryIds: string[];
  visibility: "public" | "private";
};

export type MarketInviteEntry = {
  id: string;
  marketId: string;
  fromCountryId: string;
  toCountryId: string;
  kind: "invite" | "join-request";
  status: "pending" | "accepted" | "rejected" | "canceled";
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export const marketInviteCreateSchema = z.object({
  toCountryId: z.string().trim().min(1).max(120),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const marketInviteActionSchema = z.object({
  action: z.enum(["accept", "reject", "cancel"]),
});

export const marketTransferOwnerSchema = z.object({
  nextOwnerCountryId: z.string().trim().min(1).max(120),
});

export type MarketMembershipRoutesDependencies = {
  routeAuth: RouteAuth;
  createId: () => string;
  getMarketById: (marketId: string) => MarketMembershipMarket | null | undefined;
  getMarketInvitesById: () => Record<string, MarketInviteEntry>;
  countryExists: (countryId: string) => Promise<boolean>;
  enrichMarketInvites: (invites: MarketInviteEntry[]) => Promise<unknown[]>;
  upsertMarketMembership: (countryId: string, marketId: string) => void;
  rebuildCountryMarketIndexFromMembers: () => void;
  getCountryMarketId: (countryId: string) => string;
  buildMarketDetailsResponse: (marketId: string) => Promise<Record<string, unknown>>;
  savePersistentState: () => void;
};

export function registerMarketMembershipRoutes(
  app: express.Express,
  deps: MarketMembershipRoutesDependencies,
): void {
  app.post("/markets/:marketId/invites", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    if (market.ownerCountryId !== auth.countryId) {
      return res.status(403).json({ error: "MARKET_OWNER_ONLY" });
    }
    const parsed = marketInviteCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const toCountryId = parsed.data.toCountryId;
    if (!(await deps.countryExists(toCountryId))) {
      return res.status(404).json({ error: "COUNTRY_NOT_FOUND" });
    }
    if (market.memberCountryIds.includes(toCountryId)) {
      return res.status(400).json({ error: "COUNTRY_ALREADY_IN_MARKET" });
    }
    const invitesById = deps.getMarketInvitesById();
    const hasPending = Object.values(invitesById).some(
      (invite) => invite.marketId === marketId && invite.toCountryId === toCountryId && invite.status === "pending",
    );
    if (hasPending) {
      return res.status(409).json({ error: "INVITE_ALREADY_PENDING" });
    }
    const now = new Date();
    const expiresInDays = parsed.data.expiresInDays ?? 14;
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    const inviteId = deps.createId();
    invitesById[inviteId] = {
      id: inviteId,
      marketId,
      fromCountryId: auth.countryId,
      toCountryId,
      kind: "invite",
      status: "pending",
      expiresAt,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    deps.savePersistentState();
    return res.status(201).json({ invite: invitesById[inviteId] });
  });

  app.get("/markets/:marketId/invites", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    if (market.ownerCountryId !== auth.countryId) {
      return res.status(403).json({ error: "MARKET_OWNER_ONLY" });
    }
    const invites = Object.values(deps.getMarketInvitesById())
      .filter((invite) => invite.marketId === marketId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ invites: await deps.enrichMarketInvites(invites) });
  });

  app.get("/country/market-invites", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const nowMs = Date.now();
    const invites = Object.values(deps.getMarketInvitesById())
      .filter((invite) => invite.toCountryId === auth.countryId && invite.status === "pending")
      .filter((invite) => new Date(invite.expiresAt).getTime() > nowMs)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ invites: await deps.enrichMarketInvites(invites) });
  });

  app.patch("/market-invites/:inviteId", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = marketInviteActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const inviteId = String(req.params.inviteId || "").trim();
    const invite = deps.getMarketInvitesById()[inviteId];
    if (!invite) {
      return res.status(404).json({ error: "INVITE_NOT_FOUND" });
    }
    if (invite.status !== "pending") {
      return res.status(409).json({ error: "INVITE_ALREADY_RESOLVED" });
    }
    const market = deps.getMarketById(invite.marketId);
    const isRecipient = invite.toCountryId === auth.countryId;
    const isMarketOwner = market?.ownerCountryId === auth.countryId;
    const isSender = invite.fromCountryId === auth.countryId;
    if (parsed.data.action === "cancel") {
      if (!isSender && !isMarketOwner) {
        return res.status(403).json({ error: "FORBIDDEN" });
      }
      invite.status = "canceled";
      invite.updatedAt = new Date().toISOString();
      deps.savePersistentState();
      return res.json({ invite });
    }
    if (!isRecipient) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    if (new Date(invite.expiresAt).getTime() <= Date.now()) {
      invite.status = "canceled";
      invite.updatedAt = new Date().toISOString();
      deps.savePersistentState();
      return res.status(409).json({ error: "INVITE_EXPIRED" });
    }
    invite.status = parsed.data.action === "accept" ? "accepted" : "rejected";
    invite.updatedAt = new Date().toISOString();
    if (parsed.data.action === "accept") {
      const targetCountryId = invite.kind === "join-request" ? invite.fromCountryId : invite.toCountryId;
      deps.upsertMarketMembership(targetCountryId, invite.marketId);
      deps.rebuildCountryMarketIndexFromMembers();
    }
    deps.savePersistentState();
    return res.json({ invite });
  });

  app.post("/markets/:marketId/leave", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    if (!market.memberCountryIds.includes(auth.countryId)) {
      return res.status(403).json({ error: "NOT_MARKET_MEMBER" });
    }
    if (market.ownerCountryId === auth.countryId) {
      return res.status(400).json({ error: "OWNER_CANNOT_LEAVE" });
    }
    deps.upsertMarketMembership(auth.countryId, auth.countryId);
    deps.rebuildCountryMarketIndexFromMembers();
    deps.savePersistentState();
    return res.json({ ok: true, marketIdLeft: marketId, newMarketId: deps.getCountryMarketId(auth.countryId) });
  });

  app.post("/markets/:marketId/join", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    if (market.memberCountryIds.includes(auth.countryId)) {
      return res.status(409).json({ error: "COUNTRY_ALREADY_IN_MARKET" });
    }
    if (market.visibility === "public") {
      deps.upsertMarketMembership(auth.countryId, marketId);
      deps.rebuildCountryMarketIndexFromMembers();
      deps.savePersistentState();
      return res.json({ mode: "joined", ...(await deps.buildMarketDetailsResponse(marketId)) });
    }
    const invitesById = deps.getMarketInvitesById();
    const hasPending = Object.values(invitesById).some(
      (invite) =>
        invite.marketId === marketId &&
        invite.kind === "join-request" &&
        invite.fromCountryId === auth.countryId &&
        invite.toCountryId === market.ownerCountryId &&
        invite.status === "pending",
    );
    if (hasPending) {
      return res.status(409).json({ error: "JOIN_REQUEST_ALREADY_PENDING" });
    }
    const now = new Date();
    const inviteId = deps.createId();
    invitesById[inviteId] = {
      id: inviteId,
      marketId,
      fromCountryId: auth.countryId,
      toCountryId: market.ownerCountryId,
      kind: "join-request",
      status: "pending",
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    deps.savePersistentState();
    return res.json({ mode: "requested", invite: invitesById[inviteId] });
  });

  app.post("/markets/:marketId/transfer-owner", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    if (market.ownerCountryId !== auth.countryId) {
      return res.status(403).json({ error: "MARKET_OWNER_ONLY" });
    }
    const parsed = marketTransferOwnerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const nextOwnerCountryId = parsed.data.nextOwnerCountryId;
    if (!market.memberCountryIds.includes(nextOwnerCountryId)) {
      return res.status(400).json({ error: "NEXT_OWNER_NOT_MARKET_MEMBER" });
    }
    market.ownerCountryId = nextOwnerCountryId;
    deps.savePersistentState();
    return res.json(await deps.buildMarketDetailsResponse(marketId));
  });
}
