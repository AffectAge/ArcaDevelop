import { Assets, Rectangle, Texture } from "pixi.js";
import {
  FEATURE_ATLAS_FALLBACK_URL,
  FEATURE_ATLAS_FRAME_SIZE,
  FEATURE_ATLAS_VARIANTS,
  getFeatureAtlasRow,
  getFeatureAtlasUrl,
} from "../assets/featureAtlas";

export type FeatureAtlasTextures = Texture[];

const texturesByKey = new Map<string, FeatureAtlasTextures>();
const loadsByKey = new Map<string, Promise<FeatureAtlasTextures>>();

export function getFeatureAtlasTextures(params: {
  scenarioId?: string | null;
  featureId: string;
  onReady: () => void;
}): FeatureAtlasTextures | null {
  const key = `${params.scenarioId ?? "default"}:${params.featureId}`;
  const cached = texturesByKey.get(key);
  if (cached) return cached;

  if (!loadsByKey.has(key)) {
    const load = loadAtlasTextures(getFeatureAtlasUrl(params.scenarioId), params.featureId)
      .catch(() => loadFallbackAtlasTextures(params.featureId))
      .then((textures) => {
        texturesByKey.set(key, textures);
        return textures;
      });
    loadsByKey.set(key, load);
  }

  void loadsByKey.get(key)?.then(params.onReady).catch(params.onReady);
  return texturesByKey.get(`__fallback__:${params.featureId}`) ?? null;
}

async function loadFallbackAtlasTextures(featureId: string): Promise<FeatureAtlasTextures> {
  const key = `__fallback__:${featureId}`;
  const cached = texturesByKey.get(key);
  if (cached) return cached;
  const textures = await loadAtlasTextures(FEATURE_ATLAS_FALLBACK_URL, featureId);
  texturesByKey.set(key, textures);
  return textures;
}

async function loadAtlasTextures(url: string, featureId: string): Promise<FeatureAtlasTextures> {
  const baseTexture = await Assets.load<Texture>(url);
  return sliceAtlasTexture(baseTexture, featureId);
}

function sliceAtlasTexture(baseTexture: Texture, featureId: string): FeatureAtlasTextures {
  const result: FeatureAtlasTextures = [];
  const row = getFeatureAtlasRow(featureId);
  for (let index = 0; index < FEATURE_ATLAS_VARIANTS; index += 1) {
    result.push(new Texture({
      source: baseTexture.source,
      frame: new Rectangle(index * FEATURE_ATLAS_FRAME_SIZE, row * FEATURE_ATLAS_FRAME_SIZE, FEATURE_ATLAS_FRAME_SIZE, FEATURE_ATLAS_FRAME_SIZE),
    }));
  }
  return result;
}
