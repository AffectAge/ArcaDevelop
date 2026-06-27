import express from "express";
import type { BuildingInstance, Order, ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  buildCancelSchema,
  registerCountryBuildRoutes,
  type CountryBuildRoutesDependencies,
  type CountryBuildWorldState,
} from "./countryBuildRoutes";

const baseResources: ResourceTotals = {
  ducats: 100,
  gold: 0,
  culture: 0,
  science: 0,
  religion: 0,
  construction: 100,
  colonization: 0,
};

describe("countryBuildRoutes", () => {
  it("validates cancel payloads", () => {
    expect(buildCancelSchema.safeParse({ orderId: "order:a" }).success).toBe(true);
    expect(buildCancelSchema.safeParse({ regionId: "region:a", queueId: "queue:a" }).success).toBe(true);
    expect(buildCancelSchema.safeParse({ regionId: "region:a" }).success).toBe(false);
  });

  it("cancels queued construction and pending build orders", async () => {
    const order = makeOrder({ id: "order:a" });
    const orders = new Map([["player:a", [order]]]);
    const deps = makeDeps({
      orders,
      world: {
        regionConstructionQueueByRegion: {
          "region:a": [
            {
              queueId: "queue:a",
              requestedByCountryId: "country:a",
              buildingId: "building:farm",
              targetHexId: "hex:0:0",
              owner: { type: "state", countryId: "country:a" },
              progressConstruction: 0,
              costConstruction: 10,
              costDucats: 1,
              createdTurnId: 7,
            },
          ],
        },
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/country/build/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ regionId: "region:a", queueId: "queue:a", orderId: "order:a" }),
    });

    expect(response.status).toBe(200);
    expect(deps.world.regionConstructionQueueByRegion["region:a"]).toEqual([]);
    expect(deps.removeOrderFromTurnIndexes).toHaveBeenCalledWith(order);
    expect(deps.dropTurnOrderIndexes).toHaveBeenCalledWith(7);
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
  });

  it("demolishes an owned building instance and removes stale upgrade data", async () => {
    const instance = makeBuildingInstance({ instanceId: "instance:a", level: 2 });
    const deps = makeDeps({
      world: {
        regionBuildingsByRegion: { "region:a": [instance] },
        regionConstructionQueueByRegion: {
          "region:a": [
            {
              queueId: "queue:upgrade",
              requestedByCountryId: "country:a",
              buildingId: "building:farm",
              targetHexId: "hex:0:0",
              owner: { type: "state", countryId: "country:a" },
              projectType: "upgrade",
              targetInstanceId: "instance:a",
              progressConstruction: 0,
              costConstruction: 10,
              costDucats: 1,
              createdTurnId: 7,
            },
          ],
        },
        regionBuildingDucatsByRegion: { "region:a": { "building:farm": 12 } },
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/country/build/demolish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ regionId: "region:a", buildingId: "building:farm", instanceId: "instance:a" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        ok: true,
        removedInstanceId: "instance:a",
        removedLevels: 2,
        demolitionCostConstruction: 9,
        constructionLeft: 91,
      }),
    );
    expect(deps.world.regionBuildingsByRegion["region:a"]).toEqual([]);
    expect(deps.world.regionConstructionQueueByRegion["region:a"]).toEqual([]);
    expect(deps.world.regionBuildingDucatsByRegion["region:a"]).toEqual({});
  });

  it("queues a building upgrade for an owned instance", async () => {
    const deps = makeDeps({
      world: {
        regionBuildingsByRegion: {
          "region:a": [makeBuildingInstance({ instanceId: "instance:a", level: 1 })],
        },
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/country/build/upgrade-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ regionId: "region:a", buildingId: "building:farm", instanceId: "instance:a" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        queueId: "id-1",
        currentLevel: 1,
        targetLevel: 2,
        upgradeCostConstruction: 20,
        upgradeCostDucats: 4,
      }),
    );
    expect(deps.world.regionConstructionQueueByRegion["region:a"]).toEqual([
      expect.objectContaining({
        queueId: "id-1",
        projectType: "upgrade",
        targetInstanceId: "instance:a",
      }),
    ]);
  });

  it("updates manual work state and building custom name", async () => {
    const deps = makeDeps({
      world: {
        regionBuildingsByRegion: {
          "region:a": [makeBuildingInstance({ instanceId: "instance:a" })],
        },
      },
    });
    const app = makeApp(deps);

    const manualResponse = await request(app, "/country/build/manual-work-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        regionId: "region:a",
        buildingId: "building:farm",
        instanceId: "instance:a",
        enabled: false,
      }),
    });
    const nameResponse = await request(app, "/country/build/custom-name", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        regionId: "region:a",
        buildingId: "building:farm",
        instanceId: "instance:a",
        customName: "  Old Mill  ",
      }),
    });

    expect(manualResponse.status).toBe(200);
    expect(nameResponse.status).toBe(200);
    expect(deps.world.regionBuildingsByRegion["region:a"]).toEqual([
      expect.objectContaining({
        manualWorkEnabled: false,
        isInactive: true,
        inactiveReason: "Отключено вручную",
        customName: "Old Mill",
      }),
    ]);
  });

  it("rejects foreign province build changes", async () => {
    const deps = makeDeps({
      world: {
        regionOwner: { "region:a": "country:b" },
        regionController: { "region:a": "country:b" },
        regionBuildingsByRegion: {
          "region:a": [makeBuildingInstance({ instanceId: "instance:a" })],
        },
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/country/build/auto-upgrade-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        regionId: "region:a",
        buildingId: "building:farm",
        instanceId: "instance:a",
        enabled: false,
      }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "NOT_REGION_CONTROLLER" });
    expect(deps.savePersistentState).not.toHaveBeenCalled();
  });
});

function makeApp(deps: CountryBuildRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerCountryBuildRoutes(app, deps);
  return app;
}

function makeDeps(options?: {
  orders?: Map<string, Order[]>;
  world?: Partial<CountryBuildWorldState>;
}): CountryBuildRoutesDependencies & { world: CountryBuildWorldState } {
  const world: CountryBuildWorldState = {
    regionConstructionQueueByRegion: {},
    regionOwner: { "region:a": "country:a" },
    regionController: { "region:a": "country:a" },
    regionBuildingsByRegion: {},
    regionBuildingDucatsByRegion: {},
    resourcesByCountry: { "country:a": { ...baseResources } },
    ...options?.world,
  };
  return {
    world,
    routeAuth: createRouteAuth(),
    masks: {
      regionConstructionQueueByRegion: 1,
      resourcesByCountry: 2,
      regionBuildingsByRegion: 4,
      regionBuildingDucatsByRegion: 8,
    },
    createId: () => "id-1",
    getTurnId: () => 7,
    getWorldBase: () => world,
    getGameSettings: () => ({
      content: {
        buildings: [
          {
            id: "building:farm",
            costConstruction: 25,
            costDucats: 2,
            maxLevel: 3,
            upgradeCostConstruction: 20,
            upgradeCostDucats: 4,
          },
        ],
      },
      economy: { demolitionCostConstructionPercent: 20 },
    }),
    getOrdersByTurn: () => options?.orders,
    deleteOrdersForTurn: vi.fn((turnId: number) => {
      if (turnId === 7) options?.orders?.clear();
    }),
    removeOrderFromTurnIndexes: vi.fn(),
    dropTurnOrderIndexes: vi.fn(),
    ensureCountryInWorldBase: vi.fn(),
    getBuildingMaxLevel: (building) => Math.max(1, Math.floor(Number(building?.maxLevel ?? 1))),
    getBuildingUpgradeCosts: (building) => ({
      costConstruction: Math.max(1, Math.floor(Number(building?.upgradeCostConstruction ?? 1))),
      costDucats: Math.max(0, Number(building?.upgradeCostDucats ?? 0)),
    }),
    getBuildingConstructionTotalCostByLevel: (building, levelRaw) => {
      const level = Math.max(1, Math.floor(Number(levelRaw)));
      const baseConstruction = Math.max(1, Math.floor(Number(building?.costConstruction ?? 1)));
      const upgradeConstruction = Math.max(1, Math.floor(Number(building?.upgradeCostConstruction ?? 1)));
      return baseConstruction + Math.max(0, level - 1) * upgradeConstruction;
    },
    cloneWorldBaseSectionSnapshot: (mask) => ({ mask }),
    savePersistentState: vi.fn(),
    broadcastWorldDeltaFromSectionSnapshot: vi.fn(),
  };
}

function makeBuildingInstance(overrides?: Partial<BuildingInstance>): BuildingInstance {
  return {
    instanceId: "instance",
    buildingId: "building:farm",
    owner: { type: "state", countryId: "country:a" },
    level: 1,
    durability: 100,
    ducats: 0,
    autoUpgradeEnabled: true,
    stateSubsidiesEnabled: true,
    manualWorkEnabled: true,
    isInactive: false,
    inactiveReason: null,
    lastProductivity: 1,
    ...overrides,
  } as BuildingInstance;
}

function makeOrder(overrides?: Omit<Partial<Extract<Order, { type: "BUILD" }>>, "type">): Extract<Order, { type: "BUILD" }> {
  return {
    id: "order",
    turnId: 7,
    playerId: "player:a",
    countryId: "country:a",
    regionId: "region:a",
    targetHexId: "hex:0:0",
    type: "BUILD",
    payload: {},
    createdAt: "now",
    ...overrides,
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
