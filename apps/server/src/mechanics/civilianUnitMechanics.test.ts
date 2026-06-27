import { describe, expect, it } from "vitest";
import {
  advanceCivilianUnitQueueTurn,
  makeCivilianUnitLedgerFlows,
  queueColonizerUnit,
  type CivilianUnitWorldState,
} from "./civilianUnitMechanics";

const baseResources = {
  culture: 0,
  science: 0,
  religion: 0,
  colonization: 100,
  construction: 0,
  ducats: 50,
  gold: 0,
};

describe("civilianUnitMechanics", () => {
  it("queues colonizers on controlled free hexes without directly mutating resources", () => {
    const worldBase = makeWorld();
    const result = queueColonizerUnit({
      worldBase,
      countryId: "country:a",
      hexId: "hex:1:2",
      getHexRegionId: () => "region:a",
      config: {
        colonizerTurns: 2,
        colonizerCostColonization: 20,
        colonizerCostDucats: 10,
        colonizerMovementPoints: 2,
      },
      createId: () => "queue:a",
      turnId: 4,
    });

    expect(result).toEqual({
      ok: true,
      item: expect.objectContaining({
        id: "queue:a",
        hexId: "hex:1:2",
        turnsTotal: 2,
        turnsRemaining: 2,
        cost: { colonization: 20, ducats: 10 },
      }),
    });
    expect(worldBase.resourcesByCountry["country:a"]).toEqual(baseResources);
  });

  it("rejects uncontrolled and occupied hexes", () => {
    const uncontrolled = queueColonizerUnit({
      worldBase: makeWorld({ controllerCountryId: "country:b" }),
      countryId: "country:a",
      hexId: "hex:1:2",
      getHexRegionId: () => "region:a",
      config: makeConfig(),
      createId: () => "queue:a",
      turnId: 4,
    });
    expect(uncontrolled).toEqual({ ok: false, error: "HEX_NOT_CONTROLLED" });

    const occupiedWorld = makeWorld();
    occupiedWorld.civilianUnitsById["unit:a"] = {
      id: "unit:a",
      countryId: "country:a",
      type: "colonizer",
      hexId: "hex:1:2",
      status: "idle",
      movementPoints: 2,
      maxMovementPoints: 2,
      path: [],
      createdTurnId: 1,
      lastMovedTurnId: null,
    };
    const occupied = queueColonizerUnit({
      worldBase: occupiedWorld,
      countryId: "country:a",
      hexId: "hex:1:2",
      getHexRegionId: () => "region:a",
      config: makeConfig(),
      createId: () => "queue:a",
      turnId: 4,
    });
    expect(occupied).toEqual({ ok: false, error: "CIVILIAN_UNIT_HEX_OCCUPIED" });
  });

  it("creates ledger expense inputs for colonizer queue costs", () => {
    expect(makeCivilianUnitLedgerFlows({
      countryId: "country:a",
      queueId: "queue:a",
      cost: { colonization: 20, ducats: 10 },
    })).toEqual([
      expect.objectContaining({ resourceId: "colonization", amount: 20, sourceType: "unit" }),
      expect.objectContaining({ resourceId: "ducats", amount: 10, sourceType: "unit" }),
    ]);
  });

  it("advances queue items into civilian units on the same hex", () => {
    const worldBase = makeWorld();
    worldBase.civilianUnitQueueByCountry["country:a"] = [
      {
        id: "queue:a",
        countryId: "country:a",
        type: "colonizer",
        hexId: "hex:1:2",
        progress: 0.5,
        turnsTotal: 2,
        turnsRemaining: 1,
        cost: { colonization: 20, ducats: 10 },
        createdTurnId: 4,
      },
    ];

    const result = advanceCivilianUnitQueueTurn({
      worldBase,
      createId: () => "unit:a",
      turnId: 5,
      colonizerMovementPoints: 3,
    });

    expect(result.createdUnits).toEqual([
      expect.objectContaining({
        id: "civilian:unit:a",
        type: "colonizer",
        hexId: "hex:1:2",
        movementPoints: 3,
      }),
    ]);
    expect(worldBase.civilianUnitQueueByCountry["country:a"]).toEqual([]);
    expect(worldBase.civilianUnitsById["civilian:unit:a"]?.hexId).toBe("hex:1:2");
  });
});

function makeWorld(options?: { controllerCountryId?: string }): CivilianUnitWorldState {
  return {
    civilianUnitsById: {},
    civilianUnitQueueByCountry: {},
    resourcesByCountry: { "country:a": { ...baseResources } },
    regionOwner: { "region:a": "country:a" },
    regionController: { "region:a": options?.controllerCountryId ?? "country:a" },
  };
}

function makeConfig() {
  return {
    colonizerTurns: 2,
    colonizerCostColonization: 20,
    colonizerCostDucats: 10,
    colonizerMovementPoints: 2,
  };
}
