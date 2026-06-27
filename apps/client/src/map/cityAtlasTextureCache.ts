import { Assets, Rectangle, Texture } from "pixi.js";
import {
  CITY_ATLAS_FALLBACK_URL,
  CITY_ATLAS_FRAME_SIZE,
  CITY_ATLAS_STATES,
  getCityAtlasUrl,
  type CityAtlasState,
} from "../assets/cityAtlas";

export type CityAtlasTextures = Record<CityAtlasState, Texture>;

const texturesByKey = new Map<string, CityAtlasTextures>();
const loadsByKey = new Map<string, Promise<CityAtlasTextures>>();

export function getCityAtlasTextures(params: {
  scenarioId?: string | null;
  cultureId: string;
  onReady: () => void;
}): CityAtlasTextures | null {
  const key = `${params.scenarioId ?? "default"}:${params.cultureId}`;
  const cached = texturesByKey.get(key);
  if (cached) return cached;

  if (!loadsByKey.has(key)) {
    const load = loadAtlasTextures(getCityAtlasUrl(params.scenarioId, params.cultureId))
      .catch(() => loadFallbackAtlasTextures())
      .then((textures) => {
        texturesByKey.set(key, textures);
        return textures;
      });
    loadsByKey.set(key, load);
  }

  void loadsByKey.get(key)?.then(params.onReady).catch(params.onReady);
  return texturesByKey.get("__fallback__") ?? null;
}

async function loadFallbackAtlasTextures(): Promise<CityAtlasTextures> {
  const cached = texturesByKey.get("__fallback__");
  if (cached) return cached;
  const textures = await loadAtlasTextures(CITY_ATLAS_FALLBACK_URL);
  texturesByKey.set("__fallback__", textures);
  return textures;
}

async function loadAtlasTextures(url: string): Promise<CityAtlasTextures> {
  const baseTexture = await Assets.load<Texture>(url);
  return sliceAtlasTexture(baseTexture);
}

function sliceAtlasTexture(baseTexture: Texture): CityAtlasTextures {
  const result = {} as CityAtlasTextures;
  for (const [index, state] of CITY_ATLAS_STATES.entries()) {
    result[state] = new Texture({
      source: baseTexture.source,
      frame: new Rectangle(index * CITY_ATLAS_FRAME_SIZE, 0, CITY_ATLAS_FRAME_SIZE, CITY_ATLAS_FRAME_SIZE),
    });
  }
  return result;
}
