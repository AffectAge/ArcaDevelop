import type { MapInteractionMode, MapLayerToggles, MapLensId } from "./mapLensTypes";

const DEFAULT_MODE: MapInteractionMode = "overview";
const DEFAULT_LENS: MapLensId = "terrain";
export const DEFAULT_MAP_LAYER_TOGGLES: MapLayerToggles = {
  hexGrid: true,
  countryFill: true,
  countryBorders: true,
  regionFill: true,
  features: true,
  buildings: true,
  armies: true,
  countryLabels: true,
};

export function readMapModeSetting(countryId: string | null | undefined, fallback: MapInteractionMode = DEFAULT_MODE): MapInteractionMode {
  return normalizeMode(readMapSetting(countryId, "mode"), fallback);
}

export function writeMapModeSetting(countryId: string | null | undefined, mode: MapInteractionMode): void {
  writeMapSetting(countryId, "mode", mode);
}

export function readMapLensSetting(countryId: string | null | undefined, fallback: MapLensId = DEFAULT_LENS): MapLensId {
  return normalizeLens(readMapSetting(countryId, "lens"), fallback);
}

export function writeMapLensSetting(countryId: string | null | undefined, lens: MapLensId): void {
  writeMapSetting(countryId, "lens", lens);
}

export function readMapLayerSettings(
  countryId: string | null | undefined,
  fallback: MapLayerToggles = DEFAULT_MAP_LAYER_TOGGLES,
): MapLayerToggles {
  if (typeof window === "undefined") return { ...fallback };
  return normalizeLayerSettings(window.localStorage.getItem(getMapLayerSettingsKey(countryId)), fallback);
}

export function writeMapLayerSettings(countryId: string | null | undefined, toggles: MapLayerToggles): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getMapLayerSettingsKey(countryId), JSON.stringify(normalizeLayerSettings(toggles)));
}

export function normalizeMode(value: unknown, fallback: MapInteractionMode = DEFAULT_MODE): MapInteractionMode {
  return MAP_MODES.has(value as MapInteractionMode) ? (value as MapInteractionMode) : fallback;
}

export function normalizeLens(value: unknown, fallback: MapLensId = DEFAULT_LENS): MapLensId {
  return MAP_LENSES.has(value as MapLensId) ? (value as MapLensId) : fallback;
}

export function normalizeLayerSettings(
  value: unknown,
  fallback: MapLayerToggles = DEFAULT_MAP_LAYER_TOGGLES,
): MapLayerToggles {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { ...fallback };
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return { ...fallback };
  }
  const input = parsed as Partial<Record<keyof MapLayerToggles, unknown>>;
  return {
    hexGrid: typeof input.hexGrid === "boolean" ? input.hexGrid : fallback.hexGrid,
    countryFill: typeof input.countryFill === "boolean" ? input.countryFill : fallback.countryFill,
    countryBorders: typeof input.countryBorders === "boolean" ? input.countryBorders : fallback.countryBorders,
    regionFill: typeof input.regionFill === "boolean" ? input.regionFill : fallback.regionFill,
    features: typeof input.features === "boolean" ? input.features : fallback.features,
    buildings: typeof input.buildings === "boolean" ? input.buildings : fallback.buildings,
    armies: typeof input.armies === "boolean" ? input.armies : fallback.armies,
    countryLabels: typeof input.countryLabels === "boolean" ? input.countryLabels : fallback.countryLabels,
  };
}

function readMapSetting(countryId: string | null | undefined, key: "mode" | "lens" | "layers"): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(buildMapSettingKey(countryId, key));
}

function writeMapSetting(countryId: string | null | undefined, key: "mode" | "lens" | "layers", value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildMapSettingKey(countryId, key), value);
}

function buildMapSettingKey(countryId: string | null | undefined, key: "mode" | "lens" | "layers"): string {
  return `arc.ui.${countryId || "anonymous"}.map.${key}`;
}

export function getMapModeSettingKey(countryId: string | null | undefined): string {
  return buildMapSettingKey(countryId, "mode");
}

export function getMapLensSettingKey(countryId: string | null | undefined): string {
  return buildMapSettingKey(countryId, "lens");
}

export function getMapLayerSettingsKey(countryId: string | null | undefined): string {
  return buildMapSettingKey(countryId, "layers");
}

const MAP_MODES = new Set<MapInteractionMode>([
  "overview",
  "colonization",
  "construction",
  "army",
  "market",
  "inspection",
]);

const MAP_LENSES = new Set<MapLensId>([
  "terrain",
  "political",
  "regions",
  "colonization",
  "population",
  "market",
  "infrastructure",
  "military",
]);
