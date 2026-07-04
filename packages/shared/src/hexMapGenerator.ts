import { createNoise2D } from "simplex-noise";
import type {
  HexBiome,
  HexChunkId,
  HexCoastOverlayRecord,
  HexDirection,
  HexDistanceToWater,
  HexEdgeRecord,
  HexFeature,
  HexMapTag,
  HexMapArtifact,
  HexMapScript,
  HexMapSettings,
  HexMoistureBand,
  HexRegionId,
  HexTemperatureBand,
  HexTerrain,
  HexTile,
  HexWaterKind,
} from "./contracts/hex-map";
import { getNeighborAxial, HEX_DIRECTIONS, makeHexId } from "./hexGeometry";

type TileDraft = Omit<HexTile, "regionId"> & { regionId: HexRegionId | null; landmassId: number | null; isHomeland: boolean; isIsland: boolean };

type LandmassSeed = {
  id: number;
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  weight: number;
  island: boolean;
};

export const DEFAULT_HEX_MAP_SETTINGS: HexMapSettings = {
  seed: "arcanorum-main-world-v2",
  width: 360,
  height: 160,
  hexSize: 18,
  chunkSize: 20,
  wrapX: false,
  generation: {
    mapScript: "continents",
    landmasses: {
      majorContinents: { min: 2, max: 4 },
      landRatio: 0.48,
      islandDensity: "medium",
    },
    climate: {
      preset: "earthlike",
      temperature: "temperate",
      rainfall: "balanced",
    },
    rivers: {
      density: "rare",
      navigable: true,
      crossingPenalty: 1,
    },
    regions: {
      targetLandRegionSize: 74,
      targetWaterRegionSize: 140,
    },
    tags: {
      enabled: true,
    },
  },
};

export function generateHexMap(settings: HexMapSettings = DEFAULT_HEX_MAP_SETTINGS): HexMapArtifact {
  const normalizedSettings = normalizeHexMapSettings(settings);
  const random = seededRandom(normalizedSettings.seed);
  const elevationNoise = createNoise2D(random);
  const moistureNoise = createNoise2D(random);
  const temperatureNoise = createNoise2D(random);
  const featureNoise = createNoise2D(random);
  const seeds = buildLandmassSeeds(normalizedSettings, random);
  const homelandSeedId = selectHomelandSeedId(seeds);
  const tiles: TileDraft[] = [];
  const tileById = new Map<string, TileDraft>();

  for (let r = 0; r < normalizedSettings.height; r += 1) {
    for (let q = 0; q < normalizedSettings.width; q += 1) {
      const normalizedX = normalizedSettings.width <= 1 ? 0 : q / (normalizedSettings.width - 1);
      const normalizedY = normalizedSettings.height <= 1 ? 0 : r / (normalizedSettings.height - 1);
      const latitude = Math.abs(normalizedY - 0.5) * 2;
      const landScore = resolveLandScore(normalizedX, normalizedY, seeds, elevationNoise);
      const nearestSeed = resolveNearestLandmassSeed(normalizedX, normalizedY, seeds);
      const elevation = clamp01(
        landScore * 0.72 +
          normalizedNoise(elevationNoise(q / 31, r / 31)) * 0.18 +
          normalizedNoise(elevationNoise(q / 11 - 7, r / 11 + 3)) * 0.1 -
          latitude * 0.07,
      );
      const waterKind = resolveWaterKind(landScore, elevation);
      const moisture = resolveMoisture(q, r, moistureNoise, normalizedSettings, waterKind);
      const temperature = resolveTemperature(q, r, latitude, elevation, temperatureNoise, normalizedSettings);
      const terrain = resolveTerrain(elevation, moisture, temperature, waterKind);
      const feature = resolveFeature(terrain, moisture, temperature, normalizedNoise(featureNoise(q / 15, r / 15)));
      const temperatureBand = resolveTemperatureBand(temperature);
      const moistureBand = resolveMoistureBand(moisture);
      const id = makeHexId(q, r);
      const isLand = waterKind == null;
      const landmassId = isLand ? nearestSeed?.id ?? null : null;
      const isIsland = isLand && nearestSeed?.island === true;
      const isHomeland = isLand && landmassId === homelandSeedId && !isIsland;
      const tile: TileDraft = {
        id,
        q,
        r,
        chunkId: makeChunkId(q, r, normalizedSettings),
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
        mapTags: [],
        movementCost: resolveMovementCost(terrain, feature, waterKind),
        passable: waterKind !== "ocean",
        landmassId,
        isHomeland,
        isIsland,
      };
      tiles.push(tile);
      tileById.set(id, tile);
    }
  }

  const coastOverlays = buildCoastOverlays(tiles, tileById, normalizedSettings);
  let riverEdges = buildRiverEdges(tiles, tileById, normalizedSettings);
  applyHydrologyMetadata(tiles, tileById, coastOverlays, riverEdges, normalizedSettings);
  riverEdges = classifyRiverEdges(riverEdges, tiles, tileById, normalizedSettings);
  applyHydrologyMetadata(tiles, tileById, coastOverlays, riverEdges, normalizedSettings);
  assignRegions(tiles, tileById, normalizedSettings);
  applyMapTags(tiles);

  return {
    version: 1,
    settings: normalizedSettings,
    tiles: tiles.map(({ landmassId: _landmassId, isHomeland: _isHomeland, isIsland: _isIsland, ...tile }) => ({
      ...tile,
      regionId: tile.regionId ?? "region:hex_0_0",
    })),
    riverEdges,
    coastOverlays,
  };
}

export function enrichHexMapVisualMetadata(artifact: HexMapArtifact): HexMapArtifact {
  const settings = normalizeHexMapSettings(artifact.settings);
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
      mapTags: tile.mapTags ?? [],
      regionId: tile.regionId ?? "region:hex_0_0",
      landmassId: null,
      isHomeland: tile.mapTags?.includes("continent:homeland") ?? false,
      isIsland: tile.mapTags?.includes("landmass:island") ?? false,
    };
  });
  const tileById = new Map<string, TileDraft>(tiles.map((tile) => [tile.id, tile]));
  applyHydrologyMetadata(tiles, tileById, artifact.coastOverlays, artifact.riverEdges, settings);
  applyMapTags(tiles);
  return {
    ...artifact,
    settings,
    tiles: tiles.map(({ landmassId: _landmassId, isHomeland: _isHomeland, isIsland: _isIsland, ...tile }) => ({
      ...tile,
      regionId: tile.regionId ?? "region:hex_0_0",
    })),
  };
}

function normalizeHexMapSettings(settings: HexMapSettings): HexMapSettings {
  return {
    ...DEFAULT_HEX_MAP_SETTINGS,
    ...settings,
    wrapX: false,
    generation: {
      ...DEFAULT_HEX_MAP_SETTINGS.generation,
      ...(settings.generation ?? {}),
      landmasses: {
        ...DEFAULT_HEX_MAP_SETTINGS.generation.landmasses,
        ...(settings.generation?.landmasses ?? {}),
      },
      climate: {
        ...DEFAULT_HEX_MAP_SETTINGS.generation.climate,
        ...(settings.generation?.climate ?? {}),
      },
      rivers: {
        ...DEFAULT_HEX_MAP_SETTINGS.generation.rivers,
        ...(settings.generation?.rivers ?? {}),
      },
      regions: {
        ...DEFAULT_HEX_MAP_SETTINGS.generation.regions,
        ...(settings.generation?.regions ?? {}),
      },
      tags: {
        ...DEFAULT_HEX_MAP_SETTINGS.generation.tags,
        ...(settings.generation?.tags ?? {}),
      },
    },
  };
}

function buildLandmassSeeds(settings: HexMapSettings, random: () => number): LandmassSeed[] {
  const script = settings.generation.mapScript;
  const majorCount = resolveMajorLandmassCount(script, settings.generation.landmasses.majorContinents, random);
  const seeds: LandmassSeed[] = [];
  if (script === "pangaea") {
    seeds.push({ id: 0, x: 0.5, y: 0.52, radiusX: 0.34, radiusY: 0.34, weight: 1.2, island: false });
  } else {
    for (let index = 0; index < majorCount; index += 1) {
      const band = (index + 0.5) / majorCount;
      seeds.push({
        id: index,
        x: clamp01(band + (random() - 0.5) * 0.18),
        y: clamp01(0.28 + random() * 0.44),
        radiusX: script === "archipelago" ? 0.12 + random() * 0.08 : 0.2 + random() * 0.13,
        radiusY: script === "archipelago" ? 0.12 + random() * 0.08 : 0.22 + random() * 0.12,
        weight: script === "archipelago" ? 0.74 : 1,
        island: false,
      });
    }
  }
  const islandCount = resolveIslandCount(script, settings.generation.landmasses.islandDensity);
  for (let index = 0; index < islandCount; index += 1) {
    seeds.push({
      id: seeds.length,
      x: random(),
      y: 0.12 + random() * 0.76,
      radiusX: 0.035 + random() * (script === "archipelago" ? 0.08 : 0.045),
      radiusY: 0.035 + random() * (script === "archipelago" ? 0.08 : 0.045),
      weight: script === "archipelago" ? 0.82 : 0.62,
      island: true,
    });
  }
  return seeds;
}

function resolveMajorLandmassCount(script: HexMapScript, range: { min: number; max: number }, random: () => number): number {
  if (script === "pangaea") return 1;
  if (script === "archipelago") return Math.max(3, range.max);
  const min = Math.max(2, Math.floor(range.min));
  const max = Math.max(min, Math.floor(range.max));
  return min + Math.floor(random() * (max - min + 1));
}

function resolveIslandCount(script: HexMapScript, density: "low" | "medium" | "high"): number {
  const base = density === "high" ? 28 : density === "low" ? 8 : 16;
  if (script === "archipelago") return base * 2;
  if (script === "pangaea") return Math.round(base * 0.75);
  return base;
}

function resolveLandScore(x: number, y: number, seeds: LandmassSeed[], noise: ReturnType<typeof createNoise2D>): number {
  let best = 0;
  for (const seed of seeds) {
    const dx = (x - seed.x) / seed.radiusX;
    const dy = (y - seed.y) / seed.radiusY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const score = (1 - distance) * seed.weight;
    best = Math.max(best, score);
  }
  const ragged = normalizedNoise(noise(x * 8 + 4, y * 8 - 7)) * 0.24 + normalizedNoise(noise(x * 27 - 3, y * 27 + 9)) * 0.1;
  return best + ragged;
}

function resolveNearestLandmassSeed(x: number, y: number, seeds: LandmassSeed[]): LandmassSeed | null {
  let best: { seed: LandmassSeed; distance: number } | null = null;
  for (const seed of seeds) {
    const distance = ((x - seed.x) / seed.radiusX) ** 2 + ((y - seed.y) / seed.radiusY) ** 2;
    if (!best || distance < best.distance) best = { seed, distance };
  }
  return best?.seed ?? null;
}

function selectHomelandSeedId(seeds: LandmassSeed[]): number | null {
  const continents = seeds.filter((seed) => !seed.island);
  const largest = continents.sort((a, b) => b.radiusX * b.radiusY * b.weight - a.radiusX * a.radiusY * a.weight)[0];
  return largest?.id ?? null;
}

function makeChunkId(q: number, r: number, settings: HexMapSettings): HexChunkId {
  return `hex-chunk:${Math.floor(q / settings.chunkSize)}:${Math.floor(r / settings.chunkSize)}`;
}

function resolveWaterKind(landScore: number, elevation: number): HexWaterKind {
  if (landScore < 0.28) return "ocean";
  if (landScore < 0.38 || elevation < 0.32) return "sea";
  return null;
}

function resolveMoisture(q: number, r: number, noise: ReturnType<typeof createNoise2D>, settings: HexMapSettings, waterKind: HexWaterKind): number {
  const climateBias = settings.generation.climate.rainfall === "wet" ? 0.18 : settings.generation.climate.rainfall === "dry" ? -0.14 : 0;
  return clamp01(normalizedNoise(noise(q / 34 + 3, r / 34 - 3)) * 0.62 + normalizedNoise(noise(q / 90 - 11, r / 90 + 4)) * 0.28 + (waterKind ? 0.08 : 0) + climateBias);
}

function resolveTemperature(q: number, r: number, latitude: number, elevation: number, noise: ReturnType<typeof createNoise2D>, settings: HexMapSettings): number {
  const climateBias = settings.generation.climate.temperature === "hot" ? 0.12 : settings.generation.climate.temperature === "cold" ? -0.12 : 0;
  return clamp01((1 - latitude) * 0.68 + normalizedNoise(noise(q / 68 - 6, r / 68 + 18)) * 0.16 - Math.max(0, elevation - 0.65) * 0.24 + climateBias);
}

function resolveTerrain(elevation: number, moisture: number, temperature: number, waterKind: HexWaterKind): HexTerrain {
  if (waterKind === "ocean") return "ocean";
  if (waterKind === "sea") return "sea";
  if (waterKind === "lake") return "lake";
  if (elevation > 0.86) return temperature < 0.22 ? "snow" : "mountains";
  if (elevation > 0.68) return "hills";
  if (temperature < 0.18) return "tundra";
  if (temperature > 0.62 && moisture < 0.32) return "desert";
  if (moisture > 0.78 && elevation < 0.48) return "wetland";
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

function resolveFeature(terrain: HexTerrain, moisture: number, temperature: number, noise: number): HexFeature {
  if (terrain === "ocean" || terrain === "sea" || terrain === "lake" || terrain === "desert") return "none";
  if (terrain === "snow" || terrain === "mountains") return noise > 0.84 ? "snowcap" : "none";
  if (terrain === "wetland") return noise > 0.42 ? "marsh" : "none";
  if (temperature > 0.64 && moisture > 0.58 && noise > 0.54) return "jungle";
  if (moisture > 0.52 && noise > 0.58) return noise > 0.86 ? "dense_forest" : "forest";
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
        overlays.push({ hexId: tile.id, direction: direction as HexDirection, strength: neighbor.waterKind === "ocean" ? 0.82 : neighbor.waterKind === "lake" ? 0.92 : 0.58 });
      }
    }
  }
  return overlays;
}

function applyHydrologyMetadata(tiles: TileDraft[], tileById: Map<string, TileDraft>, coastOverlays: HexCoastOverlayRecord[], riverEdges: HexEdgeRecord[], settings: HexMapSettings): void {
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
    source.mask |= 1 << river.direction;
    source.width = Math.max(source.width, river.width);
    drafts.set(river.hexId, source);
    const sourceTile = tileById.get(river.hexId);
    const neighborAxial = sourceTile ? getNeighborAxial(sourceTile, river.direction, settings) : null;
    const neighborId = neighborAxial ? makeHexId(neighborAxial.q, neighborAxial.r) : null;
    if (!neighborId || !tileById.has(neighborId)) continue;
    const target = drafts.get(neighborId) ?? { mask: 0, width: 0 };
    target.mask |= 1 << (((river.direction + 3) % 6) as HexDirection);
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

function buildRiverEdges(tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): HexEdgeRecord[] {
  const edges = new Map<string, HexEdgeRecord>();
  const densityFactor = settings.generation.rivers.density === "many" ? 0.004 : settings.generation.rivers.density === "normal" ? 0.002 : 0.0009;
  const candidates = tiles
    .filter((tile) => !tile.waterKind && tile.elevation > 0.68)
    .sort((a, b) => b.elevation - a.elevation || a.id.localeCompare(b.id))
    .slice(0, Math.max(4, Math.round(settings.width * settings.height * densityFactor)));
  for (const source of candidates) {
    let current = source;
    const visited = new Set<string>();
    const maxLength = 28 + Math.round(source.elevation * 42);
    for (let step = 0; step < maxLength; step += 1) {
      visited.add(current.id);
      const downhill = getDownhillNeighbor(current, tileById, settings, visited);
      if (!downhill) break;
      const width = Math.min(5, 1 + step / 8);
      edges.set(`${current.id}:${downhill.direction}`, { hexId: current.id, direction: downhill.direction, width });
      current = downhill.tile;
      if (current.waterKind) break;
    }
  }
  return [...edges.values()];
}

function classifyRiverEdges(riverEdges: HexEdgeRecord[], tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): HexEdgeRecord[] {
  if (!settings.generation.rivers.navigable) return riverEdges.map((edge) => ({ ...edge, riverClass: edge.width >= 3 ? "major" : "minor", navigable: false, crossingCost: edge.width >= 3 ? settings.generation.rivers.crossingPenalty : 0 }));
  const coastalIds = new Set(tiles.filter((tile) => tile.isCoastal || tile.waterKind).map((tile) => tile.id));
  return riverEdges.map((edge) => {
    const source = tileById.get(edge.hexId);
    const targetAxial = source ? getNeighborAxial(source, edge.direction, settings) : null;
    const targetId = targetAxial ? makeHexId(targetAxial.q, targetAxial.r) : null;
    const nearMouth = coastalIds.has(edge.hexId) || (targetId ? coastalIds.has(targetId) : false);
    const navigable = edge.width >= 3.2 || (edge.width >= 2.4 && nearMouth);
    const riverClass = navigable ? "navigable" : edge.width >= 2.2 ? "major" : "minor";
    return {
      ...edge,
      riverClass,
      navigable,
      crossingCost: riverClass === "major" || riverClass === "navigable" ? settings.generation.rivers.crossingPenalty : 0,
    };
  });
}

function getDownhillNeighbor(tile: TileDraft, tileById: Map<string, TileDraft>, settings: HexMapSettings, visited: Set<string>): { tile: TileDraft; direction: HexDirection } | null {
  let best: { tile: TileDraft; direction: HexDirection; score: number } | null = null;
  for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
    const neighborAxial = getNeighborAxial(tile, direction as HexDirection, settings);
    const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
    if (!neighbor || visited.has(neighbor.id)) continue;
    const waterBonus = neighbor.waterKind ? -0.28 : 0;
    const score = neighbor.elevation + neighbor.moisture * 0.08 + waterBonus;
    if (!best || score < best.score) best = { tile: neighbor, direction: direction as HexDirection, score };
  }
  return best && best.score <= tile.elevation + 0.08 ? best : null;
}

function assignRegions(tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): void {
  const queue: TileDraft[] = [];
  for (const start of tiles) {
    if (start.regionId) continue;
    const groupKind = start.waterKind ? "water" : "land";
    const targetSize = groupKind === "land" ? settings.generation.regions.targetLandRegionSize : settings.generation.regions.targetWaterRegionSize;
    const regionId: HexRegionId = `region:hex_${start.q}_${start.r}`;
    queue.length = 0;
    queue.push(start);
    start.regionId = regionId;
    let cursor = 0;
    while (cursor < queue.length && queue.length < targetSize) {
      const current = queue[cursor]!;
      cursor += 1;
      const directions = [...HEX_DIRECTIONS.keys()] as HexDirection[];
      directions.sort((left, right) => regionNeighborScore(current, left, tileById, settings) - regionNeighborScore(current, right, tileById, settings));
      for (const direction of directions) {
        const neighborAxial = getNeighborAxial(current, direction, settings);
        const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
        if (!neighbor || neighbor.regionId) continue;
        if ((neighbor.waterKind ? "water" : "land") !== groupKind) continue;
        if (neighbor.landmassId !== current.landmassId) continue;
        if (neighbor.isHomeland !== current.isHomeland) continue;
        neighbor.regionId = regionId;
        queue.push(neighbor);
        if (queue.length >= targetSize) break;
      }
    }
  }
}

function regionNeighborScore(tile: TileDraft, direction: HexDirection, tileById: Map<string, TileDraft>, settings: HexMapSettings): number {
  const neighborAxial = getNeighborAxial(tile, direction, settings);
  const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
  if (!neighbor) return 999;
  let score = Math.abs(tile.elevation - neighbor.elevation) + Math.abs(tile.moisture - neighbor.moisture) * 0.5;
  if (tile.terrain === "mountains" || neighbor.terrain === "mountains") score += 0.7;
  if (tile.riverMask & (1 << direction)) score += 0.5;
  return score;
}

function applyMapTags(tiles: TileDraft[]): void {
  for (const tile of tiles) {
    const tags = new Set<HexMapTag>();
    tags.add(tile.waterKind ? "fertility:barren" : fertilityTag(tile));
    tags.add(rainfallTag(tile.moisture));
    tags.add(slopeTag(tile.elevation, tile.terrain));
    tags.add(latitudeTag(tile.r, tiles));
    tags.add(elevationTag(tile.elevation));
    tags.add(tile.waterKind ? "coast:inland" : tile.isCoastal ? "coast:coastal" : "coast:inland");
    if (!tile.waterKind) {
      tags.add(tile.isIsland ? "landmass:island" : "landmass:continent");
      if (!tile.isIsland) tags.add(tile.isHomeland ? "continent:homeland" : "continent:distant");
    }
    if (tile.riverMask > 0) tags.add(tile.riverWidth >= 3 ? "river:navigable" : tile.riverWidth >= 2 ? "river:major" : "river:minor");
    if (tile.riverMask > 0 && tile.elevation > 0.68) tags.add("basin:headwater");
    if (tile.riverWidth >= 3) tags.add(tile.distanceToWater <= 1 ? "basin:delta" : "basin:mainstem");
    tile.mapTags = [...tags].sort();
  }
}

function fertilityTag(tile: TileDraft): HexMapTag {
  if (tile.terrain === "desert" || tile.terrain === "snow" || tile.terrain === "mountains") return "fertility:poor";
  if (tile.terrain === "wetland" || tile.biome === "tropical_rainforest") return "fertility:rich";
  if (tile.terrain === "grassland" && tile.moisture > 0.55) return "fertility:fertile";
  if (tile.terrain === "plains" || tile.terrain === "grassland") return "fertility:modest";
  return "fertility:poor";
}

function rainfallTag(moisture: number): HexMapTag {
  if (moisture < 0.18) return "rainfall:arid";
  if (moisture < 0.38) return "rainfall:dry";
  if (moisture < 0.64) return "rainfall:moderate";
  if (moisture < 0.84) return "rainfall:wet";
  return "rainfall:monsoon";
}

function slopeTag(elevation: number, terrain: HexTerrain): HexMapTag {
  if (terrain === "mountains" || terrain === "snow") return "slope:rugged";
  if (terrain === "hills" || elevation > 0.68) return "slope:steep";
  if (elevation > 0.54) return "slope:hilly";
  if (elevation > 0.4) return "slope:rolling";
  return "slope:flat";
}

function latitudeTag(r: number, tiles: TileDraft[]): HexMapTag {
  const maxR = Math.max(1, Math.max(...tiles.map((tile) => tile.r)));
  const latitude = Math.abs(r / maxR - 0.5) * 2;
  if (latitude > 0.86) return "latitude:polar";
  if (latitude > 0.68) return "latitude:subpolar";
  if (latitude > 0.42) return "latitude:temperate";
  if (latitude > 0.22) return "latitude:subtropical";
  return "latitude:tropical";
}

function elevationTag(elevation: number): HexMapTag {
  if (elevation < 0.38) return "elevation:lowland";
  if (elevation < 0.56) return "elevation:upland";
  if (elevation < 0.72) return "elevation:highland";
  if (elevation < 0.88) return "elevation:mountain";
  return "elevation:peak";
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
