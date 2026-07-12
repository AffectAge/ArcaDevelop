import { z } from "zod";
import { normalizeGoodFlows, normalizeWorkforceRequirements } from "../mechanics/contentFieldNormalizers";
import {
  normalizeDecision,
  normalizeGameEvent,
  normalizeIdeologyAttractionRules,
  normalizeJournalEntry,
  normalizeModifiers,
} from "../mechanics/contentDefinitionNormalizers";
import {
  DEFAULT_RESOURCE_BASE_PRICE,
  GOOD_DISTRIBUTION_TYPES,
  GOOD_TRANSPORT_MODES,
  type GoodTransportMode,
} from "../mechanics/marketTurnMechanics";
import { DEFAULT_BUILDING_DURABILITY_MAX, normalizeBuildingCountryLimits, normalizePollutionProductivityMode } from "../mechanics/buildingMechanics";
import { normalizeCultureNeedsProfile } from "../mechanics/populationMechanics";
import { normalizeLawParliamentPowerEffect } from "../mechanics/parliamentMechanics";
import {
  normalizeCountryIdList,
  normalizeNumberRecord,
  normalizeOptionalFiniteNumber,
  normalizeStringList,
} from "./contentNormalizers";
import type {
  BuildingContentEntry,
  GameContentEntry,
  GoodContentEntry,
} from "../runtime/gameSettingsTypes";

const SETTINGS_MAX_NUMBER = 1_000_000_000_000;

const levelBoundSchema = z.number().int().min(1).nullable().optional();

const goodFlowPayloadSchema = z
  .object({
    goodId: z.string().trim().min(1).max(120),
    amount: z.number().finite().min(0),
    affectedByFertility: z.boolean().optional(),
    minLevel: levelBoundSchema,
    maxLevel: levelBoundSchema,
  })
  .refine((flow) => flow.minLevel == null || flow.maxLevel == null || flow.maxLevel >= flow.minLevel, {
    message: "maxLevel must be greater than or equal to minLevel",
    path: ["maxLevel"],
  });

const extractionFlowPayloadSchema = z
  .object({
    goodId: z.string().trim().min(1).max(120),
    amount: z.number().finite().min(0),
    requiresDeposit: z.boolean().optional(),
    minLevel: levelBoundSchema,
    maxLevel: levelBoundSchema,
  })
  .refine((flow) => flow.minLevel == null || flow.maxLevel == null || flow.maxLevel >= flow.minLevel, {
    message: "maxLevel must be greater than or equal to minLevel",
    path: ["maxLevel"],
  });

const buildingPlacementPayloadSchema = z.object({
  allowedTerrains: z.array(z.string().trim().min(1).max(80)).optional(),
  deniedTerrains: z.array(z.string().trim().min(1).max(80)).optional(),
  allowedFeatures: z.array(z.string().trim().min(1).max(80)).optional(),
  deniedFeatures: z.array(z.string().trim().min(1).max(80)).optional(),
  allowedWaterKinds: z.array(z.string().trim().min(1).max(80)).optional(),
  deniedWaterKinds: z.array(z.string().trim().min(1).max(80)).optional(),
  allowedTags: z.array(z.string().trim().min(1).max(80)).optional(),
  deniedTags: z.array(z.string().trim().min(1).max(80)).optional(),
}).optional();

const buildingAdjacencyEffectPayloadSchema = z.object({
  id: z.string().trim().min(1).max(120),
  when: z.object({
    neighborTerrains: z.array(z.string().trim().min(1).max(80)).optional(),
    neighborFeatures: z.array(z.string().trim().min(1).max(80)).optional(),
    neighborTags: z.array(z.string().trim().min(1).max(80)).optional(),
    neighborBuildingIds: z.array(z.string().trim().min(1).max(120)).optional(),
    adjacentToRiver: z.boolean().optional(),
  }),
  perNeighbor: z.boolean().optional(),
  maxStacks: z.number().int().min(1).nullable().optional(),
  modifier: z.object({
    target: z.literal("building.throughput"),
    operation: z.enum(["add", "multiply"]),
    value: z.number().finite(),
  }),
});

function normalizeExtractionFlows(input: unknown): Array<{ goodId: string; amount: number; requiresDeposit?: boolean; minLevel?: number; maxLevel?: number }> {
  if (!Array.isArray(input)) return [];
  const items: Array<{ goodId: string; amount: number; requiresDeposit?: boolean; minLevel?: number; maxLevel?: number }> = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<{ goodId: unknown; amount: unknown; requiresDeposit: unknown; minLevel: unknown; maxLevel: unknown }>;
    const goodId = typeof row.goodId === "string" ? row.goodId.trim() : "";
    const amount = typeof row.amount === "number" && Number.isFinite(row.amount) ? Math.max(0, row.amount) : 0;
    if (!goodId || amount <= 0) continue;
    const minLevel = typeof row.minLevel === "number" && Number.isInteger(row.minLevel) && row.minLevel >= 1 ? row.minLevel : null;
    const maxLevel = typeof row.maxLevel === "number" && Number.isInteger(row.maxLevel) && row.maxLevel >= 1 ? row.maxLevel : null;
    items.push({
      goodId,
      amount: Number(amount.toFixed(3)),
      ...(row.requiresDeposit === false ? { requiresDeposit: false } : row.requiresDeposit === true ? { requiresDeposit: true } : {}),
      ...(minLevel !== null ? { minLevel } : {}),
      ...(maxLevel !== null ? { maxLevel } : {}),
    });
  }
  return items.slice(0, 64);
}

const modifierEffectPayloadSchema = z.object({
  stat: z.enum([
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
  ]),
  mode: z.enum(["add", "add_pct", "mult"]),
  value: z.number().finite().min(-1_000_000).max(1_000_000),
  target: z
    .object({
      buildingId: z.string().trim().min(1).max(120).nullable().optional(),
      goodId: z.string().trim().min(1).max(120).nullable().optional(),
      professionId: z.string().trim().min(1).max(120).nullable().optional(),
      resourceCategoryId: z.string().trim().min(1).max(120).nullable().optional(),
      hexTag: z.string().trim().min(1).max(80).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const modifierPayloadSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  label: z.string().trim().min(1).max(120),
  scope: z.enum(["country", "region", "building", "pop", "market"]),
  conditions: z
    .array(
      z.object({
        type: z.enum(["always", "law_active", "technology_researched", "country_is", "has_building"]),
        targetId: z.string().trim().min(1).max(120).nullable().optional(),
        invert: z.boolean().nullable().optional(),
      }),
    )
    .max(20)
    .optional(),
  effects: z.array(modifierEffectPayloadSchema).min(1).max(20),
});

const decisionPayloadSchema = z.object({
  category: z.enum(["economy", "politics", "military", "diplomacy", "colonization", "culture", "religion", "technology"]),
  scope: z.lazy(() => eventScopePayloadSchema).nullable().optional(),
  potential: z.lazy(() => eventTriggerPayloadSchema).nullable().optional(),
  allow: z.lazy(() => eventTriggerPayloadSchema).nullable().optional(),
  visibleWhenUnavailable: z.boolean().optional(),
  visibilityConditions: z
    .array(
      z.object({
        type: z.enum(["always", "law_active", "technology_researched", "country_is", "has_building"]),
        targetId: z.string().trim().min(1).max(120).nullable().optional(),
        invert: z.boolean().nullable().optional(),
      }),
    )
    .max(20)
    .optional(),
  availabilityConditions: z
    .array(
      z.object({
        type: z.enum(["always", "law_active", "technology_researched", "country_is", "has_building"]),
        targetId: z.string().trim().min(1).max(120).nullable().optional(),
        invert: z.boolean().nullable().optional(),
      }),
    )
    .max(20)
    .optional(),
  costs: z
    .record(
      z.enum(["culture", "science", "religion", "colonization", "construction", "ducats", "gold"]),
      z.number().finite().min(0).max(SETTINGS_MAX_NUMBER),
    )
    .optional(),
  effects: z
    .array(
      z.union([
        z.object({
          type: z.literal("resource_delta"),
          resource: z.enum(["culture", "science", "religion", "colonization", "construction", "ducats", "gold"]),
          amount: z.number().finite().min(-SETTINGS_MAX_NUMBER).max(SETTINGS_MAX_NUMBER),
        }),
        z.lazy(() => gameEffectPayloadSchema),
      ]),
    )
    .max(30)
    .optional(),
  charges: z.number().int().positive().max(SETTINGS_MAX_NUMBER).optional(),
  rechargeTurns: z.number().int().positive().max(SETTINGS_MAX_NUMBER).optional(),
  maxUses: z.number().int().positive().max(SETTINGS_MAX_NUMBER).optional(),
  maxUsesPerCountry: z.number().int().positive().max(SETTINGS_MAX_NUMBER).optional(),
  maxUsesPerTarget: z.number().int().positive().max(SETTINGS_MAX_NUMBER).optional(),
  cooldownTurns: z.number().int().min(0).max(SETTINGS_MAX_NUMBER).optional(),
  repeatable: z.boolean().optional(),
});

const gameEffectPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_resource"),
    resource: z.enum(["culture", "science", "religion", "colonization", "construction", "ducats", "gold"]),
    amount: z.number().finite().positive().max(SETTINGS_MAX_NUMBER),
    labelKey: z.string().trim().min(1).max(160).nullable().optional(),
  }),
  z.object({
    type: z.literal("spend_resource"),
    resource: z.enum(["culture", "science", "religion", "colonization", "construction", "ducats", "gold"]),
    amount: z.number().finite().positive().max(SETTINGS_MAX_NUMBER),
    labelKey: z.string().trim().min(1).max(160).nullable().optional(),
  }),
  z.object({
    type: z.literal("add_resource_flow"),
    resource: z.enum(["culture", "science", "religion", "colonization", "construction", "ducats", "gold"]),
    amount: z.number().finite().positive().max(SETTINGS_MAX_NUMBER),
    direction: z.enum(["income", "expense"]),
    categoryId: z.string().trim().min(1).max(120).nullable().optional(),
    labelKey: z.string().trim().min(1).max(160),
  }),
  z.object({
    type: z.literal("trigger_event"),
    eventId: z.string().trim().min(1).max(120),
  }),
  z.object({
    type: z.literal("schedule_event"),
    eventId: z.string().trim().min(1).max(120),
    delayTurns: z.number().int().min(0).max(SETTINGS_MAX_NUMBER).optional(),
    chancePct: z.number().finite().min(0).max(100).optional(),
  }),
  z.object({
    type: z.literal("cancel_event"),
    eventId: z.string().trim().min(1).max(120),
  }),
  z.object({
    type: z.literal("set_event_flag"),
    flagId: z.string().trim().min(1).max(160),
    value: z.union([z.string().trim().max(160), z.number().finite(), z.boolean()]).nullable().optional(),
  }),
  z.object({
    type: z.literal("clear_event_flag"),
    flagId: z.string().trim().min(1).max(160),
  }),
  z.object({
    type: z.enum(["start_journal_entry", "complete_journal_entry", "fail_journal_entry", "cancel_journal_entry"]),
    journalEntryId: z.string().trim().min(1).max(120),
  }),
  z.object({
    type: z.literal("advance_journal_entry"),
    journalEntryId: z.string().trim().min(1).max(120),
    amount: z.number().finite().positive().max(SETTINGS_MAX_NUMBER),
  }),
  z.object({
    type: z.literal("set_journal_variable"),
    journalEntryId: z.string().trim().min(1).max(120),
    variableId: z.string().trim().min(1).max(160),
    value: z.union([z.string().trim().max(160), z.number().finite(), z.boolean()]).nullable().optional(),
  }),
  z.object({
    type: z.literal("clear_journal_variable"),
    journalEntryId: z.string().trim().min(1).max(120),
    variableId: z.string().trim().min(1).max(160),
  }),
]);

const eventOptionPayloadSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  labelKey: z.string().trim().min(1).max(160),
  descriptionKey: z.string().trim().min(1).max(160).nullable().optional(),
  tooltipKey: z.string().trim().min(1).max(160).nullable().optional(),
  effects: z.array(gameEffectPayloadSchema).max(30).optional(),
  aiWeight: z
    .array(
      z.union([
        z.object({ base: z.number().finite().min(-SETTINGS_MAX_NUMBER).max(SETTINGS_MAX_NUMBER) }),
        z.object({
          if: z.lazy(() => eventTriggerPayloadSchema),
          add: z.number().finite().min(-SETTINGS_MAX_NUMBER).max(SETTINGS_MAX_NUMBER).nullable().optional(),
          multiply: z.number().finite().min(-SETTINGS_MAX_NUMBER).max(SETTINGS_MAX_NUMBER).nullable().optional(),
        }),
      ]),
    )
    .max(20)
    .nullable()
    .optional(),
  playerDefault: z.boolean().nullable().optional(),
  buttonTone: z.enum(["default", "primary", "danger", "warning"]).nullable().optional(),
});

const eventTriggerPayloadSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      type: z.enum([
        "always",
        "law_active",
        "technology_researched",
        "country_is",
        "has_building",
        "country_has_law",
        "country_lacks_law",
        "country_has_technology",
        "country_lacks_technology",
      ]),
      targetId: z.string().trim().min(1).max(120).nullable().optional(),
      invert: z.boolean().nullable().optional(),
    }),
    z.object({
      type: z.enum(["country_resource_above", "country_resource_below"]),
      resource: z.enum(["culture", "science", "religion", "colonization", "construction", "ducats", "gold"]),
      value: z.number().finite().min(0).max(SETTINGS_MAX_NUMBER),
    }),
    z.object({
      type: z.enum(["treasury_below", "country_controls_region_count_above", "country_controls_region_count_below"]),
      value: z.number().finite().min(0).max(SETTINGS_MAX_NUMBER),
    }),
    z.object({
      type: z.enum(["region_population_above", "region_population_below", "region_has_population_above", "region_has_population_below"]),
      value: z.number().finite().min(0).max(SETTINGS_MAX_NUMBER),
    }),
    z.object({
      type: z.enum(["region_owner_is", "region_controller_is", "region_has_building"]),
      targetId: z.string().trim().min(1).max(120).nullable().optional(),
    }),
    z.object({ all: z.array(eventTriggerPayloadSchema).min(1).max(20) }),
    z.object({ any: z.array(eventTriggerPayloadSchema).min(1).max(20) }),
    z.object({ not: eventTriggerPayloadSchema }),
  ]),
);

const eventScopePayloadSchema = z.object({
  root: z.object({ kind: z.literal("country") }).optional(),
  region: z
    .object({
      kind: z.literal("region"),
      from: z.enum(["root.controlled_regions", "root.owned_regions"]).optional(),
      where: eventTriggerPayloadSchema.nullable().optional(),
      pick: z
        .object({
          orderBy: z.enum(["regionId", "population", "buildings"]).optional(),
          direction: z.enum(["asc", "desc"]).optional(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
});

const eventChainPayloadSchema = z.object({
  chainId: z.string().trim().min(1).max(120),
  stepId: z.string().trim().min(1).max(120),
  startsChain: z.boolean().optional(),
  endsChain: z.boolean().optional(),
  followups: z
    .array(
      z.object({
        eventId: z.string().trim().min(1).max(120),
        delayTurns: z.number().int().min(0).max(SETTINGS_MAX_NUMBER).optional(),
        chancePct: z.number().finite().min(0).max(100).optional(),
        conditions: eventTriggerPayloadSchema.nullable().optional(),
      }),
    )
    .max(12)
    .optional(),
});

const gameEventPayloadSchema = z.object({
  namespace: z.string().trim().min(1).max(80).optional(),
  category: z.enum(["system", "colonization", "politics", "economy", "military", "diplomacy"]),
  priority: z.enum(["low", "medium", "high"]).optional(),
  visibility: z.enum(["public", "private"]).optional(),
  titleKey: z.string().trim().min(1).max(160).optional(),
  descriptionKey: z.string().trim().min(1).max(160).optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  iconId: z.string().trim().min(1).max(120).nullable().optional(),
  scope: eventScopePayloadSchema.nullable().optional(),
  trigger: eventTriggerPayloadSchema.nullable().optional(),
  triggerConditions: z
    .array(
      z.object({
        type: z.enum(["always", "law_active", "technology_researched", "country_is", "has_building"]),
        targetId: z.string().trim().min(1).max(120).nullable().optional(),
        invert: z.boolean().nullable().optional(),
      }),
    )
    .max(20)
    .optional(),
  options: z.array(eventOptionPayloadSchema).min(1).max(8).optional(),
  chain: eventChainPayloadSchema.nullable().optional(),
  cooldownTurns: z.number().int().min(0).max(SETTINGS_MAX_NUMBER).optional(),
  repeatable: z.boolean().optional(),
  timeoutTurns: z.number().int().min(0).max(SETTINGS_MAX_NUMBER).nullable().optional(),
  defaultOptionId: z.string().trim().min(1).max(120).nullable().optional(),
  checkIntervalTurns: z.number().int().min(1).max(SETTINGS_MAX_NUMBER).optional(),
  chancePct: z.number().finite().min(0).max(100).optional(),
  blocking: z.boolean().optional(),
});

const journalProgressPayloadSchema = z.object({
  type: z.enum(["manual", "trigger"]),
  target: z.number().finite().positive().max(SETTINGS_MAX_NUMBER),
  labelKey: z.string().trim().min(1).max(160),
});

const journalEventHooksPayloadSchema = z.object({
  onStart: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  onComplete: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  onFail: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  onCancel: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
});

const journalEntryPayloadSchema = z.object({
  namespace: z.string().trim().min(1).max(80).optional(),
  category: z.enum(["politics", "economy", "military", "diplomacy", "colonization", "technology", "society", "regional", "crisis"]),
  titleKey: z.string().trim().min(1).max(160),
  descriptionKey: z.string().trim().min(1).max(160),
  shortDescriptionKey: z.string().trim().min(1).max(160).nullable().optional(),
  iconId: z.string().trim().min(1).max(120).nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  scope: eventScopePayloadSchema.nullable().optional(),
  startTrigger: eventTriggerPayloadSchema.nullable().optional(),
  completeTrigger: eventTriggerPayloadSchema.nullable().optional(),
  failTrigger: eventTriggerPayloadSchema.nullable().optional(),
  cancelTrigger: eventTriggerPayloadSchema.nullable().optional(),
  progress: journalProgressPayloadSchema.nullable().optional(),
  timeoutTurns: z.number().int().min(0).max(SETTINGS_MAX_NUMBER).nullable().optional(),
  onStartEffects: z.array(gameEffectPayloadSchema).max(30).optional(),
  onCompleteEffects: z.array(gameEffectPayloadSchema).max(30).optional(),
  onFailEffects: z.array(gameEffectPayloadSchema).max(30).optional(),
  onCancelEffects: z.array(gameEffectPayloadSchema).max(30).optional(),
  events: journalEventHooksPayloadSchema.nullable().optional(),
  decisions: z.object({ availableDecisionIds: z.array(z.string().trim().min(1).max(120)).max(50).optional() }).nullable().optional(),
  modifiers: z.object({ activeModifierIds: z.array(z.string().trim().min(1).max(120)).max(50).optional() }).nullable().optional(),
  repeatable: z.boolean().optional(),
  cooldownTurns: z.number().int().min(0).max(SETTINGS_MAX_NUMBER).optional(),
});

const ideologyAttractionRulePayloadSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: z.enum([
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
  ]),
  weight: z.number().finite().min(0).max(SETTINGS_MAX_NUMBER),
  threshold: z.number().finite().min(0).nullable().optional(),
  targetId: z.string().trim().min(1).max(120).nullable().optional(),
  label: z.string().trim().max(120).nullable().optional(),
  invert: z.boolean().nullable().optional(),
});

const parliamentPowerPayloadSchema = z.discriminatedUnion("domain", [
  z.object({ domain: z.literal("laws"), value: z.enum(["none", "advisory", "approve", "initiate"]) }),
  z.object({ domain: z.literal("budget"), value: z.enum(["none", "approve_taxes", "approve_budget", "control_budget"]) }),
  z.object({
    domain: z.literal("diplomacy"),
    value: z.enum(["none", "ratify_territory", "ratify_major_treaties", "ratify_all"]),
    moneyTransferRatificationThreshold: z.number().finite().positive().nullable().optional(),
  }),
  z.object({ domain: z.literal("war"), value: z.enum(["none", "approve", "declare"]) }),
  z.object({ domain: z.literal("government"), value: z.enum(["none", "confidence_vote", "appoint_government"]) }),
]);

export const culturePayloadSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(5000).optional().default(""),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  resourceCategoryId: z.string().trim().min(1).max(120).nullable().optional(),
  isResourceDiscoverable: z.boolean().optional(),
  basePrice: z.number().finite().min(0).optional(),
  minPrice: z.number().finite().min(0).optional(),
  maxPrice: z.number().finite().min(0).optional(),
  infraPerUnit: z.number().finite().min(0).optional(),
  infrastructureCostPerUnit: z.number().finite().min(0).optional(),
  distributionType: z.enum(["tradeable", "localOnly", "pipeline", "powerGrid", "service"]).optional(),
  transportModes: z.array(z.enum(["land", "sea", "air", "pipeline", "powerGrid"])).max(16).optional(),
  explorationBaseWeight: z.number().finite().min(0).optional(),
  explorationSmallVeinChancePct: z.number().finite().min(0).optional(),
  explorationMediumVeinChancePct: z.number().finite().min(0).optional(),
  explorationLargeVeinChancePct: z.number().finite().min(0).optional(),
  explorationSmallVeinMin: z.number().finite().min(0).optional(),
  explorationSmallVeinMax: z.number().finite().min(0).optional(),
  explorationMediumVeinMin: z.number().finite().min(0).optional(),
  explorationMediumVeinMax: z.number().finite().min(0).optional(),
  explorationLargeVeinMin: z.number().finite().min(0).optional(),
  explorationLargeVeinMax: z.number().finite().min(0).optional(),
  baseWage: z.number().finite().min(0).optional(),
  qualificationRequirements: z.record(z.string().trim().min(1).max(120), z.number().finite().min(0)).optional(),
  qualificationGrowthRules: z.record(z.string().trim().min(1).max(120), z.number().finite()).optional(),
  acceptedCultureIds: z.array(z.string().trim().min(1).max(120)).optional(),
  acceptedReligionIds: z.array(z.string().trim().min(1).max(120)).optional(),
  acceptedRaceIds: z.array(z.string().trim().min(1).max(120)).optional(),
  acceptanceMode: z.enum(["add", "replace"]).optional(),
  discrimination: z
    .object({
      wagePenaltyPct: z.number().finite().min(0).max(1).optional(),
      hiringPenaltyPct: z.number().finite().min(0).max(1).optional(),
      qualificationGrowthPenaltyPct: z.number().finite().min(0).max(1).optional(),
      politicalStrengthPenaltyPct: z.number().finite().min(0).max(1).optional(),
      radicalizationPerTurn: z.number().finite().min(0).optional(),
    })
    .nullable()
    .optional(),
  needsProfile: z
    .object({
      tiers: z.array(
        z.object({
          id: z.string().trim().min(1).max(80),
          minStandardOfLiving: z.number().finite().min(0),
          needs: z.array(
            z.object({
              id: z.string().trim().min(1).max(80),
              label: z.string().trim().min(1).max(80),
              category: z.enum(["survival", "basic", "comfort", "luxury"]),
              amountPerPerson: z.number().finite().min(0),
              weight: z.number().finite().min(0.001),
              goods: z.array(
                z.object({
                  goodId: z.string().trim().min(1).max(120),
                  weight: z.number().finite().min(0.001),
                  taboo: z.boolean().optional(),
                  obsessionMultiplier: z.number().finite().min(1).optional(),
                }),
              ),
            }),
          ),
        }),
      ),
    })
    .nullable()
    .optional(),
  costConstruction: z.number().int().min(1).optional(),
  costDucats: z.number().finite().min(0).optional(),
  startingDucats: z.number().finite().min(0).optional(),
  maxLevel: z.number().int().min(1).optional(),
  maxDurability: z.number().finite().min(1).optional(),
  upgradeCostDucats: z.number().finite().min(0).optional(),
  upgradeCostConstruction: z.number().int().min(1).optional(),
  sectorId: z.string().trim().min(1).max(120).nullable().optional(),
  industryId: z.string().trim().min(1).max(120).nullable().optional(),
  extractionGoodId: z.string().trim().min(1).max(120).nullable().optional(),
  extractionAmountPerTurn: z.number().finite().min(0).optional(),
  extractionRequiresDeposit: z.boolean().optional(),
  extractions: z.array(extractionFlowPayloadSchema).optional(),
  inputs: z.array(goodFlowPayloadSchema).optional(),
  outputs: z.array(goodFlowPayloadSchema).optional(),
  workforceRequirements: z.array(z.object({ professionId: z.string().trim().min(1).max(120), workers: z.number().int().min(0) })).optional(),
  allowedCountryIds: z.array(z.string().trim().min(1).max(120)).optional(),
  deniedCountryIds: z.array(z.string().trim().min(1).max(120)).optional(),
  allowedHexTypes: z.array(z.string().trim().min(1).max(120)).optional(),
  deniedHexTypes: z.array(z.string().trim().min(1).max(120)).optional(),
  allowedClimates: z.array(z.string().trim().min(1).max(120)).optional(),
  deniedClimates: z.array(z.string().trim().min(1).max(120)).optional(),
  allowedLandscapes: z.array(z.string().trim().min(1).max(120)).optional(),
  deniedLandscapes: z.array(z.string().trim().min(1).max(120)).optional(),
  allowedContinents: z.array(z.string().trim().min(1).max(120)).optional(),
  deniedContinents: z.array(z.string().trim().min(1).max(120)).optional(),
  allowedStrategicRegions: z.array(z.string().trim().min(1).max(120)).optional(),
  deniedStrategicRegions: z.array(z.string().trim().min(1).max(120)).optional(),
  minRadiation: z.number().finite().min(0).nullable().optional(),
  maxRadiation: z.number().finite().min(0).nullable().optional(),
  pollutionProductivityMode: z.enum(["penalty", "bonus", "ignore"]).optional(),
  countryBuildLimits: z.array(z.object({ countryId: z.string().trim().min(1).max(120), limit: z.number().int().min(1).nullable() })).optional(),
  globalBuildLimit: z.number().int().min(0).nullable().optional(),
  placement: buildingPlacementPayloadSchema,
  adjacencyEffects: z.array(buildingAdjacencyEffectPayloadSchema).max(64).optional(),
  deployment: z.object({
    branches: z.array(z.enum(["land", "naval", "air"])).min(1).max(3),
    capacity: z.number().int().min(1).nullable().optional(),
    requiresActive: z.boolean().optional(),
  }).nullable().optional(),
  ideologyWeights: z.record(z.string().trim().min(1).max(120), z.number().finite().min(0).max(100)).optional(),
  interestGroupWeights: z.record(z.string().trim().min(1).max(120), z.number().finite().min(0).max(100)).optional(),
  professionWeights: z.record(z.string().trim().min(1).max(120), z.number().finite().min(0).max(100)).optional(),
  religionWeights: z.record(z.string().trim().min(1).max(120), z.number().finite().min(0).max(100)).optional(),
  buildingWeights: z.record(z.string().trim().min(1).max(120), z.number().finite().min(0).max(100)).optional(),
  lawPreferences: z.record(z.string().trim().min(1).max(120), z.number().finite().min(-100).max(100)).optional(),
  discipline: z.number().finite().min(0).max(1).optional(),
  basePoliticalStrength: z.number().finite().min(0).optional(),
  solMultiplier: z.number().finite().min(-10).optional(),
  radicalMultiplier: z.number().finite().min(-10).optional(),
  loyalistMultiplier: z.number().finite().min(-10).optional(),
  defaultPartyId: z.string().trim().min(1).max(120).nullable().optional(),
  lawGroupId: z.string().trim().min(1).max(120).nullable().optional(),
  defaultLawId: z.string().trim().min(1).max(120).nullable().optional(),
  order: z.number().int().optional(),
  enactmentDifficulty: z.number().finite().min(0.1).optional(),
  votingDurationTurns: z.number().int().min(1).optional(),
  parliamentPower: parliamentPowerPayloadSchema.nullable().optional(),
  costScience: z.number().finite().min(0).optional(),
  prerequisiteTechnologyIds: z.array(z.string().trim().min(1).max(120)).optional(),
  unlockBuildingIds: z.array(z.string().trim().min(1).max(120)).optional(),
  unlockLawIds: z.array(z.string().trim().min(1).max(120)).optional(),
  modifiers: z.array(modifierPayloadSchema).max(50).optional(),
  decision: decisionPayloadSchema.nullable().optional(),
  event: gameEventPayloadSchema.nullable().optional(),
  journalEntry: journalEntryPayloadSchema.nullable().optional(),
  ideologyAttractionRules: z.array(ideologyAttractionRulePayloadSchema).max(100).optional(),
});

export const contentEntryKindSchema = z.enum([
  "cultures",
  "cultureGroups",
  "resourceCategories",
  "hexTypes",
  "hexClimates",
  "hexLandscapes",
  "hexContinents",
  "hexStrategicRegions",
  "religions",
  "religionGroups",
  "professions",
  "ideologies",
  "interestGroups",
  "parties",
  "lawGroups",
  "laws",
  "technologies",
  "races",
  "buildings",
  "goods",
  "companies",
  "industries",
  "sectors",
  "modifiers",
  "decisions",
  "events",
  "journalEntries",
]);

export type ContentEntryKind = z.infer<typeof contentEntryKindSchema>;
export type CulturePayload = z.infer<typeof culturePayloadSchema>;

export function sanitizeContentEntryByKind(
  kind: ContentEntryKind,
  payload: CulturePayload,
): Partial<GameContentEntry & GoodContentEntry & BuildingContentEntry> {
  if (kind === "goods") {
    const basePrice = Number((payload.basePrice ?? DEFAULT_RESOURCE_BASE_PRICE).toFixed(3));
    const minPrice = Number(Math.max(0, payload.minPrice ?? basePrice * 0.1).toFixed(3));
    const maxPrice = Number(Math.max(minPrice, payload.maxPrice ?? basePrice * 10).toFixed(3));
    const infraRaw = payload.infrastructureCostPerUnit ?? payload.infraPerUnit ?? 1;
    const infraPerUnit = Number(Math.max(0.01, Math.max(0, infraRaw)).toFixed(3));
    const resourceCategoryId =
      payload.resourceCategoryId === undefined
        ? undefined
        : typeof payload.resourceCategoryId === "string" && payload.resourceCategoryId.trim().length > 0
          ? payload.resourceCategoryId.trim()
          : null;
    const isResourceDiscoverable = payload.isResourceDiscoverable ?? false;
    const distributionType =
      payload.distributionType && GOOD_DISTRIBUTION_TYPES.includes(payload.distributionType)
        ? payload.distributionType
        : "tradeable";
    const transportModes =
      distributionType === "service" || distributionType === "localOnly"
        ? []
        : distributionType === "pipeline"
          ? ["pipeline" as GoodTransportMode]
          : distributionType === "powerGrid"
            ? ["powerGrid" as GoodTransportMode]
            : [
                ...new Set(
                  (payload.transportModes ?? ["land", "sea", "air"]).filter((mode): mode is GoodTransportMode =>
                    GOOD_TRANSPORT_MODES.includes(mode as GoodTransportMode),
                  ),
                ),
              ];
    const explorationBaseWeight = Number(Math.max(0, payload.explorationBaseWeight ?? 1).toFixed(3));
    const smallChanceRaw = Math.max(0, Number(payload.explorationSmallVeinChancePct ?? 60));
    const mediumChanceRaw = Math.max(0, Number(payload.explorationMediumVeinChancePct ?? 30));
    const largeChanceRaw = Math.max(0, Number(payload.explorationLargeVeinChancePct ?? 10));
    const chanceSum = smallChanceRaw + mediumChanceRaw + largeChanceRaw;
    const chanceDiv = chanceSum > 0 ? chanceSum / 100 : 1;
    const explorationSmallVeinChancePct = Number((chanceSum > 0 ? smallChanceRaw / chanceDiv : 60).toFixed(3));
    const explorationMediumVeinChancePct = Number((chanceSum > 0 ? mediumChanceRaw / chanceDiv : 30).toFixed(3));
    const explorationLargeVeinChancePct = Number((chanceSum > 0 ? largeChanceRaw / chanceDiv : 10).toFixed(3));
    const explorationSmallVeinMin = Number(Math.max(0, payload.explorationSmallVeinMin ?? 10).toFixed(3));
    const explorationSmallVeinMax = Number(Math.max(explorationSmallVeinMin, payload.explorationSmallVeinMax ?? 100).toFixed(3));
    const explorationMediumVeinMin = Number(Math.max(0, payload.explorationMediumVeinMin ?? 100).toFixed(3));
    const explorationMediumVeinMax = Number(Math.max(explorationMediumVeinMin, payload.explorationMediumVeinMax ?? 500).toFixed(3));
    const explorationLargeVeinMin = Number(Math.max(0, payload.explorationLargeVeinMin ?? 500).toFixed(3));
    const explorationLargeVeinMax = Number(Math.max(explorationLargeVeinMin, payload.explorationLargeVeinMax ?? 2000).toFixed(3));
    return {
      resourceCategoryId,
      isResourceDiscoverable,
      basePrice,
      minPrice,
      maxPrice,
      infraPerUnit,
      infrastructureCostPerUnit: infraPerUnit,
      distributionType,
      transportModes: transportModes.length > 0 ? transportModes : distributionType === "tradeable" ? ["land", "sea", "air"] : [],
      explorationBaseWeight,
      explorationSmallVeinChancePct,
      explorationMediumVeinChancePct,
      explorationLargeVeinChancePct,
      explorationSmallVeinMin,
      explorationSmallVeinMax,
      explorationMediumVeinMin,
      explorationMediumVeinMax,
      explorationLargeVeinMin,
      explorationLargeVeinMax,
    };
  }
  if (kind === "professions") {
    return {
      baseWage: Number(Math.max(0, payload.baseWage ?? 1).toFixed(3)),
      needsProfile: normalizeCultureNeedsProfile(payload.needsProfile),
      qualificationRequirements: normalizeNumberRecord(payload.qualificationRequirements, 0, 1_000_000),
      qualificationGrowthRules: normalizeNumberRecord(payload.qualificationGrowthRules, -1_000_000, 1_000_000),
    };
  }
  if (kind === "decisions") {
    return {
      decision: normalizeDecision(payload.decision) ?? {
        category: "politics",
        visibilityConditions: [],
        availabilityConditions: [],
        costs: {},
        effects: [],
        cooldownTurns: 0,
        repeatable: false,
      },
    };
  }
  if (kind === "events") {
    return {
      event: normalizeGameEvent(payload.event) ?? {
        category: "politics",
        priority: "medium",
        visibility: "private",
        titleKey: undefined,
        descriptionKey: undefined,
        imageUrl: null,
        iconId: null,
        triggerConditions: [],
        options: [],
        cooldownTurns: 0,
        repeatable: false,
        checkIntervalTurns: 1,
        chancePct: 100,
        blocking: false,
      },
    };
  }
  if (kind === "journalEntries") {
    return {
      journalEntry: normalizeJournalEntry(payload.journalEntry) ?? {
        category: "politics",
        titleKey: "journal.untitled.title",
        descriptionKey: "journal.untitled.description",
        shortDescriptionKey: null,
        iconId: null,
        imageUrl: null,
        visibility: "private",
        priority: "medium",
        scope: null,
        startTrigger: null,
        completeTrigger: null,
        failTrigger: null,
        cancelTrigger: null,
        progress: null,
        timeoutTurns: null,
        onStartEffects: [],
        onCompleteEffects: [],
        onFailEffects: [],
        onCancelEffects: [],
        events: null,
        decisions: null,
        modifiers: null,
        repeatable: false,
        cooldownTurns: 0,
      },
    };
  }
  if (kind === "cultures" || kind === "races" || kind === "religions") return { needsProfile: normalizeCultureNeedsProfile(payload.needsProfile) };
  if (kind === "ideologies") return { ideologyAttractionRules: normalizeIdeologyAttractionRules(payload.ideologyAttractionRules) };
  if (kind === "parties") {
    return {
      ideologyWeights: normalizeNumberRecord(payload.ideologyWeights, 0, 100),
      interestGroupWeights: normalizeNumberRecord(payload.interestGroupWeights, 0, 100),
      lawPreferences: normalizeNumberRecord(payload.lawPreferences, -100, 100),
      discipline: Number(Math.min(1, Math.max(0, payload.discipline ?? 0.85)).toFixed(3)),
    };
  }
  if (kind === "interestGroups") {
    return {
      professionWeights: normalizeNumberRecord(payload.professionWeights, 0, 100),
      ideologyWeights: normalizeNumberRecord(payload.ideologyWeights, 0, 100),
      religionWeights: normalizeNumberRecord(payload.religionWeights, 0, 100),
      buildingWeights: normalizeNumberRecord(payload.buildingWeights, 0, 100),
      lawPreferences: normalizeNumberRecord(payload.lawPreferences, -100, 100),
      basePoliticalStrength: Number(Math.max(0, payload.basePoliticalStrength ?? 1).toFixed(3)),
      solMultiplier: Number(Math.max(-10, payload.solMultiplier ?? 0.03).toFixed(3)),
      radicalMultiplier: Number(Math.max(-10, payload.radicalMultiplier ?? 0.5).toFixed(3)),
      loyalistMultiplier: Number(Math.max(-10, payload.loyalistMultiplier ?? 0.25).toFixed(3)),
      defaultPartyId:
        payload.defaultPartyId === undefined
          ? undefined
          : typeof payload.defaultPartyId === "string" && payload.defaultPartyId.trim().length > 0
            ? payload.defaultPartyId.trim()
            : null,
    };
  }
  if (kind === "lawGroups") {
    return {
      defaultLawId:
        payload.defaultLawId === undefined
          ? undefined
          : typeof payload.defaultLawId === "string" && payload.defaultLawId.trim().length > 0
            ? payload.defaultLawId.trim()
            : null,
      order: Math.floor(payload.order ?? 0),
    };
  }
  if (kind === "laws") {
    return {
      lawGroupId:
        payload.lawGroupId === undefined
          ? undefined
          : typeof payload.lawGroupId === "string" && payload.lawGroupId.trim().length > 0
            ? payload.lawGroupId.trim()
            : null,
      lawPreferences: normalizeNumberRecord(payload.lawPreferences, -100, 100),
      enactmentDifficulty: Number(Math.max(0.1, payload.enactmentDifficulty ?? 1).toFixed(3)),
      votingDurationTurns: Math.max(1, Math.floor(payload.votingDurationTurns ?? 3)),
      parliamentPower: normalizeLawParliamentPowerEffect(payload.parliamentPower),
      acceptedCultureIds: normalizeCountryIdList(payload.acceptedCultureIds),
      acceptedReligionIds: normalizeCountryIdList(payload.acceptedReligionIds),
      acceptedRaceIds: normalizeCountryIdList(payload.acceptedRaceIds),
      acceptanceMode: payload.acceptanceMode ?? "add",
      discrimination: payload.discrimination ?? null,
    };
  }
  if (kind === "technologies") {
    return {
      costScience: Number(Math.max(0, payload.costScience ?? 100).toFixed(3)),
      prerequisiteTechnologyIds: normalizeCountryIdList(payload.prerequisiteTechnologyIds),
      unlockBuildingIds: normalizeCountryIdList(payload.unlockBuildingIds),
      unlockLawIds: normalizeCountryIdList(payload.unlockLawIds),
    };
  }
  if (kind === "modifiers") return { modifiers: normalizeModifiers(payload.modifiers) };
  if (kind === "buildings") {
    const costConstruction = Math.max(1, Math.floor(payload.costConstruction ?? 100));
    const costDucats = Number(Math.max(0, payload.costDucats ?? 10).toFixed(3));
    const maxLevel = Math.max(1, Math.floor(payload.maxLevel ?? 1));
    const maxDurability = Number(Math.max(1, payload.maxDurability ?? DEFAULT_BUILDING_DURABILITY_MAX).toFixed(3));
    const upgradeCostConstruction = Math.max(1, Math.floor(payload.upgradeCostConstruction ?? payload.costConstruction ?? 100));
    const upgradeCostDucats = Number(Math.max(0, payload.upgradeCostDucats ?? payload.costDucats ?? 10).toFixed(3));
    return {
      costConstruction,
      costDucats,
      startingDucats: Number(Math.max(0, payload.startingDucats ?? 0).toFixed(3)),
      maxLevel,
      maxDurability,
      upgradeCostDucats,
      upgradeCostConstruction,
      sectorId:
        payload.sectorId === undefined
          ? payload.industryId === undefined
            ? undefined
            : typeof payload.industryId === "string" && payload.industryId.trim().length > 0
              ? payload.industryId.trim()
              : null
          : typeof payload.sectorId === "string" && payload.sectorId.trim().length > 0
            ? payload.sectorId.trim()
            : null,
      industryId:
        payload.industryId === undefined
          ? undefined
          : typeof payload.industryId === "string" && payload.industryId.trim().length > 0
            ? payload.industryId.trim()
            : null,
      extractionGoodId:
        payload.extractionGoodId === undefined
          ? undefined
          : typeof payload.extractionGoodId === "string" && payload.extractionGoodId.trim().length > 0
            ? payload.extractionGoodId.trim()
            : null,
      extractionAmountPerTurn: Number(Math.max(0, payload.extractionAmountPerTurn ?? 0).toFixed(3)),
      extractionRequiresDeposit: payload.extractionRequiresDeposit ?? true,
      extractions: normalizeExtractionFlows(payload.extractions),
      inputs: normalizeGoodFlows(payload.inputs),
      outputs: normalizeGoodFlows(payload.outputs),
      workforceRequirements: normalizeWorkforceRequirements(payload.workforceRequirements),
      allowedCountryIds: normalizeCountryIdList(payload.allowedCountryIds),
      deniedCountryIds: normalizeCountryIdList(payload.deniedCountryIds),
      allowedHexTypes: normalizeStringList(payload.allowedHexTypes),
      deniedHexTypes: normalizeStringList(payload.deniedHexTypes),
      allowedClimates: normalizeStringList(payload.allowedClimates),
      deniedClimates: normalizeStringList(payload.deniedClimates),
      allowedLandscapes: normalizeStringList(payload.allowedLandscapes),
      deniedLandscapes: normalizeStringList(payload.deniedLandscapes),
      allowedContinents: normalizeStringList(payload.allowedContinents),
      deniedContinents: normalizeStringList(payload.deniedContinents),
      allowedStrategicRegions: normalizeStringList(payload.allowedStrategicRegions),
      deniedStrategicRegions: normalizeStringList(payload.deniedStrategicRegions),
      minRadiation: normalizeOptionalFiniteNumber(payload.minRadiation, 0),
      maxRadiation: normalizeOptionalFiniteNumber(payload.maxRadiation, 0),
      pollutionProductivityMode: normalizePollutionProductivityMode(payload.pollutionProductivityMode),
      countryBuildLimits: normalizeBuildingCountryLimits(payload.countryBuildLimits),
      globalBuildLimit: payload.globalBuildLimit == null || Number(payload.globalBuildLimit) <= 0 ? null : Math.max(1, Math.floor(Number(payload.globalBuildLimit))),
      placement: payload.placement ?? null,
      adjacencyEffects: payload.adjacencyEffects ?? [],
      deployment: payload.deployment ?? null,
    };
  }
  return {};
}
