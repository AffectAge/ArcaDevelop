import { randomUUID } from "node:crypto";
import type {
  CountryDecisionRecord,
  CountryEventRecord,
  DiplomacyProposal,
  ResourceTotals,
  WorldBase,
} from "@arcanorum/shared";
import type { GameSettings } from "./gameSettingsTypes";
import { createWorldStateNormalizers } from "./worldStateNormalizers";

type WorldStateNormalizerRuntimeParams = {
  getTurnId: () => number;
  getGameSettings: () => GameSettings;
};

export function createWorldStateNormalizerRuntime(params: WorldStateNormalizerRuntimeParams): {
  normalizeResourceTotals: (input: unknown) => ResourceTotals;
  normalizeResourcesByCountryMap: (input: unknown) => Record<string, ResourceTotals>;
  normalizeResourceLedgerByTurn: (input: unknown) => WorldBase["resourceLedgerByTurn"];
  normalizeExplanationRecordsByTurn: (input: unknown) => WorldBase["explanationRecordsByTurn"];
  normalizeTechnologyByCountryMap: (input: unknown) => WorldBase["technologyByCountry"];
  normalizeCountryDecisionRecord: (input: unknown) => CountryDecisionRecord;
  normalizeCountryDecisionsMap: (input: unknown) => WorldBase["countryDecisionsByCountryId"];
  normalizeCountryEventRecord: (input: unknown) => CountryEventRecord;
  normalizeCountryEventsMap: (input: unknown) => WorldBase["countryEventsByCountryId"];
  normalizeScheduledCountryEventsMap: (input: unknown) => WorldBase["countryScheduledEventsByCountryId"];
  normalizeCountryEventFlagsMap: (input: unknown) => WorldBase["countryEventFlagsByCountryId"];
  normalizeJournalEntriesMap: (input: unknown) => WorldBase["journalEntriesByCountryId"];
  normalizeCountryModifiersMap: (input: unknown) => WorldBase["countryModifiersByCountryId"];
  normalizeDiplomacyProposals: (input: unknown) => DiplomacyProposal[];
} {
  function getWorldStateNormalizers() {
    const gameSettings = params.getGameSettings();
    return createWorldStateNormalizers({
      turnId: params.getTurnId(),
      createId: randomUUID,
      colonizationPointsPerTurn: gameSettings.colonization.pointsPerTurn,
      baseConstructionPerTurn: gameSettings.economy.baseConstructionPerTurn,
    });
  }

  return {
    normalizeResourceTotals: (input) => getWorldStateNormalizers().normalizeResourceTotals(input),
    normalizeResourcesByCountryMap: (input) => getWorldStateNormalizers().normalizeResourcesByCountryMap(input),
    normalizeResourceLedgerByTurn: (input) => getWorldStateNormalizers().normalizeResourceLedgerByTurn(input),
    normalizeExplanationRecordsByTurn: (input) => getWorldStateNormalizers().normalizeExplanationRecordsByTurn(input),
    normalizeTechnologyByCountryMap: (input) => getWorldStateNormalizers().normalizeTechnologyByCountryMap(input),
    normalizeCountryDecisionRecord: (input) => getWorldStateNormalizers().normalizeCountryDecisionRecord(input),
    normalizeCountryDecisionsMap: (input) => getWorldStateNormalizers().normalizeCountryDecisionsMap(input),
    normalizeCountryEventRecord: (input) => getWorldStateNormalizers().normalizeCountryEventRecord(input),
    normalizeCountryEventsMap: (input) => getWorldStateNormalizers().normalizeCountryEventsMap(input),
    normalizeScheduledCountryEventsMap: (input) => getWorldStateNormalizers().normalizeScheduledCountryEventsMap(input),
    normalizeCountryEventFlagsMap: (input) => getWorldStateNormalizers().normalizeCountryEventFlagsMap(input),
    normalizeJournalEntriesMap: (input) => getWorldStateNormalizers().normalizeJournalEntriesMap(input),
    normalizeCountryModifiersMap: (input) => getWorldStateNormalizers().normalizeCountryModifiersMap(input),
    normalizeDiplomacyProposals: (input) => getWorldStateNormalizers().normalizeDiplomacyProposals(input),
  };
}
