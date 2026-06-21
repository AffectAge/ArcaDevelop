import { Crown, Flag, Sparkles } from "lucide-react";
import { useUiText } from "../i18n/useUiText";
import { TooltipContent, TooltipPanel, TooltipSectionBlock, type TooltipRow, type TooltipTone } from "./Tooltip";

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

const modeTone: Record<NonNullable<Props["modeRows"]>[number]["tone"] & string, TooltipTone> = {
  default: "default",
  good: "positive",
  warn: "warning",
  bad: "negative",
};

export function ProvinceHoverTooltip({ open, x, y, provinceName, areaKm2, ownerName, colonizers, modeLabel, modeRows = [] }: Props) {
  const { locale, t } = useUiText();
  const formattedArea = formatKm2(areaKm2, locale);
  if (!open) {
    return null;
  }
  const rows: TooltipRow[] = [
    ...(formattedArea ? [{ id: "area", label: t("provinceTooltip.area", { area: formattedArea }), value: "" }] : []),
    {
      id: "owner",
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Crown size={13} className="text-[var(--arc-color-atlas-primary)]" />
          <span>{t("provinceTooltip.owner", { owner: ownerName })}</span>
        </span>
      ),
      value: "",
    },
  ];

  return (
    <div
      className="pointer-events-none absolute z-40 min-w-[220px] max-w-[320px]"
      style={{ left: x + 14, top: y + 14 }}
    >
      <TooltipPanel variant="rich">
        <TooltipContent
          content={{
            title: provinceName,
            rows,
          }}
        />
        {modeRows.length > 0 ? (
          <TooltipSectionBlock
            section={{
              title: modeLabel,
              rows: modeRows.map((row) => ({
                id: row.label,
                label: row.label,
                value: row.value,
                tone: modeTone[row.tone ?? "default"],
              })),
            }}
          />
        ) : null}
        {colonizers.length > 0 && (
          <TooltipSectionBlock
            section={{
              title: (
                <span className="inline-flex items-center gap-1.5">
                  <Flag size={12} className="text-[var(--arc-color-atlas-good)]" />
                  <span>{t("provinceTooltip.colonization")}</span>
                </span>
              ),
              content: (
                <div className="space-y-1.5">
                  {colonizers.map((row) => (
                    <div key={row.countryId} className="flex items-center justify-between gap-2 rounded-[var(--arc-radius-sm)] bg-[var(--arc-overlay-30)] px-2 py-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.countryColor }} />
                        <span className="truncate text-xs text-[var(--arc-color-atlas-ink)]">{row.countryName}</span>
                        {row.hasQueuedOrder && <Sparkles size={11} className="text-[var(--arc-color-atlas-primary)]" />}
                      </span>
                      <span className="text-xs font-semibold text-[var(--arc-color-atlas-good)]">{row.percent.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              ),
            }}
          />
        )}
      </TooltipPanel>
    </div>
  );
}
