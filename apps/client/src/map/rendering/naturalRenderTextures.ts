import Phaser from "phaser";
import type {
  HexMapClientChunk,
  HexMapSettings,
  NaturalFeatureRenderLod,
  NaturalFeatureVisualCatalog,
} from "@arcanorum/shared";
import { axialToPixel } from "../hexGeometry";
import {
  resolveNaturalFeaturePlacements,
  type ResolvedNaturalFeaturePlacement,
} from "./naturalFeatureVisuals";

export type NaturalRenderTextureBuild = {
  texture: Phaser.GameObjects.RenderTexture;
  gpuBytes: number;
  logicalObjectCount: number;
  buildMs: number;
};

export type NaturalRenderTextureBudgetSnapshot = {
  allocatedBytes: number;
  deniedDetailedLayers: number;
  renderTextureCount: number;
};

export class NaturalRenderTextureBudget {
  private allocatedBytes = 0;
  private deniedDetailedLayers = 0;
  private renderTextureCount = 0;

  constructor(private readonly maxGpuBytes: number) {}

  tryReserve(bytes: number, detailed: boolean): boolean {
    if (this.allocatedBytes + bytes > this.maxGpuBytes) {
      if (detailed) this.deniedDetailedLayers += 1;
      return false;
    }
    this.allocatedBytes += bytes;
    this.renderTextureCount += 1;
    return true;
  }

  release(bytes: number): void {
    this.allocatedBytes = Math.max(0, this.allocatedBytes - bytes);
    this.renderTextureCount = Math.max(0, this.renderTextureCount - 1);
  }

  snapshot(): NaturalRenderTextureBudgetSnapshot {
    return {
      allocatedBytes: this.allocatedBytes,
      deniedDetailedLayers: this.deniedDetailedLayers,
      renderTextureCount: this.renderTextureCount,
    };
  }
}

export function resolveNaturalRenderTextureBudget(): NaturalRenderTextureBudget {
  const mobile =
    typeof navigator !== "undefined" &&
    (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ||
      navigator.hardwareConcurrency <= 4);
  return new NaturalRenderTextureBudget((mobile ? 32 : 96) * 1024 * 1024);
}

export function estimateNaturalRenderTextureBytes(
  chunk: HexMapClientChunk,
  settings: HexMapSettings,
  resolution: number,
): number {
  const bounds = resolveNaturalChunkBounds(chunk, settings);
  return (
    Math.ceil(bounds.width * resolution) *
    Math.ceil(bounds.height * resolution) *
    4
  );
}

export function buildNaturalRenderTexture(params: {
  scene: Phaser.Scene;
  chunk: HexMapClientChunk;
  settings: HexMapSettings;
  catalog: NaturalFeatureVisualCatalog;
  lod: NaturalFeatureRenderLod;
  resolution: number;
  depth: number;
}): NaturalRenderTextureBuild | null {
  const bounds = resolveNaturalChunkBounds(params.chunk, params.settings);
  const pixelWidth = Math.ceil(bounds.width * params.resolution);
  const pixelHeight = Math.ceil(bounds.height * params.resolution);
  if (pixelWidth > 4096 || pixelHeight > 4096) return null;
  const startedAt = performance.now();
  const texture = params.scene.add
    .renderTexture(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
      pixelWidth,
      pixelHeight,
    )
    .setScale(1 / params.resolution)
    .setDepth(params.depth);
  const drawCommands = params.chunk.tiles.flatMap((tile) => {
    const center = axialToPixel(tile, params.settings.hexSize);
    return resolveNaturalFeaturePlacements(
      tile,
      params.catalog,
      params.settings.seed,
      params.lod,
    ).map((placement) => ({ center, placement }));
  });
  // Phaser 4 batches these stamp commands in its DynamicTexture command buffer.
  // This is the Phaser 4 equivalent of Phaser 3's beginDraw/batchDrawFrame/endDraw
  // pipeline, while retaining recipe-defined scale, rotation, and origin.
  for (const command of drawCommands.sort(compareNaturalDrawCommands)) {
    texture.stamp(
      command.placement.textureKey,
      command.placement.frame,
      (command.center.x -
        bounds.x +
        command.placement.offsetX * params.settings.hexSize * Math.sqrt(3)) *
        params.resolution,
      (command.center.y -
        bounds.y +
        command.placement.offsetY * params.settings.hexSize * 2) *
        params.resolution,
      {
        originX: 0.5,
        originY: 0.88,
        scale:
          (params.settings.hexSize / 64) *
          command.placement.scale *
          params.resolution,
        rotation: command.placement.rotation,
      },
    );
  }
  texture.render();
  return {
    texture,
    gpuBytes: pixelWidth * pixelHeight * 4,
    logicalObjectCount: drawCommands.length,
    buildMs: performance.now() - startedAt,
  };
}

function resolveNaturalChunkBounds(
  chunk: HexMapClientChunk,
  settings: HexMapSettings,
): { x: number; y: number; width: number; height: number } {
  const centers = chunk.tiles.map((tile) =>
    axialToPixel(tile, settings.hexSize),
  );
  const padding = settings.hexSize * 3;
  const minX = Math.min(...centers.map((center) => center.x)) - padding;
  const maxX = Math.max(...centers.map((center) => center.x)) + padding;
  const minY = Math.min(...centers.map((center) => center.y)) - padding;
  const maxY = Math.max(...centers.map((center) => center.y)) + padding;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function compareNaturalDrawCommands(
  left: {
    center: { x: number; y: number };
    placement: ResolvedNaturalFeaturePlacement;
  },
  right: {
    center: { x: number; y: number };
    placement: ResolvedNaturalFeaturePlacement;
  },
): number {
  const layerOrder = { landform: 0, snow: 1, wet: 2, vegetation: 3 } as const;
  return (
    layerOrder[left.placement.layer] - layerOrder[right.placement.layer] ||
    left.placement.drawOrder - right.placement.drawOrder ||
    left.center.y - right.center.y ||
    left.placement.id.localeCompare(right.placement.id)
  );
}
