import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@headlessui/react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { Country, DiplomacyProposal, HexId, MapUnit, OrderDelta, TurnActionItem, UnitTypeDefinition, WsOutMessage } from "@arcanorum/shared";
import { AuthPanel, type AuthSuccess } from "./components/AuthPanel";
import { MapView } from "./components/MapView";
import { StrategyShell, type MarketTradeOverviewRow, type StrategyMode, type StrategyShellSelectedHexDetails } from "./components/strategy-shell/StrategyShell";
import { CommandPalette } from "./components/CommandPalette";
import { AdminPanel } from "./components/AdminPanel";
import { TurnStatusModal } from "./components/TurnStatusModal";
import { GameSettingsPanel } from "./components/GameSettingsPanel";
import { CountryCustomizationModal } from "./components/CountryCustomizationModal";
import { ClientSettingsModal } from "./components/ClientSettingsModal";
import { CivilopediaModal } from "./components/CivilopediaModal";
import { PopulationStatsModal } from "./components/PopulationStatsModal";
import { StateBudgetModal } from "./components/StateBudgetModal";
import { MarketModal } from "./components/MarketModal";
import { PoliticsModal } from "./components/PoliticsModal";
import { TechnologyModal } from "./components/TechnologyModal";
import { CountryModifiersModal } from "./components/CountryModifiersModal";
import { CountryDecisionsModal } from "./components/CountryDecisionsModal";
import { CountryEventsModal } from "./components/CountryEventsModal";
import { CountryJournalModal } from "./components/CountryJournalModal";
import { DiplomacyModal } from "./components/DiplomacyModal";
import { DiplomacyProposalStoryModal } from "./components/DiplomacyProposalStoryModal";
import { InAppNotificationTray, type InAppUiNotification } from "./components/InAppNotificationTray";
import { TurnAdvancerHub } from "./components/TurnAdvancerHub";
import { NotificationHistoryModal } from "./components/NotificationHistoryModal";
import { RegistrationApprovalModal } from "./components/RegistrationApprovalModal";
import { ElectionResultsModal } from "./components/ElectionResultsModal";
import { BuildingAtlasIcon } from "./components/BuildingAtlasIcon";
import { BuildingOverviewModal } from "./components/BuildingOverviewModal";
import {
  adminReviewRegistration,
  apiBase,
  fetchContentEntries,
  fetchCountries,
  fetchCountryEvents,
  fetchCurrentTurnOrders,
  fetchMarketOverview,
  fetchPendingUiNotifications,
  fetchPublicGameUiSettings,
  fetchTurnActions,
  fetchWorldSnapshot,
  markUiNotificationViewed,
  acceptDiplomacyProposal,
  cancelCountryBuild,
  createMarketTransportCorridor,
  queueCountryColonizer,
  cancelUnitTraining,
  disbandUnit,
  getUnitsOverview,
  previewMarketTransportCorridor,
  rejectDiplomacyProposal,
  trainUnit,
  type ContentEntry,
  type MarketTransportCorridor,
  type MarketOverviewResponse,
  type MarketTransportCorridorPreview,
  type TransportMode,
  updateMarketTransportCorridor,
} from "./lib/api";
import { BASE_RESOURCE_ICON_URLS } from "./assets/baseResourceIcons";
import { useWs } from "./lib/useWs";
import { useGameStore } from "./store/gameStore";
import { MAP_NAVIGATION_SETTINGS_EVENT, readMapNavigationSettings, writeMapNavigationSettings } from "./map/mapNavigationSettings";
import type { MapInteractionMode, MapLensId } from "./map/mapLensTypes";
import type { UiTextKey } from "./i18n/uiText";
import { useUiText } from "./i18n/useUiText";

const AUTH_BACKGROUND_FILE_NAME = "auth-background.png";
const AUTH_BACKGROUND_FALLBACK_URL = "/game-assets/utils/fallback-auth-background.png";

function normalizeScenarioAssetSegment(scenarioId: string | null | undefined): string {
  return scenarioId && /^[a-zA-Z0-9_-]+$/.test(scenarioId) ? scenarioId : "default";
}

type SessionCountry = {
  name: string;
  color: string;
  flagUrl?: string | null;
  crestUrl?: string | null;
};

type RegistrationApprovalCountry = Extract<
  InAppUiNotification["action"],
  { type: "registration-approval" }
>["country"];
type ElectionResultsAction = Extract<InAppUiNotification["action"], { type: "election-results" }>;
type CorridorPlacementState = {
  transportMode: TransportMode;
  points: Array<{ hexId: HexId; lng: number; lat: number }>;
  previewHexIds: HexId[];
  costConstruction: number | null;
  connectedRegionIds: string[];
  blockingReason: string | null;
  pending: boolean;
  previewNonce: number;
};
const RESOLVE_START_TIMEOUT_MS = 12_000;
const MARKET_SHELL_PARTNER_LIMIT = 3;
const STRATEGY_SHELL_STATE_STORAGE_KEY = "arcanorum.strategyShell.state.v1";

function readStrategyShellState(): { mode: StrategyMode; workspaceOpen: boolean } {
  if (typeof window === "undefined") return { mode: "overview", workspaceOpen: true };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STRATEGY_SHELL_STATE_STORAGE_KEY) ?? "{}") as Partial<{
      mode: StrategyMode;
      workspaceOpen: boolean;
    }>;
    const validMode = parsed.mode && isStrategyMode(parsed.mode) ? parsed.mode : "overview";
    return { mode: validMode, workspaceOpen: typeof parsed.workspaceOpen === "boolean" ? parsed.workspaceOpen : true };
  } catch {
    return { mode: "overview", workspaceOpen: true };
  }
}

function isStrategyMode(value: string): value is StrategyMode {
  return ["overview", "construction", "colonization", "population", "market", "diplomacy", "army", "units", "governance"].includes(value);
}

function resolveSuggestedMapMode(_strategyMode: StrategyMode): MapInteractionMode {
  return "overview";
}

function resolveSuggestedMapLens(_strategyMode: StrategyMode): MapLensId {
  return "terrain";
}

function getCorridorErrorKey(code: string): UiTextKey {
  switch (code) {
    case "CORRIDOR_ROUTE_TOO_SHORT":
      return "shell.infrastructure.error.routeTooShort";
    case "CORRIDOR_ENDPOINT_CITY_REQUIRED":
      return "shell.infrastructure.error.cityEndpointRequired";
    case "CORRIDOR_ROUTE_IMPOSSIBLE":
      return "shell.infrastructure.error.routeImpossible";
    case "CORRIDOR_CONSTRUCTION_RIGHT_REQUIRED":
      return "shell.infrastructure.error.constructionRightRequired";
    case "CORRIDOR_NOT_BUILDING":
      return "shell.infrastructure.error.notBuilding";
    case "CORRIDOR_STILL_BUILDING":
      return "shell.infrastructure.error.stillBuilding";
    case "NOT_MARKET_MEMBER":
    case "FORBIDDEN":
      return "shell.infrastructure.error.marketAccess";
    default:
      return "shell.infrastructure.error.generic";
  }
}

function sumPositiveRecord(input: Record<string, number> | undefined): number {
  return Object.values(input ?? {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
}

function calculateLastRelativeDeltaPct(history: number[] | undefined): number {
  if (!history || history.length < 2) return 0;
  const previous = Number(history[history.length - 2] ?? 0);
  const current = Number(history[history.length - 1] ?? 0);
  if (!Number.isFinite(previous) || Math.abs(previous) < 1e-9) return 0;
  return ((current - previous) / previous) * 100;
}

function resolveColonizerQueueErrorKey(code: string): UiTextKey {
  if (code === "HEX_NOT_CONTROLLED") return "hexMap.queueColonizerHexNotControlled";
  if (code === "CIVILIAN_UNIT_QUEUE_HEX_OCCUPIED" || code === "CIVILIAN_UNIT_HEX_OCCUPIED") {
    return "hexMap.queueColonizerHexOccupied";
  }
  if (code === "INSUFFICIENT_COLONIZATION_POINTS") return "hexMap.queueColonizerInsufficientColonization";
  if (code === "INSUFFICIENT_DUCATS") return "hexMap.queueColonizerInsufficientDucats";
  return "hexMap.queueColonizerFailed";
}

function resolveUnitTrainingErrorKey(code: string): UiTextKey {
  if (code === "UNIT_TRAIN_NO_VALID_DEPLOYMENT_HEX") return "shell.units.error.noValidHex";
  if (code === "UNIT_TRAIN_REGION_NOT_CONTROLLED") return "shell.units.error.regionNotControlled";
  if (code === "UNIT_TRAIN_INSUFFICIENT_RESOURCES") return "shell.units.error.insufficientResources";
  if (code === "UNIT_TYPE_NOT_FOUND") return "shell.units.error.unitTypeNotFound";
  if (code === "UNIT_TRAIN_INVALID_PAYLOAD") return "shell.units.error.invalidPayload";
  return "shell.units.error.trainFailed";
}

function resolveWsPlayerErrorKey(code: string): UiTextKey | null {
  if (code === "FOUND_CITY_NAME_REQUIRED") return "hexMap.foundCityNameRequired";
  if (code === "FOUND_CITY_NAME_TOO_LONG") return "hexMap.foundCityNameRequired";
  return null;
}

function buildMarketShellPartners(input: Record<string, number> | undefined, countryById: Map<string, Country>) {
  return Object.entries(input ?? {})
    .map(([countryId, value]) => {
      const country = countryById.get(countryId);
      return {
        id: countryId,
        name: country?.name ?? countryId,
        flagUrl: country?.flagUrl ?? country?.crestUrl ?? null,
        value: Math.max(0, Number(value) || 0),
      };
    })
    .filter((partner) => partner.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "ru"))
    .slice(0, MARKET_SHELL_PARTNER_LIMIT);
}

function isTechnicalContentName(name: string, entry: ContentEntry | undefined, fallbackId: string): boolean {
  const normalizedFallbackId = fallbackId.replace(/^building:/, "");
  return (
    name === fallbackId ||
    name === normalizedFallbackId ||
    name === entry?.id ||
    name === entry?.nameKey ||
    name === `buildings.${normalizedFallbackId}.name` ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)
  );
}

function isHexId(value: string): value is HexId {
  return /^hex:-?\d+:-?\d+$/.test(value);
}

function formatShortEntityId(id: string): string {
  const normalized = id.replace(/^[a-z]+:/i, "");
  const uuidMatch = normalized.match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i);
  if (uuidMatch) {
    return uuidMatch[0].slice(0, 8);
  }
  return normalized.length > 24 ? `${normalized.slice(0, 24)}...` : normalized;
}

function getBuildingDisplayName(
  entry: ContentEntry | undefined,
  fallbackId: string,
  t: (key: UiTextKey, params?: Record<string, string | number>) => string,
): string {
  const name = entry?.name?.trim() ?? "";
  if (name && !isTechnicalContentName(name, entry, fallbackId)) {
    return name;
  }
  return t("shell.preview.unknownBuilding", { id: formatShortEntityId(fallbackId) });
}

function notificationSemanticKey(item: InAppUiNotification): string {
  if (item.action.type === "country-event") {
    return `country-event:${item.action.countryId}:${item.action.eventId}`;
  }
  if (item.action.type === "diplomacy-proposal") {
    return `diplomacy-proposal:${item.action.proposalId}:${item.action.countryId}:r${item.action.revision ?? 1}`;
  }
  return item.id;
}

function dedupeNotifications(items: InAppUiNotification[]): InAppUiNotification[] {
  const seenById = new Set<string>();
  const seenBySemanticKey = new Set<string>();
  const result: InAppUiNotification[] = [];
  for (const item of items) {
    if (seenById.has(item.id)) continue;
    const semanticKey = notificationSemanticKey(item);
    if (seenBySemanticKey.has(semanticKey)) continue;
    seenById.add(item.id);
    seenBySemanticKey.add(semanticKey);
    result.push(item);
  }
  return result;
}

function getStoryCategoryKey(category: string): UiTextKey {
  switch (category) {
    case "colonization":
      return "shell.story.category.colonization";
    case "politics":
      return "shell.story.category.politics";
    case "economy":
      return "shell.story.category.economy";
    case "military":
      return "shell.story.category.military";
    case "diplomacy":
      return "shell.story.category.diplomacy";
    case "system":
    default:
      return "shell.story.category.system";
  }
}

export default function App() {
  const { t } = useUiText();

  const worldResyncInFlightRef = useRef(false);
  const replayRequestInFlightRef = useRef(false);
  const resolveStartTimeoutRef = useRef<number | null>(null);
  const [entryLoadingGate, setEntryLoadingGate] = useState<"hidden" | "loading" | "ready">("hidden");
  const [mapReady, setMapReady] = useState(false);
  const [pendingDeltaAckVersion, setPendingDeltaAckVersion] = useState<number | null>(null);
  const [pendingReplayFromWorldStateVersion, setPendingReplayFromWorldStateVersion] = useState<number | null>(null);
  const [turnResolveOverlay, setTurnResolveOverlay] = useState<
    | { phase: "idle" }
    | { phase: "processing"; startedAtMs: number }
    | { phase: "done"; startedAtMs: number; finishedAtMs: number; durationMs: number; resolvedTurnId: number }
  >({ phase: "idle" });
  const [uiNotifications, setUiNotifications] = useState<InAppUiNotification[]>([]);
  const [uiNotificationHistory, setUiNotificationHistory] = useState<InAppUiNotification[]>([]);
  const [viewedUiNotificationIds, setViewedUiNotificationIds] = useState<Set<string>>(new Set());
  const [notificationHistoryOpen, setNotificationHistoryOpen] = useState(false);
  const [registrationApprovalModal, setRegistrationApprovalModal] = useState<{
    open: boolean;
    country: RegistrationApprovalCountry | null;
    notificationId: string | null;
    pending: boolean;
  }>({ open: false, country: null, notificationId: null, pending: false });
  const [electionResultsModal, setElectionResultsModal] = useState<{
    open: boolean;
    action: ElectionResultsAction | null;
  }>({ open: false, action: null });
  const [country, setCountry] = useState<SessionCountry | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [activeStrategyMode, setActiveStrategyMode] = useState<StrategyMode>(() => readStrategyShellState().mode);
  const [strategyWorkspaceOpen, setStrategyWorkspaceOpen] = useState(() => readStrategyShellState().workspaceOpen);
  const setStrategyModeAndOpenWorkspace = useCallback((mode: StrategyMode) => {
    setActiveStrategyMode(mode);
    setStrategyWorkspaceOpen(true);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STRATEGY_SHELL_STATE_STORAGE_KEY,
        JSON.stringify({ mode: activeStrategyMode, workspaceOpen: strategyWorkspaceOpen }),
      );
    } catch {
      // Local UI persistence is optional.
    }
  }, [activeStrategyMode, strategyWorkspaceOpen]);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [populationStatsOpen, setPopulationStatsOpen] = useState(false);
  const [stateBudgetOpen, setStateBudgetOpen] = useState(false);
  const [buildingOverviewOpen, setBuildingOverviewOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [globalMarketOpen, setGlobalMarketOpen] = useState(false);
  const [marketShellOverview, setMarketShellOverview] = useState<MarketOverviewResponse | null>(null);
  const [marketTransportCorridors, setMarketTransportCorridors] = useState<MarketTransportCorridor[]>([]);
  const [marketShellCountries, setMarketShellCountries] = useState<Country[]>([]);
  const [marketShellLoading, setMarketShellLoading] = useState(false);
  const [corridorPlacement, setCorridorPlacement] = useState<CorridorPlacementState | null>(null);
  const [politicsOpen, setPoliticsOpen] = useState(false);
  const [technologyOpen, setTechnologyOpen] = useState(false);
  const [modifiersOpen, setModifiersOpen] = useState(false);
  const [decisionsOpen, setDecisionsOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [focusedDiplomacyProposalId, setFocusedDiplomacyProposalId] = useState<string | null>(null);
  const [diplomacyStoryOpen, setDiplomacyStoryOpen] = useState(false);
  const [diplomacyRevisionDraft, setDiplomacyRevisionDraft] = useState<DiplomacyProposal | null>(null);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [focusedEventPendingId, setFocusedEventPendingId] = useState<string | null>(null);
  const [diplomacyOpen, setDiplomacyOpen] = useState(false);
  const [adminInitialHexId, setAdminInitialHexId] = useState<string | null>(null);
  const [turnStatusOpen, setTurnStatusOpen] = useState(false);
  const [turnActions, setTurnActions] = useState<TurnActionItem[]>([]);
  const [turnActionsNonce, setTurnActionsNonce] = useState(0);
  const [gameSettingsOpen, setGameSettingsOpen] = useState(false);
  const [countryCustomizationOpen, setCountryCustomizationOpen] = useState(false);
  const [clientSettingsOpen, setClientSettingsOpen] = useState(false);
  const [civilopediaOpen, setCivilopediaOpen] = useState(false);
  const [civilopediaIntent, setCivilopediaIntent] = useState<
    | { type: "open-entry"; entryId: string }
    | { type: "region"; hexId: string; hexName: string; createIfMissing: boolean }
    | null
  >(null);
  const [authBackgroundUrl, setAuthBackgroundUrl] = useState(AUTH_BACKGROUND_FALLBACK_URL);
  const [resourceGrowthByTurn, setResourceGrowthByTurn] = useState<{
    culture: number;
    science: number;
    religion: number;
    colonization: number;
    construction: number;
    ducats: number;
    gold: number;
  }>({
    culture: 0,
    science: 0,
    religion: 0,
    colonization: 0,
    construction: 0,
    ducats: 0,
    gold: 0,
  });
  const [customizationDucatSpend, setCustomizationDucatSpend] = useState<{ turnId: number; amount: number }>({
    turnId: 0,
    amount: 0,
  });
  const [hexRenameDucatSpend, setHexRenameDucatSpend] = useState<{ turnId: number; amount: number }>({
    turnId: 0,
    amount: 0,
  });
  const [maxActiveColonizations, setMaxActiveColonizations] = useState(3);
  const [colonizationCostPer1000Km2, setColonizationCostPer1000Km2] = useState({ points: 5, ducats: 5 });
  const [landDivisionStackLimitPerHex, setLandDivisionStackLimitPerHex] = useState(4);
  const [demolitionCostConstructionPercent, setDemolitionCostConstructionPercent] = useState(20);
  const [hexRenameDucatsCost, setHexRenameDucatsCost] = useState(25);
  const [showAntarctica, setShowAntarctica] = useState(false);
  const [showMapControls, setShowMapControls] = useState(false);
  const [showZoomIndicator, setShowZoomIndicator] = useState(true);
  const [showZoomIndicatorLoadedKey, setShowZoomIndicatorLoadedKey] = useState<string | null>(null);
  const [edgeScrollEnabled, setEdgeScrollEnabled] = useState(true);
  const [sortNotifications, setSortNotifications] = useState(true);
  const [publicUiLoaded, setPublicUiLoaded] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState("default");

  const scenarioAuthBackgroundUrl = useMemo(
    () => `/scenario-assets/${normalizeScenarioAssetSegment(activeScenarioId)}/assets/utils/${AUTH_BACKGROUND_FILE_NAME}`,
    [activeScenarioId],
  );

  const countryColorById = useMemo(
    () => Object.fromEntries(countries.map((item) => [item.id, item.color] as const)),
    [countries],
  );
  const countryNameById = useMemo(
    () => Object.fromEntries(countries.map((item) => [item.id, item.name] as const)),
    [countries],
  );

  useEffect(() => {
    setAuthBackgroundUrl(scenarioAuthBackgroundUrl);
  }, [scenarioAuthBackgroundUrl]);
  const countryById = useMemo(() => new Map(countries.map((item) => [item.id, item] as const)), [countries]);
  const [buildingEntries, setBuildingEntries] = useState<ContentEntry[]>([]);
  const [unitTypeEntries, setUnitTypeEntries] = useState<UnitTypeDefinition[]>([]);
  const [companyEntries, setCompanyEntries] = useState<ContentEntry[]>([]);
  const [industryEntries, setIndustryEntries] = useState<ContentEntry[]>([]);
  const [sectorEntries, setSectorEntries] = useState<ContentEntry[]>([]);
  const [cancelingConstructionQueueKey, setCancelingConstructionQueueKey] = useState<string | null>(null);
  const [canceledConstructionQueueKeys, setCanceledConstructionQueueKeys] = useState<Set<string>>(() => new Set());
  const [mapFocusRequest, setMapFocusRequest] = useState<{ hexId: HexId; nonce: number } | null>(null);
  const [queueingColonizerHexId, setQueueingColonizerHexId] = useState<HexId | null>(null);
  const [selectedHexDetails, setSelectedHexDetails] = useState<StrategyShellSelectedHexDetails | null>(null);
  const [openHexWorkspaceRequestId, setOpenHexWorkspaceRequestId] = useState(0);
  const [colonizerPlacement, setColonizerPlacement] = useState<{ active: boolean } | null>(null);
  const [unitTrainingPlacement, setUnitTrainingPlacement] = useState<{ unitTypeId: string } | null>(null);
  const [cancelingUnitTrainingQueueId, setCancelingUnitTrainingQueueId] = useState<string | null>(null);
  const [hexBuildPlacement, setHexBuildPlacement] = useState<{
    building: ContentEntry;
    owner: { type: "state"; countryId: string } | { type: "company"; companyId: string };
  } | null>(null);
  const [hexBuildConfirmTarget, setHexBuildConfirmTarget] = useState<{
    hexId: HexId;
    regionId: string;
    building: ContentEntry;
    owner: { type: "state"; countryId: string } | { type: "company"; companyId: string };
  } | null>(null);
  const [technologyEntries, setTechnologyEntries] = useState<ContentEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<ContentEntry[]>([]);
  const [turnTimerUi, setTurnTimerUi] = useState<{ enabled: boolean; secondsPerTurn: number; startedAtMs: number | null }>({
    enabled: false,
    secondsPerTurn: 300,
    startedAtMs: null,
  });
  const auth = useGameStore((s) => s.auth);
  const wsResumeFromWorldStateVersion = useGameStore((s) => (s.worldBase ? s.worldStateVersion : null));
  const turnId = useGameStore((s) => s.turnId);
  const worldBase = useGameStore((s) => s.worldBase);
  const ordersByTurn = useGameStore((s) => s.ordersByTurn);
  const selectedHexId = useGameStore((s) => s.selectedHexId);
  const setAuth = useGameStore((s) => s.setAuth);
  const setWorldBase = useGameStore((s) => s.setWorldBase);
  const applyWorldDelta = useGameStore((s) => s.applyWorldDelta);
  const addOrder = useGameStore((s) => s.addOrder);
  const removeOrder = useGameStore((s) => s.removeOrder);
  const setTurnOrders = useGameStore((s) => s.setTurnOrders);
  const setPresence = useGameStore((s) => s.setPresence);
  const resetOverlay = useGameStore((s) => s.resetOverlay);
  const updateCountryResources = useGameStore((s) => s.updateCountryResources);
  const eventLog = useGameStore((s) => s.eventLog);

  const pendingDecisionNotificationCount = useMemo(
    () => uiNotificationHistory.filter((item) => item.action.type === "registration-approval" || item.action.type === "country-event" || item.action.type === "diplomacy-proposal").length,
    [uiNotificationHistory],
  );
  const addEvent = useGameStore((s) => s.addEvent);
  const pruneLogEntries = useGameStore((s) => s.pruneLogEntries);
  const eventLogRetentionTurns = useGameStore((s) => s.eventLogRetentionTurns);
  const setEventLogRetentionTurns = useGameStore((s) => s.setEventLogRetentionTurns);
  const turnResolveOverlayRef = useRef(turnResolveOverlay);

  useEffect(() => {
    if (!auth?.countryId) {
      setUiNotifications([]);
      setUiNotificationHistory([]);
      setViewedUiNotificationIds(new Set());
      return;
    }
    const belongsToCurrentCountry = (item: InAppUiNotification) =>
      item.action.type !== "country-event" || item.action.countryId === auth.countryId;
    setUiNotifications((prev) => dedupeNotifications(prev.filter(belongsToCurrentCountry)).slice(0, 8));
    setUiNotificationHistory((prev) => {
      const next = dedupeNotifications(prev.filter(belongsToCurrentCountry));
      next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return next.slice(0, 200);
    });
  }, [auth?.countryId]);

  useEffect(() => {
    turnResolveOverlayRef.current = turnResolveOverlay;
  }, [turnResolveOverlay]);

  const clearResolveStartTimeout = useCallback(() => {
    if (resolveStartTimeoutRef.current != null) {
      window.clearTimeout(resolveStartTimeoutRef.current);
      resolveStartTimeoutRef.current = null;
    }
  }, []);

  const armResolveStartTimeout = useCallback(
    (source: "auto" | "manual") => {
      clearResolveStartTimeout();
      resolveStartTimeoutRef.current = window.setTimeout(() => {
        if (turnResolveOverlayRef.current.phase === "processing") {
          return;
        }
        toast.warning(
          source === "auto"
            ? t("shell.resolveAutoUnconfirmed")
            : t("shell.resolveManualUnconfirmed"),
          {
            description:
              source === "auto"
                ? t("shell.resolveTimeoutAutoDescription")
                : t("shell.resolveTimeoutManualDescription"),
          },
        );
      }, RESOLVE_START_TIMEOUT_MS);
    },
    [clearResolveStartTimeout, t],
  );

  const hydrateCurrentTurnOrders = useCallback(
    async (token: string) => {
      try {
        const { turnId: ordersTurnId, orders } = await fetchCurrentTurnOrders(token);
        setTurnOrders(ordersTurnId, orders);
      } catch {
        // Silently ignore hydration failures; live ORDER_BROADCAST still updates overlay.
      }
    },
    [setTurnOrders],
  );

  const resyncWorldState = useCallback(async () => {
    if (worldResyncInFlightRef.current) {
      return;
    }
    const token = useGameStore.getState().auth?.token;
    if (!token) {
      return;
    }
    worldResyncInFlightRef.current = true;
    try {
      const snapshot = await fetchWorldSnapshot(token);
      setWorldBase(snapshot.worldBase, snapshot.turnId, snapshot.worldStateVersion);
      setPendingDeltaAckVersion(snapshot.worldStateVersion);
      replayRequestInFlightRef.current = false;
      resetOverlay(snapshot.turnId);
      await hydrateCurrentTurnOrders(token);
      setTurnTimerUi((prev) => ({ ...prev, startedAtMs: Date.now() }));
      toast.warning(t("shell.worldResynced"));
    } catch {
      toast.error(t("shell.worldResyncFailed"));
      window.location.reload();
    } finally {
      worldResyncInFlightRef.current = false;
    }
  }, [hydrateCurrentTurnOrders, resetOverlay, setWorldBase, t]);

  const onWsMessage = useCallback(
    (msg: WsOutMessage) => {
      if (msg.type === "AUTH_OK") {
        clearResolveStartTimeout();
        setTurnResolveOverlay({ phase: "idle" });
        if (msg.worldBase) {
          setWorldBase(msg.worldBase, msg.turnId, msg.worldStateVersion);
          setPendingDeltaAckVersion(msg.worldStateVersion);
        } else if (!useGameStore.getState().worldBase) {
          toast.warning(t("shell.localStateMissing"));
          void resyncWorldState();
        }
        replayRequestInFlightRef.current = false;
        const currentAuth = useGameStore.getState().auth;
        if (currentAuth?.token) {
          setAuth({ token: currentAuth.token, playerId: msg.playerId, countryId: msg.countryId, isAdmin: msg.isAdmin });
          void hydrateCurrentTurnOrders(currentAuth.token);
        }
        if (msg.clientSettings?.eventLogRetentionTurns) {
          setEventLogRetentionTurns(msg.clientSettings.eventLogRetentionTurns);
        }
        addEvent({ category: "system", title: t("shell.connectedTitle"), message: t("shell.connectedMessage"), priority: "low", visibility: "private", countryId: msg.countryId, turn: msg.turnId });
      }

      if (msg.type === "SCENARIO_APPLIED") {
        setActiveScenarioId(msg.scenarioId);
        toast.success(t("shell.scenarioApplied"), { description: t("shell.scenarioAppliedDescription") });
        window.setTimeout(() => window.location.reload(), 500);
      }

      if (msg.type === "ORDER_BROADCAST") {
        addOrder(msg.order);
        const targetId =
          msg.order.type === "ARMY_MOVE"
            ? msg.order.targetHexId
            : msg.order.type === "FOUND_CITY"
              ? msg.order.targetHexId
              : msg.order.type === "BUILD" || msg.order.type === "COLONIZE"
              ? msg.order.regionId
              : "";
        addEvent({
          category: msg.order.type === "COLONIZE" || msg.order.type === "FOUND_CITY" ? "colonization" : "military",
          title: msg.order.type === "COLONIZE" || msg.order.type === "FOUND_CITY" ? t("shell.orderColonizationTitle") : t("shell.orderTitle"),
          message: `${msg.order.countryId} -> ${msg.order.type} (${targetId})`,
          countryId: msg.order.countryId,
          priority: "low",
          visibility: "public",
          turn: msg.order.turnId,
        });
      }

      if (msg.type === "TURN_RESOLVE_STARTED") {
        clearResolveStartTimeout();
        setTurnResolveOverlay((prev) =>
          prev.phase === "idle" ? { phase: "processing", startedAtMs: Date.now() } : prev,
        );
      }

      if (msg.type === "WORLD_DELTA") {
        clearResolveStartTimeout();
        const currentWorldStateVersion = useGameStore.getState().worldStateVersion;
        if (msg.worldStateVersion <= currentWorldStateVersion) {
          setPendingDeltaAckVersion(currentWorldStateVersion);
          return;
        }
        if (msg.worldStateVersion > currentWorldStateVersion + 1) {
          if (!replayRequestInFlightRef.current) {
            replayRequestInFlightRef.current = true;
            setPendingReplayFromWorldStateVersion(currentWorldStateVersion);
            toast.warning(t("shell.replayRequested"));
          }
          return;
        }
        setTurnResolveOverlay((prev) =>
          prev.phase === "processing"
            ? {
                phase: "done",
                startedAtMs: prev.startedAtMs,
                finishedAtMs: Date.now(),
                durationMs: Math.max(0, Date.now() - prev.startedAtMs),
                resolvedTurnId: msg.turnId,
              }
            : prev,
        );
        applyWorldDelta(msg, msg.turnId, msg.worldStateVersion);
        setPendingDeltaAckVersion(msg.worldStateVersion);
        replayRequestInFlightRef.current = false;
        setTurnTimerUi((prev) => ({ ...prev, startedAtMs: Date.now() }));
        resetOverlay(msg.turnId);
        pruneLogEntries(msg.turnId);
        if (msg.rejectedOrders.length > 0) {
          toast.warning(t("shell.rejectedOrders", { count: msg.rejectedOrders.length }));
          addEvent({
            category: "system",
            title: t("shell.turnCompletedTitle", { turn: msg.turnId }),
            message: t("shell.rejectedOrdersMessage", { count: msg.rejectedOrders.length }),
            priority: "medium",
            visibility: "public",
            turn: msg.turnId,
          });
        } else {
          toast.success(t("shell.turnResolved"));
          addEvent({
            category: "system",
            title: t("shell.turnCompletedTitle", { turn: msg.turnId }),
            message: t("shell.turnResolvedClean"),
            priority: "low",
            visibility: "public",
            turn: msg.turnId,
          });
        }
      }

      if (msg.type === "NEWS_EVENT") {
        addEvent({
          ...msg.event,
          turn: msg.event.turn,
          category: msg.event.category,
          message: msg.event.message,
          title: msg.event.title ?? undefined,
          countryId: msg.event.countryId ?? null,
          priority: msg.event.priority,
          visibility: msg.event.visibility,
        });
      }

      if (msg.type === "UI_NOTIFY") {
        const currentTurnId = useGameStore.getState().turnId;
        const notification = {
          ...(msg.notification as InAppUiNotification),
          receivedTurnId: (msg.notification as InAppUiNotification).receivedTurnId ?? currentTurnId,
        } satisfies InAppUiNotification;
        setUiNotificationHistory((prev) => {
          const next = dedupeNotifications([notification, ...prev]);
          next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          return next.slice(0, 200);
        });
        setUiNotifications((prev) => {
          const next = dedupeNotifications([notification, ...prev]);
          return next.slice(0, 8);
        });
      }

      if (msg.type === "PRESENCE") {
        setPresence(msg.onlinePlayerIds);
      }

      if (msg.type === "ERROR") {
        clearResolveStartTimeout();
        setTurnResolveOverlay((prev) => (prev.phase === "processing" ? { phase: "idle" } : prev));
        if (msg.code === "REPLAY_UNAVAILABLE") {
          replayRequestInFlightRef.current = false;
          toast.warning(t("shell.replayUnavailable"));
          void resyncWorldState();
          return;
        }
        const localizedKey = resolveWsPlayerErrorKey(msg.code);
        const message = localizedKey ? t(localizedKey) : msg.message;
        toast.error(message);
        addEvent({ category: "system", title: t("shell.serverErrorTitle"), message, priority: "high", visibility: "private" });
      }
    },
    [addEvent, addOrder, applyWorldDelta, clearResolveStartTimeout, hydrateCurrentTurnOrders, pruneLogEntries, resetOverlay, resyncWorldState, setEventLogRetentionTurns, setPresence, setWorldBase, t],
  );

  const { send } = useWs(onWsMessage, auth?.token, wsResumeFromWorldStateVersion);

  useEffect(() => {
    if (pendingDeltaAckVersion == null || !auth?.token) {
      return;
    }
    send({ type: "WORLD_DELTA_ACK", worldStateVersion: pendingDeltaAckVersion });
    setPendingDeltaAckVersion(null);
  }, [auth?.token, pendingDeltaAckVersion, send]);

  useEffect(() => {
    if (pendingReplayFromWorldStateVersion == null || !auth?.token) {
      return;
    }
    send({ type: "WORLD_DELTA_REPLAY_REQUEST", fromWorldStateVersion: pendingReplayFromWorldStateVersion });
    setPendingReplayFromWorldStateVersion(null);
  }, [auth?.token, pendingReplayFromWorldStateVersion, send]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCmdOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    try {
      const key = `arc.ui.${auth?.countryId ?? "guest"}.map.showControls`;
      const raw = localStorage.getItem(key);
      setShowMapControls(raw === "1");
    } catch {
      setShowMapControls(false);
    }
  }, [auth?.countryId]);

  useEffect(() => {
    try {
      localStorage.setItem(`arc.ui.${auth?.countryId ?? "guest"}.map.showControls`, showMapControls ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  }, [auth?.countryId, showMapControls]);

  useEffect(() => {
    const key = `arc.ui.${auth?.countryId ?? "guest"}.map.showZoomIndicator`;
    try {
      const raw = localStorage.getItem(key);
      setShowZoomIndicator(raw == null ? true : raw === "1");
    } catch {
      setShowZoomIndicator(true);
    } finally {
      setShowZoomIndicatorLoadedKey(key);
    }
  }, [auth?.countryId]);

  useEffect(() => {
    const key = `arc.ui.${auth?.countryId ?? "guest"}.map.showZoomIndicator`;
    if (showZoomIndicatorLoadedKey !== key) return;
    try {
      localStorage.setItem(key, showZoomIndicator ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  }, [auth?.countryId, showZoomIndicator, showZoomIndicatorLoadedKey]);

  useEffect(() => {
    const settings = readMapNavigationSettings(auth?.countryId);
    setEdgeScrollEnabled(settings.edgeScrollEnabled);
    const onNavigationSettingsChanged = () => {
      const next = readMapNavigationSettings(auth?.countryId);
      setEdgeScrollEnabled(next.edgeScrollEnabled);
    };
    window.addEventListener(MAP_NAVIGATION_SETTINGS_EVENT, onNavigationSettingsChanged);
    return () => window.removeEventListener(MAP_NAVIGATION_SETTINGS_EVENT, onNavigationSettingsChanged);
  }, [auth?.countryId]);

  useEffect(() => {
    const blockContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };
    document.addEventListener("contextmenu", blockContextMenu);
    return () => document.removeEventListener("contextmenu", blockContextMenu);
  }, []);

  useEffect(() => {
    try {
      const key = `arc.ui.${auth?.countryId ?? "guest"}.notifications.sort`;
      const raw = localStorage.getItem(key);
      setSortNotifications(raw == null ? true : raw === "1");
    } catch {
      setSortNotifications(true);
    }
  }, [auth?.countryId]);

  useEffect(() => {
    try {
      localStorage.setItem(`arc.ui.${auth?.countryId ?? "guest"}.notifications.sort`, sortNotifications ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  }, [auth?.countryId, sortNotifications]);

  useEffect(() => {
    if (!worldBase || canceledConstructionQueueKeys.size === 0) return;
    const activeKeys = new Set<string>();
    for (const [regionId, queue] of Object.entries(worldBase.regionConstructionQueueByRegion ?? {})) {
      for (const project of queue ?? []) {
        activeKeys.add(`${regionId}:${project.queueId}`);
      }
    }
    setCanceledConstructionQueueKeys((current) => {
      const next = new Set([...current].filter((key) => activeKeys.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [canceledConstructionQueueKeys.size, worldBase]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicGameUiSettings()
      .then((ui) => {
        if (!cancelled) {
          setResourceGrowthByTurn({
            culture: ui.economy.baseCulturePerTurn ?? 1,
            science: ui.economy.baseSciencePerTurn ?? 1,
            religion: ui.economy.baseReligionPerTurn ?? 1,
            colonization: ui.colonization.pointsPerTurn,
            construction: ui.economy.baseConstructionPerTurn,
            ducats: ui.economy.baseDucatsPerTurn,
            gold: ui.economy.baseGoldPerTurn,
          });
          setMaxActiveColonizations(ui.colonization.maxActiveColonizations);
          setColonizationCostPer1000Km2({
            points: ui.colonization.pointsCostPer1000Km2,
            ducats: ui.colonization.ducatsCostPer1000Km2,
          });
          setLandDivisionStackLimitPerHex(ui.military?.landDivisionStackLimitPerHex ?? 4);
          setDemolitionCostConstructionPercent(ui.economy.demolitionCostConstructionPercent ?? 20);
          setShowAntarctica(ui.map?.showAntarctica ?? true);
          setActiveScenarioId(ui.activeScenarioId ?? "default");
          setHexRenameDucatsCost(ui.customization?.hexRenameDucats ?? 25);
          setTurnTimerUi({
            enabled: ui.turnTimer?.enabled ?? false,
            secondsPerTurn: ui.turnTimer?.secondsPerTurn ?? 300,
            startedAtMs:
              typeof ui.turnTimer?.currentTurnStartedAtMs === "number" && Number.isFinite(ui.turnTimer.currentTurnStartedAtMs)
                ? ui.turnTimer.currentTurnStartedAtMs
                : Date.now(),
          });
          setPublicUiLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPublicUiLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchContentEntries("buildings"),
      fetchContentEntries("companies"),
      fetchContentEntries("industries"),
      fetchContentEntries("sectors"),
    ])
      .then(([buildings, companies, industries, sectors]) => {
        if (!cancelled) {
          setBuildingEntries(buildings);
          setCompanyEntries(companies);
          setIndustryEntries(industries);
          setSectorEntries(sectors);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBuildingEntries([]);
          setCompanyEntries([]);
          setIndustryEntries([]);
          setSectorEntries([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!auth?.token) {
      setUnitTypeEntries([]);
      return;
    }
    let cancelled = false;
    getUnitsOverview(auth.token)
      .then((overview) => {
        if (!cancelled) setUnitTypeEntries(overview.unitTypes);
      })
      .catch(() => {
        if (!cancelled) {
          setUnitTypeEntries([]);
          toast.error(t("shell.units.overviewFailed"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.token, t]);

  useEffect(() => {
    let cancelled = false;
    fetchContentEntries("technologies")
      .then((items) => {
        if (!cancelled) setTechnologyEntries(items);
      })
      .catch(() => {
        if (!cancelled) setTechnologyEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchContentEntries("journalEntries")
      .then((items) => {
        if (!cancelled) setJournalEntries(items);
      })
      .catch(() => {
        if (!cancelled) setJournalEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!auth?.countryId) return;

    let cancelled = false;
    fetchCountries()
      .then((list) => {
        if (cancelled) return;
        setCountries(list);
        const found = list.find((c) => c.id === auth.countryId);
        if (!found) return;
        setCountry((current) =>
          current?.name && current.name.trim().length > 0
            ? current
            : {
                name: found.name,
                color: found.color,
                flagUrl: found.flagUrl ?? null,
                crestUrl: found.crestUrl ?? null,
              },
        );
      })
      .catch(() => {
        // keep fallback label
      });

    return () => {
      cancelled = true;
    };
  }, [auth?.countryId]);

  useEffect(() => {
    if (!auth?.token || !strategyWorkspaceOpen || (activeStrategyMode !== "market" && activeStrategyMode !== "construction")) return;

    let cancelled = false;
    setMarketShellLoading(true);
    Promise.all([fetchMarketOverview(auth.token), fetchCountries()])
      .then(([overview, countries]) => {
        if (cancelled) return;
        setMarketShellOverview(overview);
        setMarketTransportCorridors(overview.transportCorridors ?? []);
        setMarketShellCountries(countries);
      })
      .catch(() => {
        if (cancelled) return;
        setMarketShellOverview(null);
        setMarketTransportCorridors([]);
        setMarketShellCountries([]);
      })
      .finally(() => {
        if (!cancelled) {
          setMarketShellLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeStrategyMode, auth?.token, strategyWorkspaceOpen, turnId]);

  const onAuthSuccess = (payload: AuthSuccess) => {
    setEntryLoadingGate("loading");
    setAuth({ token: payload.token, playerId: payload.playerId, countryId: payload.countryId, isAdmin: payload.isAdmin });
    setCountry({ name: payload.countryName, color: payload.countryColor, flagUrl: payload.flagUrl, crestUrl: payload.crestUrl });
    if (payload.clientSettings?.eventLogRetentionTurns) {
      setEventLogRetentionTurns(payload.clientSettings.eventLogRetentionTurns);
    }
    addEvent({ category: "system", title: t("shell.loginTitle"), message: t("shell.loginMessage", { country: payload.countryName }), priority: "medium", visibility: "private", countryId: payload.countryId, turn: payload.turnId });
  };

  const currentResources = useMemo(() => {
    if (!worldBase || !auth) {
      return { culture: 0, science: 0, religion: 0, colonization: 0, construction: 0, ducats: 0, gold: 0 };
    }
    return worldBase.resourcesByCountry[auth.countryId] ?? { culture: 0, science: 0, religion: 0, colonization: 0, construction: 0, ducats: 0, gold: 0 };
  }, [auth, worldBase]);
  const activeJournalCount = useMemo(() => {
    if (!worldBase || !auth) return 0;
    return worldBase.journalEntriesByCountryId[auth.countryId]?.active.length ?? 0;
  }, [auth, worldBase]);
  const currentCountryDetails = useMemo(() => {
    if (!auth || !worldBase) {
      return { provinceCount: 0 };
    }
    let provinceCount = 0;
    for (const [hexId, ownerCountryId] of Object.entries(worldBase.hexOwner ?? {})) {
      if (ownerCountryId !== auth.countryId) continue;
      provinceCount += 1;
    }
    return { provinceCount };
  }, [auth, worldBase]);

  const currentCountryPopulationSummary = useMemo(() => {
    if (!auth || !worldBase) {
      return { total: 0, births: 0, deaths: 0, netGrowth: 0 };
    }

    let total = 0;
    let births = 0;
    let deaths = 0;
    for (const [regionId, population] of Object.entries(worldBase.regionPopulationByRegion ?? {})) {
      const controllingCountryId = worldBase.regionController?.[regionId] ?? worldBase.regionOwner?.[regionId] ?? "";
      if (controllingCountryId !== auth.countryId) continue;
      for (const pop of population?.pops ?? []) {
        total += Math.max(0, Number(pop.size ?? 0));
        for (const professionState of Object.values(pop.professions ?? {})) {
          births += Math.max(0, Number(professionState.lastBirths ?? 0));
          deaths += Math.max(0, Number(professionState.lastDeaths ?? 0));
        }
      }
    }

    return {
      total: Math.floor(total),
      births: Math.floor(births),
      deaths: Math.floor(deaths),
      netGrowth: Math.floor(births - deaths),
    };
  }, [auth, worldBase]);

  const myColonizationProjection = useMemo(() => {
    if (!auth || !worldBase) {
      return { activeCount: 0, predictedPointsSpend: 0, predictedSupportDucatSpend: 0 };
    }

    const activeProjects = Object.values(worldBase.settlementProjectsById ?? {})
      .filter((project) => project.countryId === auth.countryId && (project.state === "active" || project.state === "stalled"))
      .map((project) => ({
        remainingColonization: Math.max(
          0,
          Math.max(1, Number(project.costColonization ?? 0)) - Math.max(0, Number(project.progressColonization ?? 0)),
        ),
      }))
      .filter((project) => project.remainingColonization > 0);

    const activeCount = activeProjects.length;
    if (activeCount === 0) {
      return { activeCount, predictedPointsSpend: 0, predictedSupportDucatSpend: 0 };
    }

    let remainingColonizationBudget = Math.max(0, Math.floor(currentResources.colonization ?? 0));
    if (remainingColonizationBudget <= 0) {
      return { activeCount, predictedPointsSpend: 0, predictedSupportDucatSpend: 0 };
    }

    let active = activeProjects.map((project) => ({ ...project }));
    let predictedPointsSpend = 0;
    while (remainingColonizationBudget > 0 && active.length > 0) {
      const equalShare = remainingColonizationBudget / active.length;
      let progressedInRound = 0;
      const nextActive: typeof active = [];
      for (const project of active) {
        const applied = Math.min(equalShare, project.remainingColonization);
        if (applied <= 0) continue;
        project.remainingColonization = Math.max(0, project.remainingColonization - applied);
        remainingColonizationBudget = Math.max(0, remainingColonizationBudget - applied);
        predictedPointsSpend += applied;
        progressedInRound += applied;
        if (project.remainingColonization > 0) {
          nextActive.push(project);
        }
      }
      if (progressedInRound <= 0) break;
      active = nextActive;
    }

    return {
      activeCount,
      predictedPointsSpend: Math.max(0, Math.floor(predictedPointsSpend)),
      predictedSupportDucatSpend: 0,
    };
  }, [auth, currentResources.colonization, worldBase]);
  const colonizerQueuePreview = useMemo(() => {
    if (!auth || !worldBase) return [];
    return (worldBase.civilianUnitQueueByCountry?.[auth.countryId] ?? [])
      .filter((item) => item.type === "colonizer" && isHexId(item.hexId))
      .map((item) => ({
        id: item.id,
        type: "colonizer" as const,
        hexId: item.hexId,
        progressPct: Math.max(0, Math.min(100, Number(item.progress ?? 0) * 100)),
        turnsRemaining: Math.max(0, Math.floor(Number(item.turnsRemaining ?? 0))),
        turnsTotal: Math.max(1, Math.floor(Number(item.turnsTotal ?? 1))),
        costColonization: Math.max(0, Number(item.cost?.colonization ?? 0)),
        costDucats: Math.max(0, Number(item.cost?.ducats ?? 0)),
      }))
      .sort((a, b) => a.turnsRemaining - b.turnsRemaining || a.hexId.localeCompare(b.hexId, "ru"));
  }, [auth, worldBase]);

  const colonizerUnitPreview = useMemo(() => {
    if (!auth || !worldBase) return [];
    return Object.values(worldBase.civilianUnitsById ?? {})
      .filter((unit) => unit.countryId === auth.countryId && unit.type === "colonizer" && isHexId(unit.hexId))
      .map((unit) => ({
        id: unit.id,
        type: "colonizer" as const,
        hexId: unit.hexId,
        movementPoints: Math.max(0, Number(unit.movementPoints ?? 0)),
        maxMovementPoints: Math.max(1, Number(unit.maxMovementPoints ?? 1)),
        status: unit.status,
      }))
      .sort((a, b) => a.hexId.localeCompare(b.hexId, "ru"));
  }, [auth, worldBase]);

  const settlementProjectPreview = useMemo(() => {
    if (!auth || !worldBase) return [];
    return Object.values(worldBase.settlementProjectsById ?? {})
      .filter((project) => project.countryId === auth.countryId && isHexId(project.targetHexId))
      .map((project) => {
        const cost = Math.max(1, Number(project.costColonization ?? 0));
        const progress = Math.max(0, Number(project.progressColonization ?? 0));
        return {
          id: project.id,
          regionId: project.regionId,
          targetHexId: project.targetHexId,
          progressPct: Math.max(0, Math.min(100, (progress / cost) * 100)),
          progressColonization: progress,
          costColonization: cost,
          state: project.state,
          stallReasonCode: project.stallReasonCode ?? null,
        };
      })
      .sort((a, b) => Number(a.state === "stalled") - Number(b.state === "stalled") || a.regionId.localeCompare(b.regionId, "ru"));
  }, [auth, worldBase]);

  const activeColonizationCount = myColonizationProjection.activeCount;
  const myConstructionProjection = useMemo(() => {
    if (!auth || !worldBase) {
      return { activeCount: 0, predictedPointsSpend: 0, predictedDucatSpend: 0 };
    }

    const EPS = 1e-6;
    const activeProjects = Object.entries(worldBase.regionConstructionQueueByRegion ?? {})
      .flatMap(([regionId, queue]) => {
        const controllingCountryId = worldBase.regionController?.[regionId] ?? worldBase.regionOwner?.[regionId] ?? "";
        if (controllingCountryId !== auth.countryId) {
          return [];
        }
        return (queue ?? []).filter((project) => {
          if (!project) return false;
          if (project.requestedByCountryId !== auth.countryId) return false;
          return project.progressConstruction + EPS < project.costConstruction;
        });
      })
      .map((project) => {
        const ducatRatio = project.costConstruction > 0 ? project.costDucats / project.costConstruction : 0;
        const remainingConstruction = Math.max(0, project.costConstruction - project.progressConstruction);
        const spentProjectDucats = project.progressConstruction * ducatRatio;
        const remainingProjectDucats = Math.max(0, project.costDucats - spentProjectDucats);
        return {
          remainingConstruction,
          ducatRatio,
          remainingProjectDucats,
        };
      })
      .filter((item) => item.remainingConstruction > EPS);

    if (activeProjects.length === 0) {
      return { activeCount: 0, predictedPointsSpend: 0, predictedDucatSpend: 0 };
    }

    let remainingConstructionBudget = Math.max(0, Number(currentResources.construction ?? 0));
    let remainingDucatBudget = Math.max(
      0,
      Number(currentResources.ducats ?? 0) - Math.max(0, myColonizationProjection.predictedSupportDucatSpend),
    );
    if (remainingConstructionBudget <= EPS) {
      return { activeCount: activeProjects.length, predictedPointsSpend: 0, predictedDucatSpend: 0 };
    }

    let active = activeProjects.map((project) => ({ ...project }));
    let pointsSpend = 0;
    let ducatSpend = 0;

    while (remainingConstructionBudget > EPS && active.length > 0) {
      const equalShare = remainingConstructionBudget / active.length;
      let progressedInRound = 0;
      const nextActive: typeof active = [];
      for (const project of active) {
        const maxByCountryDucats = project.ducatRatio > 0 ? remainingDucatBudget / project.ducatRatio : Number.POSITIVE_INFINITY;
        const maxByProjectDucats = project.ducatRatio > 0 ? project.remainingProjectDucats / project.ducatRatio : Number.POSITIVE_INFINITY;
        const appliedConstruction = Math.min(equalShare, project.remainingConstruction, maxByCountryDucats, maxByProjectDucats);
        if (appliedConstruction <= EPS) continue;
        const appliedDucats =
          project.ducatRatio > 0
            ? Math.min(project.remainingProjectDucats, appliedConstruction * project.ducatRatio, remainingDucatBudget)
            : 0;
        project.remainingConstruction = Math.max(0, project.remainingConstruction - appliedConstruction);
        project.remainingProjectDucats = Math.max(0, project.remainingProjectDucats - appliedDucats);
        remainingConstructionBudget = Math.max(0, remainingConstructionBudget - appliedConstruction);
        remainingDucatBudget = Math.max(0, remainingDucatBudget - appliedDucats);
        pointsSpend += appliedConstruction;
        ducatSpend += appliedDucats;
        progressedInRound += appliedConstruction;

        const canContinue = project.remainingConstruction > EPS && (project.ducatRatio <= 0 || project.remainingProjectDucats > EPS);
        if (canContinue) {
          nextActive.push(project);
        }
      }
      if (progressedInRound <= EPS) break;
      active = nextActive;
    }

    return {
      activeCount: activeProjects.length,
      predictedPointsSpend: Math.max(0, Math.floor(pointsSpend)),
      predictedDucatSpend: Math.max(0, Math.floor(ducatSpend)),
    };
  }, [
    auth,
    currentResources.construction,
    currentResources.ducats,
    myColonizationProjection.predictedSupportDucatSpend,
    worldBase,
  ]);
  const constructionQueuePreview = useMemo(() => {
    if (!auth || !worldBase) return [];
    const buildingById = new Map(buildingEntries.map((building) => [building.id, building] as const));
    const rows: Array<{
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
      selected: boolean;
    }> = [];
    for (const [regionId, queue] of Object.entries(worldBase.regionConstructionQueueByRegion ?? {})) {
      const controllingCountryId = worldBase.regionController?.[regionId] ?? worldBase.regionOwner?.[regionId] ?? "";
      if (controllingCountryId !== auth.countryId) continue;
      for (const project of queue ?? []) {
        if (!project || project.requestedByCountryId !== auth.countryId) continue;
        if (canceledConstructionQueueKeys.has(`${regionId}:${project.queueId}`)) continue;
        if (!isHexId(project.targetHexId)) continue;
        const building = buildingById.get(project.buildingId);
        let ownerName = "";
        let ownerIconUrl: string | null = null;
        if (project.owner.type === "company" && "companyId" in project.owner) {
          const companyId = project.owner.companyId;
          const ownerCompany = companyEntries.find((company) => company.id === companyId);
          ownerName = ownerCompany?.name ?? companyId;
          ownerIconUrl = ownerCompany?.logoUrl ?? null;
        } else {
          const ownerCountry = countryById.get(project.owner.countryId);
          ownerName = countryNameById[project.owner.countryId] ?? project.owner.countryId;
          ownerIconUrl = ownerCountry?.flagUrl ?? ownerCountry?.crestUrl ?? null;
        }
        const cost = Math.max(1, Number(project.costConstruction ?? 0));
        const progress = Math.max(0, Number(project.progressConstruction ?? 0));
        const remainingConstruction = Math.max(0, cost - progress);
        if (remainingConstruction <= 0) continue;
        rows.push({
          id: project.queueId,
          source: "queued",
          queueId: project.queueId,
          regionId,
          targetHexId: project.targetHexId,
          buildingId: project.buildingId,
          name: getBuildingDisplayName(building, project.buildingId, t),
          ownerName,
          ownerIconUrl,
          progressPct: Math.max(0, Math.min(100, (progress / cost) * 100)),
          remainingConstruction,
          industryId: typeof building?.industryId === "string" ? building.industryId : null,
          sectorId: typeof building?.sectorId === "string" ? building.sectorId : null,
          selected: selectedHexId === project.targetHexId,
        });
      }
    }
    const byPlayer = ordersByTurn.get(turnId);
    const pendingByKey = new Map<string, (typeof rows)[number]>();
    if (byPlayer) {
      for (const playerOrders of byPlayer.values()) {
        for (const order of playerOrders) {
          if (order.type !== "BUILD" || order.countryId !== auth.countryId) continue;
          const payload = (order.payload ?? {}) as Record<string, unknown>;
          const buildingId =
            typeof payload.buildingId === "string"
              ? payload.buildingId
              : typeof payload.building === "string"
                ? payload.building
                : "";
          const building = buildingById.get(buildingId);
          const owner = payload.owner as { type?: "state" | "company"; countryId?: string; companyId?: string } | undefined;
          const ownerName =
            owner?.type === "company"
              ? companyEntries.find((company) => company.id === owner.companyId)?.name ?? owner.companyId ?? t("buildings.ownerCompany")
              : countryNameById[owner?.countryId ?? auth.countryId] ?? owner?.countryId ?? auth.countryId;
          const ownerIconUrl =
            owner?.type === "company"
              ? companyEntries.find((company) => company.id === owner.companyId)?.logoUrl ?? null
              : countryById.get(owner?.countryId ?? auth.countryId)?.flagUrl ?? countryById.get(owner?.countryId ?? auth.countryId)?.crestUrl ?? null;
          const key = `${order.regionId}:${order.targetHexId}:${buildingId}`;
          const candidate = {
            id: order.id,
            source: "pending" as const,
            orderId: order.id,
            regionId: order.regionId,
            targetHexId: order.targetHexId,
            buildingId,
            name: getBuildingDisplayName(building, buildingId, t),
            ownerName,
            ownerIconUrl,
            progressPct: 0,
            remainingConstruction: Math.max(0, Number(building?.costConstruction ?? 0)),
            industryId: typeof building?.industryId === "string" ? building.industryId : null,
            sectorId: typeof building?.sectorId === "string" ? building.sectorId : null,
            selected: selectedHexId === order.targetHexId,
          };
          const existing = pendingByKey.get(key);
          if (!existing || (existing.orderId?.startsWith("local:") && !order.id.startsWith("local:"))) {
            pendingByKey.set(key, candidate);
          }
        }
      }
    }
    rows.push(...pendingByKey.values());
    rows.sort((a, b) => Number(b.selected) - Number(a.selected) || a.name.localeCompare(b.name, "ru") || a.regionId.localeCompare(b.regionId, "ru"));
    return rows.map(({ selected: _selected, ...row }) => row);
  }, [auth, buildingEntries, canceledConstructionQueueKeys, companyEntries, countryById, countryNameById, ordersByTurn, selectedHexId, t, turnId, worldBase]);
  const cancelConstructionQueueProject = useCallback(
    async (item: { source: "queued"; regionId: string; queueId: string; targetHexId: HexId; buildingId: string } | { source: "pending"; orderId: string }) => {
      if (!auth?.token) return;
      const key = item.source === "queued" ? `${item.regionId}:${item.queueId}` : item.orderId;
      setCancelingConstructionQueueKey(key);
      try {
        const result =
          item.source === "queued"
            ? await cancelCountryBuild(auth.token, { regionId: item.regionId, queueId: item.queueId })
            : await cancelCountryBuild(auth.token, { orderId: item.orderId });
        if (item.source === "queued" && result.canceledQueuedProject) {
          setCanceledConstructionQueueKeys((current) => {
            const next = new Set(current);
            next.add(key);
            return next;
          });
          const byPlayer = ordersByTurn.get(turnId);
          const currentCountryId = auth.countryId;
          if (byPlayer) {
            for (const orders of byPlayer.values()) {
              for (const order of orders) {
                const orderBuildingId = typeof order.payload?.buildingId === "string" ? order.payload.buildingId : "";
                if (
                  order.type === "BUILD" &&
                  order.countryId === currentCountryId &&
                  order.regionId === item.regionId &&
                  order.targetHexId === item.targetHexId &&
                  orderBuildingId === item.buildingId
                ) {
                  removeOrder(turnId, order.id);
                }
              }
            }
          }
        }
        if (item.source === "pending" && result.canceledPendingOrder) {
          removeOrder(turnId, item.orderId);
        }
        toast.success(t("buildings.toastBuildCanceled"));
      } catch (error) {
        const message = error instanceof Error ? error.message : "BUILD_CANCEL_FAILED";
        if (message === "BUILD_CANCEL_NOT_FOUND") {
          toast.error(t("buildings.toastBuildNotFound"));
        } else {
          toast.error(t("buildings.toastBuildCancelFailed"));
        }
      } finally {
        setCancelingConstructionQueueKey(null);
      }
    },
    [auth?.countryId, auth?.token, ordersByTurn, removeOrder, t, turnId],
  );
  const focusConstructionHex = useCallback((hexId: HexId) => {
    setMapFocusRequest((current) => ({ hexId, nonce: (current?.nonce ?? 0) + 1 }));
  }, []);
  const startInfrastructurePlacement = useCallback((transportMode: TransportMode) => {
    setActiveStrategyMode("construction");
    setStrategyWorkspaceOpen(true);
    setHexBuildPlacement(null);
    setHexBuildConfirmTarget(null);
    setCorridorPlacement({
      transportMode,
      points: [],
      previewHexIds: [],
      costConstruction: null,
      connectedRegionIds: [],
      blockingReason: null,
      pending: false,
      previewNonce: 0,
    });
  }, []);
  const selectCorridorPlacementPoint = useCallback((point: { hexId: HexId; regionId: string; lng: number; lat: number }) => {
    setCorridorPlacement((current) => {
      if (!current) return current;
      const last = current.points[current.points.length - 1];
      if (last?.hexId === point.hexId) return current;
      return {
        ...current,
        points: [...current.points, { hexId: point.hexId, lng: point.lng, lat: point.lat }],
        blockingReason: null,
        pending: current.points.length >= 1,
        previewNonce: current.previewNonce + 1,
      };
    });
  }, []);
  const undoCorridorPlacementPoint = useCallback(() => {
    setCorridorPlacement((current) => {
      if (!current || current.points.length === 0) return current;
      const points = current.points.slice(0, -1);
      return {
        ...current,
        points,
        previewHexIds: points.length >= 2 ? current.previewHexIds : [],
        costConstruction: points.length >= 2 ? current.costConstruction : null,
        connectedRegionIds: points.length >= 2 ? current.connectedRegionIds : [],
        blockingReason: null,
        pending: points.length >= 2,
        previewNonce: current.previewNonce + 1,
      };
    });
  }, []);
  const cancelCorridorPlacement = useCallback(() => {
    setCorridorPlacement(null);
  }, []);
  const confirmCorridorPlacement = useCallback(async () => {
    if (!auth?.token || !corridorPlacement || corridorPlacement.points.length < 2) {
      toast.error(t("shell.infrastructure.error.routeTooShort"));
      return;
    }
    const marketId = marketShellOverview?.marketId ?? auth.countryId;
    if (!marketId) {
      toast.error(t("shell.infrastructure.error.marketAccess"));
      return;
    }
    setCorridorPlacement((current) => current ? { ...current, pending: true } : current);
    try {
      const result = await createMarketTransportCorridor(auth.token, marketId, {
        waypoints: corridorPlacement.points,
        transportMode: corridorPlacement.transportMode,
      });
      setMarketTransportCorridors(result.corridors);
      setMarketShellOverview((current) => current ? { ...current, transportCorridors: result.corridors } : current);
      setCorridorPlacement(null);
      toast.success(t("shell.infrastructure.createSuccess"));
    } catch (error) {
      const code = error instanceof Error ? error.message : "MARKET_CORRIDOR_CREATE_FAILED";
      setCorridorPlacement((current) => current ? { ...current, pending: false, blockingReason: t(getCorridorErrorKey(code)) } : current);
      toast.error(t(getCorridorErrorKey(code)));
    }
  }, [auth?.countryId, auth?.token, corridorPlacement, marketShellOverview?.marketId, t]);
  const upgradeInfrastructureCorridor = useCallback(async (corridor: MarketTransportCorridor) => {
    if (!auth?.token) return;
    const marketId = corridor.marketId || marketShellOverview?.marketId || auth.countryId;
    try {
      const result = await updateMarketTransportCorridor(auth.token, marketId, corridor.id, { action: "upgrade" });
      setMarketTransportCorridors(result.corridors);
      setMarketShellOverview((current) => current ? { ...current, transportCorridors: result.corridors } : current);
      toast.success(t("shell.infrastructure.upgradeSuccess"));
    } catch (error) {
      const code = error instanceof Error ? error.message : "MARKET_CORRIDOR_UPDATE_FAILED";
      toast.error(t(getCorridorErrorKey(code)));
    }
  }, [auth?.countryId, auth?.token, marketShellOverview?.marketId, t]);
  const cancelInfrastructureCorridor = useCallback(async (corridor: MarketTransportCorridor) => {
    if (!auth?.token) return;
    if (!window.confirm(t("shell.infrastructure.cancelConfirm"))) return;
    const marketId = corridor.marketId || marketShellOverview?.marketId || auth.countryId;
    try {
      const result = await updateMarketTransportCorridor(auth.token, marketId, corridor.id, { action: "cancel" });
      setMarketTransportCorridors(result.corridors);
      setMarketShellOverview((current) => current ? { ...current, transportCorridors: result.corridors } : current);
      toast.success(t("shell.infrastructure.cancelSuccess"));
    } catch (error) {
      const code = error instanceof Error ? error.message : "MARKET_CORRIDOR_UPDATE_FAILED";
      toast.error(t(getCorridorErrorKey(code)));
    }
  }, [auth?.countryId, auth?.token, marketShellOverview?.marketId, t]);
  const demolishInfrastructureCorridor = useCallback(async (corridor: MarketTransportCorridor) => {
    if (!auth?.token) return;
    if (!window.confirm(t("shell.infrastructure.demolishConfirm"))) return;
    const marketId = corridor.marketId || marketShellOverview?.marketId || auth.countryId;
    try {
      const result = await updateMarketTransportCorridor(auth.token, marketId, corridor.id, { action: "demolish" });
      setMarketTransportCorridors(result.corridors);
      setMarketShellOverview((current) => current ? { ...current, transportCorridors: result.corridors } : current);
      toast.success(t("shell.infrastructure.demolishSuccess"));
    } catch (error) {
      const code = error instanceof Error ? error.message : "MARKET_CORRIDOR_UPDATE_FAILED";
      toast.error(t(getCorridorErrorKey(code)));
    }
  }, [auth?.countryId, auth?.token, marketShellOverview?.marketId, t]);
  useEffect(() => {
    if (!auth?.token || !corridorPlacement || corridorPlacement.points.length < 2) return;
    const marketId = marketShellOverview?.marketId ?? auth.countryId;
    if (!marketId) return;
    const nonce = corridorPlacement.previewNonce;
    let canceled = false;
    setCorridorPlacement((current) => current ? { ...current, pending: true } : current);
    previewMarketTransportCorridor(auth.token, marketId, {
      waypoints: corridorPlacement.points,
      transportMode: corridorPlacement.transportMode,
    })
      .then((result: { preview: MarketTransportCorridorPreview }) => {
        if (canceled) return;
        setCorridorPlacement((current) => {
          if (!current || current.previewNonce !== nonce) return current;
          return {
            ...current,
            previewHexIds: result.preview.computedHexIds.filter(isHexId),
            costConstruction: result.preview.costConstruction,
            connectedRegionIds: result.preview.connectedRegionIds,
            blockingReason: null,
            pending: false,
          };
        });
      })
      .catch((error) => {
        if (canceled) return;
        const code = error instanceof Error ? error.message : "MARKET_CORRIDOR_PREVIEW_FAILED";
        setCorridorPlacement((current) => {
          if (!current || current.previewNonce !== nonce) return current;
          if (code === "CORRIDOR_ENDPOINT_CITY_REQUIRED") {
            return {
              ...current,
              costConstruction: null,
              connectedRegionIds: [],
              blockingReason: null,
              pending: false,
            };
          }
          return {
            ...current,
            previewHexIds: [],
            costConstruction: null,
            connectedRegionIds: [],
            blockingReason: t(getCorridorErrorKey(code)),
            pending: false,
          };
        });
      });
    return () => {
      canceled = true;
    };
  }, [auth?.countryId, auth?.token, corridorPlacement?.previewNonce, marketShellOverview?.marketId, t]);
  const canceledConstructionQueueKeyList = useMemo(
    () => [...canceledConstructionQueueKeys],
    [canceledConstructionQueueKeys],
  );
  const myTechnologyProjection = useMemo(() => {
    if (!auth || !worldBase) {
      return { activeCount: 0, predictedPointsSpend: 0 };
    }

    const EPS = 1e-6;
    const technologyState = worldBase.technologyByCountry?.[auth.countryId];
    const activeTechnologyIds =
      technologyState?.activeTechnologyIds && technologyState.activeTechnologyIds.length > 0
        ? technologyState.activeTechnologyIds
        : technologyState?.activeTechnologyId
          ? [technologyState.activeTechnologyId]
          : [];
    const researchedIds = new Set(technologyState?.researchedTechnologyIds ?? []);
    const progressByTechnologyId = technologyState?.progressByTechnologyId ?? {};
    const technologyById = new Map(technologyEntries.map((technology) => [technology.id, technology] as const));
    const activeProjects = activeTechnologyIds
      .map((technologyId) => {
        const technology = technologyById.get(technologyId);
        if (!technology || researchedIds.has(technology.id)) return null;
        const prerequisitesMet = (technology.prerequisiteTechnologyIds ?? []).every((id) => researchedIds.has(id));
        if (!prerequisitesMet) return null;
        const costScience = Math.max(1, Number(technology.costScience ?? 100));
        const progressScience = Math.max(0, Number(progressByTechnologyId[technology.id] ?? 0));
        return {
          remainingScience: Math.max(0, costScience - progressScience),
        };
      })
      .filter((item): item is { remainingScience: number } => Boolean(item && item.remainingScience > EPS));

    if (activeProjects.length === 0) {
      return { activeCount: 0, predictedPointsSpend: 0 };
    }

    let remainingScienceBudget = Math.max(
      0,
      Number(currentResources.science ?? 0) + Number(resourceGrowthByTurn.science ?? 0),
    );
    if (remainingScienceBudget <= EPS) {
      return { activeCount: activeProjects.length, predictedPointsSpend: 0 };
    }

    let active = activeProjects.map((project) => ({ ...project }));
    let pointsSpend = 0;
    while (remainingScienceBudget > EPS && active.length > 0) {
      const equalShare = remainingScienceBudget / active.length;
      let progressedInRound = 0;
      const nextActive: typeof active = [];
      for (const project of active) {
        const appliedScience = Math.min(equalShare, project.remainingScience);
        if (appliedScience <= EPS) continue;
        project.remainingScience = Math.max(0, project.remainingScience - appliedScience);
        remainingScienceBudget = Math.max(0, remainingScienceBudget - appliedScience);
        pointsSpend += appliedScience;
        progressedInRound += appliedScience;

        if (project.remainingScience > EPS) {
          nextActive.push(project);
        }
      }
      if (progressedInRound <= EPS) break;
      active = nextActive;
    }

    return {
      activeCount: activeProjects.length,
      predictedPointsSpend: Math.max(0, Math.floor(pointsSpend)),
    };
  }, [
    auth,
    currentResources.science,
    resourceGrowthByTurn.science,
    technologyEntries,
    worldBase,
  ]);
  const storyPreview = useMemo(() => {
    if (!auth) return [];
    return eventLog
      .filter((entry) => entry.visibility !== "private" || !entry.countryId || entry.countryId === auth.countryId)
      .slice(-5)
      .reverse()
      .map((entry) => ({
        id: entry.id,
        turn: entry.turn,
        title: entry.title,
        message: entry.message,
        priority: entry.priority,
        categoryKey: getStoryCategoryKey(entry.category),
      }));
  }, [auth, eventLog]);
  const populationPreview = useMemo(() => {
    if (!auth || !worldBase) return [];
    let pops = 0;
    const cultureTotals = new Map<string, number>();
    const professionTotals = new Map<string, number>();
    for (const [regionId, population] of Object.entries(worldBase.regionPopulationByRegion ?? {})) {
      const controllingCountryId = worldBase.regionController?.[regionId] ?? worldBase.regionOwner?.[regionId] ?? "";
      if (controllingCountryId !== auth.countryId) continue;
      for (const pop of population?.pops ?? []) {
        pops += 1;
        const size = Math.max(0, Number(pop.size ?? 0));
        cultureTotals.set(pop.cultureId, (cultureTotals.get(pop.cultureId) ?? 0) + size);
        for (const [professionId, state] of Object.entries(pop.professions ?? {})) {
          professionTotals.set(professionId, (professionTotals.get(professionId) ?? 0) + Math.max(0, Number(state.size ?? 0)));
        }
      }
    }
    const topCulture = [...cultureTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    const topProfession = [...professionTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    return [
      { labelKey: "shell.preview.populationTotal" as const, value: currentCountryPopulationSummary.total, detail: `${pops}` },
      topCulture ? { labelKey: "shell.preview.topCulture" as const, value: topCulture[1], detail: topCulture[0] } : null,
      topProfession ? { labelKey: "shell.preview.topProfession" as const, value: topProfession[1], detail: topProfession[0] } : null,
    ].filter((row): row is { labelKey: "shell.preview.populationTotal" | "shell.preview.topCulture" | "shell.preview.topProfession"; value: number; detail: string } => Boolean(row));
  }, [auth, currentCountryPopulationSummary.total, worldBase]);
  const diplomacyPreview = useMemo(() => {
    if (!auth || !worldBase) return [];
    const related = (worldBase.diplomacyProposals ?? []).filter(
      (proposal) => proposal.fromCountryId === auth.countryId || proposal.toCountryId === auth.countryId,
    );
    const pendingResponse = related.filter((proposal) => proposal.pendingResponderCountryId === auth.countryId).length;
    const outbound = related.filter((proposal) => proposal.fromCountryId === auth.countryId && proposal.status.includes("pending")).length;
    return [
      { labelKey: "shell.preview.pendingResponse" as const, value: pendingResponse, detailKey: "shell.preview.pendingResponseDetail" as const },
      { labelKey: "shell.preview.outboundProposals" as const, value: outbound, detailKey: "shell.preview.outboundProposalsDetail" as const },
      { labelKey: "shell.preview.relatedTreaties" as const, value: related.length, detailKey: "shell.preview.relatedTreatiesDetail" as const },
    ];
  }, [auth, worldBase]);
  const armyPreview = useMemo(() => {
    if (!auth || !worldBase) return [];
    const units = Object.values(worldBase.unitsById ?? {}).filter((unit) => unit.countryId === auth.countryId);
    const moving = units.filter((unit) => unit.status === "moving").length;
    const fighting = units.filter((unit) => unit.status === "fighting").length;
    const queue = worldBase.unitTrainingQueueByCountry?.[auth.countryId] ?? [];
    return [
      { labelKey: "shell.preview.divisions" as const, value: units.length, detail: `${moving}/${fighting}` },
      { labelKey: "shell.preview.formationQueue" as const, value: queue.length, detailKey: "shell.preview.formationQueueDetail" as const },
      { labelKey: "shell.preview.averageOrganization" as const, value: Math.floor(units.reduce((sum, unit) => sum + Number(unit.hp ?? 0), 0) / Math.max(1, units.length)), detailKey: "shell.preview.averageOrganizationDetail" as const },
    ];
  }, [auth, worldBase]);
  const readyUnits = useMemo(() => {
    if (!auth || !worldBase) return [];
    return Object.values(worldBase.unitsById ?? {}).filter((unit) => unit.countryId === auth.countryId && unit.status !== "destroyed");
  }, [auth, worldBase]);
  const readyUnitsById = useMemo(() => Object.fromEntries(readyUnits.map((unit) => [unit.id, unit])), [readyUnits]);
  const unitTrainingQueue = useMemo(() => {
    if (!auth || !worldBase) return [];
    return worldBase.unitTrainingQueueByCountry?.[auth.countryId] ?? [];
  }, [auth, worldBase]);
  const unitPreview = useMemo(() => {
    const idle = readyUnits.filter((unit) => unit.status === "idle").length;
    return [
      { labelKey: "shell.preview.readyUnits" as const, value: readyUnits.length, detail: `${idle}` },
      { labelKey: "shell.preview.trainingUnits" as const, value: unitTrainingQueue.length, detailKey: "shell.preview.trainingUnitsDetail" as const },
      { labelKey: "shell.preview.unitTypes" as const, value: unitTypeEntries.length, detailKey: "shell.preview.unitTypesDetail" as const },
    ];
  }, [readyUnits, unitTrainingQueue.length, unitTypeEntries.length]);
  const governancePreview = useMemo(() => {
    if (!auth || !worldBase) return [];
    const parliament = worldBase.parliamentByCountry?.[auth.countryId] ?? null;
    const technology = worldBase.technologyByCountry?.[auth.countryId] ?? null;
    const decisions = worldBase.countryDecisionsByCountryId?.[auth.countryId];
    const events = worldBase.countryEventsByCountryId?.[auth.countryId];
    const activeTechCount = technology?.activeTechnologyIds?.length ?? (technology?.activeTechnologyId ? 1 : 0);
    const billCount = (parliament?.currentBills?.length ?? 0) + (parliament?.currentBill ? 1 : 0);
    const decisionCount = decisions ? Object.keys(decisions).length : 0;
    const eventCount = events ? Object.keys(events).length : 0;
    return [
      { labelKey: "shell.dashboard.activeResearch" as const, value: activeTechCount, detailKey: "shell.preview.activeResearchDetail" as const },
      { labelKey: "shell.preview.bills" as const, value: billCount, detailKey: "shell.preview.billsDetail" as const },
      { labelKey: "shell.preview.records" as const, value: decisionCount + eventCount, detailKey: "shell.preview.recordsDetail" as const },
    ];
  }, [auth, worldBase]);

  const subsidyBudgetBreakdown = useMemo(() => {
    const empty = { total: 0, items: [] as Array<{ regionId: string; buildingId: string; instanceId: string; amount: number }> };
    if (!auth || !worldBase) {
      return empty;
    }
    const items: Array<{ regionId: string; buildingId: string; instanceId: string; amount: number }> = [];
    for (const [regionId, instances] of Object.entries(worldBase.regionBuildingsByRegion ?? {})) {
      if (!Array.isArray(instances) || instances.length === 0) continue;
      const regionOwnerCountryId = worldBase.regionController?.[regionId] ?? worldBase.regionOwner?.[regionId] ?? "";
      for (const instance of instances) {
        const subsidySourceCountryId =
          instance.owner.type === "state"
            ? instance.owner.countryId
            : regionOwnerCountryId;
        if (subsidySourceCountryId !== auth.countryId) continue;
        const amount = Math.max(0, Number(instance.lastStateSubsidyDucats ?? 0));
        if (amount <= 0) continue;
        items.push({
          regionId,
          buildingId: instance.buildingId,
          instanceId: instance.instanceId,
          amount,
        });
      }
    }
    const sorted = items.sort((a, b) => b.amount - a.amount);
    return {
      total: Math.floor(sorted.reduce((sum, item) => sum + item.amount, 0)),
      items: sorted,
    };
  }, [auth, worldBase]);

  const ducatExpenseBreakdown = useMemo(() => {
    const customization = customizationDucatSpend.turnId === turnId ? Math.max(0, Math.floor(customizationDucatSpend.amount)) : 0;
    const hexRename = hexRenameDucatSpend.turnId === turnId ? Math.max(0, Math.floor(hexRenameDucatSpend.amount)) : 0;
    const colonizationSupport =
      myColonizationProjection.predictedPointsSpend > 0
        ? Math.min(
            myColonizationProjection.predictedSupportDucatSpend,
            Math.max(0, Math.floor(currentResources.ducats ?? 0)),
          )
        : 0;
    const construction = myConstructionProjection.predictedPointsSpend > 0 ? Math.max(0, Math.floor(myConstructionProjection.predictedDucatSpend)) : 0;
    const subsidies = Math.max(0, Math.floor(subsidyBudgetBreakdown.total));
    return {
      customization,
      hexRename,
      colonizationSupport,
      construction,
      subsidies,
      total: customization + hexRename + colonizationSupport + construction + subsidies,
    };
  }, [
    currentResources.ducats,
    customizationDucatSpend.amount,
    customizationDucatSpend.turnId,
    myColonizationProjection.predictedPointsSpend,
    myColonizationProjection.predictedSupportDucatSpend,
    myConstructionProjection.predictedDucatSpend,
    myConstructionProjection.predictedPointsSpend,
    hexRenameDucatSpend.amount,
    hexRenameDucatSpend.turnId,
    subsidyBudgetBreakdown.total,
    turnId,
  ]);

  const currentTurnExpenses = useMemo(() => {
    const empty = { culture: 0, science: 0, religion: 0, colonization: 0, construction: 0, ducats: 0, gold: 0 };
    if (!auth) {
      return empty;
    }

    const totals = { ...empty };

    totals.ducats += ducatExpenseBreakdown.customization;
    totals.ducats += ducatExpenseBreakdown.hexRename;

    if (myColonizationProjection.predictedPointsSpend > 0) {
      totals.colonization += myColonizationProjection.predictedPointsSpend;
      totals.ducats += ducatExpenseBreakdown.colonizationSupport;
    }
    if (myConstructionProjection.predictedPointsSpend > 0) {
      totals.construction += myConstructionProjection.predictedPointsSpend;
      totals.ducats += ducatExpenseBreakdown.construction;
    }
    if (myTechnologyProjection.predictedPointsSpend > 0) {
      totals.science += myTechnologyProjection.predictedPointsSpend;
    }
    totals.ducats += ducatExpenseBreakdown.subsidies;

    return totals;
  }, [
    auth,
    ducatExpenseBreakdown.colonizationSupport,
    ducatExpenseBreakdown.construction,
    ducatExpenseBreakdown.customization,
    ducatExpenseBreakdown.hexRename,
    ducatExpenseBreakdown.subsidies,
    myColonizationProjection.predictedPointsSpend,
    myConstructionProjection.predictedPointsSpend,
    myTechnologyProjection.predictedPointsSpend,
  ]);
  const marketPreview = useMemo(
    () => [
      {
        labelKey: "shell.dashboard.treasury" as const,
        value: Math.floor(currentResources.ducats).toString(),
        delta: (resourceGrowthByTurn.ducats ?? 0) - (currentTurnExpenses.ducats ?? 0),
      },
      { labelKey: "shell.dashboard.goldReserve" as const, value: Math.floor(currentResources.gold).toString(), delta: resourceGrowthByTurn.gold ?? 0 },
      { labelKey: "shell.preview.subsidies" as const, value: Math.floor(ducatExpenseBreakdown.subsidies).toString(), delta: -ducatExpenseBreakdown.subsidies },
    ],
    [
      currentResources.ducats,
      currentResources.gold,
      currentTurnExpenses.ducats,
      ducatExpenseBreakdown.subsidies,
      resourceGrowthByTurn.ducats,
      resourceGrowthByTurn.gold,
    ],
  );
  const marketTradeRows = useMemo<MarketTradeOverviewRow[]>(() => {
    const overview = marketShellOverview;
    if (!overview) return [];
    const countryById = new Map(marketShellCountries.map((item) => [item.id, item] as const));
    return overview.goods
      .map((good) => {
        const trade = overview.tradeByGood?.[good.goodId];
        const importsByCountry = trade?.countryImportsByCountry ?? {};
        const exportsByCountry = trade?.countryExportsByCountry ?? {};
        const importsTotal = sumPositiveRecord(importsByCountry);
        const exportsTotal = sumPositiveRecord(exportsByCountry);
        return {
          goodId: good.goodId,
          goodName: good.goodName,
          price: Math.max(0, Number(good.countryPrice) || 0),
          priceDeltaPct: calculateLastRelativeDeltaPct(good.countryPriceHistory),
          importsTotal,
          exportsTotal,
          imports: buildMarketShellPartners(importsByCountry, countryById),
          exports: buildMarketShellPartners(exportsByCountry, countryById),
        };
      })
      .sort((a, b) => b.importsTotal + b.exportsTotal - (a.importsTotal + a.exportsTotal) || a.goodName.localeCompare(b.goodName, "ru"));
  }, [marketShellCountries, marketShellOverview]);
  useEffect(() => {
    setCustomizationDucatSpend((prev) => (prev.turnId === turnId ? prev : { turnId, amount: 0 }));
    setHexRenameDucatSpend((prev) => (prev.turnId === turnId ? prev : { turnId, amount: 0 }));
  }, [turnId]);

  const logoutToAuth = () => {
    addEvent({ category: "system", title: t("shell.logoutTitle"), message: t("shell.logoutMessage"), priority: "low", visibility: "private", countryId: auth?.countryId ?? null });
    clearResolveStartTimeout();
    setTurnResolveOverlay({ phase: "idle" });
    setAuth(null);
    setCountry(null);
    setEntryLoadingGate("hidden");
    toast(t("shell.logoutToast"));
  };

  const forceResolveAsAdmin = () => {
    if (!auth?.isAdmin) {
      toast.error(t("shell.adminOnly"));
      return;
    }

    setTurnResolveOverlay({ phase: "processing", startedAtMs: Date.now() });
    send({ type: "ADMIN_FORCE_RESOLVE" });
    toast(t("shell.adminCommandSent"), { description: t("shell.resolveForceDescription") });
    addEvent({ category: "system", title: t("shell.adminCommandTitle"), message: t("shell.resolveForceDescription"), priority: "high", visibility: "private", countryId: auth.countryId });
  };

  const handleSessionCountryUpdated = (updated: { name: string; color: string; flagUrl?: string | null; crestUrl?: string | null; isAdmin?: boolean }) => {
    setCountry((prev) => ({
      name: updated.name,
      color: updated.color,
      flagUrl: updated.flagUrl ?? prev?.flagUrl ?? null,
      crestUrl: updated.crestUrl ?? prev?.crestUrl ?? null,
    }));

    if (auth) {
      setAuth({ ...auth, isAdmin: Boolean(updated.isAdmin) });
    }
  };


  const queueBuildOrder = (regionId?: string, payload?: Record<string, unknown>, targetHexId?: HexId) => {
    if (!auth) {
      return;
    }
    if (!targetHexId) {
      toast.error(t("buildings.hexPlacementRequired"));
      return;
    }

    const targetRegionId = regionId ?? selectedHexId ?? "ARG-1309";
    const normalizedPayload = (payload ?? {}) as Record<string, unknown>;
    const payloadBuildingId =
      typeof normalizedPayload.buildingId === "string"
        ? normalizedPayload.buildingId
        : typeof normalizedPayload.building === "string"
          ? normalizedPayload.building
          : undefined;

    const delta: OrderDelta = {
      type: "ORDER_DELTA",
      order: {
        turnId,
        playerId: auth.playerId,
        countryId: auth.countryId,
        regionId: targetRegionId,
        targetHexId,
        type: "BUILD",
        payload: normalizedPayload,
      },
    };

    send(delta);
    addOrder({
      ...delta.order,
      id: `local:${turnId}:${targetHexId}:${payloadBuildingId ?? "building"}`,
      createdAt: new Date().toISOString(),
    });
    toast(t("shell.orderSent"), {
      description: payloadBuildingId
        ? `BUILD -> ${targetHexId} (${payloadBuildingId})`
        : `BUILD -> ${targetHexId}`,
    });
    addEvent({
      category: "economy",
      title: t("shell.orderSent"),
      message: payloadBuildingId ? `BUILD -> ${targetHexId} (${payloadBuildingId})` : `BUILD -> ${targetHexId}`,
      countryId: auth.countryId,
      priority: "medium",
      visibility: "private",
      turn: turnId,
    });
  };

  const queueArmyMoveOrder = (divisionId: string, hexId: string, path?: string[]) => {
    if (!auth || !divisionId || !isHexId(hexId)) {
      return;
    }
    const routePath = Array.isArray(path) ? path.filter((value) => typeof value === "string" && value.trim().length > 0) : [];
    const isMapUnit = Boolean(worldBase?.unitsById?.[divisionId]);

    const delta: OrderDelta = {
      type: "ORDER_DELTA",
      order: {
        turnId,
        playerId: auth.playerId,
        countryId: auth.countryId,
        targetHexId: hexId,
        type: "UNIT_MOVE",
        unitId: divisionId,
        unitKind: isMapUnit ? "map" : "division",
        path: routePath.filter(isHexId),
        payload: routePath.length > 0 ? { divisionId, unitId: divisionId, path: routePath } : { divisionId, unitId: divisionId },
      },
    };

    send(delta);
    setTurnActionsNonce((value) => value + 1);
    toast(t("shell.orderSent"), { description: routePath.length > 1 ? `UNIT_MOVE: ${routePath.length}` : `UNIT_MOVE -> ${hexId}` });
    addEvent({
      category: "military",
      title: t("shell.orderSent"),
      message: t("shell.orderArmyMoveMessage", { division: divisionId, province: hexId }),
      countryId: auth.countryId,
      priority: "medium",
      visibility: "private",
      turn: turnId,
    });
  };

  const queueFleetMoveOrder = (fleetId: string, hexId: string, path?: string[]) => {
    if (!auth || !fleetId || !isHexId(hexId)) {
      return;
    }
    const routePath = Array.isArray(path) ? path.filter((value) => typeof value === "string" && value.trim().length > 0) : [];

    const delta: OrderDelta = {
      type: "ORDER_DELTA",
      order: {
        turnId,
        playerId: auth.playerId,
        countryId: auth.countryId,
        targetHexId: hexId,
        type: "UNIT_MOVE",
        unitId: fleetId,
        unitKind: "fleet",
        path: routePath.filter(isHexId),
        payload: routePath.length > 0 ? { fleetId, path: routePath } : { fleetId },
      },
    };

    send(delta);
    toast(t("shell.orderSent"), { description: routePath.length > 1 ? `UNIT_MOVE: ${routePath.length}` : `UNIT_MOVE -> ${hexId}` });
    addEvent({
      category: "military",
      title: t("shell.orderSent"),
      message: t("shell.orderArmyMoveMessage", { division: fleetId, province: hexId }),
      countryId: auth.countryId,
      priority: "medium",
      visibility: "private",
      turn: turnId,
    });
  };

  const queueUnitAttackOrder = (divisionId: string, targetHexId: HexId, targetUnitId?: string | null) => {
    if (!auth || !divisionId || !isHexId(targetHexId)) {
      return;
    }

    const delta: OrderDelta = {
      type: "ORDER_DELTA",
      order: {
        turnId,
        playerId: auth.playerId,
        countryId: auth.countryId,
        type: "UNIT_ATTACK",
        attackerUnitId: divisionId,
        targetHexId,
        ...(targetUnitId ? { targetUnitId } : {}),
        payload: {},
      },
    };

    send(delta);
    setTurnActionsNonce((value) => value + 1);
    addOrder({
      ...delta.order,
      id: `local:${turnId}:${divisionId}:unit-attack`,
      createdAt: new Date().toISOString(),
    });
    toast(t("hexMap.divisionAttackOrderSent"), { description: `${divisionId} -> ${targetHexId}` });
    addEvent({
      category: "military",
      title: t("hexMap.divisionAttackOrderSent"),
      message: `${divisionId} -> ${targetHexId}`,
      countryId: auth.countryId,
      priority: "medium",
      visibility: "private",
      turn: turnId,
    });
  };

  const startHexBuildPlacement = (request: {
    building: ContentEntry;
    owner: { type: "state"; countryId: string } | { type: "company"; companyId: string };
  }) => {
    setHexBuildConfirmTarget(null);
    setHexBuildPlacement(request);
    setActiveStrategyMode("construction");
    toast(t("buildings.hexPlacementStarted"), { description: request.building.name });
  };

  const queueCivilianUnitMoveOrder = (unitId: string, fromHexId: HexId, targetHexId: HexId, path?: HexId[]) => {
    if (!auth || !unitId || !isHexId(fromHexId) || !isHexId(targetHexId)) {
      return;
    }
    const routePath = Array.isArray(path) && path.length > 0 ? path : [fromHexId, targetHexId];

    const delta: OrderDelta = {
      type: "ORDER_DELTA",
      order: {
        turnId,
        playerId: auth.playerId,
        countryId: auth.countryId,
        unitId,
        unitKind: "civilian",
        targetHexId,
        path: routePath,
        type: "UNIT_MOVE",
        payload: { unitId, unitKind: "civilian", path: routePath },
      },
    };

    send(delta);
    setTurnActionsNonce((value) => value + 1);
    addOrder({
      ...delta.order,
      id: `local:${turnId}:${unitId}:unit-move`,
      createdAt: new Date().toISOString(),
    });
    toast(t("hexMap.civilianMoveOrderSent"), { description: `${unitId} -> ${targetHexId}` });
    addEvent({
      category: "colonization",
      title: t("hexMap.civilianMoveOrderSent"),
      message: `${unitId} -> ${targetHexId}`,
      countryId: auth.countryId,
      priority: "medium",
      visibility: "private",
      turn: turnId,
    });
  };

  const queueFoundCityOrder = (civilianUnitId: string, hexId: HexId, regionId: string, cityName: string, cultureId?: string | null) => {
    const normalizedCityName = cityName.trim();
    if (!auth || !civilianUnitId || !isHexId(hexId) || normalizedCityName.length === 0 || normalizedCityName.length > 32) {
      return;
    }

    const delta: OrderDelta = {
      type: "ORDER_DELTA",
      order: {
        turnId,
        playerId: auth.playerId,
        countryId: auth.countryId,
        civilianUnitId,
        name: normalizedCityName,
        regionId,
        targetHexId: hexId,
        type: "FOUND_CITY",
        payload: cultureId ? { cultureId, name: normalizedCityName } : { name: normalizedCityName },
      },
    };

    send(delta);
    addOrder({
      ...delta.order,
      id: `local:${turnId}:${civilianUnitId}:found-city`,
      createdAt: new Date().toISOString(),
    });
    toast(t("hexMap.foundCityOrderSent"), { description: normalizedCityName });
    addEvent({
      category: "colonization",
      title: t("hexMap.foundCityOrderSent"),
      message: `${civilianUnitId} -> ${normalizedCityName}`,
      countryId: auth.countryId,
      priority: "medium",
      visibility: "private",
      turn: turnId,
    });
  };

  const queueColonizerOnHex = async (hexId: HexId) => {
    if (!auth?.token) {
      toast.error(t("shell.buildings.noCountry"));
      return;
    }
    setQueueingColonizerHexId(hexId);
    try {
      await queueCountryColonizer(auth.token, hexId);
      toast.success(t("hexMap.queueColonizerQueued"), { description: hexId });
      addEvent({
        category: "colonization",
        title: t("hexMap.queueColonizerQueued"),
        message: hexId,
        countryId: auth.countryId,
        priority: "medium",
        visibility: "private",
        turn: turnId,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "COLONIZER_QUEUE_FAILED";
      const key = resolveColonizerQueueErrorKey(code);
      toast.error(t(key));
    } finally {
      setQueueingColonizerHexId((current) => (current === hexId ? null : current));
    }
  };

  const trainUnitOnHex = async (unitTypeId: string, hexId: HexId) => {
    if (!auth?.token) {
      toast.error(t("shell.buildings.noCountry"));
      return;
    }
    try {
      await trainUnit(auth.token, { unitTypeId, hexId });
      const unitType = unitTypeEntries.find((entry) => entry.id === unitTypeId);
      toast.success(t("shell.units.trainingQueued"), { description: unitType ? t(unitType.nameKey) : unitTypeId });
      addEvent({
        category: "military",
        title: t("shell.units.trainingQueued"),
        message: `${unitTypeId} -> ${hexId}`,
        countryId: auth.countryId,
        priority: "medium",
        visibility: "private",
        turn: turnId,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNIT_TRAIN_FAILED";
      toast.error(t(resolveUnitTrainingErrorKey(code)));
    }
  };

  const cancelUnitTrainingQueueItem = async (queueId: string) => {
    if (!auth?.token) return;
    setCancelingUnitTrainingQueueId(queueId);
    try {
      await cancelUnitTraining(auth.token, queueId);
      toast.success(t("shell.units.trainingCanceled"));
    } catch {
      toast.error(t("shell.units.trainingCancelFailed"));
    } finally {
      setCancelingUnitTrainingQueueId((current) => (current === queueId ? null : current));
    }
  };

  const disbandReadyUnit = async (unitId: string) => {
    if (!auth?.token) return;
    try {
      await disbandUnit(auth.token, unitId);
      toast.success(t("shell.units.disbanded"));
    } catch {
      toast.error(t("shell.units.disbandFailed"));
    }
  };

  const selectedUnitTrainingType = unitTrainingPlacement
    ? unitTypeEntries.find((entry) => entry.id === unitTrainingPlacement.unitTypeId) ?? null
    : null;

  const startHexBuildPlacementForBuilding = (buildingId: string) => {
    if (!auth) {
      toast.error(t("shell.buildings.noCountry"));
      return;
    }

    const building = buildingEntries.find((entry) => entry.id === buildingId);
    if (!building) {
      toast.error(t("shell.buildings.empty"));
      return;
    }

    startHexBuildPlacement({
      building,
      owner: { type: "state", countryId: auth.countryId },
    });
  };

  const getHexBuildOwnerName = (owner: { type: "state"; countryId: string } | { type: "company"; companyId: string }): string => {
    if (owner.type === "company") {
      return companyEntries.find((company) => company.id === owner.companyId)?.name ?? owner.companyId;
    }
    return countryNameById[owner.countryId] ?? owner.countryId;
  };

  const getHexBuildOwnerIconUrl = (owner: { type: "state"; countryId: string } | { type: "company"; companyId: string }): string | null => {
    if (owner.type === "company") {
      return companyEntries.find((company) => company.id === owner.companyId)?.logoUrl ?? null;
    }
    const ownerCountry = countryById.get(owner.countryId);
    return ownerCountry?.flagUrl ?? ownerCountry?.crestUrl ?? null;
  };

  const hexBuildOwnerToSelectValue = (owner: { type: "state"; countryId: string } | { type: "company"; companyId: string }): string =>
    owner.type === "company" ? `company:${owner.companyId}` : `state:${owner.countryId}`;

  const parseHexBuildOwnerSelectValue = (value: string): { type: "state"; countryId: string } | { type: "company"; companyId: string } | null => {
    const separatorIndex = value.indexOf(":");
    if (separatorIndex <= 0) return null;
    const type = value.slice(0, separatorIndex);
    const id = value.slice(separatorIndex + 1);
    if (!id) return null;
    if (type === "company") return { type: "company", companyId: id };
    if (type === "state") return { type: "state", countryId: id };
    return null;
  };

  const hexBuildOwnerOptions = useMemo(() => {
    const stateCountryIds = new Set<string>();
    if (auth?.countryId) stateCountryIds.add(auth.countryId);
    if (hexBuildConfirmTarget?.owner.type === "state") stateCountryIds.add(hexBuildConfirmTarget.owner.countryId);
    return [
      ...[...stateCountryIds].map((countryId) => ({
        value: `state:${countryId}`,
        label: countryNameById[countryId] ?? country?.name ?? countryId,
      })),
      ...companyEntries.map((company) => ({
        value: `company:${company.id}`,
        label: company.name ?? company.id,
      })),
    ];
  }, [auth?.countryId, companyEntries, country?.name, countryNameById, hexBuildConfirmTarget?.owner]);

  useEffect(() => {
    pruneLogEntries(turnId);
  }, [eventLogRetentionTurns, pruneLogEntries, turnId]);

  useEffect(() => {
    clearResolveStartTimeout();
  }, [turnId, clearResolveStartTimeout]);

  useEffect(() => {
    if (!auth) {
      setEntryLoadingGate("hidden");
      setMapReady(false);
      return;
    }
    const ready = Boolean(worldBase) && Boolean(country) && publicUiLoaded && mapReady;
    setEntryLoadingGate((prev) => {
      if (prev === "hidden") return prev;
      if (prev === "loading" && ready) return "ready";
      return prev;
    });
  }, [auth, country, mapReady, publicUiLoaded, worldBase]);

  useEffect(() => {
    if (!auth?.token) return;
    let cancelled = false;
    const syncPendingNotifications = () => {
      fetchPendingUiNotifications(auth.token)
        .then((items) => {
        if (cancelled || items.length === 0) return;
        setUiNotificationHistory((prev) => {
          const next = [...prev];
          for (const item of items) {
            const normalizedItem = {
              ...(item as InAppUiNotification),
              receivedTurnId: (item as InAppUiNotification).receivedTurnId ?? turnId,
            } satisfies InAppUiNotification;
            const existingIdx = next.findIndex((n) => n.id === normalizedItem.id);
            if (existingIdx >= 0) {
              next.splice(existingIdx, 1);
            }
            next.unshift(normalizedItem);
          }
          const deduped = dedupeNotifications(next);
          deduped.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          return deduped.slice(0, 200);
        });
        setUiNotifications((prev) => {
          const next = [...prev];
          for (const item of items) {
            const normalizedItem = {
              ...(item as InAppUiNotification),
              receivedTurnId: (item as InAppUiNotification).receivedTurnId ?? turnId,
            } satisfies InAppUiNotification;
            const existingIdx = next.findIndex((n) => n.id === normalizedItem.id);
            if (existingIdx >= 0) {
              next.splice(existingIdx, 1);
            }
            next.unshift(normalizedItem);
          }
          return dedupeNotifications(next).slice(0, 8);
        });
      })
      .catch(() => {
        // keep realtime-only behavior if endpoint fails
      });
    };
    syncPendingNotifications();
    return () => {
      cancelled = true;
    };
  }, [auth?.token, turnId]);

  useEffect(() => {
    if (!auth?.token) return;
    let cancelled = false;
    fetchCountryEvents(auth.token, auth.countryId)
      .then((result) => {
        if (cancelled) return;
        const activePendingIds = new Set(result.events.map((event) => event.pendingId));
        const keepActiveCountryEventNotifications = (items: InAppUiNotification[]) =>
          items.filter(
            (item) =>
              item.action.type !== "country-event" ||
              item.action.countryId !== auth.countryId ||
              activePendingIds.has(item.action.pendingId),
          );
        setUiNotifications(keepActiveCountryEventNotifications);
        setUiNotificationHistory(keepActiveCountryEventNotifications);
        setFocusedEventPendingId((current) => (current && !activePendingIds.has(current) ? null : current));
      })
      .catch(() => {
        // Notification cleanup is best-effort; opening a notification validates it again.
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.countryId, auth?.token, turnId]);

  useEffect(() => {
    if (!auth?.token) {
      setTurnActions([]);
      return;
    }
    let cancelled = false;
    fetchTurnActions(auth.token)
      .then((checklist) => {
        if (cancelled) return;
        setTurnActions(checklist.items);
      })
      .catch(() => {
        if (!cancelled) setTurnActions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.token, turnId, turnActionsNonce]);

  const requestNextTurn = (options?: { force?: boolean }) => {
    if (turnResolveOverlay.phase === "processing") return;
    if (options?.force && turnActions.some((item) => item.severity === "blocking")) {
      const confirmed = window.confirm(t("turnActions.forceEndTurnConfirm", { count: turnActions.filter((item) => item.severity === "blocking").length }));
      if (!confirmed) return;
    }
    send({ type: "REQUEST_RESOLVE" });
    armResolveStartTimeout("manual");
  };

  const focusTurnAction = (item: TurnActionItem) => {
    if (item.action.type === "focus_hex") {
      setMapFocusRequest({ hexId: item.action.hexId, nonce: Date.now() });
      setActiveStrategyMode("units");
      setStrategyWorkspaceOpen(true);
    }
    if (item.action.type === "open_strategy_mode") {
      setActiveStrategyMode(item.action.mode as StrategyMode);
      setStrategyWorkspaceOpen(true);
    }
  };

  const queueUnitWaitOrder = (item: TurnActionItem, type: "UNIT_SKIP_TURN" | "UNIT_SLEEP" | "UNIT_WAKE") => {
    if (!auth || item.target.type !== "unit") return;
    const delta: OrderDelta = {
      type: "ORDER_DELTA",
      order: {
        turnId,
        playerId: auth.playerId,
        countryId: auth.countryId,
        type,
        unitId: item.target.unitId,
        unitKind: "map",
        payload: {},
      },
    };
    send(delta);
    addOrder({
      ...delta.order,
      id: `local:${turnId}:${item.target.unitId}:${type}`,
      createdAt: new Date().toISOString(),
    });
    setTurnActions((current) => current.filter((entry) => entry.id !== item.id));
    setTurnActionsNonce((value) => value + 1);
    toast(t(type === "UNIT_SLEEP" ? "turnActions.sleepQueued" : type === "UNIT_WAKE" ? "turnActions.wakeQueued" : "turnActions.skipQueued"));
  };

  const queueUnitWakeOrder = (unit: MapUnit) => {
    if (!auth || unit.countryId !== auth.countryId) return;
    const delta: OrderDelta = {
      type: "ORDER_DELTA",
      order: {
        turnId,
        playerId: auth.playerId,
        countryId: auth.countryId,
        type: "UNIT_WAKE",
        unitId: unit.id,
        unitKind: "map",
        payload: {},
      },
    };
    send(delta);
    addOrder({
      ...delta.order,
      id: `local:${turnId}:${unit.id}:UNIT_WAKE`,
      createdAt: new Date().toISOString(),
    });
    setTurnActionsNonce((value) => value + 1);
    toast(t("turnActions.wakeQueued"));
  };

  useEffect(() => {
    return () => {
      clearResolveStartTimeout();
    };
  }, [clearResolveStartTimeout]);

  const openUiNotification = (item: InAppUiNotification) => {
    setViewedUiNotificationIds((prev) => {
      if (prev.has(item.id)) return prev;
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    if (auth?.token) {
      void markUiNotificationViewed(auth.token, item.id).catch(() => {
        // non-blocking best-effort ack
      });
    }
    if (sortNotifications) {
      setUiNotifications((prev) => {
        const idx = prev.findIndex((n) => n.id === item.id);
        if (idx < 0 || idx === prev.length - 1) return prev;
        const next = [...prev];
        const [opened] = next.splice(idx, 1);
        next.push(opened);
        return next;
      });
    }
    if (item.action.type === "registration-approval") {
      setRegistrationApprovalModal({
        open: true,
        country: item.action.country,
        notificationId: item.id,
        pending: false,
      });
    }
    if (item.action.type === "country-event") {
      if (!auth?.token) return;
      const action = item.action;
      void fetchCountryEvents(auth.token, action.countryId)
        .then((result) => {
          const isStillPending = result.events.some((event) => event.pendingId === action.pendingId);
          if (!isStillPending) {
            const autoResolved = result.record?.history?.find((entry) => entry.eventId === action.eventId);
            const removeStaleEventNotification = (n: InAppUiNotification) =>
              n.action.type !== "country-event" ||
              n.action.countryId !== action.countryId ||
              n.action.pendingId !== action.pendingId ||
              n.action.eventId !== action.eventId;
            setUiNotifications((prev) => prev.filter(removeStaleEventNotification));
            setUiNotificationHistory((prev) => prev.filter(removeStaleEventNotification));
            setFocusedEventPendingId((current) => (current === action.pendingId ? null : current));
            if (autoResolved) {
              const optionLabel = autoResolved.optionLabelKey ? t(autoResolved.optionLabelKey) : autoResolved.optionLabel ?? autoResolved.optionId;
              toast.info(t("shell.eventAutoResolved"), {
                description: t("shell.eventAutoResolvedDescription", { option: optionLabel }),
              });
            } else {
              toast.info(t("shell.eventAlreadyResolved"));
            }
            return;
          }
          setFocusedEventPendingId(action.pendingId);
          setEventsOpen(true);
        })
        .catch(() => {
          setFocusedEventPendingId(action.pendingId);
          setEventsOpen(true);
        });
    }
    if (item.action.type === "election-results") {
      setElectionResultsModal({ open: true, action: item.action });
    }
    if (item.action.type === "diplomacy-proposal") {
      setFocusedDiplomacyProposalId(item.action.proposalId);
      setDiplomacyStoryOpen(true);
    }
  };

  const runUiNotificationQuickAction = async (item: InAppUiNotification, actionId: string) => {
    if (!auth?.token || item.action.type !== "diplomacy-proposal") {
      openUiNotification(item);
      return;
    }
    if (actionId === "revise") {
      setFocusedDiplomacyProposalId(item.action.proposalId);
      setDiplomacyStoryOpen(true);
      return;
    }
    try {
      if (actionId === "accept") {
        await acceptDiplomacyProposal(auth.token, item.action.proposalId);
        toast.success(t("diplomacy.signed"));
      } else if (actionId === "reject") {
        await rejectDiplomacyProposal(auth.token, item.action.proposalId);
        toast.success(t("diplomacy.rejected"));
      } else {
        openUiNotification(item);
        return;
      }
      setUiNotifications((prev) => prev.filter((n) => n.id !== item.id));
      setUiNotificationHistory((prev) => prev.filter((n) => n.id !== item.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(message === "NOT_YOUR_TURN" ? t("diplomacy.storyYourTurnFailed") : t("diplomacy.storyActionFailed"));
      openUiNotification(item);
    }
  };

  const resolveRegistrationApproval = async (approve: boolean) => {
    if (!auth?.token || !registrationApprovalModal.country || !registrationApprovalModal.notificationId) return;
    setRegistrationApprovalModal((prev) => ({ ...prev, pending: true }));
    try {
      const result = await adminReviewRegistration(auth.token, registrationApprovalModal.country.id, approve);
      setUiNotifications((prev) => prev.filter((n) => n.id !== registrationApprovalModal.notificationId));
      setUiNotificationHistory((prev) => prev.filter((n) => n.id !== registrationApprovalModal.notificationId));
      setRegistrationApprovalModal({ open: false, country: null, notificationId: null, pending: false });
      toast.success(approve ? t("shell.registrationApproved") : t("shell.registrationRejected"));
      if (result.country) {
        addEvent({
          category: "politics",
          title: approve ? t("shell.registrationApproved") : t("shell.registrationRejected"),
          message: `${result.country.name}`,
          visibility: "private",
          countryId: auth.countryId,
        });
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "REGISTRATION_REVIEW_FAILED";
      if (code === "REGISTRATION_ALREADY_REVIEWED") {
        toast.error(t("shell.registrationAlreadyReviewed"));
        setUiNotifications((prev) => prev.filter((n) => n.id !== registrationApprovalModal.notificationId));
        setRegistrationApprovalModal({ open: false, country: null, notificationId: null, pending: false });
      } else {
        toast.error(t("shell.registrationReviewFailed"));
        setRegistrationApprovalModal((prev) => ({ ...prev, pending: false }));
      }
    }
  };

  const gameSceneMounted = Boolean(auth && entryLoadingGate === "hidden");
  const entryLoadingProgressPercent = Math.round(
    (((worldBase ? 1 : 0) + (publicUiLoaded ? 1 : 0) + (country ? 1 : 0) + (mapReady ? 1 : 0)) / 4) * 100,
  );

  return (
    <div className="relative h-screen overflow-hidden bg-arc-bg text-[var(--arc-color-text)]">
      {auth ? (
        <div className={gameSceneMounted ? "absolute inset-0" : "pointer-events-none invisible absolute inset-0"} aria-hidden={!gameSceneMounted}>
          <MapView
            apiBase={apiBase}
            scenarioId={activeScenarioId}
            focusHexRequest={gameSceneMounted ? mapFocusRequest : null}
            onQueueArmyMoveOrder={queueArmyMoveOrder}
            onQueueFleetMoveOrder={queueFleetMoveOrder}
            onQueueUnitAttackOrder={queueUnitAttackOrder}
            onQueueCivilianUnitMoveOrder={queueCivilianUnitMoveOrder}
            onFoundCityOrder={queueFoundCityOrder}
            onHexSelectionChange={gameSceneMounted ? setSelectedHexDetails : undefined}
            onOpenSelectedHexWorkspace={(details) => {
              setSelectedHexDetails(details);
              setActiveStrategyMode("overview");
              setStrategyWorkspaceOpen(true);
              setOpenHexWorkspaceRequestId((value) => value + 1);
            }}
            colonizerPlacement={colonizerPlacement}
            onCancelColonizerPlacement={() => setColonizerPlacement(null)}
            onSelectColonizerPlacementTarget={(target) => {
              if (!isHexId(target.hexId)) return;
              setColonizerPlacement(null);
              void queueColonizerOnHex(target.hexId);
            }}
            unitTrainingPlacement={selectedUnitTrainingType ? { unitType: selectedUnitTrainingType } : null}
            onCancelUnitTrainingPlacement={() => setUnitTrainingPlacement(null)}
            onSelectUnitTrainingPlacementTarget={(target) => {
              if (!unitTrainingPlacement || !isHexId(target.hexId)) return;
              const unitTypeId = unitTrainingPlacement.unitTypeId;
              setUnitTrainingPlacement(null);
              void trainUnitOnHex(unitTypeId, target.hexId);
            }}
            colonizationIconUrl={BASE_RESOURCE_ICON_URLS.colonization}
            ducatsIconUrl={BASE_RESOURCE_ICON_URLS.ducats}
            maxActiveColonizations={maxActiveColonizations}
            landDivisionStackLimitPerHex={landDivisionStackLimitPerHex}
            hexRenameDucatsCost={hexRenameDucatsCost}
            countryColorById={countryColorById}
            countryNameById={countryNameById}
            suggestedMapMode={resolveSuggestedMapMode(activeStrategyMode)}
            suggestedMapLens={resolveSuggestedMapLens(activeStrategyMode)}
            showMapControls={showMapControls}
            showZoomIndicator={showZoomIndicator}
            showAntarctica={showAntarctica}
            buildingEntries={buildingEntries}
            buildingOverviewToken={auth.token}
            buildingOverviewCountryId={auth.countryId}
            buildingOverviewBuildings={buildingEntries}
            buildingOverviewCompanies={companyEntries}
            buildingOverviewCountries={countries}
            buildingOverviewIndustries={industryEntries}
            buildingOverviewSectors={sectorEntries}
            buildingOverviewDemolitionCostConstructionPercent={demolitionCostConstructionPercent}
            buildingOverviewCancelingConstructionQueueKey={cancelingConstructionQueueKey}
            onCancelConstructionProject={cancelConstructionQueueProject}
            canceledConstructionQueueKeys={canceledConstructionQueueKeyList}
            hexBuildPlacement={hexBuildPlacement}
            transportCorridors={marketTransportCorridors}
            corridorPlacement={corridorPlacement}
            onSelectCorridorPlacementPoint={selectCorridorPlacementPoint}
            onUndoCorridorPlacementPoint={undoCorridorPlacementPoint}
            onCancelCorridorPlacement={cancelCorridorPlacement}
            onConfirmCorridorPlacement={confirmCorridorPlacement}
            onCancelHexBuildPlacement={() => {
              setHexBuildPlacement(null);
              setHexBuildConfirmTarget(null);
            }}
            onSelectHexBuildPlacementTarget={(target) => {
              if (!hexBuildPlacement || !isHexId(target.hexId)) return;
              setHexBuildConfirmTarget({
                hexId: target.hexId,
                regionId: target.regionId,
                building: hexBuildPlacement.building,
                owner: hexBuildPlacement.owner,
              });
            }}
            onMapReadyChange={setMapReady}
            onHexRenameCharged={(chargedDucats) => {
              if (chargedDucats <= 0) return;
              setHexRenameDucatSpend((prev) =>
                prev.turnId === turnId ? { turnId, amount: prev.amount + chargedDucats } : { turnId, amount: chargedDucats },
              );
            }}
          />
        </div>
      ) : null}

      <AnimatePresence>
        {!auth && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-[#05080d]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[#05080d]" />
            <img
              src={authBackgroundUrl}
              className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center opacity-70"
              aria-hidden="true"
              onError={() => {
                setAuthBackgroundUrl((current) => (current === AUTH_BACKGROUND_FALLBACK_URL ? current : AUTH_BACKGROUND_FALLBACK_URL));
              }}
            />
            <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_45%,rgba(5,8,13,0.12),rgba(5,8,13,0.64)_72%)]" />
            <div className="relative z-10">
              <AuthPanel
                onSuccess={onAuthSuccess}
                onOpenCivilopedia={() => {
                  setCivilopediaIntent(null);
                  setCivilopediaOpen(true);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {gameSceneMounted && (
        <InAppNotificationTray
          items={uiNotifications}
          viewedIds={viewedUiNotificationIds}
          topOffsetPx={88}
          onClickItem={openUiNotification}
          onQuickAction={runUiNotificationQuickAction}
          historyCount={uiNotificationHistory.length}
          pendingDecisionCount={pendingDecisionNotificationCount}
          onOpenHistory={() => setNotificationHistoryOpen(true)}
        />
      )}

      <AnimatePresence>
        {auth && entryLoadingGate !== "hidden" && (
          <motion.div
            key="entry-loading-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="arc-entry-loading-backdrop"
          >
            <img
              src={authBackgroundUrl}
              className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center opacity-70"
              aria-hidden="true"
              onError={() => {
                setAuthBackgroundUrl((current) => (current === AUTH_BACKGROUND_FALLBACK_URL ? current : AUTH_BACKGROUND_FALLBACK_URL));
              }}
            />
            <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_45%,rgba(5,8,13,0.14),rgba(5,8,13,0.66)_72%)]" />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="arc-building-overview-modal arc-entry-loading-modal relative z-10"
            >
              {entryLoadingGate === "loading" ? (
                <>
                  <header className="arc-building-overview-header">
                    <div>
                      <div className="arc-building-overview-title">{t("shell.entryLoadingStatus")}</div>
                      <p>{t("shell.entryLoadingDescription")}</p>
                    </div>
                    <span className="arc-entry-loading-spinner" aria-hidden="true">
                      <Loader2 className="animate-spin" size={22} />
                    </span>
                  </header>
                  <div className="arc-building-overview-body">
                    <div
                      className="arc-entry-progress"
                      role="progressbar"
                      aria-label={t("shell.entryLoadingStatus")}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={entryLoadingProgressPercent}
                    >
                      <span
                        style={{
                          width: `${entryLoadingProgressPercent}%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <header className="arc-building-overview-header">
                    <div>
                      <div className="arc-building-overview-title">{t("shell.entryLoadedTitle")}</div>
                      <p>{t("shell.entryLoadedDescription")}</p>
                    </div>
                    <span className="arc-entry-loaded-icon" aria-hidden="true">
                      <CheckCircle2 size={22} />
                    </span>
                  </header>
                  <div className="arc-building-overview-body arc-entry-ready-body">
                    <button
                      type="button"
                      onClick={() => setEntryLoadingGate("hidden")}
                      className="arc-auth-primary-button"
                    >
                      {t("shell.entryEnterGame")}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {gameSceneMounted && auth && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-none absolute inset-0 z-[111]">
          <StrategyShell
            activeMode={activeStrategyMode}
            onModeChange={setStrategyModeAndOpenWorkspace}
            workspaceOpen={strategyWorkspaceOpen}
            onCloseWorkspace={() => setStrategyWorkspaceOpen(false)}
            countryName={country?.name ?? t("shell.unnamedCountry")}
            countryId={auth.countryId}
            flagUrl={country?.flagUrl}
            crestUrl={country?.crestUrl}
            turnId={turnId}
            resources={currentResources}
            populationTotal={currentCountryPopulationSummary.total}
            populationNetGrowth={currentCountryPopulationSummary.netGrowth}
            constructionProjection={myConstructionProjection}
            technologyProjection={myTechnologyProjection}
            constructionQueuePreview={constructionQueuePreview}
            infrastructureCorridors={marketTransportCorridors}
            activeInfrastructureTransportMode={corridorPlacement?.transportMode ?? null}
            cancelingConstructionQueueKey={cancelingConstructionQueueKey}
            onCancelConstructionProject={cancelConstructionQueueProject}
            onFocusConstructionHex={focusConstructionHex}
            onFocusHex={focusConstructionHex}
            onStartInfrastructurePlacement={startInfrastructurePlacement}
            onUpgradeInfrastructureCorridor={upgradeInfrastructureCorridor}
            onCancelInfrastructureCorridor={cancelInfrastructureCorridor}
            onDemolishInfrastructureCorridor={demolishInfrastructureCorridor}
            populationPreview={populationPreview}
            marketPreview={marketPreview}
            marketTradeRows={marketTradeRows}
            marketTradeLoading={marketShellLoading}
            diplomacyPreview={diplomacyPreview}
            armyPreview={armyPreview}
            unitPreview={unitPreview}
            unitTypes={unitTypeEntries}
            unitTrainingQueue={unitTrainingQueue}
            readyUnits={readyUnits}
            unitTrainingPlacementActive={Boolean(unitTrainingPlacement)}
            cancelingUnitTrainingQueueId={cancelingUnitTrainingQueueId}
            onStartUnitTrainingPlacement={(unitTypeId) => {
              setActiveStrategyMode("units");
              setStrategyWorkspaceOpen(true);
              setHexBuildPlacement(null);
              setColonizerPlacement(null);
              setUnitTrainingPlacement({ unitTypeId });
            }}
            onCancelUnitTraining={cancelUnitTrainingQueueItem}
            onDisbandUnit={disbandReadyUnit}
            governancePreview={governancePreview}
            storyPreview={storyPreview}
            onOpenTurnStatus={() => setTurnStatusOpen(true)}
            onNextTurn={() => requestNextTurn()}
            turnActions={turnActions}
            onTurnActionFocus={focusTurnAction}
            onForceNextTurn={() => requestNextTurn({ force: true })}
            onSkipTurnActionUnit={(item) => queueUnitWaitOrder(item, "UNIT_SKIP_TURN")}
            onSleepTurnActionUnit={(item) => queueUnitWaitOrder(item, "UNIT_SLEEP")}
            onLogout={logoutToAuth}
            isAdmin={auth.isAdmin}
            onAdminForceResolve={forceResolveAsAdmin}
            onOpenAdminPanel={() => setAdminOpen(true)}
            onOpenGameSettings={() => setGameSettingsOpen(true)}
            onOpenCountryCustomization={() => setCountryCustomizationOpen(true)}
            onOpenClientSettings={() => setClientSettingsOpen(true)}
            onOpenCivilopedia={() => {
              setCivilopediaIntent(null);
              setCivilopediaOpen(true);
            }}
            resourceLedgerByTurn={worldBase?.resourceLedgerByTurn}
            resourceGrowthByTurn={resourceGrowthByTurn}
            resourceExpenseByTurn={currentTurnExpenses}
            colonizationLimit={{ active: activeColonizationCount, max: maxActiveColonizations }}
            colonizerQueuePreview={colonizerQueuePreview}
            colonizerUnitPreview={colonizerUnitPreview}
            settlementProjectPreview={settlementProjectPreview}
            selectedHexDetails={selectedHexDetails}
            openHexWorkspaceRequestId={openHexWorkspaceRequestId}
            colonizerPlacementActive={Boolean(colonizerPlacement)}
            countryDetails={currentCountryDetails}
            notificationCount={uiNotificationHistory.length}
            pendingDecisionCount={pendingDecisionNotificationCount}
            activeJournalCount={activeJournalCount}
            onOpenNotifications={() => setNotificationHistoryOpen(true)}
            onOpenBudget={() => setStateBudgetOpen(true)}
            onOpenBuildingOverview={() => setBuildingOverviewOpen(true)}
            scenarioId={activeScenarioId}
            buildingEntries={buildingEntries}
            industryEntries={industryEntries}
            sectorEntries={sectorEntries}
            onOpenBuildingConstruction={startHexBuildPlacementForBuilding}
            onStartColonizerPlacement={() => {
              setActiveStrategyMode("colonization");
              setStrategyWorkspaceOpen(true);
              setColonizerPlacement({ active: true });
            }}
            onOpenPopulation={() => setPopulationStatsOpen(true)}
            onOpenMarket={() => setMarketOpen(true)}
            onOpenGlobalMarket={() => setGlobalMarketOpen(true)}
            onOpenDiplomacy={() => setDiplomacyOpen(true)}
            onOpenPolitics={() => setPoliticsOpen(true)}
            onOpenTechnology={() => setTechnologyOpen(true)}
            onOpenModifiers={() => setModifiersOpen(true)}
            onOpenDecisions={() => setDecisionsOpen(true)}
            onOpenJournal={() => setJournalOpen(true)}
            onOpenEvents={() => {
              setFocusedEventPendingId(null);
              setEventsOpen(true);
            }}
          />
          <TurnAdvancerHub
            scenarioId={activeScenarioId}
            turnId={turnId}
            turnActions={turnActions}
            unitsById={readyUnitsById}
            unitTypes={unitTypeEntries}
            onNextTurn={() => requestNextTurn()}
            onForceNextTurn={() => requestNextTurn({ force: true })}
            onFocusAction={focusTurnAction}
            onSkipUnit={(item) => queueUnitWaitOrder(item, "UNIT_SKIP_TURN")}
            onSleepUnit={(item) => queueUnitWaitOrder(item, "UNIT_SLEEP")}
            onWakeUnit={queueUnitWakeOrder}
          />
        </motion.div>
      )}

      {auth && (
        <StateBudgetModal
          open={stateBudgetOpen}
          onClose={() => setStateBudgetOpen(false)}
          worldBase={worldBase}
          turnId={turnId}
          countryId={auth.countryId}
          countryName={country?.name ?? auth.countryId}
          currentDucats={currentResources.ducats}
          projectedIncomeDucats={Math.max(0, Math.floor(resourceGrowthByTurn.ducats ?? 0))}
          ducatExpenses={ducatExpenseBreakdown}
          subsidyItems={subsidyBudgetBreakdown.items}
          ducatIconUrl={BASE_RESOURCE_ICON_URLS.ducats}
        />
      )}

      {auth && (
        <BuildingOverviewModal
          open={buildingOverviewOpen}
          onClose={() => setBuildingOverviewOpen(false)}
          token={auth.token}
          countryId={auth.countryId}
          scenarioId={activeScenarioId}
          worldBase={worldBase}
          turnId={turnId}
          ordersByTurn={ordersByTurn}
          buildings={buildingEntries}
          industries={industryEntries}
          sectors={sectorEntries}
          companies={companyEntries}
          countries={countries}
          demolitionCostConstructionPercent={demolitionCostConstructionPercent}
          canceledConstructionQueueKeys={canceledConstructionQueueKeyList}
          cancelingConstructionQueueKey={cancelingConstructionQueueKey}
          onCancelConstructionProject={cancelConstructionQueueProject}
          onFocusHex={focusConstructionHex}
        />
      )}

      {auth && (
        <PopulationStatsModal
          open={populationStatsOpen}
          onClose={() => setPopulationStatsOpen(false)}
          worldBase={worldBase}
          countryId={auth.countryId}
          countryName={country?.name ?? auth.countryId}
        />
      )}

      <AnimatePresence>
        {auth && hexBuildConfirmTarget ? (
          <Dialog
            open
            onClose={() => setHexBuildConfirmTarget(null)}
            className="relative z-[214]"
          >
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[var(--arc-modal-backdrop)]"
            />
            <div className="fixed inset-0 z-[215] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                className="arc-hex-build-confirm"
              >
                <div className="arc-hex-build-confirm__header">
                  <Dialog.Title className="arc-hex-build-confirm__title">
                    {t("buildings.hexPlacementConfirmTitle")}
                  </Dialog.Title>
                </div>
                <div className="arc-hex-build-confirm__body">
                  <div className="arc-hex-build-confirm__row">
                    <span>{t("buildings.buildingLabel")}</span>
                    <strong className="arc-hex-build-confirm__building">
                      <BuildingAtlasIcon
                        scenarioId={activeScenarioId}
                        buildingId={hexBuildConfirmTarget.building.id}
                        state="working"
                        className="arc-hex-build-confirm__building-icon"
                      />
                      <span>{hexBuildConfirmTarget.building.name}</span>
                    </strong>
                  </div>
                  <div className="arc-hex-build-confirm__row">
                    <span>{t("hexMap.hex")}</span>
                    <strong>{hexBuildConfirmTarget.hexId}</strong>
                  </div>
                  <div className="arc-hex-build-confirm__row">
                    <span>{t("buildings.owner")}</span>
                    <strong className="arc-hex-build-confirm__owner">
                      <span className="arc-hex-build-confirm__owner-current">
                        <span className="arc-hex-build-confirm__owner-flag" aria-hidden="true">
                          {getHexBuildOwnerIconUrl(hexBuildConfirmTarget.owner) ? (
                            <img src={getHexBuildOwnerIconUrl(hexBuildConfirmTarget.owner) ?? undefined} alt="" />
                          ) : (
                            getHexBuildOwnerName(hexBuildConfirmTarget.owner).slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <span>{getHexBuildOwnerName(hexBuildConfirmTarget.owner)}</span>
                      </span>
                      <select
                        className="arc-hex-build-confirm__owner-select"
                        aria-label={t("buildings.owner")}
                        value={hexBuildOwnerToSelectValue(hexBuildConfirmTarget.owner)}
                        onChange={(event) => {
                          const owner = parseHexBuildOwnerSelectValue(event.target.value);
                          if (!owner) return;
                          setHexBuildConfirmTarget((current) => current ? { ...current, owner } : current);
                        }}
                      >
                        {hexBuildOwnerOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </strong>
                  </div>
                </div>
                <div className="arc-hex-build-confirm__actions">
                  <button
                    type="button"
                    className="arc-strategy-workspace-action arc-hex-build-confirm__action arc-hex-build-confirm__action--cancel"
                    onClick={() => setHexBuildConfirmTarget(null)}
                  >
                    <span>{t("buildings.hexPlacementCancelAction")}</span>
                  </button>
                  <button
                    type="button"
                    className="arc-strategy-workspace-action arc-strategy-workspace-action--primary arc-hex-build-confirm__action"
                    onClick={() => {
                      const target = hexBuildConfirmTarget;
                      if (!target) return;
                      queueBuildOrder(
                        target.regionId,
                        { buildingId: target.building.id, owner: target.owner },
                        target.hexId,
                      );
                      setHexBuildConfirmTarget(null);
                    }}
                  >
                    <span>{t("buildings.hexPlacementConfirmAction")}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </Dialog>
        ) : null}
      </AnimatePresence>
      {auth?.token && (
        <MarketModal
          open={marketOpen}
          onClose={() => setMarketOpen(false)}
          token={auth.token}
          countryId={auth.countryId}
          countryName={country?.name ?? auth.countryId}
          mode="country"
          title={t("shell.action.market")}
        />
      )}
      {auth?.token && (
        <MarketModal
          open={globalMarketOpen}
          onClose={() => setGlobalMarketOpen(false)}
          token={auth.token}
          countryId={auth.countryId}
          countryName={country?.name ?? auth.countryId}
          mode="global"
          title={t("shell.globalMarketTitle")}
        />
      )}
      {auth?.token && (
        <PoliticsModal
          open={politicsOpen}
          onClose={() => setPoliticsOpen(false)}
          token={auth.token}
          countryId={auth.countryId}
          countryName={country?.name ?? auth.countryId}
          worldBase={worldBase}
        />
      )}
      {auth?.token && (
        <TechnologyModal
          open={technologyOpen}
          token={auth.token}
          countryId={auth.countryId}
          worldBase={worldBase}
          onClose={() => setTechnologyOpen(false)}
        />
      )}
      {auth?.token && (
        <CountryModifiersModal
          open={modifiersOpen}
          token={auth.token}
          countryId={auth.countryId}
          countryName={country?.name ?? auth.countryId}
          onClose={() => setModifiersOpen(false)}
        />
      )}
      {auth?.token && (
        <>
          <CountryDecisionsModal
            open={decisionsOpen}
            token={auth.token}
            countryId={auth.countryId}
            onClose={() => setDecisionsOpen(false)}
          />
          <CountryEventsModal
            open={eventsOpen}
            token={auth.token}
            countryId={auth.countryId}
            focusPendingId={focusedEventPendingId}
            onResolvedPendingId={(pendingId) => {
              setUiNotifications((prev) => prev.filter((item) => item.action.type !== "country-event" || item.action.pendingId !== pendingId));
              setUiNotificationHistory((prev) => prev.filter((item) => item.action.type !== "country-event" || item.action.pendingId !== pendingId));
              setFocusedEventPendingId((current) => (current === pendingId ? null : current));
            }}
            onClose={() => setEventsOpen(false)}
          />
          <CountryJournalModal
            open={journalOpen}
            countryId={auth.countryId}
            journalState={worldBase?.journalEntriesByCountryId[auth.countryId] ?? null}
            journalEntries={journalEntries}
            turnId={turnId}
            onClose={() => setJournalOpen(false)}
          />
        </>
      )}
      {auth?.token && (
        <DiplomacyModal
          open={diplomacyOpen}
          token={auth.token}
          countryId={auth.countryId}
          countryName={country?.name ?? auth.countryId}
          worldBase={worldBase}
          focusProposalId={focusedDiplomacyProposalId}
          revisionDraft={diplomacyRevisionDraft}
          onFocusedProposalHandled={() => setFocusedDiplomacyProposalId(null)}
          onRevisionDraftHandled={() => setDiplomacyRevisionDraft(null)}
          onProposalRevised={(proposalId) => {
            setUiNotifications((prev) => prev.filter((item) => item.action.type !== "diplomacy-proposal" || item.action.proposalId !== proposalId));
            setUiNotificationHistory((prev) => prev.filter((item) => item.action.type !== "diplomacy-proposal" || item.action.proposalId !== proposalId));
            setFocusedDiplomacyProposalId((current) => (current === proposalId ? null : current));
          }}
          onClose={() => setDiplomacyOpen(false)}
        />
      )}
      {auth?.token && (
        <DiplomacyProposalStoryModal
          open={diplomacyStoryOpen}
          token={auth.token}
          countryId={auth.countryId}
          proposalId={focusedDiplomacyProposalId}
          worldBase={worldBase}
          onClose={() => setDiplomacyStoryOpen(false)}
          onResolved={(proposalId) => {
            setUiNotifications((prev) => prev.filter((item) => item.action.type !== "diplomacy-proposal" || item.action.proposalId !== proposalId));
            setUiNotificationHistory((prev) => prev.filter((item) => item.action.type !== "diplomacy-proposal" || item.action.proposalId !== proposalId));
            setFocusedDiplomacyProposalId((current) => (current === proposalId ? null : current));
          }}
          onRevise={(proposal) => {
            setDiplomacyRevisionDraft(proposal);
            setFocusedDiplomacyProposalId(proposal.id);
            setDiplomacyStoryOpen(false);
            setDiplomacyOpen(true);
          }}
        />
      )}
      {auth?.isAdmin && auth?.token && (
        <AdminPanel
          open={adminOpen}
          token={auth.token}
          currentCountryId={auth.countryId}
          onClose={() => {
            setAdminOpen(false);
            setAdminInitialHexId(null);
          }}
          onSessionCountryUpdated={handleSessionCountryUpdated}
          initialHexId={adminInitialHexId}
        />
      )}

      {auth && <TurnStatusModal open={turnStatusOpen} onClose={() => setTurnStatusOpen(false)} token={auth.token} />}
      {auth && (
        <NotificationHistoryModal
          open={notificationHistoryOpen}
          items={uiNotificationHistory}
          viewedIds={viewedUiNotificationIds}
          onClose={() => setNotificationHistoryOpen(false)}
          onDeleteItem={(item) => {
            setUiNotificationHistory((prev) => prev.filter((entry) => entry.id !== item.id));
            setUiNotifications((prev) => prev.filter((entry) => entry.id !== item.id));
          }}
          onOpenItem={(item) => {
            setNotificationHistoryOpen(false);
            openUiNotification(item);
          }}
        />
      )}
      {auth && (
        <ElectionResultsModal
          open={electionResultsModal.open}
          action={electionResultsModal.action}
          onClose={() => setElectionResultsModal({ open: false, action: null })}
        />
      )}

      {auth?.isAdmin && auth?.token && (
        <GameSettingsPanel
          open={gameSettingsOpen}
          token={auth.token}
          onClose={() => setGameSettingsOpen(false)}
          onSettingsUpdated={(updated) => {
            setMaxActiveColonizations(updated.colonization.maxActiveColonizations);
            setColonizationCostPer1000Km2({
              points: updated.colonization.pointsCostPer1000Km2,
              ducats: updated.colonization.ducatsCostPer1000Km2,
            });
            setResourceGrowthByTurn((prev) => ({
              ...prev,
              culture: updated.economy.baseCulturePerTurn ?? 1,
              science: updated.economy.baseSciencePerTurn ?? 1,
              religion: updated.economy.baseReligionPerTurn ?? 1,
              colonization: updated.colonization.pointsPerTurn,
              construction: updated.economy.baseConstructionPerTurn,
              ducats: updated.economy.baseDucatsPerTurn,
              gold: updated.economy.baseGoldPerTurn,
            }));
            setEventLogRetentionTurns(updated.eventLog.retentionTurns);
            setShowAntarctica(updated.map?.showAntarctica ?? true);
            setHexRenameDucatsCost(updated.customization?.hexRenameDucats ?? 25);
            setTurnTimerUi((prev) => ({
              enabled: updated.turnTimer?.enabled ?? prev.enabled,
              secondsPerTurn: updated.turnTimer?.secondsPerTurn ?? prev.secondsPerTurn,
              startedAtMs: Date.now(),
            }));
          }}
        />
      )}

      {auth?.token && country && (
        <CountryCustomizationModal
          open={countryCustomizationOpen}
          token={auth.token}
          country={country}
          currentDucats={currentResources.ducats}
          ducatsIconUrl={BASE_RESOURCE_ICON_URLS.ducats}
          onClose={() => setCountryCustomizationOpen(false)}
          onSaved={(updated) => {
            setCountry((prev) => ({
              name: updated.name,
              color: updated.color,
              flagUrl: updated.flagUrl ?? prev?.flagUrl ?? null,
              crestUrl: updated.crestUrl ?? prev?.crestUrl ?? null,
            }));
            if (auth) {
              updateCountryResources(auth.countryId, { ducats: updated.ducats });
              if (updated.chargedDucats > 0) {
                setCustomizationDucatSpend((prev) =>
                  prev.turnId === turnId
                    ? { turnId, amount: prev.amount + updated.chargedDucats }
                    : { turnId, amount: updated.chargedDucats },
                );
              }
              addEvent({
                category: "politics",
                title: t("shell.countryCustomizedTitle"),
                message: t("shell.countryCustomizedMessage", { country: updated.name }),
                countryId: auth.countryId,
                priority: "medium",
                visibility: "private",
                turn: turnId,
              });
            }
          }}
        />
      )}

      {auth && (
        <ClientSettingsModal
          open={clientSettingsOpen}
          showMapControls={showMapControls}
          showZoomIndicator={showZoomIndicator}
          edgeScrollEnabled={edgeScrollEnabled}
          sortNotifications={sortNotifications}
          onClose={() => setClientSettingsOpen(false)}
          onSave={({
            showMapControls: nextShowMapControls,
            showZoomIndicator: nextShowZoomIndicator,
            edgeScrollEnabled: nextEdgeScrollEnabled,
            sortNotifications: nextSortNotifications,
          }) => {
            setShowMapControls(nextShowMapControls);
            setShowZoomIndicator(nextShowZoomIndicator);
            setEdgeScrollEnabled(nextEdgeScrollEnabled);
            writeMapNavigationSettings(auth.countryId, { edgeScrollEnabled: nextEdgeScrollEnabled });
            setSortNotifications(nextSortNotifications);
          }}
        />
      )}

      {auth?.isAdmin && (
        <RegistrationApprovalModal
          open={registrationApprovalModal.open}
          pending={registrationApprovalModal.pending}
          country={registrationApprovalModal.country}
          onClose={() => setRegistrationApprovalModal((prev) => (prev.pending ? prev : { open: false, country: null, notificationId: null, pending: false }))}
          onApprove={() => void resolveRegistrationApproval(true)}
          onReject={() => void resolveRegistrationApproval(false)}
        />
      )}

      <CivilopediaModal
        open={civilopediaOpen}
        onClose={() => {
          setCivilopediaOpen(false);
          setCivilopediaIntent(null);
        }}
        isAdmin={Boolean(auth?.isAdmin)}
        adminToken={auth?.token ?? null}
        initialIntent={civilopediaIntent}
        onIntentHandled={() => setCivilopediaIntent(null)}
      />

      <AnimatePresence>
        {auth && turnResolveOverlay.phase !== "idle" && (
          <Dialog
            key="turn-resolve-overlay"
            open
            onClose={() => {
              if (turnResolveOverlay.phase === "done") {
                setTurnResolveOverlay({ phase: "idle" });
              }
            }}
            className="relative z-[220]"
          >
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[var(--arc-modal-backdrop)] backdrop-blur-md"
            />
            <div className="fixed inset-0 z-[221] flex items-center justify-center p-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(18,26,38,0.18),rgba(4,8,12,0.78)_72%)]" />
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="glass panel-border relative z-10 w-[min(92vw,34rem)] rounded-xl bg-[var(--arc-color-panel)] p-6 shadow-2xl"
              >
                {turnResolveOverlay.phase === "processing" ? (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[var(--arc-color-success-border)] bg-[var(--arc-color-success-bottom)]">
                      <Loader2 className="h-8 w-8 animate-spin text-[var(--arc-color-success-text)]" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-[var(--arc-color-text)]">{t("shell.resolveProcessingTitle")}</Dialog.Title>
                      <div className="mt-1 text-sm text-[var(--arc-color-text-soft)]">{t("shell.resolveProcessingDescription")}</div>
                    </div>
                    <div className="text-xs text-[var(--arc-color-text-muted)]">{t("shell.resolveUnavailableDescription")}</div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-arc-accent/30 bg-arc-accent/10 text-2xl text-arc-accent">
                      ✓
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-[var(--arc-color-text)]">{t("shell.resolveDoneTitle")}</Dialog.Title>
                      <div className="mt-1 text-sm text-[var(--arc-color-text-soft)]">
                        {t("shell.resolveDoneDescription", { turn: turnResolveOverlay.resolvedTurnId })}
                      </div>
                    </div>
                    <div className="w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-4 py-3">
                      <div className="text-xs text-[var(--arc-color-text-muted)]">{t("shell.resolveDuration")}</div>
                      <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--arc-color-text)]">
                        {(turnResolveOverlay.durationMs / 1000).toFixed(2)} c
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTurnResolveOverlay({ phase: "idle" })}
                      className="panel-border inline-flex h-11 items-center justify-center rounded-lg bg-arc-accent px-5 text-sm font-semibold text-black transition hover:brightness-110"
                    >
                      {t("shell.resolveReturn")}
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
