import { describe, expect, it } from "vitest";
import { buildProvinceMatchExpression, toProvinceMatchKeys } from "./mapLibreExpressions";

describe("map libre lens expressions", () => {
  it("matches stable string, numeric, and trailing numeric province ids", () => {
    expect(toProvinceMatchKeys("province_42")).toEqual(["province_42", 42, "42"]);
  });

  it("builds match expressions with fallback", () => {
    expect(buildProvinceMatchExpression([{ ids: ["province_1"], value: "red" }], "gray")).toEqual([
      "match",
      ["id"],
      ["province_1", 1, "1"],
      "red",
      "gray",
    ]);
  });
});
