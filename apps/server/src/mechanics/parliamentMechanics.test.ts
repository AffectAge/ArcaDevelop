import type { CountryParliament, CountryParliamentPowerBill, PopulationProfessionState, ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  allocateSeats,
  canEnactLawWithoutVote,
  calculateBillVote,
  calculatePowerBillVote,
  calculateCountryInterestGroups,
  ensureCountryParliament,
  getParliamentPowerScore,
  getParliamentPowersFromActiveLaws,
  normalizeLawParliamentPowerEffect,
  normalizeParliamentPowers,
  resolveParliamentTurn,
  runCountryElection,
  type ParliamentContentEntry,
  type ParliamentWorldState,
} from "./parliamentMechanics";

describe("parliamentMechanics", () => {
  it("normalizes parliament powers and clamps invalid threshold values", () => {
    expect(
      normalizeParliamentPowers({
        laws: "advisory",
        budget: "invalid",
        diplomacy: "ratify_all",
        war: "declare",
        government: "appoint_government",
        moneyTransferRatificationThreshold: -1,
      }),
    ).toEqual({
      laws: "advisory",
      budget: "approve_budget",
      diplomacy: "ratify_all",
      war: "declare",
      government: "appoint_government",
      moneyTransferRatificationThreshold: null,
    });
  });

  it("normalizes law parliament power effects and ignores unknown domains", () => {
    expect(
      normalizeLawParliamentPowerEffect({
        domain: "diplomacy",
        value: "ratify_all",
        moneyTransferRatificationThreshold: 1234.6,
      }),
    ).toEqual({
      domain: "diplomacy",
      value: "ratify_all",
      moneyTransferRatificationThreshold: 1235,
    });

    expect(normalizeLawParliamentPowerEffect({ domain: "unknown", value: "none" })).toBeNull();
  });

  it("derives active parliament powers from active laws", () => {
    const powers = getParliamentPowersFromActiveLaws(
      {
        "law-group:assembly": "law:assembly",
        "law-group:diplomacy": "law:diplomacy",
      },
      [
        makeEntry({
          id: "law:assembly",
          parliamentPower: { domain: "laws", value: "initiate" },
        }),
        makeEntry({
          id: "law:diplomacy",
          parliamentPower: {
            domain: "diplomacy",
            value: "ratify_all",
            moneyTransferRatificationThreshold: 5000,
          },
        }),
      ],
    );

    expect(powers).toMatchObject({
      laws: "initiate",
      diplomacy: "ratify_all",
      moneyTransferRatificationThreshold: 5000,
    });
  });

  it("checks whether laws can be enacted without a binding vote", () => {
    expect(canEnactLawWithoutVote(makeParliament({ powers: normalizeParliamentPowers({ laws: "advisory" }) }))).toBe(true);
    expect(canEnactLawWithoutVote(makeParliament({ powers: normalizeParliamentPowers({ laws: "approve" }) }))).toBe(false);
  });

  it("calculates party and interest group support for law votes", () => {
    const parliament = makeParliament({
      activeLawByGroupId: { "law-group:tax": "law:old-tax" },
      partySeats: [
        makePartySeats({ partyId: "party:government", seats: 60 }),
        makePartySeats({ partyId: "party:opposition", seats: 40 }),
      ],
      governmentPartyIds: ["party:government"],
      interestGroups: [
        {
          groupId: "interest-group:merchants",
          clout: 0.5,
          rawPower: 50,
          loyalists: 0,
          radicals: 0,
        },
      ],
    });

    const bill = calculateBillVote({
      parliament,
      law: makeEntry({ id: "law:new-tax", lawGroupId: "law-group:tax" }),
      parties: [
        makeEntry({
          id: "party:government",
          discipline: 1,
          lawPreferences: { "law:new-tax": 4, "law:old-tax": 0 },
          interestGroupWeights: { "interest-group:merchants": 100 },
        }),
        makeEntry({
          id: "party:opposition",
          discipline: 1,
          lawPreferences: { "law:new-tax": -10, "law:old-tax": 0 },
        }),
      ],
      interestGroups: [makeEntry({ id: "interest-group:merchants", lawPreferences: { "law:new-tax": 8 } })],
      turnId: 12,
    });

    expect(bill).toMatchObject({
      lawId: "law:new-tax",
      startedTurnId: 12,
      progress: 0,
      yesSeats: 60,
      noSeats: 40,
      abstainSeats: 0,
      status: "debating",
    });
  });

  it("preserves existing bill timing when recalculating the same law", () => {
    const bill = calculateBillVote({
      parliament: makeParliament(),
      law: makeEntry({ id: "law:target", lawGroupId: "law-group:test" }),
      parties: [makeEntry({ id: "party:government", discipline: 1, lawPreferences: { "law:target": 10 } })],
      interestGroups: [],
      turnId: 20,
      existingBill: {
        lawId: "law:target",
        startedTurnId: 7,
        progress: 45,
        yesSeats: 0,
        noSeats: 0,
        abstainSeats: 100,
        status: "debating",
      },
    });

    expect(bill.startedTurnId).toBe(7);
    expect(bill.progress).toBe(45);
  });

  it("calculates power bill support from power score changes", () => {
    const bill = calculatePowerBillVote({
      parliament: makeParliament({
        powers: normalizeParliamentPowers({ laws: "approve", budget: "approve_budget" }),
        partySeats: [
          makePartySeats({ partyId: "party:government", seats: 60 }),
          makePartySeats({ partyId: "party:opposition", seats: 40 }),
        ],
        governmentPartyIds: ["party:government"],
      }),
      bill: makePowerBill({
        proposedPowers: normalizeParliamentPowers({ laws: "initiate", budget: "control_budget", diplomacy: "ratify_all" }),
      }),
      parties: [
        makeEntry({ id: "party:government", discipline: 1 }),
        makeEntry({ id: "party:opposition", discipline: 1 }),
      ],
    });

    expect(bill).toMatchObject({
      yesSeats: 100,
      noSeats: 0,
      abstainSeats: 0,
      status: "debating",
    });
    expect(getParliamentPowerScore(bill.proposedPowers)).toBeGreaterThan(getParliamentPowerScore(normalizeParliamentPowers({ laws: "approve" })));
  });

  it("allocates seats by largest remainder and handles no-score elections", () => {
    expect(Object.fromEntries(allocateSeats([{ partyId: "party:a", score: 2 }, { partyId: "party:b", score: 1 }], 5))).toEqual({
      "party:a": 3,
      "party:b": 2,
    });
    expect(Object.fromEntries(allocateSeats([{ partyId: "party:a", score: 0 }, { partyId: "party:b", score: 0 }], 5))).toEqual({
      "party:a": 3,
      "party:b": 2,
    });
  });

  it("calculates interest group clout from population professions and buildings", () => {
    const groups = calculateCountryInterestGroups({
      countryId: "country:a",
      groups: [
        makeEntry({
          id: "interest-group:labor",
          basePoliticalStrength: 0,
          professionWeights: { workers: 100 },
          defaultPartyId: "party:labor",
        }),
        makeEntry({
          id: "interest-group:industry",
          basePoliticalStrength: 0,
          buildingWeights: { "building:factory": 2 },
        }),
      ],
      regionControllerByRegion: { "region:a": "country:a", "region:b": "country:b" },
      regionPopulationByRegion: {
        "region:a": {
          pops: [
            {
              id: "pop:a",
              size: 1000,
              cultureId: "culture:a",
              religionId: "religion:a",
              raceId: "race:a",
              ideologies: {},
              professions: {
                workers: makeProfession({ size: 100, radicals: 10, loyalists: 20 }),
              },
            },
          ],
        },
      },
      regionBuildingsByRegion: {
        "region:a": [
          {
            instanceId: "building-instance:a",
            buildingId: "building:factory",
            targetHexId: "hex:0:0",
            owner: { type: "state", countryId: "country:a" },
            createdTurnId: 1,
            level: 2,
          },
        ],
      },
    });

    expect(groups.map((group) => group.groupId)).toEqual(["interest-group:industry", "interest-group:labor"]);
    expect(groups.find((group) => group.groupId === "interest-group:labor")).toMatchObject({
      loyalists: 20,
      radicals: 10,
      supportedPartyId: "party:labor",
    });
  });

  it("runs elections and preserves current bills for a country", () => {
    const worldBase = makeWorld({
      regionOwner: { "region:a": "country:a" },
      regionPopulationByRegion: {
        "region:a": {
          pops: [
            {
              id: "pop:a",
              size: 100,
              cultureId: "culture:a",
              religionId: "religion:a",
              raceId: "race:a",
              ideologies: { "ideology:liberal": 100 },
              professions: {},
            },
          ],
        },
      },
      parliamentByCountry: {
        "country:a": makeParliament({
          currentBills: [
            {
              lawId: "law:target",
              startedTurnId: 2,
              progress: 20,
              yesSeats: 0,
              noSeats: 0,
              abstainSeats: 100,
              status: "debating",
            },
          ],
        }),
      },
    });

    const parliament = runCountryElection({
      countryId: "country:a",
      worldBase,
      content: makeContent(),
      turnId: 5,
      createId: () => "power-bill:generated",
    });

    expect(parliament.lastElectionTurn).toBe(5);
    expect(parliament.nextElectionTurn).toBe(13);
    expect(parliament.partySeats.reduce((sum, row) => sum + row.seats, 0)).toBe(100);
    expect(parliament.currentBill?.lawId).toBe("law:target");
    expect(parliament.activeLawByGroupId["law-group:test"]).toBe("law:old");
  });

  it("ensures missing parliament and resolves passing law bills through the shared mechanic", () => {
    const worldBase = makeWorld({
      resourcesByCountry: { "country:a": makeResources() },
      regionOwner: { "region:a": "country:a" },
      regionPopulationByRegion: {
        "region:a": {
          pops: [
            {
              id: "pop:a",
              size: 100,
              cultureId: "culture:a",
              religionId: "religion:a",
              raceId: "race:a",
              ideologies: { "ideology:liberal": 100 },
              professions: {},
            },
          ],
        },
      },
    });

    const parliament = ensureCountryParliament({
      countryId: "country:a",
      worldBase,
      content: makeContent(),
      turnId: 1,
      createId: () => "power-bill:generated",
    });
    parliament.currentBills = [
      {
        lawId: "law:target",
        startedTurnId: 1,
        progress: 90,
        yesSeats: 0,
        noSeats: 0,
        abstainSeats: 100,
        status: "debating",
      },
    ];
    parliament.currentBill = parliament.currentBills[0];

    const electionResults = resolveParliamentTurn({
      worldBase,
      content: makeContent(),
      turnId: 2,
      createId: () => "power-bill:generated",
    });

    expect(electionResults).toEqual([]);
    expect(worldBase.parliamentByCountry["country:a"]?.activeLawByGroupId["law-group:test"]).toBe("law:target");
    expect(worldBase.parliamentByCountry["country:a"]?.currentBills).toEqual([]);
  });
});

function makeEntry(overrides?: Partial<ParliamentContentEntry>): ParliamentContentEntry {
  return {
    id: "entry:test",
    ...overrides,
  };
}

function makePartySeats(overrides?: Partial<CountryParliament["partySeats"][number]>): CountryParliament["partySeats"][number] {
  return {
    partyId: "party:government",
    seats: 100,
    voteShare: 1,
    ideologySupport: 1,
    ...overrides,
  };
}

function makeParliament(overrides?: Partial<CountryParliament>): CountryParliament {
  return {
    seatsTotal: 100,
    lastElectionTurn: 1,
    nextElectionTurn: 9,
    partySeats: [makePartySeats()],
    governmentPartyIds: ["party:government"],
    interestGroups: [],
    powers: normalizeParliamentPowers({}),
    currentPowerBills: [],
    activeLawByGroupId: {},
    currentBills: [],
    currentBill: null,
    ...overrides,
  };
}

function makePowerBill(overrides?: Partial<CountryParliamentPowerBill>): CountryParliamentPowerBill {
  return {
    id: "power-bill:test",
    title: "Power bill",
    startedTurnId: 1,
    progress: 0,
    yesSeats: 0,
    noSeats: 0,
    abstainSeats: 100,
    status: "debating",
    proposedPowers: normalizeParliamentPowers({ laws: "initiate" }),
    ...overrides,
  };
}

function makeProfession(overrides?: Partial<PopulationProfessionState>): PopulationProfessionState {
  return {
    size: 0,
    standardOfLiving: 0,
    ducats: 0,
    radicals: 0,
    loyalists: 0,
    lastIncomeDucats: 0,
    lastNeedsSpendDucats: 0,
    lastNeedsSatisfaction: 0,
    lastBirths: 0,
    lastDeaths: 0,
    ...overrides,
  };
}

function makeContent(): {
  laws: ParliamentContentEntry[];
  lawGroups: ParliamentContentEntry[];
  parties: ParliamentContentEntry[];
  interestGroups: ParliamentContentEntry[];
} {
  return {
    laws: [
      makeEntry({ id: "law:old", name: "Old law", lawGroupId: "law-group:test", order: 1 }),
      makeEntry({ id: "law:target", name: "Target law", lawGroupId: "law-group:test", order: 2, votingDurationTurns: 3 }),
    ],
    lawGroups: [makeEntry({ id: "law-group:test", defaultLawId: "law:old" })],
    parties: [
      makeEntry({
        id: "party:government",
        discipline: 1,
        ideologyWeights: { "ideology:liberal": 100 },
        lawPreferences: { "law:target": 10, "law:old": 0 },
      }),
      makeEntry({
        id: "party:opposition",
        discipline: 1,
        ideologyWeights: { "ideology:conservative": 100 },
        lawPreferences: { "law:target": -10, "law:old": 0 },
      }),
    ],
    interestGroups: [],
  };
}

function makeWorld(overrides?: Partial<ParliamentWorldState>): ParliamentWorldState {
  return {
    resourcesByCountry: {},
    parliamentByCountry: {},
    regionOwner: {},
    regionController: {},
    regionPopulationByRegion: {},
    regionBuildingsByRegion: {},
    ...overrides,
  };
}

function makeResources(): ResourceTotals {
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
