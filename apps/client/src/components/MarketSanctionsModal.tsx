import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  CheckCircle2,
  Clock3,
  Filter,
  Plus,
  Save,
  ShieldBan,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createMarketSanction,
  deleteMarketSanction,
  fetchCountries,
  fetchContentEntries,
  fetchMarketsCatalog,
  fetchMarketSanctions,
  updateMarketSanction,
  type MarketSanction,
} from "../lib/api";
import type { UiTextKey } from "../i18n/uiText";
import { useUiText } from "../i18n/useUiText";
import { CustomSelect } from "./CustomSelect";
import { Tooltip } from "./Tooltip";
import { AppButton } from "./ui/AppButton";
import { AppInput } from "./ui/AppForm";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState, AppSection, AppSectionHeader } from "./ui/AppSurface";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  countryId: string;
  marketId: string | null;
  onUpdated?: () => void;
};

type DraftGoodRule = {
  rowId: string;
  goodId: string;
  direction: "import" | "export" | "both";
  mode: "ban" | "cap";
  capAmount: string;
};

type StatusFilter = "all" | "active" | "expired" | "paused";
type SanctionStatus = Exclude<StatusFilter, "all">;

const directionLabel = (
  direction: DraftGoodRule["direction"] | MarketSanction["direction"],
  t: (key: UiTextKey, params?: Record<string, string | number>) => string,
): string => {
  if (direction === "import") return t("market.directionImport");
  if (direction === "export") return t("market.directionExport");
  return t("market.directionBoth");
};

const getSanctionStatus = (sanction: MarketSanction, turnId: number): SanctionStatus => {
  if (sanction.enabled === false) {
    return "paused";
  }
  if (turnId >= Number(sanction.expiresAtTurn ?? sanction.startTurn + sanction.durationTurns)) {
    return "expired";
  }
  return "active";
};

const statusChip = (
  sanction: MarketSanction,
  turnId: number,
  t: (key: UiTextKey, params?: Record<string, string | number>) => string,
): { label: string; className: string } => {
  const status = getSanctionStatus(sanction, turnId);
  if (status === "paused") return { label: t("market.statusPaused"), className: "arc-market-status-chip--paused" };
  if (status === "expired") return { label: t("market.statusExpired"), className: "arc-market-status-chip--expired" };
  return { label: t("market.statusActive"), className: "arc-market-status-chip--active" };
};

const getDirectionIcon = (direction: DraftGoodRule["direction"] | MarketSanction["direction"], className = "h-3.5 w-3.5") => {
  if (direction === "import") return <ArrowDown className={className} />;
  if (direction === "export") return <ArrowUp className={className} />;
  return <ArrowDownUp className={className} />;
};

export function MarketSanctionsModal({ open, onClose, token, countryId, marketId, onUpdated }: Props) {
  const { locale, t } = useUiText();
  const [loading, setLoading] = useState(false);
  const [ownerCountryId, setOwnerCountryId] = useState<string | null>(null);
  const [turnId, setTurnId] = useState(1);
  const [sanctions, setSanctions] = useState<MarketSanction[]>([]);
  const [countries, setCountries] = useState<Array<{ id: string; name: string; flagUrl?: string | null }>>([]);
  const [goods, setGoods] = useState<Array<{ id: string; name: string }>>([]);
  const [marketsCatalog, setMarketsCatalog] = useState<Array<{ id: string; name: string; logoUrl?: string | null }>>([]);

  const [pendingApply, setPendingApply] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [targetType, setTargetType] = useState<"country" | "market">("country");
  const [targetId, setTargetId] = useState("");
  const [duration, setDuration] = useState("30");
  const [rules, setRules] = useState<DraftGoodRule[]>([]);
  const [bulkDirection, setBulkDirection] = useState<"import" | "export" | "both">("both");
  const [bulkMode, setBulkMode] = useState<"ban" | "cap">("ban");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const isOwner = ownerCountryId === countryId;

  const load = async () => {
    if (!marketId) return;
    setLoading(true);
    try {
      const [sanctionsRes, allCountries, goodsEntries, marketsRes] = await Promise.all([
        fetchMarketSanctions(token, marketId),
        fetchCountries(),
        fetchContentEntries("goods"),
        fetchMarketsCatalog(token),
      ]);
      setSanctions(sanctionsRes.sanctions ?? []);
      setOwnerCountryId(sanctionsRes.ownerCountryId ?? null);
      setTurnId(Math.max(1, Number(sanctionsRes.turnId ?? 1)));
      setCountries((allCountries ?? []).map((row) => ({ id: row.id, name: row.name, flagUrl: row.flagUrl ?? null })));
      setGoods((goodsEntries ?? []).map((row) => ({ id: row.id, name: row.name })));
      setMarketsCatalog((marketsRes.markets ?? []).map((row) => ({ id: row.id, name: row.name, logoUrl: row.logoUrl ?? null })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("market.sanctionsLoadFailed"));
      setSanctions([]);
      setOwnerCountryId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !marketId) return;
    void load();
  }, [open, marketId]);

  useEffect(() => {
    if (!open) return;
    setStatusFilter("all");
    setConfirmOpen(false);
  }, [open]);

  const targetOptions = useMemo(() => {
    if (targetType === "country") {
      return countries
        .filter((row) => row.id !== ownerCountryId)
        .sort((a, b) => a.name.localeCompare(b.name, locale))
        .map((row) => ({ value: row.id, label: row.name }));
    }
    return marketsCatalog
      .filter((row) => row.id !== marketId)
      .sort((a, b) => a.name.localeCompare(b.name, locale))
      .map((row) => ({ value: row.id, label: row.name }));
  }, [countries, locale, targetType, ownerCountryId, marketsCatalog, marketId]);

  useEffect(() => {
    if (!targetOptions.some((option) => option.value === targetId)) {
      setTargetId(targetOptions[0]?.value ?? "");
    }
  }, [targetOptions, targetId]);

  const goodsOptions = useMemo(
    () =>
      goods
        .map((good) => ({ value: good.id, label: good.name }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [goods, locale],
  );

  useEffect(() => {
    if (rules.length > 0 || goods.length === 0) return;
    setRules([
      {
        rowId: crypto.randomUUID(),
        goodId: goods[0]?.id ?? "",
        direction: "both",
        mode: "ban",
        capAmount: "0",
      },
    ]);
  }, [goods, rules.length]);

  const targetMeta = useMemo(() => {
    if (targetType === "country") {
      const country = countries.find((row) => row.id === targetId);
      return {
        name: country?.name ?? "—",
        imageUrl: country?.flagUrl ?? null,
      };
    }
    const market = marketsCatalog.find((row) => row.id === targetId);
    return {
      name: market?.name ?? "—",
      imageUrl: market?.logoUrl ?? null,
    };
  }, [countries, marketsCatalog, targetId, targetType]);

  const getRuleError = (row: DraftGoodRule): string | null => {
    if (!row.goodId) return t("market.ruleGoodRequired");
    if (row.mode === "cap") {
      const cap = Number(row.capAmount);
      if (!Number.isFinite(cap) || cap <= 0) {
        return t("market.ruleCapRequired");
      }
    }
    return null;
  };

  const rulesWithValidation = useMemo(
    () =>
      rules.map((row) => ({
        ...row,
        error: getRuleError(row),
      })),
    [rules, t],
  );

  const validRules = useMemo(
    () => rulesWithValidation.filter((row) => !row.error),
    [rulesWithValidation],
  );

  const previewStats = useMemo(() => {
    const banCount = validRules.filter((row) => row.mode === "ban").length;
    const capRows = validRules.filter((row) => row.mode === "cap");
    const capCount = capRows.length;
    const capTotal = capRows.reduce((sum, row) => sum + Math.max(0, Number(row.capAmount || 0)), 0);
    const goodNames = validRules
      .map((row) => goods.find((g) => g.id === row.goodId)?.name ?? row.goodId)
      .slice(0, 8);
    return {
      totalRules: validRules.length,
      banCount,
      capCount,
      capTotal,
      goodNames,
      overflowCount: Math.max(0, validRules.length - goodNames.length),
    };
  }, [validRules, goods]);

  const filteredSanctions = useMemo(() => {
    return sanctions.filter((sanction) => {
      const status = getSanctionStatus(sanction, turnId);
      if (statusFilter === "all") return true;
      return status === statusFilter;
    });
  }, [sanctions, statusFilter, turnId]);

  const applyBulkDirection = () => {
    setRules((prev) => prev.map((row) => ({ ...row, direction: bulkDirection })));
  };

  const applyBulkMode = () => {
    setRules((prev) =>
      prev.map((row) => ({
        ...row,
        mode: bulkMode,
        capAmount: bulkMode === "cap" ? row.capAmount || "0" : "0",
      })),
    );
  };

  const updateRule = (rowId: string, patch: Partial<DraftGoodRule>) => {
    setRules((prev) => prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  };

  const addRule = () => {
    if (goods.length === 0) return;
    setRules((prev) => [
      ...prev,
      {
        rowId: crypto.randomUUID(),
        goodId: goods[0]?.id ?? "",
        direction: "both",
        mode: "ban",
        capAmount: "0",
      },
    ]);
  };

  const removeRule = (rowId: string) => {
    setRules((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  const applyRules = async () => {
    if (!marketId || !isOwner || !targetId) return;
    if (validRules.length === 0) {
      toast.error(t("market.noValidSanctionRules"));
      return;
    }
    setPendingApply(true);
    try {
      const durationTurns = Math.max(1, Math.floor(Number(duration || 1)));
      for (const row of validRules) {
        await createMarketSanction(token, marketId, {
          direction: row.direction,
          targetType,
          targetId,
          goods: [row.goodId],
          mode: row.mode,
          capAmountPerTurn: row.mode === "cap" ? Math.max(0, Number(row.capAmount || 0)) : null,
          durationTurns,
        });
      }
      toast.success(t("market.sanctionsAdded", { count: validRules.length }));
      setConfirmOpen(false);
      await load();
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("market.sanctionApplyFailed"));
    } finally {
      setPendingApply(false);
    }
  };

  const toggleEnabled = async (sanction: MarketSanction) => {
    if (!marketId || !isOwner) return;
    try {
      await updateMarketSanction(token, marketId, sanction.id, { enabled: sanction.enabled === false });
      await load();
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("market.sanctionUpdateFailed"));
    }
  };

  const removeSanction = async (sanctionId: string) => {
    if (!marketId || !isOwner) return;
    setPendingDeleteId(sanctionId);
    try {
      await deleteMarketSanction(token, marketId, sanctionId);
      toast.success(t("market.sanctionDeleted"));
      await load();
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("market.sanctionDeleteFailed"));
    } finally {
      setPendingDeleteId(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <AppModal
        modalKey="market-sanctions"
        open={open}
        onClose={onClose}
        zIndexClassName="z-[181]"
        panelClassName="arc-market-subpanel arc-scrollbar max-h-[min(92vh,960px)] w-[min(96vw,1460px)] overflow-auto"
        paddingClassName="p-4 md:p-6 flex items-center justify-center"
      >
            <AppModalHeader
              title={t("market.sanctionsTitle")}
              description={t("market.sanctionsDescription")}
              onClose={onClose}
            />

            {loading ? (
              <div className="arc-market-muted text-sm">{t("market.loading")}</div>
            ) : !isOwner ? (
              <AppCard className="arc-market-warning-card text-sm">{t("market.sanctionsOwnerOnly")}</AppCard>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
                <AppSection className="flex min-h-[720px] flex-col p-0">
                  <div className="arc-market-sticky sticky top-0 z-20 p-3">
                    <AppSectionHeader
                      title={t("market.sanctionBuilder")}
                      description={t("market.sanctionBuilderDescription")}
                      icon={<ShieldBan size={14} />}
                    />
                    <div className="mb-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div className="arc-market-step">{t("market.stepTarget")}</div>
                      <div className="arc-market-step">{t("market.stepGoods")}</div>
                      <div className="arc-market-step">{t("market.stepConfirm")}</div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <Tooltip content={t("market.targetTypeTooltip")}>
                        <div>
                          <CustomSelect
                            value={targetType}
                            onChange={(value) => setTargetType(value as "country" | "market")}
                            options={[
                              { value: "country", label: t("market.targetTypeCountry") },
                              { value: "market", label: t("market.targetTypeMarket") },
                            ]}
                            buttonClassName="h-9 text-xs"
                          />
                        </div>
                      </Tooltip>
                      <Tooltip content={t("market.targetSelectTooltip")}>
                        <div>
                          <CustomSelect
                            value={targetId}
                            onChange={setTargetId}
                            options={targetOptions}
                            placeholder={t("market.selectTarget")}
                            buttonClassName="h-9 text-xs"
                          />
                        </div>
                      </Tooltip>
                      <Tooltip content={t("market.durationTooltip")}>
                        <AppInput
                          value={duration}
                          onChange={(event) => setDuration(event.target.value.replace(/[^\d]/g, ""))}
                          placeholder={t("market.durationPlaceholder")}
                          className="h-9"
                        />
                      </Tooltip>
                    </div>
                    <div className="arc-market-soft-card mt-2 flex items-center gap-2 px-2 py-2 text-xs">
                      {targetMeta.imageUrl ? (
                        <img src={targetMeta.imageUrl} alt="" className="h-5 w-5 object-cover border border-[var(--arc-color-atlas-line)]" />
                      ) : (
                        <span className="h-5 w-5 border border-[var(--arc-color-atlas-line)] bg-[var(--arc-color-atlas-paper-deep)]" />
                      )}
                      <span className="max-w-[420px] truncate">{t("market.targetLabel", { target: targetMeta.name || "—" })}</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden p-3">
                    <div className="arc-market-rule-header mb-2">
                      <span>{t("market.goodColumn")}</span>
                      <span>{t("market.directionColumn")}</span>
                      <span>{t("market.modeColumn")}</span>
                      <span>{t("market.capColumn")}</span>
                      <span>{t("market.actionColumn")}</span>
                    </div>
                    <div className="arc-scrollbar h-[430px] overflow-auto pr-1">
                      <div className="space-y-2 pb-16">
                        {rulesWithValidation.map((row) => {
                          return (
                            <div
                              key={row.rowId}
                              className={`arc-market-rule-grid arc-market-rule-row ${
                                row.mode === "ban" ? "arc-market-rule-row--ban" : "arc-market-rule-row--cap"
                              } ${row.error ? "ring-1 ring-[var(--arc-color-atlas-danger)]" : ""}`}
                            >
                              <CustomSelect
                                value={row.goodId}
                                onChange={(value) => updateRule(row.rowId, { goodId: value })}
                                options={goodsOptions}
                                placeholder={t("market.goodColumn")}
                                buttonClassName="h-9 text-xs"
                              />
                              <CustomSelect
                                value={row.direction}
                                onChange={(value) =>
                                  updateRule(row.rowId, { direction: value as "import" | "export" | "both" })
                                }
                                options={[
                                  { value: "both", label: t("market.directionShortBoth") },
                                  { value: "import", label: t("market.directionImport") },
                                  { value: "export", label: t("market.directionExport") },
                                ]}
                                buttonClassName="h-9 text-xs"
                              />
                              <CustomSelect
                                value={row.mode}
                                onChange={(value) => updateRule(row.rowId, { mode: value as "ban" | "cap" })}
                                options={[
                                  { value: "ban", label: t("market.modeBan") },
                                  { value: "cap", label: t("market.modeCap") },
                                ]}
                                buttonClassName="h-9 text-xs"
                              />
                              <AppInput
                                value={row.capAmount}
                                disabled={row.mode !== "cap"}
                                onChange={(event) =>
                                  updateRule(row.rowId, { capAmount: event.target.value.replace(/[^\d.]/g, "") })
                                }
                                placeholder={t("market.capColumn")}
                                invalid={Boolean(row.error)}
                                className="h-9"
                              />
                              <AppButton
                                type="button"
                                onClick={() => removeRule(row.rowId)}
                                variant="danger"
                                size="icon"
                                className="h-9 w-9"
                              >
                                <Trash2 size={12} />
                              </AppButton>
                              {row.error && (
                                <div className="col-span-5 -mt-1 text-[11px] font-semibold text-[var(--arc-color-atlas-danger)]">{row.error}</div>
                              )}
                            </div>
                          );
                        })}
                        {rulesWithValidation.length === 0 && (
                          <AppEmptyState className="text-xs">{t("market.addRuleEmpty")}</AppEmptyState>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="arc-market-sticky sticky bottom-0 z-20 border-t p-3">
                    <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <Tooltip content={t("market.bulkDirectionTooltip")}>
                        <div className="arc-market-soft-card flex items-center gap-2 px-2 py-2">
                          <CustomSelect
                            value={bulkDirection}
                            onChange={(value) => setBulkDirection(value as "import" | "export" | "both")}
                            options={[
                              { value: "both", label: t("market.directionBoth") },
                              { value: "import", label: t("market.directionImport") },
                              { value: "export", label: t("market.directionExport") },
                            ]}
                            buttonClassName="h-8 text-xs"
                          />
                          <AppButton
                            type="button"
                            onClick={applyBulkDirection}
                            variant="secondary"
                            size="sm"
                            className="h-8"
                          >
                            {t("market.applyAll")}
                          </AppButton>
                        </div>
                      </Tooltip>
                      <Tooltip content={t("market.bulkModeTooltip")}>
                        <div className="arc-market-soft-card flex items-center gap-2 px-2 py-2">
                          <CustomSelect
                            value={bulkMode}
                            onChange={(value) => setBulkMode(value as "ban" | "cap")}
                            options={[
                              { value: "ban", label: t("market.modeBan") },
                              { value: "cap", label: t("market.modeCap") },
                            ]}
                            buttonClassName="h-8 text-xs"
                          />
                          <AppButton
                            type="button"
                            onClick={applyBulkMode}
                            variant="secondary"
                            size="sm"
                            className="h-8"
                          >
                            {t("market.applyAll")}
                          </AppButton>
                        </div>
                      </Tooltip>
                      <AppButton
                        type="button"
                        onClick={addRule}
                        variant="primary"
                        size="md"
                        icon={<Plus size={13} />}
                      >
                        {t("market.addGood")}
                      </AppButton>
                    </div>
                    <div className="flex items-center justify-end">
                      <AppButton
                        type="button"
                        disabled={!targetId || validRules.length === 0}
                        onClick={() => setConfirmOpen(true)}
                        variant="primary"
                        size="md"
                        icon={<Save size={13} />}
                      >
                        {t("market.applyPackage")}
                      </AppButton>
                    </div>
                  </div>
                </AppSection>

                <AppSection className="flex min-h-[720px] flex-col p-0">
                  <div className="arc-market-sticky sticky top-0 z-20 p-3">
                    <AppSectionHeader title={t("market.sanctionsListTitle")} description={t("market.sanctionsListDescription")} icon={<Filter size={14} />} className="mb-0" />
                  </div>

                  <div className="arc-market-sticky sticky top-[57px] z-10 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="arc-market-section-title">
                        <Filter size={14} className="text-[var(--arc-color-atlas-primary)]" />
                        {t("market.sanctionList")}
                      </div>
                      <CustomSelect
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value as StatusFilter)}
                        options={[
                          { value: "all", label: t("market.statusAll") },
                          { value: "active", label: t("market.statusActive") },
                          { value: "expired", label: t("market.statusExpired") },
                          { value: "paused", label: t("market.statusPaused") },
                        ]}
                        buttonClassName="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="arc-scrollbar flex-1 overflow-auto p-3">
                    <div className="space-y-2">
                      {filteredSanctions.map((sanction) => {
                        const badge = statusChip(sanction, turnId, t);
                        const expiresAtTurn = Number(sanction.expiresAtTurn ?? sanction.startTurn + sanction.durationTurns);
                        const turnsLeft = Math.max(0, expiresAtTurn - turnId);
                        return (
                          <AppCard
                            key={sanction.id}
                            className="arc-market-soft-card p-2 text-xs transition-all duration-150 hover:-translate-y-[1px]"
                          >
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 font-semibold text-[var(--arc-color-atlas-ink)]">
                                  {getDirectionIcon(sanction.direction)}
                                  <span>{directionLabel(sanction.direction, t)}</span>
                                  <span className="arc-market-muted">·</span>
                                  <span>{sanction.mode === "ban" ? t("market.modeBan") : t("market.limitWithAmount", { amount: sanction.capAmountPerTurn ?? 0 })}</span>
                                </div>
                                <div className="arc-market-muted truncate">
                                  {t("market.targetValue", {
                                    type: sanction.targetType === "country" ? t("market.targetCountry") : t("market.targetMarket"),
                                    target: sanction.targetName ?? sanction.targetId,
                                  })}
                                </div>
                              </div>
                              <span className={`arc-market-status-chip ${badge.className}`}>{badge.label}</span>
                            </div>
                            <div className="arc-market-muted mb-2 flex items-center gap-3 text-[11px]">
                              <span className="inline-flex items-center gap-1">
                                <Clock3 size={12} />
                                {t("market.turnsLeft", { turns: turnsLeft })}
                              </span>
                              <span>{t("market.period", { from: sanction.startTurn, to: expiresAtTurn })}</span>
                            </div>
                            <div className="mb-2 flex flex-wrap gap-1">
                              {(sanction.goodsNamed ?? []).map((good) => (
                                <span key={good.id} className="arc-market-status-chip">
                                  {good.name}
                                </span>
                              ))}
                              {(sanction.goodsNamed?.length ?? 0) === 0 && (
                                <span className="arc-market-status-chip">{t("market.allGoods")}</span>
                              )}
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <AppButton
                                type="button"
                                onClick={() => void toggleEnabled(sanction)}
                                variant="ghost"
                                size="sm"
                                className="h-8"
                              >
                                {sanction.enabled === false ? t("market.enable") : t("market.disable")}
                              </AppButton>
                              <AppButton
                                type="button"
                                disabled={pendingDeleteId === sanction.id}
                                onClick={() => void removeSanction(sanction.id)}
                                variant="danger"
                                size="sm"
                                className="h-8"
                              >
                                {t("market.delete")}
                              </AppButton>
                            </div>
                          </AppCard>
                        );
                      })}
                      {filteredSanctions.length === 0 && (
                        <AppEmptyState className="text-xs">{t("market.filterNoResults")}</AppEmptyState>
                      )}
                    </div>
                  </div>
                </AppSection>
              </div>
            )}
      </AppModal>

      <AppModal
        modalKey="market-sanctions"
        open={confirmOpen}
        onClose={() => (pendingApply ? undefined : setConfirmOpen(false))}
        zIndexClassName="z-[182]"
        panelClassName="arc-market-subpanel w-[min(92vw,520px)]"
        paddingClassName="p-4 md:p-6 flex items-center justify-center"
      >
            <AppModalHeader title={t("market.confirmationTitle")} onClose={() => setConfirmOpen(false)} closeDisabled={pendingApply} />
            <AppCard className="arc-market-soft-card text-sm">
              {t("market.sanctionsAdded", { count: validRules.length })}
            </AppCard>
            <div className="mt-3 flex items-center justify-end gap-2">
              <AppButton
                type="button"
                disabled={pendingApply}
                onClick={() => setConfirmOpen(false)}
                variant="ghost"
                size="sm"
              >
                {t("common.cancel")}
              </AppButton>
              <AppButton
                type="button"
                disabled={pendingApply}
                onClick={() => void applyRules()}
                variant="primary"
                size="sm"
                icon={<Save size={13} />}
              >
                {t("market.apply")}
              </AppButton>
            </div>
      </AppModal>
    </>
  );
}
