import type { WorldBase } from "@arcanorum/shared";
import type { GameSettings } from "./gameSettingsTypes";
import { createCountryProgressionRuntime } from "./countryProgressionRuntime";
import { createCountryWorldRuntime } from "./countryWorldRuntime";

type CountrySystemsRuntimeParams = {
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  getEconomyTickCountryIds: () => Set<string>;
  normalizeTechnologyByCountryMap: Parameters<typeof createCountryProgressionRuntime>[0]["normalizeTechnologyByCountryMap"];
  normalizeCountryDecisionRecord: Parameters<typeof createCountryProgressionRuntime>[0]["normalizeCountryDecisionRecord"];
  normalizeCountryEventRecord: Parameters<typeof createCountryProgressionRuntime>[0]["normalizeCountryEventRecord"];
  normalizeResourceTotals: Parameters<typeof createCountryWorldRuntime>[0]["normalizeResourceTotals"];
  modifierConditionsMatchCountry: Parameters<typeof createCountryProgressionRuntime>[0]["modifierConditionsMatchCountry"];
  resolveModifiedValue: Parameters<typeof createCountryProgressionRuntime>[0]["resolveModifiedValue"];
  removeQueuedUiNotification: Parameters<typeof createCountryProgressionRuntime>[0]["removeQueuedUiNotification"];
  makeOfficialNews: Parameters<typeof createCountryProgressionRuntime>[0]["makeOfficialNews"];
  savePersistentState: () => void;
};

export function createCountrySystemsRuntime(params: CountrySystemsRuntimeParams): {
  progressionRuntime: ReturnType<typeof createCountryProgressionRuntime>;
  countryWorldRuntime: ReturnType<typeof createCountryWorldRuntime>;
} {
  const progressionRuntime = createCountryProgressionRuntime({
    getWorldBase: params.getWorldBase,
    getGameSettings: params.getGameSettings,
    getTurnId: params.getTurnId,
    normalizeTechnologyByCountryMap: params.normalizeTechnologyByCountryMap,
    normalizeCountryDecisionRecord: params.normalizeCountryDecisionRecord,
    normalizeCountryEventRecord: params.normalizeCountryEventRecord,
    modifierConditionsMatchCountry: params.modifierConditionsMatchCountry,
    resolveModifiedValue: params.resolveModifiedValue,
    removeQueuedUiNotification: params.removeQueuedUiNotification,
    makeOfficialNews: params.makeOfficialNews,
  });

  const countryWorldRuntime = createCountryWorldRuntime({
    getWorldBase: params.getWorldBase,
    getGameSettings: params.getGameSettings,
    getEconomyTickCountryIds: params.getEconomyTickCountryIds,
    normalizeResourceTotals: params.normalizeResourceTotals,
    ensureCountryParliament: progressionRuntime.ensureCountryParliament,
    ensureCountryTechnologyState: progressionRuntime.ensureCountryTechnologyState,
    ensureCountryDecisionRecord: progressionRuntime.ensureCountryDecisionRecord,
    ensureCountryEventRecord: progressionRuntime.ensureCountryEventRecord,
    savePersistentState: params.savePersistentState,
  });

  return { progressionRuntime, countryWorldRuntime };
}
