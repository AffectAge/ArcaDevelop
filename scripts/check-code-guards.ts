import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENARIO_PROVINCE_FORBIDDEN_HEAVY_FIELDS } from "../apps/server/src/scenarios/scenarioValidation";
import {
  CLIENT_LOCALIZED_TEXT_GUARD_PATHS,
  CLIENT_THEME_TOKEN_GUARD_PATHS,
  CODE_GUARD_SCANNED_ROOTS,
  SCENARIO_DATA_GUARD_ROOT,
} from "./projectGuardConfig";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const currentScriptPath = resolve(fileURLToPath(import.meta.url));

const allowedAnyPatterns = [
  /as unknown as Prisma\.InputJsonValue/,
  /Record<string, unknown>/,
  /unknown\[\]/,
];

const forbiddenChecks: Array<{
  id: string;
  pattern: RegExp;
  message: string;
  allow?: (line: string, filePath: string) => boolean;
}> = [
  {
    id: "source-properties",
    pattern: /\bsourceProperties\b/,
    message: "Do not reintroduce sourceProperties into province data or map generation.",
  },
  {
    id: "province-heavy-world-state",
    pattern:
      /\b(provincePopulationByProvince|provinceBuildingsByProvince|provincePopulationTreasuryByProvince|provinceConstructionQueueByProvince|provinceBuildingDucatsByProvince|ProvincePopulation|ProvinceConstructionProject)\b/,
    message: "Heavy mechanic world state must be region-owned. Use region-owned contracts and runtime fields.",
    allow: (_line, filePath) =>
      [
        "apps/server/src/runtime/persistedWorldBaseRestore.ts",
        "apps/server/src/scenarios/scenarioValidation.ts",
        "apps/server/src/scenarios/scenarioValidation.test.ts",
      ].includes(relative(repoRoot, filePath).replace(/\\/g, "/")),
  },
  {
    id: "ts-ignore",
    pattern: /@ts-ignore/,
    message: "Do not add @ts-ignore. Fix the type boundary or document a narrower adapter.",
  },
  {
    id: "broad-any",
    pattern: /(:\s*any\b|\bas any\b|<any>)/,
    message: "Do not add broad any usage in guarded code. Use unknown plus validation or a typed boundary adapter.",
    allow: (line) => allowedAnyPatterns.some((pattern) => pattern.test(line)),
  },
];

const issues: string[] = [];

const forbiddenRootDataFiles = [
  {
    path: "apps/server/data/content-library.json",
    id: "legacy-content-library",
    message: "Root content-library.json is forbidden. Scenario content must live under scenarios/<scenarioId>/common/*/*.json.",
  },
] as const;

for (const file of forbiddenRootDataFiles) {
  const absolutePath = resolve(repoRoot, file.path);
  if (!exists(absolutePath)) continue;
  issues.push(`${file.path} [${file.id}] ${file.message}`);
}

for (const root of CODE_GUARD_SCANNED_ROOTS) {
  const absoluteRoot = resolve(repoRoot, root);
  collectFiles(absoluteRoot)
    .filter((filePath) => [".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(extname(filePath)))
    .forEach(checkFile);
}

for (const filePath of collectFiles(resolve(repoRoot, SCENARIO_DATA_GUARD_ROOT))) {
  if (extname(filePath) !== ".json") continue;
  if (isIgnoredScenarioDataPath(filePath)) continue;
  checkScenarioJsonFile(filePath);
}

for (const root of CLIENT_THEME_TOKEN_GUARD_PATHS) {
  const absoluteRoot = resolve(repoRoot, root);
  collectFiles(absoluteRoot)
    .filter((filePath) => [".ts", ".tsx", ".css"].includes(extname(filePath)))
    .forEach(checkClientThemeTokenFile);
}

for (const root of CLIENT_LOCALIZED_TEXT_GUARD_PATHS) {
  const absoluteRoot = resolve(repoRoot, root);
  collectFiles(absoluteRoot)
    .filter((filePath) => [".ts", ".tsx"].includes(extname(filePath)))
    .forEach(checkClientLocalizedTextFile);
}

if (issues.length > 0) {
  console.error("Code guard check failed:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("code guard check ok");

function collectFiles(root: string): string[] {
  if (!exists(root)) return [];
  const rootStat = statSync(root);
  if (rootStat.isFile()) return [root];

  const result: string[] = [];
  const entries = readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".generated") continue;
      result.push(...collectFiles(absolutePath));
      continue;
    }
    if (entry.isFile()) result.push(absolutePath);
  }
  return result;
}

function checkFile(filePath: string): void {
  if (resolve(filePath) === currentScriptPath) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const check of forbiddenChecks) {
      if (!check.pattern.test(line)) continue;
      if (check.allow?.(line, filePath)) continue;
      issues.push(`${relative(repoRoot, filePath)}:${index + 1} [${check.id}] ${check.message}`);
    }
  });
}

function checkScenarioJsonFile(filePath: string): void {
  const relativePath = relative(repoRoot, filePath);
  const raw = readFileSync(filePath, "utf8");
  if (/\bsourceProperties\b/.test(raw)) {
    issues.push(`${relativePath} [source-properties] Do not author or generate sourceProperties in scenario data.`);
  }

  if (!isProvinceHistoryFile(filePath)) return;

  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch (error) {
    issues.push(
      `${relativePath} [invalid-json] Scenario JSON must be valid: ${
        error instanceof Error ? error.message : "invalid JSON"
      }`,
    );
    return;
  }

  if (!isJsonObject(data)) return;

  for (const field of SCENARIO_PROVINCE_FORBIDDEN_HEAVY_FIELDS) {
    if (!(field in data)) continue;
    issues.push(
      `${relativePath} [province-heavy-field] Province history files must not contain region-heavy field "${field}".`,
    );
  }
}

function checkClientThemeTokenFile(filePath: string): void {
  const relativePath = relative(repoRoot, filePath);
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/(#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(|hsl\(|hsla\()/.test(line)) return;
    issues.push(
      `${relativePath}:${index + 1} [hardcoded-theme-value] UI primitives must use scenario theme tokens/CSS variables instead of hardcoded colors.`,
    );
  });
}

function checkClientLocalizedTextFile(filePath: string): void {
  const relativePath = relative(repoRoot, filePath);
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/[А-Яа-яЁё]/.test(line)) return;
    issues.push(
      `${relativePath}:${index + 1} [hardcoded-localized-text] Guarded UI components must use localization keys instead of inline Cyrillic text.`,
    );
  });
}

function isIgnoredScenarioDataPath(filePath: string): boolean {
  const segments = relative(repoRoot, filePath).split(/[\\/]/);
  if (segments.includes("_legacy") || segments.includes("_obsolete")) {
    issues.push(`${relative(repoRoot, filePath)} [removed-scenario-data] Removed scenario data folders are not allowed.`);
  }
  return segments.includes(".generated");
}

function isProvinceHistoryFile(filePath: string): boolean {
  const normalized = relative(repoRoot, filePath).split(/[\\/]/).join("/");
  return normalized.includes("/history/provinces/");
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
