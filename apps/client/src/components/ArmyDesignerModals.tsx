import { Dialog } from "@headlessui/react";
import { AnimatePresence, motion } from "framer-motion";
import { Boxes, Plane, Save, Ship, Shield, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { EquipmentFrame, EquipmentModule, EquipmentStats, MilitaryBranch, MilitaryTemplateComponent } from "@arcanorum/shared";
import {
  createEquipmentVariant,
  fetchMilitaryOverview,
  saveMilitaryTemplate,
  type ContentEntry,
  type MilitaryOverview,
} from "../lib/api";
import { useUiText } from "../i18n/useUiText";
import { Tooltip } from "./Tooltip";

export type ArmyDesignerModalKind =
  | "division-template"
  | "air-template"
  | "fleet-template"
  | "land-equipment"
  | "air-equipment"
  | "naval-equipment";

type Props = {
  open: boolean;
  kind: ArmyDesignerModalKind | null;
  token: string;
  onClose: () => void;
};

const BRANCH_BY_KIND: Record<ArmyDesignerModalKind, MilitaryBranch> = {
  "division-template": "land",
  "air-template": "air",
  "fleet-template": "naval",
  "land-equipment": "land",
  "air-equipment": "air",
  "naval-equipment": "naval",
};

export function ArmyDesignerModal({ open, kind, token, onClose }: Props) {
  const { t } = useUiText();
  const [overview, setOverview] = useState<MilitaryOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !kind) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchMilitaryOverview(token)
      .then((next) => {
        if (alive) setOverview(next);
      })
      .catch((cause) => {
        if (alive) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [kind, open, token]);

  const titleKey = getTitleKey(kind);
  return (
    <AnimatePresence>
      {open && kind ? (
        <Dialog static open={open} onClose={onClose} className="arc-army-designer-dialog">
          <motion.div className="arc-army-designer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <div className="arc-army-designer-stage">
            <Dialog.Panel
              as={motion.div}
              className="arc-army-designer-modal"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.985 }}
            >
              <header className="arc-army-designer-header">
                <div>
                  <Dialog.Title className="arc-army-designer-title">{t(titleKey)}</Dialog.Title>
                  <p className="arc-army-designer-subtitle">
                    {t(isEquipmentKind(kind) ? "army.designerEquipmentDescription" : "army.designerTemplatesDescription")}
                  </p>
                </div>
                <button type="button" className="arc-building-overview-close" onClick={onClose} aria-label={t("common.close")}>
                  <X size={18} />
                </button>
              </header>
              {loading ? <div className="arc-army-designer-empty">{t("army.loading")}</div> : null}
              {error ? <div className="arc-army-designer-empty">{error}</div> : null}
              {overview && isEquipmentKind(kind) ? (
                <EquipmentDesigner token={token} kind={kind} overview={overview} onOverviewChange={setOverview} />
              ) : null}
              {overview && !isEquipmentKind(kind) ? (
                <TemplateDesigner token={token} kind={kind} overview={overview} onOverviewChange={setOverview} />
              ) : null}
            </Dialog.Panel>
          </div>
        </Dialog>
      ) : null}
    </AnimatePresence>
  );
}

function TemplateDesigner({
  token,
  kind,
  overview,
  onOverviewChange,
}: {
  token: string;
  kind: ArmyDesignerModalKind;
  overview: MilitaryOverview;
  onOverviewChange: (overview: MilitaryOverview) => void;
}) {
  const { t } = useUiText();
  const branch = BRANCH_BY_KIND[kind];
  const catalog = getCatalogForBranch(overview, branch);
  const [name, setName] = useState(t(branch === "land" ? "army.defaultLand" : branch === "air" ? "army.defaultAir" : "army.defaultNaval"));
  const [componentTypeId, setComponentTypeId] = useState(catalog[0]?.id ?? "");
  const [componentCount, setComponentCount] = useState(branch === "air" ? 100 : 1);
  const classOptions = overview.equipmentClasses.filter((entry) => entry.branch === branch);
  const [equipmentClassId, setEquipmentClassId] = useState(classOptions[0]?.id ?? "");
  const selectedClass = classOptions.find((entry) => entry.id === equipmentClassId) ?? classOptions[0] ?? null;
  const [equipmentRole, setEquipmentRole] = useState(selectedClass?.roles[0] ?? "support");
  const [equipmentCount, setEquipmentCount] = useState(branch === "air" ? 100 : 10);

  useEffect(() => {
    if (!componentTypeId && catalog[0]) setComponentTypeId(catalog[0].id);
  }, [catalog, componentTypeId]);

  useEffect(() => {
    if (selectedClass && !selectedClass.roles.includes(equipmentRole)) setEquipmentRole(selectedClass.roles[0] ?? "support");
  }, [equipmentRole, selectedClass]);

  const component = catalog.find((entry) => entry.id === componentTypeId) ?? catalog[0] ?? null;
  const components: MilitaryTemplateComponent[] = component
    ? [{ id: "component:primary", typeId: component.id, count: componentCount, role: branch === "land" ? "line" : "line" }]
    : [];
  const statRows = buildContentStatRows(component, componentCount);

  async function handleSave() {
    if (!component || !selectedClass) return;
    const next = await saveMilitaryTemplate(token, {
      kind: branch,
      name,
      components,
      equipmentRequirements: [{ id: `${selectedClass.id}:${equipmentRole}`, equipmentClassId: selectedClass.id, role: equipmentRole, count: equipmentCount }],
    });
    onOverviewChange(next);
  }

  return (
    <div className="arc-army-designer-layout">
      <section className="arc-army-designer-board">
        <label className="arc-army-designer-field">
          <span>{t("army.templateName")}</span>
          <input value={name} onChange={(event) => setName(event.target.value.slice(0, 80))} />
        </label>
        <div className="arc-army-designer-grid-shell">
          <div className="arc-army-designer-support-column">
            <div className="arc-army-designer-column-title">{t("army.support")}</div>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="arc-army-designer-slot arc-army-designer-slot-muted">+</div>
            ))}
          </div>
          <div className="arc-army-designer-combat-grid">
            <div className="arc-army-designer-column-title">{t("army.battleSlots")}</div>
            {Array.from({ length: 12 }).map((_, index) => (
              <button key={index} type="button" className={`arc-army-designer-slot ${index === 0 ? "arc-army-designer-slot-active" : ""}`}>
                {index === 0 ? (component?.name ?? componentTypeId) : "+"}
              </button>
            ))}
          </div>
        </div>
        <div className="arc-army-designer-form-row">
          <label className="arc-army-designer-field">
            <span>{t("army.composition")}</span>
            <select value={componentTypeId} onChange={(event) => setComponentTypeId(event.target.value)}>
              {catalog.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <label className="arc-army-designer-field">
            <span>{t("army.componentCount")}</span>
            <input type="number" min={1} max={branch === "land" ? 24 : 999} value={componentCount} onChange={(event) => setComponentCount(Math.max(1, Number(event.target.value) || 1))} />
          </label>
        </div>
      </section>
      <aside className="arc-army-designer-side">
        <DesignerStatList rows={statRows} />
        <div className="arc-army-designer-panel">
          <div className="arc-army-designer-panel-title">{t("army.equipmentRequirements")}</div>
          <label className="arc-army-designer-field">
            <span>{t("army.equipmentClass")}</span>
            <select value={equipmentClassId} onChange={(event) => setEquipmentClassId(event.target.value)}>
              {classOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.id}</option>
              ))}
            </select>
          </label>
          <label className="arc-army-designer-field">
            <span>{t("army.equipmentScore")}</span>
            <select value={equipmentRole} onChange={(event) => setEquipmentRole(event.target.value as typeof equipmentRole)}>
              {(selectedClass?.roles ?? []).map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          <label className="arc-army-designer-field">
            <span>{t("army.requirementCount")}</span>
            <input type="number" min={1} value={equipmentCount} onChange={(event) => setEquipmentCount(Math.max(1, Number(event.target.value) || 1))} />
          </label>
        </div>
        <button type="button" className="arc-army-designer-save" onClick={handleSave} disabled={!component || !selectedClass || !name.trim()}>
          <Save size={16} />
          <span>{t("army.saveTemplate")}</span>
        </button>
      </aside>
    </div>
  );
}

function EquipmentDesigner({
  token,
  kind,
  overview,
  onOverviewChange,
}: {
  token: string;
  kind: ArmyDesignerModalKind;
  overview: MilitaryOverview;
  onOverviewChange: (overview: MilitaryOverview) => void;
}) {
  const { t } = useUiText();
  const branch = BRANCH_BY_KIND[kind];
  const frames = overview.equipmentFrames.filter((entry) => entry.branch === branch);
  const [frameId, setFrameId] = useState(frames[0]?.id ?? "");
  const frame = frames.find((entry) => entry.id === frameId) ?? frames[0] ?? null;
  const equipmentClass = frame ? overview.equipmentClasses.find((entry) => entry.id === frame.classId) ?? null : null;
  const [name, setName] = useState(t("army.equipmentVariantName"));
  const [moduleIdsBySlotId, setModuleIdsBySlotId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!frame) return;
    setModuleIdsBySlotId((current) => {
      const next: Record<string, string> = {};
      for (const slotId of frame.slotIds) {
        next[slotId] = current[slotId] ?? getModulesForSlot(overview.equipmentModules, frame, slotId)[0]?.id ?? "";
      }
      return next;
    });
  }, [frame, overview.equipmentModules]);

  const preview = useMemo(() => buildVariantPreview(frame, moduleIdsBySlotId, overview.equipmentModules), [frame, moduleIdsBySlotId, overview.equipmentModules]);

  async function handleSave() {
    if (!frame) return;
    const next = await createEquipmentVariant(token, { frameId: frame.id, name, moduleIdsBySlotId });
    onOverviewChange(next);
  }

  if (!frame) return <div className="arc-army-designer-empty">{t("army.noFrames")}</div>;

  return (
    <div className="arc-army-designer-layout">
      <section className="arc-army-designer-board">
        <label className="arc-army-designer-field">
          <span>{t("army.equipmentVariantName")}</span>
          <input value={name} onChange={(event) => setName(event.target.value.slice(0, 120))} />
        </label>
        <label className="arc-army-designer-field">
          <span>{t("army.equipmentFrame")}</span>
          <select value={frame.id} onChange={(event) => setFrameId(event.target.value)}>
            {frames.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.id}</option>
            ))}
          </select>
        </label>
        <div className="arc-army-blueprint">
          {branch === "air" ? <Plane size={84} /> : branch === "naval" ? <Ship size={84} /> : <Boxes size={84} />}
          <div>{equipmentClass?.id ?? frame.classId}</div>
        </div>
        <div className="arc-army-module-grid">
          {frame.slotIds.map((slotId) => {
            const modules = getModulesForSlot(overview.equipmentModules, frame, slotId);
            return (
              <label key={slotId} className="arc-army-designer-field">
                <span>{slotId}</span>
                <select value={moduleIdsBySlotId[slotId] ?? ""} onChange={(event) => setModuleIdsBySlotId((current) => ({ ...current, [slotId]: event.target.value }))}>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>{module.id}</option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </section>
      <aside className="arc-army-designer-side">
        <DesignerStatList rows={preview.rows} />
        <div className="arc-army-designer-panel">
          <div className="arc-army-designer-panel-title">{t("army.equipmentCost")}</div>
          {preview.goodsCost.length ? preview.goodsCost.map((cost) => (
            <div key={cost.goodId} className="arc-army-designer-metric">
              <span>{cost.goodId}</span>
              <strong>{cost.amount}</strong>
            </div>
          )) : <div className="arc-army-designer-empty-inline">{t("army.noEquipmentCost")}</div>}
          <div className="arc-army-designer-metric">
            <span>{t("army.manpowerCrew")}</span>
            <strong>{preview.manpowerCrew}</strong>
          </div>
          <div className="arc-army-designer-metric">
            <span>{t("army.productionCost")}</span>
            <strong>{preview.productionCost}</strong>
          </div>
        </div>
        <button type="button" className="arc-army-designer-save" onClick={handleSave} disabled={!name.trim()}>
          <Wrench size={16} />
          <span>{t("army.saveVariant")}</span>
        </button>
      </aside>
    </div>
  );
}

function DesignerStatList({ rows }: { rows: Array<{ key: string; value: number }> }) {
  const { t } = useUiText();
  return (
    <div className="arc-army-designer-panel">
      <div className="arc-army-designer-panel-title">{t("army.previewStats")}</div>
      {rows.map((row) => (
        <Tooltip key={row.key} content={{ title: row.key, description: t("army.statTooltip") }} placement="left">
          <div className="arc-army-designer-metric">
            <span>{row.key}</span>
            <strong>{row.value}</strong>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}

function getCatalogForBranch(overview: MilitaryOverview, branch: MilitaryBranch): ContentEntry[] {
  if (branch === "air") return overview.aircraftTypeCatalog;
  if (branch === "naval") return overview.shipTypeCatalog;
  return overview.battalionCatalog;
}

function getModulesForSlot(modules: EquipmentModule[], frame: EquipmentFrame, slotId: string): EquipmentModule[] {
  return modules.filter((module) => module.slotId === slotId && (!module.classId || module.classId === frame.classId));
}

function buildVariantPreview(frame: EquipmentFrame | null, moduleIdsBySlotId: Record<string, string>, modules: EquipmentModule[]) {
  const stats: EquipmentStats = { ...(frame?.baseStats ?? {}) };
  const goodsById = new Map<string, number>();
  let manpowerCrew = Number(frame?.manpowerCrew ?? 0) || 0;
  let productionCost = Number(frame?.productionCost ?? 0) || 0;
  for (const cost of frame?.goodsCost ?? []) goodsById.set(cost.goodId, (goodsById.get(cost.goodId) ?? 0) + cost.amount);
  for (const moduleId of Object.values(moduleIdsBySlotId)) {
    const module = modules.find((entry) => entry.id === moduleId);
    if (!module) continue;
    for (const [key, value] of Object.entries(module.stats)) {
      stats[key as keyof EquipmentStats] = round3(Number(stats[key as keyof EquipmentStats] ?? 0) + Number(value ?? 0));
    }
    for (const cost of module.goodsCost) goodsById.set(cost.goodId, round3((goodsById.get(cost.goodId) ?? 0) + cost.amount));
    manpowerCrew = round3(manpowerCrew + Number(module.manpowerCrew ?? 0));
    productionCost = round3(productionCost + Number(module.productionCost ?? 0));
  }
  return {
    rows: Object.entries(stats).map(([key, value]) => ({ key, value: round3(Number(value) || 0) })),
    goodsCost: [...goodsById.entries()].map(([goodId, amount]) => ({ goodId, amount: round3(amount) })),
    manpowerCrew: round3(manpowerCrew),
    productionCost: round3(productionCost),
  };
}

function buildContentStatRows(component: ContentEntry | null, count: number): Array<{ key: string; value: number }> {
  if (!component) return [];
  const multiplier = Math.max(1, Math.floor(count));
  return ["manpower", "attack", "defense", "breakthrough", "organization", "hp", "speed", "supplyUse"]
    .map((key) => ({ key, value: round3(Number((component as unknown as Record<string, number>)[key] ?? 0) * (key === "organization" || key === "speed" ? 1 : multiplier)) }))
    .filter((entry) => entry.value !== 0);
}

function isEquipmentKind(kind: ArmyDesignerModalKind): boolean {
  return kind === "land-equipment" || kind === "air-equipment" || kind === "naval-equipment";
}

function getTitleKey(kind: ArmyDesignerModalKind | null) {
  if (kind === "division-template") return "army.designerDivision" as const;
  if (kind === "air-template") return "army.designerAirWing" as const;
  if (kind === "fleet-template") return "army.designerFleet" as const;
  if (kind === "air-equipment") return "army.createPlane" as const;
  if (kind === "naval-equipment") return "army.createShip" as const;
  return "army.createLandEquipment" as const;
}

function round3(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 1000) / 1000;
}
