import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import type { WorldBase } from "@arcanorum/shared";
import type { PersistedContentLibrary } from "../persistence/contentLibraryFile";
import {
  buildAiControlledCountryIdsFromHistory,
  buildScenarioCountryMetadata,
  type ScenarioHistory,
} from "../scenarios/scenarioHistoryLoader";
import {
  findScenario as findScenarioInCatalog,
  listScenarios as listScenarioCatalog,
  type FoundScenario,
  type ScenarioDescriptor,
} from "../scenarios/scenarioCatalog";
import {
  buildWorldBaseFromScenarioRuntime,
  loadScenarioContentForRuntime,
} from "../scenarios/scenarioRuntimeLoader";
import type { GameSettings } from "./gameSettingsTypes";

type ScenarioServerRuntimeParams = {
  prisma: PrismaClient;
  dataRoot: string;
  scenariosRoot: string;
  getActiveScenarioId: () => string;
  getPersistedContentLibrary: () => PersistedContentLibrary | null;
  defaultWorldBase: (currentTurnId: number) => WorldBase;
  addEconomyTickCountry: (countryId: string) => void;
  setAiControlledCountryIds: (countryIds: string[]) => void;
  invalidateCountryQueryCache: () => void;
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

export function createScenarioServerRuntime(params: ScenarioServerRuntimeParams): {
  listScenarios: () => ScenarioDescriptor[];
  findScenario: (scenarioId: string) => FoundScenario | null;
  loadScenarioContent: (scenarioDir: string | null) => GameSettings["content"] | null;
  buildWorldBaseFromScenario: (
    currentTurnId: number,
    scenarioDir: string | null,
    loadedHistory?: ScenarioHistory | null,
  ) => WorldBase;
  applyScenarioCountryMetadata: (scenarioDir: string | null, history: ScenarioHistory | null) => Promise<void>;
} {
  function listScenarios(): ScenarioDescriptor[] {
    return listScenarioCatalog({
      dataRoot: params.dataRoot,
      scenariosRoot: params.scenariosRoot,
      activeScenarioId: params.getActiveScenarioId(),
    });
  }

  function findScenario(scenarioId: string): FoundScenario | null {
    return findScenarioInCatalog(scenarioId, {
      dataRoot: params.dataRoot,
      scenariosRoot: params.scenariosRoot,
      activeScenarioId: params.getActiveScenarioId(),
    });
  }

  function loadScenarioContent(scenarioDir: string | null): GameSettings["content"] | null {
    return loadScenarioContentForRuntime({
      scenarioDir,
      getPersistedContentLibrary: params.getPersistedContentLibrary,
    });
  }

  function buildWorldBaseFromScenario(
    currentTurnId: number,
    scenarioDir: string | null,
    loadedHistory?: ScenarioHistory | null,
  ): WorldBase {
    const base = buildWorldBaseFromScenarioRuntime({
      currentTurnId,
      scenarioDir,
      loadedHistory,
      defaultWorldBase: params.defaultWorldBase,
      normalizeResourcesByCountryMap: params.normalizeResourcesByCountryMap,
      normalizeRegionColonizationMap: params.normalizeRegionColonizationMap,
      normalizeRegionPopulationMap: params.normalizeRegionPopulationMap,
      normalizeRegionBuildingsMap: params.normalizeRegionBuildingsMap,
      normalizeRegionBuildingDucatsMap: params.normalizeRegionBuildingDucatsMap,
      normalizeRegionPopulationTreasuryMap: params.normalizeRegionPopulationTreasuryMap,
      normalizeRegionConstructionQueueMap: params.normalizeRegionConstructionQueueMap,
      normalizeRegionResourceDepositsMap: params.normalizeRegionResourceDepositsMap,
      normalizeRegionResourceExplorationQueueMap: params.normalizeRegionResourceExplorationQueueMap,
      normalizeRegionResourceExplorationCountMap: params.normalizeRegionResourceExplorationCountMap,
      normalizeTechnologyByCountryMap: params.normalizeTechnologyByCountryMap,
      normalizeDiplomacyProposals: params.normalizeDiplomacyProposals,
    });
    for (const countryId of Object.keys(base.resourcesByCountry)) {
      params.addEconomyTickCountry(countryId);
    }
    return base;
  }

  async function applyScenarioCountryMetadata(
    scenarioDir: string | null,
    history: ScenarioHistory | null,
  ): Promise<void> {
    params.setAiControlledCountryIds(buildAiControlledCountryIdsFromHistory(history));
    if (!scenarioDir || !history) return;
    const countries = buildScenarioCountryMetadata(scenarioDir, history);
    if (countries.length === 0) return;
    const passwordHash = await bcrypt.hash(randomUUID(), 10);
    for (const country of countries) {
      await params.prisma.country.upsert({
        where: { id: country.id },
        create: {
          id: country.id,
          name: country.name,
          color: country.color,
          flagUrl: country.flagUrl,
          crestUrl: country.crestUrl,
          passwordHash,
          isAdmin: false,
          isRegistrationApproved: true,
        },
        update: {
          name: country.name,
          color: country.color,
          flagUrl: country.flagUrl,
          crestUrl: country.crestUrl,
          isRegistrationApproved: true,
        },
      });
    }
    params.invalidateCountryQueryCache();
  }

  return {
    listScenarios,
    findScenario,
    loadScenarioContent,
    buildWorldBaseFromScenario,
    applyScenarioCountryMetadata,
  };
}
