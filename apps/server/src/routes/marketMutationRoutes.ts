import type express from "express";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export type MarketMutationMarket = {
  id: string;
  name: string;
  logoUrl: string | null;
  ownerCountryId: string;
  capitalProvinceId?: string | null;
  visibility: "public" | "private";
};

export type MarketMutationUploadMiddleware = {
  single: (fieldName: string) => express.RequestHandler;
};

export const marketPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  visibility: z.enum(["public", "private"]).optional(),
  capitalProvinceId: z.string().trim().min(1).max(120).nullable().optional(),
});

export type MarketMutationRoutesDependencies = {
  routeAuth: RouteAuth;
  upload: MarketMutationUploadMiddleware;
  getMarketById: (marketId: string) => MarketMutationMarket | null | undefined;
  normalizeMarketVisibility: (value: unknown) => "public" | "private";
  getProvinceOwner: (provinceId: string) => string | null;
  validateImageDimensions: (file: Express.Multer.File) => boolean;
  removeUploadedFile: (file: Express.Multer.File | undefined) => void;
  removeUploadedByUrl: (url: string) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
  savePersistentState: () => void;
  buildMarketDetailsResponse: (marketId: string) => Promise<unknown>;
};

export function registerMarketMutationRoutes(
  app: express.Express,
  deps: MarketMutationRoutesDependencies,
): void {
  app.patch("/markets/:marketId", deps.upload.single("marketLogo"), async (req, res) => {
    const auth = deps.routeAuth.requireAuthOrCleanup(req, res, () =>
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined),
    );
    if (!auth) return;
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined);
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    if (market.ownerCountryId !== auth.countryId) {
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined);
      return res.status(403).json({ error: "MARKET_OWNER_ONLY" });
    }
    const parsed = marketPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined);
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const logoFile = req.file as Express.Multer.File | undefined;
    if (logoFile && !deps.validateImageDimensions(logoFile)) {
      deps.removeUploadedFile(logoFile);
      return res.status(400).json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", field: "marketLogo", max: "256x256" });
    }

    if (typeof parsed.data.name === "string") {
      market.name = parsed.data.name.trim();
    }
    if (typeof parsed.data.visibility === "string") {
      market.visibility = deps.normalizeMarketVisibility(parsed.data.visibility);
    }
    if (parsed.data.capitalProvinceId !== undefined) {
      const nextCapital =
        typeof parsed.data.capitalProvinceId === "string" && parsed.data.capitalProvinceId.trim().length > 0
          ? parsed.data.capitalProvinceId.trim()
          : null;
      if (nextCapital == null) {
        market.capitalProvinceId = null;
      } else {
        const provinceOwnerId = deps.getProvinceOwner(nextCapital);
        if (!provinceOwnerId || provinceOwnerId !== market.ownerCountryId) {
          deps.removeUploadedFile(logoFile);
          return res.status(400).json({ error: "INVALID_MARKET_CAPITAL_PROVINCE" });
        }
        market.capitalProvinceId = nextCapital;
      }
    }
    if (logoFile) {
      const previous = market.logoUrl;
      market.logoUrl = deps.makeVersionedUploadUrl(`markets/${logoFile.filename}`);
      if (previous) {
        deps.removeUploadedByUrl(previous);
      }
    }
    market.id = marketId;
    deps.savePersistentState();
    return res.json(await deps.buildMarketDetailsResponse(marketId));
  });
}
