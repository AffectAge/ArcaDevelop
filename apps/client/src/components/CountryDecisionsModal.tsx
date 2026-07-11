import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Landmark, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import type { CountryDecisionRecord, ResourceTotals } from "@arcanorum/shared";
import { fetchCountryDecisions, takeCountryDecision, type CountryDecisionView } from "../lib/api";
import { formatGameEffectPreview } from "../lib/gameEffectPreview";
import { AppButton } from "./templates/AppButton";
import { AppModal, AppModalHeader } from "./templates/AppModal";
import { AppCard, AppEmptyState } from "./templates/AppSurface";
import { EventStoryModal } from "./templates/EventStoryModal";
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";

type Props = {
  open: boolean;
  token: string;
  countryId: string;
  onClose: () => void;
};

const RESOURCE_LABEL_KEY: Record<keyof ResourceTotals, UiTextKey> = {
  culture: "decisions.resource.culture",
  science: "decisions.resource.science",
  religion: "decisions.resource.religion",
  colonization: "decisions.resource.colonization",
  construction: "decisions.resource.construction",
  ducats: "decisions.resource.ducats",
  gold: "decisions.resource.gold",
};

const CATEGORY_LABEL_KEY: Record<string, UiTextKey> = {
  politics: "decisions.category.politics",
  economy: "decisions.category.economy",
  military: "decisions.category.military",
  diplomacy: "decisions.category.diplomacy",
  colonization: "decisions.category.colonization",
  culture: "decisions.category.culture",
  religion: "decisions.category.religion",
  technology: "decisions.category.technology",
};

const SCOPE_KIND_LABEL_KEY: Record<string, UiTextKey> = {
  country: "decisions.scope.country",
  region: "decisions.scope.region",
  building: "decisions.scope.building",
  pop: "decisions.scope.pop",
  interest_group: "decisions.scope.interestGroup",
  law: "decisions.scope.law",
  market: "decisions.scope.market",
  diplomatic_relation: "decisions.scope.diplomaticRelation",
  war: "decisions.scope.war",
  journal_entry: "decisions.scope.journalEntry",
};

function categoryLabel(category: string, t: (key: UiTextKey, params?: Record<string, string | number>) => string): string {
  const key = CATEGORY_LABEL_KEY[category];
  return key ? t(key) : category;
}

function formatResourceMap(values: Partial<ResourceTotals> | undefined, t: (key: UiTextKey, params?: Record<string, string | number>) => string) {
  return Object.entries(values ?? {})
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => {
      const labelKey = RESOURCE_LABEL_KEY[key as keyof ResourceTotals];
      return `${labelKey ? t(labelKey) : key}: ${value}`;
    });
}

function formatEffects(decision: CountryDecisionView["decision"], t: (key: UiTextKey, params?: Record<string, string | number>) => string) {
  return (decision.effects ?? []).map((effect) => formatGameEffectPreview(effect, t, RESOURCE_LABEL_KEY));
}

function formatDecisionReason(item: CountryDecisionView, t: (key: UiTextKey, params?: Record<string, string | number>) => string): string | null {
  const reason = item.reasons[0];
  if (!reason) return item.reason;
  const params: Record<string, string | number> = {};
  if (reason.currentValue != null) params.current = String(reason.currentValue);
  if (reason.requiredValue != null) params.required = String(reason.requiredValue);
  return t(reason.labelKey as UiTextKey, params);
}

function formatDecisionScopes(item: CountryDecisionView, t: (key: UiTextKey, params?: Record<string, string | number>) => string): string[] {
  return Object.entries(item.scopes ?? {}).map(([slot, scope]) => {
    const kindKey = SCOPE_KIND_LABEL_KEY[scope.kind] ?? "decisions.scope.object";
    return t("decisions.scopeLine", { slot, kind: t(kindKey), id: scope.id });
  });
}

function formatHistoryScopes(
  scopes: CountryDecisionRecord["history"][number]["scopes"] | undefined,
  t: (key: UiTextKey, params?: Record<string, string | number>) => string,
): string {
  const rows = Object.entries(scopes ?? {});
  if (rows.length === 0) return t("decisions.historyScopesNone");
  return rows
    .slice(0, 3)
    .map(([scopeId, scope]) => `${scopeId}: ${scope.labelKey ? t(scope.labelKey as UiTextKey) : scope.id}`)
    .join(", ");
}

function formatHistoryEffect(
  effect: CountryDecisionRecord["history"][number]["appliedEffects"][number],
  t: (key: UiTextKey, params?: Record<string, string | number>) => string,
): string {
  const resource = effect.resource ? t(RESOURCE_LABEL_KEY[effect.resource]) : "-";
  const amount = effect.amount == null ? "-" : String(effect.amount);
  const target = effect.eventId ?? effect.journalEntryId ?? effect.flagId ?? "-";
  return t("decisions.historyEffectLine", {
    type: effect.type,
    resource,
    amount,
    target,
  });
}

export function CountryDecisionsModal({ open, token, countryId, onClose }: Props) {
  const { t } = useUiText();
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
        if (!cancelled) toast.error(t("decisions.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryId, open, token, t]);

  const available = useMemo(() => decisions.filter((decision) => decision.available), [decisions]);
  const locked = useMemo(() => decisions.filter((decision) => !decision.available), [decisions]);

  const takeDecision = async (decisionId: string) => {
    setTakingId(decisionId);
    try {
      const result = await takeCountryDecision(token, countryId, decisionId);
      setDecisions(result.decisions);
      setRecord(result.record);
      setSelectedDecisionId(null);
      toast.success(t("decisions.taken"));
    } catch (error) {
      toast.error(t("decisions.takeFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setTakingId(null);
    }
  };

  const rows = tab === "available" ? available : locked;
  const selectedDecision = selectedDecisionId ? decisions.find((item) => item.id === selectedDecisionId) ?? null : null;

  return (
    <>
    <AppModal open={open} onClose={onClose} modalKey="decisions" zIndexClassName="z-[170]">
      <AppModalHeader title={t("decisions.title")} description={t("shell.action.decisionsDescription")} onClose={onClose} />

      <div className="mb-4 flex flex-wrap gap-2">
        <AppButton variant={tab === "available" ? "primary" : "ghost"} onClick={() => setTab("available")} icon={<CheckCircle2 size={14} />}>
          {t("decisions.available")}
        </AppButton>
        <AppButton variant={tab === "locked" ? "primary" : "ghost"} onClick={() => setTab("locked")} icon={<Clock size={14} />}>
          {t("decisions.locked")}
        </AppButton>
        <AppButton variant={tab === "history" ? "primary" : "ghost"} onClick={() => setTab("history")} icon={<RefreshCcw size={14} />}>
          {t("decisions.history")}
        </AppButton>
      </div>

      {loading ? (
        <AppEmptyState title={t("decisions.loading")}>{t("decisions.loadingDescription")}</AppEmptyState>
      ) : tab === "history" ? (
        <div className="space-y-2">
          {(record?.history ?? []).length === 0 ? (
            <AppEmptyState title={t("decisions.historyEmpty")}>{t("decisions.historyEmptyDescription")}</AppEmptyState>
          ) : (
            (record?.history ?? []).map((item) => (
              <AppCard key={`${item.decisionId}-${item.takenTurnId}`} className="p-3">
                <div className="text-sm font-semibold text-[var(--arc-color-text)]">{item.label}</div>
                <div className="mt-1 text-xs text-[var(--arc-color-text-muted)]">{t("decisions.turn", { turn: item.takenTurnId })}</div>
                <div className="mt-2 text-xs text-[var(--arc-color-text-soft)]">
                  {t("decisions.historyScopes", { scopes: formatHistoryScopes(item.scopes, t) })}
                </div>
                {item.appliedEffects.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs text-[var(--arc-color-text-soft)]">
                    <div className="font-semibold text-[var(--arc-color-text-soft)]">{t("decisions.historyEffects")}</div>
                    {item.appliedEffects.slice(0, 4).map((effect, index) => (
                      <div key={`${effect.type}-${index}`}>{formatHistoryEffect(effect, t)}</div>
                    ))}
                  </div>
                ) : null}
                {item.explanationIds.length > 0 ? (
                  <div className="mt-2 text-xs text-[var(--arc-color-text-muted)]">
                    {t("decisions.historyExplanations", { count: item.explanationIds.length })}
                  </div>
                ) : null}
              </AppCard>
            ))
          )}
        </div>
      ) : rows.length === 0 ? (
        <AppEmptyState title={t("decisions.emptyTitle")}>{tab === "available" ? t("decisions.emptyAvailable") : t("decisions.emptyLocked")}</AppEmptyState>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map((item) => {
            const costs = formatResourceMap(item.decision.costs, t);
            const effects = formatEffects(item.decision, t);
            const reason = formatDecisionReason(item, t);
            const scopes = formatDecisionScopes(item, t);
            return (
              <AppCard key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)]" style={{ color: item.color }}>
                        <Landmark size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--arc-color-text)]">{item.name}</div>
                        <div className="text-xs text-[var(--arc-color-text-muted)]">{categoryLabel(item.decision.category, t)}</div>
                      </div>
                    </div>
                    {item.description ? <div className="mt-3 text-sm leading-relaxed text-[var(--arc-color-text-soft)]">{item.description}</div> : null}
                  </div>
                  <AppButton disabled={takingId === item.id} onClick={() => setSelectedDecisionId(item.id)} variant={item.available ? "primary" : "ghost"}>
                    {t("decisions.open")}
                  </AppButton>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-[var(--arc-color-text-soft)] md:grid-cols-2">
                  <div className="rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] p-2">
                    <div className="mb-1 text-[var(--arc-color-text-muted)]">{t("decisions.cost")}</div>
                    {costs.length > 0 ? costs.join(", ") : t("decisions.none")}
                  </div>
                  <div className="rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] p-2">
                    <div className="mb-1 text-[var(--arc-color-text-muted)]">{t("decisions.effects")}</div>
                    {effects.length > 0 ? effects.join(", ") : t("decisions.none")}
                  </div>
                </div>
                {scopes.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] p-2 text-xs text-[var(--arc-color-text-soft)]">
                    <div className="mb-1 text-[var(--arc-color-text-muted)]">{t("decisions.scope")}</div>
                    {scopes.join(", ")}
                  </div>
                ) : null}
                {!item.available && reason ? <div className="mt-3 text-xs text-[var(--arc-color-warning-top)]">{reason}</div> : null}
              </AppCard>
            );
          })}
        </div>
      )}
    </AppModal>
    <EventStoryModal
      open={Boolean(selectedDecision)}
      onClose={() => setSelectedDecisionId(null)}
      title={selectedDecision?.name ?? t("decisions.title")}
      subtitle={selectedDecision ? t("decisions.storySubtitle", { category: categoryLabel(selectedDecision.decision.category, t) }) : null}
      body={selectedDecision?.description ?? null}
      imageUrl={selectedDecision?.logoUrl ?? null}
      imageCaption={selectedDecision?.name ?? null}
      categoryLabel={selectedDecision ? categoryLabel(selectedDecision.decision.category, t) : null}
      importantLabel={selectedDecision?.available ? null : selectedDecision ? formatDecisionReason(selectedDecision, t) ?? t("decisions.notAvailable") : null}
      accentColor={selectedDecision?.color ?? "#4ade80"}
      options={
        selectedDecision
          ? [
              {
                id: "take",
                label: selectedDecision.available ? t("decisions.take") : t("decisions.notAvailable"),
                description: formatDecisionReason(selectedDecision, t) ?? undefined,
                effects: [
                  ...formatResourceMap(selectedDecision.decision.costs, t).map((row) => `${t("decisions.cost")}: ${row}`),
                  ...formatEffects(selectedDecision.decision, t),
                  ...formatDecisionScopes(selectedDecision, t).map((row) => `${t("decisions.scope")}: ${row}`),
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
