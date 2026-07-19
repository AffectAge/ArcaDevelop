import type { HexMapSettings } from "@arcanorum/shared";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CLIENT_FULL_STYLES_READY_EVENT,
  isStyledMapSurfaceReady,
} from "../clientStartup";
import type { UiLocale } from "../i18n/uiText";
import { apiBase } from "../lib/apiBase";
import {
  HEX_CAMERA_MAX_SCALE,
  HEX_CAMERA_MIN_SCALE,
  type HexCamera,
} from "../map/hexCamera";
import { axialToPixel } from "../map/hexGeometry";
import {
  fetchHexMapClientManifest,
  HexMapChunkStream,
} from "../map/hexMapChunkStream";
import { resolveHexMapPerfApiBase } from "./hexMapPerfApiBase";
import type { HexMapPerfVisualFixture } from "./hexMapPerfVisualFixture";
import { PrewarmedChunkStreamFactory } from "./hexMapPerfChunkStreamFactory";
import { PrewarmedHexMapManifestRequest } from "./hexMapPerfManifestPreload";

let mapViewModulePromise: Promise<typeof import("./PhaserMapView")> | null = null;

function loadMapViewModule(): Promise<typeof import("./PhaserMapView")> {
  mapViewModulePromise ??= import("./PhaserMapView");
  return mapViewModulePromise;
}

const MapView = lazy(() =>
  loadMapViewModule().then((module) => ({ default: module.MapView })),
);

export default function HexMapPerfSurface() {
  const mapApiBase = resolveHexMapPerfApiBase(window.location, apiBase);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const visualEvidence = params.get("visualEvidence") === "1";
  const requestedLocale = resolvePerfLocale(params.get("perfLocale"));
  const [visualFixture, setVisualFixture] =
    useState<HexMapPerfVisualFixture | null>(null);
  const [chunkStreamFactory] = useState(
    () =>
      new PrewarmedChunkStreamFactory<HexMapChunkStream>(
        () => new HexMapChunkStream(),
      ),
  );
  const [manifestRequest] = useState(
    () => new PrewarmedHexMapManifestRequest(mapApiBase),
  );
  const [mapViewEnabled, setMapViewEnabled] = useState(false);
  const mapReadyRef = useRef(false);
  const publishReadyState = useCallback(() => {
    const ready = isStyledMapSurfaceReady(
      mapReadyRef.current,
      document.documentElement.dataset.arcFullStylesReady === "true",
    );
    if (ready && document.documentElement.dataset.hexMapReady !== "true") {
      document.documentElement.dataset.hexMapReadyAtMs = String(
        performance.now(),
      );
    }
    document.documentElement.dataset.hexMapReady = ready ? "true" : "false";
  }, []);
  const handleReadyChange = useCallback(
    (ready: boolean) => {
      mapReadyRef.current = ready;
      publishReadyState();
    },
    [publishReadyState],
  );

  useEffect(() => {
    document.addEventListener(
      CLIENT_FULL_STYLES_READY_EVENT,
      publishReadyState,
    );
    publishReadyState();
    return () => {
      document.removeEventListener(
        CLIENT_FULL_STYLES_READY_EVENT,
        publishReadyState,
      );
      document.documentElement.dataset.hexMapReady = "false";
    };
  }, [publishReadyState]);

  useEffect(() => {
    let active = true;
    const stream = chunkStreamFactory.prewarm();
    void manifestRequest.peek().then(
      (manifest) => {
        if (!active) return;
        chunkStreamFactory.withUnclaimed(stream, (unclaimedStream) => {
          unclaimedStream.prepare(
            mapApiBase,
            manifest,
            buildPerfInitialCamera(manifest.settings, params),
            { width: window.innerWidth, height: window.innerHeight },
            { maxBufferedChunks: window.innerWidth <= 768 ? 24 : 48 },
          );
        });
      },
      () => undefined,
    );
    // Keep manifest/worker prewarming first, then overlap the large map module
    // download and evaluation with the initial chunk stream instead of waiting
    // for the next display frame to begin fetching it.
    void loadMapViewModule();
    const mapViewFrame = window.requestAnimationFrame(() => {
      setMapViewEnabled(true);
    });
    return () => {
      active = false;
      window.cancelAnimationFrame(mapViewFrame);
      chunkStreamFactory.destroyUnused();
      manifestRequest.destroyUnused();
    };
  }, [chunkStreamFactory, manifestRequest, mapApiBase, params]);

  useEffect(() => {
    if (!visualEvidence) return;
    const controller = new AbortController();
    document.documentElement.dataset.hexMapReady = "false";
    void Promise.all([
      fetchHexMapClientManifest(mapApiBase, controller.signal),
      import("../i18n/uiText"),
      import("../store/gameStore"),
      import("./hexMapPerfVisualFixture"),
    ]).then(
      ([
        manifest,
        { setUiLocale, tUi },
        { useGameStore },
        { buildHexMapPerfVisualFixture },
      ]) => {
        if (controller.signal.aborted) return;
        setUiLocale(requestedLocale);
        const fixture = buildHexMapPerfVisualFixture(manifest, {
          countryLabel: tUi("map.layer.countryFill", {}, requestedLocale),
          cityLabel: tUi("hexMap.terrain.city", {}, requestedLocale),
        });
        useGameStore.getState().setWorldBase(fixture.worldBase, 1, 1);
        setVisualFixture(fixture);
      },
    );
    return () => controller.abort();
  }, [mapApiBase, requestedLocale, visualEvidence]);

  if (visualEvidence && !visualFixture) {
    return (
      <main
        className="relative h-screen overflow-hidden bg-arc-bg"
        data-testid="hex-map-perf-surface"
        aria-busy="true"
      />
    );
  }

  return (
    <main
      className="relative h-screen overflow-hidden bg-arc-bg text-[var(--arc-color-text)]"
      data-testid="hex-map-perf-surface"
    >
      {mapViewEnabled ? (
        <Suspense fallback={null}>
          <MapView
            apiBase={mapApiBase}
            createChunkStream={chunkStreamFactory.take}
            loadClientManifest={manifestRequest.load}
            scenarioId="default"
            countryColorById={visualFixture?.countryColorById}
            countryNameById={visualFixture?.countryNameById}
            showMapControls
            showZoomIndicator
            onMapReadyChange={handleReadyChange}
          />
        </Suspense>
      ) : null}
    </main>
  );
}

function resolvePerfLocale(value: string | null): UiLocale {
  return value === "en" ? "en" : "ru";
}

function buildPerfInitialCamera(
  settings: HexMapSettings,
  params: URLSearchParams,
): HexCamera {
  const center = axialToPixel(
    { q: settings.width / 2, r: settings.height / 2 },
    settings.hexSize,
  );
  const requested = Number(params.get("hexScale"));
  const scale =
    params.get("hexScale")?.trim() && Number.isFinite(requested)
      ? Math.max(
          HEX_CAMERA_MIN_SCALE,
          Math.min(HEX_CAMERA_MAX_SCALE, requested),
        )
      : 1;
  return { ...center, scale };
}
