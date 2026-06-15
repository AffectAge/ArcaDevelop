import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import type { GoodTransportMode } from "../mechanics/marketTurnMechanics";
import type {
  GameSettings,
  InfrastructureConstructionRightsEntry,
  TransportCorridorEntry,
  TransportCorridorRoutePoint,
} from "./gameSettingsTypes";

type MarketAccessRuntimeParams = {
  getProvinceIndex: () => Adm1ProvinceIndexEntry[];
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  getProvinceOwner: (provinceId: string) => string | null;
  round3: (value: number) => number;
};

export function createMarketAccessRuntime(params: MarketAccessRuntimeParams) {
  function areProvinceIdsAdjacentOrSame(fromProvinceId: string, toProvinceId: string): boolean {
    if (!fromProvinceId || !toProvinceId) return false;
    if (fromProvinceId === toProvinceId) return true;
    const provinceIndex = params.getProvinceIndex();
    const fromProvince = provinceIndex.find((entry) => entry.id === fromProvinceId);
    const toProvince = provinceIndex.find((entry) => entry.id === toProvinceId);
    return Boolean(fromProvince?.neighbors.includes(toProvinceId) || toProvince?.neighbors.includes(fromProvinceId));
  }

  function isContiguousTransportCorridorRoute(
    provinceIds: string[],
    routePoints?: TransportCorridorRoutePoint[],
  ): boolean {
    const routeProvinceIds = routePoints && routePoints.length >= 2 ? routePoints.map((point) => point.provinceId) : provinceIds;
    for (let index = 1; index < routeProvinceIds.length; index += 1) {
      if (!areProvinceIdsAdjacentOrSame(routeProvinceIds[index - 1], routeProvinceIds[index])) {
        return false;
      }
    }
    return true;
  }

  function isInfrastructureConstructionRightActive(
    agreement: InfrastructureConstructionRightsEntry,
    grantorCountryId: string,
    builderCountryId: string,
    transportMode: GoodTransportMode,
  ): boolean {
    if (!agreement.active) return false;
    if (typeof agreement.expiresTurnId === "number" && agreement.expiresTurnId < params.getTurnId()) return false;
    if (agreement.transportModes.length > 0 && !agreement.transportModes.includes(transportMode)) return false;
    if (agreement.fromCountryId === grantorCountryId && agreement.toCountryId === builderCountryId) return true;
    return agreement.bilateral && agreement.fromCountryId === builderCountryId && agreement.toCountryId === grantorCountryId;
  }

  function getInfrastructureConstructionRightForProvince(
    provinceId: string,
    builderCountryId: string,
    transportMode: GoodTransportMode,
  ): InfrastructureConstructionRightsEntry | null {
    const provinceOwnerId = params.getProvinceOwner(provinceId);
    if (!provinceOwnerId || provinceOwnerId === builderCountryId) return null;
    return (
      Object.values(params.getGameSettings().markets.infrastructureConstructionRightsById ?? {}).find((agreement) =>
        isInfrastructureConstructionRightActive(agreement, provinceOwnerId, builderCountryId, transportMode),
      ) ?? null
    );
  }

  function isProvinceAllowedForCorridorOwner(
    provinceId: string,
    ownerCountryId: string,
    transportMode: GoodTransportMode,
  ): boolean {
    const provinceOwnerId = params.getProvinceOwner(provinceId);
    return (
      !provinceOwnerId ||
      provinceOwnerId === ownerCountryId ||
      Boolean(getInfrastructureConstructionRightForProvince(provinceId, ownerCountryId, transportMode))
    );
  }

  function getInfrastructureTransitAgreementAllowedCountries(
    baseCountryIds: Set<string>,
    transportMode: GoodTransportMode | null,
  ): Set<string> {
    const allowed = new Set(baseCountryIds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const agreement of Object.values(params.getGameSettings().markets.infrastructureTransitAgreementsById ?? {})) {
        if (!agreement.active) continue;
        if (typeof agreement.expiresTurnId === "number" && agreement.expiresTurnId < params.getTurnId()) continue;
        if (transportMode && agreement.transportModes.length > 0 && !agreement.transportModes.includes(transportMode)) continue;
        const fromAllowed = allowed.has(agreement.fromCountryId);
        const toAllowed = allowed.has(agreement.toCountryId);
        if (fromAllowed && !toAllowed) {
          allowed.add(agreement.toCountryId);
          changed = true;
        }
        if (agreement.bilateral && toAllowed && !fromAllowed) {
          allowed.add(agreement.fromCountryId);
          changed = true;
        }
      }
    }
    return allowed;
  }

  function getTransportCorridorBaseCapacity(mode: GoodTransportMode): number {
    switch (mode) {
      case "sea":
        return 250;
      case "air":
        return 80;
      case "pipeline":
        return 120;
      case "powerGrid":
        return 200;
      case "land":
      default:
        return 50;
    }
  }

  function getTransportCorridorCapacity(corridor: TransportCorridorEntry, categoryId: string | null): number {
    if (corridor.status !== "active") return 0;
    if (categoryId && corridor.transportMode === "pipeline" && categoryId !== "energy" && categoryId !== "fuel") {
      return 0;
    }
    return params.round3(getTransportCorridorBaseCapacity(corridor.transportMode) * Math.max(1, Math.floor(corridor.level || 1)));
  }

  return {
    areProvinceIdsAdjacentOrSame,
    getInfrastructureConstructionRightForProvince,
    getInfrastructureTransitAgreementAllowedCountries,
    getTransportCorridorCapacity,
    isContiguousTransportCorridorRoute,
    isProvinceAllowedForCorridorOwner,
  };
}
