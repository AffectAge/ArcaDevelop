import type express from "express";
import type { HexMapArtifact, TreatyConstructionExpirationPolicy, WorldBase } from "@arcanorum/shared";
import { z } from "zod";
import { resolveTransportCorridorRoutePreview } from "../mechanics/transportCorridorRoutingMechanics";
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
  schemaVersion?: 2;
  marketId: string;
  ownerCountryId: string;
  hexIds: string[];
  routePoints?: MarketCorridorRoutePoint[];
  waypoints?: MarketCorridorRoutePoint[];
  computedHexIds?: string[];
  connectedRegionIds?: string[];
  connectedCityMarkerIds?: string[];
  transportMode: MarketCorridorTransportMode;
  level: number;
  pendingLevel?: number | null;
  status: "building" | "active" | "closed";
  progressConstruction: number;
  costConstruction: number;
  routeCost?: number;
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

const corridorWaypointSchema = z.object({
  hexId: z.string().trim().min(1).max(120),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
});

export const marketTransportCorridorPreviewSchema = z.object({
  waypoints: z.array(corridorWaypointSchema).min(2).max(32),
  transportMode: z.enum(["land", "sea", "air", "pipeline", "powerGrid"]),
});

export const marketTransportCorridorCreateSchema = z.object({
  waypoints: z.array(z.object({
    hexId: z.string().trim().min(1).max(120),
    lng: z.coerce.number().min(-180).max(180),
    lat: z.coerce.number().min(-90).max(90),
  })).min(2).max(32),
  transportMode: z.enum(["land", "sea", "air", "pipeline", "powerGrid"]),
});

export const marketTransportCorridorPatchSchema = z.object({
  action: z.enum(["open", "close", "upgrade", "cancel", "demolish"]).optional(),
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
  getHexMapArtifact: () => HexMapArtifact | null;
  getWorldBase: () => Pick<WorldBase, "cityMarkersById" | "settlementProjectsById">;
  getHexMovementCost: (hexId: string, countryId?: string) => number;
  getInfrastructureConstructionRightForHex: (
    hexId: string,
    ownerCountryId: string,
    transportMode: MarketCorridorTransportMode,
  ) => MarketCorridorConstructionAgreement | null;
  getTransportCorridorBuildCost: (transportMode: MarketCorridorTransportMode, routeCost: number, segments?: number) => number;
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

  app.post("/markets/:marketId/corridors/preview", (req, res) => {
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
    const parsed = marketTransportCorridorPreviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const preview = resolveTransportCorridorRoutePreview({
      waypoints: parsed.data.waypoints.map((point) => ({
        hexId: point.hexId,
        lng: point.lng ?? null,
        lat: point.lat ?? null,
      })),
      transportMode: parsed.data.transportMode,
      ownerCountryId: auth.countryId,
      mapArtifact: deps.getHexMapArtifact(),
      worldBase: deps.getWorldBase(),
      getHexOwner: deps.getHexOwner,
      isHexAllowedForCorridorOwner: deps.isHexAllowedForCorridorOwner,
      getHexMovementCost: deps.getHexMovementCost,
      getBuildCost: deps.getTransportCorridorBuildCost,
    });
    if (!preview.ok) return res.status(400).json({ ok: false, error: preview.error });
    return res.json({ ok: true, marketId, preview });
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
    const transportMode = parsed.data.transportMode;
    const waypoints = deps.normalizeTransportCorridorRoutePoints(parsed.data.waypoints);
    const preview = resolveTransportCorridorRoutePreview({
      waypoints,
      transportMode,
      ownerCountryId: auth.countryId,
      mapArtifact: deps.getHexMapArtifact(),
      worldBase: deps.getWorldBase(),
      getHexOwner: deps.getHexOwner,
      isHexAllowedForCorridorOwner: deps.isHexAllowedForCorridorOwner,
      getHexMovementCost: deps.getHexMovementCost,
      getBuildCost: deps.getTransportCorridorBuildCost,
    });
    if (!preview.ok) return res.status(400).json({ error: preview.error });
    const hexIds = preview.computedHexIds;
    const routePoints = parsed.data.waypoints;
    const foreignConstructionRights = getForeignConstructionRights({
      hexIds,
      ownerCountryId: auth.countryId,
      transportMode,
      deps,
    });
    const corridorId = deps.createId();
    const corridor: MarketCorridorEntry = {
      id: corridorId,
      schemaVersion: 2,
      marketId,
      ownerCountryId: auth.countryId,
      hexIds,
      routePoints,
      waypoints: routePoints,
      computedHexIds: preview.computedHexIds,
      connectedRegionIds: preview.connectedRegionIds,
      connectedCityMarkerIds: preview.connectedCityMarkerIds,
      transportMode,
      level: 1,
      pendingLevel: null,
      status: "building",
      progressConstruction: 0,
      costConstruction: preview.costConstruction,
      routeCost: preview.routeCost,
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
      const routeHexIds = corridor.computedHexIds && corridor.computedHexIds.length >= 2 ? corridor.computedHexIds : corridor.hexIds;
      if (routeHexIds.some((hexId) => !deps.isHexAllowedForCorridorOwner(hexId, auth.countryId, corridor.transportMode))) {
        return res.status(400).json({ error: "CORRIDOR_CONSTRUCTION_RIGHT_REQUIRED" });
      }
      corridor.foreignConstructionRights = getForeignConstructionRights({
        hexIds: routeHexIds,
        ownerCountryId: auth.countryId,
        transportMode: corridor.transportMode,
        deps,
      });
      corridor.pendingLevel = Math.max(1, Math.floor(corridor.level ?? 1)) + 1;
      corridor.status = "building";
      corridor.progressConstruction = 0;
      corridor.costConstruction =
        deps.getTransportCorridorBuildCost(
          corridor.transportMode,
          Math.max(1, Number(corridor.routeCost ?? routeHexIds.length - 1)),
          routeHexIds.length - 1,
        ) * corridor.pendingLevel;
      corridor.completedAt = null;
    }
    if (action === "cancel") {
      if (corridor.status !== "building") {
        return res.status(400).json({ error: "CORRIDOR_NOT_BUILDING" });
      }
      delete deps.getCorridorsById()[corridorId];
      deps.savePersistentState();
      return res.json({
        corridor: null,
        corridors: deps.getMarketTransportCorridors(marketId, { includeDisabled: true }),
      });
    }
    if (action === "demolish") {
      if (corridor.status === "building") {
        return res.status(400).json({ error: "CORRIDOR_STILL_BUILDING" });
      }
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
