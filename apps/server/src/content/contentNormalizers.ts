import type {
  BuildingAdjacencyEffect,
  BuildingPlacementRules,
  DepositDepletionMode,
  DivisionStats,
  EquipmentBranch,
  EquipmentClass,
  EquipmentClassRole,
  EquipmentFrame,
  EquipmentModule,
  EquipmentStats,
  EquipmentStatKey,
  GoodDepositCountRule,
  GoodDepositDefinition,
  MapResourceDepositVisibility,
  UnitCombatClass,
  UnitDomain,
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
  BattalionContentEntry,
  BuildingContentEntry,
  DefaultBattalionKind,
  GameContentEntry,
  GameSettings,
  MilitaryContentEntry,
} from "../runtime/gameSettingsTypes";

const ASSET_TYPES = new Set<AssetContentEntry["type"]>(["icon", "atlas", "image"]);
const UNIT_DOMAINS = new Set<UnitDomain>(["civilian", "land", "naval", "air"]);
const UNIT_CLASSES = new Set<UnitCombatClass>(["civilian", "melee", "ranged", "cavalry", "siege", "naval_melee", "naval_ranged", "air"]);

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
    }>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
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

export const DEFAULT_EQUIPMENT_CLASSES: EquipmentClass[] = [
  {
    id: "equipment_class:infantry_kit",
    branch: "land",
    slotIds: ["weapon", "armor", "support"],
    roles: ["attack", "defense", "support"],
    baseStats: { attack: 1, defense: 1, reliability: 1, supplyUse: 0.2 },
  },
  {
    id: "equipment_class:field_vehicle",
    branch: "land",
    slotIds: ["chassis", "weapon", "engine"],
    roles: ["breakthrough", "speed", "attack"],
    baseStats: { breakthrough: 1, armor: 1, speed: 1, reliability: 0.8, supplyUse: 0.6, fuelUse: 0.4 },
  },
  {
    id: "equipment_class:aircraft",
    branch: "air",
    slotIds: ["airframe", "engine", "payload"],
    roles: ["range", "attack", "support"],
    baseStats: { speed: 2, range: 2, reliability: 0.75, fuelUse: 0.8 },
  },
  {
    id: "equipment_class:warship",
    branch: "naval",
    slotIds: ["hull", "battery", "engine"],
    roles: ["attack", "defense", "range"],
    baseStats: { attack: 2, defense: 2, range: 1, reliability: 0.75, supplyUse: 1.2, fuelUse: 0.5 },
  },
];

export const DEFAULT_EQUIPMENT_FRAMES: EquipmentFrame[] = DEFAULT_EQUIPMENT_CLASSES.map((equipmentClass) => ({
  id: `equipment_frame:${equipmentClass.id.replace(/[^a-zA-Z0-9_-]/g, "_")}:basic`,
  classId: equipmentClass.id,
  branch: equipmentClass.branch,
  slotIds: equipmentClass.slotIds,
  baseStats: equipmentClass.baseStats,
  goodsCost: [],
  manpowerCrew: equipmentClass.branch === "air" ? 1 : equipmentClass.branch === "naval" ? 50 : 0,
  productionCost: 0,
  era: "ageless",
  unlockTechnologyId: null,
}));

export const DEFAULT_EQUIPMENT_MODULES: EquipmentModule[] = [
  { id: "equipment_module:spears", classId: "equipment_class:infantry_kit", slotId: "weapon", stats: { attack: 2, piercing: 1 }, goodsCost: [{ goodId: "good:wood", amount: 1 }] },
  { id: "equipment_module:crossbows", classId: "equipment_class:infantry_kit", slotId: "weapon", stats: { attack: 4, piercing: 2, range: 1 }, goodsCost: [{ goodId: "good:wood", amount: 1 }, { goodId: "good:iron", amount: 1 }] },
  { id: "equipment_module:padded_armor", classId: "equipment_class:infantry_kit", slotId: "armor", stats: { defense: 2, reliability: 0.1 }, goodsCost: [{ goodId: "good:textiles", amount: 1 }] },
  { id: "equipment_module:plate_armor", classId: "equipment_class:infantry_kit", slotId: "armor", stats: { defense: 4, armor: 2, speed: -0.15 }, goodsCost: [{ goodId: "good:iron", amount: 2 }] },
  { id: "equipment_module:field_tools", classId: "equipment_class:infantry_kit", slotId: "support", stats: { defense: 1, supplyUse: -0.05 }, goodsCost: [{ goodId: "good:wood", amount: 1 }] },
  { id: "equipment_module:light_chassis", classId: "equipment_class:field_vehicle", slotId: "chassis", stats: { speed: 1.5, armor: 1 }, goodsCost: [{ goodId: "good:iron", amount: 2 }] },
  { id: "equipment_module:heavy_chassis", classId: "equipment_class:field_vehicle", slotId: "chassis", stats: { armor: 4, defense: 2, speed: -0.5 }, goodsCost: [{ goodId: "good:iron", amount: 4 }] },
  { id: "equipment_module:cannon", classId: "equipment_class:field_vehicle", slotId: "weapon", stats: { attack: 5, breakthrough: 2, piercing: 3 }, goodsCost: [{ goodId: "good:iron", amount: 3 }] },
  { id: "equipment_module:steam_engine", classId: "equipment_class:field_vehicle", slotId: "engine", stats: { speed: 1, fuelUse: 0.4 }, goodsCost: [{ goodId: "good:coal", amount: 2 }] },
  { id: "equipment_module:wood_airframe", classId: "equipment_class:aircraft", slotId: "airframe", stats: { speed: 1, reliability: 0.15 }, goodsCost: [{ goodId: "good:wood", amount: 2 }] },
  { id: "equipment_module:arcane_engine", classId: "equipment_class:aircraft", slotId: "engine", stats: { speed: 2, range: 2, fuelUse: 0.2 }, goodsCost: [{ goodId: "good:crystal", amount: 2 }] },
  { id: "equipment_module:bomb_rack", classId: "equipment_class:aircraft", slotId: "payload", stats: { attack: 5, breakthrough: 2, range: -0.25 }, goodsCost: [{ goodId: "good:iron", amount: 2 }] },
  { id: "equipment_module:wooden_hull", classId: "equipment_class:warship", slotId: "hull", stats: { defense: 3, supplyUse: 0.2 }, goodsCost: [{ goodId: "good:wood", amount: 5 }] },
  { id: "equipment_module:ironclad_hull", classId: "equipment_class:warship", slotId: "hull", stats: { defense: 6, armor: 4, speed: -0.4 }, goodsCost: [{ goodId: "good:iron", amount: 6 }] },
  { id: "equipment_module:broadside_battery", classId: "equipment_class:warship", slotId: "battery", stats: { attack: 6, range: 1 }, goodsCost: [{ goodId: "good:iron", amount: 4 }] },
  { id: "equipment_module:sail_rig", classId: "equipment_class:warship", slotId: "engine", stats: { speed: 1, fuelUse: -0.2 }, goodsCost: [{ goodId: "good:textiles", amount: 2 }] },
];

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
    global: normalizeGoodDepositCountRule(source.global),
    perRegion: normalizeGoodDepositCountRule(source.perRegion),
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

export function normalizeContentMilitaryEntries<T extends MilitaryContentEntry>(input: unknown, fallbacks: T[]): T[] {
  const base = normalizeContentCultures(input);
  const sourceRows = Array.isArray(input) ? input : [];
  const rows = base.map((entry, index) => {
    const raw = sourceRows[index] as Partial<{
      manpower?: unknown;
      attack?: unknown;
      defense?: unknown;
      breakthrough?: unknown;
      armor?: unknown;
      piercing?: unknown;
      organization?: unknown;
      hp?: unknown;
      speed?: unknown;
      range?: unknown;
      reliability?: unknown;
      supplyUse?: unknown;
      fuelUse?: unknown;
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
      armor: stat("armor", fallback?.armor ?? 0),
      piercing: stat("piercing", fallback?.piercing ?? 0),
      organization: stat("organization", fallback?.organization ?? 8, 1),
      hp: stat("hp", fallback?.hp ?? 20, 1),
      speed: stat("speed", fallback?.speed ?? 1, 0.1),
      range: stat("range", fallback?.range ?? 0),
      reliability: stat("reliability", fallback?.reliability ?? 0),
      supplyUse: stat("supplyUse", fallback?.supplyUse ?? 1),
      fuelUse: stat("fuelUse", fallback?.fuelUse ?? 0),
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

const EQUIPMENT_BRANCHES = new Set<EquipmentBranch>(["land", "air", "naval"]);
const EQUIPMENT_ROLES = new Set<EquipmentClassRole>(["attack", "defense", "breakthrough", "speed", "range", "support"]);
const EQUIPMENT_STAT_KEYS = new Set<EquipmentStatKey>([
  "attack",
  "defense",
  "breakthrough",
  "armor",
  "piercing",
  "speed",
  "range",
  "reliability",
  "supplyUse",
  "fuelUse",
]);

export function normalizeContentEquipmentClasses(input: unknown): GameSettings["content"]["equipmentClasses"] {
  const rows = Array.isArray(input) ? input : [];
  const normalized: EquipmentClass[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const branch = typeof entry.branch === "string" && EQUIPMENT_BRANCHES.has(entry.branch as EquipmentBranch)
      ? (entry.branch as EquipmentBranch)
      : null;
    const slotIds = Array.isArray(entry.slotIds)
      ? entry.slotIds.map((slotId) => (typeof slotId === "string" ? slotId.trim() : "")).filter(Boolean)
      : [];
    if (!id || !branch || slotIds.length === 0) continue;
    const roles = Array.isArray(entry.roles)
      ? entry.roles.filter((role): role is EquipmentClassRole => typeof role === "string" && EQUIPMENT_ROLES.has(role as EquipmentClassRole))
      : [];
    normalized.push({
      id,
      branch,
      slotIds: [...new Set(slotIds)].slice(0, 12),
      roles: roles.length > 0 ? [...new Set(roles)].slice(0, 8) : ["support"],
      baseStats: normalizeEquipmentStats(entry.baseStats),
    });
  }
  return ensureDefaultEquipmentClasses(normalized);
}

export function normalizeContentEquipmentModules(input: unknown): GameSettings["content"]["equipmentModules"] {
  const rows = Array.isArray(input) ? input : [];
  const normalized: EquipmentModule[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const classId = typeof entry.classId === "string" && entry.classId.trim() ? entry.classId.trim() : null;
    const slotId = typeof entry.slotId === "string" ? entry.slotId.trim() : "";
    if (!id || !slotId) continue;
    normalized.push({
      id,
      classId,
      slotId,
      stats: normalizeEquipmentStats(entry.stats),
      goodsCost: normalizeGoodFlows(entry.goodsCost),
      manpowerCrew: normalizeOptionalNonNegativeNumber(entry.manpowerCrew),
      productionCost: normalizeOptionalNonNegativeNumber(entry.productionCost),
    });
  }
  return ensureDefaultEquipmentModules(normalized);
}

export function normalizeContentEquipmentFrames(
  input: unknown,
  equipmentClasses: EquipmentClass[],
): GameSettings["content"]["equipmentFrames"] {
  const rows = Array.isArray(input) ? input : [];
  const classesById = new Map(equipmentClasses.map((entry) => [entry.id, entry]));
  const normalized: EquipmentFrame[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const classId = typeof entry.classId === "string" ? entry.classId.trim() : "";
    const equipmentClass = classesById.get(classId);
    if (!id || !equipmentClass) continue;
    const branch =
      typeof entry.branch === "string" && EQUIPMENT_BRANCHES.has(entry.branch as EquipmentBranch)
        ? (entry.branch as EquipmentBranch)
        : equipmentClass.branch;
    const slotIds = Array.isArray(entry.slotIds)
      ? entry.slotIds.map((slotId) => (typeof slotId === "string" ? slotId.trim() : "")).filter(Boolean)
      : equipmentClass.slotIds;
    normalized.push({
      id,
      classId,
      branch,
      slotIds: [...new Set(slotIds)].filter((slotId) => equipmentClass.slotIds.includes(slotId)).slice(0, 12),
      baseStats: normalizeEquipmentStats(entry.baseStats),
      goodsCost: normalizeGoodFlows(entry.goodsCost),
      manpowerCrew: normalizeOptionalNonNegativeNumber(entry.manpowerCrew),
      productionCost: normalizeOptionalNonNegativeNumber(entry.productionCost),
      era: typeof entry.era === "string" && entry.era.trim() ? entry.era.trim().slice(0, 80) : null,
      unlockTechnologyId:
        typeof entry.unlockTechnologyId === "string" && entry.unlockTechnologyId.trim()
          ? entry.unlockTechnologyId.trim().slice(0, 120)
          : null,
    });
  }
  return ensureDefaultEquipmentFrames(normalized, equipmentClasses);
}

export function ensureDefaultEquipmentClasses(classes: EquipmentClass[]): EquipmentClass[] {
  const byId = new Map(classes.map((entry) => [entry.id, entry]));
  for (const fallback of DEFAULT_EQUIPMENT_CLASSES) {
    if (!byId.has(fallback.id)) byId.set(fallback.id, fallback);
  }
  return [...byId.values()];
}

export function ensureDefaultEquipmentFrames(frames: EquipmentFrame[], equipmentClasses: EquipmentClass[]): EquipmentFrame[] {
  const byId = new Map(frames.map((entry) => [entry.id, entry]));
  const authoredClassIds = new Set(frames.map((entry) => entry.classId));
  for (const fallback of DEFAULT_EQUIPMENT_FRAMES) {
    if (!byId.has(fallback.id)) byId.set(fallback.id, fallback);
    authoredClassIds.add(fallback.classId);
  }
  for (const equipmentClass of equipmentClasses) {
    if (authoredClassIds.has(equipmentClass.id)) continue;
    const frame: EquipmentFrame = {
      id: `equipment_frame:${equipmentClass.id.replace(/[^a-zA-Z0-9_-]/g, "_")}:basic`,
      classId: equipmentClass.id,
      branch: equipmentClass.branch,
      slotIds: equipmentClass.slotIds,
      baseStats: equipmentClass.baseStats,
      goodsCost: [],
      manpowerCrew: 0,
      productionCost: 0,
      era: "ageless",
      unlockTechnologyId: null,
    };
    byId.set(frame.id, frame);
  }
  return [...byId.values()];
}

export function ensureDefaultEquipmentModules(modules: EquipmentModule[]): EquipmentModule[] {
  const byId = new Map(modules.map((entry) => [entry.id, entry]));
  for (const fallback of DEFAULT_EQUIPMENT_MODULES) {
    if (!byId.has(fallback.id)) byId.set(fallback.id, fallback);
  }
  return [...byId.values()];
}

function normalizeOptionalNonNegativeNumber(input: unknown): number | undefined {
  return typeof input === "number" && Number.isFinite(input) ? Number(Math.max(0, input).toFixed(3)) : undefined;
}

function normalizeEquipmentStats(input: unknown): EquipmentStats {
  const normalized: EquipmentStats = {};
  if (!input || typeof input !== "object") return normalized;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!EQUIPMENT_STAT_KEYS.has(key as EquipmentStatKey)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    normalized[key as EquipmentStatKey] = Number(Math.max(-10_000, Math.min(10_000, value)).toFixed(3));
  }
  return normalized;
}
