import { describe, expect, it } from "vitest";
import {
  getMapLensSettingKey,
  getMapModeSettingKey,
  normalizeLens,
  normalizeMode,
} from "./mapLensSettings";

describe("map lens settings", () => {
  it("keeps mode and lens storage scoped by country", () => {
    expect(getMapModeSettingKey("country:test")).toBe("arc.ui.country:test.map.mode");
    expect(getMapLensSettingKey("country:test")).toBe("arc.ui.country:test.map.lens");
    expect(getMapModeSettingKey(null)).toBe("arc.ui.anonymous.map.mode");
    expect(getMapLensSettingKey(null)).toBe("arc.ui.anonymous.map.lens");
  });

  it("normalizes invalid persisted values to the supplied fallback", () => {
    expect(normalizeMode("army")).toBe("army");
    expect(normalizeMode("bad", "inspection")).toBe("inspection");
    expect(normalizeLens("population")).toBe("population");
    expect(normalizeLens("bad", "political")).toBe("political");
  });
});
