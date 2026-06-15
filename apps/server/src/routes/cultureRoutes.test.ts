import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import { registerCultureRoutes, type CultureRoutesDependencies } from "./cultureRoutes";
import type { ContentEntryRouteItem } from "./contentEntryRoutes";

describe("cultureRoutes", () => {
  it("creates culture entries with culture/cultures response shape", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/content/cultures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: " Humans ", description: " People ", color: "#ffffff" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      culture: { id: "id-1", name: "Humans", description: "People", color: "#ffffff", logoUrl: null },
      cultures: [{ id: "id-1", name: "Humans" }],
    });
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("rejects duplicate culture names", async () => {
    const deps = makeDeps({ cultures: [{ id: "culture-a", name: "Humans", color: "#fff" }] });
    const app = makeApp(deps);

    const response = await request(app, "/admin/content/cultures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "humans", color: "#000" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "CULTURE_NAME_EXISTS" });
  });

  it("replaces culture logo and removes the previous upload", async () => {
    const deps = makeDeps({
      singleFile: makeFile("logo.png"),
      cultures: [{ id: "culture-a", name: "A", color: "#fff", logoUrl: "/scenario-assets/demo/assets/uploads/old.png?v=1" }],
    });
    const app = makeApp(deps);

    const response = await request(app, "/admin/content/cultures/culture-a/logo", { method: "PATCH" });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ culture: { logoUrl: "/scenario-assets/demo/assets/uploads/cultures/logo.png?v=1" } });
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/old.png?v=1");
  });

  it("removes culture-owned uploads when deleting cultures", async () => {
    const deps = makeDeps({
      cultures: [
        {
          id: "culture-a",
          name: "A",
          color: "#fff",
          logoUrl: "/scenario-assets/demo/assets/uploads/logo.png?v=1",
          malePortraitUrl: "/scenario-assets/demo/assets/uploads/male.png?v=1",
          femalePortraitUrl: "/scenario-assets/demo/assets/uploads/female.png?v=1",
        },
      ],
    });
    const app = makeApp(deps);

    const response = await request(app, "/admin/content/cultures/culture-a", { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/logo.png?v=1");
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/male.png?v=1");
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/female.png?v=1");
  });
});

function makeApp(deps: CultureRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerCultureRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  cultures?: ContentEntryRouteItem[];
  singleFile?: Express.Multer.File;
}): CultureRoutesDependencies {
  const cultures = options?.cultures ?? [];
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
    parseCulturePayload: (body) => {
      const payload = body as { name?: unknown; color?: unknown; description?: unknown };
      return typeof payload.name === "string" && typeof payload.color === "string"
        ? {
            success: true,
            data: {
              name: payload.name,
              color: payload.color,
              description: typeof payload.description === "string" ? payload.description : null,
            },
          }
        : { success: false, issues: [] };
    },
    getCultures: () => cultures,
    cultureNameExists: (name, excludeId) =>
      cultures.some((culture) => culture.id !== excludeId && culture.name.trim().toLowerCase() === name.toLowerCase()),
    savePersistentState: vi.fn(),
    validateImageDimensions: () => true,
    removeUploadedFile: vi.fn(),
    removeUploadedByUrl: vi.fn(),
    makeVersionedUploadUrl: (relativePath) => `/scenario-assets/demo/assets/uploads/${relativePath}?v=1`,
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
