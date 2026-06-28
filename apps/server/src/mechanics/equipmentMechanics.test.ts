import type { EquipmentClass, EquipmentModule, WorldBase } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  assignEquipmentVariantsForRequirements,
  calculateEquipmentCoverage,
  applyEquipmentCoverageToDivisionStats,
  applyEquipmentLossesForRequirements,
  deriveEquipmentVariant,
  getEquipmentUnitWork,
  resolveEquipmentProductionLinesTurn,
  selectBestEquipmentVariantForRequirement,
} from "./equipmentMechanics";

describe("equipmentMechanics", () => {
  it("derives variant stats and goods cost from selected modules", () => {
    const equipmentClass: EquipmentClass = {
      id: "equipment-class:tank",
      branch: "land",
      slotIds: ["chassis", "gun", "engine"],
      roles: ["attack", "breakthrough"],
      baseStats: { defense: 1, speed: 1 },
    };
    const modulesById: Record<string, EquipmentModule> = {
      "module:chassis": {
        id: "module:chassis",
        classId: "equipment-class:tank",
        slotId: "chassis",
        stats: { armor: 5, defense: 2 },
        goodsCost: [{ goodId: "good:steel", amount: 4 }],
      },
      "module:gun": {
        id: "module:gun",
        classId: "equipment-class:tank",
        slotId: "gun",
        stats: { attack: 7, piercing: 3 },
        goodsCost: [{ goodId: "good:steel", amount: 2 }, { goodId: "good:explosives", amount: 1 }],
      },
      "module:wrong-slot": {
        id: "module:wrong-slot",
        classId: "equipment-class:tank",
        slotId: "turret",
        stats: { attack: 999 },
        goodsCost: [{ goodId: "good:gold", amount: 99 }],
      },
    };

    const variant = deriveEquipmentVariant({
      id: "equipment:tank:a",
      countryId: "country:a",
      equipmentClass,
      modulesById,
      moduleIdsBySlotId: {
        chassis: "module:chassis",
        gun: "module:gun",
        engine: "module:wrong-slot",
      },
      name: "Medium Tank A",
      createdTurnId: 4,
    });

    expect(variant).toMatchObject({
      id: "equipment:tank:a",
      countryId: "country:a",
      classId: "equipment-class:tank",
      stats: { defense: 3, speed: 1, armor: 5, attack: 7, piercing: 3 },
      goodsCost: [
        { goodId: "good:explosives", amount: 1 },
        { goodId: "good:steel", amount: 6 },
      ],
    });
  });

  it("produces stockpile entries from market goods and line progress", () => {
    const worldBase = makeWorld();
    const result = resolveEquipmentProductionLinesTurn({
      worldBase,
      markets: {
        countryMarketByCountryId: { "country:a": "market:a" },
        marketById: { "market:a": { warehouseByResourceId: { "good:steel": 10, "good:tools": 2 } } },
      },
      productionPerCapacity: 1,
    });

    expect(result).toEqual({
      producedByCountry: { "country:a": { "equipment:rifle": 2 } },
      stalledLineIds: [],
    });
    expect(worldBase.equipmentStockpileByCountry["country:a"]).toEqual({ "equipment:rifle": 2 });
    expect(worldBase.equipmentProductionLinesByCountry["country:a"]?.[0]).toMatchObject({
      progress: 0,
      lastStatus: "active",
      lastProduced: 2,
      lastMissingGoods: [],
    });
  });

  it("stalls lines when progress is ready but goods are missing", () => {
    const worldBase = makeWorld();
    const result = resolveEquipmentProductionLinesTurn({
      worldBase,
      markets: {
        countryMarketByCountryId: { "country:a": "market:a" },
        marketById: { "market:a": { warehouseByResourceId: { "good:steel": 1 } } },
      },
      productionPerCapacity: 1,
    });

    expect(result.stalledLineIds).toEqual(["line:a"]);
    expect(worldBase.equipmentStockpileByCountry["country:a"]).toBeUndefined();
    expect(worldBase.equipmentProductionLinesByCountry["country:a"]?.[0]).toMatchObject({
      progress: 6,
      lastStatus: "stalled",
      lastProduced: 0,
      lastMissingGoods: [
        { goodId: "good:steel", required: 2, available: 1, missing: 1 },
        { goodId: "good:tools", required: 1, available: 0, missing: 1 },
      ],
    });
  });

  it("selects the highest scoring available equipment for a tactical role", () => {
    const choice = selectBestEquipmentVariantForRequirement({
      requirement: { id: "main", equipmentClassId: "equipment-class:infantry", role: "attack", count: 100 },
      stockpileByVariantId: {
        "equipment:old-rifle": 150,
        "equipment:new-rifle": 80,
        "equipment:empty-rifle": 200,
      },
      variants: [
        {
          id: "equipment:old-rifle",
          countryId: "country:a",
          classId: "equipment-class:infantry",
          name: "Old rifle",
          moduleIdsBySlotId: {},
          stats: { attack: 2, defense: 2, reliability: 1 },
          goodsCost: [],
          createdTurnId: 1,
        },
        {
          id: "equipment:new-rifle",
          countryId: "country:a",
          classId: "equipment-class:infantry",
          name: "New rifle",
          moduleIdsBySlotId: {},
          stats: { attack: 5, defense: 1, reliability: 1 },
          goodsCost: [],
          createdTurnId: 2,
        },
        {
          id: "equipment:empty-rifle",
          countryId: "country:a",
          classId: "equipment-class:artillery",
          name: "Wrong class",
          moduleIdsBySlotId: {},
          stats: { attack: 99 },
          goodsCost: [],
          createdTurnId: 3,
        },
      ],
    });

    expect(choice.equipmentVariantId).toBe("equipment:new-rifle");
    expect(choice.assignedCount).toBe(80);
    expect(choice.coverage).toBe(0.8);
  });

  it("aggregates equipment coverage across requirements", () => {
    expect(
      calculateEquipmentCoverage([
        { requirementId: "rifles", equipmentVariantId: "equipment:rifle", score: 1, requiredCount: 100, availableCount: 50, assignedCount: 50, coverage: 0.5 },
        { requirementId: "guns", equipmentVariantId: "equipment:gun", score: 1, requiredCount: 20, availableCount: 20, assignedCount: 20, coverage: 1 },
      ]),
    ).toBe(0.583);
  });

  it("assigns equipment requirements without double-counting the same stockpile", () => {
    const choices = assignEquipmentVariantsForRequirements({
      requirements: [
        { id: "frontline", equipmentClassId: "equipment-class:infantry", role: "attack", count: 70 },
        { id: "reserve", equipmentClassId: "equipment-class:infantry", role: "defense", count: 50 },
      ],
      stockpileByVariantId: {
        "equipment:rifle": 100,
      },
      variants: [
        {
          id: "equipment:rifle",
          countryId: "country:a",
          classId: "equipment-class:infantry",
          name: "Rifle",
          moduleIdsBySlotId: {},
          stats: { attack: 4, defense: 4 },
          goodsCost: [],
          createdTurnId: 1,
        },
      ],
    });

    expect(choices).toEqual([
      expect.objectContaining({ requirementId: "frontline", equipmentVariantId: "equipment:rifle", availableCount: 100, assignedCount: 70, coverage: 1 }),
      expect.objectContaining({ requirementId: "reserve", equipmentVariantId: "equipment:rifle", availableCount: 30, assignedCount: 30, coverage: 0.6 }),
    ]);
    expect(calculateEquipmentCoverage(choices)).toBe(0.833);
  });

  it("mixes variants and applies weighted equipment stats", () => {
    const choices = assignEquipmentVariantsForRequirements({
      requirements: [{ id: "tank:breakthrough", equipmentClassId: "equipment-class:tank", role: "breakthrough", count: 100 }],
      stockpileByVariantId: { "tank:a": 60, "tank:b": 30 },
      variants: [
        {
          id: "tank:a",
          classId: "equipment-class:tank",
          name: "Tank A",
          moduleIdsBySlotId: {},
          stats: { attack: 10, breakthrough: 8, armor: 6, piercing: 5, speed: 3, supplyUse: 1, fuelUse: 2 },
          goodsCost: [],
          manpowerCrew: 4,
          createdTurnId: 2,
        },
        {
          id: "tank:b",
          classId: "equipment-class:tank",
          name: "Tank B",
          moduleIdsBySlotId: {},
          stats: { attack: 6, breakthrough: 4, armor: 3, piercing: 2, speed: 2, supplyUse: 0.5, fuelUse: 1 },
          goodsCost: [],
          manpowerCrew: 3,
          createdTurnId: 1,
        },
      ],
    });

    expect(choices[0]).toMatchObject({
      assignedCount: 90,
      coverage: 0.9,
      variants: [
        expect.objectContaining({ equipmentVariantId: "tank:a", amount: 60 }),
        expect.objectContaining({ equipmentVariantId: "tank:b", amount: 30 }),
      ],
    });
    expect(
      applyEquipmentCoverageToDivisionStats(
        { manpower: 100, attack: 0, defense: 0, breakthrough: 0, organization: 10, hp: 10, speed: 5, supplyUse: 0 },
        calculateEquipmentCoverage(choices),
        choices,
      ),
    ).toMatchObject({
      attack: 7.8,
      breakthrough: 6,
      armor: 4.5,
      piercing: 3.6,
      speed: 1.87,
      supplyUse: 0.75,
      fuelUse: 1.5,
    });
  });

  it("applies equipment losses through allocated requirements without double-counting stockpile", () => {
    const stockpileByVariantId = {
      "equipment:rifle": 100,
    };

    const losses = applyEquipmentLossesForRequirements({
      requirements: [
        { id: "frontline", equipmentClassId: "equipment-class:infantry", role: "attack", count: 70 },
        { id: "reserve", equipmentClassId: "equipment-class:infantry", role: "defense", count: 50 },
      ],
      stockpileByVariantId,
      lossRatio: 0.5,
      variants: [
        {
          id: "equipment:rifle",
          countryId: "country:a",
          classId: "equipment-class:infantry",
          name: "Rifle",
          moduleIdsBySlotId: {},
          stats: { attack: 4, defense: 4 },
          goodsCost: [],
          createdTurnId: 1,
        },
      ],
    });

    expect(losses).toEqual({ "equipment:rifle": 50 });
    expect(stockpileByVariantId).toEqual({ "equipment:rifle": 50 });
  });

  it("reduces effective division stats when equipment coverage is short", () => {
    expect(
      applyEquipmentCoverageToDivisionStats(
        {
          manpower: 1000,
          attack: 10,
          defense: 20,
          breakthrough: 5,
          organization: 10,
          hp: 30,
          speed: 4,
          supplyUse: 2,
        },
        0.5,
      ),
    ).toEqual({
      manpower: 1000,
      attack: 5.75,
      defense: 11.5,
      breakthrough: 2.875,
      armor: 0,
      piercing: 0,
      organization: 7.5,
      hp: 17.25,
      speed: 2.7,
      range: 0,
      reliability: 0,
      supplyUse: 2,
      fuelUse: 0,
    });
  });
});

function makeWorld(): Pick<
  WorldBase,
  "equipmentVariantsById" | "equipmentProductionLinesByCountry" | "equipmentStockpileByCountry"
> {
  return {
    equipmentVariantsById: {
      "equipment:rifle": {
        id: "equipment:rifle",
        countryId: "country:a",
        classId: "equipment-class:infantry",
        name: "Rifle",
        moduleIdsBySlotId: { weapon: "module:rifle" },
        stats: { attack: 2 },
        goodsCost: [{ goodId: "good:steel", amount: 2 }, { goodId: "good:tools", amount: 1 }],
        createdTurnId: 1,
      },
    },
    equipmentProductionLinesByCountry: {
      "country:a": [
        {
          id: "line:a",
          countryId: "country:a",
          equipmentVariantId: "equipment:rifle",
          assignedCapacity: 6,
          progress: 0,
          active: true,
          createdTurnId: 1,
        },
      ],
    },
    equipmentStockpileByCountry: {},
  };
}
