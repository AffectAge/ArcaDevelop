import { DEFAULT_HEX_MAP_SETTINGS, type HexMapArtifact, type HexTile, type RegionResourceDeposit } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import { generateResourceDeposits } from "./resourceDepositGeneration";

describe("resourceDepositGeneration", () => {
  it("generates deterministic hex deposits from good rules and respects authored occupied hexes", () => {
    const authored = makeDeposit("good:stone", "hex:0:0", "region:a");
    const first = generateResourceDeposits({
      artifact: makeArtifact(),
      authoredDepositsByRegion: { "region:a": [authored] },
      goods: [
        {
          id: "good:iron_ore",
          deposit: {
            enabled: true,
            depletionMode: "finite",
            minAmount: 10,
            maxAmount: 20,
            visibility: "known",
            generation: {
              tagQuery: "morphology:rough",
              global: { count: 1 },
            },
          },
        },
      ],
    });
    const second = generateResourceDeposits({
      artifact: makeArtifact(),
      authoredDepositsByRegion: { "region:a": [authored] },
      goods: [
        {
          id: "good:iron_ore",
          deposit: {
            enabled: true,
            depletionMode: "finite",
            minAmount: 10,
            maxAmount: 20,
            visibility: "known",
            generation: {
              tagQuery: "morphology:rough",
              global: { count: 1 },
            },
          },
        },
      ],
    });

    expect(first).toEqual(second);
    const generated = Object.values(first).flat();
    expect(generated).toHaveLength(1);
    expect(generated[0]).toMatchObject({
      goodId: "good:iron_ore",
      hexId: "hex:1:0",
      regionId: "region:a",
      source: "generated",
      visibility: "known",
      depletionMode: "finite",
    });
  });

  it("filters generated deposits with map tag queries", () => {
    const generated = generateResourceDeposits({
      artifact: makeArtifact(),
      goods: [
        {
          id: "good:grain",
          deposit: {
            enabled: true,
            depletionMode: "finite",
            minAmount: 10,
            maxAmount: 20,
            visibility: "known",
            generation: {
              tagQuery: { all: ["fertility:rich"], not: ["slope:rugged"] },
              global: { count: 1 },
            },
          },
        },
      ],
    });

    expect(Object.values(generated).flat()).toHaveLength(1);
    expect(Object.values(generated).flat()[0]?.hexId).toBe("hex:2:0");
  });
});

function makeArtifact(): HexMapArtifact {
  return {
    version: 1,
    settings: {
      ...DEFAULT_HEX_MAP_SETTINGS,
      seed: "deposit-test",
      width: 3,
      height: 1,
      hexSize: 24,
      chunkSize: 8,
      wrapX: false,
    },
    tiles: [
      makeTile("hex:0:0", "region:a", "hills"),
      makeTile("hex:1:0", "region:a", "hills"),
      makeTile("hex:2:0", "region:a", "plains", ["fertility:rich", "slope:flat"]),
    ],
    riverEdges: [],
    coastOverlays: [],
  };
}

function makeTile(id: HexTile["id"], regionId: HexTile["regionId"], terrain: string, mapTags: HexTile["mapTags"] = []): HexTile {
  return {
    id,
    regionId,
    q: Number(id.split(":")[1]),
    r: Number(id.split(":")[2]),
    chunkId: "hex-chunk:0:0",
    waterKind: null,
    elevation: terrain === "hills" ? 0.6 : 0.2,
    moisture: 0.5,
    temperature: 0.5,
    temperatureBand: "temperate",
    moistureBand: "normal",
    distanceToWater: 2,
    isCoastal: false,
    riverMask: 0,
    riverWidth: 0,
    mapTags: mapTags.length > 0 ? mapTags : terrain === "hills" ? ["morphology:rough"] : ["biome:plains"],
    movementCost: 1,
    passable: true,
  };
}

function makeDeposit(goodId: string, hexId: HexTile["id"], regionId: HexTile["regionId"]): RegionResourceDeposit {
  return {
    id: `resource_deposit:${goodId.replace(/[^a-z0-9_-]+/gi, "_")}_${hexId.replace(/[^a-z0-9_-]+/gi, "_")}`,
    goodId,
    hexId,
    regionId,
    amount: 10,
    maxAmount: 10,
    initialAmount: 10,
    visibility: "known",
    source: "authored",
    depletionMode: "finite",
  };
}
