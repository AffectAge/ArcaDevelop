import type { ResourceFlowSourceType, ResourceId, ResourceTotals } from "@arcanorum/shared";

export type TransportCorridorConstructionEntry = {
  id: string;
  ownerCountryId: string;
  status: "building" | "active" | "closed";
  progressConstruction: number;
  costConstruction: number;
  completedAt?: string | null;
};

export type TransportCorridorConstructionWorldState = {
  resourcesByCountry: Record<string, ResourceTotals>;
};

export type TransportCorridorLedgerFlowInput = {
  countryId: string;
  resourceId: ResourceId;
  amount: number;
  sourceType: ResourceFlowSourceType;
  sourceId: string;
  categoryId: string;
  labelKey: string;
  labelParams?: Record<string, string | number | boolean | null>;
  metadata?: Record<string, string | number | boolean | null>;
};

export type TransportCorridorRouteEntry<TMode extends string = string> = {
  id: string;
  ownerCountryId: string;
  marketId?: string | null;
  status: "building" | "active" | "closed";
  transportMode: TMode;
  provinceIds?: string[];
  routePoints?: Array<{ provinceId: string }>;
  level?: number | null;
};

export type CorridorTransferRoute<
  TMode extends string = string,
  TCorridor extends TransportCorridorRouteEntry<TMode> = TransportCorridorRouteEntry<TMode>,
> = {
  mode: TMode;
  corridors: TCorridor[];
  capacityGoods: number;
  cost: number;
};

type CorridorRoutePlannerContext<
  TMode extends string,
  TCorridor extends TransportCorridorRouteEntry<TMode>,
> = {
  corridorsById: Record<string, TCorridor>;
  provinceOwnerById: Record<string, string | undefined>;
  getCorridorCapacity: (corridor: TCorridor) => number;
  getCorridorLoad: (corridorId: string, transportMode: TMode) => number;
  getMarketMemberCountryIds: (marketId: string) => string[];
  getTransitAllowedCountries: (memberCountryIds: Set<string>, transportMode: TMode) => Set<string>;
  normalizeProvinceIds: (provinceIds: unknown) => string[];
};

export function getCorridorRouteProvinceIds<TMode extends string, TCorridor extends TransportCorridorRouteEntry<TMode>>(
  corridor: TCorridor,
  normalizeProvinceIds: (provinceIds: unknown) => string[],
): string[] {
  return normalizeProvinceIds(
    corridor.routePoints && corridor.routePoints.length >= 2
      ? corridor.routePoints.map((point) => point.provinceId)
      : corridor.provinceIds,
  );
}

export function createCorridorRoutePlanner<
  TMode extends string,
  TCorridor extends TransportCorridorRouteEntry<TMode>,
>(context: CorridorRoutePlannerContext<TMode, TCorridor>) {
  type RouteGraph = Map<string, Array<{ to: string; corridor: TCorridor; cost: number }>>;
  const routeGraphCache = new Map<string, RouteGraph>();
  const corridorRouteCache = new Map<string, { mode: TMode; corridorIds: string[]; cost: number } | null>();

  const getCorridorRemainingCapacity = (corridorId: string, transportMode: TMode): number => {
    const corridor = context.corridorsById[corridorId];
    if (!corridor) return 0;
    return round3(Math.max(0, context.getCorridorCapacity(corridor) - context.getCorridorLoad(corridorId, transportMode)));
  };

  const getTradeTransitAllowedCountries = (params: {
    buyerMarketId: string;
    buyerCountryId: string;
    sellerMarketId: string;
    sellerCountryId: string;
    transportMode: TMode;
  }): Set<string> => {
    const commonMarketMembers = new Set<string>([
      ...context.getMarketMemberCountryIds(params.buyerMarketId),
      ...context.getMarketMemberCountryIds(params.sellerMarketId),
      params.buyerCountryId,
      params.sellerCountryId,
    ].filter(Boolean));
    return context.getTransitAllowedCountries(commonMarketMembers, params.transportMode);
  };

  const getRouteGraph = (params: {
    buyerMarketId: string;
    buyerCountryId: string;
    sellerMarketId: string;
    sellerCountryId: string;
    transportMode: TMode;
  }): RouteGraph => {
    const allowedCountries = getTradeTransitAllowedCountries(params);
    const graphKey = [params.transportMode, [...allowedCountries].sort().join(",")].join(":");
    const cached = routeGraphCache.get(graphKey);
    if (cached) return cached;
    const graph: RouteGraph = new Map();
    const addEdge = (from: string, to: string, corridor: TCorridor, cost: number): void => {
      if (!graph.has(from)) graph.set(from, []);
      graph.get(from)?.push({ to, corridor, cost });
    };
    for (const corridor of Object.values(context.corridorsById ?? {})) {
      if (corridor.status !== "active") continue;
      if (corridor.transportMode !== params.transportMode) continue;
      if (!allowedCountries.has(corridor.ownerCountryId)) continue;
      const provinceIds = getCorridorRouteProvinceIds(corridor, context.normalizeProvinceIds);
      if (provinceIds.length < 2) continue;
      const corridorProvinceOwnersAllowed = provinceIds.every((provinceId) => {
        const ownerId = context.provinceOwnerById[provinceId] ?? null;
        return !ownerId || allowedCountries.has(ownerId);
      });
      if (!corridorProvinceOwnersAllowed) continue;
      for (let index = 1; index < provinceIds.length; index += 1) {
        const from = provinceIds[index - 1];
        const to = provinceIds[index];
        const capacity = Math.max(0, context.getCorridorCapacity(corridor));
        const remaining = Math.max(0, getCorridorRemainingCapacity(corridor.id, corridor.transportMode));
        const utilization = capacity > 0 ? 1 - remaining / capacity : 1;
        let cost = 1 + utilization * 8;
        if (corridor.ownerCountryId === params.buyerCountryId || corridor.ownerCountryId === params.sellerCountryId) cost -= 0.35;
        if (corridor.marketId === params.buyerMarketId || corridor.marketId === params.sellerMarketId) cost -= 0.25;
        cost -= Math.max(0, Math.floor(Number(corridor.level ?? 1))) * 0.03;
        addEdge(from, to, corridor, Math.max(0.05, cost));
        addEdge(to, from, corridor, Math.max(0.05, cost));
      }
    }
    routeGraphCache.set(graphKey, graph);
    return graph;
  };

  const findBestCorridorRoute = (params: {
    buyerMarketId: string;
    buyerProvinceId: string;
    buyerCountryId: string;
    sellerMarketId: string;
    sellerProvinceId: string;
    sellerCountryId: string;
    transportModes: TMode[];
    infraPerUnit: number;
    virtualRemainingByCorridorId: Map<string, number>;
    blockedCorridorIds?: Set<string>;
  }): CorridorTransferRoute<TMode, TCorridor> | null => {
    if (params.buyerProvinceId === params.sellerProvinceId) return null;
    let best: CorridorTransferRoute<TMode, TCorridor> | null = null;
    for (const mode of params.transportModes) {
      const cacheKey = [
        mode,
        params.buyerMarketId,
        params.sellerMarketId,
        params.buyerCountryId,
        params.sellerCountryId,
        params.sellerProvinceId,
        params.buyerProvinceId,
        params.infraPerUnit,
        [...(params.blockedCorridorIds ?? new Set<string>())].sort().join(","),
      ].join("|");
      const cached = corridorRouteCache.get(cacheKey);
      if (cached === null) continue;
      if (cached) {
        const corridors = cached.corridorIds
          .map((corridorId) => context.corridorsById[corridorId])
          .filter((corridor): corridor is TCorridor => Boolean(corridor));
        if (
          corridors.length > 0 &&
          corridors.every((corridor) =>
            (params.virtualRemainingByCorridorId.get(corridor.id) ??
              getCorridorRemainingCapacity(corridor.id, corridor.transportMode)) >= params.infraPerUnit,
          )
        ) {
          const bottleneck = Math.min(
            ...corridors.map((corridor) =>
              params.virtualRemainingByCorridorId.get(corridor.id) ??
              getCorridorRemainingCapacity(corridor.id, corridor.transportMode),
            ),
          );
          const route = { mode: cached.mode, corridors, capacityGoods: Math.floor(bottleneck / params.infraPerUnit), cost: cached.cost };
          if (route.capacityGoods > 0 && (!best || route.cost < best.cost)) best = route;
          continue;
        }
      }

      const graph = getRouteGraph({ ...params, transportMode: mode });
      const distances = new Map<string, number>([[params.sellerProvinceId, 0]]);
      const previous = new Map<string, { provinceId: string; corridor: TCorridor }>();
      const queue: Array<{ provinceId: string; distance: number }> = [{ provinceId: params.sellerProvinceId, distance: 0 }];
      const visited = new Set<string>();
      while (queue.length > 0) {
        queue.sort((a, b) => a.distance - b.distance);
        const current = queue.shift();
        if (!current) break;
        if (visited.has(current.provinceId)) continue;
        visited.add(current.provinceId);
        if (current.provinceId === params.buyerProvinceId) break;
        for (const edge of graph.get(current.provinceId) ?? []) {
          if (params.blockedCorridorIds?.has(edge.corridor.id)) continue;
          const remaining = params.virtualRemainingByCorridorId.get(edge.corridor.id) ??
            getCorridorRemainingCapacity(edge.corridor.id, edge.corridor.transportMode);
          if (remaining < params.infraPerUnit) continue;
          const nextDistance = current.distance + edge.cost;
          if (nextDistance >= (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue;
          distances.set(edge.to, nextDistance);
          previous.set(edge.to, { provinceId: current.provinceId, corridor: edge.corridor });
          queue.push({ provinceId: edge.to, distance: nextDistance });
        }
      }
      if (!previous.has(params.buyerProvinceId)) {
        corridorRouteCache.set(cacheKey, null);
        continue;
      }
      const corridors: TCorridor[] = [];
      let cursor = params.buyerProvinceId;
      while (cursor !== params.sellerProvinceId) {
        const step = previous.get(cursor);
        if (!step) break;
        if (!corridors.some((corridor) => corridor.id === step.corridor.id)) corridors.unshift(step.corridor);
        cursor = step.provinceId;
      }
      if (corridors.length === 0) {
        corridorRouteCache.set(cacheKey, null);
        continue;
      }
      const bottleneck = Math.min(
        ...corridors.map((corridor) =>
          params.virtualRemainingByCorridorId.get(corridor.id) ??
          getCorridorRemainingCapacity(corridor.id, corridor.transportMode),
        ),
      );
      const route = {
        mode,
        corridors,
        capacityGoods: Math.floor(Math.max(0, bottleneck) / params.infraPerUnit),
        cost: distances.get(params.buyerProvinceId) ?? Number.POSITIVE_INFINITY,
      };
      corridorRouteCache.set(cacheKey, { mode, corridorIds: corridors.map((corridor) => corridor.id), cost: route.cost });
      if (route.capacityGoods > 0 && (!best || route.cost < best.cost)) best = route;
    }
    return best;
  };

  const getCorridorRoutesForTransfer = (params: {
    buyerMarketId: string;
    buyerProvinceId: string;
    buyerCountryId: string;
    sellerMarketId: string;
    sellerProvinceId: string;
    sellerCountryId: string;
    transportModes: TMode[];
    infraPerUnit: number;
    requestedGoods: number;
  }): Array<CorridorTransferRoute<TMode, TCorridor>> => {
    if (params.buyerProvinceId === params.sellerProvinceId) return [];
    const routes: Array<CorridorTransferRoute<TMode, TCorridor>> = [];
    const virtualRemainingByCorridorId = new Map<string, number>();
    const blockedCorridorIds = new Set<string>();
    let remainingGoods = Math.max(0, Math.floor(params.requestedGoods));
    while (remainingGoods > 0) {
      const route = findBestCorridorRoute({ ...params, virtualRemainingByCorridorId, blockedCorridorIds });
      if (!route || route.capacityGoods <= 0) break;
      const goodsOnRoute = Math.min(remainingGoods, route.capacityGoods);
      routes.push({ ...route, capacityGoods: goodsOnRoute });
      const infraOnRoute = round3(goodsOnRoute * params.infraPerUnit);
      for (const corridor of route.corridors) {
        const current = virtualRemainingByCorridorId.get(corridor.id) ??
          getCorridorRemainingCapacity(corridor.id, corridor.transportMode);
        const next = round3(Math.max(0, current - infraOnRoute));
        virtualRemainingByCorridorId.set(corridor.id, next);
        if (next < params.infraPerUnit) blockedCorridorIds.add(corridor.id);
      }
      remainingGoods -= goodsOnRoute;
    }
    return routes;
  };

  const hasReachableCorridorRouteIgnoringCapacity = (params: {
    buyerMarketId: string;
    buyerProvinceId: string;
    buyerCountryId: string;
    sellerMarketId: string;
    sellerProvinceId: string;
    sellerCountryId: string;
    transportModes: TMode[];
  }): boolean => {
    const virtualRemainingByCorridorId = new Map<string, number>();
    for (const corridor of Object.values(context.corridorsById ?? {})) {
      virtualRemainingByCorridorId.set(corridor.id, Math.max(0, context.getCorridorCapacity(corridor)));
    }
    return Boolean(findBestCorridorRoute({
      ...params,
      infraPerUnit: 0.01,
      virtualRemainingByCorridorId,
    }));
  };

  const hasPhysicalCorridorRouteIgnoringTransit = (params: {
    buyerProvinceId: string;
    sellerProvinceId: string;
    transportModes: TMode[];
  }): boolean => {
    if (params.buyerProvinceId === params.sellerProvinceId) return true;
    const graph = new Map<string, Set<string>>();
    const addEdge = (from: string, to: string): void => {
      if (!graph.has(from)) graph.set(from, new Set<string>());
      graph.get(from)?.add(to);
    };
    const requiredModes = new Set(params.transportModes);
    for (const corridor of Object.values(context.corridorsById ?? {})) {
      if (corridor.status !== "active") continue;
      if (!requiredModes.has(corridor.transportMode)) continue;
      if (context.getCorridorCapacity(corridor) <= 0) continue;
      const provinceIds = getCorridorRouteProvinceIds(corridor, context.normalizeProvinceIds);
      for (let index = 1; index < provinceIds.length; index += 1) {
        addEdge(provinceIds[index - 1], provinceIds[index]);
        addEdge(provinceIds[index], provinceIds[index - 1]);
      }
    }
    const queue = [params.sellerProvinceId];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const provinceId = queue.shift();
      if (!provinceId || visited.has(provinceId)) continue;
      if (provinceId === params.buyerProvinceId) return true;
      visited.add(provinceId);
      for (const next of graph.get(provinceId) ?? []) {
        if (!visited.has(next)) queue.push(next);
      }
    }
    return false;
  };

  return {
    getCorridorRemainingCapacity,
    getCorridorRoutesForTransfer,
    getRoutesCapacityInGoods,
    hasPhysicalCorridorRouteIgnoringTransit,
    hasReachableCorridorRouteIgnoringCapacity,
  };
}

export function getRoutesCapacityInGoods(routes: Array<CorridorTransferRoute>): number {
  return routes.reduce((sum, route) => sum + Math.max(0, route.capacityGoods), 0);
}

export function consumeCorridorRoutesCapacity<TMode extends string, TCorridor extends TransportCorridorRouteEntry<TMode>>(params: {
  routes: Array<CorridorTransferRoute<TMode, TCorridor>>;
  goodsAmount: number;
  infraPerUnit: number;
  corridorLoadByModeByCorridorId: Record<string, Partial<Record<TMode, number>>>;
  getCorridorLoad: (corridorId: string, transportMode: TMode) => number;
}): void {
  let remainingGoods = Math.max(0, params.goodsAmount);
  if (remainingGoods <= 0) return;
  for (const route of params.routes) {
    if (remainingGoods <= 0) break;
    const goodsOnRoute = Math.min(remainingGoods, route.capacityGoods);
    const infraOnRoute = round3(goodsOnRoute * params.infraPerUnit);
    if (infraOnRoute <= 0) continue;
    for (const corridor of route.corridors) {
      if (!params.corridorLoadByModeByCorridorId[corridor.id]) params.corridorLoadByModeByCorridorId[corridor.id] = {};
      params.corridorLoadByModeByCorridorId[corridor.id][corridor.transportMode] = round3(
        params.getCorridorLoad(corridor.id, corridor.transportMode) + infraOnRoute,
      );
    }
    remainingGoods = round3(Math.max(0, remainingGoods - goodsOnRoute));
  }
}

export function getTransportCorridorConstructionProgressPerTurn(baseConstructionPerTurn: number): number {
  return Math.max(1, Number(baseConstructionPerTurn ?? 5) * 10);
}

export function resolveTransportCorridorConstructionTurn(params: {
  corridorsById: Record<string, TransportCorridorConstructionEntry>;
  worldBase: TransportCorridorConstructionWorldState;
  baseConstructionPerTurn: number;
  nowIso: string;
  addExpense?: (input: TransportCorridorLedgerFlowInput) => void;
}): void {
  const baseProgress = getTransportCorridorConstructionProgressPerTurn(params.baseConstructionPerTurn);
  for (const corridor of Object.values(params.corridorsById ?? {})) {
    if (corridor.status !== "building") continue;
    const ownerResource = params.worldBase.resourcesByCountry[corridor.ownerCountryId];
    if (!ownerResource) continue;
    const availableConstruction = Math.max(0, Number(ownerResource.construction ?? 0));
    if (availableConstruction <= 0) continue;
    const progress = Math.min(baseProgress, availableConstruction);
    params.addExpense?.({
      countryId: corridor.ownerCountryId,
      resourceId: "construction",
      amount: progress,
      sourceType: "construction",
      sourceId: corridor.id,
      categoryId: "transportCorridor",
      labelKey: "resourceLedger.source.construction.corridor",
    });
    if (!params.addExpense) {
      ownerResource.construction = round3(Math.max(0, availableConstruction - progress));
    }
    corridor.progressConstruction = round3(
      Math.min(corridor.costConstruction, Math.max(0, corridor.progressConstruction) + progress),
    );
    if (corridor.progressConstruction >= corridor.costConstruction) {
      corridor.status = "active";
      corridor.progressConstruction = corridor.costConstruction;
      corridor.completedAt = params.nowIso;
    }
  }
}

function round3(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}
