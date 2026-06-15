import * as echarts from "echarts";
import type { EChartsType } from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Landmark, Trophy } from "lucide-react";
import type { InAppUiNotification } from "./InAppNotificationTray";
import { fetchContentEntries, type ContentEntry } from "../lib/api";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppEmptyState } from "./ui/AppSurface";

type ElectionResultsAction = Extract<InAppUiNotification["action"], { type: "election-results" }>;

type Props = {
  open: boolean;
  action: ElectionResultsAction | null;
  onClose: () => void;
};

function stablePartyColor(id: string): string {
  const palette = ["#38bdf8", "#a78bfa", "#facc15", "#34d399", "#fb7185", "#f97316", "#60a5fa", "#e879f9", "#94a3b8", "#c084fc"];
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return palette[hash % palette.length];
}

function isHexColor(value: string | null | undefined): value is string {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? "");
}

function formatPercent(value: number): string {
  const pct = Number.isFinite(value) ? Math.max(0, value) * 100 : 0;
  return `${pct.toFixed(pct >= 10 ? 1 : 2).replace(/\.0$/, "")}%`;
}

export function ElectionResultsModal({ open, action, onClose }: Props) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<EChartsType | null>(null);
  const [parties, setParties] = useState<ContentEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchContentEntries("parties")
      .then((items) => {
        if (!cancelled) setParties(items);
      })
      .catch(() => {
        if (!cancelled) setParties([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const partyById = useMemo(() => new Map(parties.map((party) => [party.id, party] as const)), [parties]);
  const rows = useMemo(() => {
    if (!action) return [];
    return [...action.partySeats]
      .sort((a, b) => b.seats - a.seats || a.partyId.localeCompare(b.partyId))
      .map((row) => {
        const party = partyById.get(row.partyId);
        const color = isHexColor(party?.color) ? party.color : stablePartyColor(row.partyId);
        return {
          ...row,
          name: party?.name ?? row.partyId,
          color,
          isGovernment: action.governmentPartyIds.includes(row.partyId),
          seatPct: action.seatsTotal > 0 ? row.seats / action.seatsTotal : 0,
        };
      });
  }, [action, partyById]);
  const chartData = useMemo(() => {
    const seats = rows
      .filter((row) => row.seats > 0)
      .map((row) => ({
        value: row.seats,
        name: row.name,
        partyId: row.partyId,
        voteShare: row.voteShare,
        itemStyle: { color: row.color },
      }));
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
  }, [rows]);

  useEffect(() => {
    if (!open || !chartContainerRef.current || chartData.length === 0) return;
    const container = chartContainerRef.current;
    let retryId: number | null = null;
    const resize = () => chartInstanceRef.current?.resize();
    const applyChart = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) {
        retryId = window.setTimeout(applyChart, 40);
        return;
      }
      const existing = chartInstanceRef.current;
      const chart =
        existing && existing.getDom() === container
          ? existing
          : (() => {
              existing?.dispose();
              return echarts.init(container);
            })();
      chartInstanceRef.current = chart;
      chart.setOption({
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          formatter: (params: { name?: string; value?: number; data?: { voteShare?: number } }) => {
            if (params.name === "__hidden__") return "";
            const voteShare = typeof params.data?.voteShare === "number" ? `<br/>Голоса: ${formatPercent(params.data.voteShare)}` : "";
            return `${params.name ?? ""}: ${params.value ?? 0} мест${voteShare}`;
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
            data: chartData,
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
  }, [chartData, open]);

  useEffect(() => {
    if (open) return;
    chartInstanceRef.current?.dispose();
    chartInstanceRef.current = null;
  }, [open]);

  return (
    <AppModal
      modalKey="election-results"
      open={open}
      onClose={onClose}
      zIndexClassName="z-[170]"
      panelClassName="w-full max-w-3xl overflow-hidden"
      paddingClassName="p-4 pt-24 flex items-start justify-center"
    >
      <AppModalHeader
        title="Результаты выборов"
        description={action ? `Ход #${action.turnId} · парламент на ${action.seatsTotal} мест` : "Итоги парламентского голосования"}
        onClose={onClose}
        actions={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-arc-accent">
            <Landmark size={18} />
          </div>
        }
      />

      {!action ? (
        <AppEmptyState>Нет данных о результатах выборов</AppEmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="panel-border rounded-xl bg-black/25 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Распределение мест</div>
                <div className="mt-1 text-xs text-white/45">Полукруг парламента по партиям</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
                <div className="text-lg font-semibold tabular-nums text-white">{action.seatsTotal}</div>
                <div className="text-[10px] uppercase tracking-wide text-white/45">мест</div>
              </div>
            </div>
            <div className="relative mx-auto h-[340px] max-w-[560px] overflow-hidden">
              <div ref={chartContainerRef} className="h-full w-full" />
              <div className="pointer-events-none absolute inset-x-0 bottom-10 text-center">
                <div className="text-3xl font-semibold tabular-nums text-white">{action.seatsTotal}</div>
                <div className="text-xs uppercase tracking-wide text-white/45">мест</div>
              </div>
            </div>
          </section>

          <section className="panel-border rounded-xl bg-black/25 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Trophy size={16} className="text-arc-accent" />
              Партии
            </div>
            <div className="arc-scrollbar max-h-[420px] space-y-2 overflow-auto pr-1">
              {rows.length === 0 && <AppEmptyState>Партии не получили мест</AppEmptyState>}
              {rows.map((row) => (
                <div key={row.partyId} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: row.color }} />
                        <span className="truncate text-sm font-semibold text-white">{row.name}</span>
                      </div>
                      {row.isGovernment && (
                        <div className="mt-1 inline-flex rounded border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                          Правительство
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums text-white">{row.seats}</div>
                      <div className="text-[10px] text-white/45">мест</div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.seatPct * 100)}%`, backgroundColor: row.color }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
                    <span>Места: {formatPercent(row.seatPct)}</span>
                    <span>Голоса: {formatPercent(row.voteShare)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppModal>
  );
}
