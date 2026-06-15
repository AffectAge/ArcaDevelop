import type express from "express";
import type { RouteAuth } from "../security/routeAuth";
import type { ContentEntryPayload, ContentEntryPayloadParseResult, ContentEntryRouteItem } from "./contentEntryRoutes";

export type CultureRoutesDependencies = {
  routeAuth: RouteAuth;
  upload: { single: (fieldName: string) => express.RequestHandler };
  createId: () => string;
  parseCulturePayload: (body: unknown) => ContentEntryPayloadParseResult;
  getCultures: () => ContentEntryRouteItem[];
  cultureNameExists: (name: string, excludeId?: string) => boolean;
  savePersistentState: () => void;
  validateImageDimensions: (file: Express.Multer.File, maxDimension: number) => boolean;
  removeUploadedFile: (file: Express.Multer.File | undefined) => void;
  removeUploadedByUrl: (url: string) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
};

export function registerCultureRoutes(app: express.Express, deps: CultureRoutesDependencies): void {
  app.get("/content/cultures", (_req, res) => {
    return res.json({ cultures: deps.getCultures() });
  });

  app.get("/admin/content/cultures", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    return res.json({ cultures: deps.getCultures() });
  });

  app.post("/admin/content/cultures", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const parsed = deps.parseCulturePayload(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.issues });
    }
    const normalizedName = parsed.data.name.trim();
    if (deps.cultureNameExists(normalizedName)) {
      return res.status(409).json({ error: "CULTURE_NAME_EXISTS" });
    }
    const culture = createCulture(deps.createId(), parsed.data);
    deps.getCultures().unshift(culture);
    deps.savePersistentState();
    return res.json({ culture, cultures: deps.getCultures() });
  });

  app.patch("/admin/content/cultures/:cultureId", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const parsed = deps.parseCulturePayload(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.issues });
    }
    const cultureId = String(req.params.cultureId);
    const cultures = deps.getCultures();
    const index = cultures.findIndex((culture) => culture.id === cultureId);
    if (index < 0) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const normalizedName = parsed.data.name.trim();
    if (deps.cultureNameExists(normalizedName, cultureId)) {
      return res.status(409).json({ error: "CULTURE_NAME_EXISTS" });
    }
    cultures[index] = {
      ...cultures[index],
      name: normalizedName,
      description: (parsed.data.description ?? "").trim(),
      color: parsed.data.color,
    };
    deps.savePersistentState();
    return res.json({ culture: cultures[index], cultures });
  });

  app.patch("/admin/content/cultures/:cultureId/logo", deps.upload.single("cultureLogo"), async (req, res) => {
    const auth = await deps.routeAuth.requireAdminOrCleanup(req, res, () =>
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined),
    );
    if (!auth) return;
    const cultureId = String(req.params.cultureId);
    const cultures = deps.getCultures();
    const index = cultures.findIndex((culture) => culture.id === cultureId);
    if (index < 0) {
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined);
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: "NO_FILE" });
    }
    if (!deps.validateImageDimensions(file, 1024)) {
      deps.removeUploadedFile(file);
      return res.status(400).json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", max: "1024x1024" });
    }
    const previousUrl = cultures[index].logoUrl ?? null;
    cultures[index] = {
      ...cultures[index],
      logoUrl: deps.makeVersionedUploadUrl(`cultures/${file.filename}`),
    };
    if (previousUrl) {
      deps.removeUploadedByUrl(previousUrl);
    }
    deps.savePersistentState();
    return res.json({ culture: cultures[index], cultures });
  });

  app.delete("/admin/content/cultures/:cultureId/logo", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const cultureId = String(req.params.cultureId);
    const cultures = deps.getCultures();
    const index = cultures.findIndex((culture) => culture.id === cultureId);
    if (index < 0) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const previousUrl = cultures[index].logoUrl ?? null;
    cultures[index] = { ...cultures[index], logoUrl: null };
    if (previousUrl) {
      deps.removeUploadedByUrl(previousUrl);
    }
    deps.savePersistentState();
    return res.json({ culture: cultures[index], cultures });
  });

  app.delete("/admin/content/cultures/:cultureId", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const cultureId = String(req.params.cultureId);
    const cultures = deps.getCultures();
    const index = cultures.findIndex((culture) => culture.id === cultureId);
    if (index < 0) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const [removed] = cultures.splice(index, 1);
    if (removed?.logoUrl) {
      deps.removeUploadedByUrl(removed.logoUrl);
    }
    if (removed?.malePortraitUrl) {
      deps.removeUploadedByUrl(removed.malePortraitUrl);
    }
    if (removed?.femalePortraitUrl) {
      deps.removeUploadedByUrl(removed.femalePortraitUrl);
    }
    deps.savePersistentState();
    return res.json({ ok: true, cultures });
  });
}

function createCulture(id: string, payload: ContentEntryPayload): ContentEntryRouteItem {
  return {
    id,
    name: payload.name.trim(),
    description: (payload.description ?? "").trim(),
    color: payload.color,
    logoUrl: null,
    malePortraitUrl: null,
    femalePortraitUrl: null,
  };
}
