import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  infrastructureTransitAgreementCreateSchema,
  registerInfrastructureRoutes,
  type InfrastructureConstructionRightsEntry,
  type InfrastructureRoutesDependencies,
  type InfrastructureTransitAgreementEntry,
} from "./infrastructureRoutes";

describe("infrastructureRoutes", () => {
  it("validates transit agreement create payloads", () => {
    expect(infrastructureTransitAgreementCreateSchema.safeParse({
      toCountryId: "country:b",
      transportModes: ["land"],
    }).success).toBe(true);
    expect(infrastructureTransitAgreementCreateSchema.safeParse({
      toCountryId: "country:b",
      transportModes: [],
    }).success).toBe(false);
  });

  it("lists only visible transit agreements for a country", async () => {
    const deps = makeDeps({
      transitAgreements: {
        visibleFrom: makeAgreement({ id: "visibleFrom", fromCountryId: "country:a", toCountryId: "country:b", updatedAt: "2026-01-02" }),
        visibleTo: makeAgreement({ id: "visibleTo", fromCountryId: "country:c", toCountryId: "country:a", updatedAt: "2026-01-03" }),
        hidden: makeAgreement({ id: "hidden", fromCountryId: "country:c", toCountryId: "country:d", updatedAt: "2026-01-04" }),
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/infrastructure-transit-agreements");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      agreements: [{ id: "visibleTo" }, { id: "visibleFrom" }],
    });
    expect(deps.ensureMarketModelReady).toHaveBeenCalledOnce();
  });

  it("creates transit agreements after country existence validation", async () => {
    const transitAgreements: Record<string, InfrastructureTransitAgreementEntry> = {};
    const deps = makeDeps({ transitAgreements });
    const app = makeApp(deps);

    const response = await request(app, "/infrastructure-transit-agreements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toCountryId: "country:b",
        transportModes: ["land", "sea"],
      }),
    });

    expect(response.status).toBe(201);
    expect(transitAgreements["agreement-1"]).toMatchObject({
      id: "agreement-1",
      fromCountryId: "country:a",
      toCountryId: "country:b",
      transportModes: ["land", "sea"],
      active: true,
      bilateral: true,
    });
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("prevents non-owners from updating transit agreements", async () => {
    const deps = makeDeps({
      transitAgreements: {
        ownedByOther: makeAgreement({ id: "ownedByOther", fromCountryId: "country:b", toCountryId: "country:a" }),
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/infrastructure-transit-agreements/ownedByOther", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: false }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "TRANSIT_AGREEMENT_OWNER_ONLY" });
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });
});

function makeApp(deps: InfrastructureRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerInfrastructureRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  transitAgreements?: Record<string, InfrastructureTransitAgreementEntry>;
  constructionRights?: Record<string, InfrastructureConstructionRightsEntry>;
  isAdmin?: boolean;
}): InfrastructureRoutesDependencies {
  return {
    routeAuth: createRouteAuth(options?.isAdmin ?? false),
    createId: () => "agreement-1",
    ensureMarketModelReady: vi.fn(),
    getTransitAgreementsById: () => options?.transitAgreements ?? {},
    getConstructionRightsById: () => options?.constructionRights ?? {},
    countryIdsExist: vi.fn().mockImplementation(async (countryIds: string[]) => new Set(countryIds)),
    normalizeTransportModes: (input) => [...new Set(input)],
    savePersistentState: vi.fn(),
  };
}

function makeAgreement(overrides?: Partial<InfrastructureTransitAgreementEntry>): InfrastructureTransitAgreementEntry {
  return {
    id: "agreement",
    fromCountryId: "country:a",
    toCountryId: "country:b",
    transportModes: ["land"],
    active: true,
    bilateral: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

function createRouteAuth(isAdmin: boolean): RouteAuth {
  return {
    requireAuth: vi.fn().mockReturnValue({ countryId: "country:a", isAdmin }),
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
