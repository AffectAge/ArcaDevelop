import type express from "express";
import type { EventLogEntry, ResourceFlowSourceType, ResourceId, ResourceTotals, WsOutMessage } from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export const hexRenameSchema = z.object({
  hexId: z.string().min(1),
  hexName: z.string().trim().min(1).max(64),
});

export type CountryHexCustomizationWorldState = {
  hexOwner: Record<string, string>;
  resourcesByCountry: Record<string, ResourceTotals>;
  hexNameById: Record<string, string>;
};

export type CountryHexCustomizationMasks = {
  resourcesByCountry: number;
  hexNameById: number;
};

export type CountryHexCustomizationRoutesDependencies = {
  routeAuth: RouteAuth;
  masks: CountryHexCustomizationMasks;
  getTurnId: () => number;
  getWorldBase: () => CountryHexCustomizationWorldState;
  getHexRenameDucatsCost: () => number;
  hexExists: (hexId: string) => boolean;
  ensureCountryInWorldBase: (countryId: string) => void;
  cloneWorldBaseSectionSnapshot: (mask: number) => unknown;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: unknown) => void;
  makeOfficialNews: (input: {
    turn: number;
    category: "politics";
    title: string;
    message: string;
    countryId: string;
    priority: "low";
    visibility: "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
  addResourceExpense?: (input: {
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
};

export function registerCountryHexCustomizationRoutes(
  app: express.Express,
  deps: CountryHexCustomizationRoutesDependencies,
): void {
  app.patch("/country/hex-rename", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;

    const parsed = hexRenameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const { hexId, hexName } = parsed.data;
    const worldBase = deps.getWorldBase();
    const ownerCountryId = worldBase.hexOwner[hexId] ?? null;
    if (!ownerCountryId || ownerCountryId !== auth.countryId) {
      return res.status(403).json({ error: "NOT_HEX_OWNER" });
    }

    if (!deps.hexExists(hexId)) {
      return res.status(404).json({ error: "HEX_NOT_FOUND" });
    }

    deps.ensureCountryInWorldBase(auth.countryId);
    const resources = worldBase.resourcesByCountry[auth.countryId];
    if (!resources) {
      return res.status(500).json({ error: "NO_RESOURCES" });
    }
    const hexRenameDucatsCost = deps.getHexRenameDucatsCost();
    if (resources.ducats < hexRenameDucatsCost) {
      return res.status(400).json({
        error: "INSUFFICIENT_DUCATS",
        required: hexRenameDucatsCost,
        available: resources.ducats,
      });
    }

    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.resourcesByCountry | deps.masks.hexNameById,
    );
    if (hexRenameDucatsCost > 0 && deps.addResourceExpense) {
      deps.addResourceExpense({
        countryId: auth.countryId,
        resourceId: "ducats",
        amount: hexRenameDucatsCost,
        sourceType: "customization",
        sourceId: `${hexId}:rename`,
        categoryId: "customization",
        labelKey: "resourceLedger.source.customization.hexRename",
        labelParams: { hexId },
      });
      deps.flushResourceLedger?.();
    } else {
      resources.ducats = Math.max(0, resources.ducats - hexRenameDucatsCost);
    }
    worldBase.hexNameById[hexId] = hexName;

    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    deps.broadcast({
      type: "NEWS_EVENT",
      event: deps.makeOfficialNews({
        turn: deps.getTurnId(),
        category: "politics",
        title: "Гекс переименован",
        message: `${auth.countryId} переименовал гекс ${hexId} в "${hexName}"`,
        countryId: auth.countryId,
        priority: "low",
        visibility: "public",
      }),
    });

    return res.json({
      hexId,
      hexName,
      chargedDucats: hexRenameDucatsCost,
      resources: { ducats: resources.ducats },
    });
  });
}
