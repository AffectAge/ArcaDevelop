import Phaser from "phaser";
import type { HexChunkId, HexId, HexMapClientChunk, HexMapSettings, NaturalFeatureVisualCatalog, WorldBase } from "@arcanorum/shared";
import { axialToPixel, makeHexId, pixelToAxial, worldPixelWidth } from "../hexGeometry";
import type { HexCamera } from "../hexCamera";
import { collectChangedRecordKeys } from "./hexBorderMasks";
import { PhaserHexChunkLayer, type PhaserMapPoliticalState } from "./PhaserHexChunkLayer";
import { PHASER_MAP_ART } from "./phaserMapArt";
import { resolveObjectTextureFrame } from "./hexTextureFrames";
import { resolveNaturalRenderTextureBudget, type NaturalRenderTextureBudget } from "./naturalRenderTextures";
import type { PhaserMapTheme } from "./phaserMapTheme";

export type PhaserHexMapSceneCallbacks = {
  onReady: () => void;
  onCameraChange: (camera: HexCamera, viewport: { width: number; height: number }) => void;
  onSelectHex: (hexId: HexId | null, screen: { x: number; y: number }) => void;
  onHoverHex?: (hexId: HexId | null, screen: { x: number; y: number }) => void;
};

type PointerDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
};

export class PhaserHexMapScene extends Phaser.Scene {
  private readonly settings: HexMapSettings;
  private readonly scenarioId: string;
  private readonly assetBaseUrl: string;
  private readonly naturalFeatureVisualCatalog: NaturalFeatureVisualCatalog;
  private readonly callbacks: PhaserHexMapSceneCallbacks;
  private readonly chunks = new Map<HexChunkId, PhaserHexChunkLayer>();
  private visibleChunkIds: ReadonlySet<HexChunkId> | null = null;
  private readonly tileById = new Map<HexId, true>();
  private politicalState: PhaserMapPoliticalState;
  private countryColorById: Readonly<Record<string, string>>;
  private selectedHexId: HexId | null = null;
  private drag: PointerDragState | null = null;
  private pinchDistance: number | null = null;
  private lastHoverHexId: HexId | null = null;
  private cameraPublishQueued = false;
  private readonly unitImages = new Map<string, Phaser.GameObjects.Image>();
  private readonly cityImages = new Map<string, Phaser.GameObjects.Image>();
  private readonly buildingImages = new Map<string, Phaser.GameObjects.Image>();
  private readonly pathImages: Phaser.GameObjects.Image[] = [];
  private readonly naturalRenderTextureBudget: NaturalRenderTextureBudget;
  private readonly naturalBuildQueue: Array<() => void> = [];
  private readonly naturalBuildDurationsMs: number[] = [];
  private readonly chunkCreateDurationsMs: number[] = [];
  private readonly chunkDestroyDurationsMs: number[] = [];
  private naturalBuildQueued = false;
  private mapTheme: PhaserMapTheme;

  constructor(params: {
    settings: HexMapSettings;
    scenarioId: string;
    assetBaseUrl: string;
    callbacks: PhaserHexMapSceneCallbacks;
    politicalState: PhaserMapPoliticalState;
    countryColorById: Readonly<Record<string, string>>;
    mapTheme: PhaserMapTheme;
    naturalFeatureVisualCatalog: NaturalFeatureVisualCatalog;
  }) {
    super({ key: "arcanorum-hex-map" });
    this.settings = params.settings;
    this.scenarioId = params.scenarioId;
    this.assetBaseUrl = params.assetBaseUrl.replace(/\/$/, "");
    this.callbacks = params.callbacks;
    this.politicalState = params.politicalState;
    this.countryColorById = params.countryColorById;
    this.mapTheme = params.mapTheme;
    this.naturalFeatureVisualCatalog = params.naturalFeatureVisualCatalog;
    this.naturalRenderTextureBudget = resolveNaturalRenderTextureBudget();
  }

  preload(): void {
    this.load.image(PHASER_MAP_ART.terrain.key, PHASER_MAP_ART.terrain.url);
    this.load.spritesheet(PHASER_MAP_ART.objects.key, PHASER_MAP_ART.objects.url, {
      frameWidth: PHASER_MAP_ART.objects.frameWidth,
      frameHeight: PHASER_MAP_ART.objects.frameHeight,
      margin: PHASER_MAP_ART.objects.margin,
      spacing: PHASER_MAP_ART.objects.spacing,
    });
    this.load.image(PHASER_MAP_ART.borders.key, PHASER_MAP_ART.borders.url);
    this.load.image(PHASER_MAP_ART.rivers.key, PHASER_MAP_ART.rivers.url);
    this.load.image(PHASER_MAP_ART.fill.key, PHASER_MAP_ART.fill.url);
    for (const textureSetId of new Set(this.naturalFeatureVisualCatalog.visuals.map((rule) => rule.textureSetId))) {
      const textureUrl = this.naturalFeatureVisualCatalog.textureUrls[textureSetId] ?? `/game-assets/phaser/natural_features/${textureSetId}_features.webp`;
      this.load.spritesheet(`arc-map-natural-${textureSetId}`, textureUrl, { frameWidth: 128, frameHeight: 128 });
    }
    for (const unitType of ["archer", "colonizer", "galley", "warrior"]) {
      this.load.spritesheet(unitTextureKey(unitType), `${this.assetBaseUrl}/scenario-assets/${encodeURIComponent(this.scenarioId)}/assets/units/${unitType}.png`, {
        frameWidth: 64,
        frameHeight: 64,
      });
    }
  }

  create(): void {
    const camera = this.cameras.main;
    const worldWidth = worldPixelWidth(this.settings);
    const worldHeight = Math.max(this.settings.hexSize * 2, (this.settings.height - 1) * this.settings.hexSize * 1.5 + this.settings.hexSize * 2);
    camera.setBackgroundColor(this.mapTheme.backgroundColor);
    camera.setBounds(-this.settings.hexSize * 2, -this.settings.hexSize * 2, worldWidth + this.settings.hexSize * 4, worldHeight + this.settings.hexSize * 4);
    camera.setZoom(resolveInitialZoom());
    camera.centerOn(worldWidth / 2, worldHeight / 2);
    this.installInput();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.callbacks.onReady();
    this.publishCamera();
  }

  upsertChunk(chunk: HexMapClientChunk): void {
    this.removeChunks([chunk.id]);
    const startedAt = performance.now();
    const layer = new PhaserHexChunkLayer({
      scene: this,
      chunk,
      settings: this.settings,
      politicalState: this.politicalState,
      countryColorById: this.countryColorById,
      mapTheme: this.mapTheme,
      naturalFeatureVisualCatalog: this.naturalFeatureVisualCatalog,
      naturalRenderTextureBudget: this.naturalRenderTextureBudget,
      enqueueNaturalBuild: (task) => this.enqueueNaturalBuild(task),
      onNaturalTextureBuilt: (buildMs) => this.recordDuration(this.naturalBuildDurationsMs, buildMs),
    });
    layer.setSelectedHex(this.selectedHexId);
    layer.setVisible(this.visibleChunkIds == null || this.visibleChunkIds.has(chunk.id));
    layer.setNaturalLod(resolveNaturalLod(this.cameras.main.zoom));
    this.chunks.set(chunk.id, layer);
    for (const tile of chunk.tiles) this.tileById.set(tile.id, true);
    this.recordDuration(this.chunkCreateDurationsMs, performance.now() - startedAt);
  }

  removeChunks(chunkIds: Iterable<HexChunkId>): void {
    for (const chunkId of new Set(chunkIds)) {
      const layer = this.chunks.get(chunkId);
      if (!layer) continue;
      const startedAt = performance.now();
      for (const tile of layer.chunk.tiles) this.tileById.delete(tile.id);
      layer.destroy();
      this.chunks.delete(chunkId);
      this.recordDuration(this.chunkDestroyDurationsMs, performance.now() - startedAt);
    }
  }

  updatePolitics(politicalState: PhaserMapPoliticalState, countryColorById: Readonly<Record<string, string>>): void {
    const countryColorsChanged = this.countryColorById !== countryColorById;
    const changedRegionIds = new Set([
      ...collectChangedRecordKeys(this.politicalState.regionOwner, politicalState.regionOwner),
      ...collectChangedRecordKeys(this.politicalState.regionController, politicalState.regionController),
    ]);
    const hexOwnersChanged = this.politicalState.hexOwner !== politicalState.hexOwner;
    this.politicalState = politicalState;
    this.countryColorById = countryColorById;
    for (const layer of this.chunks.values()) {
      if (!hexOwnersChanged && changedRegionIds.size > 0 && !layer.containsRegion(changedRegionIds)) continue;
      if (!hexOwnersChanged && changedRegionIds.size === 0 && !countryColorsChanged) continue;
      layer.updatePolitics(this.settings, politicalState, countryColorById, hexOwnersChanged ? undefined : changedRegionIds);
    }
  }

  setVisibleChunkIds(chunkIds: readonly HexChunkId[]): void {
    this.visibleChunkIds = new Set(chunkIds);
    for (const [chunkId, layer] of this.chunks) {
      layer.setVisible(this.visibleChunkIds.has(chunkId));
      layer.setNaturalLod(resolveNaturalLod(this.cameras.main.zoom));
    }
  }

  getNaturalRenderTextureMetrics(): {
    renderTextureCount: number;
    simplifiedRenderTextureCount: number;
    detailedRenderTextureCount: number;
    gpuBytes: number;
    visibleLogicalObjectCount: number;
    buildCount: number;
    buildP95Ms: number;
    buildP99Ms: number;
    chunkCreateP95Ms: number;
    chunkDestroyP95Ms: number;
    allocatedBudgetBytes: number;
    deniedDetailedLayers: number;
  } {
    const layerMetrics = [...this.chunks.values()].reduce((metrics, layer) => {
      const natural = layer.getNaturalRenderTextureMetrics();
      return {
        renderTextureCount: metrics.renderTextureCount + natural.renderTextureCount,
        simplifiedRenderTextureCount: metrics.simplifiedRenderTextureCount + natural.simplifiedRenderTextureCount,
        detailedRenderTextureCount: metrics.detailedRenderTextureCount + natural.detailedRenderTextureCount,
        gpuBytes: metrics.gpuBytes + natural.gpuBytes,
        visibleLogicalObjectCount: metrics.visibleLogicalObjectCount + natural.logicalObjectCount,
      };
    }, {
      renderTextureCount: 0,
      simplifiedRenderTextureCount: 0,
      detailedRenderTextureCount: 0,
      gpuBytes: 0,
      visibleLogicalObjectCount: 0,
    });
    const budget = this.naturalRenderTextureBudget.snapshot();
    return {
      ...layerMetrics,
      buildCount: this.naturalBuildDurationsMs.length,
      buildP95Ms: percentile(this.naturalBuildDurationsMs, 0.95),
      buildP99Ms: percentile(this.naturalBuildDurationsMs, 0.99),
      chunkCreateP95Ms: percentile(this.chunkCreateDurationsMs, 0.95),
      chunkDestroyP95Ms: percentile(this.chunkDestroyDurationsMs, 0.95),
      allocatedBudgetBytes: budget.allocatedBytes,
      deniedDetailedLayers: budget.deniedDetailedLayers,
    };
  }

  setSelectedHex(hexId: HexId | null): void {
    this.selectedHexId = hexId;
    for (const layer of this.chunks.values()) layer.setSelectedHex(hexId);
  }

  setPathPreview(hexIds: readonly HexId[]): void {
    for (const image of this.pathImages) image.destroy();
    this.pathImages.length = 0;
    const scale = this.settings.hexSize / (PHASER_MAP_ART.frame.height / 2);
    for (const hexId of hexIds) {
      const point = parseHexPoint(hexId, this.settings.hexSize);
      if (!point) continue;
      this.pathImages.push(
        this.add.image(point.x, point.y, PHASER_MAP_ART.borders.key, PHASER_MAP_ART.borders.styles.selection + 63)
          .setScale(scale)
          .setAlpha(0.58)
          .setDepth(49),
      );
    }
  }

  updateWorldVisuals(world: PhaserMapWorldVisualState, countryColorById: Readonly<Record<string, string>>): void {
    this.syncUnitImages(world, countryColorById);
    this.syncCityImages(world);
    this.syncBuildingImages(world);
  }

  updateTheme(mapTheme: PhaserMapTheme): void {
    this.mapTheme = mapTheme;
    if (this.sys.isActive()) this.cameras.main.setBackgroundColor(mapTheme.backgroundColor);
    for (const layer of this.chunks.values()) layer.updateTheme(this.settings, mapTheme);
  }

  focusHex(hexId: HexId): void {
    const match = /^hex:(-?\d+):(-?\d+)$/.exec(hexId);
    if (!match) return;
    const point = axialToPixel({ q: Number(match[1]), r: Number(match[2]) }, this.settings.hexSize);
    this.cameras.main.centerOn(point.x, point.y);
    this.publishCamera();
  }

  zoomBy(factor: number): void {
    const camera = this.cameras.main;
    this.zoomAround(this.scale.width / 2, this.scale.height / 2, camera.zoom * factor);
  }

  resetView(): void {
    const worldWidth = worldPixelWidth(this.settings);
    const worldHeight = Math.max(
      this.settings.hexSize * 2,
      (this.settings.height - 1) * this.settings.hexSize * 1.5 + this.settings.hexSize * 2,
    );
    const camera = this.cameras.main;
    camera.setZoom(resolveInitialZoom());
    camera.centerOn(worldWidth / 2, worldHeight / 2);
    this.publishCamera();
  }

  getCameraState(): HexCamera {
    const camera = this.cameras.main;
    return { x: camera.midPoint.x, y: camera.midPoint.y, scale: camera.zoom };
  }

  getViewport(): { width: number; height: number } {
    return { width: this.scale.width, height: this.scale.height };
  }

  private installInput(): void {
    this.input.addPointer(2);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const downPointers = this.getDownPointers();
      if (downPointers.length >= 2) {
        this.pinchDistance = pointerDistance(downPointers[0], downPointers[1]);
        this.drag = null;
        return;
      }
      this.drag = {
        pointerId: pointer.id,
        startX: pointer.x,
        startY: pointer.y,
        lastX: pointer.x,
        lastY: pointer.y,
        moved: false,
      };
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer));
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer));
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (pointer: Phaser.Input.Pointer, _objects: unknown[], _deltaX: number, deltaY: number) => {
      const factor = deltaY > 0 ? 0.88 : 1.14;
      this.zoomAround(pointer.x, pointer.y, this.cameras.main.zoom * factor);
    });
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const downPointers = this.getDownPointers();
    if (downPointers.length >= 2) {
      const distance = pointerDistance(downPointers[0], downPointers[1]);
      const midpoint = { x: (downPointers[0].x + downPointers[1].x) / 2, y: (downPointers[0].y + downPointers[1].y) / 2 };
      if (this.pinchDistance && this.pinchDistance > 0) {
        this.zoomAround(midpoint.x, midpoint.y, this.cameras.main.zoom * (distance / this.pinchDistance));
      }
      this.pinchDistance = distance;
      this.drag = null;
      return;
    }
    this.pinchDistance = null;
    if (this.drag && this.drag.pointerId === pointer.id && pointer.isDown) {
      const deltaX = pointer.x - this.drag.lastX;
      const deltaY = pointer.y - this.drag.lastY;
      if (Math.hypot(pointer.x - this.drag.startX, pointer.y - this.drag.startY) > 7) this.drag.moved = true;
      if (this.drag.moved) {
        const camera = this.cameras.main;
        camera.scrollX -= deltaX / camera.zoom;
        camera.scrollY -= deltaY / camera.zoom;
        this.publishCamera();
      }
      this.drag.lastX = pointer.x;
      this.drag.lastY = pointer.y;
      return;
    }
    const hexId = this.pickHex(pointer.x, pointer.y);
    if (hexId === this.lastHoverHexId) return;
    this.lastHoverHexId = hexId;
    this.callbacks.onHoverHex?.(hexId, { x: pointer.x, y: pointer.y });
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.getDownPointers().length < 2) this.pinchDistance = null;
    if (!this.drag || this.drag.pointerId !== pointer.id) return;
    const shouldSelect = !this.drag.moved;
    this.drag = null;
    if (!shouldSelect) return;
    const hexId = this.pickHex(pointer.x, pointer.y);
    this.setSelectedHex(hexId);
    this.callbacks.onSelectHex(hexId, { x: pointer.x, y: pointer.y });
  }

  private pickHex(screenX: number, screenY: number): HexId | null {
    const world = this.cameras.main.getWorldPoint(screenX, screenY);
    const axial = pixelToAxial(world.x, world.y, this.settings.hexSize, this.settings);
    if (!axial) return null;
    const hexId = makeHexId(axial.q, axial.r);
    return this.tileById.has(hexId) ? hexId : null;
  }

  private zoomAround(screenX: number, screenY: number, requestedZoom: number): void {
    const camera = this.cameras.main;
    const before = camera.getWorldPoint(screenX, screenY);
    camera.setZoom(Phaser.Math.Clamp(requestedZoom, 0.5, 5));
    const after = camera.getWorldPoint(screenX, screenY);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
    this.syncNaturalLod();
    this.publishCamera();
  }

  private syncNaturalLod(): void {
    const lod = resolveNaturalLod(this.cameras.main.zoom);
    for (const layer of this.chunks.values()) layer.setNaturalLod(lod);
  }

  private enqueueNaturalBuild(task: () => void): void {
    this.naturalBuildQueue.push(task);
    if (this.naturalBuildQueued) return;
    this.naturalBuildQueued = true;
    this.time.delayedCall(0, () => this.runNextNaturalBuild());
  }

  private runNextNaturalBuild(): void {
    this.naturalBuildQueued = false;
    this.naturalBuildQueue.shift()?.();
    if (this.naturalBuildQueue.length > 0) {
      this.naturalBuildQueued = true;
      this.time.delayedCall(0, () => this.runNextNaturalBuild());
    }
  }

  private recordDuration(samples: number[], durationMs: number): void {
    samples.push(durationMs);
    if (samples.length > 200) samples.shift();
  }

  private getDownPointers(): Phaser.Input.Pointer[] {
    return this.input.manager.pointers.filter((pointer) => pointer.isDown);
  }

  private publishCamera(): void {
    if (this.cameraPublishQueued) return;
    this.cameraPublishQueued = true;
    this.time.delayedCall(0, () => {
      this.cameraPublishQueued = false;
      this.callbacks.onCameraChange(this.getCameraState(), this.getViewport());
    });
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.main.setSize(gameSize.width, gameSize.height);
    this.publishCamera();
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    for (const layer of this.chunks.values()) layer.destroy();
    this.chunks.clear();
    this.visibleChunkIds = null;
    this.naturalBuildQueue.length = 0;
    this.naturalBuildQueued = false;
    this.tileById.clear();
    for (const image of [...this.unitImages.values(), ...this.cityImages.values(), ...this.buildingImages.values(), ...this.pathImages]) image.destroy();
    this.unitImages.clear();
    this.cityImages.clear();
    this.buildingImages.clear();
    this.pathImages.length = 0;
  }

  private syncUnitImages(world: PhaserMapWorldVisualState, countryColorById: Readonly<Record<string, string>>): void {
    const mapUnits = Object.values(world.unitsById ?? {});
    const civilianUnits = Object.values(world.civilianUnitsById ?? {});
    const activeIds = new Set([
      ...mapUnits.map((unit) => unit.id),
      ...civilianUnits.map((unit) => unit.id),
    ]);
    destroyMissingImages(this.unitImages, activeIds);
    for (const unit of [
      ...mapUnits,
      ...civilianUnits.map((unit) => ({
        ...unit,
        unitTypeId: `unit:${unit.type}`,
        hp: 100,
      })),
    ]) {
      const point = parseHexPoint(unit.hexId, this.settings.hexSize);
      if (!point) continue;
      const unitType = sanitizeAssetSegment(unit.unitTypeId.replace(/^unit:/, ""));
      const textureKey = unitTextureKey(unitType);
      const hasTexture = this.textures.exists(textureKey);
      const image = this.unitImages.get(unit.id) ?? this.add.image(
        point.x,
        point.y,
        hasTexture ? textureKey : PHASER_MAP_ART.fill.key,
        hasTexture ? resolveUnitFrame(unit.status, unit.hp) : undefined,
      ).setDepth(70);
      if (!this.unitImages.has(unit.id)) this.unitImages.set(unit.id, image);
      image.setPosition(point.x, point.y);
      if (hasTexture) {
        image.setTexture(textureKey, resolveUnitFrame(unit.status, unit.hp));
        image.setScale(this.settings.hexSize / 32);
        image.clearTint();
      } else {
        image.setTexture(PHASER_MAP_ART.fill.key);
        image.setScale(this.settings.hexSize / 64);
        image.setTint(parseColor(countryColorById[unit.countryId], this.mapTheme.neutralTint));
      }
    }
  }

  private syncCityImages(world: PhaserMapWorldVisualState): void {
    const activeIds = new Set(Object.keys(world.cityMarkersById ?? {}));
    destroyMissingImages(this.cityImages, activeIds);
    for (const city of Object.values(world.cityMarkersById ?? {})) {
      const point = parseHexPoint(city.targetHexId, this.settings.hexSize);
      if (!point) continue;
      const frame = resolveObjectTextureFrame("marker:city", city.id);
      const image = this.cityImages.get(city.id) ?? this.add.image(point.x, point.y, PHASER_MAP_ART.objects.key, frame).setDepth(65);
      if (!this.cityImages.has(city.id)) this.cityImages.set(city.id, image);
      image.setPosition(point.x, point.y).setFrame(frame).setScale(this.settings.hexSize / 56);
    }
  }

  private syncBuildingImages(world: PhaserMapWorldVisualState): void {
    const buildings = Object.values(world.regionBuildingsByRegion ?? {}).flat();
    const activeIds = new Set(buildings.map((building) => building.instanceId));
    destroyMissingImages(this.buildingImages, activeIds);
    for (const building of buildings) {
      if (!/^hex:-?\d+:-?\d+$/.test(building.targetHexId)) continue;
      const point = parseHexPoint(building.targetHexId as HexId, this.settings.hexSize);
      if (!point) continue;
      const group = /mine|quarry|extract/i.test(building.buildingId) ? "building:mine" : "building:farm";
      const frame = resolveObjectTextureFrame(group, building.instanceId);
      const image = this.buildingImages.get(building.instanceId) ?? this.add.image(point.x, point.y, PHASER_MAP_ART.objects.key, frame).setDepth(60);
      if (!this.buildingImages.has(building.instanceId)) this.buildingImages.set(building.instanceId, image);
      image.setPosition(point.x, point.y).setFrame(frame).setScale(this.settings.hexSize / 68);
    }
  }
}

function pointerDistance(left: Phaser.Input.Pointer, right: Phaser.Input.Pointer): number {
  return Phaser.Math.Distance.Between(left.x, left.y, right.x, right.y);
}

function resolveInitialZoom(): number {
  if (typeof window === "undefined") return 1;
  const requested = Number(new URLSearchParams(window.location.search).get("hexScale"));
  return Number.isFinite(requested) && requested > 0 ? Phaser.Math.Clamp(requested, 0.5, 5) : 1;
}

function resolveNaturalLod(zoom: number): "simplified" | "detailed" {
  return zoom >= 1.5 ? "detailed" : "simplified";
}

function percentile(samples: readonly number[], quantile: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * quantile))] as number;
}

export type PhaserMapWorldVisualState = Pick<
  WorldBase,
  "unitsById" | "civilianUnitsById" | "cityMarkersById" | "regionBuildingsByRegion"
>;

function destroyMissingImages(images: Map<string, Phaser.GameObjects.Image>, activeIds: ReadonlySet<string>): void {
  for (const [id, image] of images) {
    if (activeIds.has(id)) continue;
    image.destroy();
    images.delete(id);
  }
}

function parseHexPoint(hexId: HexId, hexSize: number): { x: number; y: number } | null {
  const match = /^hex:(-?\d+):(-?\d+)$/.exec(hexId);
  return match ? axialToPixel({ q: Number(match[1]), r: Number(match[2]) }, hexSize) : null;
}

function sanitizeAssetSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function unitTextureKey(unitType: string): string {
  return `arc-map-unit-${sanitizeAssetSegment(unitType)}`;
}

function resolveUnitFrame(status: string, hp: number): number {
  if (hp < 40) return 3;
  if (status === "fighting") return 2;
  if (status === "moving") return 1;
  return 0;
}

function parseColor(value: string | null | undefined, fallback: number): number {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? Number.parseInt(value.slice(1), 16) : fallback;
}
