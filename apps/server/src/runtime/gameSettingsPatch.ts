import type { GameSettingsPatchInput } from "../routes/adminGameSettingsRoutes";

export type PatchableGameSettings = {
  economy: {
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
  markets: {
    countryMarketByCountryId: Record<string, string>;
    sanctionsById: Record<string, unknown>;
    infrastructureTransitAgreementsById: Record<string, unknown>;
    infrastructureConstructionRightsById: Record<string, unknown>;
  };
  colonization: {
    maxActiveColonizations: number;
    pointsPerTurn: number;
    pointsCostPer1000Km2: number;
    ducatsCostPer1000Km2: number;
    settlementEnabled: boolean;
    settlementPopulationOnCapture: number;
  };
  customization: {
    renameDucats: number;
    recolorDucats: number;
    flagDucats: number;
    crestDucats: number;
    hexRenameDucats: number;
  };
  registration: {
    requireAdminApproval: boolean;
  };
  eventLog: {
    retentionTurns: number;
  };
  turnTimer: {
    enabled: boolean;
    secondsPerTurn: number;
    pauseWhenNoPlayersOnline: boolean;
  };
  map: {
    showAntarctica: boolean;
    backgroundImageUrl: string | null;
  };
};

export type GameSettingsPatchResult = {
  changedSections: string[];
  colonizationPriceFormulaChanged: boolean;
  previousColonizationCostPer1000Km2: {
    pointsCostPer1000Km2: number;
    ducatsCostPer1000Km2: number;
  } | null;
  turnTimerConfigChanged: boolean;
  backgroundImageUrlToRemove: string | null;
};

export function applyGameSettingsPatch(params: {
  settings: PatchableGameSettings;
  patch: GameSettingsPatchInput;
  normalizeMarketId: (input: unknown) => string | null;
  normalizeMarketSanctionsMap: (input: unknown) => Record<string, unknown>;
  normalizeInfrastructureTransitAgreementsMap: (input: unknown) => Record<string, unknown>;
  normalizeInfrastructureConstructionRightsMap: (input: unknown) => Record<string, unknown>;
}): GameSettingsPatchResult {
  const { settings, patch } = params;

  applyEconomyPatch(settings, patch.economy);
  applyMarketsPatch(settings, patch.markets, params);

  const colonizationResult = applyColonizationPatch(settings, patch.colonization);
  applyCustomizationPatch(settings, patch.customization);
  applyRegistrationPatch(settings, patch.registration);
  applyEventLogPatch(settings, patch.eventLog);
  const turnTimerConfigChanged = applyTurnTimerPatch(settings, patch.turnTimer);
  const backgroundImageUrlToRemove = applyMapPatch(settings, patch.map);

  return {
    changedSections: getChangedSections(patch),
    colonizationPriceFormulaChanged: colonizationResult.priceFormulaChanged,
    previousColonizationCostPer1000Km2: colonizationResult.previousCostPer1000Km2,
    turnTimerConfigChanged,
    backgroundImageUrlToRemove,
  };
}

function applyEconomyPatch(settings: PatchableGameSettings, economy: GameSettingsPatchInput["economy"]): void {
  if (!economy) return;
  assignNumberIfPresent(economy, "baseCulturePerTurn", settings.economy);
  assignNumberIfPresent(economy, "baseSciencePerTurn", settings.economy);
  assignNumberIfPresent(economy, "baseReligionPerTurn", settings.economy);
  assignNumberIfPresent(economy, "baseConstructionPerTurn", settings.economy);
  assignNumberIfPresent(economy, "baseDucatsPerTurn", settings.economy);
  assignNumberIfPresent(economy, "baseGoldPerTurn", settings.economy);
  assignNumberIfPresent(economy, "demolitionCostConstructionPercent", settings.economy);
  assignNumberIfPresent(economy, "marketPriceSmoothing", settings.economy);
  assignNumberIfPresent(economy, "buildingDurabilityDecayPerTurn", settings.economy);
  assignNumberIfPresent(economy, "buildingDurabilityRecoveryPerTurn", settings.economy);
  assignNumberIfPresent(economy, "pollutionProductivityEffectPer1000", settings.economy);
  assignNumberIfPresent(economy, "explorationBaseEmptyChancePct", settings.economy);
  assignNumberIfPresent(economy, "explorationDepletionPerAttemptPct", settings.economy);
  assignNumberIfPresent(economy, "explorationDurationTurns", settings.economy);
  assignNumberIfPresent(economy, "explorationRollsPerExpedition", settings.economy);
}

function applyMarketsPatch(
  settings: PatchableGameSettings,
  markets: GameSettingsPatchInput["markets"],
  normalizers: Pick<
    Parameters<typeof applyGameSettingsPatch>[0],
    | "normalizeMarketId"
    | "normalizeMarketSanctionsMap"
    | "normalizeInfrastructureTransitAgreementsMap"
    | "normalizeInfrastructureConstructionRightsMap"
  >,
): void {
  if (markets?.countryMarketByCountryId && typeof markets.countryMarketByCountryId === "object") {
    settings.markets.countryMarketByCountryId = Object.fromEntries(
      Object.entries(markets.countryMarketByCountryId)
        .map(([countryId, marketId]) => [countryId, normalizers.normalizeMarketId(marketId)])
        .filter((row): row is [string, string] => Boolean(row[0] && row[1])),
    );
  }
  if (markets?.sanctionsById && typeof markets.sanctionsById === "object") {
    settings.markets.sanctionsById = normalizers.normalizeMarketSanctionsMap(markets.sanctionsById);
  }
  if (markets?.infrastructureTransitAgreementsById && typeof markets.infrastructureTransitAgreementsById === "object") {
    settings.markets.infrastructureTransitAgreementsById = normalizers.normalizeInfrastructureTransitAgreementsMap(
      markets.infrastructureTransitAgreementsById,
    );
  }
  if (
    markets?.infrastructureConstructionRightsById &&
    typeof markets.infrastructureConstructionRightsById === "object"
  ) {
    settings.markets.infrastructureConstructionRightsById = normalizers.normalizeInfrastructureConstructionRightsMap(
      markets.infrastructureConstructionRightsById,
    );
  }
}

function applyColonizationPatch(
  settings: PatchableGameSettings,
  colonization: GameSettingsPatchInput["colonization"],
): {
  priceFormulaChanged: boolean;
  previousCostPer1000Km2: GameSettingsPatchResult["previousColonizationCostPer1000Km2"];
} {
  if (!colonization) {
    return { priceFormulaChanged: false, previousCostPer1000Km2: null };
  }
  const previousCostPer1000Km2 = {
    pointsCostPer1000Km2: settings.colonization.pointsCostPer1000Km2,
    ducatsCostPer1000Km2: settings.colonization.ducatsCostPer1000Km2,
  };
  assignNumberIfPresent(colonization, "maxActiveColonizations", settings.colonization);
  assignNumberIfPresent(colonization, "pointsPerTurn", settings.colonization);
  assignNumberIfPresent(colonization, "pointsCostPer1000Km2", settings.colonization);
  assignNumberIfPresent(colonization, "ducatsCostPer1000Km2", settings.colonization);
  if (typeof colonization.settlementEnabled === "boolean") {
    settings.colonization.settlementEnabled = colonization.settlementEnabled;
  }
  assignNumberIfPresent(colonization, "settlementPopulationOnCapture", settings.colonization);
  const priceFormulaChanged =
    previousCostPer1000Km2.pointsCostPer1000Km2 !== settings.colonization.pointsCostPer1000Km2 ||
    previousCostPer1000Km2.ducatsCostPer1000Km2 !== settings.colonization.ducatsCostPer1000Km2;
  return { priceFormulaChanged, previousCostPer1000Km2 };
}

function applyCustomizationPatch(settings: PatchableGameSettings, customization: GameSettingsPatchInput["customization"]): void {
  if (!customization) return;
  assignNumberIfPresent(customization, "renameDucats", settings.customization);
  assignNumberIfPresent(customization, "recolorDucats", settings.customization);
  assignNumberIfPresent(customization, "flagDucats", settings.customization);
  assignNumberIfPresent(customization, "crestDucats", settings.customization);
  assignNumberIfPresent(customization, "hexRenameDucats", settings.customization);
}

function applyRegistrationPatch(settings: PatchableGameSettings, registration: GameSettingsPatchInput["registration"]): void {
  if (typeof registration?.requireAdminApproval === "boolean") {
    settings.registration.requireAdminApproval = registration.requireAdminApproval;
  }
}

function applyEventLogPatch(settings: PatchableGameSettings, eventLog: GameSettingsPatchInput["eventLog"]): void {
  assignNumberIfPresent(eventLog, "retentionTurns", settings.eventLog);
}

function applyTurnTimerPatch(settings: PatchableGameSettings, turnTimer: GameSettingsPatchInput["turnTimer"]): boolean {
  let changed = false;
  if (!turnTimer) return false;
  if (typeof turnTimer.enabled === "boolean") {
    if (settings.turnTimer.enabled !== turnTimer.enabled) changed = true;
    settings.turnTimer.enabled = turnTimer.enabled;
  }
  if (typeof turnTimer.secondsPerTurn === "number") {
    const nextSeconds = Math.max(10, Math.floor(turnTimer.secondsPerTurn));
    if (settings.turnTimer.secondsPerTurn !== nextSeconds) changed = true;
    settings.turnTimer.secondsPerTurn = nextSeconds;
  }
  if (typeof turnTimer.pauseWhenNoPlayersOnline === "boolean") {
    settings.turnTimer.pauseWhenNoPlayersOnline = turnTimer.pauseWhenNoPlayersOnline;
  }
  return changed;
}

function applyMapPatch(settings: PatchableGameSettings, map: GameSettingsPatchInput["map"]): string | null {
  let backgroundImageUrlToRemove: string | null = null;
  if (!map) return null;
  if (typeof map.showAntarctica === "boolean") {
    settings.map.showAntarctica = map.showAntarctica;
  }
  if (map.backgroundImageUrl === null) {
    backgroundImageUrlToRemove = settings.map.backgroundImageUrl;
    settings.map.backgroundImageUrl = null;
  } else if (typeof map.backgroundImageUrl === "string") {
    settings.map.backgroundImageUrl = map.backgroundImageUrl;
  }
  return backgroundImageUrlToRemove;
}

function getChangedSections(patch: GameSettingsPatchInput): string[] {
  return [
    patch.economy ? "экономика" : null,
    patch.markets ? "рынки" : null,
    patch.colonization ? "колонизация" : null,
    patch.customization ? "кастомизация" : null,
    patch.eventLog ? "журнал событий" : null,
    patch.turnTimer ? "таймер хода" : null,
    patch.map ? "карта" : null,
  ].filter((value): value is string => Boolean(value));
}

function assignNumberIfPresent<T extends object>(
  source: Record<string, unknown> | null | undefined,
  key: keyof T & string,
  target: T,
): void {
  if (typeof source?.[key] === "number") {
    Object.assign(target, { [key]: source[key] });
  }
}
