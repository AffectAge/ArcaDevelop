import { describe, expect, it } from "vitest";
import type { HexMapArtifact, HexTile, WorldBase } from "@arcanorum/shared";
import { collectLensBoundaryEdges } from "./hexMapLensOverlayRenderer";
import { MAP_LENS_DESCRIPTORS, MAP_MODE_DESCRIPTORS, selectMapLensCells } from "./mapLensRegistry";
import type { MapInteractionMode, MapLensId } from "./mapLensTypes";

const modeIds: MapInteractionMode[] = ["overview", "colonization", "construction", "army", "market", "inspection"];
const lensIds: MapLensId[] = ["terrain", "political", "regions", "colonization", "population", "market", "infrastructure", "military"];

const tile: HexTile = {
  id: "hex:0:0",
  q: 0,
  r: 0,
  chunkId: "hex-chunk:0:0",
  regionId: "region:land:1",
  terrain: "grassland",
  biome: "temperate",
  feature: "none",
  elevation: 0.5,
  moisture: 0.5,
  temperature: 0.5,
  movementCost: 1,
  passable: true,
  waterKind: null,
};

const map: HexMapArtifact = {
  version: 1,
  settings: {
    seed: "test",
    width: 1,
    height: 1,
    wrapX: true,
    hexSize: 24,
    chunkSize: 16,
    seaLevel: 0.42,
    temperature: 0.5,
    moisture: 0.5,
    mountains: 0.4,
    rivers: 0.35,
    forests: 0.45,
    targetLandRegionSize: 40,
    targetWaterRegionSize: 90,
  },
  tiles: [tile],
  riverEdges: [],
  coastOverlays: [],
};

const adjacentTile: HexTile = {
  ...tile,
  id: "hex:1:0",
  q: 1,
  regionId: "region:land:2",
};

const seaTile: HexTile = {
  ...tile,
  id: "hex:0:1",
  r: 1,
  regionId: "region:water:1",
  terrain: "sea",
  biome: "coastal_water",
  waterKind: "sea",
};

const adjacentMap: HexMapArtifact = {
  ...map,
  settings: { ...map.settings, width: 2, wrapX: false },
  tiles: [tile, adjacentTile],
};

describe("map lens registry", () => {
  it("declares descriptors for every mode and lens id", () => {
    expect(MAP_MODE_DESCRIPTORS.map((mode) => mode.id).sort()).toEqual([...modeIds].sort());
    expect(MAP_LENS_DESCRIPTORS.map((lens) => lens.id).sort()).toEqual([...lensIds].sort());
    expect(MAP_LENS_DESCRIPTORS.every((lens) => lens.labelKey && lens.tooltipKey)).toBe(true);
  });

  it("keeps terrain lens lightweight", () => {
    expect(selectMapLensCells("terrain", { map, worldBase: null, authCountryId: null })).toEqual([]);
  });

  it("handles missing world data for every analytical lens", () => {
    for (const lens of lensIds.filter((id) => id !== "terrain")) {
      expect(() => selectMapLensCells(lens, { map, worldBase: null, authCountryId: null })).not.toThrow();
    }
  });

  it("uses authored country colors for political ownership", () => {
    const cells = selectMapLensCells("political", {
      map,
      worldBase: makeWorldBase({ regionOwner: { [tile.regionId]: "country:blue" } }),
      authCountryId: null,
      countryColorById: { "country:blue": "#3366cc" },
    });

    expect(cells[0]?.color).toBe(0x3366cc);
    expect(cells[0]?.alpha).toBeGreaterThan(0.58);
    expect(cells[0]?.surfaceAlpha).toBeGreaterThanOrEqual(0.68);
    expect(cells[0]?.terrainMute).toBeGreaterThanOrEqual(0.86);
  });

  it("uses the leading colonizer color as a light striped political colony", () => {
    const cells = selectMapLensCells("political", {
      map,
      worldBase: makeWorldBase({
        colonyProgressByRegion: {
          [tile.regionId]: {
            "country:blue": 12,
            "country:pink": 32,
          },
        },
      }),
      authCountryId: null,
      countryColorById: { "country:pink": "#cc3399", "country:blue": "#3366cc" },
    });

    expect(cells[0]?.pattern).toBe("stripe");
    expect(cells[0]?.groupId).toBe(`colony:country:pink:${tile.regionId}`);
    expect(cells[0]?.color).toBe(0xe189c4);
  });

  it("shows pending colonization orders as a political colony preview", () => {
    const cells = selectMapLensCells("political", {
      map,
      worldBase: makeWorldBase(),
      authCountryId: null,
      countryColorById: { "country:pink": "#cc3399" },
      pendingColonyProgressByRegion: {
        [tile.regionId]: { "country:pink": 0.001 },
      },
    });

    expect(cells[0]?.pattern).toBe("stripe");
    expect(cells[0]?.groupId).toBe(`colony:country:pink:${tile.regionId}`);
    expect(cells[0]?.color).toBe(0xe189c4);
  });

  it("keeps owned political territory solid even when colony progress data exists", () => {
    const cells = selectMapLensCells("political", {
      map,
      worldBase: makeWorldBase({
        regionOwner: { [tile.regionId]: "country:owner" },
        colonyProgressByRegion: { [tile.regionId]: { "country:pink": 32 } },
      }),
      authCountryId: null,
      countryColorById: { "country:owner": "#3366cc", "country:pink": "#cc3399" },
    });

    expect(cells[0]?.pattern).toBe("none");
    expect(cells[0]?.color).toBe(0x3366cc);
  });

  it("keeps analytical coloring nearly transparent over water regions", () => {
    const waterMap: HexMapArtifact = { ...map, settings: { ...map.settings, height: 2 }, tiles: [seaTile] };
    const cells = selectMapLensCells("political", {
      map: waterMap,
      worldBase: makeWorldBase({ regionOwner: { [seaTile.regionId]: "country:blue" } }),
      authCountryId: null,
      countryColorById: { "country:blue": "#3366cc" },
    });

    expect(cells[0]?.alpha).toBeLessThanOrEqual(0.22);
    expect(cells[0]?.surfaceAlpha).toBeGreaterThanOrEqual(0.52);
    expect(cells[0]?.terrainMute).toBeGreaterThanOrEqual(0.76);
  });

  it("does not create internal borders between same-owner political cells", () => {
    const cells = selectMapLensCells("political", {
      map: adjacentMap,
      worldBase: makeWorldBase({
        regionOwner: {
          [tile.regionId]: "country:blue",
          [adjacentTile.regionId]: "country:blue",
        },
      }),
      authCountryId: null,
    });
    const byId = new Map(cells.map((cell) => [cell.tile.id, cell]));
    const edges = collectLensBoundaryEdges(cells, byId, adjacentMap);

    expect(edges.some((edge) => edge.hexId === tile.id && edge.direction === 0)).toBe(false);
  });

  it("creates a boundary between different political owners", () => {
    const cells = selectMapLensCells("political", {
      map: adjacentMap,
      worldBase: makeWorldBase({
        regionOwner: {
          [tile.regionId]: "country:blue",
          [adjacentTile.regionId]: "country:red",
        },
      }),
      authCountryId: null,
    });
    const byId = new Map(cells.map((cell) => [cell.tile.id, cell]));
    const edges = collectLensBoundaryEdges(cells, byId, adjacentMap);

    expect(edges.some((edge) => edge.hexId === tile.id && edge.direction === 0)).toBe(true);
  });

  it("marks blocked colonization cells with a hatch pattern", () => {
    const cells = selectMapLensCells("colonization", {
      map,
      worldBase: makeWorldBase({ regionColonizationByRegion: { [tile.regionId]: { cost: 10, disabled: true } } }),
      authCountryId: null,
    });

    expect(cells[0]?.pattern).toBe("hatch");
  });
});

function makeWorldBase(overrides?: Partial<WorldBase>): WorldBase {
  return {
    turnId: 1,
    resourcesByCountry: {},
    resourceLedgerByTurn: {},
    explanationRecordsByTurn: {},
    regionOwner: {},
    regionController: {},
    hexOwner: {},
    hexNameById: {},
    colonyProgressByRegion: {},
    regionColonizationByRegion: {},
    regionPopulationByRegion: {},
    regionBuildingsByRegion: {},
    regionBuildingDucatsByRegion: {},
    regionPopulationTreasuryByRegion: {},
    regionConstructionQueueByRegion: {},
    regionResourceDepositsByRegion: {},
    regionResourceExplorationQueueByRegion: {},
    regionResourceExplorationCountByRegion: {},
    parliamentByCountry: {},
    technologyByCountry: {},
    countryDecisionsByCountryId: {},
    countryEventsByCountryId: {},
    countryScheduledEventsByCountryId: {},
    countryEventFlagsByCountryId: {},
    journalEntriesByCountryId: {},
    countryModifiersByCountryId: {},
    divisionTemplatesByCountry: {},
    divisionsById: {},
    militaryFormationQueueByCountry: {},
    diplomacyProposals: [],
    ...overrides,
  };
}
