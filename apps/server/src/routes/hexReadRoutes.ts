import type express from "express";
import type { HexMapArtifact, MapFeatureInstance, MapFeatureVisualRuleDefinition } from "@arcanorum/shared";
import type { HexMapIndexEntry } from "../map/hexIndex";
import type { RouteAuth } from "../security/routeAuth";

export type HexReadWorldState = {
  hexOwner: Record<string, string>;
};

export type HexReadRoutesDependencies = {
  routeAuth: RouteAuth;
  getHexIndex: () => HexMapIndexEntry[];
  getHexMapArtifact: () => HexMapArtifact | null;
  getMapFeatures: () => MapFeatureInstance[];
  getMapFeatureVisuals: () => MapFeatureVisualRuleDefinition[];
  getWorldBase: () => HexReadWorldState;
};

export function registerHexReadRoutes(
  app: express.Express,
  deps: HexReadRoutesDependencies,
): void {
  app.get("/admin/hexes", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;

    const hexIndex = deps.getHexIndex();
    const worldBase = deps.getWorldBase();
    const searchQuery = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const requestedLimit =
      typeof req.query.limit === "string" && Number.isFinite(Number(req.query.limit))
        ? Math.floor(Number(req.query.limit))
        : null;
    const requestedOffset =
      typeof req.query.offset === "string" && Number.isFinite(Number(req.query.offset))
        ? Math.floor(Number(req.query.offset))
        : 0;
    const limit = requestedLimit == null ? null : Math.max(1, Math.min(5000, requestedLimit));
    const offset = Math.max(0, requestedOffset);
    const source = searchQuery
      ? hexIndex.filter(
          (province) =>
            province.name.toLowerCase().includes(searchQuery) ||
            province.id.toLowerCase().includes(searchQuery),
        )
      : hexIndex;
    const total = source.length;
    const selected = limit == null ? source : source.slice(offset, offset + limit);

    const hexes = selected.map((province) => {
      const provinceId = province.id;
      return {
        id: provinceId,
        name: province.name,
        regionId: province.regionId,
        hexColor: province.hexColor,
        regionColor: province.regionColor,
        areaKm2: province.areaKm2,
        hexType: province.hexType,
        climate: province.climate,
        landscape: province.landscape,
        ownerCountryId: worldBase.hexOwner[provinceId] ?? null,
      };
    });

    return res.json({
      hexes,
      total,
      offset,
      limit,
    });
  });

  app.get("/hex-map/artifact", (_req, res) => {
    const artifact = deps.getHexMapArtifact();
    if (!artifact) {
      res.status(503);
      return res.json({ error: "HEX_MAP_ARTIFACT_UNAVAILABLE" });
    }
    res.setHeader("Cache-Control", "no-store");
    return res.json(artifact);
  });

  app.get("/hex-map/features", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ features: deps.getMapFeatures() });
  });

  app.get("/hex-map/feature-visuals", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ visuals: deps.getMapFeatureVisuals() });
  });
}
