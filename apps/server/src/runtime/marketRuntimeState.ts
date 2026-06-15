import type { WorldBase } from "@arcanorum/shared";
import { normalizeTransportMode } from "../mechanics/marketTurnMechanics";
import type { GameSettings, MarketTradePolicyEntry, TransportCorridorEntry } from "./gameSettingsTypes";
import {
  getTransportCorridorBuildCost,
  normalizeCategoryAmountMap,
  normalizeCorridorForeignConstructionRights,
  normalizeMarketId,
  normalizeMarketVisibility,
  normalizeNumberHistoryMap,
  normalizeProvinceIdList,
  normalizeTransportCorridorRoutePoints,
  normalizeTransportCorridorStatus,
} from "./marketSettingsNormalizers";

export type MarketRuntimeProvince = {
  id: string;
};

export type MarketRuntimeContext = {
  gameSettings: GameSettings;
  worldBase: Pick<WorldBase, "resourcesByCountry" | "provinceOwner">;
  provinceIndex: MarketRuntimeProvince[];
  corridorLoadHistoryLength: number;
};

export function ensureMarketsStateShape(gameSettings: GameSettings): void {
  if (!gameSettings.markets) {
    gameSettings.markets = {
      countryMarketByCountryId: {},
      marketById: {},
      transportCorridorsById: {},
      marketInvitesById: {},
      sanctionsById: {},
      infrastructureTransitAgreementsById: {},
      infrastructureConstructionRightsById: {},
    };
    return;
  }
  if (!gameSettings.markets.countryMarketByCountryId || typeof gameSettings.markets.countryMarketByCountryId !== "object") {
    gameSettings.markets.countryMarketByCountryId = {};
  }
  if (!gameSettings.markets.marketById || typeof gameSettings.markets.marketById !== "object") {
    gameSettings.markets.marketById = {};
  }
  if (!gameSettings.markets.transportCorridorsById || typeof gameSettings.markets.transportCorridorsById !== "object") {
    gameSettings.markets.transportCorridorsById = {};
  }
  if (!gameSettings.markets.marketInvitesById || typeof gameSettings.markets.marketInvitesById !== "object") {
    gameSettings.markets.marketInvitesById = {};
  }
  if (!gameSettings.markets.sanctionsById || typeof gameSettings.markets.sanctionsById !== "object") {
    gameSettings.markets.sanctionsById = {};
  }
  if (!gameSettings.markets.infrastructureTransitAgreementsById || typeof gameSettings.markets.infrastructureTransitAgreementsById !== "object") {
    gameSettings.markets.infrastructureTransitAgreementsById = {};
  }
  if (!gameSettings.markets.infrastructureConstructionRightsById || typeof gameSettings.markets.infrastructureConstructionRightsById !== "object") {
    gameSettings.markets.infrastructureConstructionRightsById = {};
  }
}

export function createDefaultMarketRecord(
  marketId: string,
  ownerCountryId: string,
): GameSettings["markets"]["marketById"][string] {
  return {
    id: marketId,
    name: `Рынок ${marketId}`,
    logoUrl: null,
    ownerCountryId,
    capitalProvinceId: null,
    memberCountryIds: [ownerCountryId],
    visibility: "public",
    createdAt: new Date().toISOString(),
    warehouseByResourceId: {},
    priceByResourceId: {},
    priceHistoryByResourceId: {},
    demandHistoryByResourceId: {},
    offerHistoryByResourceId: {},
    productionFactHistoryByResourceId: {},
    productionMaxHistoryByResourceId: {},
    worldTradePolicyByResourceId: {} as Record<string, MarketTradePolicyEntry>,
    resourceTradePolicyByCountryId: {} as Record<string, Record<string, MarketTradePolicyEntry>>,
  };
}

export function getMarketDisplayName(params: { marketId: string; marketName: string; ownerCountryName?: string | null }): string {
  const rawName = (params.marketName ?? "").trim();
  const isDefaultName = rawName.length === 0 || rawName === `Рынок ${params.marketId}`;
  if (!isDefaultName) {
    return rawName;
  }
  const ownerName = (params.ownerCountryName ?? "").trim();
  return ownerName ? `Рынок ${ownerName}` : `Рынок ${params.marketId}`;
}

export function isDefaultMarketName(marketId: string, marketName: string): boolean {
  const raw = (marketName ?? "").trim();
  return raw.length === 0 || raw === `Рынок ${marketId}`;
}

export function upsertMarketMembership(params: MarketRuntimeContext & {
  countryId: string;
  targetMarketIdRaw: string | null;
}): string {
  ensureMarketsStateShape(params.gameSettings);
  const targetMarketId = normalizeMarketId(params.targetMarketIdRaw) ?? params.countryId;
  const marketById = params.gameSettings.markets.marketById;
  if (!marketById[targetMarketId]) {
    marketById[targetMarketId] = createDefaultMarketRecord(targetMarketId, params.countryId);
  }
  for (const market of Object.values(marketById)) {
    market.memberCountryIds = (market.memberCountryIds ?? []).filter((id) => id !== params.countryId);
  }
  const target = marketById[targetMarketId];
  if (!target.memberCountryIds.includes(params.countryId)) {
    target.memberCountryIds.push(params.countryId);
  }
  for (const corridor of Object.values(params.gameSettings.markets.transportCorridorsById ?? {})) {
    if (corridor.ownerCountryId === params.countryId) {
      corridor.marketId = targetMarketId;
    }
  }
  if (!target.ownerCountryId || !target.memberCountryIds.includes(target.ownerCountryId)) {
    target.ownerCountryId = target.memberCountryIds[0] ?? params.countryId;
  }
  params.gameSettings.markets.countryMarketByCountryId[params.countryId] = targetMarketId;
  return targetMarketId;
}

export function getOwnedProvinceIds(params: MarketRuntimeContext & { countryId: string }): string[] {
  return params.provinceIndex
    .filter((province) => params.worldBase.provinceOwner[province.id] === params.countryId)
    .map((province) => province.id);
}

export function rebuildCountryMarketIndexFromMembers(params: MarketRuntimeContext): void {
  ensureMarketsStateShape(params.gameSettings);
  const assignment: Record<string, string> = {};
  for (const [marketId, market] of Object.entries(params.gameSettings.markets.marketById)) {
    market.id = marketId;
    market.memberCountryIds = [...new Set((market.memberCountryIds ?? []).map((id) => String(id).trim()).filter(Boolean))];
    if (market.memberCountryIds.length === 0) {
      delete params.gameSettings.markets.marketById[marketId];
      continue;
    }
    market.visibility = normalizeMarketVisibility(market.visibility);
    market.createdAt =
      typeof market.createdAt === "string" && market.createdAt.trim() ? market.createdAt : new Date().toISOString();
    if (!market.ownerCountryId || !market.memberCountryIds.includes(market.ownerCountryId)) {
      market.ownerCountryId = market.memberCountryIds[0] ?? market.ownerCountryId ?? marketId;
    }
    const ownerProvinceIds = getOwnedProvinceIds({ ...params, countryId: market.ownerCountryId });
    if (typeof market.capitalProvinceId !== "string" || !ownerProvinceIds.includes(market.capitalProvinceId)) {
      market.capitalProvinceId = ownerProvinceIds[0] ?? null;
    }
    for (const countryId of market.memberCountryIds) {
      if (!assignment[countryId]) {
        assignment[countryId] = marketId;
      }
    }
  }
  params.gameSettings.markets.countryMarketByCountryId = assignment;
}

export function ensureMarketModelReady(params: MarketRuntimeContext): void {
  ensureMarketsStateShape(params.gameSettings);
  const knownCountryIds = new Set<string>([
    ...Object.keys(params.worldBase.resourcesByCountry ?? {}),
    ...Object.keys(params.gameSettings.markets.countryMarketByCountryId ?? {}),
  ]);
  for (const countryId of knownCountryIds) {
    const preferred = normalizeMarketId(params.gameSettings.markets.countryMarketByCountryId[countryId]) ?? countryId;
    upsertMarketMembership({ ...params, countryId, targetMarketIdRaw: preferred });
  }
  rebuildCountryMarketIndexFromMembers(params);
  const marketsById = params.gameSettings.markets.marketById;
  const corridorsById = params.gameSettings.markets.transportCorridorsById;
  const validProvinceIds = new Set<string>(params.provinceIndex.map((province) => province.id));
  for (const [corridorId, corridor] of Object.entries(corridorsById)) {
    corridor.ownerCountryId = corridor.ownerCountryId || marketsById[corridor.marketId]?.ownerCountryId || "";
    if (!corridor.ownerCountryId) {
      delete corridorsById[corridorId];
      continue;
    }
    if (!marketsById[corridor.marketId]) {
      corridor.marketId =
        normalizeMarketId(params.gameSettings.markets.countryMarketByCountryId[corridor.ownerCountryId]) ?? corridor.ownerCountryId;
    }
    if (corridor.nationalizedFromCountryId) {
      const originalMarketId =
        normalizeMarketId(params.gameSettings.markets.countryMarketByCountryId[corridor.nationalizedFromCountryId]) ??
        corridor.nationalizedFromCountryId;
      if (marketsById[originalMarketId]) {
        corridor.marketId = originalMarketId;
      }
    }
    const market = marketsById[corridor.marketId];
    if (!market) {
      delete corridorsById[corridorId];
      continue;
    }
    corridor.provinceIds = normalizeProvinceIdList(corridor.provinceIds).filter((provinceId) => validProvinceIds.has(provinceId));
    if (corridor.provinceIds.length < 2) {
      delete corridorsById[corridorId];
      continue;
    }
    corridor.routePoints = normalizeTransportCorridorRoutePoints(corridor.routePoints).filter((point) =>
      corridor.provinceIds.includes(point.provinceId),
    );
    corridor.transportMode = normalizeTransportMode(corridor.transportMode);
    corridor.level = Math.max(1, Math.floor(Number(corridor.level ?? 1) || 1));
    corridor.status = normalizeTransportCorridorStatus(corridor.status);
    corridor.costConstruction = Math.max(
      1,
      Math.floor(Number(corridor.costConstruction ?? getTransportCorridorBuildCost(corridor.transportMode, corridor.provinceIds.length - 1)) || 1),
    );
    corridor.progressConstruction = Math.max(0, Math.min(corridor.costConstruction, Number(corridor.progressConstruction ?? 0) || 0));
    corridor.lastLoadByMode = normalizeCategoryAmountMap((corridor as { lastLoadByMode?: unknown }).lastLoadByMode ?? {});
    corridor.lastCapacityByMode = normalizeCategoryAmountMap((corridor as { lastCapacityByMode?: unknown }).lastCapacityByMode ?? {});
    corridor.lastLoadHistoryByMode = Object.fromEntries(
      Object.entries(normalizeNumberHistoryMap((corridor as { lastLoadHistoryByMode?: unknown }).lastLoadHistoryByMode ?? {})).map(
        ([modeId, values]) => [
          modeId,
          values.map((value) => round3(Math.max(0, value))).slice(-params.corridorLoadHistoryLength),
        ],
      ),
    );
    corridor.foreignConstructionRights = normalizeCorridorForeignConstructionRights(
      (corridor as { foreignConstructionRights?: unknown }).foreignConstructionRights,
    ).filter((entry) => corridor.provinceIds.includes(entry.provinceId));
    corridor.nationalizedAt =
      typeof (corridor as { nationalizedAt?: unknown }).nationalizedAt === "string" &&
      ((corridor as { nationalizedAt?: unknown }).nationalizedAt as string).trim().length > 0
        ? ((corridor as { nationalizedAt?: string }).nationalizedAt as string).trim()
        : null;
    corridor.nationalizedFromCountryId =
      typeof (corridor as { nationalizedFromCountryId?: unknown }).nationalizedFromCountryId === "string" &&
      ((corridor as { nationalizedFromCountryId?: unknown }).nationalizedFromCountryId as string).trim().length > 0
        ? ((corridor as { nationalizedFromCountryId?: string }).nationalizedFromCountryId as string).trim()
        : null;
  }
}

export function getCountryMarketId(params: MarketRuntimeContext & { countryId: string }): string {
  ensureMarketModelReady(params);
  const raw = params.gameSettings.markets.countryMarketByCountryId[params.countryId];
  const next = normalizeMarketId(raw) ?? params.countryId;
  if (!params.gameSettings.markets.marketById[next]) {
    params.gameSettings.markets.marketById[next] = createDefaultMarketRecord(next, params.countryId);
  }
  return next;
}

export function setCountryMarketId(params: MarketRuntimeContext & { countryId: string; marketId: string | null }): void {
  ensureMarketModelReady(params);
  upsertMarketMembership({ ...params, targetMarketIdRaw: params.marketId });
  rebuildCountryMarketIndexFromMembers(params);
}

export function getMarketById(
  params: MarketRuntimeContext & { marketId: string },
): GameSettings["markets"]["marketById"][string] | null {
  ensureMarketModelReady(params);
  return params.gameSettings.markets.marketById[params.marketId] ?? null;
}

export function getCountryMarketRecord(
  params: MarketRuntimeContext & { countryId: string },
): GameSettings["markets"]["marketById"][string] {
  const marketId = getCountryMarketId(params);
  const market = getMarketById({ ...params, marketId });
  if (market) return market;
  const fallback = createDefaultMarketRecord(marketId, params.countryId);
  params.gameSettings.markets.marketById[marketId] = fallback;
  rebuildCountryMarketIndexFromMembers(params);
  return fallback;
}

export function getMarketTransportCorridors(
  params: MarketRuntimeContext & { marketId: string; options?: { includeDisabled?: boolean } },
): TransportCorridorEntry[] {
  ensureMarketModelReady(params);
  const includeDisabled = params.options?.includeDisabled === true;
  return Object.values(params.gameSettings.markets.transportCorridorsById ?? {})
    .filter((corridor) => corridor.marketId === params.marketId)
    .filter((corridor) => includeDisabled || corridor.status === "active")
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function cleanupMarketsAfterCountryRemoval(params: MarketRuntimeContext & {
  removedCountryId: string;
  removeUploadedByUrl: (url: string) => void;
}): void {
  ensureMarketsStateShape(params.gameSettings);
  const validCountryIds = new Set<string>(Object.keys(params.worldBase.resourcesByCountry ?? {}));
  const validProvinceIds = new Set<string>(params.provinceIndex.map((province) => province.id));
  const marketById = params.gameSettings.markets.marketById;
  for (const [marketId, market] of Object.entries(marketById)) {
    const members = [...new Set((market.memberCountryIds ?? []).filter((countryId) => validCountryIds.has(countryId)))];
    market.memberCountryIds = members;
    if (!members.includes(market.ownerCountryId)) {
      market.ownerCountryId = members[0] ?? "";
    }
    if (members.length === 0) {
      if (market.logoUrl) params.removeUploadedByUrl(market.logoUrl);
      delete marketById[marketId];
      continue;
    }
    const ownerProvinces = params.provinceIndex
      .filter((province) => params.worldBase.provinceOwner[province.id] === market.ownerCountryId)
      .map((province) => province.id);
    if (market.capitalProvinceId && !ownerProvinces.includes(market.capitalProvinceId)) {
      market.capitalProvinceId = ownerProvinces[0] ?? null;
    }
  }

  for (const [corridorId, corridor] of Object.entries(params.gameSettings.markets.transportCorridorsById ?? {})) {
    if (!marketById[corridor.marketId]) {
      corridor.marketId =
        normalizeMarketId(params.gameSettings.markets.countryMarketByCountryId[corridor.ownerCountryId]) ?? corridor.ownerCountryId;
      if (!marketById[corridor.marketId]) {
        delete params.gameSettings.markets.transportCorridorsById[corridorId];
        continue;
      }
    }
    const provinceIds = normalizeProvinceIdList(corridor.provinceIds);
    if (provinceIds.length < 2 || provinceIds.some((provinceId) => !validProvinceIds.has(provinceId))) {
      delete params.gameSettings.markets.transportCorridorsById[corridorId];
      continue;
    }
  }

  for (const [inviteId, invite] of Object.entries(params.gameSettings.markets.marketInvitesById)) {
    if (
      invite.fromCountryId === params.removedCountryId ||
      invite.toCountryId === params.removedCountryId ||
      !marketById[invite.marketId] ||
      !validCountryIds.has(invite.fromCountryId) ||
      !validCountryIds.has(invite.toCountryId)
    ) {
      delete params.gameSettings.markets.marketInvitesById[inviteId];
    }
  }

  for (const [sanctionId, sanction] of Object.entries(params.gameSettings.markets.sanctionsById ?? {})) {
    const initiatorExists = validCountryIds.has(sanction.initiatorCountryId);
    const targetExists = sanction.targetType === "country" ? validCountryIds.has(sanction.targetId) : Boolean(marketById[sanction.targetId]);
    if (!initiatorExists || !targetExists) {
      delete params.gameSettings.markets.sanctionsById[sanctionId];
    }
  }

  for (const [agreementId, agreement] of Object.entries(params.gameSettings.markets.infrastructureTransitAgreementsById ?? {})) {
    if (!validCountryIds.has(agreement.fromCountryId) || !validCountryIds.has(agreement.toCountryId)) {
      delete params.gameSettings.markets.infrastructureTransitAgreementsById[agreementId];
    }
  }

  for (const [agreementId, agreement] of Object.entries(params.gameSettings.markets.infrastructureConstructionRightsById ?? {})) {
    if (!validCountryIds.has(agreement.fromCountryId) || !validCountryIds.has(agreement.toCountryId)) {
      delete params.gameSettings.markets.infrastructureConstructionRightsById[agreementId];
    }
  }

  ensureMarketModelReady(params);
}

function round3(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}
