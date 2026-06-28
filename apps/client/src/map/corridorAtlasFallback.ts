import type { TransportMode } from "../lib/api";

export type CorridorVisualStatus = "planned" | "building" | "active" | "overloaded" | "closed";

export type CorridorAtlasFrame = {
  textureKey: string;
  tint: number;
  alpha: number;
};

const STATUS_TINT: Record<CorridorVisualStatus, number> = {
  planned: 0xb9c2cf,
  building: 0xd6a84f,
  active: 0xe6e8df,
  overloaded: 0xe06145,
  closed: 0x5f6875,
};

const MODE_PREFIX: Record<TransportMode, string> = {
  land: "road",
  sea: "shippingLane",
  air: "airRoute",
  pipeline: "pipeline",
  powerGrid: "powerLine",
};

const STATUS_ALPHA: Record<CorridorVisualStatus, number> = {
  planned: 0.58,
  building: 0.82,
  active: 1,
  overloaded: 1,
  closed: 0.42,
};

export function resolveCorridorAtlasFallback(params: {
  transportMode: TransportMode;
  status: CorridorVisualStatus;
  connectionMask: number;
}): CorridorAtlasFrame {
  const prefix = MODE_PREFIX[params.transportMode];
  const mask = Math.max(0, Math.min(63, Math.floor(params.connectionMask)));
  return {
    textureKey: `corridors/${prefix}/mask-${mask}`,
    tint: STATUS_TINT[params.status],
    alpha: STATUS_ALPHA[params.status],
  };
}
