import { useEffect, useState } from "react";
import { Coins, Flag, Image as ImageIcon, Map, Palette, RefreshCcw, Save, ScrollText, Timer, Wallet, Monitor } from "lucide-react";
import { toast } from "sonner";
import { adminRecalculateAutoRegionCosts, adminUploadResourceIcons, adminUploadUiBackground, applyAdminScenario, fetchAdminScenarios, fetchGameSettings, type GameSettings, type ResourceIconsMap, type ScenarioDescriptor, updateGameSettings } from "../lib/api";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppSection } from "./ui/AppSurface";

type Props = {
  open: boolean;
  token: string;
  onClose: () => void;
  onResourceIconsUpdated?: (icons: ResourceIconsMap) => void;
  onSettingsUpdated?: (settings: GameSettings) => void;
};

const categories = [
  { id: "scenarios", label: "Сценарии", icon: Map },
  { id: "economy", label: "Экономика", icon: Wallet },
  { id: "turnTimer", label: "Таймер хода", icon: Timer },
  { id: "colonization", label: "Колонизация", icon: Flag },
  { id: "registration", label: "Регистрация", icon: Flag },
  { id: "customization", label: "Кастомизация", icon: Palette },
  { id: "eventLog", label: "Журнал событий", icon: ScrollText },
  { id: "background", label: "Фон интерфейса", icon: Monitor },
  { id: "resourceIcons", label: "Иконки очков", icon: ImageIcon },
] as const;

async function isImageWithinMaxSize(file: File, maxSize = 64): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ok = img.width <= maxSize && img.height <= maxSize;
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}

export function GameSettingsPanel({ open, token, onClose, onResourceIconsUpdated, onSettingsUpdated }: Props) {
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]["id"]>("economy");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [baseCulturePerTurn, setBaseCulturePerTurn] = useState(1);
  const [baseSciencePerTurn, setBaseSciencePerTurn] = useState(1);
  const [baseReligionPerTurn, setBaseReligionPerTurn] = useState(1);
  const [baseConstructionPerTurn, setBaseConstructionPerTurn] = useState(5);
  const [baseDucatsPerTurn, setBaseDucatsPerTurn] = useState(5);
  const [baseGoldPerTurn, setBaseGoldPerTurn] = useState(10);
  const [demolitionCostConstructionPercent, setDemolitionCostConstructionPercent] = useState(20);
  const [marketPriceSmoothing, setMarketPriceSmoothing] = useState(0.2);
  const [buildingDurabilityDecayPerTurn, setBuildingDurabilityDecayPerTurn] = useState(10);
  const [buildingDurabilityRecoveryPerTurn, setBuildingDurabilityRecoveryPerTurn] = useState(5);
  const [pollutionProductivityEffectPer1000, setPollutionProductivityEffectPer1000] = useState(0.1);
  const [explorationBaseEmptyChancePct, setExplorationBaseEmptyChancePct] = useState(5);
  const [explorationDepletionPerAttemptPct, setExplorationDepletionPerAttemptPct] = useState(7.5);
  const [explorationDurationTurns, setExplorationDurationTurns] = useState(1);
  const [explorationRollsPerExpedition, setExplorationRollsPerExpedition] = useState(3);
  const [maxActiveColonizations, setMaxActiveColonizations] = useState(3);
  const [colonizationPointsPerTurn, setColonizationPointsPerTurn] = useState(30);
  const [colonizationPointsCostPer1000Km2, setColonizationPointsCostPer1000Km2] = useState(5);
  const [colonizationDucatsCostPer1000Km2, setColonizationDucatsCostPer1000Km2] = useState(5);
  const [colonizationSettlementEnabled, setColonizationSettlementEnabled] = useState(true);
  const [colonizationSettlementPopulationOnCapture, setColonizationSettlementPopulationOnCapture] = useState(1_000);
  const [renameDucats, setRenameDucats] = useState(20);
  const [recolorDucats, setRecolorDucats] = useState(10);
  const [flagDucats, setFlagDucats] = useState(15);
  const [crestDucats, setCrestDucats] = useState(15);
  const [provinceRenameDucats, setProvinceRenameDucats] = useState(25);
  const [eventLogRetentionTurns, setEventLogRetentionTurns] = useState(3);
  const [requireAdminApprovalForRegistration, setRequireAdminApprovalForRegistration] = useState(false);
  const [turnTimerEnabled, setTurnTimerEnabled] = useState(false);
  const [turnTimerSeconds, setTurnTimerSeconds] = useState(300);
  const [turnTimerPauseWhenNoPlayersOnline, setTurnTimerPauseWhenNoPlayersOnline] = useState(false);
  const [showAntarctica, setShowAntarctica] = useState(true);
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
  const [resourceIconFiles, setResourceIconFiles] = useState<Partial<Record<keyof ResourceIconsMap, File | null>>>({});
  const [uiBackgroundImageUrl, setUiBackgroundImageUrl] = useState<string | null>(null);
  const [uiBackgroundFile, setUiBackgroundFile] = useState<File | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioDescriptor[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState("active");
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [applyingScenarioId, setApplyingScenarioId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchGameSettings(token)
      .then((settings) => {
        if (cancelled) return;
        setBaseCulturePerTurn(settings.economy.baseCulturePerTurn ?? 1);
        setBaseSciencePerTurn(settings.economy.baseSciencePerTurn ?? 1);
        setBaseReligionPerTurn(settings.economy.baseReligionPerTurn ?? 1);
        setBaseConstructionPerTurn(settings.economy.baseConstructionPerTurn);
        setBaseDucatsPerTurn(settings.economy.baseDucatsPerTurn);
        setBaseGoldPerTurn(settings.economy.baseGoldPerTurn);
        setDemolitionCostConstructionPercent(settings.economy.demolitionCostConstructionPercent ?? 20);
        setMarketPriceSmoothing(settings.economy.marketPriceSmoothing ?? 0.2);
        setBuildingDurabilityDecayPerTurn(settings.economy.buildingDurabilityDecayPerTurn ?? 10);
        setBuildingDurabilityRecoveryPerTurn(settings.economy.buildingDurabilityRecoveryPerTurn ?? 5);
        setPollutionProductivityEffectPer1000(settings.economy.pollutionProductivityEffectPer1000 ?? 0.1);
        setExplorationBaseEmptyChancePct(settings.economy.explorationBaseEmptyChancePct ?? 5);
        setExplorationDepletionPerAttemptPct(settings.economy.explorationDepletionPerAttemptPct ?? 7.5);
        setExplorationDurationTurns(settings.economy.explorationDurationTurns ?? 1);
        setExplorationRollsPerExpedition(settings.economy.explorationRollsPerExpedition ?? 3);
        setMaxActiveColonizations(settings.colonization.maxActiveColonizations);
        setColonizationPointsPerTurn(settings.colonization.pointsPerTurn);
        setColonizationPointsCostPer1000Km2(settings.colonization.pointsCostPer1000Km2);
        setColonizationDucatsCostPer1000Km2(settings.colonization.ducatsCostPer1000Km2);
        setColonizationSettlementEnabled(settings.colonization.settlementEnabled ?? true);
        setColonizationSettlementPopulationOnCapture(settings.colonization.settlementPopulationOnCapture ?? 1_000);
        setRenameDucats(settings.customization.renameDucats);
        setRecolorDucats(settings.customization.recolorDucats);
        setFlagDucats(settings.customization.flagDucats);
        setCrestDucats(settings.customization.crestDucats);
        setProvinceRenameDucats(settings.customization.provinceRenameDucats ?? 25);
        setEventLogRetentionTurns(settings.eventLog.retentionTurns);
        setRequireAdminApprovalForRegistration(settings.registration?.requireAdminApproval ?? false);
        setTurnTimerEnabled(settings.turnTimer?.enabled ?? false);
        setTurnTimerSeconds(settings.turnTimer?.secondsPerTurn ?? 300);
        setTurnTimerPauseWhenNoPlayersOnline(settings.turnTimer?.pauseWhenNoPlayersOnline ?? false);
        setShowAntarctica(settings.map?.showAntarctica ?? true);
        setUiBackgroundImageUrl(settings.map?.backgroundImageUrl ?? null);
        setUiBackgroundFile(null);
        setResourceIcons(settings.resourceIcons);
        setResourceIconFiles({});
      })
      .catch(() => {
        if (!cancelled) toast.error("Не удалось загрузить настройки игры");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    setLoadingScenarios(true);
    fetchAdminScenarios(token)
      .then((result) => {
        if (cancelled) return;
        setScenarios(result.scenarios);
        setActiveScenarioId(result.activeScenarioId);
      })
      .catch(() => {
        if (!cancelled) toast.error("Не удалось загрузить сценарии");
      })
      .finally(() => {
        if (!cancelled) setLoadingScenarios(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, token]);

  const saveEconomy = async () => {
    setSaving(true);
    try {
      const updated = await updateGameSettings(token, {
        economy: {
          baseCulturePerTurn: Math.max(0, Math.floor(baseCulturePerTurn)),
          baseSciencePerTurn: Math.max(0, Math.floor(baseSciencePerTurn)),
          baseReligionPerTurn: Math.max(0, Math.floor(baseReligionPerTurn)),
          baseConstructionPerTurn: Math.max(0, Math.floor(baseConstructionPerTurn)),
          baseDucatsPerTurn: Math.max(0, Math.floor(baseDucatsPerTurn)),
          baseGoldPerTurn: Math.max(0, Math.floor(baseGoldPerTurn)),
          demolitionCostConstructionPercent: Math.min(100, Math.max(0, Math.floor(demolitionCostConstructionPercent))),
          marketPriceSmoothing: Math.min(1, Math.max(0, Number(marketPriceSmoothing || 0))),
          buildingDurabilityDecayPerTurn: Math.max(0, Number(buildingDurabilityDecayPerTurn || 0)),
          buildingDurabilityRecoveryPerTurn: Math.max(0, Number(buildingDurabilityRecoveryPerTurn || 0)),
          pollutionProductivityEffectPer1000: Math.max(0, Number(pollutionProductivityEffectPer1000 || 0)),
          explorationBaseEmptyChancePct: Math.min(100, Math.max(0, Number(explorationBaseEmptyChancePct || 0))),
          explorationDepletionPerAttemptPct: Math.min(100, Math.max(0, Number(explorationDepletionPerAttemptPct || 0))),
          explorationDurationTurns: Math.max(1, Math.floor(explorationDurationTurns || 1)),
          explorationRollsPerExpedition: Math.max(1, Math.floor(explorationRollsPerExpedition || 1)),
        },
      });
      setBaseCulturePerTurn(updated.economy.baseCulturePerTurn ?? 1);
      setBaseSciencePerTurn(updated.economy.baseSciencePerTurn ?? 1);
      setBaseReligionPerTurn(updated.economy.baseReligionPerTurn ?? 1);
      setBaseConstructionPerTurn(updated.economy.baseConstructionPerTurn);
      setBaseDucatsPerTurn(updated.economy.baseDucatsPerTurn);
      setBaseGoldPerTurn(updated.economy.baseGoldPerTurn);
      setDemolitionCostConstructionPercent(updated.economy.demolitionCostConstructionPercent ?? 20);
      setMarketPriceSmoothing(updated.economy.marketPriceSmoothing ?? 0.2);
      setBuildingDurabilityDecayPerTurn(updated.economy.buildingDurabilityDecayPerTurn ?? 10);
      setBuildingDurabilityRecoveryPerTurn(updated.economy.buildingDurabilityRecoveryPerTurn ?? 5);
      setPollutionProductivityEffectPer1000(updated.economy.pollutionProductivityEffectPer1000 ?? 0.1);
      setExplorationBaseEmptyChancePct(updated.economy.explorationBaseEmptyChancePct ?? 5);
      setExplorationDepletionPerAttemptPct(updated.economy.explorationDepletionPerAttemptPct ?? 7.5);
      setExplorationDurationTurns(updated.economy.explorationDurationTurns ?? 1);
      setExplorationRollsPerExpedition(updated.economy.explorationRollsPerExpedition ?? 3);
      onSettingsUpdated?.(updated);
      toast.success("Настройки экономики сохранены");
    } catch {
      toast.error("Не удалось сохранить настройки экономики");
    } finally {
      setSaving(false);
    }
  };

  const saveColonization = async () => {
    setSaving(true);
    try {
      const updated = await updateGameSettings(token, {
        colonization: {
          maxActiveColonizations: Math.max(1, Math.floor(maxActiveColonizations)),
          pointsPerTurn: Math.max(0, Math.floor(colonizationPointsPerTurn)),
          pointsCostPer1000Km2: Math.max(1, Math.floor(colonizationPointsCostPer1000Km2)),
          ducatsCostPer1000Km2: Math.max(0, Math.floor(colonizationDucatsCostPer1000Km2)),
          settlementEnabled: colonizationSettlementEnabled,
          settlementPopulationOnCapture: Math.max(
            0,
            Math.min(1_000_000_000, Math.floor(colonizationSettlementPopulationOnCapture)),
          ),
        },
        map: {
          showAntarctica,
        },
      });
      setMaxActiveColonizations(updated.colonization.maxActiveColonizations);
      setColonizationPointsPerTurn(updated.colonization.pointsPerTurn);
      setColonizationPointsCostPer1000Km2(updated.colonization.pointsCostPer1000Km2);
      setColonizationDucatsCostPer1000Km2(updated.colonization.ducatsCostPer1000Km2);
      setColonizationSettlementEnabled(updated.colonization.settlementEnabled ?? true);
      setColonizationSettlementPopulationOnCapture(updated.colonization.settlementPopulationOnCapture ?? 1_000);
      setShowAntarctica(updated.map?.showAntarctica ?? true);
      onSettingsUpdated?.(updated);
      toast.success("Настройки колонизации сохранены");
    } catch {
      toast.error("Не удалось сохранить настройки колонизации");
    } finally {
      setSaving(false);
    }
  };

  const recalculateAutoProvinceCosts = async () => {
    setSaving(true);
    try {
      const result = await adminRecalculateAutoRegionCosts(token);
      toast.success(`Пересчитаны авто-цены: ${result.updatedCount}`);
    } catch {
      toast.error("Не удалось пересчитать авто-цены");
    } finally {
      setSaving(false);
    }
  };

  const saveCustomization = async () => {
    setSaving(true);
    try {
      const updated = await updateGameSettings(token, {
        customization: {
          renameDucats: Math.max(0, Math.floor(renameDucats)),
          recolorDucats: Math.max(0, Math.floor(recolorDucats)),
          flagDucats: Math.max(0, Math.floor(flagDucats)),
          crestDucats: Math.max(0, Math.floor(crestDucats)),
          provinceRenameDucats: Math.max(0, Math.floor(provinceRenameDucats)),
        },
      });
      setRenameDucats(updated.customization.renameDucats);
      setRecolorDucats(updated.customization.recolorDucats);
      setFlagDucats(updated.customization.flagDucats);
      setCrestDucats(updated.customization.crestDucats);
      setProvinceRenameDucats(updated.customization.provinceRenameDucats ?? 25);
      onSettingsUpdated?.(updated);
      toast.success("Цены кастомизации сохранены");
    } catch {
      toast.error("Не удалось сохранить цены кастомизации");
    } finally {
      setSaving(false);
    }
  };

  const saveEventLogSettings = async () => {
    setSaving(true);
    try {
      const updated = await updateGameSettings(token, {
        eventLog: { retentionTurns: Math.max(1, Math.floor(eventLogRetentionTurns)) },
      });
      setEventLogRetentionTurns(updated.eventLog.retentionTurns);
      onSettingsUpdated?.(updated);
      toast.success("Настройки журнала событий сохранены");
    } catch {
      toast.error("Не удалось сохранить настройки журнала событий");
    } finally {
      setSaving(false);
    }
  };

  const saveRegistrationSettings = async () => {
    setSaving(true);
    try {
      const updated = await updateGameSettings(token, {
        registration: { requireAdminApproval: requireAdminApprovalForRegistration },
      });
      setRequireAdminApprovalForRegistration(updated.registration?.requireAdminApproval ?? false);
      onSettingsUpdated?.(updated);
      toast.success("Настройки регистрации сохранены");
    } catch {
      toast.error("Не удалось сохранить настройки регистрации");
    } finally {
      setSaving(false);
    }
  };

  const saveTurnTimer = async () => {
    setSaving(true);
    try {
      const updated = await updateGameSettings(token, {
        turnTimer: {
          enabled: turnTimerEnabled,
          secondsPerTurn: Math.min(2_592_000, Math.max(10, Math.floor(turnTimerSeconds || 10))),
          pauseWhenNoPlayersOnline: turnTimerPauseWhenNoPlayersOnline,
        },
      });
      setTurnTimerEnabled(updated.turnTimer.enabled);
      setTurnTimerSeconds(updated.turnTimer.secondsPerTurn);
      setTurnTimerPauseWhenNoPlayersOnline(updated.turnTimer.pauseWhenNoPlayersOnline ?? false);
      onSettingsUpdated?.(updated);
      toast.success("Таймер хода сохранён");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("GAME_SETTINGS_INVALID")) {
        toast.error("Не удалось сохранить таймер хода", {
          description: "Допустимый диапазон: от 10 до 2 592 000 секунд (до 30 дней)",
        });
      } else {
        toast.error("Не удалось сохранить таймер хода");
      }
    } finally {
      setSaving(false);
    }
  };

  const saveResourceIcons = async () => {
    const selected = Object.entries(resourceIconFiles).filter(([, f]) => f) as Array<[keyof ResourceIconsMap, File]>;
    if (selected.length === 0) {
      toast.error("Сначала выберите хотя бы одну иконку");
      return;
    }

    for (const [key, file] of selected) {
      const ok = await isImageWithinMaxSize(file, 64);
      if (!ok) {
        toast.error(`Иконка "${key}" должна быть максимум 64x64`);
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await adminUploadResourceIcons(token, resourceIconFiles);
      setResourceIcons(updated.resourceIcons);
      setResourceIconFiles({});
      onResourceIconsUpdated?.(updated.resourceIcons);
      toast.success("Иконки очков обновлены");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "RESOURCE_ICONS_UPDATE_FAILED";
      if (msg === "IMAGE_DIMENSIONS_TOO_LARGE") {
        toast.error("Иконка должна быть максимум 64x64");
      } else {
        toast.error("Не удалось обновить иконки очков");
      }
    } finally {
      setSaving(false);
    }
  };

  const saveUiBackground = async () => {
    if (!uiBackgroundFile) {
      toast.error("Сначала выберите изображение");
      return;
    }
    const ok = await isImageWithinMaxSize(uiBackgroundFile, 4096);
    if (!ok) {
      toast.error("Фоновое изображение должно быть максимум 4096x4096");
      return;
    }
    setSaving(true);
    try {
      const updated = await adminUploadUiBackground(token, uiBackgroundFile);
      setUiBackgroundImageUrl(updated.map.backgroundImageUrl);
      setUiBackgroundFile(null);
      const next = await fetchGameSettings(token);
      onSettingsUpdated?.(next);
      toast.success("Фон интерфейса обновлён");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UI_BACKGROUND_UPDATE_FAILED";
      if (msg === "IMAGE_DIMENSIONS_TOO_LARGE") {
        toast.error("Фоновое изображение должно быть максимум 4096x4096");
      } else {
        toast.error("Не удалось обновить фон интерфейса");
      }
    } finally {
      setSaving(false);
    }
  };

  const clearUiBackground = async () => {
    setSaving(true);
    try {
      const updated = await updateGameSettings(token, { map: { backgroundImageUrl: null } });
      setUiBackgroundImageUrl(updated.map.backgroundImageUrl ?? null);
      setUiBackgroundFile(null);
      onSettingsUpdated?.(updated);
      toast.success("Фон интерфейса удалён");
    } catch {
      toast.error("Не удалось удалить фон интерфейса");
    } finally {
      setSaving(false);
    }
  };

  const applyScenario = async (scenario: ScenarioDescriptor) => {
    const confirmed = window.confirm(
      `Начать новую игру по сценарию "${scenario.name}"?\n\nТекущее состояние мира, очереди и прогресс будут сброшены.`,
    );
    if (!confirmed) return;
    setApplyingScenarioId(scenario.id);
    try {
      const result = await applyAdminScenario(token, scenario.id);
      setActiveScenarioId(result.activeScenarioId);
      toast.success("Сценарий применён", { description: "Страница будет перезагружена для новой карты" });
      window.setTimeout(() => window.location.reload(), 500);
    } catch {
      toast.error("Не удалось применить сценарий");
    } finally {
      setApplyingScenarioId(null);
    }
  };

  const resourceLabels: Array<[keyof ResourceIconsMap, string]> = [
    ["population", "Население"],
    ["culture", "Культура"],
    ["science", "Наука"],
    ["religion", "Религия"],
    ["colonization", "Колонизация"],
    ["construction", "Строительство"],
    ["ducats", "Дукаты"],
    ["gold", "Золото"],
  ];

  return (
    <AppModal open={open} onClose={onClose} modalKey="game-settings" zIndexClassName="z-[125]" paddingClassName="p-4" panelClassName="rounded-none">
          <AppModalHeader title="Настройки игры" onClose={onClose} />

          <div className="grid h-[calc(100vh-92px)] gap-4 md:grid-cols-[260px_1fr]">
            <AppSection className="arc-scrollbar overflow-auto p-2">
              {categories.map((cat) => (
                <AppButton
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  variant={activeCategory === cat.id ? "primary" : "ghost"}
                  size="md"
                  className="mb-2 w-full justify-start"
                  icon={<cat.icon size={14} />}
                >
                  {cat.label}
                </AppButton>
              ))}
            </AppSection>

            <AppSection className="arc-scrollbar overflow-auto p-4">
              {loading ? (
                <div className="text-sm text-slate-400">Загрузка настроек...</div>
              ) : (
                <div className="space-y-4">
                  {activeCategory === "scenarios" && (
                    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <Map size={15} className="text-arc-accent" />
                        Сценарии новой игры
                      </div>
                      <div className="text-xs text-slate-400">
                        Сценарий переключает карту, content library и стартовые setup-файлы. Применение сценария создаёт новую игру и сбрасывает текущее состояние мира.
                      </div>
                      {loadingScenarios ? (
                        <div className="text-sm text-slate-400">Загрузка сценариев...</div>
                      ) : scenarios.length === 0 ? (
                        <div className="rounded-lg border border-white/10 bg-black/25 p-4 text-sm text-slate-300">
                          Сценарии не найдены. Добавь папки в apps/server/data/scenarios.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {scenarios.map((scenario) => {
                            const isActive = scenario.id === activeScenarioId || scenario.active;
                            const canApply = scenario.map.hasVectorTiles && scenario.map.hasProvinces && !isActive;
                            return (
                              <div key={scenario.id} className="rounded-lg border border-white/10 bg-black/25 p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="truncate text-sm font-semibold text-white">{scenario.name}</div>
                                      {isActive && <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">Активен</span>}
                                      {scenario.startDate && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">{scenario.startDate}</span>}
                                    </div>
                                    {scenario.description && <div className="mt-1 text-xs text-slate-400">{scenario.description}</div>}
                                    <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-2 xl:grid-cols-4">
                                      <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2">Ход старта: {scenario.startTurn}</div>
                                      <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2">Карта: {scenario.map.root}</div>
                                      <div className={`rounded-md border px-3 py-2 ${scenario.map.hasVectorTiles ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-rose-400/30 bg-rose-500/10 text-rose-200"}`}>
                                        MVT {scenario.map.hasVectorTiles ? "есть" : "нет"}
                                      </div>
                                      <div className={`rounded-md border px-3 py-2 ${scenario.map.hasRasterTiles ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-black/25"}`}>
                                        Raster {scenario.map.hasRasterTiles ? "есть" : "нет"}
                                      </div>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-500">
                                      Content: {scenario.contentFiles.length || 0} файлов · Setup: {scenario.setupFiles.length || 0} файлов
                                    </div>
                                  </div>
                                  <AppButton
                                    onClick={() => applyScenario(scenario)}
                                    disabled={!canApply || applyingScenarioId === scenario.id}
                                    variant={isActive ? "ghost" : "primary"}
                                    icon={<RefreshCcw size={14} />}
                                    className="shrink-0"
                                  >
                                    {isActive ? "Выбран" : applyingScenarioId === scenario.id ? "Запуск..." : "Начать"}
                                  </AppButton>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeCategory === "economy" && (
                    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <Coins size={15} className="text-arc-accent" />
                        Базовый доход за каждый резолв хода
                      </div>
                      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Культура / ход</label>
                          <input type="number" min={0} value={baseCulturePerTurn} onChange={(e) => setBaseCulturePerTurn(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Наука / ход</label>
                          <input type="number" min={0} value={baseSciencePerTurn} onChange={(e) => setBaseSciencePerTurn(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Религия / ход</label>
                          <input type="number" min={0} value={baseReligionPerTurn} onChange={(e) => setBaseReligionPerTurn(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Очки строительства / ход</label>
                          <input type="number" min={0} value={baseConstructionPerTurn} onChange={(e) => setBaseConstructionPerTurn(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Дукаты / ход</label>
                          <input type="number" min={0} value={baseDucatsPerTurn} onChange={(e) => setBaseDucatsPerTurn(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Золото / ход</label>
                          <input type="number" min={0} value={baseGoldPerTurn} onChange={(e) => setBaseGoldPerTurn(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Снос постройки (% строительства)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={demolitionCostConstructionPercent}
                            onChange={(e) => setDemolitionCostConstructionPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                            className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Сглаживание цены рынка (0..1)</label>
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            value={marketPriceSmoothing}
                            onChange={(e) => setMarketPriceSmoothing(Math.min(1, Math.max(0, Number(e.target.value) || 0)))}
                            className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Потеря прочности/ход (неактивные)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={buildingDurabilityDecayPerTurn}
                            onChange={(e) => setBuildingDurabilityDecayPerTurn(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Восстановление прочности/ход (активные)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={buildingDurabilityRecoveryPerTurn}
                            onChange={(e) => setBuildingDurabilityRecoveryPerTurn(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Эффект загрязнения / 1000</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={pollutionProductivityEffectPer1000}
                            onChange={(e) => setPollutionProductivityEffectPer1000(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Базовый шанс пустой разведки (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={explorationBaseEmptyChancePct}
                            onChange={(e) => setExplorationBaseEmptyChancePct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                            className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Рост шанса пусто за попытку (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={explorationDepletionPerAttemptPct}
                            onChange={(e) =>
                              setExplorationDepletionPerAttemptPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                            }
                            className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Длительность разведки (ходы)</label>
                          <input
                            type="number"
                            min={1}
                            value={explorationDurationTurns}
                            onChange={(e) => setExplorationDurationTurns(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                            className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Роллов за разведку</label>
                          <input
                            type="number"
                            min={1}
                            value={explorationRollsPerExpedition}
                            onChange={(e) =>
                              setExplorationRollsPerExpedition(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                            }
                            className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <AppButton onClick={() => void saveEconomy()} disabled={saving} variant="primary" icon={<Save size={14} />}>
                        Сохранить
                      </AppButton>
                    </div>
                  )}

                  {activeCategory === "turnTimer" && (
                    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <RefreshCcw size={15} className="text-arc-accent" />
                        Автоматический переход хода по таймеру
                      </div>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        <div>
                          <div className="text-sm text-slate-100">Включить авто-переход хода</div>
                          <div className="text-xs text-slate-500">Сервер завершит ход по таймеру даже если не все страны нажали следующий ход</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTurnTimerEnabled((v) => !v)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                            turnTimerEnabled ? "border-emerald-400/50 bg-emerald-500/20" : "border-white/10 bg-white/5"
                          }`}
                          aria-pressed={turnTimerEnabled}
                          aria-label={turnTimerEnabled ? "Выключить таймер хода" : "Включить таймер хода"}
                        >
                          <span
                            className={`h-5 w-5 rounded-full transition ${
                              turnTimerEnabled
                                ? "translate-x-6 bg-emerald-500 shadow-[0_0_12px_rgba(110,231,183,0.45)]"
                                : "translate-x-1 bg-white/60"
                            }`}
                          />
                        </button>
                      </label>
                      <div>
                        <label className="mb-1 block text-xs text-slate-300">Секунд на ход</label>
                        <input
                          type="number"
                          min={10}
                          max={2_592_000}
                          value={turnTimerSeconds}
                          onChange={(e) =>
                            setTurnTimerSeconds(
                              Math.min(2_592_000, Math.max(10, Number(e.target.value) || 10)),
                            )
                          }
                          className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm"
                        />
                        <div className="mt-1 text-xs text-slate-500">
                          Диапазон: 10–2 592 000 секунд (до 30 дней). Таймер сбрасывается после каждого резолва хода.
                        </div>
                      </div>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        <div>
                          <div className="text-sm text-slate-100">Пауза таймера без игроков онлайн</div>
                          <div className="text-xs text-slate-500">Если включено, авто-таймер не тикает, пока онлайн 0 игроков.</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTurnTimerPauseWhenNoPlayersOnline((v) => !v)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                            turnTimerPauseWhenNoPlayersOnline ? "border-emerald-400/50 bg-emerald-500/20" : "border-white/10 bg-white/5"
                          }`}
                          aria-pressed={turnTimerPauseWhenNoPlayersOnline}
                          aria-label={
                            turnTimerPauseWhenNoPlayersOnline
                              ? "Выключить паузу таймера без игроков"
                              : "Включить паузу таймера без игроков"
                          }
                        >
                          <span
                            className={`h-5 w-5 rounded-full transition ${
                              turnTimerPauseWhenNoPlayersOnline
                                ? "translate-x-6 bg-emerald-500 shadow-[0_0_12px_rgba(110,231,183,0.45)]"
                                : "translate-x-1 bg-white/60"
                            }`}
                          />
                        </button>
                      </label>
                      <AppButton onClick={() => void saveTurnTimer()} disabled={saving} variant="primary" icon={<Save size={14} />}>
                        Сохранить
                      </AppButton>
                    </div>
                  )}

                  {activeCategory === "colonization" && (
                    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <Flag size={15} className="text-arc-accent" />
                        Лимиты колонизации
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Макс. одновременных колонизаций</label>
                          <input type="number" min={1} value={maxActiveColonizations} onChange={(e) => setMaxActiveColonizations(Math.max(1, Number(e.target.value) || 1))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Прирост очков колонизации / ход</label>
                          <input type="number" min={0} value={colonizationPointsPerTurn} onChange={(e) => setColonizationPointsPerTurn(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Цена (очки колонизации) за 1000 км²</label>
                          <input type="number" min={1} value={colonizationPointsCostPer1000Km2} onChange={(e) => setColonizationPointsCostPer1000Km2(Math.max(1, Number(e.target.value) || 1))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Цена (дукаты) за 1000 км²</label>
                          <input type="number" min={0} value={colonizationDucatsCostPer1000Km2} onChange={(e) => setColonizationDucatsCostPer1000Km2(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Поселенцы при захвате пустого региона</label>
                          <input type="number" min={0} max={1_000_000_000} value={colonizationSettlementPopulationOnCapture} onChange={(e) => setColonizationSettlementPopulationOnCapture(Math.max(0, Math.min(1_000_000_000, Number(e.target.value) || 0)))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                        </div>
                        <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                          <div>
                            <div className="text-sm text-slate-100">Стартовые поселенцы</div>
                            <div className="text-xs text-slate-500">Добавляет население только при первом захвате пустого региона</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setColonizationSettlementEnabled((v) => !v)}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                              colonizationSettlementEnabled ? "border-emerald-400/50 bg-emerald-500/20" : "border-white/10 bg-white/5"
                            }`}
                            aria-pressed={colonizationSettlementEnabled}
                            aria-label={colonizationSettlementEnabled ? "Отключить стартовых поселенцев" : "Включить стартовых поселенцев"}
                          >
                            <span
                              className={`h-5 w-5 rounded-full transition ${
                                colonizationSettlementEnabled
                                  ? "translate-x-6 bg-emerald-500 shadow-[0_0_12px_rgba(110,231,183,0.45)]"
                                  : "translate-x-1 bg-white/60"
                              }`}
                            />
                          </button>
                        </label>
                        <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                          <div>
                            <div className="text-sm text-slate-100">Показывать Антарктиду</div>
                            <div className="text-xs text-slate-500">Скрывает провинции Антарктиды на карте для всех игроков</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAntarctica((v) => !v)}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                              showAntarctica ? "border-emerald-400/50 bg-emerald-500/20" : "border-white/10 bg-white/5"
                            }`}
                            aria-pressed={showAntarctica}
                            aria-label={showAntarctica ? "Скрыть Антарктиду" : "Показать Антарктиду"}
                          >
                            <span
                              className={`h-5 w-5 rounded-full transition ${
                                showAntarctica
                                  ? "translate-x-6 bg-emerald-500 shadow-[0_0_12px_rgba(110,231,183,0.45)]"
                                  : "translate-x-1 bg-white/60"
                              }`}
                            />
                          </button>
                        </label>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                        Базовая стоимость провинции рассчитывается от площади: `ставка за 1000 км² × площадь / 1000`. Ручная стоимость провинции в админ-редакторе остаётся как override.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <AppButton onClick={() => void saveColonization()} disabled={saving} variant="primary" icon={<Save size={14} />}>
                          Сохранить
                        </AppButton>
                        <AppButton
                          type="button"
                          onClick={recalculateAutoProvinceCosts}
                          disabled={saving}
                          variant="secondary"
                          icon={<RefreshCcw size={14} />}
                        >
                          Пересчитать все авто-цены
                        </AppButton>
                      </div>
                    </div>
                  )}

                  {activeCategory === "customization" && (
                    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <Coins size={15} className="text-arc-accent" />
                        Цены на изменение страны за дукаты
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div><label className="mb-1 block text-xs text-slate-300">Переименование страны</label><input type="number" min={0} value={renameDucats} onChange={(e) => setRenameDucats(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" /></div>
                        <div><label className="mb-1 block text-xs text-slate-300">Смена цвета</label><input type="number" min={0} value={recolorDucats} onChange={(e) => setRecolorDucats(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" /></div>
                        <div><label className="mb-1 block text-xs text-slate-300">Смена флага</label><input type="number" min={0} value={flagDucats} onChange={(e) => setFlagDucats(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" /></div>
                        <div><label className="mb-1 block text-xs text-slate-300">Смена герба</label><input type="number" min={0} value={crestDucats} onChange={(e) => setCrestDucats(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" /></div>
                        <div><label className="mb-1 block text-xs text-slate-300">Переименование провинции</label><input type="number" min={0} value={provinceRenameDucats} onChange={(e) => setProvinceRenameDucats(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" /></div>
                      </div>
                      <AppButton onClick={() => void saveCustomization()} disabled={saving} variant="primary" icon={<Save size={14} />}>
                        Сохранить
                      </AppButton>
                    </div>
                  )}

                  {activeCategory === "registration" && (
                    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <Flag size={15} className="text-arc-accent" />
                        Регистрация новых стран
                      </div>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        <div>
                          <div className="text-sm text-slate-100">Требовать подтверждение администратора</div>
                          <div className="text-xs text-slate-500">Новые страны регистрируются, но не могут войти до одобрения админом</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRequireAdminApprovalForRegistration((v) => !v)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                            requireAdminApprovalForRegistration ? "border-emerald-400/50 bg-emerald-500/20" : "border-white/10 bg-white/5"
                          }`}
                          aria-pressed={requireAdminApprovalForRegistration}
                          aria-label={requireAdminApprovalForRegistration ? "Выключить подтверждение регистрации" : "Включить подтверждение регистрации"}
                        >
                          <span
                            className={`h-5 w-5 rounded-full transition ${
                              requireAdminApprovalForRegistration
                                ? "translate-x-6 bg-emerald-500 shadow-[0_0_12px_rgba(110,231,183,0.45)]"
                                : "translate-x-1 bg-white/60"
                            }`}
                          />
                        </button>
                      </label>
                      <AppButton onClick={() => void saveRegistrationSettings()} disabled={saving} variant="primary" icon={<Save size={14} />}>
                        Сохранить
                      </AppButton>
                    </div>
                  )}

                  {activeCategory === "eventLog" && (
                    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <Coins size={15} className="text-arc-accent" />
                        Глобальные настройки журнала событий
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-300">Хранить события за последние (ходов)</label>
                        <input type="number" min={1} max={100} value={eventLogRetentionTurns} onChange={(e) => setEventLogRetentionTurns(Math.max(1, Number(e.target.value) || 1))} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                      </div>
                      <AppButton onClick={() => void saveEventLogSettings()} disabled={saving} variant="primary" icon={<Save size={14} />}>
                        Сохранить
                      </AppButton>
                    </div>
                  )}

                  {activeCategory === "background" && (
                    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <Monitor size={15} className="text-arc-accent" />
                        Фоновое изображение интерфейса (макс. 4096x4096)
                      </div>
                      <div className="panel-border rounded-lg bg-black/25 p-3">
                        <div className="mb-2 text-xs text-slate-400">Текущий фон</div>
                        <div className="flex h-40 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/30">
                          {uiBackgroundImageUrl ? (
                            <img src={uiBackgroundImageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="text-xs text-slate-500">Фон не установлен</div>
                          )}
                        </div>
                      </div>
                      <label className="panel-border flex cursor-pointer items-center justify-center rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-arc-accent/40">
                        Выбрать изображение
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setUiBackgroundFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {uiBackgroundFile ? <div className="text-xs text-emerald-500">Выбран файл: {uiBackgroundFile.name}</div> : null}
                      <div className="flex flex-wrap gap-2">
                        <AppButton onClick={saveUiBackground} disabled={saving || !uiBackgroundFile} variant="primary" icon={<Save size={14} />}>
                          Загрузить фон
                        </AppButton>
                        <AppButton
                          type="button"
                          onClick={clearUiBackground}
                          disabled={saving || (!uiBackgroundImageUrl && !uiBackgroundFile)}
                          variant="danger"
                        >
                          Удалить фон
                        </AppButton>
                      </div>
                    </div>
                  )}

                  {activeCategory === "resourceIcons" && (
                    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <Coins size={15} className="text-arc-accent" />
                        Иконки очков в верхней панели (макс. 64x64)
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {resourceLabels.map(([key, label]) => (
                          <div key={key} className="panel-border rounded-lg bg-black/25 p-3">
                            <div className="mb-2 text-xs text-slate-300">{label}</div>
                            <div className="mb-2 flex h-16 items-center justify-center rounded-md bg-black/35">
                              {resourceIcons[key] ? <img src={resourceIcons[key] ?? undefined} alt="" className="h-12 w-12 object-contain" /> : <div className="text-xs text-slate-500">Нет иконки</div>}
                            </div>
                            <label className="panel-border flex cursor-pointer items-center justify-center rounded-lg bg-white/5 px-2 py-2 text-xs text-slate-200 transition hover:border-arc-accent/40">
                              Выбрать файл
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => setResourceIconFiles((prev) => ({ ...prev, [key]: e.target.files?.[0] ?? null }))}
                              />
                            </label>
                            {resourceIconFiles[key] ? <div className="mt-1 truncate text-[10px] text-emerald-500">{resourceIconFiles[key]?.name}</div> : null}
                          </div>
                        ))}
                      </div>

                      <AppButton onClick={saveResourceIcons} disabled={saving} variant="primary" icon={<Save size={14} />}>
                        Загрузить иконки
                      </AppButton>
                    </div>
                  )}
                </div>
              )}
            </AppSection>
          </div>
    </AppModal>
  );
}
