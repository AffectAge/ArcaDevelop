import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type express from "express";

export type SystemRoutesDependencies = {
  getServerStatus: () => string;
  getTurnId: () => number;
  getAdm1TileRoot: () => string;
  getRasterTileRoot: () => string;
};

export function registerSystemRoutes(app: express.Express, deps: SystemRoutesDependencies): void {
  app.get("/health", (_req, res) => {
    res.json({ status: deps.getServerStatus(), turnId: deps.getTurnId(), serverTime: new Date().toISOString() });
  });

  app.get("/tiles/adm1/:z/:x/:y.mvt", (req, res) => {
    const tilePath = resolveTilePath(deps.getAdm1TileRoot(), req.params.z, req.params.x, `${req.params.y}.mvt`);
    if (!tilePath) {
      return res.status(204).end();
    }

    res.setHeader("Content-Type", "application/x-protobuf");
    res.setHeader("Cache-Control", "no-store");
    return res.send(readFileSync(tilePath));
  });

  app.get("/tiles/raster/:z/:x/:y.webp", (req, res) => {
    const tilePath = resolveTilePath(deps.getRasterTileRoot(), req.params.z, req.params.x, `${req.params.y}.webp`);
    if (!tilePath) {
      return res.status(204).end();
    }

    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "no-store");
    return res.send(readFileSync(tilePath));
  });
}

function resolveTilePath(root: string, z: string | undefined, x: string | undefined, fileName: string): string | null {
  if (!z || !x || !/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+\.((mvt)|(webp))$/.test(fileName)) {
    return null;
  }
  const tilePath = resolve(root, z, x, fileName);
  if (!existsSync(tilePath)) {
    return null;
  }
  return tilePath;
}
