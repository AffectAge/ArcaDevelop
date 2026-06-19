import { Briefcase, Crosshair, Flag, Gauge, Layers3, Landmark, Package, Pickaxe, Users } from "lucide-react";
import type { UiTextKey } from "../i18n/uiText";
import type { LocalizedMapLensDefinition, MapLensDefinition, MapModeId } from "./types";

export const MAP_MODE_IDS = [
  "political",
  "regions",
  "provinceColors",
  "diplomacy",
  "markets",
  "population",
  "resources",
  "infrastructure",
  "colonization",
  "military",
] as const satisfies readonly MapModeId[];

export const REGION_LEVEL_LENS_IDS = new Set<MapModeId>(["political", "regions", "diplomacy", "markets", "population", "resources", "infrastructure", "colonization"]);
export const PROVINCE_LEVEL_LENS_IDS = new Set<MapModeId>(["provinceColors", "military"]);

const defaultZoomBuckets = ["far", "medium", "near"] as const;

export const mapLensRegistry: Record<MapModeId, MapLensDefinition> = {
  political: {
    id: "political",
    labelKey: "map.mode.political.label",
    shortLabelKey: "map.mode.political.shortLabel",
    icon: Landmark,
    category: "base",
    defaultEntityLevel: "region",
    supportedEntityLevels: ["country", "region", "province"],
    supportedZoomBuckets: defaultZoomBuckets,
    fillColor: "#ffffff",
    fillOpacity: 0.68,
    legend: [
      { labelKey: "map.mode.political.legendOwner", color: "#4ade80", descriptionKey: "map.mode.political.legendOwnerDescription" },
      { labelKey: "map.mode.political.legendColonization", color: "#93c5fd", descriptionKey: "map.mode.political.legendColonizationDescription" },
      { labelKey: "map.mode.political.legendOutOfFilter", color: "#9ca3af", descriptionKey: "map.mode.political.legendOutOfFilterDescription" },
    ],
    explainableTooltip: true,
    perspectiveAware: true,
  },
  regions: {
    id: "regions",
    labelKey: "map.mode.regions.label",
    shortLabelKey: "map.mode.regions.shortLabel",
    icon: Layers3,
    category: "base",
    defaultEntityLevel: "region",
    supportedEntityLevels: ["region"],
    supportedZoomBuckets: defaultZoomBuckets,
    fillColor: "#22d3ee",
    fillOpacity: 0.7,
    legend: [{ labelKey: "map.mode.regions.legendLabel", color: "#22d3ee", descriptionKey: "map.mode.regions.legendDescription" }],
    explainableTooltip: true,
    perspectiveAware: false,
  },
  provinceColors: {
    id: "provinceColors",
    labelKey: "map.mode.provinceColors.label",
    shortLabelKey: "map.mode.provinceColors.shortLabel",
    icon: Layers3,
    category: "base",
    defaultEntityLevel: "province",
    supportedEntityLevels: ["province"],
    supportedZoomBuckets: ["medium", "near"],
    fillColor: "#8fb9a8",
    fillOpacity: 0.7,
    legend: [{ labelKey: "map.mode.provinceColors.legendLabel", color: "#8fb9a8", descriptionKey: "map.mode.provinceColors.legendDescription" }],
    explainableTooltip: true,
    perspectiveAware: false,
  },
  diplomacy: lens("diplomacy", "map.mode.diplomacy", Briefcase, "region", "#facc15", "map.mode.diplomacy.legendLabel", "map.mode.diplomacy.legendDescription", true),
  markets: lens("markets", "map.mode.markets", Package, "region", "#38bdf8", "map.mode.markets.legendLabel", "map.mode.markets.legendDescription", true),
  population: lens("population", "map.mode.population", Users, "region", "#fb7185", "map.mode.population.legendLabel", "map.mode.population.legendDescription", false),
  resources: lens("resources", "map.mode.resources", Pickaxe, "region", "#f97316", "map.mode.resources.legendLabel", "map.mode.resources.legendDescription", false),
  infrastructure: lens("infrastructure", "map.mode.infrastructure", Gauge, "region", "#22c55e", "map.mode.infrastructure.legendLabel", "map.mode.infrastructure.legendDescription", true),
  colonization: lens("colonization", "map.mode.colonization", Flag, "region", "#4ade80", "map.mode.colonization.legendLabel", "map.mode.colonization.legendDescription", true),
  military: lens("military", "map.mode.military", Crosshair, "province", "#ef4444", "map.mode.military.legendLabel", "map.mode.military.legendDescription", true),
};

function lens(id: MapModeId, keyPrefix: string, icon: MapLensDefinition["icon"], defaultEntityLevel: "region" | "province", fillColor: string, legendKey: UiTextKey, legendDescriptionKey: UiTextKey, perspectiveAware: boolean): MapLensDefinition {
  return {
    id,
    labelKey: `${keyPrefix}.label` as UiTextKey,
    shortLabelKey: `${keyPrefix}.shortLabel` as UiTextKey,
    icon,
    category: "base",
    defaultEntityLevel,
    supportedEntityLevels: defaultEntityLevel === "province" ? ["province"] : ["region"],
    supportedZoomBuckets: defaultZoomBuckets,
    fillColor,
    fillOpacity: 0.68,
    legend: [{ labelKey: legendKey, color: fillColor, descriptionKey: legendDescriptionKey }],
    explainableTooltip: true,
    perspectiveAware,
  };
}

export function getMapLensDefinition(id: MapModeId): MapLensDefinition {
  return mapLensRegistry[id];
}

export function getLocalizedMapLensDefinition(id: MapModeId, t: (key: UiTextKey) => string): LocalizedMapLensDefinition {
  const definition = getMapLensDefinition(id);
  return {
    ...definition,
    label: t(definition.labelKey),
    shortLabel: t(definition.shortLabelKey),
    legend: definition.legend.map((entry) => ({ label: t(entry.labelKey), color: entry.color, description: t(entry.descriptionKey) })),
  };
}

export function getMapLensZoomBucket(zoom: number): "far" | "medium" | "near" {
  if (zoom < 1.25) return "far";
  if (zoom < 3.25) return "medium";
  return "near";
}
