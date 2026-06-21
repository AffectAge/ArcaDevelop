import type {
  CountryDecisionRecord,
  CountryEventRecord,
  DecisionDefinition,
  DecisionEffect,
  EventCategory,
  EventPriority,
  EventVisibility,
  GameEventDefinition,
  GameEventOption,
  ModifierCondition,
  ResourceFlowSourceType,
  ResourceId,
  ResourceTotals,
} from "@arcanorum/shared";

export type DecisionEventContentEntry = {
  id: string;
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
  optionLabel: string;
  event: GameEventDefinition;
};

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
  options: [{ id: "ok", label: "Понятно", description: null, effects: [], autoChancePct: 100, buttonColor: null }],
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
): { ok: true } | { ok: false; reason: string } {
  if (!resources) return { ok: false, reason: "Нет ресурсов страны" };
  for (const key of RESOURCE_KEYS) {
    const cost = Number(costs?.[key] ?? 0);
    if (cost <= 0) continue;
    if ((resources[key] ?? 0) < cost) return { ok: false, reason: `Недостаточно ${key}: нужно ${cost}` };
  }
  return { ok: true };
}

export function getCountryDecisionView(params: {
  countryId: string;
  entry: DecisionEventContentEntry;
  record: CountryDecisionRecord;
  turnId: number;
  resources: ResourceTotals | undefined;
  conditionsMatchCountry: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
}): CountryDecisionView {
  const decision = getDecisionDefinition(params.entry);
  const visible = params.conditionsMatchCountry(decision.visibilityConditions, params.countryId);
  const completed = params.record.completedDecisionIds.includes(params.entry.id);
  const cooldownUntilTurn = params.record.cooldownUntilTurnByDecisionId[params.entry.id] ?? 0;
  let reason: string | null = null;
  if (!visible) {
    reason = "Скрыто условиями видимости";
  } else if (completed && !decision.repeatable) {
    reason = "Уже принято";
  } else if (cooldownUntilTurn > params.turnId) {
    reason = `Кулдаун до хода ${cooldownUntilTurn}`;
  } else if (!params.conditionsMatchCountry(decision.availabilityConditions, params.countryId)) {
    reason = "Не выполнены условия";
  } else {
    const costCheck = canPayDecisionCosts(params.resources, decision.costs);
    if (!costCheck.ok) reason = costCheck.reason;
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
  };
}

export function getVisibleCountryDecisions(params: {
  countryId: string;
  entries: DecisionEventContentEntry[];
  record: CountryDecisionRecord;
  turnId: number;
  resources: ResourceTotals | undefined;
  conditionsMatchCountry: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
}): CountryDecisionView[] {
  return params.entries
    .map((entry) =>
      getCountryDecisionView({
        countryId: params.countryId,
        entry,
        record: params.record,
        turnId: params.turnId,
        resources: params.resources,
        conditionsMatchCountry: params.conditionsMatchCountry,
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
  effects: DecisionEffect[] | undefined,
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
      };
    })
    .filter((row): row is CountryEventView => Boolean(row))
    .sort((a, b) => b.createdTurnId - a.createdTurnId || a.name.localeCompare(b.name, "ru"));
  return { events, record: params.record };
}

export function chooseAutoEventOption(
  options: GameEventOption[] | undefined,
  random: () => number = Math.random,
): GameEventOption | null {
  const rows = (options ?? []).filter((option) => option.id && option.label);
  if (rows.length === 0) return null;
  const weights = rows.map((option) => Math.max(0, Number(option.autoChancePct ?? 0)));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) {
    return rows[Math.floor(random() * rows.length)] ?? rows[0] ?? null;
  }
  let roll = random() * totalWeight;
  for (let i = 0; i < rows.length; i += 1) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return rows[i] ?? null;
  }
  return rows[rows.length - 1] ?? null;
}

export function maybeGenerateCountryEvents(params: {
  countryIds: string[];
  entries: DecisionEventContentEntry[];
  turnId: number;
  ensureCountryEventRecord: (countryId: string) => CountryEventRecord;
  conditionsMatchCountry: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
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
      if (!params.conditionsMatchCountry(event.triggerConditions, countryId)) continue;
      const chancePct = Math.min(100, Math.max(0, Number(event.chancePct ?? 100)));
      if (chancePct < 100 && random() * 100 > chancePct) continue;
      const pending = {
        id: params.createId(),
        eventId: entry.id,
        countryId,
        createdTurnId: params.turnId,
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

export function autoResolveExpiredCountryEvents(params: {
  recordsByCountryId: Record<string, CountryEventRecord>;
  entries: DecisionEventContentEntry[];
  resourcesByCountry: Record<string, ResourceTotals>;
  turnId: number;
  normalizeCountryEventRecord: (record: CountryEventRecord) => CountryEventRecord;
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
    let changed = false;
    for (const pending of normalized.pending) {
      if (pending.createdTurnId >= params.turnId) {
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
      const option = chooseAutoEventOption(event.options, params.random);
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
      normalized.history.unshift({
        eventId: entry.id,
        optionId: option.id,
        resolvedTurnId: params.turnId,
        label: entry.name,
        optionLabel: option.label,
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
        optionLabel: option.label,
        event,
      });
    }
    if (changed) {
      normalized.pending = remaining;
      params.recordsByCountryId[countryId] = normalized;
    }
  }

  return { resolved, notificationIdsToRemove };
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
