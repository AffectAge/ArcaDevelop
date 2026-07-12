import type {
  BuildingAdjacencyEffect,
  BuildingPlacementRules,
  DepositDepletionMode,
  GoodDepositCountRule,
  GoodDepositDefinition,
  MapTagQuery,
  MapResourceDepositVisibility,
  UnitCombatClass,
  UnitDomain,
  UnitSkillDefinition,
  UnitSkillId,
  UnitSkillModifierEffect,
  UnitSkillModifierTarget,
  UnitSkillTreeDefinition,
  UnitSkillTreeId,
  UnitTypeDefinition,
} from "@arcanorum/shared";
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
  normalizeJournalEntry,
  normalizeModifiers,
} from "../mechanics/contentDefinitionNormalizers";
import { normalizeExtractionFlows, normalizeGoodFlows, normalizeWorkforceRequirements } from "../mechanics/contentFieldNormalizers";
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
  AssetContentEntry,
  BuildingContentEntry,
  GameContentEntry,
  GameSettings,
} from "../runtime/gameSettingsTypes";

const ASSET_TYPES = new Set<AssetContentEntry["type"]>(["icon", "atlas", "image"]);
const UNIT_DOMAINS = new Set<UnitDomain>(["civilian", "land", "naval", "air"]);
const UNIT_CLASSES = new Set<UnitCombatClass>(["civilian", "melee", "ranged", "cavalry", "siege", "naval_melee", "naval_ranged", "air"]);
const UNIT_SKILL_MODIFIER_TARGETS = new Set<UnitSkillModifierTarget>([
  "unit.attack",
  "unit.defense",
  "unit.ranged_attack",
  "unit.movement",
  "unit.vision",
  "unit.max_hp",
]);

export const DEFAULT_UNIT_TYPES: UnitTypeDefinition[] = [
  {
    id: "unit:colonizer",
    domain: "civilian",
    class: "civilian",
    nameKey: "unit.colonizer.name",
    descriptionKey: "unit.colonizer.description",
    stats: { maxHp: 50, attack: 0, defense: 0, movement: 2, vision: 2 },
    productionCost: { colonization: 20, ducats: 10 },
    visual: { atlasAssetId: "asset:unit.colonizer", frameWidth: 64, frameHeight: 64, states: { idle: { frame: 0 }, move: { frame: 1 }, damaged: { frame: 3 } } },
    canFoundCity: true,
  },
  {
    id: "unit:warrior",
    domain: "land",
    class: "melee",
    nameKey: "unit.warrior.name",
    descriptionKey: "unit.warrior.description",
    stats: { maxHp: 100, attack: 20, defense: 18, movement: 2, vision: 2 },
    productionCost: { ducats: 25 },
    visual: { atlasAssetId: "asset:unit.warrior", frameWidth: 64, frameHeight: 64, states: { idle: { frame: 0 }, move: { frame: 1 }, attack: { frame: 2 }, damaged: { frame: 3 } } },
  },
  {
    id: "unit:archer",
    domain: "land",
    class: "ranged",
    nameKey: "unit.archer.name",
    descriptionKey: "unit.archer.description",
    stats: { maxHp: 100, attack: 12, defense: 12, rangedAttack: 24, range: 2, movement: 2, vision: 2 },
    productionCost: { ducats: 30 },
    visual: { atlasAssetId: "asset:unit.archer", frameWidth: 64, frameHeight: 64, states: { idle: { frame: 0 }, move: { frame: 1 }, attack: { frame: 2 }, damaged: { frame: 3 } } },
  },
  {
    id: "unit:galley",
    domain: "naval",
    class: "naval_melee",
    nameKey: "unit.galley.name",
    descriptionKey: "unit.galley.description",
    stats: { maxHp: 100, attack: 18, defense: 16, movement: 3, vision: 2 },
    productionCost: { ducats: 35 },
    visual: { atlasAssetId: "asset:unit.galley", frameWidth: 64, frameHeight: 64, states: { idle: { frame: 0 }, move: { frame: 1 }, attack: { frame: 2 }, damaged: { frame: 3 } } },
  },
];

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

export function normalizeContentAssets(input: unknown): AssetContentEntry[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const items: AssetContentEntry[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<{
      id: unknown;
      type: unknown;
      path: unknown;
      width: unknown;
      height: unknown;
      frames: unknown;
    }>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const rawType = typeof row.type === "string" ? row.type : "";
    const type = ASSET_TYPES.has(rawType as AssetContentEntry["type"]) ? (rawType as AssetContentEntry["type"]) : null;
    const path = typeof row.path === "string" ? row.path.trim().replaceAll("\\", "/") : "";
    const width = typeof row.width === "number" && Number.isFinite(row.width) ? Math.floor(row.width) : 0;
    const height = typeof row.height === "number" && Number.isFinite(row.height) ? Math.floor(row.height) : 0;
    if (!id.startsWith("asset:") || !type || !path || width <= 0 || height <= 0 || seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      type,
      path,
      width,
      height,
      frames: normalizeAssetFrames(row.frames),
    });
  }
  return items;
}

function normalizeAssetFrames(input: unknown): AssetContentEntry["frames"] | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const frames: NonNullable<AssetContentEntry["frames"]> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!key.trim() || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const x = typeof row.x === "number" && Number.isFinite(row.x) ? Math.floor(row.x) : -1;
    const y = typeof row.y === "number" && Number.isFinite(row.y) ? Math.floor(row.y) : -1;
    const width = typeof row.width === "number" && Number.isFinite(row.width) ? Math.floor(row.width) : 0;
    const height = typeof row.height === "number" && Number.isFinite(row.height) ? Math.floor(row.height) : 0;
    if (x < 0 || y < 0 || width <= 0 || height <= 0) continue;
    frames[key.trim()] = { x, y, width, height };
  }
  return Object.keys(frames).length > 0 ? frames : undefined;
}

function normalizeAssetId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  return value.startsWith("asset:") ? value.slice(0, 160) : null;
}

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

function normalizeDiscriminationEffects(input: unknown): GameContentEntry["discrimination"] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  const normalizePct = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? Number(Math.max(0, Math.min(1, value)).toFixed(3)) : undefined;
  const normalizeRate = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? Number(Math.max(0, Math.min(1_000_000, value)).toFixed(3)) : undefined;
  const result: NonNullable<GameContentEntry["discrimination"]> = {
    wagePenaltyPct: normalizePct(row.wagePenaltyPct),
    hiringPenaltyPct: normalizePct(row.hiringPenaltyPct),
    qualificationGrowthPenaltyPct: normalizePct(row.qualificationGrowthPenaltyPct),
    politicalStrengthPenaltyPct: normalizePct(row.politicalStrengthPenaltyPct),
    radicalizationPerTurn: normalizeRate(row.radicalizationPerTurn),
  };
  return Object.values(result).some((value) => value != null) ? result : null;
}

function normalizeIdentityStartingPop(input: unknown): GameContentEntry["startingPop"] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  const normalizeFinite = (value: unknown, min: number, max: number): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? Number(Math.max(min, Math.min(max, value)).toFixed(3)) : undefined;
  const normalizeCount = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : undefined;
  const result: NonNullable<GameContentEntry["startingPop"]> = {
    literacy: normalizeFinite(row.literacy, 0, 1),
    ducats: normalizeFinite(row.ducats, 0, 1_000_000),
    standardOfLiving: normalizeFinite(row.standardOfLiving, 0, 99),
    radicals: normalizeCount(row.radicals),
    loyalists: normalizeCount(row.loyalists),
    qualificationsByCategory: normalizeNumberRecord(row.qualificationsByCategory, 0, 1_000_000),
    ideologies: normalizeNumberRecord(row.ideologies, 0, 1_000_000),
  };
  return Object.values(result).some((value) => value != null && (!isRecord(value) || Object.keys(value).length > 0)) ? result : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeContentCultures(input: unknown): GameSettings["content"]["cultures"] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const items: GameSettings["content"]["cultures"] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<{
      id: unknown;
      nameKey: unknown;
      name: unknown;
      descriptionKey: unknown;
      description: unknown;
      color: unknown;
      logoUrl: unknown;
      assetId: unknown;
      iconAssetId: unknown;
      flagAssetId: unknown;
      crestAssetId: unknown;
      atlasAssetId: unknown;
      imageAssetId: unknown;
      malePortraitUrl: unknown;
      femalePortraitUrl: unknown;
      malePortraitAssetId: unknown;
      femalePortraitAssetId: unknown;
      baseWage: unknown;
      needsProfile: unknown;
      qualificationRequirements: unknown;
      qualificationGrowthRules: unknown;
      acceptedCultureIds: unknown;
      acceptedReligionIds: unknown;
      acceptedRaceIds: unknown;
      acceptanceMode: unknown;
      discrimination: unknown;
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
      journalEntry: unknown;
      ideologyAttractionRules: unknown;
      startingPop: unknown;
    }>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const nameKey = typeof row.nameKey === "string" && row.nameKey.trim() ? row.nameKey.trim().slice(0, 180) : null;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const descriptionKey =
      typeof row.descriptionKey === "string" && row.descriptionKey.trim() ? row.descriptionKey.trim().slice(0, 180) : null;
    const description = typeof row.description === "string" ? row.description.trim() : "";
    const color = typeof row.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(row.color.trim()) ? row.color.trim() : "#4ade80";
    const logoUrl = typeof row.logoUrl === "string" || row.logoUrl === null ? (row.logoUrl ?? null) : null;
    const assetId = normalizeAssetId(row.assetId);
    const iconAssetId = normalizeAssetId(row.iconAssetId);
    const flagAssetId = normalizeAssetId(row.flagAssetId);
    const crestAssetId = normalizeAssetId(row.crestAssetId);
    const atlasAssetId = normalizeAssetId(row.atlasAssetId);
    const imageAssetId = normalizeAssetId(row.imageAssetId);
    const malePortraitUrl =
      typeof row.malePortraitUrl === "string" || row.malePortraitUrl === null ? (row.malePortraitUrl ?? null) : null;
    const femalePortraitUrl =
      typeof row.femalePortraitUrl === "string" || row.femalePortraitUrl === null ? (row.femalePortraitUrl ?? null) : null;
    const malePortraitAssetId = normalizeAssetId(row.malePortraitAssetId);
    const femalePortraitAssetId = normalizeAssetId(row.femalePortraitAssetId);
    const baseWage =
      typeof row.baseWage === "number" && Number.isFinite(row.baseWage) ? Math.max(0, Number(row.baseWage)) : undefined;
    const acceptanceMode = row.acceptanceMode === "replace" ? "replace" : row.acceptanceMode === "add" ? "add" : undefined;
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
      nameKey,
      name: name.slice(0, 80),
      descriptionKey,
      description: description.slice(0, 5000),
      color,
      logoUrl,
      assetId,
      iconAssetId,
      flagAssetId,
      crestAssetId,
      atlasAssetId,
      imageAssetId,
      malePortraitUrl,
      femalePortraitUrl,
      malePortraitAssetId,
      femalePortraitAssetId,
      baseWage: baseWage == null ? undefined : Number(baseWage.toFixed(3)),
      needsProfile: normalizeCultureNeedsProfile(row.needsProfile),
      qualificationRequirements: normalizeNumberRecord(row.qualificationRequirements, 0, 1_000_000),
      qualificationGrowthRules: normalizeNumberRecord(row.qualificationGrowthRules, -1_000_000, 1_000_000),
      acceptedCultureIds: normalizeCountryIdList(row.acceptedCultureIds),
      acceptedReligionIds: normalizeCountryIdList(row.acceptedReligionIds),
      acceptedRaceIds: normalizeCountryIdList(row.acceptedRaceIds),
      acceptanceMode,
      discrimination: normalizeDiscriminationEffects(row.discrimination),
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
      journalEntry: normalizeJournalEntry(row.journalEntry),
      ideologyAttractionRules: normalizeIdeologyAttractionRules(row.ideologyAttractionRules),
      startingPop: normalizeIdentityStartingPop(row.startingPop),
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

function normalizeBuildingPlacement(input: unknown): BuildingPlacementRules | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Record<string, unknown>;
  const placement: BuildingPlacementRules = {
    allowedTerrains: normalizeStringList(source.allowedTerrains) as BuildingPlacementRules["allowedTerrains"],
    deniedTerrains: normalizeStringList(source.deniedTerrains) as BuildingPlacementRules["deniedTerrains"],
    allowedFeatures: normalizeStringList(source.allowedFeatures) as BuildingPlacementRules["allowedFeatures"],
    deniedFeatures: normalizeStringList(source.deniedFeatures) as BuildingPlacementRules["deniedFeatures"],
    allowedWaterKinds: normalizeStringList(source.allowedWaterKinds) as BuildingPlacementRules["allowedWaterKinds"],
    deniedWaterKinds: normalizeStringList(source.deniedWaterKinds) as BuildingPlacementRules["deniedWaterKinds"],
    allowedTags: normalizeStringList(source.allowedTags) as BuildingPlacementRules["allowedTags"],
    deniedTags: normalizeStringList(source.deniedTags) as BuildingPlacementRules["deniedTags"],
    tagQuery: normalizeMapTagQuery(source.tagQuery),
  };
  return placement;
}

function normalizeBuildingAdjacencyEffects(input: unknown): BuildingAdjacencyEffect[] {
  if (!Array.isArray(input)) return [];
  const effects: BuildingAdjacencyEffect[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const source = raw as Record<string, unknown>;
    const when = source.when && typeof source.when === "object" ? source.when as Record<string, unknown> : {};
    const modifier = source.modifier && typeof source.modifier === "object" ? source.modifier as Record<string, unknown> : {};
    const id = typeof source.id === "string" && source.id.trim().length > 0 ? source.id.trim() : "";
    const operation = modifier.operation === "multiply" ? "multiply" : modifier.operation === "add" ? "add" : null;
    const value = typeof modifier.value === "number" && Number.isFinite(modifier.value) ? Number(modifier.value.toFixed(6)) : null;
    if (!id || !operation || value == null || modifier.target !== "building.throughput") continue;
    effects.push({
      id,
      when: {
        neighborTerrains: normalizeStringList(when.neighborTerrains) as BuildingAdjacencyEffect["when"]["neighborTerrains"],
        neighborFeatures: normalizeStringList(when.neighborFeatures) as BuildingAdjacencyEffect["when"]["neighborFeatures"],
        neighborTags: normalizeStringList(when.neighborTags) as BuildingAdjacencyEffect["when"]["neighborTags"],
        neighborTagQuery: normalizeMapTagQuery(when.neighborTagQuery),
        neighborBuildingIds: normalizeStringList(when.neighborBuildingIds),
        adjacentToRiver: when.adjacentToRiver === true,
      },
      perNeighbor: source.perNeighbor === true,
      maxStacks: typeof source.maxStacks === "number" && Number.isFinite(source.maxStacks) ? Math.max(1, Math.floor(source.maxStacks)) : null,
      modifier: {
        target: "building.throughput",
        operation,
        value,
      },
    });
  }
  return effects.slice(0, 64);
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
      deposit?: unknown;
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
      deposit: normalizeGoodDepositDefinition(raw?.deposit),
    };
  });
}

function normalizeGoodDepositDefinition(input: unknown): GoodDepositDefinition | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const enabled = source.enabled === true;
  const depletionMode = normalizeDepositDepletionMode(source.depletionMode);
  const minAmount = normalizeNonNegativeNumber(source.minAmount, enabled ? 10 : 0);
  const maxAmount = Math.max(minAmount, normalizeNonNegativeNumber(source.maxAmount, enabled ? Math.max(100, minAmount) : 0));
  const regenPerTurn = depletionMode === "renewable" ? normalizeNonNegativeNumber(source.regenPerTurn, 1) : null;
  const minRenewableAmount = depletionMode === "renewable"
    ? Math.min(maxAmount, normalizeNonNegativeNumber(source.minRenewableAmount, minAmount))
    : null;
  return {
    enabled,
    depletionMode,
    minAmount: Number(minAmount.toFixed(3)),
    maxAmount: Number(maxAmount.toFixed(3)),
    ...(regenPerTurn == null ? {} : { regenPerTurn: Number(regenPerTurn.toFixed(3)) }),
    ...(minRenewableAmount == null ? {} : { minRenewableAmount: Number(minRenewableAmount.toFixed(3)) }),
    visibility: normalizeDepositVisibility(source.visibility),
    generation: normalizeGoodDepositGenerationRules(source.generation),
  };
}

function normalizeGoodDepositGenerationRules(input: unknown): GoodDepositDefinition["generation"] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  return {
    allowedHexTypes: normalizeStringList(source.allowedHexTypes),
    deniedHexTypes: normalizeStringList(source.deniedHexTypes),
    allowedClimates: normalizeStringList(source.allowedClimates),
    deniedClimates: normalizeStringList(source.deniedClimates),
    allowedLandscapes: normalizeStringList(source.allowedLandscapes),
    deniedLandscapes: normalizeStringList(source.deniedLandscapes),
    allowedFeatures: normalizeStringList(source.allowedFeatures),
    deniedFeatures: normalizeStringList(source.deniedFeatures),
    elevationMin: normalizeOptionalUnitNumber(source.elevationMin),
    elevationMax: normalizeOptionalUnitNumber(source.elevationMax),
    tagQuery: normalizeMapTagQuery(source.tagQuery),
    global: normalizeGoodDepositCountRule(source.global),
    perRegion: normalizeGoodDepositCountRule(source.perRegion),
  };
}

function normalizeMapTagQuery(input: unknown): MapTagQuery | null {
  if (typeof input === "string" && input.trim()) return input.trim();
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const all = Array.isArray(source.all) ? source.all.map(normalizeMapTagQuery).filter((item): item is MapTagQuery => item != null) : undefined;
  const any = Array.isArray(source.any) ? source.any.map(normalizeMapTagQuery).filter((item): item is MapTagQuery => item != null) : undefined;
  const not = Array.isArray(source.not)
    ? source.not.map(normalizeMapTagQuery).filter((item): item is MapTagQuery => item != null)
    : normalizeMapTagQuery(source.not);
  return {
    ...(all && all.length > 0 ? { all } : {}),
    ...(any && any.length > 0 ? { any } : {}),
    ...(not && (!Array.isArray(not) || not.length > 0) ? { not } : {}),
  };
}

function normalizeGoodDepositCountRule(input: unknown): GoodDepositCountRule | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const source = input as Record<string, unknown>;
  const count = normalizeNonNegativeIntegerOrNull(source.count);
  const min = normalizeNonNegativeIntegerOrNull(source.min);
  const max = normalizeNonNegativeIntegerOrNull(source.max);
  return {
    ...(count == null ? {} : { count }),
    ...(min == null ? {} : { min }),
    ...(max == null ? {} : { max }),
  };
}

function normalizeDepositDepletionMode(input: unknown): DepositDepletionMode {
  return input === "renewable" || input === "infinite" || input === "finite" ? input : "finite";
}

function normalizeDepositVisibility(input: unknown): MapResourceDepositVisibility {
  return input === "discoverable" || input === "hidden" || input === "known" ? input : "known";
}

function normalizeNonNegativeNumber(input: unknown, fallback: number): number {
  return typeof input === "number" && Number.isFinite(input) ? Math.max(0, input) : fallback;
}

function normalizeOptionalUnitNumber(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isFinite(input)) return null;
  return Math.max(0, Math.min(1, Number(input.toFixed(3))));
}

function normalizeNonNegativeIntegerOrNull(input: unknown): number | null {
  return Number.isInteger(input) && Number(input) >= 0 ? Number(input) : null;
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
      extractions?: unknown;
      requiresDepositGoodIds?: unknown;
      inputs?: unknown;
      outputs?: unknown;
      workforceRequirements?: unknown;
      allowedCountryIds?: unknown;
      deniedCountryIds?: unknown;
      allowedHexTypes?: unknown;
      deniedHexTypes?: unknown;
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
      placement?: unknown;
      adjacencyEffects?: unknown;
      deployment?: unknown;
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
      extractions: normalizeExtractionFlows(raw?.extractions),
      requiresDepositGoodIds: normalizeStringList(raw?.requiresDepositGoodIds),
      inputs: normalizeGoodFlows(raw?.inputs),
      outputs: normalizeGoodFlows(raw?.outputs),
      workforceRequirements: normalizeWorkforceRequirements(raw?.workforceRequirements),
      allowedCountryIds: normalizeCountryIdList(raw?.allowedCountryIds),
      deniedCountryIds: normalizeCountryIdList(raw?.deniedCountryIds),
      allowedHexTypes: normalizeStringList(raw?.allowedHexTypes),
      deniedHexTypes: normalizeStringList(raw?.deniedHexTypes),
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
      placement: normalizeBuildingPlacement(raw?.placement),
      adjacencyEffects: normalizeBuildingAdjacencyEffects(raw?.adjacencyEffects),
      deployment: normalizeBuildingDeployment(raw?.deployment),
    };
  });
}

export function normalizeContentUnitTypes(input: unknown): GameSettings["content"]["unitTypes"] {
  const rows = Array.isArray(input) ? input : [];
  const byId = new Map<string, UnitTypeDefinition>();
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id.trim().slice(0, 160) : "";
    const domain = typeof entry.domain === "string" && UNIT_DOMAINS.has(entry.domain as UnitDomain) ? (entry.domain as UnitDomain) : null;
    const unitClass = typeof entry.class === "string" && UNIT_CLASSES.has(entry.class as UnitCombatClass) ? (entry.class as UnitCombatClass) : null;
    const nameKey = typeof entry.nameKey === "string" && entry.nameKey.trim() ? entry.nameKey.trim().slice(0, 180) : "";
    if (!id.startsWith("unit:") || !domain || !unitClass || !nameKey || byId.has(id)) continue;
    const statsSource = entry.stats && typeof entry.stats === "object" && !Array.isArray(entry.stats) ? (entry.stats as Record<string, unknown>) : {};
    const visualSource = entry.visual && typeof entry.visual === "object" && !Array.isArray(entry.visual) ? (entry.visual as Record<string, unknown>) : {};
    byId.set(id, {
      id,
      domain,
      class: unitClass,
      nameKey,
      descriptionKey: typeof entry.descriptionKey === "string" && entry.descriptionKey.trim() ? entry.descriptionKey.trim().slice(0, 180) : null,
      stats: {
        maxHp: normalizeUnitNumber(statsSource.maxHp, 1, 10_000, 100),
        attack: normalizeUnitNumber(statsSource.attack, 0, 10_000, 0),
        defense: normalizeUnitNumber(statsSource.defense, 0, 10_000, 0),
        rangedAttack: normalizeOptionalUnitStat(statsSource.rangedAttack, 0, 10_000),
        range: normalizeOptionalUnitStat(statsSource.range, 0, 12),
        movement: normalizeUnitNumber(statsSource.movement, 0.1, 64, 1),
        vision: normalizeOptionalUnitStat(statsSource.vision, 0, 64),
      },
      productionCost: normalizeUnitProductionCost(entry.productionCost),
      unlockTechnologyId:
        typeof entry.unlockTechnologyId === "string" && entry.unlockTechnologyId.trim()
          ? entry.unlockTechnologyId.trim().slice(0, 160)
          : null,
      unitSkillTreeId:
        typeof entry.unitSkillTreeId === "string" && /^unit_skill_tree:[a-zA-Z0-9_.:-]+$/.test(entry.unitSkillTreeId)
          ? (entry.unitSkillTreeId as UnitSkillTreeId)
          : null,
      startingSkillIds: normalizeUnitSkillIds(entry.startingSkillIds),
      visual: {
        atlasAssetId: normalizeAssetId(visualSource.atlasAssetId),
        atlasPath: typeof visualSource.atlasPath === "string" && visualSource.atlasPath.trim() ? visualSource.atlasPath.trim().slice(0, 240) : null,
        frameWidth: normalizeUnitInteger(visualSource.frameWidth, 1, 512, 64),
        frameHeight: normalizeUnitInteger(visualSource.frameHeight, 1, 512, 64),
        states: normalizeUnitVisualStates(visualSource.states),
      },
      canFoundCity: typeof entry.canFoundCity === "boolean" ? entry.canFoundCity : domain === "civilian" && unitClass === "civilian",
    });
  }
  for (const fallback of DEFAULT_UNIT_TYPES) {
    if (!byId.has(fallback.id)) byId.set(fallback.id, fallback);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
}

export function normalizeContentUnitSkills(input: unknown): GameSettings["content"]["unitSkills"] {
  const rows = Array.isArray(input) ? input : [];
  const byId = new Map<UnitSkillDefinition["id"], UnitSkillDefinition>();
  for (const raw of rows) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const entry = raw as Record<string, unknown>;
    const id = typeof entry.id === "string" && /^unit_skill:[a-zA-Z0-9_.:-]+$/.test(entry.id) ? (entry.id as UnitSkillId) : null;
    const nameKey = typeof entry.nameKey === "string" && entry.nameKey.trim() ? entry.nameKey.trim().slice(0, 180) : "";
    if (!id || !nameKey || byId.has(id)) continue;
    byId.set(id, {
      id,
      nameKey,
      descriptionKey: typeof entry.descriptionKey === "string" && entry.descriptionKey.trim() ? entry.descriptionKey.trim().slice(0, 180) : null,
      effects: normalizeUnitSkillEffects(entry.effects),
    });
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
}

export function normalizeContentUnitSkillTrees(input: unknown): GameSettings["content"]["unitSkillTrees"] {
  const rows = Array.isArray(input) ? input : [];
  const byId = new Map<UnitSkillTreeDefinition["id"], UnitSkillTreeDefinition>();
  for (const raw of rows) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const entry = raw as Record<string, unknown>;
    const id =
      typeof entry.id === "string" && /^unit_skill_tree:[a-zA-Z0-9_.:-]+$/.test(entry.id)
        ? (entry.id as UnitSkillTreeDefinition["id"])
        : null;
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      id,
      nameKey: typeof entry.nameKey === "string" && entry.nameKey.trim() ? entry.nameKey.trim().slice(0, 180) : null,
      levelThresholds: normalizeUnitSkillLevelThresholds(entry.levelThresholds),
      choiceGroups: normalizeUnitSkillChoiceGroups(entry.choiceGroups),
    });
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
}

function normalizeUnitSkillIds(input: unknown): UnitSkillId[] {
  return normalizeStringList(input).filter((id): id is UnitSkillId => /^unit_skill:[a-zA-Z0-9_.:-]+$/.test(id));
}

function normalizeUnitSkillEffects(input: unknown): UnitSkillModifierEffect[] {
  const rows = Array.isArray(input) ? input : [];
  return rows.flatMap((raw): UnitSkillModifierEffect[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const entry = raw as Record<string, unknown>;
    if (entry.type !== "modifier") return [];
    const target = typeof entry.target === "string" && UNIT_SKILL_MODIFIER_TARGETS.has(entry.target as UnitSkillModifierTarget)
      ? (entry.target as UnitSkillModifierTarget)
      : null;
    const operation = entry.operation === "add" || entry.operation === "multiply" ? entry.operation : null;
    const value = typeof entry.value === "number" && Number.isFinite(entry.value) ? Number(entry.value.toFixed(3)) : null;
    if (!target || !operation || value == null) return [];
    const when = entry.when && typeof entry.when === "object" && !Array.isArray(entry.when) ? (entry.when as Record<string, unknown>) : null;
    return [{
      type: "modifier",
      target,
      operation,
      value,
      when: when
        ? {
            selfTagQuery: normalizeMapTagQuery(when.selfTagQuery),
            targetTagQuery: normalizeMapTagQuery(when.targetTagQuery),
          }
        : null,
    }];
  });
}

function normalizeUnitSkillLevelThresholds(input: unknown): Record<string, number> {
  const thresholds: Record<string, number> = { "1": 0 };
  if (!input || typeof input !== "object" || Array.isArray(input)) return thresholds;
  for (const [rawLevel, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const level = Number(rawLevel);
    if (!Number.isInteger(level) || level < 1 || level > 100 || typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
    thresholds[String(level)] = Math.max(0, Math.floor(rawValue));
  }
  return thresholds;
}

function normalizeUnitSkillChoiceGroups(input: unknown): UnitSkillTreeDefinition["choiceGroups"] {
  const rows = Array.isArray(input) ? input : [];
  return rows.flatMap((raw): UnitSkillTreeDefinition["choiceGroups"] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const entry = raw as Record<string, unknown>;
    const id = typeof entry.id === "string" && /^[a-zA-Z0-9_.:-]+$/.test(entry.id) ? entry.id.slice(0, 120) : "";
    const options = normalizeUnitSkillIds(entry.options);
    if (!id || options.length === 0) return [];
    return [{
      id,
      unlockLevel: normalizeUnitInteger(entry.unlockLevel, 1, 100, 1),
      choicesRequired: normalizeUnitInteger(entry.choicesRequired, 1, Math.max(1, options.length), 1),
      options,
      prerequisiteSkillIds: normalizeUnitSkillIds(entry.prerequisiteSkillIds),
    }];
  });
}

function normalizeUnitNumber(input: unknown, min: number, max: number, fallback: number): number {
  return typeof input === "number" && Number.isFinite(input) ? Number(Math.max(min, Math.min(max, input)).toFixed(3)) : fallback;
}

function normalizeOptionalUnitStat(input: unknown, min: number, max: number): number | undefined {
  return typeof input === "number" && Number.isFinite(input) ? Number(Math.max(min, Math.min(max, input)).toFixed(3)) : undefined;
}

function normalizeUnitInteger(input: unknown, min: number, max: number, fallback: number): number {
  return typeof input === "number" && Number.isFinite(input) ? Math.max(min, Math.min(max, Math.floor(input))) : fallback;
}

function normalizeUnitProductionCost(input: unknown): UnitTypeDefinition["productionCost"] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  return {
    ducats: normalizeOptionalUnitStat(source.ducats, 0, 1_000_000),
    construction: normalizeOptionalUnitStat(source.construction, 0, 1_000_000),
    colonization: normalizeOptionalUnitStat(source.colonization, 0, 1_000_000),
    goods: normalizeGoodFlows(source.goods),
  };
}

function normalizeUnitVisualStates(input: unknown): UnitTypeDefinition["visual"]["states"] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { idle: { frame: 0 } };
  const states: UnitTypeDefinition["visual"]["states"] = {};
  for (const key of ["idle", "move", "attack", "damaged"] as const) {
    const row = (input as Record<string, unknown>)[key];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const raw = row as Record<string, unknown>;
    states[key] = {
      frame: normalizeUnitInteger(raw.frame, 0, 256, 0),
    };
  }
  return Object.keys(states).length > 0 ? states : { idle: { frame: 0 } };
}

function normalizeBuildingDeployment(input: unknown): BuildingContentEntry["deployment"] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as { branches?: unknown; capacity?: unknown; requiresActive?: unknown };
  const branches = normalizeStringList(raw.branches).filter((branch): branch is "land" | "naval" | "air" =>
    branch === "land" || branch === "naval" || branch === "air",
  );
  if (branches.length === 0) return null;
  const capacity =
    typeof raw.capacity === "number" && Number.isFinite(raw.capacity) && raw.capacity > 0
      ? Math.max(1, Math.floor(raw.capacity))
      : null;
  return {
    branches: [...new Set(branches)],
    capacity,
    requiresActive: typeof raw.requiresActive === "boolean" ? raw.requiresActive : true,
  };
}
