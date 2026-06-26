import type { HexBiome, HexTerrain, HexTile } from "@arcanorum/shared";

export type TerrainMaterialId = "deep_water" | "coastal_water" | "fresh_water" | "grass" | "plains" | "forest" | "hills" | "rock" | "sand" | "tundra" | "snow" | "wetland";
export type HexTerrainShaderQuality = "low" | "medium" | "high";
export const TERRAIN_MATERIAL_IDS: TerrainMaterialId[] = ["deep_water", "coastal_water", "fresh_water", "grass", "plains", "forest", "hills", "rock", "sand", "tundra", "snow", "wetland"];

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
    columns: 4,
    rows: 3,
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
    columns: 8,
    rows: 6,
    tileSize: 128,
    variants: 8,
  },
  riverMasks: {
    url: "/game-assets/hex-materials/hex-river-shape-masks.png",
    columns: 16,
    rows: 16,
    tileSize: 128,
    variants: 4,
  },
  materials: {
    deep_water: material("deep_water", [0.09, 0.27, 0.36], 0.22, 0.72),
    coastal_water: material("coastal_water", [0.18, 0.48, 0.52], 0.18, 0.64),
    fresh_water: material("fresh_water", [0.25, 0.54, 0.57], 0.16, 0.6),
    grass: material("grass", [0.42, 0.62, 0.32], 0.24, 0.78),
    plains: material("plains", [0.66, 0.65, 0.38], 0.22, 0.82),
    forest: material("forest", [0.25, 0.43, 0.24], 0.26, 0.86),
    hills: material("hills", [0.54, 0.5, 0.34], 0.28, 0.9),
    rock: material("rock", [0.45, 0.43, 0.4], 0.3, 0.94),
    sand: material("sand", [0.76, 0.63, 0.34], 0.22, 0.84),
    tundra: material("tundra", [0.56, 0.62, 0.53], 0.2, 0.88),
    snow: material("snow", [0.82, 0.87, 0.84], 0.12, 0.7),
    wetland: material("wetland", [0.34, 0.49, 0.39], 0.24, 0.92),
  },
};

export function resolveTerrainMaterialId(tile: Pick<HexTile, "terrain" | "biome" | "waterKind">): TerrainMaterialId {
  if (tile.waterKind === "ocean" || tile.terrain === "ocean") return "deep_water";
  if (tile.waterKind === "sea" || tile.terrain === "sea" || tile.terrain === "coast") return "coastal_water";
  if (tile.waterKind === "lake" || tile.terrain === "lake") return "fresh_water";
  if (tile.terrain === "desert" || tile.biome === "arid") return "sand";
  if (tile.terrain === "snow" || tile.biome === "cold") return "snow";
  if (tile.terrain === "tundra") return "tundra";
  if (tile.terrain === "mountains") return "rock";
  if (tile.terrain === "hills" || tile.biome === "alpine") return "hills";
  if (tile.terrain === "wetland" || tile.biome === "marsh") return "wetland";
  if (tile.terrain === "forest" || tile.biome === "boreal" || tile.biome === "tropical") return "forest";
  if (tile.terrain === "plains") return "plains";
  return "grass";
}

export function resolveTerrainMaterialColor(materialId: TerrainMaterialId, pack: HexMaterialPackManifest = generatedHexMaterialPack): [number, number, number] {
  return pack.materials[materialId]?.albedoColor ?? pack.materials.grass.albedoColor;
}

export function resolveTerrainMaterialAtlasIndex(materialId: TerrainMaterialId, pack: HexMaterialPackManifest = generatedHexMaterialPack): number {
  return pack.materials[materialId]?.atlasIndex ?? pack.materials.grass.atlasIndex;
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
