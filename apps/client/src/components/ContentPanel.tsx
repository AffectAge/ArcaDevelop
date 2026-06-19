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
import type { UiTextKey } from "../i18n/uiText";
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
  { value: "tradeable", labelKey: "contentPanel.option.goodDistribution.tradeable" },
  { value: "localOnly", labelKey: "contentPanel.option.goodDistribution.localOnly" },
  { value: "pipeline", labelKey: "contentPanel.option.goodDistribution.pipeline" },
  { value: "powerGrid", labelKey: "contentPanel.option.goodDistribution.powerGrid" },
  { value: "service", labelKey: "contentPanel.option.goodDistribution.service" },
] as const;
const GOOD_TRANSPORT_OPTIONS = [
  { value: "land", labelKey: "contentPanel.option.transport.land" },
  { value: "sea", labelKey: "contentPanel.option.transport.sea" },
  { value: "air", labelKey: "contentPanel.option.transport.air" },
  { value: "pipeline", labelKey: "contentPanel.option.transport.pipeline" },
  { value: "powerGrid", labelKey: "contentPanel.option.transport.powerGrid" },
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
      labelKey: "contentPanel.category.cultures",
      icon: Palette,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "needs", labelKey: "contentPanel.section.needs", icon: Package },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "religions",
      labelKey: "contentPanel.category.religions",
      icon: ScrollText,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "politics", labelKey: "contentPanel.section.influence", icon: Landmark },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "races",
      labelKey: "contentPanel.category.races",
      icon: UserRound,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "politics", labelKey: "contentPanel.section.influence", icon: Landmark },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "resourceCategories",
      labelKey: "contentPanel.category.resourceCategories",
      icon: Package,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "provinceTypes",
      labelKey: "contentPanel.category.provinceTypes",
      icon: Landmark,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "provinceClimates",
      labelKey: "contentPanel.category.provinceClimates",
      icon: Flame,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "provinceLandscapes",
      labelKey: "contentPanel.category.provinceLandscapes",
      icon: Network,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "provinceContinents",
      labelKey: "contentPanel.category.provinceContinents",
      icon: Landmark,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "provinceStrategicRegions",
      labelKey: "contentPanel.category.provinceStrategicRegions",
      icon: Network,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "professions",
      labelKey: "contentPanel.category.professions",
      icon: Briefcase,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "economy", labelKey: "contentPanel.section.professionEconomy", icon: Factory },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "battalions",
      labelKey: "contentPanel.category.battalions",
      icon: Shield,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "economy", labelKey: "contentPanel.section.stats", icon: Shield },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "shipTypes",
      labelKey: "contentPanel.category.shipTypes",
      icon: Ship,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "economy", labelKey: "contentPanel.section.stats", icon: Ship },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "aircraftTypes",
      labelKey: "contentPanel.category.aircraftTypes",
      icon: Plane,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "economy", labelKey: "contentPanel.section.stats", icon: Plane },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "ideologies",
      labelKey: "contentPanel.category.ideologies",
      icon: Flame,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "politics", labelKey: "contentPanel.section.influence", icon: Landmark },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "interestGroups",
      labelKey: "contentPanel.category.interestGroups",
      icon: Landmark,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "politics", labelKey: "contentPanel.section.politics", icon: Landmark },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "parties",
      labelKey: "contentPanel.category.parties",
      icon: Vote,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "politics", labelKey: "contentPanel.section.politics", icon: Landmark },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "lawGroups",
      labelKey: "contentPanel.category.lawGroups",
      icon: Landmark,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "politics", labelKey: "contentPanel.section.politics", icon: Landmark },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "laws",
      labelKey: "contentPanel.category.laws",
      icon: ScrollText,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "politics", labelKey: "contentPanel.section.politics", icon: Landmark },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "technologies",
      labelKey: "contentPanel.category.technologies",
      icon: Network,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "technology", labelKey: "contentPanel.section.technologyTree", icon: Network },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "buildings",
      labelKey: "contentPanel.category.buildings",
      icon: Building2,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "economy", labelKey: "contentPanel.section.economyProduction", icon: Factory },
        { id: "criteria", labelKey: "contentPanel.section.criteria", icon: ScrollText },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "goods",
      labelKey: "contentPanel.category.goods",
      icon: Package,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "economy", labelKey: "contentPanel.section.goodEconomy", icon: Factory },
        { id: "exploration", labelKey: "contentPanel.section.exploration", icon: Telescope },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "companies",
      labelKey: "contentPanel.category.companies",
      icon: Briefcase,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "industries",
      labelKey: "contentPanel.category.industries",
      icon: Factory,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "sectors",
      labelKey: "contentPanel.category.sectors",
      icon: Factory,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "modifiers",
      labelKey: "contentPanel.category.modifiers",
      icon: SlidersHorizontal,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "modifiers", labelKey: "contentPanel.section.conditionsEffects", icon: SlidersHorizontal },
      ] as const,
    },
    {
      id: "decisions",
      labelKey: "contentPanel.category.decisions",
      icon: Landmark,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "decisions", labelKey: "contentPanel.section.conditionsEffects", icon: Landmark },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
    {
      id: "events",
      labelKey: "contentPanel.category.events",
      icon: Bell,
      enabled: true,
      sections: [
        { id: "general", labelKey: "contentPanel.section.general", icon: FileText },
        { id: "events", labelKey: "contentPanel.section.triggersOptions", icon: Bell },
        { id: "branding", labelKey: "contentPanel.section.branding", icon: Sticker },
      ] as const,
    },
  ] as const,
} as const;
type PanelCategory = ContentEntryKind;
type PanelSection = "general" | "economy" | "exploration" | "criteria" | "needs" | "politics" | "technology" | "modifiers" | "decisions" | "events" | "branding";
type GoodFlowDraft = { goodId: string; amount: string; affectedByFertility?: boolean };
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

const MODIFIER_STAT_OPTIONS: Array<{ value: ModifierStat; labelKey: UiTextKey }> = [
  { value: "culture_gain", labelKey: "contentPanel.option.modifierStat.cultureGain" },
  { value: "science_gain", labelKey: "contentPanel.option.modifierStat.scienceGain" },
  { value: "religion_gain", labelKey: "contentPanel.option.modifierStat.religionGain" },
  { value: "colonization_gain", labelKey: "contentPanel.option.modifierStat.colonizationGain" },
  { value: "construction_gain", labelKey: "contentPanel.option.modifierStat.constructionGain" },
  { value: "ducats_gain", labelKey: "contentPanel.option.modifierStat.ducatsGain" },
  { value: "gold_gain", labelKey: "contentPanel.option.modifierStat.goldGain" },
  { value: "technology_cost", labelKey: "contentPanel.option.modifierStat.technologyCost" },
  { value: "building_construction_cost", labelKey: "contentPanel.option.modifierStat.buildingConstructionCost" },
  { value: "building_output", labelKey: "contentPanel.option.modifierStat.buildingOutput" },
  { value: "building_input", labelKey: "contentPanel.option.modifierStat.buildingInput" },
  { value: "building_throughput", labelKey: "contentPanel.option.modifierStat.buildingThroughput" },
  { value: "building_wage", labelKey: "contentPanel.option.modifierStat.buildingWage" },
];

const IDEOLOGY_ATTRACTION_RULE_OPTIONS: Array<{ value: IdeologyAttractionConditionType; labelKey: UiTextKey; targetKey: UiTextKey; thresholdKey: UiTextKey }> = [
  { value: "sol_below", labelKey: "contentPanel.option.ideologyRule.solBelow", targetKey: "contentPanel.notRequired", thresholdKey: "contentPanel.placeholder.solThreshold" },
  { value: "sol_above", labelKey: "contentPanel.option.ideologyRule.solAbove", targetKey: "contentPanel.notRequired", thresholdKey: "contentPanel.placeholder.solThreshold" },
  { value: "radicals_above", labelKey: "contentPanel.option.ideologyRule.radicalsAbove", targetKey: "contentPanel.notRequired", thresholdKey: "contentPanel.placeholder.radicalsPct" },
  { value: "loyalists_above", labelKey: "contentPanel.option.ideologyRule.loyalistsAbove", targetKey: "contentPanel.notRequired", thresholdKey: "contentPanel.placeholder.loyalistsPct" },
  { value: "profession_is", labelKey: "contentPanel.option.ideologyRule.professionIs", targetKey: "contentPanel.select.profession", thresholdKey: "contentPanel.notRequired" },
  { value: "religion_is", labelKey: "contentPanel.option.ideologyRule.religionIs", targetKey: "contentPanel.select.religion", thresholdKey: "contentPanel.notRequired" },
  { value: "culture_is", labelKey: "contentPanel.option.ideologyRule.cultureIs", targetKey: "contentPanel.select.culture", thresholdKey: "contentPanel.notRequired" },
  { value: "law_active", labelKey: "contentPanel.option.ideologyRule.lawActive", targetKey: "contentPanel.select.law", thresholdKey: "contentPanel.notRequired" },
  { value: "has_building", labelKey: "contentPanel.option.ideologyRule.hasBuilding", targetKey: "contentPanel.select.building", thresholdKey: "contentPanel.notRequired" },
  { value: "country_modifier_active", labelKey: "contentPanel.option.ideologyRule.countryModifierActive", targetKey: "contentPanel.placeholder.modifierId", thresholdKey: "contentPanel.notRequired" },
  { value: "province_modifier_active", labelKey: "contentPanel.option.ideologyRule.provinceModifierActive", targetKey: "contentPanel.placeholder.modifierId", thresholdKey: "contentPanel.notRequired" },
];

const MODIFIER_MODE_OPTIONS: Array<{ value: ModifierMode; labelKey: UiTextKey }> = [
  { value: "add_pct", labelKey: "contentPanel.option.modifierMode.addPct" },
  { value: "add", labelKey: "contentPanel.option.modifierMode.add" },
  { value: "mult", labelKey: "contentPanel.option.modifierMode.mult" },
];

const MODIFIER_SCOPE_OPTIONS: Array<{ value: ModifierScope; labelKey: UiTextKey }> = [
  { value: "country", labelKey: "contentPanel.option.modifierScope.country" },
  { value: "province", labelKey: "contentPanel.option.modifierScope.province" },
  { value: "building", labelKey: "contentPanel.option.modifierScope.building" },
  { value: "pop", labelKey: "contentPanel.option.modifierScope.pop" },
  { value: "market", labelKey: "contentPanel.option.modifierScope.market" },
];

const MODIFIER_CONDITION_OPTIONS: Array<{ value: ModifierConditionType; labelKey: UiTextKey }> = [
  { value: "always", labelKey: "contentPanel.option.modifierCondition.always" },
  { value: "law_active", labelKey: "contentPanel.option.modifierCondition.lawActive" },
  { value: "technology_researched", labelKey: "contentPanel.option.modifierCondition.technologyResearched" },
  { value: "country_is", labelKey: "contentPanel.option.modifierCondition.countryIs" },
  { value: "has_building", labelKey: "contentPanel.option.modifierCondition.hasBuilding" },
];

const DECISION_CATEGORY_OPTIONS: Array<{ value: DecisionCategory; labelKey: UiTextKey }> = [
  { value: "politics", labelKey: "contentPanel.option.decisionCategory.politics" },
  { value: "economy", labelKey: "contentPanel.option.decisionCategory.economy" },
  { value: "military", labelKey: "contentPanel.option.decisionCategory.military" },
  { value: "diplomacy", labelKey: "contentPanel.option.decisionCategory.diplomacy" },
  { value: "colonization", labelKey: "contentPanel.option.decisionCategory.colonization" },
  { value: "culture", labelKey: "contentPanel.option.decisionCategory.culture" },
  { value: "religion", labelKey: "contentPanel.option.decisionCategory.religion" },
  { value: "technology", labelKey: "contentPanel.option.decisionCategory.technology" },
];

const RESOURCE_OPTIONS: Array<{ value: keyof ResourceTotals; labelKey: UiTextKey }> = [
  { value: "culture", labelKey: "contentPanel.option.resource.culture" },
  { value: "science", labelKey: "contentPanel.option.resource.science" },
  { value: "religion", labelKey: "contentPanel.option.resource.religion" },
  { value: "colonization", labelKey: "contentPanel.option.resource.colonization" },
  { value: "construction", labelKey: "contentPanel.option.resource.construction" },
  { value: "ducats", labelKey: "contentPanel.option.resource.ducats" },
  { value: "gold", labelKey: "contentPanel.option.resource.gold" },
];

const EVENT_CATEGORY_OPTIONS: Array<{ value: EventCategory; labelKey: UiTextKey }> = [
  { value: "system", labelKey: "contentPanel.option.eventCategory.system" },
  { value: "politics", labelKey: "contentPanel.option.eventCategory.politics" },
  { value: "economy", labelKey: "contentPanel.option.eventCategory.economy" },
  { value: "military", labelKey: "contentPanel.option.eventCategory.military" },
  { value: "diplomacy", labelKey: "contentPanel.option.eventCategory.diplomacy" },
  { value: "colonization", labelKey: "contentPanel.option.eventCategory.colonization" },
];

const EVENT_PRIORITY_OPTIONS: Array<{ value: EventPriority; labelKey: UiTextKey }> = [
  { value: "low", labelKey: "contentPanel.option.eventPriority.low" },
  { value: "medium", labelKey: "contentPanel.option.eventPriority.medium" },
  { value: "high", labelKey: "contentPanel.option.eventPriority.high" },
];

const EVENT_VISIBILITY_OPTIONS: Array<{ value: EventVisibility; labelKey: UiTextKey }> = [
  { value: "private", labelKey: "contentPanel.option.eventVisibility.private" },
  { value: "public", labelKey: "contentPanel.option.eventVisibility.public" },
];

type ModifierTargetKey = "buildingId" | "goodId" | "professionId" | "resourceCategoryId";

const MODIFIER_TARGET_LABELS: Record<ModifierTargetKey, UiTextKey> = {
  buildingId: "contentPanel.modifierTarget.building",
  goodId: "contentPanel.modifierTarget.good",
  professionId: "contentPanel.modifierTarget.profession",
  resourceCategoryId: "contentPanel.modifierTarget.resourceCategory",
};

const MODIFIER_STAT_CONFIG: Record<
  ModifierStat,
  { descriptionKey: UiTextKey; targets: ModifierTargetKey[]; defaultMode: ModifierMode; valueHintKey: UiTextKey }
> = {
  culture_gain: {
    descriptionKey: "contentPanel.modifierStatConfig.cultureGain.description",
    targets: [],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.default.valueHint",
  },
  science_gain: {
    descriptionKey: "contentPanel.modifierStatConfig.scienceGain.description",
    targets: [],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.default.valueHint",
  },
  religion_gain: {
    descriptionKey: "contentPanel.modifierStatConfig.religionGain.description",
    targets: [],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.default.valueHint",
  },
  colonization_gain: {
    descriptionKey: "contentPanel.modifierStatConfig.colonizationGain.description",
    targets: [],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.default.valueHint",
  },
  construction_gain: {
    descriptionKey: "contentPanel.modifierStatConfig.constructionGain.description",
    targets: [],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.default.valueHint",
  },
  ducats_gain: {
    descriptionKey: "contentPanel.modifierStatConfig.ducatsGain.description",
    targets: [],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.default.valueHint",
  },
  gold_gain: {
    descriptionKey: "contentPanel.modifierStatConfig.goldGain.description",
    targets: [],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.default.valueHint",
  },
  technology_cost: {
    descriptionKey: "contentPanel.modifierStatConfig.technologyCost.description",
    targets: [],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.cost.valueHint",
  },
  building_construction_cost: {
    descriptionKey: "contentPanel.modifierStatConfig.buildingConstructionCost.description",
    targets: ["buildingId"],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.cost.valueHint",
  },
  building_output: {
    descriptionKey: "contentPanel.modifierStatConfig.buildingOutput.description",
    targets: ["buildingId", "goodId", "resourceCategoryId"],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.output.valueHint",
  },
  building_input: {
    descriptionKey: "contentPanel.modifierStatConfig.buildingInput.description",
    targets: ["buildingId", "goodId", "resourceCategoryId"],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.input.valueHint",
  },
  building_throughput: {
    descriptionKey: "contentPanel.modifierStatConfig.buildingThroughput.description",
    targets: ["buildingId"],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.throughput.valueHint",
  },
  building_wage: {
    descriptionKey: "contentPanel.modifierStatConfig.buildingWage.description",
    targets: ["buildingId", "professionId"],
    defaultMode: "add_pct",
    valueHintKey: "contentPanel.modifierStatConfig.wage.valueHint",
  },
};

const NEED_CATEGORY_OPTIONS: Array<{
  value: CultureNeedDraft["category"];
  labelKey: UiTextKey;
}> = [
  { value: "survival", labelKey: "contentPanel.option.needCategory.survival" },
  { value: "basic", labelKey: "contentPanel.option.needCategory.basic" },
  { value: "comfort", labelKey: "contentPanel.option.needCategory.comfort" },
  { value: "luxury", labelKey: "contentPanel.option.needCategory.luxury" },
];

const PARLIAMENT_POWER_DOMAIN_OPTIONS: Array<{ value: LawParliamentPowerEffect["domain"] | ""; labelKey: UiTextKey }> = [
  { value: "", labelKey: "contentPanel.option.parliamentDomain.none" },
  { value: "laws", labelKey: "contentPanel.option.parliamentDomain.laws" },
  { value: "budget", labelKey: "contentPanel.option.parliamentDomain.budget" },
  { value: "diplomacy", labelKey: "contentPanel.option.parliamentDomain.diplomacy" },
  { value: "war", labelKey: "contentPanel.option.parliamentDomain.war" },
  { value: "government", labelKey: "contentPanel.option.parliamentDomain.government" },
];

const PARLIAMENT_POWER_VALUE_OPTIONS: Record<LawParliamentPowerEffect["domain"], Array<{ value: string; labelKey: UiTextKey }>> = {
  laws: [
    { value: "none", labelKey: "contentPanel.option.parliamentPower.laws.none" },
    { value: "advisory", labelKey: "contentPanel.option.parliamentPower.laws.advisory" },
    { value: "approve", labelKey: "contentPanel.option.parliamentPower.laws.approve" },
    { value: "initiate", labelKey: "contentPanel.option.parliamentPower.laws.initiate" },
  ],
  budget: [
    { value: "none", labelKey: "contentPanel.option.parliamentPower.budget.none" },
    { value: "approve_taxes", labelKey: "contentPanel.option.parliamentPower.budget.approveTaxes" },
    { value: "approve_budget", labelKey: "contentPanel.option.parliamentPower.budget.approveBudget" },
    { value: "control_budget", labelKey: "contentPanel.option.parliamentPower.budget.controlBudget" },
  ],
  diplomacy: [
    { value: "none", labelKey: "contentPanel.option.parliamentPower.diplomacy.none" },
    { value: "ratify_territory", labelKey: "contentPanel.option.parliamentPower.diplomacy.ratifyTerritory" },
    { value: "ratify_major_treaties", labelKey: "contentPanel.option.parliamentPower.diplomacy.ratifyMajorTreaties" },
    { value: "ratify_all", labelKey: "contentPanel.option.parliamentPower.diplomacy.ratifyAll" },
  ],
  war: [
    { value: "none", labelKey: "contentPanel.option.parliamentPower.war.none" },
    { value: "approve", labelKey: "contentPanel.option.parliamentPower.war.approve" },
    { value: "declare", labelKey: "contentPanel.option.parliamentPower.war.declare" },
  ],
  government: [
    { value: "none", labelKey: "contentPanel.option.parliamentPower.government.none" },
    { value: "confidence_vote", labelKey: "contentPanel.option.parliamentPower.government.confidenceVote" },
    { value: "appoint_government", labelKey: "contentPanel.option.parliamentPower.government.appointGovernment" },
  ],
};

type CategoryMeta = {
  singularKey: UiTextKey;
  createBaseNameKey: UiTextKey;
  createLabelKey: UiTextKey;
  namePlaceholderKey: UiTextKey;
  descriptionPlaceholderKey: UiTextKey;
  sectionTitleKey: UiTextKey;
};

const CATEGORY_META: Record<PanelCategory, CategoryMeta> = {
  cultures: {
    singularKey: "contentPanel.meta.cultures.singular",
    createBaseNameKey: "contentPanel.meta.cultures.createBaseName",
    createLabelKey: "contentPanel.meta.cultures.createLabel",
    namePlaceholderKey: "contentPanel.meta.cultures.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.cultures.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.cultures.sectionTitle",
  },
  races: {
    singularKey: "contentPanel.meta.races.singular",
    createBaseNameKey: "contentPanel.meta.races.createBaseName",
    createLabelKey: "contentPanel.meta.races.createLabel",
    namePlaceholderKey: "contentPanel.meta.races.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.races.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.races.sectionTitle",
  },
  resourceCategories: {
    singularKey: "contentPanel.meta.resourceCategories.singular",
    createBaseNameKey: "contentPanel.meta.resourceCategories.createBaseName",
    createLabelKey: "contentPanel.meta.resourceCategories.createLabel",
    namePlaceholderKey: "contentPanel.meta.resourceCategories.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.resourceCategories.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.resourceCategories.sectionTitle",
  },
  provinceTypes: {
    singularKey: "contentPanel.meta.provinceTypes.singular",
    createBaseNameKey: "contentPanel.meta.provinceTypes.createBaseName",
    createLabelKey: "contentPanel.meta.provinceTypes.createLabel",
    namePlaceholderKey: "contentPanel.meta.provinceTypes.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.provinceTypes.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.provinceTypes.sectionTitle",
  },
  provinceClimates: {
    singularKey: "contentPanel.meta.provinceClimates.singular",
    createBaseNameKey: "contentPanel.meta.provinceClimates.createBaseName",
    createLabelKey: "contentPanel.meta.provinceClimates.createLabel",
    namePlaceholderKey: "contentPanel.meta.provinceClimates.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.provinceClimates.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.provinceClimates.sectionTitle",
  },
  provinceLandscapes: {
    singularKey: "contentPanel.meta.provinceLandscapes.singular",
    createBaseNameKey: "contentPanel.meta.provinceLandscapes.createBaseName",
    createLabelKey: "contentPanel.meta.provinceLandscapes.createLabel",
    namePlaceholderKey: "contentPanel.meta.provinceLandscapes.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.provinceLandscapes.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.provinceLandscapes.sectionTitle",
  },
  provinceContinents: {
    singularKey: "contentPanel.meta.provinceContinents.singular",
    createBaseNameKey: "contentPanel.meta.provinceContinents.createBaseName",
    createLabelKey: "contentPanel.meta.provinceContinents.createLabel",
    namePlaceholderKey: "contentPanel.meta.provinceContinents.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.provinceContinents.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.provinceContinents.sectionTitle",
  },
  provinceStrategicRegions: {
    singularKey: "contentPanel.meta.provinceStrategicRegions.singular",
    createBaseNameKey: "contentPanel.meta.provinceStrategicRegions.createBaseName",
    createLabelKey: "contentPanel.meta.provinceStrategicRegions.createLabel",
    namePlaceholderKey: "contentPanel.meta.provinceStrategicRegions.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.provinceStrategicRegions.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.provinceStrategicRegions.sectionTitle",
  },
  religions: {
    singularKey: "contentPanel.meta.religions.singular",
    createBaseNameKey: "contentPanel.meta.religions.createBaseName",
    createLabelKey: "contentPanel.meta.religions.createLabel",
    namePlaceholderKey: "contentPanel.meta.religions.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.religions.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.religions.sectionTitle",
  },
  professions: {
    singularKey: "contentPanel.meta.professions.singular",
    createBaseNameKey: "contentPanel.meta.professions.createBaseName",
    createLabelKey: "contentPanel.meta.professions.createLabel",
    namePlaceholderKey: "contentPanel.meta.professions.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.professions.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.professions.sectionTitle",
  },
  battalions: {
    singularKey: "contentPanel.meta.battalions.singular",
    createBaseNameKey: "contentPanel.meta.battalions.createBaseName",
    createLabelKey: "contentPanel.meta.battalions.createLabel",
    namePlaceholderKey: "contentPanel.meta.battalions.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.battalions.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.battalions.sectionTitle",
  },
  shipTypes: {
    singularKey: "contentPanel.meta.shipTypes.singular",
    createBaseNameKey: "contentPanel.meta.shipTypes.createBaseName",
    createLabelKey: "contentPanel.meta.shipTypes.createLabel",
    namePlaceholderKey: "contentPanel.meta.shipTypes.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.shipTypes.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.shipTypes.sectionTitle",
  },
  aircraftTypes: {
    singularKey: "contentPanel.meta.aircraftTypes.singular",
    createBaseNameKey: "contentPanel.meta.aircraftTypes.createBaseName",
    createLabelKey: "contentPanel.meta.aircraftTypes.createLabel",
    namePlaceholderKey: "contentPanel.meta.aircraftTypes.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.aircraftTypes.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.aircraftTypes.sectionTitle",
  },
  ideologies: {
    singularKey: "contentPanel.meta.ideologies.singular",
    createBaseNameKey: "contentPanel.meta.ideologies.createBaseName",
    createLabelKey: "contentPanel.meta.ideologies.createLabel",
    namePlaceholderKey: "contentPanel.meta.ideologies.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.ideologies.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.ideologies.sectionTitle",
  },
  interestGroups: {
    singularKey: "contentPanel.meta.interestGroups.singular",
    createBaseNameKey: "contentPanel.meta.interestGroups.createBaseName",
    createLabelKey: "contentPanel.meta.interestGroups.createLabel",
    namePlaceholderKey: "contentPanel.meta.interestGroups.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.interestGroups.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.interestGroups.sectionTitle",
  },
  parties: {
    singularKey: "contentPanel.meta.parties.singular",
    createBaseNameKey: "contentPanel.meta.parties.createBaseName",
    createLabelKey: "contentPanel.meta.parties.createLabel",
    namePlaceholderKey: "contentPanel.meta.parties.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.parties.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.parties.sectionTitle",
  },
  lawGroups: {
    singularKey: "contentPanel.meta.lawGroups.singular",
    createBaseNameKey: "contentPanel.meta.lawGroups.createBaseName",
    createLabelKey: "contentPanel.meta.lawGroups.createLabel",
    namePlaceholderKey: "contentPanel.meta.lawGroups.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.lawGroups.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.lawGroups.sectionTitle",
  },
  laws: {
    singularKey: "contentPanel.meta.laws.singular",
    createBaseNameKey: "contentPanel.meta.laws.createBaseName",
    createLabelKey: "contentPanel.meta.laws.createLabel",
    namePlaceholderKey: "contentPanel.meta.laws.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.laws.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.laws.sectionTitle",
  },
  technologies: {
    singularKey: "contentPanel.meta.technologies.singular",
    createBaseNameKey: "contentPanel.meta.technologies.createBaseName",
    createLabelKey: "contentPanel.meta.technologies.createLabel",
    namePlaceholderKey: "contentPanel.meta.technologies.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.technologies.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.technologies.sectionTitle",
  },
  buildings: {
    singularKey: "contentPanel.meta.buildings.singular",
    createBaseNameKey: "contentPanel.meta.buildings.createBaseName",
    createLabelKey: "contentPanel.meta.buildings.createLabel",
    namePlaceholderKey: "contentPanel.meta.buildings.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.buildings.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.buildings.sectionTitle",
  },
  goods: {
    singularKey: "contentPanel.meta.goods.singular",
    createBaseNameKey: "contentPanel.meta.goods.createBaseName",
    createLabelKey: "contentPanel.meta.goods.createLabel",
    namePlaceholderKey: "contentPanel.meta.goods.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.goods.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.goods.sectionTitle",
  },
  companies: {
    singularKey: "contentPanel.meta.companies.singular",
    createBaseNameKey: "contentPanel.meta.companies.createBaseName",
    createLabelKey: "contentPanel.meta.companies.createLabel",
    namePlaceholderKey: "contentPanel.meta.companies.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.companies.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.companies.sectionTitle",
  },
  industries: {
    singularKey: "contentPanel.meta.industries.singular",
    createBaseNameKey: "contentPanel.meta.industries.createBaseName",
    createLabelKey: "contentPanel.meta.industries.createLabel",
    namePlaceholderKey: "contentPanel.meta.industries.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.industries.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.industries.sectionTitle",
  },
  sectors: {
    singularKey: "contentPanel.meta.sectors.singular",
    createBaseNameKey: "contentPanel.meta.sectors.createBaseName",
    createLabelKey: "contentPanel.meta.sectors.createLabel",
    namePlaceholderKey: "contentPanel.meta.sectors.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.sectors.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.sectors.sectionTitle",
  },
  modifiers: {
    singularKey: "contentPanel.meta.modifiers.singular",
    createBaseNameKey: "contentPanel.meta.modifiers.createBaseName",
    createLabelKey: "contentPanel.meta.modifiers.createLabel",
    namePlaceholderKey: "contentPanel.meta.modifiers.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.modifiers.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.modifiers.sectionTitle",
  },
  decisions: {
    singularKey: "contentPanel.meta.decisions.singular",
    createBaseNameKey: "contentPanel.meta.decisions.createBaseName",
    createLabelKey: "contentPanel.meta.decisions.createLabel",
    namePlaceholderKey: "contentPanel.meta.decisions.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.decisions.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.decisions.sectionTitle",
  },
  events: {
    singularKey: "contentPanel.meta.events.singular",
    createBaseNameKey: "contentPanel.meta.events.createBaseName",
    createLabelKey: "contentPanel.meta.events.createLabel",
    namePlaceholderKey: "contentPanel.meta.events.namePlaceholder",
    descriptionPlaceholderKey: "contentPanel.meta.events.descriptionPlaceholder",
    sectionTitleKey: "contentPanel.meta.events.sectionTitle",
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

function normalizeGoodFlowsDraft(rows: GoodFlowDraft[]): Array<{ goodId: string; amount: number; affectedByFertility?: boolean }> {
  return rows
    .map((row) => ({
      goodId: row.goodId.trim(),
      amount: Number(row.amount),
      affectedByFertility: row.affectedByFertility === true,
    }))
    .filter((row) => row.goodId.length > 0 && Number.isFinite(row.amount) && row.amount > 0)
    .map((row) => ({
      goodId: row.goodId,
      amount: Number(row.amount.toFixed(3)),
      ...(row.affectedByFertility ? { affectedByFertility: true } : {}),
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
          label: need.label.trim() || need.id.trim() || `Need ${needIndex + 1}`,
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
      const id = row.id.trim() || label.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "") || `modifier-${index + 1}`;
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
  const localizeOptions = <T extends string>(options: readonly { value: T; labelKey: UiTextKey }[]) =>
    options.map((option) => ({ value: option.value, label: t(option.labelKey) }));
  const modifierStatOptions = localizeOptions(MODIFIER_STAT_OPTIONS);
  const modifierModeOptions = localizeOptions(MODIFIER_MODE_OPTIONS);
  const modifierScopeOptions = localizeOptions(MODIFIER_SCOPE_OPTIONS);
  const modifierConditionOptions = localizeOptions(MODIFIER_CONDITION_OPTIONS);
  const decisionCategoryOptions = localizeOptions(DECISION_CATEGORY_OPTIONS);
  const resourceSelectOptions = localizeOptions(RESOURCE_OPTIONS);
  const eventCategoryOptions = localizeOptions(EVENT_CATEGORY_OPTIONS);
  const eventPriorityOptions = localizeOptions(EVENT_PRIORITY_OPTIONS);
  const eventVisibilityOptions = localizeOptions(EVENT_VISIBILITY_OPTIONS);
  const needCategoryOptions = localizeOptions(NEED_CATEGORY_OPTIONS);
  const parliamentPowerDomainOptions = localizeOptions(PARLIAMENT_POWER_DOMAIN_OPTIONS);
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
      inputs: (entry.inputs ?? []).map((row) => ({ goodId: row.goodId, amount: Number(row.amount.toFixed(3)) })),
      outputs: (entry.outputs ?? []).map((row) => ({
        goodId: row.goodId,
        amount: Number(row.amount.toFixed(3)),
        ...(row.affectedByFertility === true ? { affectedByFertility: true } : {}),
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
      extractionGoodId: activeCategory === "buildings" ? draftExtractionGoodId.trim() || null : null,
      extractionAmountPerTurn:
        activeCategory === "buildings"
          ? Number.isFinite(Number(draftExtractionAmountPerTurn))
            ? Number(Math.max(0, Number(draftExtractionAmountPerTurn)).toFixed(3))
            : null
          : null,
      extractionRequiresDeposit: activeCategory === "buildings" ? Boolean(draftExtractionRequiresDeposit) : null,
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
      const label = key === OTHER_INDUSTRY_GROUP_ID ? t("contentPanel.other") : (industryNameById.get(key) ?? t("contentPanel.other"));
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
        <div className="mb-1 text-xs text-[rgb(var(--theme-text-secondary))]">{label}</div>
        <CustomSelect
          value=""
          onChange={(value) => {
            if (!value) return;
            setSelected((prev) => normalizeCountryIdsDraft([...prev, value]));
          }}
          options={[
            { value: "", label: available.length > 0 ? t("contentPanel.addValue") : t("contentPanel.noAvailableValues") },
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
          {normalized.length === 0 && <div className="text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.anyValue")}</div>}
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
  const localizedCategoryMeta = {
    singular: t(categoryMeta.singularKey),
    createBaseName: t(categoryMeta.createBaseNameKey),
    createLabel: t(categoryMeta.createLabelKey),
    namePlaceholder: t(categoryMeta.namePlaceholderKey),
    descriptionPlaceholder: t(categoryMeta.descriptionPlaceholderKey),
    sectionTitle: t(categoryMeta.sectionTitleKey),
  };

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
        if (!cancelled) toast.error(t("contentPanel.loadFailed"));
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
      (selectedEntry.equipmentNeeds ?? []).map((row) => ({ goodId: row.goodId, amount: String(row.amount) })),
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
    setDraftInputs((selectedEntry.inputs ?? []).map((row) => ({ goodId: row.goodId, amount: String(row.amount) })));
    setDraftOutputs((selectedEntry.outputs ?? []).map((row) => ({
      goodId: row.goodId,
      amount: String(row.amount),
      affectedByFertility: row.affectedByFertility === true,
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
      const nextNameBase = localizedCategoryMeta.createBaseName;
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
                options: [{ id: "ok", label: t("contentPanel.defaultEventOption"), description: null, autoChancePct: 100, buttonColor: "#15505b", effects: [] }],
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
      toast.success(t("contentPanel.createdToast", { item: localizedCategoryMeta.singular }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ADMIN_CREATE_CONTENT_ENTRY_FAILED";
      if (msg === "CONTENT_NAME_EXISTS") toast.error(t("contentPanel.nameExists"));
      else toast.error(t("contentPanel.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const saveEntry = async () => {
    if (!selectedEntry) return;
    const name = draftName.trim();
    if (!name) {
      toast.error(t("contentPanel.nameRequired"));
      return;
    }
    if (entries.some((c) => c.id !== selectedEntry.id && c.name.trim().toLowerCase() === name.toLowerCase())) {
      toast.error(t("contentPanel.nameUnique"));
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
      extractionGoodId: activeCategory === "buildings" ? (draftExtractionGoodId.trim() || null) : undefined,
      extractionAmountPerTurn:
        activeCategory === "buildings" ? Math.max(0, Number(draftExtractionAmountPerTurn || "0")) : undefined,
      extractionRequiresDeposit: activeCategory === "buildings" ? Boolean(draftExtractionRequiresDeposit) : undefined,
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
      toast.error(t("contentPanel.validation.goodEconomyNumbers"));
      return;
    }
    if (activeCategory === "goods" && (payload.maxPrice ?? 0) < (payload.minPrice ?? 0)) {
      toast.error(t("contentPanel.validation.maxPriceBelowMin"));
      return;
    }
    if (
      activeCategory === "goods" &&
      ((payload.explorationSmallVeinMax ?? 0) < (payload.explorationSmallVeinMin ?? 0) ||
        (payload.explorationMediumVeinMax ?? 0) < (payload.explorationMediumVeinMin ?? 0) ||
        (payload.explorationLargeVeinMax ?? 0) < (payload.explorationLargeVeinMin ?? 0))
    ) {
      toast.error(t("contentPanel.validation.veinMaxBelowMin"));
      return;
    }
    if (activeCategory === "professions" && !Number.isFinite(payload.baseWage ?? Number.NaN)) {
      toast.error(t("contentPanel.validation.baseWageNumber"));
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
        toast.error(t("contentPanel.validation.ideologyRules"));
        return;
      }
    }
    if (activeCategory === "parties") {
      const badWeight = [...draftIdeologyWeights, ...draftInterestGroupWeights, ...draftLawPreferences].some((row) => row.targetId.trim() && !Number.isFinite(Number(row.value)));
      if (badWeight) {
        toast.error(t("contentPanel.validation.politicalWeights"));
        return;
      }
      if (!Number.isFinite(payload.discipline ?? Number.NaN)) {
        toast.error(t("contentPanel.validation.partyDiscipline"));
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
        toast.error(t("contentPanel.validation.interestGroupNumbers"));
        return;
      }
    }
    if (activeCategory === "lawGroups" && !Number.isFinite(payload.order ?? Number.NaN)) {
      toast.error(t("contentPanel.validation.lawGroupOrder"));
      return;
    }
    if (activeCategory === "laws") {
      const badPreference = draftLawPreferences.some((row) => row.targetId.trim() && !Number.isFinite(Number(row.value)));
      if (badPreference) {
        toast.error(t("contentPanel.validation.partyPreferences"));
        return;
      }
      if (!payload.lawGroupId) {
        toast.error(t("contentPanel.validation.lawGroupRequired"));
        return;
      }
      if (!Number.isFinite(payload.enactmentDifficulty ?? Number.NaN) || !Number.isFinite(payload.votingDurationTurns ?? Number.NaN)) {
        toast.error(t("contentPanel.validation.votingNumbers"));
        return;
      }
    }
    if (activeCategory === "technologies" && !Number.isFinite(payload.costScience ?? Number.NaN)) {
      toast.error(t("contentPanel.validation.researchCostNumber"));
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
      toast.error(t("contentPanel.validation.buildingNumbers"));
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
      toast.success(t("contentPanel.saved"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ADMIN_UPDATE_CONTENT_ENTRY_FAILED";
      if (msg === "CONTENT_NAME_EXISTS") toast.error(t("contentPanel.nameExists"));
      else toast.error(t("contentPanel.saveFailed"));
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
      toast.success(t("contentPanel.deleted"));
    } catch {
      toast.error(t("contentPanel.deleteFailed"));
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
        toast.error(activeCategory === "events" || activeCategory === "decisions" ? t("contentPanel.imageTooLarge") : t("contentPanel.logoTooLarge"));
      }
      else if (msg === "IMAGE_DIMENSIONS_TOO_LARGE") {
        toast.error(activeCategory === "events" || activeCategory === "decisions" ? t("contentPanel.imageTooLarge") : t("contentPanel.logoTooLarge"));
      }
      else toast.error(t("contentPanel.logoUploadFailed"));
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
      toast.success(t("contentPanel.portraitUploaded", { slot: t(slot === "male" ? "contentPanel.portraitSlot.male" : "contentPanel.portraitSlot.female") }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "RACE_PORTRAIT_INVALID";
      if (msg === "RACE_PORTRAIT_TOO_LARGE" || msg === "IMAGE_DIMENSIONS_TOO_LARGE") {
        toast.error(t("contentPanel.portraitTooLarge"));
      } else {
        toast.error(t("contentPanel.portraitUploadFailed"));
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
    <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{title}</span>
        <button
          type="button"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { targetId: options.find((option) => !prev.some((row) => row.targetId === option.id))?.id ?? "", value: defaultValue },
            ])
          }
          className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]"
        >
          <Plus size={12} />
          {t("contentPanel.add")}
        </button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{emptyText}</div>
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
                className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"
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
    if (!Number.isFinite(value)) return t("contentPanel.invalidValue");
    if (mode === "add_pct") return `${value >= 0 ? "+" : ""}${Number((value * 100).toFixed(2))}%`;
    if (mode === "mult") return `x${Number(value.toFixed(3))}`;
    return `${value >= 0 ? "+" : ""}${Number(value.toFixed(3))}`;
  };

  const getModifierEffectSummary = (effect: ModifierEffectDraft) => {
    const statLabel = modifierStatOptions.find((option) => option.value === effect.stat)?.label ?? effect.stat;
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
    if (type === "law_active") return [{ value: "", label: t("contentPanel.select.law") }, ...lawOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "technology_researched") return [{ value: "", label: t("contentPanel.select.technology") }, ...technologyOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "country_is") return [{ value: "", label: t("contentPanel.select.country") }, ...countryOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "has_building") return [{ value: "", label: t("contentPanel.select.building") }, ...buildingOptions.map((option) => ({ value: option.id, label: option.name }))];
    return [{ value: "", label: t("contentPanel.notRequired") }];
  };

  const getIdeologyAttractionTargetOptions = (type: IdeologyAttractionConditionType) => {
    if (type === "profession_is") return [{ value: "", label: t("contentPanel.select.profession") }, ...professionOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "religion_is") return [{ value: "", label: t("contentPanel.select.religion") }, ...religionOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "culture_is") return [{ value: "", label: t("contentPanel.select.culture") }, ...cultureOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "law_active") return [{ value: "", label: t("contentPanel.select.law") }, ...lawOptions.map((option) => ({ value: option.id, label: option.name }))];
    if (type === "has_building") return [{ value: "", label: t("contentPanel.select.building") }, ...buildingOptions.map((option) => ({ value: option.id, label: option.name }))];
    return [{ value: "", label: t("contentPanel.notRequired") }];
  };

  const ideologyRuleNeedsThreshold = (type: IdeologyAttractionConditionType) =>
    ["sol_below", "sol_above", "radicals_above", "loyalists_above"].includes(type);
  const ideologyRuleNeedsTargetSelect = (type: IdeologyAttractionConditionType) =>
    ["profession_is", "religion_is", "culture_is", "law_active", "has_building"].includes(type);
  const ideologyRuleNeedsTargetInput = (type: IdeologyAttractionConditionType) =>
    type === "country_modifier_active" || type === "province_modifier_active";

  const renderIdeologyAttractionRulesEditor = () => (
    <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.ideologyRules")}</div>
          <div className="mt-1 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.ideologyRulesHint")}</div>
        </div>
        <button
          type="button"
          onClick={() =>
            setDraftIdeologyAttractionRules((prev) => [
              ...prev,
              { id: `rule-${prev.length + 1}`, type: "sol_below", targetId: "", threshold: "8", weight: "20", label: "", invert: false },
            ])
          }
          className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]"
        >
          <Plus size={12} />
          {t("contentPanel.add")}
        </button>
      </div>
      {draftIdeologyAttractionRules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">
          {t("contentPanel.ideologyRulesEmpty")}
        </div>
      ) : (
        <div className="space-y-3">
          {draftIdeologyAttractionRules.map((rule, index) => {
            const option = IDEOLOGY_ATTRACTION_RULE_OPTIONS.find((item) => item.value === rule.type);
            return (
              <div key={`${rule.id}-${index}`} className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
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
                    options={IDEOLOGY_ATTRACTION_RULE_OPTIONS.map((item) => ({ value: item.value, label: t(item.labelKey) }))}
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
                    placeholder={t("contentPanel.placeholder.modifierId")}
                      className="h-[38px]"
                    />
                  ) : (
                    <div className="flex h-[38px] items-center rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 text-xs text-[rgb(var(--theme-text-muted))]">
                      {option ? t(option.targetKey) : t("contentPanel.notRequired")}
                    </div>
                  )}
                  <AppInput
                    value={rule.threshold}
                    disabled={!ideologyRuleNeedsThreshold(rule.type)}
                    onChange={(e) => setDraftIdeologyAttractionRules((prev) => prev.map((item, i) => (i === index ? { ...item, threshold: e.target.value } : item)))}
                    placeholder={option ? t(option.thresholdKey) : t("contentPanel.placeholder.threshold")}
                    inputMode="decimal"
                    className="h-[38px]"
                  />
                  <AppInput
                    value={rule.weight}
                    onChange={(e) => setDraftIdeologyAttractionRules((prev) => prev.map((item, i) => (i === index ? { ...item, weight: e.target.value } : item)))}
                    placeholder={t("contentPanel.placeholder.weight")}
                    inputMode="decimal"
                    className="h-[38px]"
                  />
                  <button
                    type="button"
                    onClick={() => setDraftIdeologyAttractionRules((prev) => prev.filter((_, i) => i !== index))}
                    className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_140px]">
                  <AppInput
                    value={rule.label}
                    onChange={(e) => setDraftIdeologyAttractionRules((prev) => prev.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)))}
                    placeholder={t("contentPanel.placeholder.ruleDescription")}
                    className="h-[36px] bg-[rgb(var(--theme-surface-2))] text-xs"
                  />
                  <label className="flex h-[36px] items-center gap-2 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 text-xs text-[rgb(var(--theme-text-secondary))]">
                    <input
                      type="checkbox"
                      checked={rule.invert}
                      onChange={(e) => setDraftIdeologyAttractionRules((prev) => prev.map((item, i) => (i === index ? { ...item, invert: e.target.checked } : item)))}
                    />
                    {t("contentPanel.invert")}
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
    const typeLabel = modifierConditionOptions.find((option) => option.value === condition.type)?.label ?? condition.type;
    if (condition.type === "always") return condition.invert ? t("contentPanel.condition.never") : t("contentPanel.condition.always");
    const targetLabel = getModifierConditionTargetOptions(condition.type).find((option) => option.value === condition.targetId)?.label ?? condition.targetId;
    return `${condition.invert ? `${t("contentPanel.notPrefix")} ` : ""}${typeLabel}: ${targetLabel || t("contentPanel.notSelected")}`;
  };

  const renderDecisionConditionRows = (
    title: string,
    rows: ModifierConditionDraft[],
    setRows: Dispatch<SetStateAction<ModifierConditionDraft[]>>,
  ) => (
    <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{title}</div>
          <div className="mt-1 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.conditionsAllRequired")}</div>
        </div>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { type: "law_active", targetId: "", invert: false }])}
          className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]"
        >
          <Plus size={12} />
          {t("contentPanel.condition")}
        </button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.conditionsEmpty")}</div>
        ) : (
          rows.map((condition, index) => (
            <div key={`${condition.type}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px_34px]">
              <CustomSelect
                value={condition.type}
                onChange={(value) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, type: value as ModifierConditionType, targetId: "" } : row)))}
                options={modifierConditionOptions}
                buttonClassName="h-[38px]"
              />
              <CustomSelect
                value={condition.targetId}
                onChange={(value) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, targetId: value } : row)))}
                options={getModifierConditionTargetOptions(condition.type)}
                buttonClassName="h-[38px]"
              />
              <label className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 text-xs text-[rgb(var(--theme-text-secondary))]">
                <input
                  type="checkbox"
                  checked={condition.invert}
                  onChange={(e) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, invert: e.target.checked } : row)))}
                />
                {t("contentPanel.notShort")}
              </label>
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"
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
    <div className="space-y-3 rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.category")}</span>
          <CustomSelect
            value={draftDecisionCategory}
            onChange={(value) => setDraftDecisionCategory(value as DecisionCategory)}
            options={decisionCategoryOptions}
            buttonClassName="h-[38px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.cooldownTurns")}</span>
          <AppInput value={draftDecisionCooldownTurns} onChange={(e) => setDraftDecisionCooldownTurns(e.target.value)} inputMode="numeric" />
        </label>
        <label className="mt-5 flex h-[38px] items-center gap-2 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 text-xs text-[rgb(var(--theme-text-secondary))]">
          <input type="checkbox" checked={draftDecisionRepeatable} onChange={(e) => setDraftDecisionRepeatable(e.target.checked)} />
          {t("contentPanel.field.repeatable")}
        </label>
      </div>

      {renderDecisionConditionRows(t("contentPanel.conditions.visibility"), draftDecisionVisibilityConditions, setDraftDecisionVisibilityConditions)}
      {renderDecisionConditionRows(t("contentPanel.conditions.availability"), draftDecisionAvailabilityConditions, setDraftDecisionAvailabilityConditions)}

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.costs")}</span>
            <button type="button" onClick={() => setDraftDecisionCosts((prev) => [...prev, { targetId: "gold", value: "100" }])} className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]">
              <Plus size={12} />
              {t("contentPanel.resource")}
            </button>
          </div>
          <div className="space-y-2">
            {draftDecisionCosts.length === 0 ? <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.free")}</div> : draftDecisionCosts.map((row, index) => (
              <div key={`${row.targetId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_34px]">
                <CustomSelect value={row.targetId} onChange={(value) => setDraftDecisionCosts((prev) => prev.map((item, i) => (i === index ? { ...item, targetId: value } : item)))} options={resourceSelectOptions} buttonClassName="h-[38px]" />
                <AppInput value={row.value} onChange={(e) => setDraftDecisionCosts((prev) => prev.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))} inputMode="decimal" />
                <button type="button" onClick={() => setDraftDecisionCosts((prev) => prev.filter((_, i) => i !== index))} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.effects")}</span>
            <button type="button" onClick={() => setDraftDecisionEffects((prev) => [...prev, { type: "resource_delta", resource: "culture", amount: "10" }])} className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]">
              <Plus size={12} />
              {t("contentPanel.effect")}
            </button>
          </div>
          <div className="space-y-2">
            {draftDecisionEffects.length === 0 ? <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.effectsEmpty")}</div> : draftDecisionEffects.map((row, index) => (
              <div key={`${row.resource}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_34px]">
                <CustomSelect value={row.resource} onChange={(value) => setDraftDecisionEffects((prev) => prev.map((item, i) => (i === index ? { ...item, resource: value as keyof ResourceTotals } : item)))} options={resourceSelectOptions} buttonClassName="h-[38px]" />
                <AppInput value={row.amount} onChange={(e) => setDraftDecisionEffects((prev) => prev.map((item, i) => (i === index ? { ...item, amount: e.target.value } : item)))} inputMode="decimal" />
                <button type="button" onClick={() => setDraftDecisionEffects((prev) => prev.filter((_, i) => i !== index))} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"><Trash2 size={14} /></button>
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
        <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.effectsEmpty")}</div>
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
              options={resourceSelectOptions}
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
              className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  );

  const renderEventsEditor = () => (
    <div className="space-y-3 rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <label className="block">
          <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.category")}</span>
          <CustomSelect value={draftEventCategory} onChange={(value) => setDraftEventCategory(value as EventCategory)} options={eventCategoryOptions} buttonClassName="h-[38px]" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.priority")}</span>
          <CustomSelect value={draftEventPriority} onChange={(value) => setDraftEventPriority(value as EventPriority)} options={eventPriorityOptions} buttonClassName="h-[38px]" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.visibility")}</span>
          <CustomSelect value={draftEventVisibility} onChange={(value) => setDraftEventVisibility(value as EventVisibility)} options={eventVisibilityOptions} buttonClassName="h-[38px]" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.cooldown")}</span>
          <AppInput value={draftEventCooldownTurns} onChange={(e) => setDraftEventCooldownTurns(e.target.value)} inputMode="numeric" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.checkInterval")}</span>
          <AppInput value={draftEventCheckIntervalTurns} onChange={(e) => setDraftEventCheckIntervalTurns(e.target.value)} inputMode="numeric" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.chancePct")}</span>
          <AppInput value={draftEventChancePct} onChange={(e) => setDraftEventChancePct(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex h-[38px] items-center gap-2 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 text-xs text-[rgb(var(--theme-text-secondary))]">
          <input type="checkbox" checked={draftEventRepeatable} onChange={(e) => setDraftEventRepeatable(e.target.checked)} />
          {t("contentPanel.field.repeatable")}
        </label>
        <label className="flex h-[38px] items-center gap-2 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 text-xs text-[rgb(var(--theme-text-secondary))]">
          <input type="checkbox" checked={draftEventBlocking} onChange={(e) => setDraftEventBlocking(e.target.checked)} />
          {t("contentPanel.field.blockingEvent")}
        </label>
      </div>
      {renderDecisionConditionRows(t("contentPanel.conditions.triggers"), draftEventTriggerConditions, setDraftEventTriggerConditions)}
      <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.eventOptions")}</div>
            <div className="mt-1 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.eventOptionsHint")}</div>
          </div>
          <button type="button" onClick={() => setDraftEventOptions((prev) => [...prev, { id: `option-${prev.length + 1}`, label: t("contentPanel.newEventOption"), description: "", autoChancePct: "100", buttonColor: "#15505b", effects: [] }])} className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]">
            <Plus size={12} />
            {t("contentPanel.option")}
          </button>
        </div>
        <div className="space-y-3">
          {draftEventOptions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.eventOptionsEmpty")}</div>
          ) : (
            draftEventOptions.map((option, index) => (
              <div key={`${option.id}-${index}`} className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] p-3">
                <div className="grid gap-2 md:grid-cols-[150px_minmax(0,1fr)_120px_160px_34px]">
                  <AppInput value={option.id} onChange={(e) => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, id: e.target.value } : item)))} placeholder="id" />
                  <AppInput value={option.label} onChange={(e) => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)))} placeholder={t("contentPanel.placeholder.buttonText")} />
                  <AppInput value={option.autoChancePct} onChange={(e) => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, autoChancePct: e.target.value } : item)))} inputMode="decimal" placeholder={t("contentPanel.placeholder.autoPct")} />
                  <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-2">
                    <input
                      type="color"
                      value={/^#[0-9A-Fa-f]{6}$/.test(option.buttonColor) ? option.buttonColor : "#15505b"}
                      onChange={(e) => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, buttonColor: e.target.value } : item)))}
                      className="h-[38px] w-full rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] p-1"
                      aria-label={t("contentPanel.buttonColor")}
                    />
                    <AppInput value={option.buttonColor} onChange={(e) => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, buttonColor: e.target.value } : item)))} placeholder="#15505b" />
                  </div>
                  <button type="button" onClick={() => setDraftEventOptions((prev) => prev.filter((_, i) => i !== index))} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"><Trash2 size={14} /></button>
                </div>
                <AppTextarea className="mt-2 min-h-[70px]" value={option.description} onChange={(e) => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, description: e.target.value } : item)))} placeholder={t("contentPanel.placeholder.optionDescription")} />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.optionEffects")}</span>
                  <button type="button" onClick={() => setDraftEventOptions((prev) => prev.map((item, i) => (i === index ? { ...item, effects: [...item.effects, { type: "resource_delta", resource: "culture", amount: "10" }] } : item)))} className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]">
                    <Plus size={12} />
                    {t("contentPanel.effect")}
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
    <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Tooltip content={t("contentPanel.modifiersTooltip")}>
          <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.category.modifiers")}</span>
        </Tooltip>
        <button
          type="button"
          onClick={() =>
            setDraftModifiers((prev) => [
              ...prev,
              {
                id: `modifier-${prev.length + 1}`,
                label: t("contentPanel.newModifier"),
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
          className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]"
        >
          <Plus size={12} />
          {t("contentPanel.add")}
        </button>
      </div>
      <div className="mb-3 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs leading-relaxed text-[rgb(var(--theme-text-secondary))]">
        {t("contentPanel.modifiersHint")}
      </div>
      <div className="space-y-3">
        {draftModifiers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">
            {t("contentPanel.modifiersEmpty")}
          </div>
        ) : (
          draftModifiers.map((modifier, modifierIndex) => (
            <div key={`${modifier.id}-${modifierIndex}`} className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
              <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)_150px_34px]">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-[rgb(var(--theme-text-muted))]">ID</span>
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
                  <span className="mb-1 block text-[11px] text-[rgb(var(--theme-text-muted))]">{t("contentPanel.field.name")}</span>
                  <AppInput
                    value={modifier.label}
                    onChange={(e) =>
                      setDraftModifiers((prev) =>
                        prev.map((item, i) => (i === modifierIndex ? { ...item, label: e.target.value } : item)),
                      )
                    }
                    placeholder={t("contentPanel.placeholder.modifierName")}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-[rgb(var(--theme-text-muted))]">{t("contentPanel.field.scope")}</span>
                  <CustomSelect
                    value={modifier.scope}
                    onChange={(value) =>
                      setDraftModifiers((prev) =>
                        prev.map((item, i) => (i === modifierIndex ? { ...item, scope: value as ModifierScope } : item)),
                      )
                    }
                    options={modifierScopeOptions}
                    buttonClassName="h-[38px]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setDraftModifiers((prev) => prev.filter((_, i) => i !== modifierIndex))}
                  className="mt-[18px] inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="mt-3 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.activationConditions")}</span>
                    <div className="mt-1 text-xs text-[rgb(var(--theme-text-muted))]">
                      {t("contentPanel.modifierConditionsHint")}
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
                    className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]"
                  >
                    <Plus size={12} />
                    {t("contentPanel.condition")}
                  </button>
                </div>
                <div className="space-y-2">
                  {modifier.conditions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">
                      {t("contentPanel.modifierConditionsEmpty")}
                    </div>
                  ) : (
                    modifier.conditions.map((condition, conditionIndex) => (
                      <div key={`${condition.type}-${conditionIndex}`} className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-2">
                        <div className="mb-2 text-xs text-[rgb(var(--theme-text-secondary))]">{getModifierConditionSummary(condition)}</div>
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
                            options={modifierConditionOptions}
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
                          <label className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 text-xs text-[rgb(var(--theme-text-secondary))]">
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
                            {t("contentPanel.notShort")}
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
                            className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"
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
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.effects")}</span>
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
                    className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]"
                  >
                    <Plus size={12} />
                    {t("contentPanel.effect")}
                  </button>
                </div>
                {modifier.effects.map((effect, effectIndex) => {
                  const statConfig = MODIFIER_STAT_CONFIG[effect.stat];
                  const targets = statConfig.targets;
                  return (
                  <div key={`${effect.stat}-${effectIndex}`} className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.effectNumber", { index: String(effectIndex + 1) })}</span>
                        <div className="mt-1 truncate text-xs text-[rgb(var(--theme-text-secondary))]">{getModifierEffectSummary(effect)}</div>
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
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mb-3 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2 text-xs leading-relaxed text-[rgb(var(--theme-text-secondary))]">
                      {t(statConfig.descriptionKey)} <span className="text-[rgb(var(--theme-text-muted))]">{t(statConfig.valueHintKey)}</span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_minmax(180px,240px)_140px]">
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-[rgb(var(--theme-text-muted))]">{t("contentPanel.field.stat")}</span>
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
                          options={modifierStatOptions}
                          buttonClassName="h-[38px]"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-[rgb(var(--theme-text-muted))]">{t("contentPanel.field.applyMode")}</span>
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
                          options={modifierModeOptions}
                          buttonClassName="h-[38px]"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-[rgb(var(--theme-text-muted))]">{t("contentPanel.field.value")}</span>
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
                      <div className="mt-2 rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">
                        {t("contentPanel.modifierNoTargets")}
                      </div>
                    ) : (
                    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      {targets.includes("buildingId") && (
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-[rgb(var(--theme-text-muted))]">{t(MODIFIER_TARGET_LABELS.buildingId)}</span>
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
                        options={[{ value: "", label: t("contentPanel.anyBuilding") }, ...buildingOptions.map((option) => ({ value: option.id, label: option.name }))]}
                        buttonClassName="h-[38px]"
                      />
                      </label>
                      )}
                      {targets.includes("goodId") && (
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-[rgb(var(--theme-text-muted))]">{t(MODIFIER_TARGET_LABELS.goodId)}</span>
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
                        options={[{ value: "", label: t("contentPanel.anyGood") }, ...goodsOptions.map((option) => ({ value: option.id, label: option.name }))]}
                        buttonClassName="h-[38px]"
                      />
                      </label>
                      )}
                      {targets.includes("professionId") && (
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-[rgb(var(--theme-text-muted))]">{t(MODIFIER_TARGET_LABELS.professionId)}</span>
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
                        options={[{ value: "", label: t("contentPanel.anyProfession") }, ...professionOptions.map((option) => ({ value: option.id, label: option.name }))]}
                        buttonClassName="h-[38px]"
                      />
                      </label>
                      )}
                      {targets.includes("resourceCategoryId") && (
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-[rgb(var(--theme-text-muted))]">{t(MODIFIER_TARGET_LABELS.resourceCategoryId)}</span>
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
                        options={[{ value: "", label: t("contentPanel.anyCategory") }, ...resourceCategoryOptions.map((option) => ({ value: option.id, label: option.name }))]}
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
              title={t("contentPanel.title")}
              description={t("contentPanel.description")}
              onClose={requestClose}
            />

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                <Tooltip content={t("contentPanel.categoriesTooltip")}>
                  <span className="mb-2 block shrink-0 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.categories")}</span>
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
                            ? "border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] text-[rgb(var(--theme-text-muted))]"
                            : isActive
                              ? "border-arc-accent/30 bg-arc-accent/10 text-arc-accent"
                              : "border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] text-[rgb(var(--theme-text-secondary))]"
                        }`}
                      >
                        <Icon size={15} />
                        <span>{t(category.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>

              </aside>

              <div className="grid min-h-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <section className="min-h-0 rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                  <Tooltip content={t("contentPanel.listTooltip")}>
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">
                      {t("contentPanel.listLabel", { category: t(CONTENT_UI_SCHEMA.categories.find((c) => c.id === activeCategory)?.labelKey ?? "contentPanel.contentFallback") })}
                    </span>
                  </Tooltip>
                  <AppInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("contentPanel.searchPlaceholder", { item: localizedCategoryMeta.singular })}
                    className="mb-2"
                  />
                  <button
                    type="button"
                    onClick={() => void createEntry()}
                    disabled={saving}
                    className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-arc-accent px-3 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
                  >
                    <Plus size={15} />
                    {localizedCategoryMeta.createLabel}
                  </button>

                  <div className="arc-scrollbar max-h-[calc(100%-6.75rem)] space-y-2 overflow-auto pr-1">
                    {loading ? (
                      <AppEmptyState className="py-4 text-xs">{t("contentPanel.loading")}</AppEmptyState>
                    ) : filteredEntries.length === 0 ? (
                      <AppEmptyState className="py-4 text-xs">{t("contentPanel.empty")}</AppEmptyState>
                    ) : activeCategory === "buildings" ? (
                      buildingEntryGroups.map((group) => {
                        const isOpen = openBuildingIndustryGroups[group.id] ?? false;
                        return (
                          <div key={group.id} className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))]">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenBuildingIndustryGroups((current) => ({
                                  ...current,
                                  [group.id]: !(current[group.id] ?? false),
                                }))
                              }
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-secondary))] transition hover:bg-white/[0.04] hover:text-[rgb(var(--theme-text-primary))]"
                            >
                              <ChevronDown
                                size={14}
                                className={`shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                              />
                              <span className="min-w-0 flex-1 truncate">{group.label}</span>
                              <span className="rounded-md border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--theme-text-muted))]">
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
                                  <div className="space-y-2 border-t border-[rgb(var(--theme-border-subtle))] p-2">
                                    {group.entries.map((entry) => (
                                      <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => setSelectedEntryId(entry.id)}
                                        className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                                          selectedEntryId === entry.id
                                            ? "border-arc-accent/30 bg-arc-accent/10"
                                            : "border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] hover:border-[rgb(var(--theme-border-subtle))]"
                                        }`}
                                      >
                                        <div
                                          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))]"
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
                                          <div className="truncate text-sm text-[rgb(var(--theme-text-primary))]">{entry.name}</div>
                                          <div className="mt-1 flex items-center gap-2">
                                            <span className="inline-block h-2.5 w-2.5 rounded-full border border-[rgb(var(--theme-border-subtle))]" style={{ backgroundColor: entry.color }} />
                                            <span className="text-[10px] text-[rgb(var(--theme-text-muted))]">{entry.color}</span>
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
                            : "border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] hover:border-[rgb(var(--theme-border-subtle))]"
                        }`}
                      >
                        <div
                          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))]"
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
                          <div className="truncate text-sm text-[rgb(var(--theme-text-primary))]">{entry.name}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full border border-[rgb(var(--theme-border-subtle))]" style={{ backgroundColor: entry.color }} />
                            <span className="text-[10px] text-[rgb(var(--theme-text-muted))]">{entry.color}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <div className="grid min-h-0 gap-4 lg:grid-rows-[auto_auto_minmax(0,1fr)]">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[rgb(var(--theme-border-subtle))] px-1">
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
                            : "border-b-2 border-transparent text-[rgb(var(--theme-text-secondary))] hover:text-[rgb(var(--theme-text-primary))]"
                        }`}
                      >
                        <SectionIcon size={14} />
                        {t(section.labelKey)}
                      </button>
                      );
                    })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                  <div>
                    <AppSectionHeader
                      title={selectedEntry ? selectedEntry.name : localizedCategoryMeta.createBaseName}
                      description={localizedCategoryMeta.sectionTitle}
                      className="mb-0"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {hasUnsavedChanges && (
                      <span className="rounded-md border border-[rgb(var(--theme-warning))] bg-[rgb(var(--theme-warning-soft))] px-2 py-1 text-[11px] text-[rgb(var(--theme-warning))]">
                        {t("contentPanel.unsavedChanges")}
                      </span>
                    )}
                    <Tooltip content={t("contentPanel.saveTooltip")}>
                      <button
                        type="button"
                        onClick={() => void saveEntry()}
                        disabled={!selectedEntry || saving}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-arc-accent px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t("common.save")}
                      </button>
                    </Tooltip>
                    <Tooltip content={t("contentPanel.deleteTooltip")}>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmOpen(true)}
                        disabled={!selectedEntry || saving}
                        className="panel-border inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[rgb(var(--theme-danger-soft))] px-3 text-sm text-[rgb(var(--theme-danger))] transition hover:bg-[rgb(var(--theme-danger-soft))] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        {t("contentPanel.delete")}
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <div className="grid min-h-0 gap-4">
                  <div className="arc-scrollbar min-h-0 space-y-4 overflow-auto pr-1">
                    {contentSection === "general" && (
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        <Tooltip content={t("contentPanel.generalTooltip")}>
                          <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.generalData")}</span>
                        </Tooltip>
                        <div className={`grid gap-4 ${activeCategory === "technologies" ? "" : "md:grid-cols-[minmax(0,1fr)_200px]"}`}>
                          <label className="block">
                            <Tooltip content={t("contentPanel.nameTooltip")}>
                              <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.name")}</span>
                            </Tooltip>
                            <AppInput
                              value={draftName}
                              onChange={(e) => setDraftName(e.target.value)}
                              placeholder={localizedCategoryMeta.namePlaceholder}
                            />
                          </label>
                          {activeCategory !== "technologies" && (
                            <div>
                              <Tooltip content={t("contentPanel.colorTooltip")}>
                                <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.color")}</span>
                              </Tooltip>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={/^#[0-9A-Fa-f]{6}$/.test(draftColor) ? draftColor : "#4ade80"}
                                  onChange={(e) => setDraftColor(e.target.value)}
                                  className="h-10 w-12 rounded border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] p-1"
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
                          <Tooltip content={t("contentPanel.descriptionTooltip")}>
                            <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.description")}</span>
                          </Tooltip>
                          <AppTextarea
                            value={draftDescription}
                            onChange={(e) => setDraftDescription(e.target.value)}
                            placeholder={localizedCategoryMeta.descriptionPlaceholder}
                            maxLength={5000}
                            rows={5}
                          />
                          <div className="mt-1 text-right text-[11px] text-[rgb(var(--theme-text-muted))]">{draftDescription.length}/5000</div>
                        </label>

                      </section>
                    )}

                    {contentSection === "politics" && (
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        <Tooltip content={t("contentPanel.politicsTooltip")}>
                          <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.politicalSettings")}</span>
                        </Tooltip>
                        {activeCategory === "ideologies" && renderIdeologyAttractionRulesEditor()}
                        {activeCategory === "parties" && (
                          <div className="space-y-4">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                              <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.ideologyElectionWeights")}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraftIdeologyWeights((prev) => [
                                        ...prev,
                                        { targetId: ideologyOptions.find((option) => !prev.some((row) => row.targetId === option.id))?.id ?? "", value: "1" },
                                      ])
                                    }
                                    className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]"
                                  >
                                    <Plus size={12} />
                                    {t("contentPanel.add")}
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {draftIdeologyWeights.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.equalPartySupport")}</div>
                                  ) : (
                                    draftIdeologyWeights.map((row, index) => (
                                      <div key={`${row.targetId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_34px]">
                                        <CustomSelect
                                          value={row.targetId}
                                          onChange={(value) => setDraftIdeologyWeights((prev) => prev.map((item, i) => (i === index ? { ...item, targetId: value } : item)))}
                                          options={[{ value: "", label: t("contentPanel.select.ideology") }, ...ideologyOptions.map((option) => ({ value: option.id, label: option.name }))]}
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
                                          className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                              <label className="block">
                                <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.discipline")}</span>
                                <AppInput
                                  value={draftDiscipline}
                                  onChange={(e) => setDraftDiscipline(e.target.value)}
                                  inputMode="decimal"
                                />
                                <div className="mt-2 text-[11px] leading-relaxed text-[rgb(var(--theme-text-muted))]">
                                  {t("contentPanel.disciplineHint")}
                                </div>
                              </label>
                            </div>
                            <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.lawPreferences")}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftLawPreferences((prev) => [
                                      ...prev,
                                      { targetId: lawOptions.find((option) => !prev.some((row) => row.targetId === option.id))?.id ?? "", value: "0" },
                                    ])
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]"
                                >
                                  <Plus size={12} />
                                  {t("contentPanel.add")}
                                </button>
                              </div>
                              <div className="space-y-2">
                                {draftLawPreferences.length === 0 ? (
                                  <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.noExplicitPreferences")}</div>
                                ) : (
                                  draftLawPreferences.map((row, index) => (
                                    <div key={`${row.targetId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_34px]">
                                      <CustomSelect
                                        value={row.targetId}
                                        onChange={(value) => setDraftLawPreferences((prev) => prev.map((item, i) => (i === index ? { ...item, targetId: value } : item)))}
                                        options={[{ value: "", label: t("contentPanel.select.law") }, ...lawOptions.map((option) => ({ value: option.id, label: option.name }))]}
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
                                        className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"
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
                                <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.baseStrength")}</span>
                                <AppInput value={draftBasePoliticalStrength} onChange={(e) => setDraftBasePoliticalStrength(e.target.value)} inputMode="decimal" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.solMultiplier")}</span>
                                <AppInput value={draftSolMultiplier} onChange={(e) => setDraftSolMultiplier(e.target.value)} inputMode="decimal" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.radicalMultiplier")}</span>
                                <AppInput value={draftRadicalMultiplier} onChange={(e) => setDraftRadicalMultiplier(e.target.value)} inputMode="decimal" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.loyalistMultiplier")}</span>
                                <AppInput value={draftLoyalistMultiplier} onChange={(e) => setDraftLoyalistMultiplier(e.target.value)} inputMode="decimal" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.defaultParty")}</span>
                                <CustomSelect
                                  value={draftDefaultPartyId}
                                  onChange={setDraftDefaultPartyId}
                                  options={[{ value: "", label: t("contentPanel.notSelectedFeminine") }, ...partyOptions.map((option) => ({ value: option.id, label: option.name }))]}
                                  buttonClassName="h-[42px]"
                                />
                              </label>
                            </div>
                            <div className="grid gap-4 xl:grid-cols-2">
                              {renderNumberRecordEditor(t("contentPanel.professionWeights"), draftProfessionWeights, setDraftProfessionWeights, professionOptions, t("contentPanel.professionsEmpty"), t("contentPanel.select.profession"), "50")}
                              {renderNumberRecordEditor(t("contentPanel.closeIdeologies"), draftIdeologyWeights, setDraftIdeologyWeights, ideologyOptions, t("contentPanel.ideologiesEmpty"), t("contentPanel.select.ideology"), "50")}
                              {renderNumberRecordEditor(t("contentPanel.religionWeights"), draftReligionWeights, setDraftReligionWeights, religionOptions, t("contentPanel.religionsEmpty"), t("contentPanel.select.religion"), "25")}
                              {renderNumberRecordEditor(t("contentPanel.buildingWeights"), draftBuildingWeights, setDraftBuildingWeights, buildingOptions, t("contentPanel.buildingsEmpty"), t("contentPanel.select.building"), "25")}
                              {renderNumberRecordEditor(t("contentPanel.lawPreferences"), draftLawPreferences, setDraftLawPreferences, lawOptions, t("contentPanel.noExplicitPreferences"), t("contentPanel.select.law"), "0")}
                            </div>
                          </div>
                        )}
                        {activeCategory === "lawGroups" && (
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                              <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.defaultLaw")}</span>
                              <CustomSelect
                                value={draftDefaultLawId}
                                onChange={setDraftDefaultLawId}
                                options={[
                                  { value: "", label: t("contentPanel.notSelectedMasculine") },
                                  ...lawOptions.map((option) => ({ value: option.id, label: option.name })),
                                ]}
                                buttonClassName="h-[42px]"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.order")}</span>
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
                                <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.lawGroup")}</span>
                                <CustomSelect
                                  value={draftLawGroupId}
                                  onChange={setDraftLawGroupId}
                                  options={[
                                    { value: "", label: t("contentPanel.notSelectedFeminine") },
                                    ...lawGroupOptions.map((option) => ({ value: option.id, label: option.name })),
                                  ]}
                                  buttonClassName="h-[42px]"
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.enactmentDifficulty")}</span>
                                <AppInput
                                  value={draftEnactmentDifficulty}
                                  onChange={(e) => setDraftEnactmentDifficulty(e.target.value)}
                                  inputMode="decimal"
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.durationTurns")}</span>
                                <AppInput
                                  value={draftVotingDurationTurns}
                                  onChange={(e) => setDraftVotingDurationTurns(e.target.value)}
                                  inputMode="numeric"
                                />
                              </label>
                            </div>
                            <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.parliamentPower")}</div>
                              <div className="grid gap-3 md:grid-cols-3">
                                <label className="block">
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.domain")}</span>
                                  <CustomSelect
                                    value={draftParliamentPowerDomain}
                                    onChange={(value) => {
                                      const nextDomain = value as LawParliamentPowerEffect["domain"] | "";
                                      setDraftParliamentPowerDomain(nextDomain);
                                      setDraftParliamentPowerValue(nextDomain ? PARLIAMENT_POWER_VALUE_OPTIONS[nextDomain][0]?.value ?? "" : "");
                                    }}
                                    options={parliamentPowerDomainOptions}
                                    buttonClassName="h-[42px]"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.level")}</span>
                                  <CustomSelect
                                    value={draftParliamentPowerValue}
                                    onChange={setDraftParliamentPowerValue}
                                    options={
                                      draftParliamentPowerDomain
                                        ? PARLIAMENT_POWER_VALUE_OPTIONS[draftParliamentPowerDomain].map((option) => ({ value: option.value, label: t(option.labelKey) }))
                                        : [{ value: "", label: t("contentPanel.selectDomainFirst") }]
                                    }
                                    buttonClassName="h-[42px]"
                                  />
                                </label>
                                {draftParliamentPowerDomain === "diplomacy" ? (
                                  <label className="block">
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.majorPaymentThreshold")}</span>
                                    <AppInput
                                      value={draftParliamentPowerThreshold}
                                      onChange={(e) => setDraftParliamentPowerThreshold(e.target.value)}
                                      inputMode="numeric"
                                      placeholder="10000"
                                    />
                                  </label>
                                ) : (
                                  <div className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs leading-relaxed text-[rgb(var(--theme-text-muted))] md:mt-5">
                                    {t("contentPanel.parliamentPowerHint")}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.partyPreferencesForLaw")}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftLawPreferences((prev) => [
                                      ...prev,
                                      { targetId: partyOptions.find((option) => !prev.some((row) => row.targetId === option.id))?.id ?? "", value: "0" },
                                    ])
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))]"
                                >
                                  <Plus size={12} />
                                  {t("contentPanel.add")}
                                </button>
                              </div>
                              <div className="space-y-2">
                                {draftLawPreferences.length === 0 ? (
                                  <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.noExplicitPartyPreferences")}</div>
                                ) : (
                                  draftLawPreferences.map((row, index) => (
                                    <div key={`${row.targetId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_34px]">
                                      <CustomSelect
                                        value={row.targetId}
                                        onChange={(value) => setDraftLawPreferences((prev) => prev.map((item, i) => (i === index ? { ...item, targetId: value } : item)))}
                                        options={[{ value: "", label: t("contentPanel.select.party") }, ...partyOptions.map((option) => ({ value: option.id, label: option.name }))]}
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
                                        className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"
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
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                          <label className="block">
                            <Tooltip content={t("contentPanel.researchCostTooltip")}>
                              <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.researchCost")}</span>
                            </Tooltip>
                            <AppInput
                              value={draftCostScience}
                              onChange={(e) => setDraftCostScience(e.target.value)}
                              inputMode="decimal"
                            />
                          </label>
                          <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <Tooltip content={t("contentPanel.prerequisitesTooltip")}>
                                <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.prerequisites")}</span>
                              </Tooltip>
                              <button
                                type="button"
                                disabled={!nextPrerequisiteTechnologyId}
                                onClick={() => {
                                  if (!nextPrerequisiteTechnologyId) return;
                                  setDraftPrerequisiteTechnologyIds((prev) => normalizeCountryIdsDraft([...prev, nextPrerequisiteTechnologyId]));
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus size={12} />
                                {t("contentPanel.add")}
                              </button>
                            </div>
                            <div className="space-y-2">
                              {draftPrerequisiteTechnologyIds.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">
                                  {t("contentPanel.rootTechnology")}
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
                                        { value: "", label: t("contentPanel.select.technology") },
                                        ...selectableTechnologyOptions.map((option) => ({ value: option.id, label: option.name })),
                                      ]}
                                      buttonClassName="h-[38px]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setDraftPrerequisiteTechnologyIds((prev) => prev.filter((_, i) => i !== index))}
                                      className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]"
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
                          <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.unlocksBuildings")}</span>
                              <button
                                type="button"
                                disabled={!nextUnlockBuildingId}
                                onClick={() => setDraftUnlockBuildingIds((prev) => normalizeCountryIdsDraft([...prev, nextUnlockBuildingId]))}
                                className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus size={12} />
                                {t("contentPanel.add")}
                              </button>
                            </div>
                            <div className="space-y-2">
                              {draftUnlockBuildingIds.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.unlocksNoBuildings")}</div>
                              ) : (
                                draftUnlockBuildingIds.map((buildingId, index) => (
                                  <div key={`${buildingId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_34px]">
                                    <CustomSelect
                                      value={buildingId}
                                      onChange={(value) => setDraftUnlockBuildingIds((prev) => normalizeCountryIdsDraft(prev.map((item, i) => (i === index ? value : item))))}
                                      options={[{ value: "", label: t("contentPanel.select.building") }, ...buildingOptions.map((option) => ({ value: option.id, label: option.name }))]}
                                      buttonClassName="h-[38px]"
                                    />
                                    <button type="button" onClick={() => setDraftUnlockBuildingIds((prev) => prev.filter((_, i) => i !== index))} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.unlocksLaws")}</span>
                              <button
                                type="button"
                                disabled={!nextUnlockLawId}
                                onClick={() => setDraftUnlockLawIds((prev) => normalizeCountryIdsDraft([...prev, nextUnlockLawId]))}
                                className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--theme-border-subtle))] px-2 py-1 text-xs text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-surface-3))] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus size={12} />
                                {t("contentPanel.add")}
                              </button>
                            </div>
                            <div className="space-y-2">
                              {draftUnlockLawIds.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.unlocksNoLaws")}</div>
                              ) : (
                                draftUnlockLawIds.map((lawId, index) => (
                                  <div key={`${lawId}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_34px]">
                                    <CustomSelect
                                      value={lawId}
                                      onChange={(value) => setDraftUnlockLawIds((prev) => normalizeCountryIdsDraft(prev.map((item, i) => (i === index ? value : item))))}
                                      options={[{ value: "", label: t("contentPanel.select.law") }, ...lawOptions.map((option) => ({ value: option.id, label: option.name }))]}
                                      buttonClassName="h-[38px]"
                                    />
                                    <button type="button" onClick={() => setDraftUnlockLawIds((prev) => prev.filter((_, i) => i !== index))} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] text-[rgb(var(--theme-text-secondary))] transition hover:bg-[rgb(var(--theme-danger-soft))] hover:text-[rgb(var(--theme-danger))]">
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
                        <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                          {renderModifiersEditor()}
                        </section>
                    )}

                    {contentSection === "decisions" && activeCategory === "decisions" && (
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        {renderDecisionsEditor()}
                      </section>
                    )}

                    {contentSection === "events" && activeCategory === "events" && (
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        {renderEventsEditor()}
                      </section>
                    )}

                    {contentSection === "economy" && isMilitaryContentCategory(activeCategory) && (
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                          {[
                            ["contentPanel.field.manpower", draftBattalionManpower, setDraftBattalionManpower, "numeric"],
                            ["contentPanel.field.attack", draftBattalionAttack, setDraftBattalionAttack, "decimal"],
                            ["contentPanel.field.defense", draftBattalionDefense, setDraftBattalionDefense, "decimal"],
                            ["contentPanel.field.breakthrough", draftBattalionBreakthrough, setDraftBattalionBreakthrough, "decimal"],
                            ["contentPanel.field.organization", draftBattalionOrganization, setDraftBattalionOrganization, "decimal"],
                            ["contentPanel.field.hp", draftBattalionHp, setDraftBattalionHp, "decimal"],
                            ["contentPanel.field.speed", draftBattalionSpeed, setDraftBattalionSpeed, "decimal"],
                            ["contentPanel.field.supply", draftBattalionSupplyUse, setDraftBattalionSupplyUse, "decimal"],
                            ["contentPanel.field.trainingCostDucats", draftBattalionTrainingCostDucats, setDraftBattalionTrainingCostDucats, "decimal"],
                            ["contentPanel.field.trainingCostManpower", draftBattalionTrainingCostManpower, setDraftBattalionTrainingCostManpower, "decimal"],
                          ].map(([label, value, setter, inputMode]) => (
                            <label key={label as string} className="block">
                              <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t(label as UiTextKey)}</span>
                              <AppInput
                                value={value as string}
                                onChange={(e) => (setter as Dispatch<SetStateAction<string>>)(e.target.value)}
                                inputMode={inputMode as "decimal" | "numeric"}
                              />
                            </label>
                          ))}
                        </div>
                        <div className="mt-4 rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.equipmentNeeds")}</div>
                            <button
                              type="button"
                              onClick={() => setDraftBattalionEquipmentNeeds((prev) => [...prev, { goodId: goodsOptions[0]?.id ?? "", amount: "1" }])}
                              className="rounded-md border border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] px-2 py-1 text-[11px] font-semibold text-[rgb(var(--theme-success))] transition hover:bg-[rgb(var(--theme-success-soft))]"
                            >
                              {t("contentPanel.add")}
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
                                    { value: "", label: t("contentPanel.select.good") },
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
                                  className="rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] text-xs text-[rgb(var(--theme-danger))]"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {draftBattalionEquipmentNeeds.length === 0 && <div className="text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.equipmentNeedsEmpty")}</div>}
                          </div>
                        </div>
                      </section>
                    )}

                    {contentSection === "economy" && activeCategory === "buildings" && (
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        <div className="space-y-4">
                          <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                            <button
                              type="button"
                              onClick={() => setBuildingCostOpen((v) => !v)}
                              className="mb-2 flex w-full items-center justify-between rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-1.5 text-left"
                            >
                              <Tooltip content={t("contentPanel.buildingCostTooltip")}>
                                <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.buildingCost")}</div>
                              </Tooltip>
                              {buildingCostOpen ? (
                                <ChevronDown size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                              ) : (
                                <ChevronRight size={14} className="text-[rgb(var(--theme-text-secondary))]" />
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
                                <Tooltip content={t("contentPanel.industryTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.industry")}</span>
                                </Tooltip>
                                <CustomSelect
                                  value={draftIndustryId}
                                  onChange={setDraftIndustryId}
                                  options={[
                                    { value: "", label: t("contentPanel.notSpecifiedFeminine") },
                                    ...industryOptions.map((option) => ({ value: option.id, label: option.name })),
                                  ]}
                                  buttonClassName="h-[42px]"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content={t("contentPanel.sectorTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.sector")}</span>
                                </Tooltip>
                                <CustomSelect
                                  value={draftSectorId}
                                  onChange={setDraftSectorId}
                                  options={[
                                    { value: "", label: t("contentPanel.notSpecifiedFeminine") },
                                    ...sectorOptions.map((option) => ({ value: option.id, label: option.name })),
                                  ]}
                                  buttonClassName="h-[42px]"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content={t("contentPanel.constructionCostTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.constructionPoints")}</span>
                                </Tooltip>
                                <AppInput
                                  value={draftCostConstruction}
                                  onChange={(e) => setDraftCostConstruction(e.target.value)}
                                  inputMode="numeric"
                                  placeholder="100"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content={t("contentPanel.ducatCostTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.ducats")}</span>
                                </Tooltip>
                                <AppInput
                                  value={draftCostDucats}
                                  onChange={(e) => setDraftCostDucats(e.target.value)}
                                  inputMode="decimal"
                                  placeholder="10"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content={t("contentPanel.startingDucatsTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.startingDucats")}</span>
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

                          <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setBuildingUpgradeOpen((v) => !v)}
                                className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-1.5 text-left"
                              >
                                <Tooltip content={t("contentPanel.buildingUpgradeTooltip")}>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.buildingUpgrade")}</div>
                                </Tooltip>
                                {buildingUpgradeOpen ? (
                                  <ChevronDown size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                                ) : (
                                  <ChevronRight size={14} className="text-[rgb(var(--theme-text-secondary))]" />
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
                                <Tooltip content={t("contentPanel.maxLevelTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.maxLevel")}</span>
                                </Tooltip>
                                <AppInput
                                  value={draftMaxLevel}
                                  onChange={(e) => setDraftMaxLevel(e.target.value)}
                                  inputMode="numeric"
                                  placeholder="1"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content={t("contentPanel.maxDurabilityTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.maxDurability")}</span>
                                </Tooltip>
                                <AppInput
                                  value={draftMaxDurability}
                                  onChange={(e) => setDraftMaxDurability(e.target.value)}
                                  inputMode="decimal"
                                  placeholder="100"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content={t("contentPanel.upgradeDucatsTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.upgradeDucats")}</span>
                                </Tooltip>
                                <AppInput
                                  value={draftUpgradeCostDucats}
                                  onChange={(e) => setDraftUpgradeCostDucats(e.target.value)}
                                  inputMode="decimal"
                                  placeholder="10"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content={t("contentPanel.upgradeConstructionTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.constructionPoints")}</span>
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

                          <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setBuildingExtractionOpen((v) => !v)}
                                className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-1.5 text-left"
                              >
                                <Tooltip content={t("contentPanel.extractionTooltip")}>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.extraction")}</div>
                                </Tooltip>
                                {buildingExtractionOpen ? (
                                  <ChevronDown size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                                ) : (
                                  <ChevronRight size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                                )}
                              </button>
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
                            <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-3">
                              <label className="block">
                                <Tooltip content={t("contentPanel.extractionGoodTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.extractionGood")}</span>
                                </Tooltip>
                                <CustomSelect
                                  value={draftExtractionGoodId}
                                  onChange={setDraftExtractionGoodId}
                                  options={[
                                    { value: "", label: t("contentPanel.noExtraction") },
                                    ...goodsOptions.map((option) => ({ value: option.id, label: option.name })),
                                  ]}
                                  buttonClassName="h-[42px]"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content={t("contentPanel.extractionAmountTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.amountPerTurn")}</span>
                                </Tooltip>
                                <AppInput
                                  value={draftExtractionAmountPerTurn}
                                  onChange={(e) => setDraftExtractionAmountPerTurn(e.target.value)}
                                  inputMode="decimal"
                                  placeholder="0"
                                />
                              </label>
                              <label className="block">
                                <Tooltip content={t("contentPanel.requiresDepositTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.requiresDeposit")}</span>
                                </Tooltip>
                                <button
                                  type="button"
                                  onClick={() => setDraftExtractionRequiresDeposit((v) => !v)}
                                  className={`h-[42px] w-full rounded-lg border px-3 text-sm font-semibold transition ${
                                    draftExtractionRequiresDeposit
                                      ? "border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] text-[rgb(var(--theme-success))]"
                                      : "border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] text-[rgb(var(--theme-text-secondary))]"
                                  }`}
                                >
                                  {draftExtractionRequiresDeposit ? t("common.yes") : t("common.no")}
                                </button>
                              </label>
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                          <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setBuildingInputsOpen((v) => !v)}
                                className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-1.5 text-left"
                              >
                                <Tooltip content={t("contentPanel.inputGoodsTooltip")}>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.inputGoods")}</div>
                                </Tooltip>
                                {buildingInputsOpen ? (
                                  <ChevronDown size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                                ) : (
                                  <ChevronRight size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                                )}
                              </button>
                              {buildingInputsOpen && (
                                <Tooltip content={t("contentPanel.addInputGoodTooltip")}>
                                  <button
                                    type="button"
                                    onClick={() => setDraftInputs((prev) => [...prev, { goodId: goodsOptions[0]?.id ?? "", amount: "1" }])}
                                    className="rounded-md border border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] px-2 py-1 text-[11px] font-semibold text-[rgb(var(--theme-success))] transition hover:bg-[rgb(var(--theme-success-soft))]"
                                  >
                                    {t("contentPanel.add")}
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
                                <div key={`input-${index}`} className="grid grid-cols-[minmax(0,1fr)_110px_32px] gap-2">
                                  <CustomSelect
                                    value={row.goodId}
                                    onChange={(value) =>
                                      setDraftInputs((prev) => prev.map((r, i) => (i === index ? { ...r, goodId: value } : r)))
                                    }
                                    options={[
                                      { value: "", label: t("contentPanel.select.good") },
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
                                  <button
                                    type="button"
                                    onClick={() => setDraftInputs((prev) => prev.filter((_, i) => i !== index))}
                                    className="rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] text-xs text-[rgb(var(--theme-danger))]"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              {draftInputs.length === 0 && <div className="text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.inputGoodsEmpty")}</div>}
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                          <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setBuildingOutputsOpen((v) => !v)}
                                className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-1.5 text-left"
                              >
                                <Tooltip content={t("contentPanel.outputGoodsTooltip")}>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.outputGoods")}</div>
                                </Tooltip>
                                {buildingOutputsOpen ? (
                                  <ChevronDown size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                                ) : (
                                  <ChevronRight size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                                )}
                              </button>
                              {buildingOutputsOpen && (
                                <Tooltip content={t("contentPanel.addOutputGoodTooltip")}>
                                  <button
                                    type="button"
                                    onClick={() => setDraftOutputs((prev) => [...prev, { goodId: goodsOptions[0]?.id ?? "", amount: "1", affectedByFertility: false }])}
                                    className="rounded-md border border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] px-2 py-1 text-[11px] font-semibold text-[rgb(var(--theme-success))] transition hover:bg-[rgb(var(--theme-success-soft))]"
                                  >
                                    {t("contentPanel.add")}
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
                                <div key={`output-${index}`} className="grid grid-cols-[minmax(0,1fr)_110px_132px_32px] gap-2">
                                  <CustomSelect
                                    value={row.goodId}
                                    onChange={(value) =>
                                      setDraftOutputs((prev) => prev.map((r, i) => (i === index ? { ...r, goodId: value } : r)))
                                    }
                                    options={[
                                      { value: "", label: t("contentPanel.select.good") },
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
                                    {t("contentPanel.fertility")}
                                  </AppButton>
                                  <button
                                    type="button"
                                    onClick={() => setDraftOutputs((prev) => prev.filter((_, i) => i !== index))}
                                    className="rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] text-xs text-[rgb(var(--theme-danger))]"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              {draftOutputs.length === 0 && <div className="text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.outputGoodsEmpty")}</div>}
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                          <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setBuildingWorkforceOpen((v) => !v)}
                                className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-1.5 text-left"
                              >
                                <Tooltip content={t("contentPanel.workforceTooltip")}>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.workforce")}</div>
                                </Tooltip>
                                {buildingWorkforceOpen ? (
                                  <ChevronDown size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                                ) : (
                                  <ChevronRight size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                                )}
                              </button>
                              {buildingWorkforceOpen && (
                                <Tooltip content={t("contentPanel.addWorkforceTooltip")}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraftWorkforceRequirements((prev) => [
                                        ...prev,
                                        { professionId: professionOptions[0]?.id ?? "", workers: "100" },
                                      ])
                                    }
                                    className="rounded-md border border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] px-2 py-1 text-[11px] font-semibold text-[rgb(var(--theme-success))] transition hover:bg-[rgb(var(--theme-success-soft))]"
                                  >
                                    {t("contentPanel.add")}
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
                                      { value: "", label: t("contentPanel.select.profession") },
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
                                    className="rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] text-xs text-[rgb(var(--theme-danger))]"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              {draftWorkforceRequirements.length === 0 && <div className="text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.workforceEmpty")}</div>}
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                        </div>
                      </section>
                    )}

                    {contentSection === "criteria" && activeCategory === "buildings" && (
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        <div className="space-y-4">
                          <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                            <button
                              type="button"
                              onClick={() => setCriteriaCountriesOpen((v) => !v)}
                              className="mb-2 flex w-full items-center justify-between rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-1.5 text-left"
                            >
                              <Tooltip content={t("contentPanel.countryCriteriaTooltip")}>
                                <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.countryCriteria")}</div>
                              </Tooltip>
                              {criteriaCountriesOpen ? (
                                <ChevronDown size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                              ) : (
                                <ChevronRight size={14} className="text-[rgb(var(--theme-text-secondary))]" />
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
                                <Tooltip content={t("contentPanel.allowedCountriesTooltip")}>
                                  <div className="mb-1 text-[11px] text-[rgb(var(--theme-success))]/90">
                                    {t("contentPanel.allowedCountries", { count: String(allowedCountryIdsNormalized.length) })}
                                  </div>
                                </Tooltip>
                                <AppInput
                                  value={allowCountrySearch}
                                  onChange={(e) => setAllowCountrySearch(e.target.value)}
                                  placeholder={t("contentPanel.countrySearchPlaceholder")}
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
                                            ? "border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] text-[rgb(var(--theme-success))]"
                                            : "border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] text-[rgb(var(--theme-text-secondary))]"
                                        }`}
                                      >
                                        <span className="truncate">{country.name}</span>
                                        <span className={selected ? "text-[rgb(var(--theme-success))]" : "text-[rgb(var(--theme-text-muted))]"}>{selected ? "✓" : "○"}</span>
                                      </button>
                                    );
                                  })}
                                  {filteredAllowCountryOptions.length === 0 && (
                                    <div className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-2 text-xs text-[rgb(var(--theme-text-muted))]">
                                      {t("contentPanel.countriesNotFound")}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <Tooltip content={t("contentPanel.deniedCountriesTooltip")}>
                                  <div className="mb-1 text-[11px] text-[rgb(var(--theme-danger))]">
                                    {t("contentPanel.deniedCountries", { count: String(deniedCountryIdsNormalized.length) })}
                                  </div>
                                </Tooltip>
                                <AppInput
                                  value={denyCountrySearch}
                                  onChange={(e) => setDenyCountrySearch(e.target.value)}
                                  placeholder={t("contentPanel.countrySearchPlaceholder")}
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
                                            ? "border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] text-[rgb(var(--theme-danger))]"
                                            : "border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] text-[rgb(var(--theme-text-secondary))]"
                                        }`}
                                      >
                                        <span className="truncate">{country.name}</span>
                                        <span className={selected ? "text-[rgb(var(--theme-danger))]" : "text-[rgb(var(--theme-text-muted))]"}>{selected ? "✓" : "○"}</span>
                                      </button>
                                    );
                                  })}
                                  {filteredDenyCountryOptions.length === 0 && (
                                    <div className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-2 text-xs text-[rgb(var(--theme-text-muted))]">
                                      {t("contentPanel.countriesNotFound")}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            {conflictingCountryNames.length > 0 && (
                              <div className="mt-2 rounded-lg border border-[rgb(var(--theme-warning))] bg-[rgb(var(--theme-warning-soft))] px-2 py-1.5 text-xs text-[rgb(var(--theme-warning))]">
                                {t("contentPanel.countryCriteriaConflict", { countries: conflictingCountryNames.join(", ") })}
                              </div>
                            )}
                            <div className="mt-2 text-[11px] text-[rgb(var(--theme-text-muted))]">
                              {t("contentPanel.countryCriteriaHint")}
                            </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                          <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                            <button
                              type="button"
                              onClick={() => setCriteriaProvinceOpen((v) => !v)}
                              className="mb-2 flex w-full items-center justify-between rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-1.5 text-left"
                            >
                              <Tooltip content={t("contentPanel.provinceCriteriaTooltip")}>
                                <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.provinceCriteria")}</div>
                              </Tooltip>
                              {criteriaProvinceOpen ? (
                                <ChevronDown size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                              ) : (
                                <ChevronRight size={14} className="text-[rgb(var(--theme-text-secondary))]" />
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
                                {renderProvinceContentPicker(t("contentPanel.allowedProvinceTypes"), provinceTypeOptions, draftAllowedProvinceTypes, setDraftAllowedProvinceTypes)}
                                {renderProvinceContentPicker(t("contentPanel.deniedProvinceTypes"), provinceTypeOptions, draftDeniedProvinceTypes, setDraftDeniedProvinceTypes)}
                                {renderProvinceContentPicker(t("contentPanel.allowedClimate"), provinceClimateOptions, draftAllowedClimates, setDraftAllowedClimates)}
                                {renderProvinceContentPicker(t("contentPanel.deniedClimate"), provinceClimateOptions, draftDeniedClimates, setDraftDeniedClimates)}
                                {renderProvinceContentPicker(t("contentPanel.allowedLandscape"), provinceLandscapeOptions, draftAllowedLandscapes, setDraftAllowedLandscapes)}
                                {renderProvinceContentPicker(t("contentPanel.deniedLandscape"), provinceLandscapeOptions, draftDeniedLandscapes, setDraftDeniedLandscapes)}
                                {renderProvinceContentPicker(t("contentPanel.allowedContinents"), provinceContinentOptions, draftAllowedContinents, setDraftAllowedContinents)}
                                {renderProvinceContentPicker(t("contentPanel.deniedContinents"), provinceContinentOptions, draftDeniedContinents, setDraftDeniedContinents)}
                                {renderProvinceContentPicker(t("contentPanel.allowedStrategicRegions"), provinceStrategicRegionOptions, draftAllowedStrategicRegions, setDraftAllowedStrategicRegions)}
                                {renderProvinceContentPicker(t("contentPanel.deniedStrategicRegions"), provinceStrategicRegionOptions, draftDeniedStrategicRegions, setDraftDeniedStrategicRegions)}
                                <label className="block">
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.minRadiation")}</span>
                                  <AppInput value={draftMinRadiation} onChange={(e) => setDraftMinRadiation(e.target.value)} inputMode="decimal" placeholder={t("contentPanel.noMinimumPlaceholder")} />
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.maxRadiation")}</span>
                                  <AppInput value={draftMaxRadiation} onChange={(e) => setDraftMaxRadiation(e.target.value)} inputMode="decimal" placeholder={t("contentPanel.noMaximumPlaceholder")} />
                                </label>
                                <label className="block md:col-span-2">
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.pollutionProductivity")}</span>
                                  <CustomSelect
                                    value={draftPollutionProductivityMode}
                                    onChange={(value) => setDraftPollutionProductivityMode(value as PollutionProductivityModeDraft)}
                                    options={[
                                      { value: "penalty", label: t("contentPanel.option.pollutionProductivity.penalty") },
                                      { value: "bonus", label: t("contentPanel.option.pollutionProductivity.bonus") },
                                      { value: "ignore", label: t("contentPanel.option.pollutionProductivity.ignore") },
                                    ]}
                                    buttonClassName="h-[42px]"
                                  />
                                </label>
                              </div>
                              <div className="mt-2 text-[11px] text-[rgb(var(--theme-text-muted))]">
                                {t("contentPanel.provinceCriteriaHint")}
                              </div>
                            </motion.div>
                            ) : null}
                            </AnimatePresence>
                          </div>

                          <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                            <button
                              type="button"
                              onClick={() => setCriteriaLimitsOpen((v) => !v)}
                              className="mb-2 flex w-full items-center justify-between rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-1.5 text-left"
                            >
                              <Tooltip content={t("contentPanel.quantityLimitsTooltip")}>
                                <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.quantityLimits")}</div>
                              </Tooltip>
                              {criteriaLimitsOpen ? (
                                <ChevronDown size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                              ) : (
                                <ChevronRight size={14} className="text-[rgb(var(--theme-text-secondary))]" />
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
                                <Tooltip content={t("contentPanel.globalLimitTooltip")}>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">
                                    {t("contentPanel.globalLimit")}{" "}
                                    <span className="text-[rgb(var(--theme-warning))]/90">
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
                                  placeholder={t("contentPanel.noLimitPlaceholder")}
                                />
                              </label>
                            </div>
                            <div className="mb-2 flex items-center justify-between">
                              <Tooltip content={t("contentPanel.countryLimitsTooltip")}>
                                <div className="text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.countryLimits")}</div>
                              </Tooltip>
                              <button
                                type="button"
                                onClick={() => setDraftCountryBuildLimits((prev) => [...prev, { countryId: "", limit: "" }])}
                                className="rounded-md border border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] px-2 py-1 text-[11px] font-semibold text-[rgb(var(--theme-success))] transition hover:bg-[rgb(var(--theme-success-soft))]"
                              >
                                {t("contentPanel.addLimit")}
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
                                      { value: "", label: t("contentPanel.select.country") },
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
                                    placeholder={t("contentPanel.zeroNoLimitPlaceholder")}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setDraftCountryBuildLimits((prev) => prev.filter((_, i) => i !== index))}
                                    className="rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] text-xs text-[rgb(var(--theme-danger))]"
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
                                  <div key={`country-limit-usage-${index}`} className="text-[11px] text-[rgb(var(--theme-text-muted))]">
                                    {(countryOptions.find((country) => country.id === row.countryId)?.name ?? row.countryId ?? t("contentPanel.countryFallback"))}:
                                    {" "}
                                    <span className="text-[rgb(var(--theme-warning))]/90">{used}/{limit ?? "∞"}</span>
                                  </div>
                                );
                              })}
                              {draftCountryBuildLimits.length === 0 && (
                                <div className="text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.countryLimitsEmpty")}</div>
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
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                          <button
                            type="button"
                            onClick={() => setGoodsEconomyOpen((v) => !v)}
                            className="mb-2 flex w-full items-center justify-between rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-1.5 text-left"
                          >
                            <Tooltip content={t("contentPanel.goodEconomyTooltip")}>
                              <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.goodEconomy")}</div>
                            </Tooltip>
                            {goodsEconomyOpen ? (
                              <ChevronDown size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                            ) : (
                              <ChevronRight size={14} className="text-[rgb(var(--theme-text-secondary))]" />
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
                                  <Tooltip content={t("contentPanel.basePriceTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.basePrice")}</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftBasePrice}
                                    onChange={(e) => setDraftBasePrice(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="1"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content={t("contentPanel.minPriceTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.minPrice")}</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftMinPrice}
                                    onChange={(e) => setDraftMinPrice(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="0.1"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content={t("contentPanel.maxPriceTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.maxPrice")}</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftMaxPrice}
                                    onChange={(e) => setDraftMaxPrice(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="10"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content={t("contentPanel.infraPerUnitTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.infraPerUnit")}</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftInfraPerUnit}
                                    onChange={(e) => setDraftInfraPerUnit(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="1"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content={t("contentPanel.infrastructureCategoryTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.infrastructureCategory")}</span>
                                  </Tooltip>
                                  <CustomSelect
                                    value={draftResourceCategoryId}
                                    onChange={setDraftResourceCategoryId}
                                    options={[
                                      { value: "", label: t("contentPanel.noCategory") },
                                      ...resourceCategoryOptions.map((option) => ({ value: option.id, label: option.name })),
                                    ]}
                                    buttonClassName="h-[42px]"
                                  />
                                </label>
                              </div>
                              <Tooltip content={t("contentPanel.referencePriceTooltip")}>
                                <div className="mt-1 text-[11px] text-[rgb(var(--theme-text-muted))]">{t("contentPanel.referencePriceHint")}</div>
                              </Tooltip>
                              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                <label className="block">
                                  <Tooltip content={t("contentPanel.distributionTypeTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.distributionType")}</span>
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
                                    options={localizeOptions(GOOD_DISTRIBUTION_OPTIONS)}
                                    buttonClassName="h-[42px]"
                                  />
                                </label>
                                <div>
                                  <Tooltip content={t("contentPanel.allowedTransportTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.allowedTransport")}</span>
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
                                              : "border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] text-[rgb(var(--theme-text-secondary))] hover:border-[rgb(var(--theme-border-subtle))] hover:text-[rgb(var(--theme-text-secondary))]"
                                          }`}
                                        >
                                          {t(option.labelKey)}
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
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                          <button
                            type="button"
                            onClick={() => setGoodsExplorationOpen((v) => !v)}
                            className="mb-2 flex w-full items-center justify-between rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-2 py-1.5 text-left"
                          >
                            <Tooltip content={t("contentPanel.goodExplorationTooltip")}>
                              <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.goodExploration")}</div>
                            </Tooltip>
                            {goodsExplorationOpen ? (
                              <ChevronDown size={14} className="text-[rgb(var(--theme-text-secondary))]" />
                            ) : (
                              <ChevronRight size={14} className="text-[rgb(var(--theme-text-secondary))]" />
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
                              <label className="mb-3 flex items-center gap-2 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={draftIsResourceDiscoverable}
                                  onChange={(e) => setDraftIsResourceDiscoverable(e.target.checked)}
                                  className="h-4 w-4 rounded border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] accent-[rgb(var(--theme-success))]"
                                />
                                <span className="text-xs text-[rgb(var(--theme-text-primary))]">{t("contentPanel.resourceDiscoverable")}</span>
                              </label>
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                                <label className="block">
                                  <Tooltip content={t("contentPanel.explorationBaseWeightTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.baseWeight")}</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftExplorationBaseWeight}
                                    onChange={(e) => setDraftExplorationBaseWeight(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="1"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content={t("contentPanel.smallVeinChanceTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.smallVeinChance")}</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftExplorationSmallChance}
                                    onChange={(e) => setDraftExplorationSmallChance(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="60"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content={t("contentPanel.mediumVeinChanceTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.mediumVeinChance")}</span>
                                  </Tooltip>
                                  <AppInput
                                    value={draftExplorationMediumChance}
                                    onChange={(e) => setDraftExplorationMediumChance(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="30"
                                  />
                                </label>
                                <label className="block">
                                  <Tooltip content={t("contentPanel.largeVeinChanceTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.largeVeinChance")}</span>
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
                                  <Tooltip content={t("contentPanel.smallVeinRangeTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.smallVeinRange")}</span>
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
                                  <Tooltip content={t("contentPanel.mediumVeinRangeTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.mediumVeinRange")}</span>
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
                                  <Tooltip content={t("contentPanel.largeVeinRangeTooltip")}>
                                    <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.largeVeinRange")}</span>
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
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                          <Tooltip content={t("contentPanel.professionEconomyTooltip")}>
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">
                              {t("contentPanel.professionEconomy")}
                            </span>
                          </Tooltip>
                          <label className="block">
                            <Tooltip content={t("contentPanel.baseWageTooltip")}>
                              <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.baseWage")}</span>
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
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[rgb(var(--theme-text-primary))]">{t("contentPanel.cultureNeeds")}</div>
                            <div className="text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.cultureNeedsHint")}</div>
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
                                      label: t("contentPanel.defaultNeed.basicFood"),
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
                            {t("contentPanel.addTier")}
                          </button>
                        </div>
                        <div className="space-y-3">
                          {draftNeedsProfile.map((tier, tierIndex) => (
                            <div key={`${tier.id}-${tierIndex}`} className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                              <div className="mb-3 grid gap-2 md:grid-cols-[1fr_160px_auto]">
                                <label>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.tierId")}</span>
                                  <AppInput
                                    value={tier.id}
                                    onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => (i === tierIndex ? { ...row, id: e.target.value } : row)))}
                                  />
                                </label>
                                <label>
                                  <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.minStandardOfLiving")}</span>
                                  <AppInput
                                    value={tier.minStandardOfLiving}
                                    onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => (i === tierIndex ? { ...row, minStandardOfLiving: e.target.value } : row)))}
                                    inputMode="decimal"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setDraftNeedsProfile((prev) => prev.filter((_, i) => i !== tierIndex))}
                                  className="self-end rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] px-3 py-2 text-xs font-semibold text-[rgb(var(--theme-danger))]"
                                >
                                  {t("contentPanel.delete")}
                                </button>
                              </div>
                              <div className="space-y-2">
                                {tier.needs.map((need, needIndex) => (
                                  <div key={`${need.id}-${needIndex}`} className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                                    <div className="grid gap-2 md:grid-cols-5">
                                      <label>
                                        <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">ID</span>
                                        <AppInput
                                          value={need.id}
                                          onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, id: e.target.value } : n) } : row))}
                                        />
                                      </label>
                                      <label>
                                        <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.name")}</span>
                                        <AppInput
                                          value={need.label}
                                          onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, label: e.target.value } : n) } : row))}
                                        />
                                      </label>
                                      <label>
                                        <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.category")}</span>
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
                                          options={needCategoryOptions}
                                          placeholder={t("contentPanel.field.category")}
                                        />
                                      </label>
                                      <label>
                                        <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.field.amountPerPerson")}</span>
                                        <AppInput
                                          value={need.amountPerPerson}
                                          onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, amountPerPerson: e.target.value } : n) } : row))}
                                          inputMode="decimal"
                                        />
                                      </label>
                                      <label>
                                        <span className="mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.placeholder.weight")}</span>
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
                                            placeholder={t("contentPanel.select.good")}
                                          />
                                          <AppInput
                                            value={good.weight}
                                            onChange={(e) => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, goods: n.goods.map((g, k) => k === goodIndex ? { ...g, weight: e.target.value } : g) } : n) } : row))}
                                            inputMode="decimal"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, goods: n.goods.filter((_, k) => k !== goodIndex) } : n) } : row))}
                                            className="rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] px-3 py-2 text-xs font-semibold text-[rgb(var(--theme-danger))]"
                                          >
                                            {t("contentPanel.delete")}
                                          </button>
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.map((n, j) => j === needIndex ? { ...n, goods: [...n.goods, { goodId: goodsOptions[0]?.id ?? "", weight: "1" }] } : n) } : row))}
                                        className="rounded-lg border border-[rgb(var(--theme-border-subtle))] px-3 py-2 text-xs font-semibold text-[rgb(var(--theme-text-primary))]"
                                      >
                                        {t("contentPanel.addSubstituteGood")}
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: row.needs.filter((_, j) => j !== needIndex) } : row))}
                                      className="mt-2 rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] px-3 py-2 text-xs font-semibold text-[rgb(var(--theme-danger))]"
                                    >
                                      {t("contentPanel.deleteNeed")}
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setDraftNeedsProfile((prev) => prev.map((row, i) => i === tierIndex ? { ...row, needs: [...row.needs, { id: `need-${row.needs.length + 1}`, label: t("contentPanel.defaultNeed.newNeed"), category: "basic", amountPerPerson: "0.01", weight: "1", goods: [{ goodId: goodsOptions[0]?.id ?? "", weight: "1" }] }] } : row))}
                                  className="rounded-lg border border-[rgb(var(--theme-border-subtle))] px-3 py-2 text-xs font-semibold text-[rgb(var(--theme-text-primary))]"
                                >
                                  {t("contentPanel.addNeed")}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {contentSection === "branding" && (
                      <section className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4">
                        <Tooltip content={activeCategory === "events" || activeCategory === "decisions" ? t("contentPanel.imageTooltip") : t("contentPanel.logoTooltip")}>
                          <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">
                            {activeCategory === "events" || activeCategory === "decisions" ? t("contentPanel.image") : t("contentPanel.logo")}
                          </span>
                        </Tooltip>
                        <div className="flex flex-wrap items-start gap-4">
                          <div className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))]">
                            {draftLogoUrl ? (
                              <img src={draftLogoUrl} alt={t("contentPanel.entryLogoAlt")} className="h-full w-full object-contain p-1" />
                            ) : (
                              <span className="text-xs font-semibold" style={{ color: draftColor }}>
                                {draftName.trim().slice(0, 1).toUpperCase() || t("contentPanel.fallbackInitial")}
                              </span>
                            )}
                          </div>
                          <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                            <Tooltip content={activeCategory === "events" || activeCategory === "decisions" ? t("contentPanel.imageUploadTooltip") : t("contentPanel.logoUploadTooltip")}>
                              <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-arc-accent px-3 text-sm font-semibold text-black transition hover:brightness-110">
                                <Upload size={14} />
                                {activeCategory === "events" || activeCategory === "decisions" ? t("contentPanel.uploadImage") : t("contentPanel.uploadLogo")}
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
                                  toast.error(t("contentPanel.logoDeleteFailed"));
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={!selectedEntry || saving}
                              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] px-3 text-sm font-semibold text-[rgb(var(--theme-danger))] transition hover:border-[rgb(var(--theme-danger))] hover:bg-[rgb(var(--theme-danger-soft))] disabled:opacity-50"
                            >
                              {activeCategory === "events" || activeCategory === "decisions" ? t("contentPanel.deleteImage") : t("contentPanel.deleteLogo")}
                            </button>
                            <div className="text-xs text-[rgb(var(--theme-text-muted))]">
                              {activeCategory === "events" || activeCategory === "decisions" ? t("contentPanel.imageSizeHint") : t("contentPanel.logoSizeHint")}
                            </div>
                          </div>
                        </div>
                        {activeCategory === "races" && (
                          <div className="mt-4 border-t border-[rgb(var(--theme-border-subtle))] pt-4">
                            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("contentPanel.racePortraits")}</div>
                            <div className="grid gap-4 md:grid-cols-2">
                              {([
                                { slot: "male", label: t("contentPanel.malePortrait"), url: draftMalePortraitUrl },
                                { slot: "female", label: t("contentPanel.femalePortrait"), url: draftFemalePortraitUrl },
                              ] as const).map((portrait) => (
                                <div key={portrait.slot} className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                                  <div className="mb-2 text-[11px] text-[rgb(var(--theme-text-secondary))]">{portrait.label}</div>
                                  <div className="mb-3 flex h-[100px] w-[89px] items-center justify-center overflow-hidden rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))]">
                                    {portrait.url ? (
                                      <img src={portrait.url} alt={portrait.label} className="h-full w-full object-cover" />
                                    ) : (
                                      <span className="text-[10px] text-[rgb(var(--theme-text-muted))]">89x100</span>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <label className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-arc-accent px-3 text-xs font-semibold text-black transition hover:brightness-110">
                                      <Upload size={13} />
                                      {t("civilopedia.admin.upload")}
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
                                          toast.error(t("contentPanel.portraitDeleteFailed"));
                                        } finally {
                                          setSaving(false);
                                        }
                                      }}
                                      disabled={!selectedEntry || saving}
                                      className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] px-3 text-xs font-semibold text-[rgb(var(--theme-danger))] transition hover:border-[rgb(var(--theme-danger))] hover:bg-[rgb(var(--theme-danger-soft))] disabled:opacity-50"
                                    >
                                      {t("contentPanel.delete")}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.portraitSizeHint")}</div>
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
              <AppModalHeader title={t("contentPanel.deleteConfirmTitle")} onClose={() => setDeleteConfirmOpen(false)} />
              <div className="mt-2 text-sm text-[rgb(var(--theme-text-secondary))]">
                {t("contentPanel.deleteConfirmPrefix")} <span className="font-semibold text-[rgb(var(--theme-text-primary))]">"{selectedEntry?.name ?? t("contentPanel.untitled")}"</span> {t("contentPanel.deleteConfirmSuffix")}
              </div>
              <div className="mt-1 text-xs text-[rgb(var(--theme-text-muted))]">{t("contentPanel.deleteLogoConsequence")}</div>
              <div className="mt-4 flex justify-end gap-2">
                <AppButton
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  variant="ghost"
                >
                  {t("common.cancel")}
                </AppButton>
                <AppButton
                  type="button"
                  onClick={() => void deleteEntry()}
                  disabled={saving}
                  variant="danger"
                >
                  {t("contentPanel.delete")}
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
              <AppModalHeader title={t("contentPanel.closeConfirmTitle")} onClose={() => setCloseConfirmOpen(false)} />
              <AppCard className="mt-2 bg-[rgb(var(--theme-surface-2))] text-sm text-[rgb(var(--theme-text-secondary))]">{t("contentPanel.closeConfirmBody")}</AppCard>
              <div className="mt-4 flex justify-end gap-2">
                <AppButton
                  type="button"
                  onClick={() => setCloseConfirmOpen(false)}
                  variant="ghost"
                >
                  {t("contentPanel.stay")}
                </AppButton>
                <AppButton
                  type="button"
                  onClick={() => {
                    setCloseConfirmOpen(false);
                    onClose();
                  }}
                  variant="danger"
                >
                  {t("contentPanel.closeWithoutSaving")}
                </AppButton>
              </div>
      </AppModal>
    </>
  );
}
