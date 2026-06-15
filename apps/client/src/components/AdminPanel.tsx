import { Listbox } from "@headlessui/react";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, ChevronDown, Flag, Map as MapIcon, Palette, RotateCcw, Shield, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import type { Country, PopulationPop, RegionPopulation } from "@arcanorum/shared";
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
  { id: "countries", label: "Управление странами", icon: Flag },
  { id: "provinces", label: "Провинции / Колонизация", icon: MapIcon },
  { id: "population", label: "Управление населением", icon: Users },
  { id: "notifications", label: "Рассылка уведомлений", icon: BellRing },
] as const;

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
      return "Перманентная блокировка входа";
    }

    if (selectedCountry.blockedUntilTurn) {
      return `Блокировка до хода #${selectedCountry.blockedUntilTurn}`;
    }

    if (selectedCountry.blockedUntilAt) {
      return `Блокировка до ${new Date(selectedCountry.blockedUntilAt).toLocaleString()}`;
    }


    if (selectedCountry.ignoreUntilTurn) {
      return `Не учитывать при пропуске хода до #${selectedCountry.ignoreUntilTurn}`;
    }

    return "Ограничений нет";
  }, [selectedCountry]);

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
      toast.success("Страна обновлена");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "COUNTRY_UPDATE_FAILED";
      if (msg === "IMAGE_DIMENSIONS_TOO_LARGE") {
        toast.error("Проверьте формат: флаг 192x128 (3:2), герб 128x192 (2:3)");
      } else {
        toast.error("Не удалось обновить страну");
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
      toast.success("Наказание обновлено");
    } catch {
      toast.error("Не удалось применить наказание");
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
      toast.success("Исключение из пропуска хода обновлено");
    } catch {
      toast.error("Не удалось обновить исключение");
    } finally {
      setSaving(false);
    }
  };

  const deleteCountry = async () => {
    if (!selectedCountry) {
      return;
    }

    const confirmed = window.confirm(`Удалить страну ${selectedCountry.name}?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    try {
      await adminDeleteCountry(token, selectedCountry.id);
      setCountries((prev) => prev.filter((c) => c.id !== selectedCountry.id));
      const next = countries.find((c) => c.id !== selectedCountry.id);
      setSelectedCountryId(next?.id ?? "");
      toast.success("Страна удалена");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "COUNTRY_DELETE_FAILED";
      if (msg === "CANNOT_DELETE_SELF") {
        toast.error("Нельзя удалить страну, под которой вы вошли");
      } else {
        toast.error("Не удалось удалить страну");
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
      toast.success("Провинция обновлена");
    } catch {
      toast.error("Не удалось обновить провинцию");
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
      toast.success("Цена провинции сброшена к авто");
    } catch {
      toast.error("Не удалось сбросить цену к авто");
    } finally {
      setSaving(false);
    }
  };

  const sendBroadcastNotification = async () => {
    const title = broadcastTitle.trim();
    const message = broadcastMessage.trim();
    if (!title || !message) {
      toast.error("Заполните заголовок и текст уведомления");
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
      toast.success("Уведомление отправлено всем игрокам");
    } catch {
      toast.error("Не удалось отправить уведомление");
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
      toast.error("Выберите регион");
      return;
    }
    if (populationScope === "country" && !populationTargetCountryId) {
      toast.error("Выберите страну");
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
      toast.success(`Население сгенерировано: ${result.updatedCount} регионов`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ADMIN_POPULATION_GENERATE_FAILED";
      if (msg.startsWith("INVALID_POPULATION_POP")) {
        toast.error("Проверьте JSON pop-групп");
      } else if (msg === "COUNTRY_HAS_NO_REGIONS") {
        toast.error("У выбранной страны нет регионов");
      } else {
        toast.error("Не удалось сгенерировать население");
      }
    } finally {
      setSaving(false);
    }
  };

  const clearPopulation = async () => {
    if (populationScope === "region" && !selectedRegionId) {
      toast.error("Выберите регион");
      return;
    }
    if (populationScope === "country" && !populationTargetCountryId) {
      toast.error("Выберите страну");
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
      toast.success(`Население очищено: ${result.updatedCount} регионов`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ADMIN_POPULATION_CLEAR_FAILED";
      if (msg === "COUNTRY_HAS_NO_REGIONS") {
        toast.error("У выбранной страны нет регионов");
      } else {
        toast.error("Не удалось очистить население");
      }
    } finally {
      setSaving(false);
    }
  };

  const saveRegionPopulation = async () => {
    if (!selectedRegion) {
      toast.error("Выберите регион");
      return;
    }
    setSaving(true);
    try {
      await adminUpdateRegionPopulation(token, selectedRegion.id, {
        pops: parsePopulationPopsJson(RegionPopulationPopsJson),
      });
      await reloadAdminRegions();
      toast.success("Население региона обновлено");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ADMIN_POPULATION_UPDATE_FAILED";
      if (msg.startsWith("INVALID_POPULATION_POP")) {
        toast.error("Проверьте JSON pop-групп");
      } else {
        toast.error("Не удалось обновить население региона");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal open={open} onClose={onClose} modalKey="admin" zIndexClassName="z-[120]" paddingClassName="p-4" panelClassName="rounded-none">
          <AppModalHeader title="Панель администратора" onClose={onClose} />

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

            <div className="flex min-h-0 flex-col gap-3">
              {activeCategory === "countries" && selectedCountry && (
                <div className="panel-border rounded-xl bg-black/25 p-3">
                  <div className="mb-2 px-1 text-[11px] uppercase tracking-wide text-white/45">Раздел управления страной</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCountrySection("general")}
                      className={`inline-flex items-center border-b px-1 py-1.5 text-xs font-medium transition ${
                        countrySection === "general"
                          ? "border-arc-accent text-arc-accent"
                          : "border-transparent text-slate-300 hover:text-white"
                      }`}
                    >
                      Основная информация
                    </button>
                    <button
                      type="button"
                      onClick={() => setCountrySection("punishments")}
                      className={`inline-flex items-center border-b px-1 py-1.5 text-xs font-medium transition ${
                        countrySection === "punishments"
                          ? "border-rose-300 text-rose-300"
                          : "border-transparent text-slate-300 hover:text-white"
                      }`}
                    >
                      Наказания
                    </button>
                  </div>
                </div>
              )}

              <AppSection className="arc-scrollbar overflow-auto p-4">
                {loading ? (
                  <div className="text-sm text-slate-400">Загрузка стран...</div>
                ) : (
                  <div className="space-y-4">
                  {activeCategory === "provinces" && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs text-slate-300">Провинция</label>
                        <input
                          value={provinceSearch}
                          onChange={(e) => setProvinceSearch(e.target.value)}
                          placeholder="Поиск по названию или ID..."
                          className="mb-2 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100"
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
                            <Listbox.Button className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 pr-10 text-left text-sm text-slate-100">
                              {selectedProvince ? `${selectedProvince.name} (${selectedProvince.id})` : "Выберите провинцию"}
                              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </Listbox.Button>
                            <Listbox.Options className="arc-scrollbar panel-border absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-lg bg-arc-panel/95 p-1 text-sm shadow-2xl outline-none">
                              {filteredProvinces.map((province) => (
                                <Listbox.Option
                                  key={province.id}
                                  value={province.id}
                                  className={({ active }) => `relative cursor-pointer rounded-md px-3 py-2 pr-9 transition ${active ? "bg-arc-accent/15 text-arc-accent" : "text-slate-300"}`}
                                >
                                  {({ selected }) => (
                                    <>
                                      <div className={selected ? "text-arc-accent" : ""}>{province.name}</div>
                                      <div className="text-[11px] text-slate-400">{province.id}</div>
                                      {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-accent" />}
                                    </>
                                  )}
                                </Listbox.Option>
                              ))}
                              {filteredProvinces.length === 0 && (
                                <div className="px-3 py-2 text-xs text-slate-400">Ничего не найдено</div>
                              )}
                            </Listbox.Options>
                          </div>
                        </Listbox>
                        <div className="mt-2 text-xs text-slate-400">
                          Автоматические цены рассчитываются по площади и глобальным ставкам колонизации.
                        </div>
                      </div>

                      {selectedProvince && (
                        <div className="space-y-4 rounded-lg border border-white/10 bg-black/25 p-3">
                          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              <span>ID: <span className="text-slate-100">{selectedProvince.id}</span></span>
                              <span>
                                Площадь: <span className="text-slate-100">{new Intl.NumberFormat("ru-RU").format(Math.round(selectedProvince.areaKm2 ?? 0))} км²</span>
                              </span>
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs text-slate-300">Стоимость колонизации</label>
                              <input
                                type="number"
                                min={1}
                                value={regionColonizationCost}
                                onChange={(e) => setRegionColonizationCost(Math.max(1, Number(e.target.value) || 1))}
                                className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm"
                              />
                              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                                    selectedRegion?.manualCost
                                      ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                                      : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                                  }`}
                                >
                                  {selectedRegion?.manualCost ? "Ручная цена" : "Авто (по площади)"}
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-slate-300">Владелец</label>
                              <Listbox value={provinceOwnerCountryId} onChange={setProvinceOwnerCountryId}>
                                <div className="relative">
                                  <Listbox.Button className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 pr-10 text-left text-sm text-slate-100">
                                    {provinceOwnerCountryId ? (selectedProvinceOwner?.name ?? provinceOwnerCountryId) : "Нейтральная провинция"}
                                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                  </Listbox.Button>
                                  <Listbox.Options className="arc-scrollbar panel-border absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-lg bg-arc-panel/95 p-1 text-sm shadow-2xl outline-none">
                                    <Listbox.Option
                                      value=""
                                      className={({ active }) => `relative cursor-pointer rounded-md px-3 py-2 pr-9 transition ${active ? "bg-arc-accent/15 text-arc-accent" : "text-slate-300"}`}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className={selected ? "text-arc-accent" : ""}>Нейтральная провинция</span>
                                          {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-accent" />}
                                        </>
                                      )}
                                    </Listbox.Option>
                                    {countries.map((country) => (
                                      <Listbox.Option
                                        key={country.id}
                                        value={country.id}
                                        className={({ active }) => `relative cursor-pointer rounded-md px-3 py-2 pr-9 transition ${active ? "bg-arc-accent/15 text-arc-accent" : "text-slate-300"}`}
                                      >
                                        {({ selected }) => (
                                          <>
                                            <div className="flex items-center gap-2">
                                              {country.flagUrl ? (
                                                <img src={country.flagUrl} alt="" className="h-4 w-5 rounded-sm object-cover" />
                                              ) : (
                                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: country.color }} />
                                              )}
                                              <span className={selected ? "text-arc-accent" : ""}>{country.name}</span>
                                            </div>
                                            {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-accent" />}
                                          </>
                                        )}
                                      </Listbox.Option>
                                    ))}
                                  </Listbox.Options>
                                </div>
                              </Listbox>
                            </div>
                          </div>

                          <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={regionColonizationDisabled}
                              onChange={(e) => setRegionColonizationDisabled(e.target.checked)}
                              className="accent-arc-accent"
                            />
                            Запретить колонизацию (прогресс будет сброшен)
                          </label>

                          <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-slate-300">
                            <div>Участников гонки: {Object.keys(selectedRegion?.colonyProgressByCountry ?? {}).length}</div>
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
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/15 disabled:opacity-60"
                            >
                              <RotateCcw size={14} />
                              Сбросить цену к авто (по площади)
                            </button>
                            <button onClick={saveProvince} disabled={saving || !selectedRegion} className="rounded-lg bg-arc-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-60">
                              Сохранить провинцию
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {activeCategory === "population" && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                        <div className="mb-3 text-sm font-semibold text-slate-100">Генерация населения</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs text-slate-300">Scope</label>
                            <Listbox value={populationScope} onChange={setPopulationScope}>
                              <div className="relative">
                                <Listbox.Button className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 pr-10 text-left text-sm text-slate-100">
                                  {populationScope === "region" ? "Регион" : populationScope === "country" ? "Страна" : "Весь мир"}
                                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                </Listbox.Button>
                                <Listbox.Options className="arc-scrollbar panel-border absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-lg bg-arc-panel/95 p-1 text-sm shadow-2xl outline-none">
                                  {([
                                    { id: "region", label: "Регион" },
                                    { id: "country", label: "Страна" },
                                    { id: "world", label: "Весь мир" },
                                  ] satisfies Array<{ id: AdminPopulationScope; label: string }>).map((option) => (
                                    <Listbox.Option
                                      key={option.id}
                                      value={option.id}
                                      className={({ active }) => `relative cursor-pointer rounded-md px-3 py-2 pr-9 transition ${active ? "bg-arc-accent/15 text-arc-accent" : "text-slate-300"}`}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className={selected ? "text-arc-accent" : ""}>{option.label}</span>
                                          {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-accent" />}
                                        </>
                                      )}
                                    </Listbox.Option>
                                  ))}
                                </Listbox.Options>
                              </div>
                            </Listbox>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs text-slate-300">Стратегия</label>
                            <Listbox value={populationStrategy} onChange={setPopulationStrategy}>
                              <div className="relative">
                                <Listbox.Button className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 pr-10 text-left text-sm text-slate-100">
                                  {populationStrategy === "random" ? "Случайные pop-группы" : "Заданные pop-группы"}
                                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                </Listbox.Button>
                                <Listbox.Options className="arc-scrollbar panel-border absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-lg bg-arc-panel/95 p-1 text-sm shadow-2xl outline-none">
                                  {[
                                    { id: "random", label: "Случайные pop-группы" },
                                    { id: "custom", label: "Заданные pop-группы" },
                                  ].map((option) => (
                                    <Listbox.Option
                                      key={option.id}
                                      value={option.id}
                                      className={({ active }) => `relative cursor-pointer rounded-md px-3 py-2 pr-9 transition ${active ? "bg-arc-accent/15 text-arc-accent" : "text-slate-300"}`}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className={selected ? "text-arc-accent" : ""}>{option.label}</span>
                                          {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-accent" />}
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
                              <label className="mb-1 block text-xs text-slate-300">Регион</label>
                              <Listbox value={selectedRegionId} onChange={setSelectedRegionId}>
                                <div className="relative">
                                  <Listbox.Button className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 pr-10 text-left text-sm text-slate-100">
                                    {selectedRegion ? selectedRegion.id : "Выберите регион"}
                                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                  </Listbox.Button>
                                  <Listbox.Options className="arc-scrollbar panel-border absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-lg bg-arc-panel/95 p-1 text-sm shadow-2xl outline-none">
                                    {regions.map((region) => (
                                      <Listbox.Option
                                        key={region.id}
                                        value={region.id}
                                        className={({ active }) => `relative cursor-pointer rounded-md px-3 py-2 pr-9 transition ${active ? "bg-arc-accent/15 text-arc-accent" : "text-slate-300"}`}
                                      >
                                        {({ selected }) => (
                                          <>
                                            <span className={selected ? "text-arc-accent" : ""}>{region.id}</span>
                                            {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-accent" />}
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
                              <label className="mb-1 block text-xs text-slate-300">Страна</label>
                              <Listbox value={populationTargetCountryId} onChange={setPopulationTargetCountryId}>
                                <div className="relative">
                                  <Listbox.Button className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 pr-10 text-left text-sm text-slate-100">
                                    {countries.find((c) => c.id === populationTargetCountryId)?.name ?? "Выберите страну"}
                                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                  </Listbox.Button>
                                  <Listbox.Options className="arc-scrollbar panel-border absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-lg bg-arc-panel/95 p-1 text-sm shadow-2xl outline-none">
                                    {countries.map((country) => (
                                      <Listbox.Option
                                        key={country.id}
                                        value={country.id}
                                        className={({ active }) => `relative cursor-pointer rounded-md px-3 py-2 pr-9 transition ${active ? "bg-arc-accent/15 text-arc-accent" : "text-slate-300"}`}
                                      >
                                        {({ selected }) => (
                                          <>
                                            <span className={selected ? "text-arc-accent" : ""}>{country.name}</span>
                                            {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-accent" />}
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
                            <label className="mb-1 block text-xs text-slate-300">populationTotal (опционально)</label>
                            <input
                              type="number"
                              min={0}
                              value={populationTotalInput}
                              onChange={(e) => setPopulationTotalInput(e.target.value)}
                              placeholder="Если пусто — сохраняется текущее"
                              className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100"
                            />
                          </div>
                        </div>

                        {populationStrategy === "custom" && (
                          <div className="mt-3">
                            <label className="mb-1 block text-xs text-slate-300">Pop-группы JSON</label>
                            <textarea
                              value={populationPopsJson}
                              onChange={(e) => setPopulationPopsJson(e.target.value)}
                              rows={10}
                              className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 font-mono text-xs text-slate-100"
                            />
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={generatePopulation}
                            disabled={saving}
                            className="rounded-lg bg-arc-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                          >
                            Сгенерировать население
                          </button>
                          <button
                            type="button"
                            onClick={clearPopulation}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-rose-600/20 px-4 py-2 text-sm font-semibold text-rose-300 disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            Очистить население
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                        <div className="mb-3 text-sm font-semibold text-slate-100">Редактирование населения региона</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs text-slate-300">Регион</label>
                            <Listbox value={selectedRegionId} onChange={setSelectedRegionId}>
                              <div className="relative">
                                <Listbox.Button className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 pr-10 text-left text-sm text-slate-100">
                                  {selectedRegion ? selectedRegion.id : "Выберите регион"}
                                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                </Listbox.Button>
                                <Listbox.Options className="arc-scrollbar panel-border absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-lg bg-arc-panel/95 p-1 text-sm shadow-2xl outline-none">
                                  {regions.map((region) => (
                                    <Listbox.Option
                                      key={region.id}
                                      value={region.id}
                                      className={({ active }) => `relative cursor-pointer rounded-md px-3 py-2 pr-9 transition ${active ? "bg-arc-accent/15 text-arc-accent" : "text-slate-300"}`}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className={selected ? "text-arc-accent" : ""}>{region.id}</span>
                                          {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-accent" />}
                                        </>
                                      )}
                                    </Listbox.Option>
                                  ))}
                                </Listbox.Options>
                              </div>
                            </Listbox>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100">
                            <div className="text-xs text-slate-400">Суммарно по pop-группам</div>
                            <div className="mt-1 font-semibold text-white">{getPopulationTotal(selectedRegion?.population ?? null).toLocaleString("ru-RU")}</div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className="mb-1 block text-xs text-slate-300">Pop-группы JSON</label>
                          <textarea
                            value={RegionPopulationPopsJson}
                            onChange={(e) => setRegionPopulationPopsJson(e.target.value)}
                            rows={12}
                            className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 font-mono text-xs text-slate-100"
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={saveRegionPopulation}
                            disabled={saving || !selectedRegion}
                            className="rounded-lg bg-arc-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                          >
                            Сохранить население региона
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selectedRegion) return;
                              setSaving(true);
                              try {
                                await adminClearPopulation(token, { scope: "region", regionId: selectedRegion.id });
                                await reloadAdminRegions();
                                toast.success("Население региона очищено");
                              } catch {
                                toast.error("Не удалось очистить население региона");
                              } finally {
                                setSaving(false);
                              }
                            }}
                            disabled={saving || !selectedRegion}
                            className="inline-flex items-center gap-2 rounded-lg bg-rose-600/20 px-4 py-2 text-sm font-semibold text-rose-300 disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            Очистить регион
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeCategory === "notifications" && (
                    <div className="space-y-4 rounded-lg border border-white/10 bg-black/25 p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <BellRing size={16} className="text-arc-accent" />
                        Рассылка UI-уведомления всем игрокам
                      </div>
                      <div className="text-xs text-slate-400">
                        Уведомления категории <span className="text-amber-300">registration</span> зарезервированы для заявок на регистрацию и по-прежнему отправляются только администраторам.
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-300">Категория</label>
                        <Listbox value={broadcastCategory} onChange={setBroadcastCategory}>
                          <div className="relative">
                            <Listbox.Button className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 pr-10 text-left text-sm text-slate-100">
                              {broadcastCategory === "system" ? "Система" : broadcastCategory === "politics" ? "Политика" : "Экономика"}
                              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </Listbox.Button>
                            <Listbox.Options className="arc-scrollbar panel-border absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-lg bg-arc-panel/95 p-1 text-sm shadow-2xl outline-none">
                              {[
                                { id: "system", label: "Система" },
                                { id: "politics", label: "Политика" },
                                { id: "economy", label: "Экономика" },
                              ].map((option) => (
                                <Listbox.Option
                                  key={option.id}
                                  value={option.id}
                                  className={({ active }) => `relative cursor-pointer rounded-md px-3 py-2 pr-9 transition ${active ? "bg-arc-accent/15 text-arc-accent" : "text-slate-300"}`}
                                >
                                  {({ selected }) => (
                                    <>
                                      <span className={selected ? "text-arc-accent" : ""}>{option.label}</span>
                                      {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-accent" />}
                                    </>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </div>
                        </Listbox>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-300">Заголовок</label>
                        <input
                          value={broadcastTitle}
                          onChange={(e) => setBroadcastTitle(e.target.value.slice(0, 120))}
                          placeholder="Например: Важное объявление"
                          className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100"
                        />
                        <div className="mt-1 text-[11px] text-slate-500">{broadcastTitle.length}/120</div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-300">Текст</label>
                        <textarea
                          value={broadcastMessage}
                          onChange={(e) => setBroadcastMessage(e.target.value.slice(0, 500))}
                          rows={4}
                          placeholder="Текст уведомления для всех игроков"
                          className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100"
                        />
                        <div className="mt-1 text-[11px] text-slate-500">{broadcastMessage.length}/500</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={sendBroadcastNotification}
                          disabled={saving || !broadcastTitle.trim() || !broadcastMessage.trim()}
                          className="rounded-lg bg-arc-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                        >
                          Отправить уведомление всем
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBroadcastTitle("");
                            setBroadcastMessage("");
                            setBroadcastCategory("system");
                          }}
                          disabled={saving}
                          className="rounded-lg bg-slate-600/20 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-60"
                        >
                          Очистить
                        </button>
                      </div>
                    </div>
                  )}

                  {activeCategory === "countries" && (
                  <>
                  <div>
                    <label className="mb-1 block text-xs text-slate-300">Страна</label>
                    <Listbox value={selectedCountryId} onChange={setSelectedCountryId}>
                      <div className="relative">
                        <Listbox.Button className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 pr-10 text-left text-sm text-slate-100">
                          {selectedCountry?.name ?? "Выберите страну"}
                          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </Listbox.Button>
                        <Listbox.Options className="arc-scrollbar panel-border absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-lg bg-arc-panel/95 p-1 text-sm shadow-2xl outline-none">
                          {countries.map((country) => (
                            <Listbox.Option
                              key={country.id}
                              value={country.id}
                              className={({ active }) => `relative cursor-pointer rounded-md px-3 py-2 pr-9 transition ${active ? "bg-arc-accent/15 text-arc-accent" : "text-slate-300"}`}
                            >
                              {({ selected }) => (
                                <>
                                  <span className={selected ? "text-arc-accent" : ""}>{country.name}</span>
                                  {selected && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-arc-accent" />}
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
                          <label className="mb-1 block text-xs text-slate-300">Название</label>
                          <input value={countryName} onChange={(e) => setCountryName(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-2 text-xs text-slate-300"><Palette size={13} /> Цвет</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={countryColor} onChange={(e) => setCountryColor(e.target.value)} className="panel-border h-10 w-12 rounded-lg bg-black/35 p-1" />
                            <input value={countryColor} onChange={(e) => setCountryColor(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-300">Рынок страны (marketId)</label>
                          <select
                            value={marketId}
                            onChange={(e) => setMarketId(e.target.value)}
                            className="arc-scrollbar w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-slate-100"
                          >
                            {countries.map((country) => (
                              <option key={country.id} value={country.id}>
                                {country.name}
                              </option>
                            ))}
                          </select>
                          <div className="mt-1 text-[11px] text-slate-500">Чтобы вернуть собственный рынок, выберите эту же страну.</div>
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="accent-arc-accent" />
                        Страна имеет права администратора
                      </label>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="panel-border flex cursor-pointer items-center gap-2 rounded-lg bg-black/35 px-3 py-2 text-sm text-slate-200 transition hover:border-arc-accent/40">
                          <Upload size={15} className="text-arc-accent" />
                          <span className="truncate">{flagFile ? flagFile.name : "Загрузить флаг"}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => setFlagFile(e.target.files?.[0] ?? null)} />
                        </label>
                        <label className="panel-border flex cursor-pointer items-center gap-2 rounded-lg bg-black/35 px-3 py-2 text-sm text-slate-200 transition hover:border-arc-accent/40">
                          <Upload size={15} className="text-arc-accent" />
                          <span className="truncate">{crestFile ? crestFile.name : "Загрузить герб"}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => setCrestFile(e.target.files?.[0] ?? null)} />
                        </label>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="panel-border rounded-lg bg-black/25 p-2">
                          <div className="mb-2 text-xs text-slate-400">Флаг</div>
                          <div className="h-24 rounded-md bg-black/35">
                            {flagPreviewUrl ? <img src={flagPreviewUrl} alt="flag" className="h-full w-full object-contain p-1" /> : <div className="flex h-full items-center justify-center text-xs text-slate-500">Нет</div>}
                          </div>
                        </div>
                        <div className="panel-border rounded-lg bg-black/25 p-2">
                          <div className="mb-2 text-xs text-slate-400">Герб</div>
                          <div className="h-24 rounded-md bg-black/35">
                            {crestPreviewUrl ? <img src={crestPreviewUrl} alt="crest" className="h-full w-full object-contain p-1" /> : <div className="flex h-full items-center justify-center text-xs text-slate-500">Нет</div>}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button onClick={saveCountry} disabled={saving} className="rounded-lg bg-arc-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-60">
                          Сохранить изменения
                        </button>
                        <button onClick={deleteCountry} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-rose-600/20 px-4 py-2 text-sm font-semibold text-rose-300 disabled:opacity-60">
                          <Trash2 size={14} />
                          Удалить страну
                        </button>
                      </div>
                        </>
                      )}

                      {countrySection === "punishments" && (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                            <div className="mb-2 text-[11px] uppercase tracking-wide text-white/45">Текущий статус</div>
                            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
                              <span className="text-white/70">Состояние:</span>{" "}
                              <span className="font-medium text-arc-accent">{punishmentStatus}</span>
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                            <div className="mb-3 text-[11px] uppercase tracking-wide text-white/45">Причина для игрока</div>
                            <label className="mb-1 block text-xs text-slate-300">Причина блокировки (необязательно)</label>
                            <textarea
                              value={punishmentReasonText}
                              onChange={(e) => setPunishmentReasonText(e.target.value.slice(0, 300))}
                              rows={3}
                              placeholder="Например: нарушение правил сервера"
                              className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-rose-400/30"
                            />
                            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                              <span>Будет показана игроку при попытке входа</span>
                              <span>{punishmentReasonText.length}/300</span>
                            </div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                              <div className="mb-3 text-[11px] uppercase tracking-wide text-white/45">Блокировка по ходам</div>
                              <div className="flex flex-col gap-3">
                                <div className="w-full">
                                  <label className="mb-1 block text-xs text-slate-300">Количество ходов</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={turnsToBlock}
                                    onChange={(e) => setTurnsToBlock(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm outline-none transition focus:border-rose-400/30"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => applyPunishment({ action: "turns", turns: turnsToBlock })}
                                  disabled={saving}
                                  className="self-start rounded-lg border border-rose-400/20 bg-rose-600/20 px-3 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-600/25 disabled:opacity-60"
                                >
                                  Заблокировать
                                </button>
                              </div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                              <div className="mb-3 text-[11px] uppercase tracking-wide text-white/45">Блокировка по времени</div>
                              <div className="flex flex-col gap-3">
                                <div>
                                  <label className="mb-1 block text-xs text-slate-300">До даты и времени</label>
                                  <input
                                    type="datetime-local"
                                    value={blockUntilAt}
                                    onChange={(e) => setBlockUntilAt(e.target.value)}
                                    className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm outline-none transition focus:border-rose-400/30"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => blockUntilAt && applyPunishment({ action: "time", blockedUntilAt: new Date(blockUntilAt).toISOString() })}
                                  disabled={saving || !blockUntilAt}
                                  className="self-start rounded-lg border border-rose-400/20 bg-rose-600/20 px-3 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-600/25 disabled:opacity-60"
                                >
                                  Заблокировать по времени
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                            <div className="mb-3 text-[11px] uppercase tracking-wide text-white/45">Быстрые действия</div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => applyPunishment({ action: "permanent" })}
                                disabled={saving}
                                className="rounded-lg border border-rose-400/25 bg-rose-700/25 px-3 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-700/35 disabled:opacity-60"
                              >
                                Перманентная блокировка
                              </button>
                              <button
                                type="button"
                                onClick={() => applyPunishment({ action: "unlock" })}
                                disabled={saving}
                                className="rounded-lg border border-emerald-400/25 bg-emerald-600/20 px-3 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-600/25 disabled:opacity-60"
                              >
                                Снять блокировку
                              </button>
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                            <div className="mb-3 text-[11px] uppercase tracking-wide text-white/45">Исключение из ожидания хода</div>
                            <div className="mb-2 text-xs text-slate-400">
                              Страна не будет учитываться при проверке готовности к резолву до указанного хода включительно.
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                              <div className="min-w-0 flex-1 sm:max-w-[220px]">
                                <label className="mb-1 block text-xs text-slate-300">До хода (включительно)</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={ignoreUntilTurn}
                                  onChange={(e) => setIgnoreUntilTurn(Math.max(0, Number(e.target.value) || 0))}
                                  className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm outline-none transition focus:border-amber-400/30"
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveIgnoreUntilTurn(ignoreUntilTurn <= 0 ? null : ignoreUntilTurn)}
                                  disabled={saving}
                                  className="rounded-lg border border-amber-400/20 bg-amber-600/20 px-3 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-600/25 disabled:opacity-60"
                                >
                                  Применить исключение
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveIgnoreUntilTurn(null)}
                                  disabled={saving}
                                  className="rounded-lg border border-slate-400/20 bg-slate-600/20 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-600/30 disabled:opacity-60"
                                >
                                  Сбросить
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
