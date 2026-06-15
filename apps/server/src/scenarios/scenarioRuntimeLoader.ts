import type { WorldBase } from "@arcanorum/shared";
import {
  ensureDefaultCulture,
  ensureDefaultIdeology,
  ensureDefaultRace,
  ensureDefaultReligion,
  ensureDefaultUnemployedProfession,
  normalizeContentAircraftTypes,
  normalizeContentBattalions,
  normalizeContentBuildings,
  normalizeContentCultures,
  normalizeContentGoods,
  normalizeContentRaces,
  normalizeContentShipTypes,
} from "../content/contentNormalizers";
import type { PersistedContentLibrary } from "../persistence/contentLibraryFile";
import type { GameSettings } from "../runtime/gameSettingsTypes";
import { normalizeContentLogoUrl } from "../uploads/uploadPaths";
import { loadRawScenarioContent } from "./scenarioContentLoader";
import {
  buildProvinceOwnerFromRegionHistory,
  buildRegionControllerFromRegionHistory,
  buildRegionOwnerFromRegionHistory,
  buildResourcesByCountryFromHistory,
  loadScenarioHistory,
  type ScenarioHistory,
} from "./scenarioHistoryLoader";
import { loadScenarioSetupFiles } from "./scenarioSetupLoader";

export type BuildWorldBaseFromScenarioRuntimeDeps = {
  defaultWorldBase: (currentTurnId: number) => WorldBase;
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
  return {
    races: ensureDefaultRace(normalizeContentRaces(contentSource.races)),
    resourceCategories: normalizeContentCultures(contentSource.resourceCategories ?? contentSource.resource_categories).map((entry) => ({
      ...entry,
      logoUrl: normalizeContentLogoUrl("resourceCategories", entry.logoUrl),
    })),
    provinceTypes: normalizeContentCultures(contentSource.provinceTypes ?? contentSource.province_types),
    provinceClimates: normalizeContentCultures(contentSource.provinceClimates ?? contentSource.province_climates),
    provinceLandscapes: normalizeContentCultures(contentSource.provinceLandscapes ?? contentSource.province_landscapes),
    provinceContinents: normalizeContentCultures(contentSource.provinceContinents ?? contentSource.province_continents),
    provinceStrategicRegions: normalizeContentCultures(contentSource.provinceStrategicRegions ?? contentSource.province_strategic_regions),
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
    battalions: normalizeContentBattalions(contentSource.battalions),
    shipTypes: normalizeContentShipTypes(contentSource.shipTypes ?? contentSource.ship_types),
    aircraftTypes: normalizeContentAircraftTypes(contentSource.aircraftTypes ?? contentSource.aircraft_types),
  };
}

export function loadScenarioContentForRuntime(params: {
  scenarioDir: string | null;
  getPersistedContentLibrary: () => PersistedContentLibrary | null;
}): GameSettings["content"] | null {
  if (!params.scenarioDir) {
    const activeLibrary = params.getPersistedContentLibrary();
    return activeLibrary?.content ? normalizeScenarioContentForRuntime(activeLibrary.content) : null;
  }
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

export function loadProvinceOwnerFromRegionHistory(history: ScenarioHistory | null): Record<string, string> {
  if (!history) return {};
  return buildProvinceOwnerFromRegionHistory(history);
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
  base.provinceOwner = loadProvinceOwnerFromRegionHistory(history);
  applyAuthoredStateFromHistory(base, history, params);
  if (setup.countryResources) base.resourcesByCountry = params.normalizeResourcesByCountryMap(setup.countryResources);
  if (setup.provinceOwners) base.provinceOwner = normalizeScenarioStringMap(setup.provinceOwners);
  if (setup.provinceNames) base.provinceNameById = normalizeScenarioStringMap(setup.provinceNames);
  if (setup.countryTechnologies) base.technologyByCountry = params.normalizeTechnologyByCountryMap(setup.countryTechnologies);
  if (setup.diplomacy) {
    base.diplomacyProposals = params.normalizeDiplomacyProposals(
      Array.isArray(setup.diplomacy) ? setup.diplomacy : (setup.diplomacy as { proposals?: unknown })?.proposals,
    );
  }
  return base;
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
  base.regionResourceDepositsByRegion = normalizers.normalizeRegionResourceDepositsMap(mapRegionArrayField(history, "resources"));
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
