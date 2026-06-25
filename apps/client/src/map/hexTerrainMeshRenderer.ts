import { Container, Geometry, GlProgram, Mesh, Shader, UniformGroup } from "pixi.js";
import type { HexMapArtifact } from "@arcanorum/shared";
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
};

export async function createHexTerrainMeshRenderer(map: HexMapArtifact): Promise<HexTerrainMeshRenderer> {
  const materialTextures = await loadHexMaterialTextures(generatedHexMaterialPack);
  const shader = createHexTerrainShader(materialTextures);
  const container = new Container();
  const meshData = buildHexTerrainMeshData(map, generatedHexMaterialPack);
  const chunkMeshes = meshData.chunks.map((chunk) => {
    const geometry = createChunkGeometry(chunk);
    const primary = new Mesh({ geometry, shader });
    container.addChild(primary);
    return { chunk, primary };
  });
  let destroyed = false;

  return {
    container,
    meshData,
    meshCount: chunkMeshes.length,
    setQuality: (quality, reducedMotion) => updateShaderQuality(shader, quality, reducedMotion),
    updateVisibility: (camera, viewport) => {
      updateShaderCameraScale(shader, camera.scale);
      return updateChunkVisibility(chunkMeshes, camera, viewport, map.settings.hexSize);
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      for (const pair of chunkMeshes) {
        safeDestroyMesh(pair.primary);
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
      aCoastParams: chunk.coastParams,
      aTransitionParams: chunk.transitionParams,
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
    pair.primary.visible = primaryVisible;
    if (primaryVisible) visible += 1;
  }
  return visible;
}

function intersects(bounds: HexChunkRenderData["bounds"], rect: { left: number; right: number; top: number; bottom: number }, xOffset: number): boolean {
  return bounds.right + xOffset >= rect.left && bounds.left + xOffset <= rect.right && bounds.bottom >= rect.top && bounds.top <= rect.bottom;
}

function createHexTerrainShader(materialTextures: LoadedHexMaterialTextures): Shader {
  const atlas = materialTextures.pack.atlas;
  const coastMasks = materialTextures.pack.coastMasks;
  const biomeTransitions = materialTextures.pack.biomeTransitions;
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
        in vec4 aCoastParams;
        in vec4 aTransitionParams;

        out vec2 vWorld;
        out vec2 vLocal;
        out vec3 vBaseColor;
        out vec3 vEdgeColor;
        out vec2 vMaterialIndices;
        out vec4 vMaterialWeights;
        out vec4 vCoastParams;
        out vec4 vTransitionParams;
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
          vCoastParams = aCoastParams;
          vTransitionParams = aTransitionParams;
          vColor = uColor * uWorldColorAlpha;
          mat3 modelViewProjectionMatrix = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
          gl_Position = vec4((modelViewProjectionMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
        }
      `,
      fragment: `
        uniform sampler2D uAlbedoTexture;
        uniform sampler2D uDetailTexture;
        uniform sampler2D uCoastMaskTexture;
        uniform sampler2D uBiomeTransitionMaskTexture;

        in vec2 vWorld;
        in vec2 vLocal;
        in vec3 vBaseColor;
        in vec3 vEdgeColor;
        in vec2 vMaterialIndices;
        in vec4 vMaterialWeights;
        in vec4 vCoastParams;
        in vec4 vTransitionParams;
        in vec4 vColor;

        out vec4 finalColor;

        uniform vec4 uAtlasGrid;
        uniform vec4 uCoastMaskGrid;
        uniform vec4 uBiomeTransitionMaskGrid;
        uniform float uDetailStrength;
        uniform float uNormalStrength;
        uniform float uMaterialStrength;
        uniform float uWaterAnimation;
        uniform float uPainterlyStrength;
        uniform float uCoastMaskStrength;
        uniform float uCoastFoamStrength;
        uniform float uBiomeTransitionStrength;
        uniform float uZoomDetail;
        uniform float uTime;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float valueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
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

        vec2 coastMaskUv(float maskIndex, vec2 localUv) {
          float column = mod(maskIndex, uCoastMaskGrid.x);
          float row = floor(maskIndex / uCoastMaskGrid.x);
          vec2 tileUv = clamp(localUv, vec2(0.0), vec2(1.0));
          tileUv = tileUv * 0.98 + vec2(0.01);
          return (vec2(column, row) + tileUv) * uCoastMaskGrid.zw;
        }

        vec2 biomeTransitionMaskUv(float maskIndex, vec2 localUv) {
          float column = mod(maskIndex, uBiomeTransitionMaskGrid.x);
          float row = floor(maskIndex / uBiomeTransitionMaskGrid.x);
          vec2 tileUv = clamp(localUv, vec2(0.0), vec2(1.0));
          tileUv = tileUv * 0.98 + vec2(0.01);
          return (vec2(column, row) + tileUv) * uBiomeTransitionMaskGrid.zw;
        }

        void main(void) {
          float waterMask = step(0.08, vBaseColor.b - vBaseColor.r) * step(vBaseColor.r, 0.32);
          float edgeWaterMask = step(0.08, vEdgeColor.b - vEdgeColor.r) * step(vEdgeColor.r, 0.32);
          float coastTransition = abs(edgeWaterMask - waterMask);
          vec2 worldUv = vWorld * mix(0.010, 0.021, waterMask) + vec2(vMaterialWeights.z * 0.31, vMaterialWeights.w * 0.19);
          vec3 baseColor = sampleMaterial(vMaterialIndices.x, worldUv, vBaseColor, waterMask);
          vec3 edgeColor = sampleMaterial(vMaterialIndices.y, worldUv + vLocal * 0.07, vEdgeColor, waterMask);
          float borderNoise = valueNoise(vWorld * mix(0.052, 0.031, coastTransition) + vLocal * mix(8.0, 3.4, coastTransition) + vec2(vMaterialWeights.z * 5.0, vMaterialWeights.w * 3.0)) - 0.5;
          float edgeDistance = length(vLocal);
          float landBlend = smoothstep(0.81 + borderNoise * 0.08, 0.99 + borderNoise * 0.035, edgeDistance);
          float coastEnabled = step(0.5, vCoastParams.w) * uCoastMaskStrength;
          vec2 maskUv = coastMaskUv(vCoastParams.x, vLocal * 0.5 + vec2(0.5));
          float coastWaterAmount = texture(uCoastMaskTexture, maskUv).r;
          coastWaterAmount = pow(coastWaterAmount, mix(1.45, 0.78, clamp(vCoastParams.y, 0.0, 1.0)));
          coastWaterAmount = clamp(coastWaterAmount, 0.0, 1.0);
          vec2 transitionUv = biomeTransitionMaskUv(vTransitionParams.x, vLocal * 0.5 + vec2(0.5));
          float transitionMask = texture(uBiomeTransitionMaskTexture, transitionUv).r * vTransitionParams.y * vTransitionParams.z;
          transitionMask = smoothstep(0.34, 0.66, transitionMask);
          float simpleEdgeBlend = landBlend * vMaterialWeights.x * mix(1.0, 0.12, coastTransition) * mix(0.22, 0.42, uPainterlyStrength);
          float transitionAmount = mix(simpleEdgeBlend, transitionMask, uBiomeTransitionStrength);
          transitionAmount *= 1.0 - smoothstep(0.18, 0.82, coastWaterAmount) * coastEnabled;
          vec3 color = mix(baseColor, edgeColor, transitionAmount);
          vec3 coastWaterColor = sampleMaterial(vCoastParams.z, worldUv * 1.14 + vec2(0.07, 0.03), vec3(0.18, 0.48, 0.52), 1.0);
          float shorelineBand = smoothstep(0.38, 0.5, coastWaterAmount) - smoothstep(0.54, 0.7, coastWaterAmount);
          color = mix(color, coastWaterColor, coastWaterAmount * coastEnabled);
          color += shorelineBand * vec3(0.045, 0.055, 0.04) * uCoastFoamStrength * coastEnabled;
          float effectiveWaterMask = max(waterMask, coastWaterAmount * coastEnabled);
          float grainScale = mix(30.0, 18.0, effectiveWaterMask);
          float grain = hash(floor((vLocal + vec2(vMaterialWeights.y, vMaterialWeights.z)) * grainScale));
          float paper = valueNoise(vWorld * 0.028 + vec2(vMaterialWeights.w * 9.0, vMaterialWeights.z * 5.0));
          float paperFine = valueNoise(vWorld * 0.085 + vec2(vMaterialWeights.z * 4.0, vMaterialWeights.w * 7.0));
          float detail = ((grain - 0.5) * 0.16 + (paper - 0.5) * 0.16 + (paperFine - 0.5) * 0.08) * uDetailStrength * uZoomDetail * mix(1.0, 0.42, effectiveWaterMask);
          float elevationShade = (vMaterialWeights.y - 0.5) * 0.17 * uNormalStrength * (1.0 - effectiveWaterMask);
          float waterPulse =
            (sin(uTime * 0.72 + vWorld.x * 0.024) + sin(uTime * 0.56 + vWorld.y * 0.031 + vWorld.x * 0.01)) *
            0.018 *
            uWaterAnimation *
            effectiveWaterMask;
          vec3 warmLand = vec3(color.r * 1.09 + 0.025, color.g * 1.04 + 0.016, color.b * 0.88);
          vec3 deepWater = vec3(color.r * 0.62, color.g * 1.04 + 0.025, color.b * 1.2 + 0.055);
          color = mix(mix(color, warmLand, uPainterlyStrength * 0.54), deepWater, effectiveWaterMask * 0.78);
          color += detail + elevationShade + waterPulse;
          color = mix(color, vec3(color.r * 0.82, color.g * 1.06, color.b * 1.18), effectiveWaterMask * 0.36);
          finalColor = vec4(clamp(color, 0.0, 1.0), 1.0) * vColor;
        }
      `,
    }),
    resources: {
      terrainUniforms: new UniformGroup({
        uAtlasGrid: { value: new Float32Array([atlas.columns, atlas.rows, 1 / atlas.columns, 1 / atlas.rows]), type: "vec4<f32>" },
        uCoastMaskGrid: { value: new Float32Array([coastMasks.columns, coastMasks.rows, 1 / coastMasks.columns, 1 / coastMasks.rows]), type: "vec4<f32>" },
        uBiomeTransitionMaskGrid: { value: new Float32Array([biomeTransitions.columns, biomeTransitions.rows, 1 / biomeTransitions.columns, 1 / biomeTransitions.rows]), type: "vec4<f32>" },
        uDetailStrength: { value: 0.08, type: "f32" },
        uNormalStrength: { value: 0.06, type: "f32" },
        uMaterialStrength: { value: 1, type: "f32" },
        uWaterAnimation: { value: 1, type: "f32" },
        uPainterlyStrength: { value: 1, type: "f32" },
        uCoastMaskStrength: { value: 1, type: "f32" },
        uCoastFoamStrength: { value: 1, type: "f32" },
        uBiomeTransitionStrength: { value: 1, type: "f32" },
        uZoomDetail: { value: 1, type: "f32" },
        uTime: { value: 0, type: "f32" },
      }),
      uAlbedoTexture: materialTextures.albedoSource,
      uAlbedoSampler: materialTextures.albedoSource.style,
      uDetailTexture: materialTextures.detailSource,
      uDetailSampler: materialTextures.detailSource.style,
      uCoastMaskTexture: materialTextures.coastMaskSource,
      uCoastMaskSampler: materialTextures.coastMaskSource.style,
      uBiomeTransitionMaskTexture: materialTextures.biomeTransitionSource,
      uBiomeTransitionMaskSampler: materialTextures.biomeTransitionSource.style,
    },
  });
}

function updateShaderQuality(shader: Shader, quality: HexTerrainShaderQuality, reducedMotion: boolean): void {
  const resource = shader.resources.terrainUniforms as { uniforms?: { uDetailStrength: number; uNormalStrength: number; uMaterialStrength: number; uWaterAnimation: number; uPainterlyStrength: number; uCoastMaskStrength: number; uCoastFoamStrength: number; uBiomeTransitionStrength: number; uTime: number } } | undefined;
  if (!resource?.uniforms) return;
  const features = resolveShaderQualityFeatures(quality);
  resource.uniforms.uDetailStrength = features.detail ? 0.22 : 0;
  resource.uniforms.uNormalStrength = features.normal ? 0.08 : 0.035;
  resource.uniforms.uMaterialStrength = quality === "low" ? 0.44 : 1;
  resource.uniforms.uWaterAnimation = features.animatedWater && !reducedMotion ? 1 : 0;
  resource.uniforms.uPainterlyStrength = quality === "low" ? 0.62 : 1;
  resource.uniforms.uCoastMaskStrength = features.coastMasks ? 1 : 0;
  resource.uniforms.uCoastFoamStrength = features.coastFoam ? 1 : 0;
  resource.uniforms.uBiomeTransitionStrength = features.biomeTransitions ? 1 : 0;
  resource.uniforms.uTime = performance.now() / 1000;
}

export function resolvePainterlyTerrainZoomDetail(scale: number): number {
  if (scale <= 0.32) return 0.45;
  if (scale >= 1.05) return 1.1;
  return 0.45 + ((scale - 0.32) / (1.05 - 0.32)) * 0.65;
}

function updateShaderCameraScale(shader: Shader, scale: number): void {
  const resource = shader.resources.terrainUniforms as { uniforms?: { uZoomDetail: number } } | undefined;
  if (!resource?.uniforms) return;
  resource.uniforms.uZoomDetail = resolvePainterlyTerrainZoomDetail(scale);
}
