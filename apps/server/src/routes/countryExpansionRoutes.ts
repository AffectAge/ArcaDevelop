import type express from "express";
import type {
  EventLogEntry,
  Order,
  RegionResourceExplorationProject,
  ResourceFlowSourceType,
  ResourceId,
  ResourceTotals,
  WorldBase,
  WsOutMessage,
} from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";
import { createResourceExplorationProject } from "../mechanics/resourceExplorationMechanics";

export const colonizationActionSchema = z.object({
  regionId: z.string().min(1),
});

export const explorationActionSchema = z.object({
  regionId: z.string().min(1),
});

export type CountryExpansionMasks = {
  colonyProgressByRegion: number;
  regionResourceExplorationQueueByRegion: number;
  resourcesByCountry: number;
  resourceLedgerByTurn: number;
};

export type CountryExpansionWorldState = {
  regionOwner: Record<string, string>;
  regionController: Record<string, string>;
  colonyProgressByRegion: Record<string, Record<string, number>>;
  resourcesByCountry: Record<string, ResourceTotals>;
  regionResourceExplorationQueueByRegion: Record<string, RegionResourceExplorationProject[]>;
};

export type CountryExpansionRoutesDependencies = {
  routeAuth: RouteAuth;
  masks: CountryExpansionMasks;
  createId: () => string;
  getTurnId: () => number;
  getWorldBase: () => WorldBase & CountryExpansionWorldState;
  getWorldState: () => CountryExpansionWorldState;
  getMaxActiveColonizations: () => number;
  getExplorationDurationTurns: () => number;
  getHexRegionId: (hexId: string) => string | null;
  getRegionColonizationConfig: (regionId: string) => { disabled: boolean };
  ensureCountryInWorldBase: (countryId: string) => void;
  addActiveColonizationTarget: (countryId: string, regionId: string) => void;
  removeActiveColonizationTarget: (countryId: string, regionId: string) => void;
  removeRegionFromActiveColonizationIndex: (regionId: string) => void;
  getActiveColonizeRegionIds: (countryId: string) => Iterable<string>;
  getQueuedColonizeRegionIds: (turnId: number, countryId: string) => Iterable<string>;
  getOrdersByTurn: (turnId: number) => Map<string, Order[]> | undefined;
  deleteOrdersForTurn: (turnId: number) => void;
  removeOrderFromTurnIndexes: (order: Order) => void;
  dropTurnOrderIndexes: (turnId: number) => void;
  cloneWorldBaseSectionSnapshot: (mask: number) => unknown;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: unknown) => void;
  addResourceLedgerExpense?: (input: {
    countryId: string;
    resourceId: ResourceId;
    amount: number;
    sourceType: ResourceFlowSourceType;
    sourceId: string;
    categoryId: string;
    labelKey: string;
    labelParams?: Record<string, string | number | boolean | null>;
    metadata?: Record<string, string | number | boolean | null>;
  }) => void;
  flushResourceLedger?: () => void;
  makeOfficialNews: (input: {
    turn: number;
    category: "colonization";
    title: string;
    message: string;
    countryId: string;
    priority: "low";
    visibility: "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export function registerCountryExpansionRoutes(
  app: express.Express,
  deps: CountryExpansionRoutesDependencies,
): void {
  app.post("/country/colonization/start", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;

    const parsed = colonizationActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const { regionId } = parsed.data;
    const worldState = deps.getWorldState();
    const regionConfig = deps.getRegionColonizationConfig(regionId);

    if (worldState.regionOwner[regionId]) {
      return res.status(400).json({ error: "REGION_NOT_NEUTRAL" });
    }
    if (regionConfig.disabled) {
      return res.status(400).json({ error: "COLONIZATION_DISABLED" });
    }

    deps.ensureCountryInWorldBase(auth.countryId);
    const resources = worldState.resourcesByCountry[auth.countryId];
    if (!resources) {
      return res.status(500).json({ error: "NO_RESOURCES" });
    }

    const existing = worldState.colonyProgressByRegion[regionId] ?? {};
    if (existing[auth.countryId] != null) {
      return res.status(400).json({ error: "ALREADY_COLONIZING" });
    }

    const activeColonizeTargets = new Set<string>(deps.getActiveColonizeRegionIds(auth.countryId));
    for (const queuedRegionId of deps.getQueuedColonizeRegionIds(deps.getTurnId(), auth.countryId)) {
      activeColonizeTargets.add(queuedRegionId);
    }

    if (activeColonizeTargets.size >= deps.getMaxActiveColonizations()) {
      return res.status(400).json({
        error: "COLONIZE_LIMIT",
        current: activeColonizeTargets.size,
        limit: deps.getMaxActiveColonizations(),
      });
    }

    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.colonyProgressByRegion);
    worldState.colonyProgressByRegion[regionId] = {
      ...existing,
      [auth.countryId]: 0,
    };
    deps.addActiveColonizationTarget(auth.countryId, regionId);

    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    deps.broadcast({
      type: "NEWS_EVENT",
      event: deps.makeOfficialNews({
        turn: deps.getTurnId(),
        category: "colonization",
        title: "Начало колонизации",
        message: `${auth.countryId} начал колонизацию региона ${regionId}`,
        countryId: auth.countryId,
        priority: "low",
        visibility: "public",
      }),
    });

    return res.json({ ok: true, worldBase: deps.getWorldBase(), turnId: deps.getTurnId(), chargedDucats: 0 });
  });

  app.post("/country/colonization/cancel", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;

    const parsed = colonizationActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const { regionId } = parsed.data;
    const worldState = deps.getWorldState();
    const progress = worldState.colonyProgressByRegion[regionId];
    if (!progress || progress[auth.countryId] == null) {
      return res.status(404).json({ error: "COLONIZATION_NOT_FOUND" });
    }

    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.colonyProgressByRegion);
    delete progress[auth.countryId];
    if (Object.keys(progress).length === 0) {
      delete worldState.colonyProgressByRegion[regionId];
      deps.removeRegionFromActiveColonizationIndex(regionId);
    } else {
      worldState.colonyProgressByRegion[regionId] = progress;
      deps.removeActiveColonizationTarget(auth.countryId, regionId);
    }

    removeColonizationOrdersForRegion(auth.countryId, regionId, deps);

    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    deps.broadcast({
      type: "NEWS_EVENT",
      event: deps.makeOfficialNews({
        turn: deps.getTurnId(),
        category: "colonization",
        title: "Отмена колонизации",
        message: `${auth.countryId} отменил колонизацию региона ${regionId}`,
        countryId: auth.countryId,
        priority: "low",
        visibility: "public",
      }),
    });

    return res.json({ ok: true, worldBase: deps.getWorldBase(), turnId: deps.getTurnId() });
  });

  app.post("/country/exploration/start", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = explorationActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const { regionId } = parsed.data;
    const worldState = deps.getWorldState();
    const controllerCountryId = worldState.regionController[regionId] ?? worldState.regionOwner[regionId] ?? null;
    if (controllerCountryId !== auth.countryId) {
      return res.status(403).json({ error: "REGION_NOT_CONTROLLED" });
    }
    const queue = [...(worldState.regionResourceExplorationQueueByRegion[regionId] ?? [])];
    if (queue.some((project) => project.requestedByCountryId === auth.countryId)) {
      return res.status(409).json({ error: "EXPLORATION_ALREADY_QUEUED" });
    }
    const durationTurns = deps.getExplorationDurationTurns();
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.regionResourceExplorationQueueByRegion);
    queue.push(
      createResourceExplorationProject({
        queueId: deps.createId(),
        requestedByCountryId: auth.countryId,
        startedTurnId: deps.getTurnId(),
        durationTurns,
      }),
    );
    worldState.regionResourceExplorationQueueByRegion[regionId] = queue;
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json({ ok: true, regionId, queue: worldState.regionResourceExplorationQueueByRegion[regionId] });
  });

}

function removeColonizationOrdersForRegion(
  countryId: string,
  regionId: string,
  deps: Pick<
    CountryExpansionRoutesDependencies,
    "getTurnId" | "getOrdersByTurn" | "removeOrderFromTurnIndexes" | "dropTurnOrderIndexes" | "deleteOrdersForTurn"
  >,
): void {
  const turnId = deps.getTurnId();
  const turnOrders = deps.getOrdersByTurn(turnId);
  if (!turnOrders) return;
  for (const [playerId, orders] of turnOrders.entries()) {
    const removed: Order[] = [];
    const filtered = orders.filter((order) => {
      const shouldRemove = order.type === "COLONIZE" && order.countryId === countryId && order.regionId === regionId;
      if (shouldRemove) removed.push(order);
      return !shouldRemove;
    });
    if (filtered.length !== orders.length) {
      for (const order of removed) {
        deps.removeOrderFromTurnIndexes(order);
      }
      if (filtered.length > 0) {
        turnOrders.set(playerId, filtered);
      } else {
        turnOrders.delete(playerId);
      }
    }
  }
  if (turnOrders.size === 0) {
    deps.deleteOrdersForTurn(turnId);
    deps.dropTurnOrderIndexes(turnId);
  }
}
