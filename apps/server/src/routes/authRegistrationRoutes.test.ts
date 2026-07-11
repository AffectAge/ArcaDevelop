import express from "express";
import type { Country, ResourceTotals, WorldBase, WsOutMessage } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import type { AdminCountryDbRecord } from "./adminCountryRoutes";
import {
  loginSchema,
  registerAuthRegistrationRoutes,
  registerSchema,
  registrationReviewSchema,
  type AuthRegistrationCountryRecord,
  type AuthRegistrationRoutesDependencies,
  type AuthRegistrationWorldState,
} from "./authRegistrationRoutes";

describe("authRegistrationRoutes", () => {
  it("validates auth and registration review payloads", () => {
    expect(registerSchema.safeParse(makeRegisterPayload({ countryColor: "#112233" })).success).toBe(true);
    expect(registerSchema.safeParse({ countryName: "B", countryColor: "red", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ countryId: "country:a", password: "x", rememberMe: false }).success).toBe(true);
    expect(registrationReviewSchema.safeParse({ approve: true }).success).toBe(true);
  });

  it("registers a non-admin country pending approval and notifies admins", async () => {
    const flagFile = makeFile("flag.png");
    const deps = makeDeps({
      adminCountryCount: 1,
      requireApproval: true,
      uploadFiles: { flag: [flagFile] },
    });
    const app = makeApp(deps);

    const response = await request(app, "/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(makeRegisterPayload()),
    });

    expect(response.status).toBe(201);
    expect(deps.createCountry).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Bohemia",
        color: "#123456",
        cultureGroupId: "culture_group:frontier",
        religionGroupId: "religion_group:shrines",
        raceId: "race:default",
        flagUrl: "/scenario-assets/demo/assets/uploads/flags/flag.png?v=1",
        isAdmin: false,
        isRegistrationApproved: false,
      }),
    );
    expect(deps.world.resourcesByCountry["country:new"]).toEqual(
      expect.objectContaining({ colonization: 7, construction: 9, ducats: 20, gold: 80 }),
    );
    expect(deps.createStarterColonizerForCountry).toHaveBeenCalledWith("country:new");
    expect(Object.values(deps.world.civilianUnitsById)).toEqual([
      expect.objectContaining({ countryId: "country:new", type: "colonizer", status: "idle" }),
    ]);
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledWith({ mask: 9 });
    expect(deps.sendUiNotificationToAdmins).toHaveBeenCalledWith(expect.objectContaining({ id: "registration-approval:country:new" }));
    expect(deps.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "NEWS_EVENT" }));
  });

  it("cleans uploaded files when registration country creation fails", async () => {
    const flagFile = makeFile("flag.png");
    const deps = makeDeps({
      uploadFiles: { flag: [flagFile] },
      createCountry: async () => {
        throw new Error("duplicate");
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(makeRegisterPayload()),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "COUNTRY_EXISTS" });
    expect(deps.removeUploadedFile).toHaveBeenCalledWith(flagFile);
  });

  it("logs in approved countries and returns a token with world state", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ countryId: "country:a", password: "password1", rememberMe: true }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        token: "token:country:a:remember",
        playerId: "player-country:a",
        countryId: "country:a",
        isAdmin: false,
        turnId: 4,
        clientSettings: { eventLogRetentionTurns: 12 },
      }),
    );
    expect(deps.cleanupExpiredPunishments).toHaveBeenCalled();
    expect(deps.ensureCountryInWorldBase).toHaveBeenCalledWith("country:a");
    expect(deps.setLastLoginAt).toHaveBeenCalledWith("country:a", expect.any(String));
  });

  it("rejects pending registration during login", async () => {
    const deps = makeDeps({ loginCountry: makeLoginCountry({ isRegistrationApproved: false }) });
    const app = makeApp(deps);

    const response = await request(app, "/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ countryId: "country:a", password: "password1", rememberMe: false }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "REGISTRATION_PENDING_APPROVAL" });
  });

  it("approves pending registrations and removes queued approval notification", async () => {
    const deps = makeDeps({ reviewCountry: makeCountryRecord({ isRegistrationApproved: false }) });
    const app = makeApp(deps);

    const response = await request(app, "/admin/registrations/country:a/review", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approve: true }),
    });

    expect(response.status).toBe(200);
    expect(deps.approveCountryRegistration).toHaveBeenCalledWith("country:a");
    expect(deps.removeQueuedUiNotification).toHaveBeenCalledWith("registration-approval:country:a");
    expect(deps.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "NEWS_EVENT" }));
  });

  it("rejects pending registrations and cleans assets plus world state", async () => {
    const deps = makeDeps({
      reviewCountry: makeCountryRecord({ isRegistrationApproved: false }),
      world: {
        resourcesByCountry: { "country:a": makeResources() },
        hexOwner: { "province:a": "country:a", "province:b": "country:b" },
        colonyProgressByRegion: { "province:a": { "country:a": 10 }, "province:b": { "country:a": 5, "country:b": 8 } },
        civilianUnitsById: {
          "civilian:starter:country_a": makeColonizer({ countryId: "country:a" }),
          "civilian:starter:country_b": makeColonizer({ id: "civilian:starter:country_b", countryId: "country:b" }),
        },
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/admin/registrations/country:a/review", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approve: false }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, approved: false, countryId: "country:a" });
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/flag.png?v=1");
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/crest.png?v=1");
    expect(deps.deleteCountry).toHaveBeenCalledWith("country:a");
    expect(deps.world.resourcesByCountry["country:a"]).toBeUndefined();
    expect(deps.world.civilianUnitsById).toEqual({
      "civilian:starter:country_b": expect.objectContaining({ countryId: "country:b" }),
    });
    expect(deps.world.hexOwner).toEqual({ "province:b": "country:b" });
    expect(deps.world.colonyProgressByRegion).toEqual({ "province:b": { "country:b": 8 } });
    expect(deps.removeCountryFromActiveColonizationIndex).toHaveBeenCalledWith("country:a");
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledWith({ mask: 15 });
  });
});

function makeApp(deps: AuthRegistrationRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerAuthRegistrationRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  adminCountryCount?: number;
  requireApproval?: boolean;
  uploadFiles?: {
    flag?: Express.Multer.File[];
    crest?: Express.Multer.File[];
    cultureLogo?: Express.Multer.File[];
    religionLogo?: Express.Multer.File[];
  };
  createCountry?: AuthRegistrationRoutesDependencies["createCountry"];
  loginCountry?: AuthRegistrationCountryRecord | null;
  reviewCountry?: AdminCountryDbRecord | null;
  world?: Partial<AuthRegistrationWorldState>;
}): AuthRegistrationRoutesDependencies & { world: AuthRegistrationWorldState } {
  const world: AuthRegistrationWorldState = {
    resourcesByCountry: {},
    hexOwner: {},
    colonyProgressByRegion: {},
    civilianUnitsById: {},
    ...options?.world,
  };
  const deps: AuthRegistrationRoutesDependencies & { world: AuthRegistrationWorldState } = {
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
    flagImageRule: { maxWidth: 192, maxHeight: 128 },
    crestImageRule: { maxWidth: 128, maxHeight: 146 },
    identityLogoImageRule: { maxWidth: 64, maxHeight: 64 },
    masks: { resourcesByCountry: 1, hexOwner: 2, colonyProgressByRegion: 4, unitEquipmentState: 8 },
    getTurnId: () => 4,
    getWorldBase: () => world as WorldBase & AuthRegistrationWorldState,
    getGameSettings: () => ({
      content: {
        cultureGroups: [makeContentEntry("culture_group:frontier")],
        religionGroups: [makeContentEntry("religion_group:shrines")],
        races: [makeContentEntry("race:default")],
        cultures: [],
        religions: [],
      },
    }) as never,
    countryIdentityNameExists: vi.fn(async () => false),
    getRegistrationRequiresAdminApproval: () => options?.requireApproval ?? false,
    getInitialColonizationPoints: () => 7,
    getInitialConstructionPoints: () => 9,
    countAdminCountries: vi.fn(async () => options?.adminCountryCount ?? 0),
    createCountry: vi.fn(options?.createCountry ?? (async (data) => makeCountryRecord({
      id: "country:new",
      name: data.name,
      color: data.color,
      flagUrl: data.flagUrl,
      crestUrl: data.crestUrl,
      cultureId: data.cultureId,
      cultureName: data.cultureName,
      cultureColor: data.cultureColor,
      cultureLogoUrl: data.cultureLogoUrl,
      religionId: data.religionId,
      religionName: data.religionName,
      religionColor: data.religionColor,
      religionLogoUrl: data.religionLogoUrl,
      cultureGroupId: data.cultureGroupId,
      religionGroupId: data.religionGroupId,
      raceId: data.raceId,
      isAdmin: data.isAdmin,
      isRegistrationApproved: data.isRegistrationApproved,
    }))),
    findCountryForLogin: vi.fn(async () => options?.loginCountry ?? makeLoginCountry()),
    findCountry: vi.fn(async () => (options?.reviewCountry === undefined ? makeCountryRecord() : options.reviewCountry)),
    approveCountryRegistration: vi.fn(async () => makeCountryRecord({ isRegistrationApproved: true })),
    findFullCountry: vi.fn(async () => makeLoginCountry()),
    deleteCountry: vi.fn(async () => undefined),
    countryFromDb: (row) => makeCountry(row),
    hashPassword: vi.fn(async (password) => `hash:${password}`),
    comparePassword: vi.fn(async (password) => password === "password1"),
    createAuthToken: ({ countryId }, rememberMe) => `token:${countryId}:${rememberMe ? "remember" : "session"}`,
    getCountryBlockInfo: vi.fn(() => ({ blocked: false, reason: null, blockedUntilTurn: null, blockedUntilAt: null })),
    cleanupExpiredPunishments: vi.fn(async () => undefined),
    validateImageRule: vi.fn(() => true),
    removeUploadedFile: vi.fn(),
    removeUploadedByUrl: vi.fn(),
    makeVersionedUploadUrl: (relativePath) => `/scenario-assets/demo/assets/uploads/${relativePath}?v=1`,
    invalidateCountryQueryCache: vi.fn(),
    ensureCountryInWorldBase: vi.fn(),
    createStarterColonizerForCountry: vi.fn((countryId) => {
      world.civilianUnitsById[`civilian:starter:${countryId.replace(/[^a-zA-Z0-9_-]/g, "_")}`] = makeColonizer({ countryId });
      return true;
    }),
    addCountryToEconomyTick: vi.fn(),
    removeCountryFromEconomyTick: vi.fn(),
    removeCountryFromActiveColonizationIndex: vi.fn(),
    setLastLoginAt: vi.fn(),
    savePersistentState: vi.fn(),
    cloneWorldBaseSectionSnapshot: (mask) => ({ mask }),
    broadcastWorldDeltaFromSectionSnapshot: vi.fn(),
    makeRegistrationApprovalUiNotification: (country) => ({
      id: `registration-approval:${country.id}`,
      category: "registration",
      createdAt: "now",
      action: { type: "registration-approval", country },
    }),
    sendUiNotificationToAdmins: vi.fn(),
    removeQueuedUiNotification: vi.fn(),
    makeOfficialNews: (input) => makeNews(input.title),
    broadcast: vi.fn(),
    getClientEventLogRetentionTurns: () => 12,
  };
  return deps;
}

function makeResources(): ResourceTotals {
  return { ducats: 20, gold: 80, culture: 5, science: 5, religion: 5, construction: 9, colonization: 7 };
}

function makeRegisterPayload(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    countryName: "Bohemia",
    countryColor: "#123456",
    cultureGroupId: "culture_group:frontier",
    cultureName: "Bohemian",
    cultureColor: "#4ade80",
    religionGroupId: "religion_group:shrines",
    religionName: "Bohemian Rites",
    religionColor: "#a78bfa",
    raceId: "race:default",
    password: "password1",
    ...overrides,
  };
}

function makeColonizer(overrides?: Partial<WorldBase["civilianUnitsById"][string]>): WorldBase["civilianUnitsById"][string] {
  return {
    id: "civilian:starter:country_a",
    countryId: "country:a",
    type: "colonizer",
    hexId: "hex:0:0",
    status: "idle",
    movementPoints: 2,
    maxMovementPoints: 2,
    path: [],
    targetHexId: null,
    createdTurnId: 4,
    lastMovedTurnId: null,
    ...overrides,
  };
}

function makeCountryRecord(overrides?: Partial<AdminCountryDbRecord>): AdminCountryDbRecord {
  return {
    id: "country:a",
    name: "Country A",
    color: "#112233",
    flagUrl: "/scenario-assets/demo/assets/uploads/flag.png?v=1",
    crestUrl: "/scenario-assets/demo/assets/uploads/crest.png?v=1",
    cultureId: "culture:country:a",
    cultureName: "Culture A",
    cultureColor: "#4ade80",
    cultureLogoUrl: null,
    religionId: "religion:country:a",
    religionName: "Religion A",
    religionColor: "#a78bfa",
    religionLogoUrl: null,
    cultureGroupId: "culture_group:frontier",
    religionGroupId: "religion_group:shrines",
    raceId: "race:default",
    isAdmin: false,
    isLocked: false,
    blockedUntilTurn: null,
    blockedUntilAt: null,
    lockReason: null,
    ignoreUntilTurn: null,
    eventLogRetentionTurns: null,
    isRegistrationApproved: false,
    ...overrides,
  };
}

function makeLoginCountry(overrides?: Partial<AuthRegistrationCountryRecord>): AuthRegistrationCountryRecord {
  return {
    ...makeCountryRecord({ isRegistrationApproved: true }),
    passwordHash: "hash:password1",
    ...overrides,
  };
}

function makeContentEntry(id: string) {
  return {
    id,
    name: id,
    description: "",
    color: "#ffffff",
    logoUrl: null,
    malePortraitUrl: null,
    femalePortraitUrl: null,
  };
}

function makeCountry(row: AdminCountryDbRecord): Country {
  return {
    ...row,
    blockedUntilAt: row.blockedUntilAt ? row.blockedUntilAt.toISOString() : null,
    lockReason: row.lockReason ?? null,
  };
}

function makeNews(title: string): Extract<WsOutMessage, { type: "NEWS_EVENT" }>["event"] {
  return {
    id: "news:test",
    turn: 4,
    timestamp: "now",
    category: "politics",
    title,
    message: title,
    countryId: "country:a",
    priority: "medium",
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
