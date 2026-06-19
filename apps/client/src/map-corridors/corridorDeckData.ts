import { bezierSpline, lineString } from "@turf/turf";
import type { MarketTransportCorridor, TransportMode } from "../lib/api";
import { TRANSPORT_CORRIDOR_VISUAL } from "./visuals";
import type { CorridorBuildPoint, CorridorDeckRow, CorridorProvinceMeta } from "./types";

export type BuildCorridorDeckDataInput = {
  showCorridorDeckLayer: boolean;
  activeModeId: string;
  infrastructureLensIsTransport: boolean;
  infrastructureTransportMode: TransportMode;
  authCountryId: string | null;
  corridorBuildMode: boolean;
  corridorBuildRoutePoints: CorridorBuildPoint[];
  corridorBuildTransportMode: TransportMode;
  marketTransportCorridors: MarketTransportCorridor[];
  provinceMetaById: ReadonlyMap<string, CorridorProvinceMeta>;
};

export function buildCorridorDeckData(input: BuildCorridorDeckDataInput): CorridorDeckRow[] {
  if (!input.showCorridorDeckLayer) return [];
  const modeFilter = input.activeModeId === "infrastructure" && input.infrastructureLensIsTransport ? input.infrastructureTransportMode : null;
  const rows = input.marketTransportCorridors
    .filter((corridor) => !modeFilter || corridor.transportMode === modeFilter)
    .flatMap((corridor) => buildSavedCorridorRow(corridor, input.provinceMetaById, input.authCountryId));

  if (input.corridorBuildMode && input.corridorBuildRoutePoints.length >= 2) {
    const row = buildPreviewCorridorRow(input.corridorBuildRoutePoints, input.corridorBuildTransportMode);
    if (row) rows.push(row);
  }

  applyParallelOffsets(rows);
  return rows;
}

function buildSavedCorridorRow(corridor: MarketTransportCorridor, provinceMetaById: ReadonlyMap<string, CorridorProvinceMeta>, authCountryId: string | null): CorridorDeckRow[] {
  const coordinates = corridor.routePoints && corridor.routePoints.length >= 2
    ? corridor.routePoints.map((point) => [point.lng, point.lat] as [number, number])
    : corridor.provinceIds.flatMap((provinceId) => {
        const meta = provinceMetaById.get(provinceId);
        return meta?.centerX == null || meta.centerY == null ? [] : ([[meta.centerX, meta.centerY] as [number, number]]);
      });
  const path = buildCorridorPath(coordinates, corridor.transportMode);
  if (!path) return [];
  const visual = TRANSPORT_CORRIDOR_VISUAL[corridor.transportMode];
  return [{
    id: corridor.id,
    path,
    color: visual.color,
    width: visual.width,
    dash: corridor.status === "active" ? visual.dash : corridor.status === "building" ? [5, 5] : [2, 7],
    offset: 0,
    status: corridor.status,
    isOwn: authCountryId === corridor.ownerCountryId,
  }];
}

function buildPreviewCorridorRow(points: CorridorBuildPoint[], transportMode: TransportMode): CorridorDeckRow | null {
  const path = buildCorridorPath(points.map((point) => [point.lng, point.lat] as [number, number]), transportMode);
  if (!path) return null;
  const visual = TRANSPORT_CORRIDOR_VISUAL[transportMode];
  return {
    id: "corridor-build-preview",
    path,
    color: visual.color,
    width: visual.width + 1,
    dash: [5, 4],
    offset: 0,
    status: "building",
    isOwn: true,
  };
}

function buildCorridorPath(coordinates: Array<[number, number]>, transportMode: TransportMode): Array<[number, number]> | null {
  if (coordinates.length < 2) return null;
  const rawLine = lineString(coordinates);
  const routeLine = transportMode === "air" || transportMode === "sea"
    ? bezierSpline(rawLine, { sharpness: transportMode === "air" ? 0.78 : 0.55 })
    : rawLine;
  return routeLine.geometry.coordinates.map((coord) => [Number(coord[0]), Number(coord[1])] as [number, number]);
}

function applyParallelOffsets(rows: CorridorDeckRow[]): void {
  const groups = new Map<string, CorridorDeckRow[]>();
  for (const row of rows) {
    const forward = row.path.map((point) => `${point[0].toFixed(3)},${point[1].toFixed(3)}`).join(">");
    const reverse = row.path.map((point) => `${point[0].toFixed(3)},${point[1].toFixed(3)}`).reverse().join(">");
    const key = forward < reverse ? forward : reverse;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const center = (group.length - 1) / 2;
    group.forEach((row, index) => {
      row.offset = (index - center) * 1.75;
    });
  }
}
