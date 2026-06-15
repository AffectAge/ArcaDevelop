import { describe, expect, it } from "vitest";
import { normalizeGoodFlows, normalizeWorkforceRequirements } from "./contentFieldNormalizers";

describe("contentFieldNormalizers", () => {
  it("normalizes good flows with positive rounded amounts and fertility flags", () => {
    expect(
      normalizeGoodFlows([
        { goodId: " good:grain ", amount: 1.23456, affectedByFertility: true },
        { goodId: "good:wood", amount: -1 },
        { goodId: "", amount: 3 },
        { goodId: "good:iron", amount: 2 },
      ]),
    ).toEqual([
      { goodId: "good:grain", amount: 1.235, affectedByFertility: true },
      { goodId: "good:iron", amount: 2 },
    ]);
  });

  it("normalizes workforce requirements with positive integer worker counts", () => {
    expect(
      normalizeWorkforceRequirements([
        { professionId: " profession:laborers ", workers: 12.9 },
        { professionId: "profession:ignored", workers: 0 },
        { professionId: "", workers: 4 },
      ]),
    ).toEqual([{ professionId: "profession:laborers", workers: 12 }]);
  });
});
