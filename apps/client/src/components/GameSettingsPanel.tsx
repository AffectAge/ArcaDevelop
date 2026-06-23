import { useEffect, useState } from "react";
import { Coins, Flag, Map, Palette, RefreshCcw, Save, ScrollText, Timer, Wallet, Monitor } from "lucide-react";
import { toast } from "sonner";
import { useUiText } from "../i18n/useUiText";
import { adminRecalculateAutoRegionCosts, adminUploadUiBackground, applyAdminScenario, fetchAdminScenarios, fetchGameSettings, type GameSettings, type ScenarioDescriptor, updateGameSettings } from "../lib/api";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppSection } from "./ui/AppSurface";

type Props = {
  open: boolean;
  token: string;
  onClose: () => void;
  onSettingsUpdated?: (settings: GameSettings) => void;
};

const categories = [
  { id: "scenarios", labelKey: "gameSettings.category.scenarios", icon: Map },
  { id: "economy", labelKey: "gameSettings.category.economy", icon: Wallet },
  { id: "turnTimer", labelKey: "gameSettings.category.turnTimer", icon: Timer },
  { id: "colonization", labelKey: "gameSettings.category.colonization", icon: Flag },
  { id: "registration", labelKey: "gameSettings.category.registration", icon: Flag },
  { id: "customization", labelKey: "gameSettings.category.customization", icon: Palette },
  { id: "eventLog", labelKey: "gameSettings.category.eventLog", icon: ScrollText },
  { id: "background", labelKey: "gameSettings.category.background", icon: Monitor },
] as const;

const panelClass = "space-y-4 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4";
const nestedPanelClass = "rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2";
const inputClass = "w-full rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2 text-sm text-[rgb(var(--theme-text-primary))]";
const labelClass = "mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]";
const sectionTitleClass = "flex items-center gap-2 text-sm text-[rgb(var(--theme-text-primary))]";
const mutedTextClass = "text-xs text-[rgb(var(--theme-text-muted))]";
const toggleClass = (enabled: boolean) =>
  `relative inline-flex h-7 w-12 items-center rounded-full border transition ${
    enabled
      ? "border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))]"
      : "border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))]"
  }`;
const toggleKnobClass = (enabled: boolean) =>
  `h-5 w-5 rounded-full transition ${
    enabled
      ? "translate-x-6 bg-[rgb(var(--theme-success))] shadow-[0_0_12px_rgb(var(--theme-success-soft))]"
      : "translate-x-1 bg-[rgb(var(--theme-text-muted))]"
  }`;

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

export function GameSettingsPanel({ open, token, onClose, onSettingsUpdated }: Props) {
  const { t } = useUiText();
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
  const [hexRenameDucats, setHexRenameDucats] = useState(25);
  const [eventLogRetentionTurns, setEventLogRetentionTurns] = useState(3);
  const [requireAdminApprovalForRegistration, setRequireAdminApprovalForRegistration] = useState(false);
  const [turnTimerEnabled, setTurnTimerEnabled] = useState(false);
  const [turnTimerSeconds, setTurnTimerSeconds] = useState(300);
  const [turnTimerPauseWhenNoPlayersOnline, setTurnTimerPauseWhenNoPlayersOnline] = useState(false);
  const [showAntarctica, setShowAntarctica] = useState(true);
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
        setHexRenameDucats(settings.customization.hexRenameDucats ?? 25);
        setEventLogRetentionTurns(settings.eventLog.retentionTurns);
        setRequireAdminApprovalForRegistration(settings.registration?.requireAdminApproval ?? false);
        setTurnTimerEnabled(settings.turnTimer?.enabled ?? false);
        setTurnTimerSeconds(settings.turnTimer?.secondsPerTurn ?? 300);
        setTurnTimerPauseWhenNoPlayersOnline(settings.turnTimer?.pauseWhenNoPlayersOnline ?? false);
        setShowAntarctica(settings.map?.showAntarctica ?? true);
        setUiBackgroundImageUrl(settings.map?.backgroundImageUrl ?? null);
        setUiBackgroundFile(null);
      })
      .catch(() => {
        if (!cancelled) toast.error(t("gameSettings.loadFailed"));
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
        if (!cancelled) toast.error(t("gameSettings.scenariosLoadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoadingScenarios(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, t, token]);

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
      toast.success(t("gameSettings.economySaved"));
    } catch {
      toast.error(t("gameSettings.economySaveFailed"));
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
      toast.success(t("gameSettings.colonizationSaved"));
    } catch {
      toast.error(t("gameSettings.colonizationSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const recalculateAutoHexCosts = async () => {
    setSaving(true);
    try {
      const result = await adminRecalculateAutoRegionCosts(token);
      toast.success(t("gameSettings.autoCostsRecalculated", { count: result.updatedCount }));
    } catch {
      toast.error(t("gameSettings.autoCostsRecalculateFailed"));
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
          hexRenameDucats: Math.max(0, Math.floor(hexRenameDucats)),
        },
      });
      setRenameDucats(updated.customization.renameDucats);
      setRecolorDucats(updated.customization.recolorDucats);
      setFlagDucats(updated.customization.flagDucats);
      setCrestDucats(updated.customization.crestDucats);
      setHexRenameDucats(updated.customization.hexRenameDucats ?? 25);
      onSettingsUpdated?.(updated);
      toast.success(t("gameSettings.customizationSaved"));
    } catch {
      toast.error(t("gameSettings.customizationSaveFailed"));
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
      toast.success(t("gameSettings.eventLogSaved"));
    } catch {
      toast.error(t("gameSettings.eventLogSaveFailed"));
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
      toast.success(t("gameSettings.registrationSaved"));
    } catch {
      toast.error(t("gameSettings.registrationSaveFailed"));
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
      toast.success(t("gameSettings.turnTimerSaved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("GAME_SETTINGS_INVALID")) {
        toast.error(t("gameSettings.turnTimerSaveFailed"), {
          description: t("gameSettings.turnTimerRange"),
        });
      } else {
        toast.error(t("gameSettings.turnTimerSaveFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const saveUiBackground = async () => {
    if (!uiBackgroundFile) {
      toast.error(t("gameSettings.backgroundSelectFirst"));
      return;
    }
    const ok = await isImageWithinMaxSize(uiBackgroundFile, 4096);
    if (!ok) {
      toast.error(t("gameSettings.backgroundTooLarge"));
      return;
    }
    setSaving(true);
    try {
      const updated = await adminUploadUiBackground(token, uiBackgroundFile);
      setUiBackgroundImageUrl(updated.map.backgroundImageUrl);
      setUiBackgroundFile(null);
      const next = await fetchGameSettings(token);
      onSettingsUpdated?.(next);
      toast.success(t("gameSettings.backgroundSaved"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UI_BACKGROUND_UPDATE_FAILED";
      if (msg === "IMAGE_DIMENSIONS_TOO_LARGE") {
        toast.error(t("gameSettings.backgroundTooLarge"));
      } else {
        toast.error(t("gameSettings.backgroundSaveFailed"));
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
      toast.success(t("gameSettings.backgroundCleared"));
    } catch {
      toast.error(t("gameSettings.backgroundClearFailed"));
    } finally {
      setSaving(false);
    }
  };

  const applyScenario = async (scenario: ScenarioDescriptor) => {
    const confirmed = window.confirm(
      t("gameSettings.applyScenarioConfirm", { scenario: scenario.name }),
    );
    if (!confirmed) return;
    setApplyingScenarioId(scenario.id);
    try {
      const result = await applyAdminScenario(token, scenario.id);
      setActiveScenarioId(result.activeScenarioId);
      toast.success(t("gameSettings.scenarioApplied"), { description: t("gameSettings.scenarioAppliedDescription") });
      window.setTimeout(() => window.location.reload(), 500);
    } catch {
      toast.error(t("gameSettings.scenarioApplyFailed"));
    } finally {
      setApplyingScenarioId(null);
    }
  };

  return (
    <AppModal open={open} onClose={onClose} modalKey="game-settings" zIndexClassName="z-[125]" paddingClassName="p-4" panelClassName="rounded-none">
          <AppModalHeader title={t("gameSettings.title")} onClose={onClose} />

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
                  {t(cat.labelKey)}
                </AppButton>
              ))}
            </AppSection>

            <AppSection className="arc-scrollbar overflow-auto p-4">
              {loading ? (
                <div className="text-sm text-[rgb(var(--theme-text-muted))]">{t("gameSettings.loading")}</div>
              ) : (
                <div className="space-y-4">
                  {activeCategory === "scenarios" && (
                    <div className={panelClass}>
                      <div className={sectionTitleClass}>
                        <Map size={15} className="text-[rgb(var(--theme-accent))]" />
                        {t("gameSettings.scenariosTitle")}
                      </div>
                      <div className={mutedTextClass}>{t("gameSettings.scenariosDescription")}</div>
                      {loadingScenarios ? (
                        <div className="text-sm text-[rgb(var(--theme-text-muted))]">{t("gameSettings.scenariosLoading")}</div>
                      ) : scenarios.length === 0 ? (
                        <div className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] p-4 text-sm text-[rgb(var(--theme-text-secondary))]">
                          {t("gameSettings.scenariosEmpty")}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {scenarios.map((scenario) => {
                            const isActive = scenario.id === activeScenarioId || scenario.active;
                            const canApply = scenario.map.hasVectorTiles && scenario.map.hasHexes && !isActive;
                            return (
                              <div key={scenario.id} className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="truncate text-sm font-semibold text-[rgb(var(--theme-text-primary))]">{scenario.name}</div>
                                      {isActive && <span className="rounded-full border border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] px-2 py-0.5 text-[11px] text-[rgb(var(--theme-success))]">{t("gameSettings.scenarioActive")}</span>}
                                      {scenario.startDate && <span className="rounded-full border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-3))] px-2 py-0.5 text-[11px] text-[rgb(var(--theme-text-secondary))]">{scenario.startDate}</span>}
                                    </div>
                                    {scenario.description && <div className="mt-1 text-xs text-[rgb(var(--theme-text-muted))]">{scenario.description}</div>}
                                    <div className="mt-3 grid gap-2 text-xs text-[rgb(var(--theme-text-secondary))] md:grid-cols-2 xl:grid-cols-4">
                                      <div className={nestedPanelClass}>{t("gameSettings.scenarioStartTurn", { turn: scenario.startTurn })}</div>
                                      <div className={nestedPanelClass}>{t("gameSettings.scenarioMap", { map: scenario.map.root })}</div>
                                      <div className={`rounded-md border px-3 py-2 ${scenario.map.hasVectorTiles ? "border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] text-[rgb(var(--theme-success))]" : "border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] text-[rgb(var(--theme-danger))]"}`}>
                                        {t("gameSettings.scenarioMvt", { value: scenario.map.hasVectorTiles ? t("gameSettings.yes") : t("gameSettings.no") })}
                                      </div>
                                      <div className={`rounded-md border px-3 py-2 ${scenario.map.hasRasterTiles ? "border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] text-[rgb(var(--theme-success))]" : "border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))]"}`}>
                                        {t("gameSettings.scenarioRaster", { value: scenario.map.hasRasterTiles ? t("gameSettings.yes") : t("gameSettings.no") })}
                                      </div>
                                    </div>
                                    <div className="mt-2 text-xs text-[rgb(var(--theme-text-muted))]">
                                      {t("gameSettings.scenarioFiles", { content: scenario.contentFiles.length || 0, setup: scenario.setupFiles.length || 0 })}
                                    </div>
                                  </div>
                                  <AppButton
                                    onClick={() => applyScenario(scenario)}
                                    disabled={!canApply || applyingScenarioId === scenario.id}
                                    variant={isActive ? "ghost" : "primary"}
                                    icon={<RefreshCcw size={14} />}
                                    className="shrink-0"
                                  >
                                    {isActive ? t("gameSettings.scenarioSelected") : applyingScenarioId === scenario.id ? t("gameSettings.scenarioStarting") : t("gameSettings.scenarioStart")}
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
                    <div className={panelClass}>
                      <div className={sectionTitleClass}>
                        <Coins size={15} className="text-[rgb(var(--theme-accent))]" />
                        {t("gameSettings.economyTitle")}
                      </div>
                      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.culturePerTurn")}</label>
                          <input type="number" min={0} value={baseCulturePerTurn} onChange={(e) => setBaseCulturePerTurn(Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.sciencePerTurn")}</label>
                          <input type="number" min={0} value={baseSciencePerTurn} onChange={(e) => setBaseSciencePerTurn(Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.religionPerTurn")}</label>
                          <input type="number" min={0} value={baseReligionPerTurn} onChange={(e) => setBaseReligionPerTurn(Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.constructionPerTurn")}</label>
                          <input type="number" min={0} value={baseConstructionPerTurn} onChange={(e) => setBaseConstructionPerTurn(Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.ducatsPerTurn")}</label>
                          <input type="number" min={0} value={baseDucatsPerTurn} onChange={(e) => setBaseDucatsPerTurn(Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.goldPerTurn")}</label>
                          <input type="number" min={0} value={baseGoldPerTurn} onChange={(e) => setBaseGoldPerTurn(Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.demolitionCost")}</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={demolitionCostConstructionPercent}
                            onChange={(e) => setDemolitionCostConstructionPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.marketSmoothing")}</label>
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            value={marketPriceSmoothing}
                            onChange={(e) => setMarketPriceSmoothing(Math.min(1, Math.max(0, Number(e.target.value) || 0)))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.durabilityDecay")}</label>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={buildingDurabilityDecayPerTurn}
                            onChange={(e) => setBuildingDurabilityDecayPerTurn(Math.max(0, Number(e.target.value) || 0))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.durabilityRecovery")}</label>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={buildingDurabilityRecoveryPerTurn}
                            onChange={(e) => setBuildingDurabilityRecoveryPerTurn(Math.max(0, Number(e.target.value) || 0))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.pollutionEffect")}</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={pollutionProductivityEffectPer1000}
                            onChange={(e) => setPollutionProductivityEffectPer1000(Math.max(0, Number(e.target.value) || 0))}
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.explorationEmptyChance")}</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={explorationBaseEmptyChancePct}
                            onChange={(e) => setExplorationBaseEmptyChancePct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.explorationDepletion")}</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={explorationDepletionPerAttemptPct}
                            onChange={(e) =>
                              setExplorationDepletionPerAttemptPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                            }
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.explorationDuration")}</label>
                          <input
                            type="number"
                            min={1}
                            value={explorationDurationTurns}
                            onChange={(e) => setExplorationDurationTurns(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.economy.explorationRolls")}</label>
                          <input
                            type="number"
                            min={1}
                            value={explorationRollsPerExpedition}
                            onChange={(e) =>
                              setExplorationRollsPerExpedition(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                            }
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <AppButton onClick={() => void saveEconomy()} disabled={saving} variant="primary" icon={<Save size={14} />}>
                        {t("common.save")}
                      </AppButton>
                    </div>
                  )}

                  {activeCategory === "turnTimer" && (
                    <div className={panelClass}>
                      <div className={sectionTitleClass}>
                        <RefreshCcw size={15} className="text-[rgb(var(--theme-accent))]" />
                        {t("gameSettings.turnTimerTitle")}
                      </div>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2">
                        <div>
                          <div className="text-sm text-[rgb(var(--theme-text-primary))]">{t("gameSettings.turnTimerEnabled")}</div>
                          <div className={mutedTextClass}>{t("gameSettings.turnTimerEnabledDescription")}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTurnTimerEnabled((v) => !v)}
                          className={toggleClass(turnTimerEnabled)}
                          aria-pressed={turnTimerEnabled}
                          aria-label={turnTimerEnabled ? t("gameSettings.turnTimerDisable") : t("gameSettings.turnTimerEnable")}
                        >
                          <span className={toggleKnobClass(turnTimerEnabled)} />
                        </button>
                      </label>
                      <div>
                        <label className={labelClass}>{t("gameSettings.turnTimerSeconds")}</label>
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
                          className={inputClass}
                        />
                        <div className={`mt-1 ${mutedTextClass}`}>{t("gameSettings.turnTimerRange")}</div>
                      </div>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2">
                        <div>
                          <div className="text-sm text-[rgb(var(--theme-text-primary))]">{t("gameSettings.turnTimerPauseOffline")}</div>
                          <div className={mutedTextClass}>{t("gameSettings.turnTimerPauseOfflineDescription")}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTurnTimerPauseWhenNoPlayersOnline((v) => !v)}
                          className={toggleClass(turnTimerPauseWhenNoPlayersOnline)}
                          aria-pressed={turnTimerPauseWhenNoPlayersOnline}
                          aria-label={
                            turnTimerPauseWhenNoPlayersOnline
                              ? t("gameSettings.turnTimerPauseDisable")
                              : t("gameSettings.turnTimerPauseEnable")
                          }
                        >
                          <span className={toggleKnobClass(turnTimerPauseWhenNoPlayersOnline)} />
                        </button>
                      </label>
                      <AppButton onClick={() => void saveTurnTimer()} disabled={saving} variant="primary" icon={<Save size={14} />}>
                        {t("common.save")}
                      </AppButton>
                    </div>
                  )}

                  {activeCategory === "colonization" && (
                    <div className={panelClass}>
                      <div className={sectionTitleClass}>
                        <Flag size={15} className="text-[rgb(var(--theme-accent))]" />
                        {t("gameSettings.colonizationTitle")}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className={labelClass}>{t("gameSettings.colonization.maxActive")}</label>
                          <input type="number" min={1} value={maxActiveColonizations} onChange={(e) => setMaxActiveColonizations(Math.max(1, Number(e.target.value) || 1))} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.colonization.pointsPerTurn")}</label>
                          <input type="number" min={0} value={colonizationPointsPerTurn} onChange={(e) => setColonizationPointsPerTurn(Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.colonization.pointsCost")}</label>
                          <input type="number" min={1} value={colonizationPointsCostPer1000Km2} onChange={(e) => setColonizationPointsCostPer1000Km2(Math.max(1, Number(e.target.value) || 1))} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.colonization.ducatsCost")}</label>
                          <input type="number" min={0} value={colonizationDucatsCostPer1000Km2} onChange={(e) => setColonizationDucatsCostPer1000Km2(Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>{t("gameSettings.colonization.settlersOnCapture")}</label>
                          <input type="number" min={0} max={1_000_000_000} value={colonizationSettlementPopulationOnCapture} onChange={(e) => setColonizationSettlementPopulationOnCapture(Math.max(0, Math.min(1_000_000_000, Number(e.target.value) || 0)))} className={inputClass} />
                        </div>
                        <label className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2">
                          <div>
                            <div className="text-sm text-[rgb(var(--theme-text-primary))]">{t("gameSettings.colonization.settlersEnabled")}</div>
                            <div className={mutedTextClass}>{t("gameSettings.colonization.settlersDescription")}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setColonizationSettlementEnabled((v) => !v)}
                            className={toggleClass(colonizationSettlementEnabled)}
                            aria-pressed={colonizationSettlementEnabled}
                            aria-label={colonizationSettlementEnabled ? t("gameSettings.colonization.settlersDisable") : t("gameSettings.colonization.settlersEnable")}
                          >
                            <span className={toggleKnobClass(colonizationSettlementEnabled)} />
                          </button>
                        </label>
                        <label className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2">
                          <div>
                            <div className="text-sm text-[rgb(var(--theme-text-primary))]">{t("gameSettings.map.showAntarctica")}</div>
                            <div className={mutedTextClass}>{t("gameSettings.map.showAntarcticaDescription")}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAntarctica((v) => !v)}
                            className={toggleClass(showAntarctica)}
                            aria-pressed={showAntarctica}
                            aria-label={showAntarctica ? t("gameSettings.map.hideAntarctica") : t("gameSettings.map.showAntarcticaAction")}
                          >
                            <span className={toggleKnobClass(showAntarctica)} />
                          </button>
                        </label>
                      </div>
                      <div className={`${nestedPanelClass} text-xs text-[rgb(var(--theme-text-muted))]`}>{t("gameSettings.colonization.costNote")}</div>
                      <div className="flex flex-wrap gap-2">
                        <AppButton onClick={() => void saveColonization()} disabled={saving} variant="primary" icon={<Save size={14} />}>
                          {t("common.save")}
                        </AppButton>
                        <AppButton
                          type="button"
                          onClick={recalculateAutoHexCosts}
                          disabled={saving}
                          variant="secondary"
                          icon={<RefreshCcw size={14} />}
                        >
                          {t("gameSettings.recalculateAutoCosts")}
                        </AppButton>
                      </div>
                    </div>
                  )}

                  {activeCategory === "customization" && (
                    <div className={panelClass}>
                      <div className={sectionTitleClass}>
                        <Coins size={15} className="text-[rgb(var(--theme-accent))]" />
                        {t("gameSettings.customizationTitle")}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div><label className={labelClass}>{t("gameSettings.customization.renameCountry")}</label><input type="number" min={0} value={renameDucats} onChange={(e) => setRenameDucats(Math.max(0, Number(e.target.value) || 0))} className={inputClass} /></div>
                        <div><label className={labelClass}>{t("gameSettings.customization.recolor")}</label><input type="number" min={0} value={recolorDucats} onChange={(e) => setRecolorDucats(Math.max(0, Number(e.target.value) || 0))} className={inputClass} /></div>
                        <div><label className={labelClass}>{t("gameSettings.customization.flag")}</label><input type="number" min={0} value={flagDucats} onChange={(e) => setFlagDucats(Math.max(0, Number(e.target.value) || 0))} className={inputClass} /></div>
                        <div><label className={labelClass}>{t("gameSettings.customization.crest")}</label><input type="number" min={0} value={crestDucats} onChange={(e) => setCrestDucats(Math.max(0, Number(e.target.value) || 0))} className={inputClass} /></div>
                        <div><label className={labelClass}>{t("gameSettings.customization.renameHex")}</label><input type="number" min={0} value={hexRenameDucats} onChange={(e) => setHexRenameDucats(Math.max(0, Number(e.target.value) || 0))} className={inputClass} /></div>
                      </div>
                      <AppButton onClick={() => void saveCustomization()} disabled={saving} variant="primary" icon={<Save size={14} />}>
                        {t("common.save")}
                      </AppButton>
                    </div>
                  )}

                  {activeCategory === "registration" && (
                    <div className={panelClass}>
                      <div className={sectionTitleClass}>
                        <Flag size={15} className="text-[rgb(var(--theme-accent))]" />
                        {t("gameSettings.registrationTitle")}
                      </div>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2">
                        <div>
                          <div className="text-sm text-[rgb(var(--theme-text-primary))]">{t("gameSettings.registrationRequireApproval")}</div>
                          <div className={mutedTextClass}>{t("gameSettings.registrationRequireApprovalDescription")}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRequireAdminApprovalForRegistration((v) => !v)}
                          className={toggleClass(requireAdminApprovalForRegistration)}
                          aria-pressed={requireAdminApprovalForRegistration}
                          aria-label={requireAdminApprovalForRegistration ? t("gameSettings.registrationApprovalDisable") : t("gameSettings.registrationApprovalEnable")}
                        >
                          <span className={toggleKnobClass(requireAdminApprovalForRegistration)} />
                        </button>
                      </label>
                      <AppButton onClick={() => void saveRegistrationSettings()} disabled={saving} variant="primary" icon={<Save size={14} />}>
                        {t("common.save")}
                      </AppButton>
                    </div>
                  )}

                  {activeCategory === "eventLog" && (
                    <div className={panelClass}>
                      <div className={sectionTitleClass}>
                        <Coins size={15} className="text-[rgb(var(--theme-accent))]" />
                        {t("gameSettings.eventLogTitle")}
                      </div>
                      <div>
                        <label className={labelClass}>{t("gameSettings.eventLogRetention")}</label>
                        <input type="number" min={1} max={100} value={eventLogRetentionTurns} onChange={(e) => setEventLogRetentionTurns(Math.max(1, Number(e.target.value) || 1))} className={inputClass} />
                      </div>
                      <AppButton onClick={() => void saveEventLogSettings()} disabled={saving} variant="primary" icon={<Save size={14} />}>
                        {t("common.save")}
                      </AppButton>
                    </div>
                  )}

                  {activeCategory === "background" && (
                    <div className={panelClass}>
                      <div className={sectionTitleClass}>
                        <Monitor size={15} className="text-[rgb(var(--theme-accent))]" />
                        {t("gameSettings.backgroundTitle")}
                      </div>
                      <div className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] p-3">
                        <div className="mb-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("gameSettings.backgroundCurrent")}</div>
                        <div className="flex h-40 items-center justify-center overflow-hidden rounded-md border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-3))]">
                          {uiBackgroundImageUrl ? (
                            <img src={uiBackgroundImageUrl} alt={t("gameSettings.backgroundCurrent")} className="h-full w-full object-cover" />
                          ) : (
                            <div className="text-xs text-[rgb(var(--theme-text-muted))]">{t("gameSettings.backgroundEmpty")}</div>
                          )}
                        </div>
                      </div>
                      <label className="flex cursor-pointer items-center justify-center rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2 text-sm text-[rgb(var(--theme-text-primary))] transition hover:border-[rgb(var(--theme-accent))]">
                        {t("gameSettings.chooseImage")}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setUiBackgroundFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {uiBackgroundFile ? <div className="text-xs text-[rgb(var(--theme-success))]">{t("gameSettings.fileSelected", { file: uiBackgroundFile.name })}</div> : null}
                      <div className="flex flex-wrap gap-2">
                        <AppButton onClick={saveUiBackground} disabled={saving || !uiBackgroundFile} variant="primary" icon={<Save size={14} />}>
                          {t("gameSettings.backgroundUpload")}
                        </AppButton>
                        <AppButton
                          type="button"
                          onClick={clearUiBackground}
                          disabled={saving || (!uiBackgroundImageUrl && !uiBackgroundFile)}
                          variant="danger"
                        >
                          {t("gameSettings.backgroundDelete")}
                        </AppButton>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </AppSection>
          </div>
    </AppModal>
  );
}
