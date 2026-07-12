import { HARD_MAX_ADMIN_AUDIT_LOG } from "../security/adminAuditLog";
import { normalizeCivilopediaCategories, normalizeCivilopediaEntries } from "../content/civilopediaNormalizers";
import {
  ensureDefaultReligion,
  normalizeContentAssets,
  normalizeContentBuildings,
  normalizeContentCultures,
  normalizeContentGoods,
  normalizeContentRaces,
  normalizeContentUnitSkills,
  normalizeContentUnitSkillTrees,
  normalizeContentUnitTypes,
} from "../content/contentNormalizers";
import { normalizeTransportMode } from "../mechanics/marketTurnMechanics";
import { getTransportCorridorBuildCost } from "./marketSettingsNormalizers";
import {
  normalizeCategoryAmountMap,
  normalizeCorridorForeignConstructionRights,
  normalizeCountryResourceTradePolicyMap,
  normalizeInfrastructureConstructionRightsMap,
  normalizeInfrastructureTransitAgreementsMap,
  normalizeMarketId,
  normalizeMarketSanctionsMap,
  normalizeMarketTradePolicyMap,
  normalizeMarketVisibility,
  normalizeNumberHistoryMap,
  normalizeNumberMap,
  normalizeHexIdList,
  normalizeTransportCorridorRoutePoints,
  normalizeTransportCorridorStatus,
} from "./marketSettingsNormalizers";
import type { GameSettings, TransportCorridorEntry } from "./gameSettingsTypes";
import { normalizeContentLogoUrl } from "../uploads/uploadPaths";

type RestorePersistedGameSettingsParams = {
  input: unknown;
  defaults: GameSettings;
  turnId: number;
  corridorLoadHistoryLength: number;
  round3: (value: number) => number;
};

export function restorePersistedGameSettings(params: RestorePersistedGameSettingsParams): GameSettings {
  const next = params.input as Partial<GameSettings>;
  const defaults = params.defaults;
  const civilopediaEntries = normalizeCivilopediaEntries(
    (next as Partial<{ civilopedia?: { entries?: unknown } }>).civilopedia?.entries,
  );

  return {
    content: {
      assets: normalizeContentAssets((next as Partial<{ content?: { assets?: unknown } }>).content?.assets),
      races: normalizeContentRaces((next as Partial<{ content?: { races?: unknown } }>).content?.races),
      cultureGroups: normalizeContentCultures((next as Partial<{ content?: { cultureGroups?: unknown } }>).content?.cultureGroups),
      religionGroups: normalizeContentCultures((next as Partial<{ content?: { religionGroups?: unknown } }>).content?.religionGroups),
      resourceCategories: normalizeContentCultures(
        (next as Partial<{ content?: { resourceCategories?: unknown } }>).content?.resourceCategories,
      ).map((entry) => ({
        ...entry,
        logoUrl: normalizeContentLogoUrl("resourceCategories", entry.logoUrl),
      })),
      hexTypes: normalizeContentCultures((next as Partial<{ content?: { hexTypes?: unknown } }>).content?.hexTypes),
      hexClimates: normalizeContentCultures((next as Partial<{ content?: { hexClimates?: unknown } }>).content?.hexClimates),
      hexLandscapes: normalizeContentCultures((next as Partial<{ content?: { hexLandscapes?: unknown } }>).content?.hexLandscapes),
      hexContinents: normalizeContentCultures((next as Partial<{ content?: { hexContinents?: unknown } }>).content?.hexContinents),
      hexStrategicRegions: normalizeContentCultures(
        (next as Partial<{ content?: { hexStrategicRegions?: unknown } }>).content?.hexStrategicRegions,
      ),
      professions: normalizeContentCultures((next as Partial<{ content?: { professions?: unknown } }>).content?.professions),
      ideologies: normalizeContentCultures((next as Partial<{ content?: { ideologies?: unknown } }>).content?.ideologies),
      interestGroups: normalizeContentCultures((next as Partial<{ content?: { interestGroups?: unknown } }>).content?.interestGroups),
      parties: normalizeContentCultures((next as Partial<{ content?: { parties?: unknown } }>).content?.parties),
      lawGroups: normalizeContentCultures((next as Partial<{ content?: { lawGroups?: unknown } }>).content?.lawGroups),
      laws: normalizeContentCultures((next as Partial<{ content?: { laws?: unknown } }>).content?.laws),
      religions: ensureDefaultReligion(
        normalizeContentCultures((next as Partial<{ content?: { religions?: unknown } }>).content?.religions),
      ),
      technologies: normalizeContentCultures((next as Partial<{ content?: { technologies?: unknown } }>).content?.technologies),
      buildings: normalizeContentBuildings((next as Partial<{ content?: { buildings?: unknown } }>).content?.buildings),
      goods: normalizeContentGoods((next as Partial<{ content?: { goods?: unknown } }>).content?.goods),
      companies: normalizeContentCultures((next as Partial<{ content?: { companies?: unknown } }>).content?.companies),
      industries: normalizeContentCultures((next as Partial<{ content?: { industries?: unknown } }>).content?.industries),
      sectors: normalizeContentCultures((next as Partial<{ content?: { sectors?: unknown } }>).content?.sectors),
      cultures: normalizeContentCultures((next as Partial<{ content?: { cultures?: unknown } }>).content?.cultures),
      modifiers: normalizeContentCultures((next as Partial<{ content?: { modifiers?: unknown } }>).content?.modifiers),
      decisions: normalizeContentCultures((next as Partial<{ content?: { decisions?: unknown } }>).content?.decisions),
      events: normalizeContentCultures((next as Partial<{ content?: { events?: unknown } }>).content?.events),
      journalEntries: normalizeContentCultures((next as Partial<{ content?: { journalEntries?: unknown } }>).content?.journalEntries),
      unitSkills: normalizeContentUnitSkills((next as Partial<{ content?: { unitSkills?: unknown } }>).content?.unitSkills),
      unitSkillTrees: normalizeContentUnitSkillTrees((next as Partial<{ content?: { unitSkillTrees?: unknown } }>).content?.unitSkillTrees),
      unitTypes: normalizeContentUnitTypes((next as Partial<{ content?: { unitTypes?: unknown } }>).content?.unitTypes),
    },
    ai: restoreAi(next, defaults),
    civilopedia: {
      categories: normalizeCivilopediaCategories(
        (next as Partial<{ civilopedia?: { categories?: unknown } }>).civilopedia?.categories,
        civilopediaEntries,
      ),
      entries: civilopediaEntries,
    },
    economy: restoreEconomy(next, defaults),
    markets: restoreMarkets(next, defaults, params),
    colonization: {
      maxActiveColonizations:
        typeof next.colonization?.maxActiveColonizations === "number"
          ? Math.max(1, Math.floor(next.colonization.maxActiveColonizations))
          : defaults.colonization.maxActiveColonizations,
      pointsPerTurn:
        typeof next.colonization?.pointsPerTurn === "number"
          ? Math.max(0, Math.floor(next.colonization.pointsPerTurn))
          : defaults.colonization.pointsPerTurn,
      pointsCostPer1000Km2:
        typeof next.colonization?.pointsCostPer1000Km2 === "number"
          ? Math.max(1, Math.floor(next.colonization.pointsCostPer1000Km2))
          : defaults.colonization.pointsCostPer1000Km2,
      ducatsCostPer1000Km2:
        typeof next.colonization?.ducatsCostPer1000Km2 === "number"
          ? Math.max(0, Math.floor(next.colonization.ducatsCostPer1000Km2))
          : defaults.colonization.ducatsCostPer1000Km2,
      settlementEnabled:
        typeof next.colonization?.settlementEnabled === "boolean"
          ? next.colonization.settlementEnabled
          : defaults.colonization.settlementEnabled,
      settlementPopulationOnCapture:
        typeof next.colonization?.settlementPopulationOnCapture === "number"
          ? Math.max(0, Math.min(1_000_000_000, Math.floor(next.colonization.settlementPopulationOnCapture)))
          : defaults.colonization.settlementPopulationOnCapture,
      colonizerTurns:
        typeof next.colonization?.colonizerTurns === "number"
          ? Math.max(1, Math.min(3_650, Math.floor(next.colonization.colonizerTurns)))
          : defaults.colonization.colonizerTurns,
      colonizerCostColonization:
        typeof next.colonization?.colonizerCostColonization === "number"
          ? Math.max(0, Math.floor(next.colonization.colonizerCostColonization))
          : defaults.colonization.colonizerCostColonization,
      colonizerCostDucats:
        typeof next.colonization?.colonizerCostDucats === "number"
          ? Math.max(0, Math.floor(next.colonization.colonizerCostDucats))
          : defaults.colonization.colonizerCostDucats,
      colonizerMovementPoints:
        typeof next.colonization?.colonizerMovementPoints === "number"
          ? Math.max(1, Math.min(100, Math.floor(next.colonization.colonizerMovementPoints)))
          : defaults.colonization.colonizerMovementPoints,
    },
    customization: {
      renameDucats: numberOrDefault(next.customization?.renameDucats, defaults.customization.renameDucats),
      recolorDucats: numberOrDefault(next.customization?.recolorDucats, defaults.customization.recolorDucats),
      flagDucats: numberOrDefault(next.customization?.flagDucats, defaults.customization.flagDucats),
      crestDucats: numberOrDefault(next.customization?.crestDucats, defaults.customization.crestDucats),
      hexRenameDucats: numberOrDefault(
        next.customization?.hexRenameDucats,
        defaults.customization.hexRenameDucats,
      ),
    },
    military: {
      militaryFormationSpeed:
        typeof (next as Partial<{ military?: { militaryFormationSpeed?: unknown } }>).military?.militaryFormationSpeed === "number" &&
        Number.isFinite((next as Partial<{ military?: { militaryFormationSpeed?: number } }>).military?.militaryFormationSpeed)
          ? Math.max(1, Number(((next as Partial<{ military?: { militaryFormationSpeed?: number } }>).military?.militaryFormationSpeed ?? 10).toFixed(3)))
          : defaults.military.militaryFormationSpeed,
      landUnitStackLimitPerHex:
        typeof (next as Partial<{ military?: { landUnitStackLimitPerHex?: unknown } }>).military?.landUnitStackLimitPerHex === "number" &&
        Number.isFinite((next as Partial<{ military?: { landUnitStackLimitPerHex?: number } }>).military?.landUnitStackLimitPerHex)
          ? Math.max(1, Math.min(100, Math.floor((next as Partial<{ military?: { landUnitStackLimitPerHex?: number } }>).military?.landUnitStackLimitPerHex ?? 4)))
          : defaults.military.landUnitStackLimitPerHex,
    },
    registration: {
      requireAdminApproval:
        typeof (next as Partial<{ registration?: { requireAdminApproval?: unknown } }>).registration?.requireAdminApproval === "boolean"
          ? Boolean((next as Partial<{ registration?: { requireAdminApproval?: boolean } }>).registration?.requireAdminApproval)
          : defaults.registration.requireAdminApproval,
    },
    eventLog: {
      retentionTurns:
        typeof next.eventLog?.retentionTurns === "number"
          ? Math.max(1, Math.floor(next.eventLog.retentionTurns))
          : defaults.eventLog.retentionTurns,
    },
    resourceLedger: {
      retentionTurns:
        typeof next.resourceLedger?.retentionTurns === "number"
          ? Math.max(1, Math.min(3_650, Math.floor(next.resourceLedger.retentionTurns)))
          : defaults.resourceLedger.retentionTurns,
      maxEntriesPerTurn:
        typeof next.resourceLedger?.maxEntriesPerTurn === "number"
          ? Math.max(1, Math.min(100_000, Math.floor(next.resourceLedger.maxEntriesPerTurn)))
          : defaults.resourceLedger.maxEntriesPerTurn,
    },
    auditLog: restoreAuditLog(next, defaults),
    turnTimer: restoreTurnTimer(next, defaults),
    map: {
      showAntarctica: typeof next.map?.showAntarctica === "boolean" ? next.map.showAntarctica : defaults.map.showAntarctica,
      backgroundImageUrl:
        typeof next.map?.backgroundImageUrl === "string" || next.map?.backgroundImageUrl === null
          ? (next.map?.backgroundImageUrl ?? null)
          : defaults.map.backgroundImageUrl,
    },
  };
}

function restoreAi(next: Partial<GameSettings>, defaults: GameSettings): GameSettings["ai"] {
  return {
    enabled: typeof next.ai?.enabled === "boolean" ? next.ai.enabled : defaults.ai.enabled,
    maxCountriesPerTick:
      typeof next.ai?.maxCountriesPerTick === "number" && Number.isFinite(next.ai.maxCountriesPerTick)
        ? Math.max(1, Math.min(1_000, Math.floor(next.ai.maxCountriesPerTick)))
        : defaults.ai.maxCountriesPerTick,
    maxDecisionCandidatesPerCountry:
      typeof next.ai?.maxDecisionCandidatesPerCountry === "number" && Number.isFinite(next.ai.maxDecisionCandidatesPerCountry)
        ? Math.max(1, Math.min(1_000, Math.floor(next.ai.maxDecisionCandidatesPerCountry)))
        : defaults.ai.maxDecisionCandidatesPerCountry,
    contextCacheTtlTurns:
      typeof next.ai?.contextCacheTtlTurns === "number" && Number.isFinite(next.ai.contextCacheTtlTurns)
        ? Math.max(1, Math.min(100, Math.floor(next.ai.contextCacheTtlTurns)))
        : defaults.ai.contextCacheTtlTurns,
    maxBuildCompletionTurns:
      typeof next.ai?.maxBuildCompletionTurns === "number" && Number.isFinite(next.ai.maxBuildCompletionTurns)
        ? Math.max(1, Math.min(3_650, Math.floor(next.ai.maxBuildCompletionTurns)))
        : defaults.ai.maxBuildCompletionTurns,
  };
}

function restoreEconomy(next: Partial<GameSettings>, defaults: GameSettings): GameSettings["economy"] {
  return {
    baseCulturePerTurn: numberOrDefault(next.economy?.baseCulturePerTurn, defaults.economy.baseCulturePerTurn),
    baseSciencePerTurn: numberOrDefault(next.economy?.baseSciencePerTurn, defaults.economy.baseSciencePerTurn),
    baseReligionPerTurn: numberOrDefault(next.economy?.baseReligionPerTurn, defaults.economy.baseReligionPerTurn),
    baseConstructionPerTurn: numberOrDefault(next.economy?.baseConstructionPerTurn, defaults.economy.baseConstructionPerTurn),
    baseDucatsPerTurn: numberOrDefault(next.economy?.baseDucatsPerTurn, defaults.economy.baseDucatsPerTurn),
    baseGoldPerTurn: numberOrDefault(next.economy?.baseGoldPerTurn, defaults.economy.baseGoldPerTurn),
    demolitionCostConstructionPercent:
      typeof next.economy?.demolitionCostConstructionPercent === "number"
        ? Math.max(0, Math.min(100, Math.floor(next.economy.demolitionCostConstructionPercent)))
        : defaults.economy.demolitionCostConstructionPercent,
    marketPriceSmoothing:
      typeof next.economy?.marketPriceSmoothing === "number" && Number.isFinite(next.economy.marketPriceSmoothing)
        ? Math.max(0, Math.min(1, Number(next.economy.marketPriceSmoothing)))
        : defaults.economy.marketPriceSmoothing,
    buildingDurabilityDecayPerTurn: finiteNumberOrDefault(
      next.economy?.buildingDurabilityDecayPerTurn,
      defaults.economy.buildingDurabilityDecayPerTurn,
    ),
    buildingDurabilityRecoveryPerTurn: finiteNumberOrDefault(
      next.economy?.buildingDurabilityRecoveryPerTurn,
      defaults.economy.buildingDurabilityRecoveryPerTurn,
    ),
    pollutionProductivityEffectPer1000: finiteNumberOrDefault(
      next.economy?.pollutionProductivityEffectPer1000,
      defaults.economy.pollutionProductivityEffectPer1000,
    ),
    explorationBaseEmptyChancePct:
      typeof next.economy?.explorationBaseEmptyChancePct === "number" && Number.isFinite(next.economy.explorationBaseEmptyChancePct)
        ? Math.max(0, Math.min(100, Number(next.economy.explorationBaseEmptyChancePct)))
        : defaults.economy.explorationBaseEmptyChancePct,
    explorationDepletionPerAttemptPct:
      typeof next.economy?.explorationDepletionPerAttemptPct === "number" &&
      Number.isFinite(next.economy.explorationDepletionPerAttemptPct)
        ? Math.max(0, Math.min(100, Number(next.economy.explorationDepletionPerAttemptPct)))
        : defaults.economy.explorationDepletionPerAttemptPct,
    explorationDurationTurns: positiveIntOrDefault(
      next.economy?.explorationDurationTurns,
      defaults.economy.explorationDurationTurns,
    ),
    explorationRollsPerExpedition: positiveIntOrDefault(
      next.economy?.explorationRollsPerExpedition,
      defaults.economy.explorationRollsPerExpedition,
    ),
  };
}

function restoreMarkets(
  next: Partial<GameSettings>,
  defaults: GameSettings,
  params: RestorePersistedGameSettingsParams,
): GameSettings["markets"] {
  return {
    countryMarketByCountryId:
      next.markets && typeof next.markets === "object" && next.markets.countryMarketByCountryId && typeof next.markets.countryMarketByCountryId === "object"
        ? Object.fromEntries(
            Object.entries(next.markets.countryMarketByCountryId as Record<string, unknown>)
              .map(([countryId, marketId]) => [countryId, normalizeMarketId(marketId)])
              .filter((row): row is [string, string] => Boolean(row[0] && row[1])),
          )
        : { ...defaults.markets.countryMarketByCountryId },
    marketById: restoreMarketsById(next, defaults),
    transportCorridorsById: restoreTransportCorridorsById(next, defaults, params),
    marketInvitesById: restoreMarketInvitesById(next, defaults),
    sanctionsById:
      next.markets && typeof next.markets === "object" && next.markets.sanctionsById && typeof next.markets.sanctionsById === "object"
        ? normalizeMarketSanctionsMap(next.markets.sanctionsById, params.turnId)
        : { ...defaults.markets.sanctionsById },
    infrastructureTransitAgreementsById:
      next.markets &&
      typeof next.markets === "object" &&
      next.markets.infrastructureTransitAgreementsById &&
      typeof next.markets.infrastructureTransitAgreementsById === "object"
        ? normalizeInfrastructureTransitAgreementsMap(next.markets.infrastructureTransitAgreementsById)
        : { ...defaults.markets.infrastructureTransitAgreementsById },
    infrastructureConstructionRightsById:
      next.markets &&
      typeof next.markets === "object" &&
      next.markets.infrastructureConstructionRightsById &&
      typeof next.markets.infrastructureConstructionRightsById === "object"
        ? normalizeInfrastructureConstructionRightsMap(next.markets.infrastructureConstructionRightsById)
        : { ...defaults.markets.infrastructureConstructionRightsById },
  };
}

function restoreMarketsById(next: Partial<GameSettings>, defaults: GameSettings): GameSettings["markets"]["marketById"] {
  if (!next.markets || typeof next.markets !== "object" || !next.markets.marketById || typeof next.markets.marketById !== "object") {
    return { ...defaults.markets.marketById };
  }
  return Object.fromEntries(
    Object.entries(next.markets.marketById as Record<string, unknown>).map(([marketId, raw]) => {
      const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const ownerCountryId =
        typeof value.ownerCountryId === "string" && value.ownerCountryId.trim() ? value.ownerCountryId.trim() : marketId;
      return [
        marketId,
        {
          id: marketId,
          name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : `Рынок ${marketId}`,
          logoUrl: typeof value.logoUrl === "string" || value.logoUrl === null ? (value.logoUrl ?? null) : null,
          ownerCountryId,
          capitalHexId:
            typeof value.capitalHexId === "string" && value.capitalHexId.trim().length > 0
              ? value.capitalHexId.trim()
              : null,
          memberCountryIds: Array.isArray(value.memberCountryIds)
            ? [...new Set(value.memberCountryIds.filter((row): row is string => typeof row === "string" && row.trim().length > 0).map((row) => row.trim()))]
            : [ownerCountryId],
          visibility: normalizeMarketVisibility(value.visibility),
          createdAt: typeof value.createdAt === "string" && value.createdAt.trim() ? value.createdAt.trim() : new Date().toISOString(),
          warehouseByResourceId: normalizeNumberMap(value.warehouseByResourceId),
          priceByResourceId: normalizeNumberMap(value.priceByResourceId),
          priceHistoryByResourceId: normalizeNumberHistoryMap(value.priceHistoryByResourceId),
          demandHistoryByResourceId: normalizeNumberHistoryMap(value.demandHistoryByResourceId),
          offerHistoryByResourceId: normalizeNumberHistoryMap(value.offerHistoryByResourceId),
          productionFactHistoryByResourceId: normalizeNumberHistoryMap(value.productionFactHistoryByResourceId),
          productionMaxHistoryByResourceId: normalizeNumberHistoryMap(value.productionMaxHistoryByResourceId),
          worldTradePolicyByResourceId: normalizeMarketTradePolicyMap(value.worldTradePolicyByResourceId),
          resourceTradePolicyByCountryId: normalizeCountryResourceTradePolicyMap(value.resourceTradePolicyByCountryId),
        },
      ];
    }),
  );
}

function restoreTransportCorridorsById(
  next: Partial<GameSettings>,
  defaults: GameSettings,
  params: RestorePersistedGameSettingsParams,
): GameSettings["markets"]["transportCorridorsById"] {
  if (
    !next.markets ||
    typeof next.markets !== "object" ||
    !next.markets.transportCorridorsById ||
    typeof next.markets.transportCorridorsById !== "object"
  ) {
    return { ...defaults.markets.transportCorridorsById };
  }
  return Object.fromEntries(
    Object.entries(next.markets.transportCorridorsById as Record<string, unknown>).flatMap(([corridorId, raw]) => {
      const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      if (value.schemaVersion !== 2) return [];
      const marketId = typeof value.marketId === "string" ? value.marketId.trim() : "";
      const hexIds = normalizeHexIdList(value.computedHexIds);
      const waypoints = normalizeTransportCorridorRoutePoints(value.waypoints);
      if (!marketId || hexIds.length < 2) return [];
      if (waypoints.length < 2) return [];
      const transportMode = normalizeTransportMode(value.transportMode);
      const routeCost = Math.max(1, Number(value.routeCost ?? hexIds.length - 1) || 1);
      const costConstruction = Math.max(
        1,
        Math.floor(Number(value.costConstruction ?? getTransportCorridorBuildCost(transportMode, routeCost, hexIds.length - 1)) || 1),
      );
      const level = Math.max(1, Math.floor(Number(value.level ?? 1) || 1));
      return [[
        corridorId,
        {
          id: corridorId,
          schemaVersion: 2,
          marketId,
          ownerCountryId: typeof value.ownerCountryId === "string" ? value.ownerCountryId.trim() : "",
          hexIds,
          routePoints: waypoints,
          waypoints,
          computedHexIds: hexIds,
          connectedRegionIds: normalizeHexIdList(value.connectedRegionIds),
          connectedCityMarkerIds: normalizeHexIdList(value.connectedCityMarkerIds),
          transportMode,
          level,
          pendingLevel: value.pendingLevel ? Math.max(level + 1, Math.floor(Number(value.pendingLevel) || level + 1)) : null,
          status: normalizeTransportCorridorStatus(value.status),
          progressConstruction: Math.max(0, Math.min(costConstruction, Number(value.progressConstruction ?? 0) || 0)),
          costConstruction,
          routeCost,
          lastLoadByMode: normalizeCategoryAmountMap((value as { lastLoadByMode?: unknown }).lastLoadByMode),
          lastCapacityByMode: normalizeCategoryAmountMap((value as { lastCapacityByMode?: unknown }).lastCapacityByMode),
          lastLoadHistoryByMode: Object.fromEntries(
            Object.entries(normalizeNumberHistoryMap((value as { lastLoadHistoryByMode?: unknown }).lastLoadHistoryByMode)).map(
              ([modeId, values]) => [
                modeId,
                values.map((entry) => params.round3(Math.max(0, entry))).slice(-params.corridorLoadHistoryLength),
              ],
            ),
          ),
          foreignConstructionRights: normalizeCorridorForeignConstructionRights(value.foreignConstructionRights).filter((entry) =>
            hexIds.includes(entry.hexId),
          ),
          nationalizedAt:
            typeof value.nationalizedAt === "string" && value.nationalizedAt.trim().length > 0 ? value.nationalizedAt.trim() : null,
          nationalizedFromCountryId:
            typeof value.nationalizedFromCountryId === "string" && value.nationalizedFromCountryId.trim().length > 0
              ? value.nationalizedFromCountryId.trim()
              : null,
          createdAt: typeof value.createdAt === "string" && value.createdAt.trim().length > 0 ? value.createdAt.trim() : new Date().toISOString(),
          completedAt:
            typeof value.completedAt === "string" && value.completedAt.trim().length > 0 ? value.completedAt.trim() : null,
        } satisfies TransportCorridorEntry,
      ]];
    }),
  );
}

function restoreMarketInvitesById(next: Partial<GameSettings>, defaults: GameSettings): GameSettings["markets"]["marketInvitesById"] {
  if (!next.markets || typeof next.markets !== "object" || !next.markets.marketInvitesById || typeof next.markets.marketInvitesById !== "object") {
    return { ...defaults.markets.marketInvitesById };
  }
  return Object.fromEntries(
    Object.entries(next.markets.marketInvitesById as Record<string, unknown>).map(([inviteId, raw]) => {
      const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const nowIso = new Date().toISOString();
      const statusRaw = typeof value.status === "string" ? value.status : "pending";
      const status = statusRaw === "accepted" || statusRaw === "rejected" || statusRaw === "canceled" ? statusRaw : "pending";
      const kindRaw = typeof value.kind === "string" ? value.kind : "invite";
      const kind = kindRaw === "join-request" ? "join-request" : "invite";
      return [
        inviteId,
        {
          id: inviteId,
          marketId: typeof value.marketId === "string" ? value.marketId : "",
          fromCountryId: typeof value.fromCountryId === "string" ? value.fromCountryId : "",
          toCountryId: typeof value.toCountryId === "string" ? value.toCountryId : "",
          kind,
          status,
          expiresAt: typeof value.expiresAt === "string" && value.expiresAt.trim() ? value.expiresAt : nowIso,
          createdAt: typeof value.createdAt === "string" && value.createdAt.trim() ? value.createdAt : nowIso,
          updatedAt: typeof value.updatedAt === "string" && value.updatedAt.trim() ? value.updatedAt : nowIso,
        },
      ];
    }),
  );
}

function restoreAuditLog(next: Partial<GameSettings>, defaults: GameSettings): GameSettings["auditLog"] {
  return {
    maxEntries:
      typeof (next as Partial<{ auditLog?: { maxEntries?: unknown } }>).auditLog?.maxEntries === "number"
        ? Math.max(1, Math.min(HARD_MAX_ADMIN_AUDIT_LOG, Math.floor((next as Partial<{ auditLog?: { maxEntries?: number } }>).auditLog?.maxEntries ?? defaults.auditLog.maxEntries)))
        : defaults.auditLog.maxEntries,
    retentionTurns:
      typeof (next as Partial<{ auditLog?: { retentionTurns?: unknown } }>).auditLog?.retentionTurns === "number"
        ? Math.max(1, Math.floor((next as Partial<{ auditLog?: { retentionTurns?: number } }>).auditLog?.retentionTurns ?? 1))
        : (next as Partial<{ auditLog?: { retentionTurns?: unknown } }>).auditLog?.retentionTurns === null
          ? null
          : defaults.auditLog.retentionTurns,
  };
}

function restoreTurnTimer(next: Partial<GameSettings>, defaults: GameSettings): GameSettings["turnTimer"] {
  return {
    enabled:
      typeof (next as Partial<{ turnTimer?: { enabled?: unknown } }>).turnTimer?.enabled === "boolean"
        ? Boolean((next as Partial<{ turnTimer?: { enabled?: boolean } }>).turnTimer?.enabled)
        : defaults.turnTimer.enabled,
    secondsPerTurn:
      typeof (next as Partial<{ turnTimer?: { secondsPerTurn?: unknown } }>).turnTimer?.secondsPerTurn === "number"
        ? Math.max(10, Math.floor((next as Partial<{ turnTimer?: { secondsPerTurn?: number } }>).turnTimer?.secondsPerTurn ?? defaults.turnTimer.secondsPerTurn))
        : defaults.turnTimer.secondsPerTurn,
    pauseWhenNoPlayersOnline:
      typeof (next as Partial<{ turnTimer?: { pauseWhenNoPlayersOnline?: unknown } }>).turnTimer?.pauseWhenNoPlayersOnline === "boolean"
        ? Boolean((next as Partial<{ turnTimer?: { pauseWhenNoPlayersOnline?: boolean } }>).turnTimer?.pauseWhenNoPlayersOnline)
        : defaults.turnTimer.pauseWhenNoPlayersOnline,
  };
}


function stringOrNullOrDefault(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : fallback;
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" ? Math.max(0, Math.floor(value)) : fallback;
}

function positiveIntOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

function finiteNumberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Number(value)) : fallback;
}
