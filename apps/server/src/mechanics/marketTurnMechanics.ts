export type CountryGoodMap = Record<string, Record<string, number>>;
export type ScopeGoodPartnerMap = Record<string, Record<string, Record<string, number>>>;
export type CategoryAmountMap = Record<string, Record<string, number>>;

export type GoodDistributionType = "tradeable" | "localOnly" | "pipeline" | "powerGrid" | "service";
export type GoodTransportMode = "land" | "sea" | "air" | "pipeline" | "powerGrid";

export type MarketGoodContentEntry = {
  id: string;
  basePrice?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  infrastructureCostPerUnit?: number | null;
  infraPerUnit?: number | null;
  resourceCategoryId?: string | null;
  distributionType?: GoodDistributionType | null;
  transportModes?: GoodTransportMode[];
};

export type PriceMeta = {
  base: number;
  min: number;
  max: number;
};

export type MarketSanctionLike = {
  id: string;
  initiatorCountryId: string;
  direction: "import" | "export" | "both";
  targetType: "country" | "market";
  targetId: string;
  goods?: string[];
  mode: "ban" | "cap";
  capAmountPerTurn?: number | null;
  startTurn: number;
  durationTurns: number;
  enabled?: boolean;
};

export type ActiveTradeSanction<T extends MarketSanctionLike = MarketSanctionLike> = T & {
  goodsSet: Set<string> | null;
  expiresAtTurnExclusive: number;
};

export type LogisticsFailureLike = {
  provinceId: string;
  sourceProvinceId?: string | null;
  goodId: string;
  reason: string;
  amount: number;
  transportModes: string[];
};

export type SellerScope = "region" | "country" | "market" | "global";

export type MarketTradePolicyLike = {
  allowImportFromWorld?: boolean;
  allowExportToWorld?: boolean;
  maxImportAmountPerTurnFromWorld?: number | null;
  maxExportAmountPerTurnToWorld?: number | null;
  overridesByMarketId?: Record<string, MarketTradePolicyLike>;
  overridesByCountryId?: Record<string, MarketTradePolicyLike>;
};

export type ResolvedTradePolicyLayer = {
  allowImportFromWorld: boolean;
  allowExportToWorld: boolean;
  maxImportAmountPerTurnFromWorld: number | null;
  maxExportAmountPerTurnToWorld: number | null;
  scopeImport: string;
  scopeExport: string;
};

export type TradeSanctionForPurchase = {
  id: string;
  mode: "ban" | "cap";
  capAmountPerTurn?: number | null;
};

export type BuildingInputNeed = {
  goodId: string;
  required: number;
  available: number;
};

export type BuildingInputPurchaseBuyerInstance = {
  instanceId: string;
  ducats?: number | null;
  warehouseByGoodId?: Record<string, number> | null;
};

export type BuildingInputPurchaseSellerInstance = WarehouseSellerInstanceLike & {
  lastSalesByGoodId?: Record<string, number> | null;
  lastSalesRevenueByGoodId?: Record<string, number> | null;
};

export type BuildingInputPurchaseRoute = {
  capacityGoods: number;
};

export type BuildingInputPurchaseResult = {
  purchaseCost: number;
  purchasedByGood: Record<string, number>;
  purchasedCostByGood: Record<string, number>;
};

export type MarketTurnRecordLike = {
  priceByResourceId?: Record<string, number>;
  warehouseByResourceId?: Record<string, number>;
  priceHistoryByResourceId?: Record<string, number[]>;
  demandHistoryByResourceId?: Record<string, number[]>;
  offerHistoryByResourceId?: Record<string, number[]>;
  productionFactHistoryByResourceId?: Record<string, number[]>;
  productionMaxHistoryByResourceId?: Record<string, number[]>;
};

export type MarketTurnCorridorLike<TMode extends string = string> = {
  id: string;
  transportMode: TMode;
  lastLoadByMode?: Record<string, number>;
  lastCapacityByMode?: Record<string, number>;
  lastLoadHistoryByMode?: Record<string, number[]>;
};

export type MarketTurnOverview<TAlert, TLogisticsFailure> = {
  turnId: number;
  demandByCountry: CountryGoodMap;
  offerByCountry: CountryGoodMap;
  demandGlobal: Record<string, number>;
  offerGlobal: Record<string, number>;
  alertsByCountry: Record<string, TAlert[]>;
  importsByCountryByCountryAndGood: ScopeGoodPartnerMap;
  exportsByCountryByCountryAndGood: ScopeGoodPartnerMap;
  importsByMarketByMarketAndGood: ScopeGoodPartnerMap;
  exportsByMarketByMarketAndGood: ScopeGoodPartnerMap;
  logisticsFailuresByProvince: Record<string, TLogisticsFailure[]>;
};

export type WarehouseSellerInstanceLike = {
  instanceId: string;
  warehouseByGoodId?: Record<string, number> | null;
  ducats?: number | null;
  lastRevenueDucats?: number | null;
};

export type SellerSlotLike<TInstance extends WarehouseSellerInstanceLike = WarehouseSellerInstanceLike> = {
  regionId: string;
  provinceId: string;
  countryId: string;
  marketId: string;
  instanceId: string;
  instance: TInstance;
};

export type SellerIndexes<TSlot extends SellerSlotLike = SellerSlotLike> = {
  byRegionGood: Map<string, TSlot[]>;
  byCountryGood: Map<string, TSlot[]>;
  byMarketGood: Map<string, TSlot[]>;
  byGlobalGood: Map<string, TSlot[]>;
};

export const MARKET_PRICE_EPSILON = 0.0001;
export const MARKET_PRICE_HISTORY_LENGTH = 10;
export const DEFAULT_RESOURCE_BASE_PRICE = 1;
export const DEFAULT_TRADEABLE_TRANSPORT_MODES: GoodTransportMode[] = ["land", "sea", "air"];
export const GOOD_DISTRIBUTION_TYPES: GoodDistributionType[] = ["tradeable", "localOnly", "pipeline", "powerGrid", "service"];
export const GOOD_TRANSPORT_MODES: GoodTransportMode[] = ["land", "sea", "air", "pipeline", "powerGrid"];

export type MarketOverviewAlert = {
  id: string;
  severity: "warning" | "critical";
  kind: "critical-deficit" | "infra-overload" | "building-inactive";
  message: string;
  provinceId?: string;
  buildingId?: string;
  instanceId?: string;
  goodId?: string;
};

export type LogisticsFailureReason = "no-corridor" | "no-capacity" | "no-transit";

export type LogisticsFailure = {
  provinceId: string;
  sourceProvinceId?: string | null;
  sourceCountryId?: string | null;
  sourceMarketId?: string | null;
  goodId: string;
  reason: LogisticsFailureReason;
  amount: number;
  transportModes: GoodTransportMode[];
};

export type MarketOverviewState = {
  turnId: number;
  demandByCountry: CountryGoodMap;
  offerByCountry: CountryGoodMap;
  demandGlobal: Record<string, number>;
  offerGlobal: Record<string, number>;
  alertsByCountry: Record<string, MarketOverviewAlert[]>;
  importsByCountryByCountryAndGood: ScopeGoodPartnerMap;
  exportsByCountryByCountryAndGood: ScopeGoodPartnerMap;
  importsByMarketByMarketAndGood: ScopeGoodPartnerMap;
  exportsByMarketByMarketAndGood: ScopeGoodPartnerMap;
  logisticsFailuresByProvince: Record<string, LogisticsFailure[]>;
};

export function createEmptyMarketOverviewState(nextTurnId: number): MarketOverviewState {
  return {
    turnId: Math.max(1, Math.floor(Number(nextTurnId) || 1)),
    demandByCountry: {},
    offerByCountry: {},
    demandGlobal: {},
    offerGlobal: {},
    alertsByCountry: {},
    importsByCountryByCountryAndGood: {},
    exportsByCountryByCountryAndGood: {},
    importsByMarketByMarketAndGood: {},
    exportsByMarketByMarketAndGood: {},
    logisticsFailuresByProvince: {},
  };
}

export function normalizeMarketOverviewState(params: {
  input: unknown;
  fallbackTurnId: number;
  createId: () => string;
}): MarketOverviewState {
  if (!params.input || typeof params.input !== "object") {
    return createEmptyMarketOverviewState(params.fallbackTurnId);
  }
  const row = params.input as Partial<MarketOverviewState>;
  const nextTurnId =
    typeof row.turnId === "number" && Number.isFinite(row.turnId) && row.turnId >= 1
      ? Math.floor(row.turnId)
      : Math.max(1, Math.floor(Number(params.fallbackTurnId) || 1));
  return {
    turnId: nextTurnId,
    demandByCountry: normalizeNumberMapL2(row.demandByCountry),
    offerByCountry: normalizeNumberMapL2(row.offerByCountry),
    demandGlobal: normalizeNumberMap(row.demandGlobal),
    offerGlobal: normalizeNumberMap(row.offerGlobal),
    alertsByCountry: normalizeMarketOverviewAlertsMap({ input: row.alertsByCountry, createId: params.createId }),
    importsByCountryByCountryAndGood: normalizeNumberMapL3(row.importsByCountryByCountryAndGood),
    exportsByCountryByCountryAndGood: normalizeNumberMapL3(row.exportsByCountryByCountryAndGood),
    importsByMarketByMarketAndGood: normalizeNumberMapL3(row.importsByMarketByMarketAndGood),
    exportsByMarketByMarketAndGood: normalizeNumberMapL3(row.exportsByMarketByMarketAndGood),
    logisticsFailuresByProvince: normalizeLogisticsFailuresByProvince(row.logisticsFailuresByProvince),
  };
}

function normalizeNumberMap(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const normalized: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(source)) {
    const nextKey = key.trim();
    if (!nextKey) continue;
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
    normalized[nextKey] = round3(Number(rawValue));
  }
  return normalized;
}

function normalizeNumberMapL2(input: unknown): Record<string, Record<string, number>> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const normalized: Record<string, Record<string, number>> = {};
  for (const [scopeId, rawValue] of Object.entries(source)) {
    const key = scopeId.trim();
    if (!key) continue;
    normalized[key] = normalizeNumberMap(rawValue);
  }
  return normalized;
}

function normalizeNumberMapL3(input: unknown): Record<string, Record<string, Record<string, number>>> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const normalized: Record<string, Record<string, Record<string, number>>> = {};
  for (const [scopeId, rawGoods] of Object.entries(source)) {
    const key = scopeId.trim();
    if (!key || !rawGoods || typeof rawGoods !== "object") continue;
    const goodsMap: Record<string, Record<string, number>> = {};
    for (const [goodId, rawPartners] of Object.entries(rawGoods as Record<string, unknown>)) {
      const goodKey = goodId.trim();
      if (!goodKey) continue;
      goodsMap[goodKey] = normalizeNumberMap(rawPartners);
    }
    normalized[key] = goodsMap;
  }
  return normalized;
}

function normalizeMarketOverviewAlertsMap(params: {
  input: unknown;
  createId: () => string;
}): Record<string, MarketOverviewAlert[]> {
  if (!params.input || typeof params.input !== "object") return {};
  const source = params.input as Record<string, unknown>;
  const normalized: Record<string, MarketOverviewAlert[]> = {};
  for (const [countryId, rawAlerts] of Object.entries(source)) {
    const key = countryId.trim();
    if (!key || !Array.isArray(rawAlerts)) continue;
    const alerts: MarketOverviewAlert[] = [];
    for (const rawAlert of rawAlerts) {
      if (!rawAlert || typeof rawAlert !== "object") continue;
      const row = rawAlert as Record<string, unknown>;
      const severity = row.severity === "critical" ? "critical" : "warning";
      const kindRaw = typeof row.kind === "string" ? row.kind : "";
      const kind: MarketOverviewAlert["kind"] =
        kindRaw === "critical-deficit" || kindRaw === "infra-overload" || kindRaw === "building-inactive"
          ? kindRaw
          : "critical-deficit";
      const message = typeof row.message === "string" ? row.message.trim() : "";
      if (!message) continue;
      alerts.push({
        id: typeof row.id === "string" && row.id.trim() ? row.id : params.createId(),
        severity,
        kind,
        message,
        provinceId: typeof row.provinceId === "string" ? row.provinceId : undefined,
        buildingId: typeof row.buildingId === "string" ? row.buildingId : undefined,
        instanceId: typeof row.instanceId === "string" ? row.instanceId : undefined,
        goodId: typeof row.goodId === "string" ? row.goodId : undefined,
      });
    }
    normalized[key] = alerts;
  }
  return normalized;
}

function normalizeLogisticsFailuresByProvince(input: unknown): Record<string, LogisticsFailure[]> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const normalized: Record<string, LogisticsFailure[]> = {};
  for (const [provinceId, rawFailures] of Object.entries(source)) {
    const key = provinceId.trim();
    if (!key || !Array.isArray(rawFailures)) continue;
    const failures: LogisticsFailure[] = [];
    for (const rawFailure of rawFailures) {
      if (!rawFailure || typeof rawFailure !== "object") continue;
      const row = rawFailure as Record<string, unknown>;
      const goodId = typeof row.goodId === "string" ? row.goodId.trim() : "";
      if (!goodId) continue;
      const reason: LogisticsFailureReason =
        row.reason === "no-capacity" ? "no-capacity" : row.reason === "no-transit" ? "no-transit" : "no-corridor";
      const amount = typeof row.amount === "number" && Number.isFinite(row.amount) ? round3(Math.max(0, row.amount)) : 0;
      if (amount <= 0) continue;
      failures.push({
        provinceId: key,
        sourceProvinceId: typeof row.sourceProvinceId === "string" && row.sourceProvinceId.trim() ? row.sourceProvinceId.trim() : null,
        sourceCountryId: typeof row.sourceCountryId === "string" && row.sourceCountryId.trim() ? row.sourceCountryId.trim() : null,
        sourceMarketId: typeof row.sourceMarketId === "string" && row.sourceMarketId.trim() ? row.sourceMarketId.trim() : null,
        goodId,
        reason,
        amount,
        transportModes: normalizeGoodTransportModesList(row.transportModes, []),
      });
    }
    if (failures.length > 0) normalized[key] = failures;
  }
  return normalized;
}

export function normalizeGoodTransportModesList(
  input: unknown,
  fallback: readonly GoodTransportMode[] = DEFAULT_TRADEABLE_TRANSPORT_MODES,
): GoodTransportMode[] {
  const rows = Array.isArray(input) ? input : fallback;
  const modes = [
    ...new Set(
      rows.filter((row): row is GoodTransportMode => typeof row === "string" && GOOD_TRANSPORT_MODES.includes(row as GoodTransportMode)),
    ),
  ];
  return modes.length > 0 ? modes : [...fallback];
}

export function normalizeTransportMode(input: unknown, fallback: GoodTransportMode = "land"): GoodTransportMode {
  return typeof input === "string" && GOOD_TRANSPORT_MODES.includes(input as GoodTransportMode)
    ? (input as GoodTransportMode)
    : fallback;
}

export function ensureCountryGood(map: CountryGoodMap, countryId: string, goodId: string): void {
  if (!map[countryId]) map[countryId] = {};
  if (map[countryId][goodId] == null) map[countryId][goodId] = 0;
}

export function addCountryGood(map: CountryGoodMap, countryId: string, goodId: string, value: number): void {
  if (value <= 0) return;
  ensureCountryGood(map, countryId, goodId);
  map[countryId][goodId] = round3((map[countryId][goodId] ?? 0) + value);
}

export function addGlobalGood(map: Record<string, number>, goodId: string, value: number): void {
  if (value <= 0) return;
  map[goodId] = round3((map[goodId] ?? 0) + value);
}

export function getPriceMeta(entry: MarketGoodContentEntry | null | undefined): PriceMeta {
  const base = Math.max(0, Number(entry?.basePrice ?? DEFAULT_RESOURCE_BASE_PRICE));
  const min = Math.max(0, Number(entry?.minPrice ?? base * 0.1));
  const max = Math.max(min, Number(entry?.maxPrice ?? base * 10));
  return { base, min, max };
}

export function getGoodPrice(params: {
  pricesByGoodId: Record<string, number>;
  goodId: string;
  meta: PriceMeta;
}): number {
  if (params.pricesByGoodId[params.goodId] == null) {
    params.pricesByGoodId[params.goodId] = round3(params.meta.base);
  }
  return Math.max(params.meta.min, Math.min(params.meta.max, Number(params.pricesByGoodId[params.goodId])));
}

export function updatePrice(params: {
  current: number;
  demand: number;
  offer: number;
  meta: PriceMeta;
  smoothing: number;
}): number {
  const ratio = (params.demand + 1) / (params.offer + 1);
  const target = Math.abs(params.demand - params.offer) <= MARKET_PRICE_EPSILON ? params.meta.base : params.current * ratio;
  const clampedTarget = Math.max(params.meta.min, Math.min(params.meta.max, target));
  const next = params.current * (1 - params.smoothing) + clampedTarget * params.smoothing;
  return round3(Math.max(0.01, Math.max(params.meta.min, Math.min(params.meta.max, next))));
}

export function getInfraPerUnit(entry: MarketGoodContentEntry | null | undefined): number {
  const value = Number(entry?.infrastructureCostPerUnit ?? entry?.infraPerUnit ?? 1);
  return round3(Math.max(0.01, Math.max(0, Number.isFinite(value) ? value : 1)));
}

export function getResourceCategoryId(entry: MarketGoodContentEntry | null | undefined): string | null {
  const raw = entry?.resourceCategoryId;
  if (typeof raw !== "string") return null;
  const next = raw.trim();
  return next.length > 0 ? next : null;
}

export function getGoodDistributionType(entry: MarketGoodContentEntry | null | undefined): GoodDistributionType {
  const raw = entry?.distributionType;
  return raw && GOOD_DISTRIBUTION_TYPES.includes(raw) ? raw : "tradeable";
}

export function getGoodTransportModes(params: {
  entry: MarketGoodContentEntry | null | undefined;
  normalizeTradeableModes: (input: unknown, fallback: readonly GoodTransportMode[]) => GoodTransportMode[];
}): GoodTransportMode[] {
  const distributionType = getGoodDistributionType(params.entry);
  if (distributionType === "pipeline") return ["pipeline"];
  if (distributionType === "powerGrid") return ["powerGrid"];
  if (distributionType === "localOnly" || distributionType === "service") return [];
  return params.normalizeTradeableModes(params.entry?.transportModes, DEFAULT_TRADEABLE_TRANSPORT_MODES);
}

export function buildActiveSanctionsByInitiator<T extends MarketSanctionLike>(
  sanctions: T[],
  turnId: number,
): Map<string, Array<ActiveTradeSanction<T>>> {
  const activeSanctionsByInitiator = new Map<string, Array<ActiveTradeSanction<T>>>();
  for (const sanction of sanctions) {
    if (sanction.enabled === false) continue;
    const startTurn = Math.max(1, Math.floor(Number(sanction.startTurn ?? turnId)));
    const durationTurns = Math.max(1, Math.floor(Number(sanction.durationTurns ?? 1)));
    const expiresAtTurnExclusive = startTurn + durationTurns;
    if (turnId < startTurn || turnId >= expiresAtTurnExclusive) continue;
    const list = activeSanctionsByInitiator.get(sanction.initiatorCountryId) ?? [];
    list.push({
      ...sanction,
      goodsSet: sanction.goods && sanction.goods.length > 0 ? new Set(sanction.goods) : null,
      expiresAtTurnExclusive,
    });
    activeSanctionsByInitiator.set(sanction.initiatorCountryId, list);
  }
  return activeSanctionsByInitiator;
}

export function collectTradeSanctions<T extends MarketSanctionLike>(params: {
  activeSanctionsByInitiator: Map<string, Array<ActiveTradeSanction<T>>>;
  initiatorCountryId: string;
  direction: "import" | "export";
  targetCountryId: string;
  targetMarketId: string;
  goodId: string;
}): Array<ActiveTradeSanction<T>> {
  const list = params.activeSanctionsByInitiator.get(params.initiatorCountryId) ?? [];
  if (list.length === 0) return [];
  return list.filter((sanction) => {
    if (!(sanction.direction === "both" || sanction.direction === params.direction)) return false;
    if (sanction.goodsSet && !sanction.goodsSet.has(params.goodId)) return false;
    if (sanction.targetType === "country") return sanction.targetId === params.targetCountryId;
    return sanction.targetId === params.targetMarketId;
  });
}

export function getLogisticsFailureKey(failure: LogisticsFailureLike): string {
  const modeKey = [...new Set(failure.transportModes)].sort().join("|");
  const sourceKey = failure.sourceProvinceId ?? "";
  return `${failure.provinceId}:${sourceKey}:${failure.goodId}:${failure.reason}:${modeKey}`;
}

export function pushLogisticsFailure<T extends LogisticsFailureLike>(params: {
  failuresByProvince: Record<string, T[]>;
  failureIndex: Map<string, T>;
  failure: T;
}): void {
  if (params.failure.amount <= 0) return;
  const key = getLogisticsFailureKey(params.failure);
  const existing = params.failureIndex.get(key);
  if (existing) {
    existing.amount = round3(existing.amount + params.failure.amount);
    return;
  }
  const next = {
    ...params.failure,
    amount: round3(Math.max(0, params.failure.amount)),
    transportModes: [...new Set(params.failure.transportModes)],
  };
  if (!params.failuresByProvince[next.provinceId]) params.failuresByProvince[next.provinceId] = [];
  params.failuresByProvince[next.provinceId].push(next);
  params.failureIndex.set(key, next);
}

export function createSellerIndexes<TSlot extends SellerSlotLike = SellerSlotLike>(): SellerIndexes<TSlot> {
  return {
    byRegionGood: new Map<string, TSlot[]>(),
    byCountryGood: new Map<string, TSlot[]>(),
    byMarketGood: new Map<string, TSlot[]>(),
    byGlobalGood: new Map<string, TSlot[]>(),
  };
}

export function indexSellerWarehouse<TSlot extends SellerSlotLike>(params: {
  indexes: SellerIndexes<TSlot>;
  slot: TSlot;
  addMarketVolume: (marketId: string, goodId: string, amount: number) => void;
  addGlobalVolume: (goodId: string, amount: number) => void;
}): void {
  for (const [goodId, amountRaw] of Object.entries(params.slot.instance.warehouseByGoodId ?? {})) {
    const amount = round3(Math.max(0, Number(amountRaw)));
    if (amount <= 0) continue;
    pushIndexedSeller(params.indexes.byRegionGood, `${params.slot.regionId}:${goodId}`, params.slot);
    pushIndexedSeller(params.indexes.byCountryGood, `${params.slot.countryId}:${goodId}`, params.slot);
    pushIndexedSeller(params.indexes.byMarketGood, `${params.slot.marketId}:${goodId}`, params.slot);
    pushIndexedSeller(params.indexes.byGlobalGood, goodId, params.slot);
    params.addMarketVolume(params.slot.marketId, goodId, amount);
    params.addGlobalVolume(goodId, amount);
  }
}

export function getScopedSellerList<TSlot extends SellerSlotLike>(params: {
  indexes: SellerIndexes<TSlot>;
  scope: SellerScope;
  goodId: string;
  regionId: string;
  countryId: string;
  marketId: string;
}): TSlot[] {
  if (params.scope === "region") return params.indexes.byRegionGood.get(`${params.regionId}:${params.goodId}`) ?? [];
  if (params.scope === "country") return params.indexes.byCountryGood.get(`${params.countryId}:${params.goodId}`) ?? [];
  if (params.scope === "market") return params.indexes.byMarketGood.get(`${params.marketId}:${params.goodId}`) ?? [];
  return params.indexes.byGlobalGood.get(params.goodId) ?? [];
}

export function getAvailableGoodAmount<TSlot extends SellerSlotLike>(params: {
  indexes: SellerIndexes<TSlot>;
  soldBySellerAndGood: Map<string, number>;
  goodId: string;
}): number {
  const seen = new Set<string>();
  let total = 0;
  for (const seller of params.indexes.byGlobalGood.get(params.goodId) ?? []) {
    const sellerKey = getSellerUsageKey(seller.instance.instanceId, params.goodId);
    if (seen.has(sellerKey)) continue;
    seen.add(sellerKey);
    const warehouse = seller.instance.warehouseByGoodId ?? {};
    total += Math.max(0, Number(warehouse[params.goodId] ?? 0) - Number(params.soldBySellerAndGood.get(sellerKey) ?? 0));
  }
  return round3(total);
}

export function compareSellerPriority<TSlot extends SellerSlotLike>(params: {
  a: TSlot;
  b: TSlot;
  buyerCountryId: string;
  buyerMarketId: string;
}): number {
  const score = (slot: TSlot): number => {
    if (slot.countryId === params.buyerCountryId) return 0;
    if (slot.marketId === params.buyerMarketId) return 1;
    return 2;
  };
  return score(params.a) - score(params.b) || params.a.instanceId.localeCompare(params.b.instanceId);
}

export function getAllowedPurchaseScopes(distributionType: GoodDistributionType): SellerScope[] {
  if (distributionType === "service" || distributionType === "localOnly") return ["region"];
  if (distributionType === "pipeline" || distributionType === "powerGrid") return ["region", "market"];
  return ["region", "country", "market", "global"];
}

export function buildPurchaseScopeOptions<TOption extends { scope: SellerScope }>(params: {
  distributionType: GoodDistributionType;
  options: readonly TOption[];
}): TOption[] {
  const allowedPurchaseScopes = getAllowedPurchaseScopes(params.distributionType);
  return params.options.filter((option) => allowedPurchaseScopes.includes(option.scope));
}

export function purchasePopulationGood<TSlot extends SellerSlotLike>(params: {
  goodId: string;
  requestedPhysicalAmount: number;
  wallet: number;
  distributionType: GoodDistributionType;
  countryUnitPrice: number;
  globalUnitPrice: number;
  getScopedSellerList: (scope: SellerScope, goodId: string) => TSlot[];
  soldBySellerAndGood: Map<string, number>;
}): { purchasedPhysicalAmount: number; spent: number; wallet: number } {
  if (params.requestedPhysicalAmount <= 0 || params.wallet <= 0) {
    return { purchasedPhysicalAmount: 0, spent: 0, wallet: params.wallet };
  }
  let remainingPhysicalAmount = round3(Math.max(0, params.requestedPhysicalAmount));
  let spent = 0;
  let nextWallet = round3(Math.max(0, params.wallet));
  const scopes = buildPurchaseScopeOptions({
    distributionType: params.distributionType,
    options: [
      { scope: "region", unitPrice: Math.max(0.001, params.countryUnitPrice) },
      { scope: "country", unitPrice: Math.max(0.001, params.countryUnitPrice) },
      { scope: "market", unitPrice: Math.max(0.001, params.countryUnitPrice) },
      { scope: "global", unitPrice: Math.max(0.001, params.globalUnitPrice) },
    ] as const,
  });
  for (const { scope, unitPrice } of scopes) {
    if (remainingPhysicalAmount <= 0 || nextWallet <= 0) break;
    for (const seller of params.getScopedSellerList(scope, params.goodId)) {
      if (remainingPhysicalAmount <= 0 || nextWallet <= 0) break;
      const sellerWarehouse = seller.instance.warehouseByGoodId ?? {};
      const soldKey = getSellerUsageKey(seller.instance.instanceId, params.goodId);
      const available = Math.max(0, Number(sellerWarehouse[params.goodId] ?? 0) - Number(params.soldBySellerAndGood.get(soldKey) ?? 0));
      if (available <= 0) continue;
      const amountByMoney = nextWallet / unitPrice;
      const transfer = round3(Math.min(available, amountByMoney, remainingPhysicalAmount));
      if (transfer <= 0) continue;
      const cost = round3(transfer * unitPrice);
      nextWallet = round3(Math.max(0, nextWallet - cost));
      spent = round3(spent + cost);
      remainingPhysicalAmount = round3(Math.max(0, remainingPhysicalAmount - transfer));
      sellerWarehouse[params.goodId] = round3(Math.max(0, Number(sellerWarehouse[params.goodId] ?? 0) - transfer));
      params.soldBySellerAndGood.set(soldKey, round3(Number(params.soldBySellerAndGood.get(soldKey) ?? 0) + transfer));
      seller.instance.warehouseByGoodId = sellerWarehouse;
      seller.instance.ducats = round3(Math.max(0, Number(seller.instance.ducats ?? 0)) + cost);
      seller.instance.lastRevenueDucats = round3(Math.max(0, Number(seller.instance.lastRevenueDucats ?? 0)) + cost);
    }
  }
  return {
    purchasedPhysicalAmount: round3(Math.max(0, params.requestedPhysicalAmount - remainingPhysicalAmount)),
    spent,
    wallet: nextWallet,
  };
}

export function purchaseBuildingInputs<
  TSlot extends SellerSlotLike<BuildingInputPurchaseSellerInstance>,
  TMode extends string,
  TRoute extends BuildingInputPurchaseRoute,
>(params: {
  buyerInstance: BuildingInputPurchaseBuyerInstance;
  inputNeeds: BuildingInputNeed[];
  buyerProvinceId: string;
  buyerCountryId: string;
  buyerMarketId: string;
  getDistributionType: (goodId: string) => GoodDistributionType;
  getCountryGoodPrice: (countryId: string, goodId: string) => number;
  getGlobalGoodPrice: (goodId: string) => number;
  getScopedSellerList: (scope: SellerScope, goodId: string) => TSlot[];
  soldBySellerAndGood: Map<string, number>;
  collectTradeSanctions: (params: {
    initiatorCountryId: string;
    direction: "import" | "export";
    targetCountryId: string;
    targetMarketId: string;
    goodId: string;
  }) => TradeSanctionForPurchase[];
  sanctionUsedAmountById: Record<string, number>;
  getTradePolicy: (params: {
    marketId: string;
    goodId: string;
    otherMarketId: string;
    otherCountryId: string;
  }) => ResolvedTradePolicyLayer;
  getRemainingByPolicyLimit: (
    marketId: string,
    goodId: string,
    direction: "import" | "export",
    scope: string,
    limit: number | null,
  ) => number;
  consumePolicyLimit: (
    marketId: string,
    goodId: string,
    direction: "import" | "export",
    scope: string,
    amount: number,
  ) => void;
  getInfraPerUnit: (goodId: string) => number;
  getTransportModes: (goodId: string) => TMode[];
  getCorridorRoutesForTransfer: (params: {
    buyerMarketId: string;
    buyerProvinceId: string;
    buyerCountryId: string;
    sellerMarketId: string;
    sellerProvinceId: string;
    sellerCountryId: string;
    transportModes: TMode[];
    isExternalTrade: boolean;
    infraPerUnit: number;
    requestedGoods: number;
  }) => TRoute[];
  hasReachableCorridorRouteIgnoringCapacity: (params: {
    buyerMarketId: string;
    buyerProvinceId: string;
    buyerCountryId: string;
    sellerMarketId: string;
    sellerProvinceId: string;
    sellerCountryId: string;
    transportModes: TMode[];
  }) => boolean;
  hasPhysicalCorridorRouteIgnoringTransit: (params: {
    buyerProvinceId: string;
    sellerProvinceId: string;
    transportModes: TMode[];
  }) => boolean;
  getRoutesCapacityInGoods: (routes: TRoute[]) => number;
  consumeCorridorRoutesCapacity: (routes: TRoute[], goodsAmount: number, infraPerUnit: number) => void;
  pushLogisticsFailure: (failure: {
    provinceId: string;
    sourceProvinceId: string;
    sourceCountryId: string;
    sourceMarketId: string;
    goodId: string;
    reason: "no-corridor" | "no-transit" | "no-capacity";
    amount: number;
    transportModes: TMode[];
  }) => void;
  addCountryTrade: (direction: "import" | "export", countryId: string, goodId: string, partnerCountryId: string, amount: number) => void;
  addMarketTrade: (direction: "import" | "export", marketId: string, goodId: string, partnerMarketId: string, amount: number) => void;
}): BuildingInputPurchaseResult {
  let purchaseCost = 0;
  const purchasedByGood: Record<string, number> = {};
  const purchasedCostByGood: Record<string, number> = {};
  const warehouse = params.buyerInstance.warehouseByGoodId ?? {};

  for (const input of params.inputNeeds) {
    const deficit = Math.max(0, input.required - input.available);
    if (deficit <= 0) continue;
    let remainingNeed = round3(deficit);
    if (remainingNeed <= 0) continue;
    type ScopeOption = { scope: SellerScope; unitPrice: number; list: TSlot[] };
    const options = buildPurchaseScopeOptions({
      distributionType: params.getDistributionType(input.goodId),
      options: [
        {
          scope: "region",
          unitPrice: params.getCountryGoodPrice(params.buyerCountryId, input.goodId),
          list: params.getScopedSellerList("region", input.goodId),
        },
        {
          scope: "country",
          unitPrice: params.getCountryGoodPrice(params.buyerCountryId, input.goodId),
          list: params.getScopedSellerList("country", input.goodId),
        },
        {
          scope: "market",
          unitPrice: params.getCountryGoodPrice(params.buyerCountryId, input.goodId),
          list: params.getScopedSellerList("market", input.goodId),
        },
        { scope: "global", unitPrice: params.getGlobalGoodPrice(input.goodId), list: params.getScopedSellerList("global", input.goodId) },
      ] as ScopeOption[],
    });
    options.sort((a, b) => a.unitPrice - b.unitPrice);
    for (const option of options) {
      if (remainingNeed <= 0) break;
      if (option.unitPrice <= 0) continue;
      const affordable = Math.floor((Number(params.buyerInstance.ducats ?? 0) - purchaseCost) / option.unitPrice);
      if (affordable <= 0) continue;
      const sellerCandidates = [...option.list].sort((a, b) =>
        compareSellerPriority({ a, b, buyerCountryId: params.buyerCountryId, buyerMarketId: params.buyerMarketId }),
      );
      for (const seller of sellerCandidates) {
        if (remainingNeed <= 0) break;
        if (seller.instanceId === params.buyerInstance.instanceId) continue;
        const sellerWarehouse = seller.instance.warehouseByGoodId ?? {};
        const sellerAvailable = Math.max(0, Number(sellerWarehouse[input.goodId] ?? 0));
        if (sellerAvailable <= 0) continue;
        const soldKey = getSellerUsageKey(seller.instanceId, input.goodId);
        const soldAlready = params.soldBySellerAndGood.get(soldKey) ?? 0;
        const transferCap = Math.max(0, sellerAvailable - soldAlready);
        if (transferCap <= 0) continue;
        const maxAffordableNow = Math.floor((Number(params.buyerInstance.ducats ?? 0) - purchaseCost) / option.unitPrice);
        if (maxAffordableNow <= 0) break;
        const isExternalTrade = seller.marketId !== params.buyerMarketId;
        const isCrossCountryTrade = seller.countryId !== params.buyerCountryId;
        let applicableCapSanctions: TradeSanctionForPurchase[] = [];
        let maxBySanctions = Number.POSITIVE_INFINITY;
        if (isCrossCountryTrade) {
          const buyerSideSanctions = params.collectTradeSanctions({
            initiatorCountryId: params.buyerCountryId,
            direction: "import",
            targetCountryId: seller.countryId,
            targetMarketId: seller.marketId,
            goodId: input.goodId,
          });
          const sellerSideSanctions = params.collectTradeSanctions({
            initiatorCountryId: seller.countryId,
            direction: "export",
            targetCountryId: params.buyerCountryId,
            targetMarketId: params.buyerMarketId,
            goodId: input.goodId,
          });
          const allSanctions = [...buyerSideSanctions, ...sellerSideSanctions];
          if (allSanctions.some((sanction) => sanction.mode === "ban")) {
            continue;
          }
          applicableCapSanctions = allSanctions.filter((sanction) => sanction.mode === "cap");
          for (const sanction of applicableCapSanctions) {
            const cap = Math.max(0, Number(sanction.capAmountPerTurn ?? 0));
            const used = Math.max(0, Number(params.sanctionUsedAmountById[sanction.id] ?? 0));
            const remaining = round3(Math.max(0, cap - used));
            maxBySanctions = Math.min(maxBySanctions, remaining);
          }
          if (maxBySanctions <= 0) continue;
        }
        let maxByPolicy = Number.POSITIVE_INFINITY;
        let buyerPolicyScope = "all";
        let sellerPolicyScope = "all";
        if (isExternalTrade) {
          const buyerPolicy = params.getTradePolicy({
            marketId: params.buyerMarketId,
            goodId: input.goodId,
            otherMarketId: seller.marketId,
            otherCountryId: seller.countryId,
          });
          const sellerPolicy = params.getTradePolicy({
            marketId: seller.marketId,
            goodId: input.goodId,
            otherMarketId: params.buyerMarketId,
            otherCountryId: params.buyerCountryId,
          });
          if (!buyerPolicy.allowImportFromWorld || !sellerPolicy.allowExportToWorld) {
            continue;
          }
          buyerPolicyScope = buyerPolicy.scopeImport;
          sellerPolicyScope = sellerPolicy.scopeExport;
          const buyerRemainingByPolicy = params.getRemainingByPolicyLimit(
            params.buyerMarketId,
            input.goodId,
            "import",
            buyerPolicy.scopeImport,
            buyerPolicy.maxImportAmountPerTurnFromWorld,
          );
          const sellerRemainingByPolicy = params.getRemainingByPolicyLimit(
            seller.marketId,
            input.goodId,
            "export",
            sellerPolicy.scopeExport,
            sellerPolicy.maxExportAmountPerTurnToWorld,
          );
          maxByPolicy = Math.floor(Math.min(buyerRemainingByPolicy, sellerRemainingByPolicy));
          if (maxByPolicy <= 0) continue;
        }

        let maxByCorridorCapacity = Number.POSITIVE_INFINITY;
        let routesForTransfer: TRoute[] = [];
        const infraPerUnit = params.getInfraPerUnit(input.goodId);
        const transportModes = params.getTransportModes(input.goodId);
        if (transportModes.length > 0) {
          if (params.buyerProvinceId !== seller.provinceId) {
            const requestedByCorridor = Math.min(remainingNeed, transferCap, maxAffordableNow, maxByPolicy, maxBySanctions);
            routesForTransfer = params.getCorridorRoutesForTransfer({
              buyerMarketId: params.buyerMarketId,
              buyerProvinceId: params.buyerProvinceId,
              buyerCountryId: params.buyerCountryId,
              sellerMarketId: seller.marketId,
              sellerProvinceId: seller.provinceId,
              sellerCountryId: seller.countryId,
              transportModes,
              isExternalTrade,
              infraPerUnit,
              requestedGoods: requestedByCorridor,
            });
            if (routesForTransfer.length === 0) {
              const hasReachableRoute = params.hasReachableCorridorRouteIgnoringCapacity({
                buyerMarketId: params.buyerMarketId,
                buyerProvinceId: params.buyerProvinceId,
                buyerCountryId: params.buyerCountryId,
                sellerMarketId: seller.marketId,
                sellerProvinceId: seller.provinceId,
                sellerCountryId: seller.countryId,
                transportModes,
              });
              const hasPhysicalRoute = hasReachableRoute || params.hasPhysicalCorridorRouteIgnoringTransit({
                buyerProvinceId: params.buyerProvinceId,
                sellerProvinceId: seller.provinceId,
                transportModes,
              });
              params.pushLogisticsFailure({
                provinceId: params.buyerProvinceId,
                sourceProvinceId: seller.provinceId,
                sourceCountryId: seller.countryId,
                sourceMarketId: seller.marketId,
                goodId: input.goodId,
                reason: hasReachableRoute ? "no-capacity" : hasPhysicalRoute ? "no-transit" : "no-corridor",
                amount: remainingNeed,
                transportModes,
              });
              if (isExternalTrade) {
                continue;
              }
              remainingNeed = 0;
              break;
            }
            maxByCorridorCapacity = params.getRoutesCapacityInGoods(routesForTransfer);
            if (maxByCorridorCapacity <= 0) {
              params.pushLogisticsFailure({
                provinceId: params.buyerProvinceId,
                sourceProvinceId: seller.provinceId,
                sourceCountryId: seller.countryId,
                sourceMarketId: seller.marketId,
                goodId: input.goodId,
                reason: "no-capacity",
                amount: remainingNeed,
                transportModes,
              });
              if (isExternalTrade) {
                continue;
              }
              remainingNeed = 0;
              break;
            }
          }
        }

        const transfer = round3(Math.min(remainingNeed, transferCap, maxAffordableNow, maxByCorridorCapacity, maxByPolicy, maxBySanctions));
        if (transfer <= 0) continue;
        remainingNeed = round3(Math.max(0, remainingNeed - transfer));
        const transferCost = round3(transfer * option.unitPrice);
        if (seller.countryId !== params.buyerCountryId) {
          params.addCountryTrade("import", params.buyerCountryId, input.goodId, seller.countryId, transfer);
          params.addCountryTrade("export", seller.countryId, input.goodId, params.buyerCountryId, transfer);
        }
        if (isExternalTrade) {
          params.addMarketTrade("import", params.buyerMarketId, input.goodId, seller.marketId, transfer);
          params.addMarketTrade("export", seller.marketId, input.goodId, params.buyerMarketId, transfer);
        }
        if (transportModes.length > 0) {
          params.consumeCorridorRoutesCapacity(routesForTransfer, transfer, infraPerUnit);
        }
        if (isExternalTrade) {
          params.consumePolicyLimit(params.buyerMarketId, input.goodId, "import", buyerPolicyScope, transfer);
          params.consumePolicyLimit(seller.marketId, input.goodId, "export", sellerPolicyScope, transfer);
        }
        for (const sanction of applicableCapSanctions) {
          params.sanctionUsedAmountById[sanction.id] = round3(
            Math.max(0, Number(params.sanctionUsedAmountById[sanction.id] ?? 0)) + transfer,
          );
        }
        purchaseCost = round3(purchaseCost + transferCost);
        purchasedByGood[input.goodId] = round3((purchasedByGood[input.goodId] ?? 0) + transfer);
        purchasedCostByGood[input.goodId] = round3((purchasedCostByGood[input.goodId] ?? 0) + transferCost);
        sellerWarehouse[input.goodId] = round3(Math.max(0, sellerAvailable - transfer));
        seller.instance.warehouseByGoodId = sellerWarehouse;
        const revenueDelta = transferCost;
        seller.instance.ducats = round3(Math.max(0, Number(seller.instance.ducats ?? 0)) + revenueDelta);
        seller.instance.lastRevenueDucats = round3(Math.max(0, Number(seller.instance.lastRevenueDucats ?? 0)) + revenueDelta);
        const sellerSales = seller.instance.lastSalesByGoodId ?? {};
        sellerSales[input.goodId] = round3(Math.max(0, Number(sellerSales[input.goodId] ?? 0)) + transfer);
        seller.instance.lastSalesByGoodId = sellerSales;
        const sellerSalesRevenue = seller.instance.lastSalesRevenueByGoodId ?? {};
        sellerSalesRevenue[input.goodId] = round3(Math.max(0, Number(sellerSalesRevenue[input.goodId] ?? 0)) + revenueDelta);
        seller.instance.lastSalesRevenueByGoodId = sellerSalesRevenue;
        params.soldBySellerAndGood.set(soldKey, round3(soldAlready + transfer));
      }
    }
  }

  for (const [goodId, amount] of Object.entries(purchasedByGood)) {
    warehouse[goodId] = round3(Math.max(0, Number(warehouse[goodId] ?? 0) + amount));
  }
  params.buyerInstance.warehouseByGoodId = warehouse;
  return {
    purchaseCost: round3(purchaseCost),
    purchasedByGood,
    purchasedCostByGood,
  };
}

export function resolveTradePolicyLayer(
  base: MarketTradePolicyLike | undefined,
  otherMarketId: string,
  otherCountryId: string,
): ResolvedTradePolicyLayer {
  const byCountry = base?.overridesByCountryId?.[otherCountryId];
  const byMarket = base?.overridesByMarketId?.[otherMarketId];
  const layer = byCountry ?? byMarket ?? base;
  const scope = byCountry ? `country:${otherCountryId}` : byMarket ? `market:${otherMarketId}` : "all";
  return {
    allowImportFromWorld: layer?.allowImportFromWorld ?? true,
    allowExportToWorld: layer?.allowExportToWorld ?? true,
    maxImportAmountPerTurnFromWorld:
      typeof layer?.maxImportAmountPerTurnFromWorld === "number" && Number.isFinite(layer.maxImportAmountPerTurnFromWorld)
        ? Math.max(0, layer.maxImportAmountPerTurnFromWorld)
        : null,
    maxExportAmountPerTurnToWorld:
      typeof layer?.maxExportAmountPerTurnToWorld === "number" && Number.isFinite(layer.maxExportAmountPerTurnToWorld)
        ? Math.max(0, layer.maxExportAmountPerTurnToWorld)
        : null,
    scopeImport: scope,
    scopeExport: scope,
  };
}

export function finalizeMarketTurn<
  TMarketRecord extends MarketTurnRecordLike,
  TCorridor extends MarketTurnCorridorLike,
  TAlert,
  TLogisticsFailure,
>(params: {
  turnId: number;
  marketIds: Iterable<string>;
  countryIds: Iterable<string>;
  goodIds: string[];
  demandRequestedByCountry: CountryGoodMap;
  productionByCountry: CountryGoodMap;
  productionMaxByCountry: CountryGoodMap;
  marketVolumeByCountry: CountryGoodMap;
  countryGoodPrices: CountryGoodMap;
  demandRequestedGlobal: Record<string, number>;
  productionGlobal: Record<string, number>;
  productionMaxGlobal: Record<string, number>;
  marketVolumeGlobal: Record<string, number>;
  globalGoodPrices: Record<string, number>;
  globalGoodPriceHistoryByResourceId: Record<string, number[]>;
  globalGoodDemandHistoryByResourceId: Record<string, number[]>;
  globalGoodOfferHistoryByResourceId: Record<string, number[]>;
  globalGoodProductionFactHistoryByResourceId: Record<string, number[]>;
  globalGoodProductionMaxHistoryByResourceId: Record<string, number[]>;
  importsByCountryByCountryAndGood: ScopeGoodPartnerMap;
  exportsByCountryByCountryAndGood: ScopeGoodPartnerMap;
  importsByMarketByMarketAndGood: ScopeGoodPartnerMap;
  exportsByMarketByMarketAndGood: ScopeGoodPartnerMap;
  logisticsFailuresByProvince: Record<string, TLogisticsFailure[]>;
  alertsByCountry: Record<string, TAlert[]>;
  corridors: TCorridor[];
  corridorLoadByModeByCorridorId: Record<string, Record<string, number>>;
  corridorLoadHistoryLength: number;
  getMarketRecord: (marketId: string) => TMarketRecord;
  getCountryMarketId: (countryId: string) => string;
  getMarketGoodPrice: (marketId: string, goodId: string) => number;
  getGlobalGoodPrice: (goodId: string) => number;
  getPriceMeta: (goodId: string) => PriceMeta;
  updatePrice: (current: number, demand: number, offer: number, meta: PriceMeta) => number;
  getTransportCorridorCapacity: (corridor: TCorridor) => number;
  pushCountryAlert: (countryId: string, alert: {
    severity: "critical";
    kind: "critical-deficit";
    message: string;
    goodId: string;
  }) => void;
}): MarketTurnOverview<TAlert, TLogisticsFailure> {
  const marketIds = new Set(params.marketIds);
  for (const marketId of marketIds) {
    if (!params.countryGoodPrices[marketId]) params.countryGoodPrices[marketId] = {};
    const keys = new Set<string>([
      ...Object.keys(params.demandRequestedByCountry[marketId] ?? {}),
      ...Object.keys(params.productionByCountry[marketId] ?? {}),
      ...Object.keys(params.marketVolumeByCountry[marketId] ?? {}),
      ...Object.keys(params.countryGoodPrices[marketId] ?? {}),
      ...params.goodIds,
    ]);
    const marketRecord = params.getMarketRecord(marketId);
    marketRecord.priceByResourceId ??= {};
    marketRecord.warehouseByResourceId ??= {};
    marketRecord.priceHistoryByResourceId ??= {};
    marketRecord.demandHistoryByResourceId ??= {};
    marketRecord.offerHistoryByResourceId ??= {};
    marketRecord.productionFactHistoryByResourceId ??= {};
    marketRecord.productionMaxHistoryByResourceId ??= {};
    for (const goodId of keys) {
      const current = params.getMarketGoodPrice(marketId, goodId);
      const demand = Number(params.demandRequestedByCountry[marketId]?.[goodId] ?? 0);
      const offerFact = Number(params.productionByCountry[marketId]?.[goodId] ?? 0);
      const marketVolume = Number(params.marketVolumeByCountry[marketId]?.[goodId] ?? 0);
      const importsTotal = getScopeGoodTradeTotal(params.importsByMarketByMarketAndGood, marketId, goodId);
      const exportsTotal = getScopeGoodTradeTotal(params.exportsByMarketByMarketAndGood, marketId, goodId);
      const netTrade = round3(importsTotal - exportsTotal);
      const offer = Math.max(0, round3(offerFact + marketVolume + netTrade));
      const adjustedWarehouse = Math.max(0, round3(marketVolume + netTrade));
      const nextPrice = params.updatePrice(current, demand, offer, params.getPriceMeta(goodId));
      params.countryGoodPrices[marketId][goodId] = nextPrice;
      marketRecord.priceByResourceId[goodId] = nextPrice;
      marketRecord.warehouseByResourceId[goodId] = adjustedWarehouse;
      pushHistory(marketRecord.priceHistoryByResourceId, goodId, nextPrice);
      pushHistory(marketRecord.demandHistoryByResourceId, goodId, demand);
      pushHistory(marketRecord.offerHistoryByResourceId, goodId, offer);
      pushHistory(marketRecord.productionFactHistoryByResourceId, goodId, offerFact);
      pushHistory(marketRecord.productionMaxHistoryByResourceId, goodId, Number(params.productionMaxByCountry[marketId]?.[goodId] ?? 0));
    }
  }

  const globalKeys = new Set<string>([
    ...Object.keys(params.demandRequestedGlobal),
    ...Object.keys(params.productionGlobal),
    ...Object.keys(params.productionMaxGlobal),
    ...Object.keys(params.marketVolumeGlobal),
    ...Object.keys(params.globalGoodPrices),
    ...params.goodIds,
  ]);
  for (const goodId of globalKeys) {
    const current = params.getGlobalGoodPrice(goodId);
    const demand = Number(params.demandRequestedGlobal[goodId] ?? 0);
    const offerFact = Number(params.productionGlobal[goodId] ?? 0);
    const marketVolume = Number(params.marketVolumeGlobal[goodId] ?? 0);
    const offer = offerFact + marketVolume;
    const nextPrice = params.updatePrice(current, demand, offer, params.getPriceMeta(goodId));
    params.globalGoodPrices[goodId] = nextPrice;
    pushHistory(params.globalGoodPriceHistoryByResourceId, goodId, nextPrice);
    pushHistory(params.globalGoodDemandHistoryByResourceId, goodId, demand);
    pushHistory(params.globalGoodOfferHistoryByResourceId, goodId, offer);
    pushHistory(params.globalGoodProductionFactHistoryByResourceId, goodId, offerFact);
    pushHistory(params.globalGoodProductionMaxHistoryByResourceId, goodId, Number(params.productionMaxGlobal[goodId] ?? 0));
  }

  for (const countryId of params.countryIds) {
    const marketId = params.getCountryMarketId(countryId);
    const demand = params.demandRequestedByCountry[marketId] ?? {};
    const offerProduced = params.productionByCountry[marketId] ?? {};
    const offerStock = params.marketVolumeByCountry[marketId] ?? {};
    for (const goodId of Object.keys(demand)) {
      const d = Number(demand[goodId] ?? 0);
      if (d <= 0) continue;
      const importsTotal = getScopeGoodTradeTotal(params.importsByMarketByMarketAndGood, marketId, goodId);
      const exportsTotal = getScopeGoodTradeTotal(params.exportsByMarketByMarketAndGood, marketId, goodId);
      const netTrade = round3(importsTotal - exportsTotal);
      const o = Math.max(0, Number(offerProduced[goodId] ?? 0) + Number(offerStock[goodId] ?? 0) + netTrade);
      const coverage = d > 0 ? o / d : 1;
      if (coverage < 0.5) {
        params.pushCountryAlert(countryId, {
          severity: "critical",
          kind: "critical-deficit",
          message: `Критический дефицит ${goodId}: покрытие ${(coverage * 100).toFixed(1)}%`,
          goodId,
        });
      }
    }
  }

  const offerByCountry: CountryGoodMap = {};
  for (const marketId of marketIds) {
    const keys = new Set<string>([
      ...Object.keys(params.productionByCountry[marketId] ?? {}),
      ...Object.keys(params.marketVolumeByCountry[marketId] ?? {}),
    ]);
    offerByCountry[marketId] = {};
    for (const goodId of keys) {
      const produced = Number(params.productionByCountry[marketId]?.[goodId] ?? 0);
      const stock = Number(params.marketVolumeByCountry[marketId]?.[goodId] ?? 0);
      const importsTotal = getScopeGoodTradeTotal(params.importsByMarketByMarketAndGood, marketId, goodId);
      const exportsTotal = getScopeGoodTradeTotal(params.exportsByMarketByMarketAndGood, marketId, goodId);
      const netTrade = round3(importsTotal - exportsTotal);
      offerByCountry[marketId][goodId] = round3(Math.max(0, produced + stock + netTrade));
    }
  }
  const offerGlobal: Record<string, number> = {};
  for (const goodId of new Set<string>([...Object.keys(params.productionGlobal), ...Object.keys(params.marketVolumeGlobal)])) {
    const produced = Number(params.productionGlobal[goodId] ?? 0);
    const stock = Number(params.marketVolumeGlobal[goodId] ?? 0);
    offerGlobal[goodId] = round3(produced + stock);
  }

  for (const corridor of params.corridors) {
    const nextLoadByMode = normalizeAmountRecord(params.corridorLoadByModeByCorridorId[corridor.id] ?? {});
    corridor.lastLoadByMode = nextLoadByMode;
    corridor.lastCapacityByMode = { [corridor.transportMode]: params.getTransportCorridorCapacity(corridor) };
    const previousHistory = normalizeHistoryRecord(corridor.lastLoadHistoryByMode ?? {});
    const modeIds = new Set<string>([
      ...Object.keys(previousHistory),
      ...Object.keys(nextLoadByMode),
      ...Object.keys(corridor.lastCapacityByMode ?? {}),
    ]);
    const nextHistory: Record<string, number[]> = {};
    for (const modeId of modeIds) {
      const previousValues = (previousHistory[modeId] ?? []).map((value) => round3(Math.max(0, value)));
      const nextValue = round3(Math.max(0, Number(nextLoadByMode[modeId] ?? 0)));
      nextHistory[modeId] = [...previousValues, nextValue].slice(-Math.max(1, params.corridorLoadHistoryLength));
    }
    corridor.lastLoadHistoryByMode = nextHistory;
  }

  return {
    turnId: params.turnId,
    demandByCountry: structuredClone(params.demandRequestedByCountry),
    offerByCountry,
    demandGlobal: structuredClone(params.demandRequestedGlobal),
    offerGlobal,
    alertsByCountry: params.alertsByCountry,
    importsByCountryByCountryAndGood: params.importsByCountryByCountryAndGood,
    exportsByCountryByCountryAndGood: params.exportsByCountryByCountryAndGood,
    importsByMarketByMarketAndGood: params.importsByMarketByMarketAndGood,
    exportsByMarketByMarketAndGood: params.exportsByMarketByMarketAndGood,
    logisticsFailuresByProvince: params.logisticsFailuresByProvince,
  };
}

export function addCategoryAmount(map: CategoryAmountMap, scopeId: string, categoryId: string, value: number): void {
  if (!scopeId || !categoryId || value <= 0) return;
  if (!map[scopeId]) map[scopeId] = {};
  map[scopeId][categoryId] = round3((map[scopeId][categoryId] ?? 0) + value);
}

export function addScopeGoodPartnerAmount(
  map: ScopeGoodPartnerMap,
  scopeId: string,
  goodId: string,
  partnerId: string,
  value: number,
): void {
  if (!scopeId || !goodId || !partnerId || value <= 0) return;
  if (!map[scopeId]) map[scopeId] = {};
  if (!map[scopeId][goodId]) map[scopeId][goodId] = {};
  map[scopeId][goodId][partnerId] = round3((map[scopeId][goodId][partnerId] ?? 0) + value);
}

export function getScopeGoodTradeTotal(map: ScopeGoodPartnerMap, scopeId: string, goodId: string): number {
  const byPartner = map[scopeId]?.[goodId] ?? {};
  return round3(Object.values(byPartner).reduce((sum, value) => sum + Math.max(0, Number(value ?? 0)), 0));
}

export function getWorldTradeUsageKey(
  marketId: string,
  goodId: string,
  direction: "import" | "export",
  scope: string,
): string {
  return `${marketId}::${goodId}::${direction}::${scope}`;
}

export function getRemainingByPolicyLimit(params: {
  worldTradeUsedAmountByScope: Record<string, number>;
  marketId: string;
  goodId: string;
  direction: "import" | "export";
  scope: string;
  limit: number | null;
}): number {
  if (params.limit == null) return Number.POSITIVE_INFINITY;
  const used = Number(params.worldTradeUsedAmountByScope[getWorldTradeUsageKey(params.marketId, params.goodId, params.direction, params.scope)] ?? 0);
  return Math.max(0, round3(params.limit - used));
}

export function consumePolicyLimit(params: {
  worldTradeUsedAmountByScope: Record<string, number>;
  marketId: string;
  goodId: string;
  direction: "import" | "export";
  scope: string;
  amount: number;
}): void {
  if (params.amount <= 0) return;
  const key = getWorldTradeUsageKey(params.marketId, params.goodId, params.direction, params.scope);
  params.worldTradeUsedAmountByScope[key] = round3((params.worldTradeUsedAmountByScope[key] ?? 0) + params.amount);
}

export function pushHistory(map: Record<string, number[]>, key: string, value: number): void {
  const prev = map[key] ?? [];
  map[key] = [...prev, round3(value)].slice(-MARKET_PRICE_HISTORY_LENGTH);
}

export function getSellerUsageKey(instanceId: string, goodId: string): string {
  return `${instanceId}:${goodId}`;
}

function pushIndexedSeller<TSlot extends SellerSlotLike>(map: Map<string, TSlot[]>, key: string, slot: TSlot): void {
  const list = map.get(key) ?? [];
  list.push(slot);
  map.set(key, list);
}

function normalizeAmountRecord(input: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    const amount = round3(Math.max(0, Number(value ?? 0)));
    if (amount > 0) next[key] = amount;
  }
  return next;
}

function normalizeHistoryRecord(input: Record<string, number[]>): Record<string, number[]> {
  const next: Record<string, number[]> = {};
  for (const [key, values] of Object.entries(input)) {
    if (!Array.isArray(values)) continue;
    const cleaned = values.map((value) => round3(Math.max(0, Number(value ?? 0)))).filter((value) => Number.isFinite(value));
    if (cleaned.length > 0) next[key] = cleaned;
  }
  return next;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
