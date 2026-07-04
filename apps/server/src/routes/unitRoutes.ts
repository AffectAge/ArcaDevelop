import type express from "express";
import type { HexId, ResourceId, UnitTrainingQueueItem, UnitTypeDefinition, WorldBase } from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";
import type { ResourceLedgerEntryInput } from "../runtime/resourceLedgerRuntime";
import { findSpawnableTrainingHex } from "../mechanics/mapUnitMechanics";

export type UnitRouteMasks = {
  unitEquipmentState: number;
  resourcesByCountry: number;
  resourceLedgerByTurn: number;
};

export type UnitRoutesDependencies = {
  routeAuth: RouteAuth;
  masks: UnitRouteMasks;
  createId: () => string;
  getTurnId: () => number;
  getWorldBase: () => WorldBase;
  getUnitTypes: () => readonly UnitTypeDefinition[];
  getHexRegionId: (hexId: string) => string | null;
  getHex: (hexId: string) => { id: string; passable?: boolean; waterKind?: string | null } | null;
  cloneWorldBaseSectionSnapshot: (mask: number) => unknown;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: unknown) => void;
  savePersistentState: () => void;
  addResourceLedgerExpense: (input: ResourceLedgerEntryInput) => unknown;
  flushResourceLedger: () => void;
};

const trainUnitInputSchema = z.object({
  unitTypeId: z.string().trim().min(1).max(180),
  hexId: z.string().trim().regex(/^hex:-?\d+:-?\d+$/).max(120).optional(),
});

export function registerUnitRoutes(app: express.Express, deps: UnitRoutesDependencies): void {
  app.get("/units/overview", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const worldBase = deps.getWorldBase();
    const units = Object.values(worldBase.unitsById ?? {}).filter((unit) => unit.countryId === auth.countryId);
    return res.json({
      unitTypes: deps.getUnitTypes(),
      units,
      trainingQueue: worldBase.unitTrainingQueueByCountry?.[auth.countryId] ?? [],
    });
  });

  app.post("/units/train", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = trainUnitInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: "UNIT_TRAIN_INVALID_PAYLOAD" });
    const unitType = deps.getUnitTypes().find((candidate) => candidate.id === parsed.data.unitTypeId);
    if (!unitType) return res.status(404).json({ error: "UNIT_TYPE_NOT_FOUND" });
    const worldBase = deps.getWorldBase();
    worldBase.unitsById ??= {};
    worldBase.unitTrainingQueueByCountry ??= {};
    const candidateHexIds = resolveTrainingCandidateHexIds(worldBase, auth.countryId, parsed.data.hexId);
    const spawnHexId = findSpawnableTrainingHex({
      hexIds: candidateHexIds,
      countryId: auth.countryId,
      worldBase,
      unitTypes: deps.getUnitTypes(),
      unitType,
      getHex: deps.getHex,
    });
    if (!spawnHexId) return res.status(400).json({ error: "UNIT_TRAIN_NO_VALID_DEPLOYMENT_HEX" });
    const regionId = deps.getHexRegionId(spawnHexId);
    if (!regionId) return res.status(400).json({ error: "UNIT_TRAIN_HEX_REGION_NOT_FOUND" });
    const controller = worldBase.regionController[regionId] ?? worldBase.regionOwner[regionId] ?? null;
    if (controller !== auth.countryId) return res.status(403).json({ error: "UNIT_TRAIN_REGION_NOT_CONTROLLED" });
    const costCheck = spendTrainingCost({
      deps,
      worldBase,
      countryId: auth.countryId,
      unitType,
    });
    if (!costCheck.ok) return res.status(400).json({ error: costCheck.error });

    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.unitEquipmentState | deps.masks.resourcesByCountry | deps.masks.resourceLedgerByTurn,
    );
    const queue = worldBase.unitTrainingQueueByCountry[auth.countryId] ?? [];
    const turnsTotal = Math.max(1, Math.ceil((unitType.productionCost.construction ?? 0) / 25) || 1);
    const item: UnitTrainingQueueItem = {
      id: `unit-training:${deps.createId()}`,
      countryId: auth.countryId,
      unitTypeId: unitType.id,
      regionId,
      hexId: spawnHexId,
      progress: 0,
      turnsTotal,
      turnsRemaining: turnsTotal,
      cost: unitType.productionCost,
      createdTurnId: deps.getTurnId(),
    };
    worldBase.unitTrainingQueueByCountry[auth.countryId] = [...queue, item];
    deps.flushResourceLedger();
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.status(201).json({ item });
  });

  app.delete("/units/training/:queueId", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const worldBase = deps.getWorldBase();
    worldBase.unitTrainingQueueByCountry ??= {};
    const queue = worldBase.unitTrainingQueueByCountry[auth.countryId] ?? [];
    const next = queue.filter((item) => item.id !== req.params.queueId);
    if (next.length === queue.length) return res.status(404).json({ error: "UNIT_TRAINING_QUEUE_ITEM_NOT_FOUND" });
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.unitEquipmentState);
    worldBase.unitTrainingQueueByCountry[auth.countryId] = next;
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json({ ok: true });
  });

  app.delete("/units/:unitId", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const worldBase = deps.getWorldBase();
    worldBase.unitsById ??= {};
    const unit = worldBase.unitsById[req.params.unitId];
    if (!unit || unit.countryId !== auth.countryId) return res.status(404).json({ error: "UNIT_NOT_FOUND" });
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.unitEquipmentState);
    delete worldBase.unitsById[unit.id];
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json({ ok: true });
  });
}

function resolveTrainingCandidateHexIds(worldBase: WorldBase, countryId: string, requestedHexId?: string): HexId[] {
  if (requestedHexId) return [requestedHexId as HexId];
  const cityHexIds = Object.values(worldBase.cityMarkersById ?? {})
    .filter((city) => city.countryId === countryId)
    .map((city) => city.targetHexId as HexId);
  const buildingHexIds = Object.values(worldBase.regionBuildingsByRegion ?? {})
    .flat()
    .filter((building) => building.owner.type === "state" && building.owner.countryId === countryId)
    .map((building) => building.targetHexId as HexId);
  return [...new Set([...cityHexIds, ...buildingHexIds])];
}

function spendTrainingCost(params: {
  deps: UnitRoutesDependencies;
  worldBase: WorldBase;
  countryId: string;
  unitType: UnitTypeDefinition;
}): { ok: true } | { ok: false; error: string } {
  const totals = params.worldBase.resourcesByCountry[params.countryId];
  const costs: Array<{ resourceId: ResourceId; amount: number }> = [
    { resourceId: "ducats" as ResourceId, amount: params.unitType.productionCost.ducats ?? 0 },
    { resourceId: "construction" as ResourceId, amount: params.unitType.productionCost.construction ?? 0 },
    { resourceId: "colonization" as ResourceId, amount: params.unitType.productionCost.colonization ?? 0 },
  ].filter((cost) => cost.amount > 0);
  for (const cost of costs) {
    if ((totals?.[cost.resourceId] ?? 0) < cost.amount) return { ok: false, error: "UNIT_TRAIN_INSUFFICIENT_RESOURCES" };
  }
  for (const cost of costs) {
    params.deps.addResourceLedgerExpense({
      countryId: params.countryId,
      resourceId: cost.resourceId,
      amount: cost.amount,
      sourceType: "system",
      sourceId: params.unitType.id,
      categoryId: "unit_training",
      labelKey: "unit.training.cost",
      labelParams: { unitTypeId: params.unitType.id },
    });
  }
  return { ok: true };
}
