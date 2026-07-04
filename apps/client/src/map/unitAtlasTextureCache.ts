import { Assets, Rectangle, Texture } from "pixi.js";
import {
  UNIT_ATLAS_FALLBACK_URL,
  UNIT_ATLAS_FRAME_SIZE,
  UNIT_ATLAS_STATES,
  getUnitAtlasFrameIndex,
  getUnitAtlasUrl,
  type UnitAtlasState,
} from "../assets/unitAtlas";

export type UnitAtlasTextures = Record<UnitAtlasState, Texture>;

const texturesByKey = new Map<string, UnitAtlasTextures>();
const loadsByKey = new Map<string, Promise<UnitAtlasTextures>>();
void ensureFallbackAtlasTextures();

export function getUnitAtlasTextures(params: {
  scenarioId?: string | null;
  unitTypeId: string;
  onReady: () => void;
}): UnitAtlasTextures | null {
  const key = `${params.scenarioId ?? "default"}:${params.unitTypeId}`;
  const cached = texturesByKey.get(key);
  if (cached) return cached;

  if (!loadsByKey.has(key)) {
    const load = loadAtlasTextures(getUnitAtlasUrl(params.scenarioId, params.unitTypeId))
      .catch(() => ensureFallbackAtlasTextures())
      .then((textures) => {
        texturesByKey.set(key, textures);
        return textures;
      });
    loadsByKey.set(key, load);
  }

  void loadsByKey.get(key)?.then(params.onReady).catch(params.onReady);
  void ensureFallbackAtlasTextures().then(params.onReady).catch(params.onReady);
  return texturesByKey.get("__fallback__") ?? null;
}

async function ensureFallbackAtlasTextures(): Promise<UnitAtlasTextures> {
  const cached = texturesByKey.get("__fallback__");
  if (cached) return cached;
  const existingLoad = loadsByKey.get("__fallback__");
  if (existingLoad) return existingLoad;
  const load = loadAtlasTextures(UNIT_ATLAS_FALLBACK_URL).then((textures) => {
    texturesByKey.set("__fallback__", textures);
    return textures;
  });
  loadsByKey.set("__fallback__", load);
  return load;
}

async function loadAtlasTextures(url: string): Promise<UnitAtlasTextures> {
  const baseTexture = await Assets.load<Texture>(url);
  return sliceAtlasTexture(baseTexture);
}

function sliceAtlasTexture(baseTexture: Texture): UnitAtlasTextures {
  const result = {} as UnitAtlasTextures;
  for (const state of UNIT_ATLAS_STATES) {
    result[state] = new Texture({
      source: baseTexture.source,
      frame: new Rectangle(
        getUnitAtlasFrameIndex(state) * UNIT_ATLAS_FRAME_SIZE,
        0,
        UNIT_ATLAS_FRAME_SIZE,
        UNIT_ATLAS_FRAME_SIZE,
      ),
    });
  }
  return result;
}
