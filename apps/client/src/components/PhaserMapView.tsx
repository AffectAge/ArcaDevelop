import type {
  BuildingPlacementContent,
  HexChunkId,
  HexId,
  HexMapClientManifest,
  HexTile,
  NaturalFeatureVisualCatalog,
  UnitTypeDefinition,
} from "@arcanorum/shared";
import { LocateFixed, Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useUiText } from "../i18n/useUiText";
import {
  fetchHexMapClientManifest,
  HexMapChunkStream,
  type HexMapLoadFailureCode,
} from "../map/hexMapChunkStream";
import { axialDistance } from "../map/hexGeometry";
import { ResidentHexMapIndex } from "../map/residentHexMapIndex";
import {
  PhaserHexMapController,
  type PhaserMapPoliticalState,
} from "../map/rendering";
import { useGameStore } from "../store/gameStore";
import {
  AppButton,
  AppModal,
  AppModalHeader,
  GameTextField,
} from "./templates";
import type { StrategyShellSelectedHexDetails } from "./strategy-shell/StrategyShell";

type UnitCommandMode = "move" | "attack" | "foundCity";

type ActiveUnitCommand = {
  unitId: string;
  kind: "map" | "civilian";
  mode: UnitCommandMode;
  fromHexId: HexId;
};

type FoundCityTarget = {
  unitId: string;
  tile: HexTile;
};

export type PhaserMapViewProps = {
  apiBase: string;
  createChunkStream?: () => HexMapChunkStream;
  loadClientManifest?: typeof fetchHexMapClientManifest;
  loadNaturalFeatureVisuals?: (apiBase: string, signal?: AbortSignal) => Promise<NaturalFeatureVisualCatalog>;
  scenarioId?: string | null;
  focusHexRequest?: { hexId: HexId; nonce: number } | null;
  unitCommandRequest?: {
    unitId: string;
    mode: UnitCommandMode;
    nonce: number;
  } | null;
  selectedCommandUnitId?: string | null;
  onSelectedCommandUnitChange?: (unitId: string | null) => void;
  onQueueArmyMoveOrder?: (
    unitId: string,
    hexId: string,
    path?: string[],
  ) => void;
  onQueueUnitAttackOrder?: (
    unitId: string,
    targetHexId: HexId,
    targetUnitId?: string | null,
  ) => void;
  onQueueCivilianUnitMoveOrder?: (
    unitId: string,
    fromHexId: HexId,
    targetHexId: HexId,
    path?: HexId[],
  ) => void;
  onFoundCityOrder?: (
    civilianUnitId: string,
    hexId: HexId,
    regionId: string,
    cityName: string,
    cultureId?: string | null,
  ) => void;
  onHexSelectionChange?: (
    details: StrategyShellSelectedHexDetails | null,
  ) => void;
  onOpenSelectedHexWorkspace?: (
    details: StrategyShellSelectedHexDetails,
  ) => void;
  colonizerPlacement?: { active: boolean } | null;
  onSelectColonizerPlacementTarget?: (target: {
    hexId: HexId;
    regionId: string;
  }) => void;
  onCancelColonizerPlacement?: () => void;
  unitTrainingPlacement?: { unitType: UnitTypeDefinition } | null;
  onSelectUnitTrainingPlacementTarget?: (target: {
    hexId: HexId;
    regionId: string;
  }) => void;
  onCancelUnitTrainingPlacement?: () => void;
  hexBuildPlacement?: {
    building: BuildingPlacementContent & {
      name?: string | null;
      logoUrl?: string | null;
    };
  } | null;
  onSelectHexBuildPlacementTarget?: (target: {
    hexId: HexId;
    regionId: string;
  }) => void;
  onCancelHexBuildPlacement?: () => void;
  corridorPlacement?: {
    points: Array<{ hexId: HexId; lng: number; lat: number }>;
    previewHexIds: HexId[];
    blockingReason?: string | null;
    pending: boolean;
  } | null;
  onSelectCorridorPlacementPoint?: (point: {
    hexId: HexId;
    regionId: string;
    lng: number;
    lat: number;
  }) => void;
  onUndoCorridorPlacementPoint?: () => void;
  onCancelCorridorPlacement?: () => void;
  onConfirmCorridorPlacement?: () => void;
  countryColorById?: Record<string, string>;
  countryNameById?: Record<string, string>;
  showMapControls?: boolean;
  showZoomIndicator?: boolean;
  onMapReadyChange?: (ready: boolean) => void;
};

const EMPTY_COLORS: Readonly<Record<string, string>> = Object.freeze({});
const EMPTY_POLITICAL_STATE: PhaserMapPoliticalState = Object.freeze({
  hexOwner: Object.freeze({}),
  regionOwner: Object.freeze({}),
  regionController: Object.freeze({}),
});

function createDefaultChunkStream(): HexMapChunkStream {
  return new HexMapChunkStream();
}

export function MapView(props: PhaserMapViewProps) {
  const { t } = useUiText();
  const worldBase = useGameStore((state) => state.worldBase);
  const authCountryId = useGameStore((state) => state.auth?.countryId ?? null);
  const setGlobalSelectedHex = useGameStore((state) => state.setSelectedHex);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<PhaserHexMapController | null>(null);
  const streamRef = useRef<HexMapChunkStream | null>(null);
  const indexRef = useRef<ResidentHexMapIndex | null>(null);
  const manifestRef = useRef<HexMapClientManifest | null>(null);
  const propsRef = useRef(props);
  const worldRef = useRef(worldBase);
  const commandRef = useRef<ActiveUnitCommand | null>(null);
  const selectionHandlerRef = useRef<(hexId: HexId | null) => Promise<void>>(
    async () => undefined,
  );
  const hoverHandlerRef = useRef<(hexId: HexId | null) => void>(() => undefined);
  const pathRequestSequenceRef = useRef(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [visibleChunksReady, setVisibleChunksReady] = useState(false);
  const [loadError, setLoadError] = useState<HexMapLoadFailureCode | "MAP_RENDER_FAILED" | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedHexId, setSelectedHexId] = useState<HexId | null>(null);
  const [activeCommand, setActiveCommand] = useState<ActiveUnitCommand | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [foundCityTarget, setFoundCityTarget] = useState<FoundCityTarget | null>(null);
  const [cityName, setCityName] = useState("");
  const [cityNameInvalid, setCityNameInvalid] = useState(false);

  propsRef.current = props;
  worldRef.current = worldBase;
  commandRef.current = activeCommand;

  const countryColors = props.countryColorById ?? EMPTY_COLORS;
  const politicalState = useMemo<PhaserMapPoliticalState>(
    () =>
      worldBase
        ? {
            hexOwner: worldBase.hexOwner,
            regionOwner: worldBase.regionOwner,
            regionController: worldBase.regionController,
          }
        : EMPTY_POLITICAL_STATE,
    [worldBase],
  );

  const buildSelectedHexDetails = useCallback(
    (tile: HexTile): StrategyShellSelectedHexDetails => {
      const snapshot = indexRef.current?.createSnapshot();
      const ownerId =
        worldBase?.regionOwner[tile.regionId] ??
        worldBase?.hexOwner[tile.id] ??
        null;
      const controllerId =
        worldBase?.regionController[tile.regionId] ?? ownerId;
      const mapUnits = Object.values(worldBase?.unitsById ?? {}).filter(
        (unit) => unit.hexId === tile.id,
      );
      const civilianUnits = Object.values(
        worldBase?.civilianUnitsById ?? {},
      ).filter((unit) => unit.hexId === tile.id);
      const featureLabels = (snapshot?.features ?? [])
        .filter((feature) => feature.hexId === tile.id)
        .map((feature) =>
          feature.nameKey ? t(feature.nameKey) : feature.typeId,
        );
      const deposit = Object.values(
        worldBase?.regionResourceDepositsByRegion ?? {},
      )
        .flat()
        .find((candidate) => candidate.hexId === tile.id);
      const importantTags = [
        findTag(tile, "water:"),
        findTag(tile, "biome:"),
        findTag(tile, "morphology:"),
        findTag(tile, "feature:"),
        findTag(tile, "natural:"),
        findTag(tile, "vegetation:"),
      ].filter((tag): tag is string => Boolean(tag));
      const stackCount = mapUnits.length + civilianUnits.length;
      return {
        id: tile.id,
        name:
          worldBase?.hexNameById[tile.id] ??
          t("hexMap.hexTitle", { id: tile.id.replace("hex:", "") }),
        regionId: tile.regionId,
        surfaceSummary:
          importantTags.length > 0
            ? importantTags.map((tag) => localizeMapTag(tag, t)).join(" · ")
            : t("mapTag.unknown"),
        siteFeatures: featureLabels,
        resourceDeposit: deposit
          ? `${deposit.goodId}: ${deposit.amount}/${deposit.maxAmount}`
          : null,
        water: tile.waterKind
          ? t(`hexMap.water.${tile.waterKind}`)
          : t("hexMap.water.none"),
        owner: formatCountry(ownerId, props.countryNameById, t),
        controller: formatCountry(
          controllerId,
          props.countryNameById,
          t,
        ),
        movementCost: tile.movementCost.toFixed(1),
        tagGroups: buildTagGroups(tile, t),
        unitStack: t("hexMap.unitStackValue", {
          current: stackCount,
          max: 2,
        }),
        unitStackTooltip: {
          title: t("hexMap.unitStack"),
          description: t("hexMap.unitStackTooltip", {
            current: stackCount,
            max: 2,
          }),
          tone: stackCount >= 2 ? "warning" : "info",
        },
      };
    },
    [props.countryNameById, t, worldBase],
  );

  const finishCommand = useCallback(() => {
    setActiveCommand(null);
    controllerRef.current?.setPathPreview([]);
    propsRef.current.onSelectedCommandUnitChange?.(null);
  }, []);

  const startFoundCity = useCallback(
    (command: ActiveUnitCommand, tile: HexTile) => {
      const world = worldRef.current;
      const neutral =
        !world?.regionOwner[tile.regionId] &&
        !world?.regionController[tile.regionId];
      const mapUnit = world?.unitsById?.[command.unitId];
      const civilianUnit = world?.civilianUnitsById?.[command.unitId];
      const isColonizer =
        civilianUnit?.type === "colonizer" ||
        mapUnit?.unitTypeId === "unit:colonizer";
      if (!neutral || !isColonizer) {
        setActionNotice(t("hexMap.foundCityNeutralRequired"));
        return;
      }
      setCityName("");
      setCityNameInvalid(false);
      setFoundCityTarget({ unitId: command.unitId, tile });
    },
    [t],
  );

  selectionHandlerRef.current = async (hexId) => {
    const controller = controllerRef.current;
    const stream = streamRef.current;
    const tile = hexId
      ? indexRef.current?.createSnapshot().tileById.get(hexId) ?? null
      : null;
    setSelectedHexId(tile?.id ?? null);
    setGlobalSelectedHex(tile?.id ?? null);
    controller?.setSelectedHex(tile?.id ?? null);
    if (!tile) {
      propsRef.current.onHexSelectionChange?.(null);
      return;
    }

    const details = buildSelectedHexDetails(tile);
    propsRef.current.onHexSelectionChange?.(details);

    if (propsRef.current.corridorPlacement) {
      propsRef.current.onSelectCorridorPlacementPoint?.({
        hexId: tile.id,
        regionId: tile.regionId,
        lng: tile.q,
        lat: tile.r,
      });
      return;
    }
    if (propsRef.current.hexBuildPlacement) {
      propsRef.current.onSelectHexBuildPlacementTarget?.({
        hexId: tile.id,
        regionId: tile.regionId,
      });
      return;
    }
    if (propsRef.current.unitTrainingPlacement) {
      propsRef.current.onSelectUnitTrainingPlacementTarget?.({
        hexId: tile.id,
        regionId: tile.regionId,
      });
      return;
    }
    if (propsRef.current.colonizerPlacement?.active) {
      propsRef.current.onSelectColonizerPlacementTarget?.({
        hexId: tile.id,
        regionId: tile.regionId,
      });
      return;
    }

    const command = commandRef.current;
    if (command) {
      if (command.mode === "foundCity") {
        startFoundCity(command, tile);
        return;
      }
      if (command.mode === "attack") {
        const manifest = manifestRef.current;
        const fromTile = indexRef.current
          ?.createSnapshot()
          .tileById.get(command.fromHexId);
        const adjacent = Boolean(
          manifest &&
            fromTile &&
            axialDistance(
              fromTile,
              tile,
              manifest.settings.wrapX ? manifest.settings.width : undefined,
            ) === 1,
        );
        if (!adjacent) {
          setActionNotice(t("hexMap.unitAttackNoTarget"));
          return;
        }
        const attacker = worldRef.current?.unitsById?.[command.unitId];
        const target = Object.values(worldRef.current?.unitsById ?? {}).find(
          (unit) =>
            unit.hexId === tile.id &&
            attacker &&
            unit.countryId !== attacker.countryId,
        );
        propsRef.current.onQueueUnitAttackOrder?.(
          command.unitId,
          tile.id,
          target?.id ?? null,
        );
        setActionNotice(t("hexMap.unitAttackOrderSent"));
        finishCommand();
        return;
      }
      if (tile.id === command.fromHexId || !stream) {
        setActionNotice(
          t(
            command.kind === "civilian"
              ? "hexMap.civilianMoveSelectTarget"
              : "hexMap.unitMoveSelectTarget",
          ),
        );
        return;
      }
      const sequence = ++pathRequestSequenceRef.current;
      try {
        const path = await stream.requestPath(
          "unit",
          command.fromHexId,
          tile.id,
        );
        if (sequence !== pathRequestSequenceRef.current) return;
        if (path.length < 2) {
          setActionNotice(
            t(
              command.kind === "civilian"
                ? "hexMap.civilianMoveNoPath"
                : "hexMap.unitMoveNoPath",
            ),
          );
          return;
        }
        controller?.setPathPreview(path);
        if (command.kind === "civilian") {
          propsRef.current.onQueueCivilianUnitMoveOrder?.(
            command.unitId,
            command.fromHexId,
            tile.id,
            path,
          );
          setActionNotice(t("hexMap.civilianMoveOrderSent"));
        } else {
          propsRef.current.onQueueArmyMoveOrder?.(
            command.unitId,
            tile.id,
            path,
          );
          setActionNotice(t("hexMap.unitMoveOrderSent"));
        }
        finishCommand();
      } catch {
        if (sequence === pathRequestSequenceRef.current) {
          setActionNotice(t("hexMap.unitMoveNoPath"));
        }
      }
      return;
    }

    const friendlyUnit = [
      ...Object.values(worldRef.current?.unitsById ?? {}),
      ...Object.values(worldRef.current?.civilianUnitsById ?? {}),
    ].find(
      (unit) =>
        unit.hexId === tile.id &&
        (!authCountryId || unit.countryId === authCountryId),
    );
    propsRef.current.onSelectedCommandUnitChange?.(friendlyUnit?.id ?? null);
    propsRef.current.onOpenSelectedHexWorkspace?.(details);
  };

  hoverHandlerRef.current = (hexId) => {
    const command = commandRef.current;
    const stream = streamRef.current;
    const controller = controllerRef.current;
    if (!command || command.mode !== "move" || !hexId || !stream) return;
    if (hexId === command.fromHexId) {
      controller?.setPathPreview([command.fromHexId]);
      return;
    }
    const sequence = ++pathRequestSequenceRef.current;
    void stream
      .requestPath("unit", command.fromHexId, hexId)
      .then((path) => {
        if (sequence === pathRequestSequenceRef.current) {
          controller?.setPathPreview(path);
        }
      })
      .catch(() => {
        if (sequence === pathRequestSequenceRef.current) {
          controller?.setPathPreview([]);
        }
      });
  };

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const abortController = new AbortController();
    let disposed = false;
    let naturalMetricsTimer: number | null = null;
    let publishNaturalMetrics = (): void => undefined;
    setSceneReady(false);
    setVisibleChunksReady(false);
    setLoadError(null);

    const loadManifest =
      props.loadClientManifest ?? fetchHexMapClientManifest;
    const loadNaturalVisuals = props.loadNaturalFeatureVisuals ?? fetchNaturalFeatureVisuals;
    void Promise.all([
      loadManifest(props.apiBase, abortController.signal),
      loadNaturalVisuals(props.apiBase, abortController.signal),
    ])
      .then(([manifest, naturalFeatureVisualCatalog]) => {
        if (disposed) return;
        manifestRef.current = manifest;
        const index = new ResidentHexMapIndex(manifest.settings);
        const residentChunkIds = new Set<string>();
        const stream = (
          props.createChunkStream ?? createDefaultChunkStream
        )();
        indexRef.current = index;
        streamRef.current = stream;
        let controller: PhaserHexMapController | null = null;
        const initialWorld = worldRef.current;
        const initialPolitics: PhaserMapPoliticalState = initialWorld
          ? {
              hexOwner: initialWorld.hexOwner,
              regionOwner: initialWorld.regionOwner,
              regionController: initialWorld.regionController,
            }
          : EMPTY_POLITICAL_STATE;
        const initialColors = propsRef.current.countryColorById ?? EMPTY_COLORS;
        const initialFocusHexId = resolveInitialFocusHexId(manifest);
        let activeVisibleChunkIds: HexChunkId[] = [];
        stream.configure(
          props.apiBase,
          manifest,
          {
            onChunkReady: (payload) => {
              index.upsertChunk(payload.chunk);
              residentChunkIds.add(payload.chunk.id);
              host.dataset.residentChunks = String(index.chunkCount);
              host.dataset.residentChunkIds = [...residentChunkIds].sort().join(",");
              controller?.upsertChunk(payload.chunk);
              publishNaturalMetrics();
            },
            onChunksEvicted: (chunkIds) => {
              index.removeChunks(chunkIds);
              for (const chunkId of chunkIds) residentChunkIds.delete(chunkId);
              host.dataset.residentChunks = String(index.chunkCount);
              host.dataset.residentChunkIds = [...residentChunkIds].sort().join(",");
              controller?.removeChunks(chunkIds);
              publishNaturalMetrics();
            },
            onVisibleChunksReady: (event) => {
              host.dataset.readyChunkIds = event.visibleChunkIds.join(",");
              setVisibleChunksReady(true);
            },
            onViewportSelection: (event) => {
              activeVisibleChunkIds = event.visibleChunkIds;
              host.dataset.visibleChunkIds = event.visibleChunkIds.join(",");
              controller?.setVisibleChunkIds(event.visibleChunkIds);
              publishNaturalMetrics();
              setVisibleChunksReady(false);
            },
            onError: (code) => setLoadError(code),
            onVersionMismatch: () => setLoadError("MAP_VERSION_MISMATCH"),
          },
          collectCityHexIds(initialWorld),
        );
        try {
          controller = new PhaserHexMapController({
            parent: host,
            settings: manifest.settings,
            scenarioId: props.scenarioId ?? "default",
            assetBaseUrl: props.apiBase,
            politicalState: initialPolitics,
            countryColorById: initialColors,
            naturalFeatureVisualCatalog,
            callbacks: {
              onReady: () => {
                setSceneReady(true);
                if (!propsRef.current.focusHexRequest && initialFocusHexId) {
                  controller?.focusHex(initialFocusHexId);
                }
                const latestWorld = worldRef.current;
                if (latestWorld) {
                  controller?.updateWorldVisuals(
                    latestWorld,
                    propsRef.current.countryColorById ?? EMPTY_COLORS,
                  );
                }
              },
              onCameraChange: (camera, viewport) => {
                setZoom(camera.scale);
                stream.setViewport(camera, viewport);
              },
              onSelectHex: (hexId) => {
                void selectionHandlerRef.current(hexId);
              },
              onHoverHex: (hexId) => hoverHandlerRef.current(hexId),
            },
          });
          controllerRef.current = controller;
          publishNaturalMetrics = () => {
            const metrics = controller?.getNaturalRenderTextureMetrics();
            if (!metrics) return;
            host.dataset.naturalRenderTextures = String(metrics.renderTextureCount);
            host.dataset.naturalSimplifiedLayers = String(metrics.simplifiedRenderTextureCount);
            host.dataset.naturalDetailedLayers = String(metrics.detailedRenderTextureCount);
            host.dataset.naturalLogicalObjects = String(metrics.visibleLogicalObjectCount);
            host.dataset.naturalGpuBytes = String(metrics.gpuBytes);
            host.dataset.naturalBudgetBytes = String(metrics.allocatedBudgetBytes);
            host.dataset.naturalBuildP95Ms = metrics.buildP95Ms.toFixed(3);
            host.dataset.naturalBuildP99Ms = metrics.buildP99Ms.toFixed(3);
            host.dataset.naturalChunkCreateP95Ms = metrics.chunkCreateP95Ms.toFixed(3);
            host.dataset.naturalChunkDestroyP95Ms = metrics.chunkDestroyP95Ms.toFixed(3);
            host.dataset.naturalBudgetFallbackChunks = String(metrics.deniedDetailedLayers);
            const performanceWindow = window as Window & { __arcHexMapStats?: Record<string, unknown> };
            if (performanceWindow.__arcHexMapStats) {
              Object.assign(performanceWindow.__arcHexMapStats, { naturalRenderTextures: metrics.renderTextureCount, naturalGpuBytes: metrics.gpuBytes, naturalLogicalObjects: metrics.visibleLogicalObjectCount, naturalBuildP95Ms: metrics.buildP95Ms, naturalBuildP99Ms: metrics.buildP99Ms, naturalBudgetFallbackChunks: metrics.deniedDetailedLayers });
            }
          };
          controller.setVisibleChunkIds(activeVisibleChunkIds);
          publishNaturalMetrics();
          naturalMetricsTimer = window.setInterval(publishNaturalMetrics, 250);
        } catch {
          setLoadError("MAP_RENDER_FAILED");
        }
      })
      .catch(() => {
        if (!disposed) setLoadError("MAP_ARTIFACT_UNAVAILABLE");
      });

    return () => {
      disposed = true;
      abortController.abort();
      if (naturalMetricsTimer != null) window.clearInterval(naturalMetricsTimer);
      streamRef.current?.destroy();
      controllerRef.current?.destroy();
      streamRef.current = null;
      controllerRef.current = null;
      indexRef.current = null;
      manifestRef.current = null;
      host.replaceChildren();
    };
  }, [
    loadAttempt,
    props.apiBase,
    props.createChunkStream,
    props.loadClientManifest,
    props.loadNaturalFeatureVisuals,
    props.scenarioId,
]);

async function fetchNaturalFeatureVisuals(apiBase: string, signal?: AbortSignal): Promise<NaturalFeatureVisualCatalog> {
  const response = await fetch(`${apiBase.replace(/\/$/, "")}/hex-map/natural-feature-visuals`, { signal });
  if (!response.ok) throw new Error("NATURAL_FEATURE_VISUALS_UNAVAILABLE");
  const payload = await response.json() as { visuals?: unknown; textureUrls?: unknown };
  return {
    visuals: Array.isArray(payload.visuals) ? payload.visuals as NaturalFeatureVisualCatalog["visuals"] : [],
    textureUrls: payload.textureUrls && typeof payload.textureUrls === "object" && !Array.isArray(payload.textureUrls)
      ? payload.textureUrls as NaturalFeatureVisualCatalog["textureUrls"]
      : {},
  };
}

  useEffect(() => {
    const ready = sceneReady && visibleChunksReady && !loadError;
    props.onMapReadyChange?.(ready);
    return () => props.onMapReadyChange?.(false);
  }, [loadError, props.onMapReadyChange, sceneReady, visibleChunksReady]);

  useEffect(() => {
    controllerRef.current?.updatePolitics(politicalState, countryColors);
  }, [countryColors, politicalState]);

  useEffect(() => {
    if (!worldBase) return;
    controllerRef.current?.updateWorldVisuals(worldBase, countryColors);
    streamRef.current?.setCityHexIds(collectCityHexIds(worldBase));
    const selectedTile = selectedHexId
      ? indexRef.current?.createSnapshot().tileById.get(selectedHexId)
      : null;
    if (selectedTile) {
      props.onHexSelectionChange?.(buildSelectedHexDetails(selectedTile));
    }
  }, [
    buildSelectedHexDetails,
    countryColors,
    props.onHexSelectionChange,
    selectedHexId,
    worldBase,
  ]);

  useEffect(() => {
    if (!props.focusHexRequest) return;
    controllerRef.current?.focusHex(props.focusHexRequest.hexId);
  }, [props.focusHexRequest]);

  useEffect(() => {
    const request = props.unitCommandRequest;
    if (!request || !worldBase) return;
    const mapUnit = worldBase.unitsById?.[request.unitId];
    const civilianUnit = worldBase.civilianUnitsById?.[request.unitId];
    const hexId = mapUnit?.hexId ?? civilianUnit?.hexId;
    if (!hexId) return;
    const command: ActiveUnitCommand = {
      unitId: request.unitId,
      kind: civilianUnit ? "civilian" : "map",
      mode: request.mode,
      fromHexId: hexId,
    };
    setActiveCommand(command);
    controllerRef.current?.focusHex(hexId);
    controllerRef.current?.setSelectedHex(hexId);
    setSelectedHexId(hexId);
    setActionNotice(
      t(
        request.mode === "attack"
          ? "hexMap.unitAttackSelectTarget"
          : request.mode === "foundCity"
            ? "hexMap.foundCityTooltipCan"
            : civilianUnit
              ? "hexMap.civilianMoveSelectTarget"
              : "hexMap.unitMoveSelectTarget",
      ),
    );
    const tile = indexRef.current?.createSnapshot().tileById.get(hexId);
    if (request.mode === "foundCity" && tile) startFoundCity(command, tile);
  }, [props.unitCommandRequest, startFoundCity, t, worldBase]);

  useEffect(() => {
    if (activeCommand || !props.corridorPlacement) return;
    controllerRef.current?.setPathPreview(
      props.corridorPlacement.previewHexIds,
    );
  }, [activeCommand, props.corridorPlacement]);

  useEffect(() => {
    if (!actionNotice || activeCommand) return;
    const timeout = window.setTimeout(() => setActionNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [actionNotice, activeCommand]);

  const persistentNotice = resolveInteractionNotice(props, activeCommand, t);
  const errorDescriptionKey = resolveMapErrorDescriptionKey(loadError);
  const ready = sceneReady && visibleChunksReady && !loadError;

  const cancelInteraction = () => {
    if (activeCommand) finishCommand();
    else if (props.corridorPlacement) props.onCancelCorridorPlacement?.();
    else if (props.hexBuildPlacement) props.onCancelHexBuildPlacement?.();
    else if (props.unitTrainingPlacement)
      props.onCancelUnitTrainingPlacement?.();
    else if (props.colonizerPlacement?.active)
      props.onCancelColonizerPlacement?.();
  };

  const confirmFoundCity = () => {
    const normalizedName = cityName.trim();
    if (!foundCityTarget || normalizedName.length < 1 || normalizedName.length > 32) {
      setCityNameInvalid(true);
      return;
    }
    props.onFoundCityOrder?.(
      foundCityTarget.unitId,
      foundCityTarget.tile.id,
      foundCityTarget.tile.regionId,
      normalizedName,
    );
    setFoundCityTarget(null);
    setActionNotice(t("hexMap.foundCityOrderSent"));
    finishCommand();
  };

  return (
    <section
      className="absolute inset-0 overflow-hidden bg-arc-bg"
      data-testid="phaser-map-view"
      aria-label={t("hexMap.title")}
    >
      <div ref={canvasHostRef} className="absolute inset-0 touch-none" />

      {!ready && !loadError ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[var(--arc-overlay-45)]">
          <div className="max-w-xs rounded-[var(--arc-radius-lg)] border border-[var(--arc-kit-border)] bg-[var(--arc-kit-surface)] px-5 py-4 text-center shadow-[var(--arc-shadow-panel)]">
            <div className="font-display text-lg text-[var(--arc-color-text)]">
              {t("hexMap.loadingTitle")}
            </div>
            <div className="mt-1 text-xs text-[var(--arc-color-text-soft)]">
              {t("hexMap.loadingDescription")}
            </div>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[var(--arc-modal-backdrop)] p-4">
          <div className="max-w-sm rounded-[var(--arc-radius-lg)] border border-[var(--arc-color-danger-border)] bg-[var(--arc-kit-surface)] p-5 text-center shadow-[var(--arc-shadow-panel)]">
            <div className="font-display text-xl text-[var(--arc-color-text)]">
              {t(
                loadError === "MAP_RENDER_FAILED"
                  ? "hexMap.renderErrorTitle"
                  : "hexMap.artifactErrorTitle",
              )}
            </div>
            <p className="mt-2 text-sm text-[var(--arc-color-text-soft)]">
              {t(errorDescriptionKey)}
            </p>
            <AppButton
              className="mt-4 min-h-11"
              variant="primary"
              onClick={() => setLoadAttempt((value) => value + 1)}
            >
              {t("hexMap.retry")}
            </AppButton>
          </div>
        </div>
      ) : null}

      {ready && (actionNotice || persistentNotice) ? (
        <div className="pointer-events-none absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex justify-center">
          <div className="pointer-events-auto flex max-w-[min(34rem,calc(100vw-1.5rem))] items-center gap-3 rounded-[var(--arc-radius-md)] border border-[var(--arc-kit-border)] bg-[var(--arc-kit-surface)] px-3 py-2 text-sm text-[var(--arc-color-text)] shadow-[var(--arc-shadow-panel)]">
            <span>{actionNotice ?? persistentNotice}</span>
            {persistentNotice ? (
              <div className="flex shrink-0 gap-1.5">
                {props.corridorPlacement ? (
                  <>
                    <AppButton
                      size="xs"
                      variant="ghost"
                      disabled={props.corridorPlacement.points.length === 0}
                      onClick={props.onUndoCorridorPlacementPoint}
                    >
                      {t("corridorBuild.undoPoint")}
                    </AppButton>
                    <AppButton
                      size="xs"
                      variant="primary"
                      disabled={
                        props.corridorPlacement.pending ||
                        Boolean(props.corridorPlacement.blockingReason) ||
                        props.corridorPlacement.points.length < 2
                      }
                      onClick={props.onConfirmCorridorPlacement}
                    >
                      {t("common.confirm")}
                    </AppButton>
                  </>
                ) : null}
                <AppButton size="xs" variant="ghost" onClick={cancelInteraction}>
                  {t("common.cancel")}
                </AppButton>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {ready && props.showMapControls ? (
        <div className="absolute right-3 top-[max(4.5rem,calc(env(safe-area-inset-top)+4.5rem))] z-10 flex flex-col gap-2">
          <AppButton
            size="icon"
            variant="secondary"
            className="h-11 w-11"
            aria-label={t("map.controls.zoomIn")}
            onClick={() => controllerRef.current?.zoomBy(1.2)}
          >
            <Plus size={18} aria-hidden="true" />
          </AppButton>
          {props.showZoomIndicator ? (
            <div className="grid min-h-9 min-w-11 place-items-center rounded-[var(--arc-radius-sm)] border border-[var(--arc-kit-border-muted)] bg-[var(--arc-kit-surface-soft)] px-1 text-[10px] tabular-nums text-[var(--arc-color-text-soft)]">
              {Math.round(zoom * 100)}%
            </div>
          ) : null}
          <AppButton
            size="icon"
            variant="secondary"
            className="h-11 w-11"
            aria-label={t("map.controls.zoomOut")}
            onClick={() => controllerRef.current?.zoomBy(1 / 1.2)}
          >
            <Minus size={18} aria-hidden="true" />
          </AppButton>
          <AppButton
            size="icon"
            variant="secondary"
            className="h-11 w-11"
            aria-label={t("map.controls.resetView")}
            onClick={() => controllerRef.current?.resetView()}
          >
            <LocateFixed size={18} aria-hidden="true" />
          </AppButton>
        </div>
      ) : null}

      {ready ? (
        <div className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-10 rounded-[var(--arc-radius-sm)] border border-[var(--arc-kit-border-muted)] bg-[var(--arc-kit-surface-soft)] px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--arc-color-text-muted)]">
          {t("hexMap.phaserRenderer")}
        </div>
      ) : null}

      <AppModal
        open={Boolean(foundCityTarget)}
        onClose={() => setFoundCityTarget(null)}
        modalKey="found-city"
        paddingClassName="flex items-center justify-center p-3"
        panelClassName="h-auto max-h-[min(34rem,calc(100dvh-1.5rem))] w-full max-w-md"
      >
        <AppModalHeader
          title={t("hexMap.foundCityConfirmTitle")}
          description={t("hexMap.foundCityTooltipCan")}
          onClose={() => setFoundCityTarget(null)}
        />
        <div className="relative z-10 space-y-4">
          <GameTextField
            label={t("hexMap.foundCityNameLabel")}
            value={cityName}
            maxLength={32}
            invalid={cityNameInvalid}
            error={cityNameInvalid ? t("hexMap.foundCityNameRequired") : undefined}
            hint={t("hexMap.foundCityNameCounter", {
              current: cityName.length,
              max: 32,
            })}
            onChange={(event) => {
              setCityName(event.target.value);
              setCityNameInvalid(false);
            }}
          />
          <div className="flex justify-end gap-2">
            <AppButton variant="ghost" onClick={() => setFoundCityTarget(null)}>
              {t("common.cancel")}
            </AppButton>
            <AppButton variant="primary" onClick={confirmFoundCity}>
              {t("common.confirm")}
            </AppButton>
          </div>
        </div>
      </AppModal>
    </section>
  );
}

function collectCityHexIds(
  world: ReturnType<typeof useGameStore.getState>["worldBase"],
): Set<HexId> {
  return new Set(
    Object.values(world?.cityMarkersById ?? {}).map(
      (city) => city.targetHexId,
    ),
  );
}

function resolveInitialFocusHexId(
  manifest: HexMapClientManifest,
): HexId | null {
  const region = [...manifest.regions].sort(
    (left, right) =>
      right.tileCount -
      right.waterTileCount -
      (left.tileCount - left.waterTileCount),
  )[0];
  return region
    ? (`hex:${region.labelAnchor.q}:${region.labelAnchor.r}` as HexId)
    : null;
}

function findTag(tile: HexTile, prefix: string): string | undefined {
  return tile.mapTags.find((tag) => tag.startsWith(prefix));
}

function mapTagLabelKey(tag: string): string {
  const separator = tag.indexOf(":");
  return separator > 0
    ? `mapTag.${tag.slice(0, separator)}.${tag.slice(separator + 1)}`
    : "mapTag.unknown";
}

function buildTagGroups(
  tile: HexTile,
  t: (key: string, params?: Record<string, string | number>) => string,
): Array<{ label: string; value: string }> {
  const definitions = [
    ["hexMap.tagGroupBiome", ["biome:"]],
    ["hexMap.tagGroupClimate", ["latitude:", "rainfall:"]],
    ["hexMap.tagGroupRelief", ["morphology:", "slope:", "elevation:"]],
    ["hexMap.tagGroupWater", ["water:", "river:", "coast:", "basin:"]],
    ["hexMap.tagGroupFeatures", ["feature:"]],
    ["hexMap.tagGroupValue", ["fertility:", "landmass:", "continent:"]],
    ["hexMap.tagGroupMovement", ["movement:"]],
  ] as const;
  return definitions
    .map(([labelKey, prefixes]) => ({
      label: t(labelKey),
      value: tile.mapTags
        .filter((tag) => prefixes.some((prefix) => tag.startsWith(prefix)))
        .map((tag) => localizeMapTag(tag, t))
        .join(", "),
    }))
    .filter((group) => group.value.length > 0);
}

function formatCountry(
  countryId: string | null,
  countryNameById: Readonly<Record<string, string>> | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  return countryId
    ? t("hexMap.ownerCountry", {
        country: countryNameById?.[countryId] ?? countryId,
      })
    : t("hexMap.ownerNone");
}

function resolveInteractionNotice(
  props: PhaserMapViewProps,
  command: ActiveUnitCommand | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  if (command) {
    if (command.mode === "attack") return t("hexMap.unitAttackSelectTarget");
    if (command.mode === "foundCity") return t("hexMap.foundCityTooltipCan");
    return t(
      command.kind === "civilian"
        ? "hexMap.civilianMoveSelectTarget"
        : "hexMap.unitMoveSelectTarget",
    );
  }
  if (props.unitTrainingPlacement) return t("hexMap.unitTrainingPlacementHud");
  if (props.colonizerPlacement?.active)
    return t("hexMap.queueColonizerTooltipCan");
  if (props.hexBuildPlacement) return t("hexMap.buildTooltip");
  if (props.corridorPlacement)
    return t("corridorBuild.summary", {
      points: props.corridorPlacement.points.length,
      hexes: props.corridorPlacement.previewHexIds.length,
    });
  return null;
}

function localizeMapTag(
  tag: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const key = mapTagLabelKey(tag);
  const label = t(key);
  return label === key ? t("mapTag.unknown") : label;
}

function resolveMapErrorDescriptionKey(
  code: HexMapLoadFailureCode | "MAP_RENDER_FAILED" | null,
): string {
  if (code === "MAP_WORKER_FAILED") return "hexMap.workerErrorDescription";
  if (code === "MAP_VERSION_MISMATCH")
    return "hexMap.versionMismatchDescription";
  if (code === "MAP_CHUNK_NOT_FOUND")
    return "hexMap.chunkNotFoundDescription";
  if (code === "MAP_RENDER_FAILED") return "hexMap.renderErrorDescription";
  return "hexMap.artifactErrorDescription";
}
