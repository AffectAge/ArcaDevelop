export type CityAtlasState = "underConstruction" | "working" | "burning" | "ruins";

export const CITY_ATLAS_FRAME_SIZE = 64;
export const CITY_ATLAS_WIDTH = 256;
export const CITY_ATLAS_HEIGHT = 64;
export const CITY_ATLAS_FALLBACK_URL = "/game-assets/cities/fallback-city-atlas.png";

export const CITY_ATLAS_STATES: CityAtlasState[] = [
  "underConstruction",
  "working",
  "burning",
  "ruins",
];

export function sanitizeCityAtlasId(cultureId: string): string {
  return cultureId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getCityAtlasUrl(scenarioId: string | null | undefined, cultureId: string): string {
  const normalizedScenarioId = scenarioId && /^[a-zA-Z0-9_-]+$/.test(scenarioId) ? scenarioId : "default";
  return `/scenario-assets/${normalizedScenarioId}/assets/cities/${sanitizeCityAtlasId(cultureId)}.png`;
}

export function getCityAtlasFrameIndex(state: CityAtlasState): number {
  const index = CITY_ATLAS_STATES.indexOf(state);
  return index >= 0 ? index : 1;
}
