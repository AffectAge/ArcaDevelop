import express from "express";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import { registerProvinceReadRoutes, type ProvinceReadRoutesDependencies, type ProvinceReadWorldState } from "./provinceReadRoutes";

describe("provinceReadRoutes", () => {
  it("returns paginated admin province rows with lightweight map metadata", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/provinces?q=alpha&limit=1&offset=0");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      provinces: [
        {
          id: "province:alpha",
          name: "Alpha",
          regionId: "region:world",
          provinceColor: "#8fb9a8",
          regionColor: "#22d3ee",
          areaKm2: 100,
          provinceType: "land",
          climate: "temperate",
          landscape: "plains",
          ownerCountryId: "country:a",
        },
      ],
      total: 1,
      offset: 0,
      limit: 1,
    });
    expect(body.provinces[0]).not.toHaveProperty("population");
    expect(body.provinces[0]).not.toHaveProperty("colonizationCost");
    expect(body.provinces[0]).not.toHaveProperty("colonyProgressByCountry");
  });

  it("returns public province index without raw metadata", async () => {
    const app = makeApp(makeDeps());

    const response = await request(app, "/provinces/index");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.provinces).toEqual([
      expect.objectContaining({
        id: "province:alpha",
        name: "Alpha",
        regionId: "region:world",
        provinceColor: "#8fb9a8",
        regionColor: "#22d3ee",
        climate: "temperate",
        landscape: "plains",
      }),
      expect.objectContaining({
        id: "province:beta",
        name: "Beta",
      }),
    ]);
    const forbiddenRawMetadataKey = ["source", "Properties"].join("");
    expect(body.provinces[0]).not.toHaveProperty(forbiddenRawMetadataKey);
  });
});

function makeApp(deps: ProvinceReadRoutesDependencies): express.Express {
  const app = express();
  registerProvinceReadRoutes(app, deps);
  return app;
}

function makeDeps(): ProvinceReadRoutesDependencies & { world: ProvinceReadWorldState } {
  const world: ProvinceReadWorldState = {
    provinceOwner: { "province:alpha": "country:a" },
  };
  return {
    world,
    routeAuth: createRouteAuth(),
    getProvinceIndex: () => [makeProvince({ id: "province:alpha", name: "Alpha" }), makeProvince({ id: "province:beta", name: "Beta" })],
    getWorldBase: () => world,
  };
}

function makeProvince(overrides: Partial<Adm1ProvinceIndexEntry>): Adm1ProvinceIndexEntry {
  return {
    id: "province",
    name: "Province",
    regionId: "region:world",
    provinceColor: "#8fb9a8",
    regionColor: "#22d3ee",
    areaKm2: 100,
    provinceType: "land",
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
