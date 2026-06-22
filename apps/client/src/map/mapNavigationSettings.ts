import { normalizeMapTextureQuality, type MapTextureQuality } from "./hexTextureSystem";

export const MAP_NAVIGATION_SETTINGS_EVENT = "arc:map-navigation-settings";

export type MapNavigationSettings = {
  edgeScrollEnabled: boolean;
  textureQuality: MapTextureQuality;
};

export function readMapNavigationSettings(countryId: string | null | undefined): MapNavigationSettings {
  try {
    const raw = localStorage.getItem(getEdgeScrollStorageKey(countryId));
    const textureQuality = normalizeMapTextureQuality(localStorage.getItem(getTextureQualityStorageKey(countryId)));
    return {
      edgeScrollEnabled: raw == null ? true : raw === "1",
      textureQuality,
    };
  } catch {
    return { edgeScrollEnabled: true, textureQuality: "high" };
  }
}

export function writeMapNavigationSettings(countryId: string | null | undefined, settings: Partial<MapNavigationSettings>): void {
  try {
    const next = { ...readMapNavigationSettings(countryId), ...settings };
    localStorage.setItem(getEdgeScrollStorageKey(countryId), next.edgeScrollEnabled ? "1" : "0");
    localStorage.setItem(getTextureQualityStorageKey(countryId), next.textureQuality);
    window.dispatchEvent(new CustomEvent<MapNavigationSettings>(MAP_NAVIGATION_SETTINGS_EVENT, { detail: next }));
  } catch {
    // Local settings are optional; failing storage should not block gameplay.
  }
}

export function getEdgeScrollStorageKey(countryId: string | null | undefined): string {
  return `arc.ui.${countryId ?? "guest"}.map.edgeScroll`;
}

export function getTextureQualityStorageKey(countryId: string | null | undefined): string {
  return `arc.ui.${countryId ?? "guest"}.map.textureQuality`;
}
