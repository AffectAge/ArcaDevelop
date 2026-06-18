import type { ReactNode } from "react";
import {
  Bell,
  BookOpen,
  Building2,
  CircleDollarSign,
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
  SlidersHorizontal,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import type { UiTextKey } from "../../i18n/uiText";
import { useUiText } from "../../i18n/useUiText";

export type StrategyMode = "overview" | "construction" | "population" | "market" | "diplomacy" | "army" | "governance";

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

type TurnReadinessCountry = {
  id: string;
  name: string;
  color?: string;
  flagUrl?: string | null;
  status: "ready" | "waiting" | "blocked" | "ignored";
  online: boolean;
  resources: Resources;
};

type Props = {
  activeMode: StrategyMode;
  onModeChange: (mode: StrategyMode) => void;
  countryName: string;
  flagUrl?: string | null;
  crestUrl?: string | null;
  turnId: number;
  resources: Resources;
  resourceIconUrls?: Partial<Record<ResourceKey | "population", string | null>>;
  resourceGrowthByTurn?: Partial<Record<ResourceKey, number>>;
  resourceExpenseByTurn?: Partial<Record<ResourceKey, number>>;
  populationTotal: number;
  populationNetGrowth: number;
  constructionProjection?: { activeCount: number; predictedPointsSpend: number; predictedDucatSpend: number };
  technologyProjection?: { activeCount: number; predictedPointsSpend: number };
  constructionQueuePreview?: Array<{
    regionId: string;
    buildingId: string;
    progressPct: number;
    remainingConstruction: number;
  }>;
  populationPreview?: GenericPreviewItem[];
  marketPreview?: GenericPreviewItem[];
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
  turnReadinessPreview?: {
    turnId: number;
    readyCount: number;
    requiredCount: number;
    countries: TurnReadinessCountry[];
  } | null;
  countryDetails?: { provinceCount: number; totalAreaKm2: number } | null;
  notificationCount: number;
  pendingDecisionCount: number;
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
  onOpenBuildings: () => void;
  onOpenPopulation: () => void;
  onOpenMarket: () => void;
  onOpenGlobalMarket: () => void;
  onOpenDiplomacy: () => void;
  onOpenArmy: () => void;
  onOpenPolitics: () => void;
  onOpenTechnology: () => void;
  onOpenModifiers: () => void;
  onOpenDecisions: () => void;
  onOpenEvents: () => void;
};

const modeDescriptors: Array<{ key: StrategyMode; labelKey: UiTextKey; descriptionKey: UiTextKey; icon: LucideIcon }> = [
  { key: "overview", labelKey: "shell.mode.overview", descriptionKey: "shell.mode.overviewDescription", icon: Sparkles },
  { key: "construction", labelKey: "shell.mode.construction", descriptionKey: "shell.mode.constructionDescription", icon: Hammer },
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

function getModeMapLensKey(mode: StrategyMode): UiTextKey {
  switch (mode) {
    case "construction":
      return "shell.mapLens.construction";
    case "population":
      return "shell.mapLens.population";
    case "market":
      return "shell.mapLens.market";
    case "diplomacy":
      return "shell.mapLens.diplomacy";
    case "army":
      return "shell.mapLens.army";
    case "governance":
      return "shell.mapLens.governance";
    case "overview":
    default:
      return "shell.mapLens.overview";
  }
}

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

function getReadinessStatusKey(status: TurnReadinessCountry["status"]): UiTextKey {
  switch (status) {
    case "ready":
      return "shell.readiness.status.ready";
    case "blocked":
      return "shell.readiness.status.blocked";
    case "ignored":
      return "shell.readiness.status.ignored";
    case "waiting":
    default:
      return "shell.readiness.status.waiting";
  }
}

function getReadinessStatusRank(status: TurnReadinessCountry["status"]): number {
  if (status === "waiting") return 0;
  if (status === "blocked") return 1;
  if (status === "ready") return 2;
  return 3;
}

export function StrategyShell(props: Props) {
  const { t } = useUiText();
  const activeMode = modeDescriptors.find((mode) => mode.key === props.activeMode) ?? modeDescriptors[0];
  const activeActions = getModeActions(props.activeMode, props);

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
              iconUrl={props.resourceIconUrls?.[resource.key] ?? null}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <TopActionButton
            label={t("shell.notifications")}
            badge={props.pendingDecisionCount || props.notificationCount || undefined}
            icon={Bell}
            onClick={props.onOpenNotifications}
          />
          {props.onOpenCivilopedia ? (
            <TopActionButton label={t("shell.codex")} icon={BookOpen} onClick={props.onOpenCivilopedia} />
          ) : null}
          {props.isAdmin && props.onOpenAdminPanel ? (
            <TopActionButton label={t("shell.admin")} icon={SlidersHorizontal} onClick={props.onOpenAdminPanel} />
          ) : null}
          <TopActionButton label={t("shell.turnStatus")} icon={ScrollText} onClick={props.onOpenTurnStatus} />
          <button type="button" className="arc-strategy-primary" onClick={props.onNextTurn} aria-label={t("shell.endTurn")} title={t("shell.endTurn")}>
            <SkipForward size={15} />
            <span>{t("shell.endTurn")}</span>
          </button>
          <TopActionButton label={t("shell.logout")} icon={LogOut} onClick={props.onLogout} tone="danger" />
        </div>
      </div>

      <nav className="arc-strategy-mode-dock pointer-events-auto" aria-label={t("shell.modeDock")}>
        {modeDescriptors.map((mode) => {
          const Icon = mode.icon;
          const active = mode.key === props.activeMode;
          return (
            <button
              key={mode.key}
              type="button"
              className={`arc-strategy-mode-button ${active ? "arc-strategy-mode-button--active" : ""}`}
              onClick={() => props.onModeChange(mode.key)}
              aria-pressed={active}
              aria-label={t(mode.labelKey)}
              title={t(mode.labelKey)}
            >
              <Icon size={18} />
              <span>{t(mode.labelKey)}</span>
            </button>
          );
        })}
      </nav>

      <motion.aside
        key={props.activeMode}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="arc-strategy-workspace pointer-events-auto"
      >
        <div className="arc-strategy-workspace-header">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--arc-color-atlas-muted)]">
              {t("shell.workspace")}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xl font-bold">
              <activeMode.icon size={20} />
              <span>{t(activeMode.labelKey)}</span>
            </div>
          </div>
          <button type="button" className="arc-strategy-icon-button" onClick={props.onOpenClientSettings} aria-label={t("shell.clientSettings")}>
            <Menu size={18} />
          </button>
        </div>

        <p className="mt-3 text-sm leading-5 text-[var(--arc-color-atlas-muted)]">{t(activeMode.descriptionKey)}</p>

        <div className="arc-strategy-lens-note">
          <span>{t("shell.mapLens.title")}</span>
          <strong>{t(getModeMapLensKey(props.activeMode))}</strong>
        </div>

        <div className="arc-strategy-metric-grid mt-4 grid grid-cols-3 gap-2">
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

        {props.turnReadinessPreview ? (
          <TurnReadinessBoard
            preview={props.turnReadinessPreview}
            resourceIconUrls={props.resourceIconUrls}
            onOpen={props.onOpenTurnStatus}
          />
        ) : null}

        <ModeDashboard mode={props.activeMode} props={props} />
        <ModePreview mode={props.activeMode} props={props} />

        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--arc-color-atlas-muted)]">
            {t("shell.availableActions")}
          </div>
          <div className="grid gap-2">
            {activeActions.map((action) => (
              <WorkspaceAction key={action.key} action={action} />
            ))}
          </div>
        </div>

        {props.isAdmin ? (
          <div className="mt-5 rounded-lg border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper-soft)] p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--arc-color-atlas-muted)]">
              {t("shell.adminConsole")}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {props.onOpenAdminPanel ? (
                <SmallAction label={t("shell.adminPanel")} icon={<SlidersHorizontal size={14} />} onClick={props.onOpenAdminPanel} />
              ) : null}
              {props.onOpenContentPanel ? (
                <SmallAction label={t("shell.contentPanel")} icon={<BookOpen size={14} />} onClick={props.onOpenContentPanel} />
              ) : null}
              {props.onOpenGameSettings ? (
                <SmallAction label={t("shell.gameSettings")} icon={<Network size={14} />} onClick={props.onOpenGameSettings} />
              ) : null}
              {props.onAdminForceResolve ? (
                <SmallAction label={t("shell.forceResolve")} icon={<SkipForward size={14} />} onClick={props.onAdminForceResolve} />
              ) : null}
              {props.onOpenClientSettings ? (
                <SmallAction label={t("shell.clientSettings")} icon={<Menu size={14} />} onClick={props.onOpenClientSettings} />
              ) : null}
            </div>
          </div>
        ) : null}
      </motion.aside>
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
      <section className="arc-strategy-preview">
        <div className="arc-strategy-preview-header">
          <span>{t("shell.preview.constructionQueue")}</span>
          <button type="button" onClick={props.onOpenBuildings}>{t("shell.preview.open")}</button>
        </div>
        <div className="mt-2 grid gap-2">
          {(props.constructionQueuePreview ?? []).length > 0 ? (
            props.constructionQueuePreview?.map((item) => <ConstructionPreviewRow key={`${item.regionId}:${item.buildingId}`} item={item} />)
          ) : (
            <EmptyPreview text={t("shell.preview.noConstruction")} />
          )}
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

function ConstructionPreviewRow({ item }: { item: NonNullable<Props["constructionQueuePreview"]>[number] }) {
  return (
    <div className="arc-strategy-construction-row">
      <div className="min-w-0">
        <div className="truncate text-sm font-bold">{item.buildingId}</div>
        <div className="mt-0.5 truncate text-xs text-[var(--arc-color-atlas-muted)]">{item.regionId}</div>
      </div>
      <div className="w-28">
        <div className="flex justify-between text-[10px] text-[var(--arc-color-atlas-muted)]">
          <span>{Math.round(item.progressPct)}%</span>
          <span>{formatCompact(item.remainingConstruction)}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden bg-[var(--arc-color-atlas-paper-deep)]">
          <div className="h-full bg-[var(--arc-color-atlas-primary)]" style={{ width: `${Math.max(0, Math.min(100, item.progressPct))}%` }} />
        </div>
      </div>
    </div>
  );
}

function EmptyPreview({ text }: { text: string }) {
  return <div className="arc-strategy-empty-preview">{text}</div>;
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

function TurnReadinessBoard(props: {
  preview: NonNullable<Props["turnReadinessPreview"]>;
  resourceIconUrls?: Props["resourceIconUrls"];
  onOpen: () => void;
}) {
  const { t } = useUiText();
  const progressPct =
    props.preview.requiredCount > 0
      ? Math.max(0, Math.min(100, (props.preview.readyCount / props.preview.requiredCount) * 100))
      : 100;
  const countries = [...props.preview.countries]
    .sort((a, b) => getReadinessStatusRank(a.status) - getReadinessStatusRank(b.status) || a.name.localeCompare(b.name))
    .slice(0, 4);

  return (
    <section className="arc-strategy-readiness">
      <div className="arc-strategy-preview-header">
        <span>{t("shell.readiness.title")}</span>
        <button type="button" onClick={props.onOpen}>{t("shell.preview.open")}</button>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between gap-3 text-xs text-[var(--arc-color-atlas-muted)]">
          <span>{t("shell.turn", { turn: props.preview.turnId })}</span>
          <strong className="text-[var(--arc-color-atlas-ink)]">
            {t("shell.readiness.progress", { ready: props.preview.readyCount, required: props.preview.requiredCount })}
          </strong>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden bg-[var(--arc-color-atlas-paper-deep)]">
          <div className="h-full bg-[var(--arc-color-atlas-primary)]" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {countries.length > 0 ? (
          countries.map((country) => (
            <div key={country.id} className={`arc-strategy-readiness-row arc-strategy-readiness-row--${country.status}`}>
              <div className="flex min-w-0 items-center gap-2">
                {country.flagUrl ? (
                  <img src={country.flagUrl} alt="" className="h-5 w-7 flex-none object-cover" />
                ) : (
                  <span className="arc-strategy-country-dot" style={country.color ? { backgroundColor: country.color } : undefined} />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{country.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--arc-color-atlas-muted)]">
                    <span>{t(country.online ? "shell.readiness.online" : "shell.readiness.offline")}</span>
                    <span>·</span>
                    <span>{t(getReadinessStatusKey(country.status))}</span>
                  </div>
                </div>
              </div>
              <div className="arc-strategy-readiness-resources">
                {resourceDescriptors.slice(0, 5).map((resource) => {
                  const Icon = resource.icon;
                  return (
                    <span key={resource.key} className="arc-strategy-readiness-resource" title={t(resource.labelKey)}>
                      {props.resourceIconUrls?.[resource.key] ? (
                        <img src={props.resourceIconUrls[resource.key] ?? undefined} alt="" className="h-3.5 w-3.5 object-contain" />
                      ) : (
                        <Icon size={12} />
                      )}
                      <strong>{formatCompact(country.resources[resource.key] ?? 0)}</strong>
                    </span>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <EmptyPreview text={t("shell.readiness.empty")} />
        )}
      </div>
    </section>
  );
}

function getModeActions(mode: StrategyMode, props: Props): ActionItem[] {
  if (mode === "overview") {
    return [
      { key: "turn-status", labelKey: "shell.action.turnStatus", descriptionKey: "shell.action.turnStatusDescription", icon: ScrollText, onClick: props.onOpenTurnStatus },
      { key: "budget", labelKey: "shell.action.budget", descriptionKey: "shell.action.budgetDescription", icon: Wallet, onClick: props.onOpenBudget },
      { key: "events", labelKey: "shell.action.events", descriptionKey: "shell.action.eventsDescription", icon: Bell, onClick: props.onOpenEvents },
    ];
  }
  if (mode === "construction") {
    return [
      { key: "buildings", labelKey: "shell.action.buildings", descriptionKey: "shell.action.buildingsDescription", icon: Building2, onClick: props.onOpenBuildings, tone: "primary" },
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
}) {
  const Icon = props.icon;
  const net = props.growth - props.expense;
  return (
    <div className="arc-strategy-resource" title={props.label}>
      <span className="arc-strategy-resource-icon">
        {props.iconUrl ? <img src={props.iconUrl} alt="" className="h-4 w-4 object-contain" /> : <Icon size={14} />}
      </span>
      <span className="font-semibold tabular-nums">{formatCompact(props.value)}</span>
      <span className={net >= 0 ? "text-[var(--arc-color-atlas-good)]" : "text-[var(--arc-color-atlas-bad)]"}>
        {formatSignedCompact(net)}
      </span>
    </div>
  );
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
    <button
      type="button"
      className={`arc-strategy-icon-button ${props.tone === "danger" ? "arc-strategy-icon-button--danger" : ""}`}
      onClick={props.onClick}
      aria-label={props.label}
      title={props.label}
    >
      <Icon size={17} />
      {props.badge ? <span className="arc-strategy-badge">{formatCompact(props.badge)}</span> : null}
    </button>
  );
}

function WorkspaceAction({ action }: { action: ActionItem }) {
  const { t } = useUiText();
  const Icon = action.icon;
  return (
    <button type="button" className={`arc-strategy-workspace-action ${action.tone === "primary" ? "arc-strategy-workspace-action--primary" : ""}`} onClick={action.onClick}>
      <span className="arc-strategy-workspace-action-icon">
        <Icon size={18} />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-sm font-semibold">{t(action.labelKey)}</span>
        {action.descriptionKey ? (
          <span className="mt-0.5 block text-xs leading-4 text-[var(--arc-color-atlas-muted)]">{t(action.descriptionKey)}</span>
        ) : null}
      </span>
    </button>
  );
}

function SmallAction(props: { label: string; icon: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="arc-strategy-small-action" onClick={props.onClick}>
      {props.icon}
      <span className="truncate">{props.label}</span>
    </button>
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

function formatSignedCompact(value: number): string {
  return value >= 0 ? `+${formatCompact(value)}` : formatCompact(value);
}
