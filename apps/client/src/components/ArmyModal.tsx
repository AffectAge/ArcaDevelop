import { useEffect, useMemo, useState } from "react";
import { Factory, Plane, Plus, Shield, Ship, Trash2, Upload, Wrench } from "lucide-react";
import type {
  AirWing,
  DivisionTemplate,
  EquipmentClass,
  EquipmentClassRole,
  EquipmentModule,
  EquipmentStats,
  MilitaryBranch,
  MilitaryEquipmentRequirement,
  MilitaryTemplateComponent,
} from "@arcanorum/shared";
import {
  cancelMilitaryFormation,
  createEquipmentProductionLine,
  createEquipmentVariant,
  createMilitaryFormation,
  deleteEquipmentProductionLine,
  deleteMilitaryTemplate,
  disbandMilitaryDivision,
  fetchContentEntries,
  fetchMilitaryOverview,
  saveMilitaryTemplate,
  updateEquipmentProductionLine,
  updateDivisionSupplyPriority,
  updateAirWingMission,
  uploadMilitaryTemplateIcon,
  type ContentEntry,
  type MilitaryOverview,
} from "../lib/api";
import { AppButton } from "./ui/AppButton";
import { AppCard, AppEmptyState, AppSection, AppSectionHeader } from "./ui/AppSurface";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";
import { Tooltip } from "./Tooltip";

type Props = {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onQueueArmyMove: (divisionId: string, targetHexId: string) => void;
  onQueueFleetMove: (fleetId: string, targetHexId: string) => void;
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

const EQUIPMENT_ROLE_OPTIONS: EquipmentClassRole[] = ["attack", "defense", "breakthrough", "speed", "range", "support"];
const AIR_WING_MISSION_OPTIONS: Array<NonNullable<AirWing["mission"]>> = [
  "none",
  "air_superiority",
  "ground_support",
  "interception",
  "naval_patrol",
];

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value);
}

function formatPercent(value: number, digits = 0) {
  return formatNumber(Math.max(0, Math.min(1, Number(value) || 0)) * 100, digits);
}

function sumEquipmentMap(input: Record<string, number> | undefined): number {
  return Object.values(input ?? {}).reduce((sum, amount) => sum + Math.max(0, Number(amount) || 0), 0);
}

function getEntryNameById(entries: Map<string, ContentEntry>, id: string): string {
  return entries.get(id)?.name || id;
}

function getMilitaryUnitHexId(unit: NonNullable<MilitaryOverview["units"][number] | MilitaryOverview["fleets"][number] | MilitaryOverview["airWings"][number]>): string {
  return "baseHexId" in unit ? unit.baseHexId : unit.hexId;
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

function normalizeTemplateEquipmentRequirements(template: DivisionTemplate): MilitaryEquipmentRequirement[] {
  return template.equipmentRequirements ?? [];
}

function getEquipmentClassLabel(equipmentClass: EquipmentClass): string {
  return equipmentClass.id.replace(/^equipment_class:/, "").replaceAll("_", " ");
}

function getEquipmentModuleLabel(module: EquipmentModule): string {
  return module.id.replace(/^equipment_module:/, "").replaceAll("_", " ");
}

function calculateEquipmentPreview(
  equipmentClass: EquipmentClass | null,
  modules: EquipmentModule[],
  moduleIdsBySlotId: Record<string, string>,
) {
  const stats: EquipmentStats = { ...(equipmentClass?.baseStats ?? {}) };
  const goodsCost = new Map<string, number>();
  if (!equipmentClass) return { stats, goodsCost: [] as Array<{ goodId: string; amount: number }> };
  for (const slotId of equipmentClass.slotIds) {
    const module = modules.find((entry) => entry.id === moduleIdsBySlotId[slotId]);
    if (!module || module.slotId !== slotId || (module.classId && module.classId !== equipmentClass.id)) continue;
    for (const [key, value] of Object.entries(module.stats)) {
      const statKey = key as keyof EquipmentStats;
      stats[statKey] = Number(((stats[statKey] ?? 0) + Number(value ?? 0)).toFixed(3));
    }
    for (const cost of module.goodsCost) {
      goodsCost.set(cost.goodId, Number(((goodsCost.get(cost.goodId) ?? 0) + cost.amount).toFixed(3)));
    }
  }
  return {
    stats,
    goodsCost: [...goodsCost.entries()].map(([goodId, amount]) => ({ goodId, amount })),
  };
}

export function ArmyModal({ open, token, onClose, onQueueArmyMove, onQueueFleetMove }: Props) {
  const { t } = useUiText();
  const [overview, setOverview] = useState<MilitaryOverview | null>(null);
  const [activeTab, setActiveTab] = useState<MilitaryBranch | "queue" | "equipment">("land");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [components, setComponents] = useState<MilitaryTemplateComponent[]>([]);
  const [equipmentRequirements, setEquipmentRequirements] = useState<MilitaryEquipmentRequirement[]>([]);
  const [formationName, setFormationName] = useState("");
  const [formationHexId, setFormationHexId] = useState("");
  const [iconError, setIconError] = useState<string | null>(null);
  const [moveTargetsByUnitId, setMoveTargetsByUnitId] = useState<Record<string, string>>({});
  const [equipmentClassId, setEquipmentClassId] = useState("");
  const [equipmentVariantName, setEquipmentVariantName] = useState("");
  const [equipmentModuleIdsBySlotId, setEquipmentModuleIdsBySlotId] = useState<Record<string, string>>({});
  const [equipmentProductionVariantId, setEquipmentProductionVariantId] = useState("");
  const [equipmentProductionCapacity, setEquipmentProductionCapacity] = useState(1);
  const [disbandDivisionId, setDisbandDivisionId] = useState<string | null>(null);
  const [goodsEntries, setGoodsEntries] = useState<ContentEntry[]>([]);

  const activeKind: MilitaryBranch = activeTab === "queue" || activeTab === "equipment" ? "land" : activeTab;
  const catalog = useMemo(() => getCatalog(overview, activeKind), [activeKind, overview]);
  const selectedTemplate = useMemo(
    () => overview?.templates.find((template) => template.id === selectedTemplateId) ?? null,
    [overview?.templates, selectedTemplateId],
  );
  const draftStats = useMemo(() => calculateDraftStats(catalog, components), [catalog, components]);
  const hexById = useMemo(() => new Map((overview?.hexOptions ?? []).map((hex) => [hex.id, hex] as const)), [overview]);
  const selectedEquipmentClass = useMemo(
    () => overview?.equipmentClasses.find((entry) => entry.id === equipmentClassId) ?? overview?.equipmentClasses[0] ?? null,
    [equipmentClassId, overview?.equipmentClasses],
  );
  const equipmentModulesForClass = useMemo(
    () =>
      overview?.equipmentModules.filter((module) => !selectedEquipmentClass || !module.classId || module.classId === selectedEquipmentClass.id) ?? [],
    [overview?.equipmentModules, selectedEquipmentClass],
  );
  const equipmentPreview = useMemo(
    () => calculateEquipmentPreview(selectedEquipmentClass, equipmentModulesForClass, equipmentModuleIdsBySlotId),
    [equipmentModuleIdsBySlotId, equipmentModulesForClass, selectedEquipmentClass],
  );
  const goodsById = useMemo(() => new Map(goodsEntries.map((entry) => [entry.id, entry] as const)), [goodsEntries]);

  const applyOverview = (data: MilitaryOverview) => {
    setOverview(data);
    setFormationHexId((current) => current || data.hexOptions[0]?.id || "");
    setEquipmentClassId((current) => current || data.equipmentClasses[0]?.id || "");
    setEquipmentProductionVariantId((current) => current || data.equipmentVariants[0]?.id || "");
  };

  const selectTemplate = (template: DivisionTemplate) => {
    const kind = template.kind ?? "land";
    setActiveTab(kind);
    setSelectedTemplateId(template.id);
    setTemplateName(template.name);
    setComponents(normalizeTemplateComponents(template));
    setEquipmentRequirements(normalizeTemplateEquipmentRequirements(template));
  };

  const startNewTemplate = (kind = activeKind) => {
    const nextCatalog = getCatalog(overview, kind);
    setActiveTab(kind);
    setSelectedTemplateId(null);
    setTemplateName(t(branchDefaultNameKey(kind)));
    setComponents(makeDefaultComponents(nextCatalog, kind));
    setEquipmentRequirements([]);
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
    if (!open) return;
    let cancelled = false;
    fetchContentEntries("goods")
      .then((items) => {
        if (!cancelled) setGoodsEntries(items);
      })
      .catch(() => {
        if (!cancelled) setGoodsEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (activeTab === "queue" || activeTab === "equipment") return;
    const currentKind = selectedTemplate?.kind ?? "land";
    if (selectedTemplate && currentKind === activeTab) return;
    const template = overview?.templates.find((entry) => (entry.kind ?? "land") === activeTab);
    if (template) {
      selectTemplate(template);
      return;
    }
    startNewTemplate(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!selectedEquipmentClass) return;
    setEquipmentVariantName((current) => current || getEquipmentClassLabel(selectedEquipmentClass));
    setEquipmentModuleIdsBySlotId((current) => {
      const next: Record<string, string> = {};
      for (const slotId of selectedEquipmentClass.slotIds) {
        const currentModule = equipmentModulesForClass.find((module) => module.id === current[slotId]);
        const fallbackModule = equipmentModulesForClass.find((module) => module.slotId === slotId);
        if (currentModule?.slotId === slotId) next[slotId] = currentModule.id;
        else if (fallbackModule) next[slotId] = fallbackModule.id;
      }
      return next;
    });
  }, [equipmentModulesForClass, selectedEquipmentClass]);

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

  const addEquipmentRequirement = () => {
    const equipmentClass = equipmentClassesForTemplate[0];
    if (!equipmentClass) return;
    const role = equipmentClass.roles[0] ?? "support";
    const id = `${equipmentClass.id}:${role}:${equipmentRequirements.length + 1}`;
    setEquipmentRequirements((current) => [
      ...current,
      { id, equipmentClassId: equipmentClass.id, role, count: 100 },
    ]);
  };

  const updateEquipmentRequirement = (id: string, patch: Partial<MilitaryEquipmentRequirement>) => {
    setEquipmentRequirements((current) =>
      current.map((requirement) => {
        if (requirement.id !== id) return requirement;
        const next = { ...requirement, ...patch };
        const equipmentClass = equipmentClassesForTemplate.find((entry) => entry.id === next.equipmentClassId);
        if (equipmentClass && !equipmentClass.roles.includes(next.role)) {
          next.role = equipmentClass.roles[0] ?? "support";
        }
        return {
          ...next,
          count: Math.max(1, Math.min(1_000_000, Math.floor(Number(next.count) || 1))),
        };
      }),
    );
  };

  const removeEquipmentRequirement = (id: string) => {
    setEquipmentRequirements((current) => current.filter((requirement) => requirement.id !== id));
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
        equipmentRequirements,
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

  const handleCreateEquipmentVariant = async () => {
    if (!token || !selectedEquipmentClass || !equipmentVariantName.trim()) return;
    setPending(true);
    try {
      const data = await createEquipmentVariant(token, {
        classId: selectedEquipmentClass.id,
        name: equipmentVariantName.trim(),
        moduleIdsBySlotId: equipmentModuleIdsBySlotId,
      });
      applyOverview(data);
      const created = data.equipmentVariants.find((variant) => variant.name === equipmentVariantName.trim());
      if (created) setEquipmentProductionVariantId(created.id);
    } finally {
      setPending(false);
    }
  };

  const handleCreateEquipmentProductionLine = async () => {
    if (!token || !equipmentProductionVariantId) return;
    setPending(true);
    try {
      applyOverview(
        await createEquipmentProductionLine(token, {
          equipmentVariantId: equipmentProductionVariantId,
          assignedCapacity: equipmentProductionCapacity,
          active: true,
        }),
      );
    } finally {
      setPending(false);
    }
  };

  const handleUpdateEquipmentProductionLine = async (
    lineId: string,
    payload: { assignedCapacity?: number; active?: boolean },
  ) => {
    if (!token) return;
    setPending(true);
    try {
      applyOverview(await updateEquipmentProductionLine(token, lineId, payload));
    } finally {
      setPending(false);
    }
  };

  const handleDeleteEquipmentProductionLine = async (lineId: string) => {
    if (!token) return;
    setPending(true);
    try {
      applyOverview(await deleteEquipmentProductionLine(token, lineId));
    } finally {
      setPending(false);
    }
  };

  const handleDisbandDivision = async () => {
    if (!token || !disbandDivisionId) return;
    setPending(true);
    try {
      applyOverview(await disbandMilitaryDivision(token, disbandDivisionId));
      setDisbandDivisionId(null);
    } finally {
      setPending(false);
    }
  };

  const handleSupplyPriorityChange = async (divisionId: string, supplyPriority: "low" | "normal" | "high") => {
    if (!token) return;
    setPending(true);
    try {
      applyOverview(await updateDivisionSupplyPriority(token, divisionId, supplyPriority));
    } finally {
      setPending(false);
    }
  };

  const handleAirWingMissionChange = async (
    airWingId: string,
    mission: NonNullable<AirWing["mission"]>,
    targetRegionId?: string | null,
  ) => {
    if (!token) return;
    setPending(true);
    try {
      applyOverview(await updateAirWingMission(token, airWingId, mission, targetRegionId));
    } finally {
      setPending(false);
    }
  };

  const templatesForTab = overview?.templates.filter((template) => (template.kind ?? "land") === activeKind) ?? [];
  const unitsForTab =
    activeKind === "naval"
      ? overview?.fleets ?? []
      : activeKind === "air"
        ? overview?.airWings ?? []
        : overview?.units.filter((unit) => (unit.kind ?? "land") === "land") ?? [];
  const disbandDivision = disbandDivisionId ? overview?.units.find((unit) => unit.id === disbandDivisionId) ?? null : null;
  const equipmentVariantById = useMemo(
    () => new Map((overview?.equipmentVariants ?? []).map((variant) => [variant.id, variant] as const)),
    [overview?.equipmentVariants],
  );
  const equipmentClassesForTemplate = overview?.equipmentClasses.filter((entry) => entry.branch === activeKind) ?? [];
  const selectedTemplateAssignment = selectedTemplateId ? overview?.templateEquipmentAssignments[selectedTemplateId] : null;

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
            <button
              type="button"
              onClick={() => setActiveTab("equipment")}
              className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs transition ${
                activeTab === "equipment" ? "border-[var(--arc-color-atlas-primary)] bg-[color-mix(in_srgb,var(--arc-color-atlas-primary)_10%,var(--arc-color-atlas-paper))] text-[var(--arc-color-atlas-primary)]" : "border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] text-[var(--arc-color-atlas-muted)]"
              }`}
            >
              <Wrench size={15} />
              {t("army.equipment")}
            </button>
          </div>

          {activeTab === "equipment" ? (
            <div className="grid gap-3 lg:grid-cols-[1fr_0.9fr]">
              <AppSection>
                <AppSectionHeader title={t("army.equipmentConstructor")} icon={<Wrench size={15} />} />
                <AppCard className="arc-pop-card">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="arc-pop-muted text-xs">
                      {t("army.equipmentClass")}
                      <select
                        value={selectedEquipmentClass?.id ?? ""}
                        onChange={(event) => {
                          setEquipmentClassId(event.target.value);
                          setEquipmentVariantName("");
                        }}
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-sm text-[var(--arc-color-atlas-ink)] outline-none focus:border-[var(--arc-color-atlas-primary)]"
                      >
                        {overview.equipmentClasses.map((entry) => (
                          <option key={entry.id} value={entry.id}>{getEquipmentClassLabel(entry)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="arc-pop-muted text-xs">
                      {t("army.equipmentVariantName")}
                      <input
                        value={equipmentVariantName}
                        onChange={(event) => setEquipmentVariantName(event.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-sm text-[var(--arc-color-atlas-ink)] outline-none focus:border-[var(--arc-color-atlas-primary)]"
                      />
                    </label>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(selectedEquipmentClass?.slotIds ?? []).map((slotId) => {
                      const slotModules = equipmentModulesForClass.filter((module) => module.slotId === slotId);
                      return (
                        <label key={slotId} className="arc-pop-card p-2 text-xs">
                          <span className="arc-pop-label">{slotId}</span>
                          <select
                            value={equipmentModuleIdsBySlotId[slotId] ?? ""}
                            onChange={(event) =>
                              setEquipmentModuleIdsBySlotId((current) => ({ ...current, [slotId]: event.target.value }))
                            }
                            className="mt-2 h-8 w-full rounded-md border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-xs text-[var(--arc-color-atlas-ink)] outline-none focus:border-[var(--arc-color-atlas-primary)]"
                          >
                            {slotModules.map((module) => (
                              <option key={module.id} value={module.id}>{getEquipmentModuleLabel(module)}</option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="arc-pop-card p-2 text-xs">
                      <div className="arc-pop-label mb-2">{t("army.equipmentStats")}</div>
                      {Object.entries(equipmentPreview.stats).length === 0 ? (
                        <div className="arc-pop-muted">{t("army.noEquipmentStats")}</div>
                      ) : (
                        <div className="grid gap-1">
                          {Object.entries(equipmentPreview.stats).map(([key, value]) => (
                            <div key={key} className="flex justify-between gap-2">
                              <span className="arc-pop-muted">{key}</span>
                              <span className="text-[var(--arc-color-atlas-ink)]">{formatNumber(Number(value), 2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="arc-pop-card p-2 text-xs">
                      <div className="arc-pop-label mb-2">{t("army.equipmentCost")}</div>
                      {equipmentPreview.goodsCost.length === 0 ? (
                        <div className="arc-pop-muted">{t("army.noEquipmentCost")}</div>
                      ) : (
                        <div className="grid gap-1">
                          {equipmentPreview.goodsCost.map((cost) => (
                            <div key={cost.goodId} className="flex justify-between gap-2">
                              <span className="arc-pop-muted">{getEntryNameById(goodsById, cost.goodId)}</span>
                              <span className="text-[var(--arc-color-atlas-ink)]">{formatNumber(cost.amount, 2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <AppButton type="button" disabled={pending || !selectedEquipmentClass} onClick={() => void handleCreateEquipmentVariant()}>
                      {t("army.createEquipmentVariant")}
                    </AppButton>
                  </div>
                </AppCard>
              </AppSection>

              <div className="grid gap-3">
                <AppSection>
                  <AppSectionHeader title={t("army.equipmentProduction")} icon={<Factory size={15} />} />
                  <div className="grid gap-2">
                    <label className="arc-pop-muted text-xs">
                      {t("army.equipmentVariant")}
                      <select
                        value={equipmentProductionVariantId}
                        onChange={(event) => setEquipmentProductionVariantId(event.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-sm text-[var(--arc-color-atlas-ink)] outline-none focus:border-[var(--arc-color-atlas-primary)]"
                      >
                        {overview.equipmentVariants.map((variant) => (
                          <option key={variant.id} value={variant.id}>{variant.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="arc-pop-muted text-xs">
                      {t("army.productionCapacity")}
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={equipmentProductionCapacity}
                        onChange={(event) => setEquipmentProductionCapacity(Math.max(0, Number(event.target.value) || 0))}
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-sm text-[var(--arc-color-atlas-ink)] outline-none focus:border-[var(--arc-color-atlas-primary)]"
                      />
                    </label>
                    <AppButton type="button" disabled={pending || !equipmentProductionVariantId} onClick={() => void handleCreateEquipmentProductionLine()}>
                      {t("army.createProductionLine")}
                    </AppButton>
                  </div>
                </AppSection>
                <AppSection>
                  <AppSectionHeader title={t("army.equipmentLines")} icon={<Factory size={15} />} />
                  <div className="grid gap-2">
                    {overview.equipmentProductionLines.length === 0 && (
                      <AppEmptyState title={t("army.noEquipmentLines")}>{t("army.noEquipmentLinesDescription")}</AppEmptyState>
                    )}
                    {overview.equipmentProductionLines.map((line) => {
                      const variant = overview.equipmentVariants.find((entry) => entry.id === line.equipmentVariantId);
                      const lineStatus = line.lastStatus ?? (line.active ? "active" : "idle");
                      const missingRows = (line.lastMissingGoods ?? []).map((missing) => ({
                        label: getEntryNameById(goodsById, missing.goodId),
                        value: t("army.productionLineMissingValue", {
                          available: formatNumber(missing.available, 2),
                          required: formatNumber(missing.required, 2),
                          missing: formatNumber(missing.missing, 2),
                        }),
                      }));
                      return (
                        <AppCard key={line.id} className="arc-pop-card">
                          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div>
                              <div className="text-sm font-semibold text-[var(--arc-color-atlas-ink)]">{variant?.name ?? line.equipmentVariantId}</div>
                              <div className="arc-pop-muted">
                                {t("army.productionLineProgress", { value: formatNumber(line.progress, 2) })}
                              </div>
                              <Tooltip
                                variant="rich"
                                content={{
                                  title: t("army.productionLineStatus"),
                                  description: t("army.productionLineStatusTooltip", {
                                    status: t(
                                      lineStatus === "stalled"
                                        ? "army.productionLineStatusStalled"
                                        : lineStatus === "idle"
                                          ? "army.productionLineStatusIdle"
                                          : lineStatus === "invalid"
                                            ? "army.productionLineStatusInvalid"
                                            : "army.productionLineStatusActive",
                                    ),
                                    produced: formatNumber(line.lastProduced ?? 0),
                                  }),
                                  rows: missingRows.length > 0 ? missingRows : [{ label: t("army.productionLineMissingGoods"), value: t("army.none") }],
                                  tone: lineStatus === "stalled" || lineStatus === "invalid" ? "negative" : lineStatus === "idle" ? "warning" : "positive",
                                }}
                                placement="top"
                              >
                                <div className={lineStatus === "stalled" || lineStatus === "invalid" ? "text-[var(--arc-color-danger-text)]" : "text-[var(--arc-color-success-text)]"}>
                                  {t(
                                    lineStatus === "stalled"
                                      ? "army.productionLineStatusStalled"
                                      : lineStatus === "idle"
                                        ? "army.productionLineStatusIdle"
                                        : lineStatus === "invalid"
                                          ? "army.productionLineStatusInvalid"
                                          : "army.productionLineStatusActive",
                                  )}
                                  {" · "}
                                  {t("army.productionLineProduced", { value: formatNumber(line.lastProduced ?? 0) })}
                                </div>
                              </Tooltip>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="arc-pop-muted text-[11px]">
                                {t("army.productionCapacity")}
                                <input
                                  type="number"
                                  min={0}
                                  max={1000}
                                  value={line.assignedCapacity}
                                  disabled={pending}
                                  onChange={(event) =>
                                    void handleUpdateEquipmentProductionLine(line.id, {
                                      assignedCapacity: Math.max(0, Number(event.target.value) || 0),
                                    })
                                  }
                                  className="ml-2 h-8 w-24 rounded-md border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-xs text-[var(--arc-color-atlas-ink)]"
                                />
                              </label>
                              <AppButton
                                type="button"
                                size="sm"
                                variant={line.active ? "secondary" : "ghost"}
                                disabled={pending}
                                onClick={() => void handleUpdateEquipmentProductionLine(line.id, { active: !line.active })}
                              >
                                {line.active ? t("army.active") : t("army.inactive")}
                              </AppButton>
                              <Tooltip content={t("army.deleteProductionLine")} placement="top">
                                <AppButton
                                  type="button"
                                  size="sm"
                                  variant="danger"
                                  icon={<Trash2 size={14} />}
                                  disabled={pending}
                                  onClick={() => void handleDeleteEquipmentProductionLine(line.id)}
                                  aria-label={t("army.deleteProductionLine")}
                                />
                              </Tooltip>
                            </div>
                          </div>
                        </AppCard>
                      );
                    })}
                  </div>
                </AppSection>
              </div>
            </div>
          ) : activeTab === "queue" ? (
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

                  <div className="mt-3 arc-pop-card p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="arc-pop-label">{t("army.equipmentRequirements")}</div>
                      <AppButton type="button" size="sm" variant="secondary" icon={<Plus size={14} />} disabled={equipmentClassesForTemplate.length === 0} onClick={addEquipmentRequirement}>
                        {t("army.addEquipmentRequirement")}
                      </AppButton>
                    </div>
                    {equipmentRequirements.length === 0 ? (
                      <div className="arc-pop-muted text-xs">{t("army.noEquipmentRequirements")}</div>
                    ) : (
                      <div className="grid gap-2">
                        {equipmentRequirements.map((requirement) => {
                          const equipmentClass = equipmentClassesForTemplate.find((entry) => entry.id === requirement.equipmentClassId);
                          const assignment = selectedTemplateAssignment?.choices.find((choice) => choice.requirementId === requirement.id);
                          const variant = assignment?.equipmentVariantId
                            ? overview.equipmentVariants.find((entry) => entry.id === assignment.equipmentVariantId)
                            : null;
                          return (
                            <div key={requirement.id} className="grid gap-2 rounded border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper-soft)] p-2 md:grid-cols-[1fr_120px_90px_auto]">
                              <select
                                value={requirement.equipmentClassId}
                                onChange={(event) => updateEquipmentRequirement(requirement.id, { equipmentClassId: event.target.value })}
                                className="h-8 rounded-md border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-xs text-[var(--arc-color-atlas-ink)]"
                              >
                                {equipmentClassesForTemplate.map((entry) => (
                                  <option key={entry.id} value={entry.id}>{getEquipmentClassLabel(entry)}</option>
                                ))}
                              </select>
                              <select
                                value={requirement.role}
                                onChange={(event) => updateEquipmentRequirement(requirement.id, { role: event.target.value as EquipmentClassRole })}
                                className="h-8 rounded-md border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-xs text-[var(--arc-color-atlas-ink)]"
                              >
                                {(equipmentClass?.roles ?? EQUIPMENT_ROLE_OPTIONS).map((role) => (
                                  <option key={role} value={role}>{role}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min={1}
                                value={requirement.count}
                                onChange={(event) => updateEquipmentRequirement(requirement.id, { count: Number(event.target.value) })}
                                className="h-8 rounded-md border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-xs text-[var(--arc-color-atlas-ink)]"
                              />
                              <button
                                type="button"
                                className="grid h-8 w-8 place-items-center rounded-md border border-[var(--arc-color-atlas-danger)] text-[var(--arc-color-atlas-danger)]"
                                disabled={pending}
                                onClick={() => removeEquipmentRequirement(requirement.id)}
                                title={t("army.delete")}
                              >
                                <Trash2 size={14} />
                              </button>
                              <div className="md:col-span-4">
                                <Tooltip
                                  variant="rich"
                                  content={{
                                    title: t("army.equipmentCoverageTooltipTitle"),
                                    description: t("army.equipmentCoverageTooltip", {
                                      required: formatNumber(assignment?.requiredCount ?? requirement.count),
                                      available: formatNumber(assignment?.availableCount ?? 0),
                                      assigned: formatNumber(assignment?.assignedCount ?? 0),
                                      coverage: formatPercent(assignment?.coverage ?? 0),
                                    }),
                                    rows: [
                                      { label: t("army.assignedEquipment"), value: variant?.name ?? t("army.noAssignedEquipment") },
                                      { label: t("army.equipmentRequired"), value: formatNumber(assignment?.requiredCount ?? requirement.count) },
                                      { label: t("army.equipmentAvailable"), value: formatNumber(assignment?.availableCount ?? 0) },
                                      { label: t("army.equipmentAssigned"), value: formatNumber(assignment?.assignedCount ?? 0) },
                                      { label: t("army.equipmentScore"), value: formatNumber(assignment?.score ?? 0, 2) },
                                    ],
                                    tone: (assignment?.coverage ?? 0) >= 1 ? "positive" : (assignment?.coverage ?? 0) > 0 ? "warning" : "negative",
                                  }}
                                  placement="top"
                                  referenceClassName="block"
                                >
                                  <div>
                                    <div className="arc-pop-muted flex justify-between gap-2 text-[11px]">
                                      <span>{variant?.name ?? t("army.noAssignedEquipment")}</span>
                                      <span>{t("army.equipmentCoverage", { value: formatPercent(assignment?.coverage ?? 0) })}</span>
                                    </div>
                                    <div className="arc-pop-muted mt-1 grid gap-1 text-[11px] sm:grid-cols-3">
                                      <span>{t("army.equipmentRequiredShort", { value: formatNumber(assignment?.requiredCount ?? requirement.count) })}</span>
                                      <span>{t("army.equipmentAvailableShort", { value: formatNumber(assignment?.availableCount ?? 0) })}</span>
                                      <span>{t("army.equipmentAssignedShort", { value: formatNumber(assignment?.assignedCount ?? 0) })}</span>
                                    </div>
                                  </div>
                                </Tooltip>
                                <div className="mt-1 h-1.5 overflow-hidden rounded bg-[var(--arc-color-atlas-line)]">
                                  <div
                                    className="h-full bg-[var(--arc-color-atlas-primary)]"
                                    style={{ width: `${Math.max(0, Math.min(100, (assignment?.coverage ?? 0) * 100))}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {selectedTemplateAssignment && equipmentRequirements.length > 0 && (
                      <Tooltip
                        variant="rich"
                        content={{
                          title: t("army.templateEquipmentCoverageTitle"),
                          description: t("army.templateEquipmentCoverageTooltip", { value: formatPercent(selectedTemplateAssignment.coverage) }),
                          tone: selectedTemplateAssignment.coverage >= 1 ? "positive" : selectedTemplateAssignment.coverage > 0 ? "warning" : "negative",
                        }}
                        placement="top"
                      >
                        <div className="arc-pop-muted mt-2 text-[11px]">
                          {t("army.templateEquipmentCoverageValue", { value: formatPercent(selectedTemplateAssignment.coverage) })}
                        </div>
                      </Tooltip>
                    )}
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
                  <AppSectionHeader title={t("army.readyUnits", { branch: t(BRANCH_LABEL_KEY[activeKind]) })} icon={<Shield size={15} />} />
                  <div className="grid gap-2">
                    {overview.equipmentSupplySummary.divisionCount > 0 && (
                      <Tooltip
                        variant="rich"
                        content={{
                          title: t("army.supplySummaryTitle"),
                          description: t("army.supplySummaryDescription", {
                            turn: overview.equipmentSupplySummary.turnId ? formatNumber(overview.equipmentSupplySummary.turnId) : "—",
                            divisions: formatNumber(overview.equipmentSupplySummary.divisionCount),
                            received: formatNumber(sumEquipmentMap(overview.equipmentSupplySummary.receivedByVariantId)),
                            returned: formatNumber(sumEquipmentMap(overview.equipmentSupplySummary.returnedByVariantId)),
                          }),
                          rows: [
                            ...Object.entries(overview.equipmentSupplySummary.receivedByVariantId).map(([variantId, amount]) => ({
                              label: `${t("army.supplyReceived")}: ${equipmentVariantById.get(variantId)?.name ?? variantId}`,
                              value: formatNumber(amount),
                            })),
                            ...Object.entries(overview.equipmentSupplySummary.returnedByVariantId).map(([variantId, amount]) => ({
                              label: `${t("army.supplyReturned")}: ${equipmentVariantById.get(variantId)?.name ?? variantId}`,
                              value: formatNumber(amount),
                            })),
                          ],
                          tone: sumEquipmentMap(overview.equipmentSupplySummary.receivedByVariantId) > 0 ? "positive" : "warning",
                        }}
                        placement="top"
                        referenceClassName="block"
                      >
                        <div className="arc-pop-card flex flex-wrap items-center justify-between gap-2 p-2 text-xs">
                          <span className="arc-pop-label">{t("army.supplySummaryTitle")}</span>
                          <span className="text-[var(--arc-color-atlas-ink)]">
                            {t("army.supplySummaryValue", {
                              received: formatNumber(sumEquipmentMap(overview.equipmentSupplySummary.receivedByVariantId)),
                              returned: formatNumber(sumEquipmentMap(overview.equipmentSupplySummary.returnedByVariantId)),
                              divisions: formatNumber(overview.equipmentSupplySummary.divisionCount),
                            })}
                          </span>
                        </div>
                      </Tooltip>
                    )}
                    {unitsForTab.length === 0 && <AppEmptyState title={t("army.noReadyUnits")}>{t("army.noReadyUnitsDescription")}</AppEmptyState>}
                    {unitsForTab.map((unit) => {
                      const unitHexId = getMilitaryUnitHexId(unit);
                      const supplyReport = unit.equipmentSupplyReport;
                      const receivedTotal = sumEquipmentMap(supplyReport?.receivedByVariantId);
                      const returnedTotal = sumEquipmentMap(supplyReport?.returnedByVariantId);
                      const airWing = activeKind === "air" && "baseHexId" in unit ? unit : null;
                      const airWingMission = airWing?.mission ?? "none";
                      const selectedMissionRegionId = airWing?.targetRegionId ?? overview.regionOptions[0]?.id ?? "";
                      const reportRows = [
                        ...Object.entries(supplyReport?.receivedByVariantId ?? {}).map(([variantId, amount]) => ({
                          label: `${t("army.supplyReceived")}: ${equipmentVariantById.get(variantId)?.name ?? variantId}`,
                          value: formatNumber(amount),
                        })),
                        ...Object.entries(supplyReport?.returnedByVariantId ?? {}).map(([variantId, amount]) => ({
                          label: `${t("army.supplyReturned")}: ${equipmentVariantById.get(variantId)?.name ?? variantId}`,
                          value: formatNumber(amount),
                        })),
                      ];
                      return (
                      <AppCard key={unit.id} className="arc-pop-card">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--arc-color-atlas-ink)]">{unit.name}</div>
                            <div className="arc-pop-muted text-xs">{hexById.get(unitHexId)?.name ?? unitHexId}</div>
                            <div className="arc-pop-muted mt-1 text-[11px]">
                              {t("army.strengthShort")} {formatNumber(unit.strength * 100)}% · {t("army.organizationShort")} {formatNumber(unit.organization, 1)}
                              {typeof unit.equipmentCoverage === "number" ? ` · ${t("army.equipmentCoverage", { value: formatPercent(unit.equipmentCoverage) })}` : ""}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {activeKind === "air" && (
                              <Tooltip content={t("army.airWingMissionTooltip")} placement="top">
                                <select
                                  value={airWingMission}
                                  disabled={pending}
                                  onChange={(event) =>
                                    void handleAirWingMissionChange(
                                      unit.id,
                                      event.target.value as NonNullable<AirWing["mission"]>,
                                      event.target.value === "none" ? null : selectedMissionRegionId,
                                    )
                                  }
                                  className="h-8 max-w-[190px] rounded-md border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-xs text-[var(--arc-color-atlas-ink)]"
                                  aria-label={t("army.airWingMission")}
                                >
                                  {AIR_WING_MISSION_OPTIONS.map((mission) => (
                                    <option key={mission} value={mission}>
                                      {t(`army.airWingMission.${mission}` as UiTextKey)}
                                    </option>
                                  ))}
                                </select>
                              </Tooltip>
                            )}
                            {activeKind === "air" && (
                              <Tooltip content={t("army.airWingMissionRegionTooltip")} placement="top">
                                <select
                                  value={selectedMissionRegionId}
                                  disabled={pending || airWingMission === "none" || overview.regionOptions.length === 0}
                                  onChange={(event) =>
                                    void handleAirWingMissionChange(unit.id, airWingMission, event.target.value)
                                  }
                                  className="h-8 max-w-[190px] rounded-md border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-xs text-[var(--arc-color-atlas-ink)] disabled:opacity-60"
                                  aria-label={t("army.airWingMissionRegion")}
                                >
                                  {overview.regionOptions.length === 0 ? (
                                    <option value="">{t("army.noMissionRegions")}</option>
                                  ) : (
                                    overview.regionOptions.map((region) => (
                                      <option key={region.id} value={region.id}>
                                        {region.name}
                                      </option>
                                    ))
                                  )}
                                </select>
                              </Tooltip>
                            )}
                            {activeKind !== "air" && (
                              <>
                              {activeKind === "land" && (
                                <Tooltip content={t("army.supplyPriorityTooltip")} placement="top">
                                  <select
                                    value={unit.supplyPriority ?? "normal"}
                                    disabled={pending}
                                    onChange={(event) => void handleSupplyPriorityChange(unit.id, event.target.value as "low" | "normal" | "high")}
                                    className="h-8 max-w-[150px] rounded-md border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-xs text-[var(--arc-color-atlas-ink)]"
                                    aria-label={t("army.supplyPriority")}
                                  >
                                    <option value="high">{t("army.supplyPriorityHigh")}</option>
                                    <option value="normal">{t("army.supplyPriorityNormal")}</option>
                                    <option value="low">{t("army.supplyPriorityLow")}</option>
                                  </select>
                                </Tooltip>
                              )}
                              <select
                                value={moveTargetsByUnitId[unit.id] ?? unitHexId}
                                onChange={(event) => setMoveTargetsByUnitId((current) => ({ ...current, [unit.id]: event.target.value }))}
                                className="h-8 max-w-[170px] rounded-md border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper)] px-2 text-xs text-[var(--arc-color-atlas-ink)]"
                              >
                                {(hexById.get(unitHexId)?.neighbors ?? []).map((hexId) => (
                                  <option key={hexId} value={hexId}>{hexById.get(hexId)?.name ?? hexId}</option>
                                ))}
                              </select>
                              <AppButton
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  activeKind === "naval"
                                    ? onQueueFleetMove(unit.id, moveTargetsByUnitId[unit.id] ?? unitHexId)
                                    : onQueueArmyMove(unit.id, moveTargetsByUnitId[unit.id] ?? unitHexId)
                                }
                              >
                                {t("army.march")}
                              </AppButton>
                              {activeKind === "land" && (
                                <Tooltip content={t("army.disbandDivision")} placement="top">
                                  <AppButton
                                    type="button"
                                    size="sm"
                                    variant="danger"
                                    icon={<Trash2 size={14} />}
                                    disabled={pending}
                                    onClick={() => setDisbandDivisionId(unit.id)}
                                    aria-label={t("army.disbandDivision")}
                                  />
                                </Tooltip>
                              )}
                              </>
                            )}
                          </div>
                        </div>
                        {supplyReport && (receivedTotal > 0 || returnedTotal > 0) && (
                          <Tooltip
                            variant="rich"
                            content={{
                              title: t("army.supplyReportTitle"),
                              description: t("army.supplyReportDescription", {
                                turn: supplyReport.turnId ? formatNumber(supplyReport.turnId) : "—",
                                received: formatNumber(receivedTotal),
                                returned: formatNumber(returnedTotal),
                              }),
                              rows: reportRows,
                              tone: receivedTotal > 0 ? "positive" : "warning",
                            }}
                            placement="top"
                            referenceClassName="block"
                          >
                            <div className="arc-pop-panel mt-2 flex items-center justify-between gap-2 px-2 py-1.5 text-[11px]">
                              <span className="arc-pop-label">{t("army.supplyReportTitle")}</span>
                              <span className="text-[var(--arc-color-atlas-ink)]">
                                +{formatNumber(receivedTotal)} / -{formatNumber(returnedTotal)}
                              </span>
                            </div>
                          </Tooltip>
                        )}
                        <div className="mt-3 grid gap-1">
                          <div className="arc-pop-label">{t("army.divisionEquipmentLoadout")}</div>
                          {(unit.equipmentAssignments ?? []).length === 0 ? (
                            <div className="arc-pop-muted text-[11px]">{t("army.noDivisionEquipmentLoadout")}</div>
                          ) : (
                            (unit.equipmentAssignments ?? []).map((assignment) => {
                              const variant = assignment.equipmentVariantId ? equipmentVariantById.get(assignment.equipmentVariantId) : null;
                              return (
                                <Tooltip
                                  key={assignment.requirementId}
                                  variant="rich"
                                  content={{
                                    title: variant?.name ?? t("army.noAssignedEquipment"),
                                    description: t("army.divisionEquipmentLoadoutTooltip", {
                                      required: formatNumber(assignment.requiredCount),
                                      assigned: formatNumber(assignment.assignedCount),
                                      coverage: formatPercent(assignment.coverage),
                                    }),
                                    rows: [
                                      { label: t("army.equipmentRequired"), value: formatNumber(assignment.requiredCount) },
                                      { label: t("army.equipmentAssigned"), value: formatNumber(assignment.assignedCount) },
                                      { label: t("army.equipmentScore"), value: formatNumber(assignment.score, 2) },
                                    ],
                                    tone: assignment.coverage >= 1 ? "positive" : assignment.coverage > 0 ? "warning" : "negative",
                                  }}
                                  placement="top"
                                  referenceClassName="block"
                                >
                                  <div className="arc-pop-panel px-2 py-1.5 text-[11px]">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="truncate text-[var(--arc-color-atlas-ink)]">{variant?.name ?? assignment.equipmentVariantId ?? t("army.noAssignedEquipment")}</span>
                                      <span className="shrink-0 text-[var(--arc-color-atlas-ink)]">
                                        {formatNumber(assignment.assignedCount)}/{formatNumber(assignment.requiredCount)}
                                      </span>
                                    </div>
                                    <div className="mt-1 h-1 overflow-hidden rounded bg-[var(--arc-color-atlas-line)]">
                                      <div
                                        className="h-full bg-[var(--arc-color-atlas-primary)]"
                                        style={{ width: `${Math.max(0, Math.min(100, assignment.coverage * 100))}%` }}
                                      />
                                    </div>
                                  </div>
                                </Tooltip>
                              );
                            })
                          )}
                        </div>
                      </AppCard>
                    );
                    })}
                  </div>
                </AppSection>
              </div>
            </div>
          )}
        </div>
      )}
      {disbandDivision && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[var(--arc-modal-backdrop)] px-4">
          <AppCard className="arc-pop-panel w-full max-w-md border-2 border-[var(--arc-color-atlas-danger)] p-4">
            <div className="mb-3">
              <div className="text-center text-base font-semibold text-[var(--arc-color-atlas-ink)]">{t("army.disbandConfirmTitle")}</div>
              <div className="arc-pop-muted mt-2 text-center text-xs">
                {t("army.disbandConfirmDescription", { name: disbandDivision.name })}
              </div>
            </div>
            <div className="arc-pop-card mb-3 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="arc-pop-label">{t("army.divisionEquipmentLoadout")}</span>
                <span className="text-[var(--arc-color-atlas-ink)]">
                  {formatNumber(Object.values(disbandDivision.equipmentByVariantId ?? {}).reduce((sum, amount) => sum + Math.max(0, Number(amount) || 0), 0))}
                </span>
              </div>
              <div className="arc-pop-muted mt-1">{t("army.disbandEquipmentReturn")}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <AppButton type="button" variant="secondary" disabled={pending} onClick={() => setDisbandDivisionId(null)}>
                {t("common.cancel")}
              </AppButton>
              <AppButton type="button" variant="danger" disabled={pending} onClick={() => void handleDisbandDivision()}>
                {t("army.disbandDivision")}
              </AppButton>
            </div>
          </AppCard>
        </div>
      )}
    </AppModal>
  );
}
