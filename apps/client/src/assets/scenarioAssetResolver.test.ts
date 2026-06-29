import { describe, expect, it } from "vitest";
import { resolveScenarioAssetUrl } from "./scenarioAssetResolver";

describe("scenarioAssetResolver", () => {
  it("resolves stable asset ids to scenario asset URLs", () => {
    expect(
      resolveScenarioAssetUrl("asset:good.grain", {
        activeScenarioId: "default",
        assets: [{ id: "asset:good.grain", type: "icon", path: "assets/goods/grain.png", width: 64, height: 64 }],
      }),
    ).toBe("http://localhost:3001/scenario-assets/default/assets/goods/grain.png");
  });

  it("rejects missing ids and unsafe authored paths", () => {
    expect(
      resolveScenarioAssetUrl("asset:bad", {
        activeScenarioId: "default",
        assets: [{ id: "asset:bad", type: "icon", path: "../secret.png", width: 64, height: 64 }],
      }),
    ).toBeNull();
    expect(resolveScenarioAssetUrl("asset:missing", { activeScenarioId: "default", assets: [] })).toBeNull();
  });
});
