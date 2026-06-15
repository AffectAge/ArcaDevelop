import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { registerMarketRuntimeRoutes } from "./marketRouteRuntime";
import type { RouteAuth } from "../security/routeAuth";
import type { createCountryWorldRuntime } from "./countryWorldRuntime";
import type { createMarketRuntimeFacade } from "./marketRuntimeFacade";
import type { createMarketAccessRuntime } from "./marketAccessRuntime";
import type { GameSettings } from "./gameSettingsTypes";
import type { MarketOverviewState } from "../mechanics/marketTurnMechanics";
import type { upload } from "../uploads/uploadMiddleware";

type MarketRuntimeDeps = Parameters<typeof registerMarketRuntimeRoutes>[0];

type MarketRouteCompositionParams = {
  app: Express;
  prisma: PrismaClient;
  routeAuth: RouteAuth;
  upload: typeof upload;
  maxSettingNumber: number;
  createId: () => string;
  getTurnId: () => number;
  getGameSettings: () => GameSettings;
  getWorldBase: () => { provinceOwner: Record<string, string | undefined> };
  countryWorldRuntime: ReturnType<typeof createCountryWorldRuntime>;
  marketRuntimeFacade: ReturnType<typeof createMarketRuntimeFacade>;
  marketAccessRuntime: ReturnType<typeof createMarketAccessRuntime>;
  getCountryGoodPrices: MarketRuntimeDeps["getCountryGoodPrices"];
  getGlobalGoodPrices: MarketRuntimeDeps["getGlobalGoodPrices"];
  getGlobalGoodPriceHistoryByResourceId: MarketRuntimeDeps["getGlobalGoodPriceHistoryByResourceId"];
  getGlobalGoodDemandHistoryByResourceId: MarketRuntimeDeps["getGlobalGoodDemandHistoryByResourceId"];
  getGlobalGoodOfferHistoryByResourceId: MarketRuntimeDeps["getGlobalGoodOfferHistoryByResourceId"];
  getGlobalGoodProductionFactHistoryByResourceId: MarketRuntimeDeps["getGlobalGoodProductionFactHistoryByResourceId"];
  getGlobalGoodProductionMaxHistoryByResourceId: MarketRuntimeDeps["getGlobalGoodProductionMaxHistoryByResourceId"];
  getLatestMarketOverview: () => MarketOverviewState;
  normalizeMarketVisibility: MarketRuntimeDeps["normalizeMarketVisibility"];
  normalizeTransportCorridorRoutePoints: MarketRuntimeDeps["normalizeTransportCorridorRoutePoints"];
  normalizeProvinceIdList: MarketRuntimeDeps["normalizeProvinceIdList"];
  getTransportCorridorBuildCost: MarketRuntimeDeps["getTransportCorridorBuildCost"];
  refreshExpiredDiplomacyProposals: () => void;
  validateImageDimensions: MarketRuntimeDeps["validateImageDimensions"];
  removeUploadedFile: MarketRuntimeDeps["removeUploadedFile"];
  removeUploadedByUrl: MarketRuntimeDeps["removeUploadedByUrl"];
  makeVersionedUploadUrl: MarketRuntimeDeps["makeVersionedUploadUrl"];
  round3: (value: number) => number;
  savePersistentState: () => void;
};

export function registerMarketRouteComposition(params: MarketRouteCompositionParams): void {
  registerMarketRuntimeRoutes({
    app: params.app,
    routeAuth: params.routeAuth,
    upload: params.upload,
    maxSettingNumber: params.maxSettingNumber,
    createId: params.createId,
    getTurnId: params.getTurnId,
    getGameSettings: params.getGameSettings,
    ensureCountryInWorldBase: params.countryWorldRuntime.ensureCountryInWorldBase,
    getCountryMarketId: params.marketRuntimeFacade.getCountryMarketId,
    getMarketById: params.marketRuntimeFacade.getMarketById,
    getMarketTransportCorridors: params.marketRuntimeFacade.getMarketTransportCorridors,
    getTransportCorridorCapacity: params.marketAccessRuntime.getTransportCorridorCapacity,
    getCountryGoodPrices: params.getCountryGoodPrices,
    getGlobalGoodPrices: params.getGlobalGoodPrices,
    getGlobalGoodPriceHistoryByResourceId: params.getGlobalGoodPriceHistoryByResourceId,
    getGlobalGoodDemandHistoryByResourceId: params.getGlobalGoodDemandHistoryByResourceId,
    getGlobalGoodOfferHistoryByResourceId: params.getGlobalGoodOfferHistoryByResourceId,
    getGlobalGoodProductionFactHistoryByResourceId: params.getGlobalGoodProductionFactHistoryByResourceId,
    getGlobalGoodProductionMaxHistoryByResourceId: params.getGlobalGoodProductionMaxHistoryByResourceId,
    getLatestMarketOverview: params.getLatestMarketOverview,
    getProvinceOwner: (provinceId) => params.getWorldBase().provinceOwner[provinceId] ?? null,
    getMarketDisplayName: params.marketRuntimeFacade.getMarketDisplayName,
    normalizeMarketVisibility: params.normalizeMarketVisibility,
    normalizeTransportCorridorRoutePoints: params.normalizeTransportCorridorRoutePoints,
    normalizeProvinceIdList: params.normalizeProvinceIdList,
    isProvinceAllowedForCorridorOwner: params.marketAccessRuntime.isProvinceAllowedForCorridorOwner,
    isContiguousTransportCorridorRoute: params.marketAccessRuntime.isContiguousTransportCorridorRoute,
    getInfrastructureConstructionRightForProvince: params.marketAccessRuntime.getInfrastructureConstructionRightForProvince,
    getTransportCorridorBuildCost: params.getTransportCorridorBuildCost,
    refreshExpiredDiplomacyProposals: params.refreshExpiredDiplomacyProposals,
    upsertMarketMembership: params.marketRuntimeFacade.upsertMarketMembership,
    rebuildCountryMarketIndexFromMembers: params.marketRuntimeFacade.rebuildCountryMarketIndexFromMembers,
    ensureMarketModelReady: params.marketRuntimeFacade.ensureMarketModelReady,
    countryExists: async (countryId) => {
      const country = await params.prisma.country.findUnique({ where: { id: countryId }, select: { id: true } });
      return Boolean(country);
    },
    listCountriesByIds: (countryIds) =>
      params.prisma.country.findMany({
        where: { id: { in: countryIds } },
        select: { id: true, name: true, flagUrl: true },
      }),
    validateImageDimensions: params.validateImageDimensions,
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    round3: params.round3,
    savePersistentState: params.savePersistentState,
  });
}
