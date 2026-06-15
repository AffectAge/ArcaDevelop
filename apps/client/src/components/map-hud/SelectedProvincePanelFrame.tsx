import type { LucideIcon } from "lucide-react";
import { Crosshair, Landmark, Lock, LockOpen, Minus, X } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip } from "../Tooltip";
import { useUiText } from "../../i18n/useUiText";

type Metric = {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
};

type Tab<T extends string> = {
  id: T;
  icon: LucideIcon;
  label: string;
};

type Props<T extends string> = {
  collapsed: boolean;
  pinned: boolean;
  provinceName: string;
  collapsedSummary: string;
  provinceMeta: ReactNode;
  ownerLabel: string;
  ownerColor?: string | null;
  ownerFlagUrl?: string | null;
  metrics: Metric[];
  problems: ReactNode;
  tabs: Array<Tab<T>>;
  activeTab: T;
  children: ReactNode;
  onExpand: () => void;
  onCollapse: () => void;
  onClose: () => void;
  onTogglePinned: () => void;
  onTabChange: (tabId: T) => void;
};

export function SelectedProvincePanelFrame<T extends string>({
  collapsed,
  pinned,
  provinceName,
  collapsedSummary,
  provinceMeta,
  ownerLabel,
  ownerColor,
  ownerFlagUrl,
  metrics,
  problems,
  tabs,
  activeTab,
  children,
  onExpand,
  onCollapse,
  onClose,
  onTogglePinned,
  onTabChange,
}: Props<T>) {
  const { t } = useUiText();
  const provinceTint = ownerColor ?? "#2e1d12";

  if (collapsed) {
    return (
      <div className="arc-province-panel arc-hud-panel overflow-hidden rounded-xl text-sm">
        <div
          className="arc-hud-content p-3"
          style={{ background: `linear-gradient(90deg, ${provinceTint}44, var(--arc-overlay-55))` }}
        >
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={onExpand} className="arc-hud-button flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left">
              <Crosshair size={14} className="shrink-0 text-[var(--arc-color-gold)]" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[var(--arc-color-text)]">{provinceName}</span>
                <span className="block truncate text-[10px] text-[var(--arc-color-text-soft)]">{collapsedSummary}</span>
              </span>
            </button>
            <PinButton pinned={pinned} onClick={onTogglePinned} />
            <CloseButton onClick={onClose} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="arc-province-panel arc-hud-panel overflow-hidden rounded-xl text-sm">
      <div
        className="arc-province-header arc-hud-content border-b border-[var(--arc-color-gold-soft)] px-4 py-3"
        style={{ background: `linear-gradient(90deg, ${provinceTint}55, var(--arc-overlay-55) 42%, var(--arc-overlay-50))` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Crosshair size={15} className="shrink-0 text-[var(--arc-color-gold)]" />
              <div className="truncate font-display text-xl font-semibold text-[var(--arc-color-text)]">{provinceName}</div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--arc-color-text-soft)]">{provinceMeta}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="arc-hud-button flex items-center gap-2 rounded-lg px-2.5 py-2">
              {ownerFlagUrl ? <img src={ownerFlagUrl} alt="" className="h-5 w-8 rounded-sm object-cover" /> : <Landmark size={16} />}
              <div className="max-w-[9rem] truncate text-xs font-semibold">{ownerLabel}</div>
            </div>
            <PinButton pinned={pinned} onClick={onTogglePinned} />
            <Tooltip content={t("provincePanel.collapse")}>
              <button type="button" onClick={onCollapse} className="arc-hud-button inline-flex h-9 w-9 items-center justify-center rounded-lg">
                <Minus size={14} />
              </button>
            </Tooltip>
            <CloseButton onClick={onClose} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="arc-hud-chip rounded-lg px-2.5 py-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--arc-color-text-muted)]">
                  <Icon size={12} />
                  {metric.label}
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-[var(--arc-color-text-paper)]">{metric.value}</div>
                <div className="text-[10px] text-[var(--arc-color-text-muted)]">{metric.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="arc-hud-content border-b border-[var(--arc-color-brown)] px-4 py-2">{problems}</div>

      <div className="arc-hud-content grid grid-cols-[68px_minmax(0,1fr)]">
        <div className="border-r border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-toolbar)] p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <Tooltip key={tab.id} content={tab.label} placement="left">
                <button
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`mb-2 inline-flex h-11 w-11 items-center justify-center rounded-lg border transition ${
                    active
                      ? "border-[var(--arc-color-primary-border)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] text-[var(--arc-color-text)]"
                      : "border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-muted)] hover:border-[var(--arc-color-gold)]"
                  }`}
                >
                  <Icon size={17} />
                </button>
              </Tooltip>
            );
          })}
        </div>

        <div className="arc-scrollbar max-h-[min(72vh,680px)] min-h-[28rem] overflow-y-auto bg-[var(--arc-color-paper)] p-3">
          {children}
        </div>
      </div>
    </div>
  );
}

function PinButton({ pinned, onClick }: { pinned: boolean; onClick: () => void }) {
  const { t } = useUiText();

  return (
    <Tooltip content={pinned ? t("provincePanel.unpin") : t("provincePanel.pin")}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
          pinned
            ? "border-[var(--arc-color-primary-border)] bg-[var(--arc-color-primary-top)] text-[var(--arc-color-text)]"
            : "arc-hud-button"
        }`}
      >
        {pinned ? <Lock size={14} /> : <LockOpen size={14} />}
      </button>
    </Tooltip>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  const { t } = useUiText();

  return (
    <Tooltip content={t("common.close")}>
      <button type="button" onClick={onClick} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--arc-color-danger-border)] bg-gradient-to-b from-[var(--arc-color-danger-top)] to-[var(--arc-color-danger-bottom)] text-[var(--arc-color-danger-text)] transition hover:brightness-110">
        <X size={14} />
      </button>
    </Tooltip>
  );
}
