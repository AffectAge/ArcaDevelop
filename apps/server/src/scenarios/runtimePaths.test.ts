import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getScenarioRuntimePaths, normalizeScenarioId, readScenarioManifest } from "./runtimePaths";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("scenario runtime paths", () => {
  it("normalizes scenario ids", () => {
    expect(normalizeScenarioId("balanced-economy")).toBe("balanced-economy");
    expect(normalizeScenarioId("../bad")).toBeNull();
    expect(normalizeScenarioId("")).toBeNull();
  });

  it("prefers generated province index while keeping mapRoot for tiles", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "arcanorum-data-"));
    tempDirs.push(dataRoot);
    const scenarioDir = join(dataRoot, "scenarios/demo");
    await mkdir(join(scenarioDir, "map/tiles/adm1"), { recursive: true });
    await mkdir(join(scenarioDir, ".generated"), { recursive: true });
    await writeFile(join(scenarioDir, "scenario.json"), JSON.stringify({ id: "demo", mapRoot: "map" }), "utf8");
    await writeFile(join(scenarioDir, ".generated/provinces.json"), "[]", "utf8");

    const manifest = readScenarioManifest(scenarioDir, "fallback");
    const paths = getScenarioRuntimePaths({ scenarioDir, manifest: manifest?.manifest ?? {}, dataRoot });

    expect(manifest?.id).toBe("demo");
    expect(paths.mapRoot.endsWith("map")).toBe(true);
    expect(paths.provinceIndexPath.replaceAll("\\", "/").endsWith(".generated/provinces.json")).toBe(true);
  });
});
