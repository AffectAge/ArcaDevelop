export type MapTextureQuality = "low" | "medium" | "high";

export const HEX_TEXTURE_QUALITY_STORAGE_KEY_SUFFIX = "map.textureQuality";

const DEFAULT_QUALITY: MapTextureQuality = "high";

export function readMapTextureQuality(countryId: string | null | undefined): MapTextureQuality {
  try {
    return normalizeMapTextureQuality(localStorage.getItem(getMapTextureQualityStorageKey(countryId)));
  } catch {
    return DEFAULT_QUALITY;
  }
}

export function writeMapTextureQuality(countryId: string | null | undefined, quality: MapTextureQuality): void {
  try {
    localStorage.setItem(getMapTextureQualityStorageKey(countryId), quality);
    window.dispatchEvent(new CustomEvent("arc:map-texture-quality", { detail: { quality } }));
  } catch {
    // Texture quality is local-only; storage failures should not block the map.
  }
}

export function getMapTextureQualityStorageKey(countryId: string | null | undefined): string {
  return `arc.ui.${countryId ?? "guest"}.${HEX_TEXTURE_QUALITY_STORAGE_KEY_SUFFIX}`;
}

export function normalizeMapTextureQuality(value: string | null | undefined): MapTextureQuality {
  return value === "low" || value === "medium" || value === "high" ? value : DEFAULT_QUALITY;
}
