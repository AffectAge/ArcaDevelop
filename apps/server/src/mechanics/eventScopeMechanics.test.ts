import { describe, expect, it } from "vitest";
import { resolveEventScopes } from "./eventScopeMechanics";

describe("eventScopeMechanics", () => {
  it("resolves a deterministic controlled region scope using filters and pick rules", () => {
    const result = resolveEventScopes({
      countryId: "country:a",
      scope: {
        root: { kind: "country" },
        region: {
          kind: "region",
          from: "root.controlled_regions",
          where: { type: "region_population_above", value: 500 },
          pick: { orderBy: "population", direction: "desc" },
        },
      },
      worldBase: {
        resourcesByCountry: { "country:a": makeResources() },
        resourceLedgerByTurn: {},
        regionOwner: { "region:small": "country:a", "region:large": "country:a" },
        regionController: { "region:small": "country:a", "region:large": "country:a" },
        regionColonizationByRegion: {},
        colonyProgressByRegion: {},
        regionResourceDepositsByRegion: {},
        regionPopulationByRegion: {
          "region:small": makeRegionPopulation(600),
          "region:large": makeRegionPopulation(1800),
        },
        regionBuildingsByRegion: {},
      },
    });

    expect(result?.scopes).toMatchObject({
      root: { kind: "country", id: "country:a" },
      region: { kind: "region", id: "region:large" },
    });
    expect(result?.explanations).toHaveLength(2);
  });
});

function makeResources() {
  return {
    culture: 0,
    science: 0,
    religion: 0,
    colonization: 0,
    construction: 0,
    ducats: 0,
    gold: 0,
  };
}

function makeRegionPopulation(size: number) {
  return {
    pops: [{ id: `pop:${size}`, size, cultureId: "culture:a", religionId: "religion:a", raceId: "race:a", ideologies: {}, professions: {} }],
  };
}
