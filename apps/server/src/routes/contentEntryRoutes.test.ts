import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import { registerContentEntryRoutes, type ContentEntryRouteItem, type ContentEntryRoutesDependencies } from "./contentEntryRoutes";

describe("contentEntryRoutes", () => {
  it("creates content entries through sanitized payloads", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/content/entries/cultures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: " Elves ", description: " Forest ", color: "#00ff00", extra: "kept" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      item: { id: "id-1", name: "Elves", description: "Forest", color: "#00ff00", extra: "kept" },
    });
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("updates military content and broadcasts refreshed stats delta", async () => {
    const deps = makeDeps({
      items: { battalions: [{ id: "infantry", name: "Infantry", color: "#fff" }] },
      militaryKinds: new Set(["battalions"]),
    });
    const app = makeApp(deps);

    const response = await request(app, "/admin/content/entries/battalions/infantry", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Heavy Infantry", color: "#111" }),
    });

    expect(response.status).toBe(200);
    expect(deps.cloneMilitaryContentSnapshot).toHaveBeenCalledOnce();
    expect(deps.refreshDivisionStatsFromTemplates).toHaveBeenCalledOnce();
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledOnce();
  });

  it("uploads and replaces content logos with cleanup", async () => {
    const deps = makeDeps({
      singleFile: makeFile("culture.png"),
      items: { cultures: [{ id: "culture-a", name: "A", color: "#fff", logoUrl: "/scenario-assets/demo/assets/uploads/old.png?v=1" }] },
    });
    const app = makeApp(deps);

    const response = await request(app, "/admin/content/entries/cultures/culture-a/logo", { method: "PATCH" });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      item: { logoUrl: "/scenario-assets/demo/assets/uploads/cultures/culture.png?v=1" },
    });
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/old.png?v=1");
  });

  it("removes entry-owned uploads when deleting entries", async () => {
    const deps = makeDeps({
      items: {
        races: [
          {
            id: "race-a",
            name: "Race",
            color: "#fff",
            logoUrl: "/scenario-assets/demo/assets/uploads/logo.png?v=1",
            malePortraitUrl: "/scenario-assets/demo/assets/uploads/male.png?v=1",
            femalePortraitUrl: "/scenario-assets/demo/assets/uploads/female.png?v=1",
          },
        ],
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/admin/content/entries/races/race-a", { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/logo.png?v=1");
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/male.png?v=1");
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/female.png?v=1");
  });
});

function makeApp(deps: ContentEntryRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerContentEntryRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  items?: Record<string, ContentEntryRouteItem[]>;
  singleFile?: Express.Multer.File;
  militaryKinds?: Set<string>;
}): ContentEntryRoutesDependencies {
  const items = options?.items ?? { cultures: [] };
  let nextId = 1;
  return {
    routeAuth: createAllowedRouteAuth(),
    upload: {
      single: () => (req, _res, next) => {
        req.file = options?.singleFile;
        next();
      },
    },
    createId: () => `id-${nextId++}`,
    parseContentKind: (raw) => ({ success: true, data: raw }),
    parseContentPayload: (body) => {
      const payload = body as { name?: unknown; color?: unknown; description?: unknown; extra?: unknown };
      return typeof payload.name === "string" && typeof payload.color === "string"
        ? {
            success: true,
            data: {
              name: payload.name,
              color: payload.color,
              description: typeof payload.description === "string" ? payload.description : null,
              extra: payload.extra,
            },
          }
        : { success: false, issues: [] };
    },
    parseRacePortraitSlot: (raw) =>
      raw === "male" || raw === "female" ? { success: true, data: raw } : { success: false },
    getEntriesByKind: (kind) => {
      items[kind] ??= [];
      return items[kind];
    },
    getRaceEntries: () => {
      items.races ??= [];
      return items.races;
    },
    contentNameExists: (kind, name, excludeId) =>
      (items[kind] ?? []).some((entry) => entry.id !== excludeId && entry.name.toLowerCase() === name.toLowerCase()),
    sanitizeContentEntryByKind: (_kind, payload) => ({ extra: payload.extra }),
    isMilitaryContentKind: (kind) => Boolean(options?.militaryKinds?.has(kind)),
    cloneMilitaryContentSnapshot: vi.fn(() => ({ snapshot: true })),
    refreshDivisionStatsFromTemplates: vi.fn(),
    broadcastWorldDeltaFromSectionSnapshot: vi.fn(),
    savePersistentState: vi.fn(),
    removeUploadedFile: vi.fn(),
    removeUploadedByUrl: vi.fn(),
    makeVersionedUploadUrl: (relativePath) => `/scenario-assets/demo/assets/uploads/${relativePath}?v=1`,
    resolveContentUploadUrlSegment: (kind) => kind,
    validateContentLogo: () => ({ ok: true }),
    validateRacePortrait: () => true,
  };
}

function createAllowedRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn(),
    requireAuthOrCleanup: vi.fn(),
    requireAdmin: vi.fn().mockResolvedValue({ countryId: "admin-country" }),
    requireAdminOrCleanup: vi.fn().mockResolvedValue({ countryId: "admin-country" }),
    requireSelfOrAdmin: vi.fn(),
  } as unknown as RouteAuth;
}

function makeFile(filename: string): Express.Multer.File {
  return { filename, path: filename } as Express.Multer.File;
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
