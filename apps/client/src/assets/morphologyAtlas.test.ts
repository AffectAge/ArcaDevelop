import { describe, expect, it } from "vitest";
import { resolveMorphologyAtlasRow, resolveMorphologyAtlasVariant, resolveMorphologyVisualId } from "./morphologyAtlas";

describe("morphology atlas", () => {
  it("maps rough, mountain and snow mountain tags to stable rows", () => {
    expect(resolveMorphologyVisualId({ mapTags: ["morphology:flat"] })).toBeNull();
    expect(resolveMorphologyVisualId({ mapTags: ["morphology:rough"] })).toBe("hills");
    expect(resolveMorphologyVisualId({ mapTags: ["morphology:mountainous"] })).toBe("mountains");
    expect(resolveMorphologyVisualId({ mapTags: ["morphology:mountainous", "feature:snow"] })).toBe("snow-mountains");
    expect(resolveMorphologyAtlasRow("hills")).toBe(0);
    expect(resolveMorphologyAtlasRow("mountains")).toBe(1);
    expect(resolveMorphologyAtlasRow("snow-mountains")).toBe(2);
  });

  it("selects a deterministic in-range variant", () => {
    const first = resolveMorphologyAtlasVariant("hex:17:9");
    expect(first).toBe(resolveMorphologyAtlasVariant("hex:17:9"));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(6);
  });
});
