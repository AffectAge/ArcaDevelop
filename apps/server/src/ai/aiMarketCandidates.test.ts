import { describe, expect, it } from "vitest";
import { selectAiMarketImportCandidates, type AiMarketRecord } from "./aiMarketCandidates";

const goods = [
  { id: "good:grain", distributionType: "tradeable" as const },
  { id: "good:services", distributionType: "service" as const },
];

const baseMarkets: Record<string, AiMarketRecord> = {
  "market:target": {
    id: "market:target",
    ownerCountryId: "country:alpha",
    memberCountryIds: ["country:alpha"],
    priceByResourceId: { "good:grain": 12 },
    demandHistoryByResourceId: { "good:grain": [10] },
    offerHistoryByResourceId: { "good:grain": [3] },
  },
  "market:source": {
    id: "market:source",
    ownerCountryId: "country:beta",
    memberCountryIds: ["country:beta"],
    priceByResourceId: { "good:grain": 8 },
    demandHistoryByResourceId: { "good:grain": [2] },
    offerHistoryByResourceId: { "good:grain": [9] },
  },
};

describe("AI market candidates", () => {
  it("selects deterministic import candidates from shortage and surplus markets without mutation", () => {
    const marketById = JSON.parse(JSON.stringify(baseMarkets)) as Record<string, AiMarketRecord>;
    const before = JSON.stringify(marketById);

    const candidates = selectAiMarketImportCandidates({
      countryId: "country:alpha",
      countryMarketByCountryId: { "country:alpha": "market:target" },
      marketById,
      goods,
    });

    expect(candidates).toEqual([
      {
        kind: "market-import",
        countryId: "country:alpha",
        targetMarketId: "market:target",
        sourceMarketId: "market:source",
        goodId: "good:grain",
        shortageAmount: 7,
        availableAmount: 7,
        suggestedAmount: 7,
        estimatedUnitPrice: 8,
      },
    ]);
    expect(JSON.stringify(marketById)).toBe(before);
  });

  it("filters non-tradeable goods and markets with no surplus", () => {
    const candidates = selectAiMarketImportCandidates({
      countryId: "country:alpha",
      countryMarketByCountryId: { "country:alpha": "market:target" },
      marketById: {
        ...baseMarkets,
        "market:no-surplus": {
          id: "market:no-surplus",
          ownerCountryId: "country:gamma",
          memberCountryIds: ["country:gamma"],
          demandHistoryByResourceId: { "good:grain": [5] },
          offerHistoryByResourceId: { "good:grain": [5] },
        },
      },
      goods,
    });

    expect(candidates.map((candidate) => candidate.goodId)).toEqual(["good:grain"]);
    expect(candidates.map((candidate) => candidate.sourceMarketId)).toEqual(["market:source"]);
  });

  it("obeys import and export policy caps", () => {
    const candidates = selectAiMarketImportCandidates({
      countryId: "country:alpha",
      countryMarketByCountryId: { "country:alpha": "market:target" },
      marketById: {
        "market:target": {
          ...baseMarkets["market:target"],
          worldTradePolicyByResourceId: {
            "good:grain": { allowImportFromWorld: true, maxImportAmountPerTurnFromWorld: 4 },
          },
        },
        "market:source": {
          ...baseMarkets["market:source"],
          worldTradePolicyByResourceId: {
            "good:grain": { allowExportToWorld: true, maxExportAmountPerTurnToWorld: 3 },
          },
        },
      },
      goods,
    });

    expect(candidates[0]?.suggestedAmount).toBe(3);
  });

  it("returns no candidates without a country market or when trade is banned", () => {
    expect(
      selectAiMarketImportCandidates({
        countryId: "country:landless",
        countryMarketByCountryId: {},
        marketById: baseMarkets,
        goods,
      }),
    ).toEqual([]);

    expect(
      selectAiMarketImportCandidates({
        countryId: "country:alpha",
        countryMarketByCountryId: { "country:alpha": "market:target" },
        marketById: {
          ...baseMarkets,
          "market:target": {
            ...baseMarkets["market:target"],
            worldTradePolicyByResourceId: {
              "good:grain": { allowImportFromWorld: false },
            },
          },
        },
        goods,
      }),
    ).toEqual([]);
  });
});
