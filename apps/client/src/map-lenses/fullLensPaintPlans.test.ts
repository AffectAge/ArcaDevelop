import { describe, expect, it } from "vitest";
import { createGroupedLensPaintPlan, createInfrastructureCoveragePaintPlan, createPopulationLensPaintPlan } from "./fullLensPaintPlans";
import type { SimpleLensPaintPlanOptions } from "./simpleLensPaintPlans";

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

describe("full map lens paint plans", () => {
  it("builds grouped match paint plans for data-driven lenses", () => {
    const plan = createGroupedLensPaintPlan([{ ids: ["province_1"], value: "#abcdef", lineWidth: 1.25 }], options);

    expect(plan.fillColor).toEqual(["match", ["id"], ["province_1", 1, "1"], "#abcdef", "#9ca3af"]);
    expect(plan.lineWidth).toEqual(["match", ["id"], ["province_1", 1, "1"], 1.25, 0.75]);
  });

  it("uses feature-state for population paint plans", () => {
    const plan = createPopulationLensPaintPlan(options);

    expect(plan.fillColor).toEqual(["case", ["boolean", ["feature-state", "hasPopulationMapData"], false], ["coalesce", ["feature-state", "populationMapColor"], "#9ca3af"], "#9ca3af"]);
  });

  it("creates coverage paint plans from transport buckets", () => {
    const plan = createInfrastructureCoveragePaintPlan({ excellent: ["province_1"], high: [], medium: [], low: [], critical: [], noDemand: [] }, options);

    expect(plan.lineWidth).toBe(0.9);
    expect(plan.stripePattern).toBe("colonize-empty");
  });
});
