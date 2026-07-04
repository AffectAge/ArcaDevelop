import { describe, expect, it } from "vitest";
import type { MapUnit, Order, UnitTypeDefinition, WorldBase } from "@arcanorum/shared";
import { buildTurnActionChecklist } from "./turnActionChecklistMechanics";

describe("turnActionChecklistMechanics", () => {
  it("returns idle owned map units as blocking actions", () => {
    const checklist = buildTurnActionChecklist({
      worldBase: { unitsById: { "unit:a": makeUnit("unit:a", "country:a") } },
      unitTypes: [makeUnitType("unit:warrior")],
      ordersByTurn: new Map(),
      turnId: 4,
      countryId: "country:a",
    });

    expect(checklist.blockingCount).toBe(1);
    expect(checklist.items[0]).toMatchObject({
      kind: "unit_can_act",
      severity: "blocking",
      target: { type: "unit", unitId: "unit:a", hexId: "hex:0:0" },
    });
  });

  it("ignores queued, sleeping, and foreign units", () => {
    const orders = new Map<number, Map<string, Order[]>>([
      [
        4,
        new Map([
          [
            "player:a",
            [
              {
                id: "order:a",
                type: "UNIT_SKIP_TURN",
                turnId: 4,
                playerId: "player:a",
                countryId: "country:a",
                unitId: "unit:queued",
                unitKind: "map",
                payload: {},
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          ],
        ]),
      ],
    ]);
    const worldBase: Pick<WorldBase, "unitsById"> = {
      unitsById: {
        "unit:queued": makeUnit("unit:queued", "country:a"),
        "unit:sleeping": { ...makeUnit("unit:sleeping", "country:a"), status: "sleeping" },
        "unit:foreign": makeUnit("unit:foreign", "country:b"),
      },
    };

    const checklist = buildTurnActionChecklist({
      worldBase,
      unitTypes: [makeUnitType("unit:warrior")],
      ordersByTurn: orders,
      turnId: 4,
      countryId: "country:a",
    });

    expect(checklist.items).toEqual([]);
  });

  it("ignores a unit with queued wake order", () => {
    const orders = new Map<number, Map<string, Order[]>>([
      [
        4,
        new Map([
          [
            "player:a",
            [
              {
                id: "order:wake",
                type: "UNIT_WAKE",
                turnId: 4,
                playerId: "player:a",
                countryId: "country:a",
                unitId: "unit:a",
                unitKind: "map",
                payload: {},
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          ],
        ]),
      ],
    ]);

    const checklist = buildTurnActionChecklist({
      worldBase: { unitsById: { "unit:a": makeUnit("unit:a", "country:a") } },
      unitTypes: [makeUnitType("unit:warrior")],
      ordersByTurn: orders,
      turnId: 4,
      countryId: "country:a",
    });

    expect(checklist.items).toEqual([]);
  });
});

function makeUnit(id: string, countryId: string): MapUnit {
  return {
    id,
    unitTypeId: "unit:warrior",
    countryId,
    hexId: "hex:0:0",
    hp: 100,
    movementPoints: 2,
    experience: 0,
    status: "idle",
    path: [],
    targetHexId: null,
    createdTurnId: 1,
    lastActionTurnId: null,
  };
}

function makeUnitType(id: string): UnitTypeDefinition {
  return {
    id,
    domain: "land",
    class: "melee",
    nameKey: "unit.warrior.name",
    stats: { maxHp: 100, attack: 20, defense: 10, movement: 2 },
    productionCost: {},
    visual: { frameWidth: 64, frameHeight: 64, states: { idle: { frame: 0 } } },
  };
}
