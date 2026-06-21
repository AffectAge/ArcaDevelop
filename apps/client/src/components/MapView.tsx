import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import type { PathStyleExtensionProps } from "@deck.gl/extensions";
import { bezierSpline, lineString } from "@turf/turf";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Briefcase, Building2, Check, Coins, Crosshair, Flag, Gauge, Hammer, Info, Landmark, Layers3, Lock, LockOpen, LocateFixed, Minus, Move, Network, Package, Pickaxe, Plane, Plus, Route, Ship, Sparkles, TrainFront, Trash2, Truck, Users, X, Zap, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import type { Country, WorldBase } from "@arcanorum/shared";
import { Tooltip } from "./Tooltip";
import { CustomSelect } from "./CustomSelect";
import { ColonizationModal } from "./ColonizationModal";
import { ProvinceHoverTooltip } from "./ProvinceHoverTooltip";
import { CorridorBuildHud } from "./map-hud/CorridorBuildHud";
import { MapControlsHud } from "./map-hud/MapControlsHud";
import { MapLensHud, getLensIconButtonClass } from "./map-hud/MapLensHud";
import { ProvinceContextMenuHud } from "./map-hud/ProvinceContextMenuHud";
import { SelectedProvincePanelFrame } from "./map-hud/SelectedProvincePanelFrame";
import {
  cancelCountryColonization,
  createMarketTransportCorridor,
  deleteMarketTransportCorridor,
  fetchContentEntries,
  fetchInfrastructureConstructionRights,
  fetchMarketOverview,
  fetchMarketsCatalog,
  fetchProvinceIndex,
  renameOwnedProvince,
  startCountryColonization,
  startCountryExploration,
  updateMarketTransportCorridor,
  type InfrastructureConstructionRight,
  type MarketCatalogItem,
  type MarketTransportCorridor,
  type TransportMode,
} from "../lib/api";
import { useGameStore } from "../store/gameStore";
import { AppButton } from "./ui/AppButton";
import { AppField, AppInput } from "./ui/AppForm";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState, AppSection, AppSectionHeader, AppToolbar } from "./ui/AppSurface";
import { AppCell, AppHeadCell, AppTable, AppTableShell } from "./ui/AppTable";
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";

type PoliticalLensId = "owners" | "country" | "mine" | "colonies";
type DiplomacyLensId = "treaties" | "transit" | "corridorAccess";
type MarketLensId = "membership" | "capitals" | "selectedMarketMembers";
type PopulationLensId = "density" | "cultures" | "religions" | "races" | "professions" | "ideologies" | "standardOfLiving" | "radicals" | "loyalists" | "needs";
type ResourceLensId = "exploration" | "deposits";
type InfrastructureLensViewId = "coverage" | "load" | "problems" | "corridors";
type InfrastructureLensId = `${TransportMode}:${InfrastructureLensViewId}`;
type ColonizationLensId = "available" | "cost" | "ownRaces" | "foreignRaces" | "blocked";
type MilitaryLensId = "armies";
export type MapModeId = "political" | "regions" | "provinceColors" | "diplomacy" | "markets" | "population" | "resources" | "infrastructure" | "colonization" | "military";
type ProvinceMapMeta = {
  name: string;
  regionId: string | null;
  provinceColor: string;
  regionColor: string;
  areaKm2: number;
  provinceType: string | null;
  centerX: number | null;
  centerY: number | null;
  sourceCenterX: number | null;
  sourceCenterY: number | null;
  neighbors: string[];
  climate: string | null;
  pollution: number | null;
  radiation: number | null;
  landscape: string | null;
  continent: string | null;
  strategicRegion: string | null;
  fertileLandKm2: number | null;
  fertility: number | null;
};

type CountryLabelFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { countryId: string; name: string; area: number; color: string };
  }>;
};

export type AuthoredProvinceColorState = {
  provinceMapColor: string;
  provinceMapBorderColor: string;
  regionMapColor: string;
  regionMapBorderColor: string;
};

const PROVINCE_TEXTURE_FILL_COLOR = "#9ca3af";
const PROVINCE_TEXTURE_FILL_OPACITY = 0.25;
const OCEAN_TEXTURE_FILL_OPACITY = 0.08;
const MAP_LENS_FILL_OPACITY = 0.8;
const MAP_LENS_BORDER_OPACITY = 0.8;
const PROVINCE_TYPE_EXPRESSION = ["downcase", ["to-string", ["coalesce", ["get", "province_type"], ["get", "provinceType"], ["get", "Тип провинции"], ""]]];
const IS_OCEAN_PROVINCE_EXPRESSION = [
  "any",
  ["==", PROVINCE_TYPE_EXPRESSION, "ocean"],
  ["==", PROVINCE_TYPE_EXPRESSION, "water"],
  ["==", PROVINCE_TYPE_EXPRESSION, "sea"],
  ["==", PROVINCE_TYPE_EXPRESSION, "океан"],
  ["==", PROVINCE_TYPE_EXPRESSION, "вода"],
  ["==", PROVINCE_TYPE_EXPRESSION, "море"],
];
const COLONIZE_EMPTY_PATTERN = "colonize-empty";
const COLONIZE_STRIPES_PATTERN = "colonize-stripes";

type Props = {
  apiBase: string;
  onQueueBuildOrder: (provinceId: string) => void;
  onQueueColonizeOrder: (provinceId: string) => void;
  onQueueArmyMoveOrder?: (divisionId: string, provinceId: string, path?: string[]) => void;
  onOpenAdminProvinceEditor?: (provinceId: string) => void;
  onOpenProvinceKnowledge?: (provinceId: string, provinceName: string) => void;
  onCreateProvinceKnowledge?: (provinceId: string, provinceName: string) => void;
  onProvinceRenameCharged?: (chargedDucats: number) => void;
  colonizationIconUrl?: string | null;
  ducatsIconUrl?: string | null;
  maxActiveColonizations?: number;
  colonizationCostPer1000Km2?: { points: number; ducats: number };
  provinceRenameDucatsCost?: number;
  showMapControls?: boolean;
  showAntarctica?: boolean;
};

const DEFAULT_CENTER: [number, number] = [0, 0];
const DEFAULT_ZOOM = 0.75;
const DEFAULT_MAP_LENSES = {
  political: "owners" as PoliticalLensId,
  diplomacy: "treaties" as DiplomacyLensId,
  markets: "membership" as MarketLensId,
  population: "density" as PopulationLensId,
  resources: "deposits" as ResourceLensId,
  infrastructure: "land:load" as InfrastructureLensId,
  colonization: "available" as ColonizationLensId,
  military: "armies" as MilitaryLensId,
};
const EMPTY_PROVINCE_OWNER: WorldBase["provinceOwner"] = {};
const EMPTY_PROVINCE_NAMES: WorldBase["provinceNameById"] = {};
const EMPTY_COLONY_PROGRESS: WorldBase["colonyProgressByRegion"] = {};
const EMPTY_PROVINCE_COLONIZATION: WorldBase["regionColonizationByRegion"] = {};
const EMPTY_PROVINCE_BUILDINGS: Record<string, Array<{ buildingId?: string }>> = {};
const EMPTY_PROVINCE_CONSTRUCTION_QUEUE: Record<string, Array<{ queueId: string; buildingId: string; progressConstruction: number; costConstruction: number; projectType?: "build" | "upgrade" }>> = {};
const EMPTY_PROVINCE_RESOURCE_DEPOSITS: Record<string, Array<{ goodId: string; amount: number; veinSize: "small" | "medium" | "large" }>> = {};
const EMPTY_PROVINCE_EXPLORATION_QUEUE: Record<string, Array<{ queueId: string; turnsRemaining: number; requestedByCountryId: string }>> = {};
const EMPTY_PROVINCE_EXPLORATION_COUNT: Record<string, number> = {};
const EMPTY_DIVISIONS_BY_ID: Record<string, { id: string; name: string; countryId: string; provinceId: string }> = {};
const EMPTY_MARKET_TRANSPORT_CORRIDORS: MarketTransportCorridor[] = [];
const EMPTY_MARKET_ACCESS_BY_PROVINCE: Record<string, {
  marketId: string;
  connectedToCapital: boolean;
  infrastructureCoverage?: number;
  marketAccess?: number;
  worldMarketAccess: number;
  isWorldAccessPoint: boolean;
  isConnectedWorldAccessPoint: boolean;
  connectedWorldAccessPoints: number;
  totalWorldAccessPoints: number;
}> = {};
const EMPTY_PROVINCE_POPULATION: Record<string, { pops?: Array<{
  id: string;
  size: number;
  cultureId: string;
  religionId: string;
  raceId: string;
  ideologies?: Record<string, number>;
  professions: Record<string, {
    size: number;
    standardOfLiving?: number;
    radicals?: number;
    loyalists?: number;
    lastNeedsSatisfaction?: number;
  }>;
}> }> = {};
const EMPTY_COUNTRY_PROGRESS: Record<string, number> = {};

function getMapModeConfig(modeId: MapModeId, t?: (key: UiTextKey) => string) {
  const configs: Record<MapModeId, {
    label: string;
    shortLabel: string;
    icon: typeof Landmark;
    fillColor: string;
    fillOpacity: number;
    legend: Array<{ label: string; color: string; description: string }>;
  }> = {
    political: {
      label: t?.("map.mode.political.label") ?? "Political",
      shortLabel: t?.("map.mode.political.shortLabel") ?? "Countries",
      icon: Landmark,
      fillColor: "#ffffff",
      fillOpacity: 0.68,
      legend: [
        { label: t?.("map.mode.political.ownerLegend") ?? "Owner", color: "#4ade80", description: t?.("map.mode.political.ownerDescription") ?? "Owner country color" },
        { label: t?.("map.mode.political.colonizationLegend") ?? "Colonization", color: "#93c5fd", description: t?.("map.mode.political.colonizationDescription") ?? "Neutral province with an active race" },
        { label: t?.("map.mode.political.outOfFilterLegend") ?? "Outside filter", color: "#9ca3af", description: t?.("map.mode.political.outOfFilterDescription") ?? "When filtering by country" },
      ],
    },
    regions: {
      label: t?.("map.mode.regions.label") ?? "Regions",
      shortLabel: t?.("map.mode.regions.shortLabel") ?? "Regions",
      icon: Layers3,
      fillColor: "#22d3ee",
      fillOpacity: 0.7,
      legend: [
        {
          label: t?.("map.mode.regions.legendLabel") ?? "State region",
          color: "#22d3ee",
          description: t?.("map.mode.regions.legendDescription") ?? "Provinces grouped by their gameplay region",
        },
      ],
    },
    provinceColors: {
      label: t?.("map.mode.provinceColors.label") ?? "Province colors",
      shortLabel: t?.("map.mode.provinceColors.shortLabel") ?? "Provinces",
      icon: Layers3,
      fillColor: "#8fb9a8",
      fillOpacity: 0.7,
      legend: [
        {
          label: t?.("map.mode.provinceColors.legendLabel") ?? "Province",
          color: "#8fb9a8",
          description: t?.("map.mode.provinceColors.legendDescription") ?? "Authored scenario colors for lightweight map provinces",
        },
      ],
    },
    diplomacy: {
      label: t?.("map.mode.diplomacy.label") ?? "Diplomacy",
      shortLabel: t?.("map.mode.diplomacy.shortLabel") ?? "Diplomacy",
      icon: Briefcase,
      fillColor: "#facc15",
      fillOpacity: 0.68,
      legend: [{ label: t?.("map.mode.diplomacy.legendLabel") ?? "Treaties", color: "#facc15", description: t?.("map.mode.diplomacy.legendDescription") ?? "Countries connected by active agreements" }],
    },
    markets: {
      label: t?.("map.mode.markets.label") ?? "Markets",
      shortLabel: t?.("map.mode.markets.shortLabel") ?? "Markets",
      icon: Package,
      fillColor: "#38bdf8",
      fillOpacity: 0.68,
      legend: [{ label: t?.("map.mode.markets.legendLabel") ?? "Market", color: "#38bdf8", description: t?.("map.mode.markets.legendDescription") ?? "Provinces by market membership" }],
    },
    population: {
      label: t?.("map.mode.population.label") ?? "Population",
      shortLabel: t?.("map.mode.population.shortLabel") ?? "Population",
      icon: Users,
      fillColor: "#fb7185",
      fillOpacity: 0.68,
      legend: [{ label: t?.("map.mode.population.legendLabel") ?? "Metric", color: "#fb7185", description: t?.("map.mode.population.legendDescription") ?? "Province demographics and quality of life" }],
    },
    resources: {
      label: t?.("map.mode.resources.label") ?? "Resources",
      shortLabel: t?.("map.mode.resources.shortLabel") ?? "Resources",
      icon: Pickaxe,
      fillColor: "#f97316",
      fillOpacity: 0.68,
      legend: [{ label: t?.("map.mode.resources.legendLabel") ?? "Deposits", color: "#f97316", description: t?.("map.mode.resources.legendDescription") ?? "Discovered resources and prospecting" }],
    },
    infrastructure: {
      label: t?.("map.mode.infrastructure.label") ?? "Infrastructure",
      shortLabel: t?.("map.mode.infrastructure.shortLabel") ?? "Infra",
      icon: TrainFront,
      fillColor: "#22c55e",
      fillOpacity: 0.68,
      legend: [{ label: t?.("map.mode.infrastructure.legendLabel") ?? "Coverage", color: "#22c55e", description: t?.("map.mode.infrastructure.legendDescription") ?? "Logistics availability and load" }],
    },
    colonization: {
      label: t?.("map.mode.colonization.label") ?? "Colonization",
      shortLabel: t?.("map.mode.colonization.shortLabel") ?? "Colonies",
      icon: Flag,
      fillColor: "#4ade80",
      fillOpacity: 0.68,
      legend: [{ label: t?.("map.mode.colonization.legendLabel") ?? "Available", color: "#4ade80", description: t?.("map.mode.colonization.legendDescription") ?? "Neutral territories available for colonization" }],
    },
    military: {
      label: t?.("map.mode.military.label") ?? "Military",
      shortLabel: t?.("map.mode.military.shortLabel") ?? "Army",
      icon: Crosshair,
      fillColor: "#ef4444",
      fillOpacity: 0.68,
      legend: [{ label: t?.("map.mode.military.legendLabel") ?? "Armies", color: "#ef4444", description: t?.("map.mode.military.legendDescription") ?? "Own and foreign divisions" }],
    },
  };
  return configs[modeId];
}

function toProvinceMatchKeys(provinceId: string): Array<string | number> {
  const raw = String(provinceId ?? "").trim();
  if (!raw) return [];
  const keys: Array<string | number> = [raw];
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) keys.push(asNumber);
  const trailingNumber = raw.match(/(\d+)\s*$/)?.[1];
  if (trailingNumber) {
    const parsed = Number(trailingNumber);
    if (Number.isFinite(parsed)) keys.push(parsed, trailingNumber);
  }
  return [...new Set(keys)];
}

function buildProvinceMatchExpression(groups: Array<{ ids: string[]; value: unknown }>, fallback: unknown): unknown {
  const expression: unknown[] = ["match", ["id"]];
  for (const group of groups) {
    const ids = [...new Set(group.ids.flatMap(toProvinceMatchKeys))];
    if (ids.length === 0) continue;
    expression.push(ids, group.value);
  }
  return expression.length > 2 ? [...expression, fallback] : fallback;
}

const TRANSPORT_CORRIDOR_MODE_OPTIONS: Array<{ id: TransportMode; labelKey: UiTextKey; icon: typeof Route; color: string }> = [
  { id: "land", labelKey: "map.transport.land", icon: Truck, color: "#60a5fa" },
  { id: "sea", labelKey: "map.transport.sea", icon: Ship, color: "#38bdf8" },
  { id: "air", labelKey: "map.transport.air", icon: Plane, color: "#a78bfa" },
  { id: "pipeline", labelKey: "map.transport.pipeline", icon: Network, color: "#f97316" },
  { id: "powerGrid", labelKey: "map.transport.powerGrid", icon: Zap, color: "#facc15" },
];

const TRANSPORT_CORRIDOR_VISUAL: Record<TransportMode, { color: [number, number, number]; symbol: string; width: number; dash: [number, number] }> = {
  land: { color: [96, 165, 250], symbol: "•", width: 3.2, dash: [1, 0] },
  sea: { color: [56, 189, 248], symbol: "≈", width: 4.6, dash: [1, 0] },
  air: { color: [167, 139, 250], symbol: "✦", width: 3.4, dash: [3, 7] },
  pipeline: { color: [249, 115, 22], symbol: "●", width: 4.4, dash: [12, 4] },
  powerGrid: { color: [250, 204, 21], symbol: "⚡", width: 4, dash: [2, 4] },
};

type CorridorDeckRow = {
  id: string;
  path: Array<[number, number]>;
  color: [number, number, number];
  width: number;
  dash: [number, number];
  offset: number;
  status: MarketTransportCorridor["status"];
  isOwn: boolean;
};

type CorridorNodeDeckRow = {
  id: string;
  position: [number, number];
  color: [number, number, number];
  status: MarketTransportCorridor["status"];
};

type CorridorBuildPoint = {
  provinceId: string;
  lng: number;
  lat: number;
};

const TRANSPORT_MODE_IDS: TransportMode[] = ["land", "sea", "air", "pipeline", "powerGrid"];
const TRANSPORT_MODE_LABEL_KEYS: Record<TransportMode, UiTextKey> = {
  land: "map.transport.land",
  sea: "map.transport.sea",
  air: "map.transport.air",
  pipeline: "map.transport.pipeline",
  powerGrid: "map.transport.powerGrid",
};
const POLITICAL_LENS_OPTIONS: Array<{ id: PoliticalLensId; labelKey: UiTextKey }> = [
  { id: "owners", labelKey: "map.lens.political.owners" },
  { id: "mine", labelKey: "map.lens.political.mine" },
  { id: "colonies", labelKey: "map.lens.political.colonies" },
];
const MARKET_LENS_OPTIONS = [
  { id: "membership", labelKey: "map.lens.markets.membership" },
  { id: "selectedMarketMembers", labelKey: "map.lens.markets.selected" },
  { id: "capitals", labelKey: "map.lens.markets.capitals" },
] as const;
const POPULATION_LENS_OPTIONS = [
  { id: "density", labelKey: "map.lens.population.density" },
  { id: "cultures", labelKey: "map.lens.population.cultures" },
  { id: "religions", labelKey: "map.lens.population.religions" },
  { id: "races", labelKey: "map.lens.population.races" },
  { id: "professions", labelKey: "map.lens.population.professions" },
  { id: "ideologies", labelKey: "map.lens.population.ideologies" },
  { id: "standardOfLiving", labelKey: "map.lens.population.standardOfLiving" },
  { id: "radicals", labelKey: "map.lens.population.radicals" },
  { id: "loyalists", labelKey: "map.lens.population.loyalists" },
  { id: "needs", labelKey: "map.lens.population.needs" },
] as const;
const RESOURCE_LENS_OPTIONS = [
  { id: "deposits", labelKey: "map.lens.resources.deposits" },
  { id: "exploration", labelKey: "map.lens.resources.exploration" },
] as const;
const INFRASTRUCTURE_LENS_VIEW_OPTIONS = [
  { id: "load", labelKey: "map.lens.infrastructure.load" },
  { id: "coverage", labelKey: "map.lens.infrastructure.coverage" },
  { id: "problems", labelKey: "map.lens.infrastructure.problems" },
  { id: "corridors", labelKey: "map.lens.infrastructure.corridors" },
] as const;
const COLONIZATION_LENS_OPTIONS = [
  { id: "available", labelKey: "map.lens.colonization.available" },
  { id: "cost", labelKey: "map.lens.colonization.cost" },
  { id: "ownRaces", labelKey: "map.lens.colonization.ownRaces" },
  { id: "foreignRaces", labelKey: "map.lens.colonization.foreignRaces" },
  { id: "blocked", labelKey: "map.lens.colonization.blocked" },
] as const;
const DIPLOMACY_LENS_OPTIONS = [
  { id: "treaties", labelKey: "map.lens.diplomacy.treaties" },
  { id: "transit", labelKey: "map.lens.diplomacy.transit" },
  { id: "corridorAccess", labelKey: "map.lens.diplomacy.corridorAccess" },
] as const;
const MILITARY_LENS_OPTIONS = [
  { id: "armies", labelKey: "map.lens.military.armies" },
] as const;
const POLITICAL_LENS_ICONS: Record<PoliticalLensId, LucideIcon> = {
  owners: Landmark,
  country: Landmark,
  mine: LocateFixed,
  colonies: Flag,
};
const MARKET_LENS_ICONS: Record<MarketLensId, LucideIcon> = {
  membership: Package,
  selectedMarketMembers: LocateFixed,
  capitals: Landmark,
};
const POPULATION_LENS_ICONS: Record<PopulationLensId, LucideIcon> = {
  density: Users,
  cultures: Sparkles,
  religions: Landmark,
  races: Users,
  professions: Briefcase,
  ideologies: Flag,
  standardOfLiving: Coins,
  radicals: Zap,
  loyalists: Check,
  needs: Package,
};
const RESOURCE_LENS_ICONS: Record<ResourceLensId, LucideIcon> = {
  deposits: Pickaxe,
  exploration: Sparkles,
};
const INFRASTRUCTURE_LENS_VIEW_ICONS: Record<InfrastructureLensViewId, LucideIcon> = {
  load: Gauge,
  coverage: Check,
  problems: AlertTriangle,
  corridors: Route,
};
const COLONIZATION_LENS_ICONS: Record<ColonizationLensId, LucideIcon> = {
  available: Flag,
  cost: Coins,
  ownRaces: LocateFixed,
  foreignRaces: Flag,
  blocked: Lock,
};
const DIPLOMACY_LENS_ICONS: Record<DiplomacyLensId, LucideIcon> = {
  treaties: Briefcase,
  transit: Route,
  corridorAccess: LockOpen,
};
const MILITARY_LENS_ICONS: Record<MilitaryLensId, LucideIcon> = {
  armies: Crosshair,
};
const INFRASTRUCTURE_LENS_TRANSPORT_MODES: TransportMode[] = ["land", "sea", "air", "pipeline", "powerGrid"];
const MAP_MODE_IDS = [
  "political",
  "regions",
  "provinceColors",
  "diplomacy",
  "markets",
  "population",
  "resources",
  "infrastructure",
  "colonization",
  "military",
] as const satisfies readonly MapModeId[];

function getInfrastructureLensTransport(value: InfrastructureLensId): TransportMode {
  const [mode] = value.split(":");
  return INFRASTRUCTURE_LENS_TRANSPORT_MODES.includes(mode as TransportMode) ? (mode as TransportMode) : "land";
}

function getInfrastructureLensView(value: InfrastructureLensId): InfrastructureLensViewId {
  const view = value.split(":")[1];
  return view === "coverage" || view === "load" || view === "problems" || view === "corridors" ? view : "load";
}

function isTransportInfrastructureLens(value: InfrastructureLensId): boolean {
  return INFRASTRUCTURE_LENS_TRANSPORT_MODES.includes(getInfrastructureLensTransport(value));
}

type TransportInfrastructureCoverageIds = {
  excellent: string[];
  high: string[];
  medium: string[];
  low: string[];
  critical: string[];
  noDemand: string[];
};

function setInteractions(map: MapLibreMap, enabled: boolean) {
  const action = enabled ? "enable" : "disable";
  map.dragPan[action]();
  map.scrollZoom[action]();
  map.boxZoom[action]();
  map.dragRotate[action]();
  map.keyboard[action]();
  map.doubleClickZoom[action]();
  map.touchZoomRotate[action]();
}

function hasInfrastructureConstructionRight(
  rights: InfrastructureConstructionRight[],
  params: {
    grantorCountryId: string;
    builderCountryId: string;
    transportMode: TransportMode;
    turnId: number;
  },
): boolean {
  return rights.some((right) => {
    if (!right.active) return false;
    if (typeof right.expiresTurnId === "number" && right.expiresTurnId < params.turnId) return false;
    if (right.transportModes.length > 0 && !right.transportModes.includes(params.transportMode)) return false;
    if (right.fromCountryId === params.grantorCountryId && right.toCountryId === params.builderCountryId) return true;
    return right.bilateral && right.fromCountryId === params.builderCountryId && right.toCountryId === params.grantorCountryId;
  });
}

function readProvinceId(properties: Record<string, unknown> | undefined) {
  const raw = properties?.province_id ?? properties?.PROVINCE_ID ?? properties?.provinceId ?? properties?.id ?? properties?.ID_1 ?? properties?.adm1_code ?? properties?.name;
  return raw == null ? "" : String(raw);
}

function readProvinceName(properties: Record<string, unknown> | undefined) {
  const raw = properties?.name ?? properties?.NAME_1 ?? properties?.gn_name ?? properties?.id;
  return raw == null ? "Провинция" : String(raw);
}

function resolveAssetUrl(apiBase: string, url?: string | null): string | null {
  if (!url) {
    return null;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${apiBase}${url.startsWith("/") ? "" : "/"}${url}`;
}

function createPatternData(striped: boolean): { width: number; height: number; data: Uint8Array } {
  const width = 8;
  const height = 8;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (striped) {
        // Two-tone overlay: both bands are tinted, one is stronger to create visible alternation.
        const isLightBand = (x + y) % 6 <= 2;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = isLightBand ? 150 : 45;
      } else {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      }
    }
  }

  return { width, height, data };
}

function darkenHexColor(hex: string, factor = 0.45): string {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) {
    return "#475569";
  }
  const raw = match[1];
  const to = (start: number) => Math.max(0, Math.min(255, Math.round(parseInt(raw.slice(start, start + 2), 16) * factor)));
  const r = to(0).toString(16).padStart(2, "0");
  const g = to(2).toString(16).padStart(2, "0");
  const b = to(4).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function mixHexColor(hex: string, targetHex: string, amount = 0.35): string {
  const source = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  const target = /^#?([0-9a-fA-F]{6})$/.exec(targetHex.trim());
  if (!source || !target) {
    return "#d8c8aa";
  }
  const sourceRaw = source[1];
  const targetRaw = target[1];
  const mix = (start: number) => {
    const a = parseInt(sourceRaw.slice(start, start + 2), 16);
    const b = parseInt(targetRaw.slice(start, start + 2), 16);
    return Math.max(0, Math.min(255, Math.round(a + (b - a) * amount)));
  };
  const r = mix(0).toString(16).padStart(2, "0");
  const g = mix(2).toString(16).padStart(2, "0");
  const b = mix(4).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function applyAntarcticaVisibilityFilter(map: MapLibreMap, showAntarctica: boolean): void {
  const filter = showAntarctica
    ? null
    : ([
        "all",
        ["!=", ["coalesce", ["get", "admin"], ""], "Antarctica"],
        ["!=", ["coalesce", ["get", "adm0_a3"], ""], "ATA"],
      ] as unknown as maplibregl.FilterSpecification);

  const layerIds = ["province-fill", "province-colonize-stripes", "province-hover", "province-selected", "province-colonize-ring", "province-line", "country-labels"] as const;
  for (const layerId of layerIds) {
    if (map.getLayer(layerId)) {
      map.setFilter(layerId, filter);
    }
  }
}

function lightenHexColor(hex: string, amount = 0.28): string {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) {
    return "#cbd5e1";
  }
  const raw = match[1];
  const to = (start: number) => {
    const base = parseInt(raw.slice(start, start + 2), 16);
    return Math.max(0, Math.min(255, Math.round(base + (255 - base) * amount)));
  };
  const r = to(0).toString(16).padStart(2, "0");
  const g = to(2).toString(16).padStart(2, "0");
  const b = to(4).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

const RESOURCE_COLOR_PALETTE = ["#a78bfa", "#38bdf8", "#facc15", "#fb7185", "#34d399", "#f97316", "#60a5fa", "#e879f9", "#c084fc", "#94a3b8"];
const MARKET_COLOR_PALETTE = ["#4f46e5", "#059669", "#b45309", "#be123c", "#0891b2", "#7c3aed", "#15803d", "#c2410c", "#0369a1", "#a21caf"];
const REGION_COLOR_PALETTE = ["#22d3ee", "#a78bfa", "#34d399", "#f59e0b", "#fb7185", "#60a5fa", "#84cc16", "#f472b6", "#14b8a6", "#c084fc", "#f97316", "#38bdf8"];

function stableResourceColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return RESOURCE_COLOR_PALETTE[hash % RESOURCE_COLOR_PALETTE.length];
}

function stableMarketColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  }
  return MARKET_COLOR_PALETTE[hash % MARKET_COLOR_PALETTE.length];
}

function stableRegionColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 37 + id.charCodeAt(i)) >>> 0;
  }
  return REGION_COLOR_PALETTE[hash % REGION_COLOR_PALETTE.length];
}

export function resolveAuthoredProvinceColorState(meta: Pick<ProvinceMapMeta, "provinceColor" | "regionColor" | "regionId"> | null | undefined): AuthoredProvinceColorState {
  const provinceColor = meta?.provinceColor ?? PROVINCE_TEXTURE_FILL_COLOR;
  const regionColor = meta?.regionColor ?? (meta?.regionId ? stableRegionColor(meta.regionId) : "#22d3ee");
  return {
    provinceMapColor: mixHexColor(lightenHexColor(provinceColor, 0.12), "#f4e3bc", 0.18),
    provinceMapBorderColor: darkenHexColor(provinceColor, 0.42),
    regionMapColor: mixHexColor(lightenHexColor(regionColor, 0.14), "#f4e3bc", 0.22),
    regionMapBorderColor: darkenHexColor(regionColor, 0.42),
  };
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
        scaled >= 100 ? Math.floor(scaled).toString() : scaled >= 10 ? scaled.toFixed(1).replace(/\.0$/, "") : scaled.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
      return `${sign}${text}${unit.s}`;
    }
  }

  return `${sign}${Math.floor(abs)}`;
}

function formatSignedCompact(value: number): string {
  if (value > 0) return `+${formatCompact(value)}`;
  if (value < 0) return `-${formatCompact(Math.abs(value))}`;
  return "0";
}

function formatProvinceMetaValue(value: string | number | null | undefined, suffix = ""): string {
  if (typeof value === "string") {
    const text = value.trim();
    return text.length > 0 ? text : "нет данных";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}${suffix}`;
  }
  return "нет данных";
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.max(0, Math.min(100, value)).toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "")}%`;
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function percentile(values: number[], pct: number): number {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * pct) - 1));
  return sorted[index] ?? 0;
}

function heatColor(pct: number, low: string, mid: string, high: string): string {
  const clamped = clamp01(pct);
  return clamped < 0.5
    ? mixHexColor(low, mid, clamped * 2)
    : mixHexColor(mid, high, (clamped - 0.5) * 2);
}

function getPopulationStats(population: (typeof EMPTY_PROVINCE_POPULATION)[string] | undefined) {
  let total = 0;
  let weightedSoL = 0;
  let needsWeighted = 0;
  let needsWeight = 0;
  let radicals = 0;
  let loyalists = 0;

  for (const pop of population?.pops ?? []) {
    total += Math.max(0, Number(pop.size) || 0);
    for (const profession of Object.values(pop.professions ?? {})) {
      const size = Math.max(0, Number(profession.size) || 0);
      if (size <= 0) continue;
      weightedSoL += Math.max(0, Number(profession.standardOfLiving) || 0) * size;
      const needs = Number(profession.lastNeedsSatisfaction);
      if (Number.isFinite(needs)) {
        needsWeighted += clampPct(needs * 100) * size;
        needsWeight += size;
      }
      radicals += Math.max(0, Number(profession.radicals) || 0);
      loyalists += Math.max(0, Number(profession.loyalists) || 0);
    }
  }

  return {
    total,
    averageSoL: total > 0 ? weightedSoL / total : 0,
    needsSatisfaction: needsWeight > 0 ? needsWeighted / needsWeight : null,
    radicals,
    loyalists,
  };
}

type HoverModeRow = { label: string; value: string; tone?: "default" | "good" | "warn" | "bad" };

type PopulationMapRow = {
  provinceId: string;
  color: string;
  opacity: number;
  borderColor: string;
  borderOpacity: number;
  label: string;
  value: number;
};

export function MapView({
  apiBase,
  onQueueBuildOrder,
  onQueueColonizeOrder,
  onOpenAdminProvinceEditor,
  onOpenProvinceKnowledge,
  onCreateProvinceKnowledge,
  onProvinceRenameCharged,
  colonizationIconUrl,
  ducatsIconUrl,
  maxActiveColonizations,
  colonizationCostPer1000Km2,
  provinceRenameDucatsCost = 25,
  showMapControls = false,
  showAntarctica = false,
}: Props) {
  const { t } = useUiText();
  const transportModeLabel = (mode: TransportMode) => t(TRANSPORT_MODE_LABEL_KEYS[mode]);
  const mapModeOptions = useMemo(() => MAP_MODE_IDS.map((id) => ({ id, ...getMapModeConfig(id, t) })), [t]);
  const [activeModeId, setActiveModeId] = useState<MapModeId>(() => {
    try {
      const raw = localStorage.getItem("arc.ui.map.activeModeId");
      return MAP_MODE_IDS.includes(raw as MapModeId) ? (raw as MapModeId) : "political";
    } catch {
      return "political";
    }
  });
  const activeModeConfig = useMemo(() => getMapModeConfig(activeModeId, t), [activeModeId, t]);

  const mapRef = useRef<MapLibreMap | null>(null);
  const deckOverlayRef = useRef<MapboxOverlay | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoveredFeatureIdRef = useRef<string | null>(null);
  const selectedFeatureIdRef = useRef<string | null>(null);
  const prevOwnedProvinceIdsRef = useRef<Set<string>>(new Set());
  const prevColonizingProvinceIdsRef = useRef<Set<string>>(new Set());
  const prevQueuedColonizeProvinceIdsRef = useRef<Set<string>>(new Set());
  const prevConfiguredColonizeProvinceIdsRef = useRef<Set<string>>(new Set());
  const prevPopulationMapProvinceIdsRef = useRef<Set<string>>(new Set());
  const provinceNamesByIdRef = useRef<Map<string, string>>(new Map());
  const provinceMetaByIdRef = useRef<Map<string, ProvinceMapMeta>>(new Map());
  const marketCapitalMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const showMapControlsRef = useRef(showMapControls);
  const viewRafRef = useRef<number | null>(null);
  const hoverTooltipRafRef = useRef<number | null>(null);
  const mapMovingRef = useRef(false);
  const queuedColonizeCountriesByProvinceRef = useRef<Map<string, string[]>>(new Map());
  const lastHoverTooltipProvinceIdRef = useRef<string | null>(null);

  const [interactionLocked, setInteractionLocked] = useState(() => {
    try {
      return localStorage.getItem("arc.ui.map.interactionLocked") === "1";
    } catch {
      return false;
    }
  });
  const [showProvinceBorders, setShowProvinceBorders] = useState(() => {
    try {
      const raw = localStorage.getItem("arc.ui.map.showProvinceBorders");
      return raw == null ? true : raw === "1";
    } catch {
      return true;
    }
  });
  const [selectedProvinceName, setSelectedProvinceName] = useState<string | null>(null);
  const [view, setView] = useState({ zoom: DEFAULT_ZOOM, lng: DEFAULT_CENTER[0], lat: DEFAULT_CENTER[1] });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; provinceId: string; provinceName: string } | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{
    x: number;
    y: number;
    provinceName: string;
    areaKm2: number | null;
    ownerName: string;
    colonizers: Array<{ countryId: string; countryName: string; countryColor: string; percent: number; hasQueuedOrder: boolean }>;
    modeLabel: string;
    modeRows: Array<{ label: string; value: string; tone?: "default" | "good" | "warn" | "bad" }>;
  } | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [colonizationModalOpen, setColonizationModalOpen] = useState(false);
  const [provinceRenameModalOpen, setProvinceRenameModalOpen] = useState(false);
  const [provinceRenameInput, setProvinceRenameInput] = useState("");
  const [provinceRenamePending, setProvinceRenamePending] = useState(false);
  const [colonizationActionPending, setColonizationActionPending] = useState(false);
  const [politicalCountryFilter, setPoliticalCountryFilter] = useState("all");
  const [politicalLens, setPoliticalLens] = useState<PoliticalLensId>(DEFAULT_MAP_LENSES.political);
  const [politicalShowColonies, setPoliticalShowColonies] = useState(true);
  const [marketLens, setMarketLens] = useState(DEFAULT_MAP_LENSES.markets);
  const [selectedMarketLensMarketId, setSelectedMarketLensMarketId] = useState("current");
  const [populationLens, setPopulationLens] = useState(DEFAULT_MAP_LENSES.population);
  const [resourceLens, setResourceLens] = useState(DEFAULT_MAP_LENSES.resources);
  const [resourceGoodId, setResourceGoodId] = useState("all");
  const [infrastructureLens, setInfrastructureLens] = useState<InfrastructureLensId>(DEFAULT_MAP_LENSES.infrastructure);
  const infrastructureTransportMode = getInfrastructureLensTransport(infrastructureLens);
  const infrastructureLensView = getInfrastructureLensView(infrastructureLens);
  const [diplomacyLens, setDiplomacyLens] = useState(DEFAULT_MAP_LENSES.diplomacy);
  const [colonizationLens, setColonizationLens] = useState(DEFAULT_MAP_LENSES.colonization);
  const [militaryLens, setMilitaryLens] = useState(DEFAULT_MAP_LENSES.military);
  const [politicalOnlyMine, setPoliticalOnlyMine] = useState(false);
  const [politicalOnlyNeutral, setPoliticalOnlyNeutral] = useState(false);
  const [provinceIndexVersion, setProvinceIndexVersion] = useState(0);
  const [mapStyleReadyVersion, setMapStyleReadyVersion] = useState(0);
  const [selectedProvincePanelTab, setSelectedProvincePanelTab] = useState<"overview" | "corridors" | "population" | "buildings" | "resources">("overview");
  const [selectedProvincePanelCollapsed, setSelectedProvincePanelCollapsed] = useState(() => {
    try {
      return localStorage.getItem("arc.ui.map.provincePanelCollapsed") === "1";
    } catch {
      return false;
    }
  });
  const [selectedProvincePanelPinned, setSelectedProvincePanelPinned] = useState(() => {
    try {
      return localStorage.getItem("arc.ui.map.provincePanelPinned") === "1";
    } catch {
      return false;
    }
  });
  const [explorationActionPending, setExplorationActionPending] = useState(false);
  const [buildingMetaById, setBuildingMetaById] = useState<Record<string, { name: string; logoUrl: string | null }>>({});
  const [goodMetaById, setGoodMetaById] = useState<
    Record<
      string,
      {
        name: string;
        logoUrl: string | null;
        color: string;
        isResourceDiscoverable: boolean;
        explorationBaseWeight: number;
        resourceCategoryId: string | null;
        transportModes: TransportMode[];
      }
    >
  >({});
  const [populationMetaByKind, setPopulationMetaByKind] = useState<
    Record<"cultures" | "religions" | "races" | "professions" | "ideologies", Record<string, { name: string; color: string; logoUrl: string | null }>>
  >({ cultures: {}, religions: {}, races: {}, professions: {}, ideologies: {} });
  const [marketAccessByProvince, setMarketAccessByProvince] = useState(EMPTY_MARKET_ACCESS_BY_PROVINCE);
  const [marketsCatalog, setMarketsCatalog] = useState<MarketCatalogItem[]>([]);
  const [marketTransportCorridors, setMarketTransportCorridors] = useState<MarketTransportCorridor[]>(EMPTY_MARKET_TRANSPORT_CORRIDORS);
  const [infrastructureConstructionRights, setInfrastructureConstructionRights] = useState<InfrastructureConstructionRight[]>([]);
  const [marketCapitalProvinceId, setMarketCapitalProvinceId] = useState<string | null>(null);
  const [currentMarketId, setCurrentMarketId] = useState<string | null>(null);
  const [transportCorridorsModalOpen, setTransportCorridorsModalOpen] = useState(false);
  const [transportCorridorsModalView, setTransportCorridorsModalView] = useState<"corridors" | "problems">("corridors");
  const [selectedTransportCorridorId, setSelectedTransportCorridorId] = useState<string | null>(null);
  const [corridorBuildMode, setCorridorBuildMode] = useState(false);
  const [corridorBuildTransportMode, setCorridorBuildTransportMode] = useState<TransportMode>("land");
  const [corridorBuildProvinceIds, setCorridorBuildProvinceIds] = useState<string[]>([]);
  const [corridorBuildRoutePoints, setCorridorBuildRoutePoints] = useState<CorridorBuildPoint[]>([]);
  const [corridorPending, setCorridorPending] = useState(false);
  const [corridorPendingId, setCorridorPendingId] = useState<string | null>(null);
  const corridorBuildModeRef = useRef(false);
  const corridorBuildTransportModeRef = useRef<TransportMode>("land");
  const corridorBuildRoutePointsRef = useRef<CorridorBuildPoint[]>([]);
  useEffect(() => {
    corridorBuildModeRef.current = corridorBuildMode;
  }, [corridorBuildMode]);
  useEffect(() => {
    corridorBuildTransportModeRef.current = corridorBuildTransportMode;
  }, [corridorBuildTransportMode]);
  useEffect(() => {
    corridorBuildRoutePointsRef.current = corridorBuildRoutePoints;
  }, [corridorBuildRoutePoints]);
  const infrastructureConstructionRightsRef = useRef<InfrastructureConstructionRight[]>([]);
  useEffect(() => {
    infrastructureConstructionRightsRef.current = infrastructureConstructionRights;
  }, [infrastructureConstructionRights]);

  const auth = useGameStore((s) => s.auth);
  const authCountryIdRef = useRef<string | null>(auth?.countryId ?? null);
  useEffect(() => {
    authCountryIdRef.current = auth?.countryId ?? null;
  }, [auth?.countryId]);
  const turnId = useGameStore((s) => s.turnId);
  const turnIdRef = useRef(turnId);
  useEffect(() => {
    turnIdRef.current = turnId;
  }, [turnId]);
  const selectedProvinceId = useGameStore((s) => s.selectedProvinceId);
  const setSelectedProvince = useGameStore((s) => s.setSelectedProvince);
  const provinceOwnerById = useGameStore((s) => s.worldBase?.provinceOwner ?? EMPTY_PROVINCE_OWNER);
  const regionOwnerById = useGameStore((s) => s.worldBase?.regionOwner ?? EMPTY_PROVINCE_OWNER);
  const provinceNameById = useGameStore((s) => s.worldBase?.provinceNameById ?? EMPTY_PROVINCE_NAMES);
  const colonyProgressByRegion = useGameStore((s) => s.worldBase?.colonyProgressByRegion ?? EMPTY_COLONY_PROGRESS);
  const regionColonizationByRegion = useGameStore((s) => s.worldBase?.regionColonizationByRegion ?? EMPTY_PROVINCE_COLONIZATION);
  const regionBuildingsByRegion = useGameStore(
    (s) =>
      ((s.worldBase as unknown as { regionBuildingsByRegion?: Record<string, Array<{ buildingId?: string }>> })
        ?.regionBuildingsByRegion ?? EMPTY_PROVINCE_BUILDINGS),
  );
  const regionConstructionQueueByRegion = useGameStore(
    (s) =>
      ((s.worldBase as unknown as {
        regionConstructionQueueByRegion?: Record<
          string,
          Array<{ queueId: string; buildingId: string; progressConstruction: number; costConstruction: number; projectType?: "build" | "upgrade" }>
        >;
      })?.regionConstructionQueueByRegion ?? EMPTY_PROVINCE_CONSTRUCTION_QUEUE),
  );
  const regionPopulationByRegion = useGameStore(
    (s) =>
      ((s.worldBase as unknown as {
        regionPopulationByRegion?: typeof EMPTY_PROVINCE_POPULATION;
      })?.regionPopulationByRegion ?? EMPTY_PROVINCE_POPULATION),
  );
  const regionResourceDepositsByRegion = useGameStore(
    (s) =>
      ((s.worldBase as unknown as {
        regionResourceDepositsByRegion?: Record<
          string,
          Array<{ goodId: string; amount: number; discoveredTurnId: number; veinSize: "small" | "medium" | "large" }>
        >;
      })?.regionResourceDepositsByRegion ?? EMPTY_PROVINCE_RESOURCE_DEPOSITS),
  );
  const regionResourceExplorationQueueByRegion = useGameStore(
    (s) =>
      ((s.worldBase as unknown as {
        regionResourceExplorationQueueByRegion?: Record<
          string,
          Array<{ queueId: string; turnsRemaining: number; startedTurnId: number; requestedByCountryId: string }>
        >;
      })?.regionResourceExplorationQueueByRegion ?? EMPTY_PROVINCE_EXPLORATION_QUEUE),
  );
  const regionResourceExplorationCountByRegion = useGameStore(
    (s) =>
      ((s.worldBase as unknown as { regionResourceExplorationCountByRegion?: Record<string, number> })
        ?.regionResourceExplorationCountByRegion ?? EMPTY_PROVINCE_EXPLORATION_COUNT),
  );
  const divisionsById = useGameStore(
    (s) =>
      ((s.worldBase as unknown as {
        divisionsById?: Record<string, { id: string; name: string; countryId: string; provinceId: string }>;
      })?.divisionsById ?? EMPTY_DIVISIONS_BY_ID),
  );
  const divisionsByIdRef = useRef(divisionsById);
  useEffect(() => {
    divisionsByIdRef.current = divisionsById;
  }, [divisionsById]);
  const selectedDivisionId: string | null = null;
  const ordersByTurn = useGameStore((s) => s.ordersByTurn);
  const addEvent = useGameStore((s) => s.addEvent);
  const updateCountryResources = useGameStore((s) => s.updateCountryResources);

  useEffect(() => {
    if (!auth?.token) {
      setMarketAccessByProvince(EMPTY_MARKET_ACCESS_BY_PROVINCE);
      setMarketTransportCorridors(EMPTY_MARKET_TRANSPORT_CORRIDORS);
      setInfrastructureConstructionRights([]);
      setMarketCapitalProvinceId(null);
      setCurrentMarketId(null);
      setMarketsCatalog([]);
      return;
    }
    let cancelled = false;
    void Promise.all([fetchMarketOverview(auth.token), fetchMarketsCatalog(auth.token), fetchInfrastructureConstructionRights(auth.token)])
      .then(([overview, catalog, constructionRights]) => {
        if (!cancelled) {
          const marketOverview = overview as typeof overview & { marketAccessByProvince?: typeof EMPTY_MARKET_ACCESS_BY_PROVINCE };
          setMarketAccessByProvince(marketOverview.marketAccessByProvince ?? EMPTY_MARKET_ACCESS_BY_PROVINCE);
          setMarketTransportCorridors(overview.transportCorridors ?? EMPTY_MARKET_TRANSPORT_CORRIDORS);
          setInfrastructureConstructionRights(constructionRights.rights ?? []);
          setMarketCapitalProvinceId(overview.marketCapitalProvinceId ?? null);
          setCurrentMarketId(overview.marketId);
          setMarketsCatalog(catalog.markets ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMarketAccessByProvince(EMPTY_MARKET_ACCESS_BY_PROVINCE);
          setMarketTransportCorridors(EMPTY_MARKET_TRANSPORT_CORRIDORS);
          setInfrastructureConstructionRights([]);
          setMarketCapitalProvinceId(null);
          setCurrentMarketId(null);
          setMarketsCatalog([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.token, turnId]);

  useEffect(() => {
    showMapControlsRef.current = showMapControls;
  }, [showMapControls]);

  useEffect(() => {
    try {
      localStorage.setItem("arc.ui.map.activeModeId", activeModeId);
    } catch {
      // ignore
    }
  }, [activeModeId]);

  const countryById = useMemo(() => {
    const m = new Map<string, Country>();
    for (const country of countries) {
      m.set(country.id, country);
    }
    return m;
  }, [countries]);

  const countryLabelData = useMemo<CountryLabelFeatureCollection>(() => {
    const buckets = new Map<string, { lng: number; lat: number; weight: number; area: number }>();
    const seenProvinceIds = new Set<string>();
    for (const [provinceId, meta] of provinceMetaByIdRef.current.entries()) {
      seenProvinceIds.add(provinceId);
      const countryId = (meta.regionId ? regionOwnerById[meta.regionId] : null) ?? provinceOwnerById[provinceId];
      if (!countryId) continue;
      const lng = meta.centerX ?? meta.sourceCenterX ?? null;
      const lat = meta.centerY ?? meta.sourceCenterY ?? null;
      if (lng == null || lat == null || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      const area = Math.max(1, Number(meta.areaKm2 ?? 1) || 1);
      const bucket = buckets.get(countryId) ?? { lng: 0, lat: 0, weight: 0, area: 0 };
      bucket.lng += lng * area;
      bucket.lat += lat * area;
      bucket.weight += area;
      bucket.area += area;
      buckets.set(countryId, bucket);
    }
    for (const [provinceId, countryId] of Object.entries(provinceOwnerById)) {
      if (!countryId || seenProvinceIds.has(provinceId)) continue;
      const meta = provinceMetaByIdRef.current.get(provinceId);
      const lng = meta?.centerX ?? meta?.sourceCenterX ?? null;
      const lat = meta?.centerY ?? meta?.sourceCenterY ?? null;
      if (lng == null || lat == null || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      const area = Math.max(1, Number(meta?.areaKm2 ?? 1) || 1);
      const bucket = buckets.get(countryId) ?? { lng: 0, lat: 0, weight: 0, area: 0 };
      bucket.lng += lng * area;
      bucket.lat += lat * area;
      bucket.weight += area;
      bucket.area += area;
      buckets.set(countryId, bucket);
    }
    const features = [...buckets.entries()].flatMap(([countryId, bucket]) => {
      if (bucket.weight <= 0) return [];
      const country = countryById.get(countryId);
      return [{
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [bucket.lng / bucket.weight, bucket.lat / bucket.weight] as [number, number],
        },
        properties: {
          countryId,
          name: country?.name ?? countryId,
          area: bucket.area,
          color: country?.color ?? "#64748b",
        },
      }];
    });
    features.sort((a, b) => b.properties.area - a.properties.area || a.properties.name.localeCompare(b.properties.name, "ru"));
    return { type: "FeatureCollection", features };
  }, [countryById, provinceOwnerById, provinceIndexVersion, regionOwnerById]);

  const transportLensProvinceIds = useMemo(() => {
    if (!isTransportInfrastructureLens(infrastructureLens)) {
      return { reachable: new Set<string>(), endpoints: new Set<string>() };
    }
    const endpoints = new Set<string>();
    const connectedProvinceIds = new Set<string>();
    const adjacency = new Map<string, string[]>();
    const addEdge = (from: string, to: string) => {
      if (!from || !to || from === to) return;
      adjacency.set(from, [...new Set([...(adjacency.get(from) ?? []), to])]);
      adjacency.set(to, [...new Set([...(adjacency.get(to) ?? []), from])]);
    };
    for (const corridor of marketTransportCorridors) {
      if (corridor.status !== "active" || corridor.transportMode !== infrastructureTransportMode) continue;
      for (const provinceId of corridor.provinceIds) {
        endpoints.add(provinceId);
        connectedProvinceIds.add(provinceId);
      }
      for (let index = 0; index < corridor.provinceIds.length - 1; index += 1) {
        const from = corridor.provinceIds[index];
        const to = corridor.provinceIds[index + 1];
        addEdge(from, to);
      }
    }
    for (const provinceId of connectedProvinceIds) {
      for (const neighborId of provinceMetaByIdRef.current.get(provinceId)?.neighbors ?? []) {
        if (connectedProvinceIds.has(neighborId)) {
          addEdge(provinceId, neighborId);
        }
      }
    }
    if (!marketCapitalProvinceId) return { reachable: new Set<string>(), endpoints };
    const reachable = new Set<string>([marketCapitalProvinceId]);
    const queue = [marketCapitalProvinceId];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      for (const next of adjacency.get(current) ?? []) {
        if (reachable.has(next)) continue;
        reachable.add(next);
        queue.push(next);
      }
    }
    return { reachable, endpoints };
  }, [infrastructureTransportMode, marketCapitalProvinceId, marketTransportCorridors, provinceIndexVersion]);

  const transportInfrastructureCoverage = useMemo<TransportInfrastructureCoverageIds>(() => {
    if (!isTransportInfrastructureLens(infrastructureLens)) {
      return { excellent: [], high: [], medium: [], low: [], critical: [], noDemand: [] };
    }
    const reachable = [...transportLensProvinceIds.reachable];
    const disconnectedEndpoints = [...transportLensProvinceIds.endpoints].filter((provinceId) => !transportLensProvinceIds.reachable.has(provinceId));
    return { excellent: reachable, high: [], medium: [], low: disconnectedEndpoints, critical: [], noDemand: [] };
  }, [infrastructureLens, transportLensProvinceIds]);

  const marketById = useMemo(() => new Map(marketsCatalog.map((market) => [market.id, market] as const)), [marketsCatalog]);

  const marketIdByProvince = useMemo(() => {
    const next = new Map<string, string>();
    for (const [provinceId, access] of Object.entries(marketAccessByProvince)) {
      const marketId = access.marketId?.trim();
      if (marketId) next.set(provinceId, marketId);
    }
    return next;
  }, [marketAccessByProvince]);

  const marketColorById = useMemo(() => {
    const next = new Map<string, string>();
    for (const market of marketsCatalog) {
      next.set(market.id, stableMarketColor(market.id));
    }
    return next;
  }, [marketsCatalog]);

  const resourceColorByGoodId = useMemo(() => {
    const next = new Map<string, string>();
    for (const [goodId, good] of Object.entries(goodMetaById)) {
      next.set(goodId, good.color ?? stableResourceColor(goodId));
    }
    return next;
  }, [goodMetaById]);

  const marketProvinceColorGroups = useMemo(() => {
    const byMarket = new Map<string, string[]>();
    for (const [provinceId, access] of Object.entries(marketAccessByProvince)) {
      const marketId = access.marketId?.trim();
      if (!marketId) continue;
      byMarket.set(marketId, [...(byMarket.get(marketId) ?? []), provinceId]);
    }
    return [...byMarket.entries()].map(([marketId, ids]) => ({
      ids,
      value: marketColorById.get(marketId) ?? stableMarketColor(marketId),
    }));
  }, [marketAccessByProvince, marketColorById]);

  const showCorridorDeckLayer = activeModeId === "infrastructure" || activeModeId === "diplomacy" || corridorBuildMode || transportCorridorsModalOpen;

  const corridorDeckData = useMemo<CorridorDeckRow[]>(() => {
    if (!showCorridorDeckLayer) return [];
    const modeFilter =
      activeModeId === "infrastructure" &&
      isTransportInfrastructureLens(infrastructureLens)
        ? infrastructureTransportMode
        : null;
    const rows = marketTransportCorridors
      .filter((corridor) => !modeFilter || corridor.transportMode === modeFilter)
      .flatMap((corridor) => {
        const coordinates =
          corridor.routePoints && corridor.routePoints.length >= 2
            ? corridor.routePoints.map((point) => [point.lng, point.lat] as [number, number])
            : corridor.provinceIds.flatMap((provinceId) => {
                const meta = provinceMetaByIdRef.current.get(provinceId);
                return meta?.centerX == null || meta.centerY == null ? [] : ([[meta.centerX, meta.centerY] as [number, number]]);
              });
        if (coordinates.length < 2) return [];
        const rawLine = lineString(coordinates);
        const routeLine = corridor.transportMode === "air" || corridor.transportMode === "sea"
          ? bezierSpline(rawLine, { sharpness: corridor.transportMode === "air" ? 0.78 : 0.55 })
          : rawLine;
        const path = routeLine.geometry.coordinates.map((coord) => [Number(coord[0]), Number(coord[1])] as [number, number]);
        const visual = TRANSPORT_CORRIDOR_VISUAL[corridor.transportMode];
        return [{
          id: corridor.id,
          path,
          color: visual.color,
          width: visual.width,
          dash: corridor.status === "active" ? visual.dash : corridor.status === "building" ? [5, 5] as [number, number] : [2, 7] as [number, number],
          offset: 0,
          status: corridor.status,
          isOwn: auth?.countryId === corridor.ownerCountryId,
        }];
      });
    if (corridorBuildMode && corridorBuildRoutePoints.length >= 2) {
      const rawLine = lineString(corridorBuildRoutePoints.map((point) => [point.lng, point.lat] as [number, number]));
      const routeLine = corridorBuildTransportMode === "air" || corridorBuildTransportMode === "sea"
        ? bezierSpline(rawLine, { sharpness: corridorBuildTransportMode === "air" ? 0.78 : 0.55 })
        : rawLine;
      const visual = TRANSPORT_CORRIDOR_VISUAL[corridorBuildTransportMode];
      rows.push({
        id: "corridor-build-preview",
        path: routeLine.geometry.coordinates.map((coord) => [Number(coord[0]), Number(coord[1])] as [number, number]),
        color: visual.color,
        width: visual.width + 1,
        dash: [5, 4],
        offset: 0,
        status: "building",
        isOwn: true,
      });
    }
    const groups = new Map<string, CorridorDeckRow[]>();
    for (const row of rows) {
      const forward = row.path.map((point) => `${point[0].toFixed(3)},${point[1].toFixed(3)}`).join(">");
      const reverse = row.path.map((point) => `${point[0].toFixed(3)},${point[1].toFixed(3)}`).reverse().join(">");
      const key = forward < reverse ? forward : reverse;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const center = (group.length - 1) / 2;
      group.forEach((row, index) => {
        row.offset = (index - center) * 1.75;
      });
    }
    return rows;
  }, [
    activeModeId,
    auth?.countryId,
    corridorBuildMode,
    corridorBuildRoutePoints,
    corridorBuildTransportMode,
    infrastructureLens,
    marketTransportCorridors,
    provinceIndexVersion,
    showCorridorDeckLayer,
  ]);

  useEffect(() => {
    const overlay = deckOverlayRef.current;
    if (!overlay) return;
    const backgroundLayer = new PathLayer<CorridorDeckRow>({
      id: "transport-corridors-bg",
      data: corridorDeckData,
      pickable: false,
      getPath: (row) => row.path,
      getColor: [3, 7, 18, 210],
      getWidth: (row) => row.width + 3.4,
      widthUnits: "pixels",
      rounded: true,
      jointRounded: true,
    });
    const lineLayer = new PathLayer<CorridorDeckRow, PathStyleExtensionProps<CorridorDeckRow>>({
      id: "transport-corridors-line",
      data: corridorDeckData,
      pickable: false,
      getPath: (row) => row.path,
      getColor: (row): [number, number, number, number] => {
        const alpha = row.status === "closed" ? 92 : row.status === "building" ? 150 : row.isOwn ? 245 : 205;
        return [...row.color, alpha];
      },
      getWidth: (row) => (row.isOwn ? row.width + 0.9 : row.width),
      widthUnits: "pixels",
      rounded: true,
      jointRounded: true,
      getDashArray: (row: CorridorDeckRow) => row.dash,
      getOffset: (row: CorridorDeckRow) => row.offset,
      dashJustified: true,
      extensions: [new PathStyleExtension({ dash: true, offset: true })],
    });
    const buildVisual = TRANSPORT_CORRIDOR_VISUAL[corridorBuildTransportMode];
    const nodeData: CorridorNodeDeckRow[] = [
      ...corridorDeckData.flatMap((row) => [row.path[0], row.path[row.path.length - 1]].map((position, index) => ({
        id: `${row.id}-${index}`,
        position,
        color: row.color,
        status: row.status,
      }))),
      ...(corridorBuildMode
        ? corridorBuildRoutePoints.map((point, index) => ({
            id: `corridor-build-point-${index}`,
            position: [point.lng, point.lat] as [number, number],
            color: buildVisual.color,
            status: "building" as const,
          }))
        : []),
    ];
    const nodeLayer = new ScatterplotLayer<CorridorNodeDeckRow>({
      id: "transport-corridors-nodes",
      data: nodeData,
      pickable: false,
      getPosition: (row) => row.position,
      getFillColor: (row): [number, number, number, number] => [...row.color, row.status === "closed" ? 90 : 210],
      getLineColor: [3, 7, 18, 230],
      stroked: true,
      getLineWidth: 1.5,
      lineWidthUnits: "pixels",
      getRadius: (row) => (row.id.startsWith("corridor-build-point-") ? 5.5 : 4),
      radiusUnits: "pixels",
    });
    overlay.setProps({ layers: [backgroundLayer, lineLayer, nodeLayer] });
  }, [corridorBuildMode, corridorBuildRoutePoints, corridorBuildTransportMode, corridorDeckData]);

  const countryByIdRef = useRef(countryById);
  useEffect(() => {
    countryByIdRef.current = countryById;
  }, [countryById]);

  const provinceOwnerByIdRef = useRef(provinceOwnerById);
  useEffect(() => {
    provinceOwnerByIdRef.current = provinceOwnerById;
  }, [provinceOwnerById]);
  const regionOwnerByIdRef = useRef(regionOwnerById);
  useEffect(() => {
    regionOwnerByIdRef.current = regionOwnerById;
  }, [regionOwnerById]);

  const provinceNameByIdRef = useRef(provinceNameById);
  useEffect(() => {
    provinceNameByIdRef.current = provinceNameById;
  }, [provinceNameById]);

  const colonyProgressByRegionRef = useRef(colonyProgressByRegion);
  useEffect(() => {
    colonyProgressByRegionRef.current = colonyProgressByRegion;
  }, [colonyProgressByRegion]);

  const regionColonizationByRegionRef = useRef(regionColonizationByRegion);
  useEffect(() => {
    regionColonizationByRegionRef.current = regionColonizationByRegion;
  }, [regionColonizationByRegion]);

  const hoverModeDataRef = useRef({
    activeModeId,
    activeModeConfig,
    infrastructureLens,
    countryId: auth?.countryId,
    regionBuildingsByRegion,
    regionConstructionQueueByRegion,
    regionPopulationByRegion,
    regionResourceDepositsByRegion,
    regionResourceExplorationQueueByRegion,
    regionResourceExplorationCountByRegion,
    marketAccessByProvince,
    marketById,
    transportLensProvinceIds,
    transportInfrastructureCoverage,
    buildingMetaById,
    goodMetaById,
    populationMetaByKind,
    populationLens,
    populationMapRowByProvince: new Map<string, PopulationMapRow>(),
  });
  useEffect(() => {
    hoverModeDataRef.current = {
      activeModeId,
      activeModeConfig,
      infrastructureLens,
      countryId: auth?.countryId,
      regionBuildingsByRegion,
      regionConstructionQueueByRegion,
      regionPopulationByRegion,
      regionResourceDepositsByRegion,
      regionResourceExplorationQueueByRegion,
      regionResourceExplorationCountByRegion,
      marketAccessByProvince,
      marketById,
      transportLensProvinceIds,
      transportInfrastructureCoverage,
      buildingMetaById,
      goodMetaById,
      populationMetaByKind,
      populationLens,
      populationMapRowByProvince: hoverModeDataRef.current.populationMapRowByProvince,
    };
  }, [
    activeModeConfig,
    activeModeId,
    auth?.countryId,
    infrastructureLens,
    regionBuildingsByRegion,
    regionConstructionQueueByRegion,
    regionPopulationByRegion,
    regionResourceDepositsByRegion,
    regionResourceExplorationQueueByRegion,
    regionResourceExplorationCountByRegion,
    marketAccessByProvince,
    marketById,
    transportLensProvinceIds,
    transportInfrastructureCoverage,
    buildingMetaById,
    goodMetaById,
    populationMetaByKind,
    populationLens,
  ]);

  useEffect(() => {
    const scope = auth?.countryId ?? "guest";
    try {
      const rawLocked = localStorage.getItem(`arc.ui.${scope}.map.interactionLocked`);
      const rawBorders = localStorage.getItem(`arc.ui.${scope}.map.showProvinceBorders`);
      setInteractionLocked(rawLocked === "1");
      setShowProvinceBorders(rawBorders == null ? true : rawBorders === "1");
    } catch {
      // ignore
    }
  }, [auth?.countryId]);

  useEffect(() => {
    try {
      localStorage.setItem(`arc.ui.${auth?.countryId ?? "guest"}.map.interactionLocked`, interactionLocked ? "1" : "0");
    } catch {
      // ignore
    }
  }, [auth?.countryId, interactionLocked]);

  useEffect(() => {
    try {
      localStorage.setItem(`arc.ui.${auth?.countryId ?? "guest"}.map.showProvinceBorders`, showProvinceBorders ? "1" : "0");
    } catch {
      // ignore
    }
  }, [auth?.countryId, showProvinceBorders]);

  useEffect(() => {
    try {
      localStorage.setItem("arc.ui.map.provincePanelCollapsed", selectedProvincePanelCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [selectedProvincePanelCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem("arc.ui.map.provincePanelPinned", selectedProvincePanelPinned ? "1" : "0");
    } catch {
      // ignore
    }
  }, [selectedProvincePanelPinned]);

  const ordersCountByProvince = useMemo(() => {
    const map = new Map<string, number>();
    const byPlayer = ordersByTurn.get(turnId);
    if (!byPlayer) {
      return map;
    }

    for (const list of byPlayer.values()) {
      for (const order of list) {
        const targetId =
          order.type === "ARMY_MOVE"
            ? order.provinceId
            : order.type === "BUILD" || order.type === "COLONIZE"
              ? order.regionId
              : null;
        if (targetId) {
          map.set(targetId, (map.get(targetId) ?? 0) + 1);
        }
      }
    }

    return map;
  }, [ordersByTurn, turnId]);

  const ordersCountRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    ordersCountRef.current = ordersCountByProvince;
  }, [ordersCountByProvince]);

  const getDerivedProvinceCosts = (provinceId: string) => {
    const areaKm2 = Math.max(1, provinceMetaByIdRef.current.get(provinceId)?.areaKm2 ?? 1000);
    const factor = Math.max(0.001, areaKm2 / 1000);
    return {
      points: Math.max(1, Math.round((colonizationCostPer1000Km2?.points ?? 5) * factor)),
      ducats: Math.max(0, Math.round((colonizationCostPer1000Km2?.ducats ?? 5) * factor)),
    };
  };
  const getEffectiveRegionColonizationConfig = (
    provinceId: string,
    configByProvince: Record<string, { cost: number; disabled: boolean }> | undefined,
  ) => {
    const override = configByProvince?.[provinceId];
    const derived = getDerivedProvinceCosts(provinceId);
    if (!override) {
      return { cost: derived.points, disabled: false };
    }
    const normalizedCost = Math.max(1, Math.floor(Number(override.cost ?? derived.points)));
    const isAutomaticDefault = !override.disabled && normalizedCost === 100;
    return {
      cost: isAutomaticDefault ? derived.points : normalizedCost,
      disabled: Boolean(override.disabled),
    };
  };
  const getProvinceDisplayName = (
    provinceId: string,
    fallbackName?: string | null,
    fallbackProps?: Record<string, unknown> | undefined,
  ) => {
    const override = provinceNameByIdRef.current[provinceId] ?? provinceNameById[provinceId];
    if (override && override.trim()) {
      return override;
    }
    if (fallbackName && fallbackName.trim()) {
      return fallbackName;
    }
    return provinceNamesByIdRef.current.get(provinceId) ?? readProvinceName(fallbackProps);
  };

  useEffect(() => {
    let cancelled = false;

    fetch(`${apiBase}/countries`)
      .then(async (res) => {
        if (!res.ok) {
          return [] as Country[];
        }
        return (await res.json()) as Country[];
      })
      .then((items) => {
        if (!cancelled) {
          setCountries(
            items.map((country) => ({
              ...country,
              flagUrl: resolveAssetUrl(apiBase, country.flagUrl),
              crestUrl: resolveAssetUrl(apiBase, country.crestUrl),
            })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCountries([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    let cancelled = false;
    fetchContentEntries("buildings")
      .then((items) => {
        if (cancelled) return;
        const next: Record<string, { name: string; logoUrl: string | null }> = {};
        for (const item of items) {
          next[item.id] = {
            name: item.name,
            logoUrl: resolveAssetUrl(apiBase, item.logoUrl) ?? null,
          };
        }
        setBuildingMetaById(next);
      })
      .catch(() => {
        if (cancelled) return;
        setBuildingMetaById({});
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    let cancelled = false;
    fetchContentEntries("goods")
      .then((items) => {
        if (cancelled) return;
        const next: typeof goodMetaById = {};
        for (const item of items) {
          next[item.id] = {
            name: item.name,
            logoUrl: resolveAssetUrl(apiBase, item.logoUrl) ?? null,
            color: /^#[0-9a-fA-F]{6}$/.test(item.color ?? "") ? item.color : stableResourceColor(item.id),
            isResourceDiscoverable: item.isResourceDiscoverable === true,
            explorationBaseWeight: Math.max(0, Number(item.explorationBaseWeight ?? 0)),
            resourceCategoryId: typeof item.resourceCategoryId === "string" && item.resourceCategoryId.trim() ? item.resourceCategoryId.trim() : null,
            transportModes: Array.isArray(item.transportModes)
              ? item.transportModes.filter((mode): mode is TransportMode => TRANSPORT_MODE_IDS.includes(mode as TransportMode))
              : [],
          };
        }
        setGoodMetaById(next);
      })
      .catch(() => {
        if (cancelled) return;
        setGoodMetaById({});
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchContentEntries("cultures"),
      fetchContentEntries("religions"),
      fetchContentEntries("races"),
      fetchContentEntries("professions"),
      fetchContentEntries("ideologies"),
    ])
      .then(([cultures, religions, races, professions, ideologies]) => {
        if (cancelled) return;
        const toMeta = (items: typeof cultures) => {
          const next: Record<string, { name: string; color: string; logoUrl: string | null }> = {};
          for (const item of items) {
            next[item.id] = {
              name: item.name,
              color: item.color,
              logoUrl: resolveAssetUrl(apiBase, item.logoUrl) ?? null,
            };
          }
          return next;
        };
        setPopulationMetaByKind({
          cultures: toMeta(cultures),
          religions: toMeta(religions),
          races: toMeta(races),
          professions: toMeta(professions),
          ideologies: toMeta(ideologies),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPopulationMetaByKind({ cultures: {}, religions: {}, races: {}, professions: {}, ideologies: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    setSelectedProvincePanelTab("overview");
    if (!selectedProvincePanelPinned) {
      setSelectedProvincePanelCollapsed(false);
    }
  }, [selectedProvinceId, selectedProvincePanelPinned]);

  useEffect(() => {
    let cancelled = false;
    fetchProvinceIndex()
      .then((items) => {
        if (cancelled) return;
        const next = new Map<string, ProvinceMapMeta>();
        for (const item of items) {
          next.set(item.id, {
            name: item.name,
            regionId: item.regionId ?? null,
            provinceColor: item.provinceColor,
            regionColor: item.regionColor,
            areaKm2: item.areaKm2,
            provinceType: item.provinceType ?? null,
            centerX: typeof item.centerX === "number" && Number.isFinite(item.centerX) ? item.centerX : null,
            centerY: typeof item.centerY === "number" && Number.isFinite(item.centerY) ? item.centerY : null,
            sourceCenterX: typeof item.sourceCenterX === "number" && Number.isFinite(item.sourceCenterX) ? item.sourceCenterX : null,
            sourceCenterY: typeof item.sourceCenterY === "number" && Number.isFinite(item.sourceCenterY) ? item.sourceCenterY : null,
            neighbors: Array.isArray(item.neighbors) ? item.neighbors : [],
            climate: item.climate ?? null,
            pollution: typeof item.pollution === "number" && Number.isFinite(item.pollution) ? item.pollution : null,
            radiation: typeof item.radiation === "number" && Number.isFinite(item.radiation) ? item.radiation : null,
            landscape: item.landscape ?? null,
            continent: item.continent ?? null,
            strategicRegion: item.strategicRegion ?? null,
            fertileLandKm2: typeof item.fertileLandKm2 === "number" && Number.isFinite(item.fertileLandKm2) ? item.fertileLandKm2 : null,
            fertility: typeof item.fertility === "number" && Number.isFinite(item.fertility) ? item.fertility : null,
          });
          provinceNamesByIdRef.current.set(item.id, item.name);
        }
        provinceMetaByIdRef.current = next;
        setProvinceIndexVersion((value) => value + 1);
      })
      .catch(() => {
        if (!cancelled) {
          provinceMetaByIdRef.current = new Map();
          setProvinceIndexVersion((value) => value + 1);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProvinceOrdersCount = selectedProvinceId ? (ordersCountByProvince.get(selectedProvinceId) ?? 0) : 0;
  const selectedOwnerId = selectedProvinceId ? (provinceOwnerById[selectedProvinceId] ?? null) : null;
  const displayOwnerByProvince = useMemo(() => {
    const next: Record<string, string> = {};
    for (const [provinceId, meta] of provinceMetaByIdRef.current.entries()) {
      const regionOwnerId = meta.regionId ? regionOwnerById[meta.regionId] : null;
      const ownerId = regionOwnerId ?? provinceOwnerById[provinceId];
      if (ownerId) next[provinceId] = ownerId;
    }
    for (const [provinceId, ownerId] of Object.entries(provinceOwnerById)) {
      if (!next[provinceId] && ownerId) next[provinceId] = ownerId;
    }
    return next;
  }, [provinceOwnerById, provinceIndexVersion, regionOwnerById]);
  const selectedProvinceDisplayName = selectedProvinceId
    ? getProvinceDisplayName(selectedProvinceId, selectedProvinceName)
    : null;
  const selectedRegionId = selectedProvinceId ? (provinceMetaByIdRef.current.get(selectedProvinceId)?.regionId ?? selectedProvinceId) : null;
  const selectedRegionOwnerId = selectedRegionId ? (regionOwnerById[selectedRegionId] ?? null) : null;
  const selectedDisplayOwnerId = selectedRegionOwnerId ?? selectedOwnerId;
  const selectedOwner = selectedDisplayOwnerId ? countryById.get(selectedDisplayOwnerId) : null;
  const selectedOwnerLabel = selectedDisplayOwnerId ? (selectedOwner?.name ?? selectedDisplayOwnerId) : "Нейтральная";
  const selectedOwnerFlagUrl = resolveAssetUrl(apiBase, selectedOwner?.flagUrl);

  const selectedProvinceColonizeOrdersCount = selectedRegionId
    ? [...(ordersByTurn.get(turnId)?.values() ?? [])].flat().filter((o) => o.type === "COLONIZE" && o.regionId === selectedRegionId).length
    : 0;
  const myQueuedColonizeProvinceIds = useMemo(() => {
    const ids = new Set<string>();
    if (!auth) {
      return ids;
    }
    const myOrders = ordersByTurn.get(turnId)?.get(auth.playerId) ?? [];
    for (const order of myOrders) {
      if (order.type === "COLONIZE") {
        ids.add(order.regionId);
      }
    }
    return ids;
  }, [auth, ordersByTurn, turnId]);
  const queuedColonizeCountriesByProvince = useMemo(() => {
    const map = new Map<string, string[]>();
    const byPlayer = ordersByTurn.get(turnId);
    if (!byPlayer) {
      return map;
    }
    for (const orders of byPlayer.values()) {
      for (const order of orders) {
        if (order.type !== "COLONIZE") continue;
        const list = map.get(order.regionId) ?? [];
        if (!list.includes(order.countryId)) {
          list.push(order.countryId);
          map.set(order.regionId, list);
        }
      }
    }
    return map;
  }, [ordersByTurn, turnId]);
  useEffect(() => {
    queuedColonizeCountriesByProvinceRef.current = queuedColonizeCountriesByProvince;
  }, [queuedColonizeCountriesByProvince]);
  const selectedColonyProgress = selectedRegionId ? (colonyProgressByRegion[selectedRegionId] ?? EMPTY_COUNTRY_PROGRESS) : EMPTY_COUNTRY_PROGRESS;
  const selectedColonyProgressList = Object.entries(selectedColonyProgress).sort((a, b) => b[1] - a[1]);
  const selectedProvinceMeta = selectedProvinceId ? (provinceMetaByIdRef.current.get(selectedProvinceId) ?? null) : null;
  const selectedProvinceAreaKm2 = selectedProvinceMeta?.areaKm2 ?? null;
  const selectedProvinceNeighborIds = selectedProvinceMeta?.neighbors ?? [];
  const selectedIsNeutral = selectedRegionId ? !selectedRegionOwnerId : false;
  const selectedColonizationCfg = selectedRegionId
    ? getEffectiveRegionColonizationConfig(selectedRegionId, regionColonizationByRegion)
    : { cost: 100, disabled: false };
  const selectedIsColonizationDisabled = Boolean(selectedColonizationCfg.disabled);
  const selectedColonizationCost = Math.max(1, Math.floor(selectedColonizationCfg.cost ?? 100));
  const selectedColonizationDucatsCost = selectedProvinceId ? getDerivedProvinceCosts(selectedProvinceId).ducats : 0;
  const selectedMyColonyProgress = auth?.countryId && selectedRegionId ? (selectedColonyProgress[auth.countryId] ?? null) : null;
  const selectedCanCancelColonization = selectedRegionId != null && selectedMyColonyProgress != null;
  const selectedBuiltBuildings = useMemo(() => {
    if (!selectedRegionId) return [] as Array<{ buildingId: string; buildingName: string; logoUrl: string | null; count: number; levels: number; netDucats: number; productivity: number; inactive: number }>;
    const instances = regionBuildingsByRegion[selectedRegionId] ?? [];
    const byId = new Map<string, { count: number; levels: number; netDucats: number; productivitySum: number; productivityCount: number; inactive: number }>();
    for (const instance of instances) {
      const row = instance as {
        buildingId?: string;
        level?: number;
        lastNetDucats?: number;
        lastProductivity?: number;
        isInactive?: boolean;
      };
      const bid = typeof row?.buildingId === "string" ? row.buildingId : "";
      if (!bid) continue;
      const current = byId.get(bid) ?? { count: 0, levels: 0, netDucats: 0, productivitySum: 0, productivityCount: 0, inactive: 0 };
      current.count += 1;
      current.levels += Math.max(1, Math.floor(Number(row.level ?? 1)));
      current.netDucats += Number.isFinite(Number(row.lastNetDucats)) ? Number(row.lastNetDucats) : 0;
      if (Number.isFinite(Number(row.lastProductivity))) {
        current.productivitySum += Number(row.lastProductivity);
        current.productivityCount += 1;
      }
      if (row.isInactive) current.inactive += 1;
      byId.set(bid, current);
    }
    return [...byId.entries()]
      .map(([buildingId, row]) => ({
        buildingId,
        buildingName: buildingMetaById[buildingId]?.name ?? buildingId,
        logoUrl: buildingMetaById[buildingId]?.logoUrl ?? null,
        count: row.count,
        levels: row.levels,
        netDucats: row.netDucats,
        productivity: row.productivityCount > 0 ? row.productivitySum / row.productivityCount : 0,
        inactive: row.inactive,
      }))
      .sort((a, b) => b.count - a.count || a.buildingName.localeCompare(b.buildingName));
  }, [selectedRegionId, regionBuildingsByRegion, buildingMetaById]);
  const selectedConstructionQueue = selectedRegionId
    ? regionConstructionQueueByRegion[selectedRegionId] ?? []
    : [];
  const selectedConstructionRows = useMemo(() => {
    return selectedConstructionQueue
      .map((project) => ({
        ...project,
        buildingName: buildingMetaById[project.buildingId]?.name ?? project.buildingId,
        progressPct:
          Math.max(0, Number(project.costConstruction ?? 0)) > 0
            ? clampPct((Math.max(0, Number(project.progressConstruction ?? 0)) / Math.max(1, Number(project.costConstruction))) * 100)
            : 0,
      }))
      .sort((a, b) => b.progressPct - a.progressPct || a.buildingName.localeCompare(b.buildingName, "ru"));
  }, [selectedConstructionQueue, buildingMetaById]);
  const selectedResourceDeposits = useMemo(() => {
    if (!selectedRegionId) {
      return [] as Array<{ goodId: string; amount: number; veinSize: "small" | "medium" | "large"; goodName: string; logoUrl: string | null }>;
    }
    const deposits = regionResourceDepositsByRegion[selectedRegionId] ?? [];
    return deposits
      .map((row) => ({
        goodId: row.goodId,
        amount: Math.max(0, Number(row.amount ?? 0)),
        veinSize: row.veinSize,
        goodName: goodMetaById[row.goodId]?.name ?? row.goodId,
        logoUrl: goodMetaById[row.goodId]?.logoUrl ?? null,
      }))
      .sort((a, b) => b.amount - a.amount || a.goodName.localeCompare(b.goodName));
  }, [selectedProvinceId, selectedRegionId, regionResourceDepositsByRegion, goodMetaById]);
  const selectedExplorationQueue = selectedRegionId
    ? regionResourceExplorationQueueByRegion[selectedRegionId] ?? []
    : [];
  const selectedExplorationCount = selectedRegionId
    ? Math.max(0, Number(regionResourceExplorationCountByRegion[selectedRegionId] ?? 0))
    : 0;
  const selectedCanStartExploration = Boolean(
      auth?.token &&
      auth.countryId &&
      selectedRegionId &&
      selectedRegionOwnerId === auth.countryId &&
      !selectedExplorationQueue.some((row) => row.requestedByCountryId === auth.countryId),
  );
  const selectedCanStartColonization =
    Boolean(auth?.token) &&
    Boolean(selectedRegionId) &&
    selectedIsNeutral &&
    !selectedIsColonizationDisabled &&
    selectedMyColonyProgress == null;
  const selectedCanRenameProvince = Boolean(
    auth?.token &&
      auth?.countryId &&
      selectedProvinceId &&
      selectedOwnerId &&
      selectedOwnerId === auth.countryId,
  );
  const selectedProvinceRenameCost = Math.max(0, Math.floor(provinceRenameDucatsCost || 0));
  const selectedPopulationSummary = useMemo(() => {
    if (!selectedProvinceId) {
      return {
        total: 0,
        popGroups: 0,
        averageSoL: 0,
        satisfaction: 0,
        radicals: 0,
        loyalists: 0,
        professions: [] as Array<{ id: string; label: string; value: number; color: string }>,
        cultures: [] as Array<{ id: string; label: string; value: number; color: string }>,
        religions: [] as Array<{ id: string; label: string; value: number; color: string }>,
      };
    }
    const population = regionPopulationByRegion[selectedProvinceId];
    const professionTotals = new Map<string, number>();
    const cultureTotals = new Map<string, number>();
    const religionTotals = new Map<string, number>();
    let total = 0;
    let weightedSoL = 0;
    let weightedSatisfaction = 0;
    let radicals = 0;
    let loyalists = 0;
    for (const pop of population?.pops ?? []) {
      const popSize = Math.max(0, Number(pop.size ?? 0));
      total += popSize;
      if (pop.cultureId) cultureTotals.set(pop.cultureId, (cultureTotals.get(pop.cultureId) ?? 0) + popSize);
      if (pop.religionId) religionTotals.set(pop.religionId, (religionTotals.get(pop.religionId) ?? 0) + popSize);
      for (const [professionId, profession] of Object.entries(pop.professions ?? {})) {
        const size = Math.max(0, Number(profession.size ?? 0));
        professionTotals.set(professionId, (professionTotals.get(professionId) ?? 0) + size);
        weightedSoL += size * Math.max(0, Number(profession.standardOfLiving ?? 0));
        weightedSatisfaction += size * clampPct(Number(profession.lastNeedsSatisfaction ?? 0) * 100);
        radicals += Math.max(0, Number(profession.radicals ?? 0));
        loyalists += Math.max(0, Number(profession.loyalists ?? 0));
      }
    }
    const mapRows = (
      source: Map<string, number>,
      meta: Record<string, { name: string; color: string; logoUrl: string | null }>,
      fallbackColor: string,
    ) =>
      [...source.entries()]
        .map(([id, value]) => ({
          id,
          label: meta[id]?.name ?? id,
          value,
          color: meta[id]?.color ?? fallbackColor,
        }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "ru"))
        .slice(0, 5);
    return {
      total,
      popGroups: population?.pops?.length ?? 0,
      averageSoL: total > 0 ? weightedSoL / total : 0,
      satisfaction: total > 0 ? weightedSatisfaction / total : 0,
      radicals,
      loyalists,
      professions: mapRows(professionTotals, populationMetaByKind.professions, "#38bdf8"),
      cultures: mapRows(cultureTotals, populationMetaByKind.cultures, "#a78bfa"),
      religions: mapRows(religionTotals, populationMetaByKind.religions, "#facc15"),
    };
  }, [selectedProvinceId, regionPopulationByRegion, populationMetaByKind]);
  const selectedBuildingTotals = useMemo(
    () => ({
      instances: selectedBuiltBuildings.reduce((sum, row) => sum + row.count, 0),
      levels: selectedBuiltBuildings.reduce((sum, row) => sum + row.levels, 0),
      netDucats: selectedBuiltBuildings.reduce((sum, row) => sum + row.netDucats, 0),
      inactive: selectedBuiltBuildings.reduce((sum, row) => sum + row.inactive, 0),
    }),
    [selectedBuiltBuildings],
  );
  const selectedProblems = useMemo(() => {
    const rows: Array<{ id: string; label: string; tone: "amber" | "rose" | "emerald" | "sky" }> = [];
    if (selectedBuildingTotals.inactive > 0) {
      rows.push({ id: "inactive-buildings", label: `Простаивает зданий: ${selectedBuildingTotals.inactive}`, tone: "amber" });
    }
    if (selectedPopulationSummary.total === 0) {
      rows.push({ id: "no-pop", label: "Нет населения", tone: "amber" });
    }
    if (selectedPopulationSummary.radicals > selectedPopulationSummary.loyalists && selectedPopulationSummary.radicals > 0) {
      rows.push({ id: "radicals", label: "Радикалов больше лоялистов", tone: "rose" });
    }
    if (selectedExplorationQueue.length > 0) {
      rows.push({ id: "exploration", label: "Идет разведка ресурсов", tone: "sky" });
    }
    if (selectedIsNeutral && selectedIsColonizationDisabled) {
      rows.push({ id: "blocked-colony", label: "Колонизация запрещена", tone: "rose" });
    }
    if (rows.length === 0) {
      rows.push({ id: "stable", label: "Критичных проблем нет", tone: "emerald" });
    }
    return rows;
  }, [
    selectedBuildingTotals.inactive,
    selectedExplorationQueue.length,
    selectedIsColonizationDisabled,
    selectedIsNeutral,
    selectedPopulationSummary.loyalists,
    selectedPopulationSummary.radicals,
    selectedPopulationSummary.total,
  ]);
  const effectivePoliticalFilterCountryId =
    politicalLens === "mine" || politicalOnlyMine
      ? (auth?.countryId ?? null)
      : politicalCountryFilter === "all"
        ? null
        : politicalCountryFilter === "own"
          ? (auth?.countryId ?? null)
          : politicalCountryFilter;
  const effectiveSelectedMarketId = selectedMarketLensMarketId === "current"
    ? currentMarketId
    : selectedMarketLensMarketId;

  const provinceIdsByRegion = useMemo(() => {
    const byRegion = new Map<string, string[]>();
    for (const [provinceId, meta] of provinceMetaByIdRef.current.entries()) {
      const regionId = meta.regionId;
      if (!regionId) continue;
      const ids = byRegion.get(regionId) ?? [];
      ids.push(provinceId);
      byRegion.set(regionId, ids);
    }
    return byRegion;
  }, [provinceIndexVersion]);

  const regionModeGroups = useMemo(() => {
    const byRegion = provinceIdsByRegion;
    return [...byRegion.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "ru"))
      .map(([regionId, ids]) => {
        const color = stableRegionColor(regionId);
        return {
          ids,
          value: mixHexColor(lightenHexColor(color, 0.14), "#f4e3bc", 0.22),
          borderColor: darkenHexColor(color, 0.42),
        };
      });
  }, [provinceIdsByRegion]);

  const marketModeGroups = useMemo(() => {
    if (marketLens === "capitals") {
      return marketsCatalog.flatMap((market) => {
        const provinceId = market.capitalProvinceId ?? (market.id === currentMarketId ? marketCapitalProvinceId : null);
        return provinceId ? [{ ids: [provinceId], value: marketColorById.get(market.id) ?? stableMarketColor(market.id), lineWidth: 1.8, lineOpacity: 0.9 }] : [];
      });
    }
    const byMarket = new Map<string, string[]>();
    for (const [provinceId, marketId] of marketIdByProvince.entries()) {
      if (marketLens === "selectedMarketMembers" && effectiveSelectedMarketId && marketId !== effectiveSelectedMarketId) continue;
      const ids = byMarket.get(marketId) ?? [];
      ids.push(provinceId);
      byMarket.set(marketId, ids);
    }
    return [...byMarket.entries()].map(([marketId, ids]) => ({
      ids,
      value: marketColorById.get(marketId) ?? stableMarketColor(marketId),
      opacity: marketLens === "selectedMarketMembers" ? 0.82 : 0.72,
      lineOpacity: 0.72,
    }));
  }, [currentMarketId, effectiveSelectedMarketId, marketCapitalProvinceId, marketColorById, marketIdByProvince, marketLens, marketsCatalog]);

  const populationMapRows = useMemo<PopulationMapRow[]>(() => {
    const categoricalKind =
      populationLens === "cultures" || populationLens === "religions" || populationLens === "races" || populationLens === "professions" || populationLens === "ideologies"
        ? populationLens
        : null;

    if (categoricalKind) {
      const meta = populationMetaByKind[categoricalKind];
      return Object.entries(regionPopulationByRegion).flatMap(([provinceId, population]) => {
        const totals = new Map<string, number>();
        let total = 0;
        for (const pop of population.pops ?? []) {
          const popSize = Math.max(0, Number(pop.size) || 0);
          total += popSize;
          if (categoricalKind === "cultures" && pop.cultureId) totals.set(pop.cultureId, (totals.get(pop.cultureId) ?? 0) + popSize);
          if (categoricalKind === "religions" && pop.religionId) totals.set(pop.religionId, (totals.get(pop.religionId) ?? 0) + popSize);
          if (categoricalKind === "races" && pop.raceId) totals.set(pop.raceId, (totals.get(pop.raceId) ?? 0) + popSize);
          if (categoricalKind === "ideologies") {
            const ideologyTotal = Object.values(pop.ideologies ?? {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
            if (ideologyTotal > 0) {
              for (const [ideologyId, amount] of Object.entries(pop.ideologies ?? {})) {
                totals.set(ideologyId, (totals.get(ideologyId) ?? 0) + popSize * (Math.max(0, Number(amount) || 0) / ideologyTotal));
              }
            }
          }
          if (categoricalKind === "professions") {
            for (const [professionId, profession] of Object.entries(pop.professions ?? {})) {
              totals.set(professionId, (totals.get(professionId) ?? 0) + Math.max(0, Number(profession.size) || 0));
            }
          }
        }
        const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
        if (!top || total <= 0) return [];
        const color = meta[top[0]]?.color ?? stableResourceColor(top[0]);
        const name = meta[top[0]]?.name ?? top[0];
        return [{
          provinceId,
          color,
          opacity: MAP_LENS_FILL_OPACITY,
          borderColor: darkenHexColor(color, 0.58),
          borderOpacity: 0.64,
          label: `${name} · ${formatPercent((top[1] / Math.max(1, total)) * 100)}`,
          value: top[1],
        }];
      });
    }

    const metricRows = Object.entries(regionPopulationByRegion).flatMap(([provinceId, population]) => {
      const stats = getPopulationStats(population);
      const area = Math.max(1, provinceMetaByIdRef.current.get(provinceId)?.areaKm2 ?? 1);
      const value =
        populationLens === "density" ? stats.total / area :
        populationLens === "standardOfLiving" ? stats.averageSoL :
        populationLens === "radicals" ? (stats.total > 0 ? (stats.radicals / stats.total) * 100 : 0) :
        populationLens === "loyalists" ? (stats.total > 0 ? (stats.loyalists / stats.total) * 100 : 0) :
        stats.needsSatisfaction ?? 0;
      return value > 0 ? [{ provinceId, value, stats, area }] : [];
    });
    const positiveValues = metricRows.map((row) => row.value);
    const densityCap = Math.max(1, Math.log1p(percentile(positiveValues, 0.95)));
    const genericCap = Math.max(1, percentile(positiveValues, 0.95));

    return metricRows.map((row) => {
      const pct =
        populationLens === "density"
          ? clamp01(Math.log1p(row.value) / densityCap)
          : populationLens === "standardOfLiving"
            ? clamp01(row.value / 30)
            : populationLens === "needs"
              ? clamp01(row.value / 100)
              : clamp01(row.value / genericCap);
      const color =
        populationLens === "radicals" ? heatColor(pct, "#fbbf24", "#f97316", "#dc2626") :
        populationLens === "loyalists" ? heatColor(pct, "#475569", "#84cc16", "#22c55e") :
        populationLens === "needs" ? heatColor(pct, "#dc2626", "#f59e0b", "#22c55e") :
        populationLens === "standardOfLiving" ? heatColor(pct, "#64748b", "#38bdf8", "#22c55e") :
        heatColor(pct, "#334155", "#60a5fa", "#fb7185");
      const label =
        populationLens === "density" ? `${formatCompact(row.value)}/км²` :
        populationLens === "standardOfLiving" ? row.value.toFixed(1) :
        populationLens === "radicals" || populationLens === "loyalists" || populationLens === "needs" ? formatPercent(row.value) :
        formatCompact(row.value);
      return {
        provinceId: row.provinceId,
        color,
        opacity: 0.42 + pct * 0.48,
        borderColor: darkenHexColor(color, 0.58),
        borderOpacity: 0.22 + pct * 0.5,
        label,
        value: row.value,
      };
    });
  }, [populationLens, populationMetaByKind, regionPopulationByRegion, provinceIndexVersion]);

  const populationMapRowByProvince = useMemo(() => {
    const next = new Map<string, PopulationMapRow>();
    for (const row of populationMapRows) {
      next.set(row.provinceId, row);
    }
    return next;
  }, [populationMapRows]);

  useEffect(() => {
    hoverModeDataRef.current.populationMapRowByProvince = populationMapRowByProvince;
  }, [populationMapRowByProvince]);

  const resourceModeGroups = useMemo(() => {
    if (resourceLens === "exploration") {
      const queued = Object.entries(regionResourceExplorationQueueByRegion)
        .filter(([, queue]) => queue.length > 0)
        .flatMap(([regionId]) => provinceIdsByRegion.get(regionId) ?? []);
      const explored = Object.entries(regionResourceExplorationCountByRegion)
        .filter(([regionId, count]) => count > 0 && !queued.some((provinceId) => provinceIdsByRegion.get(regionId)?.includes(provinceId)))
        .flatMap(([regionId]) => provinceIdsByRegion.get(regionId) ?? []);
      return [
        { ids: queued, value: "#38bdf8", opacity: 0.82, lineOpacity: 0.85 },
        { ids: explored, value: "#facc15", opacity: 0.68, lineOpacity: 0.65 },
      ].filter((group) => group.ids.length > 0);
    }
    const byGood = new Map<string, string[]>();
    for (const [regionId, deposits] of Object.entries(regionResourceDepositsByRegion)) {
      const filtered = deposits.filter((deposit) => resourceGoodId === "all" || deposit.goodId === resourceGoodId);
      const top = [...filtered].sort((a, b) => Math.max(0, Number(b.amount)) - Math.max(0, Number(a.amount)))[0];
      if (!top) continue;
      const ids = byGood.get(top.goodId) ?? [];
      ids.push(...(provinceIdsByRegion.get(regionId) ?? []));
      byGood.set(top.goodId, ids);
    }
    return [...byGood.entries()].map(([goodId, ids]) => ({
      ids,
      value: goodMetaById[goodId]?.color ?? stableResourceColor(goodId),
      opacity: 0.78,
      lineOpacity: 0.72,
    }));
  }, [goodMetaById, provinceIdsByRegion, regionResourceDepositsByRegion, regionResourceExplorationCountByRegion, regionResourceExplorationQueueByRegion, resourceGoodId, resourceLens]);

  const logisticsCoverageProvinceIds = useMemo(
    () => [
      ...transportInfrastructureCoverage.excellent,
      ...transportInfrastructureCoverage.high,
      ...transportInfrastructureCoverage.medium,
      ...transportInfrastructureCoverage.low,
      ...transportInfrastructureCoverage.critical,
    ],
    [transportInfrastructureCoverage],
  );
  const logisticsProblemGroups = useMemo(
    () => ({
      noCorridor: transportInfrastructureCoverage.critical,
      noCapacity: transportInfrastructureCoverage.low,
    }),
    [transportInfrastructureCoverage],
  );
  const transitProvinceIdsForInfrastructureLens = useMemo<string[]>(() => [], []);
  const infrastructureTransitAgreements = useMemo<
    Array<{ active: boolean; fromCountryId: string; toCountryId: string; provinceIds?: string[]; transportMode?: TransportMode }>
  >(() => [], []);

  const infrastructureModeGroups = useMemo(() => {
    if (infrastructureLensView === "problems") {
      return [
        { ids: logisticsProblemGroups.noCorridor, value: "#dc2626", opacity: 0.84, lineOpacity: 0.9, lineWidth: 1.35 },
        { ids: logisticsProblemGroups.noCapacity, value: "#f97316", opacity: 0.84, lineOpacity: 0.9, lineWidth: 1.35 },
        { ids: transitProvinceIdsForInfrastructureLens, value: "#a78bfa", opacity: 0.42, lineOpacity: 0.7 },
      ].filter((group) => group.ids.length > 0);
    }
    if (infrastructureLensView === "coverage" || infrastructureLensView === "corridors") {
      return [
        { ids: transitProvinceIdsForInfrastructureLens, value: "#a78bfa", opacity: infrastructureLensView === "corridors" ? 0.72 : 0.36, lineOpacity: 0.78 },
        { ids: logisticsCoverageProvinceIds, value: infrastructureLensView === "corridors" ? "#38bdf8" : "#22c55e", opacity: 0.72, lineOpacity: 0.72 },
      ].filter((group) => group.ids.length > 0);
    }
    return [
      { ids: transportInfrastructureCoverage.excellent, value: "#22c55e", opacity: 0.62, lineOpacity: 0.55 },
      { ids: transportInfrastructureCoverage.high, value: "#84cc16", opacity: 0.66, lineOpacity: 0.58 },
      { ids: transportInfrastructureCoverage.medium, value: "#facc15", opacity: 0.72, lineOpacity: 0.65 },
      { ids: transportInfrastructureCoverage.low, value: "#f97316", opacity: 0.78, lineOpacity: 0.72 },
      { ids: transportInfrastructureCoverage.critical, value: "#dc2626", opacity: 0.86, lineOpacity: 0.86, lineWidth: 1.25 },
      { ids: transitProvinceIdsForInfrastructureLens, value: "#a78bfa", opacity: 0.34, lineOpacity: 0.75 },
    ].filter((group) => group.ids.length > 0);
  }, [infrastructureLensView, logisticsCoverageProvinceIds, logisticsProblemGroups, transitProvinceIdsForInfrastructureLens, transportInfrastructureCoverage]);

  const colonizationModeGroups = useMemo(() => {
    const available: string[] = [];
    const blocked: string[] = [];
    const ownRaces: string[] = [];
    const foreignRaces: string[] = [];
    const costLow: string[] = [];
    const costMid: string[] = [];
    const costHigh: string[] = [];
    for (const regionId of new Set([
      ...Object.keys(regionColonizationByRegion),
      ...Object.keys(colonyProgressByRegion),
      ...Object.keys(regionOwnerById),
      ...Array.from(provinceIdsByRegion.keys()),
    ])) {
      const provinceIds = provinceIdsByRegion.get(regionId) ?? [];
      if (provinceIds.length === 0 || regionOwnerById[regionId]) continue;
      const cfg = getEffectiveRegionColonizationConfig(regionId, regionColonizationByRegion);
      const progress = colonyProgressByRegion[regionId] ?? {};
      const hasOwn = Boolean(auth?.countryId && progress[auth.countryId] != null);
      const hasForeign = Object.keys(progress).some((countryId) => countryId !== auth?.countryId);
      if (cfg.disabled) blocked.push(...provinceIds);
      else available.push(...provinceIds);
      if (hasOwn) ownRaces.push(...provinceIds);
      if (hasForeign) foreignRaces.push(...provinceIds);
      if (!cfg.disabled) {
        if (cfg.cost <= 8) costLow.push(...provinceIds);
        else if (cfg.cost <= 24) costMid.push(...provinceIds);
        else costHigh.push(...provinceIds);
      }
    }
    if (colonizationLens === "cost") {
      return [
        { ids: costLow, value: "#22c55e", opacity: 0.72 },
        { ids: costMid, value: "#facc15", opacity: 0.76 },
        { ids: costHigh, value: "#f97316", opacity: 0.82 },
      ].filter((group) => group.ids.length > 0);
    }
    if (colonizationLens === "ownRaces") return [{ ids: ownRaces, value: "#5C84FF", opacity: 0.82, lineOpacity: 0.88 }];
    if (colonizationLens === "foreignRaces") return [{ ids: foreignRaces, value: "#EF9D6E", opacity: 0.82, lineOpacity: 0.88 }];
    if (colonizationLens === "blocked") return [{ ids: blocked, value: "#dc2626", opacity: 0.78, lineOpacity: 0.82 }];
    return [
      { ids: available, value: "#4ade80", opacity: 0.72, lineOpacity: 0.68 },
      { ids: blocked, value: "#64748b", opacity: 0.34, lineOpacity: 0.24 },
    ].filter((group) => group.ids.length > 0);
  }, [auth?.countryId, colonizationLens, colonyProgressByRegion, provinceIdsByRegion, regionColonizationByRegion, regionOwnerById]);

  const militaryModeGroups = useMemo(() => {
    const own: string[] = [];
    const foreign: string[] = [];
    const selected: string[] = [];
    for (const division of Object.values(divisionsById)) {
      if (selectedDivisionId === division.id) selected.push(division.provinceId);
      if (auth?.countryId && division.countryId === auth.countryId) own.push(division.provinceId);
      else foreign.push(division.provinceId);
    }
    return [
      { ids: [...new Set(foreign)], value: "#ef4444", opacity: 0.74, lineOpacity: 0.74 },
      { ids: [...new Set(own)], value: "#22c55e", opacity: 0.78, lineOpacity: 0.82 },
      { ids: [...new Set(selected)], value: "#facc15", opacity: 0.9, lineOpacity: 0.95, lineWidth: 1.7 },
    ].filter((group) => group.ids.length > 0);
  }, [auth?.countryId, divisionsById, selectedDivisionId]);
  const currentCountryActiveColonizationTargets = useMemo(() => {
    if (!auth?.countryId) {
      return new Set<string>();
    }
    const ids = new Set<string>();
    const ownerByRegion = regionOwnerById;
    const cfgByRegion = regionColonizationByRegion;
    const progressByRegion = colonyProgressByRegion;
    for (const [regionId, byCountry] of Object.entries(progressByRegion)) {
      if (ownerByRegion[regionId]) continue;
      if (cfgByRegion[regionId]?.disabled) continue;
      if (byCountry[auth.countryId] != null) {
        ids.add(regionId);
      }
    }
    const myOrders = ordersByTurn.get(turnId)?.get(auth.playerId) ?? [];
    for (const order of myOrders) {
      if (order.type !== "COLONIZE") continue;
      if (ownerByRegion[order.regionId]) continue;
      if (cfgByRegion[order.regionId]?.disabled) continue;
      ids.add(order.regionId);
    }
    return ids;
  }, [auth, ordersByTurn, turnId, regionOwnerById, regionColonizationByRegion, colonyProgressByRegion]);
  const colonizedProvinceOptions = useMemo(() => {
    return [...currentCountryActiveColonizationTargets]
      .sort((a, b) => a.localeCompare(b))
      .map((id) => ({
        id,
        name: getProvinceDisplayName(id),
      }));
  }, [currentCountryActiveColonizationTargets, provinceNameById]);

  useEffect(() => {
    if (!selectedProvinceId) return;
    const nextName = getProvinceDisplayName(selectedProvinceId, selectedProvinceName);
    if (nextName !== selectedProvinceName) {
      setSelectedProvinceName(nextName);
    }
  }, [selectedProvinceId, selectedProvinceName, provinceNameById]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          mapTexture: {
            type: "raster",
            tiles: [`${apiBase}/tiles/raster/{z}/{x}/{y}.webp`],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 7,
          },
          adm1: {
            type: "vector",
            tiles: [`${apiBase}/tiles/adm1/{z}/{x}/{y}.mvt`],
            minzoom: 0,
            maxzoom: 7,
            promoteId: { adm1: "id" },
          },
          countryLabels: {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#4FC1FF" } },
          {
            id: "map-texture",
            type: "raster",
            source: "mapTexture",
            paint: {
              "raster-opacity": 1,
              "raster-fade-duration": 0,
            },
          },
          {
            id: "province-fill",
            type: "fill",
            source: "adm1",
            "source-layer": "adm1",
            paint: {
              "fill-color": PROVINCE_TEXTURE_FILL_COLOR,
              "fill-opacity": PROVINCE_TEXTURE_FILL_OPACITY,
            },
          },
          {
            id: "province-colonize-stripes",
            type: "fill",
            source: "adm1",
            "source-layer": "adm1",
            paint: {
              "fill-pattern": COLONIZE_EMPTY_PATTERN,
              "fill-opacity": 0,
            },
          },
          {
            id: "province-hover",
            type: "fill",
            source: "adm1",
            "source-layer": "adm1",
            paint: {
              "fill-color": "#000000",
              "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.4, 0],
            },
          },
          {
            id: "province-selected",
            type: "line",
            source: "adm1",
            "source-layer": "adm1",
            paint: {
              "line-color": "#000000",
              "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 0],
            },
          },
          {
            id: "province-colonize-ring",
            type: "line",
            source: "adm1",
            "source-layer": "adm1",
            paint: {
              "line-color": ["coalesce", ["feature-state", "colonizeLeadColor"], "#93c5fd"],
              "line-width": 0,
              "line-opacity": 0,
              "line-blur": 0.5,
            },
          },
          {
            id: "province-line",
            type: "line",
            source: "adm1",
            "source-layer": "adm1",
            paint: {
              "line-color": "#C0C0C0",
              "line-width": 0.9,
              "line-opacity": 0.75,
            },
          },
          {
            id: "country-labels",
            type: "symbol",
            source: "countryLabels",
            layout: {
              "text-field": ["get", "name"],
              "text-font": ["Noto Sans Regular"],
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                0,
                ["case", [">", ["get", "area"], 350000], 18, [">", ["get", "area"], 80000], 13, 10],
                4,
                ["case", [">", ["get", "area"], 350000], 28, [">", ["get", "area"], 80000], 20, 14],
              ],
              "text-letter-spacing": 0.08,
              "text-transform": "uppercase",
              "text-allow-overlap": false,
              "text-ignore-placement": false,
              "text-optional": true,
              visibility: "none",
            },
            paint: {
              "text-color": "#2f2a23",
              "text-halo-color": "rgba(244, 232, 205, 0.78)",
              "text-halo-width": 1.1,
              "text-halo-blur": 0.5,
              "text-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                0,
                0.58,
                2.5,
                0.78,
                5,
                0.9,
              ],
            },
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      maxZoom: 8,
      minZoom: -1,
      renderWorldCopies: false,
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
      attributionControl: false,
    });

    map.on("load", () => {
      if (!map.hasImage(COLONIZE_EMPTY_PATTERN)) {
        map.addImage(COLONIZE_EMPTY_PATTERN, createPatternData(false));
      }
      if (!map.hasImage(COLONIZE_STRIPES_PATTERN)) {
        map.addImage(COLONIZE_STRIPES_PATTERN, createPatternData(true));
      }
      for (const [layerId, prop] of [
        ["province-fill", "fill-color"],
        ["province-fill", "fill-opacity"],
        ["province-colonize-stripes", "fill-opacity"],
        ["province-colonize-ring", "line-opacity"],
        ["province-colonize-ring", "line-width"],
        ["province-line", "line-color"],
        ["province-line", "line-opacity"],
        ["province-hover", "fill-opacity"],
        ["province-selected", "line-opacity"],
        ["province-selected", "line-width"],
      ] as const) {
        map.setPaintProperty(layerId, `${prop}-transition`, { duration: 160, delay: 0 });
      }
      applyAntarcticaVisibilityFilter(map, showAntarctica);
      map.resize();
      const c = map.getCenter();
      setView({ zoom: map.getZoom(), lng: c.lng, lat: c.lat });
      setMapStyleReadyVersion((value) => value + 1);
    });

    map.on("movestart", () => {
      mapMovingRef.current = true;
      if (hoverTooltipRafRef.current != null) {
        cancelAnimationFrame(hoverTooltipRafRef.current);
        hoverTooltipRafRef.current = null;
      }
      setHoverTooltip((prev) => (prev == null ? prev : null));
    });

    map.on("moveend", () => {
      mapMovingRef.current = false;
    });

    map.on("move", () => {
      if (showMapControlsRef.current) {
        if (viewRafRef.current != null) {
          cancelAnimationFrame(viewRafRef.current);
        }
        viewRafRef.current = requestAnimationFrame(() => {
          const c = map.getCenter();
          setView({ zoom: map.getZoom(), lng: c.lng, lat: c.lat });
          viewRafRef.current = null;
        });
      }
      setContextMenu((prev) => (prev == null ? prev : null));
      setHoverTooltip((prev) => (prev == null ? prev : null));
    });

    map.on("mousemove", "province-fill", (e) => {
      if (mapMovingRef.current) {
        return;
      }
      const feature = e.features?.[0];
      if (!feature) {
        return;
      }

      const props = feature.properties as Record<string, unknown> | undefined;
      const id = readProvinceId(props);
      const rawName = readProvinceName(props);
      if (id && rawName) {
        provinceNamesByIdRef.current.set(id, rawName);
      }
      if (!id) {
        return;
      }
      const name = getProvinceDisplayName(id, rawName, props);

      const hoverRegionId = provinceMetaByIdRef.current.get(id)?.regionId ?? id;
      const ownerId = regionOwnerByIdRef.current[hoverRegionId] ?? provinceOwnerByIdRef.current[id] ?? null;
      const ownerName = ownerId ? (countryByIdRef.current.get(ownerId)?.name ?? ownerId) : "Нейтральная";
      const progressByCountry = colonyProgressByRegionRef.current[hoverRegionId] ?? EMPTY_COUNTRY_PROGRESS;
      const effectiveProvinceCfg = getEffectiveRegionColonizationConfig(hoverRegionId, regionColonizationByRegionRef.current);
      const regionColonizationCost = Math.max(
        1,
        Math.floor(effectiveProvinceCfg.cost),
      );
      const queuedCountryIds = new Set<string>(queuedColonizeCountriesByProvinceRef.current.get(hoverRegionId) ?? []);
      const colonizerIds = [...new Set<string>([...Object.keys(progressByCountry), ...queuedCountryIds])];
      const colonizers = colonizerIds
        .sort((a, b) => (progressByCountry[b] ?? 0) - (progressByCountry[a] ?? 0) || a.localeCompare(b))
        .slice(0, 6)
        .map((countryId) => {
          const country = countryByIdRef.current.get(countryId);
          const progress = progressByCountry[countryId] ?? 0;
          const percent = Math.max(0, Math.min(100, (progress / regionColonizationCost) * 100));
          return {
            countryId,
            countryName: country?.name ?? countryId,
            countryColor: country?.color ?? "#94a3b8",
            percent,
            hasQueuedOrder: queuedCountryIds.has(countryId),
          };
      });
      const hoverData = hoverModeDataRef.current;
      const populationStats = getPopulationStats(hoverData.regionPopulationByRegion[id]);
      const isCorridorEndpoint = hoverData.transportLensProvinceIds.endpoints.has(id);
      const isCorridorReachable = hoverData.transportLensProvinceIds.reachable.has(id);
      const buildingInstances = hoverData.regionBuildingsByRegion[id] ?? [];
      const buildingStats = buildingInstances.reduce(
        (acc, instance) => {
          const row = instance as { buildingId?: string; level?: number; lastNetDucats?: number; lastProductivity?: number; isInactive?: boolean };
          acc.count += 1;
          acc.levels += Math.max(1, Math.floor(Number(row.level ?? 1)));
          acc.netDucats += Number.isFinite(Number(row.lastNetDucats)) ? Number(row.lastNetDucats) : 0;
          if (Number.isFinite(Number(row.lastProductivity))) {
            acc.productivity += Number(row.lastProductivity);
            acc.productivityCount += 1;
          }
          if (row.isInactive) acc.inactive += 1;
          const buildingId = typeof row.buildingId === "string" ? row.buildingId : "";
          if (buildingId) acc.byType.set(buildingId, (acc.byType.get(buildingId) ?? 0) + 1);
          return acc;
        },
        { count: 0, levels: 0, netDucats: 0, productivity: 0, productivityCount: 0, inactive: 0, byType: new Map<string, number>() },
      );
      const topBuilding = [...buildingStats.byType.entries()].sort((a, b) => b[1] - a[1])[0];
      const constructionQueue = hoverData.regionConstructionQueueByRegion[hoverRegionId] ?? [];
      const resourceDeposits = hoverData.regionResourceDepositsByRegion[hoverRegionId] ?? [];
      const topDeposit = [...resourceDeposits].sort((a, b) => Math.max(0, Number(b.amount)) - Math.max(0, Number(a.amount)))[0];
      const explorationQueue = hoverData.regionResourceExplorationQueueByRegion[hoverRegionId] ?? [];
      const explorationCount = Math.max(0, Number(hoverData.regionResourceExplorationCountByRegion[hoverRegionId] ?? 0));
      const population = hoverData.regionPopulationByRegion[hoverRegionId];
      const cultureTotals = new Map<string, number>();
      const religionTotals = new Map<string, number>();
      const ideologyTotals = new Map<string, number>();
      for (const pop of population?.pops ?? []) {
        const size = Math.max(0, Number(pop.size) || 0);
        if (pop.cultureId) cultureTotals.set(pop.cultureId, (cultureTotals.get(pop.cultureId) ?? 0) + size);
        if (pop.religionId) religionTotals.set(pop.religionId, (religionTotals.get(pop.religionId) ?? 0) + size);
        const ideologyTotal = Object.values(pop.ideologies ?? {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
        if (ideologyTotal > 0) {
          for (const [ideologyId, amount] of Object.entries(pop.ideologies ?? {})) {
            ideologyTotals.set(ideologyId, (ideologyTotals.get(ideologyId) ?? 0) + size * (Math.max(0, Number(amount) || 0) / ideologyTotal));
          }
        }
      }
      const topCulture = [...cultureTotals.entries()].sort((a, b) => b[1] - a[1])[0];
      const topReligion = [...religionTotals.entries()].sort((a, b) => b[1] - a[1])[0];
      const topIdeology = [...ideologyTotals.entries()].sort((a, b) => b[1] - a[1])[0];
      const leadColonizer = colonizers[0] ?? null;
      const marketAccess = hoverData.marketAccessByProvince[id] ?? null;
      const modeRows: HoverModeRow[] = (() => {
        switch (hoverData.activeModeId) {
          case "political":
            return [
              { label: "Статус", value: ownerId ? "Территория страны" : colonizers.length > 0 ? "Колониальная гонка" : "Нейтральная", tone: ownerId ? "good" : colonizers.length > 0 ? "warn" : "default" },
              ...(leadColonizer ? [{ label: "Лидер гонки", value: `${leadColonizer.countryName} ${leadColonizer.percent.toFixed(0)}%`, tone: "warn" as const }] : []),
            ];
          case "diplomacy":
            return [
              { label: "Отношение", value: !ownerId ? "Нейтрал" : ownerId === hoverData.countryId ? "Своя территория" : "Другая страна", tone: ownerId === hoverData.countryId ? "good" : "default" },
              { label: "Страна", value: ownerName },
            ];
          case "markets":
            return [
                  { label: "Рынок", value: marketAccess ? (hoverData.marketById.get(marketAccess.marketId)?.name ?? marketAccess.marketId) : "нет рынка" },
                  {
                    label: "Столица рынка",
                    value: marketAccess && hoverData.marketById.get(marketAccess.marketId)?.capitalProvinceId === id ? "эта провинция" : "нет",
                    tone: marketAccess && hoverData.marketById.get(marketAccess.marketId)?.capitalProvinceId === id ? "good" : "default",
                  },
                ];
          case "infrastructure":
            return [
              {
                label: "Коридор",
                value: isCorridorEndpoint ? "проходит через провинцию" : "нет коридора",
                tone: isCorridorEndpoint ? "good" : "default",
              },
              {
                label: "Связь по коридорам",
                value: isCorridorReachable ? "есть" : "нет",
                tone: isCorridorReachable ? "good" : isCorridorEndpoint ? "warn" : "default",
              },
            ];
          case "population": {
            const density = populationStats.total > 0 && provinceMetaByIdRef.current.get(id)?.areaKm2
              ? populationStats.total / Math.max(1, provinceMetaByIdRef.current.get(id)?.areaKm2 ?? 1)
              : 0;
            const activePopulationRow = hoverData.populationMapRowByProvince.get(id);
            const activePopulationLensOption = POPULATION_LENS_OPTIONS.find((option) => option.id === hoverData.populationLens);
            const activePopulationLensLabel = activePopulationLensOption ? t(activePopulationLensOption.labelKey) : t("map.lens.fallback");
            return [
              ...(activePopulationRow ? [{ label: activePopulationLensLabel, value: activePopulationRow.label }] : []),
              { label: "Население", value: formatCompact(populationStats.total) },
              { label: "Плотность", value: `${formatCompact(density)}/км²` },
              { label: "SoL", value: populationStats.averageSoL.toFixed(1) },
              { label: "Рад./лоял.", value: `${formatCompact(populationStats.radicals)} / ${formatCompact(populationStats.loyalists)}`, tone: populationStats.radicals > populationStats.loyalists ? "bad" : "good" },
              ...(topCulture ? [{ label: "Культура", value: hoverData.populationMetaByKind.cultures[topCulture[0]]?.name ?? topCulture[0] }] : []),
              ...(topReligion ? [{ label: "Религия", value: hoverData.populationMetaByKind.religions[topReligion[0]]?.name ?? topReligion[0] }] : []),
              ...(topIdeology ? [{ label: "Идеология", value: hoverData.populationMetaByKind.ideologies[topIdeology[0]]?.name ?? topIdeology[0] }] : []),
            ];
          }
          case "resources":
            return [
              { label: "Залежи", value: resourceDeposits.length > 0 ? String(resourceDeposits.length) : "не обнаружены", tone: resourceDeposits.length > 0 ? "good" : "default" },
              ...(topDeposit ? [{ label: "Крупнейшая", value: `${hoverData.goodMetaById[topDeposit.goodId]?.name ?? topDeposit.goodId} ${formatCompact(Math.max(0, Number(topDeposit.amount)))}` }] : []),
              { label: "Разведка", value: explorationQueue.length > 0 ? `${explorationQueue.length} активно` : explorationCount > 0 ? `${explorationCount} завершено` : "нет", tone: explorationQueue.length > 0 ? "warn" : "default" },
            ];
          case "military": {
            const provinceDivisions = Object.values(divisionsByIdRef.current).filter((division) => division.provinceId === id);
            return [
              { label: "Армии", value: provinceDivisions.length > 0 ? String(provinceDivisions.length) : "нет", tone: provinceDivisions.length > 0 ? "warn" : "default" },
              ...(provinceDivisions[0] ? [{ label: "Первая армия", value: provinceDivisions[0].name }] : []),
            ];
          }
          case "colonization":
            return [
              { label: "Доступ", value: ownerId ? "занято" : effectiveProvinceCfg.disabled ? "недоступно" : "доступно", tone: ownerId || effectiveProvinceCfg.disabled ? "bad" : "good" },
              { label: "Стоимость", value: formatCompact(regionColonizationCost) },
              ...(leadColonizer ? [{ label: "Лидер", value: `${leadColonizer.countryName} ${leadColonizer.percent.toFixed(0)}%`, tone: "warn" as const }] : []),
              ...(queuedCountryIds.has(hoverData.countryId ?? "") ? [{ label: "Мой приказ", value: "в очереди", tone: "good" as const }] : []),
            ];
          default:
            return [];
        }
      })();

      map.getCanvas().style.cursor = "pointer";

      if (hoveredFeatureIdRef.current && hoveredFeatureIdRef.current !== id) {
        map.setFeatureState({ source: "adm1", sourceLayer: "adm1", id: hoveredFeatureIdRef.current }, { hover: false });
      }

      if (hoveredFeatureIdRef.current !== id) {
        hoveredFeatureIdRef.current = id;
        map.setFeatureState({ source: "adm1", sourceLayer: "adm1", id }, { hover: true });
      }

      const nextHoverTooltip = {
        x: e.point.x,
        y: e.point.y,
        provinceName: name,
        areaKm2: provinceMetaByIdRef.current.get(id)?.areaKm2 ?? null,
        ownerName,
        colonizers,
        modeLabel: hoverData.activeModeConfig.label,
        modeRows,
      };
      const sameProvince = lastHoverTooltipProvinceIdRef.current === id;
      if (hoverTooltipRafRef.current != null) {
        cancelAnimationFrame(hoverTooltipRafRef.current);
      }
      hoverTooltipRafRef.current = requestAnimationFrame(() => {
        setHoverTooltip((prev) => {
          if (
            sameProvince &&
            prev &&
            Math.abs(prev.x - nextHoverTooltip.x) < 2 &&
            Math.abs(prev.y - nextHoverTooltip.y) < 2 &&
            prev.provinceName === nextHoverTooltip.provinceName &&
            prev.ownerName === nextHoverTooltip.ownerName &&
            prev.colonizers.length === nextHoverTooltip.colonizers.length
          ) {
            return prev;
          }
          return nextHoverTooltip;
        });
        hoverTooltipRafRef.current = null;
        lastHoverTooltipProvinceIdRef.current = id;
      });
    });

    map.on("mouseleave", "province-fill", () => {
      map.getCanvas().style.cursor = "";
      if (hoveredFeatureIdRef.current) {
        map.setFeatureState({ source: "adm1", sourceLayer: "adm1", id: hoveredFeatureIdRef.current }, { hover: false });
      }
      hoveredFeatureIdRef.current = null;
      lastHoverTooltipProvinceIdRef.current = null;
      if (hoverTooltipRafRef.current != null) {
        cancelAnimationFrame(hoverTooltipRafRef.current);
        hoverTooltipRafRef.current = null;
      }
      setHoverTooltip(null);
    });

    map.on("contextmenu", "province-fill", (e) => {
      const feature = e.features?.[0];
      if (!feature) {
        return;
      }

      const props = feature.properties as Record<string, unknown> | undefined;
      const id = readProvinceId(props);
      if (!id) {
        return;
      }
      provinceNamesByIdRef.current.set(id, readProvinceName(props));
      const provinceName = getProvinceDisplayName(id, undefined, props);

      e.preventDefault();
      setContextMenu({
        x: e.point.x + 12,
        y: e.point.y - 8,
        provinceId: id,
        provinceName,
      });
    });

    map.on("click", "province-fill", (e) => {
      const feature = e.features?.[0];
      if (!feature) {
        return;
      }

      const props = feature.properties as Record<string, unknown> | undefined;
      const id = readProvinceId(props);
      if (!id) {
        return;
      }
      const rawName = readProvinceName(props);
      provinceNamesByIdRef.current.set(id, rawName);

      if (corridorBuildModeRef.current) {
        const currentCountryId = authCountryIdRef.current;
        const provinceOwnerId = provinceOwnerByIdRef.current[id] ?? null;
        const transportMode = corridorBuildTransportModeRef.current;
        const hasForeignBuildRight = Boolean(
          currentCountryId &&
            provinceOwnerId &&
            provinceOwnerId !== currentCountryId &&
            hasInfrastructureConstructionRight(infrastructureConstructionRightsRef.current, {
              grantorCountryId: provinceOwnerId,
              builderCountryId: currentCountryId,
              transportMode,
              turnId: turnIdRef.current,
            }),
        );
        if (!currentCountryId || (provinceOwnerId && provinceOwnerId !== currentCountryId && !hasForeignBuildRight)) {
          const modeLabel = transportModeLabel(transportMode);
          toast.error(
            provinceOwnerId
              ? `Нужен договор строительства коридоров: владелец провинции должен разрешить ${modeLabel}`
              : "Коридор можно строить только по доступным провинциям",
          );
          setContextMenu(null);
          return;
        }
        const currentRoutePoints = corridorBuildRoutePointsRef.current;
        const previousPoint = currentRoutePoints[currentRoutePoints.length - 1];
        const previousProvinceId = previousPoint?.provinceId ?? null;
        const isAdjacentToPrevious =
          !previousProvinceId ||
          previousProvinceId === id ||
          (provinceMetaByIdRef.current.get(previousProvinceId)?.neighbors ?? []).includes(id) ||
          (provinceMetaByIdRef.current.get(id)?.neighbors ?? []).includes(previousProvinceId);
        if (!isAdjacentToPrevious) {
          toast.error("Следующая точка коридора должна быть в соседней провинции");
          setContextMenu(null);
          return;
        }
        setCorridorBuildRoutePoints((current) => [...current, { provinceId: id, lng: e.lngLat.lng, lat: e.lngLat.lat }]);
        setCorridorBuildProvinceIds((current) => (current.includes(id) ? current : [...current, id]));
        setContextMenu(null);
        return;
      }

      if (selectedFeatureIdRef.current && selectedFeatureIdRef.current !== id) {
        map.setFeatureState({ source: "adm1", sourceLayer: "adm1", id: selectedFeatureIdRef.current }, { selected: false });
      }

      selectedFeatureIdRef.current = id;
      map.setFeatureState({ source: "adm1", sourceLayer: "adm1", id }, { selected: true });

      setSelectedProvince(id);
      setSelectedProvinceName(getProvinceDisplayName(id, rawName, props));
      setContextMenu(null);
    });

    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["province-fill"] });
      if (features.length > 0) {
        return;
      }

      if (selectedFeatureIdRef.current) {
        map.setFeatureState({ source: "adm1", sourceLayer: "adm1", id: selectedFeatureIdRef.current }, { selected: false });
      }
      selectedFeatureIdRef.current = null;
      setSelectedProvince(null);
      setSelectedProvinceName(null);
      setContextMenu(null);
    });

    map.on("dblclick", "province-fill", (e) => {
      map.easeTo({ center: e.lngLat, zoom: Math.max(map.getZoom(), 4.2), duration: 350 });
    });

    const deckOverlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(deckOverlay as unknown as maplibregl.IControl);
    deckOverlayRef.current = deckOverlay;
    mapRef.current = map;

    return () => {
      if (hoverTooltipRafRef.current != null) {
        cancelAnimationFrame(hoverTooltipRafRef.current);
        hoverTooltipRafRef.current = null;
      }
      if (viewRafRef.current != null) {
        cancelAnimationFrame(viewRafRef.current);
        viewRafRef.current = null;
      }
      setHoverTooltip(null);
      deckOverlayRef.current?.finalize();
      deckOverlayRef.current = null;
      for (const marker of marketCapitalMarkersRef.current.values()) {
        marker.remove();
      }
      marketCapitalMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [apiBase, setSelectedProvince]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const clearMarkers = () => {
      for (const marker of marketCapitalMarkersRef.current.values()) {
        marker.remove();
      }
      marketCapitalMarkersRef.current.clear();
    };

    if (activeModeId !== "markets" || marketLens !== "capitals") {
      clearMarkers();
      return;
    }

    const nextIds = new Set<string>();
    const visibleMarketIds = new Set(Object.values(marketAccessByProvince).map((access) => access.marketId));
    for (const market of marketsCatalog) {
      if (!visibleMarketIds.has(market.id)) continue;
      const capitalProvinceId = market.capitalProvinceId?.trim();
      if (!capitalProvinceId) continue;
      const meta = provinceMetaByIdRef.current.get(capitalProvinceId);
      if (meta?.centerX == null || meta.centerY == null) continue;
      nextIds.add(market.id);
      if (marketCapitalMarkersRef.current.has(market.id)) continue;

      const color = marketColorById.get(market.id) ?? stableMarketColor(market.id);
      const element = document.createElement("button");
      element.type = "button";
      element.title = `${market.name} - столица рынка`;
      element.className =
        "group flex h-8 w-8 items-center justify-center rounded-md border border-white/25 bg-[#0b111b]/92 p-0.5 shadow-[0_8px_18px_rgba(0,0,0,0.38)] ring-1 ring-black/40 transition hover:scale-110 hover:border-white/55";
      element.style.boxShadow = `0 0 0 2px ${color}66, 0 10px 22px rgba(0,0,0,0.38)`;
      if (market.logoUrl) {
        const img = document.createElement("img");
        img.src = market.logoUrl;
        img.alt = "";
        img.className = "h-full w-full rounded-sm object-cover";
        element.appendChild(img);
      } else {
        const fallback = document.createElement("span");
        fallback.className = "text-[13px] font-black uppercase text-white";
        fallback.textContent = market.name.trim().slice(0, 1) || "M";
        element.appendChild(fallback);
      }
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelectedProvince(capitalProvinceId);
      });

      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([meta.centerX, meta.centerY])
        .addTo(map);
      marketCapitalMarkersRef.current.set(market.id, marker);
    }

    for (const [marketId, marker] of marketCapitalMarkersRef.current.entries()) {
      if (!nextIds.has(marketId)) {
        marker.remove();
        marketCapitalMarkersRef.current.delete(marketId);
      }
    }
  }, [activeModeId, marketLens, marketAccessByProvince, marketColorById, marketsCatalog, provinceIndexVersion, setSelectedProvince]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyAntarcticaVisibilityFilter(map, showAntarctica);
  }, [showAntarctica]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("country-labels")) return;
    const source = map.getSource("countryLabels") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(countryLabelData as Parameters<maplibregl.GeoJSONSource["setData"]>[0]);
    }
    map.setLayoutProperty(
      "country-labels",
      "visibility",
      activeModeId === "political" && politicalLens === "owners" ? "visible" : "none",
    );
  }, [activeModeId, countryLabelData, mapStyleReadyVersion, politicalLens]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      !map.getLayer("province-fill") ||
      !map.getLayer("province-line") ||
      !map.getLayer("province-colonize-stripes") ||
      !map.getLayer("province-colonize-ring")
    ) {
      return;
    }

    const ownerByProvince = displayOwnerByProvince;
    const progressByProvince = colonyProgressByRegion;

    const nextOwnedIds = new Set(Object.keys(ownerByProvince));
    const nextColonizingIds = new Set(Object.keys(progressByProvince));
    const nextQueuedIds = new Set(queuedColonizeCountriesByProvince.keys());
    const nextConfiguredIds = new Set(Object.keys(regionColonizationByRegion));
    const populationRowByProvince = new Map(populationMapRows.map((row) => [row.provinceId, row]));
    const nextPopulationMapIds = new Set(populationRowByProvince.keys());
    const nextMapColorIds = new Set(provinceMetaByIdRef.current.keys());
    const allTouchedIds = new Set<string>([
      ...prevOwnedProvinceIdsRef.current,
      ...prevColonizingProvinceIdsRef.current,
      ...prevQueuedColonizeProvinceIdsRef.current,
      ...prevConfiguredColonizeProvinceIdsRef.current,
      ...prevPopulationMapProvinceIdsRef.current,
      ...nextMapColorIds,
      ...nextOwnedIds,
      ...nextColonizingIds,
      ...nextQueuedIds,
      ...nextConfiguredIds,
      ...nextPopulationMapIds,
    ]);

    for (const provinceId of allTouchedIds) {
      const ownerId = ownerByProvince[provinceId];
      const ownerColor = ownerId ? (countryById.get(ownerId)?.color ?? "#9ca3af") : "#C0C0C0";
      const ownerBorderColor = ownerId ? darkenHexColor(ownerColor, 0.42) : "#94a3b8";
      const ownerMapColor = ownerId ? mixHexColor(lightenHexColor(ownerColor, 0.18), "#e8d5ad", 0.3) : "#d8d0bd";
      const ownerMapBorderColor = ownerId ? darkenHexColor(ownerColor, 0.5) : "#9f9582";
      const meta = provinceMetaByIdRef.current.get(provinceId);
      const regionId = meta?.regionId ?? provinceId;
      const regionOwnerId = regionOwnerById[regionId] ?? null;
      const cfg = regionColonizationByRegion[regionId] ?? { cost: 100, disabled: false };
      const authoredColorState = resolveAuthoredProvinceColorState(meta);
      const hasQueuedOwnColonizeOrder = myQueuedColonizeProvinceIds.has(provinceId);

      let leadCountryId: string | null = null;
      let leadPoints = -1;
      let hasOwnColony = false;
      let hasForeignColony = false;
      if (!regionOwnerId) {
        const progress = progressByProvince[regionId] ?? {};
        for (const [countryId, points] of Object.entries(progress)) {
          if (auth?.countryId && countryId === auth.countryId) {
            hasOwnColony = true;
          } else {
            hasForeignColony = true;
          }
          if (points > leadPoints) {
            leadCountryId = countryId;
            leadPoints = points;
          }
        }
      }

      const queuedCountries = queuedColonizeCountriesByProvince.get(regionId) ?? [];
      const queuedLeadCountryId =
        !regionOwnerId && !leadCountryId && queuedCountries.length > 0
          ? [...queuedCountries].sort((a, b) => a.localeCompare(b))[0]
          : null;
      const effectiveLeadCountryId = leadCountryId ?? queuedLeadCountryId;
      const selectedFilterCountryColonizes =
        effectivePoliticalFilterCountryId != null &&
        !regionOwnerId &&
        ((progressByProvince[regionId] ?? {})[effectivePoliticalFilterCountryId] != null ||
          queuedCountries.includes(effectivePoliticalFilterCountryId));
      const colonizeLeadColor = effectiveLeadCountryId ? (countryById.get(effectiveLeadCountryId)?.color ?? "#9ca3af") : "#9ca3af";
      const colonizeLeadLightColor = effectiveLeadCountryId ? lightenHexColor(colonizeLeadColor, 0.16) : "#cbd5e1";
      const isColonizing = !regionOwnerId && Boolean(effectiveLeadCountryId);
      const populationRow = populationRowByProvince.get(provinceId) ?? null;
      map.setFeatureState(
        { source: "adm1", sourceLayer: "adm1", id: provinceId },
        {
          isOwned: Boolean(ownerId),
          isOwnedByCurrent: Boolean(ownerId && auth?.countryId && ownerId === auth.countryId),
          isOwnedByPoliticalFilter: Boolean(ownerId && effectivePoliticalFilterCountryId && ownerId === effectivePoliticalFilterCountryId),
          hasPoliticalCountryFilter: Boolean(effectivePoliticalFilterCountryId),
          isColonizedByPoliticalFilter: Boolean(selectedFilterCountryColonizes),
          isNeutral: !ownerId,
          ownerColor,
          ownerBorderColor,
          ownerMapColor,
          ownerMapBorderColor,
          ...authoredColorState,
          isColonizing,
          hasOwnColony,
          hasForeignColony,
          hasQueuedOwnColonizeOrder,
          colonizeDisabled: Boolean(cfg.disabled),
          colonizeCost: Math.max(1, Math.floor(cfg.cost ?? 100)),
          colonizeLeadColor,
          colonizeLeadLightColor,
          colonizeLeadBorderColor: effectiveLeadCountryId ? darkenHexColor(colonizeLeadColor, 0.5) : "#64748b",
          hasPopulationMapData: Boolean(populationRow),
          populationMapColor: populationRow?.color ?? PROVINCE_TEXTURE_FILL_COLOR,
          populationMapOpacity: populationRow?.opacity ?? 0.14,
          populationMapBorderColor: populationRow?.borderColor ?? "#94a3b8",
          populationMapBorderOpacity: populationRow?.borderOpacity ?? 0.08,
        },
      );
    }

    prevOwnedProvinceIdsRef.current = nextOwnedIds;
    prevColonizingProvinceIdsRef.current = nextColonizingIds;
    prevQueuedColonizeProvinceIdsRef.current = nextQueuedIds;
    prevConfiguredColonizeProvinceIdsRef.current = nextConfiguredIds;
    prevPopulationMapProvinceIdsRef.current = nextPopulationMapIds;

    if (corridorBuildMode) {
      const selectedRouteIds = corridorBuildProvinceIds;
      const modeColor = TRANSPORT_CORRIDOR_MODE_OPTIONS.find((mode) => mode.id === corridorBuildTransportMode)?.color ?? "#a78bfa";
      map.setPaintProperty("province-fill", "fill-color", buildProvinceMatchExpression([
        { ids: selectedRouteIds, value: modeColor },
      ], ["case", ["boolean", ["feature-state", "isOwnedByCurrent"], false], ["feature-state", "ownerColor"], PROVINCE_TEXTURE_FILL_COLOR]));
      map.setPaintProperty("province-fill", "fill-opacity", buildProvinceMatchExpression([
        { ids: selectedRouteIds, value: MAP_LENS_FILL_OPACITY },
      ], ["case", ["boolean", ["feature-state", "isOwnedByCurrent"], false], MAP_LENS_FILL_OPACITY, IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, PROVINCE_TEXTURE_FILL_OPACITY]));
      map.setPaintProperty("province-colonize-stripes", "fill-pattern", COLONIZE_EMPTY_PATTERN);
      map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
      map.setPaintProperty("province-colonize-ring", "line-width", 0);
      map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
      map.setPaintProperty("province-line", "line-color", buildProvinceMatchExpression([
        { ids: selectedRouteIds, value: modeColor },
      ], ["case", ["boolean", ["feature-state", "isOwnedByCurrent"], false], ["feature-state", "ownerColor"], "#94a3b8"]));
      map.setPaintProperty("province-line", "line-width", buildProvinceMatchExpression([
        { ids: selectedRouteIds, value: 1.6 },
      ], 0.85));
      map.setPaintProperty("province-line", "line-opacity", MAP_LENS_BORDER_OPACITY);
      return;
    }

    if (activeModeId === "political") {
      const politicalMutedConditions: unknown[] = [];
      if (effectivePoliticalFilterCountryId != null) {
        politicalMutedConditions.push([
          "any",
          ["all", ["boolean", ["feature-state", "isOwned"], false], ["!", ["boolean", ["feature-state", "isOwnedByPoliticalFilter"], false]]],
          ["all", ["boolean", ["feature-state", "isColonizing"], false], ["!", ["boolean", ["feature-state", "isColonizedByPoliticalFilter"], false]]],
        ]);
      }
      if (politicalLens === "mine" || politicalOnlyMine) {
        politicalMutedConditions.push(["!", ["boolean", ["feature-state", "isOwnedByCurrent"], false]]);
      }
      if (politicalOnlyNeutral) {
        politicalMutedConditions.push(["!", ["boolean", ["feature-state", "isNeutral"], false]]);
      }
      if (politicalLens === "colonies") {
        politicalMutedConditions.push(["!", ["boolean", ["feature-state", "isColonizing"], false]]);
      }
      const politicalColoniesExpression: unknown = politicalShowColonies
        ? ["boolean", ["feature-state", "isColonizing"], false]
        : false;
      const politicalMutedExpression =
        politicalMutedConditions.length === 0
          ? false
          : politicalMutedConditions.length === 1
            ? politicalMutedConditions[0]
            : ["any", ...politicalMutedConditions];

      if (politicalLens === "owners") {
        map.setPaintProperty("province-fill", "fill-color", [
          "case",
          politicalMutedExpression,
          mixHexColor(PROVINCE_TEXTURE_FILL_COLOR, "#e8d5ad", 0.34),
          ["boolean", ["feature-state", "isOwned"], false],
          ["coalesce", ["feature-state", "ownerMapColor"], "#d8c8aa"],
          politicalColoniesExpression,
          ["coalesce", ["feature-state", "colonizeLeadLightColor"], "#cbd5e1"],
          PROVINCE_TEXTURE_FILL_COLOR,
        ]);
        map.setPaintProperty("province-fill", "fill-opacity", [
          "case",
          politicalMutedExpression,
          0.18,
          ["boolean", ["feature-state", "isOwned"], false],
          0.68,
          politicalColoniesExpression,
          0.62,
          ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, PROVINCE_TEXTURE_FILL_OPACITY],
        ]);
        map.setPaintProperty("province-colonize-stripes", "fill-pattern", [
          "case",
          politicalColoniesExpression,
          COLONIZE_STRIPES_PATTERN,
          COLONIZE_EMPTY_PATTERN,
        ]);
        map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
        map.setPaintProperty("province-colonize-ring", "line-color", ["coalesce", ["feature-state", "colonizeLeadColor"], "#93c5fd"]);
        map.setPaintProperty("province-colonize-ring", "line-width", 0);
        map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
        map.setPaintProperty("province-line", "line-color", [
          "case",
          politicalMutedExpression,
          "#a99b83",
          ["boolean", ["feature-state", "isOwned"], false],
          ["coalesce", ["feature-state", "ownerMapBorderColor"], "#7c6f5d"],
          politicalColoniesExpression,
          ["coalesce", ["feature-state", "colonizeLeadBorderColor"], "#64748b"],
          "#9ca3af",
        ]);
        map.setPaintProperty("province-line", "line-width", [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0,
          2.4,
          0.12,
          4.2,
          0.42,
          6.5,
          0.95,
        ]);
        map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? [
          "case",
          politicalMutedExpression,
          0.1,
          ["boolean", ["feature-state", "isOwned"], false],
          [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.015,
            2.2,
            0.045,
            4,
            0.18,
            6.5,
            0.54,
          ],
          politicalColoniesExpression,
          0.34,
          ["case", IS_OCEAN_PROVINCE_EXPRESSION, 0.05, 0.12],
        ] : 0);
        return;
      }

      map.setPaintProperty("province-fill", "fill-color", [
        "case",
        politicalMutedExpression,
        PROVINCE_TEXTURE_FILL_COLOR,
        ["boolean", ["feature-state", "isOwned"], false],
        ["coalesce", ["feature-state", "ownerColor"], "#d1d5db"],
        politicalColoniesExpression,
        ["coalesce", ["feature-state", "colonizeLeadLightColor"], "#cbd5e1"],
        PROVINCE_TEXTURE_FILL_COLOR,
      ]);
      map.setPaintProperty("province-fill", "fill-opacity", [
        "case",
        politicalMutedExpression,
        0.28,
        ["boolean", ["feature-state", "isOwned"], false],
        MAP_LENS_FILL_OPACITY,
        politicalColoniesExpression,
        MAP_LENS_FILL_OPACITY,
        ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, PROVINCE_TEXTURE_FILL_OPACITY],
      ]);
      map.setPaintProperty("province-colonize-stripes", "fill-pattern", [
        "case",
        politicalColoniesExpression,
        COLONIZE_STRIPES_PATTERN,
        COLONIZE_EMPTY_PATTERN,
      ]);
      map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
      map.setPaintProperty("province-colonize-ring", "line-color", ["coalesce", ["feature-state", "colonizeLeadColor"], "#93c5fd"]);
      map.setPaintProperty("province-colonize-ring", "line-width", 0);
      map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
      map.setPaintProperty("province-line", "line-color", [
        "case",
        politicalMutedExpression,
        PROVINCE_TEXTURE_FILL_COLOR,
        ["boolean", ["feature-state", "isOwned"], false],
        ["coalesce", ["feature-state", "ownerColor"], "#d1d5db"],
        politicalColoniesExpression,
        ["coalesce", ["feature-state", "colonizeLeadLightColor"], "#cbd5e1"],
        "#9ca3af",
      ]);
      map.setPaintProperty("province-line", "line-width", 1.1);
      map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? [
        "case",
        politicalMutedExpression,
        0.28,
        ["boolean", ["feature-state", "isOwned"], false],
        MAP_LENS_FILL_OPACITY,
        politicalColoniesExpression,
        MAP_LENS_FILL_OPACITY,
        ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, PROVINCE_TEXTURE_FILL_OPACITY],
      ] : 0);
      return;
    }

    if (activeModeId === "regions") {
      map.setPaintProperty("province-fill", "fill-color", ["coalesce", ["feature-state", "regionMapColor"], PROVINCE_TEXTURE_FILL_COLOR]);
      map.setPaintProperty("province-fill", "fill-opacity", buildProvinceMatchExpression(
        regionModeGroups.map((group) => ({ ids: group.ids, value: 0.72 })),
        ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, 0.12],
      ));
      map.setPaintProperty("province-colonize-stripes", "fill-pattern", COLONIZE_EMPTY_PATTERN);
      map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
      map.setPaintProperty("province-colonize-ring", "line-width", 0);
      map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
      map.setPaintProperty("province-line", "line-color", ["coalesce", ["feature-state", "regionMapBorderColor"], "#64748b"]);
      map.setPaintProperty("province-line", "line-width", [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        0.2,
        3,
        0.55,
        6,
        1.2,
      ]);
      map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? 0.72 : 0);
      return;
    }

    if (activeModeId === "provinceColors") {
      map.setPaintProperty("province-fill", "fill-color", ["coalesce", ["feature-state", "provinceMapColor"], PROVINCE_TEXTURE_FILL_COLOR]);
      map.setPaintProperty("province-fill", "fill-opacity", ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, 0.72]);
      map.setPaintProperty("province-colonize-stripes", "fill-pattern", COLONIZE_EMPTY_PATTERN);
      map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
      map.setPaintProperty("province-colonize-ring", "line-width", 0);
      map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
      map.setPaintProperty("province-line", "line-color", ["coalesce", ["feature-state", "provinceMapBorderColor"], "#64748b"]);
      map.setPaintProperty("province-line", "line-width", 0.9);
      map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? 0.62 : 0);
      return;
    }

    if (activeModeId === "diplomacy") {
      const currentCountryId = auth?.countryId ?? null;
      const treatyCountryIds = new Set<string>();
      for (const agreement of infrastructureTransitAgreements) {
        if (!agreement.active) continue;
        if (diplomacyLens !== "treaties" && currentCountryId && agreement.fromCountryId !== currentCountryId && agreement.toCountryId !== currentCountryId) {
          continue;
        }
        treatyCountryIds.add(agreement.fromCountryId);
        treatyCountryIds.add(agreement.toCountryId);
      }
      const treatyProvinceIds = Object.entries(ownerByProvince)
        .filter(([, ownerId]) => treatyCountryIds.has(ownerId))
        .map(([provinceId]) => provinceId);
      map.setPaintProperty("province-fill", "fill-color", buildProvinceMatchExpression([
        { ids: treatyProvinceIds, value: diplomacyLens === "treaties" ? "#facc15" : diplomacyLens === "transit" ? "#38bdf8" : "#a78bfa" },
      ], PROVINCE_TEXTURE_FILL_COLOR));
      map.setPaintProperty("province-fill", "fill-opacity", buildProvinceMatchExpression([
        { ids: treatyProvinceIds, value: MAP_LENS_FILL_OPACITY },
      ], ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, 0.16]));
      map.setPaintProperty("province-colonize-stripes", "fill-pattern", COLONIZE_EMPTY_PATTERN);
      map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
      map.setPaintProperty("province-colonize-ring", "line-width", 0);
      map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
      map.setPaintProperty("province-line", "line-color", buildProvinceMatchExpression([
        { ids: treatyProvinceIds, value: diplomacyLens === "treaties" ? "#facc15" : diplomacyLens === "transit" ? "#38bdf8" : "#a78bfa" },
      ], "#64748b"));
      map.setPaintProperty("province-line", "line-width", buildProvinceMatchExpression([
        { ids: treatyProvinceIds, value: 1.25 },
      ], 0.75));
      map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? buildProvinceMatchExpression([
        { ids: treatyProvinceIds, value: MAP_LENS_BORDER_OPACITY },
      ], 0.12) : 0);
      return;
    }

    if (activeModeId === "colonization") {
      if (colonizationLens !== "cost") {
        const availableIds: string[] = [];
        const ownRaceIds: string[] = [];
        const foreignRaceIds: string[] = [];
        const blockedIds: string[] = [];
        for (const regionId of new Set([...Object.keys(regionColonizationByRegion), ...Object.keys(progressByProvince)])) {
          const provinceIds = provinceIdsByRegion.get(regionId) ?? [];
          if (provinceIds.length === 0) continue;
          const ownerId = regionOwnerById[regionId] ?? null;
          const cfg = regionColonizationByRegion[regionId] ?? { cost: 100, disabled: false };
          const progress = progressByProvince[regionId] ?? {};
          if (cfg.disabled) blockedIds.push(...provinceIds);
          if (!ownerId && !cfg.disabled) availableIds.push(...provinceIds);
          if (!ownerId && auth?.countryId && progress[auth.countryId] != null) ownRaceIds.push(...provinceIds);
          if (!ownerId && Object.keys(progress).some((countryId) => countryId !== auth?.countryId)) foreignRaceIds.push(...provinceIds);
        }
        const lensIds =
          colonizationLens === "available" ? availableIds :
          colonizationLens === "ownRaces" ? ownRaceIds :
          colonizationLens === "foreignRaces" ? foreignRaceIds :
          blockedIds;
        const lensColor =
          colonizationLens === "available" ? "#4ade80" :
          colonizationLens === "ownRaces" ? "#5C84FF" :
          colonizationLens === "foreignRaces" ? "#EF9D6E" :
          "#b91c1c";
        map.setPaintProperty("province-fill", "fill-color", buildProvinceMatchExpression([{ ids: lensIds, value: lensColor }], PROVINCE_TEXTURE_FILL_COLOR));
        map.setPaintProperty("province-fill", "fill-opacity", buildProvinceMatchExpression([{ ids: lensIds, value: MAP_LENS_FILL_OPACITY }], ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, 0.16]));
        map.setPaintProperty("province-colonize-stripes", "fill-pattern", colonizationLens === "ownRaces" || colonizationLens === "foreignRaces" ? COLONIZE_STRIPES_PATTERN : COLONIZE_EMPTY_PATTERN);
        map.setPaintProperty("province-colonize-stripes", "fill-opacity", colonizationLens === "ownRaces" || colonizationLens === "foreignRaces" ? buildProvinceMatchExpression([{ ids: lensIds, value: 0.58 }], 0) : 0);
        map.setPaintProperty("province-colonize-ring", "line-width", 0);
        map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
        map.setPaintProperty("province-line", "line-color", buildProvinceMatchExpression([{ ids: lensIds, value: lensColor }], "#64748b"));
        map.setPaintProperty("province-line", "line-width", 1.1);
        map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? buildProvinceMatchExpression([{ ids: lensIds, value: MAP_LENS_BORDER_OPACITY }], 0.12) : 0);
        return;
      }
      map.setPaintProperty("province-fill", "fill-color", [
        "case",
        ["boolean", ["feature-state", "colonizeDisabled"], false],
        "#b91c1c",
        ["boolean", ["feature-state", "isOwnedByCurrent"], false],
        "#4800FF",
        ["boolean", ["feature-state", "isOwned"], false],
        "#C14D00",
        ["boolean", ["feature-state", "hasOwnColony"], false],
        "#5C84FF",
        ["boolean", ["feature-state", "hasForeignColony"], false],
        "#EF9D6E",
        ["step", ["coalesce", ["feature-state", "colonizeCost"], 100], "#d1fae5", 50, "#86efac", 100, "#4ade80", 200, "#16a34a", 350, "#166534"],
      ]);
      map.setPaintProperty("province-fill", "fill-opacity", [
        "case",
        ["boolean", ["feature-state", "colonizeDisabled"], false],
        MAP_LENS_FILL_OPACITY,
        ["boolean", ["feature-state", "isOwned"], false],
        0.7,
        MAP_LENS_FILL_OPACITY,
      ]);
      map.setPaintProperty("province-colonize-stripes", "fill-pattern", [
        "case",
        ["boolean", ["feature-state", "hasOwnColony"], false],
        COLONIZE_STRIPES_PATTERN,
        ["boolean", ["feature-state", "hasForeignColony"], false],
        COLONIZE_STRIPES_PATTERN,
        COLONIZE_EMPTY_PATTERN,
      ]);
      map.setPaintProperty("province-colonize-stripes", "fill-opacity", [
        "case",
        ["boolean", ["feature-state", "hasOwnColony"], false],
        0.62,
        ["boolean", ["feature-state", "hasForeignColony"], false],
        0.45,
        0,
      ]);
      map.setPaintProperty("province-line", "line-color", [
        "case",
        ["boolean", ["feature-state", "hasQueuedOwnColonizeOrder"], false],
        "#CE9EFF",
        ["boolean", ["feature-state", "hasOwnColony"], false],
        "#5C84FF",
        ["boolean", ["feature-state", "hasForeignColony"], false],
        "#EF9D6E",
        ["boolean", ["feature-state", "colonizeDisabled"], false],
        "#b91c1c",
        ["boolean", ["feature-state", "isOwnedByCurrent"], false],
        "#4800FF",
        ["boolean", ["feature-state", "isOwned"], false],
        "#C14D00",
        ["step", ["coalesce", ["feature-state", "colonizeCost"], 100], "#d1fae5", 50, "#86efac", 100, "#4ade80", 200, "#16a34a", 350, "#166534"],
      ]);
      map.setPaintProperty("province-line", "line-width", 1.2);
      map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? [
        "case",
        ["boolean", ["feature-state", "colonizeDisabled"], false],
        MAP_LENS_FILL_OPACITY,
        ["boolean", ["feature-state", "isOwned"], false],
        0.7,
        MAP_LENS_FILL_OPACITY,
      ] : 0);
      map.setPaintProperty("province-colonize-ring", "line-width", 0);
      map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
      map.setPaintProperty("province-colonize-stripes", "fill-opacity", [
        "case",
        ["boolean", ["feature-state", "hasQueuedOwnColonizeOrder"], false],
        0.72,
        ["boolean", ["feature-state", "hasOwnColony"], false],
        0.62,
        ["boolean", ["feature-state", "hasForeignColony"], false],
        0.45,
        0,
      ]);
      return;
    }

    if (activeModeId === "markets") {
      const capitalIds = marketsCatalog.flatMap((market) => market.capitalProvinceId ? [market.capitalProvinceId] : []);
      const selectedMemberIds = effectiveSelectedMarketId
        ? [...marketIdByProvince.entries()].filter(([, marketId]) => marketId === effectiveSelectedMarketId).map(([provinceId]) => provinceId)
        : [];
      const fillGroups =
        marketLens === "capitals"
          ? [{ ids: capitalIds, value: "#facc15" }]
          : marketLens === "selectedMarketMembers"
            ? [{ ids: selectedMemberIds, value: effectiveSelectedMarketId ? (marketColorById.get(effectiveSelectedMarketId) ?? stableMarketColor(effectiveSelectedMarketId)) : "#86efac" }]
            : marketProvinceColorGroups;
      map.setPaintProperty("province-fill", "fill-color", buildProvinceMatchExpression(fillGroups, PROVINCE_TEXTURE_FILL_COLOR));
      map.setPaintProperty("province-fill", "fill-opacity", buildProvinceMatchExpression(
        fillGroups.map((group) => ({ ids: group.ids, value: MAP_LENS_FILL_OPACITY })),
        ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, PROVINCE_TEXTURE_FILL_OPACITY],
      ));
      map.setPaintProperty("province-colonize-stripes", "fill-pattern", COLONIZE_EMPTY_PATTERN);
      map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
      map.setPaintProperty("province-colonize-ring", "line-width", 0);
      map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
      map.setPaintProperty("province-line", "line-color", buildProvinceMatchExpression(
        fillGroups,
        "#94a3b8",
      ));
      map.setPaintProperty("province-line", "line-width", 0.95);
      map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? buildProvinceMatchExpression(
        fillGroups.map((group) => ({ ids: group.ids, value: MAP_LENS_FILL_OPACITY })),
        0.28,
      ) : 0.28);
      return;
    }

    if (activeModeId === "infrastructure") {
      const disconnectedIds: string[] = [];
      const accessConnectedIds: string[] = [];
      const accessDisconnectedIds: string[] = [];
      const highAccessIds: string[] = [];
      const mediumAccessIds: string[] = [];
      const lowAccessIds: string[] = [];
      for (const [provinceId, access] of Object.entries(marketAccessByProvince)) {
        if (access.isWorldAccessPoint && access.isConnectedWorldAccessPoint) {
          accessConnectedIds.push(provinceId);
        } else if (access.isWorldAccessPoint) {
          accessDisconnectedIds.push(provinceId);
        } else if (access.connectedToCapital) {
          const marketAccessRatio = Math.max(0, Math.min(1, Number(access.marketAccess ?? 1)));
          if (marketAccessRatio >= 0.85) highAccessIds.push(provinceId);
          else if (marketAccessRatio >= 0.45) mediumAccessIds.push(provinceId);
          else lowAccessIds.push(provinceId);
        } else {
          disconnectedIds.push(provinceId);
        }
      }
      if (
        isTransportInfrastructureLens(infrastructureLens)
      ) {
        const coverageInput: unknown[] = ["match", ["id"]];
        const pushCoverage = (ids: string[], value: number) => {
          if (ids.length > 0) coverageInput.push(ids, value);
        };
        pushCoverage(transportInfrastructureCoverage.excellent, 1);
        pushCoverage(transportInfrastructureCoverage.high, 0.85);
        pushCoverage(transportInfrastructureCoverage.medium, 0.6);
        pushCoverage(transportInfrastructureCoverage.low, 0.3);
        pushCoverage(transportInfrastructureCoverage.critical, 0);
        pushCoverage(transportInfrastructureCoverage.noDemand, -1);
        coverageInput.push(-1);
        const coverageColorExpression: unknown[] = [
          "case",
          ["all", ["==", coverageInput, -1], ["boolean", ["feature-state", "isOwnedByCurrent"], false]],
          "#05070b",
          ["==", coverageInput, -1],
          PROVINCE_TEXTURE_FILL_COLOR,
          [
            "interpolate",
            ["linear"],
            coverageInput,
            0,
            "#dc2626",
            0.5,
            "#f59e0b",
            1,
            "#22c55e",
          ],
        ];
        const coverageOpacityExpression: unknown[] = [
          "case",
          ["==", coverageInput, -1],
          0.18,
          MAP_LENS_FILL_OPACITY,
        ];
        map.setPaintProperty("province-fill", "fill-color", coverageColorExpression);
        map.setPaintProperty("province-fill", "fill-opacity", ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, coverageOpacityExpression]);
        map.setPaintProperty("province-colonize-stripes", "fill-pattern", COLONIZE_EMPTY_PATTERN);
        map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
        map.setPaintProperty("province-colonize-ring", "line-width", 0);
        map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
        map.setPaintProperty("province-line", "line-color", coverageColorExpression);
        map.setPaintProperty("province-line", "line-width", 0.9);
        map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? coverageOpacityExpression : 0);
        return;
      }

      map.setPaintProperty("province-fill", "fill-color", buildProvinceMatchExpression([
          { ids: accessConnectedIds, value: "#22c55e" },
          { ids: accessDisconnectedIds, value: "#f97316" },
          { ids: disconnectedIds, value: "#991b1b" },
          { ids: highAccessIds, value: "#2563eb" },
          { ids: mediumAccessIds, value: "#f59e0b" },
          { ids: lowAccessIds, value: "#dc2626" },
        ], PROVINCE_TEXTURE_FILL_COLOR));
        map.setPaintProperty("province-fill", "fill-opacity", buildProvinceMatchExpression([
          { ids: [...accessConnectedIds, ...accessDisconnectedIds], value: MAP_LENS_FILL_OPACITY },
          { ids: disconnectedIds, value: MAP_LENS_FILL_OPACITY },
          { ids: highAccessIds, value: 0.5 },
          { ids: mediumAccessIds, value: 0.68 },
          { ids: lowAccessIds, value: MAP_LENS_FILL_OPACITY },
        ], ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, PROVINCE_TEXTURE_FILL_OPACITY]));
      map.setPaintProperty("province-colonize-stripes", "fill-pattern", COLONIZE_EMPTY_PATTERN);
      map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
      map.setPaintProperty("province-colonize-ring", "line-width", 0);
      map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
      map.setPaintProperty("province-line", "line-color", buildProvinceMatchExpression([
        { ids: accessConnectedIds, value: "#22c55e" },
        { ids: accessDisconnectedIds, value: "#f97316" },
        { ids: disconnectedIds, value: "#991b1b" },
        { ids: highAccessIds, value: "#2563eb" },
        { ids: mediumAccessIds, value: "#f59e0b" },
        { ids: lowAccessIds, value: "#dc2626" },
      ], "#94a3b8"));
      map.setPaintProperty("province-line", "line-width", buildProvinceMatchExpression([
        { ids: [...accessConnectedIds, ...accessDisconnectedIds], value: 1.4 },
      ], 0.9));
      map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? buildProvinceMatchExpression([
        { ids: [...accessConnectedIds, ...accessDisconnectedIds], value: MAP_LENS_FILL_OPACITY },
        { ids: disconnectedIds, value: MAP_LENS_FILL_OPACITY },
        { ids: highAccessIds, value: 0.5 },
        { ids: mediumAccessIds, value: 0.68 },
        { ids: lowAccessIds, value: MAP_LENS_FILL_OPACITY },
      ], 0) : 0);
      return;
    }

    if (activeModeId === "population") {
      map.setPaintProperty("province-fill", "fill-color", [
        "case",
        ["boolean", ["feature-state", "hasPopulationMapData"], false],
        ["coalesce", ["feature-state", "populationMapColor"], PROVINCE_TEXTURE_FILL_COLOR],
        PROVINCE_TEXTURE_FILL_COLOR,
      ]);
      map.setPaintProperty("province-fill", "fill-opacity", [
        "case",
        IS_OCEAN_PROVINCE_EXPRESSION,
        OCEAN_TEXTURE_FILL_OPACITY,
        ["boolean", ["feature-state", "hasPopulationMapData"], false],
        ["coalesce", ["feature-state", "populationMapOpacity"], 0.14],
        0.14,
      ]);
      map.setPaintProperty("province-line", "line-color", [
        "case",
        ["boolean", ["feature-state", "hasPopulationMapData"], false],
        ["coalesce", ["feature-state", "populationMapBorderColor"], "#94a3b8"],
        "#94a3b8",
      ]);
      map.setPaintProperty("province-line", "line-width", 0.9);
      map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? [
        "case",
        ["boolean", ["feature-state", "hasPopulationMapData"], false],
        ["coalesce", ["feature-state", "populationMapBorderOpacity"], 0.08],
        0.08,
      ] : 0);
      map.setPaintProperty("province-colonize-stripes", "fill-pattern", COLONIZE_EMPTY_PATTERN);
      map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
      map.setPaintProperty("province-colonize-ring", "line-width", 0);
      map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
      return;
    }

    if (activeModeId === "resources") {
      const selectedResourceColorPairs: unknown[] = [];
      const selectedResourceIds: string[] = [];
      const otherDepositIds: string[] = [];
      const explorationIds = new Set<string>();

      for (const [regionId, queue] of Object.entries(regionResourceExplorationQueueByRegion)) {
        if (queue.length > 0) {
          for (const provinceId of provinceIdsByRegion.get(regionId) ?? []) {
            explorationIds.add(provinceId);
          }
        }
      }

      if (resourceLens === "exploration") {
        const explorationProvinceIds = [...explorationIds];
        const explorationFillColor = explorationProvinceIds.length > 0
          ? ["match", ["id"], explorationProvinceIds, "#38bdf8", PROVINCE_TEXTURE_FILL_COLOR]
          : PROVINCE_TEXTURE_FILL_COLOR;
        const explorationFillOpacity = explorationProvinceIds.length > 0
          ? ["match", ["id"], explorationProvinceIds, MAP_LENS_FILL_OPACITY, ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, PROVINCE_TEXTURE_FILL_OPACITY]]
          : ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, PROVINCE_TEXTURE_FILL_OPACITY];

        map.setPaintProperty("province-fill", "fill-color", explorationFillColor);
        map.setPaintProperty("province-fill", "fill-opacity", explorationFillOpacity);
        map.setPaintProperty("province-colonize-stripes", "fill-pattern", COLONIZE_EMPTY_PATTERN);
        map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
        map.setPaintProperty("province-colonize-ring", "line-width", 0);
        map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
        map.setPaintProperty(
          "province-line",
          "line-color",
          explorationProvinceIds.length > 0 ? ["match", ["id"], explorationProvinceIds, "#38bdf8", "#94a3b8"] : "#94a3b8",
        );
        map.setPaintProperty("province-line", "line-width", 0.9);
        map.setPaintProperty(
          "province-line",
          "line-opacity",
          showProvinceBorders
            ? (explorationProvinceIds.length > 0 ? ["match", ["id"], explorationProvinceIds, MAP_LENS_FILL_OPACITY, 0] : 0)
            : 0,
        );
        return;
      }

      for (const [regionId, deposits] of Object.entries(regionResourceDepositsByRegion)) {
        const normalizedDeposits = deposits
          .map((deposit) => ({
            ...deposit,
            amount: Math.max(0, Number(deposit.amount ?? 0)),
          }))
          .filter((deposit) => deposit.amount > 0);
        if (normalizedDeposits.length === 0) continue;

        const topDeposit = [...normalizedDeposits].sort((a, b) => b.amount - a.amount)[0] ?? null;
        const selectedDeposit =
          resourceGoodId === "all"
            ? topDeposit
            : (normalizedDeposits.find((deposit) => deposit.goodId === resourceGoodId) ?? null);

        if (selectedDeposit) {
          for (const provinceId of provinceIdsByRegion.get(regionId) ?? []) {
            selectedResourceIds.push(provinceId);
            selectedResourceColorPairs.push(
              provinceId,
              resourceColorByGoodId.get(selectedDeposit.goodId) ?? stableResourceColor(selectedDeposit.goodId),
            );
          }
        } else {
          otherDepositIds.push(...(provinceIdsByRegion.get(regionId) ?? []));
        }
      }

      const resourceFillColorExpression: unknown[] = ["match", ["id"], ...selectedResourceColorPairs];
      if (otherDepositIds.length > 0) {
        resourceFillColorExpression.push(otherDepositIds, "#334155");
      }
      const resourceFillColor =
        resourceFillColorExpression.length > 2
          ? [...resourceFillColorExpression, PROVINCE_TEXTURE_FILL_COLOR]
          : PROVINCE_TEXTURE_FILL_COLOR;

      const resourceFillOpacityExpression: unknown[] = ["match", ["id"]];
      if (selectedResourceIds.length > 0) {
        resourceFillOpacityExpression.push(selectedResourceIds, MAP_LENS_FILL_OPACITY);
      }
      if (otherDepositIds.length > 0) {
        resourceFillOpacityExpression.push(otherDepositIds, 0.34);
      }
      const resourceFillOpacityFallback = ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, PROVINCE_TEXTURE_FILL_OPACITY];
      const resourceFillOpacity =
        resourceFillOpacityExpression.length > 2
          ? [...resourceFillOpacityExpression, resourceFillOpacityFallback]
          : resourceFillOpacityFallback;

      map.setPaintProperty("province-fill", "fill-color", resourceFillColor);
      map.setPaintProperty("province-fill", "fill-opacity", resourceFillOpacity);
      map.setPaintProperty("province-colonize-stripes", "fill-pattern", COLONIZE_EMPTY_PATTERN);
      map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
      map.setPaintProperty("province-colonize-ring", "line-width", 0);
      map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
      map.setPaintProperty(
        "province-line",
        "line-color",
        resourceFillColorExpression.length > 2 ? [...resourceFillColorExpression, "#94a3b8"] : "#94a3b8",
      );
      map.setPaintProperty("province-line", "line-width", 0.9);
      const resourceLineOpacityExpression: unknown[] = ["match", ["id"]];
      if (selectedResourceIds.length > 0) {
        resourceLineOpacityExpression.push(selectedResourceIds, MAP_LENS_FILL_OPACITY);
      }
      if (otherDepositIds.length > 0) {
        resourceLineOpacityExpression.push(otherDepositIds, 0.34);
      }
      map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? (
        resourceLineOpacityExpression.length > 2 ? [...resourceLineOpacityExpression, 0] : 0
      ) : 0);
      return;
    }

    if (activeModeId === "military") {
      const ownArmyIds: string[] = [];
      const foreignArmyIds: string[] = [];
      for (const division of Object.values(divisionsById)) {
        if (!division.provinceId) continue;
        if (auth?.countryId && division.countryId === auth.countryId) ownArmyIds.push(division.provinceId);
        else foreignArmyIds.push(division.provinceId);
      }
      map.setPaintProperty("province-fill", "fill-color", buildProvinceMatchExpression([
        { ids: [...new Set(foreignArmyIds)], value: "#ef4444" },
        { ids: [...new Set(ownArmyIds)], value: "#22c55e" },
      ], PROVINCE_TEXTURE_FILL_COLOR));
      map.setPaintProperty("province-fill", "fill-opacity", buildProvinceMatchExpression([
        { ids: [...new Set(foreignArmyIds)], value: MAP_LENS_FILL_OPACITY },
        { ids: [...new Set(ownArmyIds)], value: MAP_LENS_FILL_OPACITY },
      ], ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, 0.14]));
      map.setPaintProperty("province-colonize-stripes", "fill-pattern", COLONIZE_EMPTY_PATTERN);
      map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
      map.setPaintProperty("province-colonize-ring", "line-width", 0);
      map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
      map.setPaintProperty("province-line", "line-color", buildProvinceMatchExpression([
        { ids: [...new Set(foreignArmyIds)], value: "#ef4444" },
        { ids: [...new Set(ownArmyIds)], value: "#22c55e" },
      ], "#64748b"));
      map.setPaintProperty("province-line", "line-width", 1.15);
      map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? buildProvinceMatchExpression([
        { ids: [...new Set(foreignArmyIds)], value: MAP_LENS_BORDER_OPACITY },
        { ids: [...new Set(ownArmyIds)], value: MAP_LENS_BORDER_OPACITY },
      ], 0.1) : 0);
      return;
    }

    const style = activeModeConfig;
    map.setPaintProperty("province-fill", "fill-color", style.fillColor);
    map.setPaintProperty("province-fill", "fill-opacity", ["case", IS_OCEAN_PROVINCE_EXPRESSION, OCEAN_TEXTURE_FILL_OPACITY, Math.min(MAP_LENS_FILL_OPACITY, Number(style.fillOpacity) || MAP_LENS_FILL_OPACITY)]);
    map.setPaintProperty("province-colonize-stripes", "fill-pattern", COLONIZE_EMPTY_PATTERN);
    map.setPaintProperty("province-colonize-stripes", "fill-opacity", 0);
    map.setPaintProperty("province-colonize-ring", "line-width", 0);
    map.setPaintProperty("province-colonize-ring", "line-opacity", 0);
    map.setPaintProperty("province-line", "line-color", style.fillColor);
    map.setPaintProperty("province-line", "line-width", 0.9);
    map.setPaintProperty("province-line", "line-opacity", showProvinceBorders ? Math.min(MAP_LENS_FILL_OPACITY, Number(style.fillOpacity) || MAP_LENS_FILL_OPACITY) : 0);
  }, [
    activeModeConfig,
    activeModeId,
    auth?.countryId,
    countryById,
    corridorBuildMode,
    corridorBuildProvinceIds,
    corridorBuildTransportMode,
    diplomacyLens,
    effectivePoliticalFilterCountryId,
    effectiveSelectedMarketId,
    infrastructureLens,
    infrastructureLensView,
    logisticsCoverageProvinceIds,
    logisticsProblemGroups,
    marketColorById,
    marketIdByProvince,
    marketLens,
    marketProvinceColorGroups,
    marketsCatalog,
    militaryLens,
    myQueuedColonizeProvinceIds,
    populationLens,
    populationMapRows,
    populationMetaByKind,
    politicalLens,
    politicalOnlyMine,
    politicalOnlyNeutral,
    politicalShowColonies,
    queuedColonizeCountriesByProvince,
    resourceColorByGoodId,
    resourceGoodId,
    resourceLens,
    regionModeGroups,
    provinceIdsByRegion,
    provinceIndexVersion,
    showProvinceBorders,
    divisionsById,
    displayOwnerByProvince,
    colonyProgressByRegion,
    regionColonizationByRegion,
    regionOwnerById,
    marketAccessByProvince,
    regionPopulationByRegion,
    regionResourceDepositsByRegion,
    regionResourceExplorationCountByRegion,
    regionResourceExplorationQueueByRegion,
    transportInfrastructureCoverage,
  ]);

  const zoomIn = () => {
    mapRef.current?.zoomIn({ duration: 220 });
  };

  const zoomOut = () => {
    mapRef.current?.zoomOut({ duration: 220 });
  };

  const resetView = () => {
    mapRef.current?.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 450 });
  };

  const toggleInteraction = () => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const nextState = !interactionLocked;
    setInteractions(map, !nextState);
    setInteractionLocked(nextState);
  };

  const handleStartColonization = async () => {
    if (!auth?.token || !selectedRegionId) {
      return;
    }
    setColonizationActionPending(true);
    try {
      await startCountryColonization(auth.token, selectedRegionId);
      toast.success(t("colonization.toastStarted"));
      addEvent({
        category: "colonization",
        title: t("colonization.eventStartTitle"),
        message: t("colonization.eventStartMessage", { region: selectedRegionId }),
        visibility: "private",
        countryId: auth.countryId,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "COLONIZATION_START_FAILED";
      if (code === "COLONIZE_LIMIT") {
        toast.error(t("colonization.limitReached"));
        addEvent({
          category: "colonization",
          title: t("colonization.eventLimitTitle"),
          message: t("colonization.limitReached"),
          priority: "medium",
          visibility: "private",
          countryId: auth.countryId,
        });
      } else if (code === "COLONIZATION_DISABLED") {
        toast.error(t("colonization.disabledByAdmin"));
      } else {
        toast.error(t("colonization.startFailed"));
      }
    } finally {
      setColonizationActionPending(false);
    }
  };

  const handleCancelColonization = async () => {
    if (!auth?.token || !selectedRegionId) {
      return;
    }
    setColonizationActionPending(true);
    try {
      await cancelCountryColonization(auth.token, selectedRegionId);
      toast.success(t("colonization.toastCanceled"));
      addEvent({
        category: "colonization",
        title: t("colonization.eventCancelTitle"),
        message: t("colonization.eventCancelMessage", { region: selectedRegionId }),
        visibility: "private",
        countryId: auth.countryId,
      });
    } catch {
      toast.error(t("colonization.cancelFailed"));
    } finally {
      setColonizationActionPending(false);
    }
  };

  const handleStartExploration = async () => {
    if (!auth?.token || !selectedRegionId || !selectedCanStartExploration) {
      return;
    }
    try {
      setExplorationActionPending(true);
      await startCountryExploration(auth.token, selectedRegionId);
      toast.success("Разведка запущена", {
        description: `Провинция ${selectedProvinceDisplayName ?? selectedProvinceId}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "EXPLORATION_START_FAILED";
      if (message === "EXPLORATION_ALREADY_QUEUED") {
        toast.error("Разведка уже запущена");
      } else if (message === "REGION_NOT_CONTROLLED") {
        toast.error("Разведка доступна только в подконтрольных регионах");
      } else {
        toast.error("Не удалось запустить разведку");
      }
    } finally {
      setExplorationActionPending(false);
    }
  };

  const handleRenameOwnedProvince = async () => {
    if (!auth?.token || !auth.countryId || !selectedProvinceId || !selectedCanRenameProvince) {
      return;
    }
    const nextName = provinceRenameInput.trim();
    const currentName = getProvinceDisplayName(selectedProvinceId, selectedProvinceName);
    if (!nextName) {
      toast.error("Название не может быть пустым");
      return;
    }
    if (nextName.length > 64) {
      toast.error("Максимум 64 символа");
      return;
    }
    if (nextName === currentName) {
      return;
    }

    setProvinceRenamePending(true);
    try {
      const result = await renameOwnedProvince(auth.token, { provinceId: selectedProvinceId, provinceName: nextName });
      provinceNamesByIdRef.current.set(result.provinceId, result.provinceName);
      setSelectedProvinceName(result.provinceName);
      setProvinceRenameModalOpen(false);
      updateCountryResources(auth.countryId, { ducats: result.resources.ducats });
      onProvinceRenameCharged?.(result.chargedDucats);
      toast.success(`Провинция переименована (-${result.chargedDucats} дукатов)`);
      addEvent({
        category: "politics",
        title: "Переименование провинции",
        message: `Вы переименовали провинцию в "${result.provinceName}"`,
        visibility: "private",
        countryId: auth.countryId,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "PROVINCE_RENAME_FAILED";
      if (code === "NOT_PROVINCE_OWNER") {
        toast.error("Можно переименовывать только свои провинции");
      } else if (code === "INSUFFICIENT_DUCATS") {
        toast.error("Недостаточно дукатов");
      } else if (code === "PROVINCE_NOT_FOUND") {
        toast.error("Провинция не найдена");
      } else if (code === "INVALID_PAYLOAD") {
        toast.error("Некорректное название провинции");
      } else {
        toast.error("Не удалось переименовать провинцию");
      }
    } finally {
      setProvinceRenamePending(false);
    }
  };

  const startCorridorBuild = () => {
    setTransportCorridorsModalOpen(false);
    setCorridorBuildMode(true);
    if (selectedProvinceId && auth?.countryId && provinceOwnerById[selectedProvinceId] === auth.countryId) {
      const meta = provinceMetaByIdRef.current.get(selectedProvinceId);
      setCorridorBuildProvinceIds([selectedProvinceId]);
      setCorridorBuildRoutePoints(
        meta?.centerX == null || meta.centerY == null ? [] : [{ provinceId: selectedProvinceId, lng: meta.centerX, lat: meta.centerY }],
      );
    } else {
      setCorridorBuildProvinceIds([]);
      setCorridorBuildRoutePoints([]);
    }
    setInfrastructureLens(`${corridorBuildTransportMode}:coverage` as InfrastructureLensId);
  };

  const cancelCorridorBuild = () => {
    setCorridorBuildMode(false);
    setCorridorBuildProvinceIds([]);
    setCorridorBuildRoutePoints([]);
    setTransportCorridorsModalOpen(true);
  };

  const confirmCorridorBuild = async () => {
    if (!auth?.token || !currentMarketId || corridorBuildProvinceIds.length < 2 || corridorBuildRoutePoints.length < 2) return;
    setCorridorPending(true);
    try {
      const result = await createMarketTransportCorridor(auth.token, currentMarketId, {
        provinceIds: corridorBuildProvinceIds,
        routePoints: corridorBuildRoutePoints,
        transportMode: corridorBuildTransportMode,
      });
      setMarketTransportCorridors(result.corridors);
      setCorridorBuildMode(false);
      setCorridorBuildProvinceIds([]);
      setCorridorBuildRoutePoints([]);
      setTransportCorridorsModalOpen(true);
      toast.success("Коридор добавлен в строительство");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось начать строительство коридора");
    } finally {
      setCorridorPending(false);
    }
  };

  const applyCorridorAction = async (corridor: MarketTransportCorridor, action: "open" | "close" | "upgrade" | "demolish") => {
    if (!auth?.token || !currentMarketId) return;
    if (corridor.ownerCountryId !== auth.countryId) {
      toast.error("Управлять можно только своими коридорами");
      return;
    }
    setCorridorPendingId(corridor.id);
    try {
      const result =
        action === "demolish"
          ? await deleteMarketTransportCorridor(auth.token, currentMarketId, corridor.id)
          : await updateMarketTransportCorridor(auth.token, currentMarketId, corridor.id, { action });
      setMarketTransportCorridors(result.corridors);
      toast.success(action === "upgrade" ? "Улучшение добавлено в строительство" : action === "demolish" ? "Коридор снесен" : "Коридор обновлен");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось изменить коридор");
    } finally {
      setCorridorPendingId(null);
    }
  };

  const renderLensOptionButton = (
    id: string,
    label: string,
    active: boolean,
    onClick: () => void,
    icon?: ReactNode,
    badge?: number,
  ) => (
    <Tooltip key={id} content={label}>
      <motion.button
        type="button"
        onClick={onClick}
        className={getLensIconButtonClass(active)}
        aria-label={label}
        aria-pressed={active}
      >
        {icon}
        {badge != null && badge > 0 && (
          <span className="arc-map-lens-badge">
            {badge}
          </span>
        )}
      </motion.button>
    </Tooltip>
  );

  const activeLensControl = (() => {
    if (activeModeId === "political") {
      return (
        <>
          {POLITICAL_LENS_OPTIONS.map((option) => {
            const Icon = POLITICAL_LENS_ICONS[option.id];
            return renderLensOptionButton(option.id, t(option.labelKey), politicalLens === option.id, () => setPoliticalLens(option.id), <Icon size={22} />);
          })}
          {renderLensOptionButton("political-current", t("map.lens.political.myLands"), politicalOnlyMine, () => setPoliticalOnlyMine((value) => !value), <LocateFixed size={22} />)}
          {renderLensOptionButton("political-neutral", t("map.lens.political.neutral"), politicalOnlyNeutral, () => setPoliticalOnlyNeutral((value) => !value), <Flag size={22} />)}
        </>
      );
    }
    if (activeModeId === "regions" || activeModeId === "provinceColors") {
      return null;
    }
    if (activeModeId === "diplomacy") {
      return DIPLOMACY_LENS_OPTIONS.map((option) => {
        const Icon = DIPLOMACY_LENS_ICONS[option.id];
        return renderLensOptionButton(option.id, t(option.labelKey), diplomacyLens === option.id, () => setDiplomacyLens(option.id), <Icon size={22} />);
      });
    }
    if (activeModeId === "markets") {
      return (
        <>
          {MARKET_LENS_OPTIONS.map((option) => {
            const Icon = MARKET_LENS_ICONS[option.id];
            return renderLensOptionButton(option.id, t(option.labelKey), marketLens === option.id, () => setMarketLens(option.id), <Icon size={22} />);
          })}
        </>
      );
    }
    if (activeModeId === "population") {
      return POPULATION_LENS_OPTIONS.map((option) => {
        const Icon = POPULATION_LENS_ICONS[option.id];
        return renderLensOptionButton(option.id, t(option.labelKey), populationLens === option.id, () => setPopulationLens(option.id), <Icon size={22} />);
      });
    }
    if (activeModeId === "resources") {
      return (
        <>
          {RESOURCE_LENS_OPTIONS.map((option) => {
            const Icon = RESOURCE_LENS_ICONS[option.id];
            return renderLensOptionButton(option.id, t(option.labelKey), resourceLens === option.id, () => setResourceLens(option.id), <Icon size={22} />);
          })}
        </>
      );
    }
    if (activeModeId === "infrastructure") {
      return (
        <>
          {TRANSPORT_CORRIDOR_MODE_OPTIONS.map((mode) => {
            const Icon = mode.icon;
            return renderLensOptionButton(
              mode.id,
              t(mode.labelKey),
              infrastructureTransportMode === mode.id,
              () => setInfrastructureLens(`${mode.id}:${infrastructureLensView}` as InfrastructureLensId),
              <Icon size={22} style={{ color: mode.color }} />,
            );
          })}
          <span className="mx-1 h-8 w-px shrink-0 bg-gradient-to-b from-transparent via-white/15 to-transparent" />
          {INFRASTRUCTURE_LENS_VIEW_OPTIONS.map((option) => {
            const Icon = INFRASTRUCTURE_LENS_VIEW_ICONS[option.id];
            return renderLensOptionButton(
              option.id,
              t(option.labelKey),
              infrastructureLensView === option.id,
              () => setInfrastructureLens(`${infrastructureTransportMode}:${option.id}` as InfrastructureLensId),
              <Icon size={22} />,
            );
          })}
        </>
      );
    }
    if (activeModeId === "colonization") {
      return COLONIZATION_LENS_OPTIONS.map((option) => {
        const Icon = COLONIZATION_LENS_ICONS[option.id];
        return renderLensOptionButton(option.id, t(option.labelKey), colonizationLens === option.id, () => setColonizationLens(option.id), <Icon size={22} />);
      });
    }
    return MILITARY_LENS_OPTIONS.map((option) => {
      const Icon = MILITARY_LENS_ICONS[option.id];
      return renderLensOptionButton(option.id, t(option.labelKey), militaryLens === option.id, () => setMilitaryLens(option.id), <Icon size={22} />);
    });
  })();

  const activeLensFilterControl = (() => {
    if (activeModeId === "markets" && marketLens === "selectedMarketMembers") {
      return (
        <CustomSelect
          value={selectedMarketLensMarketId}
          onChange={setSelectedMarketLensMarketId}
          className="w-[min(72vw,360px)]"
          buttonClassName="h-10 text-xs font-semibold"
          placement="top"
          options={[
            { value: "current", label: "Текущий рынок" },
            ...marketsCatalog.map((market) => ({ value: market.id, label: market.name })),
          ]}
        />
      );
    }
    if (activeModeId === "resources" && resourceLens === "deposits") {
      return (
        <CustomSelect
          value={resourceGoodId}
          onChange={setResourceGoodId}
          className="w-[min(72vw,360px)]"
          buttonClassName="h-10 text-xs font-semibold"
          placement="top"
          options={[
            { value: "all", label: "Все ресурсы" },
            ...Object.entries(goodMetaById)
            .sort((a, b) => a[1].name.localeCompare(b[1].name, "ru"))
              .map(([goodId, good]) => ({ value: goodId, label: good.name })),
          ]}
        />
      );
    }
    return null;
  })();

  const selectedTransportCorridor = useMemo(
    () =>
      marketTransportCorridors.find((corridor) => corridor.id === selectedTransportCorridorId) ??
      marketTransportCorridors[0] ??
      null,
    [marketTransportCorridors, selectedTransportCorridorId],
  );
  const corridorSummaryRows = useMemo(
    () =>
      marketTransportCorridors.map((corridor) => {
        const load = Math.max(0, Number(corridor.lastLoadByMode?.[corridor.transportMode] ?? 0));
        const capacity = Math.max(0, Number(corridor.lastCapacityByMode?.[corridor.transportMode] ?? 0));
        const utilization = capacity > 0 ? Math.min(1, load / capacity) : corridor.status === "active" ? 1 : 0;
        const progressPct = corridor.costConstruction > 0
          ? Math.min(100, Math.round((corridor.progressConstruction / corridor.costConstruction) * 100))
          : 100;
        return {
          corridor,
          mode: TRANSPORT_CORRIDOR_MODE_OPTIONS.find((row) => row.id === corridor.transportMode),
          ownerName: countryById.get(corridor.ownerCountryId)?.name ?? corridor.ownerCountryId,
          load,
          capacity,
          utilization,
          progressPct,
          canManage: auth?.countryId === corridor.ownerCountryId,
        };
      }),
    [auth?.countryId, countryById, marketTransportCorridors],
  );
  const selectedProvinceCorridorRows = useMemo(
    () =>
      selectedProvinceId
        ? corridorSummaryRows.filter(({ corridor }) => corridor.provinceIds.includes(selectedProvinceId))
        : [],
    [corridorSummaryRows, selectedProvinceId],
  );
  const selectedProvinceCorridorStats = useMemo(() => {
    const total = selectedProvinceCorridorRows.length;
    const active = selectedProvinceCorridorRows.filter(({ corridor }) => corridor.status === "active").length;
    const building = selectedProvinceCorridorRows.filter(({ corridor }) => corridor.status === "building").length;
    const closed = selectedProvinceCorridorRows.filter(({ corridor }) => corridor.status === "closed").length;
    const load = selectedProvinceCorridorRows.reduce((sum, row) => sum + row.load, 0);
    const capacity = selectedProvinceCorridorRows.reduce((sum, row) => sum + row.capacity, 0);
    const utilization = capacity > 0 ? clampPct((load / capacity) * 100) : 0;
    return { total, active, building, closed, load, capacity, utilization };
  }, [selectedProvinceCorridorRows]);
  const corridorProblemRows = useMemo(() => {
    const rows: Array<{
      id: string;
      provinceId: string;
      transport: string;
      problem: string;
      goods: string;
      undelivered: number;
      loadPct: number | null;
      source: string;
      tone: "bad" | "warn" | "muted";
    }> = [];
    for (const summary of corridorSummaryRows) {
      const { corridor, load, capacity, utilization, ownerName } = summary;
      const transport = transportModeLabel(corridor.transportMode);
      const source = `${ownerName} · ${corridor.id.slice(0, 8)}`;
      const provinceIds = corridor.provinceIds.length > 0 ? corridor.provinceIds : ["unknown"];
      const addProblem = (problem: string, tone: "bad" | "warn" | "muted", undelivered = 0, loadPct: number | null = utilization * 100) => {
        for (const provinceId of provinceIds) {
          rows.push({
            id: `${corridor.id}-${problem}-${provinceId}`,
            provinceId,
            transport,
            problem,
            goods: transport,
            undelivered,
            loadPct,
            source,
            tone,
          });
        }
      };
      if (corridor.status === "building") {
        addProblem("Коридор еще строится", "muted", 0, null);
      } else if (corridor.status === "closed") {
        addProblem("Коридор закрыт", "bad", capacity);
      } else if (capacity <= 0) {
        addProblem("Нет пропускной способности", "bad", load);
      } else if (utilization >= 0.98) {
        addProblem("Пропускная способность исчерпана", "bad", Math.max(0, load - capacity));
      } else if (utilization >= 0.85) {
        addProblem("Коридор близок к пределу", "warn");
      }
    }
    return rows.sort((a, b) => a.provinceId.localeCompare(b.provinceId, "ru"));
  }, [corridorSummaryRows]);

  const mapControlsRhythmClass = "h-11 rounded-xl";

  return (
    <>
      <div
        ref={containerRef}
        className="map-surface"
        onContextMenu={(event) => {
          event.preventDefault();
        }}
      />
      <ProvinceHoverTooltip
        open={Boolean(hoverTooltip)}
        x={hoverTooltip?.x ?? 0}
        y={hoverTooltip?.y ?? 0}
        provinceName={hoverTooltip?.provinceName ?? ""}
        areaKm2={hoverTooltip?.areaKm2 ?? null}
        ownerName={hoverTooltip?.ownerName ?? ""}
        colonizers={hoverTooltip?.colonizers ?? []}
        modeLabel={hoverTooltip?.modeLabel}
        modeRows={hoverTooltip?.modeRows}
      />
      <div className="vignette absolute inset-0 pointer-events-none" />

      <MapLensHud
        modes={mapModeOptions}
        activeModeId={activeModeId}
        activeLensControl={activeLensControl}
        activeLensFilterControl={activeLensFilterControl}
        onModeChange={setActiveModeId}
      />

      {showMapControls && (
        <MapControlsHud
          view={view}
          interactionLocked={interactionLocked}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetView={resetView}
          onToggleInteraction={toggleInteraction}
        />
      )}

      {corridorBuildMode && (
        <CorridorBuildHud
          points={corridorBuildRoutePoints}
          provinceIds={corridorBuildProvinceIds}
          pending={corridorPending}
          getProvinceDisplayName={getProvinceDisplayName}
          onUndoPoint={() => {
            setCorridorBuildRoutePoints((current) => {
              const next = current.slice(0, -1);
              setCorridorBuildProvinceIds([...new Set(next.map((point) => point.provinceId))]);
              return next;
            });
          }}
          onCancel={cancelCorridorBuild}
          onConfirm={() => void confirmCorridorBuild()}
        />
      )}

      <AppModal
        modalKey="market"
        open={transportCorridorsModalOpen}
        onClose={() => setTransportCorridorsModalOpen(false)}
        zIndexClassName="z-[185]"
        panelClassName="w-[min(96vw,1180px)] overflow-hidden"
        paddingClassName="p-4 md:p-6 flex items-center justify-center"
      >
        <AppModalHeader
          title="Транспортные коридоры"
          description="Маршруты рынка, загрузка, права строительства и проблемы провинций"
          actions={
            <div className="flex items-center gap-1">
              <AppButton
                type="button"
                variant={transportCorridorsModalView === "corridors" ? "selected" : "ghost"}
                size="sm"
                icon={<Route size={14} />}
                onClick={() => setTransportCorridorsModalView("corridors")}
              >
                Коридоры
              </AppButton>
              <AppButton
                type="button"
                variant={transportCorridorsModalView === "problems" ? "selected" : "ghost"}
                size="sm"
                icon={<AlertTriangle size={14} />}
                onClick={() => setTransportCorridorsModalView("problems")}
              >
                Проблемы
              </AppButton>
            </div>
          }
          onClose={() => setTransportCorridorsModalOpen(false)}
        />
        <div className="relative z-10 min-h-0 flex-1 overflow-hidden">
          {transportCorridorsModalView === "corridors" ? (
            <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.05fr)]">
              <AppSection className="flex min-h-0 flex-col">
                <AppSectionHeader
                  title="Список коридоров"
                  description={`${marketTransportCorridors.length} маршрутов в текущем рынке`}
                  icon={<Network size={16} />}
                  actions={
                    <AppButton type="button" variant="primary" size="sm" icon={<Route size={13} />} onClick={startCorridorBuild}>
                      Построить
                    </AppButton>
                  }
                />
                <AppToolbar className="mb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {TRANSPORT_CORRIDOR_MODE_OPTIONS.map((mode) => {
                      const Icon = mode.icon;
                      const active = corridorBuildTransportMode === mode.id;
                      return (
                        <AppButton
                          key={mode.id}
                          type="button"
                          variant={active ? "selected" : "secondary"}
                          size="sm"
                          icon={<Icon size={13} style={{ color: mode.color }} />}
                          onClick={() => setCorridorBuildTransportMode(mode.id)}
                        >
                          {t(mode.labelKey)}
                        </AppButton>
                      );
                    })}
                  </div>
                </AppToolbar>
                <div className="arc-scrollbar min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                  {corridorSummaryRows.map(({ corridor, mode, ownerName, load, capacity, utilization, progressPct, canManage }) => {
                    const Icon = mode?.icon ?? Route;
                    const active = selectedTransportCorridor?.id === corridor.id;
                    return (
                      <button
                        key={corridor.id}
                        type="button"
                        onClick={() => setSelectedTransportCorridorId(corridor.id)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-[var(--arc-color-primary-border)] bg-[var(--arc-color-paper-muted)] shadow-[var(--arc-shadow-inset-soft)]"
                            : "border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)] hover:border-[var(--arc-color-primary-top)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--arc-color-text-paper)]">
                              <Icon size={15} style={{ color: mode?.color }} />
                              <span className="truncate">{mode ? t(mode.labelKey) : corridor.transportMode}</span>
                              <span className="shrink-0 text-xs text-[var(--arc-color-text-muted)]">{t("map.corridor.levelShort", { level: String(corridor.level) })}</span>
                            </div>
                            <div className="mt-1 text-xs text-[var(--arc-color-text-muted)]">
                              {ownerName} · {corridor.status === "building" ? "строится" : corridor.status === "closed" ? "закрыт" : "активен"}
                            </div>
                          </div>
                          <span className={`rounded-lg border px-2 py-1 text-[11px] ${canManage ? "border-[var(--arc-color-primary-border)] text-[var(--arc-color-primary-top)]" : "border-[var(--arc-color-brown)] text-[var(--arc-color-text-muted)]"}`}>
                            {canManage ? "наш" : "чужой"}
                          </span>
                        </div>
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-[11px] text-[var(--arc-color-text-muted)]">
                            <span>{corridor.status === "building" ? "Строительство" : "Загрузка"}</span>
                            <span>{corridor.status === "building" ? `${progressPct}%` : `${formatCompact(load)} / ${formatCompact(capacity)}`}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper)]">
                            <div
                              className="h-full bg-gradient-to-r from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)]"
                              style={{ width: `${corridor.status === "building" ? progressPct : Math.min(100, Math.round(utilization * 100))}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {corridorSummaryRows.length === 0 ? (
                    <AppEmptyState title="Коридоров пока нет" icon={<Route size={18} />} action={<AppButton type="button" variant="primary" size="sm" onClick={startCorridorBuild}>Построить первый</AppButton>}>
                      Выберите тип транспорта и проложите маршрут на карте.
                    </AppEmptyState>
                  ) : null}
                </div>
              </AppSection>

              <AppSection className="min-h-0 overflow-auto">
                {selectedTransportCorridor ? (() => {
                  const summary = corridorSummaryRows.find((row) => row.corridor.id === selectedTransportCorridor.id);
                  const mode = summary?.mode ?? TRANSPORT_CORRIDOR_MODE_OPTIONS.find((row) => row.id === selectedTransportCorridor.transportMode);
                  const Icon = mode?.icon ?? Route;
                  const canManage = summary?.canManage ?? auth?.countryId === selectedTransportCorridor.ownerCountryId;
                  const load = summary?.load ?? 0;
                  const capacity = summary?.capacity ?? 0;
                  const utilizationPct = Math.round((summary?.utilization ?? 0) * 100);
                  return (
                    <div className="space-y-3">
                      <AppSectionHeader
                        title={mode ? t(mode.labelKey) : selectedTransportCorridor.transportMode}
                        icon={<Icon size={17} style={{ color: mode?.color }} />}
                        description={`Владелец: ${summary?.ownerName ?? selectedTransportCorridor.ownerCountryId}`}
                        actions={
                          <div className="flex flex-wrap gap-1.5">
                            {selectedTransportCorridor.status === "active" ? (
                              <AppButton type="button" variant="ghost" size="sm" disabled={!canManage || corridorPendingId === selectedTransportCorridor.id} onClick={() => void applyCorridorAction(selectedTransportCorridor, "close")}>
                                Закрыть
                              </AppButton>
                            ) : null}
                            {selectedTransportCorridor.status === "closed" ? (
                              <AppButton type="button" variant="secondary" size="sm" disabled={!canManage || corridorPendingId === selectedTransportCorridor.id} onClick={() => void applyCorridorAction(selectedTransportCorridor, "open")}>
                                Открыть
                              </AppButton>
                            ) : null}
                            {selectedTransportCorridor.status !== "building" ? (
                              <AppButton type="button" variant="secondary" size="sm" disabled={!canManage || corridorPendingId === selectedTransportCorridor.id} onClick={() => void applyCorridorAction(selectedTransportCorridor, "upgrade")}>
                                Улучшить
                              </AppButton>
                            ) : null}
                            <AppButton type="button" variant="danger" size="icon" disabled={!canManage || corridorPendingId === selectedTransportCorridor.id} onClick={() => void applyCorridorAction(selectedTransportCorridor, "demolish")}>
                              <Trash2 size={14} />
                            </AppButton>
                          </div>
                        }
                      />
                      <div className="grid gap-2 sm:grid-cols-4">
                        {[
                          ["Статус", selectedTransportCorridor.status === "building" ? "строится" : selectedTransportCorridor.status === "closed" ? "закрыт" : "активен"],
                          ["Уровень", String(selectedTransportCorridor.level)],
                          ["Загрузка", `${utilizationPct}%`],
                          ["Ёмкость", formatCompact(capacity)],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-xl border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)] p-3">
                            <div className="text-[11px] uppercase tracking-wide text-[var(--arc-color-text-muted)]">{label}</div>
                            <div className="mt-1 text-lg font-semibold text-[var(--arc-color-text-paper)]">{value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)] p-3">
                        <div className="mb-2 flex justify-between text-xs text-[var(--arc-color-text-muted)]">
                          <span>Использовано пропускной способности</span>
                          <span>{formatCompact(load)} / {formatCompact(capacity)}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper)]">
                          <div className="h-full bg-gradient-to-r from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)]" style={{ width: `${Math.min(100, utilizationPct)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">Маршрут</div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedTransportCorridor.provinceIds.map((provinceId, index) => (
                            <span key={`${selectedTransportCorridor.id}-${provinceId}-${index}`} className="rounded-lg border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)] px-2 py-1 text-xs text-[var(--arc-color-text-paper)]">
                              {index + 1}. {getProvinceDisplayName(provinceId)}
                            </span>
                          ))}
                        </div>
                      </div>
                      {selectedTransportCorridor.foreignConstructionRights && selectedTransportCorridor.foreignConstructionRights.length > 0 ? (
                        <div>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">Чужая территория</div>
                          <AppTableShell>
                            <AppTable>
                              <thead>
                                <tr>
                                  <AppHeadCell>Провинция</AppHeadCell>
                                  <AppHeadCell>Разрешила страна</AppHeadCell>
                                  <AppHeadCell>После окончания</AppHeadCell>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedTransportCorridor.foreignConstructionRights.map((right) => (
                                  <tr key={`${right.agreementId}-${right.provinceId}`}>
                                    <AppCell>{getProvinceDisplayName(right.provinceId)}</AppCell>
                                    <AppCell>{countryById.get(right.grantorCountryId)?.name ?? right.grantorCountryId}</AppCell>
                                    <AppCell>{right.expirationPolicy === "nationalize_to_territory_owner" ? "Национализировать" : "Отключить без транзита"}</AppCell>
                                  </tr>
                                ))}
                              </tbody>
                            </AppTable>
                          </AppTableShell>
                        </div>
                      ) : null}
                    </div>
                  );
                })() : (
                  <AppEmptyState title="Выберите коридор" icon={<Network size={18} />}>
                    Детальная информация появится справа.
                  </AppEmptyState>
                )}
              </AppSection>
            </div>
          ) : (
            <AppSection className="h-full min-h-0 overflow-hidden">
              <AppSectionHeader
                title="Проблемы инфраструктуры"
                description="Провинции, где транспортный коридор закрыт, строится или близок к пределу"
                icon={<AlertTriangle size={16} />}
                actions={<AppButton type="button" variant="secondary" size="sm" onClick={() => setTransportCorridorsModalView("corridors")}>К коридорам</AppButton>}
              />
              <AppTableShell className="max-h-[640px]">
                <AppTable className="min-w-[980px]">
                  <thead>
                    <tr>
                      <AppHeadCell><Tooltip content="Провинция, где проблема видна на карте или проходит проблемный коридор."><span>Провинция</span></Tooltip></AppHeadCell>
                      <AppHeadCell><Tooltip content="Тип транспорта, для которого обнаружена нехватка или ограничение."><span>Транспорт</span></Tooltip></AppHeadCell>
                      <AppHeadCell><Tooltip content="Главная причина: коридор закрыт, строится, не имеет ёмкости или перегружен."><span>Проблема</span></Tooltip></AppHeadCell>
                      <AppHeadCell><Tooltip content="Группа товаров или транспортная категория, на которую влияет проблема."><span>Товары</span></Tooltip></AppHeadCell>
                      <AppHeadCell><Tooltip content="Оценка объёма, который не прошёл из-за ограничения. Если точных данных нет, поле остаётся нулевым."><span>Не доставлено</span></Tooltip></AppHeadCell>
                      <AppHeadCell><Tooltip content="Текущая загрузка коридора относительно его общей пропускной способности."><span>Загрузка</span></Tooltip></AppHeadCell>
                      <AppHeadCell><Tooltip content="Коридор или линза, из которой пришёл сигнал проблемы."><span>Источник</span></Tooltip></AppHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {corridorProblemRows.map((row) => (
                      <tr key={row.id}>
                        <AppCell>{getProvinceDisplayName(row.provinceId)}</AppCell>
                        <AppCell>{row.transport}</AppCell>
                        <AppCell>
                          <span className={`rounded-lg border px-2 py-1 text-xs ${
                            row.tone === "bad"
                              ? "border-[var(--arc-color-danger-border)] text-[var(--arc-color-danger-text)]"
                              : row.tone === "warn"
                                ? "border-[var(--arc-color-warning-border)] text-[var(--arc-color-text-paper)]"
                                : "border-[var(--arc-color-brown)] text-[var(--arc-color-text-muted)]"
                          }`}>
                            {row.problem}
                          </span>
                        </AppCell>
                        <AppCell>{row.goods}</AppCell>
                        <AppCell>{formatCompact(row.undelivered)}</AppCell>
                        <AppCell>{row.loadPct == null ? "нет данных" : `${Math.round(row.loadPct)}%`}</AppCell>
                        <AppCell>{row.source}</AppCell>
                      </tr>
                    ))}
                  </tbody>
                </AppTable>
              </AppTableShell>
              {corridorProblemRows.length === 0 ? (
                <AppEmptyState className="mt-3" title="Критичных проблем нет" icon={<Check size={18} />}>
                  Активные коридоры не перегружены и не закрыты.
                </AppEmptyState>
              ) : null}
            </AppSection>
          )}
        </div>
      </AppModal>

      {contextMenu && (
        <ProvinceContextMenuHud
          x={contextMenu.x}
          y={contextMenu.y}
          provinceName={contextMenu.provinceName}
          canOpenProvinceKnowledge={Boolean(onOpenProvinceKnowledge)}
          canCreateProvinceKnowledge={Boolean(auth?.isAdmin && onCreateProvinceKnowledge)}
          canOpenAdminProvinceEditor={Boolean(auth?.isAdmin && onOpenAdminProvinceEditor)}
          onOpenColonization={() => {
            setSelectedProvince(contextMenu.provinceId);
            setSelectedProvinceName(contextMenu.provinceName);
            setColonizationModalOpen(true);
            setContextMenu(null);
          }}
          onOpenProvinceKnowledge={() => {
            onOpenProvinceKnowledge?.(contextMenu.provinceId, contextMenu.provinceName);
            setContextMenu(null);
          }}
          onCreateProvinceKnowledge={() => {
            onCreateProvinceKnowledge?.(contextMenu.provinceId, contextMenu.provinceName);
            setContextMenu(null);
          }}
          onOpenAdminProvinceEditor={() => {
            setSelectedProvince(contextMenu.provinceId);
            setSelectedProvinceName(contextMenu.provinceName);
            onOpenAdminProvinceEditor?.(contextMenu.provinceId);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {selectedProvinceId && (
        <div className={`absolute right-4 top-20 z-30 max-w-[calc(100vw-2rem)] ${selectedProvincePanelCollapsed ? "w-[22rem]" : "w-[39rem]"}`}>
          <SelectedProvincePanelFrame
            collapsed={selectedProvincePanelCollapsed}
            pinned={selectedProvincePanelPinned}
            provinceName={selectedProvinceDisplayName ?? selectedProvinceId}
            collapsedSummary={`${selectedOwnerLabel} · ${formatCompact(selectedPopulationSummary.total)} жителей · ${selectedBuildingTotals.instances} зданий`}
            provinceMeta={(
              <>
                <span>ID: {selectedProvinceId}</span>
                {selectedProvinceAreaKm2 != null && <span>{Math.round(selectedProvinceAreaKm2).toLocaleString("ru-RU")} км2</span>}
                <span>{selectedIsNeutral ? "Нейтральная территория" : "Под управлением"}</span>
              </>
            )}
            ownerLabel={selectedOwnerLabel}
            ownerColor={selectedOwner?.color}
            ownerFlagUrl={selectedOwnerFlagUrl}
            metrics={[
              { icon: Users, label: "Население", value: formatCompact(selectedPopulationSummary.total), sub: `${selectedPopulationSummary.popGroups} групп` },
              { icon: Route, label: "Коридоры", value: `${selectedProvinceCorridorStats.active}/${selectedProvinceCorridorStats.total}`, sub: `${Math.round(selectedProvinceCorridorStats.utilization)}% загрузка` },
              { icon: Building2, label: "Здания", value: String(selectedBuildingTotals.instances), sub: `${selectedBuildingTotals.levels} ур.` },
              { icon: Coins, label: "Баланс", value: formatSignedCompact(selectedBuildingTotals.netDucats), sub: "здания/ход" },
            ]}
            problems={(
              <div className="flex flex-wrap gap-1.5">
                {selectedProblems.map((problem) => (
                  <span
                    key={problem.id}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${
                      problem.tone === "rose"
                        ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                        : problem.tone === "amber"
                          ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                          : problem.tone === "sky"
                            ? "border-sky-400/30 bg-sky-500/10 text-sky-100"
                            : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    }`}
                  >
                    {problem.tone === "emerald" ? <Check size={12} /> : <AlertTriangle size={12} />}
                    {problem.label}
                  </span>
                ))}
              </div>
            )}
            tabs={[
              { id: "overview" as const, icon: Info, label: "Обзор" },
              { id: "corridors" as const, icon: Route, label: "Коридоры" },
              { id: "population" as const, icon: Users, label: "Население" },
              { id: "buildings" as const, icon: Building2, label: "Постройки" },
              { id: "resources" as const, icon: Pickaxe, label: "Ресурсы" },
            ]}
            activeTab={selectedProvincePanelTab}
            onExpand={() => setSelectedProvincePanelCollapsed(false)}
            onCollapse={() => setSelectedProvincePanelCollapsed(true)}
            onClose={() => setSelectedProvince(null)}
            onTogglePinned={() => setSelectedProvincePanelPinned((v) => !v)}
            onTabChange={setSelectedProvincePanelTab}
          >
                <AnimatePresence mode="wait" initial={false}>
                  {selectedProvincePanelTab === "overview" && (
                    <motion.div
                      key="province-overview"
                      initial={{ opacity: 0, y: 6, scale: 0.995 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.995 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="space-y-3"
                    >
                      <section className="grid gap-2 md:grid-cols-2">
                        <div className="rounded-lg border border-white/10 bg-[#101720] p-3">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                            <Landmark size={13} /> Управление
                          </div>
                          <div className="space-y-2 text-xs text-white/65">
                            <div className="flex justify-between"><span>Приказов в провинции</span><span className="text-white">{selectedProvinceOrdersCount}</span></div>
                            <div className="flex justify-between"><span>Колонизация</span><span className="text-white">{selectedIsColonizationDisabled ? "Запрещена" : selectedIsNeutral ? "Доступна" : "Завершена"}</span></div>
                            <div className="flex justify-between"><span>Стоимость</span><span className="text-white">{selectedColonizationCost} очк. / {selectedColonizationDucatsCost} дук.</span></div>
                          </div>
                          <div className="mt-3 grid gap-2">
                            <AppButton
                              type="button"
                              onClick={() => selectedRegionId && onQueueBuildOrder(selectedRegionId)}
                              variant="secondary"
                              size="sm"
                              icon={<Hammer size={12} />}
                              className="w-full"
                            >
                              Построить
                            </AppButton>
                            <AppButton
                              type="button"
                              onClick={() => setTransportCorridorsModalOpen(true)}
                              variant="secondary"
                              size="sm"
                              icon={<Route size={12} />}
                              className="w-full"
                            >
                              Коридоры
                            </AppButton>
                            {selectedCanStartExploration && (
                              <AppButton
                                type="button"
                                disabled={explorationActionPending}
                                onClick={() => void handleStartExploration()}
                                variant="secondary"
                                size="sm"
                                icon={<Pickaxe size={12} />}
                                className="w-full"
                              >
                                {explorationActionPending ? "Запуск разведки..." : "Разведка"}
                              </AppButton>
                            )}
                            {selectedCanRenameProvince && (
                              <AppButton
                                type="button"
                                onClick={() => {
                                  setProvinceRenameInput((getProvinceDisplayName(selectedProvinceId, selectedProvinceDisplayName) ?? "").slice(0, 64));
                                  setProvinceRenameModalOpen(true);
                                }}
                                variant="secondary"
                                size="sm"
                                icon={<Info size={12} />}
                                className="w-full"
                              >
                                Переименовать провинцию
                              </AppButton>
                            )}
                            {auth?.isAdmin && onOpenAdminProvinceEditor && (
                              <AppButton
                                type="button"
                                onClick={() => onOpenAdminProvinceEditor(selectedProvinceId)}
                                variant="secondary"
                                size="sm"
                                icon={<Landmark size={12} />}
                                className="w-full"
                              >
                                Админ
                              </AppButton>
                            )}
                            {selectedRegionId && (
                              <AppButton
                                type="button"
                                onClick={() => setColonizationModalOpen(true)}
                                variant="primary"
                                size="sm"
                                icon={<Flag size={12} />}
                                className="w-full"
                              >
                                {t("provinceTooltip.colonization")}
                              </AppButton>
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#101720] p-3">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                            <Info size={13} /> Данные провинции
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-white/65">
                            <div className="text-white/45">Тип</div>
                            <div className="text-right text-white">{formatProvinceMetaValue(selectedProvinceMeta?.provinceType)}</div>
                            <div className="text-white/45">Климат</div>
                            <div className="text-right text-white">{formatProvinceMetaValue(selectedProvinceMeta?.climate)}</div>
                            <div className="text-white/45">Ландшафт</div>
                            <div className="text-right text-white">{formatProvinceMetaValue(selectedProvinceMeta?.landscape)}</div>
                            <div className="text-white/45">Континент</div>
                            <div className="text-right text-white">{formatProvinceMetaValue(selectedProvinceMeta?.continent)}</div>
                            <div className="text-white/45">Стратегический регион</div>
                            <div className="text-right text-white">{formatProvinceMetaValue(selectedProvinceMeta?.strategicRegion)}</div>
                            <div className="text-white/45">Радиация</div>
                            <div className="text-right text-white">{formatProvinceMetaValue(selectedProvinceMeta?.radiation)}</div>
                            <div className="text-white/45">Загрязнение</div>
                            <div className="text-right text-white">{formatProvinceMetaValue(selectedProvinceMeta?.pollution)}</div>
                            <div className="text-white/45">Плодородность</div>
                            <div className="text-right text-white">{formatProvinceMetaValue(selectedProvinceMeta?.fertility, "%")}</div>
                            <div className="text-white/45">Плодородные земли</div>
                            <div className="text-right text-white">{formatProvinceMetaValue(selectedProvinceMeta?.fertileLandKm2, " км2")}</div>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-lg border border-white/10 bg-[#101720] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                            <Network size={13} /> Соседние провинции
                          </div>
                          <span className="rounded-md border border-white/10 bg-black/25 px-1.5 py-0.5 text-[10px] text-white/45">
                            {selectedProvinceNeighborIds.length}
                          </span>
                        </div>
                        {selectedProvinceNeighborIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedProvinceNeighborIds.map((provinceId) => (
                              <button
                                key={provinceId}
                                type="button"
                                onClick={() => {
                                  setSelectedProvince(provinceId);
                                  setSelectedProvinceName(getProvinceDisplayName(provinceId));
                                }}
                                className="rounded-md border border-white/10 bg-black/25 px-2 py-1 font-mono text-[11px] text-white/65 transition hover:border-arc-accent/35 hover:text-arc-accent"
                              >
                                {provinceId}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-md border border-dashed border-white/10 bg-black/20 px-2 py-2 text-xs text-white/45">
                            В индексе карты нет соседних provinceId.
                          </div>
                        )}
                      </section>

                      {selectedColonyProgressList.length > 0 && (
                        <section className="rounded-lg border border-white/10 bg-[#101720] p-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Гонка колонизации</div>
                          <div className="space-y-2">
                            {selectedColonyProgressList.map(([countryId, points]) => {
                              const pct = clampPct((points / selectedColonizationCost) * 100);
                              return (
                                <div key={countryId}>
                                  <div className="mb-1 flex justify-between text-xs text-white/65">
                                    <span>{countryById.get(countryId)?.name ?? countryId}</span>
                                    <span>{points.toFixed(1)} / {selectedColonizationCost}</span>
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full bg-arc-accent" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      )}
                    </motion.div>
                  )}

                  {selectedProvincePanelTab === "corridors" && (
                    <motion.div
                      key="province-corridors"
                      initial={{ opacity: 0, y: 6, scale: 0.995 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.995 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="space-y-3"
                    >
                      <section className="rounded-lg border border-white/10 bg-[#101720] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                            <Route size={13} /> Транспортные коридоры
                          </div>
                          <AppButton
                            type="button"
                            onClick={() => setTransportCorridorsModalOpen(true)}
                            variant="secondary"
                            size="sm"
                            icon={<Route size={12} />}
                          >
                            Открыть
                          </AppButton>
                        </div>

                        <div className="grid gap-2 md:grid-cols-3">
                          <div className="rounded-md border border-white/10 bg-black/20 p-2">
                            <div className="text-[10px] uppercase tracking-wide text-white/45">Активные</div>
                            <div className="mt-1 text-lg font-semibold text-emerald-200">{selectedProvinceCorridorStats.active}</div>
                          </div>
                          <div className="rounded-md border border-white/10 bg-black/20 p-2">
                            <div className="text-[10px] uppercase tracking-wide text-white/45">Строятся</div>
                            <div className="mt-1 text-lg font-semibold text-amber-200">{selectedProvinceCorridorStats.building}</div>
                          </div>
                          <div className="rounded-md border border-white/10 bg-black/20 p-2">
                            <div className="text-[10px] uppercase tracking-wide text-white/45">Закрытые</div>
                            <div className={`mt-1 text-lg font-semibold ${selectedProvinceCorridorStats.closed > 0 ? "text-rose-200" : "text-white/65"}`}>
                              {selectedProvinceCorridorStats.closed}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-2">
                          <div className="mb-1 flex justify-between text-[11px] text-white/55">
                            <span>Загрузка коридоров</span>
                            <span>{formatCompact(selectedProvinceCorridorStats.load)} / {formatCompact(selectedProvinceCorridorStats.capacity)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full ${selectedProvinceCorridorStats.utilization >= 95 ? "bg-rose-400" : selectedProvinceCorridorStats.utilization >= 80 ? "bg-amber-300" : "bg-emerald-400"}`}
                              style={{ width: `${selectedProvinceCorridorStats.capacity > 0 ? selectedProvinceCorridorStats.utilization : 0}%` }}
                            />
                          </div>
                        </div>
                      </section>

                      <section className="rounded-lg border border-white/10 bg-[#101720] p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                          <Network size={13} /> Маршруты через провинцию
                        </div>
                        <div className="space-y-2">
                          {selectedProvinceCorridorRows.map(({ corridor, mode, ownerName, load, capacity, utilization, progressPct }) => {
                            const pct = Math.round(utilization * 100);
                            const isBuilding = corridor.status === "building";
                            const barPct = isBuilding ? progressPct : Math.min(100, pct);
                            const barColor = corridor.status === "closed"
                              ? "#dc2626"
                              : isBuilding
                                ? "#f59e0b"
                                : pct >= 95
                                  ? "#dc2626"
                                  : pct >= 80
                                    ? "#f59e0b"
                                    : "#22c55e";
                            return (
                              <div key={corridor.id} className="rounded-md border border-white/10 bg-black/20 p-2">
                                <div className="mb-1 flex justify-between gap-2 text-xs text-white/65">
                                  <span className="truncate">{mode ? t(mode.labelKey) : transportModeLabel(corridor.transportMode)}</span>
                                  <span className={corridor.status === "active" ? "text-emerald-200" : corridor.status === "building" ? "text-amber-200" : "text-rose-200"}>
                                    {corridor.status === "active" ? "активен" : corridor.status === "building" ? "строится" : "закрыт"}
                                  </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                  <div className="h-full" style={{ width: `${barPct}%`, backgroundColor: barColor }} />
                                </div>
                                <div className="mt-1 flex justify-between gap-2 text-[11px] text-white/45">
                                  <span className="truncate">{ownerName}</span>
                                  <span>{isBuilding ? `${progressPct}%` : `${formatCompact(load)} / ${formatCompact(capacity)}`}</span>
                                </div>
                              </div>
                            );
                          })}
                          {selectedProvinceCorridorRows.length === 0 ? (
                            <div className="rounded-md border border-dashed border-white/15 bg-black/20 p-2 text-xs text-white/50">
                              Через провинцию не проходит ни один коридор.
                            </div>
                          ) : null}
                        </div>
                      </section>
                    </motion.div>
                  )}

                  {selectedProvincePanelTab === "population" && (
                    <motion.div
                      key="province-population"
                      initial={{ opacity: 0, y: 6, scale: 0.995 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.995 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: "Всего", value: formatCompact(selectedPopulationSummary.total) },
                          { label: "SoL", value: selectedPopulationSummary.averageSoL.toFixed(1) },
                          { label: "Потребности", value: formatPercent(selectedPopulationSummary.satisfaction) },
                          { label: "Баланс", value: `${formatCompact(selectedPopulationSummary.loyalists)} / ${formatCompact(selectedPopulationSummary.radicals)}` },
                        ].map((item) => (
                          <div key={item.label} className="rounded-lg border border-white/10 bg-[#101720] p-2">
                            <div className="text-[10px] uppercase tracking-wide text-white/45">{item.label}</div>
                            <div className="mt-1 truncate text-sm font-semibold text-white">{item.value}</div>
                          </div>
                        ))}
                      </div>

                      {[
                        { title: "Профессии", rows: selectedPopulationSummary.professions, icon: Briefcase },
                        { title: "Культуры", rows: selectedPopulationSummary.cultures, icon: Layers3 },
                        { title: "Религии", rows: selectedPopulationSummary.religions, icon: Sparkles },
                      ].map((block) => {
                        const Icon = block.icon;
                        return (
                          <section key={block.title} className="rounded-lg border border-white/10 bg-[#101720] p-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                              <Icon size={13} /> {block.title}
                            </div>
                            {block.rows.length === 0 ? (
                              <div className="rounded-md border border-dashed border-white/15 bg-black/20 p-2 text-[11px] text-white/50">Нет данных</div>
                            ) : (
                              <div className="space-y-2">
                                {block.rows.map((row) => {
                                  const pct = selectedPopulationSummary.total > 0 ? clampPct((row.value / selectedPopulationSummary.total) * 100) : 0;
                                  return (
                                    <div key={row.id}>
                                      <div className="mb-1 flex justify-between gap-2 text-xs text-white/65">
                                        <span className="truncate">{row.label}</span>
                                        <span>{formatCompact(row.value)} · {formatPercent(pct)}</span>
                                      </div>
                                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: row.color }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </motion.div>
                  )}

                  {selectedProvincePanelTab === "buildings" && (
                    <motion.div
                      key="province-buildings"
                      initial={{ opacity: 0, y: 6, scale: 0.995 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.995 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="space-y-3"
                    >
                      <section className="rounded-lg border border-white/10 bg-[#101720] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                            <Building2 size={13} /> Производственные строки
                          </div>
                          <button
                            type="button"
                            onClick={() => selectedRegionId && onQueueBuildOrder(selectedRegionId)}
                            className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-[11px] font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
                          >
                            <Hammer size={12} className="mr-1 inline" /> Построить
                          </button>
                        </div>
                        {selectedBuiltBuildings.length === 0 ? (
                          <div className="rounded-md border border-dashed border-white/15 bg-black/20 p-2 text-[11px] text-white/50">В провинции нет построенных зданий</div>
                        ) : (
                          <div className="space-y-2">
                            {selectedBuiltBuildings.map((row) => (
                              <div key={row.buildingId} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    {row.logoUrl ? <img src={row.logoUrl} alt="" className="h-6 w-6 rounded object-contain" /> : <Building2 size={16} className="text-white/50" />}
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-semibold text-white/85">{row.buildingName}</div>
                                      <div className="text-[11px] text-white/45">{row.count} шт. · уровень {row.levels}</div>
                                    </div>
                                  </div>
                                  <div className={`text-right text-xs font-semibold ${row.netDucats >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                                    {formatSignedCompact(row.netDucats)}
                                    <div className="text-[10px] font-normal text-white/45">прод. {formatPercent(row.productivity * 100)}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="rounded-lg border border-white/10 bg-[#101720] p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                          <Hammer size={13} /> Очередь строительства
                        </div>
                        {selectedConstructionRows.length === 0 ? (
                          <div className="rounded-md border border-dashed border-white/15 bg-black/20 p-2 text-[11px] text-white/50">Очередь пуста</div>
                        ) : (
                          <div className="space-y-2">
                            {selectedConstructionRows.map((project) => (
                              <div key={project.queueId}>
                                <div className="mb-1 flex justify-between gap-2 text-xs text-white/65">
                                  <span className="truncate">{project.projectType === "upgrade" ? "Апгрейд" : "Стройка"}: {project.buildingName}</span>
                                  <span>{formatPercent(project.progressPct)}</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                  <div className="h-full bg-arc-accent" style={{ width: `${project.progressPct}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </motion.div>
                  )}

                  {selectedProvincePanelTab === "resources" && (
                    <motion.div
                      key="province-resources"
                      initial={{ opacity: 0, y: 6, scale: 0.995 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.995 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="space-y-3"
                    >
                      <section className="rounded-lg border border-white/10 bg-[#101720] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                            <Pickaxe size={13} /> Разведка
                          </div>
                          <div className="text-[11px] text-white/45">{Math.floor(selectedExplorationCount).toLocaleString("ru-RU")} завершено</div>
                        </div>
                        {selectedCanStartExploration && (
                          <AppButton
                            type="button"
                            disabled={explorationActionPending}
                            onClick={() => void handleStartExploration()}
                            variant="secondary"
                            size="sm"
                            icon={<Pickaxe size={12} />}
                            className="mb-2 w-full"
                          >
                            {explorationActionPending ? "Запуск..." : "Запустить разведку"}
                          </AppButton>
                        )}
                        {selectedExplorationQueue.length > 0 ? (
                          <div className="space-y-1.5">
                            {selectedExplorationQueue.map((project) => (
                              <div key={project.queueId} className="flex items-center justify-between rounded-md border border-white/10 bg-black/25 px-2 py-1 text-xs">
                                <span className="text-white/65">Экспедиция</span>
                                <span className="font-semibold text-arc-accent">{Math.max(0, Math.floor(project.turnsRemaining))} ход.</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-md border border-dashed border-white/15 bg-black/20 p-2 text-[11px] text-white/50">Активной разведки нет</div>
                        )}
                      </section>

                      <section className="rounded-lg border border-white/10 bg-[#101720] p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                          <Package size={13} /> Обнаруженные залежи
                        </div>
                        {selectedResourceDeposits.length === 0 ? (
                          <div className="rounded-md border border-dashed border-white/15 bg-black/20 p-2 text-[11px] text-white/50">Залежи не обнаружены</div>
                        ) : (
                          <div className="space-y-2">
                            {selectedResourceDeposits.map((row) => (
                              <div key={row.goodId} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  {row.logoUrl ? <img src={row.logoUrl} alt="" className="h-5 w-5 rounded-sm object-contain" /> : <Pickaxe size={14} className="text-white/50" />}
                                  <span className="truncate text-white/80">{row.goodName}</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-semibold text-white/75">{Math.floor(row.amount).toLocaleString("ru-RU")}</div>
                                  <div className="text-[10px] uppercase tracking-wide text-white/45">{row.veinSize}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </motion.div>
                  )}
                </AnimatePresence>
          </SelectedProvincePanelFrame>
        </div>
      )}

      <AnimatePresence>
        {provinceRenameModalOpen && selectedProvinceId && (
          <AppModal
            modalKey="province-details"
            open={provinceRenameModalOpen}
            onClose={() => !provinceRenamePending && setProvinceRenameModalOpen(false)}
            zIndexClassName="z-[122]"
            panelClassName="h-auto w-full max-w-lg"
            paddingClassName="p-4 flex items-center justify-center"
          >
                  <AppModalHeader
                    title="Переименование провинции"
                    onClose={() => setProvinceRenameModalOpen(false)}
                    closeDisabled={provinceRenamePending}
                  />

                  <div className="space-y-3">
                    <AppCard className="bg-black/20 text-xs text-slate-300">
                      <div className="mb-1 text-white/90">
                        Текущее название: <span className="font-semibold">{selectedProvinceDisplayName ?? selectedProvinceId}</span>
                      </div>
                      <div className="inline-flex items-center gap-1 text-white/60">
                        <span>Стоимость переименования:</span>
                        {ducatsIconUrl ? (
                          <img src={ducatsIconUrl} alt="" className="h-[21px] w-[21px] object-contain" />
                        ) : (
                          <Coins size={13} className="text-amber-300" />
                        )}
                        <span>{formatCompact(selectedProvinceRenameCost)}</span>
                      </div>
                    </AppCard>

                    <AppField label="Новое название (до 64 символов)" hint="Только владельцы провинции могут менять название">
                      <AppInput
                        autoFocus
                        value={provinceRenameInput}
                        maxLength={64}
                        onChange={(e) => setProvinceRenameInput(e.target.value.slice(0, 64))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !provinceRenamePending) {
                            e.preventDefault();
                            void handleRenameOwnedProvince();
                          }
                        }}
                        placeholder="Введите название провинции"
                      />
                      <div className="-mt-5 flex justify-end text-[11px]">
                        <span className={provinceRenameInput.trim().length >= 64 ? "text-amber-300" : "text-white/45"}>
                          {provinceRenameInput.length}/64
                        </span>
                      </div>
                    </AppField>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <AppButton
                        type="button"
                        onClick={() => setProvinceRenameModalOpen(false)}
                        disabled={provinceRenamePending}
                        variant="ghost"
                        size="sm"
                      >
                        Отмена
                      </AppButton>
                      <AppButton
                        type="button"
                        onClick={() => void handleRenameOwnedProvince()}
                        disabled={provinceRenamePending || !provinceRenameInput.trim()}
                        variant="primary"
                        size="sm"
                      >
                        {provinceRenamePending ? "Сохранение..." : "Сохранить"}
                      </AppButton>
                    </div>
                  </div>
          </AppModal>
        )}
      </AnimatePresence>

      <ColonizationModal
        open={colonizationModalOpen && Boolean(selectedProvinceId)}
        regionId={selectedRegionId}
        regionName={selectedRegionId}
        regionAreaKm2={null}
        ownerCountryId={selectedRegionOwnerId}
        colonizationCost={selectedColonizationCost}
        colonizationDucatsCost={selectedColonizationDucatsCost}
        colonizationDisabled={selectedIsColonizationDisabled}
        progressByCountry={selectedColonyProgress}
        currentCountryId={auth?.countryId ?? null}
        countries={countries}
        colonizationIconUrl={colonizationIconUrl}
        ducatsIconUrl={ducatsIconUrl}
        colonizationLimit={
          auth?.countryId && typeof maxActiveColonizations === "number"
            ? { active: currentCountryActiveColonizationTargets.size, max: Math.max(1, maxActiveColonizations) }
            : null
        }
        colonizedRegionOptions={colonizedProvinceOptions}
        selectedColonizedRegionId={selectedRegionId}
        onSelectColonizedRegion={(regionId) => {
          const provinceId = provinceIdsByRegion.get(regionId)?.[0] ?? regionId;
          setSelectedProvince(provinceId);
          setSelectedProvinceName(getProvinceDisplayName(provinceId));
        }}
        canStart={selectedCanStartColonization}
        canCancel={selectedCanCancelColonization}
        pending={colonizationActionPending}
        onClose={() => setColonizationModalOpen(false)}
        onStart={handleStartColonization}
        onCancel={handleCancelColonization}
        canOpenAdminProvinceEditor={Boolean(auth?.isAdmin && selectedProvinceId)}
        onOpenAdminProvinceEditor={
          auth?.isAdmin && selectedProvinceId
            ? () => {
                setColonizationModalOpen(false);
                onOpenAdminProvinceEditor?.(selectedProvinceId);
              }
            : undefined
        }
      />
    </>
  );
}
