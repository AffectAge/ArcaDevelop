import type express from "express";
import type { Order } from "@arcanorum/shared";
import type { RouteAuth } from "../security/routeAuth";

export type CountryOrderRoutesDependencies = {
  routeAuth: RouteAuth;
  getTurnId: () => number;
  getOrdersByTurn: (turnId: number) => Map<string, Order[]> | undefined;
};

export function registerCountryOrderRoutes(
  app: express.Express,
  deps: CountryOrderRoutesDependencies,
): void {
  app.get("/country/orders/current", (req, res) => {
    if (!deps.routeAuth.requireAuth(req, res)) return;

    const turnId = deps.getTurnId();
    const turnOrders = deps.getOrdersByTurn(turnId);
    if (!turnOrders) {
      return res.json({ turnId, orders: [] as Order[] });
    }

    const orders: Order[] = [];
    for (const list of turnOrders.values()) {
      for (const order of list) {
        orders.push(order);
      }
    }

    return res.json({ turnId, orders });
  });
}
