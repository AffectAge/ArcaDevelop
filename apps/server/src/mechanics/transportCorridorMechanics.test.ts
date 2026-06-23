import type { ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  consumeCorridorRoutesCapacity,
  createCorridorRoutePlanner,
  getTransportCorridorConstructionProgressPerTurn,
  resolveTransportCorridorConstructionTurn,
  type TransportCorridorRouteEntry,
  type TransportCorridorConstructionEntry,
} from "./transportCorridorMechanics";

describe("transportCorridorMechanics", () => {
  it("calculates construction progress from base construction per turn", () => {
    expect(getTransportCorridorConstructionProgressPerTurn(5)).toBe(50);
    expect(getTransportCorridorConstructionProgressPerTurn(0)).toBe(1);
  });

  it("spends owner construction and progresses building corridors", () => {
    const corridor = makeCorridor({ costConstruction: 100, progressConstruction: 20 });
    const worldBase = { resourcesByCountry: { "country:a": makeResources({ construction: 40 }) } };

    resolveTransportCorridorConstructionTurn({
      corridorsById: { "corridor:a": corridor },
      worldBase,
      baseConstructionPerTurn: 5,
      nowIso: "2026-06-13T00:00:00.000Z",
    });

    expect(worldBase.resourcesByCountry["country:a"]?.construction).toBe(0);
    expect(corridor).toMatchObject({ status: "building", progressConstruction: 60, completedAt: null });
  });

  it("activates corridors when construction reaches cost", () => {
    const corridor = makeCorridor({ costConstruction: 100, progressConstruction: 80 });
    const worldBase = { resourcesByCountry: { "country:a": makeResources({ construction: 50 }) } };

    resolveTransportCorridorConstructionTurn({
      corridorsById: { "corridor:a": corridor },
      worldBase,
      baseConstructionPerTurn: 5,
      nowIso: "2026-06-13T00:00:00.000Z",
    });

    expect(worldBase.resourcesByCountry["country:a"]?.construction).toBe(0);
    expect(corridor).toMatchObject({
      status: "active",
      progressConstruction: 100,
      completedAt: "2026-06-13T00:00:00.000Z",
    });
  });

  it("does not progress closed, active, ownerless, or unfunded corridors", () => {
    const corridors = {
      active: makeCorridor({ id: "active", status: "active", progressConstruction: 10 }),
      closed: makeCorridor({ id: "closed", status: "closed", progressConstruction: 10 }),
      ownerless: makeCorridor({ id: "ownerless", ownerCountryId: "country:missing", progressConstruction: 10 }),
      unfunded: makeCorridor({ id: "unfunded", ownerCountryId: "country:b", progressConstruction: 10 }),
    };
    const worldBase = {
      resourcesByCountry: {
        "country:b": makeResources({ construction: 0 }),
      },
    };

    resolveTransportCorridorConstructionTurn({
      corridorsById: corridors,
      worldBase,
      baseConstructionPerTurn: 5,
      nowIso: "2026-06-13T00:00:00.000Z",
    });

    expect(corridors.active.progressConstruction).toBe(10);
    expect(corridors.closed.progressConstruction).toBe(10);
    expect(corridors.ownerless.progressConstruction).toBe(10);
    expect(corridors.unfunded.progressConstruction).toBe(10);
  });

  it("plans corridor transfer routes and consumes route capacity", () => {
    const corridorsById = {
      "corridor:a": makeRouteCorridor({ id: "corridor:a", hexIds: ["province:seller", "province:hub"], level: 2 }),
      "corridor:b": makeRouteCorridor({ id: "corridor:b", hexIds: ["province:hub", "province:buyer"], level: 1 }),
    };
    const corridorLoadByModeByCorridorId: Record<string, Partial<Record<"land", number>>> = {};
    const planner = createCorridorRoutePlanner<"land", TransportCorridorRouteEntry<"land">>({
      corridorsById,
      hexOwnerById: {
        "province:seller": "country:seller",
        "province:hub": "country:transit",
        "province:buyer": "country:buyer",
      },
      getCorridorCapacity: () => 10,
      getCorridorLoad: (corridorId, mode) => corridorLoadByModeByCorridorId[corridorId]?.[mode] ?? 0,
      getMarketMemberCountryIds: (marketId) =>
        marketId === "market:buyer" ? ["country:buyer", "country:transit"] : ["country:seller", "country:transit"],
      getTransitAllowedCountries: (members) => members,
      normalizeHexIds: normalizeStringList,
    });

    const routes = planner.getCorridorRoutesForTransfer({
      buyerMarketId: "market:buyer",
      buyerHexId: "province:buyer",
      buyerCountryId: "country:buyer",
      sellerMarketId: "market:seller",
      sellerHexId: "province:seller",
      sellerCountryId: "country:seller",
      transportModes: ["land"],
      infraPerUnit: 2,
      requestedGoods: 3,
    });

    expect(routes).toHaveLength(1);
    expect(routes[0]?.corridors.map((corridor) => corridor.id)).toEqual(["corridor:a", "corridor:b"]);
    expect(planner.getRoutesCapacityInGoods(routes)).toBe(3);

    consumeCorridorRoutesCapacity({
      routes,
      goodsAmount: 2,
      infraPerUnit: 2,
      corridorLoadByModeByCorridorId,
      getCorridorLoad: (corridorId, mode) => corridorLoadByModeByCorridorId[corridorId]?.[mode] ?? 0,
    });

    expect(corridorLoadByModeByCorridorId).toEqual({
      "corridor:a": { land: 4 },
      "corridor:b": { land: 4 },
    });
    expect(planner.getCorridorRemainingCapacity("corridor:a", "land")).toBe(6);
  });

  it("distinguishes physical corridors from transit-allowed reachable routes", () => {
    const corridorsById = {
      "corridor:a": makeRouteCorridor({ id: "corridor:a", hexIds: ["province:seller", "province:blocked", "province:buyer"] }),
    };
    const planner = createCorridorRoutePlanner<"land", TransportCorridorRouteEntry<"land">>({
      corridorsById,
      hexOwnerById: {
        "province:seller": "country:seller",
        "province:blocked": "country:blocked",
        "province:buyer": "country:buyer",
      },
      getCorridorCapacity: () => 10,
      getCorridorLoad: () => 0,
      getMarketMemberCountryIds: () => [],
      getTransitAllowedCountries: (members) => members,
      normalizeHexIds: normalizeStringList,
    });
    const routeParams: {
      buyerMarketId: string;
      buyerHexId: string;
      buyerCountryId: string;
      sellerMarketId: string;
      sellerHexId: string;
      sellerCountryId: string;
      transportModes: "land"[];
    } = {
      buyerMarketId: "market:buyer",
      buyerHexId: "province:buyer",
      buyerCountryId: "country:buyer",
      sellerMarketId: "market:seller",
      sellerHexId: "province:seller",
      sellerCountryId: "country:seller",
      transportModes: ["land"],
    };

    expect(planner.hasReachableCorridorRouteIgnoringCapacity(routeParams)).toBe(false);
    expect(planner.hasPhysicalCorridorRouteIgnoringTransit(routeParams)).toBe(true);
  });
});

function makeCorridor(overrides?: Partial<TransportCorridorConstructionEntry>): TransportCorridorConstructionEntry {
  return {
    id: "corridor:a",
    ownerCountryId: "country:a",
    status: "building",
    progressConstruction: 0,
    costConstruction: 100,
    completedAt: null,
    ...overrides,
  };
}

function makeResources(overrides?: Partial<ResourceTotals>): ResourceTotals {
  return {
    culture: 0,
    science: 0,
    religion: 0,
    colonization: 0,
    construction: 0,
    ducats: 0,
    gold: 0,
    ...overrides,
  };
}

function makeRouteCorridor(overrides?: Partial<TransportCorridorRouteEntry<"land">>): TransportCorridorRouteEntry<"land"> {
  return {
    id: "corridor:a",
    ownerCountryId: "country:transit",
    marketId: "market:buyer",
    status: "active",
    transportMode: "land",
    hexIds: ["province:a", "province:b"],
    level: 1,
    ...overrides,
  };
}

function normalizeStringList(input: unknown): string[] {
  return Array.isArray(input) ? input.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
}
