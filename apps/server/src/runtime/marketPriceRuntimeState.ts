import { createEmptyMarketOverviewState, type MarketOverviewState } from "../mechanics/marketTurnMechanics";

export type PriceScopeState = Record<string, Record<string, number>>;

export type MarketPriceRuntimeState = {
  countryGoodPrices: PriceScopeState;
  globalGoodPrices: Record<string, number>;
  globalGoodPriceHistoryByResourceId: Record<string, number[]>;
  globalGoodDemandHistoryByResourceId: Record<string, number[]>;
  globalGoodOfferHistoryByResourceId: Record<string, number[]>;
  globalGoodProductionFactHistoryByResourceId: Record<string, number[]>;
  globalGoodProductionMaxHistoryByResourceId: Record<string, number[]>;
  getLatestMarketOverview: () => MarketOverviewState;
  setLatestMarketOverview: (overview: MarketOverviewState) => void;
};

export function createMarketPriceRuntimeState(): MarketPriceRuntimeState {
  let latestMarketOverview: MarketOverviewState = createEmptyMarketOverviewState(1);

  return {
    countryGoodPrices: {},
    globalGoodPrices: {},
    globalGoodPriceHistoryByResourceId: {},
    globalGoodDemandHistoryByResourceId: {},
    globalGoodOfferHistoryByResourceId: {},
    globalGoodProductionFactHistoryByResourceId: {},
    globalGoodProductionMaxHistoryByResourceId: {},
    getLatestMarketOverview: () => latestMarketOverview,
    setLatestMarketOverview: (overview) => {
      latestMarketOverview = overview;
    },
  };
}
