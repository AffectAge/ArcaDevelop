import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadHexIndexFromFile,
  type HexMapIndexEntry,
} from "../map/hexIndex";

type MapRuntimeState = {
  prebuiltTileRoot: string;
  rasterTileRoot: string;
  hexIndexJsonPath: string;
  hexIndex: HexMapIndexEntry[];
  hexAreaById: Map<string, number>;
  hexById: Map<string, HexMapIndexEntry>;
};

function buildMapRuntimeState(mapRoot: string, hexIndexPath = resolve(mapRoot, "hexes.json")): MapRuntimeState {
  const prebuiltTileRoot = resolve(mapRoot, "tiles/hex");
  const hexIndex = loadHexIndexFromFile(hexIndexPath);
  return {
    prebuiltTileRoot,
    rasterTileRoot: resolve(mapRoot, "tiles/raster"),
    hexIndexJsonPath: hexIndexPath,
    hexIndex,
    hexAreaById: new Map(hexIndex.map((hex) => [hex.id, hex.areaKm2] as const)),
    hexById: new Map(hexIndex.map((hex) => [hex.id, hex] as const)),
  };
}

export function createMapRuntimeState(dataRoot: string) {
  let state = buildMapRuntimeState(dataRoot);

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
  };
}
