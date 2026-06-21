import type express from "express";
import type { RouteAuth } from "../security/routeAuth";

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
  getUiBackgroundUrl: () => string | null;
  setUiBackgroundUrl: (url: string) => void;
  getMapSettings: () => unknown;
  savePersistentState: () => void;
  afterUiBackgroundUpdated: (actorCountryId: string) => void;
};

export function registerAdminAssetRoutes(app: express.Express, deps: AdminAssetRoutesDependencies): void {
  app.patch("/admin/civilopedia/image", deps.upload.single("civilopediaImage"), async (req, res) => {
    return handleCivilopediaImageUpload(req, res, deps);
  });

  app.patch("/admin/civilopedia/inline-image", deps.upload.single("civilopediaImage"), async (req, res) => {
    return handleCivilopediaImageUpload(req, res, deps);
  });

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
