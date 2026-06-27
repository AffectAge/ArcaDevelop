export type BuildingAtlasState = "underConstruction" | "working" | "burning" | "ruins";

export const BUILDING_ATLAS_FRAME_SIZE = 64;
export const BUILDING_ATLAS_WIDTH = 256;
export const BUILDING_ATLAS_HEIGHT = 64;
export const BUILDING_ATLAS_FALLBACK_URL = "/game-assets/buildings/fallback-building-atlas.png";

export const BUILDING_ATLAS_STATES: BuildingAtlasState[] = [
  "underConstruction",
  "working",
  "burning",
  "ruins",
];

export function sanitizeBuildingAtlasId(buildingId: string): string {
  return buildingId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getBuildingAtlasUrl(scenarioId: string | null | undefined, buildingId: string): string {
  const normalizedScenarioId = scenarioId && /^[a-zA-Z0-9_-]+$/.test(scenarioId) ? scenarioId : "default";
  return `/scenario-assets/${normalizedScenarioId}/assets/buildings/${sanitizeBuildingAtlasId(buildingId)}.png`;
}

export function getBuildingAtlasFrameIndex(state: BuildingAtlasState): number {
  const index = BUILDING_ATLAS_STATES.indexOf(state);
  return index >= 0 ? index : 1;
}
