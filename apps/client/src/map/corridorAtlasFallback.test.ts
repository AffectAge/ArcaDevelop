import { describe, expect, it } from "vitest";
import { resolveCorridorAtlasFallback } from "./corridorAtlasFallback";

describe("corridorAtlasFallback", () => {
  it("resolves texture keys and visual state from transport mode, status, and connection mask", () => {
    expect(resolveCorridorAtlasFallback({
      transportMode: "pipeline",
      status: "overloaded",
      connectionMask: 63,
    })).toEqual({
      textureKey: "corridors/pipeline/mask-63",
      tint: 0xe06145,
      alpha: 1,
    });
  });
});
