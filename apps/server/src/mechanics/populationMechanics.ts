import type { IdeologyAttractionRule, PopulationPop, RegionPopulation } from "@arcanorum/shared";

export type PopulationDimensionKey = "culturePct" | "ideologyPct" | "religionPct" | "racePct" | "professionPct";

export type PopulationDomainKeys = {
  culturePct: string[];
  ideologyPct: string[];
  religionPct: string[];
  racePct: string[];
  professionPct: string[];
};

export type PopulationDomainContent = Record<PopulationDimensionKey, Array<{ id: string; name?: string | null }>>;

export type CultureNeedCategory = "survival" | "basic" | "comfort" | "luxury";

export type CultureNeedGoodLike = {
  goodId: string;
  weight: number;
  taboo?: boolean;
  obsessionMultiplier?: number;
};

export type CultureNeedGood = CultureNeedGoodLike;

export type CultureNeedLike = {
  category: CultureNeedCategory;
  amountPerPerson: number;
  weight: number;
  goods: CultureNeedGoodLike[];
};

export type CultureNeed = CultureNeedLike & {
  id: string;
  label: string;
  goods: CultureNeedGood[];
};

export type CultureNeedTier = {
  id: string;
  minStandardOfLiving: number;
  needs: CultureNeed[];
};

export type CultureNeedsProfile = {
  tiers: CultureNeedTier[];
};

export type PopulationNeedCategoryStats = Record<string, {
  required: number;
  fulfilled: number;
  spend: number;
  satisfaction: number;
}>;

export type PopulationNeedsPurchaseResult = {
  purchasedPhysicalAmount: number;
  spent: number;
  wallet: number;
};

export type PopulationIdeologyContentEntry = {
  id: string;
  ideologyAttractionRules?: IdeologyAttractionRule[];
};

export type PopulationAcceptanceContentEntry = {
  id: string;
  acceptedCultureIds?: string[];
  acceptedReligionIds?: string[];
  acceptedRaceIds?: string[];
  acceptanceMode?: "add" | "replace";
  discrimination?: {
    wagePenaltyPct?: number;
    hiringPenaltyPct?: number;
    qualificationGrowthPenaltyPct?: number;
    politicalStrengthPenaltyPct?: number;
    radicalizationPerTurn?: number;
  } | null;
};

export type PopulationAcceptanceContext = {
  countryId: string | null;
  acceptedCultureIds: Set<string>;
  acceptedReligionIds: Set<string>;
  acceptedRaceIds: Set<string>;
  activeLawIds: Set<string>;
};

export type PopulationDiscriminationResult = {
  status: "accepted" | "discriminated";
  reasons: string[];
  wagePenaltyPct: number;
  hiringPenaltyPct: number;
  qualificationGrowthPenaltyPct: number;
  politicalStrengthPenaltyPct: number;
  radicalizationPerTurn: number;
};

export type RegionPopulationIdeologyContext = {
  countryId: string | null;
  activeLawIds: Set<string>;
  activeModifierIds: Set<string>;
  provinceBuildingIds: Set<string>;
};

export type ResolvePopulationTurnResult = {
  nextPopulationByRegion: Record<string, RegionPopulation>;
  changedRegionIds: string[];
};

export type WorkforceRequirementLike = {
  professionId: string;
  workers: number;
};

export type WorkforceDemandSource = {
  level?: number | null;
  workforceRequirements?: WorkforceRequirementLike[];
};

export type WorkforceDemandSummary = {
  demandByProfession: Record<string, number>;
  totalWorkforceDemand: number;
};

export type PopulationJobAllocationResult = {
  nextPopulation: RegionPopulation;
  employedByProfession: Record<string, number>;
};

export type PopulationNeedsTurnResult = {
  nextPopulation: RegionPopulation;
  demandRequestedByGood: Record<string, number>;
};

export type ProfessionQualificationEntry = {
  id: string;
  qualificationRequirements?: Record<string, number>;
  qualificationGrowthRules?: Record<string, number>;
};

export const POPULATION_BIRTH_RATE = 0.012;
export const POPULATION_DEATH_RATE = 0.008;
export const DEFAULT_STANDARD_OF_LIVING = 8;
export const DEFAULT_LITERACY = 0.1;

export const POPULATION_FALLBACK_KEY_BY_DIMENSION: Record<PopulationDimensionKey, string> = {
  culturePct: "culture:default",
  ideologyPct: "ideology:default",
  religionPct: "religion:default",
  racePct: "race:default",
  professionPct: "profession:unemployed",
};

export const POPULATION_FALLBACK_NAME_BY_DIMENSION: Record<PopulationDimensionKey, string> = {
  culturePct: "Без культуры",
  ideologyPct: "Без идеологии",
  religionPct: "Атеизм",
  racePct: "Люди",
  professionPct: "Безработные",
};

export const CULTURE_NEED_CATEGORY_ORDER: Record<CultureNeedCategory, number> = {
  survival: 0,
  basic: 1,
  comfort: 2,
  luxury: 3,
};

export const CULTURE_NEED_CATEGORY_SATISFACTION_WEIGHT: Record<CultureNeedCategory, number> = {
  survival: 2.4,
  basic: 1.6,
  comfort: 1,
  luxury: 0.6,
};

export function normalizeCultureNeedsProfile(input: unknown): CultureNeedsProfile | null {
  if (!input || typeof input !== "object") return null;
  const tiersRaw = (input as { tiers?: unknown }).tiers;
  if (!Array.isArray(tiersRaw)) return null;
  const tiers: CultureNeedTier[] = [];
  for (const [tierIndex, tierRaw] of tiersRaw.entries()) {
    if (!tierRaw || typeof tierRaw !== "object") continue;
    const tier = tierRaw as Partial<CultureNeedTier>;
    const needsRaw = Array.isArray(tier.needs) ? tier.needs : [];
    const needs: CultureNeed[] = [];
    for (const [needIndex, needRaw] of needsRaw.entries()) {
      if (!needRaw || typeof needRaw !== "object") continue;
      const need = needRaw as Partial<CultureNeed>;
      const goods = (Array.isArray(need.goods) ? need.goods : [])
        .map((raw): CultureNeedGood | null => {
          if (!raw || typeof raw !== "object") return null;
          const row = raw as Partial<CultureNeedGood>;
          const goodId = typeof row.goodId === "string" ? row.goodId.trim() : "";
          const weight = Number(row.weight);
          const obsessionMultiplier = Number(row.obsessionMultiplier);
          return goodId
            ? {
                goodId,
                weight: Number(Math.max(0.001, Number.isFinite(weight) ? weight : 1).toFixed(3)),
                taboo: row.taboo === true,
                obsessionMultiplier: Number(Math.max(1, Number.isFinite(obsessionMultiplier) ? obsessionMultiplier : 1).toFixed(3)),
              }
            : null;
        })
        .filter((row): row is CultureNeedGood => row != null);
      const id = typeof need.id === "string" && need.id.trim() ? need.id.trim().slice(0, 80) : `need-${needIndex + 1}`;
      const label = typeof need.label === "string" && need.label.trim() ? need.label.trim().slice(0, 80) : id;
      const category =
        need.category === "survival" || need.category === "basic" || need.category === "comfort" || need.category === "luxury"
          ? need.category
          : "basic";
      const amountPerPerson = Math.max(0, Number(need.amountPerPerson) || 0);
      const weight = Math.max(0.001, Number(need.weight) || 1);
      if (amountPerPerson <= 0 || goods.length === 0) continue;
      needs.push({ id, label, category, amountPerPerson: round6(amountPerPerson), weight: round3(weight), goods });
    }
    const id = typeof tier.id === "string" && tier.id.trim() ? tier.id.trim().slice(0, 80) : `tier-${tierIndex + 1}`;
    const minStandardOfLiving = Math.max(0, Number(tier.minStandardOfLiving) || 0);
    if (needs.length > 0) tiers.push({ id, minStandardOfLiving: round3(minStandardOfLiving), needs });
  }
  tiers.sort((a, b) => a.minStandardOfLiving - b.minStandardOfLiving || a.id.localeCompare(b.id));
  return tiers.length > 0 ? { tiers } : null;
}

export function getActiveCultureNeeds(
  cultureNeedsProfile: CultureNeedsProfile | null | undefined,
  standardOfLiving: number,
): CultureNeed[] {
  if (!cultureNeedsProfile) return [];
  return cultureNeedsProfile.tiers
    .filter((tier) => standardOfLiving + 1e-9 >= tier.minStandardOfLiving)
    .flatMap((tier) => tier.needs);
}

export function sortCultureNeedsByPriority(needs: CultureNeed[]): CultureNeed[] {
  return [...needs].sort((a, b) => {
    const categoryDelta = CULTURE_NEED_CATEGORY_ORDER[a.category] - CULTURE_NEED_CATEGORY_ORDER[b.category];
    if (categoryDelta !== 0) return categoryDelta;
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.id.localeCompare(b.id);
  });
}

export function normalizeCompareText(value: string | null | undefined): string {
  return String(value ?? "").trim().toLocaleLowerCase("ru-RU");
}

export function resolvePopulationFallbackKeys(params: {
  domains: PopulationDomainKeys;
  content: PopulationDomainContent;
}): Record<PopulationDimensionKey, string> {
  const fallbackByDimension: Record<PopulationDimensionKey, string> = { ...POPULATION_FALLBACK_KEY_BY_DIMENSION };
  for (const dimension of Object.keys(fallbackByDimension) as PopulationDimensionKey[]) {
    const allowed = new Set(params.domains[dimension]);
    const wantedName = normalizeCompareText(POPULATION_FALLBACK_NAME_BY_DIMENSION[dimension]);
    const found = params.content[dimension].find((entry) => normalizeCompareText(entry.name) === wantedName || normalizeCompareText(entry.id) === normalizeCompareText(POPULATION_FALLBACK_KEY_BY_DIMENSION[dimension]));
    fallbackByDimension[dimension] = found?.id && allowed.has(found.id) ? found.id : (params.domains[dimension][0] ?? POPULATION_FALLBACK_KEY_BY_DIMENSION[dimension]);
  }
  return fallbackByDimension;
}

export function hashStringToUInt32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function normalizePercentageMap(input: unknown, allowedKeys: string[], fallbackKey: string): Record<string, number> {
  const fallback = fallbackKey.trim() || "default";
  const keys = [...new Set(allowedKeys.map((key) => key.trim()).filter(Boolean))];
  const allowed = keys.length > 0 ? keys : [fallback];
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const raw: Record<string, number> = {};
  let total = 0;
  for (const key of allowed) {
    const value = Math.max(0, Number(source[key]) || 0);
    if (value <= 0) continue;
    raw[key] = value;
    total += value;
  }
  if (total <= 0) return { [allowed[0]]: 100 };
  const result: Record<string, number> = {};
  let allocated = 0;
  const rows = Object.entries(raw).map(([key, value]) => ({ key, exact: (value / total) * 10000 }));
  for (const row of rows) {
    const units = Math.floor(row.exact);
    if (units > 0) {
      result[row.key] = units / 100;
      allocated += units;
    }
  }
  rows.sort((a, b) => (b.exact % 1) - (a.exact % 1) || a.key.localeCompare(b.key));
  let remaining = 10000 - allocated;
  let index = 0;
  while (remaining > 0 && rows.length > 0) {
    const key = rows[index % rows.length].key;
    result[key] = round3((result[key] ?? 0) + 0.01);
    remaining -= 1;
    index += 1;
  }
  return Object.keys(result).length > 0 ? result : { [allowed[0]]: 100 };
}

export function normalizePopulationCountMap(
  input: unknown,
  keys: string[],
  fallbackKey: string,
  targetTotal: number,
): Record<string, number> {
  const target = Math.max(0, Math.floor(targetTotal));
  if (target <= 0) return {};
  const allowed = new Set(keys);
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const raw: Record<string, number> = {};
  let total = 0;
  for (const [key, value] of Object.entries(source)) {
    const id = key.trim();
    if (!id || !allowed.has(id)) continue;
    const amount = Math.max(0, Number(value) || 0);
    if (amount <= 0) continue;
    raw[id] = (raw[id] ?? 0) + amount;
    total += amount;
  }
  if (total <= 0) return { [fallbackKey]: target };
  const result: Record<string, number> = {};
  let allocated = 0;
  for (const [key, amount] of Object.entries(raw)) {
    const value = Math.floor((amount / total) * target);
    if (value <= 0) continue;
    result[key] = value;
    allocated += value;
  }
  const remainder = target - allocated;
  if (remainder > 0) {
    const key = result[fallbackKey] != null ? fallbackKey : (Object.keys(result)[0] ?? fallbackKey);
    result[key] = (result[key] ?? 0) + remainder;
  }
  return result;
}

export function buildPopulationCountMapFromPct(
  pctMap: Record<string, number>,
  targetTotal: number,
  fallbackKey: string,
): Record<string, number> {
  return normalizePopulationCountMap(pctMap, Object.keys(pctMap), fallbackKey, targetTotal);
}

export function makeAtomicPopulationPop(input: {
  id: string;
  size: number;
  cultureId: string;
  religionId: string;
  raceId: string;
  professionId: string;
  ideologies?: Record<string, number>;
  qualificationsByCategory?: Record<string, number>;
  previous?: Partial<PopulationPop>;
}): PopulationPop {
  const size = Math.max(0, Math.floor(Number(input.size) || 0));
  const previous = input.previous ?? {};
  return {
    id: input.id,
    size,
    cultureId: input.cultureId,
    religionId: input.religionId,
    raceId: input.raceId,
    professionId: input.professionId,
    literacy: round3(clamp01(Number(previous.literacy ?? DEFAULT_LITERACY))),
    ducats: round3(Math.max(0, Number(previous.ducats ?? 0))),
    standardOfLiving: round3(Math.max(0, Number(previous.standardOfLiving ?? DEFAULT_STANDARD_OF_LIVING))),
    radicals: Math.max(0, Math.floor(Number(previous.radicals ?? 0))),
    loyalists: Math.max(0, Math.floor(Number(previous.loyalists ?? 0))),
    qualificationsByCategory: normalizeNumberRecord(input.qualificationsByCategory ?? previous.qualificationsByCategory ?? {}),
    ideologies: normalizePopulationCountMap(input.ideologies ?? previous.ideologies ?? {}, Object.keys(input.ideologies ?? previous.ideologies ?? { "ideology:default": 1 }), Object.keys(input.ideologies ?? previous.ideologies ?? { "ideology:default": 1 })[0] ?? "ideology:default", size),
    lastIncomeDucats: round3(Math.max(0, Number(previous.lastIncomeDucats ?? 0))),
    lastNeedsSpendDucats: round3(Math.max(0, Number(previous.lastNeedsSpendDucats ?? 0))),
    lastNeedsSatisfaction: round3(Math.max(0, Number(previous.lastNeedsSatisfaction ?? 1))),
    lastNeedsByCategory: normalizeNeedCategoryStats(previous.lastNeedsByCategory),
    lastNeedsDeficitByGood: normalizeNumberRecord(previous.lastNeedsDeficitByGood ?? {}),
    lastNeedsBudgetShortageByGood: normalizeNumberRecord(previous.lastNeedsBudgetShortageByGood ?? {}),
    lastBirths: Math.max(0, Math.floor(Number(previous.lastBirths ?? 0))),
    lastDeaths: Math.max(0, Math.floor(Number(previous.lastDeaths ?? 0))),
    lastJobStatus: previous.lastJobStatus ?? (input.professionId.includes("unemployed") ? "unemployed" : "employed"),
    lastEmployed: round3(Math.max(0, Number(previous.lastEmployed ?? (input.professionId.includes("unemployed") ? 0 : size)))),
    lastOpenJobs: round3(Math.max(0, Number(previous.lastOpenJobs ?? 0))),
    lastQualificationLimit: round3(Math.max(0, Number(previous.lastQualificationLimit ?? size))),
    lastDiscriminationPenalty: round3(Math.max(0, Number(previous.lastDiscriminationPenalty ?? 0))),
    politicalStrength: round3(Math.max(0, Number(previous.politicalStrength ?? size))),
  };
}

export function normalizePopulationPopsStrict(params: {
  rawPops: unknown;
  regionId: string;
  domains: PopulationDomainKeys;
}): PopulationPop[] {
  if (!Array.isArray(params.rawPops)) return [];
  const seen = new Set<string>();
  const pops: PopulationPop[] = [];
  for (const [index, raw] of params.rawPops.entries()) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<PopulationPop> & { professions?: unknown };
    if (row.professions != null) {
      throw new Error(`population-old-professions-shape:${params.regionId}`);
    }
    const size = Math.max(0, Math.floor(Number(row.size) || 0));
    if (size <= 0) continue;
    const cultureId = requireKnownId(row.cultureId, params.domains.culturePct, "cultureId", params.regionId);
    const religionId = requireKnownId(row.religionId, params.domains.religionPct, "religionId", params.regionId);
    const raceId = requireKnownId(row.raceId, params.domains.racePct, "raceId", params.regionId);
    const professionId = requireKnownId(row.professionId, params.domains.professionPct, "professionId", params.regionId);
    const baseId = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `pop:${params.regionId}:${index}`;
    let id = baseId;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${baseId}:${suffix}`;
      suffix += 1;
    }
    seen.add(id);
    pops.push(makeAtomicPopulationPop({
      id,
      size,
      cultureId,
      religionId,
      raceId,
      professionId,
      ideologies: row.ideologies,
      qualificationsByCategory: row.qualificationsByCategory,
      previous: row,
    }));
  }
  return pops;
}

export function normalizeRegionPopulation(params: {
  input: unknown;
  regionId: string;
  domains: PopulationDomainKeys;
}): RegionPopulation {
  if (params.input == null) return { pops: [] };
  if (!params.input || typeof params.input !== "object") throw new Error(`population-invalid-region:${params.regionId}`);
  const row = params.input as Partial<RegionPopulation> & { populationTotal?: unknown; pops?: unknown };
  if (row.populationTotal != null) throw new Error(`population-old-populationTotal:${params.regionId}`);
  return { pops: normalizePopulationPopsStrict({ rawPops: row.pops ?? [], regionId: params.regionId, domains: params.domains }) };
}

export function normalizeRegionPopulationMap(params: {
  input: unknown;
  regionIds: string[];
  domains: PopulationDomainKeys;
}): Record<string, RegionPopulation> {
  const normalized: Record<string, RegionPopulation> = {};
  if (params.input && typeof params.input === "object") {
    for (const [regionId, raw] of Object.entries(params.input as Record<string, unknown>)) {
      normalized[regionId] = normalizeRegionPopulation({ input: raw, regionId, domains: params.domains });
    }
  }
  for (const regionId of params.regionIds) normalized[regionId] ??= { pops: [] };
  return normalized;
}

export function isEqualRegionPopulation(prevValue: RegionPopulation | undefined, nextValue: RegionPopulation): boolean {
  return JSON.stringify(prevValue ?? { pops: [] }) === JSON.stringify(nextValue ?? { pops: [] });
}

export function getPopulationTotal(population: RegionPopulation | undefined | null): number {
  return Math.max(0, Math.floor((population?.pops ?? []).reduce((sum, pop) => sum + Math.max(0, Number(pop.size)), 0)));
}

export function calculateWorkforceDemand(sources: WorkforceDemandSource[]): WorkforceDemandSummary {
  const demandByProfession: Record<string, number> = {};
  let totalWorkforceDemand = 0;
  for (const source of sources) {
    const level = Math.max(1, Math.floor(Number(source.level ?? 1)));
    for (const requirement of source.workforceRequirements ?? []) {
      const professionId = typeof requirement.professionId === "string" ? requirement.professionId.trim() : "";
      if (!professionId) continue;
      const workersDemand = Math.max(0, Number(requirement.workers) || 0) * level;
      if (workersDemand <= 0) continue;
      demandByProfession[professionId] = round3((demandByProfession[professionId] ?? 0) + workersDemand);
      totalWorkforceDemand = round3(totalWorkforceDemand + workersDemand);
    }
  }
  return { demandByProfession, totalWorkforceDemand };
}

export function calculateLaborCoverage(populationTotal: number, totalWorkforceDemand: number): number {
  return totalWorkforceDemand > 0 ? round3(Math.max(0, Math.min(1, populationTotal / totalWorkforceDemand))) : 1;
}

export function calculateAvailableProfessionPopulation(population: RegionPopulation): Record<string, number> {
  const availableByProfession: Record<string, number> = {};
  for (const pop of population.pops) {
    availableByProfession[pop.professionId] = round3((availableByProfession[pop.professionId] ?? 0) + Math.max(0, Number(pop.size)));
  }
  return availableByProfession;
}

export function calculateWageMultipliers(params: {
  demandByProfession: Record<string, number>;
  availableByProfession: Record<string, number>;
}): Record<string, number> {
  const wageMultiplierByProfession: Record<string, number> = {};
  for (const [professionId, demand] of Object.entries(params.demandByProfession)) {
    const available = Math.max(1, params.availableByProfession[professionId] ?? 0);
    const shortageRatio = demand / available;
    wageMultiplierByProfession[professionId] = round3(Math.max(0.5, Math.min(3, shortageRatio > 1 ? 1 + (shortageRatio - 1) * 0.5 : 1)));
  }
  return wageMultiplierByProfession;
}

export function allocatePopulationJobs(params: {
  population: RegionPopulation;
  demandByProfession: Record<string, number>;
  fallbackProfessionId: string;
  professionsById?: ReadonlyMap<string, ProfessionQualificationEntry>;
  acceptanceContext?: PopulationAcceptanceContext;
  activeLaws?: PopulationAcceptanceContentEntry[];
}): PopulationJobAllocationResult {
  const remainingDemand: Record<string, number> = { ...params.demandByProfession };
  const employedByProfession: Record<string, number> = {};
  const nextPops: PopulationPop[] = [];
  const sortedPops = [...params.population.pops].sort((left, right) => {
    const leftDiscrimination = resolvePopDiscrimination({ pop: left, context: params.acceptanceContext, activeLaws: params.activeLaws });
    const rightDiscrimination = resolvePopDiscrimination({ pop: right, context: params.acceptanceContext, activeLaws: params.activeLaws });
    if (leftDiscrimination.status !== rightDiscrimination.status) return leftDiscrimination.status === "accepted" ? -1 : 1;
    return right.size - left.size || left.id.localeCompare(right.id);
  });
  for (const pop of sortedPops) {
    const discrimination = resolvePopDiscrimination({ pop, context: params.acceptanceContext, activeLaws: params.activeLaws });
    const qualificationLimit = resolvePopQualificationLimit(pop, params.professionsById?.get(pop.professionId));
    let remainingPopSize = Math.max(0, pop.size);
    let remainingQualification = round3(qualificationLimit * (1 - discrimination.hiringPenaltyPct));
    for (const professionId of Object.keys(remainingDemand).sort()) {
      const wanted = Math.max(0, remainingDemand[professionId] ?? 0);
      const professionQualification = params.professionsById?.get(professionId);
      const professionLimit = resolvePopQualificationLimit(pop, professionQualification);
      remainingQualification = Math.min(remainingQualification, round3(professionLimit * (1 - discrimination.hiringPenaltyPct)));
      if (wanted <= 0 || remainingPopSize <= 0 || remainingQualification <= 0) continue;
      const employed = Math.min(remainingPopSize, wanted, remainingQualification);
      const shortage = resolveQualificationShortageByCategory(pop, professionQualification, employed);
      remainingDemand[professionId] = round3(Math.max(0, wanted - employed));
      employedByProfession[professionId] = round3((employedByProfession[professionId] ?? 0) + employed);
      nextPops.push({
        ...pop,
        id: professionId === pop.professionId ? pop.id : `${pop.id}:${toPopulationIdSegment(professionId)}`,
        size: Math.floor(employed),
        professionId,
        lastJobStatus: "employed",
        lastEmployed: round3(employed),
        lastOpenJobs: round3(remainingDemand[professionId] ?? 0),
        lastQualificationLimit: round3(qualificationLimit),
        lastQualificationShortageByCategory: shortage,
        lastDiscriminationStatus: discrimination.status,
        lastDiscriminationReasons: discrimination.reasons,
        lastDiscriminationPenalty: discrimination.hiringPenaltyPct,
      });
      remainingPopSize = round3(remainingPopSize - employed);
      remainingQualification = round3(remainingQualification - employed);
    }
    if (remainingPopSize > 0) {
      nextPops.push({
        ...pop,
        id: pop.professionId === params.fallbackProfessionId ? pop.id : `${pop.id}:unemployed`,
        size: Math.floor(remainingPopSize),
        professionId: params.fallbackProfessionId,
        lastJobStatus: "unemployed",
        lastEmployed: 0,
        lastOpenJobs: round3(Object.values(remainingDemand).reduce((sum, value) => sum + Math.max(0, Number(value)), 0)),
        lastQualificationLimit: round3(qualificationLimit),
        lastQualificationShortageByCategory: resolveQualificationShortageByCategory(pop, params.professionsById?.get(pop.professionId), 0),
        lastDiscriminationStatus: discrimination.status,
        lastDiscriminationReasons: discrimination.reasons,
        lastDiscriminationPenalty: discrimination.hiringPenaltyPct,
      });
    }
  }
  return { nextPopulation: mergeCompatiblePops({ pops: nextPops }), employedByProfession };
}

export function getPopProfessionMetrics(pop: PopulationPop): {
  averageSoL: number;
  radicalPct: number;
  loyalistPct: number;
  professionShareById: Record<string, number>;
} {
  const total = Math.max(1, Number(pop.size));
  return {
    averageSoL: round3(pop.standardOfLiving),
    radicalPct: round3((Math.max(0, pop.radicals) / total) * 100),
    loyalistPct: round3((Math.max(0, pop.loyalists) / total) * 100),
    professionShareById: { [pop.professionId]: 1 },
  };
}

export function evaluateIdeologyAttractionRule(params: {
  rule: IdeologyAttractionRule;
  pop: PopulationPop;
  countryId: string | null;
  activeLawIds: Set<string>;
  activeModifierIds: Set<string>;
  provinceBuildingIds: Set<string>;
  metrics: ReturnType<typeof getPopProfessionMetrics>;
}): number {
  const { rule, pop, countryId, activeLawIds, activeModifierIds, provinceBuildingIds, metrics } = params;
  const threshold = Math.max(0, Number(rule.threshold ?? 0));
  let match = 0;
  if (rule.type === "sol_below") match = metrics.averageSoL < threshold ? Math.min(1, (threshold - metrics.averageSoL) / Math.max(1, threshold)) : 0;
  else if (rule.type === "sol_above") match = metrics.averageSoL > threshold ? Math.min(1, (metrics.averageSoL - threshold) / Math.max(1, threshold)) : 0;
  else if (rule.type === "radicals_above") match = metrics.radicalPct > threshold ? Math.min(1, (metrics.radicalPct - threshold) / 100) : 0;
  else if (rule.type === "loyalists_above") match = metrics.loyalistPct > threshold ? Math.min(1, (metrics.loyalistPct - threshold) / 100) : 0;
  else if (rule.type === "profession_is") match = rule.targetId && pop.professionId === rule.targetId ? 1 : 0;
  else if (rule.type === "religion_is") match = rule.targetId && pop.religionId === rule.targetId ? 1 : 0;
  else if (rule.type === "culture_is") match = rule.targetId && pop.cultureId === rule.targetId ? 1 : 0;
  else if (rule.type === "law_active") match = rule.targetId && activeLawIds.has(rule.targetId) ? 1 : 0;
  else if (rule.type === "has_building") match = rule.targetId && provinceBuildingIds.has(rule.targetId) ? 1 : 0;
  else if (rule.type === "country_modifier_active" || rule.type === "region_modifier_active") match = rule.targetId && activeModifierIds.has(rule.targetId) ? 1 : 0;
  if (rule.invert) match = match > 0 ? 0 : 1;
  if (!countryId && (rule.type === "law_active" || rule.type === "country_modifier_active")) return 0;
  return Math.max(0, Number(rule.weight ?? 0)) * Math.max(0, Math.min(1, match));
}

export function applyIdeologyAttractionToPopulation(params: {
  population: RegionPopulation;
  ideologies: PopulationIdeologyContentEntry[];
  countryId: string | null;
  activeLawIds: Set<string>;
  activeModifierIds: Set<string>;
  provinceBuildingIds: Set<string>;
  attractionRate?: number;
}): RegionPopulation {
  const ideologyIds = params.ideologies.map((entry) => entry.id);
  if (ideologyIds.length === 0) return params.population;
  const attractionRate = Math.max(0, Math.min(1, params.attractionRate ?? 0.02));
  return {
    pops: params.population.pops.map((pop) => {
      const total = Math.max(0, Math.floor(pop.size));
      if (total <= 0) return pop;
      const metrics = getPopProfessionMetrics(pop);
      const scores: Record<string, number> = {};
      for (const ideology of params.ideologies) {
        const score = (ideology.ideologyAttractionRules ?? []).reduce(
          (sum, rule) => sum + evaluateIdeologyAttractionRule({ rule, pop, countryId: params.countryId, activeLawIds: params.activeLawIds, activeModifierIds: params.activeModifierIds, provinceBuildingIds: params.provinceBuildingIds, metrics }),
          0,
        );
        if (score > 0) scores[ideology.id] = score;
      }
      const scoreTotal = Object.values(scores).reduce((sum, value) => sum + value, 0);
      if (scoreTotal <= 0) return pop;
      const current = normalizePopulationCountMap(pop.ideologies, ideologyIds, ideologyIds[0] ?? "ideology:default", total);
      const mixed: Record<string, number> = {};
      for (const ideologyId of ideologyIds) {
        mixed[ideologyId] = (current[ideologyId] ?? 0) * (1 - attractionRate) + ((scores[ideologyId] ?? 0) / scoreTotal) * total * attractionRate;
      }
      return { ...pop, ideologies: normalizePopulationCountMap(mixed, ideologyIds, ideologyIds[0] ?? "ideology:default", total) };
    }),
  };
}

export function resolveRegionPopulationNeedsTurn(params: {
  population: RegionPopulation;
  demandByProfession: Record<string, number>;
  wagesByProfession: Record<string, number>;
  fallbackProfessionId: string;
  professionsById?: ReadonlyMap<string, ProfessionQualificationEntry>;
  acceptanceContext?: PopulationAcceptanceContext;
  activeLaws?: PopulationAcceptanceContentEntry[];
  getNeedsForPop: (pop: PopulationPop) => CultureNeedLike[];
  getGoodPrice: (goodId: string) => number;
  getAvailableGoodAmount: (goodId: string) => number;
  purchaseGood: (goodId: string, requestedPhysicalAmount: number, wallet: number) => PopulationNeedsPurchaseResult;
}): PopulationNeedsTurnResult {
  const allocation = allocatePopulationJobs({
    population: params.population,
    demandByProfession: params.demandByProfession,
    fallbackProfessionId: params.fallbackProfessionId,
    professionsById: params.professionsById,
    acceptanceContext: params.acceptanceContext,
    activeLaws: params.activeLaws,
  });
  const professionTotals = calculateAvailableProfessionPopulation(allocation.nextPopulation);
  const demandRequestedByGood: Record<string, number> = {};
  const nextPops = allocation.nextPopulation.pops.map((pop) => {
    const professionTotal = Math.max(1, professionTotals[pop.professionId] ?? pop.size);
    const discrimination = resolvePopDiscrimination({ pop, context: params.acceptanceContext, activeLaws: params.activeLaws });
    const income = round3(Math.max(0, Number(params.wagesByProfession[pop.professionId] ?? 0)) * (pop.size / professionTotal) * (1 - discrimination.wagePenaltyPct));
    const result = resolvePopulationPopNeedsTurn({
      pop,
      needs: params.getNeedsForPop(pop),
      income,
      discrimination,
      profession: params.professionsById?.get(pop.professionId),
      getGoodPrice: params.getGoodPrice,
      getAvailableGoodAmount: params.getAvailableGoodAmount,
      purchaseGood: params.purchaseGood,
    });
    for (const [goodId, amount] of Object.entries(result.demandRequestedByGood)) {
      demandRequestedByGood[goodId] = round3((demandRequestedByGood[goodId] ?? 0) + amount);
    }
    return result.nextPop;
  });
  return { nextPopulation: mergeCompatiblePops({ pops: nextPops }), demandRequestedByGood };
}

export function resolvePopulationTurnForRegions(params: {
  regionIds: string[];
  currentPopulationByRegion: Record<string, RegionPopulation | undefined>;
  nextPopulationByRegion: Record<string, RegionPopulation | undefined>;
  domains: PopulationDomainKeys;
  ideologies: PopulationIdeologyContentEntry[];
  getIdeologyContext: (regionId: string) => RegionPopulationIdeologyContext;
}): ResolvePopulationTurnResult {
  const nextPopulationByRegion: Record<string, RegionPopulation> = {};
  const changedRegionIds: string[] = [];
  for (const regionId of params.regionIds) {
    const current = normalizeRegionPopulation({ input: params.currentPopulationByRegion[regionId], regionId, domains: params.domains });
    const base = params.nextPopulationByRegion[regionId] ?? current;
    const ideologyContext = params.getIdeologyContext(regionId);
    const next = applyIdeologyAttractionToPopulation({
      population: base,
      ideologies: params.ideologies,
      countryId: ideologyContext.countryId,
      activeLawIds: ideologyContext.activeLawIds,
      activeModifierIds: ideologyContext.activeModifierIds,
      provinceBuildingIds: ideologyContext.provinceBuildingIds,
    });
    nextPopulationByRegion[regionId] = next;
    if (!isEqualRegionPopulation(params.currentPopulationByRegion[regionId], next)) changedRegionIds.push(regionId);
  }
  return { nextPopulationByRegion, changedRegionIds };
}

function resolvePopulationPopNeedsTurn(params: {
  pop: PopulationPop;
  needs: CultureNeedLike[];
  income: number;
  discrimination: PopulationDiscriminationResult;
  profession?: ProfessionQualificationEntry;
  getGoodPrice: (goodId: string) => number;
  getAvailableGoodAmount: (goodId: string) => number;
  purchaseGood: (goodId: string, requestedPhysicalAmount: number, wallet: number) => PopulationNeedsPurchaseResult;
}): { nextPop: PopulationPop; demandRequestedByGood: Record<string, number> } {
  let wallet = round3(Math.max(0, params.pop.ducats + params.income));
  let weightedSatisfiedNeed = 0;
  let totalNeedWeight = 0;
  let needsSpend = 0;
  let theoreticalNeedCost = 0;
  const categoryStats: PopulationNeedCategoryStats = {};
  const deficitByGood: Record<string, number> = {};
  const budgetShortageByGood: Record<string, number> = {};
  const demandRequestedByGood: Record<string, number> = {};
  for (const need of params.needs) {
    const required = round3(params.pop.size * need.amountPerPerson);
    if (required <= 0) continue;
    const categoryWeight = CULTURE_NEED_CATEGORY_SATISFACTION_WEIGHT[need.category] * need.weight;
    totalNeedWeight += categoryWeight;
    const categoryEntry = categoryStats[need.category] ?? { required: 0, fulfilled: 0, spend: 0, satisfaction: 0 };
    categoryEntry.required = round3(categoryEntry.required + required);
    categoryStats[need.category] = categoryEntry;
    const viableGoods = need.goods
      .filter((good) => good.taboo !== true)
      .map((good) => ({
        ...good,
        effectivePerUnit: Math.max(0.001, good.weight),
        preferenceWeight: Math.max(0.001, good.weight) * Math.max(1, good.obsessionMultiplier ?? 1),
        price: params.getGoodPrice(good.goodId),
      }))
      .filter((good) => Number.isFinite(good.price) && good.price > 0)
      .sort((a, b) => a.price / a.preferenceWeight - b.price / b.preferenceWeight || b.preferenceWeight - a.preferenceWeight);
    if (viableGoods.length === 0) continue;
    theoreticalNeedCost += required * (viableGoods[0].price / viableGoods[0].effectivePerUnit);
    let remainingNeedUnits = required;
    for (const good of viableGoods) {
      if (remainingNeedUnits <= 0.001 || wallet <= 0.001) break;
      const requestedPhysicalAmount = round3(Math.min(remainingNeedUnits / good.effectivePerUnit, wallet / good.price));
      if (requestedPhysicalAmount <= 0) continue;
      demandRequestedByGood[good.goodId] = round3((demandRequestedByGood[good.goodId] ?? 0) + requestedPhysicalAmount);
      if (params.getAvailableGoodAmount(good.goodId) <= 0) {
        deficitByGood[good.goodId] = round3((deficitByGood[good.goodId] ?? 0) + requestedPhysicalAmount);
        continue;
      }
      const purchase = params.purchaseGood(good.goodId, requestedPhysicalAmount, wallet);
      wallet = purchase.wallet;
      needsSpend = round3(needsSpend + purchase.spent);
      categoryEntry.spend = round3(categoryEntry.spend + purchase.spent);
      const fulfilledNeedUnits = round3(purchase.purchasedPhysicalAmount * good.effectivePerUnit);
      remainingNeedUnits = round3(Math.max(0, remainingNeedUnits - fulfilledNeedUnits));
      categoryEntry.fulfilled = round3(categoryEntry.fulfilled + fulfilledNeedUnits);
      const deficit = round3(Math.max(0, requestedPhysicalAmount - purchase.purchasedPhysicalAmount));
      if (deficit > 0) deficitByGood[good.goodId] = round3((deficitByGood[good.goodId] ?? 0) + deficit);
    }
    if (remainingNeedUnits > 0.001 && wallet <= 0.001) {
      const good = viableGoods[0];
      budgetShortageByGood[good.goodId] = round3((budgetShortageByGood[good.goodId] ?? 0) + remainingNeedUnits / good.effectivePerUnit);
    }
    const needSatisfaction = Math.max(0, Math.min(1.5, (required - remainingNeedUnits) / required));
    weightedSatisfiedNeed += needSatisfaction * categoryWeight;
  }
  const satisfaction = totalNeedWeight > 0 ? round3(weightedSatisfiedNeed / totalNeedWeight) : 1;
  for (const row of Object.values(categoryStats)) row.satisfaction = row.required > 0 ? round3(row.fulfilled / row.required) : 1;
  const targetSoL = getTargetStandardOfLiving(satisfaction, theoreticalNeedCost > 0 ? wallet / theoreticalNeedCost : 1);
  const nextSoL = round3(params.pop.standardOfLiving * 0.8 + targetSoL * 0.2);
  const { birthRate, deathRate } = getBirthDeathRatesBySoL(nextSoL, satisfaction, categoryStats);
  const births = Math.floor(params.pop.size * birthRate);
  const deaths = Math.floor(params.pop.size * deathRate);
  const nextSize = Math.max(0, params.pop.size + births - deaths);
  const solDelta = nextSoL - params.pop.standardOfLiving;
  const discriminationRadicals = params.discrimination.status === "discriminated"
    ? params.pop.size * params.discrimination.radicalizationPerTurn
    : 0;
  const radicals = Math.max(0, Math.floor(params.pop.radicals * 0.98 + discriminationRadicals + (solDelta < 0 ? params.pop.size * Math.abs(solDelta) * 0.01 : 0) + (satisfaction < 0.6 ? params.pop.size * (0.6 - satisfaction) * 0.02 : 0)));
  const loyalists = Math.max(0, Math.floor(params.pop.loyalists * 0.98 + (solDelta > 0 ? params.pop.size * solDelta * 0.008 : 0)));
  const politicalStrength = round3(
    nextSize *
      Math.max(0.05, nextSoL / 10) *
      Math.max(0.1, params.pop.literacy) *
      (1 - params.discrimination.politicalStrengthPenaltyPct),
  );
  return {
    nextPop: {
      ...params.pop,
      size: nextSize,
      ducats: wallet,
      standardOfLiving: nextSoL,
      radicals,
      loyalists,
      literacy: round3(Math.min(1, params.pop.literacy + Math.max(0, nextSoL - 8) * 0.0005)),
      qualificationsByCategory: growQualifications(params.pop, nextSoL, params.profession, params.discrimination),
      lastIncomeDucats: params.income,
      lastNeedsSpendDucats: needsSpend,
      lastNeedsSatisfaction: satisfaction,
      lastNeedsByCategory: categoryStats,
      lastNeedsDeficitByGood: deficitByGood,
      lastNeedsBudgetShortageByGood: budgetShortageByGood,
      lastBirths: births,
      lastDeaths: deaths,
      lastDiscriminationStatus: params.discrimination.status,
      lastDiscriminationReasons: params.discrimination.reasons,
      lastDiscriminationPenalty: Math.max(params.discrimination.wagePenaltyPct, params.discrimination.hiringPenaltyPct, params.discrimination.politicalStrengthPenaltyPct),
      politicalStrength,
    },
    demandRequestedByGood,
  };
}

export function getTargetStandardOfLiving(satisfaction: number, walletToNeedsRatio: number): number {
  const base = satisfaction < 0.35 ? 3 : satisfaction < 0.6 ? 6 : satisfaction < 0.85 ? 9 : satisfaction < 1 ? 11 : satisfaction < 1.25 ? 14 : satisfaction < 1.6 ? 18 : 22;
  return round3(Math.max(0, Math.min(30, base + Math.max(0, Math.min(4, walletToNeedsRatio)))));
}

export function getBirthDeathRatesBySoL(
  standardOfLiving: number,
  satisfaction: number,
  categoryStats: Record<string, { satisfaction: number }>,
): { birthRate: number; deathRate: number } {
  const sol = Math.max(0, standardOfLiving);
  const survival = Math.max(0, Math.min(1.5, Number(categoryStats.survival?.satisfaction ?? 1)));
  const basic = Math.max(0, Math.min(1.5, Number(categoryStats.basic?.satisfaction ?? 1)));
  const birthRate = POPULATION_BIRTH_RATE * (sol < 8 ? 1.1 : sol > 18 ? 0.75 : 1) * (survival < 0.85 ? 0.92 : 1) * (basic < 0.75 ? 0.96 : 1);
  const deathRate = POPULATION_DEATH_RATE * (sol < 6 ? 1.8 : sol < 10 ? 1.2 : sol > 18 ? 0.7 : 1) + (satisfaction < 0.6 ? (0.6 - satisfaction) * 0.03 : 0) + (survival < 0.95 ? (0.95 - survival) * 0.05 : 0);
  return { birthRate, deathRate };
}

function mergeCompatiblePops(population: RegionPopulation): RegionPopulation {
  const byKey = new Map<string, PopulationPop>();
  for (const pop of population.pops) {
    if (pop.size <= 0) continue;
    const key = `${pop.cultureId}|${pop.religionId}|${pop.raceId}|${pop.professionId}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, pop);
      continue;
    }
    const total = existing.size + pop.size;
    byKey.set(key, {
      ...pop,
      id: existing.id,
      size: total,
      ducats: round3(existing.ducats + pop.ducats),
      radicals: existing.radicals + pop.radicals,
      loyalists: existing.loyalists + pop.loyalists,
      standardOfLiving: round3((existing.standardOfLiving * existing.size + pop.standardOfLiving * pop.size) / Math.max(1, total)),
      literacy: round3((existing.literacy * existing.size + pop.literacy * pop.size) / Math.max(1, total)),
    });
  }
  return { pops: [...byKey.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

function resolvePopQualificationLimit(pop: PopulationPop, profession?: ProfessionQualificationEntry | null): number {
  const requirements = profession?.qualificationRequirements ?? {};
  const entries = Object.entries(requirements).filter(([, required]) => required > 0);
  if (entries.length === 0) {
    const values = Object.values(pop.qualificationsByCategory ?? {});
    if (values.length === 0) return pop.professionId.includes("unemployed") ? 0 : pop.size;
    return Math.max(0, Math.min(pop.size, Math.max(...values)));
  }
  let limit = pop.size;
  for (const [category, requiredPerWorker] of entries) {
    const available = Math.max(0, Number(pop.qualificationsByCategory?.[category] ?? 0));
    limit = Math.min(limit, available / Math.max(0.001, requiredPerWorker));
  }
  return Math.max(0, Math.min(pop.size, Math.floor(limit)));
}

function resolveQualificationShortageByCategory(
  pop: PopulationPop,
  profession: ProfessionQualificationEntry | null | undefined,
  targetWorkers: number,
): Record<string, number> {
  const shortages: Record<string, number> = {};
  for (const [category, requiredPerWorker] of Object.entries(profession?.qualificationRequirements ?? {})) {
    const required = Math.max(0, requiredPerWorker) * Math.max(0, targetWorkers);
    const available = Math.max(0, Number(pop.qualificationsByCategory?.[category] ?? 0));
    const shortage = round3(Math.max(0, required - available));
    if (shortage > 0) shortages[category] = shortage;
  }
  return shortages;
}

export function resolvePopDiscrimination(params: {
  pop: PopulationPop;
  context?: PopulationAcceptanceContext;
  activeLaws?: PopulationAcceptanceContentEntry[];
}): PopulationDiscriminationResult {
  const context = params.context;
  if (!context || !context.countryId) return emptyDiscrimination("accepted", []);
  let acceptedCultureIds = new Set(context.acceptedCultureIds);
  let acceptedReligionIds = new Set(context.acceptedReligionIds);
  let acceptedRaceIds = new Set(context.acceptedRaceIds);
  const lawEffects: Array<NonNullable<PopulationAcceptanceContentEntry["discrimination"]>> = [];
  for (const law of params.activeLaws ?? []) {
    if (law.acceptanceMode === "replace") {
      acceptedCultureIds = new Set(law.acceptedCultureIds ?? []);
      acceptedReligionIds = new Set(law.acceptedReligionIds ?? []);
      acceptedRaceIds = new Set(law.acceptedRaceIds ?? []);
    } else {
      for (const id of law.acceptedCultureIds ?? []) acceptedCultureIds.add(id);
      for (const id of law.acceptedReligionIds ?? []) acceptedReligionIds.add(id);
      for (const id of law.acceptedRaceIds ?? []) acceptedRaceIds.add(id);
    }
    if (law.discrimination) lawEffects.push(law.discrimination);
  }
  const reasons: string[] = [];
  if (acceptedCultureIds.size > 0 && !acceptedCultureIds.has(params.pop.cultureId)) reasons.push("culture");
  if (acceptedReligionIds.size > 0 && !acceptedReligionIds.has(params.pop.religionId)) reasons.push("religion");
  if (acceptedRaceIds.size > 0 && !acceptedRaceIds.has(params.pop.raceId)) reasons.push("race");
  if (reasons.length === 0) return emptyDiscrimination("accepted", []);
  const merged = lawEffects.reduce<Omit<PopulationDiscriminationResult, "status" | "reasons">>((acc, effect) => ({
    wagePenaltyPct: Math.max(acc.wagePenaltyPct, effect.wagePenaltyPct ?? 0),
    hiringPenaltyPct: Math.max(acc.hiringPenaltyPct, effect.hiringPenaltyPct ?? 0),
    qualificationGrowthPenaltyPct: Math.max(acc.qualificationGrowthPenaltyPct, effect.qualificationGrowthPenaltyPct ?? 0),
    politicalStrengthPenaltyPct: Math.max(acc.politicalStrengthPenaltyPct, effect.politicalStrengthPenaltyPct ?? 0),
    radicalizationPerTurn: Math.max(acc.radicalizationPerTurn, effect.radicalizationPerTurn ?? 0),
  }), {
    wagePenaltyPct: 0.15,
    hiringPenaltyPct: 0.25,
    qualificationGrowthPenaltyPct: 0.25,
    politicalStrengthPenaltyPct: 0.5,
    radicalizationPerTurn: 0.001,
  });
  return { status: "discriminated", reasons, ...merged };
}

function emptyDiscrimination(status: "accepted" | "discriminated", reasons: string[]): PopulationDiscriminationResult {
  return {
    status,
    reasons,
    wagePenaltyPct: 0,
    hiringPenaltyPct: 0,
    qualificationGrowthPenaltyPct: 0,
    politicalStrengthPenaltyPct: 0,
    radicalizationPerTurn: 0,
  };
}

function growQualifications(
  pop: PopulationPop,
  standardOfLiving: number,
  profession: ProfessionQualificationEntry | undefined,
  discrimination: PopulationDiscriminationResult,
): Record<string, number> {
  const next = { ...pop.qualificationsByCategory };
  const growth = Math.max(0.01, pop.literacy * 0.05 + Math.max(0, standardOfLiving - 8) * 0.01) * (1 - discrimination.qualificationGrowthPenaltyPct);
  for (const key of Object.keys(next)) next[key] = round3(Math.min(pop.size, Math.max(0, next[key]) + growth));
  for (const [key, value] of Object.entries(profession?.qualificationGrowthRules ?? {})) {
    next[key] = round3(Math.max(0, Math.min(pop.size, (next[key] ?? 0) + value * (1 - discrimination.qualificationGrowthPenaltyPct))));
  }
  return next;
}

function toPopulationIdSegment(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9:_-]+/g, "_").replace(/:/g, "_") || "unknown";
}

function requireKnownId(value: unknown, allowed: string[], field: string, regionId: string): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) throw new Error(`population-missing-${field}:${regionId}`);
  if (!allowed.includes(id)) throw new Error(`population-unknown-${field}:${regionId}:${id}`);
  return id;
}

function normalizeNumberRecord(input: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => key.trim().length > 0 && Number(value) > 0)
      .map(([key, value]) => [key, round3(Math.max(0, Number(value)))]),
  );
}

function normalizeNeedCategoryStats(input: PopulationPop["lastNeedsByCategory"]): PopulationPop["lastNeedsByCategory"] {
  if (!input) return {};
  return Object.fromEntries(Object.entries(input).map(([key, row]) => [key, {
    required: round3(Math.max(0, Number(row.required))),
    fulfilled: round3(Math.max(0, Number(row.fulfilled))),
    spend: round3(Math.max(0, Number(row.spend))),
    satisfaction: round3(Math.max(0, Number(row.satisfaction))),
  }]));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
