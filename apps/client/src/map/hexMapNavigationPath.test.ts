import { describe, expect, it } from "vitest";
import type { HexMapNavigationArtifact } from "@arcanorum/shared";
import { findPathInNavigationArtifact } from "./hexMapNavigationPath";

const navigation: HexMapNavigationArtifact = {
  formatVersion: 1,
  artifactVersion: "test",
  width: 4,
  height: 3,
  wrapX: false,
  regionIds: ["region:test"],
  passability: Array.from({ length: 12 }, () => 1 as const),
  waterKinds: Array.from({ length: 12 }, () => 0),
  movementCosts: Array.from({ length: 12 }, () => 1),
  stopsMovementOnEnter: Array.from({ length: 12 }, () => 0 as const),
  regionIndexes: Array.from({ length: 12 }, () => 0),
  riverEdges: [],
};

describe("findPathInNavigationArtifact", () => {
  it("finds a path without needing loaded render chunks", async () => {
    const path = await findPathInNavigationArtifact(navigation, "hex:0:0", "hex:3:2", "unit");
    expect(path[0]).toBe("hex:0:0");
    expect(path.at(-1)).toBe("hex:3:2");
  });

  it("limits attack paths to adjacent targets", async () => {
    await expect(findPathInNavigationArtifact(navigation, "hex:0:0", "hex:1:0", "attack")).resolves.toEqual(["hex:0:0", "hex:1:0"]);
    await expect(findPathInNavigationArtifact(navigation, "hex:0:0", "hex:3:2", "attack")).resolves.toEqual([]);
  });

  it("observes cancellation after yielding", async () => {
    let cancelled = false;
    const path = await findPathInNavigationArtifact(navigation, "hex:0:0", "hex:3:2", "corridor", {
      yieldEvery: 1,
      isCancelled: () => cancelled,
      yieldControl: async () => {
        cancelled = true;
      },
    });
    expect(path).toEqual([]);
  });

  it("does not truncate valid long-map routes at the former fixed visit cap", async () => {
    const width = 1_701;
    const longNavigation: HexMapNavigationArtifact = {
      ...navigation,
      width,
      height: 1,
      passability: Array.from({ length: width }, () => 1 as const),
      waterKinds: Array.from({ length: width }, () => 0),
      movementCosts: Array.from({ length: width }, () => 1),
      stopsMovementOnEnter: Array.from({ length: width }, () => 0 as const),
      regionIndexes: Array.from({ length: width }, () => 0),
    };

    const path = await findPathInNavigationArtifact(longNavigation, "hex:0:0", "hex:1700:0", "corridor", {
      yieldEvery: 256,
      yieldControl: async () => undefined,
    });

    expect(path).toHaveLength(width);
    expect(path.at(-1)).toBe("hex:1700:0");
  });
});
