import { describe, expect, it } from "vitest";
import type { AiEconomyOrderCandidate } from "../ai/aiEconomyCandidates";
import { createAiFixtureWorld } from "../ai/aiFixtureHarness";
import type { AiRuntimeCandidateProvider } from "../ai/aiRuntimePlanner";
import {
  createRuntimeAiOrderDeltaSubmitter,
  runAiBuildOrderRuntimeCycle,
  type AiOrderDeltaRuntimeParams,
} from "./aiRuntimeCoordinator";
import type { GameSettings } from "./gameSettingsTypes";

const aiSettings: GameSettings["ai"] = {
  enabled: true,
  maxCountriesPerTick: 2,
  maxDecisionCandidatesPerCountry: 4,
  contextCacheTtlTurns: 1,
};

function createBuildCandidate(countryId: string): AiEconomyOrderCandidate {
  return {
    kind: "build",
    countryId,
    regionId: "region:alpha-core",
    buildingId: "building:farm",
    orderDraft: {
      type: "BUILD",
      countryId,
      regionId: "region:alpha-core",
      payload: { buildingId: "building:farm", owner: { type: "state", countryId } },
    },
  };
}

describe("runAiBuildOrderRuntimeCycle", () => {
  it("does not submit anything when AI is disabled", async () => {
    let submitCalls = 0;

    const result = await runAiBuildOrderRuntimeCycle({
      world: createAiFixtureWorld(),
      aiSettings: { ...aiSettings, enabled: false },
      countryIds: ["country:alpha"],
      candidateProviders: [createBuildProvider()],
      submitOrderDelta: async () => {
        submitCalls += 1;
        return { ok: true, submittedOrderId: "order:unused" };
      },
    });

    expect(result.plan.enabled).toBe(false);
    expect(result.drafts).toEqual([]);
    expect(result.submissions).toEqual([]);
    expect(submitCalls).toBe(0);
  });

  it("plans build drafts and submits them through the injected order-delta path", async () => {
    const submittedOrders: unknown[] = [];

    const result = await runAiBuildOrderRuntimeCycle({
      world: createAiFixtureWorld(),
      aiSettings,
      countryIds: ["country:alpha"],
      candidateProviders: [createBuildProvider()],
      submitOrderDelta: async (delta) => {
        submittedOrders.push(delta);
        return { ok: true, submittedOrderId: "order:ai:build" };
      },
    });

    expect(result.plan.processedCountryIds).toEqual(["country:alpha"]);
    expect(result.drafts).toHaveLength(1);
    expect(submittedOrders).toEqual([{ type: "ORDER_DELTA", order: result.drafts[0]?.order }]);
    expect(result.submissions).toEqual([{ ok: true, draft: result.drafts[0], submittedOrderId: "order:ai:build" }]);
  });

  it("keeps rejected AI submissions visible", async () => {
    const result = await runAiBuildOrderRuntimeCycle({
      world: createAiFixtureWorld(),
      aiSettings,
      countryIds: ["country:alpha"],
      candidateProviders: [createBuildProvider()],
      submitOrderDelta: async () => ({ ok: false, reason: "BUILD_CONFLICT" }),
    });

    expect(result.submissions).toEqual([{ ok: false, draft: result.drafts[0], reason: "BUILD_CONFLICT" }]);
  });

  it("adapts websocket runtime errors into AI submission diagnostics", async () => {
    const errors: unknown[] = [];
    const submitter = createRuntimeAiOrderDeltaSubmitter({
      runtimeParams: createRuntimeParamsWithoutResources(),
      onError: (message) => errors.push(message),
    });

    const result = await submitter({
      type: "ORDER_DELTA",
      order: {
        type: "BUILD",
        turnId: 1,
        playerId: "ai:country:alpha",
        countryId: "country:alpha",
        regionId: "region:alpha-core",
        payload: {},
      },
    });

    expect(result).toEqual({
      ok: false,
      reason: "NO_RESOURCES",
      diagnostics: { runtimeErrors: [{ code: "NO_RESOURCES", message: "Ресурсы страны не инициализированы" }] },
    });
    expect(errors).toEqual([{ type: "ERROR", code: "NO_RESOURCES", message: "Ресурсы страны не инициализированы" }]);
  });
});

function createRuntimeParamsWithoutResources(): AiOrderDeltaRuntimeParams {
  const world = createAiFixtureWorld({ resourcesByCountry: {} });
  return {
    wsServer: {} as unknown as AiOrderDeltaRuntimeParams["wsServer"],
    onlinePlayers: new Set<string>(),
    getWorldBase: () => world,
    getGameSettings: () => ({ content: { buildings: [] } }) as unknown as GameSettings,
    getTurnId: () => 1,
    getWorldStateVersion: () => 1,
    getOrdersByTurn: () => new Map(),
    getQueuedColonizeRegionsByCountryByTurn: () => new Map(),
    getActiveColonizeRegionsByCountry: () => new Map(),
    parseAuthToken: () => null,
    findCountryForAuth: async () => null,
    listResolveStatusCountries: async () => [],
    ensureCountryInWorldBase: () => undefined,
    getLastLoginAt: () => null,
    setLastLoginAt: () => undefined,
    getReplayDeltasFromVersion: () => ({ ok: false }),
    sendPendingRegistrationNotificationsToAdminSocket: async () => undefined,
    broadcast: () => undefined,
    broadcastTurnResolveStarted: () => undefined,
    resolveAndBroadcastCurrentTurn: () => false,
    cleanupExpiredPunishments: async () => undefined,
    getCountryBlockInfo: () => ({ blocked: false }),
    getCountrySkipInfo: () => ({ ignored: false }),
    getReadySetForTurn: () => new Set(),
    savePersistentState: () => undefined,
    addOrderToTurnIndexes: () => undefined,
    getRegionColonizationConfig: () => ({ cost: 1, disabled: false, manualCost: false }),
    parseRequestedBuildingIdFromPayload: () => "",
    resolveBuildingOwnerFromPayload: () => null,
    isCountryAllowedForBuildingWithEngine: async () => false,
    getProvinceBuildRestriction: () => null,
    isBuildingUnlockedForCountry: () => false,
    countBuildingOccurrences: () => ({ byCountry: 0, global: 0 }),
    getCountryBuildLimit: () => null,
    getGlobalBuildLimit: () => null,
    normalizeArmyMoveRoute: () => [],
    isContiguousArmyRoute: () => false,
  };
}

function createBuildProvider(): AiRuntimeCandidateProvider {
  return {
    id: "build",
    selectCandidates: ({ countryId }) => [createBuildCandidate(countryId)],
  };
}
