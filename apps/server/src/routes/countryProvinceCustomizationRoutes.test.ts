import express from "express";
import type { EventLogEntry, ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  provinceRenameSchema,
  registerCountryProvinceCustomizationRoutes,
  type CountryProvinceCustomizationRoutesDependencies,
  type CountryProvinceCustomizationWorldState,
} from "./countryProvinceCustomizationRoutes";

const resources: ResourceTotals = {
  ducats: 50,
  gold: 0,
  culture: 0,
  science: 0,
  religion: 0,
  construction: 0,
  colonization: 0,
};

describe("countryProvinceCustomizationRoutes", () => {
  it("validates province rename payloads", () => {
    expect(provinceRenameSchema.safeParse({ provinceId: "province:a", provinceName: "Name" }).success).toBe(true);
    expect(provinceRenameSchema.safeParse({ provinceId: "province:a", provinceName: "" }).success).toBe(false);
  });

  it("renames an owned province, charges ducats, and broadcasts news", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/country/province-rename", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provinceId: "province:a", provinceName: "New Name" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      provinceId: "province:a",
      provinceName: "New Name",
      chargedDucats: 25,
      resources: { ducats: 25 },
    });
    expect(deps.world.provinceNameById["province:a"]).toBe("New Name");
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledWith({ mask: 3 });
    expect(deps.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "NEWS_EVENT" }));
  });

  it("rejects insufficient ducats without mutating world state", async () => {
    const deps = makeDeps({
      resourcesByCountry: { "country:a": { ...resources, ducats: 10 } },
    });
    const app = makeApp(deps);

    const response = await request(app, "/country/province-rename", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provinceId: "province:a", provinceName: "New Name" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INSUFFICIENT_DUCATS", required: 25, available: 10 });
    expect(deps.world.provinceNameById["province:a"]).toBeUndefined();
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });

  it("rejects missing provinces after ownership validation", async () => {
    const deps = makeDeps(undefined, false);
    const app = makeApp(deps);

    const response = await request(app, "/country/province-rename", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provinceId: "province:a", provinceName: "New Name" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "PROVINCE_NOT_FOUND" });
  });
});

function makeApp(deps: CountryProvinceCustomizationRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerCountryProvinceCustomizationRoutes(app, deps);
  return app;
}

function makeDeps(
  worldOverrides?: Partial<CountryProvinceCustomizationWorldState>,
  provinceExists = true,
): CountryProvinceCustomizationRoutesDependencies & { world: CountryProvinceCustomizationWorldState } {
  const world: CountryProvinceCustomizationWorldState = {
    provinceOwner: { "province:a": "country:a" },
    resourcesByCountry: { "country:a": { ...resources } },
    provinceNameById: {},
    ...worldOverrides,
  };
  return {
    world,
    routeAuth: createRouteAuth(),
    masks: {
      resourcesByCountry: 1,
      provinceNameById: 2,
    },
    getTurnId: () => 6,
    getWorldBase: () => world,
    getProvinceRenameDucatsCost: () => 25,
    provinceExists: () => provinceExists,
    ensureCountryInWorldBase: vi.fn(),
    cloneWorldBaseSectionSnapshot: (mask) => ({ mask }),
    savePersistentState: vi.fn(),
    broadcastWorldDeltaFromSectionSnapshot: vi.fn(),
    makeOfficialNews: (input) => makeNews(input.title),
    broadcast: vi.fn(),
  };
}

function makeNews(title: string): EventLogEntry {
  return {
    id: "news:test",
    turn: 6,
    timestamp: "now",
    category: "politics",
    title,
    message: title,
    countryId: "country:a",
    priority: "low",
    visibility: "public",
  };
}

function createRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn().mockReturnValue({ countryId: "country:a", isAdmin: false }),
    requireAuthOrCleanup: vi.fn(),
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
