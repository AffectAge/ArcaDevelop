import type express from "express";
import type { RouteAuth } from "../security/routeAuth";

export type ResourceIconKey =
  | "population"
  | "culture"
  | "science"
  | "religion"
  | "colonization"
  | "construction"
  | "ducats"
  | "gold";

export type ResourceIconMap = Record<ResourceIconKey, string | null>;

export type AdminAssetUploadMiddleware = {
  single: (fieldName: string) => express.RequestHandler;
  fields: (fields: Array<{ name: string; maxCount?: number }>) => express.RequestHandler;
};

export type AdminAssetRoutesDependencies = {
  routeAuth: RouteAuth;
  upload: AdminAssetUploadMiddleware;
  validateImageDimensions: (file: Express.Multer.File, maxDimension: number) => boolean;
  removeUploadedFile: (file: Express.Multer.File | undefined) => void;
  removeUploadedFiles: (files: Express.Multer.File[]) => void;
  removeUploadedByUrl: (url: string) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
  getResourceIcons: () => ResourceIconMap;
  setResourceIcon: (key: ResourceIconKey, url: string) => void;
  getUiBackgroundUrl: () => string | null;
  setUiBackgroundUrl: (url: string) => void;
  getMapSettings: () => unknown;
  savePersistentState: () => void;
  afterResourceIconsUpdated: (actorCountryId: string) => void;
  afterUiBackgroundUpdated: (actorCountryId: string) => void;
};

const resourceIconKeys = [
  "population",
  "culture",
  "science",
  "religion",
  "colonization",
  "construction",
  "ducats",
  "gold",
] as const satisfies readonly ResourceIconKey[];

export function registerAdminAssetRoutes(app: express.Express, deps: AdminAssetRoutesDependencies): void {
  app.patch("/admin/civilopedia/image", deps.upload.single("civilopediaImage"), async (req, res) => {
    return handleCivilopediaImageUpload(req, res, deps);
  });

  app.patch("/admin/civilopedia/inline-image", deps.upload.single("civilopediaImage"), async (req, res) => {
    return handleCivilopediaImageUpload(req, res, deps);
  });

  app.patch(
    "/admin/resource-icons",
    deps.upload.fields(resourceIconKeys.map((name) => ({ name, maxCount: 1 }))),
    async (req, res) => {
      const files = req.files as Record<string, Express.Multer.File[] | undefined> | undefined;
      const nextFiles = Object.fromEntries(
        resourceIconKeys.map((key) => [key, files?.[key]?.[0]]),
      ) as Partial<Record<ResourceIconKey, Express.Multer.File>>;
      const uploaded = Object.values(nextFiles).filter(Boolean) as Express.Multer.File[];
      const auth = await deps.routeAuth.requireAdminOrCleanup(req, res, () => deps.removeUploadedFiles(uploaded));
      if (!auth) return;

      if (uploaded.length === 0) {
        return res.status(400).json({ error: "NO_FILES" });
      }

      for (const [key, file] of Object.entries(nextFiles) as Array<[ResourceIconKey, Express.Multer.File | undefined]>) {
        if (!file) continue;
        if (!deps.validateImageDimensions(file, 64)) {
          deps.removeUploadedFiles(uploaded);
          return res.status(400).json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", field: key, max: "64x64" });
        }
      }

      const resourceIcons = deps.getResourceIcons();
      for (const [key, file] of Object.entries(nextFiles) as Array<[ResourceIconKey, Express.Multer.File | undefined]>) {
        if (!file) continue;
        const previousUrl = resourceIcons[key];
        deps.setResourceIcon(key, deps.makeVersionedUploadUrl(`resource-icons/${file.filename}`));
        if (previousUrl) {
          deps.removeUploadedByUrl(previousUrl);
        }
      }

      deps.savePersistentState();
      deps.afterResourceIconsUpdated(auth.countryId);
      return res.json({ resourceIcons: deps.getResourceIcons() });
    },
  );

  app.patch("/admin/ui-background", deps.upload.single("uiBackground"), async (req, res) => {
    const auth = await deps.routeAuth.requireAdminOrCleanup(req, res, () =>
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined),
    );
    if (!auth) return;

    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: "NO_FILE" });
    }

    if (!deps.validateImageDimensions(file, 4096)) {
      deps.removeUploadedFile(file);
      return res.status(400).json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", max: "4096x4096" });
    }

    const previousUrl = deps.getUiBackgroundUrl();
    deps.setUiBackgroundUrl(deps.makeVersionedUploadUrl(`ui-backgrounds/${file.filename}`));
    if (previousUrl) {
      deps.removeUploadedByUrl(previousUrl);
    }

    deps.savePersistentState();
    deps.afterUiBackgroundUpdated(auth.countryId);
    return res.json({ map: deps.getMapSettings() });
  });
}

async function handleCivilopediaImageUpload(
  req: express.Request,
  res: express.Response,
  deps: AdminAssetRoutesDependencies,
): Promise<express.Response | void> {
  if (
    !(await deps.routeAuth.requireAdminOrCleanup(req, res, () =>
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined),
    ))
  ) {
    return;
  }
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({ error: "NO_FILE" });
  }
  if (!deps.validateImageDimensions(file, 64)) {
    deps.removeUploadedFile(file);
    return res.status(400).json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", max: "64x64" });
  }
  return res.json({ imageUrl: deps.makeVersionedUploadUrl(`civilopedia/${file.filename}`) });
}
