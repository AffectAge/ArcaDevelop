import type express from "express";
import type { Country, EventLogEntry, WsOutMessage } from "@arcanorum/shared";
import { z } from "zod";
import type { CountryDeletionPlan } from "../lifecycle/countryDeletionPlan";
import type { RouteAuth } from "../security/routeAuth";
import type { ImageDimensionRule } from "../uploads/uploadValidation";

export type AdminCountryUploadMiddleware = {
  fields: (fields: Array<{ name: string; maxCount?: number }>) => express.RequestHandler;
};

export type AdminCountryDbRecord = {
  id: string;
  name: string;
  color: string;
  flagUrl: string | null;
  crestUrl: string | null;
  cultureId: string;
  cultureName: string;
  cultureColor: string;
  cultureLogoUrl: string | null;
  religionId: string;
  religionName: string;
  religionColor: string;
  religionLogoUrl: string | null;
  cultureGroupId: string;
  religionGroupId: string;
  raceId: string;
  isAdmin: boolean;
  isLocked: boolean;
  blockedUntilTurn: number | null;
  blockedUntilAt: Date | null;
  lockReason?: string | null;
  ignoreUntilTurn: number | null;
  eventLogRetentionTurns?: number | null;
  isRegistrationApproved?: boolean;
};

export type AdminCountryUpdateData = {
  name?: string;
  color?: string;
  isAdmin?: boolean;
  ignoreUntilTurn?: number | null;
  flagUrl?: string | null;
  crestUrl?: string | null;
};

export type AdminCountryAuditEntry = {
  id: string;
};

export const adminCountryUpdateSchema = z.object({
  countryName: z.string().min(2).max(32).optional(),
  countryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isAdmin: z
    .string()
    .optional()
    .transform((value) => (value == null ? undefined : value === "true")),
  ignoreUntilTurn: z
    .string()
    .optional()
    .transform((value) => {
      if (value == null || value.trim() === "") {
        return undefined;
      }
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : undefined;
    }),
  marketId: z
    .string()
    .optional()
    .transform((value) => {
      if (value == null) return undefined;
      const next = value.trim();
      if (!next) return null;
      return next;
    }),
});

export type AdminCountryRoutesDependencies = {
  routeAuth: RouteAuth;
  upload: AdminCountryUploadMiddleware;
  flagImageRule: ImageDimensionRule;
  crestImageRule: ImageDimensionRule;
  masks: {
    resourcesByCountry: number;
    hexOwner: number;
    colonyProgressByRegion: number;
    regionConstructionQueueByRegion: number;
    parliamentByCountry: number;
    technologyByCountry: number;
    countryDecisionsByCountryId: number;
    countryEventsByCountryId: number;
    countryScheduledEventsByCountryId: number;
    countryEventFlagsByCountryId: number;
    journalEntriesByCountryId: number;
    countryModifiersByCountryId: number;
    divisionTemplatesByCountry: number;
    divisionsById: number;
    militaryFormationQueueByCountry: number;
    diplomacyProposals: number;
  };
  getTurnId: () => number;
  findCountry: (countryId: string) => Promise<AdminCountryDbRecord | null>;
  updateCountryAdmin: (countryId: string, isAdmin: boolean) => Promise<AdminCountryDbRecord>;
  updateCountry: (countryId: string, data: AdminCountryUpdateData) => Promise<AdminCountryDbRecord>;
  deleteCountry: (countryId: string) => Promise<void>;
  countryFromDb: (row: AdminCountryDbRecord) => Country;
  setCountryMarketId: (countryId: string, marketId: string | null) => void;
  invalidateCountryQueryCache: () => void;
  validateImageRule: (file: Express.Multer.File, rule: ImageDimensionRule) => boolean;
  removeUploadedFiles: (files: Array<Express.Multer.File | undefined>) => void;
  removeUploadedByUrl: (url?: string | null) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
  buildCountryDeletionPlan: (
    countryId: string,
    target: {
      flagUrl?: string | null;
      crestUrl?: string | null;
      cultureLogoUrl?: string | null;
      religionLogoUrl?: string | null;
    },
  ) => CountryDeletionPlan;
  removeCountryOrdersAndReadiness: (countryId: string) => void;
  cleanupWorldBaseAfterCountryRemoval: (countryId: string) => void;
  cleanupMarketsAfterCountryRemoval: (countryId: string) => void;
  pushAdminAuditLog: (entry: {
    actorCountryId: string;
    action: "country.delete";
    targetType: "country";
    targetId: string;
    metadata: { countryName: string; cleanupPlan: CountryDeletionPlan };
  }) => AdminCountryAuditEntry;
  cloneWorldBaseSectionSnapshot: (mask: number) => unknown;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: unknown) => void;
  makeOfficialNews: (input: {
    turn: number;
    category: "politics";
    title: string;
    message: string;
    countryId: string;
    priority: "high";
    visibility: "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export function registerAdminCountryRoutes(app: express.Express, deps: AdminCountryRoutesDependencies): void {
  app.patch("/admin/countries/:countryId/admin", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;

    const nextIsAdmin = Boolean(req.body?.isAdmin);

    try {
      const updated = await deps.updateCountryAdmin(req.params.countryId, nextIsAdmin);
      deps.invalidateCountryQueryCache();
      return res.json(deps.countryFromDb(updated));
    } catch {
      return res.status(404).json({ error: "COUNTRY_NOT_FOUND" });
    }
  });

  app.patch(
    "/admin/countries/:countryId",
    deps.upload.fields([{ name: "flag", maxCount: 1 }, { name: "crest", maxCount: 1 }]),
    async (req, res) => {
      const files = req.files as { flag?: Express.Multer.File[]; crest?: Express.Multer.File[] } | undefined;
      const flagFile = files?.flag?.[0];
      const crestFile = files?.crest?.[0];
      if (!(await deps.routeAuth.requireAdminOrCleanup(req, res, () => deps.removeUploadedFiles([flagFile, crestFile])))) {
        return;
      }

      const parsed = adminCountryUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
      }

      const countryIdParam = String(req.params.countryId);
      const target = await deps.findCountry(countryIdParam);
      if (!target) {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res.status(404).json({ error: "COUNTRY_NOT_FOUND" });
      }

      if (flagFile && !deps.validateImageRule(flagFile, deps.flagImageRule)) {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res
          .status(400)
          .json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", field: "flag", max: "192x128", ratio: "3:2" });
      }

      if (crestFile && !deps.validateImageRule(crestFile, deps.crestImageRule)) {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res
          .status(400)
          .json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", field: "crest", max: "128x192", ratio: "2:3" });
      }

      const data: AdminCountryUpdateData = {};
      if (parsed.data.countryName) {
        data.name = parsed.data.countryName;
      }
      if (parsed.data.countryColor) {
        data.color = parsed.data.countryColor;
      }
      if (parsed.data.isAdmin !== undefined) {
        data.isAdmin = parsed.data.isAdmin;
      }
      if (parsed.data.ignoreUntilTurn !== undefined) {
        data.ignoreUntilTurn = parsed.data.ignoreUntilTurn === 0 ? null : parsed.data.ignoreUntilTurn;
      }
      if (flagFile) {
        data.flagUrl = deps.makeVersionedUploadUrl(`flags/${flagFile.filename}`);
      }
      if (crestFile) {
        data.crestUrl = deps.makeVersionedUploadUrl(`crests/${crestFile.filename}`);
      }

      try {
        const updated = await deps.updateCountry(target.id, data);
        if (parsed.data.marketId !== undefined) {
          deps.setCountryMarketId(target.id, parsed.data.marketId);
        }

        if (flagFile) {
          deps.removeUploadedByUrl(target.flagUrl);
        }
        if (crestFile) {
          deps.removeUploadedByUrl(target.crestUrl);
        }
        deps.invalidateCountryQueryCache();
        deps.savePersistentState();
        return res.json(deps.countryFromDb(updated));
      } catch {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res.status(409).json({ error: "COUNTRY_UPDATE_FAILED" });
      }
    },
  );

  app.get("/admin/countries/:countryId/deletion-preview", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;

    const countryIdParam = String(req.params.countryId);
    const target = await deps.findCountry(countryIdParam);
    if (!target) {
      return res.status(404).json({ error: "COUNTRY_NOT_FOUND" });
    }

    return res.json({
      countryId: countryIdParam,
      cleanupPlan: deps.buildCountryDeletionPlan(countryIdParam, target),
    });
  });

  app.delete("/admin/countries/:countryId", async (req, res) => {
    const auth = await deps.routeAuth.requireAdmin(req, res);
    if (!auth) return;

    const countryIdParam = String(req.params.countryId);

    if (auth.countryId === countryIdParam) {
      return res.status(400).json({ error: "CANNOT_DELETE_SELF" });
    }

    const target = await deps.findCountry(countryIdParam);
    if (!target) {
      return res.status(404).json({ error: "COUNTRY_NOT_FOUND" });
    }
    const cleanupPlan = deps.buildCountryDeletionPlan(countryIdParam, target);

    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.resourcesByCountry |
        deps.masks.hexOwner |
        deps.masks.colonyProgressByRegion |
        deps.masks.regionConstructionQueueByRegion |
        deps.masks.parliamentByCountry |
        deps.masks.technologyByCountry |
        deps.masks.countryDecisionsByCountryId |
        deps.masks.countryEventsByCountryId |
        deps.masks.countryScheduledEventsByCountryId |
        deps.masks.countryEventFlagsByCountryId |
        deps.masks.journalEntriesByCountryId |
        deps.masks.countryModifiersByCountryId |
        deps.masks.divisionTemplatesByCountry |
        deps.masks.divisionsById |
        deps.masks.militaryFormationQueueByCountry |
        deps.masks.diplomacyProposals,
    );
    await deps.deleteCountry(countryIdParam);
    deps.invalidateCountryQueryCache();

    deps.removeUploadedByUrl(target.flagUrl);
    deps.removeUploadedByUrl(target.crestUrl);
    deps.removeUploadedByUrl(target.cultureLogoUrl);
    deps.removeUploadedByUrl(target.religionLogoUrl);
    deps.removeCountryOrdersAndReadiness(countryIdParam);
    deps.cleanupWorldBaseAfterCountryRemoval(countryIdParam);
    deps.cleanupMarketsAfterCountryRemoval(countryIdParam);
    const auditEntry = deps.pushAdminAuditLog({
      actorCountryId: auth.countryId,
      action: "country.delete",
      targetType: "country",
      targetId: countryIdParam,
      metadata: {
        countryName: target.name,
        cleanupPlan,
      },
    });

    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    deps.broadcast({
      type: "NEWS_EVENT",
      event: deps.makeOfficialNews({
        turn: deps.getTurnId(),
        category: "politics",
        title: "Страна удалена",
        message: `Администратор удалил страну ${target.name}`,
        countryId: countryIdParam,
        priority: "high",
        visibility: "public",
      }),
    });
    return res.json({ ok: true, cleanupPlan, auditEntryId: auditEntry.id });
  });
}
