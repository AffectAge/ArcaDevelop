import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, History, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { CountryEventRecord, DecisionEffect, ResourceTotals } from "@arcanorum/shared";
import { chooseCountryEventOption, fetchCountryEvents, type CountryEventView } from "../lib/api";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState } from "./ui/AppSurface";
import { EventStoryModal } from "./ui/EventStoryModal";

type Props = {
  open: boolean;
  token: string;
  countryId: string;
  focusPendingId?: string | null;
  onResolvedPendingId?: (pendingId: string) => void;
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
  system: "Система",
  politics: "Политика",
  economy: "Экономика",
  military: "Армия",
  diplomacy: "Дипломатия",
  colonization: "Колонизация",
};

function formatEffects(effects?: DecisionEffect[]) {
  return (effects ?? []).map((effect) => {
    if (effect.type === "resource_delta") {
      const amount = effect.amount >= 0 ? `+${effect.amount}` : String(effect.amount);
      return `${amount} ${RESOURCE_LABEL[effect.resource]}`;
    }
    return "Эффект";
  });
}

export function CountryEventsModal({ open, token, countryId, focusPendingId, onResolvedPendingId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [events, setEvents] = useState<CountryEventView[]>([]);
  const [record, setRecord] = useState<CountryEventRecord | null>(null);
  const [tab, setTab] = useState<"pending" | "history">("pending");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchCountryEvents(token, countryId)
      .then((result) => {
        if (cancelled) return;
        setEvents(result.events);
        setRecord(result.record);
      })
      .catch(() => {
        if (!cancelled) toast.error("Не удалось загрузить события");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryId, open, token]);

  const importantCount = useMemo(() => events.filter((event) => event.event.blocking).length, [events]);
  const focusedEvent = useMemo(
    () => (focusPendingId ? events.find((event) => event.pendingId === focusPendingId) ?? null : null),
    [events, focusPendingId],
  );
  const visibleEvents = focusedEvent ? [focusedEvent] : events;

  useEffect(() => {
    if (!open || !focusPendingId || loading) return;
    if (focusedEvent) return;
    onResolvedPendingId?.(focusPendingId);
  }, [focusPendingId, focusedEvent, loading, onResolvedPendingId, open]);

  const chooseOption = async (pendingId: string, optionId: string) => {
    setChoosingId(`${pendingId}:${optionId}`);
    try {
      const result = await chooseCountryEventOption(token, countryId, pendingId, optionId);
      setEvents(result.events);
      setRecord(result.record);
      onResolvedPendingId?.(pendingId);
      if (focusPendingId === pendingId) onClose();
      toast.success("Событие обработано");
    } catch (error) {
      toast.error("Не удалось выбрать вариант", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setChoosingId(null);
    }
  };

  if (focusPendingId) {
    const item = focusedEvent;
    if (!item) {
      return null;
    }
    return (
      <EventStoryModal
        open={open}
        onClose={onClose}
        title={item?.name ?? "Событие"}
        subtitle={item ? `Ивент страны · ход ${item.createdTurnId}` : "Ожидаем данные события"}
        body={item?.description ?? null}
        imageUrl={item?.logoUrl ?? null}
        imageCaption={item ? item.name : null}
        categoryLabel={item ? CATEGORY_LABEL[item.event.category] ?? item.event.category : null}
        importantLabel={item?.event.blocking ? "Важное" : null}
        accentColor={item?.color ?? "#4ade80"}
        emptyState={
          loading ? (
            <AppEmptyState title="Загрузка события">Открываем событие из уведомления.</AppEmptyState>
          ) : undefined
        }
        options={(item?.event.options ?? []).map((option) => {
          const effects = formatEffects(option.effects);
          const busy = choosingId === `${item?.pendingId}:${option.id}`;
          return {
            id: option.id,
            label: option.label,
            description: option.description,
            effects,
            buttonColor: option.buttonColor ?? null,
            pending: busy,
            disabled: Boolean(choosingId),
            onClick: () => item && chooseOption(item.pendingId, option.id),
          };
        })}
      />
    );
  }

  return (
    <AppModal open={open} onClose={onClose} modalKey="events" zIndexClassName="z-[170]">
      <AppModalHeader
        title={focusedEvent ? focusedEvent.name : "Ивенты страны"}
        description={focusedEvent ? "Событие требует выбора" : importantCount > 0 ? `${importantCount} важных событий ждут выбора` : "Автоматические события и варианты выбора"}
        onClose={onClose}
      />

      {!focusedEvent ? <div className="mb-4 flex flex-wrap gap-2">
        <AppButton variant={tab === "pending" ? "primary" : "ghost"} onClick={() => setTab("pending")} icon={<Bell size={14} />}>
          Ожидающие
        </AppButton>
        <AppButton variant={tab === "history" ? "primary" : "ghost"} onClick={() => setTab("history")} icon={<History size={14} />}>
          История
        </AppButton>
      </div> : null}

      {loading ? (
        <AppEmptyState title="Загрузка событий">Проверяем ожидающие ивенты.</AppEmptyState>
      ) : !focusedEvent && tab === "history" ? (
        <div className="space-y-2">
          {(record?.history ?? []).length === 0 ? (
            <AppEmptyState title="История пуста">Страна ещё не выбирала варианты событий.</AppEmptyState>
          ) : (
            (record?.history ?? []).map((item) => (
              <AppCard key={`${item.eventId}-${item.resolvedTurnId}-${item.optionId}`} className="p-3">
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <div className="mt-1 text-xs text-white/50">
                  {item.optionLabel} · ход {item.resolvedTurnId}
                </div>
              </AppCard>
            ))
          )}
        </div>
      ) : visibleEvents.length === 0 ? (
        <AppEmptyState title="Нет событий">Сейчас у страны нет ожидающих ивентов.</AppEmptyState>
      ) : (
        <div className="space-y-4">
          {visibleEvents.map((item) => (
            <AppCard key={item.pendingId} className="overflow-hidden p-0">
              <div className="grid min-h-[420px] lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)]">
                <div className="relative min-h-[220px] border-b border-white/10 bg-[#111821] lg:border-b-0 lg:border-r">
                  {item.logoUrl ? (
                    <img src={item.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full min-h-[220px] items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(74,222,128,0.20),rgba(9,14,22,0.95)_68%)]">
                      <Sparkles size={72} className="text-arc-accent/70" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20" />
                  <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                    <span className="rounded-md border border-white/10 bg-black/25 px-2 py-0.5 text-[11px] text-white/50">
                      {CATEGORY_LABEL[item.event.category] ?? item.event.category}
                    </span>
                    {item.event.blocking ? (
                      <span className="rounded-md border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                        Важное
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="min-w-0 p-5">
                  <div className="text-2xl font-semibold text-white">{item.name}</div>
                  {item.description ? <div className="mt-3 text-sm leading-6 text-white/70">{item.description}</div> : null}
                  <div className="mt-5 grid gap-3">
                    {(item.event.options ?? []).map((option) => {
                      const effects = formatEffects(option.effects);
                      const busy = choosingId === `${item.pendingId}:${option.id}`;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={Boolean(choosingId)}
                          onClick={() => chooseOption(item.pendingId, option.id)}
                          className="rounded-xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-arc-accent/30 hover:bg-arc-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <CheckCircle2 size={15} className="text-arc-accent" />
                            {busy ? "Применяем..." : option.label}
                          </div>
                          {option.description ? <div className="mt-1 text-xs text-white/55">{option.description}</div> : null}
                          {effects.length > 0 ? <div className="mt-2 text-xs text-white/45">{effects.join(", ")}</div> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </AppCard>
          ))}
        </div>
      )}
    </AppModal>
  );
}
