import express from "express";
import type { Country, ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import type { AdminCountryDbRecord } from "./adminCountryRoutes";
import {
  registerCountryCustomizationRoutes,
  selfCountryCustomizationSchema,
  type CountryCustomizationRoutesDependencies,
  type CountryCustomizationWorldState,
} from "./countryCustomizationRoutes";

describe("countryCustomizationRoutes", () => {
  it("validates player country customization payloads", () => {
    expect(selfCountryCustomizationSchema.safeParse({ countryName: "Bohemia", countryColor: "#abcdef" }).success).toBe(true);
    expect(selfCountryCustomizationSchema.safeParse({ countryName: "B", countryColor: "blue" }).success).toBe(false);
  });

  it("updates country customization, charges resources, and replaces old uploaded assets", async () => {
    const flagFile = makeFile("new-flag.png");
    const deps = makeDeps({ uploadFiles: { flag: [flagFile] } });
    const app = makeApp(deps);

    const response = await request(app, "/country/customization", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ countryName: "New Country", countryColor: "#abcdef" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        chargedDucats: 17,
        costBreakdown: { rename: 10, recolor: 5, flag: 2, crest: 0 },
        resources: expect.objectContaining({ ducats: 83 }),
      }),
    );
    expect(deps.updateCountry).toHaveBeenCalledWith(
      "country:a",
      expect.objectContaining({
        name: "New Country",
        color: "#abcdef",
        flagUrl: "/scenario-assets/demo/assets/uploads/flags/new-flag.png?v=1",
      }),
    );
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/old-flag.png?v=1");
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
    expect(deps.invalidateCountryQueryCache).toHaveBeenCalledOnce();
  });

  it("rejects no-op customization and removes uploaded files", async () => {
    const flagFile = makeFile("new-flag.png");
    const deps = makeDeps({
      uploadFiles: { flag: [flagFile] },
      country: makeCountryRecord({ flagUrl: null }),
      validateImageRule: () => true,
    });
    const app = makeApp(deps);

    const response = await request(app, "/country/customization", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ countryName: "Old Country", countryColor: "#112233" }),
    });

    expect(response.status).toBe(200);
    expect(deps.removeUploadedFiles).not.toHaveBeenCalled();
  });

  it("rejects no changes when no field or asset changes", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/country/customization", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ countryName: "Old Country", countryColor: "#112233" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "NO_CHANGES" });
    expect(deps.removeUploadedFiles).toHaveBeenCalledWith([undefined, undefined]);
    expect(deps.updateCountry).not.toHaveBeenCalled();
  });

  it("rejects insufficient ducats without updating country", async () => {
    const deps = makeDeps({
      resources: { ...makeResources(), ducats: 3 },
    });
    const app = makeApp(deps);

    const response = await request(app, "/country/customization", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ countryName: "New Country" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "INSUFFICIENT_DUCATS",
      required: 10,
      available: 3,
      costBreakdown: { rename: 10, recolor: 0, flag: 0, crest: 0 },
    });
    expect(deps.updateCountry).not.toHaveBeenCalled();
  });

  it("cleans uploaded files when the database update fails", async () => {
    const flagFile = makeFile("new-flag.png");
    const deps = makeDeps({
      uploadFiles: { flag: [flagFile] },
      updateCountry: async () => {
        throw new Error("fail");
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/country/customization", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ countryName: "New Country" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "COUNTRY_UPDATE_FAILED" });
    expect(deps.removeUploadedFiles).toHaveBeenCalledWith([flagFile, undefined]);
    expect(deps.world.resourcesByCountry["country:a"].ducats).toBe(100);
  });
});

function makeApp(deps: CountryCustomizationRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerCountryCustomizationRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  uploadFiles?: { flag?: Express.Multer.File[]; crest?: Express.Multer.File[] };
  country?: AdminCountryDbRecord;
  resources?: ResourceTotals;
  validateImageRule?: (file: Express.Multer.File) => boolean;
  updateCountry?: (countryId: string, data: Record<string, unknown>) => Promise<AdminCountryDbRecord>;
}): CountryCustomizationRoutesDependencies & { world: CountryCustomizationWorldState } {
  const world: CountryCustomizationWorldState = {
    resourcesByCountry: { "country:a": options?.resources ?? makeResources() },
  };
  const country = options?.country ?? makeCountryRecord();
  return {
    world,
    routeAuth: createRouteAuth(),
    upload: {
      fields: () => (req, _res, next) => {
        if (options?.uploadFiles) {
          req.files = options.uploadFiles;
        }
        next();
      },
    },
    flagImageRule: { maxWidth: 192, maxHeight: 128, ratioWidth: 3, ratioHeight: 2 },
    crestImageRule: { maxWidth: 128, maxHeight: 192, ratioWidth: 2, ratioHeight: 3 },
    getWorldBase: () => world,
    getCustomizationSettings: () => ({
      renameDucats: 10,
      recolorDucats: 5,
      flagDucats: 2,
      crestDucats: 3,
    }),
    ensureCountryInWorldBase: vi.fn(),
    findCountry: vi.fn(async () => country),
    updateCountry: vi.fn(options?.updateCountry ?? (async (_countryId, data) => ({ ...country, ...data }))),
    countryFromDb: (row) => makeCountry(row),
    validateImageRule: vi.fn(options?.validateImageRule ?? (() => true)),
    removeUploadedFiles: vi.fn(),
    removeUploadedByUrl: vi.fn(),
    makeVersionedUploadUrl: (relativePath) => `/scenario-assets/demo/assets/uploads/${relativePath}?v=1`,
    savePersistentState: vi.fn(),
    invalidateCountryQueryCache: vi.fn(),
  };
}

function makeResources(): ResourceTotals {
  return {
    ducats: 100,
    gold: 0,
    culture: 0,
    science: 0,
    religion: 0,
    construction: 0,
    colonization: 0,
  };
}

function makeCountryRecord(overrides?: Partial<AdminCountryDbRecord>): AdminCountryDbRecord {
  return {
    id: "country:a",
    name: "Old Country",
    color: "#112233",
    flagUrl: "/scenario-assets/demo/assets/uploads/old-flag.png?v=1",
    crestUrl: "/scenario-assets/demo/assets/uploads/old-crest.png?v=1",
    isAdmin: false,
    isLocked: false,
    blockedUntilTurn: null,
    blockedUntilAt: null,
    lockReason: null,
    ignoreUntilTurn: null,
    eventLogRetentionTurns: null,
    isRegistrationApproved: true,
    ...overrides,
  };
}

function makeCountry(row: AdminCountryDbRecord): Country {
  return {
    ...row,
    blockedUntilAt: row.blockedUntilAt ? row.blockedUntilAt.toISOString() : null,
    lockReason: row.lockReason ?? null,
  };
}

function makeFile(filename: string): Express.Multer.File {
  return {
    fieldname: "flag",
    originalname: filename,
    encoding: "7bit",
    mimetype: "image/png",
    size: 1,
    destination: "",
    filename,
    path: filename,
    buffer: Buffer.alloc(0),
    stream: undefined as never,
  };
}

function createRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn(),
    requireAuthOrCleanup: vi.fn().mockReturnValue({ countryId: "country:a", isAdmin: false }),
    requireAdmin: vi.fn(),
    requireAdminOrCleanup: vi.fn(),
    requireSelfOrAdmin: vi.fn(),
  } as unknown as RouteAuth;
}

async function request(app: express.Express, path: string, init?: RequestInit): Promise<Response> {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a port");
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
