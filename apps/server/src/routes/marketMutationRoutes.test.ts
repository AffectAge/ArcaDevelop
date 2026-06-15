import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  marketPatchSchema,
  registerMarketMutationRoutes,
  type MarketMutationMarket,
  type MarketMutationRoutesDependencies,
} from "./marketMutationRoutes";

describe("marketMutationRoutes", () => {
  it("validates market patch payloads", () => {
    expect(marketPatchSchema.safeParse({ name: "New Market", visibility: "public" }).success).toBe(true);
    expect(marketPatchSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("removes uploaded file when actor is not market owner", async () => {
    const uploadedFile = makeFile();
    const deps = makeDeps({ actorCountryId: "country:b", uploadedFile });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Blocked" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "MARKET_OWNER_ONLY" });
    expect(deps.removeUploadedFile).toHaveBeenCalledWith(uploadedFile);
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });

  it("removes uploaded file when image dimensions fail", async () => {
    const uploadedFile = makeFile();
    const deps = makeDeps({ uploadedFile, imageValid: false });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Market" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "IMAGE_DIMENSIONS_TOO_LARGE", field: "marketLogo", max: "256x256" });
    expect(deps.removeUploadedFile).toHaveBeenCalledWith(uploadedFile);
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });

  it("updates owned market fields and replaces logo cleanup on success", async () => {
    const market = makeMarket({ logoUrl: "/scenario-assets/demo/assets/uploads/old.png" });
    const uploadedFile = makeFile({ filename: "new.png" });
    const deps = makeDeps({ market, uploadedFile });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: " New Name ", visibility: "public", capitalProvinceId: "province:a" }),
    });

    expect(response.status).toBe(200);
    expect(market).toMatchObject({
      id: "market:a",
      name: "New Name",
      visibility: "public",
      capitalProvinceId: "province:a",
      logoUrl: "/scenario-assets/demo/assets/uploads/markets/new.png?v=1",
    });
    expect(deps.removeUploadedByUrl).toHaveBeenCalledWith("/scenario-assets/demo/assets/uploads/old.png");
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({ market: { id: "market:a" } });
  });

  it("rejects market capital outside owner provinces and cleans upload", async () => {
    const uploadedFile = makeFile();
    const deps = makeDeps({ uploadedFile, provinceOwner: "country:b" });
    const app = makeApp(deps);

    const response = await request(app, "/markets/market:a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ capitalProvinceId: "province:b" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_MARKET_CAPITAL_PROVINCE" });
    expect(deps.removeUploadedFile).toHaveBeenCalledWith(uploadedFile);
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });
});

function makeApp(deps: MarketMutationRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerMarketMutationRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  actorCountryId?: string;
  market?: MarketMutationMarket;
  uploadedFile?: Express.Multer.File;
  imageValid?: boolean;
  provinceOwner?: string | null;
}): MarketMutationRoutesDependencies {
  return {
    routeAuth: createRouteAuth(options?.actorCountryId ?? "country:a"),
    upload: {
      single: () => (req, _res, next) => {
        req.file = options?.uploadedFile;
        next();
      },
    },
    getMarketById: (marketId) => marketId === "market:a" ? (options?.market ?? makeMarket()) : null,
    normalizeMarketVisibility: (value) => value === "public" ? "public" : "private",
    getProvinceOwner: () => options?.provinceOwner ?? "country:a",
    validateImageDimensions: vi.fn().mockReturnValue(options?.imageValid ?? true),
    removeUploadedFile: vi.fn(),
    removeUploadedByUrl: vi.fn(),
    makeVersionedUploadUrl: (relativePath) => `/scenario-assets/demo/assets/uploads/${relativePath}?v=1`,
    savePersistentState: vi.fn(),
    buildMarketDetailsResponse: vi.fn(async (marketId) => ({ market: { id: marketId } })),
  };
}

function makeMarket(overrides?: Partial<MarketMutationMarket>): MarketMutationMarket {
  return {
    id: "market:a",
    name: "Market A",
    logoUrl: null,
    ownerCountryId: "country:a",
    capitalProvinceId: null,
    visibility: "private",
    ...overrides,
  };
}

function makeFile(overrides?: Partial<Express.Multer.File>): Express.Multer.File {
  return {
    fieldname: "marketLogo",
    originalname: "logo.png",
    encoding: "7bit",
    mimetype: "image/png",
    size: 123,
    destination: "",
    filename: "logo.png",
    path: "",
    buffer: Buffer.from(""),
    stream: undefined as unknown as Express.Multer.File["stream"],
    ...overrides,
  };
}

function createRouteAuth(countryId: string): RouteAuth {
  return {
    requireAuth: vi.fn(),
    requireAuthOrCleanup: vi.fn().mockReturnValue({ countryId, isAdmin: false }),
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
