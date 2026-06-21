import type {
  CountryAppliedModifier,
  CountryDecisionRecord,
  CountryEventRecord,
  DecisionAvailabilityReason,
  DecisionDefinition,
  DecisionEffect,
  EventEffectSummary,
  EventCategory,
  EventPriority,
  EventResolvedScope,
  EventTriggerExplanation,
  EventVisibility,
  ExplanationRecord,
  GameEffect,
  GameEventDefinition,
  GameEventOption,
  ModifierCondition,
  ResourceFlowSourceType,
  ResourceId,
  ResourceTotals,
  ScheduledCountryEvent,
  WorldBase,
} from "@arcanorum/shared";
import { evaluateEventTrigger } from "./eventTriggerMechanics";
import { resolveEventScopes } from "./eventScopeMechanics";

export type DecisionEventContentEntry = {
  id: string;
  nameKey?: string | null;
  name: string;
  description: string;
  color: string;
  logoUrl: string | null;
  decision?: DecisionDefinition | null;
  event?: GameEventDefinition | null;
};

export type CountryDecisionView = {
  id: string;
  name: string;
  description: string;
  color: string;
  logoUrl: string | null;
  decision: DecisionDefinition;
  visible: boolean;
  available: boolean;
  reason: string | null;
  reasons: DecisionAvailabilityReason[];
  scopes: Record<string, EventResolvedScope>;
  triggerExplanation: EventTriggerExplanation[];
};

export type CountryEventView = {
  pendingId: string;
  id: string;
  name: string;
  description: string;
  color: string;
  logoUrl: string | null;
  event: GameEventDefinition;
  createdTurnId: number;
  expiresTurnId: number | null;
  scopes: Record<string, EventResolvedScope>;
  triggerExplanation: EventTriggerExplanation[];
};

export type GeneratedCountryEvent = {
  countryId: string;
  pendingId: string;
  eventId: string;
  name: string;
  description: string;
  event: GameEventDefinition;
};

export type AutoResolvedCountryEvent = {
  countryId: string;
  pendingId: string;
  eventId: string;
  name: string;
  optionId: string;
  optionLabelKey: string;
  optionEffects: GameEffect[];
  event: GameEventDefinition;
};

export type ScheduledCountryEventPromotion = {
  countryId: string;
  pendingId: string;
  eventId: string;
  name: string;
  description: string;
  event: GameEventDefinition;
};

export type CountryHasModifier = (countryId: string, modifierId: string) => boolean;

export const DEFAULT_DECISION_DEFINITION: DecisionDefinition = {
  category: "diplomacy",
  visibilityConditions: [],
  availabilityConditions: [],
  costs: {},
  effects: [],
  cooldownTurns: 0,
  repeatable: false,
};

export const DEFAULT_GAME_EVENT_DEFINITION: GameEventDefinition = {
  category: "politics",
  priority: "medium",
  visibility: "private",
  triggerConditions: [],
  options: [],
  cooldownTurns: 0,
  repeatable: false,
  checkIntervalTurns: 1,
  chancePct: 100,
  blocking: false,
};

export function getDecisionDefinition(entry: DecisionEventContentEntry): DecisionDefinition {
  return entry.decision ?? DEFAULT_DECISION_DEFINITION;
}

export function canPayDecisionCosts(
  resources: ResourceTotals | undefined,
  costs: Partial<ResourceTotals> | undefined,
): { ok: true } | { ok: false; reason: string; structuredReason: DecisionAvailabilityReason } {
  if (!resources) {
    return {
      ok: false,
      reason: "Нет ресурсов страны",
      structuredReason: { code: "missing_resources", labelKey: "decisions.reason.missingResources", passed: false },
    };
  }
  for (const key of RESOURCE_KEYS) {
    const cost = Number(costs?.[key] ?? 0);
    if (cost <= 0) continue;
    if ((resources[key] ?? 0) < cost) {
      return {
        ok: false,
        reason: `Недостаточно ${key}: нужно ${cost}`,
        structuredReason: {
          code: "insufficient_resource",
          labelKey: "decisions.reason.insufficientResource",
          passed: false,
          currentValue: resources[key] ?? 0,
          requiredValue: cost,
        },
      };
    }
  }
  return { ok: true };
}

export function getCountryDecisionView(params: {
  countryId: string;
  entry: DecisionEventContentEntry;
  record: CountryDecisionRecord;
  turnId: number;
  resources: ResourceTotals | undefined;
  worldBase: Pick<
    WorldBase,
    "resourcesByCountry" | "resourceLedgerByTurn" | "regionOwner" | "regionController" | "regionPopulationByRegion" | "regionBuildingsByRegion" | "colonyProgressByRegion" | "regionResourceDepositsByRegion" | "regionColonizationByRegion"
  >;
  conditionsMatchCountry: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
  countryHasModifier?: CountryHasModifier;
}): CountryDecisionView {
  const decision = getDecisionDefinition(params.entry);
  const legacyVisible = params.conditionsMatchCountry(decision.visibilityConditions, params.countryId);
  const scopeResult = resolveEventScopes({
    countryId: params.countryId,
    scope: decision.scope,
    worldBase: params.worldBase,
    conditionsMatchCountry: params.conditionsMatchCountry,
    countryHasModifier: params.countryHasModifier,
  });
  const scopes = scopeResult?.scopes ?? { root: { kind: "country", id: params.countryId } };
  const triggerExplanation = scopeResult?.explanations ?? [];
  const potential = evaluateEventTrigger({
    trigger: decision.potential,
    countryId: params.countryId,
    worldBase: params.worldBase,
    scopes,
    conditionsMatchCountry: params.conditionsMatchCountry,
    countryHasModifier: params.countryHasModifier,
  });
  const allow = evaluateEventTrigger({
    trigger: decision.allow,
    countryId: params.countryId,
    worldBase: params.worldBase,
    scopes,
    conditionsMatchCountry: params.conditionsMatchCountry,
    countryHasModifier: params.countryHasModifier,
  });
  const scopePassed = scopeResult !== null;
  const visible = legacyVisible && (scopePassed || decision.visibleWhenUnavailable === true) && (potential.passed || decision.visibleWhenUnavailable === true);
  const completed = params.record.completedDecisionIds.includes(params.entry.id);
  const cooldownUntilTurn = params.record.cooldownUntilTurnByDecisionId[params.entry.id] ?? 0;
  const countryUses = params.record.usesByDecisionId?.[params.entry.id] ?? 0;
  const countryUseLimit = Math.max(0, Math.floor(Number(decision.maxUsesPerCountry ?? decision.maxUses ?? 0)));
  const targetKey = getDecisionTargetUsageKey(params.entry.id, scopes);
  const targetUses = params.record.usesByDecisionTargetKey?.[targetKey] ?? 0;
  const targetUseLimit = Math.max(0, Math.floor(Number(decision.maxUsesPerTarget ?? 0)));
  const maxCharges = Math.max(0, Math.floor(Number(decision.charges ?? 0)));
  const currentCharges = getDecisionCharges(params.record, params.entry.id, decision);
  let reason: string | null = null;
  const reasons: DecisionAvailabilityReason[] = [];
  if (!legacyVisible) {
    reason = "Скрыто условиями видимости";
    reasons.push({
      code: "visibility_failed",
      labelKey: "decisions.reason.visibilityFailed",
      passed: false,
      scope: { kind: "country", id: params.countryId },
    });
  } else if (!scopePassed) {
    reason = "Не выполнены условия";
    reasons.push({
      code: "scope_failed",
      labelKey: "decisions.reason.scopeFailed",
      passed: false,
      scope: { kind: "country", id: params.countryId },
    });
  } else if (!potential.passed) {
    reason = "Скрыто условиями видимости";
    const failed = potential.explanations.find((item) => item.passed === false);
    reasons.push({
      code: "potential_failed",
      labelKey: "decisions.reason.potentialFailed",
      passed: false,
      currentValue: failed?.value ?? null,
      requiredValue: failed?.threshold ?? null,
      scope: failed?.affectedObject ?? { kind: "country", id: params.countryId },
    });
  } else if (completed && !decision.repeatable) {
    reason = "Уже принято";
    reasons.push({ code: "already_taken", labelKey: "decisions.reason.alreadyTaken", passed: false, scope: { kind: "country", id: params.countryId } });
  } else if (cooldownUntilTurn > params.turnId) {
    reason = `Кулдаун до хода ${cooldownUntilTurn}`;
    reasons.push({
      code: "cooldown",
      labelKey: "decisions.reason.cooldown",
      passed: false,
      currentValue: params.turnId,
      requiredValue: cooldownUntilTurn,
      scope: { kind: "country", id: params.countryId },
    });
  } else if (countryUseLimit > 0 && countryUses >= countryUseLimit) {
    reason = "Лимит использований исчерпан";
    reasons.push({
      code: "country_use_limit",
      labelKey: "decisions.reason.countryUseLimit",
      passed: false,
      currentValue: countryUses,
      requiredValue: countryUseLimit,
      scope: { kind: "country", id: params.countryId },
    });
  } else if (targetUseLimit > 0 && targetUses >= targetUseLimit) {
    reason = "Лимит использований цели исчерпан";
    reasons.push({
      code: "target_use_limit",
      labelKey: "decisions.reason.targetUseLimit",
      passed: false,
      currentValue: targetUses,
      requiredValue: targetUseLimit,
      scope: scopes.region ?? scopes.root ?? { kind: "country", id: params.countryId },
    });
  } else if (maxCharges > 0 && currentCharges <= 0) {
    reason = "Нет зарядов решения";
    reasons.push({
      code: "charges_empty",
      labelKey: "decisions.reason.chargesEmpty",
      passed: false,
      currentValue: currentCharges,
      requiredValue: maxCharges,
      scope: { kind: "country", id: params.countryId },
    });
  } else if (!params.conditionsMatchCountry(decision.availabilityConditions, params.countryId)) {
    reason = "Не выполнены условия";
    reasons.push({ code: "legacy_availability_failed", labelKey: "decisions.reason.conditionsFailed", passed: false, scope: { kind: "country", id: params.countryId } });
  } else if (!allow.passed) {
    reason = "Не выполнены условия";
    const failed = allow.explanations.find((item) => item.passed === false);
    reasons.push({
      code: "allow_failed",
      labelKey: "decisions.reason.conditionsFailed",
      passed: false,
      currentValue: failed?.value ?? null,
      requiredValue: failed?.threshold ?? null,
      scope: failed?.affectedObject ?? { kind: "country", id: params.countryId },
    });
  } else {
    const costCheck = canPayDecisionCosts(params.resources, decision.costs);
    if (!costCheck.ok) {
      reason = costCheck.reason;
      reasons.push({ ...costCheck.structuredReason, scope: { kind: "country", id: params.countryId } });
    }
  }
  return {
    id: params.entry.id,
    name: params.entry.name,
    description: params.entry.description,
    color: params.entry.color,
    logoUrl: params.entry.logoUrl,
    decision,
    visible,
    available: visible && reason == null,
    reason,
    reasons,
    scopes,
    triggerExplanation: [...triggerExplanation, ...potential.explanations, ...allow.explanations],
  };
}

export function getDecisionTargetUsageKey(decisionId: string, scopes: Record<string, EventResolvedScope>): string {
  const target = scopes.region ?? scopes.root ?? Object.values(scopes)[0] ?? { kind: "country" as const, id: "unknown" };
  return `${decisionId}:${target.kind}:${target.id}`;
}

export function getDecisionCharges(record: CountryDecisionRecord, decisionId: string, decision: DecisionDefinition): number {
  const maxCharges = Math.max(0, Math.floor(Number(decision.charges ?? 0)));
  if (maxCharges <= 0) return 0;
  return Math.min(maxCharges, Math.max(0, Math.floor(Number(record.chargesByDecisionId?.[decisionId] ?? maxCharges))));
}

export function spendDecisionCharge(record: CountryDecisionRecord, decisionId: string, decision: DecisionDefinition, turnId: number): void {
  const maxCharges = Math.max(0, Math.floor(Number(decision.charges ?? 0)));
  if (maxCharges <= 0) return;
  record.chargesByDecisionId[decisionId] = Math.max(0, getDecisionCharges(record, decisionId, decision) - 1);
  record.lastChargeTurnByDecisionId[decisionId] = Math.max(1, Math.floor(turnId));
}

export function rechargeCountryDecisionCharges(params: {
  record: CountryDecisionRecord;
  decisions: DecisionEventContentEntry[];
  turnId: number;
}): void {
  for (const entry of params.decisions) {
    const decision = getDecisionDefinition(entry);
    const maxCharges = Math.max(0, Math.floor(Number(decision.charges ?? 0)));
    const rechargeTurns = Math.max(0, Math.floor(Number(decision.rechargeTurns ?? 0)));
    if (maxCharges <= 0 || rechargeTurns <= 0) continue;
    const current = getDecisionCharges(params.record, entry.id, decision);
    if (current >= maxCharges) {
      params.record.chargesByDecisionId[entry.id] = maxCharges;
      params.record.lastChargeTurnByDecisionId[entry.id] = params.turnId;
      continue;
    }
    const lastTurn = Math.max(1, Math.floor(Number(params.record.lastChargeTurnByDecisionId[entry.id] ?? params.turnId)));
    const elapsed = Math.max(0, params.turnId - lastTurn);
    const gained = Math.floor(elapsed / rechargeTurns);
    if (gained <= 0) continue;
    const next = Math.min(maxCharges, current + gained);
    params.record.chargesByDecisionId[entry.id] = next;
    params.record.lastChargeTurnByDecisionId[entry.id] = lastTurn + gained * rechargeTurns;
  }
}

export function getVisibleCountryDecisions(params: {
  countryId: string;
  entries: DecisionEventContentEntry[];
  record: CountryDecisionRecord;
  turnId: number;
  resources: ResourceTotals | undefined;
  worldBase: Pick<
    WorldBase,
    "resourcesByCountry" | "resourceLedgerByTurn" | "regionOwner" | "regionController" | "regionPopulationByRegion" | "regionBuildingsByRegion" | "colonyProgressByRegion" | "regionResourceDepositsByRegion" | "regionColonizationByRegion"
  >;
  conditionsMatchCountry: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
  countryHasModifier?: CountryHasModifier;
}): CountryDecisionView[] {
  return params.entries
    .map((entry) =>
      getCountryDecisionView({
        countryId: params.countryId,
        entry,
        record: params.record,
        turnId: params.turnId,
        resources: params.resources,
        worldBase: params.worldBase,
        conditionsMatchCountry: params.conditionsMatchCountry,
        countryHasModifier: params.countryHasModifier,
      }),
    )
    .filter((row) => row.visible)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export type DecisionEventLedgerFlowInput = {
  countryId: string;
  resourceId: ResourceId;
  amount: number;
  sourceType: ResourceFlowSourceType;
  sourceId: string;
  categoryId: string;
  labelKey: string;
};

export function applyDecisionEffects(
  resources: ResourceTotals | undefined,
  effects: Array<DecisionEffect | GameEffect> | undefined,
  options?: {
    countryId: string;
    sourceType: ResourceFlowSourceType;
    sourceId: string;
    addIncome?: (input: DecisionEventLedgerFlowInput) => void;
    addExpense?: (input: DecisionEventLedgerFlowInput) => void;
  },
): void {
  if (!resources) return;
  for (const effect of effects ?? []) {
    if (effect.type === "resource_delta") {
      const amount = round3(Math.abs(Number(effect.amount ?? 0)));
      if (amount <= 0) continue;
      if (effect.amount > 0 && options?.addIncome) {
        options.addIncome({
          countryId: options.countryId,
          resourceId: effect.resource,
          amount,
          sourceType: options.sourceType,
          sourceId: options.sourceId,
          categoryId: options.sourceType,
          labelKey: "resourceLedger.source.generic",
        });
      } else if (effect.amount < 0 && options?.addExpense) {
        options.addExpense({
          countryId: options.countryId,
          resourceId: effect.resource,
          amount,
          sourceType: options.sourceType,
          sourceId: options.sourceId,
          categoryId: options.sourceType,
          labelKey: "resourceLedger.source.generic",
        });
      } else {
        resources[effect.resource] = round3(Math.max(0, (resources[effect.resource] ?? 0) + effect.amount));
      }
    } else if (effect.type === "add_resource" || effect.type === "spend_resource") {
      const amount = round3(Math.abs(Number(effect.amount ?? 0)));
      if (amount <= 0) continue;
      const direction = effect.type === "add_resource" ? "income" : "expense";
      if (direction === "income" && options?.addIncome) {
        options.addIncome({
          countryId: options.countryId,
          resourceId: effect.resource,
          amount,
          sourceType: options.sourceType,
          sourceId: options.sourceId,
          categoryId: options.sourceType,
          labelKey: effect.labelKey ?? "resourceLedger.source.generic",
        });
      } else if (direction === "expense" && options?.addExpense) {
        options.addExpense({
          countryId: options.countryId,
          resourceId: effect.resource,
          amount,
          sourceType: options.sourceType,
          sourceId: options.sourceId,
          categoryId: options.sourceType,
          labelKey: effect.labelKey ?? "resourceLedger.source.generic",
        });
      } else {
        const signedAmount = direction === "income" ? amount : -amount;
        resources[effect.resource] = round3(Math.max(0, (resources[effect.resource] ?? 0) + signedAmount));
      }
    } else if (effect.type === "add_resource_flow") {
      const amount = round3(Math.abs(Number(effect.amount ?? 0)));
      if (amount <= 0) continue;
      const flowInput = {
        countryId: options?.countryId ?? "",
        resourceId: effect.resource,
        amount,
        sourceType: options?.sourceType ?? "event",
        sourceId: options?.sourceId ?? "",
        categoryId: effect.categoryId ?? options?.sourceType ?? "event",
        labelKey: effect.labelKey,
      } satisfies DecisionEventLedgerFlowInput;
      if (effect.direction === "income" && options?.addIncome) {
        options.addIncome(flowInput);
      } else if (effect.direction === "expense" && options?.addExpense) {
        options.addExpense(flowInput);
      } else {
        const signedAmount = effect.direction === "income" ? amount : -amount;
        resources[effect.resource] = round3(Math.max(0, (resources[effect.resource] ?? 0) + signedAmount));
      }
    }
  }
}

export function applyDecisionCosts(
  resources: ResourceTotals | undefined,
  costs: Partial<ResourceTotals> | undefined,
  options?: {
    countryId: string;
    sourceType: ResourceFlowSourceType;
    sourceId: string;
    addExpense?: (input: DecisionEventLedgerFlowInput) => void;
  },
): void {
  if (!resources) return;
  for (const key of RESOURCE_KEYS) {
    const cost = Number(costs?.[key] ?? 0);
    if (cost > 0) {
      if (options?.addExpense) {
        options.addExpense({
          countryId: options.countryId,
          resourceId: key,
          amount: cost,
          sourceType: options.sourceType,
          sourceId: options.sourceId,
          categoryId: options.sourceType,
          labelKey: "resourceLedger.source.generic",
        });
      } else {
        resources[key] = round3(Math.max(0, Number(resources[key] ?? 0) - cost));
      }
    }
  }
}

export function getGameEventDefinition(entry: DecisionEventContentEntry): GameEventDefinition {
  return entry.event ?? DEFAULT_GAME_EVENT_DEFINITION;
}

export function getPendingCountryEvents(params: {
  countryId: string;
  record: CountryEventRecord;
  entries: DecisionEventContentEntry[];
}): { events: CountryEventView[]; record: CountryEventRecord } {
  const eventById = new Map(params.entries.map((entry) => [entry.id, entry] as const));
  const events = params.record.pending
    .map((pending): CountryEventView | null => {
      const entry = eventById.get(pending.eventId);
      if (!entry) return null;
      return {
        pendingId: pending.id,
        id: entry.id,
        name: entry.name,
        description: entry.description,
        color: entry.color,
        logoUrl: entry.logoUrl,
        event: getGameEventDefinition(entry),
        createdTurnId: pending.createdTurnId,
        expiresTurnId: pending.expiresTurnId ?? null,
        scopes: pending.scopes ?? {},
        triggerExplanation: pending.triggerExplanation ?? [],
      };
    })
    .filter((row): row is CountryEventView => Boolean(row))
    .sort((a, b) => b.createdTurnId - a.createdTurnId || a.name.localeCompare(b.name, "ru"));
  return { events, record: params.record };
}

export function chooseAutoEventOption(
  options: GameEventOption[] | undefined,
  defaultOptionId?: string | null,
  context?: {
    countryId: string;
    worldBase: Pick<
      WorldBase,
      "resourcesByCountry" | "resourceLedgerByTurn" | "regionOwner" | "regionController" | "regionPopulationByRegion" | "regionBuildingsByRegion" | "colonyProgressByRegion" | "regionResourceDepositsByRegion" | "regionColonizationByRegion"
    >;
    scopes?: Record<string, EventResolvedScope>;
    conditionsMatchCountry?: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
    countryHasModifier?: CountryHasModifier;
  },
): GameEventOption | null {
  const rows = (options ?? []).filter((option) => option.id && option.labelKey);
  if (rows.length === 0) return null;
  if (context && rows.some((option) => (option.aiWeight ?? []).length > 0)) {
    let best: { option: GameEventOption; score: number; index: number } | null = null;
    for (let index = 0; index < rows.length; index += 1) {
      const option = rows[index];
      const score = scoreAutoEventOption(option, context);
      if (!best || score > best.score || (score === best.score && index < best.index)) {
        best = { option, score, index };
      }
    }
    if (best && best.score > 0) return best.option;
  }
  if (defaultOptionId) {
    const defaultOption = rows.find((option) => option.id === defaultOptionId);
    if (defaultOption) return defaultOption;
  }
  return rows.find((option) => option.playerDefault === true) ?? rows[0] ?? null;
}

export function scoreAutoEventOption(
  option: GameEventOption,
  context: {
    countryId: string;
    worldBase: Pick<
      WorldBase,
      "resourcesByCountry" | "resourceLedgerByTurn" | "regionOwner" | "regionController" | "regionPopulationByRegion" | "regionBuildingsByRegion" | "colonyProgressByRegion" | "regionResourceDepositsByRegion" | "regionColonizationByRegion"
    >;
    scopes?: Record<string, EventResolvedScope>;
    conditionsMatchCountry?: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
    countryHasModifier?: CountryHasModifier;
  },
): number {
  const rules = option.aiWeight ?? [];
  if (rules.length === 0) return 1;
  let score = 0;
  for (const rule of rules) {
    if ("base" in rule) {
      const base = Number(rule.base);
      if (Number.isFinite(base)) score += base;
      continue;
    }
    const evaluation = evaluateEventTrigger({
      trigger: rule.if,
      countryId: context.countryId,
      worldBase: context.worldBase,
      scopes: context.scopes,
      conditionsMatchCountry: context.conditionsMatchCountry,
      countryHasModifier: context.countryHasModifier,
    });
    if (!evaluation.passed) continue;
    const add = Number(rule.add ?? 0);
    if (Number.isFinite(add)) score += add;
    const multiply = Number(rule.multiply ?? 1);
    if (Number.isFinite(multiply)) score *= multiply;
  }
  return Math.max(0, Number(score.toFixed(3)));
}

export function summarizeGameEffects(effects: Array<DecisionEffect | GameEffect> | undefined): EventEffectSummary[] {
  return (effects ?? [])
    .map((effect): EventEffectSummary | null => {
      if (effect.type === "resource_delta") {
        return {
          type: "resource_delta",
          resource: effect.resource,
          amount: round3(Number(effect.amount ?? 0)),
          direction: effect.amount >= 0 ? "income" : "expense",
        };
      }
      if (effect.type === "add_resource" || effect.type === "spend_resource") {
        return {
          type: effect.type,
          resource: effect.resource,
          amount: round3(Number(effect.amount ?? 0)),
          direction: effect.type === "add_resource" ? "income" : "expense",
        };
      }
      if (effect.type === "add_resource_flow") {
        return {
          type: effect.type,
          resource: effect.resource,
          amount: round3(Number(effect.amount ?? 0)),
          direction: effect.direction,
        };
      }
      if (effect.type === "trigger_event" || effect.type === "schedule_event" || effect.type === "cancel_event") {
        return { type: effect.type, eventId: effect.eventId };
      }
      if (effect.type === "set_event_flag" || effect.type === "clear_event_flag") {
        return { type: effect.type, flagId: effect.flagId };
      }
      if (effect.type === "add_modifier" || effect.type === "remove_modifier" || effect.type === "extend_modifier") {
        return { type: effect.type, modifierId: effect.modifierId };
      }
      if (effect.type === "change_colonization_progress") {
        return { type: effect.type, amount: round3(effect.amount), regionId: null };
      }
      if (
        effect.type === "start_journal_entry" ||
        effect.type === "advance_journal_entry" ||
        effect.type === "complete_journal_entry" ||
        effect.type === "fail_journal_entry" ||
        effect.type === "cancel_journal_entry" ||
        effect.type === "set_journal_variable" ||
        effect.type === "clear_journal_variable"
      ) {
        return { type: effect.type, journalEntryId: effect.journalEntryId };
      }
      return null;
    })
    .filter((item): item is EventEffectSummary => Boolean(item))
    .slice(0, 30);
}

export function createEventResourceExplanationRecords(params: {
  sourceSystem?: "event" | "decision";
  eventId: string;
  optionId: string;
  countryId: string;
  turnId: number;
  scopes?: Record<string, EventResolvedScope>;
  effects: Array<DecisionEffect | GameEffect> | undefined;
  previousResources?: ResourceTotals;
  nextResources?: ResourceTotals;
  createId: () => string;
}): ExplanationRecord[] {
  const affectedObject = params.scopes?.root ?? { kind: "country" as const, id: params.countryId };
  return (params.effects ?? [])
    .map((effect): ExplanationRecord | null => {
      const resourceEffect = getResourceEffectExplanationData(effect);
      if (!resourceEffect) return null;
      return {
        id: params.createId(),
        turnId: params.turnId,
        sourceSystem: params.sourceSystem ?? "event",
        sourceId: params.eventId,
        affectedObject,
        valueKey: `resource.${resourceEffect.resource}`,
        previousValue: params.previousResources?.[resourceEffect.resource] ?? null,
        newValue: params.nextResources?.[resourceEffect.resource] ?? null,
        causes: [
          {
            labelKey: resourceEffect.labelKey,
            sourceId: params.optionId,
            amount: resourceEffect.amount,
          },
        ],
        modifierIds: [],
      };
    })
    .filter((item): item is ExplanationRecord => Boolean(item))
    .slice(0, 30);
}

function getResourceEffectExplanationData(
  effect: DecisionEffect | GameEffect,
): { resource: keyof ResourceTotals; amount: number; labelKey: string } | null {
  if (effect.type === "resource_delta") {
    return {
      resource: effect.resource,
      amount: round3(Number(effect.amount ?? 0)),
      labelKey: "resourceLedger.source.generic",
    };
  }
  if (effect.type === "add_resource" || effect.type === "spend_resource") {
    return {
      resource: effect.resource,
      amount: round3(effect.type === "add_resource" ? Number(effect.amount ?? 0) : -Number(effect.amount ?? 0)),
      labelKey: effect.labelKey ?? "resourceLedger.source.generic",
    };
  }
  if (effect.type === "add_resource_flow") {
    return {
      resource: effect.resource,
      amount: round3(effect.direction === "income" ? Number(effect.amount ?? 0) : -Number(effect.amount ?? 0)),
      labelKey: effect.labelKey,
    };
  }
  return null;
}

export function maybeGenerateCountryEvents(params: {
  countryIds: string[];
  entries: DecisionEventContentEntry[];
  turnId: number;
  ensureCountryEventRecord: (countryId: string) => CountryEventRecord;
  conditionsMatchCountry: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
  countryHasModifier?: CountryHasModifier;
  worldBase: Pick<
    WorldBase,
    "resourcesByCountry" | "resourceLedgerByTurn" | "regionOwner" | "regionController" | "regionPopulationByRegion" | "regionBuildingsByRegion" | "colonyProgressByRegion" | "regionResourceDepositsByRegion" | "regionColonizationByRegion"
  >;
  createId: () => string;
  random?: () => number;
}): GeneratedCountryEvent[] {
  if (params.entries.length === 0) return [];
  const random = params.random ?? Math.random;
  const generated: GeneratedCountryEvent[] = [];

  for (const countryId of params.countryIds) {
    const record = params.ensureCountryEventRecord(countryId);
    const pendingEventIds = new Set(record.pending.map((item) => item.eventId));
    for (const entry of params.entries) {
      const event = getGameEventDefinition(entry);
      if (pendingEventIds.has(entry.id)) continue;
      if (!event.repeatable && record.completedEventIds.includes(entry.id)) continue;
      const cooldownUntilTurn = record.cooldownUntilTurnByEventId[entry.id] ?? 0;
      if (cooldownUntilTurn > params.turnId) continue;
      const interval = Math.max(1, Math.floor(event.checkIntervalTurns ?? 1));
      if (interval > 1 && params.turnId % interval !== 0) continue;
      const scopeResult = resolveEventScopes({
        countryId,
        scope: event.scope,
        worldBase: params.worldBase,
        conditionsMatchCountry: params.conditionsMatchCountry,
        countryHasModifier: params.countryHasModifier,
      });
      if (!scopeResult) continue;
      const triggerEvaluation = evaluateEventTrigger({
        trigger: event.trigger ?? event.triggerConditions,
        countryId,
        worldBase: params.worldBase,
        scopes: scopeResult.scopes,
        conditionsMatchCountry: params.conditionsMatchCountry,
        countryHasModifier: params.countryHasModifier,
      });
      if (!triggerEvaluation.passed) continue;
      const chancePct = Math.min(100, Math.max(0, Number(event.chancePct ?? 100)));
      if (chancePct < 100 && random() * 100 > chancePct) continue;
      const pending = {
        id: params.createId(),
        eventId: entry.id,
        countryId,
        createdTurnId: params.turnId,
        expiresTurnId: getEventExpiresTurnId(event, params.turnId),
        scopes: scopeResult.scopes,
        triggerExplanation: [...scopeResult.explanations, ...triggerEvaluation.explanations],
      };
      record.pending.unshift(pending);
      if (record.pending.length > 100) record.pending.length = 100;
      pendingEventIds.add(entry.id);
      generated.push({
        countryId,
        pendingId: pending.id,
        eventId: entry.id,
        name: entry.name,
        description: entry.description,
        event,
      });
    }
  }

  return generated;
}

export function promoteScheduledCountryEvents(params: {
  scheduledByCountryId: Record<string, ScheduledCountryEvent[]>;
  entries: DecisionEventContentEntry[];
  turnId: number;
  ensureCountryEventRecord: (countryId: string) => CountryEventRecord;
  createId: () => string;
}): ScheduledCountryEventPromotion[] {
  const entryById = new Map(params.entries.map((entry) => [entry.id, entry] as const));
  const promoted: ScheduledCountryEventPromotion[] = [];

  for (const [countryId, scheduledItems] of Object.entries(params.scheduledByCountryId)) {
    const remaining: ScheduledCountryEvent[] = [];
    const record = params.ensureCountryEventRecord(countryId);
    const pendingEventIds = new Set(record.pending.map((item) => item.eventId));
    for (const scheduled of scheduledItems) {
      if (scheduled.scheduledTurnId > params.turnId) {
        remaining.push(scheduled);
        continue;
      }
      const entry = entryById.get(scheduled.eventId);
      if (!entry) continue;
      const event = getGameEventDefinition(entry);
      if (pendingEventIds.has(entry.id)) continue;
      if (!event.repeatable && record.completedEventIds.includes(entry.id)) continue;
      const pending = {
        id: params.createId(),
        eventId: entry.id,
        countryId,
        createdTurnId: params.turnId,
        expiresTurnId: getEventExpiresTurnId(event, params.turnId),
        scopes: scheduled.scopes,
        triggerExplanation: scheduled.triggerExplanation ?? [],
      };
      record.pending.unshift(pending);
      if (record.pending.length > 100) record.pending.length = 100;
      pendingEventIds.add(entry.id);
      promoted.push({
        countryId,
        pendingId: pending.id,
        eventId: entry.id,
        name: entry.name,
        description: entry.description,
        event,
      });
    }
    if (remaining.length > 0) {
      params.scheduledByCountryId[countryId] = remaining.slice(0, 200);
    } else {
      delete params.scheduledByCountryId[countryId];
    }
  }

  return promoted;
}

export function scheduleEventFollowups(params: {
  event: GameEventDefinition;
  pending: { countryId: string; scopes?: ScheduledCountryEvent["scopes"]; triggerExplanation?: ScheduledCountryEvent["triggerExplanation"] };
  countryScheduledEventsByCountryId: Record<string, ScheduledCountryEvent[]>;
  turnId: number;
  createId: () => string;
  random?: () => number;
  worldBase: Pick<
    WorldBase,
    "resourcesByCountry" | "resourceLedgerByTurn" | "regionOwner" | "regionController" | "regionPopulationByRegion" | "regionBuildingsByRegion" | "colonyProgressByRegion" | "regionResourceDepositsByRegion" | "regionColonizationByRegion"
  >;
  conditionsMatchCountry: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
  countryHasModifier?: CountryHasModifier;
}): ScheduledCountryEvent[] {
  const followups = params.event.chain?.followups ?? [];
  if (followups.length === 0 || params.event.chain?.endsChain === true) return [];
  const random = params.random ?? Math.random;
  const scheduled: ScheduledCountryEvent[] = [];
  const scopes = params.pending.scopes ?? { root: { kind: "country" as const, id: params.pending.countryId } };
  for (const followup of followups) {
    const chancePct = Math.min(100, Math.max(0, Number(followup.chancePct ?? 100)));
    if (chancePct < 100 && random() * 100 > chancePct) continue;
    if (followup.conditions) {
      const evaluation = evaluateEventTrigger({
        trigger: followup.conditions,
        countryId: params.pending.countryId,
        worldBase: params.worldBase,
        scopes,
        conditionsMatchCountry: params.conditionsMatchCountry,
        countryHasModifier: params.countryHasModifier,
      });
      if (!evaluation.passed) continue;
    }
    scheduled.push({
      id: params.createId(),
      eventId: followup.eventId,
      countryId: params.pending.countryId,
      scheduledTurnId: params.turnId + Math.max(0, Math.floor(Number(followup.delayTurns ?? 0))),
      scopes,
      chainId: params.event.chain?.chainId ?? null,
      createdTurnId: params.turnId,
      triggerExplanation: params.pending.triggerExplanation ?? [],
    });
  }
  if (scheduled.length > 0) {
    const current = params.countryScheduledEventsByCountryId[params.pending.countryId] ?? [];
    params.countryScheduledEventsByCountryId[params.pending.countryId] = [...current, ...scheduled]
      .sort((a, b) => a.scheduledTurnId - b.scheduledTurnId || a.eventId.localeCompare(b.eventId))
      .slice(0, 200);
  }
  return scheduled;
}

export function applyEventOptionEventEffects(params: {
  effects: GameEffect[] | undefined;
  countryId: string;
  pending: { scopes?: ScheduledCountryEvent["scopes"]; triggerExplanation?: ScheduledCountryEvent["triggerExplanation"] };
  eventById: Map<string, DecisionEventContentEntry>;
  recordsByCountryId: Record<string, CountryEventRecord>;
  countryScheduledEventsByCountryId: Record<string, ScheduledCountryEvent[]>;
  countryEventFlagsByCountryId: Record<string, Record<string, string | number | boolean>>;
  countryModifiersByCountryId: Record<string, CountryAppliedModifier[]>;
  colonyProgressByRegion: WorldBase["colonyProgressByRegion"];
  turnId: number;
  createId: () => string;
  sourceSystem?: CountryAppliedModifier["sourceSystem"];
  sourceId?: string;
  random?: () => number;
}): {
  triggeredPendingIds: string[];
  scheduled: ScheduledCountryEvent[];
  cancelledEventIds: string[];
  changedFlags: string[];
  changedModifierIds: string[];
  changedRegionIds: string[];
} {
  const triggeredPendingIds: string[] = [];
  const scheduled: ScheduledCountryEvent[] = [];
  const cancelledEventIds: string[] = [];
  const changedFlags: string[] = [];
  const changedModifierIds: string[] = [];
  const changedRegionIds: string[] = [];
  const scopes = params.pending.scopes ?? { root: { kind: "country" as const, id: params.countryId } };
  const triggerExplanation = params.pending.triggerExplanation ?? [];
  const random = params.random ?? Math.random;

  for (const effect of params.effects ?? []) {
    if (effect.type === "trigger_event") {
      const entry = params.eventById.get(effect.eventId);
      if (!entry) continue;
      const event = getGameEventDefinition(entry);
      const record =
        params.recordsByCountryId[params.countryId] ??
        { pending: [], completedEventIds: [], cooldownUntilTurnByEventId: {}, history: [] };
      if (record.pending.some((item) => item.eventId === effect.eventId)) continue;
      const pendingId = params.createId();
      record.pending.unshift({
        id: pendingId,
        eventId: effect.eventId,
        countryId: params.countryId,
        createdTurnId: params.turnId,
        expiresTurnId: getEventExpiresTurnId(event, params.turnId),
        scopes,
        triggerExplanation,
      });
      if (record.pending.length > 100) record.pending.length = 100;
      params.recordsByCountryId[params.countryId] = record;
      triggeredPendingIds.push(pendingId);
      continue;
    }
    if (effect.type === "schedule_event") {
      if (!params.eventById.has(effect.eventId)) continue;
      const chancePct = Math.min(100, Math.max(0, Number(effect.chancePct ?? 100)));
      if (chancePct < 100 && random() * 100 > chancePct) continue;
      scheduled.push({
        id: params.createId(),
        eventId: effect.eventId,
        countryId: params.countryId,
        scheduledTurnId: params.turnId + Math.max(0, Math.floor(Number(effect.delayTurns ?? 0))),
        scopes,
        chainId: null,
        createdTurnId: params.turnId,
        triggerExplanation,
      });
      continue;
    }
    if (effect.type === "cancel_event") {
      params.recordsByCountryId[params.countryId] = removePendingEventsByEventId(
        params.recordsByCountryId[params.countryId],
        effect.eventId,
      );
      params.countryScheduledEventsByCountryId[params.countryId] = (params.countryScheduledEventsByCountryId[params.countryId] ?? [])
        .filter((item) => item.eventId !== effect.eventId);
      if ((params.countryScheduledEventsByCountryId[params.countryId] ?? []).length === 0) {
        delete params.countryScheduledEventsByCountryId[params.countryId];
      }
      cancelledEventIds.push(effect.eventId);
      continue;
    }
    if (effect.type === "set_event_flag") {
      const flags = params.countryEventFlagsByCountryId[params.countryId] ?? {};
      flags[effect.flagId] = normalizeEventFlagValue(effect.value);
      params.countryEventFlagsByCountryId[params.countryId] = flags;
      changedFlags.push(effect.flagId);
      continue;
    }
    if (effect.type === "clear_event_flag") {
      const flags = params.countryEventFlagsByCountryId[params.countryId];
      if (flags) {
        delete flags[effect.flagId];
        if (Object.keys(flags).length === 0) delete params.countryEventFlagsByCountryId[params.countryId];
      }
      changedFlags.push(effect.flagId);
      continue;
    }
    if (effect.type === "add_modifier" || effect.type === "remove_modifier" || effect.type === "extend_modifier") {
      const changed = applyCountryModifierEffect({
        effect,
        countryId: params.countryId,
        countryModifiersByCountryId: params.countryModifiersByCountryId,
        turnId: params.turnId,
        createId: params.createId,
        sourceSystem: params.sourceSystem ?? "event",
        sourceId: params.sourceId ?? effect.modifierId,
      });
      if (changed) changedModifierIds.push(effect.modifierId);
      continue;
    }
    if (effect.type === "change_colonization_progress") {
      const regionId = scopes.region?.id ?? null;
      if (!regionId) continue;
      const current = params.colonyProgressByRegion[regionId] ?? {};
      const nextValue = Math.max(0, round3((current[params.countryId] ?? 0) + effect.amount));
      params.colonyProgressByRegion[regionId] = { ...current, [params.countryId]: nextValue };
      changedRegionIds.push(regionId);
    }
  }

  if (scheduled.length > 0) {
    const current = params.countryScheduledEventsByCountryId[params.countryId] ?? [];
    params.countryScheduledEventsByCountryId[params.countryId] = [...current, ...scheduled]
      .sort((a, b) => a.scheduledTurnId - b.scheduledTurnId || a.eventId.localeCompare(b.eventId))
      .slice(0, 200);
  }

  return { triggeredPendingIds, scheduled, cancelledEventIds, changedFlags, changedModifierIds, changedRegionIds };
}

function applyCountryModifierEffect(params: {
  effect: Extract<GameEffect, { type: "add_modifier" | "remove_modifier" | "extend_modifier" }>;
  countryId: string;
  countryModifiersByCountryId: Record<string, CountryAppliedModifier[]>;
  turnId: number;
  createId: () => string;
  sourceSystem: CountryAppliedModifier["sourceSystem"];
  sourceId: string;
}): boolean {
  const current = (params.countryModifiersByCountryId[params.countryId] ?? []).filter(
    (item) => item.expiresTurnId == null || item.expiresTurnId > params.turnId,
  );
  const modifierId = params.effect.modifierId;
  if (params.effect.type === "remove_modifier") {
    const next = current.filter((item) => item.modifierId !== modifierId);
    if (next.length === current.length) {
      if (current.length > 0) params.countryModifiersByCountryId[params.countryId] = current;
      return false;
    }
    if (next.length > 0) params.countryModifiersByCountryId[params.countryId] = next;
    else delete params.countryModifiersByCountryId[params.countryId];
    return true;
  }

  const durationTurns =
    params.effect.type === "add_modifier"
      ? Math.max(0, Math.floor(Number(params.effect.durationTurns ?? 0)))
      : Math.max(1, Math.floor(Number(params.effect.durationTurns ?? 1)));
  const expiresTurnId = durationTurns > 0 ? params.turnId + durationTurns : null;
  const existing = current.find((item) => item.modifierId === modifierId);
  if (existing) {
    if (params.effect.type === "extend_modifier") {
      const baseTurn = existing.expiresTurnId == null ? params.turnId : Math.max(params.turnId, existing.expiresTurnId);
      existing.expiresTurnId = baseTurn + durationTurns;
    } else {
      existing.expiresTurnId = expiresTurnId;
      existing.sourceSystem = params.sourceSystem;
      existing.sourceId = params.sourceId;
    }
    params.countryModifiersByCountryId[params.countryId] = current.slice(0, 200);
    return true;
  }

  current.unshift({
    id: params.createId(),
    modifierId,
    countryId: params.countryId,
    sourceSystem: params.sourceSystem,
    sourceId: params.sourceId,
    createdTurnId: params.turnId,
    expiresTurnId,
  });
  params.countryModifiersByCountryId[params.countryId] = current.slice(0, 200);
  return true;
}

function removePendingEventsByEventId(record: CountryEventRecord | undefined, eventId: string): CountryEventRecord {
  const next = record ?? { pending: [], completedEventIds: [], cooldownUntilTurnByEventId: {}, history: [] };
  next.pending = next.pending.filter((item) => item.eventId !== eventId);
  return next;
}

function normalizeEventFlagValue(input: string | number | boolean | null | undefined): string | number | boolean {
  if (typeof input === "string") return input.slice(0, 160);
  if (typeof input === "number" && Number.isFinite(input)) return Number(input.toFixed(3));
  if (typeof input === "boolean") return input;
  return true;
}

export function autoResolveExpiredCountryEvents(params: {
  recordsByCountryId: Record<string, CountryEventRecord>;
  countryScheduledEventsByCountryId: Record<string, ScheduledCountryEvent[]>;
  countryEventFlagsByCountryId: Record<string, Record<string, string | number | boolean>>;
  countryModifiersByCountryId: Record<string, CountryAppliedModifier[]>;
  colonyProgressByRegion: WorldBase["colonyProgressByRegion"];
  entries: DecisionEventContentEntry[];
  resourcesByCountry: Record<string, ResourceTotals>;
  worldBase: Pick<
    WorldBase,
    | "resourcesByCountry"
    | "resourceLedgerByTurn"
    | "regionOwner"
    | "regionController"
    | "regionPopulationByRegion"
    | "regionBuildingsByRegion"
    | "colonyProgressByRegion"
    | "regionResourceDepositsByRegion"
    | "regionColonizationByRegion"
    | "countryModifiersByCountryId"
  >;
  turnId: number;
  normalizeCountryEventRecord: (record: CountryEventRecord) => CountryEventRecord;
  conditionsMatchCountry: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
  countryHasModifier?: CountryHasModifier;
  createId: () => string;
  addIncome?: (input: DecisionEventLedgerFlowInput) => void;
  addExpense?: (input: DecisionEventLedgerFlowInput) => void;
  random?: () => number;
}): { resolved: AutoResolvedCountryEvent[]; notificationIdsToRemove: string[] } {
  const eventById = new Map(params.entries.map((entry) => [entry.id, entry] as const));
  const resolved: AutoResolvedCountryEvent[] = [];
  const notificationIdsToRemove: string[] = [];

  for (const [countryId, record] of Object.entries(params.recordsByCountryId)) {
    const normalized = params.normalizeCountryEventRecord(record);
    const remaining: CountryEventRecord["pending"] = [];
    const eventEffectsToApply: Array<{ option: GameEventOption; pending: CountryEventRecord["pending"][number] }> = [];
    let changed = false;
    for (const pending of normalized.pending) {
      if (pending.expiresTurnId == null || pending.expiresTurnId > params.turnId) {
        remaining.push(pending);
        continue;
      }
      const entry = eventById.get(pending.eventId);
      if (!entry) {
        changed = true;
        notificationIdsToRemove.push(getCountryEventNotificationId(countryId, pending.id));
        continue;
      }
      const event = getGameEventDefinition(entry);
      const option = chooseAutoEventOption(event.options, event.defaultOptionId, {
        countryId,
        worldBase: params.worldBase,
        scopes: pending.scopes,
        conditionsMatchCountry: params.conditionsMatchCountry,
        countryHasModifier: params.countryHasModifier,
      });
      if (!option) {
        remaining.push(pending);
        continue;
      }
      applyDecisionEffects(params.resourcesByCountry[countryId], option.effects, {
        countryId,
        sourceType: "event",
        sourceId: entry.id,
        addIncome: params.addIncome,
        addExpense: params.addExpense,
      });
      if (!normalized.completedEventIds.includes(entry.id)) normalized.completedEventIds.push(entry.id);
      const cooldown = Math.max(0, Math.floor(Number(event.cooldownTurns ?? 0)));
      if (cooldown > 0) normalized.cooldownUntilTurnByEventId[entry.id] = params.turnId + cooldown;
      scheduleEventFollowups({
        event,
        pending,
        countryScheduledEventsByCountryId: params.countryScheduledEventsByCountryId,
        turnId: params.turnId,
        createId: params.createId,
        random: params.random,
        worldBase: params.worldBase,
        conditionsMatchCountry: params.conditionsMatchCountry,
        countryHasModifier: params.countryHasModifier,
      });
      eventEffectsToApply.push({ option, pending });
      normalized.history.unshift({
        eventId: entry.id,
        optionId: option.id,
        resolvedTurnId: params.turnId,
        titleKey: entry.nameKey ?? null,
        optionLabelKey: option.labelKey,
        scopes: pending.scopes ?? {},
        appliedEffects: summarizeGameEffects(option.effects),
        explanationIds: [],
      });
      normalized.history = normalized.history.slice(0, 200);
      notificationIdsToRemove.push(getCountryEventNotificationId(countryId, pending.id));
      changed = true;
      resolved.push({
        countryId,
        pendingId: pending.id,
        eventId: entry.id,
        name: entry.name,
        optionId: option.id,
        optionLabelKey: option.labelKey,
        optionEffects: option.effects ?? [],
        event,
      });
    }
    if (changed) {
      normalized.pending = remaining;
      params.recordsByCountryId[countryId] = normalized;
      for (const item of eventEffectsToApply) {
        applyEventOptionEventEffects({
          effects: item.option.effects,
          countryId,
          pending: item.pending,
          eventById,
          recordsByCountryId: params.recordsByCountryId,
          countryScheduledEventsByCountryId: params.countryScheduledEventsByCountryId,
          countryEventFlagsByCountryId: params.countryEventFlagsByCountryId,
          countryModifiersByCountryId: params.countryModifiersByCountryId,
          colonyProgressByRegion: params.colonyProgressByRegion,
          turnId: params.turnId,
          createId: params.createId,
          sourceSystem: "event",
          sourceId: item.pending.eventId,
          random: params.random,
        });
      }
      params.recordsByCountryId[countryId] = normalized;
    }
  }

  return { resolved, notificationIdsToRemove };
}

function getEventExpiresTurnId(event: GameEventDefinition, createdTurnId: number): number | null {
  if (event.timeoutTurns == null) return null;
  return createdTurnId + Math.max(0, Math.floor(Number(event.timeoutTurns)));
}

export function getCountryEventNotificationId(countryId: string, pendingId: string): string {
  return `country-event:${countryId}:${pendingId}`;
}

export function eventCategoryToUiCategory(
  category: EventCategory,
): "system" | "economy" | "politics" {
  if (category === "economy" || category === "colonization") return "economy";
  if (category === "politics" || category === "diplomacy" || category === "military") return "politics";
  return "system";
}

export function normalizeEventPriority(input: EventPriority | undefined): EventPriority {
  return input ?? "medium";
}

export function normalizeEventVisibility(input: EventVisibility | undefined): EventVisibility {
  return input ?? "private";
}

const RESOURCE_KEYS = ["ducats", "gold", "culture", "science", "religion", "construction"] as const;

function round3(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}
