import type { PopulationPop, WorldBase } from "@arcanorum/shared";
import * as echarts from "echarts";
import type { EChartsType } from "echarts";
import { ChevronDown, ChevronRight, CircleDot, Globe2, ListTree, MapPinned, RotateCcw, Rows3 } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { fetchContentEntries } from "../lib/api";
import type { UiTextKey } from "../i18n/uiText";
import { useUiText } from "../i18n/useUiText";
import { AppButton } from "./templates/AppButton";
import { AppModal } from "./templates/AppModal";

type Props = {
  open: boolean;
  onClose: () => void;
  worldBase: WorldBase | null;
  countryId: string;
  countryName: string;
};

type ViewMode = "country" | "world";
type TableMode = "atomic" | "grouped";
type FilterKey = "profession" | "region" | "culture" | "religion" | "discrimination" | "employment" | "sol";

type PopulationFilterState = Record<FilterKey, string[]>;

type ContentEntryMeta = {
  name: string;
  color: string;
  logoUrl: string | null;
};

type PopulationContentKind = "cultures" | "ideologies" | "religions" | "races" | "professions";

type NeedCategoryKey = "survival" | "basic" | "comfort" | "luxury";

type NeedCategoryStats = Record<NeedCategoryKey, { required: number; fulfilled: number; spend: number }>;

type PopulationAtomicRow = {
  id: string;
  popId: string;
  regionId: string;
  regionName: string;
  professionId: string;
  professionName: string;
  cultureId: string;
  cultureName: string;
  religionId: string;
  religionName: string;
  raceId: string;
  raceName: string;
  size: number;
  radicals: number;
  loyalists: number;
  standardOfLiving: number;
  politicalStrength: number;
  jobStatus: string;
  employmentKey: EmploymentKey;
  employmentLabel: string;
  employed: number;
  openJobs: number;
  discriminationKey: "accepted" | "discriminated";
  discriminationLabel: string;
  discriminationReasons: string[];
  discriminationPenalty: number;
  solBucket: SolBucketKey;
  solBucketLabel: string;
  ideologyLabel: string;
  income: number;
  spend: number;
  ducats: number;
  needsSatisfaction: number;
  needsByCategory: NeedCategoryStats;
  qualificationLimit: number;
  qualificationShortages: Record<string, number>;
};

type PopulationGroupedRow = Omit<PopulationAtomicRow, "id" | "popId"> & {
  id: string;
  popId: string;
  rowCount: number;
  children: PopulationAtomicRow[];
};

type PopulationTableRow = PopulationAtomicRow | PopulationGroupedRow;

type PopulationChartDatum = {
  id: string;
  label: string;
  value: number;
  color: string;
  filterKey?: FilterKey;
};

type ChartDefinition = {
  id: "population" | "politicalStrength" | "region" | "culture" | "religion" | "profession";
  titleKey: UiTextKey;
  filterKey?: FilterKey;
  valueKind: "population" | "politicalStrength";
  groupBy: (row: PopulationAtomicRow) => { id: string; label: string; color: string };
};

type FilterOption = {
  id: string;
  label: string;
  count: number;
  color: string;
};

type EmploymentKey = "employed" | "partial" | "unemployed" | "no_open_jobs";
type SolBucketKey = "low" | "struggling" | "stable" | "prosperous";

const FILTER_KEYS: FilterKey[] = ["profession", "region", "culture", "religion", "discrimination", "employment", "sol"];

const EMPTY_FILTERS: PopulationFilterState = {
  profession: [],
  region: [],
  culture: [],
  religion: [],
  discrimination: [],
  employment: [],
  sol: [],
};

const NEED_CATEGORY_KEYS: NeedCategoryKey[] = ["survival", "basic", "comfort", "luxury"];

const NEED_CATEGORY_LABEL_KEYS: Record<NeedCategoryKey, UiTextKey> = {
  survival: "population.categorySurvival",
  basic: "population.categoryBasic",
  comfort: "population.categoryComfort",
  luxury: "population.categoryLuxury",
};

const FILTER_LABEL_KEYS: Record<FilterKey, UiTextKey> = {
  profession: "population.filter.profession",
  region: "population.filter.region",
  culture: "population.filter.culture",
  religion: "population.filter.religion",
  discrimination: "population.filter.discrimination",
  employment: "population.filter.employment",
  sol: "population.filter.sol",
};

const FALLBACK_COLORS = [
  "#9fbf82",
  "#d0a257",
  "#7f9bbd",
  "#b97878",
  "#8f7fc4",
  "#69a992",
  "#c28f62",
  "#b6b05f",
  "#7bb1b5",
  "#a978a8",
];

function formatInt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.max(0, Math.floor(Number(value) || 0)));
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return formatInt(value);
}

function round3(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(3));
}

function colorFromId(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length] ?? "#9fbf82";
}

function normalizeColor(value: string | null | undefined, id: string): string {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value.trim())) return value.trim();
  return colorFromId(id);
}

function resolveScopeRegionIds(worldBase: WorldBase | null, scope: ViewMode, countryId: string): string[] {
  if (!worldBase) return [];
  const ownerByRegion = worldBase.regionOwner ?? {};
  const populationByRegion = worldBase.regionPopulationByRegion ?? {};
  return Object.keys(populationByRegion)
    .filter((regionId) => scope === "world" || ownerByRegion[regionId] === countryId)
    .sort((left, right) => left.localeCompare(right));
}

function emptyNeedStats(): NeedCategoryStats {
  return {
    survival: { required: 0, fulfilled: 0, spend: 0 },
    basic: { required: 0, fulfilled: 0, spend: 0 },
    comfort: { required: 0, fulfilled: 0, spend: 0 },
    luxury: { required: 0, fulfilled: 0, spend: 0 },
  };
}

function addNeedStats(target: NeedCategoryStats, pop: PopulationPop): void {
  for (const category of NEED_CATEGORY_KEYS) {
    const row = pop.lastNeedsByCategory?.[category];
    if (!row) continue;
    target[category].required = round3(target[category].required + Math.max(0, Number(row.required ?? 0)));
    target[category].fulfilled = round3(target[category].fulfilled + Math.max(0, Number(row.fulfilled ?? 0)));
    target[category].spend = round3(target[category].spend + Math.max(0, Number(row.spend ?? 0)));
  }
}

function mergeNeedStats(rows: PopulationAtomicRow[]): NeedCategoryStats {
  const result = emptyNeedStats();
  for (const row of rows) {
    for (const category of NEED_CATEGORY_KEYS) {
      result[category].required = round3(result[category].required + row.needsByCategory[category].required);
      result[category].fulfilled = round3(result[category].fulfilled + row.needsByCategory[category].fulfilled);
      result[category].spend = round3(result[category].spend + row.needsByCategory[category].spend);
    }
  }
  return result;
}

function resolveEmploymentKey(pop: PopulationPop): EmploymentKey {
  const size = Math.max(0, Number(pop.size));
  const employed = Math.max(0, Number(pop.lastEmployed ?? 0));
  const openJobs = Math.max(0, Number(pop.lastOpenJobs ?? 0));
  const jobStatus = String(pop.lastJobStatus ?? "");
  if (employed >= size && size > 0 && !jobStatus.includes("unemployed")) return "employed";
  if (employed > 0) return "partial";
  if (openJobs <= 0) return "no_open_jobs";
  return "unemployed";
}

function resolveEmploymentLabel(key: EmploymentKey, t: (key: UiTextKey, params?: Record<string, string | number>) => string): string {
  if (key === "employed") return t("population.employment.employed");
  if (key === "partial") return t("population.employment.partial");
  if (key === "no_open_jobs") return t("population.employment.noOpenJobs");
  return t("population.employment.unemployed");
}

function resolveSolBucket(value: number): SolBucketKey {
  if (value <= 7) return "low";
  if (value <= 10) return "struggling";
  if (value <= 14) return "stable";
  return "prosperous";
}

function resolveSolBucketLabel(key: SolBucketKey, t: (key: UiTextKey, params?: Record<string, string | number>) => string): string {
  if (key === "low") return t("population.sol.low");
  if (key === "struggling") return t("population.sol.struggling");
  if (key === "stable") return t("population.sol.stable");
  return t("population.sol.prosperous");
}

function resolveTopIdeologyLabel(pop: PopulationPop, ideologies: Record<string, ContentEntryMeta>, t: (key: UiTextKey, params?: Record<string, string | number>) => string): string {
  const [ideologyId] = Object.entries(pop.ideologies ?? {}).sort((left, right) => Number(right[1]) - Number(left[1]))[0] ?? [];
  if (!ideologyId) return t("population.none");
  return ideologies[ideologyId]?.name ?? ideologyId;
}

function resolveTopIdeologyForRows(rows: PopulationAtomicRow[], t: (key: UiTextKey, params?: Record<string, string | number>) => string): string {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.ideologyLabel, (totals.get(row.ideologyLabel) ?? 0) + row.size);
  }
  const [label] = [...totals.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
  return label ?? t("population.none");
}

function passesFilterValue(selected: string[], value: string): boolean {
  return selected.length === 0 || selected.includes(value);
}

function rowMatchesFilters(row: PopulationAtomicRow, filters: PopulationFilterState, except?: FilterKey): boolean {
  if (except !== "profession" && !passesFilterValue(filters.profession, row.professionId)) return false;
  if (except !== "region" && !passesFilterValue(filters.region, row.regionId)) return false;
  if (except !== "culture" && !passesFilterValue(filters.culture, row.cultureId)) return false;
  if (except !== "religion" && !passesFilterValue(filters.religion, row.religionId)) return false;
  if (except !== "discrimination" && !passesFilterValue(filters.discrimination, row.discriminationKey)) return false;
  if (except !== "employment" && !passesFilterValue(filters.employment, row.employmentKey)) return false;
  if (except !== "sol" && !passesFilterValue(filters.sol, row.solBucket)) return false;
  return true;
}

function toggleFilterValue(filters: PopulationFilterState, key: FilterKey, id: string): PopulationFilterState {
  const current = filters[key];
  const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
  return { ...filters, [key]: next };
}

function calculateAverage(rows: PopulationAtomicRow[], selector: (row: PopulationAtomicRow) => number): number {
  const total = rows.reduce((sum, row) => sum + row.size, 0);
  if (total <= 0) return 0;
  return rows.reduce((sum, row) => sum + selector(row) * row.size, 0) / total;
}

function buildGroupedRows(rows: PopulationAtomicRow[], t: (key: UiTextKey, params?: Record<string, string | number>) => string): PopulationGroupedRow[] {
  const groups = new Map<string, PopulationAtomicRow[]>();
  for (const row of rows) {
    const key = [
      row.professionId,
      row.cultureId,
      row.religionId,
      row.raceId,
      row.regionId,
      row.jobStatus,
      row.discriminationKey,
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.entries()]
    .map(([id, children]) => {
      const first = children[0]!;
      const size = children.reduce((sum, row) => sum + row.size, 0);
      const radicals = children.reduce((sum, row) => sum + row.radicals, 0);
      const loyalists = children.reduce((sum, row) => sum + row.loyalists, 0);
      const politicalStrength = children.reduce((sum, row) => sum + row.politicalStrength, 0);
      const income = children.reduce((sum, row) => sum + row.income, 0);
      const spend = children.reduce((sum, row) => sum + row.spend, 0);
      const ducats = children.reduce((sum, row) => sum + row.ducats, 0);
      const employed = children.reduce((sum, row) => sum + row.employed, 0);
      const openJobs = children.reduce((sum, row) => sum + row.openJobs, 0);
      const qualificationLimit = children.reduce((sum, row) => sum + row.qualificationLimit, 0);
      const qualificationShortages: Record<string, number> = {};
      for (const row of children) {
        for (const [category, value] of Object.entries(row.qualificationShortages)) {
          qualificationShortages[category] = round3((qualificationShortages[category] ?? 0) + Math.max(0, Number(value)));
        }
      }
      return {
        ...first,
        id,
        popId: t("population.groupedPopCount", { count: children.length }),
        size,
        radicals,
        loyalists,
        politicalStrength,
        income: round3(income),
        spend: round3(spend),
        ducats: round3(ducats),
        employed: round3(employed),
        openJobs: round3(openJobs),
        qualificationLimit: round3(qualificationLimit),
        qualificationShortages,
        standardOfLiving: round3(calculateAverage(children, (row) => row.standardOfLiving)),
        needsSatisfaction: round3(calculateAverage(children, (row) => row.needsSatisfaction)),
        ideologyLabel: resolveTopIdeologyForRows(children, t),
        needsByCategory: mergeNeedStats(children),
        rowCount: children.length,
        children,
      };
    })
    .sort((left, right) => right.size - left.size || left.id.localeCompare(right.id));
}

function buildOptions(
  rows: PopulationAtomicRow[],
  getId: (row: PopulationAtomicRow) => string,
  getLabel: (row: PopulationAtomicRow) => string,
  getColor: (row: PopulationAtomicRow) => string,
): FilterOption[] {
  const map = new Map<string, FilterOption>();
  for (const row of rows) {
    const id = getId(row);
    const existing = map.get(id);
    if (existing) {
      existing.count += row.size;
      continue;
    }
    map.set(id, { id, label: getLabel(row), count: row.size, color: getColor(row) });
  }
  return [...map.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function buildChartData(params: {
  rows: PopulationAtomicRow[];
  valueKind: ChartDefinition["valueKind"];
  filterKey?: FilterKey;
  groupBy: ChartDefinition["groupBy"];
}): PopulationChartDatum[] {
  const map = new Map<string, PopulationChartDatum>();
  for (const row of params.rows) {
    const group = params.groupBy(row);
    const value = params.valueKind === "politicalStrength" ? row.politicalStrength : row.size;
    const existing = map.get(group.id);
    if (existing) {
      existing.value = round3(existing.value + value);
    } else {
      map.set(group.id, { ...group, value: round3(value), filterKey: params.filterKey });
    }
  }
  return [...map.values()].filter((row) => row.value > 0).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

function PopulationTreemapCard(props: {
  title: string;
  valueKind: "population" | "politicalStrength";
  data: PopulationChartDatum[];
  selectedIds: string[];
  onSelect: (datum: PopulationChartDatum) => void;
}) {
  const { t } = useUiText();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const topRows = props.data.slice(0, 5);
  const total = props.data.reduce((sum, row) => sum + row.value, 0);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = chartRef.current ?? echarts.init(containerRef.current);
    chartRef.current = chart;
    chart.off("click");
    chart.on("click", (params) => {
      const eventData = params.data && typeof params.data === "object" ? params.data as Record<string, unknown> : null;
      const datumId = typeof eventData?.id === "string" ? eventData.id : null;
      const datum = props.data.find((row) => row.id === datumId);
      if (datum) props.onSelect(datum);
    });
    chart.setOption({
      animationDuration: 220,
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (params: { name: string; value: number }) => {
          const value = props.valueKind === "politicalStrength" ? formatCompact(params.value) : formatCompact(params.value);
          return `${params.name}: ${value}`;
        },
      },
      series: [
        {
          type: "treemap",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          top: 4,
          left: 4,
          right: 4,
          bottom: 4,
          label: { show: false },
          itemStyle: {
            borderColor: "rgba(21, 16, 10, 0.72)",
            borderWidth: 1,
            gapWidth: 1,
          },
          emphasis: {
            label: { show: true, color: "#fff7df", fontSize: 11, overflow: "truncate" },
            itemStyle: { borderColor: "#e8cc8b", borderWidth: 2 },
          },
          data: props.data.map((row) => ({
            id: row.id,
            name: row.label,
            value: row.value,
            itemStyle: {
              color: row.color,
              opacity: props.selectedIds.length === 0 || props.selectedIds.includes(row.id) ? 0.94 : 0.42,
            },
          })),
        },
      ],
    }, { notMerge: true });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [props]);

  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return (
    <section className="arc-pop-overview-chart-card">
      <div className="arc-pop-overview-chart-title">{props.title}</div>
      <div className="arc-pop-overview-chart-frame">
        {props.data.length > 0 ? (
          <div ref={containerRef} className="arc-pop-overview-chart-canvas" />
        ) : (
          <div className="arc-pop-overview-chart-empty">{t("population.noData")}</div>
        )}
      </div>
      <div className="arc-pop-overview-chart-legend">
        {topRows.map((row) => (
          <button key={row.id} type="button" className="arc-pop-overview-legend-row" onClick={() => props.onSelect(row)}>
            <span className="arc-pop-overview-color" style={{ backgroundColor: row.color }} />
            <span className="arc-pop-overview-legend-label">{row.label}</span>
            <strong>{props.valueKind === "politicalStrength" ? formatCompact(row.value) : formatCompact(row.value)}</strong>
          </button>
        ))}
        {topRows.length === 0 ? <span className="arc-pop-overview-muted">{t("population.noData")}</span> : null}
      </div>
      <div className="arc-pop-overview-chart-total">{formatCompact(total)}</div>
    </section>
  );
}

export function PopulationStatsModal({ open, onClose, worldBase, countryId, countryName }: Props) {
  const { t } = useUiText();
  const [mode, setMode] = useState<ViewMode>("country");
  const [tableMode, setTableMode] = useState<TableMode>("atomic");
  const [filters, setFilters] = useState<PopulationFilterState>(EMPTY_FILTERS);
  const [collapsedFilters, setCollapsedFilters] = useState<Record<FilterKey, boolean>>({
    profession: false,
    region: false,
    culture: true,
    religion: true,
    discrimination: true,
    employment: true,
    sol: true,
  });
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [entryByKindById, setEntryByKindById] = useState<Record<PopulationContentKind, Record<string, ContentEntryMeta>>>({
    cultures: {},
    ideologies: {},
    religions: {},
    races: {},
    professions: {},
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      fetchContentEntries("cultures"),
      fetchContentEntries("ideologies"),
      fetchContentEntries("religions"),
      fetchContentEntries("races"),
      fetchContentEntries("professions"),
    ])
      .then(([cultures, ideologies, religions, races, professions]) => {
        if (cancelled) return;
        setEntryByKindById({
          cultures: Object.fromEntries(cultures.map((entry) => [entry.id, { name: entry.name, color: entry.color, logoUrl: entry.logoUrl ?? null }])),
          ideologies: Object.fromEntries(ideologies.map((entry) => [entry.id, { name: entry.name, color: entry.color, logoUrl: entry.logoUrl ?? null }])),
          religions: Object.fromEntries(religions.map((entry) => [entry.id, { name: entry.name, color: entry.color, logoUrl: entry.logoUrl ?? null }])),
          races: Object.fromEntries(races.map((entry) => [entry.id, { name: entry.name, color: entry.color, logoUrl: entry.logoUrl ?? null }])),
          professions: Object.fromEntries(professions.map((entry) => [entry.id, { name: entry.name, color: entry.color, logoUrl: entry.logoUrl ?? null }])),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setEntryByKindById({ cultures: {}, ideologies: {}, religions: {}, races: {}, professions: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const scopedRegionIds = useMemo(() => resolveScopeRegionIds(worldBase, mode, countryId), [countryId, mode, worldBase]);

  const atomicRows = useMemo<PopulationAtomicRow[]>(() => {
    if (!worldBase) return [];
    const rows: PopulationAtomicRow[] = [];
    for (const regionId of scopedRegionIds) {
      const population = worldBase.regionPopulationByRegion?.[regionId];
      if (!population) continue;
      for (const pop of population.pops ?? []) {
        const size = Math.max(0, Number(pop.size));
        if (size <= 0) continue;
        const professionMeta = entryByKindById.professions[pop.professionId];
        const cultureMeta = entryByKindById.cultures[pop.cultureId];
        const religionMeta = entryByKindById.religions[pop.religionId];
        const raceMeta = entryByKindById.races[pop.raceId];
        const employmentKey = resolveEmploymentKey(pop);
        const discriminationKey = pop.lastDiscriminationStatus === "discriminated" ? "discriminated" : "accepted";
        const standardOfLiving = Math.max(0, Number(pop.standardOfLiving ?? 0));
        const solBucket = resolveSolBucket(standardOfLiving);
        const needsByCategory = emptyNeedStats();
        addNeedStats(needsByCategory, pop);
        rows.push({
          id: `${regionId}:${pop.id}`,
          popId: pop.id,
          regionId,
          regionName: regionId,
          professionId: pop.professionId,
          professionName: professionMeta?.name ?? pop.professionId,
          cultureId: pop.cultureId,
          cultureName: cultureMeta?.name ?? pop.cultureId,
          religionId: pop.religionId,
          religionName: religionMeta?.name ?? pop.religionId,
          raceId: pop.raceId,
          raceName: raceMeta?.name ?? pop.raceId,
          size,
          radicals: Math.max(0, Number(pop.radicals ?? 0)),
          loyalists: Math.max(0, Number(pop.loyalists ?? 0)),
          standardOfLiving,
          politicalStrength: Math.max(0, Number(pop.politicalStrength ?? 0)),
          jobStatus: String(pop.lastJobStatus ?? "unemployed"),
          employmentKey,
          employmentLabel: resolveEmploymentLabel(employmentKey, t),
          employed: Math.max(0, Number(pop.lastEmployed ?? 0)),
          openJobs: Math.max(0, Number(pop.lastOpenJobs ?? 0)),
          discriminationKey,
          discriminationLabel: discriminationKey === "discriminated" ? t("population.discriminated") : t("population.accepted"),
          discriminationReasons: pop.lastDiscriminationReasons ?? [],
          discriminationPenalty: Math.max(0, Number(pop.lastDiscriminationPenalty ?? 0)),
          solBucket,
          solBucketLabel: resolveSolBucketLabel(solBucket, t),
          ideologyLabel: resolveTopIdeologyLabel(pop, entryByKindById.ideologies, t),
          income: Math.max(0, Number(pop.lastIncomeDucats ?? 0)),
          spend: Math.max(0, Number(pop.lastNeedsSpendDucats ?? 0)),
          ducats: Math.max(0, Number(pop.ducats ?? 0)),
          needsSatisfaction: Math.max(0, Number(pop.lastNeedsSatisfaction ?? 1)),
          needsByCategory,
          qualificationLimit: Math.max(0, Number(pop.lastQualificationLimit ?? 0)),
          qualificationShortages: pop.lastQualificationShortageByCategory ?? {},
        });
      }
    }
    return rows.sort((left, right) => right.size - left.size || left.id.localeCompare(right.id));
  }, [entryByKindById, scopedRegionIds, t, worldBase]);

  const filteredRows = useMemo(() => atomicRows.filter((row) => rowMatchesFilters(row, filters)), [atomicRows, filters]);
  const groupedRows = useMemo(() => buildGroupedRows(filteredRows, t), [filteredRows, t]);
  const visibleRows: PopulationTableRow[] = tableMode === "atomic" ? filteredRows : groupedRows;
  const totalPopulation = filteredRows.reduce((sum, row) => sum + row.size, 0);
  const totalPoliticalStrength = filteredRows.reduce((sum, row) => sum + row.politicalStrength, 0);
  const selectedFilterCount = FILTER_KEYS.reduce((sum, key) => sum + filters[key].length, 0);

  const filterOptions = useMemo<Record<FilterKey, FilterOption[]>>(() => {
    const rowsFor = (key: FilterKey) => atomicRows.filter((row) => rowMatchesFilters(row, filters, key));
    return {
      profession: buildOptions(rowsFor("profession"), (row) => row.professionId, (row) => row.professionName, (row) => normalizeColor(entryByKindById.professions[row.professionId]?.color, row.professionId)),
      region: buildOptions(rowsFor("region"), (row) => row.regionId, (row) => row.regionName, (row) => colorFromId(row.regionId)),
      culture: buildOptions(rowsFor("culture"), (row) => row.cultureId, (row) => row.cultureName, (row) => normalizeColor(entryByKindById.cultures[row.cultureId]?.color, row.cultureId)),
      religion: buildOptions(rowsFor("religion"), (row) => row.religionId, (row) => row.religionName, (row) => normalizeColor(entryByKindById.religions[row.religionId]?.color, row.religionId)),
      discrimination: buildOptions(rowsFor("discrimination"), (row) => row.discriminationKey, (row) => row.discriminationLabel, (row) => (row.discriminationKey === "discriminated" ? "#b97878" : "#69a992")),
      employment: buildOptions(rowsFor("employment"), (row) => row.employmentKey, (row) => row.employmentLabel, (row) => colorFromId(row.employmentKey)),
      sol: buildOptions(rowsFor("sol"), (row) => row.solBucket, (row) => row.solBucketLabel, (row) => colorFromId(row.solBucket)),
    };
  }, [atomicRows, entryByKindById, filters]);

  const chartDefinitions = useMemo<ChartDefinition[]>(() => [
    {
      id: "population",
      titleKey: "population.chart.population",
      filterKey: "employment",
      valueKind: "population",
      groupBy: (row) => ({ id: row.employmentKey, label: row.employmentLabel, color: colorFromId(row.employmentKey) }),
    },
    {
      id: "politicalStrength",
      titleKey: "population.chart.politicalStrength",
      filterKey: "profession",
      valueKind: "politicalStrength",
      groupBy: (row) => ({ id: row.professionId, label: row.professionName, color: normalizeColor(entryByKindById.professions[row.professionId]?.color, row.professionId) }),
    },
    {
      id: "region",
      titleKey: "population.chart.region",
      filterKey: "region",
      valueKind: "population",
      groupBy: (row) => ({ id: row.regionId, label: row.regionName, color: colorFromId(row.regionId) }),
    },
    {
      id: "culture",
      titleKey: "population.chart.culture",
      filterKey: "culture",
      valueKind: "population",
      groupBy: (row) => ({ id: row.cultureId, label: row.cultureName, color: normalizeColor(entryByKindById.cultures[row.cultureId]?.color, row.cultureId) }),
    },
    {
      id: "religion",
      titleKey: "population.chart.religion",
      filterKey: "religion",
      valueKind: "population",
      groupBy: (row) => ({ id: row.religionId, label: row.religionName, color: normalizeColor(entryByKindById.religions[row.religionId]?.color, row.religionId) }),
    },
    {
      id: "profession",
      titleKey: "population.chart.profession",
      filterKey: "profession",
      valueKind: "population",
      groupBy: (row) => ({ id: row.professionId, label: row.professionName, color: normalizeColor(entryByKindById.professions[row.professionId]?.color, row.professionId) }),
    },
  ], [entryByKindById]);

  const toggleFilter = (key: FilterKey, id: string) => setFilters((prev) => toggleFilterValue(prev, key, id));
  const resetFilters = () => setFilters(EMPTY_FILTERS);
  const toggleExpanded = (id: string) => setExpandedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));

  const renderFilterGroup = (key: FilterKey) => {
    const collapsed = collapsedFilters[key];
    const options = filterOptions[key];
    return (
      <section className="arc-pop-overview-filter-group">
        <button
          type="button"
          className="arc-pop-overview-filter-header"
          onClick={() => setCollapsedFilters((prev) => ({ ...prev, [key]: !prev[key] }))}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          <span>{t(FILTER_LABEL_KEYS[key])}</span>
          {filters[key].length > 0 ? <strong>{filters[key].length}</strong> : null}
        </button>
        {!collapsed ? (
          <div className="arc-pop-overview-filter-options">
            {options.map((option) => {
              const selected = filters[key].includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`arc-pop-overview-filter-chip ${selected ? "arc-pop-overview-filter-chip--selected" : ""}`}
                  onClick={() => toggleFilter(key, option.id)}
                >
                  <span className="arc-pop-overview-color" style={{ backgroundColor: option.color }} />
                  <span>{option.label}</span>
                  <strong>{formatCompact(option.count)}</strong>
                </button>
              );
            })}
            {options.length === 0 ? <div className="arc-pop-overview-muted">{t("population.noData")}</div> : null}
          </div>
        ) : null}
      </section>
    );
  };

  const renderRowDetails = (row: PopulationTableRow) => {
    const shortageRows = Object.entries(row.qualificationShortages).filter(([, value]) => Number(value) > 0);
    return (
      <tr className="arc-pop-overview-row-detail">
        <td colSpan={14}>
          <div className="arc-pop-overview-detail-grid">
            <section>
              <h4>{t("population.detail.needs")}</h4>
              {NEED_CATEGORY_KEYS.map((category) => {
                const stats = row.needsByCategory[category];
                const satisfaction = stats.required > 0 ? stats.fulfilled / stats.required : 1;
                return (
                  <div key={category} className="arc-pop-overview-detail-row">
                    <span>{t(NEED_CATEGORY_LABEL_KEYS[category])}</span>
                    <strong>{stats.required > 0 ? `${Math.round(satisfaction * 100)}%` : t("population.none")}</strong>
                  </div>
                );
              })}
            </section>
            <section>
              <h4>{t("population.detail.finance")}</h4>
              <div className="arc-pop-overview-detail-row"><span>{t("population.incomePerTurn")}</span><strong>+{formatCompact(row.income)}</strong></div>
              <div className="arc-pop-overview-detail-row"><span>{t("population.totalExpenses")}</span><strong>-{formatCompact(row.spend)}</strong></div>
              <div className="arc-pop-overview-detail-row"><span>{t("population.wallet")}</span><strong>{formatCompact(row.ducats)}</strong></div>
            </section>
            <section>
              <h4>{t("population.detail.qualifications")}</h4>
              <div className="arc-pop-overview-detail-row"><span>{t("population.qualifications")}</span><strong>{formatCompact(row.qualificationLimit)}</strong></div>
              {shortageRows.length > 0 ? shortageRows.map(([category, value]) => (
                <div key={category} className="arc-pop-overview-detail-row">
                  <span>{category}</span>
                  <strong>{formatCompact(Number(value))}</strong>
                </div>
              )) : <div className="arc-pop-overview-muted">{t("population.none")}</div>}
            </section>
            <section>
              <h4>{t("population.detail.status")}</h4>
              <div className="arc-pop-overview-detail-row"><span>{t("population.employment")}</span><strong>{row.employmentLabel}</strong></div>
              <div className="arc-pop-overview-detail-row"><span>{t("population.discrimination")}</span><strong>{row.discriminationLabel}</strong></div>
              <div className="arc-pop-overview-detail-row"><span>{t("population.detail.reasons")}</span><strong>{row.discriminationReasons.join(", ") || t("population.none")}</strong></div>
            </section>
          </div>
        </td>
      </tr>
    );
  };

  const title = mode === "country" ? t("population.countryTitle", { country: countryName }) : t("population.worldTitle");
  const subtitle = mode === "country" ? t("population.countryRegionSubtitle") : t("population.worldRegionSubtitle");

  return (
    <AppModal
      open={open}
      onClose={onClose}
      modalKey="population"
      panelClassName="arc-building-overview-modal arc-pop-overview-modal !rounded-none !border-0 !p-0"
      paddingClassName="p-[11px]"
      zIndexClassName="z-[205]"
    >
      <header className="arc-building-overview-header">
        <div>
          <div className="arc-building-overview-title">{t("population.panelTitle")}</div>
          <p>{subtitle}</p>
        </div>
        <div className="arc-pop-overview-header-actions">
          <span>{title}</span>
          <strong>{formatCompact(totalPopulation)}</strong>
          <AppButton type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t("common.close")}>
            <ChevronRight size={16} />
          </AppButton>
        </div>
      </header>

      <div className="arc-building-overview-body arc-pop-overview-body">
        <aside className="arc-pop-overview-sidebar arc-scrollbar">
          <div className="arc-pop-overview-panel-title">
            <ChevronDown size={16} />
            <span>{t("population.filtersTitle")}</span>
          </div>
          <button type="button" className="arc-pop-overview-reset" onClick={resetFilters} disabled={selectedFilterCount === 0}>
            <RotateCcw size={14} />
            <span>{t("population.resetFilters")}</span>
          </button>
          <div className="arc-pop-overview-scope">
            <button type="button" className={mode === "country" ? "is-active" : ""} onClick={() => setMode("country")}>
              <MapPinned size={14} />
              <span>{countryName}</span>
            </button>
            <button type="button" className={mode === "world" ? "is-active" : ""} onClick={() => setMode("world")}>
              <Globe2 size={14} />
              <span>{t("population.scopeWorld")}</span>
            </button>
          </div>
          {FILTER_KEYS.map((key) => (
            <div key={key}>{renderFilterGroup(key)}</div>
          ))}
        </aside>

        <main className="arc-pop-overview-main">
          <section className="arc-pop-overview-section-title">
            <ChevronDown size={16} />
            <span>{t("population.chartsTitle")}</span>
            <strong>{t("population.rowsShown", { count: visibleRows.length })}</strong>
          </section>
          <div className="arc-pop-overview-charts arc-scrollbar">
            {chartDefinitions.map((definition) => {
              const rows = atomicRows.filter((row) => rowMatchesFilters(row, filters, definition.filterKey));
              const data = buildChartData({
                rows,
                valueKind: definition.valueKind,
                filterKey: definition.filterKey,
                groupBy: definition.groupBy,
              });
              const selectedIds = definition.filterKey ? filters[definition.filterKey] : [];
              return (
                <PopulationTreemapCard
                  key={definition.id}
                  title={t(definition.titleKey)}
                  valueKind={definition.valueKind}
                  data={data}
                  selectedIds={selectedIds}
                  onSelect={(datum) => {
                    if (datum.filterKey) toggleFilter(datum.filterKey, datum.id);
                  }}
                />
              );
            })}
          </div>

          <section className="arc-pop-overview-table-panel">
            <div className="arc-pop-overview-table-toolbar">
              <div className="arc-pop-overview-section-title">
                <Rows3 size={16} />
                <span>{t("population.tableTitle")}</span>
                <strong>{formatCompact(totalPopulation)}</strong>
                <strong>{t("population.tablePoliticalStrength", { value: formatCompact(totalPoliticalStrength) })}</strong>
              </div>
              <div className="arc-pop-overview-table-mode">
                <button type="button" className={tableMode === "atomic" ? "is-active" : ""} onClick={() => setTableMode("atomic")}>
                  <CircleDot size={14} />
                  <span>{t("population.mode.atomic")}</span>
                </button>
                <button type="button" className={tableMode === "grouped" ? "is-active" : ""} onClick={() => setTableMode("grouped")}>
                  <ListTree size={14} />
                  <span>{t("population.mode.grouped")}</span>
                </button>
              </div>
            </div>

            <div className="arc-pop-overview-table-shell arc-scrollbar">
              <table className="arc-pop-overview-table">
                <thead>
                  <tr>
                    <th>{t("population.sizeColumn")}</th>
                    <th>{t("population.professionColumn")}</th>
                    <th>{t("population.cultureColumn")}</th>
                    <th>{t("population.religionColumn")}</th>
                    <th>{t("population.raceColumn")}</th>
                    <th>{t("population.regionColumn")}</th>
                    <th>{t("population.table.workplace")}</th>
                    <th>{t("population.radicals")}</th>
                    <th>{t("population.loyalists")}</th>
                    <th>{t("population.table.sol")}</th>
                    <th>{t("population.table.politicalStrength")}</th>
                    <th>{t("population.table.ideologyInterest")}</th>
                    <th>{t("population.discrimination")}</th>
                    <th>{t("population.table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const expanded = expandedRows.includes(row.id);
                    return (
                      <Fragment key={row.id}>
                        <tr className="arc-pop-overview-table-row">
                          <td><strong>{formatCompact(row.size)}</strong></td>
                          <td>{row.professionName}</td>
                          <td>{row.cultureName}</td>
                          <td>{row.religionName}</td>
                          <td>{row.raceName}</td>
                          <td>{row.regionName}</td>
                          <td>{row.employmentLabel}</td>
                          <td className="is-bad">{formatCompact(row.radicals)}</td>
                          <td className="is-good">{formatCompact(row.loyalists)}</td>
                          <td>{row.solBucketLabel} ({row.standardOfLiving.toFixed(1)})</td>
                          <td>{formatCompact(row.politicalStrength)}</td>
                          <td>{row.ideologyLabel}</td>
                          <td className={row.discriminationKey === "discriminated" ? "is-bad" : "is-good"}>{row.discriminationLabel}</td>
                          <td>
                            <button type="button" className="arc-pop-overview-detail-button" onClick={() => toggleExpanded(row.id)}>
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span>{t("population.table.details")}</span>
                            </button>
                          </td>
                        </tr>
                        {expanded ? renderRowDetails(row) : null}
                      </Fragment>
                    );
                  })}
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={14}>
                        <div className="arc-pop-overview-empty">{t("population.noData")}</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </AppModal>
  );
}
