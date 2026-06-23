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
  it("loads valid hex-region, country, content, and Arcawiki files", async () => {
    const scenarioDir = await createScenarioFixture();

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({
      hexes: 0,
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
      hexIds: ["hex:0:0", "bad-hex"],
      ownerCountryId: "country:bohemia",
      controllerCountryId: "country:bohemia",
      coreCountryIds: ["country:bohemia"],
      claims: [],
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "BROKEN_REFERENCE")).toBe(true);
  });

  it("fails on legacy province authored paths", async () => {
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
    expect(result.issues.some((issue) => issue.code === "FORBIDDEN_REMOVED_FORMAT_DIRECTORY")).toBe(true);
  });

  it("fails on legacy province authored paths before province color validation", async () => {
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
    expect(result.issues.some((issue) => issue.code === "FORBIDDEN_REMOVED_FORMAT_DIRECTORY")).toBe(true);
  });

  it("fails when region color is missing or invalid", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "history/regions/bohemia.json"), {
      id: "region:bohemia",
      nameKey: "region.bohemia.name",
      color: "cyan",
      hexIds: ["hex:0:0", "hex:0:1"],
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

  it("fails on legacy province setup ownership sources", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "setup/province_owners.json"), {
      "province:praha": "country:bohemia",
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "FORBIDDEN_AGGREGATE_SOURCE")).toBe(true);
  });

  it("fails when generated indexes are outside the scenario root generated directory", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "history/regions/.generated/hex-regions.json"), []);

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "FORBIDDEN_GENERATED_INDEX_LOCATION")).toBe(true);
  });

  it("fails on root generated province indexes", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, ".generated/provinces.json"), []);

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "FORBIDDEN_AGGREGATE_SOURCE")).toBe(true);
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

  it("fails on legacy raw event fields", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/legacy.json"), {
      id: "event:legacy",
      nameKey: "event.legacy.name",
      event: {
        category: "politics",
        priority: "medium",
        visibility: "private",
        title: "Raw event title",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        options: [
          {
            id: "ok",
            label: "Raw option label",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.filter((issue) => issue.code === "INVALID_EVENT_DEFINITION").map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("event uses legacy field title"),
        expect.stringContaining("event.options[0] uses legacy field label"),
      ]),
    );
  });

  it("fails when event category priority or visibility is invalid", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/invalid-metadata.json"), {
      id: "event:invalid_metadata",
      nameKey: "event.legacy.name",
      event: {
        category: "festival",
        priority: "critical",
        visibility: "secret",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.filter((issue) => issue.code === "INVALID_EVENT_DEFINITION").map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("event.category must be one of"),
        expect.stringContaining("event.priority must be one of"),
        expect.stringContaining("event.visibility must be one of"),
      ]),
    );
  });

  it("validates country modifier trigger references", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/modifiers/industrial-program.json"), {
      id: "modifier:industrial_program",
      nameKey: "modifier.industrialProgram.name",
      modifiers: [
        {
          id: "active",
          label: "Industrial program",
          scope: "country",
          effects: [],
        },
      ],
    });
    await writeJson(join(scenarioDir, "common/events/modifier-trigger.json"), {
      id: "event:modifier_trigger",
      nameKey: "event.legacy.name",
      event: {
        category: "politics",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        trigger: { type: "country_has_modifier", targetId: "modifier:industrial_program" },
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(true);
  });

  it("validates modifier effect references", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/modifiers/industrial-program.json"), {
      id: "modifier:industrial_program",
      nameKey: "modifier.industrialProgram.name",
      modifiers: [
        {
          id: "active",
          label: "Industrial program",
          scope: "country",
          effects: [],
        },
      ],
    });
    await writeJson(join(scenarioDir, "common/events/modifier-effect.json"), {
      id: "event:modifier_effect",
      nameKey: "event.legacy.name",
      event: {
        category: "politics",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [
              { type: "add_modifier", modifierId: "modifier:industrial_program", durationTurns: 4 },
              { type: "extend_modifier", modifierId: "modifier:industrial_program", durationTurns: 2 },
              { type: "remove_modifier", modifierId: "modifier:industrial_program" },
            ],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(true);
  });

  it("validates colonization progress effects", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/colonization-progress-effect.json"), {
      id: "event:colonization_progress_effect",
      nameKey: "event.legacy.name",
      event: {
        category: "colonization",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [{ type: "change_colonization_progress", amount: 5 }],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(true);
  });

  it("fails when country modifier trigger references a missing modifier", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/missing-modifier-trigger.json"), {
      id: "event:missing_modifier_trigger",
      nameKey: "event.legacy.name",
      event: {
        category: "politics",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        trigger: { type: "country_has_modifier", targetId: "modifier:missing" },
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.filter((issue) => issue.code === "BROKEN_REFERENCE").map((issue) => issue.message)).toEqual(
      expect.arrayContaining([expect.stringContaining("targetId references missing modifier modifier:missing")]),
    );
  });

  it("fails when modifier effects reference missing modifiers", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/missing-modifier-effect.json"), {
      id: "event:missing_modifier_effect",
      nameKey: "event.legacy.name",
      event: {
        category: "politics",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [{ type: "add_modifier", modifierId: "modifier:missing", durationTurns: 4 }],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.filter((issue) => issue.code === "BROKEN_REFERENCE").map((issue) => issue.message)).toEqual(
      expect.arrayContaining([expect.stringContaining("modifierId references missing modifier modifier:missing")]),
    );
  });

  it("fails when trigger references missing law technology or building ids", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/missing-trigger-references.json"), {
      id: "event:missing_trigger_references",
      nameKey: "event.legacy.name",
      event: {
        category: "politics",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        trigger: {
          all: [
            { type: "country_has_law", targetId: "law:missing" },
            { type: "country_has_technology", targetId: "technology:missing" },
            { type: "region_has_building", targetId: "building:missing" },
          ],
        },
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    const messages = result.issues.filter((issue) => issue.code === "BROKEN_REFERENCE").map((issue) => issue.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining("targetId references missing law law:missing"),
        expect.stringContaining("targetId references missing technology technology:missing"),
        expect.stringContaining("targetId references missing building building:missing"),
      ]),
    );
  });

  it("validates region colonization progress triggers in scoped events", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/colonization-progress.json"), {
      id: "event:colonization_progress",
      nameKey: "event.legacy.name",
      event: {
        category: "colonization",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        scope: {
          root: { kind: "country" },
          region: {
            kind: "region",
            from: "root.controlled_regions",
            where: { type: "region_colonization_progress_above", value: 50 },
          },
        },
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(true);
  });

  it("validates region resource deposit trigger references", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/resource-deposit.json"), {
      id: "event:resource_deposit",
      nameKey: "event.legacy.name",
      event: {
        category: "economy",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        scope: {
          root: { kind: "country" },
          region: {
            kind: "region",
            from: "root.controlled_regions",
            where: { type: "region_has_resource_deposit", targetId: "good:grain" },
          },
        },
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(true);
  });

  it("validates region colonizable triggers in scoped events", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/colonizable-region.json"), {
      id: "event:colonizable_region",
      nameKey: "event.legacy.name",
      event: {
        category: "colonization",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        scope: {
          root: { kind: "country" },
          region: {
            kind: "region",
            from: "root.owned_regions",
            where: { type: "region_is_colonizable" },
          },
        },
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(true);
  });

  it("validates region population stress triggers in scoped events", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/region-unrest.json"), {
      id: "event:region_unrest",
      nameKey: "event.legacy.name",
      event: {
        category: "politics",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        scope: {
          root: { kind: "country" },
          region: {
            kind: "region",
            from: "root.controlled_regions",
            where: {
              all: [
                { type: "region_radicals_above", value: 500 },
                { type: "region_loyalists_above", value: 100 },
                { type: "region_standard_of_living_below", value: 9 },
              ],
            },
          },
        },
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(true);
  });

  it("validates building economy triggers in scoped events", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/building-strain.json"), {
      id: "event:building_strain",
      nameKey: "event.legacy.name",
      event: {
        category: "economy",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        scope: {
          root: { kind: "country" },
          region: {
            kind: "region",
            from: "root.controlled_regions",
            where: {
              any: [
                { type: "building_profit_below", value: 0 },
                { type: "building_employment_below", value: 0.5 },
                { type: "building_output_above", targetId: "good:grain", value: 10 },
              ],
            },
          },
        },
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(true);
  });

  it("fails when building output trigger references a missing good", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/missing-building-output-good.json"), {
      id: "event:missing_building_output_good",
      nameKey: "event.legacy.name",
      event: {
        category: "economy",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        trigger: { type: "building_output_above", targetId: "good:missing", value: 10 },
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.filter((issue) => issue.code === "BROKEN_REFERENCE").map((issue) => issue.message)).toEqual(
      expect.arrayContaining([expect.stringContaining("targetId references missing good good:missing")]),
    );
  });

  it("validates controlled foreign region triggers", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/foreign-region-control.json"), {
      id: "event:foreign_region_control",
      nameKey: "event.legacy.name",
      event: {
        category: "military",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        trigger: { type: "controls_foreign_region" },
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(true);
  });

  it("validates negative resource flow triggers", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/negative-flow.json"), {
      id: "event:negative_flow",
      nameKey: "event.legacy.name",
      event: {
        category: "economy",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        trigger: { type: "resource_flow_negative", resource: "ducats" },
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(true);
  });

  it("fails when region resource deposit trigger references a missing good", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/missing-resource-deposit.json"), {
      id: "event:missing_resource_deposit",
      nameKey: "event.legacy.name",
      event: {
        category: "economy",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        trigger: { type: "region_has_resource_deposit", targetId: "good:missing" },
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [],
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.filter((issue) => issue.code === "BROKEN_REFERENCE").map((issue) => issue.message)).toEqual(
      expect.arrayContaining([expect.stringContaining("targetId references missing good good:missing")]),
    );
  });

  it("fails on legacy decision resource_delta effects", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/decisions/legacy.json"), {
      id: "decision:legacy",
      nameKey: "decision.legacy.name",
      decision: {
        category: "economy",
        effects: [
          {
            type: "resource_delta",
            resource: "gold",
            amount: 1,
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    expect(result.issues.filter((issue) => issue.code === "INVALID_DECISION_DEFINITION").map((issue) => issue.message)).toEqual(
      expect.arrayContaining([expect.stringContaining("uses legacy resource_delta")]),
    );
  });

  it("fails on invalid resource effect fields", async () => {
    const scenarioDir = await createScenarioFixture();
    await writeJson(join(scenarioDir, "common/events/invalid-resource-effect.json"), {
      id: "event:invalid_resource_effect",
      nameKey: "event.legacy.name",
      event: {
        category: "economy",
        priority: "medium",
        visibility: "private",
        titleKey: "event.legacy.title",
        descriptionKey: "event.legacy.description",
        options: [
          {
            id: "ok",
            labelKey: "event.legacy.option.ok",
            effects: [
              {
                type: "add_resource",
                resource: "mana",
                amount: -1,
              },
            ],
          },
        ],
      },
    });
    await writeJson(join(scenarioDir, "common/decisions/invalid-resource-effect.json"), {
      id: "decision:invalid_resource_effect",
      nameKey: "decision.legacy.name",
      decision: {
        category: "economy",
        effects: [
          {
            type: "add_resource_flow",
            resource: "gold",
            amount: 0,
            direction: "bonus",
          },
        ],
      },
    });

    const result = await validateScenarioDirectory(scenarioDir);

    expect(result.ok).toBe(false);
    const messages = result.issues.map((issue) => issue.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining("effects[0].resource is unsupported"),
        expect.stringContaining("effects[0].amount must be a positive finite number"),
        expect.stringContaining("effects[0].direction must be income or expense"),
        expect.stringContaining("effects[0].labelKey is required for add_resource_flow"),
      ]),
    );
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
    const hexSettings = JSON.parse(await readFile(join(scenarioDir, ".generated/hex-map-settings.json"), "utf8")) as { seed?: string; width?: number };

    expect(manifest.counts.hexes).toBe(0);
    expect(hexSettings.seed).toBe("fixture-seed");
    expect(hexSettings.width).toBe(16);
    expect(validWithGenerated.ok).toBe(true);
  });

  it("fails when generated indexes are stale", async () => {
    const scenarioDir = await createScenarioFixture();
    await buildScenarioGeneratedIndexes(scenarioDir);
    await writeJson(join(scenarioDir, "map/hex-settings.json"), {
      ...createHexSettings(),
      seed: "changed-seed",
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
    region: { bohemia: { name: "Bohemia" } },
    country: { bohemia: { name: "Bohemia" } },
    good: { grain: { name: "Grain" } },
    modifier: { industrialProgram: { name: "Industrial program" } },
    decision: { legacy: { name: "Legacy decision" } },
    event: { legacy: { name: "Legacy", title: "Legacy", description: "Legacy", option: { ok: "OK" } } },
    arcawiki: { economy: { name: "Economy" } },
  });
  await writeJson(join(scenarioDir, "localisation/ru.json"), {
    scenario: { fixture: { name: "Fixture RU" } },
    region: { bohemia: { name: "Богемия" } },
    country: { bohemia: { name: "Богемия" } },
    good: { grain: { name: "Зерно" } },
    modifier: { industrialProgram: { name: "Промышленная программа" } },
    decision: { legacy: { name: "Legacy decision RU" } },
    event: { legacy: { name: "Legacy RU", title: "Legacy RU", description: "Legacy RU", option: { ok: "OK" } } },
    arcawiki: { economy: { name: "Экономика" } },
  });
  await writeJson(join(scenarioDir, "map/hex-settings.json"), createHexSettings());
  await writeJson(join(scenarioDir, "history/regions/bohemia.json"), {
    id: "region:bohemia",
    nameKey: "region.bohemia.name",
    color: "#22d3ee",
    hexIds: ["hex:0:0", "hex:0:1"],
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

function createHexSettings(): Record<string, unknown> {
  return {
    seed: "fixture-seed",
    width: 16,
    height: 12,
    hexSize: 24,
    seaLevel: 0.42,
    temperature: 0.5,
    moisture: 0.5,
    mountains: 0.78,
    rivers: 0.45,
    forests: 0.55,
    targetLandRegionSize: 8,
    targetWaterRegionSize: 12,
    chunkSize: 8,
    wrapX: true,
  };
}

async function writeJson(path: string, data: unknown): Promise<void> {
  const dir = path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
  await mkdir(dir, { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
