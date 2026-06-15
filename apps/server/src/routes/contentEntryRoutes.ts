import type express from "express";
import type { RouteAuth } from "../security/routeAuth";

export type ContentEntryRouteItem = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  logoUrl?: string | null;
  malePortraitUrl?: string | null;
  femalePortraitUrl?: string | null;
  [key: string]: unknown;
};

export type ContentEntryPayload = {
  name: string;
  description?: string | null;
  color: string;
  [key: string]: unknown;
};

export type ContentEntryPayloadParseResult =
  | { success: true; data: ContentEntryPayload }
  | { success: false; issues: unknown };

export type ContentKindParseResult = { success: true; data: string } | { success: false };

export type ContentLogoValidationResult = { ok: true } | { ok: false; error: "IMAGE_DIMENSIONS_TOO_LARGE"; max: string } | { ok: false; error: "IMAGE_INVALID" };

export type ContentEntryRoutesDependencies = {
  routeAuth: RouteAuth;
  upload: { single: (fieldName: string) => express.RequestHandler };
  createId: () => string;
  parseContentKind: (raw: string) => ContentKindParseResult;
  parseContentPayload: (body: unknown) => ContentEntryPayloadParseResult;
  parseRacePortraitSlot: (raw: string) => { success: true; data: "male" | "female" } | { success: false };
  getEntriesByKind: (kind: string) => ContentEntryRouteItem[];
  getRaceEntries: () => ContentEntryRouteItem[];
  contentNameExists: (kind: string, name: string, excludeId?: string) => boolean;
  sanitizeContentEntryByKind: (kind: string, payload: ContentEntryPayload) => Record<string, unknown>;
  isMilitaryContentKind: (kind: string) => boolean;
  cloneMilitaryContentSnapshot: () => unknown;
  refreshDivisionStatsFromTemplates: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: unknown) => void;
  savePersistentState: () => void;
  removeUploadedFile: (file: Express.Multer.File | undefined) => void;
  removeUploadedByUrl: (url: string) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
  resolveContentUploadUrlSegment: (kind: string) => string;
  validateContentLogo: (file: Express.Multer.File, kind: string) => ContentLogoValidationResult;
  validateRacePortrait: (file: Express.Multer.File) => boolean;
};

export function registerContentEntryRoutes(app: express.Express, deps: ContentEntryRoutesDependencies): void {
  app.get("/content/entries/:kind", (req, res) => {
    const kind = parseKindParam(req, res, deps);
    if (!kind) return;
    return res.json({ items: deps.getEntriesByKind(kind) });
  });

  app.get("/admin/content/entries/:kind", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const kind = parseKindParam(req, res, deps);
    if (!kind) return;
    return res.json({ items: deps.getEntriesByKind(kind) });
  });

  app.post("/admin/content/entries/:kind", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const kind = parseKindParam(req, res, deps);
    if (!kind) return;
    const parsed = deps.parseContentPayload(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.issues });
    }
    const normalizedName = parsed.data.name.trim();
    if (deps.contentNameExists(kind, normalizedName)) {
      return res.status(409).json({ error: "CONTENT_NAME_EXISTS" });
    }
    const item: ContentEntryRouteItem = {
      id: deps.createId(),
      name: normalizedName,
      description: (parsed.data.description ?? "").trim(),
      color: parsed.data.color,
      logoUrl: null,
      malePortraitUrl: null,
      femalePortraitUrl: null,
      ...deps.sanitizeContentEntryByKind(kind, parsed.data),
    };
    deps.getEntriesByKind(kind).unshift(item);
    deps.savePersistentState();
    return res.json({ item, items: deps.getEntriesByKind(kind) });
  });

  app.patch("/admin/content/entries/:kind/:entryId", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const kind = parseKindParam(req, res, deps);
    if (!kind) return;
    const parsed = deps.parseContentPayload(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.issues });
    }
    const entryId = String(req.params.entryId);
    const items = deps.getEntriesByKind(kind);
    const index = items.findIndex((entry) => entry.id === entryId);
    if (index < 0) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const previousWorldBase = deps.isMilitaryContentKind(kind) ? deps.cloneMilitaryContentSnapshot() : null;
    const normalizedName = parsed.data.name.trim();
    if (deps.contentNameExists(kind, normalizedName, entryId)) {
      return res.status(409).json({ error: "CONTENT_NAME_EXISTS" });
    }
    items[index] = {
      ...items[index],
      name: normalizedName,
      description: (parsed.data.description ?? "").trim(),
      color: parsed.data.color,
      ...deps.sanitizeContentEntryByKind(kind, parsed.data),
    };
    if (previousWorldBase) {
      deps.refreshDivisionStatsFromTemplates();
    }
    deps.savePersistentState();
    if (previousWorldBase) {
      deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    }
    return res.json({ item: items[index], items });
  });

  app.patch("/admin/content/entries/:kind/:entryId/logo", deps.upload.single("cultureLogo"), async (req, res) => {
    const auth = await deps.routeAuth.requireAdminOrCleanup(req, res, () =>
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined),
    );
    if (!auth) return;
    const kind = parseKindParam(req, res, deps, true);
    if (!kind) return;
    const entryId = String(req.params.entryId);
    const items = deps.getEntriesByKind(kind);
    const index = items.findIndex((entry) => entry.id === entryId);
    if (index < 0) {
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined);
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: "NO_FILE" });
    }
    const validation = deps.validateContentLogo(file, kind);
    if (!validation.ok) {
      deps.removeUploadedFile(file);
      return res.status(400).json({ error: validation.error, ...(validation.error === "IMAGE_DIMENSIONS_TOO_LARGE" ? { max: validation.max } : {}) });
    }
    const previousUrl = items[index].logoUrl ?? null;
    items[index] = {
      ...items[index],
      logoUrl: deps.makeVersionedUploadUrl(`${deps.resolveContentUploadUrlSegment(kind)}/${file.filename}`),
    };
    if (previousUrl) {
      deps.removeUploadedByUrl(previousUrl);
    }
    deps.savePersistentState();
    return res.json({ item: items[index], items });
  });

  app.delete("/admin/content/entries/:kind/:entryId/logo", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const kind = parseKindParam(req, res, deps);
    if (!kind) return;
    const entryId = String(req.params.entryId);
    const items = deps.getEntriesByKind(kind);
    const index = items.findIndex((entry) => entry.id === entryId);
    if (index < 0) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const previousUrl = items[index].logoUrl ?? null;
    items[index] = { ...items[index], logoUrl: null };
    if (previousUrl) {
      deps.removeUploadedByUrl(previousUrl);
    }
    deps.savePersistentState();
    return res.json({ item: items[index], items });
  });

  app.patch("/admin/content/entries/races/:entryId/portraits/:slot", deps.upload.single("racePortrait"), async (req, res) => {
    const auth = await deps.routeAuth.requireAdminOrCleanup(req, res, () =>
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined),
    );
    if (!auth) return;
    const slot = parseRacePortraitSlot(req, res, deps, true);
    if (!slot) return;
    const entryId = String(req.params.entryId);
    const items = deps.getRaceEntries();
    const index = items.findIndex((entry) => entry.id === entryId);
    if (index < 0) {
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined);
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: "NO_FILE" });
    }
    if (!deps.validateRacePortrait(file)) {
      deps.removeUploadedFile(file);
      return res.status(400).json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", max: "64x64" });
    }
    const key = slot === "male" ? "malePortraitUrl" : "femalePortraitUrl";
    const previousUrl = items[index][key] as string | null | undefined;
    items[index] = {
      ...items[index],
      [key]: deps.makeVersionedUploadUrl(`races/${file.filename}`),
    };
    if (previousUrl) {
      deps.removeUploadedByUrl(previousUrl);
    }
    deps.savePersistentState();
    return res.json({ item: items[index], items });
  });

  app.delete("/admin/content/entries/races/:entryId/portraits/:slot", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const slot = parseRacePortraitSlot(req, res, deps);
    if (!slot) return;
    const entryId = String(req.params.entryId);
    const items = deps.getRaceEntries();
    const index = items.findIndex((entry) => entry.id === entryId);
    if (index < 0) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const key = slot === "male" ? "malePortraitUrl" : "femalePortraitUrl";
    const previousUrl = items[index][key] as string | null | undefined;
    items[index] = {
      ...items[index],
      [key]: null,
    };
    if (previousUrl) {
      deps.removeUploadedByUrl(previousUrl);
    }
    deps.savePersistentState();
    return res.json({ item: items[index], items });
  });

  app.delete("/admin/content/entries/:kind/:entryId", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const kind = parseKindParam(req, res, deps);
    if (!kind) return;
    const entryId = String(req.params.entryId);
    const items = deps.getEntriesByKind(kind);
    const index = items.findIndex((entry) => entry.id === entryId);
    if (index < 0) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const previousWorldBase = deps.isMilitaryContentKind(kind) ? deps.cloneMilitaryContentSnapshot() : null;
    const [removed] = items.splice(index, 1);
    if (removed?.logoUrl) {
      deps.removeUploadedByUrl(removed.logoUrl);
    }
    if (removed?.malePortraitUrl) {
      deps.removeUploadedByUrl(removed.malePortraitUrl);
    }
    if (removed?.femalePortraitUrl) {
      deps.removeUploadedByUrl(removed.femalePortraitUrl);
    }
    if (previousWorldBase) {
      deps.refreshDivisionStatsFromTemplates();
    }
    deps.savePersistentState();
    if (previousWorldBase) {
      deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    }
    return res.json({ ok: true, items });
  });
}

function parseKindParam(
  req: express.Request,
  res: express.Response,
  deps: ContentEntryRoutesDependencies,
  cleanupUpload = false,
): string | null {
  const parsed = deps.parseContentKind(String(req.params.kind));
  if (!parsed.success) {
    if (cleanupUpload) {
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined);
    }
    res.status(400).json({ error: "INVALID_CONTENT_KIND" });
    return null;
  }
  return parsed.data;
}

function parseRacePortraitSlot(
  req: express.Request,
  res: express.Response,
  deps: ContentEntryRoutesDependencies,
  cleanupUpload = false,
): "male" | "female" | null {
  const parsed = deps.parseRacePortraitSlot(String(req.params.slot));
  if (!parsed.success) {
    if (cleanupUpload) {
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined);
    }
    res.status(400).json({ error: "INVALID_RACE_PORTRAIT_SLOT" });
    return null;
  }
  return parsed.data;
}
