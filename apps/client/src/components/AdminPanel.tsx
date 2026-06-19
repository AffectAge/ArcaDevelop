import { Listbox } from "@headlessui/react";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, ChevronDown, Flag, Map as MapIcon, Palette, RotateCcw, Shield, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import type { Country, PopulationPop, RegionPopulation } from "@arcanorum/shared";
import type { UiTextKey } from "../i18n/uiText";
import { useUiText } from "../i18n/useUiText";
import {
  adminClearPopulation,
  adminBroadcastUiNotification,
  adminDeleteCountry,
  adminGeneratePopulation,
  adminResetRegionColonizationCostToAuto,
  adminSetCountryPunishment,
  adminUpdateCountry,
  adminUpdateRegionPopulation,
  adminUpdateRegion,
  fetchAdminRegions,
  fetchAdminProvinces,
  fetchCountries,
  type AdminPopulationScope,
  type AdminPopulationStrategy,
  type AdminProvinceItem,
  type AdminRegionItem,
} from "../lib/api";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppSection } from "./ui/AppSurface";

type Props = {
  open: boolean;
  token: string;
  currentCountryId: string;
  onClose: () => void;
  onSessionCountryUpdated: (country: Country) => void;
  initialProvinceId?: string | null;
};

const categories = [
  { id: "countries", labelKey: "adminPanel.category.countries", icon: Flag },
  { id: "provinces", labelKey: "adminPanel.category.provinces", icon: MapIcon },
  { id: "population", labelKey: "adminPanel.category.population", icon: Users },
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

const populationScopeOptions: Array<{ id: AdminPopulationScope; labelKey: UiTextKey }> = [
  { id: "region", labelKey: "adminPanel.scope.region" },
  { id: "country", labelKey: "adminPanel.scope.country" },
  { id: "world", labelKey: "adminPanel.scope.world" },
];

const populationStrategyOptions: Array<{ id: AdminPopulationStrategy; labelKey: UiTextKey }> = [
  { id: "random", labelKey: "adminPanel.strategy.random" },
  { id: "custom", labelKey: "adminPanel.strategy.custom" },
];

const broadcastCategoryOptions: Array<{ id: "system" | "politics" | "economy"; labelKey: UiTextKey }> = [
  { id: "system", labelKey: "notifications.category.system" },
  { id: "politics", labelKey: "notifications.category.politics" },
  { id: "economy", labelKey: "notifications.category.economy" },
];

const DEFAULT_POPULATION_POPS: PopulationPop[] = [
  {
    id: "pop:default",
    size: 10000,
    cultureId: "culture:default",
    religionId: "religion:default",
    raceId: "race:default",
    ideologies: { "ideology:default": 10000 },
    professions: {
      "profession:default": {
        size: 10000,
        ducats: 0,
        standardOfLiving: 8,
        radicals: 0,
        loyalists: 0,
        lastIncomeDucats: 0,
        lastNeedsSpendDucats: 0,
        lastNeedsSatisfaction: 1,
        lastBirths: 0,
        lastDeaths: 0,
      },
    },
  },
];

function stringifyPopulationPops(value: PopulationPop[]): string {
  return JSON.stringify(value, null, 2);
}

function getPopulationTotal(population: RegionPopulation | null | undefined): number {
  return Math.max(0, Math.floor((population?.pops ?? []).reduce((sum, pop) => sum + Math.max(0, Number(pop.size)), 0)));
}

export function AdminPanel({ open, token, currentCountryId, onClose, onSessionCountryUpdated, initialProvinceId }: Props) {
  const { t, locale } = useUiText();
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]["id"]>("countries");
  const [countrySection, setCountrySection] = useState<"general" | "punishments">("general");
  const [countries, setCountries] = useState<Country[]>([]);
  const [provinces, setProvinces] = useState<AdminProvinceItem[]>([]);
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
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>("");
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [provinceOwnerCountryId, setProvinceOwnerCountryId] = useState<string>("");
  const [regionColonizationCost, setRegionColonizationCost] = useState(100);
  const [regionColonizationDisabled, setRegionColonizationDisabled] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState("");
  const [populationScope, setPopulationScope] = useState<AdminPopulationScope>("region");
  const [populationStrategy, setPopulationStrategy] = useState<AdminPopulationStrategy>("random");
  const [populationTargetCountryId, setPopulationTargetCountryId] = useState<string>("");
  const [populationTotalInput, setPopulationTotalInput] = useState<string>("");
  const [populationPopsJson, setPopulationPopsJson] = useState<string>(stringifyPopulationPops(DEFAULT_POPULATION_POPS));
  const [RegionPopulationPopsJson, setRegionPopulationPopsJson] = useState<string>(stringifyPopulationPops(DEFAULT_POPULATION_POPS));
  const [broadcastCategory, setBroadcastCategory] = useState<"system" | "politics" | "economy">("system");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const selectedCountry = useMemo(() => countries.find((c) => c.id === selectedCountryId) ?? null, [countries, selectedCountryId]);
  const selectedProvince = useMemo(() => provinces.find((p) => p.id === selectedProvinceId) ?? null, [provinces, selectedProvinceId]);
  const selectedRegion = useMemo(() => regions.find((region) => region.id === selectedRegionId) ?? null, [regions, selectedRegionId]);
  const selectedProvinceOwner = useMemo(() => countries.find((c) => c.id === provinceOwnerCountryId) ?? null, [countries, provinceOwnerCountryId]);
  const filteredProvinces = useMemo(() => {
    const q = provinceSearch.trim().toLowerCase();
    if (!q) return provinces;
    return provinces.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [provinceSearch, provinces]);

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

    Promise.all([fetchCountries(), fetchAdminProvinces(token), fetchAdminRegions(token)])
      .then(([countryList, provinceList, regionList]) => {
        if (cancelled) {
          return;
        }
        setCountries(countryList);
        setProvinces(provinceList);
        setRegions(regionList);
        if (!selectedCountryId && countryList.length > 0) {
          setSelectedCountryId(countryList[0].id);
        }
        if (!populationTargetCountryId && countryList.length > 0) {
          setPopulationTargetCountryId(countryList[0].id);
        }
        if (!selectedProvinceId && provinceList.length > 0) {
          setSelectedProvinceId(provinceList[0].id);
        }
        if (!selectedRegionId && regionList.length > 0) {
          const regionIdFromInitialProvince = initialProvinceId
            ? provinceList.find((province) => province.id === initialProvinceId)?.regionId
            : null;
          setSelectedRegionId(regionIdFromInitialProvince ?? regionList[0].id);
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
  }, [initialProvinceId, open, token]);

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
    setProvinceOwnerCountryId(selectedRegion.ownerCountryId ?? "");
    setRegionColonizationCost(selectedRegion.colonizationCost);
    setRegionColonizationDisabled(selectedRegion.colonizationDisabled);
    const population = selectedRegion.population ?? null;
    setRegionPopulationPopsJson(stringifyPopulationPops(population?.pops ?? []));
  }, [selectedRegion]);

  useEffect(() => {
    if (!open || !initialProvinceId) {
      return;
    }
    setActiveCategory("provinces");
    setSelectedProvinceId(initialProvinceId);
    const regionId = provinces.find((province) => province.id === initialProvinceId)?.regionId;
    if (regionId) {
      setSelectedRegionId(regionId);
    }
  }, [initialProvinceId, open, provinces]);

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

  const saveProvince = async () => {
    if (!selectedRegion) {
      return;
    }
    setSaving(true);
    try {
      const updated = await adminUpdateRegion(token, selectedRegion.id, {
        colonizationCost: Math.max(1, Math.floor(regionColonizationCost)),
        colonizationDisabled: regionColonizationDisabled,
        ownerCountryId: provinceOwnerCountryId.trim() === "" ? null : provinceOwnerCountryId,
      });
      setRegions((prev) => prev.map((region) => (region.id === updated.id ? { ...region, ...updated } : region)));
      toast.success(t("adminPanel.regionUpdated"));
    } catch {
      toast.error(t("adminPanel.regionUpdateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const resetProvinceCostToAuto = async () => {
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

  const parsePopulationPopsJson = (raw: string): PopulationPop[] => {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("INVALID_POPULATION_POPS_JSON");
    }
    return parsed.map((raw, index) => {
      if (!raw || typeof raw !== "object") {
        throw new Error("INVALID_POPULATION_POP");
      }
      const row = raw as Partial<PopulationPop>;
      const size = Number(row.size);
      if (!Number.isFinite(size) || size < 0) {
        throw new Error("INVALID_POPULATION_POP_SIZE");
      }
      const requireId = (value: unknown): string => {
        if (typeof value !== "string" || !value.trim()) {
          throw new Error("INVALID_POPULATION_POP_ID");
        }
        return value.trim();
      };
      const requireCountMap = (value: unknown): Record<string, number> => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new Error("INVALID_POPULATION_POP_MAP");
        }
        const result: Record<string, number> = {};
        for (const [key, amount] of Object.entries(value as Record<string, unknown>)) {
          const num = Number(amount);
          if (!key.trim() || !Number.isFinite(num) || num < 0) {
            throw new Error("INVALID_POPULATION_POP_MAP");
          }
          result[key.trim()] = Math.floor(num);
        }
        return result;
      };
      const requireProfessionMap = (value: unknown): PopulationPop["professions"] => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new Error("INVALID_POPULATION_POP_MAP");
        }
        const result: PopulationPop["professions"] = {};
        for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
          if (!key.trim()) throw new Error("INVALID_POPULATION_POP_MAP");
          if (typeof raw === "number") {
            result[key.trim()] = {
              size: Math.max(0, Math.floor(raw)),
              ducats: 0,
              standardOfLiving: 8,
              radicals: 0,
              loyalists: 0,
              lastIncomeDucats: 0,
              lastNeedsSpendDucats: 0,
              lastNeedsSatisfaction: 1,
              lastBirths: 0,
              lastDeaths: 0,
            };
          } else if (raw && typeof raw === "object") {
            const row = raw as Partial<PopulationPop["professions"][string]>;
            result[key.trim()] = {
              size: Math.max(0, Math.floor(Number(row.size ?? 0))),
              ducats: Math.max(0, Number(row.ducats ?? 0)),
              standardOfLiving: Math.max(0, Number(row.standardOfLiving ?? 8)),
              radicals: Math.max(0, Math.floor(Number(row.radicals ?? 0))),
              loyalists: Math.max(0, Math.floor(Number(row.loyalists ?? 0))),
              lastIncomeDucats: Math.max(0, Number(row.lastIncomeDucats ?? 0)),
              lastNeedsSpendDucats: Math.max(0, Number(row.lastNeedsSpendDucats ?? 0)),
              lastNeedsSatisfaction: Math.max(0, Number(row.lastNeedsSatisfaction ?? 1)),
              lastBirths: Math.max(0, Math.floor(Number(row.lastBirths ?? 0))),
              lastDeaths: Math.max(0, Math.floor(Number(row.lastDeaths ?? 0))),
            };
          }
        }
        return result;
      };
      return {
        id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : `pop:${index}`,
        size: Math.floor(size),
        cultureId: requireId(row.cultureId),
        religionId: requireId(row.religionId),
        raceId: requireId(row.raceId),
        ideologies: requireCountMap(row.ideologies),
        professions: requireProfessionMap(row.professions),
      };
    });
  };

  const reloadAdminRegions = async () => {
    const regionList = await fetchAdminRegions(token);
    setRegions(regionList);
  };

  const generatePopulation = async () => {
    if (populationScope === "region" && !selectedRegionId) {
      toast.error(t("adminPanel.selectRegion"));
      return;
    }
    if (populationScope === "country" && !populationTargetCountryId) {
      toast.error(t("adminPanel.selectCountry"));
      return;
    }

    setSaving(true);
    try {
      const payload: Parameters<typeof adminGeneratePopulation>[1] = {
        scope: populationScope,
        strategy: populationStrategy,
        regionId: populationScope === "region" ? selectedRegionId : undefined,
        countryId: populationScope === "country" ? populationTargetCountryId : undefined,
      };
      const total = Number(populationTotalInput);
      if (Number.isFinite(total) && populationTotalInput.trim() !== "") {
        payload.populationTotal = Math.max(0, Math.floor(total));
      }
      if (populationStrategy === "custom") {
        payload.pops = parsePopulationPopsJson(populationPopsJson);
      }
      const result = await adminGeneratePopulation(token, payload);
      await reloadAdminRegions();
      toast.success(t("adminPanel.populationGenerated", { count: result.updatedCount }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ADMIN_POPULATION_GENERATE_FAILED";
      if (msg.startsWith("INVALID_POPULATION_POP")) {
        toast.error(t("adminPanel.populationJsonInvalid"));
      } else if (msg === "COUNTRY_HAS_NO_REGIONS") {
        toast.error(t("adminPanel.countryHasNoRegions"));
      } else {
        toast.error(t("adminPanel.populationGenerateFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const clearPopulation = async () => {
    if (populationScope === "region" && !selectedRegionId) {
      toast.error(t("adminPanel.selectRegion"));
      return;
    }
    if (populationScope === "country" && !populationTargetCountryId) {
      toast.error(t("adminPanel.selectCountry"));
      return;
    }
    setSaving(true);
    try {
      const result = await adminClearPopulation(token, {
        scope: populationScope,
        regionId: populationScope === "region" ? selectedRegionId : undefined,
        countryId: populationScope === "country" ? populationTargetCountryId : undefined,
      });
      await reloadAdminRegions();
      toast.success(t("adminPanel.populationCleared", { count: result.updatedCount }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ADMIN_POPULATION_CLEAR_FAILED";
      if (msg === "COUNTRY_HAS_NO_REGIONS") {
        toast.error(t("adminPanel.countryHasNoRegions"));
      } else {
        toast.error(t("adminPanel.populationClearFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const saveRegionPopulation = async () => {
    if (!selectedRegion) {
      toast.error(t("adminPanel.selectRegion"));
      return;
    }
    setSaving(true);
    try {
      await adminUpdateRegionPopulation(token, selectedRegion.id, {
        pops: parsePopulationPopsJson(RegionPopulationPopsJson),
      });
      await reloadAdminRegions();
      toast.success(t("adminPanel.regionPopulationUpdated"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ADMIN_POPULATION_UPDATE_FAILED";
      if (msg.startsWith("INVALID_POPULATION_POP")) {
        toast.error(t("adminPanel.populationJsonInvalid"));
      } else {
        toast.error(t("adminPanel.regionPopulationUpdateFailed"));
      }
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
                          onChange={(e) => setProvinceSearch(e.target.value)}
                          placeholder={t("adminPanel.provinceSearchPlaceholder")}
                          className={`mb-2 ${inputClass}`}
                        />
                        <Listbox
                          value={selectedProvinceId}
                          onChange={(provinceId) => {
                            setSelectedProvinceId(provinceId);
                            const regionId = provinces.find((province) => province.id === provinceId)?.regionId;
                            if (regionId) {
                              setSelectedRegionId(regionId);
                            }
                          }}
                        >
                          <div className="relative">
                            <Listbox.Button className={listboxButtonClass}>
                              {selectedProvince ? `${selectedProvince.name} (${selectedProvince.id})` : t("adminPanel.selectProvince")}
                              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-text-muted))]" />
                            </Listbox.Button>
                            <Listbox.Options className={listboxOptionsClass}>
                              {filteredProvinces.map((province) => (
                                <Listbox.Option
                                  key={province.id}
                                  value={province.id}
                                  className={({ active }) => optionClass(active)}
                                >
                                  {({ selected }) => (
                                    <>
                                      <div className={selected ? "text-[rgb(var(--theme-accent))]" : ""}>{province.name}</div>
                                      <div className="text-[11px] text-[rgb(var(--theme-text-muted))]">{province.id}</div>
                                      {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-accent))]" />}
                                    </>
                                  )}
                                </Listbox.Option>
                              ))}
                              {filteredProvinces.length === 0 && (
                                <div className="px-3 py-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("civilopedia.noResults")}</div>
                              )}
                            </Listbox.Options>
                          </div>
                        </Listbox>
                        <div className="mt-2 text-xs text-[rgb(var(--theme-text-muted))]">{t("adminPanel.autoCostHint")}</div>
                      </div>

                      {selectedProvince && (
                        <div className="space-y-4 rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-1))] p-3">
                          <div className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2 text-xs text-[rgb(var(--theme-text-secondary))]">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              <span>{t("adminPanel.idLabel")} <span className="text-[rgb(var(--theme-text-primary))]">{selectedProvince.id}</span></span>
                              <span>
                                {t("provinceTooltip.area")}: <span className="text-[rgb(var(--theme-text-primary))]">{new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(Math.round(selectedProvince.areaKm2 ?? 0))} km2</span>
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
                              <Listbox value={provinceOwnerCountryId} onChange={setProvinceOwnerCountryId}>
                                <div className="relative">
                                  <Listbox.Button className={listboxButtonClass}>
                                    {provinceOwnerCountryId ? (selectedProvinceOwner?.name ?? provinceOwnerCountryId) : t("adminPanel.neutralProvince")}
                                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-text-muted))]" />
                                  </Listbox.Button>
                                  <Listbox.Options className={listboxOptionsClass}>
                                    <Listbox.Option
                                      value=""
                                      className={({ active }) => optionClass(active)}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className={selected ? "text-[rgb(var(--theme-accent))]" : ""}>{t("adminPanel.neutralProvince")}</span>
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
                              onClick={resetProvinceCostToAuto}
                              disabled={saving || !selectedRegion}
                              className="inline-flex items-center gap-2 rounded-lg border border-[rgb(var(--theme-success))] bg-[rgb(var(--theme-success-soft))] px-3 py-2 text-sm text-[rgb(var(--theme-success))] transition hover:brightness-110 disabled:opacity-60"
                            >
                              <RotateCcw size={14} />
                              {t("adminPanel.resetCostToAuto")}
                            </button>
                            <button onClick={saveProvince} disabled={saving || !selectedRegion} className="rounded-lg bg-[rgb(var(--theme-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--theme-accent-contrast))] disabled:opacity-60">
                              {t("adminPanel.saveProvince")}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {activeCategory === "population" && (
                    <div className="space-y-4">
                      <div className={panelClass}>
                        <div className="mb-3 text-sm font-semibold text-[rgb(var(--theme-text-primary))]">{t("adminPanel.populationGenerateTitle")}</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className={labelClass}>{t("adminPanel.populationScope")}</label>
                            <Listbox value={populationScope} onChange={setPopulationScope}>
                              <div className="relative">
                                <Listbox.Button className={listboxButtonClass}>
                                  {t(populationScopeOptions.find((option) => option.id === populationScope)?.labelKey ?? "adminPanel.scope.region")}
                                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-text-muted))]" />
                                </Listbox.Button>
                                <Listbox.Options className={listboxOptionsClass}>
                                  {populationScopeOptions.map((option) => (
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
                            <label className={labelClass}>{t("adminPanel.populationStrategy")}</label>
                            <Listbox value={populationStrategy} onChange={setPopulationStrategy}>
                              <div className="relative">
                                <Listbox.Button className={listboxButtonClass}>
                                  {t(populationStrategyOptions.find((option) => option.id === populationStrategy)?.labelKey ?? "adminPanel.strategy.random")}
                                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-text-muted))]" />
                                </Listbox.Button>
                                <Listbox.Options className={listboxOptionsClass}>
                                  {populationStrategyOptions.map((option) => (
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
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {populationScope === "region" && (
                            <div>
                              <label className={labelClass}>{t("adminPanel.scope.region")}</label>
                              <Listbox value={selectedRegionId} onChange={setSelectedRegionId}>
                                <div className="relative">
                                  <Listbox.Button className={listboxButtonClass}>
                                    {selectedRegion ? selectedRegion.id : t("adminPanel.selectRegion")}
                                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-text-muted))]" />
                                  </Listbox.Button>
                                  <Listbox.Options className={listboxOptionsClass}>
                                    {regions.map((region) => (
                                      <Listbox.Option
                                        key={region.id}
                                        value={region.id}
                                        className={({ active }) => optionClass(active)}
                                      >
                                        {({ selected }) => (
                                          <>
                                            <span className={selected ? "text-[rgb(var(--theme-accent))]" : ""}>{region.id}</span>
                                            {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-accent))]" />}
                                          </>
                                        )}
                                      </Listbox.Option>
                                    ))}
                                  </Listbox.Options>
                                </div>
                              </Listbox>
                            </div>
                          )}

                          {populationScope === "country" && (
                            <div>
                              <label className={labelClass}>{t("auth.country")}</label>
                              <Listbox value={populationTargetCountryId} onChange={setPopulationTargetCountryId}>
                                <div className="relative">
                                  <Listbox.Button className={listboxButtonClass}>
                                    {countries.find((c) => c.id === populationTargetCountryId)?.name ?? t("adminPanel.selectCountry")}
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
                          )}

                          <div>
                            <label className={labelClass}>{t("adminPanel.populationTotalOptional")}</label>
                            <input
                              type="number"
                              min={0}
                              value={populationTotalInput}
                              onChange={(e) => setPopulationTotalInput(e.target.value)}
                              placeholder={t("adminPanel.populationTotalPlaceholder")}
                              className={inputClass}
                            />
                          </div>
                        </div>

                        {populationStrategy === "custom" && (
                          <div className="mt-3">
                            <label className={labelClass}>{t("adminPanel.popGroupsJson")}</label>
                            <textarea
                              value={populationPopsJson}
                              onChange={(e) => setPopulationPopsJson(e.target.value)}
                              rows={10}
                              className={`${inputClass} font-mono text-xs`}
                            />
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={generatePopulation}
                            disabled={saving}
                            className="rounded-lg bg-[rgb(var(--theme-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--theme-accent-contrast))] disabled:opacity-60"
                          >
                            {t("adminPanel.generatePopulation")}
                          </button>
                          <button
                            type="button"
                            onClick={clearPopulation}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--theme-danger-soft))] px-4 py-2 text-sm font-semibold text-[rgb(var(--theme-danger))] disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            {t("adminPanel.clearPopulation")}
                          </button>
                        </div>
                      </div>

                      <div className={panelClass}>
                        <div className="mb-3 text-sm font-semibold text-[rgb(var(--theme-text-primary))]">{t("adminPanel.regionPopulationEditTitle")}</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className={labelClass}>{t("adminPanel.scope.region")}</label>
                            <Listbox value={selectedRegionId} onChange={setSelectedRegionId}>
                              <div className="relative">
                                <Listbox.Button className={listboxButtonClass}>
                                  {selectedRegion ? selectedRegion.id : t("adminPanel.selectRegion")}
                                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-text-muted))]" />
                                </Listbox.Button>
                                <Listbox.Options className={listboxOptionsClass}>
                                  {regions.map((region) => (
                                    <Listbox.Option
                                      key={region.id}
                                      value={region.id}
                                      className={({ active }) => optionClass(active)}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className={selected ? "text-[rgb(var(--theme-accent))]" : ""}>{region.id}</span>
                                          {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--theme-accent))]" />}
                                        </>
                                      )}
                                    </Listbox.Option>
                                  ))}
                                </Listbox.Options>
                              </div>
                            </Listbox>
                          </div>
                          <div className="rounded-lg border border-[rgb(var(--theme-border-subtle))] bg-[rgb(var(--theme-surface-2))] px-3 py-2 text-sm text-[rgb(var(--theme-text-primary))]">
                            <div className="text-xs text-[rgb(var(--theme-text-muted))]">{t("adminPanel.populationTotalByPops")}</div>
                            <div className="mt-1 font-semibold text-[rgb(var(--theme-text-primary))]">{getPopulationTotal(selectedRegion?.population ?? null).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}</div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className={labelClass}>{t("adminPanel.popGroupsJson")}</label>
                          <textarea
                            value={RegionPopulationPopsJson}
                            onChange={(e) => setRegionPopulationPopsJson(e.target.value)}
                            rows={12}
                            className={`${inputClass} font-mono text-xs`}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={saveRegionPopulation}
                            disabled={saving || !selectedRegion}
                            className="rounded-lg bg-[rgb(var(--theme-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--theme-accent-contrast))] disabled:opacity-60"
                          >
                            {t("adminPanel.saveRegionPopulation")}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selectedRegion) return;
                              setSaving(true);
                              try {
                                await adminClearPopulation(token, { scope: "region", regionId: selectedRegion.id });
                                await reloadAdminRegions();
                                toast.success(t("adminPanel.regionPopulationCleared"));
                              } catch {
                                toast.error(t("adminPanel.regionPopulationClearFailed"));
                              } finally {
                                setSaving(false);
                              }
                            }}
                            disabled={saving || !selectedRegion}
                            className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--theme-danger-soft))] px-4 py-2 text-sm font-semibold text-[rgb(var(--theme-danger))] disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            {t("adminPanel.clearRegion")}
                          </button>
                        </div>
                      </div>
                    </div>
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
