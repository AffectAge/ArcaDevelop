import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Application, Container, Graphics, Sprite } from "pixi.js";
import Flatbush from "flatbush";
import { BookOpen, Building2, Flag, Gem, Grid3X3, HandCoins, Info, Landmark, Layers, Leaf, Mountain, Move, Shield, Ship, Tags, Users, Waves } from "lucide-react";
import { toast } from "sonner";
import {
  buildCityHexIdSet,
  evaluateBuildingPlacement,
  resolveEffectiveHexTile,
  type ActiveModifierRow,
  type Country,
  type BuildingPlacementContent,
  type HexFeature,
  type HexId,
  type Order,
  type HexMapArtifact,
  type HexMapSettings,
  type HexTile,
  type MapFeatureInstance,
  type MapFeatureVisualId,
  type MapFeatureVisualRuleDefinition,
  type RegionResourceDeposit,
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
import { HexHoverTooltip } from "./ProvinceHoverTooltip";
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
  onQueueArmyMoveOrder?: (divisionId: string, hexId: string, path?: string[]) => void;
  onQueueFleetMoveOrder?: (fleetId: string, hexId: string, path?: string[]) => void;
  onQueueUnitAttackOrder?: (divisionId: string, targetHexId: HexId, targetUnitId?: string | null) => void;
  onQueueCivilianUnitMoveOrder?: (unitId: string, fromHexId: HexId, targetHexId: HexId, path?: HexId[]) => void;
  onFoundCityOrder?: (civilianUnitId: string, hexId: HexId, regionId: string, cityName: string, cultureId?: string | null) => void;
  onQueueColonizer?: (hexId: HexId) => void;
  queueingColonizerHexId?: HexId | null;
  onOpenAdminHexEditor?: (hexId: string) => void;
  onOpenHexKnowledge?: (hexId: string, hexName: string) => void;
  onCreateHexKnowledge?: (hexId: string, hexName: string) => void;
  onHexRenameCharged?: (chargedDucats: number) => void;
  colonizationIconUrl?: string | null;
  ducatsIconUrl?: string | null;
  maxActiveColonizations?: number;
  landDivisionStackLimitPerHex?: number;
  hexRenameDucatsCost?: number;
  countryColorById?: Record<string, string>;
  countryNameById?: Record<string, string>;
  suggestedMapMode?: MapInteractionMode;
  suggestedMapLens?: MapLensId;
  showMapControls?: boolean;
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
  militaryFormationPlacement?: {
    templateName: string;
    kind: "land" | "naval" | "air";
    validHexIds: readonly HexId[];
  } | null;
  onSelectMilitaryFormationPlacementTarget?: (target: { hexId: HexId; regionId: string }) => void;
  onCancelMilitaryFormationPlacement?: () => void;
};

type HoverState = {
  tile: HexTile;
  x: number;
  y: number;
};

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
  onQueueArmyMoveOrder,
  onQueueFleetMoveOrder,
  onQueueUnitAttackOrder,
  onQueueCivilianUnitMoveOrder,
  onFoundCityOrder,
  onQueueColonizer,
  queueingColonizerHexId = null,
  onOpenAdminHexEditor,
  onOpenHexKnowledge,
  onCreateHexKnowledge,
  onHexRenameCharged: _onHexRenameCharged,
  colonizationIconUrl: _colonizationIconUrl,
  ducatsIconUrl: _ducatsIconUrl,
  maxActiveColonizations: _maxActiveColonizations,
  landDivisionStackLimitPerHex = 4,
  hexRenameDucatsCost: _hexRenameDucatsCost,
  countryColorById,
  countryNameById,
  suggestedMapMode: _suggestedMapMode,
  suggestedMapLens,
  showMapControls = false,
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
  militaryFormationPlacement = null,
  onSelectMilitaryFormationPlacementTarget,
  onCancelMilitaryFormationPlacement,
}: Props) {
  const { t } = useUiText();
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
  const [edgeScrollEnabled, setEdgeScrollEnabled] = useState(() => readMapNavigationSettings(useGameStore.getState().auth?.countryId).edgeScrollEnabled);
  const [reducedMotion, setReducedMotion] = useState(() => reducedMotionRef.current);
  const [activeLens, setActiveLens] = useState<MapLensId>(() => readMapLensSetting(useGameStore.getState().auth?.countryId, suggestedMapLens ?? "terrain"));
  const [mapLayers, setMapLayers] = useState<MapLayerToggles>(() => readMapLayerSettings(useGameStore.getState().auth?.countryId));
  const [mapActionNotice, setMapActionNotice] = useState<string | null>(null);
  const [selectedBuildingPopoverHexId, setSelectedBuildingPopoverHexId] = useState<HexId | null>(null);
  const [expandedMapBuildingId, setExpandedMapBuildingId] = useState<string | null>(null);
  const [civilianMoveSelection, setCivilianMoveSelection] = useState<{ unitId: string; fromHexId: HexId } | null>(null);
  const [divisionMoveSelection, setDivisionMoveSelection] = useState<{ divisionId: string; fromHexId: HexId } | null>(null);
  const [fleetMoveSelection, setFleetMoveSelection] = useState<{ fleetId: string; fromHexId: HexId } | null>(null);
  const [divisionAttackSelection, setDivisionAttackSelection] = useState<{ divisionId: string; fromHexId: HexId } | null>(null);
  const [foundCityConfirmTarget, setFoundCityConfirmTarget] = useState<FoundCityConfirmTarget | null>(null);
  const [foundCityNameDraft, setFoundCityNameDraft] = useState("");
  const [mapBuildingBusyAction, setMapBuildingBusyAction] = useState<string | null>(null);
  const [mapBuildingConfirm, setMapBuildingConfirm] = useState<BuildingOverviewConfirmState | null>(null);
  const [mapBuildingEditingNameId, setMapBuildingEditingNameId] = useState<string | null>(null);
  const [mapBuildingRenameDraftById, setMapBuildingRenameDraftById] = useState<Record<string, string>>({});
  const [goods, setGoods] = useState<GoodMeta[]>([]);
  const [activeCountryModifiers, setActiveCountryModifiers] = useState<ActiveModifierRow[]>([]);

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
  const selectedSiteFeatures = selectedTile ? mapFeaturesByHexId.get(selectedTile.id) ?? [] : [];
  const selectedResourceDeposit = selectedTile ? resourceDepositsByHexId.get(selectedTile.id) ?? null : null;
  const hoverPath = useMemo(() => {
    if (!selectedTile || !hoverState?.tile || selectedTile.id === hoverState.tile.id) return [];
    return findHexPath(mapArtifact, selectedTile.id, hoverState.tile.id, 1600, tileById);
  }, [hoverState?.tile, mapArtifact, selectedTile, tileById]);
  const civilianMoveHoverPath = useMemo(() => {
    if (!civilianMoveSelection || !hoverState?.tile || civilianMoveSelection.fromHexId === hoverState.tile.id) return [];
    return findHexPath(mapArtifact, civilianMoveSelection.fromHexId, hoverState.tile.id, 1600, tileById);
  }, [civilianMoveSelection, hoverState?.tile, mapArtifact, tileById]);
  const divisionMoveHoverPath = useMemo(() => {
    if (!divisionMoveSelection || !hoverState?.tile || divisionMoveSelection.fromHexId === hoverState.tile.id) return [];
    return findHexPath(mapArtifact, divisionMoveSelection.fromHexId, hoverState.tile.id, 1600, tileById);
  }, [divisionMoveSelection, hoverState?.tile, mapArtifact, tileById]);
  const fleetMoveHoverPath = useMemo(() => {
    if (!fleetMoveSelection || !hoverState?.tile || fleetMoveSelection.fromHexId === hoverState.tile.id) return [];
    return findWaterHexPath(mapArtifact, fleetMoveSelection.fromHexId, hoverState.tile.id, 1600, tileById);
  }, [fleetMoveSelection, hoverState?.tile, mapArtifact, tileById]);
  const corridorFixedPreviewPath = useMemo(() => {
    if (!corridorPlacement || corridorPlacement.points.length < 2) return [];
    const result: HexId[] = [];
    for (let index = 1; index < corridorPlacement.points.length; index += 1) {
      const from = corridorPlacement.points[index - 1]?.hexId;
      const to = corridorPlacement.points[index]?.hexId;
      if (!from || !to) continue;
      const segment = findHexPath(mapArtifact, from, to, 1600, tileById);
      if (segment.length < 2) continue;
      if (result.length === 0) result.push(...segment);
      else result.push(...segment.slice(1));
    }
    return result;
  }, [corridorPlacement?.points, mapArtifact, tileById]);
  const corridorDraftPreviewPath = useMemo(() => {
    if (!corridorPlacement || corridorPlacement.points.length < 1 || !hoverState?.tile) return [];
    const last = corridorPlacement.points[corridorPlacement.points.length - 1];
    if (!last || last.hexId === hoverState.tile.id) return [];
    return findHexPath(mapArtifact, last.hexId, hoverState.tile.id, 1600, tileById);
  }, [corridorPlacement?.points, hoverState?.tile, mapArtifact, tileById]);
  const corridorHudPreviewPath = corridorDraftPreviewPath.length > 1
    ? mergeHexPaths(corridorFixedPreviewPath, corridorDraftPreviewPath)
    : corridorFixedPreviewPath;
  const civilianUnitById = useMemo(
    () => new Map(Object.values(worldBase?.civilianUnitsById ?? {}).map((unit) => [unit.id, unit] as const)),
    [worldBase?.civilianUnitsById],
  );
  const divisionById = useMemo(
    () => new Map(Object.values(worldBase?.divisionsById ?? {}).map((division) => [division.id, division] as const)),
    [worldBase?.divisionsById],
  );
  const fleetById = useMemo(
    () => new Map(Object.values(worldBase?.fleetsById ?? {}).map((fleet) => [fleet.id, fleet] as const)),
    [worldBase?.fleetsById],
  );
  const pendingDivisionActionIds = useMemo(() => {
    const byPlayer = ordersByTurn.get(turnId);
    const ids = new Set<string>();
    if (!byPlayer) return ids;
    for (const orders of byPlayer.values()) {
      for (const order of orders) {
        if (order.type === "UNIT_MOVE" && order.unitKind === "division") ids.add(order.unitId);
        if (order.type === "UNIT_ATTACK") ids.add(order.attackerUnitId);
        if (order.type === "ARMY_MOVE" && typeof order.payload?.divisionId === "string") ids.add(order.payload.divisionId);
      }
    }
    return ids;
  }, [ordersByTurn, turnId]);
  const pendingFleetActionIds = useMemo(() => {
    const byPlayer = ordersByTurn.get(turnId);
    const ids = new Set<string>();
    if (!byPlayer) return ids;
    for (const orders of byPlayer.values()) {
      for (const order of orders) {
        if (order.type === "UNIT_MOVE" && order.unitKind === "fleet") ids.add(order.unitId);
      }
    }
    return ids;
  }, [ordersByTurn, turnId]);
  const cityHexIds = useMemo(() => {
    return buildCityHexIdSet(worldBase);
  }, [worldBase]);
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
  const divisionsByHexId = useMemo(() => {
    const map = new Map<HexId, NonNullable<WorldBase["divisionsById"][string]>[]>();
    for (const division of Object.values(worldBase?.divisionsById ?? {})) {
      if ((division.kind ?? "land") !== "land") continue;
      const list = map.get(division.hexId) ?? [];
      list.push(division);
      map.set(division.hexId, list);
    }
    return map;
  }, [worldBase?.divisionsById]);
  const fleetsByHexId = useMemo(() => {
    const map = new Map<HexId, NonNullable<WorldBase["fleetsById"][string]>[]>();
    for (const fleet of Object.values(worldBase?.fleetsById ?? {})) {
      const list = map.get(fleet.hexId) ?? [];
      list.push(fleet);
      map.set(fleet.hexId, list);
    }
    return map;
  }, [worldBase?.fleetsById]);

  useEffect(() => {
    terrainMeshRendererRef.current?.setCityHexIds(cityHexIds);
    appRef.current?.render();
  }, [cityHexIds]);

  const selectedCivilianUnits = selectedTile ? civilianUnitsByHexId.get(selectedTile.id) ?? [] : [];
  const selectedDivisions = selectedTile ? divisionsByHexId.get(selectedTile.id) ?? [] : [];
  const selectedFleets = selectedTile ? fleetsByHexId.get(selectedTile.id) ?? [] : [];
  const selectedLandDivisionStackLimit = Math.max(1, Math.floor(Number(landDivisionStackLimitPerHex) || 4));
  const selectedCountryDivisionStackCount = authCountryId
    ? selectedDivisions.filter((division) => division.countryId === authCountryId && (division.kind ?? "land") === "land").length
    : selectedDivisions.filter((division) => (division.kind ?? "land") === "land").length;
  const selectedCivilianQueueItems = useMemo(() => {
    if (!selectedTile || !authCountryId) return [];
    return (worldBase?.civilianUnitQueueByCountry?.[authCountryId] ?? []).filter((item) => item.hexId === selectedTile.id);
  }, [authCountryId, selectedTile, worldBase?.civilianUnitQueueByCountry]);

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
  const militaryFormationValidHexIds = useMemo(
    () => new Set<HexId>(militaryFormationPlacement?.validHexIds ?? []),
    [militaryFormationPlacement],
  );

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
      MAP_LENS_DESCRIPTORS.map((lens) => ({
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

  const resolveOwnerName = useCallback(
    (tile: HexTile) => {
      const ownerId = worldBase?.regionOwner[tile.regionId] ?? worldBase?.hexOwner[tile.id];
      return ownerId ? t("hexMap.ownerCountry", { country: ownerId }) : t("hexMap.ownerNone");
    },
    [t, worldBase?.hexOwner, worldBase?.regionOwner],
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

  const applyTileInteraction = useCallback(
    (tile: HexTile | null) => {
      selectTile(tile);
      if (!tile) {
        setSelectedBuildingPopoverHexId(null);
        setExpandedMapBuildingId(null);
        setCivilianMoveSelection(null);
        setDivisionMoveSelection(null);
        setFleetMoveSelection(null);
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
      if (militaryFormationPlacement) {
        if (!militaryFormationValidHexIds.has(tile.id)) {
          setMapActionNotice(t("hexMap.formationPlacementInvalid"));
          return;
        }
        onSelectMilitaryFormationPlacementTarget?.({ hexId: tile.id, regionId: tile.regionId });
        return;
      }
      if (civilianMoveSelection) {
        if (tile.id === civilianMoveSelection.fromHexId) {
          setMapActionNotice(t("hexMap.civilianMoveSelectTarget"));
          return;
        }
        const path = findHexPath(mapArtifact, civilianMoveSelection.fromHexId, tile.id, 1600, tileById);
        if (path.length < 2) {
          setMapActionNotice(t("hexMap.civilianMoveNoPath"));
          return;
        }
        onQueueCivilianUnitMoveOrder?.(civilianMoveSelection.unitId, civilianMoveSelection.fromHexId, tile.id, path);
        setCivilianMoveSelection(null);
        setMapActionNotice(t("hexMap.civilianMoveOrderSent"));
        return;
      }
      if (divisionMoveSelection) {
        if (tile.id === divisionMoveSelection.fromHexId) {
          setMapActionNotice(t("hexMap.divisionMoveSelectTarget"));
          return;
        }
        const path = findHexPath(mapArtifact, divisionMoveSelection.fromHexId, tile.id, 1600, tileById);
        if (path.length < 2) {
          setMapActionNotice(t("hexMap.divisionMoveNoPath"));
          return;
        }
        onQueueArmyMoveOrder?.(divisionMoveSelection.divisionId, tile.id, path);
        setDivisionMoveSelection(null);
        setMapActionNotice(t("hexMap.divisionMoveOrderSent"));
        return;
      }
      if (fleetMoveSelection) {
        if (tile.id === fleetMoveSelection.fromHexId) {
          setMapActionNotice(t("hexMap.fleetMoveSelectTarget"));
          return;
        }
        const path = findWaterHexPath(mapArtifact, fleetMoveSelection.fromHexId, tile.id, 1600, tileById);
        if (path.length < 2) {
          setMapActionNotice(t("hexMap.fleetMoveNoPath"));
          return;
        }
        onQueueFleetMoveOrder?.(fleetMoveSelection.fleetId, tile.id, path);
        setFleetMoveSelection(null);
        setMapActionNotice(t("hexMap.fleetMoveOrderSent"));
        return;
      }
      if (divisionAttackSelection) {
        if (tile.id === divisionAttackSelection.fromHexId) {
          setMapActionNotice(t("hexMap.divisionAttackSelectTarget"));
          return;
        }
        const path = findHexPath(mapArtifact, divisionAttackSelection.fromHexId, tile.id, 2, tileById);
        const attacker = divisionById.get(divisionAttackSelection.divisionId);
        const targetDivisions = divisionsByHexId.get(tile.id) ?? [];
        const enemyDivision = targetDivisions.find((division) => attacker && division.countryId !== attacker.countryId) ?? null;
        const targetController = worldBase?.hexOwner?.[tile.id] ?? worldBase?.regionController?.[tile.regionId] ?? worldBase?.regionOwner?.[tile.regionId] ?? null;
        const attackableByControl = Boolean(attacker && targetController && targetController !== attacker.countryId);
        if (path.length !== 2 || !attacker || (!enemyDivision && !attackableByControl)) {
          setMapActionNotice(t("hexMap.divisionAttackNoTarget"));
          return;
        }
        onQueueUnitAttackOrder?.(divisionAttackSelection.divisionId, tile.id, enemyDivision?.id ?? null);
        setDivisionAttackSelection(null);
        setMapActionNotice(t("hexMap.divisionAttackOrderSent"));
        return;
      }
      if (mapBuildingItemByHexId.has(tile.id)) {
        setSelectedBuildingPopoverHexId(tile.id);
        setExpandedMapBuildingId(null);
      } else {
        setSelectedBuildingPopoverHexId(null);
        setExpandedMapBuildingId(null);
      }
    },
    [
      civilianMoveSelection,
      corridorPlacement,
      divisionAttackSelection,
      divisionById,
      divisionMoveSelection,
      divisionsByHexId,
      fleetMoveSelection,
      hexBuildPlacement,
      mapBuildingItemByHexId,
      mapArtifact,
      militaryFormationPlacement,
      militaryFormationValidHexIds,
      onQueueArmyMoveOrder,
      onQueueCivilianUnitMoveOrder,
      onQueueFleetMoveOrder,
      onQueueUnitAttackOrder,
      onSelectCorridorPlacementPoint,
      onSelectHexBuildPlacementTarget,
      onSelectMilitaryFormationPlacementTarget,
      placementEvaluations,
      selectTile,
      t,
      worldBase?.hexOwner,
      worldBase?.regionController,
      worldBase?.regionOwner,
    ],
  );

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
    setActiveLens(readMapLensSetting(authCountryId, suggestedMapLens ?? "terrain"));
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
        app.render();
      });
      resizeObserver.observe(container);
      setPixiReady(true);
      app.render();
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
      if (militaryFormationPlacement && event.button === 2) {
        if (blocked) return;
        event.preventDefault();
        onCancelMilitaryFormationPlacement?.();
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
      if (fleetMoveSelection && event.button === 2) {
        if (blocked) return;
        event.preventDefault();
        setFleetMoveSelection(null);
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
        applyTileInteraction(tile);
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
      setSelectedBuildingPopoverHexId(null);
      setExpandedMapBuildingId(null);
      if (hexBuildPlacement) {
        onCancelHexBuildPlacement?.();
      }
      if (corridorPlacement) {
        onCancelCorridorPlacement?.();
      }
      if (militaryFormationPlacement) {
        onCancelMilitaryFormationPlacement?.();
      }
      setDivisionMoveSelection(null);
      setDivisionAttackSelection(null);
      setFleetMoveSelection(null);
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
  }, [applyTileInteraction, cameraBounds, centerOnTile, civilianMoveSelection, corridorPlacement, divisionAttackSelection, divisionMoveSelection, fleetMoveSelection, hexBuildPlacement, interactionLocked, mapArtifact, militaryFormationPlacement, onCancelCorridorPlacement, onCancelHexBuildPlacement, onCancelMilitaryFormationPlacement, serverMapArtifact, setCameraTarget, tileById]);

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
    if (!militaryFormationPlacement) return;
    const handleCancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onCancelMilitaryFormationPlacement?.();
    };
    window.addEventListener("keydown", handleCancel);
    return () => window.removeEventListener("keydown", handleCancel);
  }, [militaryFormationPlacement, onCancelMilitaryFormationPlacement]);

  useEffect(() => {
    if (!civilianMoveSelection) return;
    const handleCancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCivilianMoveSelection(null);
    };
    window.addEventListener("keydown", handleCancel);
    return () => window.removeEventListener("keydown", handleCancel);
  }, [civilianMoveSelection]);

  useEffect(() => {
    if (!divisionMoveSelection && !divisionAttackSelection && !fleetMoveSelection) return;
    const handleCancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDivisionMoveSelection(null);
      setDivisionAttackSelection(null);
      setFleetMoveSelection(null);
    };
    window.addEventListener("keydown", handleCancel);
    return () => window.removeEventListener("keydown", handleCancel);
  }, [divisionAttackSelection, divisionMoveSelection, fleetMoveSelection]);

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
        centerOnTile(selectedTileIdRef.current ? tileById.get(selectedTileIdRef.current) ?? null : null);
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
  }, [centerOnTile, interactionLocked, tileById]);

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
    app.render();
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
    app.render();
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
    app.render();
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
    if (militaryFormationPlacement && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const colors = getPlacementOverlayColors(containerRef.current);
      for (const hexId of militaryFormationValidHexIds) {
        const tile = tileById.get(hexId);
        if (!tile || !isTileInViewport(tile, camera, rect, mapArtifact.settings.hexSize)) continue;
        drawHexFillAndOutline(overlayLayer, tile, mapArtifact.settings.hexSize, colors.fill, colors.border);
      }
    }
    if (selectedTile) {
      drawHexOutline(overlayLayer, selectedTile, mapArtifact.settings.hexSize, 0xf5d56b, 2.6);
    }
    const activePath = fleetMoveSelection
      ? fleetMoveHoverPath
      : divisionMoveSelection
        ? divisionMoveHoverPath
        : civilianMoveSelection
          ? civilianMoveHoverPath
          : hoverPath;
    if (activePath.length > 1) {
      drawPathOverlay(overlayLayer, activePath, tileById, mapArtifact.settings.hexSize);
    }
    app.render();
  }, [camera, civilianMoveHoverPath, civilianMoveSelection, divisionMoveHoverPath, divisionMoveSelection, fleetMoveHoverPath, fleetMoveSelection, hexBuildPlacement, hoverPath, hoverState, mapArtifact.settings.hexSize, militaryFormationPlacement, militaryFormationValidHexIds, pixiReady, placementEvaluations, selectedTile, tileById]);

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
      if (tile.feature === "none") continue;
      activeKeys.add(tile.id);
      if (!viewportCulling.visibleTileIds.has(tile.id) || !isTileInViewport(tile, camera, rect, size)) continue;
      const visible = updateNaturalFeatureSprite(getPooledSprite(layer, spritePool, tile.id), {
        tile,
        scenarioId,
        visualRules: mapFeatureVisuals,
        size,
        cameraScale: camera.scale,
        onReady: () => setFeatureTextureVersion((value) => value + 1),
      });
      if (!visible) continue;
      visibleSprites += 1;
    }
    pruneLayerPool(spritePool, activeKeys);
    performanceStatsRef.current.visibleSprites += visibleSprites;
    app.render();
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
        cameraScale: camera.scale,
        onReady: () => setFeatureTextureVersion((value) => value + 1),
      });
      if (!visible) continue;
      visibleSprites += 1;
    }
    pruneLayerPool(spritePool, activeKeys);
    performanceStatsRef.current.visibleSprites += visibleSprites;
    app.render();
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
    app.render();
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
      app.render();
      return;
    }
    const corridorTileLayers = new Map<string, Map<HexId, number>>();
    for (const corridor of transportCorridors) {
      const path = normalizeCorridorPath(corridor.computedHexIds && corridor.computedHexIds.length >= 2 ? corridor.computedHexIds : corridor.hexIds);
      addCorridorPathMasks(corridorTileLayers, path, tileById, mapArtifact.settings, corridor.transportMode, getCorridorAtlasStatus(corridor));
    }
    drawTexturedCorridorTiles(layer, corridorTileLayers, tileById, size, textures, false, 1, viewportCulling.visibleTileIds);
    app.render();
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
      app.render();
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
    app.render();
  }, [corridorDraftPreviewPath, corridorFixedPreviewPath, corridorPlacement?.transportMode, corridorTextureVersion, mapArtifact.settings, mapArtifact.settings.hexSize, pixiReady, scenarioId, tileById, viewportCulling.key, viewportCulling.visibleTileIds]);

  useEffect(() => {
    const layer = buildingLayerRef.current;
    const spritePool = buildingSpritePoolRef.current;
    const graphicsPool = buildingGraphicsPoolRef.current;
    const app = appRef.current;
    const showBuildings = mapLayers.buildings || Boolean(hexBuildPlacement) || Boolean(militaryFormationPlacement);
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
        const markerSize = Math.max(size * 0.82, Math.min(size * 1.42, 40 / Math.max(0.35, camera.scale)));
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
    app.render();
  }, [buildingTextureVersion, camera.scale, canceledConstructionQueueKeySet, hexBuildPlacement, mapArtifact.settings.hexSize, mapLayers.buildings, militaryFormationPlacement, pendingBuildMarkers, pendingFoundCityMarkers, pixiReady, scenarioId, tileById, viewportCulling.key, viewportCulling.visibleTileIds, worldBase, zoomBucket]);

  useEffect(() => {
    const layer = unitLayerRef.current;
    const graphicsPool = unitGraphicsPoolRef.current;
    const app = appRef.current;
    if (!pixiReady || !layer || !app || !worldBase || !mapLayers.armies || zoomBucket === "far") {
      hideLayerPool(graphicsPool);
      return;
    }
    hideLayerPool(graphicsPool);
    const activeKeys = new Set<string>();
    const size = mapArtifact.settings.hexSize;
    const styles = getComputedStyle(document.documentElement);
    const strokeColor = cssColorToHexNumber(styles.getPropertyValue("--arc-map-building-marker-stroke").trim(), 0x261433);
    for (const division of Object.values(worldBase.divisionsById ?? {})) {
      if ((division.kind ?? "land") !== "land") continue;
      const key = `division:${division.id}`;
      activeKeys.add(key);
      const tile = tileById.get(division.hexId);
      if (!tile || !viewportCulling.visibleTileIds.has(tile.id)) continue;
      const center = axialToPixel(tile, size);
      const fillColor = cssColorToHexNumber(countryColorById?.[division.countryId] ?? "", 0x9a3f39);
      const marker = getPooledGraphics(layer, graphicsPool, key);
      const markerSize = Math.max(size * 0.24, Math.min(size * 0.46, 18 / Math.max(0.35, camera.scale)));
      marker
        .moveTo(center.x - markerSize * 0.55, center.y + size * 0.1)
        .lineTo(center.x + markerSize * 0.55, center.y + size * 0.1)
        .lineTo(center.x, center.y - markerSize * 0.75)
        .closePath()
        .fill({ color: fillColor, alpha: 0.95 });
      marker
        .moveTo(center.x - markerSize * 0.55, center.y + size * 0.1)
        .lineTo(center.x + markerSize * 0.55, center.y + size * 0.1)
        .lineTo(center.x, center.y - markerSize * 0.75)
        .closePath()
        .stroke({ color: strokeColor, width: 1.5, alpha: 0.95 });
      marker.visible = true;
    }
    for (const fleet of Object.values(worldBase.fleetsById ?? {})) {
      const key = `fleet:${fleet.id}`;
      activeKeys.add(key);
      const tile = tileById.get(fleet.hexId);
      if (!tile || !viewportCulling.visibleTileIds.has(tile.id)) continue;
      const center = axialToPixel(tile, size);
      const fillColor = cssColorToHexNumber(countryColorById?.[fleet.countryId] ?? "", 0x3d7fa6);
      const marker = getPooledGraphics(layer, graphicsPool, key);
      const markerSize = Math.max(size * 0.26, Math.min(size * 0.5, 20 / Math.max(0.35, camera.scale)));
      marker
        .moveTo(center.x - markerSize * 0.7, center.y + size * 0.12)
        .lineTo(center.x + markerSize * 0.7, center.y + size * 0.12)
        .lineTo(center.x + markerSize * 0.42, center.y + size * 0.28)
        .lineTo(center.x - markerSize * 0.42, center.y + size * 0.28)
        .closePath()
        .fill({ color: fillColor, alpha: 0.95 });
      marker
        .moveTo(center.x - markerSize * 0.7, center.y + size * 0.12)
        .lineTo(center.x + markerSize * 0.7, center.y + size * 0.12)
        .lineTo(center.x + markerSize * 0.42, center.y + size * 0.28)
        .lineTo(center.x - markerSize * 0.42, center.y + size * 0.28)
        .closePath()
        .stroke({ color: strokeColor, width: 1.4, alpha: 0.95 });
      marker
        .moveTo(center.x - markerSize * 0.08, center.y + size * 0.1)
        .lineTo(center.x - markerSize * 0.08, center.y - markerSize * 0.65)
        .lineTo(center.x + markerSize * 0.38, center.y - markerSize * 0.14)
        .lineTo(center.x - markerSize * 0.08, center.y - markerSize * 0.14)
        .closePath()
        .fill({ color: 0xf3ead2, alpha: 0.92 });
      marker.visible = true;
    }
    for (const unit of Object.values(worldBase.civilianUnitsById ?? {})) {
      if (unit.status === "captured" || pendingFoundCityUnitIds.has(unit.id)) continue;
      const key = `civilian:${unit.id}`;
      activeKeys.add(key);
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
    pruneLayerPool(graphicsPool, activeKeys);
    app.render();
  }, [camera.scale, countryColorById, mapArtifact.settings.hexSize, mapLayers.armies, pendingFoundCityUnitIds, pixiReady, tileById, viewportCulling.key, viewportCulling.visibleTileIds, worldBase, zoomBucket]);

  const selectedName = selectedTile ? resolveHexName(selectedTile) : null;
  const selectedTerrainLabel = selectedTile ? t(`hexMap.terrain.${selectedTile.terrain}`) : "";
  const selectedHasCity = Boolean(selectedTile && cityHexIds.has(selectedTile.id));
  const selectedRegionIsNeutral = selectedTile
    ? !worldBase?.regionOwner[selectedTile.regionId] && !worldBase?.regionController[selectedTile.regionId]
    : false;
  const selectedRegionIsControlled = selectedTile && authCountryId
    ? (worldBase?.regionController[selectedTile.regionId] ?? worldBase?.regionOwner[selectedTile.regionId] ?? null) === authCountryId
    : false;
  const canQueueColonizerOnSelectedHex = Boolean(
    selectedTile &&
      selectedRegionIsControlled &&
      selectedCivilianUnits.length === 0 &&
      selectedCivilianQueueItems.length === 0 &&
      onQueueColonizer,
  );
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
      {showMapControls ? (
        <MapControlsHud
          view={{ zoom: camera.scale, lng: camera.x, lat: camera.y }}
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
      {militaryFormationPlacement ? (
        <div className="arc-map-build-placement-hud arc-hud-panel" role="status">
          <div className="arc-hud-content">
            <strong>{militaryFormationPlacement.templateName}</strong>
            <span>{t("hexMap.formationPlacementHud")}</span>
            <button type="button" className="map-btn" onClick={onCancelMilitaryFormationPlacement}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : null}
      {corridorPlacement ? (
        <CorridorBuildHud
          points={corridorPlacement.points}
          hexIds={corridorHudPreviewPath}
          transportMode={corridorPlacement.transportMode}
          costConstruction={corridorPlacement.costConstruction ?? null}
          connectedRegionIds={corridorPlacement.connectedRegionIds ?? []}
          blockingReason={corridorPlacement.blockingReason ?? null}
          pending={corridorPlacement.pending}
          getHexDisplayName={(hexId) => hexId}
          onUndoPoint={onUndoCorridorPlacementPoint ?? (() => undefined)}
          onCancel={onCancelCorridorPlacement ?? (() => undefined)}
          onConfirm={onConfirmCorridorPlacement ?? (() => undefined)}
        />
      ) : null}
      {civilianMoveSelection ? (
        <div className="arc-map-build-placement-hud arc-hud-panel" role="status">
          <div className="arc-hud-content">
            <strong>{t("hexMap.civilianMove")}</strong>
            <span>{t("hexMap.civilianMoveSelectTarget")}</span>
            <span>
              {t("hexMap.civilianMovePreview", {
                cost: formatCompactNumber(civilianMovePreviewCost),
                points: formatCompactNumber(Math.max(0, Number(civilianUnitById.get(civilianMoveSelection.unitId)?.movementPoints ?? 0))),
              })}
            </span>
            <button type="button" className="map-btn" onClick={() => setCivilianMoveSelection(null)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : null}
      {cityLabels.map((label) => (
        <div
          key={label.key}
          className={`arc-map-city-label${label.pending ? " arc-map-city-label--pending" : ""}`}
          style={{ left: label.left, top: label.top }}
          aria-hidden="true"
        >
          <span className="arc-map-city-label__flag">
            {label.flagUrl ? <img src={label.flagUrl} alt="" /> : label.ownerName.slice(0, 1).toUpperCase()}
          </span>
          <span className="arc-map-city-label__name">{label.name}</span>
          {label.progress != null ? (
            <span className="arc-map-city-label__progress" aria-hidden="true">
              <span style={{ width: `${Math.round(label.progress * 100)}%` }} />
            </span>
          ) : null}
        </div>
      ))}
      {selectedTile ? (
        <section className="arc-hex-map__selection arc-hud-panel">
          <div className="arc-hud-content">
            <header className="arc-hex-map__selection-header">
              <div>
                <p>{t("hexMap.selected")}</p>
                <h3>{selectedName}</h3>
              </div>
              <span>{selectedTile.id}</span>
            </header>
            <div className="arc-hex-map__detail-grid">
              <HexDetail icon={<Info size={14} />} label={t("hexMap.region")} value={selectedTile.regionId} />
              <HexDetail icon={<Mountain size={14} />} label={t("hexMap.terrain")} value={selectedTerrainLabel} />
              <HexDetail icon={<Leaf size={14} />} label={t("hexMap.feature")} value={selectedHasCity ? `${t(`hexMap.feature.${selectedTile.feature}`)} · ${t("hexMap.feature.city")}` : t(`hexMap.feature.${selectedTile.feature}`)} />
              {selectedSiteFeatures.length > 0 ? (
                <HexDetail icon={<Leaf size={14} />} label={t("hexMap.siteFeature")} value={selectedSiteFeatures.map((feature) => resolveMapFeatureLabel(feature, t)).join(", ")} />
              ) : null}
              {selectedResourceDeposit ? (
                <HexDetail icon={<Gem size={14} />} label={t("hexMap.resourceDeposit")} value={formatResourceDepositLabel(selectedResourceDeposit)} />
              ) : null}
              <HexDetail icon={<Waves size={14} />} label={t("hexMap.water")} value={selectedTile.waterKind ? t(`hexMap.water.${selectedTile.waterKind}`) : t("hexMap.water.none")} />
              <HexDetail icon={<Info size={14} />} label={t("hexMap.owner")} value={resolveOwnerName(selectedTile)} />
              <HexDetail icon={<Info size={14} />} label={t("hexMap.movementCost")} value={selectedTile.movementCost.toFixed(1)} />
              <HexDetail
                icon={<Users size={14} />}
                label={t("hexMap.divisionStack")}
                value={t("hexMap.divisionStackValue", {
                  current: selectedCountryDivisionStackCount,
                  max: selectedLandDivisionStackLimit,
                })}
                tooltip={{
                  title: t("hexMap.divisionStack"),
                  description: t("hexMap.divisionStackTooltip", {
                    current: selectedCountryDivisionStackCount,
                    max: selectedLandDivisionStackLimit,
                  }),
                  tone: selectedCountryDivisionStackCount >= selectedLandDivisionStackLimit ? "warning" : "info",
                }}
              />
            </div>
            {selectedDivisions.length > 0 ? (
              <div className="arc-hex-map__unit-list">
                <div className="arc-hex-map__unit-list-title">{t("hexMap.divisions")}</div>
                {selectedDivisions.map((division) => {
                  const hasPendingAction = pendingDivisionActionIds.has(division.id);
                  const canControlDivision = division.countryId === authCountryId && (division.kind ?? "land") === "land";
                  const neighborTiles = getNeighborTiles(selectedTile, tileById, mapArtifact.settings);
                  const hasAttackableNeighbor = neighborTiles.some((neighbor) => {
                    const enemyDivision = (divisionsByHexId.get(neighbor.id) ?? []).some((candidate) => candidate.countryId !== division.countryId);
                    const controller = worldBase?.hexOwner?.[neighbor.id] ?? worldBase?.regionController?.[neighbor.regionId] ?? worldBase?.regionOwner?.[neighbor.regionId] ?? null;
                    return enemyDivision || Boolean(controller && controller !== division.countryId);
                  });
                  const canMoveDivision = Boolean(onQueueArmyMoveOrder) && canControlDivision && !hasPendingAction;
                  const canAttackDivision = Boolean(onQueueUnitAttackOrder) && canControlDivision && !hasPendingAction && hasAttackableNeighbor;
                  return (
                    <div key={division.id} className="arc-hex-map__unit-row">
                      <div>
                        <strong>{division.name || division.id}</strong>
                        <span>
                          {t("hexMap.divisionStatus", { strength: Math.round(Number(division.strength ?? 0) * 100), organization: Math.round(Number(division.organization ?? 0)) })}
                          {typeof division.equipmentCoverage === "number"
                            ? ` · ${t("hexMap.divisionEquipmentCoverage", { value: Math.round(Math.max(0, Math.min(1, division.equipmentCoverage)) * 100) })}`
                            : ""}
                        </span>
                      </div>
                      <Tooltip content={t(canMoveDivision ? "hexMap.divisionMoveTooltipCan" : "hexMap.divisionMoveTooltipCannot")}>
                        <button
                          type="button"
                          className="map-btn"
                          disabled={!canMoveDivision}
                          onClick={() => {
                            if (!canMoveDivision) {
                              setMapActionNotice(t("hexMap.divisionMoveUnavailable"));
                              return;
                            }
                            setDivisionAttackSelection(null);
                            setDivisionMoveSelection({ divisionId: division.id, fromHexId: selectedTile.id });
                            setMapActionNotice(t("hexMap.divisionMoveSelectTarget"));
                          }}
                        >
                          <Move size={15} />
                          <span>{t("hexMap.divisionMove")}</span>
                        </button>
                      </Tooltip>
                      <Tooltip content={t(canAttackDivision ? "hexMap.divisionAttackTooltipCan" : "hexMap.divisionAttackTooltipCannot")}>
                        <button
                          type="button"
                          className="map-btn"
                          disabled={!canAttackDivision}
                          onClick={() => {
                            if (!canAttackDivision) {
                              setMapActionNotice(t("hexMap.divisionAttackUnavailable"));
                              return;
                            }
                            setDivisionMoveSelection(null);
                            setDivisionAttackSelection({ divisionId: division.id, fromHexId: selectedTile.id });
                            setMapActionNotice(t("hexMap.divisionAttackSelectTarget"));
                          }}
                        >
                          <Shield size={15} />
                          <span>{t("hexMap.divisionAttack")}</span>
                        </button>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {selectedFleets.length > 0 ? (
              <div className="arc-hex-map__unit-list">
                <div className="arc-hex-map__unit-list-title">{t("hexMap.fleets")}</div>
                {selectedFleets.map((fleet) => {
                  const hasPendingAction = pendingFleetActionIds.has(fleet.id);
                  const canControlFleet = fleet.countryId === authCountryId;
                  const canMoveFleet = Boolean(onQueueFleetMoveOrder) && canControlFleet && !hasPendingAction;
                  return (
                    <div key={fleet.id} className="arc-hex-map__unit-row">
                      <div>
                        <strong>{fleet.name || fleet.id}</strong>
                        <span>
                          {t("hexMap.fleetStatus", {
                            strength: Math.round(Number(fleet.strength ?? 0) * 100),
                            organization: Math.round(Number(fleet.organization ?? 0)),
                          })}
                          {typeof fleet.equipmentCoverage === "number"
                            ? ` · ${t("hexMap.divisionEquipmentCoverage", { value: Math.round(Math.max(0, Math.min(1, fleet.equipmentCoverage)) * 100) })}`
                            : ""}
                        </span>
                      </div>
                      <Tooltip content={t(canMoveFleet ? "hexMap.fleetMoveTooltipCan" : "hexMap.fleetMoveTooltipCannot")}>
                        <button
                          type="button"
                          className="map-btn"
                          disabled={!canMoveFleet}
                          onClick={() => {
                            if (!canMoveFleet) {
                              setMapActionNotice(t("hexMap.fleetMoveUnavailable"));
                              return;
                            }
                            setCivilianMoveSelection(null);
                            setDivisionMoveSelection(null);
                            setDivisionAttackSelection(null);
                            setFleetMoveSelection({ fleetId: fleet.id, fromHexId: selectedTile.id });
                            setMapActionNotice(t("hexMap.fleetMoveSelectTarget"));
                          }}
                        >
                          <Ship size={15} />
                          <span>{t("hexMap.fleetMove")}</span>
                        </button>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {selectedCivilianUnits.length > 0 ? (
              <div className="arc-hex-map__unit-list">
                <div className="arc-hex-map__unit-list-title">{t("hexMap.civilianUnits")}</div>
                {selectedCivilianUnits.map((unit) => {
                  const canFoundCity = unit.countryId === authCountryId && unit.type === "colonizer" && unit.status !== "captured" && selectedRegionIsNeutral;
                  const canMoveCivilian =
                    Boolean(onQueueCivilianUnitMoveOrder) &&
                    unit.countryId === authCountryId &&
                    unit.status !== "captured" &&
                    Math.max(0, Number(unit.movementPoints ?? 0)) > 0;
                  return (
                    <div key={unit.id} className="arc-hex-map__unit-row">
                      <div>
                        <strong>{unit.type === "colonizer" ? t("hexMap.civilianColonizer") : unit.id}</strong>
                        <span>
                          {unit.status === "captured"
                            ? t("hexMap.civilianCaptured")
                            : t("hexMap.civilianMovement", { current: Math.max(0, Math.floor(unit.movementPoints)), max: Math.max(0, Math.floor(unit.maxMovementPoints)) })}
                        </span>
                      </div>
                      <Tooltip content={t(canMoveCivilian ? "hexMap.civilianMoveTooltipCan" : "hexMap.civilianMoveTooltipCannot")}>
                        <button
                          type="button"
                          className="map-btn"
                          disabled={!canMoveCivilian}
                          onClick={() => {
                            if (!canMoveCivilian) {
                              setMapActionNotice(t("hexMap.civilianMoveUnavailable"));
                              return;
                            }
                            setCivilianMoveSelection({ unitId: unit.id, fromHexId: selectedTile.id });
                            setMapActionNotice(t("hexMap.civilianMoveSelectTarget"));
                          }}
                        >
                          <Move size={15} />
                          <span>{t("hexMap.civilianMove")}</span>
                        </button>
                      </Tooltip>
                      <Tooltip content={t(canFoundCity ? "hexMap.foundCityTooltipCan" : "hexMap.foundCityTooltipCannot")}>
                        <button
                          type="button"
                          className="map-btn"
                          disabled={!canFoundCity}
                          onClick={() => {
                            if (!canFoundCity) {
                              setMapActionNotice(t("hexMap.foundCityNeutralRequired"));
                              return;
                            }
                            const ownerCountry = buildingOverviewCountries.find((country) => country.id === unit.countryId) ?? null;
                            setFoundCityNameDraft("");
                            setFoundCityConfirmTarget({
                              civilianUnitId: unit.id,
                              hexId: selectedTile.id,
                              regionId: selectedTile.regionId,
                              countryId: unit.countryId,
                              ownerName: ownerCountry?.name ?? countryNameById?.[unit.countryId] ?? unit.countryId,
                              ownerFlagUrl: ownerCountry?.flagUrl ?? null,
                              costColonization: worldBase?.regionColonizationByRegion?.[selectedTile.regionId]?.cost ?? null,
                            });
                          }}
                        >
                          <Flag size={15} />
                          <span>{t("hexMap.foundCity")}</span>
                        </button>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {selectedCivilianQueueItems.length > 0 ? (
              <div className="arc-hex-map__unit-list">
                <div className="arc-hex-map__unit-list-title">{t("hexMap.civilianQueue")}</div>
                {selectedCivilianQueueItems.map((item) => (
                  <div key={item.id} className="arc-hex-map__unit-row">
                    <div>
                      <strong>{item.type === "colonizer" ? t("hexMap.civilianColonizer") : item.id}</strong>
                      <span>{t("hexMap.civilianQueueProgress", { current: item.turnsTotal - item.turnsRemaining, total: item.turnsTotal })}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="arc-hex-map__actions">
              {onQueueColonizer ? (
                <Tooltip content={t(canQueueColonizerOnSelectedHex ? "hexMap.queueColonizerTooltipCan" : "hexMap.queueColonizerTooltipCannot")}>
                  <button
                    type="button"
                    className="map-btn"
                    disabled={!canQueueColonizerOnSelectedHex || queueingColonizerHexId === selectedTile.id}
                    onClick={() => {
                      if (!canQueueColonizerOnSelectedHex) {
                        setMapActionNotice(t("hexMap.queueColonizerUnavailable"));
                        return;
                      }
                      onQueueColonizer(selectedTile.id);
                    }}
                  >
                    <Users size={15} />
                    <span>{queueingColonizerHexId === selectedTile.id ? t("hexMap.queueColonizerPending") : t("hexMap.queueColonizer")}</span>
                  </button>
                </Tooltip>
              ) : null}
              {onOpenAdminHexEditor ? (
                <Tooltip content={t("hexMap.adminTooltip")}>
                  <button type="button" className="map-btn" onClick={() => onOpenAdminHexEditor(selectedTile.regionId)}>
                    <Info size={15} />
                    <span>{t("hexMap.admin")}</span>
                  </button>
                </Tooltip>
              ) : null}
              {onOpenHexKnowledge ? (
                <Tooltip content={t("hexMap.arcawikiTooltip")}>
                  <button type="button" className="map-btn" onClick={() => onOpenHexKnowledge(selectedTile.regionId, selectedName ?? selectedTile.regionId)}>
                    <BookOpen size={15} />
                    <span>{t("hexMap.arcawiki")}</span>
                  </button>
                </Tooltip>
              ) : null}
              {onCreateHexKnowledge ? (
                <Tooltip content={t("hexMap.createArcawikiTooltip")}>
                  <button type="button" className="map-btn" onClick={() => onCreateHexKnowledge(selectedTile.regionId, selectedName ?? selectedTile.regionId)}>
                    <BookOpen size={15} />
                    <span>{t("hexMap.createArcawiki")}</span>
                  </button>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </section>
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
        <HexHoverTooltip
          open
          x={hoverState.x}
          y={hoverState.y}
          hexName={resolveHexName(hoverState.tile)}
          areaKm2={null}
          ownerName={resolveOwnerName(hoverState.tile)}
          colonizers={[]}
          modeLabel={t("map.lens.hoverMode")}
          modeRows={[
            { label: t("map.lens.activeLens"), value: t(activeLensDescriptor.labelKey) },
            { label: t("hexMap.region"), value: hoverState.tile.regionId },
            {
              label: t("hexMap.terrain"),
              value: t(`hexMap.terrain.${hoverState.tile.terrain}`),
            },
            { label: t("hexMap.biome"), value: t(`hexMap.biome.${hoverState.tile.biome}`) },
            { label: t("hexMap.feature"), value: cityHexIds.has(hoverState.tile.id) ? `${t(`hexMap.feature.${hoverState.tile.feature}`)} · ${t("hexMap.feature.city")}` : t(`hexMap.feature.${hoverState.tile.feature}`) },
            ...(mapFeaturesByHexId.get(hoverState.tile.id)?.length
              ? [
                  {
                    label: t("hexMap.siteFeature"),
                    value: (mapFeaturesByHexId.get(hoverState.tile.id) ?? []).map((feature) => resolveMapFeatureLabel(feature, t)).join(", "),
                  },
                ]
              : []),
            ...(resourceDepositsByHexId.get(hoverState.tile.id)
              ? [
                  {
                    label: t("hexMap.resourceDeposit"),
                    value: formatResourceDepositLabel(resourceDepositsByHexId.get(hoverState.tile.id)!),
                  },
                ]
              : []),
            ...(hexBuildingTooltipByHexId.get(hoverState.tile.id)
              ? [
                  {
                    label: t("hexMap.building"),
                    value: `${hexBuildingTooltipByHexId.get(hoverState.tile.id)?.name ?? ""} · ${t(hexBuildingTooltipByHexId.get(hoverState.tile.id)?.statusKey ?? "hexMap.buildingStatusWorking")}`,
                    tone: hexBuildingTooltipByHexId.get(hoverState.tile.id)?.tone,
                  },
                ]
              : []),
          ]}
        />
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
        ".arc-hud-panel",
        ".arc-map-building-popover",
        "[role='dialog']",
        "[aria-modal='true']",
        "button",
        "input",
        "select",
        "textarea",
        "a[href]",
        "[role='button']",
        "[role='link']",
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

function HexDetail({ icon, label, value, tooltip }: { icon: ReactNode; label: string; value: string; tooltip?: TooltipStructuredContent }) {
  const content = (
    <div className="arc-hex-map__detail">
      <span className="arc-hex-map__detail-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
  if (!tooltip) return content;
  return (
    <Tooltip content={tooltip} variant="rich" placement="left" referenceClassName="arc-hex-map__detail-tooltip-ref">
      {content}
    </Tooltip>
  );
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

function drawHexFillAndOutline(graphics: Graphics, tile: HexTile, size: number, fillColor: number, borderColor: number): void {
  const center = axialToPixel(tile, size);
  const points = Array.from({ length: 6 }, (_, index) => hexCorner(center, size - 0.7, index)).flatMap((point) => [point.x, point.y]);
  graphics.poly(points, true).fill({ color: fillColor, alpha: 0.45 }).stroke({ color: borderColor, width: 2.2, alpha: 0.9 });
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
  cameraScale: number;
  onReady: () => void;
}): boolean {
  const visualId = resolveNaturalFeatureVisualId(params.tile.feature);
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
  const markerSize = Math.max(params.size * 0.52, Math.min(params.size * 0.95, 28 / Math.max(0.35, params.cameraScale)));
  sprite.width = markerSize;
  sprite.height = markerSize;
  sprite.alpha = resolveNaturalFeatureAlpha(params.tile.feature);
  sprite.visible = true;
  return true;
}

function updateSiteFeatureSprite(sprite: Sprite, params: {
  feature: MapFeatureInstance;
  tile: HexTile;
  scenarioId: string | null | undefined;
  visualRules: MapFeatureVisualRuleDefinition[];
  size: number;
  cameraScale: number;
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
  const markerSize = Math.max(params.size * 0.68, Math.min(params.size * 1.16, 34 / Math.max(0.35, params.cameraScale)));
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

function resolveNaturalFeatureVisualId(feature: HexFeature): MapFeatureVisualId | null {
  return feature === "none" ? null : NATURAL_FEATURE_VISUAL_IDS[feature];
}

function resolveNaturalFeatureAlpha(feature: HexFeature): number {
  if (feature === "snowcap") return 0.78;
  if (feature === "scrub") return 0.74;
  return 0.86;
}

function resolveMapFeatureLabel(feature: MapFeatureInstance, t: (key: UiTextKey) => string): string {
  return feature.nameKey ? t(feature.nameKey as UiTextKey) : feature.typeId;
}

function formatResourceDepositLabel(deposit: RegionResourceDeposit): string {
  const amount = Math.max(0, Number(deposit.amount ?? 0));
  const maxAmount = Math.max(amount, Number(deposit.maxAmount ?? 0));
  return `${deposit.goodId} · ${formatCompactNumber(amount)} / ${formatCompactNumber(maxAmount)}`;
}

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

function getNeighborTiles(tile: HexTile, tileById: ReadonlyMap<HexId, HexTile>, settings: HexMapSettings): HexTile[] {
  const tiles: HexTile[] = [];
  for (let direction = 0; direction < 6; direction += 1) {
    const axial = getNeighborAxial(tile, direction as 0 | 1 | 2 | 3 | 4 | 5, settings);
    if (!axial) continue;
    const neighbor = tileById.get(makeHexId(axial.q, axial.r));
    if (neighbor) tiles.push(neighbor);
  }
  return tiles;
}

function findWaterHexPath(
  map: HexMapArtifact,
  fromHexId: HexId,
  targetHexId: HexId,
  limit = 1600,
  tileById: ReadonlyMap<HexId, HexTile> = new Map(map.tiles.map((tile) => [tile.id, tile] as const)),
): HexId[] {
  if (fromHexId === targetHexId) return [fromHexId];
  const start = tileById.get(fromHexId);
  const target = tileById.get(targetHexId);
  if (!start || !target || !isFleetPassableTile(target)) return [];
  const frontier: HexId[] = [fromHexId];
  const cameFrom = new Map<HexId, HexId | null>([[fromHexId, null]]);
  let visited = 0;
  while (frontier.length > 0 && visited < limit) {
    visited += 1;
    const currentId = frontier.shift();
    if (!currentId) break;
    if (currentId === targetHexId) break;
    const current = tileById.get(currentId);
    if (!current) continue;
    for (const neighbor of getNeighborTiles(current, tileById, map.settings)) {
      if (!isFleetPassableTile(neighbor)) continue;
      if (cameFrom.has(neighbor.id)) continue;
      cameFrom.set(neighbor.id, currentId);
      frontier.push(neighbor.id);
    }
  }
  if (!cameFrom.has(targetHexId)) return [];
  const route: HexId[] = [];
  let cursor: HexId | null = targetHexId;
  while (cursor) {
    route.push(cursor);
    cursor = cameFrom.get(cursor) ?? null;
  }
  return route.reverse();
}

function isFleetPassableTile(tile: HexTile): boolean {
  return Boolean(tile.waterKind);
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
