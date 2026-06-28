import { describe, expect, it } from "vitest";
import type { Division } from "@arcanorum/shared";
import { buildEquipmentSupplySummary } from "./militaryRouteRuntime";

describe("militaryRouteRuntime", () => {
  it("aggregates latest division equipment supply reports", () => {
    expect(
      buildEquipmentSupplySummary([
        makeDivision({
          id: "division:a",
          equipmentSupplyReport: {
            turnId: 4,
            receivedByVariantId: { "equipment:rifle": 10 },
            returnedByVariantId: {},
          },
        }),
        makeDivision({
          id: "division:b",
          equipmentSupplyReport: {
            turnId: 5,
            receivedByVariantId: { "equipment:rifle": 3, "equipment:gun": 2 },
            returnedByVariantId: { "equipment:old": 1 },
          },
        }),
        makeDivision({
          id: "division:c",
          equipmentSupplyReport: {
            turnId: 5,
            receivedByVariantId: { "equipment:rifle": 4 },
            returnedByVariantId: {},
          },
        }),
      ]),
    ).toEqual({
      turnId: 5,
      divisionCount: 2,
      receivedByVariantId: { "equipment:rifle": 7, "equipment:gun": 2 },
      returnedByVariantId: { "equipment:old": 1 },
    });
  });
});

function makeDivision(overrides?: Partial<Division>): Division {
  return {
    id: "division",
    countryId: "country:a",
    templateId: "template:a",
    name: "Division",
    kind: "land",
    hexId: "hex:0:0",
    strength: 1,
    organization: 10,
    stats: {
      manpower: 1000,
      attack: 1,
      defense: 1,
      breakthrough: 1,
      organization: 10,
      hp: 10,
      speed: 1,
      supplyUse: 1,
    },
    status: "idle",
    path: [],
    createdTurnId: 1,
    lastMovedTurnId: null,
    ...overrides,
  };
}
