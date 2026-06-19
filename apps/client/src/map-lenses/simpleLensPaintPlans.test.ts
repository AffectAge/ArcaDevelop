import { describe, expect, it } from "vitest";
import { createMilitaryLensPaintPlan, createProvinceColorsLensPaintPlan, createRegionsLensPaintPlan, type SimpleLensPaintPlanOptions } from "./simpleLensPaintPlans";

const options: SimpleLensPaintPlanOptions = {
  colonizeEmptyPattern: "colonize-empty",
  fillFallbackColor: "#9ca3af",
  borderFallbackColor: "#64748b",
  oceanProvinceExpression: ["==", ["get", "kind"], "ocean"],
  oceanFillOpacity: 0.08,
  showProvinceBorders: true,
  mapLensFillOpacity: 0.8,
  mapLensBorderOpacity: 0.8,
};

describe("simple map lens paint plans", () => {
  it("creates region paint plans from precomputed region groups", () => {
    const plan = createRegionsLensPaintPlan([{ ids: ["province_1"], value: "#111111", borderColor: "#000000" }], options);

    expect(plan.fillColor).toEqual(["coalesce", ["feature-state", "regionMapColor"], "#9ca3af"]);
    expect(plan.stripePattern).toBe("colonize-empty");
    expect(plan.lineOpacity).toBe(0.72);
  });

  it("creates authored province color paint plans", () => {
    const plan = createProvinceColorsLensPaintPlan(options);

    expect(plan.fillColor).toEqual(["coalesce", ["feature-state", "provinceMapColor"], "#9ca3af"]);
    expect(plan.lineWidth).toBe(0.9);
  });

  it("creates perspective-aware military paint plans", () => {
    const plan = createMilitaryLensPaintPlan([
      { countryId: "country_a", provinceId: "province_1" },
      { countryId: "country_b", provinceId: "province_2" },
    ], "country_a", options);

    expect(plan.fillColor).toEqual([
      "match",
      ["id"],
      ["province_2", 2, "2"],
      "#ef4444",
      ["province_1", 1, "1"],
      "#22c55e",
      "#9ca3af",
    ]);
  });
});
