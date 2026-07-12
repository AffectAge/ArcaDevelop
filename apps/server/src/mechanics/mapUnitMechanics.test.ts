import { describe, expect, it } from "vitest";
import type { MapUnit, Order, UnitSkillTreeDefinition, UnitTypeDefinition } from "@arcanorum/shared";
import { resolveMapUnitMoveOrder, resolveMapUnitPromoteOrder, resolveMapUnitWaitOrder } from "./mapUnitMechanics";

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

  it("applies a valid unit skill choice group once", () => {
    const worldBase = { unitsById: { "unit:a": makeUnit("unit:a", { experience: 10 }) } };
    const result = resolveMapUnitPromoteOrder({
      order: makePromoteOrder(["unit_skill:river_fighter"]),
      playerId: "player:a",
      worldBase,
      unitTypes: [makeUnitType("unit:warrior", "land", { unitSkillTreeId: "unit_skill_tree:warrior" })],
      unitSkillTrees: [makeSkillTree()],
      turnId: 7,
      movedUnitIds: new Set<string>(),
    });

    expect(result.rejectedOrder).toBeNull();
    expect(worldBase.unitsById["unit:a"]?.skillIds).toEqual(["unit_skill:river_fighter"]);
    expect(worldBase.unitsById["unit:a"]?.completedChoiceGroupIds).toEqual(["group:level_2"]);
    expect(worldBase.unitsById["unit:a"]).toMatchObject({ movementPoints: 0, lastActionTurnId: 7 });
  });

  it("rejects unit skill choices with the wrong choice count", () => {
    const result = resolveMapUnitPromoteOrder({
      order: makePromoteOrder([]),
      playerId: "player:a",
      worldBase: { unitsById: { "unit:a": makeUnit("unit:a", { experience: 10 }) } },
      unitTypes: [makeUnitType("unit:warrior", "land", { unitSkillTreeId: "unit_skill_tree:warrior" })],
      unitSkillTrees: [makeSkillTree()],
      turnId: 7,
      movedUnitIds: new Set<string>(),
    });

    expect(result.rejectedOrder).toMatchObject({ reason: "UNIT_PROMOTE_CHOICE_COUNT_INVALID" });
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

  it("fortifies a map unit until a manual order wakes it", () => {
    const movedUnitIds = new Set<string>();
    const worldBase = { unitsById: { "unit:a": makeUnit("unit:a") } };
    const result = resolveMapUnitWaitOrder({
      order: makeWaitOrder("UNIT_FORTIFY"),
      playerId: "player:a",
      worldBase,
      turnId: 7,
      movedUnitIds,
    });

    expect(result.rejectedOrder).toBeNull();
    expect(worldBase.unitsById["unit:a"]).toMatchObject({ status: "fortified", movementPoints: 0, lastActionTurnId: 7 });
    expect(movedUnitIds.has("unit:a")).toBe(true);
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

  it("allows fleets to follow navigable river edges onto land hexes", () => {
    const worldBase = { unitsById: { "unit:a": makeUnit("unit:a", { unitTypeId: "unit:fleet" }) } };
    const result = resolveMapUnitMoveOrder({
      order: {
        id: "order:move",
        type: "UNIT_MOVE",
        turnId: 7,
        playerId: "player:a",
        countryId: "country:a",
        unitId: "unit:a",
        targetHexId: "hex:1:0",
        path: ["hex:1:0"],
        payload: { path: ["hex:1:0"] },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      playerId: "player:a",
      worldBase,
      unitTypes: [makeUnitType("unit:fleet", "naval")],
      turnId: 7,
      movedUnitIds: new Set<string>(),
      areHexIdsAdjacentOrSame: () => true,
      getHex: (hexId) => ({ id: hexId, passable: true, waterKind: null }),
      getHexMovementCost: () => 0.5,
    });

    expect(result.rejectedOrder).toBeNull();
    expect(worldBase.unitsById["unit:a"]?.hexId).toBe("hex:1:0");
  });
});

function makeUnit(id: string, overrides: Partial<MapUnit> = {}): MapUnit {
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
    ...overrides,
  };
}

function makeUnitType(id: string, domain: UnitTypeDefinition["domain"], overrides: Partial<UnitTypeDefinition> = {}): UnitTypeDefinition {
  return {
    id,
    domain,
    class: domain === "naval" ? "naval_melee" : "melee",
    nameKey: id,
    stats: { maxHp: 100, attack: 1, defense: 1, movement: 2, vision: 1 },
    productionCost: {},
    visual: { frameWidth: 1, frameHeight: 1, states: {} },
    ...overrides,
  };
}

function makeSkillTree(): UnitSkillTreeDefinition {
  return {
    id: "unit_skill_tree:warrior",
    levelThresholds: { "1": 0, "2": 10 },
    choiceGroups: [
      {
        id: "group:level_2",
        unlockLevel: 2,
        choicesRequired: 1,
        options: ["unit_skill:river_fighter", "unit_skill:shield_wall"],
      },
    ],
  };
}

function makePromoteOrder(skillIds: Array<`unit_skill:${string}`>): Order {
  return {
    id: "order:promote",
    type: "UNIT_PROMOTE",
    turnId: 7,
    playerId: "player:a",
    countryId: "country:a",
    unitId: "unit:a",
    choiceGroupId: "group:level_2",
    skillIds,
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeWaitOrder(type: "UNIT_SKIP_TURN" | "UNIT_SLEEP" | "UNIT_WAKE" | "UNIT_FORTIFY"): Order {
  return {
    id: `order:${type}`,
    type,
    turnId: 7,
    playerId: "player:a",
    countryId: "country:a",
    unitId: "unit:a",
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}
