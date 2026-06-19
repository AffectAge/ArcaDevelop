import { buildProvinceMatchExpression } from "./mapLibreExpressions";
import type { MapLensPaintPlan } from "./paintPlan";

export type RegionLensGroup = {
  ids: string[];
  value: string;
  borderColor: string;
};

export type DivisionMapMarker = {
  countryId: string;
  provinceId: string;
};

export type SimpleLensPaintPlanOptions = {
  colonizeEmptyPattern: string;
  fillFallbackColor: string;
  borderFallbackColor: string;
  oceanProvinceExpression: unknown;
  oceanFillOpacity: number;
  showProvinceBorders: boolean;
  mapLensFillOpacity: number;
  mapLensBorderOpacity: number;
};

export function createRegionsLensPaintPlan(groups: RegionLensGroup[], options: SimpleLensPaintPlanOptions): MapLensPaintPlan {
  return {
    fillColor: ["coalesce", ["feature-state", "regionMapColor"], options.fillFallbackColor],
    fillOpacity: buildProvinceMatchExpression(
      groups.map((group) => ({ ids: group.ids, value: 0.72 })),
      ["case", options.oceanProvinceExpression, options.oceanFillOpacity, 0.12],
    ),
    stripePattern: options.colonizeEmptyPattern,
    stripeOpacity: 0,
    ringWidth: 0,
    ringOpacity: 0,
    lineColor: ["coalesce", ["feature-state", "regionMapBorderColor"], options.borderFallbackColor],
    lineWidth: ["interpolate", ["linear"], ["zoom"], 0, 0.2, 3, 0.55, 6, 1.2],
    lineOpacity: options.showProvinceBorders ? 0.72 : 0,
  };
}

export function createProvinceColorsLensPaintPlan(options: SimpleLensPaintPlanOptions): MapLensPaintPlan {
  return {
    fillColor: ["coalesce", ["feature-state", "provinceMapColor"], options.fillFallbackColor],
    fillOpacity: ["case", options.oceanProvinceExpression, options.oceanFillOpacity, 0.72],
    stripePattern: options.colonizeEmptyPattern,
    stripeOpacity: 0,
    ringWidth: 0,
    ringOpacity: 0,
    lineColor: ["coalesce", ["feature-state", "provinceMapBorderColor"], options.borderFallbackColor],
    lineWidth: 0.9,
    lineOpacity: options.showProvinceBorders ? 0.62 : 0,
  };
}

export function createMilitaryLensPaintPlan(divisions: DivisionMapMarker[], perspectiveCountryId: string | null, options: SimpleLensPaintPlanOptions): MapLensPaintPlan {
  const ownArmyIds = new Set<string>();
  const foreignArmyIds = new Set<string>();
  for (const division of divisions) {
    if (!division.provinceId) continue;
    if (perspectiveCountryId && division.countryId === perspectiveCountryId) ownArmyIds.add(division.provinceId);
    else foreignArmyIds.add(division.provinceId);
  }
  const foreignIds = [...foreignArmyIds];
  const ownIds = [...ownArmyIds];
  return {
    fillColor: buildProvinceMatchExpression([
      { ids: foreignIds, value: "#ef4444" },
      { ids: ownIds, value: "#22c55e" },
    ], options.fillFallbackColor),
    fillOpacity: buildProvinceMatchExpression([
      { ids: foreignIds, value: options.mapLensFillOpacity },
      { ids: ownIds, value: options.mapLensFillOpacity },
    ], ["case", options.oceanProvinceExpression, options.oceanFillOpacity, 0.14]),
    stripePattern: options.colonizeEmptyPattern,
    stripeOpacity: 0,
    ringWidth: 0,
    ringOpacity: 0,
    lineColor: buildProvinceMatchExpression([
      { ids: foreignIds, value: "#ef4444" },
      { ids: ownIds, value: "#22c55e" },
    ], options.borderFallbackColor),
    lineWidth: 1.15,
    lineOpacity: options.showProvinceBorders ? buildProvinceMatchExpression([
      { ids: foreignIds, value: options.mapLensBorderOpacity },
      { ids: ownIds, value: options.mapLensBorderOpacity },
    ], 0.1) : 0,
  };
}
