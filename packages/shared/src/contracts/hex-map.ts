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

export type HexFeature =
  | "none"
  | "forest"
  | "dense_forest"
  | "jungle"
  | "marsh"
  | "scrub"
  | "snowcap";
export type HexWaterKind = "ocean" | "sea" | "lake" | null;
export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;
export type HexDistanceToWater = 0 | 1 | 2 | 3;
export type HexTemperatureBand =
  | "frozen"
  | "cold"
  | "cool"
  | "temperate"
  | "warm"
  | "hot";
export type HexMoistureBand = "arid" | "dry" | "normal" | "wet" | "saturated";
export type HexMapTag = `${string}:${string}`;
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
  mapTags: HexMapTag[];
  movementCost: number;
  stopsMovementOnEnter?: boolean;
  passable: boolean;
};

export type HexEdgeRecord = {
  hexId: HexId;
  direction: HexDirection;
  width: number;
  riverClass?: "minor" | "major" | "navigable";
  navigable?: boolean;
  crossingCost?: number;
};

export type HexCoastOverlayRecord = {
  hexId: HexId;
  direction: HexDirection;
  strength: number;
};

export type HexMapScript = "continents" | "pangaea" | "archipelago";

export type HexMapRange = {
  min: number;
  max: number;
};

export type HexMapGenerationSettings = {
  mapScript: HexMapScript;
  landmasses: {
    majorContinents: HexMapRange;
    majorContinentSize?: number | HexMapRange;
    landRatio: number;
    islandDensity: "low" | "medium" | "high";
    islandSize?: number | HexMapRange;
    edgeOceanMargin?: number | HexMapRange;
  };
  climate: {
    preset: "earthlike" | "scenario";
    temperature: "cold" | "temperate" | "hot";
    rainfall: "dry" | "balanced" | "wet";
  };
  rivers: {
    density: "rare" | "normal" | "many";
    navigable: boolean;
    crossingPenalty: number;
  };
  regions: {
    targetLandRegionSize: number;
    targetWaterRegionSize: number;
  };
  tags: {
    enabled: boolean;
  };
};

export type HexMapSettings = {
  seed: string;
  width: number;
  height: number;
  hexSize: number;
  chunkSize: number;
  wrapX: boolean;
  generation: HexMapGenerationSettings;
};

export type HexMapArtifact = {
  version: 1;
  settings: HexMapSettings;
  tiles: HexTile[];
  riverEdges: HexEdgeRecord[];
  coastOverlays: HexCoastOverlayRecord[];
};

export const HEX_MAP_CLIENT_FORMAT_VERSION = 1 as const;

export type HexMapClientBounds = {
  minQ: number;
  minR: number;
  maxQ: number;
  maxR: number;
};

export type HexMapClientArtifactDescriptor = {
  fileName: string;
  contentHash: string;
  byteLength: number;
  gzipByteLength: number;
  brotliByteLength: number;
};

export type HexMapClientChunkFileName = `chunk-${number}-${number}.json`;

export type HexMapClientChunkDescriptor = Omit<
  HexMapClientArtifactDescriptor,
  "fileName"
> & {
  id: HexChunkId;
  fileName: HexMapClientChunkFileName;
  chunkQ: number;
  chunkR: number;
  bounds: HexMapClientBounds;
  tileCount: number;
  haloTileCount: number;
};

export type HexMapClientRegionSummary = {
  id: RegionId;
  tileCount: number;
  waterTileCount: number;
  bounds: HexMapClientBounds;
  labelAnchor: HexAxial;
};

export type HexMapClientManifest = {
  formatVersion: typeof HEX_MAP_CLIENT_FORMAT_VERSION;
  artifactVersion: string;
  settings: HexMapSettings;
  regions: HexMapClientRegionSummary[];
  navigation: HexMapClientArtifactDescriptor & { fileName: "navigation.json" };
  chunks: HexMapClientChunkDescriptor[];
};

export type HexMapClientChunk = {
  formatVersion: typeof HEX_MAP_CLIENT_FORMAT_VERSION;
  artifactVersion: string;
  id: HexChunkId;
  bounds: HexMapClientBounds;
  tiles: HexTile[];
  visualHalo: HexTile[];
  riverEdges: HexEdgeRecord[];
  coastOverlays: HexCoastOverlayRecord[];
  features: MapFeatureInstance[];
};

export const HEX_MAP_NAVIGATION_WATER_KIND = {
  land: 0,
  ocean: 1,
  sea: 2,
  lake: 3,
} as const;

export type HexMapNavigationWaterKind =
  (typeof HEX_MAP_NAVIGATION_WATER_KIND)[keyof typeof HEX_MAP_NAVIGATION_WATER_KIND];

export const HEX_MAP_NAVIGATION_RIVER_CLASS = {
  minor: 0,
  major: 1,
  navigable: 2,
} as const;

export type HexMapNavigationRiverClass =
  (typeof HEX_MAP_NAVIGATION_RIVER_CLASS)[keyof typeof HEX_MAP_NAVIGATION_RIVER_CLASS];

export type HexMapNavigationRiverEdge = [
  tileIndex: number,
  direction: HexDirection,
  width: number,
  riverClass: HexMapNavigationRiverClass,
  navigable: 0 | 1,
  crossingCost: number,
];

export type HexMapNavigationArtifact = {
  formatVersion: typeof HEX_MAP_CLIENT_FORMAT_VERSION;
  artifactVersion: string;
  width: number;
  height: number;
  wrapX: boolean;
  regionIds: RegionId[];
  passability: Array<0 | 1>;
  waterKinds: HexMapNavigationWaterKind[];
  movementCosts: number[];
  stopsMovementOnEnter: Array<0 | 1>;
  regionIndexes: number[];
  riverEdges: HexMapNavigationRiverEdge[];
};

export type HexMapPathRequestMode = "unit" | "corridor" | "attack";

export type HexMapWorkerRequest =
  | {
      type: "configure";
      apiBase: string;
      manifest: HexMapClientManifest;
      generation: number;
    }
  | {
      type: "setDesiredChunkIds";
      chunkIds: HexChunkId[];
      generation: number;
    }
  | {
      type: "findPath";
      requestId: number;
      fromHexId: HexId;
      toHexId: HexId;
      mode: HexMapPathRequestMode;
      generation: number;
    }
  | {
      type: "cancelPath";
      requestId: number;
      generation: number;
    };

export type HexMapWorkerResponse<TChunkRenderData = HexMapClientChunk> =
  | { type: "configured"; generation: number }
  | {
      type: "chunkReady";
      chunkId: HexChunkId;
      data: TChunkRenderData;
      generation: number;
    }
  | {
      type: "chunkFailed";
      chunkId: HexChunkId;
      code: string;
      generation: number;
    }
  | {
      type: "pathReady";
      requestId: number;
      hexIds: HexId[];
      generation: number;
    }
  | {
      type: "pathFailed";
      requestId: number;
      code: string;
      generation: number;
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
  allowedWaterKinds?: Array<Exclude<HexWaterKind, null>>;
  deniedWaterKinds?: Array<Exclude<HexWaterKind, null>>;
  tagQuery?: MapTagQuery;
  regions?: {
    include?: RegionId[];
    exclude?: RegionId[];
  };
  global?: MapFeatureCountRule;
  perRegion?: MapFeatureRegionCountRule;
};

export type MapFeatureVisualCondition = {
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
  tagQuery?: MapTagQuery;
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

export type NaturalFeatureTextureSetId =
  | "grassland"
  | "plains"
  | "tropical"
  | "desert"
  | "tundra"
  | "wetland"
  | "snow"
  | "glacial_mountain"
  | "mountain"
  | "highland";

export const NATURAL_FEATURE_FRAME_MAX = 15 as const;

export type NaturalFeatureRenderLod = "simplified" | "detailed";
export type NaturalFeatureVisualLayer =
  | "landform"
  | "vegetation"
  | "wet"
  | "snow";
export const NATURAL_FEATURE_VISUAL_LAYOUT_IDS = [
  "temperate_grove",
  "temperate_understory",
  "plains_grove",
  "plains_scrub",
  "tropical_grove",
  "tropical_understory",
  "oasis_ring",
  "scrub_edge",
  "taiga_stand",
  "tundra_edge",
  "wetland_band",
  "wetland_copse",
  "mountain_massif_base",
  "mountain_ridge",
  "mountain_slope",
  "mountain_tree_line",
  "snow_ridge",
  "rock_cluster",
] as const;
export type NaturalFeatureVisualLayoutId =
  (typeof NATURAL_FEATURE_VISUAL_LAYOUT_IDS)[number];

export type NaturalFeatureVisualPlacement = {
  id: string;
  frameIds: number[];
  count: { min: number; max: number };
  /** Stable composition family; its variants arrange objects as a readable natural group. */
  layoutId: NaturalFeatureVisualLayoutId;
  tagQuery?: MapTagQuery;
  lod: NaturalFeatureRenderLod;
  layer: NaturalFeatureVisualLayer;
  /** Explicit render order inside one natural layer; higher values draw over lower ones. */
  drawOrder?: number;
  scale?: { min: number; max: number };
  rotation?: boolean;
};

/** Scenario-authored recipe for transparent, terrain-complementary natural objects. */
export type NaturalFeatureVisualRuleDefinition = {
  id: `natural_feature_visual:${string}`;
  tagQuery: MapTagQuery;
  textureSetId: NaturalFeatureTextureSetId;
  placements: NaturalFeatureVisualPlacement[];
  priority?: number;
  assetId?: `asset:${string}`;
};

export type NaturalFeatureVisualCatalog = {
  visuals: NaturalFeatureVisualRuleDefinition[];
  textureUrls: Partial<Record<NaturalFeatureTextureSetId, string>>;
};

export type MapVisualLayer =
  | "base"
  | "morphology"
  | "feature"
  | "water"
  | "river"
  | "coast";

export type MapVisualProfileRule = {
  id: `map_visual_rule:${string}`;
  layer: MapVisualLayer;
  priority?: number;
  when: MapTagQuery;
  materialId?: `map_material:${string}`;
  overlayId?: `map_overlay:${string}`;
  atlasFrame?: number;
};

export type MapVisualProfileDefinition = {
  id: `map_visual_profile:${string}`;
  rules: MapVisualProfileRule[];
};

export type MapTagQuery =
  | string
  | {
      all?: MapTagQuery[];
      any?: MapTagQuery[];
      not?: MapTagQuery | MapTagQuery[];
    };
