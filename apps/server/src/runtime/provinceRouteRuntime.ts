import type express from "express";
import type { EventLogEntry, PopulationPop, RegionPopulation, WorldBase, WsOutMessage } from "@arcanorum/shared";
import type { PrismaClient } from "@prisma/client";
import { registerAdminProvinceMutationRoutes } from "../routes/adminProvinceMutationRoutes";
import { registerCountryProvinceCustomizationRoutes } from "../routes/countryProvinceCustomizationRoutes";
import { registerProvinceReadRoutes } from "../routes/provinceReadRoutes";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import type { RouteAuth } from "../security/routeAuth";
import type { RegionColonizationConfig } from "../mechanics/colonizationMechanics";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";

type ProvinceRouteRuntimeParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  prisma: PrismaClient;
  masks: {
    resourcesByCountry: number;
    provinceOwner: number;
    regionOwner: number;
    regionController: number;
    colonyProgressByRegion: number;
    regionColonizationByRegion: number;
    regionPopulationByRegion: number;
    provinceNameById: number;
  };
  getTurnId: () => number;
  getProvinceIndex: () => Adm1ProvinceIndexEntry[];
  getWorldBase: () => WorldBase;
  getProvinceRenameDucatsCost: () => number;
  getRegionColonizationConfig: (regionId: string) => RegionColonizationConfig;
  getRegionDerivedColonizationCosts: (regionId: string) => { pointsCost: number; ducatsCost: number };
  getPopulationDomainKeys: () => unknown;
  buildRandomRegionPopulation: (
    regionId: string,
    domains: unknown,
    populationTotal: number | undefined,
  ) => RegionPopulation;
  normalizePopulationPops: (rawPops: unknown, regionId: string, domains: unknown) => PopulationPop[];
  isEqualRegionPopulation: (
    previousPopulation: RegionPopulation | undefined,
    nextPopulation: RegionPopulation,
  ) => boolean;
  cleanupRegionColonizationProgress: (regionId: string) => void;
  recalculateAllRegionColonizationCosts: () => number;
  ensureCountryInWorldBase: (countryId: string) => void;
  cloneWorldBaseSectionSnapshot: (mask: number) => WorldBaseSectionSnapshot;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: WorldBaseSectionSnapshot) => void;
  makeOfficialNews: (input: {
    turn: number;
    category: "colonization" | "politics";
    title: string;
    message: string;
    countryId: string;
    priority: "low";
    visibility: "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export function registerProvinceRouteRuntime(params: ProvinceRouteRuntimeParams): void {
  registerCountryProvinceCustomizationRoutes(params.app, {
    routeAuth: params.routeAuth,
    masks: {
      resourcesByCountry: params.masks.resourcesByCountry,
      provinceNameById: params.masks.provinceNameById,
    },
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getProvinceRenameDucatsCost: params.getProvinceRenameDucatsCost,
    provinceExists: (provinceId) => params.getProvinceIndex().some((province) => province.id === provinceId),
    ensureCountryInWorldBase: params.ensureCountryInWorldBase,
    cloneWorldBaseSectionSnapshot: params.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    makeOfficialNews: (input) => params.makeOfficialNews(input),
    broadcast: params.broadcast,
  });

  registerProvinceReadRoutes(params.app, {
    routeAuth: params.routeAuth,
    getProvinceIndex: params.getProvinceIndex,
    getWorldBase: params.getWorldBase,
  });

  registerAdminProvinceMutationRoutes(params.app, {
    routeAuth: params.routeAuth,
    masks: {
      resourcesByCountry: params.masks.resourcesByCountry,
      provinceOwner: params.masks.provinceOwner,
      regionOwner: params.masks.regionOwner,
      regionController: params.masks.regionController,
      colonyProgressByRegion: params.masks.colonyProgressByRegion,
      regionColonizationByRegion: params.masks.regionColonizationByRegion,
      regionPopulationByRegion: params.masks.regionPopulationByRegion,
    },
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getRegionColonizationConfig: params.getRegionColonizationConfig,
    getRegionDerivedColonizationCosts: params.getRegionDerivedColonizationCosts,
    getPopulationDomainKeys: params.getPopulationDomainKeys,
    buildRandomRegionPopulation: params.buildRandomRegionPopulation,
    normalizePopulationPops: params.normalizePopulationPops,
    isEqualRegionPopulation: params.isEqualRegionPopulation,
    cleanupRegionColonizationProgress: params.cleanupRegionColonizationProgress,
    recalculateAllRegionColonizationCosts: params.recalculateAllRegionColonizationCosts,
    countryExists: async (countryId) =>
      Boolean(await params.prisma.country.findUnique({ where: { id: countryId }, select: { id: true } })),
    ensureCountryInWorldBase: params.ensureCountryInWorldBase,
    cloneWorldBaseSectionSnapshot: params.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    makeOfficialNews: (input) => params.makeOfficialNews(input),
    broadcast: params.broadcast,
  });
}
