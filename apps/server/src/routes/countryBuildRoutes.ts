import type express from "express";
import type {
  BuildingInstance,
  Order,
  RegionConstructionProject,
  ResourceFlowSourceType,
  ResourceId,
  ResourceTotals,
} from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export const buildCancelSchema = z
  .object({
    regionId: z.string().min(1).optional(),
    queueId: z.string().min(1).optional(),
    orderId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.orderId) || Boolean(value.regionId && value.queueId), {
    message: "orderId or (regionId + queueId) required",
  });

export const buildDemolishSchema = z.object({
  regionId: z.string().min(1),
  buildingId: z.string().min(1),
  instanceId: z.string().min(1).optional(),
});

export const buildUpgradeStateSchema = z.object({
  regionId: z.string().min(1),
  buildingId: z.string().min(1),
  instanceId: z.string().min(1).optional(),
});

export const buildAutoUpgradeSchema = z.object({
  regionId: z.string().min(1),
  buildingId: z.string().min(1),
  instanceId: z.string().min(1).optional(),
  enabled: z.boolean(),
});

export const buildSubsidiesSchema = z.object({
  regionId: z.string().min(1),
  buildingId: z.string().min(1),
  instanceId: z.string().min(1).optional(),
  enabled: z.boolean(),
});

export const buildManualWorkSchema = z.object({
  regionId: z.string().min(1),
  buildingId: z.string().min(1),
  instanceId: z.string().min(1).optional(),
  enabled: z.boolean(),
});

export const buildCustomNameSchema = z.object({
  regionId: z.string().min(1),
  buildingId: z.string().min(1),
  instanceId: z.string().min(1).optional(),
  customName: z.union([z.string().max(80), z.null()]),
});

export type CountryBuildContentEntry = {
  id: string;
  costConstruction?: number | null;
  costDucats?: number | null;
  maxLevel?: number | null;
  upgradeCostConstruction?: number | null;
  upgradeCostDucats?: number | null;
};

export type CountryBuildGameSettings = {
  content: {
    buildings: CountryBuildContentEntry[];
  };
  economy: {
    demolitionCostConstructionPercent?: number | null;
  };
};

export type CountryBuildWorldState = {
  regionConstructionQueueByRegion: Record<string, RegionConstructionProject[]>;
  regionOwner: Record<string, string>;
  regionController: Record<string, string>;
  regionBuildingsByRegion: Record<string, BuildingInstance[]>;
  regionBuildingDucatsByRegion: Record<string, Record<string, number>>;
  resourcesByCountry: Record<string, ResourceTotals>;
};

export type CountryBuildMasks = {
  regionConstructionQueueByRegion: number;
  resourcesByCountry: number;
  regionBuildingsByRegion: number;
  regionBuildingDucatsByRegion: number;
};

export type CountryBuildRoutesDependencies = {
  routeAuth: RouteAuth;
  masks: CountryBuildMasks;
  createId: () => string;
  getTurnId: () => number;
  getWorldBase: () => CountryBuildWorldState;
  getGameSettings: () => CountryBuildGameSettings;
  getOrdersByTurn: (turnId: number) => Map<string, Order[]> | undefined;
  deleteOrdersForTurn: (turnId: number) => void;
  removeOrderFromTurnIndexes: (order: Order) => void;
  dropTurnOrderIndexes: (turnId: number) => void;
  ensureCountryInWorldBase: (countryId: string) => void;
  getBuildingMaxLevel: (building: CountryBuildContentEntry | undefined) => number;
  getBuildingUpgradeCosts: (
    building: CountryBuildContentEntry | undefined,
  ) => { costConstruction: number; costDucats: number };
  getBuildingConstructionTotalCostByLevel: (
    building: CountryBuildContentEntry | undefined,
    levelRaw: number,
  ) => number;
  cloneWorldBaseSectionSnapshot: (mask: number) => unknown;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: unknown) => void;
  addResourceExpense?: (input: {
    countryId: string;
    resourceId: ResourceId;
    amount: number;
    sourceType: ResourceFlowSourceType;
    sourceId: string;
    categoryId: string;
    labelKey: string;
    labelParams?: Record<string, string | number | boolean | null>;
  }) => void;
  flushResourceLedger?: () => void;
};

type BuildingInstanceSelection =
  | { ok: true; instances: BuildingInstance[]; matchingInstances: BuildingInstance[]; targetInstance: BuildingInstance }
  | { ok: false; status: 403 | 404; error: string };

export function registerCountryBuildRoutes(
  app: express.Express,
  deps: CountryBuildRoutesDependencies,
): void {
  app.post("/country/build/cancel", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;

    const parsed = buildCancelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const worldBase = deps.getWorldBase();
    const { regionId, queueId, orderId } = parsed.data;
    let canceledQueuedProject = false;
    let canceledPendingOrder = false;
    let previousWorldBase: unknown = null;

    if (regionId && queueId) {
      const queue = worldBase.regionConstructionQueueByRegion[regionId] ?? [];
      const nextQueue = queue.filter((project) => {
        const shouldRemove =
          project.queueId === queueId &&
          project.requestedByCountryId === auth.countryId &&
          ((worldBase.regionController[regionId] ?? worldBase.regionOwner[regionId]) ?? null) === auth.countryId;
        if (shouldRemove) {
          canceledQueuedProject = true;
        }
        return !shouldRemove;
      });
      if (canceledQueuedProject) {
        previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.regionConstructionQueueByRegion);
        worldBase.regionConstructionQueueByRegion[regionId] = nextQueue;
      }
    }

    if (orderId) {
      const turnId = deps.getTurnId();
      const turnOrders = deps.getOrdersByTurn(turnId);
      if (turnOrders) {
        for (const [playerId, list] of turnOrders.entries()) {
          const removed: Order[] = [];
          const filtered = list.filter((order) => {
            const shouldRemove =
              order.id === orderId && order.type === "BUILD" && order.countryId === auth.countryId;
            if (shouldRemove) {
              removed.push(order);
            }
            return !shouldRemove;
          });
          if (removed.length > 0) {
            canceledPendingOrder = true;
            for (const order of removed) {
              deps.removeOrderFromTurnIndexes(order);
            }
            if (filtered.length > 0) {
              turnOrders.set(playerId, filtered);
            } else {
              turnOrders.delete(playerId);
            }
          }
        }
        if (turnOrders.size === 0) {
          deps.deleteOrdersForTurn(turnId);
          deps.dropTurnOrderIndexes(turnId);
        }
      }
    }

    if (!canceledQueuedProject && !canceledPendingOrder) {
      return res.status(404).json({ error: "BUILD_CANCEL_NOT_FOUND" });
    }

    deps.savePersistentState();
    if (previousWorldBase) {
      deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    }

    return res.json({ ok: true, canceledQueuedProject, canceledPendingOrder });
  });

  app.post("/country/build/demolish", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;

    const parsed = buildDemolishSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const { regionId, buildingId, instanceId } = parsed.data;
    const worldBase = deps.getWorldBase();
    const selection = selectOwnedBuildingInstance(worldBase, auth.countryId, regionId, buildingId, instanceId);
    if (!selection.ok) {
      return res.status(selection.status).json({ error: selection.error });
    }

    const gameSettings = deps.getGameSettings();
    const building = gameSettings.content.buildings.find((entry) => entry.id === buildingId);
    if (!building) {
      return res.status(404).json({ error: "BUILDING_DEFINITION_NOT_FOUND" });
    }
    const targetLevel = Math.max(1, Math.floor(Number(selection.targetInstance.level ?? 1)));
    const costConstruction = deps.getBuildingConstructionTotalCostByLevel(building, targetLevel);
    const demolitionPercent = Math.max(
      0,
      Math.min(100, Math.floor(gameSettings.economy.demolitionCostConstructionPercent ?? 20)),
    );
    const demolitionCostConstruction = Math.ceil((costConstruction * demolitionPercent) / 100);

    deps.ensureCountryInWorldBase(auth.countryId);
    const countryResource = worldBase.resourcesByCountry[auth.countryId];
    if (!countryResource) {
      return res.status(500).json({ error: "NO_RESOURCES" });
    }
    if (countryResource.construction < demolitionCostConstruction) {
      return res.status(400).json({
        error: "INSUFFICIENT_CONSTRUCTION_POINTS",
        required: demolitionCostConstruction,
        available: countryResource.construction,
      });
    }

    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.resourcesByCountry |
        deps.masks.regionBuildingsByRegion |
        deps.masks.regionConstructionQueueByRegion |
        deps.masks.regionBuildingDucatsByRegion,
    );
    if (demolitionCostConstruction > 0 && deps.addResourceExpense) {
      deps.addResourceExpense({
        countryId: auth.countryId,
        resourceId: "construction",
        amount: demolitionCostConstruction,
        sourceType: "construction",
        sourceId: selection.targetInstance.instanceId,
        categoryId: "demolition",
        labelKey: "resourceLedger.source.construction.demolition",
        labelParams: { buildingId, regionId },
      });
      deps.flushResourceLedger?.();
    } else {
      countryResource.construction = Math.max(0, countryResource.construction - demolitionCostConstruction);
    }
    const previousTotalLevel = selection.matchingInstances.reduce(
      (sum, instance) => sum + Math.max(1, Math.floor(Number(instance.level ?? 1))),
      0,
    );
    const nextInstances = selection.instances.filter(
      (instance) => instance.instanceId !== selection.targetInstance.instanceId,
    );
    worldBase.regionBuildingsByRegion[regionId] = nextInstances;
    const queue = worldBase.regionConstructionQueueByRegion[regionId] ?? [];
    worldBase.regionConstructionQueueByRegion[regionId] = queue.filter(
      (project) =>
        !(
          (project.projectType ?? "build") === "upgrade" &&
          (project.targetInstanceId ?? "") === selection.targetInstance.instanceId
        ),
    );
    const buildingDucats = worldBase.regionBuildingDucatsByRegion[regionId] ?? {};
    const remainingByType = nextInstances.some((instance) => instance.buildingId === buildingId);
    if (!remainingByType && Object.prototype.hasOwnProperty.call(buildingDucats, buildingId)) {
      delete buildingDucats[buildingId];
      worldBase.regionBuildingDucatsByRegion[regionId] = buildingDucats;
    }

    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);

    return res.json({
      ok: true,
      regionId,
      buildingId,
      removedInstanceId: selection.targetInstance.instanceId,
      removedLevels: targetLevel,
      previousCount: previousTotalLevel,
      newCount: Math.max(0, previousTotalLevel - targetLevel),
      demolitionCostConstruction,
      demolitionPercent,
      constructionLeft: countryResource.construction,
    });
  });

  app.post("/country/build/upgrade-state", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;

    const parsed = buildUpgradeStateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const { regionId, buildingId, instanceId } = parsed.data;
    const worldBase = deps.getWorldBase();
    const selection = selectOwnedBuildingInstance(worldBase, auth.countryId, regionId, buildingId, instanceId);
    if (!selection.ok) {
      return res.status(selection.status).json({ error: selection.error });
    }

    const building = deps.getGameSettings().content.buildings.find((entry) => entry.id === buildingId);
    if (!building) {
      return res.status(404).json({ error: "BUILDING_DEFINITION_NOT_FOUND" });
    }

    const currentLevel = Math.max(1, Math.floor(Number(selection.targetInstance.level ?? 1)));
    const maxLevel = deps.getBuildingMaxLevel(building);
    if (currentLevel >= maxLevel) {
      return res.status(400).json({ error: "BUILDING_MAX_LEVEL_REACHED", maxLevel, currentLevel });
    }

    const queue = [...(worldBase.regionConstructionQueueByRegion[regionId] ?? [])];
    const alreadyQueued = queue.some(
      (project) =>
        (project.projectType ?? "build") === "upgrade" &&
        (project.targetInstanceId ?? "") === selection.targetInstance.instanceId,
    );
    if (alreadyQueued) {
      return res.status(409).json({ error: "BUILDING_UPGRADE_ALREADY_QUEUED" });
    }

    const costs = deps.getBuildingUpgradeCosts(building);
    deps.ensureCountryInWorldBase(auth.countryId);
    const countryResource = worldBase.resourcesByCountry[auth.countryId];
    if (!countryResource) {
      return res.status(500).json({ error: "NO_RESOURCES" });
    }
    if (countryResource.ducats < costs.costDucats) {
      return res.status(400).json({
        error: "INSUFFICIENT_DUCATS",
        required: costs.costDucats,
        available: countryResource.ducats,
      });
    }

    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.regionConstructionQueueByRegion);
    const queueId = deps.createId();
    queue.push({
      queueId,
      requestedByCountryId: auth.countryId,
      buildingId,
      owner: selection.targetInstance.owner,
      projectType: "upgrade",
      targetInstanceId: selection.targetInstance.instanceId,
      progressConstruction: 0,
      costConstruction: costs.costConstruction,
      costDucats: costs.costDucats,
      createdTurnId: deps.getTurnId(),
    });
    worldBase.regionConstructionQueueByRegion[regionId] = queue;

    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);

    return res.json({
      ok: true,
      regionId,
      buildingId,
      instanceId: selection.targetInstance.instanceId,
      queueId,
      currentLevel,
      targetLevel: Math.min(maxLevel, currentLevel + 1),
      maxLevel,
      upgradeCostConstruction: costs.costConstruction,
      upgradeCostDucats: costs.costDucats,
    });
  });

  app.post("/country/build/auto-upgrade-state", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;

    const parsed = buildAutoUpgradeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const { regionId, buildingId, instanceId, enabled } = parsed.data;
    return updateOwnedBuildingInstanceFlag(deps, auth.countryId, regionId, buildingId, instanceId, (instance) => ({
      ...instance,
      autoUpgradeEnabled: enabled,
    }), {
      ok: true,
      regionId,
      buildingId,
      autoUpgradeEnabled: enabled,
    }, res);
  });

  app.post("/country/build/subsidy-state", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;

    const parsed = buildSubsidiesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const { regionId, buildingId, instanceId, enabled } = parsed.data;
    return updateOwnedBuildingInstanceFlag(deps, auth.countryId, regionId, buildingId, instanceId, (instance) => ({
      ...instance,
      stateSubsidiesEnabled: enabled,
    }), {
      ok: true,
      regionId,
      buildingId,
      stateSubsidiesEnabled: enabled,
    }, res);
  });

  app.post("/country/build/manual-work-state", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;

    const parsed = buildManualWorkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const { regionId, buildingId, instanceId, enabled } = parsed.data;
    return updateOwnedBuildingInstanceFlag(deps, auth.countryId, regionId, buildingId, instanceId, (instance) => ({
      ...instance,
      manualWorkEnabled: enabled,
      isInactive: enabled ? (instance.inactiveReason === "Отключено вручную" ? false : instance.isInactive) : true,
      inactiveReason: enabled
        ? (instance.inactiveReason === "Отключено вручную" ? null : instance.inactiveReason)
        : "Отключено вручную",
      lastProductivity: enabled ? instance.lastProductivity : 0,
    }), {
      ok: true,
      regionId,
      buildingId,
      manualWorkEnabled: enabled,
    }, res);
  });

  app.post("/country/build/custom-name", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;

    const parsed = buildCustomNameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const { regionId, buildingId, instanceId, customName } = parsed.data;
    const worldBase = deps.getWorldBase();
    const selection = selectOwnedBuildingInstance(worldBase, auth.countryId, regionId, buildingId, instanceId);
    if (!selection.ok) {
      return res.status(selection.status).json({ error: selection.error });
    }

    const normalizedName = typeof customName === "string" ? customName.trim().slice(0, 80) : "";
    const nextName = normalizedName.length > 0 ? normalizedName : null;
    if (nextName) {
      const nextNameLower = nextName.toLocaleLowerCase("ru-RU");
      const duplicate = selection.instances.some((instance) => {
        if (instance.instanceId === selection.targetInstance.instanceId) return false;
        const candidate = typeof instance.customName === "string" ? instance.customName.trim() : "";
        return candidate.length > 0 && candidate.toLocaleLowerCase("ru-RU") === nextNameLower;
      });
      if (duplicate) {
        return res.status(409).json({ error: "BUILDING_CUSTOM_NAME_ALREADY_USED" });
      }
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.regionBuildingsByRegion);
    worldBase.regionBuildingsByRegion[regionId] = selection.instances.map((instance) =>
      instance.instanceId === selection.targetInstance.instanceId ? { ...instance, customName: nextName } : instance,
    );

    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);

    return res.json({
      ok: true,
      regionId,
      buildingId,
      instanceId: selection.targetInstance.instanceId,
      customName: nextName,
    });
  });
}

function selectOwnedBuildingInstance(
  worldBase: CountryBuildWorldState,
  countryId: string,
  regionId: string,
  buildingId: string,
  instanceId: string | undefined,
): BuildingInstanceSelection {
  const provinceOwnerId = (worldBase.regionController[regionId] ?? worldBase.regionOwner[regionId]) ?? null;
  if (!provinceOwnerId || provinceOwnerId !== countryId) {
    return { ok: false, status: 403, error: "NOT_REGION_CONTROLLER" };
  }

  const instances = [...(worldBase.regionBuildingsByRegion[regionId] ?? [])];
  const matchingInstances = instances.filter((instance) => instance.buildingId === buildingId);
  if (matchingInstances.length <= 0) {
    return { ok: false, status: 404, error: "BUILDING_NOT_FOUND" };
  }
  const targetInstance =
    typeof instanceId === "string" && instanceId.trim().length > 0
      ? matchingInstances.find((instance) => instance.instanceId === instanceId.trim())
      : matchingInstances[0];
  if (!targetInstance) {
    return { ok: false, status: 404, error: "BUILDING_INSTANCE_NOT_FOUND" };
  }

  return { ok: true, instances, matchingInstances, targetInstance };
}

function updateOwnedBuildingInstanceFlag(
  deps: CountryBuildRoutesDependencies,
  countryId: string,
  regionId: string,
  buildingId: string,
  instanceId: string | undefined,
  updateInstance: (instance: BuildingInstance) => BuildingInstance,
  responseBase: Record<string, unknown>,
  res: express.Response,
): express.Response {
  const worldBase = deps.getWorldBase();
  const selection = selectOwnedBuildingInstance(worldBase, countryId, regionId, buildingId, instanceId);
  if (!selection.ok) {
    return res.status(selection.status).json({ error: selection.error });
  }

  const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.regionBuildingsByRegion);
  worldBase.regionBuildingsByRegion[regionId] = selection.instances.map((instance) =>
    instance.instanceId === selection.targetInstance.instanceId ? updateInstance(instance) : instance,
  );

  deps.savePersistentState();
  deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);

  return res.json({
    ...responseBase,
    instanceId: selection.targetInstance.instanceId,
  });
}
