import { describe, expect, it } from "vitest";
import type { Order } from "@arcanorum/shared";
import {
  advanceDivisionAlongRoute,
  advanceStoredArmyRoutesTurn,
  advanceMilitaryFormationQueue,
  calculateDivisionStats,
  calculateDivisionTrainingCost,
  calculateFormationTurns,
  calculateMilitaryFormationCost,
  calculateMilitaryStats,
  componentsToDivisionBattalions,
  isContiguousArmyRoute,
  isMilitaryBranch,
  normalizeArmyMoveRoute,
  normalizeDivisionBattalions,
  normalizeMilitaryTemplateComponents,
  resolveArmyMoveOrder,
  resolveDivisionBattle,
  spendMilitaryFormationCost,
  type MilitaryContentEntry,
  type MilitaryRuntimeEvent,
  type MilitaryWorldState,
} from "./militaryMechanics";

const infantry: MilitaryContentEntry = {
  id: "infantry",
  manpower: 1000,
  attack: 2,
  defense: 4,
  breakthrough: 1,
  organization: 10,
  hp: 20,
  speed: 4,
  supplyUse: 0.5,
  trainingCostDucats: 3,
  equipmentNeeds: [{ goodId: "rifles", amount: 10 }],
};

const cavalry: MilitaryContentEntry = {
  id: "cavalry",
  manpower: 800,
  attack: 4,
  defense: 2,
  breakthrough: 3,
  organization: 8,
  hp: 16,
  speed: 7,
  supplyUse: 0.8,
  trainingCostDucats: 5,
  trainingCostManpower: 900,
  equipmentNeeds: [{ goodId: "horses", amount: 5 }],
};

describe("militaryMechanics", () => {
  it("detects supported military branches", () => {
    expect(isMilitaryBranch("land")).toBe(true);
    expect(isMilitaryBranch("naval")).toBe(true);
    expect(isMilitaryBranch("space")).toBe(false);
  });

  it("calculates land division stats and ignores unknown battalion types", () => {
    const stats = calculateDivisionStats(
      [
        { id: "a", battalionTypeId: "infantry", count: 2 },
        { id: "b", battalionTypeId: "cavalry", count: 1 },
        { id: "x", battalionTypeId: "missing", count: 99 },
      ],
      [infantry, cavalry],
    );

    expect(stats).toEqual({
      manpower: 2800,
      attack: 8,
      defense: 10,
      breakthrough: 5,
      organization: 9.333,
      hp: 56,
      speed: 4,
      supplyUse: 1.8,
    });
  });

  it("calculates land formation costs from battalion equipment", () => {
    const cost = calculateDivisionTrainingCost(
      [
        { id: "a", battalionTypeId: "infantry", count: 2 },
        { id: "b", battalionTypeId: "cavalry", count: 1 },
      ],
      [infantry, cavalry],
    );

    expect(cost).toEqual({
      ducats: 11,
      manpower: 2900,
      equipmentNeeds: [
        { goodId: "rifles", amount: 20 },
        { goodId: "horses", amount: 5 },
      ],
    });
  });

  it("converts land components to known battalions only", () => {
    expect(
      componentsToDivisionBattalions(
        [
          { id: "a", typeId: "infantry", count: 3 },
          { id: "missing", typeId: "missing", count: 1 },
        ],
        [infantry],
      ),
    ).toEqual([{ id: "a", battalionTypeId: "infantry", count: 3 }]);
  });

  it("normalizes division battalions with catalog validation and fallback IDs", () => {
    const ids = makeIdFactory();

    expect(
      normalizeDivisionBattalions({
        input: [
          { id: "kept", battalionTypeId: "infantry", count: 99 },
          { id: "missing", battalionTypeId: "missing", count: 1 },
          { battalionTypeId: "cavalry", count: 0 },
        ],
        battalionCatalog: [infantry, cavalry],
        fallbackBattalionTypeId: "infantry",
        createId: ids,
      }),
    ).toEqual([
      { id: "kept", battalionTypeId: "infantry", count: 24 },
      { id: "id-1", battalionTypeId: "cavalry", count: 1 },
    ]);
  });

  it("normalizes military template components and migrates land battalions", () => {
    const ids = makeIdFactory();

    expect(
      normalizeMilitaryTemplateComponents({
        input: [],
        kind: "land",
        catalog: [infantry],
        fallbackBattalions: [{ id: "old", battalionTypeId: "infantry", count: 6 }],
        createId: ids,
      }),
    ).toEqual([{ id: "old", typeId: "infantry", count: 6, role: "line" }]);
    expect(
      normalizeMilitaryTemplateComponents({
        input: [{ typeId: "cavalry", count: 100, role: "support" }],
        kind: "land",
        catalog: [infantry, cavalry],
        createId: ids,
      }),
    ).toEqual([{ id: "id-1", typeId: "cavalry", count: 24, role: "support" }]);
  });

  it("calculates non-land military stats and costs from the provided catalog", () => {
    const ship: MilitaryContentEntry = {
      ...cavalry,
      id: "frigate",
      manpower: 200,
      attack: 12,
      defense: 9,
      breakthrough: 4,
      organization: 20,
      hp: 80,
      speed: 10,
      supplyUse: 4,
      trainingCostDucats: 50,
      equipmentNeeds: [{ goodId: "timber", amount: 30 }],
    };

    expect(
      calculateMilitaryStats({
        kind: "naval",
        components: [{ id: "ship", typeId: "frigate", count: 2 }],
        catalog: [ship],
        battalionCatalog: [infantry],
      }),
    ).toMatchObject({ manpower: 400, attack: 24, organization: 20, speed: 10 });
    expect(
      calculateMilitaryFormationCost({
        kind: "naval",
        components: [{ id: "ship", typeId: "frigate", count: 2 }],
        catalog: [ship],
        battalionCatalog: [infantry],
      }),
    ).toEqual({ ducats: 100, manpower: 1800, equipmentNeeds: [{ goodId: "timber", amount: 60 }] });
  });

  it("normalizes and validates army movement routes", () => {
    expect(normalizeArmyMoveRoute({ path: [" province:b ", "", 1, "province:c"] }, "province:x", "province:a")).toEqual([
      "province:b",
      "province:c",
    ]);
    expect(normalizeArmyMoveRoute({}, "province:a", "province:a")).toEqual([]);
    expect(
      isContiguousArmyRoute({
        fromProvinceId: "province:a",
        route: ["province:b", "province:c"],
        areProvinceIdsAdjacentOrSame: (from, to) =>
          from === to || (from === "province:a" && to === "province:b") || (from === "province:b" && to === "province:c"),
      }),
    ).toBe(true);
  });

  it("captures empty enemy provinces and emits no battle event", () => {
    const worldBase = makeWorld({
      provinceOwner: { "province:a": "country:a", "province:b": "country:b" },
      divisionsById: { "division:a": makeDivision({ id: "division:a", countryId: "country:a", provinceId: "province:a" }) },
    });
    const events: MilitaryRuntimeEvent[] = [];
    const attacker = worldBase.divisionsById["division:a"]!;

    expect(resolveDivisionBattle({ attacker, targetProvinceId: "province:b", worldBase, provinces: makeProvinces(), events })).toBe(true);
    expect(attacker.provinceId).toBe("province:b");
    expect(worldBase.provinceOwner["province:b"]).toBe("country:a");
    expect(events).toEqual([]);
  });

  it("resolves battles and removes broken defenders without retreat paths", () => {
    const worldBase = makeWorld({
      provinceOwner: { "province:a": "country:a", "province:b": "country:b" },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          provinceId: "province:a",
          stats: { ...makeStats(), attack: 1000, breakthrough: 1000, hp: 100 },
        }),
        "division:b": makeDivision({
          id: "division:b",
          countryId: "country:b",
          provinceId: "province:b",
          organization: 0.01,
          stats: { ...makeStats(), defense: 1, hp: 1 },
        }),
      },
    });
    const events: MilitaryRuntimeEvent[] = [];

    expect(resolveDivisionBattle({ attacker: worldBase.divisionsById["division:a"]!, targetProvinceId: "province:b", worldBase, provinces: makeProvinces(), events })).toBe(true);
    expect(worldBase.divisionsById["division:b"]).toBeUndefined();
    expect(worldBase.divisionsById["division:a"]?.provinceId).toBe("province:b");
    expect(events.at(-1)).toMatchObject({ title: "Провинция захвачена", visibility: "public" });
  });

  it("advances divisions along peaceful routes and stores remaining path", () => {
    const worldBase = makeWorld({
      provinceOwner: { "province:a": "country:a", "province:b": "country:a", "province:c": "country:a" },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          provinceId: "province:a",
          stats: { ...makeStats(), speed: 1 },
        }),
      },
    });
    const events: MilitaryRuntimeEvent[] = [];
    const division = worldBase.divisionsById["division:a"]!;

    expect(advanceDivisionAlongRoute({ division, route: ["province:b", "province:c"], worldBase, provinces: makeProvinces(), turnId: 7, events })).toBe(true);
    expect(division).toMatchObject({ provinceId: "province:b", path: ["province:c"], status: "moving", lastMovedTurnId: 7 });
    expect(events.at(-1)).toMatchObject({ title: "Дивизия продолжает марш" });
  });

  it("resolves army move orders with validation, movement, and duplicate move protection", () => {
    const worldBase = makeWorld({
      provinceOwner: { "province:a": "country:a", "province:b": "country:a", "province:c": "country:a" },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          provinceId: "province:a",
          stats: { ...makeStats(), speed: 1 },
        }),
      },
    });
    const movedDivisionIds = new Set<string>();
    const events: MilitaryRuntimeEvent[] = [];

    const result = resolveArmyMoveOrder({
      order: makeOrder({
        id: "order:a",
        countryId: "country:a",
        provinceId: "province:b",
        payload: { divisionId: "division:a", path: ["province:b", "province:c"] },
      }),
      playerId: "player:a",
      worldBase,
      provinces: makeProvinces(),
      turnId: 7,
      movedDivisionIds,
      events,
      areProvinceIdsAdjacentOrSame,
    });

    expect(result).toEqual({ rejectedOrder: null, moved: true });
    expect(movedDivisionIds.has("division:a")).toBe(true);
    expect(worldBase.divisionsById["division:a"]).toMatchObject({
      provinceId: "province:b",
      path: ["province:c"],
      lastMovedTurnId: 7,
    });
    expect(events.at(-1)).toMatchObject({ title: "Дивизия продолжает марш" });

    expect(
      resolveArmyMoveOrder({
        order: makeOrder({
          id: "order:b",
          countryId: "country:a",
          provinceId: "province:c",
          payload: { divisionId: "division:a", path: ["province:c"] },
        }),
        playerId: "player:a",
        worldBase,
        provinces: makeProvinces(),
        turnId: 7,
        movedDivisionIds,
        events: [],
        areProvinceIdsAdjacentOrSame,
      }).rejectedOrder,
    ).toEqual({ playerId: "player:a", reason: "DIVISION_ALREADY_MOVED", tempOrderId: "order:b" });
  });

  it("advances stored army routes after orders and clears invalid stored paths", () => {
    const worldBase = makeWorld({
      provinceOwner: { "province:a": "country:a", "province:b": "country:a", "province:c": "country:a" },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          provinceId: "province:a",
          path: ["province:b", "province:c"],
          stats: { ...makeStats(), speed: 1 },
        }),
        "division:bad": makeDivision({
          id: "division:bad",
          countryId: "country:a",
          provinceId: "province:a",
          path: ["province:c"],
          stats: { ...makeStats(), speed: 1 },
        }),
      },
    });
    const events: MilitaryRuntimeEvent[] = [];

    advanceStoredArmyRoutesTurn({
      worldBase,
      provinces: makeProvinces(),
      turnId: 8,
      movedDivisionIds: new Set(),
      events,
      areProvinceIdsAdjacentOrSame,
    });

    expect(worldBase.divisionsById["division:a"]).toMatchObject({
      provinceId: "province:b",
      path: ["province:c"],
      status: "moving",
      lastMovedTurnId: 8,
    });
    expect(worldBase.divisionsById["division:bad"]).toMatchObject({
      provinceId: "province:a",
      path: [],
      status: "idle",
    });
    expect(events).toEqual([expect.objectContaining({ title: "Дивизия продолжает марш" })]);
  });

  it("advances military formation queues into divisions", () => {
    const worldBase = makeWorld({
      divisionTemplatesByCountry: {
        "country:a": [
          {
            id: "template:a",
            countryId: "country:a",
            name: "First Division",
            kind: "land",
            battalions: [],
            components: [],
            stats: makeStats(),
            createdTurnId: 1,
            updatedTurnId: 1,
          },
        ],
      },
      militaryFormationQueueByCountry: {
        "country:a": [
          {
            id: "queue:a",
            countryId: "country:a",
            kind: "land",
            templateId: "template:a",
            name: "",
            provinceId: "province:a",
            progress: 0,
            turnsTotal: 1,
            turnsRemaining: 1,
            cost: { ducats: 0, manpower: 0, equipmentNeeds: [] },
            createdTurnId: 1,
          },
        ],
      },
    });
    const events: MilitaryRuntimeEvent[] = [];

    advanceMilitaryFormationQueue({ worldBase, turnId: 5, createId: () => "division:created", events });

    expect(worldBase.divisionsById["division:created"]).toMatchObject({
      countryId: "country:a",
      name: "First Division",
      provinceId: "province:a",
      status: "idle",
    });
    expect(worldBase.militaryFormationQueueByCountry["country:a"]).toBeUndefined();
    expect(events).toEqual([expect.objectContaining({ title: "Формирование завершено" })]);
  });

  it("calculates formation turns and spends ducats/equipment through explicit state", () => {
    expect(calculateFormationTurns({ cost: { manpower: 2000, equipmentNeeds: [{ goodId: "rifles", amount: 18 }] }, militaryFormationSpeed: 10 })).toBe(2);

    const resources = { culture: 0, science: 0, religion: 0, colonization: 0, construction: 0, ducats: 20, gold: 0 };
    const warehouse = { rifles: 10 };
    expect(
      spendMilitaryFormationCost({
        countryResource: resources,
        warehouseByResourceId: warehouse,
        cost: { ducats: 5, equipmentNeeds: [{ goodId: "rifles", amount: 12 }] },
      }),
    ).toEqual({ ok: false, error: "NOT_ENOUGH_EQUIPMENT", details: { goodId: "rifles", required: 12, available: 10 } });
    expect(
      spendMilitaryFormationCost({
        countryResource: resources,
        warehouseByResourceId: warehouse,
        cost: { ducats: 5, equipmentNeeds: [{ goodId: "rifles", amount: 4 }] },
      }),
    ).toEqual({ ok: true });
    expect(resources.ducats).toBe(15);
    expect(warehouse.rifles).toBe(6);
  });
});

function makeIdFactory(): () => string {
  let next = 1;
  return () => `id-${next++}`;
}

function makeStats(overrides?: Partial<ReturnType<typeof calculateDivisionStats>>): ReturnType<typeof calculateDivisionStats> {
  return {
    manpower: 1000,
    attack: 10,
    defense: 10,
    breakthrough: 5,
    organization: 10,
    hp: 10,
    speed: 1,
    supplyUse: 1,
    ...overrides,
  };
}

function makeDivision(overrides?: Partial<MilitaryWorldState["divisionsById"][string]>): MilitaryWorldState["divisionsById"][string] {
  return {
    id: "division:a",
    countryId: "country:a",
    templateId: "template:a",
    name: "First Division",
    kind: "land",
    provinceId: "province:a",
    strength: 1,
    organization: 10,
    stats: makeStats(),
    status: "idle",
    path: [],
    createdTurnId: 1,
    lastMovedTurnId: null,
    ...overrides,
  };
}

function makeOrder(
  overrides?: Omit<Partial<Extract<Order, { type: "ARMY_MOVE" }>>, "type">,
): Extract<Order, { type: "ARMY_MOVE" }> {
  return {
    id: "order:test",
    turnId: 1,
    playerId: "player:a",
    countryId: "country:a",
    provinceId: "province:a",
    type: "ARMY_MOVE",
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeWorld(overrides?: Partial<MilitaryWorldState>): MilitaryWorldState {
  return {
    provinceOwner: {},
    divisionsById: {},
    divisionTemplatesByCountry: {},
    militaryFormationQueueByCountry: {},
    resourcesByCountry: {},
    ...overrides,
  };
}

function makeProvinces() {
  return [
    { id: "province:a", neighbors: ["province:b"] },
    { id: "province:b", neighbors: ["province:a", "province:c"] },
    { id: "province:c", neighbors: ["province:b"] },
  ];
}

function areProvinceIdsAdjacentOrSame(from: string, to: string): boolean {
  return from === to || makeProvinces().some((province) => province.id === from && province.neighbors.includes(to));
}
