import { resolve } from "node:path";
import { formatScenarioValidationIssues, validateScenarioDirectory } from "../src/scenarios/scenarioValidation";

const args = process.argv.slice(2);
const scenarioArgIndex = args.indexOf("--scenario");
const requireGeneratedIndexes = args.includes("--require-generated");
const positionalScenario = args.find((arg) => !arg.startsWith("--"));

if ((scenarioArgIndex === -1 || !args[scenarioArgIndex + 1]) && !positionalScenario) {
  console.error("Usage: npm run scenario:validate -- --scenario <scenarioPathOrId> [--require-generated]");
  process.exit(1);
}

const scenarioInput = scenarioArgIndex === -1 ? positionalScenario as string : args[scenarioArgIndex + 1];
const scenarioDir = scenarioInput.includes("/") || scenarioInput.includes("\\")
  ? resolve(scenarioInput)
  : resolveScenarioId(scenarioInput);

const result = await validateScenarioDirectory(scenarioDir, { requireGeneratedIndexes });

if (!result.ok) {
  console.error(formatScenarioValidationIssues(result.issues));
  process.exit(1);
}

console.log(`scenario validation ok: ${scenarioInput}`);
console.log(JSON.stringify(result.summary));

function resolveScenarioId(scenarioId: string): string {
  const rootCandidate = resolve(process.cwd(), "apps", "server", "data", "scenarios", scenarioId);
  const serverCandidate = resolve(process.cwd(), "data", "scenarios", scenarioId);
  return process.cwd().endsWith("apps\\server") || process.cwd().endsWith("apps/server") ? serverCandidate : rootCandidate;
}
