import { resolve } from "node:path";
import { buildScenarioGeneratedIndexes } from "../src/scenarios/scenarioValidation";

const args = process.argv.slice(2);
const scenarioArgIndex = args.indexOf("--scenario");
const positionalScenario = args.find((arg) => !arg.startsWith("--"));

if ((scenarioArgIndex === -1 || !args[scenarioArgIndex + 1]) && !positionalScenario) {
  console.error("Usage: npm run scenario:build-indexes -- --scenario <scenarioPathOrId>");
  process.exit(1);
}

const scenarioInput = scenarioArgIndex === -1 ? positionalScenario as string : args[scenarioArgIndex + 1];
const scenarioDir = scenarioInput.includes("/") || scenarioInput.includes("\\")
  ? resolve(scenarioInput)
  : resolveScenarioId(scenarioInput);

const manifest = await buildScenarioGeneratedIndexes(scenarioDir);
console.log(`scenario generated indexes built: ${scenarioInput}`);
console.log(JSON.stringify(manifest.counts));

function resolveScenarioId(scenarioId: string): string {
  const rootCandidate = resolve(process.cwd(), "apps", "server", "data", "scenarios", scenarioId);
  const serverCandidate = resolve(process.cwd(), "data", "scenarios", scenarioId);
  return process.cwd().endsWith("apps\\server") || process.cwd().endsWith("apps/server") ? serverCandidate : rootCandidate;
}
