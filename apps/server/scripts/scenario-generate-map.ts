import { resolve } from "node:path";
import { ensureDefaultScenario } from "../src/scenarios/defaultScenarioBootstrap";

const args = process.argv.slice(2);
const scenarioArgIndex = args.indexOf("--scenario");
const positionalScenario = args.find((arg) => !arg.startsWith("--"));
const scenarioId = scenarioArgIndex === -1 ? positionalScenario : args[scenarioArgIndex + 1];

if (!scenarioId) {
  console.error("Usage: npm run scenario:generate-map -- --scenario default");
  process.exit(1);
}

if (scenarioId !== "default") {
  console.error(`Only the server-generated default scenario is supported by this command today: ${scenarioId}`);
  process.exit(1);
}

const dataRoot = resolveDataRoot();
const result = ensureDefaultScenario({ dataRoot, forceGenerated: true });

console.log(`scenario map generated: ${result.scenarioId}`);
console.log(`hexes: ${result.artifact.tiles.length}`);
console.log(`river edges: ${result.artifact.riverEdges.length}`);
console.log(`coast overlays: ${result.artifact.coastOverlays.length}`);
console.log(`artifact: ${result.hexMapArtifactPath}`);
console.log(`hex index: ${result.hexIndexPath}`);
console.log(`region index: ${result.generatedRegionIndexPath}`);

function resolveDataRoot(): string {
  return process.cwd().endsWith("apps\\server") || process.cwd().endsWith("apps/server")
    ? resolve(process.cwd(), "data")
    : resolve(process.cwd(), "apps", "server", "data");
}
