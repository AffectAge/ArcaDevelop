import { describe, expect, it } from "vitest";
import { NaturalRenderTextureBudget } from "./naturalRenderTextures";

describe("NaturalRenderTextureBudget", () => {
  it("keeps a visible chunk on its simplified layer when detailed textures exceed the GPU budget", () => {
    const budget = new NaturalRenderTextureBudget(100);
    expect(budget.tryReserve(40, false)).toBe(true);
    expect(budget.tryReserve(80, true)).toBe(false);
    expect(budget.snapshot()).toEqual({ allocatedBytes: 40, renderTextureCount: 1, deniedDetailedLayers: 1 });
  });

  it("releases the RenderTexture reservation on chunk eviction", () => {
    const budget = new NaturalRenderTextureBudget(100);
    expect(budget.tryReserve(80, false)).toBe(true);
    budget.release(80);
    expect(budget.snapshot()).toEqual({ allocatedBytes: 0, renderTextureCount: 0, deniedDetailedLayers: 0 });
    expect(budget.tryReserve(100, true)).toBe(true);
  });
});
