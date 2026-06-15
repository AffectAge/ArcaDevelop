import type express from "express";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import type { RouteAuth } from "../security/routeAuth";

export type ProvinceReadWorldState = {
  provinceOwner: Record<string, string>;
};

export type ProvinceReadRoutesDependencies = {
  routeAuth: RouteAuth;
  getProvinceIndex: () => Adm1ProvinceIndexEntry[];
  getWorldBase: () => ProvinceReadWorldState;
};

export function registerProvinceReadRoutes(
  app: express.Express,
  deps: ProvinceReadRoutesDependencies,
): void {
  app.get("/admin/provinces", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;

    const provinceIndex = deps.getProvinceIndex();
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
      ? provinceIndex.filter(
          (province) =>
            province.name.toLowerCase().includes(searchQuery) ||
            province.id.toLowerCase().includes(searchQuery),
        )
      : provinceIndex;
    const total = source.length;
    const selected = limit == null ? source : source.slice(offset, offset + limit);

    const provinces = selected.map((province) => {
      const provinceId = province.id;
      return {
        id: provinceId,
        name: province.name,
        regionId: province.regionId,
        provinceColor: province.provinceColor,
        regionColor: province.regionColor,
        areaKm2: province.areaKm2,
        provinceType: province.provinceType,
        climate: province.climate,
        landscape: province.landscape,
        ownerCountryId: worldBase.provinceOwner[provinceId] ?? null,
      };
    });

    return res.json({
      provinces,
      total,
      offset,
      limit,
    });
  });

  app.get("/provinces/index", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      provinces: deps.getProvinceIndex().map((province) => ({
        id: province.id,
        name: province.name,
        regionId: province.regionId,
        provinceColor: province.provinceColor,
        regionColor: province.regionColor,
        areaKm2: province.areaKm2,
        provinceType: province.provinceType,
        centerX: province.centerX,
        centerY: province.centerY,
        sourceCenterX: province.sourceCenterX,
        sourceCenterY: province.sourceCenterY,
        neighbors: province.neighbors,
        climate: province.climate,
        pollution: province.pollution,
        radiation: province.radiation,
        landscape: province.landscape,
        continent: province.continent,
        strategicRegion: province.strategicRegion,
        fertileLandKm2: province.fertileLandKm2,
        fertility: province.fertility,
      })),
    });
  });
}
