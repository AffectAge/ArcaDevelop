import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ActiveModifierRow, ModifierEffect, ModifierMode, ModifierScope, ModifierStat } from "@arcanorum/shared";
import { fetchCountryModifiers } from "../lib/api";
import { AppButton } from "./templates/AppButton";
import { AppModal, AppModalHeader } from "./templates/AppModal";
import { AppEmptyState, AppSection, AppToolbar } from "./templates/AppSurface";
import { AppCell, AppHeadCell, AppTable, AppTableShell } from "./templates/AppTable";
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";

type Props = {
  open: boolean;
  token: string;
  countryId: string;
  countryName: string;
  onClose: () => void;
};

const STAT_LABEL_KEY: Record<ModifierStat, UiTextKey> = {
  culture_gain: "modifiers.stat.culture_gain",
  science_gain: "modifiers.stat.science_gain",
  religion_gain: "modifiers.stat.religion_gain",
  colonization_gain: "modifiers.stat.colonization_gain",
  construction_gain: "modifiers.stat.construction_gain",
  ducats_gain: "modifiers.stat.ducats_gain",
  gold_gain: "modifiers.stat.gold_gain",
  technology_cost: "modifiers.stat.technology_cost",
  building_construction_cost: "modifiers.stat.building_construction_cost",
  building_output: "modifiers.stat.building_output",
  building_input: "modifiers.stat.building_input",
  building_throughput: "modifiers.stat.building_throughput",
  building_wage: "modifiers.stat.building_wage",
  hex_movement_cost: "modifiers.stat.hex_movement_cost",
};

const MODE_LABEL: Record<ModifierMode, string> = {
  add: "+",
  add_pct: "%",
  mult: "x",
};

const SCOPE_LABEL_KEY: Record<ModifierScope, UiTextKey> = {
  country: "modifiers.scope.country",
  region: "modifiers.scope.region",
  building: "modifiers.scope.building",
  pop: "modifiers.scope.pop",
  market: "modifiers.scope.market",
};

function sourceKindLabelKey(sourceKind: ActiveModifierRow["sourceKind"]): UiTextKey {
  if (sourceKind === "technology") return "modifiers.source.technology";
  if (sourceKind === "law") return "modifiers.source.law";
  if (sourceKind === "modifier") return "modifiers.source.modifier";
  return "modifiers.source.event";
}

function formatEffectValue(effect: ModifierEffect, locale: string): string {
  if (effect.mode === "add_pct") {
    const pct = effect.value * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  }
  if (effect.mode === "mult") {
    return `x${effect.value.toLocaleString(locale, { maximumFractionDigits: 3 })}`;
  }
  return `${effect.value >= 0 ? "+" : ""}${effect.value.toLocaleString(locale, { maximumFractionDigits: 3 })}`;
}

function formatTarget(effect: ModifierEffect, t: (key: UiTextKey, params?: Record<string, string | number>) => string): string {
  const target = effect.target;
  if (!target) return t("modifiers.target.all");
  const parts = [
    target.buildingId ? t("modifiers.target.building", { value: target.buildingId }) : null,
    target.goodId ? t("modifiers.target.good", { value: target.goodId }) : null,
    target.professionId ? t("modifiers.target.profession", { value: target.professionId }) : null,
    target.resourceCategoryId ? t("modifiers.target.category", { value: target.resourceCategoryId }) : null,
    target.hexTag ? t("modifiers.target.hexTag", { value: target.hexTag }) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : t("modifiers.target.all");
}

export function CountryModifiersModal({ open, token, countryId, countryName, onClose }: Props) {
  const { locale, t } = useUiText();
  const [loading, setLoading] = useState(false);
  const [modifiers, setModifiers] = useState<ActiveModifierRow[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetchCountryModifiers(token, countryId);
      setModifiers(result.modifiers);
    } catch {
      toast.error(t("modifiers.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, token, countryId, t]);

  const rows = useMemo(
    () =>
      modifiers.flatMap((modifier) =>
        modifier.effects.map((effect, index) => ({
          key: `${modifier.id}:${index}`,
          modifier,
          effect,
        })),
      ),
    [modifiers],
  );

  return open ? (
    <AppModal open={open} onClose={onClose} modalKey="modifiers" zIndexClassName="z-[176]" panelClassName="w-full overflow-hidden md:p-5">
          <AppModalHeader
            title={t("modifiers.title")}
            description={t("modifiers.description", { country: countryName, count: rows.length.toLocaleString(locale) })}
            onClose={onClose}
            actions={
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] text-[var(--arc-color-gold)]">
                  <SlidersHorizontal size={19} />
                </div>
                <AppButton type="button" onClick={() => void load()} disabled={loading} variant="secondary" size="icon">
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </AppButton>
              </>
            }
          />

          <AppToolbar>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--arc-color-text-soft)]">
              <span>{t("modifiers.activeCount", { count: rows.length.toLocaleString(locale) })}</span>
              <span className="text-[var(--arc-color-text-muted)]">{t("modifiers.description", { country: countryName, count: rows.length.toLocaleString(locale) })}</span>
            </div>
          </AppToolbar>

          <AppSection className="flex-1 overflow-auto bg-[var(--arc-color-panel-soft)] p-0">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-[var(--arc-color-text-soft)]">{t("modifiers.loading")}</div>
            ) : rows.length === 0 ? (
              <AppEmptyState className="m-4">{t("modifiers.empty")}</AppEmptyState>
            ) : (
              <AppTableShell>
              <AppTable className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--arc-color-header-bottom)] text-xs uppercase tracking-wide text-[var(--arc-color-text-soft)]">
                  <tr>
                    <AppHeadCell>{t("modifiers.column.modifier")}</AppHeadCell>
                    <AppHeadCell>{t("modifiers.column.source")}</AppHeadCell>
                    <AppHeadCell>{t("modifiers.column.scope")}</AppHeadCell>
                    <AppHeadCell>{t("modifiers.column.effect")}</AppHeadCell>
                    <AppHeadCell>{t("modifiers.column.mode")}</AppHeadCell>
                    <AppHeadCell>{t("modifiers.column.value")}</AppHeadCell>
                    <AppHeadCell>{t("modifiers.column.target")}</AppHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ key, modifier, effect }) => (
                    <tr key={key} className="text-[var(--arc-color-text-soft)]">
                      <AppCell className="font-medium text-[var(--arc-color-text)]">{modifier.label}</AppCell>
                      <AppCell>
                        <div>{modifier.sourceName}</div>
                        <div className="text-[11px] text-[var(--arc-color-text-muted)]">{t(sourceKindLabelKey(modifier.sourceKind))}</div>
                      </AppCell>
                      <AppCell>{t(SCOPE_LABEL_KEY[modifier.scope])}</AppCell>
                      <AppCell>{t(STAT_LABEL_KEY[effect.stat])}</AppCell>
                      <AppCell>{MODE_LABEL[effect.mode]}</AppCell>
                      <AppCell className={`font-semibold ${effect.value >= 0 ? "text-[var(--arc-color-success-text)]" : "text-[var(--arc-color-danger-text)]"}`}>{formatEffectValue(effect, locale)}</AppCell>
                      <AppCell className="text-[var(--arc-color-text-muted)]">{formatTarget(effect, t)}</AppCell>
                    </tr>
                  ))}
                </tbody>
              </AppTable>
              </AppTableShell>
            )}
          </AppSection>
    </AppModal>
  ) : null;
}
