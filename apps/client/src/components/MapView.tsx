import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Application, Container, Graphics, Sprite } from "pixi.js";
import Flatbush from "flatbush";
import { Building2, Flag, Gem, Grid3X3, HandCoins, Landmark, Layers, Leaf, Mountain, Shield, Tags, Users, Waves } from "lucide-react";
import { toast } from "sonner";
import {
  buildCityHexIdSet,
  evaluateBuildingPlacement,
  resolveEffectiveHexTile,
  type ActiveModifierRow,
  type Country,
  type BuildingPlacementContent,
  type HexId,
  type Order,
  type HexMapArtifact,
  type HexMapSettings,
  type HexTile,
  type MapFeatureInstance,
  type MapFeatureVisualId,
  type MapFeatureVisualRuleDefinition,
  type RegionResourceDeposit,
  type UnitTypeDefinition,
  type WorldBase,
} from "@arcanorum/shared";
import {
  demolishCountryBuild,
  fetchContentEntries,
  fetchCountryModifiers,
  setCountryBuildAutoUpgradeState,
  setCountryBuildCustomName,
  setCountryBuildManualWorkState,
  setCountryBuildSubsidyState,
  upgradeCountryBuildState,
  type ContentEntry,
  type MarketTransportCorridor,
  type TransportMode,
} from "../lib/api";
import { useGameStore } from "../store/gameStore";
import {
  buildHexCameraBounds,
  calculateEdgeScrollVelocity,
  centerCameraOnWorldPoint,
  clampScale,
  HEX_CAMERA_MAX_SCALE,
  HEX_CAMERA_MIN_SCALE,
  normalizeHexCamera,
  screenToWorld,
  smoothCameraToward,
  zoomCameraToScreenPoint,
  type HexCamera,
  type ScreenPoint,
} from "../map/hexCamera";
import { DEFAULT_HEX_MAP_SETTINGS } from "../map/hexMapGenerator";
import { axialToPixel, getNeighborAxial, hexCorner, makeHexId, pixelToAxial, worldPixelWidth } from "../map/hexGeometry";
import { findHexPath } from "../map/hexPathfinding";
import { getNeighborTiles, usePathPreviewCache } from "../map/usePathPreviewCache";
import { createHexTerrainMeshRenderer, type HexTerrainMeshRenderer } from "../map/hexTerrainMeshRenderer";
import { createHexMapLensOverlayRenderer, type HexMapLensOverlayRenderer } from "../map/hexMapLensOverlayRenderer";
import type { HexTerrainShaderQuality } from "../map/hexTerrainMaterials";
import {
  MAP_LENS_DESCRIPTORS,
  getMapLensDescriptor,
  selectMapLensCells,
} from "../map/mapLensRegistry";
import { readMapLayerSettings, readMapLensSetting, writeMapLayerSettings, writeMapLensSetting } from "../map/mapLensSettings";
import type { MapInteractionMode, MapLayerToggleId, MapLayerToggles, MapLensId, MapLensRenderCell } from "../map/mapLensTypes";
import { MAP_NAVIGATION_SETTINGS_EVENT, readMapNavigationSettings, writeMapNavigationSettings } from "../map/mapNavigationSettings";
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";
import { Tooltip, type TooltipStructuredContent } from "./Tooltip";
import type { StrategyShellSelectedHexDetails } from "./strategy-shell/StrategyShell";
import { GamePlotTooltipCard, GamePlotTooltipPositioner, type GamePlotTooltipData, type GamePlotTooltipRow } from "./templates";
import {
  BuildingOverviewCard,
  DangerConfirmDialog,
  buildOverviewItems,
  getCancelKey,
  getCancelPayload,
  type BuildingOverviewCancelPayload,
  type BuildingOverviewConfirmState,
  type CategoryEntry,
  type GoodMeta,
  type OverviewItem,
} from "./BuildingOverviewModal";
import { MapControlsHud } from "./map-hud/MapControlsHud";
import { MapLensHud } from "./map-hud/MapLensHud";
import { type BuildingAtlasState } from "../assets/buildingAtlas";
import { getBuildingAtlasTextures } from "../map/buildingAtlasTextureCache";
import { type CityAtlasState } from "../assets/cityAtlas";
import { getCityAtlasTextures } from "../map/cityAtlasTextureCache";
import { NATURAL_FEATURE_VISUAL_IDS, resolveFeatureAtlasFrame } from "../assets/featureAtlas";
import { getFeatureAtlasTextures } from "../map/featureAtlasTextureCache";
import { resolveResourceDepositAtlasFrame } from "../assets/resourceDepositAtlas";
import { getResourceDepositAtlasTextures } from "../map/resourceDepositAtlasTextureCache";
import { CorridorBuildHud } from "./map-hud/CorridorBuildHud";
import { getCorridorAtlasTextures, type CorridorAtlasTextures } from "../map/corridorAtlasTextureCache";
import type { CorridorAtlasStatus } from "../assets/corridorAtlas";
import { getUnitAtlasTextures } from "../map/unitAtlasTextureCache";

export type MapModeId = MapInteractionMode;

export type AuthoredHexColorState = {
  provinceMapColor: string;
  provinceMapBorderColor: string;
  regionMapColor: string;
  regionMapBorderColor: string;
};

export function resolveAuthoredHexColorState(input: { hexColor?: string | null; regionColor?: string | null; regionId?: string | null }): AuthoredHexColorState {
  const provinceMapColor = normalizeHexColor(input.hexColor, "#7f8f55");
  const regionMapColor = normalizeHexColor(input.regionColor ?? input.regionId, "#5f874c");
  return {
    provinceMapColor,
    provinceMapBorderColor: darkenHexColor(provinceMapColor),
    regionMapColor,
    regionMapBorderColor: darkenHexColor(regionMapColor),
  };
}

type Props = {
  apiBase: string;
  scenarioId?: string | null;
  focusHexRequest?: { hexId: HexId; nonce: number } | null;
  unitCommandRequest?: { unitId: string; mode: "move" | "attack" | "foundCity"; nonce: number } | null;
  selectedCommandUnitId?: string | null;
  onSelectedCommandUnitChange?: (unitId: string | null) => void;
  onQueueArmyMoveOrder?: (unitId: string, hexId: string, path?: string[]) => void;
  onQueueUnitAttackOrder?: (unitId: string, targetHexId: HexId, targetUnitId?: string | null) => void;
  onQueueCivilianUnitMoveOrder?: (unitId: string, fromHexId: HexId, targetHexId: HexId, path?: HexId[]) => void;
  onFoundCityOrder?: (civilianUnitId: string, hexId: HexId, regionId: string, cityName: string, cultureId?: string | null) => void;
  onHexSelectionChange?: (details: StrategyShellSelectedHexDetails | null) => void;
  onOpenSelectedHexWorkspace?: (details: StrategyShellSelectedHexDetails) => void;
  colonizerPlacement?: { active: boolean } | null;
  onSelectColonizerPlacementTarget?: (target: { hexId: HexId; regionId: string }) => void;
  onCancelColonizerPlacement?: () => void;
  unitTrainingPlacement?: { unitType: UnitTypeDefinition } | null;
  onSelectUnitTrainingPlacementTarget?: (target: { hexId: HexId; regionId: string }) => void;
  onCancelUnitTrainingPlacement?: () => void;
  onHexRenameCharged?: (chargedDucats: number) => void;
  colonizationIconUrl?: string | null;
  ducatsIconUrl?: string | null;
  maxActiveColonizations?: number;
  hexRenameDucatsCost?: number;
  countryColorById?: Record<string, string>;
  countryNameById?: Record<string, string>;
  suggestedMapMode?: MapInteractionMode;
  suggestedMapLens?: MapLensId;
  showMapControls?: boolean;
  showZoomIndicator?: boolean;
  showAntarctica?: boolean;
  buildingEntries?: Array<BuildingPlacementContent & { name?: string | null; logoUrl?: string | null }>;
  buildingOverviewToken?: string | null;
  buildingOverviewCountryId?: string | null;
  buildingOverviewBuildings?: ContentEntry[];
  buildingOverviewCompanies?: ContentEntry[];
  buildingOverviewCountries?: Country[];
  buildingOverviewIndustries?: CategoryEntry[];
  buildingOverviewSectors?: CategoryEntry[];
  buildingOverviewDemolitionCostConstructionPercent?: number;
  buildingOverviewCancelingConstructionQueueKey?: string | null;
  onCancelConstructionProject?: (item: BuildingOverviewCancelPayload) => void;
  canceledConstructionQueueKeys?: readonly string[];
  hexBuildPlacement?: {
    building: BuildingPlacementContent & { name?: string | null; logoUrl?: string | null };
  } | null;
  onSelectHexBuildPlacementTarget?: (target: { hexId: HexId; regionId: string }) => void;
  onCancelHexBuildPlacement?: () => void;
  transportCorridors?: MarketTransportCorridor[];
  corridorPlacement?: {
    transportMode: TransportMode;
    points: Array<{ hexId: HexId; lng: number; lat: number }>;
    previewHexIds: HexId[];
    costConstruction?: number | null;
    connectedRegionIds?: string[];
    blockingReason?: string | null;
    pending: boolean;
  } | null;
  onSelectCorridorPlacementPoint?: (point: { hexId: HexId; regionId: string; lng: number; lat: number }) => void;
  onUndoCorridorPlacementPoint?: () => void;
  onCancelCorridorPlacement?: () => void;
  onConfirmCorridorPlacement?: () => void;
  onMapReadyChange?: (ready: boolean) => void;
};

type HoverState = {
  tile: HexTile;
  x: number;
  y: number;
};

function isHexId(value: string | null | undefined): value is HexId {
  return Boolean(value && /^hex:-?\d+:-?\d+$/.test(value));
}

type ActivePointer = {
  x: number;
  y: number;
};

type HexBuildingTooltipInfo = {
  name: string;
  statusKey: UiTextKey;
  tone: "default" | "good" | "warn" | "bad";
};

type FoundCityConfirmTarget = {
  civilianUnitId: string;
  hexId: HexId;
  regionId: string;
  countryId: string;
  ownerName: string;
  ownerFlagUrl: string | null;
  costColonization: number | null;
};

type SelectedMapUnit =
  | { kind: "map"; unitId: string; fromHexId: HexId }
  | { kind: "civilian"; unitId: string; fromHexId: HexId };

type PointerGesture = {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  longPressTimer: number | null;
  pinchDistance: number | null;
  pinchMidpoint: ScreenPoint | null;
};

type MapZoomBucket = "far" | "mid" | "near";

type ViewportCullingState = {
  key: string;
  visibleTileIds: ReadonlySet<HexId>;
};

type ViewportCullingBounds = {
  key: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type MapTileSpatialIndex = {
  index: Flatbush | null;
  tileIdsByIndex: readonly HexId[];
};


const DEFAULT_CAMERA: HexCamera = {
  x: axialToPixel({ q: DEFAULT_HEX_MAP_SETTINGS.width / 2, r: DEFAULT_HEX_MAP_SETTINGS.height / 2 }, DEFAULT_HEX_MAP_SETTINGS.hexSize).x,
  y: axialToPixel({ q: DEFAULT_HEX_MAP_SETTINGS.width / 2, r: DEFAULT_HEX_MAP_SETTINGS.height / 2 }, DEFAULT_HEX_MAP_SETTINGS.hexSize).y,
  scale: 1,
};

const HEX_GRID_MIN_SCALE = 0.78;
const MAP_VIEWPORT_PADDING_HEXES = 4;
const FIXED_MAP_TEXTURE_QUALITY: HexTerrainShaderQuality = "high";
const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

const MAP_LAYER_DESCRIPTORS: Array<{ id: MapLayerToggleId; labelKey: UiTextKey; tooltipKey: UiTextKey; icon: typeof Grid3X3 }> = [
  { id: "hexGrid", labelKey: "map.layer.hexGrid", tooltipKey: "map.layer.hexGridTooltip", icon: Grid3X3 },
  { id: "countryFill", labelKey: "map.layer.countryFill", tooltipKey: "map.layer.countryFillTooltip", icon: Flag },
  { id: "countryBorders", labelKey: "map.layer.countryBorders", tooltipKey: "map.layer.countryBordersTooltip", icon: Shield },
  { id: "regionFill", labelKey: "map.layer.regionFill", tooltipKey: "map.layer.regionFillTooltip", icon: Layers },
  { id: "features", labelKey: "map.layer.features", tooltipKey: "map.layer.featuresTooltip", icon: Leaf },
  { id: "resources", labelKey: "map.layer.resources", tooltipKey: "map.layer.resourcesTooltip", icon: Gem },
  { id: "buildings", labelKey: "map.layer.buildings", tooltipKey: "map.layer.buildingsTooltip", icon: Building2 },
  { id: "armies", labelKey: "map.layer.armies", tooltipKey: "map.layer.armiesTooltip", icon: Landmark },
  { id: "countryLabels", labelKey: "map.layer.countryLabels", tooltipKey: "map.layer.countryLabelsTooltip", icon: Tags },
];
const VISIBLE_MAP_LENS_IDS = new Set<MapLensId>(["terrain"]);

function buildInitialHexCamera(settings: HexMapSettings): HexCamera {
  return {
    x: axialToPixel({ q: settings.width / 2, r: settings.height / 2 }, settings.hexSize).x,
    y: axialToPixel({ q: settings.width / 2, r: settings.height / 2 }, settings.hexSize).y,
    scale: resolveInitialHexScale(),
  };
}

function resolveInitialHexScale(): number {
  if (typeof window === "undefined") return DEFAULT_CAMERA.scale;
  const requested = Number(new URLSearchParams(window.location.search).get("hexScale"));
  return Number.isFinite(requested) ? Math.max(HEX_CAMERA_MIN_SCALE, Math.min(HEX_CAMERA_MAX_SCALE, requested)) : DEFAULT_CAMERA.scale;
}

function shouldShowMapStatsPanel(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("hexPerf") || params.get("mapStats") === "1";
}

const EMPTY_HEX_MAP_ARTIFACT: HexMapArtifact = {
  version: 1,
  settings: DEFAULT_HEX_MAP_SETTINGS,
  tiles: [],
  riverEdges: [],
  coastOverlays: [],
};

type HexMapPerformanceStats = {
  fps: number;
  averageFrameMs: number;
  samples: number;
  visibleSprites: number;
  visibleTerrainMeshes: number;
  visibleOverlayMeshes: number;
  tiles: number;
  quality: HexTerrainShaderQuality;
  shaderActive: boolean;
  viewport: { width: number; height: number };
};

declare global {
  interface Window {
    __arcHexMapStats?: HexMapPerformanceStats;
  }
}

function normalizeHexColor(value: string | null | undefined, fallback: string): string {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value)) {
    return value.toLowerCase();
  }
  const source = value || fallback;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  const color = (hash >>> 0) & 0xffffff;
  return `#${color.toString(16).padStart(6, "0")}`;
}

function darkenHexColor(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor(((value >> 16) & 255) * 0.62));
  const g = Math.max(0, Math.floor(((value >> 8) & 255) * 0.62));
  const b = Math.max(0, Math.floor((value & 255) * 0.62));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function readReducedMotionPreference(): boolean {
  return window.matchMedia?.(REDUCED_MOTION_MEDIA_QUERY).matches ?? false;
}

export function MapView({
  apiBase,
  scenarioId,
  focusHexRequest = null,
  unitCommandRequest = null,
  selectedCommandUnitId = null,
  onSelectedCommandUnitChange,
  onQueueArmyMoveOrder,
  onQueueUnitAttackOrder,
  onQueueCivilianUnitMoveOrder,
  onFoundCityOrder,
  onHexSelectionChange,
  onOpenSelectedHexWorkspace,
  colonizerPlacement = null,
  onSelectColonizerPlacementTarget,
  onCancelColonizerPlacement,
  unitTrainingPlacement = null,
  onSelectUnitTrainingPlacementTarget,
  onCancelUnitTrainingPlacement,
  onHexRenameCharged: _onHexRenameCharged,
  colonizationIconUrl: _colonizationIconUrl,
  ducatsIconUrl: _ducatsIconUrl,
  maxActiveColonizations: _maxActiveColonizations,
  hexRenameDucatsCost: _hexRenameDucatsCost,
  countryColorById,
  countryNameById,
  suggestedMapMode: _suggestedMapMode,
  suggestedMapLens,
  showMapControls = false,
  showZoomIndicator = true,
  showAntarctica: _showAntarctica = false,
  buildingEntries = [],
  buildingOverviewToken = null,
  buildingOverviewCountryId = null,
  buildingOverviewBuildings,
  buildingOverviewCompanies = [],
  buildingOverviewCountries = [],
  buildingOverviewIndustries: _buildingOverviewIndustries = [],
  buildingOverviewSectors: _buildingOverviewSectors = [],
  buildingOverviewDemolitionCostConstructionPercent = 0,
  buildingOverviewCancelingConstructionQueueKey = null,
  onCancelConstructionProject,
  canceledConstructionQueueKeys = [],
  hexBuildPlacement = null,
  onSelectHexBuildPlacementTarget,
  onCancelHexBuildPlacement,
  transportCorridors = [],
  corridorPlacement = null,
  onSelectCorridorPlacementPoint,
  onUndoCorridorPlacementPoint,
  onCancelCorridorPlacement,
  onConfirmCorridorPlacement,
  onMapReadyChange,
}: Props) {
  const { locale, t } = useUiText();
  const authCountryId = useGameStore((state) => state.auth?.countryId ?? null);
  const turnId = useGameStore((state) => state.turnId);
  const worldBase = useGameStore((state) => state.worldBase);
  const ordersByTurn = useGameStore((state) => state.ordersByTurn);
  const setSelectedHex = useGameStore((state) => state.setSelectedHex);
  const [serverMapArtifact, setServerMapArtifact] = useState<HexMapArtifact | null>(null);
  const [mapLoadError, setMapLoadError] = useState(false);
  const [mapFeatures, setMapFeatures] = useState<MapFeatureInstance[]>([]);
  const [mapFeatureVisuals, setMapFeatureVisuals] = useState<MapFeatureVisualRuleDefinition[]>([]);
  const mapArtifact = serverMapArtifact ?? EMPTY_HEX_MAP_ARTIFACT;
  const initialCamera = useMemo(() => buildInitialHexCamera(mapArtifact.settings), [mapArtifact.settings]);
  const showStatsPanel = useMemo(() => shouldShowMapStatsPanel(), []);
  const tileById = useMemo(() => new Map(mapArtifact.tiles.map((tile) => [tile.id, tile])), [mapArtifact]);
  const tileSpatialIndex = useMemo(() => buildTileSpatialIndex(mapArtifact), [mapArtifact]);
  const tilesByRegionId = useMemo(() => {
    const byRegion = new Map<string, HexTile[]>();
    for (const tile of mapArtifact.tiles) {
      const tiles = byRegion.get(tile.regionId) ?? [];
      tiles.push(tile);
      byRegion.set(tile.regionId, tiles);
    }
    return byRegion;
  }, [mapArtifact.tiles]);
  const wrapWidth = useMemo(() => worldPixelWidth(mapArtifact.settings), [mapArtifact]);
  const cameraBounds = useMemo(() => buildHexCameraBounds(mapArtifact.settings, wrapWidth), [mapArtifact.settings, wrapWidth]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldContainerRef = useRef<Container | null>(null);
  const terrainMeshRendererRef = useRef<HexTerrainMeshRenderer | null>(null);
  const lensOverlayRendererRef = useRef<HexMapLensOverlayRenderer | null>(null);
  const naturalFeatureLayerRef = useRef<Container | null>(null);
  const siteFeatureLayerRef = useRef<Container | null>(null);
  const resourceDepositLayerRef = useRef<Container | null>(null);
  const naturalFeatureSpritePoolRef = useRef<Map<string, Sprite>>(new Map());
  const siteFeatureSpritePoolRef = useRef<Map<string, Sprite>>(new Map());
  const resourceDepositSpritePoolRef = useRef<Map<string, Sprite>>(new Map());
  const mapLayerOutlineLayerRef = useRef<Graphics | null>(null);
  const overlayLayerRef = useRef<Graphics | null>(null);
  const corridorPersistentLayerRef = useRef<Container | null>(null);
  const corridorPreviewLayerRef = useRef<Container | null>(null);
  const buildingLayerRef = useRef<Container | null>(null);
  const unitLayerRef = useRef<Container | null>(null);
  const buildingSpritePoolRef = useRef<Map<string, Sprite>>(new Map());
  const buildingGraphicsPoolRef = useRef<Map<string, Graphics>>(new Map());
  const unitSpritePoolRef = useRef<Map<string, Sprite>>(new Map());
  const unitGraphicsPoolRef = useRef<Map<string, Graphics>>(new Map());
  const cameraRef = useRef<HexCamera>(initialCamera);
  const cameraTargetRef = useRef<HexCamera>(initialCamera);
  const performanceStatsRef = useRef<HexMapPerformanceStats>({
    fps: 0,
    averageFrameMs: 0,
    samples: 0,
    visibleSprites: 0,
    visibleTerrainMeshes: 0,
    visibleOverlayMeshes: 0,
    tiles: mapArtifact.tiles.length,
    quality: "high",
    shaderActive: false,
    viewport: { width: 0, height: 0 },
  });
  const pointerRef = useRef<{ x: number; y: number; blocked: boolean } | null>(null);
  const activePointersRef = useRef<Map<number, ActivePointer>>(new Map());
  const pointerGestureRef = useRef<PointerGesture | null>(null);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const lastTapRef = useRef<{ tileId: HexId; time: number } | null>(null);
  const edgeScrollEnabledRef = useRef(true);
  const reducedMotionRef = useRef(readReducedMotionPreference());
  const selectedTileIdRef = useRef<HexId | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<HoverState | null>(null);
  const viewportCullingRef = useRef<ViewportCullingState>({ key: "all:0", visibleTileIds: new Set<HexId>() });
  const [camera, setCamera] = useState<HexCamera>(initialCamera);
  const [viewportCulling, setViewportCulling] = useState<ViewportCullingState>(() => viewportCullingRef.current);
  const [interactionLocked, setInteractionLocked] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<HexId | null>(null);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [pixiReady, setPixiReady] = useState(false);
  const [mapRenderError, setMapRenderError] = useState(false);
  const [buildingTextureVersion, setBuildingTextureVersion] = useState(0);
  const [featureTextureVersion, setFeatureTextureVersion] = useState(0);
  const [resourceDepositTextureVersion, setResourceDepositTextureVersion] = useState(0);
  const [corridorTextureVersion, setCorridorTextureVersion] = useState(0);
  const [unitTextureVersion, setUnitTextureVersion] = useState(0);
  const [edgeScrollEnabled, setEdgeScrollEnabled] = useState(() => readMapNavigationSettings(useGameStore.getState().auth?.countryId).edgeScrollEnabled);
  const [reducedMotion, setReducedMotion] = useState(() => reducedMotionRef.current);
  const [activeLens, setActiveLens] = useState<MapLensId>(() => readMapLensSetting(useGameStore.getState().auth?.countryId, suggestedMapLens ?? "terrain"));
  const [mapLayers, setMapLayers] = useState<MapLayerToggles>(() => readMapLayerSettings(useGameStore.getState().auth?.countryId));
  const [mapActionNotice, setMapActionNotice] = useState<string | null>(null);
  const [selectedBuildingPopoverHexId, setSelectedBuildingPopoverHexId] = useState<HexId | null>(null);
  const [selectedMapUnit, setSelectedMapUnit] = useState<SelectedMapUnit | null>(null);
  const [expandedMapBuildingId, setExpandedMapBuildingId] = useState<string | null>(null);
  const [civilianMoveSelection, setCivilianMoveSelection] = useState<{ unitId: string; fromHexId: HexId } | null>(null);
  const [divisionMoveSelection, setDivisionMoveSelection] = useState<{ unitId: string; fromHexId: HexId } | null>(null);
  const [divisionAttackSelection, setDivisionAttackSelection] = useState<{ unitId: string; fromHexId: HexId } | null>(null);
  const [foundCityConfirmTarget, setFoundCityConfirmTarget] = useState<FoundCityConfirmTarget | null>(null);
  const [foundCityNameDraft, setFoundCityNameDraft] = useState("");
  const [mapBuildingBusyAction, setMapBuildingBusyAction] = useState<string | null>(null);
  const [mapBuildingConfirm, setMapBuildingConfirm] = useState<BuildingOverviewConfirmState | null>(null);
  const [mapBuildingEditingNameId, setMapBuildingEditingNameId] = useState<string | null>(null);
  const [mapBuildingRenameDraftById, setMapBuildingRenameDraftById] = useState<Record<string, string>>({});
  const [goods, setGoods] = useState<GoodMeta[]>([]);
  const [activeCountryModifiers, setActiveCountryModifiers] = useState<ActiveModifierRow[]>([]);
  const getCachedPreviewPath = usePathPreviewCache(mapArtifact, tileById);

  useEffect(() => {
    onMapReadyChange?.(pixiReady && !mapRenderError && !mapLoadError && Boolean(serverMapArtifact));
    return () => onMapReadyChange?.(false);
  }, [mapLoadError, mapRenderError, onMapReadyChange, pixiReady, serverMapArtifact]);

  useEffect(() => {
    const controller = new AbortController();
    setMapLoadError(false);
    fetch(`${apiBase}/hex-map/artifact`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HEX_MAP_ARTIFACT_REQUEST_FAILED:${response.status}`);
        return response.json() as Promise<HexMapArtifact>;
      })
      .then((artifact) => {
        if (!controller.signal.aborted) {
          setServerMapArtifact(artifact);
        }
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === "AbortError") return;
        setMapLoadError(true);
      });
    return () => controller.abort();
  }, [apiBase]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/hex-map/features`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HEX_MAP_FEATURES_REQUEST_FAILED:${response.status}`);
        return response.json() as Promise<{ features?: MapFeatureInstance[] }>;
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setMapFeatures(Array.isArray(payload.features) ? payload.features : []);
        }
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === "AbortError") return;
        setMapFeatures([]);
      });
    return () => controller.abort();
  }, [apiBase]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/hex-map/feature-visuals`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HEX_MAP_FEATURE_VISUALS_REQUEST_FAILED:${response.status}`);
        return response.json() as Promise<{ visuals?: MapFeatureVisualRuleDefinition[] }>;
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setMapFeatureVisuals(Array.isArray(payload.visuals) ? payload.visuals : []);
        }
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === "AbortError") return;
        setMapFeatureVisuals([]);
      });
    return () => controller.abort();
  }, [apiBase]);

  useEffect(() => {
    let cancelled = false;
    fetchContentEntries("goods")
      .then((entries) => {
        if (cancelled) return;
        setGoods(entries.map((entry) => ({ id: entry.id, name: entry.name, logoUrl: entry.logoUrl ?? null })));
      })
      .catch(() => {
        if (!cancelled) setGoods([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!buildingOverviewToken || !authCountryId) {
      setActiveCountryModifiers([]);
      return;
    }
    let cancelled = false;
    fetchCountryModifiers(buildingOverviewToken, authCountryId)
      .then((result) => {
        if (!cancelled) setActiveCountryModifiers(result.modifiers);
      })
      .catch(() => {
        if (!cancelled) setActiveCountryModifiers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authCountryId, buildingOverviewToken]);

  const selectedTile = selectedTileId ? tileById.get(selectedTileId) ?? null : null;
  const regionPopulationSummary = useMemo(() => {
    const totalByRegion = new Map<string, number>();
    let maxPopulation = 1;
    for (const [regionId, population] of Object.entries(worldBase?.regionPopulationByRegion ?? {})) {
      const total = (population?.pops ?? []).reduce((sum, pop) => sum + Math.max(0, Number(pop.size) || 0), 0);
      totalByRegion.set(regionId, total);
      maxPopulation = Math.max(maxPopulation, total);
    }
    return { totalByRegion, maxPopulation };
  }, [worldBase?.regionPopulationByRegion]);
  const zoomBucket = useMemo(() => getMapZoomBucket(camera.scale), [camera.scale]);
  const formattedZoom = useMemo(
    () => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(camera.scale)}x`,
    [camera.scale, locale],
  );
  const visibleRegionIds = useMemo(() => {
    const regions = new Set<string>();
    for (const hexId of viewportCulling.visibleTileIds) {
      const tile = tileById.get(hexId);
      if (tile) regions.add(tile.regionId);
    }
    return regions;
  }, [tileById, viewportCulling.key, viewportCulling.visibleTileIds]);
  const mapFeaturesByHexId = useMemo(() => {
    const result = new Map<HexId, MapFeatureInstance[]>();
    for (const feature of mapFeatures) {
      const list = result.get(feature.hexId) ?? [];
      list.push(feature);
      result.set(feature.hexId, list);
    }
    return result;
  }, [mapFeatures]);
  const resourceDepositsByHexId = useMemo(() => {
    const result = new Map<HexId, RegionResourceDeposit>();
    for (const deposit of Object.values(worldBase?.regionResourceDepositsByRegion ?? {}).flat()) {
      if (deposit.visibility !== "known" || Number(deposit.amount) <= 0) continue;
      result.set(deposit.hexId as HexId, deposit);
    }
    return result;
  }, [worldBase?.regionResourceDepositsByRegion]);
  const hoverPath = useMemo(() => {
    if (!selectedTile || !hoverState?.tile || selectedTile.id === hoverState.tile.id) return [];
    return getCachedPreviewPath("land", selectedTile.id, hoverState.tile.id);
  }, [getCachedPreviewPath, hoverState?.tile, selectedTile]);
  const civilianMoveHoverPath = useMemo(() => {
    if (!civilianMoveSelection || !hoverState?.tile || civilianMoveSelection.fromHexId === hoverState.tile.id) return [];
    return getCachedPreviewPath("land", civilianMoveSelection.fromHexId, hoverState.tile.id);
  }, [civilianMoveSelection, getCachedPreviewPath, hoverState?.tile]);
  const divisionMoveHoverPath = useMemo(() => {
    if (!divisionMoveSelection || !hoverState?.tile || divisionMoveSelection.fromHexId === hoverState.tile.id) return [];
    return getCachedPreviewPath("land", divisionMoveSelection.fromHexId, hoverState.tile.id);
  }, [divisionMoveSelection, getCachedPreviewPath, hoverState?.tile]);
  const corridorFixedPreviewPath = useMemo(() => {
    if (!corridorPlacement || corridorPlacement.points.length < 2) return [];
    const result: HexId[] = [];
    for (let index = 1; index < corridorPlacement.points.length; index += 1) {
      const from = corridorPlacement.points[index - 1]?.hexId;
      const to = corridorPlacement.points[index]?.hexId;
      if (!from || !to) continue;
      const segment = getCachedPreviewPath("land", from, to);
      if (segment.length < 2) continue;
      if (result.length === 0) result.push(...segment);
      else result.push(...segment.slice(1));
    }
    return result;
  }, [corridorPlacement?.points, getCachedPreviewPath]);
  const corridorDraftPreviewPath = useMemo(() => {
    if (!corridorPlacement || corridorPlacement.points.length < 1 || !hoverState?.tile) return [];
    const last = corridorPlacement.points[corridorPlacement.points.length - 1];
    if (!last || last.hexId === hoverState.tile.id) return [];
    return getCachedPreviewPath("land", last.hexId, hoverState.tile.id);
  }, [corridorPlacement?.points, getCachedPreviewPath, hoverState?.tile]);
  const corridorHudPreviewPath = corridorDraftPreviewPath.length > 1
    ? mergeHexPaths(corridorFixedPreviewPath, corridorDraftPreviewPath)
    : corridorFixedPreviewPath;
  const civilianUnitById = useMemo(
    () => new Map(Object.values(worldBase?.civilianUnitsById ?? {}).map((unit) => [unit.id, unit] as const)),
    [worldBase?.civilianUnitsById],
  );
  const mapUnitById = useMemo(
    () => new Map(Object.values(worldBase?.unitsById ?? {}).map((unit) => [unit.id, unit] as const)),
    [worldBase?.unitsById],
  );
  const cityHexIds = useMemo(() => {
    return buildCityHexIdSet(worldBase);
  }, [worldBase]);
  const selectedReachableHexIds = useMemo(() => {
    if (selectedMapUnit?.kind !== "map") return new Set<HexId>();
    const unit = mapUnitById.get(selectedMapUnit.unitId) ?? null;
    if (!unit || unit.status === "destroyed" || unit.status === "captured") return new Set<HexId>();
    const budget = Math.max(0, Number(unit.movementPoints) || 0);
    if (budget <= 0) return new Set<HexId>();
    return calculateReachableHexIds({
      mapArtifact,
      fromHexId: selectedMapUnit.fromHexId,
      budget,
      tileById,
      cityHexIds,
      modifiers: activeCountryModifiers,
    });
  }, [activeCountryModifiers, cityHexIds, mapArtifact, mapUnitById, selectedMapUnit, tileById]);
  const civilianMovePreviewCost = useMemo(
    () => calculateHexPathMovementCost(civilianMoveHoverPath, tileById, cityHexIds, activeCountryModifiers),
    [activeCountryModifiers, cityHexIds, civilianMoveHoverPath, tileById],
  );

  const pendingBuildMarkers = useMemo(() => {
    const byPlayer = ordersByTurn.get(turnId);
    if (!byPlayer) return [];
    const markers: Array<{ targetHexId: HexId; regionId: string; buildingId: string; countryId: string }> = [];
    const seen = new Set<string>();
    for (const orders of byPlayer.values()) {
      for (const order of orders) {
        if (order.type !== "BUILD") continue;
        const buildingId = typeof order.payload?.buildingId === "string" ? order.payload.buildingId : "";
        if (!buildingId) continue;
        const key = `${order.targetHexId}:${buildingId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        markers.push({ targetHexId: order.targetHexId, regionId: order.regionId, buildingId, countryId: order.countryId });
      }
    }
    return markers;
  }, [ordersByTurn, turnId]);

  const pendingFoundCityMarkers = useMemo(() => {
    const byPlayer = ordersByTurn.get(turnId);
    if (!byPlayer) return [];
    const markers: Array<{ targetHexId: HexId; regionId: string; civilianUnitId: string; countryId: string; cultureId: string; name: string }> = [];
    const seen = new Set<string>();
    for (const orders of byPlayer.values()) {
      for (const order of orders) {
        if (order.type !== "FOUND_CITY") continue;
        const cultureId = typeof order.payload?.cultureId === "string" && order.payload.cultureId.trim() ? order.payload.cultureId : order.countryId;
        const name = typeof order.name === "string" && order.name.trim() ? order.name.trim() : t("hexMap.cityPendingNameFallback");
        const key = `${order.civilianUnitId}:${order.targetHexId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        markers.push({ targetHexId: order.targetHexId, regionId: order.regionId, civilianUnitId: order.civilianUnitId, countryId: order.countryId, cultureId, name });
      }
    }
    return markers;
  }, [ordersByTurn, t, turnId]);

  const pendingFoundCityUnitIds = useMemo(() => new Set(pendingFoundCityMarkers.map((marker) => marker.civilianUnitId)), [pendingFoundCityMarkers]);

  const canceledConstructionQueueKeySet = useMemo(() => new Set(canceledConstructionQueueKeys), [canceledConstructionQueueKeys]);

  const placementWorld = useMemo(() => {
    if (!worldBase || (pendingBuildMarkers.length === 0 && canceledConstructionQueueKeySet.size === 0)) return worldBase;
    const regionConstructionQueueByRegion = Object.fromEntries(
      Object.entries(worldBase.regionConstructionQueueByRegion ?? {}).map(([regionId, queue]) => [
        regionId,
        (queue ?? []).filter((project) => !canceledConstructionQueueKeySet.has(`${regionId}:${project.queueId}`)),
      ]),
    );
    for (const marker of pendingBuildMarkers) {
      const queue = regionConstructionQueueByRegion[marker.regionId] ?? [];
      queue.push({
        queueId: `pending:${marker.targetHexId}:${marker.buildingId}`,
        requestedByCountryId: marker.countryId,
        buildingId: marker.buildingId,
        targetHexId: marker.targetHexId,
        owner: { type: "state", countryId: marker.countryId },
        projectType: "build",
        progressConstruction: 0,
        costConstruction: 1,
        costDucats: 0,
        createdTurnId: turnId,
      });
      regionConstructionQueueByRegion[marker.regionId] = queue;
    }
    return { ...worldBase, regionConstructionQueueByRegion };
  }, [canceledConstructionQueueKeySet, pendingBuildMarkers, turnId, worldBase]);

  const buildingNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const building of buildingEntries ?? []) {
      map.set(building.id, building.name?.trim() || building.id);
    }
    return map;
  }, [buildingEntries]);

  const hexBuildingTooltipByHexId = useMemo(() => {
    const map = new Map<HexId, HexBuildingTooltipInfo>();
    if (!placementWorld) return map;
    for (const queue of Object.values(placementWorld.regionConstructionQueueByRegion ?? {})) {
      for (const project of queue ?? []) {
        if ((project.projectType ?? "build") !== "build" || !project.targetHexId) continue;
        map.set(project.targetHexId as HexId, {
          name: buildingNameById.get(project.buildingId) ?? project.buildingId,
          statusKey: "hexMap.buildingStatusConstruction",
          tone: "warn",
        });
      }
    }
    for (const instances of Object.values(placementWorld.regionBuildingsByRegion ?? {})) {
      for (const instance of instances ?? []) {
        if (!instance.targetHexId) continue;
        const visualState = getBuildingMapVisualState(instance);
        map.set(instance.targetHexId as HexId, {
          name: instance.customName?.trim() || buildingNameById.get(instance.buildingId) || instance.buildingId,
          statusKey:
            visualState === "burning"
              ? "hexMap.buildingStatusBurning"
              : visualState === "ruins"
                ? "hexMap.buildingStatusRuins"
                : instance.isInactive
                  ? "hexMap.buildingStatusInactive"
                  : "hexMap.buildingStatusWorking",
          tone: visualState === "working" && !instance.isInactive ? "good" : "bad",
        });
      }
    }
    return map;
  }, [buildingNameById, placementWorld]);

  const mapBuildingOverviewItems = useMemo(() => {
    if (!buildingOverviewCountryId || !placementWorld) return [];
    return buildOverviewItems(
      {
        countryId: buildingOverviewCountryId,
        worldBase: placementWorld,
        turnId,
        ordersByTurn,
        buildings: buildingOverviewBuildings ?? [],
        companies: buildingOverviewCompanies,
        countries: buildingOverviewCountries,
        demolitionCostConstructionPercent: buildingOverviewDemolitionCostConstructionPercent,
        canceledConstructionQueueKeys,
      },
      t,
    );
  }, [
    buildingOverviewBuildings,
    buildingOverviewCompanies,
    buildingOverviewCountries,
    buildingOverviewCountryId,
    buildingOverviewDemolitionCostConstructionPercent,
    canceledConstructionQueueKeys,
    ordersByTurn,
    placementWorld,
    t,
    turnId,
  ]);

  const mapBuildingItemByHexId = useMemo(() => {
    const priority: Record<OverviewItem["kind"], number> = { built: 3, queued: 2, pending: 1 };
    const map = new Map<HexId, OverviewItem>();
    for (const item of mapBuildingOverviewItems) {
      const current = map.get(item.targetHexId);
      if (!current || priority[item.kind] > priority[current.kind]) {
        map.set(item.targetHexId, item);
      }
    }
    return map;
  }, [mapBuildingOverviewItems]);

  const civilianUnitsByHexId = useMemo(() => {
    const map = new Map<HexId, NonNullable<WorldBase["civilianUnitsById"][string]>[]>();
    for (const unit of Object.values(worldBase?.civilianUnitsById ?? {})) {
      if (pendingFoundCityUnitIds.has(unit.id)) continue;
      const list = map.get(unit.hexId) ?? [];
      list.push(unit);
      map.set(unit.hexId, list);
    }
    return map;
  }, [pendingFoundCityUnitIds, worldBase?.civilianUnitsById]);
  const mapUnitsByHexId = useMemo(() => {
    const map = new Map<HexId, NonNullable<NonNullable<WorldBase["unitsById"]>[string]>[]>();
    for (const unit of Object.values(worldBase?.unitsById ?? {})) {
      if (unit.status === "destroyed" || unit.status === "captured") continue;
      const list = map.get(unit.hexId) ?? [];
      list.push(unit);
      map.set(unit.hexId, list);
    }
    return map;
  }, [worldBase?.unitsById]);

  useEffect(() => {
    terrainMeshRendererRef.current?.setCityHexIds(cityHexIds);
    safeRenderPixiApp(appRef.current);
  }, [cityHexIds]);

  const selectedMapBuildingItem = selectedBuildingPopoverHexId ? mapBuildingItemByHexId.get(selectedBuildingPopoverHexId) ?? null : null;
  const goodsById = useMemo(() => new Map(goods.map((good) => [good.id, good] as const)), [goods]);

  useEffect(() => {
    if (!selectedBuildingPopoverHexId) return;
    if (!mapBuildingItemByHexId.has(selectedBuildingPopoverHexId)) {
      setSelectedBuildingPopoverHexId(null);
      setExpandedMapBuildingId(null);
      setMapBuildingConfirm(null);
    }
  }, [mapBuildingItemByHexId, selectedBuildingPopoverHexId]);

  const activeLensDescriptor = useMemo(() => getMapLensDescriptor(activeLens), [activeLens]);
  const lensCells = useMemo(() => {
    const showLabels = mapLayers.countryLabels && zoomBucket !== "far";
    const analyticalCells = selectMapLensCells(activeLens, {
      map: mapArtifact,
      worldBase,
      authCountryId,
      countryColorById,
      countryNameById,
      visibleTileIds: viewportCulling.visibleTileIds,
      populationTotalByRegion: regionPopulationSummary.totalByRegion,
      maxPopulationTotal: regionPopulationSummary.maxPopulation,
      showLabels,
    });
    const baseCells = buildLayerOverlayCells(mapArtifact, worldBase, mapLayers, countryColorById, countryNameById, viewportCulling.visibleTileIds, showLabels);
    const cells = [...baseCells, ...analyticalCells];
    return showLabels ? cells : cells.map(stripMapCellLabel);
  }, [activeLens, authCountryId, countryColorById, countryNameById, mapArtifact, mapLayers, regionPopulationSummary, viewportCulling.key, viewportCulling.visibleTileIds, worldBase, zoomBucket]);

  const placementEvaluations = useMemo(() => {
    if (!hexBuildPlacement || !placementWorld || !authCountryId) return new Map<HexId, ReturnType<typeof evaluateBuildingPlacement>>();
    const map = new Map<HexId, ReturnType<typeof evaluateBuildingPlacement>>();
    for (const regionId of visibleRegionIds) {
      const controller = placementWorld.regionController[regionId] ?? placementWorld.regionOwner[regionId] ?? null;
      if (controller !== authCountryId) continue;
      for (const tile of tilesByRegionId.get(regionId) ?? []) {
        if (!viewportCulling.visibleTileIds.has(tile.id)) continue;
        const effectiveTile = resolveEffectiveHexTile(tile, cityHexIds);
        const neighbors = getNeighborTiles(tile, tileById, mapArtifact.settings).map((neighbor) => resolveEffectiveHexTile(neighbor, cityHexIds));
        map.set(tile.id, evaluateBuildingPlacement({
          building: hexBuildPlacement.building,
          countryId: authCountryId,
          hex: effectiveTile,
          neighborHexes: neighbors,
          world: placementWorld,
        }));
      }
    }
    return map;
  }, [authCountryId, cityHexIds, hexBuildPlacement, mapArtifact.settings, placementWorld, tileById, tilesByRegionId, viewportCulling.key, viewportCulling.visibleTileIds, visibleRegionIds]);

  const layerOptions = useMemo(
    () =>
      MAP_LAYER_DESCRIPTORS.map((layer) => ({
        id: layer.id,
        label: t(layer.labelKey),
        tooltip: t(layer.tooltipKey),
        icon: layer.icon,
        active: mapLayers[layer.id],
      })),
    [mapLayers, t],
  );

  const lensOptions = useMemo(
    () =>
      MAP_LENS_DESCRIPTORS.filter((lens) => VISIBLE_MAP_LENS_IDS.has(lens.id)).map((lens) => ({
        id: lens.id,
        label: t(lens.labelKey),
        tooltip: t(lens.tooltipKey),
        icon: getMapLensIcon(lens.id),
      })),
    [t],
  );

  const lensLegend = useMemo(
    () => (
      <div className="arc-map-lens-legend" aria-label={t("map.lens.legend")}>
        {activeLensDescriptor.legend.map((entry) => (
          <span key={entry.labelKey} className={`arc-map-lens-legend-item arc-map-lens-legend-item--${entry.tone ?? "neutral"}`}>
            <span
              className="arc-map-lens-swatch"
              style={{ "--arc-map-lens-swatch-color": entry.color } as CSSProperties}
              aria-hidden="true"
            />
            <span>{t(entry.labelKey)}</span>
          </span>
        ))}
      </div>
    ),
    [activeLensDescriptor.legend, t],
  );

  const resolveHexName = useCallback(
    (tile: HexTile) => worldBase?.hexNameById[tile.id] ?? t("hexMap.hexTitle", { id: tile.id.replace("hex:", "") }),
    [t, worldBase?.hexNameById],
  );

  const setCameraTarget = useCallback(
    (next: HexCamera | ((current: HexCamera) => HexCamera)) => {
      const current = cameraTargetRef.current;
      cameraTargetRef.current = normalizeHexCamera(typeof next === "function" ? next(current) : next, cameraBounds);
    },
    [cameraBounds],
  );

  const centerOnTile = useCallback(
    (tile: HexTile | null) => {
      if (!tile) return;
      setCameraTarget((current) => centerCameraOnWorldPoint(current, axialToPixel(tile, mapArtifact.settings.hexSize), cameraBounds));
    },
    [cameraBounds, mapArtifact.settings.hexSize, setCameraTarget],
  );

  const handleLensChange = useCallback(
    (lens: MapLensId) => {
      setActiveLens(lens);
      writeMapLensSetting(authCountryId, lens);
    },
    [authCountryId],
  );

  const handleLayerToggle = useCallback(
    (layerId: MapLayerToggleId) => {
      setMapLayers((current) => {
        const next = { ...current, [layerId]: !current[layerId] };
        writeMapLayerSettings(authCountryId, next);
        return next;
      });
    },
    [authCountryId],
  );

  const selectTile = useCallback(
    (tile: HexTile | null) => {
      setSelectedTileId(tile?.id ?? null);
      setSelectedHex(tile?.regionId ?? null);
    },
    [setSelectedHex],
  );

  useEffect(() => {
    if (!focusHexRequest) return;
    const tile = tileById.get(focusHexRequest.hexId) ?? null;
    if (!tile) return;
    centerOnTile(tile);
    selectTile(tile);
  }, [centerOnTile, focusHexRequest, selectTile, tileById]);

  const canQueueColonizerOnTile = useCallback(
    (tile: HexTile) => {
      if (!authCountryId || !onSelectColonizerPlacementTarget) return false;
      const controller = worldBase?.regionController[tile.regionId] ?? worldBase?.regionOwner[tile.regionId] ?? null;
      if (controller !== authCountryId) return false;
      if ((civilianUnitsByHexId.get(tile.id) ?? []).length > 0) return false;
      return (worldBase?.civilianUnitQueueByCountry?.[authCountryId] ?? []).every((item) => item.hexId !== tile.id);
    },
    [authCountryId, civilianUnitsByHexId, onSelectColonizerPlacementTarget, worldBase?.civilianUnitQueueByCountry, worldBase?.regionController, worldBase?.regionOwner],
  );

  const colonizerPlacementValidHexIds = useMemo(() => {
    if (!colonizerPlacement?.active) return new Set<HexId>();
    const valid = new Set<HexId>();
    for (const hexId of viewportCulling.visibleTileIds) {
      const tile = tileById.get(hexId);
      if (tile && canQueueColonizerOnTile(tile)) valid.add(hexId);
    }
    return valid;
  }, [canQueueColonizerOnTile, colonizerPlacement?.active, tileById, viewportCulling.key, viewportCulling.visibleTileIds]);

  const unitTrainingDeploymentHexIds = useMemo(() => {
    const ids = new Set<HexId>();
    if (!authCountryId || !worldBase) return ids;
    for (const city of Object.values(worldBase.cityMarkersById ?? {})) {
      if (city.countryId === authCountryId && isHexId(city.targetHexId)) ids.add(city.targetHexId);
    }
    for (const instances of Object.values(worldBase.regionBuildingsByRegion ?? {})) {
      for (const instance of instances ?? []) {
        if (instance.owner.type === "state" && instance.owner.countryId === authCountryId && isHexId(instance.targetHexId)) {
          ids.add(instance.targetHexId);
        }
      }
    }
    return ids;
  }, [authCountryId, worldBase]);

  const canTrainUnitOnTile = useCallback(
    (tile: HexTile) => {
      const unitType = unitTrainingPlacement?.unitType;
      if (!authCountryId || !unitType || !onSelectUnitTrainingPlacementTarget || !worldBase) return false;
      const controller = worldBase.regionController[tile.regionId] ?? worldBase.regionOwner[tile.regionId] ?? null;
      if (controller !== authCountryId) return false;
      if (!unitTrainingDeploymentHexIds.has(tile.id)) return false;
      if (unitType.domain === "naval" && !tile.waterKind) return false;
      if ((unitType.domain === "land" || unitType.domain === "civilian") && tile.waterKind) return false;
      const presentUnits = mapUnitsByHexId.get(tile.id) ?? [];
      if (unitType.domain === "civilian") {
        return !presentUnits.some((unit) => unit.countryId === authCountryId);
      }
      if (unitType.domain === "land" || unitType.domain === "naval") {
        return !presentUnits.some((unit) => unit.countryId === authCountryId);
      }
      return true;
    },
    [authCountryId, mapUnitsByHexId, onSelectUnitTrainingPlacementTarget, unitTrainingDeploymentHexIds, unitTrainingPlacement, worldBase],
  );

  const unitTrainingPlacementValidHexIds = useMemo(() => {
    if (!unitTrainingPlacement) return new Set<HexId>();
    const valid = new Set<HexId>();
    for (const hexId of viewportCulling.visibleTileIds) {
      const tile = tileById.get(hexId);
      if (tile && canTrainUnitOnTile(tile)) valid.add(hexId);
    }
    return valid;
  }, [canTrainUnitOnTile, tileById, unitTrainingPlacement, viewportCulling.key, viewportCulling.visibleTileIds]);

  const buildHexWorkspaceDetails = useCallback(
    (tile: HexTile): StrategyShellSelectedHexDetails => {
      const hasCity = cityHexIds.has(tile.id);
      const ownerId = worldBase?.regionOwner[tile.regionId] ?? worldBase?.hexOwner[tile.id] ?? null;
      const controllerId = worldBase?.regionController[tile.regionId] ?? ownerId;
      const siteFeatures = mapFeaturesByHexId.get(tile.id) ?? [];
      const deposit = resourceDepositsByHexId.get(tile.id) ?? null;
      const stackCount = (mapUnitsByHexId.get(tile.id) ?? []).filter((unit) => !authCountryId || unit.countryId === authCountryId).length;
      return {
        id: tile.id,
        name: worldBase?.hexNameById[tile.id] ?? t("hexMap.hexTitle", { id: tile.id.replace("hex:", "") }),
        regionId: tile.regionId,
        surfaceSummary: resolveHexTagSummary(tile, t, hasCity),
        siteFeatures: siteFeatures.map((feature) => resolveMapFeatureLabel(feature, t)),
        resourceDeposit: deposit ? formatResourceDepositLabel(deposit) : null,
        water: tile.waterKind ? t(`hexMap.water.${tile.waterKind}`) : t("hexMap.water.none"),
        owner: ownerId ? t("hexMap.ownerCountry", { country: ownerId }) : t("hexMap.ownerNone"),
        controller: controllerId ? t("hexMap.ownerCountry", { country: controllerId }) : t("hexMap.ownerNone"),
        movementCost: tile.movementCost.toFixed(1),
        tagGroups: resolveHexTagGroupRows(tile, t),
        unitStack: t("hexMap.unitStackValue", { current: stackCount, max: 2 }),
        unitStackTooltip: {
          title: t("hexMap.unitStack"),
          description: t("hexMap.unitStackTooltip", { current: stackCount, max: 2 }),
          tone: stackCount >= 2 ? "warning" : "info",
        },
      };
    },
    [
      authCountryId,
      cityHexIds,
      mapUnitsByHexId,
      mapFeaturesByHexId,
      resourceDepositsByHexId,
      t,
      worldBase?.hexNameById,
      worldBase?.hexOwner,
      worldBase?.regionController,
      worldBase?.regionOwner,
    ],
  );

  const buildHexPlotTooltipData = useCallback(
    (tile: HexTile): GamePlotTooltipData => {
      const hasCity = cityHexIds.has(tile.id);
      const ownerId = worldBase?.regionOwner[tile.regionId] ?? worldBase?.hexOwner[tile.id] ?? null;
      const controllerId = worldBase?.regionController[tile.regionId] ?? ownerId;
      const siteFeatures = mapFeaturesByHexId.get(tile.id) ?? [];
      const deposit = resourceDepositsByHexId.get(tile.id) ?? null;
      const building = hexBuildingTooltipByHexId.get(tile.id) ?? null;
      const mapUnits = mapUnitsByHexId.get(tile.id) ?? [];
      const movementTags = hasCity ? [...tile.mapTags, "city"] : tile.mapTags;
      const movementCost = resolveClientHexMovementCost(tile.movementCost, movementTags, activeCountryModifiers);
      const systemRows: GamePlotTooltipRow[] = [
        ...siteFeatures.map<GamePlotTooltipRow>((feature, index) => ({
          id: `feature:${index}`,
          icon: <Landmark size={13} aria-hidden="true" />,
          label: t("hexMap.siteFeature"),
          value: resolveMapFeatureLabel(feature, t),
          tone: "info",
        })),
      ];

      if (building) {
        systemRows.push({
          id: "building",
          icon: <Building2 size={13} aria-hidden="true" />,
          label: t("hexMap.building"),
          value: building.name,
          detail: t(building.statusKey),
          tone: resolvePlotTooltipTone(building.tone),
        });
      }

      const unitRows: GamePlotTooltipRow[] = [];
      const unitCount = mapUnits.length;
      if (unitCount > 0) {
        unitRows.push({
          id: "units",
          icon: <Shield size={13} aria-hidden="true" />,
          label: t("hexMap.unitStack"),
          value: unitCount,
          tone: "warning",
        });
      }

      return {
        title: resolveHexName(tile),
        subtitle: resolveHexTagSummary(tile, t, hasCity),
        geography: {
          title: t("hexMap.tagGroupBiome"),
          icon: <Mountain size={13} aria-hidden="true" />,
          rows: resolveHexGeographyRows(tile, t, hasCity),
        },
        ownership: {
          title: t("hexMap.owner"),
          icon: <Flag size={13} aria-hidden="true" />,
          rows: [
            {
              id: "owner",
              icon: <Flag size={13} aria-hidden="true" />,
              label: t("hexMap.owner"),
              value: ownerId ? t("hexMap.ownerCountry", { country: ownerId }) : t("hexMap.ownerNone"),
              tone: ownerId ? "info" : "muted",
            },
            ...(controllerId && controllerId !== ownerId
              ? [
                  {
                    id: "controller",
                    icon: <Shield size={13} aria-hidden="true" />,
                    label: t("shell.hex.controller"),
                    value: t("hexMap.ownerCountry", { country: controllerId }),
                    tone: "warning" as const,
                  },
                ]
              : []),
            {
              id: "region",
              icon: <Grid3X3 size={13} aria-hidden="true" />,
              label: t("hexMap.region"),
              value: tile.regionId,
              tone: "muted",
            },
          ],
        },
        resource: deposit
          ? {
              icon: <Gem size={18} aria-hidden="true" />,
              name: t("hexMap.resourceDeposit"),
              description: formatResourceDepositLabel(deposit),
            }
          : undefined,
        movement: {
          title: t("hexMap.movementCost"),
          cost: movementCost.toFixed(1),
          baseCost: t("hexMap.movementBase", { value: tile.movementCost.toFixed(1) }),
          stopOnEnter: tile.mapTags.includes("movement:stop_on_enter"),
          stopLabel: t("hexMap.movementStopOnEnter"),
          rows: resolveHexMovementRows(tile, t),
        },
        sections: [
          {
            title: t("hexMap.tooltipSystems"),
            icon: <Grid3X3 size={13} aria-hidden="true" />,
            rows: systemRows,
            empty: t("hexMap.tooltipNoSystems"),
          },
          ...(unitRows.length > 0
            ? [
                {
                  title: t("templates.plotTooltip.section.units"),
                  icon: <Users size={13} aria-hidden="true" />,
                  rows: unitRows,
                },
              ]
            : []),
          {
            title: t("map.lens.hoverMode"),
            icon: <Tags size={13} aria-hidden="true" />,
            rows: [
              {
                id: "lens",
                icon: <Layers size={13} aria-hidden="true" />,
                label: t("map.lens.activeLens"),
                value: t(activeLensDescriptor.labelKey),
                tone: "muted",
              },
            ],
          },
        ],
      };
    },
    [
      activeCountryModifiers,
      activeLensDescriptor.labelKey,
      cityHexIds,
      hexBuildingTooltipByHexId,
      mapFeaturesByHexId,
      mapUnitsByHexId,
      resolveHexName,
      resourceDepositsByHexId,
      t,
      worldBase?.hexOwner,
      worldBase?.regionController,
      worldBase?.regionOwner,
    ],
  );

  useEffect(() => {
    onHexSelectionChange?.(selectedTile ? buildHexWorkspaceDetails(selectedTile) : null);
  }, [buildHexWorkspaceDetails, onHexSelectionChange, selectedTile]);

  const applyTileInteraction = useCallback(
    (tile: HexTile | null) => {
      selectTile(tile);
      if (!tile) {
        setSelectedBuildingPopoverHexId(null);
        setExpandedMapBuildingId(null);
        setSelectedMapUnit(null);
        setCivilianMoveSelection(null);
        setDivisionMoveSelection(null);
        setDivisionAttackSelection(null);
        return;
      }
      if (corridorPlacement) {
        onSelectCorridorPlacementPoint?.({
          hexId: tile.id,
          regionId: tile.regionId,
          lng: tile.q,
          lat: tile.r,
        });
        return;
      }
      if (hexBuildPlacement) {
        const evaluation = placementEvaluations.get(tile.id);
        if (!evaluation?.valid) {
          setMapActionNotice(t(getPlacementReasonLabelKey(evaluation?.reason.code)));
          return;
        }
        onSelectHexBuildPlacementTarget?.({ hexId: tile.id, regionId: tile.regionId });
        return;
      }
      if (unitTrainingPlacement) {
        if (!canTrainUnitOnTile(tile)) {
          setMapActionNotice(t("hexMap.unitTrainingUnavailable"));
          return;
        }
        onSelectUnitTrainingPlacementTarget?.({ hexId: tile.id, regionId: tile.regionId });
        return;
      }
      if (colonizerPlacement?.active) {
        if (!canQueueColonizerOnTile(tile)) {
          setMapActionNotice(t("hexMap.queueColonizerUnavailable"));
          return;
        }
        onSelectColonizerPlacementTarget?.({ hexId: tile.id, regionId: tile.regionId });
        return;
      }
      if (civilianMoveSelection) {
        if (tile.id === civilianMoveSelection.fromHexId) {
          setMapActionNotice(t("hexMap.civilianMoveSelectTarget"));
          return;
        }
        const path = getCachedPreviewPath("land", civilianMoveSelection.fromHexId, tile.id);
        if (path.length < 2) {
          setMapActionNotice(t("hexMap.civilianMoveNoPath"));
          return;
        }
        onQueueCivilianUnitMoveOrder?.(civilianMoveSelection.unitId, civilianMoveSelection.fromHexId, tile.id, path);
        setCivilianMoveSelection(null);
        setSelectedMapUnit(null);
        setMapActionNotice(t("hexMap.civilianMoveOrderSent"));
        return;
      }
      if (divisionMoveSelection) {
        if (tile.id === divisionMoveSelection.fromHexId) {
          setMapActionNotice(t("hexMap.unitMoveSelectTarget"));
          return;
        }
        const path = getCachedPreviewPath("land", divisionMoveSelection.fromHexId, tile.id);
        if (path.length < 2) {
          setMapActionNotice(t("hexMap.unitMoveNoPath"));
          return;
        }
        onQueueArmyMoveOrder?.(divisionMoveSelection.unitId, tile.id, path);
        setDivisionMoveSelection(null);
        setSelectedMapUnit(null);
        setMapActionNotice(t("hexMap.unitMoveOrderSent"));
        return;
      }
      if (divisionAttackSelection) {
        if (tile.id === divisionAttackSelection.fromHexId) {
          setMapActionNotice(t("hexMap.unitAttackSelectTarget"));
          return;
        }
        const path = findHexPath(mapArtifact, divisionAttackSelection.fromHexId, tile.id, 2, tileById);
        const attacker = mapUnitById.get(divisionAttackSelection.unitId) ?? null;
        const targetMapUnits = mapUnitsByHexId.get(tile.id) ?? [];
        const enemyMapUnit = targetMapUnits.find((unit) => attacker && unit.countryId !== attacker.countryId) ?? null;
        const targetController = worldBase?.hexOwner?.[tile.id] ?? worldBase?.regionController?.[tile.regionId] ?? worldBase?.regionOwner?.[tile.regionId] ?? null;
        const attackableByControl = Boolean(attacker && targetController && targetController !== attacker.countryId);
        if (path.length !== 2 || !attacker || (!enemyMapUnit && !attackableByControl)) {
          setMapActionNotice(t("hexMap.unitAttackNoTarget"));
          return;
        }
        onQueueUnitAttackOrder?.(divisionAttackSelection.unitId, tile.id, enemyMapUnit?.id ?? null);
        setDivisionAttackSelection(null);
        setMapActionNotice(t("hexMap.unitAttackOrderSent"));
        return;
      }
      if (mapBuildingItemByHexId.has(tile.id)) {
        setSelectedBuildingPopoverHexId(tile.id);
        setExpandedMapBuildingId(null);
        setSelectedMapUnit(null);
      } else {
        setSelectedBuildingPopoverHexId(null);
        setExpandedMapBuildingId(null);
        setSelectedMapUnit(null);
        onOpenSelectedHexWorkspace?.(buildHexWorkspaceDetails(tile));
      }
    },
    [
      buildHexWorkspaceDetails,
      canQueueColonizerOnTile,
      canTrainUnitOnTile,
      civilianMoveSelection,
      colonizerPlacement?.active,
      corridorPlacement,
      divisionAttackSelection,
      divisionMoveSelection,
      hexBuildPlacement,
      mapBuildingItemByHexId,
      mapArtifact,
      mapUnitById,
      mapUnitsByHexId,
      onQueueArmyMoveOrder,
      onQueueCivilianUnitMoveOrder,
      onQueueUnitAttackOrder,
      onSelectCorridorPlacementPoint,
      onOpenSelectedHexWorkspace,
      onSelectColonizerPlacementTarget,
      onSelectHexBuildPlacementTarget,
      onSelectUnitTrainingPlacementTarget,
      placementEvaluations,
      selectTile,
      t,
      unitTrainingPlacement,
      worldBase?.hexOwner,
      worldBase?.regionController,
      worldBase?.regionOwner,
    ],
  );

  const hitTestMapUnitAtClientPoint = useCallback(
    (clientX: number, clientY: number): SelectedMapUnit | null => {
      if (!authCountryId || !containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const size = mapArtifact.settings.hexSize;
      const candidates: Array<{ unit: SelectedMapUnit; distance: number; priority: number }> = [];
      const addCandidate = (unit: SelectedMapUnit, worldX: number, worldY: number, radius: number, priority: number) => {
        const x = rect.width / 2 + (worldX - camera.x) * camera.scale;
        const y = rect.height / 2 + (worldY - camera.y) * camera.scale;
        const distance = Math.hypot(localX - x, localY - y);
        if (distance <= Math.max(14, radius * camera.scale + 4)) {
          candidates.push({ unit, distance, priority });
        }
      };

      for (const unit of Object.values(worldBase?.unitsById ?? {})) {
        if (unit.countryId !== authCountryId || unit.status === "captured" || unit.status === "destroyed") continue;
        const tile = tileById.get(unit.hexId);
        if (!tile) continue;
        const center = axialToPixel(tile, size);
        addCandidate({ kind: "map", unitId: unit.id, fromHexId: tile.id }, center.x, center.y + size * 0.04, Math.max(size * 0.24, Math.min(size * 0.46, 18 / camera.scale)), 3);
      }
      for (const unit of Object.values(worldBase?.civilianUnitsById ?? {})) {
        if (unit.countryId !== authCountryId || unit.status === "captured") continue;
        const tile = tileById.get(unit.hexId);
        if (!tile) continue;
        const center = axialToPixel(tile, size);
        addCandidate({ kind: "civilian", unitId: unit.id, fromHexId: tile.id }, center.x + size * 0.22, center.y - size * 0.28, Math.max(size * 0.18, Math.min(size * 0.34, 12 / camera.scale)), 0);
      }
      candidates.sort((left, right) => left.distance - right.distance || left.priority - right.priority);
      return candidates[0]?.unit ?? null;
    },
    [authCountryId, camera, mapArtifact.settings.hexSize, tileById, worldBase?.civilianUnitsById, worldBase?.unitsById],
  );

  const selectMapUnitForMovement = useCallback(
    (unit: SelectedMapUnit) => {
      setSelectedMapUnit(unit);
      setSelectedBuildingPopoverHexId(null);
      setExpandedMapBuildingId(null);
      setCivilianMoveSelection(null);
      setDivisionMoveSelection(null);
      setDivisionAttackSelection(null);
      onSelectedCommandUnitChange?.(unit.unitId);
      setMapActionNotice(t("hexMap.unitSelected"));
    },
    [onSelectedCommandUnitChange, t],
  );

  const startUnitCommandMode = useCallback(
    (unitId: string, mode: "move" | "attack" | "foundCity") => {
      const mapUnit = mapUnitById.get(unitId) ?? null;
      const civilianUnit = civilianUnitById.get(unitId) ?? null;
      const hexId = mapUnit?.hexId ?? civilianUnit?.hexId ?? null;
      const tile = hexId ? tileById.get(hexId) ?? null : null;
      if (!tile) return;
      const selection: SelectedMapUnit = mapUnit ? { kind: "map", unitId, fromHexId: tile.id } : { kind: "civilian", unitId, fromHexId: tile.id };
      setSelectedMapUnit(selection);
      onSelectedCommandUnitChange?.(unitId);
      setSelectedBuildingPopoverHexId(null);
      setExpandedMapBuildingId(null);
      setCivilianMoveSelection(null);
      setDivisionMoveSelection(null);
      setDivisionAttackSelection(null);
      if (mode === "move") {
        if (selection.kind === "civilian") setCivilianMoveSelection({ unitId, fromHexId: tile.id });
        else setDivisionMoveSelection({ unitId, fromHexId: tile.id });
        setMapActionNotice(selection.kind === "civilian" ? t("hexMap.civilianMoveSelectTarget") : t("hexMap.unitMoveSelectTarget"));
        return;
      }
      if (mode === "attack" && selection.kind === "map") {
        setDivisionAttackSelection({ unitId, fromHexId: tile.id });
        setMapActionNotice(t("hexMap.unitAttackSelectTarget"));
        return;
      }
      if (mode === "foundCity") {
        const foundingUnit = civilianUnit ?? mapUnit;
        const isColonizer = civilianUnit?.type === "colonizer" || mapUnit?.unitTypeId === "unit:colonizer";
        const neutral = !worldBase?.regionOwner[tile.regionId] && !worldBase?.regionController[tile.regionId];
        if (!foundingUnit || !isColonizer || !neutral) {
          setMapActionNotice(t("hexMap.foundCityNeutralRequired"));
          return;
        }
        const ownerCountry = buildingOverviewCountries.find((country) => country.id === foundingUnit.countryId) ?? null;
        setFoundCityNameDraft("");
        setFoundCityConfirmTarget({
          civilianUnitId: foundingUnit.id,
          hexId: tile.id,
          regionId: tile.regionId,
          countryId: foundingUnit.countryId,
          ownerName: ownerCountry?.name ?? countryNameById?.[foundingUnit.countryId] ?? foundingUnit.countryId,
          ownerFlagUrl: ownerCountry?.flagUrl ?? null,
          costColonization: worldBase?.regionColonizationByRegion?.[tile.regionId]?.cost ?? null,
        });
      }
    },
    [
      buildingOverviewCountries,
      civilianUnitById,
      countryNameById,
      mapUnitById,
      onSelectedCommandUnitChange,
      t,
      tileById,
      worldBase?.regionColonizationByRegion,
      worldBase?.regionController,
      worldBase?.regionOwner,
    ],
  );

  useEffect(() => {
    if (!unitCommandRequest) return;
    startUnitCommandMode(unitCommandRequest.unitId, unitCommandRequest.mode);
  }, [startUnitCommandMode, unitCommandRequest]);

  useEffect(() => {
    if (!selectedCommandUnitId) {
      setSelectedMapUnit(null);
      return;
    }
    const mapUnit = mapUnitById.get(selectedCommandUnitId) ?? null;
    const civilianUnit = civilianUnitById.get(selectedCommandUnitId) ?? null;
    const hexId = mapUnit?.hexId ?? civilianUnit?.hexId ?? null;
    if (!hexId || !tileById.has(hexId)) return;
    const existing = selectedMapUnit?.unitId === selectedCommandUnitId ? selectedMapUnit : null;
    if (existing?.fromHexId === hexId) return;
    setSelectedMapUnit(mapUnit ? { kind: "map", unitId: selectedCommandUnitId, fromHexId: hexId } : { kind: "civilian", unitId: selectedCommandUnitId, fromHexId: hexId });
  }, [civilianUnitById, mapUnitById, selectedCommandUnitId, selectedMapUnit, tileById]);

  useEffect(() => {
    if (selectedMapUnit) return;
    onSelectedCommandUnitChange?.(null);
  }, [onSelectedCommandUnitChange, selectedMapUnit]);

  useEffect(() => {
    const next = readMapNavigationSettings(authCountryId).edgeScrollEnabled;
    const nextLayers = readMapLayerSettings(authCountryId);
    edgeScrollEnabledRef.current = next;
    setEdgeScrollEnabled(next);
    setMapLayers(nextLayers);
    const onSettingsChanged = () => {
      const updated = readMapNavigationSettings(authCountryId).edgeScrollEnabled;
      edgeScrollEnabledRef.current = updated;
      setEdgeScrollEnabled(updated);
    };
    window.addEventListener(MAP_NAVIGATION_SETTINGS_EVENT, onSettingsChanged);
    return () => window.removeEventListener(MAP_NAVIGATION_SETTINGS_EVENT, onSettingsChanged);
  }, [authCountryId]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    terrainMeshRendererRef.current?.setQuality(FIXED_MAP_TEXTURE_QUALITY, reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    const media = window.matchMedia?.(REDUCED_MOTION_MEDIA_QUERY);
    if (!media) return;
    const onReducedMotionChanged = () => setReducedMotion(media.matches);
    setReducedMotion(media.matches);
    media.addEventListener("change", onReducedMotionChanged);
    return () => media.removeEventListener("change", onReducedMotionChanged);
  }, []);

  useEffect(() => {
    const storedLens = readMapLensSetting(authCountryId, suggestedMapLens ?? "terrain");
    setActiveLens(VISIBLE_MAP_LENS_IDS.has(storedLens) ? storedLens : "terrain");
  }, [authCountryId, suggestedMapLens]);

  useEffect(() => {
    if (!mapActionNotice) return;
    const timer = window.setTimeout(() => setMapActionNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [mapActionNotice]);

  useEffect(() => {
    selectedTileIdRef.current = selectedTileId;
  }, [selectedTileId]);

  useEffect(() => {
    viewportCullingRef.current = viewportCulling;
  }, [viewportCulling]);

  useEffect(() => {
    if (!serverMapArtifact) return;
    const nextCamera = buildInitialHexCamera(serverMapArtifact.settings);
    cameraRef.current = nextCamera;
    cameraTargetRef.current = nextCamera;
    setCamera(nextCamera);
    const nextViewport = getViewportCullingState(serverMapArtifact, tileSpatialIndex, nextCamera, containerRef.current?.getBoundingClientRect());
    viewportCullingRef.current = nextViewport;
    setViewportCulling(nextViewport);
  }, [serverMapArtifact, tileSpatialIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !serverMapArtifact) return;
    let disposed = false;
    let initialized = false;
    let resizeObserver: ResizeObserver | null = null;
    const app = new Application();
    const worldContainer = new Container();
    const mapLayerOutlineLayer = new Graphics();
    const overlayLayer = new Graphics();
    const naturalFeatureLayer = new Container();
    const siteFeatureLayer = new Container();
    const resourceDepositLayer = new Container();
    const corridorPersistentLayer = new Container();
    const corridorPreviewLayer = new Container();
    const buildingLayer = new Container();
    const unitLayer = new Container();

    appRef.current = app;
    worldContainerRef.current = worldContainer;
    mapLayerOutlineLayerRef.current = mapLayerOutlineLayer;
    overlayLayerRef.current = overlayLayer;
    naturalFeatureLayerRef.current = naturalFeatureLayer;
    siteFeatureLayerRef.current = siteFeatureLayer;
    resourceDepositLayerRef.current = resourceDepositLayer;
    corridorPersistentLayerRef.current = corridorPersistentLayer;
    corridorPreviewLayerRef.current = corridorPreviewLayer;
    buildingLayerRef.current = buildingLayer;
    unitLayerRef.current = unitLayer;

    setPixiReady(false);
    setMapRenderError(false);
    void app.init({ width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight), antialias: true, backgroundAlpha: 0 }).then(async () => {
      initialized = true;
      if (disposed) {
        safeDestroyPixiApp(app);
        return;
      }
      container.appendChild(app.canvas);
      try {
        terrainMeshRendererRef.current = await createHexTerrainMeshRenderer(mapArtifact);
        terrainMeshRendererRef.current.setCityHexIds(buildCityHexIdSet(worldBase));
        lensOverlayRendererRef.current = createHexMapLensOverlayRenderer(mapArtifact);
      } catch {
        setMapRenderError(true);
        return;
      }
      if (disposed) {
        safeDestroyMapRenderer(terrainMeshRendererRef.current);
        terrainMeshRendererRef.current = null;
        safeDestroyMapRenderer(lensOverlayRendererRef.current);
        lensOverlayRendererRef.current = null;
        safeDestroyPixiApp(app);
        return;
      }
      const terrainRenderer = terrainMeshRendererRef.current;
      const lensRenderer = lensOverlayRendererRef.current;
      if (!terrainRenderer || !lensRenderer) {
        setMapRenderError(true);
        return;
      }
      lensRenderer.updateLens(activeLens, lensCells);
      worldContainer.addChild(
        terrainRenderer.container,
        lensRenderer.container,
        naturalFeatureLayer,
        siteFeatureLayer,
        resourceDepositLayer,
        corridorPersistentLayer,
        corridorPreviewLayer,
        buildingLayer,
        unitLayer,
        mapLayerOutlineLayer,
        overlayLayer,
      );
      app.stage.addChild(worldContainer);
      const rect = container.getBoundingClientRect();
      terrainRenderer.setQuality(FIXED_MAP_TEXTURE_QUALITY, reducedMotionRef.current);
      const visibleMeshes = terrainRenderer.updateVisibility(cameraRef.current, rect);
      const visibleLensMeshes = lensRenderer.updateVisibility(cameraRef.current, rect);
      performanceStatsRef.current.visibleSprites = 0;
      performanceStatsRef.current.visibleTerrainMeshes = visibleMeshes;
      performanceStatsRef.current.visibleOverlayMeshes = visibleLensMeshes;
      resizeObserver = new ResizeObserver(() => {
        if (disposed || !app.renderer) return;
        app.renderer.resize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
        const nextViewport = getViewportCullingState(mapArtifact, tileSpatialIndex, cameraRef.current, container.getBoundingClientRect());
        viewportCullingRef.current = nextViewport;
        setViewportCulling(nextViewport);
        safeRenderPixiApp(app);
      });
      resizeObserver.observe(container);
      setPixiReady(true);
      safeRenderPixiApp(app);
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      appRef.current = null;
      worldContainerRef.current = null;
      safeDestroyMapRenderer(terrainMeshRendererRef.current);
      terrainMeshRendererRef.current = null;
      safeDestroyMapRenderer(lensOverlayRendererRef.current);
      lensOverlayRendererRef.current = null;
      naturalFeatureLayerRef.current = null;
      siteFeatureLayerRef.current = null;
      resourceDepositLayerRef.current = null;
      destroyLayerPool(naturalFeatureSpritePoolRef.current);
      destroyLayerPool(siteFeatureSpritePoolRef.current);
      destroyLayerPool(resourceDepositSpritePoolRef.current);
      mapLayerOutlineLayerRef.current = null;
      overlayLayerRef.current = null;
      corridorPersistentLayerRef.current = null;
      corridorPreviewLayerRef.current = null;
      buildingLayerRef.current = null;
      unitLayerRef.current = null;
      destroyLayerPool(buildingSpritePoolRef.current);
      destroyLayerPool(buildingGraphicsPoolRef.current);
      destroyLayerPool(unitSpritePoolRef.current);
      destroyLayerPool(unitGraphicsPoolRef.current);
      window.__arcHexMapStats = undefined;
      if (initialized) {
        safeDestroyPixiApp(app);
      }
    };
  }, [mapArtifact, serverMapArtifact, tileById, tileSpatialIndex, wrapWidth]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !serverMapArtifact) return;
    const readTileFromClientPoint = (clientX: number, clientY: number): HexTile | null => {
      const rect = container.getBoundingClientRect();
      const world = screenToWorld({ x: clientX - rect.left, y: clientY - rect.top }, rect, cameraRef.current);
      const axial = pixelToAxial(world.x, world.y, mapArtifact.settings.hexSize, { ...mapArtifact.settings, wrapX: false });
      return axial ? tileById.get(makeHexId(axial.q, axial.r)) ?? null : null;
    };
    const updatePointerTracking = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const inside = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
      pointerRef.current = inside ? { x, y, blocked: isMapNavigationBlocked(event.target) } : null;
    };
    const scheduleHoverState = (next: HoverState | null) => {
      pendingHoverRef.current = next;
      if (hoverFrameRef.current != null) return;
      hoverFrameRef.current = window.requestAnimationFrame(() => {
        hoverFrameRef.current = null;
        const pending = pendingHoverRef.current;
        setHoverState((current) => {
          if (current?.tile.id === pending?.tile.id && current?.x === pending?.x && current?.y === pending?.y) return current;
          return pending;
        });
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      updatePointerTracking(event);
      const blocked = isMapNavigationBlocked(event.target);
      if (hexBuildPlacement && event.button === 2) {
        if (blocked) return;
        event.preventDefault();
        onCancelHexBuildPlacement?.();
        return;
      }
      if (corridorPlacement && event.button === 2) {
        if (blocked) return;
        event.preventDefault();
        onCancelCorridorPlacement?.();
        return;
      }
      if (colonizerPlacement?.active && event.button === 2) {
        if (blocked) return;
        event.preventDefault();
        onCancelColonizerPlacement?.();
        return;
      }
      if (unitTrainingPlacement && event.button === 2) {
        if (blocked) return;
        event.preventDefault();
        onCancelUnitTrainingPlacement?.();
        return;
      }
      if (civilianMoveSelection && event.button === 2) {
        if (blocked) return;
        event.preventDefault();
        setCivilianMoveSelection(null);
        return;
      }
      if ((divisionMoveSelection || divisionAttackSelection) && event.button === 2) {
        if (blocked) return;
        event.preventDefault();
        setDivisionMoveSelection(null);
        setDivisionAttackSelection(null);
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (interactionLocked || blocked) return;
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      pointerGestureRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
        longPressTimer: window.setTimeout(() => {
          const gesture = pointerGestureRef.current;
          if (gesture) gesture.longPressTimer = null;
        }, 520),
        pinchDistance: null,
        pinchMidpoint: null,
      };
      container.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      updatePointerTracking(event);
      const tile = readTileFromClientPoint(event.clientX, event.clientY);
      scheduleHoverState(tile ? { tile, x: event.clientX, y: event.clientY } : null);
      if (interactionLocked || !activePointersRef.current.has(event.pointerId)) return;
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const gesture = pointerGestureRef.current;
      if (!gesture) return;
      const pointers = [...activePointersRef.current.values()];
      if (pointers.length >= 2) {
        const first = pointers[0];
        const second = pointers[1];
        const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        if (gesture.pinchDistance != null && gesture.pinchMidpoint) {
          const rect = container.getBoundingClientRect();
          const localMidpoint = { x: midpoint.x - rect.left, y: midpoint.y - rect.top };
          const ratio = distance / Math.max(1, gesture.pinchDistance);
          setCameraTarget((current) => {
            const zoomed = zoomCameraToScreenPoint(current, rect, localMidpoint, current.scale * ratio, cameraBounds);
            return normalizeHexCamera(
              {
                ...zoomed,
                x: zoomed.x - (midpoint.x - gesture.pinchMidpoint!.x) / zoomed.scale,
                y: zoomed.y - (midpoint.y - gesture.pinchMidpoint!.y) / zoomed.scale,
              },
              cameraBounds,
            );
          });
        }
        gesture.moved = true;
        gesture.pinchDistance = distance;
        gesture.pinchMidpoint = midpoint;
        return;
      }
      const dx = event.clientX - gesture.lastX;
      const dy = event.clientY - gesture.lastY;
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 5) {
        gesture.moved = true;
      }
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      if (gesture.moved) {
        if (gesture.longPressTimer != null) {
          window.clearTimeout(gesture.longPressTimer);
          gesture.longPressTimer = null;
        }
        setCameraTarget((current) => ({ ...current, x: current.x - dx / current.scale, y: current.y - dy / current.scale }));
      }
    };
    const handlePointerUp = (event: PointerEvent) => {
      updatePointerTracking(event);
      if (event.pointerType === "mouse" && event.button !== 0) {
        activePointersRef.current.delete(event.pointerId);
        if (activePointersRef.current.size === 0) {
          pointerGestureRef.current = null;
        }
        if (container.hasPointerCapture(event.pointerId)) {
          container.releasePointerCapture(event.pointerId);
        }
        return;
      }
      const gesture = pointerGestureRef.current;
      const tile = readTileFromClientPoint(event.clientX, event.clientY);
      if (gesture?.longPressTimer != null) {
        window.clearTimeout(gesture.longPressTimer);
      }
      if (!interactionLocked && gesture && !gesture.moved && tile) {
        const shouldHitTestUnits =
          !hexBuildPlacement &&
          !corridorPlacement &&          !colonizerPlacement?.active &&
          !unitTrainingPlacement &&
          !civilianMoveSelection &&
          !divisionMoveSelection &&
          !divisionAttackSelection;
        const unitHit = shouldHitTestUnits ? hitTestMapUnitAtClientPoint(event.clientX, event.clientY) : null;
        if (unitHit) {
          selectMapUnitForMovement(unitHit);
        } else {
          applyTileInteraction(tile);
        }
        const now = window.performance.now();
        const lastTap = lastTapRef.current;
        if (lastTap?.tileId === tile.id && now - lastTap.time < 320) {
          centerOnTile(tile);
        }
        lastTapRef.current = { tileId: tile.id, time: now };
      }
      activePointersRef.current.delete(event.pointerId);
      if (activePointersRef.current.size === 0) {
        pointerGestureRef.current = null;
      }
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }
    };
    const handleDoubleClick = (event: MouseEvent) => {
      if (interactionLocked || isMapNavigationBlocked(event.target)) return;
      centerOnTile(readTileFromClientPoint(event.clientX, event.clientY));
    };
    const handleWheel = (event: WheelEvent) => {
      if (interactionLocked || isMapNavigationBlocked(event.target)) return;
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const factor = event.deltaY > 0 ? 0.88 : 1.14;
      setCameraTarget((current) => zoomCameraToScreenPoint(current, rect, point, current.scale * factor, cameraBounds));
    };
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      const tile = readTileFromClientPoint(event.clientX, event.clientY);
      const selected = selectedMapUnit;
      const hasPlacementMode = Boolean(hexBuildPlacement || corridorPlacement || colonizerPlacement?.active || unitTrainingPlacement);
      if (tile && selected && !hasPlacementMode && !divisionMoveSelection && !divisionAttackSelection && !civilianMoveSelection) {
        if (selected.kind === "map") {
          const unit = mapUnitById.get(selected.unitId) ?? null;
          const targetMapUnits = mapUnitsByHexId.get(tile.id) ?? [];
          const enemyMapUnit = targetMapUnits.find((candidate) => unit && candidate.countryId !== unit.countryId) ?? null;
          const path = getCachedPreviewPath("land", selected.fromHexId, tile.id);
          const adjacentPath = findHexPath(mapArtifact, selected.fromHexId, tile.id, 2, tileById);
          const controller = worldBase?.hexOwner?.[tile.id] ?? worldBase?.regionController?.[tile.regionId] ?? worldBase?.regionOwner?.[tile.regionId] ?? null;
          const attackableByControl = Boolean(unit && controller && controller !== unit.countryId);
          if (unit && (enemyMapUnit || attackableByControl) && adjacentPath.length === 2) {
            onQueueUnitAttackOrder?.(selected.unitId, tile.id, enemyMapUnit?.id ?? null);
            setMapActionNotice(t("hexMap.unitAttackOrderSent"));
            return;
          }
          if (path.length > 1) {
            onQueueArmyMoveOrder?.(selected.unitId, tile.id, path);
            setMapActionNotice(t("hexMap.unitMoveOrderSent"));
            return;
          }
          setMapActionNotice(t("hexMap.unitMoveNoPath"));
          return;
        }
        if (selected.kind === "civilian") {
          const path = getCachedPreviewPath("land", selected.fromHexId, tile.id);
          if (path.length > 1) {
            onQueueCivilianUnitMoveOrder?.(selected.unitId, selected.fromHexId, tile.id, path);
            setMapActionNotice(t("hexMap.civilianMoveOrderSent"));
            return;
          }
          setMapActionNotice(t("hexMap.civilianMoveNoPath"));
          return;
        }
      }
      setSelectedBuildingPopoverHexId(null);
      setExpandedMapBuildingId(null);
      if (hexBuildPlacement) {
        onCancelHexBuildPlacement?.();
      }
      if (corridorPlacement) {
        onCancelCorridorPlacement?.();
      }
      if (colonizerPlacement?.active) {
        onCancelColonizerPlacement?.();
      }
      if (unitTrainingPlacement) {
        onCancelUnitTrainingPlacement?.();
      }
      setDivisionMoveSelection(null);
      setDivisionAttackSelection(null);
      setCivilianMoveSelection(null);
      setSelectedMapUnit(null);
    };
    const handleWindowPointerMove = (event: PointerEvent) => updatePointerTracking(event);
    const handlePointerLeave = () => {
      pointerRef.current = null;
      scheduleHoverState(null);
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("pointercancel", handlePointerUp);
    container.addEventListener("pointerleave", handlePointerLeave);
    container.addEventListener("dblclick", handleDoubleClick);
    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("pointermove", handleWindowPointerMove);
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("pointercancel", handlePointerUp);
      container.removeEventListener("pointerleave", handlePointerLeave);
      container.removeEventListener("dblclick", handleDoubleClick);
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("pointermove", handleWindowPointerMove);
      const gesture = pointerGestureRef.current;
      if (gesture?.longPressTimer != null) {
        window.clearTimeout(gesture.longPressTimer);
      }
      if (hoverFrameRef.current != null) {
        window.cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      pendingHoverRef.current = null;
      pointerGestureRef.current = null;
      activePointersRef.current.clear();
    };
  }, [applyTileInteraction, cameraBounds, centerOnTile, civilianMoveSelection, colonizerPlacement?.active, corridorPlacement, divisionAttackSelection, divisionMoveSelection, getCachedPreviewPath, hexBuildPlacement, hitTestMapUnitAtClientPoint, interactionLocked, mapArtifact, mapUnitById, mapUnitsByHexId, onCancelColonizerPlacement, onCancelCorridorPlacement, onCancelHexBuildPlacement, onCancelUnitTrainingPlacement, onQueueArmyMoveOrder, onQueueCivilianUnitMoveOrder, onQueueUnitAttackOrder, selectMapUnitForMovement, selectedMapUnit, serverMapArtifact, setCameraTarget, t, tileById, unitTrainingPlacement, worldBase?.hexOwner, worldBase?.regionController, worldBase?.regionOwner]);

  useEffect(() => {
    if (!hexBuildPlacement) return;
    const handleCancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onCancelHexBuildPlacement?.();
    };
    window.addEventListener("keydown", handleCancel);
    return () => window.removeEventListener("keydown", handleCancel);
  }, [hexBuildPlacement, onCancelHexBuildPlacement]);

  useEffect(() => {
    if (!corridorPlacement) return;
    const handleCancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onCancelCorridorPlacement?.();
    };
    window.addEventListener("keydown", handleCancel);
    return () => window.removeEventListener("keydown", handleCancel);
  }, [corridorPlacement, onCancelCorridorPlacement]);

  useEffect(() => {
    if (!colonizerPlacement?.active) return;
    const handleCancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onCancelColonizerPlacement?.();
    };
    window.addEventListener("keydown", handleCancel);
    return () => window.removeEventListener("keydown", handleCancel);
  }, [colonizerPlacement?.active, onCancelColonizerPlacement]);

  useEffect(() => {
    if (!civilianMoveSelection) return;
    const handleCancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCivilianMoveSelection(null);
      setSelectedMapUnit(null);
    };
    window.addEventListener("keydown", handleCancel);
    return () => window.removeEventListener("keydown", handleCancel);
  }, [civilianMoveSelection]);

  useEffect(() => {
    if (!divisionMoveSelection && !divisionAttackSelection) return;
    const handleCancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDivisionMoveSelection(null);
      setDivisionAttackSelection(null);
      setSelectedMapUnit(null);
    };
    window.addEventListener("keydown", handleCancel);
    return () => window.removeEventListener("keydown", handleCancel);
  }, [divisionAttackSelection, divisionMoveSelection]);

  useEffect(() => {
    if (!selectedBuildingPopoverHexId) return;
    const handleCancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedBuildingPopoverHexId(null);
      setExpandedMapBuildingId(null);
      setMapBuildingConfirm(null);
    };
    window.addEventListener("keydown", handleCancel);
    return () => window.removeEventListener("keydown", handleCancel);
  }, [selectedBuildingPopoverHexId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isMapNavigationBlocked(event.target)) return;
      const key = normalizeNavigationKey(event.key);
      if (!key) return;
      event.preventDefault();
      if (interactionLocked) return;
      if (key === "center") {
        setCameraTarget((current) => centerCameraOnWorldPoint(current, getMapWorldCenter(mapArtifact), cameraBounds));
        return;
      }
      pressedKeysRef.current.add(key);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const key = normalizeNavigationKey(event.key);
      if (key) {
        pressedKeysRef.current.delete(key);
      }
    };
    const handleBlur = () => pressedKeysRef.current.clear();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      pressedKeysRef.current.clear();
    };
  }, [cameraBounds, interactionLocked, mapArtifact, setCameraTarget]);

  useEffect(() => {
    const container = containerRef.current;
    let frameId = 0;
    let lastTime = window.performance.now();
    const frameSamples: number[] = [];
    const step = (now: number) => {
      const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      const frameMs = now - lastTime;
      lastTime = now;
      if (frameMs > 0) {
        frameSamples.push(frameMs);
        if (frameSamples.length > 180) frameSamples.shift();
        const averageFrameMs = frameSamples.reduce((sum, value) => sum + value, 0) / frameSamples.length;
        const stats = performanceStatsRef.current;
        stats.averageFrameMs = averageFrameMs;
        stats.fps = averageFrameMs > 0 ? 1000 / averageFrameMs : 0;
        stats.samples = frameSamples.length;
        window.__arcHexMapStats = { ...stats, viewport: { ...stats.viewport } };
      }
      if (container) {
        const rect = container.getBoundingClientRect();
        let nextTarget = cameraTargetRef.current;
        if (!interactionLocked) {
          const keyboardVelocity = calculateKeyboardVelocity(pressedKeysRef.current);
          const edgeVelocity = calculateEdgeScrollVelocity(pointerRef.current, rect, {
            enabled: edgeScrollEnabledRef.current,
            blocked: pointerRef.current?.blocked ?? true,
          });
          const velocityX = keyboardVelocity.x + edgeVelocity.x;
          const velocityY = keyboardVelocity.y + edgeVelocity.y;
          if (velocityX !== 0 || velocityY !== 0) {
            nextTarget = normalizeHexCamera(
              {
                ...nextTarget,
                x: nextTarget.x + (velocityX / nextTarget.scale) * deltaSeconds,
                y: nextTarget.y + (velocityY / nextTarget.scale) * deltaSeconds,
              },
              cameraBounds,
            );
          }
          const zoomDirection = calculateKeyboardZoomDirection(pressedKeysRef.current);
          if (zoomDirection !== 0) {
            nextTarget = zoomCameraToScreenPoint(
              nextTarget,
              rect,
              { x: rect.width / 2, y: rect.height / 2 },
              nextTarget.scale * Math.exp(zoomDirection * 1.65 * deltaSeconds),
              cameraBounds,
            );
          }
        }
        cameraTargetRef.current = nextTarget;
        const nextCamera = smoothCameraToward(cameraRef.current, nextTarget, cameraBounds, deltaSeconds);
        if (hasCameraChanged(cameraRef.current, nextCamera)) {
          cameraRef.current = nextCamera;
          setCamera(nextCamera);
          const nextViewportBounds = getViewportCullingBounds(mapArtifact, nextCamera, rect);
          const nextViewportKey = nextViewportBounds?.key ?? `all:${mapArtifact.tiles.length}`;
          if (nextViewportKey !== viewportCullingRef.current.key) {
            const nextViewport = getViewportCullingStateFromBounds(mapArtifact, tileSpatialIndex, nextViewportBounds);
            viewportCullingRef.current = nextViewport;
            setViewportCulling(nextViewport);
          }
        }
      }
      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [cameraBounds, interactionLocked, mapArtifact, tileSpatialIndex]);

  useEffect(() => {
    const app = appRef.current;
    const worldContainer = worldContainerRef.current;
    if (!pixiReady || !app || !app.renderer || !worldContainer) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (!rect) return;
    const terrainRenderer = terrainMeshRendererRef.current;
    const lensRenderer = lensOverlayRendererRef.current;
    if (terrainRenderer) {
      const visibleTerrainMeshes = terrainRenderer.updateVisibility(camera, rect);
      const visibleLensMeshes = lensRenderer?.updateVisibility(camera, rect) ?? 0;
      performanceStatsRef.current.visibleSprites = 0;
      performanceStatsRef.current.visibleTerrainMeshes = visibleTerrainMeshes;
      performanceStatsRef.current.visibleOverlayMeshes = visibleLensMeshes;
      performanceStatsRef.current.tiles = mapArtifact.tiles.length;
      performanceStatsRef.current.quality = FIXED_MAP_TEXTURE_QUALITY;
      performanceStatsRef.current.shaderActive = true;
      performanceStatsRef.current.viewport = { width: Math.round(rect.width), height: Math.round(rect.height) };
    }
    worldContainer.position.set(rect.width / 2 - camera.x * camera.scale, rect.height / 2 - camera.y * camera.scale);
    worldContainer.scale.set(camera.scale);
    safeRenderPixiApp(app);
  }, [camera, mapArtifact, pixiReady, tileById, wrapWidth]);

  useEffect(() => {
    const lensRenderer = lensOverlayRendererRef.current;
    const app = appRef.current;
    if (!pixiReady || !lensRenderer || !app || !app.renderer) return;
    lensRenderer.updateLens(activeLens, lensCells);
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      lensRenderer.updateVisibility(cameraRef.current, rect);
    }
    safeRenderPixiApp(app);
  }, [activeLens, lensCells, pixiReady]);

  useEffect(() => {
    const outlineLayer = mapLayerOutlineLayerRef.current;
    const app = appRef.current;
    if (!pixiReady || !outlineLayer || !app || !app.renderer) return;
    outlineLayer.clear();
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      drawMapLayerOutlines(outlineLayer, mapArtifact, tileById, worldBase, mapLayers, camera, rect, viewportCulling.visibleTileIds);
    }
    safeRenderPixiApp(app);
  }, [camera, mapArtifact, mapLayers, pixiReady, tileById, viewportCulling.key, viewportCulling.visibleTileIds, worldBase]);

  useEffect(() => {
    const overlayLayer = overlayLayerRef.current;
    const app = appRef.current;
    if (!pixiReady || !overlayLayer || !app || !app.renderer) return;
    overlayLayer.clear();
    if (hoverState?.tile) {
      drawHexOutline(overlayLayer, hoverState.tile, mapArtifact.settings.hexSize, 0xd7c38b, 1.4);
    }
    if (hexBuildPlacement && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const colors = getPlacementOverlayColors(containerRef.current);
      for (const [hexId, evaluation] of placementEvaluations.entries()) {
        if (!evaluation.valid) continue;
        const tile = tileById.get(hexId);
        if (!tile || !isTileInViewport(tile, camera, rect, mapArtifact.settings.hexSize)) continue;
        drawHexFillAndOutline(overlayLayer, tile, mapArtifact.settings.hexSize, colors.fill, colors.border);
      }
    }
    if (colonizerPlacement?.active && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const colors = getPlacementOverlayColors(containerRef.current);
      for (const hexId of colonizerPlacementValidHexIds) {
        const tile = tileById.get(hexId);
        if (!tile || !isTileInViewport(tile, camera, rect, mapArtifact.settings.hexSize)) continue;
        drawHexFillAndOutline(overlayLayer, tile, mapArtifact.settings.hexSize, colors.fill, colors.border);
      }
    }
    if (unitTrainingPlacement && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const colors = getPlacementOverlayColors(containerRef.current);
      for (const hexId of unitTrainingPlacementValidHexIds) {
        const tile = tileById.get(hexId);
        if (!tile || !isTileInViewport(tile, camera, rect, mapArtifact.settings.hexSize)) continue;
        drawHexFillAndOutline(overlayLayer, tile, mapArtifact.settings.hexSize, colors.fill, colors.border);
      }
    }
    if (selectedTile) {
      drawHexOutline(overlayLayer, selectedTile, mapArtifact.settings.hexSize, 0xf5d56b, 2.6);
    }
    if (selectedReachableHexIds.size > 0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      for (const hexId of selectedReachableHexIds) {
        const tile = tileById.get(hexId);
        if (!tile || !isTileInViewport(tile, camera, rect, mapArtifact.settings.hexSize)) continue;
        drawHexFillAndOutline(overlayLayer, tile, mapArtifact.settings.hexSize, 0x1a8aa0, 0x6ce6ff, 0.16, 1.2);
      }
    }
    const activePath = divisionMoveSelection
        ? divisionMoveHoverPath
        : civilianMoveSelection
          ? civilianMoveHoverPath
          : hoverPath;
    if (activePath.length > 1) {
      drawPathOverlay(overlayLayer, activePath, tileById, mapArtifact.settings.hexSize);
    }
    safeRenderPixiApp(app);
  }, [camera, civilianMoveHoverPath, civilianMoveSelection, colonizerPlacement?.active, colonizerPlacementValidHexIds, divisionMoveHoverPath, divisionMoveSelection, hexBuildPlacement, hoverPath, hoverState, mapArtifact.settings.hexSize, pixiReady, placementEvaluations, selectedReachableHexIds, selectedTile, tileById, unitTrainingPlacement, unitTrainingPlacementValidHexIds]);

  useEffect(() => {
    const layer = naturalFeatureLayerRef.current;
    const spritePool = naturalFeatureSpritePoolRef.current;
    const app = appRef.current;
    const container = containerRef.current;
    if (!pixiReady || !layer || !app || !app.renderer || !container || !mapLayers.features || zoomBucket === "far") {
      hideLayerPool(spritePool);
      return;
    }
    const rect = container.getBoundingClientRect();
    const size = mapArtifact.settings.hexSize;
    hideLayerPool(spritePool);
    const activeKeys = new Set<string>();
    let visibleSprites = 0;
    for (const tile of mapArtifact.tiles) {
      if (!resolveNaturalFeatureVisualId(tile)) continue;
      activeKeys.add(tile.id);
      if (!viewportCulling.visibleTileIds.has(tile.id) || !isTileInViewport(tile, camera, rect, size)) continue;
      const visible = updateNaturalFeatureSprite(getPooledSprite(layer, spritePool, tile.id), {
        tile,
        scenarioId,
        visualRules: mapFeatureVisuals,
        size,
        onReady: () => setFeatureTextureVersion((value) => value + 1),
      });
      if (!visible) continue;
      visibleSprites += 1;
    }
    pruneLayerPool(spritePool, activeKeys);
    performanceStatsRef.current.visibleSprites += visibleSprites;
    safeRenderPixiApp(app);
  }, [camera, featureTextureVersion, mapArtifact.settings.hexSize, mapArtifact.tiles, mapFeatureVisuals, mapLayers.features, pixiReady, scenarioId, viewportCulling.key, viewportCulling.visibleTileIds, zoomBucket]);

  useEffect(() => {
    const layer = siteFeatureLayerRef.current;
    const spritePool = siteFeatureSpritePoolRef.current;
    const app = appRef.current;
    const container = containerRef.current;
    if (!pixiReady || !layer || !app || !app.renderer || !container || !mapLayers.features || zoomBucket === "far") {
      hideLayerPool(spritePool);
      return;
    }
    const rect = container.getBoundingClientRect();
    const size = mapArtifact.settings.hexSize;
    hideLayerPool(spritePool);
    const activeKeys = new Set<string>();
    let visibleSprites = 0;
    for (const feature of mapFeatures) {
      activeKeys.add(feature.id);
      const tile = tileById.get(feature.hexId);
      if (!tile || !viewportCulling.visibleTileIds.has(tile.id) || !isTileInViewport(tile, camera, rect, size)) continue;
      const visible = updateSiteFeatureSprite(getPooledSprite(layer, spritePool, feature.id), {
        feature,
        tile,
        scenarioId,
        visualRules: mapFeatureVisuals,
        size,
        onReady: () => setFeatureTextureVersion((value) => value + 1),
      });
      if (!visible) continue;
      visibleSprites += 1;
    }
    pruneLayerPool(spritePool, activeKeys);
    performanceStatsRef.current.visibleSprites += visibleSprites;
    safeRenderPixiApp(app);
  }, [camera, featureTextureVersion, mapArtifact.settings.hexSize, mapFeatureVisuals, mapFeatures, mapLayers.features, pixiReady, scenarioId, tileById, viewportCulling.key, viewportCulling.visibleTileIds, zoomBucket]);

  useEffect(() => {
    const layer = resourceDepositLayerRef.current;
    const spritePool = resourceDepositSpritePoolRef.current;
    const app = appRef.current;
    const container = containerRef.current;
    if (!pixiReady || !layer || !app || !app.renderer || !container || !mapLayers.resources || !worldBase || zoomBucket === "far") {
      hideLayerPool(spritePool);
      return;
    }
    const rect = container.getBoundingClientRect();
    const size = mapArtifact.settings.hexSize;
    hideLayerPool(spritePool);
    const activeKeys = new Set<string>(resourceDepositsByHexId.keys());
    let visibleSprites = 0;
    for (const hexId of viewportCulling.visibleTileIds) {
      const deposit = resourceDepositsByHexId.get(hexId);
      if (!deposit) continue;
      const tile = tileById.get(hexId);
      if (!tile || !isTileInViewport(tile, camera, rect, size)) continue;
      const visible = updateResourceDepositSprite(getPooledSprite(layer, spritePool, hexId), {
        deposit,
        tile,
        scenarioId,
        size,
        cameraScale: camera.scale,
        onReady: () => setResourceDepositTextureVersion((value) => value + 1),
      });
      if (!visible) continue;
      visibleSprites += 1;
    }
    pruneLayerPool(spritePool, activeKeys);
    performanceStatsRef.current.visibleSprites += visibleSprites;
    safeRenderPixiApp(app);
  }, [camera, mapArtifact.settings.hexSize, mapLayers.resources, pixiReady, resourceDepositTextureVersion, resourceDepositsByHexId, scenarioId, tileById, viewportCulling.key, viewportCulling.visibleTileIds, worldBase, zoomBucket]);

  useEffect(() => {
    const layer = corridorPersistentLayerRef.current;
    const app = appRef.current;
    if (!pixiReady || !layer || !app || !app.renderer) return;
    layer.removeChildren().forEach((child) => child.destroy());
    const size = mapArtifact.settings.hexSize;
    const textures = getCorridorAtlasTextures({
      scenarioId,
      onReady: () => setCorridorTextureVersion((value) => value + 1),
    });
    if (!textures) {
      safeRenderPixiApp(app);
      return;
    }
    const corridorTileLayers = new Map<string, Map<HexId, number>>();
    for (const corridor of transportCorridors) {
      const path = normalizeCorridorPath(corridor.computedHexIds && corridor.computedHexIds.length >= 2 ? corridor.computedHexIds : corridor.hexIds);
      addCorridorPathMasks(corridorTileLayers, path, tileById, mapArtifact.settings, corridor.transportMode, getCorridorAtlasStatus(corridor));
    }
    drawTexturedCorridorTiles(layer, corridorTileLayers, tileById, size, textures, false, 1, viewportCulling.visibleTileIds);
    safeRenderPixiApp(app);
  }, [corridorTextureVersion, mapArtifact.settings, mapArtifact.settings.hexSize, pixiReady, scenarioId, tileById, transportCorridors, viewportCulling.key, viewportCulling.visibleTileIds]);

  useEffect(() => {
    const layer = corridorPreviewLayerRef.current;
    const app = appRef.current;
    if (!pixiReady || !layer || !app || !app.renderer) return;
    layer.removeChildren().forEach((child) => child.destroy());
    const size = mapArtifact.settings.hexSize;
    const textures = getCorridorAtlasTextures({
      scenarioId,
      onReady: () => setCorridorTextureVersion((value) => value + 1),
    });
    if (!textures) {
      safeRenderPixiApp(app);
      return;
    }
    const previewTransportMode = corridorPlacement?.transportMode ?? "land";
    if (corridorFixedPreviewPath.length > 1) {
      const previewTileLayers = new Map<string, Map<HexId, number>>();
      addCorridorPathMasks(previewTileLayers, corridorFixedPreviewPath, tileById, mapArtifact.settings, previewTransportMode, "planned");
      drawTexturedCorridorTiles(layer, previewTileLayers, tileById, size, textures, true, 1, viewportCulling.visibleTileIds);
    }
    if (corridorDraftPreviewPath.length > 1) {
      const draftTileLayers = new Map<string, Map<HexId, number>>();
      addCorridorPathMasks(draftTileLayers, corridorDraftPreviewPath, tileById, mapArtifact.settings, previewTransportMode, "planned");
      drawTexturedCorridorTiles(layer, draftTileLayers, tileById, size, textures, true, 0.62, viewportCulling.visibleTileIds);
    }
    safeRenderPixiApp(app);
  }, [corridorDraftPreviewPath, corridorFixedPreviewPath, corridorPlacement?.transportMode, corridorTextureVersion, mapArtifact.settings, mapArtifact.settings.hexSize, pixiReady, scenarioId, tileById, viewportCulling.key, viewportCulling.visibleTileIds]);

  useEffect(() => {
    const layer = buildingLayerRef.current;
    const spritePool = buildingSpritePoolRef.current;
    const graphicsPool = buildingGraphicsPoolRef.current;
    const app = appRef.current;
    const showBuildings = mapLayers.buildings || Boolean(hexBuildPlacement);
    if (!pixiReady || !layer || !app || !worldBase || !showBuildings || zoomBucket === "far") {
      hideLayerPool(spritePool);
      hideLayerPool(graphicsPool);
      return;
    }
    hideLayerPool(spritePool);
    hideLayerPool(graphicsPool);
    const activeSpriteKeys = new Set<string>();
    const activeGraphicsKeys = new Set<string>();
    const size = mapArtifact.settings.hexSize;
    const styles = getComputedStyle(document.documentElement);
    const workingMarkerColor = cssColorToHexNumber(
      styles.getPropertyValue("--arc-map-building-marker-working").trim(),
      0xd8c27a,
    );
    const constructionMarkerColor = cssColorToHexNumber(
      styles.getPropertyValue("--arc-map-building-marker-construction").trim(),
      0x7e4cc2,
    );
    const markerStrokeColor = cssColorToHexNumber(
      styles.getPropertyValue("--arc-map-building-marker-stroke").trim(),
      0x261433,
    );
    const addMarker = (
      key: string,
      hexId: string | undefined,
      buildingId: string,
      state: BuildingAtlasState,
    ) => {
      if (!hexId) return;
      activeSpriteKeys.add(key);
      activeGraphicsKeys.add(key);
      const tile = tileById.get(hexId as HexId);
      if (!tile || !viewportCulling.visibleTileIds.has(tile.id)) return;
      const center = axialToPixel(tile, size);
      const textures = getBuildingAtlasTextures({
        scenarioId,
        buildingId,
        onReady: () => setBuildingTextureVersion((value) => value + 1),
      });
      const texture = textures?.[state];
      if (texture) {
        destroyPoolItem(graphicsPool, key);
        const sprite = getPooledSprite(layer, spritePool, key);
        sprite.texture = texture;
        sprite.anchor.set(0.5, 0.68);
        sprite.position.set(center.x, center.y + size * 0.12);
        const markerSize = Math.max(size * 0.72, Math.min(size * 1.25, 34 / Math.max(0.35, camera.scale)));
        sprite.width = markerSize;
        sprite.height = markerSize;
        sprite.visible = true;
        return;
      }
      destroyPoolItem(spritePool, key);
      const marker = getPooledGraphics(layer, graphicsPool, key);
      marker
        .circle(center.x, center.y, Math.max(3, size * 0.28))
        .fill({ color: state === "working" || state === "ruins" ? workingMarkerColor : constructionMarkerColor, alpha: 0.86 });
      marker.circle(center.x, center.y, Math.max(3, size * 0.28)).stroke({ color: markerStrokeColor, width: 1.2, alpha: 0.9 });
      marker.visible = true;
    };
    const addCityMarker = (
      key: string,
      hexId: string | undefined,
      cultureId: string,
      state: CityAtlasState,
      progress?: { current: number; total: number } | null,
    ) => {
      if (!hexId) return;
      activeSpriteKeys.add(key);
      activeGraphicsKeys.add(key);
      const tile = tileById.get(hexId as HexId);
      if (!tile || !viewportCulling.visibleTileIds.has(tile.id)) return;
      const center = axialToPixel(tile, size);
      const textures = getCityAtlasTextures({
        scenarioId,
        cultureId,
        onReady: () => setBuildingTextureVersion((value) => value + 1),
      });
      const texture = textures?.[state];
      if (texture) {
        destroyPoolItem(graphicsPool, key);
        const sprite = getPooledSprite(layer, spritePool, key);
        sprite.texture = texture;
        sprite.anchor.set(0.5, 0.72);
        sprite.position.set(center.x, center.y + size * 0.1);
        const markerSize = getHexFillSpriteSize(size, 1.84);
        sprite.width = markerSize;
        sprite.height = markerSize;
        sprite.visible = true;
      } else {
        destroyPoolItem(spritePool, key);
        const marker = getPooledGraphics(layer, graphicsPool, key);
        marker
          .rect(center.x - size * 0.22, center.y - size * 0.34, size * 0.44, size * 0.44)
          .fill({ color: state === "working" || state === "ruins" ? workingMarkerColor : constructionMarkerColor, alpha: 0.9 });
        marker
          .rect(center.x - size * 0.22, center.y - size * 0.34, size * 0.44, size * 0.44)
          .stroke({ color: markerStrokeColor, width: 1.2, alpha: 0.9 });
        marker.visible = true;
      }
      const progressKey = `${key}:progress`;
      if (progress && progress.total > 0 && state === "underConstruction") {
        activeGraphicsKeys.add(progressKey);
        const pct = Math.max(0, Math.min(1, progress.current / progress.total));
        const bar = getPooledGraphics(layer, graphicsPool, progressKey);
        const width = Math.max(12, size * 0.72);
        const height = Math.max(2, size * 0.06);
        bar
          .rect(center.x - width / 2, center.y + size * 0.34, width, height)
          .fill({ color: markerStrokeColor, alpha: 0.72 });
        bar
          .rect(center.x - width / 2, center.y + size * 0.34, width * pct, height)
          .fill({ color: constructionMarkerColor, alpha: 0.96 });
        bar.visible = true;
      }
    };
    for (const [regionId, queue] of Object.entries(worldBase.regionConstructionQueueByRegion)) {
      for (const project of queue ?? []) {
        if (canceledConstructionQueueKeySet.has(`${regionId}:${project.queueId}`)) continue;
        if ((project.projectType ?? "build") === "build") addMarker(`building:queue:${regionId}:${project.queueId}`, project.targetHexId, project.buildingId, "underConstruction");
      }
    }
    for (const marker of pendingBuildMarkers) {
      addMarker(`building:pending:${marker.countryId}:${marker.targetHexId}:${marker.buildingId}`, marker.targetHexId, marker.buildingId, "underConstruction");
    }
    for (const instances of Object.values(worldBase.regionBuildingsByRegion)) {
      for (const instance of instances ?? []) {
        addMarker(`building:instance:${instance.instanceId}`, instance.targetHexId, instance.buildingId, getBuildingMapVisualState(instance));
      }
    }
    for (const project of Object.values(worldBase.settlementProjectsById ?? {})) {
      if (project.state === "completed" || project.state === "canceled") continue;
      addCityMarker(`city:project:${project.id}`, project.targetHexId, project.cultureId, project.visualState, {
        current: project.progressColonization,
        total: project.costColonization,
      });
    }
    for (const marker of Object.values(worldBase.cityMarkersById ?? {})) {
      addCityMarker(`city:marker:${marker.id}`, marker.targetHexId, marker.cultureId, marker.visualState);
    }
    for (const marker of pendingFoundCityMarkers) {
      addCityMarker(`city:pending:${marker.civilianUnitId}:${marker.targetHexId}`, marker.targetHexId, marker.cultureId, "underConstruction", { current: 0, total: 1 });
    }
    pruneLayerPool(spritePool, activeSpriteKeys);
    pruneLayerPool(graphicsPool, activeGraphicsKeys);
    safeRenderPixiApp(app);
  }, [buildingTextureVersion, camera.scale, canceledConstructionQueueKeySet, hexBuildPlacement, mapArtifact.settings.hexSize, mapLayers.buildings, pendingBuildMarkers, pendingFoundCityMarkers, pixiReady, scenarioId, tileById, viewportCulling.key, viewportCulling.visibleTileIds, worldBase, zoomBucket]);

  useEffect(() => {
    const layer = unitLayerRef.current;
    const spritePool = unitSpritePoolRef.current;
    const graphicsPool = unitGraphicsPoolRef.current;
    const app = appRef.current;
    if (!pixiReady || !layer || !app || !worldBase || !mapLayers.armies) {
      hideLayerPool(spritePool);
      hideLayerPool(graphicsPool);
      return;
    }
    hideLayerPool(spritePool);
    hideLayerPool(graphicsPool);
    const activeSpriteKeys = new Set<string>();
    const activeGraphicsKeys = new Set<string>();
    const size = mapArtifact.settings.hexSize;
    const styles = getComputedStyle(document.documentElement);
    const strokeColor = cssColorToHexNumber(styles.getPropertyValue("--arc-map-building-marker-stroke").trim(), 0x261433);
    for (const unit of Object.values(worldBase.unitsById ?? {})) {
      if (unit.status === "destroyed" || unit.status === "captured" || pendingFoundCityUnitIds.has(unit.id)) continue;
      const key = `map-unit:${unit.id}`;
      activeSpriteKeys.add(key);
      const tile = tileById.get(unit.hexId);
      if (!tile || !viewportCulling.visibleTileIds.has(tile.id)) continue;
      updateMapUnitSprite(getPooledSprite(layer, spritePool, key), {
        unit,
        tile,
        scenarioId,
        size,
        cameraScale: camera.scale,
        tintColor: cssColorToHexNumber(countryColorById?.[unit.countryId] ?? "", 0xffffff),
        onReady: () => setUnitTextureVersion((value) => value + 1),
      });
    }
    for (const unit of Object.values(worldBase.civilianUnitsById ?? {})) {
      if (unit.status === "captured" || pendingFoundCityUnitIds.has(unit.id)) continue;
      const key = `civilian:${unit.id}`;
      activeGraphicsKeys.add(key);
      const tile = tileById.get(unit.hexId);
      if (!tile || !viewportCulling.visibleTileIds.has(tile.id)) continue;
      const center = axialToPixel(tile, size);
      const fillColor = cssColorToHexNumber(countryColorById?.[unit.countryId] ?? "", 0xd8c27a);
      const marker = getPooledGraphics(layer, graphicsPool, key);
      const radius = Math.max(size * 0.18, Math.min(size * 0.34, 12 / Math.max(0.35, camera.scale)));
      marker
        .circle(center.x + size * 0.22, center.y - size * 0.28, radius)
        .fill({ color: fillColor, alpha: 0.94 });
      marker
        .circle(center.x + size * 0.22, center.y - size * 0.28, radius)
        .stroke({ color: strokeColor, width: 1.4, alpha: 0.94 });
      marker
        .moveTo(center.x + size * 0.17, center.y - size * 0.36)
        .lineTo(center.x + size * 0.17, center.y - size * 0.19)
        .stroke({ color: strokeColor, width: 1.5, alpha: 0.94 });
      marker
        .moveTo(center.x + size * 0.18, center.y - size * 0.34)
        .lineTo(center.x + size * 0.3, center.y - size * 0.3)
        .lineTo(center.x + size * 0.18, center.y - size * 0.27)
        .fill({ color: 0xf3ead2, alpha: 0.9 });
      marker.visible = true;
    }
    pruneLayerPool(spritePool, activeSpriteKeys);
    pruneLayerPool(graphicsPool, activeGraphicsKeys);
    safeRenderPixiApp(app);
  }, [camera.scale, countryColorById, mapArtifact.settings.hexSize, mapLayers.armies, pendingFoundCityUnitIds, pixiReady, scenarioId, tileById, unitTextureVersion, viewportCulling.key, viewportCulling.visibleTileIds, worldBase]);

  const selectedBuildingPopoverTile = selectedBuildingPopoverHexId ? tileById.get(selectedBuildingPopoverHexId) ?? null : null;
  const selectedBuildingPopoverStyle = useMemo<CSSProperties | null>(() => {
    if (!selectedBuildingPopoverTile || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const center = axialToPixel(selectedBuildingPopoverTile, mapArtifact.settings.hexSize);
    const x = rect.width / 2 + (center.x - camera.x) * camera.scale;
    const y = rect.height / 2 + (center.y - camera.y) * camera.scale;
    return {
      left: Math.min(Math.max(12, x + 18), Math.max(12, rect.width - 390)),
      top: Math.min(Math.max(92, y - 24), Math.max(92, rect.height - 520)),
    };
  }, [camera, mapArtifact.settings.hexSize, selectedBuildingPopoverTile]);
  const countryById = useMemo(() => new Map(buildingOverviewCountries.map((country) => [country.id, country] as const)), [buildingOverviewCountries]);
  const cityLabels = useMemo(() => {
    if (!containerRef.current || !mapLayers.buildings || zoomBucket !== "near") return [];
    const rect = containerRef.current.getBoundingClientRect();
    const labels: Array<{
      key: string;
      name: string;
      ownerName: string;
      flagUrl: string | null;
      left: number;
      top: number;
      progress: number | null;
      pending: boolean;
    }> = [];
    const addLabel = (input: {
      key: string;
      hexId: HexId;
      name: string;
      countryId: string;
      progress?: { current: number; total: number } | null;
      pending?: boolean;
    }) => {
      const tile = tileById.get(input.hexId);
      if (!tile || !isTileInViewport(tile, camera, rect, mapArtifact.settings.hexSize)) return;
      const center = axialToPixel(tile, mapArtifact.settings.hexSize);
      const x = rect.width / 2 + (center.x - camera.x) * camera.scale;
      const y = rect.height / 2 + (center.y - camera.y) * camera.scale - Math.max(28, mapArtifact.settings.hexSize * camera.scale * 0.72);
      const country = countryById.get(input.countryId);
      const width = 176;
      labels.push({
        key: input.key,
        name: input.name,
        ownerName: country?.name ?? countryNameById?.[input.countryId] ?? input.countryId,
        flagUrl: country?.flagUrl ?? null,
        left: Math.min(Math.max(8, x - width / 2), Math.max(8, rect.width - width - 8)),
        top: Math.min(Math.max(92, y), Math.max(92, rect.height - 54)),
        progress: input.progress && input.progress.total > 0 ? Math.max(0, Math.min(1, input.progress.current / input.progress.total)) : null,
        pending: Boolean(input.pending),
      });
    };
    for (const project of Object.values(worldBase?.settlementProjectsById ?? {})) {
      if (project.state === "completed" || project.state === "canceled") continue;
      addLabel({
        key: project.id,
        hexId: project.targetHexId,
        name: project.name || t("hexMap.cityPendingNameFallback"),
        countryId: project.countryId,
        progress: { current: project.progressColonization, total: project.costColonization },
      });
    }
    for (const marker of Object.values(worldBase?.cityMarkersById ?? {})) {
      addLabel({
        key: marker.id,
        hexId: marker.targetHexId,
        name: marker.name || t("hexMap.cityPendingNameFallback"),
        countryId: marker.ownerCountryId || marker.countryId,
        progress: null,
      });
    }
    for (const marker of pendingFoundCityMarkers) {
      addLabel({
        key: `pending:${marker.civilianUnitId}`,
        hexId: marker.targetHexId,
        name: marker.name,
        countryId: marker.countryId,
        progress: { current: 0, total: 1 },
        pending: true,
      });
    }
    return labels;
  }, [camera, countryById, countryNameById, mapArtifact.settings.hexSize, mapLayers.buildings, pendingFoundCityMarkers, t, tileById, worldBase?.cityMarkersById, worldBase?.settlementProjectsById, zoomBucket]);

  const foundCityName = foundCityNameDraft.trim();
  const foundCityNameValid = foundCityName.length > 0 && foundCityName.length <= 32;
  const confirmFoundCity = useCallback(() => {
    if (!foundCityConfirmTarget || !foundCityNameValid) return;
    onFoundCityOrder?.(
      foundCityConfirmTarget.civilianUnitId,
      foundCityConfirmTarget.hexId,
      foundCityConfirmTarget.regionId,
      foundCityName,
      foundCityConfirmTarget.countryId,
    );
    setFoundCityConfirmTarget(null);
    setFoundCityNameDraft("");
  }, [foundCityConfirmTarget, foundCityName, foundCityNameValid, onFoundCityOrder]);

  const runMapBuiltAction = async (action: string, item: OverviewItem, task: () => Promise<void>) => {
    if (!item.instance || !buildingOverviewToken) return;
    setMapBuildingBusyAction(`${action}:${item.id}`);
    try {
      await task();
    } finally {
      setMapBuildingBusyAction(null);
    }
  };

  const toggleMapBuildingFlag = async (
    item: OverviewItem,
    flag: "autoUpgradeEnabled" | "stateSubsidiesEnabled" | "manualWorkEnabled",
    next: boolean,
  ) => {
    if (!item.instance || !buildingOverviewToken) return;
    await runMapBuiltAction(flag, item, async () => {
      try {
        if (flag === "autoUpgradeEnabled") {
          await setCountryBuildAutoUpgradeState(buildingOverviewToken, {
            regionId: item.regionId,
            buildingId: item.buildingId,
            instanceId: item.instance?.instanceId,
            enabled: next,
          });
          toast.success(t(next ? "buildings.toastAutoUpgradeEnabled" : "buildings.toastAutoUpgradeDisabled"));
        } else if (flag === "stateSubsidiesEnabled") {
          await setCountryBuildSubsidyState(buildingOverviewToken, {
            regionId: item.regionId,
            buildingId: item.buildingId,
            instanceId: item.instance?.instanceId,
            enabled: next,
          });
          toast.success(t(next ? "buildings.toastSubsidiesEnabled" : "buildings.toastSubsidiesDisabled"));
        } else {
          await setCountryBuildManualWorkState(buildingOverviewToken, {
            regionId: item.regionId,
            buildingId: item.buildingId,
            instanceId: item.instance?.instanceId,
            enabled: next,
          });
          toast.success(t(next ? "buildings.toastManualWorkEnabled" : "buildings.toastManualWorkDisabled"));
        }
      } catch {
        const key =
          flag === "autoUpgradeEnabled"
            ? "buildings.toastAutoUpgradeFailed"
            : flag === "stateSubsidiesEnabled"
              ? "buildings.toastSubsidiesFailed"
              : "buildings.toastManualWorkFailed";
        toast.error(t(key));
      }
    });
  };

  const upgradeMapBuilding = async (item: OverviewItem) => {
    if (!item.instance || !buildingOverviewToken) return;
    await runMapBuiltAction("upgrade", item, async () => {
      try {
        const result = await upgradeCountryBuildState(buildingOverviewToken, {
          regionId: item.regionId,
          buildingId: item.buildingId,
          instanceId: item.instance?.instanceId,
        });
        toast.success(t("buildings.toastUpgradeQueued", { current: result.currentLevel, target: result.targetLevel }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "BUILD_UPGRADE_STATE_FAILED";
        if (message === "BUILDING_MAX_LEVEL_REACHED") toast.error(t("buildings.toastUpgradeMaxReached"));
        else if (message === "INSUFFICIENT_DUCATS") toast.error(t("buildings.toastUpgradeInsufficientDucats"));
        else if (message === "BUILDING_UPGRADE_ALREADY_QUEUED") toast.error(t("buildings.toastUpgradeAlreadyQueued"));
        else toast.error(t("buildings.toastUpgradeFailed"));
      }
    });
  };

  const saveMapBuildingRename = async (item: OverviewItem) => {
    if (!item.instance || !buildingOverviewToken) return;
    const draft = mapBuildingRenameDraftById[item.id] ?? item.customName ?? "";
    await runMapBuiltAction("rename", item, async () => {
      try {
        const result = await setCountryBuildCustomName(buildingOverviewToken, {
          regionId: item.regionId,
          buildingId: item.buildingId,
          instanceId: item.instance?.instanceId,
          customName: draft.trim() || null,
        });
        toast.success(t(result.customName ? "buildings.toastRenameUpdated" : "buildings.toastRenameReset"));
      } catch {
        toast.error(t("buildings.toastRenameFailed"));
      }
    });
  };

  const confirmMapBuildingDanger = async () => {
    if (!mapBuildingConfirm) return;
    if (mapBuildingConfirm.type === "cancel") {
      onCancelConstructionProject?.(mapBuildingConfirm.payload);
      setMapBuildingConfirm(null);
      return;
    }
    const item = mapBuildingConfirm.item;
    if (!item.instance || !buildingOverviewToken) return;
    setMapBuildingBusyAction(`demolish:${item.id}`);
    try {
      const result = await demolishCountryBuild(buildingOverviewToken, {
        regionId: item.regionId,
        buildingId: item.buildingId,
        instanceId: item.instance.instanceId,
      });
      toast.success(t("buildings.toastDemolished", { cost: result.demolitionCostConstruction }));
      setMapBuildingConfirm(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "BUILD_DEMOLISH_FAILED";
      if (message === "INSUFFICIENT_CONSTRUCTION_POINTS") toast.error(t("buildings.toastDemolishInsufficientConstruction"));
      else if (message === "BUILDING_INSTANCE_NOT_FOUND") toast.error(t("buildings.toastDemolishNotFound"));
      else toast.error(t("buildings.toastDemolishFailed"));
    } finally {
      setMapBuildingBusyAction(null);
    }
  };

  return (
    <div className="arc-hex-map">
      <div ref={containerRef} className="arc-hex-map__surface" />
      {!serverMapArtifact && !mapLoadError ? (
        <div className="arc-hex-map__render-error arc-hud-panel" role="status">
          <strong>{t("hexMap.loadingTitle")}</strong>
          <span>{t("hexMap.loadingDescription")}</span>
        </div>
      ) : null}
      {mapLoadError ? (
        <div className="arc-hex-map__render-error arc-hud-panel" role="alert">
          <strong>{t("hexMap.artifactErrorTitle")}</strong>
          <span>{t("hexMap.artifactErrorDescription")}</span>
        </div>
      ) : null}
      {mapRenderError ? (
        <div className="arc-hex-map__render-error arc-hud-panel" role="alert">
          <strong>{t("hexMap.renderErrorTitle")}</strong>
          <span>{t("hexMap.renderErrorDescription")}</span>
        </div>
      ) : null}
      {showStatsPanel ? (
        <div className="arc-hex-map__stats arc-hud-panel">
          <div className="arc-hud-content">
            <div className="arc-hex-map__stats-title">{t("hexMap.title")}</div>
            <div className="arc-hex-map__stats-grid">
              <span>{t("hexMap.renderer")}</span>
              <strong>{t("hexMap.pixiRenderer")}</strong>
              <span>{t("hexMap.tiles")}</span>
              <strong>{mapArtifact.tiles.length.toLocaleString()}</strong>
              <span>{t("hexMap.seed")}</span>
              <strong>{mapArtifact.settings.seed}</strong>
            </div>
          </div>
        </div>
      ) : null}
      {showZoomIndicator ? (
        <div
          className={`arc-hud-panel pointer-events-none absolute left-4 z-30 rounded-xl p-1.5 ${showMapControls ? "bottom-24" : "bottom-4"}`}
          aria-label={t("map.zoomIndicator.label")}
        >
          <div className="arc-hud-chip relative z-10 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="font-semibold text-[var(--arc-color-text-muted)]">{t("map.zoomIndicator.label")}</span>
            <strong className="text-[var(--arc-color-text)]">{formattedZoom}</strong>
          </div>
        </div>
      ) : null}
      {showMapControls ? (
        <MapControlsHud
          view={{ lng: camera.x, lat: camera.y }}
          interactionLocked={interactionLocked}
          edgeScrollEnabled={edgeScrollEnabled}
          onZoomIn={() => setCameraTarget((current) => ({ ...current, scale: clampScale(current.scale * 1.16, cameraBounds) }))}
          onZoomOut={() => setCameraTarget((current) => ({ ...current, scale: clampScale(current.scale * 0.86, cameraBounds) }))}
          onResetView={() => setCameraTarget(DEFAULT_CAMERA)}
          onToggleInteraction={() => setInteractionLocked((value) => !value)}
          onToggleEdgeScroll={() => {
            const next = !edgeScrollEnabledRef.current;
            edgeScrollEnabledRef.current = next;
            setEdgeScrollEnabled(next);
            writeMapNavigationSettings(authCountryId, { edgeScrollEnabled: next });
          }}
        />
      ) : null}
      {serverMapArtifact ? (
          <MapLensHud
          layers={layerOptions}
          lenses={lensOptions}
          activeLensId={activeLens}
          legend={lensLegend}
          onLayerToggle={handleLayerToggle}
          onLensChange={handleLensChange}
        />
      ) : null}
      {mapActionNotice ? (
        <div className="arc-map-mode-notice arc-hud-panel" role="status">
          <div className="arc-hud-content">{mapActionNotice}</div>
        </div>
      ) : null}
      {hexBuildPlacement ? (
        <div className="arc-map-build-placement-hud arc-hud-panel" role="status">
          <div className="arc-hud-content">
            <strong>{hexBuildPlacement.building.name ?? hexBuildPlacement.building.id}</strong>
            <span>{t("buildings.hexPlacementHud")}</span>
            <button type="button" className="map-btn" onClick={onCancelHexBuildPlacement}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : null}
      {colonizerPlacement?.active ? (
        <div className="arc-map-build-placement-hud arc-hud-panel" role="status">
          <div className="arc-hud-content">
            <strong>{t("shell.colonization.prepareColonizer")}</strong>
            <span>{t("shell.colonization.selectPreparationHex")}</span>
            <button type="button" className="map-btn" onClick={() => onCancelColonizerPlacement?.()}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : null}
      {unitTrainingPlacement ? (
        <div className="arc-map-build-placement-hud arc-hud-panel" role="status">
          <div className="arc-hud-content">
            <strong>{t(unitTrainingPlacement.unitType.nameKey)}</strong>
            <span>{t("hexMap.unitTrainingPlacementHud")}</span>
            <button type="button" className="map-btn" onClick={() => onCancelUnitTrainingPlacement?.()}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : null}
      {selectedMapBuildingItem && selectedBuildingPopoverStyle ? (
        <section
          className="arc-map-building-popover"
          style={selectedBuildingPopoverStyle}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <BuildingOverviewCard
            item={selectedMapBuildingItem}
            goodsById={goodsById}
            scenarioId={scenarioId}
            expanded={expandedMapBuildingId === selectedMapBuildingItem.id}
            busyAction={mapBuildingBusyAction}
            canceling={buildingOverviewCancelingConstructionQueueKey === getCancelKey(selectedMapBuildingItem)}
            renameDraft={mapBuildingRenameDraftById[selectedMapBuildingItem.id] ?? selectedMapBuildingItem.customName ?? ""}
            editingName={mapBuildingEditingNameId === selectedMapBuildingItem.id}
            onStartRename={() => {
              if (selectedMapBuildingItem.kind !== "built") return;
              setMapBuildingRenameDraftById((current) => ({
                ...current,
                [selectedMapBuildingItem.id]: current[selectedMapBuildingItem.id] ?? selectedMapBuildingItem.customName ?? "",
              }));
              setMapBuildingEditingNameId(selectedMapBuildingItem.id);
            }}
            onRenameDraftChange={(value) => setMapBuildingRenameDraftById((current) => ({ ...current, [selectedMapBuildingItem.id]: value }))}
            onFinishRename={() => {
              setMapBuildingEditingNameId(null);
              void saveMapBuildingRename(selectedMapBuildingItem);
            }}
            onCancelRename={() => setMapBuildingEditingNameId(null)}
            onToggleExpanded={() => setExpandedMapBuildingId((current) => (current === selectedMapBuildingItem.id ? null : selectedMapBuildingItem.id))}
            onFocusHex={() => centerOnTile(tileById.get(selectedMapBuildingItem.targetHexId) ?? null)}
            onCancelProject={() => {
              const payload = getCancelPayload(selectedMapBuildingItem);
              if (payload) setMapBuildingConfirm({ type: "cancel", item: selectedMapBuildingItem, payload });
            }}
            onDemolish={() => setMapBuildingConfirm({ type: "demolish", item: selectedMapBuildingItem })}
            onUpgrade={() => void upgradeMapBuilding(selectedMapBuildingItem)}
            onToggleAutoUpgrade={(next) => void toggleMapBuildingFlag(selectedMapBuildingItem, "autoUpgradeEnabled", next)}
            onToggleSubsidies={(next) => void toggleMapBuildingFlag(selectedMapBuildingItem, "stateSubsidiesEnabled", next)}
            onToggleManualWork={(next) => void toggleMapBuildingFlag(selectedMapBuildingItem, "manualWorkEnabled", next)}
          />
        </section>
      ) : null}
      {hoverState && !selectedMapBuildingItem ? (
        <GamePlotTooltipPositioner
          open
          anchor={{ x: hoverState.x, y: hoverState.y }}
        >
          <GamePlotTooltipCard data={buildHexPlotTooltipData(hoverState.tile)} density="compact" />
        </GamePlotTooltipPositioner>
      ) : null}
      <FoundCityConfirmDialog
        target={foundCityConfirmTarget}
        nameDraft={foundCityNameDraft}
        nameValid={foundCityNameValid}
        onNameChange={setFoundCityNameDraft}
        onCancel={() => {
          setFoundCityConfirmTarget(null);
          setFoundCityNameDraft("");
        }}
        onConfirm={confirmFoundCity}
      />
      <DangerConfirmDialog
        state={mapBuildingConfirm}
        busy={Boolean(mapBuildingBusyAction?.startsWith("demolish:"))}
        onCancel={() => setMapBuildingConfirm(null)}
        onConfirm={confirmMapBuildingDanger}
      />
    </div>
  );
}

function FoundCityConfirmDialog(props: {
  target: FoundCityConfirmTarget | null;
  nameDraft: string;
  nameValid: boolean;
  onNameChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useUiText();
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!props.target) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [props.target]);
  useEffect(() => {
    if (!props.target) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onCancel();
      if (event.key === "Enter" && props.nameValid) props.onConfirm();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);
  if (!props.target) return null;
  const normalizedLength = props.nameDraft.trim().length;
  return (
    <div className="arc-found-city-confirm-wrap" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <section className="arc-hex-build-confirm" role="dialog" aria-modal="true" aria-labelledby="arc-found-city-confirm-title">
        <div className="arc-hex-build-confirm__header">
          <h2 id="arc-found-city-confirm-title" className="arc-hex-build-confirm__title">
            {t("hexMap.foundCityConfirmTitle")}
          </h2>
        </div>
        <div className="arc-hex-build-confirm__body">
          <div className="arc-hex-build-confirm__row">
            <span>{t("hexMap.foundCityNameLabel")}</span>
            <strong className="arc-found-city-confirm__name">
              <input
                ref={inputRef}
                value={props.nameDraft}
                maxLength={32}
                onChange={(event) => props.onNameChange(event.target.value.slice(0, 32))}
                aria-invalid={!props.nameValid}
                aria-label={t("hexMap.foundCityNameLabel")}
              />
              <span>{t("hexMap.foundCityNameCounter", { current: normalizedLength, max: 32 })}</span>
            </strong>
          </div>
          <div className="arc-hex-build-confirm__row">
            <span>{t("hexMap.hex")}</span>
            <strong>{props.target.hexId}</strong>
          </div>
          <div className="arc-hex-build-confirm__row">
            <span>{t("hexMap.region")}</span>
            <strong>{props.target.regionId}</strong>
          </div>
          <div className="arc-hex-build-confirm__row">
            <span>{t("hexMap.owner")}</span>
            <strong className="arc-hex-build-confirm__owner-current">
              <span className="arc-hex-build-confirm__owner-flag" aria-hidden="true">
                {props.target.ownerFlagUrl ? <img src={props.target.ownerFlagUrl} alt="" /> : props.target.ownerName.slice(0, 1).toUpperCase()}
              </span>
              <span>{props.target.ownerName}</span>
            </strong>
          </div>
          <div className="arc-hex-build-confirm__row">
            <span>{t("hexMap.foundCityCost")}</span>
            <strong>{props.target.costColonization == null ? t("common.unknown") : formatCompactNumber(props.target.costColonization)}</strong>
          </div>
          {!props.nameValid ? <p className="arc-found-city-confirm__error">{t("hexMap.foundCityNameRequired")}</p> : null}
        </div>
        <div className="arc-hex-build-confirm__actions">
          <button type="button" className="arc-strategy-workspace-action arc-strategy-workspace-action--primary arc-hex-build-confirm__action arc-hex-build-confirm__action--cancel" onClick={props.onCancel}>
            <span>{t("common.cancel")}</span>
          </button>
          <button type="button" className="arc-strategy-workspace-action arc-hex-build-confirm__action" onClick={props.onConfirm} disabled={!props.nameValid}>
            <span>{t("common.confirm")}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function isMapNavigationBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        "[role='dialog']",
        "[aria-modal='true']",
        "input",
        "select",
        "textarea",
        "[contenteditable='true']",
      ].join(","),
    ),
  );
}

function normalizeNavigationKey(key: string): "left" | "right" | "up" | "down" | "zoomIn" | "zoomOut" | "center" | null {
  const normalized = key.toLowerCase();
  if (normalized === "a" || normalized === "arrowleft") return "left";
  if (normalized === "d" || normalized === "arrowright") return "right";
  if (normalized === "w" || normalized === "arrowup") return "up";
  if (normalized === "s" || normalized === "arrowdown") return "down";
  if (normalized === "e" || normalized === "+" || normalized === "=") return "zoomIn";
  if (normalized === "q" || normalized === "-" || normalized === "_") return "zoomOut";
  if (normalized === " " || normalized === "spacebar" || normalized === "home") return "center";
  return null;
}

function calculateKeyboardVelocity(keys: Set<string>): { x: number; y: number } {
  const speed = 620;
  return {
    x: (keys.has("right") ? speed : 0) - (keys.has("left") ? speed : 0),
    y: (keys.has("down") ? speed : 0) - (keys.has("up") ? speed : 0),
  };
}

function calculateKeyboardZoomDirection(keys: Set<string>): number {
  return (keys.has("zoomIn") ? 1 : 0) - (keys.has("zoomOut") ? 1 : 0);
}

function getMapWorldCenter(map: HexMapArtifact): { x: number; y: number } {
  return axialToPixel({ q: map.settings.width / 2, r: map.settings.height / 2 }, map.settings.hexSize);
}

function hasCameraChanged(current: HexCamera, next: HexCamera): boolean {
  return Math.abs(current.x - next.x) > 0.01 || Math.abs(current.y - next.y) > 0.01 || Math.abs(current.scale - next.scale) > 0.0001;
}

function getMapLensIcon(lens: MapLensId) {
  if (lens === "political") return Flag;
  if (lens === "regions") return Layers;
  if (lens === "colonization") return Leaf;
  if (lens === "population") return Users;
  if (lens === "market") return HandCoins;
  if (lens === "infrastructure") return Landmark;
  if (lens === "military") return Shield;
  return Mountain;
}

function getMapZoomBucket(scale: number): MapZoomBucket {
  if (scale < 0.72) return "far";
  if (scale < 1.42) return "mid";
  return "near";
}

function buildTileSpatialIndex(map: HexMapArtifact): MapTileSpatialIndex {
  if (map.tiles.length === 0) {
    return { index: null, tileIdsByIndex: [] };
  }
  const index = new Flatbush(map.tiles.length);
  const tileIdsByIndex: HexId[] = [];
  for (const tile of map.tiles) {
    const center = axialToPixel(tile, map.settings.hexSize);
    tileIdsByIndex.push(tile.id);
    index.add(center.x, center.y, center.x, center.y);
  }
  index.finish();
  return { index, tileIdsByIndex };
}

function getViewportCullingBounds(map: HexMapArtifact, camera: HexCamera, rect: DOMRect | undefined): ViewportCullingBounds | null {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  const size = map.settings.hexSize;
  const padding = Math.max(size * MAP_VIEWPORT_PADDING_HEXES, (size / Math.max(0.001, camera.scale)) * 2);
  const halfWidth = rect.width / Math.max(0.001, camera.scale) / 2 + padding;
  const halfHeight = rect.height / Math.max(0.001, camera.scale) / 2 + padding;
  const left = camera.x - halfWidth;
  const right = camera.x + halfWidth;
  const top = camera.y - halfHeight;
  const bottom = camera.y + halfHeight;
  const bucketSize = Math.max(size * 3, 48 / Math.max(0.001, camera.scale));
  const key = [
    Math.floor(left / bucketSize),
    Math.floor(right / bucketSize),
    Math.floor(top / bucketSize),
    Math.floor(bottom / bucketSize),
    getMapZoomBucket(camera.scale),
    map.tiles.length,
  ].join(":");
  return { key, left, right, top, bottom };
}

function getViewportCullingState(map: HexMapArtifact, spatialIndex: MapTileSpatialIndex, camera: HexCamera, rect: DOMRect | undefined): ViewportCullingState {
  return getViewportCullingStateFromBounds(map, spatialIndex, getViewportCullingBounds(map, camera, rect));
}

function getViewportCullingStateFromBounds(map: HexMapArtifact, spatialIndex: MapTileSpatialIndex, bounds: ViewportCullingBounds | null): ViewportCullingState {
  if (!bounds) {
    return {
      key: `all:${map.tiles.length}`,
      visibleTileIds: new Set(spatialIndex.tileIdsByIndex),
    };
  }
  if (!spatialIndex.index) {
    return { key: bounds.key, visibleTileIds: new Set<HexId>() };
  }
  const visibleTileIds = new Set<HexId>();
  for (const itemIndex of spatialIndex.index.search(bounds.left, bounds.top, bounds.right, bounds.bottom)) {
    const tileId = spatialIndex.tileIdsByIndex[itemIndex];
    if (tileId) visibleTileIds.add(tileId);
  }
  return { key: bounds.key, visibleTileIds };
}

function buildLayerOverlayCells(
  map: HexMapArtifact,
  worldBase: WorldBase | null,
  layers: MapLayerToggles,
  countryColorById?: Record<string, string>,
  countryNameById?: Record<string, string>,
  visibleTileIds?: ReadonlySet<HexId>,
  showLabels = true,
): MapLensRenderCell[] {
  if (!worldBase) return [];
  const cells: MapLensRenderCell[] = [];
  for (const tile of map.tiles) {
    if (visibleTileIds && !visibleTileIds.has(tile.id)) continue;
    if (layers.regionFill) {
      cells.push({
        tile,
        groupId: `layer:region:${tile.regionId}`,
        borderGroupId: `layer:region:${tile.regionId}`,
        color: stableColorFromId(tile.regionId),
        alpha: tile.waterKind ? 0.12 : 0.18,
        surfaceAlpha: 0,
        terrainMute: 0,
      });
    }
    const owner = worldBase.regionOwner[tile.regionId] ?? worldBase.hexOwner[tile.id] ?? null;
    if ((layers.countryFill || layers.countryLabels) && owner) {
      const countryColor = cssColorToHexNumber(countryColorById?.[owner] ?? "", stableColorFromId(owner));
      cells.push({
        tile,
        groupId: `layer:country:${owner}`,
        borderGroupId: `layer:country:${owner}`,
        labelGroupId: showLabels && layers.countryLabels && !tile.waterKind ? owner : undefined,
        label: showLabels && layers.countryLabels && !tile.waterKind ? countryNameById?.[owner] ?? owner : undefined,
        color: countryColor,
        alpha: layers.countryFill ? (tile.waterKind ? 0.14 : 0.24) : 0,
        surfaceAlpha: 0,
        terrainMute: 0,
      });
    }
  }
  return cells;
}

function stripMapCellLabel(cell: MapLensRenderCell): MapLensRenderCell {
  if (!cell.labelGroupId && !cell.label) return cell;
  return { ...cell, labelGroupId: undefined, label: undefined };
}

function safeDestroyMapRenderer(renderer: { destroy: () => void } | null): void {
  try {
    renderer?.destroy();
  } catch {
    // Renderer cleanup can race with Pixi internals during route teardown.
  }
}

function safeDestroyPixiApp(app: Application): void {
  try {
    app.destroy(true);
  } catch {
    // React unmount must not crash if Pixi already released part of the stage.
  }
}

function safeRenderPixiApp(app: Application | null): void {
  if (!app?.renderer) return;
  app.render();
}

function getPooledSprite(layer: Container, pool: Map<string, Sprite>, key: string): Sprite {
  const existing = pool.get(key);
  if (existing) {
    if (existing.parent !== layer) layer.addChild(existing);
    return existing;
  }
  const sprite = new Sprite();
  pool.set(key, sprite);
  layer.addChild(sprite);
  return sprite;
}

function getPooledGraphics(layer: Container, pool: Map<string, Graphics>, key: string): Graphics {
  const existing = pool.get(key);
  if (existing) {
    existing.clear();
    if (existing.parent !== layer) layer.addChild(existing);
    return existing;
  }
  const graphics = new Graphics();
  pool.set(key, graphics);
  layer.addChild(graphics);
  return graphics;
}

function hideLayerPool<T extends { visible: boolean }>(pool: ReadonlyMap<string, T>): void {
  for (const item of pool.values()) {
    item.visible = false;
  }
}

function destroyPoolItem<T extends { destroy: () => void }>(pool: Map<string, T>, key: string): void {
  const item = pool.get(key);
  if (!item) return;
  item.destroy();
  pool.delete(key);
}

function pruneLayerPool<T extends { destroy: () => void }>(pool: Map<string, T>, activeKeys: ReadonlySet<string>): void {
  for (const key of [...pool.keys()]) {
    if (activeKeys.has(key)) continue;
    destroyPoolItem(pool, key);
  }
}

function destroyLayerPool<T extends { destroy: () => void }>(pool: Map<string, T>): void {
  for (const item of pool.values()) {
    item.destroy();
  }
  pool.clear();
}

function drawHexOutline(graphics: Graphics, tile: HexTile, size: number, color: number, width: number): void {
  const center = axialToPixel(tile, size);
  const points = Array.from({ length: 6 }, (_, index) => hexCorner(center, size - 0.4, index)).flatMap((point) => [point.x, point.y]);
  graphics.poly(points, true).stroke({ color, width, alpha: 0.95 });
}

function drawHexFillAndOutline(graphics: Graphics, tile: HexTile, size: number, fillColor: number, borderColor: number, fillAlpha = 0.45, borderWidth = 2.2): void {
  const center = axialToPixel(tile, size);
  const points = Array.from({ length: 6 }, (_, index) => hexCorner(center, size - 0.7, index)).flatMap((point) => [point.x, point.y]);
  graphics.poly(points, true).fill({ color: fillColor, alpha: fillAlpha }).stroke({ color: borderColor, width: borderWidth, alpha: 0.9 });
}

function drawPathOverlay(
  graphics: Graphics,
  path: HexId[],
  tileById: Map<HexId, HexTile>,
  size: number,
  color = 0xf1df8b,
  alpha = 0.74,
  width = 2.5,
): void {
  let first = true;
  for (const hexId of path) {
    const tile = tileById.get(hexId);
    if (!tile) continue;
    const center = axialToPixel(tile, size);
    if (first) {
      graphics.moveTo(center.x, center.y);
      first = false;
    } else {
      graphics.lineTo(center.x, center.y);
    }
  }
  graphics.stroke({ color, width, alpha });
}


function normalizeCorridorPath(input: readonly string[] | undefined): HexId[] {
  return (input ?? []).filter((hexId): hexId is HexId => /^hex:-?\d+:-?\d+$/.test(hexId));
}

function mergeHexPaths(left: readonly HexId[], right: readonly HexId[]): HexId[] {
  if (left.length === 0) return [...right];
  if (right.length === 0) return [...left];
  return left[left.length - 1] === right[0] ? [...left, ...right.slice(1)] : [...left, ...right];
}

function getCorridorAtlasStatus(corridor: MarketTransportCorridor): CorridorAtlasStatus {
  const capacity = Math.max(0, Number(corridor.lastCapacityByMode?.[corridor.transportMode] ?? 0));
  const load = Math.max(0, Number(corridor.lastLoadByMode?.[corridor.transportMode] ?? 0));
  if (corridor.status === "closed") return "closed";
  if (corridor.status === "building") return "building";
  if (capacity > 0 && load > capacity) return "overloaded";
  return "active";
}

function addCorridorPathMasks(
  layers: Map<string, Map<HexId, number>>,
  path: readonly HexId[],
  tileById: Map<HexId, HexTile>,
  settings: Pick<HexMapSettings, "width" | "height" | "wrapX">,
  transportMode: TransportMode,
  status: CorridorAtlasStatus,
): void {
  if (path.length === 0) return;
  const key = `${transportMode}:${status}`;
  const masks = layers.get(key) ?? new Map<HexId, number>();
  layers.set(key, masks);
  for (let index = 0; index < path.length; index += 1) {
    const hexId = path[index];
    if (!tileById.has(hexId)) continue;
    let mask = masks.get(hexId) ?? 0;
    const previousHexId = path[index - 1];
    const nextHexId = path[index + 1];
    if (previousHexId) mask |= getCorridorConnectionBit(hexId, previousHexId, tileById, settings);
    if (nextHexId) mask |= getCorridorConnectionBit(hexId, nextHexId, tileById, settings);
    masks.set(hexId, mask);
  }
}

function getCorridorConnectionBit(
  fromHexId: HexId,
  toHexId: HexId,
  tileById: Map<HexId, HexTile>,
  settings: Pick<HexMapSettings, "width" | "height" | "wrapX">,
): number {
  const fromTile = tileById.get(fromHexId);
  if (!fromTile) return 0;
  for (let direction = 0; direction < 6; direction += 1) {
    const neighbor = getNeighborAxial(fromTile, direction as 0 | 1 | 2 | 3 | 4 | 5, settings);
    if (neighbor && makeHexId(neighbor.q, neighbor.r) === toHexId) return 1 << direction;
  }
  return 0;
}

function drawTexturedCorridorTiles(
  layer: Container,
  tileLayers: Map<string, Map<HexId, number>>,
  tileById: Map<HexId, HexTile>,
  size: number,
  textures: CorridorAtlasTextures,
  preview: boolean,
  alphaMultiplier = 1,
  visibleTileIds?: ReadonlySet<HexId>,
): void {
  const tileSize = Math.max(size * 2.05, 18);
  for (const [key, masks] of tileLayers) {
    const [transportMode, status] = key.split(":") as [TransportMode, CorridorAtlasStatus];
    for (const [hexId, rawMask] of masks) {
      if (visibleTileIds && !visibleTileIds.has(hexId)) continue;
      const tile = tileById.get(hexId);
      const texture = textures[transportMode]?.[status]?.[Math.max(0, Math.min(63, rawMask))];
      if (!tile || !texture) continue;
      const center = axialToPixel(tile, size);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.position.set(center.x, center.y);
      sprite.width = tileSize;
      sprite.height = tileSize;
      sprite.alpha = getCorridorTextureAlpha(status, preview) * alphaMultiplier;
      layer.addChild(sprite);
    }
  }
}

function getCorridorTextureAlpha(status: CorridorAtlasStatus, preview: boolean): number {
  if (preview) return 0.96;
  if (status === "closed") return 0.42;
  if (status === "building") return 0.82;
  return 0.92;
}

function updateNaturalFeatureSprite(sprite: Sprite, params: {
  tile: HexTile;
  scenarioId: string | null | undefined;
  visualRules: MapFeatureVisualRuleDefinition[];
  size: number;
  onReady: () => void;
}): boolean {
  const visualId = resolveNaturalFeatureVisualId(params.tile);
  if (!visualId) {
    sprite.visible = false;
    return false;
  }
  const textures = getFeatureAtlasTextures({
    scenarioId: params.scenarioId,
    featureId: visualId,
    onReady: params.onReady,
  });
  const texture = textures?.[resolveFeatureAtlasFrame({ visualId, tile: params.tile, seed: `${visualId}:${params.tile.id}`, rules: params.visualRules })];
  if (!texture) {
    sprite.visible = false;
    return false;
  }
  const center = axialToPixel(params.tile, params.size);
  sprite.texture = texture;
  sprite.anchor.set(0.5, 0.72);
  sprite.position.set(center.x, center.y + params.size * 0.08);
  const markerSize = getHexFillSpriteSize(params.size, resolveNaturalFeatureSpriteScale(params.tile));
  sprite.width = markerSize;
  sprite.height = markerSize;
  sprite.alpha = resolveNaturalFeatureAlpha(params.tile);
  sprite.visible = true;
  return true;
}

function updateSiteFeatureSprite(sprite: Sprite, params: {
  feature: MapFeatureInstance;
  tile: HexTile;
  scenarioId: string | null | undefined;
  visualRules: MapFeatureVisualRuleDefinition[];
  size: number;
  onReady: () => void;
}): boolean {
  const textures = getFeatureAtlasTextures({
    scenarioId: params.scenarioId,
    featureId: params.feature.visualId,
    onReady: params.onReady,
  });
  const texture = textures?.[resolveFeatureAtlasFrame({
    visualId: params.feature.visualId,
    tile: params.tile,
    seed: `${params.feature.visualId}:${params.feature.id}:${params.tile.id}`,
    rules: params.visualRules,
  })];
  if (!texture) {
    sprite.visible = false;
    return false;
  }
  const center = axialToPixel(params.tile, params.size);
  sprite.texture = texture;
  sprite.anchor.set(0.5, 0.76);
  sprite.position.set(center.x, center.y + params.size * 0.02);
  const markerSize = getHexFillSpriteSize(params.size, 1.72);
  sprite.width = markerSize;
  sprite.height = markerSize;
  sprite.alpha = params.feature.visibility === "hidden" ? 0.52 : 0.96;
  sprite.visible = true;
  return true;
}

function updateResourceDepositSprite(sprite: Sprite, params: {
  deposit: RegionResourceDeposit;
  tile: HexTile;
  scenarioId: string | null | undefined;
  size: number;
  cameraScale: number;
  onReady: () => void;
}): boolean {
  const textures = getResourceDepositAtlasTextures({
    scenarioId: params.scenarioId,
    goodId: params.deposit.goodId,
    onReady: params.onReady,
  });
  const texture = textures?.[resolveResourceDepositAtlasFrame(params.deposit)];
  if (!texture) {
    sprite.visible = false;
    return false;
  }
  const center = axialToPixel(params.tile, params.size);
  sprite.texture = texture;
  sprite.anchor.set(0.5, 0.74);
  sprite.position.set(center.x, center.y + params.size * 0.12);
  const markerSize = Math.max(params.size * 0.54, Math.min(params.size * 0.96, 30 / Math.max(0.35, params.cameraScale)));
  sprite.width = markerSize;
  sprite.height = markerSize;
  sprite.alpha = params.deposit.depletionMode === "finite" && Number(params.deposit.amount) <= 0 ? 0.36 : 0.9;
  sprite.visible = true;
  return true;
}

function updateMapUnitSprite(sprite: Sprite, params: {
  unit: NonNullable<WorldBase["unitsById"]>[string];
  tile: HexTile;
  scenarioId: string | null | undefined;
  size: number;
  cameraScale: number;
  tintColor: number;
  onReady: () => void;
}): boolean {
  const textures = getUnitAtlasTextures({
    scenarioId: params.scenarioId,
    unitTypeId: params.unit.unitTypeId,
    onReady: params.onReady,
  });
  const state = params.unit.status === "moving" ? "move" : params.unit.status === "fighting" ? "attack" : params.unit.hp < 35 ? "damaged" : "idle";
  const texture = textures?.[state] ?? textures?.idle;
  if (!texture) {
    sprite.visible = false;
    return false;
  }
  const center = axialToPixel(params.tile, params.size);
  sprite.texture = texture;
  sprite.anchor.set(0.5, 0.78);
  sprite.position.set(center.x, center.y + params.size * 0.04);
  const markerSize = Math.max(params.size * 0.48, Math.min(params.size * 0.82, 30 / Math.max(0.35, params.cameraScale)));
  sprite.width = markerSize;
  sprite.height = markerSize;
  sprite.tint = params.tintColor;
  sprite.alpha = params.unit.status === "based" ? 0.72 : 0.96;
  sprite.visible = true;
  return true;
}

function resolveNaturalFeatureVisualId(tile: HexTile): MapFeatureVisualId | null {
  const tag = tile.mapTags.find((item) => item === "feature:snow" || item === "feature:wet" || item === "feature:vegetated");
  return tag ? NATURAL_FEATURE_VISUAL_IDS[tag] ?? null : null;
}

function resolveNaturalFeatureAlpha(tile: HexTile): number {
  if (tile.mapTags.includes("feature:snow")) return 0.78;
  if (tile.mapTags.includes("rainfall:dry")) return 0.74;
  return 0.86;
}

function resolveNaturalFeatureSpriteScale(tile: HexTile): number {
  if (tile.mapTags.includes("feature:snow")) return 1.5;
  if (tile.mapTags.includes("rainfall:dry")) return 1.58;
  if (tile.mapTags.includes("feature:vegetated") || tile.mapTags.includes("feature:wet")) return 1.82;
  return 1.7;
}

function resolveHexTagSummary(tile: HexTile, t: ReturnType<typeof useUiText>["t"], hasCity = false): string {
  const tags = tile.mapTags ?? [];
  const summaryTags = [
    tags.find((tag) => tag.startsWith("water:")) ?? tags.find((tag) => tag.startsWith("biome:")),
    tags.find((tag) => tag === "morphology:navigable_river") ?? tags.find((tag) => tag.startsWith("morphology:")),
    tags.find((tag) => tag.startsWith("feature:") && tag !== "feature:aquatic") ??
      tags.find((tag) => tag.startsWith("river:")) ??
      tags.find((tag) => tag.startsWith("coast:")),
    tags.find((tag) => tag.startsWith("fertility:")) ?? tags.find((tag) => tag.startsWith("rainfall:")),
  ];
  const labels = uniqueDefined(summaryTags).map((tag) => t(resolveMapTagLabelKey(tag)));
  if (hasCity) labels.push(t("hexMap.feature.city"));
  return labels.length > 0 ? labels.join(" · ") : t("mapTag.unknown");
}

function resolveHexGeographyRows(tile: HexTile, t: ReturnType<typeof useUiText>["t"], hasCity = false): GamePlotTooltipRow[] {
  const rows: GamePlotTooltipRow[] = [
    {
      id: "surface",
      icon: tile.waterKind ? <Waves size={13} aria-hidden="true" /> : <Mountain size={13} aria-hidden="true" />,
      label: t("hexMap.surfaceType"),
      value: resolveHexSurfaceTypeLabel(tile, t),
      tone: tile.waterKind ? "info" : "default",
    },
  ];
  const biome = firstTagLabel(tile, t, ["biome:"]);
  if (biome) {
    rows.push({
      id: "biome",
      icon: <Leaf size={13} aria-hidden="true" />,
      label: t("hexMap.tagGroupBiome"),
      value: biome,
    });
  }
  const relief = firstTagLabel(tile, t, ["morphology:", "slope:", "elevation:"]);
  if (relief) {
    rows.push({
      id: "relief",
      icon: <Mountain size={13} aria-hidden="true" />,
      label: t("hexMap.tagGroupRelief"),
      value: relief,
    });
  }
  const water = resolveHexWaterAndRiverLabel(tile, t);
  if (water) {
    rows.push({
      id: "water",
      icon: <Waves size={13} aria-hidden="true" />,
      label: t("hexMap.tagGroupWater"),
      value: water,
      tone: "info",
    });
  }
  const position = resolveHexPositionLabel(tile, t);
  if (position) {
    rows.push({
      id: "position",
      icon: <Grid3X3 size={13} aria-hidden="true" />,
      label: t("hexMap.position"),
      value: position,
      tone: "muted",
    });
  }
  if (hasCity) {
    rows.push({
      id: "city",
      icon: <Landmark size={13} aria-hidden="true" />,
      label: t("hexMap.tagGroupFeatures"),
      value: t("hexMap.feature.city"),
      tone: "positive",
    });
  }
  return rows;
}

function resolveHexSurfaceTypeLabel(tile: HexTile, t: ReturnType<typeof useUiText>["t"]): string {
  if (tile.waterKind === "ocean") return t("hexMap.surface.ocean");
  if (tile.waterKind === "sea") return t("hexMap.surface.sea");
  if (tile.waterKind === "lake") return t("hexMap.surface.lake");
  if (tile.mapTags.includes("landmass:island")) return t("hexMap.surface.island");
  if (tile.mapTags.includes("landmass:continent")) return t("hexMap.surface.continent");
  return t("mapTag.unknown");
}

function resolveHexPositionLabel(tile: HexTile, t: ReturnType<typeof useUiText>["t"]): string | null {
  if (tile.mapTags.includes("coast:coastal")) return t("hexMap.position.coastal");
  if (tile.mapTags.includes("coast:inland")) return t("hexMap.position.inland");
  return null;
}

function resolveHexWaterAndRiverLabel(tile: HexTile, t: ReturnType<typeof useUiText>["t"]): string | null {
  const waterTags = tagsByPrefixes(tile, ["water:", "river:", "basin:"]);
  const labels = uniqueDefined(waterTags.map((tag) => t(resolveMapTagLabelKey(tag))));
  if (labels.length > 0) return labels.join(", ");
  if (tile.waterKind === "ocean") return t("hexMap.surface.ocean");
  if (tile.waterKind === "sea") return t("hexMap.surface.sea");
  if (tile.waterKind === "lake") return t("hexMap.surface.lake");
  return null;
}

function firstTagLabel(tile: HexTile, t: ReturnType<typeof useUiText>["t"], prefixes: string[]): string | null {
  const tag = tagsByPrefixes(tile, prefixes)[0];
  return tag ? t(resolveMapTagLabelKey(tag)) : null;
}

function resolveHexTagGroupRows(tile: HexTile, t: ReturnType<typeof useUiText>["t"]): Array<{ label: string; value: string }> {
  return [
    {
      label: t("hexMap.tagGroupBiome"),
      tags: tagsByPrefixes(tile, ["biome:"]),
    },
    {
      label: t("hexMap.tagGroupClimate"),
      tags: tagsByPrefixes(tile, ["latitude:", "rainfall:"]),
    },
    {
      label: t("hexMap.tagGroupRelief"),
      tags: tagsByPrefixes(tile, ["morphology:", "slope:", "elevation:"]),
    },
    {
      label: t("hexMap.tagGroupWater"),
      tags: tagsByPrefixes(tile, ["water:", "river:", "coast:", "basin:"]),
    },
    {
      label: t("hexMap.tagGroupFeatures"),
      tags: tagsByPrefixes(tile, ["feature:"]),
    },
    {
      label: t("hexMap.tagGroupValue"),
      tags: tagsByPrefixes(tile, ["fertility:", "landmass:", "continent:"]),
    },
    {
      label: t("hexMap.tagGroupMovement"),
      tags: tagsByPrefixes(tile, ["movement:"]),
    },
  ]
    .map((group) => ({
      label: group.label,
      value: group.tags.map((tag) => t(resolveMapTagLabelKey(tag))).join(", "),
    }))
    .filter((group) => group.value.length > 0);
}

function resolveHexMovementRows(tile: HexTile, t: ReturnType<typeof useUiText>["t"]): GamePlotTooltipRow[] {
  const rows: GamePlotTooltipRow[] = [];
  const tags = tile.mapTags ?? [];
  if (tags.includes("morphology:rough")) {
    rows.push({
      id: "rough",
      icon: <Mountain size={13} aria-hidden="true" />,
      label: t("mapTag.morphology.rough"),
      value: "+1",
      tone: "warning",
    });
  }
  if (tags.includes("morphology:mountainous")) {
    rows.push({
      id: "mountainous",
      icon: <Mountain size={13} aria-hidden="true" />,
      label: t("mapTag.morphology.mountainous"),
      value: "+3",
      tone: "warning",
    });
  }
  if (tags.includes("feature:vegetated")) {
    rows.push({
      id: "vegetated",
      icon: <Leaf size={13} aria-hidden="true" />,
      label: t("mapTag.feature.vegetated"),
      value: "+1",
      tone: "muted",
    });
  }
  if (tags.includes("feature:wet")) {
    rows.push({
      id: "wet",
      icon: <Leaf size={13} aria-hidden="true" />,
      label: t("mapTag.feature.wet"),
      value: "+1",
      tone: "muted",
    });
  }
  if (tags.includes("feature:snow")) {
    rows.push({
      id: "snow",
      icon: <Mountain size={13} aria-hidden="true" />,
      label: t("mapTag.feature.snow"),
      value: "+1",
      tone: "muted",
    });
  }
  return rows;
}

function resolvePlotTooltipTone(tone: HexBuildingTooltipInfo["tone"]): GamePlotTooltipRow["tone"] {
  if (tone === "good") return "positive";
  if (tone === "warn") return "warning";
  if (tone === "bad") return "negative";
  return "default";
}

function tagsByPrefixes(tile: HexTile, prefixes: string[]): string[] {
  return (tile.mapTags ?? []).filter((tag) => prefixes.some((prefix) => tag.startsWith(prefix)));
}

function uniqueDefined(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function getHexFillSpriteSize(hexSize: number, multiplier: number): number {
  return Math.max(hexSize, hexSize * multiplier);
}

function resolveMapFeatureLabel(feature: MapFeatureInstance, t: (key: UiTextKey) => string): string {
  return feature.nameKey ? t(feature.nameKey as UiTextKey) : feature.typeId;
}

function formatResourceDepositLabel(deposit: RegionResourceDeposit): string {
  const amount = Math.max(0, Number(deposit.amount ?? 0));
  const maxAmount = Math.max(amount, Number(deposit.maxAmount ?? 0));
  return `${deposit.goodId} · ${formatCompactNumber(amount)} / ${formatCompactNumber(maxAmount)}`;
}

function resolveMapTagLabelKey(tag: string): UiTextKey {
  const key = `mapTag.${tag.replace(":", ".")}` as UiTextKey;
  return MAP_TAG_LABEL_KEYS.has(key) ? key : "mapTag.unknown";
}

const MAP_TAG_LABEL_KEYS = new Set<UiTextKey>([
  "mapTag.unknown",
  "mapTag.biome.tundra",
  "mapTag.biome.grassland",
  "mapTag.biome.plains",
  "mapTag.biome.desert",
  "mapTag.biome.tropical",
  "mapTag.morphology.flat",
  "mapTag.morphology.rough",
  "mapTag.morphology.mountainous",
  "mapTag.morphology.navigable_river",
  "mapTag.water.coastal",
  "mapTag.water.ocean",
  "mapTag.water.lake",
  "mapTag.water.fresh",
  "mapTag.feature.minor_river",
  "mapTag.feature.floodplain",
  "mapTag.feature.wet",
  "mapTag.feature.vegetated",
  "mapTag.feature.aquatic",
  "mapTag.feature.snow",
  "mapTag.feature.volcanic",
  "mapTag.movement.stop_on_enter",
  "mapTag.fertility.barren",
  "mapTag.fertility.poor",
  "mapTag.fertility.modest",
  "mapTag.fertility.fertile",
  "mapTag.fertility.rich",
  "mapTag.rainfall.arid",
  "mapTag.rainfall.dry",
  "mapTag.rainfall.moderate",
  "mapTag.rainfall.wet",
  "mapTag.rainfall.monsoon",
  "mapTag.slope.flat",
  "mapTag.slope.rolling",
  "mapTag.slope.hilly",
  "mapTag.slope.steep",
  "mapTag.slope.rugged",
  "mapTag.latitude.polar",
  "mapTag.latitude.subpolar",
  "mapTag.latitude.temperate",
  "mapTag.latitude.subtropical",
  "mapTag.latitude.tropical",
  "mapTag.elevation.lowland",
  "mapTag.elevation.upland",
  "mapTag.elevation.highland",
  "mapTag.elevation.mountain",
  "mapTag.elevation.peak",
  "mapTag.landmass.continent",
  "mapTag.landmass.island",
  "mapTag.continent.homeland",
  "mapTag.continent.distant",
  "mapTag.basin.headwater",
  "mapTag.basin.mainstem",
  "mapTag.basin.delta",
  "mapTag.river.minor",
  "mapTag.river.major",
  "mapTag.river.navigable",
  "mapTag.coast.coastal",
  "mapTag.coast.inland",
]);

function calculateHexPathMovementCost(
  path: HexId[],
  tileById: Map<HexId, HexTile>,
  cityHexIds: ReadonlySet<HexId> = new Set(),
  modifiers: readonly ActiveModifierRow[] = [],
): number {
  return path.slice(1).reduce((sum, hexId) => {
    const tile = tileById.get(hexId);
    const baseCost = Math.max(0, Number(tile?.movementCost ?? 1) || 0);
    return sum + resolveClientHexMovementCost(baseCost, cityHexIds.has(hexId) ? ["city"] : [], modifiers);
  }, 0);
}

function calculateReachableHexIds(params: {
  mapArtifact: HexMapArtifact;
  fromHexId: HexId;
  budget: number;
  tileById: Map<HexId, HexTile>;
  cityHexIds: ReadonlySet<HexId>;
  modifiers: readonly ActiveModifierRow[];
}): Set<HexId> {
  const start = params.tileById.get(params.fromHexId);
  if (!start || !start.passable || params.budget <= 0) return new Set<HexId>();
  const reachable = new Set<HexId>();
  const bestCost = new Map<HexId, number>([[params.fromHexId, 0]]);
  const frontier: Array<{ tile: HexTile; cost: number }> = [{ tile: start, cost: 0 }];

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) break;
    for (const neighbor of getNeighborTiles(current.tile, params.tileById, params.mapArtifact.settings)) {
      if (!neighbor.passable) continue;
      const stepCost = resolveClientHexMovementCost(
        Math.max(0.001, Number(neighbor.movementCost) || 1),
        params.cityHexIds.has(neighbor.id) ? ["city"] : [],
        params.modifiers,
      );
      const nextCost = current.cost + stepCost;
      if (nextCost > params.budget + 0.001) continue;
      if (nextCost >= (bestCost.get(neighbor.id) ?? Number.POSITIVE_INFINITY)) continue;
      bestCost.set(neighbor.id, nextCost);
      reachable.add(neighbor.id);
      frontier.push({ tile: neighbor, cost: nextCost });
    }
  }

  return reachable;
}

function resolveClientHexMovementCost(baseCost: number, hexTags: readonly string[], modifiers: readonly ActiveModifierRow[]): number {
  const effects = modifiers.flatMap((modifier) =>
    modifier.effects.filter((effect) => {
      if (effect.stat !== "hex_movement_cost") return false;
      const targetTag = effect.target?.hexTag;
      return !targetTag || hexTags.includes(targetTag);
    }),
  );
  let value = Number.isFinite(baseCost) ? baseCost : 0;
  for (const effect of effects.filter((entry) => entry.mode === "add")) {
    value += effect.value;
  }
  const addPct = effects.filter((entry) => entry.mode === "add_pct").reduce((sum, effect) => sum + effect.value, 0);
  value *= 1 + addPct;
  for (const effect of effects.filter((entry) => entry.mode === "mult")) {
    value *= effect.value;
  }
  return Math.max(0.001, Math.round(value * 1000) / 1000);
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
}

function drawMapLayerOutlines(
  graphics: Graphics,
  map: HexMapArtifact,
  tileById: Map<HexId, HexTile>,
  worldBase: WorldBase | null,
  layers: MapLayerToggles,
  camera: HexCamera,
  rect: DOMRect,
  visibleTileIds?: ReadonlySet<HexId>,
): void {
  const size = map.settings.hexSize;
  for (const tile of map.tiles) {
    if (visibleTileIds && !visibleTileIds.has(tile.id)) continue;
    if (!isTileInViewport(tile, camera, rect, size)) continue;
    if (layers.hexGrid && camera.scale >= HEX_GRID_MIN_SCALE) {
      drawHexOutline(graphics, tile, size, 0xd3c08d, 0.55);
    }
    if (!worldBase) continue;
    if (layers.regionFill) {
      drawBoundaryEdges(graphics, tile, tileById, map.settings, (neighbor) => neighbor?.regionId !== tile.regionId, 0xe7d6a8, 0.72, 1.15);
    }
    if (layers.countryBorders) {
      const owner = worldBase.regionOwner[tile.regionId] ?? worldBase.hexOwner[tile.id] ?? null;
      drawBoundaryEdges(
        graphics,
        tile,
        tileById,
        map.settings,
        (neighbor) => {
          const neighborOwner = neighbor ? worldBase.regionOwner[neighbor.regionId] ?? worldBase.hexOwner[neighbor.id] ?? null : null;
          return neighborOwner !== owner;
        },
        0xf6e2ac,
        0.86,
        1.75,
      );
    }
  }
}

function drawBoundaryEdges(
  graphics: Graphics,
  tile: HexTile,
  tileById: Map<HexId, HexTile>,
  settings: HexMapSettings,
  shouldDraw: (neighbor: HexTile | null) => boolean,
  color: number,
  alpha: number,
  width: number,
): void {
  const center = axialToPixel(tile, settings.hexSize);
  for (let direction = 0; direction < 6; direction += 1) {
    const neighborAxial = getNeighborAxial(tile, direction as 0 | 1 | 2 | 3 | 4 | 5, settings);
    const neighbor = neighborAxial ? tileById.get(makeHexId(neighborAxial.q, neighborAxial.r)) ?? null : null;
    if (neighbor && tile.id > neighbor.id) continue;
    if (!shouldDraw(neighbor)) continue;
    const first = hexCorner(center, settings.hexSize - 0.5, direction);
    const second = hexCorner(center, settings.hexSize - 0.5, (direction + 1) % 6);
    graphics.moveTo(first.x, first.y);
    graphics.lineTo(second.x, second.y);
  }
  graphics.stroke({ color, width, alpha });
}

function isTileInViewport(tile: HexTile, camera: HexCamera, rect: DOMRect, size: number): boolean {
  const center = axialToPixel(tile, size);
  const x = rect.width / 2 + (center.x - camera.x) * camera.scale;
  const y = rect.height / 2 + (center.y - camera.y) * camera.scale;
  const margin = size * camera.scale * 2;
  return x >= -margin && x <= rect.width + margin && y >= -margin && y <= rect.height + margin;
}

function getPlacementOverlayColors(element: HTMLElement): { fill: number; border: number } {
  const styles = window.getComputedStyle(element);
  return {
    fill: cssColorToHexNumber(styles.getPropertyValue("--arc-map-build-placement-fill").trim(), 0x3a155e),
    border: cssColorToHexNumber(styles.getPropertyValue("--arc-map-build-placement-border").trim(), 0xb56cff),
  };
}

function getBuildingMapVisualState(instance: { isInactive?: boolean | null; mapVisualState?: unknown }): "working" | "burning" | "ruins" {
  if (instance.mapVisualState === "burning" || instance.mapVisualState === "ruins" || instance.mapVisualState === "working") {
    return instance.mapVisualState;
  }
  return instance.isInactive ? "ruins" : "working";
}

function cssColorToHexNumber(value: string, fallback: number): number {
  const hex = value.match(/^#([0-9a-fA-F]{6})$/)?.[1];
  return hex ? Number.parseInt(hex, 16) : fallback;
}

function stableColorFromId(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) & 0xffffff;
}

function getPlacementReasonLabelKey(code: string | undefined): UiTextKey {
  switch (code) {
    case "BUILD_PLACEMENT_REGION_NOT_CONTROLLED":
      return "buildings.hexPlacementReasonRegion";
    case "BUILD_PLACEMENT_OCCUPIED":
      return "buildings.hexPlacementReasonOccupied";
    case "BUILD_PLACEMENT_TERRAIN_DENIED":
    case "BUILD_PLACEMENT_TERRAIN_NOT_ALLOWED":
      return "buildings.hexPlacementReasonTerrain";
    case "BUILD_PLACEMENT_FEATURE_DENIED":
    case "BUILD_PLACEMENT_FEATURE_NOT_ALLOWED":
      return "buildings.hexPlacementReasonFeature";
    case "BUILD_PLACEMENT_WATER_DENIED":
    case "BUILD_PLACEMENT_WATER_NOT_ALLOWED":
      return "buildings.hexPlacementReasonWater";
    case "BUILD_PLACEMENT_TAG_DENIED":
    case "BUILD_PLACEMENT_TAG_NOT_ALLOWED":
      return "buildings.hexPlacementReasonTag";
    case "BUILD_PLACEMENT_DEPOSIT_REQUIRED":
      return "buildings.hexPlacementReasonDepositRequired";
    case "BUILD_PLACEMENT_DEPOSIT_HIDDEN":
      return "buildings.hexPlacementReasonDepositHidden";
    case "BUILD_PLACEMENT_DEPOSIT_WRONG_GOOD":
      return "buildings.hexPlacementReasonDepositWrongGood";
    default:
      return "buildings.hexPlacementReasonInvalid";
  }
}

