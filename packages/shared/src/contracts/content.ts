import type { ResourceTotals } from "./core";

export type ModifierScope = "country" | "province" | "building" | "pop" | "market";
export type ModifierMode = "add" | "add_pct" | "mult";
export type ModifierStat =
  | "culture_gain"
  | "science_gain"
  | "religion_gain"
  | "colonization_gain"
  | "construction_gain"
  | "ducats_gain"
  | "gold_gain"
  | "technology_cost"
  | "building_construction_cost"
  | "building_output"
  | "building_input"
  | "building_throughput"
  | "building_wage";

export type ModifierTarget = {
  buildingId?: string | null;
  goodId?: string | null;
  professionId?: string | null;
  resourceCategoryId?: string | null;
};

export type ModifierConditionType = "always" | "law_active" | "technology_researched" | "country_is" | "has_building";

export type ModifierCondition = {
  type: ModifierConditionType;
  targetId?: string | null;
  invert?: boolean | null;
};

export type ModifierEffect = {
  stat: ModifierStat;
  mode: ModifierMode;
  value: number;
  target?: ModifierTarget | null;
};

export type ModifierDefinition = {
  id: string;
  label: string;
  scope: ModifierScope;
  conditions?: ModifierCondition[];
  effects: ModifierEffect[];
};

export type DecisionCategory =
  | "economy"
  | "politics"
  | "military"
  | "diplomacy"
  | "colonization"
  | "culture"
  | "religion"
  | "technology";

export type DecisionCost = Partial<ResourceTotals>;

export type DecisionEffect =
  | {
      type: "resource_delta";
      resource: keyof ResourceTotals;
      amount: number;
    };

export type DecisionDefinition = {
  category: DecisionCategory;
  visibilityConditions?: ModifierCondition[];
  availabilityConditions?: ModifierCondition[];
  costs?: DecisionCost;
  effects?: DecisionEffect[];
  cooldownTurns?: number;
  repeatable?: boolean;
};

export type CountryDecisionRecord = {
  completedDecisionIds: string[];
  cooldownUntilTurnByDecisionId: Record<string, number>;
  history: Array<{
    decisionId: string;
    takenTurnId: number;
    label: string;
  }>;
};

export type GameEventOption = {
  id: string;
  label: string;
  description?: string | null;
  effects?: DecisionEffect[];
  autoChancePct?: number | null;
  buttonColor?: string | null;
};

export type GameEventDefinition = {
  category: EventCategory;
  priority?: EventPriority;
  visibility?: EventVisibility;
  triggerConditions?: ModifierCondition[];
  options?: GameEventOption[];
  cooldownTurns?: number;
  repeatable?: boolean;
  checkIntervalTurns?: number;
  chancePct?: number;
  blocking?: boolean;
};

export type PendingCountryEvent = {
  id: string;
  eventId: string;
  countryId: string;
  createdTurnId: number;
};

export type CountryEventRecord = {
  pending: PendingCountryEvent[];
  completedEventIds: string[];
  cooldownUntilTurnByEventId: Record<string, number>;
  history: Array<{
    eventId: string;
    optionId: string;
    resolvedTurnId: number;
    label: string;
    optionLabel: string;
  }>;
};

export type IdeologyAttractionConditionType =
  | "sol_below"
  | "sol_above"
  | "radicals_above"
  | "loyalists_above"
  | "profession_is"
  | "religion_is"
  | "culture_is"
  | "law_active"
  | "has_building"
  | "country_modifier_active"
  | "province_modifier_active";

export type IdeologyAttractionRule = {
  id: string;
  type: IdeologyAttractionConditionType;
  weight: number;
  threshold?: number | null;
  targetId?: string | null;
  label?: string | null;
  invert?: boolean | null;
};

export type ActiveModifierRow = {
  id: string;
  label: string;
  sourceId: string;
  sourceName: string;
  sourceKind: "technology" | "law" | "building" | "modifier" | "event";
  scope: ModifierScope;
  effects: ModifierEffect[];
};

export type EventCategory = "system" | "colonization" | "politics" | "economy" | "military" | "diplomacy";
export type EventPriority = "low" | "medium" | "high";
export type EventVisibility = "public" | "private";
export type EventCountryScope = "all" | "own" | "foreign";

export type EventLogEntry = {
  id: string;
  turn: number;
  timestamp: string;
  category: EventCategory;
  priority: EventPriority;
  visibility: EventVisibility;
  title?: string | null;
  message: string;
  countryId?: string | null;
};
