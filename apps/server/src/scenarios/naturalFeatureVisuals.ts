import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  isKnownHexMapTag,
  NATURAL_FEATURE_FRAME_MAX,
  NATURAL_FEATURE_VISUAL_LAYOUT_IDS,
} from "@arcanorum/shared";
import type {
  MapTagQuery,
  NaturalFeatureTextureSetId,
  NaturalFeatureVisualCatalog,
  NaturalFeatureVisualPlacement,
  NaturalFeatureVisualRuleDefinition,
} from "@arcanorum/shared";

const TEXTURE_SET_IDS = new Set<NaturalFeatureTextureSetId>([
  "grassland",
  "plains",
  "tropical",
  "desert",
  "tundra",
  "wetland",
  "snow",
  "glacial_mountain",
  "mountain",
  "highland",
]);
const LAYOUT_IDS = new Set<string>(NATURAL_FEATURE_VISUAL_LAYOUT_IDS);

export type NaturalFeatureVisualIssue = {
  message: string;
  path: string;
};

export function loadNaturalFeatureVisuals(
  scenarioDir: string,
): NaturalFeatureVisualRuleDefinition[] {
  const directory = resolve(scenarioDir, "common", "natural_feature_visuals");
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right, "en"))
    .flatMap((fileName) => {
      const path = join(directory, fileName);
      const result = normalizeNaturalFeatureVisual(
        JSON.parse(readFileSync(path, "utf8")) as unknown,
        path,
      );
      return result.definition ? [result.definition] : [];
    });
}

export function loadNaturalFeatureVisualCatalog(
  scenarioDir: string,
): NaturalFeatureVisualCatalog {
  const visuals = loadNaturalFeatureVisuals(scenarioDir);
  const assetPathById = loadScenarioAssetPaths(scenarioDir);
  const textureUrls: NaturalFeatureVisualCatalog["textureUrls"] = {};
  const scenarioId = basename(scenarioDir);
  for (const visual of visuals) {
    if (!visual.assetId || textureUrls[visual.textureSetId]) continue;
    const assetPath = assetPathById.get(visual.assetId);
    if (!assetPath) continue;
    textureUrls[visual.textureSetId] =
      `/scenario-assets/${encodeURIComponent(scenarioId)}/${assetPath}`;
  }
  return { visuals, textureUrls };
}

export function normalizeNaturalFeatureVisual(
  input: unknown,
  path = "natural_feature_visual",
): {
  definition: NaturalFeatureVisualRuleDefinition | null;
  issues: NaturalFeatureVisualIssue[];
} {
  const issues: NaturalFeatureVisualIssue[] = [];
  if (!isObject(input))
    return {
      definition: null,
      issues: [
        { path, message: "Natural feature visual must be a JSON object." },
      ],
    };
  const id =
    typeof input.id === "string" &&
    /^natural_feature_visual:[a-zA-Z0-9_.:-]+$/.test(input.id)
      ? (input.id as NaturalFeatureVisualRuleDefinition["id"])
      : null;
  const textureSetId =
    typeof input.textureSetId === "string" &&
    TEXTURE_SET_IDS.has(input.textureSetId as NaturalFeatureTextureSetId)
      ? (input.textureSetId as NaturalFeatureTextureSetId)
      : null;
  const tagQuery = normalizeTagQuery(input.tagQuery);
  const normalizedPlacements = normalizePlacements(input.placements, path);
  const placements = normalizedPlacements.placements;
  issues.push(...normalizedPlacements.issues);
  if (!id)
    issues.push({
      path,
      message: "id must be natural_feature_visual:<stable_id>.",
    });
  if (!textureSetId)
    issues.push({
      path,
      message:
        "textureSetId must name a supported natural feature texture set.",
    });
  if (!tagQuery)
    issues.push({ path, message: "tagQuery must contain known map tags." });
  if (placements.length === 0)
    issues.push({
      path,
      message: "placements must contain at least one unique placement recipe.",
    });
  const priority = Number.isInteger(input.priority)
    ? Number(input.priority)
    : undefined;
  if (input.priority != null && priority == null) {
    issues.push({
      path,
      message: "priority must be an integer when provided.",
    });
  }
  const assetId =
    typeof input.assetId === "string" &&
    /^asset:[a-zA-Z0-9_.:-]+$/.test(input.assetId)
      ? (input.assetId as `asset:${string}`)
      : undefined;
  return {
    definition:
      issues.length > 0 || !id || !textureSetId || !tagQuery
        ? null
        : {
            id,
            tagQuery,
            textureSetId,
            placements,
            ...(priority == null ? {} : { priority }),
            ...(assetId ? { assetId } : {}),
          },
    issues,
  };
}

function normalizePlacements(
  value: unknown,
  path: string,
): {
  placements: NaturalFeatureVisualRuleDefinition["placements"];
  issues: NaturalFeatureVisualIssue[];
} {
  if (!Array.isArray(value)) return { placements: [], issues: [] };
  const issues: NaturalFeatureVisualIssue[] = [];
  const placementIds = new Set<string>();
  const placements = value.flatMap((entry, index) => {
    if (!isObject(entry) || typeof entry.id !== "string") {
      issues.push({
        path,
        message: `placements[${index}] must have a stable id.`,
      });
      return [];
    }
    if (placementIds.has(entry.id)) {
      issues.push({
        path,
        message: `placements[${index}].id duplicates ${entry.id}.`,
      });
      return [];
    }
    placementIds.add(entry.id);
    const frameIds = Array.isArray(entry.frameIds)
      ? [
          ...new Set(
            entry.frameIds.filter(
              (frame): frame is number =>
                Number.isInteger(frame) && frame >= 0 && frame <= NATURAL_FEATURE_FRAME_MAX,
            ),
          ),
        ]
      : [];
    if (frameIds.length === 0) {
      issues.push({
        path,
        message: `placements[${index}].frameIds must contain atlas frames in range 0..${NATURAL_FEATURE_FRAME_MAX}.`,
      });
      return [];
    }
    const count = normalizeCount(entry.count);
    if (!count) {
      issues.push({
        path,
        message: `placements[${index}].count must define min/max in range 1..18.`,
      });
      return [];
    }
    const layoutId =
      typeof entry.layoutId === "string" && LAYOUT_IDS.has(entry.layoutId)
        ? (entry.layoutId as NaturalFeatureVisualPlacement["layoutId"])
        : null;
    if (!layoutId) {
      issues.push({
        path,
        message: `placements[${index}].layoutId must name a known natural composition layout.`,
      });
      return [];
    }
    const lod: NaturalFeatureVisualPlacement["lod"] | null =
      entry.lod === "simplified" || entry.lod === "detailed" ? entry.lod : null;
    const layer: NaturalFeatureVisualPlacement["layer"] | null =
      entry.layer === "landform" ||
      entry.layer === "vegetation" ||
      entry.layer === "wet" ||
      entry.layer === "snow"
        ? entry.layer
        : null;
    if (!lod || !layer) {
      issues.push({
        path,
        message: `placements[${index}] must specify a known lod and layer.`,
      });
      return [];
    }
    const tagQuery =
      entry.tagQuery == null ? undefined : normalizeTagQuery(entry.tagQuery);
    if (entry.tagQuery != null && !tagQuery) {
      issues.push({
        path,
        message: `placements[${index}].tagQuery must contain known map tags.`,
      });
      return [];
    }
    const scale = normalizeScale(entry.scale);
    if (entry.scale != null && !scale) {
      issues.push({
        path,
        message: `placements[${index}].scale must define min/max in range 0.2..2.`,
      });
      return [];
    }
    const drawOrder =
      Number.isInteger(entry.drawOrder) &&
      Number(entry.drawOrder) >= 0 &&
      Number(entry.drawOrder) <= 10
        ? Number(entry.drawOrder)
        : undefined;
    if (entry.drawOrder != null && drawOrder == null) {
      issues.push({
        path,
        message: `placements[${index}].drawOrder must be an integer in range 0..10.`,
      });
      return [];
    }
    const placement: NaturalFeatureVisualPlacement = {
      id: entry.id,
      frameIds,
      count,
      layoutId,
      lod,
      layer,
      ...(tagQuery ? { tagQuery } : {}),
      ...(drawOrder == null ? {} : { drawOrder }),
      ...(scale ? { scale } : {}),
      ...(entry.rotation === true ? { rotation: true } : {}),
    };
    return [placement];
  });
  return { placements, issues };
}

function normalizeCount(value: unknown): { min: number; max: number } | null {
  if (
    !isObject(value) ||
    !Number.isInteger(value.min) ||
    !Number.isInteger(value.max)
  )
    return null;
  const min = Number(value.min);
  const max = Number(value.max);
  return min >= 1 && max >= min && max <= 18 ? { min, max } : null;
}

function normalizeScale(value: unknown): { min: number; max: number } | null {
  if (
    !isObject(value) ||
    typeof value.min !== "number" ||
    typeof value.max !== "number"
  )
    return null;
  const min = Number(value.min);
  const max = Number(value.max);
  return Number.isFinite(min) &&
    Number.isFinite(max) &&
    min >= 0.2 &&
    max >= min &&
    max <= 2
    ? { min, max }
    : null;
}

function normalizeTagQuery(value: unknown): MapTagQuery | null {
  if (typeof value === "string") return isKnownHexMapTag(value) ? value : null;
  if (!isObject(value)) return null;
  const all = normalizeTagQueryArray(value.all);
  const any = normalizeTagQueryArray(value.any);
  const not = Array.isArray(value.not)
    ? normalizeTagQueryArray(value.not)
    : normalizeTagQuery(value.not);
  if ((!all || all.length === 0) && (!any || any.length === 0) && !not)
    return null;
  return {
    ...(all && all.length > 0 ? { all } : {}),
    ...(any && any.length > 0 ? { any } : {}),
    ...(not ? { not } : {}),
  };
}

function normalizeTagQueryArray(value: unknown): MapTagQuery[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value
    .map(normalizeTagQuery)
    .filter((item): item is MapTagQuery => item != null);
  return result.length > 0 ? result : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function loadScenarioAssetPaths(scenarioDir: string): Map<string, string> {
  const directory = resolve(scenarioDir, "common", "assets");
  const result = new Map<string, string>();
  if (!existsSync(directory)) return result;
  for (const filePath of listJsonFiles(directory)) {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (
      !isObject(parsed) ||
      typeof parsed.id !== "string" ||
      typeof parsed.path !== "string"
    )
      continue;
    if (
      !parsed.id.startsWith("asset:") ||
      !/^assets\/[a-zA-Z0-9_./-]+$/.test(parsed.path)
    )
      continue;
    result.set(parsed.id, parsed.path);
  }
  return result;
}

function listJsonFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listJsonFiles(path);
    return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
  });
}
