import { describe, expect, it } from "vitest";
import type { HexId, HexTile } from "@arcanorum/shared";
import {
  resolveMapDisplayOwner,
  resolveMapDisplayRegionId,
} from "./mapPoliticalOwnership";

describe("map political ownership projection", () => {
  it("does not project a region owner across deep ocean", () => {
    expect(resolveMapDisplayRegionId(makeTile("ocean"))).toBeNull();
    expect(
      resolveMapDisplayOwner(makeTile("ocean"), {
        hexOwner: {},
        regionOwner: { "region:test": "country:test" },
      }),
    ).toBeNull();
  });

  it("keeps explicit maritime and coastal ownership visible", () => {
    const ocean = makeTile("ocean");
    expect(
      resolveMapDisplayOwner(ocean, {
        hexOwner: { [ocean.id]: "country:maritime" },
        regionOwner: { "region:test": "country:test" },
      }),
    ).toBe("country:maritime");
    expect(
      resolveMapDisplayOwner(makeTile("sea"), {
        hexOwner: {},
        regionOwner: { "region:test": "country:test" },
      }),
    ).toBe("country:test");
    expect(resolveMapDisplayRegionId(makeTile("sea"))).toBe("region:test");
  });
});

function makeTile(waterKind: HexTile["waterKind"]): HexTile {
  return {
    id: "hex:0:0" as HexId,
    chunkId: "hex-chunk:0:0",
    q: 0,
    r: 0,
    regionId: "region:test",
    waterKind,
    elevation: 0,
    moisture: 0,
    temperature: 0,
    temperatureBand: "temperate",
    moistureBand: "normal",
    distanceToWater: 0,
    isCoastal: waterKind === "sea",
    riverMask: 0,
    riverWidth: 0,
    mapTags: [],
    movementCost: 1,
    passable: true,
  };
}
