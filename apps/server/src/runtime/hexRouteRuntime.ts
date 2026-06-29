import type express from "express";
import type { EventLogEntry, HexMapArtifact, MapFeatureInstance, PopulationPop, RegionPopulation, WorldBase, WsOutMessage } from "@arcanorum/shared";
import type { PrismaClient } from "@prisma/client";
import { registerAdminHexMutationRoutes } from "../routes/adminHexMutationRoutes";
import { registerCountryHexCustomizationRoutes } from "../routes/countryHexCustomizationRoutes";
import { registerHexReadRoutes } from "../routes/hexReadRoutes";
import type { HexMapIndexEntry } from "../map/hexIndex";
import type { RouteAuth } from "../security/routeAuth";
import type { RegionColonizationConfig } from "../mechanics/colonizationMechanics";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";

type HexRouteRuntimeParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  prisma: PrismaClient;
  masks: {
    resourcesByCountry: number;
    hexOwner: number;
    regionOwner: number;
    regionController: number;
    colonyProgressByRegion: number;
    regionColonizationByRegion: number;
    regionPopulationByRegion: number;
    hexNameById: number;
  };
  getTurnId: () => number;
  getHexIndex: () => HexMapIndexEntry[];
  getHexMapArtifact: () => HexMapArtifact | null;
  getMapFeatures: () => MapFeatureInstance[];
  getWorldBase: () => WorldBase;
  getHexRenameDucatsCost: () => number;
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
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
  flushResourceLedger?: () => void;
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

export function registerHexRouteRuntime(params: HexRouteRuntimeParams): void {
  registerCountryHexCustomizationRoutes(params.app, {
    routeAuth: params.routeAuth,
    masks: {
      resourcesByCountry: params.masks.resourcesByCountry,
      hexNameById: params.masks.hexNameById,
    },
    getTurnId: params.getTurnId,
    getWorldBase: params.getWorldBase,
    getHexRenameDucatsCost: params.getHexRenameDucatsCost,
    hexExists: (hexId) => params.getHexIndex().some((province) => province.id === hexId),
    ensureCountryInWorldBase: params.ensureCountryInWorldBase,
    cloneWorldBaseSectionSnapshot: params.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    addResourceExpense: params.addResourceLedgerExpense,
    flushResourceLedger: params.flushResourceLedger,
    makeOfficialNews: (input) => params.makeOfficialNews(input),
    broadcast: params.broadcast,
  });

  registerHexReadRoutes(params.app, {
    routeAuth: params.routeAuth,
    getHexIndex: params.getHexIndex,
    getHexMapArtifact: params.getHexMapArtifact,
    getMapFeatures: params.getMapFeatures,
    getWorldBase: params.getWorldBase,
  });

  registerAdminHexMutationRoutes(params.app, {
    routeAuth: params.routeAuth,
    masks: {
      resourcesByCountry: params.masks.resourcesByCountry,
      hexOwner: params.masks.hexOwner,
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
