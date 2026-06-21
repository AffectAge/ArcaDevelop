import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  buildTurnStatusItems,
  registerTurnNotificationRoutes,
  type QueuedUiNotificationRouteItem,
  type TurnStatusCountryRecord,
} from "./turnNotificationRoutes";

describe("turnNotificationRoutes", () => {
  it("builds turn status items from punishment, skip, ready, and online state", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const countries: TurnStatusCountryRecord[] = [
      makeCountry({ id: "blocked", blockedUntilTurn: 3 }),
      makeCountry({ id: "ignored", ignoreUntilTurn: 3 }),
      makeCountry({ id: "ready" }),
      makeCountry({ id: "waiting" }),
    ];

    const items = buildTurnStatusItems({
      countries,
      turnId: 2,
      now,
      readySet: new Set(["blocked", "ignored", "ready"]),
      onlineCountryIds: new Set(["ready"]),
      aiControlledCountryIds: new Set(),
      getCountryResources: () => null,
      getCountryResourceNetByTurn: (countryId) => (countryId === "ready" ? { ducats: 5, science: -2 } : {}),
      getCountryBlockInfo: (country, turnId) =>
        country.blockedUntilTurn != null && turnId <= country.blockedUntilTurn
          ? { blocked: true, reason: "TURN", blockedUntilTurn: country.blockedUntilTurn, blockedUntilAt: null }
          : { blocked: false, reason: null, blockedUntilTurn: null, blockedUntilAt: null },
      getCountrySkipInfo: (country, turnId) =>
        country.ignoreUntilTurn != null && turnId <= country.ignoreUntilTurn
          ? { ignored: true, ignoreUntilTurn: country.ignoreUntilTurn }
          : { ignored: false, ignoreUntilTurn: null },
      getLastLoginAt: (countryId) => (countryId === "ready" ? "login" : null),
    });

    expect(items.map((item) => [item.id, item.status])).toEqual([
      ["blocked", "blocked"],
      ["ignored", "ignored"],
      ["ready", "ready"],
      ["waiting", "waiting"],
    ]);
    expect(items.find((item) => item.id === "ready")).toMatchObject({
      online: true,
      lastLoginAt: "login",
      resourceNetByTurn: { ducats: 5, science: -2 },
    });
  });

  it("treats AI countries as online and ready without a socket or ready marker", () => {
    const items = buildTurnStatusItems({
      countries: [makeCountry({ id: "ai" }), makeCountry({ id: "player" })],
      turnId: 2,
      now: new Date("2026-01-01T00:00:00.000Z"),
      readySet: new Set(),
      onlineCountryIds: new Set(),
      aiControlledCountryIds: new Set(["ai"]),
      getCountryResources: () => null,
      getCountryResourceNetByTurn: () => ({}),
      getCountryBlockInfo: () => ({ blocked: false, reason: null, blockedUntilTurn: null, blockedUntilAt: null }),
      getCountrySkipInfo: () => ({ ignored: false, ignoreUntilTurn: null }),
      getLastLoginAt: () => null,
    });

    expect(items.find((item) => item.id === "ai")).toMatchObject({ status: "ready", online: true });
    expect(items.find((item) => item.id === "player")).toMatchObject({ status: "waiting", online: false });
  });

  it("serves turn status through injected dependencies", async () => {
    const cleanupExpiredPunishments = vi.fn().mockResolvedValue(undefined);
    const app = express();
    registerTurnNotificationRoutes(app, {
      ...makeDeps(),
      cleanupExpiredPunishments,
      getTurnStatusCountries: async () => [makeCountry({ id: "ready" })],
      getReadySetForTurn: () => new Set(["ready"]),
      getOnlineCountryIds: () => new Set(["ready"]),
      getAiControlledCountryIds: () => new Set(),
      getCountryResourceNetByTurn: () => ({ culture: 3 }),
      getLastLoginAt: () => "login",
    });

    const response = await request(app, "/turn/status");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      turnId: 5,
      readyCount: 1,
      requiredCount: 1,
      countries: [{ id: "ready", status: "ready", online: true, lastLoginAt: "login", resourceNetByTurn: { culture: 3 } }],
    });
    expect(cleanupExpiredPunishments).toHaveBeenCalledOnce();
  });

  it("serves pending notifications and marks visible notifications viewed", async () => {
    const viewedByCountryIds = new Set<string>();
    const target = {
      audience: "all",
      notification: {
        id: "note-1",
        category: "system",
        createdAt: "2026-01-01T00:00:00.000Z",
        action: { type: "message" },
      },
      viewedByCountryIds,
    } satisfies QueuedUiNotificationRouteItem;
    const app = express();
    registerTurnNotificationRoutes(app, {
      ...makeDeps(),
      getPendingUiNotificationsForCountry: () => [target.notification],
      findQueuedUiNotification: () => target,
      isQueuedUiNotificationVisibleForCountry: () => true,
    });

    const pending = await request(app, "/notifications/ui/pending");
    const viewed = await request(app, "/notifications/ui/note-1/viewed", { method: "PATCH" });

    expect(pending.status).toBe(200);
    expect(await pending.json()).toEqual({ notifications: [target.notification] });
    expect(viewed.status).toBe(200);
    expect(await viewed.json()).toEqual({ ok: true });
    expect(viewedByCountryIds.has("country-a")).toBe(true);
  });

  it("forbids viewing notifications outside the audience", async () => {
    const app = express();
    registerTurnNotificationRoutes(app, {
      ...makeDeps(),
      findQueuedUiNotification: () => ({
        audience: "admins",
        notification: {
          id: "note-1",
          category: "system",
          createdAt: "2026-01-01T00:00:00.000Z",
          action: { type: "message" },
        },
        viewedByCountryIds: new Set<string>(),
      }),
      isQueuedUiNotificationVisibleForCountry: () => false,
    });

    const response = await request(app, "/notifications/ui/note-1/viewed", { method: "PATCH" });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "FORBIDDEN" });
  });
});

function makeCountry(overrides: Partial<TurnStatusCountryRecord>): TurnStatusCountryRecord {
  return {
    id: "country",
    name: "Country",
    color: "#ffffff",
    flagUrl: null,
    isLocked: false,
    blockedUntilTurn: null,
    blockedUntilAt: null,
    ignoreUntilTurn: null,
    ...overrides,
  };
}

function makeDeps() {
  return {
    routeAuth: createAllowedRouteAuth(),
    isAdminCountry: vi.fn().mockResolvedValue(false),
    getTurnId: () => 5,
    cleanupExpiredPunishments: vi.fn().mockResolvedValue(undefined),
    getTurnStatusCountries: async () => [],
    getReadySetForTurn: () => new Set<string>(),
    getOnlineCountryIds: () => new Set<string>(),
    getAiControlledCountryIds: () => new Set<string>(),
    getCountryResources: () => null,
    getCountryResourceNetByTurn: () => ({}),
    getCountryBlockInfo: () => ({
      blocked: false,
      reason: null,
      blockedUntilTurn: null,
      blockedUntilAt: null,
    }),
    getCountrySkipInfo: () => ({ ignored: false, ignoreUntilTurn: null }),
    getLastLoginAt: () => null,
    getPendingUiNotificationsForCountry: () => [],
    findQueuedUiNotification: () => null,
    isQueuedUiNotificationVisibleForCountry: () => false,
  };
}

function createAllowedRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn().mockReturnValue({ countryId: "country-a" }),
    requireAuthOrCleanup: vi.fn(),
    requireAdmin: vi.fn(),
    requireAdminOrCleanup: vi.fn(),
    requireSelfOrAdmin: vi.fn(),
  } as unknown as RouteAuth;
}

async function request(app: express.Express, path: string, init?: RequestInit): Promise<Response> {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a port");
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
