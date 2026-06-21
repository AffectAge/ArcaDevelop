import type { ResourceBalance, ResourceFlow, ResourceId, ResourceTotals } from "@arcanorum/shared";

export const RESOURCE_IDS: ResourceId[] = [
  "culture",
  "science",
  "religion",
  "colonization",
  "construction",
  "ducats",
  "gold",
];

const RESOURCE_ID_SET = new Set<ResourceId>(RESOURCE_IDS);

export function roundResourceLedgerAmount(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}

export function normalizeResourceFlow(input: ResourceFlow): ResourceFlow {
  const countryId = input.countryId.trim();
  const sourceId = input.sourceId.trim();
  const categoryId = input.categoryId.trim();
  const labelKey = input.labelKey.trim();
  if (!countryId) throw new Error("INVALID_RESOURCE_FLOW_COUNTRY");
  if (!RESOURCE_ID_SET.has(input.resourceId)) throw new Error("INVALID_RESOURCE_FLOW_RESOURCE");
  if (input.direction !== "income" && input.direction !== "expense") throw new Error("INVALID_RESOURCE_FLOW_DIRECTION");
  if (!Number.isInteger(input.turnId) || input.turnId < 1) throw new Error("INVALID_RESOURCE_FLOW_TURN");
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("INVALID_RESOURCE_FLOW_AMOUNT");
  }
  if (!sourceId) throw new Error("INVALID_RESOURCE_FLOW_SOURCE");
  if (!categoryId) throw new Error("INVALID_RESOURCE_FLOW_CATEGORY");
  if (!labelKey) throw new Error("INVALID_RESOURCE_FLOW_LABEL");
  return {
    ...input,
    countryId,
    sourceId,
    categoryId,
    labelKey,
    amount: roundResourceLedgerAmount(input.amount),
  };
}

export function calculateResourceBalance(params: {
  resourceId: ResourceId;
  entries: ResourceFlow[];
  countryId?: string;
}): ResourceBalance {
  const entries = params.entries
    .map(normalizeResourceFlow)
    .filter((entry) => entry.resourceId === params.resourceId && (!params.countryId || entry.countryId === params.countryId));
  const incomesByCategory: Record<string, number> = {};
  const expensesByCategory: Record<string, number> = {};
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const entry of entries) {
    if (entry.direction === "income") {
      incomeTotal = roundResourceLedgerAmount(incomeTotal + entry.amount);
      incomesByCategory[entry.categoryId] = roundResourceLedgerAmount((incomesByCategory[entry.categoryId] ?? 0) + entry.amount);
    } else {
      expenseTotal = roundResourceLedgerAmount(expenseTotal + entry.amount);
      expensesByCategory[entry.categoryId] = roundResourceLedgerAmount((expensesByCategory[entry.categoryId] ?? 0) + entry.amount);
    }
  }

  return {
    resourceId: params.resourceId,
    incomeTotal,
    expenseTotal,
    net: roundResourceLedgerAmount(incomeTotal - expenseTotal),
    incomesByCategory,
    expensesByCategory,
    entries,
  };
}

export function applyResourceFlowsToTotals(params: {
  resourcesByCountry: Record<string, ResourceTotals | undefined>;
  flows: ResourceFlow[];
}): void {
  for (const flow of params.flows.map(normalizeResourceFlow)) {
    const totals = params.resourcesByCountry[flow.countryId];
    if (!totals) continue;
    const current = Math.max(0, Number(totals[flow.resourceId] ?? 0));
    const next = flow.direction === "income" ? current + flow.amount : current - flow.amount;
    totals[flow.resourceId] = roundResourceLedgerAmount(Math.max(0, next));
  }
}

export function pruneResourceLedgerByTurn(params: {
  ledgerByTurn: Record<number, ResourceFlow[]>;
  currentTurnId: number;
  retentionTurns: number;
}): Record<number, ResourceFlow[]> {
  const retentionTurns = Math.max(1, Math.floor(params.retentionTurns));
  const minTurnId = Math.max(1, Math.floor(params.currentTurnId) - retentionTurns + 1);
  const next: Record<number, ResourceFlow[]> = {};
  for (const [turnIdText, flows] of Object.entries(params.ledgerByTurn ?? {})) {
    const turnId = Number(turnIdText);
    if (!Number.isInteger(turnId) || turnId < minTurnId) continue;
    next[turnId] = Array.isArray(flows) ? flows.map(normalizeResourceFlow) : [];
  }
  return next;
}
