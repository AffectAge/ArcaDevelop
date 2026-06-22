import { Assets, type Texture, type TextureSource } from "pixi.js";
import { generatedHexMaterialPack, TERRAIN_MATERIAL_IDS, type HexMaterialPackManifest, type TerrainMaterialId } from "./hexTerrainMaterials";

export type LoadedHexMaterialTextures = {
  pack: HexMaterialPackManifest;
  albedoTexture: Texture;
  detailTexture: Texture;
  albedoSource: TextureSource;
  detailSource: TextureSource;
};

export async function loadHexMaterialTextures(pack: HexMaterialPackManifest = generatedHexMaterialPack): Promise<LoadedHexMaterialTextures> {
  validateHexMaterialPack(pack);
  const [albedoTexture, detailTexture] = await Promise.all([Assets.load<Texture>(pack.atlas.albedoUrl), Assets.load<Texture>(pack.atlas.detailUrl)]);
  if (!albedoTexture?.source || !detailTexture?.source) {
    throw new Error("hex-material-texture-load-failed");
  }
  return {
    pack,
    albedoTexture,
    detailTexture,
    albedoSource: albedoTexture.source,
    detailSource: detailTexture.source,
  };
}

export function validateHexMaterialPack(pack: HexMaterialPackManifest = generatedHexMaterialPack): void {
  const missingMaterials = TERRAIN_MATERIAL_IDS.filter((id) => !pack.materials[id]);
  if (missingMaterials.length > 0) {
    throw new Error(`hex-material-pack-missing:${missingMaterials.join(",")}`);
  }
  const indexes = new Set<number>();
  for (const id of TERRAIN_MATERIAL_IDS) {
    const material = pack.materials[id];
    if (!Number.isInteger(material.atlasIndex) || material.atlasIndex < 0) {
      throw new Error(`hex-material-pack-invalid-index:${id}`);
    }
    indexes.add(material.atlasIndex);
  }
  if (indexes.size !== TERRAIN_MATERIAL_IDS.length) {
    throw new Error("hex-material-pack-duplicate-index");
  }
  if (pack.atlas.columns * pack.atlas.rows < TERRAIN_MATERIAL_IDS.length || pack.atlas.tileSize <= 0 || !pack.atlas.albedoUrl || !pack.atlas.detailUrl) {
    throw new Error("hex-material-pack-invalid-atlas");
  }
}

export function hasMaterialPackEntry(pack: HexMaterialPackManifest, materialId: TerrainMaterialId): boolean {
  return Boolean(pack.materials[materialId]);
}
