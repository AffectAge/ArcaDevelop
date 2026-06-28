import { describe, expect, it } from "vitest";
import type { CivilianUnit, Order } from "@arcanorum/shared";
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
  resolveUnitAttackOrder,
  refreshCountryDivisionEquipmentState,
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
      armor: 0,
      piercing: 0,
      organization: 9.333,
      hp: 56,
      speed: 4,
      range: 0,
      reliability: 0,
      supplyUse: 1.8,
      fuelUse: 0,
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
    expect(normalizeArmyMoveRoute({ path: [" hex:1:0 ", "", 1, "hex:2:0"] }, "hex:9:0", "hex:0:0")).toEqual([
      "hex:1:0",
      "hex:2:0",
    ]);
    expect(normalizeArmyMoveRoute({}, "hex:0:0", "hex:0:0")).toEqual([]);
    expect(
      isContiguousArmyRoute({
        fromHexId: "hex:0:0",
        route: ["hex:1:0", "hex:2:0"],
        areHexIdsAdjacentOrSame: (from, to) =>
          from === to || (from === "hex:0:0" && to === "hex:1:0") || (from === "hex:1:0" && to === "hex:2:0"),
      }),
    ).toBe(true);
  });

  it("captures empty enemy hexes and emits no battle event", () => {
    const worldBase = makeWorld({
      hexOwner: { "hex:0:0": "country:a", "hex:1:0": "country:b" },
      divisionsById: { "division:a": makeDivision({ id: "division:a", countryId: "country:a", hexId: "hex:0:0" }) },
    });
    const events: MilitaryRuntimeEvent[] = [];
    const attacker = worldBase.divisionsById["division:a"]!;

    expect(resolveDivisionBattle({ attacker, targetHexId: "hex:1:0", worldBase, hexes: makeHexes(), events })).toBe(true);
    expect(attacker.hexId).toBe("hex:1:0");
    expect(worldBase.hexOwner["hex:1:0"]).toBe("country:a");
    expect(events).toEqual([]);
  });

  it("resolves battles and removes broken defenders without retreat paths", () => {
    const worldBase = makeWorld({
      hexOwner: { "hex:0:0": "country:a", "hex:1:0": "country:b" },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          hexId: "hex:0:0",
          stats: { ...makeStats(), attack: 1000, breakthrough: 1000, hp: 100 },
        }),
        "division:b": makeDivision({
          id: "division:b",
          countryId: "country:b",
          hexId: "hex:1:0",
          organization: 0.01,
          stats: { ...makeStats(), defense: 1, hp: 1 },
        }),
      },
    });
    const events: MilitaryRuntimeEvent[] = [];

    expect(resolveDivisionBattle({ attacker: worldBase.divisionsById["division:a"]!, targetHexId: "hex:1:0", worldBase, hexes: makeHexes(), events })).toBe(true);
    expect(worldBase.divisionsById["division:b"]).toBeUndefined();
    expect(worldBase.divisionsById["division:a"]?.hexId).toBe("hex:1:0");
    expect(events.at(-1)).toMatchObject({ title: "Hex захвачен", visibility: "public" });
  });

  it("applies equipment loadout losses when battle damage reduces division strength", () => {
    const worldBase = makeWorld({
      hexOwner: { "hex:0:0": "country:a", "hex:1:0": "country:b" },
      divisionTemplatesByCountry: {
        "country:b": [
          {
            id: "template:b",
            countryId: "country:b",
            name: "Infantry",
            kind: "land",
            battalions: [],
            equipmentRequirements: [{ id: "rifles", equipmentClassId: "equipment-class:infantry", role: "defense", count: 100 }],
            stats: makeStats({ hp: 100 }),
            createdTurnId: 1,
            updatedTurnId: 1,
          },
        ],
      },
      equipmentVariantsById: {
        "equipment:rifle": {
          id: "equipment:rifle",
          countryId: "country:b",
          classId: "equipment-class:infantry",
          name: "Rifle",
          moduleIdsBySlotId: {},
          stats: { attack: 1, defense: 4 },
          goodsCost: [],
          createdTurnId: 1,
        },
      },
      equipmentStockpileByCountry: {
        "country:b": {},
      },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          hexId: "hex:0:0",
          stats: { ...makeStats(), attack: 100, breakthrough: 0, hp: 100 },
        }),
        "division:b": makeDivision({
          id: "division:b",
          countryId: "country:b",
          templateId: "template:b",
          hexId: "hex:1:0",
          stats: makeStats({ hp: 100 }),
          equipmentByVariantId: { "equipment:rifle": 100 },
          equipmentAssignments: [
            {
              requirementId: "rifles",
              equipmentVariantId: "equipment:rifle",
              score: 4.25,
              requiredCount: 100,
              assignedCount: 100,
              coverage: 1,
            },
          ],
        }),
      },
    });
    const events: MilitaryRuntimeEvent[] = [];

    expect(resolveDivisionBattle({ attacker: worldBase.divisionsById["division:a"]!, targetHexId: "hex:1:0", worldBase, hexes: makeHexes(), events })).toBe(false);

    expect(worldBase.divisionsById["division:b"]?.strength).toBe(0.96);
    expect(worldBase.equipmentStockpileByCountry["country:b"]).toEqual({});
    expect(worldBase.divisionsById["division:b"]?.equipmentByVariantId).toEqual({ "equipment:rifle": 96 });
    expect(worldBase.divisionsById["division:b"]?.equipmentCoverage).toBe(0.96);
    expect(worldBase.divisionsById["division:b"]?.stats.hp).toBe(96.6);
  });

  it("allocates equipment assignments across country divisions without double-counting stockpile", () => {
    const worldBase = makeWorld({
      divisionTemplatesByCountry: {
        "country:a": [
          {
            id: "template:a",
            countryId: "country:a",
            name: "Infantry",
            kind: "land",
            battalions: [],
            equipmentRequirements: [{ id: "rifles", equipmentClassId: "equipment-class:infantry", role: "attack", count: 70 }],
            stats: makeStats({ hp: 100 }),
            createdTurnId: 1,
            updatedTurnId: 1,
          },
        ],
      },
      equipmentVariantsById: {
        "equipment:rifle": {
          id: "equipment:rifle",
          countryId: "country:a",
          classId: "equipment-class:infantry",
          name: "Rifle",
          moduleIdsBySlotId: {},
          stats: { attack: 4, defense: 4 },
          goodsCost: [],
          createdTurnId: 1,
        },
      },
      equipmentStockpileByCountry: {
        "country:a": { "equipment:rifle": 100 },
      },
      divisionsById: {
        "division:a": makeDivision({ id: "division:a", countryId: "country:a", templateId: "template:a" }),
        "division:b": makeDivision({ id: "division:b", countryId: "country:a", templateId: "template:a" }),
      },
    });

    refreshCountryDivisionEquipmentState({ countryId: "country:a", worldBase, turnId: 9 });

    expect(worldBase.divisionsById["division:a"]?.equipmentAssignments).toEqual([
      expect.objectContaining({ requirementId: "rifles", equipmentVariantId: "equipment:rifle", assignedCount: 70, coverage: 1 }),
    ]);
    expect(worldBase.divisionsById["division:b"]?.equipmentAssignments).toEqual([
      expect.objectContaining({ requirementId: "rifles", equipmentVariantId: "equipment:rifle", assignedCount: 30, coverage: 0.429 }),
    ]);
    expect(worldBase.divisionsById["division:a"]?.equipmentByVariantId).toEqual({ "equipment:rifle": 70 });
    expect(worldBase.divisionsById["division:b"]?.equipmentByVariantId).toEqual({ "equipment:rifle": 30 });
    expect(worldBase.divisionsById["division:a"]?.equipmentSupplyReport).toEqual({
      turnId: 9,
      receivedByVariantId: { "equipment:rifle": 70 },
      returnedByVariantId: {},
    });
    expect(worldBase.divisionsById["division:b"]?.equipmentSupplyReport).toEqual({
      turnId: 9,
      receivedByVariantId: { "equipment:rifle": 30 },
      returnedByVariantId: {},
    });
    expect(worldBase.equipmentStockpileByCountry["country:a"]).toEqual({});
    expect(worldBase.divisionsById["division:a"]?.equipmentCoverage).toBe(1);
    expect(worldBase.divisionsById["division:b"]?.equipmentCoverage).toBe(0.429);
  });

  it("allocates scarce equipment to higher supply priority divisions first", () => {
    const worldBase = makeWorld({
      divisionTemplatesByCountry: {
        "country:a": [
          {
            id: "template:a",
            countryId: "country:a",
            name: "Infantry",
            kind: "land",
            battalions: [],
            equipmentRequirements: [{ id: "rifles", equipmentClassId: "equipment-class:infantry", role: "attack", count: 70 }],
            stats: makeStats({ hp: 100 }),
            createdTurnId: 1,
            updatedTurnId: 1,
          },
        ],
      },
      equipmentVariantsById: {
        "equipment:rifle": {
          id: "equipment:rifle",
          countryId: "country:a",
          classId: "equipment-class:infantry",
          name: "Rifle",
          moduleIdsBySlotId: {},
          stats: { attack: 4, defense: 4 },
          goodsCost: [],
          createdTurnId: 1,
        },
      },
      equipmentStockpileByCountry: {
        "country:a": { "equipment:rifle": 70 },
      },
      divisionsById: {
        "division:a": makeDivision({ id: "division:a", countryId: "country:a", templateId: "template:a", supplyPriority: "low" }),
        "division:z": makeDivision({ id: "division:z", countryId: "country:a", templateId: "template:a", supplyPriority: "high" }),
      },
    });

    refreshCountryDivisionEquipmentState({ countryId: "country:a", worldBase });

    expect(worldBase.divisionsById["division:z"]?.equipmentByVariantId).toEqual({ "equipment:rifle": 70 });
    expect(worldBase.divisionsById["division:a"]?.equipmentByVariantId).toEqual({});
    expect(worldBase.divisionsById["division:z"]?.equipmentCoverage).toBe(1);
    expect(worldBase.divisionsById["division:a"]?.equipmentCoverage).toBe(0);
  });

  it("returns no-longer-needed division equipment back to country stockpile during refresh", () => {
    const worldBase = makeWorld({
      divisionTemplatesByCountry: {
        "country:a": [
          {
            id: "template:a",
            countryId: "country:a",
            name: "Infantry",
            kind: "land",
            battalions: [],
            equipmentRequirements: [],
            stats: makeStats(),
            createdTurnId: 1,
            updatedTurnId: 1,
          },
        ],
      },
      equipmentStockpileByCountry: {
        "country:a": {},
      },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          templateId: "template:a",
          equipmentByVariantId: { "equipment:rifle": 42 },
        }),
      },
    });

    refreshCountryDivisionEquipmentState({ countryId: "country:a", worldBase, turnId: 10 });

    expect(worldBase.divisionsById["division:a"]?.equipmentByVariantId).toEqual({});
    expect(worldBase.divisionsById["division:a"]?.equipmentAssignments).toEqual([]);
    expect(worldBase.divisionsById["division:a"]?.equipmentSupplyReport).toEqual({
      turnId: 10,
      receivedByVariantId: {},
      returnedByVariantId: { "equipment:rifle": 42 },
    });
    expect(worldBase.equipmentStockpileByCountry["country:a"]).toEqual({ "equipment:rifle": 42 });
  });

  it("advances divisions along peaceful routes and stores remaining path", () => {
    const worldBase = makeWorld({
      hexOwner: { "hex:0:0": "country:a", "hex:1:0": "country:a", "hex:2:0": "country:a" },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          hexId: "hex:0:0",
          stats: { ...makeStats(), speed: 1 },
        }),
      },
    });
    const events: MilitaryRuntimeEvent[] = [];
    const division = worldBase.divisionsById["division:a"]!;

    expect(advanceDivisionAlongRoute({ division, route: ["hex:1:0", "hex:2:0"], worldBase, hexes: makeHexes(), turnId: 7, events })).toBe(true);
    expect(division).toMatchObject({ hexId: "hex:1:0", path: ["hex:2:0"], status: "moving", lastMovedTurnId: 7 });
    expect(events.at(-1)).toMatchObject({ title: "Дивизия продолжает марш" });
  });

  it("captures foreign civilian units when a land division enters their hex", () => {
    const worldBase = makeWorld({
      hexOwner: { "hex:0:0": "country:a", "hex:1:0": "country:a" },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          hexId: "hex:0:0",
          stats: { ...makeStats(), speed: 1 },
        }),
      },
      civilianUnitsById: {
        "civilian:b": makeCivilianUnit({ id: "civilian:b", countryId: "country:b", hexId: "hex:1:0" }),
        "civilian:a": makeCivilianUnit({ id: "civilian:a", countryId: "country:a", hexId: "hex:1:0" }),
      },
    });
    const events: MilitaryRuntimeEvent[] = [];
    const division = worldBase.divisionsById["division:a"]!;

    expect(advanceDivisionAlongRoute({ division, route: ["hex:1:0"], worldBase, hexes: makeHexes(), turnId: 7, events })).toBe(true);

    expect(worldBase.civilianUnitsById["civilian:b"]).toMatchObject({
      status: "captured",
      capturedByCountryId: "country:a",
      path: [],
      targetHexId: null,
    });
    expect(worldBase.civilianUnitsById["civilian:a"]).toMatchObject({ status: "idle", capturedByCountryId: null });
    expect(events).toEqual([
      expect.objectContaining({ title: "Гражданский юнит захвачен", countryId: "country:a" }),
      expect.objectContaining({ title: "Передислокация дивизии" }),
    ]);
  });

  it("captures foreign civilian units after winning a battle for their hex", () => {
    const worldBase = makeWorld({
      hexOwner: { "hex:0:0": "country:a", "hex:1:0": "country:b" },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          hexId: "hex:0:0",
          stats: { ...makeStats(), attack: 1000, breakthrough: 1000, hp: 100 },
        }),
        "division:b": makeDivision({
          id: "division:b",
          countryId: "country:b",
          hexId: "hex:1:0",
          organization: 0.01,
          stats: { ...makeStats(), defense: 1, hp: 1 },
        }),
      },
      civilianUnitsById: {
        "civilian:b": makeCivilianUnit({ id: "civilian:b", countryId: "country:b", hexId: "hex:1:0" }),
      },
    });
    const events: MilitaryRuntimeEvent[] = [];

    expect(resolveDivisionBattle({ attacker: worldBase.divisionsById["division:a"]!, targetHexId: "hex:1:0", worldBase, hexes: makeHexes(), events })).toBe(true);

    expect(worldBase.civilianUnitsById["civilian:b"]).toMatchObject({
      status: "captured",
      capturedByCountryId: "country:a",
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Гражданский юнит захвачен" }),
        expect.objectContaining({ title: "Hex захвачен" }),
      ]),
    );
  });

  it("resolves UNIT_ATTACK with a land division and consumes its action", () => {
    const worldBase = makeWorld({
      hexOwner: { "hex:0:0": "country:a", "hex:1:0": "country:b" },
      divisionsById: {
        "division:a": makeDivision({ id: "division:a", countryId: "country:a", hexId: "hex:0:0" }),
        "division:b": makeDivision({ id: "division:b", countryId: "country:b", hexId: "hex:1:0" }),
      },
    });
    const movedDivisionIds = new Set<string>();
    const events: MilitaryRuntimeEvent[] = [];

    const result = resolveUnitAttackOrder({
      order: makeAttackOrder({ attackerUnitId: "division:a", targetHexId: "hex:1:0", targetUnitId: "division:b" }),
      playerId: "player:a",
      worldBase,
      hexes: makeHexes(),
      turnId: 9,
      movedDivisionIds,
      events,
      areHexIdsAdjacentOrSame,
    });

    expect(result.rejectedOrder).toBeNull();
    expect(result.attacked).toBe(false);
    expect(movedDivisionIds.has("division:a")).toBe(true);
    expect(worldBase.divisionsById["division:a"]).toMatchObject({ lastMovedTurnId: 9, path: [], targetHexId: null });
    expect(worldBase.divisionsById["division:b"]?.organization).toBeLessThan(10);
    expect(events).toEqual([expect.objectContaining({ title: "Бой продолжается" })]);
  });

  it("rejects UNIT_ATTACK without an adjacent attackable target", () => {
    const worldBase = makeWorld({
      hexOwner: { "hex:0:0": "country:a", "hex:2:0": "country:b" },
      divisionsById: {
        "division:a": makeDivision({ id: "division:a", countryId: "country:a", hexId: "hex:0:0" }),
      },
    });

    expect(
      resolveUnitAttackOrder({
        order: makeAttackOrder({ attackerUnitId: "division:a", targetHexId: "hex:2:0" }),
        playerId: "player:a",
        worldBase,
        hexes: makeHexes(),
        turnId: 9,
        movedDivisionIds: new Set(),
        events: [],
        areHexIdsAdjacentOrSame,
      }).rejectedOrder,
    ).toEqual({ playerId: "player:a", reason: "UNIT_ATTACK_TARGET_INVALID", tempOrderId: "order:attack" });
  });

  it("resolves army move orders with validation, movement, and duplicate move protection", () => {
    const worldBase = makeWorld({
      hexOwner: { "hex:0:0": "country:a", "hex:1:0": "country:a", "hex:2:0": "country:a" },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          hexId: "hex:0:0",
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
        targetHexId: "hex:1:0",
        payload: { divisionId: "division:a", path: ["hex:1:0", "hex:2:0"] },
      }),
      playerId: "player:a",
      worldBase,
      hexes: makeHexes(),
      turnId: 7,
      movedDivisionIds,
      events,
      areHexIdsAdjacentOrSame,
    });

    expect(result).toEqual({ rejectedOrder: null, moved: true });
    expect(movedDivisionIds.has("division:a")).toBe(true);
    expect(worldBase.divisionsById["division:a"]).toMatchObject({
      hexId: "hex:1:0",
      path: ["hex:2:0"],
      lastMovedTurnId: 7,
    });
    expect(events.at(-1)).toMatchObject({ title: "Дивизия продолжает марш" });

    expect(
      resolveArmyMoveOrder({
        order: makeOrder({
          id: "order:b",
          countryId: "country:a",
          targetHexId: "hex:2:0",
          payload: { divisionId: "division:a", path: ["hex:2:0"] },
        }),
        playerId: "player:a",
        worldBase,
        hexes: makeHexes(),
        turnId: 7,
        movedDivisionIds,
        events: [],
        areHexIdsAdjacentOrSame,
      }).rejectedOrder,
    ).toEqual({ playerId: "player:a", reason: "DIVISION_ALREADY_MOVED", tempOrderId: "order:b" });
  });

  it("accepts a distant division target and stores it while moving only by speed", () => {
    const worldBase = makeWorld({
      hexOwner: { "hex:0:0": "country:a", "hex:1:0": "country:a", "hex:2:0": "country:a", "hex:3:0": "country:a" },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          hexId: "hex:0:0",
          stats: { ...makeStats(), speed: 1 },
        }),
      },
    });
    const events: MilitaryRuntimeEvent[] = [];

    const result = resolveArmyMoveOrder({
      order: makeOrder({
        id: "order:a",
        countryId: "country:a",
        targetHexId: "hex:3:0",
        payload: { divisionId: "division:a" },
      }),
      playerId: "player:a",
      worldBase,
      hexes: makeHexes(),
      turnId: 7,
      movedDivisionIds: new Set(),
      events,
      areHexIdsAdjacentOrSame,
      getNeighborHexIds,
    });

    expect(result).toEqual({ rejectedOrder: null, moved: true });
    expect(worldBase.divisionsById["division:a"]).toMatchObject({
      hexId: "hex:1:0",
      targetHexId: "hex:3:0",
      path: ["hex:2:0", "hex:3:0"],
      status: "moving",
    });
  });

  it("rejects peaceful division movement into a full stack hex", () => {
    const worldBase = makeWorld({
      hexOwner: { "hex:0:0": "country:a", "hex:1:0": "country:a" },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          hexId: "hex:0:0",
          stats: { ...makeStats(), speed: 1 },
        }),
        "division:blocker": makeDivision({
          id: "division:blocker",
          countryId: "country:a",
          hexId: "hex:1:0",
        }),
      },
    });

    const result = resolveArmyMoveOrder({
      order: makeOrder({
        id: "order:a",
        countryId: "country:a",
        targetHexId: "hex:1:0",
        payload: { divisionId: "division:a", path: ["hex:1:0"] },
      }),
      playerId: "player:a",
      worldBase,
      hexes: makeHexes(),
      turnId: 7,
      movedDivisionIds: new Set(),
      events: [],
      areHexIdsAdjacentOrSame,
      landDivisionStackLimitPerHex: 1,
    });

    expect(result.rejectedOrder).toEqual({
      playerId: "player:a",
      reason: "DIVISION_STACK_LIMIT_REACHED",
      tempOrderId: "order:a",
    });
    expect(worldBase.divisionsById["division:a"]?.hexId).toBe("hex:0:0");
  });

  it("recalculates a division target route on the next turn", () => {
    const worldBase = makeWorld({
      hexOwner: {
        "hex:0:0": "country:a",
        "hex:0:1": "country:a",
        "hex:1:0": "country:a",
        "hex:3:0": "country:a",
      },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          hexId: "hex:0:0",
          path: ["hex:1:0", "hex:3:0"],
          targetHexId: "hex:3:0",
          stats: { ...makeStats(), speed: 1 },
          status: "moving",
          lastMovedTurnId: 7,
        }),
      },
    });
    const events: MilitaryRuntimeEvent[] = [];

    advanceStoredArmyRoutesTurn({
      worldBase,
      hexes: makeHexes(),
      turnId: 8,
      movedDivisionIds: new Set(),
      events,
      areHexIdsAdjacentOrSame: (from, to) => {
        const graph: Record<string, string[]> = {
          "hex:0:0": ["hex:1:0", "hex:0:1"],
          "hex:0:1": ["hex:0:0", "hex:3:0"],
          "hex:1:0": ["hex:0:0", "hex:3:0"],
          "hex:3:0": ["hex:0:1", "hex:1:0"],
        };
        return from === to || (graph[from] ?? []).includes(to);
      },
      getNeighborHexIds: (hexId) => {
        const graph: Record<string, string[]> = {
          "hex:0:0": ["hex:1:0", "hex:0:1"],
          "hex:0:1": ["hex:0:0", "hex:3:0"],
          "hex:1:0": ["hex:0:0", "hex:3:0"],
          "hex:3:0": ["hex:0:1", "hex:1:0"],
        };
        return (graph[hexId] ?? []).filter((id): id is `hex:${number}:${number}` => /^hex:-?\d+:-?\d+$/.test(id));
      },
      getHexMovementCost: (hexId) => (hexId === "hex:1:0" ? 99 : 1),
    });

    expect(worldBase.divisionsById["division:a"]).toMatchObject({
      hexId: "hex:0:1",
      targetHexId: "hex:3:0",
      path: ["hex:3:0"],
      status: "moving",
      lastMovedTurnId: 8,
    });
  });

  it("advances stored army routes after orders and clears invalid stored paths", () => {
    const worldBase = makeWorld({
      hexOwner: { "hex:0:0": "country:a", "hex:1:0": "country:a", "hex:2:0": "country:a" },
      divisionsById: {
        "division:a": makeDivision({
          id: "division:a",
          countryId: "country:a",
          hexId: "hex:0:0",
          path: ["hex:1:0", "hex:2:0"],
          stats: { ...makeStats(), speed: 1 },
        }),
        "division:bad": makeDivision({
          id: "division:bad",
          countryId: "country:a",
          hexId: "hex:0:0",
          path: ["hex:2:0"],
          stats: { ...makeStats(), speed: 1 },
        }),
      },
    });
    const events: MilitaryRuntimeEvent[] = [];

    advanceStoredArmyRoutesTurn({
      worldBase,
      hexes: makeHexes(),
      turnId: 8,
      movedDivisionIds: new Set(),
      events,
      areHexIdsAdjacentOrSame,
    });

    expect(worldBase.divisionsById["division:a"]).toMatchObject({
      hexId: "hex:1:0",
      path: ["hex:2:0"],
      status: "moving",
      lastMovedTurnId: 8,
    });
    expect(worldBase.divisionsById["division:bad"]).toMatchObject({
      hexId: "hex:0:0",
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
            hexId: "hex:0:0",
            quantity: 1,
            remainingQuantity: 1,
            priority: "normal",
            repeat: false,
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
      hexId: "hex:0:0",
      status: "idle",
    });
    expect(worldBase.militaryFormationQueueByCountry["country:a"]).toBeUndefined();
    expect(events).toEqual([expect.objectContaining({ title: "Формирование завершено" })]);
  });

  it("keeps quantity formation queued after completing one unit", () => {
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
            name: "First Division",
            hexId: "hex:0:0",
            quantity: 3,
            remainingQuantity: 3,
            priority: "normal",
            repeat: false,
            progress: 0,
            turnsTotal: 1,
            turnsRemaining: 1,
            cost: { ducats: 0, manpower: 0, equipmentNeeds: [] },
            createdTurnId: 1,
          },
        ],
      },
    });

    advanceMilitaryFormationQueue({ worldBase, turnId: 5, createId: () => "division:created", events: [] });

    expect(worldBase.divisionsById["division:created"]).toBeDefined();
    expect(worldBase.militaryFormationQueueByCountry["country:a"]).toEqual([
      expect.objectContaining({ id: "queue:a", remainingQuantity: 2, progress: 0, turnsRemaining: 1 }),
    ]);
  });

  it("advances naval and air formation queues into dedicated unit containers", () => {
    const worldBase = makeWorld({
      divisionTemplatesByCountry: {
        "country:a": [
          {
            id: "template:fleet",
            countryId: "country:a",
            name: "First Fleet",
            kind: "naval",
            battalions: [],
            components: [],
            stats: makeStats(),
            createdTurnId: 1,
            updatedTurnId: 1,
          },
          {
            id: "template:air",
            countryId: "country:a",
            name: "First Air Wing",
            kind: "air",
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
            id: "queue:fleet",
            countryId: "country:a",
            kind: "naval",
            templateId: "template:fleet",
            name: "",
            hexId: "hex:0:0",
            quantity: 1,
            remainingQuantity: 1,
            priority: "normal",
            repeat: false,
            progress: 0,
            turnsTotal: 1,
            turnsRemaining: 1,
            cost: { ducats: 0, manpower: 0, equipmentNeeds: [] },
            createdTurnId: 1,
          },
          {
            id: "queue:air",
            countryId: "country:a",
            kind: "air",
            templateId: "template:air",
            name: "",
            hexId: "hex:1:0",
            quantity: 1,
            remainingQuantity: 1,
            priority: "normal",
            repeat: false,
            progress: 0,
            turnsTotal: 1,
            turnsRemaining: 1,
            cost: { ducats: 0, manpower: 0, equipmentNeeds: [] },
            createdTurnId: 1,
          },
        ],
      },
    });
    const ids = ["fleet:created", "air-wing:created"];
    const events: MilitaryRuntimeEvent[] = [];

    advanceMilitaryFormationQueue({ worldBase, turnId: 5, createId: () => ids.shift() ?? "unit:extra", events });

    expect(worldBase.divisionsById).toEqual({});
    expect(worldBase.fleetsById["fleet:created"]).toMatchObject({
      countryId: "country:a",
      name: "First Fleet",
      hexId: "hex:0:0",
      status: "idle",
    });
    expect(worldBase.airWingsById["air-wing:created"]).toMatchObject({
      countryId: "country:a",
      name: "First Air Wing",
      baseHexId: "hex:1:0",
      status: "idle",
      mission: "none",
    });
    expect(worldBase.militaryFormationQueueByCountry["country:a"]).toBeUndefined();
  });

  it("keeps completed land formation queued when the target hex is full", () => {
    const worldBase = makeWorld({
      divisionsById: {
        "division:blocker": makeDivision({
          id: "division:blocker",
          countryId: "country:a",
          hexId: "hex:0:0",
        }),
      },
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
            hexId: "hex:0:0",
            quantity: 1,
            remainingQuantity: 1,
            priority: "normal",
            repeat: false,
            progress: 0.9,
            turnsTotal: 1,
            turnsRemaining: 1,
            cost: { ducats: 0, manpower: 0, equipmentNeeds: [] },
            createdTurnId: 1,
          },
        ],
      },
    });
    const events: MilitaryRuntimeEvent[] = [];

    advanceMilitaryFormationQueue({
      worldBase,
      turnId: 5,
      createId: () => "division:created",
      events,
      landDivisionStackLimitPerHex: 1,
    });

    expect(worldBase.divisionsById["division:created"]).toBeUndefined();
    expect(worldBase.militaryFormationQueueByCountry["country:a"]).toEqual([
      expect.objectContaining({ id: "queue:a", progress: 1, turnsRemaining: 0 }),
    ]);
    expect(events).toEqual([expect.objectContaining({ title: "Формирование ожидает места" })]);
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
    hexId: "hex:0:0",
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

function makeCivilianUnit(overrides?: Partial<CivilianUnit>): CivilianUnit {
  return {
    id: "civilian:a",
    countryId: "country:a",
    type: "colonizer",
    hexId: "hex:0:0",
    status: "idle",
    movementPoints: 2,
    maxMovementPoints: 2,
    path: [],
    targetHexId: null,
    createdTurnId: 1,
    lastMovedTurnId: null,
    capturedByCountryId: null,
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
    targetHexId: "hex:0:0",
    type: "ARMY_MOVE",
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeWorld(overrides?: Partial<MilitaryWorldState>): MilitaryWorldState {
  return {
    hexOwner: {},
    divisionsById: {},
    fleetsById: {},
    airWingsById: {},
    divisionTemplatesByCountry: {},
    militaryFormationQueueByCountry: {},
    resourcesByCountry: {},
    civilianUnitsById: {},
    equipmentVariantsById: {},
    equipmentStockpileByCountry: {},
    ...overrides,
  };
}

function makeAttackOrder(
  overrides?: Omit<Partial<Extract<Order, { type: "UNIT_ATTACK" }>>, "type">,
): Extract<Order, { type: "UNIT_ATTACK" }> {
  return {
    id: "order:attack",
    turnId: 1,
    playerId: "player:a",
    countryId: "country:a",
    type: "UNIT_ATTACK",
    attackerUnitId: "division:a",
    targetHexId: "hex:1:0",
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeHexes() {
  return [
    { id: "hex:0:0", neighbors: ["hex:1:0"] },
    { id: "hex:1:0", neighbors: ["hex:0:0", "hex:2:0"] },
    { id: "hex:2:0", neighbors: ["hex:1:0", "hex:3:0"] },
    { id: "hex:3:0", neighbors: ["hex:2:0"] },
  ];
}

function areHexIdsAdjacentOrSame(from: string, to: string): boolean {
  return from === to || makeHexes().some((hex) => hex.id === from && hex.neighbors.includes(to));
}

function getNeighborHexIds(hexId: string): `hex:${number}:${number}`[] {
  return makeHexes()
    .find((hex) => hex.id === hexId)
    ?.neighbors.filter((id): id is `hex:${number}:${number}` => /^hex:-?\d+:-?\d+$/.test(id)) ?? [];
}
