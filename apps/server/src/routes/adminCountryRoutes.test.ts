import express from "express";
import type { Country, EventLogEntry } from "@arcanorum/shared";
import type { CountryDeletionPlan } from "../lifecycle/countryDeletionPlan";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  adminCountryUpdateSchema,
  registerAdminCountryRoutes,
  type AdminCountryDbRecord,
  type AdminCountryRoutesDependencies,
} from "./adminCountryRoutes";

describe("adminCountryRoutes", () => {
  it("validates admin country update payloads", () => {
    expect(adminCountryUpdateSchema.safeParse({ countryName: "Bohemia", countryColor: "#112233" }).success).toBe(true);
    expect(adminCountryUpdateSchema.safeParse({ countryName: "B", countryColor: "red" }).success).toBe(false);
  });

  it("updates admin flag and invalidates country cache", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/countries/country:b/admin", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isAdmin: true }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ id: "country:b", isAdmin: true }));
    expect(deps.updateCountryAdmin).toHaveBeenCalledWith("country:b", true);
    expect(deps.invalidateCountryQueryCache).toHaveBeenCalledOnce();
  });

  it("updates country fields, market, and replaces uploaded assets", async () => {
    const flagFile = makeFile("new-flag.png");
    const deps = makeDeps({ uploadFiles: { flag: [flagFile] } });
    const app = makeApp(deps);

    const response = await request(app, "/admin/countries/country:b", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        countryName: "New Country",
        countryColor: "#abcdef",
        marketId: "market:a",
      }),
    });

    expect(response.status).toBe(200);
    expect(deps.updateCountry).toHaveBeenCalledWith(
      "country:b",
      expect.objectContaining({
        name: "New Country",
        color: "#abcdef",
        flagUrl: "/scenario-assets/demo/assets/uploads/flags/new-flag.png?v=1",
      }),
    );
    expect(deps.setCountryMarketId).toHaveBeenCalledWith("country:b", "market:a");
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/old-flag.png?v=1");
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("cleans uploaded files when country update payload is invalid", async () => {
    const flagFile = makeFile("new-flag.png");
    const deps = makeDeps({ uploadFiles: { flag: [flagFile] } });
    const app = makeApp(deps);

    const response = await request(app, "/admin/countries/country:b", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ countryName: "B" }),
    });

    expect(response.status).toBe(400);
    expect(deps.removeUploadedFiles).toHaveBeenCalledWith([flagFile, undefined]);
    expect(deps.updateCountry).not.toHaveBeenCalled();
  });

  it("returns country deletion preview without mutating state", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/countries/country:b/deletion-preview");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ countryId: "country:b", cleanupPlan: makeDeletionPlan() });
    expect(deps.deleteCountry).not.toHaveBeenCalled();
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });

  it("deletes a country through the full cleanup and audit lifecycle", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/countries/country:b", { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, cleanupPlan: makeDeletionPlan(), auditEntryId: "audit:1" });
    expect(deps.deleteCountry).toHaveBeenCalledWith("country:b");
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/old-flag.png?v=1");
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/old-crest.png?v=1");
    expect(deps.removeCountryOrdersAndReadiness).toHaveBeenCalledWith("country:b");
    expect(deps.cleanupWorldBaseAfterCountryRemoval).toHaveBeenCalledWith("country:b");
    expect(deps.cleanupMarketsAfterCountryRemoval).toHaveBeenCalledWith("country:b");
    expect(deps.pushAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorCountryId: "country:admin",
        action: "country.delete",
        targetId: "country:b",
      }),
    );
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledWith({ mask: 4095 });
    expect(deps.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "NEWS_EVENT" }));
  });

  it("prevents admins from deleting themselves", async () => {
    const app = makeApp(makeDeps());

    const response = await request(app, "/admin/countries/country:admin", { method: "DELETE" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "CANNOT_DELETE_SELF" });
  });
});

function makeApp(deps: AdminCountryRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerAdminCountryRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  uploadFiles?: { flag?: Express.Multer.File[]; crest?: Express.Multer.File[] };
}): AdminCountryRoutesDependencies {
  const country = makeCountryRecord();
  return {
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
    masks: {
      resourcesByCountry: 1,
      provinceOwner: 2,
      colonyProgressByRegion: 4,
      regionConstructionQueueByRegion: 8,
      parliamentByCountry: 16,
      technologyByCountry: 32,
      countryDecisionsByCountryId: 64,
      countryEventsByCountryId: 128,
      divisionTemplatesByCountry: 256,
      divisionsById: 512,
      militaryFormationQueueByCountry: 1024,
      diplomacyProposals: 2048,
    },
    getTurnId: () => 8,
    findCountry: vi.fn(async (countryId: string) => (countryId === "country:b" ? country : null)),
    updateCountryAdmin: vi.fn(async (countryId: string, isAdmin: boolean) => ({ ...country, id: countryId, isAdmin })),
    updateCountry: vi.fn(async (_countryId: string, data) => ({ ...country, ...data })),
    deleteCountry: vi.fn(async () => undefined),
    countryFromDb: (row) => makeCountry(row),
    setCountryMarketId: vi.fn(),
    invalidateCountryQueryCache: vi.fn(),
    validateImageRule: vi.fn(() => true),
    removeUploadedFiles: vi.fn(),
    removeUploadedByUrl: vi.fn(),
    makeVersionedUploadUrl: (relativePath) => `/scenario-assets/demo/assets/uploads/${relativePath}?v=1`,
    buildCountryDeletionPlan: vi.fn(() => makeDeletionPlan()),
    removeCountryOrdersAndReadiness: vi.fn(),
    cleanupWorldBaseAfterCountryRemoval: vi.fn(),
    cleanupMarketsAfterCountryRemoval: vi.fn(),
    pushAdminAuditLog: vi.fn(() => ({ id: "audit:1" })),
    cloneWorldBaseSectionSnapshot: (mask) => ({ mask }),
    savePersistentState: vi.fn(),
    broadcastWorldDeltaFromSectionSnapshot: vi.fn(),
    makeOfficialNews: (input) => makeNews(input.title),
    broadcast: vi.fn(),
  };
}

function makeCountryRecord(overrides?: Partial<AdminCountryDbRecord>): AdminCountryDbRecord {
  return {
    id: "country:b",
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

function makeDeletionPlan(): CountryDeletionPlan {
  return {
    countryId: "country:b",
    resourcesEntry: true,
    ownedProvinceIds: ["province:a"],
    colonizationProvinceIds: [],
    emptyColonizationProvinceIds: [],
    constructionQueueProvinceIds: [],
    constructionProjectIds: [],
    diplomacyProposalIds: [],
    divisionIds: [],
    divisionTemplateCountryEntry: false,
    militaryFormationQueueEntry: false,
    militaryFormationQueueItemIds: [],
    technologyEntry: false,
    parliamentEntry: false,
    decisionEntry: false,
    eventEntry: false,
    orderTurns: [],
    resolveReadyTurns: [],
    assetRefs: [{ kind: "flag", url: "/scenario-assets/demo/assets/uploads/old-flag.png?v=1" }],
  };
}

function makeNews(title: string): EventLogEntry {
  return {
    id: "news:test",
    turn: 8,
    timestamp: "now",
    category: "politics",
    title,
    message: title,
    countryId: "country:b",
    priority: "high",
    visibility: "public",
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
    requireAuthOrCleanup: vi.fn(),
    requireAdmin: vi.fn().mockResolvedValue({ countryId: "country:admin", isAdmin: true }),
    requireAdminOrCleanup: vi.fn().mockResolvedValue({ countryId: "country:admin", isAdmin: true }),
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
