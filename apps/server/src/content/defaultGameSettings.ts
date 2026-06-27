import { defaultCivilopediaCategories, defaultCivilopediaEntries } from "./civilopediaNormalizers";
import {
  DEFAULT_AIRCRAFT_TYPES,
  DEFAULT_EQUIPMENT_CLASSES,
  DEFAULT_EQUIPMENT_MODULES,
  DEFAULT_SHIP_TYPES,
  ensureDefaultBattalions,
  ensureDefaultCulture,
  ensureDefaultIdeology,
  ensureDefaultMilitaryContent,
  ensureDefaultRace,
  ensureDefaultReligion,
  ensureDefaultUnemployedProfession,
} from "./contentNormalizers";
import type { GameSettings } from "../runtime/gameSettingsTypes";

export type BuildDefaultGameSettingsParams = {
  defaultAdminAuditMaxEntries: number;
  buildingDurabilityDecayPerTurn: number;
  buildingDurabilityRecoveryPerTurn: number;
  explorationBaseEmptyChancePct: number;
  explorationDepletionPerAttemptPct: number;
  explorationDurationTurns: number;
  explorationRollsPerExpedition: number;
  maxActiveColonizations: number;
  colonizationPointsPerTurn: number;
};

export function buildDefaultGameSettings(params: BuildDefaultGameSettingsParams): GameSettings {
  const defaults: GameSettings = {
    content: {
      races: ensureDefaultRace([]),
      resourceCategories: [],
      hexTypes: [],
      hexClimates: [],
      hexLandscapes: [],
      hexContinents: [],
      hexStrategicRegions: [],
      professions: ensureDefaultUnemployedProfession([]),
      ideologies: ensureDefaultIdeology([]),
      interestGroups: [],
      parties: [],
      lawGroups: [],
      laws: [],
      religions: ensureDefaultReligion([]),
      technologies: [],
      buildings: [],
      goods: [],
      companies: [],
      industries: [],
      sectors: [],
      cultures: ensureDefaultCulture([]),
      modifiers: [],
      decisions: [],
      events: [],
      journalEntries: [],
      battalions: ensureDefaultBattalions([]),
      shipTypes: ensureDefaultMilitaryContent([], DEFAULT_SHIP_TYPES),
      aircraftTypes: ensureDefaultMilitaryContent([], DEFAULT_AIRCRAFT_TYPES),
      equipmentClasses: DEFAULT_EQUIPMENT_CLASSES,
      equipmentModules: DEFAULT_EQUIPMENT_MODULES,
    },
    ai: {
      enabled: true,
      maxCountriesPerTick: 50,
      maxDecisionCandidatesPerCountry: 20,
      contextCacheTtlTurns: 1,
      maxBuildCompletionTurns: 8,
    },
    civilopedia: {
      categories: defaultCivilopediaCategories(),
      entries: defaultCivilopediaEntries(),
    },
    economy: {
      baseCulturePerTurn: 1,
      baseSciencePerTurn: 1,
      baseReligionPerTurn: 1,
      baseConstructionPerTurn: 5,
      baseDucatsPerTurn: 5,
      baseGoldPerTurn: 10,
      demolitionCostConstructionPercent: 20,
      marketPriceSmoothing: 0.2,
      buildingDurabilityDecayPerTurn: params.buildingDurabilityDecayPerTurn,
      buildingDurabilityRecoveryPerTurn: params.buildingDurabilityRecoveryPerTurn,
      pollutionProductivityEffectPer1000: 0.1,
      explorationBaseEmptyChancePct: params.explorationBaseEmptyChancePct,
      explorationDepletionPerAttemptPct: params.explorationDepletionPerAttemptPct,
      explorationDurationTurns: params.explorationDurationTurns,
      explorationRollsPerExpedition: params.explorationRollsPerExpedition,
    },
    markets: {
      countryMarketByCountryId: {},
      marketById: {},
      transportCorridorsById: {},
      marketInvitesById: {},
      sanctionsById: {},
      infrastructureTransitAgreementsById: {},
      infrastructureConstructionRightsById: {},
    },
    colonization: {
      maxActiveColonizations: params.maxActiveColonizations,
      pointsPerTurn: params.colonizationPointsPerTurn,
      pointsCostPer1000Km2: 5,
      ducatsCostPer1000Km2: 5,
      settlementEnabled: true,
      settlementPopulationOnCapture: 1_000,
      colonizerTurns: 2,
      colonizerCostColonization: 20,
      colonizerCostDucats: 10,
      colonizerMovementPoints: 2,
    },
    customization: {
      renameDucats: 20,
      recolorDucats: 10,
      flagDucats: 15,
      crestDucats: 15,
      hexRenameDucats: 25,
    },
    military: {
      militaryFormationSpeed: 10,
    },
    registration: {
      requireAdminApproval: false,
    },
    eventLog: {
      retentionTurns: 3,
    },
    resourceLedger: {
      retentionTurns: 20,
      maxEntriesPerTurn: 10_000,
    },
    auditLog: {
      maxEntries: params.defaultAdminAuditMaxEntries,
      retentionTurns: null,
    },
    turnTimer: {
      enabled: true,
      secondsPerTurn: 86_400,
      pauseWhenNoPlayersOnline: false,
    },
    map: {
      showAntarctica: false,
      backgroundImageUrl: null,
    },
  };

  return defaults;
}
