import type { WorldBase } from "@arcanorum/shared";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import type { GameSettings } from "./gameSettingsTypes";
import type { MarketPriceRuntimeState } from "./marketPriceRuntimeState";
import { createWorldPopulationRuntime } from "./worldPopulationRuntime";

type PopulationSystemsRuntimeParams = {
  getGameSettings: () => GameSettings;
  getWorldBase: () => WorldBase;
  getTurnId: () => number;
  getProvinceIndex: () => Adm1ProvinceIndexEntry[];
  getProvinceAreaKm2: (provinceId: string) => number;
  getProvinceOwner: (provinceId: string) => string | null;
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
  getProvinceFertilityMultiplier: Parameters<typeof createWorldPopulationRuntime>[0]["getProvinceFertilityMultiplier"];
  getTransportCorridorCapacity: Parameters<typeof createWorldPopulationRuntime>[0]["getTransportCorridorCapacity"];
  normalizeProvinceIdList: Parameters<typeof createWorldPopulationRuntime>[0]["normalizeProvinceIdList"];
  resolveModifiedValue: Parameters<typeof createWorldPopulationRuntime>[0]["resolveModifiedValue"];
  round3: (value: number) => number;
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
    getProvinceIndex: params.getProvinceIndex,
    getProvinceAreaKm2: params.getProvinceAreaKm2,
    getProvinceOwner: params.getProvinceOwner,
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
    getProvinceFertilityMultiplier: params.getProvinceFertilityMultiplier,
    getTransportCorridorCapacity: params.getTransportCorridorCapacity,
    normalizeProvinceIdList: params.normalizeProvinceIdList,
    resolveModifiedValue: params.resolveModifiedValue,
    round3: params.round3,
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
