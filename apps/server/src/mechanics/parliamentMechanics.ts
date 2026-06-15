import type {
  BuildingInstance,
  CountryParliament,
  CountryParliamentPowerBill,
  CountryParliamentPowers,
  LawParliamentPowerEffect,
  ParliamentBudgetPower,
  ParliamentDiplomacyPower,
  ParliamentGovernmentPower,
  ParliamentLawPower,
  ParliamentWarPower,
  RegionPopulation,
  WorldBase,
} from "@arcanorum/shared";

export type ParliamentContentEntry = {
  id: string;
  name?: string;
  lawGroupId?: string | null;
  defaultLawId?: string | null;
  order?: number | null;
  votingDurationTurns?: number | null;
  enactmentDifficulty?: number | null;
  lawPreferences?: Record<string, number>;
  parliamentPower?: LawParliamentPowerEffect | null;
  ideologyWeights?: Record<string, number>;
  discipline?: number | null;
  basePoliticalStrength?: number | null;
  interestGroupWeights?: Record<string, number>;
  professionWeights?: Record<string, number>;
  buildingWeights?: Record<string, number>;
  solMultiplier?: number | null;
  radicalMultiplier?: number | null;
  loyalistMultiplier?: number | null;
  defaultPartyId?: string | null;
};

export type ParliamentWorldState = Pick<
  WorldBase,
  "parliamentByCountry" | "regionOwner" | "regionController" | "regionPopulationByRegion" | "regionBuildingsByRegion" | "resourcesByCountry"
>;

export type ParliamentContentCatalog = {
  laws: ParliamentContentEntry[];
  lawGroups: ParliamentContentEntry[];
  parties: ParliamentContentEntry[];
  interestGroups: ParliamentContentEntry[];
};

export const PARLIAMENT_DEFAULT_SEATS = 100;
export const PARLIAMENT_ELECTION_INTERVAL_TURNS = 8;

export const DEFAULT_PARLIAMENT_POWERS: CountryParliamentPowers = {
  laws: "approve",
  budget: "approve_budget",
  diplomacy: "ratify_major_treaties",
  war: "approve",
  government: "confidence_vote",
  moneyTransferRatificationThreshold: 10_000,
};

export const PARLIAMENT_LAW_POWERS: ParliamentLawPower[] = ["none", "advisory", "approve", "initiate"];
export const PARLIAMENT_BUDGET_POWERS: ParliamentBudgetPower[] = ["none", "approve_taxes", "approve_budget", "control_budget"];
export const PARLIAMENT_DIPLOMACY_POWERS: ParliamentDiplomacyPower[] = ["none", "ratify_territory", "ratify_major_treaties", "ratify_all"];
export const PARLIAMENT_WAR_POWERS: ParliamentWarPower[] = ["none", "approve", "declare"];
export const PARLIAMENT_GOVERNMENT_POWERS: ParliamentGovernmentPower[] = ["none", "confidence_vote", "appoint_government"];

export function pickParliamentPower<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  return typeof raw === "string" && allowed.includes(raw as T) ? (raw as T) : fallback;
}

export function normalizeLawParliamentPowerEffect(raw: unknown): LawParliamentPowerEffect | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const domain = typeof value.domain === "string" ? value.domain : "";
  if (domain === "laws") {
    return { domain, value: pickParliamentPower(value.value, PARLIAMENT_LAW_POWERS, "approve") };
  }
  if (domain === "budget") {
    return { domain, value: pickParliamentPower(value.value, PARLIAMENT_BUDGET_POWERS, "approve_budget") };
  }
  if (domain === "diplomacy") {
    const threshold = Number(value.moneyTransferRatificationThreshold);
    return {
      domain,
      value: pickParliamentPower(value.value, PARLIAMENT_DIPLOMACY_POWERS, "ratify_major_treaties"),
      moneyTransferRatificationThreshold: Number.isFinite(threshold) && threshold > 0 ? Math.round(threshold) : null,
    };
  }
  if (domain === "war") {
    return { domain, value: pickParliamentPower(value.value, PARLIAMENT_WAR_POWERS, "approve") };
  }
  if (domain === "government") {
    return { domain, value: pickParliamentPower(value.value, PARLIAMENT_GOVERNMENT_POWERS, "confidence_vote") };
  }
  return null;
}

export function normalizeParliamentPowers(raw: unknown): CountryParliamentPowers {
  const value = raw && typeof raw === "object" ? (raw as Partial<CountryParliamentPowers>) : {};
  const laws = pickParliamentPower(value.laws, PARLIAMENT_LAW_POWERS, DEFAULT_PARLIAMENT_POWERS.laws);
  const budget = pickParliamentPower(value.budget, PARLIAMENT_BUDGET_POWERS, DEFAULT_PARLIAMENT_POWERS.budget);
  const diplomacy = pickParliamentPower(value.diplomacy, PARLIAMENT_DIPLOMACY_POWERS, DEFAULT_PARLIAMENT_POWERS.diplomacy);
  const war = pickParliamentPower(value.war, PARLIAMENT_WAR_POWERS, DEFAULT_PARLIAMENT_POWERS.war);
  const government = pickParliamentPower(value.government, PARLIAMENT_GOVERNMENT_POWERS, DEFAULT_PARLIAMENT_POWERS.government);
  const threshold = Number(value.moneyTransferRatificationThreshold ?? DEFAULT_PARLIAMENT_POWERS.moneyTransferRatificationThreshold);
  return {
    laws,
    budget,
    diplomacy,
    war,
    government,
    moneyTransferRatificationThreshold: Number.isFinite(threshold) && threshold > 0 ? Math.round(threshold) : null,
  };
}

export function canEnactLawWithoutVote(parliament: CountryParliament): boolean {
  const lawPower = normalizeParliamentPowers(parliament.powers).laws;
  return lawPower === "none" || lawPower === "advisory";
}

export function getParliamentPowersFromActiveLaws(
  activeLawByGroupId: Record<string, string>,
  laws: ParliamentContentEntry[],
): CountryParliamentPowers {
  const powers = normalizeParliamentPowers(DEFAULT_PARLIAMENT_POWERS);
  for (const lawId of Object.values(activeLawByGroupId)) {
    const effect = normalizeLawParliamentPowerEffect(laws.find((law) => law.id === lawId)?.parliamentPower);
    if (!effect) continue;
    if (effect.domain === "laws") powers.laws = effect.value;
    if (effect.domain === "budget") powers.budget = effect.value;
    if (effect.domain === "diplomacy") {
      powers.diplomacy = effect.value;
      if (effect.moneyTransferRatificationThreshold !== undefined) {
        powers.moneyTransferRatificationThreshold = effect.moneyTransferRatificationThreshold;
      }
    }
    if (effect.domain === "war") powers.war = effect.value;
    if (effect.domain === "government") powers.government = effect.value;
  }
  return powers;
}

export function getParliamentPowerScore(powers: CountryParliamentPowers): number {
  const lawScore: Record<ParliamentLawPower, number> = { none: 0, advisory: 1, approve: 2, initiate: 3 };
  const budgetScore: Record<ParliamentBudgetPower, number> = { none: 0, approve_taxes: 1, approve_budget: 2, control_budget: 3 };
  const diplomacyScore: Record<ParliamentDiplomacyPower, number> = { none: 0, ratify_territory: 1, ratify_major_treaties: 2, ratify_all: 3 };
  const warScore: Record<ParliamentWarPower, number> = { none: 0, approve: 2, declare: 3 };
  const governmentScore: Record<ParliamentGovernmentPower, number> = { none: 0, confidence_vote: 2, appoint_government: 3 };
  return lawScore[powers.laws] + budgetScore[powers.budget] + diplomacyScore[powers.diplomacy] + warScore[powers.war] + governmentScore[powers.government];
}

export function normalizeParliamentPowerBills(params: {
  input: unknown;
  turnId: number;
  createId: () => string;
}): CountryParliamentPowerBill[] {
  if (!Array.isArray(params.input)) return [];
  return params.input
    .map((raw): CountryParliamentPowerBill | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Partial<CountryParliamentPowerBill>;
      const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 120) : params.createId();
      const title = typeof row.title === "string" && row.title.trim() ? row.title.trim().slice(0, 160) : "Изменение полномочий парламента";
      const startedTurnId =
        typeof row.startedTurnId === "number" && Number.isFinite(row.startedTurnId)
          ? Math.max(1, Math.floor(row.startedTurnId))
          : params.turnId;
      const progress = typeof row.progress === "number" && Number.isFinite(row.progress) ? Math.max(-50, Math.min(100, row.progress)) : 0;
      const status = row.status === "passed" || row.status === "failed" ? row.status : "debating";
      return {
        id,
        title,
        startedTurnId,
        progress,
        yesSeats: typeof row.yesSeats === "number" && Number.isFinite(row.yesSeats) ? Math.max(0, Math.floor(row.yesSeats)) : 0,
        noSeats: typeof row.noSeats === "number" && Number.isFinite(row.noSeats) ? Math.max(0, Math.floor(row.noSeats)) : 0,
        abstainSeats: typeof row.abstainSeats === "number" && Number.isFinite(row.abstainSeats) ? Math.max(0, Math.floor(row.abstainSeats)) : 0,
        status,
        proposedPowers: normalizeParliamentPowers(row.proposedPowers),
      };
    })
    .filter((bill): bill is CountryParliamentPowerBill => Boolean(bill))
    .filter((bill, index, rows) => bill.status === "debating" && rows.findIndex((row) => row.id === bill.id) === index);
}

export function getLawsByGroupId(laws: ParliamentContentEntry[]): Map<string, ParliamentContentEntry[]> {
  const byGroup = new Map<string, ParliamentContentEntry[]>();
  for (const law of laws) {
    if (!law.lawGroupId) continue;
    const groupLaws = byGroup.get(law.lawGroupId) ?? [];
    groupLaws.push(law);
    byGroup.set(law.lawGroupId, groupLaws);
  }
  for (const groupLaws of byGroup.values()) {
    groupLaws.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.name ?? a.id).localeCompare(b.name ?? b.id));
  }
  return byGroup;
}

export function buildDefaultActiveLawMap(params: {
  previous?: Record<string, string>;
  lawGroups: ParliamentContentEntry[];
  laws: ParliamentContentEntry[];
}): Record<string, string> {
  const active = { ...(params.previous ?? {}) };
  const lawsByGroupId = getLawsByGroupId(params.laws);
  for (const group of params.lawGroups) {
    const groupLaws = lawsByGroupId.get(group.id) ?? [];
    const defaultLawId =
      group.defaultLawId && groupLaws.some((law) => law.id === group.defaultLawId) ? group.defaultLawId : groupLaws[0]?.id;
    if (!defaultLawId) continue;
    if (!active[group.id] || !groupLaws.some((law) => law.id === active[group.id])) {
      active[group.id] = defaultLawId;
    }
  }
  for (const groupId of Object.keys(active)) {
    if (!lawsByGroupId.has(groupId)) delete active[groupId];
  }
  return active;
}

export function getCountryIdeologySupport(params: {
  countryId: string;
  regionControllerByRegion: Record<string, string | null | undefined>;
  regionPopulationByRegion: Record<string, RegionPopulation>;
}): Record<string, number> {
  const totals: Record<string, number> = {};
  let totalPopulation = 0;
  for (const [regionId, ownerId] of Object.entries(params.regionControllerByRegion)) {
    if (ownerId !== params.countryId) continue;
    const population = params.regionPopulationByRegion[regionId];
    for (const pop of population?.pops ?? []) {
      const popSize = Math.max(0, pop.size);
      totalPopulation += popSize;
      const ideologyTotal = Object.values(pop.ideologies ?? {}).reduce((sum, value) => sum + Math.max(0, value), 0);
      if (ideologyTotal <= 0) continue;
      for (const [ideologyId, value] of Object.entries(pop.ideologies ?? {})) {
        totals[ideologyId] = (totals[ideologyId] ?? 0) + popSize * (Math.max(0, value) / ideologyTotal);
      }
    }
  }
  if (totalPopulation <= 0) return {};
  return Object.fromEntries(Object.entries(totals).map(([id, value]) => [id, Number((value / totalPopulation).toFixed(6))]));
}

export function calculateCountryInterestGroups(params: {
  countryId: string;
  groups: ParliamentContentEntry[];
  regionControllerByRegion: Record<string, string | null | undefined>;
  regionPopulationByRegion: Record<string, RegionPopulation>;
  regionBuildingsByRegion: Record<string, BuildingInstance[]>;
}): NonNullable<CountryParliament["interestGroups"]> {
  if (params.groups.length === 0) return [];
  const rawPowerByGroupId = new Map<string, number>(params.groups.map((group) => [group.id, Math.max(0, group.basePoliticalStrength ?? 1)]));
  const loyalistsByGroupId = new Map<string, number>(params.groups.map((group) => [group.id, 0]));
  const radicalsByGroupId = new Map<string, number>(params.groups.map((group) => [group.id, 0]));

  for (const [regionId, ownerId] of Object.entries(params.regionControllerByRegion)) {
    if (ownerId !== params.countryId) continue;
    const population = params.regionPopulationByRegion[regionId];
    for (const pop of population?.pops ?? []) {
      for (const [professionId, professionState] of Object.entries(pop.professions ?? {})) {
        const size = Math.max(0, professionState.size);
        if (size <= 0) continue;
        for (const group of params.groups) {
          const professionWeight = group.professionWeights?.[professionId] ?? 0;
          if (professionWeight <= 0) continue;
          const sol = Math.max(0, professionState.standardOfLiving ?? 0);
          const radicalShare = size > 0 ? Math.max(0, professionState.radicals ?? 0) / size : 0;
          const loyalistShare = size > 0 ? Math.max(0, professionState.loyalists ?? 0) / size : 0;
          const modifier = Math.max(
            0.05,
            1 +
              sol * (group.solMultiplier ?? 0.03) +
              radicalShare * (group.radicalMultiplier ?? 0.5) +
              loyalistShare * (group.loyalistMultiplier ?? 0.25),
          );
          const power = size * (professionWeight / 100) * modifier;
          rawPowerByGroupId.set(group.id, (rawPowerByGroupId.get(group.id) ?? 0) + power);
          radicalsByGroupId.set(group.id, (radicalsByGroupId.get(group.id) ?? 0) + Math.max(0, professionState.radicals ?? 0) * (professionWeight / 100));
          loyalistsByGroupId.set(group.id, (loyalistsByGroupId.get(group.id) ?? 0) + Math.max(0, professionState.loyalists ?? 0) * (professionWeight / 100));
        }
      }
    }

    for (const building of params.regionBuildingsByRegion[regionId] ?? []) {
      for (const group of params.groups) {
        const weight = group.buildingWeights?.[building.buildingId] ?? 0;
        if (weight <= 0) continue;
        const level = Math.max(1, Math.floor(building.level ?? 1));
        rawPowerByGroupId.set(group.id, (rawPowerByGroupId.get(group.id) ?? 0) + level * weight * 100);
      }
    }
  }

  const totalPower = [...rawPowerByGroupId.values()].reduce((sum, value) => sum + Math.max(0, value), 0);
  return params.groups
    .map((group) => {
      const rawPower = Math.max(0, rawPowerByGroupId.get(group.id) ?? 0);
      return {
        groupId: group.id,
        rawPower: Number(rawPower.toFixed(3)),
        clout: totalPower > 0 ? Number((rawPower / totalPower).toFixed(6)) : 0,
        loyalists: Math.floor(loyalistsByGroupId.get(group.id) ?? 0),
        radicals: Math.floor(radicalsByGroupId.get(group.id) ?? 0),
        supportedPartyId: group.defaultPartyId ?? null,
      };
    })
    .filter((group) => group.rawPower > 0)
    .sort((a, b) => b.clout - a.clout || a.groupId.localeCompare(b.groupId));
}

export function allocateSeats(scores: Array<{ partyId: string; score: number }>, seatsTotal: number): Map<string, number> {
  const seats = new Map<string, number>();
  const totalScore = scores.reduce((sum, row) => sum + Math.max(0, row.score), 0);
  if (scores.length === 0 || seatsTotal <= 0) return seats;
  if (totalScore <= 0) {
    const base = Math.floor(seatsTotal / scores.length);
    let remainder = seatsTotal - base * scores.length;
    for (const row of scores) {
      seats.set(row.partyId, base + (remainder > 0 ? 1 : 0));
      remainder -= 1;
    }
    return seats;
  }
  const remainders: Array<{ partyId: string; remainder: number }> = [];
  let used = 0;
  for (const row of scores) {
    const exact = (Math.max(0, row.score) / totalScore) * seatsTotal;
    const whole = Math.floor(exact);
    seats.set(row.partyId, whole);
    used += whole;
    remainders.push({ partyId: row.partyId, remainder: exact - whole });
  }
  remainders.sort((a, b) => b.remainder - a.remainder || a.partyId.localeCompare(b.partyId));
  for (let i = 0; i < seatsTotal - used; i += 1) {
    const partyId = remainders[i % remainders.length]?.partyId;
    if (!partyId) break;
    seats.set(partyId, (seats.get(partyId) ?? 0) + 1);
  }
  return seats;
}

function getEffectiveRegionControllerByRegion(
  worldBase: Pick<ParliamentWorldState, "regionOwner" | "regionController" | "regionPopulationByRegion" | "regionBuildingsByRegion">,
): Record<string, string | null> {
  const regionIds = new Set([
    ...Object.keys(worldBase.regionOwner),
    ...Object.keys(worldBase.regionController),
    ...Object.keys(worldBase.regionPopulationByRegion),
    ...Object.keys(worldBase.regionBuildingsByRegion),
  ]);
  return Object.fromEntries(
    [...regionIds].map((regionId) => [regionId, worldBase.regionController[regionId] ?? worldBase.regionOwner[regionId] ?? null]),
  );
}

export function runCountryElection(params: {
  countryId: string;
  worldBase: ParliamentWorldState;
  content: ParliamentContentCatalog;
  turnId: number;
  createId: () => string;
}): CountryParliament {
  const previous = params.worldBase.parliamentByCountry[params.countryId];
  const regionControllerByRegion = getEffectiveRegionControllerByRegion(params.worldBase);
  const interestGroups = calculateCountryInterestGroups({
    countryId: params.countryId,
    groups: params.content.interestGroups,
    regionControllerByRegion,
    regionPopulationByRegion: params.worldBase.regionPopulationByRegion,
    regionBuildingsByRegion: params.worldBase.regionBuildingsByRegion,
  });
  const previousBills = [
    ...(Array.isArray(previous?.currentBills) ? previous.currentBills : []),
    ...(previous?.currentBill ? [previous.currentBill] : []),
  ].filter((bill, index, rows) => bill.status === "debating" && rows.findIndex((row) => row.lawId === bill.lawId) === index);
  const previousPowerBills = normalizeParliamentPowerBills({
    input: previous?.currentPowerBills,
    turnId: params.turnId,
    createId: params.createId,
  });
  const ideologySupport = getCountryIdeologySupport({
    countryId: params.countryId,
    regionControllerByRegion,
    regionPopulationByRegion: params.worldBase.regionPopulationByRegion,
  });
  const scores = params.content.parties.map((party) => {
    const weights = party.ideologyWeights ?? {};
    const weightedScore = Object.entries(weights).reduce((sum, [ideologyId, weight]) => {
      return sum + (ideologySupport[ideologyId] ?? 0) * Math.max(0, weight);
    }, 0);
    const groupScore = interestGroups.reduce((sum, group) => {
      const affinity = party.interestGroupWeights?.[group.groupId] ?? (group.supportedPartyId === party.id ? 100 : 0);
      return sum + group.clout * Math.max(0, affinity);
    }, 0);
    return { partyId: party.id, score: (Object.keys(weights).length > 0 ? weightedScore : 1) + groupScore };
  });
  const seats = allocateSeats(scores, PARLIAMENT_DEFAULT_SEATS);
  const totalScore = scores.reduce((sum, row) => sum + Math.max(0, row.score), 0);
  const partySeats = params.content.parties
    .map((party) => {
      const score = Math.max(0, scores.find((row) => row.partyId === party.id)?.score ?? 0);
      return {
        partyId: party.id,
        seats: seats.get(party.id) ?? 0,
        voteShare: totalScore > 0 ? Number((score / totalScore).toFixed(6)) : params.content.parties.length > 0 ? Number((1 / params.content.parties.length).toFixed(6)) : 0,
        ideologySupport: Number(score.toFixed(6)),
      };
    })
    .sort((a, b) => b.seats - a.seats || a.partyId.localeCompare(b.partyId));
  const governmentPartyIds =
    partySeats.length > 0
      ? partySeats
          .slice(0, Math.max(1, Math.ceil(partySeats.length / 3)))
          .filter((row) => row.seats > 0)
          .map((row) => row.partyId)
      : [];
  const activeLawByGroupId = buildDefaultActiveLawMap({
    previous: previous?.activeLawByGroupId,
    lawGroups: params.content.lawGroups,
    laws: params.content.laws,
  });
  return {
    seatsTotal: PARLIAMENT_DEFAULT_SEATS,
    lastElectionTurn: params.turnId,
    nextElectionTurn: params.turnId + PARLIAMENT_ELECTION_INTERVAL_TURNS,
    partySeats,
    governmentPartyIds,
    interestGroups,
    powers: getParliamentPowersFromActiveLaws(activeLawByGroupId, params.content.laws),
    currentPowerBills: previousPowerBills,
    activeLawByGroupId,
    currentBills: previousBills,
    currentBill: previousBills[0] ?? null,
  };
}

export function ensureCountryParliament(params: {
  countryId: string;
  worldBase: ParliamentWorldState;
  content: ParliamentContentCatalog;
  turnId: number;
  createId: () => string;
}): CountryParliament {
  const existing = params.worldBase.parliamentByCountry[params.countryId];
  if (!existing) {
    const parliament = runCountryElection(params);
    params.worldBase.parliamentByCountry[params.countryId] = parliament;
    return parliament;
  }
  const activeLawByGroupId = buildDefaultActiveLawMap({
    previous: existing.activeLawByGroupId,
    lawGroups: params.content.lawGroups,
    laws: params.content.laws,
  });
  const normalized: CountryParliament = {
    ...existing,
    seatsTotal: existing.seatsTotal || PARLIAMENT_DEFAULT_SEATS,
    partySeats: Array.isArray(existing.partySeats) ? existing.partySeats : [],
    governmentPartyIds: Array.isArray(existing.governmentPartyIds) ? existing.governmentPartyIds : [],
    interestGroups: calculateCountryInterestGroups({
      countryId: params.countryId,
      groups: params.content.interestGroups,
      regionControllerByRegion: getEffectiveRegionControllerByRegion(params.worldBase),
      regionPopulationByRegion: params.worldBase.regionPopulationByRegion,
      regionBuildingsByRegion: params.worldBase.regionBuildingsByRegion,
    }),
    powers: getParliamentPowersFromActiveLaws(activeLawByGroupId, params.content.laws),
    currentPowerBills: normalizeParliamentPowerBills({
      input: existing.currentPowerBills,
      turnId: params.turnId,
      createId: params.createId,
    }),
    activeLawByGroupId,
    currentBills: [
      ...(Array.isArray(existing.currentBills) ? existing.currentBills : []),
      ...(existing.currentBill ? [existing.currentBill] : []),
    ].filter((bill, index, rows) => bill.status === "debating" && rows.findIndex((row) => row.lawId === bill.lawId) === index),
    currentBill: null,
  };
  normalized.currentBill = (normalized.currentBills ?? [])[0] ?? null;
  params.worldBase.parliamentByCountry[params.countryId] = normalized;
  return normalized;
}

export function calculateBillVote(params: {
  parliament: CountryParliament;
  law: ParliamentContentEntry;
  parties: ParliamentContentEntry[];
  interestGroups: ParliamentContentEntry[];
  turnId: number;
  existingBill?: NonNullable<CountryParliament["currentBill"]> | null;
}): NonNullable<CountryParliament["currentBill"]> {
  const currentLawId = params.law.lawGroupId ? params.parliament.activeLawByGroupId[params.law.lawGroupId] : null;
  let yesSeats = 0;
  let noSeats = 0;
  let abstainSeats = 0;
  const partyById = new Map(params.parties.map((party) => [party.id, party] as const));
  for (const row of params.parliament.partySeats) {
    const party = partyById.get(row.partyId);
    if (!party || row.seats <= 0) continue;
    const targetPreference = party.lawPreferences?.[params.law.id] ?? params.law.lawPreferences?.[party.id] ?? 0;
    const currentPreference = currentLawId ? (party.lawPreferences?.[currentLawId] ?? 0) : 0;
    const groupPressure = (params.parliament.interestGroups ?? []).reduce((sum, group) => {
      const affinity = party.interestGroupWeights?.[group.groupId] ?? 0;
      const interestGroup = params.interestGroups.find((entry) => entry.id === group.groupId);
      const preference = interestGroup?.lawPreferences?.[params.law.id] ?? 0;
      return sum + group.clout * (affinity / 100) * preference;
    }, 0);
    const governmentBonus = params.parliament.governmentPartyIds.includes(row.partyId) ? 8 : 0;
    const support = targetPreference - currentPreference + groupPressure + governmentBonus;
    const discipline = Math.min(1, Math.max(0, party.discipline ?? 0.85));
    const committedSeats = Math.round(row.seats * discipline);
    const flexibleSeats = row.seats - committedSeats;
    if (support > 5) {
      yesSeats += committedSeats + Math.floor(flexibleSeats / 2);
      abstainSeats += flexibleSeats - Math.floor(flexibleSeats / 2);
    } else if (support < -5) {
      noSeats += committedSeats + Math.floor(flexibleSeats / 2);
      abstainSeats += flexibleSeats - Math.floor(flexibleSeats / 2);
    } else {
      abstainSeats += row.seats;
    }
  }
  const usedSeats = yesSeats + noSeats + abstainSeats;
  if (usedSeats < params.parliament.seatsTotal) abstainSeats += params.parliament.seatsTotal - usedSeats;
  return {
    lawId: params.law.id,
    startedTurnId: params.existingBill?.lawId === params.law.id ? params.existingBill.startedTurnId : params.turnId,
    progress: params.existingBill?.lawId === params.law.id ? params.existingBill.progress : 0,
    yesSeats,
    noSeats,
    abstainSeats,
    status: "debating",
  };
}

export function calculatePowerBillVote(params: {
  parliament: CountryParliament;
  bill: CountryParliamentPowerBill;
  parties: ParliamentContentEntry[];
}): CountryParliamentPowerBill {
  const currentPowers = normalizeParliamentPowers(params.parliament.powers);
  const proposedPowers = normalizeParliamentPowers(params.bill.proposedPowers);
  const powerDelta = getParliamentPowerScore(proposedPowers) - getParliamentPowerScore(currentPowers);
  let yesSeats = 0;
  let noSeats = 0;
  let abstainSeats = 0;
  const partyById = new Map(params.parties.map((party) => [party.id, party] as const));

  for (const row of params.parliament.partySeats) {
    const party = partyById.get(row.partyId);
    if (!party || row.seats <= 0) continue;
    const inGovernment = params.parliament.governmentPartyIds.includes(row.partyId);
    const discipline = Math.min(1, Math.max(0, party.discipline ?? 0.85));
    const committedSeats = Math.round(row.seats * discipline);
    const flexibleSeats = row.seats - committedSeats;
    const support =
      powerDelta > 0
        ? 18 + (inGovernment ? 4 : 8)
        : powerDelta < 0
          ? (inGovernment ? 10 : -16)
          : 0;
    if (support > 5) {
      yesSeats += committedSeats + Math.floor(flexibleSeats / 2);
      abstainSeats += flexibleSeats - Math.floor(flexibleSeats / 2);
    } else if (support < -5) {
      noSeats += committedSeats + Math.floor(flexibleSeats / 2);
      abstainSeats += flexibleSeats - Math.floor(flexibleSeats / 2);
    } else {
      abstainSeats += row.seats;
    }
  }

  const usedSeats = yesSeats + noSeats + abstainSeats;
  if (usedSeats < params.parliament.seatsTotal) abstainSeats += params.parliament.seatsTotal - usedSeats;
  return {
    ...params.bill,
    proposedPowers,
    yesSeats,
    noSeats,
    abstainSeats,
    status: "debating",
  };
}

export function resolveParliamentTurn(params: {
  worldBase: ParliamentWorldState;
  content: ParliamentContentCatalog;
  turnId: number;
  createId: () => string;
}): Array<{ countryId: string; parliament: CountryParliament }> {
  const electionResults: Array<{ countryId: string; parliament: CountryParliament }> = [];
  for (const countryId of Object.keys(params.worldBase.resourcesByCountry)) {
    let parliament = ensureCountryParliament({
      countryId,
      worldBase: params.worldBase,
      content: params.content,
      turnId: params.turnId,
      createId: params.createId,
    });
    parliament.interestGroups = calculateCountryInterestGroups({
      countryId,
      groups: params.content.interestGroups,
      regionControllerByRegion: getEffectiveRegionControllerByRegion(params.worldBase),
      regionPopulationByRegion: params.worldBase.regionPopulationByRegion,
      regionBuildingsByRegion: params.worldBase.regionBuildingsByRegion,
    });
    if (params.turnId >= parliament.nextElectionTurn || parliament.partySeats.length !== params.content.parties.length) {
      parliament = runCountryElection({
        countryId,
        worldBase: params.worldBase,
        content: params.content,
        turnId: params.turnId,
        createId: params.createId,
      });
      params.worldBase.parliamentByCountry[countryId] = parliament;
      electionResults.push({ countryId, parliament });
    }
    const bills = Array.isArray(parliament.currentBills)
      ? parliament.currentBills
      : parliament.currentBill
        ? [parliament.currentBill]
        : [];
    const nextBills: NonNullable<CountryParliament["currentBill"]>[] = [];
    for (const bill of bills) {
      if (bill.status !== "debating") continue;
      const law = params.content.laws.find((entry) => entry.id === bill.lawId);
      if (!law || !law.lawGroupId) continue;
      const voted = calculateBillVote({
        parliament,
        law,
        parties: params.content.parties,
        interestGroups: params.content.interestGroups,
        turnId: params.turnId,
        existingBill: bill,
      });
      const duration = Math.max(1, law.votingDurationTurns ?? 3);
      const difficulty = Math.max(0.1, law.enactmentDifficulty ?? 1);
      const yesPressure = voted.yesSeats > voted.noSeats ? voted.yesSeats / Math.max(1, parliament.seatsTotal) : 0;
      const noPressure = voted.noSeats > voted.yesSeats ? voted.noSeats / Math.max(1, parliament.seatsTotal) : 0;
      voted.progress = Number(
        Math.min(100, Math.max(-50, (bill.progress ?? 0) + (100 / duration) * (yesPressure / difficulty) - 15 * noPressure)).toFixed(2),
      );
      if (voted.progress >= 100 && voted.yesSeats > voted.noSeats) {
        parliament.activeLawByGroupId[law.lawGroupId] = law.id;
        parliament.powers = getParliamentPowersFromActiveLaws(parliament.activeLawByGroupId, params.content.laws);
        continue;
      }
      if (params.turnId - voted.startedTurnId >= duration && voted.noSeats >= voted.yesSeats) {
        continue;
      }
      nextBills.push(voted);
    }
    parliament.currentBills = nextBills;
    parliament.currentBill = nextBills[0] ?? null;

    const nextPowerBills: CountryParliamentPowerBill[] = [];
    for (const bill of normalizeParliamentPowerBills({
      input: parliament.currentPowerBills,
      turnId: params.turnId,
      createId: params.createId,
    })) {
      const voted = calculatePowerBillVote({
        parliament,
        bill,
        parties: params.content.parties,
      });
      const duration = 3;
      const yesPressure = voted.yesSeats > voted.noSeats ? voted.yesSeats / Math.max(1, parliament.seatsTotal) : 0;
      const noPressure = voted.noSeats > voted.yesSeats ? voted.noSeats / Math.max(1, parliament.seatsTotal) : 0;
      voted.progress = Number(Math.min(100, Math.max(-50, (bill.progress ?? 0) + (100 / duration) * yesPressure - 15 * noPressure)).toFixed(2));
      if (voted.progress >= 100 && voted.yesSeats > voted.noSeats) {
        parliament.powers = normalizeParliamentPowers(voted.proposedPowers);
        continue;
      }
      if (params.turnId - voted.startedTurnId >= duration && voted.noSeats >= voted.yesSeats) {
        continue;
      }
      nextPowerBills.push(voted);
    }
    parliament.currentPowerBills = nextPowerBills;
  }
  return electionResults;
}
