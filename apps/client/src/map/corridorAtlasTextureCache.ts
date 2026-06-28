import { Assets, Rectangle, Texture } from "pixi.js";
import {
  CORRIDOR_ATLAS_FALLBACK_URL,
  CORRIDOR_ATLAS_FRAME_SIZE,
  CORRIDOR_ATLAS_MASK_COUNT,
  CORRIDOR_ATLAS_STATUSES,
  CORRIDOR_ATLAS_TRANSPORT_MODES,
  getCorridorAtlasFrame,
  getCorridorAtlasUrl,
  type CorridorAtlasStatus,
} from "../assets/corridorAtlas";
import type { TransportMode } from "../lib/api";

export type CorridorAtlasTextures = Record<TransportMode, Record<CorridorAtlasStatus, Texture[]>>;

const texturesByKey = new Map<string, CorridorAtlasTextures>();
const loadsByKey = new Map<string, Promise<CorridorAtlasTextures>>();

export function getCorridorAtlasTextures(params: {
  scenarioId?: string | null;
  onReady: () => void;
}): CorridorAtlasTextures | null {
  const key = params.scenarioId ?? "default";
  const cached = texturesByKey.get(key);
  if (cached) return cached;

  if (!loadsByKey.has(key)) {
    const load = loadAtlasTextures(getCorridorAtlasUrl(params.scenarioId))
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

async function loadFallbackAtlasTextures(): Promise<CorridorAtlasTextures> {
  const cached = texturesByKey.get("__fallback__");
  if (cached) return cached;
  const textures = await loadAtlasTextures(CORRIDOR_ATLAS_FALLBACK_URL);
  texturesByKey.set("__fallback__", textures);
  return textures;
}

async function loadAtlasTextures(url: string): Promise<CorridorAtlasTextures> {
  const baseTexture = await Assets.load<Texture>(url);
  return sliceAtlasTexture(baseTexture);
}

function sliceAtlasTexture(baseTexture: Texture): CorridorAtlasTextures {
  const result = {} as CorridorAtlasTextures;
  for (const transportMode of CORRIDOR_ATLAS_TRANSPORT_MODES) {
    result[transportMode] = {} as CorridorAtlasTextures[TransportMode];
    for (const status of CORRIDOR_ATLAS_STATUSES) {
      result[transportMode][status] = [];
      for (let connectionMask = 0; connectionMask < CORRIDOR_ATLAS_MASK_COUNT; connectionMask += 1) {
        const frame = getCorridorAtlasFrame({ transportMode, status, connectionMask });
        result[transportMode][status][connectionMask] = new Texture({
          source: baseTexture.source,
          frame: new Rectangle(frame.x, frame.y, CORRIDOR_ATLAS_FRAME_SIZE, CORRIDOR_ATLAS_FRAME_SIZE),
        });
      }
    }
  }
  return result;
}
