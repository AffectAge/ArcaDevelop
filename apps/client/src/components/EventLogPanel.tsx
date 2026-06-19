import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EventCategory, EventCountryScope, EventLogEntry } from "@arcanorum/shared";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Coins,
  Flag,
  Gavel,
  Megaphone,
  Shield,
  Trash2,
  User,
  Users,
  Filter,
  ArrowUpDown,
  Scissors,
  Globe2,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { Tooltip } from "./Tooltip";
import { fetchCountries } from "../lib/api";
import type { UiTextKey } from "../i18n/uiText";
import { useUiText } from "../i18n/useUiText";

type Props = {
  entries: EventLogEntry[];
  currentCountryId?: string | null;
  onTrimOld: () => void;
  onClear: () => void;
};

const categories: Array<{ id: EventCategory; labelKey: UiTextKey; icon: LucideIcon; colorCls: string; accentCls: string }> = [
  { id: "system", labelKey: "shell.story.category.system", icon: Megaphone, colorCls: "text-[var(--arc-color-text-soft)]", accentCls: "bg-[var(--arc-color-text-soft)]" },
  { id: "colonization", labelKey: "shell.story.category.colonization", icon: Flag, colorCls: "text-[var(--arc-color-success-text)]", accentCls: "bg-[var(--arc-color-success-text)]" },
  { id: "politics", labelKey: "shell.story.category.politics", icon: Gavel, colorCls: "text-[var(--arc-color-gold)]", accentCls: "bg-[var(--arc-color-gold)]" },
  { id: "economy", labelKey: "shell.story.category.economy", icon: Coins, colorCls: "text-[var(--arc-color-gold-warm)]", accentCls: "bg-[var(--arc-color-gold-warm)]" },
  { id: "military", labelKey: "shell.story.category.military", icon: Shield, colorCls: "text-[var(--arc-color-danger-text)]", accentCls: "bg-[var(--arc-color-danger-text)]" },
  { id: "diplomacy", labelKey: "shell.story.category.diplomacy", icon: Globe2, colorCls: "text-[var(--arc-color-primary-top)]", accentCls: "bg-[var(--arc-color-primary-top)]" },
];

const priorityWeight = { low: 0, medium: 1, high: 2 } as const;
const allPriorityIds = ["low", "medium", "high"] as const;
const allCategoryIds = categories.map((c) => c.id);

const priorityMeta = {
  low: { labelKey: "shell.story.priority.low", tooltipKey: "eventLog.priorityLow", colorCls: "text-[var(--arc-color-text-soft)]", chipCls: "arc-hud-chip text-[var(--arc-color-text-paper)]" },
  medium: { labelKey: "shell.story.priority.medium", tooltipKey: "eventLog.priorityMedium", colorCls: "text-[var(--arc-color-warning-top)]", chipCls: "border-[var(--arc-color-warning-border)] bg-gradient-to-b from-[var(--arc-color-warning-top)] to-[var(--arc-color-warning-bottom)] text-[var(--arc-color-text-paper)]" },
  high: { labelKey: "shell.story.priority.high", tooltipKey: "eventLog.priorityHigh", colorCls: "text-[var(--arc-color-danger-text)]", chipCls: "border-[var(--arc-color-danger-border)] bg-gradient-to-b from-[var(--arc-color-danger-top)] to-[var(--arc-color-danger-bottom)] text-[var(--arc-color-danger-text)]" },
} as const;

const scopeOptions: Array<{ id: EventCountryScope; labelKey: UiTextKey }> = [
  { id: "all", labelKey: "eventLog.scope.all" },
  { id: "own", labelKey: "eventLog.scope.own" },
  { id: "foreign", labelKey: "eventLog.scope.foreign" },
];

function dedupeEntries(entries: EventLogEntry[]): Array<{ entry: EventLogEntry; count: number }> {
  const grouped = new Map<string, { entry: EventLogEntry; count: number }>();
  for (const entry of entries) {
    const key = [entry.turn, entry.category, entry.priority, entry.visibility, entry.countryId ?? "", entry.title ?? "", entry.message].join("|");
    const found = grouped.get(key);
    if (found) {
      found.count += 1;
      continue;
    }
    grouped.set(key, { entry, count: 1 });
  }
  return [...grouped.values()];
}

function IconBtn({
  icon: Icon,
  onClick,
  tooltip,
  tone = "default",
}: {
  icon: LucideIcon;
  onClick: () => void;
  tooltip: string;
  tone?: "default" | "danger";
}) {
  return (
    <Tooltip content={tooltip} placement="top">
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ y: -2, scale: 1.03 }}
        transition={{ type: "tween", duration: 0.12 }}
        className={`group relative overflow-hidden rounded-md p-2 transition ${
          tone === "danger"
            ? "border border-[var(--arc-color-danger-border)] bg-gradient-to-b from-[var(--arc-color-danger-top)] to-[var(--arc-color-danger-bottom)] text-[var(--arc-color-danger-text)] hover:brightness-110"
            : "arc-hud-button"
        }`}
      >
        <Icon size={15} className="relative z-10" />
      </motion.button>
    </Tooltip>
  );
}

function ScopeIcon({ scope }: { scope: EventCountryScope }) {
  if (scope === "all") {
    return <Users size={14} />;
  }
  if (scope === "own") {
    return <User size={14} />;
  }
  return <Globe2 size={14} />;
}

export function EventLogPanel({ entries, currentCountryId, onTrimOld, onClear }: Props) {
  const { t } = useUiText();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("arc.ui.eventLog.collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [sortMode, setSortMode] = useState<"time" | "priority">(() => {
    try {
      const raw = localStorage.getItem("arc.ui.eventLog.sortMode");
      return raw === "priority" ? "priority" : "time";
    } catch {
      return "time";
    }
  });
  const [countryScope, setCountryScope] = useState<EventCountryScope>(() => {
    try {
      const raw = localStorage.getItem("arc.ui.eventLog.countryScope");
      return raw === "own" || raw === "foreign" ? raw : "all";
    } catch {
      return "all";
    }
  });
  const [enabledCategories, setEnabledCategories] = useState<Set<EventCategory>>(() => {
    try {
      const raw = localStorage.getItem("arc.ui.eventLog.enabledCategories");
      if (!raw) return new Set(allCategoryIds);
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return new Set(allCategoryIds);
      const next = parsed.filter((v): v is EventCategory => allCategoryIds.includes(v as EventCategory));
      return new Set(next.length > 0 ? (["system", ...next.filter((v) => v !== "system")] as EventCategory[]) : allCategoryIds);
    } catch {
      return new Set(allCategoryIds);
    }
  });
  const [enabledPriorities, setEnabledPriorities] = useState<Set<keyof typeof priorityWeight>>(() => {
    try {
      const raw = localStorage.getItem("arc.ui.eventLog.enabledPriorities");
      if (!raw) return new Set(allPriorityIds);
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return new Set(allPriorityIds);
      const next = parsed.filter((v): v is keyof typeof priorityWeight => allPriorityIds.includes(v as keyof typeof priorityWeight));
      return new Set(next.length > 0 ? next : allPriorityIds);
    } catch {
      return new Set(allPriorityIds);
    }
  });
  const [groupDuplicates, setGroupDuplicates] = useState(() => {
    try {
      return localStorage.getItem("arc.ui.eventLog.groupDuplicates") !== "0";
    } catch {
      return true;
    }
  });
  const [expandedMessageKeys, setExpandedMessageKeys] = useState<Set<string>>(new Set());
  const [newEventsPulse, setNewEventsPulse] = useState(false);
  const [countriesById, setCountriesById] = useState<Record<string, { name: string; flagUrl?: string | null; color?: string }>>({});
  const prevEntriesCountRef = useRef(entries.length);
  const filteredAndGrouped = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (entry.visibility === "private" && entry.countryId && entry.countryId !== currentCountryId) {
        return false;
      }
      if (entry.category !== "system" && !enabledCategories.has(entry.category)) {
        return false;
      }
      if (!enabledPriorities.has(entry.priority)) {
        return false;
      }
      if (countryScope === "own") {
        return entry.countryId === currentCountryId;
      }
      if (countryScope === "foreign") {
        return Boolean(entry.countryId && entry.countryId !== currentCountryId);
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortMode === "priority") {
        const byPriority = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (byPriority !== 0) {
          return byPriority;
        }
      }
      return b.turn - a.turn || b.timestamp.localeCompare(a.timestamp);
    });

    if (!groupDuplicates) {
      return filtered.map((entry) => ({ entry, count: 1 }));
    }
    return dedupeEntries(filtered);
  }, [countryScope, currentCountryId, enabledCategories, enabledPriorities, entries, groupDuplicates, sortMode]);

  const toggleCategory = (category: EventCategory) => {
    if (category === "system") {
      return;
    }
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const togglePriority = (priority: keyof typeof priorityWeight) => {
    setEnabledPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(priority)) {
        next.delete(priority);
      } else {
        next.add(priority);
      }
      return next.size > 0 ? next : prev;
    });
  };

  const toggleMessageExpanded = (key: string) => {
    setExpandedMessageKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  useEffect(() => {
    if (entries.length > prevEntriesCountRef.current) {
      setNewEventsPulse(true);
      const t = window.setTimeout(() => setNewEventsPulse(false), 700);
      prevEntriesCountRef.current = entries.length;
      return () => window.clearTimeout(t);
    }
    prevEntriesCountRef.current = entries.length;
    return;
  }, [entries.length]);

  useEffect(() => {
    const scope = currentCountryId ?? "guest";
    try {
      setCollapsed(localStorage.getItem(`arc.ui.${scope}.eventLog.collapsed`) === "1");
      const savedSort = localStorage.getItem(`arc.ui.${scope}.eventLog.sortMode`);
      setSortMode(savedSort === "priority" ? "priority" : "time");
      const savedCountryScope = localStorage.getItem(`arc.ui.${scope}.eventLog.countryScope`);
      setCountryScope(savedCountryScope === "own" || savedCountryScope === "foreign" ? savedCountryScope : "all");
      const savedCategories = localStorage.getItem(`arc.ui.${scope}.eventLog.enabledCategories`);
      if (savedCategories) {
        const parsed = JSON.parse(savedCategories) as unknown;
        if (Array.isArray(parsed)) {
          const next = parsed.filter((v): v is EventCategory => allCategoryIds.includes(v as EventCategory));
          setEnabledCategories(new Set(next.length > 0 ? (["system", ...next.filter((v) => v !== "system")] as EventCategory[]) : allCategoryIds));
        }
      }
      const savedPriorities = localStorage.getItem(`arc.ui.${scope}.eventLog.enabledPriorities`);
      if (savedPriorities) {
        const parsed = JSON.parse(savedPriorities) as unknown;
        if (Array.isArray(parsed)) {
          const next = parsed.filter((v): v is keyof typeof priorityWeight => allPriorityIds.includes(v as keyof typeof priorityWeight));
          setEnabledPriorities(new Set(next.length > 0 ? next : allPriorityIds));
        }
      }
      setGroupDuplicates(localStorage.getItem(`arc.ui.${scope}.eventLog.groupDuplicates`) !== "0");
    } catch {
      // ignore
    }
  }, [currentCountryId]);

  useEffect(() => {
    try {
      localStorage.setItem(`arc.ui.${currentCountryId ?? "guest"}.eventLog.collapsed`, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed, currentCountryId]);

  useEffect(() => {
    try {
      localStorage.setItem(`arc.ui.${currentCountryId ?? "guest"}.eventLog.sortMode`, sortMode);
    } catch {
      // ignore
    }
  }, [currentCountryId, sortMode]);

  useEffect(() => {
    try {
      localStorage.setItem(`arc.ui.${currentCountryId ?? "guest"}.eventLog.countryScope`, countryScope);
    } catch {
      // ignore
    }
  }, [countryScope, currentCountryId]);

  useEffect(() => {
    try {
      localStorage.setItem(`arc.ui.${currentCountryId ?? "guest"}.eventLog.enabledCategories`, JSON.stringify([...enabledCategories]));
    } catch {
      // ignore
    }
  }, [currentCountryId, enabledCategories]);

  useEffect(() => {
    try {
      localStorage.setItem(`arc.ui.${currentCountryId ?? "guest"}.eventLog.enabledPriorities`, JSON.stringify([...enabledPriorities]));
    } catch {
      // ignore
    }
  }, [currentCountryId, enabledPriorities]);

  useEffect(() => {
    try {
      localStorage.setItem(`arc.ui.${currentCountryId ?? "guest"}.eventLog.groupDuplicates`, groupDuplicates ? "1" : "0");
    } catch {
      // ignore
    }
  }, [currentCountryId, groupDuplicates]);

  useEffect(() => {
    let cancelled = false;
    fetchCountries()
      .then((countries) => {
        if (cancelled) return;
        const map: Record<string, { name: string; flagUrl?: string | null; color?: string }> = {};
        for (const c of countries) {
          map[c.id] = { name: c.name, flagUrl: c.flagUrl, color: c.color };
        }
        setCountriesById(map);
      })
      .catch(() => {
        // keep graceful fallback to countryId text
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside
      className={`absolute right-4 z-[72] flex flex-col justify-end ${
        collapsed
          ? "pointer-events-none bottom-20 h-12 w-12"
          : "pointer-events-auto bottom-20 top-24 w-[min(400px,calc(100vw-1.5rem))]"
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {collapsed ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0, x: 12, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="pointer-events-auto flex justify-end"
          >
            <Tooltip content={t("eventLog.expand")} placement="left">
              <motion.button
                type="button"
                onClick={() => setCollapsed(false)}
                whileHover={{ y: -2, scale: 1.03 }}
                transition={{ type: "tween", duration: 0.12 }}
                className="arc-hud-button-solid group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl transition"
              >
                <ChevronLeft size={20} className="relative z-10" />
              </motion.button>
            </Tooltip>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, x: 12, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.985 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="arc-hud-panel arc-hud-panel--overflow-visible relative rounded-2xl p-3.5"
          >
            <div className="arc-hud-content mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="arc-hud-button-solid inline-flex h-8 w-8 items-center justify-center rounded-lg">
                  <Bell size={15} />
                </span>
                <div className="text-base font-semibold text-[var(--arc-color-text)]">{t("eventLog.title")}</div>
                <Tooltip content={t("eventLog.countTooltip")} placement="bottom">
                  <motion.span
                    animate={
                      newEventsPulse
                        ? { scale: [1, 1.09, 1], boxShadow: ["0 0 0 rgba(74,222,128,0)", "0 0 18px rgba(74,222,128,0.22)", "0 0 0 rgba(74,222,128,0)"] }
                        : { scale: 1, boxShadow: "0 0 0 rgba(0,0,0,0)" }
                    }
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    className="arc-hud-chip rounded-md px-2 py-0.5 text-xs"
                  >
                    {entries.length}
                  </motion.span>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1">
                <IconBtn icon={Scissors} onClick={onTrimOld} tooltip={t("eventLog.trimOld")} />
                <IconBtn
                  icon={ArrowUpDown}
                  onClick={() => setSortMode((s) => (s === "time" ? "priority" : "time"))}
                  tooltip={sortMode === "time" ? t("eventLog.sortTime") : t("eventLog.sortPriority")}
                />
                <IconBtn icon={Trash2} onClick={onClear} tooltip={t("eventLog.clear")} tone="danger" />
                <IconBtn icon={ChevronRight} onClick={() => setCollapsed(true)} tooltip={t("eventLog.collapse")} />
              </div>
            </div>

            <div className="arc-hud-content arc-hud-chip mb-3 rounded-xl p-2.5">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--arc-color-text-muted)]">
                <Filter size={13} />
                {t("eventLog.categories")}
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const enabled = cat.id === "system" || enabledCategories.has(cat.id);
                  const button = (
                    <motion.button
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      whileHover={cat.id === "system" ? undefined : { y: -2, scale: 1.04 }}
                      transition={{ type: "tween", duration: 0.12 }}
                      className={`group relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border transition ${
                        enabled
                          ? "border-[var(--arc-color-primary-border)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] text-[var(--arc-color-text)]"
                          : "arc-hud-button text-[var(--arc-color-text-muted)]"
                      } ${cat.id === "system" ? "cursor-default opacity-95" : "hover:text-[var(--arc-color-text)]"}`}
                    >
                      <Icon size={18} className={`relative z-10 ${enabled ? cat.colorCls : ""}`} />
                    </motion.button>
                  );

                  return (
                    <Tooltip key={cat.id} content={cat.id === "system" ? t("eventLog.systemAlwaysVisible") : t(cat.labelKey)} placement="top">
                      {button}
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            <div className="arc-hud-content arc-hud-chip mb-3 rounded-xl p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-[var(--arc-color-text-muted)]">{t("eventLog.priority")}</div>
                <Tooltip content={t("eventLog.groupDuplicatesTooltip")} placement="top">
                  <button
                    type="button"
                    onClick={() => setGroupDuplicates((v) => !v)}
                    className={`rounded-md border px-2 py-1 text-[10px] transition ${
                      groupDuplicates
                        ? "border-[var(--arc-color-success-border)] bg-gradient-to-b from-[var(--arc-color-success-top)] to-[var(--arc-color-success-bottom)] text-[var(--arc-color-success-text)]"
                        : "arc-hud-button"
                    }`}
                  >
                    {groupDuplicates ? t("eventLog.groupDuplicatesOn") : t("eventLog.groupDuplicatesOff")}
                  </button>
                </Tooltip>
              </div>
              <div className="flex flex-wrap gap-2">
                {allPriorityIds.map((priority) => {
                  const enabled = enabledPriorities.has(priority);
                  const meta = priorityMeta[priority];
                  return (
                    <Tooltip key={priority} content={t("eventLog.priorityTooltip", { priority: t(meta.labelKey).toLowerCase() })} placement="top">
                      <button
                        type="button"
                        onClick={() => togglePriority(priority)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                          enabled ? meta.chipCls : "arc-hud-button"
                        }`}
                      >
                        {t(meta.labelKey)}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            <div className="arc-hud-content arc-hud-chip mb-3 rounded-xl p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-[var(--arc-color-text-muted)]">{t("eventLog.countryScope")}</div>
                <div className="text-[10px] text-[var(--arc-color-text-muted)]">{t("eventLog.countryFilter")}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-toolbar)] p-1">
                {scopeOptions.map((scope) => (
                  <Tooltip key={scope.id} content={t("eventLog.scopeTooltip", { scope: t(scope.labelKey).toLowerCase() })} placement="top">
                    <motion.button
                      type="button"
                      onClick={() => setCountryScope(scope.id)}
                      whileHover={{ y: -2, scale: 1.02 }}
                      transition={{ type: "tween", duration: 0.12 }}
                      className={`group relative overflow-hidden rounded-lg px-2 py-2 text-sm transition ${
                        countryScope === scope.id
                          ? "border border-[var(--arc-color-primary-border)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] text-[var(--arc-color-text)]"
                          : "arc-hud-button"
                      }`}
                    >
                      <span className="relative z-10 flex flex-col items-center gap-1">
                        <ScopeIcon scope={scope.id} />
                        <span className="text-[11px] leading-none">{t(scope.labelKey)}</span>
                      </span>
                    </motion.button>
                  </Tooltip>
                ))}
              </div>
            </div>

            <div className="arc-hud-content arc-scrollbar max-h-[52vh] space-y-2 overflow-auto pr-1">
              {filteredAndGrouped.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="arc-hud-chip rounded-xl p-4 text-base">
                  {t("eventLog.empty")}
                </motion.div>
              ) : (
                <AnimatePresence initial={false}>
                  {filteredAndGrouped.map(({ entry, count }, idx) => {
                    const categoryMeta = categories.find((c) => c.id === entry.category) ?? categories[0];
                    const CatIcon = categoryMeta.icon;
                    const priorityCls =
                      entry.priority === "high"
                        ? "text-[var(--arc-color-danger-text)]"
                        : entry.priority === "medium"
                          ? "text-[var(--arc-color-warning-top)]"
                          : "text-[var(--arc-color-text-muted)]";
                    const categoryLabel = t(categoryMeta.labelKey);
                    const categoryAccent = categoryMeta.accentCls;
                    const localDate = new Date(entry.timestamp);
                    const messageKey = `${entry.id}-${entry.timestamp}-${count}`;
                    const isLongMessage = (entry.message?.length ?? 0) > 180;
                    const isMessageExpanded = expandedMessageKeys.has(messageKey);
                    return (
                      <motion.div
                        key={`${entry.id}-${count}`}
                        layout
                        initial={{ opacity: 0, y: 10, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.985 }}
                        transition={{ duration: 0.16, ease: "easeOut", delay: Math.min(idx * 0.015, 0.12) }}
                        className="arc-hud-chip group relative rounded-xl p-3 transition hover:border-[var(--arc-color-gold)]"
                      >
                        <span className={`pointer-events-none absolute inset-y-2 left-0.5 w-0.5 rounded-full ${categoryAccent} opacity-85`} />
                        <div className="mb-1.5 flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Tooltip content={t("eventLog.category", { category: categoryLabel })} placement="top">
                              <span className="inline-flex">
                                <CatIcon size={16} className={categoryMeta.colorCls} />
                              </span>
                            </Tooltip>
                            <Tooltip content={t("eventLog.turnTooltip", { turn: entry.turn })} placement="top">
                              <span className="text-xs text-[var(--arc-color-text-muted)]">{t("eventLog.turn", { turn: entry.turn })}</span>
                            </Tooltip>
                            {count > 1 && (
                              <Tooltip content={t("eventLog.duplicateCount")} placement="top">
                                <span className="rounded border border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-toolbar)] px-1.5 py-0.5 text-xs text-[var(--arc-color-text-paper)]">x{count}</span>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <Tooltip
                              content={
                                t(priorityMeta[entry.priority].tooltipKey)
                              }
                              placement="top"
                            >
                              <span className="inline-flex">
                                <Bell size={13} className={priorityCls} />
                              </span>
                            </Tooltip>
                            {entry.visibility === "private" && (
                              <Tooltip content={t("eventLog.privateTooltip")} placement="top">
                                <span className="inline-flex">
                                  <Lock size={13} className="text-[var(--arc-color-gold)]" />
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        </div>

                        {entry.title ? <div className="mb-1 pr-3 text-sm font-semibold leading-tight text-[var(--arc-color-text-paper)]">{entry.title}</div> : null}
                        <div className="pr-3">
                          <div className={`text-sm leading-relaxed text-[var(--arc-color-text-paper)] ${isLongMessage && !isMessageExpanded ? "line-clamp-3" : ""}`}>{entry.message}</div>
                          {isLongMessage && (
                            <Tooltip content={isMessageExpanded ? t("eventLog.hideMessage") : t("eventLog.expandMessage")} placement="top">
                              <button
                                type="button"
                                onClick={() => toggleMessageExpanded(messageKey)}
                                className="mt-1 text-xs font-semibold text-[var(--arc-color-primary-top)] transition hover:brightness-110"
                              >
                                {isMessageExpanded ? t("common.close") : t("eventLog.expandMessage")}
                              </button>
                            </Tooltip>
                          )}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-[var(--arc-color-text-muted)]">
                          <div className="flex items-center gap-2">
                            <Tooltip content={t("eventLog.category", { category: categoryLabel })} placement="top">
                              <span className={`inline-flex items-center gap-1 ${categoryMeta.colorCls}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${categoryAccent}`} />
                                {categoryLabel}
                              </span>
                            </Tooltip>
                            {entry.countryId ? (
                              <Tooltip
                                content={countriesById[entry.countryId]?.name ? t("eventLog.countryTooltip", { country: countriesById[entry.countryId].name }) : t("eventLog.countryFilter")}
                                placement="top"
                              >
                                <span className="inline-flex max-w-[10.5rem] items-center gap-1.5 rounded border border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-toolbar)] px-1.5 py-0.5 text-[var(--arc-color-text-paper)]">
                                  {countriesById[entry.countryId]?.flagUrl ? (
                                    <img
                                      src={countriesById[entry.countryId].flagUrl ?? undefined}
                                      alt=""
                                      className="h-3.5 w-5 rounded-[2px] object-cover"
                                    />
                                  ) : (
                                    <span
                                      className="h-3 w-3 rounded-full"
                                      style={{ backgroundColor: countriesById[entry.countryId]?.color ?? "var(--arc-color-text-muted)" }}
                                    />
                                  )}
                                  <span className="truncate">
                                    {countriesById[entry.countryId]?.name ?? entry.countryId}
                                  </span>
                                </span>
                              </Tooltip>
                            ) : null}
                          </div>
                          <Tooltip content={localDate.toLocaleString()} placement="top">
                            <span>{localDate.toLocaleTimeString()}</span>
                          </Tooltip>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
