import type { WorldBase } from "@arcanorum/shared";
import * as echarts from "echarts";
import type { EChartsType } from "echarts";
import { Landmark, ListFilter, ReceiptText, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchContentEntries } from "../lib/api";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState, AppSection, AppSectionHeader, AppToolbar } from "./ui/AppSurface";
import { AppCell, AppHeadCell, AppTable, AppTableShell } from "./ui/AppTable";
import { useUiText } from "../i18n/useUiText";
import type { UiLocale, UiTextKey } from "../i18n/uiText";

type DucatExpenses = {
  customization: number;
  provinceRename: number;
  colonizationSupport: number;
  construction: number;
  subsidies: number;
  total: number;
};

type SubsidyItem = {
  regionId: string;
  buildingId: string;
  instanceId: string;
  amount: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  worldBase: WorldBase | null;
  turnId: number;
  countryId: string;
  countryName: string;
  currentDucats: number;
  projectedIncomeDucats: number;
  ducatExpenses: DucatExpenses;
  subsidyItems: SubsidyItem[];
  ducatIconUrl?: string | null;
};

type TabId = "summary" | "expenses" | "subsidies" | "history";

type HistoryRow = {
  turnId: number;
  treasuryStart: number;
  income: number;
  expenses: number;
  net: number;
  projectedEnd: number;
};

type BudgetCategoryRow = {
  key: string;
  labelKey: UiTextKey;
  value: number;
};

function formatInt(value: number, locale: UiLocale): string {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(Math.max(0, Math.floor(value)));
}

function formatSigned(value: number, locale: UiLocale): string {
  const rounded = Math.round(value);
  const formatted = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(Math.abs(rounded));
  if (rounded > 0) return `+${formatted}`;
  if (rounded < 0) return `-${formatted}`;
  return "0";
}

function netClass(value: number): string {
  if (value > 0) return "arc-budget-value--good";
  if (value < 0) return "arc-budget-value--bad";
  return "arc-budget-value--neutral";
}

const TABS: Array<{ id: TabId; labelKey: UiTextKey; icon: typeof Wallet }> = [
  { id: "summary", labelKey: "budget.tab.summary", icon: Wallet },
  { id: "expenses", labelKey: "budget.tab.expenses", icon: ReceiptText },
  { id: "subsidies", labelKey: "budget.tab.subsidies", icon: Landmark },
  { id: "history", labelKey: "budget.tab.history", icon: ListFilter },
];

const INCOME_CHART_COLORS = ["#34d399", "#22d3ee", "#60a5fa", "#a78bfa", "#f59e0b"];
const EXPENSE_CHART_COLORS = ["#fb7185", "#f87171", "#f59e0b", "#f97316", "#a78bfa"];

export function StateBudgetModal({
  open,
  onClose,
  worldBase,
  turnId,
  countryId,
  countryName,
  currentDucats,
  projectedIncomeDucats,
  ducatExpenses,
  subsidyItems,
  ducatIconUrl,
}: Props) {
  const { locale, t } = useUiText();
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [buildingNameById, setBuildingNameById] = useState<Record<string, string>>({});
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const incomePieRef = useRef<HTMLDivElement | null>(null);
  const expensePieRef = useRef<HTMLDivElement | null>(null);
  const incomeChartRef = useRef<EChartsType | null>(null);
  const expenseChartRef = useRef<EChartsType | null>(null);

  const projectedEnd = useMemo(
    () => Math.floor(Number(currentDucats ?? 0) + Number(projectedIncomeDucats ?? 0) - Number(ducatExpenses.total ?? 0)),
    [currentDucats, ducatExpenses.total, projectedIncomeDucats],
  );
  const net = useMemo(() => projectedIncomeDucats - ducatExpenses.total, [ducatExpenses.total, projectedIncomeDucats]);
  const incomeRows = useMemo<BudgetCategoryRow[]>(
    () => [
      {
        key: "base-income",
        labelKey: "budget.category.baseIncome",
        value: Math.max(0, Math.floor(projectedIncomeDucats ?? 0)),
      },
    ],
    [projectedIncomeDucats],
  );
  const expenseRows = useMemo<BudgetCategoryRow[]>(
    () => [
      { key: "subsidies", labelKey: "budget.category.subsidies", value: Math.max(0, Math.floor(ducatExpenses.subsidies ?? 0)) },
      { key: "construction", labelKey: "budget.category.construction", value: Math.max(0, Math.floor(ducatExpenses.construction ?? 0)) },
      { key: "colonization", labelKey: "budget.category.colonization", value: Math.max(0, Math.floor(ducatExpenses.colonizationSupport ?? 0)) },
      { key: "province-rename", labelKey: "budget.category.provinceRename", value: Math.max(0, Math.floor(ducatExpenses.provinceRename ?? 0)) },
      { key: "customization", labelKey: "budget.category.customization", value: Math.max(0, Math.floor(ducatExpenses.customization ?? 0)) },
    ],
    [
      ducatExpenses.colonizationSupport,
      ducatExpenses.construction,
      ducatExpenses.customization,
      ducatExpenses.provinceRename,
      ducatExpenses.subsidies,
    ],
  );
  const incomeTableTotal = useMemo(
    () => incomeRows.reduce((sum, row) => sum + Math.max(0, Math.floor(row.value)), 0),
    [incomeRows],
  );
  const expenseTableTotal = useMemo(
    () => expenseRows.reduce((sum, row) => sum + Math.max(0, Math.floor(row.value)), 0),
    [expenseRows],
  );
  const incomeChartRows = useMemo(
    () =>
      incomeRows
        .filter((row) => row.value > 0)
        .map((row, index) => ({ ...row, label: t(row.labelKey), color: INCOME_CHART_COLORS[index % INCOME_CHART_COLORS.length] })),
    [incomeRows, t],
  );
  const expenseChartRows = useMemo(
    () =>
      expenseRows
        .filter((row) => row.value > 0)
        .map((row, index) => ({ ...row, label: t(row.labelKey), color: EXPENSE_CHART_COLORS[index % EXPENSE_CHART_COLORS.length] })),
    [expenseRows, t],
  );

  useEffect(() => {
    if (!open) return;
    setActiveTab("summary");
    let cancelled = false;
    fetchContentEntries("buildings")
      .then((items) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const item of items) {
          map[item.id] = item.name;
        }
        setBuildingNameById(map);
      })
      .catch(() => {
        if (!cancelled) setBuildingNameById({});
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHistoryRows((prev) => {
      const row: HistoryRow = {
        turnId,
        treasuryStart: Math.max(0, Math.floor(currentDucats ?? 0)),
        income: Math.max(0, Math.floor(projectedIncomeDucats ?? 0)),
        expenses: Math.max(0, Math.floor(ducatExpenses.total ?? 0)),
        net: Math.floor(net),
        projectedEnd: Math.max(0, Math.floor(projectedEnd)),
      };
      const rest = prev.filter((entry) => entry.turnId !== turnId);
      return [row, ...rest].slice(0, 20);
    });
  }, [currentDucats, ducatExpenses.total, net, open, projectedEnd, projectedIncomeDucats, turnId]);

  useEffect(() => {
    if (!open || activeTab !== "summary") return;
    const applyPie = (
      container: HTMLDivElement | null,
      holder: { current: EChartsType | null },
      title: string,
      rows: Array<{ label: string; value: number; color: string }>,
    ) => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return;
      const existing = holder.current;
      const chart =
        existing && existing.getDom() === container
          ? existing
          : (() => {
              existing?.dispose();
              return echarts.init(container);
            })();
      holder.current = chart;
      chart.setOption(
        {
          animationDuration: 280,
          backgroundColor: "transparent",
          tooltip: {
            trigger: "item",
            backgroundColor: "rgba(7,12,20,0.92)",
            borderColor: "rgba(148,163,184,0.25)",
            borderWidth: 1,
            textStyle: { color: "#e2e8f0", fontSize: 11 },
            formatter: (params: { name: string; value: number; percent: number }) =>
              `${params.name}<br/>${formatInt(params.value, locale)} ${t("shell.resource.ducats")} (${Math.round(params.percent)}%)`,
          },
          legend: {
            bottom: 0,
            left: "center",
            itemWidth: 10,
            itemHeight: 10,
            textStyle: { color: "rgba(226,232,240,0.75)", fontSize: 11 },
          },
          series: [
            {
              name: title,
              type: "pie",
              radius: ["48%", "68%"],
              center: ["50%", "43%"],
              avoidLabelOverlap: true,
              label: { show: false },
              labelLine: { show: false },
              data: rows.map((row) => ({
                name: row.label,
                value: Math.max(0, Math.floor(row.value)),
                itemStyle: { color: row.color },
              })),
              emphasis: {
                scale: true,
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: "rgba(0, 0, 0, 0.45)",
                },
              },
            },
          ],
        },
        { notMerge: true },
      );
    };

    applyPie(incomePieRef.current, incomeChartRef, t("budget.chart.income"), incomeChartRows);
    applyPie(expensePieRef.current, expenseChartRef, t("budget.chart.expenses"), expenseChartRows);

    const applyAndResize = () => {
      applyPie(incomePieRef.current, incomeChartRef, t("budget.chart.income"), incomeChartRows);
      applyPie(expensePieRef.current, expenseChartRef, t("budget.chart.expenses"), expenseChartRows);
      incomeChartRef.current?.resize();
      expenseChartRef.current?.resize();
    };
    const rafId = window.requestAnimationFrame(applyAndResize);
    const rafId2 = window.requestAnimationFrame(() => window.requestAnimationFrame(applyAndResize));
    const timeoutId = window.setTimeout(() => {
      applyAndResize();
    }, 140);
    const timeoutId2 = window.setTimeout(() => {
      applyAndResize();
    }, 320);

    const observers: ResizeObserver[] = [];
    for (const ref of [incomePieRef, expensePieRef]) {
      if (!ref.current) continue;
      const observer = new ResizeObserver(applyAndResize);
      observer.observe(ref.current);
      observers.push(observer);
    }

    const onResize = () => {
      applyAndResize();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.cancelAnimationFrame(rafId2);
      window.clearTimeout(timeoutId);
      window.clearTimeout(timeoutId2);
      observers.forEach((observer) => observer.disconnect());
      window.removeEventListener("resize", onResize);
    };
  }, [activeTab, expenseChartRows, incomeChartRows, locale, open, t]);

  useEffect(() => {
    if (open) return;
    incomeChartRef.current?.dispose();
    expenseChartRef.current?.dispose();
    incomeChartRef.current = null;
    expenseChartRef.current = null;
  }, [open]);

  useEffect(() => {
    return () => {
      incomeChartRef.current?.dispose();
      expenseChartRef.current?.dispose();
      incomeChartRef.current = null;
      expenseChartRef.current = null;
    };
  }, []);

  const subsidyTotal = Math.max(0, Math.floor(subsidyItems.reduce((sum, item) => sum + Math.max(0, item.amount), 0)));
  const subsidyRows = useMemo(
    () =>
      subsidyItems
        .map((item) => ({
          ...item,
          buildingName: buildingNameById[item.buildingId] ?? item.buildingId,
          regionName: item.regionId,
          amountInt: Math.max(0, Math.floor(item.amount)),
        }))
        .sort((a, b) => b.amountInt - a.amountInt),
    [buildingNameById, subsidyItems],
  );

  const expenseDetailRows = [
    { key: "subsidies", labelKey: "budget.category.subsidies" as const, value: ducatExpenses.subsidies },
    { key: "construction", labelKey: "budget.category.construction" as const, value: ducatExpenses.construction },
    { key: "colonization", labelKey: "budget.category.colonization" as const, value: ducatExpenses.colonizationSupport },
    { key: "rename", labelKey: "budget.category.provinceRename" as const, value: ducatExpenses.provinceRename },
    { key: "customization", labelKey: "budget.category.customization" as const, value: ducatExpenses.customization },
  ];

  return (
    <AppModal
      open={open}
      onClose={onClose}
      modalKey="budget"
      zIndexClassName="z-[130]"
      panelClassName="arc-budget-panel"
    >
            <AppModalHeader
              title={t("budget.title")}
              description={`${countryName} (${countryId}) · ${t("shell.turn", { turn: turnId })}`}
              onClose={onClose}
            />

            <AppToolbar className="flex flex-wrap gap-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <AppButton
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    variant={active ? "primary" : "ghost"}
                    size="sm"
                    icon={<Icon size={14} />}
                  >
                    {t(tab.labelKey)}
                  </AppButton>
                );
              })}
            </AppToolbar>

            <div className="arc-scrollbar min-h-0 flex-1 overflow-auto pr-1">
            {activeTab === "summary" && (
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                  <AppCard className="arc-budget-metric-card">
                    <div className="text-[11px] text-[var(--arc-color-atlas-muted)]">{t("budget.metric.currentTreasury")}</div>
                    <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-[var(--arc-color-atlas-ink)]">
                      {ducatIconUrl ? <img src={ducatIconUrl} alt="" className="h-6 w-6 object-contain" /> : null}
                      {formatInt(currentDucats, locale)}
                    </div>
                  </AppCard>
                  <AppCard className="arc-budget-metric-card">
                    <div className="text-[11px] text-[var(--arc-color-atlas-muted)]">{t("budget.metric.turnIncome")}</div>
                    <div className="arc-budget-value--good mt-1 text-lg font-semibold">+{formatInt(projectedIncomeDucats, locale)}</div>
                  </AppCard>
                  <AppCard className="arc-budget-metric-card">
                    <div className="text-[11px] text-[var(--arc-color-atlas-muted)]">{t("budget.metric.turnExpenses")}</div>
                    <div className="arc-budget-value--bad mt-1 text-lg font-semibold">-{formatInt(ducatExpenses.total, locale)}</div>
                  </AppCard>
                  <AppCard className="arc-budget-metric-card">
                    <div className="text-[11px] text-[var(--arc-color-atlas-muted)]">{t("budget.metric.projectedEnd")}</div>
                    <div className={`mt-1 text-lg font-semibold ${netClass(net)}`}>{formatInt(projectedEnd, locale)}</div>
                    <div className={`mt-1 text-xs ${netClass(net)}`}>{t("budget.metric.net", { value: formatSigned(net, locale) })}</div>
                  </AppCard>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <AppSection>
                    <AppSectionHeader title={t("budget.chart.incomeByCategory")} icon={<Wallet size={14} />} />
                    <div ref={incomePieRef} className="h-[320px] w-full" />
                  </AppSection>
                  <AppSection>
                    <AppSectionHeader title={t("budget.chart.expensesByCategory")} icon={<ReceiptText size={14} />} />
                    <div ref={expensePieRef} className="h-[320px] w-full" />
                  </AppSection>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <AppSection>
                    <AppSectionHeader title={t("budget.table.incomeByCategory")} icon={<Wallet size={14} />} />
                    <AppTableShell>
                      <AppTable>
                        <thead>
                          <tr>
                            <AppHeadCell>{t("budget.table.category")}</AppHeadCell>
                            <AppHeadCell className="text-right">{t("budget.table.amount")}</AppHeadCell>
                          </tr>
                        </thead>
                        <tbody>
                        {incomeRows.map((row) => (
                          <tr key={row.key}>
                            <AppCell>{t(row.labelKey)}</AppCell>
                            <AppCell className="arc-budget-value--good text-right font-semibold">+{formatInt(row.value, locale)}</AppCell>
                          </tr>
                        ))}
                          <tr>
                            <AppCell className="font-semibold text-[var(--arc-color-atlas-ink)]">{t("budget.total.income")}</AppCell>
                            <AppCell className="arc-budget-value--good text-right font-semibold">+{formatInt(incomeTableTotal, locale)}</AppCell>
                          </tr>
                        </tbody>
                      </AppTable>
                    </AppTableShell>
                  </AppSection>

                  <AppSection>
                    <AppSectionHeader title={t("budget.table.expensesByCategory")} icon={<ReceiptText size={14} />} />
                    <AppTableShell>
                      <AppTable>
                        <thead>
                          <tr>
                            <AppHeadCell>{t("budget.table.category")}</AppHeadCell>
                            <AppHeadCell className="text-right">{t("budget.table.amount")}</AppHeadCell>
                          </tr>
                        </thead>
                        <tbody>
                        {expenseRows.map((row) => (
                          <tr key={row.key}>
                            <AppCell>{t(row.labelKey)}</AppCell>
                            <AppCell className="arc-budget-value--bad text-right font-semibold">-{formatInt(row.value, locale)}</AppCell>
                          </tr>
                        ))}
                          <tr>
                            <AppCell className="font-semibold text-[var(--arc-color-atlas-ink)]">{t("budget.total.expenses")}</AppCell>
                            <AppCell className="arc-budget-value--bad text-right font-semibold">-{formatInt(expenseTableTotal, locale)}</AppCell>
                          </tr>
                        </tbody>
                      </AppTable>
                    </AppTableShell>
                  </AppSection>
                </div>
              </div>
            )}

            {activeTab === "expenses" && (
              <div className="space-y-2">
                {expenseDetailRows
                  .filter((row) => row.value > 0)
                  .map((row) => (
                    <AppCard key={row.key} className="arc-budget-list-row">
                      <span>{t(row.labelKey)}</span>
                      <span className="arc-budget-value--bad">-{formatInt(row.value, locale)} {t("shell.resource.ducats")}</span>
                    </AppCard>
                  ))}
                <AppCard className="arc-budget-list-row arc-budget-list-row--total">
                  <span>{t("budget.total.expenses")}</span>
                  <span className="arc-budget-value--bad">-{formatInt(ducatExpenses.total, locale)} {t("shell.resource.ducats")}</span>
                </AppCard>
              </div>
            )}

            {activeTab === "subsidies" && (
              <div className="space-y-2">
                <AppCard className="arc-budget-list-row">
                  <span>{t("budget.subsidies.paidThisTurn")}</span>
                  <span className="arc-budget-value--good">{formatInt(subsidyTotal, locale)} {t("shell.resource.ducats")}</span>
                </AppCard>
                <div className="arc-scrollbar max-h-[45vh] space-y-2 overflow-auto pr-1">
                  {subsidyRows.length === 0 ? (
                    <AppEmptyState>{t("budget.subsidies.empty")}</AppEmptyState>
                  ) : (
                    subsidyRows.map((row) => (
                      <AppCard key={row.instanceId} className="arc-budget-subsidy-row">
                        <div className="flex items-center justify-between gap-2">
                          <span>{row.buildingName}</span>
                          <span className="arc-budget-value--good">+{formatInt(row.amountInt, locale)} {t("shell.resource.ducats")}</span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--arc-color-atlas-muted)]">{t("budget.subsidies.region", { region: row.regionName })}</div>
                      </AppCard>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div className="arc-scrollbar max-h-[45vh] space-y-2 overflow-auto pr-1">
                {historyRows.map((row) => (
                  <AppCard key={row.turnId} className="arc-budget-history-row">
                    <div className="mb-1 text-xs text-[var(--arc-color-atlas-muted)]">{t("shell.turn", { turn: row.turnId })}</div>
                    <div className="grid gap-2 md:grid-cols-5">
                      <div>
                        <div className="text-[11px] text-[var(--arc-color-atlas-muted)]">{t("budget.history.treasury")}</div>
                        <div>{formatInt(row.treasuryStart, locale)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[var(--arc-color-atlas-muted)]">{t("budget.history.income")}</div>
                        <div className="arc-budget-value--good">+{formatInt(row.income, locale)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[var(--arc-color-atlas-muted)]">{t("budget.history.expenses")}</div>
                        <div className="arc-budget-value--bad">-{formatInt(row.expenses, locale)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[var(--arc-color-atlas-muted)]">{t("budget.history.net")}</div>
                        <div className={netClass(row.net)}>{formatSigned(row.net, locale)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[var(--arc-color-atlas-muted)]">{t("budget.history.projected")}</div>
                        <div className={netClass(row.net)}>{formatInt(row.projectedEnd, locale)}</div>
                      </div>
                    </div>
                  </AppCard>
                ))}
              </div>
            )}
            </div>
    </AppModal>
  );
}
