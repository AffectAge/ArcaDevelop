import { Crown, Flag, Sparkles } from "lucide-react";
import { useUiText } from "../i18n/useUiText";

type ColonizerRow = {
  countryId: string;
  countryName: string;
  countryColor: string;
  percent: number;
  hasQueuedOrder: boolean;
};

type Props = {
  open: boolean;
  x: number;
  y: number;
  provinceName: string;
  areaKm2: number | null;
  ownerName: string;
  colonizers: ColonizerRow[];
  modeLabel?: string;
  modeRows?: Array<{ label: string; value: string; tone?: "default" | "good" | "warn" | "bad" }>;
};

function formatKm2(areaKm2: number | null, locale: string): string | null {
  if (areaKm2 == null || !Number.isFinite(areaKm2) || areaKm2 <= 0) return null;
  return `${new Intl.NumberFormat(locale).format(Math.round(areaKm2))} km²`;
}

const toneClass: Record<NonNullable<Props["modeRows"]>[number]["tone"] & string, string> = {
  default: "text-[var(--arc-color-text)]",
  good: "text-[var(--arc-color-success-text)]",
  warn: "text-[var(--arc-color-gold)]",
  bad: "text-[var(--arc-color-danger-text)]",
};

export function ProvinceHoverTooltip({ open, x, y, provinceName, areaKm2, ownerName, colonizers, modeLabel, modeRows = [] }: Props) {
  const { locale, t } = useUiText();
  const formattedArea = formatKm2(areaKm2, locale);
  if (!open) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-40 min-w-[220px] max-w-[320px] rounded-xl"
      style={{ left: x + 14, top: y + 14 }}
    >
      <div className="glass panel-border rounded-xl bg-[var(--arc-color-panel)] px-3 py-2 shadow-2xl backdrop-blur-xl">
        <div className="text-sm font-semibold text-[var(--arc-color-text)]">{provinceName}</div>
        {formattedArea && <div className="mt-1 text-xs text-[var(--arc-color-text-muted)]">{t("provinceTooltip.area", { area: formattedArea })}</div>}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--arc-color-text-soft)]">
          <Crown size={13} className="text-[var(--arc-color-gold)]" />
          <span>{t("provinceTooltip.owner", { owner: ownerName })}</span>
        </div>

        {modeRows.length > 0 && (
          <div className="mt-2 border-t border-[var(--arc-color-gold-soft)] pt-2">
            {modeLabel && <div className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--arc-color-text-muted)]">{modeLabel}</div>}
            <div className="space-y-1">
              {modeRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[var(--arc-color-text-muted)]">{row.label}</span>
                  <span className={`max-w-[170px] truncate text-right font-semibold ${toneClass[row.tone ?? "default"]}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {colonizers.length > 0 && (
          <div className="mt-2 border-t border-[var(--arc-color-gold-soft)] pt-2">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--arc-color-text-muted)]">
              <Flag size={12} className="text-[var(--arc-color-success-text)]" />
              <span>{t("provinceTooltip.colonization")}</span>
            </div>
            <div className="space-y-1.5">
              {colonizers.map((row) => (
                <div key={row.countryId} className="flex items-center justify-between gap-2 rounded-md bg-[var(--arc-overlay-30)] px-2 py-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.countryColor }} />
                    <span className="truncate text-xs text-[var(--arc-color-text)]">{row.countryName}</span>
                    {row.hasQueuedOrder && <Sparkles size={11} className="text-[var(--arc-color-gold)]" />}
                  </span>
                  <span className="text-xs font-semibold text-[var(--arc-color-success-text)]">{row.percent.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
