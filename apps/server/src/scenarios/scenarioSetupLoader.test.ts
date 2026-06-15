import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadScenarioSetupFiles } from "./scenarioSetupLoader";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createScenarioDir(): Promise<string> {
  const scenarioDir = await mkdtemp(join(tmpdir(), "arcanorum-setup-"));
  tempDirs.push(scenarioDir);
  await mkdir(join(scenarioDir, "setup"), { recursive: true });
  return scenarioDir;
}

describe("scenario setup loader", () => {
  it("returns null setup values when no scenario directory is active", () => {
    const setup = loadScenarioSetupFiles(null);

    expect(Object.values(setup).every((value) => value === null)).toBe(true);
  });

  it("loads supported setup files from the setup directory", async () => {
    const scenarioDir = await createScenarioDir();
    await writeFile(join(scenarioDir, "setup/country_resources.json"), JSON.stringify({ country: { gold: 10 } }), "utf8");
    await writeFile(join(scenarioDir, "setup/province_owners.json"), JSON.stringify({ "1": "country:test" }), "utf8");
    await writeFile(
      join(scenarioDir, "setup/diplomacy.json"),
      JSON.stringify({ proposals: [{ id: "proposal:test" }] }),
      "utf8",
    );

    const setup = loadScenarioSetupFiles(scenarioDir);

    expect(setup.countryResources).toEqual({ country: { gold: 10 } });
    expect(setup.provinceOwners).toEqual({ "1": "country:test" });
    expect(setup.diplomacy).toEqual({ proposals: [{ id: "proposal:test" }] });
    expect("regionPopulation" in setup).toBe(false);
  });

  it("keeps missing optional setup files as null", async () => {
    const scenarioDir = await createScenarioDir();

    const setup = loadScenarioSetupFiles(scenarioDir);

    expect(setup.countryTechnologies).toBeNull();
    expect(setup.provinceNames).toBeNull();
    expect("provinceResourceExplorationQueue" in setup).toBe(false);
  });
});
