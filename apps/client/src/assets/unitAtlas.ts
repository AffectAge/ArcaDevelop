export type UnitAtlasState = "idle" | "move" | "attack" | "damaged";

export const UNIT_ATLAS_FRAME_SIZE = 64;
export const UNIT_ATLAS_FALLBACK_URL = "/game-assets/units/fallback-unit-atlas.png";

export const UNIT_ATLAS_STATES: UnitAtlasState[] = ["idle", "move", "attack", "damaged"];
export const UNIT_ATLAS_FRAME_BY_STATE: Record<UnitAtlasState, number> = {
  idle: 0,
  move: 1,
  attack: 2,
  damaged: 3,
};

export function getUnitAtlasFrameIndex(state: UnitAtlasState): number {
  return UNIT_ATLAS_FRAME_BY_STATE[state] ?? UNIT_ATLAS_FRAME_BY_STATE.idle;
}

export function sanitizeUnitAtlasId(unitTypeId: string): string {
  return unitTypeId.replace(/^unit:/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getUnitAtlasUrl(scenarioId: string | null | undefined, unitTypeId: string): string {
  const normalizedScenarioId = scenarioId && /^[a-zA-Z0-9_-]+$/.test(scenarioId) ? scenarioId : "default";
  return `/scenario-assets/${normalizedScenarioId}/assets/units/${sanitizeUnitAtlasId(unitTypeId)}.png`;
}
