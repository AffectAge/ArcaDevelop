import express from "express";
import { mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_HEX_MAP_SETTINGS,
  type HexMapArtifact,
} from "@arcanorum/shared";
import type { HexMapIndexEntry } from "../map/hexIndex";
import {
  ensureHexMapClientArtifacts,
  type HexMapClientArtifactRuntime,
} from "../scenarios/hexMapClientArtifacts";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  registerHexReadRoutes,
  type HexReadRoutesDependencies,
  type HexReadWorldState,
} from "./hexReadRoutes";

describe("hexReadRoutes", () => {
  it("returns paginated admin hex rows with lightweight map metadata", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(
      app,
      "/admin/hexes?q=alpha&limit=1&offset=0",
    );

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

  it("serves the current manifest with revalidation headers", async () => {
    const fixture = await createClientArtifactFixture();
    try {
      const app = makeApp(makeDeps(fixture.artifact));
      const response = await request(app, "/hex-map/manifest");

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-cache");
      expect(response.headers.get("etag")).toBe(fixture.artifact.manifestEtag);
      expect(await response.json()).toEqual(fixture.artifact.manifest);

      const notModified = await request(app, "/hex-map/manifest", {
        headers: { "If-None-Match": fixture.artifact.manifestEtag },
      });
      expect(notModified.status).toBe(304);
    } finally {
      await fixture.cleanup();
    }
  });

  it("serves immutable versioned navigation and chunks with negotiated compression", async () => {
    const fixture = await createClientArtifactFixture();
    try {
      const app = makeApp(makeDeps(fixture.artifact));
      const version = fixture.artifact.manifest.artifactVersion;
      const navigation = await request(
        app,
        `/hex-map/navigation?version=${version}`,
        {
          headers: { "Accept-Encoding": "gzip" },
        },
      );
      expect(navigation.status).toBe(200);
      expect(navigation.headers.get("cache-control")).toBe(
        "public, max-age=31536000, immutable",
      );
      expect(navigation.headers.get("content-encoding")).toBe("gzip");
      expect(navigation.headers.get("vary")).toContain("Accept-Encoding");
      expect((await navigation.json()).artifactVersion).toBe(version);

      const chunkId = fixture.artifact.manifest.chunks[0]?.id;
      expect(chunkId).toBe("hex-chunk:0:0");
      const chunk = await request(
        app,
        `/hex-map/chunks/${chunkId}?version=${version}`,
        {
          headers: { "Accept-Encoding": "br" },
        },
      );
      expect(chunk.status).toBe(200);
      expect(chunk.headers.get("content-encoding")).toBe("br");
      expect((await chunk.json()).id).toBe(chunkId);

      const qualityWeighted = await request(
        app,
        `/hex-map/navigation?version=${version}`,
        {
          headers: { "Accept-Encoding": "br;q=0.2, gzip;q=0.9" },
        },
      );
      expect(qualityWeighted.status).toBe(200);
      expect(qualityWeighted.headers.get("content-encoding")).toBe("gzip");
      expect((await qualityWeighted.json()).artifactVersion).toBe(version);
    } finally {
      await fixture.cleanup();
    }
  });

  it("returns stable map errors for unavailable, stale, and unknown artifacts", async () => {
    const unavailable = await request(makeApp(makeDeps()), "/hex-map/manifest");
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({
      code: "MAP_ARTIFACT_UNAVAILABLE",
    });

    const fixture = await createClientArtifactFixture();
    try {
      const app = makeApp(makeDeps(fixture.artifact));
      const missingVersion = await request(app, "/hex-map/navigation");
      expect(missingVersion.status).toBe(409);
      expect(await missingVersion.json()).toEqual({
        code: "MAP_VERSION_MISMATCH",
      });

      const staleVersion = await request(
        app,
        "/hex-map/navigation?version=stale",
      );
      expect(staleVersion.status).toBe(409);
      expect(await staleVersion.json()).toEqual({
        code: "MAP_VERSION_MISMATCH",
      });

      const version = fixture.artifact.manifest.artifactVersion;
      const unknownChunk = await request(
        app,
        `/hex-map/chunks/hex-chunk:9:9?version=${version}`,
      );
      expect(unknownChunk.status).toBe(404);
      expect(await unknownChunk.json()).toEqual({
        code: "MAP_CHUNK_NOT_FOUND",
      });

      const traversal = await request(
        app,
        `/hex-map/chunks/..%5Cmanifest.json?version=${version}`,
      );
      expect(traversal.status).toBe(404);
      expect(await traversal.json()).toEqual({ code: "MAP_CHUNK_NOT_FOUND" });

      expect((await request(app, "/hex-map/artifact")).status).toBe(404);
      expect((await request(app, "/hex-map/features")).status).toBe(404);
    } finally {
      await fixture.cleanup();
    }
  });

  it("returns MAP_ARTIFACT_UNAVAILABLE when a declared encoded file disappears", async () => {
    const fixture = await createClientArtifactFixture();
    try {
      const version = fixture.artifact.manifest.artifactVersion;
      const navigationPath = join(
        fixture.artifact.rootPath,
        `${fixture.artifact.manifest.navigation.fileName}.br`,
      );
      await unlink(navigationPath);

      const response = await request(
        makeApp(makeDeps(fixture.artifact)),
        `/hex-map/navigation?version=${version}`,
        { headers: { "Accept-Encoding": "br" } },
      );

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        code: "MAP_ARTIFACT_UNAVAILABLE",
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("returns scenario map feature visual rules as readonly public map payload", async () => {
    const app = makeApp(makeDeps());

    const response = await request(app, "/hex-map/feature-visuals");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      visuals: [
        {
          id: "map_feature_visual:snowcap",
          visualId: "feature:snowcap",
          frames: [
            {
              frame: 5,
              conditions: { biomes: ["alpine"], minElevation: 0.86 },
            },
          ],
        },
      ],
    });
  });
});

function makeApp(deps: HexReadRoutesDependencies): express.Express {
  const app = express();
  registerHexReadRoutes(app, deps);
  return app;
}

function makeDeps(
  clientArtifact: HexMapClientArtifactRuntime | null = null,
): HexReadRoutesDependencies & { world: HexReadWorldState } {
  const world: HexReadWorldState = {
    hexOwner: { "hex:0:0": "country:a" },
  };
  return {
    world,
    routeAuth: createRouteAuth(),
    getHexIndex: () => [
      makeHex({ id: "hex:0:0", name: "Alpha" }),
      makeHex({ id: "hex:0:1", name: "Beta" }),
    ],
    getHexMapClientArtifact: () => clientArtifact,
    getMapFeatureVisuals: () => [
      {
        id: "map_feature_visual:snowcap",
        visualId: "feature:snowcap",
        frames: [
          { frame: 5, conditions: { biomes: ["alpine"], minElevation: 0.86 } },
        ],
      },
    ],
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
    requireAdmin: vi
      .fn()
      .mockResolvedValue({ countryId: "country:a", isAdmin: true }),
    requireAdminOrCleanup: vi.fn(),
    requireSelfOrAdmin: vi.fn(),
  } as unknown as RouteAuth;
}

async function request(
  app: express.Express,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("server did not bind to a port");
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function createClientArtifactFixture(): Promise<{
  artifact: HexMapClientArtifactRuntime;
  cleanup: () => Promise<void>;
}> {
  const scenarioDir = await mkdtemp(join(tmpdir(), "arc-hex-read-routes-"));
  const mapArtifact: HexMapArtifact = {
    version: 1,
    settings: {
      ...DEFAULT_HEX_MAP_SETTINGS,
      width: 1,
      height: 1,
      chunkSize: 1,
      wrapX: false,
    },
    tiles: [
      {
        id: "hex:0:0",
        q: 0,
        r: 0,
        chunkId: "hex-chunk:0:0",
        regionId: "region:world",
        waterKind: null,
        elevation: 0.5,
        moisture: 0.5,
        temperature: 0.5,
        temperatureBand: "temperate",
        moistureBand: "normal",
        distanceToWater: 3,
        isCoastal: false,
        riverMask: 0,
        riverWidth: 0,
        mapTags: ["biome:grassland"],
        movementCost: 1,
        passable: true,
      },
    ],
    riverEdges: [],
    coastOverlays: [],
  };
  const artifact = ensureHexMapClientArtifacts({
    scenarioDir,
    mapArtifact,
    features: [],
  });
  return {
    artifact,
    cleanup: () => rm(scenarioDir, { recursive: true, force: true }),
  };
}
