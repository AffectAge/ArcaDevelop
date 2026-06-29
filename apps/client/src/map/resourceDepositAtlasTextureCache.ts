import { Assets, Rectangle, Texture } from "pixi.js";
import {
  RESOURCE_DEPOSIT_ATLAS_FALLBACK_URL,
  RESOURCE_DEPOSIT_ATLAS_FRAME_SIZE,
  RESOURCE_DEPOSIT_ATLAS_COLUMNS,
  getResourceDepositAtlasRow,
  getResourceDepositAtlasUrl,
} from "../assets/resourceDepositAtlas";

export type ResourceDepositAtlasTextures = Texture[];

const texturesByKey = new Map<string, ResourceDepositAtlasTextures>();
const loadsByKey = new Map<string, Promise<ResourceDepositAtlasTextures>>();

export function getResourceDepositAtlasTextures(params: {
  scenarioId?: string | null;
  goodId: string;
  onReady: () => void;
}): ResourceDepositAtlasTextures | null {
  const key = `${params.scenarioId ?? "default"}:${params.goodId}`;
  const cached = texturesByKey.get(key);
  if (cached) return cached;

  if (!loadsByKey.has(key)) {
    const load = loadAtlasTextures(getResourceDepositAtlasUrl(params.scenarioId), params.goodId)
      .catch(() => loadFallbackAtlasTextures(params.goodId))
      .then((textures) => {
        texturesByKey.set(key, textures);
        return textures;
      });
    loadsByKey.set(key, load);
  }

  void loadsByKey.get(key)?.then(params.onReady).catch(params.onReady);
  return texturesByKey.get(`__fallback__:${params.goodId}`) ?? null;
}

async function loadFallbackAtlasTextures(goodId: string): Promise<ResourceDepositAtlasTextures> {
  const key = `__fallback__:${goodId}`;
  const cached = texturesByKey.get(key);
  if (cached) return cached;
  const textures = await loadAtlasTextures(RESOURCE_DEPOSIT_ATLAS_FALLBACK_URL, goodId);
  texturesByKey.set(key, textures);
  return textures;
}

async function loadAtlasTextures(url: string, goodId: string): Promise<ResourceDepositAtlasTextures> {
  const baseTexture = await Assets.load<Texture>(url);
  return sliceAtlasTexture(baseTexture, goodId);
}

function sliceAtlasTexture(baseTexture: Texture, goodId: string): ResourceDepositAtlasTextures {
  const result: ResourceDepositAtlasTextures = [];
  const row = getResourceDepositAtlasRow(goodId);
  for (let index = 0; index < RESOURCE_DEPOSIT_ATLAS_COLUMNS; index += 1) {
    result.push(new Texture({
      source: baseTexture.source,
      frame: new Rectangle(
        index * RESOURCE_DEPOSIT_ATLAS_FRAME_SIZE,
        row * RESOURCE_DEPOSIT_ATLAS_FRAME_SIZE,
        RESOURCE_DEPOSIT_ATLAS_FRAME_SIZE,
        RESOURCE_DEPOSIT_ATLAS_FRAME_SIZE,
      ),
    }));
  }
  return result;
}
