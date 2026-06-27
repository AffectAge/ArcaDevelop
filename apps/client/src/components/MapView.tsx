import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Application, Container, Graphics, Sprite } from "pixi.js";
import { BookOpen, Building2, Flag, Grid3X3, HandCoins, Info, Landmark, Layers, Leaf, Mountain, Shield, Tags, Users, Waves } from "lucide-react";
import {
  evaluateBuildingPlacement,
  type BuildingPlacementContent,
  type HexId,
  type HexMapArtifact,
  type HexMapSettings,
  type HexTile,
  type WorldBase,
} from "@arcanorum/shared";
import { useGameStore } from "../store/gameStore";
import {
  buildHexCameraBounds,
  calculateEdgeScrollVelocity,
  centerCameraOnWorldPoint,
  clampScale,
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
import { createHexMapOverlayMeshRenderer, type HexMapOverlayMeshRenderer } from "../map/hexMapOverlayMeshRenderer";
import { createHexTerrainMeshRenderer, type HexTerrainMeshRenderer } from "../map/hexTerrainMeshRenderer";
import { createHexMapLensOverlayRenderer, type HexMapLensOverlayRenderer } from "../map/hexMapLensOverlayRenderer";
import {
  readMapTextureQuality,
  type MapTextureQuality,
} from "../map/hexTextureSystem";
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
import { Tooltip } from "./Tooltip";
import { HexHoverTooltip } from "./ProvinceHoverTooltip";
import { MapControlsHud } from "./map-hud/MapControlsHud";
import { MapLensHud } from "./map-hud/MapLensHud";
import { type BuildingAtlasState } from "../assets/buildingAtlas";
import { getBuildingAtlasTextures } from "../map/buildingAtlasTextureCache";

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
  onOpenAdminHexEditor?: (hexId: string) => void;
  onOpenHexKnowledge?: (hexId: string, hexName: string) => void;
  onCreateHexKnowledge?: (hexId: string, hexName: string) => void;
  onHexRenameCharged?: (chargedDucats: number) => void;
  colonizationIconUrl?: string | null;
  ducatsIconUrl?: string | null;
  maxActiveColonizations?: number;
  colonizationCostPer1000Km2?: { points: number; ducats: number };
  hexRenameDucatsCost?: number;
  countryColorById?: Record<string, string>;
  countryNameById?: Record<string, string>;
  suggestedMapMode?: MapInteractionMode;
  suggestedMapLens?: MapLensId;
  showMapControls?: boolean;
  showAntarctica?: boolean;
  buildingEntries?: Array<BuildingPlacementContent & { name?: string | null; logoUrl?: string | null }>;
  canceledConstructionQueueKeys?: readonly string[];
  hexBuildPlacement?: {
    building: BuildingPlacementContent & { name?: string | null; logoUrl?: string | null };
  } | null;
  onSelectHexBuildPlacementTarget?: (target: { hexId: HexId; regionId: string }) => void;
  onCancelHexBuildPlacement?: () => void;
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

const DEFAULT_CAMERA: HexCamera = {
  x: axialToPixel({ q: DEFAULT_HEX_MAP_SETTINGS.width / 2, r: DEFAULT_HEX_MAP_SETTINGS.height / 2 }, DEFAULT_HEX_MAP_SETTINGS.hexSize).x,
  y: axialToPixel({ q: DEFAULT_HEX_MAP_SETTINGS.width / 2, r: DEFAULT_HEX_MAP_SETTINGS.height / 2 }, DEFAULT_HEX_MAP_SETTINGS.hexSize).y,
  scale: 0.32,
};

const HEX_GRID_MIN_SCALE = 0.78;

const MAP_LAYER_DESCRIPTORS: Array<{ id: MapLayerToggleId; labelKey: UiTextKey; tooltipKey: UiTextKey; icon: typeof Grid3X3 }> = [
  { id: "hexGrid", labelKey: "map.layer.hexGrid", tooltipKey: "map.layer.hexGridTooltip", icon: Grid3X3 },
  { id: "countryFill", labelKey: "map.layer.countryFill", tooltipKey: "map.layer.countryFillTooltip", icon: Flag },
  { id: "countryBorders", labelKey: "map.layer.countryBorders", tooltipKey: "map.layer.countryBordersTooltip", icon: Shield },
  { id: "regionFill", labelKey: "map.layer.regionFill", tooltipKey: "map.layer.regionFillTooltip", icon: Layers },
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
  return Number.isFinite(requested) ? Math.max(0.12, Math.min(1.8, requested)) : DEFAULT_CAMERA.scale;
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
  quality: MapTextureQuality;
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

export function MapView({
  apiBase,
  scenarioId,
  focusHexRequest = null,
  onQueueArmyMoveOrder: _onQueueArmyMoveOrder,
  onOpenAdminHexEditor,
  onOpenHexKnowledge,
  onCreateHexKnowledge,
  onHexRenameCharged: _onHexRenameCharged,
  colonizationIconUrl: _colonizationIconUrl,
  ducatsIconUrl: _ducatsIconUrl,
  maxActiveColonizations: _maxActiveColonizations,
  colonizationCostPer1000Km2: _colonizationCostPer1000Km2,
  hexRenameDucatsCost: _hexRenameDucatsCost,
  countryColorById,
  countryNameById,
  suggestedMapMode: _suggestedMapMode,
  suggestedMapLens,
  showMapControls = false,
  showAntarctica: _showAntarctica = false,
  canceledConstructionQueueKeys = [],
  hexBuildPlacement = null,
  onSelectHexBuildPlacementTarget,
  onCancelHexBuildPlacement,
}: Props) {
  const { t } = useUiText();
  const authCountryId = useGameStore((state) => state.auth?.countryId ?? null);
  const turnId = useGameStore((state) => state.turnId);
  const worldBase = useGameStore((state) => state.worldBase);
  const ordersByTurn = useGameStore((state) => state.ordersByTurn);
  const setSelectedHex = useGameStore((state) => state.setSelectedHex);
  const [serverMapArtifact, setServerMapArtifact] = useState<HexMapArtifact | null>(null);
  const [mapLoadError, setMapLoadError] = useState(false);
  const mapArtifact = serverMapArtifact ?? EMPTY_HEX_MAP_ARTIFACT;
  const initialCamera = useMemo(() => buildInitialHexCamera(mapArtifact.settings), [mapArtifact.settings]);
  const showStatsPanel = useMemo(() => shouldShowMapStatsPanel(), []);
  const tileById = useMemo(() => new Map(mapArtifact.tiles.map((tile) => [tile.id, tile])), [mapArtifact]);
  const wrapWidth = useMemo(() => worldPixelWidth(mapArtifact.settings), [mapArtifact]);
  const cameraBounds = useMemo(() => buildHexCameraBounds(mapArtifact.settings, wrapWidth), [mapArtifact.settings, wrapWidth]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldContainerRef = useRef<Container | null>(null);
  const terrainMeshRendererRef = useRef<HexTerrainMeshRenderer | null>(null);
  const overlayMeshRendererRef = useRef<HexMapOverlayMeshRenderer | null>(null);
  const lensOverlayRendererRef = useRef<HexMapLensOverlayRenderer | null>(null);
  const overlayLayerRef = useRef<Graphics | null>(null);
  const buildingLayerRef = useRef<Container | null>(null);
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
  const selectedTileIdRef = useRef<HexId | null>(null);
  const [camera, setCamera] = useState<HexCamera>(initialCamera);
  const [interactionLocked, setInteractionLocked] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<HexId | null>(null);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [pixiReady, setPixiReady] = useState(false);
  const [mapRenderError, setMapRenderError] = useState(false);
  const [buildingTextureVersion, setBuildingTextureVersion] = useState(0);
  const [edgeScrollEnabled, setEdgeScrollEnabled] = useState(() => readMapNavigationSettings(useGameStore.getState().auth?.countryId).edgeScrollEnabled);
  const [textureQuality, setTextureQuality] = useState<MapTextureQuality>(() => readMapTextureQuality(useGameStore.getState().auth?.countryId));
  const [activeLens, setActiveLens] = useState<MapLensId>(() => readMapLensSetting(useGameStore.getState().auth?.countryId, suggestedMapLens ?? "terrain"));
  const [mapLayers, setMapLayers] = useState<MapLayerToggles>(() => readMapLayerSettings(useGameStore.getState().auth?.countryId));
  const [mapActionNotice, setMapActionNotice] = useState<string | null>(null);

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

  const selectedTile = selectedTileId ? tileById.get(selectedTileId) ?? null : null;
  const hoverPath = useMemo(() => {
    if (!selectedTile || !hoverState?.tile || selectedTile.id === hoverState.tile.id) return [];
    return findHexPath(mapArtifact, selectedTile.id, hoverState.tile.id, 1600);
  }, [hoverState?.tile, mapArtifact, selectedTile]);

  const pendingColonyProgressByRegion = useMemo(() => {
    const byPlayer = ordersByTurn.get(turnId);
    if (!byPlayer) return {};
    const progressByRegion: Record<string, Record<string, number>> = {};
    for (const orders of byPlayer.values()) {
      for (const order of orders) {
        if (order.type !== "COLONIZE") continue;
        const byCountry = progressByRegion[order.regionId] ?? {};
        byCountry[order.countryId] = Math.max(byCountry[order.countryId] ?? 0, 0.001);
        progressByRegion[order.regionId] = byCountry;
      }
    }
    return progressByRegion;
  }, [ordersByTurn, turnId]);

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

  const activeLensDescriptor = useMemo(() => getMapLensDescriptor(activeLens), [activeLens]);
  const lensCells = useMemo(() => {
    const analyticalCells = selectMapLensCells(activeLens, { map: mapArtifact, worldBase, authCountryId, countryColorById, countryNameById, pendingColonyProgressByRegion });
    const baseCells = buildLayerOverlayCells(mapArtifact, worldBase, mapLayers, countryColorById, countryNameById);
    const cells = [...baseCells, ...analyticalCells];
    return mapLayers.countryLabels ? cells : cells.map(stripMapCellLabel);
  }, [activeLens, authCountryId, countryColorById, countryNameById, mapArtifact, mapLayers, pendingColonyProgressByRegion, worldBase]);

  const placementEvaluations = useMemo(() => {
    if (!hexBuildPlacement || !placementWorld || !authCountryId) return new Map<HexId, ReturnType<typeof evaluateBuildingPlacement>>();
    const map = new Map<HexId, ReturnType<typeof evaluateBuildingPlacement>>();
    for (const tile of mapArtifact.tiles) {
      const controller = placementWorld.regionController[tile.regionId] ?? placementWorld.regionOwner[tile.regionId] ?? null;
      if (controller !== authCountryId) continue;
      const neighbors = getNeighborTiles(tile, tileById, mapArtifact.settings);
      map.set(tile.id, evaluateBuildingPlacement({
        building: hexBuildPlacement.building,
        countryId: authCountryId,
        hex: tile,
        neighborHexes: neighbors,
        world: placementWorld,
      }));
    }
    return map;
  }, [authCountryId, hexBuildPlacement, mapArtifact.settings, mapArtifact.tiles, placementWorld, tileById]);

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
      if (!tile) return;
      if (hexBuildPlacement) {
        const evaluation = placementEvaluations.get(tile.id);
        if (!evaluation?.valid) {
          setMapActionNotice(t(getPlacementReasonLabelKey(evaluation?.reason.code)));
          return;
        }
        onSelectHexBuildPlacementTarget?.({ hexId: tile.id, regionId: tile.regionId });
        return;
      }
    },
    [hexBuildPlacement, onSelectHexBuildPlacementTarget, placementEvaluations, selectTile, t],
  );

  useEffect(() => {
    const next = readMapNavigationSettings(authCountryId).edgeScrollEnabled;
    const nextQuality = readMapTextureQuality(authCountryId);
    const nextLayers = readMapLayerSettings(authCountryId);
    edgeScrollEnabledRef.current = next;
    setEdgeScrollEnabled(next);
    setTextureQuality(nextQuality);
    setMapLayers(nextLayers);
    const onSettingsChanged = () => {
      const updated = readMapNavigationSettings(authCountryId).edgeScrollEnabled;
      const updatedQuality = readMapTextureQuality(authCountryId);
      edgeScrollEnabledRef.current = updated;
      setEdgeScrollEnabled(updated);
      setTextureQuality(updatedQuality);
    };
    window.addEventListener(MAP_NAVIGATION_SETTINGS_EVENT, onSettingsChanged);
    return () => window.removeEventListener(MAP_NAVIGATION_SETTINGS_EVENT, onSettingsChanged);
  }, [authCountryId]);

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
    if (!serverMapArtifact) return;
    const nextCamera = buildInitialHexCamera(serverMapArtifact.settings);
    cameraRef.current = nextCamera;
    cameraTargetRef.current = nextCamera;
    setCamera(nextCamera);
  }, [serverMapArtifact]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !serverMapArtifact) return;
    let disposed = false;
    let initialized = false;
    let resizeObserver: ResizeObserver | null = null;
    const app = new Application();
    const worldContainer = new Container();
    const overlayLayer = new Graphics();
    const buildingLayer = new Container();

    appRef.current = app;
    worldContainerRef.current = worldContainer;
    overlayLayerRef.current = overlayLayer;
    buildingLayerRef.current = buildingLayer;

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
        overlayMeshRendererRef.current = await createHexMapOverlayMeshRenderer(mapArtifact);
        lensOverlayRendererRef.current = createHexMapLensOverlayRenderer(mapArtifact);
      } catch {
        setMapRenderError(true);
        return;
      }
      if (disposed) {
        safeDestroyMapRenderer(terrainMeshRendererRef.current);
        terrainMeshRendererRef.current = null;
        safeDestroyMapRenderer(overlayMeshRendererRef.current);
        overlayMeshRendererRef.current = null;
        safeDestroyMapRenderer(lensOverlayRendererRef.current);
        lensOverlayRendererRef.current = null;
        safeDestroyPixiApp(app);
        return;
      }
      const terrainRenderer = terrainMeshRendererRef.current;
      const overlayRenderer = overlayMeshRendererRef.current;
      const lensRenderer = lensOverlayRendererRef.current;
      if (!terrainRenderer || !overlayRenderer || !lensRenderer) {
        setMapRenderError(true);
        return;
      }
      lensRenderer.updateLens(activeLens, lensCells);
      worldContainer.addChild(terrainRenderer.container, overlayRenderer.container, lensRenderer.container, buildingLayer, overlayLayer);
      app.stage.addChild(worldContainer);
      const rect = container.getBoundingClientRect();
      terrainRenderer.setQuality(readMapTextureQuality(authCountryId), window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
      overlayRenderer.setQuality(readMapTextureQuality(authCountryId), window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
      const visibleMeshes = terrainRenderer.updateVisibility(cameraRef.current, rect);
      const visibleOverlayMeshes = overlayRenderer.updateVisibility(cameraRef.current, rect);
      const visibleLensMeshes = lensRenderer.updateVisibility(cameraRef.current, rect);
      performanceStatsRef.current.visibleSprites = 0;
      performanceStatsRef.current.visibleTerrainMeshes = visibleMeshes;
      performanceStatsRef.current.visibleOverlayMeshes = visibleOverlayMeshes + visibleLensMeshes;
      resizeObserver = new ResizeObserver(() => {
        if (disposed || !app.renderer) return;
        app.renderer.resize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
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
      safeDestroyMapRenderer(overlayMeshRendererRef.current);
      overlayMeshRendererRef.current = null;
      safeDestroyMapRenderer(lensOverlayRendererRef.current);
      lensOverlayRendererRef.current = null;
      overlayLayerRef.current = null;
      buildingLayerRef.current = null;
      window.__arcHexMapStats = undefined;
      if (initialized) {
        safeDestroyPixiApp(app);
      }
    };
  }, [authCountryId, mapArtifact, serverMapArtifact, tileById, wrapWidth]);

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

    const handlePointerDown = (event: PointerEvent) => {
      updatePointerTracking(event);
      const blocked = isMapNavigationBlocked(event.target);
      if (hexBuildPlacement && event.button === 2) {
        if (blocked) return;
        event.preventDefault();
        onCancelHexBuildPlacement?.();
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
      setHoverState(tile ? { tile, x: event.clientX, y: event.clientY } : null);
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
      if (hexBuildPlacement) {
        onCancelHexBuildPlacement?.();
      }
    };
    const handleWindowPointerMove = (event: PointerEvent) => updatePointerTracking(event);
    const handlePointerLeave = () => {
      pointerRef.current = null;
      setHoverState(null);
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
      pointerGestureRef.current = null;
      activePointersRef.current.clear();
    };
  }, [applyTileInteraction, cameraBounds, centerOnTile, hexBuildPlacement, interactionLocked, mapArtifact, onCancelHexBuildPlacement, serverMapArtifact, setCameraTarget, tileById]);

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
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const quality = readMapTextureQuality(authCountryId);
      terrainMeshRendererRef.current?.setQuality(quality, reducedMotion);
      overlayMeshRendererRef.current?.setQuality(quality, reducedMotion);
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
        }
      }
      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [authCountryId, cameraBounds, interactionLocked]);

  useEffect(() => {
    const app = appRef.current;
    const worldContainer = worldContainerRef.current;
    if (!pixiReady || !app || !app.renderer || !worldContainer) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (!rect) return;
      const terrainRenderer = terrainMeshRendererRef.current;
      const overlayRenderer = overlayMeshRendererRef.current;
      const lensRenderer = lensOverlayRendererRef.current;
      if (terrainRenderer && overlayRenderer) {
      terrainRenderer.setQuality(textureQuality, window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
        overlayRenderer.setQuality(textureQuality, window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
        const visibleTerrainMeshes = terrainRenderer.updateVisibility(camera, rect);
        const visibleOverlayMeshes = overlayRenderer.updateVisibility(camera, rect);
        const visibleLensMeshes = lensRenderer?.updateVisibility(camera, rect) ?? 0;
        performanceStatsRef.current.visibleSprites = 0;
        performanceStatsRef.current.visibleTerrainMeshes = visibleTerrainMeshes;
        performanceStatsRef.current.visibleOverlayMeshes = visibleOverlayMeshes + visibleLensMeshes;
      performanceStatsRef.current.tiles = mapArtifact.tiles.length;
      performanceStatsRef.current.quality = textureQuality;
      performanceStatsRef.current.shaderActive = true;
      performanceStatsRef.current.viewport = { width: Math.round(rect.width), height: Math.round(rect.height) };
    }
    worldContainer.position.set(rect.width / 2 - camera.x * camera.scale, rect.height / 2 - camera.y * camera.scale);
    worldContainer.scale.set(camera.scale);
    app.render();
  }, [camera, mapArtifact, pixiReady, textureQuality, tileById, wrapWidth]);

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
    const overlayLayer = overlayLayerRef.current;
    const app = appRef.current;
    if (!pixiReady || !overlayLayer || !app || !app.renderer) return;
    overlayLayer.clear();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      drawMapLayerOutlines(overlayLayer, mapArtifact, tileById, worldBase, mapLayers, camera, rect);
    }
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
    if (selectedTile) {
      drawHexOutline(overlayLayer, selectedTile, mapArtifact.settings.hexSize, 0xf5d56b, 2.6);
    }
    if (hoverPath.length > 1) {
      drawPathOverlay(overlayLayer, hoverPath, tileById, mapArtifact.settings.hexSize);
    }
    app.render();
  }, [camera, hexBuildPlacement, hoverPath, hoverState, mapArtifact, mapLayers, pixiReady, placementEvaluations, selectedTile, tileById, worldBase]);

  useEffect(() => {
    const layer = buildingLayerRef.current;
    const app = appRef.current;
    const showBuildings = mapLayers.buildings || Boolean(hexBuildPlacement);
    if (!pixiReady || !layer || !app || !worldBase || !showBuildings) {
      layer?.removeChildren().forEach((child) => child.destroy());
      return;
    }
    layer.removeChildren().forEach((child) => child.destroy());
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
      hexId: string | undefined,
      buildingId: string,
      state: BuildingAtlasState,
    ) => {
      if (!hexId) return;
      const tile = tileById.get(hexId as HexId);
      if (!tile) return;
      const center = axialToPixel(tile, size);
      const textures = getBuildingAtlasTextures({
        scenarioId,
        buildingId,
        onReady: () => setBuildingTextureVersion((value) => value + 1),
      });
      const texture = textures?.[state];
      if (texture) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 0.68);
        sprite.position.set(center.x, center.y + size * 0.12);
        const markerSize = Math.max(size * 0.72, Math.min(size * 1.25, 34 / Math.max(0.35, camera.scale)));
        sprite.width = markerSize;
        sprite.height = markerSize;
        layer.addChild(sprite);
        return;
      }
      const marker = new Graphics();
      marker
        .circle(center.x, center.y, Math.max(3, size * 0.28))
        .fill({ color: state === "working" || state === "ruins" ? workingMarkerColor : constructionMarkerColor, alpha: 0.86 });
      marker.circle(center.x, center.y, Math.max(3, size * 0.28)).stroke({ color: markerStrokeColor, width: 1.2, alpha: 0.9 });
      layer.addChild(marker);
    };
    for (const [regionId, queue] of Object.entries(worldBase.regionConstructionQueueByRegion)) {
      for (const project of queue ?? []) {
        if (canceledConstructionQueueKeySet.has(`${regionId}:${project.queueId}`)) continue;
        if ((project.projectType ?? "build") === "build") addMarker(project.targetHexId, project.buildingId, "underConstruction");
      }
    }
    for (const marker of pendingBuildMarkers) {
      addMarker(marker.targetHexId, marker.buildingId, "underConstruction");
    }
    for (const instances of Object.values(worldBase.regionBuildingsByRegion)) {
      for (const instance of instances ?? []) {
        addMarker(instance.targetHexId, instance.buildingId, getBuildingMapVisualState(instance));
      }
    }
    app.render();
  }, [buildingTextureVersion, camera.scale, canceledConstructionQueueKeySet, hexBuildPlacement, mapArtifact.settings.hexSize, mapLayers.buildings, pendingBuildMarkers, pixiReady, scenarioId, tileById, worldBase]);

  const selectedName = selectedTile ? resolveHexName(selectedTile) : null;

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
              <HexDetail icon={<Mountain size={14} />} label={t("hexMap.terrain")} value={t(`hexMap.terrain.${selectedTile.terrain}`)} />
              <HexDetail icon={<Leaf size={14} />} label={t("hexMap.feature")} value={t(`hexMap.feature.${selectedTile.feature}`)} />
              <HexDetail icon={<Waves size={14} />} label={t("hexMap.water")} value={selectedTile.waterKind ? t(`hexMap.water.${selectedTile.waterKind}`) : t("hexMap.water.none")} />
              <HexDetail icon={<Info size={14} />} label={t("hexMap.owner")} value={resolveOwnerName(selectedTile)} />
              <HexDetail icon={<Info size={14} />} label={t("hexMap.movementCost")} value={selectedTile.movementCost.toFixed(1)} />
            </div>
            <div className="arc-hex-map__actions">
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
      {hoverState ? (
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
            { label: t("hexMap.terrain"), value: t(`hexMap.terrain.${hoverState.tile.terrain}`) },
            { label: t("hexMap.biome"), value: t(`hexMap.biome.${hoverState.tile.biome}`) },
            { label: t("hexMap.feature"), value: t(`hexMap.feature.${hoverState.tile.feature}`) },
          ]}
        />
      ) : null}
    </div>
  );
}

function isMapNavigationBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        ".arc-hud-panel",
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

function buildLayerOverlayCells(
  map: HexMapArtifact,
  worldBase: WorldBase | null,
  layers: MapLayerToggles,
  countryColorById?: Record<string, string>,
  countryNameById?: Record<string, string>,
): MapLensRenderCell[] {
  if (!worldBase) return [];
  const cells: MapLensRenderCell[] = [];
  for (const tile of map.tiles) {
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
        labelGroupId: layers.countryLabels && !tile.waterKind ? owner : undefined,
        label: layers.countryLabels && !tile.waterKind ? countryNameById?.[owner] ?? owner : undefined,
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

function HexDetail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="arc-hex-map__detail">
      <span className="arc-hex-map__detail-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

function drawPathOverlay(graphics: Graphics, path: HexId[], tileById: Map<HexId, HexTile>, size: number): void {
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
  graphics.stroke({ color: 0xf1df8b, width: 2.5, alpha: 0.74 });
}

function drawMapLayerOutlines(
  graphics: Graphics,
  map: HexMapArtifact,
  tileById: Map<HexId, HexTile>,
  worldBase: WorldBase | null,
  layers: MapLayerToggles,
  camera: HexCamera,
  rect: DOMRect,
): void {
  const size = map.settings.hexSize;
  for (const tile of map.tiles) {
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

function getNeighborTiles(tile: HexTile, tileById: Map<HexId, HexTile>, settings: HexMapSettings): HexTile[] {
  const tiles: HexTile[] = [];
  for (let direction = 0; direction < 6; direction += 1) {
    const axial = getNeighborAxial(tile, direction as 0 | 1 | 2 | 3 | 4 | 5, settings);
    if (!axial) continue;
    const neighbor = tileById.get(makeHexId(axial.q, axial.r));
    if (neighbor) tiles.push(neighbor);
  }
  return tiles;
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
    default:
      return "buildings.hexPlacementReasonInvalid";
  }
}
