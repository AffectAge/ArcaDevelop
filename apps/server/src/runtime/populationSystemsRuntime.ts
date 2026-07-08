import type { WorldBase } from "@arcanorum/shared";
import type { HexMapIndexEntry } from "../map/hexIndex";
import type { GameSettings } from "./gameSettingsTypes";
import type { MarketPriceRuntimeState } from "./marketPriceRuntimeState";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";
import { createWorldPopulationRuntime } from "./worldPopulationRuntime";

type PopulationSystemsRuntimeParams = {
  getGameSettings: () => GameSettings;
  getWorldBase: () => WorldBase;
  getTurnId: () => number;
  getHexIndex: () => HexMapIndexEntry[];
  getHexOwner: (hexId: string) => string | null;
  marketPriceRuntimeState: MarketPriceRuntimeState;
  getActiveCountryModifierRows: Parameters<typeof createWorldPopulationRuntime>[0]["getActiveCountryModifierRows"];
  ensureCountryParliament: Parameters<typeof createWorldPopulationRuntime>[0]["ensureCountryParliament"];
  ensureCountryInWorldBase: Parameters<typeof createWorldPopulationRuntime>[0]["ensureCountryInWorldBase"];
  createDefaultMarketRecord: Parameters<typeof createWorldPopulationRuntime>[0]["createDefaultMarketRecord"];
  getBuildingMaxDurability: Parameters<typeof createWorldPopulationRuntime>[0]["getBuildingMaxDurability"];
  getBuildingPollutionProductivityFactor: Parameters<typeof createWorldPopulationRuntime>[0]["getBuildingPollutionProductivityFactor"];
  getCountryMarketId: Parameters<typeof createWorldPopulationRuntime>[0]["getCountryMarketId"];
  getInfrastructureTransitAgreementAllowedCountries: Parameters<
    typeof createWorldPopulationRuntime
  >[0]["getInfrastructureTransitAgreementAllowedCountries"];
  getMarketById: Parameters<typeof createWorldPopulationRuntime>[0]["getMarketById"];
  getHexFertilityMultiplier: Parameters<typeof createWorldPopulationRuntime>[0]["getHexFertilityMultiplier"];
  getTransportCorridorCapacity: Parameters<typeof createWorldPopulationRuntime>[0]["getTransportCorridorCapacity"];
  normalizeHexIdList: Parameters<typeof createWorldPopulationRuntime>[0]["normalizeHexIdList"];
  resolveModifiedValue: Parameters<typeof createWorldPopulationRuntime>[0]["resolveModifiedValue"];
  round3: (value: number) => number;
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
  flushResourceLedger?: () => void;
  buildingBaseThroughput: number;
  buildingBaseWagePerWorkerGold: number;
  buildingDurabilityDecayPerTurnFallback: number;
  buildingDurabilityRecoveryPerTurnFallback: number;
  corridorLoadHistoryLength: number;
  defaultMarketPriceSmoothing: number;
};

export function createPopulationSystemsRuntime(params: PopulationSystemsRuntimeParams): {
  worldPopulationRuntime: ReturnType<typeof createWorldPopulationRuntime>;
} {
  const worldPopulationRuntime = createWorldPopulationRuntime({
    getGameSettings: params.getGameSettings,
    getWorldBase: params.getWorldBase,
    getTurnId: params.getTurnId,
    getHexIndex: params.getHexIndex,
    getHexOwner: params.getHexOwner,
    setLatestMarketOverview: params.marketPriceRuntimeState.setLatestMarketOverview,
    getActiveCountryModifierRows: params.getActiveCountryModifierRows,
    ensureCountryParliament: params.ensureCountryParliament,
    ensureCountryInWorldBase: params.ensureCountryInWorldBase,
    createDefaultMarketRecord: params.createDefaultMarketRecord,
    getBuildingMaxDurability: params.getBuildingMaxDurability,
    getBuildingPollutionProductivityFactor: params.getBuildingPollutionProductivityFactor,
    getCountryMarketId: params.getCountryMarketId,
    getInfrastructureTransitAgreementAllowedCountries: params.getInfrastructureTransitAgreementAllowedCountries,
    getMarketById: params.getMarketById,
    getHexFertilityMultiplier: params.getHexFertilityMultiplier,
    getTransportCorridorCapacity: params.getTransportCorridorCapacity,
    normalizeHexIdList: params.normalizeHexIdList,
    resolveModifiedValue: params.resolveModifiedValue,
    round3: params.round3,
    addResourceLedgerExpense: params.addResourceLedgerExpense,
    flushResourceLedger: params.flushResourceLedger,
    buildingBaseThroughput: params.buildingBaseThroughput,
    buildingBaseWagePerWorkerGold: params.buildingBaseWagePerWorkerGold,
    buildingDurabilityDecayPerTurnFallback: params.buildingDurabilityDecayPerTurnFallback,
    buildingDurabilityRecoveryPerTurnFallback: params.buildingDurabilityRecoveryPerTurnFallback,
    corridorLoadHistoryLength: params.corridorLoadHistoryLength,
    defaultMarketPriceSmoothing: params.defaultMarketPriceSmoothing,
    countryGoodPrices: params.marketPriceRuntimeState.countryGoodPrices,
    globalGoodPrices: params.marketPriceRuntimeState.globalGoodPrices,
    globalGoodPriceHistoryByResourceId: params.marketPriceRuntimeState.globalGoodPriceHistoryByResourceId,
    globalGoodDemandHistoryByResourceId: params.marketPriceRuntimeState.globalGoodDemandHistoryByResourceId,
    globalGoodOfferHistoryByResourceId: params.marketPriceRuntimeState.globalGoodOfferHistoryByResourceId,
    globalGoodProductionFactHistoryByResourceId: params.marketPriceRuntimeState.globalGoodProductionFactHistoryByResourceId,
    globalGoodProductionMaxHistoryByResourceId: params.marketPriceRuntimeState.globalGoodProductionMaxHistoryByResourceId,
  });

  return { worldPopulationRuntime };
}
