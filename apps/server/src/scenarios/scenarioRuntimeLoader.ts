import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { enrichHexMapVisualMetadata, type HexMapArtifact, type WorldBase } from "@arcanorum/shared";
import {
  ensureDefaultCulture,
  ensureDefaultIdeology,
  ensureDefaultRace,
  ensureDefaultReligion,
  ensureDefaultUnemployedProfession,
  normalizeContentAssets,
  normalizeContentBuildings,
  normalizeContentCultures,
  normalizeContentGoods,
  normalizeContentRaces,
  normalizeContentUnitSkills,
  normalizeContentUnitSkillTrees,
  normalizeContentUnitTypes,
} from "../content/contentNormalizers";
import type { GameSettings } from "../runtime/gameSettingsTypes";
import { normalizeContentLogoUrl } from "../uploads/uploadPaths";
import { ensureStarterColonizerForCountry } from "../mechanics/starterColonizerMechanics";
import { loadRawScenarioContent } from "./scenarioContentLoader";
import { ensureGeneratedResourceDeposits, loadGeneratedResourceDeposits } from "./resourceDepositGeneration";
import {
  buildHexOwnerFromRegionHistory,
  buildCountryPopulationAcceptanceFromHistory,
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
  return {
    assets: normalizeContentAssets(contentSource.assets),
    races: ensureDefaultRace(normalizeContentRaces(contentSource.races)),
    cultureGroups: normalizeContentCultures(contentSource.cultureGroups ?? contentSource.culture_groups),
    religionGroups: normalizeContentCultures(contentSource.religionGroups ?? contentSource.religion_groups),
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
    unitSkills: normalizeContentUnitSkills(contentSource.unitSkills ?? contentSource.unit_skills),
    unitSkillTrees: normalizeContentUnitSkillTrees(contentSource.unitSkillTrees ?? contentSource.unit_skill_trees),
    unitTypes: normalizeContentUnitTypes(contentSource.unitTypes ?? contentSource.unit_types),
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

function applyScenarioCountryIdentity(base: WorldBase): void {
  base.countryIdentityByCountryId ??= {};
  base.countryPopulationAcceptanceByCountryId ??= {};
  for (const countryId of Object.keys(base.resourcesByCountry)) {
    const cultureId = `culture:${countryId}`;
    const religionId = `religion:${countryId}`;
    const raceId = "race:default";
    base.countryIdentityByCountryId[countryId] = {
      cultureId,
      religionId,
      raceId,
      cultureGroupId: "culture_group:riverine_city_states",
      religionGroupId: "religion_group:temple_cults",
    };
    const acceptance = base.countryPopulationAcceptanceByCountryId[countryId] ?? {
      acceptedCultureIds: [],
      acceptedReligionIds: [],
      acceptedRaceIds: [],
    };
    base.countryPopulationAcceptanceByCountryId[countryId] = {
      acceptedCultureIds: [...new Set([...acceptance.acceptedCultureIds, cultureId])],
      acceptedReligionIds: [...new Set([...acceptance.acceptedReligionIds, religionId])],
      acceptedRaceIds: [...new Set([...acceptance.acceptedRaceIds, raceId])],
    };
  }
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
  base.countryPopulationAcceptanceByCountryId = buildCountryPopulationAcceptanceFromHistory(history);
  applyScenarioCountryIdentity(base);
  applyAuthoredStateFromHistory(base, history, params);
  applyScenarioPopulationFiles(base, params);
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
    | "normalizeRegionBuildingsMap"
    | "normalizeRegionBuildingDucatsMap"
    | "normalizeRegionPopulationTreasuryMap"
    | "normalizeRegionConstructionQueueMap"
    | "normalizeRegionResourceDepositsMap"
  >,
): void {
  if (!history || history.regions.length === 0) return;
  base.regionColonizationByRegion = normalizers.normalizeRegionColonizationMap(mapRegionField(history, "colonization"));
  base.regionBuildingsByRegion = normalizers.normalizeRegionBuildingsMap(mapRegionArrayField(history, "buildings"));
  base.regionBuildingDucatsByRegion = normalizers.normalizeRegionBuildingDucatsMap(mapRegionObjectField(history, "buildingDucats"));
  base.regionPopulationTreasuryByRegion = normalizers.normalizeRegionPopulationTreasuryMap(mapRegionField(history, "populationTreasury"));
  base.regionConstructionQueueByRegion = normalizers.normalizeRegionConstructionQueueMap(mapRegionArrayField(history, "construction"));
  base.regionResourceDepositsByRegion = normalizers.normalizeRegionResourceDepositsMap(mapRegionArrayField(history, "resourceDeposits"));
}

function applyScenarioPopulationFiles(
  base: WorldBase,
  params: {
    scenarioDir: string | null;
    normalizeRegionPopulationMap: (input: unknown) => WorldBase["regionPopulationByRegion"];
  },
): void {
  if (!params.scenarioDir) return;
  const rows = loadScenarioPopulationRows(params.scenarioDir);
  if (Object.keys(rows).length === 0) return;
  base.regionPopulationByRegion = {
    ...base.regionPopulationByRegion,
    ...params.normalizeRegionPopulationMap(rows),
  };
}

function loadScenarioPopulationRows(scenarioDir: string): Record<string, unknown> {
  const populationDir = resolve(scenarioDir, "common", "populations");
  if (!existsSync(populationDir)) return {};
  const rows: Record<string, unknown> = {};
  for (const entry of listJsonObjectsRecursively(populationDir)) {
    const candidates = Array.isArray(entry.regions) ? entry.regions : [entry];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
      const row = candidate as Record<string, unknown>;
      const regionId = typeof row.regionId === "string" ? row.regionId.trim() : "";
      if (!regionId) throw new Error("population-file-missing-regionId");
      rows[regionId] = { pops: Array.isArray(row.pops) ? row.pops : [] };
    }
  }
  return rows;
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

function listJsonObjectsRecursively(dir: string): Record<string, unknown>[] {
  if (!existsSync(dir)) return [];
  const result: Record<string, unknown>[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const childPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listJsonObjectsRecursively(childPath));
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
    const parsed = JSON.parse(readFileSync(childPath, "utf8")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) result.push(parsed as Record<string, unknown>);
  }
  return result;
}
