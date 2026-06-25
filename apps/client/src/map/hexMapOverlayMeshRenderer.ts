import { Assets, Container, Geometry, GlProgram, Mesh, Rectangle, Shader, Sprite, Texture, UniformGroup } from "pixi.js";
import type { HexChunkId, HexDirection, HexFeature, HexMapArtifact, HexTile } from "@arcanorum/shared";
import { axialToPixel, hexEdgeCorners } from "./hexGeometry";
import type { HexCamera } from "./hexCamera";
import type { HexTerrainShaderQuality } from "./hexTerrainMaterials";
import {
  collectHexRiverShapes,
  RIVER_SHAPE_ATLAS_URL,
  RIVER_SHAPE_TILE_SIZE,
  resolveRiverShapeAtlasColumn,
  resolveRiverShapeSpriteRotation,
  type HexRiverShape,
} from "./hexRiverShapes";

type OverlayChunkRenderData = {
  chunkId: HexChunkId;
  bounds: { left: number; right: number; top: number; bottom: number };
  positions: Float32Array;
  colors: Float32Array;
  params: Float32Array;
  indices: Uint32Array;
};

type OverlayMeshPair = {
  chunk: OverlayChunkRenderData;
  primary: Mesh<Geometry, Shader>;
};

type RiverSpriteChunk = {
  chunkId: HexChunkId;
  bounds: OverlayChunkRenderData["bounds"];
  container: Container;
};

export type HexMapOverlayMeshRenderer = {
  container: Container;
  meshCount: number;
  setQuality: (quality: HexTerrainShaderQuality, reducedMotion: boolean) => void;
  updateVisibility: (camera: HexCamera, viewport: { width: number; height: number }) => number;
  destroy: () => void;
};

const FEATURE_COLORS: Record<Exclude<HexFeature, "none">, [number, number, number]> = {
  forest: [0.09, 0.28, 0.15],
  dense_forest: [0.06, 0.2, 0.12],
  jungle: [0.08, 0.32, 0.14],
  marsh: [0.16, 0.34, 0.3],
  scrub: [0.32, 0.3, 0.16],
  snowcap: [0.78, 0.84, 0.82],
};

export async function createHexMapOverlayMeshRenderer(map: HexMapArtifact): Promise<HexMapOverlayMeshRenderer> {
  const riverAtlasTexture = await loadRiverShapeTexture();
  const shader = createOverlayShader();
  const container = new Container();
  const chunks = buildOverlayChunks(map);
  const chunkMeshes = chunks.map((chunk) => {
    const geometry = createOverlayGeometry(chunk);
    const primary = new Mesh({ geometry, shader });
    container.addChild(primary);
    return { chunk, primary };
  });
  const riverChunks = buildRiverSpriteChunks(map, riverAtlasTexture);
  for (const chunk of riverChunks) {
    container.addChild(chunk.container);
  }
  let destroyed = false;

  return {
    container,
    meshCount: chunkMeshes.length + riverChunks.length,
    setQuality: (quality, reducedMotion) => updateOverlayShaderQuality(shader, quality, reducedMotion),
    updateVisibility: (camera, viewport) => updateOverlayVisibility(chunkMeshes, riverChunks, camera, viewport, map.settings.hexSize),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      for (const pair of chunkMeshes) {
        safeDestroyMesh(pair.primary);
      }
      for (const chunk of riverChunks) {
        safeDestroyContainer(chunk.container);
      }
      safeDestroyShader(shader);
      safeDestroyContainer(container);
    },
  };
}

function safeDestroyMesh(mesh: Mesh<Geometry, Shader>): void {
  try {
    mesh.destroy({ children: false });
  } catch {
    // Pixi may already have released shared geometry during React cleanup.
  }
}

function safeDestroyShader(shader: Shader): void {
  try {
    shader.destroy(true);
  } catch {
    // Cleanup must remain idempotent across StrictMode and route teardown.
  }
}

function safeDestroyContainer(container: Container): void {
  try {
    container.destroy({ children: false });
  } catch {
    // Cleanup must not surface as a player-facing map crash.
  }
}

function buildOverlayChunks(map: HexMapArtifact): OverlayChunkRenderData[] {
  const tileById = new Map(map.tiles.map((tile) => [tile.id, tile]));
  const drafts = new Map<
    HexChunkId,
    {
      positions: number[];
      colors: number[];
      params: number[];
      indices: number[];
      bounds: OverlayChunkRenderData["bounds"];
    }
  >();
  const ensureDraft = (chunkId: HexChunkId) => {
    const existing = drafts.get(chunkId);
    if (existing) return existing;
    const draft = {
      positions: [],
      colors: [],
      params: [],
      indices: [],
      bounds: { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, top: Number.POSITIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY },
    };
    drafts.set(chunkId, draft);
    return draft;
  };

  for (const tile of map.tiles) {
    if (tile.feature === "none") continue;
    const draft = ensureDraft(tile.chunkId);
    addFeatureGeometry(draft, tile, map.settings.hexSize);
  }
  for (const coast of map.coastOverlays) {
    const tile = tileById.get(coast.hexId);
    if (!tile) continue;
    const draft = ensureDraft(tile.chunkId);
    addCoastGeometry(draft, tile, coast.direction, coast.strength, map.settings.hexSize);
  }
  return Array.from(drafts.entries())
    .filter(([, draft]) => draft.indices.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chunkId, draft]) => ({
      chunkId,
      bounds: draft.bounds,
      positions: new Float32Array(draft.positions),
      colors: new Float32Array(draft.colors),
      params: new Float32Array(draft.params),
      indices: new Uint32Array(draft.indices),
    }));
}

function addFeatureGeometry(draft: ReturnType<typeof createDraftShape>, tile: HexTile, size: number): void {
  const center = axialToPixel(tile, size);
  const color = FEATURE_COLORS[tile.feature as Exclude<HexFeature, "none">] ?? FEATURE_COLORS.forest;
  const count = tile.feature === "dense_forest" || tile.feature === "jungle" ? 4 : 2;
  for (let index = 0; index < count; index += 1) {
    const x = center.x + (stableOffset(`${tile.id}:feature-x:${index}`) - 0.5) * size * 0.95;
    const y = center.y + (stableOffset(`${tile.id}:feature-y:${index}`) - 0.5) * size * 0.72;
    const radius = size * (0.07 + stableOffset(`${tile.id}:feature-r:${index}`) * 0.045);
    addDisc(draft, x, y, radius, color, 0.48, 2);
  }
}

function addCoastGeometry(draft: ReturnType<typeof createDraftShape>, tile: HexTile, direction: number, strength: number, size: number): void {
  const center = axialToPixel(tile, size);
  const [a, b] = hexEdgeCorners(center, size * 0.985, direction as HexDirection);
  addRibbon(draft, a.x, a.y, b.x, b.y, size * 0.16, resolveCoastColor(tile), 0.28 * strength, 0);
}

function resolveCoastColor(tile: HexTile): [number, number, number] {
  if (tile.biome === "cold" || tile.terrain === "snow" || tile.terrain === "tundra") return [0.78, 0.82, 0.74];
  if (tile.biome === "marsh" || tile.terrain === "wetland") return [0.38, 0.48, 0.32];
  if (tile.terrain === "mountains" || tile.terrain === "hills") return [0.48, 0.43, 0.31];
  if (tile.biome === "arid" || tile.terrain === "desert") return [0.76, 0.65, 0.38];
  return [0.66, 0.6, 0.34];
}

function addRibbon(
  draft: ReturnType<typeof createDraftShape>,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  halfWidth: number,
  color: [number, number, number],
  alpha: number,
  kind: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * halfWidth;
  const ny = (dx / length) * halfWidth;
  const start = draft.positions.length / 2;
  pushOverlayVertex(draft, x1 - nx, y1 - ny, color, alpha, kind);
  pushOverlayVertex(draft, x1 + nx, y1 + ny, color, alpha, kind);
  pushOverlayVertex(draft, x2 + nx, y2 + ny, color, alpha, kind);
  pushOverlayVertex(draft, x2 - nx, y2 - ny, color, alpha, kind);
  draft.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  expandBounds(draft.bounds, x1, y1, halfWidth * 2);
  expandBounds(draft.bounds, x2, y2, halfWidth * 2);
}

function addDisc(draft: ReturnType<typeof createDraftShape>, x: number, y: number, radius: number, color: [number, number, number], alpha: number, kind: number): void {
  const start = draft.positions.length / 2;
  pushOverlayVertex(draft, x, y, color, alpha, kind);
  for (let index = 0; index < 6; index += 1) {
    const angle = ((Math.PI * 2) / 6) * index;
    pushOverlayVertex(draft, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, color, alpha, kind);
  }
  for (let index = 0; index < 6; index += 1) {
    draft.indices.push(start, start + 1 + index, start + 1 + ((index + 1) % 6));
  }
  expandBounds(draft.bounds, x, y, radius);
}

function pushOverlayVertex(draft: ReturnType<typeof createDraftShape>, x: number, y: number, color: [number, number, number], alpha: number, kind: number): void {
  draft.positions.push(x, y);
  draft.colors.push(...color);
  draft.params.push(alpha, kind, stableOffset(`${x.toFixed(2)}:${y.toFixed(2)}`), 0);
}

function createDraftShape() {
  return {
    positions: [] as number[],
    colors: [] as number[],
    params: [] as number[],
    indices: [] as number[],
    bounds: { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, top: Number.POSITIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY },
  };
}

function createOverlayGeometry(chunk: OverlayChunkRenderData): Geometry {
  return new Geometry({
    label: chunk.chunkId,
    attributes: {
      aPosition: chunk.positions,
      aColor: chunk.colors,
      aParams: chunk.params,
    },
    indexBuffer: chunk.indices,
  });
}

function buildRiverSpriteChunks(map: HexMapArtifact, atlasTexture: Texture): RiverSpriteChunk[] {
  const tileById = new Map(map.tiles.map((tile) => [tile.id, tile]));
  const textureByKey = new Map<string, Texture>();
  const chunks = new Map<HexChunkId, RiverSpriteChunk>();

  for (const shape of collectHexRiverShapes(map)) {
    const tile = tileById.get(shape.hexId);
    if (!tile) continue;
    const chunk = ensureRiverSpriteChunk(chunks, tile.chunkId);
    const sprite = new Sprite(getRiverShapeTexture(atlasTexture, textureByKey, shape));
    const center = axialToPixel(tile, map.settings.hexSize);
    const tileSize = map.settings.hexSize * 2.28;
    sprite.anchor.set(0.5);
    sprite.position.set(center.x, center.y);
    sprite.width = tileSize;
    sprite.height = tileSize;
    sprite.rotation = resolveRiverShapeSpriteRotation(shape.rotation);
    sprite.alpha = Math.min(0.95, 0.74 + shape.width * 0.035);
    chunk.container.addChild(sprite);
    expandBounds(chunk.bounds, center.x, center.y, tileSize * 0.58);
  }

  return Array.from(chunks.values()).sort((a, b) => a.chunkId.localeCompare(b.chunkId));
}

function ensureRiverSpriteChunk(chunks: Map<HexChunkId, RiverSpriteChunk>, chunkId: HexChunkId): RiverSpriteChunk {
  const existing = chunks.get(chunkId);
  if (existing) return existing;
  const chunk = {
    chunkId,
    bounds: { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, top: Number.POSITIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY },
    container: new Container(),
  };
  chunks.set(chunkId, chunk);
  return chunk;
}

function getRiverShapeTexture(atlasTexture: Texture, cache: Map<string, Texture>, shape: HexRiverShape): Texture {
  const atlasColumn = resolveRiverShapeAtlasColumn(shape.mask);
  const key = String(atlasColumn);
  const cached = cache.get(key);
  if (cached) return cached;
  const texture = new Texture({
    source: atlasTexture.source,
    frame: new Rectangle(
      atlasColumn * RIVER_SHAPE_TILE_SIZE,
      0,
      RIVER_SHAPE_TILE_SIZE,
      RIVER_SHAPE_TILE_SIZE,
    ),
  });
  cache.set(key, texture);
  return texture;
}

async function loadRiverShapeTexture(): Promise<Texture> {
  const texture = await Assets.load<Texture>(RIVER_SHAPE_ATLAS_URL);
  if (!texture?.source) {
    throw new Error("hex-river-shape-texture-load-failed");
  }
  return texture;
}

function createOverlayShader(): Shader {
  return new Shader({
    glProgram: GlProgram.from({
      name: "arcanorum-hex-overlay-mesh",
      vertex: `
        in vec2 aPosition;
        in vec3 aColor;
        in vec4 aParams;

        out vec3 vColor;
        out vec4 vParams;
        out vec4 vDisplayColor;

        uniform mat3 uProjectionMatrix;
        uniform mat3 uWorldTransformMatrix;
        uniform vec4 uWorldColorAlpha;
        uniform mat3 uTransformMatrix;
        uniform vec4 uColor;
        uniform float uRound;

        void main(void) {
          vColor = aColor;
          vParams = aParams;
          vDisplayColor = uColor * uWorldColorAlpha;
          mat3 modelViewProjectionMatrix = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
          gl_Position = vec4((modelViewProjectionMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
        }
      `,
      fragment: `
        in vec3 vColor;
        in vec4 vParams;
        in vec4 vDisplayColor;

        out vec4 finalColor;

        uniform float uDetailStrength;
        uniform float uFlowStrength;
        uniform float uTime;

        float hash(float n) {
          return fract(sin(n) * 43758.5453123);
        }

        void main(void) {
          float grain = (hash(vParams.z * 71.0 + floor(uTime * 8.0)) - 0.5) * uDetailStrength;
          vec3 color = clamp(vColor + grain, 0.0, 1.0);
          finalColor = vec4(color, vParams.x) * vDisplayColor;
        }
      `,
    }),
    resources: {
      overlayUniforms: new UniformGroup({
        uDetailStrength: { value: 0.04, type: "f32" },
        uFlowStrength: { value: 1, type: "f32" },
        uTime: { value: 0, type: "f32" },
      }),
    },
  });
}

function updateOverlayShaderQuality(shader: Shader, quality: HexTerrainShaderQuality, reducedMotion: boolean): void {
  const resource = shader.resources.overlayUniforms as { uniforms?: { uDetailStrength: number; uFlowStrength: number; uTime: number } } | undefined;
  if (!resource?.uniforms) return;
  resource.uniforms.uDetailStrength = quality === "low" ? 0 : quality === "medium" ? 0.025 : 0.04;
  resource.uniforms.uFlowStrength = quality === "high" && !reducedMotion ? 1 : 0;
  resource.uniforms.uTime = performance.now() / 1000;
}

function updateOverlayVisibility(chunkMeshes: OverlayMeshPair[], riverChunks: RiverSpriteChunk[], camera: HexCamera, viewport: { width: number; height: number }, hexSize: number): number {
  const margin = hexSize * 5;
  const visibleRect = {
    left: camera.x - viewport.width / (2 * camera.scale) - margin,
    right: camera.x + viewport.width / (2 * camera.scale) + margin,
    top: camera.y - viewport.height / (2 * camera.scale) - margin,
    bottom: camera.y + viewport.height / (2 * camera.scale) + margin,
  };
  let visible = 0;
  for (const pair of chunkMeshes) {
    const primaryVisible = intersects(pair.chunk.bounds, visibleRect, 0);
    pair.primary.visible = primaryVisible;
    if (primaryVisible) visible += 1;
  }
  for (const chunk of riverChunks) {
    const chunkVisible = intersects(chunk.bounds, visibleRect, 0);
    chunk.container.visible = chunkVisible;
    if (chunkVisible) visible += 1;
  }
  return visible;
}

function intersects(bounds: OverlayChunkRenderData["bounds"], rect: { left: number; right: number; top: number; bottom: number }, xOffset: number): boolean {
  return bounds.right + xOffset >= rect.left && bounds.left + xOffset <= rect.right && bounds.bottom >= rect.top && bounds.top <= rect.bottom;
}

function expandBounds(bounds: OverlayChunkRenderData["bounds"], x: number, y: number, radius: number): void {
  bounds.left = Math.min(bounds.left, x - radius);
  bounds.right = Math.max(bounds.right, x + radius);
  bounds.top = Math.min(bounds.top, y - radius);
  bounds.bottom = Math.max(bounds.bottom, y + radius);
}

function stableOffset(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}
