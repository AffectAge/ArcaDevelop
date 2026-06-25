import { Assets, type Texture, type TextureSource } from "pixi.js";
import { generatedHexMaterialPack, TERRAIN_MATERIAL_IDS, type HexMaterialPackManifest, type TerrainMaterialId } from "./hexTerrainMaterials";

export type LoadedHexMaterialTextures = {
  pack: HexMaterialPackManifest;
  albedoTexture: Texture;
  detailTexture: Texture;
  coastMaskTexture: Texture;
  biomeTransitionTexture: Texture;
  albedoSource: TextureSource;
  detailSource: TextureSource;
  coastMaskSource: TextureSource;
  biomeTransitionSource: TextureSource;
};

export async function loadHexMaterialTextures(pack: HexMaterialPackManifest = generatedHexMaterialPack): Promise<LoadedHexMaterialTextures> {
  validateHexMaterialPack(pack);
  const [albedoTexture, detailTexture, coastMaskTexture, biomeTransitionTexture] = await Promise.all([
    Assets.load<Texture>(pack.atlas.albedoUrl),
    Assets.load<Texture>(pack.atlas.detailUrl),
    Assets.load<Texture>(pack.coastMasks.url),
    Assets.load<Texture>(pack.biomeTransitions.url),
  ]);
  if (!albedoTexture?.source || !detailTexture?.source || !coastMaskTexture?.source || !biomeTransitionTexture?.source) {
    throw new Error("hex-material-texture-load-failed");
  }
  return {
    pack,
    albedoTexture,
    detailTexture,
    coastMaskTexture,
    biomeTransitionTexture,
    albedoSource: albedoTexture.source,
    detailSource: detailTexture.source,
    coastMaskSource: coastMaskTexture.source,
    biomeTransitionSource: biomeTransitionTexture.source,
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
  if (
    !pack.coastMasks.url ||
    pack.coastMasks.columns <= 0 ||
    pack.coastMasks.rows <= 0 ||
    pack.coastMasks.tileSize <= 0 ||
    pack.coastMasks.variants <= 0 ||
    pack.coastMasks.columns * pack.coastMasks.rows < 64 * pack.coastMasks.variants
  ) {
    throw new Error("hex-material-pack-invalid-coast-masks");
  }
  if (
    !pack.biomeTransitions.url ||
    pack.biomeTransitions.columns <= 0 ||
    pack.biomeTransitions.rows <= 0 ||
    pack.biomeTransitions.tileSize <= 0 ||
    pack.biomeTransitions.variants <= 0 ||
    pack.biomeTransitions.columns * pack.biomeTransitions.rows < 6 * pack.biomeTransitions.variants
  ) {
    throw new Error("hex-material-pack-invalid-biome-transitions");
  }
}

export function hasMaterialPackEntry(pack: HexMaterialPackManifest, materialId: TerrainMaterialId): boolean {
  return Boolean(pack.materials[materialId]);
}
