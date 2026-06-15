import { existsSync, readFileSync } from "node:fs";

export type Adm1ProvinceIndexEntry = {
  id: string;
  name: string;
  regionId: string | null;
  provinceColor: string;
  regionColor: string;
  areaKm2: number;
  provinceType: string | null;
  centerX: number | null;
  centerY: number | null;
  sourceCenterX: number | null;
  sourceCenterY: number | null;
  neighbors: string[];
  climate: string | null;
  pollution: number | null;
  radiation: number | null;
  landscape: string | null;
  continent: string | null;
  strategicRegion: string | null;
  fertileLandKm2: number | null;
  fertility: number | null;
};

export function loadProvinceIndexFromFile(path: string): Adm1ProvinceIndexEntry[] {
  if (!existsSync(path)) {
    throw new Error(`[map] Provinces index not found: ${path}. Expected generated provinces.json.`);
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as Array<Record<string, unknown>>;
  return raw
    .map((province): Adm1ProvinceIndexEntry | null => {
      const id = String(province.id ?? "").trim();
      if (!id) return null;
      const areaKm2 = Number(province.areaKm2 ?? province.area_km2 ?? 0);
      const centerX = province.centerX ?? province.center_x;
      const centerY = province.centerY ?? province.center_y;
      const sourceCenterX = province.sourceCenterX ?? province.source_center_x;
      const sourceCenterY = province.sourceCenterY ?? province.source_center_y;
      const rawNeighbors = province.neighbors;
      const provinceType = getProvinceField(province, ["provinceType", "province_type", "Тип провинции"]);
      const provinceColor = getRequiredHexColor(province, ["provinceColor", "province_color", "color"], "#9ca3af");
      const regionColor = getRequiredHexColor(province, ["regionColor", "region_color"], "#22d3ee");
      return {
        id,
        name: String(province.name ?? id),
        regionId: getProvinceField(province, ["regionId", "region_id"]) == null ? null : String(getProvinceField(province, ["regionId", "region_id"])),
        provinceColor,
        regionColor,
        areaKm2: Math.max(0, Number.isFinite(areaKm2) ? Math.round(areaKm2) : 0),
        provinceType: provinceType == null ? null : String(provinceType),
        centerX: Number.isFinite(Number(centerX)) ? Number(centerX) : null,
        centerY: Number.isFinite(Number(centerY)) ? Number(centerY) : null,
        sourceCenterX: Number.isFinite(Number(sourceCenterX)) ? Number(sourceCenterX) : null,
        sourceCenterY: Number.isFinite(Number(sourceCenterY)) ? Number(sourceCenterY) : null,
        neighbors: Array.isArray(rawNeighbors)
          ? rawNeighbors.map((neighbor) => String(neighbor).trim()).filter(Boolean)
          : String(rawNeighbors ?? "")
              .split(/[,\s;]+/)
              .map((neighbor) => neighbor.trim())
              .filter(Boolean),
        climate: getProvinceField(province, ["climate", "Климат"]) == null ? null : String(getProvinceField(province, ["climate", "Климат"])),
        pollution: readOptionalNumber(getProvinceField(province, ["pollution", "Загрязнение"])),
        radiation: readOptionalNumber(getProvinceField(province, ["radiation", "Радиация"])),
        landscape: getProvinceField(province, ["landscape", "Ландшафт"]) == null ? null : String(getProvinceField(province, ["landscape", "Ландшафт"])),
        continent: getProvinceField(province, ["continent", "Континент"]) == null ? null : String(getProvinceField(province, ["continent", "Континент"])),
        strategicRegion: getProvinceField(province, ["strategicRegion", "strategic_region", "Стратегический регион"]) == null ? null : String(getProvinceField(province, ["strategicRegion", "strategic_region", "Стратегический регион"])),
        fertileLandKm2: readOptionalNumber(getProvinceField(province, ["fertileLandKm2", "fertile_land_km2", "Плодородные земли"])),
        fertility: readOptionalNumber(getProvinceField(province, ["fertility", "Плодородность"])),
      };
    })
    .filter((province): province is Adm1ProvinceIndexEntry => Boolean(province))
    .sort((a, b) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id));
}

function getProvinceField(province: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = province[key];
    if (value != null && String(value).trim().length > 0) return value;
  }
  return null;
}

function readOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getRequiredHexColor(province: Record<string, unknown>, keys: string[], fallback: string): string {
  const value = getProvinceField(province, keys);
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}
