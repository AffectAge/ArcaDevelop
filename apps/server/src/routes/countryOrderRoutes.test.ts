import express from "express";
import type { Order } from "@arcanorum/shared";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import { registerCountryOrderRoutes, type CountryOrderRoutesDependencies } from "./countryOrderRoutes";

describe("countryOrderRoutes", () => {
  it("returns current turn orders from every player bucket", async () => {
    const orderA = makeOrder({ id: "order:a", playerId: "player:a" });
    const orderB = makeOrder({ id: "order:b", playerId: "player:b" });
    const deps = makeDeps(new Map([["player:a", [orderA]], ["player:b", [orderB]]]));
    const app = makeApp(deps);

    const response = await request(app, "/country/orders/current");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ turnId: 9, orders: [orderA, orderB] });
  });

  it("returns an empty order list when no current turn bucket exists", async () => {
    const app = makeApp(makeDeps(undefined));

    const response = await request(app, "/country/orders/current");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ turnId: 9, orders: [] });
  });
});

function makeApp(deps: CountryOrderRoutesDependencies): express.Express {
  const app = express();
  registerCountryOrderRoutes(app, deps);
  return app;
}

function makeDeps(orders: Map<string, Order[]> | undefined): CountryOrderRoutesDependencies {
  return {
    routeAuth: createRouteAuth(),
    getTurnId: () => 9,
    getOrdersByTurn: () => orders,
  };
}

function makeOrder(overrides?: Omit<Partial<Extract<Order, { type: "BUILD" }>>, "type">): Extract<Order, { type: "BUILD" }> {
  return {
    id: "order",
    turnId: 9,
    playerId: "player:a",
    countryId: "country:a",
    regionId: "region:a",
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

async function request(app: express.Express, path: string): Promise<Response> {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a port");
    return await fetch(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
