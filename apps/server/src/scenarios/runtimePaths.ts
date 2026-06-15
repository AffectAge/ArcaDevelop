import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

export type ScenarioManifest = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  startTurn?: unknown;
  startDate?: unknown;
  mapRoot?: unknown;
};

export type ScenarioRuntimePaths = {
  mapRoot: string;
  provinceIndexPath: string;
};

export function normalizeScenarioId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const id = input.trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return null;
  return id;
}

export function readScenarioManifest(scenarioDir: string, fallbackId: string): { id: string; manifest: ScenarioManifest } | null {
  const manifestPath = resolve(scenarioDir, "scenario.json");
  const parsed = readJsonFileIfExists(manifestPath);
  if (!parsed || typeof parsed !== "object") return null;
  const manifest = parsed as ScenarioManifest;
  const id = normalizeScenarioId(manifest.id) ?? fallbackId;
  return { id, manifest };
}

export function getScenarioRuntimePaths(params: {
  scenarioDir: string | null;
  manifest: ScenarioManifest;
  dataRoot: string;
}): ScenarioRuntimePaths {
  const { scenarioDir, manifest, dataRoot } = params;
  if (!scenarioDir) {
    return {
      mapRoot: dataRoot,
      provinceIndexPath: resolve(dataRoot, "provinces.json"),
    };
  }
  const mapRoot = getScenarioMapRoot(scenarioDir, manifest, dataRoot);
  const generatedProvinceIndexPath = resolve(scenarioDir, ".generated/provinces.json");
  return {
    mapRoot,
    provinceIndexPath: existsSync(generatedProvinceIndexPath) ? generatedProvinceIndexPath : resolve(mapRoot, "provinces.json"),
  };
}

export function getScenarioMapRoot(scenarioDir: string, manifest: ScenarioManifest, dataRoot: string): string {
  const raw = typeof manifest.mapRoot === "string" && manifest.mapRoot.trim() ? manifest.mapRoot.trim() : "map";
  if (raw === "active") return dataRoot;
  return safeScenarioChildPath(scenarioDir, raw, dataRoot);
}

export function safeScenarioChildPath(scenarioDir: string, childPath: string, dataRoot: string): string {
  const resolved = resolve(scenarioDir, childPath);
  const rel = relative(dataRoot, resolved);
  if (rel.startsWith("..") || rel === "" || rel.includes("..\\")) {
    throw new Error("SCENARIO_PATH_OUTSIDE_DATA_ROOT");
  }
  return resolved;
}

function readJsonFileIfExists(path: string): unknown | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
