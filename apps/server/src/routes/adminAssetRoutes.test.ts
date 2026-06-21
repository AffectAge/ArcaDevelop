import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import { registerAdminAssetRoutes, type AdminAssetRoutesDependencies } from "./adminAssetRoutes";

describe("adminAssetRoutes", () => {
  it("uploads civilopedia images after admin auth", async () => {
    const deps = makeDeps({ singleFile: makeFile("guide.png") });
    const app = makeApp(deps);

    const response = await request(app, "/admin/civilopedia/image", { method: "PATCH" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ imageUrl: "/scenario-assets/demo/assets/uploads/civilopedia/guide.png?v=1" });
    expect(deps.removeUploadedFile).not.toHaveBeenCalled();
  });

  it("removes civilopedia upload when dimensions are invalid", async () => {
    const file = makeFile("too-large.png");
    const deps = makeDeps({ singleFile: file, validateImageDimensions: () => false });
    const app = makeApp(deps);

    const response = await request(app, "/admin/civilopedia/inline-image", { method: "PATCH" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "IMAGE_DIMENSIONS_TOO_LARGE", max: "64x64" });
    expect(deps.removeUploadedFile).toHaveBeenCalledWith(file);
  });

  it("updates ui background and removes previous background", async () => {
    const deps = makeDeps({ singleFile: makeFile("background.png"), uiBackgroundUrl: "/scenario-assets/demo/assets/uploads/old-bg.png?v=1" });
    const app = makeApp(deps);

    const response = await request(app, "/admin/ui-background", { method: "PATCH" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      map: { backgroundImageUrl: "/scenario-assets/demo/assets/uploads/ui-backgrounds/background.png?v=1" },
    });
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/old-bg.png?v=1");
    expect(deps.afterUiBackgroundUpdated).toHaveBeenCalledWith("admin-country");
  });
});

function makeApp(deps: AdminAssetRoutesDependencies): express.Express {
  const app = express();
  registerAdminAssetRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  singleFile?: Express.Multer.File;
  fieldFiles?: Record<string, Express.Multer.File>;
  validateImageDimensions?: (file: Express.Multer.File, maxDimension: number) => boolean;
  uiBackgroundUrl?: string | null;
}): AdminAssetRoutesDependencies {
  let uiBackgroundUrl = options?.uiBackgroundUrl ?? null;
  return {
    routeAuth: createAllowedRouteAuth(),
    upload: {
      single: () => (req, _res, next) => {
        req.file = options?.singleFile;
        next();
      },
      fields: () => (req, _res, next) => {
        req.files = Object.fromEntries(
          Object.entries(options?.fieldFiles ?? {}).map(([key, file]) => [key, [file]]),
        );
        next();
      },
    },
    validateImageDimensions: vi.fn(options?.validateImageDimensions ?? (() => true)),
    removeUploadedFile: vi.fn(),
    removeUploadedFiles: vi.fn(),
    removeUploadedByUrl: vi.fn(),
    makeVersionedUploadUrl: (relativePath) => `/scenario-assets/demo/assets/uploads/${relativePath}?v=1`,
    getUiBackgroundUrl: () => uiBackgroundUrl,
    setUiBackgroundUrl: (url) => {
      uiBackgroundUrl = url;
    },
    getMapSettings: () => ({ backgroundImageUrl: uiBackgroundUrl }),
    savePersistentState: vi.fn(),
    afterUiBackgroundUpdated: vi.fn(),
  };
}

function createAllowedRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn(),
    requireAuthOrCleanup: vi.fn(),
    requireAdmin: vi.fn(),
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
