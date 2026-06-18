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
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";

const resourceCards = [
  { key: "culture", labelKey: "shell.resource.culture", icon: BookOpen },
  { key: "science", labelKey: "shell.resource.science", icon: FlaskConical },
  { key: "religion", labelKey: "shell.resource.religion", icon: Landmark },
  { key: "colonization", labelKey: "shell.resource.colonization", icon: Flag },
  { key: "construction", labelKey: "shell.resource.construction", icon: Hammer },
  { key: "ducats", labelKey: "shell.resource.ducats", icon: Coins },
  { key: "gold", labelKey: "shell.resource.gold", icon: CircleDollarSign },
] as const satisfies readonly { key: keyof TurnStatusItem["resources"]; labelKey: UiTextKey; icon: LucideIcon }[];

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

function statusText(item: TurnStatusItem, t: (key: UiTextKey, params?: Record<string, string | number>) => string): string {
  if (item.status === "ready") {
    return t("shell.readiness.status.ready");
  }

  if (item.status === "waiting") {
    return t("shell.readiness.status.waiting");
  }

  if (item.status === "ignored") {
    return t("shell.readiness.status.ignored");
  }

  if (item.blockedReason === "PERMANENT") {
    return t("turnStatus.blockedPermanent");
  }

  if (item.blockedReason === "TURN" && item.blockedUntilTurn != null) {
    return t("turnStatus.blockedUntilTurn", { turn: item.blockedUntilTurn });
  }

  if (item.blockedReason === "TIME" && item.blockedUntilAt) {
    return t("turnStatus.blockedUntilTime", { time: new Date(item.blockedUntilAt).toLocaleString() });
  }

  return t("shell.readiness.status.blocked");
}

function statusClass(item: TurnStatusItem): string {
  if (item.status === "ready") {
    return "arc-turn-status-pill--ready";
  }

  if (item.status === "waiting") {
    return "arc-turn-status-pill--waiting";
  }

  if (item.status === "ignored") {
    return "arc-turn-status-pill--ignored";
  }

  return "arc-turn-status-pill--blocked";
}

function onlineBadgeClass(isOnline: boolean): string {
  return isOnline ? "arc-turn-status-pill--ready" : "arc-turn-status-pill--ignored";
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
  const { t } = useUiText();
  return (
    <div className="arc-turn-status-resources">
      {resourceCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="arc-turn-status-resource"
            title={t(card.labelKey)}
          >
            <Icon size={13} />
            <span>{t(card.labelKey)}</span>
            <strong>{formatCompact(item.resources[card.key] ?? 0)}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function TurnStatusModal({ open, onClose }: Props) {
  const { t } = useUiText();
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
      panelClassName="arc-turn-status-panel h-auto w-full max-w-5xl"
      paddingClassName="p-3 pt-24 md:p-4 md:pt-24 flex items-start justify-center"
    >
      <AppModalHeader
        title={t("shell.readiness.title")}
        description={`${t("shell.turn", { turn: payload?.turnId ?? "-" })} · ${t("shell.readiness.progress", { ready: payload?.readyCount ?? 0, required: payload?.requiredCount ?? 0 })}`}
        onClose={onClose}
      />

      {loading && !payload ? (
        <div className="arc-turn-status-loading">
          <LoaderCircle size={16} className="animate-spin" />
          {t("turnStatus.loading")}
        </div>
      ) : (
        <div className="arc-scrollbar arc-turn-status-list">
          {sorted.map((item) => (
            <div key={item.id} className={`arc-turn-status-row arc-turn-status-row--${item.status}`}>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex min-w-0 items-center gap-2">
                  {item.flagUrl ? (
                    <img src={item.flagUrl} alt="" className="h-5 w-8 shrink-0 object-cover" />
                  ) : (
                    <span className="arc-strategy-country-dot" style={item.color ? { backgroundColor: item.color } : undefined} />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{item.name}</div>
                    <div className="mt-0.5 truncate text-[11px] text-[var(--arc-color-atlas-muted)]">
                      {t("turnStatus.lastLogin", { value: item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : t("turnStatus.noLoginData") })}
                    </div>
                  </div>
                </div>
                <ResourceStrip item={item} />
              </div>
              <div className="arc-turn-status-pills">
                <div className={`arc-turn-status-pill ${onlineBadgeClass(item.online)}`}>
                  {t(item.online ? "shell.readiness.online" : "shell.readiness.offline")}
                </div>
                <div className={`arc-turn-status-pill ${statusClass(item)}`}>{statusText(item, t)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppModal>
  );
}
