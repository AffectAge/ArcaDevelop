import { randomUUID } from "node:crypto";
import type {
  ResourceFlow,
  ResourceFlowSourceType,
  ResourceId,
  ResourceTotals,
  WorldBase,
} from "@arcanorum/shared";
import {
  applyResourceFlowsToTotals,
  normalizeResourceFlow,
  pruneResourceLedgerByTurn,
} from "../mechanics/resourceLedgerMechanics";

export type ResourceLedgerEntryInput = {
  countryId: string;
  resourceId: ResourceId;
  amount: number;
  sourceType: ResourceFlowSourceType;
  sourceId: string;
  categoryId: string;
  labelKey: string;
  labelParams?: ResourceFlow["labelParams"];
  metadata?: ResourceFlow["metadata"];
};

export type ResourceLedgerRuntime = ReturnType<typeof createResourceLedgerRuntime>;

export function createResourceLedgerRuntime(params: {
  getWorldBase: () => WorldBase;
  getTurnId: () => number;
  getRetentionTurns: () => number;
  getMaxEntriesPerTurn: () => number;
  createId?: () => string;
}) {
  const createId = params.createId ?? randomUUID;
  let pendingFlows: ResourceFlow[] = [];

  function addFlow(direction: ResourceFlow["direction"], input: ResourceLedgerEntryInput): ResourceFlow | null {
    if (input.amount <= 0) return null;
    const maxEntriesPerTurn = Math.max(1, Math.floor(params.getMaxEntriesPerTurn()));
    if (pendingFlows.length >= maxEntriesPerTurn) {
      throw new Error("RESOURCE_LEDGER_MAX_ENTRIES_PER_TURN_EXCEEDED");
    }
    const flow = normalizeResourceFlow({
      id: createId(),
      turnId: params.getTurnId(),
      direction,
      ...input,
    });
    pendingFlows.push(flow);
    return flow;
  }

  function addIncome(input: ResourceLedgerEntryInput): ResourceFlow | null {
    return addFlow("income", input);
  }

  function addExpense(input: ResourceLedgerEntryInput): ResourceFlow | null {
    return addFlow("expense", input);
  }

  function flushTurn(): ResourceFlow[] {
    const worldBase = params.getWorldBase();
    const turnId = params.getTurnId();
    const flows = pendingFlows.map(normalizeResourceFlow);
    pendingFlows = [];
    if (flows.length === 0) {
      worldBase.resourceLedgerByTurn = pruneResourceLedgerByTurn({
        ledgerByTurn: worldBase.resourceLedgerByTurn ?? {},
        currentTurnId: turnId,
        retentionTurns: params.getRetentionTurns(),
      });
      return [];
    }
    applyResourceFlowsToTotals({
      resourcesByCountry: worldBase.resourcesByCountry as Record<string, ResourceTotals | undefined>,
      flows,
    });
    worldBase.resourceLedgerByTurn = pruneResourceLedgerByTurn({
      ledgerByTurn: {
        ...(worldBase.resourceLedgerByTurn ?? {}),
        [turnId]: [...(worldBase.resourceLedgerByTurn?.[turnId] ?? []), ...flows],
      },
      currentTurnId: turnId,
      retentionTurns: params.getRetentionTurns(),
    });
    return flows;
  }

  function clearPending(): void {
    pendingFlows = [];
  }

  return {
    addExpense,
    addFlow,
    addIncome,
    clearPending,
    flushTurn,
  };
}
