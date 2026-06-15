import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Landmark, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import type { CountryDecisionRecord, ResourceTotals } from "@arcanorum/shared";
import { fetchCountryDecisions, takeCountryDecision, type CountryDecisionView } from "../lib/api";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState } from "./ui/AppSurface";
import { EventStoryModal } from "./ui/EventStoryModal";

type Props = {
  open: boolean;
  token: string;
  countryId: string;
  onClose: () => void;
};

const RESOURCE_LABEL: Record<keyof ResourceTotals, string> = {
  culture: "Культура",
  science: "Наука",
  religion: "Религия",
  colonization: "Колонизация",
  construction: "Строительство",
  ducats: "Дукаты",
  gold: "Золото",
};

const CATEGORY_LABEL: Record<string, string> = {
  politics: "Политика",
  economy: "Экономика",
  military: "Армия",
  diplomacy: "Дипломатия",
  colonization: "Колонизация",
  culture: "Культура",
  religion: "Религия",
  technology: "Технологии",
};

function formatResourceMap(values?: Partial<ResourceTotals>) {
  return Object.entries(values ?? {})
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${RESOURCE_LABEL[key as keyof ResourceTotals] ?? key}: ${value}`);
}

function formatEffects(decision: CountryDecisionView["decision"]) {
  return (decision.effects ?? []).map((effect) => {
    if (effect.type === "resource_delta") {
      const amount = effect.amount >= 0 ? `+${effect.amount}` : String(effect.amount);
      return `${amount} ${RESOURCE_LABEL[effect.resource]}`;
    }
    return "Эффект";
  });
}

export function CountryDecisionsModal({ open, token, countryId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [takingId, setTakingId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<CountryDecisionView[]>([]);
  const [record, setRecord] = useState<CountryDecisionRecord | null>(null);
  const [tab, setTab] = useState<"available" | "locked" | "history">("available");
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchCountryDecisions(token, countryId)
      .then((result) => {
        if (cancelled) return;
        setDecisions(result.decisions);
        setRecord(result.record);
      })
      .catch(() => {
        if (!cancelled) toast.error("Не удалось загрузить решения");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryId, open, token]);

  const available = useMemo(() => decisions.filter((decision) => decision.available), [decisions]);
  const locked = useMemo(() => decisions.filter((decision) => !decision.available), [decisions]);

  const takeDecision = async (decisionId: string) => {
    setTakingId(decisionId);
    try {
      const result = await takeCountryDecision(token, countryId, decisionId);
      setDecisions(result.decisions);
      setRecord(result.record);
      setSelectedDecisionId(null);
      toast.success("Решение принято");
    } catch (error) {
      toast.error("Не удалось принять решение", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setTakingId(null);
    }
  };

  const rows = tab === "available" ? available : locked;
  const selectedDecision = selectedDecisionId ? decisions.find((item) => item.id === selectedDecisionId) ?? null : null;

  return (
    <>
    <AppModal open={open} onClose={onClose} modalKey="decisions" zIndexClassName="z-[170]">
      <AppModalHeader title="Решения страны" description="Доступные действия, заданные в панели контента" onClose={onClose} />

      <div className="mb-4 flex flex-wrap gap-2">
        <AppButton variant={tab === "available" ? "primary" : "ghost"} onClick={() => setTab("available")} icon={<CheckCircle2 size={14} />}>
          Доступные
        </AppButton>
        <AppButton variant={tab === "locked" ? "primary" : "ghost"} onClick={() => setTab("locked")} icon={<Clock size={14} />}>
          Недоступные
        </AppButton>
        <AppButton variant={tab === "history" ? "primary" : "ghost"} onClick={() => setTab("history")} icon={<RefreshCcw size={14} />}>
          История
        </AppButton>
      </div>

      {loading ? (
        <AppEmptyState title="Загрузка решений">Проверяем условия для страны.</AppEmptyState>
      ) : tab === "history" ? (
        <div className="space-y-2">
          {(record?.history ?? []).length === 0 ? (
            <AppEmptyState title="История пуста">Страна ещё не принимала решений.</AppEmptyState>
          ) : (
            (record?.history ?? []).map((item) => (
              <AppCard key={`${item.decisionId}-${item.takenTurnId}`} className="p-3">
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <div className="mt-1 text-xs text-white/50">Ход {item.takenTurnId}</div>
              </AppCard>
            ))
          )}
        </div>
      ) : rows.length === 0 ? (
        <AppEmptyState title="Нет решений">{tab === "available" ? "Сейчас нет доступных решений." : "Недоступных решений нет."}</AppEmptyState>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map((item) => {
            const costs = formatResourceMap(item.decision.costs);
            const effects = formatEffects(item.decision);
            return (
              <AppCard key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/25" style={{ color: item.color }}>
                        <Landmark size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{item.name}</div>
                        <div className="text-xs text-white/45">{CATEGORY_LABEL[item.decision.category] ?? item.decision.category}</div>
                      </div>
                    </div>
                    {item.description ? <div className="mt-3 text-sm leading-relaxed text-white/65">{item.description}</div> : null}
                  </div>
                  <AppButton disabled={takingId === item.id} onClick={() => setSelectedDecisionId(item.id)} variant={item.available ? "primary" : "ghost"}>
                    Открыть
                  </AppButton>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-white/60 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <div className="mb-1 text-white/35">Стоимость</div>
                    {costs.length > 0 ? costs.join(", ") : "Нет"}
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <div className="mb-1 text-white/35">Эффекты</div>
                    {effects.length > 0 ? effects.join(", ") : "Нет"}
                  </div>
                </div>
                {!item.available && item.reason ? <div className="mt-3 text-xs text-amber-200">{item.reason}</div> : null}
              </AppCard>
            );
          })}
        </div>
      )}
    </AppModal>
    <EventStoryModal
      open={Boolean(selectedDecision)}
      onClose={() => setSelectedDecisionId(null)}
      title={selectedDecision?.name ?? "Решение"}
      subtitle={selectedDecision ? `Решение страны · ${CATEGORY_LABEL[selectedDecision.decision.category] ?? selectedDecision.decision.category}` : null}
      body={selectedDecision?.description ?? null}
      imageUrl={selectedDecision?.logoUrl ?? null}
      imageCaption={selectedDecision?.name ?? null}
      categoryLabel={selectedDecision ? CATEGORY_LABEL[selectedDecision.decision.category] ?? selectedDecision.decision.category : null}
      importantLabel={selectedDecision?.available ? null : selectedDecision?.reason ?? "Недоступно"}
      accentColor={selectedDecision?.color ?? "#4ade80"}
      options={
        selectedDecision
          ? [
              {
                id: "take",
                label: selectedDecision.available ? "Принять решение" : "Решение недоступно",
                description: selectedDecision.reason ?? undefined,
                effects: [
                  ...formatResourceMap(selectedDecision.decision.costs).map((row) => `Стоимость: ${row}`),
                  ...formatEffects(selectedDecision.decision),
                ],
                buttonColor: selectedDecision.color,
                disabled: !selectedDecision.available || Boolean(takingId),
                pending: takingId === selectedDecision.id,
                onClick: () => takeDecision(selectedDecision.id),
              },
            ]
          : []
      }
    />
    </>
  );
}
