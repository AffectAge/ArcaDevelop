import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

export type ScenarioDefines = {
  ai?: {
    enabled?: unknown;
    maxCountriesPerTick?: unknown;
    maxDecisionCandidatesPerCountry?: unknown;
    contextCacheTtlTurns?: unknown;
  };
  economy?: {
    baseCulturePerTurn?: unknown;
    baseSciencePerTurn?: unknown;
    baseReligionPerTurn?: unknown;
    baseConstructionPerTurn?: unknown;
    baseDucatsPerTurn?: unknown;
    baseGoldPerTurn?: unknown;
    demolitionCostConstructionPercent?: unknown;
    marketPriceSmoothing?: unknown;
    buildingDurabilityDecayPerTurn?: unknown;
    buildingDurabilityRecoveryPerTurn?: unknown;
    pollutionProductivityEffectPer1000?: unknown;
    explorationBaseEmptyChancePct?: unknown;
    explorationDepletionPerAttemptPct?: unknown;
    explorationDurationTurns?: unknown;
    explorationRollsPerExpedition?: unknown;
  };
  auditLog?: {
    maxEntries?: unknown;
    retentionTurns?: unknown;
  };
  colonization?: {
    maxActiveColonizations?: unknown;
    pointsPerTurn?: unknown;
    pointsCostPer1000Km2?: unknown;
    ducatsCostPer1000Km2?: unknown;
    settlementEnabled?: unknown;
    settlementPopulationOnCapture?: unknown;
  };
  customization?: {
    renameDucats?: unknown;
    recolorDucats?: unknown;
    flagDucats?: unknown;
    crestDucats?: unknown;
    provinceRenameDucats?: unknown;
  };
  military?: {
    militaryFormationSpeed?: unknown;
  };
  registration?: {
    requireAdminApproval?: unknown;
  };
  eventLog?: {
    retentionTurns?: unknown;
  };
  resourceLedger?: {
    retentionTurns?: unknown;
    maxEntriesPerTurn?: unknown;
  };
  turnTimer?: {
    enabled?: unknown;
    secondsPerTurn?: unknown;
    pauseWhenNoPlayersOnline?: unknown;
  };
};

export type ScenarioDefinesOptions = {
  hardMaxAuditLogEntries: number;
  maxSettingNumber: number;
};

export type ScenarioDefineFieldSpec = {
  type: "boolean" | "integer" | "integerOrNull" | "number";
  min?: number;
  max?: number;
};

export type ScenarioDefinesSupportedSections = Record<string, Record<string, ScenarioDefineFieldSpec>>;

export const SCENARIO_DEFINES_SUPPORTED_SECTIONS = {
  ai: {
    enabled: { type: "boolean" },
    maxCountriesPerTick: { type: "integer", min: 1, max: 1_000 },
    maxDecisionCandidatesPerCountry: { type: "integer", min: 1, max: 1_000 },
    contextCacheTtlTurns: { type: "integer", min: 1, max: 100 },
  },
  economy: {
    baseCulturePerTurn: { type: "integer", min: 0, max: 1_000_000_000_000 },
    baseSciencePerTurn: { type: "integer", min: 0, max: 1_000_000_000_000 },
    baseReligionPerTurn: { type: "integer", min: 0, max: 1_000_000_000_000 },
    baseConstructionPerTurn: { type: "integer", min: 0, max: 1_000_000_000_000 },
    baseDucatsPerTurn: { type: "integer", min: 0, max: 1_000_000_000_000 },
    baseGoldPerTurn: { type: "integer", min: 0, max: 1_000_000_000_000 },
    demolitionCostConstructionPercent: { type: "integer", min: 0, max: 100 },
    marketPriceSmoothing: { type: "number", min: 0, max: 1 },
    buildingDurabilityDecayPerTurn: { type: "number", min: 0, max: 1_000_000_000_000 },
    buildingDurabilityRecoveryPerTurn: { type: "number", min: 0, max: 1_000_000_000_000 },
    pollutionProductivityEffectPer1000: { type: "number", min: 0, max: 1_000_000_000_000 },
    explorationBaseEmptyChancePct: { type: "number", min: 0, max: 100 },
    explorationDepletionPerAttemptPct: { type: "number", min: 0, max: 100 },
    explorationDurationTurns: { type: "integer", min: 1, max: 3_650 },
    explorationRollsPerExpedition: { type: "integer", min: 1, max: 100 },
  },
  auditLog: {
    maxEntries: { type: "integer", min: 1, max: 10_000 },
    retentionTurns: { type: "integerOrNull", min: 1 },
  },
  colonization: {
    maxActiveColonizations: { type: "integer", min: 1, max: 1_000 },
    pointsPerTurn: { type: "integer", min: 0, max: 1_000_000_000_000 },
    pointsCostPer1000Km2: { type: "integer", min: 1, max: 1_000_000_000_000 },
    ducatsCostPer1000Km2: { type: "integer", min: 0, max: 1_000_000_000_000 },
    settlementEnabled: { type: "boolean" },
    settlementPopulationOnCapture: { type: "integer", min: 0, max: 1_000_000_000 },
  },
  customization: {
    renameDucats: { type: "integer", min: 0, max: 1_000_000_000_000 },
    recolorDucats: { type: "integer", min: 0, max: 1_000_000_000_000 },
    flagDucats: { type: "integer", min: 0, max: 1_000_000_000_000 },
    crestDucats: { type: "integer", min: 0, max: 1_000_000_000_000 },
    provinceRenameDucats: { type: "integer", min: 0, max: 1_000_000_000_000 },
  },
  military: {
    militaryFormationSpeed: { type: "number", min: 1, max: 1_000_000_000_000 },
  },
  registration: {
    requireAdminApproval: { type: "boolean" },
  },
  eventLog: {
    retentionTurns: { type: "integer", min: 1, max: 100 },
  },
  resourceLedger: {
    retentionTurns: { type: "integer", min: 1, max: 3650 },
    maxEntriesPerTurn: { type: "integer", min: 1, max: 100000 },
  },
  turnTimer: {
    enabled: { type: "boolean" },
    secondsPerTurn: { type: "integer", min: 10, max: 2_592_000 },
    pauseWhenNoPlayersOnline: { type: "boolean" },
  },
} as const satisfies ScenarioDefinesSupportedSections;

export type AuditLogSettings = {
  maxEntries: number;
  retentionTurns: number | null;
};

export type SettingsWithScenarioDefines = {
  ai: AiSettings;
  economy: EconomySettings;
  auditLog: AuditLogSettings;
  colonization: ColonizationSettings;
  customization: CustomizationSettings;
  military: MilitarySettings;
  registration: RegistrationSettings;
  eventLog: EventLogSettings;
  resourceLedger: ResourceLedgerSettings;
  turnTimer: TurnTimerSettings;
};

export type AiSettings = {
  enabled: boolean;
  maxCountriesPerTick: number;
  maxDecisionCandidatesPerCountry: number;
  contextCacheTtlTurns: number;
};

export type EconomySettings = {
  baseCulturePerTurn: number;
  baseSciencePerTurn: number;
  baseReligionPerTurn: number;
  baseConstructionPerTurn: number;
  baseDucatsPerTurn: number;
  baseGoldPerTurn: number;
  demolitionCostConstructionPercent: number;
  marketPriceSmoothing: number;
  buildingDurabilityDecayPerTurn: number;
  buildingDurabilityRecoveryPerTurn: number;
  pollutionProductivityEffectPer1000: number;
  explorationBaseEmptyChancePct: number;
  explorationDepletionPerAttemptPct: number;
  explorationDurationTurns: number;
  explorationRollsPerExpedition: number;
};

export type ColonizationSettings = {
  maxActiveColonizations: number;
  pointsPerTurn: number;
  pointsCostPer1000Km2: number;
  ducatsCostPer1000Km2: number;
  settlementEnabled: boolean;
  settlementPopulationOnCapture: number;
};

export type CustomizationSettings = {
  renameDucats: number;
  recolorDucats: number;
  flagDucats: number;
  crestDucats: number;
  provinceRenameDucats: number;
};

export type MilitarySettings = {
  militaryFormationSpeed: number;
};

export type RegistrationSettings = {
  requireAdminApproval: boolean;
};

export type EventLogSettings = {
  retentionTurns: number;
};

export type ResourceLedgerSettings = {
  retentionTurns: number;
  maxEntriesPerTurn: number;
};

export type TurnTimerSettings = {
  enabled: boolean;
  secondsPerTurn: number;
  pauseWhenNoPlayersOnline: boolean;
};

const scenarioDefinesShapeSchema = z
  .object({
    ai: z
      .object({
        enabled: z.unknown().optional(),
        maxCountriesPerTick: z.unknown().optional(),
        maxDecisionCandidatesPerCountry: z.unknown().optional(),
        contextCacheTtlTurns: z.unknown().optional(),
      })
      .strict()
      .optional(),
    economy: z
      .object({
        baseCulturePerTurn: z.unknown().optional(),
        baseSciencePerTurn: z.unknown().optional(),
        baseReligionPerTurn: z.unknown().optional(),
        baseConstructionPerTurn: z.unknown().optional(),
        baseDucatsPerTurn: z.unknown().optional(),
        baseGoldPerTurn: z.unknown().optional(),
        demolitionCostConstructionPercent: z.unknown().optional(),
        marketPriceSmoothing: z.unknown().optional(),
        buildingDurabilityDecayPerTurn: z.unknown().optional(),
        buildingDurabilityRecoveryPerTurn: z.unknown().optional(),
        pollutionProductivityEffectPer1000: z.unknown().optional(),
        explorationBaseEmptyChancePct: z.unknown().optional(),
        explorationDepletionPerAttemptPct: z.unknown().optional(),
        explorationDurationTurns: z.unknown().optional(),
        explorationRollsPerExpedition: z.unknown().optional(),
      })
      .strict()
      .optional(),
    auditLog: z
      .object({
        maxEntries: z.unknown().optional(),
        retentionTurns: z.unknown().optional(),
      })
      .strict()
      .optional(),
    colonization: z
      .object({
        maxActiveColonizations: z.unknown().optional(),
        pointsPerTurn: z.unknown().optional(),
        pointsCostPer1000Km2: z.unknown().optional(),
        ducatsCostPer1000Km2: z.unknown().optional(),
        settlementEnabled: z.unknown().optional(),
        settlementPopulationOnCapture: z.unknown().optional(),
      })
      .strict()
      .optional(),
    customization: z
      .object({
        renameDucats: z.unknown().optional(),
        recolorDucats: z.unknown().optional(),
        flagDucats: z.unknown().optional(),
        crestDucats: z.unknown().optional(),
        provinceRenameDucats: z.unknown().optional(),
      })
      .strict()
      .optional(),
    military: z
      .object({
        militaryFormationSpeed: z.unknown().optional(),
      })
      .strict()
      .optional(),
    registration: z
      .object({
        requireAdminApproval: z.unknown().optional(),
      })
      .strict()
      .optional(),
    eventLog: z
      .object({
        retentionTurns: z.unknown().optional(),
      })
      .strict()
      .optional(),
    resourceLedger: z
      .object({
        retentionTurns: z.unknown().optional(),
        maxEntriesPerTurn: z.unknown().optional(),
      })
      .strict()
      .optional(),
    turnTimer: z
      .object({
        enabled: z.unknown().optional(),
        secondsPerTurn: z.unknown().optional(),
        pauseWhenNoPlayersOnline: z.unknown().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export function loadScenarioDefines(scenarioDir: string | null): ScenarioDefines | null {
  if (!scenarioDir) return null;
  const path = resolve(scenarioDir, "common/defines.json");
  if (!existsSync(path)) return null;

  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return assertScenarioDefinesShape(parsed);
}

export function assertScenarioDefinesShape(raw: unknown): ScenarioDefines {
  const parsed = scenarioDefinesShapeSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "common/defines.json";
    throw new Error(`INVALID_SCENARIO_DEFINES_SHAPE:${path}`);
  }
  return parsed.data as ScenarioDefines;
}

export function applyScenarioDefinesToGameSettings<TSettings extends SettingsWithScenarioDefines>(
  settings: TSettings,
  defines: ScenarioDefines | null,
  options: ScenarioDefinesOptions,
): TSettings & {
  ai: AiSettings;
  economy: EconomySettings;
  auditLog: AuditLogSettings;
  colonization: ColonizationSettings;
  customization: CustomizationSettings;
  military: MilitarySettings;
  registration: RegistrationSettings;
  eventLog: EventLogSettings;
  turnTimer: TurnTimerSettings;
} {
  if (!defines) return settings;

  const ai = normalizeScenarioAiDefines(defines.ai, settings.ai) ?? settings.ai;
  const economy = normalizeScenarioEconomyDefines(defines.economy, settings.economy, options) ?? settings.economy;
  const auditLog = normalizeScenarioAuditLogDefines(defines.auditLog, settings.auditLog, options) ?? settings.auditLog;
  const colonization = normalizeScenarioColonizationDefines(defines.colonization, settings.colonization, options) ?? settings.colonization;
  const customization = normalizeScenarioCustomizationDefines(defines.customization, settings.customization, options) ?? settings.customization;
  const military = normalizeScenarioMilitaryDefines(defines.military, settings.military, options) ?? settings.military;
  const registration = normalizeScenarioRegistrationDefines(defines.registration, settings.registration) ?? settings.registration;
  const eventLog = normalizeScenarioEventLogDefines(defines.eventLog, settings.eventLog) ?? settings.eventLog;
  const resourceLedger = normalizeScenarioResourceLedgerDefines(defines.resourceLedger, settings.resourceLedger) ?? settings.resourceLedger;
  const turnTimer = normalizeScenarioTurnTimerDefines(defines.turnTimer, settings.turnTimer) ?? settings.turnTimer;

  return {
    ...settings,
    ai,
    economy,
    auditLog,
    colonization,
    customization,
    military,
    registration,
    eventLog,
    resourceLedger,
    turnTimer,
  };
}

export function normalizeScenarioAiDefines(
  aiDefines: ScenarioDefines["ai"] | undefined,
  defaults: AiSettings,
): AiSettings | null {
  if (aiDefines == null) return null;
  if (typeof aiDefines !== "object" || Array.isArray(aiDefines)) {
    throw new Error("INVALID_SCENARIO_AI_DEFINES");
  }

  return {
    enabled: normalizeBoolean(
      aiDefines.enabled,
      defaults.enabled,
      "INVALID_SCENARIO_AI_ENABLED",
    ),
    maxCountriesPerTick: normalizeIntegerInRange(
      aiDefines.maxCountriesPerTick,
      defaults.maxCountriesPerTick,
      1,
      1_000,
      "INVALID_SCENARIO_AI_MAX_COUNTRIES_PER_TICK",
    ),
    maxDecisionCandidatesPerCountry: normalizeIntegerInRange(
      aiDefines.maxDecisionCandidatesPerCountry,
      defaults.maxDecisionCandidatesPerCountry,
      1,
      1_000,
      "INVALID_SCENARIO_AI_MAX_DECISION_CANDIDATES_PER_COUNTRY",
    ),
    contextCacheTtlTurns: normalizeIntegerInRange(
      aiDefines.contextCacheTtlTurns,
      defaults.contextCacheTtlTurns,
      1,
      100,
      "INVALID_SCENARIO_AI_CONTEXT_CACHE_TTL_TURNS",
    ),
  };
}

export function normalizeScenarioEconomyDefines(
  economyDefines: ScenarioDefines["economy"] | undefined,
  defaults: EconomySettings,
  options: ScenarioDefinesOptions,
): EconomySettings | null {
  if (economyDefines == null) return null;
  if (typeof economyDefines !== "object" || Array.isArray(economyDefines)) {
    throw new Error("INVALID_SCENARIO_ECONOMY_DEFINES");
  }

  return {
    baseCulturePerTurn: normalizeIntegerInRange(
      economyDefines.baseCulturePerTurn,
      defaults.baseCulturePerTurn,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_ECONOMY_BASE_CULTURE",
    ),
    baseSciencePerTurn: normalizeIntegerInRange(
      economyDefines.baseSciencePerTurn,
      defaults.baseSciencePerTurn,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_ECONOMY_BASE_SCIENCE",
    ),
    baseReligionPerTurn: normalizeIntegerInRange(
      economyDefines.baseReligionPerTurn,
      defaults.baseReligionPerTurn,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_ECONOMY_BASE_RELIGION",
    ),
    baseConstructionPerTurn: normalizeIntegerInRange(
      economyDefines.baseConstructionPerTurn,
      defaults.baseConstructionPerTurn,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_ECONOMY_BASE_CONSTRUCTION",
    ),
    baseDucatsPerTurn: normalizeIntegerInRange(
      economyDefines.baseDucatsPerTurn,
      defaults.baseDucatsPerTurn,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_ECONOMY_BASE_DUCATS",
    ),
    baseGoldPerTurn: normalizeIntegerInRange(
      economyDefines.baseGoldPerTurn,
      defaults.baseGoldPerTurn,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_ECONOMY_BASE_GOLD",
    ),
    demolitionCostConstructionPercent: normalizeIntegerInRange(
      economyDefines.demolitionCostConstructionPercent,
      defaults.demolitionCostConstructionPercent,
      0,
      100,
      "INVALID_SCENARIO_ECONOMY_DEMOLITION_COST",
    ),
    marketPriceSmoothing: normalizeNumberInRange(
      economyDefines.marketPriceSmoothing,
      defaults.marketPriceSmoothing,
      0,
      1,
      "INVALID_SCENARIO_ECONOMY_MARKET_PRICE_SMOOTHING",
    ),
    buildingDurabilityDecayPerTurn: normalizeNumberInRange(
      economyDefines.buildingDurabilityDecayPerTurn,
      defaults.buildingDurabilityDecayPerTurn,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_ECONOMY_BUILDING_DURABILITY_DECAY",
    ),
    buildingDurabilityRecoveryPerTurn: normalizeNumberInRange(
      economyDefines.buildingDurabilityRecoveryPerTurn,
      defaults.buildingDurabilityRecoveryPerTurn,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_ECONOMY_BUILDING_DURABILITY_RECOVERY",
    ),
    pollutionProductivityEffectPer1000: normalizeNumberInRange(
      economyDefines.pollutionProductivityEffectPer1000,
      defaults.pollutionProductivityEffectPer1000,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_ECONOMY_POLLUTION_PRODUCTIVITY",
    ),
    explorationBaseEmptyChancePct: normalizeNumberInRange(
      economyDefines.explorationBaseEmptyChancePct,
      defaults.explorationBaseEmptyChancePct,
      0,
      100,
      "INVALID_SCENARIO_ECONOMY_EXPLORATION_EMPTY_CHANCE",
    ),
    explorationDepletionPerAttemptPct: normalizeNumberInRange(
      economyDefines.explorationDepletionPerAttemptPct,
      defaults.explorationDepletionPerAttemptPct,
      0,
      100,
      "INVALID_SCENARIO_ECONOMY_EXPLORATION_DEPLETION",
    ),
    explorationDurationTurns: normalizeIntegerInRange(
      economyDefines.explorationDurationTurns,
      defaults.explorationDurationTurns,
      1,
      3_650,
      "INVALID_SCENARIO_ECONOMY_EXPLORATION_DURATION",
    ),
    explorationRollsPerExpedition: normalizeIntegerInRange(
      economyDefines.explorationRollsPerExpedition,
      defaults.explorationRollsPerExpedition,
      1,
      100,
      "INVALID_SCENARIO_ECONOMY_EXPLORATION_ROLLS",
    ),
  };
}

export function normalizeScenarioAuditLogDefines(
  auditLogDefines: ScenarioDefines["auditLog"] | undefined,
  defaults: AuditLogSettings,
  options: ScenarioDefinesOptions,
): AuditLogSettings | null {
  if (auditLogDefines == null) return null;
  if (typeof auditLogDefines !== "object" || Array.isArray(auditLogDefines)) {
    throw new Error("INVALID_SCENARIO_AUDIT_LOG_DEFINES");
  }

  return {
    maxEntries: normalizePositiveInteger(
      auditLogDefines.maxEntries,
      defaults.maxEntries,
      options.hardMaxAuditLogEntries,
      "INVALID_SCENARIO_AUDIT_LOG_MAX_ENTRIES",
    ),
    retentionTurns: normalizeNullablePositiveInteger(
      auditLogDefines.retentionTurns,
      defaults.retentionTurns,
      "INVALID_SCENARIO_AUDIT_LOG_RETENTION_TURNS",
    ),
  };
}

export function normalizeScenarioColonizationDefines(
  colonizationDefines: ScenarioDefines["colonization"] | undefined,
  defaults: ColonizationSettings,
  options: ScenarioDefinesOptions,
): ColonizationSettings | null {
  if (colonizationDefines == null) return null;
  if (typeof colonizationDefines !== "object" || Array.isArray(colonizationDefines)) {
    throw new Error("INVALID_SCENARIO_COLONIZATION_DEFINES");
  }

  return {
    maxActiveColonizations: normalizeIntegerInRange(
      colonizationDefines.maxActiveColonizations,
      defaults.maxActiveColonizations,
      1,
      1_000,
      "INVALID_SCENARIO_COLONIZATION_MAX_ACTIVE",
    ),
    pointsPerTurn: normalizeIntegerInRange(
      colonizationDefines.pointsPerTurn,
      defaults.pointsPerTurn,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_COLONIZATION_POINTS_PER_TURN",
    ),
    pointsCostPer1000Km2: normalizeIntegerInRange(
      colonizationDefines.pointsCostPer1000Km2,
      defaults.pointsCostPer1000Km2,
      1,
      options.maxSettingNumber,
      "INVALID_SCENARIO_COLONIZATION_POINTS_COST",
    ),
    ducatsCostPer1000Km2: normalizeIntegerInRange(
      colonizationDefines.ducatsCostPer1000Km2,
      defaults.ducatsCostPer1000Km2,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_COLONIZATION_DUCATS_COST",
    ),
    settlementEnabled: normalizeBoolean(
      colonizationDefines.settlementEnabled,
      defaults.settlementEnabled,
      "INVALID_SCENARIO_COLONIZATION_SETTLEMENT_ENABLED",
    ),
    settlementPopulationOnCapture: normalizeIntegerInRange(
      colonizationDefines.settlementPopulationOnCapture,
      defaults.settlementPopulationOnCapture,
      0,
      1_000_000_000,
      "INVALID_SCENARIO_COLONIZATION_SETTLEMENT_POPULATION",
    ),
  };
}

export function normalizeScenarioCustomizationDefines(
  customizationDefines: ScenarioDefines["customization"] | undefined,
  defaults: CustomizationSettings,
  options: ScenarioDefinesOptions,
): CustomizationSettings | null {
  if (customizationDefines == null) return null;
  if (typeof customizationDefines !== "object" || Array.isArray(customizationDefines)) {
    throw new Error("INVALID_SCENARIO_CUSTOMIZATION_DEFINES");
  }

  return {
    renameDucats: normalizeIntegerInRange(
      customizationDefines.renameDucats,
      defaults.renameDucats,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_CUSTOMIZATION_RENAME_DUCATS",
    ),
    recolorDucats: normalizeIntegerInRange(
      customizationDefines.recolorDucats,
      defaults.recolorDucats,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_CUSTOMIZATION_RECOLOR_DUCATS",
    ),
    flagDucats: normalizeIntegerInRange(
      customizationDefines.flagDucats,
      defaults.flagDucats,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_CUSTOMIZATION_FLAG_DUCATS",
    ),
    crestDucats: normalizeIntegerInRange(
      customizationDefines.crestDucats,
      defaults.crestDucats,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_CUSTOMIZATION_CREST_DUCATS",
    ),
    provinceRenameDucats: normalizeIntegerInRange(
      customizationDefines.provinceRenameDucats,
      defaults.provinceRenameDucats,
      0,
      options.maxSettingNumber,
      "INVALID_SCENARIO_CUSTOMIZATION_PROVINCE_RENAME_DUCATS",
    ),
  };
}

export function normalizeScenarioMilitaryDefines(
  militaryDefines: ScenarioDefines["military"] | undefined,
  defaults: MilitarySettings,
  options: ScenarioDefinesOptions,
): MilitarySettings | null {
  if (militaryDefines == null) return null;
  if (typeof militaryDefines !== "object" || Array.isArray(militaryDefines)) {
    throw new Error("INVALID_SCENARIO_MILITARY_DEFINES");
  }

  return {
    militaryFormationSpeed: normalizeNumberInRange(
      militaryDefines.militaryFormationSpeed,
      defaults.militaryFormationSpeed,
      1,
      options.maxSettingNumber,
      "INVALID_SCENARIO_MILITARY_FORMATION_SPEED",
    ),
  };
}

export function normalizeScenarioRegistrationDefines(
  registrationDefines: ScenarioDefines["registration"] | undefined,
  defaults: RegistrationSettings,
): RegistrationSettings | null {
  if (registrationDefines == null) return null;
  if (typeof registrationDefines !== "object" || Array.isArray(registrationDefines)) {
    throw new Error("INVALID_SCENARIO_REGISTRATION_DEFINES");
  }

  return {
    requireAdminApproval: normalizeBoolean(
      registrationDefines.requireAdminApproval,
      defaults.requireAdminApproval,
      "INVALID_SCENARIO_REGISTRATION_REQUIRE_ADMIN_APPROVAL",
    ),
  };
}

export function normalizeScenarioEventLogDefines(
  eventLogDefines: ScenarioDefines["eventLog"] | undefined,
  defaults: EventLogSettings,
): EventLogSettings | null {
  if (eventLogDefines == null) return null;
  if (typeof eventLogDefines !== "object" || Array.isArray(eventLogDefines)) {
    throw new Error("INVALID_SCENARIO_EVENT_LOG_DEFINES");
  }

  return {
    retentionTurns: normalizeIntegerInRange(
      eventLogDefines.retentionTurns,
      defaults.retentionTurns,
      1,
      100,
      "INVALID_SCENARIO_EVENT_LOG_RETENTION_TURNS",
    ),
  };
}

export function normalizeScenarioResourceLedgerDefines(
  resourceLedgerDefines: ScenarioDefines["resourceLedger"] | undefined,
  defaults: ResourceLedgerSettings,
): ResourceLedgerSettings | null {
  if (resourceLedgerDefines == null) return null;
  if (typeof resourceLedgerDefines !== "object" || Array.isArray(resourceLedgerDefines)) {
    throw new Error("INVALID_SCENARIO_RESOURCE_LEDGER_DEFINES");
  }

  return {
    retentionTurns: normalizeIntegerInRange(
      resourceLedgerDefines.retentionTurns,
      defaults.retentionTurns,
      1,
      3_650,
      "INVALID_SCENARIO_RESOURCE_LEDGER_RETENTION_TURNS",
    ),
    maxEntriesPerTurn: normalizeIntegerInRange(
      resourceLedgerDefines.maxEntriesPerTurn,
      defaults.maxEntriesPerTurn,
      1,
      100_000,
      "INVALID_SCENARIO_RESOURCE_LEDGER_MAX_ENTRIES",
    ),
  };
}

export function normalizeScenarioTurnTimerDefines(
  turnTimerDefines: ScenarioDefines["turnTimer"] | undefined,
  defaults: TurnTimerSettings,
): TurnTimerSettings | null {
  if (turnTimerDefines == null) return null;
  if (typeof turnTimerDefines !== "object" || Array.isArray(turnTimerDefines)) {
    throw new Error("INVALID_SCENARIO_TURN_TIMER_DEFINES");
  }

  return {
    enabled: normalizeBoolean(turnTimerDefines.enabled, defaults.enabled, "INVALID_SCENARIO_TURN_TIMER_ENABLED"),
    secondsPerTurn: normalizeIntegerInRange(
      turnTimerDefines.secondsPerTurn,
      defaults.secondsPerTurn,
      10,
      2_592_000,
      "INVALID_SCENARIO_TURN_TIMER_SECONDS_PER_TURN",
    ),
    pauseWhenNoPlayersOnline: normalizeBoolean(
      turnTimerDefines.pauseWhenNoPlayersOnline,
      defaults.pauseWhenNoPlayersOnline,
      "INVALID_SCENARIO_TURN_TIMER_PAUSE_WHEN_NO_PLAYERS_ONLINE",
    ),
  };
}

function normalizePositiveInteger(raw: unknown, fallback: number, max: number, errorCode: string): number {
  if (raw == null) return fallback;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new Error(errorCode);
  }
  return Math.max(1, Math.min(max, Math.floor(raw)));
}

function normalizeNullablePositiveInteger(raw: unknown, fallback: number | null, errorCode: string): number | null {
  if (raw == null) return raw === null ? null : fallback;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new Error(errorCode);
  }
  return Math.max(1, Math.floor(raw));
}

function normalizeIntegerInRange(raw: unknown, fallback: number, min: number, max: number, errorCode: string): number {
  if (raw == null) return fallback;
  if (typeof raw !== "number" || !Number.isFinite(raw) || !Number.isInteger(raw) || raw < min || raw > max) {
    throw new Error(errorCode);
  }
  return raw;
}

function normalizeNumberInRange(raw: unknown, fallback: number, min: number, max: number, errorCode: string): number {
  if (raw == null) return fallback;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < min || raw > max) {
    throw new Error(errorCode);
  }
  return raw;
}

function normalizeBoolean(raw: unknown, fallback: boolean, errorCode: string): boolean {
  if (raw == null) return fallback;
  if (typeof raw !== "boolean") {
    throw new Error(errorCode);
  }
  return raw;
}
