import type { EquipmentClass, EquipmentModule, WorldBase } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  calculateEquipmentCoverage,
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
    expect(worldBase.equipmentProductionLinesByCountry["country:a"]?.[0]?.progress).toBe(0);
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
    expect(worldBase.equipmentProductionLinesByCountry["country:a"]?.[0]?.progress).toBe(6);
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
