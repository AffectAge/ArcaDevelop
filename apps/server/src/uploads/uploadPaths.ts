import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  COUNTRY_CREST_UPLOAD_RULE,
  COUNTRY_FLAG_UPLOAD_RULE,
  COUNTRY_IDENTITY_LOGO_UPLOAD_RULE,
} from "@arcanorum/shared";

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
  "cultureGroups",
  "resourceCategories",
  "hexTypes",
  "hexClimates",
  "hexLandscapes",
  "hexContinents",
  "hexStrategicRegions",
  "religions",
  "religionGroups",
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
] as const;

export const FLAG_IMAGE_RULE = COUNTRY_FLAG_UPLOAD_RULE;
export const CREST_IMAGE_RULE = COUNTRY_CREST_UPLOAD_RULE;
export const IDENTITY_LOGO_IMAGE_RULE = COUNTRY_IDENTITY_LOGO_UPLOAD_RULE;

export function ensureUploadDirectories(): void {
  const dirs = [
    resolveUploadDir("flags"),
    resolveUploadDir("crests"),
    resolveUploadDir("markets"),
    resolveUploadDir("culture-logos"),
    resolveUploadDir("religion-logos"),
    resolveUploadDir("ui-backgrounds"),
    resolveUploadDir("civilopedia"),
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
  if (kind === "cultureGroups") return "culture-groups";
  if (kind === "hexTypes") return "province-types";
  if (kind === "hexClimates") return "province-climates";
  if (kind === "hexLandscapes") return "province-landscapes";
  if (kind === "hexContinents") return "province-continents";
  if (kind === "hexStrategicRegions") return "province-strategic-regions";
  if (kind === "interestGroups") return "interest-groups";
  if (kind === "religionGroups") return "religion-groups";
  if (kind === "lawGroups") return "law-groups";
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
