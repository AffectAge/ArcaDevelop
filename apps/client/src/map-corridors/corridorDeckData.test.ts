import { describe, expect, it } from "vitest";
import { buildCorridorDeckData } from "./corridorDeckData";
import type { MarketTransportCorridor } from "../lib/api";

const baseCorridor: MarketTransportCorridor = {
  id: "corridor_a",
  marketId: "market_a",
  ownerCountryId: "country_a",
  provinceIds: ["province_1", "province_2"],
  transportMode: "land",
  status: "active",
  level: 1,
  progressConstruction: 0,
  costConstruction: 100,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastCapacityByMode: { land: 100 },
  lastLoadByMode: { land: 40 },
};

const provinceMetaById = new Map([
  ["province_1", { centerX: 1, centerY: 2 }],
  ["province_2", { centerX: 3, centerY: 4 }],
]);

describe("corridor deck data", () => {
  it("builds saved corridor deck rows from province centers", () => {
    const rows = buildCorridorDeckData({
      showCorridorDeckLayer: true,
      activeModeId: "infrastructure",
      infrastructureLensIsTransport: true,
      infrastructureTransportMode: "land",
      authCountryId: "country_a",
      corridorBuildMode: false,
      corridorBuildRoutePoints: [],
      corridorBuildTransportMode: "land",
      marketTransportCorridors: [baseCorridor],
      provinceMetaById,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("corridor_a");
    expect(rows[0]?.isOwn).toBe(true);
  });

  it("adds build preview rows", () => {
    const rows = buildCorridorDeckData({
      showCorridorDeckLayer: true,
      activeModeId: "political",
      infrastructureLensIsTransport: false,
      infrastructureTransportMode: "land",
      authCountryId: "country_a",
      corridorBuildMode: true,
      corridorBuildRoutePoints: [
        { provinceId: "province_1", lng: 1, lat: 2 },
        { provinceId: "province_2", lng: 3, lat: 4 },
      ],
      corridorBuildTransportMode: "land",
      marketTransportCorridors: [],
      provinceMetaById,
    });

    expect(rows.map((row) => row.id)).toEqual(["corridor-build-preview"]);
  });
});
