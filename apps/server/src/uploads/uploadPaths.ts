import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const defaultScenarioUploadDataRoot = resolve(__dirname, "../../data");

let activeUploadDataRoot = defaultScenarioUploadDataRoot;
let activeUploadScenarioId = "active";

export function setActiveUploadScenario(params: { dataRoot?: string; scenarioId: string }): void {
  activeUploadDataRoot = params.dataRoot ? resolve(params.dataRoot) : activeUploadDataRoot;
  activeUploadScenarioId = normalizeScenarioAssetSegment(params.scenarioId);
}

export function getActiveUploadScenarioId(): string {
  return activeUploadScenarioId;
}

export function getActiveUploadDataRoot(): string {
  return activeUploadDataRoot;
}

export function getActiveScenarioUploadsRoot(): string {
  return resolveScenarioUploadsRoot(activeUploadDataRoot, activeUploadScenarioId);
}

export function resolveScenarioUploadsRoot(dataRoot: string, scenarioId: string): string {
  return resolve(dataRoot, "scenarios", normalizeScenarioAssetSegment(scenarioId), "assets", "uploads");
}

export function resolveScenarioUploadPublicPrefix(scenarioId = activeUploadScenarioId): string {
  return `/scenario-assets/${normalizeScenarioAssetSegment(scenarioId)}/assets/uploads`;
}

const contentUploadKinds = [
  "cultures",
  "resourceCategories",
  "provinceTypes",
  "provinceClimates",
  "provinceLandscapes",
  "provinceContinents",
  "provinceStrategicRegions",
  "religions",
  "professions",
  "ideologies",
  "interestGroups",
  "parties",
  "lawGroups",
  "laws",
  "races",
  "buildings",
  "goods",
  "companies",
  "industries",
  "sectors",
  "technologies",
  "decisions",
  "events",
  "battalions",
  "shipTypes",
  "aircraftTypes",
] as const;

export const FLAG_IMAGE_RULE = { maxWidth: 192, maxHeight: 128, ratioWidth: 3, ratioHeight: 2 } as const;
export const CREST_IMAGE_RULE = { maxWidth: 128, maxHeight: 192, ratioWidth: 2, ratioHeight: 3 } as const;

export const resourceIconFields = new Set([
  "culture",
  "science",
  "religion",
  "colonization",
  "construction",
  "ducats",
  "gold",
]);

export function ensureUploadDirectories(): void {
  const dirs = [
    resolveUploadDir("flags"),
    resolveUploadDir("crests"),
    resolveUploadDir("markets"),
    resolveUploadDir("resource-icons"),
    resolveUploadDir("ui-backgrounds"),
    resolveUploadDir("civilopedia"),
    resolveUploadDir("division-icons"),
    ...contentUploadKinds.map((kind) => resolveContentUploadDir(kind)),
  ];
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }
}

export function resolveContentUploadDir(kind?: string): string {
  return resolveUploadDir(resolveContentUploadUrlSegment(kind));
}

export function resolveContentUploadUrlSegment(kind?: string): string {
  if (!kind) return "cultures";
  if (kind === "resourceCategories") return "resource-categories";
  if (kind === "provinceTypes") return "province-types";
  if (kind === "provinceClimates") return "province-climates";
  if (kind === "provinceLandscapes") return "province-landscapes";
  if (kind === "provinceContinents") return "province-continents";
  if (kind === "provinceStrategicRegions") return "province-strategic-regions";
  if (kind === "interestGroups") return "interest-groups";
  if (kind === "lawGroups") return "law-groups";
  if (kind === "shipTypes") return "ship-types";
  if (kind === "aircraftTypes") return "aircraft-types";
  return kind;
}

export function normalizeContentLogoUrl(kind: string, logoUrl: string | null): string | null {
  if (!logoUrl) return logoUrl;
  if (kind === "resourceCategories") {
    return logoUrl.replace("/assets/uploads/resourceCategories/", "/assets/uploads/resource-categories/");
  }
  return logoUrl;
}

export function resolveUploadDir(segment: string): string {
  return resolve(getActiveScenarioUploadsRoot(), segment);
}

function normalizeScenarioAssetSegment(value: string): string {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new Error("INVALID_SCENARIO_UPLOAD_SCOPE");
  }
  return normalized;
}
