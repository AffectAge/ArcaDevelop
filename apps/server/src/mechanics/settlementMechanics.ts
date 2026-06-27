import type {
  CivilianUnit,
  CityMarker,
  EventLogEntry,
  FoundCityOrder,
  Order,
  RegionPopulation,
  ResourceFlowSourceType,
  ResourceId,
  SettlementProject,
  WorldBase,
} from "@arcanorum/shared";
import { transferStateOwnedBuildingsToController } from "./buildingMechanics";
import type { RegionColonizationConfig } from "./colonizationMechanics";

export type SettlementLedgerFlowInput = {
  countryId: string;
  resourceId: ResourceId;
  amount: number;
  sourceType: ResourceFlowSourceType;
  sourceId: string;
  categoryId: string;
  labelKey: string;
  labelParams?: Record<string, string | number | boolean | null>;
  metadata?: Record<string, string | number | boolean | null>;
};

export type SettlementRejectedOrder = {
  playerId: string;
  reason: string;
  tempOrderId?: string;
};

export type FoundCityOrderResolution = {
  accepted: boolean;
  rejectedOrder: SettlementRejectedOrder | null;
  projectId?: string;
};

export type SettlementCompletion = {
  projectId: string;
  cityMarkerId: string;
  regionId: string;
  countryId: string;
};

export type SettlementTurnResult = {
  completed: SettlementCompletion[];
};

export type SettlementWorldState = Pick<
  WorldBase,
  | "civilianUnitsById"
  | "settlementProjectsById"
  | "cityMarkersById"
  | "resourcesByCountry"
  | "regionOwner"
  | "regionController"
  | "regionPopulationByRegion"
  | "regionBuildingsByRegion"
>;

export type HexRegionReader = (hexId: string) => string | null;

export type CreateSettlementId = () => string;

export function resolveFoundCityOrder(params: {
  order: Order;
  playerId: string;
  worldBase: SettlementWorldState;
  getHexRegionId: HexRegionReader;
  getRegionColonizationConfig: (regionId: string) => RegionColonizationConfig;
  createId: CreateSettlementId;
  turnId: number;
}): FoundCityOrderResolution {
  if (params.order.type !== "FOUND_CITY") {
    return {
      accepted: false,
      rejectedOrder: { playerId: params.playerId, reason: "INVALID_ORDER_TYPE", tempOrderId: params.order.id },
    };
  }
  const validation = validateFoundCityOrder({
    order: params.order,
    worldBase: params.worldBase,
    getHexRegionId: params.getHexRegionId,
    getRegionColonizationConfig: params.getRegionColonizationConfig,
  });
  if (!validation.ok) {
    return {
      accepted: false,
      rejectedOrder: { playerId: params.playerId, reason: validation.reason, tempOrderId: params.order.id },
    };
  }

  const projectId = `settlement:${params.createId()}`;
  const unit = validation.unit;
  const cityName = normalizeCityName(params.order.name);
  delete params.worldBase.civilianUnitsById[unit.id];
  params.worldBase.settlementProjectsById[projectId] = {
    id: projectId,
    name: cityName,
    countryId: params.order.countryId,
    regionId: params.order.regionId,
    targetHexId: params.order.targetHexId,
    cultureId: parseCultureId(params.order.payload, params.order.countryId),
    progressColonization: 0,
    costColonization: validation.regionConfig.cost,
    state: "active",
    visualState: "underConstruction",
    createdTurnId: params.turnId,
    completedTurnId: null,
    stallReasonCode: null,
  };
  return { accepted: true, rejectedOrder: null, projectId };
}

export function validateFoundCityOrder(params: {
  order: FoundCityOrder;
  worldBase: SettlementWorldState;
  getHexRegionId: HexRegionReader;
  getRegionColonizationConfig: (regionId: string) => RegionColonizationConfig;
}):
  | { ok: true; unit: CivilianUnit; regionConfig: RegionColonizationConfig }
  | { ok: false; reason: string } {
  const cityNameValidation = validateCityName(params.order.name);
  if (!cityNameValidation.ok) {
    return { ok: false, reason: cityNameValidation.reason };
  }
  const unit = params.worldBase.civilianUnitsById[params.order.civilianUnitId];
  if (!unit || unit.countryId !== params.order.countryId || unit.type !== "colonizer") {
    return { ok: false, reason: "COLONIZER_NOT_FOUND" };
  }
  if (unit.status === "captured") {
    return { ok: false, reason: "COLONIZER_CAPTURED" };
  }
  if (unit.hexId !== params.order.targetHexId) {
    return { ok: false, reason: "COLONIZER_NOT_ON_TARGET_HEX" };
  }
  const regionId = params.getHexRegionId(params.order.targetHexId);
  if (!regionId || regionId !== params.order.regionId) {
    return { ok: false, reason: "FOUND_CITY_HEX_REGION_MISMATCH" };
  }
  if (params.worldBase.regionOwner[params.order.regionId] || params.worldBase.regionController[params.order.regionId]) {
    return { ok: false, reason: "REGION_NOT_NEUTRAL" };
  }
  if (hasSettlementProjectInRegion(params.worldBase, params.order.regionId)) {
    return { ok: false, reason: "SETTLEMENT_PROJECT_EXISTS" };
  }
  const regionConfig = params.getRegionColonizationConfig(params.order.regionId);
  if (regionConfig.disabled) {
    return { ok: false, reason: "COLONIZATION_DISABLED" };
  }
  return { ok: true, unit, regionConfig };
}

function validateCityName(value: unknown): { ok: true } | { ok: false; reason: string } {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, reason: "FOUND_CITY_NAME_REQUIRED" };
  }
  if (value.trim().length > 32) return { ok: false, reason: "FOUND_CITY_NAME_TOO_LONG" };
  return { ok: true };
}

export function resolveSettlementProjectsTurn(params: {
  worldBase: SettlementWorldState;
  turnId: number;
  defaultColonizationPointsPerTurn: number;
  settlementPopulationOnCapture: number;
  buildSettlementPopulation: (regionId: string, countryId: string, total: number) => RegionPopulation;
  createId: CreateSettlementId;
  addExpense?: (input: SettlementLedgerFlowInput) => void;
}): SettlementTurnResult {
  const activeProjects = Object.values(params.worldBase.settlementProjectsById)
    .filter((project) => project.state === "active" || project.state === "stalled")
    .sort((left, right) => left.createdTurnId - right.createdTurnId || left.id.localeCompare(right.id, "en"));
  const projectsByCountry = new Map<string, SettlementProject[]>();
  for (const project of activeProjects) {
    if (params.worldBase.regionOwner[project.regionId]) {
      project.state = "canceled";
      project.stallReasonCode = "REGION_NOT_NEUTRAL";
      continue;
    }
    const list = projectsByCountry.get(project.countryId) ?? [];
    list.push(project);
    projectsByCountry.set(project.countryId, list);
  }

  const completed: SettlementCompletion[] = [];
  for (const [countryId, projects] of projectsByCountry.entries()) {
    const resource = params.worldBase.resourcesByCountry[countryId];
    let remaining = Math.max(0, resource?.colonization ?? params.defaultColonizationPointsPerTurn);
    if (remaining <= 0) {
      for (const project of projects) {
        project.state = "stalled";
        project.stallReasonCode = "NO_COLONIZATION_POINTS";
      }
      continue;
    }

    for (const project of projects) {
      const missing = Math.max(0, project.costColonization - project.progressColonization);
      if (missing <= 0) {
        completed.push(completeSettlementProject({ ...params, project }));
        continue;
      }
      const applied = Math.min(remaining, missing);
      if (applied <= 0) {
        project.state = "stalled";
        project.stallReasonCode = "NO_COLONIZATION_POINTS";
        continue;
      }
      project.progressColonization += applied;
      project.state = "active";
      project.stallReasonCode = null;
      remaining -= applied;
      params.addExpense?.({
        countryId,
        resourceId: "colonization",
        amount: applied,
        sourceType: "colonization",
        sourceId: project.id,
        categoryId: "colonization",
        labelKey: "resourceLedger.source.settlement.progress",
        labelParams: { regionId: project.regionId },
        metadata: { projectId: project.id, regionId: project.regionId, targetHexId: project.targetHexId },
      });
      if (project.progressColonization >= project.costColonization) {
        completed.push(completeSettlementProject({ ...params, project }));
      }
    }
  }
  return { completed };
}

export function makeSettlementCompletionNews(params: {
  completion: SettlementCompletion;
  turn: number;
  makeId: () => string;
}): EventLogEntry {
  return {
    id: params.makeId(),
    turn: params.turn,
    category: "colonization",
    title: "Основан город",
    message: `Регион ${params.completion.regionId} закреплен за ${params.completion.countryId}`,
    countryId: params.completion.countryId,
    priority: "medium",
    visibility: "public",
    timestamp: new Date().toISOString(),
  };
}

function completeSettlementProject(params: {
  worldBase: SettlementWorldState;
  turnId: number;
  settlementPopulationOnCapture: number;
  buildSettlementPopulation: (regionId: string, countryId: string, total: number) => RegionPopulation;
  createId: CreateSettlementId;
  project: SettlementProject;
}): SettlementCompletion {
  const { project } = params;
  project.state = "completed";
  project.visualState = "working";
  project.completedTurnId = params.turnId;
  params.worldBase.regionOwner[project.regionId] = project.countryId;
  params.worldBase.regionController[project.regionId] = project.countryId;
  transferStateOwnedBuildingsToController({
    worldBase: params.worldBase,
    regionId: project.regionId,
    controllerCountryId: project.countryId,
  });
  const markerId = `city:${params.createId()}`;
  const marker: CityMarker = {
    id: markerId,
    name: project.name,
    countryId: project.countryId,
    ownerCountryId: project.countryId,
    regionId: project.regionId,
    targetHexId: project.targetHexId,
    cultureId: project.cultureId,
    visualState: "working",
    createdTurnId: params.turnId,
  };
  params.worldBase.cityMarkersById[marker.id] = marker;
  const total = Math.max(0, Math.floor(params.settlementPopulationOnCapture));
  const existingPopulation = params.worldBase.regionPopulationByRegion[project.regionId];
  const existingTotal = (existingPopulation?.pops ?? []).reduce((sum, pop) => sum + Math.max(0, Number(pop.size ?? 0)), 0);
  if (total > 0 && existingTotal <= 0) {
    params.worldBase.regionPopulationByRegion[project.regionId] = params.buildSettlementPopulation(
      project.regionId,
      project.countryId,
      total,
    );
  }
  delete params.worldBase.settlementProjectsById[project.id];
  return { projectId: project.id, cityMarkerId: marker.id, regionId: project.regionId, countryId: project.countryId };
}

function hasSettlementProjectInRegion(worldBase: SettlementWorldState, regionId: string): boolean {
  return Object.values(worldBase.settlementProjectsById).some(
    (project) => project.regionId === regionId && project.state !== "completed" && project.state !== "canceled",
  );
}

function parseCultureId(payload: Record<string, unknown>, fallbackCountryId: string): string {
  const raw = payload.cultureId;
  return typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 120) : `culture:${fallbackCountryId}`;
}

export function normalizeCityName(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 32 ? trimmed : "";
}
