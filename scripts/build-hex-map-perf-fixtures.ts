import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { generateHexMap, type MapFeatureInstance } from "@arcanorum/shared";
import { ensureHexMapClientArtifacts } from "../apps/server/src/scenarios/hexMapClientArtifacts";
import {
  HEX_MAP_PERF_FIXTURE_BUILDER_VERSION,
  HEX_MAP_PERF_FIXTURE_REGISTRY_FILE,
  HEX_MAP_PERF_FIXTURE_REGISTRY_VERSION,
  calculateHexMapPerfFixtureSettingsHash,
  getHexMapPerfFixtureDefinition,
  isHexMapPerfFixtureCacheValid,
  readHexMapPerfFixtureRegistry,
  resolveHexMapPerfFixtureCacheRoot,
  selectHexMapPerfFixtureIds,
  type HexMapPerfFixtureRegistry,
  type HexMapPerfFixtureRegistryEntry,
} from "./hex-map-perf-fixtures";

const repositoryRoot = resolve(dirname(process.argv[1]), "..");
const cacheRoot = resolveHexMapPerfFixtureCacheRoot(repositoryRoot);
const requestedFixtureIds = selectHexMapPerfFixtureIds(readFixtureArgs());
const EMPTY_FEATURES: MapFeatureInstance[] = [];

void buildFixtures().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});

async function buildFixtures(): Promise<void> {
  mkdirSync(cacheRoot, { recursive: true });
  const registry = await readExistingRegistry();
  const startedAt = performance.now();

  for (const fixtureId of requestedFixtureIds) {
    const definition = getHexMapPerfFixtureDefinition(fixtureId);
    const cachedEntry = registry.fixtures[fixtureId];
    if (
      await isHexMapPerfFixtureCacheValid(cacheRoot, cachedEntry, definition)
    ) {
      process.stdout.write(
        `[map-perf:fixtures] ${fixtureId}: reused ${definition.expectedTileCount.toLocaleString("en-US")} tiles\n`,
      );
      continue;
    }

    const fixtureStartedAt = performance.now();
    process.stdout.write(
      `[map-perf:fixtures] ${fixtureId}: generating ${definition.settings.width}x${definition.settings.height}\n`,
    );
    const mapArtifact = generateHexMap(definition.settings);
    if (mapArtifact.tiles.length !== definition.expectedTileCount) {
      throw new Error(`HEX_MAP_PERF_FIXTURE_TILE_COUNT_MISMATCH:${fixtureId}`);
    }
    const scenarioDir = resolve(cacheRoot, `fixture-${fixtureId}`);
    const generated = ensureHexMapClientArtifacts({
      scenarioDir,
      mapArtifact,
      features: EMPTY_FEATURES,
    });
    const artifactRoot = toPortableRelativePath(cacheRoot, generated.rootPath);
    const brotliBytes =
      generated.manifest.chunks.reduce(
        (sum, descriptor) => sum + descriptor.brotliByteLength,
        0,
      ) + generated.manifest.navigation.brotliByteLength;
    const entry: HexMapPerfFixtureRegistryEntry = {
      id: fixtureId,
      expectedTileCount: definition.expectedTileCount,
      settingsHash: calculateHexMapPerfFixtureSettingsHash(definition),
      artifactVersion: generated.artifactVersion,
      artifactRoot,
      chunkCount: generated.manifest.chunks.length,
      brotliByteLength: brotliBytes,
    };
    registry.fixtures[fixtureId] = entry;
    writeRegistry(registry);
    process.stdout.write(
      `[map-perf:fixtures] ${fixtureId}: built ${generated.manifest.chunks.length} chunks, ${(brotliBytes / 1024 / 1024).toFixed(2)} MiB Brotli, ${formatDuration(performance.now() - fixtureStartedAt)}\n`,
    );
  }

  writeRegistry(registry);
  process.stdout.write(
    `[map-perf:fixtures] ready in ${formatDuration(performance.now() - startedAt)}\n`,
  );
}

async function readExistingRegistry(): Promise<HexMapPerfFixtureRegistry> {
  try {
    return await readHexMapPerfFixtureRegistry(cacheRoot);
  } catch {
    return {
      registryVersion: HEX_MAP_PERF_FIXTURE_REGISTRY_VERSION,
      builderVersion: HEX_MAP_PERF_FIXTURE_BUILDER_VERSION,
      fixtures: {},
    };
  }
}

function writeRegistry(registry: HexMapPerfFixtureRegistry): void {
  const registryPath = resolve(cacheRoot, HEX_MAP_PERF_FIXTURE_REGISTRY_FILE);
  const temporaryPath = `${registryPath}.${process.pid}.tmp`;
  writeFileSync(
    temporaryPath,
    `${JSON.stringify(registry, null, 2)}\n`,
    "utf8",
  );
  renameSync(temporaryPath, registryPath);
}

function toPortableRelativePath(rootPath: string, targetPath: string): string {
  const value = relative(rootPath, targetPath);
  if (!value || value.startsWith(".."))
    throw new Error("HEX_MAP_PERF_FIXTURE_PATH_REJECTED");
  return sep === "/" ? value : value.split(sep).join("/");
}

function readRepeatedArgs(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1])
      values.push(process.argv[index + 1]);
  }
  return values;
}

function readFixtureArgs(): string[] {
  const repeated = readRepeatedArgs("--case");
  const positional = process.argv
    .slice(2)
    .filter(
      (value, index, values) =>
        value !== "--case" && values[index - 1] !== "--case",
    );
  return [...repeated, ...positional];
}

function formatDuration(durationMs: number): string {
  return durationMs >= 1_000
    ? `${(durationMs / 1_000).toFixed(1)}s`
    : `${Math.round(durationMs)}ms`;
}
