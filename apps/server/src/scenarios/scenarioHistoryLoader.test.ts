import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProvinceOwnerFromRegionHistory,
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
  await mkdir(join(scenarioDir, "history/provinces/nested"), { recursive: true });
  await mkdir(join(scenarioDir, "history/regions"), { recursive: true });
  await mkdir(join(scenarioDir, "history/countries"), { recursive: true });
  return scenarioDir;
}

describe("scenario history loader", () => {
  it("loads per-entity province, region, and country history with region indexes", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(join(scenarioDir, "history/provinces/praha.json"), JSON.stringify({ id: "province:praha" }), "utf8");
    await writeFile(
      join(scenarioDir, "history/provinces/nested/plzen.json"),
      JSON.stringify({ id: "province:plzen" }),
      "utf8",
    );
    await writeFile(
      join(scenarioDir, "history/regions/bohemia.json"),
      JSON.stringify({
        id: "region:bohemia",
        provinceIds: ["province:praha", "province:plzen"],
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

    expect(history.provinces.map((province) => province.id)).toEqual(["province:plzen", "province:praha"]);
    expect(history.regions.map((region) => region.id)).toEqual(["region:bohemia"]);
    expect(history.countries.map((country) => country.id)).toEqual(["country:bohemia"]);
    expect(history.regionIdByProvinceId.get("province:praha")).toBe("region:bohemia");
    expect(history.provinceIdsByRegionId.get("region:bohemia")).toEqual(["province:praha", "province:plzen"]);
  });

  it("builds a province owner map from region ownership", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(join(scenarioDir, "history/provinces/1.json"), JSON.stringify({ id: "province:1" }), "utf8");
    await writeFile(join(scenarioDir, "history/provinces/2.json"), JSON.stringify({ id: "province:2" }), "utf8");
    await writeFile(join(scenarioDir, "history/provinces/3.json"), JSON.stringify({ id: "province:3" }), "utf8");
    await writeFile(
      join(scenarioDir, "history/regions/owned.json"),
      JSON.stringify({
        id: "region:owned",
        provinceIds: ["province:1", "province:2"],
        ownerCountryId: "country:owner",
      }),
      "utf8",
    );
    await writeFile(
      join(scenarioDir, "history/regions/unowned.json"),
      JSON.stringify({
        id: "region:unowned",
        provinceIds: ["province:3"],
        ownerCountryId: null,
      }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(buildProvinceOwnerFromRegionHistory(history)).toEqual({
      "1": "country:owner",
      "2": "country:owner",
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

    expect(buildResourcesByCountryFromHistory(history)).toEqual({
      "country:bohemia": {
        culture: 0,
        science: 8,
        religion: 0,
        colonization: 0,
        construction: 0,
        ducats: 120,
        gold: 5,
      },
      "country:landless": {
        culture: 0,
        science: 0,
        religion: 0,
        colonization: 0,
        construction: 0,
        ducats: 0,
        gold: 0,
      },
    });
  });

  it("supports startingResources as an alias for authored country resources", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(
      join(scenarioDir, "history/countries/bohemia.json"),
      JSON.stringify({
        id: "country:bohemia",
        startingResources: {
          construction: 4,
          colonization: 2,
        },
      }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(buildResourcesByCountryFromHistory(history)["country:bohemia"]).toMatchObject({
      construction: 4,
      colonization: 2,
      ducats: 0,
    });
  });

  it("builds safe country metadata from country history and localization", async () => {
    const scenarioDir = await createHistoryScenario();
    await mkdir(join(scenarioDir, "localisation"), { recursive: true });
    await writeFile(join(scenarioDir, "localisation/ru.json"), JSON.stringify({ country: { bohemia: { name: "Богемия" } } }), "utf8");
    await writeFile(join(scenarioDir, "localisation/en.json"), JSON.stringify({ country: { bohemia: { name: "Bohemia" } } }), "utf8");
    await writeFile(
      join(scenarioDir, "history/countries/bohemia.json"),
      JSON.stringify({
        id: "country:bohemia",
        nameKey: "country.bohemia.name",
        color: "#a33f2f",
        flagUrl: "assets/uploads/flags/bohemia.png",
      }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(buildScenarioCountryMetadata(scenarioDir, history)).toEqual([
      {
        id: "country:bohemia",
        name: "Богемия",
        color: "#a33f2f",
        flagUrl: "assets/uploads/flags/bohemia.png",
        crestUrl: null,
      },
    ]);
  });

  it("rejects scenario country admin and password fields", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(
      join(scenarioDir, "history/countries/bohemia.json"),
      JSON.stringify({
        id: "country:bohemia",
        name: "Bohemia",
        color: "#a33f2f",
        isAdmin: true,
      }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(() => buildScenarioCountryMetadata(scenarioDir, history)).toThrow("SCENARIO_COUNTRY_FORBIDDEN_SECURITY_FIELD");
  });

  it("rejects scenario countries without a valid color", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(
      join(scenarioDir, "history/countries/bohemia.json"),
      JSON.stringify({
        id: "country:bohemia",
        name: "Bohemia",
        color: "red",
      }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(() => buildScenarioCountryMetadata(scenarioDir, history)).toThrow("SCENARIO_COUNTRY_INVALID_COLOR");
  });

  it("allows scenarios with no authored countries", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(join(scenarioDir, "history/provinces/praha.json"), JSON.stringify({ id: "province:praha" }), "utf8");
    await writeFile(
      join(scenarioDir, "history/regions/bohemia.json"),
      JSON.stringify({ id: "region:bohemia", provinceIds: ["province:praha"] }),
      "utf8",
    );

    const history = loadScenarioHistory(scenarioDir);

    expect(history.countries).toEqual([]);
    expect(history.regionIdByProvinceId.get("province:praha")).toBe("region:bohemia");
  });

  it("throws when entity ids are duplicated across history files", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(join(scenarioDir, "history/provinces/a.json"), JSON.stringify({ id: "province:praha" }), "utf8");
    await writeFile(join(scenarioDir, "history/provinces/b.json"), JSON.stringify({ id: "province:praha" }), "utf8");

    expect(() => loadScenarioHistory(scenarioDir)).toThrow("SCENARIO_HISTORY_DUPLICATE_ID");
  });

  it("throws when a province belongs to multiple regions", async () => {
    const scenarioDir = await createHistoryScenario();
    await writeFile(join(scenarioDir, "history/provinces/praha.json"), JSON.stringify({ id: "province:praha" }), "utf8");
    await writeFile(
      join(scenarioDir, "history/regions/a.json"),
      JSON.stringify({ id: "region:a", provinceIds: ["province:praha"] }),
      "utf8",
    );
    await writeFile(
      join(scenarioDir, "history/regions/b.json"),
      JSON.stringify({ id: "region:b", provinceIds: ["province:praha"] }),
      "utf8",
    );

    expect(() => loadScenarioHistory(scenarioDir)).toThrow("SCENARIO_HISTORY_DUPLICATE_REGION_MEMBERSHIP");
  });
});
