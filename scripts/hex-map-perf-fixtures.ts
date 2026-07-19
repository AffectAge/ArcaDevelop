import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingHttpHeaders,
  type ServerResponse,
} from "node:http";
import { isAbsolute, relative, resolve } from "node:path";
import {
  DEFAULT_HEX_MAP_SETTINGS,
  type HexMapClientArtifactDescriptor,
  type HexMapClientChunkDescriptor,
  type HexMapClientManifest,
  type HexMapSettings,
} from "@arcanorum/shared";

export const HEX_MAP_PERF_FIXTURE_IDS = ["default", "200k"] as const;
export type HexMapPerfFixtureId = (typeof HEX_MAP_PERF_FIXTURE_IDS)[number];

export const HEX_MAP_PERF_FIXTURE_REGISTRY_VERSION = 1;
export const HEX_MAP_PERF_FIXTURE_BUILDER_VERSION = 2;
export const HEX_MAP_PERF_FIXTURE_CACHE_RELATIVE_PATH =
  ".generated/map-perf-fixtures";
export const HEX_MAP_PERF_FIXTURE_REGISTRY_FILE = "fixtures.json";

export type HexMapPerfFixtureDefinition = {
  id: HexMapPerfFixtureId;
  expectedTileCount: number;
  settings: HexMapSettings;
};

export type HexMapPerfFixtureRegistryEntry = {
  id: HexMapPerfFixtureId;
  expectedTileCount: number;
  settingsHash: string;
  artifactVersion: string;
  artifactRoot: string;
  chunkCount: number;
  brotliByteLength: number;
};

export type HexMapPerfFixtureRegistry = {
  registryVersion: typeof HEX_MAP_PERF_FIXTURE_REGISTRY_VERSION;
  builderVersion: typeof HEX_MAP_PERF_FIXTURE_BUILDER_VERSION;
  fixtures: Partial<
    Record<HexMapPerfFixtureId, HexMapPerfFixtureRegistryEntry>
  >;
};

export type HexMapPerfFixtureRequest =
  | { fixtureId: HexMapPerfFixtureId; kind: "manifest" }
  | { fixtureId: HexMapPerfFixtureId; kind: "navigation" }
  | { fixtureId: HexMapPerfFixtureId; kind: "chunk"; chunkId: string };

export type HexMapPerfFixtureServer = {
  origin: string;
  apiBaseForFixture: (fixtureId: HexMapPerfFixtureId) => string;
  close: () => Promise<void>;
};

type LoadedFixture = {
  rootPath: string;
  manifest: HexMapClientManifest;
  manifestJson: Buffer;
  manifestEtag: string;
  chunkDescriptorById: ReadonlyMap<string, HexMapClientChunkDescriptor>;
  brotliBodyByFileName: ReadonlyMap<string, Buffer>;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CHUNK_ID_PATTERN = /^hex-chunk:\d+:\d+$/;
const ARTIFACT_FILE_PATTERN = /^(?:navigation|chunk-\d+-\d+)\.json$/;
const MAX_CONCURRENT_FIXTURE_REQUESTS = 12;

const fixtureDefinitions: Record<
  HexMapPerfFixtureId,
  HexMapPerfFixtureDefinition
> = {
  default: {
    id: "default",
    expectedTileCount: 360 * 160,
    settings: createFixtureSettings(DEFAULT_HEX_MAP_SETTINGS.seed, 360, 160),
  },
  "200k": {
    id: "200k",
    expectedTileCount: 500 * 400,
    settings: createFixtureSettings("arcanorum-map-perf-200k-v1", 500, 400),
  },
};

export function getHexMapPerfFixtureDefinition(
  fixtureId: HexMapPerfFixtureId,
): HexMapPerfFixtureDefinition {
  return fixtureDefinitions[fixtureId];
}

export function selectHexMapPerfFixtureIds(
  values: readonly string[],
): HexMapPerfFixtureId[] {
  if (values.length === 0 || values.includes("all"))
    return [...HEX_MAP_PERF_FIXTURE_IDS];
  const selected = new Set<HexMapPerfFixtureId>();
  for (const value of values) {
    if (!isHexMapPerfFixtureId(value))
      throw new Error(`Unknown hex map performance fixture: ${value}`);
    selected.add(value);
  }
  return HEX_MAP_PERF_FIXTURE_IDS.filter((fixtureId) =>
    selected.has(fixtureId),
  );
}

export function calculateHexMapPerfFixtureSettingsHash(
  definition: HexMapPerfFixtureDefinition,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        builderVersion: HEX_MAP_PERF_FIXTURE_BUILDER_VERSION,
        settings: definition.settings,
      }),
    )
    .digest("hex");
}

export function resolveHexMapPerfFixtureCacheRoot(
  repositoryRoot: string,
): string {
  return resolve(repositoryRoot, HEX_MAP_PERF_FIXTURE_CACHE_RELATIVE_PATH);
}

export function resolveReadOnlyFixtureArtifactPath(
  rootPath: string,
  fileName: string,
  suffix = "",
): string {
  if (
    !ARTIFACT_FILE_PATTERN.test(fileName) ||
    (suffix !== "" && suffix !== ".br" && suffix !== ".gz")
  ) {
    throw new Error("HEX_MAP_PERF_FIXTURE_PATH_REJECTED");
  }
  const targetPath = resolve(rootPath, `${fileName}${suffix}`);
  const relativePath = relative(rootPath, targetPath);
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw new Error("HEX_MAP_PERF_FIXTURE_PATH_REJECTED");
  }
  return targetPath;
}

export function matchHexMapPerfFixtureRequest(
  rawTarget: string,
): HexMapPerfFixtureRequest | null {
  const rawPath = rawTarget.split("?", 1)[0] ?? "";
  if (rawPath.length === 0 || rawPath.length > 512 || /[\\\0]/.test(rawPath))
    return null;
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (/[\\\0]/.test(decodedPath)) return null;
  const segments = decodedPath.split("/");
  if (segments.some((segment) => segment === ".." || segment === "."))
    return null;
  if (
    segments[0] !== "" ||
    segments[1] !== "fixtures" ||
    !isHexMapPerfFixtureId(segments[2])
  )
    return null;
  if (segments[3] !== "hex-map") return null;
  if (segments.length === 5 && segments[4] === "manifest") {
    return { fixtureId: segments[2], kind: "manifest" };
  }
  if (segments.length === 5 && segments[4] === "navigation") {
    return { fixtureId: segments[2], kind: "navigation" };
  }
  if (
    segments.length === 6 &&
    segments[4] === "chunks" &&
    CHUNK_ID_PATTERN.test(segments[5] ?? "")
  ) {
    return { fixtureId: segments[2], kind: "chunk", chunkId: segments[5] };
  }
  return null;
}

export async function readHexMapPerfFixtureRegistry(
  cacheRoot: string,
): Promise<HexMapPerfFixtureRegistry> {
  const registryPath = resolve(cacheRoot, HEX_MAP_PERF_FIXTURE_REGISTRY_FILE);
  const raw = await readFile(registryPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed))
    throw new Error("HEX_MAP_PERF_FIXTURE_REGISTRY_INVALID");
  if (
    parsed.registryVersion !== HEX_MAP_PERF_FIXTURE_REGISTRY_VERSION ||
    parsed.builderVersion !== HEX_MAP_PERF_FIXTURE_BUILDER_VERSION ||
    !isObject(parsed.fixtures)
  ) {
    throw new Error("HEX_MAP_PERF_FIXTURE_REGISTRY_INVALID");
  }
  const fixtures: HexMapPerfFixtureRegistry["fixtures"] = {};
  for (const fixtureId of HEX_MAP_PERF_FIXTURE_IDS) {
    const value = parsed.fixtures[fixtureId];
    if (value == null) continue;
    if (!isFixtureRegistryEntry(value, fixtureId))
      throw new Error("HEX_MAP_PERF_FIXTURE_REGISTRY_INVALID");
    fixtures[fixtureId] = value;
  }
  return {
    registryVersion: HEX_MAP_PERF_FIXTURE_REGISTRY_VERSION,
    builderVersion: HEX_MAP_PERF_FIXTURE_BUILDER_VERSION,
    fixtures,
  };
}

export async function isHexMapPerfFixtureCacheValid(
  cacheRoot: string,
  entry: HexMapPerfFixtureRegistryEntry | undefined,
  definition: HexMapPerfFixtureDefinition,
): Promise<boolean> {
  if (!entry) return false;
  if (
    entry.id !== definition.id ||
    entry.expectedTileCount !== definition.expectedTileCount ||
    entry.settingsHash !== calculateHexMapPerfFixtureSettingsHash(definition)
  ) {
    return false;
  }
  try {
    const loaded = await loadFixture(cacheRoot, entry);
    const brotliByteLength =
      loaded.manifest.navigation.brotliByteLength +
      loaded.manifest.chunks.reduce(
        (sum, descriptor) => sum + descriptor.brotliByteLength,
        0,
      );
    return (
      loaded.manifest.artifactVersion === entry.artifactVersion &&
      loaded.manifest.settings.width * loaded.manifest.settings.height ===
        definition.expectedTileCount &&
      loaded.manifest.chunks.length === entry.chunkCount &&
      brotliByteLength === entry.brotliByteLength
    );
  } catch {
    return false;
  }
}

export async function startHexMapPerfFixtureServer(params: {
  cacheRoot: string;
  fixtureIds: readonly HexMapPerfFixtureId[];
  port?: number;
}): Promise<HexMapPerfFixtureServer> {
  const registry = await readHexMapPerfFixtureRegistry(params.cacheRoot);
  const loadedFixtures = new Map<HexMapPerfFixtureId, LoadedFixture>();
  for (const fixtureId of params.fixtureIds) {
    const entry = registry.fixtures[fixtureId];
    if (!entry) throw new Error(`HEX_MAP_PERF_FIXTURE_MISSING:${fixtureId}`);
    loadedFixtures.set(fixtureId, await loadFixture(params.cacheRoot, entry));
  }

  let activeRequests = 0;
  const server = createServer(async (request, response) => {
    applyCorsHeaders(response);
    const route = matchHexMapPerfFixtureRequest(request.url ?? "");
    const fixture = route ? loadedFixtures.get(route.fixtureId) : null;
    if (!route || !fixture) {
      sendJsonError(response, 404, "MAP_CHUNK_NOT_FOUND");
      return;
    }
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      response.statusCode = 204;
      response.end();
      return;
    }
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET, OPTIONS");
      sendJsonError(response, 405, "MAP_ARTIFACT_UNAVAILABLE");
      return;
    }
    if (activeRequests >= MAX_CONCURRENT_FIXTURE_REQUESTS) {
      sendJsonError(response, 503, "MAP_ARTIFACT_UNAVAILABLE");
      return;
    }
    activeRequests += 1;
    try {
      if (route.kind === "manifest") {
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("ETag", fixture.manifestEtag);
        if (
          requestEtagMatches(
            request.headers["if-none-match"],
            fixture.manifestEtag,
          )
        ) {
          response.statusCode = 304;
          response.end();
          return;
        }
        sendJsonBuffer(response, 200, fixture.manifestJson);
        return;
      }

      const requestUrl = new URL(request.url ?? "", "http://127.0.0.1");
      const versions = requestUrl.searchParams.getAll("version");
      if (
        versions.length !== 1 ||
        versions[0] !== fixture.manifest.artifactVersion
      ) {
        sendJsonError(response, 409, "MAP_VERSION_MISMATCH");
        return;
      }
      const descriptor =
        route.kind === "navigation"
          ? fixture.manifest.navigation
          : fixture.chunkDescriptorById.get(route.chunkId);
      if (!descriptor) {
        sendJsonError(response, 404, "MAP_CHUNK_NOT_FOUND");
        return;
      }
      await sendVersionedFixtureArtifact(
        response,
        request.headers,
        fixture.rootPath,
        descriptor,
        fixture.brotliBodyByFileName,
      );
    } catch {
      if (!response.headersSent)
        sendJsonError(response, 503, "MAP_ARTIFACT_UNAVAILABLE");
      else response.destroy();
    } finally {
      activeRequests -= 1;
    }
  });
  server.maxConnections = 24;
  server.maxHeadersCount = 32;
  server.headersTimeout = 5_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(params.port ?? 0, "127.0.0.1", () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((resolvePromise) =>
      server.close(() => resolvePromise()),
    );
    throw new Error("HEX_MAP_PERF_FIXTURE_SERVER_ADDRESS_UNAVAILABLE");
  }
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    apiBaseForFixture: (fixtureId) => `${origin}/fixtures/${fixtureId}`,
    close: () =>
      new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) =>
          error ? rejectPromise(error) : resolvePromise(),
        );
        server.closeIdleConnections();
      }),
  };
}

function createFixtureSettings(
  seed: string,
  width: number,
  height: number,
): HexMapSettings {
  const defaults = DEFAULT_HEX_MAP_SETTINGS;
  return {
    ...defaults,
    seed,
    width,
    height,
    hexSize: 18,
    chunkSize: 20,
    wrapX: false,
    generation: {
      ...defaults.generation,
      landmasses: { ...defaults.generation.landmasses },
      climate: { ...defaults.generation.climate },
      rivers: { ...defaults.generation.rivers },
      regions: { ...defaults.generation.regions },
      tags: { ...defaults.generation.tags },
    },
  };
}

async function loadFixture(
  cacheRoot: string,
  entry: HexMapPerfFixtureRegistryEntry,
): Promise<LoadedFixture> {
  const rootPath = resolveContainedPath(cacheRoot, entry.artifactRoot);
  const manifestPath = resolve(rootPath, "manifest.json");
  const manifestJson = await readFile(manifestPath);
  const parsed: unknown = JSON.parse(manifestJson.toString("utf8"));
  if (
    !isHexMapClientManifest(parsed) ||
    parsed.artifactVersion !== entry.artifactVersion
  ) {
    throw new Error("HEX_MAP_PERF_FIXTURE_MANIFEST_INVALID");
  }
  const descriptors: HexMapClientArtifactDescriptor[] = [
    parsed.navigation,
    ...parsed.chunks,
  ];
  for (const descriptor of descriptors) {
    for (const suffix of ["", ".gz", ".br"] as const) {
      const artifactPath = resolveReadOnlyFixtureArtifactPath(
        rootPath,
        descriptor.fileName,
        suffix,
      );
      if (!existsSync(artifactPath))
        throw new Error("HEX_MAP_PERF_FIXTURE_FILE_MISSING");
    }
  }
  const brotliBodyByFileName = new Map<string, Buffer>();
  const preloadBatchSize = 32;
  for (let index = 0; index < descriptors.length; index += preloadBatchSize) {
    const batch = descriptors.slice(index, index + preloadBatchSize);
    const bodies = await Promise.all(
      batch.map(async (descriptor) => ({
        fileName: descriptor.fileName,
        body: await readFile(
          resolveReadOnlyFixtureArtifactPath(
            rootPath,
            descriptor.fileName,
            ".br",
          ),
        ),
      })),
    );
    for (const entry of bodies)
      brotliBodyByFileName.set(entry.fileName, entry.body);
  }
  return {
    rootPath,
    manifest: parsed,
    manifestJson,
    manifestEtag: `"${createHash("sha256").update(manifestJson).digest("hex")}"`,
    chunkDescriptorById: new Map(
      parsed.chunks.map((descriptor) => [descriptor.id, descriptor] as const),
    ),
    brotliBodyByFileName,
  };
}

function resolveContainedPath(
  rootPath: string,
  relativeArtifactRoot: string,
): string {
  if (!relativeArtifactRoot || isAbsolute(relativeArtifactRoot))
    throw new Error("HEX_MAP_PERF_FIXTURE_PATH_REJECTED");
  const targetPath = resolve(rootPath, relativeArtifactRoot);
  const relativePath = relative(rootPath, targetPath);
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw new Error("HEX_MAP_PERF_FIXTURE_PATH_REJECTED");
  }
  return targetPath;
}

async function sendVersionedFixtureArtifact(
  response: ServerResponse,
  headers: IncomingHttpHeaders,
  rootPath: string,
  descriptor: HexMapClientArtifactDescriptor,
  brotliBodyByFileName: ReadonlyMap<string, Buffer>,
): Promise<void> {
  const encoding = selectContentEncoding(headers["accept-encoding"]);
  const suffix = encoding === "br" ? ".br" : encoding === "gzip" ? ".gz" : "";
  const body =
    (encoding === "br"
      ? brotliBodyByFileName.get(descriptor.fileName)
      : undefined) ??
    (await readFile(
      resolveReadOnlyFixtureArtifactPath(rootPath, descriptor.fileName, suffix),
    ));
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  response.setHeader("Vary", "Accept-Encoding");
  if (encoding !== "identity") response.setHeader("Content-Encoding", encoding);
  sendJsonBuffer(response, 200, body);
}

function selectContentEncoding(
  value: string | string[] | undefined,
): "br" | "gzip" | "identity" {
  const header = Array.isArray(value) ? value.join(",") : (value ?? "");
  const qualityByEncoding = new Map<string, number>();
  for (const item of header.split(",")) {
    const [nameRaw, ...parameters] = item.trim().toLowerCase().split(";");
    if (!nameRaw) continue;
    const qualityParameter = parameters.find((parameter) =>
      parameter.trim().startsWith("q="),
    );
    const quality = qualityParameter
      ? Number(qualityParameter.trim().slice(2))
      : 1;
    qualityByEncoding.set(nameRaw, Number.isFinite(quality) ? quality : 0);
  }
  if ((qualityByEncoding.get("br") ?? qualityByEncoding.get("*") ?? 0) > 0)
    return "br";
  if ((qualityByEncoding.get("gzip") ?? qualityByEncoding.get("*") ?? 0) > 0)
    return "gzip";
  return "identity";
}

function requestEtagMatches(
  value: string | string[] | undefined,
  etag: string,
): boolean {
  const header = Array.isArray(value) ? value.join(",") : (value ?? "");
  return header
    .split(",")
    .map((candidate) => candidate.trim())
    .some(
      (candidate) =>
        candidate === etag || candidate === `W/${etag}` || candidate === "*",
    );
}

function applyCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Expose-Headers",
    "Cache-Control, Content-Encoding, ETag, Vary",
  );
  response.setHeader("Timing-Allow-Origin", "*");
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function sendJsonBuffer(
  response: ServerResponse,
  status: number,
  body: Buffer,
): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", body.byteLength);
  response.end(body);
}

function sendJsonError(
  response: ServerResponse,
  status: number,
  code: string,
): void {
  sendJsonBuffer(
    response,
    status,
    Buffer.from(`${JSON.stringify({ code })}\n`, "utf8"),
  );
}

function isHexMapPerfFixtureId(value: unknown): value is HexMapPerfFixtureId {
  return value === "default" || value === "200k";
}

function isFixtureRegistryEntry(
  value: unknown,
  fixtureId: HexMapPerfFixtureId,
): value is HexMapPerfFixtureRegistryEntry {
  return (
    isObject(value) &&
    value.id === fixtureId &&
    typeof value.expectedTileCount === "number" &&
    Number.isInteger(value.expectedTileCount) &&
    value.expectedTileCount > 0 &&
    typeof value.settingsHash === "string" &&
    SHA256_PATTERN.test(value.settingsHash) &&
    typeof value.artifactVersion === "string" &&
    SHA256_PATTERN.test(value.artifactVersion) &&
    typeof value.artifactRoot === "string" &&
    value.artifactRoot.length > 0 &&
    typeof value.chunkCount === "number" &&
    Number.isInteger(value.chunkCount) &&
    value.chunkCount > 0 &&
    typeof value.brotliByteLength === "number" &&
    Number.isInteger(value.brotliByteLength) &&
    value.brotliByteLength > 0
  );
}

function isHexMapClientManifest(value: unknown): value is HexMapClientManifest {
  if (
    !isObject(value) ||
    value.formatVersion !== 1 ||
    typeof value.artifactVersion !== "string" ||
    !SHA256_PATTERN.test(value.artifactVersion)
  ) {
    return false;
  }
  if (
    !isObject(value.settings) ||
    !isObject(value.navigation) ||
    !Array.isArray(value.chunks) ||
    !Array.isArray(value.regions)
  )
    return false;
  if (
    !isArtifactDescriptor(value.navigation) ||
    value.navigation.fileName !== "navigation.json"
  )
    return false;
  return value.chunks.every(
    (descriptor) =>
      isObject(descriptor) &&
      isArtifactDescriptor(descriptor) &&
      typeof descriptor.id === "string" &&
      CHUNK_ID_PATTERN.test(descriptor.id) &&
      typeof descriptor.chunkQ === "number" &&
      typeof descriptor.chunkR === "number",
  );
}

function isArtifactDescriptor(value: Record<string, unknown>): boolean {
  return (
    typeof value.fileName === "string" &&
    ARTIFACT_FILE_PATTERN.test(value.fileName) &&
    typeof value.contentHash === "string" &&
    SHA256_PATTERN.test(value.contentHash) &&
    typeof value.byteLength === "number" &&
    Number.isInteger(value.byteLength) &&
    value.byteLength >= 0
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
