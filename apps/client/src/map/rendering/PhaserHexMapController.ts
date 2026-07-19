import Phaser from "phaser";
import type { HexChunkId, HexId, HexMapClientChunk, HexMapSettings, NaturalFeatureVisualCatalog } from "@arcanorum/shared";
import { PhaserHexMapScene, type PhaserHexMapSceneCallbacks, type PhaserMapWorldVisualState } from "./PhaserHexMapScene";
import type { PhaserMapPoliticalState } from "./PhaserHexChunkLayer";
import { resolvePhaserMapTheme } from "./phaserMapTheme";

export class PhaserHexMapController {
  readonly game: Phaser.Game;
  readonly scene: PhaserHexMapScene;

  private ready = false;
  private readonly pendingChunks = new Map<HexChunkId, HexMapClientChunk>();
  private pendingSelection: HexId | null = null;
  private pendingFocus: HexId | null = null;
  private pendingVisibleChunkIds: HexChunkId[] | null = null;
  private pendingPolitics: {
    state: PhaserMapPoliticalState;
    countryColorById: Readonly<Record<string, string>>;
  } | null = null;
  private pendingWorld: {
    state: PhaserMapWorldVisualState;
    countryColorById: Readonly<Record<string, string>>;
  } | null = null;
  private readonly parent: HTMLElement;
  private readonly handleThemeRevision = (): void => {
    this.scene.updateTheme(resolvePhaserMapTheme(this.parent));
  };

  constructor(params: {
    parent: HTMLElement;
    settings: HexMapSettings;
    scenarioId: string;
    assetBaseUrl: string;
    callbacks: PhaserHexMapSceneCallbacks;
    politicalState: PhaserMapPoliticalState;
    countryColorById: Readonly<Record<string, string>>;
    naturalFeatureVisualCatalog: NaturalFeatureVisualCatalog;
  }) {
    this.parent = params.parent;
    const mapTheme = resolvePhaserMapTheme(params.parent);
    const callbacks: PhaserHexMapSceneCallbacks = {
      ...params.callbacks,
      onReady: () => {
        this.ready = true;
        for (const chunk of this.pendingChunks.values()) this.scene.upsertChunk(chunk);
        this.pendingChunks.clear();
        this.scene.setSelectedHex(this.pendingSelection);
        if (this.pendingFocus) this.scene.focusHex(this.pendingFocus);
        if (this.pendingVisibleChunkIds) {
          this.scene.setVisibleChunkIds(this.pendingVisibleChunkIds);
        }
        if (this.pendingPolitics) {
          this.scene.updatePolitics(
            this.pendingPolitics.state,
            this.pendingPolitics.countryColorById,
          );
          this.pendingPolitics = null;
        }
        if (this.pendingWorld) {
          this.scene.updateWorldVisuals(
            this.pendingWorld.state,
            this.pendingWorld.countryColorById,
          );
          this.pendingWorld = null;
        }
        params.callbacks.onReady();
      },
    };
    this.scene = new PhaserHexMapScene({
      settings: params.settings,
      scenarioId: params.scenarioId,
      assetBaseUrl: params.assetBaseUrl,
      callbacks,
      politicalState: params.politicalState,
      countryColorById: params.countryColorById,
      mapTheme,
      naturalFeatureVisualCatalog: params.naturalFeatureVisualCatalog,
    });
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: params.parent,
      width: Math.max(1, params.parent.clientWidth),
      height: Math.max(1, params.parent.clientHeight),
      backgroundColor: mapTheme.backgroundColor,
      transparent: false,
      antialias: true,
      pixelArt: false,
      roundPixels: false,
      scene: [this.scene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: "100%",
        height: "100%",
      },
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false,
        powerPreference: "high-performance",
      },
      banner: false,
    });
    document.addEventListener("arc:map-theme-revision", this.handleThemeRevision);
  }

  upsertChunk(chunk: HexMapClientChunk): void {
    if (this.ready) this.scene.upsertChunk(chunk);
    else this.pendingChunks.set(chunk.id, chunk);
  }

  removeChunks(chunkIds: Iterable<HexChunkId>): void {
    for (const chunkId of chunkIds) this.pendingChunks.delete(chunkId);
    if (this.ready) this.scene.removeChunks(chunkIds);
  }

  updatePolitics(politicalState: PhaserMapPoliticalState, countryColorById: Readonly<Record<string, string>>): void {
    if (this.ready) this.scene.updatePolitics(politicalState, countryColorById);
    else this.pendingPolitics = { state: politicalState, countryColorById };
  }

  setVisibleChunkIds(chunkIds: readonly HexChunkId[]): void {
    this.pendingVisibleChunkIds = [...chunkIds];
    if (this.ready) this.scene.setVisibleChunkIds(chunkIds);
  }

  setSelectedHex(hexId: HexId | null): void {
    this.pendingSelection = hexId;
    if (this.ready) this.scene.setSelectedHex(hexId);
  }

  setPathPreview(hexIds: readonly HexId[]): void {
    if (this.ready) this.scene.setPathPreview(hexIds);
  }

  updateWorldVisuals(world: PhaserMapWorldVisualState, countryColorById: Readonly<Record<string, string>>): void {
    if (this.ready) this.scene.updateWorldVisuals(world, countryColorById);
    else this.pendingWorld = { state: world, countryColorById };
  }

  focusHex(hexId: HexId): void {
    this.pendingFocus = hexId;
    if (this.ready) this.scene.focusHex(hexId);
  }

  zoomBy(factor: number): void {
    if (this.ready) this.scene.zoomBy(factor);
  }

  resetView(): void {
    if (this.ready) this.scene.resetView();
  }

  getNaturalRenderTextureMetrics() {
    return this.scene.getNaturalRenderTextureMetrics();
  }

  destroy(): void {
    document.removeEventListener("arc:map-theme-revision", this.handleThemeRevision);
    this.pendingChunks.clear();
    this.pendingPolitics = null;
    this.pendingWorld = null;
    this.pendingVisibleChunkIds = null;
    this.game.destroy(true);
  }
}
