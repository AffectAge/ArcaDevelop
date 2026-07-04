import { describe, expect, it } from "vitest";
import type { MapUnit, Order } from "@arcanorum/shared";
import { resolveMapUnitWaitOrder } from "./mapUnitMechanics";

describe("mapUnitMechanics wait orders", () => {
  it("skips a map unit for the current turn", () => {
    const movedUnitIds = new Set<string>();
    const worldBase = { unitsById: { "unit:a": makeUnit("unit:a") } };
    const result = resolveMapUnitWaitOrder({
      order: makeWaitOrder("UNIT_SKIP_TURN"),
      playerId: "player:a",
      worldBase,
      turnId: 7,
      movedUnitIds,
    });

    expect(result.rejectedOrder).toBeNull();
    expect(worldBase.unitsById["unit:a"]).toMatchObject({ status: "idle", movementPoints: 0, lastActionTurnId: 7 });
    expect(movedUnitIds.has("unit:a")).toBe(true);
  });

  it("puts a map unit to sleep until a manual order wakes it", () => {
    const movedUnitIds = new Set<string>();
    const worldBase = { unitsById: { "unit:a": makeUnit("unit:a") } };
    const result = resolveMapUnitWaitOrder({
      order: makeWaitOrder("UNIT_SLEEP"),
      playerId: "player:a",
      worldBase,
      turnId: 7,
      movedUnitIds,
    });

    expect(result.rejectedOrder).toBeNull();
    expect(worldBase.unitsById["unit:a"]).toMatchObject({ status: "sleeping", movementPoints: 0, lastActionTurnId: 7 });
  });

  it("wakes a sleeping map unit without granting extra movement", () => {
    const movedUnitIds = new Set<string>();
    const worldBase = { unitsById: { "unit:a": { ...makeUnit("unit:a"), status: "sleeping" as const, movementPoints: 0 } } };
    const result = resolveMapUnitWaitOrder({
      order: makeWaitOrder("UNIT_WAKE"),
      playerId: "player:a",
      worldBase,
      turnId: 7,
      movedUnitIds,
    });

    expect(result.rejectedOrder).toBeNull();
    expect(worldBase.unitsById["unit:a"]).toMatchObject({ status: "idle", movementPoints: 0, lastActionTurnId: 7 });
    expect(movedUnitIds.has("unit:a")).toBe(true);
  });

  it("rejects waking a unit that is not sleeping", () => {
    const result = resolveMapUnitWaitOrder({
      order: makeWaitOrder("UNIT_WAKE"),
      playerId: "player:a",
      worldBase: { unitsById: { "unit:a": makeUnit("unit:a") } },
      turnId: 7,
      movedUnitIds: new Set<string>(),
    });

    expect(result.rejectedOrder).toMatchObject({ reason: "MAP_UNIT_NOT_SLEEPING" });
  });
});

function makeUnit(id: string): MapUnit {
  return {
    id,
    unitTypeId: "unit:warrior",
    countryId: "country:a",
    hexId: "hex:0:0",
    hp: 100,
    movementPoints: 2,
    experience: 0,
    status: "idle",
    path: ["hex:1:0"],
    targetHexId: "hex:1:0",
    createdTurnId: 1,
    lastActionTurnId: null,
  };
}

function makeWaitOrder(type: "UNIT_SKIP_TURN" | "UNIT_SLEEP" | "UNIT_WAKE"): Order {
  return {
    id: `order:${type}`,
    type,
    turnId: 7,
    playerId: "player:a",
    countryId: "country:a",
    unitId: "unit:a",
    unitKind: "map",
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}
