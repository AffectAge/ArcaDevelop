import { AnimatePresence, motion } from "framer-motion";
import { Bell, Briefcase, Building2, ChevronDown, ChevronRight, Factory, FileText, Flame, Landmark, Network, Package, Palette, Plane, Plus, ScrollText, Shield, Ship, SlidersHorizontal, Sticker, Telescope, Trash2, Upload, UserRound, Vote, X } from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import type { DecisionCategory, DecisionEffect, EventCategory, EventPriority, EventVisibility, GameEventOption, IdeologyAttractionConditionType, IdeologyAttractionRule, LawParliamentPowerEffect, ModifierCondition, ModifierConditionType, ModifierDefinition, ModifierEffect, ModifierMode, ModifierScope, ModifierStat, ResourceTotals } from "@arcanorum/shared";
import { Tooltip } from "./Tooltip";
import { CustomSelect } from "./CustomSelect";
import { AppButton } from "./ui/AppButton";
import { AppInput, AppTextarea } from "./ui/AppForm";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState, AppSectionHeader } from "./ui/AppSurface";
import { useUiText } from "../i18n/useUiText";
import {
  adminCreateContentEntry,
  adminDeleteContentEntry,
  adminDeleteContentEntryLogo,
  adminDeleteRacePortrait,
  adminFetchContentEntries,
  adminUpdateContentEntry,
  adminUploadContentEntryLogo,
  adminUploadRacePortrait,
  fetchCountries,
  fetchWorldSnapshot,
  type ContentEntry,
  type ContentEntryKind,
} from "../lib/api";

type Props = {
  open: boolean;
  token: string;
  onClose: () => void;
};

const OTHER_INDUSTRY_GROUP_ID = "__other_industry__";
const GOOD_DISTRIBUTION_OPTIONS = [
  { value: "tradeable", label: "Обычный товар" },
  { value: "localOnly", label: "Только локально" },
  { value: "pipeline", label: "Трубопровод" },
  { value: "powerGrid", label: "Электросеть" },
  { value: "service", label: "Услуга" },
] as const;
const GOOD_TRANSPORT_OPTIONS = [
  { value: "land", label: "Суша" },
  { value: "sea", label: "Море" },
  { value: "air", label: "Воздух" },
  { value: "pipeline", label: "Трубопровод" },
  { value: "powerGrid", label: "Электросеть" },
] as const;
type DraftGoodDistributionType = (typeof GOOD_DISTRIBUTION_OPTIONS)[number]["value"];
type DraftGoodTransportMode = (typeof GOOD_TRANSPORT_OPTIONS)[number]["value"];

function getEntryIndustryId(entry: ContentEntry): string {
  const value = (entry as ContentEntry & { industryId?: unknown }).industryId;
  return typeof value === "string" && value.trim() ? value.trim() : OTHER_INDUSTRY_GROUP_ID;
}

const CONTENT_UI_SCHEMA = {
  categories: [
    {
      id: "cultures",
      label: "Культуры",
      icon: Palette,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "needs", label: "Потребности", icon: Package },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "religions",
      label: "Религии",
      icon: ScrollText,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "politics", label: "Влияние", icon: Landmark },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "races",
      label: "Расы",
      icon: UserRound,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "politics", label: "Влияние", icon: Landmark },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "resourceCategories",
      label: "Категории инфраструктуры",
      icon: Package,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "provinceTypes",
      label: "Типы провинций",
      icon: Landmark,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "provinceClimates",
      label: "Климаты",
      icon: Flame,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "provinceLandscapes",
      label: "Ландшафты",
      icon: Network,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "provinceContinents",
      label: "Континенты",
      icon: Landmark,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "provinceStrategicRegions",
      label: "Стратегические регионы",
      icon: Network,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "professions",
      label: "Профессии",
      icon: Briefcase,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "economy", label: "Экономика профессии", icon: Factory },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "battalions",
      label: "Батальоны",
      icon: Shield,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "economy", label: "Характеристики", icon: Shield },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "shipTypes",
      label: "Корабли",
      icon: Ship,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "economy", label: "Характеристики", icon: Ship },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "aircraftTypes",
      label: "Самолёты",
      icon: Plane,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "economy", label: "Характеристики", icon: Plane },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "ideologies",
      label: "Идеологии",
      icon: Flame,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "politics", label: "Влияние", icon: Landmark },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "interestGroups",
      label: "Группы интересов",
      icon: Landmark,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "politics", label: "Политика", icon: Landmark },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "parties",
      label: "Партии",
      icon: Vote,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "politics", label: "Политика", icon: Landmark },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "lawGroups",
      label: "Группы законов",
      icon: Landmark,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "politics", label: "Политика", icon: Landmark },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "laws",
      label: "Законы",
      icon: ScrollText,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "politics", label: "Политика", icon: Landmark },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "technologies",
      label: "Технологии",
      icon: Network,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "technology", label: "Древо технологий", icon: Network },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "buildings",
      label: "Здания",
      icon: Building2,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "economy", label: "Экономика и производство", icon: Factory },
        { id: "criteria", label: "Критерии", icon: ScrollText },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "goods",
      label: "Товары",
      icon: Package,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "economy", label: "Экономика товара", icon: Factory },
        { id: "exploration", label: "Георазведка", icon: Telescope },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "companies",
      label: "Компании",
      icon: Briefcase,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "industries",
      label: "Отрасли",
      icon: Factory,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "sectors",
      label: "Сектора",
      icon: Factory,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "modifiers",
      label: "Модификаторы",
      icon: SlidersHorizontal,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "modifiers", label: "Условия и эффекты", icon: SlidersHorizontal },
      ] as const,
    },
    {
      id: "decisions",
      label: "Решения",
      icon: Landmark,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "decisions", label: "Условия и эффекты", icon: Landmark },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
    {
      id: "events",
      label: "Ивенты",
      icon: Bell,
      enabled: true,
      sections: [
        { id: "general", label: "Основная информация", icon: FileText },
        { id: "events", label: "Триггеры и варианты", icon: Bell },
        { id: "branding", label: "Логотип и стиль", icon: Sticker },
      ] as const,
    },
  ] as const,
} as const;
type PanelCategory = ContentEntryKind;
type PanelSection = "general" | "economy" | "exploration" | "criteria" | "needs" | "politics" | "technology" | "modifiers" | "decisions" | "events" | "branding";
type GoodFlowDraft = { goodId: string; amount: string; affectedByFertility?: boolean; minLevel: string; maxLevel: string };
type ExtractionFlowDraft = { goodId: string; amount: string; requiresDeposit: boolean; minLevel: string; maxLevel: string };
type PollutionProductivityModeDraft = "penalty" | "bonus" | "ignore";
type WorkforceRequirementDraft = { professionId: string; workers: string };
type CountryBuildLimitDraft = { countryId: string; limit: string };
type NumberRecordDraft = { targetId: string; value: string };

function isMilitaryContentCategory(category: PanelCategory): category is "battalions" | "shipTypes" | "aircraftTypes" {
  return category === "battalions" || category === "shipTypes" || category === "aircraftTypes";
}
type ModifierEffectDraft = {
  stat: ModifierStat;
  mode: ModifierMode;
  value: string;
  buildingId: string;
  goodId: string;
  professionId: string;
  resourceCategoryId: string;
};
type ModifierDraft = {
  id: string;
  label: string;
  scope: ModifierScope;
  conditions: ModifierConditionDraft[];
  effects: ModifierEffectDraft[];
};
type ModifierConditionDraft = {
  type: ModifierConditionType;
  targetId: string;
  invert: boolean;
};
type DecisionEffectDraft = {
  type: "resource_delta";
  resource: keyof ResourceTotals;
  amount: string;
};
type EventOptionDraft = {
  id: string;
  label: string;
  description: string;
  autoChancePct: string;
  buttonColor: string;
  effects: DecisionEffectDraft[];
};
type IdeologyAttractionRuleDraft = {
  id: string;
  type: IdeologyAttractionConditionType;
  targetId: string;
  threshold: string;
  weight: string;
  label: string;
  invert: boolean;
};
type NeedGoodDraft = { goodId: string; weight: string };
type CultureNeedDraft = {
  id: string;
  label: string;
  category: "survival" | "basic" | "comfort" | "luxury";
  amountPerPerson: string;
  weight: string;
  goods: NeedGoodDraft[];
};
type CultureNeedTierDraft = { id: string; minStandardOfLiving: string; needs: CultureNeedDraft[] };

const MODIFIER_STAT_OPTIONS: Array<{ value: ModifierStat; label: string }> = [
  { value: "culture_gain", label: "Прирост культуры" },
  { value: "science_gain", label: "Прирост науки" },
  { value: "religion_gain", label: "Прирост религии" },
  { value: "colonization_gain", label: "Прирост колонизации" },
  { value: "construction_gain", label: "Прирост строительства" },
  { value: "ducats_gain", label: "Прирост дукатов" },
  { value: "gold_gain", label: "Прирост золота" },
  { value: "technology_cost", label: "Стоимость технологий" },
  { value: "building_construction_cost", label: "Стоимость строительства" },
  { value: "building_output", label: "Выпуск зданий" },
  { value: "building_input", label: "Расходы зданий" },
  { value: "building_throughput", label: "Производительность зданий" },
  { value: "building_wage", label: "Зарплаты зданий" },
];

const IDEOLOGY_ATTRACTION_RULE_OPTIONS: Array<{ value: IdeologyAttractionConditionType; label: string; target: string; threshold: string }> = [
  { value: "sol_below", label: "SoL ниже порога", target: "Не требуется", threshold: "Порог SoL" },
  { value: "sol_above", label: "SoL выше порога", target: "Не требуется", threshold: "Порог SoL" },
  { value: "radicals_above", label: "Радикалы выше %", target: "Не требуется", threshold: "% радикалов" },
  { value: "loyalists_above", label: "Лоялисты выше %", target: "Не требуется", threshold: "% лоялистов" },
  { value: "profession_is", label: "Профессия", target: "Профессия", threshold: "Не нужно" },
  { value: "religion_is", label: "Религия", target: "Религия", threshold: "Не нужно" },
  { value: "culture_is", label: "Культура", target: "Культура", threshold: "Не нужно" },
  { value: "law_active", label: "Действующий закон", target: "Закон", threshold: "Не нужно" },
  { value: "has_building", label: "Здание в провинции", target: "Здание", threshold: "Не нужно" },
  { value: "country_modifier_active", label: "Модификатор страны", target: "ID модификатора", threshold: "Не нужно" },
  { value: "province_modifier_active", label: "Модификатор провинции", target: "ID модификатора", threshold: "Не нужно" },
];

const MODIFIER_MODE_OPTIONS: Array<{ value: ModifierMode; label: string }> = [
  { value: "add_pct", label: "% к значению" },
  { value: "add", label: "+ число" },
  { value: "mult", label: "x множитель" },
];

const MODIFIER_SCOPE_OPTIONS: Array<{ value: ModifierScope; label: string }> = [
  { value: "country", label: "Страна" },
  { value: "province", label: "Провинция" },
  { value: "building", label: "Здание" },
  { value: "pop", label: "Население" },
  { value: "market", label: "Рынок" },
];

const MODIFIER_CONDITION_OPTIONS: Array<{ value: ModifierConditionType; label: string }> = [
  { value: "always", label: "Всегда" },
  { value: "law_active", label: "Принят закон" },
  { value: "technology_researched", label: "Изучена технология" },
  { value: "country_is", label: "Конкретная страна" },
  { value: "has_building", label: "Есть здание" },
];

const DECISION_CATEGORY_OPTIONS: Array<{ value: DecisionCategory; label: string }> = [
  { value: "politics", label: "Политика" },
  { value: "economy", label: "Экономика" },
  { value: "military", label: "Армия" },
  { value: "diplomacy", label: "Дипломатия" },
  { value: "colonization", label: "Колонизация" },
  { value: "culture", label: "Культура" },
  { value: "religion", label: "Религия" },
  { value: "technology", label: "Технологии" },
];

const RESOURCE_OPTIONS: Array<{ value: keyof ResourceTotals; label: string }> = [
  { value: "culture", label: "Культура" },
  { value: "science", label: "Наука" },
  { value: "religion", label: "Религия" },
  { value: "colonization", label: "Колонизация" },
  { value: "construction", label: "Строительство" },
  { value: "ducats", label: "Дукаты" },
  { value: "gold", label: "Золото" },
];

const EVENT_CATEGORY_OPTIONS: Array<{ value: EventCategory; label: string }> = [
  { value: "system", label: "Система" },
  { value: "politics", label: "Политика" },
  { value: "economy", label: "Экономика" },
  { value: "military", label: "Армия" },
  { value: "diplomacy", label: "Дипломатия" },
  { value: "colonization", label: "Колонизация" },
];

const EVENT_PRIORITY_OPTIONS: Array<{ value: EventPriority; label: string }> = [
  { value: "low", label: "Низкая" },
  { value: "medium", label: "Средняя" },
  { value: "high", label: "Высокая" },
];

const EVENT_VISIBILITY_OPTIONS: Array<{ value: EventVisibility; label: string }> = [
  { value: "private", label: "Только страна" },
  { value: "public", label: "Публично" },
];

type ModifierTargetKey = "buildingId" | "goodId" | "professionId" | "resourceCategoryId";

const MODIFIER_TARGET_LABELS: Record<ModifierTargetKey, string> = {
  buildingId: "Здание",
  goodId: "Товар",
  professionId: "Профессия",
  resourceCategoryId: "Категория",
};

const MODIFIER_STAT_CONFIG: Record<
  ModifierStat,
  { description: string; targets: ModifierTargetKey[]; defaultMode: ModifierMode; valueHint: string }
> = {
  culture_gain: {
    description: "Изменяет прирост культуры страны за ход.",
    targets: [],
    defaultMode: "add_pct",
    valueHint: "0.1 = +10%, 1 = +1",
  },
  science_gain: {
    description: "Изменяет прирост науки страны за ход.",
    targets: [],
    defaultMode: "add_pct",
    valueHint: "0.1 = +10%, 1 = +1",
  },
  religion_gain: {
    description: "Изменяет прирост религии страны за ход.",
    targets: [],
    defaultMode: "add_pct",
    valueHint: "0.1 = +10%, 1 = +1",
  },
  colonization_gain: {
    description: "Изменяет прирост колонизации страны за ход.",
    targets: [],
    defaultMode: "add_pct",
    valueHint: "0.1 = +10%, 1 = +1",
  },
  construction_gain: {
    description: "Изменяет прирост строительства страны за ход.",
    targets: [],
    defaultMode: "add_pct",
    valueHint: "0.1 = +10%, 1 = +1",
  },
  ducats_gain: {
    description: "Изменяет прирост дукатов страны за ход.",
    targets: [],
    defaultMode: "add_pct",
    valueHint: "0.1 = +10%, 1 = +1",
  },
  gold_gain: {
    description: "Изменяет прирост золота страны за ход.",
    targets: [],
    defaultMode: "add_pct",
    valueHint: "0.1 = +10%, 1 = +1",
  },
  technology_cost: {
    description: "Изменяет стоимость исследования технологий.",
    targets: [],
    defaultMode: "add_pct",
    valueHint: "-0.1 = дешевле на 10%, 0.1 = дороже на 10%",
  },
  building_construction_cost: {
    description: "Изменяет стоимость строительства выбранных зданий.",
    targets: ["buildingId"],
    defaultMode: "add_pct",
    valueHint: "-0.1 = дешевле на 10%, 0.1 = дороже на 10%",
  },
  building_output: {
    description: "Изменяет выпуск товаров зданиями.",
    targets: ["buildingId", "goodId", "resourceCategoryId"],
    defaultMode: "add_pct",
    valueHint: "0.1 = +10% выпуска, 1 = +1 единица",
  },
  building_input: {
    description: "Изменяет расход товаров зданиями.",
    targets: ["buildingId", "goodId", "resourceCategoryId"],
    defaultMode: "add_pct",
    valueHint: "-0.1 = расход меньше на 10%, 0.1 = расход больше на 10%",
  },
  building_throughput: {
    description: "Изменяет общую производительность выбранных зданий.",
    targets: ["buildingId"],
    defaultMode: "add_pct",
    valueHint: "0.1 = +10% производительности",
  },
  building_wage: {
    description: "Изменяет базовые зарплаты в выбранных зданиях или профессиях.",
    targets: ["buildingId", "professionId"],
    defaultMode: "add_pct",
    valueHint: "0.1 = зарплаты выше на 10%, -0.1 = ниже на 10%",
  },
};

const NEED_CATEGORY_OPTIONS: Array<{
  value: CultureNeedDraft["category"];
  label: string;
}> = [
  { value: "survival", label: "Выживание" },
  { value: "basic", label: "Базовые" },
  { value: "comfort", label: "Комфорт" },
  { value: "luxury", label: "Роскошь" },
];

const PARLIAMENT_POWER_DOMAIN_OPTIONS: Array<{ value: LawParliamentPowerEffect["domain"] | ""; label: string }> = [
  { value: "", label: "Не меняет полномочия" },
  { value: "laws", label: "Законы" },
  { value: "budget", label: "Бюджет" },
  { value: "diplomacy", label: "Дипломатия" },
  { value: "war", label: "Война" },
  { value: "government", label: "Правительство" },
];

const PARLIAMENT_POWER_VALUE_OPTIONS: Record<LawParliamentPowerEffect["domain"], Array<{ value: string; label: string }>> = {
  laws: [
    { value: "none", label: "Парламент не участвует" },
    { value: "advisory", label: "Формальное голосование" },
    { value: "approve", label: "Обязательное утверждение" },
    { value: "initiate", label: "Инициатива парламента" },
  ],
  budget: [
    { value: "none", label: "Бюджет вне парламента" },
    { value: "approve_taxes", label: "Утверждает налоги" },
    { value: "approve_budget", label: "Утверждает бюджет" },
    { value: "control_budget", label: "Контролирует бюджет" },
  ],
  diplomacy: [
    { value: "none", label: "Договоры вне парламента" },
    { value: "ratify_territory", label: "Ратифицирует территории" },
    { value: "ratify_major_treaties", label: "Ратифицирует крупные договоры" },
    { value: "ratify_all", label: "Ратифицирует все договоры" },
  ],
  war: [
    { value: "none", label: "Война вне парламента" },
    { value: "approve", label: "Утверждает войну" },
    { value: "declare", label: "Может объявлять войну" },
  ],
  government: [
    { value: "none", label: "Не влияет" },
    { value: "confidence_vote", label: "Вотум доверия" },
    { value: "appoint_government", label: "Назначает правительство" },
  ],
};

const CATEGORY_META: Record<
  PanelCategory,
  { singular: string; createBaseName: string; createLabel: string; namePlaceholder: string; descriptionPlaceholder: string; sectionTitle: string }
> = {
  cultures: {
    singular: "культура",
    createBaseName: "Новая культура",
    createLabel: "Создать культуру",
    namePlaceholder: "Название культуры",
    descriptionPlaceholder: "Краткое описание культуры",
    sectionTitle: "Раздел создания и редактирования культур",
  },
  races: {
    singular: "раса",
    createBaseName: "Новая раса",
    createLabel: "Создать расу",
    namePlaceholder: "Название расы",
    descriptionPlaceholder: "Краткое описание расы",
    sectionTitle: "Раздел создания и редактирования рас",
  },
  resourceCategories: {
    singular: "категория инфраструктуры",
    createBaseName: "Новая категория инфраструктуры",
    createLabel: "Создать категорию",
    namePlaceholder: "Название категории инфраструктуры",
    descriptionPlaceholder: "Краткое описание категории инфраструктуры",
    sectionTitle: "Раздел создания и редактирования категорий инфраструктуры",
  },
  provinceTypes: {
    singular: "тип провинции",
    createBaseName: "Новый тип провинции",
    createLabel: "Создать тип",
    namePlaceholder: "Название типа провинции",
    descriptionPlaceholder: "Краткое описание типа провинции",
    sectionTitle: "Раздел создания и редактирования типов провинций",
  },
  provinceClimates: {
    singular: "климат",
    createBaseName: "Новый климат",
    createLabel: "Создать климат",
    namePlaceholder: "Название климата",
    descriptionPlaceholder: "Краткое описание климата",
    sectionTitle: "Раздел создания и редактирования климатов",
  },
  provinceLandscapes: {
    singular: "ландшафт",
    createBaseName: "Новый ландшафт",
    createLabel: "Создать ландшафт",
    namePlaceholder: "Название ландшафта",
    descriptionPlaceholder: "Краткое описание ландшафта",
    sectionTitle: "Раздел создания и редактирования ландшафтов",
  },
  provinceContinents: {
    singular: "континент",
    createBaseName: "Новый континент",
    createLabel: "Создать континент",
    namePlaceholder: "Название континента",
    descriptionPlaceholder: "Краткое описание континента",
    sectionTitle: "Раздел создания и редактирования континентов",
  },
  provinceStrategicRegions: {
    singular: "стратегический регион",
    createBaseName: "Новый стратегический регион",
    createLabel: "Создать регион",
    namePlaceholder: "Название стратегического региона",
    descriptionPlaceholder: "Краткое описание стратегического региона",
    sectionTitle: "Раздел создания и редактирования стратегических регионов",
  },
  religions: {
    singular: "религия",
    createBaseName: "Новая религия",
    createLabel: "Создать религию",
    namePlaceholder: "Название религии",
    descriptionPlaceholder: "Краткое описание религии",
    sectionTitle: "Раздел создания и редактирования религий",
  },
  professions: {
    singular: "профессия",
    createBaseName: "Новая профессия",
    createLabel: "Создать профессию",
    namePlaceholder: "Название профессии",
    descriptionPlaceholder: "Краткое описание профессии",
    sectionTitle: "Раздел создания и редактирования профессий",
  },
  battalions: {
    singular: "батальон",
    createBaseName: "Новый батальон",
    createLabel: "Создать батальон",
    namePlaceholder: "Название батальона",
    descriptionPlaceholder: "Описание роли батальона в дивизии",
    sectionTitle: "Раздел создания и редактирования батальонов",
  },
  shipTypes: {
    singular: "тип корабля",
    createBaseName: "Новый корабль",
    createLabel: "Создать корабль",
    namePlaceholder: "Название типа корабля",
    descriptionPlaceholder: "Описание роли корабля во флоте",
    sectionTitle: "Раздел создания и редактирования кораблей",
  },
  aircraftTypes: {
    singular: "тип самолёта",
    createBaseName: "Новый самолёт",
    createLabel: "Создать самолёт",
    namePlaceholder: "Название типа самолёта",
    descriptionPlaceholder: "Описание роли самолёта в авиакрыле",
    sectionTitle: "Раздел создания и редактирования самолётов",
  },
  ideologies: {
    singular: "идеология",
    createBaseName: "Новая идеология",
    createLabel: "Создать идеологию",
    namePlaceholder: "Название идеологии",
    descriptionPlaceholder: "Краткое описание идеологии",
    sectionTitle: "Раздел создания и редактирования идеологий",
  },
  interestGroups: {
    singular: "группа интересов",
    createBaseName: "Новая группа интересов",
    createLabel: "Создать группу",
    namePlaceholder: "Название группы интересов",
    descriptionPlaceholder: "Краткое описание группы интересов",
    sectionTitle: "Раздел создания и редактирования групп интересов",
  },
  parties: {
    singular: "партия",
    createBaseName: "Новая партия",
    createLabel: "Создать партию",
    namePlaceholder: "Название партии",
    descriptionPlaceholder: "Краткое описание партии",
    sectionTitle: "Раздел создания и редактирования партий",
  },
  lawGroups: {
    singular: "группа законов",
    createBaseName: "Новая группа законов",
    createLabel: "Создать группу",
    namePlaceholder: "Название группы законов",
    descriptionPlaceholder: "Краткое описание группы законов",
    sectionTitle: "Раздел создания и редактирования групп законов",
  },
  laws: {
    singular: "закон",
    createBaseName: "Новый закон",
    createLabel: "Создать закон",
    namePlaceholder: "Название закона",
    descriptionPlaceholder: "Краткое описание закона",
    sectionTitle: "Раздел создания и редактирования законов",
  },
  technologies: {
    singular: "технология",
    createBaseName: "Новая технология",
    createLabel: "Создать технологию",
    namePlaceholder: "Название технологии",
    descriptionPlaceholder: "Краткое описание технологии",
    sectionTitle: "Раздел создания и редактирования технологий",
  },
  buildings: {
    singular: "здание",
    createBaseName: "Новое здание",
    createLabel: "Создать здание",
    namePlaceholder: "Название здания",
    descriptionPlaceholder: "Краткое описание здания",
    sectionTitle: "Раздел создания и редактирования зданий",
  },
  goods: {
    singular: "товар",
    createBaseName: "Новый товар",
    createLabel: "Создать товар",
    namePlaceholder: "Название товара",
    descriptionPlaceholder: "Краткое описание товара",
    sectionTitle: "Раздел создания и редактирования товаров",
  },
  companies: {
    singular: "компания",
    createBaseName: "Новая компания",
    createLabel: "Создать компанию",
    namePlaceholder: "Название компании",
    descriptionPlaceholder: "Краткое описание компании",
    sectionTitle: "Раздел создания и редактирования компаний",
  },
  industries: {
    singular: "отрасль",
    createBaseName: "Новая отрасль",
    createLabel: "Создать отрасль",
    namePlaceholder: "Название отрасли",
    descriptionPlaceholder: "Краткое описание отрасли",
    sectionTitle: "Раздел создания и редактирования отраслей",
  },
  sectors: {
    singular: "сектор",
    createBaseName: "Новый сектор",
    createLabel: "Создать сектор",
    namePlaceholder: "Название сектора",
    descriptionPlaceholder: "Краткое описание сектора",
    sectionTitle: "Раздел создания и редактирования секторов",
  },
  modifiers: {
    singular: "модификатор",
    createBaseName: "Новый модификатор",
    createLabel: "Создать модификатор",
    namePlaceholder: "Название модификатора",
    descriptionPlaceholder: "Когда и что должен менять этот модификатор",
    sectionTitle: "Универсальные условия и эффекты модификаторов",
  },
  decisions: {
    singular: "решение",
    createBaseName: "Новое решение",
    createLabel: "Создать решение",
    namePlaceholder: "Название решения",
    descriptionPlaceholder: "Что делает это решение и почему страна его принимает",
    sectionTitle: "Раздел создания и редактирования решений страны",
  },
  events: {
    singular: "ивент",
    createBaseName: "Новый ивент",
    createLabel: "Создать ивент",
    namePlaceholder: "Название ивента",
    descriptionPlaceholder: "Текст события, который увидит игрок",
    sectionTitle: "Раздел создания и редактирования событий страны",
  },
};

async function validateContentImage(file: File, kind: PanelCategory): Promise<void> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("READ_FAILED"));
    reader.readAsDataURL(file);
  });
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = kind === "events" || kind === "decisions" ? 1080 : 64;
      const maxHeight = kind === "events" || kind === "decisions" ? 970 : 64;
      if (img.width > maxWidth || img.height > maxHeight) {
        reject(new Error("LOGO_TOO_LARGE"));
        return;
      }
      resolve();
    };
    img.onerror = () => reject(new Error("IMAGE_INVALID"));
    img.src = dataUrl;
  });
}

async function validateRacePortrait(file: File): Promise<void> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("READ_FAILED"));
    reader.readAsDataURL(file);
  });
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.width > 89 || img.height > 100) {
        reject(new Error("RACE_PORTRAIT_TOO_LARGE"));
        return;
      }
      resolve();
    };
    img.onerror = () => reject(new Error("IMAGE_INVALID"));
    img.src = dataUrl;
  });
}

function normalizeLevelBoundDraft(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.floor(parsed));
}

function hasInvalidFlowLevelWindow(rows: Array<{ minLevel: string; maxLevel: string }>): boolean {
  return rows.some((row) => {
    const minLevel = normalizeLevelBoundDraft(row.minLevel);
    const maxLevel = normalizeLevelBoundDraft(row.maxLevel);
    return minLevel !== null && maxLevel !== null && maxLevel < minLevel;
  });
}

function normalizeGoodFlowsDraft(rows: GoodFlowDraft[]): Array<{ goodId: string; amount: number; affectedByFertility?: boolean; minLevel?: number; maxLevel?: number }> {
  return rows
    .map((row) => ({
      goodId: row.goodId.trim(),
      amount: Number(row.amount),
      affectedByFertility: row.affectedByFertility === true,
      minLevel: normalizeLevelBoundDraft(row.minLevel),
      maxLevel: normalizeLevelBoundDraft(row.maxLevel),
    }))
    .filter((row) => row.goodId.length > 0 && Number.isFinite(row.amount) && row.amount > 0)
    .map((row) => ({
      goodId: row.goodId,
      amount: Number(row.amount.toFixed(3)),
      ...(row.affectedByFertility ? { affectedByFertility: true } : {}),
      ...(row.minLevel !== null ? { minLevel: row.minLevel } : {}),
      ...(row.maxLevel !== null ? { maxLevel: row.maxLevel } : {}),
    }));
}

function normalizeExtractionFlowsDraft(rows: ExtractionFlowDraft[]): Array<{ goodId: string; amount: number; requiresDeposit?: boolean; minLevel?: number; maxLevel?: number }> {
  return rows
    .map((row) => ({
      goodId: row.goodId.trim(),
      amount: Number(row.amount),
      requiresDeposit: row.requiresDeposit !== false,
      minLevel: normalizeLevelBoundDraft(row.minLevel),
      maxLevel: normalizeLevelBoundDraft(row.maxLevel),
    }))
    .filter((row) => row.goodId.length > 0 && Number.isFinite(row.amount) && row.amount > 0)
    .map((row) => ({
      goodId: row.goodId,
      amount: Number(row.amount.toFixed(3)),
      ...(row.requiresDeposit ? { requiresDeposit: true } : { requiresDeposit: false }),
      ...(row.minLevel !== null ? { minLevel: row.minLevel } : {}),
      ...(row.maxLevel !== null ? { maxLevel: row.maxLevel } : {}),
    }));
}

function normalizeWorkforceDraft(rows: WorkforceRequirementDraft[]): Array<{ professionId: string; workers: number }> {
  return rows
    .map((row) => ({
      professionId: row.professionId.trim(),
      workers: Number(row.workers),
    }))
    .filter((row) => row.professionId.length > 0 && Number.isFinite(row.workers) && row.workers > 0)
    .map((row) => ({ ...row, workers: Math.floor(row.workers) }));
}

function normalizeCountryIdsDraft(rows: string[]): string[] {
  return [...new Set(rows.map((row) => row.trim()).filter((row) => row.length > 0))];
}

function optionalNumberDraft(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? Math.max(0, Number(number.toFixed(3))) : null;
}

function normalizeCountryBuildLimitsDraft(
  rows: CountryBuildLimitDraft[],
): Array<{ countryId: string; limit: number | null }> {
  const dedup = new Map<string, number | null>();
  for (const row of rows) {
    const countryId = row.countryId.trim();
    if (!countryId) continue;
    const rawLimit = row.limit.trim();
    if (rawLimit.length === 0) {
      dedup.set(countryId, null);
      continue;
    }
    const limit = Number(rawLimit);
    if (!Number.isFinite(limit) || limit <= 0) {
      dedup.set(countryId, null);
      continue;
    }
    dedup.set(countryId, Math.max(1, Math.floor(limit)));
  }
  return [...dedup.entries()].map(([countryId, limit]) => ({ countryId, limit }));
}

function normalizeNeedsProfileDraft(rows: CultureNeedTierDraft[]): ContentEntry["needsProfile"] {
  const tiers = rows
    .map((tier, tierIndex) => ({
      id: tier.id.trim() || `tier-${tierIndex + 1}`,
      minStandardOfLiving: Math.max(0, Number(tier.minStandardOfLiving || "0")),
      needs: tier.needs
        .map((need, needIndex) => ({
          id: need.id.trim() || `need-${needIndex + 1}`,
          label: need.label.trim() || need.id.trim() || `Потребность ${needIndex + 1}`,
          category: need.category ?? "basic",
          amountPerPerson: Math.max(0, Number(need.amountPerPerson || "0")),
          weight: Math.max(0.001, Number(need.weight || "1")),
          goods: need.goods
            .map((good) => ({
              goodId: good.goodId.trim(),
              weight: Math.max(0.001, Number(good.weight || "1")),
            }))
            .filter((good) => good.goodId.length > 0),
        }))
        .filter((need) => need.amountPerPerson > 0 && need.goods.length > 0),
    }))
    .filter((tier) => Number.isFinite(tier.minStandardOfLiving) && tier.needs.length > 0)
    .map((tier) => ({
      ...tier,
      minStandardOfLiving: Number(tier.minStandardOfLiving.toFixed(3)),
      needs: tier.needs.map((need) => ({
        ...need,
        amountPerPerson: Number(need.amountPerPerson.toFixed(6)),
        weight: Number(need.weight.toFixed(3)),
        goods: need.goods.map((good) => ({ ...good, weight: Number(good.weight.toFixed(3)) })),
      })),
    }));
  return tiers.length > 0 ? { tiers } : null;
}

function normalizeNumberRecordDraft(rows: NumberRecordDraft[]): Record<string, number> {
  const dedup = new Map<string, number>();
  for (const row of rows) {
    const targetId = row.targetId.trim();
    const value = Number(row.value);
    if (!targetId || !Number.isFinite(value)) continue;
    dedup.set(targetId, Number(value.toFixed(3)));
  }
  return Object.fromEntries(dedup.entries());
}

function isModifierTargetEnabled(stat: ModifierStat, key: ModifierTargetKey): boolean {
  return MODIFIER_STAT_CONFIG[stat].targets.includes(key);
}

function cleanModifierEffectForStat(effect: ModifierEffectDraft, stat: ModifierStat): ModifierEffectDraft {
  return {
    ...effect,
    stat,
    buildingId: isModifierTargetEnabled(stat, "buildingId") ? effect.buildingId : "",
    goodId: isModifierTargetEnabled(stat, "goodId") ? effect.goodId : "",
    professionId: isModifierTargetEnabled(stat, "professionId") ? effect.professionId : "",
    resourceCategoryId: isModifierTargetEnabled(stat, "resourceCategoryId") ? effect.resourceCategoryId : "",
  };
}

function normalizeModifierConditionsDraft(rows: ModifierConditionDraft[]): ModifierCondition[] {
  return rows
    .map((row): ModifierCondition | null => {
      if (row.type === "always") return { type: "always", targetId: null, invert: row.invert };
      const targetId = row.targetId.trim();
      if (!targetId) return null;
      return { type: row.type, targetId, invert: row.invert };
    })
    .filter((condition): condition is ModifierCondition => Boolean(condition));
}

function normalizeModifiersDraft(rows: ModifierDraft[]): ModifierDefinition[] {
  return rows
    .map((row, index): ModifierDefinition | null => {
      const label = row.label.trim();
      const id = row.id.trim() || label.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-+|-+$/g, "") || `modifier-${index + 1}`;
      const effects = row.effects
        .map((effect): ModifierEffect | null => {
          const value = Number(effect.value);
          if (!Number.isFinite(value)) return null;
          const cleanEffect = cleanModifierEffectForStat(effect, effect.stat);
          const target = {
            buildingId: cleanEffect.buildingId.trim() || null,
            goodId: cleanEffect.goodId.trim() || null,
            professionId: cleanEffect.professionId.trim() || null,
            resourceCategoryId: cleanEffect.resourceCategoryId.trim() || null,
          };
          return {
            stat: cleanEffect.stat,
            mode: cleanEffect.mode,
            value: Number(value.toFixed(3)),
            target: Object.values(target).some(Boolean) ? target : null,
          };
        })
        .filter((effect): effect is ModifierEffect => Boolean(effect));
      if (!label || effects.length === 0) return null;
      return { id, label, scope: row.scope, conditions: normalizeModifierConditionsDraft(row.conditions), effects };
    })
    .filter((modifier): modifier is ModifierDefinition => modifier !== null);
}

function normalizeDecisionConditionsDraft(rows: ModifierConditionDraft[]): ModifierCondition[] {
  return rows
    .map((row): ModifierCondition | null => {
      if (row.type !== "always" && !row.targetId.trim()) return null;
      return { type: row.type, targetId: row.type === "always" ? null : row.targetId.trim(), invert: row.invert };
    })
    .filter((row): row is ModifierCondition => Boolean(row));
}

function normalizeDecisionCostsDraft(rows: NumberRecordDraft[]): Partial<ResourceTotals> {
  const costs: Partial<ResourceTotals> = {};
  for (const row of rows) {
    const key = row.targetId as keyof ResourceTotals;
    if (!RESOURCE_OPTIONS.some((option) => option.value === key)) continue;
    const value = Number(row.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    costs[key] = Number(value.toFixed(3));
  }
  return costs;
}

function normalizeDecisionEffectsDraft(rows: DecisionEffectDraft[]): DecisionEffect[] {
  return rows
    .map((row): DecisionEffect | null => {
      const amount = Number(row.amount);
      if (!Number.isFinite(amount) || amount === 0) return null;
      return { type: "resource_delta", resource: row.resource, amount: Number(amount.toFixed(3)) };
    })
    .filter((row): row is DecisionEffect => Boolean(row));
}

function normalizeEventOptionsDraft(rows: EventOptionDraft[]): GameEventOption[] {
  return rows
    .map((row, index): GameEventOption | null => {
      const label = row.label.trim();
      if (!label) return null;
      const buttonColor = row.buttonColor.trim();
      return {
        id: row.id.trim() || `option:${index + 1}`,
        label,
        description: row.description.trim() || null,
        effects: normalizeDecisionEffectsDraft(row.effects),
        autoChancePct: Math.min(100, Math.max(0, Number(row.autoChancePct || "0"))),
        buttonColor: /^#[0-9A-Fa-f]{6}$/.test(buttonColor) ? buttonColor : null,
      };
    })
    .filter((row): row is GameEventOption => Boolean(row));
}

function modifiersToDraft(value?: ModifierDefinition[] | null): ModifierDraft[] {
  return (value ?? []).map((modifier) => ({
    id: modifier.id,
    label: modifier.label,
    scope: modifier.scope,
    conditions: (modifier.conditions ?? []).map((condition) => ({
      type: condition.type,
      targetId: condition.targetId ?? "",
      invert: Boolean(condition.invert),
    })),
    effects: modifier.effects.map((effect) => ({
      stat: effect.stat,
      mode: effect.mode,
      value: String(effect.value),
      buildingId: effect.target?.buildingId ?? "",
      goodId: effect.target?.goodId ?? "",
      professionId: effect.target?.professionId ?? "",
      resourceCategoryId: effect.target?.resourceCategoryId ?? "",
    })),
  }));
}

function numberRecordToDraft(value?: Record<string, number> | null): NumberRecordDraft[] {
  return Object.entries(value ?? {}).map(([targetId, amount]) => ({ targetId, value: String(amount) }));
}

function normalizeIdeologyAttractionRulesDraft(rows: IdeologyAttractionRuleDraft[]): IdeologyAttractionRule[] {
  return rows
    .map((row, index): IdeologyAttractionRule | null => {
      const weight = Number(row.weight);
      if (!Number.isFinite(weight) || weight <= 0) return null;
      const id = row.id.trim() || `rule-${index + 1}`;
      const threshold = Number(row.threshold);
      return {
        id,
        type: row.type,
        weight: Number(weight.toFixed(3)),
        threshold: Number.isFinite(threshold) ? Number(Math.max(0, threshold).toFixed(3)) : null,
        targetId: row.targetId.trim() || null,
        label: row.label.trim() || null,
        invert: row.invert,
      };
    })
    .filter((rule): rule is IdeologyAttractionRule => Boolean(rule));
}

function ideologyAttractionRulesToDraft(value?: IdeologyAttractionRule[] | null): IdeologyAttractionRuleDraft[] {
  return (value ?? []).map((rule) => ({
    id: rule.id,
    type: rule.type,
    targetId: rule.targetId ?? "",
    threshold: rule.threshold == null ? "" : String(rule.threshold),
    weight: String(rule.weight),
    label: rule.label ?? "",
    invert: Boolean(rule.invert),
  }));
}

function needsProfileToDraft(profile: ContentEntry["needsProfile"]): CultureNeedTierDraft[] {
  return (profile?.tiers ?? []).map((tier) => ({
    id: tier.id,
    minStandardOfLiving: String(tier.minStandardOfLiving),
    needs: tier.needs.map((need) => ({
      id: need.id,
      label: need.label,
      category: need.category ?? "basic",
      amountPerPerson: String(need.amountPerPerson),
      weight: String(need.weight),
      goods: need.goods.map((good) => ({ goodId: good.goodId, weight: String(good.weight) })),
    })),
  }));
}

function normalizeParliamentPowerDraft(
  domain: LawParliamentPowerEffect["domain"] | "",
  value: string,
  threshold: string,
): LawParliamentPowerEffect | null {
  if (!domain) return null;
  const options = PARLIAMENT_POWER_VALUE_OPTIONS[domain];
  const normalizedValue = options.some((option) => option.value === value) ? value : options[0]?.value;
  if (!normalizedValue) return null;
  if (domain === "laws") return { domain, value: normalizedValue as Extract<LawParliamentPowerEffect, { domain: "laws" }>["value"] };
  if (domain === "budget") return { domain, value: normalizedValue as Extract<LawParliamentPowerEffect, { domain: "budget" }>["value"] };
  if (domain === "diplomacy") {
    const parsedThreshold = Number(threshold);
    return {
      domain,
      value: normalizedValue as Extract<LawParliamentPowerEffect, { domain: "diplomacy" }>["value"],
      moneyTransferRatificationThreshold: Number.isFinite(parsedThreshold) && parsedThreshold > 0 ? Math.round(parsedThreshold) : null,
    };
  }
  if (domain === "war") return { domain, value: normalizedValue as Extract<LawParliamentPowerEffect, { domain: "war" }>["value"] };
  return { domain, value: normalizedValue as Extract<LawParliamentPowerEffect, { domain: "government" }>["value"] };
}

export function ContentPanel({ open, token, onClose }: Props) {
  const { t } = useUiText();
  const [activeCategory, setActiveCategory] = useState<PanelCategory>("cultures");
  const [contentSection, setContentSection] = useState<PanelSection>("general");
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string>("");
  const [openBuildingIndustryGroups, setOpenBuildingIndustryGroups] = useState<Record<string, boolean>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftColor, setDraftColor] = useState("#4ade80");
  const [draftLogoUrl, setDraftLogoUrl] = useState<string | null>(null);
  const [draftMalePortraitUrl, setDraftMalePortraitUrl] = useState<string | null>(null);
  const [draftFemalePortraitUrl, setDraftFemalePortraitUrl] = useState<string | null>(null);
  const [draftBasePrice, setDraftBasePrice] = useState("1");
  const [draftMinPrice, setDraftMinPrice] = useState("0.1");
  const [draftMaxPrice, setDraftMaxPrice] = useState("10");
  const [draftInfraPerUnit, setDraftInfraPerUnit] = useState("1");
  const [draftDistributionType, setDraftDistributionType] = useState<DraftGoodDistributionType>("tradeable");
  const [draftTransportModes, setDraftTransportModes] = useState<DraftGoodTransportMode[]>(["land", "sea", "air"]);
  const [draftResourceCategoryId, setDraftResourceCategoryId] = useState("");
  const [draftIsResourceDiscoverable, setDraftIsResourceDiscoverable] = useState(false);
  const [draftExplorationBaseWeight, setDraftExplorationBaseWeight] = useState("1");
  const [draftExplorationSmallChance, setDraftExplorationSmallChance] = useState("60");
  const [draftExplorationMediumChance, setDraftExplorationMediumChance] = useState("30");
  const [draftExplorationLargeChance, setDraftExplorationLargeChance] = useState("10");
  const [draftExplorationSmallMin, setDraftExplorationSmallMin] = useState("10");
  const [draftExplorationSmallMax, setDraftExplorationSmallMax] = useState("100");
  const [draftExplorationMediumMin, setDraftExplorationMediumMin] = useState("100");
  const [draftExplorationMediumMax, setDraftExplorationMediumMax] = useState("500");
  const [draftExplorationLargeMin, setDraftExplorationLargeMin] = useState("500");
  const [draftExplorationLargeMax, setDraftExplorationLargeMax] = useState("2000");
  const [draftBaseWage, setDraftBaseWage] = useState("1");
  const [draftBattalionManpower, setDraftBattalionManpower] = useState("1000");
  const [draftBattalionAttack, setDraftBattalionAttack] = useState("6");
  const [draftBattalionDefense, setDraftBattalionDefense] = useState("6");
  const [draftBattalionBreakthrough, setDraftBattalionBreakthrough] = useState("2");
  const [draftBattalionOrganization, setDraftBattalionOrganization] = useState("8");
  const [draftBattalionHp, setDraftBattalionHp] = useState("20");
  const [draftBattalionSpeed, setDraftBattalionSpeed] = useState("1");
  const [draftBattalionSupplyUse, setDraftBattalionSupplyUse] = useState("1");
  const [draftBattalionTrainingCostDucats, setDraftBattalionTrainingCostDucats] = useState("10");
  const [draftBattalionTrainingCostManpower, setDraftBattalionTrainingCostManpower] = useState("1000");
  const [draftBattalionEquipmentNeeds, setDraftBattalionEquipmentNeeds] = useState<GoodFlowDraft[]>([]);
  const [draftCostConstruction, setDraftCostConstruction] = useState("100");
  const [draftCostDucats, setDraftCostDucats] = useState("10");
  const [draftStartingDucats, setDraftStartingDucats] = useState("0");
  const [draftMaxLevel, setDraftMaxLevel] = useState("1");
  const [draftMaxDurability, setDraftMaxDurability] = useState("100");
  const [draftUpgradeCostDucats, setDraftUpgradeCostDucats] = useState("10");
  const [draftUpgradeCostConstruction, setDraftUpgradeCostConstruction] = useState("100");
  const [draftIndustryId, setDraftIndustryId] = useState("");
  const [draftSectorId, setDraftSectorId] = useState("");
  const [draftExtractionGoodId, setDraftExtractionGoodId] = useState("");
  const [draftExtractionAmountPerTurn, setDraftExtractionAmountPerTurn] = useState("0");
  const [draftExtractionRequiresDeposit, setDraftExtractionRequiresDeposit] = useState(true);
  const [draftExtractions, setDraftExtractions] = useState<ExtractionFlowDraft[]>([]);
  const [draftInputs, setDraftInputs] = useState<GoodFlowDraft[]>([]);
  const [draftOutputs, setDraftOutputs] = useState<GoodFlowDraft[]>([]);
  const [draftWorkforceRequirements, setDraftWorkforceRequirements] = useState<WorkforceRequirementDraft[]>([]);
  const [draftNeedsProfile, setDraftNeedsProfile] = useState<CultureNeedTierDraft[]>([]);
  const [draftAllowedCountryIds, setDraftAllowedCountryIds] = useState<string[]>([]);
  const [draftDeniedCountryIds, setDraftDeniedCountryIds] = useState<string[]>([]);
  const [draftAllowedProvinceTypes, setDraftAllowedProvinceTypes] = useState<string[]>([]);
  const [draftDeniedProvinceTypes, setDraftDeniedProvinceTypes] = useState<string[]>([]);
  const [draftAllowedClimates, setDraftAllowedClimates] = useState<string[]>([]);
  const [draftDeniedClimates, setDraftDeniedClimates] = useState<string[]>([]);
  const [draftAllowedLandscapes, setDraftAllowedLandscapes] = useState<string[]>([]);
  const [draftDeniedLandscapes, setDraftDeniedLandscapes] = useState<string[]>([]);
  const [draftAllowedContinents, setDraftAllowedContinents] = useState<string[]>([]);
  const [draftDeniedContinents, setDraftDeniedContinents] = useState<string[]>([]);
  const [draftAllowedStrategicRegions, setDraftAllowedStrategicRegions] = useState<string[]>([]);
  const [draftDeniedStrategicRegions, setDraftDeniedStrategicRegions] = useState<string[]>([]);
  const [draftMinRadiation, setDraftMinRadiation] = useState("");
  const [draftMaxRadiation, setDraftMaxRadiation] = useState("");
  const [draftPollutionProductivityMode, setDraftPollutionProductivityMode] = useState<PollutionProductivityModeDraft>("penalty");
  const [draftCountryBuildLimits, setDraftCountryBuildLimits] = useState<CountryBuildLimitDraft[]>([]);
  const [draftGlobalBuildLimit, setDraftGlobalBuildLimit] = useState("");
  const [draftIdeologyWeights, setDraftIdeologyWeights] = useState<NumberRecordDraft[]>([]);
  const [draftInterestGroupWeights, setDraftInterestGroupWeights] = useState<NumberRecordDraft[]>([]);
  const [draftProfessionWeights, setDraftProfessionWeights] = useState<NumberRecordDraft[]>([]);
  const [draftReligionWeights, setDraftReligionWeights] = useState<NumberRecordDraft[]>([]);
  const [draftBuildingWeights, setDraftBuildingWeights] = useState<NumberRecordDraft[]>([]);
  const [draftLawPreferences, setDraftLawPreferences] = useState<NumberRecordDraft[]>([]);
  const [draftDiscipline, setDraftDiscipline] = useState("0.85");
  const [draftBasePoliticalStrength, setDraftBasePoliticalStrength] = useState("1");
  const [draftSolMultiplier, setDraftSolMultiplier] = useState("0.03");
  const [draftRadicalMultiplier, setDraftRadicalMultiplier] = useState("0.5");
  const [draftLoyalistMultiplier, setDraftLoyalistMultiplier] = useState("0.25");
  const [draftDefaultPartyId, setDraftDefaultPartyId] = useState("");
  const [draftLawGroupId, setDraftLawGroupId] = useState("");
  const [draftDefaultLawId, setDraftDefaultLawId] = useState("");
  const [draftOrder, setDraftOrder] = useState("0");
  const [draftEnactmentDifficulty, setDraftEnactmentDifficulty] = useState("1");
  const [draftVotingDurationTurns, setDraftVotingDurationTurns] = useState("3");
  const [draftParliamentPowerDomain, setDraftParliamentPowerDomain] = useState<LawParliamentPowerEffect["domain"] | "">("");
  const [draftParliamentPowerValue, setDraftParliamentPowerValue] = useState("");
  const [draftParliamentPowerThreshold, setDraftParliamentPowerThreshold] = useState("10000");
  const [draftCostScience, setDraftCostScience] = useState("100");
  const [draftPrerequisiteTechnologyIds, setDraftPrerequisiteTechnologyIds] = useState<string[]>([]);
  const [draftUnlockBuildingIds, setDraftUnlockBuildingIds] = useState<string[]>([]);
  const [draftUnlockLawIds, setDraftUnlockLawIds] = useState<string[]>([]);
  const [draftModifiers, setDraftModifiers] = useState<ModifierDraft[]>([]);
  const [draftDecisionCategory, setDraftDecisionCategory] = useState<DecisionCategory>("politics");
  const [draftDecisionRepeatable, setDraftDecisionRepeatable] = useState(false);
  const [draftDecisionCooldownTurns, setDraftDecisionCooldownTurns] = useState("0");
  const [draftDecisionVisibilityConditions, setDraftDecisionVisibilityConditions] = useState<ModifierConditionDraft[]>([]);
  const [draftDecisionAvailabilityConditions, setDraftDecisionAvailabilityConditions] = useState<ModifierConditionDraft[]>([]);
  const [draftDecisionCosts, setDraftDecisionCosts] = useState<NumberRecordDraft[]>([]);
  const [draftDecisionEffects, setDraftDecisionEffects] = useState<DecisionEffectDraft[]>([]);
  const [draftEventCategory, setDraftEventCategory] = useState<EventCategory>("politics");
  const [draftEventPriority, setDraftEventPriority] = useState<EventPriority>("medium");
  const [draftEventVisibility, setDraftEventVisibility] = useState<EventVisibility>("private");
  const [draftEventRepeatable, setDraftEventRepeatable] = useState(false);
  const [draftEventBlocking, setDraftEventBlocking] = useState(false);
  const [draftEventCooldownTurns, setDraftEventCooldownTurns] = useState("0");
  const [draftEventCheckIntervalTurns, setDraftEventCheckIntervalTurns] = useState("1");
  const [draftEventChancePct, setDraftEventChancePct] = useState("100");
  const [draftEventTriggerConditions, setDraftEventTriggerConditions] = useState<ModifierConditionDraft[]>([]);
  const [draftEventOptions, setDraftEventOptions] = useState<EventOptionDraft[]>([]);
  const [draftIdeologyAttractionRules, setDraftIdeologyAttractionRules] = useState<IdeologyAttractionRuleDraft[]>([]);
  const [allowCountrySearch, setAllowCountrySearch] = useState("");
  const [denyCountrySearch, setDenyCountrySearch] = useState("");
  const [criteriaCountriesOpen, setCriteriaCountriesOpen] = useState(false);
  const [criteriaProvinceOpen, setCriteriaProvinceOpen] = useState(false);
  const [criteriaLimitsOpen, setCriteriaLimitsOpen] = useState(false);
  const [goodsEconomyOpen, setGoodsEconomyOpen] = useState(false);
  const [goodsExplorationOpen, setGoodsExplorationOpen] = useState(false);
  const [buildingCostOpen, setBuildingCostOpen] = useState(false);
  const [buildingUpgradeOpen, setBuildingUpgradeOpen] = useState(false);
  const [buildingExtractionOpen, setBuildingExtractionOpen] = useState(false);
  const [buildingInputsOpen, setBuildingInputsOpen] = useState(false);
  const [buildingOutputsOpen, setBuildingOutputsOpen] = useState(false);
  const [buildingWorkforceOpen, setBuildingWorkforceOpen] = useState(false);
  const [goodsOptions, setGoodsOptions] = useState<ContentEntry[]>([]);
  const [cultureOptions, setCultureOptions] = useState<ContentEntry[]>([]);
  const [resourceCategoryOptions, setResourceCategoryOptions] = useState<ContentEntry[]>([]);
  const [provinceTypeOptions, setProvinceTypeOptions] = useState<ContentEntry[]>([]);
  const [provinceClimateOptions, setProvinceClimateOptions] = useState<ContentEntry[]>([]);
  const [provinceLandscapeOptions, setProvinceLandscapeOptions] = useState<ContentEntry[]>([]);
  const [provinceContinentOptions, setProvinceContinentOptions] = useState<ContentEntry[]>([]);
  const [provinceStrategicRegionOptions, setProvinceStrategicRegionOptions] = useState<ContentEntry[]>([]);
  const [professionOptions, setProfessionOptions] = useState<ContentEntry[]>([]);
  const [industryOptions, setIndustryOptions] = useState<ContentEntry[]>([]);
  const [sectorOptions, setSectorOptions] = useState<ContentEntry[]>([]);
  const [ideologyOptions, setIdeologyOptions] = useState<ContentEntry[]>([]);
  const [interestGroupOptions, setInterestGroupOptions] = useState<ContentEntry[]>([]);
  const [religionOptions, setReligionOptions] = useState<ContentEntry[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<ContentEntry[]>([]);
  const [partyOptions, setPartyOptions] = useState<ContentEntry[]>([]);
  const [lawGroupOptions, setLawGroupOptions] = useState<ContentEntry[]>([]);
  const [lawOptions, setLawOptions] = useState<ContentEntry[]>([]);
  const [technologyOptions, setTechnologyOptions] = useState<ContentEntry[]>([]);
  const [countryOptions, setCountryOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [worldBuildingUsage, setWorldBuildingUsage] = useState<{
    globalByBuildingId: Record<string, number>;
    byCountryByBuildingId: Record<string, Record<string, number>>;
  }>({ globalByBuildingId: {}, byCountryByBuildingId: {} });
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const buildSnapshot = (entry: ContentEntry) =>
    JSON.stringify({
      id: entry.id,
      name: entry.name.trim(),
      description: (entry.description ?? "").trim(),
      color: entry.color,
      logoUrl: entry.logoUrl ?? null,
      malePortraitUrl: entry.malePortraitUrl ?? null,
      femalePortraitUrl: entry.femalePortraitUrl ?? null,
      basePrice: entry.basePrice ?? null,
      minPrice: entry.minPrice ?? null,
      maxPrice: entry.maxPrice ?? null,
      infraPerUnit: entry.infraPerUnit ?? null,
      infrastructureCostPerUnit: entry.infrastructureCostPerUnit ?? null,
      resourceCategoryId: entry.resourceCategoryId ?? null,
      isResourceDiscoverable: Boolean(entry.isResourceDiscoverable),
      explorationBaseWeight: entry.explorationBaseWeight ?? null,
      explorationSmallVeinChancePct: entry.explorationSmallVeinChancePct ?? null,
      explorationMediumVeinChancePct: entry.explorationMediumVeinChancePct ?? null,
      explorationLargeVeinChancePct: entry.explorationLargeVeinChancePct ?? null,
      explorationSmallVeinMin: entry.explorationSmallVeinMin ?? null,
      explorationSmallVeinMax: entry.explorationSmallVeinMax ?? null,
      explorationMediumVeinMin: entry.explorationMediumVeinMin ?? null,
      explorationMediumVeinMax: entry.explorationMediumVeinMax ?? null,
      explorationLargeVeinMin: entry.explorationLargeVeinMin ?? null,
      explorationLargeVeinMax: entry.explorationLargeVeinMax ?? null,
      baseWage: entry.baseWage ?? null,
      manpower: entry.manpower ?? null,
      attack: entry.attack ?? null,
      defense: entry.defense ?? null,
      breakthrough: entry.breakthrough ?? null,
      organization: entry.organization ?? null,
      hp: entry.hp ?? null,
      speed: entry.speed ?? null,
      supplyUse: entry.supplyUse ?? null,
      trainingCostDucats: entry.trainingCostDucats ?? null,
      trainingCostManpower: entry.trainingCostManpower ?? null,
      equipmentNeeds: (entry.equipmentNeeds ?? []).map((row) => ({ goodId: row.goodId, amount: Number(row.amount.toFixed(3)) })),
      ideologyWeights: entry.ideologyWeights ?? {},
      interestGroupWeights: entry.interestGroupWeights ?? {},
      professionWeights: entry.professionWeights ?? {},
      religionWeights: entry.religionWeights ?? {},
      buildingWeights: entry.buildingWeights ?? {},
      lawPreferences: entry.lawPreferences ?? {},
      ideologyAttractionRules: entry.ideologyAttractionRules ?? [],
      discipline: entry.discipline ?? null,
      basePoliticalStrength: entry.basePoliticalStrength ?? null,
      solMultiplier: entry.solMultiplier ?? null,
      radicalMultiplier: entry.radicalMultiplier ?? null,
      loyalistMultiplier: entry.loyalistMultiplier ?? null,
      defaultPartyId: entry.defaultPartyId ?? null,
      lawGroupId: entry.lawGroupId ?? null,
      defaultLawId: entry.defaultLawId ?? null,
      order: entry.order ?? null,
      enactmentDifficulty: entry.enactmentDifficulty ?? null,
      votingDurationTurns: entry.votingDurationTurns ?? null,
      parliamentPower: entry.parliamentPower ?? null,
      costScience: entry.costScience ?? null,
      prerequisiteTechnologyIds: normalizeCountryIdsDraft(entry.prerequisiteTechnologyIds ?? []),
      unlockBuildingIds: normalizeCountryIdsDraft(entry.unlockBuildingIds ?? []),
      unlockLawIds: normalizeCountryIdsDraft(entry.unlockLawIds ?? []),
      modifiers: entry.modifiers ?? [],
      decision: entry.decision ?? null,
      event: entry.event ?? null,
      needsProfile: entry.needsProfile ?? null,
      costConstruction: entry.costConstruction ?? null,
      costDucats: entry.costDucats ?? null,
      startingDucats: entry.startingDucats ?? null,
      maxLevel: entry.maxLevel ?? null,
      maxDurability: entry.maxDurability ?? null,
      upgradeCostDucats: entry.upgradeCostDucats ?? null,
      upgradeCostConstruction: entry.upgradeCostConstruction ?? null,
      industryId: entry.industryId ?? entry.sectorId ?? null,
      sectorId: entry.sectorId ?? entry.industryId ?? null,
      extractionGoodId: entry.extractionGoodId ?? null,
      extractionAmountPerTurn: entry.extractionAmountPerTurn ?? null,
      extractionRequiresDeposit:
        typeof entry.extractionRequiresDeposit === "boolean" ? entry.extractionRequiresDeposit : true,
      extractions: (entry.extractions ?? []).map((row) => ({
        goodId: row.goodId,
        amount: Number(row.amount.toFixed(3)),
        ...(row.requiresDeposit === false ? { requiresDeposit: false } : row.requiresDeposit === true ? { requiresDeposit: true } : {}),
        ...(typeof row.minLevel === "number" ? { minLevel: row.minLevel } : {}),
        ...(typeof row.maxLevel === "number" ? { maxLevel: row.maxLevel } : {}),
      })),
      inputs: (entry.inputs ?? []).map((row) => ({
        goodId: row.goodId,
        amount: Number(row.amount.toFixed(3)),
        ...(typeof row.minLevel === "number" ? { minLevel: row.minLevel } : {}),
        ...(typeof row.maxLevel === "number" ? { maxLevel: row.maxLevel } : {}),
      })),
      outputs: (entry.outputs ?? []).map((row) => ({
        goodId: row.goodId,
        amount: Number(row.amount.toFixed(3)),
        ...(row.affectedByFertility === true ? { affectedByFertility: true } : {}),
        ...(typeof row.minLevel === "number" ? { minLevel: row.minLevel } : {}),
        ...(typeof row.maxLevel === "number" ? { maxLevel: row.maxLevel } : {}),
      })),
      workforceRequirements: (entry.workforceRequirements ?? []).map((row) => ({
        professionId: row.professionId,
        workers: Math.floor(row.workers),
      })),
      allowedCountryIds: normalizeCountryIdsDraft(entry.allowedCountryIds ?? []),
      deniedCountryIds: normalizeCountryIdsDraft(entry.deniedCountryIds ?? []),
      allowedProvinceTypes: normalizeCountryIdsDraft(entry.allowedProvinceTypes ?? []),
      deniedProvinceTypes: normalizeCountryIdsDraft(entry.deniedProvinceTypes ?? []),
      allowedClimates: normalizeCountryIdsDraft(entry.allowedClimates ?? []),
      deniedClimates: normalizeCountryIdsDraft(entry.deniedClimates ?? []),
      allowedLandscapes: normalizeCountryIdsDraft(entry.allowedLandscapes ?? []),
      deniedLandscapes: normalizeCountryIdsDraft(entry.deniedLandscapes ?? []),
      allowedContinents: normalizeCountryIdsDraft(entry.allowedContinents ?? []),
      deniedContinents: normalizeCountryIdsDraft(entry.deniedContinents ?? []),
      allowedStrategicRegions: normalizeCountryIdsDraft(entry.allowedStrategicRegions ?? []),
      deniedStrategicRegions: normalizeCountryIdsDraft(entry.deniedStrategicRegions ?? []),
      minRadiation: entry.minRadiation ?? null,
      maxRadiation: entry.maxRadiation ?? null,
      pollutionProductivityMode: entry.pollutionProductivityMode ?? "penalty",
      countryBuildLimits: normalizeCountryBuildLimitsDraft(
        (entry.countryBuildLimits ?? []).map((row) => ({
          countryId: row.countryId,
          limit: row.limit == null ? "" : String(row.limit),
        })),
      ),
      globalBuildLimit:
        typeof entry.globalBuildLimit === "number" &&
        Number.isFinite(entry.globalBuildLimit) &&
        entry.globalBuildLimit > 0
          ? Math.max(1, Math.floor(entry.globalBuildLimit))
          : null,
    });
  const buildDraftSnapshot = () =>
    JSON.stringify({
      id: selectedEntry?.id ?? "",
      name: draftName.trim(),
      description: draftDescription.trim(),
      color: draftColor,
      logoUrl: draftLogoUrl,
      malePortraitUrl: draftMalePortraitUrl,
      femalePortraitUrl: draftFemalePortraitUrl,
      basePrice:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftBasePrice))
            ? Number(Number(draftBasePrice).toFixed(3))
            : null
          : null,
      minPrice:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftMinPrice))
            ? Number(Number(draftMinPrice).toFixed(3))
            : null
          : null,
      maxPrice:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftMaxPrice))
            ? Number(Number(draftMaxPrice).toFixed(3))
            : null
          : null,
      infraPerUnit:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftInfraPerUnit))
            ? Number(Math.max(0, Number(draftInfraPerUnit)).toFixed(3))
            : null
          : null,
      infrastructureCostPerUnit:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftInfraPerUnit))
            ? Number(Math.max(0.01, Number(draftInfraPerUnit)).toFixed(3))
            : null
          : null,
      distributionType: activeCategory === "goods" ? draftDistributionType : null,
      transportModes: activeCategory === "goods" ? [...draftTransportModes].sort() : [],
      resourceCategoryId: activeCategory === "goods" ? draftResourceCategoryId.trim() || null : null,
      isResourceDiscoverable: activeCategory === "goods" ? Boolean(draftIsResourceDiscoverable) : null,
      explorationBaseWeight:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftExplorationBaseWeight))
            ? Number(Math.max(0, Number(draftExplorationBaseWeight)).toFixed(3))
            : null
          : null,
      explorationSmallVeinChancePct:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftExplorationSmallChance))
            ? Number(Math.max(0, Number(draftExplorationSmallChance)).toFixed(3))
            : null
          : null,
      explorationMediumVeinChancePct:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftExplorationMediumChance))
            ? Number(Math.max(0, Number(draftExplorationMediumChance)).toFixed(3))
            : null
          : null,
      explorationLargeVeinChancePct:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftExplorationLargeChance))
            ? Number(Math.max(0, Number(draftExplorationLargeChance)).toFixed(3))
            : null
          : null,
      explorationSmallVeinMin:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftExplorationSmallMin))
            ? Number(Math.max(0, Number(draftExplorationSmallMin)).toFixed(3))
            : null
          : null,
      explorationSmallVeinMax:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftExplorationSmallMax))
            ? Number(Math.max(0, Number(draftExplorationSmallMax)).toFixed(3))
            : null
          : null,
      explorationMediumVeinMin:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftExplorationMediumMin))
            ? Number(Math.max(0, Number(draftExplorationMediumMin)).toFixed(3))
            : null
          : null,
      explorationMediumVeinMax:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftExplorationMediumMax))
            ? Number(Math.max(0, Number(draftExplorationMediumMax)).toFixed(3))
            : null
          : null,
      explorationLargeVeinMin:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftExplorationLargeMin))
            ? Number(Math.max(0, Number(draftExplorationLargeMin)).toFixed(3))
            : null
          : null,
      explorationLargeVeinMax:
        activeCategory === "goods"
          ? Number.isFinite(Number(draftExplorationLargeMax))
            ? Number(Math.max(0, Number(draftExplorationLargeMax)).toFixed(3))
            : null
          : null,
      baseWage:
        activeCategory === "professions"
          ? Number.isFinite(Number(draftBaseWage))
            ? Number(Number(draftBaseWage).toFixed(3))
            : null
          : null,
      manpower: isMilitaryContentCategory(activeCategory) && Number.isFinite(Number(draftBattalionManpower)) ? Math.max(0, Math.floor(Number(draftBattalionManpower))) : null,
      attack: isMilitaryContentCategory(activeCategory) && Number.isFinite(Number(draftBattalionAttack)) ? Number(Math.max(0, Number(draftBattalionAttack)).toFixed(3)) : null,
      defense: isMilitaryContentCategory(activeCategory) && Number.isFinite(Number(draftBattalionDefense)) ? Number(Math.max(0, Number(draftBattalionDefense)).toFixed(3)) : null,
      breakthrough: isMilitaryContentCategory(activeCategory) && Number.isFinite(Number(draftBattalionBreakthrough)) ? Number(Math.max(0, Number(draftBattalionBreakthrough)).toFixed(3)) : null,
      organization: isMilitaryContentCategory(activeCategory) && Number.isFinite(Number(draftBattalionOrganization)) ? Number(Math.max(1, Number(draftBattalionOrganization)).toFixed(3)) : null,
      hp: isMilitaryContentCategory(activeCategory) && Number.isFinite(Number(draftBattalionHp)) ? Number(Math.max(1, Number(draftBattalionHp)).toFixed(3)) : null,
      speed: isMilitaryContentCategory(activeCategory) && Number.isFinite(Number(draftBattalionSpeed)) ? Number(Math.max(0.1, Number(draftBattalionSpeed)).toFixed(3)) : null,
      supplyUse: isMilitaryContentCategory(activeCategory) && Number.isFinite(Number(draftBattalionSupplyUse)) ? Number(Math.max(0, Number(draftBattalionSupplyUse)).toFixed(3)) : null,
      trainingCostDucats: isMilitaryContentCategory(activeCategory) && Number.isFinite(Number(draftBattalionTrainingCostDucats)) ? Number(Math.max(0, Number(draftBattalionTrainingCostDucats)).toFixed(3)) : null,
      trainingCostManpower: isMilitaryContentCategory(activeCategory) && Number.isFinite(Number(draftBattalionTrainingCostManpower)) ? Number(Math.max(0, Number(draftBattalionTrainingCostManpower)).toFixed(3)) : null,
      equipmentNeeds: isMilitaryContentCategory(activeCategory) ? normalizeGoodFlowsDraft(draftBattalionEquipmentNeeds) : [],
      ideologyWeights: activeCategory === "parties" ? normalizeNumberRecordDraft(draftIdeologyWeights) : {},
      interestGroupWeights: activeCategory === "parties" ? normalizeNumberRecordDraft(draftInterestGroupWeights) : {},
      professionWeights: activeCategory === "interestGroups" ? normalizeNumberRecordDraft(draftProfessionWeights) : {},
      religionWeights: activeCategory === "interestGroups" ? normalizeNumberRecordDraft(draftReligionWeights) : {},
      buildingWeights: activeCategory === "interestGroups" ? normalizeNumberRecordDraft(draftBuildingWeights) : {},
      lawPreferences: activeCategory === "parties" || activeCategory === "laws" ? normalizeNumberRecordDraft(draftLawPreferences) : {},
      ideologyAttractionRules: activeCategory === "ideologies" ? normalizeIdeologyAttractionRulesDraft(draftIdeologyAttractionRules) : [],
      discipline:
        activeCategory === "parties"
          ? Number.isFinite(Number(draftDiscipline))
            ? Number(Math.min(1, Math.max(0, Number(draftDiscipline))).toFixed(3))
            : null
          : null,
      basePoliticalStrength:
        activeCategory === "interestGroups" && Number.isFinite(Number(draftBasePoliticalStrength))
          ? Number(Math.max(0, Number(draftBasePoliticalStrength)).toFixed(3))
          : null,
      solMultiplier:
        activeCategory === "interestGroups" && Number.isFinite(Number(draftSolMultiplier))
          ? Number(Math.max(-10, Number(draftSolMultiplier)).toFixed(3))
          : null,
      radicalMultiplier:
        activeCategory === "interestGroups" && Number.isFinite(Number(draftRadicalMultiplier))
          ? Number(Math.max(-10, Number(draftRadicalMultiplier)).toFixed(3))
          : null,
      loyalistMultiplier:
        activeCategory === "interestGroups" && Number.isFinite(Number(draftLoyalistMultiplier))
          ? Number(Math.max(-10, Number(draftLoyalistMultiplier)).toFixed(3))
          : null,
      defaultPartyId: activeCategory === "interestGroups" ? draftDefaultPartyId.trim() || null : null,
      lawGroupId: activeCategory === "laws" ? draftLawGroupId.trim() || null : null,
      defaultLawId: activeCategory === "lawGroups" ? draftDefaultLawId.trim() || null : null,
      order:
        activeCategory === "lawGroups"
          ? Number.isFinite(Number(draftOrder))
            ? Math.floor(Number(draftOrder))
            : null
          : null,
      enactmentDifficulty:
        activeCategory === "laws"
          ? Number.isFinite(Number(draftEnactmentDifficulty))
            ? Number(Math.max(0.1, Number(draftEnactmentDifficulty)).toFixed(3))
            : null
          : null,
      votingDurationTurns:
        activeCategory === "laws"
          ? Number.isFinite(Number(draftVotingDurationTurns))
            ? Math.max(1, Math.floor(Number(draftVotingDurationTurns)))
            : null
          : null,
      parliamentPower:
        activeCategory === "laws"
          ? normalizeParliamentPowerDraft(draftParliamentPowerDomain, draftParliamentPowerValue, draftParliamentPowerThreshold)
          : null,
      costScience:
        activeCategory === "technologies"
          ? Number.isFinite(Number(draftCostScience))
            ? Number(Math.max(0, Number(draftCostScience)).toFixed(3))
            : null
          : null,
      prerequisiteTechnologyIds:
        activeCategory === "technologies" ? normalizeCountryIdsDraft(draftPrerequisiteTechnologyIds) : [],
      unlockBuildingIds: activeCategory === "technologies" ? normalizeCountryIdsDraft(draftUnlockBuildingIds) : [],
      unlockLawIds: activeCategory === "technologies" ? normalizeCountryIdsDraft(draftUnlockLawIds) : [],
      modifiers: activeCategory === "modifiers" ? normalizeModifiersDraft(draftModifiers) : [],
      decision:
        activeCategory === "decisions"
          ? {
              category: draftDecisionCategory,
              visibilityConditions: normalizeDecisionConditionsDraft(draftDecisionVisibilityConditions),
              availabilityConditions: normalizeDecisionConditionsDraft(draftDecisionAvailabilityConditions),
              costs: normalizeDecisionCostsDraft(draftDecisionCosts),
              effects: normalizeDecisionEffectsDraft(draftDecisionEffects),
              cooldownTurns: Math.max(0, Math.floor(Number(draftDecisionCooldownTurns || "0"))),
              repeatable: draftDecisionRepeatable,
            }
          : null,
      event:
        activeCategory === "events"
          ? {
              category: draftEventCategory,
              priority: draftEventPriority,
              visibility: draftEventVisibility,
              triggerConditions: normalizeDecisionConditionsDraft(draftEventTriggerConditions),
              options: normalizeEventOptionsDraft(draftEventOptions),
              cooldownTurns: Math.max(0, Math.floor(Number(draftEventCooldownTurns || "0"))),
              repeatable: draftEventRepeatable,
              checkIntervalTurns: Math.max(1, Math.floor(Number(draftEventCheckIntervalTurns || "1"))),
              chancePct: Math.min(100, Math.max(0, Number(draftEventChancePct || "100"))),
              blocking: draftEventBlocking,
            }
          : null,
      needsProfile: activeCategory === "cultures" ? normalizeNeedsProfileDraft(draftNeedsProfile) : null,
      costConstruction:
        activeCategory === "buildings"
          ? Number.isFinite(Number(draftCostConstruction))
            ? Math.max(1, Math.floor(Number(draftCostConstruction)))
            : null
          : null,
      costDucats:
        activeCategory === "buildings"
          ? Number.isFinite(Number(draftCostDucats))
            ? Number(Math.max(0, Number(draftCostDucats)).toFixed(3))
            : null
          : null,
      startingDucats:
        activeCategory === "buildings"
          ? Number.isFinite(Number(draftStartingDucats))
            ? Number(Math.max(0, Number(draftStartingDucats)).toFixed(3))
            : null
          : null,
      maxLevel:
        activeCategory === "buildings"
          ? Number.isFinite(Number(draftMaxLevel))
            ? Math.max(1, Math.floor(Number(draftMaxLevel)))
            : null
          : null,
      maxDurability:
        activeCategory === "buildings"
          ? Number.isFinite(Number(draftMaxDurability))
            ? Number(Math.max(1, Number(draftMaxDurability)).toFixed(3))
            : null
          : null,
      upgradeCostDucats:
        activeCategory === "buildings"
          ? Number.isFinite(Number(draftUpgradeCostDucats))
            ? Number(Math.max(0, Number(draftUpgradeCostDucats)).toFixed(3))
            : null
          : null,
      upgradeCostConstruction:
        activeCategory === "buildings"
          ? Number.isFinite(Number(draftUpgradeCostConstruction))
            ? Math.max(1, Math.floor(Number(draftUpgradeCostConstruction)))
            : null
          : null,
      industryId: activeCategory === "buildings" ? draftIndustryId.trim() || null : null,
      sectorId: activeCategory === "buildings" ? draftSectorId.trim() || null : null,
      extractionGoodId: activeCategory === "buildings" ? null : null,
      extractionAmountPerTurn: activeCategory === "buildings" ? 0 : null,
      extractionRequiresDeposit: activeCategory === "buildings" ? true : null,
      extractions: activeCategory === "buildings" ? normalizeExtractionFlowsDraft(draftExtractions) : [],
      inputs: activeCategory === "buildings" ? normalizeGoodFlowsDraft(draftInputs) : [],
      outputs: activeCategory === "buildings" ? normalizeGoodFlowsDraft(draftOutputs) : [],
      workforceRequirements: activeCategory === "buildings" ? normalizeWorkforceDraft(draftWorkforceRequirements) : [],
      allowedCountryIds: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftAllowedCountryIds) : [],
      deniedCountryIds: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftDeniedCountryIds) : [],
      allowedProvinceTypes: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftAllowedProvinceTypes) : [],
      deniedProvinceTypes: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftDeniedProvinceTypes) : [],
      allowedClimates: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftAllowedClimates) : [],
      deniedClimates: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftDeniedClimates) : [],
      allowedLandscapes: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftAllowedLandscapes) : [],
      deniedLandscapes: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftDeniedLandscapes) : [],
      allowedContinents: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftAllowedContinents) : [],
      deniedContinents: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftDeniedContinents) : [],
      allowedStrategicRegions: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftAllowedStrategicRegions) : [],
      deniedStrategicRegions: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftDeniedStrategicRegions) : [],
      minRadiation: activeCategory === "buildings" ? optionalNumberDraft(draftMinRadiation) : null,
      maxRadiation: activeCategory === "buildings" ? optionalNumberDraft(draftMaxRadiation) : null,
      pollutionProductivityMode: activeCategory === "buildings" ? draftPollutionProductivityMode : "penalty",
      countryBuildLimits: activeCategory === "buildings" ? normalizeCountryBuildLimitsDraft(draftCountryBuildLimits) : [],
      globalBuildLimit:
        activeCategory === "buildings"
          ? draftGlobalBuildLimit.trim().length > 0 &&
            Number.isFinite(Number(draftGlobalBuildLimit)) &&
            Number(draftGlobalBuildLimit) > 0
            ? Math.max(1, Math.floor(Number(draftGlobalBuildLimit)))
            : null
          : null,
    });

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((c) => c.name.toLowerCase().includes(q));
  }, [entries, search]);

  const industryNameById = useMemo(
    () => new Map(industryOptions.map((industry) => [industry.id, industry.name] as const)),
    [industryOptions],
  );

  const buildingEntryGroups = useMemo(() => {
    const groups = new Map<string, { id: string; label: string; entries: ContentEntry[] }>();
    for (const entry of filteredEntries) {
      const rawIndustryId = getEntryIndustryId(entry);
      const key = industryNameById.has(rawIndustryId) ? rawIndustryId : OTHER_INDUSTRY_GROUP_ID;
      const label = key === OTHER_INDUSTRY_GROUP_ID ? "Другое" : (industryNameById.get(key) ?? "Другое");
      const group = groups.get(key) ?? { id: key, label, entries: [] };
      group.entries.push(entry);
      groups.set(key, group);
    }
    return [...groups.values()]
      .map((group) => ({
        ...group,
        entries: [...group.entries].sort((a, b) => a.name.localeCompare(b.name, "ru")),
      }))
      .sort((a, b) => {
        if (a.id === OTHER_INDUSTRY_GROUP_ID) return 1;
        if (b.id === OTHER_INDUSTRY_GROUP_ID) return -1;
        return a.label.localeCompare(b.label, "ru");
      });
  }, [filteredEntries, industryNameById]);

  const selectedEntry = useMemo(
    () => entries.find((c) => c.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );

  const allowedCountryIdsNormalized = useMemo(
    () => normalizeCountryIdsDraft(draftAllowedCountryIds),
    [draftAllowedCountryIds],
  );
  const deniedCountryIdsNormalized = useMemo(
    () => normalizeCountryIdsDraft(draftDeniedCountryIds),
    [draftDeniedCountryIds],
  );
  const conflictingCountryIds = useMemo(() => {
    const denySet = new Set(deniedCountryIdsNormalized);
    return allowedCountryIdsNormalized.filter((countryId) => denySet.has(countryId));
  }, [allowedCountryIdsNormalized, deniedCountryIdsNormalized]);
  const conflictingCountryNames = useMemo(
    () =>
      conflictingCountryIds.map(
        (countryId) => countryOptions.find((country) => country.id === countryId)?.name ?? countryId,
      ),
    [conflictingCountryIds, countryOptions],
  );
  const filteredAllowCountryOptions = useMemo(() => {
    const q = allowCountrySearch.trim().toLowerCase();
    if (!q) return countryOptions;
    return countryOptions.filter(
      (country) =>
        country.name.toLowerCase().includes(q) || country.id.toLowerCase().includes(q),
    );
  }, [countryOptions, allowCountrySearch]);
  const filteredDenyCountryOptions = useMemo(() => {
    const q = denyCountrySearch.trim().toLowerCase();
    if (!q) return countryOptions;
    return countryOptions.filter(
      (country) =>
        country.name.toLowerCase().includes(q) || country.id.toLowerCase().includes(q),
    );
  }, [countryOptions, denyCountrySearch]);
  const renderProvinceContentPicker = (
    label: string,
    options: ContentEntry[],
    selected: string[],
    setSelected: Dispatch<SetStateAction<string[]>>,
  ) => {
    const normalized = normalizeCountryIdsDraft(selected);
    const available = options
      .map((option) => option.name.trim())
      .filter((name) => name.length > 0 && !normalized.includes(name))
      .sort((a, b) => a.localeCompare(b, "ru"));
    return (
      <div>
        <div className="mb-1 text-xs text-white/60">{label}</div>
        <CustomSelect
          value=""
          onChange={(value) => {
            if (!value) return;
            setSelected((prev) => normalizeCountryIdsDraft([...prev, value]));
          }}
          options={[
            { value: "", label: available.length > 0 ? "Добавить значение" : "Нет доступных значений" },
            ...available.map((name) => ({ value: name, label: name })),
          ]}
          buttonClassName="h-[42px]"
        />
        <div className="mt-2 flex min-h-8 flex-wrap gap-1.5">
          {normalized.map((value) => (
            <button
              key={`${label}-${value}`}
              type="button"
              onClick={() => setSelected((prev) => prev.filter((item) => item !== value))}
              className="rounded-lg border border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] px-2 py-1 text-xs text-[var(--arc-color-text-muted)] transition hover:border-[var(--arc-color-danger-border)] hover:text-[var(--arc-color-danger-text)]"
            >
              {value} ×
            </button>
          ))}
          {normalized.length === 0 && <div className="text-xs text-white/35">Любое значение</div>}
        </div>
      </div>
    );
  };
  const selectedBuildingGlobalUsage = useMemo(() => {
    if (!selectedEntry) return 0;
    return Math.max(0, Math.floor(worldBuildingUsage.globalByBuildingId[selectedEntry.id] ?? 0));
  }, [selectedEntry, worldBuildingUsage.globalByBuildingId]);
  const selectedBuildingUsageByCountry = useMemo(() => {
    if (!selectedEntry) return {};
    return worldBuildingUsage.byCountryByBuildingId[selectedEntry.id] ?? {};
  }, [selectedEntry, worldBuildingUsage.byCountryByBuildingId]);
  const selectableTechnologyOptions = useMemo(
    () => technologyOptions.filter((option) => option.id !== selectedEntry?.id),
    [selectedEntry?.id, technologyOptions],
  );
  const nextPrerequisiteTechnologyId = useMemo(
    () => selectableTechnologyOptions.find((option) => !draftPrerequisiteTechnologyIds.includes(option.id))?.id ?? "",
    [draftPrerequisiteTechnologyIds, selectableTechnologyOptions],
  );
  const nextUnlockBuildingId = useMemo(
    () => buildingOptions.find((option) => !draftUnlockBuildingIds.includes(option.id))?.id ?? "",
    [buildingOptions, draftUnlockBuildingIds],
  );
  const nextUnlockLawId = useMemo(
    () => lawOptions.find((option) => !draftUnlockLawIds.includes(option.id))?.id ?? "",
    [draftUnlockLawIds, lawOptions],
  );

  const categoryMeta = CATEGORY_META[activeCategory];

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    adminFetchContentEntries(token, activeCategory)
      .then((items) => {
        if (cancelled) return;
        setEntries(items);
        setSelectedEntryId(items[0]?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) toast.error("Не удалось загрузить контент");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCategory, open, token]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      adminFetchContentEntries(token, "cultures"),
      adminFetchContentEntries(token, "goods"),
      adminFetchContentEntries(token, "resourceCategories"),
      adminFetchContentEntries(token, "provinceTypes"),
      adminFetchContentEntries(token, "provinceClimates"),
      adminFetchContentEntries(token, "provinceLandscapes"),
      adminFetchContentEntries(token, "provinceContinents"),
      adminFetchContentEntries(token, "provinceStrategicRegions"),
      adminFetchContentEntries(token, "professions"),
      adminFetchContentEntries(token, "industries"),
      adminFetchContentEntries(token, "sectors"),
      adminFetchContentEntries(token, "ideologies"),
      adminFetchContentEntries(token, "interestGroups"),
      adminFetchContentEntries(token, "parties"),
      adminFetchContentEntries(token, "lawGroups"),
      adminFetchContentEntries(token, "laws"),
      adminFetchContentEntries(token, "technologies"),
      adminFetchContentEntries(token, "religions"),
      adminFetchContentEntries(token, "buildings"),
      fetchCountries(),
    ])
      .then(([cultures, goods, resourceCategories, provinceTypes, provinceClimates, provinceLandscapes, provinceContinents, provinceStrategicRegions, professions, industries, sectors, ideologies, interestGroups, parties, lawGroups, laws, technologies, religions, buildings, countries]) => {
        if (cancelled) return;
        setCultureOptions(cultures);
        setGoodsOptions(goods);
        setResourceCategoryOptions(resourceCategories);
        setProvinceTypeOptions(provinceTypes);
        setProvinceClimateOptions(provinceClimates);
        setProvinceLandscapeOptions(provinceLandscapes);
        setProvinceContinentOptions(provinceContinents);
        setProvinceStrategicRegionOptions(provinceStrategicRegions);
        setProfessionOptions(professions);
        setIndustryOptions(industries);
        setSectorOptions(sectors);
        setIdeologyOptions(ideologies);
        setInterestGroupOptions(interestGroups);
        setPartyOptions(parties);
        setLawGroupOptions(lawGroups);
        setLawOptions(laws);
        setTechnologyOptions(technologies);
        setReligionOptions(religions);
        setBuildingOptions(buildings);
        setCountryOptions(countries.map((country) => ({ id: country.id, name: country.name })));
      })
      .catch(() => {
        if (cancelled) return;
        setCultureOptions([]);
        setGoodsOptions([]);
        setResourceCategoryOptions([]);
        setProvinceTypeOptions([]);
        setProvinceClimateOptions([]);
        setProvinceLandscapeOptions([]);
        setProvinceContinentOptions([]);
        setProvinceStrategicRegionOptions([]);
        setProfessionOptions([]);
        setIndustryOptions([]);
        setSectorOptions([]);
        setIdeologyOptions([]);
        setInterestGroupOptions([]);
        setPartyOptions([]);
        setLawGroupOptions([]);
        setLawOptions([]);
        setTechnologyOptions([]);
        setReligionOptions([]);
        setBuildingOptions([]);
        setCountryOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchWorldSnapshot(token)
      .then((snapshot) => {
        if (cancelled) return;
        const globalByBuildingId: Record<string, number> = {};
        const byCountryByBuildingId: Record<string, Record<string, number>> = {};

        const addUsage = (buildingId: string, countryId: string | null, amount: number) => {
          if (!buildingId || amount <= 0) return;
          globalByBuildingId[buildingId] = (globalByBuildingId[buildingId] ?? 0) + amount;
          if (!countryId) return;
          if (!byCountryByBuildingId[buildingId]) {
            byCountryByBuildingId[buildingId] = {};
          }
          byCountryByBuildingId[buildingId][countryId] =
            (byCountryByBuildingId[buildingId][countryId] ?? 0) + amount;
        };

        for (const [regionId, instances] of Object.entries(snapshot.worldBase.regionBuildingsByRegion ?? {})) {
          const ownerCountryId = snapshot.worldBase.regionOwner?.[regionId] ?? null;
          for (const instance of instances ?? []) {
            addUsage(instance.buildingId, ownerCountryId, 1);
          }
        }

        for (const [regionId, queue] of Object.entries(snapshot.worldBase.regionConstructionQueueByRegion ?? {})) {
          const ownerCountryId = snapshot.worldBase.regionOwner?.[regionId] ?? null;
          for (const project of queue ?? []) {
            if ((project.projectType ?? "build") !== "build") continue;
            addUsage(project.buildingId, ownerCountryId, 1);
          }
        }

        setWorldBuildingUsage({ globalByBuildingId, byCountryByBuildingId });
      })
      .catch(() => {
        if (cancelled) return;
        setWorldBuildingUsage({ globalByBuildingId: {}, byCountryByBuildingId: {} });
      });

    return () => {
      cancelled = true;
    };
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    if (!selectedEntryId && entries[0]) {
      setSelectedEntryId(entries[0].id);
    }
  }, [entries, open, selectedEntryId]);

  useEffect(() => {
    if (!selectedEntry) {
      setDraftName("");
      setDraftDescription("");
      setDraftColor("#4ade80");
      setDraftLogoUrl(null);
      setDraftMalePortraitUrl(null);
      setDraftFemalePortraitUrl(null);
      setDraftBasePrice("1");
      setDraftMinPrice("0.1");
      setDraftMaxPrice("10");
      setDraftInfraPerUnit("1");
      setDraftResourceCategoryId("");
      setDraftExplorationBaseWeight("1");
      setDraftExplorationSmallChance("60");
      setDraftExplorationMediumChance("30");
      setDraftExplorationLargeChance("10");
      setDraftExplorationSmallMin("10");
      setDraftExplorationSmallMax("100");
      setDraftExplorationMediumMin("100");
      setDraftExplorationMediumMax("500");
      setDraftExplorationLargeMin("500");
      setDraftExplorationLargeMax("2000");
      setDraftBaseWage("1");
      setDraftBattalionManpower("1000");
      setDraftBattalionAttack("6");
      setDraftBattalionDefense("6");
      setDraftBattalionBreakthrough("2");
      setDraftBattalionOrganization("8");
      setDraftBattalionHp("20");
      setDraftBattalionSpeed("1");
      setDraftBattalionSupplyUse("1");
      setDraftBattalionTrainingCostDucats("10");
      setDraftBattalionTrainingCostManpower("1000");
      setDraftBattalionEquipmentNeeds([]);
      setDraftCostConstruction("100");
      setDraftCostDucats("10");
      setDraftStartingDucats("0");
      setDraftMaxLevel("1");
      setDraftMaxDurability("100");
      setDraftUpgradeCostDucats("10");
      setDraftUpgradeCostConstruction("100");
      setDraftIndustryId("");
      setDraftSectorId("");
      setDraftExtractions([]);
      setDraftInputs([]);
      setDraftOutputs([]);
      setDraftWorkforceRequirements([]);
      setDraftNeedsProfile([]);
      setDraftAllowedCountryIds([]);
      setDraftDeniedCountryIds([]);
      setDraftAllowedProvinceTypes([]);
      setDraftDeniedProvinceTypes([]);
      setDraftAllowedClimates([]);
      setDraftDeniedClimates([]);
      setDraftAllowedLandscapes([]);
      setDraftDeniedLandscapes([]);
      setDraftAllowedContinents([]);
      setDraftDeniedContinents([]);
      setDraftAllowedStrategicRegions([]);
      setDraftDeniedStrategicRegions([]);
      setDraftMinRadiation("");
      setDraftMaxRadiation("");
      setDraftPollutionProductivityMode("penalty");
      setDraftCountryBuildLimits([]);
      setDraftGlobalBuildLimit("");
      setDraftIdeologyWeights([]);
      setDraftInterestGroupWeights([]);
      setDraftProfessionWeights([]);
      setDraftReligionWeights([]);
      setDraftBuildingWeights([]);
      setDraftLawPreferences([]);
      setDraftDiscipline("0.85");
      setDraftBasePoliticalStrength("1");
      setDraftSolMultiplier("0.03");
      setDraftRadicalMultiplier("0.5");
      setDraftLoyalistMultiplier("0.25");
      setDraftDefaultPartyId("");
      setDraftLawGroupId("");
      setDraftDefaultLawId("");
      setDraftOrder("0");
      setDraftEnactmentDifficulty("1");
      setDraftVotingDurationTurns("3");
      setDraftCostScience("100");
      setDraftPrerequisiteTechnologyIds([]);
      setDraftUnlockBuildingIds([]);
      setDraftUnlockLawIds([]);
      setDraftModifiers([]);
      setDraftDecisionCategory("politics");
      setDraftDecisionRepeatable(false);
      setDraftDecisionCooldownTurns("0");
      setDraftDecisionVisibilityConditions([]);
      setDraftDecisionAvailabilityConditions([]);
      setDraftDecisionCosts([]);
      setDraftDecisionEffects([]);
      setDraftEventCategory("politics");
      setDraftEventPriority("medium");
      setDraftEventVisibility("private");
      setDraftEventRepeatable(false);
      setDraftEventBlocking(false);
      setDraftEventCooldownTurns("0");
      setDraftEventCheckIntervalTurns("1");
      setDraftEventChancePct("100");
      setDraftEventTriggerConditions([]);
      setDraftEventOptions([]);
      setBuildingUpgradeOpen(false);
      setSavedSnapshot("");
      return;
    }
    setDraftName(selectedEntry.name);
    setDraftDescription(selectedEntry.description ?? "");
    setDraftColor(selectedEntry.color);
    setDraftLogoUrl(selectedEntry.logoUrl);
    setDraftMalePortraitUrl(selectedEntry.malePortraitUrl ?? null);
    setDraftFemalePortraitUrl(selectedEntry.femalePortraitUrl ?? null);
    setDraftBasePrice(
      typeof selectedEntry.basePrice === "number" && Number.isFinite(selectedEntry.basePrice)
        ? String(selectedEntry.basePrice)
        : "1",
    );
    setDraftMinPrice(
      typeof selectedEntry.minPrice === "number" && Number.isFinite(selectedEntry.minPrice)
        ? String(selectedEntry.minPrice)
        : "0.1",
    );
    setDraftMaxPrice(
      typeof selectedEntry.maxPrice === "number" && Number.isFinite(selectedEntry.maxPrice)
        ? String(selectedEntry.maxPrice)
        : "10",
    );
    setDraftInfraPerUnit(
      typeof selectedEntry.infrastructureCostPerUnit === "number" && Number.isFinite(selectedEntry.infrastructureCostPerUnit)
        ? String(selectedEntry.infrastructureCostPerUnit)
        : typeof selectedEntry.infraPerUnit === "number" && Number.isFinite(selectedEntry.infraPerUnit)
          ? String(selectedEntry.infraPerUnit)
        : "1",
    );
    setDraftDistributionType(
      typeof selectedEntry.distributionType === "string" && GOOD_DISTRIBUTION_OPTIONS.some((option) => option.value === selectedEntry.distributionType)
        ? selectedEntry.distributionType
        : "tradeable",
    );
    const nextTransportModes =
      Array.isArray(selectedEntry.transportModes) && selectedEntry.transportModes.length > 0
        ? selectedEntry.transportModes.filter((mode): mode is DraftGoodTransportMode => GOOD_TRANSPORT_OPTIONS.some((option) => option.value === mode))
        : [];
    setDraftTransportModes(nextTransportModes.length > 0 ? nextTransportModes : ["land", "sea", "air"]);
    setDraftResourceCategoryId(
      typeof selectedEntry.resourceCategoryId === "string" ? selectedEntry.resourceCategoryId : "",
    );
    setDraftIsResourceDiscoverable(Boolean(selectedEntry.isResourceDiscoverable));
    setDraftExplorationBaseWeight(
      typeof selectedEntry.explorationBaseWeight === "number" && Number.isFinite(selectedEntry.explorationBaseWeight)
        ? String(Math.max(0, selectedEntry.explorationBaseWeight))
        : "1",
    );
    setDraftExplorationSmallChance(
      typeof selectedEntry.explorationSmallVeinChancePct === "number" &&
        Number.isFinite(selectedEntry.explorationSmallVeinChancePct)
        ? String(Math.max(0, selectedEntry.explorationSmallVeinChancePct))
        : "60",
    );
    setDraftExplorationMediumChance(
      typeof selectedEntry.explorationMediumVeinChancePct === "number" &&
        Number.isFinite(selectedEntry.explorationMediumVeinChancePct)
        ? String(Math.max(0, selectedEntry.explorationMediumVeinChancePct))
        : "30",
    );
    setDraftExplorationLargeChance(
      typeof selectedEntry.explorationLargeVeinChancePct === "number" &&
        Number.isFinite(selectedEntry.explorationLargeVeinChancePct)
        ? String(Math.max(0, selectedEntry.explorationLargeVeinChancePct))
        : "10",
    );
    setDraftExplorationSmallMin(
      typeof selectedEntry.explorationSmallVeinMin === "number" && Number.isFinite(selectedEntry.explorationSmallVeinMin)
        ? String(Math.max(0, selectedEntry.explorationSmallVeinMin))
        : "10",
    );
    setDraftExplorationSmallMax(
      typeof selectedEntry.explorationSmallVeinMax === "number" && Number.isFinite(selectedEntry.explorationSmallVeinMax)
        ? String(Math.max(0, selectedEntry.explorationSmallVeinMax))
        : "100",
    );
    setDraftExplorationMediumMin(
      typeof selectedEntry.explorationMediumVeinMin === "number" &&
        Number.isFinite(selectedEntry.explorationMediumVeinMin)
        ? String(Math.max(0, selectedEntry.explorationMediumVeinMin))
        : "100",
    );
    setDraftExplorationMediumMax(
      typeof selectedEntry.explorationMediumVeinMax === "number" &&
        Number.isFinite(selectedEntry.explorationMediumVeinMax)
        ? String(Math.max(0, selectedEntry.explorationMediumVeinMax))
        : "500",
    );
    setDraftExplorationLargeMin(
      typeof selectedEntry.explorationLargeVeinMin === "number" && Number.isFinite(selectedEntry.explorationLargeVeinMin)
        ? String(Math.max(0, selectedEntry.explorationLargeVeinMin))
        : "500",
    );
    setDraftExplorationLargeMax(
      typeof selectedEntry.explorationLargeVeinMax === "number" && Number.isFinite(selectedEntry.explorationLargeVeinMax)
        ? String(Math.max(0, selectedEntry.explorationLargeVeinMax))
        : "2000",
    );
    setDraftBaseWage(
      typeof selectedEntry.baseWage === "number" && Number.isFinite(selectedEntry.baseWage)
        ? String(selectedEntry.baseWage)
        : "1",
    );
    setDraftBattalionManpower(
      typeof selectedEntry.manpower === "number" && Number.isFinite(selectedEntry.manpower) ? String(selectedEntry.manpower) : "1000",
    );
    setDraftBattalionAttack(
      typeof selectedEntry.attack === "number" && Number.isFinite(selectedEntry.attack) ? String(selectedEntry.attack) : "6",
    );
    setDraftBattalionDefense(
      typeof selectedEntry.defense === "number" && Number.isFinite(selectedEntry.defense) ? String(selectedEntry.defense) : "6",
    );
    setDraftBattalionBreakthrough(
      typeof selectedEntry.breakthrough === "number" && Number.isFinite(selectedEntry.breakthrough) ? String(selectedEntry.breakthrough) : "2",
    );
    setDraftBattalionOrganization(
      typeof selectedEntry.organization === "number" && Number.isFinite(selectedEntry.organization) ? String(selectedEntry.organization) : "8",
    );
    setDraftBattalionHp(
      typeof selectedEntry.hp === "number" && Number.isFinite(selectedEntry.hp) ? String(selectedEntry.hp) : "20",
    );
    setDraftBattalionSpeed(
      typeof selectedEntry.speed === "number" && Number.isFinite(selectedEntry.speed) ? String(selectedEntry.speed) : "1",
    );
    setDraftBattalionSupplyUse(
      typeof selectedEntry.supplyUse === "number" && Number.isFinite(selectedEntry.supplyUse) ? String(selectedEntry.supplyUse) : "1",
    );
    setDraftBattalionTrainingCostDucats(
      typeof selectedEntry.trainingCostDucats === "number" && Number.isFinite(selectedEntry.trainingCostDucats)
        ? String(selectedEntry.trainingCostDucats)
        : "10",
    );
    setDraftBattalionTrainingCostManpower(
      typeof selectedEntry.trainingCostManpower === "number" && Number.isFinite(selectedEntry.trainingCostManpower)
        ? String(selectedEntry.trainingCostManpower)
        : typeof selectedEntry.manpower === "number" && Number.isFinite(selectedEntry.manpower)
          ? String(selectedEntry.manpower)
          : "1000",
    );
    setDraftBattalionEquipmentNeeds(
      (selectedEntry.equipmentNeeds ?? []).map((row) => ({ goodId: row.goodId, amount: String(row.amount), minLevel: "", maxLevel: "" })),
    );
    setDraftCostConstruction(
      typeof selectedEntry.costConstruction === "number" && Number.isFinite(selectedEntry.costConstruction)
        ? String(Math.max(1, Math.floor(selectedEntry.costConstruction)))
        : "100",
    );
    setDraftCostDucats(
      typeof selectedEntry.costDucats === "number" && Number.isFinite(selectedEntry.costDucats)
        ? String(Math.max(0, selectedEntry.costDucats))
        : "10",
    );
    setDraftStartingDucats(
      typeof selectedEntry.startingDucats === "number" && Number.isFinite(selectedEntry.startingDucats)
        ? String(Math.max(0, selectedEntry.startingDucats))
        : "0",
    );
    setDraftMaxLevel(
      typeof selectedEntry.maxLevel === "number" && Number.isFinite(selectedEntry.maxLevel)
        ? String(Math.max(1, Math.floor(selectedEntry.maxLevel)))
        : "1",
    );
    setDraftMaxDurability(
      typeof selectedEntry.maxDurability === "number" && Number.isFinite(selectedEntry.maxDurability)
        ? String(Math.max(1, selectedEntry.maxDurability))
        : "100",
    );
    setDraftUpgradeCostDucats(
      typeof selectedEntry.upgradeCostDucats === "number" && Number.isFinite(selectedEntry.upgradeCostDucats)
        ? String(Math.max(0, selectedEntry.upgradeCostDucats))
        : "10",
    );
    setDraftUpgradeCostConstruction(
      typeof selectedEntry.upgradeCostConstruction === "number" && Number.isFinite(selectedEntry.upgradeCostConstruction)
        ? String(Math.max(1, Math.floor(selectedEntry.upgradeCostConstruction)))
        : "100",
    );
    setDraftSectorId(
      typeof selectedEntry.sectorId === "string" && selectedEntry.sectorId.trim().length > 0
        ? selectedEntry.sectorId.trim()
        : typeof selectedEntry.industryId === "string" && selectedEntry.industryId.trim().length > 0
          ? selectedEntry.industryId.trim()
        : "",
    );
    setDraftIndustryId(
      typeof selectedEntry.industryId === "string" && selectedEntry.industryId.trim().length > 0
        ? selectedEntry.industryId.trim()
        : typeof selectedEntry.sectorId === "string" && selectedEntry.sectorId.trim().length > 0
          ? selectedEntry.sectorId.trim()
          : "",
    );
    setDraftExtractionGoodId(
      typeof selectedEntry.extractionGoodId === "string" && selectedEntry.extractionGoodId.trim().length > 0
        ? selectedEntry.extractionGoodId.trim()
        : "",
    );
    setDraftExtractionAmountPerTurn(
      typeof selectedEntry.extractionAmountPerTurn === "number" && Number.isFinite(selectedEntry.extractionAmountPerTurn)
        ? String(Math.max(0, selectedEntry.extractionAmountPerTurn))
        : "0",
    );
    setDraftExtractionRequiresDeposit(
      typeof selectedEntry.extractionRequiresDeposit === "boolean" ? selectedEntry.extractionRequiresDeposit : true,
    );
    const authoredExtractions = selectedEntry.extractions ?? [];
    setDraftExtractions(
      authoredExtractions.length > 0
        ? authoredExtractions.map((row) => ({
            goodId: row.goodId,
            amount: String(row.amount),
            requiresDeposit: row.requiresDeposit !== false,
            minLevel: typeof row.minLevel === "number" ? String(row.minLevel) : "",
            maxLevel: typeof row.maxLevel === "number" ? String(row.maxLevel) : "",
          }))
        : typeof selectedEntry.extractionGoodId === "string" && selectedEntry.extractionGoodId.trim().length > 0
          ? [{
              goodId: selectedEntry.extractionGoodId.trim(),
              amount:
                typeof selectedEntry.extractionAmountPerTurn === "number" && Number.isFinite(selectedEntry.extractionAmountPerTurn)
                  ? String(Math.max(0, selectedEntry.extractionAmountPerTurn))
                  : "0",
              requiresDeposit: typeof selectedEntry.extractionRequiresDeposit === "boolean" ? selectedEntry.extractionRequiresDeposit : true,
              minLevel: "",
              maxLevel: "",
            }]
          : [],
    );
    setDraftInputs((selectedEntry.inputs ?? []).map((row) => ({
      goodId: row.goodId,
      amount: String(row.amount),
      minLevel: typeof row.minLevel === "number" ? String(row.minLevel) : "",
      maxLevel: typeof row.maxLevel === "number" ? String(row.maxLevel) : "",
    })));
    setDraftOutputs((selectedEntry.outputs ?? []).map((row) => ({
      goodId: row.goodId,
      amount: String(row.amount),
      affectedByFertility: row.affectedByFertility === true,
      minLevel: typeof row.minLevel === "number" ? String(row.minLevel) : "",
      maxLevel: typeof row.maxLevel === "number" ? String(row.maxLevel) : "",
    })));
    setDraftWorkforceRequirements(
      (selectedEntry.workforceRequirements ?? []).map((row) => ({
        professionId: row.professionId,
        workers: String(row.workers),
      })),
    );
    setDraftNeedsProfile(needsProfileToDraft(selectedEntry.needsProfile ?? null));
    setDraftAllowedCountryIds(normalizeCountryIdsDraft(selectedEntry.allowedCountryIds ?? []));
    setDraftDeniedCountryIds(normalizeCountryIdsDraft(selectedEntry.deniedCountryIds ?? []));
    setDraftAllowedProvinceTypes(normalizeCountryIdsDraft(selectedEntry.allowedProvinceTypes ?? []));
    setDraftDeniedProvinceTypes(normalizeCountryIdsDraft(selectedEntry.deniedProvinceTypes ?? []));
    setDraftAllowedClimates(normalizeCountryIdsDraft(selectedEntry.allowedClimates ?? []));
    setDraftDeniedClimates(normalizeCountryIdsDraft(selectedEntry.deniedClimates ?? []));
    setDraftAllowedLandscapes(normalizeCountryIdsDraft(selectedEntry.allowedLandscapes ?? []));
    setDraftDeniedLandscapes(normalizeCountryIdsDraft(selectedEntry.deniedLandscapes ?? []));
    setDraftAllowedContinents(normalizeCountryIdsDraft(selectedEntry.allowedContinents ?? []));
    setDraftDeniedContinents(normalizeCountryIdsDraft(selectedEntry.deniedContinents ?? []));
    setDraftAllowedStrategicRegions(normalizeCountryIdsDraft(selectedEntry.allowedStrategicRegions ?? []));
    setDraftDeniedStrategicRegions(normalizeCountryIdsDraft(selectedEntry.deniedStrategicRegions ?? []));
    setDraftMinRadiation(typeof selectedEntry.minRadiation === "number" ? String(selectedEntry.minRadiation) : "");
    setDraftMaxRadiation(typeof selectedEntry.maxRadiation === "number" ? String(selectedEntry.maxRadiation) : "");
    setDraftPollutionProductivityMode(
      selectedEntry.pollutionProductivityMode === "bonus" || selectedEntry.pollutionProductivityMode === "ignore"
        ? selectedEntry.pollutionProductivityMode
        : "penalty",
    );
    setDraftCountryBuildLimits(
      (selectedEntry.countryBuildLimits ?? []).map((row) => ({
        countryId: row.countryId,
        limit:
          typeof row.limit === "number" && Number.isFinite(row.limit) && row.limit > 0
            ? String(Math.max(1, Math.floor(row.limit)))
            : "",
      })),
    );
    setDraftGlobalBuildLimit(
      typeof selectedEntry.globalBuildLimit === "number" &&
        Number.isFinite(selectedEntry.globalBuildLimit) &&
        selectedEntry.globalBuildLimit > 0
        ? String(Math.max(1, Math.floor(selectedEntry.globalBuildLimit)))
        : "",
    );
    setDraftIdeologyWeights(numberRecordToDraft(selectedEntry.ideologyWeights));
    setDraftInterestGroupWeights(numberRecordToDraft(selectedEntry.interestGroupWeights));
    setDraftProfessionWeights(numberRecordToDraft(selectedEntry.professionWeights));
    setDraftReligionWeights(numberRecordToDraft(selectedEntry.religionWeights));
    setDraftBuildingWeights(numberRecordToDraft(selectedEntry.buildingWeights));
    setDraftLawPreferences(numberRecordToDraft(selectedEntry.lawPreferences));
    setDraftIdeologyAttractionRules(ideologyAttractionRulesToDraft(selectedEntry.ideologyAttractionRules));
    setDraftDiscipline(
      typeof selectedEntry.discipline === "number" && Number.isFinite(selectedEntry.discipline)
        ? String(Math.min(1, Math.max(0, selectedEntry.discipline)))
        : "0.85",
    );
    setDraftBasePoliticalStrength(
      typeof selectedEntry.basePoliticalStrength === "number" && Number.isFinite(selectedEntry.basePoliticalStrength)
        ? String(selectedEntry.basePoliticalStrength)
        : "1",
    );
    setDraftSolMultiplier(
      typeof selectedEntry.solMultiplier === "number" && Number.isFinite(selectedEntry.solMultiplier)
        ? String(selectedEntry.solMultiplier)
        : "0.03",
    );
    setDraftRadicalMultiplier(
      typeof selectedEntry.radicalMultiplier === "number" && Number.isFinite(selectedEntry.radicalMultiplier)
        ? String(selectedEntry.radicalMultiplier)
        : "0.5",
    );
    setDraftLoyalistMultiplier(
      typeof selectedEntry.loyalistMultiplier === "number" && Number.isFinite(selectedEntry.loyalistMultiplier)
        ? String(selectedEntry.loyalistMultiplier)
        : "0.25",
    );
    setDraftDefaultPartyId(typeof selectedEntry.defaultPartyId === "string" ? selectedEntry.defaultPartyId : "");
    setDraftLawGroupId(typeof selectedEntry.lawGroupId === "string" ? selectedEntry.lawGroupId : "");
    setDraftDefaultLawId(typeof selectedEntry.defaultLawId === "string" ? selectedEntry.defaultLawId : "");
    setDraftOrder(
      typeof selectedEntry.order === "number" && Number.isFinite(selectedEntry.order) ? String(Math.floor(selectedEntry.order)) : "0",
    );
    setDraftEnactmentDifficulty(
      typeof selectedEntry.enactmentDifficulty === "number" && Number.isFinite(selectedEntry.enactmentDifficulty)
        ? String(Math.max(0.1, selectedEntry.enactmentDifficulty))
        : "1",
    );
    setDraftVotingDurationTurns(
      typeof selectedEntry.votingDurationTurns === "number" && Number.isFinite(selectedEntry.votingDurationTurns)
        ? String(Math.max(1, Math.floor(selectedEntry.votingDurationTurns)))
        : "3",
    );
    const parliamentPower = selectedEntry.parliamentPower ?? null;
    setDraftParliamentPowerDomain(parliamentPower?.domain ?? "");
    setDraftParliamentPowerValue(parliamentPower?.value ?? "");
    setDraftParliamentPowerThreshold(
      parliamentPower?.domain === "diplomacy" && typeof parliamentPower.moneyTransferRatificationThreshold === "number"
        ? String(parliamentPower.moneyTransferRatificationThreshold)
        : "10000",
    );
    setDraftCostScience(
      typeof selectedEntry.costScience === "number" && Number.isFinite(selectedEntry.costScience)
        ? String(Math.max(0, selectedEntry.costScience))
        : "100",
    );
    setDraftPrerequisiteTechnologyIds(normalizeCountryIdsDraft(selectedEntry.prerequisiteTechnologyIds ?? []).filter((id) => id !== selectedEntry.id));
    setDraftUnlockBuildingIds(normalizeCountryIdsDraft(selectedEntry.unlockBuildingIds ?? []));
    setDraftUnlockLawIds(normalizeCountryIdsDraft(selectedEntry.unlockLawIds ?? []));
    setDraftModifiers(modifiersToDraft(selectedEntry.modifiers));
    setDraftDecisionCategory(selectedEntry.decision?.category ?? "politics");
    setDraftDecisionRepeatable(Boolean(selectedEntry.decision?.repeatable));
    setDraftDecisionCooldownTurns(String(selectedEntry.decision?.cooldownTurns ?? 0));
    setDraftDecisionVisibilityConditions((selectedEntry.decision?.visibilityConditions ?? []).map((row) => ({
      type: row.type,
      targetId: row.targetId ?? "",
      invert: Boolean(row.invert),
    })));
    setDraftDecisionAvailabilityConditions((selectedEntry.decision?.availabilityConditions ?? []).map((row) => ({
      type: row.type,
      targetId: row.targetId ?? "",
      invert: Boolean(row.invert),
    })));
    setDraftDecisionCosts(Object.entries(selectedEntry.decision?.costs ?? {}).map(([targetId, value]) => ({
      targetId,
      value: String(value ?? 0),
    })));
    setDraftDecisionEffects((selectedEntry.decision?.effects ?? []).filter((effect) => effect.type === "resource_delta").map((effect) => ({
      type: "resource_delta",
      resource: effect.resource,
      amount: String(effect.amount),
    })));
    setDraftEventCategory(selectedEntry.event?.category ?? "politics");
    setDraftEventPriority(selectedEntry.event?.priority ?? "medium");
    setDraftEventVisibility(selectedEntry.event?.visibility ?? "private");
    setDraftEventRepeatable(Boolean(selectedEntry.event?.repeatable));
    setDraftEventBlocking(Boolean(selectedEntry.event?.blocking));
    setDraftEventCooldownTurns(String(selectedEntry.event?.cooldownTurns ?? 0));
    setDraftEventCheckIntervalTurns(String(selectedEntry.event?.checkIntervalTurns ?? 1));
    setDraftEventChancePct(String(selectedEntry.event?.chancePct ?? 100));
    setDraftEventTriggerConditions((selectedEntry.event?.triggerConditions ?? []).map((row) => ({
      type: row.type,
      targetId: row.targetId ?? "",
      invert: Boolean(row.invert),
    })));
    setDraftEventOptions((selectedEntry.event?.options ?? []).map((option) => ({
      id: option.id,
      label: option.label,
      description: option.description ?? "",
      autoChancePct: String(option.autoChancePct ?? 0),
      buttonColor: option.buttonColor ?? "#15505b",
      effects: (option.effects ?? []).filter((effect) => effect.type === "resource_delta").map((effect) => ({
        type: "resource_delta",
        resource: effect.resource,
        amount: String(effect.amount),
      })),
    })));
    setCriteriaCountriesOpen(false);
    setCriteriaProvinceOpen(false);
    setCriteriaLimitsOpen(false);
    setGoodsEconomyOpen(false);
    setBuildingCostOpen(false);
    setBuildingUpgradeOpen(false);
    setBuildingExtractionOpen(false);
    setBuildingInputsOpen(false);
    setBuildingOutputsOpen(false);
    setBuildingWorkforceOpen(false);
    setAllowCountrySearch("");
    setDenyCountrySearch("");
    setSavedSnapshot(buildSnapshot(selectedEntry));
  }, [selectedEntry]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedEntry) return false;
    return buildDraftSnapshot() !== savedSnapshot;
  }, [
    activeCategory,
    draftBasePrice,
    draftMinPrice,
    draftMaxPrice,
    draftInfraPerUnit,
    draftResourceCategoryId,
    draftIsResourceDiscoverable,
    draftExplorationBaseWeight,
    draftExplorationSmallChance,
    draftExplorationMediumChance,
    draftExplorationLargeChance,
    draftExplorationSmallMin,
    draftExplorationSmallMax,
    draftExplorationMediumMin,
    draftExplorationMediumMax,
    draftExplorationLargeMin,
    draftExplorationLargeMax,
    draftBaseWage,
    draftBattalionManpower,
    draftBattalionAttack,
    draftBattalionDefense,
    draftBattalionBreakthrough,
    draftBattalionOrganization,
    draftBattalionHp,
    draftBattalionSpeed,
    draftBattalionSupplyUse,
    draftBattalionTrainingCostDucats,
    draftBattalionTrainingCostManpower,
    draftBattalionEquipmentNeeds,
    draftCostConstruction,
    draftCostDucats,
    draftStartingDucats,
    draftMaxLevel,
    draftMaxDurability,
    draftUpgradeCostDucats,
    draftUpgradeCostConstruction,
    draftIndustryId,
    draftSectorId,
    draftExtractionGoodId,
    draftExtractionAmountPerTurn,
    draftExtractionRequiresDeposit,
    draftExtractions,
    draftNeedsProfile,
    draftColor,
    draftDescription,
    draftFemalePortraitUrl,
    draftInputs,
    draftLogoUrl,
    draftMalePortraitUrl,
    draftName,
    draftOutputs,
    draftWorkforceRequirements,
    draftAllowedCountryIds,
    draftDeniedCountryIds,
    draftAllowedProvinceTypes,
    draftDeniedProvinceTypes,
    draftAllowedClimates,
    draftDeniedClimates,
    draftAllowedLandscapes,
    draftDeniedLandscapes,
    draftAllowedContinents,
    draftDeniedContinents,
    draftAllowedStrategicRegions,
    draftDeniedStrategicRegions,
    draftMinRadiation,
    draftMaxRadiation,
    draftPollutionProductivityMode,
    draftCountryBuildLimits,
    draftGlobalBuildLimit,
    draftIdeologyWeights,
    draftInterestGroupWeights,
    draftProfessionWeights,
    draftReligionWeights,
    draftBuildingWeights,
    draftLawPreferences,
    draftIdeologyAttractionRules,
    draftDiscipline,
    draftBasePoliticalStrength,
    draftSolMultiplier,
    draftRadicalMultiplier,
    draftLoyalistMultiplier,
    draftDefaultPartyId,
    draftLawGroupId,
    draftDefaultLawId,
    draftOrder,
    draftEnactmentDifficulty,
    draftVotingDurationTurns,
    draftParliamentPowerDomain,
    draftParliamentPowerValue,
    draftParliamentPowerThreshold,
    draftCostScience,
    draftPrerequisiteTechnologyIds,
    draftUnlockBuildingIds,
    draftUnlockLawIds,
    draftModifiers,
    draftDecisionCategory,
    draftDecisionRepeatable,
    draftDecisionCooldownTurns,
    draftDecisionVisibilityConditions,
    draftDecisionAvailabilityConditions,
    draftDecisionCosts,
    draftDecisionEffects,
    draftEventCategory,
    draftEventPriority,
    draftEventVisibility,
    draftEventRepeatable,
    draftEventBlocking,
    draftEventCooldownTurns,
    draftEventCheckIntervalTurns,
    draftEventChancePct,
    draftEventTriggerConditions,
    draftEventOptions,
    savedSnapshot,
    selectedEntry,
  ]);

  const requestClose = () => {
    if (saving) return;
    if (hasUnsavedChanges) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  };

  const createEntry = async () => {
    setSaving(true);
    try {
      const nextNameBase = categoryMeta.createBaseName;
      let name = nextNameBase;
      let i = 2;
      const used = new Set(entries.map((c) => c.name.trim().toLowerCase()));
      while (used.has(name.toLowerCase())) {
        name = `${nextNameBase} ${i++}`;
      }
      const result = await adminCreateContentEntry(token, activeCategory, {
        name,
        description: "",
        color: "#a78bfa",
        basePrice: activeCategory === "goods" ? 1 : undefined,
        minPrice: activeCategory === "goods" ? 0.1 : undefined,
        maxPrice: activeCategory === "goods" ? 10 : undefined,
        infraPerUnit: activeCategory === "goods" ? 1 : undefined,
        infrastructureCostPerUnit: activeCategory === "goods" ? 1 : undefined,
        distributionType: activeCategory === "goods" ? "tradeable" : undefined,
        transportModes: activeCategory === "goods" ? ["land", "sea", "air"] : undefined,
        resourceCategoryId: activeCategory === "goods" ? null : undefined,
        isResourceDiscoverable: activeCategory === "goods" ? false : undefined,
        explorationBaseWeight: activeCategory === "goods" ? 1 : undefined,
        explorationSmallVeinChancePct: activeCategory === "goods" ? 60 : undefined,
        explorationMediumVeinChancePct: activeCategory === "goods" ? 30 : undefined,
        explorationLargeVeinChancePct: activeCategory === "goods" ? 10 : undefined,
        explorationSmallVeinMin: activeCategory === "goods" ? 10 : undefined,
        explorationSmallVeinMax: activeCategory === "goods" ? 100 : undefined,
        explorationMediumVeinMin: activeCategory === "goods" ? 100 : undefined,
        explorationMediumVeinMax: activeCategory === "goods" ? 500 : undefined,
        explorationLargeVeinMin: activeCategory === "goods" ? 500 : undefined,
        explorationLargeVeinMax: activeCategory === "goods" ? 2000 : undefined,
        baseWage: activeCategory === "professions" ? 1 : undefined,
        manpower: isMilitaryContentCategory(activeCategory) ? 1000 : undefined,
        attack: isMilitaryContentCategory(activeCategory) ? 6 : undefined,
        defense: isMilitaryContentCategory(activeCategory) ? 6 : undefined,
        breakthrough: isMilitaryContentCategory(activeCategory) ? 2 : undefined,
        organization: isMilitaryContentCategory(activeCategory) ? 8 : undefined,
        hp: isMilitaryContentCategory(activeCategory) ? 20 : undefined,
        speed: isMilitaryContentCategory(activeCategory) ? 1 : undefined,
        supplyUse: isMilitaryContentCategory(activeCategory) ? 1 : undefined,
        trainingCostDucats: isMilitaryContentCategory(activeCategory) ? 10 : undefined,
        trainingCostManpower: isMilitaryContentCategory(activeCategory) ? 1000 : undefined,
        equipmentNeeds: isMilitaryContentCategory(activeCategory) ? [] : undefined,
        costConstruction: activeCategory === "buildings" ? 100 : undefined,
        costDucats: activeCategory === "buildings" ? 10 : undefined,
        startingDucats: activeCategory === "buildings" ? 0 : undefined,
        maxLevel: activeCategory === "buildings" ? 1 : undefined,
        maxDurability: activeCategory === "buildings" ? 100 : undefined,
        upgradeCostDucats: activeCategory === "buildings" ? 10 : undefined,
        upgradeCostConstruction: activeCategory === "buildings" ? 100 : undefined,
        extractionGoodId: activeCategory === "buildings" ? null : undefined,
        extractionAmountPerTurn: activeCategory === "buildings" ? 0 : undefined,
        extractionRequiresDeposit: activeCategory === "buildings" ? true : undefined,
        extractions: activeCategory === "buildings" ? [] : undefined,
        inputs: activeCategory === "buildings" ? [] : undefined,
        outputs: activeCategory === "buildings" ? [] : undefined,
        workforceRequirements: activeCategory === "buildings" ? [] : undefined,
        allowedCountryIds: activeCategory === "buildings" ? [] : undefined,
        deniedCountryIds: activeCategory === "buildings" ? [] : undefined,
        allowedProvinceTypes: activeCategory === "buildings" ? [] : undefined,
        deniedProvinceTypes: activeCategory === "buildings" ? [] : undefined,
        allowedClimates: activeCategory === "buildings" ? [] : undefined,
        deniedClimates: activeCategory === "buildings" ? [] : undefined,
        allowedLandscapes: activeCategory === "buildings" ? [] : undefined,
        deniedLandscapes: activeCategory === "buildings" ? [] : undefined,
        allowedContinents: activeCategory === "buildings" ? [] : undefined,
        deniedContinents: activeCategory === "buildings" ? [] : undefined,
        allowedStrategicRegions: activeCategory === "buildings" ? [] : undefined,
        deniedStrategicRegions: activeCategory === "buildings" ? [] : undefined,
        minRadiation: activeCategory === "buildings" ? null : undefined,
        maxRadiation: activeCategory === "buildings" ? null : undefined,
        pollutionProductivityMode: activeCategory === "buildings" ? "penalty" : undefined,
        countryBuildLimits: activeCategory === "buildings" ? [] : undefined,
        globalBuildLimit: activeCategory === "buildings" ? null : undefined,
        needsProfile: activeCategory === "cultures" ? null : undefined,
        ideologyWeights: activeCategory === "parties" ? {} : undefined,
        interestGroupWeights: activeCategory === "parties" ? {} : undefined,
        professionWeights: activeCategory === "interestGroups" ? {} : undefined,
        religionWeights: activeCategory === "interestGroups" ? {} : undefined,
        buildingWeights: activeCategory === "interestGroups" ? {} : undefined,
        lawPreferences: activeCategory === "parties" || activeCategory === "laws" ? {} : undefined,
        ideologyAttractionRules: activeCategory === "ideologies" ? [] : undefined,
        discipline: activeCategory === "parties" ? 0.85 : undefined,
        basePoliticalStrength: activeCategory === "interestGroups" ? 1 : undefined,
        solMultiplier: activeCategory === "interestGroups" ? 0.03 : undefined,
        radicalMultiplier: activeCategory === "interestGroups" ? 0.5 : undefined,
        loyalistMultiplier: activeCategory === "interestGroups" ? 0.25 : undefined,
        defaultPartyId: activeCategory === "interestGroups" ? null : undefined,
        lawGroupId: activeCategory === "laws" ? null : undefined,
        defaultLawId: activeCategory === "lawGroups" ? null : undefined,
        order: activeCategory === "lawGroups" ? 0 : undefined,
        enactmentDifficulty: activeCategory === "laws" ? 1 : undefined,
        votingDurationTurns: activeCategory === "laws" ? 3 : undefined,
        parliamentPower: activeCategory === "laws" ? null : undefined,
        costScience: activeCategory === "technologies" ? 100 : undefined,
        prerequisiteTechnologyIds: activeCategory === "technologies" ? [] : undefined,
        unlockBuildingIds: activeCategory === "technologies" ? [] : undefined,
        unlockLawIds: activeCategory === "technologies" ? [] : undefined,
        modifiers:
          activeCategory === "modifiers"
            ? [
                {
                  id: "main",
                  label: name,
                  scope: "country",
                  conditions: [{ type: "always", targetId: null, invert: false }],
                  effects: [{ stat: "science_gain", mode: "add_pct", value: 0.1, target: null }],
                },
              ]
            : undefined,
        decision:
          activeCategory === "decisions"
            ? {
                category: "politics",
                visibilityConditions: [],
                availabilityConditions: [{ type: "always", targetId: null, invert: false }],
                costs: {},
                effects: [{ type: "resource_delta", resource: "culture", amount: 10 }],
                cooldownTurns: 0,
                repeatable: false,
            }
            : undefined,
        event:
          activeCategory === "events"
            ? {
                category: "politics",
                priority: "medium",
                visibility: "private",
                triggerConditions: [{ type: "always", targetId: null, invert: false }],
                options: [{ id: "ok", label: "Понятно", description: null, autoChancePct: 100, buttonColor: "#15505b", effects: [] }],
                cooldownTurns: 0,
                repeatable: false,
                checkIntervalTurns: 1,
                chancePct: 100,
                blocking: false,
              }
            : undefined,
      });
      setEntries(result.items);
      setSelectedEntryId(result.item.id);
      if (activeCategory === "goods") {
        setGoodsOptions(result.items);
      }
      if (activeCategory === "resourceCategories") {
        setResourceCategoryOptions(result.items);
      }
      if (activeCategory === "professions") {
        setProfessionOptions(result.items);
      }
      if (activeCategory === "ideologies") {
        setIdeologyOptions(result.items);
      }
      if (activeCategory === "interestGroups") {
        setInterestGroupOptions(result.items);
      }
      if (activeCategory === "parties") {
        setPartyOptions(result.items);
      }
      if (activeCategory === "lawGroups") {
        setLawGroupOptions(result.items);
      }
      if (activeCategory === "laws") {
        setLawOptions(result.items);
      }
      if (activeCategory === "technologies") {
        setTechnologyOptions(result.items);
      }
      toast.success(`${categoryMeta.singular[0].toUpperCase()}${categoryMeta.singular.slice(1)} создана`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ADMIN_CREATE_CONTENT_ENTRY_FAILED";
      if (msg === "CONTENT_NAME_EXISTS") toast.error("Название уже используется");
      else toast.error("Не удалось создать запись");
    } finally {
      setSaving(false);
    }
  };

  const saveEntry = async () => {
    if (!selectedEntry) return;
    const name = draftName.trim();
    if (!name) {
      toast.error("Введите название");
      return;
    }
    if (entries.some((c) => c.id !== selectedEntry.id && c.name.trim().toLowerCase() === name.toLowerCase())) {
      toast.error("Название должно быть уникальным");
      return;
    }
    if (
      activeCategory === "buildings" &&
      (hasInvalidFlowLevelWindow(draftExtractions) ||
        hasInvalidFlowLevelWindow(draftInputs) ||
        hasInvalidFlowLevelWindow(draftOutputs))
    ) {
      toast.error(t("contentPanel.flow.invalidLevelWindow"));
      return;
    }
    const color = /^#[0-9A-Fa-f]{6}$/.test(draftColor) ? draftColor : "#4ade80";
    const parsedModifiers =
      activeCategory === "modifiers"
        ? normalizeModifiersDraft(draftModifiers)
        : undefined;
    const parsedDecision =
      activeCategory === "decisions"
        ? {
            category: draftDecisionCategory,
            visibilityConditions: normalizeDecisionConditionsDraft(draftDecisionVisibilityConditions),
            availabilityConditions: normalizeDecisionConditionsDraft(draftDecisionAvailabilityConditions),
            costs: normalizeDecisionCostsDraft(draftDecisionCosts),
            effects: normalizeDecisionEffectsDraft(draftDecisionEffects),
            cooldownTurns: Math.max(0, Math.floor(Number(draftDecisionCooldownTurns || "0"))),
            repeatable: draftDecisionRepeatable,
          }
        : undefined;
    const parsedEvent =
      activeCategory === "events"
        ? {
            category: draftEventCategory,
            priority: draftEventPriority,
            visibility: draftEventVisibility,
            triggerConditions: normalizeDecisionConditionsDraft(draftEventTriggerConditions),
            options: normalizeEventOptionsDraft(draftEventOptions),
            cooldownTurns: Math.max(0, Math.floor(Number(draftEventCooldownTurns || "0"))),
            repeatable: draftEventRepeatable,
            checkIntervalTurns: Math.max(1, Math.floor(Number(draftEventCheckIntervalTurns || "1"))),
            chancePct: Math.min(100, Math.max(0, Number(draftEventChancePct || "100"))),
            blocking: draftEventBlocking,
          }
        : undefined;
    const payload = {
      name,
      description: draftDescription.trim(),
      color,
      basePrice: activeCategory === "goods" ? Math.max(0, Number(draftBasePrice || "0")) : undefined,
      minPrice: activeCategory === "goods" ? Math.max(0, Number(draftMinPrice || "0")) : undefined,
      maxPrice: activeCategory === "goods" ? Math.max(0, Number(draftMaxPrice || "0")) : undefined,
      infraPerUnit: activeCategory === "goods" ? Math.max(0, Number(draftInfraPerUnit || "0")) : undefined,
      infrastructureCostPerUnit: activeCategory === "goods" ? Math.max(0.01, Number(draftInfraPerUnit || "0.01")) : undefined,
      distributionType: activeCategory === "goods" ? draftDistributionType : undefined,
      transportModes: activeCategory === "goods" ? draftTransportModes : undefined,
      resourceCategoryId: activeCategory === "goods" ? (draftResourceCategoryId.trim() || null) : undefined,
      isResourceDiscoverable: activeCategory === "goods" ? Boolean(draftIsResourceDiscoverable) : undefined,
      explorationBaseWeight: activeCategory === "goods" ? Math.max(0, Number(draftExplorationBaseWeight || "1")) : undefined,
      explorationSmallVeinChancePct:
        activeCategory === "goods" ? Math.max(0, Number(draftExplorationSmallChance || "0")) : undefined,
      explorationMediumVeinChancePct:
        activeCategory === "goods" ? Math.max(0, Number(draftExplorationMediumChance || "0")) : undefined,
      explorationLargeVeinChancePct:
        activeCategory === "goods" ? Math.max(0, Number(draftExplorationLargeChance || "0")) : undefined,
      explorationSmallVeinMin: activeCategory === "goods" ? Math.max(0, Number(draftExplorationSmallMin || "0")) : undefined,
      explorationSmallVeinMax: activeCategory === "goods" ? Math.max(0, Number(draftExplorationSmallMax || "0")) : undefined,
      explorationMediumVeinMin:
        activeCategory === "goods" ? Math.max(0, Number(draftExplorationMediumMin || "0")) : undefined,
      explorationMediumVeinMax:
        activeCategory === "goods" ? Math.max(0, Number(draftExplorationMediumMax || "0")) : undefined,
      explorationLargeVeinMin: activeCategory === "goods" ? Math.max(0, Number(draftExplorationLargeMin || "0")) : undefined,
      explorationLargeVeinMax: activeCategory === "goods" ? Math.max(0, Number(draftExplorationLargeMax || "0")) : undefined,
      baseWage: activeCategory === "professions" ? Math.max(0, Number(draftBaseWage || "0")) : undefined,
      manpower: isMilitaryContentCategory(activeCategory) ? Math.max(0, Math.floor(Number(draftBattalionManpower || "0"))) : undefined,
      attack: isMilitaryContentCategory(activeCategory) ? Math.max(0, Number(draftBattalionAttack || "0")) : undefined,
      defense: isMilitaryContentCategory(activeCategory) ? Math.max(0, Number(draftBattalionDefense || "0")) : undefined,
      breakthrough: isMilitaryContentCategory(activeCategory) ? Math.max(0, Number(draftBattalionBreakthrough || "0")) : undefined,
      organization: isMilitaryContentCategory(activeCategory) ? Math.max(1, Number(draftBattalionOrganization || "1")) : undefined,
      hp: isMilitaryContentCategory(activeCategory) ? Math.max(1, Number(draftBattalionHp || "1")) : undefined,
      speed: isMilitaryContentCategory(activeCategory) ? Math.max(0.1, Number(draftBattalionSpeed || "1")) : undefined,
      supplyUse: isMilitaryContentCategory(activeCategory) ? Math.max(0, Number(draftBattalionSupplyUse || "0")) : undefined,
      trainingCostDucats: isMilitaryContentCategory(activeCategory) ? Math.max(0, Number(draftBattalionTrainingCostDucats || "0")) : undefined,
      trainingCostManpower: isMilitaryContentCategory(activeCategory) ? Math.max(0, Number(draftBattalionTrainingCostManpower || "0")) : undefined,
      equipmentNeeds: isMilitaryContentCategory(activeCategory) ? normalizeGoodFlowsDraft(draftBattalionEquipmentNeeds) : undefined,
      ideologyWeights: activeCategory === "parties" ? normalizeNumberRecordDraft(draftIdeologyWeights) : undefined,
      interestGroupWeights: activeCategory === "parties" ? normalizeNumberRecordDraft(draftInterestGroupWeights) : undefined,
      professionWeights: activeCategory === "interestGroups" ? normalizeNumberRecordDraft(draftProfessionWeights) : undefined,
      religionWeights: activeCategory === "interestGroups" ? normalizeNumberRecordDraft(draftReligionWeights) : undefined,
      buildingWeights: activeCategory === "interestGroups" ? normalizeNumberRecordDraft(draftBuildingWeights) : undefined,
      lawPreferences:
        activeCategory === "parties" || activeCategory === "laws" || activeCategory === "interestGroups" ? normalizeNumberRecordDraft(draftLawPreferences) : undefined,
      ideologyAttractionRules: activeCategory === "ideologies" ? normalizeIdeologyAttractionRulesDraft(draftIdeologyAttractionRules) : undefined,
      discipline: activeCategory === "parties" ? Math.min(1, Math.max(0, Number(draftDiscipline || "0.85"))) : undefined,
      basePoliticalStrength: activeCategory === "interestGroups" ? Math.max(0, Number(draftBasePoliticalStrength || "1")) : undefined,
      solMultiplier: activeCategory === "interestGroups" ? Math.max(-10, Number(draftSolMultiplier || "0.03")) : undefined,
      radicalMultiplier: activeCategory === "interestGroups" ? Math.max(-10, Number(draftRadicalMultiplier || "0.5")) : undefined,
      loyalistMultiplier: activeCategory === "interestGroups" ? Math.max(-10, Number(draftLoyalistMultiplier || "0.25")) : undefined,
      defaultPartyId: activeCategory === "interestGroups" ? (draftDefaultPartyId.trim() || null) : undefined,
      lawGroupId: activeCategory === "laws" ? (draftLawGroupId.trim() || null) : undefined,
      defaultLawId: activeCategory === "lawGroups" ? (draftDefaultLawId.trim() || null) : undefined,
      order: activeCategory === "lawGroups" ? Math.floor(Number(draftOrder || "0")) : undefined,
      enactmentDifficulty:
        activeCategory === "laws" ? Number(Math.max(0.1, Number(draftEnactmentDifficulty || "1")).toFixed(3)) : undefined,
      votingDurationTurns:
        activeCategory === "laws" ? Math.max(1, Math.floor(Number(draftVotingDurationTurns || "3"))) : undefined,
      parliamentPower:
        activeCategory === "laws"
          ? normalizeParliamentPowerDraft(draftParliamentPowerDomain, draftParliamentPowerValue, draftParliamentPowerThreshold)
          : undefined,
      costScience: activeCategory === "technologies" ? Math.max(0, Number(draftCostScience || "0")) : undefined,
      prerequisiteTechnologyIds:
        activeCategory === "technologies"
          ? normalizeCountryIdsDraft(draftPrerequisiteTechnologyIds).filter((id) => id !== selectedEntry.id)
          : undefined,
      unlockBuildingIds: activeCategory === "technologies" ? normalizeCountryIdsDraft(draftUnlockBuildingIds) : undefined,
      unlockLawIds: activeCategory === "technologies" ? normalizeCountryIdsDraft(draftUnlockLawIds) : undefined,
      needsProfile: activeCategory === "cultures" ? normalizeNeedsProfileDraft(draftNeedsProfile) : undefined,
      costConstruction: activeCategory === "buildings" ? Math.max(1, Math.floor(Number(draftCostConstruction || "100"))) : undefined,
      costDucats: activeCategory === "buildings" ? Math.max(0, Number(draftCostDucats || "10")) : undefined,
      startingDucats: activeCategory === "buildings" ? Math.max(0, Number(draftStartingDucats || "0")) : undefined,
      maxLevel: activeCategory === "buildings" ? Math.max(1, Math.floor(Number(draftMaxLevel || "1"))) : undefined,
      maxDurability:
        activeCategory === "buildings" ? Number(Math.max(1, Number(draftMaxDurability || "100")).toFixed(3)) : undefined,
      upgradeCostDucats:
        activeCategory === "buildings" ? Math.max(0, Number(draftUpgradeCostDucats || "10")) : undefined,
      upgradeCostConstruction:
        activeCategory === "buildings" ? Math.max(1, Math.floor(Number(draftUpgradeCostConstruction || "100"))) : undefined,
      industryId: activeCategory === "buildings" ? (draftIndustryId.trim() || null) : undefined,
      sectorId: activeCategory === "buildings" ? (draftSectorId.trim() || null) : undefined,
      extractionGoodId: activeCategory === "buildings" ? null : undefined,
      extractionAmountPerTurn: activeCategory === "buildings" ? 0 : undefined,
      extractionRequiresDeposit: activeCategory === "buildings" ? true : undefined,
      extractions: activeCategory === "buildings" ? normalizeExtractionFlowsDraft(draftExtractions) : undefined,
      inputs: activeCategory === "buildings" ? normalizeGoodFlowsDraft(draftInputs) : undefined,
      outputs: activeCategory === "buildings" ? normalizeGoodFlowsDraft(draftOutputs) : undefined,
      workforceRequirements: activeCategory === "buildings" ? normalizeWorkforceDraft(draftWorkforceRequirements) : undefined,
      allowedCountryIds: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftAllowedCountryIds) : undefined,
      deniedCountryIds: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftDeniedCountryIds) : undefined,
      allowedProvinceTypes: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftAllowedProvinceTypes) : undefined,
      deniedProvinceTypes: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftDeniedProvinceTypes) : undefined,
      allowedClimates: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftAllowedClimates) : undefined,
      deniedClimates: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftDeniedClimates) : undefined,
      allowedLandscapes: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftAllowedLandscapes) : undefined,
      deniedLandscapes: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftDeniedLandscapes) : undefined,
      allowedContinents: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftAllowedContinents) : undefined,
      deniedContinents: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftDeniedContinents) : undefined,
      allowedStrategicRegions: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftAllowedStrategicRegions) : undefined,
      deniedStrategicRegions: activeCategory === "buildings" ? normalizeCountryIdsDraft(draftDeniedStrategicRegions) : undefined,
      minRadiation: activeCategory === "buildings" ? optionalNumberDraft(draftMinRadiation) : undefined,
      maxRadiation: activeCategory === "buildings" ? optionalNumberDraft(draftMaxRadiation) : undefined,
      pollutionProductivityMode: activeCategory === "buildings" ? draftPollutionProductivityMode : undefined,
      countryBuildLimits:
        activeCategory === "buildings" ? normalizeCountryBuildLimitsDraft(draftCountryBuildLimits) : undefined,
      globalBuildLimit:
        activeCategory === "buildings"
          ? draftGlobalBuildLimit.trim().length > 0 &&
            Number.isFinite(Number(draftGlobalBuildLimit)) &&
            Number(draftGlobalBuildLimit) > 0
            ? Math.max(1, Math.floor(Number(draftGlobalBuildLimit)))
            : null
          : undefined,
      modifiers: parsedModifiers,
      decision: parsedDecision,
      event: parsedEvent,
    };
    if (
      activeCategory === "goods" &&
      (!Number.isFinite(payload.basePrice ?? Number.NaN) ||
        !Number.isFinite(payload.minPrice ?? Number.NaN) ||
        !Number.isFinite(payload.maxPrice ?? Number.NaN) ||
        !Number.isFinite(payload.infraPerUnit ?? Number.NaN) ||
        !Number.isFinite(payload.infrastructureCostPerUnit ?? Number.NaN) ||
        !Number.isFinite(payload.explorationBaseWeight ?? Number.NaN) ||
        !Number.isFinite(payload.explorationSmallVeinChancePct ?? Number.NaN) ||
        !Number.isFinite(payload.explorationMediumVeinChancePct ?? Number.NaN) ||
        !Number.isFinite(payload.explorationLargeVeinChancePct ?? Number.NaN) ||
        !Number.isFinite(payload.explorationSmallVeinMin ?? Number.NaN) ||
        !Number.isFinite(payload.explorationSmallVeinMax ?? Number.NaN) ||
        !Number.isFinite(payload.explorationMediumVeinMin ?? Number.NaN) ||
        !Number.isFinite(payload.explorationMediumVeinMax ?? Number.NaN) ||
        !Number.isFinite(payload.explorationLargeVeinMin ?? Number.NaN) ||
        !Number.isFinite(payload.explorationLargeVeinMax ?? Number.NaN))
    ) {
      toast.error("Параметры экономики товара должны быть числами");
      return;
    }
    if (activeCategory === "goods" && (payload.maxPrice ?? 0) < (payload.minPrice ?? 0)) {
      toast.error("Максимальная цена не может быть меньше минимальной");
      return;
    }
    if (
      activeCategory === "goods" &&
      ((payload.explorationSmallVeinMax ?? 0) < (payload.explorationSmallVeinMin ?? 0) ||
        (payload.explorationMediumVeinMax ?? 0) < (payload.explorationMediumVeinMin ?? 0) ||
        (payload.explorationLargeVeinMax ?? 0) < (payload.explorationLargeVeinMin ?? 0))
    ) {
      toast.error("Макс. количество жилы не может быть меньше мин. значения");
      return;
    }
    if (activeCategory === "professions" && !Number.isFinite(payload.baseWage ?? Number.NaN)) {
      toast.error("Базовая зарплата должна быть числом");
      return;
    }
    if (activeCategory === "ideologies") {
      const badRule = draftIdeologyAttractionRules.some((row) => {
        const weight = Number(row.weight);
        const threshold = Number(row.threshold);
        const needsThreshold = ["sol_below", "sol_above", "radicals_above", "loyalists_above"].includes(row.type);
        const needsTarget = !needsThreshold;
        return !Number.isFinite(weight) || weight <= 0 || (needsThreshold && !Number.isFinite(threshold)) || (needsTarget && !row.targetId.trim());
      });
      if (badRule) {
        toast.error("Проверьте правила влияния идеологии");
        return;
      }
    }
    if (activeCategory === "parties") {
      const badWeight = [...draftIdeologyWeights, ...draftInterestGroupWeights, ...draftLawPreferences].some((row) => row.targetId.trim() && !Number.isFinite(Number(row.value)));
      if (badWeight) {
        toast.error("Политические веса должны быть числами");
        return;
      }
      if (!Number.isFinite(payload.discipline ?? Number.NaN)) {
        toast.error("Дисциплина партии должна быть числом от 0 до 1");
        return;
      }
    }
    if (activeCategory === "interestGroups") {
      const badWeight = [...draftProfessionWeights, ...draftReligionWeights, ...draftBuildingWeights, ...draftLawPreferences].some((row) => row.targetId.trim() && !Number.isFinite(Number(row.value)));
      if (
        badWeight ||
        !Number.isFinite(payload.basePoliticalStrength ?? Number.NaN) ||
        !Number.isFinite(payload.solMultiplier ?? Number.NaN) ||
        !Number.isFinite(payload.radicalMultiplier ?? Number.NaN) ||
        !Number.isFinite(payload.loyalistMultiplier ?? Number.NaN)
      ) {
        toast.error("Параметры группы интересов должны быть числами");
        return;
      }
    }
    if (activeCategory === "lawGroups" && !Number.isFinite(payload.order ?? Number.NaN)) {
      toast.error("Порядок группы законов должен быть числом");
      return;
    }
    if (activeCategory === "laws") {
      const badPreference = draftLawPreferences.some((row) => row.targetId.trim() && !Number.isFinite(Number(row.value)));
      if (badPreference) {
        toast.error("Предпочтения партий должны быть числами");
        return;
      }
      if (!payload.lawGroupId) {
        toast.error("Укажите группу закона");
        return;
      }
      if (!Number.isFinite(payload.enactmentDifficulty ?? Number.NaN) || !Number.isFinite(payload.votingDurationTurns ?? Number.NaN)) {
        toast.error("Сложность и длительность голосования должны быть числами");
        return;
      }
    }
    if (activeCategory === "technologies" && !Number.isFinite(payload.costScience ?? Number.NaN)) {
      toast.error("Стоимость исследования должна быть числом");
      return;
    }
    if (
      activeCategory === "buildings" &&
      (!Number.isFinite(payload.costConstruction ?? Number.NaN) ||
        !Number.isFinite(payload.costDucats ?? Number.NaN) ||
        !Number.isFinite(payload.startingDucats ?? Number.NaN) ||
        !Number.isFinite(payload.maxLevel ?? Number.NaN) ||
        !Number.isFinite(payload.maxDurability ?? Number.NaN) ||
        !Number.isFinite(payload.upgradeCostDucats ?? Number.NaN) ||
        !Number.isFinite(payload.upgradeCostConstruction ?? Number.NaN) ||
        !Number.isFinite(payload.extractionAmountPerTurn ?? Number.NaN))
    ) {
      toast.error("Параметры строительства должны быть числами");
      return;
    }
    setSaving(true);
    try {
      const result = await adminUpdateContentEntry(token, activeCategory, selectedEntry.id, payload);
      setEntries(result.items);
      setSavedSnapshot(buildSnapshot(result.item));
      if (activeCategory === "goods") {
        setGoodsOptions(result.items);
      }
      if (activeCategory === "resourceCategories") {
        setResourceCategoryOptions(result.items);
      }
      if (activeCategory === "professions") {
        setProfessionOptions(result.items);
      }
      if (activeCategory === "ideologies") {
        setIdeologyOptions(result.items);
      }
      if (activeCategory === "interestGroups") {
        setInterestGroupOptions(result.items);
      }
      if (activeCategory === "parties") {
        setPartyOptions(result.items);
      }
      if (activeCategory === "lawGroups") {
        setLawGroupOptions(result.items);
      }
      if (activeCategory === "laws") {
        setLawOptions(result.items);
      }
      if (activeCategory === "technologies") {
        setTechnologyOptions(result.items);
      }
      toast.success("Изменения сохранены");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ADMIN_UPDATE_CONTENT_ENTRY_FAILED";
      if (msg === "CONTENT_NAME_EXISTS") toast.error("Название уже используется");
      else toast.error("Не удалось сохранить запись");
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async () => {
    if (!selectedEntry) return;
    setSaving(true);
    try {
      const result = await adminDeleteContentEntry(token, activeCategory, selectedEntry.id);
      setEntries(result.items);
      setSelectedEntryId(result.items[0]?.id ?? "");
      if (activeCategory === "goods") {
        setGoodsOptions(result.items);
      }
      if (activeCategory === "resourceCategories") {
        setResourceCategoryOptions(result.items);
      }
      if (activeCategory === "professions") {
        setProfessionOptions(result.items);
      }
      if (activeCategory === "ideologies") {
        setIdeologyOptions(result.items);
      }
      if (activeCategory === "interestGroups") {
        setInterestGroupOptions(result.items);
      }
      if (activeCategory === "parties") {
        setPartyOptions(result.items);
      }
      if (activeCategory === "lawGroups") {
        setLawGroupOptions(result.items);
      }
      if (activeCategory === "laws") {
        setLawOptions(result.items);
      }
      if (activeCategory === "technologies") {
        setTechnologyOptions(result.items);
      }
      setDeleteConfirmOpen(false);
      toast.success("Запись удалена");
    } catch {
      toast.error("Не удалось удалить запись");
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File | null) => {
    if (!file || !selectedEntry) return;
    try {
      await validateContentImage(file, activeCategory);
      setSaving(true);
      const result = await adminUploadContentEntryLogo(token, activeCategory, selectedEntry.id, file);
      setEntries(result.items);
      setDraftLogoUrl(result.item.logoUrl);
      setSavedSnapshot(buildSnapshot(result.item));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "LOGO_INVALID";
      if (msg === "LOGO_TOO_LARGE") {
        toast.error(activeCategory === "events" || activeCategory === "decisions" ? "Изображение должно быть максимум 1080x970" : "Логотип должен быть максимум 64x64");
      }
      else if (msg === "IMAGE_DIMENSIONS_TOO_LARGE") {
        toast.error(activeCategory === "events" || activeCategory === "decisions" ? "Изображение должно быть максимум 1080x970" : "Логотип должен быть максимум 64x64");
      }
      else toast.error("Не удалось загрузить логотип");
    } finally {
      setSaving(false);
    }
  };

  const uploadRacePortraitSlot = async (slot: "male" | "female", file: File | null) => {
    if (!file || !selectedEntry || activeCategory !== "races") return;
    try {
      await validateRacePortrait(file);
      setSaving(true);
      const result = await adminUploadRacePortrait(token, selectedEntry.id, slot, file);
      setEntries(result.items);
      setSavedSnapshot(buildSnapshot(result.item));
      setDraftMalePortraitUrl(result.item.malePortraitUrl ?? null);
      setDraftFemalePortraitUrl(result.item.femalePortraitUrl ?? null);
      toast.success(`Портрет (${slot === "male" ? "мужской" : "женский"}) загружен`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "RACE_PORTRAIT_INVALID";
      if (msg === "RACE_PORTRAIT_TOO_LARGE" || msg === "IMAGE_DIMENSIONS_TOO_LARGE") {
        toast.error("Портрет должен быть максимум 89x100");
      } else {
        toast.error("Не удалось загрузить портрет");
      }
    } finally {
      setSaving(false);
    }
  };

  const renderNumberRecordEditor = (
    title: string,
    rows: NumberRecordDraft[],
    setRows: (updater: (prev: NumberRecordDraft[]) => NumberRecordDraft[]) => void,
    options: ContentEntry[],
    emptyText: string,
    targetLabel: string,
    defaultValue = "1",
  ) => (
    <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</span>
        <button
          type="button"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { targetId: options.find((option) => !prev.some((row) => row.targetId === option.id))?.id ?? "", value: defaultValue },
            ])
          }
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
        >
          <Plus size={12} />
          Добавить
        </button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">{emptyText}</div>
        ) : (
          rows.map((row, index) => (
            <div key={`${row.targetId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_34px]">
              <CustomSelect
                value={row.targetId}
                onChange={(value) => setRows((prev) => prev.map((item, i) => (i === index ? { ...item, targetId: value } : item)))}
                options={[{ value: "", label: targetLabel }, ...options.map((option) => ({ value: option.id, label: option.name }))]}
                buttonClassName="h-[38px]"
              />
              <AppInput
                value={row.value}
                onChange={(e) => setRows((prev) => prev.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))}
                inputMode="decimal"
              />
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const getOptionLabel = (options: Array<{ id: string; name: string }>, id: string, fallback: string) =>
    options.find((option) => option.id === id)?.name ?? fallback;

  const getModifierValueLabel = (mode: ModifierMode, rawValue: string) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return "некорректное значение";
    if (mode === "add_pct") return `${value >= 0 ? "+" : ""}${Number((value * 100).toFixed(2))}%`;
    if (mode === "mult") return `x${Number(value.toFixed(3))}`;
    return `${value >= 0 ? "+" : ""}${Number(value.toFixed(3))}`;
  };

  const getModifierEffectSummary = (effect: ModifierEffectDraft) => {
    const statLabel = MODIFIER_STAT_OPTIONS.find((option) => option.value === effect.stat)?.label ?? effect.stat;
    const modeLabel = getModifierValueLabel(effect.mode, effect.value);
    const targets = [
      effect.buildingId ? getOptionLabel(buildingOptions, effect.buildingId, effect.buildingId) : null,
      effect.goodId ? getOptionLabel(goodsOptions, effect.goodId, effect.goodId) : null,
      effect.professionId ? getOptionLabel(professionOptions, effect.professionId, effect.professionId) : null,
      effect.resourceCategoryId ? getOptionLabel(resourceCategoryOptions, effect.resourceCategoryId, effect.resourceCategoryId) : null,
    ].filter(Boolean);
    return `${statLabel}: ${modeLabel}${targets.length > 0 ? ` (${targets.join(", ")})` : ""}`;
  };

  const getModifierConditionTargetOptions = (type: ModifierConditionType) => {
    if (type === "law_active") return [{ value: "", label: "Выберите закон" }, ...lawOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "technology_researched") return [{ value: "", label: "Выберите технологию" }, ...technologyOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "country_is") return [{ value: "", label: "Выберите страну" }, ...countryOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "has_building") return [{ value: "", label: "Выберите здание" }, ...buildingOptions.map((option) => ({ value: option.id, label: option.name }))];
    return [{ value: "", label: "Не требуется" }];
  };

  const getIdeologyAttractionTargetOptions = (type: IdeologyAttractionConditionType) => {
    if (type === "profession_is") return [{ value: "", label: "Выберите профессию" }, ...professionOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "religion_is") return [{ value: "", label: "Выберите религию" }, ...religionOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "culture_is") return [{ value: "", label: "Выберите культуру" }, ...cultureOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "law_active") return [{ value: "", label: "Выберите закон" }, ...lawOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "has_building") return [{ value: "", label: "Выберите здание" }, ...buildingOptions.map((option) => ({ value: option.id, label: option.name }))];
    return [{ value: "", label: "Не требуется" }];
  };

  const ideologyRuleNeedsThreshold = (type: IdeologyAttractionConditionType) =>
    ["sol_below", "sol_above", "radicals_above", "loyalists_above"].includes(type);
  const ideologyRuleNeedsTargetSelect = (type: IdeologyAttractionConditionType) =>
    ["profession_is", "religion_is", "culture_is", "law_active", "has_building"].includes(type);
  const ideologyRuleNeedsTargetInput = (type: IdeologyAttractionConditionType) =>
    type === "country_modifier_active" || type === "province_modifier_active";

  const renderIdeologyAttractionRulesEditor = () => (
    <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Правила влияния</div>
          <div className="mt-1 text-xs text-white/45">Правила создают притяжение к этой идеологии. Население меняет доли плавно каждый ход.</div>
        </div>
        <button
          type="button"
          onClick={() =>
            setDraftIdeologyAttractionRules((prev) => [
              ...prev,
              { id: `rule-${prev.length + 1}`, type: "sol_below", targetId: "", threshold: "8", weight: "20", label: "", invert: false },
            ])
          }
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
        >
          <Plus size={12} />
          Добавить
        </button>
      </div>
      {draftIdeologyAttractionRules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">
          Правила не заданы, идеология не будет расти автоматически.
        </div>
      ) : (
        <div className="space-y-3">
          {draftIdeologyAttractionRules.map((rule, index) => {
            const option = IDEOLOGY_ATTRACTION_RULE_OPTIONS.find((item) => item.value === rule.type);
            return (
              <div key={`${rule.id}-${index}`} className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                <div className="grid gap-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_110px_110px_34px]">
                  <CustomSelect
                    value={rule.type}
                    onChange={(value) =>
                      setDraftIdeologyAttractionRules((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                type: value as IdeologyAttractionConditionType,
                                targetId: "",
                                threshold: ideologyRuleNeedsThreshold(value as IdeologyAttractionConditionType) ? item.threshold || "10" : "",
                              }
                            : item,
                        ),
                      )
                    }
                    options={IDEOLOGY_ATTRACTION_RULE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                    buttonClassName="h-[38px]"
                  />
                  {ideologyRuleNeedsTargetSelect(rule.type) ? (
                    <CustomSelect
                      value={rule.targetId}
                      onChange={(value) => setDraftIdeologyAttractionRules((prev) => prev.map((item, i) => (i === index ? { ...item, targetId: value } : item)))}
                      options={getIdeologyAttractionTargetOptions(rule.type)}
                      buttonClassName="h-[38px]"
                    />
                  ) : ideologyRuleNeedsTargetInput(rule.type) ? (
                    <AppInput
                      value={rule.targetId}
                      onChange={(e) => setDraftIdeologyAttractionRules((prev) => prev.map((item, i) => (i === index ? { ...item, targetId: e.target.value } : item)))}
                      placeholder="ID модификатора"
                      className="h-[38px]"
                    />
                  ) : (
                    <div className="flex h-[38px] items-center rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white/35">
                      {option?.target ?? "Не требуется"}
                    </div>
                  )}
                  <AppInput
                    value={rule.threshold}
                    disabled={!ideologyRuleNeedsThreshold(rule.type)}
                    onChange={(e) => setDraftIdeologyAttractionRules((prev) => prev.map((item, i) => (i === index ? { ...item, threshold: e.target.value } : item)))}
                    placeholder={option?.threshold ?? "Порог"}
                    inputMode="decimal"
                    className="h-[38px]"
                  />
                  <AppInput
                    value={rule.weight}
                    onChange={(e) => setDraftIdeologyAttractionRules((prev) => prev.map((item, i) => (i === index ? { ...item, weight: e.target.value } : item)))}
                    placeholder="Сила"
                    inputMode="decimal"
                    className="h-[38px]"
                  />
                  <button
                    type="button"
                    onClick={() => setDraftIdeologyAttractionRules((prev) => prev.filter((_, i) => i !== index))}
                    className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_140px]">
                  <AppInput
                    value={rule.label}
                    onChange={(e) => setDraftIdeologyAttractionRules((prev) => prev.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)))}
                    placeholder="Короткое описание правила"
                    className="h-[36px] bg-black/25 text-xs"
                  />
                  <label className="flex h-[36px] items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={rule.invert}
                      onChange={(e) => setDraftIdeologyAttractionRules((prev) => prev.map((item, i) => (i === index ? { ...item, invert: e.target.checked } : item)))}
                    />
                    Инвертировать
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const getModifierConditionSummary = (condition: ModifierConditionDraft) => {
    const typeLabel = MODIFIER_CONDITION_OPTIONS.find((option) => option.value === condition.type)?.label ?? condition.type;
    if (condition.type === "always") return condition.invert ? "Никогда" : "Всегда";
    const targetLabel = getModifierConditionTargetOptions(condition.type).find((option) => option.value === condition.targetId)?.label ?? condition.targetId;
    return `${condition.invert ? "НЕ " : ""}${typeLabel}: ${targetLabel || "не выбрано"}`;
  };

  const renderDecisionConditionRows = (
    title: string,
    rows: ModifierConditionDraft[],
    setRows: Dispatch<SetStateAction<ModifierConditionDraft[]>>,
  ) => (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
          <div className="mt-1 text-xs text-white/45">Все строки должны выполниться одновременно.</div>
        </div>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { type: "law_active", targetId: "", invert: false }])}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
        >
          <Plus size={12} />
          Условие
        </button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">Без условий.</div>
        ) : (
          rows.map((condition, index) => (
            <div key={`${condition.type}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px_34px]">
              <CustomSelect
                value={condition.type}
                onChange={(value) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, type: value as ModifierConditionType, targetId: "" } : row)))}
                options={MODIFIER_CONDITION_OPTIONS}
                buttonClassName="h-[38px]"
              />
              <CustomSelect
                value={condition.targetId}
                onChange={(value) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, targetId: value } : row)))}
                options={getModifierConditionTargetOptions(condition.type)}
                buttonClassName="h-[38px]"
              />
              <label className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2 text-xs text-white/65">
                <input
                  type="checkbox"
                  checked={condition.invert}
                  onChange={(e) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, invert: e.target.checked } : row)))}
                />
                НЕ
              </label>
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderDecisionsEditor = () => (
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#131a22] p-3">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-white/60">Категория</span>
          <CustomSelect
            value={draftDecisionCategory}
            onChange={(value) => setDraftDecisionCategory(value as DecisionCategory)}
            options={DECISION_CATEGORY_OPTIONS}
            buttonClassName="h-[38px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-white/60">Кулдаун, ходов</span>
          <AppInput value={draftDecisionCooldownTurns} onChange={(e) => setDraftDecisionCooldownTurns(e.target.value)} inputMode="numeric" />
        </label>
        <label className="mt-5 flex h-[38px] items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 text-xs text-white/70">
          <input type="checkbox" checked={draftDecisionRepeatable} onChange={(e) => setDraftDecisionRepeatable(e.target.checked)} />
          Можно повторять
        </label>
      </div>

      {renderDecisionConditionRows("Видимость", draftDecisionVisibilityConditions, setDraftDecisionVisibilityConditions)}
      {renderDecisionConditionRows("Доступность", draftDecisionAvailabilityConditions, setDraftDecisionAvailabilityConditions)}

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Стоимость</span>
            <button type="button" onClick={() => setDraftDecisionCosts((prev) => [...prev, { targetId: "gold", value: "100" }])} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10">
              <Plus size={12} />
              Ресурс
            </button>
          </div>
          <div className="space-y-2">
            {draftDecisionCosts.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">Бесплатно.</div> : draftDecisionCosts.map((row, index) => (
              <div key={`${row.targetId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_34px]">
                <CustomSelect value={row.targetId} onChange={(value) => setDraftDecisionCosts((prev) => prev.map((item, i) => (i === index ? { ...item, targetId: value } : item)))} options={RESOURCE_OPTIONS} buttonClassName="h-[38px]" />
                <AppInput value={row.value} onChange={(e) => setDraftDecisionCosts((prev) => prev.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))} inputMode="decimal" />
                <button type="button" onClick={() => setDraftDecisionCosts((prev) => prev.filter((_, i) => i !== index))} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Эффекты</span>
            <button type="button" onClick={() => setDraftDecisionEffects((prev) => [...prev, { type: "resource_delta", resource: "culture", amount: "10" }])} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10">
              <Plus size={12} />
              Эффект
            </button>
          </div>
          <div className="space-y-2">
            {draftDecisionEffects.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">Нет эффектов.</div> : draftDecisionEffects.map((row, index) => (
              <div key={`${row.resource}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_34px]">
                <CustomSelect value={row.resource} onChange={(value) => setDraftDecisionEffects((prev) => prev.map((item, i) => (i === index ? { ...item, resource: value as keyof ResourceTotals } : item)))} options={RESOURCE_OPTIONS} buttonClassName="h-[38px]" />
                <AppInput value={row.amount} onChange={(e) => setDraftDecisionEffects((prev) => prev.map((item, i) => (i === index ? { ...item, amount: e.target.value } : item)))} inputMode="decimal" />
                <button type="button" onClick={() => setDraftDecisionEffects((prev) => prev.filter((_, i) => i !== index))} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderEventEffects = (optionIndex: number, effects: DecisionEffectDraft[]) => (
    <div className="space-y-2">
      {effects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">Нет эффектов.</div>
      ) : (
        effects.map((row, effectIndex) => (
          <div key={`${row.resource}-${effectIndex}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_34px]">
            <CustomSelect
              value={row.resource}
              onChange={(value) =>
                setDraftEventOptions((prev) =>
                  prev.map((option, i) =>
                    i === optionIndex
                      ? {
                          ...option,
                          effects: option.effects.map((effect, j) =>
                            j === effectIndex ? { ...effect, resource: value as keyof ResourceTotals } : effect,
                          ),
                        }
                      : option,
                  ),
                )
              }
              options={RESOURCE_OPTIONS}
              buttonClassName="h-[38px]"
            />
            <AppInput
              value={row.amount}
              onChange={(e) =>
                setDraftEventOptions((prev) =>
                  prev.map((option, i) =>
                    i === optionIndex
                      ? {
                          ...option,
                          effects: option.effects.map((effect, j) =>
                            j === effectIndex ? { ...effect, amount: e.target.value } : effect,
                          ),
                        }
                      : option,
                  ),
                )
              }
              inputMode="decimal"
            />
            <button
              type="button"
              onClick={() =>
                setDraftEventOptions((prev) =>
                  prev.map((option, i) =>
                    i === optionIndex ? { ...option, effects: option.effects.filter((_, j) => j !== effectIndex) } : option,
                  ),
                )
              }
              className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  );

  const renderEventsEditor = () => (
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#131a22] p-3">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <label className="block">
          <span className="mb-1 block text-xs text-white/60">Категория</span>
          <CustomSelect value={draftEventCategory} onChange={(value) => setDraftEventCategory(value as EventCategory)} options={EVENT_CATEGORY_OPTIONS} buttonClassName="h-[38px]" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-white/60">Важность</span>
          <CustomSelect value={draftEventPriority} onChange={(value) => setDraftEventPriority(value as EventPriority)} options={EVENT_PRIORITY_OPTIONS} buttonClassName="h-[38px]" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-white/60">Видимость</span>
          <CustomSelect value={draftEventVisibility} onChange={(value) => setDraftEventVisibility(value as EventVisibility)} options={EVENT_VISIBILITY_OPTIONS} buttonClassName="h-[38px]" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-white/60">Кулдаун</span>
          <AppInput value={draftEventCooldownTurns} onChange={(e) => setDraftEventCooldownTurns(e.target.value)} inputMode="numeric" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-white/60">Проверять раз в N ходов</span>
          <AppInput value={draftEventCheckIntervalTurns} onChange={(e) => setDraftEventCheckIntervalTurns(e.target.value)} inputMode="numeric" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-white/60">Шанс, %</span>
          <AppInput value={draftEventChancePct} onChange={(e) => setDraftEventChancePct(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex h-[38px] items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 text-xs text-white/70">
          <input type="checkbox" checked={draftEventRepeatable} onChange={(e) => setDraftEventRepeatable(e.target.checked)} />
          Может повторяться
        </label>
        <label className="flex h-[38px] items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 text-xs text-white/70">
          <input type="checkbox" checked={draftEventBlocking} onChange={(e) => setDraftEventBlocking(e.target.checked)} />
          Важное событие
        </label>
      </div>
      {renderDecisionConditionRows("Условия появления", draftEventTriggerConditions, setDraftEventTriggerConditions)}
      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Варианты выбора</div>
            <div className="mt-1 text-xs text-white/45">Каждая строка станет кнопкой в окне события.</div>
          </div>
          <button type="button" onClick={() => setDraftEventOptions((prev) => [...prev, { id: `option-${prev.length + 1}`, label: "Новый вариант", description: "", autoChancePct: "100", buttonColor: "#15505b", effects: [] }])} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10">
            <Plus size={12} />
            Вариант
          </button>
        </div>
        <div className="space-y-3">
          {draftEventOptions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">Добавь хотя бы один вариант.</div>
          ) : (
            draftEventOptions.map((option, index) => (
              <div key={`${option.id}-${index}`} className="rounded-xl border border-white/10 bg-[#111821] p-3">
                <div className="grid gap-2 md:grid-cols-[150px_minmax(0,1fr)_120px_160px_34px]">
                  <AppInput value={option.id} onChange={(e) => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, id: e.target.value } : item)))} placeholder="id" />
                  <AppInput value={option.label} onChange={(e) => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)))} placeholder="Текст кнопки" />
                  <AppInput value={option.autoChancePct} onChange={(e) => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, autoChancePct: e.target.value } : item)))} inputMode="decimal" placeholder="Авто %" />
                  <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-2">
                    <input
                      type="color"
                      value={/^#[0-9A-Fa-f]{6}$/.test(option.buttonColor) ? option.buttonColor : "#15505b"}
                      onChange={(e) => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, buttonColor: e.target.value } : item)))}
                      className="h-[38px] w-full rounded-lg border border-white/10 bg-black/35 p-1"
                      aria-label="Цвет кнопки"
                    />
                    <AppInput value={option.buttonColor} onChange={(e) => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, buttonColor: e.target.value } : item)))} placeholder="#15505b" />
                  </div>
                  <button type="button" onClick={() => setDraftEventOptions((prev) => prev.filter((_, i) => i !== index))} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={14} /></button>
                </div>
                <AppTextarea className="mt-2 min-h-[70px]" value={option.description} onChange={(e) => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, description: e.target.value } : item)))} placeholder="Описание последствий варианта" />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Эффекты варианта</span>
                  <button type="button" onClick={() => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, effects: [...item.effects, { type: "resource_delta", resource: "culture", amount: "10" }] } : item)))} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10">
                    <Plus size={12} />
                    Эффект
                  </button>
                </div>
                <div className="mt-2">{renderEventEffects(index, option.effects)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderModifiersEditor = () => (
    <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Tooltip content="Модификаторы применяются сервером в расчётах. Технологии действуют после изучения, законы - когда активны.">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Модификаторы</span>
        </Tooltip>
        <button
          type="button"
          onClick={() =>
            setDraftModifiers((prev) => [
              ...prev,
              {
                id: `modifier-${prev.length + 1}`,
                label: "Новый модификатор",
                scope: "country",
                conditions: [{ type: "always", targetId: "", invert: false }],
                effects: [
                  {
                    stat: activeCategory === "technologies" ? "science_gain" : "ducats_gain",
                    mode: "add_pct",
                    value: "0.1",
                    buildingId: "",
                    goodId: "",
                    professionId: "",
                    resourceCategoryId: "",
                  },
                ],
              },
            ])
          }
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
        >
          <Plus size={12} />
          Добавить
        </button>
      </div>
      <div className="mb-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs leading-relaxed text-white/55">
        Выберите, что меняет эффект. После этого будут показаны только те цели, которые реально участвуют в расчёте.
      </div>
      <div className="space-y-3">
        {draftModifiers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">
            Нет действующих эффектов для этой записи.
          </div>
        ) : (
          draftModifiers.map((modifier, modifierIndex) => (
            <div key={`${modifier.id}-${modifierIndex}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)_150px_34px]">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-white/50">ID</span>
                  <AppInput
                    value={modifier.id}
                    onChange={(e) =>
                      setDraftModifiers((prev) =>
                        prev.map((item, i) => (i === modifierIndex ? { ...item, id: e.target.value } : item)),
                      )
                    }
                    placeholder="id"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-white/50">Название</span>
                  <AppInput
                    value={modifier.label}
                    onChange={(e) =>
                      setDraftModifiers((prev) =>
                        prev.map((item, i) => (i === modifierIndex ? { ...item, label: e.target.value } : item)),
                      )
                    }
                    placeholder="Название модификатора"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-white/50">Область</span>
                  <CustomSelect
                    value={modifier.scope}
                    onChange={(value) =>
                      setDraftModifiers((prev) =>
                        prev.map((item, i) => (i === modifierIndex ? { ...item, scope: value as ModifierScope } : item)),
                      )
                    }
                    options={MODIFIER_SCOPE_OPTIONS}
                    buttonClassName="h-[38px]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setDraftModifiers((prev) => prev.filter((_, i) => i !== modifierIndex))}
                  className="mt-[18px] inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="mt-3 rounded-lg border border-white/10 bg-black/15 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Условия активации</span>
                    <div className="mt-1 text-xs text-white/45">
                      Все условия должны выполниться для страны, чтобы модификатор включился.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftModifiers((prev) =>
                        prev.map((item, i) =>
                          i === modifierIndex
                            ? { ...item, conditions: [...item.conditions, { type: "law_active", targetId: "", invert: false }] }
                            : item,
                        ),
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
                  >
                    <Plus size={12} />
                    Условие
                  </button>
                </div>
                <div className="space-y-2">
                  {modifier.conditions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">
                      Без условий: модификатор действует всегда.
                    </div>
                  ) : (
                    modifier.conditions.map((condition, conditionIndex) => (
                      <div key={`${condition.type}-${conditionIndex}`} className="rounded-lg border border-white/10 bg-black/20 p-2">
                        <div className="mb-2 text-xs text-white/60">{getModifierConditionSummary(condition)}</div>
                        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_34px]">
                          <CustomSelect
                            value={condition.type}
                            onChange={(value) =>
                              setDraftModifiers((prev) =>
                                prev.map((item, i) =>
                                  i === modifierIndex
                                    ? {
                                        ...item,
                                        conditions: item.conditions.map((row, j) =>
                                          j === conditionIndex
                                            ? { type: value as ModifierConditionType, targetId: "", invert: row.invert }
                                            : row,
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                            options={MODIFIER_CONDITION_OPTIONS}
                            buttonClassName="h-[38px]"
                          />
                          <CustomSelect
                            value={condition.targetId}
                            onChange={(value) =>
                              setDraftModifiers((prev) =>
                                prev.map((item, i) =>
                                  i === modifierIndex
                                    ? {
                                        ...item,
                                        conditions: item.conditions.map((row, j) =>
                                          j === conditionIndex ? { ...row, targetId: value } : row,
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                            options={getModifierConditionTargetOptions(condition.type)}
                            buttonClassName="h-[38px]"
                          />
                          <label className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2 text-xs text-white/65">
                            <input
                              type="checkbox"
                              checked={condition.invert}
                              onChange={(e) =>
                                setDraftModifiers((prev) =>
                                  prev.map((item, i) =>
                                    i === modifierIndex
                                      ? {
                                          ...item,
                                          conditions: item.conditions.map((row, j) =>
                                            j === conditionIndex ? { ...row, invert: e.target.checked } : row,
                                          ),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                            НЕ
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setDraftModifiers((prev) =>
                                prev.map((item, i) =>
                                  i === modifierIndex
                                    ? { ...item, conditions: item.conditions.filter((_, j) => j !== conditionIndex) }
                                    : item,
                                ),
                              )
                            }
                            className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Эффекты</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftModifiers((prev) =>
                        prev.map((item, i) =>
                          i === modifierIndex
                            ? {
                                ...item,
                                effects: [
                                  ...item.effects,
                                  {
                                    stat: "science_gain",
                                    mode: "add_pct",
                                    value: "0.1",
                                    buildingId: "",
                                    goodId: "",
                                    professionId: "",
                                    resourceCategoryId: "",
                                  },
                                ],
                              }
                            : item,
                        ),
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
                  >
                    <Plus size={12} />
                    Эффект
                  </button>
                </div>
                {modifier.effects.map((effect, effectIndex) => {
                  const statConfig = MODIFIER_STAT_CONFIG[effect.stat];
                  const targets = statConfig.targets;
                  return (
                  <div key={`${effect.stat}-${effectIndex}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Эффект {effectIndex + 1}</span>
                        <div className="mt-1 truncate text-xs text-white/65">{getModifierEffectSummary(effect)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftModifiers((prev) =>
                            prev.map((item, i) =>
                              i === modifierIndex
                                ? { ...item, effects: item.effects.filter((_, j) => j !== effectIndex) }
                                : item,
                            ),
                          )
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mb-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs leading-relaxed text-white/55">
                      {statConfig.description} <span className="text-white/40">{statConfig.valueHint}</span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_minmax(180px,240px)_140px]">
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-white/50">Что меняем</span>
                        <CustomSelect
                          value={effect.stat}
                          onChange={(value) =>
                            setDraftModifiers((prev) =>
                              prev.map((item, i) =>
                                i === modifierIndex
                                  ? {
                                      ...item,
                                      effects: item.effects.map((row, j) =>
                                        j === effectIndex
                                          ? {
                                              ...cleanModifierEffectForStat(row, value as ModifierStat),
                                              mode: MODIFIER_STAT_CONFIG[value as ModifierStat].defaultMode,
                                            }
                                          : row,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                          options={MODIFIER_STAT_OPTIONS}
                          buttonClassName="h-[38px]"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-white/50">Как применяем</span>
                        <CustomSelect
                          value={effect.mode}
                          onChange={(value) =>
                            setDraftModifiers((prev) =>
                              prev.map((item, i) =>
                                i === modifierIndex
                                  ? {
                                      ...item,
                                      effects: item.effects.map((row, j) =>
                                        j === effectIndex ? { ...row, mode: value as ModifierMode } : row,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                          options={MODIFIER_MODE_OPTIONS}
                          buttonClassName="h-[38px]"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-white/50">Значение</span>
                        <AppInput
                          value={effect.value}
                          onChange={(e) =>
                            setDraftModifiers((prev) =>
                              prev.map((item, i) =>
                                i === modifierIndex
                                  ? {
                                      ...item,
                                      effects: item.effects.map((row, j) =>
                                        j === effectIndex ? { ...row, value: e.target.value } : row,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                          inputMode="decimal"
                          placeholder="0.1"
                        />
                      </label>
                    </div>
                    {targets.length === 0 ? (
                      <div className="mt-2 rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">
                        Этот показатель применяется ко всей стране, дополнительные цели не нужны.
                      </div>
                    ) : (
                    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      {targets.includes("buildingId") && (
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-white/50">{MODIFIER_TARGET_LABELS.buildingId}</span>
                        <CustomSelect
                        value={effect.buildingId}
                        onChange={(value) =>
                          setDraftModifiers((prev) =>
                            prev.map((item, i) =>
                              i === modifierIndex
                                ? {
                                    ...item,
                                    effects: item.effects.map((row, j) =>
                                      j === effectIndex ? { ...row, buildingId: value } : row,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        options={[{ value: "", label: "Любое здание" }, ...buildingOptions.map((option) => ({ value: option.id, label: option.name }))]}
                        buttonClassName="h-[38px]"
                      />
                      </label>
                      )}
                      {targets.includes("goodId") && (
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-white/50">{MODIFIER_TARGET_LABELS.goodId}</span>
                        <CustomSelect
                        value={effect.goodId}
                        onChange={(value) =>
                          setDraftModifiers((prev) =>
                            prev.map((item, i) =>
                              i === modifierIndex
                                ? {
                                    ...item,
                                    effects: item.effects.map((row, j) =>
                                      j === effectIndex ? { ...row, goodId: value } : row,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        options={[{ value: "", label: "Любой товар" }, ...goodsOptions.map((option) => ({ value: option.id, label: option.name }))]}
                        buttonClassName="h-[38px]"
                      />
                      </label>
                      )}
                      {targets.includes("professionId") && (
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-white/50">{MODIFIER_TARGET_LABELS.professionId}</span>
                        <CustomSelect
                        value={effect.professionId}
                        onChange={(value) =>
                          setDraftModifiers((prev) =>
                            prev.map((item, i) =>
                              i === modifierIndex
                                ? {
                                    ...item,
                                    effects: item.effects.map((row, j) =>
                                      j === effectIndex ? { ...row, professionId: value } : row,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        options={[{ value: "", label: "Любая профессия" }, ...professionOptions.map((option) => ({ value: option.id, label: option.name }))]}
                        buttonClassName="h-[38px]"
                      />
                      </label>
                      )}
                      {targets.includes("resourceCategoryId") && (
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-white/50">{MODIFIER_TARGET_LABELS.resourceCategoryId}</span>
                        <CustomSelect
                        value={effect.resourceCategoryId}
                        onChange={(value) =>
                          setDraftModifiers((prev) =>
                            prev.map((item, i) =>
                              i === modifierIndex
                                ? {
                                    ...item,
                                    effects: item.effects.map((row, j) =>
                                      j === effectIndex ? { ...row, resourceCategoryId: value } : row,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        options={[{ value: "", label: "Любая категория" }, ...resourceCategoryOptions.map((option) => ({ value: option.id, label: option.name }))]}
                        buttonClassName="h-[38px]"
                      />
                      </label>
                      )}
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      <AppModal open={open} onClose={requestClose} modalKey="content" zIndexClassName="z-[205]">
            <AppModalHeader
              title="Панель контента"
              description="Создание и редактирование игрового контента"
              onClose={requestClose}
            />

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-black/20 p-3">
                <Tooltip content="Выберите тип контента для создания и редактирования записей.">
                  <span className="mb-2 block shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Категории</span>
                </Tooltip>
                <div className="arc-scrollbar mt-2 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                  {CONTENT_UI_SCHEMA.categories.map((category) => {
                    const Icon = category.icon;
                    const isActive = category.id === activeCategory;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          if (!category.enabled) return;
                          setActiveCategory(category.id as PanelCategory);
                          setContentSection("general");
                          setSearch("");
                        }}
                        disabled={!category.enabled}
                        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                          !category.enabled
                            ? "border-white/10 bg-black/20 text-white/35"
                            : isActive
                              ? "border-arc-accent/30 bg-arc-accent/10 text-arc-accent"
                              : "border-white/10 bg-black/20 text-white/70"
                        }`}
                      >
                        <Icon size={15} />
                        <span>{category.label}</span>
                      </button>
                    );
                  })}
                </div>

              </aside>

              <div className="grid min-h-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <section className="min-h-0 rounded-xl border border-white/10 bg-black/20 p-3">
                  <Tooltip content="Выберите запись из списка, чтобы редактировать её данные и оформление.">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Список: {CONTENT_UI_SCHEMA.categories.find((c) => c.id === activeCategory)?.label ?? "Контент"}
                    </span>
                  </Tooltip>
                  <AppInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Поиск: ${categoryMeta.singular}`}
                    className="mb-2"
                  />
                  <button
                    type="button"
                    onClick={() => void createEntry()}
                    disabled={saving}
                    className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-arc-accent px-3 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
                  >
                    <Plus size={15} />
                    {categoryMeta.createLabel}
                  </button>

                  <div className="arc-scrollbar max-h-[calc(100%-6.75rem)] space-y-2 overflow-auto pr-1">
                    {loading ? (
                      <AppEmptyState className="py-4 text-xs">Загрузка...</AppEmptyState>
                    ) : filteredEntries.length === 0 ? (
                      <AppEmptyState className="py-4 text-xs">Записей не найдено.</AppEmptyState>
                    ) : activeCategory === "buildings" ? (
                      buildingEntryGroups.map((group) => {
                        const isOpen = openBuildingIndustryGroups[group.id] ?? false;
                        return (
                          <div key={group.id} className="rounded-lg border border-white/10 bg-black/15">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenBuildingIndustryGroups((current) => ({
                                  ...current,
                                  [group.id]: !(current[group.id] ?? false),
                                }))
                              }
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-white/60 transition hover:bg-white/[0.04] hover:text-white/80"
                            >
                              <ChevronDown
                                size={14}
                                className={`shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                              />
                              <span className="min-w-0 flex-1 truncate">{group.label}</span>
                              <span className="rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-white/45">
                                {group.entries.length}
                              </span>
                            </button>
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.16, ease: "easeOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="space-y-2 border-t border-white/10 p-2">
                                    {group.entries.map((entry) => (
                                      <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => setSelectedEntryId(entry.id)}
                                        className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                                          selectedEntryId === entry.id
                                            ? "border-arc-accent/30 bg-arc-accent/10"
                                            : "border-white/10 bg-black/20 hover:border-white/15"
                                        }`}
                                      >
                                        <div
                                          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#131a22]"
                                          style={{ boxShadow: `0 0 0 1px ${entry.color}33 inset` }}
                                        >
                                          {entry.logoUrl ? (
                                            <img src={entry.logoUrl} alt="" className="h-full w-full object-contain p-1" />
                                          ) : (
                                            <span className="text-xs font-semibold" style={{ color: entry.color }}>
                                              {entry.name.slice(0, 1).toUpperCase()}
                                            </span>
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate text-sm text-white">{entry.name}</div>
                                          <div className="mt-1 flex items-center gap-2">
                                            <span className="inline-block h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: entry.color }} />
                                            <span className="text-[10px] text-white/50">{entry.color}</span>
                                          </div>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })
                    ) : filteredEntries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedEntryId(entry.id)}
                        className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                          selectedEntryId === entry.id
                            ? "border-arc-accent/30 bg-arc-accent/10"
                            : "border-white/10 bg-black/20 hover:border-white/15"
                        }`}
                      >
                        <div
                          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#131a22]"
                          style={{ boxShadow: `0 0 0 1px ${entry.color}33 inset` }}
                        >
                          {entry.logoUrl ? (
                            <img src={entry.logoUrl} alt="" className="h-full w-full object-contain p-1" />
                          ) : (
                            <span className="text-xs font-semibold" style={{ color: entry.color }}>
                              {entry.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-white">{entry.name}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: entry.color }} />
                            <span className="text-[10px] text-white/50">{entry.color}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <div className="grid min-h-0 gap-4 lg:grid-rows-[auto_auto_minmax(0,1fr)]">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/10 px-1">
                  {CONTENT_UI_SCHEMA.categories
                    .find((c) => c.id === activeCategory)
                    ?.sections.map((section) => {
                      const SectionIcon = section.icon;
                      return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setContentSection(section.id)}
                        className={`inline-flex items-center gap-1.5 pb-2 text-sm transition ${
                          contentSection === section.id
                            ? "border-b-2 border-arc-accent text-arc-accent"
                            : "border-b-2 border-transparent text-white/60 hover:text-white"
                        }`}
                      >
                        <SectionIcon size={14} />
                        {section.label}
                      </button>
                      );
                    })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div>
                    <AppSectionHeader
                      title={selectedEntry ? selectedEntry.name : categoryMeta.createBaseName}
                      description={categoryMeta.sectionTitle}
                      className="mb-0"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {hasUnsavedChanges && (
                      <span className="rounded-md border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
                        Есть несохранённые изменения
                      </span>
                    )}
                    <Tooltip content="Сохраняет все изменения в выбранной культуре">
                      <button
                        type="button"
                        onClick={() => void saveEntry()}
                        disabled={!selectedEntry || saving}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-arc-accent px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Сохранить
                      </button>
                    </Tooltip>
                    <Tooltip content="Полностью удаляет выбранную культуру">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmOpen(true)}
                        disabled={!selectedEntry || saving}
                        className="panel-border inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-500/10 px-3 text-sm text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        Удалить
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <div className="grid min-h-0 gap-4">
                  <div className="arc-scrollbar min-h-0 space-y-4 overflow-auto pr-1">
                    {contentSection === "general" && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <Tooltip content="Название, цвет и описание используются в интерфейсе и игровых списках.">
                          <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">Основные данные</span>
                        </Tooltip>
                        <div className={`grid gap-4 ${activeCategory === "technologies" ? "" : "md:grid-cols-[minmax(0,1fr)_200px]"}`}>
                          <label className="block">
                            <Tooltip content="Уникальное имя записи. Используется в карточках, фильтрах и справочниках.">
                              <span className="mb-1 block text-xs text-white/60">Название</span>
                            </Tooltip>
                            <AppInput
                              value={draftName}
                              onChange={(e) => setDraftName(e.target.value)}
                              placeholder={categoryMeta.namePlaceholder}
                            />
                          </label>
                          {activeCategory !== "technologies" && (
                            <div>
                              <Tooltip content="Основной акцентный цвет записи для чипов, маркеров и предпросмотра.">
                                <span className="mb-1 block text-xs text-white/60">Цвет</span>
                              </Tooltip>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={/^#[0-9A-Fa-f]{6}$/.test(draftColor) ? draftColor : "#4ade80"}
                                  onChange={(e) => setDraftColor(e.target.value)}
                                  className="h-10 w-12 rounded border border-white/10 bg-black/35 p-1"
                                />
                                <AppInput
                                  value={draftColor}
                                  onChange={(e) => setDraftColor(e.target.value)}
                                  placeholder="#4ade80"
                                  className="min-w-0 flex-1"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <label className="mt-4 block">
                          <Tooltip content="Короткий текст для админ-панели и связанных UI-блоков.">
                            <span className="mb-1 block text-xs text-white/60">Описание</span>
                          </Tooltip>
                          <AppTextarea
                            value={draftDescription}
                            onChange={(e) => setDraftDescription(e.target.value)}
                            placeholder={categoryMeta.descriptionPlaceholder}
                            maxLength={5000}
                            rows={5}
                          />
                          <div className="mt-1 text-right text-[11px] text-white/45">{draftDescription.length}/5000</div>
                        </label>

                      </section>
                    )}

                    {contentSection === "politics" && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <Tooltip content="Эти параметры используются парламентом, выборами и голосованием законов.">
                          <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">Политические параметры</span>
                        </Tooltip>
                        {activeCategory === "ideologies" && renderIdeologyAttractionRulesEditor()}
                        {activeCategory === "parties" && (
                          <div className="space-y-4">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                              <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Веса идеологий для выборов</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraftIdeologyWeights((prev) => [
                                        ...prev,
                                        { targetId: ideologyOptions.find((option) => !prev.some((row) => row.targetId === option.id))?.id ?? "", value: "1" },
                                      ])
                                    }
                                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
                                  >
                                    <Plus size={12} />
                                    Добавить
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {draftIdeologyWeights.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">Партия получает равную базовую поддержку.</div>
                                  ) : (
                                    draftIdeologyWeights.map((row, index) => (
                                      <div key={`${row.targetId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_34px]">
                                        <CustomSelect
                                          value={row.targetId}
                                          onChange={(value) => setDraftIdeologyWeights((prev) => prev.map((item, i) => (i === index ? { ...item, targetId: value } : item)))}
                                          options={[{ value: "", label: "Идеология" }, ...ideologyOptions.map((option) => ({ value: option.id, label: option.name }))]}
                                          buttonClassName="h-[38px]"
                                        />
                                        <AppInput
                                          value={row.value}
                                          onChange={(e) => setDraftIdeologyWeights((prev) => prev.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))}
                                          inputMode="decimal"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setDraftIdeologyWeights((prev) => prev.filter((_, i) => i !== index))}
                                          className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                              <label className="block">
                                <span className="mb-1 block text-xs text-white/60">Дисциплина</span>
                                <AppInput
                                  value={draftDiscipline}
                                  onChange={(e) => setDraftDiscipline(e.target.value)}
                                  inputMode="decimal"
                                />
                                <div className="mt-2 text-[11px] leading-relaxed text-white/45">
                                  0 означает рыхлую партию, 1 означает почти монолитное голосование.
                                </div>
                              </label>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Предпочтения законов</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftLawPreferences((prev) => [
                                      ...prev,
                                      { targetId: lawOptions.find((option) => !prev.some((row) => row.targetId === option.id))?.id ?? "", value: "0" },
                                    ])
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
                                >
                                  <Plus size={12} />
                                  Добавить
                                </button>
                              </div>
                              <div className="space-y-2">
                                {draftLawPreferences.length === 0 ? (
                                  <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">Нет явных предпочтений.</div>
                                ) : (
                                  draftLawPreferences.map((row, index) => (
                                    <div key={`${row.targetId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_34px]">
                                      <CustomSelect
                                        value={row.targetId}
                                        onChange={(value) => setDraftLawPreferences((prev) => prev.map((item, i) => (i === index ? { ...item, targetId: value } : item)))}
                                        options={[{ value: "", label: "Закон" }, ...lawOptions.map((option) => ({ value: option.id, label: option.name }))]}
                                        buttonClassName="h-[38px]"
                                      />
                                      <AppInput
                                        value={row.value}
                                        onChange={(e) => setDraftLawPreferences((prev) => prev.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))}
                                        inputMode="decimal"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setDraftLawPreferences((prev) => prev.filter((_, i) => i !== index))}
                                        className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {activeCategory === "interestGroups" && (
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-5">
                              <label className="block">
                                <span className="mb-1 block text-xs text-white/60">Базовая сила</span>
                                <AppInput value={draftBasePoliticalStrength} onChange={(e) => setDraftBasePoliticalStrength(e.target.value)} inputMode="decimal" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-white/60">Множитель SoL</span>
                                <AppInput value={draftSolMultiplier} onChange={(e) => setDraftSolMultiplier(e.target.value)} inputMode="decimal" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-white/60">Множитель радикалов</span>
                                <AppInput value={draftRadicalMultiplier} onChange={(e) => setDraftRadicalMultiplier(e.target.value)} inputMode="decimal" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-white/60">Множитель лоялистов</span>
                                <AppInput value={draftLoyalistMultiplier} onChange={(e) => setDraftLoyalistMultiplier(e.target.value)} inputMode="decimal" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-white/60">Партия по умолчанию</span>
                                <CustomSelect
                                  value={draftDefaultPartyId}
                                  onChange={setDraftDefaultPartyId}
                                  options={[{ value: "", label: "Не выбрана" }, ...partyOptions.map((option) => ({ value: option.id, label: option.name }))]}
                                  buttonClassName="h-[42px]"
                                />
                              </label>
                            </div>
                            <div className="grid gap-4 xl:grid-cols-2">
                              {renderNumberRecordEditor("Вес профессий", draftProfessionWeights, setDraftProfessionWeights, professionOptions, "Профессии пока не выбраны.", "Профессия", "50")}
                              {renderNumberRecordEditor("Близкие идеологии", draftIdeologyWeights, setDraftIdeologyWeights, ideologyOptions, "Идеологии пока не выбраны.", "Идеология", "50")}
                              {renderNumberRecordEditor("Религиозные веса", draftReligionWeights, setDraftReligionWeights, religionOptions, "Религии пока не выбраны.", "Религия", "25")}
                              {renderNumberRecordEditor("Веса зданий", draftBuildingWeights, setDraftBuildingWeights, buildingOptions, "Здания пока не выбраны.", "Здание", "25")}
                              {renderNumberRecordEditor("Предпочтения законов", draftLawPreferences, setDraftLawPreferences, lawOptions, "Нет явных предпочтений.", "Закон", "0")}
                            </div>
                          </div>
                        )}
                        {activeCategory === "lawGroups" && (
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                              <span className="mb-1 block text-xs text-white/60">Закон по умолчанию</span>
                              <CustomSelect
                                value={draftDefaultLawId}
                                onChange={setDraftDefaultLawId}
                                options={[
                                  { value: "", label: "Не выбран" },
                                  ...lawOptions.map((option) => ({ value: option.id, label: option.name })),
                                ]}
                                buttonClassName="h-[42px]"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs text-white/60">Порядок</span>
                              <AppInput
                                value={draftOrder}
                                onChange={(e) => setDraftOrder(e.target.value)}
                                inputMode="numeric"
                              />
                            </label>
                          </div>
                        )}
                        {activeCategory === "laws" && (
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-3">
                              <label className="block">
                                <span className="mb-1 block text-xs text-white/60">Группа закона</span>
                                <CustomSelect
                                  value={draftLawGroupId}
                                  onChange={setDraftLawGroupId}
                                  options={[
                                    { value: "", label: "Не выбрана" },
                                    ...lawGroupOptions.map((option) => ({ value: option.id, label: option.name })),
                                  ]}
                                  buttonClassName="h-[42px]"
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-white/60">Сложность принятия</span>
                                <AppInput
                                  value={draftEnactmentDifficulty}
                                  onChange={(e) => setDraftEnactmentDifficulty(e.target.value)}
                                  inputMode="decimal"
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-white/60">Длительность, ходов</span>
                                <AppInput
                                  value={draftVotingDurationTurns}
                                  onChange={(e) => setDraftVotingDurationTurns(e.target.value)}
                                  inputMode="numeric"
                                />
                              </label>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Полномочие парламента</div>
                              <div className="grid gap-3 md:grid-cols-3">
                                <label className="block">
                                  <span className="mb-1 block text-xs text-white/60">Сфера</span>
                                  <CustomSelect
                                    value={draftParliamentPowerDomain}
                                    onChange={(value) => {
                                      const nextDomain = value as LawParliamentPowerEffect["domain"] | "";
                                      setDraftParliamentPowerDomain(nextDomain);
                                      setDraftParliamentPowerValue(nextDomain ? PARLIAMENT_POWER_VALUE_OPTIONS[nextDomain][0]?.value ?? "" : "");
                                    }}
                                    options={PARLIAMENT_POWER_DOMAIN_OPTIONS}
                                    buttonClassName="h-[42px]"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs text-white/60">Уровень</span>
                                  <CustomSelect
                                    value={draftParliamentPowerValue}
                                    onChange={setDraftParliamentPowerValue}
                                    options={
                                      draftParliamentPowerDomain
                                        ? PARLIAMENT_POWER_VALUE_OPTIONS[draftParliamentPowerDomain]
                                        : [{ value: "", label: "Сначала выберите сферу" }]
                                    }
                                    buttonClassName="h-[42px]"
                                  />
                                </label>
                                {draftParliamentPowerDomain === "diplomacy" ? (
                                  <label className="block">
                                    <span className="mb-1 block text-xs text-white/60">Порог крупных выплат</span>
                                    <AppInput
                                      value={draftParliamentPowerThreshold}
                                      onChange={(e) => setDraftParliamentPowerThreshold(e.target.value)}
                                      inputMode="numeric"
                                      placeholder="10000"
                                    />
                                  </label>
                                ) : (
                                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs leading-relaxed text-white/45 md:mt-5">
                                    Активный закон с этой настройкой задаёт одно полномочие парламента.
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Предпочтения партий по этому закону</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftLawPreferences((prev) => [
                                      ...prev,
                                      { targetId: partyOptions.find((option) => !prev.some((row) => row.targetId === option.id))?.id ?? "", value: "0" },
                                    ])
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
                                >
                                  <Plus size={12} />
                                  Добавить
                                </button>
                              </div>
                              <div className="space-y-2">
                                {draftLawPreferences.length === 0 ? (
                                  <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">Нет явных предпочтений партий.</div>
                                ) : (
                                  draftLawPreferences.map((row, index) => (
                                    <div key={`${row.targetId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_34px]">
                                      <CustomSelect
                                        value={row.targetId}
                                        onChange={(value) => setDraftLawPreferences((prev) => prev.map((item, i) => (i === index ? { ...item, targetId: value } : item)))}
                                        options={[{ value: "", label: "Партия" }, ...partyOptions.map((option) => ({ value: option.id, label: option.name }))]}
                                        buttonClassName="h-[38px]"
                                      />
                                      <AppInput
                                        value={row.value}
                                        onChange={(e) => setDraftLawPreferences((prev) => prev.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))}
                                        inputMode="decimal"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setDraftLawPreferences((prev) => prev.filter((_, i) => i !== index))}
                                        className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </section>
                    )}

                    {contentSection === "technology" && activeCategory === "technologies" && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                          <label className="block">
                            <Tooltip content="Сколько научных очков потребуется для исследования технологии, когда появится система прогресса.">
                              <span className="mb-1 block text-xs text-white/60">Стоимость исследования</span>
                            </Tooltip>
                            <AppInput
                              value={draftCostScience}
                              onChange={(e) => setDraftCostScience(e.target.value)}
                              inputMode="decimal"
                            />
                          </label>
                          <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <Tooltip content="Эти связи строят стрелки в дереве технологий. Технология появится после выбранных prerequisites.">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Зависимости в дереве</span>
                              </Tooltip>
                              <button
                                type="button"
                                disabled={!nextPrerequisiteTechnologyId}
                                onClick={() => {
                                  if (!nextPrerequisiteTechnologyId) return;
                                  setDraftPrerequisiteTechnologyIds((prev) => normalizeCountryIdsDraft([...prev, nextPrerequisiteTechnologyId]));
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus size={12} />
                                Добавить
                              </button>
                            </div>
                            <div className="space-y-2">
                              {draftPrerequisiteTechnologyIds.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">
                                  Технология будет корневым узлом дерева.
                                </div>
                              ) : (
                                draftPrerequisiteTechnologyIds.map((technologyId, index) => (
                                  <div key={`${technologyId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_34px]">
                                    <CustomSelect
                                      value={technologyId}
                                      onChange={(value) =>
                                        setDraftPrerequisiteTechnologyIds((prev) =>
                                          normalizeCountryIdsDraft(prev.map((item, i) => (i === index ? value : item))).filter(
                                            (id) => id !== selectedEntry?.id,
                                          ),
                                        )
                                      }
                                      options={[
                                        { value: "", label: "Технология" },
                                        ...selectableTechnologyOptions.map((option) => ({ value: option.id, label: option.name })),
                                      ]}
                                      buttonClassName="h-[38px]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setDraftPrerequisiteTechnologyIds((prev) => prev.filter((_, i) => i !== index))}
                                      className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Открывает здания</span>
                              <button
                                type="button"
                                disabled={!nextUnlockBuildingId}
                                onClick={() => setDraftUnlockBuildingIds((prev) => normalizeCountryIdsDraft([...prev, nextUnlockBuildingId]))}
                                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus size={12} />
                                Добавить
                              </button>
                            </div>
                            <div className="space-y-2">
                              {draftUnlockBuildingIds.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">Не открывает здания.</div>
                              ) : (
                                draftUnlockBuildingIds.map((buildingId, index) => (
                                  <div key={`${buildingId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_34px]">
                                    <CustomSelect
                                      value={buildingId}
                                      onChange={(value) => setDraftUnlockBuildingIds((prev) => normalizeCountryIdsDraft(prev.map((item, i) => (i === index ? value : item))))}
                                      options={[{ value: "", label: "Здание" }, ...buildingOptions.map((option) => ({ value: option.id, label: option.name }))]}
                                      buttonClassName="h-[38px]"
                                    />
                                    <button type="button" onClick={() => setDraftUnlockBuildingIds((prev) => prev.filter((_, i) => i !== index))} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Открывает законы</span>
                              <button
                                type="button"
                                disabled={!nextUnlockLawId}
                                onClick={() => setDraftUnlockLawIds((prev) => normalizeCountryIdsDraft([...prev, nextUnlockLawId]))}
                                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus size={12} />
                                Добавить
                              </button>
                            </div>
                            <div className="space-y-2">
                              {draftUnlockLawIds.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">Не открывает законы.</div>
                              ) : (
                                draftUnlockLawIds.map((lawId, index) => (
                                  <div key={`${lawId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_34px]">
                                    <CustomSelect
                                      value={lawId}
                                      onChange={(value) => setDraftUnlockLawIds((prev) => normalizeCountryIdsDraft(prev.map((item, i) => (i === index ? value : item))))}
                                      options={[{ value: "", label: "Закон" }, ...lawOptions.map((option) => ({ value: option.id, label: option.name }))]}
                                      buttonClassName="h-[38px]"
                                    />
                                    <button type="button" onClick={() => setDraftUnlockLawIds((prev) => prev.filter((_, i) => i !== index))} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-rose-500/10 hover:text-rose-300">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {contentSection === "modifiers" && activeCategory === "modifiers" && (
                        <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                          {renderModifiersEditor()}
                        </section>
                    )}

                    {contentSection === "decisions" && activeCategory === "decisions" && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        {renderDecisionsEditor()}
                      </section>
                    )}

                    {contentSection === "events" && activeCategory === "events" && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        {renderEventsEditor()}
                      </section>
                    )}

                    {contentSection === "economy" && isMilitaryContentCategory(activeCategory) && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                          {[
                            ["Люди", draftBattalionManpower, setDraftBattalionManpower, "numeric"],
                            ["Атака", draftBattalionAttack, setDraftBattalionAttack, "decimal"],
                            ["Защита", draftBattalionDefense, setDraftBattalionDefense, "decimal"],
                            ["Прорыв", draftBattalionBreakthrough, setDraftBattalionBreakthrough, "decimal"],
                            ["Организация", draftBattalionOrganization, setDraftBattalionOrganization, "decimal"],
                            ["HP", draftBattalionHp, setDraftBattalionHp, "decimal"],
                            ["Скорость", draftBattalionSpeed, setDraftBattalionSpeed, "decimal"],
                            ["Снабжение", draftBattalionSupplyUse, setDraftBattalionSupplyUse, "decimal"],
                            ["Стоимость, дукаты", draftBattalionTrainingCostDucats, setDraftBattalionTrainingCostDucats, "decimal"],
                            ["Стоимость, люди", draftBattalionTrainingCostManpower, setDraftBattalionTrainingCostManpower, "decimal"],
                          ].map(([label, value, setter, inputMode]) => (
                            <label key={label as string} className="block">
                              <span className="mb-1 block text-xs text-white/60">{label as string}</span>
                              <AppInput
                                value={value as string}
                                onChange={(e) => (setter as Dispatch<SetStateAction<string>>)(e.target.value)}
                                inputMode={inputMode as "decimal" | "numeric"}
                              />
                            </label>
                          ))}
                        </div>
                        <div className="mt-4 rounded-xl border border-white/10 bg-[#131a22] p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Требования по товарам</div>
                            <button
                              type="button"
                              onClick={() => setDraftBattalionEquipmentNeeds((prev) => [...prev, { goodId: goodsOptions[0]?.id ?? "", amount: "1", minLevel: "", maxLevel: "" }])}
                              className="rounded-md border border-emerald-400/35 bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                            >
                              Добавить
                            </button>
                          </div>
                          <div className="space-y-2">
                            {draftBattalionEquipmentNeeds.map((row, index) => (
                              <div key={`battalion-equipment-${index}`} className="grid grid-cols-[minmax(0,1fr)_110px_32px] gap-2">
                                <CustomSelect
                                  value={row.goodId}
                                  onChange={(value) =>
                                    setDraftBattalionEquipmentNeeds((prev) => prev.map((r, i) => (i === index ? { ...r, goodId: value } : r)))
                                  }
                                  options={[
                                    { value: "", label: "Выберите товар" },
                                    ...goodsOptions.map((option) => ({ value: option.id, label: option.name })),
                                  ]}
                                  buttonClassName="h-[42px]"
                                />
                                <AppInput
                                  value={row.amount}
                                  onChange={(e) =>
                                    setDraftBattalionEquipmentNeeds((prev) => prev.map((r, i) => (i === index ? { ...r, amount: e.target.value } : r)))
                                  }
                                  inputMode="decimal"
                                  placeholder="0"
                                />
                                <button
                                  type="button"
                                  onClick={() => setDraftBattalionEquipmentNeeds((prev) => prev.filter((_, i) => i !== index))}
                                  className="rounded-lg border border-rose-400/30 bg-rose-500/10 text-xs text-rose-200"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {draftBattalionEquipmentNeeds.length === 0 && <div className="text-xs text-white/45">Нет требований по товарам</div>}
                          </div>
                        </div>
                      </section>
                    )}

                    {contentSection === "economy" && activeCategory === "buildings" && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="space-y-4">
                          <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                            <button
                              type="button"
                              onClick={() => setBuildingCostOpen((v) => !v)}
                              className="mb-2 flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-left"
                            >
                              <Tooltip content="Базовые затраты на добавление одного уровня здания в очередь строительства.">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Стоимость строительства</div>
                              </Tooltip>
                              {buildingCostOpen ? (
                                <ChevronDown size={14} className="text-white/60" />
                              ) : (
                                <ChevronRight size={14} className="text-white/60" />
                              )}
                            </button>
                            <AnimatePresence initial={false}>
                            {buildingCostOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-visible"
                            >
                            <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-6">
                              <label className="block">
                                <Tooltip content="Отрасль, к которой относится здание (используется в фильтрах и группировках UI).">
                                  <span className="mb-1 block text-xs text-white/60">Отрасль</span>
                                </Tooltip>
                                <CustomSelect
                                  value={draftIndustryId}
                                  onChange={setDraftIndustryId}
                                  options={[
                                    { value: "", label: "Не указана" },
                                    ...industryOptions.map((option) => ({ value: option.id, label: option.name })),
                                  ]}
                                  buttonClassName="h-[42px]"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content="Сектор, к которому относится здание (используется в фильтрах и группировках UI).">
                                  <span className="mb-1 block text-xs text-white/60">Сектор</span>
                                </Tooltip>
                                <CustomSelect
                                  value={draftSectorId}
                                  onChange={setDraftSectorId}
                                  options={[
                                    { value: "", label: "Не указана" },
                                    ...sectorOptions.map((option) => ({ value: option.id, label: option.name })),
                                  ]}
                                  buttonClassName="h-[42px]"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content="Сколько очков строительства требуется на завершение проекта.">
                                  <span className="mb-1 block text-xs text-white/60">Очки строительства</span>
                                </Tooltip>
                                <AppInput
                                  value={draftCostConstruction}
                                  onChange={(e) => setDraftCostConstruction(e.target.value)}
                                  inputMode="numeric"
                                  placeholder="100"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content="Сколько дукатов суммарно спишется при полном завершении проекта.">
                                  <span className="mb-1 block text-xs text-white/60">Дукаты</span>
                                </Tooltip>
                                <AppInput
                                  value={draftCostDucats}
                                  onChange={(e) => setDraftCostDucats(e.target.value)}
                                  inputMode="decimal"
                                  placeholder="10"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content="Стартовый капитал здания, начисляемый сразу после завершения строительства.">
                                  <span className="mb-1 block text-xs text-white/60">Стартовые дукаты</span>
                                </Tooltip>
                                <AppInput
                                  value={draftStartingDucats}
                                  onChange={(e) => setDraftStartingDucats(e.target.value)}
                                  inputMode="decimal"
                                  placeholder="0"
                                />
                              </label>
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setBuildingUpgradeOpen((v) => !v)}
                                className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-left"
                              >
                                <Tooltip content="Параметры повышения уровня инстанса здания: потолок уровня и требования для автопостановки в очередь апгрейда.">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Повышение уровня</div>
                                </Tooltip>
                                {buildingUpgradeOpen ? (
                                  <ChevronDown size={14} className="text-white/60" />
                                ) : (
                                  <ChevronRight size={14} className="text-white/60" />
                                )}
                              </button>
                            </div>
                            <AnimatePresence initial={false}>
                            {buildingUpgradeOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-visible"
                            >
                            <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-4">
                              <label className="block">
                                <Tooltip content="Максимальный уровень одного инстанса здания. При достижении этого значения автоповышение не ставится в очередь.">
                                  <span className="mb-1 block text-xs text-white/60">Макс. уровень</span>
                                </Tooltip>
                                <AppInput
                                  value={draftMaxLevel}
                                  onChange={(e) => setDraftMaxLevel(e.target.value)}
                                  inputMode="numeric"
                                  placeholder="1"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content="Максимальная прочность инстанса здания. Прочность ограничивает потолок продуктивности.">
                                  <span className="mb-1 block text-xs text-white/60">Макс. прочность</span>
                                </Tooltip>
                                <AppInput
                                  value={draftMaxDurability}
                                  onChange={(e) => setDraftMaxDurability(e.target.value)}
                                  inputMode="decimal"
                                  placeholder="100"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content="Сколько дукатов должно быть на счёте здания для автопостановки апгрейда. Эти дукаты списываются со счёта здания сразу при постановке в очередь.">
                                  <span className="mb-1 block text-xs text-white/60">Дукаты на апгрейд</span>
                                </Tooltip>
                                <AppInput
                                  value={draftUpgradeCostDucats}
                                  onChange={(e) => setDraftUpgradeCostDucats(e.target.value)}
                                  inputMode="decimal"
                                  placeholder="10"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content="Сколько очков строительства требуется для повышения уровня. После автопостановки проект расходует очки строительства страны через обычную очередь.">
                                  <span className="mb-1 block text-xs text-white/60">Очки строительства</span>
                                </Tooltip>
                                <AppInput
                                  value={draftUpgradeCostConstruction}
                                  onChange={(e) => setDraftUpgradeCostConstruction(e.target.value)}
                                  inputMode="numeric"
                                  placeholder="100"
                                />
                              </label>
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setBuildingExtractionOpen((v) => !v)}
                                className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-left"
                              >
                                <Tooltip content={t("contentPanel.flow.extractionsTooltip")}>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("contentPanel.flow.extractions")}</div>
                                </Tooltip>
                                {buildingExtractionOpen ? (
                                  <ChevronDown size={14} className="text-white/60" />
                                ) : (
                                  <ChevronRight size={14} className="text-white/60" />
                                )}
                              </button>
                              {buildingExtractionOpen && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftExtractions((prev) => [
                                      ...prev,
                                      { goodId: goodsOptions[0]?.id ?? "", amount: "1", requiresDeposit: true, minLevel: "", maxLevel: "" },
                                    ])
                                  }
                                  className="rounded-md border border-emerald-400/35 bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                                >
                                  {t("contentPanel.flow.addExtraction")}
                                </button>
                              )}
                            </div>
                            <AnimatePresence initial={false}>
                            {buildingExtractionOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-visible"
                            >
                            <div className="space-y-2 pt-1">
                              {draftExtractions.map((row, index) => (
                                <div key={`extraction-${index}`} className="grid grid-cols-[minmax(0,1fr)_90px_90px_90px_132px_32px] gap-2">
                                  <CustomSelect
                                    value={row.goodId}
                                    onChange={(value) =>
                                      setDraftExtractions((prev) => prev.map((r, i) => (i === index ? { ...r, goodId: value } : r)))
                                    }
                                    options={[
                                      { value: "", label: t("contentPanel.flow.good") },
                                      ...goodsOptions.map((option) => ({ value: option.id, label: option.name })),
                                    ]}
                                    buttonClassName="h-[42px]"
                                  />
                                  <AppInput
                                    value={row.amount}
                                    onChange={(e) =>
                                      setDraftExtractions((prev) => prev.map((r, i) => (i === index ? { ...r, amount: e.target.value } : r)))
                                    }
                                    inputMode="decimal"
                                    placeholder={t("contentPanel.flow.amount")}
                                  />
                                  <AppInput
                                    value={row.minLevel}
                                    onChange={(e) =>
                                      setDraftExtractions((prev) => prev.map((r, i) => (i === index ? { ...r, minLevel: e.target.value } : r)))
                                    }
                                    inputMode="numeric"
                                    placeholder={t("contentPanel.flow.fromLevel")}
                                  />
                                  <AppInput
                                    value={row.maxLevel}
                                    onChange={(e) =>
                                      setDraftExtractions((prev) => prev.map((r, i) => (i === index ? { ...r, maxLevel: e.target.value } : r)))
                                    }
                                    inputMode="numeric"
                                    placeholder={t("contentPanel.flow.toLevel")}
                                  />
                                  <AppButton
                                    type="button"
                                    size="sm"
                                    variant={row.requiresDeposit ? "primary" : "secondary"}
                                    onClick={() =>
                                      setDraftExtractions((prev) =>
                                        prev.map((r, i) => (i === index ? { ...r, requiresDeposit: !r.requiresDeposit } : r)),
                                      )
                                    }
                                    className="h-[42px] justify-center text-[11px]"
                                  >
                                    {t("contentPanel.flow.requiresDeposit")}
                                  </AppButton>
                                  <button
                                    type="button"
                                    onClick={() => setDraftExtractions((prev) => prev.filter((_, i) => i !== index))}
                                    className="rounded-lg border border-rose-400/30 bg-rose-500/10 text-xs text-rose-200"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              {draftExtractions.length === 0 && <div className="text-xs text-white/45">{t("contentPanel.flow.noExtractions")}</div>}
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setBuildingInputsOpen((v) => !v)}
                                className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-left"
                              >
                                <Tooltip content={t("contentPanel.flow.inputsTooltip")}>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Входные товары</div>
                                </Tooltip>
                                {buildingInputsOpen ? (
                                  <ChevronDown size={14} className="text-white/60" />
                                ) : (
                                  <ChevronRight size={14} className="text-white/60" />
                                )}
                              </button>
                              {buildingInputsOpen && (
                                <Tooltip content="Добавить новую строку входного товара.">
                                  <button
                                    type="button"
                                    onClick={() => setDraftInputs((prev) => [...prev, { goodId: goodsOptions[0]?.id ?? "", amount: "1", minLevel: "", maxLevel: "" }])}
                                    className="rounded-md border border-emerald-400/35 bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                                  >
                                    Добавить
                                  </button>
                                </Tooltip>
                              )}
                            </div>
                            <AnimatePresence initial={false}>
                            {buildingInputsOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-visible"
                            >
                            <div className="space-y-2 pt-1">
                              {draftInputs.map((row, index) => (
                                <div key={`input-${index}`} className="grid grid-cols-[minmax(0,1fr)_110px_90px_90px_32px] gap-2">
                                  <CustomSelect
                                    value={row.goodId}
                                    onChange={(value) =>
                                      setDraftInputs((prev) => prev.map((r, i) => (i === index ? { ...r, goodId: value } : r)))
                                    }
                                    options={[
                                      { value: "", label: "Выберите товар" },
                                      ...goodsOptions.map((option) => ({ value: option.id, label: option.name })),
                                    ]}
                                    buttonClassName="h-[42px]"
                                  />
                                  <AppInput
                                    value={row.amount}
                                    onChange={(e) =>
                                      setDraftInputs((prev) => prev.map((r, i) => (i === index ? { ...r, amount: e.target.value } : r)))
                                    }
                                    inputMode="decimal"
                                    placeholder="0"
                                  />
                                  <AppInput
                                    value={row.minLevel}
                                    onChange={(e) =>
                                      setDraftInputs((prev) => prev.map((r, i) => (i === index ? { ...r, minLevel: e.target.value } : r)))
                                    }
                                    inputMode="numeric"
                                    placeholder={t("contentPanel.flow.fromLevel")}
                                  />
                                  <AppInput
                                    value={row.maxLevel}
                                    onChange={(e) =>
                                      setDraftInputs((prev) => prev.map((r, i) => (i === index ? { ...r, maxLevel: e.target.value } : r)))
                                    }
                                    inputMode="numeric"
                                    placeholder={t("contentPanel.flow.toLevel")}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setDraftInputs((prev) => prev.filter((_, i) => i !== index))}
                                    className="rounded-lg border border-rose-400/30 bg-rose-500/10 text-xs text-rose-200"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              {draftInputs.length === 0 && <div className="text-xs text-white/45">Нет входных товаров</div>}
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setBuildingOutputsOpen((v) => !v)}
                                className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-left"
                              >
                                <Tooltip content={t("contentPanel.flow.outputsTooltip")}>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Выходные товары</div>
                                </Tooltip>
                                {buildingOutputsOpen ? (
                                  <ChevronDown size={14} className="text-white/60" />
                                ) : (
                                  <ChevronRight size={14} className="text-white/60" />
                                )}
                              </button>
                              {buildingOutputsOpen && (
                                <Tooltip content="Добавить новую строку выходного товара.">
                                  <button
                                    type="button"
                                    onClick={() => setDraftOutputs((prev) => [...prev, { goodId: goodsOptions[0]?.id ?? "", amount: "1", affectedByFertility: false, minLevel: "", maxLevel: "" }])}
                                    className="rounded-md border border-emerald-400/35 bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                                  >
                                    Добавить
                                  </button>
                                </Tooltip>
                              )}
                            </div>
                            <AnimatePresence initial={false}>
                            {buildingOutputsOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-visible"
                            >
                            <div className="space-y-2 pt-1">
                              {draftOutputs.map((row, index) => (
                                <div key={`output-${index}`} className="grid grid-cols-[minmax(0,1fr)_110px_90px_90px_132px_32px] gap-2">
                                  <CustomSelect
                                    value={row.goodId}
                                    onChange={(value) =>
                                      setDraftOutputs((prev) => prev.map((r, i) => (i === index ? { ...r, goodId: value } : r)))
                                    }
                                    options={[
                                      { value: "", label: "Выберите товар" },
                                      ...goodsOptions.map((option) => ({ value: option.id, label: option.name })),
                                    ]}
                                    buttonClassName="h-[42px]"
                                  />
                                  <AppInput
                                    value={row.amount}
                                    onChange={(e) =>
                                      setDraftOutputs((prev) => prev.map((r, i) => (i === index ? { ...r, amount: e.target.value } : r)))
                                    }
                                    inputMode="decimal"
                                    placeholder="0"
                                  />
                                  <AppInput
                                    value={row.minLevel}
                                    onChange={(e) =>
                                      setDraftOutputs((prev) => prev.map((r, i) => (i === index ? { ...r, minLevel: e.target.value } : r)))
                                    }
                                    inputMode="numeric"
                                    placeholder={t("contentPanel.flow.fromLevel")}
                                  />
                                  <AppInput
                                    value={row.maxLevel}
                                    onChange={(e) =>
                                      setDraftOutputs((prev) => prev.map((r, i) => (i === index ? { ...r, maxLevel: e.target.value } : r)))
                                    }
                                    inputMode="numeric"
                                    placeholder={t("contentPanel.flow.toLevel")}
                                  />
                                  <AppButton
                                    type="button"
                                    size="sm"
                                    variant={row.affectedByFertility ? "primary" : "secondary"}
                                    onClick={() =>
                                      setDraftOutputs((prev) =>
                                        prev.map((r, i) => (i === index ? { ...r, affectedByFertility: !r.affectedByFertility } : r)),
                                      )
                                    }
                                    className="h-[42px] justify-center text-[11px]"
                                  >
                                    Плодородность
                                  </AppButton>
                                  <button
                                    type="button"
                                    onClick={() => setDraftOutputs((prev) => prev.filter((_, i) => i !== index))}
                                    className="rounded-lg border border-rose-400/30 bg-rose-500/10 text-xs text-rose-200"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              {draftOutputs.length === 0 && <div className="text-xs text-white/45">Нет выходных товаров</div>}
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setBuildingWorkforceOpen((v) => !v)}
                                className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-left"
                              >
                                <Tooltip content="Требуемые профессии и количество рабочих мест по каждой профессии.">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Профессии и рабочие места</div>
                                </Tooltip>
                                {buildingWorkforceOpen ? (
                                  <ChevronDown size={14} className="text-white/60" />
                                ) : (
                                  <ChevronRight size={14} className="text-white/60" />
                                )}
                              </button>
                              {buildingWorkforceOpen && (
                                <Tooltip content="Добавить новую строку требования по профессии.">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraftWorkforceRequirements((prev) => [
                                        ...prev,
                                        { professionId: professionOptions[0]?.id ?? "", workers: "100" },
                                      ])
                                    }
                                    className="rounded-md border border-emerald-400/35 bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                                  >
                                    Добавить
                                  </button>
                                </Tooltip>
                              )}
                            </div>
                            <AnimatePresence initial={false}>
                            {buildingWorkforceOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-visible"
                            >
                            <div className="space-y-2 pt-1">
                              {draftWorkforceRequirements.map((row, index) => (
                                <div key={`workforce-${index}`} className="grid grid-cols-[minmax(0,1fr)_110px_32px] gap-2">
                                  <CustomSelect
                                    value={row.professionId}
                                    onChange={(value) =>
                                      setDraftWorkforceRequirements((prev) =>
                                        prev.map((r, i) => (i === index ? { ...r, professionId: value } : r)),
                                      )
                                    }
                                    options={[
                                      { value: "", label: "Выберите профессию" },
                                      ...professionOptions.map((option) => ({ value: option.id, label: option.name })),
                                    ]}
                                    buttonClassName="h-[42px]"
                                  />
                                  <AppInput
                                    value={row.workers}
                                    onChange={(e) =>
                                      setDraftWorkforceRequirements((prev) =>
                                        prev.map((r, i) => (i === index ? { ...r, workers: e.target.value } : r)),
                                      )
                                    }
                                    inputMode="numeric"
                                    placeholder="0"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setDraftWorkforceRequirements((prev) => prev.filter((_, i) => i !== index))}
                                    className="rounded-lg border border-rose-400/30 bg-rose-500/10 text-xs text-rose-200"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              {draftWorkforceRequirements.length === 0 && <div className="text-xs text-white/45">Нет требований по профессиям</div>}
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                        </div>
                      </section>
                    )}

                    {contentSection === "criteria" && activeCategory === "buildings" && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="space-y-4">
                          <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                            <button
                              type="button"
                              onClick={() => setCriteriaCountriesOpen((v) => !v)}
                              className="mb-2 flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-left"
                            >
                              <Tooltip content="Настройка стран, которые могут или не могут строить это здание.">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Условия стран</div>
                              </Tooltip>
                              {criteriaCountriesOpen ? (
                                <ChevronDown size={14} className="text-white/60" />
                              ) : (
                                <ChevronRight size={14} className="text-white/60" />
                              )}
                            </button>
                            <AnimatePresence initial={false}>
                            {criteriaCountriesOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-visible"
                            >
                            <div className="grid gap-3 md:grid-cols-2 pt-1">
                              <div>
                                <Tooltip content="Мультивыбор: если список не пуст, строить смогут только страны из него (кроме явно запрещенных).">
                                  <div className="mb-1 text-[11px] text-emerald-300/90">
                                    Разрешенные страны ({allowedCountryIdsNormalized.length})
                                  </div>
                                </Tooltip>
                                <AppInput
                                  value={allowCountrySearch}
                                  onChange={(e) => setAllowCountrySearch(e.target.value)}
                                  placeholder="Поиск страны..."
                                  className="mb-2 text-xs"
                                />
                                <div className="arc-scrollbar max-h-40 space-y-1 overflow-auto pr-1">
                                  {filteredAllowCountryOptions.map((country) => {
                                    const selected = allowedCountryIdsNormalized.includes(country.id);
                                    return (
                                      <button
                                        key={`allow-country-${country.id}`}
                                        type="button"
                                        onClick={() =>
                                          setDraftAllowedCountryIds((prev) =>
                                            prev.includes(country.id)
                                              ? prev.filter((id) => id !== country.id)
                                              : [...prev, country.id],
                                          )
                                        }
                                        className={`flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-left text-xs ${
                                          selected
                                            ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-200"
                                            : "border-white/10 bg-black/25 text-white/70"
                                        }`}
                                      >
                                        <span className="truncate">{country.name}</span>
                                        <span className={selected ? "text-emerald-200" : "text-white/35"}>{selected ? "✓" : "○"}</span>
                                      </button>
                                    );
                                  })}
                                  {filteredAllowCountryOptions.length === 0 && (
                                    <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-xs text-white/45">
                                      Страны не найдены
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <Tooltip content="Страны из этого списка не смогут строить здание, даже если они есть в разрешенных.">
                                  <div className="mb-1 text-[11px] text-red-300/90">
                                    Запрещенные страны ({deniedCountryIdsNormalized.length})
                                  </div>
                                </Tooltip>
                                <AppInput
                                  value={denyCountrySearch}
                                  onChange={(e) => setDenyCountrySearch(e.target.value)}
                                  placeholder="Поиск страны..."
                                  className="mb-2 text-xs"
                                />
                                <div className="arc-scrollbar max-h-40 space-y-1 overflow-auto pr-1">
                                  {filteredDenyCountryOptions.map((country) => {
                                    const selected = deniedCountryIdsNormalized.includes(country.id);
                                    return (
                                      <button
                                        key={`deny-country-${country.id}`}
                                        type="button"
                                        onClick={() =>
                                          setDraftDeniedCountryIds((prev) =>
                                            prev.includes(country.id)
                                              ? prev.filter((id) => id !== country.id)
                                              : [...prev, country.id],
                                          )
                                        }
                                        className={`flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-left text-xs ${
                                          selected
                                            ? "border-red-400/45 bg-red-500/15 text-red-200"
                                            : "border-white/10 bg-black/25 text-white/70"
                                        }`}
                                      >
                                        <span className="truncate">{country.name}</span>
                                        <span className={selected ? "text-red-200" : "text-white/35"}>{selected ? "✓" : "○"}</span>
                                      </button>
                                    );
                                  })}
                                  {filteredDenyCountryOptions.length === 0 && (
                                    <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-xs text-white/45">
                                      Страны не найдены
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            {conflictingCountryNames.length > 0 && (
                              <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200">
                                Конфликт критериев: страна одновременно в allow и deny: {conflictingCountryNames.join(", ")}
                              </div>
                            )}
                            <div className="mt-2 text-[11px] text-white/45">
                              Если список разрешенных пуст, строить могут все страны, кроме запрещенных.
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                            <button
                              type="button"
                              onClick={() => setCriteriaProvinceOpen((v) => !v)}
                              className="mb-2 flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-left"
                            >
                              <Tooltip content="Ограничения по данным провинции из GeoJSON: тип, климат, ландшафт, континент, стратегический регион и радиация.">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Условия провинции</div>
                              </Tooltip>
                              {criteriaProvinceOpen ? (
                                <ChevronDown size={14} className="text-white/60" />
                              ) : (
                                <ChevronRight size={14} className="text-white/60" />
                              )}
                            </button>
                            <AnimatePresence initial={false}>
                            {criteriaProvinceOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-visible"
                            >
                              <div className="grid gap-3 md:grid-cols-2">
                                {renderProvinceContentPicker("Разрешенные типы провинции", provinceTypeOptions, draftAllowedProvinceTypes, setDraftAllowedProvinceTypes)}
                                {renderProvinceContentPicker("Запрещенные типы провинции", provinceTypeOptions, draftDeniedProvinceTypes, setDraftDeniedProvinceTypes)}
                                {renderProvinceContentPicker("Разрешенный климат", provinceClimateOptions, draftAllowedClimates, setDraftAllowedClimates)}
                                {renderProvinceContentPicker("Запрещенный климат", provinceClimateOptions, draftDeniedClimates, setDraftDeniedClimates)}
                                {renderProvinceContentPicker("Разрешенный ландшафт", provinceLandscapeOptions, draftAllowedLandscapes, setDraftAllowedLandscapes)}
                                {renderProvinceContentPicker("Запрещенный ландшафт", provinceLandscapeOptions, draftDeniedLandscapes, setDraftDeniedLandscapes)}
                                {renderProvinceContentPicker("Разрешенные континенты", provinceContinentOptions, draftAllowedContinents, setDraftAllowedContinents)}
                                {renderProvinceContentPicker("Запрещенные континенты", provinceContinentOptions, draftDeniedContinents, setDraftDeniedContinents)}
                                {renderProvinceContentPicker("Разрешенные стратегические регионы", provinceStrategicRegionOptions, draftAllowedStrategicRegions, setDraftAllowedStrategicRegions)}
                                {renderProvinceContentPicker("Запрещенные стратегические регионы", provinceStrategicRegionOptions, draftDeniedStrategicRegions, setDraftDeniedStrategicRegions)}
                                <label className="block">
                                  <span className="mb-1 block text-xs text-white/60">Минимальная радиация</span>
                                  <AppInput value={draftMinRadiation} onChange={(e) => setDraftMinRadiation(e.target.value)} inputMode="decimal" placeholder="Пусто = нет минимума" />
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs text-white/60">Максимальная радиация</span>
                                  <AppInput value={draftMaxRadiation} onChange={(e) => setDraftMaxRadiation(e.target.value)} inputMode="decimal" placeholder="Пусто = нет максимума" />
                                </label>
                                <label className="block md:col-span-2">
                                  <span className="mb-1 block text-xs text-white/60">Влияние загрязнения на производительность</span>
                                  <CustomSelect
                                    value={draftPollutionProductivityMode}
                                    onChange={(value) => setDraftPollutionProductivityMode(value as PollutionProductivityModeDraft)}
                                    options={[
                                      { value: "penalty", label: "Штраф" },
                                      { value: "bonus", label: "Бонус" },
                                      { value: "ignore", label: "Не влияет" },
                                    ]}
                                    buttonClassName="h-[42px]"
                                  />
                                </label>
                              </div>
                              <div className="mt-2 text-[11px] text-white/45">
                                Значения выбираются из категорий контента. Пустой список разрешений означает любое значение, запрет сильнее разрешения.
                              </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                            <button
                              type="button"
                              onClick={() => setCriteriaLimitsOpen((v) => !v)}
                              className="mb-2 flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-left"
                            >
                              <Tooltip content="Лимиты работают как cap на текущее количество построенных и строящихся зданий.">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Лимиты количества</div>
                              </Tooltip>
                              {criteriaLimitsOpen ? (
                                <ChevronDown size={14} className="text-white/60" />
                              ) : (
                                <ChevronRight size={14} className="text-white/60" />
                              )}
                            </button>
                            <AnimatePresence initial={false}>
                            {criteriaLimitsOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-visible"
                            >
                            <div className="mb-3">
                              <label className="block">
                                <Tooltip content="Пусто = без ограничений. Справа показан текущий счётчик: использовано/лимит.">
                                  <span className="mb-1 block text-xs text-white/60">
                                    Глобальный лимит (для всего мира):{" "}
                                    <span className="text-amber-300/90">
                                      {selectedBuildingGlobalUsage}/
                                      {draftGlobalBuildLimit.trim().length > 0 &&
                                      Number.isFinite(Number(draftGlobalBuildLimit)) &&
                                      Number(draftGlobalBuildLimit) > 0
                                        ? Math.max(1, Math.floor(Number(draftGlobalBuildLimit)))
                                        : "∞"}
                                    </span>
                                  </span>
                                </Tooltip>
                                <AppInput
                                  value={draftGlobalBuildLimit}
                                  onChange={(e) => setDraftGlobalBuildLimit(e.target.value)}
                                  inputMode="numeric"
                                  placeholder="Пусто = без лимита"
                                />
                              </label>
                            </div>
                            <div className="mb-2 flex items-center justify-between">
                              <Tooltip content="Лимит на конкретную страну. Формат счётчика: текущее значение/лимит.">
                                <div className="text-xs text-white/60">Лимиты для конкретных государств</div>
                              </Tooltip>
                              <button
                                type="button"
                                onClick={() => setDraftCountryBuildLimits((prev) => [...prev, { countryId: "", limit: "" }])}
                                className="rounded-md border border-emerald-400/35 bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                              >
                                Добавить лимит
                              </button>
                            </div>
                            <div className="space-y-2">
                              {draftCountryBuildLimits.map((row, index) => (
                                <div key={`country-limit-${index}`} className="grid grid-cols-[minmax(0,1fr)_120px_32px] gap-2">
                                  <CustomSelect
                                    value={row.countryId}
                                    onChange={(value) =>
                                      setDraftCountryBuildLimits((prev) =>
                                        prev.map((item, i) => (i === index ? { ...item, countryId: value } : item)),
                                      )
                                    }
                                    options={[
                                      { value: "", label: "Выберите страну" },
                                      ...countryOptions.map((country) => ({ value: country.id, label: country.name })),
                                    ]}
                                    buttonClassName="h-[42px]"
                                  />
                                  <AppInput
                                    value={row.limit}
                                    onChange={(e) =>
                                      setDraftCountryBuildLimits((prev) =>
                                        prev.map((item, i) => (i === index ? { ...item, limit: e.target.value } : item)),
                                      )
                                    }
                                    inputMode="numeric"
                                    placeholder="Пусто или 0 = без лимита"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setDraftCountryBuildLimits((prev) => prev.filter((_, i) => i !== index))}
                                    className="rounded-lg border border-rose-400/30 bg-rose-500/10 text-xs text-rose-200"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              {draftCountryBuildLimits.map((row, index) => {
                                const used = row.countryId ? Math.max(0, Math.floor(selectedBuildingUsageByCountry[row.countryId] ?? 0)) : 0;
                                const parsedLimit = Number(row.limit);
                                const limit =
                                  row.limit.trim().length > 0 && Number.isFinite(parsedLimit) && parsedLimit > 0
                                    ? Math.max(1, Math.floor(parsedLimit))
                                    : null;
                                return (
                                  <div key={`country-limit-usage-${index}`} className="text-[11px] text-white/50">
                                    {(countryOptions.find((country) => country.id === row.countryId)?.name ?? row.countryId ?? "Страна")}:
                                    {" "}
                                    <span className="text-amber-300/90">{used}/{limit ?? "∞"}</span>
                                  </div>
                                );
                              })}
                              {draftCountryBuildLimits.length === 0 && (
                                <div className="text-xs text-white/45">Нет лимитов по странам</div>
                              )}
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>
                        </div>
                      </section>
                    )}

                    {contentSection === "economy" && activeCategory === "goods" && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                          <button
                            type="button"
                            onClick={() => setGoodsEconomyOpen((v) => !v)}
                            className="mb-2 flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-left"
                          >
                            <Tooltip content="Параметры товара для экономической модели до подключения полноценного рынка.">
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Экономика товара</div>
                            </Tooltip>
                            {goodsEconomyOpen ? (
                              <ChevronDown size={14} className="text-white/60" />
                            ) : (
                              <ChevronRight size={14} className="text-white/60" />
                            )}
                          </button>
                          <AnimatePresence initial={false}>
                          {goodsEconomyOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-visible"
                            >
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                                <label className="block">
                                  <Tooltip content="Базовая цена единицы товара. Сейчас используется как заглушка для расчетов.">
                                    <span className="mb-1 block text-xs text-white/60">Базовая цена</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftBasePrice}
                                    onChange={(e) => setDraftBasePrice(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="1"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content="Минимальная граница цены товара на рынке.">
                                    <span className="mb-1 block text-xs text-white/60">Мин. цена</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftMinPrice}
                                    onChange={(e) => setDraftMinPrice(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="0.1"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content="Максимальная граница цены товара на рынке.">
                                    <span className="mb-1 block text-xs text-white/60">Макс. цена</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftMaxPrice}
                                    onChange={(e) => setDraftMaxPrice(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="10"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content="Сколько инфраструктуры расходуется на перевозку 1 единицы товара (покупка или продажа).">
                                    <span className="mb-1 block text-xs text-white/60">Инфра за 1 ед.</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftInfraPerUnit}
                                    onChange={(e) => setDraftInfraPerUnit(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="1"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content="Категория инфраструктуры для логистических лимитов. Если пусто, инфраструктура не ограничивает торговлю этим товаром.">
                                    <span className="mb-1 block text-xs text-white/60">Категория инфраструктуры</span>
                                  </Tooltip>
                                  <CustomSelect
                                    value={draftResourceCategoryId}
                                    onChange={setDraftResourceCategoryId}
                                    options={[
                                      { value: "", label: "Без категории" },
                                      ...resourceCategoryOptions.map((option) => ({ value: option.id, label: option.name })),
                                    ]}
                                    buttonClassName="h-[42px]"
                                  />
                                </label>
                              </div>
                              <Tooltip content="После внедрения рынка это значение будет стартовой/референсной ценой.">
                                <div className="mt-1 text-[11px] text-white/45">Используется как заглушка цены до внедрения рынка.</div>
                              </Tooltip>
                              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                <label className="block">
                                  <Tooltip content="Определяет, может ли товар перевозиться рынком или должен использоваться локально/через специальную сеть.">
                                    <span className="mb-1 block text-xs text-white/60">Тип распределения</span>
                                  </Tooltip>
                                  <CustomSelect
                                    value={draftDistributionType}
                                    onChange={(value) => {
                                      const nextValue = GOOD_DISTRIBUTION_OPTIONS.some((option) => option.value === value)
                                        ? (value as DraftGoodDistributionType)
                                        : "tradeable";
                                      setDraftDistributionType(nextValue);
                                      if (nextValue === "service" || nextValue === "localOnly") setDraftTransportModes([]);
                                      if (nextValue === "pipeline") setDraftTransportModes(["pipeline"]);
                                      if (nextValue === "powerGrid") setDraftTransportModes(["powerGrid"]);
                                      if (nextValue === "tradeable" && draftTransportModes.length === 0) setDraftTransportModes(["land", "sea", "air"]);
                                    }}
                                    options={GOOD_DISTRIBUTION_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                                    buttonClassName="h-[42px]"
                                  />
                                </label>
                                <div>
                                  <Tooltip content="Какие транспортные сети разрешены для этого товара. Для услуг и локальных товаров перевозка отключена.">
                                    <span className="mb-1 block text-xs text-white/60">Разрешённый транспорт</span>
                                  </Tooltip>
                                  <div className="flex flex-wrap gap-2">
                                    {GOOD_TRANSPORT_OPTIONS.map((option) => {
                                      const locked =
                                        draftDistributionType === "service" ||
                                        draftDistributionType === "localOnly" ||
                                        (draftDistributionType === "pipeline" && option.value !== "pipeline") ||
                                        (draftDistributionType === "powerGrid" && option.value !== "powerGrid");
                                      const checked = draftTransportModes.includes(option.value);
                                      return (
                                        <button
                                          key={option.value}
                                          type="button"
                                          disabled={locked}
                                          onClick={() =>
                                            setDraftTransportModes((current) =>
                                              current.includes(option.value)
                                                ? current.filter((mode) => mode !== option.value)
                                                : [...current, option.value],
                                            )
                                          }
                                          className={`rounded-lg border px-2.5 py-1.5 text-xs transition disabled:opacity-40 ${
                                            checked
                                              ? "border-arc-accent/40 bg-arc-accent/15 text-arc-accent"
                                              : "border-white/10 bg-black/25 text-white/55 hover:border-white/20 hover:text-white/75"
                                          }`}
                                        >
                                          {option.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ) : null}
                          </AnimatePresence>
                        </div>
                      </section>
                    )}

                    {contentSection === "exploration" && activeCategory === "goods" && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                          <button
                            type="button"
                            onClick={() => setGoodsExplorationOpen((v) => !v)}
                            className="mb-2 flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-left"
                          >
                            <Tooltip content="Параметры генерации залежей этого товара при георазведке.">
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Георазведка товара</div>
                            </Tooltip>
                            {goodsExplorationOpen ? (
                              <ChevronDown size={14} className="text-white/60" />
                            ) : (
                              <ChevronRight size={14} className="text-white/60" />
                            )}
                          </button>
                          <AnimatePresence initial={false}>
                          {goodsExplorationOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-visible"
                            >
                              <label className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={draftIsResourceDiscoverable}
                                  onChange={(e) => setDraftIsResourceDiscoverable(e.target.checked)}
                                  className="h-4 w-4 rounded border-white/20 bg-black/60 accent-emerald-400"
                                />
                                <span className="text-xs text-white/80">Можно найти в провинции как ресурс</span>
                              </label>
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                                <label className="block">
                                  <Tooltip content="Базовый вес товара при розыгрыше найденного ресурса. Чем выше, тем чаще выпадает.">
                                    <span className="mb-1 block text-xs text-white/60">Базовый вес</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftExplorationBaseWeight}
                                    onChange={(e) => setDraftExplorationBaseWeight(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="1"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content="Шанс маленькой жилы (в %). Нормализуется вместе с другими шансами.">
                                    <span className="mb-1 block text-xs text-white/60">Малая жила, %</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftExplorationSmallChance}
                                    onChange={(e) => setDraftExplorationSmallChance(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="60"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content="Шанс средней жилы (в %). Нормализуется вместе с другими шансами.">
                                    <span className="mb-1 block text-xs text-white/60">Средняя жила, %</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftExplorationMediumChance}
                                    onChange={(e) => setDraftExplorationMediumChance(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="30"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content="Шанс крупной жилы (в %). Нормализуется вместе с другими шансами.">
                                    <span className="mb-1 block text-xs text-white/60">Крупная жила, %</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftExplorationLargeChance}
                                    onChange={(e) => setDraftExplorationLargeChance(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="10"
                                  />
                                </label>
                              </div>
                              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                                <label className="block">
                                  <Tooltip content="Диапазон количества для маленькой жилы.">
                                    <span className="mb-1 block text-xs text-white/60">Малая: мин / макс</span>
                                  </Tooltip>
                                  <div className="grid grid-cols-2 gap-2">
                                    <AppInput
                                      value={draftExplorationSmallMin}
                                      onChange={(e) => setDraftExplorationSmallMin(e.target.value)}
                                      inputMode="decimal"
                                      placeholder="10"
                                    />
                                    <AppInput
                                      value={draftExplorationSmallMax}
                                      onChange={(e) => setDraftExplorationSmallMax(e.target.value)}
                                      inputMode="decimal"
                                      placeholder="100"
                                    />
                                  </div>
                                </label>
                                <label className="block">
                                  <Tooltip content="Диапазон количества для средней жилы.">
                                    <span className="mb-1 block text-xs text-white/60">Средняя: мин / макс</span>
                                  </Tooltip>
                                  <div className="grid grid-cols-2 gap-2">
                                    <AppInput
                                      value={draftExplorationMediumMin}
                                      onChange={(e) => setDraftExplorationMediumMin(e.target.value)}
                                      inputMode="decimal"
                                      placeholder="100"
                                    />
                                    <AppInput
                                      value={draftExplorationMediumMax}
                                      onChange={(e) => setDraftExplorationMediumMax(e.target.value)}
                                      inputMode="decimal"
                                      placeholder="500"
                                    />
                                  </div>
                                </label>
                                <label className="block">
                                  <Tooltip content="Диапазон количества для крупной жилы.">
                                    <span className="mb-1 block text-xs text-white/60">Крупная: мин / макс</span>
                                  </Tooltip>
                                  <div className="grid grid-cols-2 gap-2">
                                    <AppInput
                                      value={draftExplorationLargeMin}
                                      onChange={(e) => setDraftExplorationLargeMin(e.target.value)}
                                      inputMode="decimal"
                                      placeholder="500"
                                    />
                                    <AppInput
                                      value={draftExplorationLargeMax}
                                      onChange={(e) => setDraftExplorationLargeMax(e.target.value)}
                                      inputMode="decimal"
                                      placeholder="2000"
                                    />
                                  </div>
                                </label>
                              </div>
                            </motion.div>
                          ) : null}
                          </AnimatePresence>
                        </div>
                      </section>
                    )}

                    {contentSection === "economy" && activeCategory === "professions" && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                          <Tooltip content="Базовая зарплата за одного работника профессии за ход. Используется при расчете затрат зданий.">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Экономика профессии
                            </span>
                          </Tooltip>
                          <label className="block">
                            <Tooltip content="Базовая ставка оплаты труда для этой профессии.">
                              <span className="mb-1 block text-xs text-white/60">Базовая зарплата</span>
                            </Tooltip>
                            <AppInput
                              value={draftBaseWage}
                              onChange={(e) => setDraftBaseWage(e.target.value)}
                              inputMode="decimal"
                              placeholder="1"
                            />
                          </label>
                        </div>
                      </section>
                    )}

                    {contentSection === "needs" && activeCategory === "cultures" && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">Потребности культуры</div>
                            <div className="text-xs text-white/50">Тиры включаются по уровню жизни, внутри потребностей товары работают как заменители.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setDraftNeedsProfile((prev) => [
                                ...prev,
                                {
                                  id: `tier-${prev.length + 1}`,
                                  minStandardOfLiving: "0",
                                  needs: [
                                    {
                                      id: "basic-food",
                                      label: "Базовая еда",
                                      category: "survival",
                                      amountPerPerson: "0.01",
                                      weight: "1",
                                      goods: [{ goodId: goodsOptions[0]?.id ?? "", weight: "1" }],
                                    },
                                  ],
                                },
                              ])
                            }
                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-arc-accent px-3 text-xs font-semibold text-black"
                          >
                            <Plus size={14} />
                            Добавить тир
                          </button>
                        </div>
                        <div className="space-y-3">
                          {draftNeedsProfile.map((tier, tierIndex) => (
                            <div key={`${tier.id}-${tierIndex}`} className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                              <div className="mb-3 grid gap-2 md:grid-cols-[1fr_160px_auto]">
                                <label>
                                  <span className="mb-1 block text-xs text-white/60">ID тира</span>
                                  <AppInput
                                    value={tier.id}
                                    onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => (i === tierIndex ? { ...row, id: e.target.value } : row)))}
                                  />
                                </label>
                                <label>
                                  <span className="mb-1 block text-xs text-white/60">Мин. уровень жизни</span>
                                  <AppInput
                                    value={tier.minStandardOfLiving}
                                    onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => (i === tierIndex ? { ...row, minStandardOfLiving: e.target.value } : row)))}
                                    inputMode="decimal"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setDraftNeedsProfile((prev) => prev.filter((_, i) => i !== tierIndex))}
                                  className="self-end rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200"
                                >
                                  Удалить
                                </button>
                              </div>
                              <div className="space-y-2">
                                {tier.needs.map((need, needIndex) => (
                                  <div key={`${need.id}-${needIndex}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
                                    <div className="grid gap-2 md:grid-cols-5">
                                      <label>
                                        <span className="mb-1 block text-xs text-white/60">ID</span>
                                        <AppInput
                                          value={need.id}
                                          onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, id: e.target.value } : n) } : row))}
                                        />
                                      </label>
                                      <label>
                                        <span className="mb-1 block text-xs text-white/60">Название</span>
                                        <AppInput
                                          value={need.label}
                                          onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, label: e.target.value } : n) } : row))}
                                        />
                                      </label>
                                      <label>
                                        <span className="mb-1 block text-xs text-white/60">Категория</span>
                                        <CustomSelect
                                          value={need.category}
                                          onChange={(value) =>
                                            setDraftNeedsProfile((prev) =>
                                              prev.map((row, i) =>
                                                i === tierIndex
                                                  ? {
                                                      ...row,
                                                      needs: row.needs.map((n, j) =>
                                                        j === needIndex
                                                          ? { ...n, category: value as CultureNeedDraft["category"] }
                                                          : n,
                                                      ),
                                                    }
                                                  : row,
                                              ),
                                            )
                                          }
                                          options={NEED_CATEGORY_OPTIONS.map((item) => ({
                                            value: item.value,
                                            label: item.label,
                                          }))}
                                          placeholder="Категория"
                                        />
                                      </label>
                                      <label>
                                        <span className="mb-1 block text-xs text-white/60">На человека</span>
                                        <AppInput
                                          value={need.amountPerPerson}
                                          onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, amountPerPerson: e.target.value } : n) } : row))}
                                          inputMode="decimal"
                                        />
                                      </label>
                                      <label>
                                        <span className="mb-1 block text-xs text-white/60">Вес</span>
                                        <AppInput
                                          value={need.weight}
                                          onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, weight: e.target.value } : n) } : row))}
                                          inputMode="decimal"
                                        />
                                      </label>
                                    </div>
                                    <div className="mt-2 space-y-2">
                                      {need.goods.map((good, goodIndex) => (
                                        <div key={goodIndex} className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
                                          <CustomSelect
                                            value={good.goodId}
                                            onChange={(value) => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, goods: n.goods.map((g, k) => k === goodIndex ? { ...g, goodId: value } : g) } : n) } : row))}
                                            options={goodsOptions.map((item) => ({ value: item.id, label: item.name }))}
                                            placeholder="Товар"
                                          />
                                          <AppInput
                                            value={good.weight}
                                            onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, goods: n.goods.map((g, k) => k === goodIndex ? { ...g, weight: e.target.value } : g) } : n) } : row))}
                                            inputMode="decimal"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, goods: n.goods.filter((_, k) => k !== goodIndex) } : n) } : row))}
                                            className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200"
                                          >
                                            Удалить
                                          </button>
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, goods: [...n.goods, { goodId: goodsOptions[0]?.id ?? "", weight: "1" }] } : n) } : row))}
                                        className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/80"
                                      >
                                        Добавить товар-заменитель
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.filter((_, j) => j !== needIndex) } : row))}
                                      className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200"
                                    >
                                      Удалить потребность
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: [...row.needs, { id: `need-${row.needs.length + 1}`, label: "Новая потребность", category: "basic", amountPerPerson: "0.01", weight: "1", goods: [{ goodId: goodsOptions[0]?.id ?? "", weight: "1" }] }] } : row))}
                                  className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/80"
                                >
                                  Добавить потребность
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {contentSection === "branding" && (
                      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <Tooltip content={activeCategory === "events" || activeCategory === "decisions" ? "Изображение показывается в сюжетном окне. Максимальный размер: 1080x970." : "Логотип показывается в списках и карточках. Максимальный размер файла: 64x64."}>
                          <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {activeCategory === "events" || activeCategory === "decisions" ? "Изображение" : "Логотип"}
                          </span>
                        </Tooltip>
                        <div className="flex flex-wrap items-start gap-4">
                          <div className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#131a22]">
                            {draftLogoUrl ? (
                              <img src={draftLogoUrl} alt="Логотип записи" className="h-full w-full object-contain p-1" />
                            ) : (
                              <span className="text-xs font-semibold" style={{ color: draftColor }}>
                                {draftName.trim().slice(0, 1).toUpperCase() || "К"}
                              </span>
                            )}
                          </div>
                          <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                            <Tooltip content={activeCategory === "events" || activeCategory === "decisions" ? "Поддерживаются PNG, SVG, WEBP и JPEG. Размер изображения не больше 1080x970." : "Поддерживаются PNG, SVG, WEBP и JPEG. Размер изображения не больше 64x64."}>
                              <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-arc-accent px-3 text-sm font-semibold text-black transition hover:brightness-110">
                                <Upload size={14} />
                                {activeCategory === "events" || activeCategory === "decisions" ? "Загрузить изображение" : "Загрузить логотип"}
                                <input
                                  type="file"
                                  accept="image/png,image/svg+xml,image/webp,image/jpeg"
                                  className="hidden"
                                  onChange={(e) => void uploadLogo(e.target.files?.[0] ?? null)}
                                />
                              </label>
                            </Tooltip>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!selectedEntry) return;
                                try {
                                  setSaving(true);
                                  const result = await adminDeleteContentEntryLogo(token, activeCategory, selectedEntry.id);
                                  setEntries(result.items);
                                  setDraftLogoUrl(result.item.logoUrl);
                                  setSavedSnapshot(buildSnapshot(result.item));
                                } catch {
                                  toast.error("Не удалось удалить логотип");
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={!selectedEntry || saving}
                              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 text-sm font-semibold text-rose-200 transition hover:border-rose-300/50 hover:bg-rose-400/15 disabled:opacity-50"
                            >
                              {activeCategory === "events" || activeCategory === "decisions" ? "Удалить изображение" : "Удалить логотип"}
                            </button>
                            <div className="text-xs text-white/50">
                              {activeCategory === "events" || activeCategory === "decisions" ? "Максимум 1080x970. Рекомендуется WEBP или JPEG." : "Максимум 64x64. Рекомендуется PNG или SVG."}
                            </div>
                          </div>
                        </div>
                        {activeCategory === "races" && (
                          <div className="mt-4 border-t border-white/10 pt-4">
                            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Портреты расы</div>
                            <div className="grid gap-4 md:grid-cols-2">
                              {([
                                { slot: "male", label: "Мужской портрет", url: draftMalePortraitUrl },
                                { slot: "female", label: "Женский портрет", url: draftFemalePortraitUrl },
                              ] as const).map((portrait) => (
                                <div key={portrait.slot} className="rounded-xl border border-white/10 bg-[#131a22] p-3">
                                  <div className="mb-2 text-[11px] text-white/60">{portrait.label}</div>
                                  <div className="mb-3 flex h-[100px] w-[89px] items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30">
                                    {portrait.url ? (
                                      <img src={portrait.url} alt={portrait.label} className="h-full w-full object-cover" />
                                    ) : (
                                      <span className="text-[10px] text-white/45">89x100</span>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <label className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-arc-accent px-3 text-xs font-semibold text-black transition hover:brightness-110">
                                      <Upload size={13} />
                                      Загрузить
                                      <input
                                        type="file"
                                        accept="image/png,image/webp,image/jpeg"
                                        className="hidden"
                                        onChange={(e) => void uploadRacePortraitSlot(portrait.slot, e.target.files?.[0] ?? null)}
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!selectedEntry) return;
                                        try {
                                          setSaving(true);
                                          const result = await adminDeleteRacePortrait(token, selectedEntry.id, portrait.slot);
                                          setEntries(result.items);
                                          setSavedSnapshot(buildSnapshot(result.item));
                                          setDraftMalePortraitUrl(result.item.malePortraitUrl ?? null);
                                          setDraftFemalePortraitUrl(result.item.femalePortraitUrl ?? null);
                                        } catch {
                                          toast.error("Не удалось удалить портрет");
                                        } finally {
                                          setSaving(false);
                                        }
                                      }}
                                      disabled={!selectedEntry || saving}
                                      className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition hover:border-rose-300/50 hover:bg-rose-400/15 disabled:opacity-50"
                                    >
                                      Удалить
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 text-xs text-white/50">Размер портретов: максимум 89x100.</div>
                          </div>
                        )}
                      </section>
                    )}
                  </div>

                </div>
              </div>
              </div>
            </div>
      </AppModal>

      <AppModal
        modalKey="content"
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        zIndexClassName="z-[206]"
        panelClassName="h-auto w-full max-w-md"
        paddingClassName="p-4 flex items-center justify-center"
      >
              <AppModalHeader title="Удалить запись?" onClose={() => setDeleteConfirmOpen(false)} />
              <div className="mt-2 text-sm text-white/70">
                Запись <span className="font-semibold text-white">«{selectedEntry?.name ?? "Без названия"}»</span> будет удалена.
              </div>
              <div className="mt-1 text-xs text-white/45">Это действие удалит и логотип, если он загружен.</div>
              <div className="mt-4 flex justify-end gap-2">
                <AppButton
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  variant="ghost"
                >
                  Отмена
                </AppButton>
                <AppButton
                  type="button"
                  onClick={() => void deleteEntry()}
                  disabled={saving}
                  variant="danger"
                >
                  Удалить
                </AppButton>
              </div>
      </AppModal>

      <AppModal
        modalKey="content"
        open={closeConfirmOpen}
        onClose={() => setCloseConfirmOpen(false)}
        zIndexClassName="z-[206]"
        panelClassName="h-auto w-full max-w-md"
        paddingClassName="p-4 flex items-center justify-center"
      >
              <AppModalHeader title="Закрыть панель контента?" onClose={() => setCloseConfirmOpen(false)} />
              <AppCard className="mt-2 bg-black/25 text-sm text-white/70">Есть несохранённые изменения в выбранной записи.</AppCard>
              <div className="mt-4 flex justify-end gap-2">
                <AppButton
                  type="button"
                  onClick={() => setCloseConfirmOpen(false)}
                  variant="ghost"
                >
                  Остаться
                </AppButton>
                <AppButton
                  type="button"
                  onClick={() => {
                    setCloseConfirmOpen(false);
                    onClose();
                  }}
                  variant="danger"
                >
                  Закрыть без сохранения
                </AppButton>
              </div>
      </AppModal>
    </>
  );
}
