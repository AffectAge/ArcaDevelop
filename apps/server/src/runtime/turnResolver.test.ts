import type { EventLogEntry, Order } from "@arcanorum/shared";
import { WORLD_DELTA_MASK } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import { TURN_RESOLVE_WORLD_DELTA_MASK, runAiTurnBeforeResolveIfEnabled } from "./turnRuntime";
import { resolveTurnWithPipeline, type ColonizationCaptureResult } from "./turnResolver";

describe("turnResolver", () => {
  it("snapshots every turn-mutated section including region ownership", () => {
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.resourcesByCountry).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.resourceLedgerByTurn).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.hexOwner).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.regionOwner).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.regionController).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.colonyProgressByRegion).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.regionPopulationByRegion).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.regionBuildingsByRegion).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.regionConstructionQueueByRegion).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.regionResourceDepositsByRegion).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.countryDecisionsByCountryId).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.journalEntriesByCountryId).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.divisionsById).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.unitEquipmentState).toBeTruthy();
  });


  it("runs the AI before-resolve hook only when AI settings are enabled", async () => {
    const calls: unknown[] = [];
    const aiSettings = {
      enabled: true,
      maxCountriesPerTick: 3,
      maxDecisionCandidatesPerCountry: 5,
      contextCacheTtlTurns: 2,
      maxBuildCompletionTurns: 8,
    };

    expect(
      await runAiTurnBeforeResolveIfEnabled({
        turnId: 9,
        aiSettings,
        runAiTurnBeforeResolve: (params) => {
          calls.push(params);
        },
      }),
    ).toBe(true);
    expect(calls).toEqual([{ turnId: 9, aiSettings }]);

    expect(
      await runAiTurnBeforeResolveIfEnabled({
        turnId: 10,
        aiSettings: { ...aiSettings, enabled: false },
        runAiTurnBeforeResolve: (params) => {
          calls.push(params);
        },
      }),
    ).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("runs turn pipeline in order, carries order state, advances turn, and cleans resolved turn", () => {
    const calls: string[] = [];
    let turnId = 3;
    let worldBaseTurnId = 3;
    let cleanupTurnId = 0;
    const currentOrders = new Map<string, Order[]>([
      [
        "player:a",
        [
          makeOrder("ARMY_MOVE", "province:a"),
          makeUnitAttackOrder("division:a", "hex:1:0"),
          makeOrder("BUILD", "province:b"),
          makeOrder("COLONIZE", "region:c"),
        ],
      ],
    ]);
    let colonizeTouchedAtSupport: string[] = [];

    const result = resolveTurnWithPipeline<{ id: string }, { countryId: string; notification: string }>({
      fullSnapshotMask: 7,
      getTurnId: () => turnId,
      setTurnId: (nextTurnId) => {
        turnId = nextTurnId;
        calls.push(`set-turn:${nextTurnId}`);
      },
      setWorldBaseTurnId: (nextTurnId) => {
        worldBaseTurnId = nextTurnId;
        calls.push(`set-world:${nextTurnId}`);
      },
      cloneWorldBaseSectionSnapshot: (mask) => {
        calls.push(`snapshot:${mask}`);
        return { id: "snapshot" };
      },
      getCurrentOrders: (currentTurnId) => {
        calls.push(`orders:${currentTurnId}`);
        return currentOrders;
      },
      refreshDivisionStatsFromTemplates: () => calls.push("refresh-divisions"),
      emitMilitarySupplyNews: () => calls.push("supply-news"),
      getActiveColonizeRegionsByCountry: () => new Map([["country:a", new Set(["region:active"])]]),
      resolveArmyMoveOrder: ({ movedDivisionIds, rejectedOrders, news }) => {
        movedDivisionIds.add("division:a");
        rejectedOrders.push({ playerId: "player:a", reason: "MOVE_REJECTED" });
        news.push(makeNews("army"));
        calls.push("order:army");
      },
      resolveUnitMoveOrder: () => {
        calls.push("order:unit-move");
      },
      resolveUnitAttackOrder: () => {
        calls.push("order:unit-attack");
      },
      resolveBuildOrder: ({ rejectedOrders }) => {
        rejectedOrders.push({ playerId: "player:a", reason: "BUILD_REJECTED" });
        calls.push("order:build");
      },
      resolveColonizeOrder: ({ colonizeTargetsByCountry, touchedRegionIds }) => {
        colonizeTargetsByCountry.get("country:a")?.add("region:c");
        touchedRegionIds.add("region:c");
        calls.push("order:colonize");
      },
      resolveFoundCityOrder: () => {
        calls.push("order:found-city");
      },
      advanceStoredArmyRoutesTurn: ({ movedDivisionIds, news }) => {
        expect([...movedDivisionIds]).toEqual(["division:a"]);
        news.push(makeNews("stored"));
        calls.push("stored-routes");
      },
      advanceStoredUnitRoutesTurn: () => calls.push("stored-unit-routes"),
      advanceMilitaryFormationQueue: (news) => {
        news.push(makeNews("queue"));
        calls.push("military-queue");
      },
      advanceCivilianUnitQueue: () => calls.push("civilian-unit-queue"),
      resolveEquipmentProductionLinesTurn: (news) => {
        news.push(makeNews("equipment"));
        calls.push("equipment-production");
      },
      resolveColonizationSupportTurn: ({ touchedRegionIds }) => {
        colonizeTouchedAtSupport = [...touchedRegionIds].sort();
        calls.push("colonization-support");
      },
      resolveSettlementProjectsTurn: () => calls.push("settlement-projects"),
      flushResourceLedger: () => calls.push("ledger-flush"),
      enqueueBuildingAutoUpgradesTurn: () => calls.push("auto-upgrades"),
      resolveBuildingConstructionQueuesTurn: () => calls.push("construction"),
      resolveResourceExplorationTurn: () => calls.push("exploration"),
      resolveTransportCorridorConstructionTurn: () => calls.push("corridors"),
      resolveColonizationCapturesTurn: (touchedRegionIds): ColonizationCaptureResult[] => {
        expect([...touchedRegionIds].sort()).toEqual(["region:active", "region:c"]);
        calls.push("colonization-captures");
        return [{ regionId: "region:c", winnerCountryId: "country:a", previousOwnerId: null }];
      },
      makeColonizationCaptureNews: () => {
        calls.push("capture-news");
        return makeNews("capture");
      },
      applyCountryResourceIncomeTurn: () => calls.push("income"),
      applyPerTurnTreatyMoneyTransfers: () => calls.push("treaties"),
      rechargeDecisionCharges: () => calls.push("decision-charges"),
      resolveTechnologyTurn: (news) => {
        news.push(makeNews("tech"));
        calls.push("tech");
      },
      autoResolveExpiredCountryEvents: () => calls.push("events-auto"),
      resolveJournalEntriesTurn: (news) => {
        news.push(makeNews("journal"));
        calls.push("journal");
      },
      maybeGenerateCountryEvents: (_news, uiNotifications) => {
        uiNotifications.push({ countryId: "country:a", notification: "event" });
        calls.push("events-generate");
      },
      resolvePopulationTurn: () => calls.push("population"),
      resolveParliamentTurn: (uiNotifications) => {
        uiNotifications.push({ countryId: "country:a", notification: "election" });
        calls.push("parliament");
      },
      resetTurnTimerAnchor: () => calls.push("timer"),
      cleanupResolvedTurn: (resolvedTurnId) => {
        cleanupTurnId = resolvedTurnId;
        calls.push(`cleanup:${resolvedTurnId}`);
      },
      flushPersistentStateNow: () => {
        calls.push("flush");
      },
    });

    expect(result.previousWorldBase).toEqual({ id: "snapshot" });
    expect(result.rejectedOrders.map((order) => order.reason)).toEqual(["MOVE_REJECTED", "BUILD_REJECTED"]);
    expect(result.news.map((event) => event.title)).toEqual(["army", "stored", "queue", "equipment", "capture", "tech", "journal"]);
    expect(result.uiNotifications.map((item) => item.notification)).toEqual(["event", "election"]);
    expect(colonizeTouchedAtSupport).toEqual(["region:active", "region:c"]);
    expect(turnId).toBe(4);
    expect(worldBaseTurnId).toBe(4);
    expect(cleanupTurnId).toBe(3);
    expect(calls).toEqual([
      "snapshot:7",
      "refresh-divisions",
      "supply-news",
      "orders:3",
      "order:army",
      "order:unit-attack",
      "order:build",
      "order:colonize",
      "stored-routes",
      "stored-unit-routes",
      "military-queue",
      "civilian-unit-queue",
      "equipment-production",
      "refresh-divisions",
      "supply-news",
      "colonization-support",
      "settlement-projects",
      "ledger-flush",
      "auto-upgrades",
      "construction",
      "ledger-flush",
      "exploration",
      "corridors",
      "ledger-flush",
      "colonization-captures",
      "capture-news",
      "income",
      "ledger-flush",
      "treaties",
      "ledger-flush",
      "decision-charges",
      "tech",
      "ledger-flush",
      "events-auto",
      "ledger-flush",
      "journal",
      "ledger-flush",
      "events-generate",
      "population",
      "parliament",
      "set-turn:4",
      "set-world:4",
      "timer",
      "cleanup:3",
      "flush",
    ]);
  });

  it("passes division, civilian, and fleet movement state into UNIT_MOVE resolution", () => {
    const calls: string[] = [];
    const currentOrders = new Map<string, Order[]>([["player:a", [makeOrder("ARMY_MOVE", "hex:1:0"), makeUnitMoveOrder("division:a", "hex:2:0")]]]);

    resolveTurnWithPipeline<{ id: string }, never>({
      ...makeNoopTurnResolverDeps({
        currentOrders,
        calls,
      }),
      resolveArmyMoveOrder: ({ movedDivisionIds }) => {
        movedDivisionIds.add("division:a");
        calls.push("order:army");
      },
      resolveUnitMoveOrder: ({ movedDivisionIds, movedCivilianUnitIds, movedFleetIds }) => {
        expect([...movedDivisionIds]).toEqual(["division:a"]);
        expect([...movedCivilianUnitIds]).toEqual([]);
        expect([...movedFleetIds]).toEqual([]);
        movedDivisionIds.add("division:b");
        movedCivilianUnitIds.add("civilian:a");
        movedFleetIds.add("fleet:a");
        calls.push("order:unit-move");
      },
      advanceStoredArmyRoutesTurn: ({ movedDivisionIds }) => {
        expect([...movedDivisionIds].sort()).toEqual(["division:a", "division:b"]);
        calls.push("stored-routes");
      },
      advanceStoredUnitRoutesTurn: ({ movedCivilianUnitIds, movedFleetIds }) => {
        expect([...movedCivilianUnitIds]).toEqual(["civilian:a"]);
        expect([...movedFleetIds]).toEqual(["fleet:a"]);
        calls.push("stored-unit-routes");
      },
    });

    expect(calls.filter((call) => call.startsWith("order:") || call.startsWith("stored-")).slice(0, 4)).toEqual([
      "order:army",
      "order:unit-move",
      "stored-routes",
      "stored-unit-routes",
    ]);
  });

  it("passes moved division state into UNIT_ATTACK resolution before stored routes", () => {
    const calls: string[] = [];
    const currentOrders = new Map<string, Order[]>([["player:a", [makeOrder("ARMY_MOVE", "hex:1:0"), makeUnitAttackOrder("division:b", "hex:2:0")]]]);

    resolveTurnWithPipeline<{ id: string }, never>({
      ...makeNoopTurnResolverDeps({
        currentOrders,
        calls,
      }),
      resolveArmyMoveOrder: ({ movedDivisionIds }) => {
        movedDivisionIds.add("division:a");
        calls.push("order:army");
      },
      resolveUnitAttackOrder: ({ movedDivisionIds }) => {
        expect([...movedDivisionIds]).toEqual(["division:a"]);
        movedDivisionIds.add("division:b");
        calls.push("order:unit-attack");
      },
      advanceStoredArmyRoutesTurn: ({ movedDivisionIds }) => {
        expect([...movedDivisionIds].sort()).toEqual(["division:a", "division:b"]);
        calls.push("stored-routes");
      },
    });

    expect(calls.filter((call) => call.startsWith("order:") || call === "stored-routes").slice(0, 3)).toEqual([
      "order:army",
      "order:unit-attack",
      "stored-routes",
    ]);
  });
});

function makeOrder(type: "ARMY_MOVE" | "BUILD" | "COLONIZE", targetId: string): Order {
  const base = {
    id: `order:${type}`,
    turnId: 3,
    playerId: "player:a",
    countryId: "country:a",
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  if (type === "ARMY_MOVE") return { ...base, type, targetHexId: targetId as `hex:${number}:${number}` };
  if (type === "BUILD") return { ...base, type, regionId: targetId, targetHexId: "hex:0:0" };
  if (type === "COLONIZE") return { ...base, type, regionId: targetId };
  return { ...base, type };
}

function makeUnitMoveOrder(unitId: string, targetHexId: string): Order {
  return {
    id: `order:UNIT_MOVE:${unitId}`,
    turnId: 3,
    playerId: "player:a",
    countryId: "country:a",
    type: "UNIT_MOVE",
    unitId,
    unitKind: "division",
    targetHexId: targetHexId as `hex:${number}:${number}`,
    path: [],
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeUnitAttackOrder(attackerUnitId: string, targetHexId: string): Order {
  return {
    id: `order:UNIT_ATTACK:${attackerUnitId}`,
    turnId: 3,
    playerId: "player:a",
    countryId: "country:a",
    type: "UNIT_ATTACK",
    attackerUnitId,
    targetHexId: targetHexId as `hex:${number}:${number}`,
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeNoopTurnResolverDeps(input: { currentOrders: Map<string, Order[]>; calls: string[] }) {
  let turnId = 3;
  return {
    fullSnapshotMask: 7,
    getTurnId: () => turnId,
    setTurnId: (nextTurnId: number) => {
      turnId = nextTurnId;
    },
    setWorldBaseTurnId: () => undefined,
    cloneWorldBaseSectionSnapshot: () => ({ id: "snapshot" }),
    getCurrentOrders: () => input.currentOrders,
    refreshDivisionStatsFromTemplates: () => input.calls.push("refresh-divisions"),
    emitMilitarySupplyNews: () => input.calls.push("supply-news"),
    getActiveColonizeRegionsByCountry: () => new Map(),
    resolveArmyMoveOrder: () => undefined,
    resolveUnitMoveOrder: () => undefined,
    resolveUnitAttackOrder: () => undefined,
    resolveBuildOrder: () => undefined,
    resolveColonizeOrder: () => undefined,
    resolveFoundCityOrder: () => undefined,
    advanceStoredArmyRoutesTurn: () => input.calls.push("stored-routes"),
    advanceStoredUnitRoutesTurn: () => input.calls.push("stored-unit-routes"),
    advanceMilitaryFormationQueue: () => undefined,
    advanceCivilianUnitQueue: () => undefined,
    resolveEquipmentProductionLinesTurn: () => undefined,
    resolveColonizationSupportTurn: () => undefined,
    resolveSettlementProjectsTurn: () => undefined,
    flushResourceLedger: () => undefined,
    enqueueBuildingAutoUpgradesTurn: () => undefined,
    resolveBuildingConstructionQueuesTurn: () => undefined,
    resolveResourceExplorationTurn: () => undefined,
    resolveTransportCorridorConstructionTurn: () => undefined,
    resolveColonizationCapturesTurn: () => [],
    makeColonizationCaptureNews: () => makeNews("capture"),
    applyCountryResourceIncomeTurn: () => undefined,
    applyPerTurnTreatyMoneyTransfers: () => undefined,
    rechargeDecisionCharges: () => undefined,
    resolveTechnologyTurn: () => undefined,
    autoResolveExpiredCountryEvents: () => undefined,
    resolveJournalEntriesTurn: () => undefined,
    maybeGenerateCountryEvents: () => undefined,
    resolvePopulationTurn: () => undefined,
    resolveParliamentTurn: () => undefined,
    resetTurnTimerAnchor: () => undefined,
    cleanupResolvedTurn: () => undefined,
    flushPersistentStateNow: () => undefined,
  };
}

function makeNews(title: string): EventLogEntry {
  return {
    id: `event:${title}`,
    turn: 1,
    category: "system",
    title,
    message: title,
    countryId: null,
    priority: "low",
    visibility: "public",
    timestamp: "2026-01-01T00:00:00.000Z",
  };
}
