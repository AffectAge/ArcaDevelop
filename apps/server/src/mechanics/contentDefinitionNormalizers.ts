import type {
  DecisionCategory,
  DecisionDefinition,
  DecisionEffect,
  AiWeightRule,
  EventCategory,
  EventPriority,
  EventScopeDefinition,
  EventTriggerDefinition,
  EventVisibility,
  GameEffect,
  EventChainDefinition,
  GameEventDefinition,
  GameEventOption,
  IdeologyAttractionConditionType,
  IdeologyAttractionRule,
  ModifierCondition,
  ModifierConditionType,
  ModifierDefinition,
  ModifierEffect,
  ModifierMode,
  ModifierScope,
  ModifierStat,
  JournalCategory,
  JournalEntryDefinition,
  JournalPriority,
  JournalVisibility,
  ResourceTotals,
} from "@arcanorum/shared";

const MODIFIER_STATS = new Set<ModifierStat>([
  "culture_gain",
  "science_gain",
  "religion_gain",
  "colonization_gain",
  "construction_gain",
  "ducats_gain",
  "gold_gain",
  "technology_cost",
  "building_construction_cost",
  "building_output",
  "building_input",
  "building_throughput",
  "building_wage",
  "hex_movement_cost",
]);
const MODIFIER_MODES = new Set<ModifierMode>(["add", "add_pct", "mult"]);
const MODIFIER_SCOPES = new Set<ModifierScope>(["country", "region", "building", "pop", "market"]);
const MODIFIER_CONDITION_TYPES = new Set<ModifierConditionType>([
  "always",
  "law_active",
  "technology_researched",
  "country_is",
  "has_building",
]);

const DECISION_CATEGORIES = new Set<DecisionCategory>([
  "economy",
  "politics",
  "military",
  "diplomacy",
  "colonization",
  "culture",
  "religion",
  "technology",
]);
const EVENT_CATEGORIES = new Set<EventCategory>(["system", "colonization", "politics", "economy", "military", "diplomacy"]);
const EVENT_PRIORITIES = new Set<EventPriority>(["low", "medium", "high"]);
const EVENT_VISIBILITIES = new Set<EventVisibility>(["public", "private"]);
const EVENT_BUTTON_TONES = new Set<NonNullable<GameEventOption["buttonTone"]>>(["default", "primary", "danger", "warning"]);
const JOURNAL_CATEGORIES = new Set<JournalCategory>([
  "politics",
  "economy",
  "military",
  "diplomacy",
  "colonization",
  "technology",
  "society",
  "regional",
  "crisis",
]);
const JOURNAL_PRIORITIES = new Set<JournalPriority>(["low", "medium", "high", "critical"]);
const JOURNAL_VISIBILITIES = new Set<JournalVisibility>(["public", "private"]);
const EVENT_TRIGGER_TYPES = new Set<string>([
  ...MODIFIER_CONDITION_TYPES,
  "country_resource_above",
  "country_resource_below",
  "treasury_below",
  "resource_flow_negative",
  "country_has_law",
  "country_lacks_law",
  "country_has_technology",
  "country_lacks_technology",
  "country_has_modifier",
  "country_controls_region_count_above",
  "country_controls_region_count_below",
  "controls_foreign_region",
  "region_owner_is",
  "region_controller_is",
  "region_is_colonizable",
  "region_population_above",
  "region_population_below",
  "region_has_population_above",
  "region_has_population_below",
  "region_has_building",
  "region_has_resource_deposit",
  "region_radicals_above",
  "region_loyalists_above",
  "region_standard_of_living_below",
  "region_colonization_progress_above",
  "region_colonization_progress_below",
  "building_profit_below",
  "building_employment_below",
  "building_output_above",
]);
const RESOURCE_KEYS: Array<keyof ResourceTotals> = [
  "culture",
  "science",
  "religion",
  "colonization",
  "construction",
  "ducats",
  "gold",
];

const IDEOLOGY_ATTRACTION_CONDITION_TYPES = new Set<IdeologyAttractionConditionType>([
  "sol_below",
  "sol_above",
  "radicals_above",
  "loyalists_above",
  "profession_is",
  "religion_is",
  "culture_is",
  "law_active",
  "has_building",
  "country_modifier_active",
  "region_modifier_active",
]);

export function normalizeModifierConditions(input: unknown): ModifierCondition[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw): ModifierCondition | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const typeRaw = typeof row.type === "string" ? row.type : "always";
      if (!MODIFIER_CONDITION_TYPES.has(typeRaw as ModifierConditionType)) return null;
      const type = typeRaw as ModifierConditionType;
      const targetId = typeof row.targetId === "string" && row.targetId.trim() ? row.targetId.trim().slice(0, 120) : null;
      if (type !== "always" && !targetId) return null;
      return { type, targetId, invert: Boolean(row.invert) };
    })
    .filter((condition): condition is ModifierCondition => Boolean(condition));
}

export function normalizeModifiers(input: unknown): ModifierDefinition[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw, index): ModifierDefinition | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 120) : `modifier-${index + 1}`;
      const label =
        typeof row.label === "string" && row.label.trim() ? row.label.trim().slice(0, 120) : `Модификатор ${index + 1}`;
      const scopeRaw = typeof row.scope === "string" ? row.scope : "country";
      const scope = MODIFIER_SCOPES.has(scopeRaw as ModifierScope) ? (scopeRaw as ModifierScope) : "country";
      const conditions = normalizeModifierConditions(row.conditions);
      const effectsRaw = Array.isArray(row.effects) ? row.effects : [];
      const effects = effectsRaw
        .map((effectRaw): ModifierEffect | null => {
          if (!effectRaw || typeof effectRaw !== "object") return null;
          const effect = effectRaw as Record<string, unknown>;
          const statRaw = typeof effect.stat === "string" ? effect.stat : "";
          const modeRaw = typeof effect.mode === "string" ? effect.mode : "add_pct";
          if (!MODIFIER_STATS.has(statRaw as ModifierStat) || !MODIFIER_MODES.has(modeRaw as ModifierMode)) return null;
          const value = typeof effect.value === "number" && Number.isFinite(effect.value) ? effect.value : 0;
          const targetRaw = effect.target && typeof effect.target === "object" ? (effect.target as Record<string, unknown>) : {};
          const target = {
            buildingId: typeof targetRaw.buildingId === "string" && targetRaw.buildingId.trim() ? targetRaw.buildingId.trim().slice(0, 120) : null,
            goodId: typeof targetRaw.goodId === "string" && targetRaw.goodId.trim() ? targetRaw.goodId.trim().slice(0, 120) : null,
            professionId: typeof targetRaw.professionId === "string" && targetRaw.professionId.trim() ? targetRaw.professionId.trim().slice(0, 120) : null,
            resourceCategoryId:
              typeof targetRaw.resourceCategoryId === "string" && targetRaw.resourceCategoryId.trim()
                ? targetRaw.resourceCategoryId.trim().slice(0, 120)
                : null,
            hexTag: typeof targetRaw.hexTag === "string" && targetRaw.hexTag.trim() ? targetRaw.hexTag.trim().slice(0, 80) : null,
          };
          const hasTarget = Object.values(target).some(Boolean);
          return {
            stat: statRaw as ModifierStat,
            mode: modeRaw as ModifierMode,
            value: Number(value.toFixed(3)),
            target: hasTarget ? target : null,
          };
        })
        .filter((effect): effect is ModifierEffect => Boolean(effect));
      if (effects.length === 0) return null;
      return { id, label, scope, conditions, effects };
    })
    .filter((modifier): modifier is ModifierDefinition => Boolean(modifier));
}

export function normalizeDecisionCosts(input: unknown): Partial<ResourceTotals> {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const costs: Partial<ResourceTotals> = {};
  for (const key of RESOURCE_KEYS) {
    const value = Number(source[key]);
    if (!Number.isFinite(value) || value <= 0) continue;
    costs[key] = Number(value.toFixed(3));
  }
  return costs;
}

export function normalizeDecisionEffects(input: unknown): Array<DecisionEffect | GameEffect> {
  if (!Array.isArray(input)) return [];
  const effects: Array<DecisionEffect | GameEffect> = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (row.type !== "resource_delta") {
      const normalized = normalizeGameEffects([raw]);
      if (normalized[0]) effects.push(normalized[0]);
      continue;
    }
    const resource =
      typeof row.resource === "string" && RESOURCE_KEYS.includes(row.resource as keyof ResourceTotals)
        ? (row.resource as keyof ResourceTotals)
        : null;
    const amount = Number(row.amount);
    if (!resource || !Number.isFinite(amount) || amount === 0) continue;
    effects.push({ type: "resource_delta", resource, amount: Number(amount.toFixed(3)) });
    if (effects.length >= 30) break;
  }
  return effects;
}

export function normalizeGameEffects(input: unknown): GameEffect[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw): GameEffect | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      if (row.type === "trigger_event" || row.type === "schedule_event" || row.type === "cancel_event") {
        const eventId = typeof row.eventId === "string" && row.eventId.trim() ? row.eventId.trim().slice(0, 120) : null;
        if (!eventId) return null;
        if (row.type === "schedule_event") {
          const delayTurns = Number(row.delayTurns);
          const chancePct = Number(row.chancePct);
          return {
            type: "schedule_event",
            eventId,
            delayTurns: Number.isFinite(delayTurns) ? Math.max(0, Math.floor(delayTurns)) : 0,
            chancePct: Number.isFinite(chancePct) ? Math.min(100, Math.max(0, Number(chancePct.toFixed(3)))) : 100,
          };
        }
        return { type: row.type, eventId };
      }
      if (row.type === "set_event_flag" || row.type === "clear_event_flag") {
        const flagId = typeof row.flagId === "string" && row.flagId.trim() ? row.flagId.trim().slice(0, 160) : null;
        if (!flagId) return null;
        if (row.type === "clear_event_flag") return { type: "clear_event_flag", flagId };
        const value =
          typeof row.value === "string"
            ? row.value.slice(0, 160)
            : typeof row.value === "number" && Number.isFinite(row.value)
              ? Number(row.value.toFixed(3))
              : typeof row.value === "boolean"
                ? row.value
                : true;
        return { type: "set_event_flag", flagId, value };
      }
      if (row.type === "add_modifier" || row.type === "remove_modifier" || row.type === "extend_modifier") {
        const modifierId = typeof row.modifierId === "string" && row.modifierId.trim() ? row.modifierId.trim().slice(0, 120) : null;
        if (!modifierId) return null;
        if (row.type === "remove_modifier") return { type: "remove_modifier", modifierId };
        const durationTurns = Number(row.durationTurns);
        if (row.type === "extend_modifier") {
          if (!Number.isFinite(durationTurns) || durationTurns <= 0) return null;
          return { type: "extend_modifier", modifierId, durationTurns: Math.floor(durationTurns) };
        }
        return {
          type: "add_modifier",
          modifierId,
          durationTurns: Number.isFinite(durationTurns) && durationTurns > 0 ? Math.floor(durationTurns) : null,
        };
      }
      if (
        row.type === "start_journal_entry" ||
        row.type === "complete_journal_entry" ||
        row.type === "fail_journal_entry" ||
        row.type === "cancel_journal_entry"
      ) {
        const journalEntryId =
          typeof row.journalEntryId === "string" && row.journalEntryId.trim() ? row.journalEntryId.trim().slice(0, 120) : null;
        if (!journalEntryId) return null;
        return { type: row.type, journalEntryId };
      }
      if (row.type === "advance_journal_entry") {
        const journalEntryId =
          typeof row.journalEntryId === "string" && row.journalEntryId.trim() ? row.journalEntryId.trim().slice(0, 120) : null;
        const amount = Number(row.amount);
        if (!journalEntryId || !Number.isFinite(amount) || amount <= 0) return null;
        return { type: "advance_journal_entry", journalEntryId, amount: Number(amount.toFixed(3)) };
      }
      if (row.type === "set_journal_variable" || row.type === "clear_journal_variable") {
        const journalEntryId =
          typeof row.journalEntryId === "string" && row.journalEntryId.trim() ? row.journalEntryId.trim().slice(0, 120) : null;
        const variableId = typeof row.variableId === "string" && row.variableId.trim() ? row.variableId.trim().slice(0, 160) : null;
        if (!journalEntryId || !variableId) return null;
        if (row.type === "clear_journal_variable") return { type: "clear_journal_variable", journalEntryId, variableId };
        const value =
          typeof row.value === "string"
            ? row.value.slice(0, 160)
            : typeof row.value === "number" && Number.isFinite(row.value)
              ? Number(row.value.toFixed(3))
              : typeof row.value === "boolean"
                ? row.value
                : true;
        return { type: "set_journal_variable", journalEntryId, variableId, value };
      }
      if (row.type === "change_colonization_progress") {
        const amount = Number(row.amount);
        if (!Number.isFinite(amount) || amount === 0) return null;
        return { type: "change_colonization_progress", amount: Number(amount.toFixed(3)) };
      }
      const resource =
        typeof row.resource === "string" && RESOURCE_KEYS.includes(row.resource as keyof ResourceTotals)
          ? (row.resource as keyof ResourceTotals)
          : null;
      const amount = Number(row.amount);
      if (!resource || !Number.isFinite(amount) || amount <= 0) return null;
      const labelKey = typeof row.labelKey === "string" && row.labelKey.trim() ? row.labelKey.trim().slice(0, 160) : null;
      if (row.type === "add_resource") {
        return { type: "add_resource", resource, amount: Number(amount.toFixed(3)), labelKey };
      }
      if (row.type === "spend_resource") {
        return { type: "spend_resource", resource, amount: Number(amount.toFixed(3)), labelKey };
      }
      if (row.type === "add_resource_flow") {
        const direction = row.direction === "income" || row.direction === "expense" ? row.direction : null;
        const categoryId =
          typeof row.categoryId === "string" && row.categoryId.trim() ? row.categoryId.trim().slice(0, 120) : null;
        if (!direction || !labelKey) return null;
        return { type: "add_resource_flow", resource, amount: Number(amount.toFixed(3)), direction, categoryId, labelKey };
      }
      return null;
    })
    .filter((effect): effect is GameEffect => Boolean(effect))
    .slice(0, 30);
}

export function normalizeEventTrigger(input: unknown, depth = 0): EventTriggerDefinition | null {
  if (!input || typeof input !== "object" || depth > 5) return null;
  const row = input as Record<string, unknown>;
  if (Array.isArray(row.all)) {
    const all = row.all
      .map((child) => normalizeEventTrigger(child, depth + 1))
      .filter((child): child is EventTriggerDefinition => Boolean(child))
      .slice(0, 20);
    return all.length > 0 ? { all } : null;
  }
  if (Array.isArray(row.any)) {
    const any = row.any
      .map((child) => normalizeEventTrigger(child, depth + 1))
      .filter((child): child is EventTriggerDefinition => Boolean(child))
      .slice(0, 20);
    return any.length > 0 ? { any } : null;
  }
  if (row.not && typeof row.not === "object") {
    const not = normalizeEventTrigger(row.not, depth + 1);
    return not ? { not } : null;
  }
  const typeRaw = typeof row.type === "string" ? row.type.trim() : "";
  if (!EVENT_TRIGGER_TYPES.has(typeRaw)) return null;
  const targetId = typeof row.targetId === "string" && row.targetId.trim() ? row.targetId.trim().slice(0, 120) : null;
  const numericValue = typeof row.value === "number" && Number.isFinite(row.value) ? Number(row.value.toFixed(3)) : null;
  if (typeRaw === "country_resource_above" || typeRaw === "country_resource_below") {
    const resource =
      typeof row.resource === "string" && RESOURCE_KEYS.includes(row.resource as keyof ResourceTotals)
        ? (row.resource as keyof ResourceTotals)
        : null;
    if (!resource || numericValue == null) return null;
    return { type: typeRaw, resource, value: numericValue };
  }
  if (typeRaw === "resource_flow_negative") {
    const resource =
      typeof row.resource === "string" && RESOURCE_KEYS.includes(row.resource as keyof ResourceTotals)
        ? (row.resource as keyof ResourceTotals)
        : null;
    if (!resource) return null;
    return { type: "resource_flow_negative", resource };
  }
  if (typeRaw === "treasury_below") {
    if (numericValue == null) return null;
    return { type: "treasury_below", value: numericValue };
  }
  if (typeRaw === "country_controls_region_count_above" || typeRaw === "country_controls_region_count_below") {
    if (numericValue == null) return null;
    return { type: typeRaw, value: numericValue };
  }
  if (typeRaw === "controls_foreign_region") {
    return { type: "controls_foreign_region" };
  }
  if (
    typeRaw === "region_population_above" ||
    typeRaw === "region_population_below" ||
    typeRaw === "region_has_population_above" ||
    typeRaw === "region_has_population_below" ||
    typeRaw === "region_radicals_above" ||
    typeRaw === "region_loyalists_above" ||
    typeRaw === "region_standard_of_living_below" ||
    typeRaw === "region_colonization_progress_above" ||
    typeRaw === "region_colonization_progress_below" ||
    typeRaw === "building_profit_below" ||
    typeRaw === "building_employment_below"
  ) {
    if (numericValue == null) return null;
    return { type: typeRaw, value: numericValue };
  }
  if (typeRaw === "building_output_above") {
    if (!targetId || numericValue == null) return null;
    return { type: "building_output_above", targetId, value: numericValue };
  }
  if (
    typeRaw === "country_has_law" ||
    typeRaw === "country_lacks_law" ||
    typeRaw === "country_has_technology" ||
    typeRaw === "country_lacks_technology" ||
    typeRaw === "country_has_modifier"
  ) {
    if (!targetId) return null;
    return { type: typeRaw, targetId, invert: row.invert === true };
  }
  if (
    typeRaw === "region_owner_is" ||
    typeRaw === "region_controller_is" ||
    typeRaw === "region_has_building" ||
    typeRaw === "region_has_resource_deposit"
  ) {
    return { type: typeRaw, targetId };
  }
  if (typeRaw === "region_is_colonizable") {
    return { type: "region_is_colonizable" };
  }
  if (!MODIFIER_CONDITION_TYPES.has(typeRaw as ModifierConditionType)) return null;
  if (typeRaw !== "always" && !targetId) return null;
  return { type: typeRaw as ModifierConditionType, targetId, invert: row.invert === true };
}

export function normalizeEventScope(input: unknown): EventScopeDefinition | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const regionRaw = row.region && typeof row.region === "object" ? (row.region as Record<string, unknown>) : null;
  if (!regionRaw) return { root: { kind: "country" } };
  const from =
    regionRaw.from === "root.owned_regions" || regionRaw.from === "root.controlled_regions"
      ? regionRaw.from
      : "root.controlled_regions";
  const pickRaw = regionRaw.pick && typeof regionRaw.pick === "object" ? (regionRaw.pick as Record<string, unknown>) : {};
  const orderBy =
    pickRaw.orderBy === "population" || pickRaw.orderBy === "buildings" || pickRaw.orderBy === "regionId"
      ? pickRaw.orderBy
      : "regionId";
  const direction = pickRaw.direction === "desc" ? "desc" : "asc";
  const where = normalizeEventTrigger(regionRaw.where);
  return {
    root: { kind: "country" },
    region: {
      kind: "region",
      from,
      ...(where ? { where } : {}),
      pick: { orderBy, direction },
    },
  };
}

export function normalizeEventChain(input: unknown): EventChainDefinition | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const chainId = typeof row.chainId === "string" && row.chainId.trim() ? row.chainId.trim().slice(0, 120) : "";
  const stepId = typeof row.stepId === "string" && row.stepId.trim() ? row.stepId.trim().slice(0, 120) : "";
  if (!chainId || !stepId) return null;
  const followups = Array.isArray(row.followups)
    ? row.followups
        .map((raw): NonNullable<EventChainDefinition["followups"]>[number] | null => {
          if (!raw || typeof raw !== "object") return null;
          const followup = raw as Record<string, unknown>;
          const eventId = typeof followup.eventId === "string" && followup.eventId.trim() ? followup.eventId.trim().slice(0, 120) : "";
          if (!eventId) return null;
          const delayTurns = Number(followup.delayTurns);
          const chancePct = Number(followup.chancePct);
          const conditions = normalizeEventTrigger(followup.conditions);
          return {
            eventId,
            delayTurns: Number.isFinite(delayTurns) ? Math.max(0, Math.floor(delayTurns)) : 0,
            chancePct: Number.isFinite(chancePct) ? Math.min(100, Math.max(0, Number(chancePct.toFixed(3)))) : 100,
            ...(conditions ? { conditions } : {}),
          };
        })
        .filter((followup): followup is NonNullable<EventChainDefinition["followups"]>[number] => Boolean(followup))
        .slice(0, 12)
    : [];
  return {
    chainId,
    stepId,
    startsChain: row.startsChain === true,
    endsChain: row.endsChain === true,
    followups,
  };
}

export function normalizeDecision(input: unknown): DecisionDefinition | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const categoryRaw = typeof row.category === "string" ? row.category : "politics";
  const category = DECISION_CATEGORIES.has(categoryRaw as DecisionCategory) ? (categoryRaw as DecisionCategory) : "politics";
  const cooldownTurns = Number(row.cooldownTurns);
  const charges = Number(row.charges);
  const rechargeTurns = Number(row.rechargeTurns);
  const maxUses = Number(row.maxUses);
  const maxUsesPerCountry = Number(row.maxUsesPerCountry);
  const maxUsesPerTarget = Number(row.maxUsesPerTarget);
  return {
    category,
    scope: normalizeEventScope(row.scope),
    potential: normalizeEventTrigger(row.potential),
    allow: normalizeEventTrigger(row.allow),
    visibleWhenUnavailable: row.visibleWhenUnavailable === true,
    visibilityConditions: normalizeModifierConditions(row.visibilityConditions),
    availabilityConditions: normalizeModifierConditions(row.availabilityConditions),
    costs: normalizeDecisionCosts(row.costs),
    effects: normalizeDecisionEffects(row.effects),
    charges: Number.isFinite(charges) && charges > 0 ? Math.floor(charges) : undefined,
    rechargeTurns: Number.isFinite(rechargeTurns) && rechargeTurns > 0 ? Math.floor(rechargeTurns) : undefined,
    maxUses: Number.isFinite(maxUses) && maxUses > 0 ? Math.floor(maxUses) : undefined,
    maxUsesPerCountry: Number.isFinite(maxUsesPerCountry) && maxUsesPerCountry > 0 ? Math.floor(maxUsesPerCountry) : undefined,
    maxUsesPerTarget: Number.isFinite(maxUsesPerTarget) && maxUsesPerTarget > 0 ? Math.floor(maxUsesPerTarget) : undefined,
    cooldownTurns: Number.isFinite(cooldownTurns) ? Math.max(0, Math.floor(cooldownTurns)) : 0,
    repeatable: Boolean(row.repeatable),
  };
}

export function normalizeEventOptions(input: unknown): GameEventOption[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input
    .map((raw, index): GameEventOption | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const fallbackId = `option:${index + 1}`;
      const rawId = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 120) : fallbackId;
      const id = seen.has(rawId) ? `${rawId}:${index + 1}` : rawId;
      seen.add(id);
      const labelKey = typeof row.labelKey === "string" && row.labelKey.trim() ? row.labelKey.trim().slice(0, 160) : null;
      if (!labelKey) return null;
      const descriptionKey =
        typeof row.descriptionKey === "string" && row.descriptionKey.trim() ? row.descriptionKey.trim().slice(0, 160) : null;
      const tooltipKey = typeof row.tooltipKey === "string" && row.tooltipKey.trim() ? row.tooltipKey.trim().slice(0, 160) : null;
      const buttonToneRaw = typeof row.buttonTone === "string" ? row.buttonTone.trim() : "default";
      const buttonTone = EVENT_BUTTON_TONES.has(buttonToneRaw as NonNullable<GameEventOption["buttonTone"]>)
        ? (buttonToneRaw as NonNullable<GameEventOption["buttonTone"]>)
        : "default";
      return {
        id,
        labelKey,
        descriptionKey,
        tooltipKey,
        effects: normalizeGameEffects(row.effects),
        aiWeight: normalizeAiWeightRules(row.aiWeight),
        playerDefault: row.playerDefault === true ? true : null,
        buttonTone,
      };
    })
    .filter((option): option is GameEventOption => Boolean(option))
    .slice(0, 8);
}

function normalizeAiWeightRules(input: unknown): AiWeightRule[] | null {
  if (!Array.isArray(input)) return null;
  const rules = input
    .map((raw): AiWeightRule | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      if ("base" in row) {
        const base = Number(row.base);
        return Number.isFinite(base) ? { base: Number(base.toFixed(3)) } : null;
      }
      const trigger = normalizeEventTrigger(row.if);
      if (!trigger) return null;
      const add = Number(row.add);
      const multiply = Number(row.multiply);
      return {
        if: trigger,
        add: Number.isFinite(add) ? Number(add.toFixed(3)) : null,
        multiply: Number.isFinite(multiply) ? Number(multiply.toFixed(3)) : null,
      };
    })
    .filter((rule): rule is AiWeightRule => Boolean(rule))
    .slice(0, 20);
  return rules.length > 0 ? rules : null;
}

export function normalizeGameEvent(input: unknown): GameEventDefinition | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const namespace = typeof row.namespace === "string" && row.namespace.trim() ? row.namespace.trim().slice(0, 80) : undefined;
  const titleKey = typeof row.titleKey === "string" && row.titleKey.trim() ? row.titleKey.trim().slice(0, 160) : undefined;
  const descriptionKey =
    typeof row.descriptionKey === "string" && row.descriptionKey.trim() ? row.descriptionKey.trim().slice(0, 160) : undefined;
  const imageUrl = typeof row.imageUrl === "string" && row.imageUrl.trim() ? row.imageUrl.trim().slice(0, 500) : null;
  const iconId = typeof row.iconId === "string" && row.iconId.trim() ? row.iconId.trim().slice(0, 120) : null;
  const categoryRaw = typeof row.category === "string" ? row.category : "politics";
  const priorityRaw = typeof row.priority === "string" ? row.priority : "medium";
  const visibilityRaw = typeof row.visibility === "string" ? row.visibility : "private";
  const cooldownTurns = Number(row.cooldownTurns);
  const timeoutTurns = Number(row.timeoutTurns);
  const checkIntervalTurns = Number(row.checkIntervalTurns);
  const chancePct = Number(row.chancePct);
  const options = normalizeEventOptions(row.options);
  const defaultOptionId =
    typeof row.defaultOptionId === "string" && row.defaultOptionId.trim() ? row.defaultOptionId.trim().slice(0, 120) : null;
  return {
    ...(namespace ? { namespace } : {}),
    category: EVENT_CATEGORIES.has(categoryRaw as EventCategory) ? (categoryRaw as EventCategory) : "politics",
    priority: EVENT_PRIORITIES.has(priorityRaw as EventPriority) ? (priorityRaw as EventPriority) : "medium",
    visibility: EVENT_VISIBILITIES.has(visibilityRaw as EventVisibility) ? (visibilityRaw as EventVisibility) : "private",
    ...(titleKey ? { titleKey } : {}),
    ...(descriptionKey ? { descriptionKey } : {}),
    imageUrl,
    iconId,
    scope: normalizeEventScope(row.scope),
    trigger: normalizeEventTrigger(row.trigger),
    triggerConditions: normalizeModifierConditions(row.triggerConditions),
    options,
    chain: normalizeEventChain(row.chain),
    cooldownTurns: Number.isFinite(cooldownTurns) ? Math.max(0, Math.floor(cooldownTurns)) : 0,
    repeatable: Boolean(row.repeatable),
    timeoutTurns: Number.isFinite(timeoutTurns) ? Math.max(0, Math.floor(timeoutTurns)) : null,
    defaultOptionId,
    checkIntervalTurns: Number.isFinite(checkIntervalTurns) ? Math.max(1, Math.floor(checkIntervalTurns)) : 1,
    chancePct: Number.isFinite(chancePct) ? Math.min(100, Math.max(0, Number(chancePct.toFixed(3)))) : 100,
    blocking: Boolean(row.blocking),
  };
}

function normalizeJournalProgress(input: unknown): JournalEntryDefinition["progress"] {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const type = row.type === "trigger" ? "trigger" : row.type === "manual" ? "manual" : null;
  const target = Number(row.target);
  const labelKey = typeof row.labelKey === "string" && row.labelKey.trim() ? row.labelKey.trim().slice(0, 160) : "";
  if (!type || !Number.isFinite(target) || target <= 0 || !labelKey) return null;
  return {
    type,
    target: Number(target.toFixed(3)),
    labelKey,
  };
}

function normalizeJournalEventHooks(input: unknown): JournalEntryDefinition["events"] {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const normalizeIds = (value: unknown) =>
    Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim().slice(0, 120))
          .slice(0, 20)
      : [];
  const hooks = {
    onStart: normalizeIds(row.onStart),
    onComplete: normalizeIds(row.onComplete),
    onFail: normalizeIds(row.onFail),
    onCancel: normalizeIds(row.onCancel),
  };
  return hooks.onStart.length || hooks.onComplete.length || hooks.onFail.length || hooks.onCancel.length ? hooks : null;
}

function normalizeJournalDecisionHooks(input: unknown): JournalEntryDefinition["decisions"] {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const availableDecisionIds = Array.isArray(row.availableDecisionIds)
    ? row.availableDecisionIds
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 120))
        .slice(0, 50)
    : [];
  return availableDecisionIds.length ? { availableDecisionIds } : null;
}

function normalizeJournalModifierHooks(input: unknown): JournalEntryDefinition["modifiers"] {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const activeModifierIds = Array.isArray(row.activeModifierIds)
    ? row.activeModifierIds
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 120))
        .slice(0, 50)
    : [];
  return activeModifierIds.length ? { activeModifierIds } : null;
}

export function normalizeJournalEntry(input: unknown): JournalEntryDefinition | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const titleKey = typeof row.titleKey === "string" && row.titleKey.trim() ? row.titleKey.trim().slice(0, 160) : "";
  const descriptionKey =
    typeof row.descriptionKey === "string" && row.descriptionKey.trim() ? row.descriptionKey.trim().slice(0, 160) : "";
  if (!titleKey || !descriptionKey) return null;
  const namespace = typeof row.namespace === "string" && row.namespace.trim() ? row.namespace.trim().slice(0, 80) : undefined;
  const shortDescriptionKey =
    typeof row.shortDescriptionKey === "string" && row.shortDescriptionKey.trim() ? row.shortDescriptionKey.trim().slice(0, 160) : null;
  const imageUrl = typeof row.imageUrl === "string" && row.imageUrl.trim() ? row.imageUrl.trim().slice(0, 500) : null;
  const iconId = typeof row.iconId === "string" && row.iconId.trim() ? row.iconId.trim().slice(0, 120) : null;
  const categoryRaw = typeof row.category === "string" ? row.category : "politics";
  const priorityRaw = typeof row.priority === "string" ? row.priority : "medium";
  const visibilityRaw = typeof row.visibility === "string" ? row.visibility : "private";
  const timeoutTurns = Number(row.timeoutTurns);
  const cooldownTurns = Number(row.cooldownTurns);
  return {
    ...(namespace ? { namespace } : {}),
    category: JOURNAL_CATEGORIES.has(categoryRaw as JournalCategory) ? (categoryRaw as JournalCategory) : "politics",
    titleKey,
    descriptionKey,
    shortDescriptionKey,
    iconId,
    imageUrl,
    visibility: JOURNAL_VISIBILITIES.has(visibilityRaw as JournalVisibility) ? (visibilityRaw as JournalVisibility) : "private",
    priority: JOURNAL_PRIORITIES.has(priorityRaw as JournalPriority) ? (priorityRaw as JournalPriority) : "medium",
    scope: normalizeEventScope(row.scope),
    startTrigger: normalizeEventTrigger(row.startTrigger),
    completeTrigger: normalizeEventTrigger(row.completeTrigger),
    failTrigger: normalizeEventTrigger(row.failTrigger),
    cancelTrigger: normalizeEventTrigger(row.cancelTrigger),
    progress: normalizeJournalProgress(row.progress),
    timeoutTurns: Number.isFinite(timeoutTurns) ? Math.max(0, Math.floor(timeoutTurns)) : null,
    onStartEffects: normalizeGameEffects(row.onStartEffects),
    onCompleteEffects: normalizeGameEffects(row.onCompleteEffects),
    onFailEffects: normalizeGameEffects(row.onFailEffects),
    onCancelEffects: normalizeGameEffects(row.onCancelEffects),
    events: normalizeJournalEventHooks(row.events),
    decisions: normalizeJournalDecisionHooks(row.decisions),
    modifiers: normalizeJournalModifierHooks(row.modifiers),
    repeatable: Boolean(row.repeatable),
    cooldownTurns: Number.isFinite(cooldownTurns) ? Math.max(0, Math.floor(cooldownTurns)) : 0,
  };
}

export function normalizeIdeologyAttractionRules(input: unknown): IdeologyAttractionRule[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input
    .map((raw, index): IdeologyAttractionRule | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Partial<Record<keyof IdeologyAttractionRule, unknown>>;
      const typeRaw = typeof row.type === "string" ? row.type.trim() : "";
      if (!IDEOLOGY_ATTRACTION_CONDITION_TYPES.has(typeRaw as IdeologyAttractionConditionType)) return null;
      const fallbackId = `rule:${index + 1}`;
      const idRaw = typeof row.id === "string" && row.id.trim().length > 0 ? row.id.trim().slice(0, 120) : fallbackId;
      const id = seen.has(idRaw) ? `${idRaw}:${index + 1}` : idRaw;
      seen.add(id);
      const weight = typeof row.weight === "number" && Number.isFinite(row.weight) ? Math.max(0, row.weight) : 0;
      if (weight <= 0) return null;
      const threshold =
        typeof row.threshold === "number" && Number.isFinite(row.threshold)
          ? Number(Math.max(0, row.threshold).toFixed(3))
          : null;
      const targetId = typeof row.targetId === "string" && row.targetId.trim().length > 0 ? row.targetId.trim().slice(0, 120) : null;
      const label = typeof row.label === "string" && row.label.trim().length > 0 ? row.label.trim().slice(0, 120) : null;
      return {
        id,
        type: typeRaw as IdeologyAttractionConditionType,
        weight: Number(weight.toFixed(3)),
        threshold,
        targetId,
        label,
        invert: typeof row.invert === "boolean" ? row.invert : null,
      };
    })
    .filter((rule): rule is IdeologyAttractionRule => Boolean(rule))
    .slice(0, 100);
}
