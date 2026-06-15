import type express from "express";
import type { TreatyConstructionExpirationPolicy } from "@arcanorum/shared";
import {
  GOOD_TRANSPORT_MODES,
  DEFAULT_TRADEABLE_TRANSPORT_MODES,
  normalizeGoodTransportModesList,
  type GoodTransportMode,
} from "../mechanics/marketTurnMechanics";
import type { RouteAuth } from "../security/routeAuth";
import { registerInfrastructureRoutes } from "../routes/infrastructureRoutes";
import { registerMarketCorridorRoutes } from "../routes/marketCorridorRoutes";
import { registerMarketMembershipRoutes } from "../routes/marketMembershipRoutes";
import { registerMarketMutationRoutes, type MarketMutationUploadMiddleware } from "../routes/marketMutationRoutes";
import { registerMarketReadRoutes } from "../routes/marketReadRoutes";
import { registerMarketSanctionRoutes } from "../routes/marketSanctionRoutes";
import type { GameSettings, MarketSanctionEntry, TransportCorridorEntry } from "./gameSettingsTypes";

type CountryListRow = {
  id: string;
  name: string;
  flagUrl?: string | null;
};

type MarketRouteRuntimeParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  upload: MarketMutationUploadMiddleware;
  maxSettingNumber: number;
  createId: () => string;
  getTurnId: () => number;
  getGameSettings: () => GameSettings;
  ensureCountryInWorldBase: (countryId: string) => void;
  getCountryMarketId: (countryId: string) => string;
  getMarketById: (marketId: string) => GameSettings["markets"]["marketById"][string] | null;
  getMarketTransportCorridors: (marketId: string, options?: { includeDisabled?: boolean }) => TransportCorridorEntry[];
  getTransportCorridorCapacity: (corridor: TransportCorridorEntry, categoryId: string | null) => number;
  getCountryGoodPrices: () => Record<string, Record<string, number>>;
  getGlobalGoodPrices: () => Record<string, number>;
  getGlobalGoodPriceHistoryByResourceId: () => Record<string, number[]>;
  getGlobalGoodDemandHistoryByResourceId: () => Record<string, number[]>;
  getGlobalGoodOfferHistoryByResourceId: () => Record<string, number[]>;
  getGlobalGoodProductionFactHistoryByResourceId: () => Record<string, number[]>;
  getGlobalGoodProductionMaxHistoryByResourceId: () => Record<string, number[]>;
  getLatestMarketOverview: () => unknown;
  getProvinceOwner: (provinceId: string) => string | null;
  getMarketDisplayName: (params: { marketId: string; marketName: string; ownerCountryName?: string | null }) => string;
  normalizeMarketVisibility: (value: unknown) => "public" | "private";
  normalizeTransportCorridorRoutePoints: (input: unknown) => NonNullable<TransportCorridorEntry["routePoints"]>;
  normalizeProvinceIdList: (input: unknown) => string[];
  isProvinceAllowedForCorridorOwner: (provinceId: string, ownerCountryId: string, transportMode: GoodTransportMode) => boolean;
  isContiguousTransportCorridorRoute: (provinceIds: string[], routePoints?: TransportCorridorEntry["routePoints"]) => boolean;
  getInfrastructureConstructionRightForProvince: (
    provinceId: string,
    ownerCountryId: string,
    transportMode: GoodTransportMode,
  ) => {
    id: string;
    expirationPolicy: TreatyConstructionExpirationPolicy;
    sourceProposalId?: string | null;
    sourceClauseId?: string | null;
  } | null;
  getTransportCorridorBuildCost: (transportMode: GoodTransportMode, segments: number) => number;
  refreshExpiredDiplomacyProposals: () => void;
  upsertMarketMembership: (countryId: string, marketId: string | null) => void;
  rebuildCountryMarketIndexFromMembers: () => void;
  ensureMarketModelReady: () => void;
  countryExists: (countryId: string) => Promise<boolean>;
  listCountriesByIds: (countryIds: string[]) => Promise<CountryListRow[]>;
  validateImageDimensions: (file: Express.Multer.File) => boolean;
  removeUploadedFile: (file: Express.Multer.File | undefined) => void;
  removeUploadedByUrl: (url: string) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
  round3: (value: number) => number;
  savePersistentState: () => void;
};

export function registerMarketRuntimeRoutes(params: MarketRouteRuntimeParams): void {
  const buildMarketDetailsResponse = async (marketId: string): Promise<{
    market: {
      id: string;
      name: string;
      logoUrl: string | null;
      ownerCountryId: string;
      ownerCountryName: string;
      capitalProvinceId: string | null;
      memberCountryIds: string[];
      visibility: "public" | "private";
      createdAt: string;
      members: Array<{ countryId: string; countryName: string; flagUrl: string | null; isOwner: boolean }>;
      transportCorridors: TransportCorridorEntry[];
    };
  }> => {
    const market = params.getMarketById(marketId);
    if (!market) {
      throw new Error("MARKET_NOT_FOUND");
    }
    const countries = await params.listCountriesByIds(market.memberCountryIds);
    const byId = new Map(countries.map((country) => [country.id, country] as const));
    const members = market.memberCountryIds.map((countryId) => {
      const country = byId.get(countryId);
      return {
        countryId,
        countryName: country?.name ?? countryId,
        flagUrl: country?.flagUrl ?? null,
        isOwner: market.ownerCountryId === countryId,
      };
    });
    return {
      market: {
        id: market.id,
        name: params.getMarketDisplayName({
          marketId: market.id,
          marketName: market.name,
          ownerCountryName: byId.get(market.ownerCountryId)?.name ?? market.ownerCountryId,
        }),
        logoUrl: market.logoUrl,
        ownerCountryId: market.ownerCountryId,
        ownerCountryName: byId.get(market.ownerCountryId)?.name ?? market.ownerCountryId,
        capitalProvinceId: market.capitalProvinceId ?? null,
        memberCountryIds: [...market.memberCountryIds],
        visibility: market.visibility,
        createdAt: market.createdAt,
        members,
        transportCorridors: params.getMarketTransportCorridors(market.id, { includeDisabled: true }),
      },
    };
  };

  const enrichMarketInvites = async (
    invites: Array<GameSettings["markets"]["marketInvitesById"][string]>,
  ): Promise<
    Array<
      GameSettings["markets"]["marketInvitesById"][string] & {
        marketName: string;
        marketLogoUrl: string | null;
        fromCountryName: string;
        fromCountryFlagUrl: string | null;
        toCountryName: string;
        toCountryFlagUrl: string | null;
      }
    >
  > => {
    const gameSettings = params.getGameSettings();
    const countryIds = [...new Set(invites.flatMap((invite) => [invite.fromCountryId, invite.toCountryId]))];
    const countries = countryIds.length ? await params.listCountriesByIds(countryIds) : [];
    const countryById = new Map(countries.map((country) => [country.id, country] as const));
    return invites.map((invite) => ({
      ...invite,
      marketName: params.getMarketDisplayName({
        marketId: invite.marketId,
        marketName: gameSettings.markets.marketById[invite.marketId]?.name ?? "",
        ownerCountryName: countryById.get(gameSettings.markets.marketById[invite.marketId]?.ownerCountryId ?? "")?.name ?? null,
      }),
      marketLogoUrl: gameSettings.markets.marketById[invite.marketId]?.logoUrl ?? null,
      fromCountryName: countryById.get(invite.fromCountryId)?.name ?? invite.fromCountryId,
      fromCountryFlagUrl: countryById.get(invite.fromCountryId)?.flagUrl ?? null,
      toCountryName: countryById.get(invite.toCountryId)?.name ?? invite.toCountryId,
      toCountryFlagUrl: countryById.get(invite.toCountryId)?.flagUrl ?? null,
    }));
  };

  const enrichMarketSanctions = async (
    sanctions: MarketSanctionEntry[],
  ): Promise<
    Array<
      MarketSanctionEntry & {
        initiatorCountryName: string;
        targetName: string;
        goodsNamed: Array<{ id: string; name: string }>;
        activeNow: boolean;
        expiresAtTurn: number;
      }
    >
  > => {
    const gameSettings = params.getGameSettings();
    const countryIds = new Set<string>();
    for (const sanction of sanctions) {
      countryIds.add(sanction.initiatorCountryId);
      if (sanction.targetType === "country") countryIds.add(sanction.targetId);
    }
    const countries = countryIds.size ? await params.listCountriesByIds([...countryIds]) : [];
    const countryById = new Map(countries.map((country) => [country.id, country.name] as const));
    const goodsById = new Map(gameSettings.content.goods.map((good) => [good.id, good.name] as const));
    return sanctions.map((sanction) => {
      const targetName =
        sanction.targetType === "country"
          ? countryById.get(sanction.targetId) ?? sanction.targetId
          : params.getMarketDisplayName({
              marketId: sanction.targetId,
              marketName: gameSettings.markets.marketById[sanction.targetId]?.name ?? sanction.targetId,
              ownerCountryName: null,
            });
      const goodsNamed = (sanction.goods ?? []).map((id) => ({ id, name: goodsById.get(id) ?? id }));
      const expiresAtTurn = sanction.startTurn + sanction.durationTurns;
      const activeNow =
        sanction.enabled !== false && params.getTurnId() >= sanction.startTurn && params.getTurnId() < sanction.startTurn + sanction.durationTurns;
      return {
        ...sanction,
        initiatorCountryName: countryById.get(sanction.initiatorCountryId) ?? sanction.initiatorCountryId,
        targetName,
        goodsNamed,
        activeNow,
        expiresAtTurn,
      };
    });
  };

  registerMarketReadRoutes(params.app, {
    routeAuth: params.routeAuth,
    getTurnId: params.getTurnId,
    ensureCountryInWorldBase: params.ensureCountryInWorldBase,
    getCountryMarketId: params.getCountryMarketId,
    getMarketById: params.getMarketById,
    getGoods: () => params.getGameSettings().content.goods,
    getLatestMarketOverview: () => params.getLatestMarketOverview() as never,
    getCountryGoodPrices: params.getCountryGoodPrices,
    getGlobalGoodPrices: params.getGlobalGoodPrices,
    getGlobalGoodPriceHistoryByResourceId: params.getGlobalGoodPriceHistoryByResourceId,
    getGlobalGoodDemandHistoryByResourceId: params.getGlobalGoodDemandHistoryByResourceId,
    getGlobalGoodOfferHistoryByResourceId: params.getGlobalGoodOfferHistoryByResourceId,
    getGlobalGoodProductionFactHistoryByResourceId: params.getGlobalGoodProductionFactHistoryByResourceId,
    getGlobalGoodProductionMaxHistoryByResourceId: params.getGlobalGoodProductionMaxHistoryByResourceId,
    getProvinceOwner: params.getProvinceOwner,
    getMarketTransportCorridors: params.getMarketTransportCorridors,
    getTransportCorridorCapacity: params.getTransportCorridorCapacity,
    getTransportModes: () => GOOD_TRANSPORT_MODES,
    round3: params.round3,
    ensureMarketModelReady: params.ensureMarketModelReady,
    getMarkets: () => Object.values(params.getGameSettings().markets.marketById),
    getMarketInvites: () => Object.values(params.getGameSettings().markets.marketInvitesById),
    listCountriesByIds: params.listCountriesByIds,
    getMarketDisplayName: params.getMarketDisplayName,
    buildMarketDetailsResponse,
  });

  registerMarketMutationRoutes(params.app, {
    routeAuth: params.routeAuth,
    upload: params.upload,
    getMarketById: params.getMarketById,
    normalizeMarketVisibility: params.normalizeMarketVisibility,
    getProvinceOwner: params.getProvinceOwner,
    validateImageDimensions: params.validateImageDimensions,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    savePersistentState: params.savePersistentState,
    buildMarketDetailsResponse,
  });

  registerMarketCorridorRoutes(params.app, {
    routeAuth: params.routeAuth,
    createId: params.createId,
    refreshExpiredDiplomacyProposals: params.refreshExpiredDiplomacyProposals,
    getMarketById: params.getMarketById,
    getCorridorsById: () => params.getGameSettings().markets.transportCorridorsById,
    getMarketTransportCorridors: params.getMarketTransportCorridors,
    normalizeTransportCorridorRoutePoints: params.normalizeTransportCorridorRoutePoints,
    normalizeProvinceIdList: params.normalizeProvinceIdList,
    isProvinceAllowedForCorridorOwner: params.isProvinceAllowedForCorridorOwner,
    isContiguousTransportCorridorRoute: params.isContiguousTransportCorridorRoute,
    getProvinceOwner: params.getProvinceOwner,
    getInfrastructureConstructionRightForProvince: params.getInfrastructureConstructionRightForProvince,
    getTransportCorridorBuildCost: params.getTransportCorridorBuildCost,
    savePersistentState: params.savePersistentState,
  });

  registerMarketMembershipRoutes(params.app, {
    routeAuth: params.routeAuth,
    createId: params.createId,
    getMarketById: params.getMarketById,
    getMarketInvitesById: () => params.getGameSettings().markets.marketInvitesById,
    countryExists: params.countryExists,
    enrichMarketInvites,
    upsertMarketMembership: params.upsertMarketMembership,
    rebuildCountryMarketIndexFromMembers: params.rebuildCountryMarketIndexFromMembers,
    getCountryMarketId: params.getCountryMarketId,
    buildMarketDetailsResponse,
    savePersistentState: params.savePersistentState,
  });

  registerMarketSanctionRoutes(params.app, {
    routeAuth: params.routeAuth,
    maxSettingNumber: params.maxSettingNumber,
    createId: params.createId,
    getTurnId: params.getTurnId,
    getMarketById: params.getMarketById,
    getSanctionsById: () => params.getGameSettings().markets.sanctionsById,
    countryExists: params.countryExists,
    getValidGoodIds: () => new Set(params.getGameSettings().content.goods.map((good) => good.id)),
    enrichMarketSanctions,
    round3: params.round3,
    savePersistentState: params.savePersistentState,
  });

  registerInfrastructureRoutes(params.app, {
    routeAuth: params.routeAuth,
    createId: params.createId,
    ensureMarketModelReady: params.ensureMarketModelReady,
    getTransitAgreementsById: () => params.getGameSettings().markets.infrastructureTransitAgreementsById,
    getConstructionRightsById: () => params.getGameSettings().markets.infrastructureConstructionRightsById,
    countryIdsExist: async (countryIds) => {
      const countries = await params.listCountriesByIds(countryIds);
      return new Set(countries.map((country) => country.id));
    },
    normalizeTransportModes: (input) => normalizeGoodTransportModesList(input, DEFAULT_TRADEABLE_TRANSPORT_MODES),
    savePersistentState: params.savePersistentState,
  });
}
