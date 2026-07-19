import { Listbox } from "@headlessui/react";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, ChevronDown, Flag, Map as MapIcon, Palette, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Country } from "@arcanorum/shared";
import type { UiTextKey } from "../i18n/uiText";
import { useUiText } from "../i18n/useUiText";
import {
  adminBroadcastUiNotification,
  adminDeleteCountry,
  adminResetRegionColonizationCostToAuto,
  adminSetCountryPunishment,
  adminUpdateCountry,
  adminUpdateRegion,
  fetchAdminRegions,
  fetchAdminHexes,
  fetchCountries,
  type AdminHexItem,
  type AdminRegionItem,
} from "../lib/api";
import { AppButton } from "./templates/AppButton";
import { AppModal, AppModalHeader } from "./templates/AppModal";
import { AppSection } from "./templates/AppSurface";

type Props = {
  open: boolean;
  token: string;
  currentCountryId: string;
  onClose: () => void;
  onSessionCountryUpdated: (country: Country) => void;
  initialHexId?: string | null;
};

const categories = [
  { id: "countries", labelKey: "adminPanel.category.countries", icon: Flag },
  { id: "provinces", labelKey: "adminPanel.category.provinces", icon: MapIcon },
  { id: "notifications", labelKey: "adminPanel.category.notifications", icon: BellRing },
] as const;

const panelClass = "rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-4";
const nestedPanelClass = "rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] p-4";
const inputClass = "w-full rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2 text-sm text-[rgb(var(--theme-text-primary))]";
const labelClass = "mb-1 block text-xs text-[rgb(var(--theme-text-secondary))]";
const listboxButtonClass = "w-full rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2 pr-10 text-left text-sm text-[rgb(var(--theme-text-primary))]";
const listboxOptionsClass = "arc-scrollbar absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-1 text-sm shadow-2xl outline-none";
const optionClass = (active: boolean) =>
  `relative cursor-pointer rounded-md px-3 py-2 pr-9 transition ${active ? "bg-[rgb(var(--theme-accent-soft))] text-[rgb(var(--theme-accent))]" : "text-[rgb(var(--theme-text-secondary))]"}`;

const broadcastCategoryOptions: Array<{ id: "system" | "politics" | "economy"; labelKey: UiTextKey }> = [
  { id: "system", labelKey: "notifications.category.system" },
  { id: "politics", labelKey: "notifications.category.politics" },
  { id: "economy", labelKey: "notifications.category.economy" },
];

export function AdminPanel({ open, token, currentCountryId, onClose, onSessionCountryUpdated, initialHexId }: Props) {
  const { t, locale } = useUiText();
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]["id"]>("countries");
  const [countrySection, setCountrySection] = useState<"general" | "punishments">("general");
  const [countries, setCountries] = useState<Country[]>([]);
  const [hexes, setHexes] = useState<AdminHexItem[]>([]);
  const [regions, setRegions] = useState<AdminRegionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [countryName, setCountryName] = useState("");
  const [countryColor, setCountryColor] = useState("#4ade80");
  const [isAdmin, setIsAdmin] = useState(false);
  const [flagFile, setFlagFile] = useState<File | null>(null);
  const [crestFile, setCrestFile] = useState<File | null>(null);
  const [flagPreviewUrl, setFlagPreviewUrl] = useState<string | null>(null);
  const [crestPreviewUrl, setCrestPreviewUrl] = useState<string | null>(null);
  const [turnsToBlock, setTurnsToBlock] = useState(3);
  const [blockUntilAt, setBlockUntilAt] = useState("");
  const [punishmentReasonText, setPunishmentReasonText] = useState("");
  const [ignoreUntilTurn, setIgnoreUntilTurn] = useState(0);
  const [marketId, setMarketId] = useState<string>("");
  const [selectedHexId, setSelectedHexId] = useState<string>("");
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [hexOwnerCountryId, setHexOwnerCountryId] = useState<string>("");
  const [regionColonizationCost, setRegionColonizationCost] = useState(100);
  const [regionColonizationDisabled, setRegionColonizationDisabled] = useState(false);
  const [provinceSearch, setHexSearch] = useState("");
  const [broadcastCategory, setBroadcastCategory] = useState<"system" | "politics" | "economy">("system");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const selectedCountry = useMemo(() => countries.find((c) => c.id === selectedCountryId) ?? null, [countries, selectedCountryId]);
  const selectedHex = useMemo(() => hexes.find((hex) => hex.id === selectedHexId) ?? null, [hexes, selectedHexId]);
  const selectedRegion = useMemo(() => regions.find((region) => region.id === selectedRegionId) ?? null, [regions, selectedRegionId]);
  const selectedHexOwner = useMemo(() => countries.find((c) => c.id === hexOwnerCountryId) ?? null, [countries, hexOwnerCountryId]);
  const filteredHexes = useMemo(() => {
    const q = provinceSearch.trim().toLowerCase();
    if (!q) return hexes;
    return hexes.filter((hex) => hex.name.toLowerCase().includes(q) || hex.id.toLowerCase().includes(q));
  }, [provinceSearch, hexes]);

  const punishmentStatus = useMemo(() => {
    if (!selectedCountry) {
      return "";
    }

    if (selectedCountry.isLocked) {
      return t("adminPanel.punishmentStatus.permanent");
    }

    if (selectedCountry.blockedUntilTurn) {
      return t("adminPanel.punishmentStatus.untilTurn", { turn: selectedCountry.blockedUntilTurn });
    }

    if (selectedCountry.blockedUntilAt) {
      return t("adminPanel.punishmentStatus.untilTime", { time: new Date(selectedCountry.blockedUntilAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US") });
    }


    if (selectedCountry.ignoreUntilTurn) {
      return t("adminPanel.punishmentStatus.ignoredUntilTurn", { turn: selectedCountry.ignoreUntilTurn });
    }

    return t("adminPanel.punishmentStatus.none");
  }, [locale, selectedCountry, t]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([fetchCountries(), fetchAdminHexes(token), fetchAdminRegions(token)])
      .then(([countryList, provinceList, regionList]) => {
        if (cancelled) {
          return;
        }
        setCountries(countryList);
        setHexes(provinceList);
        setRegions(regionList);
        if (!selectedCountryId && countryList.length > 0) {
          setSelectedCountryId(countryList[0].id);
        }
        if (!selectedHexId && provinceList.length > 0) {
          setSelectedHexId(provinceList[0].id);
        }
        if (!selectedRegionId && regionList.length > 0) {
          const regionIdFromInitialHex = initialHexId
            ? provinceList.find((province) => province.id === initialHexId)?.regionId
            : null;
          setSelectedRegionId(regionIdFromInitialHex ?? regionList[0].id);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialHexId, open, token]);

  useEffect(() => {
    if (!selectedCountry) {
      return;
    }
    setCountryName(selectedCountry.name);
    setCountryColor(selectedCountry.color);
    setIsAdmin(Boolean(selectedCountry.isAdmin));
    setFlagFile(null);
    setCrestFile(null);
    setFlagPreviewUrl(selectedCountry.flagUrl ?? null);
    setCrestPreviewUrl(selectedCountry.crestUrl ?? null);
    setIgnoreUntilTurn(selectedCountry.ignoreUntilTurn ?? 0);
    setMarketId(selectedCountry.marketId ?? selectedCountry.id);
    setPunishmentReasonText(selectedCountry.lockReason ?? "");
  }, [selectedCountryId, selectedCountry]);

  useEffect(() => {
    if (!selectedRegion) {
      return;
    }
    setHexOwnerCountryId(selectedRegion.ownerCountryId ?? "");
    setRegionColonizationCost(selectedRegion.colonizationCost);
    setRegionColonizationDisabled(selectedRegion.colonizationDisabled);
  }, [selectedRegion]);

  useEffect(() => {
    if (!open || !initialHexId) {
      return;
    }
    setActiveCategory("provinces");
    setSelectedHexId(initialHexId);
    const regionId = hexes.find((hex) => hex.id === initialHexId)?.regionId;
    if (regionId) {
      setSelectedRegionId(regionId);
    }
  }, [initialHexId, open, hexes]);

  useEffect(() => {
    if (!flagFile) {
      return;
    }
    const url = URL.createObjectURL(flagFile);
    setFlagPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [flagFile]);

  useEffect(() => {
    if (!crestFile) {
      return;
    }
    const url = URL.createObjectURL(crestFile);
    setCrestPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [crestFile]);

  const saveCountry = async () => {
    if (!selectedCountry) {
      return;
    }

    setSaving(true);
    try {
      const updated = await adminUpdateCountry(token, selectedCountry.id, {
        countryName,
        countryColor,
        isAdmin,
        marketId: marketId === selectedCountry.id ? null : marketId,
        flagFile,
        crestFile,
      });

      setCountries((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (updated.id === currentCountryId) {
        onSessionCountryUpdated(updated);
      }
      toast.success(t("adminPanel.countryUpdated"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "COUNTRY_UPDATE_FAILED";
      if (msg === "IMAGE_DIMENSIONS_TOO_LARGE") {
        toast.error(t("auth.imageFormatInvalid"));
      } else {
        toast.error(t("adminPanel.countryUpdateFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const applyPunishment = async (payload: { action: "unlock" } | { action: "permanent" } | { action: "turns"; turns: number } | { action: "time"; blockedUntilAt: string }) => {
    if (!selectedCountry) {
      return;
    }

    setSaving(true);
    try {
      const updated = await adminSetCountryPunishment(token, selectedCountry.id, {
        ...payload,
        reasonText: punishmentReasonText.trim() || undefined,
      });
      setCountries((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (updated.id === currentCountryId) {
        onSessionCountryUpdated(updated);
      }
      toast.success(t("adminPanel.punishmentUpdated"));
    } catch {
      toast.error(t("adminPanel.punishmentUpdateFailed"));
    } finally {
      setSaving(false);
    }
  };


  const saveIgnoreUntilTurn = async (value: number | null) => {
    if (!selectedCountry) {
      return;
    }

    setSaving(true);
    try {
      const updated = await adminUpdateCountry(token, selectedCountry.id, { ignoreUntilTurn: value });
      setCountries((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (updated.id === currentCountryId) {
        onSessionCountryUpdated(updated);
      }
      setIgnoreUntilTurn(updated.ignoreUntilTurn ?? 0);
      toast.success(t("adminPanel.ignoreUpdated"));
    } catch {
      toast.error(t("adminPanel.ignoreUpdateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const deleteCountry = async () => {
    if (!selectedCountry) {
      return;
    }

    const confirmed = window.confirm(t("adminPanel.deleteCountryConfirm", { country: selectedCountry.name }));
    if (!confirmed) {
      return;
    }

    setSaving(true);
    try {
      await adminDeleteCountry(token, selectedCountry.id);
      setCountries((prev) => prev.filter((c) => c.id !== selectedCountry.id));
      const next = countries.find((c) => c.id !== selectedCountry.id);
      setSelectedCountryId(next?.id ?? "");
      toast.success(t("adminPanel.countryDeleted"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "COUNTRY_DELETE_FAILED";
      if (msg === "CANNOT_DELETE_SELF") {
        toast.error(t("adminPanel.countryDeleteSelfFailed"));
      } else {
        toast.error(t("adminPanel.countryDeleteFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const saveHex = async () => {
    if (!selectedRegion) {
      return;
    }
    setSaving(true);
    try {
      const updated = await adminUpdateRegion(token, selectedRegion.id, {
        colonizationCost: Math.max(1, Math.floor(regionColonizationCost)),
        colonizationDisabled: regionColonizationDisabled,
        ownerCountryId: hexOwnerCountryId.trim() === "" ? null : hexOwnerCountryId,
      });
      setRegions((prev) => prev.map((region) => (region.id === updated.id ? { ...region, ...updated } : region)));
      toast.success(t("adminPanel.regionUpdated"));
    } catch {
      toast.error(t("adminPanel.regionUpdateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const resetHexCostToAuto = async () => {
    if (!selectedRegion) return;
    setSaving(true);
    try {
      const updated = await adminResetRegionColonizationCostToAuto(token, selectedRegion.id);
      setRegions((prev) => prev.map((region) => (region.id === updated.id ? { ...region, ...updated } : region)));
      toast.success(t("adminPanel.regionCostReset"));
    } catch {
      toast.error(t("adminPanel.regionCostResetFailed"));
    } finally {
      setSaving(false);
    }
  };

  const sendBroadcastNotification = async () => {
    const title = broadcastTitle.trim();
    const message = broadcastMessage.trim();
    if (!title || !message) {
      toast.error(t("adminPanel.broadcastMissingFields"));
      return;
    }
    setSaving(true);
    try {
      await adminBroadcastUiNotification(token, {
        category: broadcastCategory,
        title,
        message,
      });
      setBroadcastTitle("");
      setBroadcastMessage("");
      toast.success(t("adminPanel.broadcastSent"));
    } catch {
      toast.error(t("adminPanel.broadcastFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal open={open} onClose={onClose} modalKey="admin" zIndexClassName="z-[120]" paddingClassName="p-4" panelClassName="rounded-none">
          <AppModalHeader title={t("shell.adminPanel")} onClose={onClose} />

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

            <div className="flex min-h-0 flex-col gap-3">
              {activeCategory === "countries" && selectedCountry && (
                <div className="rounded-xl border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                  <div className="mb-2 px-1 text-[11px] uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("adminPanel.countrySection")}</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCountrySection("general")}
                      className={`inline-flex items-center border-b px-1 py-1.5 text-xs font-medium transition ${
                        countrySection === "general"
                          ? "border-[rgb(var(--theme-accent))] text-[rgb(var(--theme-accent))]"
                          : "border-transparent text-[rgb(var(--theme-text-secondary))] hover:text-[rgb(var(--theme-text-primary))]"
                      }`}
                    >
                      {t("adminPanel.countryGeneral")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCountrySection("punishments")}
                      className={`inline-flex items-center border-b px-1 py-1.5 text-xs font-medium transition ${
                        countrySection === "punishments"
                          ? "border-[rgb(var(--theme-danger))] text-[rgb(var(--theme-danger))]"
                          : "border-transparent text-[rgb(var(--theme-text-secondary))] hover:text-[rgb(var(--theme-text-primary))]"
                      }`}
                    >
                      {t("adminPanel.countryPunishments")}
                    </button>
                  </div>
                </div>
              )}

              <AppSection className="arc-scrollbar overflow-auto p-4">
                {loading ? (
                  <div className="text-sm text-[rgb(var(--theme-text-muted))]">{t("adminPanel.loadingCountries")}</div>
                ) : (
                  <div className="space-y-4">
                  {activeCategory === "provinces" && (
                    <>
                      <div>
                        <label className={labelClass}>{t("modifiers.scope.province")}</label>
                        <input
                          value={provinceSearch}
                          onChange={(e) => setHexSearch(e.target.value)}
                          placeholder={t("adminPanel.provinceSearchPlaceholder")}
                          className={`mb-2 ${inputClass}`}
                        />
                        <Listbox
                          value={selectedHexId}
                          onChange={(hexId) => {
                            setSelectedHexId(hexId);
                            const regionId = hexes.find((hex) => hex.id === hexId)?.regionId;
                            if (regionId) {
                              setSelectedRegionId(regionId);
                            }
                          }}
                        >
                          <div className="relative">
                            <Listbox.Button className={listboxButtonClass}>
                              {selectedHex ? `${selectedHex.name} (${selectedHex.id})` : t("adminPanel.selectHex")}
                              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-text-muted))]" />
                            </Listbox.Button>
                            <Listbox.Options className={listboxOptionsClass}>
                              {filteredHexes.map((hex) => (
                                <Listbox.Option
                                  key={hex.id}
                                  value={hex.id}
                                  className={({ active }) => optionClass(active)}
                                >
                                  {({ selected }) => (
                                    <>
                                      <div className={selected ? "text-[rgb(var(--theme-accent))]" : ""}>{hex.name}</div>
                                      <div className="text-[11px] text-[rgb(var(--theme-text-muted))]">{hex.id}</div>
                                      {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-accent))]" />}
                                    </>
                                  )}
                                </Listbox.Option>
                              ))}
                              {filteredHexes.length === 0 && (
                                <div className="px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("civilopedia.noResults")}</div>
                              )}
                            </Listbox.Options>
                          </div>
                        </Listbox>
                        <div className="mt-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("adminPanel.autoCostHint")}</div>
                      </div>

                      {selectedHex && (
                        <div className="space-y-4 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                          <div className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2 text-xs text-[rgb(var(--theme-text-secondary))]">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              <span>{t("adminPanel.idLabel")} <span className="text-[rgb(var(--theme-text-primary))]">{selectedHex.id}</span></span>
                              <span>
                                {t("provinceTooltip.area")}: <span className="text-[rgb(var(--theme-text-primary))]">{new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(Math.round(selectedHex.areaKm2 ?? 0))} km2</span>
                              </span>
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className={labelClass}>{t("adminPanel.colonizationCost")}</label>
                              <input
                                type="number"
                                min={1}
                                value={regionColonizationCost}
                                onChange={(e) => setRegionColonizationCost(Math.max(1, Number(e.target.value) || 1))}
                                className={inputClass}
                              />
                              <div className="mt-1 flex items-center gap-2 text-[11px] text-[rgb(var(--theme-text-muted))]">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                                    selectedRegion?.manualCost
                                      ? "border-[rgb(var(--theme-warning))] bg-[rgb(var(--theme-warning-soft))] text-[rgb(var(--theme-warning))]"
                                      : "border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] text-[rgb(var(--theme-success))]"
                                  }`}
                                >
                                  {selectedRegion?.manualCost ? t("adminPanel.manualCost") : t("adminPanel.autoCost")}
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className={labelClass}>{t("provinceTooltip.owner")}</label>
                              <Listbox value={hexOwnerCountryId} onChange={setHexOwnerCountryId}>
                                <div className="relative">
                                  <Listbox.Button className={listboxButtonClass}>
                                    {hexOwnerCountryId ? (selectedHexOwner?.name ?? hexOwnerCountryId) : t("adminPanel.neutralHex")}
                                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-text-muted))]" />
                                  </Listbox.Button>
                                  <Listbox.Options className={listboxOptionsClass}>
                                    <Listbox.Option
                                      value=""
                                      className={({ active }) => optionClass(active)}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className={selected ? "text-[rgb(var(--theme-accent))]" : ""}>{t("adminPanel.neutralHex")}</span>
                                          {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-accent))]" />}
                                        </>
                                      )}
                                    </Listbox.Option>
                                    {countries.map((country) => (
                                      <Listbox.Option
                                        key={country.id}
                                        value={country.id}
                                        className={({ active }) => optionClass(active)}
                                      >
                                        {({ selected }) => (
                                          <>
                                            <div className="flex items-center gap-2">
                                              {country.flagUrl ? (
                                                <img src={country.flagUrl} alt="" className="h-4 w-5 rounded-sm object-cover" />
                                              ) : (
                                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: country.color }} />
                                              )}
                                              <span className={selected ? "text-[rgb(var(--theme-accent))]" : ""}>{country.name}</span>
                                            </div>
                                            {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-accent))]" />}
                                          </>
                                        )}
                                      </Listbox.Option>
                                    ))}
                                  </Listbox.Options>
                                </div>
                              </Listbox>
                            </div>
                          </div>

                          <label className="inline-flex items-center gap-2 text-xs text-[rgb(var(--theme-text-secondary))]">
                            <input
                              type="checkbox"
                              checked={regionColonizationDisabled}
                              onChange={(e) => setRegionColonizationDisabled(e.target.checked)}
                              className="accent-[rgb(var(--theme-accent))]"
                            />
                            {t("adminPanel.disableColonization")}
                          </label>

                          <div className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] p-2 text-xs text-[rgb(var(--theme-text-secondary))]">
                            <div>{t("adminPanel.colonyRaceParticipants", { count: Object.keys(selectedRegion?.colonyProgressByCountry ?? {}).length })}</div>
                            {Object.entries(selectedRegion?.colonyProgressByCountry ?? {}).slice(0, 8).map(([countryId, progress]) => (
                              <div key={countryId} className="flex items-center justify-between">
                                <span>{countries.find((c) => c.id === countryId)?.name ?? countryId}</span>
                                <span>{progress.toFixed(1)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={resetHexCostToAuto}
                              disabled={saving || !selectedRegion}
                              className="inline-flex items-center gap-2 rounded-lg border border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] px-3 py-2 text-sm text-[rgb(var(--theme-success))] transition hover:brightness-110 disabled:opacity-60"
                            >
                              <RotateCcw size={14} />
                              {t("adminPanel.resetCostToAuto")}
                            </button>
                            <button onClick={saveHex} disabled={saving || !selectedRegion} className="rounded-lg bg-[rgb(var(--theme-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--theme-accent-contrast))] disabled:opacity-60">
                              {t("adminPanel.saveHex")}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {activeCategory === "notifications" && (
                    <div className={`space-y-4 ${panelClass}`}>
                      <div className="flex items-center gap-2 text-sm text-[rgb(var(--theme-text-primary))]">
                        <BellRing size={16} className="text-[rgb(var(--theme-accent))]" />
                        {t("adminPanel.broadcastTitle")}
                      </div>
                      <div className="text-xs text-[rgb(var(--theme-text-muted))]">
                        {t("adminPanel.broadcastDescription")} <span className="text-[rgb(var(--theme-warning))]">registration</span>
                      </div>

                      <div>
                        <label className={labelClass}>{t("eventLog.category")}</label>
                        <Listbox value={broadcastCategory} onChange={setBroadcastCategory}>
                          <div className="relative">
                            <Listbox.Button className={listboxButtonClass}>
                              {t(broadcastCategoryOptions.find((option) => option.id === broadcastCategory)?.labelKey ?? "notifications.category.system")}
                              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-text-muted))]" />
                            </Listbox.Button>
                            <Listbox.Options className={listboxOptionsClass}>
                              {broadcastCategoryOptions.map((option) => (
                                <Listbox.Option
                                  key={option.id}
                                  value={option.id}
                                  className={({ active }) => optionClass(active)}
                                >
                                  {({ selected }) => (
                                    <>
                                      <span className={selected ? "text-[rgb(var(--theme-accent))]" : ""}>{t(option.labelKey)}</span>
                                      {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-accent))]" />}
                                    </>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </div>
                        </Listbox>
                      </div>

                      <div>
                        <label className={labelClass}>{t("adminPanel.broadcastFieldTitle")}</label>
                        <input
                          value={broadcastTitle}
                          onChange={(e) => setBroadcastTitle(e.target.value.slice(0, 120))}
                          placeholder={t("adminPanel.broadcastTitlePlaceholder")}
                          className={inputClass}
                        />
                        <div className="mt-1 text-[11px] text-[rgb(var(--theme-text-muted))]">{broadcastTitle.length}/120</div>
                      </div>

                      <div>
                        <label className={labelClass}>{t("adminPanel.broadcastMessage")}</label>
                        <textarea
                          value={broadcastMessage}
                          onChange={(e) => setBroadcastMessage(e.target.value.slice(0, 500))}
                          rows={4}
                          placeholder={t("adminPanel.broadcastMessagePlaceholder")}
                          className={inputClass}
                        />
                        <div className="mt-1 text-[11px] text-[rgb(var(--theme-text-muted))]">{broadcastMessage.length}/500</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={sendBroadcastNotification}
                          disabled={saving || !broadcastTitle.trim() || !broadcastMessage.trim()}
                          className="rounded-lg bg-[rgb(var(--theme-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--theme-accent-contrast))] disabled:opacity-60"
                        >
                          {t("adminPanel.broadcastSend")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBroadcastTitle("");
                            setBroadcastMessage("");
                            setBroadcastCategory("system");
                          }}
                          disabled={saving}
                          className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-4 py-2 text-sm font-semibold text-[rgb(var(--theme-text-primary))] disabled:opacity-60"
                        >
                          {t("eventLog.clear")}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeCategory === "countries" && (
                  <>
                  <div>
                    <label className={labelClass}>{t("auth.country")}</label>
                    <Listbox value={selectedCountryId} onChange={setSelectedCountryId}>
                      <div className="relative">
                        <Listbox.Button className={listboxButtonClass}>
                          {selectedCountry?.name ?? t("adminPanel.selectCountry")}
                          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-text-muted))]" />
                        </Listbox.Button>
                        <Listbox.Options className={listboxOptionsClass}>
                          {countries.map((country) => (
                            <Listbox.Option
                              key={country.id}
                              value={country.id}
                              className={({ active }) => optionClass(active)}
                            >
                              {({ selected }) => (
                                <>
                                  <span className={selected ? "text-[rgb(var(--theme-accent))]" : ""}>{country.name}</span>
                                  {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-accent))]" />}
                                </>
                              )}
                            </Listbox.Option>
                          ))}
                        </Listbox.Options>
                      </div>
                    </Listbox>
                  </div>

                  {selectedCountry && (
                    <>
                      {countrySection === "general" && (
                        <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className={labelClass}>{t("auth.countryName")}</label>
                          <input value={countryName} onChange={(e) => setCountryName(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-2 text-xs text-[rgb(var(--theme-text-secondary))]"><Palette size={13} /> {t("auth.countryColor")}</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={countryColor} onChange={(e) => setCountryColor(e.target.value)} className="h-10 w-12 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] p-1" />
                            <input value={countryColor} onChange={(e) => setCountryColor(e.target.value)} className={inputClass} />
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>{t("adminPanel.countryMarket")}</label>
                          <select
                            value={marketId}
                            onChange={(e) => setMarketId(e.target.value)}
                            className={inputClass}
                          >
                            {countries.map((country) => (
                              <option key={country.id} value={country.id}>
                                {country.name}
                              </option>
                            ))}
                          </select>
                          <div className="mt-1 text-[11px] text-[rgb(var(--theme-text-muted))]">{t("adminPanel.countryMarketHint")}</div>
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-xs text-[rgb(var(--theme-text-secondary))]">
                        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="accent-[rgb(var(--theme-accent))]" />
                        {t("adminPanel.countryIsAdmin")}
                      </label>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2 text-sm text-[rgb(var(--theme-text-primary))] transition hover:border-[rgb(var(--theme-accent))]">
                          <Upload size={15} className="text-[rgb(var(--theme-accent))]" />
                          <span className="truncate">{flagFile ? flagFile.name : t("adminPanel.uploadFlag")}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => setFlagFile(e.target.files?.[0] ?? null)} />
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2 text-sm text-[rgb(var(--theme-text-primary))] transition hover:border-[rgb(var(--theme-accent))]">
                          <Upload size={15} className="text-[rgb(var(--theme-accent))]" />
                          <span className="truncate">{crestFile ? crestFile.name : t("adminPanel.uploadCrest")}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => setCrestFile(e.target.files?.[0] ?? null)} />
                        </label>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] p-2">
                          <div className="mb-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("auth.flag")}</div>
                          <div className="h-24 rounded-md bg-[rgb(var(--theme-surface-3))]">
                            {flagPreviewUrl ? <img src={flagPreviewUrl} alt={t("auth.flag")} className="h-full w-full object-contain p-1" /> : <div className="flex h-full items-center justify-center text-xs text-[rgb(var(--theme-text-muted))]">{t("gameSettings.no")}</div>}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] p-2">
                          <div className="mb-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("auth.crest")}</div>
                          <div className="h-24 rounded-md bg-[rgb(var(--theme-surface-3))]">
                            {crestPreviewUrl ? <img src={crestPreviewUrl} alt={t("auth.crest")} className="h-full w-full object-contain p-1" /> : <div className="flex h-full items-center justify-center text-xs text-[rgb(var(--theme-text-muted))]">{t("gameSettings.no")}</div>}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button onClick={saveCountry} disabled={saving} className="rounded-lg bg-[rgb(var(--theme-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--theme-accent-contrast))] disabled:opacity-60">
                          {t("adminPanel.saveChanges")}
                        </button>
                        <button onClick={deleteCountry} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--theme-danger-soft))] px-4 py-2 text-sm font-semibold text-[rgb(var(--theme-danger))] disabled:opacity-60">
                          <Trash2 size={14} />
                          {t("adminPanel.deleteCountry")}
                        </button>
                      </div>
                        </>
                      )}

                      {countrySection === "punishments" && (
                        <div className="space-y-4">
                          <div className={nestedPanelClass}>
                            <div className="mb-2 text-[11px] uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("adminPanel.currentStatus")}</div>
                            <div className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] px-3 py-2 text-sm text-[rgb(var(--theme-text-secondary))]">
                              <span className="text-[rgb(var(--theme-text-primary))]">{t("adminPanel.stateLabel")}</span>{" "}
                              <span className="font-medium text-[rgb(var(--theme-accent))]">{punishmentStatus}</span>
                            </div>
                          </div>

                          <div className={nestedPanelClass}>
                            <div className="mb-3 text-[11px] uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("adminPanel.punishmentReasonSection")}</div>
                            <label className={labelClass}>{t("adminPanel.punishmentReasonLabel")}</label>
                            <textarea
                              value={punishmentReasonText}
                              onChange={(e) => setPunishmentReasonText(e.target.value.slice(0, 300))}
                              rows={3}
                              placeholder={t("adminPanel.punishmentReasonPlaceholder")}
                              className="w-full rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2 text-sm text-[rgb(var(--theme-text-primary))] outline-none transition focus:border-[rgb(var(--theme-danger))]"
                            />
                            <div className="mt-1 flex items-center justify-between text-[11px] text-[rgb(var(--theme-text-muted))]">
                              <span>{t("adminPanel.punishmentReasonHint")}</span>
                              <span>{punishmentReasonText.length}/300</span>
                            </div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className={nestedPanelClass}>
                              <div className="mb-3 text-[11px] uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("adminPanel.blockByTurns")}</div>
                              <div className="flex flex-col gap-3">
                                <div className="w-full">
                                  <label className={labelClass}>{t("adminPanel.turnCount")}</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={turnsToBlock}
                                    onChange={(e) => setTurnsToBlock(Math.max(1, Number(e.target.value) || 1))}
                                    className={inputClass}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => applyPunishment({ action: "turns", turns: turnsToBlock })}
                                  disabled={saving}
                                  className="self-start rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] px-3 py-2 text-sm font-semibold text-[rgb(var(--theme-danger))] transition hover:brightness-110 disabled:opacity-60"
                                >
                                  {t("adminPanel.block")}
                                </button>
                              </div>
                            </div>

                            <div className={nestedPanelClass}>
                              <div className="mb-3 text-[11px] uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("adminPanel.blockByTime")}</div>
                              <div className="flex flex-col gap-3">
                                <div>
                                  <label className={labelClass}>{t("adminPanel.blockUntilDateTime")}</label>
                                  <input
                                    type="datetime-local"
                                    value={blockUntilAt}
                                    onChange={(e) => setBlockUntilAt(e.target.value)}
                                    className={inputClass}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => blockUntilAt && applyPunishment({ action: "time", blockedUntilAt: new Date(blockUntilAt).toISOString() })}
                                  disabled={saving || !blockUntilAt}
                                  className="self-start rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] px-3 py-2 text-sm font-semibold text-[rgb(var(--theme-danger))] transition hover:brightness-110 disabled:opacity-60"
                                >
                                  {t("adminPanel.blockByTimeAction")}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className={nestedPanelClass}>
                            <div className="mb-3 text-[11px] uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("adminPanel.quickActions")}</div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => applyPunishment({ action: "permanent" })}
                                disabled={saving}
                                className="rounded-lg border border-[rgb(var(--theme-danger))] bg-[rgb(var(--theme-danger-soft))] px-3 py-2 text-sm font-semibold text-[rgb(var(--theme-danger))] transition hover:brightness-110 disabled:opacity-60"
                              >
                                {t("adminPanel.permanentBlock")}
                              </button>
                              <button
                                type="button"
                                onClick={() => applyPunishment({ action: "unlock" })}
                                disabled={saving}
                                className="rounded-lg border border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] px-3 py-2 text-sm font-semibold text-[rgb(var(--theme-success))] transition hover:brightness-110 disabled:opacity-60"
                              >
                                {t("adminPanel.unlock")}
                              </button>
                            </div>
                          </div>

                          <div className={nestedPanelClass}>
                            <div className="mb-3 text-[11px] uppercase tracking-wide text-[rgb(var(--theme-text-muted))]">{t("adminPanel.turnSkipExclusion")}</div>
                            <div className="mb-2 text-xs text-[rgb(var(--theme-text-secondary))]">
                              {t("adminPanel.turnSkipExclusionDescription")}
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                              <div className="min-w-0 flex-1 sm:max-w-[220px]">
                                <label className={labelClass}>{t("adminPanel.untilTurnInclusive")}</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={ignoreUntilTurn}
                                  onChange={(e) => setIgnoreUntilTurn(Math.max(0, Number(e.target.value) || 0))}
                                  className={inputClass}
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveIgnoreUntilTurn(ignoreUntilTurn <= 0 ? null : ignoreUntilTurn)}
                                  disabled={saving}
                                  className="rounded-lg border border-[rgb(var(--theme-warning))] bg-[rgb(var(--theme-warning-soft))] px-3 py-2 text-sm font-semibold text-[rgb(var(--theme-warning))] transition hover:brightness-110 disabled:opacity-60"
                                >
                                  {t("adminPanel.applyExclusion")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveIgnoreUntilTurn(null)}
                                  disabled={saving}
                                  className="rounded-lg border border-[rgb(var(--theme-border-strong))] bg-[rgb(var(--theme-surface-3))] px-3 py-2 text-sm font-semibold text-[rgb(var(--theme-text-primary))] transition hover:brightness-110 disabled:opacity-60"
                                >
                                  {t("adminPanel.reset")}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  </>
                  )}
                  </div>
                )}
              </AppSection>
            </div>
          </div>
    </AppModal>
  );
}
