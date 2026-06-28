import type { TransportMode } from "../lib/api";

export type CorridorAtlasStatus = "planned" | "building" | "active" | "overloaded" | "closed";
export type CorridorAtlasConnectionMask =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19
  | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29
  | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39
  | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49
  | 50 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59
  | 60 | 61 | 62 | 63;

export const CORRIDOR_ATLAS_FRAME_SIZE = 64;
export const CORRIDOR_ATLAS_MASK_COUNT = 64;
export const CORRIDOR_ATLAS_WIDTH = CORRIDOR_ATLAS_FRAME_SIZE * CORRIDOR_ATLAS_MASK_COUNT;
export const CORRIDOR_ATLAS_HEIGHT = 1600;
export const CORRIDOR_ATLAS_FALLBACK_URL = "/game-assets/corridors/fallback-corridor-atlas.png";

export const CORRIDOR_ATLAS_TRANSPORT_MODES: TransportMode[] = ["land", "sea", "air", "pipeline", "powerGrid"];
export const CORRIDOR_ATLAS_STATUSES: CorridorAtlasStatus[] = ["planned", "building", "active", "overloaded", "closed"];

export function getCorridorAtlasUrl(scenarioId: string | null | undefined): string {
  const normalizedScenarioId = scenarioId && /^[a-zA-Z0-9_-]+$/.test(scenarioId) ? scenarioId : "default";
  return `/scenario-assets/${normalizedScenarioId}/assets/corridors/corridor-atlas.png`;
}

export function getCorridorAtlasFrame(params: {
  transportMode: TransportMode;
  status: CorridorAtlasStatus;
  connectionMask: number;
}): { x: number; y: number } {
  const maskIndex = Math.max(0, Math.min(CORRIDOR_ATLAS_MASK_COUNT - 1, Math.floor(params.connectionMask)));
  const modeIndex = Math.max(0, CORRIDOR_ATLAS_TRANSPORT_MODES.indexOf(params.transportMode));
  const statusIndex = Math.max(0, CORRIDOR_ATLAS_STATUSES.indexOf(params.status));
  return {
    x: maskIndex * CORRIDOR_ATLAS_FRAME_SIZE,
    y: (modeIndex * CORRIDOR_ATLAS_STATUSES.length + statusIndex) * CORRIDOR_ATLAS_FRAME_SIZE,
  };
}
