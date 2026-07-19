import Phaser from "phaser";
import type { HexId, HexMapClientChunk, HexMapSettings, HexTile, NaturalFeatureRenderLod, NaturalFeatureVisualCatalog, WorldBase } from "@arcanorum/shared";
import { axialToPixel, getNeighborAxial, makeHexId } from "../hexGeometry";
import { resolveMapDisplayOwner, resolveMapDisplayRegionId } from "../mapPoliticalOwnership";
import { resolveHexBoundaryMask } from "./hexBorderMasks";
import {
  normalizeFeatureVisualGroup,
  resolveObjectTextureFrame,
  resolveTerrainTextureFrame,
} from "./hexTextureFrames";
import { PHASER_MAP_ART } from "./phaserMapArt";
import {
  buildNaturalRenderTexture,
  estimateNaturalRenderTextureBytes,
  type NaturalRenderTextureBudget,
} from "./naturalRenderTextures";
import type { PhaserMapTheme } from "./phaserMapTheme";

export type PhaserMapPoliticalState = Pick<WorldBase, "hexOwner" | "regionOwner" | "regionController">;

type HexMapDataConfig = Phaser.Types.Tilemaps.MapDataConfig & {
  hexSideLength: number;
  staggerAxis: "y";
  staggerIndex: "odd" | "even";
};

type ChunkLayers = {
  terrain: Phaser.Tilemaps.TilemapLayer;
  fill: Phaser.Tilemaps.TilemapLayer;
  rivers: Phaser.Tilemaps.TilemapLayer;
  regionBorders: Phaser.Tilemaps.TilemapLayer;
  countryBorders: Phaser.Tilemaps.TilemapLayer;
  controllerBorders: Phaser.Tilemaps.TilemapLayer;
  selection: Phaser.Tilemaps.TilemapLayer;
};

const DEPTH = {
  terrain: 0,
  fill: 10,
  rivers: 20,
  objects: 30,
  regionBorders: 40,
  countryBorders: 41,
  controllerBorders: 42,
  selection: 50,
} as const;

type NaturalChunkTexture = {
  texture: Phaser.GameObjects.RenderTexture;
  gpuBytes: number;
  logicalObjectCount: number;
  buildMs: number;
};

export type NaturalChunkRenderTextureMetrics = {
  renderTextureCount: number;
  simplifiedRenderTextureCount: number;
  detailedRenderTextureCount: number;
  gpuBytes: number;
  logicalObjectCount: number;
  buildMs: number;
};

export class PhaserHexChunkLayer {
  readonly chunk: HexMapClientChunk;

  private readonly tilemap: Phaser.Tilemaps.Tilemap;
  private readonly layers: ChunkLayers;
  private readonly tileById: ReadonlyMap<HexId, HexTile>;
  private readonly objectImages: Phaser.GameObjects.Image[] = [];
  private readonly scene: Phaser.Scene;
  private readonly settings: HexMapSettings;
  private readonly naturalRenderTextureBudget: NaturalRenderTextureBudget;
  private readonly enqueueNaturalBuild: (task: () => void) => void;
  private readonly onNaturalTextureBuilt: (buildMs: number) => void;
  private readonly naturalTextures = new Map<NaturalFeatureRenderLod, NaturalChunkTexture>();
  private readonly pendingNaturalLods = new Set<NaturalFeatureRenderLod>();
  private readonly localWidth: number;
  private readonly localHeight: number;
  private readonly scaleX: number;
  private readonly scaleY: number;
  private politicalState: PhaserMapPoliticalState;
  private countryColorById: Readonly<Record<string, string>>;
  private selectedHexId: HexId | null = null;
  private mapTheme: PhaserMapTheme;
  private visible = false;
  private objectsVisible = true;
  private destroyed = false;
  private naturalLod: NaturalFeatureRenderLod = "simplified";

  constructor(params: {
    scene: Phaser.Scene;
    chunk: HexMapClientChunk;
    settings: HexMapSettings;
    politicalState: PhaserMapPoliticalState;
    countryColorById: Readonly<Record<string, string>>;
    mapTheme: PhaserMapTheme;
    naturalFeatureVisualCatalog: NaturalFeatureVisualCatalog;
    naturalRenderTextureBudget: NaturalRenderTextureBudget;
    enqueueNaturalBuild: (task: () => void) => void;
    onNaturalTextureBuilt: (buildMs: number) => void;
  }) {
    this.chunk = params.chunk;
    this.scene = params.scene;
    this.settings = params.settings;
    this.politicalState = params.politicalState;
    this.countryColorById = params.countryColorById;
    this.mapTheme = params.mapTheme;
    this.naturalFeatureVisualCatalog = params.naturalFeatureVisualCatalog;
    this.naturalRenderTextureBudget = params.naturalRenderTextureBudget;
    this.enqueueNaturalBuild = params.enqueueNaturalBuild;
    this.onNaturalTextureBuilt = params.onNaturalTextureBuilt;
    this.localWidth = params.chunk.bounds.maxQ - params.chunk.bounds.minQ + 1;
    this.localHeight = params.chunk.bounds.maxR - params.chunk.bounds.minR + 1;
    this.scaleX = (params.settings.hexSize * Math.sqrt(3)) / PHASER_MAP_ART.frame.width;
    this.scaleY = params.settings.hexSize / (PHASER_MAP_ART.frame.height / 2);
    this.tileById = new Map(
      [...params.chunk.tiles, ...params.chunk.visualHalo].map((tile) => [tile.id, tile] as const),
    );

    const staggerIndex = Math.abs(params.chunk.bounds.minR) % 2 === 0 ? "odd" : "even";
    const mapConfig: HexMapDataConfig = {
      name: params.chunk.id,
      width: this.localWidth,
      height: this.localHeight,
      tileWidth: PHASER_MAP_ART.frame.width,
      tileHeight: PHASER_MAP_ART.frame.height,
      orientation: Phaser.Tilemaps.Orientation.HEXAGONAL,
      hexSideLength: PHASER_MAP_ART.frame.height / 2,
      staggerAxis: "y",
      staggerIndex,
    };
    const mapData = new Phaser.Tilemaps.MapData(mapConfig);
    this.tilemap = new Phaser.Tilemaps.Tilemap(params.scene, mapData);

    const terrainTileset = requireTileset(this.tilemap.addTilesetImage(
      "terrain",
      PHASER_MAP_ART.terrain.key,
      PHASER_MAP_ART.frame.width,
      PHASER_MAP_ART.frame.height,
      PHASER_MAP_ART.frame.margin,
      PHASER_MAP_ART.frame.spacing,
    ), "terrain");
    const fillTileset = requireTileset(this.tilemap.addTilesetImage(
      "fill",
      PHASER_MAP_ART.fill.key,
      PHASER_MAP_ART.frame.width,
      PHASER_MAP_ART.frame.height,
    ), "fill");
    const riverTileset = requireTileset(this.tilemap.addTilesetImage(
      "rivers",
      PHASER_MAP_ART.rivers.key,
      PHASER_MAP_ART.frame.width,
      PHASER_MAP_ART.frame.height,
      PHASER_MAP_ART.frame.margin,
      PHASER_MAP_ART.frame.spacing,
    ), "rivers");
    const borderTileset = requireTileset(this.tilemap.addTilesetImage(
      "borders",
      PHASER_MAP_ART.borders.key,
      PHASER_MAP_ART.frame.width,
      PHASER_MAP_ART.frame.height,
      PHASER_MAP_ART.frame.margin,
      PHASER_MAP_ART.frame.spacing,
    ), "borders");

    this.layers = {
      terrain: requireLayer(this.tilemap.createBlankLayer("terrain", terrainTileset), "terrain"),
      fill: requireLayer(this.tilemap.createBlankLayer("fill", fillTileset), "fill"),
      rivers: requireLayer(this.tilemap.createBlankLayer("rivers", riverTileset), "rivers"),
      regionBorders: requireLayer(this.tilemap.createBlankLayer("region-borders", borderTileset), "region-borders"),
      countryBorders: requireLayer(this.tilemap.createBlankLayer("country-borders", borderTileset), "country-borders"),
      controllerBorders: requireLayer(this.tilemap.createBlankLayer("controller-borders", borderTileset), "controller-borders"),
      selection: requireLayer(this.tilemap.createBlankLayer("selection", borderTileset), "selection"),
    };

    this.configureLayers(params.settings, staggerIndex);
    this.populateStaticLayers(params.settings);
    this.updatePolitics(params.settings);
    this.createObjectImages(params.scene, params.settings);
  }

  private readonly naturalFeatureVisualCatalog: NaturalFeatureVisualCatalog;

  containsRegion(regionIds: ReadonlySet<string>): boolean {
    return this.chunk.tiles.some((tile) => regionIds.has(tile.regionId)) || this.chunk.visualHalo.some((tile) => regionIds.has(tile.regionId));
  }

  updatePolitics(
    settings: HexMapSettings,
    politicalState: PhaserMapPoliticalState = this.politicalState,
    countryColorById: Readonly<Record<string, string>> = this.countryColorById,
    changedRegionIds?: ReadonlySet<string>,
  ): void {
    this.politicalState = politicalState;
    this.countryColorById = countryColorById;
    for (const tile of this.chunk.tiles) {
      if (changedRegionIds && !this.tileOrNeighborTouchesRegion(tile, settings, changedRegionIds)) continue;
      const local = this.toLocal(tile);
      const owner = resolveMapDisplayOwner(tile, politicalState);
      const fillTile = owner
        ? this.tilemap.putTileAt(0, local.q, local.r, false, this.layers.fill)
        : this.tilemap.removeTileAt(local.q, local.r, false, false, this.layers.fill);
      if (fillTile && owner) {
        fillTile.tint = parseHexColor(countryColorById[owner], this.mapTheme.neutralTint);
        fillTile.alpha = 0.28;
      }

      const countryMask = resolveHexBoundaryMask({
        tile,
        tileById: this.tileById,
        settings,
        resolveGroup: (candidate) => resolveMapDisplayOwner(candidate, politicalState),
      });
      this.setMaskedTile(this.layers.countryBorders, local.q, local.r, PHASER_MAP_ART.borders.styles.country, countryMask);

      const controllerMask = resolveHexBoundaryMask({
        tile,
        tileById: this.tileById,
        settings,
        resolveGroup: (candidate) => resolveController(candidate, politicalState),
      });
      this.setMaskedTile(this.layers.controllerBorders, local.q, local.r, PHASER_MAP_ART.borders.styles.controller, controllerMask);
    }
  }

  setSelectedHex(hexId: HexId | null): void {
    if (this.selectedHexId) {
      const previous = this.chunk.tiles.find((candidate) => candidate.id === this.selectedHexId);
      if (previous) {
        const local = this.toLocal(previous);
        this.tilemap.removeTileAt(local.q, local.r, false, false, this.layers.selection);
      }
    }
    this.selectedHexId = hexId;
    if (!hexId) return;
    const tile = this.chunk.tiles.find((candidate) => candidate.id === hexId);
    if (!tile) return;
    const local = this.toLocal(tile);
    this.tilemap.putTileAt(PHASER_MAP_ART.borders.styles.selection + 63, local.q, local.r, false, this.layers.selection);
  }

  updateTheme(settings: HexMapSettings, mapTheme: PhaserMapTheme): void {
    this.mapTheme = mapTheme;
    this.updatePolitics(settings);
  }

  setLayerVisibility(layer: "fills" | "regionBorders" | "countryBorders" | "controllerBorders" | "objects", visible: boolean): void {
    if (layer === "fills") this.layers.fill.setVisible(visible);
    else if (layer === "regionBorders") this.layers.regionBorders.setVisible(visible);
    else if (layer === "countryBorders") this.layers.countryBorders.setVisible(visible);
    else if (layer === "controllerBorders") this.layers.controllerBorders.setVisible(visible);
    else {
      this.objectsVisible = visible;
      for (const image of this.objectImages) image.setVisible(visible);
      this.refreshNaturalVisibility();
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const layer of Object.values(this.layers)) layer.setVisible(visible);
    for (const image of this.objectImages) image.setVisible(visible);
    if (!visible) {
      this.destroyNaturalTextures();
      return;
    }
    this.ensureNaturalTexture("simplified");
    if (this.naturalLod === "detailed") this.ensureNaturalTexture("detailed");
    this.refreshNaturalVisibility();
  }

  setNaturalLod(lod: NaturalFeatureRenderLod): void {
    this.naturalLod = lod;
    if (!this.visible) return;
    this.ensureNaturalTexture("simplified");
    if (lod === "detailed") this.ensureNaturalTexture("detailed");
    this.refreshNaturalVisibility();
  }

  getNaturalRenderTextureMetrics(): NaturalChunkRenderTextureMetrics {
    return [...this.naturalTextures.entries()].reduce((metrics, [lod, natural]) => ({
      renderTextureCount: metrics.renderTextureCount + 1,
      simplifiedRenderTextureCount: metrics.simplifiedRenderTextureCount + (lod === "simplified" ? 1 : 0),
      detailedRenderTextureCount: metrics.detailedRenderTextureCount + (lod === "detailed" ? 1 : 0),
      gpuBytes: metrics.gpuBytes + natural.gpuBytes,
      logicalObjectCount: metrics.logicalObjectCount + natural.logicalObjectCount,
      buildMs: metrics.buildMs + natural.buildMs,
    }), {
      renderTextureCount: 0,
      simplifiedRenderTextureCount: 0,
      detailedRenderTextureCount: 0,
      gpuBytes: 0,
      logicalObjectCount: 0,
      buildMs: 0,
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.visible = false;
    this.destroyNaturalTextures();
    for (const image of this.objectImages) image.destroy();
    for (const layer of Object.values(this.layers)) layer.destroy();
    this.tilemap.destroy();
  }

  private configureLayers(settings: HexMapSettings, staggerIndex: "odd" | "even"): void {
    const desiredCenter = axialToPixel(
      { q: this.chunk.bounds.minQ, r: this.chunk.bounds.minR },
      settings.hexSize,
    );
    const scaledTileWidth = PHASER_MAP_ART.frame.width * this.scaleX;
    const scaledTileHeight = PHASER_MAP_ART.frame.height * this.scaleY;
    const firstCenterX = staggerIndex === "odd" ? scaledTileWidth / 2 : scaledTileWidth * 1.5;
    const layerX = desiredCenter.x - firstCenterX;
    const layerY = desiredCenter.y - scaledTileHeight / 2;
    const layerDepths: Array<[Phaser.Tilemaps.TilemapLayer, number]> = [
      [this.layers.terrain, DEPTH.terrain],
      [this.layers.fill, DEPTH.fill],
      [this.layers.rivers, DEPTH.rivers],
      [this.layers.regionBorders, DEPTH.regionBorders],
      [this.layers.countryBorders, DEPTH.countryBorders],
      [this.layers.controllerBorders, DEPTH.controllerBorders],
      [this.layers.selection, DEPTH.selection],
    ];
    for (const [layer, depth] of layerDepths) {
      layer.layer.staggerAxis = "y";
      layer.layer.staggerIndex = staggerIndex;
      layer.setPosition(layerX, layerY).setScale(this.scaleX, this.scaleY).setDepth(depth).setCullPadding(2, 2);
    }
    this.layers.terrain.setSkipCull(true);
  }

  private populateStaticLayers(settings: HexMapSettings): void {
    for (const tile of this.chunk.tiles) {
      const local = this.toLocal(tile);
      this.tilemap.putTileAt(resolveTerrainTextureFrame(tile), local.q, local.r, false, this.layers.terrain);
      if (tile.riverMask > 0) this.tilemap.putTileAt(tile.riverMask & 63, local.q, local.r, false, this.layers.rivers);
      const regionMask = resolveHexBoundaryMask({
        tile,
        tileById: this.tileById,
        settings,
        resolveGroup: resolveMapDisplayRegionId,
      });
      this.setMaskedTile(this.layers.regionBorders, local.q, local.r, PHASER_MAP_ART.borders.styles.region, regionMask);
    }
  }

  private createObjectImages(scene: Phaser.Scene, settings: HexMapSettings): void {
    const imageScale = settings.hexSize / 64;
    for (const feature of this.chunk.features) {
      const tile = this.tileById.get(feature.hexId);
      const group = normalizeFeatureVisualGroup(feature.visualId);
      if (!tile || !group) continue;
      const center = axialToPixel(tile, settings.hexSize);
      this.objectImages.push(
        scene.add.image(center.x, center.y, PHASER_MAP_ART.objects.key, resolveObjectTextureFrame(group, feature.id))
          .setScale(imageScale)
          .setDepth(DEPTH.objects + 2),
      );
    }
  }

  private ensureNaturalTexture(lod: NaturalFeatureRenderLod): void {
    if (this.naturalTextures.has(lod) || this.pendingNaturalLods.has(lod)) return;
    const resolution = naturalRenderTextureResolution(lod);
    const estimatedBytes = estimateNaturalRenderTextureBytes(this.chunk, this.settings, resolution);
    if (!this.naturalRenderTextureBudget.tryReserve(estimatedBytes, lod === "detailed")) return;
    this.pendingNaturalLods.add(lod);
    this.enqueueNaturalBuild(() => {
      this.pendingNaturalLods.delete(lod);
      if (this.destroyed || !this.visible || this.naturalTextures.has(lod)) {
        this.naturalRenderTextureBudget.release(estimatedBytes);
        return;
      }
      const built = buildNaturalRenderTexture({
        scene: this.scene,
        chunk: this.chunk,
        settings: this.settings,
        catalog: this.naturalFeatureVisualCatalog,
        lod,
        resolution,
        depth: DEPTH.objects + 1.5,
      });
      if (!built) {
        this.naturalRenderTextureBudget.release(estimatedBytes);
        return;
      }
      const natural = {
        texture: built.texture,
        gpuBytes: built.gpuBytes,
        logicalObjectCount: built.logicalObjectCount,
        buildMs: built.buildMs,
      };
      this.naturalTextures.set(lod, natural);
      this.onNaturalTextureBuilt(built.buildMs);
      if (built.gpuBytes < estimatedBytes) this.naturalRenderTextureBudget.release(estimatedBytes - built.gpuBytes);
      this.refreshNaturalVisibility();
    });
  }

  private refreshNaturalVisibility(): void {
    const detailed = this.naturalTextures.get("detailed")?.texture;
    const simplified = this.naturalTextures.get("simplified")?.texture;
    const canShow = this.visible && this.objectsVisible;
    if (detailed) detailed.setVisible(canShow && this.naturalLod === "detailed");
    if (simplified) simplified.setVisible(canShow && (this.naturalLod === "simplified" || !detailed));
  }

  private destroyNaturalTextures(): void {
    for (const natural of this.naturalTextures.values()) {
      natural.texture.destroy();
      this.naturalRenderTextureBudget.release(natural.gpuBytes);
    }
    this.naturalTextures.clear();
  }

  private tileOrNeighborTouchesRegion(tile: HexTile, settings: HexMapSettings, regionIds: ReadonlySet<string>): boolean {
    if (regionIds.has(tile.regionId)) return true;
    for (let direction = 0; direction < 6; direction += 1) {
      const neighborAxial = getNeighborAxial(tile, direction as 0 | 1 | 2 | 3 | 4 | 5, settings);
      const neighbor = neighborAxial ? this.tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) : null;
      if (neighbor && regionIds.has(neighbor.regionId)) return true;
    }
    return false;
  }

  private setMaskedTile(layer: Phaser.Tilemaps.TilemapLayer, q: number, r: number, baseFrame: number, mask: number): void {
    if (mask === 0) this.tilemap.removeTileAt(q, r, false, false, layer);
    else this.tilemap.putTileAt(baseFrame + mask, q, r, false, layer);
  }

  private toLocal(tile: Pick<HexTile, "q" | "r">): { q: number; r: number } {
    return { q: tile.q - this.chunk.bounds.minQ, r: tile.r - this.chunk.bounds.minR };
  }
}

function naturalRenderTextureResolution(lod: NaturalFeatureRenderLod): number {
  if (lod === "simplified") return 1;
  const mobile = typeof navigator !== "undefined" && (
    /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || navigator.hardwareConcurrency <= 4
  );
  return mobile ? 2 : 4;
}

function resolveController(tile: HexTile, state: PhaserMapPoliticalState): string | null {
  if (!resolveMapDisplayRegionId(tile)) return null;
  return state.regionController[tile.regionId] ?? resolveMapDisplayOwner(tile, state);
}

function parseHexColor(value: string | null | undefined, fallback: number): number {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? Number.parseInt(value.slice(1), 16) : fallback;
}

function requireTileset(tileset: Phaser.Tilemaps.Tileset | null, name: string): Phaser.Tilemaps.Tileset {
  if (!tileset) throw new Error(`PHASER_MAP_TILESET_MISSING:${name}`);
  return tileset;
}

function requireLayer(layer: Phaser.Tilemaps.TilemapLayer | null, name: string): Phaser.Tilemaps.TilemapLayer {
  if (!layer) throw new Error(`PHASER_MAP_LAYER_FAILED:${name}`);
  return layer;
}
