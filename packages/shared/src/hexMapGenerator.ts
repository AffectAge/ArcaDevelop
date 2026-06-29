import { createNoise2D } from "simplex-noise";
import type {
  HexBiome,
  HexChunkId,
  HexCoastOverlayRecord,
  HexDirection,
  HexDistanceToWater,
  HexEdgeRecord,
  HexFeature,
  HexMapArtifact,
  HexMapSettings,
  HexMoistureBand,
  HexRegionId,
  HexTemperatureBand,
  HexTerrain,
  HexTile,
  HexWaterKind,
} from "./contracts/hex-map";
import { getNeighborAxial, HEX_DIRECTIONS, makeHexId } from "./hexGeometry";

type TileDraft = Omit<HexTile, "regionId"> & { regionId: HexRegionId | null };

export const DEFAULT_HEX_MAP_SETTINGS: HexMapSettings = {
  seed: "arcanorum-main-world-v1",
  width: 360,
  height: 160,
  hexSize: 18,
  seaLevel: 0.5,
  temperature: 0.52,
  moisture: 0.58,
  mountains: 0.66,
  rivers: 0.72,
  forests: 0.62,
  targetLandRegionSize: 74,
  targetWaterRegionSize: 140,
  chunkSize: 20,
  wrapX: true,
};

export function generateHexMap(settings: HexMapSettings = DEFAULT_HEX_MAP_SETTINGS): HexMapArtifact {
  const random = seededRandom(settings.seed);
  const elevationNoise = createNoise2D(random);
  const moistureNoise = createNoise2D(random);
  const temperatureNoise = createNoise2D(random);
  const featureNoise = createNoise2D(random);
  const tiles: TileDraft[] = [];
  const tileById = new Map<string, TileDraft>();

  for (let r = 0; r < settings.height; r += 1) {
    for (let q = 0; q < settings.width; q += 1) {
      const normalizedY = r / Math.max(1, settings.height - 1);
      const latitude = Math.abs(normalizedY - 0.5) * 2;
      const continentalMask = 1 - Math.min(1, Math.abs(q / settings.width - 0.5) * 1.65);
      const elevation =
        normalizedNoise(elevationNoise(q / 43, r / 43)) * 0.52 +
        normalizedNoise(elevationNoise(q / 117 + 12, r / 117 - 9)) * 0.34 +
        normalizedNoise(elevationNoise(q / 19 - 5, r / 19 + 7)) * 0.14 +
        continentalMask * 0.11 -
        latitude * 0.08;
      const moisture = clamp01(
        normalizedNoise(moistureNoise(q / 36 + 3, r / 36 - 3)) * 0.65 +
          normalizedNoise(moistureNoise(q / 95 - 11, r / 95 + 4)) * 0.35 +
          settings.moisture * 0.18,
      );
      const temperature = clamp01(
        settings.temperature * 0.3 +
          (1 - latitude) * 0.58 +
          normalizedNoise(temperatureNoise(q / 68 - 6, r / 68 + 18)) * 0.18 -
          Math.max(0, elevation - 0.65) * 0.26,
      );
      const waterKind = resolveWaterKind(elevation, settings.seaLevel, q, r, settings);
      const terrain = resolveTerrain(elevation, moisture, temperature, waterKind, settings);
      const feature = resolveFeature(terrain, moisture, temperature, normalizedNoise(featureNoise(q / 15, r / 15)), settings);
      const temperatureBand = resolveTemperatureBand(temperature);
      const moistureBand = resolveMoistureBand(moisture);
      const id = makeHexId(q, r);
      const tile: TileDraft = {
        id,
        q,
        r,
        chunkId: makeChunkId(q, r, settings),
        regionId: null,
        terrain,
        feature,
        waterKind,
        elevation: roundMetric(elevation),
        moisture: roundMetric(moisture),
        temperature: roundMetric(temperature),
        temperatureBand,
        moistureBand,
        biome: resolveBiome(terrain, feature, moisture, temperature, waterKind, false),
        distanceToWater: waterKind ? 0 : 3,
        isCoastal: false,
        riverMask: 0,
        riverWidth: 0,
        movementCost: resolveMovementCost(terrain, feature, waterKind),
        passable: waterKind !== "ocean",
      };
      tiles.push(tile);
      tileById.set(id, tile);
    }
  }

  const coastOverlays = buildCoastOverlays(tiles, tileById, settings);
  const riverEdges = buildRiverEdges(tiles, tileById, settings);
  applyHydrologyMetadata(tiles, tileById, coastOverlays, riverEdges, settings);
  assignRegions(tiles, tileById, settings);

  return {
    version: 1,
    settings,
    tiles: tiles.map((tile) => ({ ...tile, regionId: tile.regionId ?? "region:land:0" })),
    riverEdges,
    coastOverlays,
  };
}

function makeChunkId(q: number, r: number, settings: HexMapSettings): HexChunkId {
  return `hex-chunk:${Math.floor(q / settings.chunkSize)}:${Math.floor(r / settings.chunkSize)}`;
}

function resolveWaterKind(elevation: number, seaLevel: number, q: number, r: number, settings: HexMapSettings): HexWaterKind {
  if (elevation < seaLevel - 0.12) return "ocean";
  if (elevation < seaLevel) return "sea";
  const lakeBand = Math.sin(q * 12.9898 + r * 78.233 + settings.seed.length) * 43758.5453;
  if (elevation < seaLevel + 0.035 && lakeBand - Math.floor(lakeBand) > 0.955) return "lake";
  return null;
}

function resolveTerrain(elevation: number, moisture: number, temperature: number, waterKind: HexWaterKind, settings: HexMapSettings): HexTerrain {
  if (waterKind === "ocean") return "ocean";
  if (waterKind === "sea") return "sea";
  if (waterKind === "lake") return "lake";
  if (elevation > settings.mountains + 0.12) return temperature < 0.22 ? "snow" : "mountains";
  if (elevation > settings.mountains - 0.03) return "hills";
  if (temperature < 0.18) return "tundra";
  if (temperature > 0.62 && moisture < 0.32) return "desert";
  if (moisture > 0.78 && elevation < settings.seaLevel + 0.12) return "wetland";
  if (moisture > 0.56) return "grassland";
  return "plains";
}

function resolveBiome(terrain: HexTerrain, feature: HexFeature, moisture: number, temperature: number, waterKind: HexWaterKind, isCoastal: boolean): HexBiome {
  if (waterKind === "ocean") return "deep_ocean";
  if (waterKind === "sea") return "coastal_water";
  if (waterKind === "lake") return "freshwater";
  if (terrain === "wetland" && isCoastal) return "coastal_wetland";
  if (terrain === "mountains" || terrain === "hills" || terrain === "snow") return "alpine";
  if (terrain === "wetland" || feature === "marsh" || moisture > 0.82) return "swamp";
  if (terrain === "tundra" || temperature < 0.22) return "tundra";
  if (terrain === "desert") return "arid_desert";
  if (feature === "jungle" || (temperature > 0.66 && moisture > 0.58)) return "tropical_rainforest";
  if (feature === "dense_forest" || feature === "forest") return temperature < 0.44 ? "boreal_forest" : "temperate_forest";
  if (feature === "scrub" || moisture < 0.34) return "dry_scrubland";
  return "temperate_grassland";
}

export function enrichHexMapVisualMetadata(artifact: HexMapArtifact): HexMapArtifact {
  const tiles: TileDraft[] = artifact.tiles.map((tile) => {
    const temperatureBand = tile.temperatureBand ?? resolveTemperatureBand(tile.temperature);
    const moistureBand = tile.moistureBand ?? resolveMoistureBand(tile.moisture);
    return {
      ...tile,
      temperatureBand,
      moistureBand,
      biome: tile.biome ?? resolveBiome(tile.terrain, tile.feature, tile.moisture, tile.temperature, tile.waterKind, false),
      distanceToWater: tile.distanceToWater ?? (tile.waterKind ? 0 : 3),
      isCoastal: tile.isCoastal ?? false,
      riverMask: tile.riverMask ?? 0,
      riverWidth: tile.riverWidth ?? 0,
    };
  });
  const tileById = new Map<string, TileDraft>(tiles.map((tile) => [tile.id, tile]));
  applyHydrologyMetadata(tiles, tileById, artifact.coastOverlays, artifact.riverEdges, artifact.settings);
  return { ...artifact, tiles: tiles.map((tile) => ({ ...tile, regionId: tile.regionId ?? "region:land:0" })) };
}

function resolveTemperatureBand(temperature: number): HexTemperatureBand {
  if (temperature < 0.16) return "frozen";
  if (temperature < 0.3) return "cold";
  if (temperature < 0.45) return "cool";
  if (temperature < 0.62) return "temperate";
  if (temperature < 0.78) return "warm";
  return "hot";
}

function resolveMoistureBand(moisture: number): HexMoistureBand {
  if (moisture < 0.2) return "arid";
  if (moisture < 0.4) return "dry";
  if (moisture < 0.62) return "normal";
  if (moisture < 0.8) return "wet";
  return "saturated";
}

function resolveFeature(terrain: HexTerrain, moisture: number, temperature: number, noise: number, settings: HexMapSettings): HexFeature {
  if (terrain === "ocean" || terrain === "sea" || terrain === "lake" || terrain === "desert") return "none";
  if (terrain === "snow" || terrain === "mountains") return noise > 0.84 ? "snowcap" : "none";
  if (terrain === "wetland") return noise > 0.42 ? "marsh" : "none";
  if (temperature > 0.64 && moisture > 0.58 && noise > 1 - settings.forests * 0.74) return "jungle";
  if (moisture > 0.52 && noise > 1 - settings.forests * 0.66) return noise > 0.86 ? "dense_forest" : "forest";
  if (moisture < 0.4 && noise > 0.78) return "scrub";
  return "none";
}

function resolveMovementCost(terrain: HexTerrain, feature: HexFeature, waterKind: HexWaterKind): number {
  if (waterKind === "ocean") return 5;
  if (waterKind === "sea" || waterKind === "lake") return 3;
  const terrainCost: Record<HexTerrain, number> = {
    ocean: 5,
    sea: 3,
    lake: 3,
    coast: 2,
    plains: 1,
    grassland: 1,
    forest: 2,
    hills: 2,
    mountains: 4,
    desert: 2,
    tundra: 2,
    snow: 3,
    wetland: 3,
  };
  const featureCost = feature === "dense_forest" || feature === "jungle" || feature === "marsh" ? 1 : 0;
  return terrainCost[terrain] + featureCost;
}

function buildCoastOverlays(tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): HexCoastOverlayRecord[] {
  const overlays: HexCoastOverlayRecord[] = [];
  for (const tile of tiles) {
    if (tile.waterKind) continue;
    for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
      const neighborAxial = getNeighborAxial(tile, direction as HexDirection, settings);
      const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
      if (neighbor?.waterKind === "sea" || neighbor?.waterKind === "ocean" || neighbor?.waterKind === "lake") {
        overlays.push({ hexId: tile.id, direction: direction as HexDirection, strength: resolveCoastOverlayStrength(neighbor.waterKind) });
      }
    }
  }
  return overlays;
}

function resolveCoastOverlayStrength(waterKind: Exclude<HexWaterKind, null>): number {
  if (waterKind === "ocean") return 0.82;
  if (waterKind === "lake") return 0.92;
  return 0.58;
}

function applyHydrologyMetadata(
  tiles: TileDraft[],
  tileById: Map<string, TileDraft>,
  coastOverlays: HexCoastOverlayRecord[],
  riverEdges: HexEdgeRecord[],
  settings: HexMapSettings,
): void {
  const coastalHexIds = new Set(coastOverlays.map((overlay) => overlay.hexId));
  const riverDrafts = collectRiverDrafts(riverEdges, tileById, settings);

  for (const tile of tiles) {
    tile.isCoastal = coastalHexIds.has(tile.id);
    tile.distanceToWater = resolveDistanceToWater(tile, tileById, settings);
    const riverDraft = riverDrafts.get(tile.id);
    tile.riverMask = riverDraft?.mask ?? 0;
    tile.riverWidth = roundMetric(riverDraft?.width ?? 0);
    tile.biome = resolveBiome(tile.terrain, tile.feature, tile.moisture, tile.temperature, tile.waterKind, tile.isCoastal);
  }
}

function collectRiverDrafts(riverEdges: HexEdgeRecord[], tileById: Map<string, TileDraft>, settings: HexMapSettings): Map<string, { mask: number; width: number }> {
  const drafts = new Map<string, { mask: number; width: number }>();
  for (const river of riverEdges) {
    const source = drafts.get(river.hexId) ?? { mask: 0, width: 0 };
    source.mask |= directionBit(river.direction);
    source.width = Math.max(source.width, river.width);
    drafts.set(river.hexId, source);

    const sourceTile = tileById.get(river.hexId);
    const neighborAxial = sourceTile ? getNeighborAxial(sourceTile, river.direction, settings) : null;
    const neighborId = neighborAxial ? makeHexId(neighborAxial.q, neighborAxial.r) : null;
    if (!neighborId || !tileById.has(neighborId)) continue;
    const target = drafts.get(neighborId) ?? { mask: 0, width: 0 };
    target.mask |= directionBit(oppositeDirection(river.direction));
    target.width = Math.max(target.width, river.width);
    drafts.set(neighborId, target);
  }
  return drafts;
}

function resolveDistanceToWater(tile: TileDraft, tileById: Map<string, TileDraft>, settings: HexMapSettings): HexDistanceToWater {
  if (tile.waterKind) return 0;
  let frontier: TileDraft[] = [tile];
  const visited = new Set<string>([tile.id]);
  for (let distance = 1; distance <= 3; distance += 1) {
    const next: TileDraft[] = [];
    for (const current of frontier) {
      for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
        const neighborAxial = getNeighborAxial(current, direction as HexDirection, settings);
        const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
        if (!neighbor || visited.has(neighbor.id)) continue;
        if (neighbor.waterKind) return distance as HexDistanceToWater;
        visited.add(neighbor.id);
        next.push(neighbor);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return 3;
}

function directionBit(direction: HexDirection): number {
  return 1 << direction;
}

function oppositeDirection(direction: HexDirection): HexDirection {
  return ((direction + 3) % 6) as HexDirection;
}

function buildRiverEdges(tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): HexEdgeRecord[] {
  const riverEdges = new Map<string, HexEdgeRecord>();
  const candidates = tiles
    .filter((tile) => !tile.waterKind && tile.elevation > settings.mountains - 0.05)
    .filter((tile, index) => index % Math.max(6, Math.round(20 - settings.rivers * 12)) === 0)
    .sort((a, b) => b.elevation - a.elevation)
    .slice(0, Math.max(24, Math.round(settings.width * settings.height * 0.0024)));

  for (const source of candidates) {
    let current = source;
    const visited = new Set<string>();
    const maxLength = 18 + Math.round(source.elevation * 28);
    for (let step = 0; step < maxLength; step += 1) {
      visited.add(current.id);
      const downhill = getDownhillNeighbor(current, tileById, settings, visited);
      if (!downhill) break;
      const key = `${current.id}:${downhill.direction}`;
      riverEdges.set(key, {
        hexId: current.id,
        direction: downhill.direction,
        width: Math.min(3.4, 1 + step / 12),
      });
      current = downhill.tile;
      if (current.waterKind) break;
    }
  }

  return [...riverEdges.values()];
}

function getDownhillNeighbor(
  tile: TileDraft,
  tileById: Map<string, TileDraft>,
  settings: HexMapSettings,
  visited: Set<string>,
): { tile: TileDraft; direction: HexDirection } | null {
  let best: { tile: TileDraft; direction: HexDirection; score: number } | null = null;
  for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
    const neighborAxial = getNeighborAxial(tile, direction as HexDirection, settings);
    const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
    if (!neighbor || visited.has(neighbor.id)) continue;
    const waterBonus = neighbor.waterKind ? -0.22 : 0;
    const score = neighbor.elevation + neighbor.moisture * 0.08 + waterBonus;
    if (!best || score < best.score) {
      best = { tile: neighbor, direction: direction as HexDirection, score };
    }
  }
  return best && best.score <= tile.elevation + 0.06 ? best : null;
}

function assignRegions(tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): void {
  const queue: TileDraft[] = [];
  const counters = { land: 0, water: 0 };
  for (const start of tiles) {
    if (start.regionId) continue;
    const groupKind = start.waterKind ? "water" : "land";
    const targetSize = groupKind === "land" ? settings.targetLandRegionSize : settings.targetWaterRegionSize;
    const regionId: HexRegionId = `region:${groupKind}:${counters[groupKind]}`;
    counters[groupKind] += 1;
    queue.length = 0;
    queue.push(start);
    start.regionId = regionId;
    let cursor = 0;
    while (cursor < queue.length && queue.length < targetSize) {
      const current = queue[cursor];
      cursor += 1;
      for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
        const neighborAxial = getNeighborAxial(current, direction as HexDirection, settings);
        const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
        if (!neighbor || neighbor.regionId) continue;
        if ((neighbor.waterKind ? "water" : "land") !== groupKind) continue;
        neighbor.regionId = regionId;
        queue.push(neighbor);
        if (queue.length >= targetSize) break;
      }
    }
  }
}

function normalizedNoise(value: number): number {
  return (value + 1) / 2;
}

function roundMetric(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
