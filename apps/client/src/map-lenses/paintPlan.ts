import type { Map as MapLibreMap } from "maplibre-gl";

export type MapLensPaintPlan = {
  fillColor: unknown;
  fillOpacity: unknown;
  lineColor: unknown;
  lineWidth: unknown;
  lineOpacity: unknown;
  stripePattern: unknown;
  stripeOpacity: unknown;
  ringWidth: unknown;
  ringOpacity: unknown;
};

export function applyMapLensPaintPlan(map: MapLibreMap, plan: MapLensPaintPlan): void {
  map.setPaintProperty("province-fill", "fill-color", plan.fillColor);
  map.setPaintProperty("province-fill", "fill-opacity", plan.fillOpacity);
  map.setPaintProperty("province-colonize-stripes", "fill-pattern", plan.stripePattern);
  map.setPaintProperty("province-colonize-stripes", "fill-opacity", plan.stripeOpacity);
  map.setPaintProperty("province-colonize-ring", "line-width", plan.ringWidth);
  map.setPaintProperty("province-colonize-ring", "line-opacity", plan.ringOpacity);
  map.setPaintProperty("province-line", "line-color", plan.lineColor);
  map.setPaintProperty("province-line", "line-width", plan.lineWidth);
  map.setPaintProperty("province-line", "line-opacity", plan.lineOpacity);
}
