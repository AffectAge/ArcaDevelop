import { describe, expect, it } from "vitest";
import {
  normalizeDecision,
  normalizeDecisionEffects,
  normalizeGameEffects,
  normalizeEventTrigger,
  normalizeGameEvent,
  normalizeIdeologyAttractionRules,
  normalizeModifierConditions,
  normalizeModifiers,
} from "./contentDefinitionNormalizers";

describe("contentDefinitionNormalizers", () => {
  it("normalizes modifier conditions and filters invalid modifier effects", () => {
    expect(
      normalizeModifierConditions([
        { type: "always" },
        { type: "law_active", targetId: " law:tax ", invert: true },
        { type: "law_active" },
      ]),
    ).toEqual([
      { type: "always", targetId: null, invert: false },
      { type: "law_active", targetId: "law:tax", invert: true },
    ]);

    expect(
      normalizeModifiers([
        {
          id: " mod:a ",
          label: " Output ",
          scope: "building",
          conditions: [{ type: "technology_researched", targetId: "tech:a" }],
          effects: [
            { stat: "building_output", mode: "mult", value: 1.23456, target: { goodId: "good:grain" } },
            { stat: "unknown", mode: "mult", value: 1 },
          ],
        },
      ]),
    ).toEqual([
      {
        id: "mod:a",
        label: "Output",
        scope: "building",
        conditions: [{ type: "technology_researched", targetId: "tech:a", invert: false }],
        effects: [
          {
            stat: "building_output",
            mode: "mult",
            value: 1.235,
            target: { buildingId: null, goodId: "good:grain", professionId: null, resourceCategoryId: null },
          },
        ],
      },
    ]);
  });

  it("normalizes decisions and resource effects", () => {
    expect(
      normalizeDecisionEffects([
        { type: "resource_delta", resource: "ducats", amount: 5.1234 },
        { type: "trigger_event", eventId: " event:test " },
        { type: "start_journal_entry", journalEntryId: " journal:test " },
        { type: "resource_delta", resource: "bad", amount: 10 },
      ]),
    ).toEqual([
      { type: "resource_delta", resource: "ducats", amount: 5.123 },
      { type: "trigger_event", eventId: "event:test" },
      { type: "start_journal_entry", journalEntryId: "journal:test" },
    ]);

    expect(
      normalizeDecision({
        category: "economy",
        scope: { region: { kind: "region", from: "root.controlled_regions", where: { type: "region_has_population_above", value: 1000 } } },
        potential: { type: "country_resource_above", resource: "ducats", value: 10 },
        allow: { type: "treasury_below", value: 100 },
        visibleWhenUnavailable: true,
        maxUses: 2,
        maxUsesPerTarget: 1,
        cooldownTurns: 2.9,
        repeatable: true,
        costs: { gold: 2.3456, ducats: -1 },
        effects: [{ type: "resource_delta", resource: "science", amount: 3 }],
      }),
    ).toMatchObject({
      category: "economy",
      scope: { root: { kind: "country" }, region: { kind: "region", from: "root.controlled_regions", where: { type: "region_has_population_above", value: 1000 }, pick: { orderBy: "regionId", direction: "asc" } } },
      potential: { type: "country_resource_above", resource: "ducats", value: 10 },
      allow: { type: "treasury_below", value: 100 },
      visibleWhenUnavailable: true,
      maxUses: 2,
      maxUsesPerTarget: 1,
      cooldownTurns: 2,
      repeatable: true,
      costs: { gold: 2.346 },
      effects: [{ type: "resource_delta", resource: "science", amount: 3 }],
    });
  });

  it("normalizes game resource effects", () => {
    expect(
      normalizeGameEffects([
        { type: "add_resource", resource: "ducats", amount: 5.1234, labelKey: "resourceLedger.source.event" },
        { type: "spend_resource", resource: "bad", amount: 10 },
        { type: "add_resource_flow", resource: "science", amount: 2, direction: "income", labelKey: "resourceLedger.source.event" },
      ]),
    ).toEqual([
      { type: "add_resource", resource: "ducats", amount: 5.123, labelKey: "resourceLedger.source.event" },
      {
        type: "add_resource_flow",
        resource: "science",
        amount: 2,
        direction: "income",
        categoryId: null,
        labelKey: "resourceLedger.source.event",
      },
    ]);
  });

  it("normalizes game modifier effects", () => {
    expect(
      normalizeGameEffects([
        { type: "add_modifier", modifierId: " modifier:test ", durationTurns: 3.8 },
        { type: "add_modifier", modifierId: "modifier:permanent" },
        { type: "remove_modifier", modifierId: " modifier:old " },
        { type: "extend_modifier", modifierId: " modifier:test ", durationTurns: 2.2 },
        { type: "extend_modifier", modifierId: "modifier:bad", durationTurns: 0 },
        { type: "add_modifier", modifierId: "" },
      ]),
    ).toEqual([
      { type: "add_modifier", modifierId: "modifier:test", durationTurns: 3 },
      { type: "add_modifier", modifierId: "modifier:permanent", durationTurns: null },
      { type: "remove_modifier", modifierId: "modifier:old" },
      { type: "extend_modifier", modifierId: "modifier:test", durationTurns: 2 },
    ]);
  });

  it("normalizes region game effects", () => {
    expect(
      normalizeGameEffects([
        { type: "change_colonization_progress", amount: 12.3456 },
        { type: "change_colonization_progress", amount: 0 },
      ]),
    ).toEqual([{ type: "change_colonization_progress", amount: 12.346 }]);
  });

  it("normalizes region colonization progress triggers", () => {
    expect(normalizeEventTrigger({ type: "region_colonization_progress_above", value: 25.456 })).toEqual({
      type: "region_colonization_progress_above",
      value: 25.456,
    });
    expect(normalizeEventTrigger({ type: "region_colonization_progress_below", value: 0 })).toEqual({
      type: "region_colonization_progress_below",
      value: 0,
    });
    expect(normalizeEventTrigger({ type: "region_colonization_progress_above", value: "25" })).toBeNull();
  });

  it("normalizes region resource deposit triggers", () => {
    expect(normalizeEventTrigger({ type: "region_has_resource_deposit", targetId: " good:iron " })).toEqual({
      type: "region_has_resource_deposit",
      targetId: "good:iron",
    });
  });

  it("normalizes region colonizable triggers", () => {
    expect(normalizeEventTrigger({ type: "region_is_colonizable" })).toEqual({
      type: "region_is_colonizable",
    });
  });

  it("normalizes region population stress triggers", () => {
    expect(normalizeEventTrigger({ type: "region_radicals_above", value: 25.456 })).toEqual({
      type: "region_radicals_above",
      value: 25.456,
    });
    expect(normalizeEventTrigger({ type: "region_loyalists_above", value: 10 })).toEqual({
      type: "region_loyalists_above",
      value: 10,
    });
    expect(normalizeEventTrigger({ type: "region_standard_of_living_below", value: 8.5 })).toEqual({
      type: "region_standard_of_living_below",
      value: 8.5,
    });
    expect(normalizeEventTrigger({ type: "region_radicals_above", value: "25" })).toBeNull();
  });

  it("normalizes building economy triggers", () => {
    expect(normalizeEventTrigger({ type: "building_profit_below", value: -5 })).toEqual({
      type: "building_profit_below",
      value: -5,
    });
    expect(normalizeEventTrigger({ type: "building_employment_below", value: 0.5 })).toEqual({
      type: "building_employment_below",
      value: 0.5,
    });
    expect(normalizeEventTrigger({ type: "building_output_above", targetId: " good:tools ", value: 10 })).toEqual({
      type: "building_output_above",
      targetId: "good:tools",
      value: 10,
    });
    expect(normalizeEventTrigger({ type: "building_profit_below", value: "0" })).toBeNull();
    expect(normalizeEventTrigger({ type: "building_output_above", value: 10 })).toBeNull();
  });

  it("normalizes controlled foreign region triggers", () => {
    expect(normalizeEventTrigger({ type: "controls_foreign_region" })).toEqual({
      type: "controls_foreign_region",
    });
  });

  it("normalizes negative resource flow triggers", () => {
    expect(normalizeEventTrigger({ type: "resource_flow_negative", resource: "ducats" })).toEqual({
      type: "resource_flow_negative",
      resource: "ducats",
    });
    expect(normalizeEventTrigger({ type: "resource_flow_negative", resource: "unknown" })).toBeNull();
  });

  it("normalizes game events with key-based options and bounded chance", () => {
    expect(
      normalizeGameEvent({
        namespace: "test",
        category: "military",
        priority: "high",
        visibility: "public",
        titleKey: "events.test.name",
        descriptionKey: "events.test.description",
        checkIntervalTurns: 0,
        chancePct: 155,
        options: [
          {
            id: "ok",
            labelKey: "events.test.option.ok",
            buttonTone: "primary",
            aiWeight: [
              { base: 2.3456 },
              { if: { type: "country_resource_above", resource: "ducats", value: 10 }, add: 5, multiply: 1.5 },
            ],
          },
        ],
      }),
    ).toMatchObject({
      namespace: "test",
      category: "military",
      priority: "high",
      visibility: "public",
      titleKey: "events.test.name",
      descriptionKey: "events.test.description",
      checkIntervalTurns: 1,
      chancePct: 100,
      options: [
        {
          id: "ok",
          labelKey: "events.test.option.ok",
          buttonTone: "primary",
          aiWeight: [
            { base: 2.346 },
            { if: { type: "country_resource_above", resource: "ducats", value: 10 }, add: 5, multiply: 1.5 },
          ],
        },
      ],
    });
  });

  it("normalizes ideology attraction rules with unique IDs", () => {
    expect(
      normalizeIdeologyAttractionRules([
        { id: "rule:a", type: "sol_below", weight: 1.2345, threshold: 8.8888 },
        { id: "rule:a", type: "profession_is", weight: 2, targetId: "profession:workers" },
        { type: "bad", weight: 1 },
      ]),
    ).toEqual([
      {
        id: "rule:a",
        type: "sol_below",
        weight: 1.234,
        threshold: 8.889,
        targetId: null,
        label: null,
        invert: null,
      },
      {
        id: "rule:a:2",
        type: "profession_is",
        weight: 2,
        threshold: null,
        targetId: "profession:workers",
        label: null,
        invert: null,
      },
    ]);
  });
});
