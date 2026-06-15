import type { Order } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  restoreOrdersByTurnState,
  restoreResolveReadyByTurnState,
  serializeOrdersByTurnState,
  serializeResolveReadyByTurnState,
} from "./turnStatePersistence";

describe("turnStatePersistence", () => {
  it("serializes and restores orders by turn", () => {
    const order = createOrder("order:1");
    const ordersByTurn = new Map<number, Map<string, Order[]>>([[1, new Map([["country:a", [order]]])]]);

    const serialized = serializeOrdersByTurnState(ordersByTurn);
    const restored = restoreOrdersByTurnState(serialized);

    expect(serialized).toEqual([{ turnId: 1, players: [{ playerId: "country:a", orders: [order] }] }]);
    expect(restored.get(1)?.get("country:a")).toEqual([order]);
  });

  it("drops malformed order persistence rows", () => {
    const restored = restoreOrdersByTurnState([
      { turnId: 1, players: [{ playerId: "country:a", orders: [] }] },
      { turnId: "bad", players: [] },
      { turnId: 2, players: [{ playerId: 7, orders: [] }] },
    ]);

    expect([...restored.keys()]).toEqual([1]);
  });

  it("serializes and restores resolve readiness by turn", () => {
    const readiness = new Map<number, Set<string>>([[2, new Set(["country:a", "country:b"])]]);

    const serialized = serializeResolveReadyByTurnState(readiness);
    const restored = restoreResolveReadyByTurnState(serialized);

    expect(serialized).toEqual([{ turnId: 2, countryIds: ["country:a", "country:b"] }]);
    expect([...(restored.get(2) ?? [])]).toEqual(["country:a", "country:b"]);
  });

  it("drops malformed readiness persistence rows", () => {
    const restored = restoreResolveReadyByTurnState([
      { turnId: 1, countryIds: ["country:a", 42] },
      { turnId: Number.NaN, countryIds: ["country:b"] },
      { turnId: 2, countryIds: [] },
    ]);

    expect([...(restored.get(1) ?? [])]).toEqual(["country:a"]);
    expect(restored.has(2)).toBe(false);
  });
});

function createOrder(id: string): Order {
  return {
    id,
    turnId: 1,
    playerId: "player:a",
    countryId: "country:a",
    regionId: "1",
    type: "BUILD",
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}
