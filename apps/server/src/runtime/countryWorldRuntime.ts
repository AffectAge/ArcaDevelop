import type {
  CountryDecisionRecord,
  CountryEventRecord,
  ResourceTotals,
  WorldBase,
} from "@arcanorum/shared";
import type { GameSettings } from "./gameSettingsTypes";

type CountryWorldRuntimeParams = {
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getEconomyTickCountryIds: () => Set<string>;
  normalizeResourceTotals: (input: unknown) => ResourceTotals;
  ensureCountryParliament: (countryId: string) => unknown;
  ensureCountryTechnologyState: (countryId: string) => WorldBase["technologyByCountry"][string];
  ensureCountryDecisionRecord: (countryId: string) => CountryDecisionRecord;
  ensureCountryEventRecord: (countryId: string) => CountryEventRecord;
  savePersistentState: () => void;
};

export function createCountryWorldRuntime(params: CountryWorldRuntimeParams) {
  function ensureCountryInWorldBase(countryId: string): void {
    const worldBase = params.getWorldBase();
    const existing = worldBase.resourcesByCountry[countryId];
    if (!existing) {
      const gameSettings = params.getGameSettings();
      worldBase.resourcesByCountry[countryId] = {
        culture: 5,
        science: 5,
        religion: 5,
        colonization: gameSettings.colonization.pointsPerTurn,
        construction: gameSettings.economy.baseConstructionPerTurn,
        ducats: 20,
        gold: 80,
      };
      params.ensureCountryParliament(countryId);
      params.ensureCountryTechnologyState(countryId);
      params.ensureCountryDecisionRecord(countryId);
      params.getEconomyTickCountryIds().add(countryId);
      params.savePersistentState();
      return;
    }

    const normalized = params.normalizeResourceTotals(existing);
    if (
      normalized.culture !== existing.culture ||
      normalized.science !== existing.science ||
      normalized.religion !== existing.religion ||
      normalized.colonization !== existing.colonization ||
      normalized.construction !== existing.construction ||
      normalized.ducats !== existing.ducats ||
      normalized.gold !== existing.gold
    ) {
      worldBase.resourcesByCountry[countryId] = normalized;
      params.savePersistentState();
    }

    params.ensureCountryParliament(countryId);
    params.ensureCountryTechnologyState(countryId);
    params.ensureCountryDecisionRecord(countryId);
    params.ensureCountryEventRecord(countryId);
    params.getEconomyTickCountryIds().add(countryId);
  }

  function rebuildEconomyTickCountryIndexFromWorldBase(): void {
    const economyTickCountryIds = params.getEconomyTickCountryIds();
    economyTickCountryIds.clear();
    for (const countryId of Object.keys(params.getWorldBase().resourcesByCountry)) {
      economyTickCountryIds.add(countryId);
    }
  }

  function addCountryToEconomyTick(countryId: string): void {
    params.getEconomyTickCountryIds().add(countryId);
  }

  function removeCountryFromEconomyTick(countryId: string): void {
    params.getEconomyTickCountryIds().delete(countryId);
  }

  return {
    addCountryToEconomyTick,
    ensureCountryInWorldBase,
    rebuildEconomyTickCountryIndexFromWorldBase,
    removeCountryFromEconomyTick,
  };
}
