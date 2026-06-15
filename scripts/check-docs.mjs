import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const projectRules = JSON.parse(readFileSync(join(repoRoot, ".codex/project-rules.json"), "utf8"));

const requiredDocs = [
  "AGENTS.md",
  "docs/README.md",
  "docs/programming-standards.md",
  "docs/folder-structure.md",
  "docs/scenario-region-history.md",
  "docs/adr/ADR-0002-per-entity-scenario-files.md",
];

const docsFromProjectRules = [
  ...stringArray(projectRules.requiredEntryPoints),
  ...stringArray(projectRules.coreDocs),
  ...Object.values(stringRecord(projectRules.templates)),
].filter((path) => path === "AGENTS.md" || path === ".codex/project-rules.json" || path.startsWith("docs/"));

const docsToCheck = [...new Set([...requiredDocs, ...docsFromProjectRules])].sort();
const missingDocs = docsToCheck.filter((path) => !existsSync(join(repoRoot, path)));

if (missingDocs.length > 0) {
  console.error(`Missing required docs:\n${missingDocs.map((path) => `- ${path}`).join("\n")}`);
  process.exit(1);
}

const readme = readFileSync(join(repoRoot, "docs/README.md"), "utf8");
for (const doc of docsToCheck.filter((path) => path.startsWith("docs/") && path !== "docs/README.md")) {
  if (!readme.includes(doc)) {
    console.error(`docs/README.md does not link ${doc}`);
    process.exit(1);
  }
}

console.log("docs check ok");

function stringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string");
}

function stringRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => typeof entry === "string"));
}
