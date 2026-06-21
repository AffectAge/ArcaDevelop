import type {
  ActiveJournalEntry,
  CountryJournalState,
  EventTriggerExplanation,
  GameEffect,
  GameJournalEffect,
  JournalEntryDefinition,
  WorldBase,
} from "@arcanorum/shared";
import type { GameContentEntry } from "../runtime/gameSettingsTypes";
import { resolveEventScopes } from "./eventScopeMechanics";
import { evaluateEventTrigger } from "./eventTriggerMechanics";

export type JournalLifecycleChange = {
  countryId: string;
  journalEntryId: string;
  instanceId: string;
  state: "started" | "completed" | "failed" | "cancelled";
  titleKey: string;
  outcomeLabelKey: string;
  effects: GameEffect[];
  eventIds: string[];
  explanations: EventTriggerExplanation[];
  scopes: ActiveJournalEntry["scopes"];
};

export type ResolveJournalEntriesTurnParams = {
  countryIds: string[];
  entries: GameContentEntry[];
  worldBase: Pick<
    WorldBase,
    | "journalEntriesByCountryId"
    | "resourcesByCountry"
    | "resourceLedgerByTurn"
    | "regionOwner"
    | "regionController"
    | "regionPopulationByRegion"
    | "regionBuildingsByRegion"
    | "colonyProgressByRegion"
    | "regionResourceDepositsByRegion"
    | "regionColonizationByRegion"
  >;
  turnId: number;
  createId: () => string;
  conditionsMatchCountry?: Parameters<typeof evaluateEventTrigger>[0]["conditionsMatchCountry"];
  countryHasModifier?: Parameters<typeof evaluateEventTrigger>[0]["countryHasModifier"];
};

export type ApplyJournalGameEffectsParams = {
  effects: GameEffect[] | undefined;
  countryId: string;
  entries: GameContentEntry[];
  worldBase: Pick<
    WorldBase,
    | "journalEntriesByCountryId"
    | "resourcesByCountry"
    | "resourceLedgerByTurn"
    | "regionOwner"
    | "regionController"
    | "regionPopulationByRegion"
    | "regionBuildingsByRegion"
    | "colonyProgressByRegion"
    | "regionResourceDepositsByRegion"
    | "regionColonizationByRegion"
  >;
  turnId: number;
  createId: () => string;
  scopes?: ActiveJournalEntry["scopes"];
  explanations?: EventTriggerExplanation[];
  conditionsMatchCountry?: Parameters<typeof evaluateEventTrigger>[0]["conditionsMatchCountry"];
  countryHasModifier?: Parameters<typeof evaluateEventTrigger>[0]["countryHasModifier"];
};

const DEFAULT_PROGRESS_LABEL_KEY = "journal.progress.default";

export function ensureCountryJournalState(
  recordsByCountryId: Record<string, CountryJournalState>,
  countryId: string,
): CountryJournalState {
  const existing = recordsByCountryId[countryId];
  if (existing) return normalizeCountryJournalState(existing);
  const next = createEmptyCountryJournalState();
  recordsByCountryId[countryId] = next;
  return next;
}

export function resolveJournalEntriesTurn(params: ResolveJournalEntriesTurnParams): JournalLifecycleChange[] {
  const changes: JournalLifecycleChange[] = [];
  const journalEntries = params.entries.filter((entry) => entry.journalEntry);
  if (journalEntries.length === 0) return changes;

  for (const countryId of [...new Set(params.countryIds)].sort((a, b) => a.localeCompare(b))) {
    const state = ensureCountryJournalState(params.worldBase.journalEntriesByCountryId, countryId);
    resolveActiveJournalEntries({ ...params, countryId, state, entries: journalEntries, changes });
    startAvailableJournalEntries({ ...params, countryId, state, entries: journalEntries, changes });
    state.active.sort((a, b) => a.startedTurnId - b.startedTurnId || a.journalEntryId.localeCompare(b.journalEntryId));
    state.history = state.history.slice(0, 200);
    params.worldBase.journalEntriesByCountryId[countryId] = state;
  }

  return changes;
}

export function applyJournalGameEffects(params: ApplyJournalGameEffectsParams): JournalLifecycleChange[] {
  const changes: JournalLifecycleChange[] = [];
  const state = ensureCountryJournalState(params.worldBase.journalEntriesByCountryId, params.countryId);
  const entryById = new Map(params.entries.filter((entry) => entry.journalEntry).map((entry) => [entry.id, entry] as const));
  for (const effect of params.effects ?? []) {
    if (!isJournalEffect(effect)) continue;
    const entry = entryById.get(effect.journalEntryId);
    const journalEntry = entry?.journalEntry ?? null;
    if (!entry || !journalEntry) continue;
    if (effect.type === "start_journal_entry") {
      startJournalEntryFromEffect({ ...params, entry, journalEntry, state, changes });
      continue;
    }
    if (effect.type === "advance_journal_entry") {
      advanceJournalEntryFromEffect(state, effect, params.turnId);
      continue;
    }
    if (effect.type === "set_journal_variable" || effect.type === "clear_journal_variable") {
      updateJournalVariableFromEffect(state, effect, params.turnId);
      continue;
    }
    resolveJournalEntryFromEffect({ ...params, entry, journalEntry, state, changes, effect });
  }
  params.worldBase.journalEntriesByCountryId[params.countryId] = state;
  return changes;
}

function isJournalEffect(effect: GameEffect): effect is GameJournalEffect {
  return (
    effect.type === "start_journal_entry" ||
    effect.type === "advance_journal_entry" ||
    effect.type === "complete_journal_entry" ||
    effect.type === "fail_journal_entry" ||
    effect.type === "cancel_journal_entry" ||
    effect.type === "set_journal_variable" ||
    effect.type === "clear_journal_variable"
  );
}

function startJournalEntryFromEffect(
  params: ApplyJournalGameEffectsParams & {
    entry: GameContentEntry;
    journalEntry: JournalEntryDefinition;
    state: CountryJournalState;
    changes: JournalLifecycleChange[];
  },
): void {
  if (params.state.active.some((active) => active.journalEntryId === params.entry.id)) return;
  if (!params.journalEntry.repeatable && params.state.completedJournalEntryIds.includes(params.entry.id)) return;
  if (!params.journalEntry.repeatable && params.state.failedJournalEntryIds.includes(params.entry.id)) return;
  if ((params.state.cooldownUntilTurnByJournalEntryId[params.entry.id] ?? 0) > params.turnId) return;
  const scopeResult = params.scopes
    ? { scopes: params.scopes, explanations: params.explanations ?? [] }
    : resolveEventScopes({
        countryId: params.countryId,
        scope: params.journalEntry.scope,
        worldBase: params.worldBase,
        conditionsMatchCountry: params.conditionsMatchCountry,
        countryHasModifier: params.countryHasModifier,
      });
  if (!scopeResult) return;
  const instanceId = params.createId();
  const active: ActiveJournalEntry = {
    id: instanceId,
    journalEntryId: params.entry.id,
    countryId: params.countryId,
    startedTurnId: params.turnId,
    expiresTurnId: params.journalEntry.timeoutTurns == null ? null : params.turnId + Math.max(0, Math.floor(params.journalEntry.timeoutTurns)),
    state: "active",
    progress: createInitialProgress(params.journalEntry),
    scopes: scopeResult.scopes,
    variables: {},
    lastUpdatedTurnId: params.turnId,
    explanationIds: scopeResult.explanations.map((item) => item.triggerId),
  };
  params.state.active.push(active);
  params.changes.push({
    countryId: params.countryId,
    journalEntryId: params.entry.id,
    instanceId,
    state: "started",
    titleKey: params.journalEntry.titleKey,
    outcomeLabelKey: "journal.outcome.started",
    effects: params.journalEntry.onStartEffects ?? [],
    eventIds: params.journalEntry.events?.onStart ?? [],
    explanations: scopeResult.explanations,
    scopes: scopeResult.scopes,
  });
}

function advanceJournalEntryFromEffect(state: CountryJournalState, effect: Extract<GameJournalEffect, { type: "advance_journal_entry" }>, turnId: number): void {
  for (const active of state.active.filter((item) => item.journalEntryId === effect.journalEntryId)) {
    const current = Math.min(active.progress.target, Math.max(0, Number(active.progress.current ?? 0) + effect.amount));
    active.progress = {
      ...active.progress,
      current: Number(current.toFixed(3)),
      percent: Number(Math.min(100, Math.max(0, (current / active.progress.target) * 100)).toFixed(3)),
      lastDelta: Number(effect.amount.toFixed(3)),
    };
    active.lastUpdatedTurnId = turnId;
  }
}

function updateJournalVariableFromEffect(
  state: CountryJournalState,
  effect: Extract<GameJournalEffect, { type: "set_journal_variable" | "clear_journal_variable" }>,
  turnId: number,
): void {
  for (const active of state.active.filter((item) => item.journalEntryId === effect.journalEntryId)) {
    if (effect.type === "clear_journal_variable") {
      delete active.variables[effect.variableId];
    } else {
      active.variables[effect.variableId] = normalizeJournalVariableValue(effect.value);
    }
    active.lastUpdatedTurnId = turnId;
  }
}

function resolveJournalEntryFromEffect(
  params: ApplyJournalGameEffectsParams & {
    entry: GameContentEntry;
    journalEntry: JournalEntryDefinition;
    state: CountryJournalState;
    changes: JournalLifecycleChange[];
    effect: Extract<GameJournalEffect, { type: "complete_journal_entry" | "fail_journal_entry" | "cancel_journal_entry" }>;
  },
): void {
  const active = params.state.active.find((item) => item.journalEntryId === params.entry.id);
  if (!active) return;
  const state = params.effect.type === "complete_journal_entry" ? "completed" : params.effect.type === "fail_journal_entry" ? "failed" : "cancelled";
  const outcomeLabelKey =
    state === "completed" ? "journal.outcome.completed" : state === "failed" ? "journal.outcome.failed" : "journal.outcome.cancelled";
  params.state.active = params.state.active.filter((item) => item.id !== active.id);
  if (state === "completed" && !params.state.completedJournalEntryIds.includes(params.entry.id)) params.state.completedJournalEntryIds.push(params.entry.id);
  if (state === "failed" && !params.state.failedJournalEntryIds.includes(params.entry.id)) params.state.failedJournalEntryIds.push(params.entry.id);
  const cooldown = Math.max(0, Math.floor(Number(params.journalEntry.cooldownTurns ?? 0)));
  if (cooldown > 0) params.state.cooldownUntilTurnByJournalEntryId[params.entry.id] = params.turnId + cooldown;
  params.state.history.unshift({
    journalEntryId: params.entry.id,
    instanceId: active.id,
    state,
    startedTurnId: active.startedTurnId,
    resolvedTurnId: params.turnId,
    scopes: active.scopes,
    outcomeLabelKey,
    explanationIds: params.explanations?.map((item) => item.triggerId) ?? [],
  });
  params.state.history = params.state.history.slice(0, 200);
  params.changes.push({
    countryId: params.countryId,
    journalEntryId: params.entry.id,
    instanceId: active.id,
    state,
    titleKey: params.journalEntry.titleKey,
    outcomeLabelKey,
    effects: getOutcomeEffects(params.journalEntry, state),
    eventIds: getOutcomeEventIds(params.journalEntry, state),
    explanations: params.explanations ?? [],
    scopes: active.scopes,
  });
}

function normalizeJournalVariableValue(input: string | number | boolean | null | undefined): string | number | boolean {
  if (typeof input === "string") return input.slice(0, 160);
  if (typeof input === "number" && Number.isFinite(input)) return Number(input.toFixed(3));
  if (typeof input === "boolean") return input;
  return true;
}

function resolveActiveJournalEntries(
  params: ResolveJournalEntriesTurnParams & {
    countryId: string;
    state: CountryJournalState;
    entries: GameContentEntry[];
    changes: JournalLifecycleChange[];
  },
): void {
  const entryById = new Map(params.entries.map((entry) => [entry.id, entry] as const));
  const remaining: ActiveJournalEntry[] = [];
  for (const active of params.state.active) {
    const entry = entryById.get(active.journalEntryId);
    const journalEntry = entry?.journalEntry ?? null;
    if (!entry || !journalEntry) continue;
    const outcome = resolveActiveOutcome({
      active,
      journalEntry,
      countryId: params.countryId,
      worldBase: params.worldBase,
      turnId: params.turnId,
      conditionsMatchCountry: params.conditionsMatchCountry,
      countryHasModifier: params.countryHasModifier,
    });
    if (!outcome) {
      remaining.push({
        ...active,
        progress: updateTriggerProgress(
          active,
          journalEntry,
          params.countryId,
          params.worldBase,
          params.conditionsMatchCountry,
          params.countryHasModifier,
        ),
        lastUpdatedTurnId: params.turnId,
      });
      continue;
    }
    if (outcome.state === "completed" && !params.state.completedJournalEntryIds.includes(entry.id)) {
      params.state.completedJournalEntryIds.push(entry.id);
    }
    if (outcome.state === "failed" && !params.state.failedJournalEntryIds.includes(entry.id)) {
      params.state.failedJournalEntryIds.push(entry.id);
    }
    const cooldown = Math.max(0, Math.floor(Number(journalEntry.cooldownTurns ?? 0)));
    if (cooldown > 0) params.state.cooldownUntilTurnByJournalEntryId[entry.id] = params.turnId + cooldown;
    params.state.history.unshift({
      journalEntryId: entry.id,
      instanceId: active.id,
      state: outcome.state,
      startedTurnId: active.startedTurnId,
      resolvedTurnId: params.turnId,
      scopes: active.scopes,
      outcomeLabelKey: outcome.outcomeLabelKey,
      explanationIds: outcome.explanations.map((item) => item.triggerId),
    });
    params.changes.push({
      countryId: params.countryId,
      journalEntryId: entry.id,
      instanceId: active.id,
      state: outcome.state,
      titleKey: journalEntry.titleKey,
      outcomeLabelKey: outcome.outcomeLabelKey,
      effects: getOutcomeEffects(journalEntry, outcome.state),
      eventIds: getOutcomeEventIds(journalEntry, outcome.state),
      explanations: outcome.explanations,
      scopes: active.scopes,
    });
  }
  params.state.active = remaining;
}

function startAvailableJournalEntries(
  params: ResolveJournalEntriesTurnParams & {
    countryId: string;
    state: CountryJournalState;
    entries: GameContentEntry[];
    changes: JournalLifecycleChange[];
  },
): void {
  for (const entry of params.entries) {
    const journalEntry = entry.journalEntry;
    if (!journalEntry) continue;
    if (params.state.active.some((active) => active.journalEntryId === entry.id)) continue;
    if (!journalEntry.repeatable && params.state.completedJournalEntryIds.includes(entry.id)) continue;
    if (!journalEntry.repeatable && params.state.failedJournalEntryIds.includes(entry.id)) continue;
    if ((params.state.cooldownUntilTurnByJournalEntryId[entry.id] ?? 0) > params.turnId) continue;
    const scopeResult = resolveEventScopes({
      countryId: params.countryId,
      scope: journalEntry.scope,
      worldBase: params.worldBase,
      conditionsMatchCountry: params.conditionsMatchCountry,
      countryHasModifier: params.countryHasModifier,
    });
    if (!scopeResult) continue;
    const evaluation = evaluateEventTrigger({
      trigger: journalEntry.startTrigger,
      countryId: params.countryId,
      worldBase: params.worldBase,
      scopes: scopeResult.scopes,
      conditionsMatchCountry: params.conditionsMatchCountry,
      countryHasModifier: params.countryHasModifier,
    });
    if (!evaluation.passed) continue;
    const instanceId = params.createId();
    const progress = createInitialProgress(journalEntry);
    const active: ActiveJournalEntry = {
      id: instanceId,
      journalEntryId: entry.id,
      countryId: params.countryId,
      startedTurnId: params.turnId,
      expiresTurnId: journalEntry.timeoutTurns == null ? null : params.turnId + Math.max(0, Math.floor(journalEntry.timeoutTurns)),
      state: "active",
      progress,
      scopes: scopeResult.scopes,
      variables: {},
      lastUpdatedTurnId: params.turnId,
      explanationIds: [...scopeResult.explanations, ...evaluation.explanations].map((item) => item.triggerId),
    };
    params.state.active.push(active);
    params.changes.push({
      countryId: params.countryId,
      journalEntryId: entry.id,
      instanceId,
      state: "started",
      titleKey: journalEntry.titleKey,
      outcomeLabelKey: "journal.outcome.started",
      effects: journalEntry.onStartEffects ?? [],
      eventIds: journalEntry.events?.onStart ?? [],
      explanations: [...scopeResult.explanations, ...evaluation.explanations],
      scopes: scopeResult.scopes,
    });
  }
}

function resolveActiveOutcome(params: {
  active: ActiveJournalEntry;
  journalEntry: JournalEntryDefinition;
  countryId: string;
  worldBase: ResolveJournalEntriesTurnParams["worldBase"];
  turnId: number;
  conditionsMatchCountry?: ResolveJournalEntriesTurnParams["conditionsMatchCountry"];
  countryHasModifier?: ResolveJournalEntriesTurnParams["countryHasModifier"];
}): { state: "completed" | "failed" | "cancelled"; outcomeLabelKey: string; explanations: EventTriggerExplanation[] } | null {
  const checks = [
    { state: "cancelled" as const, trigger: params.journalEntry.cancelTrigger, outcomeLabelKey: "journal.outcome.cancelled" },
    { state: "failed" as const, trigger: params.journalEntry.failTrigger, outcomeLabelKey: "journal.outcome.failed" },
    { state: "completed" as const, trigger: params.journalEntry.completeTrigger, outcomeLabelKey: "journal.outcome.completed" },
  ];
  for (const check of checks) {
    if (!check.trigger) continue;
    const evaluation = evaluateEventTrigger({
      trigger: check.trigger,
      countryId: params.countryId,
      worldBase: params.worldBase,
      scopes: params.active.scopes,
      conditionsMatchCountry: params.conditionsMatchCountry,
      countryHasModifier: params.countryHasModifier,
    });
    if (evaluation.passed) {
      return { state: check.state, outcomeLabelKey: check.outcomeLabelKey, explanations: evaluation.explanations };
    }
  }
  if (params.active.expiresTurnId != null && params.active.expiresTurnId <= params.turnId) {
    return { state: "failed", outcomeLabelKey: "journal.outcome.timeout", explanations: [] };
  }
  return null;
}

function createInitialProgress(journalEntry: JournalEntryDefinition): ActiveJournalEntry["progress"] {
  const target = Math.max(1, Number(journalEntry.progress?.target ?? 1));
  return {
    current: 0,
    target,
    percent: 0,
    labelKey: journalEntry.progress?.labelKey ?? DEFAULT_PROGRESS_LABEL_KEY,
    lastDelta: null,
  };
}

function updateTriggerProgress(
  active: ActiveJournalEntry,
  journalEntry: JournalEntryDefinition,
  countryId: string,
  worldBase: ResolveJournalEntriesTurnParams["worldBase"],
  conditionsMatchCountry?: ResolveJournalEntriesTurnParams["conditionsMatchCountry"],
  countryHasModifier?: ResolveJournalEntriesTurnParams["countryHasModifier"],
): ActiveJournalEntry["progress"] {
  if (journalEntry.progress?.type !== "trigger") return active.progress;
  const evaluation = evaluateEventTrigger({
    trigger: journalEntry.completeTrigger,
    countryId,
    worldBase,
    scopes: active.scopes,
    conditionsMatchCountry,
    countryHasModifier,
  });
  const current = evaluation.passed ? journalEntry.progress.target : 0;
  return {
    current,
    target: journalEntry.progress.target,
    percent: Number(Math.min(100, Math.max(0, (current / journalEntry.progress.target) * 100)).toFixed(3)),
    labelKey: journalEntry.progress.labelKey,
    lastDelta: Number((current - active.progress.current).toFixed(3)),
  };
}

function getOutcomeEffects(journalEntry: JournalEntryDefinition, state: JournalLifecycleChange["state"]): GameEffect[] {
  if (state === "started") return journalEntry.onStartEffects ?? [];
  if (state === "completed") return journalEntry.onCompleteEffects ?? [];
  if (state === "failed") return journalEntry.onFailEffects ?? [];
  if (state === "cancelled") return journalEntry.onCancelEffects ?? [];
  return [];
}

function getOutcomeEventIds(journalEntry: JournalEntryDefinition, state: JournalLifecycleChange["state"]): string[] {
  if (state === "started") return journalEntry.events?.onStart ?? [];
  if (state === "completed") return journalEntry.events?.onComplete ?? [];
  if (state === "failed") return journalEntry.events?.onFail ?? [];
  if (state === "cancelled") return journalEntry.events?.onCancel ?? [];
  return [];
}

function createEmptyCountryJournalState(): CountryJournalState {
  return {
    active: [],
    completedJournalEntryIds: [],
    failedJournalEntryIds: [],
    cooldownUntilTurnByJournalEntryId: {},
    history: [],
  };
}

function normalizeCountryJournalState(input: CountryJournalState): CountryJournalState {
  return {
    active: Array.isArray(input.active) ? input.active.slice(0, 200) : [],
    completedJournalEntryIds: Array.isArray(input.completedJournalEntryIds) ? [...new Set(input.completedJournalEntryIds)] : [],
    failedJournalEntryIds: Array.isArray(input.failedJournalEntryIds) ? [...new Set(input.failedJournalEntryIds)] : [],
    cooldownUntilTurnByJournalEntryId:
      input.cooldownUntilTurnByJournalEntryId && typeof input.cooldownUntilTurnByJournalEntryId === "object"
        ? { ...input.cooldownUntilTurnByJournalEntryId }
        : {},
    history: Array.isArray(input.history) ? input.history.slice(0, 200) : [],
  };
}
