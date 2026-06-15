import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { imageSize } from "image-size";
import {
  getActiveUploadDataRoot,
  getActiveUploadScenarioId,
  getActiveScenarioUploadsRoot,
  resolveScenarioUploadPublicPrefix,
  resolveScenarioUploadsRoot,
} from "./uploadPaths";

export type ImageDimensionRule = {
  maxWidth: number;
  maxHeight: number;
  ratioWidth: number;
  ratioHeight: number;
};

export function validateImageDimensions(file: Express.Multer.File, maxSize = 256): boolean {
  const dimensions = imageSize(readFileSync(file.path));
  const width = dimensions.width ?? 0;
  const height = dimensions.height ?? 0;
  return width > 0 && height > 0 && width <= maxSize && height <= maxSize;
}

export function validateImageRule(file: Express.Multer.File, rule: ImageDimensionRule): boolean {
  const dimensions = imageSize(readFileSync(file.path));
  const width = Number(dimensions.width ?? 0);
  const height = Number(dimensions.height ?? 0);
  if (width <= 0 || height <= 0) return false;
  if (width > rule.maxWidth || height > rule.maxHeight) return false;
  const expected = rule.ratioWidth / rule.ratioHeight;
  const actual = width / height;
  return Math.abs(actual - expected) <= 0.01;
}

export function removeUploadedFile(file?: Express.Multer.File): void {
  if (!file) {
    return;
  }

  try {
    unlinkSync(file.path);
  } catch {
    // Ignore cleanup errors.
  }
}

export function removeUploadedFiles(files: Array<Express.Multer.File | undefined>): void {
  for (const file of files) {
    removeUploadedFile(file);
  }
}

export function extractUploadRelativePathFromUrl(url?: string | null): string | null {
  const parsed = extractScenarioUploadReferenceFromUrl(url);
  return parsed?.relativePath ?? null;
}

export function extractScenarioUploadReferenceFromUrl(url?: string | null): { scenarioId: string; relativePath: string } | null {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;
  const withoutHash = raw.split("#")[0] ?? "";
  const withoutQuery = withoutHash.split("?")[0] ?? "";
  if (withoutQuery.startsWith("/scenario-assets/")) {
    return extractScenarioUploadReferenceFromPath(withoutQuery);
  }
  try {
    const parsed = new URL(withoutQuery);
    return extractScenarioUploadReferenceFromPath(parsed.pathname);
  } catch {
    return null;
  }
}

export function normalizeUploadRelativePath(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("\0")) return null;
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  if (isAbsolute(normalized)) return null;
  return normalized;
}

export function resolveUploadPathInsideRoot(root: string, relativePath: string): string | null {
  const normalized = normalizeUploadRelativePath(relativePath);
  if (!normalized) return null;
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(absoluteRoot, normalized);
  const pathFromRoot = relative(absoluteRoot, absolutePath);
  if (pathFromRoot === "" || pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) return null;
  return absolutePath;
}

export function makeVersionedUploadUrl(relativePath: string): string {
  const clean = normalizeUploadRelativePath(relativePath);
  if (!clean) {
    throw new Error("INVALID_UPLOAD_PATH");
  }
  return `${resolveScenarioUploadPublicPrefix()}/${clean}?v=${Date.now()}`;
}

export function collectUploadPathsFromUnknown(input: unknown, sink: Set<string>): void {
  if (input == null) return;
  if (typeof input === "string") {
    const rel = extractUploadRelativePathFromUrl(input);
    if (rel) sink.add(rel);
    return;
  }
  if (Array.isArray(input)) {
    for (const item of input) {
      collectUploadPathsFromUnknown(item, sink);
    }
    return;
  }
  if (typeof input !== "object") {
    return;
  }
  for (const value of Object.values(input as Record<string, unknown>)) {
    collectUploadPathsFromUnknown(value, sink);
  }
}

export function listUploadFilesRecursively(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  const files: string[] = [];
  const walk = (current: string, relativePrefix = "") => {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const rel = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      const abs = resolve(current, entry.name);
      if (entry.isDirectory()) {
        walk(abs, rel);
        continue;
      }
      if (entry.isFile()) {
        files.push(rel.replace(/\\/g, "/"));
      }
    }
  };
  walk(root);
  return files;
}

export function removeUploadedByUrl(url?: string | null): void {
  const ref = extractScenarioUploadReferenceFromUrl(url);
  if (!ref) return;
  const root = ref.scenarioId === getActiveUploadScenarioId()
    ? getActiveScenarioUploadsRoot()
    : resolveScenarioUploadsRoot(getActiveUploadDataRoot(), ref.scenarioId);
  const absolute = resolveUploadPathInsideRoot(root, ref.relativePath);
  if (!absolute) return;
  try {
    unlinkSync(absolute);
  } catch {
    // Ignore cleanup errors.
  }
}

function extractScenarioUploadReferenceFromPath(pathname: string): { scenarioId: string; relativePath: string } | null {
  const parts = pathname.split("/");
  if (parts.length < 6 || parts[0] !== "") return null;
  const [, rootSegment, scenarioId, assetsSegment, uploadsSegment, ...relativeParts] = parts;
  if (rootSegment !== "scenario-assets" || assetsSegment !== "assets" || uploadsSegment !== "uploads") return null;
  if (!scenarioId || !/^[a-zA-Z0-9_-]+$/.test(scenarioId)) return null;
  if (relativeParts.some((part) => !part)) return null;
  const relativePath = normalizeUploadRelativePath(relativeParts.join("/"));
  return relativePath ? { scenarioId, relativePath } : null;
}
