import { describe, expect, it } from "vitest";
import { buildAiCountryContext, buildAiWorldIndexes } from "./aiContext";
import { buildAiFixtureCountryContext, createAiFixtureWorld } from "./aiFixtureHarness";

const landlessResources = {
  culture: 0,
  science: 0,
  religion: 0,
  colonization: 0,
  construction: 5,
  ducats: 10,
  gold: 0,
};

describe("AI context builder", () => {
  it("builds deterministic country indexes from a world snapshot", () => {
    const world = createAiFixtureWorld({
      regionOwner: {
        "region:zeta": "country:alpha",
        "region:alpha": "country:alpha",
        "region:beta": "country:beta",
      },
      regionController: {
        "region:zeta": "country:beta",
        "region:alpha": "country:alpha",
        "region:beta": "country:beta",
      },
    });

    const indexes = buildAiWorldIndexes(world);

    expect(indexes.ownedRegionIdsByCountry["country:alpha"]).toEqual([
      "region:alpha",
      "region:zeta",
    ]);
    expect(indexes.controlledRegionIdsByCountry["country:beta"]).toEqual([
      "region:beta",
      "region:zeta",
    ]);
  });

  it("builds a country context from indexes without generating gameplay orders", () => {
    const context = buildAiFixtureCountryContext("country:alpha");

    expect(context).toMatchObject({
      countryId: "country:alpha",
      turnId: 1,
      ownedRegionIds: ["region:alpha-core"],
      controlledRegionIds: ["region:alpha-core"],
      constructionProjectCount: 1,
      diplomacyProposalCount: 0,
      divisionCount: 0,
    });
    expect(context.regions).toEqual([
      {
        regionId: "region:alpha-core",
        isOwned: true,
        isControlled: true,
        populationSize: 1000,
        buildingCount: 1,
        constructionProjectCount: 1,
        discoveredDepositCount: 1,
      },
    ]);
    expect("orders" in context).toBe(false);
  });

  it("handles landless countries with empty region context", () => {
    const world = createAiFixtureWorld({
      resourcesByCountry: { "country:landless": landlessResources },
    });
    const indexes = buildAiWorldIndexes(world);

    expect(
      buildAiCountryContext({ countryId: "country:landless", world, indexes }),
    ).toMatchObject({
      countryId: "country:landless",
      ownedRegionIds: [],
      controlledRegionIds: [],
      regions: [],
      constructionProjectCount: 0,
      diplomacyProposalCount: 0,
      divisionCount: 0,
    });
  });
});
