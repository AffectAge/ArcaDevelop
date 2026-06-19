import { Listbox } from "@headlessui/react";
import { Check, ChevronDown, Coins, Flag, Lock, Settings, Trophy } from "lucide-react";
import type { Country } from "@arcanorum/shared";
import { Tooltip } from "./Tooltip";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState, AppSection, AppToolbar } from "./ui/AppSurface";
import { useUiText } from "../i18n/useUiText";

type Props = {
  open: boolean;
  regionId: string | null;
  regionName: string | null;
  regionAreaKm2?: number | null;
  ownerCountryId: string | null;
  colonizationCost: number;
  colonizationDucatsCost?: number;
  colonizationDisabled: boolean;
  progressByCountry: Record<string, number>;
  currentCountryId: string | null;
  countries: Country[];
  colonizationIconUrl?: string | null;
  ducatsIconUrl?: string | null;
  colonizationLimit?: { active: number; max: number } | null;
  colonizedRegionOptions?: Array<{ id: string; name: string }>;
  selectedColonizedRegionId?: string | null;
  onSelectColonizedRegion?: (regionId: string) => void;
  canStart: boolean;
  canCancel: boolean;
  pending?: boolean;
  onClose: () => void;
  onStart: () => void;
  onCancel: () => void;
  canOpenAdminProvinceEditor?: boolean;
  onOpenAdminProvinceEditor?: () => void;
};

export function ColonizationModal({
  open,
  regionId,
  regionName,
  regionAreaKm2,
  ownerCountryId,
  colonizationCost,
  colonizationDucatsCost = 0,
  colonizationDisabled,
  progressByCountry,
  currentCountryId,
  countries,
  colonizationIconUrl,
  ducatsIconUrl,
  colonizationLimit,
  colonizedRegionOptions = [],
  selectedColonizedRegionId,
  onSelectColonizedRegion,
  canStart,
  canCancel,
  pending,
  onClose,
  onStart,
  onCancel,
  canOpenAdminProvinceEditor,
  onOpenAdminProvinceEditor,
}: Props) {
  const { locale, t } = useUiText();
  const numberLocale = locale === "en" ? "en-US" : "ru-RU";
  const formattedAreaKm2 =
    regionAreaKm2 != null && Number.isFinite(regionAreaKm2) && regionAreaKm2 > 0
      ? `${new Intl.NumberFormat(numberLocale).format(Math.round(regionAreaKm2))} km²`
      : null;
  const countryById = new Map(countries.map((c) => [c.id, c] as const));
  const participants = Object.entries(progressByCountry).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const leadersTop3 = participants.slice(0, 3);
  const myProgress = currentCountryId ? (progressByCountry[currentCountryId] ?? 0) : 0;
  const myProgressPct = Math.max(0, Math.min(100, (myProgress / Math.max(1, colonizationCost)) * 100));
  return (
    <AppModal open={open} onClose={onClose} modalKey="colonization" zIndexClassName="z-[130]" paddingClassName="p-4" panelClassName="rounded-none">
          <AppModalHeader
            title={t("colonization.title", { region: regionName ?? regionId ?? t("colonization.fallbackRegion") })}
            description={[regionId, formattedAreaKm2 ? t("colonization.area", { area: formattedAreaKm2 }) : null].filter(Boolean).join(" • ")}
            onClose={onClose}
          />

          {colonizedRegionOptions.length > 0 && onSelectColonizedRegion && (
            <AppToolbar className="mb-3">
              <div className="mb-1 text-xs text-[var(--arc-color-text-muted)]">{t("colonization.showOwnColonies")}</div>
              <Listbox value={selectedColonizedRegionId ?? regionId ?? ""} onChange={onSelectColonizedRegion}>
                <div className="relative">
                  <Listbox.Button className="w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-3 py-2 pr-10 text-left text-sm text-[var(--arc-color-text)]">
                    {colonizedRegionOptions.find((p) => p.id === (selectedColonizedRegionId ?? regionId ?? ""))?.name ??
                      colonizedRegionOptions.find((p) => p.id === (selectedColonizedRegionId ?? regionId ?? ""))?.id ??
                      t("colonization.selectRegion")}
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--arc-color-text-muted)]" />
                  </Listbox.Button>
                  <Listbox.Options className="arc-scrollbar panel-border absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-lg bg-[var(--arc-color-panel)] p-1 text-sm shadow-2xl outline-none">
                    {colonizedRegionOptions.map((option) => (
                      <Listbox.Option
                        key={option.id}
                        value={option.id}
                        className={({ active }) =>
                          `relative cursor-pointer rounded-md px-3 py-2 pr-8 transition ${
                            active ? "bg-[var(--arc-color-primary-bottom)] text-[var(--arc-color-text)]" : "text-[var(--arc-color-text-soft)]"
                          }`
                        }
                      >
                        {({ selected }) => (
                          <>
                            <div className="truncate">{option.name}</div>
                            <div className="text-[11px] text-[var(--arc-color-text-muted)]">{option.id}</div>
                            {selected && <Check size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--arc-color-gold)]" />}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </div>
              </Listbox>
            </AppToolbar>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[420px_1fr]">
            <AppSection>
              <div className="text-xs text-[var(--arc-color-text-muted)]">{t("colonization.cost")}</div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-[var(--arc-color-success-text)]">
                {colonizationIconUrl ? (
                  <img src={colonizationIconUrl} alt="" className="h-5 w-5 rounded object-contain" />
                ) : (
                  <Flag size={18} className="text-[var(--arc-color-success-text)]" />
                )}
                <span>{colonizationCost}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--arc-color-text-soft)]">
                <span>{t("colonization.ducatsByArea")}</span>
                <span className="inline-flex items-center gap-1 text-[var(--arc-color-gold)]">
                  {ducatsIconUrl ? (
                    <img src={ducatsIconUrl} alt="" className="h-3.5 w-3.5 rounded-sm object-contain" />
                  ) : (
                    <Coins size={13} className="text-[var(--arc-color-gold)]" />
                  )}
                  <span>{colonizationDucatsCost}</span>
                </span>
              </div>
              <div className="mt-2 text-xs text-[var(--arc-color-text-soft)]">
                {t("colonization.status")}{" "}
                {ownerCountryId
                  ? t("colonization.statusOccupied", { country: countryById.get(ownerCountryId)?.name ?? ownerCountryId })
                  : colonizationDisabled
                    ? t("colonization.statusDisabled")
                    : t("colonization.statusAvailable")}
              </div>
              {formattedAreaKm2 && <div className="mt-1 text-xs text-[var(--arc-color-text-soft)]">{t("colonization.regionArea", { area: formattedAreaKm2 })}</div>}
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-[var(--arc-color-text-soft)]">
                <span>{t("colonization.yourProgress", { progress: myProgress.toFixed(1), cost: colonizationCost })}</span>
                <span className="text-[var(--arc-color-success-text)]">{myProgressPct.toFixed(0)}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[var(--arc-overlay-45)]">
                <div className="h-full rounded-full bg-[var(--arc-color-success-text)] transition-all" style={{ width: `${myProgressPct}%` }} />
              </div>
              {colonizationLimit && (
                <Tooltip
                  content={t("colonization.limitTooltip")}
                  placement="top"
                >
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-2 py-1 text-xs">
                  <span className="text-[var(--arc-color-text-soft)]">{t("colonization.limit")}</span>
                  <span
                    className={
                      colonizationLimit.active >= colonizationLimit.max
                        ? "text-[var(--arc-color-danger-text)]"
                        : colonizationLimit.active > 0
                          ? "text-[var(--arc-color-gold)]"
                          : "text-[var(--arc-color-success-text)]"
                    }
                  >
                    {colonizationLimit.active} / {colonizationLimit.max}
                  </span>
                  </div>
                </Tooltip>
              )}
            </AppSection>

            <AppSection>
              <div className="text-xs text-[var(--arc-color-text-muted)]">{t("colonization.raceLeader")}</div>
              {leadersTop3.length > 0 ? (
                <div className="mt-1 space-y-1.5">
                  {leadersTop3.map(([countryId, points], index) => {
                    const country = countryById.get(countryId);
                    const pct = Math.max(0, Math.min(100, (points / Math.max(1, colonizationCost)) * 100));
                    return (
                      <div key={countryId} className="flex items-center gap-2 text-sm text-[var(--arc-color-text)]">
                        <Trophy
                          size={15}
                          className={index === 0 ? "text-[var(--arc-color-gold)]" : index === 1 ? "text-[var(--arc-color-text-soft)]" : "text-[var(--arc-color-gold-warm)]"}
                        />
                        {country?.flagUrl ? (
                          <img src={country.flagUrl} alt="" className="h-4 w-5 rounded-sm object-cover" />
                        ) : (
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: country?.color ?? "#94a3b8" }} />
                        )}
                        <span className="truncate">{country?.name ?? countryId}</span>
                        <span className="text-[var(--arc-color-text-muted)]">•</span>
                        <span className="text-[var(--arc-color-success-text)]">
                          {points.toFixed(1)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <AppEmptyState className="mt-1 py-4">{t("colonization.noParticipants")}</AppEmptyState>
              )}
              {colonizationDisabled && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--arc-color-danger-border)] bg-[var(--arc-color-danger-bottom)] px-2 py-1 text-xs text-[var(--arc-color-danger-text)]">
                  <Lock size={13} />
                  {t("colonization.disabledByAdmin")}
                </div>
              )}
            </AppSection>
          </div>

          <AppSection className="mt-3">
            <div className="mb-2 text-xs text-[var(--arc-color-text-muted)]">{t("colonization.participants")}</div>
            {participants.length === 0 ? (
              <AppEmptyState>{t("colonization.noColonizers")}</AppEmptyState>
            ) : (
              <div className="arc-scrollbar max-h-[calc(100vh-22rem)] space-y-2 overflow-auto pr-1">
                {participants.map(([countryId, points]) => {
                  const country = countryById.get(countryId);
                  const pct = Math.max(0, Math.min(100, (points / Math.max(1, colonizationCost)) * 100));
                  return (
                    <AppCard key={countryId} className="bg-[var(--arc-overlay-30)] p-2">
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-[var(--arc-color-text-soft)]">
                          {country?.flagUrl ? (
                            <img src={country.flagUrl} alt="" className="h-4 w-5 rounded-sm object-cover" />
                          ) : (
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: country?.color ?? "#94a3b8" }} />
                          )}
                          <span>{country?.name ?? countryId}</span>
                        </div>
                        <span className="text-[var(--arc-color-success-text)]">
                          {points.toFixed(1)} / {colonizationCost} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--arc-overlay-45)]">
                        <div className="h-full rounded-full bg-[var(--arc-color-success-text)] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </AppCard>
                  );
                })}
              </div>
            )}
          </AppSection>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {canOpenAdminProvinceEditor && onOpenAdminProvinceEditor && (
              <Tooltip content={t("colonization.openAdminEditor")} placement="top">
                <AppButton
                  onClick={onOpenAdminProvinceEditor}
                  aria-label={t("colonization.openAdminEditorAria")}
                  variant="danger"
                  size="icon"
                >
                  <Settings size={16} />
                </AppButton>
              </Tooltip>
            )}
            <Tooltip content={canCancel ? t("colonization.cancelTooltipCan") : t("colonization.cancelTooltipCannot")} placement="top">
              <AppButton
                onClick={onCancel}
                disabled={!canCancel || pending}
                variant="danger"
              >
                {t("colonization.cancel")}
              </AppButton>
            </Tooltip>
            <Tooltip content={canStart ? t("colonization.startTooltipCan") : t("colonization.startTooltipCannot")} placement="top">
              <AppButton
                onClick={onStart}
                disabled={!canStart || pending}
                variant="primary"
              >
                {t("colonization.start")}
              </AppButton>
            </Tooltip>
          </div>
    </AppModal>
  );
}
