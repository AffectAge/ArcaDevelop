import type express from "express";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type {
  HexMapClientArtifactDescriptor,
  MapFeatureVisualRuleDefinition,
  NaturalFeatureVisualCatalog,
} from "@arcanorum/shared";
import type { HexMapIndexEntry } from "../map/hexIndex";
import type { HexMapClientArtifactRuntime } from "../scenarios/hexMapClientArtifacts";
import type { RouteAuth } from "../security/routeAuth";

export type HexReadWorldState = {
  hexOwner: Record<string, string>;
};

export type HexReadRoutesDependencies = {
  routeAuth: RouteAuth;
  getHexIndex: () => HexMapIndexEntry[];
  getHexMapClientArtifact: () => HexMapClientArtifactRuntime | null;
  getMapFeatureVisuals: () => MapFeatureVisualRuleDefinition[];
  getNaturalFeatureVisualCatalog?: () => NaturalFeatureVisualCatalog;
  getWorldBase: () => HexReadWorldState;
};

export function registerHexReadRoutes(
  app: express.Express,
  deps: HexReadRoutesDependencies,
): void {
  app.get("/admin/hexes", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;

    const hexIndex = deps.getHexIndex();
    const worldBase = deps.getWorldBase();
    const searchQuery =
      typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const requestedLimit =
      typeof req.query.limit === "string" &&
      Number.isFinite(Number(req.query.limit))
        ? Math.floor(Number(req.query.limit))
        : null;
    const requestedOffset =
      typeof req.query.offset === "string" &&
      Number.isFinite(Number(req.query.offset))
        ? Math.floor(Number(req.query.offset))
        : 0;
    const limit =
      requestedLimit == null
        ? null
        : Math.max(1, Math.min(5000, requestedLimit));
    const offset = Math.max(0, requestedOffset);
    const source = searchQuery
      ? hexIndex.filter(
          (province) =>
            province.name.toLowerCase().includes(searchQuery) ||
            province.id.toLowerCase().includes(searchQuery),
        )
      : hexIndex;
    const total = source.length;
    const selected =
      limit == null ? source : source.slice(offset, offset + limit);

    const hexes = selected.map((province) => {
      const provinceId = province.id;
      return {
        id: provinceId,
        name: province.name,
        regionId: province.regionId,
        hexColor: province.hexColor,
        regionColor: province.regionColor,
        areaKm2: province.areaKm2,
        hexType: province.hexType,
        climate: province.climate,
        landscape: province.landscape,
        ownerCountryId: worldBase.hexOwner[provinceId] ?? null,
      };
    });

    return res.json({
      hexes,
      total,
      offset,
      limit,
    });
  });

  app.get("/hex-map/manifest", (req, res) => {
    const artifact = deps.getHexMapClientArtifact();
    if (!artifact) return sendMapError(res, 503, "MAP_ARTIFACT_UNAVAILABLE");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("ETag", artifact.manifestEtag);
    if (
      requestEtagMatches(req.headers["if-none-match"], artifact.manifestEtag)
    ) {
      return res.status(304).end();
    }
    res.type("application/json");
    return res.send(artifact.manifestJson);
  });

  app.get("/hex-map/navigation", async (req, res) => {
    const artifact = deps.getHexMapClientArtifact();
    if (!artifact) return sendMapError(res, 503, "MAP_ARTIFACT_UNAVAILABLE");
    if (
      !requestVersionMatches(
        req.query.version,
        artifact.manifest.artifactVersion,
      )
    ) {
      return sendMapError(res, 409, "MAP_VERSION_MISMATCH");
    }
    return sendVersionedMapArtifact(
      req,
      res,
      artifact,
      artifact.manifest.navigation,
    );
  });

  app.get("/hex-map/chunks/:chunkId", async (req, res) => {
    const artifact = deps.getHexMapClientArtifact();
    if (!artifact) return sendMapError(res, 503, "MAP_ARTIFACT_UNAVAILABLE");
    if (
      !requestVersionMatches(
        req.query.version,
        artifact.manifest.artifactVersion,
      )
    ) {
      return sendMapError(res, 409, "MAP_VERSION_MISMATCH");
    }
    const descriptor = artifact.chunkDescriptorById.get(req.params.chunkId);
    if (!descriptor) return sendMapError(res, 404, "MAP_CHUNK_NOT_FOUND");
    return sendVersionedMapArtifact(req, res, artifact, descriptor);
  });

  app.get("/hex-map/feature-visuals", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ visuals: deps.getMapFeatureVisuals() });
  });

  app.get("/hex-map/natural-feature-visuals", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json(deps.getNaturalFeatureVisualCatalog?.() ?? { visuals: [], textureUrls: {} });
  });
}

type MapArtifactErrorCode =
  | "MAP_ARTIFACT_UNAVAILABLE"
  | "MAP_VERSION_MISMATCH"
  | "MAP_CHUNK_NOT_FOUND";

function sendMapError(
  res: express.Response,
  status: 404 | 409 | 503,
  code: MapArtifactErrorCode,
): express.Response {
  return res.status(status).json({ code });
}

async function sendVersionedMapArtifact(
  req: express.Request,
  res: express.Response,
  artifact: HexMapClientArtifactRuntime,
  descriptor: HexMapClientArtifactDescriptor,
): Promise<express.Response> {
  const encoding = selectContentEncoding(req.headers["accept-encoding"]);
  const suffix = encoding === "br" ? ".br" : encoding === "gzip" ? ".gz" : "";
  const filePath = resolve(
    artifact.rootPath,
    `${descriptor.fileName}${suffix}`,
  );
  const relativePath = relative(artifact.rootPath, filePath);
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    return sendMapError(res, 503, "MAP_ARTIFACT_UNAVAILABLE");
  }
  try {
    const body = await readFile(filePath);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Vary", "Accept-Encoding");
    res.type("application/json");
    if (encoding !== "identity") res.setHeader("Content-Encoding", encoding);
    return res.send(body);
  } catch {
    return sendMapError(res, 503, "MAP_ARTIFACT_UNAVAILABLE");
  }
}

function requestVersionMatches(
  value: unknown,
  artifactVersion: string,
): boolean {
  return typeof value === "string" && value === artifactVersion;
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
    qualityByEncoding.set(
      nameRaw,
      Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0,
    );
  }
  const wildcardQuality = qualityByEncoding.get("*") ?? 0;
  const candidates = [
    {
      encoding: "br" as const,
      quality: qualityByEncoding.get("br") ?? wildcardQuality,
    },
    {
      encoding: "gzip" as const,
      quality: qualityByEncoding.get("gzip") ?? wildcardQuality,
    },
  ].sort((left, right) => right.quality - left.quality);
  const selected = candidates[0];
  if (selected && selected.quality > 0) return selected.encoding;
  return "identity";
}
