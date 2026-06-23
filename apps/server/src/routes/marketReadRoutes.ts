import type express from "express";
import type { RouteAuth } from "../security/routeAuth";
import type { MarketCorridorEntry, MarketCorridorTransportMode } from "./marketCorridorRoutes";

export type MarketReadGood = {
  id: string;
  name: string;
  basePrice?: number | null;
};

export type MarketReadMarket = {
  id: string;
  name: string;
  logoUrl: string | null;
  ownerCountryId: string;
  capitalHexId?: string | null;
  memberCountryIds: string[];
  visibility: "public" | "private";
  createdAt: string;
  priceHistoryByResourceId?: Record<string, number[]>;
  demandHistoryByResourceId?: Record<string, number[]>;
  offerHistoryByResourceId?: Record<string, number[]>;
  productionFactHistoryByResourceId?: Record<string, number[]>;
  productionMaxHistoryByResourceId?: Record<string, number[]>;
};

export type MarketReadInvite = {
  marketId: string;
  kind: "invite" | "join-request";
  fromCountryId: string;
  status: "pending" | "accepted" | "rejected" | "canceled";
};

export type MarketReadCountry = {
  id: string;
  name: string;
  flagUrl?: string | null;
};

export type MarketOverviewState = {
  demandByCountry: Record<string, Record<string, number>>;
  offerByCountry: Record<string, Record<string, number>>;
  demandGlobal: Record<string, number>;
  offerGlobal: Record<string, number>;
  importsByCountryByCountryAndGood: Record<string, Record<string, Record<string, number>>>;
  exportsByCountryByCountryAndGood: Record<string, Record<string, Record<string, number>>>;
  importsByMarketByMarketAndGood: Record<string, Record<string, Record<string, number>>>;
  exportsByMarketByMarketAndGood: Record<string, Record<string, Record<string, number>>>;
  logisticsFailuresByHex?: Record<string, unknown>;
  alertsByCountry: Record<string, unknown[]>;
};

export type MarketReadRoutesDependencies = {
  routeAuth: RouteAuth;
  getTurnId: () => number;
  ensureCountryInWorldBase: (countryId: string) => void;
  getCountryMarketId: (countryId: string) => string;
  getMarketById: (marketId: string) => MarketReadMarket | null | undefined;
  getGoods: () => MarketReadGood[];
  getLatestMarketOverview: () => MarketOverviewState;
  getCountryGoodPrices: () => Record<string, Record<string, number>>;
  getGlobalGoodPrices: () => Record<string, number>;
  getGlobalGoodPriceHistoryByResourceId: () => Record<string, number[]>;
  getGlobalGoodDemandHistoryByResourceId: () => Record<string, number[]>;
  getGlobalGoodOfferHistoryByResourceId: () => Record<string, number[]>;
  getGlobalGoodProductionFactHistoryByResourceId: () => Record<string, number[]>;
  getGlobalGoodProductionMaxHistoryByResourceId: () => Record<string, number[]>;
  getHexOwner: (hexId: string) => string | null;
  getMarketTransportCorridors: (marketId: string, options?: { includeDisabled?: boolean }) => MarketCorridorEntry[];
  getTransportCorridorCapacity: (corridor: MarketCorridorEntry, categoryId: string | null) => number;
  getTransportModes: () => MarketCorridorTransportMode[];
  round3: (value: number) => number;
  ensureMarketModelReady: () => void;
  getMarkets: () => MarketReadMarket[];
  getMarketInvites: () => MarketReadInvite[];
  listCountriesByIds: (countryIds: string[]) => Promise<MarketReadCountry[]>;
  getMarketDisplayName: (params: {
    marketId: string;
    marketName: string;
    ownerCountryName: string | null;
  }) => string;
  buildMarketDetailsResponse: (marketId: string) => Promise<unknown>;
};

export function registerMarketReadRoutes(app: express.Express, deps: MarketReadRoutesDependencies): void {
  app.get("/economy/market-overview", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    deps.ensureCountryInWorldBase(auth.countryId);
    return res.json(buildMarketOverviewResponse(auth.countryId, deps));
  });

  app.get("/markets/:marketId", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const marketId = String(req.params.marketId || "").trim();
    if (!marketId) {
      return res.status(400).json({ error: "MARKET_ID_REQUIRED" });
    }
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    const isMember = market.memberCountryIds.includes(auth.countryId);
    const isPublic = market.visibility === "public";
    if (!isMember && !isPublic) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    try {
      return res.json(await deps.buildMarketDetailsResponse(marketId));
    } catch {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
  });

  app.get("/markets", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    deps.ensureMarketModelReady();
    const marketsSource = deps.getMarkets();
    const countries = await deps.listCountriesByIds(marketsSource.map((market) => market.ownerCountryId));
    const countryById = new Map(countries.map((country) => [country.id, country] as const));
    const invites = deps.getMarketInvites();
    const markets = marketsSource
      .filter((market) => market.memberCountryIds.length > 0)
      .map((market) => {
        const owner = countryById.get(market.ownerCountryId);
        const isMember = market.memberCountryIds.includes(auth.countryId);
        const pendingRequest = invites.some(
          (invite) =>
            invite.marketId === market.id &&
            invite.kind === "join-request" &&
            invite.fromCountryId === auth.countryId &&
            invite.status === "pending",
        );
        return {
          id: market.id,
          name: deps.getMarketDisplayName({
            marketId: market.id,
            marketName: market.name,
            ownerCountryName: owner?.name ?? market.ownerCountryId,
          }),
          logoUrl: market.logoUrl,
          capitalHexId: market.capitalHexId ?? null,
          ownerCountryId: market.ownerCountryId,
          ownerCountryName: owner?.name ?? market.ownerCountryId,
          ownerCountryFlagUrl: owner?.flagUrl ?? null,
          memberCountryIds: [...market.memberCountryIds],
          visibility: market.visibility,
          membersCount: market.memberCountryIds.length,
          isMember,
          canJoinDirectly: !isMember && market.visibility === "public",
          canRequestJoin: !isMember && market.visibility === "private" && !pendingRequest,
          hasPendingJoinRequest: pendingRequest,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return res.json({ markets });
  });
}

export function buildMarketOverviewResponse(countryId: string, deps: MarketReadRoutesDependencies) {
  const turnId = deps.getTurnId();
  const marketId = deps.getCountryMarketId(countryId);
  const marketRecord = deps.getMarketById(marketId);
  const overview = deps.getLatestMarketOverview();
  const countryGoodPrices = deps.getCountryGoodPrices();
  const globalGoodPrices = deps.getGlobalGoodPrices();
  const globalGoodPriceHistoryByResourceId = deps.getGlobalGoodPriceHistoryByResourceId();
  const globalGoodDemandHistoryByResourceId = deps.getGlobalGoodDemandHistoryByResourceId();
  const globalGoodOfferHistoryByResourceId = deps.getGlobalGoodOfferHistoryByResourceId();
  const globalGoodProductionFactHistoryByResourceId = deps.getGlobalGoodProductionFactHistoryByResourceId();
  const globalGoodProductionMaxHistoryByResourceId = deps.getGlobalGoodProductionMaxHistoryByResourceId();
  const goodsSource = deps.getGoods();
  const round3 = deps.round3;
  const goods = goodsSource.map((good) => {
    const countryDemand = Number(overview.demandByCountry[marketId]?.[good.id] ?? 0);
    const countryOffer = Number(overview.offerByCountry[marketId]?.[good.id] ?? 0);
    const globalDemand = Number(overview.demandGlobal[good.id] ?? 0);
    const globalOffer = Number(overview.offerGlobal[good.id] ?? 0);
    const countryCoveragePct = countryDemand > 0 ? round3((countryOffer / countryDemand) * 100) : 100;
    const globalCoveragePct = globalDemand > 0 ? round3((globalOffer / globalDemand) * 100) : 100;
    return {
      goodId: good.id,
      goodName: good.name,
      countryPrice: round3(Math.max(0, Number(countryGoodPrices[deps.getCountryMarketId(countryId)]?.[good.id] ?? good.basePrice ?? 1))),
      globalPrice: round3(Math.max(0, Number(globalGoodPrices[good.id] ?? good.basePrice ?? 1))),
      countryDemand: round3(countryDemand),
      countryOffer: round3(countryOffer),
      countryCoveragePct,
      globalDemand: round3(globalDemand),
      globalOffer: round3(globalOffer),
      globalCoveragePct,
      countryPriceHistory: (marketRecord?.priceHistoryByResourceId?.[good.id] ?? []).map((value) => round3(value)),
      globalPriceHistory: (globalGoodPriceHistoryByResourceId[good.id] ?? []).map((value) => round3(value)),
      countryDemandHistory: (marketRecord?.demandHistoryByResourceId?.[good.id] ?? []).map((value) => round3(value)),
      countryOfferHistory: (marketRecord?.offerHistoryByResourceId?.[good.id] ?? []).map((value) => round3(value)),
      globalDemandHistory: (globalGoodDemandHistoryByResourceId[good.id] ?? []).map((value) => round3(value)),
      globalOfferHistory: (globalGoodOfferHistoryByResourceId[good.id] ?? []).map((value) => round3(value)),
      countryProductionFactHistory: (marketRecord?.productionFactHistoryByResourceId?.[good.id] ?? []).map((value) => round3(value)),
      countryProductionMaxHistory: (marketRecord?.productionMaxHistoryByResourceId?.[good.id] ?? []).map((value) => round3(value)),
      globalProductionFactHistory: (globalGoodProductionFactHistoryByResourceId[good.id] ?? []).map((value) => round3(value)),
      globalProductionMaxHistory: (globalGoodProductionMaxHistoryByResourceId[good.id] ?? []).map((value) => round3(value)),
    };
  });
  const tradeByGood = Object.fromEntries(
    goodsSource.map((good) => [
      good.id,
      {
        countryImportsByCountry: overview.importsByCountryByCountryAndGood[countryId]?.[good.id] ?? {},
        countryExportsByCountry: overview.exportsByCountryByCountryAndGood[countryId]?.[good.id] ?? {},
        globalImportsByMarket: overview.importsByMarketByMarketAndGood[marketId]?.[good.id] ?? {},
        globalExportsByMarket: overview.exportsByMarketByMarketAndGood[marketId]?.[good.id] ?? {},
      },
    ]),
  );
  const logisticsFailuresByHex = Object.fromEntries(
    Object.entries(overview.logisticsFailuresByHex ?? {}).filter(
      ([hexId]) => deps.getHexOwner(hexId) === countryId,
    ),
  );
  const corridorServiceAreas = deps.getMarketTransportCorridors(marketId, { includeDisabled: true }).map((corridor) => {
    const capacity = Math.max(0, Number(corridor.lastCapacityByMode?.[corridor.transportMode] ?? deps.getTransportCorridorCapacity(corridor, null)));
    const load = Math.max(0, Number(corridor.lastLoadByMode?.[corridor.transportMode] ?? 0));
    return {
      corridorId: corridor.id,
      marketId: corridor.marketId,
      ownerCountryId: corridor.ownerCountryId,
      transportMode: corridor.transportMode,
      hexIds: corridor.hexIds,
      capacity: round3(capacity),
      load: round3(load),
      utilization: capacity > 0 ? round3(Math.max(0, Math.min(1, load / capacity))) : 0,
      status: corridor.status,
    };
  });
  const coverageByModeByHex = Object.fromEntries(
    deps.getTransportModes().map((mode) => [mode, {} as Record<string, { capacity: number; load: number; utilization: number; corridorIds: string[] }>]),
  ) as Record<MarketCorridorTransportMode, Record<string, { capacity: number; load: number; utilization: number; corridorIds: string[] }>>;
  for (const area of corridorServiceAreas) {
    if (area.status !== "active") continue;
    for (const hexId of area.hexIds) {
      const byHex = coverageByModeByHex[area.transportMode];
      const current = byHex[hexId] ?? { capacity: 0, load: 0, utilization: 0, corridorIds: [] };
      current.capacity = round3(current.capacity + area.capacity);
      current.load = round3(current.load + area.load);
      current.utilization = current.capacity > 0 ? round3(Math.max(0, Math.min(1, current.load / current.capacity))) : 0;
      if (!current.corridorIds.includes(area.corridorId)) current.corridorIds.push(area.corridorId);
      byHex[hexId] = current;
    }
  }
  return {
    turnId,
    countryId,
    marketId,
    marketCapitalHexId: marketRecord?.capitalHexId ?? null,
    transportCorridors: deps.getMarketTransportCorridors(marketId, { includeDisabled: true }),
    logisticsSnapshot: {
      turnId,
      corridorServiceAreas,
      coverageByModeByHex,
      failuresByHex: logisticsFailuresByHex,
    },
    goods,
    tradeByGood,
    alerts: overview.alertsByCountry[countryId] ?? [],
  };
}
