import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { HexMapArtifact } from "@arcanorum/shared";
import type { MapFeatureInstance } from "@arcanorum/shared";
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
  hexIndex: HexMapIndexEntry[];
  hexAreaById: Map<string, number>;
  hexById: Map<string, HexMapIndexEntry>;
};

function buildMapRuntimeState(mapRoot: string, hexIndexPath = resolve(mapRoot, "hexes.json")): MapRuntimeState {
  const prebuiltTileRoot = resolve(mapRoot, "tiles/hex");
  const hexMapArtifactJsonPath = resolve(dirname(hexIndexPath), "hex-map-artifact.json");
  const mapFeaturesJsonPath = resolve(dirname(hexIndexPath), GENERATED_MAP_FEATURES_FILE);
  const hexIndex = loadHexIndexFromFile(hexIndexPath);
  return {
    prebuiltTileRoot,
    rasterTileRoot: resolve(mapRoot, "tiles/raster"),
    hexIndexJsonPath: hexIndexPath,
    hexMapArtifactJsonPath,
    mapFeaturesJsonPath,
    hexMapArtifact: loadHexMapArtifactIfExists(hexMapArtifactJsonPath),
    mapFeatures: loadGeneratedMapFeatures(mapFeaturesJsonPath),
    hexIndex,
    hexAreaById: new Map(hexIndex.map((hex) => [hex.id, hex.areaKm2] as const)),
    hexById: new Map(hexIndex.map((hex) => [hex.id, hex] as const)),
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
    getHexIndex: () => state.hexIndex,
    getHexIndexJsonPath: () => state.hexIndexJsonPath,
    getHexMapArtifact: () => state.hexMapArtifact,
    getHexMapArtifactJsonPath: () => state.hexMapArtifactJsonPath,
    getMapFeatures: () => state.mapFeatures,
  };
}

function loadHexMapArtifactIfExists(path: string): HexMapArtifact | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as HexMapArtifact;
}
