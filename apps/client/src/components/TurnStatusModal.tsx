import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CircleDollarSign,
  Coins,
  Flag,
  FlaskConical,
  Hammer,
  Landmark,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import { fetchTurnStatus, type TurnStatusItem } from "../lib/api";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard } from "./ui/AppSurface";

const resourceCards = [
  { key: "culture", label: "Культура", icon: BookOpen },
  { key: "science", label: "Наука", icon: FlaskConical },
  { key: "religion", label: "Религия", icon: Landmark },
  { key: "colonization", label: "Колонизация", icon: Flag },
  { key: "construction", label: "Строительство", icon: Hammer },
  { key: "ducats", label: "Дукаты", icon: Coins },
  { key: "gold", label: "Золото", icon: CircleDollarSign },
] as const satisfies readonly { key: keyof TurnStatusItem["resources"]; label: string; icon: LucideIcon }[];

type Props = {
  open: boolean;
  onClose: () => void;
};

type TurnStatusPayload = {
  turnId: number;
  readyCount: number;
  requiredCount: number;
  countries: TurnStatusItem[];
};

function statusText(item: TurnStatusItem): string {
  if (item.status === "ready") {
    return "Готова";
  }

  if (item.status === "waiting") {
    return "Ожидает";
  }

  if (item.blockedReason === "PERMANENT") {
    return "Заблокирована бессрочно";
  }

  if (item.blockedReason === "TURN" && item.blockedUntilTurn != null) {
    return `Заблокирована до хода #${item.blockedUntilTurn}`;
  }

  if (item.blockedReason === "TIME" && item.blockedUntilAt) {
    return `Заблокирована до ${new Date(item.blockedUntilAt).toLocaleString()}`;
  }

  return "Заблокирована";
}

function statusClass(item: TurnStatusItem): string {
  if (item.status === "ready") {
    return "bg-emerald-500/15 text-emerald-500 border-emerald-400/30";
  }

  if (item.status === "waiting") {
    return "bg-slate-500/15 text-slate-300 border-slate-400/30";
  }

  return "bg-rose-500/15 text-rose-300 border-rose-400/30";
}

function onlineBadgeClass(isOnline: boolean): string {
  return isOnline
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
    : "border-slate-400/20 bg-slate-500/10 text-slate-300";
}

function formatCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Number.isFinite(value) ? value : 0);
  const units = [
    { n: 1_000_000_000_000, s: "T" },
    { n: 1_000_000_000, s: "B" },
    { n: 1_000_000, s: "M" },
    { n: 1_000, s: "K" },
  ] as const;

  for (const unit of units) {
    if (abs >= unit.n) {
      const scaled = abs / unit.n;
      const text =
        scaled >= 100
          ? Math.floor(scaled).toString()
          : scaled >= 10
            ? scaled.toFixed(1).replace(/\.0$/, "")
            : scaled.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
      return `${sign}${text}${unit.s}`;
    }
  }

  return `${sign}${Math.floor(abs)}`;
}

function ResourceStrip({ item }: { item: TurnStatusItem }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-7">
      {resourceCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="arc-hud-chip flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]"
            title={card.label}
          >
            <Icon size={13} className="shrink-0 text-[var(--arc-color-gold)]" />
            <span className="min-w-0 truncate text-[var(--arc-color-text-soft)]">{card.label}</span>
            <strong className="ml-auto shrink-0 tabular-nums text-[var(--arc-color-text)]">
              {formatCompact(item.resources[card.key] ?? 0)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

export function TurnStatusModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<TurnStatusPayload | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchTurnStatus();
        if (!cancelled) {
          setPayload(data);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    const timer = setInterval(load, 1500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [open]);

  const sorted = useMemo(() => {
    if (!payload) {
      return [];
    }

    const rank = (status: TurnStatusItem["status"]): number => (status === "waiting" ? 0 : status === "ready" ? 1 : status === "ignored" ? 2 : 3);
    return [...payload.countries].sort((a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name));
  }, [payload]);

  return (
    <AppModal
      modalKey="turn-status"
      open={open}
      onClose={onClose}
      zIndexClassName="z-[130]"
      panelClassName="h-auto w-full max-w-4xl"
      paddingClassName="p-4 pt-24 flex items-start justify-center"
    >
          <AppModalHeader
            title="Готовность стран к ходу"
            description={`Ход #${payload?.turnId ?? "-"} • Готово ${payload?.readyCount ?? 0}/${payload?.requiredCount ?? 0}`}
            onClose={onClose}
          />

          {loading && !payload ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-300">
              <LoaderCircle size={16} className="animate-spin" />
              Загрузка статусов...
            </div>
          ) : (
            <div className="arc-scrollbar max-h-[55vh] space-y-2 overflow-auto pr-1">
              {sorted.map((item) => (
                <AppCard key={item.id} className="bg-black/25 px-3 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex min-w-0 items-center gap-2">
                        {item.flagUrl ? (
                          <img src={item.flagUrl} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover" />
                        ) : (
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/10"
                            style={{ backgroundColor: item.color ?? "#94a3b8" }}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-sm text-slate-100">{item.name}</div>
                          <div className="mt-0.5 truncate text-[11px] text-slate-400">
                            Последний вход: {item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : "нет данных"}
                          </div>
                        </div>
                      </div>
                      <ResourceStrip item={item} />
                    </div>
                    <div className="flex shrink-0 items-center gap-2 lg:flex-col lg:items-stretch">
                      <div className={`w-24 rounded-md border px-2 py-1 text-center text-xs ${onlineBadgeClass(item.online)}`}>
                        {item.online ? "Онлайн" : "Оффлайн"}
                      </div>
                      <div className={`w-24 rounded-md border px-2 py-1 text-center text-xs ${statusClass(item)}`}>{statusText(item)}</div>
                    </div>
                  </div>
                </AppCard>
              ))}
            </div>
          )}
    </AppModal>
  );
}
