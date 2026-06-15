import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@headlessui/react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { DiplomacyProposal, OrderDelta, WsOutMessage } from "@arcanorum/shared";
import { AuthPanel, type AuthSuccess } from "./components/AuthPanel";
import { MapView } from "./components/MapView";
import { TopBar } from "./components/TopBar";
import { SideNav } from "./components/SideNav";
import { CommandPalette } from "./components/CommandPalette";
import { AdminPanel } from "./components/AdminPanel";
import { TurnStatusModal } from "./components/TurnStatusModal";
import { GameSettingsPanel } from "./components/GameSettingsPanel";
import { CountryCustomizationModal } from "./components/CountryCustomizationModal";
import { EventLogPanel } from "./components/EventLogPanel";
import { ClientSettingsModal } from "./components/ClientSettingsModal";
import { CivilopediaModal } from "./components/CivilopediaModal";
import { ContentPanel } from "./components/ContentPanel";
import { PopulationStatsModal } from "./components/PopulationStatsModal";
import { ProvinceBuildingsModal } from "./components/ProvinceBuildingsModal";
import { StateBudgetModal } from "./components/StateBudgetModal";
import { MarketModal } from "./components/MarketModal";
import { PoliticsModal } from "./components/PoliticsModal";
import { TechnologyModal } from "./components/TechnologyModal";
import { CountryModifiersModal } from "./components/CountryModifiersModal";
import { CountryDecisionsModal } from "./components/CountryDecisionsModal";
import { CountryEventsModal } from "./components/CountryEventsModal";
import { DiplomacyModal } from "./components/DiplomacyModal";
import { DiplomacyProposalStoryModal } from "./components/DiplomacyProposalStoryModal";
import { ArmyModal } from "./components/ArmyModal";
import { InAppNotificationTray, type InAppUiNotification } from "./components/InAppNotificationTray";
import { NotificationHistoryModal } from "./components/NotificationHistoryModal";
import { RegistrationApprovalModal } from "./components/RegistrationApprovalModal";
import { ElectionResultsModal } from "./components/ElectionResultsModal";
import {
  adminReviewRegistration,
  apiBase,
  fetchContentEntries,
  fetchCountries,
  fetchCountryEvents,
  fetchCurrentTurnOrders,
  fetchPendingUiNotifications,
  fetchProvinceIndex,
  fetchPublicGameUiSettings,
  fetchWorldSnapshot,
  markUiNotificationViewed,
  acceptDiplomacyProposal,
  rejectDiplomacyProposal,
  type ContentEntry,
  type ResourceIconsMap,
} from "./lib/api";
import { useWs } from "./lib/useWs";
import { useGameStore } from "./store/gameStore";

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

const RESOLVE_START_TIMEOUT_MS = 12_000;

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

export default function App() {
  const worldResyncInFlightRef = useRef(false);
  const replayRequestInFlightRef = useRef(false);
  const resolveStartTimeoutRef = useRef<number | null>(null);
  const [entryLoadingGate, setEntryLoadingGate] = useState<"hidden" | "loading" | "ready">("hidden");
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
  const [cmdOpen, setCmdOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [contentPanelOpen, setContentPanelOpen] = useState(false);
  const [populationStatsOpen, setPopulationStatsOpen] = useState(false);
  const [provinceBuildingsOpen, setProvinceBuildingsOpen] = useState(false);
  const [provinceBuildingsInitialProvinceId, setProvinceBuildingsInitialProvinceId] = useState<string | null>(null);
  const [provinceBuildingsConstructionRequestId, setProvinceBuildingsConstructionRequestId] = useState(0);
  const [stateBudgetOpen, setStateBudgetOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [globalMarketOpen, setGlobalMarketOpen] = useState(false);
  const [politicsOpen, setPoliticsOpen] = useState(false);
  const [technologyOpen, setTechnologyOpen] = useState(false);
  const [modifiersOpen, setModifiersOpen] = useState(false);
  const [decisionsOpen, setDecisionsOpen] = useState(false);
  const [focusedDiplomacyProposalId, setFocusedDiplomacyProposalId] = useState<string | null>(null);
  const [diplomacyStoryOpen, setDiplomacyStoryOpen] = useState(false);
  const [diplomacyRevisionDraft, setDiplomacyRevisionDraft] = useState<DiplomacyProposal | null>(null);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [focusedEventPendingId, setFocusedEventPendingId] = useState<string | null>(null);
  const [diplomacyOpen, setDiplomacyOpen] = useState(false);
  const [armyOpen, setArmyOpen] = useState(false);
  const [adminInitialProvinceId, setAdminInitialProvinceId] = useState<string | null>(null);
  const [turnStatusOpen, setTurnStatusOpen] = useState(false);
  const [gameSettingsOpen, setGameSettingsOpen] = useState(false);
  const [countryCustomizationOpen, setCountryCustomizationOpen] = useState(false);
  const [clientSettingsOpen, setClientSettingsOpen] = useState(false);
  const [civilopediaOpen, setCivilopediaOpen] = useState(false);
  const [civilopediaIntent, setCivilopediaIntent] = useState<
    | { type: "open-entry"; entryId: string }
    | { type: "province"; provinceId: string; provinceName: string; createIfMissing: boolean }
    | null
  >(null);
  const [resourceIcons, setResourceIcons] = useState<ResourceIconsMap>({
    population: null,
    culture: null,
    science: null,
    religion: null,
    colonization: null,
    construction: null,
    ducats: null,
    gold: null,
  });
  const [uiBackgroundImageUrl, setUiBackgroundImageUrl] = useState<string | null>(null);
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
  const [provinceRenameDucatSpend, setProvinceRenameDucatSpend] = useState<{ turnId: number; amount: number }>({
    turnId: 0,
    amount: 0,
  });
  const [maxActiveColonizations, setMaxActiveColonizations] = useState(3);
  const [colonizationCostPer1000Km2, setColonizationCostPer1000Km2] = useState({ points: 5, ducats: 5 });
  const [provinceRenameDucatsCost, setProvinceRenameDucatsCost] = useState(25);
  const [provinceAreaKm2ById, setProvinceAreaKm2ById] = useState<Record<string, number>>({});
  const [showAntarctica, setShowAntarctica] = useState(false);
  const [showMapControls, setShowMapControls] = useState(false);
  const [sortNotifications, setSortNotifications] = useState(true);
  const [provinceIndexLoaded, setProvinceIndexLoaded] = useState(false);
  const [publicUiLoaded, setPublicUiLoaded] = useState(false);
  const [technologyEntries, setTechnologyEntries] = useState<ContentEntry[]>([]);
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
  const selectedProvinceId = useGameStore((s) => s.selectedProvinceId);
  const setAuth = useGameStore((s) => s.setAuth);
  const setWorldBase = useGameStore((s) => s.setWorldBase);
  const applyWorldDelta = useGameStore((s) => s.applyWorldDelta);
  const addOrder = useGameStore((s) => s.addOrder);
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
  const trimOldLogEntries = useGameStore((s) => s.trimOldLogEntries);
  const clearEventLog = useGameStore((s) => s.clearEventLog);
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
            ? "Авто-резолв не подтвержден сервером"
            : "Резолв не подтвержден сервером",
          {
            description:
              source === "auto"
                ? "TURN_RESOLVE_STARTED не пришел вовремя. Действия остаются доступны."
                : "TURN_RESOLVE_STARTED не пришел вовремя.",
          },
        );
      }, RESOLVE_START_TIMEOUT_MS);
    },
    [clearResolveStartTimeout],
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
      toast.warning("Состояние мира синхронизировано заново");
    } catch {
      toast.error("Не удалось синхронизировать мир, выполняется перезагрузка");
      window.location.reload();
    } finally {
      worldResyncInFlightRef.current = false;
    }
  }, [hydrateCurrentTurnOrders, resetOverlay, setWorldBase]);

  const onWsMessage = useCallback(
    (msg: WsOutMessage) => {
      if (msg.type === "AUTH_OK") {
        clearResolveStartTimeout();
        setTurnResolveOverlay({ phase: "idle" });
        if (msg.worldBase) {
          setWorldBase(msg.worldBase, msg.turnId, msg.worldStateVersion);
          setPendingDeltaAckVersion(msg.worldStateVersion);
        } else if (!useGameStore.getState().worldBase) {
          toast.warning("Локальный state отсутствует, выполняется snapshot-ресинк");
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
        addEvent({ category: "system", title: "Подключение", message: "Соединение с игровым сервером установлено", priority: "low", visibility: "private", countryId: msg.countryId, turn: msg.turnId });
      }

      if (msg.type === "SCENARIO_APPLIED") {
        toast.success("Сценарий применён", { description: "Перезагружаем карту и состояние мира" });
        window.setTimeout(() => window.location.reload(), 500);
      }

      if (msg.type === "ORDER_BROADCAST") {
        addOrder(msg.order);
        const targetId =
          msg.order.type === "ARMY_MOVE"
            ? msg.order.provinceId
            : msg.order.type === "BUILD" || msg.order.type === "COLONIZE"
              ? msg.order.regionId
              : "";
        addEvent({
          category: msg.order.type === "COLONIZE" ? "colonization" : "military",
          title: msg.order.type === "COLONIZE" ? "Новый приказ колонизации" : "Новый приказ",
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
            toast.warning("Обнаружен рассинхрон версии, запрошен replay дельт");
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
          toast.warning(`Отклонено приказов: ${msg.rejectedOrders.length}`);
          addEvent({
            category: "system",
            title: `Ход #${msg.turnId} завершен`,
            message: `Отклонено приказов: ${msg.rejectedOrders.length}`,
            priority: "medium",
            visibility: "public",
            turn: msg.turnId,
          });
        } else {
          toast.success("Ход успешно зарезолвен");
          addEvent({
            category: "system",
            title: `Ход #${msg.turnId} завершен`,
            message: "Резолв завершен без отклонений приказов",
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
          toast.warning("Replay недоступен, выполняется snapshot-ресинк");
          void resyncWorldState();
          return;
        }
        toast.error(msg.message);
        addEvent({ category: "system", title: "Ошибка", message: msg.message, priority: "high", visibility: "private" });
      }
    },
    [addEvent, addOrder, applyWorldDelta, clearResolveStartTimeout, hydrateCurrentTurnOrders, pruneLogEntries, resetOverlay, resyncWorldState, setEventLogRetentionTurns, setPresence, setWorldBase],
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
    let cancelled = false;
    fetchProvinceIndex()
      .then((items) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        for (const item of items) next[item.id] = item.areaKm2;
        setProvinceAreaKm2ById(next);
        setProvinceIndexLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setProvinceAreaKm2ById({});
          setProvinceIndexLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPublicGameUiSettings()
      .then((ui) => {
        if (!cancelled) {
          setResourceIcons(ui.resourceIcons);
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
          setShowAntarctica(ui.map?.showAntarctica ?? true);
          setUiBackgroundImageUrl(ui.map?.backgroundImageUrl ?? null);
          setProvinceRenameDucatsCost(ui.customization?.provinceRenameDucats ?? 25);
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
    if (!auth?.countryId) return;
    if (country?.name && country.name.trim().length > 0) return;

    let cancelled = false;
    fetchCountries()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((c) => c.id === auth.countryId);
        if (!found) return;
        setCountry({
          name: found.name,
          color: found.color,
          flagUrl: found.flagUrl ?? null,
          crestUrl: found.crestUrl ?? null,
        });
      })
      .catch(() => {
        // keep fallback label
      });

    return () => {
      cancelled = true;
    };
  }, [auth?.countryId, country?.name]);

  const onAuthSuccess = (payload: AuthSuccess) => {
    setEntryLoadingGate("loading");
    setAuth({ token: payload.token, playerId: payload.playerId, countryId: payload.countryId, isAdmin: payload.isAdmin });
    setCountry({ name: payload.countryName, color: payload.countryColor, flagUrl: payload.flagUrl, crestUrl: payload.crestUrl });
    if (payload.clientSettings?.eventLogRetentionTurns) {
      setEventLogRetentionTurns(payload.clientSettings.eventLogRetentionTurns);
    }
    addEvent({ category: "system", title: "Вход", message: `Вы вошли в страну ${payload.countryName}`, priority: "medium", visibility: "private", countryId: payload.countryId, turn: payload.turnId });
  };

  const currentResources = useMemo(() => {
    if (!worldBase || !auth) {
      return { culture: 0, science: 0, religion: 0, colonization: 0, construction: 0, ducats: 0, gold: 0 };
    }
    return worldBase.resourcesByCountry[auth.countryId] ?? { culture: 0, science: 0, religion: 0, colonization: 0, construction: 0, ducats: 0, gold: 0 };
  }, [auth, worldBase]);
  const currentCountryDetails = useMemo(() => {
    if (!auth || !worldBase) {
      return { provinceCount: 0, totalAreaKm2: 0 };
    }
    let provinceCount = 0;
    let totalAreaKm2 = 0;
    for (const [provinceId, ownerCountryId] of Object.entries(worldBase.provinceOwner ?? {})) {
      if (ownerCountryId !== auth.countryId) continue;
      provinceCount += 1;
      totalAreaKm2 += Math.max(0, Number(provinceAreaKm2ById[provinceId] ?? 0));
    }
    return { provinceCount, totalAreaKm2: Math.round(totalAreaKm2) };
  }, [auth, provinceAreaKm2ById, worldBase]);

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

    const targetIds = new Set<string>();
    for (const [regionId, byCountry] of Object.entries(worldBase.colonyProgressByRegion ?? {})) {
      if (worldBase.regionOwner[regionId]) continue;
      if (worldBase.regionColonizationByRegion?.[regionId]?.disabled) continue;
      if (byCountry[auth.countryId] != null) {
        targetIds.add(regionId);
      }
    }

    const myOrders = ordersByTurn.get(turnId)?.get(auth.playerId) ?? [];
    for (const order of myOrders) {
      if (order.type !== "COLONIZE") continue;
      if (worldBase.regionOwner[order.regionId]) continue;
      if (worldBase.regionColonizationByRegion?.[order.regionId]?.disabled) continue;
      targetIds.add(order.regionId);
    }

    const activeCount = targetIds.size;
    if (activeCount === 0) {
      return { activeCount, predictedPointsSpend: 0, predictedSupportDucatSpend: 0 };
    }

    const availablePoints = Math.max(0, Math.floor(currentResources.colonization ?? 0));
    if (availablePoints <= 0) {
      return { activeCount, predictedPointsSpend: 0, predictedSupportDucatSpend: 0 };
    }

    const gainPerRegion = availablePoints / activeCount;
    let predictedPointsSpend = 0;
    let predictedSupportDucatSpend = 0;
    let remainingSupportDucats = Math.max(0, Number(currentResources.ducats ?? 0));

    for (const regionId of targetIds) {
      const regionCfg = worldBase.regionColonizationByRegion?.[regionId];
      const areaKm2 = Math.max(1, Number(provinceAreaKm2ById[regionId] ?? 1000));
      const areaFactor = Math.max(0.001, areaKm2 / 1000);
      const derivedPointsCost = Math.max(1, Math.round(colonizationCostPer1000Km2.points * areaFactor));
      const derivedDucatsCost = Math.max(0, Math.round(colonizationCostPer1000Km2.ducats * areaFactor));
      const regionCost = Math.max(1, Math.floor(regionCfg?.cost ?? derivedPointsCost));
      const currentProgress = Math.max(
        0,
        Number(worldBase.colonyProgressByRegion?.[regionId]?.[auth.countryId] ?? 0),
      );
      const remainingPoints = Math.max(0, regionCost - currentProgress);
      const ducatRatio = regionCost > 0 ? derivedDucatsCost / regionCost : 0;
      const spentDucatsForCurrentProgress = currentProgress * ducatRatio;
      const remainingRegionDucats = Math.max(0, derivedDucatsCost - spentDucatsForCurrentProgress);
      const maxGainByCountryDucats = ducatRatio > 0 ? remainingSupportDucats / ducatRatio : Number.POSITIVE_INFINITY;
      const maxGainByRegionDucats = ducatRatio > 0 ? remainingRegionDucats / ducatRatio : Number.POSITIVE_INFINITY;
      const appliedPoints = Math.min(gainPerRegion, remainingPoints, maxGainByCountryDucats, maxGainByRegionDucats);
      if (appliedPoints <= 0) continue;
      const appliedDucats = ducatRatio > 0 ? Math.min(remainingSupportDucats, remainingRegionDucats, appliedPoints * ducatRatio) : 0;
      predictedPointsSpend += appliedPoints;
      predictedSupportDucatSpend += appliedDucats;
      remainingSupportDucats = Math.max(0, remainingSupportDucats - appliedDucats);
    }

    return {
      activeCount,
      predictedPointsSpend: Math.max(0, Math.floor(predictedPointsSpend)),
      predictedSupportDucatSpend: Math.max(0, Math.floor(predictedSupportDucatSpend)),
    };
  }, [auth, colonizationCostPer1000Km2.ducats, colonizationCostPer1000Km2.points, currentResources.colonization, currentResources.ducats, ordersByTurn, provinceAreaKm2ById, turnId, worldBase]);
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
    const provinceRename = provinceRenameDucatSpend.turnId === turnId ? Math.max(0, Math.floor(provinceRenameDucatSpend.amount)) : 0;
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
      provinceRename,
      colonizationSupport,
      construction,
      subsidies,
      total: customization + provinceRename + colonizationSupport + construction + subsidies,
    };
  }, [
    currentResources.ducats,
    customizationDucatSpend.amount,
    customizationDucatSpend.turnId,
    myColonizationProjection.predictedPointsSpend,
    myColonizationProjection.predictedSupportDucatSpend,
    myConstructionProjection.predictedDucatSpend,
    myConstructionProjection.predictedPointsSpend,
    provinceRenameDucatSpend.amount,
    provinceRenameDucatSpend.turnId,
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
    totals.ducats += ducatExpenseBreakdown.provinceRename;

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
    ducatExpenseBreakdown.provinceRename,
    ducatExpenseBreakdown.subsidies,
    myColonizationProjection.predictedPointsSpend,
    myConstructionProjection.predictedPointsSpend,
    myTechnologyProjection.predictedPointsSpend,
  ]);
  useEffect(() => {
    setCustomizationDucatSpend((prev) => (prev.turnId === turnId ? prev : { turnId, amount: 0 }));
    setProvinceRenameDucatSpend((prev) => (prev.turnId === turnId ? prev : { turnId, amount: 0 }));
  }, [turnId]);

  const logoutToAuth = () => {
    addEvent({ category: "system", title: "Выход", message: "Сессия игрока завершена", priority: "low", visibility: "private", countryId: auth?.countryId ?? null });
    clearResolveStartTimeout();
    setTurnResolveOverlay({ phase: "idle" });
    setAuth(null);
    setCountry(null);
    setEntryLoadingGate("hidden");
    toast("Вы вышли из страны");
  };

  const forceResolveAsAdmin = () => {
    if (!auth?.isAdmin) {
      toast.error("Только для администраторов");
      return;
    }

    setTurnResolveOverlay({ phase: "processing", startedAtMs: Date.now() });
    send({ type: "ADMIN_FORCE_RESOLVE" });
    toast("Админ-команда отправлена", { description: "Принудительный резолв хода" });
    addEvent({ category: "system", title: "Админ-команда", message: "Отправлен принудительный резолв хода", priority: "high", visibility: "private", countryId: auth.countryId });
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


  const queueColonizeOrder = (regionId?: string) => {
    if (!auth) {
      return;
    }

    const delta: OrderDelta = {
      type: "ORDER_DELTA",
      order: {
        turnId,
        playerId: auth.playerId,
        countryId: auth.countryId,
        regionId: regionId ?? selectedProvinceId ?? "ARG-1309",
        type: "COLONIZE",
        payload: {},
      },
    };

    send(delta);
    toast("Приказ отправлен", { description: `COLONIZE -> ${regionId ?? selectedProvinceId ?? "ARG-1309"}` });
    addEvent({
      category: "colonization",
      title: "Отправлен приказ",
      message: `COLONIZE -> ${regionId ?? selectedProvinceId ?? "ARG-1309"}`,
      countryId: auth.countryId,
      priority: "medium",
      visibility: "private",
      turn: turnId,
    });
  };

  const queueBuildOrder = (regionId?: string, payload?: Record<string, unknown>) => {
    if (!auth) {
      return;
    }

    const targetRegionId = regionId ?? selectedProvinceId ?? "ARG-1309";
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
        type: "BUILD",
        payload: normalizedPayload,
      },
    };

    send(delta);
    toast("Приказ отправлен", {
      description: payloadBuildingId
        ? `BUILD -> ${targetRegionId} (${payloadBuildingId})`
        : `BUILD -> ${targetRegionId}`,
    });
    addEvent({
      category: "economy",
      title: "Отправлен приказ",
      message: payloadBuildingId ? `BUILD -> ${targetRegionId} (${payloadBuildingId})` : `BUILD -> ${targetRegionId}`,
      countryId: auth.countryId,
      priority: "medium",
      visibility: "private",
      turn: turnId,
    });
  };

  const queueArmyMoveOrder = (divisionId: string, provinceId: string, path?: string[]) => {
    if (!auth || !divisionId || !provinceId) {
      return;
    }
    const routePath = Array.isArray(path) ? path.filter((value) => typeof value === "string" && value.trim().length > 0) : [];

    const delta: OrderDelta = {
      type: "ORDER_DELTA",
      order: {
        turnId,
        playerId: auth.playerId,
        countryId: auth.countryId,
        provinceId,
        type: "ARMY_MOVE",
        payload: routePath.length > 0 ? { divisionId, path: routePath } : { divisionId },
      },
    };

    send(delta);
    toast("Приказ отправлен", { description: routePath.length > 1 ? `ARMY_MOVE: ${routePath.length} шагов` : `ARMY_MOVE -> ${provinceId}` });
    addEvent({
      category: "military",
      title: "Отправлен приказ",
      message: `Передислокация дивизии ${divisionId} в ${provinceId}`,
      countryId: auth.countryId,
      priority: "medium",
      visibility: "private",
      turn: turnId,
    });
  };

  const openProvinceBuildingsForProvince = (provinceId: string) => {
    setProvinceBuildingsInitialProvinceId(provinceId);
    setProvinceBuildingsConstructionRequestId((value) => value + 1);
    setProvinceBuildingsOpen(true);
  };

  useEffect(() => {
    pruneLogEntries(turnId);
  }, [eventLogRetentionTurns, pruneLogEntries, turnId]);

  useEffect(() => {
    clearResolveStartTimeout();
  }, [turnId, clearResolveStartTimeout]);

  useEffect(() => {
    if (!auth) {
      setEntryLoadingGate("hidden");
      return;
    }
    const ready = Boolean(worldBase) && Boolean(country) && provinceIndexLoaded && publicUiLoaded;
    setEntryLoadingGate((prev) => {
      if (prev === "hidden") return prev;
      if (prev === "loading" && ready) return "ready";
      return prev;
    });
  }, [auth, country, provinceIndexLoaded, publicUiLoaded, worldBase]);

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

  const requestNextTurn = () => {
    if (turnResolveOverlay.phase === "processing") return;
    send({ type: "REQUEST_RESOLVE" });
    armResolveStartTimeout("manual");
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
              toast.info("Событие решено автоматически", {
                description: `Из-за отсутствия решения главы государства правительство выбрало: ${autoResolved.optionLabel}.`,
              });
            } else {
              toast.info("Событие уже обработано");
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
        toast.success("Договор подписан");
      } else if (actionId === "reject") {
        await rejectDiplomacyProposal(auth.token, item.action.proposalId);
        toast.success("Договор отклонён");
      } else {
        openUiNotification(item);
        return;
      }
      setUiNotifications((prev) => prev.filter((n) => n.id !== item.id));
      setUiNotificationHistory((prev) => prev.filter((n) => n.id !== item.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(message === "NOT_YOUR_TURN" ? "Сейчас не ваша очередь отвечать на договор" : "Не удалось выполнить действие");
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
      toast.success(approve ? "Регистрация подтверждена" : "Регистрация отклонена");
      if (result.country) {
        addEvent({
          category: "politics",
          title: approve ? "Регистрация подтверждена" : "Регистрация отклонена",
          message: `${result.country.name}`,
          visibility: "private",
          countryId: auth.countryId,
        });
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "REGISTRATION_REVIEW_FAILED";
      if (code === "REGISTRATION_ALREADY_REVIEWED") {
        toast.error("Заявка уже обработана");
        setUiNotifications((prev) => prev.filter((n) => n.id !== registrationApprovalModal.notificationId));
        setRegistrationApprovalModal({ open: false, country: null, notificationId: null, pending: false });
      } else {
        toast.error("Не удалось обработать заявку");
        setRegistrationApprovalModal((prev) => ({ ...prev, pending: false }));
      }
    }
  };

  return (
    <div className="relative h-screen overflow-hidden bg-arc-bg text-white">
      <MapView
        apiBase={apiBase}
        onQueueBuildOrder={openProvinceBuildingsForProvince}
        onQueueColonizeOrder={queueColonizeOrder}
        onQueueArmyMoveOrder={queueArmyMoveOrder}
        colonizationIconUrl={resourceIcons.colonization}
        ducatsIconUrl={resourceIcons.ducats}
        maxActiveColonizations={maxActiveColonizations}
        colonizationCostPer1000Km2={colonizationCostPer1000Km2}
        provinceRenameDucatsCost={provinceRenameDucatsCost}
        showMapControls={showMapControls}
        showAntarctica={showAntarctica}
        onOpenAdminProvinceEditor={(provinceId) => {
          setAdminInitialProvinceId(provinceId);
          setAdminOpen(true);
        }}
        onOpenProvinceKnowledge={(provinceId, provinceName) => {
          setCivilopediaIntent({
            type: "province",
            provinceId,
            provinceName,
            createIfMissing: false,
          });
          setCivilopediaOpen(true);
        }}
        onCreateProvinceKnowledge={(provinceId, provinceName) => {
          setCivilopediaIntent({
            type: "province",
            provinceId,
            provinceName,
            createIfMissing: true,
          });
          setCivilopediaOpen(true);
        }}
        onProvinceRenameCharged={(chargedDucats) => {
          if (chargedDucats <= 0) return;
          setProvinceRenameDucatSpend((prev) =>
            prev.turnId === turnId ? { turnId, amount: prev.amount + chargedDucats } : { turnId, amount: chargedDucats },
          );
        }}
      />

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
            {uiBackgroundImageUrl ? (
              <div
                className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-35"
                style={{ backgroundImage: `url("${uiBackgroundImageUrl}")` }}
                aria-hidden="true"
              />
            ) : null}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(5,8,13,0.15),rgba(5,8,13,0.78)_72%)]" />
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

      {auth && (
        <InAppNotificationTray
          items={uiNotifications}
          viewedIds={viewedUiNotificationIds}
          topOffsetPx={80}
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
            className="absolute inset-0 z-[145] flex items-center justify-center bg-black/60 backdrop-blur-md"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(18,26,38,0.16),rgba(4,8,12,0.82)_72%)]" />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="glass panel-border relative z-10 w-[min(92vw,34rem)] rounded-2xl bg-[#0b111b] p-6 shadow-2xl"
            >
              {entryLoadingGate === "loading" ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-arc-accent/30 bg-arc-accent/10">
                    <Loader2 className="h-8 w-8 animate-spin text-arc-accent" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">Загрузка данных игры</div>
                    <div className="mt-1 text-sm text-white/60">
                      Подготавливаем карту, настройки и состояние вашей страны
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-1 gap-2 text-left text-xs text-white/70 sm:grid-cols-2">
                    <div className={`rounded-lg border px-3 py-2 ${worldBase ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5"}`}>
                      Состояние мира {worldBase ? "готово" : "загрузка"}
                    </div>
                    <div className={`rounded-lg border px-3 py-2 ${provinceIndexLoaded ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5"}`}>
                      Провинции {provinceIndexLoaded ? "готово" : "загрузка"}
                    </div>
                    <div className={`rounded-lg border px-3 py-2 ${publicUiLoaded ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5"}`}>
                      UI-настройки {publicUiLoaded ? "готово" : "загрузка"}
                    </div>
                    <div className={`rounded-lg border px-3 py-2 ${country ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5"}`}>
                      Профиль страны {country ? "готово" : "загрузка"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-2xl text-emerald-300">
                    ✓
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">Данные загружены</div>
                    <div className="mt-1 text-sm text-white/60">Можно входить в игру</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEntryLoadingGate("hidden")}
                    className="panel-border inline-flex h-11 items-center justify-center rounded-xl bg-arc-accent px-5 text-sm font-semibold text-black transition hover:brightness-110"
                  >
                    Войти в игру
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {auth && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-none absolute inset-0 z-[111]">
          <TopBar
            countryName={country?.name ?? "Безымянная держава"}
            flagUrl={country?.flagUrl}
            crestUrl={country?.crestUrl}
            turnId={turnId}
            resources={currentResources}
            populationTotal={currentCountryPopulationSummary.total}
            populationBirths={currentCountryPopulationSummary.births}
            populationDeaths={currentCountryPopulationSummary.deaths}
            populationNetGrowth={currentCountryPopulationSummary.netGrowth}
            populationIconUrl={resourceIcons.population}
            onOpenTurnStatus={() => setTurnStatusOpen(true)}
            onNextTurn={requestNextTurn}
            onLogout={logoutToAuth}
            isAdmin={auth.isAdmin}
            onAdminForceResolve={forceResolveAsAdmin}
            onOpenAdminPanel={() => setAdminOpen(true)}
            onOpenContentPanel={() => setContentPanelOpen(true)}
            onOpenGameSettings={() => setGameSettingsOpen(true)}
            onOpenCountryCustomization={() => setCountryCustomizationOpen(true)}
            onOpenClientSettings={() => setClientSettingsOpen(true)}
            onOpenCivilopedia={() => {
              setCivilopediaIntent(null);
              setCivilopediaOpen(true);
            }}
            resourceIconUrls={resourceIcons}
            resourceGrowthByTurn={resourceGrowthByTurn}
            resourceExpenseByTurn={currentTurnExpenses}
            colonizationLimit={{ active: activeColonizationCount, max: maxActiveColonizations }}
            countryDetails={currentCountryDetails}
            turnTimer={turnTimerUi}
          />
          <SideNav
            onItemClick={(key) => {
              if (key === "budget") {
                setStateBudgetOpen(true);
              }
              if (key === "buildings") {
                setProvinceBuildingsInitialProvinceId(null);
                setProvinceBuildingsOpen(true);
              }
              if (key === "population") {
                setPopulationStatsOpen(true);
              }
              if (key === "market") {
                setMarketOpen(true);
              }
              if (key === "globalMarket") {
                setGlobalMarketOpen(true);
              }
              if (key === "politics") {
                setPoliticsOpen(true);
              }
              if (key === "technology") {
                setTechnologyOpen(true);
              }
              if (key === "modifiers") {
                setModifiersOpen(true);
              }
              if (key === "decisions") {
                setDecisionsOpen(true);
              }
              if (key === "events") {
                setFocusedEventPendingId(null);
                setEventsOpen(true);
              }
              if (key === "diplomacy") {
                setDiplomacyOpen(true);
              }
              if (key === "army") {
                setArmyOpen(true);
              }
            }}
          />
          <EventLogPanel
            entries={eventLog}
            currentCountryId={auth.countryId}
            onTrimOld={() => trimOldLogEntries(50)}
            onClear={clearEventLog}
          />
        </motion.div>
      )}

      {auth?.isAdmin && auth?.token && (
        <ContentPanel
          open={contentPanelOpen}
          token={auth.token}
          onClose={() => setContentPanelOpen(false)}
        />
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
          ducatIconUrl={resourceIcons.ducats}
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

      {auth && (
        <ProvinceBuildingsModal
          open={provinceBuildingsOpen}
          onClose={() => setProvinceBuildingsOpen(false)}
          worldBase={worldBase}
          countryId={auth.countryId}
          countryName={country?.name ?? auth.countryId}
          initialRegionId={provinceBuildingsInitialProvinceId}
          constructionRequestId={provinceBuildingsConstructionRequestId}
          onQueueBuildOrder={queueBuildOrder}
        />
      )}
      {auth?.token && (
        <MarketModal
          open={marketOpen}
          onClose={() => setMarketOpen(false)}
          token={auth.token}
          countryId={auth.countryId}
          countryName={country?.name ?? auth.countryId}
          mode="country"
          title="Рынок"
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
          title="Глобальный рынок"
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
      {auth?.token && (
        <ArmyModal
          open={armyOpen}
          token={auth.token}
          onClose={() => setArmyOpen(false)}
          onQueueArmyMove={queueArmyMoveOrder}
        />
      )}

      {auth?.isAdmin && auth?.token && (
        <AdminPanel
          open={adminOpen}
          token={auth.token}
          currentCountryId={auth.countryId}
          onClose={() => {
            setAdminOpen(false);
            setAdminInitialProvinceId(null);
          }}
          onSessionCountryUpdated={handleSessionCountryUpdated}
          initialProvinceId={adminInitialProvinceId}
        />
      )}

      {auth && <TurnStatusModal open={turnStatusOpen} onClose={() => setTurnStatusOpen(false)} />}
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
          onResourceIconsUpdated={setResourceIcons}
          onSettingsUpdated={(updated) => {
            setMaxActiveColonizations(updated.colonization.maxActiveColonizations);
            setColonizationCostPer1000Km2({
              points: updated.colonization.pointsCostPer1000Km2,
              ducats: updated.colonization.ducatsCostPer1000Km2,
            });
            setUiBackgroundImageUrl(updated.map?.backgroundImageUrl ?? null);
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
            setProvinceRenameDucatsCost(updated.customization?.provinceRenameDucats ?? 25);
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
          ducatsIconUrl={resourceIcons.ducats}
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
                title: "Изменение страны",
                message: `Кастомизация применена для ${updated.name} (-дукаты)`,
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
          sortNotifications={sortNotifications}
          onClose={() => setClientSettingsOpen(false)}
          onSave={({ showMapControls: nextShowMapControls, sortNotifications: nextSortNotifications }) => {
            setShowMapControls(nextShowMapControls);
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
              className="fixed inset-0 bg-black/55 backdrop-blur-md"
            />
            <div className="fixed inset-0 z-[221] flex items-center justify-center p-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(18,26,38,0.18),rgba(4,8,12,0.78)_72%)]" />
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="glass panel-border relative z-10 w-[min(92vw,34rem)] rounded-2xl bg-[#0b111b] p-6 shadow-2xl"
              >
                {turnResolveOverlay.phase === "processing" ? (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10">
                      <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-white">Идет обработка хода</Dialog.Title>
                      <div className="mt-1 text-sm text-white/60">Подождите, сервер выполняет резолв приказов</div>
                    </div>
                    <div className="text-xs text-white/45">Во время обработки действия временно недоступны</div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-arc-accent/30 bg-arc-accent/10 text-2xl text-arc-accent">
                      ✓
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-white">Обработка хода завершена</Dialog.Title>
                      <div className="mt-1 text-sm text-white/65">
                        Ход #{turnResolveOverlay.resolvedTurnId} успешно обработан
                      </div>
                    </div>
                    <div className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="text-xs text-white/55">Общее время обработки</div>
                      <div className="mt-1 text-xl font-semibold tabular-nums text-white">
                        {(turnResolveOverlay.durationMs / 1000).toFixed(2)} c
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTurnResolveOverlay({ phase: "idle" })}
                      className="panel-border inline-flex h-11 items-center justify-center rounded-xl bg-arc-accent px-5 text-sm font-semibold text-black transition hover:brightness-110"
                    >
                      Вернуться к игре
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
