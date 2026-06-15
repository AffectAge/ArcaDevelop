import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadProvinceIndexFromFile,
  type Adm1ProvinceIndexEntry,
} from "../map/provinceIndex";

type MapRuntimeState = {
  prebuiltTileRoot: string;
  rasterTileRoot: string;
  provincesJsonPath: string;
  provinceIndex: Adm1ProvinceIndexEntry[];
  provinceAreaById: Map<string, number>;
  provinceById: Map<string, Adm1ProvinceIndexEntry>;
};

function buildMapRuntimeState(mapRoot: string, provinceIndexPath = resolve(mapRoot, "provinces.json")): MapRuntimeState {
  const prebuiltTileRoot = resolve(mapRoot, "tiles/adm1");
  if (!existsSync(prebuiltTileRoot)) {
    throw new Error(`[map] MVT root not found: ${prebuiltTileRoot}. Expected tiles at {z}/{x}/{y}.mvt`);
  }

  const provinceIndex = loadProvinceIndexFromFile(provinceIndexPath);
  return {
    prebuiltTileRoot,
    rasterTileRoot: resolve(mapRoot, "tiles/raster"),
    provincesJsonPath: provinceIndexPath,
    provinceIndex,
    provinceAreaById: new Map(provinceIndex.map((province) => [province.id, province.areaKm2] as const)),
    provinceById: new Map(provinceIndex.map((province) => [province.id, province] as const)),
  };
}

export function createMapRuntimeState(dataRoot: string) {
  let state = buildMapRuntimeState(dataRoot);

  function applyMapRuntime(mapRoot: string, provinceIndexPath = resolve(mapRoot, "provinces.json")): void {
    state = buildMapRuntimeState(mapRoot, provinceIndexPath);
  }

  return {
    applyMapRuntime,
    getAdm1TileRoot: () => state.prebuiltTileRoot,
    getRasterTileRoot: () => state.rasterTileRoot,
    getProvinceAreaById: () => state.provinceAreaById,
    getProvinceById: () => state.provinceById,
    getProvinceIndex: () => state.provinceIndex,
    getProvincesJsonPath: () => state.provincesJsonPath,
  };
}
