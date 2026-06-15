import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadRawScenarioContent } from "./scenarioContentLoader";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createScenarioDir(): Promise<string> {
  const scenarioDir = await mkdtemp(join(tmpdir(), "arcanorum-content-"));
  tempDirs.push(scenarioDir);
  return scenarioDir;
}

describe("scenario content loader", () => {
  it("loads one-file-per-entry content and hydrates names from localization", async () => {
    const scenarioDir = await createScenarioDir();
    await mkdir(join(scenarioDir, "common/goods/raw"), { recursive: true });
    await mkdir(join(scenarioDir, "localisation"), { recursive: true });
    await writeFile(
      join(scenarioDir, "common/goods/raw/grain.json"),
      JSON.stringify({ id: "good:grain", nameKey: "goods.grain" }),
      "utf8",
    );
    await writeFile(join(scenarioDir, "localisation/ru.json"), JSON.stringify({ goods: { grain: "Зерно" } }), "utf8");
    await writeFile(join(scenarioDir, "localisation/en.json"), JSON.stringify({ goods: { grain: "Grain" } }), "utf8");

    const content = loadRawScenarioContent(scenarioDir);

    expect(content?.goods).toEqual([{ id: "good:grain", nameKey: "goods.grain", name: "Зерно" }]);
  });

  it("falls back to English and then the localization key", async () => {
    const scenarioDir = await createScenarioDir();
    await mkdir(join(scenarioDir, "common/buildings"), { recursive: true });
    await mkdir(join(scenarioDir, "common/technologies"), { recursive: true });
    await mkdir(join(scenarioDir, "localisation"), { recursive: true });
    await writeFile(
      join(scenarioDir, "common/buildings/farm.json"),
      JSON.stringify({ id: "building:farm", nameKey: "buildings.farm" }),
      "utf8",
    );
    await writeFile(
      join(scenarioDir, "common/technologies/magic.json"),
      JSON.stringify({ id: "technology:magic", nameKey: "technologies.magic" }),
      "utf8",
    );
    await writeFile(join(scenarioDir, "localisation/en.json"), JSON.stringify({ buildings: { farm: "Farm" } }), "utf8");

    const content = loadRawScenarioContent(scenarioDir);

    expect(content?.buildings).toEqual([{ id: "building:farm", nameKey: "buildings.farm", name: "Farm" }]);
    expect(content?.technologies).toEqual([
      { id: "technology:magic", nameKey: "technologies.magic", name: "technologies.magic" },
    ]);
  });

  it("ignores removed content-library files", async () => {
    const scenarioDir = await createScenarioDir();
    await mkdir(join(scenarioDir, "common/goods"), { recursive: true });
    await writeFile(
      join(scenarioDir, "common/goods/grain.json"),
      JSON.stringify({ id: "good:grain", name: "Per Entity Grain" }),
      "utf8",
    );
    await writeFile(
      join(scenarioDir, "content-library.json"),
      JSON.stringify({
        content: {
          goods: [{ id: "good:grain", name: "Removed Grain" }],
          cultures: [{ id: "culture:removed", name: "Removed Culture" }],
        },
      }),
      "utf8",
    );

    const content = loadRawScenarioContent(scenarioDir);

    expect(content?.goods).toEqual([{ id: "good:grain", name: "Per Entity Grain" }]);
    expect(content?.cultures).toBeUndefined();
  });

  it("loads split content files when per-entity content is absent", async () => {
    const scenarioDir = await createScenarioDir();
    await mkdir(join(scenarioDir, "content"), { recursive: true });
    await writeFile(
      join(scenarioDir, "content/resource_categories.json"),
      JSON.stringify({ resourceCategories: [{ id: "resource_category:food", name: "Food" }] }),
      "utf8",
    );

    const content = loadRawScenarioContent(scenarioDir);

    expect(content?.resourceCategories).toEqual([{ id: "resource_category:food", name: "Food" }]);
  });
});
