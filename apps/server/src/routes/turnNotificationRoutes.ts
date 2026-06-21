import type express from "express";
import type { ResourceTotals, WsOutMessage } from "@arcanorum/shared";
import type { ResourceId } from "@arcanorum/shared";
import type { RouteAuth } from "../security/routeAuth";

export type TurnStatusCountryRecord = {
  id: string;
  name: string;
  color: string;
  flagUrl: string | null;
  isLocked: boolean;
  blockedUntilTurn: number | null;
  blockedUntilAt: Date | null;
  ignoreUntilTurn: number | null;
};

export type TurnStatusCountryItem = {
  id: string;
  name: string;
  color: string;
  flagUrl: string | null;
  status: "blocked" | "ignored" | "ready" | "waiting";
  blockedReason: "PERMANENT" | "TURN" | "TIME" | null;
  blockedUntilTurn: number | null;
  blockedUntilAt: string | null;
  ignoreUntilTurn: number | null;
  online: boolean;
  lastLoginAt: string | null;
  resources: ResourceTotals;
  resourceNetByTurn: Partial<Record<ResourceId, number>>;
};

export type QueuedUiNotificationRouteItem = {
  audience: "all" | "admins" | { type: "country"; countryId: string };
  notification: Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"];
  viewedByCountryIds: Set<string>;
};

export type TurnNotificationRoutesDependencies = {
  routeAuth: RouteAuth;
  isAdminCountry: (countryId: string) => Promise<boolean>;
  getTurnId: () => number;
  cleanupExpiredPunishments: (turnId: number, now: Date) => Promise<void>;
  getTurnStatusCountries: () => Promise<TurnStatusCountryRecord[]>;
  getReadySetForTurn: (turnId: number) => Set<string>;
  getOnlineCountryIds: () => Set<string>;
  getAiControlledCountryIds: () => Set<string>;
  getCountryResources: (countryId: string) => ResourceTotals | null;
  getCountryResourceNetByTurn: (countryId: string) => Partial<Record<ResourceId, number>>;
  getCountryBlockInfo: (
    country: Pick<TurnStatusCountryRecord, "isLocked" | "blockedUntilTurn" | "blockedUntilAt">,
    turnId: number,
    now: Date,
  ) => { blocked: boolean; reason: "PERMANENT" | "TURN" | "TIME" | null; blockedUntilTurn: number | null; blockedUntilAt: Date | null };
  getCountrySkipInfo: (
    country: Pick<TurnStatusCountryRecord, "ignoreUntilTurn">,
    turnId: number,
  ) => { ignored: boolean; ignoreUntilTurn: number | null };
  getLastLoginAt: (countryId: string) => string | null;
  getPendingUiNotificationsForCountry: (params: {
    countryId: string;
    isAdmin: boolean;
  }) => Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"][];
  findQueuedUiNotification: (notificationId: string) => QueuedUiNotificationRouteItem | null;
  isQueuedUiNotificationVisibleForCountry: (
    item: QueuedUiNotificationRouteItem,
    params: { countryId: string; isAdmin: boolean },
  ) => boolean;
};

export function registerTurnNotificationRoutes(
  app: express.Express,
  deps: TurnNotificationRoutesDependencies,
): void {
  app.get("/turn/status", async (_req, res) => {
    const now = new Date();
    const turnId = deps.getTurnId();
    await deps.cleanupExpiredPunishments(turnId, now);
    const countries = await deps.getTurnStatusCountries();
    const items = buildTurnStatusItems({
      countries,
      turnId,
      now,
      readySet: deps.getReadySetForTurn(turnId),
      onlineCountryIds: deps.getOnlineCountryIds(),
      aiControlledCountryIds: deps.getAiControlledCountryIds(),
      getCountryResources: deps.getCountryResources,
      getCountryResourceNetByTurn: deps.getCountryResourceNetByTurn,
      getCountryBlockInfo: deps.getCountryBlockInfo,
      getCountrySkipInfo: deps.getCountrySkipInfo,
      getLastLoginAt: deps.getLastLoginAt,
    });

    const requiredCount = items.filter((item) => item.status !== "blocked" && item.status !== "ignored").length;
    const readyCount = items.filter((item) => item.status === "ready").length;

    return res.json({ turnId, readyCount, requiredCount, countries: items });
  });

  app.get("/notifications/ui/pending", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const isAdmin = await deps.isAdminCountry(auth.countryId);
    const notifications = deps.getPendingUiNotificationsForCountry({ countryId: auth.countryId, isAdmin });
    return res.json({ notifications });
  });

  app.patch("/notifications/ui/:id/viewed", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const target = deps.findQueuedUiNotification(String(req.params.id));
    if (!target) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const isAdmin = await deps.isAdminCountry(auth.countryId);
    if (!deps.isQueuedUiNotificationVisibleForCountry(target, { countryId: auth.countryId, isAdmin })) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    target.viewedByCountryIds.add(auth.countryId);
    return res.json({ ok: true });
  });
}

export function buildTurnStatusItems(params: {
  countries: TurnStatusCountryRecord[];
  turnId: number;
  now: Date;
  readySet: Set<string>;
  onlineCountryIds: Set<string>;
  aiControlledCountryIds: Set<string>;
  getCountryResources: (countryId: string) => ResourceTotals | null;
  getCountryResourceNetByTurn: (countryId: string) => Partial<Record<ResourceId, number>>;
  getCountryBlockInfo: TurnNotificationRoutesDependencies["getCountryBlockInfo"];
  getCountrySkipInfo: TurnNotificationRoutesDependencies["getCountrySkipInfo"];
  getLastLoginAt: (countryId: string) => string | null;
}): TurnStatusCountryItem[] {
  return params.countries.map((country) => {
    const block = params.getCountryBlockInfo(country, params.turnId, params.now);
    const skip = params.getCountrySkipInfo(country, params.turnId);
    const isAiControlled = params.aiControlledCountryIds.has(country.id);
    const ready = !block.blocked && !skip.ignored && (params.readySet.has(country.id) || isAiControlled);
    const status = block.blocked ? "blocked" : skip.ignored ? "ignored" : ready ? "ready" : "waiting";

    return {
      id: country.id,
      name: country.name,
      color: country.color,
      flagUrl: country.flagUrl,
      status,
      blockedReason: block.reason,
      blockedUntilTurn: block.blockedUntilTurn,
      blockedUntilAt: block.blockedUntilAt ? block.blockedUntilAt.toISOString() : null,
      ignoreUntilTurn: skip.ignoreUntilTurn,
      online: params.onlineCountryIds.has(country.id) || isAiControlled,
      lastLoginAt: params.getLastLoginAt(country.id),
      resources: params.getCountryResources(country.id) ?? emptyResourceTotals(),
      resourceNetByTurn: params.getCountryResourceNetByTurn(country.id),
    };
  });
}

function emptyResourceTotals(): ResourceTotals {
  return {
    culture: 0,
    science: 0,
    religion: 0,
    colonization: 0,
    construction: 0,
    ducats: 0,
    gold: 0,
  };
}
