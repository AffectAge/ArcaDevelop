import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownUp,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Crosshair,
  FlaskConical,
  Flag,
  Hammer,
  HandCoins,
  Handshake,
  Landmark,
  LogOut,
  Menu,
  Network,
  ScrollText,
  Shield,
  SkipForward,
  ListChecks,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { HexId, ResourceFlow } from "@arcanorum/shared";
import { BASE_RESOURCE_ICON_URLS } from "../../assets/baseResourceIcons";
import type { UiTextKey } from "../../i18n/uiText";
import { useUiText } from "../../i18n/useUiText";
import { Tooltip, type TooltipStructuredContent } from "../Tooltip";
import { BuildingAtlasIcon } from "../BuildingAtlasIcon";

export type StrategyMode = "overview" | "construction" | "colonization" | "population" | "market" | "diplomacy" | "army" | "governance";

type Resources = {
  culture: number;
  science: number;
  religion: number;
  colonization: number;
  construction: number;
  ducats: number;
  gold: number;
};

type ResourceKey = keyof Resources;

type GenericPreviewItem = {
  labelKey: UiTextKey;
  value: number | string;
  delta?: number;
  detail?: string;
  detailKey?: UiTextKey;
};

type ActionItem = {
  key: string;
  labelKey: UiTextKey;
  descriptionKey?: UiTextKey;
  icon: LucideIcon;
  onClick: () => void;
  tone?: "primary" | "danger";
};

type WorkspaceTabKey = "actions" | "summary" | "records" | "trade" | "buildings";

type BuildingListEntry = {
  id: string;
  name: string;
  costConstruction?: number | null;
  costDucats?: number | null;
  industryId?: string | null;
  sectorId?: string | null;
};

type BuildingCategoryEntry = {
  id: string;
  name: string;
  logoUrl?: string | null;
};

type ConstructionCancelPayload =
  | { source: "queued"; regionId: string; queueId: string; targetHexId: HexId; buildingId: string }
  | { source: "pending"; orderId: string };

type ConstructionCancelConfirmTarget = {
  key: string;
  payload: ConstructionCancelPayload;
  buildingName: string;
  ownerName: string;
  ownerIconUrl?: string | null;
  regionId: string;
  targetHexId: HexId;
};

type MarketTradePartner = {
  id: string;
  name: string;
  flagUrl?: string | null;
  value: number;
};

export type MarketTradeOverviewRow = {
  goodId: string;
  goodName: string;
  price: number;
  priceDeltaPct: number;
  importsTotal: number;
  exportsTotal: number;
  imports: MarketTradePartner[];
  exports: MarketTradePartner[];
};

type Props = {
  activeMode: StrategyMode;
  onModeChange: (mode: StrategyMode) => void;
  workspaceOpen: boolean;
  onCloseWorkspace: () => void;
  countryName: string;
  flagUrl?: string | null;
  crestUrl?: string | null;
  turnId: number;
  resources: Resources;
  countryId?: string;
  resourceLedgerByTurn?: Record<number, ResourceFlow[]>;
  resourceGrowthByTurn?: Partial<Record<ResourceKey, number>>;
  resourceExpenseByTurn?: Partial<Record<ResourceKey, number>>;
  populationTotal: number;
  populationNetGrowth: number;
  constructionProjection?: { activeCount: number; predictedPointsSpend: number; predictedDucatSpend: number };
  technologyProjection?: { activeCount: number; predictedPointsSpend: number };
  constructionQueuePreview?: Array<{
    id: string;
    source: "queued" | "pending";
    queueId?: string;
    orderId?: string;
    regionId: string;
    targetHexId: HexId;
    buildingId: string;
    name: string;
    ownerName: string;
    ownerIconUrl?: string | null;
    progressPct: number;
    remainingConstruction: number;
    industryId?: string | null;
    sectorId?: string | null;
  }>;
  cancelingConstructionQueueKey?: string | null;
  populationPreview?: GenericPreviewItem[];
  marketPreview?: GenericPreviewItem[];
  marketTradeRows?: MarketTradeOverviewRow[];
  marketTradeLoading?: boolean;
  scenarioId?: string | null;
  buildingEntries?: BuildingListEntry[];
  industryEntries?: BuildingCategoryEntry[];
  sectorEntries?: BuildingCategoryEntry[];
  diplomacyPreview?: GenericPreviewItem[];
  armyPreview?: GenericPreviewItem[];
  governancePreview?: GenericPreviewItem[];
  storyPreview?: Array<{
    id: string;
    turn: number;
    title?: string | null;
    message: string;
    priority: "low" | "medium" | "high";
    categoryKey: UiTextKey;
  }>;
  colonizationLimit?: { active: number; max: number } | null;
  countryDetails?: { provinceCount: number; totalAreaKm2: number } | null;
  notificationCount: number;
  pendingDecisionCount: number;
  activeJournalCount: number;
  isAdmin?: boolean;
  onOpenTurnStatus: () => void;
  onNextTurn: () => void;
  onLogout: () => void;
  onOpenNotifications: () => void;
  onAdminForceResolve?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenContentPanel?: () => void;
  onOpenGameSettings?: () => void;
  onOpenClientSettings?: () => void;
  onOpenCivilopedia?: () => void;
  onOpenCountryCustomization?: () => void;
  onOpenBudget: () => void;
  onOpenBuildingOverview?: () => void;
  onOpenBuildingConstruction?: (buildingId: string) => void;
  onCancelConstructionProject?: (item: ConstructionCancelPayload) => void;
  onFocusConstructionHex?: (hexId: HexId) => void;
  onOpenPopulation: () => void;
  onOpenMarket: () => void;
  onOpenGlobalMarket: () => void;
  onOpenDiplomacy: () => void;
  onOpenArmy: () => void;
  onOpenPolitics: () => void;
  onOpenTechnology: () => void;
  onOpenModifiers: () => void;
  onOpenDecisions: () => void;
  onOpenJournal: () => void;
  onOpenEvents: () => void;
};

const modeDescriptors: Array<{ key: StrategyMode; labelKey: UiTextKey; descriptionKey: UiTextKey; icon: LucideIcon }> = [
  { key: "overview", labelKey: "shell.mode.overview", descriptionKey: "shell.mode.overviewDescription", icon: Sparkles },
  { key: "construction", labelKey: "shell.mode.construction", descriptionKey: "shell.mode.constructionDescription", icon: Hammer },
  { key: "colonization", labelKey: "shell.mode.colonization", descriptionKey: "shell.mode.colonizationDescription", icon: Flag },
  { key: "population", labelKey: "shell.mode.population", descriptionKey: "shell.mode.populationDescription", icon: Users },
  { key: "market", labelKey: "shell.mode.market", descriptionKey: "shell.mode.marketDescription", icon: HandCoins },
  { key: "diplomacy", labelKey: "shell.mode.diplomacy", descriptionKey: "shell.mode.diplomacyDescription", icon: Handshake },
  { key: "army", labelKey: "shell.mode.army", descriptionKey: "shell.mode.armyDescription", icon: Shield },
  { key: "governance", labelKey: "shell.mode.governance", descriptionKey: "shell.mode.governanceDescription", icon: Landmark },
];

const resourceDescriptors: Array<{ key: ResourceKey; labelKey: UiTextKey; icon: LucideIcon }> = [
  { key: "culture", labelKey: "shell.resource.culture", icon: BookOpen },
  { key: "science", labelKey: "shell.resource.science", icon: FlaskConical },
  { key: "religion", labelKey: "shell.resource.religion", icon: Landmark },
  { key: "colonization", labelKey: "shell.resource.colonization", icon: Flag },
  { key: "construction", labelKey: "shell.resource.construction", icon: Hammer },
  { key: "ducats", labelKey: "shell.resource.ducats", icon: Wallet },
  { key: "gold", labelKey: "shell.resource.gold", icon: CircleDollarSign },
];

const workspaceTabDescriptors: Array<{ key: WorkspaceTabKey; labelKey: UiTextKey; icon: LucideIcon }> = [
  { key: "actions", labelKey: "shell.workspaceTab.actions", icon: ListChecks },
  { key: "summary", labelKey: "shell.workspaceTab.summary", icon: Users },
  { key: "records", labelKey: "shell.workspaceTab.records", icon: ClipboardList },
  { key: "trade", labelKey: "shell.workspaceTab.trade", icon: ArrowDownUp },
  { key: "buildings", labelKey: "shell.workspaceTab.buildings", icon: Building2 },
];

type ResourceLedgerChipSummary = {
  incomeTotal: number;
  expenseTotal: number;
  net: number;
  incomeCategories: Array<{ categoryId: string; amount: number }>;
  expenseCategories: Array<{ categoryId: string; amount: number }>;
  entries: ResourceFlow[];
};

function getStoryPriorityKey(priority: "low" | "medium" | "high"): UiTextKey {
  switch (priority) {
    case "high":
      return "shell.story.priority.high";
    case "medium":
      return "shell.story.priority.medium";
    case "low":
    default:
      return "shell.story.priority.low";
  }
}

function getWorkspaceTabLabelKey(tab: WorkspaceTabKey, mode: StrategyMode): UiTextKey {
  if (tab === "records" && mode === "construction") return "shell.workspaceTab.constructionQueue";
  return workspaceTabDescriptors.find((item) => item.key === tab)?.labelKey ?? "shell.workspaceTab.actions";
}

export function StrategyShell(props: Props) {
  const { t } = useUiText();
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTabKey>("actions");
  const activeMode = modeDescriptors.find((mode) => mode.key === props.activeMode) ?? modeDescriptors[0];
  const activeActions = getModeActions(props.activeMode, props, () => setWorkspaceTab("buildings"));
  const availableWorkspaceTabs = workspaceTabDescriptors.filter((tab) => {
    if (tab.key === "summary") return props.activeMode === "overview";
    if (tab.key === "trade") return props.activeMode === "market";
    if (tab.key === "buildings") return props.activeMode === "construction";
    return true;
  });
  const activeWorkspaceTab = availableWorkspaceTabs.find((tab) => tab.key === workspaceTab) ?? availableWorkspaceTabs[0] ?? workspaceTabDescriptors[0];
  const resourceLedgerSummaries = buildResourceLedgerSummaries({
    countryId: props.countryId,
    ledgerByTurn: props.resourceLedgerByTurn,
  });

  useEffect(() => {
    if (!availableWorkspaceTabs.some((tab) => tab.key === workspaceTab)) {
      setWorkspaceTab("actions");
    }
  }, [availableWorkspaceTabs, workspaceTab]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[111] text-[var(--arc-color-atlas-ink)]">
      <div className="arc-strategy-top pointer-events-auto">
        <div className="flex min-w-0 items-center gap-3">
          <div className="arc-strategy-flag">
            {props.crestUrl || props.flagUrl ? (
              <img src={props.crestUrl ?? props.flagUrl ?? undefined} alt="" className="h-full w-full object-cover" />
            ) : (
              <Flag size={17} />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{props.countryName}</div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--arc-color-atlas-muted)]">
              {t("shell.turn", { turn: props.turnId })}
            </div>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex">
          {resourceDescriptors.map((resource) => (
            <ResourceChip
              key={resource.key}
              label={t(resource.labelKey)}
              value={props.resources[resource.key] ?? 0}
              growth={props.resourceGrowthByTurn?.[resource.key] ?? 0}
              expense={props.resourceExpenseByTurn?.[resource.key] ?? 0}
              icon={resource.icon}
              iconUrl={BASE_RESOURCE_ICON_URLS[resource.key]}
              ledgerSummary={resourceLedgerSummaries[resource.key]}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <TopActionButton
            label={t("shell.notifications")}
            badge={props.pendingDecisionCount || props.activeJournalCount || props.notificationCount || undefined}
            icon={Bell}
            onClick={props.onOpenNotifications}
          />
          {props.onOpenCivilopedia ? (
            <TopActionButton label={t("shell.codex")} icon={BookOpen} onClick={props.onOpenCivilopedia} />
          ) : null}
          {props.isAdmin && props.onOpenAdminPanel ? (
            <TopActionButton label={t("shell.admin")} icon={SlidersHorizontal} onClick={props.onOpenAdminPanel} />
          ) : null}
          {props.isAdmin && props.onOpenContentPanel ? (
            <TopActionButton label={t("shell.contentPanel")} icon={BookOpen} onClick={props.onOpenContentPanel} />
          ) : null}
          {props.isAdmin && props.onOpenGameSettings ? (
            <TopActionButton label={t("shell.gameSettings")} icon={Network} onClick={props.onOpenGameSettings} />
          ) : null}
          {props.isAdmin && props.onAdminForceResolve ? (
            <TopActionButton label={t("shell.forceResolve")} icon={SkipForward} onClick={props.onAdminForceResolve} />
          ) : null}
          {props.onOpenClientSettings ? (
            <TopActionButton label={t("shell.clientSettings")} icon={Menu} onClick={props.onOpenClientSettings} />
          ) : null}
          <TopActionButton label={t("shell.turnStatus")} icon={ScrollText} onClick={props.onOpenTurnStatus} />
          <Tooltip content={t("shell.endTurn")} placement="bottom">
            <button type="button" className="arc-strategy-primary" onClick={props.onNextTurn} aria-label={t("shell.endTurn")}>
              <SkipForward size={15} />
              <span>{t("shell.endTurn")}</span>
            </button>
          </Tooltip>
          <TopActionButton label={t("shell.logout")} icon={LogOut} onClick={props.onLogout} tone="danger" />
        </div>
      </div>

      <nav className="arc-strategy-mode-dock pointer-events-auto" aria-label={t("shell.modeDock")}>
        {modeDescriptors.map((mode) => {
          const Icon = mode.icon;
          const active = mode.key === props.activeMode;
          return (
            <Tooltip key={mode.key} content={t(mode.descriptionKey)} placement="right">
              <button
                type="button"
                className={`arc-strategy-mode-button ${active ? "arc-strategy-mode-button--active" : ""}`}
                onClick={() => props.onModeChange(mode.key)}
                aria-pressed={active}
                aria-label={t(mode.labelKey)}
              >
                <Icon size={18} />
                <span>{t(mode.labelKey)}</span>
              </button>
            </Tooltip>
          );
        })}
      </nav>

      <AnimatePresence initial={false}>
        {props.workspaceOpen ? (
          <motion.div
            key={props.activeMode}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="arc-strategy-workspace-frame pointer-events-auto"
          >
            <div className="arc-strategy-workspace-tabs" role="tablist" aria-label={t("shell.workspaceTabs")}>
              {availableWorkspaceTabs.map((tab) => {
                const Icon = tab.icon;
                const labelKey = getWorkspaceTabLabelKey(tab.key, props.activeMode);
                const active = tab.key === workspaceTab;
                return (
                  <Tooltip key={tab.key} content={t(labelKey)} placement="top">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-label={t(labelKey)}
                      className={`arc-strategy-workspace-tab ${active ? "arc-strategy-workspace-tab--active" : ""}`}
                      onClick={() => setWorkspaceTab(tab.key)}
                    >
                      <Icon size={17} />
                    </button>
                  </Tooltip>
                );
              })}
            </div>

            <aside className="arc-strategy-workspace">
              <div className="arc-strategy-workspace-header">
                <div>
                  <div className="flex items-center gap-2 text-xl font-bold">
                    <activeMode.icon size={20} />
                    <span>{t(activeMode.labelKey)}</span>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--arc-color-atlas-muted)]">
                    {t(getWorkspaceTabLabelKey(activeWorkspaceTab.key, props.activeMode))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip content={t("shell.closeWorkspace")} placement="top">
                    <button type="button" className="arc-strategy-icon-button arc-strategy-icon-button--danger" onClick={props.onCloseWorkspace} aria-label={t("shell.closeWorkspace")}>
                      <X size={18} />
                    </button>
                  </Tooltip>
                </div>
              </div>

              <div className="arc-strategy-workspace-body">
                {workspaceTab === "actions" ? (
                  <div className="arc-strategy-tab-panel">
                    <p className="text-sm leading-5 text-[var(--arc-color-atlas-muted)]">{t(activeMode.descriptionKey)}</p>
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--arc-color-atlas-muted)]">
                        {t("shell.availableActions")}
                      </div>
                      <div className="grid gap-2">
                        {activeActions.map((action) => (
                          <WorkspaceAction key={action.key} action={action} />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {workspaceTab === "summary" ? (
                  <div className="arc-strategy-tab-panel">
                    <div className="arc-strategy-metric-grid grid grid-cols-3 gap-2">
                      <AtlasMetric label={t("shell.metric.population")} value={formatCompact(props.populationTotal)} delta={props.populationNetGrowth} />
                      <AtlasMetric
                        label={t("shell.metric.regions")}
                        value={formatCompact(props.countryDetails?.provinceCount ?? 0)}
                        note={props.countryDetails ? t("shell.metric.area", { area: formatCompact(props.countryDetails.totalAreaKm2) }) : undefined}
                      />
                      <AtlasMetric
                        label={t("shell.metric.colonies")}
                        value={props.colonizationLimit ? `${props.colonizationLimit.active}/${props.colonizationLimit.max}` : "0/0"}
                      />
                    </div>
                    <ModeDashboard mode={props.activeMode} props={props} />
                  </div>
                ) : null}

                {workspaceTab === "records" ? (
                  <div className="arc-strategy-tab-panel">
                    <ModePreview mode={props.activeMode} props={props} />
                  </div>
                ) : null}

                {workspaceTab === "trade" && props.activeMode === "market" ? (
                  <div className="arc-strategy-tab-panel">
                    <MarketTradeOverview rows={props.marketTradeRows ?? []} loading={Boolean(props.marketTradeLoading)} />
                  </div>
                ) : null}

                {workspaceTab === "buildings" && props.activeMode === "construction" ? (
                  <div className="arc-strategy-tab-panel">
                    <ConstructionBuildingList
                      scenarioId={props.scenarioId}
                      buildings={props.buildingEntries ?? []}
                      industries={props.industryEntries ?? []}
                      sectors={props.sectorEntries ?? []}
                      disabledReason={props.countryId ? null : t("shell.buildings.noCountry")}
                      onSelect={props.onOpenBuildingConstruction}
                    />
                  </div>
                ) : null}
              </div>
            </aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ModePreview({ mode, props }: { mode: StrategyMode; props: Props }) {
  const { t } = useUiText();
  if (mode === "overview") {
    return (
      <section className="arc-strategy-preview">
        <div className="arc-strategy-preview-header">
          <span>{t("shell.preview.storyFeed")}</span>
          <button type="button" onClick={props.onOpenEvents}>{t("shell.preview.open")}</button>
        </div>
        <div className="mt-2 grid gap-2">
          {(props.storyPreview ?? []).length > 0 ? (
            props.storyPreview?.map((item) => <StoryPreviewRow key={item.id} item={item} />)
          ) : (
            <EmptyPreview text={t("shell.preview.noStories")} />
          )}
        </div>
      </section>
    );
  }
  if (mode === "construction") {
    return (
      <ConstructionQueueList
        scenarioId={props.scenarioId}
        items={props.constructionQueuePreview ?? []}
        industries={props.industryEntries ?? []}
        sectors={props.sectorEntries ?? []}
        cancelingKey={props.cancelingConstructionQueueKey ?? null}
        onCancel={props.onCancelConstructionProject}
        onFocusHex={props.onFocusConstructionHex}
      />
    );
  }
  if (mode === "colonization") {
    return (
      <section className="arc-strategy-preview">
        <div className="arc-strategy-preview-header">
          <span>{t("shell.preview.colonizationLedger")}</span>
        </div>
        <div className="mt-2 grid gap-2">
          <EmptyPreview text={t("shell.preview.noColonization")} />
        </div>
      </section>
    );
  }
  if (mode === "population") {
    return (
      <GenericPreview
        title={t("shell.preview.populationLedger")}
        openLabel={t("shell.preview.open")}
        onOpen={props.onOpenPopulation}
        emptyText={t("shell.preview.noPopulation")}
        rows={props.populationPreview ?? []}
      />
    );
  }
  if (mode === "market") {
    return (
      <GenericPreview
        title={t("shell.preview.marketLedger")}
        openLabel={t("shell.preview.open")}
        onOpen={props.onOpenMarket}
        emptyText={t("shell.preview.noMarket")}
        rows={props.marketPreview ?? []}
      />
    );
  }
  if (mode === "diplomacy") {
    return (
      <GenericPreview
        title={t("shell.preview.diplomacyLedger")}
        openLabel={t("shell.preview.open")}
        onOpen={props.onOpenDiplomacy}
        emptyText={t("shell.preview.noDiplomacy")}
        rows={props.diplomacyPreview ?? []}
      />
    );
  }
  if (mode === "army") {
    return (
      <GenericPreview
        title={t("shell.preview.armyLedger")}
        openLabel={t("shell.preview.open")}
        onOpen={props.onOpenArmy}
        emptyText={t("shell.preview.noArmy")}
        rows={props.armyPreview ?? []}
      />
    );
  }
  if (mode === "governance") {
    return (
      <GenericPreview
        title={t("shell.preview.governanceLedger")}
        openLabel={t("shell.preview.open")}
        onOpen={props.onOpenPolitics}
        emptyText={t("shell.preview.noGovernance")}
        rows={props.governancePreview ?? []}
      />
    );
  }
  return null;
}

function GenericPreview(props: {
  title: string;
  openLabel: string;
  onOpen: () => void;
  emptyText: string;
  rows: GenericPreviewItem[];
}) {
  return (
    <section className="arc-strategy-preview">
      <div className="arc-strategy-preview-header">
        <span>{props.title}</span>
        <button type="button" onClick={props.onOpen}>{props.openLabel}</button>
      </div>
      <div className="mt-2 grid gap-2">
        {props.rows.length > 0 ? (
          props.rows.map((row) => <GenericPreviewRow key={`${row.labelKey}:${row.detailKey ?? row.detail ?? ""}`} row={row} />)
        ) : (
          <EmptyPreview text={props.emptyText} />
        )}
      </div>
    </section>
  );
}

function GenericPreviewRow({ row }: { row: GenericPreviewItem }) {
  const { t } = useUiText();
  return (
    <div className="arc-strategy-generic-row">
      <div className="min-w-0">
        <div className="truncate text-sm font-bold">{t(row.labelKey)}</div>
        {row.detail || row.detailKey ? (
          <div className="mt-0.5 truncate text-xs text-[var(--arc-color-atlas-muted)]">
            {row.detailKey ? t(row.detailKey) : row.detail}
          </div>
        ) : null}
      </div>
      <div className="flex items-baseline gap-2 font-bold tabular-nums">
        <span>{typeof row.value === "number" ? formatCompact(row.value) : row.value}</span>
        {typeof row.delta === "number" && row.delta !== 0 ? (
          <span className={row.delta >= 0 ? "text-xs text-[var(--arc-color-atlas-good)]" : "text-xs text-[var(--arc-color-atlas-bad)]"}>
            {formatSignedCompact(row.delta)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StoryPreviewRow({ item }: { item: NonNullable<Props["storyPreview"]>[number] }) {
  const { t } = useUiText();
  return (
    <div className={`arc-strategy-story-row arc-strategy-story-row--${item.priority}`}>
      <span className="arc-strategy-story-priority">{t(getStoryPriorityKey(item.priority))}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-[var(--arc-color-atlas-muted)]">
          <span>{t(item.categoryKey)}</span>
          <span>·</span>
          <span>{t("shell.turn", { turn: item.turn })}</span>
        </div>
        <div className="mt-1 truncate text-sm font-bold">{item.title || t(item.categoryKey)}</div>
        <div className="mt-0.5 line-clamp-2 text-xs leading-4 text-[var(--arc-color-atlas-muted)]">{item.message}</div>
      </div>
    </div>
  );
}

function ConstructionPreviewRow({
  item,
  scenarioId,
  canceling,
  onRequestCancel,
  onFocusHex,
}: {
  item: NonNullable<Props["constructionQueuePreview"]>[number];
  scenarioId?: string | null;
  canceling: boolean;
  onRequestCancel?: (target: ConstructionCancelConfirmTarget) => void;
  onFocusHex?: (hexId: HexId) => void;
}) {
  const { t } = useUiText();
  const cancelTarget =
    item.source === "queued" && item.queueId
      ? { source: "queued" as const, regionId: item.regionId, queueId: item.queueId, targetHexId: item.targetHexId, buildingId: item.buildingId }
      : item.source === "pending" && item.orderId
        ? { source: "pending" as const, orderId: item.orderId }
        : null;
  return (
    <motion.div
      className="arc-strategy-construction-row"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.14 }}
    >
      <BuildingAtlasIcon
        scenarioId={scenarioId}
        buildingId={item.buildingId}
        state="underConstruction"
        className="arc-strategy-building-list-icon"
      />
      <span className="arc-strategy-building-list-main">
        <span className="arc-strategy-building-list-name">{item.name}</span>
        <span className="arc-strategy-building-list-effects">{item.regionId}</span>
        <span className="arc-strategy-construction-row-owner">
          <span className="arc-strategy-construction-row-owner-icon" aria-hidden="true">
            {item.ownerIconUrl ? <img src={item.ownerIconUrl} alt="" /> : item.ownerName.slice(0, 1).toUpperCase()}
          </span>
          <span>{item.ownerName}</span>
        </span>
      </span>
      <div className="arc-strategy-construction-row-progress">
        <div className="flex justify-between text-[10px] text-[var(--arc-color-atlas-muted)]">
          <span>{Math.round(item.progressPct)}%</span>
          <span>{formatCompact(item.remainingConstruction)}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden bg-[var(--arc-color-atlas-paper-deep)]">
          <div className="h-full bg-[var(--arc-color-atlas-primary)]" style={{ width: `${Math.max(0, Math.min(100, item.progressPct))}%` }} />
        </div>
      </div>
      <div className="arc-strategy-construction-row-actions">
        <Tooltip content={t("buildings.cancelConstructionTooltip")} placement="top">
          <button
            type="button"
            className="arc-strategy-construction-row-action arc-strategy-construction-row-action--danger"
            onClick={(event) => {
              event.stopPropagation();
              if (cancelTarget) {
                onRequestCancel?.({
                  key: item.source === "queued" ? `${item.regionId}:${item.queueId ?? ""}` : item.orderId ?? item.id,
                  payload: cancelTarget,
                  buildingName: item.name,
                  ownerName: item.ownerName,
                  ownerIconUrl: item.ownerIconUrl,
                  regionId: item.regionId,
                  targetHexId: item.targetHexId,
                });
              }
            }}
            disabled={!onRequestCancel || !cancelTarget || canceling}
            aria-label={t("buildings.cancelConstructionTooltip")}
          >
            <X size={13} aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip content={t("buildings.focusConstructionHexTooltip")} placement="top">
          <button
            type="button"
            className="arc-strategy-construction-row-action arc-strategy-construction-row-action--primary"
            onClick={(event) => {
              event.stopPropagation();
              onFocusHex?.(item.targetHexId);
            }}
            disabled={!onFocusHex}
            aria-label={t("buildings.focusConstructionHexTooltip")}
          >
            <Crosshair size={13} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </motion.div>
  );
}

function EmptyPreview({ text }: { text: string }) {
  return <div className="arc-strategy-empty-preview">{text}</div>;
}

function ConstructionBuildingList(props: {
  scenarioId?: string | null;
  buildings: BuildingListEntry[];
  industries: BuildingCategoryEntry[];
  sectors: BuildingCategoryEntry[];
  disabledReason: string | null;
  onSelect?: (buildingId: string) => void;
}) {
  const { t } = useUiText();
  const groups = buildBuildingCategoryGroups(props.buildings, props.industries, props.sectors);
  const [openGroupById, setOpenGroupById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((group, index) => [group.id, index === 0])),
  );
  useEffect(() => {
    setOpenGroupById((current) => {
      const next: Record<string, boolean> = {};
      groups.forEach((group, index) => {
        next[group.id] = current[group.id] ?? index === 0;
      });
      return next;
    });
  }, [groups.map((group) => group.id).join("|")]);

  if (groups.length === 0) {
    return <EmptyPreview text={t("shell.buildings.empty")} />;
  }
  return (
    <section className="arc-strategy-building-list arc-scrollbar" aria-label={t("shell.workspaceTab.buildings")}>
      {groups.map((group) => {
        const open = openGroupById[group.id] ?? false;
        return (
          <div key={group.id} className="arc-strategy-building-category">
            <button
              type="button"
              className="arc-strategy-building-category-header"
              aria-expanded={open}
              onClick={() => setOpenGroupById((current) => ({ ...current, [group.id]: !open }))}
            >
              <span className="arc-strategy-building-category-title">
                {group.logoUrl ? <img src={group.logoUrl} alt="" className="arc-strategy-building-category-logo" /> : null}
                <span>{group.label === "__uncategorized__" ? t("shell.buildings.uncategorized") : group.label}</span>
              </span>
              <span className="arc-strategy-building-category-count">{group.items.length}</span>
              <ChevronDown size={15} className={`arc-strategy-building-category-chevron ${open ? "arc-strategy-building-category-chevron--open" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  className="arc-strategy-building-category-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <div className="arc-strategy-building-category-rows">
                    {group.items.map((building, index) => {
                      const constructionCost = Math.max(0, Number(building.costConstruction ?? 0));
                      const ducatCost = Math.max(0, Number(building.costDucats ?? 0));
                      const disabled = Boolean(props.disabledReason || !props.onSelect);
                      return (
                        <motion.button
                          key={building.id}
                          type="button"
                          className={`arc-strategy-building-list-row ${disabled ? "arc-strategy-building-list-row--disabled" : ""}`}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={disabled ? undefined : { y: -2 }}
                          whileFocus={disabled ? undefined : { y: -2 }}
                          transition={{ duration: 0.14, delay: Math.min(index * 0.025, 0.12) }}
                          onClick={() => {
                            if (disabled) return;
                            props.onSelect?.(building.id);
                          }}
                          disabled={disabled}
                        >
                          <BuildingAtlasIcon
                            scenarioId={props.scenarioId}
                            buildingId={building.id}
                            state="working"
                            className="arc-strategy-building-list-icon"
                          />
                          <span className="arc-strategy-building-list-main">
                            <span className="arc-strategy-building-list-name">{building.name}</span>
                            {props.disabledReason ? (
                              <span className="arc-strategy-building-list-effects">{props.disabledReason}</span>
                            ) : null}
                          </span>
                          <span className="arc-strategy-building-list-meta">
                            <span className="arc-strategy-building-list-cost">
                              <img src={BASE_RESOURCE_ICON_URLS.construction} alt="" />
                              <span>{formatCompact(constructionCost)}</span>
                            </span>
                            <span className="arc-strategy-building-list-cost">
                              <img src={BASE_RESOURCE_ICON_URLS.ducats} alt="" />
                              <span>{formatCompact(ducatCost)}</span>
                            </span>
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </section>
  );
}

function ConstructionQueueList(props: {
  scenarioId?: string | null;
  items: NonNullable<Props["constructionQueuePreview"]>;
  industries: BuildingCategoryEntry[];
  sectors: BuildingCategoryEntry[];
  cancelingKey: string | null;
  onCancel?: (item: ConstructionCancelPayload) => void;
  onFocusHex?: (hexId: HexId) => void;
}) {
  const { t } = useUiText();
  const [cancelConfirmTarget, setCancelConfirmTarget] = useState<ConstructionCancelConfirmTarget | null>(null);
  const groups = buildBuildingCategoryGroups(props.items, props.industries, props.sectors);
  const [openGroupById, setOpenGroupById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((group, index) => [group.id, index === 0])),
  );
  useEffect(() => {
    setOpenGroupById((current) => {
      const next: Record<string, boolean> = {};
      groups.forEach((group, index) => {
        next[group.id] = current[group.id] ?? index === 0;
      });
      return next;
    });
  }, [groups.map((group) => group.id).join("|")]);

  if (groups.length === 0) {
    return <EmptyPreview text={t("shell.preview.noConstruction")} />;
  }
  return (
    <section className="arc-strategy-building-list arc-scrollbar" aria-label={t("shell.preview.constructionQueue")}>
      {groups.map((group) => {
        const open = openGroupById[group.id] ?? false;
        return (
          <div key={group.id} className="arc-strategy-building-category">
            <button
              type="button"
              className="arc-strategy-building-category-header"
              aria-expanded={open}
              onClick={() => setOpenGroupById((current) => ({ ...current, [group.id]: !open }))}
            >
              <span className="arc-strategy-building-category-title">
                {group.logoUrl ? <img src={group.logoUrl} alt="" className="arc-strategy-building-category-logo" /> : null}
                <span>{group.label === "__uncategorized__" ? t("shell.buildings.uncategorized") : group.label}</span>
              </span>
              <span className="arc-strategy-building-category-count">{group.items.length}</span>
              <ChevronDown size={15} className={`arc-strategy-building-category-chevron ${open ? "arc-strategy-building-category-chevron--open" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  className="arc-strategy-building-category-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <div className="arc-strategy-building-category-rows">
                    {group.items.map((item) => (
                      <ConstructionPreviewRow
                        key={`${item.source}:${item.id}`}
                        item={item}
                        scenarioId={props.scenarioId}
                        canceling={props.cancelingKey === (item.source === "queued" ? `${item.regionId}:${item.queueId ?? ""}` : item.orderId)}
                        onRequestCancel={setCancelConfirmTarget}
                        onFocusHex={props.onFocusHex}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {cancelConfirmTarget ? (
                <motion.div
                  className="arc-strategy-cancel-confirm-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  role="presentation"
                >
                  <motion.div
                    className="arc-hex-build-confirm"
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="arc-strategy-cancel-confirm-title"
                  >
                    <div className="arc-hex-build-confirm__header">
                      <h2 id="arc-strategy-cancel-confirm-title" className="arc-hex-build-confirm__title">
                        {t("buildings.cancelConstructionTitle")}
                      </h2>
                    </div>
                    <div className="arc-hex-build-confirm__body">
                      <div className="arc-hex-build-confirm__row">
                        <span>{t("buildings.buildingLabel")}</span>
                        <strong>{cancelConfirmTarget.buildingName}</strong>
                      </div>
                      <div className="arc-hex-build-confirm__row">
                        <span>{t("hexMap.hex")}</span>
                        <strong>{cancelConfirmTarget.targetHexId}</strong>
                      </div>
                      <div className="arc-hex-build-confirm__row">
                        <span>{t("buildings.owner")}</span>
                        <strong className="arc-hex-build-confirm__owner-current">
                          <span className="arc-hex-build-confirm__owner-flag" aria-hidden="true">
                            {cancelConfirmTarget.ownerIconUrl ? (
                              <img src={cancelConfirmTarget.ownerIconUrl} alt="" />
                            ) : (
                              cancelConfirmTarget.ownerName.slice(0, 1).toUpperCase()
                            )}
                          </span>
                          <span>{cancelConfirmTarget.ownerName}</span>
                        </strong>
                      </div>
                    </div>
                    <div className="arc-hex-build-confirm__actions">
                      <button
                        type="button"
                        className="arc-strategy-workspace-action arc-strategy-workspace-action--primary arc-hex-build-confirm__action"
                        onClick={() => setCancelConfirmTarget(null)}
                      >
                        <span>{t("common.cancel")}</span>
                      </button>
                      <button
                        type="button"
                        className="arc-strategy-workspace-action arc-hex-build-confirm__action arc-hex-build-confirm__action--cancel"
                        onClick={() => {
                          props.onCancel?.(cancelConfirmTarget.payload);
                          setCancelConfirmTarget(null);
                        }}
                        disabled={!props.onCancel || props.cancelingKey === cancelConfirmTarget.key}
                      >
                        <span>{t("common.confirm")}</span>
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </section>
  );
}

function buildBuildingCategoryGroups<T extends { id: string; name: string; industryId?: string | null; sectorId?: string | null }>(
  buildings: T[],
  industries: BuildingCategoryEntry[],
  sectors: BuildingCategoryEntry[],
): Array<{ id: string; label: string; logoUrl: string | null; items: T[] }> {
  const industryById = new Map(industries.map((entry) => [entry.id, entry] as const));
  const sectorById = new Map(sectors.map((entry) => [entry.id, entry] as const));
  const byId = new Map<string, { id: string; label: string; logoUrl: string | null; items: T[] }>();
  for (const building of buildings) {
    const rawCategoryId = building.industryId || building.sectorId || "__uncategorized__";
    const industry = building.industryId ? industryById.get(building.industryId) ?? null : null;
    const sector = building.sectorId ? sectorById.get(building.sectorId) ?? null : null;
    const industryLabel = industry ? resolveBuildingCategoryDisplayName(industry) : null;
    const sectorLabel = sector ? resolveBuildingCategoryDisplayName(sector) : null;
    const label =
      rawCategoryId === "__uncategorized__"
        ? "__uncategorized__"
        : building.industryId
          ? industryLabel ?? formatBuildingCategoryLabel(building.industryId)
          : building.sectorId
            ? sectorLabel ?? formatBuildingCategoryLabel(building.sectorId)
            : "__uncategorized__";
    const logoUrl = industry?.logoUrl ?? sector?.logoUrl ?? null;
    const group = byId.get(rawCategoryId) ?? { id: rawCategoryId, label, logoUrl, items: [] };
    if (!group.logoUrl && logoUrl) group.logoUrl = logoUrl;
    group.items.push(building);
    byId.set(rawCategoryId, group);
  }
  return [...byId.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    }))
    .sort((a, b) => {
      if (a.id === "__uncategorized__") return 1;
      if (b.id === "__uncategorized__") return -1;
      return a.label.localeCompare(b.label, "ru");
    });
}

function formatBuildingCategoryLabel(id: string): string {
  const withoutPrefix = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
  return withoutPrefix
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function resolveBuildingCategoryDisplayName(entry: BuildingCategoryEntry): string | null {
  const name = entry.name.trim();
  if (name && name !== entry.id && !looksLikeGeneratedId(name)) return name;
  return formatBuildingCategoryLabel(entry.id);
}

function looksLikeGeneratedId(value: string): boolean {
  const compact = value.replace(/[\s_-]+/g, "");
  return /^[0-9a-f]{24,}$/i.test(compact) || /^[0-9a-f]{8}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{12}$/i.test(compact);
}

function MarketTradeOverview({ rows, loading }: { rows: MarketTradeOverviewRow[]; loading: boolean }) {
  const { t } = useUiText();
  if (loading) {
    return (
      <section className="arc-strategy-market-trade">
        <div className="arc-strategy-preview-header">
          <span>{t("shell.marketTrade.title")}</span>
        </div>
        <div className="arc-strategy-empty-preview mt-2">{t("shell.marketTrade.loading")}</div>
      </section>
    );
  }
  if (rows.length === 0) {
    return (
      <section className="arc-strategy-market-trade">
        <div className="arc-strategy-preview-header">
          <span>{t("shell.marketTrade.title")}</span>
        </div>
        <div className="arc-strategy-empty-preview mt-2">{t("shell.marketTrade.empty")}</div>
      </section>
    );
  }
  return (
    <section className="arc-strategy-market-trade" aria-label={t("shell.marketTrade.title")}>
      <div className="arc-strategy-preview-header">
        <span>{t("shell.marketTrade.title")}</span>
      </div>
      <div className="arc-strategy-market-trade-grid mt-2">
        <div className="arc-strategy-market-trade-header">
          <span>{t("shell.marketTrade.good")}</span>
          <span>{t("shell.marketTrade.price")}</span>
          <span>{t("shell.marketTrade.exports")}</span>
          <span>{t("shell.marketTrade.imports")}</span>
        </div>
        <div className="arc-scrollbar arc-strategy-market-trade-body">
          {rows.map((row) => (
            <div key={row.goodId} className="arc-strategy-market-trade-row">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{row.goodName}</div>
                <Tooltip content={t("shell.marketTrade.priceDeltaTooltip")} placement="top">
                  <div
                    className={row.priceDeltaPct >= 0 ? "arc-strategy-market-trade-delta arc-strategy-market-trade-delta--up" : "arc-strategy-market-trade-delta arc-strategy-market-trade-delta--down"}
                  >
                    {formatSignedPercent(row.priceDeltaPct)}
                  </div>
                </Tooltip>
              </div>
              <Tooltip content={t("shell.marketTrade.priceTooltip")} placement="top">
                <div className="arc-strategy-market-trade-price tabular-nums">
                  {formatCompact(row.price)}
                </div>
              </Tooltip>
              <TradePartnerStack
                total={row.exportsTotal}
                partners={row.exports}
                emptyLabel={t("shell.marketTrade.noPartners")}
                title={t("shell.marketTrade.exportsTooltip")}
              />
              <TradePartnerStack
                total={row.importsTotal}
                partners={row.imports}
                emptyLabel={t("shell.marketTrade.noPartners")}
                title={t("shell.marketTrade.importsTooltip")}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TradePartnerStack(props: {
  total: number;
  partners: MarketTradePartner[];
  emptyLabel: string;
  title: string;
}) {
  const content: TooltipStructuredContent = {
    title: props.title,
    rows: [
      { id: "total", label: props.title, value: formatCompact(props.total), tone: props.total > 0 ? "accent" : "muted" },
      ...props.partners.map((partner) => ({
        id: partner.id,
        label: partner.name,
        value: formatCompact(partner.value),
        tone: "info" as const,
      })),
    ],
  };
  return (
    <Tooltip content={content} placement="top">
      <div className="arc-strategy-market-trade-partners">
        <span className="arc-strategy-market-trade-total tabular-nums">{formatCompact(props.total)}</span>
        <span className="arc-strategy-market-trade-flags" aria-label={props.title}>
          {props.partners.length > 0 ? (
            props.partners.map((partner) => (
              <span key={partner.id} className="arc-strategy-market-trade-flag">
                {partner.flagUrl ? <img src={partner.flagUrl} alt="" /> : <span>{partner.name.slice(0, 1).toUpperCase()}</span>}
              </span>
            ))
          ) : (
            <span className="arc-strategy-market-trade-none">{props.emptyLabel}</span>
          )}
        </span>
      </div>
    </Tooltip>
  );
}

function ModeDashboard({ mode, props }: { mode: StrategyMode; props: Props }) {
  const { t } = useUiText();
  if (mode === "overview") {
    const treasuryNet = (props.resourceGrowthByTurn?.ducats ?? 0) - (props.resourceExpenseByTurn?.ducats ?? 0);
    return (
      <DashboardSection
        title={t("shell.dashboard.overview")}
        intro={t("shell.dashboard.overviewIntro")}
        rows={[
          { label: t("shell.dashboard.treasury"), value: formatCompact(props.resources.ducats), delta: treasuryNet },
          { label: t("shell.dashboard.pendingDecisions"), value: formatCompact(props.pendingDecisionCount) },
          { label: t("shell.dashboard.notifications"), value: formatCompact(props.notificationCount) },
        ]}
      />
    );
  }
  if (mode === "construction") {
    return (
      <DashboardSection
        title={t("shell.dashboard.construction")}
        intro={t("shell.dashboard.constructionIntro")}
        rows={[
          {
            label: t("shell.dashboard.activeProjects"),
            value: formatCompact(props.constructionProjection?.activeCount ?? 0),
          },
          {
            label: t("shell.dashboard.constructionSpend"),
            value: formatCompact(props.constructionProjection?.predictedPointsSpend ?? 0),
            delta: -(props.constructionProjection?.predictedDucatSpend ?? 0),
          },
          {
            label: t("shell.dashboard.availableConstruction"),
            value: formatCompact(props.resources.construction),
          },
        ]}
      />
    );
  }
  if (mode === "colonization") {
    return (
      <DashboardSection
        title={t("shell.dashboard.colonization")}
        intro={t("shell.dashboard.colonizationIntro")}
        rows={[
          {
            label: t("shell.dashboard.colonizationReserve"),
            value: formatCompact(props.resources.colonization),
            delta: props.resourceGrowthByTurn?.colonization ?? 0,
          },
          {
            label: t("shell.dashboard.colonyCapacity"),
            value: props.colonizationLimit ? `${props.colonizationLimit.active}/${props.colonizationLimit.max}` : "0/0",
          },
          { label: t("shell.dashboard.treasury"), value: formatCompact(props.resources.ducats), delta: props.resourceGrowthByTurn?.ducats ?? 0 },
        ]}
      />
    );
  }
  if (mode === "population") {
    return (
      <DashboardSection
        title={t("shell.dashboard.population")}
        intro={t("shell.dashboard.populationIntro")}
        rows={[
          { label: t("shell.dashboard.totalPopulation"), value: formatCompact(props.populationTotal), delta: props.populationNetGrowth },
          { label: t("shell.dashboard.controlledRegions"), value: formatCompact(props.countryDetails?.provinceCount ?? 0) },
          { label: t("shell.dashboard.cultureReserve"), value: formatCompact(props.resources.culture), delta: props.resourceGrowthByTurn?.culture ?? 0 },
        ]}
      />
    );
  }
  if (mode === "market") {
    const ducatNet = (props.resourceGrowthByTurn?.ducats ?? 0) - (props.resourceExpenseByTurn?.ducats ?? 0);
    return (
      <DashboardSection
        title={t("shell.dashboard.market")}
        intro={t("shell.dashboard.marketIntro")}
        rows={[
          { label: t("shell.dashboard.ducatFlow"), value: formatSignedCompact(ducatNet), delta: ducatNet },
          { label: t("shell.dashboard.treasury"), value: formatCompact(props.resources.ducats) },
          { label: t("shell.dashboard.goldReserve"), value: formatCompact(props.resources.gold), delta: props.resourceGrowthByTurn?.gold ?? 0 },
        ]}
      />
    );
  }
  if (mode === "diplomacy") {
    return (
      <DashboardSection
        title={t("shell.dashboard.diplomacy")}
        intro={t("shell.dashboard.diplomacyIntro")}
        rows={[
          { label: t("shell.dashboard.pendingDecisions"), value: formatCompact(props.pendingDecisionCount) },
          { label: t("shell.dashboard.notifications"), value: formatCompact(props.notificationCount) },
          { label: t("shell.dashboard.religionReserve"), value: formatCompact(props.resources.religion), delta: props.resourceGrowthByTurn?.religion ?? 0 },
        ]}
      />
    );
  }
  if (mode === "army") {
    return (
      <DashboardSection
        title={t("shell.dashboard.army")}
        intro={t("shell.dashboard.armyIntro")}
        rows={[
          { label: t("shell.dashboard.controlledRegions"), value: formatCompact(props.countryDetails?.provinceCount ?? 0) },
          { label: t("shell.dashboard.treasury"), value: formatCompact(props.resources.ducats) },
          { label: t("shell.dashboard.notifications"), value: formatCompact(props.notificationCount) },
        ]}
      />
    );
  }
  return (
    <DashboardSection
      title={t("shell.dashboard.governance")}
      intro={t("shell.dashboard.governanceIntro")}
      rows={[
        { label: t("shell.dashboard.activeResearch"), value: formatCompact(props.technologyProjection?.activeCount ?? 0) },
        { label: t("shell.dashboard.scienceSpend"), value: formatCompact(props.technologyProjection?.predictedPointsSpend ?? 0) },
        { label: t("shell.dashboard.scienceReserve"), value: formatCompact(props.resources.science), delta: props.resourceGrowthByTurn?.science ?? 0 },
      ]}
    />
  );
}

function DashboardSection(props: {
  title: string;
  intro: string;
  rows: Array<{ label: string; value: string; delta?: number }>;
}) {
  return (
    <section className="arc-strategy-dashboard">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--arc-color-atlas-muted)]">{props.title}</div>
        <p className="mt-1 text-xs leading-5 text-[var(--arc-color-atlas-muted)]">{props.intro}</p>
      </div>
      <div className="mt-3 grid gap-2">
        {props.rows.map((row) => (
          <div key={row.label} className="arc-strategy-dashboard-row">
            <span>{row.label}</span>
            <span className="flex items-center gap-2 font-bold tabular-nums">
              {row.value}
              {typeof row.delta === "number" && row.delta !== 0 ? (
                <span className={row.delta >= 0 ? "text-[var(--arc-color-atlas-good)]" : "text-[var(--arc-color-atlas-bad)]"}>
                  {formatSignedCompact(row.delta)}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function getModeActions(mode: StrategyMode, props: Props, openBuildingsTab: () => void): ActionItem[] {
  if (mode === "overview") {
    return [
      { key: "colonization", labelKey: "shell.action.colonization", descriptionKey: "shell.action.colonizationDescription", icon: Flag, onClick: () => props.onModeChange("colonization"), tone: "primary" },
      { key: "turn-status", labelKey: "shell.action.turnStatus", descriptionKey: "shell.action.turnStatusDescription", icon: ScrollText, onClick: props.onOpenTurnStatus },
      { key: "budget", labelKey: "shell.action.budget", descriptionKey: "shell.action.budgetDescription", icon: Wallet, onClick: props.onOpenBudget },
      { key: "journal", labelKey: "shell.action.journal", descriptionKey: "shell.action.journalDescription", icon: BookOpen, onClick: props.onOpenJournal },
      { key: "events", labelKey: "shell.action.events", descriptionKey: "shell.action.eventsDescription", icon: Bell, onClick: props.onOpenEvents },
    ];
  }
  if (mode === "construction") {
    return [
      { key: "building-overview", labelKey: "shell.action.buildingOverview", descriptionKey: "shell.action.buildingOverviewDescription", icon: Landmark, onClick: props.onOpenBuildingOverview ?? openBuildingsTab, tone: "primary" },
    ];
  }
  if (mode === "colonization") {
    return [
      { key: "colonization-map", labelKey: "shell.action.colonization", descriptionKey: "shell.action.colonizationDescription", icon: Flag, onClick: () => props.onModeChange("colonization"), tone: "primary" },
      { key: "budget", labelKey: "shell.action.budget", descriptionKey: "shell.action.budgetDescription", icon: Wallet, onClick: props.onOpenBudget },
    ];
  }
  if (mode === "population") {
    return [
      { key: "population", labelKey: "shell.action.population", descriptionKey: "shell.action.populationDescription", icon: Users, onClick: props.onOpenPopulation, tone: "primary" },
    ];
  }
  if (mode === "market") {
    return [
      { key: "market", labelKey: "shell.action.market", descriptionKey: "shell.action.marketDescription", icon: HandCoins, onClick: props.onOpenMarket, tone: "primary" },
      { key: "global-market", labelKey: "shell.action.globalMarket", descriptionKey: "shell.action.globalMarketDescription", icon: CircleDollarSign, onClick: props.onOpenGlobalMarket },
    ];
  }
  if (mode === "diplomacy") {
    return [
      { key: "diplomacy", labelKey: "shell.action.diplomacy", descriptionKey: "shell.action.diplomacyDescription", icon: Handshake, onClick: props.onOpenDiplomacy, tone: "primary" },
    ];
  }
  if (mode === "army") {
    return [
      { key: "army", labelKey: "shell.action.army", descriptionKey: "shell.action.armyDescription", icon: Shield, onClick: props.onOpenArmy, tone: "primary" },
    ];
  }
  return [
    { key: "politics", labelKey: "shell.action.politics", descriptionKey: "shell.action.politicsDescription", icon: Landmark, onClick: props.onOpenPolitics },
    { key: "technology", labelKey: "shell.action.technology", descriptionKey: "shell.action.technologyDescription", icon: Network, onClick: props.onOpenTechnology },
    { key: "decisions", labelKey: "shell.action.decisions", descriptionKey: "shell.action.decisionsDescription", icon: ScrollText, onClick: props.onOpenDecisions },
    { key: "journal", labelKey: "shell.action.journal", descriptionKey: "shell.action.journalDescription", icon: BookOpen, onClick: props.onOpenJournal },
    { key: "events", labelKey: "shell.action.events", descriptionKey: "shell.action.eventsDescription", icon: Bell, onClick: props.onOpenEvents },
    { key: "modifiers", labelKey: "shell.action.modifiers", descriptionKey: "shell.action.modifiersDescription", icon: SlidersHorizontal, onClick: props.onOpenModifiers },
    { key: "customization", labelKey: "shell.action.customization", descriptionKey: "shell.action.customizationDescription", icon: Flag, onClick: props.onOpenCountryCustomization ?? props.onOpenPolitics },
  ];
}

function ResourceChip(props: {
  label: string;
  value: number;
  growth: number;
  expense: number;
  icon: LucideIcon;
  iconUrl?: string | null;
  ledgerSummary?: ResourceLedgerChipSummary;
}) {
  const { t } = useUiText();
  const Icon = props.icon;
  const incomeTotal = props.ledgerSummary?.incomeTotal ?? props.growth;
  const expenseTotal = props.ledgerSummary?.expenseTotal ?? props.expense;
  const net = props.ledgerSummary?.net ?? props.growth - props.expense;
  const tooltipContent = buildResourceLedgerTooltip({
    label: props.label,
    value: props.value,
    incomeTotal,
    expenseTotal,
    net,
    summary: props.ledgerSummary,
    t,
  });
  return (
    <Tooltip content={tooltipContent} placement="bottom">
      <div className="arc-strategy-resource">
        <span className={`arc-strategy-resource-icon ${props.iconUrl ? "arc-strategy-resource-icon--texture" : ""}`}>
          {props.iconUrl ? <img src={props.iconUrl} alt="" className="h-6 w-6 object-contain" /> : <Icon size={14} />}
        </span>
        <span className="font-semibold tabular-nums">{formatCompact(props.value)}</span>
        <span className={net >= 0 ? "text-[var(--arc-color-atlas-good)]" : "text-[var(--arc-color-atlas-bad)]"}>
          {formatSignedCompact(net)}
        </span>
      </div>
    </Tooltip>
  );
}

function buildResourceLedgerSummaries(params: {
  countryId?: string;
  ledgerByTurn?: Record<number, ResourceFlow[]>;
}): Partial<Record<ResourceKey, ResourceLedgerChipSummary>> {
  if (!params.countryId || !params.ledgerByTurn) return {};
  const summaries: Partial<Record<ResourceKey, ResourceLedgerChipSummary>> = {};
  const turnEntries = Object.entries(params.ledgerByTurn)
    .map(([turn, entries]) => ({ turn: Number(turn), entries }))
    .filter((entry) => Number.isFinite(entry.turn) && Array.isArray(entry.entries))
    .sort((a, b) => b.turn - a.turn);
  const latestTurn = turnEntries[0]?.turn;
  if (!Number.isFinite(latestTurn)) return summaries;
  const recentEntries = turnEntries
    .filter((entry) => entry.turn >= latestTurn - 2)
    .flatMap((entry) => entry.entries)
    .filter((entry) => entry.countryId === params.countryId);
  for (const entry of recentEntries) {
    const resourceId = entry.resourceId as ResourceKey;
    if (!resourceDescriptors.some((resource) => resource.key === resourceId)) continue;
    const summary = summaries[resourceId] ?? {
      incomeTotal: 0,
      expenseTotal: 0,
      net: 0,
      incomeCategories: [],
      expenseCategories: [],
      entries: [],
    };
    if (entry.direction === "income") {
      summary.incomeTotal += entry.amount;
      addCategoryTotal(summary.incomeCategories, entry.categoryId, entry.amount);
    } else {
      summary.expenseTotal += entry.amount;
      addCategoryTotal(summary.expenseCategories, entry.categoryId, entry.amount);
    }
    summary.net = summary.incomeTotal - summary.expenseTotal;
    summary.entries.push(entry);
    summaries[resourceId] = summary;
  }
  return summaries;
}

function addCategoryTotal(categories: Array<{ categoryId: string; amount: number }>, categoryId: string, amount: number): void {
  const existing = categories.find((entry) => entry.categoryId === categoryId);
  if (existing) {
    existing.amount += amount;
    return;
  }
  categories.push({ categoryId, amount });
}

function buildResourceLedgerTooltip(params: {
  label: string;
  value: number;
  incomeTotal: number;
  expenseTotal: number;
  net: number;
  summary?: ResourceLedgerChipSummary;
  t: (key: UiTextKey, params?: Record<string, string | number>) => string;
}): TooltipStructuredContent {
  const sections: NonNullable<TooltipStructuredContent["sections"]> = [];
  if (params.summary) {
    const incomeRows = buildCategoryRows(params.summary.incomeCategories, params.t, "+", "positive");
    if (incomeRows.length > 0) {
      sections.push({ title: params.t("resourceLedger.incomes"), rows: incomeRows });
    }
    const expenseRows = buildCategoryRows(params.summary.expenseCategories, params.t, "-", "negative");
    if (expenseRows.length > 0) {
      sections.push({ title: params.t("resourceLedger.expenses"), rows: expenseRows });
    }
    const entries = params.summary.entries.slice(0, 4);
    if (entries.length > 0) {
      sections.push({
        title: params.t("resourceLedger.recentEntries"),
        rows: entries.map((entry, index) => ({
          id: `${entry.resourceId}:${index}`,
          label: getResourceLedgerSourceLabel(entry.labelKey, params.t),
          value: `${entry.direction === "income" ? "+" : "-"}${formatCompact(entry.amount)}`,
          tone: entry.direction === "income" ? "positive" : "negative",
        })),
      });
    }
  }
  return {
    title: params.label,
    rows: [
      { id: "current", label: params.t("resourceLedger.currentValue"), value: formatCompact(params.value) },
      { id: "income", label: params.t("resourceLedger.incomeTotal"), value: `+${formatCompact(params.incomeTotal)}`, tone: "positive" },
      { id: "expense", label: params.t("resourceLedger.expenseTotal"), value: `-${formatCompact(params.expenseTotal)}`, tone: "negative" },
      { id: "net", label: params.t("resourceLedger.net"), value: formatSignedCompact(params.net), tone: params.net >= 0 ? "positive" : "negative" },
    ],
    sections,
  };
}

function buildCategoryRows(
  categories: Array<{ categoryId: string; amount: number }>,
  t: (key: UiTextKey, params?: Record<string, string | number>) => string,
  sign: "+" | "-",
  tone: "positive" | "negative",
): NonNullable<TooltipStructuredContent["rows"]> {
  return categories
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4)
    .map((category) => ({
      id: category.categoryId,
      label: getResourceLedgerCategoryLabel(category.categoryId, t),
      value: `${sign}${formatCompact(category.amount)}`,
      tone,
    }));
}

function getResourceLedgerCategoryLabel(
  categoryId: string,
  t: (key: UiTextKey, params?: Record<string, string | number>) => string,
): string {
  switch (categoryId) {
    case "base":
      return t("resourceLedger.category.base");
    case "construction":
      return t("resourceLedger.category.construction");
    case "colonization":
      return t("resourceLedger.category.colonization");
    case "customization":
      return t("resourceLedger.category.customization");
    case "demolition":
      return t("resourceLedger.category.demolition");
    case "diplomacy":
      return t("resourceLedger.category.diplomacy");
    case "military":
      return t("resourceLedger.category.military");
    case "research":
      return t("resourceLedger.category.research");
    case "state_subsidies":
      return t("resourceLedger.category.stateSubsidies");
    default:
      return t("resourceLedger.category.other");
  }
}

function getResourceLedgerSourceLabel(
  labelKey: string | undefined,
  t: (key: UiTextKey, params?: Record<string, string | number>) => string,
): string {
  switch (labelKey) {
    case "resourceLedger.source.army.formation":
      return t("resourceLedger.source.army.formation");
    case "resourceLedger.source.building.stateSubsidy":
      return t("resourceLedger.source.building.stateSubsidy");
    case "resourceLedger.source.colonization.support":
      return t("resourceLedger.source.colonization.support");
    case "resourceLedger.source.construction.building":
      return t("resourceLedger.source.construction.building");
    case "resourceLedger.source.construction.corridor":
      return t("resourceLedger.source.construction.corridor");
    case "resourceLedger.source.construction.demolition":
      return t("resourceLedger.source.construction.demolition");
    case "resourceLedger.source.customization.country":
      return t("resourceLedger.source.customization.country");
    case "resourceLedger.source.customization.hexRename":
      return t("resourceLedger.source.customization.hexRename");
    case "resourceLedger.source.diplomacy.transfer":
      return t("resourceLedger.source.diplomacy.transfer");
    case "resourceLedger.source.technology.research":
      return t("resourceLedger.source.technology.research");
    default:
      return t("resourceLedger.source.generic");
  }
}

function TopActionButton(props: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  badge?: number;
  tone?: "default" | "danger";
}) {
  const Icon = props.icon;
  return (
    <Tooltip content={props.label} placement="bottom">
      <button
        type="button"
        className={`arc-strategy-icon-button ${props.tone === "danger" ? "arc-strategy-icon-button--danger" : ""}`}
        onClick={props.onClick}
        aria-label={props.label}
      >
        <Icon size={17} />
        {props.badge ? <span className="arc-strategy-badge">{formatCompact(props.badge)}</span> : null}
      </button>
    </Tooltip>
  );
}

function WorkspaceAction({ action }: { action: ActionItem }) {
  const { t } = useUiText();
  const Icon = action.icon;
  const button = (
    <button
      type="button"
      className={`arc-strategy-workspace-action arc-strategy-workspace-action--available ${action.tone === "primary" ? "arc-strategy-workspace-action--primary" : ""}`}
      onClick={action.onClick}
    >
      <span className="arc-strategy-workspace-action-icon">
        <Icon size={18} />
      </span>
      <span className="arc-strategy-workspace-action-label min-w-0 text-left">
        <span className="block truncate text-sm font-semibold">{t(action.labelKey)}</span>
      </span>
    </button>
  );
  if (!action.descriptionKey) return button;
  return (
    <Tooltip content={t(action.descriptionKey)} placement="top" referenceClassName="flex w-full">
      {button}
    </Tooltip>
  );
}

function AtlasMetric(props: { label: string; value: string; delta?: number; note?: string }) {
  return (
    <div className="arc-strategy-metric">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--arc-color-atlas-muted)]">{props.label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-bold tabular-nums">{props.value}</span>
        {typeof props.delta === "number" && props.delta !== 0 ? (
          <span className={props.delta >= 0 ? "text-xs text-[var(--arc-color-atlas-good)]" : "text-xs text-[var(--arc-color-atlas-bad)]"}>
            {formatSignedCompact(props.delta)}
          </span>
        ) : null}
      </div>
      {props.note ? <div className="mt-1 text-[10px] text-[var(--arc-color-atlas-muted)]">{props.note}</div> : null}
    </div>
  );
}

function formatCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const units = [
    { n: 1_000_000_000_000, s: "T" },
    { n: 1_000_000_000, s: "B" },
    { n: 1_000_000, s: "M" },
    { n: 1_000, s: "K" },
  ] as const;
  for (const unit of units) {
    if (abs >= unit.n) {
      const scaled = abs / unit.n;
      const text =
        scaled >= 100
          ? Math.floor(scaled).toString()
          : scaled >= 10
            ? scaled.toFixed(1).replace(/\.0$/, "")
            : scaled.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
      return `${sign}${text}${unit.s}`;
    }
  }
  return `${sign}${Math.floor(abs)}`;
}

function formatSignedPercent(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

function formatSignedCompact(value: number): string {
  return value >= 0 ? `+${formatCompact(value)}` : formatCompact(value);
}
