import {
  getGoodDistributionType,
  resolveTradePolicyLayer,
  type MarketGoodContentEntry,
  type MarketTradePolicyLike,
} from "../mechanics/marketTurnMechanics";

export type AiMarketRecord = {
  id: string;
  ownerCountryId: string;
  memberCountryIds: string[];
  warehouseByResourceId?: Record<string, number>;
  priceByResourceId?: Record<string, number>;
  demandHistoryByResourceId?: Record<string, number[]>;
  offerHistoryByResourceId?: Record<string, number[]>;
  worldTradePolicyByResourceId?: Record<string, MarketTradePolicyLike>;
};

export type AiMarketCandidateParams<TGood extends MarketGoodContentEntry = MarketGoodContentEntry> = {
  countryId: string;
  countryMarketByCountryId: Record<string, string>;
  marketById: Record<string, AiMarketRecord>;
  goods: TGood[];
};

export type AiMarketImportCandidate = {
  kind: "market-import";
  countryId: string;
  targetMarketId: string;
  sourceMarketId: string;
  goodId: string;
  shortageAmount: number;
  availableAmount: number;
  suggestedAmount: number;
  estimatedUnitPrice: number;
};

export function selectAiMarketImportCandidates<TGood extends MarketGoodContentEntry>(
  params: AiMarketCandidateParams<TGood>,
): AiMarketImportCandidate[] {
  const targetMarketId = params.countryMarketByCountryId[params.countryId] ?? "";
  const targetMarket = targetMarketId ? params.marketById[targetMarketId] : null;
  if (!targetMarket) return [];

  const goods = [...params.goods]
    .filter((good) => getGoodDistributionType(good) === "tradeable")
    .sort((left, right) => left.id.localeCompare(right.id));
  const sourceMarkets = Object.values(params.marketById)
    .filter((market) => market.id !== targetMarket.id)
    .sort((left, right) => left.id.localeCompare(right.id));
  const candidates: AiMarketImportCandidate[] = [];

  for (const good of goods) {
    const shortageAmount = calculateMarketShortage(targetMarket, good.id);
    if (shortageAmount <= 0) continue;

    for (const sourceMarket of sourceMarkets) {
      const availableAmount = calculateMarketAvailableExport(sourceMarket, good.id);
      if (availableAmount <= 0) continue;
      const policyAmount = calculateAllowedPolicyAmount({
        goodId: good.id,
        countryId: params.countryId,
        targetMarket,
        sourceMarket,
      });
      const suggestedAmount = round3(Math.min(shortageAmount, availableAmount, policyAmount));
      if (suggestedAmount <= 0) continue;
      candidates.push({
        kind: "market-import",
        countryId: params.countryId,
        targetMarketId: targetMarket.id,
        sourceMarketId: sourceMarket.id,
        goodId: good.id,
        shortageAmount,
        availableAmount,
        suggestedAmount,
        estimatedUnitPrice: getMarketGoodPrice(sourceMarket, good.id),
      });
    }
  }

  return candidates.sort(compareMarketImportCandidates);
}

function calculateAllowedPolicyAmount(params: {
  goodId: string;
  countryId: string;
  targetMarket: AiMarketRecord;
  sourceMarket: AiMarketRecord;
}): number {
  const importPolicy = resolveTradePolicyLayer(
    params.targetMarket.worldTradePolicyByResourceId?.[params.goodId],
    params.sourceMarket.id,
    params.sourceMarket.ownerCountryId,
  );
  if (!importPolicy.allowImportFromWorld) return 0;

  const exportPolicy = resolveTradePolicyLayer(
    params.sourceMarket.worldTradePolicyByResourceId?.[params.goodId],
    params.targetMarket.id,
    params.countryId,
  );
  if (!exportPolicy.allowExportToWorld) return 0;

  return Math.min(
    importPolicy.maxImportAmountPerTurnFromWorld ?? Number.POSITIVE_INFINITY,
    exportPolicy.maxExportAmountPerTurnToWorld ?? Number.POSITIVE_INFINITY,
  );
}

function calculateMarketShortage(market: AiMarketRecord, goodId: string): number {
  const demand = getLatestMarketAmount(market.demandHistoryByResourceId?.[goodId]);
  const offer = Math.max(
    getLatestMarketAmount(market.offerHistoryByResourceId?.[goodId]),
    getPositiveAmount(market.warehouseByResourceId?.[goodId]),
  );
  return round3(Math.max(0, demand - offer));
}

function calculateMarketAvailableExport(market: AiMarketRecord, goodId: string): number {
  const offer = Math.max(
    getLatestMarketAmount(market.offerHistoryByResourceId?.[goodId]),
    getPositiveAmount(market.warehouseByResourceId?.[goodId]),
  );
  const demand = getLatestMarketAmount(market.demandHistoryByResourceId?.[goodId]);
  return round3(Math.max(0, offer - demand));
}

function getLatestMarketAmount(history: number[] | undefined): number {
  if (!Array.isArray(history) || history.length === 0) return 0;
  return getPositiveAmount(history[history.length - 1]);
}

function getMarketGoodPrice(market: AiMarketRecord, goodId: string): number {
  return getPositiveAmount(market.priceByResourceId?.[goodId]);
}

function getPositiveAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function compareMarketImportCandidates(left: AiMarketImportCandidate, right: AiMarketImportCandidate): number {
  return (
    left.goodId.localeCompare(right.goodId) ||
    right.suggestedAmount - left.suggestedAmount ||
    left.sourceMarketId.localeCompare(right.sourceMarketId)
  );
}
