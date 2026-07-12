import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_LAYER_TOGGLES,
  getMapLayerSettingsKey,
  getMapLensSettingKey,
  getMapModeSettingKey,
  normalizeLayerSettings,
  normalizeLens,
  normalizeMode,
} from "./mapLensSettings";

describe("map lens settings", () => {
  it("keeps mode and lens storage scoped by country", () => {
    expect(getMapModeSettingKey("country:test")).toBe("arc.ui.country:test.map.mode");
    expect(getMapLensSettingKey("country:test")).toBe("arc.ui.country:test.map.lens");
    expect(getMapLayerSettingsKey("country:test")).toBe("arc.ui.country:test.map.layers");
    expect(getMapModeSettingKey(null)).toBe("arc.ui.anonymous.map.mode");
    expect(getMapLensSettingKey(null)).toBe("arc.ui.anonymous.map.lens");
    expect(getMapLayerSettingsKey(null)).toBe("arc.ui.anonymous.map.layers");
  });

  it("normalizes invalid persisted values to the supplied fallback", () => {
    expect(normalizeMode("army")).toBe("army");
    expect(normalizeMode("bad", "inspection")).toBe("inspection");
    expect(normalizeLens("population")).toBe("population");
    expect(normalizeLens("bad", "political")).toBe("political");
  });

  it("defaults map layers to all enabled", () => {
    expect(DEFAULT_MAP_LAYER_TOGGLES).toEqual({
      hexGrid: true,
      countryFill: true,
      countryBorders: true,
      regionFill: true,
      features: true,
      buildings: true,
      resources: true,
      armies: true,
      countryLabels: true,
    });
  });

  it("normalizes invalid persisted layer settings to defaults", () => {
    expect(normalizeLayerSettings("bad")).toEqual(DEFAULT_MAP_LAYER_TOGGLES);
    expect(normalizeLayerSettings({ buildings: false, countryFill: false })).toEqual({
      ...DEFAULT_MAP_LAYER_TOGGLES,
      buildings: false,
      countryFill: false,
    });
  });
});
