import { buildProvinceMatchExpression } from "../map-lenses/mapLibreExpressions";
import type { MapLensPaintPlan } from "../map-lenses/paintPlan";

export type CorridorBuildPaintPlanInput = {
  selectedRouteIds: string[];
  modeColor: string;
  fillFallbackColor: string;
  borderFallbackColor: string;
  oceanProvinceExpression: unknown;
  oceanFillOpacity: number;
  fillOpacity: number;
  borderOpacity: number;
  colonizeEmptyPattern: string;
};

export function createCorridorBuildPaintPlan(input: CorridorBuildPaintPlanInput): MapLensPaintPlan {
  return {
    fillColor: buildProvinceMatchExpression([
      { ids: input.selectedRouteIds, value: input.modeColor },
    ], ["case", ["boolean", ["feature-state", "isOwnedByCurrent"], false], ["feature-state", "ownerColor"], input.fillFallbackColor]),
    fillOpacity: buildProvinceMatchExpression([
      { ids: input.selectedRouteIds, value: input.fillOpacity },
    ], ["case", ["boolean", ["feature-state", "isOwnedByCurrent"], false], input.fillOpacity, input.oceanProvinceExpression, input.oceanFillOpacity, 0.25]),
    stripePattern: input.colonizeEmptyPattern,
    stripeOpacity: 0,
    ringWidth: 0,
    ringOpacity: 0,
    lineColor: buildProvinceMatchExpression([
      { ids: input.selectedRouteIds, value: input.modeColor },
    ], ["case", ["boolean", ["feature-state", "isOwnedByCurrent"], false], ["feature-state", "ownerColor"], input.borderFallbackColor]),
    lineWidth: buildProvinceMatchExpression([
      { ids: input.selectedRouteIds, value: 1.6 },
    ], 0.85),
    lineOpacity: input.borderOpacity,
  };
}
