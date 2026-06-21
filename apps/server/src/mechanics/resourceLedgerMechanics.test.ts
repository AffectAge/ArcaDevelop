import { describe, expect, it } from "vitest";
import type { ResourceFlow, ResourceTotals } from "@arcanorum/shared";
import {
  applyResourceFlowsToTotals,
  calculateResourceBalance,
  normalizeResourceFlow,
  pruneResourceLedgerByTurn,
} from "./resourceLedgerMechanics";

describe("resourceLedgerMechanics", () => {
  it("calculates income, expense, net, and category groups", () => {
    const entries: ResourceFlow[] = [
      makeFlow({ amount: 10, direction: "income", categoryId: "education" }),
      makeFlow({ amount: 5, direction: "income", categoryId: "laws" }),
      makeFlow({ amount: 7, direction: "expense", categoryId: "research" }),
    ];

    const balance = calculateResourceBalance({ countryId: "country:a", resourceId: "science", entries });

    expect(balance.incomeTotal).toBe(15);
    expect(balance.expenseTotal).toBe(7);
    expect(balance.net).toBe(8);
    expect(balance.incomesByCategory).toEqual({ education: 10, laws: 5 });
    expect(balance.expensesByCategory).toEqual({ research: 7 });
    expect(balance.entries).toHaveLength(3);
  });

  it("normalizes positive finite flows and rejects invalid flows", () => {
    expect(normalizeResourceFlow(makeFlow({ amount: 1.23456 }))?.amount).toBe(1.235);
    expect(normalizeResourceFlow(makeFlow({ amount: 0 }))?.amount).toBe(0);
    expect(() => normalizeResourceFlow(makeFlow({ amount: -1 }))).toThrow("INVALID_RESOURCE_FLOW_AMOUNT");
    expect(() => normalizeResourceFlow(makeFlow({ amount: Number.POSITIVE_INFINITY }))).toThrow("INVALID_RESOURCE_FLOW_AMOUNT");
    expect(() => normalizeResourceFlow(makeFlow({ resourceId: "unknown" as "science" }))).toThrow("INVALID_RESOURCE_FLOW_RESOURCE");
    expect(() => normalizeResourceFlow(makeFlow({ countryId: "" }))).toThrow("INVALID_RESOURCE_FLOW_COUNTRY");
  });

  it("applies net flows to current country totals", () => {
    const resourcesByCountry: Record<string, ResourceTotals> = {
      "country:a": makeResources({ science: 12, ducats: 4 }),
    };

    applyResourceFlowsToTotals({
      resourcesByCountry,
      flows: [
        makeFlow({ resourceId: "science", direction: "income", amount: 5 }),
        makeFlow({ resourceId: "science", direction: "expense", amount: 20 }),
        makeFlow({ resourceId: "ducats", direction: "income", amount: 3 }),
      ],
    });

    expect(resourcesByCountry["country:a"]).toMatchObject({ science: 0, ducats: 7 });
  });

  it("prunes old turns while keeping bounded recent history", () => {
    const ledgerByTurn = {
      1: [makeFlow({ turnId: 1 })],
      2: [makeFlow({ turnId: 2 })],
      3: [makeFlow({ turnId: 3 })],
      4: [makeFlow({ turnId: 4 })],
    };

    expect(pruneResourceLedgerByTurn({ ledgerByTurn, currentTurnId: 4, retentionTurns: 2 })).toEqual({
      3: ledgerByTurn[3],
      4: ledgerByTurn[4],
    });
  });
});

function makeFlow(overrides?: Partial<ResourceFlow>): ResourceFlow {
  return {
    id: "flow:a",
    turnId: 1,
    countryId: "country:a",
    resourceId: "science",
    direction: "income",
    amount: 1,
    sourceType: "base",
    sourceId: "base",
    categoryId: "base",
    labelKey: "resourceLedger.source.generic",
    ...overrides,
  };
}

function makeResources(overrides?: Partial<ResourceTotals>): ResourceTotals {
  return {
    culture: 0,
    science: 0,
    religion: 0,
    colonization: 0,
    construction: 0,
    ducats: 0,
    gold: 0,
    ...overrides,
  };
}
