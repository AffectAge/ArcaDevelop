import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ensureDefaultScenario } from "./defaultScenarioBootstrap";
import { loadScenarioHistory } from "./scenarioHistoryLoader";

describe("defaultScenarioBootstrap", () => {
  it("creates a server-authoritative default scenario with generated hex artifacts", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "arc-default-scenario-"));
    try {
      const result = ensureDefaultScenario({ dataRoot, forceGenerated: true });
      const history = loadScenarioHistory(result.scenarioDir);

      expect(existsSync(join(result.scenarioDir, "scenario.json"))).toBe(true);
      expect(existsSync(join(result.scenarioDir, "map", "hex-settings.json"))).toBe(true);
      expect(existsSync(result.hexMapArtifactPath)).toBe(true);
      expect(existsSync(result.hexIndexPath)).toBe(true);
      expect(existsSync(result.generatedRegionIndexPath)).toBe(true);
      expect(result.artifact.tiles.length).toBeGreaterThan(50_000);
      expect(history.regions.length).toBeGreaterThan(0);
      expect(history.countries.map((country) => country.id)).toContain("country:default");
      expect([...history.hexIdsByRegionId.values()].flat().length).toBe(result.artifact.tiles.length);
    } finally {
      await rm(dataRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
