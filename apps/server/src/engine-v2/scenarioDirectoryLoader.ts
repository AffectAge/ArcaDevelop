import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import type {
  BuildingHistory,
  BuildingTypeDefinition,
  CountryHistory,
  GoodDefinition,
  MarketHistory,
  PopHistory,
  PopTypeDefinition,
  ProvinceHistory,
  RegionHistory,
  ScenarioBundle,
  ScenarioManifest,
  TechnologyDefinition,
  UnitHistory,
  UnitTypeDefinitionV2,
} from "./types";

export class ScenarioDataReadError extends Error {
  readonly filePath: string;

  constructor(filePath: string, message: string, cause?: unknown) {
    super(`${message}: ${filePath}`, { cause });
    this.name = "ScenarioDataReadError";
    this.filePath = filePath;
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  let source: string;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    throw new ScenarioDataReadError(filePath, "Unable to read scenario JSON", error);
  }

  try {
    return JSON.parse(source) as T;
  } catch (error) {
    throw new ScenarioDataReadError(filePath, "Invalid scenario JSON", error);
  }
}

async function listJsonFiles(directoryPath: string, optional: boolean): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (optional && code === "ENOENT") return [];
    throw new ScenarioDataReadError(directoryPath, "Unable to list scenario directory", error);
  }

  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(entryPath, false)));
      continue;
    }
    if (entry.isFile() && extname(entry.name).toLowerCase() === ".json") {
      files.push(entryPath);
    }
  }
  return files;
}

async function loadCollection<T>(directoryPath: string, optional = false): Promise<T[]> {
  const files = await listJsonFiles(directoryPath, optional);
  const result: T[] = [];
  for (const filePath of files) {
    const value = await readJson<T | T[]>(filePath);
    if (Array.isArray(value)) result.push(...value);
    else result.push(value);
  }
  return result;
}

async function loadLocalisation(rootPath: string): Promise<Record<string, Record<string, string>>> {
  const localisationRoot = join(rootPath, "localisation");
  const files = await listJsonFiles(localisationRoot, true);
  const result: Record<string, Record<string, string>> = {};

  for (const filePath of files) {
    const locale = basename(filePath, extname(filePath));
    const entries = await readJson<Record<string, string>>(filePath);
    result[locale] = { ...(result[locale] ?? {}), ...entries };
  }

  return result;
}

/**
 * Loads a scenario directory that follows the Engine v2 data convention.
 * The loader only performs deterministic filesystem assembly; semantic and
 * cross-reference validation belongs to compileScenario().
 */
export async function loadScenarioBundleFromDirectory(
  scenarioDirectory: string,
): Promise<ScenarioBundle> {
  const rootPath = resolve(scenarioDirectory);
  const manifest = await readJson<ScenarioManifest>(join(rootPath, "scenario.json"));

  const [
    goods,
    popTypes,
    unitTypes,
    buildingTypes,
    technologies,
    countries,
    regions,
    provinces,
    pops,
    units,
    markets,
    buildings,
    localisation,
  ] = await Promise.all([
    loadCollection<GoodDefinition>(join(rootPath, "common", "goods")),
    loadCollection<PopTypeDefinition>(join(rootPath, "common", "pop-types")),
    loadCollection<UnitTypeDefinitionV2>(join(rootPath, "common", "unit-types")),
    loadCollection<BuildingTypeDefinition>(join(rootPath, "common", "building-types")),
    loadCollection<TechnologyDefinition>(join(rootPath, "common", "technologies"), true),
    loadCollection<CountryHistory>(join(rootPath, "history", "countries")),
    loadCollection<RegionHistory>(join(rootPath, "history", "regions")),
    loadCollection<ProvinceHistory>(join(rootPath, "history", "provinces")),
    loadCollection<PopHistory>(join(rootPath, "history", "pops"), true),
    loadCollection<UnitHistory>(join(rootPath, "history", "units"), true),
    loadCollection<MarketHistory>(join(rootPath, "history", "markets")),
    loadCollection<BuildingHistory>(join(rootPath, "history", "buildings"), true),
    loadLocalisation(rootPath),
  ]);

  return {
    manifest,
    common: {
      goods,
      popTypes,
      unitTypes,
      buildingTypes,
      technologies,
    },
    history: {
      countries,
      regions,
      provinces,
      pops,
      units,
      markets,
      buildings,
    },
    localisation,
  };
}
