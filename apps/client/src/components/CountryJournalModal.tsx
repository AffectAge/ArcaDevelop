import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Clock, History, ScrollText, XCircle } from "lucide-react";
import type { ActiveJournalEntry, CountryJournalState, EventTriggerExplanation, JournalEntryHistoryRecord } from "@arcanorum/shared";
import type { ContentEntry } from "../lib/api";
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";
import { AppButton } from "./templates/AppButton";
import { AppModal, AppModalHeader } from "./templates/AppModal";
import { AppCard, AppEmptyState } from "./templates/AppSurface";

type Props = {
  open: boolean;
  countryId: string;
  journalState: CountryJournalState | null | undefined;
  journalEntries: ContentEntry[];
  turnId: number;
  onClose: () => void;
};

const CATEGORY_KEY: Record<string, UiTextKey> = {
  politics: "countryJournal.category.politics",
  economy: "countryJournal.category.economy",
  military: "countryJournal.category.military",
  diplomacy: "countryJournal.category.diplomacy",
  colonization: "countryJournal.category.colonization",
  technology: "countryJournal.category.technology",
  society: "countryJournal.category.society",
  regional: "countryJournal.category.regional",
  crisis: "countryJournal.category.crisis",
};

const PRIORITY_KEY: Record<string, UiTextKey> = {
  low: "countryJournal.priority.low",
  medium: "countryJournal.priority.medium",
  high: "countryJournal.priority.high",
  critical: "countryJournal.priority.critical",
};

function scenarioTextKey(key: string | null | undefined): string {
  return key && key.trim() ? key : "";
}

function formatExplanationValue(value: string | number | boolean | null | undefined): string {
  if (value == null) return "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function CountryJournalModal({ open, countryId, journalState, journalEntries, turnId, onClose }: Props) {
  const { t } = useUiText();
  const [tab, setTab] = useState<"active" | "history">("active");
  const entryById = useMemo(() => new Map(journalEntries.map((entry) => [entry.id, entry] as const)), [journalEntries]);
  const active = journalState?.active ?? [];
  const history = journalState?.history ?? [];
  const criticalCount = active.filter((item) => entryById.get(item.journalEntryId)?.journalEntry?.priority === "critical").length;

  return (
    <AppModal open={open} onClose={onClose} modalKey="journal" zIndexClassName="z-[174]">
      <AppModalHeader
        title={t("countryJournal.title")}
        description={
          active.length > 0
            ? t("countryJournal.activeSummary", { count: active.length, critical: criticalCount })
            : t("countryJournal.description")
        }
        onClose={onClose}
      />

      <div className="relative z-10 mb-4 flex flex-wrap gap-2">
        <AppButton variant={tab === "active" ? "primary" : "ghost"} onClick={() => setTab("active")} icon={<ScrollText size={14} />}>
          {t("countryJournal.activeTab")}
        </AppButton>
        <AppButton variant={tab === "history" ? "primary" : "ghost"} onClick={() => setTab("history")} icon={<History size={14} />}>
          {t("countryJournal.historyTab")}
        </AppButton>
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === "active" ? (
          active.length === 0 ? (
            <AppEmptyState title={t("countryJournal.emptyActive")} icon={<BookOpen size={18} />}>
              {t("countryJournal.emptyActiveDescription")}
            </AppEmptyState>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {active.map((item) => (
                <ActiveJournalCard key={item.id} item={item} entry={entryById.get(item.journalEntryId)} turnId={turnId} />
              ))}
            </div>
          )
        ) : history.length === 0 ? (
          <AppEmptyState title={t("countryJournal.emptyHistory")} icon={<History size={18} />}>
            {t("countryJournal.emptyHistoryDescription")}
          </AppEmptyState>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <HistoryRow key={`${item.instanceId}:${item.resolvedTurnId}`} item={item} entry={entryById.get(item.journalEntryId)} />
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10 mt-3 text-xs text-[var(--arc-color-text-muted)]">
        {t("countryJournal.countryStateHint", { countryId })}
      </div>
    </AppModal>
  );
}

function ActiveJournalCard({ item, entry, turnId }: { item: ActiveJournalEntry; entry: ContentEntry | undefined; turnId: number }) {
  const { t } = useUiText();
  const journal = entry?.journalEntry ?? null;
  const title = journal ? t(scenarioTextKey(journal.titleKey)) : item.journalEntryId;
  const description = journal?.descriptionKey ? t(scenarioTextKey(journal.descriptionKey)) : null;
  const categoryKey = CATEGORY_KEY[journal?.category ?? "politics"] ?? "countryJournal.category.politics";
  const priorityKey = PRIORITY_KEY[journal?.priority ?? "medium"] ?? "countryJournal.priority.medium";
  const remainingTurns = item.expiresTurnId == null ? null : Math.max(0, item.expiresTurnId - turnId);
  const progressPercent = Math.min(100, Math.max(0, item.progress.percent));

  return (
    <AppCard className="min-h-[260px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--arc-color-text-muted)]">
            <span className="rounded-md border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-muted)] px-2 py-0.5">
              {t(categoryKey)}
            </span>
            <span className="rounded-md border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-muted)] px-2 py-0.5">
              {t(priorityKey)}
            </span>
          </div>
          <div className="mt-2 text-base font-semibold text-[var(--arc-color-text-paper)]">{title}</div>
        </div>
        {remainingTurns != null ? (
          <div className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-muted)] px-2 py-1 text-xs text-[var(--arc-color-text-muted)]">
            <Clock size={13} />
            {t("countryJournal.turnsRemaining", { turns: remainingTurns })}
          </div>
        ) : null}
      </div>

      {description ? <div className="mt-3 text-sm leading-6 text-[var(--arc-color-text-muted)]">{description}</div> : null}

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[var(--arc-color-text-muted)]">
          <span>{t(scenarioTextKey(item.progress.labelKey))}</span>
          <span>{t("countryJournal.progressValue", { current: item.progress.current, target: item.progress.target })}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-muted)]">
          <div className="h-full bg-[var(--arc-color-gold)]" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <ScopeBlock scopes={item.scopes} />
    </AppCard>
  );
}

function HistoryRow({ item, entry }: { item: JournalEntryHistoryRecord; entry: ContentEntry | undefined }) {
  const { t } = useUiText();
  const journal = entry?.journalEntry ?? null;
  const title = journal ? t(scenarioTextKey(journal.titleKey)) : item.journalEntryId;
  const Icon = item.state === "completed" ? CheckCircle2 : item.state === "failed" ? XCircle : Clock;
  const stateKey =
    item.state === "completed"
      ? "countryJournal.state.completed"
      : item.state === "failed"
        ? "countryJournal.state.failed"
        : "countryJournal.state.cancelled";

  return (
    <AppCard className="flex items-start gap-3">
      <div className="mt-0.5 rounded-md border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-muted)] p-2 text-[var(--arc-color-text-muted)]">
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[var(--arc-color-text-paper)]">{title}</div>
        <div className="mt-1 text-xs text-[var(--arc-color-text-muted)]">
          {t("countryJournal.historyMeta", {
            state: t(stateKey),
            started: item.startedTurnId,
            resolved: item.resolvedTurnId,
          })}
        </div>
        <ScopeBlock scopes={item.scopes} compact />
      </div>
    </AppCard>
  );
}

function ScopeBlock({ scopes, compact = false }: { scopes: ActiveJournalEntry["scopes"]; compact?: boolean }) {
  const { t } = useUiText();
  const rows = Object.entries(scopes ?? {}).filter(([key]) => key !== "root");
  if (rows.length === 0) return null;
  return (
    <div className={compact ? "mt-2 text-xs text-[var(--arc-color-text-muted)]" : "mt-4 rounded-md border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-muted)] p-2 text-xs text-[var(--arc-color-text-muted)]"}>
      {rows.map(([key, scope]) => (
        <div key={`${key}:${scope.id}`}>
          <span className="font-semibold text-[var(--arc-color-text-paper)]">{t("countryJournal.scope")}: </span>
          {scope.labelKey ? t(scenarioTextKey(scope.labelKey)) : scope.id}
        </div>
      ))}
    </div>
  );
}

export function formatJournalTriggerExplanations(
  explanations: EventTriggerExplanation[],
  t: (key: string, params?: Record<string, string | number>) => string,
): string[] {
  return explanations.slice(0, 4).map((explanation) =>
    t("countryJournal.explanationLine", {
      label: t(explanation.labelKey),
      value: formatExplanationValue(explanation.value),
      threshold: formatExplanationValue(explanation.threshold),
    }),
  );
}
