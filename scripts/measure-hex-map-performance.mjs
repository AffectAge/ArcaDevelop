import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import WebSocket from "ws";

const chromePath = process.env.CHROME_PATH || (await findChromePath());
const baseUrl = readArg("--url") ?? "http://127.0.0.1:5174";
const remotePort = Number(readArg("--remote-port") ?? "9225");
const cases = [
  { name: "50k-desktop", perf: "50k", width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  { name: "200k-desktop", perf: "200k", width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  { name: "50k-mobile-style", perf: "50k", width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
  { name: "200k-mobile-style", perf: "200k", width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
];

if (!chromePath) {
  throw new Error("Chrome/Edge executable was not found. Set CHROME_PATH to run the benchmark.");
}

const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "arc-hex-map-bench-"));
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${remotePort}`,
  `--user-data-dir=${userDataDir}`,
  "--headless=new",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
]);

try {
  chrome.stderr?.on("data", () => {});
  await waitForChrome(remotePort);
  const results = [];
  for (const benchCase of cases) {
    results.push(await measureCase(benchCase));
  }
  console.log(JSON.stringify({ baseUrl, chromePath, results }, null, 2));
} finally {
  chrome.kill();
  setTimeout(() => {
    void fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  }, 750);
}

async function measureCase(benchCase) {
  const target = await createTarget(remotePort);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: benchCase.width,
      height: benchCase.height,
      deviceScaleFactor: benchCase.deviceScaleFactor,
      mobile: benchCase.mobile,
    });
    const url = `${baseUrl}/?hexPerf=${benchCase.perf}&hexScale=0.55`;
    await cdp.send("Page.navigate", { url });
    await waitForStats(cdp, benchCase.name);
    const stats = await evaluateStats(cdp);
    return {
      name: benchCase.name,
      url,
      ...stats,
      viewport: { width: benchCase.width, height: benchCase.height, deviceScaleFactor: benchCase.deviceScaleFactor, mobile: benchCase.mobile },
    };
  } finally {
    cdp.close();
    await fetch(`http://127.0.0.1:${remotePort}/json/close/${target.id}`).catch(() => undefined);
  }
}

async function waitForStats(cdp, name) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const stats = await evaluateStats(cdp);
    if (stats && stats.samples >= 120 && stats.tiles > 0) return;
    await delay(500);
  }
  throw new Error(`Timed out waiting for hex map stats: ${name}`);
}

async function evaluateStats(cdp) {
  const response = await cdp.send("Runtime.evaluate", {
    expression: "window.__arcHexMapStats ? JSON.stringify(window.__arcHexMapStats) : null",
    returnByValue: true,
  });
  const value = response.result?.value;
  return value ? JSON.parse(value) : null;
}

async function waitForChrome(port) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await delay(250);
  }
  throw new Error("Timed out waiting for Chrome DevTools endpoint.");
}

async function createTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  if (!response.ok) throw new Error(`Failed to create CDP target: ${response.status}`);
  return response.json();
}

function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  socket.on("message", (data) => {
    const message = JSON.parse(String(data));
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) {
      entry.reject(new Error(message.error.message));
    } else {
      entry.resolve(message.result);
    }
  });
  return new Promise((resolve, reject) => {
    socket.once("open", () => {
      resolve({
        send(method, params = {}) {
          const commandId = ++id;
          socket.send(JSON.stringify({ id: commandId, method, params }));
          return new Promise((commandResolve, commandReject) => {
            pending.set(commandId, { resolve: commandResolve, reject: commandReject });
          });
        },
        close() {
          socket.close();
        },
      });
    });
    socket.once("error", reject);
  });
}

async function findChromePath() {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES ?? "", "Google/Chrome/Application/chrome.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Google/Chrome/Application/chrome.exe"),
          path.join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
          path.join(process.env.PROGRAMFILES ?? "", "Microsoft/Edge/Application/msedge.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Microsoft/Edge/Application/msedge.exe"),
        ]
      : ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge"];
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
