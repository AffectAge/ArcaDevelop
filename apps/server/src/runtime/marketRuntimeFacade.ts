import type { GameSettings, TransportCorridorEntry } from "./gameSettingsTypes";
import type { MarketRuntimeContext } from "./marketRuntimeState";
import {
  cleanupMarketsAfterCountryRemoval as cleanupMarketsAfterCountryRemovalForRuntime,
  createDefaultMarketRecord as createDefaultMarketRecordForRuntime,
  ensureMarketModelReady as ensureMarketModelReadyForRuntime,
  getCountryMarketId as getCountryMarketIdForRuntime,
  getCountryMarketRecord as getCountryMarketRecordForRuntime,
  getMarketById as getMarketByIdForRuntime,
  getMarketDisplayName as getMarketDisplayNameFromRuntime,
  getMarketTransportCorridors as getMarketTransportCorridorsForRuntime,
  isDefaultMarketName as isDefaultMarketNameFromRuntime,
  rebuildCountryMarketIndexFromMembers as rebuildCountryMarketIndexFromMembersForRuntime,
  setCountryMarketId as setCountryMarketIdForRuntime,
  upsertMarketMembership as upsertMarketMembershipForRuntime,
} from "./marketRuntimeState";

type MarketRuntimeFacadeParams = {
  getContext: () => MarketRuntimeContext;
  removeUploadedByUrl: (url: string) => void;
  findCountryNamesByIds: (countryIds: string[]) => Promise<Array<{ id: string; name: string }>>;
};

export function createMarketRuntimeFacade(params: MarketRuntimeFacadeParams) {
  function createDefaultMarketRecord(marketId: string, ownerCountryId: string): GameSettings["markets"]["marketById"][string] {
    return createDefaultMarketRecordForRuntime(marketId, ownerCountryId);
  }

  function getMarketDisplayName(input: { marketId: string; marketName: string; ownerCountryName?: string | null }): string {
    return getMarketDisplayNameFromRuntime(input);
  }

  function isDefaultMarketName(marketId: string, marketName: string): boolean {
    return isDefaultMarketNameFromRuntime(marketId, marketName);
  }

  async function migratePersistedMarketNamesToReadable(): Promise<boolean> {
    ensureMarketModelReady();
    const context = params.getContext();
    const markets = Object.values(context.gameSettings.markets.marketById);
    if (markets.length === 0) return false;
    const ownerIds = [...new Set(markets.map((market) => market.ownerCountryId).filter(Boolean))];
    const countries = ownerIds.length ? await params.findCountryNamesByIds(ownerIds) : [];
    const countryNameById = new Map(countries.map((country) => [country.id, country.name] as const));
    let changed = false;
    for (const market of markets) {
      if (!isDefaultMarketName(market.id, market.name)) continue;
      const ownerName = countryNameById.get(market.ownerCountryId) ?? market.ownerCountryId;
      const nextName = getMarketDisplayName({
        marketId: market.id,
        marketName: market.name,
        ownerCountryName: ownerName,
      });
      if (nextName !== market.name) {
        market.name = nextName;
        changed = true;
      }
    }
    return changed;
  }

  function upsertMarketMembership(countryId: string, targetMarketIdRaw: string | null): string {
    return upsertMarketMembershipForRuntime({ ...params.getContext(), countryId, targetMarketIdRaw });
  }

  function rebuildCountryMarketIndexFromMembers(): void {
    rebuildCountryMarketIndexFromMembersForRuntime(params.getContext());
  }

  function ensureMarketModelReady(): void {
    ensureMarketModelReadyForRuntime(params.getContext());
  }

  function getCountryMarketId(countryId: string): string {
    return getCountryMarketIdForRuntime({ ...params.getContext(), countryId });
  }

  function setCountryMarketId(countryId: string, marketId: string | null): void {
    setCountryMarketIdForRuntime({ ...params.getContext(), countryId, marketId });
  }

  function getMarketById(marketId: string): GameSettings["markets"]["marketById"][string] | null {
    return getMarketByIdForRuntime({ ...params.getContext(), marketId });
  }

  function getCountryMarketRecord(countryId: string): GameSettings["markets"]["marketById"][string] {
    return getCountryMarketRecordForRuntime({ ...params.getContext(), countryId });
  }

  function getMarketTransportCorridors(marketId: string, options?: { includeDisabled?: boolean }): TransportCorridorEntry[] {
    return getMarketTransportCorridorsForRuntime({ ...params.getContext(), marketId, options });
  }

  function cleanupMarketsAfterCountryRemoval(removedCountryId: string): void {
    cleanupMarketsAfterCountryRemovalForRuntime({
      ...params.getContext(),
      removedCountryId,
      removeUploadedByUrl: params.removeUploadedByUrl,
    });
  }

  return {
    cleanupMarketsAfterCountryRemoval,
    createDefaultMarketRecord,
    ensureMarketModelReady,
    getCountryMarketId,
    getCountryMarketRecord,
    getMarketById,
    getMarketDisplayName,
    getMarketTransportCorridors,
    isDefaultMarketName,
    migratePersistedMarketNamesToReadable,
    rebuildCountryMarketIndexFromMembers,
    setCountryMarketId,
    upsertMarketMembership,
  };
}
