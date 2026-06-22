export type HexId = `hex:${number}:${number}`;
export type HexChunkId = `hex-chunk:${number}:${number}`;
export type HexRegionId = `hex-region:${string}:${number}`;

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
  | "temperate"
  | "boreal"
  | "tropical"
  | "arid"
  | "cold"
  | "alpine"
  | "marsh";

export type HexFeature = "none" | "forest" | "dense_forest" | "jungle" | "marsh" | "scrub" | "snowcap";
export type HexWaterKind = "ocean" | "sea" | "lake" | null;
export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;

export type HexAxial = {
  q: number;
  r: number;
};

export type HexTile = HexAxial & {
  id: HexId;
  chunkId: HexChunkId;
  regionId: HexRegionId;
  terrain: HexTerrain;
  biome: HexBiome;
  feature: HexFeature;
  waterKind: HexWaterKind;
  elevation: number;
  moisture: number;
  temperature: number;
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
