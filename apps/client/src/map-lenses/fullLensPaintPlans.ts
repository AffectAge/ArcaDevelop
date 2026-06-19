import { buildProvinceMatchExpression } from "./mapLibreExpressions";
import type { MapLensPaintPlan } from "./paintPlan";
import type { PoliticalLensId } from "./types";
import type { SimpleLensPaintPlanOptions } from "./simpleLensPaintPlans";

export type LensIdGroup = { ids: string[]; value: string; opacity?: number; lineOpacity?: number; lineWidth?: number };

export function createGroupedLensPaintPlan(groups: LensIdGroup[], options: SimpleLensPaintPlanOptions, fallbackOpacity = 0.16, fallbackLineOpacity = 0.12): MapLensPaintPlan {
  return {
    fillColor: buildProvinceMatchExpression(groups, options.fillFallbackColor),
    fillOpacity: buildProvinceMatchExpression(
      groups.map((group) => ({ ids: group.ids, value: group.opacity ?? options.mapLensFillOpacity })),
      ["case", options.oceanProvinceExpression, options.oceanFillOpacity, fallbackOpacity],
    ),
    stripePattern: options.colonizeEmptyPattern,
    stripeOpacity: 0,
    ringWidth: 0,
    ringOpacity: 0,
    lineColor: buildProvinceMatchExpression(groups, options.borderFallbackColor),
    lineWidth: buildProvinceMatchExpression(groups.map((group) => ({ ids: group.ids, value: group.lineWidth ?? 0.95 })), 0.75),
    lineOpacity: options.showProvinceBorders
      ? buildProvinceMatchExpression(groups.map((group) => ({ ids: group.ids, value: group.lineOpacity ?? options.mapLensBorderOpacity })), fallbackLineOpacity)
      : 0,
  };
}

export function createPopulationLensPaintPlan(options: SimpleLensPaintPlanOptions): MapLensPaintPlan {
  return {
    fillColor: ["case", ["boolean", ["feature-state", "hasPopulationMapData"], false], ["coalesce", ["feature-state", "populationMapColor"], options.fillFallbackColor], options.fillFallbackColor],
    fillOpacity: ["case", options.oceanProvinceExpression, options.oceanFillOpacity, ["boolean", ["feature-state", "hasPopulationMapData"], false], ["coalesce", ["feature-state", "populationMapOpacity"], 0.14], 0.14],
    stripePattern: options.colonizeEmptyPattern,
    stripeOpacity: 0,
    ringWidth: 0,
    ringOpacity: 0,
    lineColor: ["case", ["boolean", ["feature-state", "hasPopulationMapData"], false], ["coalesce", ["feature-state", "populationMapBorderColor"], "#94a3b8"], "#94a3b8"],
    lineWidth: 0.9,
    lineOpacity: options.showProvinceBorders ? ["case", ["boolean", ["feature-state", "hasPopulationMapData"], false], ["coalesce", ["feature-state", "populationMapBorderOpacity"], 0.08], 0.08] : 0,
  };
}

export function createPoliticalLensPaintPlan(input: {
  politicalLens: PoliticalLensId;
  effectiveFilterCountryId: string | null;
  onlyMine: boolean;
  onlyNeutral: boolean;
  showColonies: boolean;
  mutedFillColor: string;
  colonizeStripePattern: string;
  options: SimpleLensPaintPlanOptions;
}): MapLensPaintPlan {
  const mutedConditions: unknown[] = [];
  if (input.effectiveFilterCountryId != null) {
    mutedConditions.push([
      "any",
      ["all", ["boolean", ["feature-state", "isOwned"], false], ["!", ["boolean", ["feature-state", "isOwnedByPoliticalFilter"], false]]],
      ["all", ["boolean", ["feature-state", "isColonizing"], false], ["!", ["boolean", ["feature-state", "isColonizedByPoliticalFilter"], false]]],
    ]);
  }
  if (input.politicalLens === "mine" || input.onlyMine) mutedConditions.push(["!", ["boolean", ["feature-state", "isOwnedByCurrent"], false]]);
  if (input.onlyNeutral) mutedConditions.push(["!", ["boolean", ["feature-state", "isNeutral"], false]]);
  if (input.politicalLens === "colonies") mutedConditions.push(["!", ["boolean", ["feature-state", "isColonizing"], false]]);
  const mutedExpression = mutedConditions.length === 0 ? false : mutedConditions.length === 1 ? mutedConditions[0] : ["any", ...mutedConditions];
  const coloniesExpression: unknown = input.showColonies ? ["boolean", ["feature-state", "isColonizing"], false] : false;

  if (input.politicalLens === "owners") {
    return {
      fillColor: ["case", mutedExpression, input.mutedFillColor, ["boolean", ["feature-state", "isOwned"], false], ["coalesce", ["feature-state", "ownerMapColor"], "#d8c8aa"], coloniesExpression, ["coalesce", ["feature-state", "colonizeLeadLightColor"], "#cbd5e1"], input.options.fillFallbackColor],
      fillOpacity: ["case", mutedExpression, 0.18, ["boolean", ["feature-state", "isOwned"], false], 0.68, coloniesExpression, 0.62, ["case", input.options.oceanProvinceExpression, input.options.oceanFillOpacity, 0.25]],
      stripePattern: ["case", coloniesExpression, input.colonizeStripePattern, input.options.colonizeEmptyPattern],
      stripeOpacity: 0,
      ringWidth: 0,
      ringOpacity: 0,
      lineColor: ["case", mutedExpression, "#a99b83", ["boolean", ["feature-state", "isOwned"], false], ["coalesce", ["feature-state", "ownerMapBorderColor"], "#7c6f5d"], coloniesExpression, ["coalesce", ["feature-state", "colonizeLeadBorderColor"], input.options.borderFallbackColor], "#9ca3af"],
      lineWidth: ["interpolate", ["linear"], ["zoom"], 0, 0, 2.4, 0.12, 4.2, 0.42, 6.5, 0.95],
      lineOpacity: input.options.showProvinceBorders ? ["case", mutedExpression, 0.1, ["boolean", ["feature-state", "isOwned"], false], ["interpolate", ["linear"], ["zoom"], 0, 0.015, 2.2, 0.045, 4, 0.18, 6.5, 0.54], coloniesExpression, 0.34, ["case", input.options.oceanProvinceExpression, 0.05, 0.12]] : 0,
    };
  }

  return {
    fillColor: ["case", mutedExpression, input.options.fillFallbackColor, ["boolean", ["feature-state", "isOwned"], false], ["coalesce", ["feature-state", "ownerColor"], "#d1d5db"], coloniesExpression, ["coalesce", ["feature-state", "colonizeLeadLightColor"], "#cbd5e1"], input.options.fillFallbackColor],
    fillOpacity: ["case", mutedExpression, 0.28, ["boolean", ["feature-state", "isOwned"], false], input.options.mapLensFillOpacity, coloniesExpression, input.options.mapLensFillOpacity, ["case", input.options.oceanProvinceExpression, input.options.oceanFillOpacity, 0.25]],
    stripePattern: ["case", coloniesExpression, input.colonizeStripePattern, input.options.colonizeEmptyPattern],
    stripeOpacity: 0,
    ringWidth: 0,
    ringOpacity: 0,
    lineColor: ["case", mutedExpression, input.options.fillFallbackColor, ["boolean", ["feature-state", "isOwned"], false], ["coalesce", ["feature-state", "ownerColor"], "#d1d5db"], coloniesExpression, ["coalesce", ["feature-state", "colonizeLeadLightColor"], "#cbd5e1"], "#9ca3af"],
    lineWidth: 1.1,
    lineOpacity: input.options.showProvinceBorders ? ["case", mutedExpression, 0.28, ["boolean", ["feature-state", "isOwned"], false], input.options.mapLensFillOpacity, coloniesExpression, input.options.mapLensFillOpacity, ["case", input.options.oceanProvinceExpression, input.options.oceanFillOpacity, 0.25]] : 0,
  };
}

export function createColonizationCostPaintPlan(options: SimpleLensPaintPlanOptions, stripePattern: string): MapLensPaintPlan {
  const costColor = ["step", ["coalesce", ["feature-state", "colonizeCost"], 100], "#d1fae5", 50, "#86efac", 100, "#4ade80", 200, "#16a34a", 350, "#166534"];
  return {
    fillColor: ["case", ["boolean", ["feature-state", "colonizeDisabled"], false], "#b91c1c", ["boolean", ["feature-state", "isOwnedByCurrent"], false], "#4800FF", ["boolean", ["feature-state", "isOwned"], false], "#C14D00", ["boolean", ["feature-state", "hasOwnColony"], false], "#5C84FF", ["boolean", ["feature-state", "hasForeignColony"], false], "#EF9D6E", costColor],
    fillOpacity: ["case", ["boolean", ["feature-state", "colonizeDisabled"], false], options.mapLensFillOpacity, ["boolean", ["feature-state", "isOwned"], false], 0.7, options.mapLensFillOpacity],
    stripePattern: ["case", ["boolean", ["feature-state", "hasOwnColony"], false], stripePattern, ["boolean", ["feature-state", "hasForeignColony"], false], stripePattern, options.colonizeEmptyPattern],
    stripeOpacity: ["case", ["boolean", ["feature-state", "hasQueuedOwnColonizeOrder"], false], 0.72, ["boolean", ["feature-state", "hasOwnColony"], false], 0.62, ["boolean", ["feature-state", "hasForeignColony"], false], 0.45, 0],
    ringWidth: 0,
    ringOpacity: 0,
    lineColor: ["case", ["boolean", ["feature-state", "hasQueuedOwnColonizeOrder"], false], "#CE9EFF", ["boolean", ["feature-state", "hasOwnColony"], false], "#5C84FF", ["boolean", ["feature-state", "hasForeignColony"], false], "#EF9D6E", ["boolean", ["feature-state", "colonizeDisabled"], false], "#b91c1c", ["boolean", ["feature-state", "isOwnedByCurrent"], false], "#4800FF", ["boolean", ["feature-state", "isOwned"], false], "#C14D00", costColor],
    lineWidth: 1.2,
    lineOpacity: options.showProvinceBorders ? ["case", ["boolean", ["feature-state", "colonizeDisabled"], false], options.mapLensFillOpacity, ["boolean", ["feature-state", "isOwned"], false], 0.7, options.mapLensFillOpacity] : 0,
  };
}

export function createInfrastructureCoveragePaintPlan(coverage: { excellent: string[]; high: string[]; medium: string[]; low: string[]; critical: string[]; noDemand: string[] }, options: SimpleLensPaintPlanOptions): MapLensPaintPlan {
  const coverageInput: unknown[] = ["match", ["id"]];
  const pushCoverage = (ids: string[], value: number) => { if (ids.length > 0) coverageInput.push(ids, value); };
  pushCoverage(coverage.excellent, 1);
  pushCoverage(coverage.high, 0.85);
  pushCoverage(coverage.medium, 0.6);
  pushCoverage(coverage.low, 0.3);
  pushCoverage(coverage.critical, 0);
  pushCoverage(coverage.noDemand, -1);
  coverageInput.push(-1);
  const coverageColorExpression: unknown[] = ["case", ["all", ["==", coverageInput, -1], ["boolean", ["feature-state", "isOwnedByCurrent"], false]], "#05070b", ["==", coverageInput, -1], options.fillFallbackColor, ["interpolate", ["linear"], coverageInput, 0, "#dc2626", 0.5, "#f59e0b", 1, "#22c55e"]];
  const coverageOpacityExpression: unknown[] = ["case", ["==", coverageInput, -1], 0.18, options.mapLensFillOpacity];
  return {
    fillColor: coverageColorExpression,
    fillOpacity: ["case", options.oceanProvinceExpression, options.oceanFillOpacity, coverageOpacityExpression],
    stripePattern: options.colonizeEmptyPattern,
    stripeOpacity: 0,
    ringWidth: 0,
    ringOpacity: 0,
    lineColor: coverageColorExpression,
    lineWidth: 0.9,
    lineOpacity: options.showProvinceBorders ? coverageOpacityExpression : 0,
  };
}

export function createResourcesDepositsPaintPlan(input: { selectedResourceColorPairs: unknown[]; selectedResourceIds: string[]; otherDepositIds: string[]; options: SimpleLensPaintPlanOptions }): MapLensPaintPlan {
  const resourceFillColorExpression: unknown[] = ["match", ["id"], ...input.selectedResourceColorPairs];
  if (input.otherDepositIds.length > 0) resourceFillColorExpression.push(input.otherDepositIds, "#334155");
  const resourceFillColor = resourceFillColorExpression.length > 2 ? [...resourceFillColorExpression, input.options.fillFallbackColor] : input.options.fillFallbackColor;
  const resourceFillOpacityExpression: unknown[] = ["match", ["id"]];
  if (input.selectedResourceIds.length > 0) resourceFillOpacityExpression.push(input.selectedResourceIds, input.options.mapLensFillOpacity);
  if (input.otherDepositIds.length > 0) resourceFillOpacityExpression.push(input.otherDepositIds, 0.34);
  const fallback = ["case", input.options.oceanProvinceExpression, input.options.oceanFillOpacity, 0.25];
  const resourceLineOpacityExpression: unknown[] = ["match", ["id"]];
  if (input.selectedResourceIds.length > 0) resourceLineOpacityExpression.push(input.selectedResourceIds, input.options.mapLensFillOpacity);
  if (input.otherDepositIds.length > 0) resourceLineOpacityExpression.push(input.otherDepositIds, 0.34);
  return {
    fillColor: resourceFillColor,
    fillOpacity: resourceFillOpacityExpression.length > 2 ? [...resourceFillOpacityExpression, fallback] : fallback,
    stripePattern: input.options.colonizeEmptyPattern,
    stripeOpacity: 0,
    ringWidth: 0,
    ringOpacity: 0,
    lineColor: resourceFillColorExpression.length > 2 ? [...resourceFillColorExpression, "#94a3b8"] : "#94a3b8",
    lineWidth: 0.9,
    lineOpacity: input.options.showProvinceBorders ? (resourceLineOpacityExpression.length > 2 ? [...resourceLineOpacityExpression, 0] : 0) : 0,
  };
}
