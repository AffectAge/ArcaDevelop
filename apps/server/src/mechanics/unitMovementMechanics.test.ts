import type { CivilianUnit, Order } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  advanceStoredCivilianUnitRoutesTurn,
  isCivilianHexOccupied,
  resolveUnitMoveOrder,
  type UnitMovementWorldState,
} from "./unitMovementMechanics";

describe("unitMovementMechanics", () => {
  it("moves a civilian unit along a contiguous route and stores the remaining path", () => {
    const worldBase = makeWorld({
      "unit:a": makeColonizer({ movementPoints: 1, maxMovementPoints: 2 }),
    });
    const movedCivilianUnitIds = new Set<string>();

    const result = resolveUnitMoveOrder({
      order: makeMoveOrder({ targetHexId: "hex:2:0", payload: { path: ["hex:1:0", "hex:2:0"] } }),
      playerId: "player:a",
      worldBase,
      turnId: 5,
      movedCivilianUnitIds,
      areHexIdsAdjacentOrSame,
    });

    expect(result).toEqual({ moved: true, rejectedOrder: null });
    expect(worldBase.civilianUnitsById["unit:a"]).toMatchObject({
      hexId: "hex:1:0",
      path: ["hex:2:0"],
      movementPoints: 0,
      status: "moving",
      lastMovedTurnId: 5,
    });
    expect(movedCivilianUnitIds.has("unit:a")).toBe(true);
  });

  it("spends movement by hex movement cost instead of raw step count", () => {
    const worldBase = makeWorld({
      "unit:a": makeColonizer({ movementPoints: 2.5, maxMovementPoints: 2.5 }),
    });

    const result = resolveUnitMoveOrder({
      order: makeMoveOrder({ targetHexId: "hex:2:0", payload: { path: ["hex:1:0", "hex:2:0"] } }),
      playerId: "player:a",
      worldBase,
      turnId: 5,
      movedCivilianUnitIds: new Set(),
      areHexIdsAdjacentOrSame,
      getHexMovementCost: (hexId) => (hexId === "hex:1:0" ? 2 : 1),
    });

    expect(result).toEqual({ moved: true, rejectedOrder: null });
    expect(worldBase.civilianUnitsById["unit:a"]).toMatchObject({
      hexId: "hex:1:0",
      path: ["hex:2:0"],
      movementPoints: 0.5,
      status: "moving",
    });
  });

  it("accepts a distant target and stores it while moving only as far as points allow", () => {
    const worldBase = makeWorld({
      "unit:a": makeColonizer({ movementPoints: 1, maxMovementPoints: 1 }),
    });

    const result = resolveUnitMoveOrder({
      order: makeMoveOrder({ targetHexId: "hex:3:0", payload: {} }),
      playerId: "player:a",
      worldBase,
      turnId: 5,
      movedCivilianUnitIds: new Set(),
      areHexIdsAdjacentOrSame,
      getNeighborHexIds,
    });

    expect(result).toEqual({ moved: true, rejectedOrder: null });
    expect(worldBase.civilianUnitsById["unit:a"]).toMatchObject({
      hexId: "hex:1:0",
      targetHexId: "hex:3:0",
      path: ["hex:2:0", "hex:3:0"],
      status: "moving",
    });
  });

  it("recalculates a stored target route when the old next hex becomes occupied", () => {
    const worldBase = makeWorld({
      "unit:a": makeColonizer({
        path: ["hex:1:0", "hex:3:0"],
        targetHexId: "hex:3:0",
        movementPoints: 0,
        maxMovementPoints: 1,
        status: "moving",
        lastMovedTurnId: 5,
      }),
      "unit:b": makeColonizer({ id: "unit:b", hexId: "hex:1:0" }),
    });

    advanceStoredCivilianUnitRoutesTurn({
      worldBase,
      turnId: 6,
      movedCivilianUnitIds: new Set(),
      areHexIdsAdjacentOrSame,
      getNeighborHexIds: (hexId) => {
        const graph: Record<string, string[]> = {
          "hex:0:0": ["hex:1:0", "hex:0:1"],
          "hex:0:1": ["hex:0:0", "hex:3:0"],
          "hex:1:0": ["hex:0:0", "hex:3:0"],
          "hex:3:0": ["hex:0:1", "hex:1:0"],
        };
        return (graph[hexId] ?? []).filter((id): id is `hex:${number}:${number}` => /^hex:-?\d+:-?\d+$/.test(id));
      },
    });

    expect(worldBase.civilianUnitsById["unit:a"]).toMatchObject({
      hexId: "hex:0:1",
      targetHexId: "hex:3:0",
      path: ["hex:3:0"],
      status: "moving",
    });
  });

  it("continues stored route only while refreshed movement covers next hex cost", () => {
    const worldBase = makeWorld({
      "unit:a": makeColonizer({
        hexId: "hex:1:0",
        path: ["hex:2:0", "hex:3:0"],
        movementPoints: 0,
        maxMovementPoints: 2,
        status: "moving",
        lastMovedTurnId: 5,
      }),
    });

    advanceStoredCivilianUnitRoutesTurn({
      worldBase,
      turnId: 6,
      movedCivilianUnitIds: new Set(),
      areHexIdsAdjacentOrSame,
      getHexMovementCost: (hexId) => (hexId === "hex:2:0" ? 1.5 : 1),
    });

    expect(worldBase.civilianUnitsById["unit:a"]).toMatchObject({
      hexId: "hex:2:0",
      path: ["hex:3:0"],
      movementPoints: 0.5,
      status: "moving",
      lastMovedTurnId: 6,
    });
  });

  it("refreshes idle civilian movement points on a new turn", () => {
    const worldBase = makeWorld({
      "unit:a": makeColonizer({
        movementPoints: 0,
        maxMovementPoints: 2,
        path: [],
        status: "idle",
        lastMovedTurnId: 5,
      }),
    });

    advanceStoredCivilianUnitRoutesTurn({
      worldBase,
      turnId: 6,
      movedCivilianUnitIds: new Set(),
      areHexIdsAdjacentOrSame,
    });

    expect(worldBase.civilianUnitsById["unit:a"]).toMatchObject({
      movementPoints: 2,
      status: "idle",
      lastMovedTurnId: 5,
    });
  });

  it("rejects moves into another civilian unit hex", () => {
    const worldBase = makeWorld({
      "unit:a": makeColonizer(),
      "unit:b": makeColonizer({ id: "unit:b", hexId: "hex:1:0" }),
    });

    const result = resolveUnitMoveOrder({
      order: makeMoveOrder({ targetHexId: "hex:1:0" }),
      playerId: "player:a",
      worldBase,
      turnId: 5,
      movedCivilianUnitIds: new Set(),
      areHexIdsAdjacentOrSame,
    });

    expect(result.rejectedOrder).toEqual({
      playerId: "player:a",
      reason: "CIVILIAN_UNIT_HEX_OCCUPIED",
      tempOrderId: "order:move",
    });
    expect(isCivilianHexOccupied(worldBase, "hex:1:0")).toBe(true);
  });

  it("advances stored routes on the next turn after movement points refresh", () => {
    const worldBase = makeWorld({
      "unit:a": makeColonizer({
        hexId: "hex:1:0",
        path: ["hex:2:0", "hex:3:0"],
        movementPoints: 0,
        maxMovementPoints: 2,
        status: "moving",
        lastMovedTurnId: 5,
      }),
    });

    advanceStoredCivilianUnitRoutesTurn({
      worldBase,
      turnId: 6,
      movedCivilianUnitIds: new Set(),
      areHexIdsAdjacentOrSame,
    });

    expect(worldBase.civilianUnitsById["unit:a"]).toMatchObject({
      hexId: "hex:3:0",
      path: [],
      movementPoints: 0,
      status: "idle",
      lastMovedTurnId: 6,
    });
  });
});

function makeWorld(civilianUnitsById: Record<string, CivilianUnit>): UnitMovementWorldState {
  return { civilianUnitsById };
}

function makeColonizer(overrides: Partial<CivilianUnit> = {}): CivilianUnit {
  return {
    id: "unit:a",
    countryId: "country:a",
    type: "colonizer",
    hexId: "hex:0:0",
    status: "idle",
    movementPoints: 2,
    maxMovementPoints: 2,
    path: [],
    createdTurnId: 1,
    lastMovedTurnId: null,
    ...overrides,
  };
}

function makeMoveOrder(overrides: Partial<Extract<Order, { type: "UNIT_MOVE" }>> = {}): Extract<Order, { type: "UNIT_MOVE" }> {
  return {
    id: "order:move",
    turnId: 5,
    playerId: "player:a",
    countryId: "country:a",
    type: "UNIT_MOVE",
    unitId: "unit:a",
    unitKind: "civilian",
    targetHexId: "hex:1:0",
    path: ["hex:1:0"],
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function areHexIdsAdjacentOrSame(from: string, to: string): boolean {
  if (from === to) return true;
  return (
    (from === "hex:0:0" && to === "hex:1:0") ||
    (from === "hex:0:0" && to === "hex:0:1") ||
    (from === "hex:0:1" && (to === "hex:0:0" || to === "hex:3:0")) ||
    (from === "hex:1:0" && (to === "hex:0:0" || to === "hex:2:0")) ||
    (from === "hex:2:0" && (to === "hex:1:0" || to === "hex:3:0")) ||
    (from === "hex:3:0" && (to === "hex:2:0" || to === "hex:0:1"))
  );
}

function getNeighborHexIds(hexId: string): `hex:${number}:${number}`[] {
  const graph: Record<string, string[]> = {
    "hex:0:0": ["hex:1:0"],
    "hex:1:0": ["hex:0:0", "hex:2:0"],
    "hex:2:0": ["hex:1:0", "hex:3:0"],
    "hex:3:0": ["hex:2:0"],
  };
  return (graph[hexId] ?? []).filter((id): id is `hex:${number}:${number}` => /^hex:-?\d+:-?\d+$/.test(id));
}
