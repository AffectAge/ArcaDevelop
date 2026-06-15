import type { DivisionStats } from "@arcanorum/shared";
import {
  POPULATION_FALLBACK_KEY_BY_DIMENSION,
  POPULATION_FALLBACK_NAME_BY_DIMENSION,
  normalizeCompareText,
  normalizeCultureNeedsProfile,
} from "../mechanics/populationMechanics";
import { normalizeLawParliamentPowerEffect } from "../mechanics/parliamentMechanics";
import {
  normalizeDecision,
  normalizeGameEvent,
  normalizeIdeologyAttractionRules,
  normalizeModifiers,
} from "../mechanics/contentDefinitionNormalizers";
import { normalizeGoodFlows, normalizeWorkforceRequirements } from "../mechanics/contentFieldNormalizers";
import {
  DEFAULT_BUILDING_DURABILITY_MAX,
  normalizeBuildingCountryLimits,
  normalizePollutionProductivityMode,
} from "../mechanics/buildingMechanics";
import {
  DEFAULT_RESOURCE_BASE_PRICE,
  GOOD_DISTRIBUTION_TYPES,
  GOOD_TRANSPORT_MODES,
  type GoodDistributionType,
  type GoodTransportMode,
} from "../mechanics/marketTurnMechanics";
import type {
  BattalionContentEntry,
  DefaultBattalionKind,
  GameContentEntry,
  GameSettings,
  MilitaryContentEntry,
} from "../runtime/gameSettingsTypes";

export const DEFAULT_UNEMPLOYED_PROFESSION: GameContentEntry = {
  id: POPULATION_FALLBACK_KEY_BY_DIMENSION.professionPct,
  name: POPULATION_FALLBACK_NAME_BY_DIMENSION.professionPct,
  description: "",
  color: "#94a3b8",
  logoUrl: null,
  malePortraitUrl: null,
  femalePortraitUrl: null,
  baseWage: 0,
};

export const DEFAULT_CULTURE: GameContentEntry = {
  id: POPULATION_FALLBACK_KEY_BY_DIMENSION.culturePct,
  name: POPULATION_FALLBACK_NAME_BY_DIMENSION.culturePct,
  description: "",
  color: "#38bdf8",
  logoUrl: null,
  malePortraitUrl: null,
  femalePortraitUrl: null,
};

export const DEFAULT_IDEOLOGY: GameContentEntry = {
  id: POPULATION_FALLBACK_KEY_BY_DIMENSION.ideologyPct,
  name: POPULATION_FALLBACK_NAME_BY_DIMENSION.ideologyPct,
  description: "",
  color: "#f59e0b",
  logoUrl: null,
  malePortraitUrl: null,
  femalePortraitUrl: null,
};

export const DEFAULT_RELIGION: GameContentEntry = {
  id: POPULATION_FALLBACK_KEY_BY_DIMENSION.religionPct,
  name: POPULATION_FALLBACK_NAME_BY_DIMENSION.religionPct,
  description: "",
  color: "#facc15",
  logoUrl: null,
  malePortraitUrl: null,
  femalePortraitUrl: null,
};

export const DEFAULT_RACE: GameContentEntry = {
  id: POPULATION_FALLBACK_KEY_BY_DIMENSION.racePct,
  name: POPULATION_FALLBACK_NAME_BY_DIMENSION.racePct,
  description: "",
  color: "#a78bfa",
  logoUrl: null,
  malePortraitUrl: null,
  femalePortraitUrl: null,
};

export function normalizeNumberRecord(input: unknown, min: number, max: number, digits = 3): Record<string, number> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const normalized: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const key = rawKey.trim();
    if (!key || typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
    normalized[key] = Number(Math.min(max, Math.max(min, rawValue)).toFixed(digits));
  }
  return normalized;
}

export function normalizeContentCultures(input: unknown): GameSettings["content"]["cultures"] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const items: GameSettings["content"]["cultures"] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<{
      id: unknown;
      name: unknown;
      description: unknown;
      color: unknown;
      logoUrl: unknown;
      malePortraitUrl: unknown;
      femalePortraitUrl: unknown;
      baseWage: unknown;
      needsProfile: unknown;
      ideologyWeights: unknown;
      interestGroupWeights: unknown;
      professionWeights: unknown;
      religionWeights: unknown;
      buildingWeights: unknown;
      lawPreferences: unknown;
      discipline: unknown;
      basePoliticalStrength: unknown;
      solMultiplier: unknown;
      radicalMultiplier: unknown;
      loyalistMultiplier: unknown;
      defaultPartyId: unknown;
      lawGroupId: unknown;
      defaultLawId: unknown;
      order: unknown;
      enactmentDifficulty: unknown;
      votingDurationTurns: unknown;
      parliamentPower: unknown;
      costScience: unknown;
      prerequisiteTechnologyIds: unknown;
      unlockBuildingIds: unknown;
      unlockLawIds: unknown;
      modifiers: unknown;
      decision: unknown;
      event: unknown;
      ideologyAttractionRules: unknown;
    }>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const description = typeof row.description === "string" ? row.description.trim() : "";
    const color = typeof row.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(row.color.trim()) ? row.color.trim() : "#4ade80";
    const logoUrl = typeof row.logoUrl === "string" || row.logoUrl === null ? (row.logoUrl ?? null) : null;
    const malePortraitUrl =
      typeof row.malePortraitUrl === "string" || row.malePortraitUrl === null ? (row.malePortraitUrl ?? null) : null;
    const femalePortraitUrl =
      typeof row.femalePortraitUrl === "string" || row.femalePortraitUrl === null ? (row.femalePortraitUrl ?? null) : null;
    const baseWage =
      typeof row.baseWage === "number" && Number.isFinite(row.baseWage) ? Math.max(0, Number(row.baseWage)) : undefined;
    const discipline =
      typeof row.discipline === "number" && Number.isFinite(row.discipline) ? Math.min(1, Math.max(0, row.discipline)) : undefined;
    const basePoliticalStrength =
      typeof row.basePoliticalStrength === "number" && Number.isFinite(row.basePoliticalStrength)
        ? Math.max(0, row.basePoliticalStrength)
        : undefined;
    const solMultiplier =
      typeof row.solMultiplier === "number" && Number.isFinite(row.solMultiplier) ? Math.max(-10, row.solMultiplier) : undefined;
    const radicalMultiplier =
      typeof row.radicalMultiplier === "number" && Number.isFinite(row.radicalMultiplier)
        ? Math.max(-10, row.radicalMultiplier)
        : undefined;
    const loyalistMultiplier =
      typeof row.loyalistMultiplier === "number" && Number.isFinite(row.loyalistMultiplier)
        ? Math.max(-10, row.loyalistMultiplier)
        : undefined;
    const lawGroupId = typeof row.lawGroupId === "string" && row.lawGroupId.trim() ? row.lawGroupId.trim().slice(0, 120) : null;
    const defaultLawId = typeof row.defaultLawId === "string" && row.defaultLawId.trim() ? row.defaultLawId.trim().slice(0, 120) : null;
    const defaultPartyId =
      typeof row.defaultPartyId === "string" && row.defaultPartyId.trim() ? row.defaultPartyId.trim().slice(0, 120) : null;
    const order = typeof row.order === "number" && Number.isFinite(row.order) ? Math.floor(row.order) : undefined;
    const enactmentDifficulty =
      typeof row.enactmentDifficulty === "number" && Number.isFinite(row.enactmentDifficulty)
        ? Math.max(0.1, row.enactmentDifficulty)
        : undefined;
    const votingDurationTurns =
      typeof row.votingDurationTurns === "number" && Number.isFinite(row.votingDurationTurns)
        ? Math.max(1, Math.floor(row.votingDurationTurns))
        : undefined;
    const costScience =
      typeof row.costScience === "number" && Number.isFinite(row.costScience) ? Math.max(0, row.costScience) : undefined;
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      name: name.slice(0, 80),
      description: description.slice(0, 5000),
      color,
      logoUrl,
      malePortraitUrl,
      femalePortraitUrl,
      baseWage: baseWage == null ? undefined : Number(baseWage.toFixed(3)),
      needsProfile: normalizeCultureNeedsProfile(row.needsProfile),
      ideologyWeights: normalizeNumberRecord(row.ideologyWeights, 0, 100),
      interestGroupWeights: normalizeNumberRecord(row.interestGroupWeights, 0, 100),
      professionWeights: normalizeNumberRecord(row.professionWeights, 0, 100),
      religionWeights: normalizeNumberRecord(row.religionWeights, 0, 100),
      buildingWeights: normalizeNumberRecord(row.buildingWeights, 0, 100),
      lawPreferences: normalizeNumberRecord(row.lawPreferences, -100, 100),
      discipline: discipline == null ? undefined : Number(discipline.toFixed(3)),
      basePoliticalStrength: basePoliticalStrength == null ? undefined : Number(basePoliticalStrength.toFixed(3)),
      solMultiplier: solMultiplier == null ? undefined : Number(solMultiplier.toFixed(3)),
      radicalMultiplier: radicalMultiplier == null ? undefined : Number(radicalMultiplier.toFixed(3)),
      loyalistMultiplier: loyalistMultiplier == null ? undefined : Number(loyalistMultiplier.toFixed(3)),
      defaultPartyId,
      lawGroupId,
      defaultLawId,
      order,
      enactmentDifficulty: enactmentDifficulty == null ? undefined : Number(enactmentDifficulty.toFixed(3)),
      votingDurationTurns,
      parliamentPower: normalizeLawParliamentPowerEffect(row.parliamentPower),
      costScience: costScience == null ? undefined : Number(costScience.toFixed(3)),
      prerequisiteTechnologyIds: normalizeCountryIdList(row.prerequisiteTechnologyIds),
      unlockBuildingIds: normalizeCountryIdList(row.unlockBuildingIds),
      unlockLawIds: normalizeCountryIdList(row.unlockLawIds),
      modifiers: normalizeModifiers(row.modifiers),
      decision: normalizeDecision(row.decision),
      event: normalizeGameEvent(row.event),
      ideologyAttractionRules: normalizeIdeologyAttractionRules(row.ideologyAttractionRules),
    });
  }
  return items;
}

export function normalizeContentRaces(input: unknown): GameSettings["content"]["races"] {
  return normalizeContentCultures(input);
}

export function ensureDefaultContentEntry<T extends GameContentEntry>(entries: T[], fallback: T): T[] {
  const wantedName = normalizeCompareText(fallback.name);
  const wantedId = normalizeCompareText(fallback.id);
  const hasFallback = entries.some((entry) => {
    const nameNorm = normalizeCompareText(entry.name);
    const idNorm = normalizeCompareText(entry.id);
    return nameNorm === wantedName || idNorm === wantedId;
  });
  return hasFallback ? entries : [fallback, ...entries];
}

export function ensureDefaultCulture(cultures: GameSettings["content"]["cultures"]): GameSettings["content"]["cultures"] {
  return ensureDefaultContentEntry(cultures, DEFAULT_CULTURE);
}

export function ensureDefaultIdeology(ideologies: GameSettings["content"]["ideologies"]): GameSettings["content"]["ideologies"] {
  return ensureDefaultContentEntry(ideologies, DEFAULT_IDEOLOGY);
}

export function ensureDefaultReligion(religions: GameSettings["content"]["religions"]): GameSettings["content"]["religions"] {
  return ensureDefaultContentEntry(religions, DEFAULT_RELIGION);
}

export function ensureDefaultRace(races: GameSettings["content"]["races"]): GameSettings["content"]["races"] {
  return ensureDefaultContentEntry(races, DEFAULT_RACE);
}

export function ensureDefaultUnemployedProfession(professions: GameSettings["content"]["professions"]): GameSettings["content"]["professions"] {
  return ensureDefaultContentEntry(professions, DEFAULT_UNEMPLOYED_PROFESSION);
}

const DEFAULT_BATTALION_STATS: Record<DefaultBattalionKind, DivisionStats> = {
  infantry: { manpower: 1000, attack: 6, defense: 10, breakthrough: 3, organization: 8, hp: 25, speed: 1, supplyUse: 1 },
  archers: { manpower: 800, attack: 9, defense: 5, breakthrough: 2, organization: 6, hp: 18, speed: 1, supplyUse: 0.8 },
  cavalry: { manpower: 900, attack: 8, defense: 6, breakthrough: 8, organization: 7, hp: 20, speed: 2, supplyUse: 1.3 },
  artillery: { manpower: 500, attack: 18, defense: 2, breakthrough: 5, organization: 3, hp: 12, speed: 0.7, supplyUse: 1.7 },
  mages: { manpower: 250, attack: 22, defense: 4, breakthrough: 7, organization: 5, hp: 10, speed: 1, supplyUse: 2 },
  constructs: { manpower: 120, attack: 14, defense: 16, breakthrough: 9, organization: 4, hp: 35, speed: 0.8, supplyUse: 2.4 },
  support: { manpower: 300, attack: 2, defense: 3, breakthrough: 2, organization: 10, hp: 8, speed: 1, supplyUse: 0.5 },
};

export const DEFAULT_BATTALIONS: BattalionContentEntry[] = [
  ["infantry", "Пехотный батальон", "Линейная пехота для удержания фронта.", "#4ade80"],
  ["archers", "Стрелковый батальон", "Дистанционная атака с умеренной стойкостью.", "#38bdf8"],
  ["cavalry", "Кавалерийский батальон", "Быстрое соединение для прорыва и маневра.", "#f59e0b"],
  ["artillery", "Артиллерийская батарея", "Сильная атака при слабой обороне.", "#f97316"],
  ["mages", "Магический батальон", "Редкие специалисты с высокой атакой.", "#a78bfa"],
  ["constructs", "Батальон конструктов", "Тяжелые стойкие войска с высоким снабжением.", "#94a3b8"],
  ["support", "Батальон поддержки", "Организация, снабжение и вспомогательные службы.", "#22c55e"],
].map(([kind, name, description, color]) => ({
  id: `battalion:${kind}`,
  name,
  description,
  color,
  logoUrl: null,
  malePortraitUrl: null,
  femalePortraitUrl: null,
  ...DEFAULT_BATTALION_STATS[kind as DefaultBattalionKind],
  trainingCostDucats: 10,
  trainingCostManpower: DEFAULT_BATTALION_STATS[kind as DefaultBattalionKind].manpower,
  equipmentNeeds: [],
}));

export function ensureDefaultBattalions(battalions: GameSettings["content"]["battalions"]): GameSettings["content"]["battalions"] {
  let next = battalions;
  for (const fallback of DEFAULT_BATTALIONS) {
    next = ensureDefaultContentEntry(next, fallback);
  }
  return next;
}

export const DEFAULT_SHIP_TYPES: MilitaryContentEntry[] = [
  {
    id: "ship:frigate",
    name: "Фрегат",
    description: "Быстрый корабль сопровождения и патруля.",
    color: "#38bdf8",
    logoUrl: null,
    malePortraitUrl: null,
    femalePortraitUrl: null,
    manpower: 250,
    attack: 8,
    defense: 6,
    breakthrough: 3,
    organization: 12,
    hp: 40,
    speed: 3,
    supplyUse: 2,
    trainingCostDucats: 35,
    trainingCostManpower: 250,
    equipmentNeeds: [],
  },
  {
    id: "ship:ship_of_the_line",
    name: "Линейный корабль",
    description: "Тяжелый боевой корабль для главной линии флота.",
    color: "#60a5fa",
    logoUrl: null,
    malePortraitUrl: null,
    femalePortraitUrl: null,
    manpower: 700,
    attack: 22,
    defense: 18,
    breakthrough: 8,
    organization: 10,
    hp: 95,
    speed: 1.8,
    supplyUse: 5,
    trainingCostDucats: 90,
    trainingCostManpower: 700,
    equipmentNeeds: [],
  },
];

export const DEFAULT_AIRCRAFT_TYPES: MilitaryContentEntry[] = [
  {
    id: "aircraft:fighter",
    name: "Истребитель",
    description: "Самолет для завоевания превосходства в воздухе.",
    color: "#a78bfa",
    logoUrl: null,
    malePortraitUrl: null,
    femalePortraitUrl: null,
    manpower: 20,
    attack: 7,
    defense: 4,
    breakthrough: 5,
    organization: 8,
    hp: 8,
    speed: 6,
    supplyUse: 0.6,
    trainingCostDucats: 8,
    trainingCostManpower: 20,
    equipmentNeeds: [],
  },
  {
    id: "aircraft:bomber",
    name: "Бомбардировщик",
    description: "Тяжелая авиация для удара по наземным целям.",
    color: "#f59e0b",
    logoUrl: null,
    malePortraitUrl: null,
    femalePortraitUrl: null,
    manpower: 35,
    attack: 14,
    defense: 2,
    breakthrough: 9,
    organization: 6,
    hp: 12,
    speed: 4,
    supplyUse: 1.2,
    trainingCostDucats: 14,
    trainingCostManpower: 35,
    equipmentNeeds: [],
  },
];

export function ensureDefaultMilitaryContent<T extends MilitaryContentEntry>(entries: T[], fallbacks: T[]): T[] {
  let next = entries;
  for (const fallback of fallbacks) {
    next = ensureDefaultContentEntry(next, fallback);
  }
  return next;
}

export function normalizeCountryIdList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<string>();
  const items: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value || unique.has(value)) continue;
    unique.add(value);
    items.push(value);
  }
  return items.slice(0, 256);
}

export function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<string>();
  const items: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    const key = value.toLocaleLowerCase("ru");
    if (!value || unique.has(key)) continue;
    unique.add(key);
    items.push(value);
  }
  return items.slice(0, 256);
}

export function normalizeOptionalFiniteNumber(input: unknown, min: number | null = null): number | null {
  if (typeof input !== "number" || !Number.isFinite(input)) return null;
  const value = min == null ? input : Math.max(min, input);
  return Number(value.toFixed(3));
}

export function normalizeContentGoods(input: unknown): GameSettings["content"]["goods"] {
  const base = normalizeContentCultures(input);
  const sourceRows = Array.isArray(input) ? input : [];
  const normalizeDistributionType = (value: unknown): GoodDistributionType => {
    return typeof value === "string" && GOOD_DISTRIBUTION_TYPES.includes(value as GoodDistributionType)
      ? (value as GoodDistributionType)
      : "tradeable";
  };
  const normalizeTransportModes = (value: unknown, distributionType: GoodDistributionType): GoodTransportMode[] => {
    if (distributionType === "service" || distributionType === "localOnly") return [];
    if (distributionType === "pipeline") return ["pipeline"];
    if (distributionType === "powerGrid") return ["powerGrid"];
    if (!Array.isArray(value)) return ["land", "sea", "air"];
    const modes = [
      ...new Set(
        value.filter((row): row is string => typeof row === "string").filter((row) =>
          GOOD_TRANSPORT_MODES.includes(row as GoodTransportMode),
        ) as GoodTransportMode[],
      ),
    ];
    return modes.length > 0 ? modes : ["land", "sea", "air"];
  };
  return base.map((entry, index) => {
    const raw = sourceRows[index] as Partial<{
      resourceCategoryId?: unknown;
      isResourceDiscoverable?: unknown;
      basePrice?: unknown;
      minPrice?: unknown;
      maxPrice?: unknown;
      infraPerUnit?: unknown;
      infrastructureCostPerUnit?: unknown;
      distributionType?: unknown;
      transportModes?: unknown;
      explorationBaseWeight?: unknown;
      explorationSmallVeinChancePct?: unknown;
      explorationMediumVeinChancePct?: unknown;
      explorationLargeVeinChancePct?: unknown;
      explorationSmallVeinMin?: unknown;
      explorationSmallVeinMax?: unknown;
      explorationMediumVeinMin?: unknown;
      explorationMediumVeinMax?: unknown;
      explorationLargeVeinMin?: unknown;
      explorationLargeVeinMax?: unknown;
    }> | undefined;
    const basePrice =
      typeof raw?.basePrice === "number" && Number.isFinite(raw.basePrice)
        ? Math.max(0, raw.basePrice)
        : DEFAULT_RESOURCE_BASE_PRICE;
    const defaultMin = basePrice * 0.1;
    const defaultMax = basePrice * 10;
    const minPriceRaw =
      typeof raw?.minPrice === "number" && Number.isFinite(raw.minPrice) ? Math.max(0, Number(raw.minPrice)) : defaultMin;
    const maxPriceRaw =
      typeof raw?.maxPrice === "number" && Number.isFinite(raw.maxPrice) ? Math.max(minPriceRaw, Number(raw.maxPrice)) : defaultMax;
    const infraRaw =
      typeof raw?.infrastructureCostPerUnit === "number" && Number.isFinite(raw.infrastructureCostPerUnit)
        ? Number(raw.infrastructureCostPerUnit)
        : typeof raw?.infraPerUnit === "number" && Number.isFinite(raw.infraPerUnit)
          ? Number(raw.infraPerUnit)
          : 1;
    const infraPerUnit = Math.max(0.01, Math.max(0, infraRaw));
    const resourceCategoryId =
      typeof raw?.resourceCategoryId === "string" && raw.resourceCategoryId.trim().length > 0
        ? raw.resourceCategoryId.trim()
        : null;
    const isResourceDiscoverable = typeof raw?.isResourceDiscoverable === "boolean" ? raw.isResourceDiscoverable : false;
    const distributionType = normalizeDistributionType(raw?.distributionType);
    const transportModes = normalizeTransportModes(raw?.transportModes, distributionType);
    const explorationBaseWeight =
      typeof raw?.explorationBaseWeight === "number" && Number.isFinite(raw.explorationBaseWeight)
        ? Math.max(0, Number(raw.explorationBaseWeight))
        : 1;
    const smallChanceRaw =
      typeof raw?.explorationSmallVeinChancePct === "number" && Number.isFinite(raw.explorationSmallVeinChancePct)
        ? Math.max(0, Number(raw.explorationSmallVeinChancePct))
        : 60;
    const mediumChanceRaw =
      typeof raw?.explorationMediumVeinChancePct === "number" && Number.isFinite(raw.explorationMediumVeinChancePct)
        ? Math.max(0, Number(raw.explorationMediumVeinChancePct))
        : 30;
    const largeChanceRaw =
      typeof raw?.explorationLargeVeinChancePct === "number" && Number.isFinite(raw.explorationLargeVeinChancePct)
        ? Math.max(0, Number(raw.explorationLargeVeinChancePct))
        : 10;
    const chanceSum = smallChanceRaw + mediumChanceRaw + largeChanceRaw;
    const chanceNormDiv = chanceSum > 0 ? chanceSum / 100 : 1;
    const smallChance = chanceSum > 0 ? smallChanceRaw / chanceNormDiv : 60;
    const mediumChance = chanceSum > 0 ? mediumChanceRaw / chanceNormDiv : 30;
    const largeChance = chanceSum > 0 ? largeChanceRaw / chanceNormDiv : 10;
    const smallMin =
      typeof raw?.explorationSmallVeinMin === "number" && Number.isFinite(raw.explorationSmallVeinMin)
        ? Math.max(0, Number(raw.explorationSmallVeinMin))
        : 10;
    const smallMax =
      typeof raw?.explorationSmallVeinMax === "number" && Number.isFinite(raw.explorationSmallVeinMax)
        ? Math.max(smallMin, Number(raw.explorationSmallVeinMax))
        : 100;
    const mediumMin =
      typeof raw?.explorationMediumVeinMin === "number" && Number.isFinite(raw.explorationMediumVeinMin)
        ? Math.max(0, Number(raw.explorationMediumVeinMin))
        : 100;
    const mediumMax =
      typeof raw?.explorationMediumVeinMax === "number" && Number.isFinite(raw.explorationMediumVeinMax)
        ? Math.max(mediumMin, Number(raw.explorationMediumVeinMax))
        : 500;
    const largeMin =
      typeof raw?.explorationLargeVeinMin === "number" && Number.isFinite(raw.explorationLargeVeinMin)
        ? Math.max(0, Number(raw.explorationLargeVeinMin))
        : 500;
    const largeMax =
      typeof raw?.explorationLargeVeinMax === "number" && Number.isFinite(raw.explorationLargeVeinMax)
        ? Math.max(largeMin, Number(raw.explorationLargeVeinMax))
        : 2_000;
    return {
      ...entry,
      resourceCategoryId,
      isResourceDiscoverable,
      basePrice: Number(basePrice.toFixed(3)),
      minPrice: Number(minPriceRaw.toFixed(3)),
      maxPrice: Number(maxPriceRaw.toFixed(3)),
      infraPerUnit: Number(infraPerUnit.toFixed(3)),
      infrastructureCostPerUnit: Number(infraPerUnit.toFixed(3)),
      distributionType,
      transportModes,
      explorationBaseWeight: Number(explorationBaseWeight.toFixed(3)),
      explorationSmallVeinChancePct: Number(smallChance.toFixed(3)),
      explorationMediumVeinChancePct: Number(mediumChance.toFixed(3)),
      explorationLargeVeinChancePct: Number(largeChance.toFixed(3)),
      explorationSmallVeinMin: Number(smallMin.toFixed(3)),
      explorationSmallVeinMax: Number(smallMax.toFixed(3)),
      explorationMediumVeinMin: Number(mediumMin.toFixed(3)),
      explorationMediumVeinMax: Number(mediumMax.toFixed(3)),
      explorationLargeVeinMin: Number(largeMin.toFixed(3)),
      explorationLargeVeinMax: Number(largeMax.toFixed(3)),
    };
  });
}

export function normalizeContentBuildings(input: unknown): GameSettings["content"]["buildings"] {
  const base = normalizeContentCultures(input);
  const sourceRows = Array.isArray(input) ? input : [];
  return base.map((entry, index) => {
    const raw = sourceRows[index] as Partial<{
      costConstruction?: unknown;
      costDucats?: unknown;
      startingDucats?: unknown;
      maxLevel?: unknown;
      maxDurability?: unknown;
      upgradeCostDucats?: unknown;
      upgradeCostConstruction?: unknown;
      extractionGoodId?: unknown;
      sectorId?: unknown;
      industryId?: unknown;
      extractionAmountPerTurn?: unknown;
      extractionRequiresDeposit?: unknown;
      inputs?: unknown;
      outputs?: unknown;
      workforceRequirements?: unknown;
      allowedCountryIds?: unknown;
      deniedCountryIds?: unknown;
      allowedProvinceTypes?: unknown;
      deniedProvinceTypes?: unknown;
      allowedClimates?: unknown;
      deniedClimates?: unknown;
      allowedLandscapes?: unknown;
      deniedLandscapes?: unknown;
      allowedContinents?: unknown;
      deniedContinents?: unknown;
      allowedStrategicRegions?: unknown;
      deniedStrategicRegions?: unknown;
      minRadiation?: unknown;
      maxRadiation?: unknown;
      pollutionProductivityMode?: unknown;
      countryBuildLimits?: unknown;
      globalBuildLimit?: unknown;
    }> | undefined;
    const costConstruction =
      typeof raw?.costConstruction === "number" && Number.isFinite(raw.costConstruction)
        ? Math.max(1, Math.floor(raw.costConstruction))
        : 100;
    const costDucats =
      typeof raw?.costDucats === "number" && Number.isFinite(raw.costDucats)
        ? Math.max(0, Number(raw.costDucats))
        : 10;
    const startingDucats =
      typeof raw?.startingDucats === "number" && Number.isFinite(raw.startingDucats)
        ? Math.max(0, Number(raw.startingDucats))
        : 0;
    const maxLevel =
      typeof raw?.maxLevel === "number" && Number.isFinite(raw.maxLevel) ? Math.max(1, Math.floor(raw.maxLevel)) : 1;
    const maxDurability =
      typeof raw?.maxDurability === "number" && Number.isFinite(raw.maxDurability)
        ? Number(Math.max(1, raw.maxDurability).toFixed(3))
        : DEFAULT_BUILDING_DURABILITY_MAX;
    const upgradeCostConstruction =
      typeof raw?.upgradeCostConstruction === "number" && Number.isFinite(raw.upgradeCostConstruction)
        ? Math.max(1, Math.floor(raw.upgradeCostConstruction))
        : costConstruction;
    const upgradeCostDucats =
      typeof raw?.upgradeCostDucats === "number" && Number.isFinite(raw.upgradeCostDucats)
        ? Math.max(0, Number(raw.upgradeCostDucats))
        : costDucats;
    const globalBuildLimit =
      typeof raw?.globalBuildLimit === "number" && Number.isFinite(raw.globalBuildLimit) && raw.globalBuildLimit > 0
        ? Math.max(1, Math.floor(raw.globalBuildLimit))
        : null;
    const extractionGoodId =
      typeof raw?.extractionGoodId === "string" && raw.extractionGoodId.trim().length > 0
        ? raw.extractionGoodId.trim()
        : null;
    const sectorIdRaw =
      typeof raw?.sectorId === "string" && raw.sectorId.trim().length > 0
        ? raw.sectorId.trim()
        : typeof raw?.industryId === "string" && raw.industryId.trim().length > 0
          ? raw.industryId.trim()
          : null;
    const industryId =
      typeof raw?.industryId === "string" && raw.industryId.trim().length > 0 ? raw.industryId.trim() : null;
    const extractionAmountPerTurn =
      typeof raw?.extractionAmountPerTurn === "number" && Number.isFinite(raw.extractionAmountPerTurn)
        ? Number(Math.max(0, raw.extractionAmountPerTurn).toFixed(3))
        : 0;
    const extractionRequiresDeposit =
      typeof raw?.extractionRequiresDeposit === "boolean" ? raw.extractionRequiresDeposit : true;
    return {
      ...entry,
      costConstruction,
      costDucats: Number(costDucats.toFixed(3)),
      startingDucats: Number(startingDucats.toFixed(3)),
      maxLevel,
      maxDurability,
      upgradeCostDucats: Number(upgradeCostDucats.toFixed(3)),
      upgradeCostConstruction,
      sectorId: sectorIdRaw,
      industryId,
      extractionGoodId,
      extractionAmountPerTurn,
      extractionRequiresDeposit,
      inputs: normalizeGoodFlows(raw?.inputs),
      outputs: normalizeGoodFlows(raw?.outputs),
      workforceRequirements: normalizeWorkforceRequirements(raw?.workforceRequirements),
      allowedCountryIds: normalizeCountryIdList(raw?.allowedCountryIds),
      deniedCountryIds: normalizeCountryIdList(raw?.deniedCountryIds),
      allowedProvinceTypes: normalizeStringList(raw?.allowedProvinceTypes),
      deniedProvinceTypes: normalizeStringList(raw?.deniedProvinceTypes),
      allowedClimates: normalizeStringList(raw?.allowedClimates),
      deniedClimates: normalizeStringList(raw?.deniedClimates),
      allowedLandscapes: normalizeStringList(raw?.allowedLandscapes),
      deniedLandscapes: normalizeStringList(raw?.deniedLandscapes),
      allowedContinents: normalizeStringList(raw?.allowedContinents),
      deniedContinents: normalizeStringList(raw?.deniedContinents),
      allowedStrategicRegions: normalizeStringList(raw?.allowedStrategicRegions),
      deniedStrategicRegions: normalizeStringList(raw?.deniedStrategicRegions),
      minRadiation: normalizeOptionalFiniteNumber(raw?.minRadiation, 0),
      maxRadiation: normalizeOptionalFiniteNumber(raw?.maxRadiation, 0),
      pollutionProductivityMode: normalizePollutionProductivityMode(raw?.pollutionProductivityMode),
      countryBuildLimits: normalizeBuildingCountryLimits(raw?.countryBuildLimits),
      globalBuildLimit,
    };
  });
}

export function normalizeContentMilitaryEntries<T extends MilitaryContentEntry>(input: unknown, fallbacks: T[]): T[] {
  const base = normalizeContentCultures(input);
  const sourceRows = Array.isArray(input) ? input : [];
  const rows = base.map((entry, index) => {
    const raw = sourceRows[index] as Partial<{
      manpower?: unknown;
      attack?: unknown;
      defense?: unknown;
      breakthrough?: unknown;
      organization?: unknown;
      hp?: unknown;
      speed?: unknown;
      supplyUse?: unknown;
      trainingCostDucats?: unknown;
      trainingCostManpower?: unknown;
      equipmentNeeds?: unknown;
    }> | undefined;
    const fallback = fallbacks.find((row) => row.id === entry.id);
    const stat = (key: keyof DivisionStats, fallbackValue: number, min = 0) =>
      typeof raw?.[key] === "number" && Number.isFinite(raw[key] as number)
        ? Number(Math.max(min, raw[key] as number).toFixed(3))
        : fallbackValue;
    return {
      ...entry,
      manpower: Math.max(0, Math.floor(stat("manpower", fallback?.manpower ?? 1000))),
      attack: stat("attack", fallback?.attack ?? 6),
      defense: stat("defense", fallback?.defense ?? 6),
      breakthrough: stat("breakthrough", fallback?.breakthrough ?? 2),
      organization: stat("organization", fallback?.organization ?? 8, 1),
      hp: stat("hp", fallback?.hp ?? 20, 1),
      speed: stat("speed", fallback?.speed ?? 1, 0.1),
      supplyUse: stat("supplyUse", fallback?.supplyUse ?? 1),
      trainingCostDucats:
        typeof raw?.trainingCostDucats === "number" && Number.isFinite(raw.trainingCostDucats)
          ? Number(Math.max(0, raw.trainingCostDucats).toFixed(3))
          : fallback?.trainingCostDucats ?? 10,
      trainingCostManpower:
        typeof raw?.trainingCostManpower === "number" && Number.isFinite(raw.trainingCostManpower)
          ? Number(Math.max(0, raw.trainingCostManpower).toFixed(3))
          : fallback?.trainingCostManpower ?? Math.max(0, Math.floor(stat("manpower", fallback?.manpower ?? 1000))),
      equipmentNeeds: normalizeGoodFlows(raw?.equipmentNeeds),
    };
  });
  return ensureDefaultMilitaryContent(rows as T[], fallbacks);
}

export function normalizeContentBattalions(input: unknown): GameSettings["content"]["battalions"] {
  return normalizeContentMilitaryEntries(input, DEFAULT_BATTALIONS);
}

export function normalizeContentShipTypes(input: unknown): GameSettings["content"]["shipTypes"] {
  return normalizeContentMilitaryEntries(input, DEFAULT_SHIP_TYPES);
}

export function normalizeContentAircraftTypes(input: unknown): GameSettings["content"]["aircraftTypes"] {
  return normalizeContentMilitaryEntries(input, DEFAULT_AIRCRAFT_TYPES);
}
