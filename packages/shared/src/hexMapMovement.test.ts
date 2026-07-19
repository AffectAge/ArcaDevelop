import { describe, expect, it } from "vitest";
import { normalizeMovementPoints, resolveHexMovementStep } from "./hexMapMovement";

describe("hex map movement points", () => {
  it("preserves fractional road and river costs without floating-point drift", () => {
    let remainingMovement = 2;
    for (let step = 0; step < 4; step += 1) {
      const result = resolveHexMovementStep({ remainingMovement, movementCost: 0.5 });
      expect(result.canEnter).toBe(true);
      remainingMovement = result.remainingMovement;
    }
    expect(remainingMovement).toBe(0);
  });

  it("does not enter a destination tile when its cost exceeds the remaining movement", () => {
    expect(resolveHexMovementStep({ remainingMovement: 0.5, movementCost: 1 })).toEqual({
      canEnter: false,
      movementCost: 1,
      remainingMovement: 0.5,
      stoppedByEnemyZoneOfControl: false,
    });
  });

  it("consumes the remaining movement after entering an enemy zone of control", () => {
    expect(resolveHexMovementStep({
      remainingMovement: 2,
      movementCost: 0.5,
      entersEnemyZoneOfControl: true,
    })).toMatchObject({
      canEnter: true,
      remainingMovement: 0,
      stoppedByEnemyZoneOfControl: true,
    });
  });

  it("lets an explicitly exempt unit retain movement inside enemy zone of control", () => {
    expect(resolveHexMovementStep({
      remainingMovement: 2,
      movementCost: 0.5,
      entersEnemyZoneOfControl: true,
      ignoresEnemyZoneOfControl: true,
    })).toMatchObject({
      canEnter: true,
      remainingMovement: 1.5,
      stoppedByEnemyZoneOfControl: false,
    });
  });

  it("normalizes authored movement values to three decimal places", () => {
    expect(normalizeMovementPoints(1.23456)).toBe(1.235);
  });
});
