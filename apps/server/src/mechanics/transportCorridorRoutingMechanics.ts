import type { HexMapArtifact, HexTile, WorldBase } from "@arcanorum/shared";
import type { GoodTransportMode } from "./marketTurnMechanics";

export type TransportCorridorWaypoint = {
  hexId: string;
  lng?: number | null;
  lat?: number | null;
};

export type TransportCorridorRoutePreview = {
  ok: true;
  waypoints: TransportCorridorWaypoint[];
  computedHexIds: string[];
  connectedRegionIds: string[];
  connectedCityMarkerIds: string[];
  costConstruction: number;
  routeCost: number;
} | {
  ok: false;
  error:
    | "CORRIDOR_ROUTE_TOO_SHORT"
    | "CORRIDOR_ENDPOINT_CITY_REQUIRED"
    | "CORRIDOR_ROUTE_IMPOSSIBLE"
    | "CORRIDOR_CONSTRUCTION_RIGHT_REQUIRED";
};

type CorridorRoutingParams = {
  waypoints: TransportCorridorWaypoint[];
  transportMode: GoodTransportMode;
  ownerCountryId: string;
  mapArtifact: HexMapArtifact | null;
  worldBase: Pick<WorldBase, "cityMarkersById" | "settlementProjectsById">;
  getHexOwner: (hexId: string) => string | null;
  isHexAllowedForCorridorOwner: (hexId: string, ownerCountryId: string, transportMode: GoodTransportMode) => boolean;
  getHexMovementCost: (hexId: string, countryId?: string) => number;
  getBuildCost: (transportMode: GoodTransportMode, routeCost: number, segments: number) => number;
};

type SearchNode = {
  hexId: string;
  cost: number;
  priority: number;
};

export function resolveTransportCorridorRoutePreview(params: CorridorRoutingParams): TransportCorridorRoutePreview {
  const waypoints = normalizeWaypoints(params.waypoints);
  if (waypoints.length < 2) return { ok: false, error: "CORRIDOR_ROUTE_TOO_SHORT" };
  const cityByHexId = buildCityConnectionByHexId(params.worldBase);
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  if (!first || !last || !cityByHexId.has(first.hexId) || !cityByHexId.has(last.hexId)) {
    return { ok: false, error: "CORRIDOR_ENDPOINT_CITY_REQUIRED" };
  }
  const map = params.mapArtifact;
  if (!map) return { ok: false, error: "CORRIDOR_ROUTE_IMPOSSIBLE" };
  const endpointHexIds = new Set([first.hexId, last.hexId]);
  const computedHexIds: string[] = [];
  let routeCost = 0;
  for (let index = 1; index < waypoints.length; index += 1) {
    const from = waypoints[index - 1]?.hexId;
    const to = waypoints[index]?.hexId;
    if (!from || !to) return { ok: false, error: "CORRIDOR_ROUTE_TOO_SHORT" };
    const segment = findCorridorPath({
      map,
      startHexId: from,
      goalHexId: to,
      ownerCountryId: params.ownerCountryId,
      transportMode: params.transportMode,
      endpointHexIds,
      getHexMovementCost: params.getHexMovementCost,
    });
    if (segment.hexIds.length < 2) return { ok: false, error: "CORRIDOR_ROUTE_IMPOSSIBLE" };
    routeCost += segment.cost;
    if (computedHexIds.length === 0) {
      computedHexIds.push(...segment.hexIds);
    } else {
      computedHexIds.push(...segment.hexIds.slice(1));
    }
  }
  if (computedHexIds.some((hexId) => !params.isHexAllowedForCorridorOwner(hexId, params.ownerCountryId, params.transportMode))) {
    return { ok: false, error: "CORRIDOR_CONSTRUCTION_RIGHT_REQUIRED" };
  }
  const connected = resolveConnectedRegionsForCorridor(computedHexIds, params.worldBase);
  return {
    ok: true,
    waypoints,
    computedHexIds,
    connectedRegionIds: connected.connectedRegionIds,
    connectedCityMarkerIds: connected.connectedCityMarkerIds,
    routeCost: round3(routeCost),
    costConstruction: params.getBuildCost(params.transportMode, routeCost, Math.max(1, computedHexIds.length - 1)),
  };
}

export function resolveConnectedRegionsForCorridor(
  computedHexIds: string[],
  worldBase: Pick<WorldBase, "cityMarkersById" | "settlementProjectsById">,
): { connectedRegionIds: string[]; connectedCityMarkerIds: string[] } {
  const routeHexIds = new Set(computedHexIds);
  const regionIds = new Set<string>();
  const cityIds = new Set<string>();
  for (const marker of Object.values(worldBase.cityMarkersById ?? {})) {
    if (!marker?.targetHexId || !routeHexIds.has(marker.targetHexId)) continue;
    regionIds.add(marker.regionId);
    cityIds.add(marker.id);
  }
  for (const project of Object.values(worldBase.settlementProjectsById ?? {})) {
    if (!project?.targetHexId || project.state === "completed" || project.state === "canceled") continue;
    if (!routeHexIds.has(project.targetHexId)) continue;
    regionIds.add(project.regionId);
    cityIds.add(project.id);
  }
  return {
    connectedRegionIds: [...regionIds].sort(),
    connectedCityMarkerIds: [...cityIds].sort(),
  };
}

export function getRegionCorridorEndpointHexId(params: {
  regionId: string;
  corridors: Array<{
    status: "building" | "active" | "closed";
    transportMode: GoodTransportMode;
    connectedRegionIds?: string[] | null;
    connectedCityMarkerIds?: string[] | null;
  }>;
  worldBase: Pick<WorldBase, "cityMarkersById" | "settlementProjectsById">;
  transportMode: GoodTransportMode;
}): string | null {
  const corridor = params.corridors.find(
    (entry) =>
      entry.status === "active" &&
      entry.transportMode === params.transportMode &&
      (entry.connectedRegionIds ?? []).includes(params.regionId),
  );
  if (!corridor) return null;
  for (const cityId of corridor.connectedCityMarkerIds ?? []) {
    const marker = params.worldBase.cityMarkersById[cityId];
    if (marker?.regionId === params.regionId) return marker.targetHexId;
    const project = params.worldBase.settlementProjectsById[cityId];
    if (project?.regionId === params.regionId && project.state !== "completed" && project.state !== "canceled") {
      return project.targetHexId;
    }
  }
  return null;
}

function normalizeWaypoints(input: TransportCorridorWaypoint[]): TransportCorridorWaypoint[] {
  return input.flatMap((point) => {
    const hexId = typeof point?.hexId === "string" ? point.hexId.trim() : "";
    if (!hexId) return [];
    const lng = typeof point.lng === "number" && Number.isFinite(point.lng) ? point.lng : null;
    const lat = typeof point.lat === "number" && Number.isFinite(point.lat) ? point.lat : null;
    return [{ hexId, lng, lat }];
  });
}

function buildCityConnectionByHexId(worldBase: Pick<WorldBase, "cityMarkersById" | "settlementProjectsById">): Map<string, string> {
  const result = new Map<string, string>();
  for (const marker of Object.values(worldBase.cityMarkersById ?? {})) {
    if (marker?.targetHexId) result.set(marker.targetHexId, marker.id);
  }
  for (const project of Object.values(worldBase.settlementProjectsById ?? {})) {
    if (!project?.targetHexId || project.state === "completed" || project.state === "canceled") continue;
    result.set(project.targetHexId, project.id);
  }
  return result;
}

function findCorridorPath(params: {
  map: HexMapArtifact;
  startHexId: string;
  goalHexId: string;
  ownerCountryId: string;
  transportMode: GoodTransportMode;
  endpointHexIds: Set<string>;
  getHexMovementCost: (hexId: string, countryId?: string) => number;
}): { hexIds: string[]; cost: number } {
  if (params.startHexId === params.goalHexId) return { hexIds: [params.startHexId], cost: 0 };
  const tileById = new Map(params.map.tiles.map((tile) => [tile.id, tile] as const));
  const start = tileById.get(params.startHexId as HexTile["id"]);
  const goal = tileById.get(params.goalHexId as HexTile["id"]);
  if (!start || !goal) return { hexIds: [], cost: 0 };
  const frontier: SearchNode[] = [{ hexId: params.startHexId, cost: 0, priority: 0 }];
  const cameFrom = new Map<string, string | null>([[params.startHexId, null]]);
  const costSoFar = new Map<string, number>([[params.startHexId, 0]]);
  const maxVisited = Math.max(1200, params.map.tiles.length * 2);
  let visited = 0;
  while (frontier.length > 0 && visited < maxVisited) {
    visited += 1;
    frontier.sort((a, b) => a.priority - b.priority);
    const current = frontier.shift();
    if (!current) break;
    if (current.hexId === params.goalHexId) break;
    const tile = tileById.get(current.hexId as HexTile["id"]);
    if (!tile) continue;
    for (const neighborId of getNeighborIds(tile, params.map)) {
      const neighbor = tileById.get(neighborId as HexTile["id"]);
      if (!neighbor) continue;
      if (!isTransportModeAllowedOnHex(neighbor, params.transportMode, params.endpointHexIds)) continue;
      const stepCost = getTransportModeStepCost(neighbor, params.transportMode, params.ownerCountryId, params.getHexMovementCost);
      const nextCost = (costSoFar.get(current.hexId) ?? 0) + stepCost;
      if (nextCost >= (costSoFar.get(neighbor.id) ?? Number.POSITIVE_INFINITY)) continue;
      costSoFar.set(neighbor.id, nextCost);
      cameFrom.set(neighbor.id, current.hexId);
      frontier.push({ hexId: neighbor.id, cost: nextCost, priority: nextCost + axialDistance(neighbor, goal, params.map.settings.wrapX ? params.map.settings.width : null) });
    }
  }
  if (!cameFrom.has(params.goalHexId)) return { hexIds: [], cost: 0 };
  const hexIds: string[] = [];
  let cursor: string | null = params.goalHexId;
  while (cursor) {
    hexIds.push(cursor);
    cursor = cameFrom.get(cursor) ?? null;
  }
  hexIds.reverse();
  return { hexIds, cost: round3(costSoFar.get(params.goalHexId) ?? 0) };
}

function getNeighborIds(tile: HexTile, map: HexMapArtifact): string[] {
  const directions = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];
  return directions.flatMap(([dq, dr]) => {
    let q = tile.q + dq;
    if (map.settings.wrapX) {
      q = ((q % map.settings.width) + map.settings.width) % map.settings.width;
    }
    if (q < 0 || q >= map.settings.width) return [];
    const r = tile.r + dr;
    if (r < 0 || r >= map.settings.height) return [];
    return [`hex:${q}:${r}`];
  });
}

function isTransportModeAllowedOnHex(tile: HexTile, mode: GoodTransportMode, endpointHexIds: Set<string>): boolean {
  if (mode === "air") return true;
  if (mode === "sea") return Boolean(tile.waterKind) || endpointHexIds.has(tile.id);
  if (mode === "land" || mode === "pipeline" || mode === "powerGrid") return tile.passable && !tile.waterKind;
  return tile.passable;
}

function getTransportModeStepCost(
  tile: HexTile,
  mode: GoodTransportMode,
  countryId: string,
  getHexMovementCost: (hexId: string, countryId?: string) => number,
): number {
  const base = Math.max(0.001, getHexMovementCost(tile.id, countryId));
  if (mode === "air") return round3(base * 2.4);
  if (mode === "sea") return round3(Math.max(0.5, base * 0.7));
  if (mode === "pipeline") return round3(base * 1.35);
  if (mode === "powerGrid") return round3(base * 1.25);
  return round3(base);
}

function axialDistance(a: Pick<HexTile, "q" | "r">, b: Pick<HexTile, "q" | "r">, wrapWidth: number | null): number {
  const direct = rawAxialDistance(a.q, a.r, b.q, b.r);
  if (!wrapWidth) return direct;
  return Math.min(
    direct,
    rawAxialDistance(a.q - wrapWidth, a.r, b.q, b.r),
    rawAxialDistance(a.q + wrapWidth, a.r, b.q, b.r),
  );
}

function rawAxialDistance(aq: number, ar: number, bq: number, br: number): number {
  const dq = aq - bq;
  const dr = ar - br;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

function round3(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}
