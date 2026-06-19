import type { EventLogEntry, Order } from "@arcanorum/shared";
import { WORLD_DELTA_MASK } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import { TURN_RESOLVE_WORLD_DELTA_MASK, runAiTurnBeforeResolveIfEnabled } from "./turnRuntime";
import { resolveTurnWithPipeline, type ColonizationCaptureResult } from "./turnResolver";

describe("turnResolver", () => {
  it("snapshots every turn-mutated section including region ownership", () => {
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.resourcesByCountry).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.provinceOwner).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.regionOwner).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.regionController).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.colonyProgressByRegion).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.regionPopulationByRegion).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.regionBuildingsByRegion).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.regionConstructionQueueByRegion).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.regionResourceDepositsByRegion).toBeTruthy();
    expect(TURN_RESOLVE_WORLD_DELTA_MASK & WORLD_DELTA_MASK.divisionsById).toBeTruthy();
  });


  it("runs the AI before-resolve hook only when AI settings are enabled", async () => {
    const calls: unknown[] = [];
    const aiSettings = {
      enabled: true,
      maxCountriesPerTick: 3,
      maxDecisionCandidatesPerCountry: 5,
      contextCacheTtlTurns: 2,
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
      getActiveColonizeRegionsByCountry: () => new Map([["country:a", new Set(["region:active"])]]),
      resolveArmyMoveOrder: ({ movedDivisionIds, rejectedOrders, news }) => {
        movedDivisionIds.add("division:a");
        rejectedOrders.push({ playerId: "player:a", reason: "MOVE_REJECTED" });
        news.push(makeNews("army"));
        calls.push("order:army");
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
      advanceStoredArmyRoutesTurn: ({ movedDivisionIds, news }) => {
        expect([...movedDivisionIds]).toEqual(["division:a"]);
        news.push(makeNews("stored"));
        calls.push("stored-routes");
      },
      advanceMilitaryFormationQueue: (news) => {
        news.push(makeNews("queue"));
        calls.push("military-queue");
      },
      resolveColonizationSupportTurn: ({ touchedRegionIds }) => {
        colonizeTouchedAtSupport = [...touchedRegionIds].sort();
        calls.push("colonization-support");
      },
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
      resolveTechnologyTurn: (news) => {
        news.push(makeNews("tech"));
        calls.push("tech");
      },
      autoResolveExpiredCountryEvents: () => calls.push("events-auto"),
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
    expect(result.news.map((event) => event.title)).toEqual(["army", "stored", "queue", "capture", "tech"]);
    expect(result.uiNotifications.map((item) => item.notification)).toEqual(["event", "election"]);
    expect(colonizeTouchedAtSupport).toEqual(["region:active", "region:c"]);
    expect(turnId).toBe(4);
    expect(worldBaseTurnId).toBe(4);
    expect(cleanupTurnId).toBe(3);
    expect(calls).toEqual([
      "snapshot:7",
      "orders:3",
      "order:army",
      "order:build",
      "order:colonize",
      "stored-routes",
      "military-queue",
      "colonization-support",
      "auto-upgrades",
      "construction",
      "exploration",
      "corridors",
      "colonization-captures",
      "capture-news",
      "income",
      "treaties",
      "tech",
      "events-auto",
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
});

function makeOrder(type: Order["type"], targetId: string): Order {
  const base = {
    id: `order:${type}`,
    turnId: 3,
    playerId: "player:a",
    countryId: "country:a",
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  if (type === "ARMY_MOVE") return { ...base, type, provinceId: targetId };
  if (type === "BUILD") return { ...base, type, regionId: targetId };
  if (type === "COLONIZE") return { ...base, type, regionId: targetId };
  return { ...base, type };
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
