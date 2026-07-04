import type { HexTile } from "@arcanorum/shared";

export type TerrainMaterialId =
  | "deep_water"
  | "coastal_water"
  | "fresh_water"
  | "tundra_flat"
  | "tundra_rough"
  | "tundra_mountainous"
  | "grassland_flat"
  | "grassland_rough"
  | "grassland_mountainous"
  | "plains_flat"
  | "plains_rough"
  | "plains_mountainous"
  | "desert_flat"
  | "desert_rough"
  | "desert_mountainous"
  | "tropical_flat"
  | "tropical_rough"
  | "tropical_mountainous"
  | "city";
export type HexTerrainShaderQuality = "low" | "medium" | "high";
export const TERRAIN_MATERIAL_IDS: TerrainMaterialId[] = [
  "deep_water",
  "coastal_water",
  "fresh_water",
  "tundra_flat",
  "tundra_rough",
  "tundra_mountainous",
  "grassland_flat",
  "grassland_rough",
  "grassland_mountainous",
  "plains_flat",
  "plains_rough",
  "plains_mountainous",
  "desert_flat",
  "desert_rough",
  "desert_mountainous",
  "tropical_flat",
  "tropical_rough",
  "tropical_mountainous",
  "city",
];

export type HexMaterialLayerSet = {
  albedo: string;
  detail?: string;
  normal?: string;
  roughness?: string;
  ao?: string;
};

export type HexMaterialDefinition = {
  id: TerrainMaterialId;
  atlasIndex: number;
  albedoColor: [number, number, number];
  detailStrength: number;
  roughness: number;
  layers: HexMaterialLayerSet;
};

export type HexMaterialPackManifest = {
  id: string;
  atlas: {
    columns: number;
    rows: number;
    tileSize: number;
    albedoUrl: string;
    detailUrl: string;
  };
  coastMasks: {
    url: string;
    columns: number;
    rows: number;
    tileSize: number;
    variants: number;
  };
  biomeTransitions: {
    url: string;
    columns: number;
    rows: number;
    tileSize: number;
    variants: number;
  };
  riverMasks: {
    url: string;
    columns: number;
    rows: number;
    tileSize: number;
    variants: number;
  };
  materials: Record<TerrainMaterialId, HexMaterialDefinition>;
};

export const generatedHexMaterialPack: HexMaterialPackManifest = {
  id: "arcanorum-generated-terrain-materials-v1",
  atlas: {
    columns: 5,
    rows: 4,
    tileSize: 128,
    albedoUrl: "/game-assets/hex-materials/hex-terrain-albedo.png",
    detailUrl: "/game-assets/hex-materials/hex-terrain-detail.png",
  },
  coastMasks: {
    url: "/game-assets/hex-materials/hex-coast-masks.png",
    columns: 16,
    rows: 16,
    tileSize: 128,
    variants: 4,
  },
  biomeTransitions: {
    url: "/game-assets/hex-materials/hex-biome-transition-masks.png",
    columns: 16,
    rows: 6,
    tileSize: 128,
    variants: 16,
  },
  riverMasks: {
    url: "/game-assets/hex-materials/hex-river-shape-masks.png",
    columns: 32,
    rows: 16,
    tileSize: 128,
    variants: 8,
  },
  materials: {
    deep_water: material("deep_water", [0.09, 0.27, 0.36], 0.22, 0.72),
    coastal_water: material("coastal_water", [0.18, 0.48, 0.52], 0.18, 0.64),
    fresh_water: material("fresh_water", [0.25, 0.54, 0.57], 0.16, 0.6),
    tundra_flat: material("tundra_flat", [0.56, 0.62, 0.53], 0.18, 0.82),
    tundra_rough: material("tundra_rough", [0.49, 0.55, 0.5], 0.28, 0.9),
    tundra_mountainous: material("tundra_mountainous", [0.42, 0.44, 0.43], 0.38, 0.96),
    grassland_flat: material("grassland_flat", [0.42, 0.62, 0.32], 0.2, 0.78),
    grassland_rough: material("grassland_rough", [0.36, 0.52, 0.3], 0.3, 0.88),
    grassland_mountainous: material("grassland_mountainous", [0.31, 0.43, 0.28], 0.4, 0.96),
    plains_flat: material("plains_flat", [0.66, 0.65, 0.38], 0.2, 0.8),
    plains_rough: material("plains_rough", [0.58, 0.54, 0.34], 0.3, 0.9),
    plains_mountainous: material("plains_mountainous", [0.5, 0.46, 0.32], 0.4, 0.96),
    desert_flat: material("desert_flat", [0.76, 0.63, 0.34], 0.18, 0.82),
    desert_rough: material("desert_rough", [0.66, 0.55, 0.34], 0.28, 0.9),
    desert_mountainous: material("desert_mountainous", [0.55, 0.45, 0.33], 0.38, 0.96),
    tropical_flat: material("tropical_flat", [0.24, 0.58, 0.31], 0.22, 0.84),
    tropical_rough: material("tropical_rough", [0.21, 0.47, 0.29], 0.32, 0.92),
    tropical_mountainous: material("tropical_mountainous", [0.18, 0.37, 0.26], 0.42, 0.98),
    city: material("city", [0.54, 0.48, 0.42], 0.32, 0.96),
  },
};

export function resolveTerrainMaterialId(tile: Pick<HexTile, "mapTags" | "waterKind">): TerrainMaterialId {
  const tags = tile.mapTags ?? [];
  if (tile.waterKind === "ocean" || tags.includes("water:ocean")) return "deep_water";
  if (tile.waterKind === "sea" || tags.includes("water:coastal")) return "coastal_water";
  if (tile.waterKind === "lake" || tags.includes("water:lake")) return "fresh_water";
  const biome = resolveLandBiome(tags);
  const morphology = tags.includes("morphology:mountainous") ? "mountainous" : tags.includes("morphology:rough") ? "rough" : "flat";
  return `${biome}_${morphology}`;
}

export function resolveTerrainMaterialColor(materialId: TerrainMaterialId, pack: HexMaterialPackManifest = generatedHexMaterialPack): [number, number, number] {
  return pack.materials[materialId]?.albedoColor ?? pack.materials.grassland_flat.albedoColor;
}

export function resolveTerrainMaterialAtlasIndex(materialId: TerrainMaterialId, pack: HexMaterialPackManifest = generatedHexMaterialPack): number {
  return pack.materials[materialId]?.atlasIndex ?? pack.materials.grassland_flat.atlasIndex;
}

export function resolveShaderQualityFeatures(quality: HexTerrainShaderQuality): {
  detail: boolean;
  normal: boolean;
  animatedWater: boolean;
  coastMasks: boolean;
  coastFoam: boolean;
  biomeTransitions: boolean;
  riverMasks: boolean;
} {
  if (quality === "low") return { detail: false, normal: false, animatedWater: false, coastMasks: false, coastFoam: false, biomeTransitions: false, riverMasks: true };
  if (quality === "medium") return { detail: true, normal: false, animatedWater: false, coastMasks: true, coastFoam: false, biomeTransitions: true, riverMasks: true };
  return { detail: true, normal: true, animatedWater: true, coastMasks: true, coastFoam: true, biomeTransitions: true, riverMasks: true };
}

export function isWaterMaterial(materialId: TerrainMaterialId): boolean {
  return materialId === "deep_water" || materialId === "coastal_water" || materialId === "fresh_water";
}

function material(id: TerrainMaterialId, albedoColor: [number, number, number], detailStrength: number, roughness: number): HexMaterialDefinition {
  return {
    id,
    atlasIndex: TERRAIN_MATERIAL_IDS.indexOf(id),
    albedoColor,
    detailStrength,
    roughness,
    layers: {
      albedo: `${id}_albedo`,
      detail: `${id}_detail`,
      normal: `${id}_normal`,
      roughness: `${id}_roughness`,
      ao: `${id}_ao`,
    },
  };
}

function resolveLandBiome(tags: string[]): "tundra" | "grassland" | "plains" | "desert" | "tropical" {
  if (tags.includes("biome:tundra")) return "tundra";
  if (tags.includes("biome:plains")) return "plains";
  if (tags.includes("biome:desert")) return "desert";
  if (tags.includes("biome:tropical")) return "tropical";
  return "grassland";
}
