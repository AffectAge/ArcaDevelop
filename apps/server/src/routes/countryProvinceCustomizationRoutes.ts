import type express from "express";
import type { EventLogEntry, ResourceFlowSourceType, ResourceId, ResourceTotals, WsOutMessage } from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export const provinceRenameSchema = z.object({
  provinceId: z.string().min(1),
  provinceName: z.string().trim().min(1).max(64),
});

export type CountryProvinceCustomizationWorldState = {
  provinceOwner: Record<string, string>;
  resourcesByCountry: Record<string, ResourceTotals>;
  provinceNameById: Record<string, string>;
};

export type CountryProvinceCustomizationMasks = {
  resourcesByCountry: number;
  provinceNameById: number;
};

export type CountryProvinceCustomizationRoutesDependencies = {
  routeAuth: RouteAuth;
  masks: CountryProvinceCustomizationMasks;
  getTurnId: () => number;
  getWorldBase: () => CountryProvinceCustomizationWorldState;
  getProvinceRenameDucatsCost: () => number;
  provinceExists: (provinceId: string) => boolean;
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

export function registerCountryProvinceCustomizationRoutes(
  app: express.Express,
  deps: CountryProvinceCustomizationRoutesDependencies,
): void {
  app.patch("/country/province-rename", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;

    const parsed = provinceRenameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const { provinceId, provinceName } = parsed.data;
    const worldBase = deps.getWorldBase();
    const ownerCountryId = worldBase.provinceOwner[provinceId] ?? null;
    if (!ownerCountryId || ownerCountryId !== auth.countryId) {
      return res.status(403).json({ error: "NOT_PROVINCE_OWNER" });
    }

    if (!deps.provinceExists(provinceId)) {
      return res.status(404).json({ error: "PROVINCE_NOT_FOUND" });
    }

    deps.ensureCountryInWorldBase(auth.countryId);
    const resources = worldBase.resourcesByCountry[auth.countryId];
    if (!resources) {
      return res.status(500).json({ error: "NO_RESOURCES" });
    }
    const provinceRenameDucatsCost = deps.getProvinceRenameDucatsCost();
    if (resources.ducats < provinceRenameDucatsCost) {
      return res.status(400).json({
        error: "INSUFFICIENT_DUCATS",
        required: provinceRenameDucatsCost,
        available: resources.ducats,
      });
    }

    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.resourcesByCountry | deps.masks.provinceNameById,
    );
    if (provinceRenameDucatsCost > 0 && deps.addResourceExpense) {
      deps.addResourceExpense({
        countryId: auth.countryId,
        resourceId: "ducats",
        amount: provinceRenameDucatsCost,
        sourceType: "customization",
        sourceId: `province:${provinceId}:rename`,
        categoryId: "customization",
        labelKey: "resourceLedger.source.customization.provinceRename",
        labelParams: { provinceId },
      });
      deps.flushResourceLedger?.();
    } else {
      resources.ducats = Math.max(0, resources.ducats - provinceRenameDucatsCost);
    }
    worldBase.provinceNameById[provinceId] = provinceName;

    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    deps.broadcast({
      type: "NEWS_EVENT",
      event: deps.makeOfficialNews({
        turn: deps.getTurnId(),
        category: "politics",
        title: "Провинция переименована",
        message: `${auth.countryId} переименовал провинцию ${provinceId} в "${provinceName}"`,
        countryId: auth.countryId,
        priority: "low",
        visibility: "public",
      }),
    });

    return res.json({
      provinceId,
      provinceName,
      chargedDucats: provinceRenameDucatsCost,
      resources: { ducats: resources.ducats },
    });
  });
}
