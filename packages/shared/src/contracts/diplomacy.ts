export type TreatyTransportMode = "land" | "sea" | "air" | "pipeline" | "powerGrid";
export type TreatyConstructionExpirationPolicy = "disable_without_transit" | "nationalize_to_territory_owner";
export type TreatyClauseKind = "transfer_money" | "transfer_region" | "infrastructure_transit" | "infrastructure_construction_rights" | "text_note";
export type TreatyMoneyResource = "ducats" | "gold";
export type TreatyMoneyPaymentCadence = "once" | "per_turn";

export type TreatyClause =
  | {
      id: string;
      kind: "transfer_money";
      fromCountryId: string;
      toCountryId: string;
      resource: TreatyMoneyResource;
      amount: number;
      paymentCadence: TreatyMoneyPaymentCadence;
    }
  | {
      id: string;
      kind: "transfer_region";
      fromCountryId: string;
      toCountryId: string;
      regionId: string;
    }
  | {
      id: string;
      kind: "infrastructure_transit";
      fromCountryId: string;
      toCountryId: string;
      transportModes: TreatyTransportMode[];
    }
  | {
      id: string;
      kind: "infrastructure_construction_rights";
      fromCountryId: string;
      toCountryId: string;
      transportModes: TreatyTransportMode[];
      expirationPolicy: TreatyConstructionExpirationPolicy;
    }
  | {
      id: string;
      kind: "text_note";
      text: string;
    };

export type DiplomacyProposalStatus = "pending" | "accepted" | "renewal_pending" | "rejected" | "expired" | "failed";

export type DiplomacyProposal = {
  id: string;
  name: string;
  fromCountryId: string;
  toCountryId: string;
  createdTurnId: number;
  expiresTurnId: number;
  status: DiplomacyProposalStatus;
  clauses: TreatyClause[];
  pendingResponderCountryId?: string | null;
  lastEditedByCountryId?: string | null;
  revision?: number;
  revisionHistory?: Array<{
    revision: number;
    editedByCountryId: string;
    sentToCountryId: string;
    turnId: number;
    createdAt: string;
    expiresTurnId: number;
    name?: string;
    clauses: TreatyClause[];
  }>;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedByCountryId?: string | null;
  failureReason?: string | null;
  renewalAcceptedByCountryIds?: string[];
};
