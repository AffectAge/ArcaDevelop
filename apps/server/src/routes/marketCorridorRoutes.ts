import type express from "express";
import type { TreatyConstructionExpirationPolicy } from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export type MarketCorridorTransportMode = "land" | "sea" | "air" | "pipeline" | "powerGrid";

export type MarketCorridorRoutePoint = {
  hexId: string;
  lng: number;
  lat: number;
};

export type MarketCorridorForeignConstructionRight = {
  hexId: string;
  grantorCountryId: string;
  agreementId: string;
  expirationPolicy: TreatyConstructionExpirationPolicy;
  sourceProposalId?: string | null;
  sourceClauseId?: string | null;
};

export type MarketCorridorEntry = {
  id: string;
  marketId: string;
  ownerCountryId: string;
  hexIds: string[];
  routePoints?: MarketCorridorRoutePoint[];
  transportMode: MarketCorridorTransportMode;
  level: number;
  status: "building" | "active" | "closed";
  progressConstruction: number;
  costConstruction: number;
  lastLoadByMode?: Record<string, number>;
  lastCapacityByMode?: Record<string, number>;
  lastLoadHistoryByMode?: Record<string, number[]>;
  foreignConstructionRights?: MarketCorridorForeignConstructionRight[];
  nationalizedAt?: string | null;
  nationalizedFromCountryId?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type MarketCorridorMarket = {
  id: string;
  ownerCountryId: string;
  memberCountryIds: string[];
  capitalHexId?: string | null;
};

export type MarketCorridorConstructionAgreement = {
  id: string;
  expirationPolicy: TreatyConstructionExpirationPolicy;
  sourceProposalId?: string | null;
  sourceClauseId?: string | null;
};

export const marketTransportCorridorCreateSchema = z.object({
  hexIds: z.array(z.string().trim().min(1).max(120)).min(2).max(128),
  routePoints: z.array(z.object({
    hexId: z.string().trim().min(1).max(120),
    lng: z.coerce.number().min(-180).max(180),
    lat: z.coerce.number().min(-90).max(90),
  })).min(2).max(256).optional(),
  transportMode: z.enum(["land", "sea", "air", "pipeline", "powerGrid"]),
});

export const marketTransportCorridorPatchSchema = z.object({
  action: z.enum(["open", "close", "upgrade", "demolish"]).optional(),
});

export type MarketCorridorRoutesDependencies = {
  routeAuth: RouteAuth;
  createId: () => string;
  refreshExpiredDiplomacyProposals: () => void;
  getMarketById: (marketId: string) => MarketCorridorMarket | null | undefined;
  getCorridorsById: () => Record<string, MarketCorridorEntry>;
  getMarketTransportCorridors: (marketId: string, options?: { includeDisabled?: boolean }) => MarketCorridorEntry[];
  normalizeTransportCorridorRoutePoints: (input: unknown) => MarketCorridorRoutePoint[];
  normalizeHexIdList: (input: unknown) => string[];
  isHexAllowedForCorridorOwner: (
    hexId: string,
    ownerCountryId: string,
    transportMode: MarketCorridorTransportMode,
  ) => boolean;
  isContiguousTransportCorridorRoute: (
    hexIds: string[],
    routePoints?: MarketCorridorRoutePoint[],
  ) => boolean;
  getHexOwner: (hexId: string) => string | null;
  getInfrastructureConstructionRightForHex: (
    hexId: string,
    ownerCountryId: string,
    transportMode: MarketCorridorTransportMode,
  ) => MarketCorridorConstructionAgreement | null;
  getTransportCorridorBuildCost: (transportMode: MarketCorridorTransportMode, segments: number) => number;
  savePersistentState: () => void;
};

export function registerMarketCorridorRoutes(
  app: express.Express,
  deps: MarketCorridorRoutesDependencies,
): void {
  app.get("/markets/:marketId/corridors", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    if (!market.memberCountryIds.includes(auth.countryId)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    return res.json({
      marketId,
      capitalHexId: market.capitalHexId ?? null,
      corridors: deps.getMarketTransportCorridors(marketId, { includeDisabled: true }),
    });
  });

  app.post("/markets/:marketId/corridors", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    deps.refreshExpiredDiplomacyProposals();
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    if (!market.memberCountryIds.includes(auth.countryId)) {
      return res.status(403).json({ error: "NOT_MARKET_MEMBER" });
    }
    const parsed = marketTransportCorridorCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const routePoints = deps.normalizeTransportCorridorRoutePoints(parsed.data.routePoints);
    const hexIds = deps.normalizeHexIdList(
      routePoints.length >= 2 ? routePoints.map((point) => point.hexId) : parsed.data.hexIds,
    );
    if (hexIds.length < 2) return res.status(400).json({ error: "CORRIDOR_ROUTE_TOO_SHORT" });
    const transportMode = parsed.data.transportMode;
    if (hexIds.some((hexId) => !deps.isHexAllowedForCorridorOwner(hexId, auth.countryId, transportMode))) {
      return res.status(400).json({ error: "CORRIDOR_CONSTRUCTION_RIGHT_REQUIRED" });
    }
    if (routePoints.length >= 2 && routePoints.some((point) => !deps.isHexAllowedForCorridorOwner(point.hexId, auth.countryId, transportMode))) {
      return res.status(400).json({ error: "CORRIDOR_CONSTRUCTION_RIGHT_REQUIRED" });
    }
    if (!deps.isContiguousTransportCorridorRoute(hexIds, routePoints)) {
      return res.status(400).json({ error: "CORRIDOR_ROUTE_MUST_BE_CONTIGUOUS" });
    }
    const foreignConstructionRights = getForeignConstructionRights({
      hexIds,
      ownerCountryId: auth.countryId,
      transportMode,
      deps,
    });
    const costConstruction = deps.getTransportCorridorBuildCost(transportMode, hexIds.length - 1);
    const corridorId = deps.createId();
    const corridor: MarketCorridorEntry = {
      id: corridorId,
      marketId,
      ownerCountryId: auth.countryId,
      hexIds,
      routePoints: routePoints.length >= 2 ? routePoints : undefined,
      transportMode,
      level: 1,
      status: "building",
      progressConstruction: 0,
      costConstruction,
      lastLoadByMode: {},
      lastCapacityByMode: {},
      lastLoadHistoryByMode: {},
      foreignConstructionRights,
      nationalizedAt: null,
      nationalizedFromCountryId: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    deps.getCorridorsById()[corridorId] = corridor;
    deps.savePersistentState();
    return res.status(201).json({
      corridor,
      corridors: deps.getMarketTransportCorridors(marketId, { includeDisabled: true }),
    });
  });

  app.patch("/markets/:marketId/corridors/:corridorId", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    deps.refreshExpiredDiplomacyProposals();
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    if (!market.memberCountryIds.includes(auth.countryId)) {
      return res.status(403).json({ error: "NOT_MARKET_MEMBER" });
    }
    const corridorId = String(req.params.corridorId || "").trim();
    const corridor = deps.getCorridorsById()[corridorId];
    if (!corridor || corridor.marketId !== marketId) {
      return res.status(404).json({ error: "CORRIDOR_NOT_FOUND" });
    }
    if (corridor.ownerCountryId !== auth.countryId) {
      return res.status(403).json({ error: "CORRIDOR_OWNER_ONLY" });
    }
    const parsed = marketTransportCorridorPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const action = parsed.data.action;
    if (action === "close" && corridor.status === "active") {
      corridor.status = "closed";
    }
    if (action === "open" && corridor.status === "closed") {
      corridor.status = "active";
    }
    if (action === "upgrade" && corridor.status !== "building") {
      if (corridor.hexIds.some((hexId) => !deps.isHexAllowedForCorridorOwner(hexId, auth.countryId, corridor.transportMode))) {
        return res.status(400).json({ error: "CORRIDOR_CONSTRUCTION_RIGHT_REQUIRED" });
      }
      corridor.foreignConstructionRights = getForeignConstructionRights({
        hexIds: corridor.hexIds,
        ownerCountryId: auth.countryId,
        transportMode: corridor.transportMode,
        deps,
      });
      corridor.level = Math.max(1, Math.floor(corridor.level ?? 1)) + 1;
      corridor.status = "building";
      corridor.progressConstruction = 0;
      corridor.costConstruction = deps.getTransportCorridorBuildCost(corridor.transportMode, corridor.hexIds.length - 1) * corridor.level;
      corridor.completedAt = null;
    }
    if (action === "demolish") {
      delete deps.getCorridorsById()[corridorId];
      deps.savePersistentState();
      return res.json({
        corridor: null,
        corridors: deps.getMarketTransportCorridors(marketId, { includeDisabled: true }),
      });
    }
    deps.savePersistentState();
    return res.json({
      corridor,
      corridors: deps.getMarketTransportCorridors(marketId, { includeDisabled: true }),
    });
  });

  app.delete("/markets/:marketId/corridors/:corridorId", (req, res) => {
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
    const corridorId = String(req.params.corridorId || "").trim();
    const corridor = deps.getCorridorsById()[corridorId];
    if (!corridor || corridor.marketId !== marketId) {
      return res.status(404).json({ error: "CORRIDOR_NOT_FOUND" });
    }
    if (corridor.ownerCountryId !== auth.countryId) {
      return res.status(403).json({ error: "CORRIDOR_OWNER_ONLY" });
    }
    delete deps.getCorridorsById()[corridorId];
    deps.savePersistentState();
    return res.json({ ok: true, corridorId, corridors: deps.getMarketTransportCorridors(marketId, { includeDisabled: true }) });
  });
}

function getForeignConstructionRights(params: {
  hexIds: string[];
  ownerCountryId: string;
  transportMode: MarketCorridorTransportMode;
  deps: Pick<MarketCorridorRoutesDependencies, "getHexOwner" | "getInfrastructureConstructionRightForHex">;
}): MarketCorridorForeignConstructionRight[] {
  return params.hexIds.flatMap((hexId) => {
    const hexOwnerId = params.deps.getHexOwner(hexId);
    if (!hexOwnerId || hexOwnerId === params.ownerCountryId) return [];
    const agreement = params.deps.getInfrastructureConstructionRightForHex(
      hexId,
      params.ownerCountryId,
      params.transportMode,
    );
    if (!agreement) return [];
    return [{
      hexId,
      grantorCountryId: hexOwnerId,
      agreementId: agreement.id,
      expirationPolicy: agreement.expirationPolicy,
      sourceProposalId: agreement.sourceProposalId ?? null,
      sourceClauseId: agreement.sourceClauseId ?? null,
    }];
  });
}
