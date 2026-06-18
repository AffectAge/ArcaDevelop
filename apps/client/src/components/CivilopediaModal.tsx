import {
  BookOpen,
  Flag,
  Globe,
  Landmark,
  ListChecks,
  Plus,
  Save,
  Search,
  Timer,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  fetchAdminCivilopedia,
  fetchCivilopedia,
  type CivilopediaEntry,
  updateAdminCivilopedia,
  uploadCivilopediaImage,
  uploadCivilopediaInlineImage,
} from "../lib/api";
import { AppButton } from "./ui/AppButton";
import { AppInput } from "./ui/AppForm";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState, AppSection, AppSectionHeader } from "./ui/AppSurface";
import type { UiTextKey } from "../i18n/uiText";
import { useUiText } from "../i18n/useUiText";

type Props = {
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  adminToken?: string | null;
  initialIntent?:
    | { type: "open-entry"; entryId: string }
    | { type: "province"; provinceId: string; provinceName: string; createIfMissing: boolean }
    | null;
  onIntentHandled?: () => void;
};

type KnownCategoryId = "basics" | "colonization" | "map" | "turns" | "journal" | "economy";

const CATEGORY_META: Record<KnownCategoryId, { labelKey: UiTextKey; icon: LucideIcon }> = {
  basics: { labelKey: "civilopedia.category.basics", icon: BookOpen },
  colonization: { labelKey: "civilopedia.category.colonization", icon: Flag },
  map: { labelKey: "civilopedia.category.map", icon: Globe },
  turns: { labelKey: "civilopedia.category.turns", icon: Timer },
  journal: { labelKey: "civilopedia.category.journal", icon: ListChecks },
  economy: { labelKey: "civilopedia.category.economy", icon: Landmark },
};

const categoryOrder: KnownCategoryId[] = ["basics", "colonization", "map", "turns", "journal", "economy"];

function getCategoryMeta(category: string): { labelKey?: UiTextKey; label?: string; icon: LucideIcon } {
  return CATEGORY_META[category as KnownCategoryId] ?? { label: category, labelKey: category ? undefined : "civilopedia.category.other", icon: BookOpen };
}

type Translator = (key: UiTextKey, params?: Record<string, string | number>) => string;

function makeEmptyEntry(t: Translator): CivilopediaEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2, 10)}`,
    category: "basics",
    title: t("civilopedia.admin.defaultArticleTitle"),
    summary: "",
    keywords: [],
    imageUrl: null,
    relatedEntryIds: [],
    sections: [{ title: t("civilopedia.admin.defaultSectionTitle"), paragraphs: [""] }],
  };
}

type DraftState = {
  id: string;
  category: string;
  title: string;
  summary: string;
  keywordsCsv: string;
  relatedCsv: string;
  imageUrl: string;
  sectionsJson: string;
};

function toDraft(entry: CivilopediaEntry): DraftState {
  return {
    id: entry.id,
    category: entry.category,
    title: entry.title,
    summary: entry.summary,
    keywordsCsv: entry.keywords.join(", "),
    relatedCsv: entry.relatedEntryIds.join(", "),
    imageUrl: entry.imageUrl ?? "",
    sectionsJson: JSON.stringify(entry.sections, null, 2),
  };
}

function fromDraft(draft: DraftState, fallback: CivilopediaEntry | undefined, t: Translator): CivilopediaEntry {
  let sections = fallback?.sections ?? [{ title: t("civilopedia.admin.defaultSectionTitle"), paragraphs: [""] }];
  try {
    const parsed = JSON.parse(draft.sectionsJson) as unknown;
    if (Array.isArray(parsed)) {
      const normalized = parsed
        .map((raw) => {
          if (!raw || typeof raw !== "object") return null;
          const r = raw as Record<string, unknown>;
          const title = typeof r.title === "string" && r.title.trim() ? r.title.trim() : t("civilopedia.admin.defaultSectionTitle");
          const paragraphs = Array.isArray(r.paragraphs)
            ? r.paragraphs.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter(Boolean)
            : [];
          if (paragraphs.length === 0) return null;
          return { title, paragraphs };
        })
        .filter((v): v is { title: string; paragraphs: string[] } => Boolean(v));
      if (normalized.length > 0) sections = normalized;
    }
  } catch {
    // keep previous sections
  }
  return {
    id: draft.id.trim() || fallback?.id || makeEmptyEntry(t).id,
    category: draft.category.trim() || "basics",
    title: draft.title.trim() || t("civilopedia.admin.untitled"),
    summary: draft.summary.trim(),
    keywords: draft.keywordsCsv
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    imageUrl: draft.imageUrl.trim() || null,
    relatedEntryIds: draft.relatedCsv
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    sections,
  };
}

export function CivilopediaModal({
  open,
  onClose,
  isAdmin = false,
  adminToken = null,
  initialIntent = null,
  onIntentHandled,
}: Props) {
  const { t } = useUiText();
  const [entries, setEntries] = useState<CivilopediaEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("basics");
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loadedSessionKey, setLoadedSessionKey] = useState<string | null>(null);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [inlineTokenHint, setInlineTokenHint] = useState("");

  const sessionKey = isAdmin && adminToken ? `admin:${adminToken}` : "public";

  useEffect(() => {
    if (!open) return;
    if (loadedSessionKey === sessionKey && entries.length > 0) return;
    let cancelled = false;
    setLoading(true);
    const loader = isAdmin && adminToken ? fetchAdminCivilopedia(adminToken) : fetchCivilopedia();
    loader
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries);
        setCategories(data.categories);
        setLoadedSessionKey(sessionKey);
        if (data.entries.length > 0) {
          setSelectedEntryId((prev) => prev || data.entries[0].id);
          setActiveCategory((prev) => prev || data.entries[0].category);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error(t("civilopedia.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isAdmin, adminToken, loadedSessionKey, sessionKey, entries.length, t]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (activeCategory && entry.category !== activeCategory) return false;
      if (!q) return true;
      const hay = [entry.id, entry.title, entry.summary, ...entry.keywords].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [entries, activeCategory, query]);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedEntryId) ?? filteredEntries[0] ?? entries[0] ?? null,
    [entries, filteredEntries, selectedEntryId],
  );

  useEffect(() => {
    if (!open || !selectedEntry) return;
    setDraft((prev) => (prev && prev.id === selectedEntry.id ? prev : toDraft(selectedEntry)));
  }, [open, selectedEntry]);

  const relatedEntries = useMemo(() => {
    if (!selectedEntry) return [];
    const byId = new Map(entries.map((e) => [e.id, e]));
    return selectedEntry.relatedEntryIds.map((id) => byId.get(id)).filter((v): v is CivilopediaEntry => Boolean(v));
  }, [entries, selectedEntry]);

  const groupedCategories = useMemo(() => {
    const all = new Set(categories);
    for (const e of entries) all.add(e.category);
    for (const id of categoryOrder) all.add(id);
    return [...all];
  }, [categories, entries]);

  const persistEntries = async (nextEntries: CivilopediaEntry[], nextCategories = categories) => {
    if (!isAdmin || !adminToken) return;
    setSaving(true);
    try {
      const result = await updateAdminCivilopedia(adminToken, { categories: nextCategories, entries: nextEntries });
      setEntries(result.entries);
      setCategories(result.categories);
      toast.success(t("civilopedia.admin.saved"));
    } catch (error) {
      toast.error(t("civilopedia.admin.saveFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const saveSelectedDraft = async () => {
    if (!draft || !selectedEntry) return;
    const nextEntry = fromDraft(draft, selectedEntry, t);
    const nextEntries = entries.map((entry) => (entry.id === selectedEntry.id ? nextEntry : entry));
    await persistEntries(nextEntries);
    setSelectedEntryId(nextEntry.id);
  };

  const createEntry = async () => {
    const next = makeEmptyEntry(t);
    const nextEntries = [next, ...entries];
    setEntries(nextEntries);
    setSelectedEntryId(next.id);
    setActiveCategory(next.category);
    setDraft(toDraft(next));
    if (isAdmin && adminToken) {
      await persistEntries(nextEntries);
    }
  };

  const deleteSelectedEntry = async () => {
    if (!selectedEntry) return;
    const nextEntries = entries.filter((entry) => entry.id !== selectedEntry.id);
    setEntries(nextEntries);
    setSelectedEntryId(nextEntries[0]?.id ?? "");
    if (isAdmin && adminToken) {
      await persistEntries(nextEntries);
    }
  };

  const uploadImageForSelected = async (file: File) => {
    if (!isAdmin || !adminToken || !draft) return;
    try {
      const result = await uploadCivilopediaImage(adminToken, file);
      setDraft({ ...draft, imageUrl: result.imageUrl });
      toast.success(t("civilopedia.admin.uploadedImage"));
    } catch (error) {
      toast.error(t("civilopedia.admin.uploadImageFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const uploadInlineImage = async (file: File) => {
    if (!isAdmin || !adminToken) return;
    try {
      const result = await uploadCivilopediaInlineImage(adminToken, file);
      const token = `[img:${result.imageUrl}|64]`;
      setInlineTokenHint(token);
      toast.success(t("civilopedia.admin.uploadedInlineImage"), {
        description: t("civilopedia.admin.inlineImageDescription"),
      });
    } catch (error) {
      toast.error(t("civilopedia.admin.uploadInlineImageFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  useEffect(() => {
    if (!open || loading || !initialIntent) return;
    if (entries.length === 0 && !(initialIntent.type === "province" && initialIntent.createIfMissing && isAdmin)) return;

    const handle = async () => {
      if (initialIntent.type === "open-entry") {
        const found = entries.find((e) => e.id === initialIntent.entryId);
        if (found) {
          setActiveCategory(found.category);
          setSelectedEntryId(found.id);
        }
        onIntentHandled?.();
        return;
      }

      const provinceArticleId = `province:${initialIntent.provinceId}`;
      const existing = entries.find((e) => e.id === provinceArticleId);
      if (existing) {
        setActiveCategory(existing.category);
        setSelectedEntryId(existing.id);
        onIntentHandled?.();
        return;
      }

      if (!initialIntent.createIfMissing || !isAdmin || !adminToken) {
        toast.error(t("civilopedia.admin.provinceArticleMissing"));
        onIntentHandled?.();
        return;
      }

      const category = t("civilopedia.admin.provinceCategory");
      const nextEntry: CivilopediaEntry = {
        id: provinceArticleId,
        category,
        title: t("civilopedia.admin.provinceDefaultTitle", { province: initialIntent.provinceName }),
        summary: t("civilopedia.admin.provinceDefaultSummary", { province: initialIntent.provinceName }),
        keywords: [t("modifiers.scope.province").toLowerCase(), initialIntent.provinceName, initialIntent.provinceId],
        imageUrl: null,
        relatedEntryIds: ["map-modes", "colonization-race"],
        sections: [
          {
            title: t("civilopedia.admin.defaultSectionTitle"),
            paragraphs: [
              `${t("modifiers.scope.province")}: [color:#67e8f9]${initialIntent.provinceName}[/color]`,
              t("civilopedia.admin.provinceIdLine", { provinceId: initialIntent.provinceId }),
              t("civilopedia.admin.provinceDefaultBody"),
            ],
          },
        ],
      };
      const nextEntries = [nextEntry, ...entries];
      const nextCategories = categories.includes(category) ? categories : [...categories, category];
      setEntries(nextEntries);
      setCategories(nextCategories);
      setActiveCategory(category);
      setSelectedEntryId(nextEntry.id);
      setDraft(toDraft(nextEntry));
      await persistEntries(nextEntries, nextCategories);
      onIntentHandled?.();
    };

    void handle();
  }, [open, loading, initialIntent, entries, isAdmin, adminToken, categories, onIntentHandled, t]);

  const addCategory = async () => {
    const value = newCategoryInput.trim();
    if (!value) return;
    if (categories.includes(value)) {
      setActiveCategory(value);
      setNewCategoryInput("");
      return;
    }
    const nextCategories = [...categories, value];
    setCategories(nextCategories);
    setActiveCategory(value);
    setNewCategoryInput("");
    if (isAdmin && adminToken) {
      await persistEntries(entries, nextCategories);
    }
  };

  const removeCategory = async (category: string) => {
    if (entries.some((e) => e.category === category)) {
      toast.error(t("civilopedia.admin.removeCategoryBlocked"), { description: t("civilopedia.admin.removeCategoryBlockedDescription") });
      return;
    }
    const nextCategories = categories.filter((c) => c !== category);
    setCategories(nextCategories);
    if (activeCategory === category) {
      setActiveCategory(nextCategories[0] ?? "basics");
    }
    if (isAdmin && adminToken) {
      await persistEntries(entries, nextCategories);
    }
  };

  const renderInlineParagraph = (text: string) => {
    const nodes: ReactNode[] = [];
    let remaining = text;
    let key = 0;
    const tokenRegex = /\[img:([^\]|]+)(?:\|(\d{1,3}))?\]|\[color:(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\]([\s\S]*?)\[\/color\]/;
    while (remaining.length > 0) {
      const match = tokenRegex.exec(remaining);
      if (!match || match.index < 0) {
        nodes.push(<Fragment key={`t-${key++}`}>{remaining}</Fragment>);
        break;
      }
      if (match.index > 0) {
        nodes.push(<Fragment key={`t-${key++}`}>{remaining.slice(0, match.index)}</Fragment>);
      }
      if (match[1]) {
        const url = match[1];
        const size = Math.max(12, Math.min(64, Number(match[2] || 64)));
        nodes.push(
          <img
            key={`img-${key++}`}
            src={url}
            alt=""
            className="mx-1 inline-block rounded align-middle object-cover"
            style={{ width: size, height: size }}
          />,
        );
      } else if (match[3]) {
        nodes.push(
          <span key={`c-${key++}`} style={{ color: match[3] }} className="font-medium">
            {match[4]}
          </span>,
        );
      }
      remaining = remaining.slice(match.index + match[0].length);
    }
    return nodes;
  };

  return (
    <AppModal open={open} onClose={onClose} modalKey="civilopedia" zIndexClassName="z-[128]" paddingClassName="p-4" panelClassName="rounded-none">
            <AppModalHeader
              title={t("civilopedia.title")}
              description={t("civilopedia.description")}
              onClose={onClose}
              actions={
                <>
                {isAdmin && (
                  <AppButton
                    type="button"
                    onClick={() => setAdminEditMode((v) => !v)}
                    variant={adminEditMode ? "danger" : "secondary"}
                    size="sm"
                  >
                    {adminEditMode ? t("civilopedia.editMode") : t("civilopedia.edit")}
                  </AppButton>
                )}
                </>
              }
            />

            <div className={`grid h-[calc(100vh-92px)] gap-4 ${adminEditMode && isAdmin ? "xl:grid-cols-[220px_320px_1fr_360px]" : "lg:grid-cols-[220px_320px_1fr]"}`}>
              <AppSection className="arc-scrollbar overflow-auto p-2">
                {groupedCategories.map((category) => {
                  const meta = getCategoryMeta(category);
                  const Icon = meta.icon;
                  const active = activeCategory === category;
                  const label = meta.labelKey ? t(meta.labelKey) : meta.label;
                  return (
                    <AppButton
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      variant={active ? "primary" : "ghost"}
                      size="md"
                      className="mb-2 w-full justify-start"
                      icon={<Icon size={15} />}
                    >
                      {label}
                    </AppButton>
                  );
                })}
              </AppSection>

              <AppSection className="arc-scrollbar overflow-auto p-3">
                <div className="mb-3 relative">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--arc-color-text-muted)]" />
                  <AppInput
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("civilopedia.searchPlaceholder")}
                    className="pl-9"
                  />
                </div>
                {adminEditMode && isAdmin && (
                  <AppButton onClick={createEntry} disabled={saving} variant="primary" size="sm" className="mb-3" icon={<Plus size={14} />}>
                    {t("civilopedia.newArticle")}
                  </AppButton>
                )}
                <div className="space-y-2">
                  {loading ? (
                    <AppEmptyState>{t("civilopedia.loading")}</AppEmptyState>
                  ) : filteredEntries.length === 0 ? (
                    <AppEmptyState>{t("civilopedia.noResults")}</AppEmptyState>
                  ) : (
                    filteredEntries.map((entry) => {
                      const active = selectedEntry?.id === entry.id;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setSelectedEntryId(entry.id)}
                          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                            active ? "border-[var(--arc-color-gold)] bg-[var(--arc-overlay-30)]" : "border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] hover:border-[var(--arc-color-gold)] hover:bg-[var(--arc-overlay-45)]"
                          }`}
                        >
                          <div className={`text-sm font-semibold ${active ? "text-[var(--arc-color-gold)]" : "text-[var(--arc-color-text)]"}`}>{entry.title}</div>
                          <div className="mt-1 text-xs text-[var(--arc-color-text-soft)]">{entry.summary}</div>
                          <div className="mt-2 text-[10px] text-[var(--arc-color-text-muted)]">{entry.id}</div>
                        </button>
                      );
                    })
                  )}
                </div>
              </AppSection>

              <AppSection className="arc-scrollbar overflow-auto p-4">
                {selectedEntry ? (
                  <div>
                    <AppSectionHeader
                      title={(() => {
                        const meta = getCategoryMeta(selectedEntry.category);
                        return meta.labelKey ? t(meta.labelKey) : meta.label;
                      })()}
                      icon={(() => {
                        const Icon = getCategoryMeta(selectedEntry.category).icon;
                        return <Icon size={14} />;
                      })()}
                    />
                    <h2 className="font-display text-2xl tracking-wide text-[var(--arc-color-text)]">{selectedEntry.title}</h2>
                    <p className="mt-2 text-sm text-[var(--arc-color-text-soft)]">{selectedEntry.summary}</p>

                    {selectedEntry.imageUrl && (
                      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)]">
                        <img src={selectedEntry.imageUrl} alt="" className="max-h-[260px] w-full object-cover" />
                      </div>
                    )}

                    {selectedEntry.keywords.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedEntry.keywords.map((keyword) => (
                          <button
                            key={keyword}
                            type="button"
                            onClick={() => setQuery(keyword)}
                            className="rounded-full border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-2 py-1 text-xs text-[var(--arc-color-text-soft)] hover:border-[var(--arc-color-gold)] hover:text-[var(--arc-color-gold)]"
                          >
                            #{keyword}
                          </button>
                        ))}
                      </div>
                    )}

                    {relatedEntries.length > 0 && (
                      <AppCard className="mt-4 bg-[var(--arc-overlay-30)]">
                        <div className="mb-2 text-xs uppercase tracking-wide text-[var(--arc-color-text-muted)]">{t("civilopedia.related")}</div>
                        <div className="flex flex-wrap gap-2">
                          {relatedEntries.map((related) => (
                            <button
                              key={related.id}
                              type="button"
                              onClick={() => {
                                setActiveCategory(related.category);
                                setSelectedEntryId(related.id);
                              }}
                              className="rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-2 py-1 text-xs text-[var(--arc-color-gold)] hover:bg-[var(--arc-overlay-45)]"
                            >
                              {related.title}
                            </button>
                          ))}
                        </div>
                      </AppCard>
                    )}

                    <div className="mt-5 space-y-4">
                      {selectedEntry.sections.map((section) => (
                        <AppSection key={`${selectedEntry.id}-${section.title}`} className="p-4">
                          <h3 className="mb-2 text-sm font-semibold text-[var(--arc-color-gold)]">{section.title}</h3>
                          <div className="space-y-2 text-sm leading-relaxed text-[var(--arc-color-text-soft)]">
                            {section.paragraphs.map((paragraph, idx) => (
                              <p key={idx}>{renderInlineParagraph(paragraph)}</p>
                            ))}
                          </div>
                        </AppSection>
                      ))}
                    </div>
                  </div>
                ) : (
                  <AppEmptyState className="flex h-full items-center justify-center">{t("civilopedia.emptySelection")}</AppEmptyState>
                )}
              </AppSection>

              {adminEditMode && isAdmin && (
                <AppSection className="arc-scrollbar overflow-auto p-4">
                  {draft ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] p-3">
                        <div className="mb-2 text-xs text-[var(--arc-color-text-soft)]">{t("civilopedia.admin.categoryTitle")}</div>
                        <div className="mb-2 flex flex-wrap gap-2">
                          {categories.map((category) => (
                            <div key={category} className="inline-flex items-center gap-1 rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-2 py-1 text-xs text-[var(--arc-color-text-soft)]">
                              <button type="button" onClick={() => setActiveCategory(category)} className="hover:text-[var(--arc-color-gold)]">
                                {category}
                              </button>
                              <button
                                type="button"
                                onClick={() => void removeCategory(category)}
                                className="text-[var(--arc-color-danger-text)] hover:brightness-110"
                                title={t("civilopedia.admin.deleteCategory")}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={newCategoryInput}
                            onChange={(e) => setNewCategoryInput(e.target.value)}
                            placeholder={t("civilopedia.admin.categoryInputPlaceholder")}
                            className="w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 text-sm text-[var(--arc-color-text)] outline-none placeholder:text-[var(--arc-color-text-muted)] focus:border-[var(--arc-color-gold)]"
                          />
                          <button onClick={() => void addCategory()} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--arc-color-success-border)] bg-gradient-to-b from-[var(--arc-color-success-top)] to-[var(--arc-color-success-bottom)] px-3 text-xs text-[var(--arc-color-success-text)]">
                            <Plus size={13} />
                            {t("civilopedia.admin.addCategory")}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[var(--arc-color-text)]">{t("civilopedia.admin.articleEditor")}</div>
                        {selectedEntry && (
                          <button onClick={deleteSelectedEntry} disabled={saving} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--arc-color-danger-border)] bg-gradient-to-b from-[var(--arc-color-danger-top)] to-[var(--arc-color-danger-bottom)] text-[var(--arc-color-danger-text)] disabled:opacity-60">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[var(--arc-color-text-soft)]">ID</label>
                        <input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} className="w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 text-sm text-[var(--arc-color-text)] outline-none focus:border-[var(--arc-color-gold)]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[var(--arc-color-text-soft)]">{t("civilopedia.admin.category")}</label>
                        <div className="flex gap-2">
                          <select
                            value={draft.category}
                            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                            className="w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 text-sm text-[var(--arc-color-text)] outline-none focus:border-[var(--arc-color-gold)]"
                          >
                            {groupedCategories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                          <input
                            value={draft.category}
                            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                            className="w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 text-sm text-[var(--arc-color-text)] outline-none placeholder:text-[var(--arc-color-text-muted)] focus:border-[var(--arc-color-gold)]"
                            placeholder={t("civilopedia.admin.categoryManualPlaceholder")}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[var(--arc-color-text-soft)]">{t("civilopedia.admin.title")}</label>
                        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 text-sm text-[var(--arc-color-text)] outline-none focus:border-[var(--arc-color-gold)]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[var(--arc-color-text-soft)]">{t("civilopedia.admin.description")}</label>
                        <textarea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} rows={3} className="w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 text-sm text-[var(--arc-color-text)] outline-none focus:border-[var(--arc-color-gold)]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[var(--arc-color-text-soft)]">{t("civilopedia.admin.keywords")}</label>
                        <input value={draft.keywordsCsv} onChange={(e) => setDraft({ ...draft, keywordsCsv: e.target.value })} className="w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 text-sm text-[var(--arc-color-text)] outline-none focus:border-[var(--arc-color-gold)]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[var(--arc-color-text-soft)]">{t("civilopedia.admin.relatedCsv")}</label>
                        <input value={draft.relatedCsv} onChange={(e) => setDraft({ ...draft, relatedCsv: e.target.value })} className="w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 text-sm text-[var(--arc-color-text)] outline-none focus:border-[var(--arc-color-gold)]" />
                      </div>
                      <div className="rounded-xl border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] p-3">
                        <div className="mb-2 text-xs text-[var(--arc-color-text-soft)]">{t("civilopedia.admin.articleImage")}</div>
                        <div className="mb-2 text-[11px] text-[var(--arc-color-text-muted)]">{t("civilopedia.admin.articleImageHint")}</div>
                        {draft.imageUrl ? (
                          <img src={draft.imageUrl} alt="" className="mb-2 max-h-32 w-full rounded-lg object-cover" />
                        ) : (
                          <div className="mb-2 flex h-20 items-center justify-center rounded-lg border border-dashed border-[var(--arc-color-gold-soft)] text-xs text-[var(--arc-color-text-muted)]">
                            {t("civilopedia.admin.noImage")}
                          </div>
                        )}
                        <input
                          type="text"
                          value={draft.imageUrl}
                          onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                          placeholder={t("civilopedia.admin.urlPlaceholder")}
                          className="mb-2 w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 text-sm text-[var(--arc-color-text)] outline-none placeholder:text-[var(--arc-color-text-muted)] focus:border-[var(--arc-color-gold)]"
                        />
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-3 py-2 text-xs text-[var(--arc-color-text-soft)] hover:bg-[var(--arc-overlay-45)]">
                          <Upload size={13} />
                          {t("civilopedia.admin.upload")}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void uploadImageForSelected(file);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>
                      <div className="rounded-xl border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] p-3">
                        <div className="mb-2 text-xs text-[var(--arc-color-text-soft)]">{t("civilopedia.admin.inlineImage")}</div>
                        <div className="mb-2 text-[11px] text-[var(--arc-color-text-muted)]">{t("civilopedia.admin.inlineImageLimit")}</div>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-3 py-2 text-xs text-[var(--arc-color-text-soft)] hover:bg-[var(--arc-overlay-45)]">
                          <Upload size={13} />
                          {t("civilopedia.admin.inlineUpload")}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void uploadInlineImage(file);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                        <div className="mt-2 text-[11px] text-[var(--arc-color-text-muted)]">
                          {t("civilopedia.admin.inlineHint")}
                        </div>
                        <div className="mt-1 text-[11px] text-[var(--arc-color-text-muted)]">
                          {t("civilopedia.admin.uploadInlineImageHint")}
                        </div>
                        {inlineTokenHint && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(inlineTokenHint).catch(() => undefined);
                              toast.success(t("civilopedia.admin.copiedToken"));
                            }}
                            className="mt-2 block w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 text-left font-mono text-[11px] text-[var(--arc-color-success-text)] hover:border-[var(--arc-color-gold)]"
                          >
                            {inlineTokenHint}
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[var(--arc-color-text-soft)]">{t("civilopedia.admin.sectionsJson")}</label>
                        <textarea
                          value={draft.sectionsJson}
                          onChange={(e) => setDraft({ ...draft, sectionsJson: e.target.value })}
                          rows={14}
                          className="w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 font-mono text-xs text-[var(--arc-color-text)] outline-none focus:border-[var(--arc-color-gold)]"
                        />
                      </div>
                      <div className="text-[11px] text-[var(--arc-color-text-muted)]">
                        {t("civilopedia.admin.sectionFormatHint")}
                      </div>
                      <button onClick={saveSelectedDraft} disabled={saving || !selectedEntry} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--arc-color-primary-border)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] px-4 py-2 text-sm font-semibold text-[var(--arc-color-text)] disabled:opacity-60">
                        <Save size={14} />
                        {t("civilopedia.admin.saveArticle")}
                      </button>
                    </div>
                  ) : (
                    <AppEmptyState>{t("civilopedia.admin.emptyEditor")}</AppEmptyState>
                  )}
                </AppSection>
              )}
            </div>
    </AppModal>
  );
}
