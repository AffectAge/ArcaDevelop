import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENARIO_DEFINES_SUPPORTED_SECTIONS } from "../apps/server/src/scenarios/scenarioDefinesLoader";
import { SCENARIO_ENTITY_DIRECTORIES, SCENARIO_PROVINCE_FORBIDDEN_HEAVY_FIELDS } from "../apps/server/src/scenarios/scenarioValidation";
import {
  CLIENT_LOCALIZED_TEXT_GUARD_PATHS,
  CLIENT_THEME_TOKEN_GUARD_PATHS,
  CODE_GUARD_SCANNED_ROOTS,
  SCENARIO_DATA_GUARD_ROOT,
} from "./projectGuardConfig";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const projectRulesPath = resolve(repoRoot, ".codex/project-rules.json");
const projectRules = JSON.parse(readFileSync(projectRulesPath, "utf8")) as {
  requiredEntryPoints?: unknown;
  folderAgentFiles?: unknown;
  coreDocs?: unknown;
  taskRouting?: unknown;
  templates?: unknown;
  guardedPaths?: unknown;
  scenarioDataRules?: {
    authoredPaths?: unknown;
    defines?: {
      supportedSections?: unknown;
    };
    provinceForbiddenHeavyData?: unknown;
  };
};

assertStringArrayFilesExist(projectRules.requiredEntryPoints, "requiredEntryPoints");
assertStringArrayFilesExist(projectRules.folderAgentFiles, "folderAgentFiles");
assertFolderAgentStartLine(projectRules.folderAgentFiles);
assertStringArrayFilesExist(projectRules.coreDocs, "coreDocs");
assertStringRecordFilesExist(projectRules.templates, "templates");
assertTaskRoutingFilesExist(projectRules.taskRouting);

assertProjectRulesSection(
  projectRules.guardedPaths,
  {
    codeScannedRoots: [...CODE_GUARD_SCANNED_ROOTS],
    scenarioDataRoot: SCENARIO_DATA_GUARD_ROOT,
    clientThemeTokenPaths: [...CLIENT_THEME_TOKEN_GUARD_PATHS],
    clientLocalizedTextPaths: [...CLIENT_LOCALIZED_TEXT_GUARD_PATHS],
  },
  ".codex/project-rules.json guardedPaths is out of sync with scripts/projectGuardConfig.ts.",
);

assertProjectRulesSection(
  projectRules.scenarioDataRules?.defines?.supportedSections,
  normalizeJson(SCENARIO_DEFINES_SUPPORTED_SECTIONS),
  ".codex/project-rules.json scenarioDataRules.defines.supportedSections is out of sync with scenarioDefinesLoader.ts.",
);

assertProjectRulesSection(
  projectRules.scenarioDataRules?.authoredPaths,
  buildExpectedAuthoredPaths(),
  ".codex/project-rules.json scenarioDataRules.authoredPaths is out of sync with scenarioValidation.ts.",
);

assertProjectRulesSection(
  projectRules.scenarioDataRules?.provinceForbiddenHeavyData,
  [...SCENARIO_PROVINCE_FORBIDDEN_HEAVY_FIELDS],
  ".codex/project-rules.json scenarioDataRules.provinceForbiddenHeavyData is out of sync with scenarioValidation.ts.",
);

console.log("project rules check ok");

function assertProjectRulesSection(actual: unknown, expected: unknown, message: string): void {
  if (stableStringify(actual) === stableStringify(expected)) return;
  console.error(message);
  console.error("Update runtime validators, docs, tests, and .codex/project-rules.json together.");
  process.exit(1);
}

function assertStringArrayFilesExist(value: unknown, sectionName: string): void {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    console.error(`.codex/project-rules.json ${sectionName} must be an array of file paths.`);
    process.exit(1);
  }

  const missing = value.filter((entry) => !existsSync(resolve(repoRoot, entry as string)));
  if (missing.length === 0) return;

  console.error(`.codex/project-rules.json ${sectionName} references missing files:`);
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

function assertFolderAgentStartLine(value: unknown): void {
  if (!Array.isArray(value)) return;

  const requiredLine = "Always start from root `AGENTS.md` and `docs/README.md`";
  const missingLine: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const absolutePath = resolve(repoRoot, entry);
    if (!existsSync(absolutePath)) continue;
    const content = readFileSync(absolutePath, "utf8");
    if (!content.includes(requiredLine)) {
      missingLine.push(entry);
    }
  }

  if (missingLine.length === 0) return;

  console.error("Folder-level AGENTS.md files must include the mandatory start line:");
  for (const file of missingLine) console.error(`- ${file}`);
  process.exit(1);
}

function assertStringRecordFilesExist(value: unknown, sectionName: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    console.error(`.codex/project-rules.json ${sectionName} must be an object of file paths.`);
    process.exit(1);
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const nonString = entries.filter(([, entry]) => typeof entry !== "string").map(([key]) => key);
  if (nonString.length > 0) {
    console.error(`.codex/project-rules.json ${sectionName} entries must be file paths:`);
    for (const key of nonString) console.error(`- ${key}`);
    process.exit(1);
  }

  const missing = entries
    .filter(([, entry]) => !existsSync(resolve(repoRoot, entry as string)))
    .map(([key, entry]) => `${key}: ${entry as string}`);
  if (missing.length === 0) return;

  console.error(`.codex/project-rules.json ${sectionName} references missing files:`);
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

function assertTaskRoutingFilesExist(value: unknown): void {
  const sectionName = "taskRouting";
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    console.error(`.codex/project-rules.json ${sectionName} must be an object of file path arrays.`);
    process.exit(1);
  }

  const invalidRoutes: string[] = [];
  const missingFiles: string[] = [];
  for (const [routeName, routeFiles] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(routeFiles) || routeFiles.some((entry) => typeof entry !== "string")) {
      invalidRoutes.push(routeName);
      continue;
    }

    for (const file of routeFiles) {
      if (!existsSync(resolve(repoRoot, file as string))) {
        missingFiles.push(`${routeName}: ${file as string}`);
      }
    }
  }

  if (invalidRoutes.length > 0) {
    console.error(`.codex/project-rules.json ${sectionName} routes must be arrays of file paths:`);
    for (const routeName of invalidRoutes) console.error(`- ${routeName}`);
    process.exit(1);
  }

  if (missingFiles.length === 0) return;

  console.error(`.codex/project-rules.json ${sectionName} references missing files:`);
  for (const file of missingFiles) console.error(`- ${file}`);
  process.exit(1);
}

function buildExpectedAuthoredPaths(): Record<string, string> {
  const result: Record<string, string> = {
    defines: "scenarios/<scenarioId>/common/defines.json",
    regionResourceDeposits: "scenarios/<scenarioId>/history/regions/*.json#resourceDeposits",
  };
  const keyByKind: Record<string, string> = {
    province: "provinces",
    region: "regions",
    country: "countries",
    diplomacyRelation: "diplomacyRelations",
    diplomacyTreaty: "diplomacyTreaties",
    asset: "assets",
    good: "goods",
    building: "buildings",
    technology: "technologies",
    law: "laws",
    lawGroup: "lawGroups",
    culture: "cultures",
    cultureGroup: "cultureGroups",
    resourceCategory: "resourceCategories",
    provinceType: "provinceTypes",
    provinceClimate: "provinceClimates",
    provinceLandscape: "provinceLandscapes",
    provinceContinent: "provinceContinents",
    provinceStrategicRegion: "provinceStrategicRegions",
    religion: "religions",
    religionGroup: "religionGroups",
    ideology: "ideologies",
    profession: "professions",
    race: "races",
    market: "markets",
    modifier: "modifiers",
    mapFeatureGenerator: "mapFeatureGenerators",
    mapFeatureVisual: "mapFeatureVisuals",
    naturalFeatureVisual: "naturalFeatureVisuals",
    interestGroup: "interestGroups",
    party: "parties",
    company: "companies",
    industry: "industries",
    sector: "sectors",
    decision: "decisions",
    event: "events",
    journalEntry: "journalEntries",
    battalion: "battalions",
    shipType: "shipTypes",
    aircraftType: "aircraftTypes",
    unitType: "unitTypes",
    unitSkill: "unitSkills",
    unitSkillTree: "unitSkillTrees",
    aiArchetype: "aiArchetypes",
    aiPersonality: "aiPersonalities",
    aiStrategy: "aiStrategies",
    arcawikiEntry: "arcawikiEntries",
  };

  for (const { kind, path } of SCENARIO_ENTITY_DIRECTORIES) {
    const key = keyByKind[kind];
    if (!key) {
      console.error(`Missing project-rules authored path key mapping for scenario entity kind "${kind}".`);
      process.exit(1);
    }
    result[key] = `scenarios/<scenarioId>/${path}/*.json`;
  }

  return result;
}

function normalizeJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]),
  );
}
