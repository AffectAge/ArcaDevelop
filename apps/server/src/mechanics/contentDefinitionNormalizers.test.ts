import { describe, expect, it } from "vitest";
import {
  normalizeDecision,
  normalizeDecisionEffects,
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
        { type: "resource_delta", resource: "bad", amount: 10 },
      ]),
    ).toEqual([{ type: "resource_delta", resource: "ducats", amount: 5.123 }]);

    expect(
      normalizeDecision({
        category: "economy",
        cooldownTurns: 2.9,
        repeatable: true,
        costs: { gold: 2.3456, ducats: -1 },
        effects: [{ type: "resource_delta", resource: "science", amount: 3 }],
      }),
    ).toMatchObject({
      category: "economy",
      cooldownTurns: 2,
      repeatable: true,
      costs: { gold: 2.346 },
      effects: [{ type: "resource_delta", resource: "science", amount: 3 }],
    });
  });

  it("normalizes game events with fallback option and bounded chance", () => {
    expect(
      normalizeGameEvent({
        category: "military",
        priority: "high",
        visibility: "public",
        checkIntervalTurns: 0,
        chancePct: 155,
        options: [],
      }),
    ).toMatchObject({
      category: "military",
      priority: "high",
      visibility: "public",
      checkIntervalTurns: 1,
      chancePct: 100,
      options: [{ id: "ok", label: "Понятно", autoChancePct: 100 }],
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
