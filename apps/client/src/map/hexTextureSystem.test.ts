import { describe, expect, it } from "vitest";
import { getMapTextureQualityStorageKey, normalizeMapTextureQuality } from "./hexTextureSystem";

describe("map texture quality setting", () => {
  it("normalizes unknown texture quality values to high", () => {
    expect(normalizeMapTextureQuality("low")).toBe("low");
    expect(normalizeMapTextureQuality("medium")).toBe("medium");
    expect(normalizeMapTextureQuality("high")).toBe("high");
    expect(normalizeMapTextureQuality("unexpected")).toBe("high");
    expect(normalizeMapTextureQuality(null)).toBe("high");
  });

  it("keeps texture quality storage scoped by country", () => {
    expect(getMapTextureQualityStorageKey("country:test")).toBe("arc.ui.country:test.map.textureQuality");
    expect(getMapTextureQualityStorageKey(null)).toBe("arc.ui.guest.map.textureQuality");
  });
});
