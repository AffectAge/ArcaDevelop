import { useEffect, useMemo, useState } from "react";
import { Plane, Plus, Shield, Ship, Trash2, Upload } from "lucide-react";
import type { DivisionTemplate, MilitaryBranch, MilitaryTemplateComponent } from "@arcanorum/shared";
import {
  cancelMilitaryFormation,
  createMilitaryFormation,
  deleteMilitaryTemplate,
  fetchMilitaryOverview,
  saveMilitaryTemplate,
  uploadMilitaryTemplateIcon,
  type ContentEntry,
  type MilitaryOverview,
} from "../lib/api";
import { AppButton } from "./ui/AppButton";
import { AppCard, AppEmptyState, AppSection, AppSectionHeader } from "./ui/AppSurface";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";

type Props = {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onQueueArmyMove: (divisionId: string, targetHexId: string) => void;
};

const BRANCH_LABEL_KEY: Record<MilitaryBranch, UiTextKey> = {
  land: "army.land",
  naval: "army.naval",
  air: "army.air",
};

const BRANCH_ICON: Record<MilitaryBranch, typeof Shield> = {
  land: Shield,
  naval: Ship,
  air: Plane,
};

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value);
}

function validateIcon64(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image.width === 64 && image.height === 64);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    image.src = url;
  });
}

function getCatalog(overview: MilitaryOverview | null, kind: MilitaryBranch): ContentEntry[] {
  if (!overview) return [];
  if (kind === "naval") return overview.shipTypeCatalog;
  if (kind === "air") return overview.aircraftTypeCatalog;
  return overview.battalionCatalog;
}

function makeDefaultComponents(catalog: ContentEntry[], kind: MilitaryBranch): MilitaryTemplateComponent[] {
  const first = catalog[0];
  if (!first) return [];
  return [{ id: first.id, typeId: first.id, count: kind === "air" ? 100 : kind === "land" ? 6 : 1, role: "line" }];
}

function normalizeTemplateComponents(template: DivisionTemplate): MilitaryTemplateComponent[] {
  if (template.components?.length) return template.components;
  return (template.battalions ?? []).map((battalion) => ({
    id: battalion.id,
    typeId: battalion.battalionTypeId,
    count: battalion.count,
    role: "line" as const,
  }));
}

function calculateDraftStats(catalog: ContentEntry[], components: MilitaryTemplateComponent[]) {
  let manpower = 0;
  let attack = 0;
  let defense = 0;
  let breakthrough = 0;
  let organization = 0;
  let hp = 0;
  let speed = Number.POSITIVE_INFINITY;
  let supplyUse = 0;
  let countTotal = 0;
  for (const component of components) {
    const base = catalog.find((entry) => entry.id === component.typeId);
    if (!base) continue;
    const count = Math.max(1, Math.floor(component.count || 1));
    countTotal += count;
    manpower += Number(base.manpower ?? 0) * count;
    attack += Number(base.attack ?? 0) * count;
    defense += Number(base.defense ?? 0) * count;
    breakthrough += Number(base.breakthrough ?? 0) * count;
    organization += Number(base.organization ?? 0) * count;
    hp += Number(base.hp ?? 0) * count;
    speed = Math.min(speed, Number(base.speed ?? 1));
    supplyUse += Number(base.supplyUse ?? 0) * count;
  }
  return {
    manpower,
    attack,
    defense,
    breakthrough,
    organization: countTotal > 0 ? organization / countTotal : 0,
    hp,
    speed: Number.isFinite(speed) ? speed : 1,
    supplyUse,
  };
}

function branchDefaultNameKey(kind: MilitaryBranch): UiTextKey {
  if (kind === "naval") return "army.defaultNaval";
  if (kind === "air") return "army.defaultAir";
  return "army.defaultLand";
}

export function ArmyModal({ open, token, onClose, onQueueArmyMove }: Props) {
  const { t } = useUiText();
  const [overview, setOverview] = useState<MilitaryOverview | null>(null);
  const [activeTab, setActiveTab] = useState<MilitaryBranch | "queue">("land");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [components, setComponents] = useState<MilitaryTemplateComponent[]>([]);
  const [formationName, setFormationName] = useState("");
  const [formationHexId, setFormationHexId] = useState("");
  const [iconError, setIconError] = useState<string | null>(null);
  const [moveTargetsByUnitId, setMoveTargetsByUnitId] = useState<Record<string, string>>({});

  const activeKind: MilitaryBranch = activeTab === "queue" ? "land" : activeTab;
  const catalog = useMemo(() => getCatalog(overview, activeKind), [activeKind, overview]);
  const selectedTemplate = useMemo(
    () => overview?.templates.find((template) => template.id === selectedTemplateId) ?? null,
    [overview?.templates, selectedTemplateId],
  );
  const draftStats = useMemo(() => calculateDraftStats(catalog, components), [catalog, components]);
  const hexById = useMemo(() => new Map((overview?.hexOptions ?? []).map((hex) => [hex.id, hex] as const)), [overview]);

  const applyOverview = (data: MilitaryOverview) => {
    setOverview(data);
    setFormationHexId((current) => current || data.hexOptions[0]?.id || "");
  };

  const selectTemplate = (template: DivisionTemplate) => {
    const kind = template.kind ?? "land";
    setActiveTab(kind);
    setSelectedTemplateId(template.id);
    setTemplateName(template.name);
    setComponents(normalizeTemplateComponents(template));
  };

  const startNewTemplate = (kind = activeKind) => {
    const nextCatalog = getCatalog(overview, kind);
    setActiveTab(kind);
    setSelectedTemplateId(null);
    setTemplateName(t(branchDefaultNameKey(kind)));
    setComponents(makeDefaultComponents(nextCatalog, kind));
  };

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setLoading(true);
    fetchMilitaryOverview(token)
      .then((data) => {
        if (cancelled) return;
        applyOverview(data);
        const firstTemplate = data.templates.find((template) => (template.kind ?? "land") === activeKind) ?? data.templates[0];
        if (firstTemplate) {
          selectTemplate(firstTemplate);
        } else {
          setTemplateName(t("army.defaultLand"));
          setComponents(makeDefaultComponents(data.battalionCatalog, "land"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, t]);

  useEffect(() => {
    if (activeTab === "queue") return;
    const currentKind = selectedTemplate?.kind ?? "land";
    if (selectedTemplate && currentKind === activeTab) return;
    const template = overview?.templates.find((entry) => (entry.kind ?? "land") === activeTab);
    if (template) {
      selectTemplate(template);
      return;
    }
    startNewTemplate(activeTab);
  }, [activeTab]);

  const updateComponentCount = (typeId: string, count: number, role: "line" | "support" = "line") => {
    setComponents((current) => {
      const max = activeKind === "air" ? 999 : 24;
      const nextCount = Math.max(0, Math.min(max, Math.floor(count || 0)));
      const existing = current.find((entry) => entry.typeId === typeId && (entry.role ?? "line") === role);
      if (nextCount <= 0) return current.filter((entry) => !(entry.typeId === typeId && (entry.role ?? "line") === role));
      if (existing) {
        return current.map((entry) => (entry === existing ? { ...entry, count: nextCount, role } : entry));
      }
      return [...current, { id: `${typeId}:${role}`, typeId, count: nextCount, role }];
    });
  };

  const handleSaveTemplate = async () => {
    if (!token || components.length === 0 || !templateName.trim()) return;
    setPending(true);
    try {
      const data = await saveMilitaryTemplate(token, {
        templateId: selectedTemplateId ?? undefined,
        kind: activeKind,
        name: templateName.trim(),
        components,
      });
      applyOverview(data);
      const updated = data.templates.find((template) => template.name === templateName.trim() && (template.kind ?? "land") === activeKind);
      if (updated) selectTemplate(updated);
    } finally {
      setPending(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!token || !selectedTemplateId) return;
    setPending(true);
    try {
      const data = await deleteMilitaryTemplate(token, selectedTemplateId);
      applyOverview(data);
      const firstTemplate = data.templates.find((template) => (template.kind ?? "land") === activeKind);
      if (firstTemplate) selectTemplate(firstTemplate);
      else startNewTemplate(activeKind);
    } finally {
      setPending(false);
    }
  };

  const handleUploadIcon = async (file: File | null) => {
    if (!token || !selectedTemplateId || !file) return;
    setIconError(null);
    if (!(await validateIcon64(file))) {
      setIconError(t("army.iconInvalid64"));
      return;
    }
    setPending(true);
    try {
      const data = await uploadMilitaryTemplateIcon(token, selectedTemplateId, file);
      applyOverview(data);
    } catch {
      setIconError(t("army.iconUploadFailed"));
    } finally {
      setPending(false);
    }
  };

  const handleCreateFormation = async () => {
    if (!token || !selectedTemplateId || !formationHexId) return;
    setPending(true);
    try {
      const data = await createMilitaryFormation(token, {
        templateId: selectedTemplateId,
        hexId: formationHexId,
        name: formationName.trim() || undefined,
      });
      applyOverview(data);
      setFormationName("");
      setActiveTab("queue");
    } finally {
      setPending(false);
    }
  };

  const handleCancelQueue = async (queueId: string) => {
    if (!token) return;
    setPending(true);
    try {
      applyOverview(await cancelMilitaryFormation(token, queueId));
    } finally {
      setPending(false);
    }
  };

  const templatesForTab = overview?.templates.filter((template) => (template.kind ?? "land") === activeKind) ?? [];
  const unitsForTab = overview?.units.filter((unit) => (unit.kind ?? "land") === activeKind) ?? [];

  return (
    <AppModal open={open} onClose={onClose} modalKey="army" panelClassName="arc-pop-panel mx-auto max-h-[92vh] w-[min(96vw,1240px)] overflow-auto">
      <AppModalHeader title={t("army.title")} description={t("army.description")} onClose={onClose} />
      {loading ? (
        <AppEmptyState title={t("army.loading")}>{t("army.loadingDescription")}</AppEmptyState>
      ) : !overview ? (
        <AppEmptyState title={t("army.noData")}>{t("army.noDataDescription")}</AppEmptyState>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {(["land", "naval", "air"] as MilitaryBranch[]).map((kind) => {
              const Icon = BRANCH_ICON[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setActiveTab(kind)}
                  className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs transition ${
                    activeTab === kind ? "border-[var(--arc-color-atlas-primary)] bg-[color-mix(in_srgb,var(--arc-color-atlas-primary)_10%,var(--arc-color-atlas-paper))] text-[var(--arc-color-atlas-primary)]" : "border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] text-[var(--arc-color-atlas-muted)]"
                  }`}
                >
                  <Icon size={15} />
                  {t(BRANCH_LABEL_KEY[kind])}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setActiveTab("queue")}
              className={`h-9 rounded-lg border px-3 text-xs transition ${
                activeTab === "queue" ? "border-[var(--arc-color-atlas-primary)] bg-[color-mix(in_srgb,var(--arc-color-atlas-primary)_10%,var(--arc-color-atlas-paper))] text-[var(--arc-color-atlas-primary)]" : "border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] text-[var(--arc-color-atlas-muted)]"
              }`}
            >
              {t("army.queue", { count: overview.queue.length })}
            </button>
          </div>

          {activeTab === "queue" ? (
            <AppSection>
              <AppSectionHeader title={t("army.formationQueue")} icon={<Plus size={15} />} />
              <div className="grid gap-2">
                {overview.queue.length === 0 && <AppEmptyState title={t("army.emptyQueue")}>{t("army.emptyQueueDescription")}</AppEmptyState>}
                {overview.queue.map((item) => {
                  const template = overview.templates.find((entry) => entry.id === item.templateId);
                  const hexName = hexById.get(item.hexId)?.name ?? item.hexId;
                  return (
                    <AppCard key={item.id} className="arc-pop-card">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--arc-color-atlas-ink)]">{item.name}</div>
                          <div className="arc-pop-muted text-xs">{t(BRANCH_LABEL_KEY[item.kind])} · {template?.name ?? t("army.templateDeleted")} · {hexName}</div>
                        </div>
                        <div className="min-w-[180px]">
                          <div className="arc-pop-muted mb-1 flex justify-between text-[11px]">
                            <span>{Math.round(item.progress * 100)}%</span>
                            <span>{item.turnsRemaining}/{item.turnsTotal}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded bg-white/10">
                            <div className="h-full bg-arc-accent" style={{ width: `${Math.max(4, item.progress * 100)}%` }} />
                          </div>
                        </div>
                        <AppButton type="button" size="sm" variant="ghost" icon={<Trash2 size={14} />} disabled={pending} onClick={() => void handleCancelQueue(item.id)}>
                          {t("army.cancel")}
                        </AppButton>
                      </div>
                    </AppCard>
                  );
                })}
              </div>
            </AppSection>
          ) : (
            <div className="grid min-h-0 gap-3 lg:grid-cols-[1.05fr_0.95fr]">
              <AppSection>
                <AppSectionHeader
                  title={t("army.branchTemplates", { branch: t(BRANCH_LABEL_KEY[activeKind]) })}
                  icon={(() => {
                    const Icon = BRANCH_ICON[activeKind];
                    return <Icon size={15} />;
                  })()}
                  actions={<AppButton type="button" size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => startNewTemplate(activeKind)}>{t("army.newTemplate")}</AppButton>}
                />
                <div className="mb-3 flex flex-wrap gap-2">
                  {templatesForTab.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => selectTemplate(template)}
                      className={`h-8 rounded-lg border px-2 text-xs transition ${
                        selectedTemplateId === template.id ? "border-[var(--arc-color-atlas-primary)] bg-[color-mix(in_srgb,var(--arc-color-atlas-primary)_10%,var(--arc-color-atlas-paper))] text-[var(--arc-color-atlas-primary)]" : "border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] text-[var(--arc-color-atlas-muted)]"
                      }`}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>

                <AppCard className="arc-pop-card">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <label className="arc-pop-muted text-xs">
                      {t("army.templateName")}
                      <input
                        value={templateName}
                        onChange={(event) => setTemplateName(event.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-sm text-[var(--arc-color-atlas-ink)] outline-none focus:border-[var(--arc-color-atlas-primary)]"
                      />
                    </label>
                    <div className="arc-pop-muted grid grid-cols-2 gap-2 text-xs">
                      <div>{t("army.attack")}: <span className="text-[var(--arc-color-atlas-ink)]">{formatNumber(draftStats.attack, 1)}</span></div>
                      <div>{t("army.defense")}: <span className="text-[var(--arc-color-atlas-ink)]">{formatNumber(draftStats.defense, 1)}</span></div>
                      <div>{t("army.organizationShort")}: <span className="text-[var(--arc-color-atlas-ink)]">{formatNumber(draftStats.organization, 1)}</span></div>
                      <div>{t("army.supplyShort")}: <span className="text-[var(--arc-color-atlas-ink)]">{formatNumber(draftStats.supplyUse, 1)}</span></div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper-soft)] p-2">
                    <div className="grid h-16 w-16 place-items-center rounded border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper-deep)]">
                      {selectedTemplate?.iconUrl ? <img src={selectedTemplate.iconUrl} alt="" className="h-16 w-16 object-cover" /> : <Shield size={24} className="arc-pop-muted" />}
                    </div>
                    <label className="arc-pop-muted text-xs">
                      {t("army.icon64")}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        disabled={pending || !selectedTemplateId}
                        onChange={(event) => void handleUploadIcon(event.target.files?.[0] ?? null)}
                        className="mt-1 block text-xs text-[var(--arc-color-atlas-muted)] file:mr-3 file:h-8 file:border-0 file:bg-[var(--arc-color-atlas-primary)] file:px-3 file:text-xs file:font-semibold file:text-[var(--arc-color-atlas-primary-ink)]"
                      />
                      {iconError && <span className="mt-1 block text-[11px] text-[var(--arc-color-atlas-danger)]">{iconError}</span>}
                    </label>
                  </div>

                  <div className={activeKind === "land" ? "mt-3 grid gap-3 lg:grid-cols-[1fr_220px]" : "mt-3"}>
                    <div>
                      <div className="arc-pop-label mb-2">
                        {activeKind === "land" ? t("army.battleSlots") : t("army.composition")}
                      </div>
                      <div className={activeKind === "land" ? "grid gap-2 sm:grid-cols-3" : "grid gap-2 sm:grid-cols-2"}>
                        {catalog.map((entry) => {
                          const value = components.find((component) => component.typeId === entry.id && (component.role ?? "line") === "line")?.count ?? 0;
                          return (
                            <div key={entry.id} className="arc-pop-card p-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-[var(--arc-color-atlas-ink)]">{entry.name}</span>
                                <span className="arc-pop-muted text-[11px]">{t("army.manpowerShort", { count: formatNumber(Number(entry.manpower ?? 0)) })}</span>
                              </div>
                              <input
                                type="number"
                                min={0}
                                max={activeKind === "air" ? 999 : 24}
                                value={value}
                                onChange={(event) => updateComponentCount(entry.id, Number(event.target.value), "line")}
                                className="mt-2 h-8 w-full rounded-md border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-sm text-[var(--arc-color-atlas-ink)] outline-none focus:border-[var(--arc-color-atlas-primary)]"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {activeKind === "land" && (
                      <div>
                        <div className="arc-pop-label mb-2">{t("army.support")}</div>
                        <div className="grid gap-2">
                          {catalog.slice(0, 5).map((entry) => {
                            const value = components.find((component) => component.typeId === entry.id && component.role === "support")?.count ?? 0;
                            return (
                              <div key={`${entry.id}:support`} className="arc-pop-card p-2">
                                <div className="text-xs font-semibold text-[var(--arc-color-atlas-ink)]">{entry.name}</div>
                                <input
                                  type="number"
                                  min={0}
                                  max={5}
                                  value={value}
                                  onChange={(event) => updateComponentCount(entry.id, Number(event.target.value), "support")}
                                  className="mt-2 h-8 w-full rounded-md border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-sm text-[var(--arc-color-atlas-ink)] outline-none focus:border-[var(--arc-color-atlas-primary)]"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <AppButton type="button" disabled={pending || components.length === 0} onClick={() => void handleSaveTemplate()}>{t("army.saveTemplate")}</AppButton>
                    <AppButton type="button" variant="ghost" icon={<Trash2 size={14} />} disabled={pending || !selectedTemplateId} onClick={() => void handleDeleteTemplate()}>{t("army.delete")}</AppButton>
                  </div>
                </AppCard>
              </AppSection>

              <div className="grid gap-3">
                <AppSection>
                  <AppSectionHeader title={t("army.formation")} icon={<Upload size={15} />} />
                  <div className="grid gap-2">
                    <label className="arc-pop-muted text-xs">
                      {t("army.unitName")}
                      <input
                        value={formationName}
                        onChange={(event) => setFormationName(event.target.value)}
                        placeholder={selectedTemplate?.name ?? t(branchDefaultNameKey(activeKind))}
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-sm text-[var(--arc-color-atlas-ink)] outline-none focus:border-[var(--arc-color-atlas-primary)]"
                      />
                    </label>
                    <label className="arc-pop-muted text-xs">
                      {t("army.baseHex")}
                      <select
                        value={formationHexId}
                        onChange={(event) => setFormationHexId(event.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-sm text-[var(--arc-color-atlas-ink)] outline-none focus:border-[var(--arc-color-atlas-primary)]"
                      >
                        {overview.hexOptions.map((hex) => <option key={hex.id} value={hex.id}>{hex.name}</option>)}
                      </select>
                    </label>
                    <div className="arc-pop-card p-2 text-xs">
                      {t("army.formationSpeed", { speed: formatNumber(overview.formationSpeed, 1) })}
                    </div>
                    <AppButton type="button" disabled={pending || !selectedTemplateId || !formationHexId} onClick={() => void handleCreateFormation()}>
                      {t("army.createFormation")}
                    </AppButton>
                  </div>
                </AppSection>

                <AppSection>
                  <AppSectionHeader title={t("army.readyUnits", { branch: t(BRANCH_LABEL_KEY[activeKind]) })} icon={<Shield size={15} />} />
                  <div className="grid gap-2">
                    {unitsForTab.length === 0 && <AppEmptyState title={t("army.noReadyUnits")}>{t("army.noReadyUnitsDescription")}</AppEmptyState>}
                    {unitsForTab.map((unit) => (
                      <AppCard key={unit.id} className="arc-pop-card">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--arc-color-atlas-ink)]">{unit.name}</div>
                            <div className="arc-pop-muted text-xs">{hexById.get(unit.hexId)?.name ?? unit.hexId}</div>
                            <div className="arc-pop-muted mt-1 text-[11px]">
                              {t("army.strengthShort")} {formatNumber(unit.strength * 100)}% · {t("army.organizationShort")} {formatNumber(unit.organization, 1)}
                            </div>
                          </div>
                          {activeKind === "land" && (
                            <div className="flex gap-2">
                              <select
                                value={moveTargetsByUnitId[unit.id] ?? unit.hexId}
                                onChange={(event) => setMoveTargetsByUnitId((current) => ({ ...current, [unit.id]: event.target.value }))}
                                className="h-8 max-w-[170px] rounded-md border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-xs text-[var(--arc-color-atlas-ink)]"
                              >
                                {(hexById.get(unit.hexId)?.neighbors ?? []).map((hexId) => (
                                  <option key={hexId} value={hexId}>{hexById.get(hexId)?.name ?? hexId}</option>
                                ))}
                              </select>
                              <AppButton type="button" size="sm" variant="secondary" onClick={() => onQueueArmyMove(unit.id, moveTargetsByUnitId[unit.id] ?? unit.hexId)}>
                                {t("army.march")}
                              </AppButton>
                            </div>
                          )}
                        </div>
                      </AppCard>
                    ))}
                  </div>
                </AppSection>
              </div>
            </div>
          )}
        </div>
      )}
    </AppModal>
  );
}
