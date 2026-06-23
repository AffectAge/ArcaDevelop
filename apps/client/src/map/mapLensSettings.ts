import type { MapInteractionMode, MapLensId } from "./mapLensTypes";

const DEFAULT_MODE: MapInteractionMode = "overview";
const DEFAULT_LENS: MapLensId = "terrain";

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

export function normalizeMode(value: unknown, fallback: MapInteractionMode = DEFAULT_MODE): MapInteractionMode {
  return MAP_MODES.has(value as MapInteractionMode) ? (value as MapInteractionMode) : fallback;
}

export function normalizeLens(value: unknown, fallback: MapLensId = DEFAULT_LENS): MapLensId {
  return MAP_LENSES.has(value as MapLensId) ? (value as MapLensId) : fallback;
}

function readMapSetting(countryId: string | null | undefined, key: "mode" | "lens"): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(buildMapSettingKey(countryId, key));
}

function writeMapSetting(countryId: string | null | undefined, key: "mode" | "lens", value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildMapSettingKey(countryId, key), value);
}

function buildMapSettingKey(countryId: string | null | undefined, key: "mode" | "lens"): string {
  return `arc.ui.${countryId || "anonymous"}.map.${key}`;
}

export function getMapModeSettingKey(countryId: string | null | undefined): string {
  return buildMapSettingKey(countryId, "mode");
}

export function getMapLensSettingKey(countryId: string | null | undefined): string {
  return buildMapSettingKey(countryId, "lens");
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
