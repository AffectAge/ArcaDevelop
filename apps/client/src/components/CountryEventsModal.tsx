import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, History, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { CountryEventRecord, EventEffectSummary, GameEffect, ResourceTotals } from "@arcanorum/shared";
import { chooseCountryEventOption, fetchCountryEvents, type CountryEventView } from "../lib/api";
import { formatGameEffectPreview } from "../lib/gameEffectPreview";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState } from "./ui/AppSurface";
import { EventStoryModal } from "./ui/EventStoryModal";
import type { UiTextKey } from "../i18n/uiText";
import { useUiText } from "../i18n/useUiText";

type Props = {
  open: boolean;
  token: string;
  countryId: string;
  focusPendingId?: string | null;
  onResolvedPendingId?: (pendingId: string) => void;
  onClose: () => void;
};

const RESOURCE_LABEL_KEY: Record<keyof ResourceTotals, UiTextKey> = {
  culture: "shell.resource.culture",
  science: "shell.resource.science",
  religion: "shell.resource.religion",
  colonization: "shell.resource.colonization",
  construction: "shell.resource.construction",
  ducats: "shell.resource.ducats",
  gold: "shell.resource.gold",
};

const CATEGORY_LABEL_KEY: Record<string, UiTextKey> = {
  system: "shell.story.category.system",
  politics: "shell.story.category.politics",
  economy: "shell.story.category.economy",
  military: "shell.story.category.military",
  diplomacy: "shell.story.category.diplomacy",
  colonization: "shell.story.category.colonization",
};

function scenarioTextKey(key: string): UiTextKey {
  return key as UiTextKey;
}

function formatEffects(effects: GameEffect[] | undefined, t: (key: UiTextKey, params?: Record<string, string | number>) => string) {
  return (effects ?? []).map((effect) => formatGameEffectPreview(effect, t, RESOURCE_LABEL_KEY));
}

function formatHistoryEffect(effect: EventEffectSummary, t: (key: UiTextKey, params?: Record<string, string | number>) => string): string {
  const resource = effect.resource ? t(RESOURCE_LABEL_KEY[effect.resource]) : "-";
  const amount = effect.amount == null ? "-" : String(effect.amount);
  const target = effect.eventId ?? effect.journalEntryId ?? effect.flagId ?? "-";
  return t("countryEvents.historyEffectLine", {
    type: effect.type,
    resource,
    amount,
    target,
  });
}

function formatHistoryScopes(
  scopes: CountryEventRecord["history"][number]["scopes"] | undefined,
  t: (key: UiTextKey, params?: Record<string, string | number>) => string,
): string {
  const rows = Object.entries(scopes ?? {});
  if (rows.length === 0) return t("countryEvents.historyScopesNone");
  return rows
    .slice(0, 3)
    .map(([scopeId, scope]) => `${scopeId}: ${scope.labelKey ? t(scenarioTextKey(scope.labelKey)) : scope.id}`)
    .join(", ");
}

function formatExplanationValue(value: string | number | boolean | null | undefined): string {
  if (value == null) return "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function formatTriggerExplanation(item: CountryEventView, t: (key: UiTextKey, params?: Record<string, string | number>) => string) {
  const explanations = item.triggerExplanation ?? [];
  if (explanations.length === 0) return [];
  return explanations.slice(0, 4).map((explanation) =>
    t("countryEvents.triggerExplanationLine", {
      label: t(scenarioTextKey(explanation.labelKey)),
      value: formatExplanationValue(explanation.value),
      threshold: formatExplanationValue(explanation.threshold),
    }),
  );
}

export function CountryEventsModal({ open, token, countryId, focusPendingId, onResolvedPendingId, onClose }: Props) {
  const { t } = useUiText();
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
        if (!cancelled) toast.error(t("countryEvents.loadFailed"));
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
  const eventTitle = (item: CountryEventView) => (item.event.titleKey ? t(scenarioTextKey(item.event.titleKey)) : item.name);
  const eventDescription = (item: CountryEventView) =>
    item.event.descriptionKey ? t(scenarioTextKey(item.event.descriptionKey)) : item.description || null;

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
      toast.success(t("countryEvents.processed"));
    } catch (error) {
      toast.error(t("countryEvents.optionFailed"), { description: error instanceof Error ? error.message : undefined });
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
        title={item ? eventTitle(item) : t("countryEvents.defaultEvent")}
        subtitle={item ? t("countryEvents.storySubtitle", { turn: item.createdTurnId }) : t("countryEvents.loadingDescription")}
        body={item ? eventDescription(item) : null}
        imageUrl={item?.logoUrl ?? null}
        imageCaption={item ? eventTitle(item) : null}
        categoryLabel={item ? t(CATEGORY_LABEL_KEY[item.event.category] ?? "countryEvents.defaultEvent") : null}
        importantLabel={item?.event.blocking ? t("countryEvents.important") : null}
        accentColor={item?.color ?? "#4ade80"}
        emptyState={
          loading ? (
            <AppEmptyState title={t("countryEvents.loading")}>{t("countryEvents.notificationLoadingDescription")}</AppEmptyState>
          ) : undefined
        }
        options={(item?.event.options ?? []).map((option) => {
          const effects = formatEffects(option.effects, t);
          const busy = choosingId === `${item?.pendingId}:${option.id}`;
          return {
            id: option.id,
            label: t(scenarioTextKey(option.labelKey)),
            description: option.descriptionKey ? t(scenarioTextKey(option.descriptionKey)) : null,
            effects,
            buttonTone: option.buttonTone ?? "default",
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
        title={focusedEvent ? eventTitle(focusedEvent) : t("countryEvents.title")}
        description={focusedEvent ? t("countryEvents.choiceRequired") : importantCount > 0 ? t("countryEvents.importantPending", { count: importantCount }) : t("shell.action.eventsDescription")}
        onClose={onClose}
      />

      {!focusedEvent ? <div className="mb-4 flex flex-wrap gap-2">
        <AppButton variant={tab === "pending" ? "primary" : "ghost"} onClick={() => setTab("pending")} icon={<Bell size={14} />}>
          {t("shell.preview.pendingResponse")}
        </AppButton>
        <AppButton variant={tab === "history" ? "primary" : "ghost"} onClick={() => setTab("history")} icon={<History size={14} />}>
          {t("decisions.history")}
        </AppButton>
      </div> : null}

      {loading ? (
        <AppEmptyState title={t("countryEvents.loading")}>{t("countryEvents.loadingDescription")}</AppEmptyState>
      ) : !focusedEvent && tab === "history" ? (
        <div className="space-y-2">
          {(record?.history ?? []).length === 0 ? (
            <AppEmptyState title={t("countryEvents.historyEmpty")}>{t("countryEvents.historyEmptyDescription")}</AppEmptyState>
          ) : (
            (record?.history ?? []).map((item) => (
              <AppCard key={`${item.eventId}-${item.resolvedTurnId}-${item.optionId}`} className="p-3">
                <div className="text-sm font-semibold text-[var(--arc-color-text)]">
                  {item.titleKey ? t(scenarioTextKey(item.titleKey)) : item.label ?? item.eventId}
                </div>
                <div className="mt-1 text-xs text-[var(--arc-color-text-muted)]">
                  {t("countryEvents.historyMeta", {
                    option: item.optionLabelKey ? t(scenarioTextKey(item.optionLabelKey)) : item.optionLabel ?? item.optionId,
                    turn: item.resolvedTurnId,
                  })}
                </div>
                <div className="mt-2 text-xs text-[var(--arc-color-text-muted)]">
                  {t("countryEvents.historyScopes", { scopes: formatHistoryScopes(item.scopes, t) })}
                </div>
                {item.appliedEffects.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs text-[var(--arc-color-text-muted)]">
                    <div className="font-semibold text-[var(--arc-color-text-soft)]">{t("countryEvents.historyEffects")}</div>
                    {item.appliedEffects.slice(0, 4).map((effect, index) => (
                      <div key={`${item.eventId}:${item.resolvedTurnId}:${item.optionId}:effect:${index}`}>{formatHistoryEffect(effect, t)}</div>
                    ))}
                  </div>
                ) : null}
                {item.explanationIds.length > 0 ? (
                  <div className="mt-2 text-xs text-[var(--arc-color-text-muted)]">
                    {t("countryEvents.historyExplanations", { count: item.explanationIds.length })}
                  </div>
                ) : null}
              </AppCard>
            ))
          )}
        </div>
      ) : visibleEvents.length === 0 ? (
        <AppEmptyState title={t("countryEvents.empty")}>{t("countryEvents.emptyDescription")}</AppEmptyState>
      ) : (
        <div className="space-y-4">
          {visibleEvents.map((item) => (
            <AppCard key={item.pendingId} className="overflow-hidden p-0">
              <div className="grid min-h-[420px] lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)]">
                <div className="relative min-h-[220px] border-b border-[var(--arc-color-gold-soft)] bg-[var(--arc-color-panel-soft)] lg:border-b-0 lg:border-r lg:border-[var(--arc-color-gold-soft)]">
                  {item.logoUrl ? (
                    <img src={item.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full min-h-[220px] items-center justify-center bg-[radial-gradient(circle_at_50%_35%,color-mix(in_srgb,var(--arc-color-success-text)_20%,transparent),var(--arc-color-panel-soft)_68%)]">
                      <Sparkles size={72} className="text-[var(--arc-color-gold)] opacity-70" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--arc-overlay-45)] via-transparent to-[var(--arc-overlay-30)]" />
                  <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                    <span className="rounded-md border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-2 py-0.5 text-[11px] text-[var(--arc-color-text-soft)]">
                      {t(CATEGORY_LABEL_KEY[item.event.category] ?? "countryEvents.defaultEvent")}
                    </span>
                    {item.event.blocking ? (
                      <span className="rounded-md border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-2 py-0.5 text-[11px] text-[var(--arc-color-gold)]">
                        {t("countryEvents.important")}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="min-w-0 p-5">
                  <div className="text-2xl font-semibold text-[var(--arc-color-text)]">{eventTitle(item)}</div>
                  {eventDescription(item) ? <div className="mt-3 text-sm leading-6 text-[var(--arc-color-text-soft)]">{eventDescription(item)}</div> : null}
                  {(item.scopes?.region || (item.triggerExplanation?.length ?? 0) > 0) ? (
                    <div className="mt-4 rounded-md border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-20)] p-3 text-xs text-[var(--arc-color-text-muted)]">
                      {item.scopes?.region ? (
                        <div>
                          <span className="font-semibold text-[var(--arc-color-text-soft)]">{t("countryEvents.scopeRegion")}: </span>
                          {item.scopes.region.labelKey ? t(scenarioTextKey(item.scopes.region.labelKey)) : item.scopes.region.id}
                        </div>
                      ) : null}
                      {item.expiresTurnId != null ? (
                        <div className="mt-1">
                          {t("countryEvents.expiresTurn", { turn: item.expiresTurnId })}
                        </div>
                      ) : null}
                      {formatTriggerExplanation(item, t).map((line, index) => (
                        <div key={`${item.pendingId}:trigger:${index}`} className="mt-1">
                          {line}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-5 grid gap-3">
                    {(item.event.options ?? []).map((option) => {
                      const effects = formatEffects(option.effects, t);
                      const busy = choosingId === `${item.pendingId}:${option.id}`;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={Boolean(choosingId)}
                          onClick={() => chooseOption(item.pendingId, option.id)}
                          className="rounded-xl border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] p-3 text-left transition hover:border-[var(--arc-color-gold)] hover:bg-[var(--arc-overlay-45)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--arc-color-text)]">
                            <CheckCircle2 size={15} className="text-[var(--arc-color-gold)]" />
                            {busy ? t("common.pending") : t(scenarioTextKey(option.labelKey))}
                          </div>
                          {option.descriptionKey ? <div className="mt-1 text-xs text-[var(--arc-color-text-soft)]">{t(scenarioTextKey(option.descriptionKey))}</div> : null}
                          {effects.length > 0 ? <div className="mt-2 text-xs text-[var(--arc-color-text-muted)]">{effects.join(", ")}</div> : null}
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
