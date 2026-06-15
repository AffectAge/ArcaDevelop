import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildScenarioGeneratedIndexes, validateScenarioDirectory } from "./scenarioValidation";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("scenarioValidation", () => {
  it("loads valid per-entity province, region, country, content, and Arcawiki files", async () => {
    const scenarioDir = await createScenarioFixture();

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({
      provinces: 2,
      regions: 1,
      countries: 1,
      contentEntries: 1,
      arcawikiEntries: 1,
    });
  });

  it("fails on duplicate IDs", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/goods/duplicate-grain.json"), {
      id: "good:grain",
      nameKey: "good.grain.name",
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "DUPLICATE_ID")).toBe(true);
  });

  it("fails on broken stable references", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "history/regions/bohemia.json"), {
      id: "region:bohemia",
      nameKey: "region.bohemia.name",
      color: "#22d3ee",
      provinceIds: ["province:praha", "province:missing"],
      ownerCountryId: "country:bohemia",
      controllerCountryId: "country:bohemia",
      coreCountryIds: ["country:bohemia"],
      claims: [],
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "BROKEN_REFERENCE")).toBe(true);
  });

  it("fails on forbidden province-heavy fields", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "history/provinces/praha.json"), {
      id: "province:praha",
      nameKey: "province.praha.name",
      color: "#8fb9a8",
      terrain: "terrain:plains",
      climate: "climate:temperate",
      movementCost: 1,
      passable: true,
      pops: [],
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "FORBIDDEN_PROVINCE_HEAVY_FIELD")).toBe(true);
  });

  it("fails when province color is missing or invalid", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "history/provinces/praha.json"), {
      id: "province:praha",
      nameKey: "province.praha.name",
      color: "#8fb",
      terrain: "terrain:plains",
      climate: "climate:temperate",
      movementCost: 1,
      passable: true,
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "INVALID_ENTITY_COLOR")).toBe(true);
  });

  it("fails when region color is missing or invalid", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "history/regions/bohemia.json"), {
      id: "region:bohemia",
      nameKey: "region.bohemia.name",
      color: "cyan",
      provinceIds: ["province:praha", "province:plzen"],
      ownerCountryId: "country:bohemia",
      controllerCountryId: "country:bohemia",
      coreCountryIds: ["country:bohemia"],
      claims: [],
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "INVALID_ENTITY_COLOR")).toBe(true);
  });

  it("fails on removed-format scenario directories", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "_legacy/provinces.json"), []);

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "FORBIDDEN_REMOVED_FORMAT_DIRECTORY")).toBe(true);
  });

  it("fails on old aggregate setup sources for region heavy state", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "setup/region_population.json"), {
      "region:bohemia": { pops: [] },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "FORBIDDEN_AGGREGATE_SOURCE")).toBe(true);
  });

  it("fails when generated indexes are outside the scenario root generated directory", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "history/provinces/.generated/provinces.json"), []);

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "FORBIDDEN_GENERATED_INDEX_LOCATION")).toBe(true);
  });

  it("fails on removed province-heavy runtime fields in province history", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "history/provinces/praha.json"), {
      id: "province:praha",
      nameKey: "province.praha.name",
      color: "#8fb9a8",
      terrain: "terrain:plains",
      climate: "climate:temperate",
      movementCost: 1,
      passable: true,
      provinceConstructionQueueByProvince: {},
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "FORBIDDEN_PROVINCE_HEAVY_FIELD")).toBe(true);
  });

  it("fails on forbidden country security fields", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "history/countries/bohemia.json"), {
      id: "country:bohemia",
      nameKey: "country.bohemia.name",
      color: "#a33f2f",
      controlMode: "open",
      isAdmin: true,
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "FORBIDDEN_COUNTRY_SECURITY_FIELD")).toBe(true);
  });

  it("fails on invalid country color", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "history/countries/bohemia.json"), {
      id: "country:bohemia",
      nameKey: "country.bohemia.name",
      color: "red",
      controlMode: "open",
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "INVALID_COUNTRY_COLOR")).toBe(true);
  });

  it("fails on invalid scenario defines", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/defines.json"), {
      auditLog: {
        maxEntries: "many",
        retentionTurns: 5,
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "INVALID_DEFINES")).toBe(true);
  });

  it("fails on invalid scenario economy defines", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/defines.json"), {
      economy: {
        marketPriceSmoothing: 2,
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "INVALID_DEFINES")).toBe(true);
  });

  it("fails on invalid scenario turn timer defines", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/defines.json"), {
      turnTimer: {
        secondsPerTurn: 5,
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "INVALID_DEFINES")).toBe(true);
  });

  it("fails on unknown scenario define fields", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/defines.json"), {
      economy: {
        baseGold: 10,
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "INVALID_DEFINES")).toBe(true);
  });

  it("builds generated indexes and validates freshness", async () => {
    const scenarioDir = await createScenarioFixture();

    const manifest = await buildScenarioGeneratedIndexes(scenarioDir);
    const validWithGenerated = await validateScenarioDirectory(scenarioDir, { requireGeneratedIndexes: true });
    const provinceIndex = JSON.parse(await readFile(join(scenarioDir, ".generated/provinces.json"), "utf8")) as Array<{ id: string; regionId?: string; provinceColor?: string; regionColor?: string }>;

    expect(manifest.counts.provinces).toBe(2);
    expect(provinceIndex.find((province) => province.id === "praha")?.regionId).toBe("region:bohemia");
    expect(provinceIndex.find((province) => province.id === "praha")?.provinceColor).toBe("#8fb9a8");
    expect(provinceIndex.find((province) => province.id === "praha")?.regionColor).toBe("#22d3ee");
    expect(validWithGenerated.ok).toBe(true);
  });

  it("fails when generated indexes are stale", async () => {
    const scenarioDir = await createScenarioFixture();
    await buildScenarioGeneratedIndexes(scenarioDir);
    await writeJson(join(scenarioDir, "history/provinces/plzen.json"), {
      id: "province:plzen",
      nameKey: "province.plzen.name",
      color: "#b7a6d9",
      terrain: "terrain:hills",
      climate: "climate:temperate",
      movementCost: 3,
      passable: true,
    });

    const result = await validateScenarioDirectory(scenarioDir, { requireGeneratedIndexes: true });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "INVALID_GENERATED_INDEX")).toBe(true);
  });

  it("fails on invalid generated manifest shape", async () => {
    const scenarioDir = await createScenarioFixture();
    await mkdir(join(scenarioDir, ".generated"), { recursive: true });
    await writeFile(join(scenarioDir, ".generated/index-manifest.json"), "{\"schemaVersion\":2}\n", "utf8");

    const result = await validateScenarioDirectory(scenarioDir, { requireGeneratedIndexes: true });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "INVALID_GENERATED_INDEX")).toBe(true);
  });
});

async function createScenarioFixture(): Promise<string> {
  const scenarioDir = await mkdtemp(join(tmpdir(), "arcanorum-scenario-"));
  tempDirs.push(scenarioDir);
  await writeJson(join(scenarioDir, "scenario.json"), {
    id: "fixture",
    nameKey: "scenario.fixture.name",
  });
  await writeJson(join(scenarioDir, "localisation/en.json"), {
    scenario: { fixture: { name: "Fixture" } },
    province: { praha: { name: "Prague" }, plzen: { name: "Pilsen" } },
    region: { bohemia: { name: "Bohemia" } },
    country: { bohemia: { name: "Bohemia" } },
    good: { grain: { name: "Grain" } },
    arcawiki: { economy: { name: "Economy" } },
  });
  await writeJson(join(scenarioDir, "localisation/ru.json"), {
    scenario: { fixture: { name: "Fixture RU" } },
    province: { praha: { name: "Прага" }, plzen: { name: "Пльзень" } },
    region: { bohemia: { name: "Богемия" } },
    country: { bohemia: { name: "Богемия" } },
    good: { grain: { name: "Зерно" } },
    arcawiki: { economy: { name: "Экономика" } },
  });
  await writeJson(join(scenarioDir, "history/provinces/praha.json"), {
    id: "province:praha",
    nameKey: "province.praha.name",
    color: "#8fb9a8",
    terrain: "terrain:plains",
    climate: "climate:temperate",
    movementCost: 1,
    passable: true,
  });
  await writeJson(join(scenarioDir, "history/provinces/plzen.json"), {
    id: "province:plzen",
    nameKey: "province.plzen.name",
    color: "#b7a6d9",
    terrain: "terrain:hills",
    climate: "climate:temperate",
    movementCost: 2,
    passable: true,
  });
  await writeJson(join(scenarioDir, "history/regions/bohemia.json"), {
    id: "region:bohemia",
    nameKey: "region.bohemia.name",
    color: "#22d3ee",
    provinceIds: ["province:praha", "province:plzen"],
    ownerCountryId: "country:bohemia",
    controllerCountryId: "country:bohemia",
    coreCountryIds: ["country:bohemia"],
    claims: [],
  });
  await writeJson(join(scenarioDir, "history/countries/bohemia.json"), {
    id: "country:bohemia",
    nameKey: "country.bohemia.name",
    color: "#a33f2f",
    controlMode: "open",
  });
  await writeJson(join(scenarioDir, "common/goods/grain.json"), {
    id: "good:grain",
    nameKey: "good.grain.name",
  });
  await writeJson(join(scenarioDir, "arcawiki/entries/economy.json"), {
    id: "arcawiki:economy",
    nameKey: "arcawiki.economy.name",
  });

  return scenarioDir;
}

async function writeJson(path: string, data: unknown): Promise<void> {
  const dir = path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
  await mkdir(dir, { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
