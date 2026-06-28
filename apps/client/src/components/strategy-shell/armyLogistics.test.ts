import { describe, expect, it } from "vitest";
import type { Division, DivisionStats, EquipmentProductionLine, EquipmentVariant } from "@arcanorum/shared";
import { buildArmyLogisticsRows } from "./armyLogistics";

const stats: DivisionStats = {
  manpower: 1000,
  attack: 1,
  defense: 1,
  breakthrough: 1,
  organization: 10,
  hp: 20,
  speed: 4,
  supplyUse: 1,
};

describe("buildArmyLogisticsRows", () => {
  it("aggregates stockpile, assigned equipment, production, missing goods, and deficit status", () => {
    const variantsById: Record<string, EquipmentVariant> = {
      "equipment:rifle": makeVariant("equipment:rifle", "Rifles", [{ goodId: "good:steel", amount: 2 }]),
      "equipment:truck": makeVariant("equipment:truck", "Trucks", [{ goodId: "good:rubber", amount: 1 }]),
    };
    const rows = buildArmyLogisticsRows({
      variantsById,
      stockpileByVariantId: { "equipment:rifle": 5, "equipment:truck": 20 },
      productionLines: [
        makeLine({
          id: "line:rifle",
          equipmentVariantId: "equipment:rifle",
          lastProduced: 3,
          lastMissingGoods: [{ goodId: "good:steel", required: 10, available: 4, missing: 6 }],
        }),
      ],
      divisions: [
        makeDivision({
          equipmentByVariantId: { "equipment:rifle": 4, "equipment:truck": 2 },
          equipmentAssignments: [
            {
              requirementId: "rifle:req",
              equipmentVariantId: "equipment:rifle",
              requiredCount: 20,
              assignedCount: 4,
              coverage: 0.2,
              score: 1,
            },
            {
              requirementId: "truck:req",
              equipmentVariantId: "equipment:truck",
              requiredCount: 2,
              assignedCount: 2,
              coverage: 1,
              score: 1,
            },
          ],
        }),
      ],
    });

    expect(rows.map((row) => row.variantId)).toEqual(["equipment:rifle", "equipment:truck"]);
    expect(rows[0]).toMatchObject({
      variantId: "equipment:rifle",
      name: "Rifles",
      stockpile: 5,
      assigned: 4,
      required: 20,
      missingEquipment: 16,
      produced: 3,
      balance: -8,
      lineCount: 1,
      activeLineCount: 1,
      tone: "negative",
      missingGoods: [{ goodId: "good:steel", amount: 10, missing: 6 }],
    });
    expect(rows[1]).toMatchObject({
      variantId: "equipment:truck",
      tone: "positive",
      balance: 20,
    });
  });

  it("shows zero-stock non-producing variants as warning", () => {
    const rows = buildArmyLogisticsRows({
      variantsById: {},
      stockpileByVariantId: { "equipment:empty": 0 },
      productionLines: [],
      divisions: [],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        variantId: "equipment:empty",
        name: "equipment:empty",
        tone: "warning",
      }),
    ]);
  });
});

function makeVariant(id: string, name: string, goodsCost: EquipmentVariant["goodsCost"]): EquipmentVariant {
  return {
    id,
    countryId: "country:a",
    classId: "equipment_class:test",
    name,
    moduleIdsBySlotId: {},
    stats: {},
    goodsCost,
    createdTurnId: 1,
  };
}

function makeLine(overrides: Partial<EquipmentProductionLine>): EquipmentProductionLine {
  return {
    id: "line",
    countryId: "country:a",
    equipmentVariantId: "equipment:test",
    assignedCapacity: 1,
    progress: 0,
    active: true,
    createdTurnId: 1,
    ...overrides,
  };
}

function makeDivision(overrides: Partial<Division>): Division {
  return {
    id: "division",
    countryId: "country:a",
    templateId: "template",
    name: "Division",
    hexId: "hex:0:0",
    strength: 1,
    organization: 10,
    stats,
    status: "idle",
    path: [],
    createdTurnId: 1,
    ...overrides,
  };
}
