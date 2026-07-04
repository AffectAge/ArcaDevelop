import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  DEFAULT_HEX_MAP_SETTINGS,
  enrichHexMapVisualMetadata,
  generateHexMap,
  getNeighborAxial,
  makeHexId,
  axialToPixel,
  type HexMapArtifact,
  type HexMapSettings,
  type HexTile,
} from "@arcanorum/shared";
import { normalizeContentGoods } from "../content/contentNormalizers";
import type { HexMapIndexEntry } from "../map/hexIndex";
import { ensureGeneratedMapFeatures } from "./mapFeatureGeneration";
import { ensureGeneratedResourceDeposits } from "./resourceDepositGeneration";
import type { ScenarioDefines } from "./scenarioDefinesLoader";
import { loadRawScenarioContent } from "./scenarioContentLoader";
import { getScenarioRuntimePaths } from "./runtimePaths";

export const DEFAULT_SCENARIO_ID = "default";
const DEFAULT_COUNTRY_ID = "country:default";
const DEFAULT_REGION_AREA_KM2 = 1000;

const DEFAULT_MAP_TAG_LOCALIZATION_EN: Record<string, string> = {
  "mapTag.biome.tundra": "Tundra",
  "mapTag.biome.grassland": "Grassland",
  "mapTag.biome.plains": "Plains",
  "mapTag.biome.desert": "Desert",
  "mapTag.biome.tropical": "Tropical",
  "mapTag.morphology.flat": "Flat",
  "mapTag.morphology.rough": "Rough",
  "mapTag.morphology.mountainous": "Mountainous",
  "mapTag.morphology.navigable_river": "Navigable river tile",
  "mapTag.water.coastal": "Coastal water",
  "mapTag.water.ocean": "Ocean",
  "mapTag.water.lake": "Lake",
  "mapTag.water.fresh": "Fresh water",
  "mapTag.feature.minor_river": "Minor river",
  "mapTag.feature.floodplain": "Floodplain",
  "mapTag.feature.wet": "Wet",
  "mapTag.feature.vegetated": "Vegetated",
  "mapTag.feature.aquatic": "Aquatic",
  "mapTag.feature.snow": "Snow",
  "mapTag.feature.volcanic": "Volcanic",
  "mapTag.movement.stop_on_enter": "Stops movement on enter",
  "mapTag.fertility.barren": "Barren",
  "mapTag.fertility.poor": "Poor fertility",
  "mapTag.fertility.modest": "Modest fertility",
  "mapTag.fertility.fertile": "Fertile",
  "mapTag.fertility.rich": "Rich fertility",
  "mapTag.rainfall.arid": "Arid",
  "mapTag.rainfall.dry": "Dry",
  "mapTag.rainfall.moderate": "Moderate rainfall",
  "mapTag.rainfall.wet": "Wet",
  "mapTag.rainfall.monsoon": "Monsoon rainfall",
  "mapTag.slope.flat": "Flat",
  "mapTag.slope.rolling": "Rolling",
  "mapTag.slope.hilly": "Hilly",
  "mapTag.slope.steep": "Steep",
  "mapTag.slope.rugged": "Rugged",
  "mapTag.latitude.polar": "Polar",
  "mapTag.latitude.subpolar": "Subpolar",
  "mapTag.latitude.temperate": "Temperate latitude",
  "mapTag.latitude.subtropical": "Subtropical",
  "mapTag.latitude.tropical": "Tropical",
  "mapTag.elevation.lowland": "Lowland",
  "mapTag.elevation.upland": "Upland",
  "mapTag.elevation.highland": "Highland",
  "mapTag.elevation.mountain": "Mountain elevation",
  "mapTag.elevation.peak": "Peak",
  "mapTag.landmass.continent": "Continent",
  "mapTag.landmass.island": "Island",
  "mapTag.continent.homeland": "Homeland continent",
  "mapTag.continent.distant": "Distant continent",
  "mapTag.basin.headwater": "Headwater basin",
  "mapTag.basin.mainstem": "Main river basin",
  "mapTag.basin.delta": "River delta",
  "mapTag.river.minor": "Minor river",
  "mapTag.river.major": "Major river",
  "mapTag.river.navigable": "Navigable river",
  "mapTag.coast.coastal": "Coastal",
  "mapTag.coast.inland": "Inland",
};

const DEFAULT_MAP_TAG_LOCALIZATION_RU: Record<string, string> = {
  "mapTag.biome.tundra": "Тундра",
  "mapTag.biome.grassland": "Луга",
  "mapTag.biome.plains": "Степи",
  "mapTag.biome.desert": "Пустыня",
  "mapTag.biome.tropical": "Тропики",
  "mapTag.morphology.flat": "Ровная местность",
  "mapTag.morphology.rough": "Сложный рельеф",
  "mapTag.morphology.mountainous": "Горная местность",
  "mapTag.morphology.navigable_river": "Судоходная речная клетка",
  "mapTag.water.coastal": "Прибрежные воды",
  "mapTag.water.ocean": "Океан",
  "mapTag.water.lake": "Озеро",
  "mapTag.water.fresh": "Пресная вода",
  "mapTag.feature.minor_river": "Малая река",
  "mapTag.feature.floodplain": "Пойма",
  "mapTag.feature.wet": "Сырая местность",
  "mapTag.feature.vegetated": "Растительность",
  "mapTag.feature.aquatic": "Водная особенность",
  "mapTag.feature.snow": "Снег",
  "mapTag.feature.volcanic": "Вулканическая местность",
  "mapTag.movement.stop_on_enter": "Останавливает движение при входе",
  "mapTag.fertility.barren": "Бесплодная земля",
  "mapTag.fertility.poor": "Низкая урожайность",
  "mapTag.fertility.modest": "Средняя урожайность",
  "mapTag.fertility.fertile": "Высокая урожайность",
  "mapTag.fertility.rich": "Богатая урожайность",
  "mapTag.rainfall.arid": "Засушливо",
  "mapTag.rainfall.dry": "Сухо",
  "mapTag.rainfall.moderate": "Умеренные осадки",
  "mapTag.rainfall.wet": "Влажно",
  "mapTag.rainfall.monsoon": "Муссонные осадки",
  "mapTag.slope.flat": "Равнина",
  "mapTag.slope.rolling": "Волнистый рельеф",
  "mapTag.slope.hilly": "Холмисто",
  "mapTag.slope.steep": "Крутые склоны",
  "mapTag.slope.rugged": "Пересеченный рельеф",
  "mapTag.latitude.polar": "Полярная широта",
  "mapTag.latitude.subpolar": "Субполярная широта",
  "mapTag.latitude.temperate": "Умеренная широта",
  "mapTag.latitude.subtropical": "Субтропики",
  "mapTag.latitude.tropical": "Тропики",
  "mapTag.elevation.lowland": "Низменность",
  "mapTag.elevation.upland": "Возвышенность",
  "mapTag.elevation.highland": "Плоскогорье",
  "mapTag.elevation.mountain": "Горная высота",
  "mapTag.elevation.peak": "Пик",
  "mapTag.landmass.continent": "Континент",
  "mapTag.landmass.island": "Остров",
  "mapTag.continent.homeland": "Родной материк",
  "mapTag.continent.distant": "Дальний материк",
  "mapTag.basin.headwater": "Верховья бассейна",
  "mapTag.basin.mainstem": "Главное русло",
  "mapTag.basin.delta": "Речная дельта",
  "mapTag.river.minor": "Малая река",
  "mapTag.river.major": "Крупная река",
  "mapTag.river.navigable": "Судоходная река",
  "mapTag.coast.coastal": "Побережье",
  "mapTag.coast.inland": "Внутренняя земля",
};

export const DEFAULT_SCENARIO_DEFINES: Required<ScenarioDefines> = {
  ai: {
    enabled: true,
    maxCountriesPerTick: 50,
    maxDecisionCandidatesPerCountry: 20,
    contextCacheTtlTurns: 1,
    maxBuildCompletionTurns: 8,
  },
  economy: {
    baseCulturePerTurn: 100,
    baseSciencePerTurn: 100,
    baseReligionPerTurn: 100,
    baseConstructionPerTurn: 50,
    baseDucatsPerTurn: 5_000,
    baseGoldPerTurn: 100,
    demolitionCostConstructionPercent: 20,
    marketPriceSmoothing: 0.2,
    buildingDurabilityDecayPerTurn: 10,
    buildingDurabilityRecoveryPerTurn: 5,
    pollutionProductivityEffectPer1000: 0.1,
    explorationBaseEmptyChancePct: 5,
    explorationDepletionPerAttemptPct: 7.5,
    explorationDurationTurns: 1,
    explorationRollsPerExpedition: 3,
  },
  auditLog: {
    maxEntries: 1_000,
    retentionTurns: null,
  },
  colonization: {
    maxActiveColonizations: 3,
    pointsPerTurn: 30,
    pointsCostPer1000Km2: 5,
    ducatsCostPer1000Km2: 5,
    settlementEnabled: true,
    settlementPopulationOnCapture: 1_000,
    colonizerTurns: 2,
    colonizerCostColonization: 20,
    colonizerCostDucats: 10,
    colonizerMovementPoints: 2,
  },
  customization: {
    renameDucats: 20,
    recolorDucats: 10,
    flagDucats: 15,
    crestDucats: 15,
    hexRenameDucats: 25,
  },
  military: {
    militaryFormationSpeed: 10,
    landDivisionStackLimitPerHex: 4,
  },
  registration: {
    requireAdminApproval: false,
  },
  eventLog: {
    retentionTurns: 3,
  },
  resourceLedger: {
    retentionTurns: 20,
    maxEntriesPerTurn: 10_000,
  },
  turnTimer: {
    enabled: true,
    secondsPerTurn: 86_400,
    pauseWhenNoPlayersOnline: false,
  },
};

export type DefaultScenarioBootstrapResult = {
  scenarioId: string;
  scenarioDir: string;
  mapRoot: string;
  hexIndexPath: string;
  hexMapArtifactPath: string;
  generatedRegionIndexPath: string;
  artifact: HexMapArtifact;
};

export type ScenarioMapArtifactsResult = {
  scenarioDir: string;
  mapRoot: string;
  hexIndexPath: string;
  hexMapArtifactPath: string;
  generatedRegionIndexPath: string;
  artifact: HexMapArtifact;
};

type EnsureDefaultScenarioParams = {
  dataRoot: string;
  forceGenerated?: boolean;
};

export function ensureDefaultScenario(params: EnsureDefaultScenarioParams): DefaultScenarioBootstrapResult {
  const scenarioDir = resolve(params.dataRoot, "scenarios", DEFAULT_SCENARIO_ID);
  const mapRoot = resolve(scenarioDir, "map");
  const generatedRoot = resolve(scenarioDir, ".generated");
  const settingsPath = resolve(mapRoot, "hex-settings.json");
  const artifactPath = resolve(generatedRoot, "hex-map.json");
  const hexIndexPath = resolve(generatedRoot, "hexes.json");
  const generatedRegionIndexPath = resolve(generatedRoot, "regions.json");

  if (params.forceGenerated) {
    resetGeneratedDefaultScenarioShell(scenarioDir);
  }

  mkdirSync(mapRoot, { recursive: true });
  mkdirSync(resolve(scenarioDir, "history", "countries"), { recursive: true });
  mkdirSync(resolve(scenarioDir, "history", "regions"), { recursive: true });
  mkdirSync(resolve(scenarioDir, "common"), { recursive: true });
  mkdirSync(resolve(scenarioDir, "localisation"), { recursive: true });
  mkdirSync(generatedRoot, { recursive: true });

  writeJsonIfMissing(resolve(scenarioDir, "scenario.json"), {
    id: DEFAULT_SCENARIO_ID,
    name: "Default",
    description: "Server-generated default Arcanorum scenario.",
    startTurn: 1,
    mapRoot: "map",
  });
  writeJsonIfMissing(settingsPath, DEFAULT_HEX_MAP_SETTINGS);
  writeJsonIfMissing(resolve(scenarioDir, "history", "countries", "default.json"), {
    id: DEFAULT_COUNTRY_ID,
    nameKey: "country:default.nameKey",
    color: "#1f6f8b",
    resources: {
      culture: 15,
      science: 12,
      religion: 12,
      colonization: 225,
      construction: 5,
      ducats: 12,
      gold: 150,
    },
    controlMode: "open",
  });
  writeJsonIfMissing(resolve(scenarioDir, "common", "defines.json"), DEFAULT_SCENARIO_DEFINES);
  writeJsonIfMissing(resolve(scenarioDir, "localisation", "en.json"), {
    "scenario.default.name": "Default",
    "country:default.nameKey": "Default Country",
    ...DEFAULT_MAP_TAG_LOCALIZATION_EN,
  });
  writeJsonIfMissing(resolve(scenarioDir, "localisation", "ru.json"), {
    "scenario.default.name": "Базовый сценарий",
    "country:default.nameKey": "Базовая страна",
    ...DEFAULT_MAP_TAG_LOCALIZATION_RU,
  });

  const settings = readHexMapSettings(settingsPath);
  const settingsHash = hashJson(settings);
  const artifactExists = existsSync(artifactPath);
  const rawExistingArtifact = !params.forceGenerated && artifactExists ? readJsonFile<HexMapArtifact>(artifactPath) : null;
  const artifactStale = rawExistingArtifact?.settings == null || hashJson(rawExistingArtifact.settings) !== settingsHash;
  const artifactMissingVisualMetadata = rawExistingArtifact ? rawExistingArtifact.tiles.some((tile) => tile.temperatureBand == null || tile.moistureBand == null || tile.distanceToWater == null || tile.riverMask == null || tile.mapTags == null) : false;
  const artifact = params.forceGenerated || !rawExistingArtifact || artifactStale
    ? generateHexMap(settings)
    : enrichHexMapVisualMetadata(rawExistingArtifact);
  const generatedRegions = buildGeneratedRegions(artifact);
  const hexIndex = buildHexMapIndex(artifact, generatedRegions.regionColorById);

  if (params.forceGenerated || !artifactExists || artifactMissingVisualMetadata || artifactStale) writeJsonFile(artifactPath, artifact);
  if (params.forceGenerated || !existsSync(hexIndexPath) || artifactStale) writeJsonFile(hexIndexPath, hexIndex);
  if (params.forceGenerated || !existsSync(generatedRegionIndexPath) || artifactStale) {
    writeJsonFile(generatedRegionIndexPath, generatedRegions.regions);
  }
  const mapFeatureResult = ensureGeneratedMapFeatures({ scenarioDir, mapArtifact: artifact, forceGenerated: params.forceGenerated });
  if (mapFeatureResult.issues.length > 0) {
    throw new Error(mapFeatureResult.issues.map((issue) => `${issue.code}: ${issue.path}: ${issue.message}`).join("\n"));
  }
  const rawContent = loadRawScenarioContent(scenarioDir) ?? {};
  ensureGeneratedResourceDeposits({
    scenarioDir,
    artifact,
    goods: normalizeContentGoods((rawContent as { goods?: unknown }).goods),
    forceGenerated: params.forceGenerated,
  });

  const runtimePaths = getScenarioRuntimePaths({
    scenarioDir,
    manifest: { mapRoot: "map" },
    dataRoot: params.dataRoot,
  });

  return {
    scenarioId: DEFAULT_SCENARIO_ID,
    scenarioDir,
    mapRoot: runtimePaths.mapRoot,
    hexIndexPath: runtimePaths.hexIndexPath,
    hexMapArtifactPath: artifactPath,
    generatedRegionIndexPath,
    artifact,
  };
}

function resetGeneratedDefaultScenarioShell(scenarioDir: string): void {
  for (const relativePath of ["common", "history", "localisation", "assets"]) {
    rmSync(resolve(scenarioDir, relativePath), { recursive: true, force: true });
  }
}

function buildGeneratedRegions(artifact: HexMapArtifact): {
  regions: Record<string, unknown>[];
  regionColorById: Map<string, string>;
} {
  const hexIdsByRegionId = new Map<string, string[]>();
  const firstTileByRegionId = new Map<string, HexTile>();
  for (const tile of artifact.tiles) {
    const hexIds = hexIdsByRegionId.get(tile.regionId) ?? [];
    hexIds.push(tile.id);
    hexIdsByRegionId.set(tile.regionId, hexIds);
    if (!firstTileByRegionId.has(tile.regionId)) firstTileByRegionId.set(tile.regionId, tile);
  }

  const firstLandRegionId = [...firstTileByRegionId.entries()].find(([, tile]) => !tile.waterKind)?.[0] ?? null;
  const regionColorById = new Map<string, string>();
  const regions = [...hexIdsByRegionId.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([regionId, hexIds]) => {
      const firstTile = firstTileByRegionId.get(regionId);
      const color = firstTile ? colorForRegion(firstTile) : "#64748b";
      regionColorById.set(regionId, color);
      const ownedByDefaultCountry = regionId === firstLandRegionId;
      return {
        id: regionId,
        nameKey: `region.generated.${sanitizeRegionId(regionId)}.name`,
        color,
        hexIds,
        ownerCountryId: ownedByDefaultCountry ? DEFAULT_COUNTRY_ID : null,
        controllerCountryId: ownedByDefaultCountry ? DEFAULT_COUNTRY_ID : null,
        coreCountryIds: ownedByDefaultCountry ? [DEFAULT_COUNTRY_ID] : [],
        claims: [],
        pops: [],
        buildings: [],
        construction: [],
        resourceDeposits: [],
        infrastructure: {},
        modifiers: [],
        generated: true,
      };
    });

  return { regions, regionColorById };
}

function buildHexMapIndex(artifact: HexMapArtifact, regionColorById: Map<string, string>): HexMapIndexEntry[] {
  return artifact.tiles.map((tile) => {
    const center = axialToPixel(tile, artifact.settings.hexSize);
    return {
      id: tile.id,
      name: `Hex ${tile.q}:${tile.r}`,
      regionId: tile.regionId,
      hexColor: colorForTerrain(tile),
      regionColor: regionColorById.get(tile.regionId) ?? "#64748b",
      areaKm2: DEFAULT_REGION_AREA_KM2,
      hexType: resolveIndexHexType(tile),
      centerX: Math.round(center.x * 100) / 100,
      centerY: Math.round(center.y * 100) / 100,
      sourceCenterX: Math.round(center.x * 100) / 100,
      sourceCenterY: Math.round(center.y * 100) / 100,
      neighbors: buildNeighborIds(tile, artifact.settings),
      climate: resolveIndexClimate(tile),
      pollution: 0,
      radiation: 0,
      landscape: resolveIndexLandscape(tile),
      continent: tile.waterKind ? "continent:water" : "continent:land",
      strategicRegion: tile.regionId,
      fertileLandKm2: tile.waterKind ? 0 : Math.round(DEFAULT_REGION_AREA_KM2 * fertilityForTile(tile)),
      fertility: tile.waterKind ? 0 : fertilityForTile(tile),
    };
  });
}

function buildNeighborIds(tile: HexTile, settings: HexMapSettings): string[] {
  const ids: string[] = [];
  for (let direction = 0; direction < 6; direction += 1) {
    const neighbor = getNeighborAxial(tile, direction as 0 | 1 | 2 | 3 | 4 | 5, settings);
    if (neighbor) ids.push(makeHexId(neighbor.q, neighbor.r));
  }
  return ids;
}

function readHexMapSettings(path: string): HexMapSettings {
  return readJsonFile<HexMapSettings>(path);
}

export function ensureScenarioMapArtifacts(params: { scenarioDir: string; forceGenerated?: boolean }): ScenarioMapArtifactsResult {
  const scenarioDir = resolve(params.scenarioDir);
  const mapRoot = resolve(scenarioDir, "map");
  const generatedRoot = resolve(scenarioDir, ".generated");
  const settingsPath = resolve(mapRoot, "hex-settings.json");
  const artifactPath = resolve(generatedRoot, "hex-map.json");
  const hexIndexPath = resolve(generatedRoot, "hexes.json");
  const generatedRegionIndexPath = resolve(generatedRoot, "regions.json");
  mkdirSync(generatedRoot, { recursive: true });
  const settings = readHexMapSettings(settingsPath);
  const settingsHash = hashJson(settings);
  const rawExistingArtifact = !params.forceGenerated && existsSync(artifactPath) ? readJsonFile<HexMapArtifact>(artifactPath) : null;
  const artifactStale = rawExistingArtifact?.settings == null || hashJson(rawExistingArtifact.settings) !== settingsHash;
  const artifact = params.forceGenerated || !rawExistingArtifact || artifactStale
    ? generateHexMap(settings)
    : enrichHexMapVisualMetadata(rawExistingArtifact);
  const generatedRegions = buildGeneratedRegions(artifact);
  const hexIndex = buildHexMapIndex(artifact, generatedRegions.regionColorById);
  if (params.forceGenerated || !existsSync(artifactPath) || artifactStale) writeJsonFile(artifactPath, artifact);
  if (params.forceGenerated || !existsSync(hexIndexPath) || artifactStale) writeJsonFile(hexIndexPath, hexIndex);
  if (params.forceGenerated || !existsSync(generatedRegionIndexPath) || artifactStale) writeJsonFile(generatedRegionIndexPath, generatedRegions.regions);
  const mapFeatureResult = ensureGeneratedMapFeatures({ scenarioDir, mapArtifact: artifact, forceGenerated: params.forceGenerated || artifactStale });
  if (mapFeatureResult.issues.length > 0) {
    throw new Error(mapFeatureResult.issues.map((issue) => `${issue.code}: ${issue.path}: ${issue.message}`).join("\n"));
  }
  const rawContent = loadRawScenarioContent(scenarioDir) ?? {};
  ensureGeneratedResourceDeposits({
    scenarioDir,
    artifact,
    goods: normalizeContentGoods((rawContent as { goods?: unknown }).goods),
    forceGenerated: params.forceGenerated || artifactStale,
  });
  return { scenarioDir, mapRoot, hexIndexPath, hexMapArtifactPath: artifactPath, generatedRegionIndexPath, artifact };
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function fertilityForTile(tile: HexTile): number {
  if (tile.waterKind) return 0;
  if (hasTag(tile, "fertility:rich")) return 0.9;
  if (hasTag(tile, "fertility:fertile")) return 0.75;
  if (hasTag(tile, "fertility:modest")) return 0.55;
  if (hasTag(tile, "fertility:poor")) return 0.2;
  return 0.4;
}

function colorForRegion(tile: HexTile): string {
  if (tile.waterKind) return "#2f7f98";
  if (hasTag(tile, "biome:desert")) return "#b8a45f";
  if (hasTag(tile, "biome:tropical")) return "#3d8b52";
  if (hasTag(tile, "biome:tundra") || hasTag(tile, "morphology:mountainous")) return "#8a9aa3";
  if (hasTag(tile, "feature:wet")) return "#5f8e68";
  if (hasTag(tile, "feature:vegetated")) return "#4f7f45";
  return "#5f8f52";
}

function colorForTerrain(tile: HexTile): string {
  const colors: Record<string, string> = {
    ocean: "#0d4f66",
    sea: "#1d7f91",
    lake: "#3c94a6",
    coast: "#d3bd78",
    plains: "#b6a864",
    grassland: "#3f9b4f",
    forest: "#2f6f3d",
    hills: "#8d845e",
    mountains: "#77736d",
    desert: "#c8ad6a",
    tundra: "#9aa66f",
    snow: "#d5d9d3",
    wetland: "#5f8e68",
  };
  return colors[resolveIndexHexType(tile)] ?? "#64748b";
}

function resolveIndexHexType(tile: HexTile): string {
  if (hasTag(tile, "water:ocean")) return "ocean";
  if (hasTag(tile, "water:coastal")) return "sea";
  if (hasTag(tile, "water:lake")) return "lake";
  if (hasTag(tile, "morphology:mountainous")) return "mountains";
  if (hasTag(tile, "morphology:rough")) return "hills";
  if (hasTag(tile, "biome:desert")) return "desert";
  if (hasTag(tile, "biome:tundra")) return hasTag(tile, "feature:snow") ? "snow" : "tundra";
  if (hasTag(tile, "biome:grassland")) return "grassland";
  return "plains";
}

function resolveIndexClimate(tile: HexTile): string {
  return tile.mapTags.find((tag) => tag.startsWith("biome:")) ?? tile.mapTags.find((tag) => tag.startsWith("water:")) ?? "biome:plains";
}

function resolveIndexLandscape(tile: HexTile): string {
  return tile.mapTags.find((tag) => tag.startsWith("feature:")) ?? tile.mapTags.find((tag) => tag.startsWith("morphology:")) ?? resolveIndexHexType(tile);
}

function hasTag(tile: HexTile, tag: string): boolean {
  return tile.mapTags.includes(tag as HexTile["mapTags"][number]);
}

function sanitizeRegionId(regionId: string): string {
  return regionId.replace(/[^a-zA-Z0-9_]+/g, "_");
}

function writeJsonIfMissing(path: string, value: unknown): void {
  if (existsSync(path)) return;
  writeJsonFile(path, value);
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
