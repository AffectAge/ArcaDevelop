import { defaultCivilopediaCategories, defaultCivilopediaEntries, normalizeCivilopediaCategories, normalizeCivilopediaEntries } from "./civilopediaNormalizers";
import {
  DEFAULT_AIRCRAFT_TYPES,
  DEFAULT_SHIP_TYPES,
  ensureDefaultBattalions,
  ensureDefaultCulture,
  ensureDefaultIdeology,
  ensureDefaultMilitaryContent,
  ensureDefaultRace,
  ensureDefaultReligion,
  ensureDefaultUnemployedProfession,
  normalizeContentAircraftTypes,
  normalizeContentBattalions,
  normalizeContentBuildings,
  normalizeContentCultures,
  normalizeContentGoods,
  normalizeContentRaces,
  normalizeContentShipTypes,
} from "./contentNormalizers";
import type { PersistedContentLibrary } from "../persistence/contentLibraryFile";
import type { GameSettings } from "../runtime/gameSettingsTypes";
import { normalizeContentLogoUrl } from "../uploads/uploadPaths";

export type BuildDefaultGameSettingsParams = {
  persistedContentLibrary: PersistedContentLibrary | null;
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
      provinceTypes: [],
      provinceClimates: [],
      provinceLandscapes: [],
      provinceContinents: [],
      provinceStrategicRegions: [],
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
      battalions: ensureDefaultBattalions([]),
      shipTypes: ensureDefaultMilitaryContent([], DEFAULT_SHIP_TYPES),
      aircraftTypes: ensureDefaultMilitaryContent([], DEFAULT_AIRCRAFT_TYPES),
    },
    ai: {
      enabled: true,
      maxCountriesPerTick: 50,
      maxDecisionCandidatesPerCountry: 20,
      contextCacheTtlTurns: 1,
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
    },
    customization: {
      renameDucats: 20,
      recolorDucats: 10,
      flagDucats: 15,
      crestDucats: 15,
      provinceRenameDucats: 25,
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
    resourceIcons: {
      population: null,
      culture: null,
      science: null,
      religion: null,
      colonization: null,
      construction: null,
      ducats: null,
      gold: null,
    },
  };

  const library = params.persistedContentLibrary;
  if (!library) {
    return defaults;
  }

  const civilopediaEntries = normalizeCivilopediaEntries(library.civilopedia?.entries);
  return {
    ...defaults,
    content: {
      races: ensureDefaultRace(normalizeContentRaces((library.content as { races?: unknown } | undefined)?.races)),
      resourceCategories: normalizeContentCultures(
        (library.content as { resourceCategories?: unknown } | undefined)?.resourceCategories,
      ).map((entry) => ({
        ...entry,
        logoUrl: normalizeContentLogoUrl("resourceCategories", entry.logoUrl),
      })),
      provinceTypes: normalizeContentCultures((library.content as { provinceTypes?: unknown } | undefined)?.provinceTypes),
      provinceClimates: normalizeContentCultures((library.content as { provinceClimates?: unknown } | undefined)?.provinceClimates),
      provinceLandscapes: normalizeContentCultures((library.content as { provinceLandscapes?: unknown } | undefined)?.provinceLandscapes),
      provinceContinents: normalizeContentCultures((library.content as { provinceContinents?: unknown } | undefined)?.provinceContinents),
      provinceStrategicRegions: normalizeContentCultures((library.content as { provinceStrategicRegions?: unknown } | undefined)?.provinceStrategicRegions),
      professions: ensureDefaultUnemployedProfession(
        normalizeContentCultures((library.content as { professions?: unknown } | undefined)?.professions),
      ),
      ideologies: ensureDefaultIdeology(
        normalizeContentCultures((library.content as { ideologies?: unknown } | undefined)?.ideologies),
      ),
      interestGroups: normalizeContentCultures((library.content as { interestGroups?: unknown } | undefined)?.interestGroups),
      parties: normalizeContentCultures((library.content as { parties?: unknown } | undefined)?.parties),
      lawGroups: normalizeContentCultures((library.content as { lawGroups?: unknown } | undefined)?.lawGroups),
      laws: normalizeContentCultures((library.content as { laws?: unknown } | undefined)?.laws),
      religions: ensureDefaultReligion(
        normalizeContentCultures((library.content as { religions?: unknown } | undefined)?.religions),
      ),
      technologies: normalizeContentCultures((library.content as { technologies?: unknown } | undefined)?.technologies),
      buildings: normalizeContentBuildings((library.content as { buildings?: unknown } | undefined)?.buildings),
      goods: normalizeContentGoods((library.content as { goods?: unknown } | undefined)?.goods),
      companies: normalizeContentCultures((library.content as { companies?: unknown } | undefined)?.companies),
      industries: normalizeContentCultures((library.content as { industries?: unknown } | undefined)?.industries),
      sectors: normalizeContentCultures((library.content as { sectors?: unknown } | undefined)?.sectors),
      cultures: ensureDefaultCulture(normalizeContentCultures((library.content as { cultures?: unknown } | undefined)?.cultures)),
      modifiers: normalizeContentCultures((library.content as { modifiers?: unknown } | undefined)?.modifiers),
      decisions: normalizeContentCultures((library.content as { decisions?: unknown } | undefined)?.decisions),
      events: normalizeContentCultures((library.content as { events?: unknown } | undefined)?.events),
      battalions: normalizeContentBattalions((library.content as { battalions?: unknown } | undefined)?.battalions),
      shipTypes: normalizeContentShipTypes((library.content as { shipTypes?: unknown } | undefined)?.shipTypes),
      aircraftTypes: normalizeContentAircraftTypes((library.content as { aircraftTypes?: unknown } | undefined)?.aircraftTypes),
    },
    ai: {
      enabled: true,
      maxCountriesPerTick: 50,
      maxDecisionCandidatesPerCountry: 20,
      contextCacheTtlTurns: 1,
    },
    civilopedia: {
      categories: normalizeCivilopediaCategories(library.civilopedia?.categories, civilopediaEntries),
      entries: civilopediaEntries,
    },
    map: {
      ...defaults.map,
      backgroundImageUrl:
        typeof library.map?.backgroundImageUrl === "string" || library.map?.backgroundImageUrl === null
          ? (library.map.backgroundImageUrl ?? null)
          : defaults.map.backgroundImageUrl,
    },
    resourceIcons: {
      population:
        typeof library.resourceIcons?.population === "string" || library.resourceIcons?.population === null
          ? (library.resourceIcons.population ?? null)
          : defaults.resourceIcons.population,
      culture:
        typeof library.resourceIcons?.culture === "string" || library.resourceIcons?.culture === null
          ? (library.resourceIcons.culture ?? null)
          : defaults.resourceIcons.culture,
      science:
        typeof library.resourceIcons?.science === "string" || library.resourceIcons?.science === null
          ? (library.resourceIcons.science ?? null)
          : defaults.resourceIcons.science,
      religion:
        typeof library.resourceIcons?.religion === "string" || library.resourceIcons?.religion === null
          ? (library.resourceIcons.religion ?? null)
          : defaults.resourceIcons.religion,
      colonization:
        typeof library.resourceIcons?.colonization === "string" || library.resourceIcons?.colonization === null
          ? (library.resourceIcons.colonization ?? null)
          : defaults.resourceIcons.colonization,
      construction:
        typeof library.resourceIcons?.construction === "string" || library.resourceIcons?.construction === null
          ? (library.resourceIcons.construction ?? null)
          : defaults.resourceIcons.construction,
      ducats:
        typeof library.resourceIcons?.ducats === "string" || library.resourceIcons?.ducats === null
          ? (library.resourceIcons.ducats ?? null)
          : defaults.resourceIcons.ducats,
      gold:
        typeof library.resourceIcons?.gold === "string" || library.resourceIcons?.gold === null
          ? (library.resourceIcons.gold ?? null)
          : defaults.resourceIcons.gold,
    },
  };
}
