import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  applyScenarioDefinesToGameSettings,
  loadScenarioDefines,
  normalizeScenarioAiDefines,
  normalizeScenarioAuditLogDefines,
  normalizeScenarioColonizationDefines,
  normalizeScenarioCustomizationDefines,
  normalizeScenarioEconomyDefines,
  normalizeScenarioEventLogDefines,
  normalizeScenarioMilitaryDefines,
  normalizeScenarioRegistrationDefines,
  normalizeScenarioTurnTimerDefines,
  type AiSettings,
  type AuditLogSettings,
  type ColonizationSettings,
  type CustomizationSettings,
  type EconomySettings,
  type EventLogSettings,
  type MilitarySettings,
  type RegistrationSettings,
  type ResourceLedgerSettings,
  type TurnTimerSettings,
} from "./scenarioDefinesLoader";

const baseAi: AiSettings = {
  enabled: true,
  maxCountriesPerTick: 50,
  maxDecisionCandidatesPerCountry: 20,
  contextCacheTtlTurns: 1,
  maxBuildCompletionTurns: 8,
};
const baseEconomy: EconomySettings = {
  baseCulturePerTurn: 1,
  baseSciencePerTurn: 1,
  baseReligionPerTurn: 1,
  baseConstructionPerTurn: 5,
  baseDucatsPerTurn: 5,
  baseGoldPerTurn: 10,
  demolitionCostConstructionPercent: 20,
  marketPriceSmoothing: 0.2,
  buildingDurabilityDecayPerTurn: 10,
  buildingDurabilityRecoveryPerTurn: 5,
  pollutionProductivityEffectPer1000: 0.1,
  explorationBaseEmptyChancePct: 5,
  explorationDepletionPerAttemptPct: 7.5,
  explorationDurationTurns: 1,
  explorationRollsPerExpedition: 3,
};
const baseAuditLog: AuditLogSettings = {
  maxEntries: 1_000,
  retentionTurns: null,
};
const baseColonization: ColonizationSettings = {
  maxActiveColonizations: 3,
  pointsPerTurn: 30,
  pointsCostPer1000Km2: 5,
  ducatsCostPer1000Km2: 5,
  settlementEnabled: true,
  settlementPopulationOnCapture: 1_000,
  colonizerTurns: 2,
  colonizerCostColonization: 20,
  colonizerCostDucats: 10,
  colonizerMovementPoints: 2,
};
const baseCustomization: CustomizationSettings = {
  renameDucats: 20,
  recolorDucats: 10,
  flagDucats: 15,
  crestDucats: 15,
  hexRenameDucats: 25,
};
const baseMilitary: MilitarySettings = {
  militaryFormationSpeed: 10,
  landUnitStackLimitPerHex: 4,
};
const baseRegistration: RegistrationSettings = {
  requireAdminApproval: false,
};
const baseEventLog: EventLogSettings = {
  retentionTurns: 3,
};
const baseTurnTimer: TurnTimerSettings = {
  enabled: true,
  secondsPerTurn: 86_400,
  pauseWhenNoPlayersOnline: false,
};
const baseResourceLedger: ResourceLedgerSettings = {
  retentionTurns: 20,
  maxEntriesPerTurn: 10_000,
};
const options = {
  hardMaxAuditLogEntries: 10_000,
  maxSettingNumber: 1_000_000,
};

describe("scenarioDefinesLoader", () => {
  it("loads common/defines.json when present", () => {
    const dir = makeTempScenarioDir();
    try {
      mkdirSync(join(dir, "common"), { recursive: true });
      writeFileSync(join(dir, "common/defines.json"), JSON.stringify({ auditLog: { maxEntries: 50, retentionTurns: 5 } }));

      expect(loadScenarioDefines(dir)).toEqual({ auditLog: { maxEntries: 50, retentionTurns: 5 } });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects unknown top-level define keys", () => {
    const dir = makeTempScenarioDir();
    try {
      mkdirSync(join(dir, "common"), { recursive: true });
      writeFileSync(join(dir, "common/defines.json"), JSON.stringify({ turntimer: { secondsPerTurn: 30 } }));

      expect(() => loadScenarioDefines(dir)).toThrow("INVALID_SCENARIO_DEFINES_SHAPE:common/defines.json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects unknown nested define keys", () => {
    const dir = makeTempScenarioDir();
    try {
      mkdirSync(join(dir, "common"), { recursive: true });
      writeFileSync(join(dir, "common/defines.json"), JSON.stringify({ economy: { baseGold: 10 } }));

      expect(() => loadScenarioDefines(dir)).toThrow("INVALID_SCENARIO_DEFINES_SHAPE:economy");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("normalizes audit log retention with hard caps", () => {
    expect(
      normalizeScenarioAuditLogDefines(
        { maxEntries: 50_000, retentionTurns: 7.8 },
        baseAuditLog,
        options,
      ),
    ).toEqual({ maxEntries: 10_000, retentionTurns: 7 });
  });

  it("allows null audit retention turns", () => {
    expect(
      normalizeScenarioAuditLogDefines(
        { maxEntries: 500, retentionTurns: null },
        { maxEntries: 1_000, retentionTurns: 3 },
        options,
      ),
    ).toEqual({ maxEntries: 500, retentionTurns: null });
  });

  it("rejects invalid audit log defines", () => {
    expect(() =>
      normalizeScenarioAuditLogDefines(
        { maxEntries: "many", retentionTurns: 5 },
        baseAuditLog,
        options,
      ),
    ).toThrow("INVALID_SCENARIO_AUDIT_LOG_MAX_ENTRIES");
  });

  it("normalizes AI defines", () => {
    expect(
      normalizeScenarioAiDefines(
        { enabled: false, maxCountriesPerTick: 25, maxDecisionCandidatesPerCountry: 12, contextCacheTtlTurns: 3, maxBuildCompletionTurns: 9 },
        baseAi,
      ),
    ).toEqual({
      enabled: false,
      maxCountriesPerTick: 25,
      maxDecisionCandidatesPerCountry: 12,
      contextCacheTtlTurns: 3,
      maxBuildCompletionTurns: 9,
    });
  });

  it("rejects invalid AI defines", () => {
    expect(() =>
      normalizeScenarioAiDefines(
        { maxCountriesPerTick: 0 },
        baseAi,
      ),
    ).toThrow("INVALID_SCENARIO_AI_MAX_COUNTRIES_PER_TICK");

    expect(() =>
      normalizeScenarioAiDefines(
        { enabled: "yes" },
        baseAi,
      ),
    ).toThrow("INVALID_SCENARIO_AI_ENABLED");

    expect(() =>
      normalizeScenarioAiDefines(
        { maxBuildCompletionTurns: 0 },
        baseAi,
      ),
    ).toThrow("INVALID_SCENARIO_AI_MAX_BUILD_COMPLETION_TURNS");
  });

  it("normalizes economy defines", () => {
    expect(
      normalizeScenarioEconomyDefines(
        {
          baseCulturePerTurn: 2,
          marketPriceSmoothing: 0.35,
          buildingDurabilityDecayPerTurn: 1.5,
          explorationDepletionPerAttemptPct: 8.25,
          explorationDurationTurns: 2,
        },
        baseEconomy,
        options,
      ),
    ).toMatchObject({
      baseCulturePerTurn: 2,
      baseSciencePerTurn: 1,
      marketPriceSmoothing: 0.35,
      buildingDurabilityDecayPerTurn: 1.5,
      explorationDepletionPerAttemptPct: 8.25,
      explorationDurationTurns: 2,
    });
  });

  it("rejects invalid economy defines", () => {
    expect(() =>
      normalizeScenarioEconomyDefines(
        { baseCulturePerTurn: 1.5 },
        baseEconomy,
        options,
      ),
    ).toThrow("INVALID_SCENARIO_ECONOMY_BASE_CULTURE");

    expect(() =>
      normalizeScenarioEconomyDefines(
        { marketPriceSmoothing: 2 },
        baseEconomy,
        options,
      ),
    ).toThrow("INVALID_SCENARIO_ECONOMY_MARKET_PRICE_SMOOTHING");
  });

  it("normalizes colonization and customization defines", () => {
    expect(
      normalizeScenarioColonizationDefines(
        {
          maxActiveColonizations: 4,
          pointsPerTurn: 45,
          pointsCostPer1000Km2: 6,
          ducatsCostPer1000Km2: 7,
          settlementEnabled: false,
          settlementPopulationOnCapture: 2_500,
        },
        baseColonization,
        options,
      ),
    ).toEqual({
      maxActiveColonizations: 4,
      pointsPerTurn: 45,
      pointsCostPer1000Km2: 6,
      ducatsCostPer1000Km2: 7,
      settlementEnabled: false,
      settlementPopulationOnCapture: 2_500,
      colonizerTurns: 2,
      colonizerCostColonization: 20,
      colonizerCostDucats: 10,
      colonizerMovementPoints: 2,
    });

    expect(
      normalizeScenarioCustomizationDefines(
        { renameDucats: 1, recolorDucats: 2, flagDucats: 3, crestDucats: 4, hexRenameDucats: 5 },
        baseCustomization,
        options,
      ),
    ).toEqual({ renameDucats: 1, recolorDucats: 2, flagDucats: 3, crestDucats: 4, hexRenameDucats: 5 });
  });

  it("rejects invalid colonization and customization defines", () => {
    expect(() =>
      normalizeScenarioColonizationDefines(
        { maxActiveColonizations: 0 },
        baseColonization,
        options,
      ),
    ).toThrow("INVALID_SCENARIO_COLONIZATION_MAX_ACTIVE");

    expect(() =>
      normalizeScenarioColonizationDefines(
        { settlementEnabled: "yes" },
        baseColonization,
        options,
      ),
    ).toThrow("INVALID_SCENARIO_COLONIZATION_SETTLEMENT_ENABLED");

    expect(() =>
      normalizeScenarioColonizationDefines(
        { settlementPopulationOnCapture: -1 },
        baseColonization,
        options,
      ),
    ).toThrow("INVALID_SCENARIO_COLONIZATION_SETTLEMENT_POPULATION");

    expect(() =>
      normalizeScenarioCustomizationDefines(
        { flagDucats: "free" },
        baseCustomization,
        options,
      ),
    ).toThrow("INVALID_SCENARIO_CUSTOMIZATION_FLAG_DUCATS");
  });

  it("normalizes military, registration, event log, and turn timer defines", () => {
    expect(
      normalizeScenarioMilitaryDefines(
        { militaryFormationSpeed: 12.5, landUnitStackLimitPerHex: 6 },
        baseMilitary,
        options,
      ),
    ).toEqual({ militaryFormationSpeed: 12.5, landUnitStackLimitPerHex: 6 });

    expect(
      normalizeScenarioRegistrationDefines(
        { requireAdminApproval: true },
        baseRegistration,
      ),
    ).toEqual({ requireAdminApproval: true });

    expect(
      normalizeScenarioEventLogDefines(
        { retentionTurns: 5 },
        baseEventLog,
      ),
    ).toEqual({ retentionTurns: 5 });

    expect(
      normalizeScenarioTurnTimerDefines(
        { enabled: false, secondsPerTurn: 120, pauseWhenNoPlayersOnline: true },
        baseTurnTimer,
      ),
    ).toEqual({ enabled: false, secondsPerTurn: 120, pauseWhenNoPlayersOnline: true });
  });

  it("rejects invalid military, registration, event log, and turn timer defines", () => {
    expect(() =>
      normalizeScenarioMilitaryDefines(
        { militaryFormationSpeed: 0 },
        baseMilitary,
        options,
      ),
    ).toThrow("INVALID_SCENARIO_MILITARY_FORMATION_SPEED");

    expect(() =>
      normalizeScenarioMilitaryDefines(
        { landUnitStackLimitPerHex: 0 },
        baseMilitary,
        options,
      ),
    ).toThrow("INVALID_SCENARIO_MILITARY_LAND_DIVISION_STACK_LIMIT");

    expect(() =>
      normalizeScenarioRegistrationDefines(
        { requireAdminApproval: "yes" },
        baseRegistration,
      ),
    ).toThrow("INVALID_SCENARIO_REGISTRATION_REQUIRE_ADMIN_APPROVAL");

    expect(() =>
      normalizeScenarioEventLogDefines(
        { retentionTurns: 0 },
        baseEventLog,
      ),
    ).toThrow("INVALID_SCENARIO_EVENT_LOG_RETENTION_TURNS");

    expect(() =>
      normalizeScenarioTurnTimerDefines(
        { secondsPerTurn: 5 },
        baseTurnTimer,
      ),
    ).toThrow("INVALID_SCENARIO_TURN_TIMER_SECONDS_PER_TURN");
  });

  it("merges scenario defines into game settings without mutating other settings", () => {
    const settings = {
      ai: baseAi,
      economy: baseEconomy,
      auditLog: baseAuditLog,
      colonization: baseColonization,
      customization: baseCustomization,
      military: baseMilitary,
      registration: baseRegistration,
      eventLog: baseEventLog,
      turnTimer: baseTurnTimer,
      resourceLedger: baseResourceLedger,
      content: { races: [] },
    };

    expect(
      applyScenarioDefinesToGameSettings(
        settings,
        {
          ai: { maxCountriesPerTick: 30, maxBuildCompletionTurns: 11 },
          economy: { baseGoldPerTurn: 12, marketPriceSmoothing: 0.4 },
          auditLog: { maxEntries: 25, retentionTurns: 4 },
          colonization: { pointsPerTurn: 60 },
          customization: { flagDucats: 0 },
          military: { militaryFormationSpeed: 15, landUnitStackLimitPerHex: 5 },
          registration: { requireAdminApproval: true },
          eventLog: { retentionTurns: 9 },
          turnTimer: { secondsPerTurn: 30 },
        },
        options,
      ),
    ).toMatchObject({
      ai: { maxCountriesPerTick: 30, enabled: true, maxBuildCompletionTurns: 11 },
      economy: { baseGoldPerTurn: 12, marketPriceSmoothing: 0.4, baseCulturePerTurn: 1 },
      auditLog: { maxEntries: 25, retentionTurns: 4 },
      colonization: { pointsPerTurn: 60, maxActiveColonizations: 3 },
      customization: { flagDucats: 0, renameDucats: 20 },
      military: { militaryFormationSpeed: 15, landUnitStackLimitPerHex: 5 },
      registration: { requireAdminApproval: true },
      eventLog: { retentionTurns: 9 },
      turnTimer: { secondsPerTurn: 30, enabled: true },
      content: { races: [] },
    });
  });
});

function makeTempScenarioDir(): string {
  return mkdtempSync(join(tmpdir(), "arcanorum-defines-"));
}
