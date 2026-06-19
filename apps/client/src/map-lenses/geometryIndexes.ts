export type ProvinceMapGeometryMeta = {
  regionId: string | null;
  centerX: number | null;
  centerY: number | null;
  sourceCenterX: number | null;
  sourceCenterY: number | null;
  areaKm2: number;
  neighbors: string[];
};

export type MapGeometryIndexes = {
  provinceIds: string[];
  provinceIdToRegionId: Map<string, string>;
  regionIdToProvinceIds: Map<string, string[]>;
  regionIdToAreaKm2: Map<string, number>;
  provinceIdToNeighborIds: Map<string, string[]>;
  provinceIdToBounds: Map<string, [number, number, number, number]>;
  regionIdToBounds: Map<string, [number, number, number, number]>;
};

export function buildMapGeometryIndexes(provinceMetaById: ReadonlyMap<string, ProvinceMapGeometryMeta>): MapGeometryIndexes {
  const provinceIds: string[] = [];
  const provinceIdToRegionId = new Map<string, string>();
  const regionIdToProvinceIds = new Map<string, string[]>();
  const regionIdToAreaKm2 = new Map<string, number>();
  const provinceIdToNeighborIds = new Map<string, string[]>();
  const provinceIdToBounds = new Map<string, [number, number, number, number]>();
  const regionIdToBounds = new Map<string, [number, number, number, number]>();

  for (const [provinceId, meta] of provinceMetaById.entries()) {
    provinceIds.push(provinceId);
    provinceIdToNeighborIds.set(provinceId, meta.neighbors);
    const regionId = meta.regionId;
    if (regionId) {
      provinceIdToRegionId.set(provinceId, regionId);
      const ids = regionIdToProvinceIds.get(regionId) ?? [];
      ids.push(provinceId);
      regionIdToProvinceIds.set(regionId, ids);
      regionIdToAreaKm2.set(regionId, (regionIdToAreaKm2.get(regionId) ?? 0) + Math.max(0, Number(meta.areaKm2) || 0));
    }
    const lng = meta.centerX ?? meta.sourceCenterX;
    const lat = meta.centerY ?? meta.sourceCenterY;
    if (lng != null && lat != null && Number.isFinite(lng) && Number.isFinite(lat)) {
      const radius = Math.max(0.05, Math.sqrt(Math.max(1, Number(meta.areaKm2) || 1)) / 400);
      const bounds: [number, number, number, number] = [lng - radius, lat - radius, lng + radius, lat + radius];
      provinceIdToBounds.set(provinceId, bounds);
      if (regionId) {
        regionIdToBounds.set(regionId, mergeBounds(regionIdToBounds.get(regionId), bounds));
      }
    }
  }

  provinceIds.sort((a, b) => a.localeCompare(b));
  for (const ids of regionIdToProvinceIds.values()) ids.sort((a, b) => a.localeCompare(b));

  return { provinceIds, provinceIdToRegionId, regionIdToProvinceIds, regionIdToAreaKm2, provinceIdToNeighborIds, provinceIdToBounds, regionIdToBounds };
}

function mergeBounds(current: [number, number, number, number] | undefined, next: [number, number, number, number]): [number, number, number, number] {
  if (!current) return next;
  return [Math.min(current[0], next[0]), Math.min(current[1], next[1]), Math.max(current[2], next[2]), Math.max(current[3], next[3])];
}
