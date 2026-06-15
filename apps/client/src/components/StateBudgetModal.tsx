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
  label: string;
  value: number;
};

function formatInt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.max(0, Math.floor(value)));
}

function formatSigned(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${new Intl.NumberFormat("ru-RU").format(rounded)}`;
  if (rounded < 0) return `-${new Intl.NumberFormat("ru-RU").format(Math.abs(rounded))}`;
  return "0";
}

function netClass(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-300";
  return "text-slate-200";
}

const TABS: Array<{ id: TabId; label: string; icon: typeof Wallet }> = [
  { id: "summary", label: "Сводка", icon: Wallet },
  { id: "expenses", label: "Расходы", icon: ReceiptText },
  { id: "subsidies", label: "Субсидии", icon: Landmark },
  { id: "history", label: "История", icon: ListFilter },
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
        label: "Базовый доход государства",
        value: Math.max(0, Math.floor(projectedIncomeDucats ?? 0)),
      },
    ],
    [projectedIncomeDucats],
  );
  const expenseRows = useMemo<BudgetCategoryRow[]>(
    () => [
      { key: "subsidies", label: "Государственные субсидии", value: Math.max(0, Math.floor(ducatExpenses.subsidies ?? 0)) },
      { key: "construction", label: "Строительные проекты", value: Math.max(0, Math.floor(ducatExpenses.construction ?? 0)) },
      { key: "colonization", label: "Поддержка колонизаций", value: Math.max(0, Math.floor(ducatExpenses.colonizationSupport ?? 0)) },
      { key: "province-rename", label: "Переименование провинций", value: Math.max(0, Math.floor(ducatExpenses.provinceRename ?? 0)) },
      { key: "customization", label: "Кастомизация страны", value: Math.max(0, Math.floor(ducatExpenses.customization ?? 0)) },
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
        .map((row, index) => ({ ...row, color: INCOME_CHART_COLORS[index % INCOME_CHART_COLORS.length] })),
    [incomeRows],
  );
  const expenseChartRows = useMemo(
    () =>
      expenseRows
        .filter((row) => row.value > 0)
        .map((row, index) => ({ ...row, color: EXPENSE_CHART_COLORS[index % EXPENSE_CHART_COLORS.length] })),
    [expenseRows],
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
              `${params.name}<br/>${formatInt(params.value)} дукат (${Math.round(params.percent)}%)`,
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

    applyPie(incomePieRef.current, incomeChartRef, "Доходы", incomeChartRows);
    applyPie(expensePieRef.current, expenseChartRef, "Расходы", expenseChartRows);

    const applyAndResize = () => {
      applyPie(incomePieRef.current, incomeChartRef, "Доходы", incomeChartRows);
      applyPie(expensePieRef.current, expenseChartRef, "Расходы", expenseChartRows);
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
  }, [activeTab, expenseChartRows, incomeChartRows, open]);

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

  return (
    <AppModal open={open} onClose={onClose} modalKey="budget" zIndexClassName="z-[130]">
            <AppModalHeader
              title="Бюджет дукатов государства"
              description={`${countryName} (${countryId}) • Ход #${turnId}`}
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
                    {tab.label}
                  </AppButton>
                );
              })}
            </AppToolbar>

            <div className="arc-scrollbar min-h-0 flex-1 overflow-auto pr-1">
            {activeTab === "summary" && (
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                  <AppCard className="bg-black/20">
                    <div className="text-[11px] text-white/55">Казна сейчас</div>
                    <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-white">
                      {ducatIconUrl ? <img src={ducatIconUrl} alt="" className="h-4 w-4 object-contain" /> : null}
                      {formatInt(currentDucats)}
                    </div>
                  </AppCard>
                  <AppCard className="bg-black/20">
                    <div className="text-[11px] text-white/55">Доходы за ход</div>
                    <div className="mt-1 text-lg font-semibold text-emerald-400">+{formatInt(projectedIncomeDucats)}</div>
                  </AppCard>
                  <AppCard className="bg-black/20">
                    <div className="text-[11px] text-white/55">Расходы за ход</div>
                    <div className="mt-1 text-lg font-semibold text-rose-300">-{formatInt(ducatExpenses.total)}</div>
                  </AppCard>
                  <AppCard className="bg-black/20">
                    <div className="text-[11px] text-white/55">Прогноз на конец хода</div>
                    <div className={`mt-1 text-lg font-semibold ${netClass(net)}`}>{formatInt(projectedEnd)}</div>
                    <div className={`mt-1 text-xs ${netClass(net)}`}>Итог: {formatSigned(net)}</div>
                  </AppCard>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <AppSection>
                    <AppSectionHeader title="График доходов по категориям" icon={<Wallet size={14} />} />
                    <div ref={incomePieRef} className="h-[320px] w-full" />
                  </AppSection>
                  <AppSection>
                    <AppSectionHeader title="График расходов по категориям" icon={<ReceiptText size={14} />} />
                    <div ref={expensePieRef} className="h-[320px] w-full" />
                  </AppSection>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <AppSection>
                    <AppSectionHeader title="Доходы по категориям" icon={<Wallet size={14} />} />
                    <AppTableShell>
                      <AppTable>
                        <thead>
                          <tr>
                            <AppHeadCell>Категория</AppHeadCell>
                            <AppHeadCell className="text-right">Сумма</AppHeadCell>
                          </tr>
                        </thead>
                        <tbody>
                        {incomeRows.map((row) => (
                          <tr key={row.key}>
                            <AppCell>{row.label}</AppCell>
                            <AppCell className="text-right font-semibold text-emerald-400">+{formatInt(row.value)}</AppCell>
                          </tr>
                        ))}
                          <tr>
                            <AppCell className="font-semibold text-white">Итого доходов</AppCell>
                            <AppCell className="text-right font-semibold text-emerald-400">+{formatInt(incomeTableTotal)}</AppCell>
                          </tr>
                        </tbody>
                      </AppTable>
                    </AppTableShell>
                  </AppSection>

                  <AppSection>
                    <AppSectionHeader title="Расходы по категориям" icon={<ReceiptText size={14} />} />
                    <AppTableShell>
                      <AppTable>
                        <thead>
                          <tr>
                            <AppHeadCell>Категория</AppHeadCell>
                            <AppHeadCell className="text-right">Сумма</AppHeadCell>
                          </tr>
                        </thead>
                        <tbody>
                        {expenseRows.map((row) => (
                          <tr key={row.key}>
                            <AppCell>{row.label}</AppCell>
                            <AppCell className="text-right font-semibold text-rose-300">-{formatInt(row.value)}</AppCell>
                          </tr>
                        ))}
                          <tr>
                            <AppCell className="font-semibold text-white">Итого расходов</AppCell>
                            <AppCell className="text-right font-semibold text-rose-300">-{formatInt(expenseTableTotal)}</AppCell>
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
                {[
                  { key: "subsidies", label: "Государственные субсидии", value: ducatExpenses.subsidies },
                  { key: "construction", label: "Строительные проекты", value: ducatExpenses.construction },
                  { key: "colonization", label: "Поддержка колонизаций", value: ducatExpenses.colonizationSupport },
                  { key: "rename", label: "Переименование провинций", value: ducatExpenses.provinceRename },
                  { key: "customization", label: "Кастомизация страны", value: ducatExpenses.customization },
                ]
                  .filter((row) => row.value > 0)
                  .map((row) => (
                    <AppCard key={row.key} className="flex items-center justify-between bg-black/20 px-3 py-2 text-sm">
                      <span className="text-white/85">{row.label}</span>
                      <span className="text-rose-300">-{formatInt(row.value)} дукат</span>
                    </AppCard>
                  ))}
                <AppCard className="flex items-center justify-between border-white/20 bg-black/30 px-3 py-2 text-sm font-semibold">
                  <span className="text-white">Итого расходов</span>
                  <span className="text-rose-300">-{formatInt(ducatExpenses.total)} дукат</span>
                </AppCard>
              </div>
            )}

            {activeTab === "subsidies" && (
              <div className="space-y-2">
                <AppCard className="bg-black/20 px-3 py-2 text-sm text-white/85">
                  Выплачено субсидий в этом ходу: <span className="font-semibold text-emerald-400">{formatInt(subsidyTotal)} дукат</span>
                </AppCard>
                <div className="arc-scrollbar max-h-[45vh] space-y-2 overflow-auto pr-1">
                  {subsidyRows.length === 0 ? (
                    <AppEmptyState>В этом ходу субсидий не выплачено.</AppEmptyState>
                  ) : (
                    subsidyRows.map((row) => (
                      <AppCard key={row.instanceId} className="bg-black/20 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-white">{row.buildingName}</span>
                          <span className="text-emerald-400">+{formatInt(row.amountInt)} дукат</span>
                        </div>
                        <div className="mt-1 text-xs text-white/55">Region ID: {row.regionName}</div>
                      </AppCard>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div className="arc-scrollbar max-h-[45vh] space-y-2 overflow-auto pr-1">
                {historyRows.map((row) => (
                  <AppCard key={row.turnId} className="bg-black/20 px-3 py-2 text-sm">
                    <div className="mb-1 text-xs text-white/55">Ход #{row.turnId}</div>
                    <div className="grid gap-2 md:grid-cols-5">
                      <div>
                        <div className="text-[11px] text-white/50">Казна</div>
                        <div className="text-white">{formatInt(row.treasuryStart)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-white/50">Доходы</div>
                        <div className="text-emerald-400">+{formatInt(row.income)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-white/50">Расходы</div>
                        <div className="text-rose-300">-{formatInt(row.expenses)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-white/50">Итог</div>
                        <div className={netClass(row.net)}>{formatSigned(row.net)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-white/50">Прогноз</div>
                        <div className={netClass(row.net)}>{formatInt(row.projectedEnd)}</div>
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
