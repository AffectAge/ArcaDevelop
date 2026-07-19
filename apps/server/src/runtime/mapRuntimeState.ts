import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { enrichHexMapVisualMetadata, type HexMapArtifact, type HexTile } from "@arcanorum/shared";
import type { MapFeatureVisualRuleDefinition, NaturalFeatureVisualCatalog } from "@arcanorum/shared";
import {
  loadHexIndexFromFile,
  type HexMapIndexEntry,
} from "../map/hexIndex";
import {
  loadHexMapClientArtifactRuntime,
  type HexMapClientArtifactRuntime,
} from "../scenarios/hexMapClientArtifacts";
import { loadNaturalFeatureVisualCatalog } from "../scenarios/naturalFeatureVisuals";

type MapRuntimeState = {
  prebuiltTileRoot: string;
  rasterTileRoot: string;
  hexIndexJsonPath: string;
  hexMapArtifactJsonPath: string;
  hexMapArtifact: HexMapArtifact | null;
  hexMapClientArtifact: HexMapClientArtifactRuntime | null;
  mapFeatureVisuals: MapFeatureVisualRuleDefinition[];
  naturalFeatureVisualCatalog: NaturalFeatureVisualCatalog;
  hexIndex: HexMapIndexEntry[];
  hexAreaById: Map<string, number>;
  hexById: Map<string, HexMapIndexEntry>;
  hexTileById: Map<string, HexTile>;
};

function buildMapRuntimeState(mapRoot: string, hexIndexPath = resolve(mapRoot, "hexes.json")): MapRuntimeState {
  const prebuiltTileRoot = resolve(mapRoot, "tiles/hex");
  const hexMapArtifactJsonPath = resolve(dirname(hexIndexPath), "hex-map.json");
  const scenarioDir = resolve(dirname(hexIndexPath), "..");
  const hexIndex = loadHexIndexFromFile(hexIndexPath);
  const hexMapArtifact = loadHexMapArtifactIfExists(hexMapArtifactJsonPath);
  return {
    prebuiltTileRoot,
    rasterTileRoot: resolve(mapRoot, "tiles/raster"),
    hexIndexJsonPath: hexIndexPath,
    hexMapArtifactJsonPath,
    hexMapArtifact,
    hexMapClientArtifact: loadHexMapClientArtifactRuntime(scenarioDir),
    mapFeatureVisuals: loadMapFeatureVisuals(resolve(scenarioDir, "common", "map_feature_visuals")),
    naturalFeatureVisualCatalog: loadNaturalFeatureVisualCatalog(scenarioDir),
    hexIndex,
    hexAreaById: new Map(hexIndex.map((hex) => [hex.id, hex.areaKm2] as const)),
    hexById: new Map(hexIndex.map((hex) => [hex.id, hex] as const)),
    hexTileById: new Map((hexMapArtifact?.tiles ?? []).map((hex) => [hex.id, hex] as const)),
  };
}

export function createMapRuntimeState(mapRoot: string, hexIndexPath?: string) {
  let state = buildMapRuntimeState(mapRoot, hexIndexPath);

  function applyMapRuntime(mapRoot: string, hexIndexPath = resolve(mapRoot, "hexes.json")): void {
    state = buildMapRuntimeState(mapRoot, hexIndexPath);
  }

  return {
    applyMapRuntime,
    getHexTileRoot: () => state.prebuiltTileRoot,
    getRasterTileRoot: () => state.rasterTileRoot,
    getHexAreaById: () => state.hexAreaById,
    getHexById: () => state.hexById,
    getHexTileById: () => state.hexTileById,
    getHexIndex: () => state.hexIndex,
    getHexIndexJsonPath: () => state.hexIndexJsonPath,
    getHexMapArtifact: () => state.hexMapArtifact,
    getHexMapArtifactJsonPath: () => state.hexMapArtifactJsonPath,
    getHexMapClientArtifact: () => state.hexMapClientArtifact,
    getMapFeatureVisuals: () => state.mapFeatureVisuals,
    getNaturalFeatureVisualCatalog: () => state.naturalFeatureVisualCatalog,
  };
}

function loadHexMapArtifactIfExists(path: string): HexMapArtifact | null {
  if (!existsSync(path)) return null;
  return enrichHexMapVisualMetadata(JSON.parse(readFileSync(path, "utf8")) as HexMapArtifact);
}

function loadMapFeatureVisuals(directory: string): MapFeatureVisualRuleDefinition[] {
  if (!existsSync(directory)) return [];
  const visuals: MapFeatureVisualRuleDefinition[] = [];
  for (const fileName of readdirSync(directory).filter((entry) => entry.endsWith(".json")).sort((left, right) => left.localeCompare(right, "en"))) {
    const path = join(directory, fileName);
    const data = JSON.parse(readFileSync(path, "utf8")) as MapFeatureVisualRuleDefinition;
    visuals.push(data);
  }
  return visuals;
}
