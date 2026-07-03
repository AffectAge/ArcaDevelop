import type express from "express";
import type { EventLogEntry, PopulationPop, RegionPopulation, WsOutMessage } from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

const SETTINGS_MAX_NUMBER = 1_000_000_000_000;

export const adminRegionColonizationSchema = z.object({
  colonizationCost: z.coerce.number().int().min(1).max(SETTINGS_MAX_NUMBER).optional(),
  colonizationDisabled: z.boolean().optional(),
  ownerCountryId: z.string().min(1).nullable().optional(),
  resetColonizationCostToAuto: z.boolean().optional(),
});

export const populationScopeSchema = z.enum(["region", "country", "world"]);

export const populationPopSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  size: z.coerce.number().int().min(0).max(SETTINGS_MAX_NUMBER),
  cultureId: z.string().trim().min(1),
  religionId: z.string().trim().min(1),
  raceId: z.string().trim().min(1),
  ideologies: z.record(z.string().min(1), z.coerce.number().min(0)),
  professions: z.record(
    z.string().min(1),
    z.union([
      z.coerce.number().min(0),
      z.object({
        size: z.coerce.number().min(0),
        ducats: z.coerce.number().min(0).optional(),
        standardOfLiving: z.coerce.number().min(0).optional(),
        radicals: z.coerce.number().min(0).optional(),
        loyalists: z.coerce.number().min(0).optional(),
        lastIncomeDucats: z.coerce.number().min(0).optional(),
        lastNeedsSpendDucats: z.coerce.number().min(0).optional(),
        lastNeedsSatisfaction: z.coerce.number().min(0).optional(),
        lastNeedsByCategory: z
          .record(
            z.string().min(1),
            z.object({
              required: z.coerce.number().min(0),
              fulfilled: z.coerce.number().min(0),
              spend: z.coerce.number().min(0),
              satisfaction: z.coerce.number().min(0),
            }),
          )
          .optional(),
        lastNeedsDeficitByGood: z.record(z.string().min(1), z.coerce.number().min(0)).optional(),
        lastNeedsBudgetShortageByGood: z.record(z.string().min(1), z.coerce.number().min(0)).optional(),
        lastBirths: z.coerce.number().min(0).optional(),
        lastDeaths: z.coerce.number().min(0).optional(),
      }),
    ]),
  ),
});

export const adminPopulationGenerateSchema = z.object({
  scope: populationScopeSchema,
  regionId: z.string().min(1).optional(),
  countryId: z.string().min(1).optional(),
  strategy: z.enum(["random", "custom"]),
  populationTotal: z.coerce.number().int().min(0).max(SETTINGS_MAX_NUMBER).optional(),
  pops: z.array(populationPopSchema).max(200).optional(),
}).strict();

export const adminPopulationUpdateHexSchema = z.object({
  pops: z.array(populationPopSchema).max(200),
});

export const adminPopulationClearSchema = z.object({
  scope: populationScopeSchema,
  regionId: z.string().min(1).optional(),
  countryId: z.string().min(1).optional(),
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

  app.post("/admin/population/generate", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;

    const parsed = adminPopulationGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    let targetRegionIds: string[];
    try {
      targetRegionIds = resolvePopulationTargetRegionIds(deps, parsed.data.scope, {
        regionId: parsed.data.regionId,
        countryId: parsed.data.countryId,
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "INVALID_SCOPE_TARGET" });
    }

    const worldBase = deps.getWorldBase();
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.regionPopulationByRegion);
    const domains = deps.getPopulationDomainKeys();
    let updatedCount = 0;
    for (const regionId of targetRegionIds) {
      const next =
        parsed.data.strategy === "random"
          ? deps.buildRandomRegionPopulation(regionId, domains, parsed.data.populationTotal)
          : { pops: deps.normalizePopulationPops(parsed.data.pops ?? [], regionId, domains) };
      if (!deps.isEqualRegionPopulation(worldBase.regionPopulationByRegion[regionId], next)) {
        worldBase.regionPopulationByRegion[regionId] = next;
        updatedCount += 1;
      }
    }

    deps.savePersistentState();
    if (updatedCount > 0) {
      deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    }
    return res.json({ ok: true, updatedCount, scope: parsed.data.scope, strategy: parsed.data.strategy });
  });

  app.post("/admin/population/clear", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;

    const parsed = adminPopulationClearSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    let targetRegionIds: string[];
    try {
      targetRegionIds = resolvePopulationTargetRegionIds(deps, parsed.data.scope, {
        regionId: parsed.data.regionId,
        countryId: parsed.data.countryId,
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "INVALID_SCOPE_TARGET" });
    }

    const worldBase = deps.getWorldBase();
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.regionPopulationByRegion);
    let updatedCount = 0;
    for (const regionId of targetRegionIds) {
      const next: RegionPopulation = { pops: [] };
      if (!deps.isEqualRegionPopulation(worldBase.regionPopulationByRegion[regionId], next)) {
        worldBase.regionPopulationByRegion[regionId] = next;
        updatedCount += 1;
      }
    }

    deps.savePersistentState();
    if (updatedCount > 0) {
      deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    }
    return res.json({ ok: true, updatedCount, scope: parsed.data.scope });
  });

  app.patch("/admin/population/regions/:regionId", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;

    const regionId = String(req.params.regionId);
    if (!regionExists(deps.getWorldBase(), regionId)) {
      return res.status(404).json({ error: "REGION_NOT_FOUND" });
    }

    const parsed = adminPopulationUpdateHexSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const worldBase = deps.getWorldBase();
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.regionPopulationByRegion);
    const domains = deps.getPopulationDomainKeys();
    const next: RegionPopulation = {
      pops: deps.normalizePopulationPops(parsed.data.pops, regionId, domains),
    };
    worldBase.regionPopulationByRegion[regionId] = next;

    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json({
      region: {
        id: regionId,
        population: worldBase.regionPopulationByRegion[regionId],
      },
    });
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

function resolvePopulationTargetRegionIds(
  deps: AdminHexMutationRoutesDependencies,
  scope: z.infer<typeof populationScopeSchema>,
  params: { regionId?: string; countryId?: string },
): string[] {
  const worldBase = deps.getWorldBase();
  const regionIdSet = buildKnownRegionIdSet(worldBase);
  const regionIds = [...regionIdSet].sort();
  if (scope === "world") {
    return regionIds;
  }
  if (scope === "region") {
    const regionId = params.regionId?.trim();
    if (!regionId) {
      throw new Error("REGION_ID_REQUIRED");
    }
    if (!regionIdSet.has(regionId)) {
      throw new Error("REGION_NOT_FOUND");
    }
    return [regionId];
  }
  const countryId = params.countryId?.trim();
  if (!countryId) {
    throw new Error("COUNTRY_ID_REQUIRED");
  }
  const ownedRegionIds = regionIds
    .filter((regionId) => (worldBase.regionController[regionId] ?? worldBase.regionOwner[regionId]) === countryId);
  if (ownedRegionIds.length === 0) {
    throw new Error("COUNTRY_HAS_NO_REGIONS");
  }
  return ownedRegionIds;
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
