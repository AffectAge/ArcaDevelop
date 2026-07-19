import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { createServer } from "node:net";
import WebSocket from "ws";
const fixtureModule = await import("./hex-map-perf-fixtures.ts");
const budgetModule = await import("./hex-map-performance-budgets.ts");
const {
  readHexMapPerfFixtureRegistry,
  resolveHexMapPerfFixtureCacheRoot,
  startHexMapPerfFixtureServer,
} = fixtureModule.default ?? fixtureModule;
const {
  assertHexMapPerformanceBudgets,
  resolveEffectiveFirstInteractiveMs,
  resolveHexMapPerformanceExitCode,
  resolveVersionedCacheEvidence,
} = budgetModule.default ?? budgetModule;

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const chromePath = process.env.CHROME_PATH || (await findChromePath());
const positionalUrl = process.argv
  .slice(2)
  .find((value) => /^https?:\/\//.test(value));
const baseUrl =
  [readArg("--url"), positionalUrl, process.env.npm_config_url].find(
    (value) => typeof value === "string" && /^https?:\/\//.test(value),
  ) ?? "http://127.0.0.1:5173";
const remotePort = Number(
  readArg("--remote-port") ?? process.env.npm_config_remote_port ?? "9225",
);
const fixturePort = Number(
  readArg("--fixture-port") ?? process.env.npm_config_fixture_port ?? "0",
);
const readyTimeoutMs = Number(
  readArg("--ready-timeout") ?? process.env.npm_config_ready_timeout ?? "90000",
);
const cdpCommandTimeoutMs = Number(
  readArg("--cdp-command-timeout") ??
    process.env.npm_config_cdp_command_timeout ??
    "10000",
);
const interactionTimeoutMs = Number(
  readArg("--interaction-timeout") ??
    process.env.npm_config_interaction_timeout ??
    "30000",
);
const assertBudgets =
  process.argv.includes("--assert") ||
  process.argv.includes("assert") ||
  process.env.npm_config_assert === "true";
const captureScreenshots =
  process.argv.includes("--screenshots") ||
  process.env.npm_config_screenshots === "true";
const screenshotRoot = path.resolve(
  repositoryRoot,
  readArg("--screenshot-dir") ?? ".generated/map-perf/screenshots",
);
const allCases = [
  {
    name: "default-desktop",
    fixtureId: "default",
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  },
  {
    name: "200k-desktop",
    fixtureId: "200k",
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  },
  {
    name: "default-mobile-style",
    fixtureId: "default",
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  },
  {
    name: "200k-mobile-style",
    fixtureId: "200k",
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  },
];
const requestedCase = [
  readArg("--case"),
  process.argv
    .slice(2)
    .find((value) => allCases.some((entry) => entry.name === value)),
  process.env.npm_config_case,
].find((value) => allCases.some((entry) => entry.name === value));
const cases = requestedCase
  ? allCases.filter((entry) => entry.name === requestedCase)
  : allCases;

if (requestedCase && cases.length === 0)
  throw new Error(`Unknown benchmark case: ${requestedCase}`);
if (!chromePath)
  throw new Error(
    "Chrome/Edge executable was not found. Set CHROME_PATH to run the benchmark.",
  );
if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65_535)
  throw new Error("--remote-port must be a valid TCP port.");
if (!Number.isInteger(fixturePort) || fixturePort < 0 || fixturePort > 65_535)
  throw new Error("--fixture-port must be zero or a valid TCP port.");
if (
  !Number.isFinite(readyTimeoutMs) ||
  readyTimeoutMs < 1_000 ||
  readyTimeoutMs > 300_000
)
  throw new Error("--ready-timeout must be between 1000 and 300000 ms.");
if (
  !Number.isFinite(cdpCommandTimeoutMs) ||
  cdpCommandTimeoutMs < 1_000 ||
  cdpCommandTimeoutMs > 60_000
)
  throw new Error("--cdp-command-timeout must be between 1000 and 60000 ms.");
if (
  !Number.isFinite(interactionTimeoutMs) ||
  interactionTimeoutMs < 1_000 ||
  interactionTimeoutMs > 120_000
)
  throw new Error("--interaction-timeout must be between 1000 and 120000 ms.");

const fixtureIds = [
  ...new Set([
    ...cases.map((entry) => entry.fixtureId),
    ...(captureScreenshots ? ["default"] : []),
  ]),
];
await ensureFixtureCache(fixtureIds);
const fixtureCacheRoot = resolveHexMapPerfFixtureCacheRoot(repositoryRoot);
const fixtureRegistry = await readHexMapPerfFixtureRegistry(fixtureCacheRoot);
const fixtureServer = await startHexMapPerfFixtureServer({
  cacheRoot: fixtureCacheRoot,
  fixtureIds,
  port: fixturePort,
});
const userDataDir = await fs.mkdtemp(
  path.join(os.tmpdir(), "arc-hex-map-bench-"),
);
let chrome = null;

try {
  await assertPortAvailable(remotePort);
  chrome = spawn(chromePath, [
    `--remote-debugging-port=${remotePort}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling",
    "--enable-precise-memory-info",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ]);
  chrome.stderr?.on("data", () => {});
  await Promise.race([
    waitForChrome(remotePort),
    new Promise((_, rejectPromise) => chrome.once("error", rejectPromise)),
  ]);
  const results = [];
  for (const benchCase of cases) {
    const registryEntry = fixtureRegistry.fixtures[benchCase.fixtureId];
    if (!registryEntry)
      throw new Error(`HEX_MAP_PERF_FIXTURE_MISSING:${benchCase.fixtureId}`);
    results.push(
      await measureCase(
        benchCase,
        registryEntry,
        fixtureServer.apiBaseForFixture(benchCase.fixtureId),
      ),
    );
  }
  const screenshots = captureScreenshots
    ? await captureHexMapScreenshots(
        fixtureServer.apiBaseForFixture("default"),
        screenshotRoot,
      )
    : [];
  const failures = assertBudgets
    ? results.flatMap((result) => assertHexMapPerformanceBudgets(result))
    : [];
  process.stdout.write(
    `${JSON.stringify({ baseUrl, fixtureServer: fixtureServer.origin, chromePath, asserted: assertBudgets, screenshots, results, failures }, null, 2)}\n`,
  );
  process.exitCode = resolveHexMapPerformanceExitCode(failures);
} finally {
  if (chrome) await terminateOwnedProcessTree(chrome);
  await fixtureServer.close().catch(() => undefined);
  await delay(250);
  await fs
    .rm(userDataDir, { recursive: true, force: true })
    .catch(() => undefined);
}

async function measureCase(benchCase, registryEntry, perfApiBase) {
  const target = await createTarget(remotePort);
  const cdp = await connectCdp(target.webSocketDebuggerUrl, {
    commandTimeoutMs: cdpCommandTimeoutMs,
  });
  let networkCacheTracker = null;
  let initialStats = null;
  let coldPageLoad = null;
  try {
    await cdp.send("Page.enable");
    await cdp.send("Page.bringToFront");
    await cdp.send("Page.setWebLifecycleState", { state: "active" });
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await cdp.send("HeapProfiler.enable");
    await cdp.send("Network.enable");
    networkCacheTracker = createMapNetworkCacheTracker(cdp, perfApiBase);
    await installPageDiagnostics(cdp);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: benchCase.width,
      height: benchCase.height,
      deviceScaleFactor: benchCase.deviceScaleFactor,
      mobile: benchCase.mobile,
    });
    if (benchCase.mobile) {
      await cdp.send("Emulation.setUserAgentOverride", {
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; ArcanorumMapPerf) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36",
        platform: "Android",
      });
    }
    const url = new URL("/hex-perf", baseUrl);
    url.searchParams.set("perfApiBase", perfApiBase);
    await cdp.send("Page.navigate", { url: url.href });
    initialStats = await waitForStats(cdp, benchCase.name);
    coldPageLoad = await readColdPageLoadDiagnostics(cdp);
    const firstInteractiveMs = resolveEffectiveFirstInteractiveMs(
      [
        initialStats?.firstInteractiveMs,
        initialStats?.readyAtMs,
        initialStats?.phases?.firstInteractiveMs,
      ],
      coldPageLoad?.readiness,
    );
    process.stderr.write(
      `[map-perf:cold] ${benchCase.name} ${JSON.stringify({ firstInteractiveMs, readiness: coldPageLoad?.readiness, foreground: coldPageLoad?.foreground, startupCadence: coldPageLoad?.startupCadence, scripts: coldPageLoad?.scripts, styles: coldPageLoad?.styles, mapAssets: coldPageLoad?.mapAssets, coldLongTasks: coldPageLoad?.coldLongTasks, streamMarks: coldPageLoad?.streamMarks, runtimeMarks: coldPageLoad?.runtimeMarks, reactMarks: coldPageLoad?.reactMarks })}\n`,
    );
    const surfaceRect = await readSurfaceRect(cdp);

    await boundedInteraction("warm-pan", () =>
      runPanCycles(cdp, surfaceRect, 3, 6, 12),
    );
    await boundedInteraction("warm-wheel", () =>
      runWheelSequence(cdp, surfaceRect),
    );
    await boundedInteraction("warm-hover", () =>
      runHoverSweep(cdp, surfaceRect, 14, 8),
    );
    await boundedInteraction("warm-country-fill-toggle", () =>
      toggleScriptedMapLayer(cdp, "countryFill"),
    );
    await waitForMapCacheToSettle(cdp);
    await collectGarbage(cdp);
    const warmedBaseline = await readRetainedSnapshot(cdp);

    await beginPerformanceProbe(cdp);
    await measureInteractionSegment(cdp, "pan", () =>
      runPanCycles(cdp, surfaceRect, 20, 5, 10),
    );
    await measureInteractionSegment(cdp, "wheel", () =>
      runWheelSequence(cdp, surfaceRect),
    );
    await measureInteractionSegment(cdp, "hover", () =>
      runHoverSweep(cdp, surfaceRect, 42, 12),
    );
    await measureInteractionSegment(cdp, "countryFill", () =>
      toggleScriptedMapLayer(cdp, "countryFill"),
    );
    await waitForInteractionSamples(cdp);
    await waitForMapCacheToSettle(cdp);
    const stats = await evaluateStats(cdp);
    const settledMapDiagnostics = await readSettledMapDiagnostics(
      cdp,
      firstInteractiveMs,
    );
    const reportedStats = stats ? { ...stats } : {};
    delete reportedStats.frameTimesMs;
    delete reportedStats.frameWorkTimesMs;
    const probe = await finishPerformanceProbe(cdp);
    // Forced GC is retained-memory bookkeeping, not a player interaction. Keep it
    // outside the Long Tasks observer so the interaction gate measures only map work.
    await collectGarbage(cdp);
    const retainedAfterCycles = await readRetainedSnapshot(cdp);
    const firstOpenCdpCacheEvidence = networkCacheTracker.snapshotAndReset();
    const firstOpenCacheEvidence = resolveVersionedCacheEvidence(
      firstOpenCdpCacheEvidence,
      stats?.phases,
    );
    const sortedDisplayFrameIntervals = probe.frameTimesMs
      .filter(Number.isFinite)
      .sort((left, right) => left - right);
    const frameWorkTimes = Array.isArray(stats?.frameWorkTimesMs)
      ? stats.frameWorkTimesMs
      : [];
    const sortedFrameTimes = frameWorkTimes
      .filter(Number.isFinite)
      .sort((left, right) => left - right);
    const sortedHoverLatencies = probe.hoverLatenciesMs
      .filter(Number.isFinite)
      .sort((left, right) => left - right);
    const sortedLayerLatencies = probe.layerLatenciesMs
      .filter(Number.isFinite)
      .sort((left, right) => left - right);
    await cdp.send("Page.reload", { ignoreCache: false });
    const reopenedStats = await waitForStats(
      cdp,
      `${benchCase.name}:cache-reopen`,
    );
    const reopenedCacheEvidence = resolveVersionedCacheEvidence(
      networkCacheTracker.snapshotAndReset(),
      reopenedStats?.phases,
    );
    return {
      name: benchCase.name,
      fixtureId: benchCase.fixtureId,
      url: url.href,
      ...reportedStats,
      fixtureTiles: registryEntry.expectedTileCount,
      fixtureChunkCount: registryEntry.chunkCount,
      fixtureBrotliBytes: registryEntry.brotliByteLength,
      coldPageLoad,
      settledMapDiagnostics,
      postReadyLongTaskCount:
        settledMapDiagnostics.postReadyLongTasks.length,
      longestPostReadyTaskMs: settledMapDiagnostics.postReadyLongTasks.reduce(
        (maximum, entry) => Math.max(maximum, Number(entry.duration ?? 0)),
        0,
      ),
      firstInteractiveMs,
      frameP50Ms: percentile(sortedFrameTimes, 0.5),
      frameP95Ms: percentile(sortedFrameTimes, 0.95),
      frameP99Ms: percentile(sortedFrameTimes, 0.99),
      displayFrameIntervalP50Ms: percentile(sortedDisplayFrameIntervals, 0.5),
      displayFrameIntervalP95Ms: percentile(sortedDisplayFrameIntervals, 0.95),
      displayFrameIntervalP99Ms: percentile(sortedDisplayFrameIntervals, 0.99),
      hoverLatencyP50Ms: percentile(sortedHoverLatencies, 0.5),
      hoverLatencyP95Ms: percentile(sortedHoverLatencies, 0.95),
      hoverLatencyP99Ms: percentile(sortedHoverLatencies, 0.99),
      hoverLatencySamples: sortedHoverLatencies.length,
      layerLatencyP50Ms: percentile(sortedLayerLatencies, 0.5),
      layerLatencyP95Ms: percentile(sortedLayerLatencies, 0.95),
      layerLatencyP99Ms: percentile(sortedLayerLatencies, 0.99),
      layerLatencySamples: sortedLayerLatencies.length,
      longTaskCount: probe.longTasks.length,
      interactionLongTasks: probe.longTasks,
      longestTaskMs: probe.longTasks.reduce(
        (maximum, entry) => Math.max(maximum, Number(entry.duration ?? 0)),
        0,
      ),
      interactionFrameCount: sortedFrameTimes.length,
      interactionDisplayFrameCount: sortedDisplayFrameIntervals.length,
      interactionRenderCount: Math.max(
        0,
        Number(stats?.renderCount ?? 0) - probe.renderCountAtStart,
      ),
      maxRendersPerDisplayFrame: probe.maxRendersPerDisplayFrame,
      warmedBaseline,
      retainedAfterCycles,
      retainedHeapGrowthPct: growthPercent(
        warmedBaseline.usedJsHeapBytes,
        retainedAfterCycles.usedJsHeapBytes,
      ),
      retainedCacheGrowthPct: growthPercent(
        warmedBaseline.cacheBytes,
        retainedAfterCycles.cacheBytes,
      ),
      retainedResidentChunkGrowthPct: growthPercent(
        warmedBaseline.residentChunks,
        retainedAfterCycles.residentChunks,
      ),
      cacheReopen: {
        firstOpen: firstOpenCacheEvidence,
        reopened: reopenedCacheEvidence,
      },
      viewport: {
        width: benchCase.width,
        height: benchCase.height,
        deviceScaleFactor: benchCase.deviceScaleFactor,
        mobile: benchCase.mobile,
      },
    };
  } catch (error) {
    coldPageLoad ??= await readColdPageLoadDiagnostics(cdp).catch(() => null);
    const message = error instanceof Error ? error.message : String(error);
    if (!initialStats) {
      throw new Error(
        `${message}; coldPageLoad=${JSON.stringify(coldPageLoad)}`,
        { cause: error },
      );
    }
    throw new Error(
      `${message}; initialStats=${JSON.stringify(summarizeInitialStats(initialStats))}; coldPageLoad=${JSON.stringify(coldPageLoad)}`,
      { cause: error },
    );
  } finally {
    networkCacheTracker?.destroy();
    cdp.close();
    await fetchWithTimeout(
      `http://127.0.0.1:${remotePort}/json/close/${target.id}`,
    ).catch(() => undefined);
  }
}

async function captureHexMapScreenshots(perfApiBase, outputRoot) {
  const states = [
    { name: "far-en", scale: 0.55, locale: "en", reducedMotion: false },
    { name: "mid-en", scale: 1, locale: "en", reducedMotion: false },
    { name: "near-en", scale: 1.7, locale: "en", reducedMotion: false },
    {
      name: "near-reduced-motion-en",
      scale: 1.7,
      locale: "en",
      reducedMotion: true,
    },
    { name: "mid-ru", scale: 1, locale: "ru", reducedMotion: false },
    {
      name: "mid-mobile-dpr2-en",
      scale: 1,
      locale: "en",
      reducedMotion: false,
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    },
  ];
  await fs.mkdir(outputRoot, { recursive: true });
  const paths = [];
  for (const state of states) {
    const target = await createTarget(remotePort);
    const cdp = await connectCdp(target.webSocketDebuggerUrl, {
      commandTimeoutMs: cdpCommandTimeoutMs,
    });
    try {
      await cdp.send("Page.enable");
      await cdp.send("Page.bringToFront");
      await cdp.send("Page.setWebLifecycleState", { state: "active" });
      await cdp.send("Runtime.enable");
      await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
      await installPageDiagnostics(cdp);
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: state.width ?? 1440,
        height: state.height ?? 900,
        deviceScaleFactor: state.deviceScaleFactor ?? 1,
        mobile: state.mobile ?? false,
      });
      await cdp.send("Emulation.setEmulatedMedia", {
        media: "screen",
        features: [
          {
            name: "prefers-reduced-motion",
            value: state.reducedMotion ? "reduce" : "no-preference",
          },
        ],
      });
      const url = new URL("/hex-perf", baseUrl);
      url.searchParams.set("hexScale", String(state.scale));
      url.searchParams.set("perfApiBase", perfApiBase);
      url.searchParams.set("visualEvidence", "1");
      url.searchParams.set("perfLocale", state.locale);
      await cdp.send("Page.navigate", { url: url.href });
      await waitForStats(cdp, `screenshot:${state.name}`);
      await delay(750);
      const screenshot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      const outputPath = path.join(outputRoot, `${state.name}.png`);
      await fs.writeFile(outputPath, Buffer.from(screenshot.data, "base64"));
      paths.push(toPortableRelativePath(repositoryRoot, outputPath));
    } finally {
      cdp.close();
      await fetchWithTimeout(
        `http://127.0.0.1:${remotePort}/json/close/${target.id}`,
      ).catch(() => undefined);
    }
  }
  return paths;
}

async function ensureFixtureCache(fixtureIdsToBuild) {
  const tsxCliPath = path.resolve(
    repositoryRoot,
    "node_modules/tsx/dist/cli.mjs",
  );
  const buildScriptPath = path.resolve(
    repositoryRoot,
    "scripts/build-hex-map-perf-fixtures.ts",
  );
  const args = [tsxCliPath, buildScriptPath];
  for (const fixtureId of fixtureIdsToBuild) args.push("--case", fixtureId);
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else
        rejectPromise(
          new Error(
            `Hex map fixture build failed (${signal ?? code ?? "unknown"}).`,
          ),
        );
    });
  });
}

async function waitForStats(cdp, name) {
  const deadline = Date.now() + readyTimeoutMs;
  let lastStats = null;
  let lastReady = false;
  let lastStylesReady = false;
  while (Date.now() < deadline) {
    const stats = await evaluateStats(cdp);
    const ready = await cdp.send("Runtime.evaluate", {
      expression: `({
        map: document.documentElement.dataset.hexMapReady === "true",
        styles: document.documentElement.dataset.arcFullStylesReady === "true",
      })`,
      returnByValue: true,
    });
    lastStats = stats;
    lastReady = ready.result?.value?.map === true;
    lastStylesReady = ready.result?.value?.styles === true;
    if (stats?.failure) {
      throw new Error(
        `HEX_MAP_RUNTIME_FAILURE:${JSON.stringify(stats.failure)}`,
      );
    }
    const hasFiniteStats = [
      stats?.renderCount,
      stats?.residentChunks,
      stats?.cacheBytes,
    ].every((value) => Number.isFinite(Number(value)));
    if (
      lastReady &&
      lastStylesReady &&
      stats &&
      hasFiniteStats &&
      Number(stats.residentChunks ?? 0) > 0
    )
      return stats;
    await delay(250);
  }
  const diagnostics = await cdp.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      errors: window.__arcPerfPageErrors ?? [],
      rootText: document.querySelector("#root")?.textContent?.slice(0, 500) ?? "",
      resourceUrls: performance.getEntriesByType("resource").slice(-12).map((entry) => entry.name),
    })`,
    returnByValue: true,
  });
  throw new Error(
    `Timed out waiting for hex map stats: ${name}; ${JSON.stringify({ ready: lastReady, stylesReady: lastStylesReady, stats: lastStats, page: JSON.parse(diagnostics.result?.value ?? "{}") })}`,
  );
}

async function installPageDiagnostics(cdp) {
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const errors = [];
      const append = (value) => {
        errors.push(String(value).slice(0, 500));
        if (errors.length > 20) errors.shift();
      };
      window.__arcPerfPageErrors = errors;
      const coldLongTasks = [];
      window.__arcPerfColdLongTasks = coldLongTasks;
      const startupCadence = { frameCount: 0, maxIntervalMs: 0, lastFrameAtMs: 0 };
      window.__arcPerfStartupCadence = startupCadence;
      requestAnimationFrame(function sampleStartupFrame(timestamp) {
        if (startupCadence.lastFrameAtMs > 0) {
          startupCadence.maxIntervalMs = Math.max(
            startupCadence.maxIntervalMs,
            timestamp - startupCadence.lastFrameAtMs,
          );
        }
        startupCadence.lastFrameAtMs = timestamp;
        startupCadence.frameCount += 1;
        if (document.documentElement.dataset.hexMapReady !== "true")
          requestAnimationFrame(sampleStartupFrame);
      });
      if (typeof PerformanceObserver === "function") {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              coldLongTasks.push({ startTime: entry.startTime, duration: entry.duration });
              if (coldLongTasks.length > 40) coldLongTasks.shift();
            }
          });
          observer.observe({ type: "longtask", buffered: true });
        } catch {}
      }
      window.addEventListener("error", (event) => append(event.error?.stack || event.message || event.error));
      window.addEventListener("unhandledrejection", (event) => append(event.reason?.stack || event.reason));
    })();`,
  });
}

async function readSurfaceRect(cdp) {
  const response = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const target = document.querySelector(".arc-hex-map__surface canvas") ?? document.querySelector(".arc-hex-map__surface");
      if (!target) return null;
      const rect = target.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    })()`,
    returnByValue: true,
  });
  const rect = response.result?.value;
  if (!rect || rect.width <= 0 || rect.height <= 0)
    throw new Error("Hex map performance surface was not rendered.");
  return rect;
}

async function readColdPageLoadDiagnostics(cdp) {
  const response = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const selectTiming = (entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        startTime: entry.startTime,
        responseEnd: entry.responseEnd,
        duration: entry.duration,
        transferSize: Number(entry.transferSize ?? 0),
        encodedBodySize: Number(entry.encodedBodySize ?? 0),
        decodedBodySize: Number(entry.decodedBodySize ?? 0),
      });
      return JSON.stringify({
        navigation: navigation ? {
          ...selectTiming(navigation),
          responseStart: navigation.responseStart,
          domInteractive: navigation.domInteractive,
          domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
          loadEventEnd: navigation.loadEventEnd,
        } : null,
        scripts: performance.getEntriesByType("resource")
          .filter((entry) => {
            const fileName = new URL(entry.name).pathname.split("/").pop() ?? "";
            return ["index-", "HexMapPerfSurface-", "MapView-", "WebGLRenderer-", "hexMapStreaming.worker-"]
              .some((prefix) => fileName.startsWith(prefix)) && fileName.endsWith(".js");
          })
          .map(selectTiming)
          .sort((left, right) => left.startTime - right.startTime),
        styles: performance.getEntriesByType("resource")
          .filter((entry) => {
            const fileName = new URL(entry.name).pathname.split("/").pop() ?? "";
            return fileName.endsWith(".css");
          })
          .map(selectTiming),
        mapAssets: performance.getEntriesByType("resource")
          .filter((entry) => new URL(entry.name).pathname.startsWith("/game-assets/phaser/"))
          .map(selectTiming)
          .sort((left, right) => left.startTime - right.startTime),
        nonCodeResources: performance.getEntriesByType("resource")
          .filter((entry) => !["script", "css"].includes(entry.initiatorType))
          .map(selectTiming)
          .sort((left, right) => left.startTime - right.startTime)
          .slice(0, 40),
        readiness: {
          fullStylesReady: document.documentElement.dataset.arcFullStylesReady === "true",
          fullStylesReadyAtMs: Number(document.documentElement.dataset.arcFullStylesReadyAtMs ?? 0),
          mapReady: document.documentElement.dataset.hexMapReady === "true",
          mapReadyAtMs: Number(document.documentElement.dataset.hexMapReadyAtMs ?? 0),
          stylesAppliedBeforeMapReady:
            Number(document.documentElement.dataset.arcFullStylesReadyAtMs ?? 0) > 0 &&
            Number(document.documentElement.dataset.arcFullStylesReadyAtMs ?? 0) <=
              Number(document.documentElement.dataset.hexMapReadyAtMs ?? 0),
        },
        foreground: {
          visibilityState: document.visibilityState,
          hasFocus: document.hasFocus(),
        },
        startupCadence: window.__arcPerfStartupCadence ?? null,
        coldLongTasks: window.__arcPerfColdLongTasks ?? [],
        streamMarks: performance.getEntriesByType("mark")
          .filter((entry) => entry.name.startsWith("arc-map-stream-"))
          .map((entry) => ({ name: entry.name, startTime: entry.startTime })),
        runtimeMarks: performance.getEntriesByType("mark")
          .filter((entry) => entry.name.startsWith("arc-map-runtime-"))
          .map((entry) => ({ name: entry.name, startTime: entry.startTime })),
        reactMarks: performance.getEntriesByType("mark")
          .filter((entry) => entry.name.startsWith("arc-map-react-"))
          .map((entry) => ({ name: entry.name, startTime: entry.startTime })),
      });
    })()`,
    returnByValue: true,
  });
  return JSON.parse(response.result?.value ?? "{}");
}

async function readSettledMapDiagnostics(cdp, readyAtMs) {
  const response = await cdp.send("Runtime.evaluate", {
    expression: `JSON.stringify((() => {
      const readyAt = ${JSON.stringify(readyAtMs)};
      const longTasks = window.__arcPerfColdLongTasks ?? [];
      return {
        postReadyLongTasks: longTasks.filter((entry) =>
          Number.isFinite(readyAt) && entry.startTime >= readyAt
        ),
        runtimeMarks: performance.getEntriesByType("mark")
          .filter((entry) => entry.name.startsWith("arc-map-runtime-render-"))
          .map((entry) => ({ name: entry.name, startTime: entry.startTime })),
        reactMarks: performance.getEntriesByType("mark")
          .filter((entry) => entry.name.startsWith("arc-map-react-layer-stage-"))
          .map((entry) => ({ name: entry.name, startTime: entry.startTime })),
      };
    })())`,
    returnByValue: true,
  });
  return JSON.parse(
    response.result?.value ??
      '{"postReadyLongTasks":[],"runtimeMarks":[],"reactMarks":[]}',
  );
}

async function beginPerformanceProbe(cdp) {
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      window.__arcCdpPerfProbe?.stop?.();
      const probe = {
        frameTimesMs: [],
        longTasks: [],
        hoverLatenciesMs: [],
        layerLatenciesMs: [],
        renderCountAtStart: Number(window.__arcHexMapStats?.renderCount ?? 0),
        renderCountAtLastFrame: Number(window.__arcHexMapStats?.renderCount ?? 0),
        maxRendersPerDisplayFrame: 0,
        lastFrameAt: performance.now(),
        lastHoverInputAt: 0,
        lastLayerInputAt: 0,
        lastLayerRenderCount: 0,
        rafId: 0,
        longTaskObserver: null,
        mutationObserver: null,
        currentSegment: "idle",
      };
      const appendBounded = (target, value, limit) => {
        if (!Number.isFinite(value) || value < 0) return;
        target.push(value);
        if (target.length > limit) target.shift();
      };
      const frame = (now) => {
        const elapsed = now - probe.lastFrameAt;
        probe.lastFrameAt = now;
        if (elapsed > 0 && elapsed < 1000) appendBounded(probe.frameTimesMs, elapsed, 1200);
        const renderCount = Number(window.__arcHexMapStats?.renderCount ?? probe.renderCountAtLastFrame);
        probe.maxRendersPerDisplayFrame = Math.max(probe.maxRendersPerDisplayFrame, renderCount - probe.renderCountAtLastFrame);
        probe.renderCountAtLastFrame = renderCount;
        if (probe.lastLayerInputAt > 0 && renderCount > probe.lastLayerRenderCount) {
          appendBounded(probe.layerLatenciesMs, now - probe.lastLayerInputAt, 24);
          probe.lastLayerInputAt = 0;
        }
        probe.rafId = requestAnimationFrame(frame);
      };
      const onPointerMove = () => { probe.lastHoverInputAt = performance.now(); };
      const onClick = (event) => {
        if (event.target instanceof Element && event.target.closest(".arc-map-lens-hud button[aria-pressed]")) {
          probe.lastLayerInputAt = performance.now();
          probe.lastLayerRenderCount = Number(window.__arcHexMapStats?.renderCount ?? 0);
        }
      };
      document.addEventListener("pointermove", onPointerMove, true);
      document.addEventListener("click", onClick, true);
      probe.rafId = requestAnimationFrame(frame);
      if (typeof PerformanceObserver === "function") {
        try {
          probe.longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              probe.longTasks.push({
                segment: probe.currentSegment,
                startTime: entry.startTime,
                duration: entry.duration,
              });
              if (probe.longTasks.length > 160) probe.longTasks.shift();
            }
          });
          probe.longTaskObserver.observe({ type: "longtask", buffered: false });
        } catch {}
      }
      probe.mutationObserver = new MutationObserver((mutations) => {
        const now = performance.now();
        for (const mutation of mutations) {
          const target = mutation.target instanceof Element ? mutation.target : null;
          const tooltipChanged = Boolean(
            target?.matches(".arc-kit-plot-tooltip-positioner") ||
            target?.closest(".arc-kit-plot-tooltip-positioner") ||
            [...mutation.addedNodes].some((node) => node instanceof Element && (node.matches(".arc-kit-plot-tooltip-positioner") || node.querySelector(".arc-kit-plot-tooltip-positioner"))),
          );
          if (tooltipChanged && probe.lastHoverInputAt > 0) {
            appendBounded(probe.hoverLatenciesMs, now - probe.lastHoverInputAt, 160);
            probe.lastHoverInputAt = 0;
          }
        }
      });
      probe.mutationObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
      probe.stop = () => {
        cancelAnimationFrame(probe.rafId);
        probe.longTaskObserver?.disconnect();
        probe.mutationObserver?.disconnect();
        document.removeEventListener("pointermove", onPointerMove, true);
        document.removeEventListener("click", onClick, true);
      };
      window.__arcCdpPerfProbe = probe;
    })()`,
  });
}

async function measureInteractionSegment(cdp, segment, action) {
  await setPerformanceProbeSegment(cdp, segment);
  try {
    return await boundedInteraction(`measured-${segment}`, action);
  } finally {
    await setPerformanceProbeSegment(cdp, "idle").catch(() => undefined);
  }
}

async function setPerformanceProbeSegment(cdp, segment) {
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      if (window.__arcCdpPerfProbe) {
        window.__arcCdpPerfProbe.currentSegment = ${JSON.stringify(segment)};
      }
    })()`,
  });
}

async function runPanCycles(cdp, rect, cycleCount, steps, stepDelayMs) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const amplitudeX = Math.min(rect.width * 0.28, 320);
  const amplitudeY = Math.min(rect.height * 0.08, 72);
  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    const direction = cycle % 2 === 0 ? 1 : -1;
    const endX = centerX + amplitudeX * direction;
    const endY = centerY + Math.sin(cycle * 0.7) * amplitudeY;
    await dragBetween(cdp, centerX, centerY, endX, endY, steps, stepDelayMs);
    await dragBetween(cdp, endX, endY, centerX, centerY, steps, stepDelayMs);
  }
}

async function dragBetween(cdp, fromX, fromY, toX, toY, steps, stepDelayMs) {
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: fromX,
    y: fromY,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  for (let index = 1; index <= steps; index += 1) {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: fromX + ((toX - fromX) * index) / steps,
      y: fromY + ((toY - fromY) * index) / steps,
      button: "left",
      buttons: 1,
    });
    await delay(stepDelayMs);
  }
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: toX,
    y: toY,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await delay(20);
}

async function runWheelSequence(cdp, rect) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  for (const deltaY of [-320, -220, 220, 320]) {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: centerX,
      y: centerY,
      deltaX: 0,
      deltaY,
    });
    await delay(100);
  }
}

async function runHoverSweep(cdp, rect, steps, stepDelayMs) {
  for (let index = 0; index <= steps; index += 1) {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: rect.left + rect.width * (0.18 + (index / steps) * 0.64),
      y: rect.top + rect.height * (0.34 + Math.sin(index / 2.8) * 0.16),
      button: "none",
      buttons: 0,
    });
    await delay(stepDelayMs);
  }
}

async function toggleScriptedMapLayer(cdp, layerId) {
  const response = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const button = document.querySelector(${JSON.stringify(`.arc-map-lens-hud button[data-map-layer-id="${layerId}"]`)});
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return {
        id: button.getAttribute("data-map-layer-id"),
        label: button.getAttribute("aria-label"),
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    })()`,
    returnByValue: true,
  });
  const point = response.result?.value;
  if (!point)
    throw new Error(
      `Map layer toggle ${layerId} was not rendered on the performance surface.`,
    );
  let inputStage = "before-click";
  try {
    for (let index = 0; index < 2; index += 1) {
      inputStage = `click-${index + 1}:press`;
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: point.x,
        y: point.y,
        button: "left",
        buttons: 1,
        clickCount: 1,
      });
      inputStage = `click-${index + 1}:release`;
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: point.x,
        y: point.y,
        button: "left",
        buttons: 0,
        clickCount: 1,
      });
      await delay(100);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `MAP_LAYER_TOGGLE_INPUT_FAILED:${point.id ?? layerId}:${point.label ?? "unlabelled"}:${inputStage}:${message}`,
      { cause: error },
    );
  }
}

async function waitForInteractionSamples(cdp) {
  const deadline = Date.now() + 10_000;
  let sampleCount = 0;
  while (Date.now() < deadline) {
    const response = await cdp.send("Runtime.evaluate", {
      expression: "Number(window.__arcCdpPerfProbe?.frameTimesMs?.length ?? 0)",
      returnByValue: true,
    });
    sampleCount = Number(response.result?.value ?? 0);
    if (sampleCount >= 120) return;
    await delay(200);
  }
  if (sampleCount > 0) return;
  throw new Error(
    "Scripted map interaction probe disappeared before producing samples.",
  );
}

async function waitForMapCacheToSettle(cdp) {
  const deadline = Date.now() + 10_000;
  let previousKey = "";
  let stableChecks = 0;
  while (Date.now() < deadline) {
    const stats = await evaluateStats(cdp);
    const key = `${Number(stats?.residentChunks ?? 0)}:${Number(stats?.cacheBytes ?? 0)}`;
    if (
      Number(stats?.residentChunks ?? 0) > 0 &&
      Number(stats?.cacheBytes ?? 0) > 0 &&
      key === previousKey
    )
      stableChecks += 1;
    else stableChecks = 0;
    if (stableChecks >= 4) return;
    previousKey = key;
    await delay(250);
  }
  throw new Error(
    "Timed out waiting for the bounded map chunk cache to settle.",
  );
}

async function collectGarbage(cdp) {
  try {
    await cdp.send("HeapProfiler.collectGarbage");
  } catch {
    // The required retained-memory metric will be reported as missing if this Chrome build disables collection.
  }
  await delay(150);
}

async function readRetainedSnapshot(cdp) {
  const response = await cdp.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      usedJsHeapBytes: Number(performance.memory?.usedJSHeapSize ?? 0),
      cacheBytes: Number(window.__arcHexMapStats?.cacheBytes ?? 0),
      residentChunks: Number(window.__arcHexMapStats?.residentChunks ?? 0),
    })`,
    returnByValue: true,
  });
  return JSON.parse(response.result?.value ?? "{}");
}

async function finishPerformanceProbe(cdp) {
  const response = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const probe = window.__arcCdpPerfProbe;
      probe?.stop?.();
      return JSON.stringify({
        frameTimesMs: probe?.frameTimesMs ?? [],
        longTasks: probe?.longTasks ?? [],
        hoverLatenciesMs: probe?.hoverLatenciesMs ?? [],
        layerLatenciesMs: probe?.layerLatenciesMs ?? [],
        renderCountAtStart: Number(probe?.renderCountAtStart ?? 0),
        maxRendersPerDisplayFrame: Number(probe?.maxRendersPerDisplayFrame ?? 0),
      });
    })()`,
    returnByValue: true,
  });
  return JSON.parse(response.result?.value ?? "{}");
}

async function evaluateStats(cdp) {
  const response = await cdp.send("Runtime.evaluate", {
    expression:
      "window.__arcHexMapStats ? JSON.stringify(window.__arcHexMapStats) : null",
    returnByValue: true,
  });
  const value = response.result?.value;
  return value ? JSON.parse(value) : null;
}

function percentile(sortedValues, quantile) {
  if (sortedValues.length === 0) return null;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * quantile) - 1),
  );
  return Math.round(sortedValues[index] * 100) / 100;
}

function growthPercent(before, after) {
  if (!Number.isFinite(before) || before <= 0 || !Number.isFinite(after))
    return null;
  return Math.round(((after - before) / before) * 100 * 100) / 100;
}

function firstFiniteNumber(...values) {
  return values.map(Number).find(Number.isFinite) ?? null;
}

async function waitForChrome(port) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetchWithTimeout(
        `http://127.0.0.1:${port}/json/version`,
      );
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await delay(250);
  }
  throw new Error("Timed out waiting for Chrome DevTools endpoint.");
}

async function createTarget(port) {
  const response = await fetchWithTimeout(
    `http://127.0.0.1:${port}/json/new?about:blank`,
    { method: "PUT" },
  );
  if (!response.ok)
    throw new Error(`Failed to create CDP target: ${response.status}`);
  const target = await response.json();
  const targetsResponse = await fetchWithTimeout(
    `http://127.0.0.1:${port}/json/list`,
  );
  if (targetsResponse.ok) {
    const targets = await targetsResponse.json();
    for (const candidate of targets) {
      if (candidate.type !== "page" || candidate.id === target.id) continue;
      await fetchWithTimeout(
        `http://127.0.0.1:${port}/json/close/${candidate.id}`,
      ).catch(() => undefined);
    }
  }
  return target;
}

function createMapNetworkCacheTracker(cdp, perfApiBase) {
  const requestById = new Map();
  const apiPrefix = `${perfApiBase.replace(/\/$/, "")}/hex-map/`;
  const isVersionedMapUrl = (url) =>
    url.startsWith(apiPrefix) &&
    (/\/hex-map\/navigation\?/.test(url) || /\/hex-map\/chunks\//.test(url));
  const getRequest = (requestId, url = "") => {
    let request = requestById.get(requestId);
    if (!request) {
      request = { requestId, url, cacheHit: false, encodedDataLength: 0 };
      requestById.set(requestId, request);
      while (requestById.size > 256) {
        requestById.delete(requestById.keys().next().value);
      }
    } else if (url) {
      request.url = url;
    }
    return request;
  };
  const removeRequestListener = cdp.on(
    "Network.requestWillBeSent",
    (params) => {
      const url = String(params.request?.url ?? "");
      if (isVersionedMapUrl(url)) getRequest(params.requestId, url);
    },
  );
  const removeCacheListener = cdp.on(
    "Network.requestServedFromCache",
    (params) => {
      const request = requestById.get(params.requestId);
      if (request) request.cacheHit = true;
    },
  );
  const removeResponseListener = cdp.on(
    "Network.responseReceived",
    (params) => {
      const url = String(params.response?.url ?? "");
      if (!isVersionedMapUrl(url)) return;
      const request = getRequest(params.requestId, url);
      request.cacheHit =
        request.cacheHit ||
        Boolean(params.response?.fromDiskCache) ||
        Boolean(params.response?.fromPrefetchCache) ||
        Boolean(params.response?.fromServiceWorker);
      request.encodedDataLength = Math.max(
        request.encodedDataLength,
        Number(params.response?.encodedDataLength ?? 0),
      );
    },
  );
  const removeFinishedListener = cdp.on("Network.loadingFinished", (params) => {
    const request = requestById.get(params.requestId);
    if (!request) return;
    request.encodedDataLength = Math.max(
      request.encodedDataLength,
      Number(params.encodedDataLength ?? 0),
    );
  });
  return {
    snapshotAndReset() {
      const unique = [
        ...new Map(
          [...requestById.values()]
            .filter((request) => isVersionedMapUrl(request.url))
            .map((request) => [request.url, request]),
        ).values(),
      ];
      requestById.clear();
      return {
        versionedResourceCount: unique.length,
        cacheHitCount: unique.filter((request) => request.cacheHit).length,
        networkTransferBytes: unique.reduce(
          (sum, request) =>
            sum + (request.cacheHit ? 0 : request.encodedDataLength),
          0,
        ),
        encodedBodyBytes: unique.reduce(
          (sum, request) => sum + request.encodedDataLength,
          0,
        ),
      };
    },
    destroy() {
      removeRequestListener();
      removeCacheListener();
      removeResponseListener();
      removeFinishedListener();
      requestById.clear();
    },
  };
}

function connectCdp(webSocketDebuggerUrl, options) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const commandTimeoutMs = options.commandTimeoutMs;
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  const rejectPending = (error) => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timeoutId);
      entry.reject(error);
    }
    pending.clear();
  };
  socket.on("message", (data) => {
    const message = JSON.parse(String(data));
    if (!message.id) {
      for (const listener of listeners.get(message.method) ?? []) {
        listener(message.params ?? {});
      }
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timeoutId);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  socket.on("close", () => {
    rejectPending(new Error("CDP_CONNECTION_CLOSED"));
  });
  socket.on("error", (error) => {
    rejectPending(error);
  });
  return new Promise((resolvePromise, rejectPromise) => {
    const connectionTimeoutId = setTimeout(() => {
      socket.terminate();
      rejectPromise(new Error(`CDP_CONNECTION_TIMEOUT:${commandTimeoutMs}ms`));
    }, commandTimeoutMs);
    socket.once("open", () => {
      clearTimeout(connectionTimeoutId);
      resolvePromise({
        send(method, params = {}) {
          const commandId = ++id;
          return new Promise((commandResolve, commandReject) => {
            if (socket.readyState !== WebSocket.OPEN) {
              commandReject(new Error(`CDP_CONNECTION_NOT_OPEN:${method}`));
              return;
            }
            const timeoutId = setTimeout(() => {
              pending.delete(commandId);
              commandReject(
                new Error(
                  `CDP_COMMAND_TIMEOUT:${method}:${commandTimeoutMs}ms`,
                ),
              );
            }, commandTimeoutMs);
            pending.set(commandId, {
              resolve: commandResolve,
              reject: commandReject,
              timeoutId,
            });
            socket.send(
              JSON.stringify({ id: commandId, method, params }),
              (error) => {
                if (!error) return;
                const entry = pending.get(commandId);
                if (!entry) return;
                pending.delete(commandId);
                clearTimeout(entry.timeoutId);
                entry.reject(error);
              },
            );
          });
        },
        on(method, listener) {
          const methodListeners = listeners.get(method) ?? new Set();
          methodListeners.add(listener);
          listeners.set(method, methodListeners);
          return () => methodListeners.delete(listener);
        },
        close() {
          listeners.clear();
          rejectPending(new Error("CDP_CONNECTION_CLOSED_BY_HARNESS"));
          socket.close();
        },
      });
    });
    socket.once("error", (error) => {
      clearTimeout(connectionTimeoutId);
      rejectPromise(error);
    });
  });
}

function boundedInteraction(name, action) {
  return withTimeout(
    Promise.resolve().then(action),
    interactionTimeoutMs,
    `CDP_INTERACTION_TIMEOUT:${name}`,
  ).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`CDP_INTERACTION_FAILED:${name}:${message}`, {
      cause: error,
    });
  });
}

function summarizeInitialStats(stats) {
  return {
    firstInteractiveMs: firstFiniteNumber(
      stats?.firstInteractiveMs,
      stats?.readyAtMs,
      stats?.phases?.firstInteractiveMs,
    ),
    samples: Number(stats?.samples ?? 0),
    renderCount: Number(stats?.renderCount ?? 0),
    residentChunks: Number(stats?.residentChunks ?? 0),
    cacheBytes: Number(stats?.cacheBytes ?? 0),
    phases: stats?.phases ?? null,
  };
}

function withTimeout(promise, timeoutMs, code) {
  let timeoutId;
  const timeout = new Promise((_, rejectPromise) => {
    timeoutId = setTimeout(
      () => rejectPromise(new Error(`${code}:${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timeoutId),
  );
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), cdpCommandTimeoutMs);
  try {
    return await globalThis.fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function assertPortAvailable(port) {
  const server = createServer();
  server.unref();
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", (error) => {
      rejectPromise(
        new Error(
          `Chrome debugging port ${port} is unavailable: ${error.message}`,
        ),
      );
    });
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close((error) => {
        if (error) rejectPromise(error);
        else resolvePromise();
      });
    });
  });
}

async function terminateOwnedProcessTree(child) {
  const pid = Number(child.pid);
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (process.platform === "win32") {
    await new Promise((resolvePromise) => {
      const taskkill = spawn(
        path.join(
          process.env.SystemRoot ?? "C:\\Windows",
          "System32",
          "taskkill.exe",
        ),
        ["/PID", String(pid), "/T", "/F"],
        { stdio: "ignore", windowsHide: true },
      );
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolvePromise();
      };
      const timeoutId = setTimeout(() => {
        taskkill.kill();
        finish();
      }, 5_000);
      taskkill.once("error", finish);
      taskkill.once("exit", finish);
    });
    return;
  }
  if (child.exitCode == null && child.signalCode == null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolvePromise) => child.once("exit", resolvePromise)),
      delay(2_000),
    ]);
  }
  if (child.exitCode == null && child.signalCode == null) child.kill("SIGKILL");
}

async function findChromePath() {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(
            process.env.PROGRAMFILES ?? "",
            "Google/Chrome/Application/chrome.exe",
          ),
          path.join(
            process.env["PROGRAMFILES(X86)"] ?? "",
            "Google/Chrome/Application/chrome.exe",
          ),
          path.join(
            process.env.LOCALAPPDATA ?? "",
            "Google/Chrome/Application/chrome.exe",
          ),
          path.join(
            process.env.PROGRAMFILES ?? "",
            "Microsoft/Edge/Application/msedge.exe",
          ),
          path.join(
            process.env["PROGRAMFILES(X86)"] ?? "",
            "Microsoft/Edge/Application/msedge.exe",
          ),
        ]
      : [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/usr/bin/google-chrome",
          "/usr/bin/chromium",
          "/usr/bin/microsoft-edge",
        ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue searching.
    }
  }
  return null;
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function toPortableRelativePath(rootPath, targetPath) {
  const value = path.relative(rootPath, targetPath);
  return path.sep === "/" ? value : value.split(path.sep).join("/");
}

function delay(ms) {
  return new Promise((resolvePromise) =>
    globalThis.setTimeout(resolvePromise, ms),
  );
}
