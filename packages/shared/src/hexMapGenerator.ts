import { Delaunay } from "d3-delaunay";
import FlatQueue from "flatqueue";
import { createNoise2D } from "simplex-noise";
import type {
  HexChunkId,
  HexCoastOverlayRecord,
  HexDirection,
  HexDistanceToWater,
  HexEdgeRecord,
  HexId,
  HexMapArtifact,
  HexMapRange,
  HexMapScript,
  HexMapSettings,
  HexMapTag,
  HexMoistureBand,
  HexRegionId,
  HexTemperatureBand,
  HexTile,
  HexWaterKind,
} from "./contracts/hex-map";
import { axialDistance, getNeighborAxial, HEX_DIRECTIONS, makeHexId } from "./hexGeometry";

type InternalTerrain = "ocean" | "sea" | "lake" | "plains" | "grassland" | "hills" | "mountains" | "desert" | "tundra" | "snow" | "wetland";
type InternalFeature = "none" | "forest" | "dense_forest" | "jungle" | "marsh" | "scrub" | "snowcap";
type CivBiome = "tundra" | "grassland" | "plains" | "desert" | "tropical";
type Morphology = "flat" | "rough" | "mountainous";

type TileDraft = Omit<HexTile, "regionId"> & {
  regionId: HexRegionId | null;
  landmassId: number | null;
  isHomeland: boolean;
  isIsland: boolean;
  internalTerrain: InternalTerrain;
  internalFeature: InternalFeature;
  civBiome: CivBiome;
  morphology: Morphology;
};

type LandmassSeed = {
  id: number;
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  weight: number;
  island: boolean;
};

type LandmassSeedDraft = Omit<LandmassSeed, "id">;

type TectonicPlateSeed = {
  id: number;
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  weight: number;
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
      majorContinentSize: { min: 4_200, max: 7_200 },
      landRatio: 0.48,
      islandDensity: "medium",
      islandSize: { min: 18, max: 220 },
      edgeOceanMargin: { min: 5, max: 8 },
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
  const tectonicPlates = buildTectonicPlateSeeds(normalizedSettings, random);
  const seedPoints = seeds.map((seed) => [seed.x, seed.y] as [number, number]);
  const delaunay = seedPoints.length > 0 ? Delaunay.from(seedPoints) : null;
  const homelandSeedId = selectHomelandSeedId(seeds);
  const edgeOceanMargin = resolveEdgeOceanMargin(normalizedSettings.generation.landmasses.edgeOceanMargin, random);
  const tiles: TileDraft[] = [];
  const tileById = new Map<string, TileDraft>();

  for (let r = 0; r < normalizedSettings.height; r += 1) {
    for (let q = 0; q < normalizedSettings.width; q += 1) {
      const normalizedX = normalizedSettings.width <= 1 ? 0 : q / (normalizedSettings.width - 1);
      const normalizedY = normalizedSettings.height <= 1 ? 0 : r / (normalizedSettings.height - 1);
      const latitude = Math.abs(normalizedY - 0.5) * 2;
      const dominantSeed = resolveDominantLandmassSeed(normalizedX, normalizedY, seeds, delaunay);
      const landScore = resolveLandScore(normalizedX, normalizedY, seeds, elevationNoise, normalizedSettings, edgeOceanMargin);
      const tectonicUplift = resolveTectonicUplift(normalizedX, normalizedY, tectonicPlates);
      const elevation = clamp01(
        landScore * 0.72 +
          normalizedNoise(elevationNoise(q / 31, r / 31)) * 0.18 +
          normalizedNoise(elevationNoise(q / 11 - 7, r / 11 + 3)) * 0.1 -
          latitude * 0.07 +
          tectonicUplift * 0.14,
      );
      const waterKind = resolveWaterKind(landScore, elevation);
      const moisture = resolveMoisture(q, r, moistureNoise, normalizedSettings, waterKind);
      const temperature = resolveTemperature(q, r, latitude, elevation, temperatureNoise, normalizedSettings);
      const internalTerrain = resolveInternalTerrain(elevation, moisture, temperature, waterKind);
      const internalFeature = resolveInternalFeature(internalTerrain, moisture, temperature, normalizedNoise(featureNoise(q / 15, r / 15)));
      const civBiome = resolveCivBiome(internalTerrain, internalFeature, moisture, temperature);
      const morphology = resolveMorphology(internalTerrain, elevation);
      const id = makeHexId(q, r);
      const isLand = waterKind == null;
      const landmassId = isLand ? dominantSeed?.id ?? null : null;
      const isIsland = isLand && dominantSeed?.island === true;
      const isHomeland = isLand && landmassId === homelandSeedId && !isIsland;
      const tile: TileDraft = {
        id,
        q,
        r,
        chunkId: makeChunkId(q, r, normalizedSettings),
        regionId: null,
        waterKind,
        elevation: roundMetric(elevation),
        moisture: roundMetric(moisture),
        temperature: roundMetric(temperature),
        temperatureBand: resolveTemperatureBand(temperature),
        moistureBand: resolveMoistureBand(moisture),
        distanceToWater: waterKind ? 0 : 3,
        isCoastal: false,
        riverMask: 0,
        riverWidth: 0,
        mapTags: [],
        movementCost: 1,
        passable: waterKind !== "ocean",
        landmassId,
        isHomeland,
        isIsland,
        internalTerrain,
        internalFeature,
        civBiome,
        morphology,
      };
      tiles.push(tile);
      tileById.set(id, tile);
    }
  }

  applyTerrainErosionSmoothing(tiles, tileById, normalizedSettings);
  separateIslandsFromContinents(tiles, tileById, normalizedSettings);
  addInlandLakes(tiles, tileById, normalizedSettings);
  promoteNearLandSeasToCoastalWater(tiles, tileById, normalizedSettings);
  const coastOverlays = buildCoastOverlays(tiles, tileById, normalizedSettings);
  let riverEdges = buildRiverEdges(tiles, tileById, normalizedSettings);
  applyHydrologyMetadata(tiles, tileById, riverEdges, normalizedSettings);
  riverEdges = classifyRiverEdges(riverEdges, tiles, tileById, normalizedSettings);
  applyHydrologyMetadata(tiles, tileById, riverEdges, normalizedSettings);
  applyMapTags(tiles, riverEdges, normalizedSettings);
  assignRegions(tiles, tileById, normalizedSettings);
  assignCoastalWaterToLandRegions(tiles, tileById, normalizedSettings);
  refreshMovementMetadata(tiles);

  return {
    version: 1,
    settings: normalizedSettings,
    tiles: tiles.map(stripInternalTile),
    riverEdges,
    coastOverlays,
  };
}

export function enrichHexMapVisualMetadata(artifact: HexMapArtifact): HexMapArtifact {
  const settings = normalizeHexMapSettings(artifact.settings);
  const tiles: TileDraft[] = artifact.tiles.map((tile) => ({
    ...tile,
    temperatureBand: tile.temperatureBand ?? resolveTemperatureBand(tile.temperature),
    moistureBand: tile.moistureBand ?? resolveMoistureBand(tile.moisture),
    distanceToWater: tile.distanceToWater ?? (tile.waterKind ? 0 : 3),
    isCoastal: tile.isCoastal ?? false,
    riverMask: tile.riverMask ?? 0,
    riverWidth: tile.riverWidth ?? 0,
    mapTags: tile.mapTags ?? [],
    regionId: tile.regionId ?? "region:hex_0_0",
    landmassId: null,
    isHomeland: tile.mapTags?.includes("continent:homeland") ?? false,
    isIsland: tile.mapTags?.includes("landmass:island") ?? false,
    internalTerrain: internalTerrainFromTags(tile),
    internalFeature: internalFeatureFromTags(tile.mapTags ?? []),
    civBiome: civBiomeFromTags(tile.mapTags ?? []),
    morphology: morphologyFromTags(tile.mapTags ?? []),
  }));
  const tileById = new Map<string, TileDraft>(tiles.map((tile) => [tile.id, tile]));
  applyHydrologyMetadata(tiles, tileById, artifact.riverEdges, settings);
  applyMapTags(tiles, artifact.riverEdges, settings);
  refreshMovementMetadata(tiles);
  return {
    ...artifact,
    settings,
    tiles: tiles.map(stripInternalTile),
  };
}

function stripInternalTile(tile: TileDraft): HexTile {
  const {
    landmassId: _landmassId,
    isHomeland: _isHomeland,
    isIsland: _isIsland,
    internalTerrain: _internalTerrain,
    internalFeature: _internalFeature,
    civBiome: _civBiome,
    morphology: _morphology,
    ...publicTile
  } = tile;
  return {
    ...publicTile,
    regionId: publicTile.regionId ?? "region:hex_0_0",
    mapTags: [...publicTile.mapTags].sort(),
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
  const totalTiles = Math.max(1, settings.width * settings.height);
  const seeds: LandmassSeed[] = [];
  if (script === "pangaea") {
    const radius = resolveSeedRadiusFromHexSize(settings.generation.landmasses.majorContinentSize, totalTiles, random, 1.15, 0.56, { radiusX: 0.3, radiusY: 0.31 }, script);
    seeds.push({ id: 0, x: 0.5, y: 0.52, radiusX: radius.radiusX, radiusY: radius.radiusY, weight: 1.2, island: false });
  } else {
    for (let index = 0; index < majorCount; index += 1) {
      const band = (index + 0.5) / majorCount;
      const fallbackRadius = {
        radiusX: script === "archipelago" ? 0.1 + random() * 0.07 : 0.17 + random() * 0.11,
        radiusY: script === "archipelago" ? 0.1 + random() * 0.07 : 0.2 + random() * 0.1,
      };
      const radius = resolveSeedRadiusFromHexSize(settings.generation.landmasses.majorContinentSize, totalTiles, random, script === "archipelago" ? 0.86 : 1, script === "archipelago" ? 0.14 : 0.24, fallbackRadius, script);
      const seed = placeLandmassSeedWithSpacing(seeds, script, false, () => ({
        x: clamp01(0.12 + band * 0.76 + (random() - 0.5) * 0.12),
        y: clamp01(0.26 + random() * 0.46),
        radiusX: radius.radiusX,
        radiusY: radius.radiusY,
        weight: script === "archipelago" ? 0.76 : 1,
        island: false,
      }));
      seeds.push({ id: index, ...seed });
    }
  }
  const islandCount = resolveIslandCount(script, settings.generation.landmasses.islandDensity);
  for (let index = 0; index < islandCount; index += 1) {
    const fallbackRadius = {
      radiusX: 0.022 + random() * (script === "archipelago" ? 0.053 : 0.026),
      radiusY: 0.022 + random() * (script === "archipelago" ? 0.053 : 0.026),
    };
    const radius = resolveSeedRadiusFromHexSize(settings.generation.landmasses.islandSize, totalTiles, random, script === "archipelago" ? 0.78 : 0.64, script === "archipelago" ? 0.055 : 0.032, fallbackRadius, script);
    const seed = placeLandmassSeedWithSpacing(seeds, script, true, () => ({
      x: 0.08 + random() * 0.84,
      y: 0.1 + random() * 0.8,
      radiusX: radius.radiusX,
      radiusY: radius.radiusY,
      weight: script === "archipelago" ? 0.84 : 0.6,
      island: true,
    }));
    seeds.push({ id: seeds.length, ...seed });
  }
  return seeds;
}

function placeLandmassSeedWithSpacing(
  existingSeeds: readonly LandmassSeed[],
  script: HexMapScript,
  island: boolean,
  createCandidate: () => LandmassSeedDraft,
): LandmassSeedDraft {
  let best: { seed: LandmassSeedDraft; spacing: number } | null = null;
  const attempts = island ? 36 : 24;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = createCandidate();
    const spacing = minimumLandmassSeedSpacing(candidate, existingSeeds, script);
    if (!best || spacing > best.spacing) best = { seed: candidate, spacing };
    if (spacing >= targetLandmassSeedSpacing(candidate, existingSeeds, script)) return candidate;
  }
  return best?.seed ?? createCandidate();
}

function minimumLandmassSeedSpacing(candidate: LandmassSeedDraft, existingSeeds: readonly LandmassSeed[], script: HexMapScript): number {
  if (existingSeeds.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...existingSeeds.map((seed) => landmassSeedClearance(candidate, seed, script)));
}

function targetLandmassSeedSpacing(candidate: LandmassSeedDraft, existingSeeds: readonly LandmassSeed[], script: HexMapScript): number {
  if (existingSeeds.length === 0) return 0;
  return Math.min(...existingSeeds.map((seed) => requiredLandmassSeedClearance(candidate, seed, script)));
}

function landmassSeedClearance(candidate: LandmassSeedDraft, seed: LandmassSeed, script: HexMapScript): number {
  return seedCenterDistance(candidate, seed) - requiredLandmassSeedClearance(candidate, seed, script);
}

function requiredLandmassSeedClearance(candidate: LandmassSeedDraft, seed: LandmassSeed, script: HexMapScript): number {
  const candidateRadius = Math.max(candidate.radiusX, candidate.radiusY);
  const seedRadius = Math.max(seed.radiusX, seed.radiusY);
  const radiusSum = candidateRadius + seedRadius;
  if (candidate.island && !seed.island) return radiusSum * (script === "archipelago" ? 1.02 : 1.18) + 0.028;
  if (!candidate.island && seed.island) return radiusSum * (script === "archipelago" ? 1.02 : 1.18) + 0.028;
  if (candidate.island && seed.island) return radiusSum * 0.72 + 0.016;
  return radiusSum * (script === "archipelago" ? 0.76 : 0.88) + 0.025;
}

function seedCenterDistance(left: Pick<LandmassSeed, "x" | "y">, right: Pick<LandmassSeed, "x" | "y">): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function resolveSeedRadiusFromHexSize(
  size: number | HexMapRange | undefined,
  totalTiles: number,
  random: () => number,
  fillFactor: number,
  maxMapShare: number,
  fallback: { radiusX: number; radiusY: number },
  script: HexMapScript,
): { radiusX: number; radiusY: number } {
  const targetHexes = resolveHexSizeRange(size, random);
  if (targetHexes == null) return fallback;
  const aspect = clamp(0.72 + random() * 0.72, 0.58, 1.58);
  const normalizedArea = Math.min(maxMapShare, Math.max(1, targetHexes) / Math.max(1, totalTiles));
  const baseRadius = Math.sqrt(normalizedArea / Math.max(0.1, Math.PI * fillFactor));
  const scriptScale = script === "archipelago" ? 0.88 : script === "pangaea" ? 1.08 : 1;
  return {
    radiusX: clamp(baseRadius * Math.sqrt(aspect) * scriptScale, 0.012, 0.48),
    radiusY: clamp(baseRadius / Math.sqrt(aspect) * scriptScale, 0.012, 0.48),
  };
}

function resolveHexSizeRange(size: number | HexMapRange | undefined, random: () => number): number | null {
  if (typeof size === "number" && Number.isFinite(size)) return Math.max(1, Math.floor(size));
  if (!size || typeof size !== "object") return null;
  const min = Math.max(1, Math.floor(Number(size.min) || 1));
  const max = Math.max(min, Math.floor(Number(size.max) || min));
  return min + Math.floor(random() * (max - min + 1));
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

function buildTectonicPlateSeeds(settings: HexMapSettings, random: () => number): TectonicPlateSeed[] {
  const totalTiles = Math.max(1, settings.width * settings.height);
  const baseCount = Math.round(clamp(totalTiles / 2600, 8, 30));
  const scriptBonus = settings.generation.mapScript === "archipelago" ? 5 : settings.generation.mapScript === "continents" ? 2 : 0;
  const count = Math.max(6, baseCount + scriptBonus);
  const seeds: TectonicPlateSeed[] = [];
  for (let index = 0; index < count; index += 1) {
    const candidate = placeTectonicPlateSeed(seeds, random);
    const angle = random() * Math.PI * 2;
    seeds.push({
      id: index,
      x: candidate.x,
      y: candidate.y,
      driftX: Math.cos(angle),
      driftY: Math.sin(angle),
      weight: 0.72 + random() * 0.56,
    });
  }
  return seeds;
}

function placeTectonicPlateSeed(existingSeeds: readonly TectonicPlateSeed[], random: () => number): Pick<TectonicPlateSeed, "x" | "y"> {
  let best: { x: number; y: number; spacing: number } | null = null;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const candidate = {
      x: 0.04 + random() * 0.92,
      y: 0.04 + random() * 0.92,
    };
    const spacing = existingSeeds.length
      ? Math.min(...existingSeeds.map((seed) => seedCenterDistance(candidate, seed)))
      : Number.POSITIVE_INFINITY;
    if (!best || spacing > best.spacing) best = { ...candidate, spacing };
    if (spacing >= 0.18) return candidate;
  }
  return best ?? { x: 0.5, y: 0.5 };
}

function resolveTectonicUplift(x: number, y: number, plates: readonly TectonicPlateSeed[]): number {
  if (plates.length < 2) return 0;
  let first: { plate: TectonicPlateSeed; distance: number } | null = null;
  let second: { plate: TectonicPlateSeed; distance: number } | null = null;
  for (const plate of plates) {
    const distance = seedCenterDistance({ x, y }, plate) / plate.weight;
    if (!first || distance < first.distance) {
      second = first;
      first = { plate, distance };
    } else if (!second || distance < second.distance) {
      second = { plate, distance };
    }
  }
  if (!first || !second) return 0;
  const boundaryStrength = clamp01(1 - Math.abs(first.distance - second.distance) / 0.075);
  if (boundaryStrength <= 0) return 0;
  const boundaryVector = normalizeVector({
    x: second.plate.x - first.plate.x,
    y: second.plate.y - first.plate.y,
  });
  const relativeDrift = {
    x: first.plate.driftX - second.plate.driftX,
    y: first.plate.driftY - second.plate.driftY,
  };
  const convergence = clamp01(-dot(relativeDrift, boundaryVector) * 0.5 + 0.5);
  return boundaryStrength * (0.35 + convergence * 0.65);
}

function resolveLandScore(
  x: number,
  y: number,
  seeds: LandmassSeed[],
  noise: ReturnType<typeof createNoise2D>,
  settings: HexMapSettings,
  edgeOceanMargin: number,
): number {
  let best = 0;
  let bestMajor = Number.NEGATIVE_INFINITY;
  let secondMajor = Number.NEGATIVE_INFINITY;
  for (const seed of seeds) {
    const score = seedInfluenceScore(x, y, seed);
    best = Math.max(best, score);
    if (!seed.island) {
      if (score > bestMajor) {
        secondMajor = bestMajor;
        bestMajor = score;
      } else if (score > secondMajor) {
        secondMajor = score;
      }
    }
  }
  const marginX = edgeOceanMargin / Math.max(1, settings.width - 1);
  const marginY = edgeOceanMargin / Math.max(1, settings.height - 1);
  const edgeDistance = Math.min(x, y, 1 - x, 1 - y);
  const edgePenalty = edgeDistance < Math.max(marginX, marginY) ? (1 - edgeDistance / Math.max(marginX, marginY)) * 1.5 : 0;
  const boundaryPenalty = resolveMajorLandmassBoundaryPenalty(bestMajor, secondMajor, settings.generation.mapScript);
  const ragged = normalizedNoise(noise(x * 8 + 4, y * 8 - 7)) * 0.24 + normalizedNoise(noise(x * 27 - 3, y * 27 + 9)) * 0.1;
  return best + ragged - edgePenalty - boundaryPenalty;
}

function resolveMajorLandmassBoundaryPenalty(bestMajor: number, secondMajor: number, script: HexMapScript): number {
  if (script === "pangaea" || !Number.isFinite(secondMajor) || secondMajor <= 0) return 0;
  const closeness = Math.max(0, 1 - Math.abs(bestMajor - secondMajor) / 0.18);
  return closeness * (script === "archipelago" ? 0.18 : 0.24);
}

function resolveDominantLandmassSeed(x: number, y: number, seeds: LandmassSeed[], delaunay: Delaunay<[number, number]> | null): LandmassSeed | null {
  if (seeds.length === 0) return null;
  const voronoiSeedId = delaunay != null ? seeds[delaunay.find(x, y)]?.id ?? null : null;
  let best: { seed: LandmassSeed; score: number } | null = null;
  for (const seed of seeds) {
    const score = seedInfluenceScore(x, y, seed) + (seed.id === voronoiSeedId ? 0.0001 : 0);
    if (!best || score > best.score) best = { seed, score };
  }
  return best && best.score > 0.04 ? best.seed : null;
}

function seedInfluenceScore(x: number, y: number, seed: LandmassSeed): number {
  const dx = (x - seed.x) / seed.radiusX;
  const dy = (y - seed.y) / seed.radiusY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const score = (1 - distance) * seed.weight;
  if (seed.island && distance > 1.08) return -1;
  return score;
}

function selectHomelandSeedId(seeds: LandmassSeed[]): number | null {
  const continents = seeds.filter((seed) => !seed.island);
  const largest = continents.sort((a, b) => b.radiusX * b.radiusY * b.weight - a.radiusX * a.radiusY * a.weight)[0];
  return largest?.id ?? null;
}

function makeChunkId(q: number, r: number, settings: HexMapSettings): HexChunkId {
  return `hex-chunk:${Math.floor(q / settings.chunkSize)}:${Math.floor(r / settings.chunkSize)}`;
}

function resolveEdgeOceanMargin(input: number | HexMapRange | undefined, random: () => number): number {
  if (typeof input === "number" && Number.isFinite(input)) return Math.max(0, Math.floor(input));
  if (input && typeof input === "object") {
    const min = Math.max(0, Math.floor(Number(input.min) || 0));
    const max = Math.max(min, Math.floor(Number(input.max) || min));
    return min + Math.floor(random() * (max - min + 1));
  }
  return 6;
}

function resolveWaterKind(landScore: number, elevation: number): HexWaterKind {
  if (landScore < 0.34 || elevation < 0.3) return "ocean";
  return null;
}

function resolveMoisture(q: number, r: number, noise: ReturnType<typeof createNoise2D>, settings: HexMapSettings, waterKind: HexWaterKind): number {
  const climateBias = settings.generation.climate.rainfall === "wet" ? 0.18 : settings.generation.climate.rainfall === "dry" ? -0.14 : 0;
  return clamp01(normalizedNoise(noise(q / 34 + 3, r / 34 - 3)) * 0.62 + normalizedNoise(noise(q / 90 - 11, r / 90 + 4)) * 0.28 + (waterKind ? 0.08 : 0) + climateBias);
}

function addInlandLakes(tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): void {
  const landTiles = tiles.filter((tile) => !tile.waterKind);
  const targetLakeTileCount = Math.max(1, Math.round(landTiles.length * 0.012));
  const maxLakeSize = Math.max(3, Math.min(18, Math.round(Math.sqrt(landTiles.length) * 0.42)));
  const minOceanDistance = settings.generation.mapScript === "archipelago" ? 3 : 4;
  const candidates = landTiles
    .filter((tile) => {
      if (tile.elevation > 0.62 || tile.moisture < 0.52) return false;
      if (tile.morphology === "mountainous") return false;
      if (distanceToWater(tile, tileById, settings, minOceanDistance) <= minOceanDistance) return false;
      return isLocalDrainageLow(tile, tileById, settings);
    })
    .sort((a, b) => lakeCandidateScore(b) - lakeCandidateScore(a) || a.id.localeCompare(b.id));
  const lakeIds = new Set<string>();
  for (const candidate of candidates) {
    if (lakeIds.size >= targetLakeTileCount) break;
    if (lakeIds.has(candidate.id) || candidate.waterKind) continue;
    const lake = growLakeBasin(candidate, tileById, settings, maxLakeSize, minOceanDistance, lakeIds);
    if (lake.length === 0) continue;
    for (const tile of lake) {
      lakeIds.add(tile.id);
      tile.waterKind = "lake";
      tile.internalTerrain = "lake";
      tile.internalFeature = "none";
      tile.civBiome = resolveCivBiome(tile.internalTerrain, tile.internalFeature, tile.moisture, tile.temperature);
      tile.morphology = resolveMorphology(tile.internalTerrain, tile.elevation);
      tile.passable = true;
    }
  }
}

function isLocalDrainageLow(tile: TileDraft, tileById: Map<string, TileDraft>, settings: HexMapSettings): boolean {
  let lowerNeighbors = 0;
  for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
    const neighborAxial = getNeighborAxial(tile, direction as HexDirection, settings);
    const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
    if (!neighbor || neighbor.waterKind) continue;
    if (neighbor.elevation < tile.elevation - 0.025) lowerNeighbors += 1;
  }
  return lowerNeighbors <= 1;
}

function lakeCandidateScore(tile: TileDraft): number {
  return tile.moisture * 0.52 + (1 - tile.elevation) * 0.38 + stableUnit(`${tile.id}:lake`) * 0.1;
}

function growLakeBasin(
  start: TileDraft,
  tileById: Map<string, TileDraft>,
  settings: HexMapSettings,
  maxSize: number,
  minOceanDistance: number,
  lakeIds: ReadonlySet<string>,
): TileDraft[] {
  const lake: TileDraft[] = [];
  const visited = new Set<string>([start.id]);
  const queue = new FlatQueue<TileDraft>();
  queue.push(start, 0);
  const spillElevation = start.elevation + 0.055 + stableUnit(`${start.id}:spill`) * 0.045;
  while (queue.length > 0 && lake.length < maxSize) {
    const current = queue.pop();
    if (!current || current.waterKind || lakeIds.has(current.id)) continue;
    if (current.elevation > spillElevation || current.moisture < 0.46 || current.morphology === "mountainous") continue;
    if (distanceToWater(current, tileById, settings, minOceanDistance) <= minOceanDistance) continue;
    lake.push(current);
    for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
      const neighborAxial = getNeighborAxial(current, direction as HexDirection, settings);
      const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
      if (!neighbor || visited.has(neighbor.id) || neighbor.waterKind || lakeIds.has(neighbor.id)) continue;
      visited.add(neighbor.id);
      const score = Math.max(0, neighbor.elevation - start.elevation) + Math.max(0, 0.58 - neighbor.moisture) * 0.4 + stableUnit(`${start.id}:${neighbor.id}:lake`) * 0.02;
      queue.push(neighbor, score);
    }
  }
  return lake.length >= 1 ? lake : [];
}

function resolveTemperature(q: number, r: number, latitude: number, elevation: number, noise: ReturnType<typeof createNoise2D>, settings: HexMapSettings): number {
  const climateBias = settings.generation.climate.temperature === "hot" ? 0.12 : settings.generation.climate.temperature === "cold" ? -0.12 : 0;
  return clamp01((1 - latitude) * 0.68 + normalizedNoise(noise(q / 68 - 6, r / 68 + 18)) * 0.16 - Math.max(0, elevation - 0.65) * 0.24 + climateBias);
}

function resolveInternalTerrain(elevation: number, moisture: number, temperature: number, waterKind: HexWaterKind): InternalTerrain {
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

function resolveInternalFeature(terrain: InternalTerrain, moisture: number, temperature: number, noise: number): InternalFeature {
  if (terrain === "ocean" || terrain === "sea" || terrain === "lake" || terrain === "desert") return "none";
  if (terrain === "snow" || terrain === "mountains") return noise > 0.84 ? "snowcap" : "none";
  if (terrain === "wetland") return noise > 0.42 ? "marsh" : "none";
  if (temperature > 0.64 && moisture > 0.58 && noise > 0.54) return "jungle";
  if (moisture > 0.52 && noise > 0.58) return noise > 0.86 ? "dense_forest" : "forest";
  if (moisture < 0.4 && noise > 0.78) return "scrub";
  return "none";
}

function resolveCivBiome(terrain: InternalTerrain, feature: InternalFeature, moisture: number, temperature: number): CivBiome {
  if (terrain === "tundra" || terrain === "snow" || temperature < 0.22) return "tundra";
  if (terrain === "desert") return "desert";
  if (feature === "jungle" || (temperature > 0.66 && moisture > 0.58)) return "tropical";
  if (terrain === "grassland" || moisture > 0.58) return "grassland";
  return "plains";
}

function resolveMorphology(terrain: InternalTerrain, elevation: number): Morphology {
  if (terrain === "mountains" || terrain === "snow" || elevation > 0.86) return "mountainous";
  if (terrain === "hills" || terrain === "wetland" || elevation > 0.58) return "rough";
  return "flat";
}

function applyTerrainErosionSmoothing(tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): void {
  const nextElevationById = new Map<HexId, number>();
  for (const tile of tiles) {
    if (tile.waterKind) continue;
    const lowerNeighbors = getNeighborTiles(tile, tileById, settings).filter((neighbor) => !neighbor.waterKind && neighbor.elevation < tile.elevation);
    if (lowerNeighbors.length === 0) continue;
    const lowestNeighbor = lowerNeighbors.reduce((lowest, neighbor) => neighbor.elevation < lowest.elevation ? neighbor : lowest, lowerNeighbors[0]);
    const steepDrop = tile.elevation - lowestNeighbor.elevation;
    if (steepDrop <= 0.16) continue;
    const erosion = Math.min(0.055, (steepDrop - 0.16) * 0.22);
    nextElevationById.set(tile.id, roundMetric(tile.elevation - erosion));
  }
  for (const tile of tiles) {
    const nextElevation = nextElevationById.get(tile.id);
    if (nextElevation == null) continue;
    tile.elevation = nextElevation;
    tile.internalTerrain = resolveInternalTerrain(tile.elevation, tile.moisture, tile.temperature, tile.waterKind);
    tile.internalFeature = normalizeFeatureForTerrain(tile.internalFeature, tile.internalTerrain);
    tile.civBiome = resolveCivBiome(tile.internalTerrain, tile.internalFeature, tile.moisture, tile.temperature);
    tile.morphology = resolveMorphology(tile.internalTerrain, tile.elevation);
  }
}

function getNeighborTiles(tile: TileDraft, tileById: Map<string, TileDraft>, settings: HexMapSettings): TileDraft[] {
  const neighbors: TileDraft[] = [];
  for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
    const neighborAxial = getNeighborAxial(tile, direction as HexDirection, settings);
    const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
    if (neighbor) neighbors.push(neighbor);
  }
  return neighbors;
}

function normalizeFeatureForTerrain(feature: InternalFeature, terrain: InternalTerrain): InternalFeature {
  if (terrain === "ocean" || terrain === "sea" || terrain === "lake" || terrain === "desert") return "none";
  if (terrain === "snow" || terrain === "mountains") return feature === "snowcap" ? "snowcap" : "none";
  if (terrain === "wetland") return feature === "none" ? "marsh" : feature;
  return feature === "snowcap" || feature === "marsh" ? "none" : feature;
}

function separateIslandsFromContinents(tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): void {
  const islandTilesInsideContinentBuffer = new Set<HexId>();
  const continentLandIds = new Set(tiles.filter(isContinentLand).map((tile) => tile.id));
  for (const tile of tiles) {
    if (!isIslandLand(tile)) continue;
    if (distanceToContinentLand(tile, tileById, settings, continentLandIds, 2) <= 2) {
      islandTilesInsideContinentBuffer.add(tile.id);
    }
  }
  for (const hexId of islandTilesInsideContinentBuffer) {
    const tile = tileById.get(hexId);
    if (tile) convertIslandLandToCoastalWater(tile);
  }
}

function distanceToContinentLand(
  tile: TileDraft,
  tileById: Map<string, TileDraft>,
  settings: HexMapSettings,
  continentLandIds: ReadonlySet<string>,
  maxDistance: number,
): number {
  let frontier: TileDraft[] = [tile];
  const visited = new Set<string>([tile.id]);
  for (let distance = 1; distance <= maxDistance; distance += 1) {
    const next: TileDraft[] = [];
    for (const current of frontier) {
      for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
        const neighborAxial = getNeighborAxial(current, direction as HexDirection, settings);
        const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
        if (!neighbor || visited.has(neighbor.id)) continue;
        if (continentLandIds.has(neighbor.id)) return distance;
        visited.add(neighbor.id);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return maxDistance + 1;
}

function isIslandLand(tile: TileDraft): boolean {
  return !tile.waterKind && tile.isIsland;
}

function isContinentLand(tile: TileDraft): boolean {
  return !tile.waterKind && !tile.isIsland;
}

function convertIslandLandToCoastalWater(tile: TileDraft): void {
  tile.waterKind = "sea";
  tile.elevation = Math.min(tile.elevation, 0.29);
  tile.moisture = Math.max(tile.moisture, 0.62);
  tile.distanceToWater = 0;
  tile.isCoastal = false;
  tile.riverMask = 0;
  tile.riverWidth = 0;
  tile.landmassId = null;
  tile.isHomeland = false;
  tile.isIsland = false;
  tile.internalTerrain = "sea";
  tile.internalFeature = "none";
  tile.civBiome = resolveCivBiome(tile.internalTerrain, tile.internalFeature, tile.moisture, tile.temperature);
  tile.morphology = "flat";
  tile.passable = true;
}

function internalTerrainFromTags(tile: HexTile): InternalTerrain {
  const tags = new Set(tile.mapTags ?? []);
  if (tags.has("water:ocean")) return "ocean";
  if (tags.has("water:coastal")) return "sea";
  if (tags.has("water:lake")) return "lake";
  if (tags.has("biome:desert")) return "desert";
  if (tags.has("biome:tundra")) return tags.has("feature:snow") ? "snow" : "tundra";
  if (tags.has("morphology:mountainous")) return "mountains";
  if (tags.has("morphology:rough")) return "hills";
  if (tags.has("feature:wet")) return "wetland";
  if (tags.has("biome:grassland")) return "grassland";
  return "plains";
}

function internalFeatureFromTags(tags: readonly string[]): InternalFeature {
  if (tags.includes("feature:snow")) return "snowcap";
  if (tags.includes("feature:wet")) return "marsh";
  if (tags.includes("feature:vegetated")) return "forest";
  return "none";
}

function civBiomeFromTags(tags: readonly string[]): CivBiome {
  if (tags.includes("biome:tundra")) return "tundra";
  if (tags.includes("biome:grassland")) return "grassland";
  if (tags.includes("biome:desert")) return "desert";
  if (tags.includes("biome:tropical")) return "tropical";
  return "plains";
}

function morphologyFromTags(tags: readonly string[]): Morphology {
  if (tags.includes("morphology:mountainous")) return "mountainous";
  if (tags.includes("morphology:rough")) return "rough";
  return "flat";
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

function promoteNearLandSeasToCoastalWater(tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): void {
  for (const tile of tiles) {
    if (tile.waterKind !== "ocean") continue;
    if (distanceToLand(tile, tileById, settings, 2) <= 2) {
      tile.waterKind = "sea";
      tile.internalTerrain = "sea";
      tile.passable = true;
    }
  }
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

function applyHydrologyMetadata(tiles: TileDraft[], tileById: Map<string, TileDraft>, riverEdges: HexEdgeRecord[], settings: HexMapSettings): void {
  const riverDrafts = collectRiverDrafts(riverEdges, tileById, settings);
  for (const tile of tiles) {
    tile.isCoastal = !tile.waterKind && distanceToWater(tile, tileById, settings, 1) === 1;
    tile.distanceToWater = resolveDistanceToWater(tile, tileById, settings);
    const riverDraft = riverDrafts.get(tile.id);
    tile.riverMask = riverDraft?.mask ?? 0;
    tile.riverWidth = roundMetric(riverDraft?.width ?? 0);
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
  return Math.min(3, distanceToWater(tile, tileById, settings, 3)) as HexDistanceToWater;
}

function distanceToWater(tile: TileDraft, tileById: Map<string, TileDraft>, settings: HexMapSettings, maxDistance: number): number {
  let frontier: TileDraft[] = [tile];
  const visited = new Set<string>([tile.id]);
  for (let distance = 1; distance <= maxDistance; distance += 1) {
    const next: TileDraft[] = [];
    for (const current of frontier) {
      for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
        const neighborAxial = getNeighborAxial(current, direction as HexDirection, settings);
        const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
        if (!neighbor || visited.has(neighbor.id)) continue;
        if (neighbor.waterKind) return distance;
        visited.add(neighbor.id);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return maxDistance + 1;
}

function distanceToLand(tile: TileDraft, tileById: Map<string, TileDraft>, settings: HexMapSettings, maxDistance: number): number {
  let frontier: TileDraft[] = [tile];
  const visited = new Set<string>([tile.id]);
  for (let distance = 1; distance <= maxDistance; distance += 1) {
    const next: TileDraft[] = [];
    for (const current of frontier) {
      for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
        const neighborAxial = getNeighborAxial(current, direction as HexDirection, settings);
        const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
        if (!neighbor || visited.has(neighbor.id)) continue;
        if (!neighbor.waterKind) return distance;
        visited.add(neighbor.id);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return maxDistance + 1;
}

function buildRiverEdges(tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): HexEdgeRecord[] {
  const edgeFlows = new Map<string, { hexId: HexId; direction: HexDirection; flow: number }>();
  const densityFactor = settings.generation.rivers.density === "many" ? 0.0048 : settings.generation.rivers.density === "normal" ? 0.0026 : 0.0012;
  const sourceCount = Math.max(3, Math.round(settings.width * settings.height * densityFactor));
  const minSourceDistance = settings.generation.rivers.density === "many" ? 4 : settings.generation.rivers.density === "normal" ? 5 : 7;
  const candidates = tiles
    .filter((tile) => !tile.waterKind && tile.elevation > 0.58 && tile.moisture > 0.36 && distanceToWater(tile, tileById, settings, 3) > 1)
    .sort((a, b) => riverSourceScore(b, tileById, settings) - riverSourceScore(a, tileById, settings) || a.id.localeCompare(b.id));
  const sources: TileDraft[] = [];
  for (const candidate of candidates) {
    if (sources.length >= sourceCount) break;
    if (sources.every((source) => axialDistance(source, candidate) >= minSourceDistance)) sources.push(candidate);
  }
  for (const source of sources) {
    let current = source;
    const visited = new Set<string>();
    const maxLength = 18 + Math.round(source.elevation * 46) + Math.round(source.moisture * 18);
    let flow = 0.85 + source.moisture * 1.15 + Math.max(0, source.elevation - 0.58) * 1.8;
    for (let step = 0; step < maxLength; step += 1) {
      visited.add(current.id);
      const downhill = getRiverDownhillNeighbor(current, tileById, settings, visited);
      if (!downhill) break;
      const key = `${current.id}:${downhill.direction}`;
      const existing = edgeFlows.get(key);
      edgeFlows.set(key, {
        hexId: current.id,
        direction: downhill.direction,
        flow: (existing?.flow ?? 0) + flow,
      });
      current = downhill.tile;
      flow += 0.16 + current.moisture * 0.32 + Math.max(0, source.elevation - current.elevation) * 0.08;
      if (current.waterKind) break;
    }
  }
  return [...edgeFlows.values()]
    .map((edge) => ({
      hexId: edge.hexId,
      direction: edge.direction,
      width: roundMagnitude(Math.min(5, 0.95 + Math.sqrt(edge.flow) * 1.02)),
    }))
    .sort((a, b) => a.hexId.localeCompare(b.hexId) || a.direction - b.direction);
}

function classifyRiverEdges(riverEdges: HexEdgeRecord[], tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): HexEdgeRecord[] {
  if (!settings.generation.rivers.navigable) return riverEdges.map((edge) => ({ ...edge, riverClass: edge.width >= 3 ? "major" : "minor", navigable: false, crossingCost: edge.width >= 3 ? settings.generation.rivers.crossingPenalty : 0 }));
  const coastalIds = new Set(tiles.filter((tile) => tile.isCoastal || tile.waterKind).map((tile) => tile.id));
  const mouthDistanceByEdgeKey = buildRiverMouthDistanceByEdgeKey(riverEdges, tileById, settings);
  return riverEdges.map((edge) => {
    const source = tileById.get(edge.hexId);
    const target = source ? getRiverTargetTile(source, edge.direction, tileById, settings) : null;
    const targetId = target?.id ?? null;
    const nearMouth = coastalIds.has(edge.hexId) || (targetId ? coastalIds.has(targetId) : false);
    const mouthDistance = mouthDistanceByEdgeKey.get(riverEdgeKey(edge)) ?? 99;
    const slope = source && target && !target.waterKind ? Math.max(0, source.elevation - target.elevation) : 0;
    const navigable =
      edge.width >= 3.35 ||
      (edge.width >= 2.75 && (nearMouth || mouthDistance <= 5)) ||
      (edge.width >= 3 && mouthDistance <= 10 && slope <= 0.04);
    const major = navigable || edge.width >= 2.45 || (edge.width >= 2.25 && mouthDistance <= 8);
    const riverClass = navigable ? "navigable" : major ? "major" : "minor";
    return {
      ...edge,
      riverClass,
      navigable,
      crossingCost: riverClass === "major" || riverClass === "navigable" ? settings.generation.rivers.crossingPenalty : 0,
    };
  });
}

function buildRiverMouthDistanceByEdgeKey(
  riverEdges: readonly HexEdgeRecord[],
  tileById: Map<string, TileDraft>,
  settings: HexMapSettings,
): Map<string, number> {
  const outgoingByHexId = new Map<HexId, HexEdgeRecord[]>();
  for (const edge of riverEdges) {
    const entries = outgoingByHexId.get(edge.hexId) ?? [];
    entries.push(edge);
    outgoingByHexId.set(edge.hexId, entries);
  }
  for (const entries of outgoingByHexId.values()) {
    entries.sort((left, right) => right.width - left.width || left.direction - right.direction);
  }
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const resolveDistance = (edge: HexEdgeRecord): number => {
    const key = riverEdgeKey(edge);
    const cached = memo.get(key);
    if (cached != null) return cached;
    if (visiting.has(key)) return 99;
    visiting.add(key);
    const source = tileById.get(edge.hexId);
    const target = source ? getRiverTargetTile(source, edge.direction, tileById, settings) : null;
    let distance = 99;
    if (!target || target.waterKind) {
      distance = 0;
    } else {
      const next = outgoingByHexId.get(target.id)?.[0] ?? null;
      distance = next ? Math.min(99, 1 + resolveDistance(next)) : 99;
    }
    visiting.delete(key);
    memo.set(key, distance);
    return distance;
  };
  for (const edge of riverEdges) resolveDistance(edge);
  return memo;
}

function getRiverTargetTile(
  source: TileDraft,
  direction: HexDirection,
  tileById: Map<string, TileDraft>,
  settings: HexMapSettings,
): TileDraft | null {
  const targetAxial = getNeighborAxial(source, direction, settings);
  return targetAxial ? tileById.get(makeHexId(targetAxial.q, targetAxial.r)) ?? null : null;
}

function riverEdgeKey(edge: Pick<HexEdgeRecord, "hexId" | "direction">): string {
  return `${edge.hexId}:${edge.direction}`;
}

function riverSourceScore(tile: TileDraft, tileById: Map<string, TileDraft>, settings: HexMapSettings): number {
  const waterDistance = Math.min(4, distanceToWater(tile, tileById, settings, 4));
  const drainageBias = isLocalDrainageLow(tile, tileById, settings) ? 0.08 : 0;
  return tile.elevation * 0.48 + tile.moisture * 0.32 + waterDistance * 0.035 + drainageBias + stableUnit(`${tile.id}:river-source`) * 0.035;
}

function getRiverDownhillNeighbor(tile: TileDraft, tileById: Map<string, TileDraft>, settings: HexMapSettings, visited: Set<string>): { tile: TileDraft; direction: HexDirection } | null {
  let best: { tile: TileDraft; direction: HexDirection; score: number } | null = null;
  for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
    const neighborAxial = getNeighborAxial(tile, direction as HexDirection, settings);
    const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
    if (!neighbor || visited.has(neighbor.id)) continue;
    const waterBonus = neighbor.waterKind ? -0.42 : 0;
    const moistureChannel = neighbor.waterKind ? 0 : (1 - neighbor.moisture) * 0.045;
    const score = neighbor.elevation + moistureChannel + waterBonus + stableUnit(`${tile.id}:${neighbor.id}:river-step`) * 0.018;
    if (!best || score < best.score) best = { tile: neighbor, direction: direction as HexDirection, score };
  }
  return best && best.score <= tile.elevation + 0.045 ? best : null;
}

function assignRegions(tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): void {
  const landTiles = tiles.filter((tile) => !tile.waterKind);
  assignRegionGroup(landTiles, tileById, settings, settings.generation.regions.targetLandRegionSize, false);
  const oceanTiles = tiles.filter((tile) => tile.waterKind === "ocean");
  assignRegionGroup(oceanTiles, tileById, settings, settings.generation.regions.targetWaterRegionSize, true);
}

function assignRegionGroup(groupTiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings, targetSize: number, waterGroup: boolean): void {
  const anchors = groupTiles.filter((_, index) => index % Math.max(1, targetSize) === 0);
  const queue = new FlatQueue<TileDraft>();
  for (const anchor of anchors) {
    const regionId: HexRegionId = `region:hex_${anchor.q}_${anchor.r}`;
    anchor.regionId = regionId;
    queue.push(anchor, 0);
  }
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current?.regionId) continue;
    for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
      const neighborAxial = getNeighborAxial(current, direction as HexDirection, settings);
      const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
      if (!neighbor || neighbor.regionId) continue;
      if (waterGroup ? neighbor.waterKind !== "ocean" : neighbor.waterKind) continue;
      if (!waterGroup && (neighbor.landmassId !== current.landmassId || neighbor.isHomeland !== current.isHomeland)) continue;
      neighbor.regionId = current.regionId;
      queue.push(neighbor, regionNeighborScore(current, neighbor, direction as HexDirection));
    }
  }
  for (const tile of groupTiles) {
    tile.regionId ??= `region:hex_${tile.q}_${tile.r}`;
  }
}

function regionNeighborScore(tile: TileDraft, neighbor: TileDraft, direction: HexDirection): number {
  return 1 + direction * 0.001 + stableUnit(`${tile.id}:${neighbor.id}:region-growth`) * 0.0001;
}

function assignCoastalWaterToLandRegions(tiles: TileDraft[], tileById: Map<string, TileDraft>, settings: HexMapSettings): void {
  const queue = new FlatQueue<{ tile: TileDraft; regionId: HexRegionId; distance: number }>();
  for (const land of tiles.filter((tile) => !tile.waterKind && tile.regionId)) {
    for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
      const neighborAxial = getNeighborAxial(land, direction as HexDirection, settings);
      const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
      if (neighbor?.waterKind === "sea" || neighbor?.waterKind === "lake") {
        queue.push({ tile: neighbor, regionId: land.regionId ?? "region:hex_0_0", distance: 1 }, 1);
      }
    }
  }
  const assigned = new Set<string>();
  while (queue.length > 0) {
    const item = queue.pop();
    if (!item || assigned.has(item.tile.id) || item.distance > 2) continue;
    item.tile.regionId = item.regionId;
    assigned.add(item.tile.id);
    for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
      const neighborAxial = getNeighborAxial(item.tile, direction as HexDirection, settings);
      const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
      if ((neighbor?.waterKind === "sea" || neighbor?.waterKind === "lake") && !assigned.has(neighbor.id)) {
        queue.push({ tile: neighbor, regionId: item.regionId, distance: item.distance + 1 }, item.distance + 1 + neighbor.id.localeCompare(item.tile.id) * 0.000001);
      }
    }
  }
}

function applyMapTags(tiles: TileDraft[], riverEdges: readonly HexEdgeRecord[] = [], settings?: HexMapSettings): void {
  const maxR = Math.max(1, Math.max(...tiles.map((tile) => tile.r)));
  const riverClassByTileId = collectRiverClassByTile(riverEdges, tiles, settings);
  for (const tile of tiles) {
    const tags = new Set<HexMapTag>();
    if (tile.waterKind === "ocean") tags.add("water:ocean");
    if (tile.waterKind === "sea") tags.add("water:coastal");
    if (tile.waterKind === "lake") tags.add("water:lake");
    if (tile.waterKind === "lake" || tile.riverMask > 0) tags.add("water:fresh");
    if (!tile.waterKind) {
      tags.add(`biome:${tile.civBiome}`);
      tags.add(`morphology:${tile.morphology}`);
      tags.add(tile.isIsland ? "landmass:island" : "landmass:continent");
      if (!tile.isIsland) tags.add(tile.isHomeland ? "continent:homeland" : "continent:distant");
    }
    if (tile.waterKind === "sea" || tile.waterKind === "lake") tags.add("feature:aquatic");
    if (tile.internalFeature === "forest" || tile.internalFeature === "dense_forest" || tile.internalFeature === "jungle" || tile.internalFeature === "scrub") tags.add("feature:vegetated");
    if (tile.internalFeature === "marsh" || tile.internalTerrain === "wetland") tags.add("feature:wet");
    if (tile.internalFeature === "snowcap" || tile.internalTerrain === "snow") tags.add("feature:snow");
    tags.add(tile.waterKind ? "fertility:barren" : fertilityTag(tile));
    tags.add(rainfallTag(tile.moisture));
    tags.add(slopeTag(tile.elevation, tile.morphology));
    tags.add(latitudeTag(tile.r, maxR));
    tags.add(elevationTag(tile.elevation));
    tags.add(tile.isCoastal || tile.waterKind === "sea" ? "coast:coastal" : "coast:inland");
    const riverClass = riverClassByTileId.get(tile.id) ?? riverClassFromWidth(tile.riverWidth);
    if (tile.riverMask > 0 && riverClass) {
      tags.add(`river:${riverClass}`);
      tags.add(riverClass === "navigable" ? "morphology:navigable_river" : "feature:minor_river");
      if (riverClass === "navigable" && tile.distanceToWater <= 1) tags.add("feature:floodplain");
      if (tile.riverMask > 0 && tile.elevation > 0.68) tags.add("basin:headwater");
      if (riverClass === "major" || riverClass === "navigable") tags.add(tile.distanceToWater <= 1 ? "basin:delta" : "basin:mainstem");
    }
    if (tile.morphology !== "flat" || tags.has("feature:vegetated") || tags.has("feature:wet") || tile.waterKind === "ocean") tags.add("movement:stop_on_enter");
    tile.mapTags = [...tags].sort();
  }
}

function collectRiverClassByTile(
  riverEdges: readonly HexEdgeRecord[],
  tiles: readonly TileDraft[],
  settings: HexMapSettings | undefined,
): Map<HexId, HexEdgeRecord["riverClass"]> {
  const byId = new Map<string, TileDraft>(tiles.map((tile) => [tile.id, tile]));
  const classByTileId = new Map<HexId, HexEdgeRecord["riverClass"]>();
  for (const edge of riverEdges) {
    const riverClass = edge.riverClass ?? riverClassFromWidth(edge.width);
    if (!riverClass) continue;
    mergeRiverClass(classByTileId, edge.hexId, riverClass);
    if (!settings) continue;
    const source = byId.get(edge.hexId);
    const neighborAxial = source ? getNeighborAxial(source, edge.direction, settings) : null;
    const neighborId = neighborAxial ? makeHexId(neighborAxial.q, neighborAxial.r) : null;
    if (neighborId && byId.has(neighborId)) mergeRiverClass(classByTileId, neighborId, riverClass);
  }
  return classByTileId;
}

function mergeRiverClass(target: Map<HexId, HexEdgeRecord["riverClass"]>, hexId: HexId, riverClass: HexEdgeRecord["riverClass"]): void {
  const current = target.get(hexId);
  if (riverClassRank(riverClass) > riverClassRank(current)) target.set(hexId, riverClass);
}

function riverClassFromWidth(width: number | undefined): HexEdgeRecord["riverClass"] | null {
  const value = Number(width) || 0;
  if (value >= 3) return "navigable";
  if (value >= 2) return "major";
  if (value > 0) return "minor";
  return null;
}

function riverClassRank(riverClass: HexEdgeRecord["riverClass"] | null | undefined): number {
  if (riverClass === "navigable") return 3;
  if (riverClass === "major") return 2;
  if (riverClass === "minor") return 1;
  return 0;
}

function refreshMovementMetadata(tiles: TileDraft[]): void {
  for (const tile of tiles) {
    tile.movementCost = resolveMovementCostFromTags(tile.mapTags, tile.waterKind);
    tile.stopsMovementOnEnter = tile.mapTags.includes("movement:stop_on_enter");
    tile.passable = tile.waterKind !== "ocean";
  }
}

function resolveMovementCostFromTags(tags: readonly string[], waterKind: HexWaterKind): number {
  if (waterKind === "ocean") return 5;
  if (waterKind === "sea" || waterKind === "lake") return 3;
  let cost = 1;
  if (tags.includes("morphology:rough")) cost += 1;
  if (tags.includes("morphology:mountainous")) cost += 3;
  if (tags.includes("feature:vegetated") || tags.includes("feature:wet")) cost += 1;
  if (tags.includes("feature:snow")) cost += 1;
  return cost;
}

function fertilityTag(tile: TileDraft): HexMapTag {
  if (tile.civBiome === "desert" || tile.civBiome === "tundra" || tile.morphology === "mountainous") return "fertility:poor";
  if (tile.internalTerrain === "wetland" || tile.civBiome === "tropical") return "fertility:rich";
  if (tile.civBiome === "grassland" && tile.moisture > 0.55) return "fertility:fertile";
  if (tile.civBiome === "plains" || tile.civBiome === "grassland") return "fertility:modest";
  return "fertility:poor";
}

function rainfallTag(moisture: number): HexMapTag {
  if (moisture < 0.18) return "rainfall:arid";
  if (moisture < 0.38) return "rainfall:dry";
  if (moisture < 0.64) return "rainfall:moderate";
  if (moisture < 0.84) return "rainfall:wet";
  return "rainfall:monsoon";
}

function slopeTag(elevation: number, morphology: Morphology): HexMapTag {
  if (morphology === "mountainous") return "slope:rugged";
  if (morphology === "rough" || elevation > 0.68) return "slope:steep";
  if (elevation > 0.54) return "slope:hilly";
  if (elevation > 0.4) return "slope:rolling";
  return "slope:flat";
}

function latitudeTag(r: number, maxR: number): HexMapTag {
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

function roundMagnitude(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeVector(vector: { x: number; y: number }): { x: number; y: number } {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0.000001) return { x: 0, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

function dot(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return left.x * right.x + left.y * right.y;
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

function stableUnit(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) / 4294967295;
}
