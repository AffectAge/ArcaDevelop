import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildHexOwnerFromRegionHistory,
  buildResourcesByCountryFromHistory,
  buildScenarioCountryMetadata,
  loadScenarioHistory,
} from "./scenarioHistoryLoader";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createHistoryScenario(): Promise<string> {
  const scenarioDir = await mkdtemp(join(tmpdir(), "arcanorum-history-"));
  tempDirs.push(scenarioDir);
  await mkdir(join(scenarioDir, "history/regions/nested"), { recursive: true });
  await mkdir(join(scenarioDir, "history/countries"), { recursive: true });
  return scenarioDir;
}

describe("scenario history loader", () => {
  it("loads per-entity region and country history with hex region indexes", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(
      join(scenarioDir, "history/regions/bohemia.json"),
      JSON.stringify({
        id: "region:bohemia",
        hexIds: ["hex:0:0", "hex:1:0"],
        ownerCountryId: "country:bohemia",
      }),
      "utf8",
    );
    await writeFile(
      join(scenarioDir, "history/countries/bohemia.json"),
      JSON.stringify({ id: "country:bohemia", controlMode: "open" }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(history.regions.map((region) => region.id)).toEqual(["region:bohemia"]);
    expect(history.countries.map((country) => country.id)).toEqual(["country:bohemia"]);
    expect(history.regionIdByHexId.get("hex:0:0")).toBe("region:bohemia");
    expect(history.hexIdsByRegionId.get("region:bohemia")).toEqual(["hex:0:0", "hex:1:0"]);
  });

  it("builds a hex owner map from region ownership", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(
      join(scenarioDir, "history/regions/owned.json"),
      JSON.stringify({
        id: "region:owned",
        hexIds: ["hex:0:0", "hex:1:0"],
        ownerCountryId: "country:owner",
      }),
      "utf8",
    );
    await writeFile(
      join(scenarioDir, "history/regions/unowned.json"),
      JSON.stringify({
        id: "region:unowned",
        hexIds: ["hex:2:0"],
        ownerCountryId: null,
      }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(buildHexOwnerFromRegionHistory(history)).toEqual({
      "hex:0:0": "country:owner",
      "hex:1:0": "country:owner",
    });
  });

  it("builds starting resources for authored countries without requiring territory", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(
      join(scenarioDir, "history/countries/bohemia.json"),
      JSON.stringify({
        id: "country:bohemia",
        resources: {
          ducats: 120,
          gold: 5,
          science: 8,
        },
      }),
      "utf8",
    );
    await writeFile(
      join(scenarioDir, "history/countries/landless.json"),
      JSON.stringify({
        id: "country:landless",
        controlMode: "ai",
      }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(buildResourcesByCountryFromHistory(history)).toMatchObject({
      "country:bohemia": { ducats: 120, gold: 5, science: 8 },
      "country:landless": { ducats: 0, gold: 0, science: 0 },
    });
  });

  it("builds localized country metadata and rejects forbidden security fields", async () => {
    const scenarioDir = await createHistoryScenario();
    await mkdir(join(scenarioDir, "localisation"), { recursive: true });
    await writeFile(join(scenarioDir, "localisation/en.json"), JSON.stringify({ "country.bohemia": "Bohemia" }), "utf8");
    await writeFile(join(scenarioDir, "localisation/ru.json"), JSON.stringify({ "country.bohemia": "Богемия" }), "utf8");
    await writeFile(
      join(scenarioDir, "history/countries/bohemia.json"),
      JSON.stringify({ id: "country:bohemia", nameKey: "country.bohemia", color: "#123456" }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(buildScenarioCountryMetadata(scenarioDir, history)).toEqual([
      { id: "country:bohemia", name: "Богемия", color: "#123456", flagUrl: null, crestUrl: null },
    ]);
  });

  it("throws on forbidden country security fields", async () => {
    const scenarioDir = await createHistoryScenario();
    await mkdir(join(scenarioDir, "localisation"), { recursive: true });
    await writeFile(join(scenarioDir, "localisation/en.json"), JSON.stringify({}), "utf8");
    await writeFile(join(scenarioDir, "localisation/ru.json"), JSON.stringify({}), "utf8");
    await writeFile(
      join(scenarioDir, "history/countries/admin.json"),
      JSON.stringify({ id: "country:admin", color: "#123456", passwordHash: "forbidden" }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(() => buildScenarioCountryMetadata(scenarioDir, history)).toThrow("SCENARIO_COUNTRY_FORBIDDEN_SECURITY_FIELD");
  });

  it("throws on invalid country color", async () => {
    const scenarioDir = await createHistoryScenario();
    await mkdir(join(scenarioDir, "localisation"), { recursive: true });
    await writeFile(join(scenarioDir, "localisation/en.json"), JSON.stringify({}), "utf8");
    await writeFile(join(scenarioDir, "localisation/ru.json"), JSON.stringify({}), "utf8");
    await writeFile(
      join(scenarioDir, "history/countries/bad.json"),
      JSON.stringify({ id: "country:bad", color: "red" }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(() => buildScenarioCountryMetadata(scenarioDir, history)).toThrow("SCENARIO_COUNTRY_INVALID_COLOR");
  });

  it("allows scenarios with no authored countries", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(
      join(scenarioDir, "history/regions/bohemia.json"),
      JSON.stringify({ id: "region:bohemia", hexIds: ["hex:0:0"] }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(history.countries).toEqual([]);
    expect(history.regionIdByHexId.get("hex:0:0")).toBe("region:bohemia");
  });

  it("throws when entity ids are duplicated across history files", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(join(scenarioDir, "history/regions/a.json"), JSON.stringify({ id: "region:duplicate" }), "utf8");
    await writeFile(join(scenarioDir, "history/regions/b.json"), JSON.stringify({ id: "region:duplicate" }), "utf8");

    expect(() => loadScenarioHistory(scenarioDir)).toThrow("SCENARIO_HISTORY_DUPLICATE_ID");
  });

  it("throws when a hex belongs to multiple regions", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(
      join(scenarioDir, "history/regions/a.json"),
      JSON.stringify({ id: "region:a", hexIds: ["hex:0:0"] }),
      "utf8",
    );
    await writeFile(
      join(scenarioDir, "history/regions/b.json"),
      JSON.stringify({ id: "region:b", hexIds: ["hex:0:0"] }),
      "utf8",
    );

    expect(() => loadScenarioHistory(scenarioDir)).toThrow("SCENARIO_HISTORY_DUPLICATE_REGION_MEMBERSHIP");
  });
});
