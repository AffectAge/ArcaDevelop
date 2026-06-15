import type { WorldBase } from "@arcanorum/shared";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronUp,
  Coins,
  Factory,
  Hammer,
  Lock,
  MapPin,
  Package,
  Pencil,
  Power,
  Plus,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  cancelCountryBuild,
  demolishCountryBuild,
  fetchContentEntries,
  fetchCountries,
  fetchMarketOverview,
  fetchPublicGameUiSettings,
  setCountryBuildAutoUpgradeState,
  setCountryBuildCustomName,
  setCountryBuildManualWorkState,
  setCountryBuildSubsidyState,
  upgradeCountryBuildState,
  type ContentEntry,
  type MarketOverviewResponse,
  type ResourceIconsMap,
} from "../lib/api";
import { useGameStore } from "../store/gameStore";
import { CustomSelect } from "./CustomSelect";
import { TextInputModal } from "./TextInputModal";
import { Tooltip } from "./Tooltip";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState, AppToolbar } from "./ui/AppSurface";
import { tUi } from "../i18n/uiText";

type Props = {
  open: boolean;
  onClose: () => void;
  worldBase: WorldBase | null;
  countryId: string;
  countryName: string;
  initialRegionId?: string | null;
  constructionRequestId?: number;
  onQueueBuildOrder: (regionId: string, payload?: Record<string, unknown>) => void;
};

type Card = {
  key: string;
  kind: "built" | "construction";
  instanceId?: string;
  queueId?: string;
  regionId: string;
  regionName: string;
  regionOwnerCountryId: string;
  buildingId: string;
  buildingName: string;
  iconUrl: string | null;
  industryLogo: string | null;
  industryName: string | null;
  sectorLogo: string | null;
  sectorName: string | null;
  ownerLabel: string;
  ownerLogo: string | null;
  ownerType: "state" | "company";
  ownerCompanyId?: string;
  isActive: boolean;
  inactiveReasons: string[];
  level: number;
  customName?: string | null;
  progressPercent: number;
  costConstruction: number;
  workersEmployed: number;
  workersDemand: number;
  lastLaborCoverage?: number;
  lastInputCoverage?: number;
  lastInfraCoverage?: number;
  lastFinanceCoverage?: number;
  lastExtractionCoverage?: number;
  lastDurabilityCoverage?: number;
  lastProductivity?: number;
  inactiveReason?: string | null;
};

type BuildAvailability = {
  available: boolean;
  reasons: string[];
};

const OTHER_INDUSTRY_GROUP_ID = "__other_industry__";

function getBuildingIndustryId(building: ContentEntry): string {
  const value = (building as ContentEntry & { industryId?: unknown }).industryId;
  return typeof value === "string" && value.trim() ? value.trim() : OTHER_INDUSTRY_GROUP_ID;
}

const fmt = (v: number) => new Intl.NumberFormat("ru-RU").format(Math.max(0, Math.floor(v)));
const formatCompact = (value: number): string => {
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
};

function BuildingCardTooltip({
  building,
  availability,
  costConstruction,
  costDucats,
  industryName,
  sectorName,
  goodById,
  professionById,
  resourceIcons,
}: {
  building: ContentEntry;
  availability: BuildAvailability;
  costConstruction: number;
  costDucats: number;
  industryName: string | null;
  sectorName: string | null;
  goodById: Map<string, ContentEntry>;
  professionById: Map<string, ContentEntry>;
  resourceIcons: ResourceIconsMap;
}) {
  const inputs = (building.inputs ?? []).filter((entry) => Number(entry.amount ?? 0) > 0);
  const outputs = (building.outputs ?? []).filter((entry) => Number(entry.amount ?? 0) > 0);
  const workforce = (building.workforceRequirements ?? []).filter((entry) => Number(entry.workers ?? 0) > 0);
  const extractionGood = building.extractionGoodId ? goodById.get(building.extractionGoodId) : null;
  const description = (building.description ?? "").trim();
  const maxLevel = Math.max(1, Math.floor(Number(building.maxLevel ?? 1)));
  const maxDurability = Math.max(0, Math.floor(Number(building.maxDurability ?? 0)));
  const startingDucats = Math.max(0, Math.floor(Number(building.startingDucats ?? 0)));

  const goodLabel = (goodId: string) => goodById.get(goodId)?.name ?? goodId;
  const professionLabel = (professionId: string) => professionById.get(professionId)?.name ?? professionId;

  const resourceLine = (
    iconUrl: string | null | undefined,
    fallback: ReactNode,
    label: string,
    value: string,
    tone = "text-[var(--arc-color-text)]",
  ) => (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex min-w-0 items-center gap-2 text-[var(--arc-modal-tooltip-muted)]">
        {iconUrl ? <img src={iconUrl} alt="" className="h-4 w-4 object-contain" /> : fallback}
        <span className="truncate">{label}</span>
      </span>
      <span className={`shrink-0 font-semibold tabular-nums ${tone}`}>{value}</span>
    </div>
  );

  return (
    <div className="w-[min(88vw,440px)] overflow-hidden rounded-lg border border-[var(--arc-modal-tooltip-border)] bg-[var(--arc-modal-tooltip-panel)] text-[var(--arc-modal-tooltip-text)] shadow-2xl">
      <div className="flex items-start gap-3 border-b border-[var(--arc-modal-tooltip-border)] bg-gradient-to-b from-[var(--arc-modal-header-top)] to-[var(--arc-modal-header-bottom)] p-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--arc-color-gold)] bg-[var(--arc-overlay-45)]">
          {building.logoUrl ? <img src={building.logoUrl} alt="" className="h-9 w-9 object-contain" /> : <Factory size={24} className="text-[var(--arc-color-gold)]" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl font-semibold leading-6 text-[var(--arc-modal-tooltip-title)]">{building.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wide text-[var(--arc-modal-tooltip-muted)]">
            {industryName ? <span>{industryName}</span> : null}
            {industryName && sectorName ? <span className="text-[var(--arc-color-gold-soft)]">/</span> : null}
            {sectorName ? <span>{sectorName}</span> : null}
          </div>
        </div>
        <div className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${availability.available ? "border-[var(--arc-modal-tooltip-positive)] bg-[var(--arc-modal-tooltip-positive-bg)] text-[var(--arc-modal-tooltip-positive)]" : "border-[var(--arc-modal-tooltip-negative)] bg-[var(--arc-modal-tooltip-negative-bg)] text-[var(--arc-modal-tooltip-negative)]"}`}>
          {availability.available ? "Доступно" : "Недоступно"}
        </div>
      </div>

      <div className="space-y-3 p-3 text-sm">
        <div className="space-y-1.5">
          {resourceLine(resourceIcons.construction, <Hammer size={14} className="text-[var(--arc-modal-tooltip-positive)]" />, "Очки строительства", formatCompact(costConstruction), "text-[var(--arc-modal-tooltip-positive)]")}
          {resourceLine(resourceIcons.ducats, <Coins size={14} className="text-[var(--arc-modal-tooltip-warning)]" />, "Дукаты", formatCompact(costDucats), costDucats > 0 ? "text-[var(--arc-modal-tooltip-warning)]" : "text-[var(--arc-modal-tooltip-muted)]")}
          {startingDucats > 0 ? resourceLine(resourceIcons.ducats, <Coins size={14} className="text-[var(--arc-modal-tooltip-warning)]" />, "Стартовый капитал", formatCompact(startingDucats), "text-[var(--arc-modal-tooltip-warning)]") : null}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-[var(--arc-modal-tooltip-border)] bg-[var(--arc-overlay-30)] px-2 py-1.5">
            <div className="text-[var(--arc-modal-tooltip-muted)]">Макс. уровень</div>
            <div className="mt-0.5 font-semibold text-[var(--arc-modal-tooltip-title)]">{maxLevel}</div>
          </div>
          <div className="rounded-md border border-[var(--arc-modal-tooltip-border)] bg-[var(--arc-overlay-30)] px-2 py-1.5">
            <div className="text-[var(--arc-modal-tooltip-muted)]">Прочность</div>
            <div className="mt-0.5 font-semibold text-[var(--arc-modal-tooltip-title)]">{maxDurability > 0 ? formatCompact(maxDurability) : "—"}</div>
          </div>
        </div>

        {outputs.length > 0 || extractionGood ? (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--arc-modal-tooltip-muted)]">Производит</div>
            {outputs.map((entry) => (
              <div key={`out-${entry.goodId}`} className="flex items-center justify-between gap-3 text-[var(--arc-modal-tooltip-good)]">
                <span className="truncate">+{entry.amount} {goodLabel(entry.goodId)}</span>
                {entry.affectedByFertility ? <span className="text-[11px] text-[var(--arc-modal-tooltip-muted)]">плодородие</span> : null}
              </div>
            ))}
            {extractionGood ? (
              <div className="flex items-center justify-between gap-3 text-[var(--arc-modal-tooltip-good)]">
                <span className="truncate">+{formatCompact(Number(building.extractionAmountPerTurn ?? 0))} {extractionGood.name}</span>
                <span className="text-[11px] text-[var(--arc-modal-tooltip-muted)]">{building.extractionRequiresDeposit ? "требует залежь" : "добыча"}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {inputs.length > 0 ? (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--arc-modal-tooltip-muted)]">Потребляет</div>
            {inputs.map((entry) => (
              <div key={`in-${entry.goodId}`} className="flex items-center justify-between gap-3 text-[var(--arc-modal-tooltip-bad)]">
                <span className="truncate">-{entry.amount} {goodLabel(entry.goodId)}</span>
                {entry.affectedByFertility ? <span className="text-[11px] text-[var(--arc-modal-tooltip-muted)]">плодородие</span> : null}
              </div>
            ))}
          </div>
        ) : null}

        {workforce.length > 0 ? (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--arc-modal-tooltip-muted)]">Рабочая сила</div>
            {workforce.map((entry) => (
              <div key={entry.professionId} className="flex items-center justify-between gap-3">
                <span className="truncate text-[var(--arc-modal-tooltip-muted)]">{professionLabel(entry.professionId)}</span>
                <span className="font-semibold tabular-nums text-[var(--arc-modal-tooltip-title)]">{formatCompact(Number(entry.workers ?? 0))}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-1 border-t border-[var(--arc-modal-tooltip-border)] pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--arc-modal-tooltip-muted)]">Условия</div>
          {availability.available ? (
            <div className="text-[var(--arc-modal-tooltip-positive)]">Да Можно добавить в очередь строительства</div>
          ) : (
            availability.reasons.map((reason) => (
              <div key={reason} className="text-[var(--arc-modal-tooltip-negative)]">
                Нет {reason}
              </div>
            ))
          )}
        </div>

        {description ? <div className="border-t border-[var(--arc-modal-tooltip-border)] pt-3 text-[13px] leading-5 text-[var(--arc-modal-tooltip-description)]">{description}</div> : null}
      </div>
    </div>
  );
}

function IndustryBuildingTooltip({
  card,
  building,
  economy,
  inactiveReasons,
  displayIsActive,
  limitingFactor,
  productivityPct,
  durabilityPct,
  maxLevel,
  resourceIcons,
}: {
  card: Card;
  building?: ContentEntry;
  economy: ReturnType<() => {
    productivity: number;
    inputCost: number;
    outputRevenue: number;
    wagesCost: number;
    stateSubsidyDucats: number;
    upgradeCostDucats: number;
    netPerTurn: number;
    durabilityCurrent: number;
    durabilityMax: number;
    durabilityCoverage: number;
    storageAmount: number;
    inputs: Array<{ goodName: string; goodLogoUrl: string | null; factual: number; max: number; cost: number }>;
    outputs: Array<{ goodName: string; goodLogoUrl: string | null; factual: number; max: number; income: number }>;
    extractions: Array<{ goodName: string; goodLogoUrl: string | null; factual: number; max: number }>;
    stockRows: Array<{ goodName: string; goodLogoUrl: string | null; available: number; incoming: number; outgoing: number; remainder: number }>;
    trade: Array<{ kind: "buy" | "sell"; goodName: string; goodLogoUrl: string | null; amount: number; total: number }>;
  }> | null;
  inactiveReasons: string[];
  displayIsActive: boolean;
  limitingFactor: { text: string; tooltip: string } | null;
  productivityPct: number;
  durabilityPct: number;
  maxLevel: number;
  resourceIcons: ResourceIconsMap;
}) {
  const netPerTurn = economy?.netPerTurn ?? 0;
  const storageAmount = economy?.storageAmount ?? 0;
  const subsidy = economy?.stateSubsidyDucats ?? 0;
  const displayName = card.customName?.trim() ? card.customName.trim() : card.buildingName || card.buildingId;

  const moneyChip = (label: string, value: number, tone: string) => (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex min-w-0 items-center gap-2 text-[var(--arc-modal-tooltip-muted)]">
        {resourceIcons.ducats ? <img src={resourceIcons.ducats} alt="" className="h-4 w-4 object-contain" /> : <Coins size={14} className="text-[var(--arc-modal-tooltip-warning)]" />}
        <span className="truncate">{label}</span>
      </span>
      <span className={`shrink-0 font-semibold tabular-nums ${tone}`}>
        {value > 0 ? "+" : ""}
        {formatCompact(value)}
      </span>
    </div>
  );

  const outputRows = [...(economy?.outputs ?? []), ...(economy?.extractions ?? []).map((entry) => ({ ...entry, income: 0 }))];

  return (
    <div className="w-[min(92vw,720px)] overflow-hidden rounded-lg border border-[var(--arc-modal-tooltip-border)] bg-[var(--arc-modal-tooltip-panel)] text-[var(--arc-modal-tooltip-text)] shadow-2xl">
      <div className="flex items-center gap-3 border-b border-[var(--arc-modal-tooltip-border)] bg-gradient-to-b from-[var(--arc-modal-header-top)] to-[var(--arc-modal-header-bottom)] px-3 py-2.5">
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--arc-color-gold)] bg-[var(--arc-overlay-45)]">
          {card.iconUrl ? <img src={card.iconUrl} alt="" className="h-8 w-8 object-cover" /> : <Factory size={22} className="text-[var(--arc-color-gold)]" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold leading-5 text-[var(--arc-modal-tooltip-title)]">{displayName}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wide text-[var(--arc-modal-tooltip-muted)]">
            {card.industryName ? <span>{card.industryName}</span> : null}
            {card.industryName && card.sectorName ? <span className="text-[var(--arc-modal-tooltip-divider)]">/</span> : null}
            {card.sectorName ? <span>{card.sectorName}</span> : null}
            <span className="text-[var(--arc-modal-tooltip-divider)]">/</span>
            <span>{card.regionName}</span>
          </div>
        </div>
        <div className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${displayIsActive ? "border-[var(--arc-modal-tooltip-positive)] bg-[var(--arc-modal-tooltip-positive-bg)] text-[var(--arc-modal-tooltip-positive)]" : "border-[var(--arc-modal-tooltip-negative)] bg-[var(--arc-modal-tooltip-negative-bg)] text-[var(--arc-modal-tooltip-negative)]"}`}>
          {displayIsActive ? "Работает" : "Остановлено"}
        </div>
      </div>

      <div className="grid gap-3 p-3 text-xs md:grid-cols-[1fr_1fr]">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-[var(--arc-modal-tooltip-border)] bg-[var(--arc-overlay-30)] px-2 py-1.5">
              <div className="text-[var(--arc-modal-tooltip-label)]">Уровень</div>
              <div className="mt-0.5 font-semibold text-[var(--arc-modal-tooltip-value)]">{card.level} / {maxLevel}</div>
            </div>
            <div className="rounded-md border border-[var(--arc-modal-tooltip-border)] bg-[var(--arc-overlay-30)] px-2 py-1.5">
              <div className="text-[var(--arc-modal-tooltip-label)]">Рабочие</div>
              <div className="mt-0.5 font-semibold text-[var(--arc-modal-tooltip-value)]">{formatCompact(card.workersEmployed)} / {formatCompact(card.workersDemand)}</div>
            </div>
          </div>
          <div className="rounded-md border border-[var(--arc-modal-tooltip-border)] bg-[var(--arc-overlay-30)] px-2 py-1.5">
            <span className="text-[var(--arc-modal-tooltip-label)]">Владелец: </span>
            <span className="font-semibold text-[var(--arc-modal-tooltip-value)]">{card.ownerLabel}</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--arc-modal-tooltip-muted)]">Производительность</span>
              <span className="font-semibold text-[var(--arc-modal-tooltip-positive)]">{productivityPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full border border-[var(--arc-modal-tooltip-border)] bg-black/45">
              <div className="h-full bg-[var(--arc-modal-tooltip-progress)]" style={{ width: `${Math.min(100, productivityPct)}%` }} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--arc-modal-tooltip-muted)]">Прочность</span>
              <span className="font-semibold text-[var(--arc-modal-tooltip-info)]">{durabilityPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full border border-[var(--arc-modal-tooltip-border)] bg-black/45">
              <div className="h-full bg-[var(--arc-modal-tooltip-info-progress)]" style={{ width: `${durabilityPct}%` }} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {economy ? (
          <div className="space-y-1.5">
            {moneyChip("Касса здания", storageAmount, "text-[var(--arc-modal-tooltip-value)]")}
            {moneyChip("Доход от продаж", economy.outputRevenue, "text-[var(--arc-modal-tooltip-positive)]")}
            {moneyChip("Входные товары", -economy.inputCost, "text-[var(--arc-modal-tooltip-negative)]")}
            {moneyChip("Зарплаты", -economy.wagesCost, "text-[var(--arc-modal-tooltip-negative)]")}
            {subsidy > 0 ? moneyChip("Госсубсидии", subsidy, "text-[var(--arc-modal-tooltip-warning)]") : null}
            {moneyChip("Итог за ход", netPerTurn, netPerTurn >= 0 ? "text-[var(--arc-modal-tooltip-positive)]" : "text-[var(--arc-modal-tooltip-negative)]")}
          </div>
          ) : null}
        </div>

        <div className="space-y-1">
          {outputRows.length > 0 ? (
          <>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--arc-modal-tooltip-muted)]">Выпуск</div>
            {outputRows.slice(0, 3).map((entry) => (
              <div key={`out-${entry.goodName}`} className="flex items-center justify-between gap-3 text-[var(--arc-modal-tooltip-text)]">
                <span className="truncate">{entry.goodName}</span>
                <span className="shrink-0 tabular-nums">{formatCompact(entry.factual)} / {formatCompact(entry.max)}</span>
              </div>
            ))}
          </>
          ) : null}
        </div>

        <div className="space-y-1">
          {(economy?.inputs ?? []).length > 0 ? (
          <>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--arc-modal-tooltip-muted)]">Потребление</div>
            {(economy?.inputs ?? []).slice(0, 3).map((entry) => (
              <div key={`in-${entry.goodName}`} className="flex items-center justify-between gap-3 text-[var(--arc-modal-tooltip-text)]">
                <span className="truncate">{entry.goodName}</span>
                <span className="shrink-0 tabular-nums">{formatCompact(entry.factual)} / {formatCompact(entry.max)}</span>
              </div>
            ))}
          </>
          ) : null}
        </div>

        {(limitingFactor || !displayIsActive) ? (
          <div className="md:col-span-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--arc-modal-tooltip-border)] pt-2">
            {limitingFactor ? <span className="text-[var(--arc-modal-tooltip-warning)]">{limitingFactor.text}</span> : null}
            {!displayIsActive ? <span className="text-[var(--arc-modal-tooltip-negative)]">{inactiveReasons[0] ?? "Здание не работает"}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProvinceBuildingsModal({ open, onClose, worldBase, countryId, countryName, initialRegionId, constructionRequestId = 0, onQueueBuildOrder }: Props) {
  const [buildings, setBuildings] = useState<ContentEntry[]>([]);
  const [technologies, setTechnologies] = useState<ContentEntry[]>([]);
  const [industries, setIndustries] = useState<ContentEntry[]>([]);
  const [sectors, setSectors] = useState<ContentEntry[]>([]);
  const [goods, setGoods] = useState<ContentEntry[]>([]);
  const [professions, setProfessions] = useState<ContentEntry[]>([]);
  const [companies, setCompanies] = useState<ContentEntry[]>([]);
  const [countries, setCountries] = useState<Array<{ id: string; name: string; flagUrl?: string | null }>>([]);
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
  const [constructionOpen, setConstructionOpen] = useState(false);
  const [openConstructionIndustryGroups, setOpenConstructionIndustryGroups] = useState<Record<string, boolean>>({});
  const [demolitionCostConstructionPercent, setDemolitionCostConstructionPercent] = useState(20);
  const [buildCountryId, setBuildCountryId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [ownerType, setOwnerType] = useState<"state" | "company">("state");
  const [ownerCountryId, setOwnerCountryId] = useState("");
  const [ownerCompanyId, setOwnerCompanyId] = useState("");
  const [cancelingQueueKey, setCancelingQueueKey] = useState<string | null>(null);
  const [demolishingCardKey, setDemolishingCardKey] = useState<string | null>(null);
  const [upgradingCardKey, setUpgradingCardKey] = useState<string | null>(null);
  const [togglingAutoUpgradeCardKey, setTogglingAutoUpgradeCardKey] = useState<string | null>(null);
  const [togglingSubsidyCardKey, setTogglingSubsidyCardKey] = useState<string | null>(null);
  const [togglingManualWorkCardKey, setTogglingManualWorkCardKey] = useState<string | null>(null);
  const [renamingCardKey, setRenamingCardKey] = useState<string | null>(null);
  const [cancelConfirmTarget, setCancelConfirmTarget] = useState<
    | null
    | {
        key: string;
        source: "pending" | "queued";
        buildingName: string;
        regionName: string;
        orderId?: string;
        regionId?: string;
        queueId?: string;
      }
  >(null);
  const [demolishConfirmTarget, setDemolishConfirmTarget] = useState<
    | null
    | {
        key: string;
        regionId: string;
        buildingId: string;
        instanceId?: string;
        buildingName: string;
        regionName: string;
        demolitionCostConstruction: number;
      }
  >(null);
  const [renameModalTarget, setRenameModalTarget] = useState<
    | null
    | {
        key: string;
        regionId: string;
        regionName: string;
        buildingId: string;
        buildingName: string;
        instanceId?: string;
        currentName?: string | null;
      }
  >(null);
  const [renameModalValue, setRenameModalValue] = useState("");
  const [filterBuildingId, setFilterBuildingId] = useState("");
  const [filterRegionId, setFilterRegionId] = useState("");
  const [filterCompanyId, setFilterCompanyId] = useState("");
  const [filterCompanyCountryId, setFilterCompanyCountryId] = useState("");
  const [filterIndustryId, setFilterIndustryId] = useState("");
  const [filterSectorId, setFilterSectorId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "construction" | "built">("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [filterEconomy, setFilterEconomy] = useState<"all" | "profit" | "loss">("all");
  const [sortBy, setSortBy] = useState<"building" | "region" | "company" | "industry" | "sector">("building");
  const [openEconomyByCardKey, setOpenEconomyByCardKey] = useState<Record<string, boolean>>({});
  const [openStatusByCardKey, setOpenStatusByCardKey] = useState<Record<string, boolean>>({});
  const [marketOverview, setMarketOverview] = useState<MarketOverviewResponse | null>(null);
  const auth = useGameStore((s) => s.auth);
  const turnId = useGameStore((s) => s.turnId);
  const ordersByTurn = useGameStore((s) => s.ordersByTurn);
  const removeOrder = useGameStore((s) => s.removeOrder);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      fetchContentEntries("buildings"),
      fetchContentEntries("technologies"),
      fetchContentEntries("industries"),
      fetchContentEntries("sectors"),
      fetchContentEntries("goods"),
      fetchContentEntries("professions"),
      fetchContentEntries("companies"),
      fetchCountries(),
      fetchPublicGameUiSettings(),
    ])
      .then(([b, tech, ind, sec, g, prof, c, ctr, ui]) => {
        if (cancelled) return;
        setBuildings(b);
        setTechnologies(tech);
        setIndustries(ind);
        setSectors(sec);
        setGoods(g);
        setProfessions(prof);
        setCompanies(c);
        setCountries(ctr);
        setResourceIcons(ui.resourceIcons);
        setDemolitionCostConstructionPercent(ui.economy?.demolitionCostConstructionPercent ?? 20);
      })
      .catch(() => {
        if (cancelled) return;
        setBuildings([]);
        setTechnologies([]);
        setIndustries([]);
        setSectors([]);
        setGoods([]);
        setProfessions([]);
        setCompanies([]);
        setCountries([]);
        setResourceIcons({
          population: null,
          culture: null,
          science: null,
          religion: null,
          colonization: null,
          construction: null,
          ducats: null,
          gold: null,
        });
        setDemolitionCostConstructionPercent(20);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !auth?.token) {
      setMarketOverview(null);
      return;
    }
    let cancelled = false;
    fetchMarketOverview(auth.token)
      .then((data) => {
        if (!cancelled) setMarketOverview(data);
      })
      .catch(() => {
        if (!cancelled) setMarketOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, auth?.token, worldBase?.turnId, countryId]);

  useEffect(() => {
    if (open) return;
    setRenameModalTarget(null);
    setRenameModalValue("");
  }, [open]);

  const buildingById = useMemo(() => new Map(buildings.map((x) => [x.id, x] as const)), [buildings]);
  const researchedTechnologyIds = useMemo(
    () => new Set(worldBase?.technologyByCountry?.[countryId]?.researchedTechnologyIds ?? []),
    [countryId, worldBase?.technologyByCountry],
  );
  const unlockingTechnologyByBuildingId = useMemo(() => {
    const map = new Map<string, ContentEntry>();
    for (const technology of technologies) {
      for (const buildingId of technology.unlockBuildingIds ?? []) {
        map.set(buildingId, technology);
      }
    }
    return map;
  }, [technologies]);
  const sortedBuildings = useMemo(() => [...buildings].sort((a, b) => a.name.localeCompare(b.name, "ru")), [buildings]);
  const industryById = useMemo(() => new Map(industries.map((x) => [x.id, x] as const)), [industries]);
  const sectorById = useMemo(() => new Map(sectors.map((x) => [x.id, x] as const)), [sectors]);
  const goodById = useMemo(() => new Map(goods.map((x) => [x.id, x] as const)), [goods]);
  const professionById = useMemo(() => new Map(professions.map((x) => [x.id, x] as const)), [professions]);
  const companyById = useMemo(() => new Map(companies.map((x) => [x.id, x] as const)), [companies]);
  const countryById = useMemo(() => new Map(countries.map((x) => [x.id, x] as const)), [countries]);

  const myRegions = useMemo(() => {
    if (!worldBase) return [];
    return Object.entries(worldBase.regionOwner)
      .filter(([, owner]) => owner === countryId)
      .map(([id]) => ({ id, name: id }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [countryId, worldBase]);

  const buildCountryOptions = useMemo(() => {
    // TODO: add foreign countries here when diplomacy/build access permissions are implemented.
    const own = countryById.get(countryId);
    return [{ id: countryId, name: own?.name ?? countryName }];
  }, [countryById, countryId, countryName]);

  const ownerCountryOptions = useMemo(() => {
    // Uses the same permission source as build-country selection.
    return buildCountryOptions;
  }, [buildCountryOptions]);

  const buildRegions = useMemo(() => {
    if (!worldBase || !buildCountryId) return [];
    return Object.entries(worldBase.regionOwner)
      .filter(([, owner]) => owner === buildCountryId)
      .map(([id]) => ({ id, name: id }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [buildCountryId, worldBase]);

  useEffect(() => {
    if (!open) return;
    setBuildCountryId(countryId);
    const requestedRegion =
      initialRegionId && myRegions.some((region) => region.id === initialRegionId)
        ? initialRegionId
        : myRegions[0]?.id ?? "";
    setRegionId(requestedRegion);
    setBuildingId(buildings[0]?.id ?? "");
    setOwnerCountryId(countryId);
    setOwnerCompanyId(companies[0]?.id ?? "");
    setOwnerType("state");
  }, [open, myRegions, buildings, companies, countryId, initialRegionId]);

  useEffect(() => {
    if (!open) return;
    if (initialRegionId && buildRegions.some((region) => region.id === initialRegionId)) {
      setRegionId(initialRegionId);
      return;
    }
    setRegionId((current) => (buildRegions.some((region) => region.id === current) ? current : buildRegions[0]?.id ?? ""));
  }, [buildRegions, initialRegionId, open]);

  useEffect(() => {
    if (!open || constructionRequestId <= 0) return;
    setConstructionOpen(true);
  }, [constructionRequestId, open]);

  useEffect(() => {
    if (!open || ownerType !== "state") return;
    const hasSelected = ownerCountryOptions.some((country) => country.id === ownerCountryId);
    if (hasSelected) return;
    setOwnerCountryId(ownerCountryOptions[0]?.id ?? countryId);
  }, [open, ownerType, ownerCountryOptions, ownerCountryId, countryId]);

  const cards = useMemo<Card[]>(() => {
    if (!worldBase) return [];
    const res: Card[] = [];
    for (const prov of myRegions) {
      const pid = prov.id;
      const pop = Math.max(
        0,
        Math.floor((worldBase.regionPopulationByRegion[pid]?.pops ?? []).reduce((sum, row) => sum + Math.max(0, Number(row.size)), 0)),
      );
      const instances = worldBase.regionBuildingsByRegion[pid] ?? [];
      const countsByBuildingId = instances.reduce<Record<string, number>>((acc, instance) => {
        const instanceLevel = Math.max(1, Math.floor(Number(instance.level ?? 1)));
        acc[instance.buildingId] = (acc[instance.buildingId] ?? 0) + instanceLevel;
        return acc;
      }, {});
      const workersDemandByBuildingId = Object.entries(countsByBuildingId).reduce<Record<string, number>>(
        (acc, [buildingId, count]) => {
          const b = buildingById.get(buildingId);
          if (!b) return acc;
          const perLevel = (b.workforceRequirements ?? []).reduce((s, r) => s + Math.max(0, r.workers), 0);
          acc[buildingId] = Math.max(0, perLevel * count);
          return acc;
        },
        {},
      );
      const totalWorkersDemand = Object.values(workersDemandByBuildingId).reduce((sum, value) => sum + value, 0);
      const employmentRatio = totalWorkersDemand > 0 ? Math.max(0, Math.min(1, pop / totalWorkersDemand)) : 0;

      for (const instance of instances) {
        const bid = instance.buildingId;
        const b = buildingById.get(bid);
        if (!b) continue;
        const instanceLevel = Math.max(1, Math.floor(Number(instance.level ?? 1)));
        const workersDemandBase = (b.workforceRequirements ?? []).reduce(
          (s, r) => s + Math.max(0, r.workers),
          0,
        );
        const workersDemandPerLevel = workersDemandBase * instanceLevel;
        const laborCoverage = Math.max(
          0,
          Math.min(1, typeof instance.lastLaborCoverage === "number" ? instance.lastLaborCoverage : employmentRatio),
        );
        const workersEmployed = Math.round(workersDemandPerLevel * laborCoverage);
        const inactiveReasons: string[] = [];
        if (instance.inactiveReason) {
          inactiveReasons.push(instance.inactiveReason);
        }
        const industryId = (((b as { industryId?: string } | undefined)?.industryId ?? "") as string).trim();
        const sectorId = (((b as { sectorId?: string } | undefined)?.sectorId ?? "") as string).trim();
        const industry = industryById.get(industryId);
        const sector = sectorById.get(sectorId);
        const ownerLabel =
          instance.owner.type === "company"
            ? companyById.get(instance.owner.companyId)?.name ?? instance.owner.companyId
            : countryById.get(instance.owner.countryId)?.name ?? instance.owner.countryId;
        const ownerLogo =
          instance.owner.type === "company"
            ? companyById.get(instance.owner.companyId)?.logoUrl ?? null
            : countryById.get(instance.owner.countryId)?.flagUrl ?? null;
        res.push({
          key: `${pid}-${instance.instanceId}-built`,
          kind: "built",
          instanceId: instance.instanceId,
          queueId: undefined,
          regionId: pid,
          regionName: prov.name,
          regionOwnerCountryId: worldBase.regionOwner[pid] ?? "",
          buildingId: bid,
          buildingName: b.name,
          iconUrl: b.logoUrl ?? null,
          industryLogo: industry?.logoUrl ?? null,
          industryName: industry?.name ?? null,
          sectorLogo: sector?.logoUrl ?? null,
          sectorName: sector?.name ?? null,
          ownerLabel,
          ownerLogo,
          ownerType: instance.owner.type,
          ownerCompanyId: instance.owner.type === "company" ? instance.owner.companyId : undefined,
          isActive: !(instance.isInactive ?? false) && !instance.inactiveReason,
          inactiveReasons,
          level: instanceLevel,
          customName: typeof instance.customName === "string" ? instance.customName : null,
          progressPercent: 100,
          costConstruction: Math.max(1, Math.floor(Number(b.costConstruction ?? 100))),
          workersEmployed,
          workersDemand: workersDemandPerLevel,
          lastLaborCoverage: typeof instance.lastLaborCoverage === "number" ? instance.lastLaborCoverage : undefined,
          lastInputCoverage: typeof instance.lastInputCoverage === "number" ? instance.lastInputCoverage : undefined,
          lastInfraCoverage: typeof instance.lastInfraCoverage === "number" ? instance.lastInfraCoverage : undefined,
          lastFinanceCoverage: typeof instance.lastFinanceCoverage === "number" ? instance.lastFinanceCoverage : undefined,
          lastExtractionCoverage:
            typeof instance.lastExtractionCoverage === "number" ? instance.lastExtractionCoverage : undefined,
          lastDurabilityCoverage:
            typeof instance.lastDurabilityCoverage === "number" ? instance.lastDurabilityCoverage : undefined,
          lastProductivity: typeof instance.lastProductivity === "number" ? instance.lastProductivity : undefined,
          inactiveReason: instance.inactiveReason ?? null,
        });
      }
      for (const q of worldBase.regionConstructionQueueByRegion[pid] ?? []) {
        const b = buildingById.get(q.buildingId);
        if (!b) continue;
        const ownerLabel = q.owner.type === "company" ? companyById.get(q.owner.companyId)?.name ?? q.owner.companyId : countryById.get(q.owner.countryId)?.name ?? q.owner.countryId;
        const ownerLogo = q.owner.type === "company" ? companyById.get(q.owner.companyId)?.logoUrl ?? null : countryById.get(q.owner.countryId)?.flagUrl ?? null;
        const progressPercent = Math.min(100, Math.round((q.progressConstruction / Math.max(1, q.costConstruction)) * 100));
        res.push({
          key: `${pid}-${q.queueId}-construction`,
          kind: "construction",
          queueId: q.queueId,
          regionId: pid,
          regionName: prov.name,
          regionOwnerCountryId: worldBase.regionOwner[pid] ?? "",
          buildingId: q.buildingId,
          buildingName: b.name,
          iconUrl: b.logoUrl ?? null,
          industryLogo: null,
          industryName: null,
          sectorLogo: null,
          sectorName: null,
          ownerLabel,
          ownerLogo,
          ownerType: q.owner.type,
          ownerCompanyId: q.owner.type === "company" ? q.owner.companyId : undefined,
          isActive: true,
          inactiveReasons: [],
          level: 0,
          customName: null,
          progressPercent,
          costConstruction: Math.max(1, Math.floor(Number(q.costConstruction || b.costConstruction || 100))),
          workersEmployed: 0,
          workersDemand: 0,
          inactiveReason: null,
        });
      }
    }
    return res;
  }, [worldBase, myRegions, buildingById, industryById, sectorById, countryById, companyById]);

  const constructionQueue = useMemo(
    () => {
      const committed: Array<{
        key: string;
        source: "queued";
        regionId: string;
        regionName: string;
        buildingName: string;
        ownerLabel: string;
        projectLabel: string;
        progressPercent: number;
        iconUrl: string | null;
        queueId: string;
      }> = [];
      for (const region of myRegions) {
        const queue = worldBase?.regionConstructionQueueByRegion?.[region.id] ?? [];
        for (const project of queue) {
          const building = buildingById.get(project.buildingId);
          if (!building) continue;
          const ownerLabel =
            project.owner.type === "company"
              ? companyById.get(project.owner.companyId)?.name ?? project.owner.companyId
              : countryById.get(project.owner.countryId)?.name ?? project.owner.countryId;
          committed.push({
            key: `queued-${region.id}-${project.queueId}`,
            source: "queued",
            regionId: region.id,
            regionName: region.name,
            buildingName: building.name,
            ownerLabel,
            projectLabel: (project.projectType ?? "build") === "upgrade" ? "Повышение уровня" : "Новое здание",
            progressPercent: Math.min(100, Math.round((project.progressConstruction / Math.max(1, project.costConstruction)) * 100)),
            iconUrl: building.logoUrl ?? null,
            queueId: project.queueId,
          });
        }
      }

      const pending: Array<{
        key: string;
        source: "pending";
        regionId: string;
        regionName: string;
        buildingName: string;
        ownerLabel: string;
        projectLabel: string;
        progressPercent: number;
        iconUrl: string | null;
        orderId: string;
      }> = [];
      const byPlayer = ordersByTurn.get(turnId);
      if (byPlayer) {
        for (const playerOrders of byPlayer.values()) {
          for (const order of playerOrders) {
            if (order.type !== "BUILD" || order.countryId !== countryId) continue;
            const payload = (order.payload ?? {}) as Record<string, unknown>;
            const payloadBuildingId =
              typeof payload.buildingId === "string"
                ? payload.buildingId
                : typeof payload.building === "string"
                  ? payload.building
                  : "";
            const pendingBuildingName =
              buildingById.get(payloadBuildingId)?.name ?? (payloadBuildingId || "Здание");
            const pendingRegionName =
              myRegions.find((p) => p.id === order.regionId)?.name ??
              order.regionId;
            const owner = payload.owner as { type?: "state" | "company"; countryId?: string; companyId?: string } | undefined;
            const ownerLabel =
              owner?.type === "company"
                ? companyById.get(owner.companyId ?? "")?.name ?? owner.companyId ?? "Компания"
                : countryById.get(owner?.countryId ?? countryId)?.name ?? owner?.countryId ?? countryId;
            pending.push({
              key: `pending-${order.id}`,
              source: "pending",
              regionId: order.regionId,
              regionName: pendingRegionName,
              buildingName: pendingBuildingName,
              ownerLabel,
              projectLabel: "Новое здание",
              progressPercent: 0,
              iconUrl: buildingById.get(payloadBuildingId)?.logoUrl ?? null,
              orderId: order.id,
            });
          }
        }
      }
      return [...committed, ...pending].sort(
        (a, b) =>
          Number(a.source === "queued") - Number(b.source === "queued") ||
          a.regionName.localeCompare(b.regionName, "ru") ||
          a.buildingName.localeCompare(b.buildingName, "ru"),
      );
    },
    [ordersByTurn, turnId, countryId, buildingById, myRegions, worldBase?.regionConstructionQueueByRegion, companyById, countryById],
  );

  const getCardEconomy = (card: Card) => {
    const building = buildingById.get(card.buildingId);
    const instance =
      card.kind === "built"
        ? (worldBase?.regionBuildingsByRegion?.[card.regionId] ?? []).find((x) => x.instanceId === card.instanceId)
        : null;
    const productivity =
      card.kind === "construction"
        ? card.progressPercent
        : typeof instance?.lastProductivity === "number"
          ? Math.round(Math.max(0, instance.lastProductivity) * 100)
          : card.workersDemand > 0
            ? Math.round((card.workersEmployed / card.workersDemand) * 100)
            : 100;
    if (!building) {
      return {
        productivity,
        inputCost: 0,
        outputRevenue: 0,
        wagesCost: 0,
        stateSubsidyDucats: 0,
        upgradeCostDucats: 0,
        netPerTurn: 0,
        durabilityCurrent: 0,
        durabilityMax: 0,
        durabilityCoverage: 1,
        storageAmount: 0,
        inputs: [] as Array<{ goodName: string; goodLogoUrl: string | null; factual: number; max: number; cost: number }>,
        outputs: [] as Array<{ goodName: string; goodLogoUrl: string | null; factual: number; max: number; income: number }>,
        extractions: [] as Array<{ goodName: string; goodLogoUrl: string | null; factual: number; max: number }>,
        stockRows: [] as Array<{ goodName: string; goodLogoUrl: string | null; available: number; incoming: number; outgoing: number; remainder: number }>,
        trade: [] as Array<{ kind: "buy" | "sell"; goodName: string; goodLogoUrl: string | null; amount: number; total: number }>,
      };
    }
    const ratio = Math.max(0, productivity / 100);
    const lastConsumption = instance?.lastConsumptionByGoodId ?? {};
    const lastProduction = instance?.lastProductionByGoodId ?? {};
    const lastExtraction = instance?.lastExtractionByGoodId ?? {};
    const lastPurchase = instance?.lastPurchaseByGoodId ?? {};
    const lastPurchaseCost = instance?.lastPurchaseCostByGoodId ?? {};
    const lastSales = instance?.lastSalesByGoodId ?? {};
    const lastSalesRevenue = instance?.lastSalesRevenueByGoodId ?? {};
    const instanceLevel = Math.max(1, Math.floor(Number(instance?.level ?? card.level ?? 1)));
    const inputs = (building.inputs ?? []).map((entry) => {
      const good = goodById.get(entry.goodId);
      const price = Math.max(0, Number(good?.basePrice ?? 1));
      const max = Math.max(0, Number(entry.amount ?? 0) * instanceLevel);
      const factual = Math.max(0, Number(lastConsumption[entry.goodId] ?? max * ratio));
      const cost =
        typeof instance?.lastInputCostDucats === "number"
          ? Math.max(0, Number(lastPurchaseCost[entry.goodId] ?? 0))
          : factual * price;
      return { goodName: good?.name ?? entry.goodId, goodLogoUrl: good?.logoUrl ?? null, factual, max, cost };
    });
    const outputs = (building.outputs ?? []).map((entry) => {
      const good = goodById.get(entry.goodId);
      const price = Math.max(0, Number(good?.basePrice ?? 1));
      const max = Math.max(0, Number(entry.amount ?? 0) * instanceLevel);
      const factual = Math.max(0, Number(lastProduction[entry.goodId] ?? max * ratio));
      const soldForGood = Math.max(0, Number(lastSales[entry.goodId] ?? 0));
      const revenue =
        typeof instance?.lastRevenueDucats === "number"
          ? Math.max(0, Number(lastSalesRevenue[entry.goodId] ?? 0))
          : factual * price;
      return { goodName: good?.name ?? entry.goodId, goodLogoUrl: good?.logoUrl ?? null, factual, max, income: revenue };
    });
    const extractionGoodId =
      typeof building.extractionGoodId === "string" && building.extractionGoodId.trim().length > 0
        ? building.extractionGoodId.trim()
        : "";
    const extractionAmountPerTurn = Math.max(0, Number(building.extractionAmountPerTurn ?? 0));
    const extractions = Object.entries(lastExtraction)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([goodId, amount]) => {
        const good = goodById.get(goodId);
        const factual = Math.max(0, Number(amount));
        const max =
          extractionGoodId === goodId
            ? Math.max(0, extractionAmountPerTurn * instanceLevel)
            : ratio > 0
              ? Math.max(factual, Number((factual / ratio).toFixed(3)))
              : factual;
        return {
          goodName: good?.name ?? goodId,
          goodLogoUrl: good?.logoUrl ?? null,
          factual,
          max,
        };
      });
    const inputCost =
      typeof instance?.lastInputCostDucats === "number"
        ? Math.max(0, Number(instance.lastInputCostDucats))
        : inputs.reduce((sum, entry) => sum + entry.cost, 0);
    const outputRevenue =
      typeof instance?.lastRevenueDucats === "number"
        ? Math.max(0, Number(instance.lastRevenueDucats))
        : outputs.reduce((sum, entry) => sum + entry.income, 0);
    const wagesCost =
      typeof instance?.lastWagesDucats === "number"
        ? Math.max(0, Number(instance.lastWagesDucats))
        : 0;
    const netPerTurn =
      typeof instance?.lastNetDucats === "number"
        ? Number(instance.lastNetDucats)
        : outputRevenue - inputCost - wagesCost;
    const stateSubsidyDucats =
      typeof instance?.lastStateSubsidyDucats === "number"
        ? Math.max(0, Number(instance.lastStateSubsidyDucats))
        : 0;
    const upgradeCostDucats = Math.max(
      0,
      (worldBase?.regionConstructionQueueByRegion?.[card.regionId] ?? [])
        .filter(
          (project) =>
            (project.projectType ?? "build") === "upgrade" &&
            (project.targetInstanceId ?? "") === (card.instanceId ?? ""),
        )
        .reduce((sum, project) => sum + Math.max(0, Number(project.costDucats ?? 0)), 0),
    );
    const durabilityMax = Math.max(
      1,
      Number(
        (
          (building as ContentEntry & { maxDurability?: number | null })?.maxDurability ??
          100
        ),
      ),
    );
    const durabilityCurrent =
      typeof instance?.currentDurability === "number"
        ? Math.max(0, Math.min(durabilityMax, Number(instance.currentDurability)))
        : durabilityMax;
    const durabilityCoverage = durabilityMax > 0 ? Math.max(0, Math.min(1, durabilityCurrent / durabilityMax)) : 1;

    const storageAmount =
      typeof instance?.ducats === "number"
        ? Math.max(0, Number(instance.ducats))
        : (() => {
            const totalTreasuryByType = worldBase?.regionBuildingDucatsByRegion?.[card.regionId]?.[card.buildingId] ?? 0;
            const totalInstancesByType = (worldBase?.regionBuildingsByRegion?.[card.regionId] ?? []).filter(
              (entry) => entry.buildingId === card.buildingId,
            ).length;
            return totalInstancesByType > 0 ? totalTreasuryByType / totalInstancesByType : 0;
          })();
    const trade = [
      ...Object.entries(lastPurchase)
        .filter(([, amount]) => Number(amount) > 0)
        .map(([goodId, amount]) => {
          const good = goodById.get(goodId);
          const value = Number(amount);
          return {
            kind: "buy" as const,
            goodName: good?.name ?? goodId,
            goodLogoUrl: good?.logoUrl ?? null,
            amount: value,
            total: Math.max(0, Number(lastPurchaseCost[goodId] ?? 0)),
          };
        }),
      ...Object.entries(lastSales)
        .filter(([, amount]) => Number(amount) > 0)
        .map(([goodId, amount]) => {
          const good = goodById.get(goodId);
          const value = Number(amount);
          return {
            kind: "sell" as const,
            goodName: good?.name ?? goodId,
            goodLogoUrl: good?.logoUrl ?? null,
            amount: value,
            total: Math.max(0, Number(lastSalesRevenue[goodId] ?? 0)),
          };
        }),
    ];

    const stockMap = new Map<
      string,
      { goodName: string; goodLogoUrl: string | null; available: number; incoming: number; outgoing: number }
    >();
    const warehouse = instance?.warehouseByGoodId ?? {};
    for (const [goodId, amount] of Object.entries(warehouse)) {
      const good = goodById.get(goodId);
      const row = stockMap.get(goodId) ?? {
        goodName: good?.name ?? goodId,
        goodLogoUrl: good?.logoUrl ?? null,
        available: 0,
        incoming: 0,
        outgoing: 0,
      };
      row.available += Math.max(0, Number(amount));
      stockMap.set(goodId, row);
    }
    for (const [goodId, amount] of Object.entries(lastPurchase)) {
      const good = goodById.get(goodId);
      const row = stockMap.get(goodId) ?? {
        goodName: good?.name ?? goodId,
        goodLogoUrl: good?.logoUrl ?? null,
        available: 0,
        incoming: 0,
        outgoing: 0,
      };
      row.incoming += Math.max(0, Number(amount));
      stockMap.set(goodId, row);
    }
    for (const [goodId, amount] of Object.entries(lastConsumption)) {
      const good = goodById.get(goodId);
      const row = stockMap.get(goodId) ?? {
        goodName: good?.name ?? goodId,
        goodLogoUrl: good?.logoUrl ?? null,
        available: 0,
        incoming: 0,
        outgoing: 0,
      };
      row.outgoing += Math.max(0, Number(amount));
      stockMap.set(goodId, row);
    }
    for (const [goodId, amount] of Object.entries(lastSales)) {
      const good = goodById.get(goodId);
      const row = stockMap.get(goodId) ?? {
        goodName: good?.name ?? goodId,
        goodLogoUrl: good?.logoUrl ?? null,
        available: 0,
        incoming: 0,
        outgoing: 0,
      };
      row.outgoing += Math.max(0, Number(amount));
      stockMap.set(goodId, row);
    }
    const stockRows = [...stockMap.values()].map((row) => ({
      ...row,
      remainder: row.available + row.incoming - row.outgoing,
    }));

    return {
      productivity,
      inputCost,
      outputRevenue,
      wagesCost,
      stateSubsidyDucats,
      upgradeCostDucats,
      netPerTurn,
      durabilityCurrent,
      durabilityMax,
      durabilityCoverage,
      storageAmount,
      inputs,
      outputs,
      extractions,
      stockRows,
      trade,
    };
  };

  const filteredCards = useMemo(() => {
    const source = [...cards].filter((card) => {
      if (filterBuildingId && card.buildingId !== filterBuildingId) return false;
      if (filterRegionId && card.regionId !== filterRegionId) return false;
      if (filterCompanyId && card.ownerCompanyId !== filterCompanyId) return false;
      if (filterCompanyCountryId) {
        if (card.ownerType !== "company" || !card.ownerCompanyId) return false;
        const companyCountryId =
          (companies.find((company) => company.id === card.ownerCompanyId) as (ContentEntry & { countryId?: string }) | undefined)?.countryId ?? "";
        if (companyCountryId !== filterCompanyCountryId) return false;
      }
      if (filterIndustryId) {
        const industryId = ((buildingById.get(card.buildingId) as (ContentEntry & { industryId?: string }) | undefined)?.industryId ?? "");
        if (industryId !== filterIndustryId) return false;
      }
      if (filterSectorId) {
        const sectorId = ((buildingById.get(card.buildingId) as (ContentEntry & { sectorId?: string }) | undefined)?.sectorId ?? "");
        if (sectorId !== filterSectorId) return false;
      }
      if (filterStatus !== "all" && card.kind !== filterStatus) return false;
      if (filterActive === "active" && !card.isActive) return false;
      if (filterActive === "inactive" && card.isActive) return false;
      if (filterEconomy !== "all" && card.kind === "built") {
        const econ = getCardEconomy(card);
        if (filterEconomy === "profit" && econ.netPerTurn <= 0) return false;
        if (filterEconomy === "loss" && econ.netPerTurn >= 0) return false;
      }
      return true;
    });
    source.sort((a, b) => {
      if (sortBy === "region") return a.regionName.localeCompare(b.regionName, "ru");
      if (sortBy === "company") return a.ownerLabel.localeCompare(b.ownerLabel, "ru");
      if (sortBy === "industry") return (a.industryName ?? "").localeCompare(b.industryName ?? "", "ru");
      if (sortBy === "sector") return (a.sectorName ?? "").localeCompare(b.sectorName ?? "", "ru");
      return a.buildingName.localeCompare(b.buildingName, "ru");
    });
    return source;
  }, [
    cards,
    filterBuildingId,
    filterRegionId,
    filterCompanyId,
    filterCompanyCountryId,
    filterIndustryId,
    filterSectorId,
    filterStatus,
    filterActive,
    filterEconomy,
    sortBy,
    companies,
    buildingById,
  ]);

  const regionSections = useMemo(
    () => {
      const byRegionId = new Map<string, Card[]>();
      for (const card of filteredCards) {
        const list = byRegionId.get(card.regionId) ?? [];
        list.push(card);
        byRegionId.set(card.regionId, list);
      }
      return myRegions
        .filter((region) => !filterRegionId || region.id === filterRegionId)
        .map((region) => ({
          regionId: region.id,
          regionName: region.name,
          cards: byRegionId.get(region.id) ?? [],
        }));
    },
    [filteredCards, filterRegionId, myRegions],
  );
  const availableConstruction = Math.max(0, Math.floor(Number(worldBase?.resourcesByCountry?.[countryId]?.construction ?? 0)));
  const availableDucats = Math.max(0, Math.floor(Number(worldBase?.resourcesByCountry?.[countryId]?.ducats ?? 0)));
  const marketTopDeficitGoods = useMemo(
    () =>
      [...(marketOverview?.goods ?? [])]
        .sort((a, b) => a.countryCoveragePct - b.countryCoveragePct)
        .slice(0, 6),
    [marketOverview],
  );
  const compactSelectButtonClass = "h-8 rounded-md px-2 text-[11px]";
  const constructionCardClass =
    "arc-building-card arc-building-card--construction relative z-0 h-[124px] rounded-lg border p-2 transition-all duration-150 hover:z-10 hover:-translate-y-0.5";
  const selectedRegionBuildings = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const instance of worldBase?.regionBuildingsByRegion?.[regionId] ?? []) {
      const instanceLevel = Math.max(1, Math.floor(Number(instance.level ?? 1)));
      counts[instance.buildingId] = (counts[instance.buildingId] ?? 0) + instanceLevel;
    }
    return counts;
  }, [regionId, worldBase?.regionBuildingsByRegion]);

  const getBuildingAvailability = (building: ContentEntry): BuildAvailability => {
    const reasons: string[] = [];
    if (!regionId) {
      reasons.push(tUi("buildings.regionRequired"));
    }
    if (ownerType === "company" && !ownerCompanyId) {
      reasons.push("Не выбрана компания-владелец");
    }

    const raw = building as unknown as Record<string, unknown>;
    const allowedCountries = Array.isArray(raw.allowedCountryIds)
      ? raw.allowedCountryIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : Array.isArray(raw.allowedCountries)
        ? raw.allowedCountries.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
    const deniedCountries = Array.isArray(raw.deniedCountryIds)
      ? raw.deniedCountryIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    if (deniedCountries.includes(countryId)) {
      reasons.push("Страна находится в списке запрета");
    } else if (allowedCountries.length > 0 && !allowedCountries.includes(countryId)) {
      reasons.push("Страна не входит в список разрешенных");
    }
    const requiredTechnology = unlockingTechnologyByBuildingId.get(building.id);
    if (requiredTechnology && !researchedTechnologyIds.has(requiredTechnology.id)) {
      reasons.push(`Нужна технология: ${requiredTechnology.name}`);
    }

    const countBuiltAndQueued = Object.entries(worldBase?.regionBuildingsByRegion ?? {}).reduce(
      (sum, [, instances]) =>
        sum +
        (instances ?? [])
          .filter((instance) => instance.buildingId === building.id)
          .reduce((acc, instance) => acc + Math.max(1, Math.floor(Number(instance.level ?? 1))), 0),
      0,
    ) +
      Object.values(worldBase?.regionConstructionQueueByRegion ?? {}).reduce(
        (sum, queue) =>
          sum +
          (queue ?? []).filter(
            (project) => project.buildingId === building.id && (project.projectType ?? "build") === "build",
          ).length,
        0,
      );
    const countBuiltAndQueuedByCountry =
      Object.entries(worldBase?.regionBuildingsByRegion ?? {}).reduce((sum, [pid, instances]) => {
        if ((worldBase?.regionOwner?.[pid] ?? "") !== countryId) return sum;
        return (
          sum +
          (instances ?? [])
            .filter((instance) => instance.buildingId === building.id)
            .reduce((acc, instance) => acc + Math.max(1, Math.floor(Number(instance.level ?? 1))), 0)
        );
      }, 0) +
      Object.entries(worldBase?.regionConstructionQueueByRegion ?? {}).reduce((sum, [pid, queue]) => {
        if ((worldBase?.regionOwner?.[pid] ?? "") !== countryId) return sum;
        return (
          sum +
          (queue ?? []).filter(
            (project) => project.buildingId === building.id && (project.projectType ?? "build") === "build",
          ).length
        );
      }, 0);
    const pendingBuildOrders = [...(ordersByTurn.get(turnId)?.values() ?? [])]
      .flat()
      .filter((order) => {
        if (order.type !== "BUILD") return false;
        const payload = (order.payload ?? {}) as Record<string, unknown>;
        const requestedBuildingId =
          typeof payload.buildingId === "string"
            ? payload.buildingId
            : typeof payload.building === "string"
              ? payload.building
              : "";
        return requestedBuildingId === building.id;
      });
    const pendingGlobal = pendingBuildOrders.length;
    const pendingByCountry = pendingBuildOrders.filter((order) => order.countryId === countryId).length;
    const globalLimit =
      typeof raw.globalBuildLimit === "number" && Number.isFinite(raw.globalBuildLimit)
        ? Math.max(1, Math.floor(raw.globalBuildLimit))
        : null;
    if (globalLimit != null && countBuiltAndQueued + pendingGlobal >= globalLimit) {
      reasons.push(`Достигнут глобальный лимит (${countBuiltAndQueued + pendingGlobal}/${globalLimit})`);
    }
    const countryLimits = Array.isArray(raw.countryBuildLimits)
      ? raw.countryBuildLimits.filter(
          (row): row is { countryId: string; limit: number } =>
            Boolean(
              row &&
                typeof row === "object" &&
                typeof (row as { countryId?: unknown }).countryId === "string" &&
                typeof (row as { limit?: unknown }).limit === "number",
            ),
        )
      : [];
    const countryLimit = countryLimits.find((row) => row.countryId === countryId)?.limit ?? null;
    if (countryLimit != null && countBuiltAndQueuedByCountry + pendingByCountry >= countryLimit) {
      reasons.push(`Достигнут лимит для страны (${countBuiltAndQueuedByCountry + pendingByCountry}/${countryLimit})`);
    }

    const dependencySource = Array.isArray(raw.requiredProvinceBuildingIds)
      ? raw.requiredProvinceBuildingIds
      : Array.isArray(raw.requiredBuildings)
        ? raw.requiredBuildings
        : Array.isArray(raw.dependencies)
          ? raw.dependencies
          : [];
    const dependencies = dependencySource.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    for (const depId of dependencies) {
      if ((selectedRegionBuildings[depId] ?? 0) <= 0) {
        reasons.push(tUi("buildings.regionDependency", { building: buildingById.get(depId)?.name ?? depId }));
      }
    }

    return { available: reasons.length === 0, reasons };
  };

  const buildableBuildingCards = useMemo(
    () =>
      sortedBuildings
        .map((building) => ({
          building,
          availability: getBuildingAvailability(building),
        }))
        .sort(
          (a, b) =>
            Number(b.availability.available) - Number(a.availability.available) ||
            a.building.name.localeCompare(b.building.name, "ru"),
        ),
    [sortedBuildings, regionId, ownerType, ownerCompanyId, countryId, selectedRegionBuildings, buildingById, worldBase, ordersByTurn, turnId, unlockingTechnologyByBuildingId, researchedTechnologyIds],
  );

  const industryNameById = useMemo(
    () => new Map(industries.map((industry) => [industry.id, industry.name] as const)),
    [industries],
  );

  const buildableBuildingGroups = useMemo(() => {
    const groups = new Map<string, { id: string; label: string; cards: Array<{ building: ContentEntry; availability: BuildAvailability }> }>();
    for (const card of buildableBuildingCards) {
      const rawIndustryId = getBuildingIndustryId(card.building);
      const key = industryNameById.has(rawIndustryId) ? rawIndustryId : OTHER_INDUSTRY_GROUP_ID;
      const label = key === OTHER_INDUSTRY_GROUP_ID ? "Другое" : (industryNameById.get(key) ?? "Другое");
      const group = groups.get(key) ?? { id: key, label, cards: [] };
      group.cards.push(card);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => {
      if (a.id === OTHER_INDUSTRY_GROUP_ID) return 1;
      if (b.id === OTHER_INDUSTRY_GROUP_ID) return -1;
      return a.label.localeCompare(b.label, "ru");
    });
  }, [buildableBuildingCards, industryNameById]);

  const submitBuild = (targetBuildingId: string) => {
    if (!regionId || !targetBuildingId) return;
    if (ownerType === "company" && !ownerCompanyId) return;
    const owner = ownerType === "company" ? { type: "company", companyId: ownerCompanyId } : { type: "state", countryId: ownerCountryId || countryId };
    onQueueBuildOrder(regionId, { buildingId: targetBuildingId, owner });
    setBuildingId(targetBuildingId);
  };

  const cancelBuildQueueItem = async (
    item:
      | { key: string; source: "pending"; orderId: string }
      | { key: string; source: "queued"; regionId: string; queueId: string },
  ) => {
    if (!auth?.token) return;
    setCancelingQueueKey(item.key);
    try {
      if (item.source === "pending") {
        const result = await cancelCountryBuild(auth.token, { orderId: item.orderId });
        if (result.canceledPendingOrder) {
          removeOrder(turnId, item.orderId);
        }
      } else {
        await cancelCountryBuild(auth.token, { regionId: item.regionId, queueId: item.queueId });
      }
      toast.success("Строительство отменено");
    } catch (error) {
      const message = error instanceof Error ? error.message : "BUILD_CANCEL_FAILED";
      if (message === "BUILD_CANCEL_NOT_FOUND") {
        toast.error("Проект уже не найден");
      } else {
        toast.error("Не удалось отменить строительство");
      }
    } finally {
      setCancelingQueueKey(null);
    }
  };

  const demolishBuiltCard = async (target: {
    key: string;
    regionId: string;
    buildingId: string;
    instanceId?: string;
  }) => {
    if (!auth?.token) return;
    setDemolishingCardKey(target.key);
    try {
      const result = await demolishCountryBuild(auth.token, {
        regionId: target.regionId,
        buildingId: target.buildingId,
        instanceId: target.instanceId,
      });
      toast.success(
        `Постройка снесена (${formatCompact(result.demolitionCostConstruction)} очков строительства)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "BUILD_DEMOLISH_FAILED";
      if (message === "INSUFFICIENT_CONSTRUCTION_POINTS") {
        toast.error("Недостаточно очков строительства для сноса");
      } else if (message === "BUILDING_NOT_FOUND") {
        toast.error("Постройка уже отсутствует");
      } else if (message === "NOT_PROVINCE_OWNER") {
        toast.error(tUi("buildings.ownRegionOnlyDemolish"));
      } else {
        toast.error("Не удалось снести постройку");
      }
    } finally {
      setDemolishingCardKey(null);
    }
  };

  const upgradeBuiltCardByState = async (target: {
    key: string;
    regionId: string;
    buildingId: string;
    instanceId?: string;
  }) => {
    if (!auth?.token || !target.instanceId) return;
    setUpgradingCardKey(target.key);
    try {
      const result = await upgradeCountryBuildState(auth.token, {
        regionId: target.regionId,
        buildingId: target.buildingId,
        instanceId: target.instanceId,
      });
      toast.success(
        `Апгрейд поставлен в очередь: Ур. ${result.currentLevel} -> ${result.targetLevel}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "BUILD_UPGRADE_STATE_FAILED";
      if (message === "INSUFFICIENT_DUCATS") {
        toast.error("Недостаточно дукатов государства для апгрейда");
      } else if (message === "BUILDING_UPGRADE_ALREADY_QUEUED") {
        toast.error("Апгрейд этого здания уже в очереди");
      } else if (message === "BUILDING_MAX_LEVEL_REACHED") {
        toast.error("Достигнут максимальный уровень здания");
      } else if (message === "NOT_PROVINCE_OWNER") {
        toast.error(tUi("buildings.ownRegionOnlyUpgrade"));
      } else {
        toast.error("Не удалось поставить апгрейд в очередь");
      }
    } finally {
      setUpgradingCardKey(null);
    }
  };

  const toggleBuiltCardAutoUpgrade = async (target: {
    key: string;
    regionId: string;
    buildingId: string;
    instanceId?: string;
    enabled: boolean;
  }) => {
    if (!auth?.token || !target.instanceId) return;
    setTogglingAutoUpgradeCardKey(target.key);
    try {
      const result = await setCountryBuildAutoUpgradeState(auth.token, {
        regionId: target.regionId,
        buildingId: target.buildingId,
        instanceId: target.instanceId,
        enabled: target.enabled,
      });
      toast.success(
        result.autoUpgradeEnabled
          ? "Автоповышение за счёт здания включено"
          : "Автоповышение за счёт здания выключено",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "BUILD_AUTO_UPGRADE_STATE_FAILED";
      if (message === "NOT_PROVINCE_OWNER") {
        toast.error(tUi("buildings.ownRegionOnlyToggle"));
      } else {
        toast.error("Не удалось изменить режим автоповышения");
      }
    } finally {
      setTogglingAutoUpgradeCardKey(null);
    }
  };

  const toggleBuiltCardSubsidies = async (target: {
    key: string;
    regionId: string;
    buildingId: string;
    instanceId?: string;
    enabled: boolean;
  }) => {
    if (!auth?.token || !target.instanceId) return;
    setTogglingSubsidyCardKey(target.key);
    try {
      const result = await setCountryBuildSubsidyState(auth.token, {
        regionId: target.regionId,
        buildingId: target.buildingId,
        instanceId: target.instanceId,
        enabled: target.enabled,
      });
      toast.success(
        result.stateSubsidiesEnabled
          ? "Государственные субсидии включены"
          : "Государственные субсидии выключены",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "BUILD_SUBSIDY_STATE_FAILED";
      if (message === "NOT_PROVINCE_OWNER") {
        toast.error(tUi("buildings.ownRegionOnlyToggle"));
      } else {
        toast.error("Не удалось изменить режим субсидий");
      }
    } finally {
      setTogglingSubsidyCardKey(null);
    }
  };

  const toggleBuiltCardManualWork = async (target: {
    key: string;
    regionId: string;
    buildingId: string;
    instanceId?: string;
    enabled: boolean;
  }) => {
    if (!auth?.token || !target.instanceId) return;
    setTogglingManualWorkCardKey(target.key);
    try {
      const result = await setCountryBuildManualWorkState(auth.token, {
        regionId: target.regionId,
        buildingId: target.buildingId,
        instanceId: target.instanceId,
        enabled: target.enabled,
      });
      toast.success(
        result.manualWorkEnabled
          ? "Постройка включена вручную"
          : "Постройка отключена вручную",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "BUILD_MANUAL_WORK_STATE_FAILED";
      if (message === "NOT_PROVINCE_OWNER") {
        toast.error(tUi("buildings.ownRegionOnlyToggle"));
      } else {
        toast.error("Не удалось изменить ручной режим постройки");
      }
    } finally {
      setTogglingManualWorkCardKey(null);
    }
  };

  const openRenameBuiltCardModal = (target: {
    key: string;
    regionId: string;
    regionName: string;
    buildingId: string;
    buildingName: string;
    instanceId?: string;
    currentName?: string | null;
  }) => {
    if (!target.instanceId) return;
    setRenameModalTarget(target);
    setRenameModalValue((target.currentName ?? "").trim());
  };

  const submitRenameBuiltCard = async (target: {
    key: string;
    regionId: string;
    regionName: string;
    buildingId: string;
    buildingName: string;
    instanceId?: string;
    currentName?: string | null;
  }) => {
    if (!auth?.token || !target.instanceId) return;
    const normalized = renameModalValue.trim();
    setRenamingCardKey(target.key);
    try {
      const result = await setCountryBuildCustomName(auth.token, {
        regionId: target.regionId,
        buildingId: target.buildingId,
        instanceId: target.instanceId,
        customName: normalized.length > 0 ? normalized : null,
      });
      toast.success(result.customName ? "Название постройки обновлено" : "Название постройки сброшено");
      setRenameModalTarget(null);
      setRenameModalValue("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "BUILD_CUSTOM_NAME_FAILED";
      if (message === "NOT_PROVINCE_OWNER") {
        toast.error(tUi("buildings.ownRegionOnlyRename"));
      } else if (message === "BUILDING_CUSTOM_NAME_ALREADY_USED") {
        toast.error(tUi("buildings.duplicateNameInRegion"));
      } else {
        toast.error("Не удалось обновить название постройки");
      }
    } finally {
      setRenamingCardKey(null);
    }
  };

  return (
    <>
      <AppModal open={open} onClose={onClose} modalKey="buildings" zIndexClassName="z-[206]">
          <AppModalHeader
            title="Индустрия"
            description={tUi("buildings.modalDescription")}
            onClose={onClose}
            actions={
              <AppButton
                type="button"
                title="Открыть строительство"
                onClick={() => setConstructionOpen(true)}
                variant="primary"
                size="icon"
                className="arc-construction-link-button"
              >
                <Hammer size={16} />
              </AppButton>
            }
          />

          <AppToolbar>
            {(() => {
              const activeFilterCount = [
                filterBuildingId,
                filterRegionId,
                filterCompanyId,
                filterCompanyCountryId,
                filterIndustryId,
                filterSectorId,
                filterStatus !== "all" ? filterStatus : "",
                filterActive !== "all" ? filterActive : "",
                filterEconomy !== "all" ? filterEconomy : "",
              ].filter(Boolean).length;
              const resetFilters = () => {
                setFilterBuildingId("");
                setFilterRegionId("");
                setFilterCompanyId("");
                setFilterCompanyCountryId("");
                setFilterIndustryId("");
                setFilterSectorId("");
                setFilterStatus("all");
                setFilterActive("all");
                setFilterEconomy("all");
              };
              return (
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-black/30 px-2 text-xs font-semibold text-white/75 transition group-open:border-arc-accent/35 group-open:text-white">
                        <SlidersHorizontal size={13} />
                        Фильтры
                        {activeFilterCount > 0 && (
                          <span className="rounded bg-arc-accent/20 px-1.5 py-0.5 text-[10px] text-arc-accent">{activeFilterCount}</span>
                        )}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={activeFilterCount === 0}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          resetFilters();
                        }}
                        className="h-8 rounded-md border border-white/15 bg-black/30 px-2 text-[11px] text-white/65 transition hover:border-arc-accent/40 hover:text-arc-accent disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Сбросить фильтры
                      </button>
                      <div className="w-[180px]">
                        <CustomSelect
                          value={sortBy}
                          onChange={(value) => setSortBy(value as "building" | "region" | "company" | "industry" | "sector")}
                          buttonClassName={compactSelectButtonClass}
                          options={[
                            { value: "building", label: "Сорт: здание" },
                            { value: "region", label: tUi("buildings.sortRegion") },
                            { value: "company", label: "Сорт: компания" },
                            { value: "industry", label: "Сорт: отрасль" },
                            { value: "sector", label: "Сорт: сектор" },
                          ]}
                        />
                      </div>
                    </div>
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                    <CustomSelect value={filterBuildingId} onChange={setFilterBuildingId} buttonClassName={compactSelectButtonClass} options={[{ value: "", label: "Здание: все" }, ...sortedBuildings.map((b) => ({ value: b.id, label: b.name }))]} />
                    <CustomSelect value={filterRegionId} onChange={setFilterRegionId} buttonClassName={compactSelectButtonClass} options={[{ value: "", label: tUi("buildings.filterRegionAll") }, ...myRegions.map((p) => ({ value: p.id, label: p.name }))]} />
                    <CustomSelect value={filterCompanyId} onChange={setFilterCompanyId} buttonClassName={compactSelectButtonClass} options={[{ value: "", label: "Компания: все" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]} />
                    <CustomSelect value={filterCompanyCountryId} onChange={setFilterCompanyCountryId} buttonClassName={compactSelectButtonClass} options={[{ value: "", label: "Страна компании: все" }, ...countries.map((c) => ({ value: c.id, label: c.name }))]} />
                    <CustomSelect value={filterIndustryId} onChange={setFilterIndustryId} buttonClassName={compactSelectButtonClass} options={[{ value: "", label: "Отрасль: все" }, ...industries.map((i) => ({ value: i.id, label: i.name }))]} />
                    <CustomSelect value={filterSectorId} onChange={setFilterSectorId} buttonClassName={compactSelectButtonClass} options={[{ value: "", label: "Сектор: все" }, ...sectors.map((i) => ({ value: i.id, label: i.name }))]} />
                    <CustomSelect
                      value={filterStatus}
                      onChange={(value) => setFilterStatus(value as "all" | "construction" | "built")}
                      buttonClassName={compactSelectButtonClass}
                      options={[
                        { value: "all", label: "Статус: все" },
                        { value: "construction", label: "Строящиеся" },
                        { value: "built", label: "Построенные" },
                      ]}
                    />
                    <CustomSelect
                      value={filterActive}
                      onChange={(value) => setFilterActive(value as "all" | "active" | "inactive")}
                      buttonClassName={compactSelectButtonClass}
                      options={[
                        { value: "all", label: "Активность: все" },
                        { value: "active", label: "Активные" },
                        { value: "inactive", label: "Неактивные" },
                      ]}
                    />
                    <CustomSelect
                      value={filterEconomy}
                      onChange={(value) => setFilterEconomy(value as "all" | "profit" | "loss")}
                      buttonClassName={compactSelectButtonClass}
                      options={[
                        { value: "all", label: "Экономика: все" },
                        { value: "profit", label: "Прибыльные" },
                        { value: "loss", label: "Убыточные" },
                      ]}
                    />
                  </div>
                </details>
              );
            })()}
          </AppToolbar>

          <div className="arc-scrollbar min-h-0 space-y-4 overflow-auto pr-1">
            {regionSections.map((section) => {
              const regionCards = section.cards;
              return (
                <section key={section.regionId} className="arc-province-building-section rounded-2xl border p-3">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white/85">{section.regionName}</div>
                    </div>
                    <div className="pt-0.5 text-[11px] text-white/50">
                      Построек: {regionCards.filter((card) => card.kind === "built").length}, в очереди: {regionCards.filter((card) => card.kind === "construction").length}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {regionCards.map((c) => (
              (() => {
                const econ = c.kind === "built" ? getCardEconomy(c) : null;
                const displayInactiveReasons = [...c.inactiveReasons];
                let limitingFactorBadge: { text: string; tooltip: string } | null = null;
                if (c.kind === "built") {
                  const factors = [
                    { label: "labor", value: c.lastLaborCoverage },
                    { label: "input", value: c.lastInputCoverage },
                    { label: "infra", value: c.lastInfraCoverage },
                    { label: "finance", value: c.lastFinanceCoverage },
                    { label: "extraction", value: c.lastExtractionCoverage },
                    { label: "durability", value: c.lastDurabilityCoverage },
                  ]
                    .filter((f): f is { label: string; value: number } => typeof f.value === "number")
                    .sort((a, b) => a.value - b.value);
                  if (factors.length > 0 && factors[0].value < 0.999) {
                    const limiting = factors[0];
                    const factorLabel =
                      limiting.label === "labor"
                        ? "труд"
                        : limiting.label === "input"
                          ? "входные товары"
                          : limiting.label === "infra"
                            ? "инфраструктура"
                            : limiting.label === "finance"
                              ? "финансы"
                              : limiting.label === "extraction"
                                ? "добыча"
                                : "прочность";
                    const factorPct = Math.round(limiting.value * 100);
                    limitingFactorBadge = {
                      text: `Лимит: ${factorLabel} ${factorPct}%`,
                      tooltip: `Лимит-фактор: ${factorLabel} (${factorPct}%)`,
                    };
                  }
                }
                if (c.kind === "built" && econ && econ.netPerTurn < 0 && econ.storageAmount <= 0) {
                  displayInactiveReasons.push("Недостаточно дукатов: убыток не покрывается кассой здания");
                }
                const displayIsActive = c.isActive;
                const econData = c.kind === "built" ? (econ ?? getCardEconomy(c)) : null;
                const building = buildingById.get(c.buildingId);
                const industryDescription = (() => {
                  const industryId = (((building as { industryId?: string } | undefined)?.industryId ?? "") as string).trim();
                  if (!industryId) return "";
                  return (industryById.get(industryId)?.description ?? "").trim();
                })();
                const sectorDescription = (() => {
                  const sectorId = (((building as { sectorId?: string } | undefined)?.sectorId ?? "") as string).trim();
                  if (!sectorId) return "";
                  return (sectorById.get(sectorId)?.description ?? "").trim();
                })();
                const ownerCompanyDescription =
                  c.ownerType === "company" && c.ownerCompanyId
                    ? (companyById.get(c.ownerCompanyId)?.description ?? "").trim()
                    : "";
                const maxLevel =
                  c.kind === "built"
                    ? Math.max(1, Math.floor(Number((building as (ContentEntry & { maxLevel?: number }) | undefined)?.maxLevel ?? 1)))
                    : 1;
                const upgradeCostDucats =
                  c.kind === "built"
                    ? Math.max(
                        0,
                        Number(
                          (building as (ContentEntry & { upgradeCostDucats?: number; costDucats?: number }) | undefined)
                            ?.upgradeCostDucats ??
                            (building as (ContentEntry & { costDucats?: number }) | undefined)?.costDucats ??
                            10,
                        ),
                      )
                    : 0;
                const upgradeCostConstruction =
                  c.kind === "built"
                    ? Math.max(
                        1,
                        Math.floor(
                          Number(
                            (building as (ContentEntry & { upgradeCostConstruction?: number; costConstruction?: number }) | undefined)
                              ?.upgradeCostConstruction ??
                              (building as (ContentEntry & { costConstruction?: number }) | undefined)?.costConstruction ??
                              100,
                          ),
                        ),
                      )
                    : 1;
                const hasQueuedUpgrade =
                  c.kind === "built" && c.instanceId
                    ? (worldBase?.regionConstructionQueueByRegion?.[c.regionId] ?? []).some(
                        (project) =>
                          (project.projectType ?? "build") === "upgrade" &&
                          (project.targetInstanceId ?? "") === c.instanceId,
                      )
                    : false;
                const instanceAutoUpgradeEnabled =
                  c.kind === "built" && c.instanceId
                    ? (
                        (worldBase?.regionBuildingsByRegion?.[c.regionId] ?? []).find(
                          (instance) => instance.instanceId === c.instanceId,
                        )?.autoUpgradeEnabled !== false
                      )
                    : true;
                const instanceStateSubsidiesEnabled =
                  c.kind === "built" && c.instanceId
                    ? (
                        (worldBase?.regionBuildingsByRegion?.[c.regionId] ?? []).find(
                          (instance) => instance.instanceId === c.instanceId,
                        )?.stateSubsidiesEnabled !== false
                      )
                    : true;
                const instanceManualWorkEnabled =
                  c.kind === "built" && c.instanceId
                    ? (
                        (worldBase?.regionBuildingsByRegion?.[c.regionId] ?? []).find(
                          (instance) => instance.instanceId === c.instanceId,
                        )?.manualWorkEnabled !== false
                      )
                    : true;
                const isManuallyDisabled =
                  c.kind === "built" &&
                  (!instanceManualWorkEnabled ||
                    c.inactiveReason === "Отключено вручную" ||
                    c.inactiveReasons.includes("Отключено вручную"));
                const canStateUpgrade =
                  c.kind === "built" &&
                  Boolean(c.instanceId) &&
                  c.level < maxLevel &&
                  !hasQueuedUpgrade &&
                  availableDucats >= upgradeCostDucats;
                const upgradeDisabledReason =
                  c.kind !== "built"
                    ? ""
                    : !c.instanceId
                      ? "Инстанс здания не найден"
                      : c.level >= maxLevel
                        ? `Достигнут максимум: Ур. ${maxLevel}`
                        : hasQueuedUpgrade
                          ? "Апгрейд уже в очереди"
                          : availableDucats < upgradeCostDucats
                            ? `Нужно дукатов: ${formatCompact(upgradeCostDucats)}`
                            : "";
                const cardThemeClass =
                  c.kind === "construction"
                    ? "arc-building-card--construction"
                    : displayIsActive
                      ? ""
                      : "arc-building-card--inactive";
                const displayCostConstruction =
                  c.kind === "built"
                    ? Math.max(1, Math.floor(c.costConstruction)) +
                      Math.max(0, Math.max(1, Math.floor(c.level)) - 1) * upgradeCostConstruction
                    : Math.max(1, Math.floor(c.costConstruction));
                const productivityPct = Math.max(0, econData?.productivity ?? 0);
                const productivityBarPct = Math.min(100, productivityPct);
                const durabilityPct = Math.max(0, Math.min(100, Math.round(Math.max(0, Math.min(1, econData?.durabilityCoverage ?? 0)) * 100)));
                const industryCard = (
              <article key={c.key} className={`arc-building-card ${cardThemeClass} rounded-2xl border p-4 flex flex-col gap-4 transition-all duration-150`}>
                <div className="flex items-start justify-between gap-3">
                    <div className={`flex gap-3 ${c.kind === "built" ? "items-stretch" : "items-start"}`}>
                      <div
                        className={`flex items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30 ${
                          c.kind === "built"
                            ? "aspect-square min-h-[74px] self-stretch"
                            : "h-[60px] w-[60px]"
                        }`}
                      >
                        {c.iconUrl ? (
                          <img src={c.iconUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Factory size={20} />
                        )}
                      </div>
                      <div>
                      <div className="flex items-center gap-2 text-white/80 text-sm font-semibold">
                        {c.kind === "built" ? (
                          <Tooltip
                            placement="right-start"
                            referenceClassName="inline-flex min-w-0"
                            contentClassName="arc-modal arc-modal--buildings !max-w-[720px] !border-0 !bg-transparent !p-0 !text-sm !shadow-none"
                            content={
                              <IndustryBuildingTooltip
                                card={c}
                                building={building}
                                economy={econData}
                                inactiveReasons={displayInactiveReasons}
                                displayIsActive={displayIsActive}
                                limitingFactor={limitingFactorBadge}
                                productivityPct={productivityPct}
                                durabilityPct={durabilityPct}
                                maxLevel={maxLevel}
                                resourceIcons={resourceIcons}
                              />
                            }
                          >
                            <span className="truncate underline decoration-[var(--arc-color-gold-soft)]/45 underline-offset-4">{c.buildingName || c.buildingId}</span>
                          </Tooltip>
                        ) : (
                          <Tooltip
                            content={(() => {
                              const description = (buildingById.get(c.buildingId)?.description ?? "").trim();
                              return description.length > 0 ? description : "Описание здания отсутствует";
                            })()}
                            placement="top"
                          >
                            <span>{c.buildingName || c.buildingId}</span>
                          </Tooltip>
                        )}
                      </div>
                      {c.kind === "built" && <div className="text-[11px] text-white/55">Название: {c.customName?.trim() ? c.customName : "не задано"}</div>}
                      <div className="text-[11px] text-white/45">Стоимость: {fmt(displayCostConstruction)}</div>
                      {c.kind === "built" && <div className="text-[11px] text-white/45">Уровень: {c.level}</div>}
                    </div>
                  </div>
                  {c.kind === "construction" ? (
                    <Tooltip content="Отменить строительство">
                      <button
                        type="button"
                        onClick={() =>
                          setCancelConfirmTarget({
                            key: c.key,
                            source: "queued",
                            buildingName: c.buildingName,
                            regionName: c.regionName,
                            regionId: c.regionId,
                            queueId: c.queueId,
                          })
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-white/60 transition hover:border-red-400/40 hover:text-red-300"
                      >
                        <X size={14} />
                      </button>
                    </Tooltip>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Tooltip content="Изменить уникальное название постройки">
                        <button
                          type="button"
                          onClick={() =>
                            openRenameBuiltCardModal({
                              key: c.key,
                              regionId: c.regionId,
                              regionName: c.regionName,
                              buildingId: c.buildingId,
                              buildingName: c.buildingName,
                              instanceId: c.instanceId,
                              currentName: c.customName,
                            })
                          }
                          disabled={!c.instanceId || renamingCardKey === c.key}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-40"
                        >
                          {renamingCardKey === c.key ? "..." : <Pencil size={14} />}
                        </button>
                      </Tooltip>
                      <Tooltip
                        content={
                          isManuallyDisabled
                            ? "Включить постройку вручную"
                            : "Отключить постройку вручную"
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            void toggleBuiltCardManualWork({
                              key: c.key,
                              regionId: c.regionId,
                              buildingId: c.buildingId,
                              instanceId: c.instanceId,
                              enabled: isManuallyDisabled,
                            })
                          }
                          disabled={!c.instanceId || togglingManualWorkCardKey === c.key}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-black/40 transition disabled:opacity-40 ${
                            isManuallyDisabled
                              ? "border-red-400/50 text-red-300 hover:border-red-300/80"
                              : "border-emerald-400/55 text-emerald-300 hover:border-emerald-300/80"
                          }`}
                        >
                          {togglingManualWorkCardKey === c.key ? "..." : <Power size={14} />}
                        </button>
                      </Tooltip>
                      <Tooltip
                        content={
                          instanceStateSubsidiesEnabled
                            ? "Выключить государственные субсидии"
                            : "Включить государственные субсидии"
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            void toggleBuiltCardSubsidies({
                              key: c.key,
                              regionId: c.regionId,
                              buildingId: c.buildingId,
                              instanceId: c.instanceId,
                              enabled: !instanceStateSubsidiesEnabled,
                            })
                          }
                          disabled={!c.instanceId || togglingSubsidyCardKey === c.key}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-black/40 transition disabled:opacity-40 ${
                            instanceStateSubsidiesEnabled
                              ? "border-amber-400/55 text-amber-300 hover:border-amber-300/80"
                              : "border-white/10 text-white/60 hover:border-white/25"
                          }`}
                        >
                          {togglingSubsidyCardKey === c.key ? "..." : <Coins size={14} />}
                        </button>
                      </Tooltip>
                      <Tooltip
                        content={
                          instanceAutoUpgradeEnabled
                            ? "Выключить автоповышение за счёт здания"
                            : "Включить автоповышение за счёт здания"
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            void toggleBuiltCardAutoUpgrade({
                              key: c.key,
                              regionId: c.regionId,
                              buildingId: c.buildingId,
                              instanceId: c.instanceId,
                              enabled: !instanceAutoUpgradeEnabled,
                            })
                          }
                          disabled={!c.instanceId || togglingAutoUpgradeCardKey === c.key}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-black/40 transition disabled:opacity-40 ${
                            instanceAutoUpgradeEnabled
                              ? "border-sky-400/45 text-sky-300 hover:border-sky-300/70"
                              : "border-white/10 text-white/60 hover:border-white/25"
                          }`}
                        >
                          {togglingAutoUpgradeCardKey === c.key ? "..." : <Lock size={14} />}
                        </button>
                      </Tooltip>
                      <Tooltip
                        content={
                          canStateUpgrade
                            ? `Повысить уровень за счёт государства (${formatCompact(upgradeCostConstruction)} строительства, ${formatCompact(upgradeCostDucats)} дукатов)`
                            : `Нельзя повысить: ${upgradeDisabledReason}`
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            void upgradeBuiltCardByState({
                              key: c.key,
                              regionId: c.regionId,
                              buildingId: c.buildingId,
                              instanceId: c.instanceId,
                            })
                          }
                          disabled={!canStateUpgrade || upgradingCardKey === c.key}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-white/60 transition hover:border-emerald-400/45 hover:text-emerald-300 disabled:opacity-40"
                        >
                          {upgradingCardKey === c.key ? "..." : <ChevronUp size={14} />}
                        </button>
                      </Tooltip>
                      <Tooltip content="Снести постройку целиком (стоимость в очках строительства)">
                        <button
                          type="button"
                          onClick={() =>
                            setDemolishConfirmTarget({
                              key: c.key,
                              regionId: c.regionId,
                              buildingId: c.buildingId,
                              instanceId: c.instanceId,
                              buildingName: c.buildingName,
                              regionName: c.regionName,
                              demolitionCostConstruction: Math.ceil(
                                (
                                  (Math.max(1, Math.floor(c.costConstruction)) +
                                    Math.max(0, Math.max(1, Math.floor(c.level)) - 1) * upgradeCostConstruction) *
                                  demolitionCostConstructionPercent
                                ) / 100,
                              ),
                            })
                          }
                          disabled={demolishingCardKey === c.key}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-white/60 transition hover:border-red-400/40 hover:text-red-300 disabled:opacity-40"
                        >
                          {demolishingCardKey === c.key ? "..." : <Trash2 size={14} />}
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </div>
                {c.kind === "construction" && (
                  <div>
                    <div className="h-2 overflow-hidden rounded-full border border-amber-400/30 bg-black/50">
                      <div
                        className="h-full"
                        style={{
                          width: `${c.progressPercent}%`,
                          backgroundImage:
                            "repeating-linear-gradient(-45deg, rgba(245,158,11,0.95) 0 8px, rgba(15,23,42,0.95) 8px 16px)",
                        }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-amber-300/90">Прогресс: {c.progressPercent}%</div>
                  </div>
                )}
                <div
                  className={
                    c.kind === "built"
                      ? "grid grid-cols-2 items-start gap-3"
                      : "flex items-start justify-between gap-3"
                  }
                >
                  <div className="min-w-0 flex flex-col gap-1.5 text-xs text-white/65">
                    <div className="inline-flex w-full items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1">
                      <Factory size={13} />
                      <span className="text-white/40">Отрасль:</span>
                      <Tooltip
                        content={industryDescription.length > 0 ? industryDescription : "Описание отрасли отсутствует"}
                        placement="top"
                      >
                        <span className="inline-flex items-center gap-1.5 text-white/80">
                          {c.industryLogo ? <img src={c.industryLogo} alt="" className="h-3.5 w-3.5 rounded object-cover border border-white/10" /> : null}
                          <span>{c.industryName ?? "—"}</span>
                        </span>
                      </Tooltip>
                    </div>
                    <div className="inline-flex w-full items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1">
                      <Factory size={13} />
                      <span className="text-white/40">Сектор:</span>
                      <Tooltip
                        content={sectorDescription.length > 0 ? sectorDescription : "Описание сектора отсутствует"}
                        placement="top"
                      >
                        <span className="inline-flex items-center gap-1.5 text-white/80">
                          {c.sectorLogo ? <img src={c.sectorLogo} alt="" className="h-3.5 w-3.5 rounded object-cover border border-white/10" /> : null}
                          <span>{c.sectorName ?? "—"}</span>
                        </span>
                      </Tooltip>
                    </div>
                    {c.kind === "built" && <div className="inline-flex w-full items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1"><Hammer size={13} /><span className="text-white/40">Уровень:</span><span>{c.level}</span></div>}
                    <div className="inline-flex w-full items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1"><MapPin size={13} /><span className="text-white/40">{tUi("buildings.regionLabel")}</span><span>{c.regionName}</span></div>
                    <div className="inline-flex w-full items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1">
                      <Building2 size={13} />
                      <span className="text-white/40">Страна:</span>
                      <span className="inline-flex items-center gap-1.5 text-white/80">
                        {countryById.get(c.regionOwnerCountryId)?.flagUrl ? (
                          <img src={countryById.get(c.regionOwnerCountryId)?.flagUrl ?? ""} alt="" className="h-3.5 w-3.5 rounded object-cover border border-white/10" />
                        ) : null}
                        <span>{countryById.get(c.regionOwnerCountryId)?.name ?? (c.regionOwnerCountryId || "—")}</span>
                      </span>
                    </div>
                    <div className="inline-flex w-full items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1"><Factory size={13} /><span className="text-white/40">Владелец:</span>{c.ownerType === "company" ? (
                      <Tooltip
                        content={ownerCompanyDescription.length > 0 ? ownerCompanyDescription : "Описание компании отсутствует"}
                        placement="top"
                      >
                        <span className="inline-flex items-center gap-1.5 text-white/80">{c.ownerLogo ? <img src={c.ownerLogo} alt="" className="h-3.5 w-3.5 rounded object-cover border border-white/10" /> : null}<span>{c.ownerLabel}</span></span>
                      </Tooltip>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-white/80">{c.ownerLogo ? <img src={c.ownerLogo} alt="" className="h-3.5 w-3.5 rounded object-cover border border-white/10" /> : null}<span>{c.ownerLabel}</span></span>
                    )}</div>
                    {c.kind === "built" && <div className="inline-flex w-full items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1"><Users size={13} /><span className="text-white/40">Рабочие:</span><span>{fmt(c.workersEmployed)} / {fmt(c.workersDemand)}</span></div>}
                  </div>
                  {c.kind === "built" && econData && (
                    <div className="flex w-full min-w-0 flex-col gap-2">
                      <Tooltip content={`Производительность: ${productivityPct}%. Показывает, какую долю от максимальной мощности здание отрабатывает за ход.`}>
                        <span className="inline-flex min-h-[22px] w-full items-center justify-between gap-2 rounded-md border border-white/15 bg-black/40 px-2 py-1">
                          <span className="text-[10px] font-semibold text-white/75">Производительность: {productivityPct}%</span>
                          <span className="h-1.5 w-16 overflow-hidden rounded-full border border-white/15 bg-black/60">
                            <span
                              className="block h-full bg-emerald-400/75"
                              style={{ width: `${productivityBarPct}%` }}
                            />
                          </span>
                        </span>
                      </Tooltip>
                      <Tooltip
                        content={`Прочность: ${durabilityPct}%. Ограничивает максимальную производительность здания.`}
                      >
                        <span className="inline-flex min-h-[22px] w-full items-center justify-between gap-2 rounded-md border border-white/15 bg-black/40 px-2 py-1">
                          <span className="text-[10px] font-semibold text-white/75">
                            Прочность: {durabilityPct}%
                          </span>
                          <span className="h-1.5 w-16 overflow-hidden rounded-full border border-white/15 bg-black/60">
                            <span
                              className="block h-full bg-sky-400/80"
                              style={{ width: `${durabilityPct}%` }}
                            />
                          </span>
                        </span>
                      </Tooltip>
                    </div>
                  )}
                </div>
                {c.kind === "built" && (
                  <div className="rounded-xl border border-white/10 bg-black/30">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenEconomyByCardKey((prev) => ({
                          ...prev,
                          [c.key]: !prev[c.key],
                        }))
                      }
                      className="flex min-h-[38px] w-full items-center justify-between px-3 py-2 text-xs text-white/80"
                    >
                      <span>Экономика</span>
                      <div className="flex items-center gap-2">
                        <Tooltip content="Накоплено денег у здания">
                          <span className="inline-flex min-h-[22px] items-center justify-center gap-1 rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[11px] font-bold leading-none text-white/75">
                            {resourceIcons.ducats ? (
                              <img src={resourceIcons.ducats} alt="" className="h-3.5 w-3.5 shrink-0 self-center object-contain" />
                            ) : (
                              <Coins size={11} />
                            )}
                            {formatCompact(econData?.storageAmount ?? 0)}
                          </span>
                        </Tooltip>
                        <Tooltip content="Финансовый результат здания за ход (прибыль или убыток)">
                          <span
                            className={`inline-flex min-h-[22px] items-center justify-center rounded-md border px-2 py-1 text-[11px] font-bold leading-none ${
                              (econData?.netPerTurn ?? 0) >= 0
                                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                                : "border-red-400/40 bg-red-500/15 text-red-300"
                            }`}
                          >
                            <span className="inline-flex items-center justify-center gap-1">
                              {resourceIcons.ducats ? (
                                <img src={resourceIcons.ducats} alt="" className="h-3.5 w-3.5 shrink-0 self-center object-contain" />
                              ) : (
                                <Coins size={11} />
                              )}
                              <span>
                                {(econData?.netPerTurn ?? 0) >= 0 ? "+" : ""}
                                {formatCompact(econData?.netPerTurn ?? 0)}
                              </span>
                            </span>
                          </span>
                        </Tooltip>
                        <Tooltip content="Сумма государственных субсидий, полученных зданием за ход">
                          <span
                            className={`inline-flex min-h-[22px] items-center justify-center rounded-md border px-2 py-1 text-[11px] font-bold leading-none ${
                              (econData?.stateSubsidyDucats ?? 0) > 0
                                ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                                : "border-white/15 bg-black/40 text-white/55"
                            }`}
                          >
                            <span className="inline-flex items-center justify-center gap-1">
                              {resourceIcons.ducats ? (
                                <img src={resourceIcons.ducats} alt="" className="h-3.5 w-3.5 shrink-0 self-center object-contain" />
                              ) : (
                                <Coins size={11} />
                              )}
                              <span>
                                +{formatCompact(econData?.stateSubsidyDucats ?? 0)}
                              </span>
                            </span>
                          </span>
                        </Tooltip>
                        {openEconomyByCardKey[c.key] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {openEconomyByCardKey[c.key] && econData && (
                          <motion.div
                            key={`${c.key}-economy`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="overflow-hidden"
                          >
                          <div className="space-y-2 border-t border-white/10 px-3 py-2 text-xs text-white/70">
                          <div className="space-y-1 rounded-md border border-white/15 bg-black/25 p-2">
                            <div className="inline-flex items-center gap-1.5 font-semibold text-white/50">
                              <Package size={12} className="shrink-0" />
                              <span>Склад</span>
                            </div>
                            {econData.stockRows.length === 0 ? (
                              <div className="text-white/50">пусто</div>
                            ) : (
                              <div className="space-y-1">
                                {econData.stockRows.map((row, idx) => (
                                  <div key={`${c.key}-stock-${idx}`} className="rounded-md border border-white/20 bg-white/[0.03] px-2 py-1 text-white/70">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="inline-flex items-center gap-1.5 text-white/75">
                                        {row.goodLogoUrl ? (
                                          <img src={row.goodLogoUrl} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                                        ) : (
                                          <Package size={11} className="shrink-0 text-white/60" />
                                        )}
                                        <span className="font-semibold">{row.goodName}</span>
                                      </div>
                                      <div className="ml-auto flex flex-wrap items-center justify-end gap-1 text-[10px]">
                                        <span className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-bold text-white/70">
                                          В наличии: {formatCompact(row.available)}
                                        </span>
                                        <span className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-bold text-white/75">
                                          Пришло: {formatCompact(row.incoming)}
                                        </span>
                                        <span className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-bold text-white/75">
                                          Ушло: {formatCompact(row.outgoing)}
                                        </span>
                                        <span className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-bold text-white/80">
                                          Остаток: {formatCompact(row.remainder)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1 rounded-md border border-white/15 bg-black/25 p-2">
                            <div className="inline-flex items-center gap-1.5 font-semibold text-white/50">
                              <ArrowUpRight size={12} className="shrink-0" />
                              <span>Торговля за ход</span>
                            </div>
                            {econData.trade.length === 0 && <div className="text-white/50">пусто</div>}
                            {econData.trade.map((item, idx) => {
                              const isBuy = item.kind === "buy";
                              const rowClass = isBuy
                                ? "rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-white/70"
                                : "rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-white/70";
                              const titleClass = isBuy ? "text-red-300" : "text-emerald-300";
                              const pillClass = isBuy
                                ? "inline-flex items-center rounded-md border border-red-400/45 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-200"
                                : "inline-flex items-center rounded-md border border-emerald-400/45 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200";
                              return (
                                <div key={`${c.key}-trade-${idx}`} className={rowClass}>
                                  <div className="flex items-center justify-between gap-2">
                                    <Tooltip content={isBuy ? "Покупка входных товаров за ход" : "Продажа выходных товаров за ход"}>
                                      <div className={`inline-flex items-center gap-1.5 font-semibold ${titleClass}`}>
                                        {item.goodLogoUrl ? (
                                          <img src={item.goodLogoUrl} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                                        ) : isBuy ? (
                                          <ArrowDownLeft size={12} className="shrink-0" />
                                        ) : (
                                          <ArrowUpRight size={12} className="shrink-0" />
                                        )}
                                        <span>{item.goodName}</span>
                                      </div>
                                    </Tooltip>
                                    <div className="ml-auto flex items-center justify-end gap-1.5">
                                      <Tooltip content="Объем торговой операции за ход">
                                        <span className={pillClass}>Объем: {formatCompact(item.amount)}</span>
                                      </Tooltip>
                                      <Tooltip content={isBuy ? "Расход на закупку за ход" : "Доход от продажи за ход"}>
                                        <span className={pillClass}>
                                          {isBuy ? "Расход: " : "Доход: "}
                                          {formatCompact(item.total)} дукат
                                        </span>
                                      </Tooltip>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="space-y-1 rounded-md border border-white/15 bg-black/25 p-2">
                            <div className="inline-flex items-center gap-1.5 font-semibold text-white/50">
                              <Factory size={12} className="shrink-0" />
                              <span>Производство</span>
                            </div>
                            {econData.outputs.length === 0 && <div className="text-white/50">нет выходных товаров</div>}
                            {econData.outputs.map((output, idx) => (
                              <div
                                key={`${c.key}-output-${idx}`}
                                className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-white/70"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <Tooltip content="Выходной товар, который производит здание">
                                    <div className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                                      {output.goodLogoUrl ? (
                                        <img src={output.goodLogoUrl} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                                      ) : (
                                        <Package size={12} className="shrink-0 text-emerald-300" />
                                      )}
                                      <span>{output.goodName}</span>
                                    </div>
                                  </Tooltip>
                                  <div className="ml-auto flex items-center justify-end gap-1.5">
                                    <Tooltip content="Фактический объем производства за ход">
                                      <span className="inline-flex items-center rounded-md border border-emerald-400/45 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                                        Фактически: {formatCompact(output.factual)}
                                      </span>
                                    </Tooltip>
                                    <Tooltip content="Максимально возможный объем производства за ход">
                                      <span className="inline-flex items-center rounded-md border border-emerald-400/45 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                                        Максимально: {formatCompact(output.max)}
                                      </span>
                                    </Tooltip>
                                    <Tooltip content="Доход от продажи выходного товара за ход">
                                      <span className="inline-flex items-center rounded-md border border-emerald-400/45 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                                        Доход: {formatCompact(output.income)} дукат
                                      </span>
                                    </Tooltip>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1 rounded-md border border-white/15 bg-black/25 p-2">
                            <div className="inline-flex items-center gap-1.5 font-semibold text-white/50">
                              <Package size={12} className="shrink-0" />
                              <span>Добыча</span>
                            </div>
                            {econData.extractions.length === 0 && <div className="text-white/50">нет добычи</div>}
                            {econData.extractions.map((row, idx) => (
                              <div
                                key={`${c.key}-extraction-${idx}`}
                                className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-white/70"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <Tooltip content={tUi("buildings.extractedResourceTooltip")}>
                                    <div className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                                      {row.goodLogoUrl ? (
                                        <img src={row.goodLogoUrl} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                                      ) : (
                                        <Package size={12} className="shrink-0 text-emerald-300" />
                                      )}
                                      <span>{row.goodName}</span>
                                    </div>
                                  </Tooltip>
                                  <div className="ml-auto flex items-center justify-end gap-1.5">
                                    <Tooltip content="Фактический объем добычи за ход">
                                      <span className="inline-flex items-center rounded-md border border-emerald-400/45 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                                        Фактически: {formatCompact(row.factual)}
                                      </span>
                                    </Tooltip>
                                    <Tooltip content="Максимально возможный объем добычи за ход">
                                      <span className="inline-flex items-center rounded-md border border-emerald-400/45 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                                        Максимально: {formatCompact(row.max)}
                                      </span>
                                    </Tooltip>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1 rounded-md border border-white/15 bg-black/25 p-2">
                            <div className="inline-flex items-center gap-1.5 font-semibold text-white/50">
                              <ArrowDownLeft size={12} className="shrink-0" />
                              <span>Потребление</span>
                            </div>
                            {econData.inputs.length === 0 && <div className="text-white/50">нет входных товаров</div>}
                            {econData.inputs.map((input, idx) => (
                              <div
                                key={`${c.key}-input-${idx}`}
                                className="rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-white/70"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <Tooltip content="Входной товар, который здание закупает для производства">
                                    <div className="inline-flex items-center gap-1.5 font-semibold text-red-300">
                                      {input.goodLogoUrl ? (
                                        <img src={input.goodLogoUrl} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                                      ) : (
                                        <Package size={12} className="shrink-0 text-red-300" />
                                      )}
                                      <span>{input.goodName}</span>
                                    </div>
                                  </Tooltip>
                                  <div className="ml-auto flex items-center justify-end gap-1.5">
                                    <Tooltip content="Фактический объем закупки за ход">
                                      <span className="inline-flex items-center rounded-md border border-red-400/45 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
                                        Фактически: {formatCompact(input.factual)}
                                      </span>
                                    </Tooltip>
                                    <Tooltip content="Максимально возможный объем закупки за ход">
                                      <span className="inline-flex items-center rounded-md border border-red-400/45 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
                                        Максимально: {formatCompact(input.max)}
                                      </span>
                                    </Tooltip>
                                    <Tooltip content="Стоимость закупки входного товара за ход">
                                      <span className="inline-flex items-center rounded-md border border-red-400/45 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
                                        Затраты: {formatCompact(input.cost)} дукат
                                      </span>
                                    </Tooltip>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1 rounded-md border border-white/15 bg-black/25 p-2">
                            <div className="inline-flex items-center gap-1.5 font-semibold text-white/50">
                              <Coins size={12} className="shrink-0" />
                              <span>Финансы</span>
                            </div>
                            <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-white/70">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-emerald-300">Доход от продаж</span>
                                <span className="inline-flex items-center rounded-md border border-emerald-400/45 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                                  +{formatCompact(econData.outputRevenue)} дукат
                                </span>
                              </div>
                            </div>
                            <div className="rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-white/70">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-red-300">Закупка товаров</span>
                                <span className="inline-flex items-center rounded-md border border-red-400/45 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
                                  -{formatCompact(econData.inputCost)} дукат
                                </span>
                              </div>
                            </div>
                            <div className="rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-white/70">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-red-300">Зарплаты</span>
                                <span className="inline-flex items-center rounded-md border border-red-400/45 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
                                  -{formatCompact(econData.wagesCost)} дукат
                                </span>
                              </div>
                            </div>
                            <div className="rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-white/70">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-amber-300">Гос. субсидии</span>
                                <span className="inline-flex items-center rounded-md border border-amber-400/45 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                                  +{formatCompact(econData.stateSubsidyDucats)} дукат
                                </span>
                              </div>
                            </div>
                            <div className="rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-white/70">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-rose-300">Повышение уровня</span>
                                <span className="inline-flex items-center rounded-md border border-rose-400/45 bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
                                  -{formatCompact(econData.upgradeCostDucats)} дукат
                                </span>
                              </div>
                            </div>
                            <div
                              className={`rounded-md border px-2 py-1 text-white/70 ${
                                econData.netPerTurn >= 0
                                  ? "border-emerald-400/40 bg-emerald-500/10"
                                  : "border-red-400/40 bg-red-500/10"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={econData.netPerTurn >= 0 ? "font-semibold text-emerald-300" : "font-semibold text-red-300"}>
                                  Итог за ход
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${
                                    econData.netPerTurn >= 0
                                      ? "border-emerald-400/45 bg-emerald-500/20 text-emerald-200"
                                      : "border-red-400/45 bg-red-500/20 text-red-200"
                                  }`}
                                >
                                  {econData.netPerTurn >= 0 ? "+" : ""}
                                  {formatCompact(econData.netPerTurn)} дукат
                                </span>
                              </div>
                            </div>
                          </div>
                          </div>
                          </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                {c.kind === "built" && (!displayIsActive || Boolean(limitingFactorBadge)) && (
                  <div className="rounded-xl border border-white/10 bg-black/30">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenStatusByCardKey((prev) => ({
                          ...prev,
                          [c.key]: !prev[c.key],
                        }))
                      }
                      className="flex min-h-[38px] w-full items-center justify-between px-3 py-2 text-xs text-white/80"
                    >
                      <span>Статусы</span>
                      <div className="flex items-center gap-2">
                        {openStatusByCardKey[c.key] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {openStatusByCardKey[c.key] && (
                        <motion.div
                          key={`${c.key}-statuses`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 border-t border-white/10 px-3 py-2 text-xs">
                            {!displayIsActive && (
                              <div className="rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-red-200">
                                <div className="font-semibold">Неактивное</div>
                                {displayInactiveReasons.length > 0 && (
                                  <div className="mt-0.5 text-red-100/90">{displayInactiveReasons.join(", ")}</div>
                                )}
                              </div>
                            )}
                            {limitingFactorBadge && (
                              <div className="rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-amber-200">
                                <div className="font-semibold">{limitingFactorBadge.text}</div>
                                <div className="mt-0.5 text-amber-100/90">{limitingFactorBadge.tooltip}</div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </article>
                );
                return industryCard;
              })()
            ))}
                    <button
                      type="button"
                      onClick={() => {
                        setBuildCountryId(countryId);
                        setRegionId(section.regionId);
                        setConstructionOpen(true);
                      }}
                      className="arc-add-building-button group flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed p-4 transition"
                    >
                      <span className="arc-add-building-button__icon inline-flex h-12 w-12 items-center justify-center rounded-full border">
                        <Plus size={20} />
                      </span>
                      <span className="arc-add-building-button__title mt-3 text-sm font-semibold">Добавить постройку</span>
                      <span className="arc-add-building-button__text mt-1 text-[11px]">Быстрый переход к строительству</span>
                    </button>
                  </div>
                </section>
              );
            })}
            {regionSections.length === 0 && (
              <AppEmptyState>По выбранным фильтрам ничего не найдено.</AppEmptyState>
            )}
          </div>
      </AppModal>

      <AppModal open={constructionOpen} onClose={() => setConstructionOpen(false)} modalKey="construction" zIndexClassName="z-[207]">
            <AppModalHeader title="Окно строительства" onClose={() => setConstructionOpen(false)} />

            <div className="min-h-0 flex flex-1 flex-col gap-4">
              <section className="arc-construction-panel rounded-xl border p-3">
                <div className="mb-2 text-xs uppercase tracking-wide text-white/45">Общие параметры строительства</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <label className="flex flex-col gap-1 text-xs text-white/65">
                    <Tooltip content={tUi("buildings.buildCountryTooltip")}>
                      <span>Страна строительства</span>
                    </Tooltip>
                    <CustomSelect
                      value={buildCountryId}
                      onChange={setBuildCountryId}
                      options={buildCountryOptions.map((country) => ({ value: country.id, label: country.name }))}
                      placeholder="Выберите страну"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-white/65">
                    <Tooltip content={tUi("buildings.selectedRegionTooltip")}>
                      <span>{tUi("buildings.selectedRegionLabel")}</span>
                    </Tooltip>
                    <CustomSelect
                      value={regionId}
                      onChange={setRegionId}
                      options={buildRegions.map((p) => ({ value: p.id, label: p.name }))}
                      placeholder={tUi("buildings.selectRegion")}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-white/65">
                    <Tooltip content="Кому будет принадлежать каждое добавленное здание: государству или компании.">
                      <span>Владелец</span>
                    </Tooltip>
                    <CustomSelect
                      value={ownerType}
                      onChange={(value) => setOwnerType(value as "state" | "company")}
                      options={[
                        { value: "state", label: "Государство" },
                        { value: "company", label: "Компания" },
                      ]}
                    />
                  </label>
                  {ownerType === "state" ? (
                    <label className="flex flex-col gap-1 text-xs text-white/65">
                      <Tooltip content="Страна, которая станет владельцем проекта при выбранном типе «Государство».">
                        <span>Страна владельца</span>
                      </Tooltip>
                      <CustomSelect
                        value={ownerCountryId}
                        onChange={setOwnerCountryId}
                        options={ownerCountryOptions.map((country) => ({
                          value: country.id,
                          label: country.name,
                        }))}
                        placeholder="Выберите страну"
                      />
                    </label>
                  ) : (
                    <label className="flex flex-col gap-1 text-xs text-white/65">
                      <Tooltip content="Компания, которая станет владельцем проекта при выбранном типе «Компания».">
                        <span>Компания владельца</span>
                      </Tooltip>
                      <CustomSelect
                        value={ownerCompanyId}
                        onChange={setOwnerCompanyId}
                        options={companies.map((c) => ({ value: c.id, label: c.name }))}
                        placeholder="Выберите компанию"
                      />
                    </label>
                  )}
                </div>
              </section>

              <div className="min-h-0 flex-1 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="arc-construction-panel min-h-0 rounded-xl border p-3 flex flex-col">
                  <div className="mb-2 flex items-center justify-between gap-2 px-1">
                    <div className="text-xs uppercase tracking-wide text-white/45">Доступные здания</div>
                    <div className="flex items-center gap-1.5">
                      <Tooltip content="Очки строительства страны (без текстовой плашки).">
                        <div className="arc-industry-chip inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px]">
                          {resourceIcons.construction ? (
                            <img src={resourceIcons.construction} alt="" className="h-3.5 w-3.5 object-contain" />
                          ) : (
                            <Hammer size={12} className="text-emerald-300" />
                          )}
                          <span className="font-bold text-white/60">{formatCompact(availableConstruction)}</span>
                        </div>
                      </Tooltip>
                      <Tooltip content="Дукаты страны (без текстовой плашки).">
                        <div className="arc-industry-chip inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px]">
                          {resourceIcons.ducats ? (
                            <img src={resourceIcons.ducats} alt="" className="h-3.5 w-3.5 object-contain" />
                          ) : (
                            <Coins size={12} className="text-amber-300" />
                          )}
                          <span className="font-bold text-white/60">{formatCompact(availableDucats)}</span>
                        </div>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="arc-scrollbar min-h-0 flex-1 space-y-2 overflow-auto pr-1 pt-1">
                    {buildableBuildingGroups.map((group) => {
                      const isOpen = openConstructionIndustryGroups[group.id] ?? false;
                      return (
                        <div key={group.id} className="arc-construction-group rounded-lg border">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenConstructionIndustryGroups((current) => ({
                                ...current,
                                [group.id]: !(current[group.id] ?? false),
                              }))
                            }
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-white/60 transition hover:bg-white/[0.04] hover:text-white/80"
                          >
                            <ChevronDown size={14} className={`shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                            <span className="min-w-0 flex-1 truncate">{group.label}</span>
                            <span className="rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-white/45">
                              {group.cards.length}
                            </span>
                          </button>
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.16, ease: "easeOut" }}
                                className="overflow-hidden"
                              >
                                <div className="space-y-2 border-t border-white/10 p-2">
                                  {group.cards.map(({ building, availability }) => {
                                    const costConstruction = Math.max(1, Math.floor(Number(building.costConstruction ?? 100)));
                                    const costDucats = Math.max(0, Math.floor(Number(building.costDucats ?? 0)));
                                    const canAdd = availability.available;
                                    const industryName = building.industryId ? industryById.get(building.industryId)?.name ?? null : null;
                                    const sectorName = building.sectorId ? sectorById.get(building.sectorId)?.name ?? null : null;
                                    const cardClass = `arc-building-card ${canAdd ? "arc-building-card--buildable" : "arc-building-card--locked"} relative z-0 h-[124px] rounded-lg border p-2 transition-all duration-150 hover:z-10 hover:-translate-y-0.5`;
                                    return (
                                      <Tooltip
                                        key={building.id}
                                        placement="right"
                                        referenceClassName="block"
                                        contentClassName="arc-modal arc-modal--construction !max-w-[560px] !border-0 !bg-transparent !p-0 !text-sm !shadow-none"
                                        content={
                                          <BuildingCardTooltip
                                            building={building}
                                            availability={availability}
                                            costConstruction={costConstruction}
                                            costDucats={costDucats}
                                            industryName={industryName}
                                            sectorName={sectorName}
                                            goodById={goodById}
                                            professionById={professionById}
                                            resourceIcons={resourceIcons}
                                          />
                                        }
                                      >
                                        <div className={cardClass}>
                                          <div className="h-full overflow-hidden rounded-md flex items-stretch">
                                            <div className={`flex w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black ${canAdd ? "border border-emerald-400/40" : "border border-red-400/40"}`}>
                                              {building.logoUrl ? (
                                                <img src={building.logoUrl} alt="" className="h-[72px] w-[72px] object-contain" />
                                              ) : (
                                                <Factory size={30} className="text-white/60" />
                                              )}
                                            </div>
                                            <div className="min-w-0 flex-1 p-3">
                                            <div className="flex h-full items-center justify-between gap-2">
                                              <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-white/90">{building.name}</div>
                                                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/40">
                                                  <Hammer size={10} className="text-white/40" />
                                                  <span>Стоимость строительства</span>
                                                </div>
                                                <div className="text-[11px] text-white/55">
                                                  <div className="flex items-center gap-1">
                                                    {resourceIcons.construction ? (
                                                      <img src={resourceIcons.construction} alt="" className="h-3.5 w-3.5 object-contain" />
                                                    ) : (
                                                      <Hammer size={12} className="text-emerald-300" />
                                                    )}
                                                    <span className="text-white/40">{formatCompact(costConstruction)}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    {resourceIcons.ducats ? (
                                                      <img src={resourceIcons.ducats} alt="" className="h-3.5 w-3.5 object-contain" />
                                                    ) : (
                                                      <Coins size={12} className="text-amber-300" />
                                                    )}
                                                    <span className="text-white/40">{formatCompact(costDucats)}</span>
                                                  </div>
                                                </div>
                                                <div className={`mt-1 text-[11px] ${canAdd ? "text-emerald-300/90" : "text-red-300/90"}`}>
                                                  {canAdd ? "Доступно" : "Недоступно"}
                                                </div>
                                              </div>
                                                <button
                                                    type="button"
                                                    title={canAdd ? `Добавить «${building.name}» в очередь строительства` : availability.reasons.join(", ")}
                                                    onClick={() => submitBuild(building.id)}
                                                    disabled={!canAdd}
                                                    className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${
                                                      canAdd
                                                        ? "border border-emerald-400/55 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                                                        : "border border-red-400/55 bg-red-500/20 text-red-200"
                                                    }`}
                                                >
                                                  {canAdd ? <Plus size={20} /> : <Lock size={18} />}
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </Tooltip>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="arc-construction-panel min-h-0 rounded-xl border p-3 flex flex-col">
                  <div className="mb-2 flex items-center justify-between gap-2 px-1">
                    <div className="text-xs uppercase tracking-wide text-white/45">Очередь строительства</div>
                    <Tooltip content="Количество проектов в очереди строительства (включая pending текущего хода).">
                      <div className="inline-flex items-center gap-1 rounded-md border border-amber-400/55 bg-[#14100a] px-2 py-0.5 text-[11px] font-bold text-amber-300">
                        <Hammer size={11} className="text-amber-300" />
                        <span>{formatCompact(constructionQueue.length)}</span>
                      </div>
                    </Tooltip>
                  </div>
                  {constructionQueue.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-3 text-xs text-white/45">
                      Очередь пуста
                    </div>
                  )}
                  {constructionQueue.length > 0 && (
                    <div className="arc-scrollbar arc-scrollbar-construction min-h-0 flex-1 space-y-2 overflow-auto pr-1 pt-1">
                      {constructionQueue.map((card) => (
                        <div key={card.key} className={constructionCardClass}>
                          <div className="h-full overflow-hidden rounded-md flex items-stretch">
                            <div className="flex w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-amber-400/40 bg-black">
                              {card.iconUrl ? (
                                <img src={card.iconUrl} alt="" className="h-[72px] w-[72px] object-contain" />
                              ) : (
                                <Factory size={30} className="text-white/60" />
                              )}
                            </div>
                            <div className="min-w-0 flex h-full flex-1 flex-col p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-white/90">{card.buildingName}</div>
                                  <div className="text-[11px] text-white/55">{card.regionName}</div>
                                </div>
                              </div>
                              <div className="mt-auto flex items-center gap-0.5">
                                <div className="w-9 shrink-0 text-[11px] leading-none text-amber-300/90">{card.progressPercent}%</div>
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-amber-400/30 bg-black/50">
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${card.progressPercent}%`,
                                      backgroundImage:
                                        "repeating-linear-gradient(-45deg, rgba(245,158,11,0.95) 0 8px, rgba(15,23,42,0.95) 8px 16px)",
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="mt-1 text-[11px] text-white/55">
                                Владелец: <span className="text-white/80">{card.ownerLabel}</span>
                              </div>
                              <div className="text-[11px] text-white/55">
                                Проект: <span className="text-white/80">{card.projectLabel}</span>
                              </div>
                            </div>
                            <div className="flex w-16 shrink-0 items-center justify-center">
                              <Tooltip
                                content={
                                  card.source === "pending"
                                    ? "Отменить проект до резолва текущего хода"
                                    : "Удалить проект из очереди строительства"
                                }
                                placement="left"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCancelConfirmTarget(
                                      card.source === "pending"
                                        ? {
                                            key: card.key,
                                            source: "pending",
                                            buildingName: card.buildingName,
                                            regionName: card.regionName,
                                            orderId: card.orderId,
                                          }
                                        : {
                                            key: card.key,
                                            source: "queued",
                                            buildingName: card.buildingName,
                                            regionName: card.regionName,
                                            regionId: card.regionId,
                                            queueId: card.queueId,
                                          },
                                    )
                                  }
                                  disabled={cancelingQueueKey === card.key}
                                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-400/55 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 disabled:opacity-40"
                                >
                                  {cancelingQueueKey === card.key ? "..." : <X size={20} />}
                                </button>
                              </Tooltip>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
      </AppModal>

      <AppModal
        modalKey="construction"
        open={Boolean(cancelConfirmTarget)}
        onClose={() => setCancelConfirmTarget(null)}
        zIndexClassName="z-[208]"
        panelClassName="h-auto w-full max-w-md"
        paddingClassName="p-4 flex items-center justify-center"
      >
            <AppModalHeader title="Отменить строительство?" onClose={() => setCancelConfirmTarget(null)} />
            <AppCard className="border-amber-400/55 bg-[#14100a]">
              <div className="mt-2 text-xs text-white/70">
                <div>
                  Здание: <span className="text-white/90">{cancelConfirmTarget?.buildingName ?? "—"}</span>
                </div>
                <div>
                  {tUi("buildings.confirmRegion")} <span className="text-white/90">{cancelConfirmTarget?.regionName ?? "—"}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <AppButton
                  type="button"
                  onClick={() => setCancelConfirmTarget(null)}
                  variant="ghost"
                  size="sm"
                >
                  Нет
                </AppButton>
                <AppButton
                  type="button"
                  onClick={() => {
                    if (!cancelConfirmTarget) return;
                    if (cancelConfirmTarget.source === "pending" && cancelConfirmTarget.orderId) {
                      void cancelBuildQueueItem({
                        key: cancelConfirmTarget.key,
                        source: "pending",
                        orderId: cancelConfirmTarget.orderId,
                      });
                    } else if (
                      cancelConfirmTarget.source === "queued" &&
                      cancelConfirmTarget.regionId &&
                      cancelConfirmTarget.queueId
                    ) {
                      void cancelBuildQueueItem({
                        key: cancelConfirmTarget.key,
                        source: "queued",
                        regionId: cancelConfirmTarget.regionId,
                        queueId: cancelConfirmTarget.queueId,
                      });
                    }
                    setCancelConfirmTarget(null);
                  }}
                  variant="secondary"
                  size="sm"
                >
                  Да
                </AppButton>
              </div>
            </AppCard>
      </AppModal>

      <AppModal
        modalKey="construction"
        open={Boolean(demolishConfirmTarget)}
        onClose={() => setDemolishConfirmTarget(null)}
        zIndexClassName="z-[208]"
        panelClassName="h-auto w-full max-w-md"
        paddingClassName="p-4 flex items-center justify-center"
      >
            <AppModalHeader title="Снести постройку?" onClose={() => setDemolishConfirmTarget(null)} />
            <AppCard className="border-red-400/55 bg-[#160d0d]">
              <div className="mt-2 text-xs text-white/70">
                <div>
                  Здание: <span className="text-white/90">{demolishConfirmTarget?.buildingName ?? "—"}</span>
                </div>
                <div>
                  {tUi("buildings.confirmRegion")} <span className="text-white/90">{demolishConfirmTarget?.regionName ?? "—"}</span>
                </div>
                <div className="mt-1">
                  Стоимость сноса:{" "}
                  <span className="text-white/90">
                    {formatCompact(demolishConfirmTarget?.demolitionCostConstruction ?? 0)} очков строительства
                  </span>
                </div>
                <div>
                  Доступно: <span className="text-white/90">{formatCompact(availableConstruction)}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <AppButton
                  type="button"
                  onClick={() => setDemolishConfirmTarget(null)}
                  variant="ghost"
                  size="sm"
                >
                  Нет
                </AppButton>
                <AppButton
                  type="button"
                  disabled={(demolishConfirmTarget?.demolitionCostConstruction ?? 0) > availableConstruction}
                  onClick={() => {
                    if (!demolishConfirmTarget) return;
                    void demolishBuiltCard({
                      key: demolishConfirmTarget.key,
                      regionId: demolishConfirmTarget.regionId,
                      buildingId: demolishConfirmTarget.buildingId,
                      instanceId: demolishConfirmTarget.instanceId,
                    });
                    setDemolishConfirmTarget(null);
                  }}
                  variant="danger"
                  size="sm"
                >
                  Да
                </AppButton>
              </div>
            </AppCard>
      </AppModal>

      <TextInputModal
        open={Boolean(renameModalTarget)}
        onClose={() => {
          if (renamingCardKey) return;
          setRenameModalTarget(null);
          setRenameModalValue("");
        }}
        title="Изменение названия постройки"
        description={
          renameModalTarget
            ? tUi("buildings.renamePrompt", { building: renameModalTarget.buildingName, region: renameModalTarget.regionName })
            : undefined
        }
        label="Уникальное название (до 80 символов)"
        value={renameModalValue}
        onChange={setRenameModalValue}
        onSubmit={() => {
          if (!renameModalTarget) return;
          void submitRenameBuiltCard(renameModalTarget);
        }}
        placeholder="Введите уникальное название"
        hint="Пустое значение сбросит пользовательское название"
        maxLength={80}
        pending={Boolean(renamingCardKey)}
        disabledSubmit={Boolean(renamingCardKey)}
        submitLabel="Сохранить"
        cancelLabel="Отмена"
        zIndexClassName="z-[209]"
      />
    </>
  );
}
