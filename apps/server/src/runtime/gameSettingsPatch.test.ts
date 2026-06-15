import { describe, expect, it } from "vitest";
import { applyGameSettingsPatch, type PatchableGameSettings } from "./gameSettingsPatch";

describe("gameSettingsPatch", () => {
  it("applies economy, customization, registration, and market normalizer patches", () => {
    const settings = makeSettings();

    const result = applyGameSettingsPatch({
      settings,
      patch: {
        economy: { baseCulturePerTurn: 7, marketPriceSmoothing: 0.25 },
        markets: {
          countryMarketByCountryId: { "country:a": " main ", "country:b": "" },
          sanctionsById: { raw: true },
        },
        customization: { flagDucats: 11 },
        registration: { requireAdminApproval: false },
      },
      normalizeMarketId: (input) => (typeof input === "string" && input.trim() ? `market:${input.trim()}` : null),
      normalizeMarketSanctionsMap: () => ({ normalized: "sanctions" }),
      normalizeInfrastructureTransitAgreementsMap: () => ({ normalized: "transit" }),
      normalizeInfrastructureConstructionRightsMap: () => ({ normalized: "construction" }),
    });

    expect(settings.economy.baseCulturePerTurn).toBe(7);
    expect(settings.economy.marketPriceSmoothing).toBe(0.25);
    expect(settings.markets.countryMarketByCountryId).toEqual({ "country:a": "market:main" });
    expect(settings.markets.sanctionsById).toEqual({ normalized: "sanctions" });
    expect(settings.customization.flagDucats).toBe(11);
    expect(settings.registration.requireAdminApproval).toBe(false);
    expect(result.changedSections).toEqual(["экономика", "рынки", "кастомизация"]);
  });

  it("reports colonization price formula changes with previous values", () => {
    const settings = makeSettings();

    const result = applyGameSettingsPatch({
      settings,
      patch: { colonization: { pointsCostPer1000Km2: 9, ducatsCostPer1000Km2: 4 } },
      normalizeMarketId: () => null,
      normalizeMarketSanctionsMap: () => ({}),
      normalizeInfrastructureTransitAgreementsMap: () => ({}),
      normalizeInfrastructureConstructionRightsMap: () => ({}),
    });

    expect(settings.colonization.pointsCostPer1000Km2).toBe(9);
    expect(settings.colonization.ducatsCostPer1000Km2).toBe(4);
    expect(result.colonizationPriceFormulaChanged).toBe(true);
    expect(result.previousColonizationCostPer1000Km2).toEqual({
      pointsCostPer1000Km2: 5,
      ducatsCostPer1000Km2: 2,
    });
  });

  it("reports timer reset need and background image cleanup without doing side effects", () => {
    const settings = makeSettings();

    const result = applyGameSettingsPatch({
      settings,
      patch: {
        turnTimer: { enabled: false, secondsPerTurn: 5, pauseWhenNoPlayersOnline: true },
        map: { showAntarctica: true, backgroundImageUrl: null },
      },
      normalizeMarketId: () => null,
      normalizeMarketSanctionsMap: () => ({}),
      normalizeInfrastructureTransitAgreementsMap: () => ({}),
      normalizeInfrastructureConstructionRightsMap: () => ({}),
    });

    expect(settings.turnTimer.enabled).toBe(false);
    expect(settings.turnTimer.secondsPerTurn).toBe(10);
    expect(settings.turnTimer.pauseWhenNoPlayersOnline).toBe(true);
    expect(settings.map.showAntarctica).toBe(true);
    expect(settings.map.backgroundImageUrl).toBeNull();
    expect(result.turnTimerConfigChanged).toBe(true);
    expect(result.backgroundImageUrlToRemove).toBe("/scenario-assets/demo/assets/uploads/bg.png");
    expect(result.changedSections).toEqual(["таймер хода", "карта"]);
  });
});

function makeSettings(): PatchableGameSettings {
  return {
    economy: {
      baseCulturePerTurn: 1,
      baseSciencePerTurn: 1,
      baseReligionPerTurn: 1,
      baseConstructionPerTurn: 1,
      baseDucatsPerTurn: 1,
      baseGoldPerTurn: 1,
      demolitionCostConstructionPercent: 20,
      marketPriceSmoothing: 0.5,
      buildingDurabilityDecayPerTurn: 1,
      buildingDurabilityRecoveryPerTurn: 1,
      pollutionProductivityEffectPer1000: 1,
      explorationBaseEmptyChancePct: 10,
      explorationDepletionPerAttemptPct: 5,
      explorationDurationTurns: 2,
      explorationRollsPerExpedition: 1,
    },
    markets: {
      countryMarketByCountryId: {},
      sanctionsById: {},
      infrastructureTransitAgreementsById: {},
      infrastructureConstructionRightsById: {},
    },
    colonization: {
      maxActiveColonizations: 3,
      pointsPerTurn: 1,
      pointsCostPer1000Km2: 5,
      ducatsCostPer1000Km2: 2,
    },
    customization: {
      renameDucats: 1,
      recolorDucats: 1,
      flagDucats: 1,
      crestDucats: 1,
      provinceRenameDucats: 1,
    },
    registration: {
      requireAdminApproval: true,
    },
    eventLog: {
      retentionTurns: 10,
    },
    turnTimer: {
      enabled: true,
      secondsPerTurn: 60,
      pauseWhenNoPlayersOnline: false,
    },
    map: {
      showAntarctica: false,
      backgroundImageUrl: "/scenario-assets/demo/assets/uploads/bg.png",
    },
  };
}
