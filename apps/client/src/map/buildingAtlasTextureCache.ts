import { Assets, Rectangle, Texture } from "pixi.js";
import {
  BUILDING_ATLAS_FALLBACK_URL,
  BUILDING_ATLAS_FRAME_SIZE,
  BUILDING_ATLAS_STATES,
  getBuildingAtlasUrl,
  type BuildingAtlasState,
} from "../assets/buildingAtlas";

export type BuildingAtlasTextures = Record<BuildingAtlasState, Texture>;

const texturesByKey = new Map<string, BuildingAtlasTextures>();
const loadsByKey = new Map<string, Promise<BuildingAtlasTextures>>();

export function getBuildingAtlasTextures(params: {
  scenarioId?: string | null;
  buildingId: string;
  onReady: () => void;
}): BuildingAtlasTextures | null {
  const key = `${params.scenarioId ?? "default"}:${params.buildingId}`;
  const cached = texturesByKey.get(key);
  if (cached) return cached;

  if (!loadsByKey.has(key)) {
    const load = loadAtlasTextures(getBuildingAtlasUrl(params.scenarioId, params.buildingId))
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

async function loadFallbackAtlasTextures(): Promise<BuildingAtlasTextures> {
  const cached = texturesByKey.get("__fallback__");
  if (cached) return cached;
  const textures = await loadAtlasTextures(BUILDING_ATLAS_FALLBACK_URL);
  texturesByKey.set("__fallback__", textures);
  return textures;
}

async function loadAtlasTextures(url: string): Promise<BuildingAtlasTextures> {
  const baseTexture = await Assets.load<Texture>(url);
  return sliceAtlasTexture(baseTexture);
}

function sliceAtlasTexture(baseTexture: Texture): BuildingAtlasTextures {
  const result = {} as BuildingAtlasTextures;
  for (const [index, state] of BUILDING_ATLAS_STATES.entries()) {
    result[state] = new Texture({
      source: baseTexture.source,
      frame: new Rectangle(index * BUILDING_ATLAS_FRAME_SIZE, 0, BUILDING_ATLAS_FRAME_SIZE, BUILDING_ATLAS_FRAME_SIZE),
    });
  }
  return result;
}
