import type { LucideIcon } from "lucide-react";
import type { UiTextKey } from "../i18n/uiText";
import type { MapLensPaintPlan } from "./paintPlan";

export type MapLensEntityLevel = "country" | "region" | "province";
export type MapLensZoomBucket = "far" | "medium" | "near";
export type MapLensCategory = "base" | "overlay" | "debug";

export type PoliticalLensId = "owners" | "country" | "mine" | "colonies";
export type DiplomacyLensId = "treaties" | "transit" | "corridorAccess";
export type MarketLensId = "membership" | "capitals" | "selectedMarketMembers";
export type PopulationLensId = "density" | "cultures" | "religions" | "races" | "professions" | "ideologies" | "standardOfLiving" | "radicals" | "loyalists" | "needs";
export type ResourceLensId = "exploration" | "deposits";
export type InfrastructureLensViewId = "coverage" | "load" | "problems" | "corridors";
export type InfrastructureLensId = `${string}:${InfrastructureLensViewId}`;
export type MilitaryLensId = "armies";
export type ColonizationLensId = "available" | "cost" | "ownRaces" | "foreignRaces" | "blocked";
export type MapModeId = "political" | "regions" | "provinceColors" | "diplomacy" | "markets" | "population" | "resources" | "infrastructure" | "colonization" | "military";

export type MapLensLegendEntry = {
  labelKey: UiTextKey;
  color: string;
  descriptionKey: UiTextKey;
};

export type MapLensTooltipBreakdownRow = {
  labelKey: UiTextKey;
  value: string;
  tone?: "default" | "good" | "warn" | "bad";
};

export type MapLensTooltipData = {
  title: string;
  rows: MapLensTooltipBreakdownRow[];
};

export type MapLensDefinition = {
  id: MapModeId;
  labelKey: UiTextKey;
  shortLabelKey: UiTextKey;
  icon: LucideIcon;
  category: MapLensCategory;
  defaultEntityLevel: MapLensEntityLevel;
  supportedEntityLevels: readonly MapLensEntityLevel[];
  supportedZoomBuckets: readonly MapLensZoomBucket[];
  fillColor: string;
  fillOpacity: number;
  legend: readonly MapLensLegendEntry[];
  explainableTooltip: boolean;
  perspectiveAware: boolean;
};

export type LocalizedMapLensDefinition = Omit<MapLensDefinition, "labelKey" | "shortLabelKey" | "legend"> & {
  label: string;
  shortLabel: string;
  legend: Array<{ label: string; color: string; description: string }>;
};

export type MapLensComputationContext = {
  lensId: MapModeId;
  worldVersion: number;
  geometryVersion: number;
  filterHash: string;
  perspectiveCountryId: string | null;
  zoomBucket: MapLensZoomBucket;
  selectedOverlayIds: readonly MapModeId[];
};

export type ComputedMapLens = {
  context: MapLensComputationContext;
  entityLevel: MapLensEntityLevel;
  paintPlan: MapLensPaintPlan | null;
  entityColors: Map<string, string>;
  tooltipDataByEntity: Map<string, MapLensTooltipData>;
  affectedEntityIds: Set<string> | null;
};
