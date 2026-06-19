import { describe, expect, it } from "vitest";
import { createCorridorBuildPaintPlan } from "./corridorBuildPaintPlan";

describe("corridor build paint plan", () => {
  it("highlights selected route provinces", () => {
    const plan = createCorridorBuildPaintPlan({
      selectedRouteIds: ["province_1"],
      modeColor: "#60a5fa",
      fillFallbackColor: "#9ca3af",
      borderFallbackColor: "#94a3b8",
      oceanProvinceExpression: ["==", ["get", "kind"], "ocean"],
      oceanFillOpacity: 0.08,
      fillOpacity: 0.8,
      borderOpacity: 0.8,
      colonizeEmptyPattern: "colonize-empty",
    });

    expect(plan.fillColor).toEqual([
      "match",
      ["id"],
      ["province_1", 1, "1"],
      "#60a5fa",
      ["case", ["boolean", ["feature-state", "isOwnedByCurrent"], false], ["feature-state", "ownerColor"], "#9ca3af"],
    ]);
    expect(plan.lineOpacity).toBe(0.8);
  });
});
