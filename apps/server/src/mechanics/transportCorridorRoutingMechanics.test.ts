import { describe, expect, it } from "vitest";
import { resolveTransportCorridorRoutePreview } from "./transportCorridorRoutingMechanics";

const mapArtifact = {
  settings: { width: 3, height: 1, wrapX: false },
  tiles: [
    { id: "hex:0:0", q: 0, r: 0, passable: true, movementCost: 1 },
    { id: "hex:1:0", q: 1, r: 0, passable: true, movementCost: 2 },
    { id: "hex:2:0", q: 2, r: 0, passable: true, movementCost: 1 },
  ],
} as never;

const worldBase = {
  cityMarkersById: {
    "city:a": { id: "city:a", name: "A", regionId: "region:a", targetHexId: "hex:0:0" },
    "city:c": { id: "city:c", name: "C", regionId: "region:c", targetHexId: "hex:2:0" },
  },
  settlementProjectsById: {},
} as never;

describe("transportCorridorRoutingMechanics", () => {
  it("computes a server route and connected regions from city endpoints", () => {
    const preview = resolveTransportCorridorRoutePreview({
      waypoints: [
        { hexId: "hex:0:0", lng: 0, lat: 0 },
        { hexId: "hex:2:0", lng: 2, lat: 0 },
      ],
      transportMode: "land",
      ownerCountryId: "country:a",
      mapArtifact,
      worldBase,
      getHexOwner: () => "country:a",
      isHexAllowedForCorridorOwner: () => true,
      getHexMovementCost: (hexId) => (hexId === "hex:1:0" ? 2 : 1),
      getBuildCost: (_mode, routeCost) => routeCost * 10,
    });

    expect(preview).toMatchObject({
      ok: true,
      computedHexIds: ["hex:0:0", "hex:1:0", "hex:2:0"],
      connectedRegionIds: ["region:a", "region:c"],
      connectedCityMarkerIds: ["city:a", "city:c"],
      routeCost: 3,
      costConstruction: 30,
    });
  });

  it("rejects routes whose start or end is not a city node", () => {
    const preview = resolveTransportCorridorRoutePreview({
      waypoints: [
        { hexId: "hex:1:0", lng: 1, lat: 0 },
        { hexId: "hex:2:0", lng: 2, lat: 0 },
      ],
      transportMode: "land",
      ownerCountryId: "country:a",
      mapArtifact,
      worldBase,
      getHexOwner: () => "country:a",
      isHexAllowedForCorridorOwner: () => true,
      getHexMovementCost: () => 1,
      getBuildCost: (_mode, routeCost) => routeCost * 10,
    });

    expect(preview).toEqual({ ok: false, error: "CORRIDOR_ENDPOINT_CITY_REQUIRED" });
  });
});
