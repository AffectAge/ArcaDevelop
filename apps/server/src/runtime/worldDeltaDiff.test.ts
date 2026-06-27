import type { BuildingInstance, PopulationPop, RegionConstructionProject, WorldBase } from "@arcanorum/shared";
import { WORLD_DELTA_MASK } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  buildCompactWorldDelta,
  buildBaselineWorldDeltaPayload,
  buildWorldDeltaPayload,
  cloneWorldBaseSectionSnapshot,
  isEqualBuildingInstances,
  isEqualConstructionQueue,
  isEqualCountryProgressMap,
  isEqualResourceDeposits,
  isEqualResourceExplorationQueue,
  prepareWorldDeltaBroadcast,
  toWorldBaseForDeltaDiff,
} from "./worldDeltaDiff";

describe("worldDeltaDiff", () => {
  it("compares numeric progress maps by exact keys and values", () => {
    expect(isEqualCountryProgressMap({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(isEqualCountryProgressMap({ a: 1 }, { a: 1, b: 0 })).toBe(false);
    expect(isEqualCountryProgressMap(undefined, {})).toBe(false);
  });

  it("compares construction and exploration queues by stable gameplay fields", () => {
    const queue = [makeProject({ progressConstruction: 5 })];
    expect(isEqualConstructionQueue(queue, structuredClone(queue))).toBe(true);
    expect(isEqualConstructionQueue(queue, [makeProject({ progressConstruction: 6 })])).toBe(false);
    expect(
      isEqualResourceExplorationQueue(
        [{ queueId: "q", requestedByCountryId: "country:a", startedTurnId: 1, turnsRemaining: 2 }],
        [{ queueId: "q", requestedByCountryId: "country:a", startedTurnId: 1, turnsRemaining: 2 }],
      ),
    ).toBe(true);
  });

  it("compares resource deposits and building instances including nested good maps", () => {
    expect(
      isEqualResourceDeposits(
        [{ goodId: "good:iron", amount: 2, discoveredTurnId: 1, veinSize: "small" }],
        [{ goodId: "good:iron", amount: 2, discoveredTurnId: 1, veinSize: "small" }],
      ),
    ).toBe(true);

    const instances = [
      makeBuildingInstance({
        warehouseByGoodId: { "good:grain": 3 },
        lastPurchaseByGoodId: { "good:wood": 1 },
      }),
    ];
    expect(isEqualBuildingInstances(instances, structuredClone(instances))).toBe(true);
    expect(
      isEqualBuildingInstances(instances, [
        makeBuildingInstance({
          warehouseByGoodId: { "good:grain": 4 },
          lastPurchaseByGoodId: { "good:wood": 1 },
        }),
      ]),
    ).toBe(false);
  });

  it("builds compact world delta with stable mask bits and compact payload keys", () => {
    const prev = makeWorldBase({
      resourcesByCountry: { "country:a": makeResources({ ducats: 5 }) },
      hexOwner: { "province:a": "country:a", "province:removed": "country:b" },
      hexNameById: { "province:a": "Old" },
      diplomacyProposals: [makeDiplomacyProposal({ id: "proposal:old" })],
    });
    const next = makeWorldBase({
      resourcesByCountry: { "country:a": makeResources({ ducats: 7 }) },
      hexOwner: { "province:a": "country:a" },
      hexNameById: { "province:a": "New" },
      diplomacyProposals: [makeDiplomacyProposal({ id: "proposal:new" })],
    });

    const compact = buildCompactWorldDelta({
      prev,
      next,
      isEqualRegionPopulation: (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b),
    });

    expect(compact.mask).toBe(
      WORLD_DELTA_MASK.resourcesByCountry |
        WORLD_DELTA_MASK.hexOwner |
        WORLD_DELTA_MASK.hexNameById |
        WORLD_DELTA_MASK.diplomacyProposals,
    );
    expect(compact.c).toEqual({ "country:a": makeResources({ ducats: 7 }) });
    expect(compact.o).toEqual({ "province:removed": null });
    expect(compact.n).toEqual({ "province:a": "New" });
    expect(compact.j).toEqual([makeDiplomacyProposal({ id: "proposal:new" })]);
    expect(compact.p).toBeUndefined();
    expect(compact.u).toBeUndefined();
  });

  it("includes region ownership and controller changes in compact deltas", () => {
    const prev = makeWorldBase({
      regionOwner: {},
      regionController: {},
    });
    const next = makeWorldBase({
      regionOwner: { "region:a": "country:a" },
      regionController: { "region:a": "country:a" },
    });

    const compact = buildCompactWorldDelta({
      prev,
      next,
      isEqualRegionPopulation: (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b),
    });

    expect(compact.mask).toBe(WORLD_DELTA_MASK.regionOwner | WORLD_DELTA_MASK.regionController);
    expect(compact.a).toEqual({ "region:a": "country:a" });
    expect(compact.f).toEqual({ "region:a": "country:a" });
  });

  it("groups civilian, settlement, city, and equipment changes under unit equipment delta mask", () => {
    const prev = makeWorldBase();
    const next = makeWorldBase({
      civilianUnitsById: {
        "civilian:a": {
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
        },
      },
      settlementProjectsById: {
        "settlement:a": {
          id: "settlement:a",
          name: "Babylon",
          countryId: "country:a",
          regionId: "region:a",
          targetHexId: "hex:0:0",
          cultureId: "culture:a",
          progressColonization: 1,
          costColonization: 10,
          state: "active",
          visualState: "underConstruction",
          createdTurnId: 1,
        },
      },
      cityMarkersById: {
        "city:a": {
          id: "city:a",
          name: "Babylon",
          countryId: "country:a",
          ownerCountryId: "country:a",
          regionId: "region:a",
          targetHexId: "hex:0:0",
          cultureId: "culture:a",
          visualState: "working",
          createdTurnId: 1,
        },
      },
      equipmentVariantsById: {
        "equipment:a": {
          id: "equipment:a",
          countryId: "country:a",
          classId: "equipment-class:infantry",
          name: "Infantry Kit",
          moduleIdsBySlotId: { weapon: "module:rifle" },
          stats: { attack: 1 },
          goodsCost: [{ goodId: "good:iron", amount: 1 }],
          createdTurnId: 1,
        },
      },
      equipmentProductionLinesByCountry: {
        "country:a": [
          {
            id: "line:a",
            countryId: "country:a",
            equipmentVariantId: "equipment:a",
            assignedCapacity: 1,
            progress: 0,
            active: true,
            createdTurnId: 1,
          },
        ],
      },
      equipmentStockpileByCountry: { "country:a": { "equipment:a": 3 } },
    });

    const compact = buildCompactWorldDelta({
      prev,
      next,
      isEqualRegionPopulation: (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b),
    });

    expect(compact.mask).toBe(WORLD_DELTA_MASK.unitEquipmentState);
    expect(compact.cu?.["civilian:a"]?.type).toBe("colonizer");
    expect(compact.sp?.["settlement:a"]?.visualState).toBe("underConstruction");
    expect(compact.ci?.["city:a"]?.visualState).toBe("working");
    expect(compact.ev?.["equipment:a"]?.stats.attack).toBe(1);
    expect(compact.el?.["country:a"]?.[0]?.equipmentVariantId).toBe("equipment:a");
    expect(compact.es?.["country:a"]).toEqual({ "equipment:a": 3 });
  });

  it("diffs explanation records by turn with compact xr payload", () => {
    const prev = makeWorldBase({
      explanationRecordsByTurn: {},
    });
    const next = makeWorldBase({
      explanationRecordsByTurn: {
        5: [
          {
            id: "explanation:test",
            turnId: 5,
            sourceSystem: "event",
            sourceId: "event:test",
            affectedObject: { kind: "country", id: "country:a" },
            valueKey: "resource.science",
            previousValue: 1,
            newValue: 3,
            causes: [{ labelKey: "resourceLedger.source.generic", sourceId: "option:test", amount: 2 }],
            modifierIds: [],
          },
        ],
      },
    });

    const compact = buildCompactWorldDelta({
      prev,
      next,
      isEqualRegionPopulation: (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b),
    });

    expect(compact.mask).toBe(WORLD_DELTA_MASK.explanationRecordsByTurn);
    expect(compact.xr).toEqual(next.explanationRecordsByTurn);
  });

  it("diffs country applied modifiers with compact cm payload", () => {
    const prev = makeWorldBase({
      countryModifiersByCountryId: {
        "country:old": [
          {
            id: "applied:old",
            modifierId: "modifier:old",
            countryId: "country:old",
            sourceSystem: "event",
            sourceId: "event:old",
            createdTurnId: 1,
            expiresTurnId: null,
          },
        ],
      },
    });
    const next = makeWorldBase({
      countryModifiersByCountryId: {
        "country:a": [
          {
            id: "applied:test",
            modifierId: "modifier:test",
            countryId: "country:a",
            sourceSystem: "decision",
            sourceId: "decision:test",
            createdTurnId: 5,
            expiresTurnId: 8,
          },
        ],
      },
    });

    const compact = buildCompactWorldDelta({
      prev,
      next,
      isEqualRegionPopulation: (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b),
    });

    expect(compact.mask).toBe(WORLD_DELTA_MASK.countryModifiersByCountryId);
    expect(compact.cm).toEqual({
      "country:old": null,
      "country:a": next.countryModifiersByCountryId["country:a"],
    });
  });

  it("builds region-owned heavy compact deltas and baseline payload sections", () => {
    const building = makeBuildingInstance({ instanceId: "instance:region-a" });
    const project = makeProject({ queueId: "queue:region-a", progressConstruction: 4 });
    const prev = makeWorldBase({
      regionPopulationByRegion: {
        "region:a": { pops: [makePop({ id: "pop:old", size: 10 })] },
        "region:removed": { pops: [makePop({ id: "pop:removed", size: 1 })] },
      },
      regionBuildingsByRegion: { "region:a": [] },
      regionBuildingDucatsByRegion: { "region:a": { "building:old": 1 } },
      regionPopulationTreasuryByRegion: { "region:a": 3 },
      regionConstructionQueueByRegion: { "region:a": [] },
    });
    const next = makeWorldBase({
      regionPopulationByRegion: {
        "region:a": { pops: [makePop({ id: "pop:new", size: 20 })] },
      },
      regionBuildingsByRegion: { "region:a": [building] },
      regionBuildingDucatsByRegion: { "region:a": { "building:a": 9 } },
      regionPopulationTreasuryByRegion: { "region:a": 12 },
      regionConstructionQueueByRegion: { "region:a": [project] },
    });

    const compact = buildCompactWorldDelta({
      prev,
      next,
      isEqualRegionPopulation: (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b),
    });
    const payload = buildWorldDeltaPayload({
      turnId: 3,
      worldStateVersion: 11,
      compact,
      rejectedOrders: [],
    });
    const baseline = buildBaselineWorldDeltaPayload({
      turnId: 3,
      worldStateVersion: 11,
      compact,
      rejectedOrders: [],
    });

    expect(compact.mask).toBe(
      WORLD_DELTA_MASK.regionPopulationByRegion |
        WORLD_DELTA_MASK.regionBuildingsByRegion |
        WORLD_DELTA_MASK.regionBuildingDucatsByRegion |
        WORLD_DELTA_MASK.regionPopulationTreasuryByRegion |
        WORLD_DELTA_MASK.regionConstructionQueueByRegion,
    );
    expect(compact.u).toEqual({
      "region:a": { pops: [makePop({ id: "pop:new", size: 20 })] },
      "region:removed": null,
    });
    expect(compact.b).toEqual({ "region:a": [building] });
    expect(compact.q).toEqual({ "region:a": { "building:a": 9 } });
    expect(compact.y).toEqual({ "region:a": 12 });
    expect(compact.r).toEqual({ "region:a": [project] });
    expect(payload).toMatchObject({ u: compact.u, b: compact.b, q: compact.q, y: compact.y, r: compact.r });
    expect(baseline.changes).toMatchObject({
      regionPopulationByRegion: compact.u,
      regionBuildingsByRegion: compact.b,
      regionBuildingDucatsByRegion: compact.q,
      regionPopulationTreasuryByRegion: compact.y,
      regionConstructionQueueByRegion: compact.r,
    });
  });

  it("materializes previous world diff base from selected snapshot sections", () => {
    const next = makeWorldBase({
      resourcesByCountry: { "country:a": makeResources({ ducats: 10 }) },
      hexOwner: { "province:a": "country:a" },
      hexNameById: { "province:a": "Current" },
    });
    const previous = toWorldBaseForDeltaDiff(
      {
        turnId: 5,
        mask: WORLD_DELTA_MASK.resourcesByCountry | WORLD_DELTA_MASK.hexNameById,
        resourcesByCountry: { "country:a": makeResources({ ducats: 1 }) },
        hexNameById: { "province:a": "Previous" },
      },
      next,
    );

    expect(previous.turnId).toBe(5);
    expect(previous.resourcesByCountry).toEqual({ "country:a": makeResources({ ducats: 1 }) });
    expect(previous.hexNameById).toEqual({ "province:a": "Previous" });
    expect(previous.hexOwner).toBe(next.hexOwner);
  });

  it("clones only selected world sections for later delta comparison", () => {
    const worldBase = makeWorldBase({
      resourcesByCountry: { "country:a": makeResources({ ducats: 3 }) },
      hexOwner: { "province:a": "country:a" },
      hexNameById: { "province:a": "Praha" },
    });

    const snapshot = cloneWorldBaseSectionSnapshot({
      worldBase,
      turnId: 4,
      mask: WORLD_DELTA_MASK.resourcesByCountry | WORLD_DELTA_MASK.hexOwner,
    });

    worldBase.resourcesByCountry["country:a"]!.ducats = 99;
    worldBase.hexOwner["province:a"] = "country:b";

    expect(snapshot.turnId).toBe(4);
    expect(snapshot.resourcesByCountry).toEqual({ "country:a": makeResources({ ducats: 3 }) });
    expect(snapshot.hexOwner).toEqual({ "province:a": "country:a" });
    expect(snapshot.hexNameById).toBeUndefined();
  });

  it("builds websocket compact and baseline delta payloads from compact diff", () => {
    const compact = {
      mask: WORLD_DELTA_MASK.resourcesByCountry,
      c: { "country:a": makeResources({ ducats: 3 }) },
    };
    const rejectedOrders = [{ playerId: "player:a", reason: "BUILD_INVALID", tempOrderId: "order:a" }];

    expect(
      buildWorldDeltaPayload({
        turnId: 2,
        worldStateVersion: 9,
        compact,
        rejectedOrders,
      }),
    ).toEqual({
      type: "WORLD_DELTA",
      turnId: 2,
      worldStateVersion: 9,
      mask: WORLD_DELTA_MASK.resourcesByCountry,
      c: compact.c,
      rejectedOrders,
    });

    expect(
      buildBaselineWorldDeltaPayload({
        turnId: 2,
        worldStateVersion: 9,
        compact,
        rejectedOrders,
      }),
    ).toMatchObject({
      type: "WORLD_DELTA",
      turnId: 2,
      worldStateVersion: 9,
      changes: { resourcesByCountry: compact.c },
      rejectedOrders,
    });
  });

  it("prepares no broadcast when neither world sections nor rejected orders changed", () => {
    const next = makeWorldBase({
      resourcesByCountry: { "country:a": makeResources({ ducats: 3 }) },
    });

    const prepared = prepareWorldDeltaBroadcast({
      previous: { turnId: 1, mask: 0 },
      next,
      turnId: 2,
      currentWorldStateVersion: 7,
      rejectedOrders: [],
      isEqualRegionPopulation: (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b),
    });

    expect(prepared).toEqual({ ok: false });
  });

  it("prepares compact and baseline broadcast payloads with the next world version", () => {
    const next = makeWorldBase({
      resourcesByCountry: { "country:a": makeResources({ ducats: 8 }) },
    });
    const rejectedOrders = [{ playerId: "player:a", reason: "BUILD_INVALID", tempOrderId: "order:a" }];

    const prepared = prepareWorldDeltaBroadcast({
      previous: {
        turnId: 1,
        mask: WORLD_DELTA_MASK.resourcesByCountry,
        resourcesByCountry: { "country:a": makeResources({ ducats: 3 }) },
      },
      next,
      turnId: 2,
      currentWorldStateVersion: 7,
      rejectedOrders,
      isEqualRegionPopulation: (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b),
    });

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.nextWorldStateVersion).toBe(8);
    expect(prepared.payload).toMatchObject({
      type: "WORLD_DELTA",
      turnId: 2,
      worldStateVersion: 8,
      mask: WORLD_DELTA_MASK.resourcesByCountry,
      c: { "country:a": makeResources({ ducats: 8 }) },
      rejectedOrders,
    });
    expect(prepared.baselinePayload.changes.resourcesByCountry).toEqual({
      "country:a": makeResources({ ducats: 8 }),
    });
  });
});

function makeProject(overrides?: Partial<RegionConstructionProject>): RegionConstructionProject {
  return {
    queueId: "queue:a",
    requestedByCountryId: "country:a",
    buildingId: "building:a",
    targetHexId: "hex:0:0",
    owner: { type: "state", countryId: "country:a" },
    projectType: "build",
    progressConstruction: 0,
    costConstruction: 10,
    costDucats: 2,
    createdTurnId: 1,
    ...overrides,
  };
}

function makeBuildingInstance(overrides?: Partial<BuildingInstance>): BuildingInstance {
  return {
    instanceId: "instance:a",
    buildingId: "building:a",
    targetHexId: "hex:0:0",
    owner: { type: "state", countryId: "country:a" },
    createdTurnId: 1,
    level: 1,
    autoUpgradeEnabled: true,
    stateSubsidiesEnabled: true,
    manualWorkEnabled: true,
    ducats: 1,
    currentDurability: 100,
    lastLaborCoverage: 1,
    lastInfraCoverage: 1,
    lastInputCoverage: 1,
    lastFinanceCoverage: 1,
    lastExtractionCoverage: 1,
    lastDurabilityCoverage: 1,
    lastProductivity: 1,
    lastRevenueDucats: 1,
    lastInputCostDucats: 0,
    lastWagesDucats: 0,
    lastStateSubsidyDucats: 0,
    lastNetDucats: 1,
    warehouseByGoodId: {},
    lastPurchaseByGoodId: {},
    lastPurchaseCostByGoodId: {},
    lastSalesByGoodId: {},
    lastSalesRevenueByGoodId: {},
    lastConsumptionByGoodId: {},
    lastProductionByGoodId: {},
    lastExtractionByGoodId: {},
    ...overrides,
  };
}

function makePop(overrides?: Partial<PopulationPop>): PopulationPop {
  return {
    id: "pop:a",
    size: 1,
    cultureId: "culture:a",
    religionId: "religion:a",
    raceId: "race:a",
    ideologies: {},
    professions: {},
    ...overrides,
  };
}

function makeWorldBase(overrides?: Partial<WorldBase>): WorldBase {
  return {
    turnId: 1,
    resourcesByCountry: {},
    regionOwner: {},
    regionController: {},
    hexOwner: {},
    hexNameById: {},
    colonyProgressByRegion: {},
    regionColonizationByRegion: {},
    regionPopulationByRegion: {},
    regionBuildingsByRegion: {},
    regionBuildingDucatsByRegion: {},
    regionPopulationTreasuryByRegion: {},
    regionConstructionQueueByRegion: {},
    regionResourceDepositsByRegion: {},
    regionResourceExplorationQueueByRegion: {},
    regionResourceExplorationCountByRegion: {},
    parliamentByCountry: {},
    technologyByCountry: {},
    countryDecisionsByCountryId: {},
    countryEventsByCountryId: {},
    countryScheduledEventsByCountryId: {},
    countryEventFlagsByCountryId: {},
    journalEntriesByCountryId: {},
    divisionTemplatesByCountry: {},
    divisionsById: {},
    militaryFormationQueueByCountry: {},
    civilianUnitsById: {},
    civilianUnitQueueByCountry: {},
    settlementProjectsById: {},
    cityMarkersById: {},
    equipmentVariantsById: {},
    equipmentProductionLinesByCountry: {},
    equipmentStockpileByCountry: {},
    diplomacyProposals: [],
    ...overrides,
    countryModifiersByCountryId: overrides?.countryModifiersByCountryId ?? {},
    resourceLedgerByTurn: overrides?.resourceLedgerByTurn ?? {},
    explanationRecordsByTurn: overrides?.explanationRecordsByTurn ?? {},
  };
}

function makeResources(overrides?: Partial<WorldBase["resourcesByCountry"][string]>): WorldBase["resourcesByCountry"][string] {
  return {
    culture: 0,
    science: 0,
    religion: 0,
    colonization: 0,
    construction: 0,
    ducats: 0,
    gold: 0,
    ...overrides,
  };
}

function makeDiplomacyProposal(overrides?: Partial<WorldBase["diplomacyProposals"][number]>): WorldBase["diplomacyProposals"][number] {
  return {
    id: "proposal:a",
    name: "Treaty",
    fromCountryId: "country:a",
    toCountryId: "country:b",
    createdTurnId: 1,
    expiresTurnId: 2,
    status: "pending",
    clauses: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
