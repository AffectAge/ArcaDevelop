import { randomUUID } from "node:crypto";
import {
  evaluateBuildingPlacement,
  buildCityHexIdSet,
  resolveEffectiveHexTile,
  type BuildingOwner,
  type HexFeature,
  type HexTerrain,
  type HexTile,
  type HexWaterKind,
  type Order,
  type WorldBase,
} from "@arcanorum/shared";
import {
  countBuildingOccurrences as countBuildingOccurrencesInState,
  enqueueBuildingAutoUpgradesTurn as enqueueBuildingAutoUpgradesTurnInState,
  getBuildingConstructionTotalCostByLevel,
  getBuildingMaxDurability,
  getBuildingMaxLevel,
  getBuildingPollutionProductivityFactor,
  getBuildingUpgradeCosts,
  getCountryBuildLimit,
  getHexBuildRestriction,
  isCountryAllowedForBuildingSync,
  isCountryAllowedForBuildingWithEngine,
  parseRequestedBuildingIdFromPayload,
  resolveBuildingConstructionQueuesTurn as resolveBuildingConstructionQueuesTurnInState,
  resolveBuildingOwnerFromPayload,
} from "../mechanics/buildingMechanics";
import type { HexMapIndexEntry } from "../map/hexIndex";
import type { BuildingContentEntry, GameSettings } from "./gameSettingsTypes";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";

type BuildingRuntimeParams = {
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getHexById: () => Map<string, HexMapIndexEntry>;
  ensureCountryInWorldBase: (countryId: string) => void;
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
};

export type BuildingRuntime = ReturnType<typeof createBuildingRuntime>;

export function createBuildingRuntime(params: BuildingRuntimeParams) {
  const parseRequestedBuildingIdFromPayloadForRuntime = (payload: Record<string, unknown>): string =>
    parseRequestedBuildingIdFromPayload(payload, params.getGameSettings().content.buildings[0]?.id || "");

  const getHexBuildRestrictionForRuntime = (
    building: BuildingContentEntry,
    targetHexId: string,
    regionId?: string,
    countryId?: string,
  ): string | null => {
    const hexById = params.getHexById();
    const exactHex = hexById.get(targetHexId);
    if (!exactHex) {
      if (!regionId) {
        const legacyRegionHexes = [...hexById.values()].filter((hex) => hex.regionId === targetHexId);
        if (legacyRegionHexes.length > 0) {
          const restrictions = legacyRegionHexes.map((hex) => getHexBuildRestriction(building, hex)).filter(Boolean);
          return restrictions.length < legacyRegionHexes.length ? null : restrictions[0] ?? "BUILD_PLACEMENT_HEX_NOT_FOUND";
        }
      }
      return "BUILD_PLACEMENT_HEX_NOT_FOUND";
    }
    if (regionId && exactHex.regionId !== regionId) {
      return "BUILD_PLACEMENT_HEX_REGION_MISMATCH";
    }
    const legacyRestriction = getHexBuildRestriction(building, exactHex);
    if (legacyRestriction) return legacyRestriction;
    const cityHexIds = buildCityHexIdSet(params.getWorldBase());
    const hex = toPlacementHexTile(exactHex, cityHexIds);
    if (!hex || !countryId) {
      return "BUILD_PLACEMENT_HEX_NOT_FOUND";
    }
    const neighborHexes = exactHex.neighbors
      .map((neighborId) => toPlacementHexTile(hexById.get(neighborId), cityHexIds))
      .filter((tile): tile is HexTile => Boolean(tile));
    const evaluation = evaluateBuildingPlacement({
      building,
      countryId,
      hex,
      neighborHexes,
      world: params.getWorldBase(),
    });
    return evaluation.valid ? null : evaluation.reason.code;
  };

  const getHexFertilityMultiplier = (hexId: string): number => {
    const fertility = Number(params.getHexById().get(hexId)?.fertility ?? 100);
    if (!Number.isFinite(fertility)) return 1;
    return Math.max(0, fertility / 100);
  };

  const getBuildingPollutionProductivityFactorForRuntime = (building: BuildingContentEntry, hexId: string): number =>
    getBuildingPollutionProductivityFactor({
      building,
      province: params.getHexById().get(hexId),
      pollutionProductivityEffectPer1000: Number(params.getGameSettings().economy.pollutionProductivityEffectPer1000 ?? 0),
    });

  const countBuildingOccurrencesForRuntime = (
    buildingId: string,
    countryId: string,
    options?: { includePendingOrders?: boolean },
  ): { byCountry: number; global: number } => {
    const pendingOrders = options?.includePendingOrders === false
      ? []
      : [...(params.getOrdersByTurn().get(params.getTurnId())?.values() ?? [])].flat();
    return countBuildingOccurrencesInState({
      buildingId,
      countryId,
      worldBase: params.getWorldBase(),
      pendingOrders,
      parseRequestedBuildingId: parseRequestedBuildingIdFromPayloadForRuntime,
    });
  };

  const resolveBuildingOwnerFromPayloadForRuntime = (
    payload: Record<string, unknown>,
    requestedByCountryId: string,
  ): BuildingOwner | null =>
    resolveBuildingOwnerFromPayload({
      payload,
      requestedByCountryId,
      companyIds: new Set(params.getGameSettings().content.companies.map((company) => company.id)),
      countryIds: new Set(Object.keys(params.getWorldBase().resourcesByCountry)),
    });

  const enqueueBuildingAutoUpgradesTurn = (): void => {
    enqueueBuildingAutoUpgradesTurnInState({
      worldBase: params.getWorldBase(),
      buildings: params.getGameSettings().content.buildings,
      turnId: params.getTurnId(),
      ensureCountryInWorldBase: params.ensureCountryInWorldBase,
      createId: randomUUID,
    });
  };

  const resolveBuildingConstructionQueuesTurn = (): void => {
    resolveBuildingConstructionQueuesTurnInState({
      worldBase: params.getWorldBase(),
      buildings: params.getGameSettings().content.buildings,
      turnId: params.getTurnId(),
      createId: randomUUID,
      addExpense: params.addResourceLedgerExpense,
    });
  };

  return {
    parseRequestedBuildingIdFromPayload: parseRequestedBuildingIdFromPayloadForRuntime,
    isCountryAllowedForBuildingSync,
    getHexBuildRestriction: getHexBuildRestrictionForRuntime,
    getHexFertilityMultiplier,
    getBuildingPollutionProductivityFactor: getBuildingPollutionProductivityFactorForRuntime,
    isCountryAllowedForBuildingWithEngine,
    countBuildingOccurrences: countBuildingOccurrencesForRuntime,
    getCountryBuildLimit,
    resolveBuildingOwnerFromPayload: resolveBuildingOwnerFromPayloadForRuntime,
    getBuildingMaxLevel,
    getBuildingMaxDurability,
    getBuildingUpgradeCosts,
    getBuildingConstructionTotalCostByLevel,
    enqueueBuildingAutoUpgradesTurn,
    resolveBuildingConstructionQueuesTurn,
  };
}

function toPlacementHexTile(input: HexMapIndexEntry | undefined, cityHexIds: ReadonlySet<HexTile["id"]> = new Set()): HexTile | null {
  if (!input?.id || !input.regionId) return null;
  const waterKind = normalizePlacementWaterKind(input.landscape ?? input.hexType);
  const mapTags = normalizePlacementMapTags(input.landscape ?? input.hexType, waterKind);
  return resolveEffectiveHexTile({
    id: input.id as HexTile["id"],
    q: 0,
    r: 0,
    chunkId: "hex-chunk:0:0",
    regionId: input.regionId as HexTile["regionId"],
    waterKind,
    elevation: 0,
    moisture: 0,
    temperature: 0,
    temperatureBand: "frozen",
    moistureBand: "arid",
    distanceToWater: waterKind ? 0 : 3,
    isCoastal: mapTags.includes("coast:coastal"),
    riverMask: 0,
    riverWidth: 0,
    mapTags,
    movementCost: 1,
    passable: true,
  }, cityHexIds);
}

function normalizePlacementMapTags(value: string | null | undefined, waterKind: HexWaterKind): HexTile["mapTags"] {
  const normalized = String(value ?? "").trim();
  if (waterKind === "ocean") return ["water:ocean", "coast:inland", "fertility:barren", "movement:stop_on_enter"];
  if (waterKind === "sea") return ["water:coastal", "feature:aquatic", "coast:coastal", "fertility:barren"];
  if (waterKind === "lake") return ["water:lake", "water:fresh", "feature:aquatic", "coast:coastal", "fertility:barren"];
  if (normalized === "desert") return ["biome:desert", "morphology:flat", "fertility:poor", "coast:inland"];
  if (normalized === "hills") return ["biome:plains", "morphology:rough", "fertility:modest", "coast:inland", "movement:stop_on_enter"];
  if (normalized === "mountains") return ["biome:plains", "morphology:mountainous", "fertility:poor", "coast:inland", "movement:stop_on_enter"];
  if (normalized === "forest") return ["biome:grassland", "morphology:flat", "feature:vegetated", "fertility:fertile", "coast:inland", "movement:stop_on_enter"];
  return ["biome:plains", "morphology:flat", "fertility:modest", "coast:inland"];
}

function normalizePlacementWaterKind(value: string | null | undefined): HexWaterKind {
  const normalized = String(value ?? "").trim();
  return normalized === "ocean" || normalized === "sea" || normalized === "lake" ? normalized : null;
}
