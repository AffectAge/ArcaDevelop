import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { enrichHexMapVisualMetadata, type HexMapArtifact, type HexTile } from "@arcanorum/shared";
import type { MapFeatureInstance, MapFeatureVisualRuleDefinition } from "@arcanorum/shared";
import {
  loadHexIndexFromFile,
  type HexMapIndexEntry,
} from "../map/hexIndex";
import { loadGeneratedMapFeatures, GENERATED_MAP_FEATURES_FILE } from "../scenarios/mapFeatureGeneration";

type MapRuntimeState = {
  prebuiltTileRoot: string;
  rasterTileRoot: string;
  hexIndexJsonPath: string;
  hexMapArtifactJsonPath: string;
  mapFeaturesJsonPath: string;
  hexMapArtifact: HexMapArtifact | null;
  mapFeatures: MapFeatureInstance[];
  mapFeatureVisuals: MapFeatureVisualRuleDefinition[];
  hexIndex: HexMapIndexEntry[];
  hexAreaById: Map<string, number>;
  hexById: Map<string, HexMapIndexEntry>;
  hexTileById: Map<string, HexTile>;
};

function buildMapRuntimeState(mapRoot: string, hexIndexPath = resolve(mapRoot, "hexes.json")): MapRuntimeState {
  const prebuiltTileRoot = resolve(mapRoot, "tiles/hex");
  const hexMapArtifactJsonPath = resolve(dirname(hexIndexPath), "hex-map.json");
  const mapFeaturesJsonPath = resolve(dirname(hexIndexPath), GENERATED_MAP_FEATURES_FILE);
  const scenarioDir = resolve(dirname(hexIndexPath), "..");
  const hexIndex = loadHexIndexFromFile(hexIndexPath);
  const hexMapArtifact = loadHexMapArtifactIfExists(hexMapArtifactJsonPath);
  return {
    prebuiltTileRoot,
    rasterTileRoot: resolve(mapRoot, "tiles/raster"),
    hexIndexJsonPath: hexIndexPath,
    hexMapArtifactJsonPath,
    mapFeaturesJsonPath,
    hexMapArtifact,
    mapFeatures: loadGeneratedMapFeatures(mapFeaturesJsonPath),
    mapFeatureVisuals: loadMapFeatureVisuals(resolve(scenarioDir, "common", "map_feature_visuals")),
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
    getMapFeatures: () => state.mapFeatures,
    getMapFeatureVisuals: () => state.mapFeatureVisuals,
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
