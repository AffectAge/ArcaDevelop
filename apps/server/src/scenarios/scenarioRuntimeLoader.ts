import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { enrichHexMapVisualMetadata, type HexMapArtifact, type WorldBase } from "@arcanorum/shared";
import {
  ensureDefaultCulture,
  ensureDefaultIdeology,
  ensureDefaultRace,
  ensureDefaultReligion,
  ensureDefaultUnemployedProfession,
  normalizeContentAssets,
  normalizeContentAircraftTypes,
  normalizeContentBattalions,
  normalizeContentBuildings,
  normalizeContentCultures,
  normalizeContentGoods,
  normalizeContentEquipmentClasses,
  normalizeContentEquipmentFrames,
  normalizeContentEquipmentModules,
  normalizeContentRaces,
  normalizeContentShipTypes,
  normalizeContentUnitTypes,
} from "../content/contentNormalizers";
import type { GameSettings } from "../runtime/gameSettingsTypes";
import { normalizeContentLogoUrl } from "../uploads/uploadPaths";
import { ensureStarterColonizerForCountry } from "../mechanics/starterColonizerMechanics";
import { loadRawScenarioContent } from "./scenarioContentLoader";
import { ensureGeneratedResourceDeposits, loadGeneratedResourceDeposits } from "./resourceDepositGeneration";
import {
  buildHexOwnerFromRegionHistory,
  buildRegionControllerFromRegionHistory,
  buildRegionOwnerFromRegionHistory,
  buildResourcesByCountryFromHistory,
  loadScenarioHistory,
  type ScenarioHistory,
} from "./scenarioHistoryLoader";
import { loadScenarioSetupFiles } from "./scenarioSetupLoader";

export type BuildWorldBaseFromScenarioRuntimeDeps = {
  defaultWorldBase: (currentTurnId: number) => WorldBase;
  startingColonizerMovementPoints?: number;
  normalizeResourcesByCountryMap: (input: unknown) => WorldBase["resourcesByCountry"];
  normalizeRegionColonizationMap: (input: unknown) => WorldBase["regionColonizationByRegion"];
  normalizeRegionPopulationMap: (input: unknown) => WorldBase["regionPopulationByRegion"];
  normalizeRegionBuildingsMap: (input: unknown) => WorldBase["regionBuildingsByRegion"];
  normalizeRegionBuildingDucatsMap: (input: unknown) => WorldBase["regionBuildingDucatsByRegion"];
  normalizeRegionPopulationTreasuryMap: (input: unknown) => WorldBase["regionPopulationTreasuryByRegion"];
  normalizeRegionConstructionQueueMap: (input: unknown) => WorldBase["regionConstructionQueueByRegion"];
  normalizeRegionResourceDepositsMap: (input: unknown) => WorldBase["regionResourceDepositsByRegion"];
  normalizeRegionResourceExplorationQueueMap: (input: unknown) => WorldBase["regionResourceExplorationQueueByRegion"];
  normalizeRegionResourceExplorationCountMap: (input: unknown) => WorldBase["regionResourceExplorationCountByRegion"];
  normalizeTechnologyByCountryMap: (input: unknown) => WorldBase["technologyByCountry"];
  normalizeDiplomacyProposals: (input: unknown) => WorldBase["diplomacyProposals"];
};

export function normalizeScenarioContentForRuntime(source: unknown): GameSettings["content"] {
  const contentSource = source && typeof source === "object" ? (source as Record<string, unknown>) : {};
  const equipmentClasses = normalizeContentEquipmentClasses(contentSource.equipmentClasses ?? contentSource.equipment_classes);
  return {
    assets: normalizeContentAssets(contentSource.assets),
    races: ensureDefaultRace(normalizeContentRaces(contentSource.races)),
    resourceCategories: normalizeContentCultures(contentSource.resourceCategories ?? contentSource.resource_categories).map((entry) => ({
      ...entry,
      logoUrl: normalizeContentLogoUrl("resourceCategories", entry.logoUrl),
    })),
    hexTypes: normalizeContentCultures(contentSource.hexTypes ?? contentSource.hex_types),
    hexClimates: normalizeContentCultures(contentSource.hexClimates ?? contentSource.hex_climates),
    hexLandscapes: normalizeContentCultures(contentSource.hexLandscapes ?? contentSource.hex_landscapes),
    hexContinents: normalizeContentCultures(contentSource.hexContinents ?? contentSource.hex_continents),
    hexStrategicRegions: normalizeContentCultures(contentSource.hexStrategicRegions ?? contentSource.hex_strategic_regions),
    professions: ensureDefaultUnemployedProfession(normalizeContentCultures(contentSource.professions)),
    ideologies: ensureDefaultIdeology(normalizeContentCultures(contentSource.ideologies)),
    interestGroups: normalizeContentCultures(contentSource.interestGroups ?? contentSource.interest_groups),
    parties: normalizeContentCultures(contentSource.parties),
    lawGroups: normalizeContentCultures(contentSource.lawGroups ?? contentSource.law_groups),
    laws: normalizeContentCultures(contentSource.laws),
    religions: ensureDefaultReligion(normalizeContentCultures(contentSource.religions)),
    technologies: normalizeContentCultures(contentSource.technologies),
    buildings: normalizeContentBuildings(contentSource.buildings),
    goods: normalizeContentGoods(contentSource.goods),
    companies: normalizeContentCultures(contentSource.companies),
    industries: normalizeContentCultures(contentSource.industries),
    sectors: normalizeContentCultures(contentSource.sectors),
    cultures: ensureDefaultCulture(normalizeContentCultures(contentSource.cultures)),
    modifiers: normalizeContentCultures(contentSource.modifiers),
    decisions: normalizeContentCultures(contentSource.decisions),
    events: normalizeContentCultures(contentSource.events),
    journalEntries: normalizeContentCultures(contentSource.journalEntries ?? contentSource.journal_entries),
    unitTypes: normalizeContentUnitTypes(contentSource.unitTypes ?? contentSource.unit_types),
    battalions: normalizeContentBattalions(contentSource.battalions),
    shipTypes: normalizeContentShipTypes(contentSource.shipTypes ?? contentSource.ship_types),
    aircraftTypes: normalizeContentAircraftTypes(contentSource.aircraftTypes ?? contentSource.aircraft_types),
    equipmentClasses,
    equipmentFrames: normalizeContentEquipmentFrames(contentSource.equipmentFrames ?? contentSource.equipment_frames, equipmentClasses),
    equipmentModules: normalizeContentEquipmentModules(contentSource.equipmentModules ?? contentSource.equipment_modules),
  };
}

export function loadScenarioContentForRuntime(params: {
  scenarioDir: string;
}): GameSettings["content"] | null {
  const rawScenarioContent = loadRawScenarioContent(params.scenarioDir);
  return rawScenarioContent ? normalizeScenarioContentForRuntime(rawScenarioContent) : null;
}

export function normalizeScenarioStringMap(input: unknown): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!input || typeof input !== "object") return normalized;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!key || typeof value !== "string" || !value.trim()) continue;
    normalized[key] = value.trim();
  }
  return normalized;
}

export function loadScenarioHistoryOrNull(scenarioDir: string | null): ScenarioHistory | null {
  return scenarioDir ? loadScenarioHistory(scenarioDir) : null;
}

export function loadHexOwnerFromRegionHistory(history: ScenarioHistory | null): Record<string, string> {
  if (!history) return {};
  return buildHexOwnerFromRegionHistory(history);
}

export function loadRegionOwnerFromRegionHistory(history: ScenarioHistory | null): Record<string, string> {
  if (!history) return {};
  return buildRegionOwnerFromRegionHistory(history);
}

export function loadRegionControllerFromRegionHistory(history: ScenarioHistory | null): Record<string, string> {
  if (!history) return {};
  return buildRegionControllerFromRegionHistory(history);
}

export function loadResourcesByCountryFromHistory(history: ScenarioHistory | null): WorldBase["resourcesByCountry"] {
  if (!history) return {};
  return buildResourcesByCountryFromHistory(history);
}

export function buildWorldBaseFromScenarioRuntime(params: {
  currentTurnId: number;
  scenarioDir: string | null;
  loadedHistory?: ScenarioHistory | null;
} & BuildWorldBaseFromScenarioRuntimeDeps): WorldBase {
  const base = params.defaultWorldBase(params.currentTurnId);
  const setup = loadScenarioSetupFiles(params.scenarioDir);
  const history = params.loadedHistory ?? loadScenarioHistoryOrNull(params.scenarioDir);
  base.resourcesByCountry = loadResourcesByCountryFromHistory(history);
  base.regionOwner = loadRegionOwnerFromRegionHistory(history);
  base.regionController = loadRegionControllerFromRegionHistory(history);
  base.hexOwner = loadHexOwnerFromRegionHistory(history);
  applyAuthoredStateFromHistory(base, history, params);
  applyGeneratedResourceDeposits(base, params);
  if (setup.countryResources) base.resourcesByCountry = params.normalizeResourcesByCountryMap(setup.countryResources);
  if (setup.hexOwners) base.hexOwner = normalizeScenarioStringMap(setup.hexOwners);
  if (setup.hexNames) base.hexNameById = normalizeScenarioStringMap(setup.hexNames);
  if (setup.countryTechnologies) base.technologyByCountry = params.normalizeTechnologyByCountryMap(setup.countryTechnologies);
  if (setup.diplomacy) {
    base.diplomacyProposals = params.normalizeDiplomacyProposals(
      Array.isArray(setup.diplomacy) ? setup.diplomacy : (setup.diplomacy as { proposals?: unknown })?.proposals,
    );
  }
  applyScenarioStarterColonizers(base, {
    currentTurnId: params.currentTurnId,
    history,
    scenarioDir: params.scenarioDir,
    movementPoints: params.startingColonizerMovementPoints,
  });
  return base;
}

function applyScenarioStarterColonizers(
  base: WorldBase,
  params: {
    currentTurnId: number;
    history: ScenarioHistory | null;
    scenarioDir: string | null;
    movementPoints?: number;
  },
): void {
  if (!params.history || params.history.countries.length === 0 || !params.scenarioDir) return;
  const artifact = loadScenarioHexMapArtifact(params.scenarioDir);
  if (!artifact || artifact.tiles.length === 0) return;
  for (const country of params.history.countries) {
    ensureStarterColonizerForCountry({
      worldBase: base,
      countryId: country.id,
      currentTurnId: params.currentTurnId,
      tiles: artifact.tiles,
      movementPoints: params.movementPoints ?? 2,
      seed: params.scenarioDir,
    });
  }
}

function loadScenarioHexMapArtifact(scenarioDir: string): HexMapArtifact | null {
  const path = resolve(scenarioDir, ".generated", "hex-map.json");
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as HexMapArtifact;
  return parsed && Array.isArray(parsed.tiles) ? enrichHexMapVisualMetadata(parsed) : null;
}

function applyAuthoredStateFromHistory(
  base: WorldBase,
  history: ScenarioHistory | null,
  normalizers: Pick<
    BuildWorldBaseFromScenarioRuntimeDeps,
    | "normalizeRegionColonizationMap"
    | "normalizeRegionPopulationMap"
    | "normalizeRegionBuildingsMap"
    | "normalizeRegionBuildingDucatsMap"
    | "normalizeRegionPopulationTreasuryMap"
    | "normalizeRegionConstructionQueueMap"
    | "normalizeRegionResourceDepositsMap"
  >,
): void {
  if (!history || history.regions.length === 0) return;
  base.regionColonizationByRegion = normalizers.normalizeRegionColonizationMap(mapRegionField(history, "colonization"));
  base.regionPopulationByRegion = normalizers.normalizeRegionPopulationMap(mapRegionPopulation(history));
  base.regionBuildingsByRegion = normalizers.normalizeRegionBuildingsMap(mapRegionArrayField(history, "buildings"));
  base.regionBuildingDucatsByRegion = normalizers.normalizeRegionBuildingDucatsMap(mapRegionObjectField(history, "buildingDucats"));
  base.regionPopulationTreasuryByRegion = normalizers.normalizeRegionPopulationTreasuryMap(mapRegionField(history, "populationTreasury"));
  base.regionConstructionQueueByRegion = normalizers.normalizeRegionConstructionQueueMap(mapRegionArrayField(history, "construction"));
  base.regionResourceDepositsByRegion = normalizers.normalizeRegionResourceDepositsMap(mapRegionArrayField(history, "resourceDeposits"));
}

function applyGeneratedResourceDeposits(
  base: WorldBase,
  params: {
    scenarioDir: string | null;
    normalizeRegionResourceDepositsMap: (input: unknown) => WorldBase["regionResourceDepositsByRegion"];
  },
): void {
  if (!params.scenarioDir) return;
  const artifact = loadScenarioHexMapArtifact(params.scenarioDir);
  if (!artifact) return;
  let generated = loadGeneratedResourceDeposits(params.scenarioDir);
  if (Object.keys(generated).length === 0) {
    const content = normalizeScenarioContentForRuntime(loadRawScenarioContent(params.scenarioDir));
    generated = ensureGeneratedResourceDeposits({
      scenarioDir: params.scenarioDir,
      artifact,
      goods: content.goods,
      authoredDepositsByRegion: base.regionResourceDepositsByRegion,
    });
  }
  const normalizedGenerated = params.normalizeRegionResourceDepositsMap(generated);
  const occupiedHexIds = new Set(
    Object.values(base.regionResourceDepositsByRegion)
      .flat()
      .map((deposit) => deposit.hexId),
  );
  for (const [regionId, rows] of Object.entries(normalizedGenerated)) {
    const next = [...(base.regionResourceDepositsByRegion[regionId] ?? [])];
    for (const deposit of rows) {
      if (occupiedHexIds.has(deposit.hexId)) continue;
      next.push(deposit);
      occupiedHexIds.add(deposit.hexId);
    }
    base.regionResourceDepositsByRegion[regionId] = next.sort((a, b) => a.hexId.localeCompare(b.hexId) || a.goodId.localeCompare(b.goodId));
  }
}

function mapRegionPopulation(history: ScenarioHistory): Record<string, unknown> {
  return Object.fromEntries(
    history.regions.map((region) => [
      region.id,
      Array.isArray(region.data.pops) && region.data.pops.length > 0
        ? { pops: region.data.pops }
        : { populationTotal: 0 },
    ]),
  );
}

function mapRegionArrayField(history: ScenarioHistory, field: string): Record<string, unknown> {
  return Object.fromEntries(
    history.regions.map((region) => [region.id, Array.isArray(region.data[field]) ? region.data[field] : []]),
  );
}

function mapRegionObjectField(history: ScenarioHistory, field: string): Record<string, unknown> {
  return Object.fromEntries(
    history.regions.map((region) => [
      region.id,
      region.data[field] && typeof region.data[field] === "object" && !Array.isArray(region.data[field])
        ? region.data[field]
        : {},
    ]),
  );
}

function mapRegionField(history: ScenarioHistory, field: string): Record<string, unknown> {
  return Object.fromEntries(history.regions.map((region) => [region.id, region.data[field]]));
}
