import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO_DEFINES, ensureDefaultScenario } from "./defaultScenarioBootstrap";
import { SCENARIO_DEFINES_SUPPORTED_SECTIONS, loadScenarioDefines } from "./scenarioDefinesLoader";
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
      expect(existsSync(result.hexMapClientManifestPath)).toBe(true);
      expect(existsSync(result.hexIndexPath)).toBe(true);
      expect(existsSync(result.generatedRegionIndexPath)).toBe(true);
      expect(result.artifact.tiles.length).toBeGreaterThan(50_000);
      expect(history.regions.length).toBeGreaterThan(0);
      expect(history.countries.map((country) => country.id)).toContain("country:default");
      expect([...history.hexIdsByRegionId.values()].flat().length).toBe(result.artifact.tiles.length);
      const clientManifest = JSON.parse(await readFile(result.hexMapClientManifestPath, "utf8")) as {
        artifactVersion: string;
        navigation: { fileName: string; brotliByteLength: number };
        chunks: Array<{ fileName: string; brotliByteLength: number }>;
      };
      expect(clientManifest.artifactVersion).toBe(result.hexMapClientArtifactVersion);
      expect(clientManifest.chunks.length).toBeGreaterThan(1);
      const clientArtifactRoot = dirname(result.hexMapClientManifestPath);
      for (const descriptor of [clientManifest.navigation, ...clientManifest.chunks]) {
        expect(existsSync(join(clientArtifactRoot, descriptor.fileName))).toBe(true);
        expect(existsSync(join(clientArtifactRoot, `${descriptor.fileName}.gz`))).toBe(true);
        expect(existsSync(join(clientArtifactRoot, `${descriptor.fileName}.br`))).toBe(true);
      }
      expect(
        [clientManifest.navigation, ...clientManifest.chunks].reduce(
          (total, descriptor) => total + descriptor.brotliByteLength,
          0,
        ),
      ).toBeLessThanOrEqual(2 * 1024 * 1024);

      const defines = loadScenarioDefines(result.scenarioDir);
      expect(defines).toEqual(DEFAULT_SCENARIO_DEFINES);
      for (const [section, fields] of Object.entries(SCENARIO_DEFINES_SUPPORTED_SECTIONS)) {
        expect(defines).toHaveProperty(section);
        for (const field of Object.keys(fields)) {
          expect((defines as Record<string, Record<string, unknown>>)[section]).toHaveProperty(field);
        }
      }

      const authoredMarkerPath = join(result.scenarioDir, "common", "goods", "preserved.json");
      await mkdir(dirname(authoredMarkerPath), { recursive: true });
      await writeFile(authoredMarkerPath, '{"id":"good:preserved"}\n', "utf8");
      ensureDefaultScenario({ dataRoot, forceGenerated: true });
      expect(existsSync(authoredMarkerPath)).toBe(true);
    } finally {
      await rm(dataRoot, { recursive: true, force: true });
    }
  }, 60_000);
});
