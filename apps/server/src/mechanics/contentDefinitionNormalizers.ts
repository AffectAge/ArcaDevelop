import type {
  DecisionCategory,
  DecisionDefinition,
  DecisionEffect,
  EventCategory,
  EventPriority,
  EventVisibility,
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
]);
const MODIFIER_MODES = new Set<ModifierMode>(["add", "add_pct", "mult"]);
const MODIFIER_SCOPES = new Set<ModifierScope>(["country", "province", "building", "pop", "market"]);
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
  "province_modifier_active",
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

export function normalizeDecisionEffects(input: unknown): DecisionEffect[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw): DecisionEffect | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      if (row.type !== "resource_delta") return null;
      const resource =
        typeof row.resource === "string" && RESOURCE_KEYS.includes(row.resource as keyof ResourceTotals)
          ? (row.resource as keyof ResourceTotals)
          : null;
      const amount = Number(row.amount);
      if (!resource || !Number.isFinite(amount) || amount === 0) return null;
      return { type: "resource_delta", resource, amount: Number(amount.toFixed(3)) };
    })
    .filter((effect): effect is DecisionEffect => Boolean(effect))
    .slice(0, 30);
}

export function normalizeDecision(input: unknown): DecisionDefinition | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const categoryRaw = typeof row.category === "string" ? row.category : "politics";
  const category = DECISION_CATEGORIES.has(categoryRaw as DecisionCategory) ? (categoryRaw as DecisionCategory) : "politics";
  const cooldownTurns = Number(row.cooldownTurns);
  return {
    category,
    visibilityConditions: normalizeModifierConditions(row.visibilityConditions),
    availabilityConditions: normalizeModifierConditions(row.availabilityConditions),
    costs: normalizeDecisionCosts(row.costs),
    effects: normalizeDecisionEffects(row.effects),
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
      const label = typeof row.label === "string" && row.label.trim() ? row.label.trim().slice(0, 120) : "Выбрать";
      const description = typeof row.description === "string" && row.description.trim() ? row.description.trim().slice(0, 1000) : null;
      const autoChancePct = Number(row.autoChancePct);
      const buttonColorRaw = typeof row.buttonColor === "string" ? row.buttonColor.trim() : "";
      const buttonColor = /^#[0-9A-Fa-f]{6}$/.test(buttonColorRaw) ? buttonColorRaw : null;
      return {
        id,
        label,
        description,
        effects: normalizeDecisionEffects(row.effects),
        autoChancePct: Number.isFinite(autoChancePct) ? Math.min(100, Math.max(0, Number(autoChancePct.toFixed(3)))) : null,
        buttonColor,
      };
    })
    .filter((option): option is GameEventOption => Boolean(option))
    .slice(0, 8);
}

export function normalizeGameEvent(input: unknown): GameEventDefinition | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const categoryRaw = typeof row.category === "string" ? row.category : "politics";
  const priorityRaw = typeof row.priority === "string" ? row.priority : "medium";
  const visibilityRaw = typeof row.visibility === "string" ? row.visibility : "private";
  const cooldownTurns = Number(row.cooldownTurns);
  const checkIntervalTurns = Number(row.checkIntervalTurns);
  const chancePct = Number(row.chancePct);
  const options = normalizeEventOptions(row.options);
  return {
    category: EVENT_CATEGORIES.has(categoryRaw as EventCategory) ? (categoryRaw as EventCategory) : "politics",
    priority: EVENT_PRIORITIES.has(priorityRaw as EventPriority) ? (priorityRaw as EventPriority) : "medium",
    visibility: EVENT_VISIBILITIES.has(visibilityRaw as EventVisibility) ? (visibilityRaw as EventVisibility) : "private",
    triggerConditions: normalizeModifierConditions(row.triggerConditions),
    options: options.length > 0 ? options : [{ id: "ok", label: "Понятно", description: null, effects: [], autoChancePct: 100, buttonColor: null }],
    cooldownTurns: Number.isFinite(cooldownTurns) ? Math.max(0, Math.floor(cooldownTurns)) : 0,
    repeatable: Boolean(row.repeatable),
    checkIntervalTurns: Number.isFinite(checkIntervalTurns) ? Math.max(1, Math.floor(checkIntervalTurns)) : 1,
    chancePct: Number.isFinite(chancePct) ? Math.min(100, Math.max(0, Number(chancePct.toFixed(3)))) : 100,
    blocking: Boolean(row.blocking),
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
