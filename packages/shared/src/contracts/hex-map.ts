export type HexId = `hex:${number}:${number}`;
export type HexChunkId = `hex-chunk:${number}:${number}`;
export type RegionId = `region:${string}`;
export type HexRegionId = RegionId;

export type HexTerrain =
  | "ocean"
  | "sea"
  | "lake"
  | "coast"
  | "plains"
  | "grassland"
  | "forest"
  | "hills"
  | "mountains"
  | "desert"
  | "tundra"
  | "snow"
  | "wetland";

export type HexBiome =
  | "deep_ocean"
  | "coastal_water"
  | "freshwater"
  | "temperate_grassland"
  | "temperate_forest"
  | "boreal_forest"
  | "tropical_rainforest"
  | "dry_scrubland"
  | "arid_desert"
  | "alpine"
  | "tundra"
  | "swamp"
  | "coastal_wetland";

export type HexFeature = "none" | "forest" | "dense_forest" | "jungle" | "marsh" | "scrub" | "snowcap";
export type HexWaterKind = "ocean" | "sea" | "lake" | null;
export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;
export type HexDistanceToWater = 0 | 1 | 2 | 3;
export type HexTemperatureBand = "frozen" | "cold" | "cool" | "temperate" | "warm" | "hot";
export type HexMoistureBand = "arid" | "dry" | "normal" | "wet" | "saturated";
export type MapFeatureTypeId = `feature:${string}`;
export type MapFeatureInstanceId = `map_feature:${string}`;
export type MapFeatureCategory = "natural" | "deposit" | "site" | "strategic";
export type MapFeatureVisualId = MapFeatureTypeId;
export type MapFeatureVisibility = "known" | "discoverable" | "hidden";

export type HexAxial = {
  q: number;
  r: number;
};

export type HexTile = HexAxial & {
  id: HexId;
  chunkId: HexChunkId;
  regionId: RegionId;
  terrain: HexTerrain;
  biome: HexBiome;
  feature: HexFeature;
  waterKind: HexWaterKind;
  elevation: number;
  moisture: number;
  temperature: number;
  temperatureBand: HexTemperatureBand;
  moistureBand: HexMoistureBand;
  distanceToWater: HexDistanceToWater;
  isCoastal: boolean;
  riverMask: number;
  riverWidth: number;
  movementCost: number;
  passable: boolean;
};

export type HexEdgeRecord = {
  hexId: HexId;
  direction: HexDirection;
  width: number;
};

export type HexCoastOverlayRecord = {
  hexId: HexId;
  direction: HexDirection;
  strength: number;
};

export type HexMapSettings = {
  seed: string;
  width: number;
  height: number;
  hexSize: number;
  seaLevel: number;
  temperature: number;
  moisture: number;
  mountains: number;
  rivers: number;
  forests: number;
  targetLandRegionSize: number;
  targetWaterRegionSize: number;
  chunkSize: number;
  wrapX: boolean;
};

export type HexMapArtifact = {
  version: 1;
  settings: HexMapSettings;
  tiles: HexTile[];
  riverEdges: HexEdgeRecord[];
  coastOverlays: HexCoastOverlayRecord[];
};

export type MapFeatureInstance = {
  id: MapFeatureInstanceId;
  typeId: MapFeatureTypeId;
  category: Exclude<MapFeatureCategory, "natural">;
  hexId: HexId;
  regionId: RegionId;
  visualId: MapFeatureVisualId;
  visibility: MapFeatureVisibility;
  nameKey?: string;
  tooltipKey?: string;
  assetId?: `asset:${string}`;
  sourceGeneratorId?: `map_feature_generator:${string}`;
};

export type MapFeatureCountRule = {
  min?: number;
  max?: number;
  count?: number;
};

export type MapFeatureRegionCountRule = MapFeatureCountRule & {
  regionIds?: RegionId[];
  excludedRegionIds?: RegionId[];
};

export type MapFeatureGeneratorDefinition = {
  id: `map_feature_generator:${string}`;
  typeId: MapFeatureTypeId;
  category: Exclude<MapFeatureCategory, "natural">;
  visualId?: MapFeatureVisualId;
  nameKey?: string;
  tooltipKey?: string;
  assetId?: `asset:${string}`;
  visibility?: MapFeatureVisibility;
  allowedTerrains?: HexTerrain[];
  deniedTerrains?: HexTerrain[];
  allowedFeatures?: HexFeature[];
  deniedFeatures?: HexFeature[];
  allowedWaterKinds?: Array<Exclude<HexWaterKind, null>>;
  deniedWaterKinds?: Array<Exclude<HexWaterKind, null>>;
  regions?: {
    include?: RegionId[];
    exclude?: RegionId[];
  };
  global?: MapFeatureCountRule;
  perRegion?: MapFeatureRegionCountRule;
};

export type MapFeatureVisualCondition = {
  terrains?: HexTerrain[];
  features?: HexFeature[];
  biomes?: HexBiome[];
  waterKinds?: Array<Exclude<HexWaterKind, null>>;
  temperatureBands?: HexTemperatureBand[];
  moistureBands?: HexMoistureBand[];
  minElevation?: number;
  maxElevation?: number;
  minTemperature?: number;
  maxTemperature?: number;
  minMoisture?: number;
  maxMoisture?: number;
  distanceToWater?: HexDistanceToWater[];
  isCoastal?: boolean;
  hasRiver?: boolean;
  riverMasks?: number[];
};

export type MapFeatureVisualFrameRule = {
  frame: number;
  priority?: number;
  weight?: number;
  conditions?: MapFeatureVisualCondition;
};

export type MapFeatureVisualRuleDefinition = {
  id: `map_feature_visual:${string}`;
  visualId: MapFeatureVisualId;
  frames: MapFeatureVisualFrameRule[];
};
