import * as echarts from "echarts";
import type { EChartsType } from "echarts";
import { Landmark, Vote } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { CountryParliament, CountryParliamentPowers, WorldBase } from "@arcanorum/shared";
import { fetchPolitics, startLawBill, type ContentEntry, type PoliticsResponse } from "../lib/api";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState, AppSection, AppToolbar } from "./ui/AppSurface";

type Props = {
  open: boolean;
  token: string;
  countryId: string;
  countryName: string;
  worldBase: WorldBase | null;
  onClose: () => void;
};

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

type PartyVotePreview = {
  yesSeats: number;
  noSeats: number;
  abstainSeats: number;
  yesPct: number;
  noPct: number;
  abstainPct: number;
  color: string;
};

type PoliticsTab = "overview" | "powers" | "laws" | "parties" | "interestGroups";

const POLITICS_TABS: Array<{ id: PoliticsTab; label: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "powers", label: "Полномочия" },
  { id: "laws", label: "Законы" },
  { id: "parties", label: "Партии" },
  { id: "interestGroups", label: "Группы интересов" },
];

const DEFAULT_PARLIAMENT_POWERS: CountryParliamentPowers = {
  laws: "approve",
  budget: "approve_budget",
  diplomacy: "ratify_major_treaties",
  war: "approve",
  government: "confidence_vote",
  moneyTransferRatificationThreshold: 10000,
};

const POWER_LABELS = {
  laws: {
    none: "Не участвует",
    advisory: "Совещательный голос",
    approve: "Утверждает законы",
    initiate: "Инициирует и утверждает",
  },
  budget: {
    none: "Не участвует",
    approve_taxes: "Утверждает налоги",
    approve_budget: "Утверждает бюджет",
    control_budget: "Контролирует бюджет",
  },
  diplomacy: {
    none: "Не участвует",
    ratify_territory: "Ратифицирует территории",
    ratify_major_treaties: "Ратифицирует крупные договоры",
    ratify_all: "Ратифицирует все договоры",
  },
  war: {
    none: "Не участвует",
    approve: "Утверждает войну",
    declare: "Может объявлять войну",
  },
  government: {
    none: "Не участвует",
    confidence_vote: "Вотум доверия",
    appoint_government: "Назначает правительство",
  },
} as const;

function getParliamentPowers(parliament: CountryParliament | null): CountryParliamentPowers {
  return { ...DEFAULT_PARLIAMENT_POWERS, ...(parliament?.powers ?? {}) };
}

function lawActionLabel(powers: CountryParliamentPowers) {
  return powers.laws === "none" || powers.laws === "advisory" ? "Принять" : "На голосование";
}


function voteColor(yesPct: number, noPct: number): string {
  if (yesPct > 0.5) {
    const strength = Math.min(1, Math.max(0, (yesPct - 0.5) / 0.5));
    const lightness = 44 + Math.round((1 - strength) * 18);
    return `hsl(145 72% ${lightness}%)`;
  }
  if (noPct > 0.5) {
    const strength = Math.min(1, Math.max(0, (noPct - 0.5) / 0.5));
    const lightness = 48 + Math.round((1 - strength) * 18);
    return `hsl(355 78% ${lightness}%)`;
  }
  return "#94a3b8";
}

export function PoliticsModal({ open, token, countryId, countryName, worldBase, onClose }: Props) {
  const [data, setData] = useState<PoliticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingLawId, setSavingLawId] = useState<string | null>(null);
  const [selectedLawId, setSelectedLawId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PoliticsTab>("overview");
  const parliamentChartRef = useRef<HTMLDivElement | null>(null);
  const parliamentChartInstanceRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchPolitics(token, countryId)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(() => {
        if (!cancelled) toast.error("Не удалось загрузить политику");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryId, open, token]);

  const parliament: CountryParliament | null = worldBase?.parliamentByCountry?.[countryId] ?? data?.parliament ?? null;
  const parliamentPowers = useMemo(() => getParliamentPowers(parliament), [parliament]);
  const partyById = useMemo(() => new Map((data?.parties ?? []).map((party) => [party.id, party] as const)), [data?.parties]);
  const interestGroupById = useMemo(() => new Map((data?.interestGroups ?? []).map((group) => [group.id, group] as const)), [data?.interestGroups]);
  const lawById = useMemo(() => new Map((data?.laws ?? []).map((law) => [law.id, law] as const)), [data?.laws]);
  const lawsByGroup = useMemo(() => {
    const map = new Map<string, ContentEntry[]>();
    for (const law of data?.laws ?? []) {
      if (!law.lawGroupId) continue;
      const rows = map.get(law.lawGroupId) ?? [];
      rows.push(law);
      map.set(law.lawGroupId, rows);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
    }
    return map;
  }, [data?.laws]);

  const currentBills = useMemo(
    () =>
      [
        ...(Array.isArray(parliament?.currentBills) ? parliament.currentBills : []),
        ...(parliament?.currentBill ? [parliament.currentBill] : []),
      ].filter((bill, index, rows) => bill.status === "debating" && rows.findIndex((row) => row.lawId === bill.lawId) === index),
    [parliament?.currentBill, parliament?.currentBills],
  );
  const currentBillByLawId = useMemo(() => new Map(currentBills.map((bill) => [bill.lawId, bill] as const)), [currentBills]);
  const activePowerLawByDomain = useMemo(() => {
    const result = new Map<string, ContentEntry>();
    for (const lawId of Object.values(parliament?.activeLawByGroupId ?? {})) {
      const law = lawById.get(lawId);
      if (law?.parliamentPower) result.set(law.parliamentPower.domain, law);
    }
    return result;
  }, [lawById, parliament?.activeLawByGroupId]);
  const selectedVotingLaw = selectedLawId && currentBillByLawId.has(selectedLawId) ? lawById.get(selectedLawId) ?? null : null;
  const selectedLaw = selectedLawId ? lawById.get(selectedLawId) ?? null : null;
  const selectedLawGroup = selectedLaw?.lawGroupId ? data?.lawGroups.find((group) => group.id === selectedLaw.lawGroupId) ?? null : null;
  const buildPartyVotePreview = useCallback((law: ContentEntry) => {
    const result = new Map<string, PartyVotePreview>();
    if (!parliament) return result;
    const currentLawId = law.lawGroupId ? parliament.activeLawByGroupId[law.lawGroupId] : null;
    for (const row of parliament.partySeats) {
      const party = partyById.get(row.partyId);
      if (!party || row.seats <= 0) continue;
      const targetPreference = party.lawPreferences?.[law.id] ?? law.lawPreferences?.[party.id] ?? 0;
      const currentPreference = currentLawId ? (party.lawPreferences?.[currentLawId] ?? 0) : 0;
      const governmentBonus = parliament.governmentPartyIds.includes(row.partyId) ? 8 : 0;
      const support = targetPreference - currentPreference + governmentBonus;
      const discipline = Math.min(1, Math.max(0, party.discipline ?? 0.85));
      const committedSeats = Math.round(row.seats * discipline);
      const flexibleSeats = row.seats - committedSeats;
      let yesSeats = 0;
      let noSeats = 0;
      let abstainSeats = 0;
      if (support > 5) {
        yesSeats = committedSeats + Math.floor(flexibleSeats / 2);
        abstainSeats = row.seats - yesSeats;
      } else if (support < -5) {
        noSeats = committedSeats + Math.floor(flexibleSeats / 2);
        abstainSeats = row.seats - noSeats;
      } else {
        abstainSeats = row.seats;
      }
      const yesPct = row.seats > 0 ? yesSeats / row.seats : 0;
      const noPct = row.seats > 0 ? noSeats / row.seats : 0;
      const abstainPct = row.seats > 0 ? abstainSeats / row.seats : 0;
      result.set(row.partyId, {
        yesSeats,
        noSeats,
        abstainSeats,
        yesPct,
        noPct,
        abstainPct,
        color: voteColor(yesPct, noPct),
      });
    }
    return result;
  }, [parliament, partyById]);
  const partyVotePreviewById = useMemo(
    () => (selectedVotingLaw ? buildPartyVotePreview(selectedVotingLaw) : new Map<string, PartyVotePreview>()),
    [buildPartyVotePreview, selectedVotingLaw],
  );
  const lawVoteTotalsById = useMemo(() => {
    const totals = new Map<string, { yesSeats: number; noSeats: number; abstainSeats: number }>();
    for (const law of data?.laws ?? []) {
      const preview = buildPartyVotePreview(law);
      totals.set(law.id, {
        yesSeats: [...preview.values()].reduce((sum, row) => sum + row.yesSeats, 0),
        noSeats: [...preview.values()].reduce((sum, row) => sum + row.noSeats, 0),
        abstainSeats: [...preview.values()].reduce((sum, row) => sum + row.abstainSeats, 0),
      });
    }
    return totals;
  }, [buildPartyVotePreview, data?.laws]);
  const parliamentChartData = useMemo(
    () => {
      const seats = (parliament?.partySeats ?? [])
        .filter((row) => row.seats > 0)
        .map((row) => {
          const party = partyById.get(row.partyId);
          const votePreview = partyVotePreviewById.get(row.partyId);
          return {
            value: row.seats,
            name: party?.name ?? row.partyId,
            partyId: row.partyId,
            yesPct: votePreview?.yesPct ?? null,
            noPct: votePreview?.noPct ?? null,
            abstainPct: votePreview?.abstainPct ?? null,
            itemStyle: { color: votePreview?.color ?? party?.color ?? "#94a3b8" },
          };
        });
      const visibleSeats = seats.reduce((sum, row) => sum + row.value, 0);
      if (visibleSeats <= 0) return [];
      return [
        ...seats,
        {
          value: visibleSeats,
          name: "__hidden__",
          itemStyle: { color: "transparent", borderColor: "transparent" },
          label: { show: false },
          labelLine: { show: false },
          tooltip: { show: false },
          emphasis: { disabled: true },
          silent: true,
        },
      ];
    },
    [parliament?.partySeats, partyById, partyVotePreviewById],
  );

  useEffect(() => {
    if (!open || !parliamentChartRef.current || parliamentChartData.length === 0) return;
    const container = parliamentChartRef.current;
    let retryId: number | null = null;
    const resize = () => parliamentChartInstanceRef.current?.resize();
    const applyChart = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) {
        retryId = window.setTimeout(applyChart, 40);
        return;
      }
      const existing = parliamentChartInstanceRef.current;
      const chart =
        existing && existing.getDom() === container
          ? existing
          : (() => {
              existing?.dispose();
              return echarts.init(container);
            })();
      parliamentChartInstanceRef.current = chart;
      chart.setOption({
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          formatter: (params: { name?: string; value?: number; data?: { yesPct?: number | null; noPct?: number | null; abstainPct?: number | null } }) => {
            if (params.name === "__hidden__") return "";
            const yes = params.data?.yesPct;
            const no = params.data?.noPct;
            const abstain = params.data?.abstainPct;
            const voteLine =
              yes == null || no == null || abstain == null
                ? ""
                : `<br/>За: ${(yes * 100).toFixed(1)}% | Против: ${(no * 100).toFixed(1)}% | Возд.: ${(abstain * 100).toFixed(1)}%`;
            return `${params.name ?? ""}: ${params.value ?? 0} мест${voteLine}`;
          },
          backgroundColor: "rgba(8, 12, 18, 0.94)",
          borderColor: "rgba(255,255,255,0.12)",
          textStyle: { color: "#f8fafc" },
        },
        legend: { show: false },
        series: [
          {
            type: "pie",
            radius: ["58%", "86%"],
            center: ["50%", "76%"],
            startAngle: 180,
            clockwise: true,
            avoidLabelOverlap: true,
            padAngle: 1,
            itemStyle: {
              borderColor: "#0d1117",
              borderWidth: 2,
            },
            label: {
              color: "#e5e7eb",
              fontSize: 11,
              formatter: ({ name, value }: { name?: string; value?: number }) => `${name === "__hidden__" ? "" : (name ?? "")}\n${value ?? 0}`,
            },
            labelLine: {
              length: 10,
              length2: 8,
              lineStyle: { color: "rgba(255,255,255,0.35)" },
            },
            data: parliamentChartData,
          },
        ],
      });
      resize();
    };
    const frameA = window.requestAnimationFrame(applyChart);
    const frameB = window.requestAnimationFrame(() => window.requestAnimationFrame(resize));
    const observer = new ResizeObserver(() => {
      applyChart();
      resize();
    });
    observer.observe(container);
    window.addEventListener("resize", resize);
    const id = window.setTimeout(resize, 50);
    return () => {
      if (retryId != null) window.clearTimeout(retryId);
      window.cancelAnimationFrame(frameA);
      window.cancelAnimationFrame(frameB);
      window.clearTimeout(id);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [activeTab, open, parliamentChartData]);

  useEffect(() => {
    if (open) return;
    parliamentChartInstanceRef.current?.dispose();
    parliamentChartInstanceRef.current = null;
  }, [open]);

  const handleStartBill = async (lawId: string) => {
    setSavingLawId(lawId);
    try {
      const result = await startLawBill(token, countryId, lawId);
      setData((prev) => (prev ? { ...prev, parliament: result.parliament } : prev));
      setSelectedLawId(lawId);
      toast.success("Законопроект внесён в парламент");
    } catch (err) {
      const message = err instanceof Error ? err.message : "START_LAW_BILL_FAILED";
      if (message === "LAW_ALREADY_ACTIVE") toast.error("Этот закон уже действует");
      else if (message === "LAW_ALREADY_IN_VOTE") toast.error("Этот закон уже на голосовании");
      else toast.error("Не удалось внести законопроект");
    } finally {
      setSavingLawId(null);
    }
  };


  return open ? (
        <AppModal open={open} onClose={onClose} modalKey="politics" zIndexClassName="z-[180]" panelClassName="w-full overflow-hidden md:p-5">
              <AppModalHeader
                title={`Политика: ${countryName}`}
                description={`Выборы через ${parliament ? Math.max(0, parliament.nextElectionTurn - (worldBase?.turnId ?? 0)) : 0} ходов до следующего пересчёта.`}
                onClose={onClose}
                actions={
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-arc-accent">
                    <Landmark size={18} />
                  </div>
                }
              />
              <AppToolbar>
                <div className="flex flex-wrap items-center gap-2">
                {POLITICS_TABS.map((tab) => (
                  <AppButton
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    variant={activeTab === tab.id ? "primary" : "ghost"}
                    size="md"
                    className={activeTab === tab.id ? "bg-arc-accent/15 text-arc-accent" : ""}
                  >
                    {tab.label}
                  </AppButton>
                ))}
                </div>
              </AppToolbar>

              {loading && <AppEmptyState className="py-4 text-white/60">Загрузка...</AppEmptyState>}

              {!loading && parliament && (
                <div className="arc-scrollbar min-h-0 flex-1 overflow-auto pr-1">
                  {activeTab === "overview" && (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                      <AppSection className="p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-white">Парламент</div>
                            <div className="mt-1 text-xs text-white/45">
                              {selectedVotingLaw ? `Прогноз голосования: ${selectedVotingLaw.name}` : "Распределение мест по партиям"}
                            </div>
                          </div>
                          <div className="text-xs text-white/45">{parliament.seatsTotal} мест</div>
                        </div>
                        <div className="relative h-[360px] overflow-hidden">
                          <div ref={parliamentChartRef} className="h-full w-full" />
                          <div className="pointer-events-none absolute inset-x-0 bottom-10 text-center">
                            <div className="text-3xl font-semibold tabular-nums text-white">{parliament.seatsTotal}</div>
                            <div className="text-xs uppercase tracking-wide text-white/45">мест</div>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          {selectedVotingLaw ? (
                            <>
                              <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-300">Зелёный: большинство партии за</span>
                              <span className="rounded-md bg-rose-500/10 px-2 py-1 text-rose-300">Красный: большинство против</span>
                              <span className="rounded-md bg-white/5 px-2 py-1 text-white/55">Серый: в основном воздержание</span>
                            </>
                          ) : (
                            <span className="rounded-md bg-white/5 px-2 py-1 text-white/55">Обычный режим: цвета партий</span>
                          )}
                        </div>
                      </AppSection>

                      <AppSection className="p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                          <Vote size={16} className="text-arc-accent" />
                          Законопроекты на голосовании
                        </div>
                        {currentBills.length === 0 ? (
                          <AppEmptyState>Сейчас парламент не рассматривает законы.</AppEmptyState>
                        ) : (
                          <div className="space-y-2">
                            {currentBills.map((bill) => {
                              const law = lawById.get(bill.lawId);
                              if (!law) return null;
                              return (
                                <button
                                  key={bill.lawId}
                                  type="button"
                                  onClick={() => setSelectedLawId(bill.lawId)}
                                  className={`w-full rounded-lg border p-3 text-left transition ${
                                    selectedVotingLaw?.id === bill.lawId
                                      ? "border-arc-accent/30 bg-arc-accent/10"
                                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="font-medium text-white">{law.name}</div>
                                    <div className="text-xs text-white/45">{bill.status}</div>
                                  </div>
                                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full rounded-full bg-arc-accent" style={{ width: `${Math.max(0, Math.min(100, bill.progress))}%` }} />
                                  </div>
                                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                                    <div className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-300">За: {bill.yesSeats}</div>
                                    <div className="rounded-md bg-rose-500/10 px-2 py-1 text-rose-300">Против: {bill.noSeats}</div>
                                    <div className="rounded-md bg-white/5 px-2 py-1 text-white/55">Возд.: {bill.abstainSeats}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </AppSection>
                    </div>
                  )}

                  {activeTab === "powers" && (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                      <AppSection className="p-4">
                        <div className="mb-3 text-sm font-semibold text-white">Полномочия парламента</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {[
                            {
                              title: "Законы",
                              value: POWER_LABELS.laws[parliamentPowers.laws],
                              description:
                                parliamentPowers.laws === "none" || parliamentPowers.laws === "advisory"
                                  ? "Законы можно принимать напрямую. Парламент не блокирует решение."
                                  : "Новые законы проходят через парламентское голосование.",
                            },
                            {
                              title: "Бюджет",
                              value: POWER_LABELS.budget[parliamentPowers.budget],
                              description:
                                parliamentPowers.budget === "none"
                                  ? "Бюджетные решения остаются за правителем."
                                  : "Часть бюджетных решений должна получать политическое одобрение.",
                            },
                            {
                              title: "Дипломатия",
                              value: POWER_LABELS.diplomacy[parliamentPowers.diplomacy],
                              description:
                                parliamentPowers.diplomacy === "none"
                                  ? "Договоры подписываются без ратификации."
                                  : "Важные договоры могут требовать ратификации парламента.",
                            },
                            {
                              title: "Война",
                              value: POWER_LABELS.war[parliamentPowers.war],
                              description:
                                parliamentPowers.war === "none"
                                  ? "Военные решения принимает правитель."
                                  : "Военные решения зависят от парламентского мандата.",
                            },
                            {
                              title: "Правительство",
                              value: POWER_LABELS.government[parliamentPowers.government],
                              description:
                                parliamentPowers.government === "none"
                                  ? "Состав правительства не зависит от парламента."
                                  : "Парламент влияет на устойчивость или назначение правительства.",
                            },
                          ].map((item) => (
                            <AppCard key={item.title} className="bg-white/[0.03] p-4">
                              <div className="text-xs uppercase tracking-wide text-white/45">{item.title}</div>
                              <div className="mt-1 text-sm font-semibold text-white">{item.value}</div>
                              <div className="mt-3 text-xs leading-relaxed text-white/55">{item.description}</div>
                            </AppCard>
                          ))}
                        </div>
                      </AppSection>

                      <AppSection className="p-4">
                        <div className="mb-3 text-sm font-semibold text-white">Текущие ограничения</div>
                        <div className="space-y-2 text-sm">
                          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white/70">
                            Законы: {parliamentPowers.laws === "none" || parliamentPowers.laws === "advisory" ? "можно принимать напрямую" : "нужно голосование"}
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white/70">
                            Территориальные договоры: {parliamentPowers.diplomacy === "none" ? "без ратификации" : "требуют политической ратификации"}
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white/70">
                            Крупные выплаты:{" "}
                            {parliamentPowers.moneyTransferRatificationThreshold
                              ? `от ${parliamentPowers.moneyTransferRatificationThreshold.toLocaleString("ru-RU")} требуют контроля`
                              : "без отдельного порога"}
                          </div>
                        </div>
                        <div className="mt-5">
                          <div className="mb-3 text-sm font-semibold text-white">Активные законы-источники</div>
                          <div className="space-y-2">
                            {["laws", "budget", "diplomacy", "war", "government"].map((domain) => {
                              const law = activePowerLawByDomain.get(domain);
                              return (
                                <div key={domain} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
                                  {law?.name ?? "Используется базовое полномочие"}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </AppSection>
                    </div>
                  )}

                  {activeTab === "laws" && (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                      <AppSection className="p-4">
                        <div className="mb-3 text-sm font-semibold text-white">Законы</div>
                        <div className="space-y-3">
                          {(data?.lawGroups ?? []).length === 0 ? (
                            <AppEmptyState>Создайте группы законов и законы в панели контента.</AppEmptyState>
                          ) : (
                            (data?.lawGroups ?? []).map((group) => {
                              const activeLawId = parliament.activeLawByGroupId[group.id];
                              const laws = lawsByGroup.get(group.id) ?? [];
                              return (
                                <AppCard key={group.id} className="bg-white/[0.03]">
                                  <div className="mb-2 text-sm font-medium text-white">{group.name}</div>
                                  <div className="space-y-2">
                                    {laws.map((law) => {
                                      const isActive = activeLawId === law.id;
                                      const isVoting = currentBillByLawId.has(law.id);
                                      const totals = lawVoteTotalsById.get(law.id);
                                      return (
                                        <div
                                          key={law.id}
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => setSelectedLawId(law.id)}
                                          onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") setSelectedLawId(law.id);
                                          }}
                                          className={`rounded-md px-2 py-2 text-left transition ${
                                            selectedLawId === law.id ? "bg-arc-accent/10 ring-1 ring-arc-accent/30" : "bg-black/20 hover:bg-white/[0.06]"
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="truncate text-sm text-white/85">{law.name}</div>
                                              <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                                                {isActive && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">Действует</span>}
                                                {isVoting && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-300">На голосовании</span>}
                                                {!isActive && !isVoting && <span className="rounded bg-white/5 px-1.5 py-0.5 text-white/45">Не принят</span>}
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                void handleStartBill(law.id);
                                              }}
                                              disabled={isActive || isVoting || savingLawId === law.id}
                                              className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                                            >
                                              {lawActionLabel(parliamentPowers)}
                                            </button>
                                          </div>
                                          {totals && (
                                            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                                              <span className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-300">За {totals.yesSeats}</span>
                                              <span className="rounded bg-rose-500/10 px-2 py-1 text-rose-300">Против {totals.noSeats}</span>
                                              <span className="rounded bg-white/5 px-2 py-1 text-white/55">Возд. {totals.abstainSeats}</span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </AppCard>
                              );
                            })
                          )}
                        </div>
                      </AppSection>

                      <AppSection className="p-4">
                        <div className="mb-3 text-sm font-semibold text-white">Выбранный закон</div>
                        {!selectedLaw ? (
                          <AppEmptyState>Выберите закон в списке.</AppEmptyState>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <div className="text-lg font-semibold text-white">{selectedLaw.name}</div>
                              <div className="mt-1 text-xs text-white/45">{selectedLawGroup?.name ?? "Без группы"}</div>
                              {selectedLaw.description && <p className="mt-3 text-sm leading-relaxed text-white/65">{selectedLaw.description}</p>}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              {(() => {
                                const totals = lawVoteTotalsById.get(selectedLaw.id) ?? { yesSeats: 0, noSeats: 0, abstainSeats: 0 };
                                return (
                                  <>
                                    <span className="rounded-md bg-emerald-500/10 px-2 py-2 text-emerald-300">За {totals.yesSeats}</span>
                                    <span className="rounded-md bg-rose-500/10 px-2 py-2 text-rose-300">Против {totals.noSeats}</span>
                                    <span className="rounded-md bg-white/5 px-2 py-2 text-white/55">Возд. {totals.abstainSeats}</span>
                                  </>
                                );
                              })()}
                            </div>
                            <div>
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Группы интересов</div>
                              <div className="space-y-2">
                                {(parliament.interestGroups ?? []).map((group) => {
                                  const entry = interestGroupById.get(group.groupId);
                                  const preference = entry?.lawPreferences?.[selectedLaw.id] ?? 0;
                                  if (preference === 0) return null;
                                  return (
                                    <div key={group.groupId} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-xs">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry?.color ?? "#94a3b8" }} />
                                        <span className="truncate text-white/80">{entry?.name ?? group.groupId}</span>
                                      </div>
                                      <span className={preference > 0 ? "text-emerald-300" : "text-rose-300"}>
                                        {preference > 0 ? "Поддерживает" : "Против"} {Math.abs(preference)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleStartBill(selectedLaw.id)}
                              disabled={parliament.activeLawByGroupId[selectedLaw.lawGroupId ?? ""] === selectedLaw.id || currentBillByLawId.has(selectedLaw.id) || savingLawId === selectedLaw.id}
                              className="w-full rounded-lg bg-arc-accent px-3 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {currentBillByLawId.has(selectedLaw.id) ? "Уже на голосовании" : lawActionLabel(parliamentPowers)}
                            </button>
                          </div>
                        )}
                      </AppSection>
                    </div>
                  )}

                  {activeTab === "parties" && (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,520px)_1fr]">
                      <AppSection className="p-4">
                        <div className="mb-3 text-sm font-semibold text-white">Парламент</div>
                        <div className="relative h-[360px] overflow-hidden">
                          <div ref={parliamentChartRef} className="h-full w-full" />
                        </div>
                      </AppSection>
                      <section className="grid gap-3 md:grid-cols-2">
                        {parliament.partySeats.map((row) => {
                          const party = partyById.get(row.partyId);
                          const preview = partyVotePreviewById.get(row.partyId);
                          const inGovernment = parliament.governmentPartyIds.includes(row.partyId);
                          return (
                            <AppCard key={row.partyId} className="p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: party?.color ?? "#94a3b8" }} />
                                  <span className="truncate text-sm font-semibold text-white">{party?.name ?? row.partyId}</span>
                                </div>
                                <span className="rounded bg-white/5 px-2 py-1 text-xs text-white/60">{inGovernment ? "Правительство" : "Оппозиция"}</span>
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                                <span className="rounded bg-white/5 px-2 py-2 text-white/70">{row.seats} мест</span>
                                <span className="rounded bg-white/5 px-2 py-2 text-white/70">{pct(row.voteShare)}</span>
                                <span className="rounded bg-white/5 px-2 py-2 text-white/70">Дисц. {((party?.discipline ?? 0.85) * 100).toFixed(0)}%</span>
                              </div>
                              {preview && (
                                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                                  <span className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-300">За {(preview.yesPct * 100).toFixed(0)}%</span>
                                  <span className="rounded bg-rose-500/10 px-2 py-1 text-rose-300">Против {(preview.noPct * 100).toFixed(0)}%</span>
                                  <span className="rounded bg-white/5 px-2 py-1 text-white/55">Возд. {(preview.abstainPct * 100).toFixed(0)}%</span>
                                </div>
                              )}
                            </AppCard>
                          );
                        })}
                      </section>
                    </div>
                  )}

                  {activeTab === "interestGroups" && (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {(parliament.interestGroups ?? []).length === 0 ? (
                          <AppEmptyState>
                            Создайте группы интересов в панели контента и настройте веса профессий.
                          </AppEmptyState>
                        ) : (
                          (parliament.interestGroups ?? []).map((group) => {
                            const entry = interestGroupById.get(group.groupId);
                            const party = group.supportedPartyId ? partyById.get(group.supportedPartyId) : null;
                            const preference = selectedLaw ? (entry?.lawPreferences?.[selectedLaw.id] ?? 0) : 0;
                            return (
                              <AppCard key={group.groupId} className="p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: entry?.color ?? "#94a3b8" }} />
                                    <span className="truncate text-sm font-semibold text-white">{entry?.name ?? group.groupId}</span>
                                  </div>
                                  <span className="text-sm tabular-nums text-white">{pct(group.clout)}</span>
                                </div>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, group.clout * 100)}%`, backgroundColor: entry?.color ?? "#94a3b8" }} />
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                                  <span className="rounded bg-white/5 px-2 py-1 text-white/60">Сила {Math.round(group.rawPower)}</span>
                                  <span className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-300">Лоял. {group.loyalists}</span>
                                  <span className="rounded bg-rose-500/10 px-2 py-1 text-rose-300">Рад. {group.radicals}</span>
                                </div>
                                <div className="mt-3 text-xs text-white/50">Партия: {party?.name ?? "нет"}</div>
                                {selectedLaw && (
                                  <div className={`mt-2 text-xs ${preference > 0 ? "text-emerald-300" : preference < 0 ? "text-rose-300" : "text-white/45"}`}>
                                    К выбранному закону: {preference > 0 ? `за ${preference}` : preference < 0 ? `против ${Math.abs(preference)}` : "нейтральна"}
                                  </div>
                                )}
                              </AppCard>
                            );
                          })
                        )}
                      </section>
                      <AppSection className="p-4">
                        <div className="mb-3 text-sm font-semibold text-white">О выбранном законе</div>
                        {selectedLaw ? (
                          <div>
                            <div className="font-semibold text-white">{selectedLaw.name}</div>
                            <p className="mt-2 text-sm text-white/55">{selectedLaw.description || "Описание не задано."}</p>
                          </div>
                        ) : (
                          <AppEmptyState>Выберите закон, чтобы увидеть отношение групп.</AppEmptyState>
                        )}
                      </AppSection>
                    </div>
                  )}
                </div>
              )}
        </AppModal>
  ) : null;
}
