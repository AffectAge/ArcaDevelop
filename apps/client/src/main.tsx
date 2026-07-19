import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import {
  beginParallelClientStartup,
  CLIENT_FULL_STYLES_READY_EVENT,
  loadOptionalClientFonts,
} from "./clientStartup";

const isHexMapPerfSurface = window.location.pathname === "/hex-perf";
const root = ReactDOM.createRoot(document.getElementById("root")!);

document.documentElement.dataset.arcFullStylesReady = "false";

if (isHexMapPerfSurface) {
  // Start the large map runtime chunk with the perf shell instead of waiting
  // for the shell's first passive effect. The browser module loader coalesces
  // the later lazy import, while map data and renderer code download in
  // parallel on a genuinely cold profile.
  void import("./components/PhaserMapView");
  const startup = beginParallelClientStartup(
    () => import("./styles.css"),
    () => import("./components/HexMapPerfSurface"),
  );
  const HexMapPerfSurface = lazy(() => startup.entryReady);

  void publishFullStylesReady(startup.stylesReady);
  root.render(
    <Suspense fallback={null}>
      <HexMapPerfSurface />
    </Suspense>,
  );
} else {
  const startup = beginParallelClientStartup(
    () => import("./styles.css"),
    () => Promise.all([import("./App"), import("sonner")]),
  );

  void Promise.all([
    publishFullStylesReady(startup.stylesReady),
    startup.entryReady,
  ]).then(([, [{ default: ApplicationEntry }, { Toaster }]]) => {
    root.render(
      <React.StrictMode>
        <ApplicationEntry />
        <Toaster
          position="top-center"
          offset={86}
          expand={false}
          visibleToasts={4}
          toastOptions={{
            classNames: {
              toast: "arc-toast",
              title: "arc-toast-title",
              description: "arc-toast-description",
              success: "arc-toast-success",
              error: "arc-toast-error",
              warning: "arc-toast-warning",
            },
          }}
        />
      </React.StrictMode>,
    );
  });
}

function publishFullStylesReady(stylesReady: Promise<void>): Promise<void> {
  return stylesReady.then(() => {
    document.documentElement.dataset.arcFullStylesReady = "true";
    document.documentElement.dataset.arcFullStylesReadyAtMs = String(
      performance.now(),
    );
    document.dispatchEvent(new Event(CLIENT_FULL_STYLES_READY_EVENT));
    if (!isHexMapPerfSurface) loadOptionalClientFonts();
  });
}
