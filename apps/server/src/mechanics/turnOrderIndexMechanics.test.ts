import type { Order } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  addOrderToTurnIndexes,
  dropTurnOrderIndexes,
  rebuildTurnOrderIndexes,
  removeOrderFromTurnIndexes,
  type TurnOrderIndexes,
} from "./turnOrderIndexMechanics";

describe("turnOrderIndexMechanics", () => {
  it("adds and removes colonize and build orders from per-turn hex indexes", () => {
    const indexes = makeIndexes();
    const colonizeOrder = makeColonizeOrder({ regionId: "region:a" });
    const buildOrder = makeBuildOrder({ regionId: "region:b" });

    addOrderToTurnIndexes(indexes, colonizeOrder);
    addOrderToTurnIndexes(indexes, buildOrder);

    expect(indexes.queuedColonizeRegionsByCountryByTurn.get(3)?.get("country:a")).toEqual(new Set(["region:a"]));
    expect(indexes.queuedBuildRegionsByCountryByTurn.get(3)?.get("country:a")).toEqual(new Set(["region:b"]));

    removeOrderFromTurnIndexes(indexes, colonizeOrder);
    removeOrderFromTurnIndexes(indexes, buildOrder);

    expect(indexes.queuedColonizeRegionsByCountryByTurn.has(3)).toBe(false);
    expect(indexes.queuedBuildRegionsByCountryByTurn.has(3)).toBe(false);
  });

  it("rebuilds and drops turn indexes", () => {
    const indexes = makeIndexes();
    indexes.queuedColonizeRegionsByCountryByTurn.set(99, new Map([["country:z", new Set(["region:z"])]]));
    const ordersByTurn = new Map<number, Map<string, Order[]>>([
      [3, new Map([["player:a", [makeColonizeOrder({ regionId: "region:a" })]]])],
    ]);

    rebuildTurnOrderIndexes(indexes, ordersByTurn);

    expect(indexes.queuedColonizeRegionsByCountryByTurn.has(99)).toBe(false);
    expect(indexes.queuedColonizeRegionsByCountryByTurn.get(3)?.get("country:a")).toEqual(new Set(["region:a"]));

    dropTurnOrderIndexes(indexes, 3);
    expect(indexes.queuedColonizeRegionsByCountryByTurn.has(3)).toBe(false);
  });
});

function makeIndexes(): TurnOrderIndexes {
  return {
    queuedColonizeRegionsByCountryByTurn: new Map(),
    queuedBuildRegionsByCountryByTurn: new Map(),
  };
}

function makeColonizeOrder(
  overrides?: Omit<Partial<Extract<Order, { type: "COLONIZE" }>>, "type">,
): Extract<Order, { type: "COLONIZE" }> {
  return {
    id: "order:a",
    turnId: 3,
    playerId: "player:a",
    countryId: "country:a",
    regionId: "region:a",
    type: "COLONIZE",
    payload: {},
    createdAt: "now",
    ...overrides,
  };
}

function makeBuildOrder(
  overrides?: Omit<Partial<Extract<Order, { type: "BUILD" }>>, "type">,
): Extract<Order, { type: "BUILD" }> {
  return {
    id: "order:b",
    turnId: 3,
    playerId: "player:a",
    countryId: "country:a",
    regionId: "region:b",
    targetHexId: "hex:0:0",
    type: "BUILD",
    payload: {},
    createdAt: "now",
    ...overrides,
  };
}
