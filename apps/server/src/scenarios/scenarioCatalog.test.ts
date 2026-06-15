import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findScenario, listScenarios } from "./scenarioCatalog";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createDataRoot(): Promise<string> {
  const dataRoot = await mkdtemp(join(tmpdir(), "arcanorum-catalog-"));
  tempDirs.push(dataRoot);
  await mkdir(join(dataRoot, "tiles/adm1"), { recursive: true });
  await writeFile(join(dataRoot, "provinces.json"), "[]", "utf8");
  return dataRoot;
}

async function createScenario(dataRoot: string, folder: string, manifest: Record<string, unknown>): Promise<string> {
  const scenarioDir = join(dataRoot, "scenarios", folder);
  await mkdir(join(scenarioDir, "map/tiles/adm1"), { recursive: true });
  await mkdir(join(scenarioDir, ".generated"), { recursive: true });
  await mkdir(join(scenarioDir, "content"), { recursive: true });
  await writeFile(join(scenarioDir, "scenario.json"), JSON.stringify(manifest), "utf8");
  await writeFile(join(scenarioDir, ".generated/provinces.json"), "[]", "utf8");
  await writeFile(join(scenarioDir, "content/goods.json"), "[]", "utf8");
  return scenarioDir;
}

describe("scenario catalog", () => {
  it("lists active and folder scenarios with generated province indexes", async () => {
    const dataRoot = await createDataRoot();
    await createScenario(dataRoot, "demo", {
      id: "demo",
      name: "Demo Scenario",
      description: "A test scenario",
      startTurn: 3,
      mapRoot: "map",
    });

    const scenarios = listScenarios({
      dataRoot,
      scenariosRoot: join(dataRoot, "scenarios"),
      activeScenarioId: "demo",
    });

    expect(scenarios.map((scenario) => scenario.id)).toEqual(["active", "demo"]);
    expect(scenarios[0]?.map.hasProvinces).toBe(true);
    expect(scenarios[1]).toMatchObject({
      id: "demo",
      name: "Demo Scenario",
      active: true,
      startTurn: 3,
      map: { root: "scenarios/demo/map", hasVectorTiles: true, hasProvinces: true },
      contentFiles: ["goods.json"],
    });
  });

  it("finds a scenario and returns runtime paths", async () => {
    const dataRoot = await createDataRoot();
    await createScenario(dataRoot, "demo", { id: "demo", mapRoot: "map" });

    const found = findScenario("demo", {
      dataRoot,
      scenariosRoot: join(dataRoot, "scenarios"),
      activeScenarioId: "active",
    });

    expect(found?.scenarioDir?.replaceAll("\\", "/")).toContain("/scenarios/demo");
    expect(found?.mapRoot.replaceAll("\\", "/")).toContain("/scenarios/demo/map");
    expect(found?.provinceIndexPath.replaceAll("\\", "/")).toContain("/scenarios/demo/.generated/provinces.json");
  });

  it("keeps the first descriptor when scenario ids collide", async () => {
    const dataRoot = await createDataRoot();
    await createScenario(dataRoot, "first", { id: "same", mapRoot: "map" });
    await createScenario(dataRoot, "second", { id: "same", mapRoot: "map" });

    const scenarios = listScenarios({
      dataRoot,
      scenariosRoot: join(dataRoot, "scenarios"),
      activeScenarioId: "active",
    });

    expect(scenarios.filter((scenario) => scenario.id === "same")).toHaveLength(1);
  });
});
