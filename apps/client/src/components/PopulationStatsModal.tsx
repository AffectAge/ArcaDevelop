import type { RegionPopulation, WorldBase } from "@arcanorum/shared";
import * as echarts from "echarts";
import type { EChartsType } from "echarts";
import { BarChart3, Briefcase, FileText, Flame, Globe2, MapPinned, Package, Palette, ScrollText, Sticker, UserRound, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchContentEntries, type ContentEntryKind } from "../lib/api";
import { useUiText } from "../i18n/useUiText";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState, AppSection, AppSectionHeader, AppToolbar } from "./ui/AppSurface";
import { AppCell, AppHeadCell, AppTable, AppTableShell } from "./ui/AppTable";

type Props = {
  open: boolean;
  onClose: () => void;
  worldBase: WorldBase | null;
  countryId: string;
  countryName: string;
};

type ViewMode = "country" | "world";
type PanelSection = "general" | "groups" | "needs" | "finance" | "religions" | "cultures" | "professions" | "ideologies" | "races" | "branding";
type PopulationDimensionKey = "culturePct" | "ideologyPct" | "religionPct" | "racePct" | "professionPct";
type PopulationPopField = "cultureId" | "religionId" | "raceId";

type PopulationAggregate = {
  totalPopulation: number;
  regionCount: number;
  breakdown: Record<PopulationDimensionKey, Record<string, number>>;
};

type ContentEntryMeta = {
  name: string;
  color: string;
  logoUrl: string | null;
  malePortraitUrl: string | null;
  femalePortraitUrl: string | null;
};

type PopulationContentKind = "cultures" | "ideologies" | "religions" | "races" | "professions" | "goods";

type NeedCategoryKey = "survival" | "basic" | "comfort" | "luxury";

type BreakdownRow = {
  id: string;
  label: string;
  pct: number;
  color: string;
  imageUrl: string | null;
};

type FinanceFlowRow = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type RegionFinanceRow = {
  regionId: string;
  regionName: string;
  population: number;
  treasury: number;
  income: number;
  expenses: number;
  netBalance: number;
  capitalPerCapita: number;
};

type PopulationGroupRow = {
  id: string;
  regionName: string;
  size: number;
  culture: string;
  religion: string;
  race: string;
  professionCount: number;
  averageSoL: number;
  satisfaction: number;
  ducats: number;
  radicals: number;
  loyalists: number;
  births: number;
  deaths: number;
};

type PopulationProfessionRow = {
  id: string;
  regionName: string;
  groupId: string;
  profession: string;
  size: number;
  ducats: number;
  standardOfLiving: number;
  satisfaction: number;
  income: number;
  spend: number;
  radicals: number;
  loyalists: number;
  births: number;
  deaths: number;
  categorySatisfaction: Record<NeedCategoryKey, number>;
};

type NeedCategoryRow = {
  category: NeedCategoryKey;
  label: string;
  required: number;
  fulfilled: number;
  spend: number;
  satisfaction: number;
};

type NeedDeficitRow = {
  goodId: string;
  goodName: string;
  amount: number;
};

type NeedBudgetShortageRow = {
  goodId: string;
  goodName: string;
  amount: number;
};

const DIMENSION_LABELS: Array<{ key: PopulationDimensionKey; label: string }> = [
  { key: "culturePct", label: "Культуры" },
  { key: "ideologyPct", label: "Идеологии" },
  { key: "religionPct", label: "Религии" },
  { key: "racePct", label: "Расы" },
  { key: "professionPct", label: "Профессии" },
];

const STAT_TABS: Array<{
  id: PanelSection;
  label: string;
  icon: typeof FileText;
  dimension?: PopulationDimensionKey;
}> = [
  { id: "general", label: "Основная информация", icon: FileText },
  { id: "groups", label: "Группы", icon: Users },
  { id: "needs", label: "Потребности", icon: Package },
  { id: "finance", label: "Финансы населения", icon: BarChart3 },
  { id: "religions", label: "Религии", icon: ScrollText, dimension: "religionPct" },
  { id: "cultures", label: "Культуры", icon: Palette, dimension: "culturePct" },
  { id: "professions", label: "Профессии", icon: Briefcase, dimension: "professionPct" },
  { id: "ideologies", label: "Идеологии", icon: Flame, dimension: "ideologyPct" },
  { id: "races", label: "Расы", icon: UserRound, dimension: "racePct" },
  { id: "branding", label: "Логотип и стиль", icon: Sticker },
];

const KIND_BY_DIMENSION: Record<PopulationDimensionKey, PopulationContentKind> = {
  culturePct: "cultures",
  ideologyPct: "ideologies",
  religionPct: "religions",
  racePct: "races",
  professionPct: "professions",
};

const POP_FIELD_BY_DIMENSION: Record<"culturePct" | "religionPct" | "racePct", PopulationPopField> = {
  culturePct: "cultureId",
  religionPct: "religionId",
  racePct: "raceId",
};

const NEED_CATEGORY_LABELS: Record<NeedCategoryKey, string> = {
  survival: "Выживание",
  basic: "Базовые",
  comfort: "Комфорт",
  luxury: "Роскошь",
};

function formatInt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.max(0, Math.floor(value)));
}

const FALLBACK_COLORS = [
  "#4ade80",
  "#38bdf8",
  "#f59e0b",
  "#f87171",
  "#a78bfa",
  "#22d3ee",
  "#fb7185",
  "#84cc16",
  "#f97316",
  "#60a5fa",
];

const NEGATIVE_BALANCE_STREAK_TARGET = 3;
const LOW_CAPITAL_PER_CAPITA_THRESHOLD = 0.1;

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length] ?? "#9ca3af";
}

function round3(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(3));
}

function getPopulationTotal(population: RegionPopulation | null | undefined): number {
  return Math.max(0, Math.floor((population?.pops ?? []).reduce((sum, pop) => sum + Math.max(0, Number(pop.size)), 0)));
}

function formatSignedInt(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${formatInt(rounded)}`;
  if (rounded < 0) return `-${formatInt(Math.abs(rounded))}`;
  return "0";
}

function weightedAverage(rows: Array<{ value: number; weight: number }>, fallback = 0): number {
  const totalWeight = rows.reduce((sum, row) => sum + Math.max(0, row.weight), 0);
  if (totalWeight <= 0) return fallback;
  return rows.reduce((sum, row) => sum + Math.max(0, row.value) * Math.max(0, row.weight), 0) / totalWeight;
}

function resolveScopeRegionIds(worldBase: WorldBase | null, scope: ViewMode, countryId: string): string[] {
  if (!worldBase) return [];
  const ownerByRegion = worldBase.regionOwner ?? {};
  const populationByRegion = worldBase.regionPopulationByRegion ?? {};
  return Object.keys(populationByRegion).filter((regionId) => scope === "world" || ownerByRegion[regionId] === countryId);
}

function normalizeColor(value: string | null | undefined, id: string): string {
  if (!value) return colorFromId(id);
  const trimmed = value.trim();
  if (trimmed.length === 0) return colorFromId(id);
  return trimmed;
}

function aggregatePopulation(
  worldBase: WorldBase | null,
  scope: "country" | "world",
  countryId: string,
): PopulationAggregate {
  const empty: PopulationAggregate = {
    totalPopulation: 0,
    regionCount: 0,
    breakdown: {
      culturePct: {},
      ideologyPct: {},
      religionPct: {},
      racePct: {},
      professionPct: {},
    },
  };
  if (!worldBase) return empty;

  const byRegion = worldBase.regionPopulationByRegion ?? {};
  const ownerByRegion = worldBase.regionOwner ?? {};
  const regionIds = Object.keys(byRegion).filter((regionId) => scope === "world" || ownerByRegion[regionId] === countryId);
  if (regionIds.length === 0) {
    return empty;
  }

  let totalPopulation = 0;
  const weighted: PopulationAggregate["breakdown"] = {
    culturePct: {},
    ideologyPct: {},
    religionPct: {},
    racePct: {},
    professionPct: {},
  };

  for (const regionId of regionIds) {
    const population = byRegion[regionId] as RegionPopulation | undefined;
    if (!population) continue;
    const regionTotal = getPopulationTotal(population);
    if (regionTotal <= 0) continue;
    totalPopulation += regionTotal;
    for (const pop of population.pops) {
      const size = Math.max(0, Number(pop.size));
      if (size <= 0) continue;
      for (const { key } of DIMENSION_LABELS) {
        if (key === "ideologyPct") {
          for (const [valueKey, amount] of Object.entries(pop.ideologies)) {
            weighted[key][valueKey] = (weighted[key][valueKey] ?? 0) + Math.max(0, Number(amount));
          }
        } else if (key === "professionPct") {
          for (const [valueKey, amount] of Object.entries(pop.professions)) {
            weighted[key][valueKey] = (weighted[key][valueKey] ?? 0) + Math.max(0, Number(amount.size));
          }
        } else {
          const valueKey = pop[POP_FIELD_BY_DIMENSION[key]];
          weighted[key][valueKey] = (weighted[key][valueKey] ?? 0) + size;
        }
      }
    }
  }

  if (totalPopulation <= 0) {
    return {
      totalPopulation: 0,
      regionCount: regionIds.length,
      breakdown: {
        culturePct: {},
        ideologyPct: {},
        religionPct: {},
        racePct: {},
        professionPct: {},
      },
    };
  }

  const normalized: PopulationAggregate["breakdown"] = {
    culturePct: {},
    ideologyPct: {},
    religionPct: {},
    racePct: {},
    professionPct: {},
  };
  for (const { key } of DIMENSION_LABELS) {
    for (const [valueKey, weightedValue] of Object.entries(weighted[key])) {
      normalized[key][valueKey] = (weightedValue / totalPopulation) * 100;
    }
  }

  return {
    totalPopulation,
    regionCount: regionIds.length,
    breakdown: normalized,
  };
}

export function PopulationStatsModal({ open, onClose, worldBase, countryId, countryName }: Props) {
  const { t } = useUiText();
  const [mode, setMode] = useState<ViewMode>("country");
  const [section, setSection] = useState<PanelSection>("general");
  const [selectedByDimension, setSelectedByDimension] = useState<Partial<Record<PopulationDimensionKey, string>>>({});
  const [hoveredByDimension, setHoveredByDimension] = useState<Partial<Record<PopulationDimensionKey, string>>>({});
  const [entryByKindById, setEntryByKindById] = useState<Record<PopulationContentKind, Record<string, ContentEntryMeta>>>({
    cultures: {},
    ideologies: {},
    religions: {},
    races: {},
    professions: {},
    goods: {},
  });
  const pieRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const groupVitalsChartRef = useRef<HTMLDivElement | null>(null);
  const groupLoyaltyChartRef = useRef<HTMLDivElement | null>(null);
  const groupVitalsInstanceRef = useRef<EChartsType | null>(null);
  const groupLoyaltyInstanceRef = useRef<EChartsType | null>(null);
  const prevTreasuryByModeRef = useRef<Record<ViewMode, number | null>>({ country: null, world: null });
  const treasuryTurnByModeRef = useRef<Record<ViewMode, number>>({ country: 0, world: 0 });
  const negativeStreakByModeRef = useRef<Record<ViewMode, Record<string, number>>>({ country: {}, world: {} });
  const negativeStreakTurnByModeRef = useRef<Record<ViewMode, number>>({ country: 0, world: 0 });
  const [treasuryDeltaByMode, setTreasuryDeltaByMode] = useState<Record<ViewMode, number | null>>({ country: null, world: null });
  const [negativeStreakTick, setNegativeStreakTick] = useState(0);

  const countryStats = useMemo(() => aggregatePopulation(worldBase, "country", countryId), [countryId, worldBase]);
  const worldStats = useMemo(() => aggregatePopulation(worldBase, "world", countryId), [countryId, worldBase]);
  const stats = mode === "country" ? countryStats : worldStats;
  const title = mode === "country" ? t("population.countryTitle", { country: countryName }) : t("population.worldTitle");
  const subtitle = mode === "country" ? t("population.countryRegionSubtitle") : t("population.worldRegionSubtitle");
  const activeTab = STAT_TABS.find((tab) => tab.id === section) ?? STAT_TABS[0];
  const activeDimension = activeTab.dimension ?? null;
  const scopedRegionIds = useMemo(() => resolveScopeRegionIds(worldBase, mode, countryId), [countryId, mode, worldBase]);

  const populationTables = useMemo(() => {
    const groupRows: PopulationGroupRow[] = [];
    const professionRows: PopulationProfessionRow[] = [];
    if (!worldBase) return { groupRows, professionRows };
    const populationByRegion = worldBase.regionPopulationByRegion ?? {};
    const regionNameById: Record<string, string> = {};

    for (const regionId of scopedRegionIds) {
      const population = populationByRegion[regionId];
      if (!population) continue;
      const regionName = regionNameById[regionId] ?? regionId;
      for (const pop of population.pops ?? []) {
        const professionStates = Object.entries(pop.professions ?? {});
        const size = Math.max(0, Number(pop.size));
        const groupDucats = professionStates.reduce((sum, [, state]) => sum + Math.max(0, Number(state.ducats)), 0);
        const groupRadicals = professionStates.reduce((sum, [, state]) => sum + Math.max(0, Number(state.radicals)), 0);
        const groupLoyalists = professionStates.reduce((sum, [, state]) => sum + Math.max(0, Number(state.loyalists)), 0);
        const groupBirths = professionStates.reduce((sum, [, state]) => sum + Math.max(0, Number(state.lastBirths)), 0);
        const groupDeaths = professionStates.reduce((sum, [, state]) => sum + Math.max(0, Number(state.lastDeaths)), 0);
        const averageSoL = weightedAverage(
          professionStates.map(([, state]) => ({ value: Number(state.standardOfLiving), weight: Number(state.size) })),
        );
        const satisfaction = weightedAverage(
          professionStates.map(([, state]) => ({ value: Number(state.lastNeedsSatisfaction), weight: Number(state.size) })),
          1,
        );

        groupRows.push({
          id: `${regionId}:${pop.id}`,
          regionName,
          size,
          culture: entryByKindById.cultures[pop.cultureId]?.name ?? pop.cultureId,
          religion: entryByKindById.religions[pop.religionId]?.name ?? pop.religionId,
          race: entryByKindById.races[pop.raceId]?.name ?? pop.raceId,
          professionCount: professionStates.length,
          averageSoL,
          satisfaction,
          ducats: groupDucats,
          radicals: groupRadicals,
          loyalists: groupLoyalists,
          births: groupBirths,
          deaths: groupDeaths,
        });

        for (const [professionId, state] of professionStates) {
          professionRows.push({
            id: `${regionId}:${pop.id}:${professionId}`,
            regionName,
            groupId: pop.id,
            profession: entryByKindById.professions[professionId]?.name ?? professionId,
            size: Math.max(0, Number(state.size)),
            ducats: Math.max(0, Number(state.ducats)),
            standardOfLiving: Math.max(0, Number(state.standardOfLiving)),
            satisfaction: Math.max(0, Number(state.lastNeedsSatisfaction)),
            income: Math.max(0, Number(state.lastIncomeDucats)),
            spend: Math.max(0, Number(state.lastNeedsSpendDucats)),
            radicals: Math.max(0, Number(state.radicals)),
            loyalists: Math.max(0, Number(state.loyalists)),
            births: Math.max(0, Number(state.lastBirths)),
            deaths: Math.max(0, Number(state.lastDeaths)),
            categorySatisfaction: {
              survival: Math.max(0, Number(state.lastNeedsByCategory?.survival?.satisfaction ?? 1)),
              basic: Math.max(0, Number(state.lastNeedsByCategory?.basic?.satisfaction ?? 1)),
              comfort: Math.max(0, Number(state.lastNeedsByCategory?.comfort?.satisfaction ?? 1)),
              luxury: Math.max(0, Number(state.lastNeedsByCategory?.luxury?.satisfaction ?? 1)),
            },
          });
        }
      }
    }

    return {
      groupRows: groupRows.sort((a, b) => b.size - a.size),
      professionRows: professionRows.sort((a, b) => b.size - a.size),
    };
  }, [entryByKindById, scopedRegionIds, worldBase]);

  const financeStats = useMemo(() => {
    if (!worldBase) {
      return {
        totalTreasury: 0,
        totalPopulation: 0,
        incomeRows: [
          { id: "wages", label: "Зарплаты от зданий", value: 0, color: "#34d399" },
          { id: "transfers", label: "Соцвыплаты/трансферты", value: 0, color: "#60a5fa" },
          { id: "other-income", label: "Прочие источники", value: 0, color: "#f59e0b" },
        ] satisfies FinanceFlowRow[],
        expenseRows: [
          { id: "goods", label: "Покупка товаров населением", value: 0, color: "#f87171" },
          { id: "taxes", label: "Налоги/сборы", value: 0, color: "#fb7185" },
          { id: "other-expense", label: "Прочие траты", value: 0, color: "#a78bfa" },
        ] satisfies FinanceFlowRow[],
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0,
        byRegion: [] as RegionFinanceRow[],
      };
    }

    const populationByRegion = worldBase.regionPopulationByRegion ?? {};
    const regionNameById: Record<string, string> = {};

    let totalTreasury = 0;
    let totalPopulation = 0;
    let wagesIncome = 0;
    let transferIncome = 0;
    let otherIncome = 0;
    let goodsExpense = 0;
    let taxesExpense = 0;
    let otherExpense = 0;

    const byRegion: RegionFinanceRow[] = [];

    for (const regionId of scopedRegionIds) {
      const population = getPopulationTotal(populationByRegion[regionId]);
      const regionPops = populationByRegion[regionId]?.pops ?? [];
      const professionStates = regionPops.flatMap((pop) => Object.values(pop.professions ?? {}));
      const treasury = round3(professionStates.reduce((sum, state) => sum + Math.max(0, Number(state.ducats)), 0));
      const wages = round3(professionStates.reduce((sum, state) => sum + Math.max(0, Number(state.lastIncomeDucats)), 0));
      const needsSpend = round3(professionStates.reduce((sum, state) => sum + Math.max(0, Number(state.lastNeedsSpendDucats)), 0));
      const income = round3(wages);
      const expenses = needsSpend;
      const netBalance = round3(income - expenses);
      const capitalPerCapita = population > 0 ? treasury / population : 0;

      totalTreasury = round3(totalTreasury + treasury);
      totalPopulation += population;
      wagesIncome = round3(wagesIncome + wages);
      goodsExpense = round3(goodsExpense + needsSpend);

      byRegion.push({
        regionId,
        regionName: regionNameById[regionId] ?? regionId,
        population,
        treasury,
        income,
        expenses,
        netBalance,
        capitalPerCapita,
      });
    }

    const incomeRows: FinanceFlowRow[] = [
      { id: "wages", label: "Зарплаты от зданий", value: wagesIncome, color: "#34d399" },
      { id: "transfers", label: "Соцвыплаты/трансферты", value: transferIncome, color: "#60a5fa" },
      { id: "other-income", label: "Прочие источники", value: otherIncome, color: "#f59e0b" },
    ];
    const expenseRows: FinanceFlowRow[] = [
      { id: "goods", label: "Покупка товаров населением", value: goodsExpense, color: "#f87171" },
      { id: "taxes", label: "Налоги/сборы", value: taxesExpense, color: "#fb7185" },
      { id: "other-expense", label: "Прочие траты", value: otherExpense, color: "#a78bfa" },
    ];
    const totalIncome = round3(incomeRows.reduce((sum, row) => sum + row.value, 0));
    const totalExpenses = round3(expenseRows.reduce((sum, row) => sum + row.value, 0));
    const netBalance = round3(totalIncome - totalExpenses);

    return {
      totalTreasury,
      totalPopulation,
      incomeRows,
      expenseRows,
      totalIncome,
      totalExpenses,
      netBalance,
      byRegion: byRegion.sort((a, b) => b.treasury - a.treasury),
    };
  }, [scopedRegionIds, worldBase]);

  const needsDiagnostics = useMemo(() => {
    const emptyRows: NeedCategoryRow[] = (Object.keys(NEED_CATEGORY_LABELS) as NeedCategoryKey[]).map((category) => ({
      category,
      label: NEED_CATEGORY_LABELS[category],
      required: 0,
      fulfilled: 0,
      spend: 0,
      satisfaction: 1,
    }));
    if (!worldBase) {
      return { categoryRows: emptyRows, deficitRows: [] as NeedDeficitRow[], budgetShortageRows: [] as NeedBudgetShortageRow[] };
    }

    const byCategory = Object.fromEntries(
      (Object.keys(NEED_CATEGORY_LABELS) as NeedCategoryKey[]).map((category) => [
        category,
        { required: 0, fulfilled: 0, spend: 0 },
      ]),
    ) as Record<NeedCategoryKey, { required: number; fulfilled: number; spend: number }>;
    const deficitByGood: Record<string, number> = {};
    const budgetShortageByGood: Record<string, number> = {};

    for (const regionId of scopedRegionIds) {
      const regionPops = worldBase.regionPopulationByRegion?.[regionId]?.pops ?? [];
      for (const pop of regionPops) {
        for (const state of Object.values(pop.professions ?? {})) {
          for (const category of Object.keys(NEED_CATEGORY_LABELS) as NeedCategoryKey[]) {
            const row = state.lastNeedsByCategory?.[category];
            if (!row) continue;
            byCategory[category].required = round3(byCategory[category].required + Math.max(0, Number(row.required ?? 0)));
            byCategory[category].fulfilled = round3(byCategory[category].fulfilled + Math.max(0, Number(row.fulfilled ?? 0)));
            byCategory[category].spend = round3(byCategory[category].spend + Math.max(0, Number(row.spend ?? 0)));
          }
          for (const [goodId, amount] of Object.entries(state.lastNeedsDeficitByGood ?? {})) {
            deficitByGood[goodId] = round3((deficitByGood[goodId] ?? 0) + Math.max(0, Number(amount)));
          }
          for (const [goodId, amount] of Object.entries(state.lastNeedsBudgetShortageByGood ?? {})) {
            budgetShortageByGood[goodId] = round3((budgetShortageByGood[goodId] ?? 0) + Math.max(0, Number(amount)));
          }
        }
      }
    }

    const categoryRows: NeedCategoryRow[] = (Object.keys(NEED_CATEGORY_LABELS) as NeedCategoryKey[]).map((category) => {
      const row = byCategory[category];
      return {
        category,
        label: NEED_CATEGORY_LABELS[category],
        required: row.required,
        fulfilled: row.fulfilled,
        spend: row.spend,
        satisfaction: row.required > 0 ? row.fulfilled / row.required : 1,
      };
    });

    const deficitRows: NeedDeficitRow[] = Object.entries(deficitByGood)
      .map(([goodId, amount]) => ({
        goodId,
        goodName: entryByKindById.goods[goodId]?.name ?? goodId,
        amount,
      }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 12);

    const budgetShortageRows: NeedBudgetShortageRow[] = Object.entries(budgetShortageByGood)
      .map(([goodId, amount]) => ({
        goodId,
        goodName: entryByKindById.goods[goodId]?.name ?? goodId,
        amount,
      }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return { categoryRows, deficitRows, budgetShortageRows };
  }, [entryByKindById.goods, scopedRegionIds, worldBase]);

  useEffect(() => {
    if (!open || !worldBase) return;
    const currentTurn = Math.max(1, Number(worldBase.turnId ?? 1));
    if (treasuryTurnByModeRef.current[mode] === currentTurn) return;
    treasuryTurnByModeRef.current[mode] = currentTurn;
    const previous = prevTreasuryByModeRef.current[mode];
    const nextDelta = previous == null ? null : round3(financeStats.totalTreasury - previous);
    prevTreasuryByModeRef.current[mode] = financeStats.totalTreasury;
    setTreasuryDeltaByMode((prev) => ({ ...prev, [mode]: nextDelta }));
  }, [financeStats.totalTreasury, mode, open, worldBase]);

  useEffect(() => {
    if (!open || !worldBase) return;
    const currentTurn = Math.max(1, Number(worldBase.turnId ?? 1));
    if (negativeStreakTurnByModeRef.current[mode] === currentTurn) return;
    negativeStreakTurnByModeRef.current[mode] = currentTurn;
    const prevStreak = negativeStreakByModeRef.current[mode] ?? {};
    const nextStreak: Record<string, number> = { ...prevStreak };
    const activeRegionIds = new Set(financeStats.byRegion.map((row) => row.regionId));
    for (const regionId of Object.keys(nextStreak)) {
      if (!activeRegionIds.has(regionId)) {
        delete nextStreak[regionId];
      }
    }
    for (const row of financeStats.byRegion) {
      if (row.netBalance < 0) {
        nextStreak[row.regionId] = (nextStreak[row.regionId] ?? 0) + 1;
      } else {
        nextStreak[row.regionId] = 0;
      }
    }
    negativeStreakByModeRef.current[mode] = nextStreak;
    setNegativeStreakTick((prev) => prev + 1);
  }, [financeStats.byRegion, mode, open, worldBase]);

  const negativeBalanceAlerts = useMemo(() => {
    const streakByRegion = negativeStreakByModeRef.current[mode] ?? {};
    return financeStats.byRegion
      .map((row) => ({
        ...row,
        streak: streakByRegion[row.regionId] ?? 0,
      }))
      .filter((row) => row.streak >= NEGATIVE_BALANCE_STREAK_TARGET)
      .sort((a, b) => b.streak - a.streak);
  }, [financeStats.byRegion, mode, negativeStreakTick]);

  const lowCapitalAlerts = useMemo(
    () =>
      financeStats.byRegion
        .filter((row) => row.population > 0 && row.capitalPerCapita < LOW_CAPITAL_PER_CAPITA_THRESHOLD)
        .sort((a, b) => a.capitalPerCapita - b.capitalPerCapita),
    [financeStats.byRegion],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      fetchContentEntries("cultures"),
      fetchContentEntries("ideologies"),
      fetchContentEntries("religions"),
      fetchContentEntries("races"),
      fetchContentEntries("professions"),
      fetchContentEntries("goods"),
    ])
      .then(([cultures, ideologies, religions, races, professions, goods]) => {
        if (cancelled) return;
        setEntryByKindById({
          cultures: Object.fromEntries(
            cultures.map((entry) => [entry.id, { name: entry.name, color: entry.color, logoUrl: entry.logoUrl ?? null, malePortraitUrl: null, femalePortraitUrl: null }]),
          ),
          ideologies: Object.fromEntries(
            ideologies.map((entry) => [entry.id, { name: entry.name, color: entry.color, logoUrl: entry.logoUrl ?? null, malePortraitUrl: null, femalePortraitUrl: null }]),
          ),
          religions: Object.fromEntries(
            religions.map((entry) => [entry.id, { name: entry.name, color: entry.color, logoUrl: entry.logoUrl ?? null, malePortraitUrl: null, femalePortraitUrl: null }]),
          ),
          races: Object.fromEntries(
            races.map((entry) => [
              entry.id,
              {
                name: entry.name,
                color: entry.color,
                logoUrl: entry.logoUrl ?? null,
                malePortraitUrl: entry.malePortraitUrl ?? null,
                femalePortraitUrl: entry.femalePortraitUrl ?? null,
              },
            ]),
          ),
          professions: Object.fromEntries(
            professions.map((entry) => [entry.id, { name: entry.name, color: entry.color, logoUrl: entry.logoUrl ?? null, malePortraitUrl: null, femalePortraitUrl: null }]),
          ),
          goods: Object.fromEntries(
            goods.map((entry) => [entry.id, { name: entry.name, color: entry.color, logoUrl: entry.logoUrl ?? null, malePortraitUrl: null, femalePortraitUrl: null }]),
          ),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setEntryByKindById({
          cultures: {},
          ideologies: {},
          religions: {},
          races: {},
          professions: {},
          goods: {},
        });
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const activeRows: BreakdownRow[] = useMemo(() => {
    if (!activeDimension) return [];
    const kind = KIND_BY_DIMENSION[activeDimension];
    const entryById = entryByKindById[kind] ?? {};
    return Object.entries(stats.breakdown[activeDimension])
      .map(([id, rawPct]) => {
        const pct = Math.max(0, Math.min(100, rawPct));
        const entry = entryById[id];
        return {
          id,
          label: entry?.name ?? id,
          pct,
          color: normalizeColor(entry?.color, id),
          imageUrl:
            kind === "races"
              ? (entry?.malePortraitUrl ?? entry?.femalePortraitUrl ?? entry?.logoUrl ?? null)
              : (entry?.logoUrl ?? null),
        } satisfies BreakdownRow;
      })
      .filter((row) => row.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 200);
  }, [activeDimension, entryByKindById, stats]);

  const topCulture = useMemo(() => {
    const [id, pct] = Object.entries(stats.breakdown.culturePct).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!id || !pct || pct <= 0) return null;
    return {
      label: entryByKindById.cultures[id]?.name ?? id,
      pct,
      count: (stats.totalPopulation * pct) / 100,
    };
  }, [entryByKindById.cultures, stats.breakdown.culturePct, stats.totalPopulation]);

  const topReligion = useMemo(() => {
    const [id, pct] = Object.entries(stats.breakdown.religionPct).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!id || !pct || pct <= 0) return null;
    return {
      label: entryByKindById.religions[id]?.name ?? id,
      pct,
      count: (stats.totalPopulation * pct) / 100,
    };
  }, [entryByKindById.religions, stats.breakdown.religionPct, stats.totalPopulation]);

  useEffect(() => {
    if (!open) {
      chartRef.current?.dispose();
      chartRef.current = null;
      return;
    }
    if (!activeDimension) return;
    if (!pieRef.current) return;

    const existing = chartRef.current;
    const chart =
      existing && existing.getDom() === pieRef.current
        ? existing
        : (() => {
            existing?.dispose();
            return echarts.init(pieRef.current!);
          })();
    chartRef.current = chart;
    const selectedId = selectedByDimension[activeDimension] ?? activeRows[0]?.id;
    const hoveredId = hoveredByDimension[activeDimension] ?? null;

    chart.off("mouseover");
    chart.off("mouseout");
    chart.off("click");

    chart.on("mouseover", (params: { componentType?: string; dataIndex?: number }) => {
      if (params.componentType !== "series") return;
      if (typeof params.dataIndex !== "number") return;
      const row = activeRows[params.dataIndex];
      if (!row) return;
      setHoveredByDimension((prev) => ({ ...prev, [activeDimension]: row.id }));
    });

    chart.on("mouseout", () => {
      setHoveredByDimension((prev) => ({ ...prev, [activeDimension]: undefined }));
    });

    chart.on("click", (params: { componentType?: string; dataIndex?: number }) => {
      if (params.componentType !== "series") return;
      if (typeof params.dataIndex !== "number") return;
      const row = activeRows[params.dataIndex];
      if (!row) return;
      setSelectedByDimension((prev) => ({ ...prev, [activeDimension]: row.id }));
    });

    chart.setOption({
      animationDuration: 280,
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "transparent",
        borderWidth: 0,
        padding: 0,
        formatter: (params: { seriesName: string; name: string; value: number; percent: number; color?: string }) => {
          const pieceColor = params.color ?? "#334155";
          const peopleCount = formatInt((stats.totalPopulation * params.value) / 100);
          return `
            <div style="
              background:${pieceColor}dd;
              border:1px solid ${pieceColor};
              color:#f8fafc;
              border-radius:8px;
              padding:8px 10px;
              box-shadow:0 6px 18px rgba(0,0,0,0.35);
              backdrop-filter: blur(4px);
            ">
              <div style="font-weight:700; margin-bottom:2px;">${params.seriesName}</div>
              <div>${params.name}: ${params.value.toFixed(2)}%</div>
              <div style="opacity:0.92;">${peopleCount} чел.</div>
            </div>
          `;
        },
      },
      series: [
        {
          name: activeTab.label,
          type: "pie",
          radius: "48%",
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          selectedMode: "single",
          label: {
            show: true,
            color: "#e2e8f0",
            position: "outside",
            formatter: "{b}\n{d}%",
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 14,
          },
          labelLine: { show: true, length: 12, length2: 10, smooth: 0.2 },
          data: activeRows.map((row) => ({
            name: row.label,
            value: row.pct,
            selected: row.id === selectedId,
            itemStyle: {
              color: row.color,
              opacity: hoveredId ? (hoveredId === row.id ? 1 : 0.35) : 1,
            },
            label: {
              color: row.color,
            },
            labelLine: {
              lineStyle: {
                color: row.color,
              },
            },
          })),
          emphasis: {
            scale: true,
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
    }, { notMerge: true });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [open, activeDimension, activeRows, activeTab.label, hoveredByDimension, selectedByDimension]);

  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
      groupVitalsInstanceRef.current?.dispose();
      groupVitalsInstanceRef.current = null;
      groupLoyaltyInstanceRef.current?.dispose();
      groupLoyaltyInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open || section !== "groups") {
      groupVitalsInstanceRef.current?.dispose();
      groupVitalsInstanceRef.current = null;
      groupLoyaltyInstanceRef.current?.dispose();
      groupLoyaltyInstanceRef.current = null;
      return;
    }
    const totals = populationTables.groupRows.reduce(
      (acc, row) => ({
        births: acc.births + row.births,
        deaths: acc.deaths + row.deaths,
        radicals: acc.radicals + row.radicals,
        loyalists: acc.loyalists + row.loyalists,
      }),
      { births: 0, deaths: 0, radicals: 0, loyalists: 0 },
    );
    if (groupVitalsChartRef.current) {
      const chart = groupVitalsInstanceRef.current ?? echarts.init(groupVitalsChartRef.current);
      groupVitalsInstanceRef.current = chart;
      chart.setOption({
        animationDuration: 240,
        backgroundColor: "transparent",
        tooltip: { trigger: "item" },
        grid: { left: 56, right: 18, top: 16, bottom: 34 },
        xAxis: {
          type: "category",
          data: ["Рождения", "Смерти"],
          axisLabel: { color: "#94a3b8" },
          axisLine: { lineStyle: { color: "#334155" } },
        },
        yAxis: {
          type: "value",
          axisLabel: { color: "#94a3b8" },
          splitLine: { lineStyle: { color: "rgba(148,163,184,0.14)" } },
        },
        series: [
          {
            name: mode === "country" ? "Страна" : "Мир",
            type: "bar",
            data: [
              { value: totals.births, itemStyle: { color: "#34d399" } },
              { value: totals.deaths, itemStyle: { color: "#fb7185" } },
            ],
          },
        ],
      }, { notMerge: true });
    }
    if (groupLoyaltyChartRef.current) {
      const chart = groupLoyaltyInstanceRef.current ?? echarts.init(groupLoyaltyChartRef.current);
      groupLoyaltyInstanceRef.current = chart;
      chart.setOption({
        animationDuration: 240,
        backgroundColor: "transparent",
        tooltip: { trigger: "item" },
        grid: { left: 56, right: 18, top: 16, bottom: 34 },
        xAxis: {
          type: "category",
          data: ["Радикалы", "Лоялисты"],
          axisLabel: { color: "#94a3b8" },
          axisLine: { lineStyle: { color: "#334155" } },
        },
        yAxis: {
          type: "value",
          axisLabel: { color: "#94a3b8" },
          splitLine: { lineStyle: { color: "rgba(148,163,184,0.14)" } },
        },
        series: [
          {
            name: mode === "country" ? "Страна" : "Мир",
            type: "bar",
            data: [
              { value: totals.radicals, itemStyle: { color: "#fb7185" } },
              { value: totals.loyalists, itemStyle: { color: "#34d399" } },
            ],
          },
        ],
      }, { notMerge: true });
    }
    const onResize = () => {
      groupVitalsInstanceRef.current?.resize();
      groupLoyaltyInstanceRef.current?.resize();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mode, open, populationTables.groupRows, section]);

  const renderDimensionStats = (dimension: PopulationDimensionKey) => {
    const dimensionLabel = DIMENSION_LABELS.find((item) => item.key === dimension)?.label ?? "Статистика";
    const selectedId = selectedByDimension[dimension] ?? activeRows[0]?.id ?? null;
    const hoveredId = hoveredByDimension[dimension] ?? null;

    return (
      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <AppCard className="bg-[#131a22]">
          <div className="mb-2 text-xs text-white/60">{dimensionLabel}</div>
          {activeRows.length === 0 ? (
            <div className="flex h-[420px] items-center justify-center text-sm text-white/45">Нет данных</div>
          ) : (
            <div ref={pieRef} className="h-[420px] w-full" />
          )}
        </AppCard>
        <AppCard className="min-h-0 bg-[#131a22]">
          <div className="mb-2 text-xs text-white/60">Легенда ({activeRows.length})</div>
          <div className="arc-scrollbar max-h-[420px] space-y-2 overflow-auto pr-1">
            {activeRows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedByDimension((prev) => ({ ...prev, [dimension]: row.id }))}
                onMouseEnter={() => setHoveredByDimension((prev) => ({ ...prev, [dimension]: row.id }))}
                onMouseLeave={() => setHoveredByDimension((prev) => ({ ...prev, [dimension]: undefined }))}
                className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left transition ${
                  selectedId === row.id
                    ? "border-arc-accent/50 bg-arc-accent/10"
                    : hoveredId === row.id
                      ? "border-white/25 bg-white/10"
                      : "border-white/10 bg-black/25 hover:border-white/20"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {row.imageUrl ? (
                    <img
                      src={row.imageUrl}
                      alt=""
                      className={`h-5 w-5 rounded-sm object-cover ${dimension === "racePct" ? "border border-white/15" : ""}`}
                    />
                  ) : (
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-sm border text-[10px]"
                      style={{ borderColor: `${row.color}99`, backgroundColor: `${row.color}22`, color: row.color }}
                    >
                      {row.label.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate text-sm text-white/85">{row.label}</span>
                </span>
                <span className="ml-2 shrink-0 text-right">
                  <span className="block tabular-nums text-xs text-arc-accent">{row.pct.toFixed(2)}%</span>
                  <span className="block tabular-nums text-[11px] text-white/60">
                    {formatInt((stats.totalPopulation * row.pct) / 100)} чел.
                  </span>
                </span>
              </button>
            ))}
            {activeRows.length === 0 && <div className="text-xs text-white/45">Нет данных</div>}
          </div>
        </AppCard>
      </div>
    );
  };

  const renderFlowRows = (rows: FinanceFlowRow[]) => {
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return (
      <div className="space-y-2.5">
        {rows.map((row) => {
          const pct = total > 0 ? Math.max(0, Math.min(100, (row.value / total) * 100)) : 0;
          return (
            <div key={row.id} className="rounded-lg border border-white/10 bg-black/25 p-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-white/80">{row.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-white/90">{formatInt(row.value)} дукат</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: row.color,
                  }}
                />
              </div>
              <div className="mt-1 text-[11px] tabular-nums text-white/55">{pct.toFixed(2)}%</div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderGroupsTable = () => (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold text-white">Pop-группы</div>
        <div className="text-xs text-white/50">Группы идентичности: культура, религия, раса и агрегаты по внутренним профессиям</div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <AppCard className="bg-[#131a22]">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Рождения / смерти</div>
          <div ref={groupVitalsChartRef} className="h-[300px] w-full" />
        </AppCard>
        <AppCard className="bg-[#131a22]">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Радикалы / лоялисты</div>
          <div ref={groupLoyaltyChartRef} className="h-[300px] w-full" />
        </AppCard>
      </div>
      <AppCard className="bg-[#131a22]">
        <AppSectionHeader title={t("population.groupsByRegion")} icon={<Users size={14} />} />
        <AppTableShell className="max-h-[560px]">
          <AppTable className="min-w-[980px]">
            <thead className="sticky top-0 z-10 bg-[#131a22] text-white/50">
              <tr>
                <AppHeadCell>{t("population.regionColumn")}</AppHeadCell>
                <AppHeadCell>Культура</AppHeadCell>
                <AppHeadCell>Религия</AppHeadCell>
                <AppHeadCell>Раса</AppHeadCell>
                <AppHeadCell className="text-right">Численность</AppHeadCell>
                <AppHeadCell className="text-right">Проф.</AppHeadCell>
                <AppHeadCell className="text-right">SoL</AppHeadCell>
                <AppHeadCell className="text-right">Потребности</AppHeadCell>
                <AppHeadCell className="text-right">Дукаты</AppHeadCell>
                <AppHeadCell className="text-right">Рад./Лоял.</AppHeadCell>
                <AppHeadCell className="text-right">Рожд./Смерт.</AppHeadCell>
              </tr>
            </thead>
            <tbody>
              {populationTables.groupRows.map((row) => (
                <tr key={row.id} className="text-white/80">
                  <AppCell>{row.regionName}</AppCell>
                  <AppCell>{row.culture}</AppCell>
                  <AppCell>{row.religion}</AppCell>
                  <AppCell>{row.race}</AppCell>
                  <AppCell className="text-right tabular-nums">{formatInt(row.size)}</AppCell>
                  <AppCell className="text-right tabular-nums">{formatInt(row.professionCount)}</AppCell>
                  <AppCell className="text-right tabular-nums">{row.averageSoL.toFixed(2)}</AppCell>
                  <AppCell className="text-right tabular-nums">{(row.satisfaction * 100).toFixed(1)}%</AppCell>
                  <AppCell className="text-right tabular-nums">{formatInt(row.ducats)}</AppCell>
                  <AppCell className="text-right tabular-nums">
                    <span className="text-rose-300">{formatInt(row.radicals)}</span>
                    <span className="text-white/35"> / </span>
                    <span className="text-emerald-300">{formatInt(row.loyalists)}</span>
                  </AppCell>
                  <AppCell className="text-right tabular-nums">
                    <span className="text-emerald-300">{formatInt(row.births)}</span>
                    <span className="text-white/35"> / </span>
                    <span className="text-rose-300">{formatInt(row.deaths)}</span>
                  </AppCell>
                </tr>
              ))}
              {populationTables.groupRows.length === 0 && (
                <tr>
                  <td colSpan={11}>
                    <AppEmptyState className="my-1">Нет данных</AppEmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </AppTable>
        </AppTableShell>
      </AppCard>
    </div>
  );

  const renderNeedsTable = () => (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold text-white">Профессии и потребности</div>
        <div className="text-xs text-white/50">Покрытие по категориям, дефицитные товары, SoL и демография по профессиям внутри pop-групп</div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <AppCard className="bg-[#131a22]">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Покрытие потребностей по категориям</div>
          <AppTableShell>
            <AppTable className="min-w-[520px] text-xs">
              <thead className="text-white/50">
                <tr>
                  <AppHeadCell>Категория</AppHeadCell>
                  <AppHeadCell className="text-right">Нужно</AppHeadCell>
                  <AppHeadCell className="text-right">Куплено</AppHeadCell>
                  <AppHeadCell className="text-right">Покрытие</AppHeadCell>
                  <AppHeadCell className="text-right">Расход</AppHeadCell>
                </tr>
              </thead>
              <tbody>
                {needsDiagnostics.categoryRows.map((row) => (
                  <tr key={row.category} className="text-white/80">
                    <AppCell>{row.label}</AppCell>
                    <AppCell className="text-right tabular-nums">{formatInt(row.required)}</AppCell>
                    <AppCell className="text-right tabular-nums">{formatInt(row.fulfilled)}</AppCell>
                    <AppCell className={`text-right tabular-nums ${row.required <= 0 ? "text-white/40" : row.satisfaction < 0.75 ? "text-rose-300" : row.satisfaction < 0.95 ? "text-amber-200" : "text-emerald-300"}`}>
                      {row.required <= 0 ? "—" : `${(row.satisfaction * 100).toFixed(1)}%`}
                    </AppCell>
                    <AppCell className="text-right tabular-nums">{formatInt(row.spend)}</AppCell>
                  </tr>
                ))}
              </tbody>
            </AppTable>
          </AppTableShell>
        </AppCard>
        <AppCard className="bg-[#131a22]">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Рыночный дефицит товаров</div>
          <div className="space-y-2">
            {needsDiagnostics.deficitRows.map((row) => (
              <div key={row.goodId} className="flex items-center justify-between gap-3 rounded-lg bg-black/25 px-3 py-2 text-xs text-white/80">
                <span className="truncate">{row.goodName}</span>
                <span className="tabular-nums text-rose-300">{formatInt(row.amount)}</span>
              </div>
            ))}
            {needsDiagnostics.deficitRows.length === 0 && (
              <div className="rounded-lg bg-black/25 px-3 py-6 text-center text-sm text-white/45">Товары на рынке в целом доступны</div>
            )}
          </div>
        </AppCard>
        <AppCard className="bg-[#131a22]">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Нехватка денег на потребности</div>
          <div className="space-y-2">
            {needsDiagnostics.budgetShortageRows.map((row) => (
              <div key={row.goodId} className="flex items-center justify-between gap-3 rounded-lg bg-black/25 px-3 py-2 text-xs text-white/80">
                <span className="truncate">{row.goodName}</span>
                <span className="tabular-nums text-amber-200">{formatInt(row.amount)}</span>
              </div>
            ))}
            {needsDiagnostics.budgetShortageRows.length === 0 && (
              <div className="rounded-lg bg-black/25 px-3 py-6 text-center text-sm text-white/45">Бюджета населения хватает</div>
            )}
          </div>
        </AppCard>
      </div>
      <AppCard className="bg-[#131a22]">
        <AppSectionHeader title="Профессии по pop-группам" icon={<Briefcase size={14} />} />
        <AppTableShell className="max-h-[560px]">
          <AppTable className="min-w-[1320px] text-xs">
            <thead className="sticky top-0 z-10 bg-[#131a22] text-white/50">
              <tr>
                <AppHeadCell>{t("population.regionColumn")}</AppHeadCell>
                <AppHeadCell>Группа</AppHeadCell>
                <AppHeadCell>Профессия</AppHeadCell>
                <AppHeadCell className="text-right">Численность</AppHeadCell>
                <AppHeadCell className="text-right">SoL</AppHeadCell>
                <AppHeadCell className="text-right">Удовл.</AppHeadCell>
                <AppHeadCell className="text-right">Выж.</AppHeadCell>
                <AppHeadCell className="text-right">База</AppHeadCell>
                <AppHeadCell className="text-right">Комф.</AppHeadCell>
                <AppHeadCell className="text-right">Роск.</AppHeadCell>
                <AppHeadCell className="text-right">Кошелёк</AppHeadCell>
                <AppHeadCell className="text-right">Доход</AppHeadCell>
                <AppHeadCell className="text-right">Расходы</AppHeadCell>
                <AppHeadCell className="text-right">Баланс</AppHeadCell>
                <AppHeadCell className="text-right">Рад./Лоял.</AppHeadCell>
                <AppHeadCell className="text-right">Рожд./Смерт.</AppHeadCell>
              </tr>
            </thead>
            <tbody>
              {populationTables.professionRows.map((row) => {
                const balance = row.income - row.spend;
                return (
                  <tr key={row.id} className="text-white/80">
                    <AppCell>{row.regionName}</AppCell>
                    <AppCell className="max-w-[180px] truncate text-white/55">{row.groupId}</AppCell>
                    <AppCell>{row.profession}</AppCell>
                    <AppCell className="text-right tabular-nums">{formatInt(row.size)}</AppCell>
                    <AppCell className="text-right tabular-nums">{row.standardOfLiving.toFixed(2)}</AppCell>
                    <AppCell className={`text-right tabular-nums ${row.satisfaction < 0.7 ? "text-rose-300" : row.satisfaction < 1 ? "text-amber-200" : "text-emerald-300"}`}>
                      {(row.satisfaction * 100).toFixed(1)}%
                    </AppCell>
                    <AppCell className={`text-right tabular-nums ${row.categorySatisfaction.survival < 0.9 ? "text-rose-300" : "text-emerald-300"}`}>{(row.categorySatisfaction.survival * 100).toFixed(0)}%</AppCell>
                    <AppCell className={`text-right tabular-nums ${row.categorySatisfaction.basic < 0.85 ? "text-rose-300" : row.categorySatisfaction.basic < 1 ? "text-amber-200" : "text-emerald-300"}`}>{(row.categorySatisfaction.basic * 100).toFixed(0)}%</AppCell>
                    <AppCell className="text-right tabular-nums text-white/80">{(row.categorySatisfaction.comfort * 100).toFixed(0)}%</AppCell>
                    <AppCell className="text-right tabular-nums text-white/65">{(row.categorySatisfaction.luxury * 100).toFixed(0)}%</AppCell>
                    <AppCell className="text-right tabular-nums">{formatInt(row.ducats)}</AppCell>
                    <AppCell className="text-right tabular-nums text-emerald-300">+{formatInt(row.income)}</AppCell>
                    <AppCell className="text-right tabular-nums text-rose-300">-{formatInt(row.spend)}</AppCell>
                    <AppCell className={`text-right tabular-nums ${balance >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSignedInt(balance)}</AppCell>
                    <AppCell className="text-right tabular-nums">
                      <span className="text-rose-300">{formatInt(row.radicals)}</span>
                      <span className="text-white/35"> / </span>
                      <span className="text-emerald-300">{formatInt(row.loyalists)}</span>
                    </AppCell>
                    <AppCell className="text-right tabular-nums">
                      <span className="text-emerald-300">{formatInt(row.births)}</span>
                      <span className="text-white/35"> / </span>
                      <span className="text-rose-300">{formatInt(row.deaths)}</span>
                    </AppCell>
                  </tr>
                );
              })}
              {populationTables.professionRows.length === 0 && (
                <tr>
                  <td colSpan={16}>
                    <AppEmptyState className="my-1">Нет данных</AppEmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </AppTable>
        </AppTableShell>
      </AppCard>
    </div>
  );

  return (
    <AppModal open={open} onClose={onClose} modalKey="population" panelClassName="overflow-hidden" zIndexClassName="z-[205]">
            <AppModalHeader title="Панель населения" description={subtitle} onClose={onClose} />

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <AppSection className="p-3">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Область</span>
                <div className="space-y-2">
                  <AppButton
                    type="button"
                    onClick={() => setMode("country")}
                    variant={mode === "country" ? "primary" : "ghost"}
                    className={`w-full justify-start ${mode === "country" ? "bg-arc-accent/15 text-arc-accent" : ""}`}
                    icon={<MapPinned size={15} />}
                  >
                    <span>{countryName}</span>
                  </AppButton>
                  <AppButton
                    type="button"
                    onClick={() => setMode("world")}
                    variant={mode === "world" ? "primary" : "ghost"}
                    className={`w-full justify-start ${mode === "world" ? "bg-arc-accent/15 text-arc-accent" : ""}`}
                    icon={<Globe2 size={15} />}
                  >
                    <span>Мир</span>
                  </AppButton>
                </div>
              </AppSection>

              <div className="grid min-h-0 gap-4 lg:grid-rows-[auto_minmax(0,1fr)]">
                <AppToolbar className="mb-0">
                <div className="arc-scrollbar flex items-center gap-2 overflow-auto">
                  {STAT_TABS.map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <AppButton
                        key={tab.id}
                        type="button"
                        onClick={() => setSection(tab.id)}
                        variant={section === tab.id ? "primary" : "ghost"}
                        size="sm"
                        className={`shrink-0 ${section === tab.id ? "bg-arc-accent/15 text-arc-accent" : ""}`}
                        icon={<TabIcon size={14} />}
                      >
                        {tab.label}
                      </AppButton>
                    );
                  })}
                </div>
                </AppToolbar>

                <AppSection className="overflow-auto p-4">
                  <div className="mb-4 grid gap-3 md:grid-cols-3">
                    <AppCard className="bg-[#131a22]">
                      <div className="text-[11px] uppercase tracking-wide text-white/50">Всего населения</div>
                      <div className="mt-1 text-lg font-semibold text-white">{formatInt(stats.totalPopulation)}</div>
                    </AppCard>
                    <AppCard className="bg-[#131a22]">
                      <div className="text-[11px] uppercase tracking-wide text-white/50">Крупнейшая культура</div>
                      <div className="mt-1 truncate text-sm font-semibold text-white">{topCulture?.label ?? "Нет данных"}</div>
                      <div className="text-[11px] text-white/60">
                        {topCulture ? `${topCulture.pct.toFixed(2)}% · ${formatInt(topCulture.count)} чел.` : "—"}
                      </div>
                    </AppCard>
                    <AppCard className="bg-[#131a22]">
                      <div className="text-[11px] uppercase tracking-wide text-white/50">Доминирующая религия</div>
                      <div className="mt-1 truncate text-sm font-semibold text-white">{topReligion?.label ?? "Нет данных"}</div>
                      <div className="text-[11px] text-white/60">
                        {topReligion ? `${topReligion.pct.toFixed(2)}% · ${formatInt(topReligion.count)} чел.` : "—"}
                      </div>
                    </AppCard>
                  </div>

                  {section === "general" && (
                    <>
                      <div className="mb-4">
                        <div className="text-lg font-semibold text-white">{title}</div>
                        <div className="text-xs text-white/50">Агрегированные данные по населению</div>
                      </div>

                      <div className="mb-4 grid gap-3 md:grid-cols-2">
                        <AppCard className="bg-[#131a22]">
                          <div className="flex items-center gap-2 text-xs text-white/60">
                            <Users size={13} />
                            <span>Общее население</span>
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-white">{formatInt(stats.totalPopulation)}</div>
                        </AppCard>
                        <AppCard className="bg-[#131a22]">
                          <div className="flex items-center gap-2 text-xs text-white/60">
                            <BarChart3 size={13} />
                            <span>{t("population.regionsInScope")}</span>
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-white">{formatInt(stats.regionCount)}</div>
                        </AppCard>
                      </div>

                      <div className="space-y-3">
                        {DIMENSION_LABELS.map((dimension) => (
                          <AppCard key={dimension.key} className="bg-[#131a22]">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{dimension.label}</div>
                            <div className="text-sm text-white/70">
                              Откройте вкладку <span className="font-semibold text-white">{dimension.label}</span> для детальной статистики.
                            </div>
                          </AppCard>
                        ))}
                      </div>
                    </>
                  )}

                  {section === "groups" && renderGroupsTable()}

                  {section === "needs" && renderNeedsTable()}

                  {section === "finance" && (
                    <div className="space-y-4">
                      <div>
                        <div className="text-lg font-semibold text-white">Финансы населения</div>
                        <div className="text-xs text-white/50">Казна населения, доходы/расходы за ход и сигналы по рискам</div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <AppCard className="bg-[#131a22]">
                          <div className="text-[11px] uppercase tracking-wide text-white/50">Общий капитал населения</div>
                          <div className="mt-1 text-lg font-semibold text-white">{formatInt(financeStats.totalTreasury)} дукат</div>
                        </AppCard>
                        <AppCard className="bg-[#131a22]">
                          <div className="text-[11px] uppercase tracking-wide text-white/50">Изменение за последний ход</div>
                          <div
                            className={`mt-1 text-lg font-semibold ${
                              (treasuryDeltaByMode[mode] ?? 0) > 0
                                ? "text-emerald-300"
                                : (treasuryDeltaByMode[mode] ?? 0) < 0
                                  ? "text-rose-300"
                                  : "text-white"
                            }`}
                          >
                            {treasuryDeltaByMode[mode] == null ? "—" : `${formatSignedInt(treasuryDeltaByMode[mode] ?? 0)} дукат`}
                          </div>
                        </AppCard>
                        <AppCard className="bg-[#131a22]">
                          <div className="text-[11px] uppercase tracking-wide text-white/50">Доходы населения за ход</div>
                          <div className="mt-1 text-lg font-semibold text-emerald-300">+{formatInt(financeStats.totalIncome)} дукат</div>
                        </AppCard>
                        <AppCard className="bg-[#131a22]">
                          <div className="text-[11px] uppercase tracking-wide text-white/50">Расходы населения за ход</div>
                          <div className="mt-1 text-lg font-semibold text-rose-300">-{formatInt(financeStats.totalExpenses)} дукат</div>
                        </AppCard>
                        <AppCard className="bg-[#131a22]">
                          <div className="text-[11px] uppercase tracking-wide text-white/50">Чистый баланс</div>
                          <div className={`mt-1 text-lg font-semibold ${financeStats.netBalance >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {formatSignedInt(financeStats.netBalance)} дукат
                          </div>
                        </AppCard>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <AppCard className="bg-[#131a22]">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Структура доходов</div>
                          {renderFlowRows(financeStats.incomeRows)}
                        </AppCard>
                        <AppCard className="bg-[#131a22]">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Структура расходов</div>
                          {renderFlowRows(financeStats.expenseRows)}
                        </AppCard>
                      </div>

                      <AppCard className="bg-[#131a22]">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Сигналы (алерты)</div>
                        <div className="space-y-2">
                          {negativeBalanceAlerts.length > 0 ? (
                            negativeBalanceAlerts.map((row) => (
                              <div key={`neg-${row.regionId}`} className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                                {t("population.negativeRegionBalanceAlert", {
                                  region: row.regionName,
                                  turns: row.streak,
                                  balance: formatSignedInt(row.netBalance),
                                })}
                              </div>
                            ))
                          ) : (
                            <AppCard className="bg-black/20 px-3 py-2 text-sm text-white/70">
                              {t("population.noNegativeRegionBalance", { turns: NEGATIVE_BALANCE_STREAK_TARGET })}
                            </AppCard>
                          )}
                          {lowCapitalAlerts.length > 0 ? (
                            lowCapitalAlerts.map((row) => (
                              <div key={`low-${row.regionId}`} className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                                {t("population.lowRegionCapitalAlert", {
                                  region: row.regionName,
                                  capital: row.capitalPerCapita.toFixed(3),
                                })}
                              </div>
                            ))
                          ) : (
                            <AppCard className="bg-black/20 px-3 py-2 text-sm text-white/70">
                              {t("population.noLowRegionCapital")}
                            </AppCard>
                          )}
                        </div>
                      </AppCard>
                    </div>
                  )}

                  {activeDimension && renderDimensionStats(activeDimension)}

                  {section === "branding" && (
                    <div className="space-y-4">
                      <div>
                        <div className="text-lg font-semibold text-white">Логотип и стиль</div>
                        <div className="text-xs text-white/50">Подготовка визуальных настроек панели населения</div>
                      </div>
                      <AppCard className="bg-[#131a22] p-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Статус</div>
                        <div className="text-sm text-white/75">Раздел зарезервирован под будущие механики визуализации населения.</div>
                      </AppCard>
                    </div>
                  )}
                </AppSection>
              </div>
            </div>
    </AppModal>
  );
}
