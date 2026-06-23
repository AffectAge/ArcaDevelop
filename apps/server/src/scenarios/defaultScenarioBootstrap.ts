import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  DEFAULT_HEX_MAP_SETTINGS,
  generateHexMap,
  getNeighborAxial,
  makeHexId,
  axialToPixel,
  type HexMapArtifact,
  type HexMapSettings,
  type HexTile,
} from "@arcanorum/shared";
import type { HexMapIndexEntry } from "../map/hexIndex";
import { getScenarioRuntimePaths } from "./runtimePaths";

export const DEFAULT_SCENARIO_ID = "default";
const DEFAULT_COUNTRY_ID = "country:default";
const DEFAULT_REGION_AREA_KM2 = 1000;

export type DefaultScenarioBootstrapResult = {
  scenarioId: string;
  scenarioDir: string;
  mapRoot: string;
  hexIndexPath: string;
  hexMapArtifactPath: string;
  generatedRegionIndexPath: string;
  artifact: HexMapArtifact;
};

type EnsureDefaultScenarioParams = {
  dataRoot: string;
  forceGenerated?: boolean;
};

export function ensureDefaultScenario(params: EnsureDefaultScenarioParams): DefaultScenarioBootstrapResult {
  const scenarioDir = resolve(params.dataRoot, "scenarios", DEFAULT_SCENARIO_ID);
  const mapRoot = resolve(scenarioDir, "map");
  const generatedRoot = resolve(scenarioDir, ".generated");
  const settingsPath = resolve(mapRoot, "hex-settings.json");
  const artifactPath = resolve(generatedRoot, "hex-map-artifact.json");
  const hexIndexPath = resolve(generatedRoot, "hexes.json");
  const generatedRegionIndexPath = resolve(generatedRoot, "regions.json");

  if (params.forceGenerated) {
    resetGeneratedDefaultScenarioShell(scenarioDir);
  }

  mkdirSync(mapRoot, { recursive: true });
  mkdirSync(resolve(scenarioDir, "history", "countries"), { recursive: true });
  mkdirSync(resolve(scenarioDir, "history", "regions"), { recursive: true });
  mkdirSync(resolve(scenarioDir, "common"), { recursive: true });
  mkdirSync(resolve(scenarioDir, "localisation"), { recursive: true });
  mkdirSync(generatedRoot, { recursive: true });

  writeJsonIfMissing(resolve(scenarioDir, "scenario.json"), {
    id: DEFAULT_SCENARIO_ID,
    name: "Default",
    description: "Server-generated default Arcanorum scenario.",
    startTurn: 1,
    mapRoot: "map",
  });
  writeJsonIfMissing(settingsPath, DEFAULT_HEX_MAP_SETTINGS);
  writeJsonIfMissing(resolve(scenarioDir, "history", "countries", "default.json"), {
    id: DEFAULT_COUNTRY_ID,
    nameKey: "country:default.nameKey",
    color: "#1f6f8b",
    resources: {
      culture: 15,
      science: 12,
      religion: 12,
      colonization: 225,
      construction: 5,
      ducats: 12,
      gold: 150,
    },
    controlMode: "open",
  });
  writeJsonIfMissing(resolve(scenarioDir, "common", "defines.json"), {});
  writeJsonIfMissing(resolve(scenarioDir, "localisation", "en.json"), {
    "scenario.default.name": "Default",
    "country:default.nameKey": "Default Country",
  });
  writeJsonIfMissing(resolve(scenarioDir, "localisation", "ru.json"), {
    "scenario.default.name": "Базовый сценарий",
    "country:default.nameKey": "Базовая страна",
  });

  const settings = readHexMapSettings(settingsPath);
  const artifact = params.forceGenerated || !existsSync(artifactPath)
    ? generateHexMap(settings)
    : readJsonFile<HexMapArtifact>(artifactPath);
  const generatedRegions = buildGeneratedRegions(artifact);
  const hexIndex = buildHexMapIndex(artifact, generatedRegions.regionColorById);

  if (params.forceGenerated || !existsSync(artifactPath)) writeJsonFile(artifactPath, artifact);
  if (params.forceGenerated || !existsSync(hexIndexPath)) writeJsonFile(hexIndexPath, hexIndex);
  if (params.forceGenerated || !existsSync(generatedRegionIndexPath)) {
    writeJsonFile(generatedRegionIndexPath, generatedRegions.regions);
  }

  const runtimePaths = getScenarioRuntimePaths({
    scenarioDir,
    manifest: { mapRoot: "map" },
    dataRoot: params.dataRoot,
  });

  return {
    scenarioId: DEFAULT_SCENARIO_ID,
    scenarioDir,
    mapRoot: runtimePaths.mapRoot,
    hexIndexPath: runtimePaths.hexIndexPath,
    hexMapArtifactPath: artifactPath,
    generatedRegionIndexPath,
    artifact,
  };
}

function resetGeneratedDefaultScenarioShell(scenarioDir: string): void {
  for (const relativePath of ["common", "history", "localisation", "assets"]) {
    rmSync(resolve(scenarioDir, relativePath), { recursive: true, force: true });
  }
}

function buildGeneratedRegions(artifact: HexMapArtifact): {
  regions: Record<string, unknown>[];
  regionColorById: Map<string, string>;
} {
  const hexIdsByRegionId = new Map<string, string[]>();
  const firstTileByRegionId = new Map<string, HexTile>();
  for (const tile of artifact.tiles) {
    const hexIds = hexIdsByRegionId.get(tile.regionId) ?? [];
    hexIds.push(tile.id);
    hexIdsByRegionId.set(tile.regionId, hexIds);
    if (!firstTileByRegionId.has(tile.regionId)) firstTileByRegionId.set(tile.regionId, tile);
  }

  const firstLandRegionId = [...hexIdsByRegionId.keys()].find((regionId) => regionId.startsWith("region:land:")) ?? null;
  const regionColorById = new Map<string, string>();
  const regions = [...hexIdsByRegionId.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([regionId, hexIds]) => {
      const firstTile = firstTileByRegionId.get(regionId);
      const color = firstTile ? colorForRegion(firstTile) : "#64748b";
      regionColorById.set(regionId, color);
      const ownedByDefaultCountry = regionId === firstLandRegionId;
      return {
        id: regionId,
        nameKey: `region.generated.${sanitizeRegionId(regionId)}.name`,
        color,
        hexIds,
        ownerCountryId: ownedByDefaultCountry ? DEFAULT_COUNTRY_ID : null,
        controllerCountryId: ownedByDefaultCountry ? DEFAULT_COUNTRY_ID : null,
        coreCountryIds: ownedByDefaultCountry ? [DEFAULT_COUNTRY_ID] : [],
        claims: [],
        pops: [],
        buildings: [],
        construction: [],
        resources: [],
        infrastructure: {},
        modifiers: [],
        generated: true,
      };
    });

  return { regions, regionColorById };
}

function buildHexMapIndex(artifact: HexMapArtifact, regionColorById: Map<string, string>): HexMapIndexEntry[] {
  return artifact.tiles.map((tile) => {
    const center = axialToPixel(tile, artifact.settings.hexSize);
    return {
      id: tile.id,
      name: `Hex ${tile.q}:${tile.r}`,
      regionId: tile.regionId,
      hexColor: colorForTerrain(tile),
      regionColor: regionColorById.get(tile.regionId) ?? "#64748b",
      areaKm2: DEFAULT_REGION_AREA_KM2,
      hexType: tile.terrain,
      centerX: Math.round(center.x * 100) / 100,
      centerY: Math.round(center.y * 100) / 100,
      sourceCenterX: Math.round(center.x * 100) / 100,
      sourceCenterY: Math.round(center.y * 100) / 100,
      neighbors: buildNeighborIds(tile, artifact.settings),
      climate: tile.biome,
      pollution: 0,
      radiation: 0,
      landscape: tile.feature === "none" ? tile.terrain : tile.feature,
      continent: tile.waterKind ? "continent:water" : "continent:land",
      strategicRegion: tile.regionId,
      fertileLandKm2: tile.waterKind ? 0 : Math.round(DEFAULT_REGION_AREA_KM2 * fertilityForTile(tile)),
      fertility: tile.waterKind ? 0 : fertilityForTile(tile),
    };
  });
}

function buildNeighborIds(tile: HexTile, settings: HexMapSettings): string[] {
  const ids: string[] = [];
  for (let direction = 0; direction < 6; direction += 1) {
    const neighbor = getNeighborAxial(tile, direction as 0 | 1 | 2 | 3 | 4 | 5, settings);
    if (neighbor) ids.push(makeHexId(neighbor.q, neighbor.r));
  }
  return ids;
}

function readHexMapSettings(path: string): HexMapSettings {
  return { ...DEFAULT_HEX_MAP_SETTINGS, ...readJsonFile<Partial<HexMapSettings>>(path) };
}

function fertilityForTile(tile: HexTile): number {
  if (tile.waterKind) return 0;
  if (tile.terrain === "grassland" || tile.terrain === "plains") return 0.75;
  if (tile.terrain === "wetland" || tile.feature === "forest" || tile.feature === "dense_forest") return 0.55;
  if (tile.terrain === "hills") return 0.35;
  if (tile.terrain === "desert" || tile.terrain === "tundra") return 0.2;
  if (tile.terrain === "mountains" || tile.terrain === "snow") return 0.08;
  return 0.4;
}

function colorForRegion(tile: HexTile): string {
  if (tile.waterKind) return "#2f7f98";
  if (tile.biome === "arid") return "#b8a45f";
  if (tile.biome === "tropical") return "#3d8b52";
  if (tile.biome === "cold" || tile.biome === "alpine") return "#8a9aa3";
  return "#5f8f52";
}

function colorForTerrain(tile: HexTile): string {
  const colors: Record<string, string> = {
    ocean: "#0d4f66",
    sea: "#1d7f91",
    lake: "#3c94a6",
    coast: "#d3bd78",
    plains: "#b6a864",
    grassland: "#3f9b4f",
    forest: "#2f6f3d",
    hills: "#8d845e",
    mountains: "#77736d",
    desert: "#c8ad6a",
    tundra: "#9aa66f",
    snow: "#d5d9d3",
    wetland: "#5f8e68",
  };
  return colors[tile.terrain] ?? "#64748b";
}

function sanitizeRegionId(regionId: string): string {
  return regionId.replace(/[^a-zA-Z0-9_]+/g, "_");
}

function writeJsonIfMissing(path: string, value: unknown): void {
  if (existsSync(path)) return;
  writeJsonFile(path, value);
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
