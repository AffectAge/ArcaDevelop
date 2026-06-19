import type { TransportMode } from "../lib/api";
import type { CorridorVisual } from "./types";

export const TRANSPORT_CORRIDOR_VISUAL: Record<TransportMode, CorridorVisual> = {
  land: { color: [96, 165, 250], symbol: "•", width: 3.2, dash: [1, 0] },
  sea: { color: [56, 189, 248], symbol: "≈", width: 4.6, dash: [1, 0] },
  air: { color: [167, 139, 250], symbol: "✦", width: 3.4, dash: [3, 7] },
  pipeline: { color: [249, 115, 22], symbol: "●", width: 4.4, dash: [12, 4] },
  powerGrid: { color: [250, 204, 21], symbol: "⚡", width: 4, dash: [2, 4] },
};
