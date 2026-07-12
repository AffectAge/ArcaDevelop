import type express from "express";
import type { EventLogEntry, RegionPopulation, WsOutMessage } from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

const SETTINGS_MAX_NUMBER = 1_000_000_000_000;

export const adminRegionColonizationSchema = z.object({
  colonizationCost: z.coerce.number().int().min(1).max(SETTINGS_MAX_NUMBER).optional(),
  colonizationDisabled: z.boolean().optional(),
  ownerCountryId: z.string().min(1).nullable().optional(),
  resetColonizationCostToAuto: z.boolean().optional(),
});

export type AdminHexMutationWorldState = {
  hexOwner: Record<string, string>;
  regionOwner: Record<string, string>;
  regionController: Record<string, string>;
  colonyProgressByRegion: Record<string, Record<string, number>>;
  regionColonizationByRegion: Record<string, { cost: number; disabled: boolean; manualCost?: boolean }>;
  regionPopulationByRegion: Record<string, RegionPopulation>;
};

export type AdminHexMutationMasks = {
  resourcesByCountry: number;
  hexOwner: number;
  regionOwner: number;
  regionController: number;
  colonyProgressByRegion: number;
  regionColonizationByRegion: number;
  regionPopulationByRegion: number;
};

export type RegionColonizationConfig = {
  cost: number;
  disabled: boolean;
  manualCost: boolean;
};

export type AdminHexMutationRoutesDependencies = {
  routeAuth: RouteAuth;
  masks: AdminHexMutationMasks;
  getTurnId: () => number;
  getWorldBase: () => AdminHexMutationWorldState;
  getRegionColonizationConfig: (regionId: string) => RegionColonizationConfig;
  getRegionDerivedColonizationCosts: (regionId: string) => { pointsCost: number; ducatsCost: number };
  cleanupRegionColonizationProgress: (regionId: string) => void;
  recalculateAllRegionColonizationCosts: () => number;
  countryExists: (countryId: string) => Promise<boolean>;
  ensureCountryInWorldBase: (countryId: string) => void;
  cloneWorldBaseSectionSnapshot: (mask: number) => unknown;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: unknown) => void;
  makeOfficialNews: (input: {
    turn: number;
    category: "colonization";
    title: string;
    message: string;
    countryId: string;
    priority: "low";
    visibility: "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export function registerAdminHexMutationRoutes(
  app: express.Express,
  deps: AdminHexMutationRoutesDependencies,
): void {
  app.get("/admin/regions", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;

    const worldBase = deps.getWorldBase();
    const regions = getKnownRegionIds(worldBase).map((regionId) =>
      summarizeRegion(worldBase, regionId, deps.getRegionColonizationConfig(regionId)),
    );

    return res.json({ regions });
  });

  app.patch("/admin/regions/:regionId", async (req, res) => {
    const auth = await deps.routeAuth.requireAdmin(req, res);
    if (!auth) return;

    const parsed = adminRegionColonizationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const regionId = String(req.params.regionId);
    if (!regionExists(deps.getWorldBase(), regionId)) {
      return res.status(404).json({ error: "REGION_NOT_FOUND" });
    }

    const worldBase = deps.getWorldBase();
    const cfg = deps.getRegionColonizationConfig(regionId);
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.resourcesByCountry |
        deps.masks.regionOwner |
        deps.masks.regionController |
        deps.masks.colonyProgressByRegion |
        deps.masks.regionColonizationByRegion,
    );
    let clearedProgress = false;

    if (parsed.data.resetColonizationCostToAuto) {
      const derived = deps.getRegionDerivedColonizationCosts(regionId);
      cfg.cost = derived.pointsCost;
      cfg.manualCost = false;
    } else if (typeof parsed.data.colonizationCost === "number") {
      cfg.cost = Math.max(1, Math.floor(parsed.data.colonizationCost));
      cfg.manualCost = true;
    }
    if (typeof parsed.data.colonizationDisabled === "boolean") {
      cfg.disabled = parsed.data.colonizationDisabled;
      if (cfg.disabled) {
        deps.cleanupRegionColonizationProgress(regionId);
        clearedProgress = true;
      }
    }
    worldBase.regionColonizationByRegion[regionId] = cfg;
    if (parsed.data.ownerCountryId !== undefined) {
      const nextOwner = parsed.data.ownerCountryId;
      if (nextOwner) {
        const ownerExists = await deps.countryExists(nextOwner);
        if (!ownerExists) {
          return res.status(404).json({ error: "COUNTRY_NOT_FOUND" });
        }
        deps.ensureCountryInWorldBase(nextOwner);
        worldBase.regionOwner[regionId] = nextOwner;
        worldBase.regionController[regionId] = nextOwner;
      } else {
        delete worldBase.regionOwner[regionId];
        delete worldBase.regionController[regionId];
      }
      deps.cleanupRegionColonizationProgress(regionId);
      clearedProgress = true;
    }

    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    if (
      parsed.data.colonizationDisabled !== undefined ||
      parsed.data.colonizationCost !== undefined ||
      parsed.data.ownerCountryId !== undefined
    ) {
      deps.broadcast({
        type: "NEWS_EVENT",
        event: deps.makeOfficialNews({
          turn: deps.getTurnId(),
          category: "colonization",
          title: "Регион обновлён",
          message: `Администратор обновил колонизационные параметры региона ${regionId}${clearedProgress ? " (прогресс очищен)" : ""}`,
          countryId: auth.countryId,
          priority: "low",
          visibility: "public",
        }),
      });
    }

    return res.json({
      region: summarizeRegion(worldBase, regionId, cfg),
    });
  });

  app.post("/admin/regions/recalculate-auto-costs", async (req, res) => {
    const auth = await deps.routeAuth.requireAdmin(req, res);
    if (!auth) return;
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.regionColonizationByRegion);
    const updatedCount = deps.recalculateAllRegionColonizationCosts();
    deps.savePersistentState();
    if (updatedCount > 0) {
      deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
      deps.broadcast({
        type: "NEWS_EVENT",
        event: deps.makeOfficialNews({
          turn: deps.getTurnId(),
          category: "colonization",
          title: "Пересчёт цен регионов",
          message: `Администратор пересчитал авто-цены колонизации для ${updatedCount} регионов`,
          countryId: auth.countryId,
          priority: "low",
          visibility: "public",
        }),
      });
    }
    return res.json({ ok: true, updatedCount });
  });
}

function getKnownRegionIds(worldBase: AdminHexMutationWorldState): string[] {
  return [...buildKnownRegionIdSet(worldBase)].sort();
}

function regionExists(worldBase: AdminHexMutationWorldState, regionId: string): boolean {
  return buildKnownRegionIdSet(worldBase).has(regionId);
}

function buildKnownRegionIdSet(worldBase: AdminHexMutationWorldState): Set<string> {
  return new Set([
    ...Object.keys(worldBase.regionOwner),
    ...Object.keys(worldBase.regionController),
    ...Object.keys(worldBase.regionPopulationByRegion),
    ...Object.keys(worldBase.regionColonizationByRegion),
    ...Object.keys(worldBase.colonyProgressByRegion),
  ]);
}

function summarizeRegion(
  worldBase: AdminHexMutationWorldState,
  regionId: string,
  cfg: RegionColonizationConfig,
): {
  id: string;
  ownerCountryId: string | null;
  controllerCountryId: string | null;
  colonizationCost: number;
  colonizationDisabled: boolean;
  manualCost: boolean;
  colonyProgressByCountry: Record<string, number>;
  population: RegionPopulation | null;
} {
  return {
    id: regionId,
    ownerCountryId: worldBase.regionOwner[regionId] ?? null,
    controllerCountryId: worldBase.regionController[regionId] ?? null,
    colonizationCost: cfg.cost,
    colonizationDisabled: cfg.disabled,
    manualCost: cfg.manualCost,
    colonyProgressByCountry: worldBase.colonyProgressByRegion[regionId] ?? {},
    population: worldBase.regionPopulationByRegion[regionId] ?? null,
  };
}
