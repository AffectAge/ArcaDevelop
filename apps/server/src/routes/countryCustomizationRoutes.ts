import type express from "express";
import type { Country, ResourceFlowSourceType, ResourceId, ResourceTotals } from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";
import type { ImageDimensionRule } from "../uploads/uploadValidation";
import type { AdminCountryDbRecord } from "./adminCountryRoutes";

export type CountryCustomizationUploadMiddleware = {
  fields: (fields: Array<{ name: string; maxCount?: number }>) => express.RequestHandler;
};

export type CountryCustomizationWorldState = {
  resourcesByCountry: Record<string, ResourceTotals>;
};

export type CountryCustomizationSettings = {
  renameDucats: number;
  recolorDucats: number;
  flagDucats: number;
  crestDucats: number;
};

export type CountryCustomizationUpdateData = {
  name?: string;
  color?: string;
  flagUrl?: string | null;
  crestUrl?: string | null;
};

export const selfCountryCustomizationSchema = z.object({
  countryName: z.string().min(2).max(32).optional(),
  countryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type CountryCustomizationRoutesDependencies = {
  routeAuth: RouteAuth;
  upload: CountryCustomizationUploadMiddleware;
  flagImageRule: ImageDimensionRule;
  crestImageRule: ImageDimensionRule;
  getWorldBase: () => CountryCustomizationWorldState;
  getCustomizationSettings: () => CountryCustomizationSettings;
  ensureCountryInWorldBase: (countryId: string) => void;
  findCountry: (countryId: string) => Promise<AdminCountryDbRecord | null>;
  updateCountry: (countryId: string, data: CountryCustomizationUpdateData) => Promise<AdminCountryDbRecord>;
  countryFromDb: (row: AdminCountryDbRecord) => Country;
  validateImageRule: (file: Express.Multer.File, rule: ImageDimensionRule) => boolean;
  removeUploadedFiles: (files: Array<Express.Multer.File | undefined>) => void;
  removeUploadedByUrl: (url?: string | null) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
  savePersistentState: () => void;
  invalidateCountryQueryCache: () => void;
  addResourceExpense?: (input: {
    countryId: string;
    resourceId: ResourceId;
    amount: number;
    sourceType: ResourceFlowSourceType;
    sourceId: string;
    categoryId: string;
    labelKey: string;
    metadata?: Record<string, string | number | boolean | null>;
  }) => void;
  flushResourceLedger?: () => void;
};

export function registerCountryCustomizationRoutes(
  app: express.Express,
  deps: CountryCustomizationRoutesDependencies,
): void {
  app.patch(
    "/country/customization",
    deps.upload.fields([{ name: "flag", maxCount: 1 }, { name: "crest", maxCount: 1 }]),
    async (req, res) => {
      const files = req.files as { flag?: Express.Multer.File[]; crest?: Express.Multer.File[] } | undefined;
      const flagFile = files?.flag?.[0];
      const crestFile = files?.crest?.[0];
      const auth = deps.routeAuth.requireAuthOrCleanup(req, res, () =>
        deps.removeUploadedFiles([flagFile, crestFile]),
      );
      if (!auth) return;

      const parsed = selfCountryCustomizationSchema.safeParse(req.body);
      if (!parsed.success) {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
      }

      const target = await deps.findCountry(auth.countryId);
      if (!target) {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res.status(404).json({ error: "COUNTRY_NOT_FOUND" });
      }

      if (flagFile && !deps.validateImageRule(flagFile, deps.flagImageRule)) {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res
          .status(400)
          .json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", field: "flag", max: "192x128" });
      }

      if (crestFile && !deps.validateImageRule(crestFile, deps.crestImageRule)) {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res
          .status(400)
          .json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", field: "crest", max: "128x146" });
      }

      const normalizedName = parsed.data.countryName?.trim();
      const normalizedColor = parsed.data.countryColor?.toLowerCase();

      const nameChanged =
        typeof normalizedName === "string" && normalizedName.length > 0 && normalizedName !== target.name;
      const colorChanged =
        typeof normalizedColor === "string" && normalizedColor !== target.color.toLowerCase();
      const flagChanged = Boolean(flagFile);
      const crestChanged = Boolean(crestFile);

      if (!nameChanged && !colorChanged && !flagChanged && !crestChanged) {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res.status(400).json({ error: "NO_CHANGES" });
      }

      const settings = deps.getCustomizationSettings();
      const costBreakdown = {
        rename: nameChanged ? settings.renameDucats : 0,
        recolor: colorChanged ? settings.recolorDucats : 0,
        flag: flagChanged ? settings.flagDucats : 0,
        crest: crestChanged ? settings.crestDucats : 0,
      };
      const totalCost =
        costBreakdown.rename + costBreakdown.recolor + costBreakdown.flag + costBreakdown.crest;

      deps.ensureCountryInWorldBase(auth.countryId);
      const worldBase = deps.getWorldBase();
      const countryResource = worldBase.resourcesByCountry[auth.countryId];
      if (!countryResource) {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res.status(500).json({ error: "NO_RESOURCES" });
      }
      if (countryResource.ducats < totalCost) {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res.status(400).json({
          error: "INSUFFICIENT_DUCATS",
          required: totalCost,
          available: countryResource.ducats,
          costBreakdown,
        });
      }

      const data: CountryCustomizationUpdateData = {};
      if (nameChanged) {
        data.name = normalizedName;
      }
      if (colorChanged) {
        data.color = normalizedColor;
      }
      if (flagFile) {
        data.flagUrl = deps.makeVersionedUploadUrl(`flags/${flagFile.filename}`);
      }
      if (crestFile) {
        data.crestUrl = deps.makeVersionedUploadUrl(`crests/${crestFile.filename}`);
      }

      try {
        const updated = await deps.updateCountry(auth.countryId, data);

        if (flagFile) {
          deps.removeUploadedByUrl(target.flagUrl);
        }
        if (crestFile) {
          deps.removeUploadedByUrl(target.crestUrl);
        }

        if (totalCost > 0 && deps.addResourceExpense) {
          deps.addResourceExpense({
            countryId: auth.countryId,
            resourceId: "ducats",
            amount: totalCost,
            sourceType: "customization",
            sourceId: `country:${auth.countryId}:customization`,
            categoryId: "customization",
            labelKey: "resourceLedger.source.customization.country",
            metadata: costBreakdown,
          });
          deps.flushResourceLedger?.();
        } else {
          countryResource.ducats = Math.max(0, countryResource.ducats - totalCost);
        }
        deps.savePersistentState();
        deps.invalidateCountryQueryCache();

        return res.json({
          country: deps.countryFromDb(updated),
          chargedDucats: totalCost,
          costBreakdown,
          resources: worldBase.resourcesByCountry[auth.countryId],
        });
      } catch {
        deps.removeUploadedFiles([flagFile, crestFile]);
        return res.status(409).json({ error: "COUNTRY_UPDATE_FAILED" });
      }
    },
  );
}
