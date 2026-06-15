import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ActiveModifierRow, ModifierEffect, ModifierMode, ModifierScope, ModifierStat } from "@arcanorum/shared";
import { fetchCountryModifiers } from "../lib/api";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppEmptyState, AppSection, AppToolbar } from "./ui/AppSurface";
import { AppCell, AppHeadCell, AppTable, AppTableShell } from "./ui/AppTable";

type Props = {
  open: boolean;
  token: string;
  countryId: string;
  countryName: string;
  onClose: () => void;
};

const STAT_LABEL: Record<ModifierStat, string> = {
  culture_gain: "Прирост культуры",
  science_gain: "Прирост науки",
  religion_gain: "Прирост религии",
  colonization_gain: "Прирост колонизации",
  construction_gain: "Прирост строительства",
  ducats_gain: "Прирост дукатов",
  gold_gain: "Прирост золота",
  technology_cost: "Стоимость технологий",
  building_construction_cost: "Стоимость строительства",
  building_output: "Выпуск зданий",
  building_input: "Расходы зданий",
  building_throughput: "Производительность зданий",
  building_wage: "Зарплаты зданий",
};

const MODE_LABEL: Record<ModifierMode, string> = {
  add: "+",
  add_pct: "%",
  mult: "x",
};

const SCOPE_LABEL: Record<ModifierScope, string> = {
  country: "Страна",
  province: "Провинция",
  building: "Здание",
  pop: "Население",
  market: "Рынок",
};

function formatEffectValue(effect: ModifierEffect): string {
  if (effect.mode === "add_pct") {
    const pct = effect.value * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
  }
  if (effect.mode === "mult") {
    return `x${effect.value.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}`;
  }
  return `${effect.value >= 0 ? "+" : ""}${effect.value.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}`;
}

function formatTarget(effect: ModifierEffect): string {
  const target = effect.target;
  if (!target) return "Все подходящие цели";
  const parts = [
    target.buildingId ? `здание: ${target.buildingId}` : null,
    target.goodId ? `товар: ${target.goodId}` : null,
    target.professionId ? `профессия: ${target.professionId}` : null,
    target.resourceCategoryId ? `категория: ${target.resourceCategoryId}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Все подходящие цели";
}

export function CountryModifiersModal({ open, token, countryId, countryName, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [modifiers, setModifiers] = useState<ActiveModifierRow[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetchCountryModifiers(token, countryId);
      setModifiers(result.modifiers);
    } catch {
      toast.error("Не удалось загрузить модификаторы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, token, countryId]);

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
            title="Модификаторы страны"
            description={`${countryName} · ${rows.length.toLocaleString("ru-RU")} эффектов`}
            onClose={onClose}
            actions={
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-arc-accent">
                  <SlidersHorizontal size={19} />
                </div>
                <AppButton type="button" onClick={() => void load()} disabled={loading} variant="secondary" size="icon">
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </AppButton>
              </>
            }
          />

          <AppToolbar>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
              <span>Действующие эффекты: {rows.length.toLocaleString("ru-RU")}</span>
              <span className="text-white/45">Источник, область, параметр и цель показаны отдельными колонками.</span>
            </div>
          </AppToolbar>

          <AppSection className="flex-1 overflow-auto bg-[#08101a] p-0">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Загрузка модификаторов...</div>
            ) : rows.length === 0 ? (
              <AppEmptyState className="m-4">У страны пока нет действующих модификаторов</AppEmptyState>
            ) : (
              <AppTableShell>
              <AppTable className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#101824] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <AppHeadCell>Модификатор</AppHeadCell>
                    <AppHeadCell>Источник</AppHeadCell>
                    <AppHeadCell>Область</AppHeadCell>
                    <AppHeadCell>Параметр</AppHeadCell>
                    <AppHeadCell>Тип</AppHeadCell>
                    <AppHeadCell>Значение</AppHeadCell>
                    <AppHeadCell>Цель</AppHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ key, modifier, effect }) => (
                    <tr key={key} className="text-slate-200">
                      <AppCell className="font-medium text-white">{modifier.label}</AppCell>
                      <AppCell>
                        <div>{modifier.sourceName}</div>
                        <div className="text-[11px] text-slate-500">
                          {modifier.sourceKind === "technology"
                            ? "Технология"
                            : modifier.sourceKind === "law"
                              ? "Закон"
                              : modifier.sourceKind === "modifier"
                                ? "Модификатор"
                                : "Событие"}
                        </div>
                      </AppCell>
                      <AppCell>{SCOPE_LABEL[modifier.scope]}</AppCell>
                      <AppCell>{STAT_LABEL[effect.stat]}</AppCell>
                      <AppCell>{MODE_LABEL[effect.mode]}</AppCell>
                      <AppCell className={`font-semibold ${effect.value >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatEffectValue(effect)}</AppCell>
                      <AppCell className="text-slate-400">{formatTarget(effect)}</AppCell>
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
