import express from "express";
import type { HexMapIndexEntry } from "../map/hexIndex";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import { registerHexReadRoutes, type HexReadRoutesDependencies, type HexReadWorldState } from "./hexReadRoutes";

describe("hexReadRoutes", () => {
  it("returns paginated admin hex rows with lightweight map metadata", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/hexes?q=alpha&limit=1&offset=0");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      hexes: [
        {
          id: "hex:0:0",
          name: "Alpha",
          regionId: "region:world",
          hexColor: "#8fb9a8",
          regionColor: "#22d3ee",
          areaKm2: 100,
          hexType: "land",
          climate: "temperate",
          landscape: "plains",
          ownerCountryId: "country:a",
        },
      ],
      total: 1,
      offset: 0,
      limit: 1,
    });
    expect(body.hexes[0]).not.toHaveProperty("population");
    expect(body.hexes[0]).not.toHaveProperty("colonizationCost");
    expect(body.hexes[0]).not.toHaveProperty("colonyProgressByCountry");
  });

  it("returns public hex index without raw metadata", async () => {
    const app = makeApp(makeDeps());

    const response = await request(app, "/hexes/index");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.hexes).toEqual([
      expect.objectContaining({
        id: "hex:0:0",
        name: "Alpha",
        regionId: "region:world",
        hexColor: "#8fb9a8",
        regionColor: "#22d3ee",
        climate: "temperate",
        landscape: "plains",
      }),
      expect.objectContaining({
        id: "hex:0:1",
        name: "Beta",
      }),
    ]);
    const forbiddenRawMetadataKey = ["source", "Properties"].join("");
    expect(body.hexes[0]).not.toHaveProperty(forbiddenRawMetadataKey);
  });

  it("returns generated map features as a readonly public map payload", async () => {
    const app = makeApp(makeDeps());

    const response = await request(app, "/hex-map/features");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      features: [{
        id: "map_feature:test",
        typeId: "feature:ancient_ruins",
        category: "site",
        hexId: "hex:0:0",
        regionId: "region:world",
        visualId: "feature:ancient_ruins",
        visibility: "known",
      }],
    });
  });

  it("returns scenario map feature visual rules as readonly public map payload", async () => {
    const app = makeApp(makeDeps());

    const response = await request(app, "/hex-map/feature-visuals");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      visuals: [{
        id: "map_feature_visual:snowcap",
        visualId: "feature:snowcap",
        frames: [{ frame: 5, conditions: { biomes: ["alpine"], minElevation: 0.86 } }],
      }],
    });
  });
});

function makeApp(deps: HexReadRoutesDependencies): express.Express {
  const app = express();
  registerHexReadRoutes(app, deps);
  return app;
}

function makeDeps(): HexReadRoutesDependencies & { world: HexReadWorldState } {
  const world: HexReadWorldState = {
    hexOwner: { "hex:0:0": "country:a" },
  };
  return {
    world,
    routeAuth: createRouteAuth(),
    getHexIndex: () => [makeHex({ id: "hex:0:0", name: "Alpha" }), makeHex({ id: "hex:0:1", name: "Beta" })],
    getHexMapArtifact: () => null,
    getMapFeatures: () => [{
      id: "map_feature:test",
      typeId: "feature:ancient_ruins",
      category: "site",
      hexId: "hex:0:0",
      regionId: "region:world",
      visualId: "feature:ancient_ruins",
      visibility: "known",
    }],
    getMapFeatureVisuals: () => [{
      id: "map_feature_visual:snowcap",
      visualId: "feature:snowcap",
      frames: [{ frame: 5, conditions: { biomes: ["alpine"], minElevation: 0.86 } }],
    }],
    getWorldBase: () => world,
  };
}

function makeHex(overrides: Partial<HexMapIndexEntry>): HexMapIndexEntry {
  return {
    id: "hex:0:0",
    name: "Hex",
    regionId: "region:world",
    hexColor: "#8fb9a8",
    regionColor: "#22d3ee",
    areaKm2: 100,
    hexType: "land",
    centerX: 1,
    centerY: 2,
    sourceCenterX: 1,
    sourceCenterY: 2,
    neighbors: [],
    climate: "temperate",
    pollution: 0,
    radiation: 0,
    landscape: "plains",
    continent: "continent:a",
    strategicRegion: "region:a",
    fertileLandKm2: 60,
    fertility: 0.7,
    ...overrides,
  };
}

function createRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn(),
    requireAuthOrCleanup: vi.fn(),
    requireAdmin: vi.fn().mockResolvedValue({ countryId: "country:a", isAdmin: true }),
    requireAdminOrCleanup: vi.fn(),
    requireSelfOrAdmin: vi.fn(),
  } as unknown as RouteAuth;
}

async function request(app: express.Express, path: string): Promise<Response> {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a port");
    return await fetch(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
