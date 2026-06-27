import type { DiplomacyProposal, ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import {
  applyPerTurnTreatyMoneyTransfers,
  applyTreatyClauses,
  applyTreatyMoneyTransferOnce,
  expireInfrastructureConstructionRightsForProposal,
  getAcceptedActiveTreatyProposals,
  getDiplomacyCounterpartyId,
  getTreatyDurationTurns,
  refreshExpiredDiplomacyProposals,
  serializeDiplomacyProposal,
  upsertInfrastructureRightsFromTreaty,
  type DiplomacyInfrastructureSettings,
  type DiplomacyResourceTransferWorldState,
} from "./diplomacyMechanics";

describe("diplomacyMechanics", () => {
  it("applies one treaty money transfer with available-resource cap", () => {
    const resourcesByCountry = {
      "country:a": makeResources({ ducats: 5 }),
      "country:b": makeResources({ ducats: 1 }),
    };

    const paid = applyTreatyMoneyTransferOnce({
      resourcesByCountry,
      fromCountryId: "country:a",
      toCountryId: "country:b",
      resource: "ducats",
      amount: 8,
      ensureCountryInWorldBase: () => undefined,
    });

    expect(paid).toBe(5);
    expect(resourcesByCountry["country:a"]?.ducats).toBe(0);
    expect(resourcesByCountry["country:b"]?.ducats).toBe(6);
  });

  it("applies only active accepted per-turn treaty transfers and returns results", () => {
    const ensured: string[] = [];
    const worldBase: DiplomacyResourceTransferWorldState = {
      resourcesByCountry: {
        "country:a": makeResources({ gold: 4, ducats: 10 }),
        "country:b": makeResources({ gold: 1, ducats: 0 }),
      },
      diplomacyProposals: [
        makeProposal({
          id: "proposal:active",
          status: "accepted",
          expiresTurnId: 5,
          clauses: [
            {
              id: "clause:gold",
              kind: "transfer_money",
              fromCountryId: "country:a",
              toCountryId: "country:b",
              resource: "gold",
              amount: 3,
              paymentCadence: "per_turn",
            },
          ],
        }),
        makeProposal({
          id: "proposal:once",
          status: "accepted",
          expiresTurnId: 5,
          clauses: [
            {
              id: "clause:once",
              kind: "transfer_money",
              fromCountryId: "country:a",
              toCountryId: "country:b",
              resource: "ducats",
              amount: 9,
              paymentCadence: "once",
            },
          ],
        }),
        makeProposal({ id: "proposal:expired", status: "accepted", expiresTurnId: 1 }),
        makeProposal({ id: "proposal:pending", status: "pending", expiresTurnId: 5 }),
      ],
    };

    const transfers = applyPerTurnTreatyMoneyTransfers({
      worldBase,
      turnId: 3,
      ensureCountryInWorldBase: (countryId) => {
        ensured.push(countryId);
      },
    });

    expect(transfers).toEqual([
      {
        proposalId: "proposal:active",
        clauseId: "clause:gold",
        fromCountryId: "country:a",
        toCountryId: "country:b",
        resource: "gold",
        requested: 3,
        paid: 3,
      },
    ]);
    expect(ensured).toEqual(["country:a", "country:b"]);
    expect(worldBase.resourcesByCountry["country:a"]?.gold).toBe(1);
    expect(worldBase.resourcesByCountry["country:b"]?.gold).toBe(4);
    expect(worldBase.resourcesByCountry["country:a"]?.ducats).toBe(10);
  });

  it("filters active accepted treaty proposals", () => {
    expect(
      getAcceptedActiveTreatyProposals(
        [
          makeProposal({ id: "active", status: "accepted", expiresTurnId: 3 }),
          makeProposal({ id: "expired", status: "accepted", expiresTurnId: 1 }),
          makeProposal({ id: "pending", status: "pending", expiresTurnId: 3 }),
        ],
        2,
      ).map((proposal) => proposal.id),
    ).toEqual(["active"]);
  });

  it("handles treaty duration, serialization, and counterparty helpers", () => {
    const proposal = makeProposal({
      fromCountryId: "country:a",
      toCountryId: "country:b",
      createdTurnId: 5,
      expiresTurnId: 5,
    });

    const serialized = serializeDiplomacyProposal(proposal);
    serialized.name = "Changed";

    expect(getTreatyDurationTurns(proposal)).toBe(1);
    expect(getDiplomacyCounterpartyId(proposal, "country:a")).toBe("country:b");
    expect(getDiplomacyCounterpartyId(proposal, "country:b")).toBe("country:a");
    expect(proposal.name).toBe("Treaty");
  });

  it("expires pending proposals and moves expired accepted proposals to renewal pending", () => {
    const expiredPending = makeProposal({ id: "pending", status: "pending", expiresTurnId: 1 });
    const expiredAccepted = makeProposal({ id: "accepted", status: "accepted", expiresTurnId: 1 });
    const activeAccepted = makeProposal({ id: "active", status: "accepted", expiresTurnId: 3 });
    const upserted: string[] = [];
    const expiredRights: string[] = [];

    const result = refreshExpiredDiplomacyProposals({
      proposals: [expiredPending, expiredAccepted, activeAccepted],
      turnId: 2,
      normalizeDiplomacyProposals: (input) => input as DiplomacyProposal[],
      upsertInfrastructureRightsFromTreaty: (proposal) => upserted.push(proposal.id),
      expireInfrastructureConstructionRightsForProposal: (proposal) => expiredRights.push(proposal.id),
      nowIso: "2026-01-02T00:00:00.000Z",
    });

    expect(result.changed).toBe(true);
    expect(result.proposals.map((proposal) => [proposal.id, proposal.status])).toEqual([
      ["pending", "expired"],
      ["accepted", "renewal_pending"],
      ["active", "accepted"],
    ]);
    expect(result.proposals[0]?.failureReason).toBe("EXPIRED");
    expect(result.proposals[1]?.renewalAcceptedByCountryIds).toEqual([]);
    expect(upserted).toEqual(["active"]);
    expect(expiredRights).toEqual(["accepted"]);
  });

  it("upserts infrastructure treaty rights using normalized transport modes", () => {
    const settings = makeInfrastructureSettings();
    const proposal = makeProposal({
      status: "accepted",
      expiresTurnId: 5,
      clauses: [
        {
          id: "transit",
          kind: "infrastructure_transit",
          fromCountryId: "country:a",
          toCountryId: "country:b",
          transportModes: ["land", "sea"],
        },
        {
          id: "construction",
          kind: "infrastructure_construction_rights",
          fromCountryId: "country:a",
          toCountryId: "country:b",
          transportModes: ["air"],
          expirationPolicy: "disable_without_transit",
        },
      ],
    });

    upsertInfrastructureRightsFromTreaty({
      proposal,
      turnId: 2,
      gameSettings: settings,
      normalizeTransportModes: (input) => (Array.isArray(input) ? input.map(String) : ["land"]),
      nowIso: "2026-01-02T00:00:00.000Z",
    });

    expect(settings.markets.infrastructureTransitAgreementsById["treaty-proposal:test-transit"]).toMatchObject({
      active: true,
      transportModes: ["land", "sea"],
      sourceClauseId: "transit",
    });
    expect(
      settings.markets.infrastructureConstructionRightsById["treaty-proposal:test-construction"],
    ).toMatchObject({
      active: true,
      transportModes: ["air"],
      expirationPolicy: "disable_without_transit",
    });
  });

  it("expires construction rights and nationalizes matching foreign-built corridors", () => {
    const settings = makeInfrastructureSettings({
      transportCorridorsById: {
        "corridor:a": {
          ownerCountryId: "country:b",
          transportMode: "land",
          foreignConstructionRights: [
            {
              grantorCountryId: "country:a",
              expirationPolicy: "nationalize_to_territory_owner",
              sourceProposalId: "proposal:test",
              sourceClauseId: "construction",
            },
          ],
        },
      },
      infrastructureConstructionRightsById: {
        "treaty-proposal:test-construction": {
          id: "treaty-proposal:test-construction",
          fromCountryId: "country:a",
          toCountryId: "country:b",
          transportModes: ["land"],
          active: true,
          bilateral: false,
          expirationPolicy: "nationalize_to_territory_owner",
          sourceProposalId: "proposal:test",
          sourceClauseId: "construction",
          expiresTurnId: 2,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    });
    const proposal = makeProposal({
      clauses: [
        {
          id: "construction",
          kind: "infrastructure_construction_rights",
          fromCountryId: "country:a",
          toCountryId: "country:b",
          transportModes: ["land"],
          expirationPolicy: "nationalize_to_territory_owner",
        },
      ],
    });

    expireInfrastructureConstructionRightsForProposal({
      proposal,
      gameSettings: settings,
      nowIso: "2026-01-03T00:00:00.000Z",
    });

    expect(settings.markets.infrastructureConstructionRightsById["treaty-proposal:test-construction"]?.active).toBe(
      false,
    );
    expect(settings.markets.transportCorridorsById["corridor:a"]).toMatchObject({
      ownerCountryId: "country:a",
      nationalizedFromCountryId: "country:b",
      nationalizedAt: "2026-01-03T00:00:00.000Z",
      foreignConstructionRights: [],
    });
  });

  it("applies treaty clauses through normal world state mutations", () => {
    const settings = makeInfrastructureSettings();
    const worldBase = {
      resourcesByCountry: {
        "country:a": makeResources({ ducats: 6 }),
        "country:b": makeResources({ ducats: 2 }),
      },
      regionOwner: { "region:a": "country:a" },
      regionController: { "region:a": "country:a" },
      regionBuildingsByRegion: {},
      colonyProgressByRegion: { "region:a": { "country:a": 5 } },
    };
    const ensured: string[] = [];

    applyTreatyClauses({
      proposal: makeProposal({
        expiresTurnId: 4,
        clauses: [
          {
            id: "money",
            kind: "transfer_money",
            fromCountryId: "country:a",
            toCountryId: "country:b",
            resource: "ducats",
            amount: 4,
            paymentCadence: "once",
          },
          {
            id: "region",
            kind: "transfer_region",
            fromCountryId: "country:a",
            toCountryId: "country:b",
            regionId: "region:a",
          },
          {
            id: "transit",
            kind: "infrastructure_transit",
            fromCountryId: "country:a",
            toCountryId: "country:b",
            transportModes: ["land"],
          },
        ],
      }),
      worldBase,
      gameSettings: settings,
      ensureCountryInWorldBase: (countryId) => ensured.push(countryId),
      normalizeTransportModes: (input) => (Array.isArray(input) ? input.map(String) : ["land"]),
      nowIso: "2026-01-02T00:00:00.000Z",
    });

    expect(ensured).toEqual(["country:a", "country:b"]);
    expect(worldBase.resourcesByCountry["country:a"]?.ducats).toBe(2);
    expect(worldBase.resourcesByCountry["country:b"]?.ducats).toBe(6);
    expect(worldBase.regionOwner["region:a"]).toBe("country:b");
    expect(worldBase.colonyProgressByRegion["region:a"]).toBeUndefined();
    expect(settings.markets.infrastructureTransitAgreementsById["treaty-proposal:test-transit"]).toMatchObject({
      active: true,
      expiresTurnId: 4,
    });
  });
});

function makeResources(overrides?: Partial<ResourceTotals>): ResourceTotals {
  return {
    culture: 0,
    science: 0,
    religion: 0,
    colonization: 0,
    construction: 0,
    ducats: 0,
    gold: 0,
    ...overrides,
  };
}

function makeProposal(overrides?: Partial<DiplomacyProposal>): DiplomacyProposal {
  return {
    id: "proposal:test",
    name: "Treaty",
    fromCountryId: "country:a",
    toCountryId: "country:b",
    createdTurnId: 1,
    expiresTurnId: 3,
    status: "pending",
    clauses: [],
    revision: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    resolvedAt: null,
    resolvedByCountryId: null,
    failureReason: null,
    renewalAcceptedByCountryIds: [],
    ...overrides,
  };
}

function makeInfrastructureSettings(
  overrides?: Partial<DiplomacyInfrastructureSettings["markets"]>,
): DiplomacyInfrastructureSettings {
  return {
    markets: {
      infrastructureTransitAgreementsById: {},
      infrastructureConstructionRightsById: {},
      transportCorridorsById: {},
      ...overrides,
    },
  };
}
