import { z } from "zod";
import { normalizeGoodFlows, normalizeWorkforceRequirements } from "../mechanics/contentFieldNormalizers";
import {
  normalizeDecision,
  normalizeGameEvent,
  normalizeIdeologyAttractionRules,
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
  BattalionContentEntry,
  BuildingContentEntry,
  GameContentEntry,
  GoodContentEntry,
} from "../runtime/gameSettingsTypes";

const SETTINGS_MAX_NUMBER = 1_000_000_000_000;

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
  ]),
  mode: z.enum(["add", "add_pct", "mult"]),
  value: z.number().finite().min(-1_000_000).max(1_000_000),
  target: z
    .object({
      buildingId: z.string().trim().min(1).max(120).nullable().optional(),
      goodId: z.string().trim().min(1).max(120).nullable().optional(),
      professionId: z.string().trim().min(1).max(120).nullable().optional(),
      resourceCategoryId: z.string().trim().min(1).max(120).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const modifierPayloadSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  label: z.string().trim().min(1).max(120),
  scope: z.enum(["country", "province", "building", "pop", "market"]),
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
      z.object({
        type: z.literal("resource_delta"),
        resource: z.enum(["culture", "science", "religion", "colonization", "construction", "ducats", "gold"]),
        amount: z.number().finite().min(-SETTINGS_MAX_NUMBER).max(SETTINGS_MAX_NUMBER),
      }),
    )
    .max(30)
    .optional(),
  cooldownTurns: z.number().int().min(0).max(SETTINGS_MAX_NUMBER).optional(),
  repeatable: z.boolean().optional(),
});

const eventOptionPayloadSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  effects: z
    .array(
      z.object({
        type: z.literal("resource_delta"),
        resource: z.enum(["culture", "science", "religion", "colonization", "construction", "ducats", "gold"]),
        amount: z.number().finite().min(-SETTINGS_MAX_NUMBER).max(SETTINGS_MAX_NUMBER),
      }),
    )
    .max(30)
    .optional(),
  autoChancePct: z.number().finite().min(0).max(100).nullable().optional(),
  buttonColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
});

const gameEventPayloadSchema = z.object({
  category: z.enum(["system", "colonization", "politics", "economy", "military", "diplomacy"]),
  priority: z.enum(["low", "medium", "high"]).optional(),
  visibility: z.enum(["public", "private"]).optional(),
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
  cooldownTurns: z.number().int().min(0).max(SETTINGS_MAX_NUMBER).optional(),
  repeatable: z.boolean().optional(),
  checkIntervalTurns: z.number().int().min(1).max(SETTINGS_MAX_NUMBER).optional(),
  chancePct: z.number().finite().min(0).max(100).optional(),
  blocking: z.boolean().optional(),
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
    "province_modifier_active",
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
  inputs: z.array(z.object({ goodId: z.string().trim().min(1).max(120), amount: z.number().finite().min(0), affectedByFertility: z.boolean().optional() })).optional(),
  outputs: z.array(z.object({ goodId: z.string().trim().min(1).max(120), amount: z.number().finite().min(0), affectedByFertility: z.boolean().optional() })).optional(),
  workforceRequirements: z.array(z.object({ professionId: z.string().trim().min(1).max(120), workers: z.number().int().min(0) })).optional(),
  allowedCountryIds: z.array(z.string().trim().min(1).max(120)).optional(),
  deniedCountryIds: z.array(z.string().trim().min(1).max(120)).optional(),
  allowedProvinceTypes: z.array(z.string().trim().min(1).max(120)).optional(),
  deniedProvinceTypes: z.array(z.string().trim().min(1).max(120)).optional(),
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
  manpower: z.number().finite().min(0).optional(),
  attack: z.number().finite().min(0).optional(),
  defense: z.number().finite().min(0).optional(),
  breakthrough: z.number().finite().min(0).optional(),
  organization: z.number().finite().min(1).optional(),
  hp: z.number().finite().min(1).optional(),
  speed: z.number().finite().min(0.1).optional(),
  supplyUse: z.number().finite().min(0).optional(),
  trainingCostDucats: z.number().finite().min(0).optional(),
  trainingCostManpower: z.number().finite().min(0).optional(),
  equipmentNeeds: z.array(z.object({ goodId: z.string().trim().min(1).max(120), amount: z.number().finite().min(0), affectedByFertility: z.boolean().optional() })).optional(),
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
  ideologyAttractionRules: z.array(ideologyAttractionRulePayloadSchema).max(100).optional(),
});

export const contentEntryKindSchema = z.enum([
  "cultures",
  "resourceCategories",
  "provinceTypes",
  "provinceClimates",
  "provinceLandscapes",
  "provinceContinents",
  "provinceStrategicRegions",
  "religions",
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
  "battalions",
  "shipTypes",
  "aircraftTypes",
]);

export type ContentEntryKind = z.infer<typeof contentEntryKindSchema>;
export type CulturePayload = z.infer<typeof culturePayloadSchema>;

export function isMilitaryContentKind(kind: ContentEntryKind): kind is "battalions" | "shipTypes" | "aircraftTypes" {
  return kind === "battalions" || kind === "shipTypes" || kind === "aircraftTypes";
}

export function sanitizeContentEntryByKind(
  kind: ContentEntryKind,
  payload: CulturePayload,
): Partial<GameContentEntry & GoodContentEntry & BuildingContentEntry & BattalionContentEntry> {
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
  if (kind === "professions") return { baseWage: Number(Math.max(0, payload.baseWage ?? 1).toFixed(3)) };
  if (isMilitaryContentKind(kind)) {
    return {
      manpower: Math.max(0, Math.floor(payload.manpower ?? 1000)),
      attack: Number(Math.max(0, payload.attack ?? 6).toFixed(3)),
      defense: Number(Math.max(0, payload.defense ?? 6).toFixed(3)),
      breakthrough: Number(Math.max(0, payload.breakthrough ?? 2).toFixed(3)),
      organization: Number(Math.max(1, payload.organization ?? 8).toFixed(3)),
      hp: Number(Math.max(1, payload.hp ?? 20).toFixed(3)),
      speed: Number(Math.max(0.1, payload.speed ?? 1).toFixed(3)),
      supplyUse: Number(Math.max(0, payload.supplyUse ?? 1).toFixed(3)),
      trainingCostDucats: Number(Math.max(0, payload.trainingCostDucats ?? 10).toFixed(3)),
      trainingCostManpower: Number(Math.max(0, payload.trainingCostManpower ?? payload.manpower ?? 1000).toFixed(3)),
      equipmentNeeds: normalizeGoodFlows(payload.equipmentNeeds),
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
        triggerConditions: [],
        options: [{ id: "ok", label: "Понятно", description: null, effects: [], autoChancePct: 100, buttonColor: null }],
        cooldownTurns: 0,
        repeatable: false,
        checkIntervalTurns: 1,
        chancePct: 100,
        blocking: false,
      },
    };
  }
  if (kind === "cultures") return { needsProfile: normalizeCultureNeedsProfile(payload.needsProfile) };
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
      inputs: normalizeGoodFlows(payload.inputs),
      outputs: normalizeGoodFlows(payload.outputs),
      workforceRequirements: normalizeWorkforceRequirements(payload.workforceRequirements),
      allowedCountryIds: normalizeCountryIdList(payload.allowedCountryIds),
      deniedCountryIds: normalizeCountryIdList(payload.deniedCountryIds),
      allowedProvinceTypes: normalizeStringList(payload.allowedProvinceTypes),
      deniedProvinceTypes: normalizeStringList(payload.deniedProvinceTypes),
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
    };
  }
  return {};
}
