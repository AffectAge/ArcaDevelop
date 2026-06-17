import type { IdeologyAttractionRule, PopulationPop, PopulationProfessionState, RegionPopulation } from "@arcanorum/shared";

export type PopulationDimensionKey = "culturePct" | "ideologyPct" | "religionPct" | "racePct" | "professionPct";

export type PopulationDomainKeys = {
  culturePct: string[];
  ideologyPct: string[];
  religionPct: string[];
  racePct: string[];
  professionPct: string[];
};

export type PopulationDomainContent = Record<PopulationDimensionKey, Array<{ id: string; name?: string | null }>>;

export type PopulationBreakdownMaps = {
  culturePct: Record<string, number>;
  ideologyPct: Record<string, number>;
  religionPct: Record<string, number>;
  racePct: Record<string, number>;
  professionPct: Record<string, number>;
};

export type PopulationProfessionMetrics = {
  averageSoL: number;
  radicalPct: number;
  loyalistPct: number;
  professionShareById: Record<string, number>;
};

export type PopulationIdeologyContentEntry = {
  id: string;
  ideologyAttractionRules?: IdeologyAttractionRule[];
};

export type CultureNeedCategory = "survival" | "basic" | "comfort" | "luxury";

export type CultureNeedGoodLike = {
  goodId: string;
  weight: number;
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

export type PopulationProfessionNeedsResult = {
  nextState: PopulationProfessionState;
  demandRequestedByGood: Record<string, number>;
};

export type RegionPopulationNeedsResult = {
  nextProfessionsByPopId: Record<string, Record<string, PopulationProfessionState>>;
  demandRequestedByGood: Record<string, number>;
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

export const POPULATION_MIN_TOTAL = 100;
export const POPULATION_DEFAULT_BASE_TOTAL = 10_000;
export const POPULATION_BIRTH_RATE = 0.012;
export const POPULATION_DEATH_RATE = 0.008;
export const DEFAULT_STANDARD_OF_LIVING = 8;

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

export const POPULATION_FALLBACK_KEY_BY_DIMENSION: Record<PopulationDimensionKey, string> = {
  culturePct: "culture:default",
  ideologyPct: "ideology:default",
  religionPct: "religion:default",
  racePct: "race:default",
  professionPct: "profession:default",
};

export const POPULATION_FALLBACK_NAME_BY_DIMENSION: Record<PopulationDimensionKey, string> = {
  culturePct: "Без культуры",
  ideologyPct: "Без идеологии",
  religionPct: "Атеизм",
  racePct: "Люди",
  professionPct: "Безработные",
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
      const goodsRaw = Array.isArray(need.goods) ? need.goods : [];
      const goods: CultureNeedGood[] = goodsRaw
        .map((raw) => {
          if (!raw || typeof raw !== "object") return null;
          const row = raw as Partial<CultureNeedGood>;
          const goodId = typeof row.goodId === "string" ? row.goodId.trim() : "";
          const weight = typeof row.weight === "number" && Number.isFinite(row.weight) ? Math.max(0.001, row.weight) : 1;
          return goodId ? { goodId, weight: Number(weight.toFixed(3)) } : null;
        })
        .filter((row): row is CultureNeedGood => row != null);
      const id = typeof need.id === "string" && need.id.trim() ? need.id.trim().slice(0, 80) : `need-${needIndex + 1}`;
      const label = typeof need.label === "string" && need.label.trim() ? need.label.trim().slice(0, 80) : id;
      const category =
        need.category === "survival" || need.category === "basic" || need.category === "comfort" || need.category === "luxury"
          ? need.category
          : "basic";
      const amountPerPerson =
        typeof need.amountPerPerson === "number" && Number.isFinite(need.amountPerPerson)
          ? Math.max(0, Number(need.amountPerPerson))
          : 0;
      const weight = typeof need.weight === "number" && Number.isFinite(need.weight) ? Math.max(0.001, Number(need.weight)) : 1;
      if (!id || amountPerPerson <= 0 || goods.length === 0) continue;
      needs.push({
        id,
        label,
        category,
        amountPerPerson: Number(amountPerPerson.toFixed(6)),
        weight: Number(weight.toFixed(3)),
        goods,
      });
    }
    const id = typeof tier.id === "string" && tier.id.trim() ? tier.id.trim().slice(0, 80) : `tier-${tierIndex + 1}`;
    const minStandardOfLiving =
      typeof tier.minStandardOfLiving === "number" && Number.isFinite(tier.minStandardOfLiving)
        ? Math.max(0, Number(tier.minStandardOfLiving))
        : 0;
    if (needs.length === 0) continue;
    tiers.push({ id, minStandardOfLiving: Number(minStandardOfLiving.toFixed(3)), needs });
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
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("ru-RU");
}

export function resolvePopulationFallbackKeys(params: {
  domains: PopulationDomainKeys;
  content: PopulationDomainContent;
}): Record<PopulationDimensionKey, string> {
  const fallbackByDimension: Record<PopulationDimensionKey, string> = { ...POPULATION_FALLBACK_KEY_BY_DIMENSION };
  for (const dimension of Object.keys(fallbackByDimension) as PopulationDimensionKey[]) {
    const allowed = new Set(params.domains[dimension]);
    const wantedName = normalizeCompareText(POPULATION_FALLBACK_NAME_BY_DIMENSION[dimension]);
    const wantedFallbackId = normalizeCompareText(POPULATION_FALLBACK_KEY_BY_DIMENSION[dimension]);
    const found =
      params.content[dimension].find((entry) => {
        const name = normalizeCompareText(entry.name);
        const id = normalizeCompareText(entry.id);
        return (name && name === wantedName) || id === wantedFallbackId;
      }) ?? null;
    if (found?.id && allowed.has(found.id)) {
      fallbackByDimension[dimension] = found.id;
      continue;
    }
    if (allowed.has(POPULATION_FALLBACK_KEY_BY_DIMENSION[dimension])) {
      fallbackByDimension[dimension] = POPULATION_FALLBACK_KEY_BY_DIMENSION[dimension];
      continue;
    }
    fallbackByDimension[dimension] = (params.domains[dimension]?.[0] ?? POPULATION_FALLBACK_KEY_BY_DIMENSION[dimension]).trim();
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
  const normalizedKeys = [...new Set(allowedKeys.map((key) => key.trim()).filter(Boolean))];
  const keys = normalizedKeys.length > 0 ? normalizedKeys : [fallback];
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const rawByKey = new Map<string, number>();
  let total = 0;

  for (const key of keys) {
    const raw = source[key];
    const value = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, raw) : 0;
    rawByKey.set(key, value);
    total += value;
  }

  if (total <= 0) {
    return { [keys[0]]: 100 };
  }

  const unitsByKey = new Map<string, number>();
  const fractional: Array<{ key: string; remainder: number }> = [];
  let usedUnits = 0;
  for (const key of keys) {
    const scaled = ((rawByKey.get(key) ?? 0) * 10000) / total;
    const baseUnits = Math.floor(scaled);
    unitsByKey.set(key, baseUnits);
    usedUnits += baseUnits;
    fractional.push({ key, remainder: scaled - baseUnits });
  }

  fractional.sort((a, b) => b.remainder - a.remainder || a.key.localeCompare(b.key));
  let remainingUnits = 10000 - usedUnits;
  let index = 0;
  while (remainingUnits > 0 && fractional.length > 0) {
    const row = fractional[index % fractional.length];
    unitsByKey.set(row.key, (unitsByKey.get(row.key) ?? 0) + 1);
    remainingUnits -= 1;
    index += 1;
  }

  const result: Record<string, number> = {};
  for (const key of keys) {
    const units = unitsByKey.get(key) ?? 0;
    if (units <= 0) continue;
    result[key] = units / 100;
  }
  return Object.keys(result).length > 0 ? result : { [keys[0]]: 100 };
}

export function buildDeterministicPctMap(keys: string[], seed: string, fallbackKey: string): Record<string, number> {
  if (keys.length <= 1) {
    const key = (keys[0] ?? fallbackKey).trim() || fallbackKey;
    return { [key]: 100 };
  }
  const weighted: Record<string, number> = {};
  for (const key of keys) {
    weighted[key] = (hashStringToUInt32(`${seed}:${key}`) % 1000) + 1;
  }
  return normalizePercentageMap(weighted, keys, fallbackKey);
}

export function buildRandomPctMap(params: {
  keys: string[];
  fallbackKey: string;
  random?: () => number;
}): Record<string, number> {
  const sourceKeys = params.keys.length > 0 ? params.keys : [params.fallbackKey];
  const random = params.random ?? Math.random;
  const weights: Record<string, number> = {};
  for (const key of sourceKeys) {
    weights[key] = random() * 100 + 1;
  }
  return normalizePercentageMap(weights, sourceKeys, params.fallbackKey);
}

export function isEqualPercentageMap(prevValue: Record<string, number> | undefined, nextValue: Record<string, number>): boolean {
  if (!prevValue) return false;
  const prevKeys = Object.keys(prevValue);
  const nextKeys = Object.keys(nextValue);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of nextKeys) {
    if ((prevValue[key] ?? Number.NaN) !== nextValue[key]) return false;
  }
  return true;
}

export function getPopulationTotal(population: RegionPopulation | undefined | null): number {
  if (!population) return 0;
  return Math.max(0, Math.floor(population.pops.reduce((sum, pop) => sum + Math.max(0, Number(pop.size)), 0)));
}

export function normalizePopulationCountMap(
  input: unknown,
  keys: string[],
  fallbackKey: string,
  targetTotal: number,
): Record<string, number> {
  const target = Math.max(0, Math.floor(targetTotal));
  if (target <= 0) return {};
  const validKeys = new Set(keys);
  const raw: Record<string, number> = {};
  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const id = key.trim();
      const amount = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
      if (!id || !validKeys.has(id) || amount <= 0) continue;
      raw[id] = (raw[id] ?? 0) + amount;
    }
  }
  const rawTotal = Object.values(raw).reduce((sum, value) => sum + value, 0);
  if (rawTotal <= 0) return { [fallbackKey]: target };

  const normalized: Record<string, number> = {};
  let allocated = 0;
  for (const [key, value] of Object.entries(raw)) {
    const amount = Math.floor((value / rawTotal) * target);
    if (amount <= 0) continue;
    normalized[key] = amount;
    allocated += amount;
  }
  const remainder = target - allocated;
  if (remainder > 0) {
    const key = normalized[fallbackKey] != null ? fallbackKey : (Object.keys(normalized)[0] ?? fallbackKey);
    normalized[key] = (normalized[key] ?? 0) + remainder;
  }
  return normalized;
}

export function buildPopulationCountMapFromPct(
  pctMap: Record<string, number>,
  targetTotal: number,
  fallbackKey: string,
): Record<string, number> {
  return normalizePopulationCountMap(pctMap, Object.keys(pctMap), fallbackKey, targetTotal);
}

export function makePopulationProfessionState(size: number, previous?: Partial<PopulationProfessionState>): PopulationProfessionState {
  const nextSize = Math.max(0, Math.floor(size));
  return {
    size: nextSize,
    ducats: round3(Math.max(0, Number(previous?.ducats ?? 0))),
    standardOfLiving: round3(Math.max(0, Number(previous?.standardOfLiving ?? DEFAULT_STANDARD_OF_LIVING))),
    radicals: Math.max(0, Math.floor(Number(previous?.radicals ?? 0))),
    loyalists: Math.max(0, Math.floor(Number(previous?.loyalists ?? 0))),
    lastIncomeDucats: round3(Math.max(0, Number(previous?.lastIncomeDucats ?? 0))),
    lastNeedsSpendDucats: round3(Math.max(0, Number(previous?.lastNeedsSpendDucats ?? 0))),
    lastNeedsSatisfaction: round3(Math.max(0, Number(previous?.lastNeedsSatisfaction ?? 1))),
    lastNeedsByCategory: Object.fromEntries(
      Object.entries(previous?.lastNeedsByCategory ?? {})
        .filter(([, row]) => row && typeof row === "object")
        .map(([key, row]) => [
          key,
          {
            required: round3(Math.max(0, Number(row?.required ?? 0))),
            fulfilled: round3(Math.max(0, Number(row?.fulfilled ?? 0))),
            spend: round3(Math.max(0, Number(row?.spend ?? 0))),
            satisfaction: round3(Math.max(0, Number(row?.satisfaction ?? 0))),
          },
        ]),
    ),
    lastNeedsDeficitByGood: Object.fromEntries(
      Object.entries(previous?.lastNeedsDeficitByGood ?? {})
        .filter(([goodId, value]) => goodId.trim().length > 0 && Number(value) > 0)
        .map(([goodId, value]) => [goodId, round3(Math.max(0, Number(value)))]),
    ),
    lastNeedsBudgetShortageByGood: Object.fromEntries(
      Object.entries(previous?.lastNeedsBudgetShortageByGood ?? {})
        .filter(([goodId, value]) => goodId.trim().length > 0 && Number(value) > 0)
        .map(([goodId, value]) => [goodId, round3(Math.max(0, Number(value)))]),
    ),
    lastBirths: Math.max(0, Math.floor(Number(previous?.lastBirths ?? 0))),
    lastDeaths: Math.max(0, Math.floor(Number(previous?.lastDeaths ?? 0))),
  };
}

export function normalizeProfessionStateMap(
  input: unknown,
  keys: string[],
  fallbackKey: string,
  targetTotal: number,
): Record<string, PopulationProfessionState> {
  const target = Math.max(0, Math.floor(targetTotal));
  if (target <= 0) return {};
  const rawCounts: Record<string, number> = {};
  const previousByKey: Record<string, Partial<PopulationProfessionState>> = {};
  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const id = key.trim();
      if (!id || !keys.includes(id)) continue;
      if (typeof value === "number") {
        rawCounts[id] = Math.max(0, Number(value));
      } else if (value && typeof value === "object") {
        const row = value as Partial<PopulationProfessionState>;
        rawCounts[id] = Math.max(0, Number(row.size ?? 0));
        previousByKey[id] = row;
      }
    }
  }
  const counts = normalizePopulationCountMap(rawCounts, keys, fallbackKey, target);
  return Object.fromEntries(Object.entries(counts).map(([key, size]) => [key, makePopulationProfessionState(size, previousByKey[key])]));
}

export function buildRedistributedProfessionStateMap(
  nextCounts: Record<string, number>,
  previousStates: Record<string, PopulationProfessionState>,
): Record<string, PopulationProfessionState> {
  const nextTotal = Object.values(nextCounts).reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0);
  if (nextTotal <= 0) return {};

  const previousEntries = Object.entries(previousStates ?? {}).filter(([, state]) => state && Number(state.size) > 0);
  const previousTotalSize = previousEntries.reduce((sum, [, state]) => sum + Math.max(0, Number(state.size)), 0);
  const previousTotalDucats = previousEntries.reduce((sum, [, state]) => sum + Math.max(0, Number(state.ducats)), 0);
  const averageSoL =
    previousTotalSize > 0
      ? previousEntries.reduce((sum, [, state]) => sum + Math.max(0, Number(state.standardOfLiving)) * Math.max(0, Number(state.size)), 0) / previousTotalSize
      : DEFAULT_STANDARD_OF_LIVING;
  const averageNeedsSatisfaction =
    previousTotalSize > 0
      ? previousEntries.reduce((sum, [, state]) => sum + Math.max(0, Number(state.lastNeedsSatisfaction)) * Math.max(0, Number(state.size)), 0) / previousTotalSize
      : 1;
  const radicalsPerCapita =
    previousTotalSize > 0 ? previousEntries.reduce((sum, [, state]) => sum + Math.max(0, Number(state.radicals)), 0) / previousTotalSize : 0;
  const loyalistsPerCapita =
    previousTotalSize > 0 ? previousEntries.reduce((sum, [, state]) => sum + Math.max(0, Number(state.loyalists)), 0) / previousTotalSize : 0;

  const result: Record<string, PopulationProfessionState> = {};
  for (const [professionId, sizeRaw] of Object.entries(nextCounts)) {
    const size = Math.max(0, Math.floor(Number(sizeRaw) || 0));
    if (size <= 0) continue;
    const previous = previousStates?.[professionId];
    const next = makePopulationProfessionState(size, previous);
    const sizeShare = nextTotal > 0 ? size / nextTotal : 0;
    next.ducats = round3(previousTotalDucats * sizeShare);
    if (!previous && previousTotalSize > 0) {
      next.standardOfLiving = round3(averageSoL);
      next.lastNeedsSatisfaction = round3(averageNeedsSatisfaction);
    }
    next.radicals = Math.max(0, Math.floor(radicalsPerCapita * size));
    next.loyalists = Math.max(0, Math.floor(loyalistsPerCapita * size));
    result[professionId] = next;
  }
  return result;
}

export function normalizePopulationPop(params: {
  raw: unknown;
  provinceId: string;
  domains: PopulationDomainKeys;
  fallbackByDimension: Record<PopulationDimensionKey, string>;
  index: number;
}): PopulationPop | null {
  if (!params.raw || typeof params.raw !== "object") return null;
  const row = params.raw as Partial<PopulationPop>;
  const size = typeof row.size === "number" && Number.isFinite(row.size) ? Math.max(0, Math.floor(row.size)) : 0;
  if (size <= 0) return null;
  const pick = (value: unknown, keys: string[], fallback: string): string => {
    const id = typeof value === "string" ? value.trim() : "";
    return id && keys.includes(id) ? id : fallback;
  };
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 120) : `pop:${params.provinceId}:${params.index}`;
  return {
    id,
    size,
    cultureId: pick(row.cultureId, params.domains.culturePct, params.fallbackByDimension.culturePct),
    religionId: pick(row.religionId, params.domains.religionPct, params.fallbackByDimension.religionPct),
    raceId: pick(row.raceId, params.domains.racePct, params.fallbackByDimension.racePct),
    ideologies: normalizePopulationCountMap(row.ideologies, params.domains.ideologyPct, params.fallbackByDimension.ideologyPct, size),
    professions: normalizeProfessionStateMap(row.professions, params.domains.professionPct, params.fallbackByDimension.professionPct, size),
  };
}

export function normalizePopulationPops(params: {
  rawPops: unknown;
  provinceId: string;
  domains: PopulationDomainKeys;
  fallbackByDimension: Record<PopulationDimensionKey, string>;
}): PopulationPop[] {
  if (!Array.isArray(params.rawPops)) return [];
  const seen = new Set<string>();
  const pops: PopulationPop[] = [];
  for (const [index, raw] of params.rawPops.entries()) {
    const pop = normalizePopulationPop({
      raw,
      provinceId: params.provinceId,
      domains: params.domains,
      fallbackByDimension: params.fallbackByDimension,
      index,
    });
    if (!pop) continue;
    let id = pop.id;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${pop.id}:${suffix}`;
      suffix += 1;
    }
    seen.add(id);
    pops.push({ ...pop, id });
  }
  return pops;
}

export function isEqualRegionPopulation(prevValue: RegionPopulation | undefined, nextValue: RegionPopulation): boolean {
  if (!prevValue) return false;
  if (prevValue.pops.length !== nextValue.pops.length) return false;
  for (let index = 0; index < nextValue.pops.length; index += 1) {
    const prev = prevValue.pops[index];
    const next = nextValue.pops[index];
    if (
      !prev ||
      prev.id !== next.id ||
      prev.size !== next.size ||
      prev.cultureId !== next.cultureId ||
      prev.religionId !== next.religionId ||
      prev.raceId !== next.raceId ||
      !isEqualPercentageMap(prev.ideologies, next.ideologies) ||
      JSON.stringify(prev.professions) !== JSON.stringify(next.professions)
    ) {
      return false;
    }
  }
  return true;
}

export function buildSinglePopRegionPopulation(params: {
  provinceId: string;
  total: number;
  fallbackByDimension: Record<PopulationDimensionKey, string>;
  popId?: string;
}): RegionPopulation {
  const size = Math.max(0, Math.floor(params.total));
  return {
    pops:
      size > 0
        ? [
            {
              id: params.popId ?? `pop:${params.provinceId}:default`,
              size,
              cultureId: params.fallbackByDimension.culturePct,
              religionId: params.fallbackByDimension.religionPct,
              raceId: params.fallbackByDimension.racePct,
              ideologies: { [params.fallbackByDimension.ideologyPct]: size },
              professions: { [params.fallbackByDimension.professionPct]: makePopulationProfessionState(size) },
            },
          ]
        : [],
  };
}

export function buildRegionPopulationFromBreakdowns(params: {
  provinceId: string;
  total: number;
  fallbackByDimension: Record<PopulationDimensionKey, string>;
  maps: PopulationBreakdownMaps;
}): RegionPopulation {
  const populationTotal = Math.max(0, Math.floor(params.total));
  if (populationTotal <= 0) return { pops: [] };

  const entriesByDimension = {
    culturePct: Object.entries(params.maps.culturePct).filter(([, pct]) => pct > 0),
    religionPct: Object.entries(params.maps.religionPct).filter(([, pct]) => pct > 0),
    racePct: Object.entries(params.maps.racePct).filter(([, pct]) => pct > 0),
  };
  const pops: PopulationPop[] = [];
  let allocated = 0;
  for (const [cultureId, culturePct] of entriesByDimension.culturePct) {
    for (const [religionId, religionPct] of entriesByDimension.religionPct) {
      for (const [raceId, racePct] of entriesByDimension.racePct) {
        const share = (culturePct / 100) * (religionPct / 100) * (racePct / 100);
        const size = Math.floor(populationTotal * share);
        if (size <= 0) continue;
        allocated += size;
        pops.push({
          id: `pop:${params.provinceId}:${pops.length}`,
          size,
          cultureId,
          religionId,
          raceId,
          ideologies: buildPopulationCountMapFromPct(params.maps.ideologyPct, size, params.fallbackByDimension.ideologyPct),
          professions: Object.fromEntries(
            Object.entries(buildPopulationCountMapFromPct(params.maps.professionPct, size, params.fallbackByDimension.professionPct)).map(
              ([professionId, professionSize]) => [professionId, makePopulationProfessionState(professionSize)],
            ),
          ),
        });
      }
    }
  }
  if (pops.length === 0) {
    return buildSinglePopRegionPopulation({
      provinceId: params.provinceId,
      total: populationTotal,
      fallbackByDimension: params.fallbackByDimension,
    });
  }
  const remainder = populationTotal - allocated;
  if (remainder > 0) {
    pops[0] = { ...pops[0], size: pops[0].size + remainder };
  }
  return { pops };
}

export function buildDefaultRegionPopulation(params: {
  provinceId: string;
  domains: PopulationDomainKeys;
  fallbackByDimension: Record<PopulationDimensionKey, string>;
  getProvinceAreaKm2: (provinceId: string) => number;
}): RegionPopulation {
  const areaKm2 = Math.max(1, params.getProvinceAreaKm2(params.provinceId) ?? 1_000);
  const seed = hashStringToUInt32(params.provinceId);
  const areaBasedPopulation = Math.floor(areaKm2 * 120);
  const populationTotal = Math.max(POPULATION_MIN_TOTAL, areaBasedPopulation + POPULATION_DEFAULT_BASE_TOTAL + (seed % 5000));
  return buildSinglePopRegionPopulation({
    provinceId: params.provinceId,
    total: populationTotal,
    fallbackByDimension: params.fallbackByDimension,
  });
}

export function normalizeRegionPopulation(params: {
  input: unknown;
  provinceId: string;
  domains: PopulationDomainKeys;
  fallbackByDimension: Record<PopulationDimensionKey, string>;
  getProvinceAreaKm2: (provinceId: string) => number;
}): RegionPopulation {
  const fallback = buildDefaultRegionPopulation(params);
  if (!params.input || typeof params.input !== "object") {
    return fallback;
  }
  const row = params.input as Partial<RegionPopulation> & Partial<{ populationTotal: unknown }>;
  const pops = normalizePopulationPops({
    rawPops: row.pops,
    provinceId: params.provinceId,
    domains: params.domains,
    fallbackByDimension: params.fallbackByDimension,
  });
  if (pops.length > 0) return { pops };
  if (typeof row.populationTotal === "number" && Number.isFinite(row.populationTotal)) {
    return buildSinglePopRegionPopulation({
      provinceId: params.provinceId,
      total: row.populationTotal <= 0 ? 0 : Math.max(POPULATION_MIN_TOTAL, Math.floor(row.populationTotal)),
      fallbackByDimension: params.fallbackByDimension,
    });
  }
  return fallback;
}

export function buildRandomRegionPopulation(params: {
  provinceId: string;
  domains: PopulationDomainKeys;
  fallbackByDimension: Record<PopulationDimensionKey, string>;
  getProvinceAreaKm2: (provinceId: string) => number;
  populationTotalOverride?: number;
  random?: () => number;
}): RegionPopulation {
  const fallback = buildDefaultRegionPopulation(params);
  const total =
    typeof params.populationTotalOverride === "number" && Number.isFinite(params.populationTotalOverride)
      ? Math.max(0, Math.floor(params.populationTotalOverride))
      : getPopulationTotal(fallback);
  return buildRegionPopulationFromBreakdowns({
    provinceId: params.provinceId,
    total,
    fallbackByDimension: params.fallbackByDimension,
    maps: {
      culturePct: buildRandomPctMap({ keys: params.domains.culturePct, fallbackKey: params.fallbackByDimension.culturePct, random: params.random }),
      ideologyPct: buildRandomPctMap({ keys: params.domains.ideologyPct, fallbackKey: params.fallbackByDimension.ideologyPct, random: params.random }),
      religionPct: buildRandomPctMap({ keys: params.domains.religionPct, fallbackKey: params.fallbackByDimension.religionPct, random: params.random }),
      racePct: buildRandomPctMap({ keys: params.domains.racePct, fallbackKey: params.fallbackByDimension.racePct, random: params.random }),
      professionPct: { [params.fallbackByDimension.professionPct]: 100 },
    },
  });
}

export function normalizeRegionPopulationMap(params: {
  input: unknown;
  regionIds: string[];
  domains: PopulationDomainKeys;
  fallbackByDimension: Record<PopulationDimensionKey, string>;
  getProvinceAreaKm2: (regionId: string) => number;
}): Record<string, RegionPopulation> {
  const normalized: Record<string, RegionPopulation> = {};
  if (params.input && typeof params.input === "object") {
    for (const [regionId, raw] of Object.entries(params.input as Record<string, unknown>)) {
      normalized[regionId] = normalizeRegionPopulation({
        input: raw,
        provinceId: regionId,
        domains: params.domains,
        fallbackByDimension: params.fallbackByDimension,
        getProvinceAreaKm2: params.getProvinceAreaKm2,
      });
    }
  }
  for (const regionId of params.regionIds) {
    if (!normalized[regionId]) {
      normalized[regionId] = buildDefaultRegionPopulation({
        provinceId: regionId,
        domains: params.domains,
        fallbackByDimension: params.fallbackByDimension,
        getProvinceAreaKm2: params.getProvinceAreaKm2,
      });
    }
  }
  return normalized;
}

export function resolvePopulationTurnForRegion(params: {
  currentPopulation: RegionPopulation;
  nextProfessionsByPopId?: Record<string, Record<string, PopulationProfessionState>>;
}): RegionPopulation {
  if (getPopulationTotal(params.currentPopulation) <= 0) {
    return params.currentPopulation;
  }
  const growthRate = POPULATION_BIRTH_RATE - POPULATION_DEATH_RATE;
  return {
    pops: params.currentPopulation.pops.map((pop) => {
      const nextSize = Math.max(1, Math.floor(pop.size * Math.max(0.8, 1 + growthRate)));
      const professions =
        params.nextProfessionsByPopId?.[pop.id] ??
        normalizeProfessionStateMap(
          pop.professions,
          Object.keys(pop.professions),
          Object.keys(pop.professions)[0] ?? "profession:default",
          nextSize,
        );
      const professionSize = Object.values(professions).reduce((sum, state) => sum + Math.max(0, state.size), 0);
      const populationSize = Math.max(0, Math.floor(professionSize));
      return {
        ...pop,
        size: populationSize,
        ideologies: normalizePopulationCountMap(
          pop.ideologies,
          Object.keys(pop.ideologies),
          Object.keys(pop.ideologies)[0] ?? "ideology:default",
          populationSize,
        ),
        professions,
      };
    }),
  };
}

export function resolvePopulationTurnForRegions(params: {
  regionIds: string[];
  currentPopulationByRegion: Record<string, RegionPopulation | undefined>;
  nextProfessionsByRegion: Record<string, Record<string, Record<string, PopulationProfessionState>> | undefined>;
  domains: PopulationDomainKeys;
  fallbackByDimension: Record<PopulationDimensionKey, string>;
  ideologies: PopulationIdeologyContentEntry[];
  getProvinceAreaKm2: (regionId: string) => number;
  getIdeologyContext: (regionId: string) => RegionPopulationIdeologyContext;
}): ResolvePopulationTurnResult {
  const nextPopulationByRegion: Record<string, RegionPopulation> = {};
  const changedRegionIds: string[] = [];

  for (const regionId of params.regionIds) {
    const currentPopulation = normalizeRegionPopulation({
      input: params.currentPopulationByRegion[regionId],
      provinceId: regionId,
      domains: params.domains,
      fallbackByDimension: params.fallbackByDimension,
      getProvinceAreaKm2: params.getProvinceAreaKm2,
    });
    const nextPopulation = resolvePopulationTurnForRegion({
      currentPopulation,
      nextProfessionsByPopId: params.nextProfessionsByRegion[regionId],
    });
    const ideologyContext = params.getIdeologyContext(regionId);
    const nextPopulationWithIdeology = applyIdeologyAttractionToPopulation({
      population: nextPopulation,
      ideologies: params.ideologies,
      countryId: ideologyContext.countryId,
      activeLawIds: ideologyContext.activeLawIds,
      activeModifierIds: ideologyContext.activeModifierIds,
      provinceBuildingIds: ideologyContext.provinceBuildingIds,
    });
    nextPopulationByRegion[regionId] = nextPopulationWithIdeology;
    if (!isEqualRegionPopulation(params.currentPopulationByRegion[regionId], nextPopulationWithIdeology)) {
      changedRegionIds.push(regionId);
    }
  }

  return { nextPopulationByRegion, changedRegionIds };
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
    for (const [professionId, state] of Object.entries(pop.professions)) {
      availableByProfession[professionId] = round3((availableByProfession[professionId] ?? 0) + Math.max(0, Number(state.size)));
    }
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
    const multiplier = shortageRatio > 1 ? 1 + (shortageRatio - 1) * 0.5 : 1;
    wageMultiplierByProfession[professionId] = round3(Math.max(0.5, Math.min(3, multiplier)));
  }
  return wageMultiplierByProfession;
}

export function buildNextProfessionsByPopId(params: {
  population: RegionPopulation;
  employedByProfession: Record<string, number>;
  professionIds: string[];
  fallbackProfessionId: string;
}): Record<string, Record<string, PopulationProfessionState>> {
  const populationTotal = getPopulationTotal(params.population);
  if (populationTotal <= 0) return {};
  const employedTotalRaw = Object.values(params.employedByProfession).reduce((sum, value) => sum + Math.max(0, Number(value)), 0);
  const employedScale = employedTotalRaw > populationTotal && employedTotalRaw > 0 ? populationTotal / employedTotalRaw : 1;
  const professionDistributionRaw: Record<string, number> = {};
  let employedTotalScaled = 0;
  for (const [professionId, value] of Object.entries(params.employedByProfession)) {
    const scaled = round3(Math.max(0, Number(value)) * employedScale);
    if (scaled <= 0) continue;
    professionDistributionRaw[professionId] = scaled;
    employedTotalScaled = round3(employedTotalScaled + scaled);
  }
  const unemployed = round3(Math.max(0, populationTotal - employedTotalScaled));
  professionDistributionRaw[params.fallbackProfessionId] = round3(
    Math.max(0, Number(professionDistributionRaw[params.fallbackProfessionId] ?? 0)) + unemployed,
  );

  const result: Record<string, Record<string, PopulationProfessionState>> = {};
  for (const pop of params.population.pops) {
    const normalizedCounts = normalizePopulationCountMap(
      professionDistributionRaw,
      params.professionIds,
      params.fallbackProfessionId,
      Math.max(0, Number(pop.size)),
    );
    result[pop.id] = buildRedistributedProfessionStateMap(normalizedCounts, pop.professions ?? {});
  }
  return result;
}

export function calculateProfessionTotalsByPopId(
  byPopId: Record<string, Record<string, PopulationProfessionState>>,
): Record<string, number> {
  const professionTotals: Record<string, number> = {};
  for (const byProfession of Object.values(byPopId)) {
    for (const [professionId, state] of Object.entries(byProfession)) {
      professionTotals[professionId] = round3((professionTotals[professionId] ?? 0) + Math.max(0, state.size));
    }
  }
  return professionTotals;
}

export function getPopProfessionMetrics(pop: PopulationPop): PopulationProfessionMetrics {
  const total = Math.max(1, Number(pop.size));
  let weightedSoL = 0;
  let radicals = 0;
  let loyalists = 0;
  const professionShareById: Record<string, number> = {};
  for (const [professionId, state] of Object.entries(pop.professions ?? {})) {
    const size = Math.max(0, Number(state.size ?? 0));
    if (size <= 0) continue;
    professionShareById[professionId] = size / total;
    weightedSoL += Math.max(0, Number(state.standardOfLiving ?? DEFAULT_STANDARD_OF_LIVING)) * size;
    radicals += Math.max(0, Number(state.radicals ?? 0));
    loyalists += Math.max(0, Number(state.loyalists ?? 0));
  }
  return {
    averageSoL: round3(weightedSoL / total),
    radicalPct: round3((radicals / total) * 100),
    loyalistPct: round3((loyalists / total) * 100),
    professionShareById,
  };
}

export function evaluateIdeologyAttractionRule(params: {
  rule: IdeologyAttractionRule;
  pop: PopulationPop;
  countryId: string | null;
  activeLawIds: Set<string>;
  activeModifierIds: Set<string>;
  provinceBuildingIds: Set<string>;
  metrics: PopulationProfessionMetrics;
}): number {
  const { rule, pop, countryId, activeLawIds, activeModifierIds, provinceBuildingIds, metrics } = params;
  const threshold = Math.max(0, Number(rule.threshold ?? 0));
  let match = 0;
  if (rule.type === "sol_below") {
    match = metrics.averageSoL < threshold ? Math.min(1, (threshold - metrics.averageSoL) / Math.max(1, threshold)) : 0;
  } else if (rule.type === "sol_above") {
    match = metrics.averageSoL > threshold ? Math.min(1, (metrics.averageSoL - threshold) / Math.max(1, threshold)) : 0;
  } else if (rule.type === "radicals_above") {
    match = metrics.radicalPct > threshold ? Math.min(1, (metrics.radicalPct - threshold) / 100) : 0;
  } else if (rule.type === "loyalists_above") {
    match = metrics.loyalistPct > threshold ? Math.min(1, (metrics.loyalistPct - threshold) / 100) : 0;
  } else if (rule.type === "profession_is") {
    match = rule.targetId ? metrics.professionShareById[rule.targetId] ?? 0 : 0;
  } else if (rule.type === "religion_is") {
    match = rule.targetId && pop.religionId === rule.targetId ? 1 : 0;
  } else if (rule.type === "culture_is") {
    match = rule.targetId && pop.cultureId === rule.targetId ? 1 : 0;
  } else if (rule.type === "law_active") {
    match = rule.targetId && activeLawIds.has(rule.targetId) ? 1 : 0;
  } else if (rule.type === "has_building") {
    match = rule.targetId && provinceBuildingIds.has(rule.targetId) ? 1 : 0;
  } else if (rule.type === "country_modifier_active" || rule.type === "province_modifier_active") {
    match = rule.targetId && activeModifierIds.has(rule.targetId) ? 1 : 0;
  }
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
  if (ideologyIds.length === 0 || params.population.pops.length === 0) return params.population;
  const attractionRate = Math.max(0, Math.min(1, params.attractionRate ?? 0.02));
  return {
    pops: params.population.pops.map((pop) => {
      const total = Math.max(0, Math.floor(pop.size));
      if (total <= 0) return pop;
      const metrics = getPopProfessionMetrics(pop);
      const targetScores: Record<string, number> = {};
      for (const ideology of params.ideologies) {
        const score = (ideology.ideologyAttractionRules ?? []).reduce(
          (sum, rule) =>
            sum +
            evaluateIdeologyAttractionRule({
              rule,
              pop,
              countryId: params.countryId,
              activeLawIds: params.activeLawIds,
              activeModifierIds: params.activeModifierIds,
              provinceBuildingIds: params.provinceBuildingIds,
              metrics,
            }),
          0,
        );
        if (score > 0) targetScores[ideology.id] = score;
      }
      const scoreTotal = Object.values(targetScores).reduce((sum, value) => sum + value, 0);
      if (scoreTotal <= 0) return pop;
      const current = normalizePopulationCountMap(pop.ideologies, ideologyIds, ideologyIds[0] ?? "ideology:default", total);
      const mixed: Record<string, number> = {};
      for (const ideologyId of ideologyIds) {
        const currentAmount = current[ideologyId] ?? 0;
        const targetAmount = ((targetScores[ideologyId] ?? 0) / scoreTotal) * total;
        mixed[ideologyId] = currentAmount * (1 - attractionRate) + targetAmount * attractionRate;
      }
      return {
        ...pop,
        ideologies: normalizePopulationCountMap(mixed, ideologyIds, ideologyIds[0] ?? "ideology:default", total),
      };
    }),
  };
}

export function getTargetStandardOfLiving(satisfaction: number, walletToNeedsRatio: number): number {
  const base =
    satisfaction < 0.35 ? 3 :
    satisfaction < 0.6 ? 6 :
    satisfaction < 0.85 ? 9 :
    satisfaction < 1 ? 11 :
    satisfaction < 1.25 ? 14 :
    satisfaction < 1.6 ? 18 :
    22;
  return round3(Math.max(0, Math.min(30, base + Math.max(0, Math.min(4, walletToNeedsRatio)))));
}

export function getCategorySatisfactionValue(
  categoryStats: Record<string, { satisfaction: number }>,
  category: CultureNeedCategory,
): number {
  return Math.max(0, Math.min(1.5, Number(categoryStats[category]?.satisfaction ?? 1)));
}

export function applyNeedsStructureToTargetSoL(
  targetSoL: number,
  categoryStats: Record<string, { satisfaction: number }>,
): number {
  const survival = getCategorySatisfactionValue(categoryStats, "survival");
  const basic = getCategorySatisfactionValue(categoryStats, "basic");
  const comfort = getCategorySatisfactionValue(categoryStats, "comfort");
  const luxury = getCategorySatisfactionValue(categoryStats, "luxury");
  const survivalPenalty = Math.max(0, 1 - survival) * 8;
  const basicPenalty = Math.max(0, 0.95 - basic) * 4;
  const comfortPenalty = Math.max(0, 0.8 - comfort) * 2;
  const luxuryBonus = Math.max(0, luxury - 0.95) * 1.25;
  return round3(Math.max(0, Math.min(30, targetSoL - survivalPenalty - basicPenalty - comfortPenalty + luxuryBonus)));
}

export function getBirthDeathRatesBySoL(
  standardOfLiving: number,
  satisfaction: number,
  categoryStats: Record<string, { satisfaction: number }>,
): { birthRate: number; deathRate: number } {
  const sol = Math.max(0, standardOfLiving);
  const survival = getCategorySatisfactionValue(categoryStats, "survival");
  const basic = getCategorySatisfactionValue(categoryStats, "basic");
  const birthRate =
    POPULATION_BIRTH_RATE * (sol < 8 ? 1.1 : sol > 18 ? 0.75 : 1) * (survival < 0.85 ? 0.92 : 1) * (basic < 0.75 ? 0.96 : 1);
  const needPenalty = satisfaction < 0.6 ? (0.6 - satisfaction) * 0.03 : 0;
  const survivalPenalty = survival < 0.95 ? (0.95 - survival) * 0.05 : 0;
  const basicPenalty = basic < 0.8 ? (0.8 - basic) * 0.015 : 0;
  const deathRate =
    POPULATION_DEATH_RATE * (sol < 6 ? 1.8 : sol < 10 ? 1.2 : sol > 18 ? 0.7 : 1) +
    needPenalty +
    survivalPenalty +
    basicPenalty;
  return { birthRate, deathRate };
}

export function resolvePopulationProfessionNeedsTurn(params: {
  state: PopulationProfessionState;
  previous?: PopulationProfessionState;
  needs: CultureNeedLike[];
  income: number;
  getGoodPrice: (goodId: string) => number;
  getAvailableGoodAmount: (goodId: string) => number;
  purchaseGood: (goodId: string, requestedPhysicalAmount: number, wallet: number) => PopulationNeedsPurchaseResult;
}): PopulationProfessionNeedsResult {
  const state = params.state;
  let wallet = round3(Math.max(0, state.ducats + params.income));
  let weightedSatisfiedNeed = 0;
  let totalNeedWeight = 0;
  let needsSpend = 0;
  let theoreticalNeedCost = 0;
  const categoryStats: PopulationNeedCategoryStats = {};
  const deficitByGood: Record<string, number> = {};
  const budgetShortageByGood: Record<string, number> = {};
  const demandRequestedByGood: Record<string, number> = {};

  for (const need of params.needs) {
    const required = round3(state.size * need.amountPerPerson);
    if (required <= 0) continue;
    const categoryWeight = CULTURE_NEED_CATEGORY_SATISFACTION_WEIGHT[need.category] * need.weight;
    totalNeedWeight += categoryWeight;
    const categoryEntry = categoryStats[need.category] ?? { required: 0, fulfilled: 0, spend: 0, satisfaction: 0 };
    categoryEntry.required = round3(categoryEntry.required + required);
    categoryStats[need.category] = categoryEntry;
    let remainingNeedUnits = required;
    const viableGoods = need.goods
      .map((good) => {
        const effectivePerUnit = Math.max(0.001, good.weight);
        const price = params.getGoodPrice(good.goodId);
        return {
          ...good,
          effectivePerUnit,
          price,
          theoreticalCostPerNeedUnit: price / effectivePerUnit,
        };
      })
      .filter((good) => Number.isFinite(good.theoreticalCostPerNeedUnit) && good.theoreticalCostPerNeedUnit > 0)
      .sort((a, b) => a.theoreticalCostPerNeedUnit - b.theoreticalCostPerNeedUnit || b.weight - a.weight);
    if (viableGoods.length === 0) continue;
    theoreticalNeedCost += required * viableGoods[0].theoreticalCostPerNeedUnit;

    let pass = 0;
    while (remainingNeedUnits > 0.001 && wallet > 0.001 && pass < 6) {
      pass += 1;
      const options = viableGoods
        .map((good) => {
          const availablePhysicalAmount = params.getAvailableGoodAmount(good.goodId);
          if (availablePhysicalAmount <= 0) return null;
          const desiredPhysicalAmount = Math.max(0.001, remainingNeedUnits / good.effectivePerUnit);
          const availabilityFactor = 0.25 + Math.min(1.75, availablePhysicalAmount / desiredPhysicalAmount);
          const score = (Math.max(0.001, good.weight) * availabilityFactor) / Math.max(0.001, good.price);
          return {
            ...good,
            availablePhysicalAmount,
            score,
          };
        })
        .filter((good): good is NonNullable<typeof good> => good != null && good.score > 0.000001);
      if (options.length === 0) {
        const fallbackGood = viableGoods[0];
        if (fallbackGood) {
          const marketDeficitPhysicalAmount = round3(Math.max(0, remainingNeedUnits / fallbackGood.effectivePerUnit));
          if (marketDeficitPhysicalAmount > 0) {
            deficitByGood[fallbackGood.goodId] = round3((deficitByGood[fallbackGood.goodId] ?? 0) + marketDeficitPhysicalAmount);
          }
        }
        break;
      }
      const scoreSum = options.reduce((sum, good) => sum + good.score, 0);
      if (scoreSum <= 0) break;

      let fulfilledNeedUnitsThisPass = 0;
      for (const option of options) {
        if (remainingNeedUnits <= 0.001 || wallet <= 0.001) break;
        const allocatedNeedUnits = round3(Math.min(remainingNeedUnits, (remainingNeedUnits * option.score) / scoreSum));
        if (allocatedNeedUnits <= 0) continue;
        const requestedPhysicalAmount = round3(Math.min(allocatedNeedUnits / option.effectivePerUnit, wallet / option.price));
        if (requestedPhysicalAmount <= 0) continue;
        demandRequestedByGood[option.goodId] = round3((demandRequestedByGood[option.goodId] ?? 0) + requestedPhysicalAmount);
        const purchase = params.purchaseGood(option.goodId, requestedPhysicalAmount, wallet);
        const deficitPhysicalAmount = round3(Math.max(0, requestedPhysicalAmount - purchase.purchasedPhysicalAmount));
        if (deficitPhysicalAmount > 0) {
          deficitByGood[option.goodId] = round3((deficitByGood[option.goodId] ?? 0) + deficitPhysicalAmount);
        }
        if (purchase.purchasedPhysicalAmount <= 0 || purchase.spent <= 0) continue;
        wallet = purchase.wallet;
        needsSpend = round3(needsSpend + purchase.spent);
        categoryEntry.spend = round3(categoryEntry.spend + purchase.spent);
        const fulfilledNeedUnits = round3(purchase.purchasedPhysicalAmount * option.effectivePerUnit);
        remainingNeedUnits = round3(Math.max(0, remainingNeedUnits - fulfilledNeedUnits));
        categoryEntry.fulfilled = round3(categoryEntry.fulfilled + fulfilledNeedUnits);
        fulfilledNeedUnitsThisPass = round3(fulfilledNeedUnitsThisPass + fulfilledNeedUnits);
      }
      if (fulfilledNeedUnitsThisPass <= 0.001) break;
    }

    if (remainingNeedUnits > 0.001 && wallet <= 0.001) {
      const fallbackGood = viableGoods[0];
      if (fallbackGood) {
        const budgetShortagePhysicalAmount = round3(Math.max(0, remainingNeedUnits / fallbackGood.effectivePerUnit));
        if (budgetShortagePhysicalAmount > 0) {
          budgetShortageByGood[fallbackGood.goodId] = round3((budgetShortageByGood[fallbackGood.goodId] ?? 0) + budgetShortagePhysicalAmount);
        }
      }
    }

    const needSatisfaction = Math.max(0, Math.min(1.5, (required - remainingNeedUnits) / required));
    weightedSatisfiedNeed += needSatisfaction * categoryWeight;
  }

  const satisfaction = totalNeedWeight > 0 ? round3(weightedSatisfiedNeed / totalNeedWeight) : 1;
  const previousSoL = Math.max(0, Number(params.previous?.standardOfLiving ?? state.standardOfLiving));
  for (const row of Object.values(categoryStats)) {
    row.satisfaction = row.required > 0 ? round3(row.fulfilled / row.required) : 1;
  }
  const targetSoL = applyNeedsStructureToTargetSoL(
    getTargetStandardOfLiving(satisfaction, theoreticalNeedCost > 0 ? wallet / theoreticalNeedCost : 1),
    categoryStats,
  );
  const nextSoL = round3(previousSoL * 0.8 + targetSoL * 0.2);
  const { birthRate, deathRate } = getBirthDeathRatesBySoL(nextSoL, satisfaction, categoryStats);
  const births = Math.floor(state.size * birthRate);
  const deaths = Math.floor(state.size * deathRate);
  const nextSize = Math.max(0, state.size + births - deaths);
  const solDelta = nextSoL - previousSoL;
  const survivalSatisfaction = getCategorySatisfactionValue(categoryStats, "survival");
  const basicSatisfaction = getCategorySatisfactionValue(categoryStats, "basic");
  const comfortSatisfaction = getCategorySatisfactionValue(categoryStats, "comfort");
  const luxurySatisfaction = getCategorySatisfactionValue(categoryStats, "luxury");
  const radicals = Math.max(
    0,
    Math.floor(
      (params.previous?.radicals ?? state.radicals) * 0.98 +
      (solDelta < 0 ? state.size * Math.abs(solDelta) * 0.01 : 0) +
      (satisfaction < 0.6 ? state.size * (0.6 - satisfaction) * 0.02 : 0) +
      (survivalSatisfaction < 0.9 ? state.size * (0.9 - survivalSatisfaction) * 0.03 : 0) +
      (basicSatisfaction < 0.8 ? state.size * (0.8 - basicSatisfaction) * 0.012 : 0),
    ),
  );
  const loyalists = Math.max(
    0,
    Math.floor(
      (params.previous?.loyalists ?? state.loyalists) * 0.98 +
      (solDelta > 0 ? state.size * solDelta * 0.008 : 0) +
      (comfortSatisfaction > 0.95 ? state.size * (comfortSatisfaction - 0.95) * 0.006 : 0) +
      (luxurySatisfaction > 0.98 ? state.size * (luxurySatisfaction - 0.98) * 0.004 : 0),
    ),
  );

  return {
    nextState: {
      ...state,
      size: nextSize,
      ducats: wallet,
      standardOfLiving: nextSoL,
      radicals,
      loyalists,
      lastIncomeDucats: params.income,
      lastNeedsSpendDucats: needsSpend,
      lastNeedsSatisfaction: satisfaction,
      lastNeedsByCategory: categoryStats,
      lastNeedsDeficitByGood: deficitByGood,
      lastNeedsBudgetShortageByGood: budgetShortageByGood,
      lastBirths: births,
      lastDeaths: deaths,
    },
    demandRequestedByGood,
  };
}

export function resolveRegionPopulationNeedsTurn(params: {
  population: RegionPopulation;
  employedByProfession: Record<string, number>;
  wagesByProfession: Record<string, number>;
  professionIds: string[];
  fallbackProfessionId: string;
  getNeedsForPop: (pop: PopulationPop, state: PopulationProfessionState) => CultureNeedLike[];
  getGoodPrice: (goodId: string) => number;
  getAvailableGoodAmount: (goodId: string) => number;
  purchaseGood: (goodId: string, requestedPhysicalAmount: number, wallet: number) => PopulationNeedsPurchaseResult;
}): RegionPopulationNeedsResult {
  const nextProfessionsByPopId = buildNextProfessionsByPopId({
    population: params.population,
    employedByProfession: params.employedByProfession,
    professionIds: params.professionIds,
    fallbackProfessionId: params.fallbackProfessionId,
  });
  const professionTotals = calculateProfessionTotalsByPopId(nextProfessionsByPopId);
  const demandRequestedByGood: Record<string, number> = {};

  for (const pop of params.population.pops) {
    const byProfession = nextProfessionsByPopId[pop.id];
    if (!byProfession) continue;
    for (const [professionId, state] of Object.entries(byProfession)) {
      const previous = pop.professions[professionId];
      const professionTotal = Math.max(1, professionTotals[professionId] ?? state.size);
      const income = round3(Math.max(0, Number(params.wagesByProfession[professionId] ?? 0)) * (state.size / professionTotal));
      const needsResult = resolvePopulationProfessionNeedsTurn({
        state,
        previous,
        needs: params.getNeedsForPop(pop, state),
        income,
        getGoodPrice: params.getGoodPrice,
        getAvailableGoodAmount: params.getAvailableGoodAmount,
        purchaseGood: params.purchaseGood,
      });
      for (const [goodId, amount] of Object.entries(needsResult.demandRequestedByGood)) {
        demandRequestedByGood[goodId] = round3((demandRequestedByGood[goodId] ?? 0) + amount);
      }
      byProfession[professionId] = needsResult.nextState;
    }
  }

  return {
    nextProfessionsByPopId,
    demandRequestedByGood,
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
