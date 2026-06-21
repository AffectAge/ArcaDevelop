import type {
  EventResolvedScope,
  EventTriggerDefinition,
  EventTriggerExplanation,
  ModifierCondition,
  ResourceTotals,
  WorldBase,
} from "@arcanorum/shared";

export type EventTriggerEvaluationParams = {
  trigger: EventTriggerDefinition | ModifierCondition[] | null | undefined;
  countryId: string;
  worldBase: Pick<
    WorldBase,
    | "resourcesByCountry"
    | "resourceLedgerByTurn"
    | "regionOwner"
    | "regionController"
    | "regionPopulationByRegion"
    | "regionBuildingsByRegion"
    | "colonyProgressByRegion"
    | "regionResourceDepositsByRegion"
    | "regionColonizationByRegion"
  >;
  scopes?: Record<string, EventResolvedScope>;
  conditionsMatchCountry?: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
  countryHasModifier?: (countryId: string, modifierId: string) => boolean;
};

export type EventTriggerEvaluation = {
  passed: boolean;
  explanations: EventTriggerExplanation[];
};

const RESOURCE_KEYS = new Set<keyof ResourceTotals>([
  "culture",
  "science",
  "religion",
  "colonization",
  "construction",
  "ducats",
  "gold",
]);

export function evaluateEventTrigger(params: EventTriggerEvaluationParams): EventTriggerEvaluation {
  const trigger = params.trigger;
  if (!trigger) return makePassed("always", "event.trigger.always", true);
  if (Array.isArray(trigger)) {
    const passed = params.conditionsMatchCountry ? params.conditionsMatchCountry(trigger, params.countryId) : trigger.length === 0;
    return {
      passed,
      explanations: [
        {
          triggerId: "legacy_conditions",
          passed,
          labelKey: "event.trigger.legacyConditions",
        },
      ],
    };
  }
  return evaluateOne(params, trigger);
}

function evaluateOne(params: EventTriggerEvaluationParams, trigger: EventTriggerDefinition): EventTriggerEvaluation {
  if ("all" in trigger) {
    const evaluations = trigger.all.map((child) => evaluateOne(params, child));
    return {
      passed: evaluations.every((item) => item.passed),
      explanations: evaluations.flatMap((item) => item.explanations),
    };
  }
  if ("any" in trigger) {
    const evaluations = trigger.any.map((child) => evaluateOne(params, child));
    return {
      passed: evaluations.some((item) => item.passed),
      explanations: evaluations.flatMap((item) => item.explanations),
    };
  }
  if ("not" in trigger) {
    const evaluation = evaluateOne(params, trigger.not);
    return {
      passed: !evaluation.passed,
      explanations: evaluation.explanations.map((item) => ({
        ...item,
        triggerId: `not.${item.triggerId}`,
        passed: !item.passed,
      })),
    };
  }

  switch (trigger.type) {
    case "always":
      return makePassed("always", "event.trigger.always", trigger.invert !== true);
    case "country_is": {
      const passed = params.countryId === (trigger.targetId ?? "");
      return explain("country_is", trigger.invert === true ? !passed : passed, params.countryId, trigger.targetId ?? null, "event.trigger.countryIs", {
        kind: "country",
        id: params.countryId,
      });
    }
    case "law_active":
    case "technology_researched":
    case "has_building": {
      const passed = params.conditionsMatchCountry
        ? params.conditionsMatchCountry([{ type: trigger.type, targetId: trigger.targetId, invert: trigger.invert }], params.countryId)
        : false;
      return explain(trigger.type, passed, trigger.targetId ?? null, true, "event.trigger.legacyConditions");
    }
    case "country_has_law":
    case "country_lacks_law":
    case "country_has_technology":
    case "country_lacks_technology": {
      const conditionType = trigger.type === "country_has_law" || trigger.type === "country_lacks_law" ? "law_active" : "technology_researched";
      const wantsMissing = trigger.type === "country_lacks_law" || trigger.type === "country_lacks_technology";
      const passed = params.conditionsMatchCountry
        ? params.conditionsMatchCountry([{ type: conditionType, targetId: trigger.targetId, invert: wantsMissing !== (trigger.invert === true) }], params.countryId)
        : false;
      return explain(trigger.type, passed, trigger.targetId ?? null, true, "event.trigger.legacyConditions");
    }
    case "country_has_modifier": {
      const active = Boolean(trigger.targetId && params.countryHasModifier?.(params.countryId, trigger.targetId));
      const passed = trigger.invert === true ? !active : active;
      return explain("country_has_modifier", passed, trigger.targetId ?? null, true, "event.trigger.countryHasModifier", {
        kind: "country",
        id: params.countryId,
      });
    }
    case "country_resource_above":
    case "country_resource_below": {
      if (!RESOURCE_KEYS.has(trigger.resource)) return makePassed(trigger.type, "event.trigger.invalid", false);
      const value = params.worldBase.resourcesByCountry[params.countryId]?.[trigger.resource] ?? 0;
      const passed = trigger.type === "country_resource_above" ? value > trigger.value : value < trigger.value;
      return explain(trigger.type, passed, value, trigger.value, trigger.type === "country_resource_above" ? "event.trigger.countryResourceAbove" : "event.trigger.countryResourceBelow", {
        kind: "country",
        id: params.countryId,
      });
    }
    case "treasury_below": {
      const value = params.worldBase.resourcesByCountry[params.countryId]?.ducats ?? 0;
      return explain("treasury_below", value < trigger.value, value, trigger.value, "event.trigger.countryResourceBelow", {
        kind: "country",
        id: params.countryId,
      });
    }
    case "resource_flow_negative": {
      const value = getLatestCountryResourceFlowNet(params.worldBase, params.countryId, trigger.resource);
      return explain("resource_flow_negative", value < 0, value, 0, "event.trigger.resourceFlowNegative", {
        kind: "country",
        id: params.countryId,
      });
    }
    case "country_controls_region_count_above":
    case "country_controls_region_count_below": {
      const value = countControlledRegions(params.worldBase, params.countryId);
      const passed = trigger.type === "country_controls_region_count_above" ? value > trigger.value : value < trigger.value;
      return explain(trigger.type, passed, value, trigger.value, trigger.type === "country_controls_region_count_above" ? "event.trigger.countryControlsRegionCountAbove" : "event.trigger.countryControlsRegionCountBelow", {
        kind: "country",
        id: params.countryId,
      });
    }
    case "controls_foreign_region": {
      const regionId = findControlledForeignRegion(params.worldBase, params.countryId);
      return explain("controls_foreign_region", regionId != null, regionId, true, "event.trigger.controlsForeignRegion", {
        kind: "country",
        id: params.countryId,
      });
    }
    case "region_owner_is": {
      const region = params.scopes?.region;
      const value = region ? params.worldBase.regionOwner[region.id] ?? null : null;
      const threshold = trigger.targetId ?? params.countryId;
      return explain("region_owner_is", value === threshold, value, threshold, "event.trigger.regionOwnerIs", region ?? null);
    }
    case "region_controller_is": {
      const region = params.scopes?.region;
      const value = region ? params.worldBase.regionController[region.id] ?? params.worldBase.regionOwner[region.id] ?? null : null;
      const threshold = trigger.targetId ?? params.countryId;
      return explain("region_controller_is", value === threshold, value, threshold, "event.trigger.regionControllerIs", region ?? null);
    }
    case "region_is_colonizable": {
      const region = params.scopes?.region;
      const value = region ? isRegionColonizable(params.worldBase, region.id) : false;
      return explain("region_is_colonizable", value, value, true, "event.trigger.regionIsColonizable", region ?? null);
    }
    case "region_population_above":
    case "region_population_below":
    case "region_has_population_above":
    case "region_has_population_below": {
      const region = params.scopes?.region;
      const value = region ? getRegionPopulationTotal(params.worldBase, region.id) : 0;
      const passed = trigger.type === "region_population_above" || trigger.type === "region_has_population_above" ? value > trigger.value : value < trigger.value;
      return explain(trigger.type, passed, value, trigger.value, trigger.type === "region_population_above" || trigger.type === "region_has_population_above" ? "event.trigger.regionPopulationAbove" : "event.trigger.regionPopulationBelow", region ?? null);
    }
    case "region_has_building": {
      const region = params.scopes?.region;
      const value = region
        ? (params.worldBase.regionBuildingsByRegion[region.id] ?? []).some((building) => building.buildingId === trigger.targetId)
        : false;
      return explain("region_has_building", value, value, trigger.targetId ?? null, "event.trigger.regionHasBuilding", region ?? null);
    }
    case "region_has_resource_deposit": {
      const region = params.scopes?.region;
      const value = region
        ? (params.worldBase.regionResourceDepositsByRegion[region.id] ?? []).some((deposit) => deposit.goodId === trigger.targetId)
        : false;
      return explain(
        "region_has_resource_deposit",
        value,
        value,
        trigger.targetId ?? null,
        "event.trigger.regionHasResourceDeposit",
        region ?? null,
      );
    }
    case "region_radicals_above": {
      const region = params.scopes?.region;
      const value = region ? getRegionPopulationStatTotal(params.worldBase, region.id, "radicals") : 0;
      return explain("region_radicals_above", value > trigger.value, value, trigger.value, "event.trigger.regionRadicalsAbove", region ?? null);
    }
    case "region_loyalists_above": {
      const region = params.scopes?.region;
      const value = region ? getRegionPopulationStatTotal(params.worldBase, region.id, "loyalists") : 0;
      return explain("region_loyalists_above", value > trigger.value, value, trigger.value, "event.trigger.regionLoyalistsAbove", region ?? null);
    }
    case "region_standard_of_living_below": {
      const region = params.scopes?.region;
      const value = region ? getRegionStandardOfLiving(params.worldBase, region.id) : 0;
      return explain(
        "region_standard_of_living_below",
        value < trigger.value,
        value,
        trigger.value,
        "event.trigger.regionStandardOfLivingBelow",
        region ?? null,
      );
    }
    case "region_colonization_progress_above":
    case "region_colonization_progress_below": {
      const region = params.scopes?.region;
      const value = region ? getRegionColonizationProgressTotal(params.worldBase, region.id) : 0;
      const passed = trigger.type === "region_colonization_progress_above" ? value > trigger.value : value < trigger.value;
      return explain(
        trigger.type,
        passed,
        value,
        trigger.value,
        trigger.type === "region_colonization_progress_above"
          ? "event.trigger.regionColonizationProgressAbove"
          : "event.trigger.regionColonizationProgressBelow",
        region ?? null,
      );
    }
    case "building_profit_below": {
      const region = params.scopes?.region;
      const value = region ? getRegionMinimumBuildingNumber(params.worldBase, region.id, "lastNetDucats") : null;
      return explain("building_profit_below", value != null && value < trigger.value, value, trigger.value, "event.trigger.buildingProfitBelow", region ?? null);
    }
    case "building_employment_below": {
      const region = params.scopes?.region;
      const value = region ? getRegionMinimumBuildingNumber(params.worldBase, region.id, "lastLaborCoverage") : null;
      return explain(
        "building_employment_below",
        value != null && value < trigger.value,
        value,
        trigger.value,
        "event.trigger.buildingEmploymentBelow",
        region ?? null,
      );
    }
    case "building_output_above": {
      const region = params.scopes?.region;
      const value = region && trigger.targetId ? getRegionMaximumBuildingOutput(params.worldBase, region.id, trigger.targetId) : null;
      return explain(
        "building_output_above",
        value != null && value > trigger.value,
        value,
        trigger.value,
        "event.trigger.buildingOutputAbove",
        region ?? null,
      );
    }
    default:
      return makePassed("unsupported", "event.trigger.invalid", false);
  }
}

function explain(
  triggerId: string,
  passed: boolean,
  value: number | string | boolean | null,
  threshold: number | string | boolean | null,
  labelKey: string,
  affectedObject?: EventResolvedScope | null,
): EventTriggerEvaluation {
  return {
    passed,
    explanations: [{ triggerId, passed, value, threshold, labelKey, affectedObject: affectedObject ?? null }],
  };
}

function makePassed(triggerId: string, labelKey: string, passed: boolean): EventTriggerEvaluation {
  return { passed, explanations: [{ triggerId, passed, labelKey }] };
}

function countControlledRegions(
  worldBase: Pick<WorldBase, "regionOwner" | "regionController">,
  countryId: string,
): number {
  let count = 0;
  const regionIds = new Set([...Object.keys(worldBase.regionOwner), ...Object.keys(worldBase.regionController)]);
  for (const regionId of regionIds) {
    if ((worldBase.regionController[regionId] ?? worldBase.regionOwner[regionId] ?? null) === countryId) count += 1;
  }
  return count;
}

function findControlledForeignRegion(
  worldBase: Pick<WorldBase, "regionOwner" | "regionController">,
  countryId: string,
): string | null {
  const regionIds = new Set([...Object.keys(worldBase.regionOwner), ...Object.keys(worldBase.regionController)]);
  for (const regionId of [...regionIds].sort((a, b) => a.localeCompare(b))) {
    const ownerId = worldBase.regionOwner[regionId] ?? null;
    const controllerId = worldBase.regionController[regionId] ?? ownerId;
    if (ownerId && controllerId === countryId && ownerId !== countryId) return regionId;
  }
  return null;
}

function isRegionColonizable(
  worldBase: Pick<WorldBase, "regionOwner" | "regionController" | "regionColonizationByRegion">,
  regionId: string,
): boolean {
  if ((worldBase.regionOwner[regionId] ?? null) != null) return false;
  if ((worldBase.regionController[regionId] ?? null) != null) return false;
  return worldBase.regionColonizationByRegion[regionId]?.disabled !== true;
}

export function getRegionPopulationTotal(
  worldBase: Pick<WorldBase, "regionPopulationByRegion">,
  regionId: string,
): number {
  const population = worldBase.regionPopulationByRegion[regionId];
  if (!population) return 0;
  let total = 0;
  for (const pop of population.pops) total += Number(pop.size) || 0;
  return total;
}

export function getRegionPopulationStatTotal(
  worldBase: Pick<WorldBase, "regionPopulationByRegion">,
  regionId: string,
  stat: "radicals" | "loyalists",
): number {
  const population = worldBase.regionPopulationByRegion[regionId];
  if (!population) return 0;
  let total = 0;
  for (const pop of population.pops) {
    for (const profession of Object.values(pop.professions)) {
      total += Number(profession[stat]) || 0;
    }
  }
  return Number(total.toFixed(3));
}

export function getRegionStandardOfLiving(
  worldBase: Pick<WorldBase, "regionPopulationByRegion">,
  regionId: string,
): number {
  const population = worldBase.regionPopulationByRegion[regionId];
  if (!population) return 0;
  let weightedTotal = 0;
  let sizeTotal = 0;
  for (const pop of population.pops) {
    for (const profession of Object.values(pop.professions)) {
      const size = Number(profession.size) || 0;
      if (size <= 0) continue;
      weightedTotal += (Number(profession.standardOfLiving) || 0) * size;
      sizeTotal += size;
    }
  }
  if (sizeTotal <= 0) return 0;
  return Number((weightedTotal / sizeTotal).toFixed(3));
}

export function getRegionColonizationProgressTotal(
  worldBase: Pick<WorldBase, "colonyProgressByRegion">,
  regionId: string,
): number {
  const progress = worldBase.colonyProgressByRegion[regionId];
  if (!progress) return 0;
  return Object.values(progress).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

export function getLatestCountryResourceFlowNet(
  worldBase: Pick<WorldBase, "resourceLedgerByTurn">,
  countryId: string,
  resource: keyof ResourceTotals,
): number {
  const turnIds = Object.keys(worldBase.resourceLedgerByTurn)
    .map((turnId) => Number(turnId))
    .filter((turnId) => Number.isInteger(turnId))
    .sort((a, b) => b - a);
  const latestTurnId = turnIds[0] ?? null;
  if (latestTurnId == null) return 0;
  let net = 0;
  for (const flow of worldBase.resourceLedgerByTurn[latestTurnId] ?? []) {
    if (flow.countryId !== countryId || flow.resourceId !== resource) continue;
    net += flow.direction === "income" ? flow.amount : -flow.amount;
  }
  return Number(net.toFixed(3));
}

export function getRegionMinimumBuildingNumber(
  worldBase: Pick<WorldBase, "regionBuildingsByRegion">,
  regionId: string,
  field: "lastNetDucats" | "lastLaborCoverage",
): number | null {
  let minimum: number | null = null;
  for (const building of worldBase.regionBuildingsByRegion[regionId] ?? []) {
    const value = building[field];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    minimum = minimum == null ? value : Math.min(minimum, value);
  }
  return minimum == null ? null : Number(minimum.toFixed(3));
}

export function getRegionMaximumBuildingOutput(
  worldBase: Pick<WorldBase, "regionBuildingsByRegion">,
  regionId: string,
  goodId: string,
): number | null {
  let maximum: number | null = null;
  for (const building of worldBase.regionBuildingsByRegion[regionId] ?? []) {
    const value = building.lastProductionByGoodId?.[goodId];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    maximum = maximum == null ? value : Math.max(maximum, value);
  }
  return maximum == null ? null : Number(maximum.toFixed(3));
}
