import type { ResourceTotals } from "./core";

export type ModifierScope = "country" | "region" | "building" | "pop" | "market";
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
  | "building_wage"
  | "hex_movement_cost";

export type ModifierTarget = {
  buildingId?: string | null;
  goodId?: string | null;
  professionId?: string | null;
  resourceCategoryId?: string | null;
  hexTag?: string | null;
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

export type GameResourceEffect =
  | {
      type: "add_resource";
      resource: keyof ResourceTotals;
      amount: number;
      labelKey?: string | null;
    }
  | {
      type: "spend_resource";
      resource: keyof ResourceTotals;
      amount: number;
      labelKey?: string | null;
    }
  | {
      type: "add_resource_flow";
      resource: keyof ResourceTotals;
      amount: number;
      direction: "income" | "expense";
      categoryId?: string | null;
      labelKey: string;
    };

export type GameEventEffect =
  | {
      type: "trigger_event";
      eventId: string;
    }
  | {
      type: "schedule_event";
      eventId: string;
      delayTurns?: number;
      chancePct?: number;
    }
  | {
      type: "cancel_event";
      eventId: string;
    }
  | {
      type: "set_event_flag";
      flagId: string;
      value?: string | number | boolean | null;
    }
  | {
      type: "clear_event_flag";
      flagId: string;
    };

export type GameJournalEffect =
  | {
      type: "start_journal_entry";
      journalEntryId: string;
    }
  | {
      type: "advance_journal_entry";
      journalEntryId: string;
      amount: number;
    }
  | {
      type: "complete_journal_entry";
      journalEntryId: string;
    }
  | {
      type: "fail_journal_entry";
      journalEntryId: string;
    }
  | {
      type: "cancel_journal_entry";
      journalEntryId: string;
    }
  | {
      type: "set_journal_variable";
      journalEntryId: string;
      variableId: string;
      value?: string | number | boolean | null;
    }
  | {
      type: "clear_journal_variable";
      journalEntryId: string;
      variableId: string;
    };

export type GameModifierEffect =
  | {
      type: "add_modifier";
      modifierId: string;
      durationTurns?: number | null;
    }
  | {
      type: "remove_modifier";
      modifierId: string;
    }
  | {
      type: "extend_modifier";
      modifierId: string;
      durationTurns: number;
    };

export type GameRegionEffect = {
  type: "change_colonization_progress";
  amount: number;
};

export type GameEffect = GameResourceEffect | GameEventEffect | GameJournalEffect | GameModifierEffect | GameRegionEffect;

export type DecisionDefinition = {
  category: DecisionCategory;
  scope?: EventScopeDefinition | null;
  potential?: EventTriggerDefinition | null;
  allow?: EventTriggerDefinition | null;
  visibleWhenUnavailable?: boolean;
  visibilityConditions?: ModifierCondition[];
  availabilityConditions?: ModifierCondition[];
  costs?: DecisionCost;
  effects?: Array<DecisionEffect | GameEffect>;
  charges?: number;
  rechargeTurns?: number;
  maxUses?: number;
  maxUsesPerCountry?: number;
  maxUsesPerTarget?: number;
  cooldownTurns?: number;
  repeatable?: boolean;
};

export type DecisionAvailabilityReason = {
  code: string;
  labelKey: string;
  passed: boolean;
  currentValue?: number | string | boolean | null;
  requiredValue?: number | string | boolean | null;
  scope?: EventResolvedScope | null;
};

export type CountryDecisionRecord = {
  completedDecisionIds: string[];
  cooldownUntilTurnByDecisionId: Record<string, number>;
  usesByDecisionId: Record<string, number>;
  usesByDecisionTargetKey: Record<string, number>;
  chargesByDecisionId: Record<string, number>;
  lastChargeTurnByDecisionId: Record<string, number>;
  history: Array<{
    decisionId: string;
    takenTurnId: number;
    label: string;
    scopes: Record<string, EventResolvedScope>;
    appliedEffects: EventEffectSummary[];
    explanationIds: string[];
  }>;
};

export type GameEventOption = {
  id: string;
  labelKey: string;
  descriptionKey?: string | null;
  tooltipKey?: string | null;
  effects?: GameEffect[];
  aiWeight?: AiWeightRule[] | null;
  playerDefault?: boolean | null;
  buttonTone?: "default" | "primary" | "danger" | "warning" | null;
};

export type EventScopeKind =
  | "country"
  | "region"
  | "building"
  | "pop"
  | "interest_group"
  | "law"
  | "market"
  | "diplomatic_relation"
  | "war"
  | "journal_entry";

export type EventScopeDefinition = {
  root?: { kind: "country" };
  region?: {
    kind: "region";
    from?: "root.controlled_regions" | "root.owned_regions";
    where?: EventTriggerDefinition | null;
    pick?: {
      orderBy?: "regionId" | "population" | "buildings";
      direction?: "asc" | "desc";
    } | null;
  } | null;
};

export type EventResolvedScope = {
  kind: EventScopeKind;
  id: string;
  labelKey?: string | null;
};

export type EventTriggerExplanation = {
  triggerId: string;
  passed: boolean;
  value?: number | string | boolean | null;
  threshold?: number | string | boolean | null;
  affectedObject?: EventResolvedScope | null;
  labelKey: string;
};

export type EventChainFollowupDefinition = {
  eventId: string;
  delayTurns?: number;
  chancePct?: number;
  conditions?: EventTriggerDefinition | null;
};

export type EventChainDefinition = {
  chainId: string;
  stepId: string;
  startsChain?: boolean;
  endsChain?: boolean;
  followups?: EventChainFollowupDefinition[];
};

export type GameEventDefinition = {
  namespace?: string;
  category: EventCategory;
  priority?: EventPriority;
  visibility?: EventVisibility;
  titleKey?: string;
  descriptionKey?: string;
  imageUrl?: string | null;
  iconId?: string | null;
  scope?: EventScopeDefinition | null;
  trigger?: EventTriggerDefinition | null;
  triggerConditions?: ModifierCondition[];
  options?: GameEventOption[];
  chain?: EventChainDefinition | null;
  cooldownTurns?: number;
  repeatable?: boolean;
  timeoutTurns?: number | null;
  defaultOptionId?: string | null;
  checkIntervalTurns?: number;
  chancePct?: number;
  blocking?: boolean;
};

export type PendingCountryEvent = {
  id: string;
  eventId: string;
  countryId: string;
  createdTurnId: number;
  expiresTurnId?: number | null;
  scopes?: Record<string, EventResolvedScope>;
  triggerExplanation?: EventTriggerExplanation[];
};

export type ScheduledCountryEvent = {
  id: string;
  eventId: string;
  countryId: string;
  scheduledTurnId: number;
  scopes: Record<string, EventResolvedScope>;
  chainId?: string | null;
  createdTurnId?: number | null;
  triggerExplanation?: EventTriggerExplanation[];
};

export type CountryEventRecord = {
  pending: PendingCountryEvent[];
  completedEventIds: string[];
  cooldownUntilTurnByEventId: Record<string, number>;
  history: CountryEventHistoryRecord[];
};

export type EventEffectSummary = {
  type: GameEffect["type"] | "resource_delta";
  resource?: keyof ResourceTotals | null;
  amount?: number | null;
  direction?: "income" | "expense" | null;
  eventId?: string | null;
  journalEntryId?: string | null;
  flagId?: string | null;
  modifierId?: string | null;
  regionId?: string | null;
};

export type CountryAppliedModifier = {
  id: string;
  modifierId: string;
  countryId: string;
  sourceSystem: "event" | "decision" | "journal";
  sourceId: string;
  createdTurnId: number;
  expiresTurnId?: number | null;
};

export type CountryEventHistoryRecord = {
  eventId: string;
  optionId: string;
  resolvedTurnId: number;
  titleKey?: string | null;
  optionLabelKey?: string | null;
  label?: string;
  optionLabel?: string;
  scopes: Record<string, EventResolvedScope>;
  appliedEffects: EventEffectSummary[];
  explanationIds: string[];
};

export type ExplanationSourceSystem =
  | "event"
  | "decision"
  | "journal"
  | "economy"
  | "technology"
  | "construction"
  | "diplomacy"
  | "military";

export type ExplanationCause = {
  labelKey: string;
  sourceId?: string | null;
  value?: number | string | boolean | null;
  amount?: number | null;
};

export type ExplanationRecord = {
  id: string;
  turnId: number;
  sourceSystem: ExplanationSourceSystem;
  sourceId: string;
  affectedObject: EventResolvedScope;
  valueKey: string;
  previousValue?: number | string | boolean | null;
  newValue?: number | string | boolean | null;
  causes: ExplanationCause[];
  modifierIds?: string[];
};

export type JournalVisibility = "public" | "private";
export type JournalPriority = "low" | "medium" | "high" | "critical";
export type JournalCategory =
  | "politics"
  | "economy"
  | "military"
  | "diplomacy"
  | "colonization"
  | "technology"
  | "society"
  | "regional"
  | "crisis";

export type JournalProgressDefinition =
  | {
      type: "manual";
      target: number;
      labelKey: string;
    }
  | {
      type: "trigger";
      target: number;
      labelKey: string;
    };

export type JournalEventHooks = {
  onStart?: string[];
  onComplete?: string[];
  onFail?: string[];
  onCancel?: string[];
};

export type JournalDecisionHooks = {
  availableDecisionIds?: string[];
};

export type JournalModifierHooks = {
  activeModifierIds?: string[];
};

export type JournalEntryDefinition = {
  namespace?: string;
  category: JournalCategory;
  titleKey: string;
  descriptionKey: string;
  shortDescriptionKey?: string | null;
  iconId?: string | null;
  imageUrl?: string | null;
  visibility?: JournalVisibility;
  priority?: JournalPriority;
  scope?: EventScopeDefinition | null;
  startTrigger?: EventTriggerDefinition | null;
  completeTrigger?: EventTriggerDefinition | null;
  failTrigger?: EventTriggerDefinition | null;
  cancelTrigger?: EventTriggerDefinition | null;
  progress?: JournalProgressDefinition | null;
  timeoutTurns?: number | null;
  onStartEffects?: GameEffect[];
  onCompleteEffects?: GameEffect[];
  onFailEffects?: GameEffect[];
  onCancelEffects?: GameEffect[];
  events?: JournalEventHooks | null;
  decisions?: JournalDecisionHooks | null;
  modifiers?: JournalModifierHooks | null;
  repeatable?: boolean;
  cooldownTurns?: number;
};

export type JournalProgressState = {
  current: number;
  target: number;
  percent: number;
  labelKey: string;
  lastDelta?: number | null;
};

export type ActiveJournalEntry = {
  id: string;
  journalEntryId: string;
  countryId: string;
  startedTurnId: number;
  expiresTurnId?: number | null;
  state: "active";
  progress: JournalProgressState;
  scopes: Record<string, EventResolvedScope>;
  variables: Record<string, number | string | boolean>;
  lastUpdatedTurnId: number;
  explanationIds: string[];
};

export type JournalEntryHistoryRecord = {
  journalEntryId: string;
  instanceId: string;
  state: "completed" | "failed" | "cancelled";
  startedTurnId: number;
  resolvedTurnId: number;
  scopes: Record<string, EventResolvedScope>;
  outcomeLabelKey: string;
  explanationIds: string[];
};

export type CountryJournalState = {
  active: ActiveJournalEntry[];
  completedJournalEntryIds: string[];
  failedJournalEntryIds: string[];
  cooldownUntilTurnByJournalEntryId: Record<string, number>;
  history: JournalEntryHistoryRecord[];
};

export type AiWeightRule =
  | { base: number }
  | {
      if: EventTriggerDefinition;
      add?: number | null;
      multiply?: number | null;
    };

export type EventTriggerDefinition =
  | { type: ModifierConditionType; targetId?: string | null; invert?: boolean | null }
  | {
      type: "country_has_law" | "country_lacks_law" | "country_has_technology" | "country_lacks_technology";
      targetId?: string | null;
      invert?: boolean | null;
    }
  | { type: "country_has_modifier"; targetId?: string | null; invert?: boolean | null }
  | { type: "country_resource_above"; resource: keyof ResourceTotals; value: number }
  | { type: "country_resource_below"; resource: keyof ResourceTotals; value: number }
  | { type: "treasury_below"; value: number }
  | { type: "resource_flow_negative"; resource: keyof ResourceTotals }
  | { type: "country_controls_region_count_above"; value: number }
  | { type: "country_controls_region_count_below"; value: number }
  | { type: "controls_foreign_region" }
  | { type: "region_owner_is"; targetId?: string | null }
  | { type: "region_controller_is"; targetId?: string | null }
  | { type: "region_is_colonizable" }
  | { type: "region_population_above"; value: number }
  | { type: "region_population_below"; value: number }
  | { type: "region_has_population_above"; value: number }
  | { type: "region_has_population_below"; value: number }
  | { type: "region_has_building"; targetId?: string | null }
  | { type: "region_has_resource_deposit"; targetId?: string | null }
  | { type: "region_radicals_above"; value: number }
  | { type: "region_loyalists_above"; value: number }
  | { type: "region_standard_of_living_below"; value: number }
  | { type: "region_colonization_progress_above"; value: number }
  | { type: "region_colonization_progress_below"; value: number }
  | { type: "building_profit_below"; value: number }
  | { type: "building_employment_below"; value: number }
  | { type: "building_output_above"; targetId?: string | null; value: number }
  | { all: EventTriggerDefinition[] }
  | { any: EventTriggerDefinition[] }
  | { not: EventTriggerDefinition };

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
  | "region_modifier_active";

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
