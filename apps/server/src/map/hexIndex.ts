import { existsSync, readFileSync } from "node:fs";

export type HexMapIndexEntry = {
  id: string;
  name: string;
  regionId: string | null;
  hexColor: string;
  regionColor: string;
  areaKm2: number;
  hexType: string | null;
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

export function loadHexIndexFromFile(path: string): HexMapIndexEntry[] {
  if (!existsSync(path)) {
    throw new Error(`[map] Hex index not found: ${path}. Expected generated hexes.json.`);
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as Array<Record<string, unknown>>;
  return raw
    .map((hex): HexMapIndexEntry | null => {
      const id = String(hex.id ?? "").trim();
      if (!id) return null;
      const areaKm2 = Number(hex.areaKm2 ?? hex.area_km2 ?? 0);
      const centerX = hex.centerX ?? hex.center_x;
      const centerY = hex.centerY ?? hex.center_y;
      const sourceCenterX = hex.sourceCenterX ?? hex.source_center_x;
      const sourceCenterY = hex.sourceCenterY ?? hex.source_center_y;
      const rawNeighbors = hex.neighbors;
      const hexType = getHexField(hex, ["hexType", "hex_type", "type"]);
      const hexColor = getRequiredHexColor(hex, ["hexColor", "hex_color", "color"], "#9ca3af");
      const regionColor = getRequiredHexColor(hex, ["regionColor", "region_color"], "#22d3ee");
      return {
        id,
        name: String(hex.name ?? id),
        regionId: getHexField(hex, ["regionId", "region_id"]) == null ? null : String(getHexField(hex, ["regionId", "region_id"])),
        hexColor,
        regionColor,
        areaKm2: Math.max(0, Number.isFinite(areaKm2) ? Math.round(areaKm2) : 0),
        hexType: hexType == null ? null : String(hexType),
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
        climate: getHexField(hex, ["climate"]) == null ? null : String(getHexField(hex, ["climate"])),
        pollution: readOptionalNumber(getHexField(hex, ["pollution"])),
        radiation: readOptionalNumber(getHexField(hex, ["radiation"])),
        landscape: getHexField(hex, ["landscape"]) == null ? null : String(getHexField(hex, ["landscape"])),
        continent: getHexField(hex, ["continent"]) == null ? null : String(getHexField(hex, ["continent"])),
        strategicRegion: getHexField(hex, ["strategicRegion", "strategic_region"]) == null ? null : String(getHexField(hex, ["strategicRegion", "strategic_region"])),
        fertileLandKm2: readOptionalNumber(getHexField(hex, ["fertileLandKm2", "fertile_land_km2"])),
        fertility: readOptionalNumber(getHexField(hex, ["fertility"])),
      };
    })
    .filter((hex): hex is HexMapIndexEntry => Boolean(hex))
    .sort((a, b) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id));
}

function getHexField(hex: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = hex[key];
    if (value != null && String(value).trim().length > 0) return value;
  }
  return null;
}

function readOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getRequiredHexColor(hex: Record<string, unknown>, keys: string[], fallback: string): string {
  const value = getHexField(hex, keys);
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}
