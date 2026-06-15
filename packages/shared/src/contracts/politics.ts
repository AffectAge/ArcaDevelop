export type CountryParliamentParty = {
  partyId: string;
  seats: number;
  voteShare: number;
  ideologySupport: number;
};

export type CountryParliamentBill = {
  lawId: string;
  startedTurnId: number;
  progress: number;
  yesSeats: number;
  noSeats: number;
  abstainSeats: number;
  status: "debating" | "passed" | "failed";
};

export type CountryInterestGroup = {
  groupId: string;
  clout: number;
  rawPower: number;
  loyalists: number;
  radicals: number;
  supportedPartyId?: string | null;
};

export type ParliamentLawPower = "none" | "advisory" | "approve" | "initiate";
export type ParliamentBudgetPower = "none" | "approve_taxes" | "approve_budget" | "control_budget";
export type ParliamentDiplomacyPower = "none" | "ratify_territory" | "ratify_major_treaties" | "ratify_all";
export type ParliamentWarPower = "none" | "approve" | "declare";
export type ParliamentGovernmentPower = "none" | "confidence_vote" | "appoint_government";

export type CountryParliamentPowers = {
  laws: ParliamentLawPower;
  budget: ParliamentBudgetPower;
  diplomacy: ParliamentDiplomacyPower;
  war: ParliamentWarPower;
  government: ParliamentGovernmentPower;
  moneyTransferRatificationThreshold?: number | null;
};

export type LawParliamentPowerEffect =
  | { domain: "laws"; value: ParliamentLawPower }
  | { domain: "budget"; value: ParliamentBudgetPower }
  | { domain: "diplomacy"; value: ParliamentDiplomacyPower; moneyTransferRatificationThreshold?: number | null }
  | { domain: "war"; value: ParliamentWarPower }
  | { domain: "government"; value: ParliamentGovernmentPower };

export type CountryParliamentPowerBill = {
  id: string;
  title: string;
  startedTurnId: number;
  progress: number;
  yesSeats: number;
  noSeats: number;
  abstainSeats: number;
  status: "debating" | "passed" | "failed";
  proposedPowers: CountryParliamentPowers;
};

export type CountryParliament = {
  seatsTotal: number;
  lastElectionTurn: number;
  nextElectionTurn: number;
  partySeats: CountryParliamentParty[];
  governmentPartyIds: string[];
  interestGroups?: CountryInterestGroup[];
  powers?: CountryParliamentPowers;
  currentPowerBills?: CountryParliamentPowerBill[];
  activeLawByGroupId: Record<string, string>;
  currentBills?: CountryParliamentBill[];
  currentBill?: CountryParliamentBill | null;
};

export type CountryTechnologyState = {
  researchedTechnologyIds: string[];
  activeTechnologyId: string | null;
  activeTechnologyIds: string[];
  progressByTechnologyId: Record<string, number>;
  lastScienceSpent: number;
  lastCompletedTechnologyIds: string[];
};
