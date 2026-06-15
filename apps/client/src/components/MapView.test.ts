import { describe, expect, it } from "vitest";
import { resolveAuthoredProvinceColorState } from "./MapView";

describe("resolveAuthoredProvinceColorState", () => {
  it("derives separate province and region map colors from authored data", () => {
    const first = resolveAuthoredProvinceColorState({
      provinceColor: "#8fb9a8",
      regionColor: "#22d3ee",
      regionId: "region:world",
    });
    const second = resolveAuthoredProvinceColorState({
      provinceColor: "#b7a6d9",
      regionColor: "#22d3ee",
      regionId: "region:world",
    });
    const third = resolveAuthoredProvinceColorState({
      provinceColor: "#8fb9a8",
      regionColor: "#f59e0b",
      regionId: "region:other",
    });

    expect(first.provinceMapColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(first.regionMapColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(first.provinceMapColor).not.toBe(second.provinceMapColor);
    expect(first.regionMapColor).toBe(second.regionMapColor);
    expect(first.provinceMapColor).toBe(third.provinceMapColor);
    expect(first.regionMapColor).not.toBe(third.regionMapColor);
  });
});
