import { Dialog } from "@headlessui/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpCircle,
  Crosshair,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { BuildingInstance, Country, HexId, Order, RegionConstructionProject, WorldBase } from "@arcanorum/shared";
import {
  demolishCountryBuild,
  setCountryBuildAutoUpgradeState,
  setCountryBuildCustomName,
  setCountryBuildManualWorkState,
  setCountryBuildSubsidyState,
  upgradeCountryBuildState,
  type ContentEntry,
} from "../lib/api";
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";
import { BuildingAtlasIcon } from "./BuildingAtlasIcon";
import { Tooltip } from "./Tooltip";

type CategoryEntry = {
  id: string;
  name: string;
  logoUrl?: string | null;
};

export type BuildingOverviewCancelPayload =
  | { source: "queued"; regionId: string; queueId: string; targetHexId: HexId; buildingId: string }
  | { source: "pending"; orderId: string };

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  countryId: string;
  scenarioId?: string | null;
  worldBase: WorldBase | null;
  turnId: number;
  ordersByTurn: Map<number, Map<string, Order[]>>;
  buildings: ContentEntry[];
  industries: CategoryEntry[];
  sectors: CategoryEntry[];
  companies: ContentEntry[];
  countries: Country[];
  demolitionCostConstructionPercent: number;
  canceledConstructionQueueKeys: readonly string[];
  cancelingConstructionQueueKey?: string | null;
  onCancelConstructionProject: (item: BuildingOverviewCancelPayload) => void;
  onFocusHex: (hexId: HexId) => void;
};

type OverviewStatus = "working" | "inactive" | "queued" | "pending";

type OverviewItem = {
  id: string;
  kind: "built" | "queued" | "pending";
  status: OverviewStatus;
  regionId: string;
  regionGroupId: string;
  regionGroupLabel: string;
  targetHexId: HexId;
  buildingId: string;
  displayName: string;
  customName?: string | null;
  ownerKey: string;
  ownerName: string;
  ownerIconUrl?: string | null;
  industryId?: string | null;
  sectorId?: string | null;
  instance?: BuildingInstance;
  project?: RegionConstructionProject;
  order?: Order;
  progressPct?: number;
  remainingConstruction?: number;
  productivity?: number;
  revenue?: number;
  expenses?: number;
  net?: number;
  durabilityPct?: number;
  efficiencyPct?: number;
  financePct?: number;
  demolitionCostConstruction?: number;
};

type ConfirmState =
  | { type: "cancel"; item: OverviewItem; payload: BuildingOverviewCancelPayload }
  | { type: "demolish"; item: OverviewItem };

const ALL = "__all__";

export function BuildingOverviewModal(props: Props) {
  const { t } = useUiText();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [sectorFilter, setSectorFilter] = useState(ALL);
  const [industryFilter, setIndustryFilter] = useState(ALL);
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [renameDraftById, setRenameDraftById] = useState<Record<string, string>>({});
  const [editingNameId, setEditingNameId] = useState<string | null>(null);

  const items = useMemo(() => buildOverviewItems(props, t), [props, t]);
  const filteredItems = useMemo(
    () => filterOverviewItems(items, { regionFilter, statusFilter, sectorFilter, industryFilter, ownerFilter, search }),
    [industryFilter, items, ownerFilter, regionFilter, search, sectorFilter, statusFilter],
  );
  const groupedItems = useMemo(() => groupOverviewItems(filteredItems, props.industries, t), [filteredItems, props.industries, t]);
  const filterOptions = useMemo(() => buildFilterOptions(items, props.sectors, props.industries, t), [items, props.industries, props.sectors, t]);

  const runBuiltAction = async (action: string, item: OverviewItem, task: () => Promise<void>) => {
    if (!item.instance) return;
    setBusyAction(`${action}:${item.id}`);
    try {
      await task();
    } finally {
      setBusyAction(null);
    }
  };

  const toggleFlag = async (
    item: OverviewItem,
    flag: "autoUpgradeEnabled" | "stateSubsidiesEnabled" | "manualWorkEnabled",
    next: boolean,
  ) => {
    if (!item.instance) return;
    await runBuiltAction(flag, item, async () => {
      try {
        if (flag === "autoUpgradeEnabled") {
          await setCountryBuildAutoUpgradeState(props.token, {
            regionId: item.regionId,
            buildingId: item.buildingId,
            instanceId: item.instance?.instanceId,
            enabled: next,
          });
          toast.success(t(next ? "buildings.toastAutoUpgradeEnabled" : "buildings.toastAutoUpgradeDisabled"));
        } else if (flag === "stateSubsidiesEnabled") {
          await setCountryBuildSubsidyState(props.token, {
            regionId: item.regionId,
            buildingId: item.buildingId,
            instanceId: item.instance?.instanceId,
            enabled: next,
          });
          toast.success(t(next ? "buildings.toastSubsidiesEnabled" : "buildings.toastSubsidiesDisabled"));
        } else {
          await setCountryBuildManualWorkState(props.token, {
            regionId: item.regionId,
            buildingId: item.buildingId,
            instanceId: item.instance?.instanceId,
            enabled: next,
          });
          toast.success(t(next ? "buildings.toastManualWorkEnabled" : "buildings.toastManualWorkDisabled"));
        }
      } catch {
        const key =
          flag === "autoUpgradeEnabled"
            ? "buildings.toastAutoUpgradeFailed"
            : flag === "stateSubsidiesEnabled"
              ? "buildings.toastSubsidiesFailed"
              : "buildings.toastManualWorkFailed";
        toast.error(t(key));
      }
    });
  };

  const upgradeItem = async (item: OverviewItem) => {
    if (!item.instance) return;
    await runBuiltAction("upgrade", item, async () => {
      try {
        const result = await upgradeCountryBuildState(props.token, {
          regionId: item.regionId,
          buildingId: item.buildingId,
          instanceId: item.instance?.instanceId,
        });
        toast.success(t("buildings.toastUpgradeQueued", { current: result.currentLevel, target: result.targetLevel }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "BUILD_UPGRADE_STATE_FAILED";
        if (message === "BUILDING_MAX_LEVEL_REACHED") toast.error(t("buildings.toastUpgradeMaxReached"));
        else if (message === "INSUFFICIENT_DUCATS") toast.error(t("buildings.toastUpgradeInsufficientDucats"));
        else if (message === "BUILDING_UPGRADE_ALREADY_QUEUED") toast.error(t("buildings.toastUpgradeAlreadyQueued"));
        else toast.error(t("buildings.toastUpgradeFailed"));
      }
    });
  };

  const saveRename = async (item: OverviewItem) => {
    if (!item.instance) return;
    const draft = renameDraftById[item.id] ?? item.customName ?? "";
    await runBuiltAction("rename", item, async () => {
      try {
        const result = await setCountryBuildCustomName(props.token, {
          regionId: item.regionId,
          buildingId: item.buildingId,
          instanceId: item.instance?.instanceId,
          customName: draft.trim() || null,
        });
        toast.success(t(result.customName ? "buildings.toastRenameUpdated" : "buildings.toastRenameReset"));
      } catch {
        toast.error(t("buildings.toastRenameFailed"));
      }
    });
  };

  const confirmDanger = async () => {
    if (!confirm) return;
    if (confirm.type === "cancel") {
      props.onCancelConstructionProject(confirm.payload);
      setConfirm(null);
      return;
    }
    const item = confirm.item;
    if (!item.instance) return;
    setBusyAction(`demolish:${item.id}`);
    try {
      const result = await demolishCountryBuild(props.token, {
        regionId: item.regionId,
        buildingId: item.buildingId,
        instanceId: item.instance.instanceId,
      });
      toast.success(t("buildings.toastDemolished", { cost: result.demolitionCostConstruction }));
      setConfirm(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "BUILD_DEMOLISH_FAILED";
      if (message === "INSUFFICIENT_CONSTRUCTION_POINTS") toast.error(t("buildings.toastDemolishInsufficientConstruction"));
      else if (message === "BUILDING_INSTANCE_NOT_FOUND") toast.error(t("buildings.toastDemolishNotFound"));
      else toast.error(t("buildings.toastDemolishFailed"));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <AnimatePresence>
      {props.open ? (
        <Dialog open onClose={props.onClose} className="relative z-[230]">
          <motion.div
            className="fixed inset-0 bg-[var(--arc-modal-backdrop)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel
              as={motion.div}
              className="arc-building-overview-modal"
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
            >
              <header className="arc-building-overview-header">
                <div>
                  <Dialog.Title className="arc-building-overview-title">{t("buildingOverview.title")}</Dialog.Title>
                  <p>{t("buildingOverview.subtitle")}</p>
                </div>
                <button type="button" className="arc-strategy-icon-button arc-strategy-icon-button--danger" onClick={props.onClose} aria-label={t("common.close")}>
                  <X size={16} aria-hidden="true" />
                </button>
              </header>

              <section className="arc-building-overview-filters" aria-label={t("buildingOverview.filters")}>
                <label>
                  <span>{t("buildingOverview.search")}</span>
                  <span className="arc-building-overview-search">
                    <Search size={14} aria-hidden="true" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("buildingOverview.searchPlaceholder")} />
                  </span>
                </label>
                <FilterSelect label={t("buildingOverview.regionFilter")} value={regionFilter} onChange={setRegionFilter} options={filterOptions.regions} />
                <FilterSelect label={t("buildingOverview.statusFilter")} value={statusFilter} onChange={setStatusFilter} options={filterOptions.statuses} />
                <FilterSelect label={t("buildingOverview.sectorFilter")} value={sectorFilter} onChange={setSectorFilter} options={filterOptions.sectors} />
                <FilterSelect label={t("buildingOverview.industryFilter")} value={industryFilter} onChange={setIndustryFilter} options={filterOptions.industries} />
                <FilterSelect label={t("buildingOverview.ownerFilter")} value={ownerFilter} onChange={setOwnerFilter} options={filterOptions.owners} />
              </section>

              <div className="arc-building-overview-body arc-scrollbar">
                {items.length === 0 ? (
                  <div className="arc-building-overview-empty">{t("buildingOverview.emptyCountry")}</div>
                ) : groupedItems.length === 0 ? (
                  <div className="arc-building-overview-empty">{t("buildingOverview.emptyFilters")}</div>
                ) : (
                  groupedItems.map((region) => (
                    <section key={region.id} className="arc-building-overview-region">
                      <div className="arc-building-overview-region-header">
                        <h3>{region.label}</h3>
                        <span>{region.count}</span>
                      </div>
                      {region.industries.map((industry) => (
                        <div key={industry.id} className="arc-building-overview-industry">
                          <div className="arc-building-overview-industry-header">
                            {industry.logoUrl ? <img src={industry.logoUrl} alt="" /> : null}
                            <span>{industry.label}</span>
                          </div>
                          <div className="arc-building-overview-grid">
                            {industry.items.map((item) => (
                              <BuildingOverviewCard
                                key={item.id}
                                item={item}
                                scenarioId={props.scenarioId}
                                expanded={expandedId === item.id}
                                busyAction={busyAction}
                                canceling={props.cancelingConstructionQueueKey === getCancelKey(item)}
                                renameDraft={renameDraftById[item.id] ?? item.customName ?? ""}
                                editingName={editingNameId === item.id}
                                onStartRename={() => {
                                  if (item.kind !== "built") return;
                                  setRenameDraftById((current) => ({ ...current, [item.id]: current[item.id] ?? item.customName ?? "" }));
                                  setEditingNameId(item.id);
                                }}
                                onRenameDraftChange={(value) => setRenameDraftById((current) => ({ ...current, [item.id]: value }))}
                                onFinishRename={() => {
                                  setEditingNameId(null);
                                  saveRename(item);
                                }}
                                onCancelRename={() => setEditingNameId(null)}
                                onToggleExpanded={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                                onFocusHex={() => {
                                  props.onFocusHex(item.targetHexId);
                                  props.onClose();
                                }}
                                onCancelProject={() => {
                                  const payload = getCancelPayload(item);
                                  if (payload) setConfirm({ type: "cancel", item, payload });
                                }}
                                onDemolish={() => setConfirm({ type: "demolish", item })}
                                onUpgrade={() => upgradeItem(item)}
                                onToggleAutoUpgrade={(next) => toggleFlag(item, "autoUpgradeEnabled", next)}
                                onToggleSubsidies={(next) => toggleFlag(item, "stateSubsidiesEnabled", next)}
                                onToggleManualWork={(next) => toggleFlag(item, "manualWorkEnabled", next)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </section>
                  ))
                )}
              </div>
            </Dialog.Panel>
          </div>
          <DangerConfirmDialog state={confirm} busy={Boolean(busyAction?.startsWith("demolish:"))} onCancel={() => setConfirm(null)} onConfirm={confirmDanger} />
        </Dialog>
      ) : null}
    </AnimatePresence>
  );
}

function FilterSelect(props: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label>
      <span>{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function BuildingOverviewCard(props: {
  item: OverviewItem;
  scenarioId?: string | null;
  expanded: boolean;
  busyAction: string | null;
  canceling: boolean;
  renameDraft: string;
  editingName: boolean;
  onStartRename: () => void;
  onRenameDraftChange: (value: string) => void;
  onFinishRename: () => void;
  onCancelRename: () => void;
  onToggleExpanded: () => void;
  onFocusHex: () => void;
  onCancelProject: () => void;
  onDemolish: () => void;
  onUpgrade: () => void;
  onToggleAutoUpgrade: (next: boolean) => void;
  onToggleSubsidies: (next: boolean) => void;
  onToggleManualWork: (next: boolean) => void;
}) {
  const { t } = useUiText();
  const item = props.item;
  const built = item.kind === "built" && item.instance;
  return (
    <article className={`arc-building-overview-card arc-building-overview-card--${item.status}`}>
      <div
        className="arc-building-overview-card-main"
        role="button"
        tabIndex={0}
        onClick={props.onToggleExpanded}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            props.onToggleExpanded();
          }
        }}
        aria-expanded={props.expanded}
      >
        <BuildingAtlasIcon scenarioId={props.scenarioId} buildingId={item.buildingId} state={item.status === "queued" || item.status === "pending" ? "underConstruction" : item.status === "inactive" ? "ruins" : "working"} className="arc-building-overview-card-icon" />
        <span className="arc-building-overview-card-text">
          {props.editingName ? (
            <input
              className="arc-building-overview-title-input"
              value={props.renameDraft}
              autoFocus
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => props.onRenameDraftChange(event.target.value)}
              onBlur={props.onFinishRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") props.onFinishRename();
                if (event.key === "Escape") props.onCancelRename();
              }}
            />
          ) : (
            <button
              type="button"
              className="arc-building-overview-name-button"
              onClick={(event) => {
                event.stopPropagation();
                props.onStartRename();
              }}
              disabled={!built}
              title={built ? t("buildings.renameTooltip") : undefined}
            >
              {item.customName || item.displayName}
            </button>
          )}
          <span className="arc-building-overview-owner">
            <span className="arc-building-overview-owner-icon" aria-hidden="true">
              {item.ownerIconUrl ? <img src={item.ownerIconUrl} alt="" /> : item.ownerName.slice(0, 1).toUpperCase()}
            </span>
            {item.ownerName}
          </span>
        </span>
        <Tooltip content={t(getStatusKey(item.status))} placement="top">
          <span className="arc-building-overview-status" aria-label={t(getStatusKey(item.status))} role="img">
            <span aria-hidden="true" />
          </span>
        </Tooltip>
      </div>
      <div className="arc-building-overview-card-actions" onClick={(event) => event.stopPropagation()}>
        <IconAction label={t("buildings.focusConstructionHexTooltip")} onClick={props.onFocusHex}>
          <Crosshair size={13} aria-hidden="true" />
        </IconAction>
        {item.kind === "queued" || item.kind === "pending" ? (
          <IconAction label={t("buildings.cancelConstructionTooltip")} onClick={props.onCancelProject} disabled={props.canceling} danger>
            <X size={13} aria-hidden="true" />
          </IconAction>
        ) : null}
        {built ? (
          <>
            <IconAction label={t("buildings.projectUpgrade")} onClick={props.onUpgrade} disabled={props.busyAction === `upgrade:${item.id}`}>
              <ArrowUpCircle size={13} aria-hidden="true" />
            </IconAction>
            <IconAction label={item.instance?.autoUpgradeEnabled ? t("buildings.disableAutoUpgradeTooltip") : t("buildings.enableAutoUpgradeTooltip")} onClick={() => props.onToggleAutoUpgrade(!item.instance?.autoUpgradeEnabled)} active={Boolean(item.instance?.autoUpgradeEnabled)} disabled={props.busyAction === `autoUpgradeEnabled:${item.id}`}>
              <Wrench size={13} aria-hidden="true" />
            </IconAction>
            <IconAction label={item.instance?.stateSubsidiesEnabled ? t("buildings.disableSubsidiesTooltip") : t("buildings.enableSubsidiesTooltip")} onClick={() => props.onToggleSubsidies(!item.instance?.stateSubsidiesEnabled)} active={Boolean(item.instance?.stateSubsidiesEnabled)} disabled={props.busyAction === `stateSubsidiesEnabled:${item.id}`}>
              <ShieldCheck size={13} aria-hidden="true" />
            </IconAction>
            <IconAction label={item.instance?.manualWorkEnabled !== false ? t("buildings.disableManualWorkTooltip") : t("buildings.enableManualWorkTooltip")} onClick={() => props.onToggleManualWork(item.instance?.manualWorkEnabled === false)} active={item.instance?.manualWorkEnabled !== false} disabled={props.busyAction === `manualWorkEnabled:${item.id}`}>
              <Pencil size={13} aria-hidden="true" />
            </IconAction>
            <IconAction label={t("buildings.demolishTooltip")} onClick={props.onDemolish} disabled={props.busyAction === `demolish:${item.id}`} danger>
              <Trash2 size={13} aria-hidden="true" />
            </IconAction>
          </>
        ) : null}
      </div>
      <div className="arc-building-overview-card-metrics">
        <Metric label={t("buildingOverview.productivity")} value={formatPercent(item.productivity)} />
        <Metric label={t("buildingOverview.revenue")} value={formatCompact(item.revenue ?? 0)} />
        <Metric label={t("buildingOverview.expenses")} value={formatCompact(item.expenses ?? 0)} />
        <Metric label={t("buildingOverview.net")} value={formatSignedCompact(item.net ?? 0)} tone={(item.net ?? 0) >= 0 ? "good" : "bad"} />
      </div>
      <AnimatePresence initial={false}>
        {props.expanded ? (
          <motion.div
            className="arc-building-overview-card-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <div className="arc-building-overview-detail-grid">
              <Metric label={t("buildings.levelLabel")} value={built ? String(item.instance?.level ?? 1) : "-"} />
              <Metric label={t("buildings.constructionProgress")} value={item.kind === "built" ? "100%" : `${Math.round(item.progressPct ?? 0)}%`} />
              <Metric label={t("buildings.constructionCost")} value={item.remainingConstruction != null ? formatCompact(item.remainingConstruction) : "-"} />
              <Metric label={t("buildings.buildingLabel")} value={item.buildingId} />
            </div>
            <div className="arc-building-overview-bars">
              <ProgressMetric label={t("buildings.durabilityLabel")} value={item.durabilityPct ?? 0} />
              <ProgressMetric label={t("buildingOverview.productivity")} value={item.efficiencyPct ?? 0} />
              <ProgressMetric label={t("buildings.finance")} value={item.financePct ?? 0} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

function IconAction(props: { label: string; active?: boolean; danger?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip content={props.label} placement="top">
      <button
        type="button"
        className={`arc-building-overview-icon-action ${props.active ? "arc-building-overview-icon-action--active" : ""} ${props.danger ? "arc-building-overview-icon-action--danger" : ""}`}
        onClick={props.onClick}
        disabled={props.disabled}
        aria-label={props.label}
      >
        {props.children}
      </button>
    </Tooltip>
  );
}

function Metric(props: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <span className={`arc-building-overview-metric ${props.tone ? `arc-building-overview-metric--${props.tone}` : ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </span>
  );
}

function ProgressMetric(props: { label: string; value: number }) {
  const value = Math.max(0, Math.min(1, Number(props.value) || 0));
  return (
    <div className="arc-building-overview-progress">
      <div>
        <span>{props.label}</span>
        <strong>{Math.round(value * 100)}%</strong>
      </div>
      <div className="arc-building-overview-progress-track">
        <span style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

function DangerConfirmDialog(props: { state: ConfirmState | null; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useUiText();
  if (!props.state) return null;
  const title = props.state.type === "cancel" ? t("buildings.cancelConstructionTitle") : t("buildings.demolishBuildingTitle");
  return (
    <div className="arc-building-overview-confirm-wrap">
      <motion.div
        className="arc-hex-build-confirm"
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        role="dialog"
        aria-modal="true"
      >
        <div className="arc-hex-build-confirm__header">
          <h2 className="arc-hex-build-confirm__title">{title}</h2>
        </div>
        <div className="arc-hex-build-confirm__body">
          <div className="arc-hex-build-confirm__row">
            <span>{t("buildings.buildingLabel")}</span>
            <strong>{props.state.item.displayName}</strong>
          </div>
          <div className="arc-hex-build-confirm__row">
            <span>{t("hexMap.hex")}</span>
            <strong>{props.state.item.targetHexId}</strong>
          </div>
          <div className="arc-hex-build-confirm__row">
            <span>{t("buildings.owner")}</span>
            <strong>{props.state.item.ownerName}</strong>
          </div>
          {props.state.type === "demolish" ? (
            <div className="arc-hex-build-confirm__row">
              <span>{t("buildings.demolishConstructionCost")}</span>
              <strong>{formatCompact(props.state.item.demolitionCostConstruction ?? 0)}</strong>
            </div>
          ) : null}
        </div>
        <div className="arc-hex-build-confirm__actions">
          <button type="button" className="arc-strategy-workspace-action arc-strategy-workspace-action--primary arc-hex-build-confirm__action" onClick={props.onCancel}>
            <span>{t("common.cancel")}</span>
          </button>
          <button type="button" className="arc-strategy-workspace-action arc-hex-build-confirm__action arc-hex-build-confirm__action--cancel" onClick={props.onConfirm} disabled={props.busy}>
            <span>{t("common.confirm")}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function buildOverviewItems(props: Props, t: (key: UiTextKey, params?: Record<string, string | number>) => string): OverviewItem[] {
  const world = props.worldBase;
  if (!world) return [];
  const buildingById = new Map(props.buildings.map((entry) => [entry.id, entry] as const));
  const companyById = new Map(props.companies.map((entry) => [entry.id, entry] as const));
  const countryById = new Map(props.countries.map((country) => [country.id, country] as const));
  const canceled = new Set(props.canceledConstructionQueueKeys);
  const items: OverviewItem[] = [];

  for (const [regionId, instances] of Object.entries(world.regionBuildingsByRegion ?? {})) {
    const controlled = isControlledRegion(world, props.countryId, regionId);
    for (const instance of instances ?? []) {
      const stateOwnedOutside = instance.owner.type === "state" && instance.owner.countryId === props.countryId;
      if (!controlled && !stateOwnedOutside) continue;
      const building = buildingById.get(instance.buildingId);
      const level = Math.max(1, Math.floor(Number(instance.level ?? 1)));
      const maxDurability = Math.max(1, Number(building?.maxDurability ?? 100));
      const costConstruction = Math.max(0, Number(building?.costConstruction ?? 0)) * level;
      items.push({
        id: `built:${instance.instanceId}`,
        kind: "built",
        status: instance.isInactive ? "inactive" : "working",
        regionId,
        regionGroupId: controlled ? regionId : "__state_owned_outside__",
        regionGroupLabel: controlled ? regionId : t("buildingOverview.stateOwnedOutsideControl"),
        targetHexId: instance.targetHexId as HexId,
        buildingId: instance.buildingId,
        displayName: getBuildingDisplayName(building, instance.buildingId, t),
        customName: instance.customName,
        ...resolveOwner(instance.owner, companyById, countryById),
        industryId: typeof building?.industryId === "string" ? building.industryId : null,
        sectorId: typeof building?.sectorId === "string" ? building.sectorId : null,
        instance,
        productivity: Number(instance.lastProductivity ?? 0),
        revenue: Number(instance.lastRevenueDucats ?? 0),
        expenses: Number(instance.lastInputCostDucats ?? 0) + Number(instance.lastWagesDucats ?? 0),
        net: Number(instance.lastNetDucats ?? 0),
        durabilityPct: Math.max(0, Math.min(1, Number(instance.currentDurability ?? maxDurability) / maxDurability)),
        efficiencyPct: Math.max(0, Math.min(1, Number(instance.lastProductivity ?? 0))),
        financePct: Math.max(0, Math.min(1, Number(instance.lastFinanceCoverage ?? 0))),
        demolitionCostConstruction: Math.ceil((costConstruction * Math.max(0, props.demolitionCostConstructionPercent)) / 100),
      });
    }
  }

  for (const [regionId, queue] of Object.entries(world.regionConstructionQueueByRegion ?? {})) {
    const controlled = isControlledRegion(world, props.countryId, regionId);
    for (const project of queue ?? []) {
      if (canceled.has(`${regionId}:${project.queueId}`)) continue;
      const stateOwnedOutside = project.owner.type === "state" && project.owner.countryId === props.countryId;
      if (!controlled && !stateOwnedOutside && project.requestedByCountryId !== props.countryId) continue;
      const building = buildingById.get(project.buildingId);
      const cost = Math.max(1, Number(project.costConstruction ?? 0));
      const progress = Math.max(0, Number(project.progressConstruction ?? 0));
      items.push({
        id: `queued:${project.queueId}`,
        kind: "queued",
        status: "queued",
        regionId,
        regionGroupId: controlled ? regionId : "__state_owned_outside__",
        regionGroupLabel: controlled ? regionId : t("buildingOverview.stateOwnedOutsideControl"),
        targetHexId: project.targetHexId as HexId,
        buildingId: project.buildingId,
        displayName: getBuildingDisplayName(building, project.buildingId, t),
        ...resolveOwner(project.owner, companyById, countryById),
        industryId: typeof building?.industryId === "string" ? building.industryId : null,
        sectorId: typeof building?.sectorId === "string" ? building.sectorId : null,
        project,
        progressPct: (progress / cost) * 100,
        remainingConstruction: Math.max(0, cost - progress),
        productivity: 0,
        revenue: 0,
        expenses: 0,
        net: 0,
      });
    }
  }

  const byPlayer = props.ordersByTurn.get(props.turnId);
  if (byPlayer) {
    const seen = new Set(items.map((item) => `${item.regionId}:${item.targetHexId}:${item.buildingId}:${item.kind}`));
    for (const orders of byPlayer.values()) {
      for (const order of orders) {
        if (order.type !== "BUILD" || order.countryId !== props.countryId) continue;
        const payload = (order.payload ?? {}) as Record<string, unknown>;
        const buildingId = typeof payload.buildingId === "string" ? payload.buildingId : typeof payload.building === "string" ? payload.building : "";
        if (!buildingId) continue;
        const key = `${order.regionId}:${order.targetHexId}:${buildingId}:pending`;
        if (seen.has(key)) continue;
        seen.add(key);
        const owner = parseOwner(payload.owner, props.countryId);
        const building = buildingById.get(buildingId);
        const controlled = isControlledRegion(world, props.countryId, order.regionId);
        items.push({
          id: `pending:${order.id}`,
          kind: "pending",
          status: "pending",
          regionId: order.regionId,
          regionGroupId: controlled ? order.regionId : "__state_owned_outside__",
          regionGroupLabel: controlled ? order.regionId : t("buildingOverview.stateOwnedOutsideControl"),
          targetHexId: order.targetHexId,
          buildingId,
          displayName: getBuildingDisplayName(building, buildingId, t),
          ...resolveOwner(owner, companyById, countryById),
          industryId: typeof building?.industryId === "string" ? building.industryId : null,
          sectorId: typeof building?.sectorId === "string" ? building.sectorId : null,
          order,
          progressPct: 0,
          remainingConstruction: Math.max(0, Number(building?.costConstruction ?? 0)),
          productivity: 0,
          revenue: 0,
          expenses: 0,
          net: 0,
        });
      }
    }
  }

  return items.sort(compareOverviewItems);
}

function filterOverviewItems(
  items: OverviewItem[],
  filters: { regionFilter: string; statusFilter: string; sectorFilter: string; industryFilter: string; ownerFilter: string; search: string },
): OverviewItem[] {
  const query = filters.search.trim().toLocaleLowerCase("ru-RU");
  return items.filter((item) => {
    if (filters.regionFilter !== ALL && item.regionGroupId !== filters.regionFilter) return false;
    if (filters.statusFilter !== ALL && item.status !== filters.statusFilter) return false;
    if (filters.sectorFilter !== ALL && (item.sectorId ?? "") !== filters.sectorFilter) return false;
    if (filters.industryFilter !== ALL && (item.industryId ?? "") !== filters.industryFilter) return false;
    if (filters.ownerFilter !== ALL && item.ownerKey !== filters.ownerFilter) return false;
    if (!query) return true;
    return [item.displayName, item.customName ?? "", item.buildingId, item.regionId, item.targetHexId, item.ownerName]
      .join(" ")
      .toLocaleLowerCase("ru-RU")
      .includes(query);
  });
}

function groupOverviewItems(items: OverviewItem[], industries: CategoryEntry[], t: (key: UiTextKey) => string) {
  const industryById = new Map(industries.map((entry) => [entry.id, entry] as const));
  const regionMap = new Map<string, { id: string; label: string; count: number; industryMap: Map<string, { id: string; label: string; logoUrl: string | null; items: OverviewItem[] }> }>();
  for (const item of items) {
    const region = regionMap.get(item.regionGroupId) ?? { id: item.regionGroupId, label: item.regionGroupLabel, count: 0, industryMap: new Map() };
    const industryId = item.industryId || "__other__";
    const industry = industryById.get(industryId);
    const industryGroup = region.industryMap.get(industryId) ?? {
      id: industryId,
      label: industry?.name ?? (industryId === "__other__" ? t("buildings.otherIndustry") : formatIdLabel(industryId)),
      logoUrl: industry?.logoUrl ?? null,
      items: [],
    };
    industryGroup.items.push(item);
    region.industryMap.set(industryId, industryGroup);
    region.count += 1;
    regionMap.set(region.id, region);
  }
  return [...regionMap.values()]
    .sort((a, b) => (a.id === "__state_owned_outside__" ? 1 : b.id === "__state_owned_outside__" ? -1 : a.label.localeCompare(b.label, "ru")))
    .map((region) => ({
      id: region.id,
      label: region.label,
      count: region.count,
      industries: [...region.industryMap.values()]
        .map((industry) => ({ ...industry, items: [...industry.items].sort(compareOverviewItems) }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru")),
    }));
}

function buildFilterOptions(items: OverviewItem[], sectors: CategoryEntry[], industries: CategoryEntry[], t: (key: UiTextKey) => string) {
  const regions = uniqueOptions(items.map((item) => ({ value: item.regionGroupId, label: item.regionGroupLabel })));
  const owners = uniqueOptions(items.map((item) => ({ value: item.ownerKey, label: item.ownerName })));
  const usedSectors = new Set(items.map((item) => item.sectorId).filter(Boolean));
  const usedIndustries = new Set(items.map((item) => item.industryId).filter(Boolean));
  return {
    regions: [{ value: ALL, label: t("buildingOverview.allRegions") }, ...regions],
    statuses: [
      { value: ALL, label: t("buildingOverview.allStatuses") },
      { value: "working", label: t("buildingOverview.statusWorking") },
      { value: "inactive", label: t("buildingOverview.statusInactive") },
      { value: "queued", label: t("buildingOverview.statusQueued") },
      { value: "pending", label: t("buildingOverview.statusPending") },
    ],
    sectors: [{ value: ALL, label: t("buildingOverview.allSectors") }, ...sectors.filter((entry) => usedSectors.has(entry.id)).map((entry) => ({ value: entry.id, label: entry.name }))],
    industries: [{ value: ALL, label: t("buildingOverview.allIndustries") }, ...industries.filter((entry) => usedIndustries.has(entry.id)).map((entry) => ({ value: entry.id, label: entry.name }))],
    owners: [{ value: ALL, label: t("buildingOverview.allOwners") }, ...owners],
  };
}

function uniqueOptions(options: Array<{ value: string; label: string }>) {
  return [...new Map(options.map((option) => [option.value, option] as const)).values()].sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

function getCancelPayload(item: OverviewItem): BuildingOverviewCancelPayload | null {
  if (item.kind === "queued" && item.project) {
    return { source: "queued", regionId: item.regionId, queueId: item.project.queueId, targetHexId: item.targetHexId, buildingId: item.buildingId };
  }
  if (item.kind === "pending" && item.order) {
    return { source: "pending", orderId: item.order.id };
  }
  return null;
}

function getCancelKey(item: OverviewItem): string | null {
  if (item.kind === "queued" && item.project) return `${item.regionId}:${item.project.queueId}`;
  if (item.kind === "pending" && item.order) return item.order.id;
  return null;
}

function isControlledRegion(world: WorldBase, countryId: string, regionId: string): boolean {
  return (world.regionController?.[regionId] ?? world.regionOwner?.[regionId] ?? "") === countryId;
}

function resolveOwner(owner: { type: "state"; countryId: string } | { type: "company"; companyId: string }, companies: Map<string, ContentEntry>, countries: Map<string, Country>) {
  if (owner.type === "company") {
    const company = companies.get(owner.companyId);
    return {
      ownerKey: `company:${owner.companyId}`,
      ownerName: company?.name ?? owner.companyId,
      ownerIconUrl: company?.logoUrl ?? null,
    };
  }
  const country = countries.get(owner.countryId);
  return {
    ownerKey: `state:${owner.countryId}`,
    ownerName: country?.name ?? owner.countryId,
    ownerIconUrl: country?.flagUrl ?? country?.crestUrl ?? null,
  };
}

function parseOwner(input: unknown, fallbackCountryId: string): { type: "state"; countryId: string } | { type: "company"; companyId: string } {
  const candidate = input as { type?: unknown; countryId?: unknown; companyId?: unknown } | null;
  if (candidate?.type === "company" && typeof candidate.companyId === "string") return { type: "company", companyId: candidate.companyId };
  if (candidate?.type === "state" && typeof candidate.countryId === "string") return { type: "state", countryId: candidate.countryId };
  return { type: "state", countryId: fallbackCountryId };
}

function compareOverviewItems(a: OverviewItem, b: OverviewItem): number {
  return statusRank(a.status) - statusRank(b.status) || a.displayName.localeCompare(b.displayName, "ru") || a.targetHexId.localeCompare(b.targetHexId, "ru");
}

function statusRank(status: OverviewStatus): number {
  if (status === "pending") return 0;
  if (status === "queued") return 1;
  if (status === "inactive") return 2;
  return 3;
}

function getStatusKey(status: OverviewStatus): UiTextKey {
  if (status === "pending") return "buildingOverview.statusPending";
  if (status === "queued") return "buildingOverview.statusConstruction";
  if (status === "inactive") return "buildingOverview.statusInactive";
  return "buildingOverview.statusWorking";
}

function getBuildingDisplayName(entry: ContentEntry | undefined, fallbackId: string, t: (key: UiTextKey, params?: Record<string, string | number>) => string): string {
  const name = entry?.name?.trim();
  if (name && name !== fallbackId && !/^[0-9a-f]{8}-/i.test(name)) return name;
  return t("shell.preview.unknownBuilding", { id: formatIdLabel(fallbackId) });
}

function formatIdLabel(id: string): string {
  const value = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Number(value) || 0);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${sign}${Math.floor(abs)}`;
}

function formatSignedCompact(value: number): string {
  return value >= 0 ? `+${formatCompact(value)}` : formatCompact(value);
}

function formatPercent(value: number | undefined): string {
  const normalized = Number(value ?? 0);
  return `${Math.round(normalized * 100)}%`;
}
