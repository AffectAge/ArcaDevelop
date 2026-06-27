import type { CivilianUnit, CivilianUnitQueueItem, HexId, ResourceId, ResourceTotals, WorldBase } from "@arcanorum/shared";

export type CivilianUnitLedgerFlowInput = {
  countryId: string;
  resourceId: ResourceId;
  amount: number;
  sourceType: "unit";
  sourceId: string;
  categoryId: string;
  labelKey: string;
  labelParams?: Record<string, string | number | boolean | null>;
  metadata?: Record<string, string | number | boolean | null>;
};

export type CivilianUnitWorldState = Pick<
  WorldBase,
  "civilianUnitsById" | "civilianUnitQueueByCountry" | "resourcesByCountry" | "regionController" | "regionOwner"
>;

export type CivilianUnitQueueConfig = {
  colonizerTurns: number;
  colonizerCostColonization: number;
  colonizerCostDucats: number;
  colonizerMovementPoints: number;
};

export function queueColonizerUnit(params: {
  worldBase: CivilianUnitWorldState;
  countryId: string;
  hexId: HexId;
  getHexRegionId: (hexId: string) => string | null;
  config: CivilianUnitQueueConfig;
  createId: () => string;
  turnId: number;
}): { ok: true; item: CivilianUnitQueueItem } | { ok: false; error: string } {
  const regionId = params.getHexRegionId(params.hexId);
  if (!regionId) return { ok: false, error: "HEX_NOT_FOUND" };
  const controller = params.worldBase.regionController[regionId] ?? params.worldBase.regionOwner[regionId] ?? null;
  if (controller !== params.countryId) return { ok: false, error: "HEX_NOT_CONTROLLED" };
  if (hasCivilianQueueOnHex(params.worldBase, params.countryId, params.hexId)) {
    return { ok: false, error: "CIVILIAN_UNIT_QUEUE_HEX_OCCUPIED" };
  }
  if (hasCivilianUnitOnHex(params.worldBase, params.hexId)) {
    return { ok: false, error: "CIVILIAN_UNIT_HEX_OCCUPIED" };
  }
  const cost = normalizeColonizerCost(params.config);
  const resources = params.worldBase.resourcesByCountry[params.countryId] ?? emptyResources();
  if (resources.colonization < cost.colonization) return { ok: false, error: "INSUFFICIENT_COLONIZATION_POINTS" };
  if (resources.ducats < cost.ducats) return { ok: false, error: "INSUFFICIENT_DUCATS" };
  const turnsTotal = Math.max(1, Math.floor(params.config.colonizerTurns || 1));
  const item: CivilianUnitQueueItem = {
    id: params.createId(),
    countryId: params.countryId,
    type: "colonizer",
    hexId: params.hexId,
    progress: 0,
    turnsTotal,
    turnsRemaining: turnsTotal,
    cost,
    createdTurnId: params.turnId,
  };
  params.worldBase.civilianUnitQueueByCountry[params.countryId] = [
    ...(params.worldBase.civilianUnitQueueByCountry[params.countryId] ?? []),
    item,
  ];
  return { ok: true, item };
}

export function advanceCivilianUnitQueueTurn(params: {
  worldBase: Pick<WorldBase, "civilianUnitsById" | "civilianUnitQueueByCountry">;
  createId: () => string;
  turnId: number;
  colonizerMovementPoints: number;
}): { createdUnits: CivilianUnit[] } {
  const createdUnits: CivilianUnit[] = [];
  for (const [countryId, queue] of Object.entries(params.worldBase.civilianUnitQueueByCountry)) {
    const remaining: CivilianUnitQueueItem[] = [];
    for (const item of queue ?? []) {
      const nextProgress = Math.min(1, round3(Number(item.progress ?? 0) + 1 / Math.max(1, item.turnsTotal)));
      const nextTurnsRemaining = Math.max(0, item.turnsRemaining - 1);
      if (nextTurnsRemaining <= 0 || nextProgress >= 1) {
        const movementPoints = Math.max(1, Math.floor(params.colonizerMovementPoints || 2));
        const unit: CivilianUnit = {
          id: `civilian:${params.createId()}`,
          countryId,
          type: item.type,
          hexId: item.hexId,
          status: "idle",
          movementPoints,
          maxMovementPoints: movementPoints,
          path: [],
          targetHexId: null,
          createdTurnId: params.turnId,
          lastMovedTurnId: null,
        };
        params.worldBase.civilianUnitsById[unit.id] = unit;
        createdUnits.push(unit);
      } else {
        remaining.push({ ...item, progress: nextProgress, turnsRemaining: nextTurnsRemaining });
      }
    }
    params.worldBase.civilianUnitQueueByCountry[countryId] = remaining;
  }
  return { createdUnits };
}

export function makeCivilianUnitLedgerFlows(params: {
  countryId: string;
  queueId: string;
  cost: { colonization: number; ducats: number };
}): CivilianUnitLedgerFlowInput[] {
  const flows: CivilianUnitLedgerFlowInput[] = [];
  if (params.cost.colonization > 0) {
    flows.push({
      countryId: params.countryId,
      resourceId: "colonization",
      amount: params.cost.colonization,
      sourceType: "unit",
      sourceId: params.queueId,
      categoryId: "colonization",
      labelKey: "resourceLedger.source.unit.colonizer",
    });
  }
  if (params.cost.ducats > 0) {
    flows.push({
      countryId: params.countryId,
      resourceId: "ducats",
      amount: params.cost.ducats,
      sourceType: "unit",
      sourceId: params.queueId,
      categoryId: "colonization",
      labelKey: "resourceLedger.source.unit.colonizer",
    });
  }
  return flows;
}

function hasCivilianQueueOnHex(worldBase: CivilianUnitWorldState, countryId: string, hexId: HexId): boolean {
  return (worldBase.civilianUnitQueueByCountry[countryId] ?? []).some((item) => item.hexId === hexId);
}

function hasCivilianUnitOnHex(worldBase: CivilianUnitWorldState, hexId: HexId): boolean {
  return Object.values(worldBase.civilianUnitsById).some((unit) => unit.hexId === hexId && unit.status !== "captured");
}

function normalizeColonizerCost(config: CivilianUnitQueueConfig): { colonization: number; ducats: number } {
  return {
    colonization: Math.max(0, Math.floor(config.colonizerCostColonization || 0)),
    ducats: Math.max(0, Math.floor(config.colonizerCostDucats || 0)),
  };
}

function emptyResources(): ResourceTotals {
  return { culture: 0, science: 0, religion: 0, colonization: 0, construction: 0, ducats: 0, gold: 0 };
}

function round3(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 1000) / 1000;
}
