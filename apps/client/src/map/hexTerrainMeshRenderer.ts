import { Container, Geometry, GlProgram, Mesh, Shader, UniformGroup } from "pixi.js";
import type { HexMapArtifact } from "@arcanorum/shared";
import { worldPixelWidth } from "./hexGeometry";
import { buildHexTerrainMeshData, type HexChunkRenderData, type HexTerrainMeshBuildResult } from "./hexTerrainMesh";
import { generatedHexMaterialPack, resolveShaderQualityFeatures, type HexTerrainShaderQuality } from "./hexTerrainMaterials";
import { loadHexMaterialTextures, type LoadedHexMaterialTextures } from "./hexTerrainMaterialTextures";
import type { HexCamera } from "./hexCamera";

export type HexTerrainMeshRenderer = {
  container: Container;
  meshData: HexTerrainMeshBuildResult;
  meshCount: number;
  setQuality: (quality: HexTerrainShaderQuality, reducedMotion: boolean) => void;
  updateVisibility: (camera: HexCamera, viewport: { width: number; height: number }) => number;
  destroy: () => void;
};

type ChunkMeshPair = {
  chunk: HexChunkRenderData;
  primary: Mesh<Geometry, Shader>;
  wrapped: Mesh<Geometry, Shader>;
};

export async function createHexTerrainMeshRenderer(map: HexMapArtifact): Promise<HexTerrainMeshRenderer> {
  const materialTextures = await loadHexMaterialTextures(generatedHexMaterialPack);
  const shader = createHexTerrainShader(materialTextures);
  const container = new Container();
  const meshData = buildHexTerrainMeshData(map, generatedHexMaterialPack);
  const wrapWidth = worldPixelWidth(map.settings);
  const chunkMeshes = meshData.chunks.map((chunk) => {
    const geometry = createChunkGeometry(chunk);
    const primary = new Mesh({ geometry, shader });
    const wrapped = new Mesh({ geometry, shader });
    wrapped.position.x = wrapWidth;
    container.addChild(primary, wrapped);
    return { chunk, primary, wrapped };
  });
  let destroyed = false;

  return {
    container,
    meshData,
    meshCount: chunkMeshes.length * 2,
    setQuality: (quality, reducedMotion) => updateShaderQuality(shader, quality, reducedMotion),
    updateVisibility: (camera, viewport) => updateChunkVisibility(chunkMeshes, camera, viewport, map.settings.hexSize),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      for (const pair of chunkMeshes) {
        safeDestroyMesh(pair.primary);
        safeDestroyMesh(pair.wrapped);
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

export function createChunkGeometry(chunk: HexChunkRenderData): Geometry {
  return new Geometry({
    label: chunk.chunkId,
    attributes: {
      aPosition: chunk.positions,
      aLocal: chunk.locals,
      aBaseColor: chunk.baseColors,
      aEdgeColor: chunk.edgeColors,
      aMaterialIndices: chunk.materialIndices,
      aMaterialWeights: chunk.materialWeights,
    },
    indexBuffer: chunk.indices,
  });
}

function updateChunkVisibility(chunkMeshes: ChunkMeshPair[], camera: HexCamera, viewport: { width: number; height: number }, hexSize: number): number {
  const margin = hexSize * 4;
  const visibleRect = {
    left: camera.x - viewport.width / (2 * camera.scale) - margin,
    right: camera.x + viewport.width / (2 * camera.scale) + margin,
    top: camera.y - viewport.height / (2 * camera.scale) - margin,
    bottom: camera.y + viewport.height / (2 * camera.scale) + margin,
  };
  let visible = 0;
  for (const pair of chunkMeshes) {
    const primaryVisible = intersects(pair.chunk.bounds, visibleRect, 0);
    const wrappedVisible = intersects(pair.chunk.bounds, visibleRect, pair.wrapped.position.x);
    pair.primary.visible = primaryVisible;
    pair.wrapped.visible = wrappedVisible;
    if (primaryVisible) visible += 1;
    if (wrappedVisible) visible += 1;
  }
  return visible;
}

function intersects(bounds: HexChunkRenderData["bounds"], rect: { left: number; right: number; top: number; bottom: number }, xOffset: number): boolean {
  return bounds.right + xOffset >= rect.left && bounds.left + xOffset <= rect.right && bounds.bottom >= rect.top && bounds.top <= rect.bottom;
}

function createHexTerrainShader(materialTextures: LoadedHexMaterialTextures): Shader {
  const atlas = materialTextures.pack.atlas;
  return new Shader({
    glProgram: GlProgram.from({
      name: "arcanorum-hex-terrain-mesh",
      vertex: `
        in vec2 aPosition;
        in vec2 aLocal;
        in vec3 aBaseColor;
        in vec3 aEdgeColor;
        in vec2 aMaterialIndices;
        in vec4 aMaterialWeights;

        out vec2 vWorld;
        out vec2 vLocal;
        out vec3 vBaseColor;
        out vec3 vEdgeColor;
        out vec2 vMaterialIndices;
        out vec4 vMaterialWeights;
        out vec4 vColor;

        uniform mat3 uProjectionMatrix;
        uniform mat3 uWorldTransformMatrix;
        uniform vec4 uWorldColorAlpha;
        uniform mat3 uTransformMatrix;
        uniform vec4 uColor;
        uniform float uRound;

        void main(void) {
          vWorld = aPosition;
          vLocal = aLocal;
          vBaseColor = aBaseColor;
          vEdgeColor = aEdgeColor;
          vMaterialIndices = aMaterialIndices;
          vMaterialWeights = aMaterialWeights;
          vColor = uColor * uWorldColorAlpha;
          mat3 modelViewProjectionMatrix = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
          gl_Position = vec4((modelViewProjectionMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
        }
      `,
      fragment: `
        uniform sampler2D uAlbedoTexture;
        uniform sampler2D uDetailTexture;

        in vec2 vWorld;
        in vec2 vLocal;
        in vec3 vBaseColor;
        in vec3 vEdgeColor;
        in vec2 vMaterialIndices;
        in vec4 vMaterialWeights;
        in vec4 vColor;

        out vec4 finalColor;

        uniform vec4 uAtlasGrid;
        uniform float uDetailStrength;
        uniform float uNormalStrength;
        uniform float uMaterialStrength;
        uniform float uWaterAnimation;
        uniform float uTime;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        vec2 atlasUv(float materialIndex, vec2 worldUv) {
          float column = mod(materialIndex, uAtlasGrid.x);
          float row = floor(materialIndex / uAtlasGrid.x);
          vec2 tileUv = fract(worldUv);
          tileUv = tileUv * 0.99 + vec2(0.005);
          return (vec2(column, row) + tileUv) * uAtlasGrid.zw;
        }

        vec3 sampleMaterial(float materialIndex, vec2 worldUv, vec3 tint, float waterMask) {
          vec2 uv = atlasUv(materialIndex, worldUv);
          vec3 albedo = texture(uAlbedoTexture, uv).rgb;
          vec3 detail = texture(uDetailTexture, uv * vec2(1.0, 1.0)).rgb - vec3(0.5);
          float detailScale = uDetailStrength * mix(0.72, 0.34, waterMask);
          vec3 textured = albedo + detail * detailScale;
          return mix(tint, textured, uMaterialStrength);
        }

        void main(void) {
          float edge = smoothstep(0.64, 1.0, length(vLocal)) * vMaterialWeights.x;
          float waterMask = step(0.08, vBaseColor.b - vBaseColor.r) * step(vBaseColor.r, 0.32);
          vec2 worldUv = vWorld * mix(0.011, 0.018, waterMask) + vec2(vMaterialWeights.z * 0.31, vMaterialWeights.w * 0.19);
          vec3 baseColor = sampleMaterial(vMaterialIndices.x, worldUv, vBaseColor, waterMask);
          vec3 edgeColor = sampleMaterial(vMaterialIndices.y, worldUv + vLocal * 0.07, vEdgeColor, waterMask);
          vec3 color = mix(baseColor, edgeColor, edge * 0.42);
          float grainScale = mix(42.0, 15.0, waterMask);
          float grain = hash(floor((vLocal + vec2(vMaterialWeights.y, vMaterialWeights.z)) * grainScale));
          float detail = (grain - 0.5) * uDetailStrength * 0.28 * mix(1.0, 0.32, waterMask);
          float elevationShade = (vMaterialWeights.y - 0.5) * 0.11 * uNormalStrength * (1.0 - waterMask);
          float waterPulse =
            (sin(uTime * 0.9 + vWorld.x * 0.021) + sin(uTime * 0.7 + vWorld.y * 0.027 + vWorld.x * 0.008)) *
            0.012 *
            uWaterAnimation *
            waterMask;
          color += detail + elevationShade + waterPulse;
          color = mix(color, vec3(color.r * 0.92, color.g * 1.03, color.b * 1.08), waterMask * 0.45);
          finalColor = vec4(clamp(color, 0.0, 1.0), 1.0) * vColor;
        }
      `,
    }),
    resources: {
      terrainUniforms: new UniformGroup({
        uAtlasGrid: { value: new Float32Array([atlas.columns, atlas.rows, 1 / atlas.columns, 1 / atlas.rows]), type: "vec4<f32>" },
        uDetailStrength: { value: 0.08, type: "f32" },
        uNormalStrength: { value: 0.06, type: "f32" },
        uMaterialStrength: { value: 1, type: "f32" },
        uWaterAnimation: { value: 1, type: "f32" },
        uTime: { value: 0, type: "f32" },
      }),
      uAlbedoTexture: materialTextures.albedoSource,
      uAlbedoSampler: materialTextures.albedoSource.style,
      uDetailTexture: materialTextures.detailSource,
      uDetailSampler: materialTextures.detailSource.style,
    },
  });
}

function updateShaderQuality(shader: Shader, quality: HexTerrainShaderQuality, reducedMotion: boolean): void {
  const resource = shader.resources.terrainUniforms as { uniforms?: { uDetailStrength: number; uNormalStrength: number; uMaterialStrength: number; uWaterAnimation: number; uTime: number } } | undefined;
  if (!resource?.uniforms) return;
  const features = resolveShaderQualityFeatures(quality);
  resource.uniforms.uDetailStrength = features.detail ? 0.16 : 0;
  resource.uniforms.uNormalStrength = features.normal ? 0.06 : 0;
  resource.uniforms.uMaterialStrength = quality === "low" ? 0.36 : 1;
  resource.uniforms.uWaterAnimation = features.animatedWater && !reducedMotion ? 1 : 0;
  resource.uniforms.uTime = performance.now() / 1000;
}
