import type { HexMapArtifact, HexTile, WorldBase } from "@arcanorum/shared";
import type { UiTextKey } from "../i18n/uiText";

export type MapInteractionMode =
  | "overview"
  | "colonization"
  | "construction"
  | "army"
  | "market"
  | "inspection";

export type MapLensId =
  | "terrain"
  | "political"
  | "regions"
  | "colonization"
  | "population"
  | "market"
  | "infrastructure"
  | "military";

export type MapLayerToggleId =
  | "hexGrid"
  | "countryFill"
  | "countryBorders"
  | "regionFill"
  | "features"
  | "resources"
  | "buildings"
  | "armies"
  | "countryLabels";

export type MapLayerToggles = Record<MapLayerToggleId, boolean>;

export type MapLensLegendTone = "muted" | "neutral" | "good" | "warn" | "bad" | "accent";

export type MapLensLegendEntry = {
  labelKey: UiTextKey;
  color: string;
  tone?: MapLensLegendTone;
};

export type MapLensDescriptor = {
  id: MapLensId;
  labelKey: UiTextKey;
  tooltipKey: UiTextKey;
  legend: MapLensLegendEntry[];
  terrainSuppression: number;
  borderMode: "none" | "region" | "country";
  showInternalHexGrid: boolean;
  waterTreatment: "none" | "muted";
};

export type MapModeDescriptor = {
  id: MapInteractionMode;
  labelKey: UiTextKey;
  tooltipKey: UiTextKey;
};

export type MapLensRenderCell = {
  tile: HexTile;
  groupId: string;
  borderGroupId: string;
  labelGroupId?: string;
  label?: string;
  color: number;
  alpha: number;
  surfaceAlpha: number;
  terrainMute: number;
  borderColor?: number;
  borderAlpha?: number;
  borderTone?: "soft" | "strong" | "dotted";
  pattern?: "hatch" | "stripe" | "none";
  hatch?: boolean;
  pulse?: boolean;
};

export type MapLensRenderContext = {
  map: HexMapArtifact;
  worldBase: WorldBase | null;
  authCountryId: string | null;
  countryColorById?: Record<string, string>;
  countryNameById?: Record<string, string>;
  pendingColonyProgressByRegion?: Record<string, Record<string, number>>;
};
