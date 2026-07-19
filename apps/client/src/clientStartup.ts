export const CLIENT_FULL_STYLES_READY_EVENT = "arc:full-styles-ready";
export const CLIENT_OPTIONAL_FONT_STYLESHEET = {
  href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700&family=Rajdhani:wght@500;700&display=swap",
  media: "print",
  rel: "stylesheet",
} as const;

export interface ParallelClientStartup<TEntry> {
  entryReady: Promise<TEntry>;
  stylesReady: Promise<void>;
}

export function beginParallelClientStartup<TEntry>(
  loadStyles: () => Promise<unknown>,
  loadEntry: () => Promise<TEntry>,
): ParallelClientStartup<TEntry> {
  const stylesReady = loadStyles().then(() => undefined);
  const entryReady = loadEntry();
  return { entryReady, stylesReady };
}

export function isStyledMapSurfaceReady(
  mapReady: boolean,
  fullStylesReady: boolean,
): boolean {
  return mapReady && fullStylesReady;
}

type ClientStyleReadinessTarget = {
  documentElement: { dataset: DOMStringMap };
  addEventListener: Document["addEventListener"];
  removeEventListener: Document["removeEventListener"];
};

export function waitForClientFullStylesReady(
  target: ClientStyleReadinessTarget = document,
): Promise<void> {
  if (target.documentElement.dataset.arcFullStylesReady === "true") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const handleReady = () => {
      if (target.documentElement.dataset.arcFullStylesReady !== "true") return;
      target.removeEventListener(CLIENT_FULL_STYLES_READY_EVENT, handleReady);
      resolve();
    };
    target.addEventListener(CLIENT_FULL_STYLES_READY_EVENT, handleReady);
    handleReady();
  });
}

export function loadOptionalClientFonts(target: Document = document): void {
  if (target.querySelector('link[data-arc-optional-fonts="true"]')) return;
  const link = target.createElement("link");
  link.rel = CLIENT_OPTIONAL_FONT_STYLESHEET.rel;
  link.href = CLIENT_OPTIONAL_FONT_STYLESHEET.href;
  link.media = CLIENT_OPTIONAL_FONT_STYLESHEET.media;
  link.dataset.arcOptionalFonts = "true";
  link.addEventListener(
    "load",
    () => {
      link.media = "all";
    },
    { once: true },
  );
  target.head.append(link);
}
