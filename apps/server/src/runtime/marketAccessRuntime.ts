import type { HexMapIndexEntry } from "../map/hexIndex";
import type { GoodTransportMode } from "../mechanics/marketTurnMechanics";
import type {
  GameSettings,
  InfrastructureConstructionRightsEntry,
  TransportCorridorEntry,
  TransportCorridorRoutePoint,
} from "./gameSettingsTypes";

type MarketAccessRuntimeParams = {
  getHexIndex: () => HexMapIndexEntry[];
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  getHexOwner: (hexId: string) => string | null;
  round3: (value: number) => number;
};

export function createMarketAccessRuntime(params: MarketAccessRuntimeParams) {
  function areHexIdsAdjacentOrSame(fromHexId: string, toHexId: string): boolean {
    if (!fromHexId || !toHexId) return false;
    if (fromHexId === toHexId) return true;
    const hexIndex = params.getHexIndex();
    const fromHex = hexIndex.find((entry) => entry.id === fromHexId);
    const toHex = hexIndex.find((entry) => entry.id === toHexId);
    return Boolean(fromHex?.neighbors.includes(toHexId) || toHex?.neighbors.includes(fromHexId));
  }

  function isContiguousTransportCorridorRoute(
    hexIds: string[],
    routePoints?: TransportCorridorRoutePoint[],
  ): boolean {
    const routeHexIds = routePoints && routePoints.length >= 2 ? routePoints.map((point) => point.hexId) : hexIds;
    for (let index = 1; index < routeHexIds.length; index += 1) {
      if (!areHexIdsAdjacentOrSame(routeHexIds[index - 1], routeHexIds[index])) {
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

  function getInfrastructureConstructionRightForHex(
    hexId: string,
    builderCountryId: string,
    transportMode: GoodTransportMode,
  ): InfrastructureConstructionRightsEntry | null {
    const hexOwnerId = params.getHexOwner(hexId);
    if (!hexOwnerId || hexOwnerId === builderCountryId) return null;
    return (
      Object.values(params.getGameSettings().markets.infrastructureConstructionRightsById ?? {}).find((agreement) =>
        isInfrastructureConstructionRightActive(agreement, hexOwnerId, builderCountryId, transportMode),
      ) ?? null
    );
  }

  function isHexAllowedForCorridorOwner(
    hexId: string,
    ownerCountryId: string,
    transportMode: GoodTransportMode,
  ): boolean {
    const hexOwnerId = params.getHexOwner(hexId);
    return (
      !hexOwnerId ||
      hexOwnerId === ownerCountryId ||
      Boolean(getInfrastructureConstructionRightForHex(hexId, ownerCountryId, transportMode))
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

  function getTransportCorridorCapacity(corridor: TransportCorridorEntry): number {
    if (corridor.status !== "active") return 0;
    return params.round3(getTransportCorridorBaseCapacity(corridor.transportMode) * Math.max(1, Math.floor(corridor.level || 1)));
  }

  return {
    areHexIdsAdjacentOrSame,
    getInfrastructureConstructionRightForHex,
    getInfrastructureTransitAgreementAllowedCountries,
    getTransportCorridorCapacity,
    isContiguousTransportCorridorRoute,
    isHexAllowedForCorridorOwner,
  };
}
