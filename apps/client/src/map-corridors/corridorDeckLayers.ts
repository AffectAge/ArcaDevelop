import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import type { PathStyleExtensionProps } from "@deck.gl/extensions";
import type { TransportMode } from "../lib/api";
import { TRANSPORT_CORRIDOR_VISUAL } from "./visuals";
import type { CorridorBuildPoint, CorridorDeckRow, CorridorNodeDeckRow } from "./types";

export type BuildCorridorDeckLayersInput = {
  corridorDeckData: CorridorDeckRow[];
  corridorBuildMode: boolean;
  corridorBuildRoutePoints: CorridorBuildPoint[];
  corridorBuildTransportMode: TransportMode;
};

export function buildCorridorDeckLayers(input: BuildCorridorDeckLayersInput) {
  const backgroundLayer = new PathLayer<CorridorDeckRow>({
    id: "transport-corridors-bg",
    data: input.corridorDeckData,
    pickable: false,
    getPath: (row) => row.path,
    getColor: [3, 7, 18, 210],
    getWidth: (row) => row.width + 3.4,
    widthUnits: "pixels",
    rounded: true,
    jointRounded: true,
  });
  const lineLayer = new PathLayer<CorridorDeckRow, PathStyleExtensionProps<CorridorDeckRow>>({
    id: "transport-corridors-line",
    data: input.corridorDeckData,
    pickable: false,
    getPath: (row) => row.path,
    getColor: (row): [number, number, number, number] => {
      const alpha = row.status === "closed" ? 92 : row.status === "building" ? 150 : row.isOwn ? 245 : 205;
      return [...row.color, alpha];
    },
    getWidth: (row) => (row.isOwn ? row.width + 0.9 : row.width),
    widthUnits: "pixels",
    rounded: true,
    jointRounded: true,
    getDashArray: (row: CorridorDeckRow) => row.dash,
    getOffset: (row: CorridorDeckRow) => row.offset,
    dashJustified: true,
    extensions: [new PathStyleExtension({ dash: true, offset: true })],
  });
  const nodeLayer = new ScatterplotLayer<CorridorNodeDeckRow>({
    id: "transport-corridors-nodes",
    data: buildCorridorNodeData(input),
    pickable: false,
    getPosition: (row) => row.position,
    getFillColor: (row): [number, number, number, number] => [...row.color, row.status === "closed" ? 90 : 210],
    getLineColor: [3, 7, 18, 230],
    stroked: true,
    getLineWidth: 1.5,
    lineWidthUnits: "pixels",
    getRadius: (row) => (row.id.startsWith("corridor-build-point-") ? 5.5 : 4),
    radiusUnits: "pixels",
  });
  return [backgroundLayer, lineLayer, nodeLayer];
}

export function buildCorridorNodeData(input: BuildCorridorDeckLayersInput): CorridorNodeDeckRow[] {
  const buildVisual = TRANSPORT_CORRIDOR_VISUAL[input.corridorBuildTransportMode];
  return [
    ...input.corridorDeckData.flatMap((row) => [row.path[0], row.path[row.path.length - 1]].map((position, index) => ({
      id: `${row.id}-${index}`,
      position,
      color: row.color,
      status: row.status,
    }))),
    ...(input.corridorBuildMode
      ? input.corridorBuildRoutePoints.map((point, index) => ({
          id: `corridor-build-point-${index}`,
          position: [point.lng, point.lat] as [number, number],
          color: buildVisual.color,
          status: "building" as const,
        }))
      : []),
  ];
}
