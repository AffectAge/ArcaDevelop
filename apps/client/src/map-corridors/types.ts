import type { MarketTransportCorridor, TransportMode } from "../lib/api";

export type CorridorDeckRow = {
  id: string;
  path: Array<[number, number]>;
  color: [number, number, number];
  width: number;
  dash: [number, number];
  offset: number;
  status: MarketTransportCorridor["status"];
  isOwn: boolean;
};

export type CorridorNodeDeckRow = {
  id: string;
  position: [number, number];
  color: [number, number, number];
  status: MarketTransportCorridor["status"];
};

export type CorridorBuildPoint = {
  provinceId: string;
  lng: number;
  lat: number;
};

export type CorridorVisual = {
  color: [number, number, number];
  symbol: string;
  width: number;
  dash: [number, number];
};

export type CorridorProvinceMeta = {
  centerX: number | null;
  centerY: number | null;
};

export type CorridorTransportMode = TransportMode;
