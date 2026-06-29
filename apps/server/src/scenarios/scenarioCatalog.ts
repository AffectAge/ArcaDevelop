import { existsSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  getScenarioRuntimePaths,
  normalizeScenarioId,
  readScenarioManifest,
  type ScenarioManifest,
} from "./runtimePaths";

export type ScenarioDescriptor = {
  id: string;
  name: string;
  description: string | null;
  startTurn: number;
  startDate: string | null;
  active: boolean;
  map: {
    root: string;
    hasVectorTiles: boolean;
    hasRasterTiles: boolean;
    hasHexes: boolean;
  };
  contentFiles: string[];
  setupFiles: string[];
};

export type FoundScenario = {
  descriptor: ScenarioDescriptor;
  scenarioDir: string;
  manifest: ScenarioManifest;
  mapRoot: string;
  hexIndexPath: string;
};

export type ScenarioCatalogParams = {
  dataRoot: string;
  scenariosRoot: string;
  activeScenarioId: string;
  activeScenarioName?: string;
};

export function listScenarios(params: ScenarioCatalogParams): ScenarioDescriptor[] {
  const scenarios: ScenarioDescriptor[] = [];
  const { scenariosRoot } = params;

  if (existsSync(scenariosRoot)) {
    for (const entry of readdirSync(scenariosRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const fallbackId = normalizeScenarioId(entry.name);
      if (!fallbackId) continue;
      const scenario = describeScenario(resolve(scenariosRoot, entry.name), fallbackId, params);
      if (scenario) scenarios.push(scenario);
    }
  }

  const seen = new Set<string>();
  return scenarios.filter((scenario) => {
    if (seen.has(scenario.id)) return false;
    seen.add(scenario.id);
    return true;
  });
}

export function findScenario(scenarioId: string, params: ScenarioCatalogParams): FoundScenario | null {
  const { dataRoot, scenariosRoot } = params;

  if (!existsSync(scenariosRoot)) return null;
  for (const entry of readdirSync(scenariosRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fallbackId = normalizeScenarioId(entry.name);
    if (!fallbackId) continue;
    const scenarioDir = resolve(scenariosRoot, entry.name);
    const manifestResult = readScenarioManifest(scenarioDir, fallbackId);
    if (!manifestResult || manifestResult.id !== scenarioId) continue;
    const descriptor = describeScenario(scenarioDir, fallbackId, params);
    if (!descriptor) return null;
    const runtimePaths = getScenarioRuntimePaths({ scenarioDir, manifest: manifestResult.manifest, dataRoot });
    return { descriptor, scenarioDir, manifest: manifestResult.manifest, ...runtimePaths };
  }

  return null;
}

function describeScenario(
  scenarioDir: string,
  fallbackId: string,
  params: ScenarioCatalogParams,
): ScenarioDescriptor | null {
  const result = readScenarioManifest(scenarioDir, fallbackId);
  if (!result) return null;
  const { id, manifest } = result;
  const { dataRoot, activeScenarioId } = params;
  const { mapRoot, hexIndexPath } = getScenarioRuntimePaths({ scenarioDir, manifest, dataRoot });
  const startTurn =
    typeof manifest.startTurn === "number" && Number.isFinite(manifest.startTurn)
      ? Math.max(1, Math.floor(manifest.startTurn))
      : 1;

  return {
    id,
    name: typeof manifest.name === "string" && manifest.name.trim() ? manifest.name.trim() : id,
    description:
      typeof manifest.description === "string" && manifest.description.trim() ? manifest.description.trim() : null,
    startTurn,
    startDate: typeof manifest.startDate === "string" && manifest.startDate.trim() ? manifest.startDate.trim() : null,
    active: id === activeScenarioId,
    map: {
      root: relative(dataRoot, mapRoot).replace(/\\/g, "/") || ".",
      hasVectorTiles: existsSync(resolve(mapRoot, "tiles/hex")),
      hasRasterTiles: existsSync(resolve(mapRoot, "tiles/raster")),
      hasHexes: existsSync(hexIndexPath),
    },
    contentFiles: listJsonFileNames(resolve(scenarioDir, "common")),
    setupFiles: listJsonFileNames(resolve(scenarioDir, "setup")),
  };
}

function listJsonFileNames(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const childPath = resolve(dir, entry.name);
      if (entry.isDirectory()) return listJsonFileNames(childPath).map((name) => `${entry.name}/${name}`);
      return entry.isFile() && entry.name.toLowerCase().endsWith(".json") ? [entry.name] : [];
    })
    .sort((a, b) => a.localeCompare(b, "ru"));
}
